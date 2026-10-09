/* ====================================================================
   AVG-module — pseudonimisering voor AI, aansluiten via de server,
   inzage/export en verwijdering van het eigen account, bewaartermijnen.
   Alle onCall-functies draaien in europe-west1.
==================================================================== */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

const REGIO = 'europe-west1';
const BEWAAR_GEBRUIK_DAGEN = 400;   // logins/gebruik/navpaden: ~13 maanden
const BEWAAR_DEEL_DAGEN = 30;       // verlopen deel-links en toegangsbewijzen

/* ---------- 1. Pseudonimiseren voor AI ---------- */
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_TEL = /(?:\+31|0031|\b0)[\s-]?(?:\(0\)[\s-]?)?[1-9](?:[\s-]?\d){8}\b/g;
const RE_POSTCODE = /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/g;
const RE_LANGE_CIJFERREEKS = /\b\d{8,}\b/g;      // bsn, rekening-/relatienummers

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* tekst: string · namen: iterable met voor- en achternamen van spelers/coaches */
function scrubPII(tekst, namen = []){
  let t = String(tekst || '');
  t = t.replace(RE_EMAIL, '[e-mail]').replace(RE_TEL, '[telefoon]')
       .replace(RE_POSTCODE, '[postcode]').replace(RE_LANGE_CIJFERREEKS, '[nummer]');
  const lijst = [...new Set([...namen].map(n => String(n || '').trim()).filter(n => n.length >= 3))]
    .sort((a, b) => b.length - a.length).slice(0, 800);
  if (lijst.length){
    const re = new RegExp('(?<![\\p{L}])(' + lijst.map(esc).join('|') + ')(?![\\p{L}])', 'giu');
    t = t.replace(re, '[naam]');
  }
  return t;
}

/* Namen die uit AI-invoer moeten: spelers (voor- en achternaam) van de teams die de
   aanroeper mag zien + leden van de club. Eenvoudige cache (10 min) tegen extra reads. */
const _cache = new Map();
async function namenVoorScrub(clubId, uid, rol){
  const sleutel = `${clubId}|${uid}`;
  const hit = _cache.get(sleutel);
  if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.namen;
  const db = getFirestore();
  const namen = new Set();
  const clubSnap = await db.doc(`clubs/${clubId}`).get();
  const club = clubSnap.data() || {};
  for (const i of Object.values({ ...(club.ledenInfo || {}), ...(club.adminsInfo || {}) })) {
    String(i?.naam || '').split(/\s+/).forEach(d => namen.add(d));
    namen.add(i?.naam);
  }
  const teamsQ = (rol === 'club_admin' || rol === 'coordinator')
    ? db.collection('teams').where('club', '==', clubId).limit(60)
    : db.collection('teams').where('club', '==', clubId).where(`leden.${uid}`, '==', true).limit(20);
  const teams = await teamsQ.get();
  for (const t of teams.docs) {
    const sp = await t.ref.collection('spelers').get();
    sp.docs.forEach(d => {
      const p = d.data();
      [p.naam, p.achternaam, `${p.naam || ''} ${p.achternaam || ''}`].forEach(n => namen.add(n));
    });
  }
  _cache.set(sleutel, { t: Date.now(), namen: [...namen] });
  return [...namen];
}

/* ---------- 2. Aansluiten via de server (maakt teams/clubs onleesbaar voor niet-leden) ---------- */
const schoonNaam = (n) => String(n || 'Coach').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60) || 'Coach';

exports.codeBezet = onCall({ region: REGIO, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const db = getFirestore();
  const teamId = String(request.data?.teamId || '');
  const eigen = await db.doc(`teams/${teamId}`).get();
  if (!eigen.exists || !eigen.data().leden?.[request.auth.uid])
    throw new HttpsError('permission-denied', 'Alleen voor coaches van dit team.');
  const code = String(request.data?.teamCode || '').trim().toUpperCase().slice(0, 40);
  const snap = await db.collection('teams').where('code', '==', code).limit(2).get();
  return { bezet: snap.docs.some(d => d.id !== teamId) };
});

/* ---------- 3. Inzage (art. 15/20) en verwijdering (art. 17) van het eigen account ---------- */
async function perUid(db, col, uid, veld = 'uid'){
  const s = await db.collection(col).where(veld, '==', uid).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
const naarJson = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && x._seconds !== undefined) ? new Date(x._seconds * 1000).toISOString() : x));

exports.exporteerMijnGegevens = onCall({ region: REGIO, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const db = getFirestore(), uid = request.auth.uid;
  const gebruiker = await admin.auth().getUser(uid).catch(() => null);
  const profielSnap = await db.doc(`gebruikers/${uid}`).get();
  const teams = await db.collection('teams').where(`leden.${uid}`, '==', true).get();
  const clubsLid = await db.collection('clubs').where(`leden.${uid}`, '==', true).get();
  const clubsAdmin = await db.collection('clubs').where(`admins.${uid}`, '==', true).get();
  return naarJson({
    gemaaktOp: new Date().toISOString(),
    account: gebruiker && { uid, email: gebruiker.email || null, naam: gebruiker.displayName || null, aangemaakt: gebruiker.metadata?.creationTime },
    profiel: profielSnap.exists ? profielSnap.data() : null,
    teams: teams.docs.map(d => ({ id: d.id, naam: d.data().naam, club: d.data().club || null, jouwGegevens: d.data().ledenInfo?.[uid] || null })),
    clubs: [...new Map([...clubsLid.docs, ...clubsAdmin.docs].map(d => [d.id, d])).values()]
      .map(d => ({ id: d.id, naam: d.data().naam, rol: d.data().admins?.[uid] ? 'beheerder' : 'coach', jouwGegevens: d.data().ledenInfo?.[uid] || d.data().adminsInfo?.[uid] || null })),
    privacyKennisname: (await db.doc(`privacyKennisname/${uid}`).get()).data() || null,
    openAanvragen: await perUid(db, 'aanvragen', uid),
    logins: await perUid(db, 'logins', uid),
    gebruik: await perUid(db, 'gebruik', uid),
    navigatiepaden: await perUid(db, 'navpaden', uid),
    opmerking: 'Teksten die je zelf in teams/trainingen schreef (met je naam als auteur) zijn onderdeel van het teamarchief van de club; vraag de club om inzage/verwijdering daarvan.',
  });
});

async function verwijderQuery(q){
  let n = 0;
  for (let i = 0; i < 50; i++){
    const s = await q.limit(400).get();
    if (s.empty) break;
    const b = getFirestore().batch();
    s.docs.forEach(d => b.delete(d.ref));
    await b.commit(); n += s.size;
    if (s.size < 400) break;
  }
  return n;
}

exports.verwijderMijnAccount = onCall({ region: REGIO, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  if (request.data?.bevestig !== true) throw new HttpsError('invalid-argument', 'Bevestiging ontbreekt.');
  const db = getFirestore(), uid = request.auth.uid;

  /* Niet de enige beheerder van een club achterlaten. */
  const adminClubs = await db.collection('clubs').where(`admins.${uid}`, '==', true).get();
  const weesClubs = adminClubs.docs.filter(d => Object.keys(d.data().admins || {}).filter(a => a !== uid).length === 0);
  if (weesClubs.length)
    throw new HttpsError('failed-precondition',
      `Je bent de enige beheerder van ${weesClubs.map(d => d.data().naam).join(', ')}. Draag eerst het beheer over of verwijder de club.`);

  await require('./toegang').verwijderUidUitAlles(db, uid);

  await verwijderQuery(db.collection('logins').where('uid', '==', uid));
  await verwijderQuery(db.collection('gebruik').where('uid', '==', uid));
  await verwijderQuery(db.collection('navpaden').where('uid', '==', uid));
  await db.recursiveDelete(db.doc(`gebruikers/${uid}`));
  await db.doc(`trainingToegang/${uid}`).delete().catch(() => {});
  await db.doc(`privacyKennisname/${uid}`).delete().catch(() => {});
  await verwijderQuery(db.collection('aanvragen').where('uid', '==', uid));
  await admin.auth().deleteUser(uid);
  return { ok: true };
});

/* ---------- 4. Bewaartermijnen ---------- */
exports.bewaartermijnen = onSchedule(
  { region: REGIO, schedule: '30 3 * * *', timeZone: 'Europe/Amsterdam' },
  async () => {
    const db = getFirestore();
    const dag = 86400000;
    const grens = new Date(Date.now() - BEWAAR_GEBRUIK_DAGEN * dag).toISOString().slice(0, 10);
    const deelGrens = admin.firestore.Timestamp.fromMillis(Date.now() - BEWAAR_DEEL_DAGEN * dag);
    const uit = {
      logins: await verwijderQuery(db.collection('logins').where('datum', '<', grens)),
      gebruik: await verwijderQuery(db.collection('gebruik').where('datum', '<', grens)),
      navpaden: await verwijderQuery(db.collection('navpaden').where('datum', '<', grens)),
      trainingDeel: await verwijderQuery(db.collection('trainingDeel').where('vervaltOp', '<', deelGrens)),
      trainingToegang: await verwijderQuery(db.collection('trainingToegang').where('vervaltOp', '<', deelGrens)),
    };
    console.log('[bewaartermijnen] verwijderd:', JSON.stringify(uit));
  }
);

module.exports.schoonNaam = schoonNaam;
module.exports.verwijderQuery = verwijderQuery;
module.exports.scrubPII = scrubPII;
module.exports.namenVoorScrub = namenVoorScrub;
