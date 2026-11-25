/* ==================== TRAININGSBIBLIOTHEEK: BASIS + BEHEERLAAG ====================
   [20261113d] De vormen die Training maken en de seizoensplanning gebruiken komen uit twee lagen:
     1. de basis in de code (trainingsbibliotheek.js, gegenereerd, met versienummer);
     2. de beheerlaag van de platformbeheerder in Firestore: platform/bibliotheek/vormen/{vormId}
        { velden:{…alleen wat afwijkt…}, status:'aan'|'uit', eigen:true|false, gewijzigdDoor, gewijzigdMs }
        Zelfde id als een basisvorm = aanpassing; nieuw id (eigen_…) = eigen vorm.
   De beheerlaag wordt één keer per sessie gelezen (S._bieb, runtime-veld; state.js blijft ongemoeid).
   Zonder beheerlaag (offline, nog niet geladen, fout) werkt alles op de basis.

   Pure functies (voegSamen, valideerVorm, rij/kolommen voor Excel) zijn getest in
   tests/bibliotheek.test.mjs. Impactanalyse: claude/trainingsbibliotheek-beheer-impactanalyse.md. */
import { BIBLIOTHEEK } from './trainingsbibliotheek.js?v=20261121b';
import { SPORTEN, STANDAARD_SPORT, actieveSport } from './sporten.js?v=20261126a';   /* [20261126b] oefenstof per sport */

export const BASIS = BIBLIOTHEEK.vormen;
export const BASIS_VERSIE = BIBLIOTHEEK.versie;
export const FASES = ['warming-up', 'positiespel', 'spelvorm', 'partijspel', 'afsluiting'];
const kloon = x => JSON.parse(JSON.stringify(x));

/* ---------- PURE: opslagvorm [20261116c] ----------
   Firestore kent geen lijsten in lijsten, en de lijnen van een tekening zijn dat wel (punten: [[x,y],[x,y]]).
   De tekening gaat daarom als tekst de database in (velden.tekeningJson) en komt bij het laden terug als object. */
export function veldenNaarOpslag(velden){
  const v = { ...(velden || {}) };
  if (v.tekening !== undefined && v.tekening !== null){ v.tekeningJson = JSON.stringify(v.tekening); }
  delete v.tekening;
  return v;
}
export function veldenUitOpslag(velden){
  const v = { ...(velden || {}) };
  if (typeof v.tekeningJson === 'string'){ try { v.tekening = JSON.parse(v.tekeningJson); } catch (e){ /* onleesbaar: tekening van de basis blijft */ } }
  delete v.tekeningJson;
  return v;
}

/* ---------- PURE: samenvoegen ----------
   Geeft alle vormen met `_status` ('basis' | 'aangepast' | 'eigen' | 'uit') en `_basis` (de basisvorm of null). */
export function voegSamen(basis, overlays){
  const per = new Map(Object.entries(overlays || {}));
  const uit = [];
  for (const v of basis || []){
    const o = per.get(v.id);
    if (!o){ uit.push({ ...v, _status: 'basis', _basis: v }); continue; }
    per.delete(v.id);
    const velden = veldenUitOpslag(kloon(o.velden || {}));
    const samen = { ...v, ...velden, id: v.id };
    const aangepast = Object.keys(velden).length > 0;
    uit.push({ ...samen, _status: o.status === 'uit' ? 'uit' : aangepast ? 'aangepast' : 'basis', _basis: v });
  }
  for (const [id, o] of per){
    if (!o || !o.velden || !o.velden.naam) continue;
    uit.push({ ...veldenUitOpslag(kloon(o.velden)), id, _status: o.status === 'uit' ? 'uit' : 'eigen', _basis: null });
  }
  return uit;
}

/* Alleen de velden die afwijken van de basis (voor opslaan). Eigen vorm: alles. PURE. */
export function verschilMetBasis(vorm, basis){
  const schoon = v => { const c = { ...v }; for (const k of Object.keys(c)) if (k.startsWith('_') || k === 'id') delete c[k]; return c; };
  const nu = schoon(vorm);
  if (!basis) return nu;
  const b = schoon(basis), d = {};
  for (const k of Object.keys(nu)) if (JSON.stringify(nu[k]) !== JSON.stringify(b[k])) d[k] = nu[k];
  return d;
}

/* ---------- PURE: controle, zelfde eisen als de planner-tests ---------- */
export function valideerVorm(v){
  const fouten = [];
  const n = x => typeof x === 'number' && isFinite(x);
  if (!String(v.naam || '').trim()) fouten.push('Naam ontbreekt');
  if (!FASES.includes(v.fase)) fouten.push('Onbekende fase');
  if (!Array.isArray(v.leeftijd) || !n(v.leeftijd[0]) || !n(v.leeftijd[1]) || v.leeftijd[0] > v.leeftijd[1]) fouten.push('Leeftijd van moet kleiner zijn dan tot');
  const sp = v.spelers || {};
  if (!n(sp.min) || !n(sp.max) || sp.min > sp.max || (n(sp.ideaal) && (sp.ideaal < sp.min || sp.ideaal > sp.max))) fouten.push('Spelers: min ≤ ideaal ≤ max');
  if (!v.veld || !n(v.veld.b) || !n(v.veld.l) || v.veld.b < 4 || v.veld.l < 4 || v.veld.b > 120 || v.veld.l > 120) fouten.push('Veld tussen 4 en 120 meter');
  if (!v.duur || !n(v.duur.ronde) || v.duur.ronde <= 0 || v.duur.ronde > 20) fouten.push('Minuten per ronde tussen 1 en 20');
  if (![1, 2, 3].includes(v.intensiteit)) fouten.push('Zwaarte is 1, 2 of 3');
  if (![1, 2, 3].includes(v.complexiteit)) fouten.push('Niveau is 1, 2 of 3');
  /* partijspel en afsluiting passen bij elk thema; de andere fases hebben minstens één thema nodig */
  if (!Array.isArray(v.thema) || (!v.thema.length && !['partijspel', 'afsluiting'].includes(v.fase))) fouten.push('Minstens één thema');
  if (!String(v.doel || '').trim()) fouten.push('Doel ontbreekt');
  /* [20261115a] de 7 vaste velden van de oefenkaart */
  if (v.fase !== 'afsluiting'){
    if (![5, 10, 15, 20].includes(v.tijd)) fouten.push('Tijdbestek is 5, 10, 15 of 20 minuten');
    if (!String(v.uitleg || '').trim() && !(v.organisatie || []).length) fouten.push('Uitleg ontbreekt');
    if (!(v.makkelijker || []).length || !(v.moeilijker || []).length) fouten.push('Differentiatie: makkelijker én moeilijker');
    if (!(v.coachpunten || []).length) fouten.push('Coachmomenten ontbreken');
    if ((v.varianten || []).length < 2) fouten.push('Minstens twee spelvormen');
  }
  return fouten;
}

/* ---------- PURE: Excel (één rij per vorm) ---------- */
export const KOLOMMEN = [
  ['id', 'id'], ['status', 'status'], ['naam', 'naam'], ['fase', 'fase'],
  ['leeftijdVan', v => v.leeftijd?.[0]], ['leeftijdTot', v => v.leeftijd?.[1]],
  ['spelersMin', v => v.spelers?.min], ['spelersIdeaal', v => v.spelers?.ideaal], ['spelersMax', v => v.spelers?.max],
  ['veldBreed', v => v.veld?.b], ['veldLang', v => v.veld?.l], ['tijdbestek', 'tijd'], ['minutenPerRonde', v => v.duur?.ronde],
  ['zwaarte', 'intensiteit'], ['niveau', 'complexiteit'], ['voetbalecht', v => v.voetbalecht ? 'ja' : 'nee'],
  ['thema', v => (v.thema || []).join(', ')], ['pionnen', v => v.materiaal?.pionnen || 0], ['ballen', v => v.materiaal?.ballen || 0],
  ['hesjes', v => v.materiaal?.hesjes || 0], ['doeltjes', v => v.materiaal?.doeltjes || 0],
  ['overigMateriaal', v => (v.materiaalExtra || []).join('\n')],
  ['doel', 'doel'], ['uitleg', 'uitleg'],
  ...['organisatie', 'regels', 'coachpunten', 'coachvragen', 'makkelijker', 'moeilijker', 'letOp', 'lukt'].map(k => [k, v => (v[k] || []).join('\n')]),
  ['spelvormen', v => (v.varianten || []).map(x => `${x.naam}: ${x.uitleg}`).join('\n')],
  /* [20261116i] uitwerking per oefening */
  ['kijkEnGrijpIn', v => alsDanTekst(v.alsDan)], ['telMee', 'meet'], ['spelersAanZet', 'regie'], ['waarom', 'inzicht'],
  ['principes', v => (v.principes || []).join(', ')],
  ['sport', v => vormSport(v)],   /* [20261126b] sportprofiel stap 6 */
];
export const LIJSTVELDEN = ['organisatie', 'regels', 'coachpunten', 'coachvragen', 'makkelijker', 'moeilijker', 'letOp', 'lukt'];
/* Kijk en grijp in: één regel per paar, "wat je ziet → wat je doet". */
export const alsDanTekst = (a) => (a || []).map(x => `${x.zie} → ${x.doe}`).join('\n');
export const alsDanUitTekst = (t) => String(t ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(r => { const i = r.search(/→|=>|->/); return i > 0 ? { zie: r.slice(0, i).trim(), doe: r.slice(i).replace(/^(→|=>|->)\s*/, '').trim() } : { zie: r, doe: '' }; });
export function rijVan(v){
  const status = v._status === 'uit' ? 'uit' : 'aan';
  return Object.fromEntries(KOLOMMEN.map(([k, f]) => [k, k === 'status' ? status : typeof f === 'function' ? f(v) : v[f]]));
}
/* Rij uit Excel → vorm (bovenop `oud`, zodat velden die Excel niet kent, zoals de tekening, blijven). */
export function vormUitRij(r, oud = {}){
  const getal = x => (x === '' || x == null) ? undefined : Number(x);
  const lijst = x => String(x ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const v = kloon(oud || {});
  for (const k of Object.keys(v)) if (k.startsWith('_')) delete v[k];
  const zet = (k, w) => { if (w !== undefined) v[k] = w; };
  zet('naam', r.naam != null ? String(r.naam).trim() : undefined);
  zet('fase', r.fase != null ? String(r.fase).trim() : undefined);
  v.leeftijd = [getal(r.leeftijdVan) ?? v.leeftijd?.[0], getal(r.leeftijdTot) ?? v.leeftijd?.[1]];
  v.spelers = { ...(v.spelers || {}), min: getal(r.spelersMin) ?? v.spelers?.min, ideaal: getal(r.spelersIdeaal) ?? v.spelers?.ideaal, max: getal(r.spelersMax) ?? v.spelers?.max };
  v.veld = { ...(v.veld || {}), b: getal(r.veldBreed) ?? v.veld?.b, l: getal(r.veldLang) ?? v.veld?.l };
  v.duur = { ...(v.duur || { rondes: [2, 3], rust: 1 }), ronde: getal(r.minutenPerRonde) ?? v.duur?.ronde };
  zet('intensiteit', getal(r.zwaarte)); zet('complexiteit', getal(r.niveau));
  if (r.voetbalecht != null && r.voetbalecht !== '') v.voetbalecht = /^(ja|true|1|waar)$/i.test(String(r.voetbalecht).trim());
  if (r.thema != null) v.thema = String(r.thema).split(',').map(s => s.trim()).filter(Boolean);
  v.materiaal = { ...(v.materiaal || {}), pionnen: getal(r.pionnen) ?? v.materiaal?.pionnen ?? 0, ballen: getal(r.ballen) ?? v.materiaal?.ballen ?? 0,
    hesjes: getal(r.hesjes) ?? v.materiaal?.hesjes ?? 0, doeltjes: getal(r.doeltjes) ?? v.materiaal?.doeltjes ?? 0 };
  if (r.doel != null) v.doel = String(r.doel).trim();
  if (r.uitleg != null) v.uitleg = String(r.uitleg).trim();
  for (const k of LIJSTVELDEN) if (r[k] != null) v[k] = lijst(r[k]);
  if (r.tijdbestek != null && r.tijdbestek !== '') v.tijd = getal(r.tijdbestek);
  if (r.overigMateriaal != null){ const x = lijst(r.overigMateriaal); if (x.length || v.materiaalExtra) v.materiaalExtra = x; }
  if (r.kijkEnGrijpIn != null) v.alsDan = alsDanUitTekst(r.kijkEnGrijpIn);
  for (const [kol, k] of [['telMee', 'meet'], ['spelersAanZet', 'regie'], ['waarom', 'inzicht']]) if (r[kol] != null){ const w = String(r[kol]).trim(); if (w || v[k]) v[k] = w; }
  if (r.sport != null && String(r.sport).trim()){ const sp = String(r.sport).trim().toLowerCase(); if (SPORTEN[sp] && sp !== STANDAARD_SPORT) v.sport = sp; else if (sp === STANDAARD_SPORT) delete v.sport; }
  if (r.principes != null) v.principes = String(r.principes).split(',').map(s => s.trim()).filter(Boolean);
  if (r.spelvormen != null) v.varianten = lijst(r.spelvormen).map(x => { const i = x.indexOf(':'); return i > 0 ? { naam: x.slice(0, i).trim(), uitleg: x.slice(i + 1).trim() } : { naam: x, uitleg: '' }; });
  if (!Array.isArray(v.domeinen)) v.domeinen = [];
  return v;
}
/* Import vergelijken met de huidige bibliotheek. PURE.
   Geeft [{ id, naam, soort:'gewijzigd'|'nieuw'|'status'|'fout'|'gelijk', velden:[], fouten:[], vorm, status }] */
export function vergelijkImport(rijen, huidig, maakId = (n, i) => 'eigen_' + String(n || 'vorm').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '_' + i){
  const per = new Map((huidig || []).map(v => [v.id, v]));
  return (rijen || []).filter(r => r && (r.id || r.naam)).map((r, i) => {
    const oud = r.id ? per.get(String(r.id).trim()) : null;
    if (r.id && !oud) return { id: String(r.id), naam: r.naam || '', soort: 'fout', fouten: ['Onbekend id'], velden: [] };
    const vorm = vormUitRij(r, oud || {});
    const fouten = valideerVorm(vorm);
    const status = String(r.status || 'aan').trim().toLowerCase() === 'uit' ? 'uit' : 'aan';
    if (!oud) return { id: maakId(r.naam, i), naam: vorm.naam, soort: fouten.length ? 'fout' : 'nieuw', fouten, velden: [], vorm, status };
    const velden = Object.keys(verschilMetBasis(vorm, oud));
    const statusWissel = (oud._status === 'uit') !== (status === 'uit');
    const soort = fouten.length ? 'fout' : velden.length ? 'gewijzigd' : statusWissel ? 'status' : 'gelijk';
    return { id: oud.id, naam: vorm.naam, soort, fouten, velden, vorm, status };
  });
}

/* ---------- runtime ---------- */
let laden = null;
const staat = () => (globalThis.__cluppieBieb ||= { overlays: {}, geladen: false, alle: null });
export function zetOverlays(overlays){ const s = staat(); s.overlays = overlays || {}; s.geladen = true; s.alle = null; }
export function alleVormen(){ const s = staat(); return s.alle || (s.alle = voegSamen(BASIS, s.overlays)); }
/* Wat de planner mag kiezen: zonder uitgezette vormen. */
/* [20261126b] alleen de oefenstof van de sport van het team (zonder veld: voetbal) */
export const vormSport = v => (v && SPORTEN[v.sport] ? v.sport : STANDAARD_SPORT);
export function vormen(){ const sp = actieveSport(); return alleVormen().filter(v => v._status !== 'uit' && vormSport(v) === sp); }
/* Opzoeken op id, ook als de vorm uitstaat (bewaarde trainingen blijven openen). */
export function vormOpId(id){ return alleVormen().find(v => v.id === id) || null; }
export function bibliotheekGeladen(){ return staat().geladen; }
export async function laadBibliotheek(forceer = false){
  if (staat().geladen && !forceer) return alleVormen();
  if (laden && !forceer) return laden;
  laden = (async () => {
    try {
      const { db, collection, getDocs } = await import('./firebase.js?v=20261011g');
      const snap = await getDocs(collection(db, 'platform', 'bibliotheek', 'vormen'));
      const o = {}; snap.docs.forEach(d => { o[d.id] = d.data(); });
      zetOverlays(o);
    } catch (e){ console.warn('[bibliotheek] beheerlaag niet geladen, basis wordt gebruikt', e?.code || e?.message); staat().geladen = true; }
    laden = null;
    return alleVormen();
  })();
  return laden;
}
