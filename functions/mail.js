/* Uitgaande e-mail: verstuurt elk nieuw document in `mail/{id}` via SMTP.
   Vervangt de Firebase-extensie "Trigger Email" (Firebase Extensions wordt op 31-03-2027 stopgezet).
   Zelfde documentvorm als de extensie, dus de app en functions schrijven ongewijzigd:
     { to: 'a@b.nl' | ['a@b.nl', …], message: { subject, text } }
   Alleen Cloud Functions schrijven in `mail` (rules: dicht voor de app).
   Resultaat komt terug in het document: delivery.state = PROCESSING | SUCCESS | ERROR.
   Instellingen (bij de eerste deploy gevraagd, niet geheim): SMTP_HOST, SMTP_PORT, SMTP_GEBRUIKER, MAIL_VAN.
   Geheim: SMTP_WACHTWOORD  →  firebase functions:secrets:set SMTP_WACHTWOORD */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineString, defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const MAX_ONTVANGERS = 10;
const MAX_TEKST = 20000;

const SMTP_HOST = defineString('SMTP_HOST', { description: 'SMTP-server van de mailbox, bijvoorbeeld smtp.strato.com' });
const SMTP_PORT = defineString('SMTP_PORT', { default: '465', description: '465 (SSL) of 587 (STARTTLS)' });
const SMTP_GEBRUIKER = defineString('SMTP_GEBRUIKER', { default: 'paul@cluppie.io', description: 'Gebruikersnaam (volledig e-mailadres)' });
const MAIL_VAN = defineString('MAIL_VAN', { default: 'Cluppie <paul@cluppie.io>', description: 'Afzender die ontvangers zien' });
const SMTP_WACHTWOORD = defineSecret('SMTP_WACHTWOORD');

const isMail = s => typeof s === 'string' && /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(s);
const schoon = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

/* PURE (getest): documentdata → { fout } of { bericht }. De afzender komt nooit uit het document. */
function maakBericht(data, van){
  if (!data || typeof data !== 'object') return { fout: 'Leeg document.' };
  const lijst = (Array.isArray(data.to) ? data.to : [data.to]).map(x => schoon(x, 200).toLowerCase()).filter(Boolean);
  const uniek = [...new Set(lijst)];
  if (!uniek.length) return { fout: 'Geen ontvanger.' };
  if (uniek.length > MAX_ONTVANGERS) return { fout: `Te veel ontvangers (max ${MAX_ONTVANGERS}).` };
  const fout = uniek.find(a => !isMail(a));
  if (fout) return { fout: `Ongeldig adres: ${fout}` };
  const m = data.message || {};
  const subject = schoon(m.subject, 200);                       // geen regeleinden: voorkomt header-injectie
  const text = String(m.text == null ? '' : m.text).slice(0, MAX_TEKST);
  if (!subject) return { fout: 'Geen onderwerp.' };
  if (!text.trim()) return { fout: 'Geen tekst.' };
  return { bericht: { from: van, to: uniek, subject, text } };
}

let transporter = null;
function getTransporter(){
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  const port = parseInt(SMTP_PORT.value(), 10) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST.value(), port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: SMTP_GEBRUIKER.value(), pass: SMTP_WACHTWOORD.value() },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
  });
  return transporter;
}

async function verwerk(snap, { transporterFn = getTransporter, van = () => MAIL_VAN.value() } = {}){
  if (!snap) return 'leeg';
  const ref = snap.ref, db = getFirestore();
  /* Eventarc kan een gebeurtenis dubbel bezorgen: één keer claimen, anders niets doen. */
  const claimed = await db.runTransaction(async tx => {
    const d = (await tx.get(ref)).data() || {};
    if (d.delivery && d.delivery.state) return false;
    tx.update(ref, { delivery: { state: 'PROCESSING', attempts: 1, startTime: FieldValue.serverTimestamp() } });
    return true;
  });
  if (!claimed) return 'overgeslagen';

  const { fout, bericht } = maakBericht(snap.data(), van());
  if (fout){
    console.warn('[mail] niet verstuurd:', fout);
    await ref.update({ delivery: { state: 'ERROR', attempts: 1, error: fout, endTime: FieldValue.serverTimestamp() } });
    return 'ongeldig';
  }
  try {
    const info = await transporterFn().sendMail(bericht);
    await ref.update({ delivery: { state: 'SUCCESS', attempts: 1, endTime: FieldValue.serverTimestamp(),
      info: { messageId: info.messageId || null, accepted: (info.accepted || []).length, rejected: (info.rejected || []).length } } });
    return 'verstuurd';
  } catch (e){
    console.error('[mail] versturen mislukt', e && e.message || e);
    await ref.update({ delivery: { state: 'ERROR', attempts: 1, error: schoon(e && e.message || e, 300), endTime: FieldValue.serverTimestamp() } });
    return 'mislukt';
  }
}

const verstuurMail = onDocumentCreated(
  { document: 'mail/{id}', region: REGIO, secrets: [SMTP_WACHTWOORD], retry: false, timeoutSeconds: 60, maxInstances: 5 },
  async (event) => { await verwerk(event.data); }
);

module.exports = { verstuurMail, maakBericht, verwerk };
