/* ==================== CLUB VERWIJDEREN (eindbaas) ====================
   [20261127v] Platform › Clubs › club openen › Gevarenzone. Alleen de platformbeheerder.

   Werkt in twee stappen, net als tools/maak-leeg.mjs (waar de regels vandaan komen):
     1. droog: true   telt wat er weg zou gaan, verandert niets
     2. droog: false  verwijdert; alleen als bevestigNaam precies de clubnaam is

   Wat weggaat: clubs/{id} met alles eronder, de teams van de club (club == id) met alles eronder,
   in elke andere collectie de documenten die bij de club of zijn teams horen (veld club, clubId,
   team of teamId, of het document-id is dat van de club of een team), de bestanden onder clubs/{id}/
   in de bucket, en de regel van de club in platformstats/overzicht.
   Wat altijd blijft: accounts, gebruikers, platform, content, privacyKennisname.
   Een verhuisde club (veld verhuisd, zoals ASV'33) kan hier niet weg: dat is een echte club.
   Weg is weg: er is geen prullenbak.                                                              */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const BUCKET = 'cluppie-ad329-eu';
const NOOIT = ['platform', 'content', 'gebruikers', 'privacyKennisname', 'platformstats', 'clubs', 'teams'];
const VELDEN = ['club', 'clubId', 'team', 'teamId'];

/* ---------- puur (getest in tests/club-verwijderen.test.js) ---------- */
function hoortBij(id, data, ids){
  if (ids.has(id)) return true;
  for (const v of VELDEN){
    const w = data ? data[v] : null;
    if (typeof w === 'string' && w && ids.has(w)) return true;
  }
  return false;
}
const schoon = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
function naamKlopt(club, invoer){
  const n = schoon(club && club.naam);
  return !!n && n === schoon(invoer);
}
function magWeg(club){
  if (!club) return 'Deze club bestaat niet (meer).';
  if (club.verhuisd) return 'Dit is een verhuisde club met echte gebruikers; die kan hier niet verwijderd worden.';
  return '';
}

/* ---------- uitvoering ---------- */
async function verzamel(db, clubId){
  const teams = (await db.collection('teams').where('club', '==', clubId).select().get()).docs.map(d => d.id);
  const ids = new Set([clubId, ...teams]);
  const weg = [], tel = {};
  for (const col of await db.listCollections()){
    if (NOOIT.includes(col.id)) continue;
    let laatste = null;
    for (;;){
      let q = col.orderBy('__name__').limit(500); if (laatste) q = q.startAfter(laatste);
      const snap = await q.get(); if (snap.empty) break;
      for (const d of snap.docs) if (hoortBij(d.id, d.data(), ids)){ weg.push(d.ref); tel[col.id] = (tel[col.id] || 0) + 1; }
      laatste = snap.docs[snap.docs.length - 1]; if (snap.size < 500) break;
    }
  }
  return { teams, weg, tel };
}
async function bestandenVan(clubId){
  try {
    const { getStorage } = require('firebase-admin/storage');
    const [f] = await getStorage().bucket(BUCKET).getFiles({ prefix: `clubs/${clubId}/` });
    return f;
  } catch (e){ console.warn('[verwijderClubPlatform] bestanden', e.message || e); return null; }
}

function maak({ isPlatformBeheerder }){
  return onCall({ region: REGIO, timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
    if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
    const clubId = String(request.data?.clubId || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(clubId)) throw new HttpsError('invalid-argument', 'Geen geldige club.');
    const db = getFirestore();
    const ref = db.doc(`clubs/${clubId}`), snap = await ref.get();
    const club = snap.exists ? snap.data() : null;
    const nee = magWeg(club);

    /* een club die al weg is maar nog in het overzicht staat: alleen die regel opruimen */
    if (!club && request.data?.droog === false){ await haalUitOverzicht(db, clubId); return { klaar: true, alleenOverzicht: true }; }
    if (nee) throw new HttpsError('failed-precondition', nee);

    const { teams, weg, tel } = await verzamel(db, clubId);
    const bestanden = await bestandenVan(clubId);
    const telling = { naam: club.naam || '', teams: teams.length, documenten: tel, losseDocumenten: weg.length, bestanden: bestanden ? bestanden.length : null };
    if (request.data?.droog !== false) return { droog: true, ...telling };

    if (!naamKlopt(club, request.data?.bevestigNaam)) throw new HttpsError('failed-precondition', 'De naam klopt niet; er is niets verwijderd.');
    console.log('[verwijderClubPlatform] start', clubId, club.naam, 'door', request.auth?.uid, JSON.stringify(telling));
    for (const id of teams) await db.recursiveDelete(db.doc(`teams/${id}`));
    for (const r of weg) await db.recursiveDelete(r);
    await db.recursiveDelete(ref);
    let bestandenWeg = 0;
    for (const f of bestanden || []){ try { await f.delete({ ignoreNotFound: true }); bestandenWeg++; } catch (e){ console.warn('[verwijderClubPlatform] bestand', f.name, e.message); } }
    await haalUitOverzicht(db, clubId);
    console.log('[verwijderClubPlatform] klaar', clubId);
    return { klaar: true, ...telling, bestanden: bestandenWeg };
  });
}
async function haalUitOverzicht(db, clubId){
  try {
    const st = db.doc('platformstats/overzicht'), o = (await st.get()).data();
    if (o && Array.isArray(o.clubs) && o.clubs.some(k => k.id === clubId)) await st.update({ clubs: o.clubs.filter(k => k.id !== clubId) });
  } catch (e){ console.warn('[verwijderClubPlatform] overzicht', e.message || e); }
}

module.exports = { maak, hoortBij, naamKlopt, magWeg, NOOIT };
