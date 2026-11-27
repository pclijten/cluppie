// Proefclubs en proefteams uit een Firebase-project halen (cluppie.io: cluppie-ad329).
// Gemaakt voor de verhuizing van ASV'33 (27-11-2026): eerst de proefclubs weg, dan ASV'33 erin.
//
//   node tools/maak-leeg.mjs overzicht                      leest alleen: welke clubs en teams er staan
//   node tools/maak-leeg.mjs wis --droog [--behoud=id,id]   laat zien wat er weg zou gaan, schrijft niets
//   node tools/maak-leeg.mjs wis --echt  [--behoud=id,id]   verwijdert; vraagt eerst om WIS te typen
//
// --behoud=<id's>: clubs of teams (document-id's, komma ertussen) die blijven staan; van een club die blijft,
//   blijven ook alle teams en gegevens.
// --project=<id> (standaard cluppie-ad329), --bucket=<naam> (standaard cluppie-ad329-eu bij dat project).
//
// Wat weggaat: de clubs en teams (met alles eronder), en in elke andere collectie de documenten die bij zo'n
// club of team horen (veld club, clubId, team of teamId, of het document-id is dat van de club of het team),
// plus de bestanden onder clubs/{clubId}/ in de bucket.
// Wat altijd blijft: accounts en gebruikers, platform (instellingen, beheerders), content (de gedeelde
// Cluppie-oefenstof), privacyKennisname, en elk document dat niet bij een club of team hoort.
// Weg is weg: er is geen prullenbak. Daarom eerst 'overzicht' en 'wis --droog'.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';

/* ---------- PUUR (getest in tests/maak-leeg.test.mjs) ---------- */
export const NOOIT = ['platform', 'content', 'gebruikers', 'privacyKennisname'];
const VELDEN = ['club', 'clubId', 'team', 'teamId'];

/* Welke clubs en teams gaan weg. clubs = [{id}], teams = [{id, club}], behoud = id's die blijven.
   Een team gaat weg als het zelf niet behouden is en zijn club niet blijft (ook teams zonder club). */
export function kiesDoelen(clubs, teams, behoud = []){
  const blijf = new Set(behoud);
  const clubsWeg = new Set(clubs.filter(c => !blijf.has(c.id)).map(c => c.id));
  const clubsBlijven = new Set(clubs.filter(c => blijf.has(c.id)).map(c => c.id));
  const teamsWeg = new Set(teams.filter(t => !blijf.has(t.id) && !clubsBlijven.has(t.club || '')).map(t => t.id));
  return { clubsWeg, teamsWeg };
}
/* Hoort dit document (buiten clubs en teams) bij iets dat weggaat? */
export function hoortBij(id, data, { clubsWeg, teamsWeg }){
  if (clubsWeg.has(id) || teamsWeg.has(id)) return true;
  for (const v of VELDEN){
    const w = data ? data[v] : null;
    if (typeof w === 'string' && w && (clubsWeg.has(w) || teamsWeg.has(w))) return true;
  }
  return false;
}

/* ---------- uitvoering ---------- */
const HIER = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await hoofd();

async function hoofd(){
  const require = createRequire(path.join(HIER, '..', 'functions', 'package.json'));
  const admin = require('firebase-admin');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getStorage } = require('firebase-admin/storage');
  const arg = process.argv.slice(2), OPDRACHT = arg[0] || '';
  const optie = n => (arg.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '');
  const vlag = n => arg.includes(`--${n}`);
  const stop = (t) => { console.error('\n' + t); process.exit(1); };
  const PROJECT = optie('project') || 'cluppie-ad329';
  const BUCKET = optie('bucket') || (PROJECT === 'cluppie-ad329' ? 'cluppie-ad329-eu' : '');
  const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
  const DROOG = !vlag('echt');
  if (!['overzicht', 'wis'].includes(OPDRACHT)) stop('Gebruik: node tools/maak-leeg.mjs overzicht | wis --droog | wis --echt [--behoud=id,id]');
  if (PROJECT === 'cluppieasv33') stop('Dit is de oude omgeving van ASV\'33. Daar wordt niets gewist.');
  if (OPDRACHT === 'wis' && !vlag('echt') && !vlag('droog')) stop('Kies: wis --droog (alleen laten zien) of wis --echt (verwijderen).');
  const behoud = optie('behoud').split(',').map(s => s.trim()).filter(Boolean);

  const app = admin.initializeApp({ projectId: PROJECT, ...(EMULATOR ? {} : { credential: admin.credential.applicationDefault() }) });
  const db = getFirestore(app);
  const regel = (a, b) => console.log(`  ${String(a).padEnd(46)} ${b}`);
  console.log(`Proefclubs opruimen · ${OPDRACHT}${OPDRACHT === 'wis' && DROOG ? ' (droog: er wordt niets geschreven)' : ''} · ${PROJECT}\n`);

  const clubs = (await db.collection('clubs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const teams = (await db.collection('teams').get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const clubIds = new Set(clubs.map(c => c.id));
  const onbekend = behoud.filter(b => !clubIds.has(b) && !teams.some(t => t.id === b));
  if (onbekend.length) stop(`--behoud noemt id's die geen club of team zijn: ${onbekend.join(', ')}. Er is niets gewijzigd.`);
  const doelen = kiesDoelen(clubs, teams, behoud);
  const n = o => Object.values(o || {}).filter(v => v === true).length;

  console.log('Clubs');
  for (const c of clubs.sort((a, b) => String(a.naam).localeCompare(String(b.naam)))){
    const eigen = teams.filter(t => t.club === c.id);
    regel(`${c.naam || '(geen naam)'} (${c.id})`, `${eigen.length} teams, ${n(c.leden)} leden, ${n(c.admins)} beheerders${c.verhuisd ? ', VERHUISD' : ''}  ${doelen.clubsWeg.has(c.id) ? '→ weg' : '→ blijft'}`);
  }
  const los = teams.filter(t => !t.club || !clubIds.has(t.club));
  console.log(`\nTeams zonder club (${los.length})`);
  for (const t of los) regel(`${t.naam || '(geen naam)'} (${t.id})`, `${n(t.leden)} leden  ${doelen.teamsWeg.has(t.id) ? '→ weg' : '→ blijft'}`);
  if (OPDRACHT === 'overzicht'){
    console.log(`\nEr is niets gewijzigd. Verder: node tools/maak-leeg.mjs wis --droog${behoud.length ? ' --behoud=' + behoud.join(',') : ' [--behoud=id,id]'}`);
    return;
  }
  if (clubs.some(c => c.verhuisd && doelen.clubsWeg.has(c.id)))
    stop('Er staat een verhuisde club (ASV\'33) op de lijst om te wissen. Dat doet dit script niet: zet zijn id bij --behoud. Er is niets gewijzigd.');

  /* alle andere collecties langs: wat hoort bij een club of team dat weggaat */
  const weg = [], tel = {}, blijft = {};
  for (const col of await db.listCollections()){
    if (col.id === 'clubs' || col.id === 'teams' || NOOIT.includes(col.id)) continue;
    let laatste = null;
    for (;;){
      let q = col.orderBy('__name__').limit(500); if (laatste) q = q.startAfter(laatste);
      const snap = await q.get(); if (snap.empty) break;
      for (const d of snap.docs){
        if (hoortBij(d.id, d.data(), doelen)){ weg.push(d.ref); tel[col.id] = (tel[col.id] || 0) + 1; }
        else blijft[col.id] = (blijft[col.id] || 0) + 1;
      }
      laatste = snap.docs[snap.docs.length - 1]; if (snap.size < 500) break;
    }
  }
  console.log('\nGaat weg');
  regel('clubs (met alles eronder)', doelen.clubsWeg.size);
  regel('teams (met alles eronder)', doelen.teamsWeg.size);
  for (const k of Object.keys(tel).sort()) regel(k, `${tel[k]}${blijft[k] ? `  (${blijft[k]} blijven)` : ''}`);
  console.log('\nBlijft helemaal staan');
  regel(NOOIT.join(', ') + ', accounts', 'niet aangeraakt');
  for (const k of Object.keys(blijft).filter(k => !tel[k]).sort()) regel(k, blijft[k]);

  let bestanden = [];
  if (BUCKET && !EMULATOR){
    const b = getStorage(app).bucket(BUCKET);
    for (const id of doelen.clubsWeg){ const [f] = await b.getFiles({ prefix: `clubs/${id}/` }); bestanden = bestanden.concat(f); }
    regel(`\n  bestanden in ${BUCKET}`, `${bestanden.length} gaan weg`);
  }
  if (DROOG){ console.log('\nDroog: er is niets gewijzigd. Echt verwijderen: dezelfde opdracht met --echt in plaats van --droog.'); return; }

  if (!EMULATOR){
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const a = await new Promise(ok => rl.question(`\nDit verwijdert ${doelen.clubsWeg.size} clubs en ${doelen.teamsWeg.size} teams uit ${PROJECT}. Weg is weg.\nTyp WIS om door te gaan: `, ok));
    rl.close();
    if (a.trim() !== 'WIS') stop('Gestopt, er is niets gewijzigd.');
  }
  let klaar = 0;
  const alles = [...[...doelen.teamsWeg].map(id => db.doc(`teams/${id}`)), ...weg, ...[...doelen.clubsWeg].map(id => db.doc(`clubs/${id}`))];
  for (const ref of alles){
    await db.recursiveDelete(ref);
    if (++klaar % 50 === 0) console.log(`  ${klaar}/${alles.length} …`);
  }
  for (const f of bestanden) await f.delete({ ignoreNotFound: true });
  console.log(`\nKlaar: ${doelen.clubsWeg.size} clubs, ${doelen.teamsWeg.size} teams, ${weg.length} losse documenten en ${bestanden.length} bestanden verwijderd.`);
}
