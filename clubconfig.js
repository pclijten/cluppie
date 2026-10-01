/* ==================== CLUBCONFIG ====================
   [20260929c] Eén plek die per club bepaalt hoe Cluppie eruitziet en zich
   gedraagt: identiteit (naam, afkorting, logo, kleur), locatie (plaats, weer,
   KNVB-district), pedagogiek (formatie, namen), lijsten (tags, redenen,
   domeinen, leercurve …), regels (tijdstraf, bouwgrenzen, drempels) en AI.

   Bron: clubs/{clubId}.instellingen  (bewerkt in js/club-instellingen.js).
   Schema, versie 1:

   instellingen: {
     v: 1,
     identiteit:  { afkorting, logo, kleur, kompasNaam, beleidsplanNaam },
     locatie:     { plaats, lat, lon, district },
     pedagogiek:  { formatie11 },
     lijsten:     { <sleutel>: { items:{ <id>: {…velden, uit?} }, extra:[{id,…}] } },
     regels:      { tijdstraf, bouwGrenzen, dashboard, maxVideoMB },
     modules:     { standaard: { <module>: false } },
     ai:          { aan, maandLimiet }
   }

   Werking: config.js bevat de STANDAARD-lijsten. pasClubConfigToe(club) zet die
   terug op de originele waarden en legt daar de club-aanpassingen overheen —
   IN PLAATS (arrays/objecten worden gewijzigd, niet vervangen), zodat alle
   modules die ze importeren automatisch de juiste waarden zien zonder aanpassing.

   LEGACY: een club-document zonder instellingen.v krijgt (alleen als de naam met
   "ASV" begint) de vroegere ASV'33-waarden, zodat er voor die club niets
   verandert totdat de beheerder ze in Instellingen "vastlegt". Elke andere
   club zonder instellingen krijgt de neutrale standaard. */
import { S, clubAfkorting } from './state.js?v=20260929z';
import * as C from './config.js?v=20260929z';
import { db, doc, getDoc } from './firebase.js?v=20260922c';
import { zetContentClub } from './content.js?v=20260929z';

/* ---------- Standaardwaarden ---------- */
export const NEUTRAAL = Object.freeze({
  v: 1,
  identiteit: { afkorting: '', logo: '', kleur: '#e2342f', kompasNaam: 'Club-kompas', beleidsplanNaam: 'jeugdbeleidsplan' },
  locatie: { plaats: '', lat: null, lon: null, district: 'zuid' },
  pedagogiek: { formatie11: '', contentStandaard: true },
  lijsten: {},
  regels: {},
  modules: { standaard: {} },
  ai: { aan: true, maandLimiet: null },
});
/* De waarden die vóór deze release hard in de code stonden. */
export const LEGACY_ASV = Object.freeze({
  v: 1,
  identiteit: { afkorting: 'ASV', logo: 'icons/asv-schild.png', kleur: '#e2342f', kompasNaam: 'ASV-kompas', beleidsplanNaam: 'jeugdbeleidsplan' },
  locatie: { plaats: 'Aarle-Rixtel', lat: 51.52, lon: 5.62, district: 'zuid' },
  pedagogiek: { formatie11: '4-3-3' },
});
const LEGACY_HERKENNING = /^\s*asv\b/i;
export const CLUPPIE_LOGO = 'icons/icon-192.png';
export const DISTRICTEN = [
  { id: 'zuid',   naam: 'Zuid I / Zuid II', ingebouwd: true },
  { id: 'eigen',  naam: 'Ander district (eigen kalender importeren)', ingebouwd: false },
];

/* ---------- Definities van de bewerkbare lijsten (gedeeld met de UI) ---------- */
export const LIJST_DEFS = {
  skills: {
    titel: 'Ontwikkeldomeinen', bron: 'skills', idKey: 'id', toevoegen: false, uitzetten: false,
    uitleg: 'De vijf domeinen van de beoordeling. Naam, kleur en omschrijving pas je aan; het aantal ligt vast omdat radars en spelerskaarten op vijf assen zijn gebouwd.',
    velden: [ {k:'naam',l:'Naam',t:'tekst',max:24}, {k:'kort',l:'Korte naam',t:'tekst',max:12}, {k:'emoji',l:'Emoji',t:'emoji'}, {k:'kleur',l:'Kleur',t:'kleur'}, {k:'omschrijving',l:'Omschrijving',t:'lang',max:160} ],
    label: x => x.naam,
  },
  leercurve: {
    titel: 'Leercurve-thema’s', bron: 'leercurve', idKey: 'thema', toevoegen: true, uitzetten: true, naamIsId: true,
    uitleg: 'De leerthema’s met de leeftijd waarop ze aan gaan. De themanaam is de koppeling met leerpunten en content en kan daarom niet gewijzigd worden; wel de leeftijd en het domein.',
    velden: [ {k:'vanaf',l:'Vanaf O-leeftijd',t:'getal',min:4,max:19}, {k:'domein',l:'Domein',t:'domein'} ],
    label: x => x.thema,
  },
  snelTags: {
    titel: 'Snelle spelertags', bron: 'snelTags', idKey: 'id', toevoegen: true, uitzetten: true, icoPrefix: ['tag-'],
    uitleg: 'De “opvallend”-tags die een coach na een wedstrijd of training bij een speler aantikt.',
    velden: [ {k:'label',l:'Tekst',t:'tekst',max:28}, {k:'emoji',l:'Emoji',t:'emoji'}, {k:'ico',l:'Icoon',t:'ico'} ],
    label: x => x.label,
  },
  teamTags: {
    titel: 'Teamtags', bron: 'teamTags', idKey: 'id', toevoegen: true, uitzetten: true, icoPrefix: ['tag-'],
    uitleg: 'De “opvallend”-tags bij de teamevaluatie na een wedstrijd.',
    velden: [ {k:'label',l:'Tekst',t:'tekst',max:32}, {k:'emoji',l:'Emoji',t:'emoji'}, {k:'ico',l:'Icoon',t:'ico'} ],
    label: x => x.label,
  },
  teamCategorieen: {
    titel: 'Teamevaluatie-categorieën', bron: 'teamCategorieen', idKey: 'id', toevoegen: true, uitzetten: true, minActief: 3,
    uitleg: 'De onderdelen waarop een team na een wedstrijd wordt beoordeeld. Er blijven er minstens drie actief. Koppel een categorie aan een leercurve-thema voor automatisch trainingsadvies.',
    velden: [ {k:'naam',l:'Naam',t:'tekst',max:40}, {k:'leercurve',l:'Leercurve-thema',t:'thema'} ],
    label: x => x.naam,
  },
  wisselRedenen: {
    titel: 'Wisselredenen', bron: 'wisselRedenen', idKey: 'id', toevoegen: true, uitzetten: true, icoPrefix: ['reason-', 'tag-', 'football-', 'admin-'],
    uitleg: 'Optionele reden bij een wissel.',
    velden: [ {k:'label',l:'Tekst',t:'tekst',max:24}, {k:'emoji',l:'Emoji',t:'emoji'}, {k:'ico',l:'Icoon',t:'ico'} ],
    label: x => x.label,
  },
  afwezigRedenen: {
    titel: 'Afwezigheidsredenen', bron: 'afwezigRedenen', idKey: 'id', toevoegen: true, uitzetten: true, vast: ['anders'], icoPrefix: ['reason-', 'tag-'],
    uitleg: 'Redenen bij afwezigheid (wedstrijd en training). “Anders” blijft altijd beschikbaar.',
    velden: [ {k:'label',l:'Tekst',t:'tekst',max:24}, {k:'emoji',l:'Emoji',t:'emoji'}, {k:'ico',l:'Icoon',t:'ico'} ],
    label: x => x.label,
  },
  docCategorieen: {
    titel: 'Documentcategorieën', bron: 'docCategorieen', idKey: 'id', toevoegen: true, uitzetten: true, vast: ['overig'],
    uitleg: 'De indeling van de documenten die de club met teams deelt. “Overig” blijft altijd bestaan.',
    velden: [ {k:'naam',l:'Naam',t:'tekst',max:24} ],
    label: x => x.naam,
  },
  bouwen: {
    titel: 'Standaardbouwen', bron: 'bouwen', idKey: 'id', toevoegen: false, uitzetten: false,
    uitleg: 'De namen van de drie standaardbouwen. De leeftijdsgrenzen stel je in onder Regels.',
    velden: [ {k:'naam',l:'Naam',t:'tekst',max:24}, {k:'kort',l:'Korte naam',t:'tekst',max:12} ],
    label: x => x.naam,
  },
};

/* ---------- Originelen (diepe kopie van config.js bij het laden) ---------- */
const klon = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const ORIG = {
  skills: klon(C.SKILLS), leercurve: klon(C.LEERCURVE), snelTags: klon(C.SNEL_TAGS), teamTags: klon(C.TEAM_TAGS),
  teamCategorieen: klon(C.TEAM_CATEGORIEEN), wisselRedenen: klon(C.WISSEL_REDENEN), afwezigRedenen: klon(C.AFWEZIG_REDENEN),
  bouwen: klon(C.BOUWEN), docCategorieen: klon(C.DOC_CATEGORIEEN), niveaus: klon(C.NIVEAUS), doelBanden: klon(C.DOEL_SUGGESTIES_BANDEN),
  catJ: klon(C.CATEGORIEEN), catM: klon(C.CATEGORIEEN_MEIDEN), kalender: klon(C.KNVB_KALENDER),
};
export const ORIGINEEL = ORIG;
const DOELARRAYS = {
  skills: C.SKILLS, leercurve: C.LEERCURVE, snelTags: C.SNEL_TAGS, teamTags: C.TEAM_TAGS, teamCategorieen: C.TEAM_CATEGORIEEN,
  wisselRedenen: C.WISSEL_REDENEN, afwezigRedenen: C.AFWEZIG_REDENEN, bouwen: C.BOUWEN, docCategorieen: C.DOC_CATEGORIEEN,
};

/* ---------- Kleine helpers ---------- */
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
function diep(basis, over){
  const uit = klon(basis) || {};
  if (!isObj(over)) return uit;
  for (const [k, v] of Object.entries(over)){
    if (isObj(v) && isObj(uit[k])) uit[k] = diep(uit[k], v);
    else if (v !== undefined) uit[k] = klon(v);
  }
  return uit;
}
const HEX = /^#[0-9a-fA-F]{6}$/;
const veiligKleur = (k, terug) => (typeof k === 'string' && HEX.test(k)) ? k : terug;
const veiligUrl = u => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  if (/^https:\/\//i.test(s)) return s;
  if (/^icons\/[A-Za-z0-9._-]+$/.test(s)) return s;
  return '';
};
function donker(hex){   // voor de tweede tint (--grass-2): iets donkerder
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.round(c * 0.82)).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

/* ---------- Effectieve instellingen van een club-document ---------- */
export function effectief(club){
  const i = club && club.instellingen;
  if (i && i.v) return diep(NEUTRAAL, i);
  if (club && LEGACY_HERKENNING.test(club.naam || '')) return diep(NEUTRAAL, diep(LEGACY_ASV, i || {}));
  return diep(NEUTRAAL, i || {});
}
/* Heeft dit club-document nog geen eigen (vastgelegde) instellingen? */
export function isLegacy(club){ return !(club && club.instellingen && club.instellingen.v); }

/* ---------- Samenvoegen van lijsten ---------- */
export function mergeLijst(orig, patch, idKey, vast = []){
  const items = (patch && patch.items) || {};
  const alle = orig.map(o => {
    const p = items[o[idKey]] || {};
    return { ...o, ...stripUit(p), _uit: !!p.uit && !vast.includes(o[idKey]) };
  });
  for (const e of ((patch && patch.extra) || [])){
    if (!e || !e[idKey]) continue;
    alle.push({ ...stripUit(e), _extra: true, _uit: !!e.uit });
  }
  return alle;
}
const stripUit = p => { const { uit, ...rest } = p || {}; return rest; };
const schoon = x => { const { _uit, _extra, ...rest } = x; return rest; };

/* ---------- Actieve toestand ---------- */
let HUIDIG = null;          // { clubId, naam, eff }
let _sig = null;
const LOGO_CACHE = {};      // clubId → logo-src (van elke club waarvan we het document zagen)
const NAAM_CACHE = {};
/* Eerste paint (nog geen club-document binnen): het merk van de laatst gebruikte club. */
try {
  const m = JSON.parse(localStorage.getItem('cluppieMerk') || 'null');
  if (m && m.clubId){ LOGO_CACHE[m.clubId] = veiligUrl(m.logo) || CLUPPIE_LOGO; NAAM_CACHE[m.clubId] = m.naam || ''; }
} catch (e) {}

export function huidigeClubId(){ return HUIDIG ? HUIDIG.clubId : null; }
export function cfg(){ return HUIDIG ? HUIDIG.eff : diep(NEUTRAAL, {}); }

/* Zet alles terug op de standaard en legt de club-aanpassingen erover. */
export function pasClubConfigToe(club){
  if (!club || !club.id) return;
  const eff = effectief(club);
  const sig = club.id + '|' + (club.naam || '') + '|' + JSON.stringify(eff);
  LOGO_CACHE[club.id] = veiligUrl(eff.identiteit.logo) || CLUPPIE_LOGO;
  NAAM_CACHE[club.id] = club.naam || '';
  if (sig === _sig) return;
  _sig = sig;
  HUIDIG = { clubId: club.id, naam: club.naam || '', eff };

  /* lijsten */
  const L = eff.lijsten || {};
  for (const [sleutel, def] of Object.entries(LIJST_DEFS)){
    const alle = mergeLijst(ORIG[def.bron], L[sleutel], def.idKey, def.vast || []);
    C.ALLE_LIJSTEN[def.bron] = alle.map(schoon);
    let actief = alle.filter(x => !x._uit).map(schoon);
    if (def.minActief && actief.length < def.minActief) actief = alle.map(schoon).slice(0, Math.max(def.minActief, actief.length));
    const doel = DOELARRAYS[def.bron];
    doel.length = 0; doel.push(...actief);
  }

  /* niveaus (1..5): label/kort/kleur */
  const nv = (L.niveaus && L.niveaus.items) || {};
  for (let n = 1; n <= 5; n++) C.NIVEAUS[n] = { ...ORIG.niveaus[n], ...stripUit(nv[n] || {}) , n };
  C.NIVEAUS[0] = null;

  /* doelsuggesties per leeftijdsband */
  const db_ = (L.doelBanden && L.doelBanden.items) || {};
  ORIG.doelBanden.forEach((b, i) => {
    const t = db_[b.tot] && Array.isArray(db_[b.tot].teksten) && db_[b.tot].teksten.length ? db_[b.tot].teksten : b.teksten;
    C.DOEL_SUGGESTIES_BANDEN[i].teksten = klon(t);
  });

  /* categorieën (speeltijden/formats), jongens en meiden */
  const cp = L.categorieen || {};
  const cItems = cp.items || {};
  const alleCat = {};
  const bouwMap = (orig, doelObj, geslacht) => {
    for (const k of Object.keys(doelObj)) delete doelObj[k];
    for (const [k, v] of Object.entries(orig)){
      const p = cItems[k] || {};
      const m = { ...v, ...stripUit(p) };
      alleCat[k] = m;
      if (!p.uit) doelObj[k] = m;
    }
    for (const e of (cp.extra || [])){
      if (!e || !e.key || (e.geslacht || 'j') !== geslacht) continue;
      const { key, geslacht: _g, uit, ...rest } = e;
      alleCat[key] = rest;
      if (!uit) doelObj[key] = rest;
    }
  };
  bouwMap(ORIG.catJ, C.CATEGORIEEN, 'j');
  bouwMap(ORIG.catM, C.CATEGORIEEN_MEIDEN, 'm');
  C.ALLE_LIJSTEN.categorieen = alleCat;

  /* regels */
  const R = eff.regels || {};
  Object.assign(C.ACTIEF.tijdstraf, C.ACTIEF_STANDAARD.tijdstraf, R.tijdstraf || {});
  Object.assign(C.ACTIEF.bouwGrenzen, C.ACTIEF_STANDAARD.bouwGrenzen, R.bouwGrenzen || {});
  Object.assign(C.ACTIEF.dashboard, C.ACTIEF_STANDAARD.dashboard, R.dashboard || {});
  C.ACTIEF.maxVideoMB = Number(R.maxVideoMB) > 0 ? Number(R.maxVideoMB) : C.ACTIEF_STANDAARD.maxVideoMB;
  C.ACTIEF.formatie11 = String((eff.pedagogiek && eff.pedagogiek.formatie11) || '').trim();

  /* modules-standaard voor teams zonder eigen keuze (zie modAan in state.js) */
  S._modulesStandaard = (eff.modules && eff.modules.standaard) || {};

  /* content: eigen clubteksten lezen (en de standaard al dan niet meenemen) */
  zetContentClub(club.id, eff.pedagogiek.contentStandaard !== false);

  /* uiterlijk + cache voor het loginscherm */
  zetKleur(veiligKleur(eff.identiteit.kleur, '#e2342f'));
  bewaarMerk(club.id, club.naam, eff);

  /* KNVB-kalender: standaard (Zuid) of eigen import van de club */
  zetKalender(club.id, eff);

  try { document.dispatchEvent(new CustomEvent('clubconfig', { detail: { clubId: club.id } })); } catch (e) {}
}

function zetKleur(hex){
  const st = document.documentElement.style;
  if (hex === '#e2342f'){ st.removeProperty('--accent'); st.removeProperty('--grass'); st.removeProperty('--grass-2'); return; }
  st.setProperty('--accent', hex); st.setProperty('--grass', hex); st.setProperty('--grass-2', donker(hex));
}

/* ---------- Loginscherm-branding (vóór het inloggen is de club nog onbekend) ---------- */
const LS_MERK = 'cluppieMerk';
function bewaarMerk(clubId, naam, eff){
  try {
    localStorage.setItem(LS_MERK, JSON.stringify({
      clubId, naam: naam || '', logo: veiligUrl(eff.identiteit.logo) || '', kleur: veiligKleur(eff.identiteit.kleur, '#e2342f'),
    }));
    localStorage.setItem('cluppieLaatsteClub', clubId);
  } catch (e) { /* privémodus / vol: dan gewoon zonder cache */ }
}

/* ---------- KNVB-kalender ---------- */
const KAL_KOLOMMEN = ['pup', 'jun', 'sen', 'mei'];
function kalenderZet(bron, label, soort){
  for (const k of KAL_KOLOMMEN){ C.KNVB_KALENDER[k] = klon(bron[k] || []); }
  C.ACTIEF.kalender.seizoen = label; C.ACTIEF.kalender.bron = soort;
}
async function zetKalender(clubId, eff){
  const district = (eff.locatie && eff.locatie.district) || 'zuid';
  if (district === 'zuid'){ kalenderZet(ORIG.kalender, C.KNVB_SEIZOEN, 'standaard'); C.ACTIEF.kalender.district = 'zuid'; }
  else { kalenderZet({}, '', 'ontbreekt'); C.ACTIEF.kalender.district = district; }
  /* een door de club zelf geïmporteerde kalender (clubs/{id}/kalender/huidig) gaat altijd voor;
     alleen clubs buiten Zuid hebben er een nodig */
  try {
    const snap = await getDoc(doc(db, 'clubs', clubId, 'kalender', 'huidig'));
    if (snap.exists() && HUIDIG && HUIDIG.clubId === clubId){
      const d = snap.data();
      kalenderZet(d, d.label || 'eigen kalender', 'club');
    }
  } catch (e) { /* geen rechten of offline: de standaard (of lege) kalender blijft staan */ }
  herteken();
}
export async function herlaadKalender(){ if (HUIDIG) await zetKalender(HUIDIG.clubId, HUIDIG.eff); }
function herteken(){
  try { if (S.teamId && !S.wedstrijdId && typeof S._navRerender === 'function') S._navRerender(); } catch (e) {}
}
/* Valideert en schrijft een geïmporteerde kalender (zie club-instellingen.js). */
export function valideerKalender(obj){
  if (!isObj(obj)) return 'Geen geldig JSON-object';
  let n = 0;
  for (const k of KAL_KOLOMMEN){
    const rijen = obj[k];
    if (rijen === undefined) continue;
    if (!Array.isArray(rijen)) return `“${k}” moet een lijst zijn`;
    for (const r of rijen){
      if (!isObj(r) || !/^\d{4}-\d{2}-\d{2}$/.test(r.d || '')) return `Ongeldige datum in “${k}” (verwacht JJJJ-MM-DD)`;
      if (!['wd', 'beker', 'inhaal', 'vrij'].includes(r.t)) return `Onbekend type “${r.t}” in “${k}” (wd, beker, inhaal of vrij)`;
      if (!String(r.l || '').trim()) return `Label ontbreekt bij ${r.d}`;
      n++;
    }
  }
  return n ? '' : 'De kalender bevat geen dagen';
}

/* ---------- Publieke helpers ---------- */
export function clubAfk(club){
  let naam, eff;
  if (club){ naam = club.naam; eff = effectief(club); }
  else if (HUIDIG){ naam = HUIDIG.naam; eff = HUIDIG.eff; }
  else return '';
  const ingesteld = String((eff.identiteit && eff.identiteit.afkorting) || '').trim();
  return ingesteld || clubAfkorting(naam);   // zonder instelling: afgeleid uit de clubnaam
}
export function clubNaamNu(){ return HUIDIG ? HUIDIG.naam : ''; }
export function kompasNaam(){ return (cfg().identiteit.kompasNaam || 'Club-kompas').trim(); }
export function beleidsplanNaam(){ return (cfg().identiteit.beleidsplanNaam || 'jeugdbeleidsplan').trim(); }
export function aiAan(){ return cfg().ai.aan !== false; }
export function weerSleutel(){ const l = weerLocatie(); return l ? `${l.lat},${l.lon}` : ''; }
export function weerLocatie(){
  const l = cfg().locatie;
  const lat = Number(l.lat), lon = Number(l.lon);
  return (l.plaats && Number.isFinite(lat) && Number.isFinite(lon) && l.lat !== null && l.lon !== null) ? { plaats: l.plaats, lat, lon } : null;
}
/* Logo van de actieve club, of van een andere club waarvan we het document zagen. */
export function logoSrc(clubId){
  if (clubId && LOGO_CACHE[clubId]) return LOGO_CACHE[clubId];
  if (!clubId && HUIDIG) return LOGO_CACHE[HUIDIG.clubId] || CLUPPIE_LOGO;
  return CLUPPIE_LOGO;
}
/* Club waarvan we het merk tonen als er geen specifieke club in beeld is (startscherm). */
export function primaireClubId(){
  if (HUIDIG) return HUIDIG.clubId;
  try { return localStorage.getItem('cluppieLaatsteClub') || null; } catch (e) { return null; }
}
/* Logo-<img> rechtstreeks uit een club-document (bv. in de lijst "Clubs die je beheert"). */
export function logoImgVoorDoc(club, klasse){
  const eff = effectief(club);
  const src = veiligUrl(eff.identiteit.logo) || CLUPPIE_LOGO;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<img src="${esc(src)}" alt="${esc(club.naam || '')}" class="${esc(klasse || '')}">`;
}
export function logoImg(klasse, clubId){
  const naam = clubId ? (NAAM_CACHE[clubId] || '') : (HUIDIG ? HUIDIG.naam : '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<img src="${esc(logoSrc(clubId))}" alt="${esc(naam)}" class="${esc(klasse || '')}">`;
}
/* Voorbeeldnaam voor placeholders, bv. "ASV JO11-2" of "Jouw club JO11-2". */
export function voorbeeldTegenstander(cat){
  const af = clubAfk() || (HUIDIG && HUIDIG.naam) || 'Club';
  return `${af} ${cat || 'JO11'}-2`;
}
export function voorbeeldTeamcode(){ return `${clubAfk() || 'CLUB'}JO11-1`; }
/* De eigen clubnaam genormaliseerd (alleen a-z0-9, kleine letters), om hem uit
   tegenstandernamen te halen zodat "ASV'33 JO11-2" en "jo11 2" als dezelfde
   tegenstander gelden. Vroeger stond hier hard /asv'?33/. */
export function eigenClubTokens(){
  const woorden = String(HUIDIG ? HUIDIG.naam : '').toLowerCase().split(/\s+/).filter(Boolean);
  const norm = a => a.join('').replace(/[^a-z0-9]+/g, '');
  const set = new Set([norm(woorden), norm(woorden.slice(0, 1)), norm(woorden.slice(0, 2))]);
  const af = String(clubAfk() || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (af.length >= 3) set.add(af);
  return [...set].filter(t => t.length >= 2).sort((a, b) => b.length - a.length);
}

/* ---------- Platform-instellingen (wie clubs mag aanmaken) ---------- */
export async function laadPlatformConfig(){
  try {
    const snap = await getDoc(doc(db, 'platform', 'instellingen'));
    if (snap.exists() && Array.isArray(snap.data().beheerders)) S._platformBeheerders = snap.data().beheerders;
  } catch (e) { /* nog geen document of geen rechten: de fallback in state.js geldt */ }
}

/* ---------- Icoonkeuze voor eigen tags/redenen ---------- */
export { ICOONNAMEN } from './icons.js?v=20260922c';
