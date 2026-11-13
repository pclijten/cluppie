/* ==================== DEMOMODUS: FIREBASE IN HET GEHEUGEN ====================
   index.html?demo laadt dit bestand in plaats van js/firebase.js (via een import map,
   zie index.html). De ECHTE app draait dan, maar alles wat hij leest en schrijft gaat
   naar een kleine database in het geheugen met een voorbeeldteam. Niets gaat naar
   Firebase; na verversen begint de demo opnieuw. Gebruikt op de over-pagina.

   Zelfde exports als js/firebase.js (dezelfde namen, dezelfde vorm), zodat geen enkel
   appbestand hoeft te veranderen. Wat in de demo niet kan (Cloud Functions, uploads,
   inloggen) geeft een nette fout of doet niets.

   Let op: de import map in index.html wijst de versie-URL 'firebase.js?v=…' hierheen.
   Wordt die versie verhoogd, verhoog hem dan ook in index.html (zoek op DEMO_VERSIE). */

/* ---------- Timestamp, sentinels ---------- */
export class Timestamp {
  constructor(seconds, nanoseconds = 0){ this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static now(){ return Timestamp.fromMillis(Date.now()); }
  static fromMillis(ms){ return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromDate(d){ return Timestamp.fromMillis(d.getTime()); }
  toMillis(){ return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate(){ return new Date(this.toMillis()); }
  valueOf(){ return String(this.toMillis()).padStart(15, '0'); }
}
const DEL = { __demo: 'delete' }, TS = { __demo: 'ts' };
export const deleteField = () => DEL;
export const serverTimestamp = () => TS;
export const increment = n => ({ __demo: 'inc', n });
export const arrayUnion = (...v) => ({ __demo: 'union', v });
export const arrayRemove = (...v) => ({ __demo: 'remove', v });
const DOC_ID = { __demo: 'documentId' };
export const documentId = () => DOC_ID;

/* ---------- de opslag ---------- */
const store = new Map();          // pad -> data
const luisteraars = new Set();    // { match(pad), fire() }
const kloon = o => {
  if (o instanceof Timestamp) return new Timestamp(o.seconds, o.nanoseconds);
  if (Array.isArray(o)) return o.map(kloon);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, kloon(v)]));
  return o;
};
const leesPad = (obj, pad) => pad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function pasToe(oud, waarde){
  if (waarde === TS) return Timestamp.now();
  if (waarde && waarde.__demo === 'inc') return (typeof oud === 'number' ? oud : 0) + waarde.n;
  if (waarde && waarde.__demo === 'union') return [...new Set([...(Array.isArray(oud) ? oud : []), ...waarde.v])];
  if (waarde && waarde.__demo === 'remove') return (Array.isArray(oud) ? oud : []).filter(x => !waarde.v.includes(x));
  if (waarde && typeof waarde === 'object' && !(waarde instanceof Timestamp) && !Array.isArray(waarde)){
    const uit = {};
    for (const [k, v] of Object.entries(waarde)){ if (v !== DEL) uit[k] = pasToe(undefined, v); }
    return uit;
  }
  return kloon(waarde);
}
function zetPad(obj, pad, waarde){
  const k = pad.split('.'); let o = obj;
  for (let i = 0; i < k.length - 1; i++){ if (!o[k[i]] || typeof o[k[i]] !== 'object') o[k[i]] = {}; o = o[k[i]]; }
  const laatste = k[k.length - 1];
  if (waarde === DEL) delete o[laatste]; else o[laatste] = pasToe(o[laatste], waarde);
}
function mergeDiep(doel, bron){
  for (const [k, v] of Object.entries(bron)){
    if (v === DEL){ delete doel[k]; continue; }
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !v.__demo && doel[k] && typeof doel[k] === 'object' && !Array.isArray(doel[k])) mergeDiep(doel[k], v);
    else doel[k] = pasToe(doel[k], v);
  }
}
let teller = 0;
const nieuwId = () => 'demo' + Date.now().toString(36) + (++teller).toString(36);
let wachtrij = null;
function veranderd(){
  if (wachtrij) return;
  wachtrij = Promise.resolve().then(() => { wachtrij = null; luisteraars.forEach(l => l.fire()); });
}

/* ---------- referenties en query's ---------- */
const padVan = (delen) => delen.filter(x => x != null && x !== '').join('/');
class DocRef {
  constructor(pad){ this.path = pad; this.id = pad.split('/').pop(); this.type = 'document'; }
  get parent(){ return new ColRef(this.path.split('/').slice(0, -1).join('/')); }
  withConverter(){ return this; }
}
class ColRef {
  constructor(pad){ this.path = pad; this.id = pad.split('/').pop(); this.type = 'collection'; this._filters = []; this._limit = Infinity; }
  withConverter(){ return this; }
}
export const db = { type: 'demo-firestore', app: { name: 'demo' } };
export function doc(basis, ...delen){
  if (basis instanceof ColRef){ return new DocRef(padVan([basis.path, delen[0] || nieuwId()])); }
  if (basis instanceof DocRef) return new DocRef(padVan([basis.path, ...delen]));
  return new DocRef(padVan(delen));
}
export function collection(basis, ...delen){
  if (basis instanceof DocRef || basis instanceof ColRef) return new ColRef(padVan([basis.path, ...delen]));
  return new ColRef(padVan(delen));
}
export function collectionGroup(_db, id){ const c = new ColRef('**/' + id); c._groep = id; return c; }
export function where(veld, op, waarde){ return { soort: 'where', veld, op, waarde }; }
export function orderBy(veld, richting = 'asc'){ return { soort: 'orderBy', veld, richting }; }
export function limit(n){ return { soort: 'limit', n }; }
export function query(col, ...delen){
  const q = new ColRef(col.path); q._groep = col._groep; q._filters = [...col._filters]; q._orde = [...(col._orde || [])]; q._limit = col._limit;
  for (const d of delen){
    if (!d) continue;
    if (d.soort === 'where') q._filters.push(d);
    else if (d.soort === 'orderBy') q._orde.push(d);
    else if (d.soort === 'limit') q._limit = d.n;
  }
  return q;
}
function past(pad, data, f){
  const x = f.veld === DOC_ID ? pad.split('/').pop() : leesPad(data, String(f.veld));
  const v = f.waarde, cmp = y => (y instanceof Timestamp ? y.toMillis() : y);
  switch (f.op){
    case '==': return cmp(x) === cmp(v) || (x == null && v == null);
    case '!=': return cmp(x) !== cmp(v);
    case '<': return x != null && cmp(x) < cmp(v);
    case '<=': return x != null && cmp(x) <= cmp(v);
    case '>': return x != null && cmp(x) > cmp(v);
    case '>=': return x != null && cmp(x) >= cmp(v);
    case 'in': return (v || []).includes(x);
    case 'not-in': return !(v || []).includes(x);
    case 'array-contains': return Array.isArray(x) && x.includes(v);
    case 'array-contains-any': return Array.isArray(x) && x.some(y => (v || []).includes(y));
    default: return false;
  }
}
function voerUit(q){
  const diepte = q.path.split('/').length + 1;
  let rijen = [];
  for (const [pad, data] of store){
    const ok = q._groep ? pad.split('/').at(-2) === q._groep : (pad.startsWith(q.path + '/') && pad.split('/').length === diepte);
    if (ok && q._filters.every(f => past(pad, data, f))) rijen.push([pad, data]);
  }
  for (const o of [...(q._orde || [])].reverse()){
    rijen.sort((a, b) => { const x = leesPad(a[1], o.veld), y = leesPad(b[1], o.veld); const r = x < y ? -1 : x > y ? 1 : 0; return o.richting === 'desc' ? -r : r; });
  }
  if (Number.isFinite(q._limit)) rijen = rijen.slice(0, q._limit);
  return rijen.map(([pad, data]) => maakSnap(pad, data));
}
function maakSnap(pad, data){
  const ref = new DocRef(pad);
  return { id: ref.id, ref, exists: () => data !== undefined, data: () => (data === undefined ? undefined : kloon(data)), get: k => kloon(leesPad(data || {}, k)), metadata: { fromCache: false, hasPendingWrites: false } };
}
const querySnap = docs => ({ docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f), docChanges: () => docs.map(d => ({ type: 'added', doc: d })), metadata: { fromCache: false } });

/* ---------- lezen ---------- */
export async function getDoc(ref){
  /* de privacy-kennisname geldt voor echte accounts; in de demo slaat toegang.js hem over bij een leesfout */
  if (ref.path.startsWith('privacyKennisname/')){ const e = new Error('demo'); e.code = 'demo/overslaan'; throw e; }
  return maakSnap(ref.path, store.get(ref.path));
}
export const getDocFromCache = getDoc, getDocFromServer = getDoc;
export async function getDocs(q){ return querySnap(voerUit(q)); }
export const getDocsFromCache = getDocs, getDocsFromServer = getDocs;
export async function getCountFromServer(q){ const n = voerUit(q).length; return { data: () => ({ count: n }) }; }
export function onSnapshot(ref, ...args){
  const opties = typeof args[0] === 'object' && args[0] && !args[0].next ? args.shift() : null;
  const obs = typeof args[0] === 'object' && args[0] ? args[0] : { next: args[0], error: args[1] };
  void opties;
  let vorige = null;
  const fire = () => {
    const snap = ref instanceof DocRef ? maakSnap(ref.path, store.get(ref.path)) : querySnap(voerUit(ref));
    const sleutel = JSON.stringify(ref instanceof DocRef ? store.get(ref.path) ?? null : snap.docs.map(d => [d.id, store.get(d.ref.path)]));
    if (sleutel === vorige) return;
    vorige = sleutel;
    try { obs.next && obs.next(snap); } catch (e){ console.error('[demo] listener', e); }
  };
  const l = { fire };
  luisteraars.add(l);
  setTimeout(fire, 0);
  return () => luisteraars.delete(l);
}

/* ---------- schrijven ---------- */
function zet(ref, data, opt){
  if (opt && (opt.merge || opt.mergeFields) && store.has(ref.path)){ const d = store.get(ref.path); mergeDiep(d, data); }
  else store.set(ref.path, pasToe(undefined, data));
  veranderd();
}
function werkBij(ref, a, b){
  const d = store.get(ref.path);
  if (!d){ const e = new Error('Geen document om bij te werken: ' + ref.path); e.code = 'not-found'; throw e; }
  const u = typeof a === 'string' ? { [a]: b } : a;
  for (const [k, v] of Object.entries(u)) zetPad(d, k, v);
  veranderd();
}
export async function setDoc(ref, data, opt){ zet(ref, data, opt); }
export async function updateDoc(ref, a, b){ werkBij(ref, a, b); }
export async function deleteDoc(ref){ store.delete(ref.path); veranderd(); }
export async function addDoc(col, data){ const ref = new DocRef(col.path + '/' + nieuwId()); zet(ref, data); return ref; }
export function writeBatch(){
  const ops = [];
  return {
    set(r, d, o){ ops.push(() => zet(r, d, o)); return this; },
    update(r, a, b){ ops.push(() => werkBij(r, a, b)); return this; },
    delete(r){ ops.push(() => { store.delete(r.path); veranderd(); }); return this; },
    async commit(){ ops.forEach(f => f()); },
  };
}
export async function runTransaction(_db, fn){
  const ops = [];
  const t = {
    get: getDoc,
    set(r, d, o){ ops.push(() => zet(r, d, o)); return t; },
    update(r, a, b){ ops.push(() => werkBij(r, a, b)); return t; },
    delete(r){ ops.push(() => { store.delete(r.path); veranderd(); }); return t; },
  };
  const uit = await fn(t); ops.forEach(f => f()); return uit;
}

/* ---------- inloggen: altijd de demotrainer ---------- */
const DEMO_UID = 'demo-trainer';
const demoUser = {
  uid: DEMO_UID, displayName: 'Demo-trainer', email: 'demo@cluppie.io', emailVerified: true, isAnonymous: false,
  providerData: [{ providerId: 'password' }], metadata: { creationTime: new Date().toUTCString() },
  getIdToken: async () => 'demo', getIdTokenResult: async () => ({ claims: {} }), reload: async () => {},
};
export const auth = { currentUser: demoUser, app: db.app, languageCode: 'nl' };
export const app = db.app;
export function onAuthStateChanged(_a, cb){ setTimeout(() => cb(demoUser), 0); return () => {}; }
export async function signOut(){ location.href = 'over.html'; }
const nietInDemo = naam => async () => { const e = new Error(naam + ' kan niet in de demo'); e.code = 'demo/niet-beschikbaar'; throw e; };
export class GoogleAuthProvider { setCustomParameters(){} addScope(){} }
export class OAuthProvider { constructor(id){ this.providerId = id; } setCustomParameters(){} addScope(){} }
export const signInWithPopup = async () => ({ user: demoUser });
export const signInAnonymously = async () => ({ user: demoUser });
export const signInWithEmailAndPassword = async () => ({ user: demoUser });
export const createUserWithEmailAndPassword = async () => ({ user: demoUser });
export const updateProfile = async () => {};
export const sendPasswordResetEmail = async () => {};
export const sendEmailVerification = async () => {};
export const fetchSignInMethodsForEmail = async () => ['password'];

/* ---------- functions en storage: niet in de demo ---------- */
export const functions = { region: 'demo' };
export function httpsCallable(_f, naam){ return nietInDemo('Deze functie (' + naam + ')'); }
export const STORAGE_BUCKET = 'demo';
export const storage = { bucket: 'demo' };
export const sRef = (_s, pad) => ({ fullPath: pad });
export const uploadBytes = nietInDemo('Uploaden');
export const uploadBytesResumable = () => { throw new Error('Uploaden kan niet in de demo'); };
export const getDownloadURL = nietInDemo('Downloaden');
export const deleteObject = async () => {};

/* ==================== HET VOORBEELDTEAM ====================
   O11-2 van een voorbeeldclub, losse ploeg (geen club gekoppeld), seizoen van
   config.js. Alleen voornamen, zoals in de app. Data volgt dezelfde vorm die de
   app zelf schrijft (zie wedstrijd.js, teams-evaluatie.js, snelstart.js). */
const SEIZOEN = "2025/'26";
const dag = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const TEAM = 'demo-o11-2';
const zetSeed = (pad, data) => store.set(pad, pasToe(undefined, data));

zetSeed(`gebruikers/${DEMO_UID}`, { naam: 'Demo-trainer', email: 'demo@cluppie.io', laatsteLogin: TS });
zetSeed(`gebruikers/${DEMO_UID}/meta/eigenTeam`, { akkoord: true, datum: TS });
zetSeed(`privacyKennisname/${DEMO_UID}`, { versie: 999, datum: TS, akkoord: true });
zetSeed(`teams/${TEAM}`, {
  naam: 'O11-2', categorie: 'JO11', geslacht: 'jongens', format: '8', bouw: 'onder', code: 'DEMO11',
  leden: { [DEMO_UID]: true }, ledenInfo: { [DEMO_UID]: { naam: 'Demo-trainer' } },
  eigenClub: { naam: 'Voorbeeldclub', plaats: 'Utrecht', lat: 52.09, lon: 5.12 },
  gemaakt: TS, spelersAantal: 12,
});
const NAMEN = ['Daan', 'Sem', 'Liam', 'Noah', 'Lucas', 'Finn', 'Milan', 'Levi', 'Bram', 'Jesse', 'Mees', 'Thijs'];
const spelers = NAMEN.map((naam, i) => { const id = `demo-sp-${i + 1}`; zetSeed(`teams/${TEAM}/spelers/${id}`, { naam, nummer: i + 1 }); return id; });

const TEGEN = [['vv De Meern', -27, true, 3, 2], ['SV Houten', -20, false, 1, 1], ['FC Breukelen', -13, true, 4, 1], ['VV Zeist', -6, false, 2, 3], ['DOS Utrecht', 1, true, null, null]];
const leegKwart = () => ({ lineup: {}, events: [], plan: [], correcties: {}, klok: { base: 0, running: false, start: 0 } });
TEGEN.forEach(([tegenstander, d, thuis, voor, tegen], i) => {
  const id = `demo-w-${i + 1}`;
  const kwarten = {}; for (let k = 1; k <= 4; k++) kwarten[k] = leegKwart();
  const goals = [];
  if (voor != null){
    for (let g = 0; g < voor; g++) goals.push({ wie: 'wij', speler: spelers[(g * 3 + i) % 12], kwart: (g % 4) + 1, min: 3 + g * 4 });
    for (let g = 0; g < tegen; g++) goals.push({ wie: 'zij', kwart: ((g + 2) % 4) + 1, min: 6 + g * 3 });
  }
  zetSeed(`teams/${TEAM}/wedstrijden/${id}`, {
    type: 'normaal', tegenstander, thuis, format: '8', periodes: 4, formatie: '3-3-1', datum: dag(d), aftrap: '09:30', kwartduur: 15,
    selectie: spelers, goals, kaarten: [], kwarten, seizoen: SEIZOEN, gemaakt: TS, opzetGedaan: voor != null,
    ...(voor != null ? { uitslag: { voor, tegen }, gespeeld: true } : {}),
  });
});
/* teamevaluaties: samenspel en druk zetten, zoals in het zaterdag-verhaal op de over-pagina */
const reeks = [[3, 2, 3, 3, 4, 3], [3, 3, 3, 2, 4, 4], [4, 3, 4, 3, 5, 4], [4, 4, 4, 2, 4, 4]];
reeks.forEach((r, i) => {
  const [tegenstander, d] = TEGEN[i];
  const [inzet, samenwerking, opbouw, druk, plezier, coachbaar] = r;
  zetSeed(`teams/${TEAM}/teamevaluaties/demo-te-${i + 1}`, {
    wedstrijdId: `demo-w-${i + 1}`, tegenstander, datum: dag(d), seizoen: SEIZOEN,
    scores: { inzet, samenwerking, opbouw, druk, plezier, coachbaar },
    tags: [], notitieGoed: i === 3 ? 'Samenspel loopt steeds beter' : '', notitieAandacht: i === 3 ? 'Druk zetten na balverlies' : '',
    door: { uid: DEMO_UID, naam: 'Demo-trainer' }, gemaaktMs: Date.now() - (4 - i) * 7 * 864e5,
  });
});
/* trainingen op de dinsdag en donderdag */
zetSeed(`teams/${TEAM}/instellingen/trainingsmomenten`, { momenten: [{ dag: 2, tijd: '18:30' }, { dag: 4, tijd: '18:30' }] });

window.__cluppieDemo = { store, uid: DEMO_UID, team: TEAM };
