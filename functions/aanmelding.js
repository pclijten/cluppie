/* ==================== CLUB AANMELDEN + MELDINGEN (20261011d) ====================
   Een club meldt zich zelf aan; de platformbeheerder keurt goed in het platformscherm.
   Bij goedkeuren wordt de club aangemaakt met de aanvrager als clubbeheerder. Die richt
   de club verder zelf in via de startlijst ("Aan de slag") op de club-hub.

     clubAanmeldingen/{uid}  { uid, clubNaam, plaats, district, contactNaam, contactEmail, rol,
                               aantalTeams, bericht, status: nieuw|goedgekeurd|afgewezen,
                               clubId?, reden?, gemaakt, beoordeeld?,
                               [20261012a] sportlinkClientId?, sportlinkClubcode?, logo?, kleur? }
   Met een Client ID (opgezocht via sportlinkClubInfo) krijgt de club bij goedkeuren meteen logo,
   kleur en Sportlink-koppeling, en staat de teamlijst klaar.
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
const { maakMail } = require('./mail-sjabloon');

const REGIO = 'europe-west1';
const PLATFORM_EMAIL = 'paul@cluppie.io';   // ontvanger van de aanmeldmelding (NIET de beheerdercontrole: die staat in platform.js)
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
/* inhoud: { text, html } uit maakMail() */
async function mail(db, aan, onderwerp, inhoud){
  if (!aan || (Array.isArray(aan) && !aan.length)) return;
  try { await db.collection('mail').add({ to: aan, message: { subject: onderwerp, text: inhoud.text, html: inhoud.html }, gemaakt: FieldValue.serverTimestamp() }); }
  catch (e){ console.warn('[mail] wegschrijven mislukt', e.message || e); }
}

/* PURE: controle van het aanmeldformulier (getest). Geeft { fout } of { data }. */
const LOGO_MAX = 160000;   // verkleind door verwerkLogo in de app (≈120 kB), met marge
function controleerAanmelding(d = {}){
  const data = {
    clubNaam: tekst(d.clubNaam, 60), plaats: tekst(d.plaats, 60), district: DISTRICTEN.includes(d.district) ? d.district : '',
    contactNaam: tekst(d.contactNaam, 80), contactEmail: tekst(d.contactEmail, 120).toLowerCase(), rol: tekst(d.rol, 60),
    aantalTeams: Math.max(0, Math.min(200, parseInt(d.aantalTeams, 10) || 0)), bericht: tekst(d.bericht, 1000),
    /* werkwijze trainingen: 'vrij' (trainers zelfstandig) of 'club' (club stuurt); onbekend = club */
    werkwijze: d.werkwijze === 'vrij' ? 'vrij' : 'club',
  };
  /* [20261012a] optioneel, uit Sportlink; ongeldige waarden vallen stil weg */
  const cid = tekst(d.sportlinkClientId, 40), code = tekst(d.sportlinkClubcode, 20).toUpperCase();
  if (/^[A-Za-z0-9]{6,40}$/.test(cid)) data.sportlinkClientId = cid;
  if (/^[A-Z0-9]{4,20}$/.test(code)) data.sportlinkClubcode = code;
  if (typeof d.logo === 'string' && d.logo.length <= LOGO_MAX && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(d.logo)) data.logo = d.logo;
  if (typeof d.kleur === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.kleur)) data.kleur = d.kleur.toLowerCase();
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
  if (data.sportlinkClubcode && !(await db.collection('clubs').where('sportlinkClubcode', '==', data.sportlinkClubcode).limit(1).get()).empty)
    throw new HttpsError('already-exists', 'Deze club staat al op Cluppie. Vraag je clubbeheerder om een uitnodiging.');
  await ref.set({ ...data, uid: a.uid, accountEmail: a.token.email || '', status: 'nieuw', gemaakt: FieldValue.serverTimestamp() });
  await mail(db, PLATFORM_EMAIL, `Cluppie: nieuwe club aangemeld — ${data.clubNaam}`, maakMail({
    voorkop: 'Nieuwe aanmelding',
    titel: `${data.clubNaam} wil met Cluppie starten`,
    alineas: [`${data.contactNaam}${data.rol ? ' (' + data.rol + ')' : ''} meldde ${data.clubNaam}${data.plaats ? ' uit ' + data.plaats : ''} aan.`],
    gegevens: [
      ['Club', data.clubNaam], ['Plaats', data.plaats], ['Contact', data.contactNaam], ['Rol', data.rol],
      ['E-mail', data.contactEmail], ['Aantal teams', data.aantalTeams || 'onbekend'],
      ['Sportlink', data.sportlinkClientId ? 'gevonden met Client ID' : ''], ['Bericht', data.bericht],
    ],
    knop: { tekst: 'Aanmelding bekijken', url: APP_URL },
    slot: ['Goedkeuren of afwijzen kan in het platformscherm.'],
  }));
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
    await mail(db, a.contactEmail, 'Je aanmelding bij Cluppie', maakMail({
      voorkop: 'Je aanmelding',
      titel: 'Bedankt voor je aanmelding',
      alineas: [
        `Hoi ${a.contactNaam},`,
        `Bedankt voor je aanmelding van ${a.clubNaam}. We kunnen de club op dit moment nog niet toelaten tot Cluppie.`,
        ...(a.reden ? [a.reden] : []),
      ],
      slot: ['Vragen? Antwoord gerust op deze mail.', 'Groet,\nCluppie'],
    }));
    return { ok: true };
  }

  const gebruiker = await admin.auth().getUser(a.uid).catch(() => null);
  if (!gebruiker) throw new HttpsError('failed-precondition', 'Het account van de aanvrager bestaat niet meer.');
  const naam = gebruiker.displayName || a.contactNaam || (gebruiker.email || '').split('@')[0] || 'Beheerder';
  if (a.sportlinkClubcode && !(await db.collection('clubs').where('sportlinkClubcode', '==', a.sportlinkClubcode).limit(1).get()).empty)
    throw new HttpsError('already-exists', 'Er bestaat al een club met deze Sportlink-clubcode. Wijs de aanmelding af of koppel de aanvrager aan die club.');
  const clubRef = db.collection('clubs').doc();
  await clubRef.set({
    naam: a.clubNaam, code: await vrijeClubCode(db),
    ...(a.sportlinkClientId ? { sportlinkClientId: a.sportlinkClientId } : {}),
    ...(a.sportlinkClubcode ? { sportlinkClubcode: a.sportlinkClubcode } : {}),
    admins: { [a.uid]: true }, adminsInfo: { [a.uid]: { naam } }, leden: { [a.uid]: true },
    teams: {}, huidigSeizoen: seizoenVoorDatum(),
    instellingen: {
      v: 1,
      identiteit: { afkorting: afkVoorstel(a.clubNaam), ...(a.logo ? { logo: a.logo } : {}), ...(a.kleur ? { kleur: a.kleur } : {}) },
      locatie: { plaats: a.plaats || '', lat: null, lon: null, district: a.district || 'zuid1' },
      ai: { aan: false },
      werkwijze: a.werkwijze === 'vrij' ? 'vrij' : 'club',
      toegang: { goedkeuring: true, standaardRol: 'coach', vasteCodes: false },
      privacy: { contactNaam: a.contactNaam || '', contactEmail: a.contactEmail || '', achternamen: false, verwerkersovereenkomst: null },
    },
    bron: 'aanmelding', gemaakt: FieldValue.serverTimestamp(),
  });
  await ref.update({ status: 'goedgekeurd', clubId: clubRef.id, beoordeeld: FieldValue.serverTimestamp() });
  if (a.sportlinkClientId && naGoedkeuring){
    try { await naGoedkeuring(clubRef.id); } catch (e){ console.warn('[aanmelding] teamlijst ophalen mislukt', e.message || e); }
  }
  await mail(db, a.contactEmail, `Welkom bij Cluppie, ${a.clubNaam}!`, maakMail({
    voorkop: 'Welkom',
    titel: `${a.clubNaam} staat klaar`,
    alineas: [
      `Hoi ${a.contactNaam},`,
      `Goed nieuws: ${a.clubNaam} staat klaar in Cluppie en jij bent clubbeheerder.`,
      'Log in met hetzelfde account waarmee je je aanmeldde. Op de clubpagina vind je "Aan de slag": zeven korte stappen om de club in te richten. Meestal ben je in een kwartier klaar.',
    ],
    /* zelfde zeven stappen als STAPPEN in public/js/startlijst.js */
    stappen: ['Logo en clubkleur', 'Sportlink koppelen', 'Teams aanmaken', 'Trainingsdagen invullen', 'Eerste coach uitnodigen', 'Privacycontact invullen', 'Verwerkersovereenkomst'],
    knop: { tekst: 'Naar Cluppie', url: APP_URL },
    slot: ['Loop je ergens op vast? Antwoord gerust op deze mail.', 'Veel plezier!\nCluppie'],
  }));
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
  await mail(db, mails, `Cluppie: ${a.naam || 'een coach'} wil aansluiten bij ${club.naam || 'jullie club'}`, maakMail({
    voorkop: 'Nieuwe aanvraag',
    titel: `${a.naam || 'Een coach'} wil aansluiten`,
    alineas: [`${a.naam || 'Een coach'} vroeg toegang${a.teamNaam ? ' tot ' + a.teamNaam : ''}${club.naam ? ' bij ' + club.naam : ''}.`],
    knop: { tekst: 'Aanvraag beoordelen', url: APP_URL },
    slot: ['Je vindt de aanvraag onder Club → Instellingen → Toegang & privacy.'],
    voet: 'Je krijgt hooguit één zo\'n mail per dag; nieuwe aanvragen van vandaag staan er ook.',
  }));
});

/* index.js geeft hier de Sportlink-teamlijstsync door (voorkomt een kringverwijzing) */
let naGoedkeuring = null;
const zetNaGoedkeuring = fn => { naGoedkeuring = fn; };

module.exports = { meldClubAan, beoordeelClubAanmelding, meldNieuweAanvraag, controleerAanmelding, afkVoorstel, zetNaGoedkeuring };
