// Overstap naar de EU (zie MIGRATIE-EU.md voor de volgorde).
// Firestore: kopieert ALLE documenten (met subcollecties, op elk niveau) van database --van naar --naar.
//   Stap A: (default) in nam5 (VS) → tijdelijke database 'cluppie-overzet' (europe-west1)
//   Stap B: na het opnieuw aanmaken van (default) in europe-west1: 'cluppie-overzet' → (default)
// Storage: kopieert alle bestanden van de standaard-bucket (VS) naar 'cluppie-ad329-eu' (europe-west1),
//   met hun download-tokens. Download-URL's in documenten (…/v0/b/<oude-bucket>/o/…?token=…) worden bij
//   het kopiëren van de documenten herschreven naar de nieuwe bucket, dus de links blijven werken.
// De bron wordt nooit gewijzigd; opnieuw draaien is veilig (overschrijft met de bronversie).
// Inloggen (eenmalig):  gcloud auth application-default login
//
//   node tools/migreer-eu.mjs firestore --van="(default)" --naar=cluppie-overzet [--droog]
//   node tools/migreer-eu.mjs controle  --van="(default)" --naar=cluppie-overzet
//   node tools/migreer-eu.mjs storage [--droog]
//   node tools/migreer-eu.mjs controle-storage
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/* firebase-admin komt uit functions/node_modules (cd functions && npm install) */
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'functions', 'package.json'));
const admin = require('firebase-admin');
const { getFirestore, DocumentReference, Timestamp, GeoPoint, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const PROJECT = 'cluppie-ad329';
const BRON_BUCKET = 'cluppie-ad329.firebasestorage.app', DOEL_BUCKET = 'cluppie-ad329-eu';

const arg = process.argv.slice(2);
const OPDRACHT = arg[0] || '';
const optie = n => (arg.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=').replace(/^"|"$/g, '');
const DROOG = arg.includes('--droog');
const BRON_DB = optie('van'), DOEL_DB = optie('naar');
if (!['firestore', 'controle', 'storage', 'controle-storage'].includes(OPDRACHT)){
  console.error('Gebruik: node tools/migreer-eu.mjs firestore|controle --van=<database> --naar=<database> [--droog]\n       node tools/migreer-eu.mjs storage|controle-storage [--droog]'); process.exit(1);
}
if (['firestore', 'controle'].includes(OPDRACHT) && (!BRON_DB || !DOEL_DB || BRON_DB === DOEL_DB)){
  console.error('Geef twee verschillende databases op, bv. --van="(default)" --naar=cluppie-overzet'); process.exit(1);
}

admin.initializeApp({ projectId: PROJECT, storageBucket: BRON_BUCKET });
const bron = BRON_DB ? getFirestore(BRON_DB) : null, doel = DOEL_DB ? getFirestore(DOEL_DB) : null;

/* ---------- waarden omzetten ---------- */
const bucketRe = new RegExp(BRON_BUCKET.replace(/\./g, '\\.'), 'g');
function zetOm(v){
  if (v == null) return v;
  if (typeof v === 'string') return v.includes(BRON_BUCKET) ? v.replace(bucketRe, DOEL_BUCKET) : v;
  if (v instanceof Timestamp || v instanceof GeoPoint || Buffer.isBuffer(v)) return v;
  if (v instanceof DocumentReference) return doel.doc(v.path);
  if (Array.isArray(v)) return v.map(zetOm);
  if (typeof v === 'object' && v.constructor && v.constructor.name === 'VectorValue') return v;
  if (typeof v === 'object'){ const o = {}; for (const [k, x] of Object.entries(v)) o[k] = zetOm(x); return o; }
  return v;
}

/* ---------- Firestore ---------- */
const tel = {};            // collectiepad zonder ids → aantal
const sleutel = p => p.split('/').filter((_, i) => i % 2 === 0).join('/');
async function kopieerCollectie(col, schrijver){
  let laatste = null, n = 0;
  const gezien = new Set();
  for (;;){
    let q = col.orderBy('__name__').limit(300);
    if (laatste) q = q.startAfter(laatste);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs){
      gezien.add(d.id);
      if (!DROOG) schrijver.set(doel.doc(d.ref.path), zetOm(d.data()));
      n++; tel[sleutel(col.path)] = (tel[sleutel(col.path)] || 0) + 1;
      for (const sub of await d.ref.listCollections()) await kopieerCollectie(sub, schrijver);
    }
    laatste = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) break;
  }
  /* 'lege' documenten (alleen subcollecties, geen eigen velden) komen niet uit een query;
     listDocuments() geeft ze wel, en hun subcollecties moeten mee */
  for (const r of await col.listDocuments()){
    if (gezien.has(r.id)) continue;
    for (const sub of await r.listCollections()) await kopieerCollectie(sub, schrijver);
  }
  return n;
}
async function firestore(){
  const schrijver = doel.bulkWriter();
  schrijver.onWriteError(e => { console.error('  schrijffout', e.documentRef.path, e.message); return e.failedAttempts < 5; });
  const root = await bron.listCollections();
  for (const c of root){
    process.stdout.write(`  ${c.id} … `);
    const n = await kopieerCollectie(c, schrijver);
    console.log(`${n} documenten`);
  }
  await schrijver.close();
}

/* ---------- Storage ---------- */
async function storage(){
  const b = getStorage().bucket(BRON_BUCKET), d = getStorage().bucket(DOEL_BUCKET);
  const [bestanden] = await b.getFiles();
  let n = 0, bytes = 0;
  for (const f of bestanden){
    bytes += Number(f.metadata.size || 0); n++;
    if (DROOG) continue;
    const doelBestand = d.file(f.name);
    await f.copy(doelBestand);
    /* download-token en contenttype expliciet meenemen, zodat herschreven URL's blijven werken */
    await doelBestand.setMetadata({ contentType: f.metadata.contentType, cacheControl: f.metadata.cacheControl, metadata: f.metadata.metadata || {} });
    if (n % 25 === 0) console.log(`  ${n}/${bestanden.length} bestanden`);
  }
  console.log(`  ${n} bestanden, ${(bytes / 1048576).toFixed(1)} MB`);
}

/* ---------- Controle ---------- */
async function telDb(db, col, uit){
  for (const r of await col.listDocuments()){
    const s = await r.get();
    if (s.exists) uit[sleutel(col.path)] = (uit[sleutel(col.path)] || 0) + 1;
    for (const sub of await r.listCollections()) await telDb(db, sub, uit);
  }
}
async function controle(){
  const a = {}, b = {};
  for (const c of await bron.listCollections()) await telDb(bron, c, a);
  for (const c of await doel.listCollections()) await telDb(doel, c, b);
  let verschil = 0;
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()){
    const ok = a[k] === b[k] || (b[k] || 0) > (a[k] || 0);
    if (!ok) verschil++;
    console.log(`${ok ? '  ' : '✗ '}${k.padEnd(40)} ${BRON_DB.padStart(10)} ${String(a[k] || 0).padStart(6)}   ${DOEL_DB} ${String(b[k] || 0).padStart(6)}`);
  }
  const totA = Object.values(a).reduce((s, x) => s + x, 0), totB = Object.values(b).reduce((s, x) => s + x, 0);
  console.log(`\ntotaal: ${totA} → ${totB} documenten`);
  console.log(verschil ? `\n${verschil} verschil(len). Draai de kopie nog een keer.` : `\nGelijk: alles uit ${BRON_DB} staat in ${DOEL_DB}.`);
  process.exitCode = verschil ? 2 : 0;
}
async function controleStorage(){
  const [fb] = await getStorage().bucket(BRON_BUCKET).getFiles(), [fd] = await getStorage().bucket(DOEL_BUCKET).getFiles();
  const namen = new Set(fd.map(f => f.name)), mist = fb.filter(f => !namen.has(f.name));
  console.log(`bestanden: oud ${fb.length}, eu ${fd.length}${mist.length ? `, ontbreekt: ${mist.slice(0, 5).map(f => f.name).join(', ')}${mist.length > 5 ? ' …' : ''}` : ''}`);
  console.log(mist.length ? `\n${mist.length} bestand(en) ontbreken. Draai de kopie nog een keer.` : '\nGelijk: alle bestanden staan in de EU-bucket.');
  process.exitCode = mist.length ? 2 : 0;
}

console.log(`Cluppie → EU · ${OPDRACHT}${DROOG ? ' (droog: niets wordt geschreven)' : ''}`);
if (OPDRACHT === 'firestore'){
  console.log(`  Firestore ${BRON_DB} → ${DOEL_DB}\n`); await firestore();
  console.log(`\nKlaar. Controleer met: node tools/migreer-eu.mjs controle --van="${BRON_DB}" --naar=${DOEL_DB}`);
} else if (OPDRACHT === 'controle'){ console.log(''); await controle(); }
else if (OPDRACHT === 'storage'){
  console.log(`  Storage ${BRON_BUCKET} → ${DOEL_BUCKET}\n`); await storage();
  console.log('\nKlaar. Controleer met: node tools/migreer-eu.mjs controle-storage');
} else await controleStorage();
