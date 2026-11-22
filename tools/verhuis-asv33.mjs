// Verhuizing ASV'33 (Firebase-project cluppieasv33) → cluppie.io. Volgorde en uitleg: VERHUIZING-ASV33.md.
//
// Kopieert accounts (met wachtwoord-hash en Google-koppeling, zelfde account-id), alle gegevens (zelfde
// document-id's) en alle bestanden (zelfde pad, zelfde download-token) van de bron naar het doel.
// De bron wordt nooit gewijzigd, behalve door 'slot' en 'ontgrendel' (rules van de bron).
// Opnieuw draaien is veilig tot de opdracht 'club' is gedraaid: daarna weigert 'gegevens', omdat trainers
// dan in cluppie.io verder werken en een nieuwe kopie hun wijzigingen zou overschrijven.
//
// Inloggen (eenmalig, met het Google-account dat eigenaar is van beide projecten):
//   gcloud auth application-default login
//   gcloud auth application-default set-quota-project cluppie-ad329
//
//   node tools/verhuis-asv33.mjs voorcontrole --naar=<project>            leest alleen, schrijft niets in Firebase
//   node tools/verhuis-asv33.mjs accounts     --naar=<project> [--droog]
//   node tools/verhuis-asv33.mjs gegevens     --naar=<project> [--droog]
//   node tools/verhuis-asv33.mjs bestanden    --naar=<project> [--droog]  (alleen met een doel-bucket)
//   node tools/verhuis-asv33.mjs club         --naar=<project> [--droog]
//   node tools/verhuis-asv33.mjs controle     --naar=<project>
//   node tools/verhuis-asv33.mjs proef-akkoord --naar=<proefproject>      alleen voor de proef, zie hieronder
//   node tools/verhuis-asv33.mjs slot | ontgrendel                        zet de oude omgeving op slot / weer open
//
// Opties: --van=<project> (standaard cluppieasv33), --club=<clubId> (als de bron meer dan één club heeft),
//   --bucket=<doel-bucket> (standaard cluppie-ad329-eu bij het echte project, anders geen),
//   --bron-sleutel=<bestand> en --doel-sleutel=<bestand> (service-account in plaats van gcloud-inlog),
//   --hash-sleutel= --hash-scheider= --hash-rounds= --hash-mem= (wachtwoord-hashinstellingen met de hand,
//   uit Firebase-console › Authentication › ⋮ › Password hash parameters, als het script ze niet zelf kan lezen),
//   --echt (verplicht om in het echte project cluppie-ad329 te schrijven), --opnieuw (gegevens na 'club').
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { KOPIEER, SLA_OVER, NAAR_CLUB, doelPad, isAnoniem, heeftWachtwoord, importRecord, planAccounts,
  bestandDoelNaam, maakOmzetter, clubAanvulling, vasteVorm } from './verhuis-asv33/logica.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
/* firebase-admin komt uit functions/node_modules (cd functions && npm install) */
const require = createRequire(path.join(HIER, '..', 'functions', 'package.json'));
const admin = require('firebase-admin');
const { getFirestore, DocumentReference, Timestamp, GeoPoint, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

const PRODUCTIE = 'cluppie-ad329', PRODUCTIE_BUCKET = 'cluppie-ad329-eu';
const arg = process.argv.slice(2);
const OPDRACHT = arg[0] || '';
const optie = n => (arg.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '');
const vlag = n => arg.includes(`--${n}`);
const DROOG = vlag('droog');
const BRON = optie('van') || 'cluppieasv33', DOEL = optie('naar');
const BRON_BUCKETS = [`${BRON}.firebasestorage.app`, `${BRON}.appspot.com`];
const DOEL_BUCKET = optie('bucket') || (DOEL === PRODUCTIE ? PRODUCTIE_BUCKET : '');
const EMULATOR = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
const OPDRACHTEN = ['voorcontrole', 'accounts', 'gegevens', 'bestanden', 'club', 'controle', 'proef-akkoord', 'slot', 'ontgrendel'];
const ALLEEN_BRON = ['slot', 'ontgrendel'].includes(OPDRACHT);
const SCHRIJFT = ['accounts', 'gegevens', 'bestanden', 'club', 'proef-akkoord'].includes(OPDRACHT) && !DROOG;

function stop(tekst, code = 1){ console.error('\n' + tekst); process.exit(code); }
if (!OPDRACHTEN.includes(OPDRACHT)) stop(`Gebruik: node tools/verhuis-asv33.mjs ${OPDRACHTEN.join('|')} --naar=<project> [--droog]\nZie VERHUIZING-ASV33.md.`);
if (!ALLEEN_BRON && !DOEL) stop('Geef het doel op met --naar=<project> (het proefproject, of cluppie-ad329 voor de echte verhuizing).');
if (!ALLEEN_BRON && DOEL === BRON) stop('Bron en doel zijn hetzelfde project.');
if (SCHRIJFT && DOEL === PRODUCTIE && !vlag('echt')) stop(`Dit schrijft in het echte project ${PRODUCTIE}. Voeg --echt toe als dat de bedoeling is (eerst de proef, zie VERHUIZING-ASV33.md).`);

const sleutel = pad => admin.credential.cert(JSON.parse(fs.readFileSync(pad, 'utf8')));
const credBron = optie('bron-sleutel') ? sleutel(optie('bron-sleutel')) : (EMULATOR ? null : admin.credential.applicationDefault());
const credDoel = optie('doel-sleutel') ? sleutel(optie('doel-sleutel')) : (EMULATOR ? null : admin.credential.applicationDefault());
const bronApp = admin.initializeApp({ projectId: BRON, ...(credBron ? { credential: credBron } : {}) }, 'bron');
const doelApp = ALLEEN_BRON ? null : admin.initializeApp({ projectId: DOEL, ...(credDoel ? { credential: credDoel } : {}) }, 'doel');
const bronDb = getFirestore(bronApp), doelDb = doelApp ? getFirestore(doelApp) : null;

/* ---------- staat (alleen lokaal, niet in git: bevat e-mailadressen) ---------- */
const STAAT_MAP = path.join(HIER, '..', '.verhuis');
const STAAT_PAD = path.join(STAAT_MAP, `asv33-${DOEL || 'bron'}.json`);
const leesStaat = () => { try { return JSON.parse(fs.readFileSync(STAAT_PAD, 'utf8')); } catch (e){ return null; } };
function schrijfStaat(s){ fs.mkdirSync(STAAT_MAP, { recursive: true }); fs.writeFileSync(STAAT_PAD, JSON.stringify(s, null, 1)); }
function staatNodig(){
  const s = leesStaat();
  if (!s || s.bron !== BRON || s.doel !== DOEL) stop(`Draai eerst: node tools/verhuis-asv33.mjs voorcontrole --naar=${DOEL}`);
  return s;
}
async function vraag(tekst, verwacht){
  if (EMULATOR) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const antwoord = await new Promise(ok => rl.question(`${tekst}\nTyp ${verwacht} om door te gaan: `, ok));
  rl.close();
  if (antwoord.trim() !== verwacht) stop('Gestopt, er is niets gewijzigd.');
}

/* ---------- hulpjes ---------- */
const isVast = v => v instanceof Timestamp || v instanceof GeoPoint || Buffer.isBuffer(v) || v instanceof Uint8Array
  || (v.constructor && ['VectorValue', 'FieldValue'].includes(v.constructor.name));
const soort = v => (v instanceof DocumentReference ? 'ref' : isVast(v) ? 'vast' : null);
const soortTekst = v => v instanceof Timestamp ? `ts:${v.seconds}.${v.nanoseconds}`
  : v instanceof GeoPoint ? `geo:${v.latitude},${v.longitude}`
  : v instanceof DocumentReference ? `ref:${v.path}`
  : (Buffer.isBuffer(v) || v instanceof Uint8Array) ? `bytes:${Buffer.from(v).toString('base64')}`
  : (v.constructor && v.constructor.name === 'VectorValue') ? `vec:${JSON.stringify(v.toArray())}` : null;
const colSleutel = p => p.split('/').filter((_, i) => i % 2 === 0).join('/');
const mb = b => (b / 1048576).toFixed(1) + ' MB';
const regel = (a, b) => console.log(`  ${String(a).padEnd(46)} ${b}`);

/* Alle documenten van een collectie, met subcollecties op elk niveau. Ook 'lege' documenten (alleen
   subcollecties, geen eigen velden): die komen niet uit een query, listDocuments() geeft ze wel. */
async function* loop(col){
  let laatste = null;
  const gezien = new Set();
  for (;;){
    let q = col.orderBy('__name__').limit(300);
    if (laatste) q = q.startAfter(laatste);
    const snap = await q.get();
    for (const d of snap.docs){
      gezien.add(d.id);
      yield d;
      for (const sub of await d.ref.listCollections()) yield* loop(sub);
    }
    if (snap.size < 300) break;
    laatste = snap.docs[snap.docs.length - 1];
  }
  for (const r of await col.listDocuments()){
    if (gezien.has(r.id)) continue;
    for (const sub of await r.listCollections()) yield* loop(sub);
  }
}
async function alleAccounts(app){
  const auth = getAuth(app), uit = [];
  let token;
  do {
    const r = await auth.listUsers(1000, token);
    for (const u of r.users){
      const j = u.toJSON();
      /* zonder het recht om hashes te lezen geeft Firebase "REDACTED" terug */
      if (j.passwordHash === 'UkVEQUNURUQ=') { delete j.passwordHash; delete j.passwordSalt; }
      uit.push(j);
    }
    token = r.pageToken;
  } while (token);
  return uit;
}
function indexAccounts(lijst){
  const doelOpUid = new Map(), doelOpEmail = new Map(), doelOpProvider = new Map();
  for (const u of lijst){
    doelOpUid.set(u.uid, u);
    if (u.email) doelOpEmail.set(String(u.email).toLowerCase(), u);
    for (const p of (u.providerData || [])) if (p.providerId !== 'password') doelOpProvider.set(p.providerId + '|' + p.uid, u);
  }
  return { doelOpUid, doelOpEmail, doelOpProvider };
}
const naamVan = u => `${u.displayName || '(geen naam)'} <${u.email || 'geen e-mail'}>`;

async function hashInstellingen(){
  if (EMULATOR) return { algorithm: 'SCRYPT', key: Buffer.from('emulator'), saltSeparator: Buffer.from(''), rounds: 8, memoryCost: 14 };
  let c = null;
  if (optie('hash-sleutel')){
    c = { signerKey: optie('hash-sleutel'), saltSeparator: optie('hash-scheider') || 'Bw==', rounds: Number(optie('hash-rounds') || 8), memoryCost: Number(optie('hash-mem') || 14), algorithm: 'SCRYPT' };
  } else {
    const tok = (await credBron.getAccessToken()).access_token;
    const r = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${BRON}/config`, { headers: { Authorization: 'Bearer ' + tok, 'x-goog-user-project': BRON } });
    if (!r.ok) throw new Error(`De wachtwoord-hashinstellingen van ${BRON} zijn niet te lezen (${r.status}). Geef ze met de hand mee: --hash-sleutel= --hash-scheider= --hash-rounds= --hash-mem= (Firebase-console › Authentication › ⋮ › Password hash parameters).`);
    c = ((await r.json()).signIn || {}).hashConfig || null;
  }
  if (!c || !c.signerKey) throw new Error(`Geen wachtwoord-hashinstellingen gevonden voor ${BRON}. Geef ze met de hand mee (zie bovenaan dit script).`);
  if (c.algorithm && c.algorithm !== 'SCRYPT') throw new Error(`Onverwacht hash-algoritme ${c.algorithm}; dit script kent alleen SCRYPT (de Firebase-standaard).`);
  return { algorithm: 'SCRYPT', key: Buffer.from(c.signerKey, 'base64'), saltSeparator: Buffer.from(c.saltSeparator || '', 'base64'), rounds: Number(c.rounds), memoryCost: Number(c.memoryCost) };
}

async function bronBucket(){
  for (const naam of BRON_BUCKETS){
    const b = getStorage(bronApp).bucket(naam);
    /* getFiles in plaats van exists(): werkt ook waar het account wel de bestanden maar niet de bucket zelf mag lezen */
    try { await b.getFiles({ maxResults: 1, autoPaginate: false }); return b; } catch (e){ /* volgende proberen */ }
  }
  return null;
}
async function kiesClub(){
  const snap = await bronDb.collection('clubs').get();
  const clubs = [];
  for (const d of snap.docs){
    const teams = await bronDb.collection('teams').where('club', '==', d.id).count().get();
    clubs.push({ id: d.id, naam: d.data().naam || '(geen naam)', code: d.data().code || '', teams: teams.data().count });
  }
  clubs.sort((a, b) => b.teams - a.teams);
  const gekozen = optie('club') ? clubs.find(c => c.id === optie('club')) : clubs[0];
  if (optie('club') && !gekozen) stop(`Club ${optie('club')} bestaat niet in ${BRON}.`);
  return { clubs, gekozen: gekozen || null };
}
function omzetterVoor(staat){
  return maakOmzetter({ uidMap: staat.uidMap || {}, bucketsVan: BRON_BUCKETS, bucketNaar: DOEL_BUCKET, soort,
    maakRef: p => doelDb.doc(p), padOpties: { clubId: staat.clubId, uidMap: staat.uidMap || {} } });
}
/* Loopt alle documenten van de bron langs die mee moeten: geeft { snap, pad } met het pad in het doel. */
async function* teKopieren(staat, anoniem){
  const padOpties = { clubId: staat.clubId, uidMap: staat.uidMap || {} };
  for (const col of await bronDb.listCollections()){
    if (![...KOPIEER, ...NAAR_CLUB].includes(col.id)) continue;
    for await (const snap of loop(col)){
      const d = snap.ref.path.split('/');
      /* profielen van anonieme sessies (ouders op een deellink) gaan niet mee, net als hun account */
      if (d[0] === 'gebruikers' && anoniem.has(d[1])) continue;
      const pad = doelPad(snap.ref.path, padOpties);
      if (pad) yield { snap, pad };
    }
  }
}

/* ==================== voorcontrole ==================== */
async function voorcontrole(){
  const vorige = leesStaat();
  const begonnen = !!(vorige && vorige.bron === BRON && vorige.doel === DOEL && vorige.gegevensGestart);
  let fouten = 0, waarschuwingen = 0;
  const fout = t => { fouten++; console.log('  ✗ ' + t); };
  const let_op = t => { waarschuwingen++; console.log('  ! ' + t); };

  console.log('\nAccounts');
  const bron = await alleAccounts(bronApp), doel = await alleAccounts(doelApp);
  const plan = planAccounts(bron, indexAccounts(doel));
  regel(`in ${BRON}`, bron.length);
  regel('  met wachtwoord', bron.filter(heeftWachtwoord).length);
  regel('  met Google', bron.filter(u => (u.providerData || []).some(p => p.providerId === 'google.com')).length);
  regel('  anoniem (gaan niet mee)', plan.anoniem);
  regel(`al in ${DOEL}`, doel.length);
  regel('nieuw over te zetten', plan.importeer.length);
  regel('al overgezet (blijven zoals ze zijn)', plan.bijwerken.length);
  regel('bestaan al in het doel (worden gekoppeld)', Object.keys(plan.uidMap).length);
  for (const d of plan.dubbel){
    if (plan.uidMap[d.bron.uid]) let_op(`${naamVan(d.bron)}: ${d.reden}. Blijft inloggen zoals nu op cluppie.io; de ASV'33-teams komen bij dat account.`);
    else fout(`${naamVan(d.bron)}: ${d.reden}. Dit moet eerst met de hand worden opgelost.`);
  }
  if (plan.zonderHash.length) fout(`Van ${plan.zonderHash.length} account(s) met een wachtwoord is de hash niet te lezen. Het account waarmee je bent ingelogd heeft daar geen recht op (nodig: eigenaar van ${BRON}). Zonder hash moeten deze trainers een nieuw wachtwoord instellen.`);
  try { const h = await hashInstellingen(); regel('wachtwoord-hashinstellingen', `gelezen (rounds ${h.rounds}, geheugen ${h.memoryCost})`); }
  catch (e){ fout(e.message); }

  console.log('\nClubs in de bron');
  const { clubs, gekozen } = await kiesClub();
  for (const c of clubs) regel(`${c.naam} (${c.id})`, `${c.teams} teams${gekozen && c.id === gekozen.id ? '  ← hoofdclub' : ''}`);
  if (!gekozen) fout('Geen club gevonden in de bron.');
  else if (clubs.length > 1 && !optie('club')) let_op(`Meer dan één club; "${gekozen.naam}" is als hoofdclub gekozen (de club-inhoud uit 'content' komt daar). Andere keuze: --club=<id>.`);

  console.log('\nGegevens');
  const staat = { tijd: new Date().toISOString(), bron: BRON, doel: DOEL, clubId: gekozen ? gekozen.id : null, uidMap: plan.uidMap,
    overslaan: begonnen ? (vorige.overslaan || []) : [], gegevensGestart: begonnen,
    dubbel: plan.dubbel.map(d => ({ bron: d.bron.uid, doel: d.doel.uid, email: d.bron.email || '', reden: d.reden })) };
  const anoniem = new Set(bron.filter(isAnoniem).map(u => u.uid));
  const wortel = (await bronDb.listCollections()).map(c => c.id);
  const onbekend = wortel.filter(c => ![...KOPIEER, ...NAAR_CLUB, ...SLA_OVER].includes(c));
  const zet = omzetterVoor(staat);
  const tel = {}, botsing = [];
  let gelijk = 0, pakket = [];
  const leeg = async () => {
    if (!pakket.length) return;
    const snaps = await doelDb.getAll(...pakket.map(x => doelDb.doc(x.pad)));
    snaps.forEach((s, i) => {
      if (!s.exists) return;
      if (vasteVorm(zet(pakket[i].snap.data()), soortTekst) === vasteVorm(s.data(), soortTekst)) gelijk++;
      else botsing.push(pakket[i].pad);
    });
    pakket = [];
  };
  for await (const x of teKopieren(staat, anoniem)){
    tel[colSleutel(x.pad)] = (tel[colSleutel(x.pad)] || 0) + 1;
    pakket.push(x);
    if (pakket.length >= 200) await leeg();
  }
  await leeg();
  for (const k of Object.keys(tel).sort()) regel(k, tel[k]);
  regel('totaal', Object.values(tel).reduce((s, n) => s + n, 0) + ' documenten');
  for (const c of SLA_OVER.filter(c => wortel.includes(c))) regel(c, 'gaat bewust niet mee');
  for (const c of onbekend) let_op(`Collectie "${c}" kent het script niet en gaat niet mee. Is dat niet de bedoeling, meld het dan eerst.`);
  if (begonnen) regel('kopie al gestart', `de lijst "bestaat al in het doel" (${staat.overslaan.length}) blijft zoals hij was`);
  else {
    staat.overslaan = botsing;
    if (gelijk) regel('staat al gelijk in het doel', gelijk);
    if (botsing.length){
      let_op(`${botsing.length} document(en) bestaan al in ${DOEL} met andere inhoud. Die blijven zoals ze in het doel staan (worden niet overschreven):`);
      for (const p of botsing.slice(0, 15)) console.log('      ' + p);
      if (botsing.length > 15) console.log(`      … en ${botsing.length - 15} meer (zie ${path.relative(process.cwd(), STAAT_PAD)})`);
    }
  }

  console.log('\nCodes (team- en clubcodes die al rondgaan)');
  const codes = async naam => {
    const eigen = (await bronDb.collection(naam).get()).docs.filter(d => d.data().code).map(d => ({ id: d.id, code: String(d.data().code) }));
    let dubbel = 0;
    for (let i = 0; i < eigen.length; i += 30){
      const deel = eigen.slice(i, i + 30);
      const s = await doelDb.collection(naam).where('code', 'in', deel.map(x => x.code)).get();
      for (const d of s.docs){ const e = deel.find(x => x.code === d.data().code); if (e && e.id !== d.id){ dubbel++; let_op(`${naam}-code ${e.code} is in ${DOEL} al in gebruik door een ander ${naam === 'clubs' ? 'club' : 'team'} (${d.id}). Na de verhuizing een van beide een nieuwe code geven.`); } }
    }
    regel(`${naam}-codes`, `${eigen.length}, waarvan ${dubbel} dubbel met het doel`);
  };
  await codes('clubs'); await codes('teams');

  console.log('\nBestanden');
  const b = await bronBucket();
  if (!b) let_op(`Geen bucket gevonden voor ${BRON} (${BRON_BUCKETS.join(' of ')}).`);
  else {
    const [bestanden] = await b.getFiles();
    regel(b.name, `${bestanden.length} bestanden, ${mb(bestanden.reduce((s, f) => s + Number(f.metadata.size || 0), 0))}`);
    if (!DOEL_BUCKET) regel('doel-bucket', 'geen: bestanden blijven in de oude bucket en de links blijven daarheen wijzen (alleen voor de proef)');
    else {
      try { await getStorage(doelApp).bucket(DOEL_BUCKET).getFiles({ maxResults: 1, autoPaginate: false }); regel('doel-bucket', DOEL_BUCKET); }
      catch (e){ fout(`De doel-bucket ${DOEL_BUCKET} is niet te bereiken (${e.message}).`); }
    }
  }

  schrijfStaat(staat);
  console.log(`\n${fouten ? `${fouten} probleem/problemen die eerst opgelost moeten worden` : 'Geen blokkerende problemen'}${waarschuwingen ? `, ${waarschuwingen} punt(en) om te weten` : ''}.`);
  console.log(`Bewaard in ${path.relative(process.cwd(), STAAT_PAD)} (bevat e-mailadressen; staat niet in git).`);
  process.exitCode = fouten ? 2 : 0;
}

/* ==================== accounts ==================== */
async function accounts(){
  const staat = staatNodig();
  const bron = await alleAccounts(bronApp), doel = await alleAccounts(doelApp);
  const plan = planAccounts(bron, indexAccounts(doel));
  const vast = plan.dubbel.filter(d => !plan.uidMap[d.bron.uid]);
  if (vast.length) stop(`${vast.length} account(s) botsen met het doel en zijn niet te koppelen (zelfde id, ander e-mailadres). Draai de voorcontrole voor de namen.`);
  if (plan.zonderHash.length && !vlag('zonder-wachtwoorden')) stop(`Van ${plan.zonderHash.length} account(s) is de wachtwoord-hash niet te lezen. Los het recht op (eigenaar van ${BRON}), of draai met --zonder-wachtwoorden: die trainers moeten dan een nieuw wachtwoord instellen.`);
  /* Accounts die er al staan (zelfde id en e-mailadres, van een eerdere run) blijven zoals ze zijn:
     Firebase overschrijft een bestaand account niet bij een import. */
  const lijst = plan.importeer;
  console.log(`  ${plan.importeer.length} nieuw, ${plan.bijwerken.length} stonden er al, ${Object.keys(plan.uidMap).length} gekoppeld aan een bestaand account, ${plan.anoniem} anoniem (niet mee)`);
  staat.uidMap = plan.uidMap; staat.accountsTijd = new Date().toISOString();
  if (DROOG) return console.log('  droog: er is niets geschreven');
  const hash = await hashInstellingen();
  let goed = 0; const mis = [];
  for (let i = 0; i < lijst.length; i += 500){
    const deel = lijst.slice(i, i + 500);
    const r = await getAuth(doelApp).importUsers(deel.map(importRecord), { hash });
    goed += r.successCount;
    for (const e of r.errors) mis.push(`${naamVan(deel[e.index])}: ${e.error.message}`);
    console.log(`  ${Math.min(i + 500, lijst.length)}/${lijst.length}`);
  }
  schrijfStaat(staat);
  console.log(`  ${goed} accounts overgezet${mis.length ? `, ${mis.length} mislukt:` : ''}`);
  for (const m of mis) console.log('   ✗ ' + m);
  process.exitCode = mis.length ? 2 : 0;
}

/* ==================== gegevens ==================== */
async function gegevens(){
  const staat = staatNodig();
  if (!staat.clubId) stop('Geen hoofdclub bekend; draai de voorcontrole opnieuw.');
  const clubDoel = await doelDb.doc(`clubs/${staat.clubId}`).get();
  if (clubDoel.exists && clubDoel.data().verhuisd && !vlag('opnieuw'))
    stop(`De club is al afgerond in ${DOEL} (opdracht 'club' is gedraaid). Een nieuwe kopie zou overschrijven wat daarna in cluppie.io is gewijzigd.\nAlleen bij de proef, of als je zeker weet dat er nog niemand in werkt: voeg --opnieuw toe.`);
  const anoniem = new Set((await alleAccounts(bronApp)).filter(isAnoniem).map(u => u.uid));
  const zet = omzetterVoor(staat), overslaan = new Set(staat.overslaan || []);
  const tel = {}; let over = 0;
  if (!DROOG){ staat.gegevensGestart = true; schrijfStaat(staat); }
  const schrijver = DROOG ? null : doelDb.bulkWriter();
  const fouten = [];
  if (schrijver) schrijver.onWriteError(e => { if (e.failedAttempts < 5) return true; fouten.push(`${e.documentRef.path}: ${e.message}`); return false; });
  let n = 0;
  for await (const { snap, pad } of teKopieren(staat, anoniem)){
    if (overslaan.has(pad)){ over++; continue; }
    if (schrijver) schrijver.set(doelDb.doc(pad), zet(snap.data())).catch(() => {});
    tel[colSleutel(pad)] = (tel[colSleutel(pad)] || 0) + 1;
    if (++n % 1000 === 0) console.log(`  ${n} documenten …`);
  }
  if (schrijver) await schrijver.close();
  for (const k of Object.keys(tel).sort()) regel(k, tel[k]);
  regel('totaal', `${n} documenten${over ? `, ${over} overgeslagen (bestonden al in het doel)` : ''}${DROOG ? ' (droog: niets geschreven)' : ''}`);
  if (fouten.length){ console.log(`  ${fouten.length} schrijffout(en):`); for (const f of fouten.slice(0, 20)) console.log('   ✗ ' + f); process.exitCode = 2; }
  if (!DROOG){ staat.gegevensTijd = new Date().toISOString(); schrijfStaat(staat); }
}

/* ==================== bestanden ==================== */
async function bestanden(){
  if (!DOEL_BUCKET) stop('Geen doel-bucket. Bij de proef blijven de bestanden in de oude bucket; bij het echte project is het cluppie-ad329-eu, of geef --bucket=<naam>.');
  const b = await bronBucket();
  if (!b) stop(`Geen bucket gevonden voor ${BRON}.`);
  const d = getStorage(doelApp).bucket(DOEL_BUCKET);
  const [lijst] = await b.getFiles();
  const [aanwezig] = await d.getFiles();
  const er = new Map(aanwezig.map(f => [f.name, f.metadata]));
  let n = 0, nieuw = 0, bytes = 0;
  for (const f of lijst){
    n++; bytes += Number(f.metadata.size || 0);
    const naam = bestandDoelNaam(f.name), al = er.get(naam);
    /* al gekopieerd en ongewijzigd: overslaan (opnieuw draaien gaat dan snel) */
    if (al && al.md5Hash === f.metadata.md5Hash && String(al.size) === String(f.metadata.size)) continue;
    nieuw++;
    if (DROOG) continue;
    const doelBestand = d.file(naam);
    await f.copy(doelBestand);
    /* download-token en contenttype expliciet meenemen, zodat de herschreven links blijven werken */
    await doelBestand.setMetadata({ contentType: f.metadata.contentType, cacheControl: f.metadata.cacheControl, metadata: f.metadata.metadata || {} });
    if (nieuw % 25 === 0) console.log(`  ${n}/${lijst.length} …`);
  }
  console.log(`  ${lijst.length} bestanden (${mb(bytes)}), ${nieuw} ${DROOG ? 'te kopiëren (droog: niets geschreven)' : 'gekopieerd'}, ${lijst.length - nieuw} stonden er al`);
}

/* ==================== club ==================== */
async function club(){
  const staat = staatNodig();
  const ref = doelDb.doc(`clubs/${staat.clubId}`), snap = await ref.get();
  if (!snap.exists) stop(`clubs/${staat.clubId} staat nog niet in ${DOEL}. Draai eerst 'gegevens'.`);
  const sjabloon = JSON.parse(fs.readFileSync(path.join(HIER, 'verhuis-asv33', 'club-asv33.json'), 'utf8'));
  const teams = (await doelDb.collection('teams').where('club', '==', staat.clubId).get()).docs.map(t => ({ id: t.id, leden: t.data().leden || {} }));
  const velden = clubAanvulling(snap.data(), sjabloon, teams);
  const ledenErbij = Object.keys(velden).filter(k => k.startsWith('leden.')).length;
  console.log(`  club: ${snap.data().naam || staat.clubId}, ${teams.length} teams`);
  regel('instellingen', velden.instellingen ? 'gezet uit tools/verhuis-asv33/club-asv33.json' : 'stonden er al, blijven zoals ze zijn');
  regel('onderdelen van het platform', Object.keys(velden).filter(k => k.startsWith('platformModules.')).map(k => `${k.split('.')[1]}=${velden[k]}`).join(', ') || 'stonden er al');
  regel('teamleden die nog niet bij de club stonden', ledenErbij);
  if (DROOG) return console.log('  droog: er is niets geschreven');
  /* update() met een FieldPath per veld: account-id's en moduleNamen bevatten geen punten, maar zo is het zeker goed */
  const paren = [];
  for (const [k, v] of Object.entries(velden)) paren.push(new FieldPath(...k.split('.')), v);
  if (!snap.data().verhuisd) paren.push(new FieldPath('verhuisd'), { van: BRON, tijd: FieldValue.serverTimestamp() });
  if (paren.length) await ref.update(...paren);
  staat.clubTijd = new Date().toISOString(); schrijfStaat(staat);
  console.log(`  Klaar. Vanaf nu weigert 'gegevens' een nieuwe kopie (behalve met --opnieuw).`);
}

/* ==================== controle ==================== */
async function controle(){
  const staat = staatNodig();
  let verschil = 0;
  console.log('\nAccounts');
  const bron = await alleAccounts(bronApp), doel = indexAccounts(await alleAccounts(doelApp));
  let goed = 0; const mis = [];
  for (const u of bron){
    if (isAnoniem(u)) continue;
    const d = doel.doelOpUid.get((staat.uidMap || {})[u.uid] || u.uid);
    if (!d) mis.push(`${naamVan(u)}: staat niet in ${DOEL}`);
    else if (String(d.email || '').toLowerCase() !== String(u.email || '').toLowerCase()) mis.push(`${naamVan(u)}: ander e-mailadres in het doel`);
    else if (!(staat.uidMap || {})[u.uid] && heeftWachtwoord(u) && !d.passwordHash) mis.push(`${naamVan(u)}: wachtwoord ontbreekt in het doel`);
    else goed++;
  }
  regel('overgezet en gelijk', goed);
  for (const m of mis.slice(0, 20)) console.log('  ✗ ' + m);
  if (mis.length) { regel('niet goed', mis.length); verschil += mis.length; }

  console.log('\nGegevens');
  const anoniem = new Set(bron.filter(isAnoniem).map(u => u.uid));
  const zet = omzetterVoor(staat), overslaan = new Set(staat.overslaan || []);
  const a = {}, ok = {}; const afwijkend = [], ontbreekt = [];
  let pakket = [];
  const afgerond = (await doelDb.doc(`clubs/${staat.clubId}`).get()).data()?.verhuisd;
  const leeg = async () => {
    if (!pakket.length) return;
    const snaps = await doelDb.getAll(...pakket.map(x => doelDb.doc(x.pad)));
    snaps.forEach((s, i) => {
      const { pad, snap } = pakket[i], k = colSleutel(pad);
      if (!s.exists) return ontbreekt.push(pad);
      /* het clubdocument is door 'club' aangevuld: alleen kijken of het er staat */
      if (afgerond && pad === `clubs/${staat.clubId}`) { ok[k] = (ok[k] || 0) + 1; return; }
      if (overslaan.has(pad) || vasteVorm(zet(snap.data()), soortTekst) === vasteVorm(s.data(), soortTekst)) ok[k] = (ok[k] || 0) + 1;
      else afwijkend.push(pad);
    });
    pakket = [];
  };
  for await (const x of teKopieren(staat, anoniem)){
    a[colSleutel(x.pad)] = (a[colSleutel(x.pad)] || 0) + 1;
    pakket.push(x);
    if (pakket.length >= 200) await leeg();
  }
  await leeg();
  for (const k of Object.keys(a).sort()) console.log(`${a[k] === (ok[k] || 0) ? '  ' : '✗ '}${k.padEnd(46)} bron ${String(a[k]).padStart(6)}   doel gelijk ${String(ok[k] || 0).padStart(6)}`);
  for (const p of ontbreekt.slice(0, 10)) console.log('  ✗ ontbreekt: ' + p);
  for (const p of afwijkend.slice(0, 10)) console.log('  ✗ wijkt af: ' + p);
  verschil += ontbreekt.length + afwijkend.length;
  regel('totaal', `${Object.values(a).reduce((s, n) => s + n, 0)} documenten, ${ontbreekt.length} ontbreken, ${afwijkend.length} wijken af${overslaan.size ? `, ${overslaan.size} bewust niet overschreven` : ''}`);

  console.log('\nBestanden');
  const b = await bronBucket();
  if (!b) regel('bron', 'geen bucket');
  else if (!DOEL_BUCKET) regel('doel-bucket', 'geen (proef): bestanden blijven in de oude bucket');
  else {
    const [fb] = await b.getFiles(), [fd] = await getStorage(doelApp).bucket(DOEL_BUCKET).getFiles();
    const er = new Map(fd.map(f => [f.name, String(f.metadata.size)]));
    const mist = fb.filter(f => er.get(bestandDoelNaam(f.name)) !== String(f.metadata.size));
    regel('bron / in het doel', `${fb.length} / ${fb.length - mist.length}`);
    for (const f of mist.slice(0, 10)) console.log('  ✗ ontbreekt of andere grootte: ' + f.name);
    verschil += mist.length;
  }
  console.log(verschil ? `\n${verschil} verschil(len). Draai de betreffende stap nog een keer en controleer opnieuw.` : `\nGelijk: alles uit ${BRON} staat in ${DOEL}.`);
  process.exitCode = verschil ? 2 : 0;
}

/* ==================== proef-akkoord (alleen proefproject) ====================
   In het proefproject draaien geen Cloud Functions, dus het venster "Voordat je begint" (kennisname van de
   privacyregels) is daar niet weg te klikken. Deze opdracht zet de kennisname voor de overgezette accounts,
   zodat je in de proef kunt inloggen. Nooit in het echte project: daar bevestigt elke trainer het zelf. */
async function proefAkkoord(){
  if (DOEL === PRODUCTIE) stop('Dit is alleen voor het proefproject. In het echte project bevestigt elke trainer de privacyregels zelf.');
  const tekst = fs.readFileSync(path.join(HIER, '..', 'public', 'js', 'toegang.js'), 'utf8');
  const versie = (/export const PRIVACY_VERSIE = '([^']+)'/.exec(tekst) || [])[1];
  if (!versie) stop('PRIVACY_VERSIE niet gevonden in public/js/toegang.js.');
  const lijst = (await alleAccounts(doelApp)).filter(u => !isAnoniem(u));
  const schrijver = doelDb.bulkWriter();
  for (const u of lijst) schrijver.set(doelDb.doc(`privacyKennisname/${u.uid}`), { versie, tijd: FieldValue.serverTimestamp(), proef: true }).catch(() => {});
  await schrijver.close();
  console.log(`  kennisname (versie ${versie}) gezet voor ${lijst.length} accounts in ${DOEL}`);
}

/* ==================== slot / ontgrendel (rules van de BRON) ==================== */
const DICHT_FS = `rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }\n`;
const DICHT_ST = `rules_version = '2';\nservice firebase.storage { match /b/{bucket}/o { match /{alles=**} { allow read, write: if false; } } }\n`;
const rulesPad = soortRules => path.join(STAAT_MAP, `asv33-rules-${soortRules}.rules`);
async function slot(){
  const sr = admin.securityRules(bronApp);
  const b = await bronBucket();
  await vraag(`Dit zet ${BRON} (de oude ASV'33-omgeving) op slot: niemand kan daar nog lezen of opslaan tot 'ontgrendel'.\nDe huidige rules worden bewaard in ${path.relative(process.cwd(), STAAT_MAP)}.`, 'SLOT');
  fs.mkdirSync(STAAT_MAP, { recursive: true });
  const nu = await sr.getFirestoreRuleset();
  const bronTekst = nu.source[0].content;
  /* nooit de bewaarde rules overschrijven met de dichte versie (twee keer 'slot' achter elkaar) */
  if (bronTekst.trim() !== DICHT_FS.trim()) fs.writeFileSync(rulesPad('firestore'), bronTekst);
  if (b){
    const st = await sr.getStorageRuleset(b.name);
    if (st.source[0].content.trim() !== DICHT_ST.trim()) fs.writeFileSync(rulesPad('storage'), st.source[0].content);
  }
  if (!fs.existsSync(rulesPad('firestore'))) stop('De huidige Firestore-rules konden niet worden bewaard; er is niets gewijzigd.');
  await sr.releaseFirestoreRulesetFromSource(DICHT_FS);
  if (b && fs.existsSync(rulesPad('storage'))) await sr.releaseStorageRulesetFromSource(DICHT_ST, b.name);
  console.log(`  ${BRON} staat op slot (Firestore${b ? ' en Storage' : ''}). Terugzetten: node tools/verhuis-asv33.mjs ontgrendel`);
}
async function ontgrendel(){
  const sr = admin.securityRules(bronApp);
  if (!fs.existsSync(rulesPad('firestore'))) stop(`Geen bewaarde rules gevonden in ${STAAT_MAP}. Zet ze terug in de Firebase-console (Firestore › Rules › geschiedenis).`);
  await vraag(`Dit zet de bewaarde rules van ${BRON} terug: de oude omgeving is dan weer open.`, 'OPEN');
  await sr.releaseFirestoreRulesetFromSource(fs.readFileSync(rulesPad('firestore'), 'utf8'));
  const b = await bronBucket();
  if (b && fs.existsSync(rulesPad('storage'))) await sr.releaseStorageRulesetFromSource(fs.readFileSync(rulesPad('storage'), 'utf8'), b.name);
  console.log(`  ${BRON} is weer open.`);
}

/* ==================== start ==================== */
console.log(`Verhuizing ASV'33 · ${OPDRACHT} · ${BRON}${ALLEEN_BRON ? '' : ' → ' + DOEL}${DROOG ? ' (droog: niets wordt geschreven)' : ''}${EMULATOR ? ' [emulator]' : ''}`);
if (SCHRIJFT && DOEL === PRODUCTIE) await vraag(`Dit schrijft in het echte project ${PRODUCTIE} (stap: ${OPDRACHT}).`, 'VERHUIS');
try {
  await ({ voorcontrole, accounts, gegevens, bestanden, club, controle, 'proef-akkoord': proefAkkoord, slot, ontgrendel })[OPDRACHT]();
} catch (e){
  console.error('\nMislukt: ' + (e && e.message || e));
  if (/quota project|insufficient|PERMISSION_DENIED|Could not load the default credentials/i.test(String(e && e.message)))
    console.error('Controleer de inlog: gcloud auth application-default login en daarna\n  gcloud auth application-default set-quota-project cluppie-ad329');
  process.exitCode = 1;
}
