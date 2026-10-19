/* ==================== LEREN VAN GEBRUIK (fase 1h, besluiten 49–52) ====================
   De app telt anoniem wat trainers kiezen, wisselen en terugmelden, zodat de bibliotheek, de
   standaardwaarden en de coachkaarten door een mens verbeterd kunnen worden. Er leert niets zelf:
   dit levert tellingen op, geen beslissingen. Zie docs: claude/coachmodel-fase1h-lerend-model.md.

   Wat wél wordt vastgelegd (zie schoonSignaal): actie, leeftijdsgroep (4 banden), vorm-id, slot,
   thema, de drie antwoorden van de terugblik, snelkeuze materiaal, reden van een gat, en twee
   gepseudonimiseerde sleutels (team en club, HMAC met een geheim dat alleen de server kent) + de maand.
   Wat NIET: namen, spelers, teamnaam, vrije tekst, exacte tijden, exacte leeftijd of gebruikers-id.
   De pseudoniemen zijn er alleen om "minstens 5 teams van 3 clubs" te kunnen tellen.

   Twee schakelaars, allebei nodig (besluit 51):
     1. eindbaas, per club:  clubs/{id}.platformModules.leren === true   (standaard uit, tot de voorwaarden zijn aangepast
        en de privacytoets van besluit 52 is gedaan)
     2. de club zelf:        clubs/{id}.instellingen.leren.meedoen === true
   Zonder beide schrijft leerSignaal niets en meldt de client niets.

   Opslag: leersignalen/{auto} (alleen Admin SDK; rules: geen toegang), maandelijks samengevat naar
   leerstatistiek/{JJJJ-MM} (lezen: alleen platformbeheerder). Alleen cellen met ≥ DREMPEL.teams teams
   uit ≥ DREMPEL.clubs clubs komen in de samenvatting. Per team telt een cel maximaal MAX_PER_TEAM_PER_CEL
   keer mee, zodat één team de cijfers niet kan sturen. Ruwe signalen worden na BEWAAR_MAANDEN verwijderd.

   Aanroep:
     • leerSignaal (callable, lid van de club)         — de app stuurt een kleine batch na een actie
     • leerSamenvatting (schema, 2e van de maand)       — telt en schrijft leerstatistiek
     • leerSamenvattingNu (callable, platformbeheerder) — dezelfde telling op verzoek */

const crypto = require('crypto');

const REGIO = 'europe-west1';
const ACTIES = ['vorm_bewaard', 'vorm_gewisseld', 'terugblik', 'materiaal_gekozen', 'plan_gat'];
const SLOTS = ['warming-up', 'kern1', 'kern2', 'partij', 'afsluiting'];
const ANTWOORDEN = { natuurlijk: ['ja', 'ongeveer', 'nee'], energie: ['meer', 'gelijk', 'minder'], opnieuw: ['ja', 'aanpassen', 'nee'] };
const PRESETS = ['zuinig', 'normaal', 'ruim', 'eigen'];
const REDENEN = ['materiaal', 'ruimte'];
const BANDEN = [[6, 8, 'O6-O8'], [9, 11, 'O9-O11'], [12, 14, 'O12-O14'], [15, 19, 'O15+']];
const DREMPEL = { teams: 5, clubs: 3 };
const MAX_PER_TEAM_PER_CEL = 3;
const MAX_BATCH = 10;
const MAX_PER_TEAM_PER_DAG = 200;
const BEWAAR_MAANDEN = 13;
const VENSTER_MAANDEN = 12;

const VORM_ID = /^[a-z0-9][a-z0-9_-]{1,59}$/;
const THEMA = /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ,.'’()\/-]{1,59}$/;

function leeftijdsgroep(l){
  const n = Number(l);
  if (!Number.isInteger(n)) return null;
  const b = BANDEN.find(([van, tot]) => n >= van && n <= tot);
  return b ? b[2] : null;
}

/* Eén signaal van de client → schoon signaal, of null. Alles buiten de lijst valt weg; er komt nooit vrije tekst door. */
function schoonSignaal(x){
  if (!x || typeof x !== 'object' || !ACTIES.includes(x.actie)) return null;
  const groep = leeftijdsgroep(x.leeftijd);
  if (!groep) return null;
  const uit = { actie: x.actie, groep };
  if (x.actie === 'vorm_bewaard' || x.actie === 'vorm_gewisseld'){
    if (!VORM_ID.test(String(x.vormId || '')) || !SLOTS.includes(x.slot)) return null;
    uit.vormId = x.vormId; uit.slot = x.slot;
  } else if (x.actie === 'terugblik'){
    const ids = [...new Set((Array.isArray(x.vormIds) ? x.vormIds : []).map(String))].slice(0, 6);
    if (!ids.length || !ids.every(i => VORM_ID.test(i))) return null;
    const antwoord = {};
    for (const [k, toegestaan] of Object.entries(ANTWOORDEN)) if (x.antwoord && toegestaan.includes(x.antwoord[k])) antwoord[k] = x.antwoord[k];
    if (!Object.keys(antwoord).length) return null;
    uit.vormIds = ids; uit.antwoord = antwoord;
    if (x.thema !== undefined && x.thema !== null){ if (!THEMA.test(String(x.thema))) return null; uit.thema = String(x.thema); }
  } else if (x.actie === 'materiaal_gekozen'){
    if (!PRESETS.includes(x.preset)) return null;
    uit.preset = x.preset;
  } else if (x.actie === 'plan_gat'){
    if (!REDENEN.includes(x.reden)) return null;
    uit.reden = x.reden;
  }
  return uit;
}

/* Pseudoniem van een team- of club-id. Niet terug te rekenen zonder het geheim van de server. */
function pseud(zout, soort, id){
  return crypto.createHmac('sha256', String(zout)).update(`${soort}:${id}`).digest('hex').slice(0, 20);
}

const maandVan = ms => new Date(ms).toISOString().slice(0, 7);
function maandenTerug(ms, n){
  const d = new Date(ms); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 7);
}

function lerenToegestaan(club){
  return !!club && !!club.platformModules && club.platformModules.leren === true
    && !!club.instellingen && !!club.instellingen.leren && club.instellingen.leren.meedoen === true;
}

/* ---------- tellen ---------- */
/* Cel-sleutels van één rij: een rij kan in meer cellen vallen (een terugblik telt mee voor elke vorm). */
function celSleutels(r){
  if (r.actie === 'terugblik') return (r.vormIds || []).map(v => ['vorm', v]);
  if (r.actie === 'materiaal_gekozen') return [['preset', r.preset]];
  if (r.actie === 'plan_gat') return [['reden', r.reden]];
  return [['vorm', r.vormId]];
}

/* rijen: opgeslagen signalen met team en club (pseudoniemen). Geeft alleen cellen boven de drempel. */
function telSignalen(rijen, drempel = DREMPEL){
  const cellen = new Map();
  for (const r of rijen || []){
    for (const [soort, waarde] of celSleutels(r)){
      if (!waarde) continue;
      const sl = `${r.actie}|${r.groep}|${soort}|${waarde}`;
      let c = cellen.get(sl);
      if (!c) cellen.set(sl, c = { actie: r.actie, groep: r.groep, [soort]: waarde, teams: new Map() });
      let t = c.teams.get(r.team);
      if (!t) c.teams.set(r.team, t = { club: r.club, rijen: [] });
      if (t.rijen.length < MAX_PER_TEAM_PER_CEL) t.rijen.push(r);
    }
  }
  const uit = []; let weggelaten = 0;
  for (const c of cellen.values()){
    const clubs = new Set([...c.teams.values()].map(t => t.club));
    if (c.teams.size < drempel.teams || clubs.size < drempel.clubs){ weggelaten++; continue; }
    const { teams, ...cel } = c;
    cel.teams = c.teams.size; cel.clubs = clubs.size;
    cel.signalen = [...c.teams.values()].reduce((s, t) => s + t.rijen.length, 0);
    if (c.actie === 'terugblik'){
      cel.antwoorden = {};
      for (const [k, opties] of Object.entries(ANTWOORDEN)){
        const tel = Object.fromEntries(opties.map(o => [o, 0]));
        for (const t of c.teams.values()) for (const r of t.rijen) if (r.antwoord && tel[r.antwoord[k]] !== undefined) tel[r.antwoord[k]]++;
        cel.antwoorden[k] = tel;
      }
    }
    uit.push(cel);
  }
  uit.sort((a, b) => b.teams - a.teams || String(a.actie).localeCompare(b.actie) || String(a.vorm || a.preset || a.reden).localeCompare(String(b.vorm || b.preset || b.reden)));
  return { cellen: uit, weggelaten };
}

/* ---------- opslaan ---------- */
async function leesZout(db){
  const ref = db.doc('leren_geheim/zout');
  const s = await ref.get();
  if (s.exists && s.data().zout) return s.data().zout;
  const zout = crypto.randomBytes(32).toString('hex');
  await ref.set({ zout });
  return zout;
}

/* Verwerkt een batch. Geeft { opgeslagen, reden? }; gooit niet bij een club die niet meedoet (de client blijft stil). */
async function verwerkSignalen({ db, FieldValue, clubId, teamId, uid, rol, signalen, nu = Date.now() }){
  const club = (await db.doc(`clubs/${clubId}`).get()).data() || {};
  if (!lerenToegestaan(club)) return { opgeslagen: 0, reden: 'uit' };
  const team = (await db.doc(`teams/${teamId}`).get()).data();
  if (!team || team.club !== clubId) return { opgeslagen: 0, reden: 'team' };
  if (!(team.leden && team.leden[uid]) && !['club_admin', 'coordinator'].includes(rol)) return { opgeslagen: 0, reden: 'team' };
  const schoon = (Array.isArray(signalen) ? signalen : []).slice(0, MAX_BATCH).map(schoonSignaal).filter(Boolean);
  if (!schoon.length) return { opgeslagen: 0, reden: 'leeg' };
  const zout = await leesZout(db);
  const team_ = pseud(zout, 'team', teamId), club_ = pseud(zout, 'club', clubId);
  const dag = new Date(nu).toISOString().slice(0, 10);
  const tellerRef = db.doc(`leren_teller/${team_}_${dag}`);
  const al = (await tellerRef.get()).data()?.n || 0;
  if (al + schoon.length > MAX_PER_TEAM_PER_DAG) return { opgeslagen: 0, reden: 'limiet' };
  const maand = maandVan(nu);
  for (const s of schoon) await db.collection('leersignalen').add({ ...s, team: team_, club: club_, maand, gemaakt: FieldValue.serverTimestamp() });
  await tellerRef.set({ n: al + schoon.length, dag });
  return { opgeslagen: schoon.length };
}

/* Telt de ruwe signalen van de afgelopen 12 maanden, schrijft leerstatistiek/{maand}, ruimt oude signalen op. */
async function samenvatten({ db, FieldValue, nu = Date.now() }){
  const vanaf = maandenTerug(nu, VENSTER_MAANDEN - 1), tot = maandVan(nu);
  const snap = await db.collection('leersignalen').where('maand', '>=', vanaf).get();
  const rijen = snap.docs.map(d => d.data());
  const { cellen, weggelaten } = telSignalen(rijen);
  await db.doc(`leerstatistiek/${tot}`).set({
    periode: { van: vanaf, tot }, drempel: DREMPEL, maxPerTeamPerCel: MAX_PER_TEAM_PER_CEL,
    cellen, meta: { signalen: rijen.length, cellen: cellen.length, weggelatenOnderDrempel: weggelaten },
    gemaakt: FieldValue.serverTimestamp(),
  });
  const oud = await db.collection('leersignalen').where('maand', '<', maandenTerug(nu, BEWAAR_MAANDEN)).limit(400).get();
  for (const d of oud.docs) await d.ref.delete();
  return { signalen: rijen.length, cellen: cellen.length, opgeruimd: oud.docs.length };
}

/* ---------- Cloud Functions ---------- */
function maakFuncties({ onCall, onSchedule, HttpsError, getFirestore, FieldValue, vereisLid, isPlatformBeheerder }){
  const leerSignaal = onCall({ region: REGIO, timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
    const { clubId, rol } = await vereisLid(request);
    const teamId = String(request.data?.teamId || '').trim();
    if (!teamId) throw new HttpsError('invalid-argument', 'teamId ontbreekt.');
    try {
      return await verwerkSignalen({ db: getFirestore(), FieldValue, clubId, teamId, uid: request.auth.uid, rol, signalen: request.data?.signalen });
    } catch (e){
      if (e instanceof HttpsError) throw e;
      console.error('[leerSignaal]', e);
      throw new HttpsError('internal', 'Signaal niet opgeslagen.');
    }
  });
  const leerSamenvatting = onSchedule({ region: REGIO, schedule: '30 5 2 * *', timeZone: 'Europe/Amsterdam', timeoutSeconds: 300, memory: '512MiB' }, async () => {
    try { console.log('[leerSamenvatting]', await samenvatten({ db: getFirestore(), FieldValue })); }
    catch (e){ console.error('[leerSamenvatting]', e); }
  });
  const leerSamenvattingNu = onCall({ region: REGIO, timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
    if (!(await isPlatformBeheerder(request))) throw new HttpsError('permission-denied', 'Alleen voor de platformbeheerder.');
    return samenvatten({ db: getFirestore(), FieldValue });
  });
  return { leerSignaal, leerSamenvatting, leerSamenvattingNu };
}

module.exports = { ACTIES, SLOTS, ANTWOORDEN, PRESETS, REDENEN, BANDEN, DREMPEL, MAX_PER_TEAM_PER_CEL, MAX_BATCH, MAX_PER_TEAM_PER_DAG,
  leeftijdsgroep, schoonSignaal, pseud, lerenToegestaan, telSignalen, verwerkSignalen, samenvatten, maakFuncties };
