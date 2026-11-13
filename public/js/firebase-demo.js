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
export function onAuthStateChanged(_a, cb){ klaar.then(() => cb(demoUser)); return () => {}; }
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
/* een paar functies geven in de demo een gewoon antwoord; de rest meldt dat het niet kan */
const DEMO_ANTWOORD = {
  sluitAan: () => ({ ok: true }), aggregeerGebruik: () => ({ ok: true }), leerSignaal: () => ({ ok: true }),
  sportlinkSyncNu: () => ({ teams: 8, gematcht: 8, wedstrijden: 40, totaalWedstrijden: 40 }),
};
export function httpsCallable(_f, naam){
  return DEMO_ANTWOORD[naam] ? async () => ({ data: DEMO_ANTWOORD[naam]() }) : nietInDemo('Deze functie (' + naam + ')');
}
export const STORAGE_BUCKET = 'demo';
export const storage = { bucket: 'demo' };
export const sRef = (_s, pad) => ({ fullPath: pad });
export const uploadBytes = nietInDemo('Uploaden');
export const uploadBytesResumable = () => { throw new Error('Uploaden kan niet in de demo'); };
export const getDownloadURL = nietInDemo('Downloaden');
export const deleteObject = async () => {};

/* ==================== DE DEMOCLUB "cluppie.io" ====================
   Een volledige fictieve club: acht teams over drie bouwen. De demotrainer is clubbeheerder,
   bouwcoördinator van alle bouwen, trainingscoördinator én trainer van O11-2 en O13-1.
   Per team: spelers (alleen voornamen), een poule met stand, uitslagen en programma zoals de
   Sportlink-sync die schrijft, wedstrijden (gespeelde met doelpunten en opstelling, komende om
   voor te bereiden), teamevaluaties, spelersbeoordelingen en trainingen uit de eigen bibliotheek.
   Plus een uitlening tussen O11-1 en O11-2. Alles is verzonnen. */
const SEIZOEN = "2025/'26";
const CLUB = 'demo-cluppie-io', CLUBNAAM = 'cluppie.io';
const zetSeed = (pad, data) => store.set(pad, pasToe(undefined, data));
const isoDag = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dag = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return isoDag(d); };
/* zaterdagen rond vandaag: zaterdag(0) = komende zaterdag (of vandaag als het zaterdag is) */
const zaterdag = k => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + 7 * k); return isoDag(d); };
let zaad = 20261113;
const rnd = () => { zaad = (zaad * 1664525 + 1013904223) % 4294967296; return zaad / 4294967296; };
const kies = a => a[Math.floor(rnd() * a.length)];
const schud = a => [...a].map(x => [rnd(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

const COACH = DEMO_UID, INFO = { naam: 'Demo-trainer' }, DOOR = { uid: COACH, naam: 'Demo-trainer' };
zetSeed(`gebruikers/${COACH}`, { naam: 'Demo-trainer', email: 'demo@cluppie.io', laatsteLogin: TS });
zetSeed(`gebruikers/${COACH}/meta/eigenTeam`, { akkoord: true, datum: TS });

zetSeed(`clubs/${CLUB}`, {
  naam: CLUBNAAM, code: 'CLUPPIE', plaats: 'Utrecht', huidigSeizoen: SEIZOEN,
  admins: { [COACH]: true }, adminsInfo: { [COACH]: INFO },
  bouwCoordinatoren: { onder: { [COACH]: true }, midden: { [COACH]: true }, boven: { [COACH]: true } },
  bouwCoordinatorenInfo: { onder: { [COACH]: INFO }, midden: { [COACH]: INFO }, boven: { [COACH]: INFO } },
  trainingscoordinatoren: { [COACH]: true }, trainingscoordinatorenInfo: { [COACH]: INFO },
  ledenInfo: { [COACH]: INFO }, gemaakt: TS, sportlinkClientId: 'demo', sportlinkClubcode: 'DEMO123',
  instellingen: { identiteit: { kleur: '#E20613' }, privacy: { contactEmail: 'privacy@cluppie.io', verwerkersovereenkomst: { geaccepteerd: true, datum: TS } } },
});

const COLLEGA = ['Anouk', 'Jeroen', 'Fatima', 'Kees', 'Sanne', 'Ahmed', 'Petra', 'Martijn'];
const TEAMS = [
  { id: 'demo-o9-1',   naam: 'O9-1',   cat: 'JO9',  bouw: 'onder',  format: '6' },
  { id: 'demo-o11-1',  naam: 'O11-1',  cat: 'JO11', bouw: 'onder',  format: '8' },
  { id: 'demo-o11-2',  naam: 'O11-2',  cat: 'JO11', bouw: 'onder',  format: '8', eigen: true },
  { id: 'demo-o13-1',  naam: 'O13-1',  cat: 'JO13', bouw: 'midden', format: '8', eigen: true },
  { id: 'demo-mo13-1', naam: 'MO13-1', cat: 'MO13', bouw: 'midden', format: '8', meiden: true },
  { id: 'demo-o15-1',  naam: 'O15-1',  cat: 'JO15', bouw: 'midden', format: '11' },
  { id: 'demo-o17-1',  naam: 'O17-1',  cat: 'JO17', bouw: 'boven',  format: '11' },
  { id: 'demo-o19-1',  naam: 'O19-1',  cat: 'JO19', bouw: 'boven',  format: '11' },
];
const JONGENS = ['Daan', 'Sem', 'Liam', 'Noah', 'Lucas', 'Finn', 'Milan', 'Levi', 'Bram', 'Jesse', 'Mees', 'Thijs', 'Luuk', 'Julian', 'Ruben', 'Sven', 'Max', 'Gijs', 'Jayden', 'Owen', 'Tijn', 'Siem', 'Hugo', 'Teun', 'Morris', 'Stijn', 'Ties', 'Olivier', 'Mats', 'Jens'];
const MEIDEN = ['Emma', 'Julia', 'Tess', 'Sophie', 'Zoë', 'Mila', 'Sara', 'Evi', 'Lotte', 'Nina', 'Fleur', 'Saar', 'Noor', 'Isa', 'Roos'];
const TEGENCLUBS = ['vv De Meern', 'SV Houten', 'FC Breukelen', 'VV Zeist', 'DOS Utrecht', 'Kampong', 'Odijk', 'SV Vleuten', 'USV Hercules', 'FC Maarssen'];
const SPELERS_PER_FORMAT = { '6': 9, '8': 12, '11': 15 };
const POSITIES = ['K', 'V', 'V', 'V', 'M', 'M', 'M', 'A', 'A'];
const leegKwart = () => ({ lineup: {}, events: [], plan: [], correcties: {}, klok: { base: 0, running: false, start: 0 } });
const RONDES = [-4, -3, -2, -1, 0];      // zaterdagen: vier gespeeld, één komend

TEAMS.forEach((t, ti) => {
  zetSeed(`teams/${t.id}`, {
    naam: t.naam, categorie: t.cat, geslacht: t.meiden ? 'meiden' : 'jongens', format: t.format, bouw: t.bouw,
    code: 'CL' + t.naam.replace(/\W/g, ''), club: CLUB, clubNaam: CLUBNAAM, sportlinkNaam: `${CLUBNAAM} ${t.naam}`,
    leden: { [`demo-coach-${ti}`]: true, ...(t.eigen ? { [COACH]: true } : {}) },
    ledenInfo: { [`demo-coach-${ti}`]: { naam: COLLEGA[ti] }, ...(t.eigen ? { [COACH]: INFO } : {}) }, gemaakt: TS, trainingsdagen: [2, 4],
    trainingsmomenten: [{ dag: 2, start: '18:00', eind: '19:15' }, { dag: 4, start: '18:00', eind: '19:15' }],
  });
  /* spelers */
  const namen = schud(t.meiden ? MEIDEN : JONGENS).slice(0, SPELERS_PER_FORMAT[t.format]);
  const spelers = namen.map((naam, i) => {
    const id = `${t.id}-sp${i + 1}`;
    zetSeed(`teams/${t.id}/spelers/${id}`, { naam, nummer: i + 1, positie: POSITIES[i % POSITIES.length] });
    return id;
  });
  t.spelers = spelers; t.namen = namen;

  /* poule van zes, enkele competitie: vijf speelrondes (rond-robin) */
  const eigenNaam = `${CLUBNAAM} ${t.naam}`, basis = t.naam.replace(/-\d$/, '');
  const ploegen = [eigenNaam, ...schud(TEGENCLUBS).slice(0, 5).map(c => `${c} ${basis}-${1 + Math.floor(rnd() * 3)}`)];
  const codes = Object.fromEntries(ploegen.map((p, i) => [p, `${ti + 1}${i + 1}0${ti}`]));
  const rij = [0, 1, 2, 3, 4, 5], wedstrijden = [];
  for (let r = 0; r < 5; r++){
    for (let k = 0; k < 3; k++){
      const a = ploegen[rij[k]], b = ploegen[rij[5 - k]];
      const [thuis, uit] = (r + k) % 2 === 0 ? [a, b] : [b, a];
      const gespeeld = RONDES[r] < 0;
      wedstrijden.push({ ronde: r, datum: zaterdag(RONDES[r]), tijd: ['09:00', '10:30', '12:00'][k], thuis, uit,
        doelThuis: gespeeld ? Math.floor(rnd() * 5) : null, doelUit: gespeeld ? Math.floor(rnd() * 4) : null, code: `${8000 + ti * 100 + r * 10 + k}` });
    }
    rij.splice(1, 0, rij.pop());
  }
  const stand = Object.fromEntries(ploegen.map(p => [p, { team: p, gespeeld: 0, gewonnen: 0, gelijk: 0, verloren: 0, doelpuntenVoor: 0, doelpuntenTegen: 0 }]));
  for (const w of wedstrijden.filter(w => w.doelThuis != null)){
    const h = stand[w.thuis], u = stand[w.uit];
    h.gespeeld++; u.gespeeld++; h.doelpuntenVoor += w.doelThuis; h.doelpuntenTegen += w.doelUit; u.doelpuntenVoor += w.doelUit; u.doelpuntenTegen += w.doelThuis;
    if (w.doelThuis > w.doelUit){ h.gewonnen++; u.verloren++; } else if (w.doelThuis < w.doelUit){ u.gewonnen++; h.verloren++; } else { h.gelijk++; u.gelijk++; }
  }
  const standRijen = Object.values(stand)
    .map(s => ({ ...s, saldo: s.doelpuntenVoor - s.doelpuntenTegen, punten: s.gewonnen * 3 + s.gelijk, verliespunten: s.verloren * 3 + s.gelijk, eigen: s.team === eigenNaam }))
    .sort((a, b) => b.punten - a.punten || b.saldo - a.saldo || b.doelpuntenVoor - a.doelpuntenVoor)
    .map((s, i) => ({ positie: i + 1, ...s }));
  const pouleRij = w => ({ datum: w.datum, tijd: w.tijd, thuis: w.thuis, uit: w.uit, thuisCode: codes[w.thuis], uitCode: codes[w.uit],
    uitslag: w.doelThuis != null ? `${w.doelThuis}-${w.doelUit}` : null, code: w.code, eigenErin: w.thuis === eigenNaam || w.uit === eigenNaam });
  const poulecode = `D${ti + 1}24`, bij = { bijgewerkt: TS, bron: 'sportlink' };
  zetSeed(`teams/${t.id}/poule/stand`, { rijen: standRijen, poulecode, klassepoule: `${basis} 3e klasse, poule D`, ...bij });
  zetSeed(`teams/${t.id}/poule/uitslagen`, { rijen: wedstrijden.filter(w => w.doelThuis != null).map(pouleRij).reverse(), poulecode, ...bij });
  zetSeed(`teams/${t.id}/poule/programma`, { rijen: wedstrijden.map(pouleRij), poulecode, ...bij });

  /* eigen wedstrijden, zoals de Sportlink-sync ze aanmaakt; gespeelde met doelpunten en opstelling */
  const periodes = t.format === '11' ? 2 : 4, duur = t.format === '11' ? 35 : t.format === '6' ? 12.5 : 15;
  const formatie = { '6': '2-1-2', '8': '3-3-1', '11': '4-3-3' }[t.format];
  for (const w of wedstrijden.filter(w => w.thuis === eigenNaam || w.uit === eigenNaam)){
    const thuis = w.thuis === eigenNaam, tegenstander = thuis ? w.uit : w.thuis, wid = `${t.id}-w${w.code}`;
    const kwarten = {}; for (let k = 1; k <= periodes; k++) kwarten[k] = leegKwart();
    const goals = [];
    if (w.doelThuis != null){
      const voor = thuis ? w.doelThuis : w.doelUit, tegenD = thuis ? w.doelUit : w.doelThuis;
      for (let g = 0; g < voor; g++) goals.push({ type: 'voor', pid: kies(spelers.slice(3)), kwart: 1 + Math.floor(rnd() * periodes), sec: Math.floor(rnd() * duur * 60), ...(rnd() < 0.5 ? { assist: kies(spelers.slice(2)) } : {}) });
      for (let g = 0; g < tegenD; g++) goals.push({ type: 'tegen', pid: null, kwart: 1 + Math.floor(rnd() * periodes), sec: Math.floor(rnd() * duur * 60) });
    }
    /* opstelling per periode op de plekken van de formatie (K, V1, M1, A1 …), zoals bouwSlots in config.js:
       vaste keeper, de veldspelers rouleren zodat de speeltijd eerlijk verdeeld is.
       Ook de komende wedstrijd heeft al een opstelling, zodat de voorbereiding compleet is. */
    {
      const plekken = ['K', ...formatie.split('-').flatMap((n, i) => Array.from({ length: Number(n) }, (_, j) => 'VMA'[i] + (j + 1)))];
      const veldspelers = spelers.slice(1), vrij = plekken.length - 1, stap = Math.max(1, veldspelers.length - vrij);
      for (let k = 1; k <= periodes; k++){
        const start = ((k - 1 + w.ronde) * stap) % veldspelers.length;
        const rij = veldspelers.slice(start).concat(veldspelers.slice(0, start)).slice(0, vrij);
        kwarten[k].lineup = Object.fromEntries([['K', spelers[0]], ...rij.map((pid, i) => [plekken[i + 1], pid])]);
      }
    }
    zetSeed(`teams/${t.id}/wedstrijden/${wid}`, {
      type: 'normaal', tegenstander, thuis, format: t.format, periodes, formatie, datum: w.datum, aftrap: w.tijd, kwartduur: duur,
      selectie: spelers, goals, kaarten: [], kwarten, seizoen: SEIZOEN, gemaakt: TS, opzetGedaan: true,
      bron: 'sportlink', sportlinkCode: w.code, competitie: `${basis} 3e klasse`, sportlinkSync: TS,
      info: { accommodatie: thuis ? 'Sportpark Cluppie, Utrecht' : `Sportpark ${tegenstander.split(' ').slice(0, -1).join(' ')}` },
    });
    if (w.doelThuis != null){
      const b = 2 + Math.min(2, w.ronde * 0.6);
      const s = x => Math.max(1, Math.min(5, Math.round(b + x + (rnd() - 0.5))));
      zetSeed(`teams/${t.id}/teamevaluaties/${t.id}-te${w.code}`, {
        wedstrijdId: wid, tegenstander, datum: w.datum, seizoen: SEIZOEN,
        scores: { inzet: s(1), samenwerking: s(0.5), taken: s(0), opbouw: s(0.2), omschakeling: s(-0.3), druk: s(-0.8), plezier: s(1.2), coachbaar: s(0.8) },
        tags: [], notitieGoed: w.ronde >= 3 ? 'Samenspel loopt steeds beter' : '', notitieAandacht: w.ronde >= 3 ? 'Druk zetten na balverlies' : '',
        door: DOOR, gemaaktMs: Date.parse(w.datum) + 36e5 * 4,
      });
    }
  }
  /* spelersbeoordelingen: een volledige meting per speler en een paar snelle */
  spelers.forEach((pid, i) => {
    const sc = () => 2 + Math.floor(rnd() * 3);
    zetSeed(`teams/${t.id}/beoordelingen/${pid}-vol`, { soort: 'volledig', spelerId: pid, datum: dag(-30 - i), seizoen: SEIZOEN,
      scores: { TE: sc(), TA: sc(), FY: sc(), ME: sc(), GE: sc() }, notities: {}, door: DOOR, gemaaktMs: Date.now() - (30 + i) * 864e5 });
    if (i % 2 === 0) zetSeed(`teams/${t.id}/beoordelingen/${pid}-snel`, { soort: 'snel', spelerId: pid, datum: zaterdag(-1), seizoen: SEIZOEN,
      bron: { type: 'los' }, niveau: 3 + Math.floor(rnd() * 3), tags: [], notities: { algemeen: '' }, door: DOOR, gemaaktMs: Date.now() - 6 * 864e5 });
  });
});

zetSeed(`clubs/${CLUB}`, { ...store.get(`clubs/${CLUB}`), teams: Object.fromEntries(TEAMS.map(t => [t.id, true])) });

/* uitlening: een speler van O11-1 speelt ook mee bij O11-2 */
{
  const van = TEAMS.find(t => t.id === 'demo-o11-1'), naar = TEAMS.find(t => t.id === 'demo-o11-2');
  zetSeed(`clubs/${CLUB}/uitleningen/demo-leen-1`, {
    spelerId: van.spelers[4], vanTeam: van.id, vanTeamNaam: van.naam, naarTeam: naar.id, naarTeamNaam: naar.naam,
    overlay: {}, snapshot: { naam: van.namen[4], achternaam: null, nummer: 5, positie: 'M', leerpunten: [] }, door: COACH, gemaakt: TS,
  });
}

/* trainingen: per team twee per week (vorige, deze en volgende week) uit de eigen bibliotheek */
async function zetTrainingen(){
  const [{ BIBLIOTHEEK }, { vormSvg }] = await Promise.all([import('./trainingsbibliotheek.js'), import('./trainingsvorm-svg.js')]);
  const vormen = BIBLIOTHEEK.vormen;
  const lijst = (kop, items) => (Array.isArray(items) && items.length ? [{ kop, type: 'lijst', items: items.map(String) }] : []);
  const oefening = (v, slot, minuten) => ({
    titel: v.naam,
    blokken: [{ kop: 'Tijd en groepen', type: 'tekst', tekst: `${minuten} minuten · ${slot}` }, ...(v.uitleg ? [{ kop: 'Uitleg', type: 'tekst', tekst: v.uitleg }] : []),
      ...lijst('Organisatie', v.organisatie), ...lijst('Regels', v.regels), ...lijst('Coachpunten', v.coachpunten), ...lijst('Coachvragen', v.coachvragen),
      ...lijst('Makkelijker', v.makkelijker), ...lijst('Moeilijker', v.moeilijker)],
    svg: v.tekening ? vormSvg(v, v.veld) : '', bron: { vormId: v.id, slot, minuten, spelers: null },
  });
  const THEMAS = ['Positiespel opbouw', 'Storen en veroveren', 'Scoren', 'Uitspelen 1:1', 'Teamsport en plezier'];
  for (const t of TEAMS){
    const lft = Number(t.cat.replace(/\D/g, ''));
    const passend = fase => vormen.filter(v => v.fase === fase && lft >= v.leeftijd[0] && lft <= v.leeftijd[1]);
    const alle = vormen.filter(v => lft >= v.leeftijd[0] && lft <= v.leeftijd[1]);
    const wu = passend('warming-up'), kern = passend('spelvorm').length ? passend('spelvorm') : alle, partij = passend('partij').length ? passend('partij') : kern;
    for (let week = -1; week <= 1; week++){
      for (const wd of [2, 4]){
        const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (wd - 1) + 7 * week);
        const thema = kies(THEMAS);
        const oefeningen = [[kies(wu.length ? wu : alle), 'Warming-up', 15], [kies(kern), 'Kernvorm 1', 20], [kies(kern), 'Kernvorm 2', 20], [kies(partij), 'Partij', 20]]
          .filter(([v]) => v).map(([v, s, m]) => oefening(v, s, m));
        const k = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); k.setUTCDate(k.getUTCDate() + 4 - (k.getUTCDay() || 7));
        const isoWeek = Math.ceil(((k - Date.UTC(k.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
        const id = `${t.id}-tr-${isoDag(d)}`;
        zetSeed(`trainingen/${id}`, {
          id, club: CLUB, clubNaam: CLUBNAAM, teams: [t.id], week: `Week ${isoWeek}`, seizoenJaar: k.getUTCFullYear(), trainingsdag: wd, datum: isoDag(d),
          titel: `${thema} · 75 min`, thema, duur: 75, bron: 'seizoensplan', url: '', diagramUrls: {}, oefeningen,
          vormIds: [...new Set(oefeningen.map(o => o.bron.vormId))], gemaakt: TS, door: 'Demo-trainer',
        });
      }
    }
  }
}
const klaar = zetTrainingen().catch(e => console.warn('[demo] trainingen niet gezet', e));

window.__cluppieDemo = { store, uid: DEMO_UID, club: CLUB };
