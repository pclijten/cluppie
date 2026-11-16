/* E-mailadres bevestigen (20261020e). Vervangt de standaardmail van Firebase (Engels, afzender
   noreply@…firebaseapp.com) door een opgemaakte Nederlandse mail via `mail/{id}` → verstuurMail.

   Callable `verificatieMail()` — alleen voor ingelogde gebruikers (met e-mailadres), voor hun eigen adres.
   • Al bevestigd → niets versturen ({ ok: true, alBevestigd: true }).
   • Per account max. 3 aanvragen per uur (`ratelimiet/ver_<uid>`, alleen functions).
   • De link komt van Firebase Admin (generateEmailVerificationLink) en gaat naar de gewone Firebase-pagina, nu met lang=nl. */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { maakMail } = require('./mail-sjabloon');
const { nederlandseLink } = require('./wachtwoord-reset');

const REGIO = 'europe-west1';
const APP_URL = 'https://www.cluppie.io/';
const KAMER_URL = 'https://www.cluppie.io/kamer.html';
const MAX_PER_UUR = 3;
/* [20261116p] Waar komt iemand uit na het bevestigen? Een ouder die zich via de teamlink aanmeldt moet terug naar
   de teamkamer (met de code van de teamlink, zodat het ook werkt als de mail in een andere browser opent),
   niet naar de trainersapp. PURE (getest). */
function terugUrl(naar, code){
  if (naar !== 'kamer') return APP_URL;
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return KAMER_URL + (c ? '?k=' + c : '');
}
const isMail = s => /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(s);

/* PURE (getest) */
function maakVerificatieMail(link, naam){
  return maakMail({
    voorkop: 'Bevestigen',
    titel: 'Bevestig je e-mailadres',
    alineas: [
      naam ? `Hoi ${naam},` : 'Hoi,',
      'Welkom bij Cluppie! Bevestig je e-mailadres met de knop hieronder. Dat is nodig om je aan te sluiten bij een team of club.',
    ],
    knop: { tekst: 'E-mailadres bevestigen', url: link },
    slot: [
      'Werkt de knop niet? Kopieer dan deze link in je browser:\n' + link,
      'Heb je je niet aangemeld bij Cluppie? Dan kun je deze mail negeren.',
    ],
    voet: 'Deze link werkt één keer.',
  });
}

/* Hele afhandeling, los van onCall zodat hij getest kan worden. */
async function verwerkVerificatie({ uid, email, naam, bevestigd, naar, code }, { db = getFirestore(), auth = admin.auth(), nu = new Date() } = {}){
  const adres = String(email || '').trim().toLowerCase();
  if (!uid || !isMail(adres)) return 'geen-adres';
  if (bevestigd) return 'al-bevestigd';

  const limietRef = db.doc(`ratelimiet/ver_${uid}`), uur = nu.toISOString().slice(0, 13);
  const mag = await db.runTransaction(async tx => {
    const r = (await tx.get(limietRef)).data() || {};
    const n = r.uur === uur ? (r.aantal || 0) : 0;
    if (n >= MAX_PER_UUR) return false;
    tx.set(limietRef, { uur, aantal: n + 1 });
    return true;
  });
  if (!mag) return 'limiet';

  const link = await auth.generateEmailVerificationLink(adres, { url: terugUrl(naar, code) });
  const voornaam = naam ? String(naam).split(/\s+/)[0].slice(0, 40) : '';
  const m = maakVerificatieMail(nederlandseLink(link), voornaam);
  await db.collection('mail').add({
    to: adres, message: { subject: 'Bevestig je e-mailadres voor Cluppie', text: m.text, html: m.html },
    gemaakt: FieldValue.serverTimestamp(),
  });
  return 'verstuurd';
}

const verificatieMail = onCall({ region: REGIO, cors: true, timeoutSeconds: 30 }, async (request) => {
  const a = request.auth;
  if (!a || a.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Log eerst in met je eigen account.');
  let uitkomst;
  try {
    uitkomst = await verwerkVerificatie({ uid: a.uid, email: a.token.email, naam: a.token.name, bevestigd: a.token.email_verified === true,
      naar: request.data?.naar, code: request.data?.code });
  } catch (e){
    console.error('[verificatieMail]', e && e.message || e);
    throw new HttpsError('internal', 'Versturen mislukt, probeer het zo opnieuw.');
  }
  if (uitkomst === 'limiet') throw new HttpsError('resource-exhausted', 'Je hebt al een paar keer een mail gevraagd. Probeer het over een uur opnieuw.');
  if (uitkomst === 'geen-adres') throw new HttpsError('failed-precondition', 'Aan dit account hangt geen e-mailadres.');
  return { ok: true, alBevestigd: uitkomst === 'al-bevestigd' };
});

module.exports = { verificatieMail, verwerkVerificatie, maakVerificatieMail, terugUrl };
