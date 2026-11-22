/* ==================== BEWAARTERMIJNEN: WAT ALLEEN DE SERVER KAN WISSEN [20261122a] ====================
   Het opruimscherm van de clubbeheerder (public/js/club-bewaartermijn.js) wist spelers en oude seizoenen
   zelf, onder de gewone rules. Drie soorten gegevens kan de app niet wissen, omdat de rules dat bewust
   niet toelaten. Die lopen hier mee, met dezelfde werkwijze: eerst tellen, pas wissen na een bevestiging,
   nooit vanzelf.

   1. Beoordelingen uit evaluatierondes (beoordelingenPrive): alleen de schrijver mag ze wissen.
      Weg gaat: wat bij een seizoen buiten de termijn van de club hoort ("oud"), en wat bij een speler
      hoort van wie het spelerdocument niet meer bestaat ("wees": de speler is al opgeruimd of verwijderd).
   2. De teamkamer (teamkamer/{teamId}/…): mededelingen en gesloten polls van vóór het lopende seizoen
      (met de stemmen), en de gezinsdocumenten van spelers die niet meer in het team staan of
      gearchiveerd zijn. Open polls en alles van dit seizoen blijven staan.
   3. Trainingshulp (hulpDeel/{id}/aanmeldingen): aanmeldingen van vóór het lopende seizoen. De lijst
      zelf blijft bij de trainer staan.

   De termijn voor oude seizoenen is die van de club (clubs/{id}.instellingen.privacy.bewaar, zie
   public/js/bewaartermijn-logica.js). Voor de teamkamer en trainingshulp is de grens vast: het begin
   van het lopende seizoen (1 juli). Een poll over wie er rijdt heeft daarna geen doel meer.

   Callable: bewaarOpruimen({ clubId, wis }) → { prive: { oud, wees }, kamer: { berichten, polls, gezinnen },
   hulp, totaal, gewist }. Alleen de clubbeheerder. Het wissen komt in het toegangslog van de club.
   De rekenregels zijn PURE en getest in tests/bewaartermijn-functie.test.js. */
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const REGIO = 'europe-west1';
const STANDAARD = { spelersJaren: 1, seizoenen: 3 };
const KEUZES_SEIZOENEN = [2, 3, 5, 0];

/* ---------- rekenregels (gelijk aan public/js/bewaartermijn-logica.js) ---------- */
function schoonBewaar(b){
  const x = b && typeof b === 'object' ? b : {}, sz = Number(x.seizoenen);
  return { seizoenen: KEUZES_SEIZOENEN.includes(sz) ? sz : STANDAARD.seizoenen };
}
function seizoenStart(label){
  const m = /^\s*(\d{4})/.exec(String(label || ''));
  return m ? Number(m[1]) : null;
}
/* startjaar van het seizoen waarin deze dag valt (1 juli is de grens) */
function seizoenVanDatum(nu){
  const d = new Date(nu);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}
/* het lopende seizoen: het label van de club, anders de kalender */
function huidigStart(club, nu){
  const s = seizoenStart(club && club.huidigSeizoen);
  return s === null ? seizoenVanDatum(nu) : s;
}
function seizoenVerlopen(label, huidig, bewaren){
  const s = seizoenStart(label);
  return s !== null && bewaren > 0 && s < huidig - (bewaren - 1);
}
/* 1 juli 00:00 Nederlandse tijd (zomertijd) van het startjaar, in milliseconden */
const seizoenBeginMs = start => Date.UTC(start, 5, 30, 22, 0, 0);

/* Eén privé-beoordeling: 'oud', 'wees' of '' (blijft). spelersPerTeam = Map teamId → Set van speler-id's. */
function priveReden(b, { huidig, bewaren, spelersPerTeam }){
  if (seizoenVerlopen(b && b.seizoen, huidig, bewaren)) return 'oud';
  const set = spelersPerTeam.get(b && b.teamId);
  if (!set || !b.spelerId || !set.has(b.spelerId)) return 'wees';
  return '';
}
/* Een poll gaat weg als hij dicht is en van vóór het lopende seizoen. Zonder datum blijft hij staan. */
function pollOud(p, grensMs){
  return !!p && p.status !== 'open' && Number(p.gemaaktMs) > 0 && Number(p.gemaaktMs) < grensMs;
}
const tijdOud = (d, grensMs) => !!d && Number(d.ms) > 0 && Number(d.ms) < grensMs;

/* ---------- lezen en wissen ---------- */
const zonderVelden = q => (typeof q.select === 'function' ? q.select() : q);
async function inDelen(db, refs){
  for (let i = 0; i < refs.length; i += 400){
    const b = db.batch();
    refs.slice(i, i + 400).forEach(r => b.delete(r));
    await b.commit();
  }
}

async function ruimOp(db, { clubId, club, wis = false, nu = Date.now(), uid = null }){
  const bewaren = schoonBewaar(club?.instellingen?.privacy?.bewaar).seizoenen;
  const huidig = huidigStart(club, nu), grensMs = seizoenBeginMs(huidig);
  const uit = { prive: { oud: 0, wees: 0 }, kamer: { berichten: 0, polls: 0, gezinnen: 0 }, hulp: 0, totaal: 0, gewist: false };
  const plat = [], diep = [];   /* plat: losse documenten; diep: documenten met iets eronder (stemmen, cijfers) */

  const teams = await db.collection('teams').where('club', '==', clubId).get();
  const spelersPerTeam = new Map();
  for (const t of teams.docs){
    const sp = await t.ref.collection('spelers').get();
    /* teamkamer: alleen wie nu in het team staat. Privé-beoordelingen: een gearchiveerde speler heeft
       nog een document en is dus geen wees; die volgt de termijn voor spelers in het opruimscherm. */
    const actief = new Set(sp.docs.filter(d => d.data().gearchiveerd !== true).map(d => d.id));
    spelersPerTeam.set(t.id, new Set(sp.docs.map(d => d.id)));

    const kRef = db.doc(`teamkamer/${t.id}`);
    const [berichten, polls, gezin] = await Promise.all([
      kRef.collection('berichten').where('ms', '<', grensMs).get(),
      kRef.collection('polls').get(),
      zonderVelden(kRef.collection('gezin')).get(),
    ]);
    for (const d of berichten.docs) if (tijdOud(d.data(), grensMs)){ uit.kamer.berichten++; plat.push(d.ref); }
    for (const d of polls.docs) if (pollOud(d.data(), grensMs)){ uit.kamer.polls++; diep.push(d.ref); }
    for (const d of gezin.docs) if (!actief.has(d.id)){ uit.kamer.gezinnen++; diep.push(d.ref); }
  }

  const prive = await db.collection('beoordelingenPrive').where('club', '==', clubId).get();
  for (const d of prive.docs){
    const reden = priveReden(d.data(), { huidig, bewaren, spelersPerTeam });
    if (reden){ uit.prive[reden]++; plat.push(d.ref); }
  }

  const lijsten = await db.collection('hulpDeel').where('club', '==', clubId).get();
  for (const l of lijsten.docs){
    const oud = await l.ref.collection('aanmeldingen').where('ms', '<', grensMs).get();
    for (const d of oud.docs) if (tijdOud(d.data(), grensMs)){ uit.hulp++; plat.push(d.ref); }
  }

  uit.totaal = plat.length + diep.length;
  if (wis && uit.totaal){
    await inDelen(db, plat);
    for (const r of diep) await db.recursiveDelete(r);
    uit.gewist = true;
    try {
      await db.collection('toegangslog').add({ clubId, gebeurtenis: 'bewaartermijn_opgeruimd', uid: null, naam: null, door: uid, doorNaam: club?.adminsInfo?.[uid]?.naam || null, teamId: null,
        details: `${uit.prive.oud + uit.prive.wees} beoordelingen uit evaluatierondes, ${uit.kamer.berichten + uit.kamer.polls + uit.kamer.gezinnen} uit de teamkamer, ${uit.hulp} aanmeldingen trainingshulp`,
        tijd: FieldValue.serverTimestamp() });
    } catch (e){ console.warn('[bewaarOpruimen] log mislukt', e.message || e); }
  }
  return uit;
}

const bewaarOpruimen = onCall({ region: REGIO, cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log eerst in.');
  const clubId = String(request.data?.clubId || '').trim();
  if (!clubId || clubId.includes('/')) throw new HttpsError('invalid-argument', 'clubId ontbreekt.');
  const db = getFirestore();
  const club = (await db.doc(`clubs/${clubId}`).get()).data();
  if (!club) throw new HttpsError('not-found', 'Club bestaat niet.');
  if (club.admins?.[request.auth.uid] !== true) throw new HttpsError('permission-denied', 'Alleen een clubbeheerder kan opruimen.');
  return ruimOp(db, { clubId, club, wis: request.data?.wis === true, uid: request.auth.uid });
});

module.exports = { bewaarOpruimen, ruimOp, schoonBewaar, seizoenStart, seizoenVanDatum, huidigStart, seizoenVerlopen, seizoenBeginMs, priveReden, pollOud, tijdOud };
