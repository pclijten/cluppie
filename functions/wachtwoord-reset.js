/* Wachtwoord vergeten (20261020d). Vervangt de standaardmail van Firebase (Engels, afzender
   noreply@…firebaseapp.com, belandt in spam) door een opgemaakte Nederlandse mail via `mail/{id}` →
   verstuurMail (afzender paul@cluppie.io).

   Callable `wachtwoordReset({ email })` — ook zonder inloggen, want wie zijn wachtwoord kwijt is, is niet ingelogd.
   • Antwoordt ALTIJD { ok: true }, ook bij een onbekend adres: zo is niet te raden wie een account heeft.
   • Per adres max. 3 aanvragen per uur (`ratelimiet/reset_<hash>`, alleen functions); daarboven stil negeren.
   • De link komt van Firebase Admin (generatePasswordResetLink) en wijst naar de gewone Firebase-resetpagina, nu in het Nederlands. */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { maakMail } = require('./mail-sjabloon');

const REGIO = 'europe-west1';
const APP_URL = 'https://www.cluppie.io/';
const MAX_PER_UUR = 3;
const isMail = s => /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(s);

/* PURE (getest): Firebase-link in het Nederlands zetten (de resetpagina volgt de parameter `lang`). */
function nederlandseLink(link){
  const l = String(link || '');
  return /([?&])lang=[a-zA-Z-]*/.test(l) ? l.replace(/([?&])lang=[a-zA-Z-]*/, '$1lang=nl') : l + (l.includes('?') ? '&' : '?') + 'lang=nl';
}

/* PURE (getest): de mail zelf. */
function maakResetMail(link, naam){
  return maakMail({
    voorkop: 'Wachtwoord',
    titel: 'Kies een nieuw wachtwoord',
    alineas: [
      naam ? `Hoi ${naam},` : 'Hoi,',
      'Je vroeg om een nieuw wachtwoord voor Cluppie. Klik op de knop hieronder en kies een nieuw wachtwoord. Daarna kun je meteen weer inloggen.',
    ],
    knop: { tekst: 'Nieuw wachtwoord kiezen', url: link },
    slot: [
      'Werkt de knop niet? Kopieer dan deze link in je browser:\n' + link,
      'Heb je dit niet aangevraagd? Dan hoef je niets te doen: je wachtwoord blijft zoals het was.',
    ],
    voet: 'Deze link werkt één keer en maar een beperkte tijd.',
  });
}

/* Hele afhandeling, los van onCall zodat hij getest kan worden. Geeft een korte uitkomst terug (voor de logs, niet voor de app). */
async function verwerkReset(emailRuw, { db = getFirestore(), auth = admin.auth(), nu = new Date() } = {}){
  const email = String(emailRuw || '').trim().toLowerCase().slice(0, 200);
  if (!isMail(email)) return 'ongeldig';

  const sleutel = crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
  const limietRef = db.doc(`ratelimiet/reset_${sleutel}`), uur = nu.toISOString().slice(0, 13);
  const mag = await db.runTransaction(async tx => {
    const r = (await tx.get(limietRef)).data() || {};
    const n = r.uur === uur ? (r.aantal || 0) : 0;
    if (n >= MAX_PER_UUR) return false;
    tx.set(limietRef, { uur, aantal: n + 1 });
    return true;
  });
  if (!mag) return 'limiet';

  let link, gebruiker = null;
  try {
    gebruiker = await auth.getUserByEmail(email);
    link = await auth.generatePasswordResetLink(email, { url: APP_URL });
  } catch (e){
    if (e && e.code === 'auth/user-not-found') return 'onbekend';   // geen mail, maar de app merkt niets
    console.error('[wachtwoordReset] link maken mislukt', e && e.message || e);
    return 'mislukt';
  }
  const naam = gebruiker && gebruiker.displayName ? String(gebruiker.displayName).split(/\s+/)[0].slice(0, 40) : '';
  const m = maakResetMail(nederlandseLink(link), naam);
  await db.collection('mail').add({
    to: email, message: { subject: 'Kies een nieuw wachtwoord voor Cluppie', text: m.text, html: m.html },
    gemaakt: FieldValue.serverTimestamp(),
  });
  return 'verstuurd';
}

const wachtwoordReset = onCall({ region: REGIO, cors: true, timeoutSeconds: 30 }, async (request) => {
  const email = String(request.data && request.data.email || '').trim();
  if (!isMail(email.toLowerCase())) throw new HttpsError('invalid-argument', 'Vul een geldig e-mailadres in.');
  try { await verwerkReset(email); }
  catch (e){ console.error('[wachtwoordReset]', e && e.message || e); }
  return { ok: true };   // altijd hetzelfde antwoord
});

module.exports = { wachtwoordReset, verwerkReset, maakResetMail, nederlandseLink };
