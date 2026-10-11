/* ==================== CLUB AANMELDEN + MELDINGEN (20261011d) ====================
   Een club meldt zich zelf aan; de platformbeheerder keurt goed in het platformscherm.
   Bij goedkeuren wordt de club aangemaakt met de aanvrager als clubbeheerder. Die richt
   de club verder zelf in via de startlijst ("Aan de slag") op de club-hub.

     clubAanmeldingen/{uid}  { uid, clubNaam, plaats, district, contactNaam, contactEmail, rol,
                               aantalTeams, bericht, status: nieuw|goedgekeurd|afgewezen,
                               clubId?, reden?, gemaakt, beoordeeld? }
   Eén aanmelding per account (document-id = uid).

   E-mail gaat via de Firebase-extensie "Trigger Email" (collectie `mail`). Zonder die extensie
   blijven de documenten staan en gebeurt er verder niets; het platformscherm toont alles toch.
     • meldClubAan               (callable, ingelogd)              → mail aan platformbeheerder
     • beoordeelClubAanmelding   (callable, platformbeheerder)     → club aanmaken / afwijzen, mail aan aanvrager
     • meldNieuweAanvraag        (trigger op aanvragen/{id})        → mail aan clubbeheerders, max 1 per club per dag */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { isPlatformBeheerder } = require('./platform');

const REGIO = 'europe-west1';
const PLATFORM_EMAIL = 'pclijten@gmail.com';
const APP_URL = 'https://www.cluppie.io/';
const DISTRICTEN = ['noord', 'oost', 'west1', 'west2', 'zuid1', 'zuid2'];

const tekst = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const isMail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

function seizoenVoorDatum(d = new Date()){
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/'${String(y + 1).slice(-2)}`;
}
/* kopie van afkVoorstel() in public/js/club-instellingen.js */
function afkVoorstel(naam){
  const woorden = String(naam || '').replace(/['’.]/g, ' ').split(/[\s-]+/).filter(Boolean);
  if (!woorden.length) return '';
  const eerste = woorden[0].replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
  if (eerste.length >= 2 && eerste === eerste.toUpperCase() && /[A-Z]/.test(eerste)) return eerste.slice(0, 6);
  return woorden.map(w => w[0]).join('').toUpperCase().slice(0, 6);
}
async function vrijeClubCode(db){
  const t = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 20; i++){
    const code = Array.from({ length: 6 }, () => t[Math.floor(Math.random() * t.length)]).join('');
    if ((await db.collection('clubs').where('code', '==', code).limit(1).get()).empty) return code;
  }
  throw new HttpsError('internal', 'Geen vrije clubcode gevonden.');
}
async function mail(db, aan, onderwerp, inhoud){
  if (!aan || (Array.isArray(aan) && !aan.length)) return;
  try { await db.collection('mail').add({ to: aan, message: { subject: onderwerp, text: inhoud }, gemaakt: FieldValue.serverTimestamp() }); }
  catch (e){ console.warn('[mail] wegschrijven mislukt', e.message || e); }
}

/* PURE: controle van het aanmeldformulier (getest). Geeft { fout } of { data }. */
function controleerAanmelding(d = {}){
  const data = {
    clubNaam: tekst(d.clubNaam, 60), plaats: tekst(d.plaats, 60), district: DISTRICTEN.includes(d.district) ? d.district : '',
    contactNaam: tekst(d.contactNaam, 80), contactEmail: tekst(d.contactEmail, 120).toLowerCase(), rol: tekst(d.rol, 60),
    aantalTeams: Math.max(0, Math.min(200, parseInt(d.aantalTeams, 10) || 0)), bericht: tekst(d.bericht, 1000),
  };
  if (data.clubNaam.length < 2) return { fout: 'Vul de naam van de club in.' };
  if (!data.contactNaam) return { fout: 'Vul je naam in.' };
  if (!isMail(data.contactEmail)) return { fout: 'Vul een geldig e-mailadres in.' };
  if (d.akkoord !== true) return { fout: 'Ga akkoord met de voorwaarden om je aan te melden.' };
  return { data };
}

const meldClubAan = onCall({ region: REGIO, cors: true }, async (request) => {
  const a = request.auth;
  if (!a || a.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Log eerst in met je eigen account.');
  const { fout, data } = controleerAanmelding(request.data || {});
  if (fout) throw new HttpsError('invalid-argument', fout);
  const db = getFirestore(), ref = db.doc(`clubAanmeldingen/${a.uid}`);
  const bestaand = (await ref.get()).data();
  if (bestaand && bestaand.status === 'nieuw') throw new HttpsError('already-exists', 'Je aanmelding is al binnen en wordt bekeken.');
  await ref.set({ ...data, uid: a.uid, accountEmail: a.token.email || '', status: 'nieuw', gemaakt: FieldValue.serverTimestamp() });
  await mail(db, PLATFORM_EMAIL, `Cluppie: nieuwe club aangemeld — ${data.clubNaam}`,
    `${data.contactNaam}${data.rol ? ' (' + data.rol + ')' : ''} meldde ${data.clubNaam}${data.plaats ? ' uit ' + data.plaats : ''} aan voor Cluppie.\n` +
    `E-mail: ${data.contactEmail}\nTeams: ${data.aantalTeams || 'onbekend'}\n${data.bericht ? '\n' + data.bericht + '\n' : ''}\nGoedkeuren: ${APP_URL} → Platform.`);
  return { ok: true };
});

const beoordeelClubAanmelding = onCall({ region: REGIO, cors: true }, async (request) => {
  if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
  const id = tekst(request.data?.id, 128), besluit = request.data?.besluit;
  if (!id || !['goedkeuren', 'afwijzen'].includes(besluit)) throw new HttpsError('invalid-argument', 'Onbekend besluit.');
  const db = getFirestore(), ref = db.doc(`clubAanmeldingen/${id}`);
  const a = (await ref.get()).data();
  if (!a) throw new HttpsError('not-found', 'Aanmelding bestaat niet.');
  if (a.status !== 'nieuw') throw new HttpsError('failed-precondition', 'Deze aanmelding is al beoordeeld.');

  if (besluit === 'afwijzen'){
    await ref.update({ status: 'afgewezen', reden: tekst(request.data?.reden, 300), beoordeeld: FieldValue.serverTimestamp() });
    await mail(db, a.contactEmail, 'Je aanmelding bij Cluppie',
      `Hoi ${a.contactNaam},\n\nBedankt voor je aanmelding van ${a.clubNaam}. We kunnen de club op dit moment nog niet toelaten tot Cluppie.${a.reden ? '\n\n' + a.reden : ''}\n\nVragen? Antwoord gerust op deze mail.\n\nGroet, Cluppie`);
    return { ok: true };
  }

  const gebruiker = await admin.auth().getUser(a.uid).catch(() => null);
  if (!gebruiker) throw new HttpsError('failed-precondition', 'Het account van de aanvrager bestaat niet meer.');
  const naam = gebruiker.displayName || a.contactNaam || (gebruiker.email || '').split('@')[0] || 'Beheerder';
  const clubRef = db.collection('clubs').doc();
  await clubRef.set({
    naam: a.clubNaam, code: await vrijeClubCode(db),
    admins: { [a.uid]: true }, adminsInfo: { [a.uid]: { naam } }, leden: { [a.uid]: true },
    teams: {}, huidigSeizoen: seizoenVoorDatum(),
    instellingen: {
      v: 1,
      identiteit: { afkorting: afkVoorstel(a.clubNaam) },
      locatie: { plaats: a.plaats || '', lat: null, lon: null, district: a.district || 'zuid1' },
      ai: { aan: false },
      toegang: { goedkeuring: true, standaardRol: 'coach', vasteCodes: false },
      privacy: { contactNaam: a.contactNaam || '', contactEmail: a.contactEmail || '', achternamen: false, verwerkersovereenkomst: null },
    },
    bron: 'aanmelding', gemaakt: FieldValue.serverTimestamp(),
  });
  await ref.update({ status: 'goedgekeurd', clubId: clubRef.id, beoordeeld: FieldValue.serverTimestamp() });
  await mail(db, a.contactEmail, `Welkom bij Cluppie, ${a.clubNaam}!`,
    `Hoi ${a.contactNaam},\n\n${a.clubNaam} staat klaar in Cluppie en jij bent clubbeheerder.\n\n` +
    `Log in op ${APP_URL} met hetzelfde account waarmee je je aanmeldde. Op de clubpagina staat "Aan de slag": ` +
    `zeven korte stappen (logo, Sportlink, teams, coaches uitnodigen, privacy). Meestal ben je in een kwartier klaar.\n\nVeel plezier!\nCluppie`);
  return { ok: true, clubId: clubRef.id };
});

/* Nieuwe coach-aanvraag → mail aan de clubbeheerders, hooguit één per club per dag. */
const meldNieuweAanvraag = onDocumentCreated({ document: 'aanvragen/{id}', region: REGIO }, async (event) => {
  const a = event.data && event.data.data();
  if (!a || !a.clubId) return;
  const db = getFirestore(), dag = new Date().toISOString().slice(0, 10);
  const statusRef = db.doc(`clubs/${a.clubId}/geheim/_meldingen`);
  const doorgaan = await db.runTransaction(async tx => {
    const s = (await tx.get(statusRef)).data() || {};
    if (s.aanvraagDag === dag) return false;
    tx.set(statusRef, { aanvraagDag: dag }, { merge: true });
    return true;
  });
  if (!doorgaan) return;
  const club = (await db.doc(`clubs/${a.clubId}`).get()).data() || {};
  const uids = Object.keys(club.admins || {});
  const mails = [];
  for (const u of uids){ const g = await admin.auth().getUser(u).catch(() => null); if (g && g.email) mails.push(g.email); }
  await mail(db, mails, `Cluppie: ${a.naam || 'een coach'} wil aansluiten bij ${club.naam || 'jullie club'}`,
    `${a.naam || 'Een coach'} vroeg toegang${a.teamNaam ? ' tot ' + a.teamNaam : ''}.\n\nGoedkeuren: ${APP_URL} → Club → Instellingen → Toegang & privacy.\n\n` +
    `Je krijgt hooguit één zo'n mail per dag; nieuwe aanvragen van vandaag staan daar ook.`);
});

module.exports = { meldClubAan, beoordeelClubAanmelding, meldNieuweAanvraag, controleerAanmelding, afkVoorstel };
