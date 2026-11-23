// Verhuizing ASV'33 → cluppie.io: de regels, los van Firebase (getest in tests/verhuis-asv33.test.mjs).
// Het script tools/verhuis-asv33.mjs gebruikt deze functies; zie VERHUIZING-ASV33.md voor de volgorde.

/* ---------- Welke collecties ---------- */
/* Collecties die één op één meegaan (zelfde pad, zelfde document-id's, met alle subcollecties). */
export const KOPIEER = ['clubs', 'teams', 'trainingen', 'videos', 'documenten', 'berichten', 'beoordelingenPrive',
  'gebruikers', 'hulpDeel', 'trainingDeel', 'gebruik', 'gebruikstats', 'navpaden', 'logins'];
/* Bewust niet mee:
   - trainingToegang: hangt aan anonieme sessies van ouders (deellink); die krijgen op het nieuwe adres
     vanzelf een nieuwe sessie en de toegang verloopt toch na korte tijd. */
export const SLA_OVER = ['trainingToegang'];
/* 'content' is in ASV'33 de inhoud van de club zelf; in cluppie.io is de collectie 'content' de gedeelde
   Cluppie-standaard en staat eigen inhoud van een club in clubs/{clubId}/content. */
export const NAAR_CLUB = ['content'];

/* Pad in het doel voor een pad in de bron; null = niet kopiëren. `clubId` = de club waar 'content' heen gaat. */
export function doelPad(pad, { clubId, uidMap = {} } = {}){
  const d = pad.split('/');
  const top = d[0];
  if (SLA_OVER.includes(top)) return null;
  if (NAAR_CLUB.includes(top)){
    if (!clubId) return null;
    return ['clubs', clubId, ...d].join('/');
  }
  if (!KOPIEER.includes(top)) return null;
  /* document-id's die een account-id zijn (gebruikers/{uid}, …/gelezen, clubs/x/speelstijlRondes/y/antwoorden/{uid}) */
  return d.map((deel, i) => (i % 2 === 1 && uidMap[deel]) ? uidMap[deel] : deel).join('/');
}

/* ---------- Accounts ---------- */
/* Anoniem = geen e-mail en geen inlogmethode: sessies van ouders op een deel- of hulplink. Gaan niet mee. */
export function isAnoniem(u){
  return !u.email && !(u.providerData || []).some(p => p.providerId && p.providerId !== 'anonymous') && !u.phoneNumber;
}
export const heeftWachtwoord = u => (u.providerData || []).some(p => p.providerId === 'password');

/* Eén account uit de bron → record voor importUsers. Het wachtwoord gaat mee als hash + salt. */
export function importRecord(u){
  const r = { uid: u.uid };
  for (const k of ['email', 'displayName', 'photoURL', 'phoneNumber']) if (u[k]) r[k] = u[k];
  r.emailVerified = !!u.emailVerified;
  r.disabled = !!u.disabled;
  const m = u.metadata || {};
  if (m.creationTime || m.lastSignInTime) r.metadata = { ...(m.creationTime ? { creationTime: m.creationTime } : {}), ...(m.lastSignInTime ? { lastSignInTime: m.lastSignInTime } : {}) };
  const prov = (u.providerData || []).filter(p => p.providerId && p.providerId !== 'password' && p.providerId !== 'anonymous')
    .map(p => { const o = { uid: p.uid, providerId: p.providerId }; for (const k of ['email', 'displayName', 'photoURL']) if (p[k]) o[k] = p[k]; return o; });
  if (prov.length) r.providerData = prov;
  if (u.passwordHash){ r.passwordHash = Buffer.from(u.passwordHash, 'base64'); if (u.passwordSalt) r.passwordSalt = Buffer.from(u.passwordSalt, 'base64'); }
  if (u.customClaims && Object.keys(u.customClaims).length) r.customClaims = u.customClaims;
  return r;
}

const klein = s => String(s || '').trim().toLowerCase();
/* Verdeel de accounts uit de bron.
   doelOpUid:   Map uid → account in het doel
   doelOpEmail: Map e-mail (kleine letters) → account in het doel
   doelOpProvider: Map "providerId|uid bij de provider" → account in het doel (Google-accounts)
   Uit: { importeer:[…], bijwerken:[…], dubbel:[{bron,doel,reden}], anoniem:n, zonderHash:[…], uidMap:{bronUid: doelUid} } */
export function planAccounts(bron, { doelOpUid = new Map(), doelOpEmail = new Map(), doelOpProvider = new Map() } = {}){
  const uit = { importeer: [], bijwerken: [], dubbel: [], anoniem: 0, zonderHash: [], uidMap: {} };
  for (const u of bron){
    if (isAnoniem(u)){ uit.anoniem++; continue; }
    const zelfde = doelOpUid.get(u.uid);
    if (zelfde){
      /* zelfde id en e-mailadres: door een eerdere run gezet; blijft zoals het is */
      if (klein(zelfde.email) === klein(u.email)){ uit.bijwerken.push(u); continue; }
      uit.dubbel.push({ bron: u, doel: zelfde, reden: 'zelfde account-id, ander e-mailadres' }); continue;
    }
    let ander = u.email ? doelOpEmail.get(klein(u.email)) : null, reden = 'e-mailadres bestaat al in het doel';
    if (!ander) for (const p of (u.providerData || [])){
      const x = p.providerId !== 'password' ? doelOpProvider.get(p.providerId + '|' + p.uid) : null;
      if (x){ ander = x; reden = `${p.providerId}-account is al gekoppeld in het doel`; break; }
    }
    if (ander){ uit.dubbel.push({ bron: u, doel: ander, reden }); uit.uidMap[u.uid] = ander.uid; continue; }
    if (heeftWachtwoord(u) && !u.passwordHash) uit.zonderHash.push(u);
    uit.importeer.push(u);
  }
  return uit;
}

/* ---------- Bestanden ---------- */
/* Naam van een bestand in de doel-bucket. In ASV'33 staan veldfoto's onder veldfotos/{club}/…, in cluppie.io
   onder clubs/{club}/veldfotos/… (alles onder clubs/{clubId}/, zo zijn de Storage-rules opgezet). */
export function bestandDoelNaam(naam){
  const m = /^veldfotos\/([^/]+)\/(.+)$/.exec(naam);
  return m ? `clubs/${m[1]}/veldfotos/${m[2]}` : naam;
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- Waarden omzetten ---------- */
/* Maakt de functie die elke waarde van een document omzet:
   - account-id's van dubbele accounts (uidMap) als hele tekst, als sleutel van een map en als deel van een pad;
   - downloadlinks en gs://-verwijzingen naar de oude bucket → de nieuwe bucket (alleen als `bucketNaar` is gezet);
   - paden van veldfoto's.
   `soort(v)` zegt of een object een Firestore-type is dat ongemoeid moet blijven (Timestamp, GeoPoint, …)
   of een documentverwijzing ('ref', dan komt `maakRef(pad)` eraan te pas). */
export function maakOmzetter({ uidMap = {}, bucketsVan = [], bucketNaar = '', soort = () => null, maakRef = null, padOpties = {} } = {}){
  const heeftUids = Object.keys(uidMap).length > 0;
  const bucketRe = bucketNaar && bucketsVan.length ? new RegExp(bucketsVan.map(reEsc).join('|'), 'g') : null;
  const tekst = s => {
    if (heeftUids && uidMap[s]) return uidMap[s];
    let t = s;
    if (bucketRe && bucketRe.test(t)){ bucketRe.lastIndex = 0; t = t.replace(bucketRe, bucketNaar); }
    if (t.includes('veldfotos')){
      if (/^veldfotos\/[^/]+\/.+/.test(t)) t = bestandDoelNaam(t);
      /* in een downloadlink is het pad gecodeerd: …/o/veldfotos%2F{club}%2F… */
      t = t.replace(/\/o\/veldfotos%2F([^%/?]+)%2F/g, '/o/clubs%2F$1%2Fveldfotos%2F');
    }
    return t;
  };
  const zet = v => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') return tekst(v);
    if (typeof v !== 'object') return v;
    const s = soort(v);
    if (s === 'ref'){ const p = doelPad(v.path, padOpties); return p && maakRef ? maakRef(p) : v; }
    if (s) return v;
    if (Array.isArray(v)) return v.map(zet);
    const o = {};
    for (const [k, x] of Object.entries(v)) o[heeftUids && uidMap[k] ? uidMap[k] : k] = zet(x);
    return o;
  };
  return zet;
}

/* ---------- Club inrichten ---------- */
/* Vult het clubdocument aan zodat de club in cluppie.io werkt zoals in de eigen omgeving.
   Bestaande keuzes blijven staan: alleen wat ontbreekt wordt gezet.
   `sjabloon` = tools/verhuis-asv33/club-asv33.json; `teams` = [{id, leden:{uid:true}}] van deze club.
   Uit: de velden voor update() (punt-notatie), leeg = niets te doen. */
const isObj = x => x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
/* b over a heen, per niveau (b wint) */
function diepSamen(a, b){
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) o[k] = isObj(v) && isObj(o[k]) ? diepSamen(o[k], v) : v;
  return o;
}
export function clubAanvulling(club, sjabloon, teams = []){
  const uit = {};
  const inst = club.instellingen || {};
  if (!inst.v){
    uit.instellingen = { ...diepSamen(sjabloon.instellingen || {}, inst), v: 1 };
  } else if ((inst.toegang || {}).vasteCodes === false){
    /* de oude team- en clubcodes moeten blijven werken (links en codes die al rondgaan) */
    uit['instellingen.toegang.vasteCodes'] = true;
  }
  const pm = club.platformModules || {};
  for (const [k, v] of Object.entries(sjabloon.platformModules || {})) if (pm[k] === undefined) uit['platformModules.' + k] = v;
  /* iedereen die in een team van de club zit, hoort ook bij de club te staan (de rules lezen clubs/{id}.leden) */
  const leden = club.leden || {};
  for (const t of teams) for (const [uid, aan] of Object.entries(t.leden || {})) if (aan === true && leden[uid] !== true) uit['leden.' + uid] = true;
  return uit;
}

/* ---------- Vergelijken ---------- */
/* Vaste tekstvorm van een waarde, om bron en doel te vergelijken (sleutels gesorteerd). */
export function vasteVorm(v, soortTekst = () => null){
  if (v === null || v === undefined) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v);
  const s = soortTekst(v);
  if (s !== null) return s;
  if (Array.isArray(v)) return '[' + v.map(x => vasteVorm(x, soortTekst)).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + vasteVorm(v[k], soortTekst)).join(',') + '}';
}
