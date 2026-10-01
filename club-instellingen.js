/* ==================== CLUB-INSTELLINGEN (schermen + wizard) ====================
   [20260929c] Alles wat een clubbeheerder per club kan instellen, in de browser:
   Identiteit · Competitie · Pedagogiek · Lijsten · Regels · AI & modules, plus de
   wizard om een nieuwe club aan te maken. De waarden staan in
   clubs/{id}.instellingen en worden door clubconfig.js toegepast (schema daar).

   Opslaan: elke kaart heeft een eigen Opslaan-knop. Bewerkingen worden in een
   concept (DRAFT) bewaard, zodat een live-herrender van het clubscherm (er
   luistert een snapshot) niets kwijtmaakt. Bij een club die nog geen
   instellingen.v heeft (legacy) worden bij de eerste wijziging eerst alle
   huidige waarden vastgelegd, zodat er niets verspringt. */
import {
  db, doc, collection, addDoc, updateDoc, setDoc, deleteDoc, getDocs, query, where, writeBatch, serverTimestamp
} from './firebase.js?v=20260922c';
import { S, $, esc, meld, openModal, sluitModal, nieuweCode } from './state.js?v=20260929z';
import { SEIZOEN_FALLBACK, parseFormatie, aantalVeldspelers, SKILLS, LEERCURVE } from './config.js?v=20260929z';
import {
  effectief, isLegacy, mergeLijst, LIJST_DEFS, ORIGINEEL, NEUTRAAL, CLUPPIE_LOGO, ICOONNAMEN,
  valideerKalender, herlaadKalender, pasClubConfigToe, clubAfk
} from './clubconfig.js?v=20260929z';
import { MODULE_DEFS } from './club-beheer.js?v=20260929z';

/* ---------- Tabs ---------- */
export const INSTEL_TABS = [
  ['algemeen', 'Algemeen'], ['identiteit', 'Identiteit'], ['competitie', 'Competitie'], ['sportlink', 'Sportlink'],
  ['pedagogiek', 'Pedagogiek'], ['lijsten', 'Lijsten'], ['regels', 'Regels'], ['ai', 'AI & modules'], ['beheer', 'Beheerders'],
];
export const NIEUWE_TABS = new Set(['identiteit', 'competitie', 'pedagogiek', 'lijsten', 'regels', 'ai']);

/* ---------- Kleine helpers ---------- */
const klon = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const veldGroep = (label, html, hint) =>
  `<div class="veldgroep"><label>${label}</label>${html}${hint ? `<p class="cb-uitleg" style="margin:6px 0 0">${hint}</p>` : ''}</div>`;
const kaart = (titel, icoon, inhoud, extra = '') =>
  `<div class="cb-kaart" ${extra}><div class="cb-kaart-kop">${icoon || ''}<b>${titel}</b></div>${inhoud}</div>`;
function zetPad(obj, pad, waarde){
  const delen = pad.split('.');
  let o = obj;
  for (let i = 0; i < delen.length - 1; i++){ if (typeof o[delen[i]] !== 'object' || o[delen[i]] === null) o[delen[i]] = {}; o = o[delen[i]]; }
  o[delen[delen.length - 1]] = waarde;
}
export function seizoenVoorDatum(d = new Date()){
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;     // seizoen start in augustus
  return `${y}/'${String(y + 1).slice(-2)}`;
}
function afkVoorstel(naam){
  const woorden = String(naam || '').replace(/['’.]/g, ' ').split(/[\s-]+/).filter(Boolean);
  if (!woorden.length) return '';
  const eerste = woorden[0].replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
  if (eerste.length >= 2 && eerste === eerste.toUpperCase() && /[A-Z]/.test(eerste)) return eerste.slice(0, 6);
  return woorden.map(w => w[0]).join('').toUpperCase().slice(0, 6);
}

/* ---------- Opslaan in clubs/{id}.instellingen ---------- */
/* wijz: [[pad, waarde], …] met pad relatief aan instellingen, bv. 'identiteit.kleur'.
   Lijsten worden altijd als geheel geschreven (pad 'lijsten.<sleutel>'): themanamen
   bevatten spaties en dubbele punten en kunnen geen onderdeel van een veldpad zijn. */
export async function bewaar(wijz){
  const club = S.club;
  if (!club || !S.clubId) throw new Error('Geen club geopend');
  if (isLegacy(club)){
    const eff = effectief(club);
    for (const [pad, w] of wijz) zetPad(eff, pad, w);
    eff.v = 1;
    await updateDoc(doc(db, 'clubs', S.clubId), { instellingen: eff });
    club.instellingen = eff;
  } else {
    const upd = {};
    for (const [pad, w] of wijz) upd['instellingen.' + pad] = w;
    if (Object.keys(upd).length) await updateDoc(doc(db, 'clubs', S.clubId), upd);
    club.instellingen = klon(club.instellingen || {});
    for (const [pad, w] of wijz) zetPad(club.instellingen, pad, w);
  }
  pasClubConfigToe(club);
}
async function vangFout(knop, fn){
  const orig = knop ? knop.textContent : '';
  if (knop){ knop.disabled = true; knop.textContent = 'Bezig…'; }
  try { await fn(); }
  catch (e){ console.error('[Cluppie] instelling opslaan mislukt', e); meld('Opslaan mislukt: ' + (e.code || e.message)); }
  finally { if (knop){ knop.disabled = false; knop.textContent = orig; } }
}

/* ---------- Logo: verkleinen tot een klein bestand in het club-document ---------- */
export function verwerkLogo(file){
  return new Promise((ok, fout) => {
    if (!file || !/^image\//.test(file.type)) return fout(new Error('Kies een afbeelding (PNG, JPG, WebP of SVG)'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let max = 192, kwal = 0.9, uit = '';
        for (let poging = 0; poging < 4; poging++){
          const schaal = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
          const w = Math.max(1, Math.round((img.naturalWidth || max) * schaal)), h = Math.max(1, Math.round((img.naturalHeight || max) * schaal));
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          uit = cv.toDataURL('image/webp', kwal);
          if (!uit.startsWith('data:image/webp')) uit = cv.toDataURL('image/png');
          if (uit.length <= 90000) break;
          max = Math.round(max * 0.75); kwal -= 0.1;
        }
        URL.revokeObjectURL(url);
        if (uit.length > 120000) return fout(new Error('Het logo is te gedetailleerd; kies een eenvoudiger afbeelding'));
        ok(uit);
      } catch (e){ fout(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); fout(new Error('Deze afbeelding kon niet gelezen worden')); };
    img.src = url;
  });
}

/* ---------- Plaats opzoeken (coördinaten voor het weer) ---------- */
async function zoekPlaats(q){
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=nl&format=json`);
  if (!r.ok) throw new Error('Zoeken mislukt');
  const d = await r.json();
  return (d.results || []).map(x => ({
    plaats: x.name, lat: Math.round(x.latitude * 1000) / 1000, lon: Math.round(x.longitude * 1000) / 1000,
    toelichting: [x.admin1, x.country].filter(Boolean).join(', '),
  }));
}
function plaatsZoeker(prefix, huidig){
  return `
    <div class="tok-invoer"><input type="text" id="${prefix}Zoek" placeholder="Zoek een plaats, bv. Helmond" value="${esc(huidig || '')}" autocomplete="off" spellcheck="false">
      <button type="button" id="${prefix}ZoekKnop">Zoek</button></div>
    <div id="${prefix}Resultaten" style="margin-top:8px"></div>`;
}
function koppelPlaatsZoeker(v, prefix, bijKeuze){
  const zoek = v.querySelector('#' + prefix + 'Zoek'), knop = v.querySelector('#' + prefix + 'ZoekKnop'), uit = v.querySelector('#' + prefix + 'Resultaten');
  if (!zoek || !knop) return;
  const doe = async () => {
    const q = zoek.value.trim();
    if (q.length < 2) return meld('Typ minstens 2 letters');
    knop.disabled = true; uit.innerHTML = '<p class="cb-uitleg">Zoeken…</p>';
    try {
      const res = await zoekPlaats(q);
      uit.innerHTML = res.length
        ? res.map((r, i) => `<button type="button" class="lijst-item" data-plaats="${i}" style="margin-bottom:6px"><div class="li-tekst"><div class="titel">${esc(r.plaats)}</div><div class="meta">${esc(r.toelichting)}</div></div><span class="pijl">›</span></button>`).join('')
        : '<p class="cb-uitleg">Niets gevonden. Probeer een andere schrijfwijze.</p>';
      uit.querySelectorAll('[data-plaats]').forEach(b => b.onclick = () => bijKeuze(res[Number(b.dataset.plaats)]));
    } catch (e){ uit.innerHTML = '<p class="cb-uitleg">Zoeken lukt nu niet (geen verbinding?).</p>'; }
    finally { knop.disabled = false; }
  };
  knop.onclick = doe;
  zoek.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); doe(); } };
}

/* ==================== LIJST-EDITOR (generiek) ==================== */
const DRAFT = {};          // sleutel → rijen; blijft bestaan over live-herrenders
let DRAFT_CLUB = null;
function bewaakDraft(){ if (DRAFT_CLUB !== S.clubId){ for (const k of Object.keys(DRAFT)) delete DRAFT[k]; DRAFT_CLUB = S.clubId; } }
const lijstPatch = sleutel => ((S.club && S.club.instellingen && S.club.instellingen.lijsten) || {})[sleutel] || {};

function rijenVoor(sleutel){
  bewaakDraft();
  if (DRAFT[sleutel]) return DRAFT[sleutel];
  const def = LIJST_DEFS[sleutel];
  const alle = mergeLijst(ORIGINEEL[def.bron], lijstPatch(sleutel), def.idKey, def.vast || []);
  DRAFT[sleutel] = alle.map(x => {
    const f = {}; for (const v of def.velden) f[v.k] = x[v.k] ?? '';
    if (x.ico !== undefined && !('ico' in f)) f.ico = x.ico;
    return { id: x[def.idKey], extra: !!x._extra, uit: !!x._uit, f };
  });
  return DRAFT[sleutel];
}
function icoOpties(def, huidig){
  const pre = def.icoPrefix || [''];
  const lijst = ICOONNAMEN.filter(n => pre.some(p => n.startsWith(p)));
  if (huidig && !lijst.includes(huidig)) lijst.unshift(huidig);
  return lijst.map(n => `<option value="${esc(n)}" ${n === huidig ? 'selected' : ''}>${esc(n)}</option>`).join('');
}
function veldHtml(def, v, r, idx){
  const w = r.f[v.k] ?? '';
  const at = `data-ci="f" data-k="${v.k}" data-i="${idx}"`;
  const kop = `<span class="ci-l">${esc(v.l)}</span>`;
  switch (v.t){
    case 'lang':   return `<label class="ci-veld breed">${kop}<textarea class="invoer" rows="2" maxlength="${v.max || 200}" ${at}>${esc(w)}</textarea></label>`;
    case 'emoji':  return `<label class="ci-veld smal">${kop}<input class="invoer" maxlength="8" value="${esc(w)}" ${at}></label>`;
    case 'kleur':  return `<label class="ci-veld smal">${kop}<input class="invoer ci-kleur" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(w) ? w : '#888888'}" ${at}></label>`;
    case 'getal':  return `<label class="ci-veld smal">${kop}<input class="invoer" type="number" inputmode="numeric" min="${v.min ?? 0}" max="${v.max ?? 99}" value="${esc(w)}" ${at}></label>`;
    case 'domein': return `<label class="ci-veld">${kop}<select class="invoer" ${at}>${SKILLS.map(s => `<option value="${s.id}" ${s.id === w ? 'selected' : ''}>${esc(s.naam)}</option>`).join('')}</select></label>`;
    case 'thema':  return `<label class="ci-veld">${kop}<select class="invoer" ${at}><option value="">— geen —</option>${LEERCURVE.map(t => `<option value="${esc(t.thema)}" ${t.thema === w ? 'selected' : ''}>${esc(t.thema)}</option>`).join('')}</select></label>`;
    case 'ico':    return `<label class="ci-veld">${kop}<select class="invoer" ${at}>${icoOpties(def, w)}</select></label>`;
    default:       return `<label class="ci-veld">${kop}<input class="invoer" maxlength="${v.max || 60}" value="${esc(w)}" ${at}></label>`;
  }
}
function isGewijzigd(def, r){
  if (r.extra) return false;
  const o = ORIGINEEL[def.bron].find(x => x[def.idKey] === r.id);
  if (!o) return false;
  return r.uit || def.velden.some(v => String(r.f[v.k] ?? '') !== String(o[v.k] ?? ''));
}
function lijstKaart(sleutel){
  const def = LIJST_DEFS[sleutel];
  const rijen = rijenVoor(sleutel);
  const actief = rijen.filter(r => !r.uit).length;
  const body = rijen.map((r, i) => {
    const vast = (def.vast || []).includes(r.id);
    const naamVeld = def.naamIsId && r.extra
      ? `<label class="ci-veld breed"><span class="ci-l">Themanaam</span><input class="invoer" maxlength="60" value="${esc(r.id)}" data-ci="id" data-i="${i}"></label>` : '';
    const kop = def.naamIsId && !r.extra ? `<div class="ci-naam">${esc(r.id)}</div>` : '';
    return `<div class="ci-rij ${r.uit ? 'uit' : ''}">
      ${def.uitzetten ? `<label class="ci-aan" title="${vast ? 'Blijft altijd aan' : 'Aan/uit'}"><input type="checkbox" data-ci="aan" data-i="${i}" ${r.uit ? '' : 'checked'} ${vast ? 'disabled' : ''}></label>` : ''}
      <div class="ci-velden">${kop}${naamVeld}${def.velden.map(v => veldHtml(def, v, r, i)).join('')}</div>
      <div class="ci-acties">
        ${r.extra ? `<button type="button" class="ci-x" data-ci="weg" data-i="${i}" title="Verwijderen" aria-label="Verwijderen">🗑</button>`
          : isGewijzigd(def, r) ? `<button type="button" class="ci-x" data-ci="reset" data-i="${i}" title="Terug naar standaard" aria-label="Terug naar standaard">↺</button>` : ''}
      </div></div>`;
  }).join('');
  return `<div class="cb-kaart" data-lijstkaart="${sleutel}">
    <div class="cb-kaart-kop"><b>${esc(def.titel)}</b>${def.uitzetten ? `<span class="cb-telling">${actief} aan</span>` : ''}</div>
    <p class="cb-uitleg">${esc(def.uitleg)}</p>
    ${body}
    <div class="rij" style="margin-top:10px">
      ${def.toevoegen ? `<button type="button" class="knop licht vol klein" data-ci="nieuw" data-lijst="${sleutel}">+ Toevoegen</button>` : ''}
      <button type="button" class="knop vol klein" data-ci="opslaan" data-lijst="${sleutel}">Opslaan</button>
    </div>
    <button type="button" class="cb-inklap" data-ci="standaard" data-lijst="${sleutel}">Alles terug naar de standaard <span>›</span></button>
  </div>`;
}
function patchUitRijen(def, rijen){
  const orig = ORIGINEEL[def.bron];
  const items = {}, extra = [];
  const typeer = (v, w) => v.t === 'getal' ? Number(w) : w;
  for (const r of rijen){
    if (r.extra){
      const e = { [def.idKey]: r.id };
      for (const v of def.velden) e[v.k] = typeer(v, r.f[v.k]);
      if (r.uit) e.uit = true;
      extra.push(e); continue;
    }
    const o = orig.find(x => x[def.idKey] === r.id);
    const p = {};
    for (const v of def.velden) if (String(r.f[v.k] ?? '') !== String(o[v.k] ?? '')) p[v.k] = typeer(v, r.f[v.k]);
    if (r.uit) p.uit = true;
    if (Object.keys(p).length) items[r.id] = p;
  }
  return { items, extra };
}
function valideerRijen(sleutel){
  const def = LIJST_DEFS[sleutel], rijen = rijenVoor(sleutel);
  const eerste = def.velden[0];
  const namen = new Set(ORIGINEEL[def.bron].map(o => String(o[def.idKey]).toLowerCase()));
  for (const r of rijen){
    if (def.naamIsId && r.extra){
      const id = String(r.id || '').trim();
      if (!id) return 'Geef elk nieuw thema een naam';
      if (namen.has(id.toLowerCase())) return `“${id}” bestaat al`;
      namen.add(id.toLowerCase()); r.id = id;
    }
    if (!r.uit && eerste && eerste.t !== 'getal' && !String(r.f[eerste.k] ?? '').trim()) return `Vul bij elke actieve regel de ${eerste.l.toLowerCase()} in`;
    for (const v of def.velden){
      if (v.t === 'getal' && !r.uit){ const n = Number(r.f[v.k]); if (!Number.isFinite(n) || n < (v.min ?? 0) || n > (v.max ?? 99)) return `${v.l} moet tussen ${v.min ?? 0} en ${v.max ?? 99} liggen`; }
      if (v.t === 'kleur' && !/^#[0-9a-fA-F]{6}$/.test(String(r.f[v.k] || ''))) return 'Kies een geldige kleur';
    }
  }
  if (def.minActief && rijen.filter(r => !r.uit).length < def.minActief) return `Houd minstens ${def.minActief} regels aan`;
  return '';
}
function koppelLijstKaart(v, kaartEl, herteken){
  const sleutel = kaartEl.dataset.lijstkaart, def = LIJST_DEFS[sleutel];
  const rijen = rijenVoor(sleutel);
  kaartEl.addEventListener('input', e => {
    const t = e.target.closest('[data-ci]'); if (!t) return;
    const r = rijen[Number(t.dataset.i)]; if (!r) return;
    if (t.dataset.ci === 'f') r.f[t.dataset.k] = t.value;
    if (t.dataset.ci === 'id') r.id = t.value;
  });
  kaartEl.addEventListener('change', e => {
    const t = e.target.closest('[data-ci="aan"]'); if (!t) return;
    rijen[Number(t.dataset.i)].uit = !t.checked; herteken();
  });
  kaartEl.addEventListener('click', async e => {
    const t = e.target.closest('button[data-ci]'); if (!t) return;
    const a = t.dataset.ci, i = Number(t.dataset.i);
    if (a === 'weg'){ rijen.splice(i, 1); herteken(); }
    else if (a === 'reset'){
      const o = ORIGINEEL[def.bron].find(x => x[def.idKey] === rijen[i].id);
      for (const vl of def.velden) rijen[i].f[vl.k] = o[vl.k] ?? '';
      rijen[i].uit = false; herteken();
    }
    else if (a === 'nieuw'){
      const f = {}; for (const vl of def.velden) f[vl.k] = vl.t === 'getal' ? (vl.min ?? 8) : vl.t === 'kleur' ? '#3b82f6' : vl.t === 'domein' ? 'TA' : vl.t === 'ico' ? (def.icoPrefix ? ICOONNAMEN.find(n => n.startsWith(def.icoPrefix[0])) || '' : '') : '';
      rijen.push({ id: def.naamIsId ? '' : 'x' + Date.now().toString(36), extra: true, uit: false, f }); herteken();
    }
    else if (a === 'standaard'){
      if (!confirm('Alle aanpassingen in dit onderdeel terugzetten naar de standaard?')) return;
      vangFout(t, async () => { await bewaar([['lijsten.' + sleutel, {}]]); delete DRAFT[sleutel]; meld('Teruggezet naar de standaard'); herteken(); });
    }
    else if (a === 'opslaan'){
      const fout = valideerRijen(sleutel);
      if (fout) return meld(fout);
      vangFout(t, async () => { await bewaar([['lijsten.' + sleutel, patchUitRijen(def, rijen)]]); delete DRAFT[sleutel]; meld('Opgeslagen'); herteken(); });
    }
  });
}

/* ==================== SPECIALE LIJSTEN ==================== */
/* --- Speeltijden per categorie --- */
const CAT_KEY = 'categorieen';
function catRijen(){
  bewaakDraft();
  if (DRAFT[CAT_KEY]) return DRAFT[CAT_KEY];
  const p = lijstPatch(CAT_KEY), items = p.items || {};
  const rijen = [];
  for (const [geslacht, orig] of [['j', ORIGINEEL.catJ], ['m', ORIGINEEL.catM]])
    for (const [key, v] of Object.entries(orig)){
      const pp = items[key] || {};
      rijen.push({ key, geslacht, extra: false, uit: !!pp.uit, f: { format: pp.format ?? v.format, periodes: pp.periodes ?? v.periodes, duur: pp.duur ?? v.duur, knvb: pp.knvb ?? v.knvb } });
    }
  for (const e of (p.extra || [])) rijen.push({ key: e.key, geslacht: e.geslacht || 'j', extra: true, uit: !!e.uit, f: { format: e.format, periodes: e.periodes, duur: e.duur, knvb: e.knvb || '' } });
  return (DRAFT[CAT_KEY] = rijen);
}
function catKaart(){
  const rijen = catRijen();
  const orig = k => ORIGINEEL.catJ[k] || ORIGINEEL.catM[k];
  const body = rijen.map((r, i) => {
    const o = r.extra ? null : orig(r.key);
    const gewijzigd = o && (r.uit || ['format', 'periodes', 'duur', 'knvb'].some(k => String(r.f[k]) !== String(o[k])));
    return `<div class="ci-rij ${r.uit ? 'uit' : ''}">
      <label class="ci-aan"><input type="checkbox" data-cc="aan" data-i="${i}" ${r.uit ? '' : 'checked'}></label>
      <div class="ci-velden">
        <div class="ci-naam">${r.extra ? `<input class="invoer" maxlength="14" placeholder="Naam, bv. JO18" value="${esc(r.key)}" data-cc="key" data-i="${i}" style="max-width:150px">` : esc(r.key)} <small>${r.geslacht === 'm' ? 'meiden' : 'jongens/overig'}</small></div>
        <label class="ci-veld smal"><span class="ci-l">Tegen</span><select class="invoer" data-cc="f" data-k="format" data-i="${i}">${['4', '5', '6', '7', '8', '9', '10', '11'].map(n => `<option value="${n}" ${String(r.f.format) === n ? 'selected' : ''}>${n}v${n}</option>`).join('')}</select></label>
        <label class="ci-veld smal"><span class="ci-l">Periodes</span><select class="invoer" data-cc="f" data-k="periodes" data-i="${i}"><option value="2" ${Number(r.f.periodes) === 2 ? 'selected' : ''}>2 helften</option><option value="4" ${Number(r.f.periodes) === 4 ? 'selected' : ''}>4 kwarten</option></select></label>
        <label class="ci-veld smal"><span class="ci-l">Min. per periode</span><input class="invoer" type="number" step="0.5" min="5" max="60" value="${esc(r.f.duur)}" data-cc="f" data-k="duur" data-i="${i}"></label>
        <label class="ci-veld breed"><span class="ci-l">Omschrijving</span><input class="invoer" maxlength="80" value="${esc(r.f.knvb)}" data-cc="f" data-k="knvb" data-i="${i}"></label>
      </div>
      <div class="ci-acties">${r.extra ? `<button type="button" class="ci-x" data-cc="weg" data-i="${i}" aria-label="Verwijderen">🗑</button>` : gewijzigd ? `<button type="button" class="ci-x" data-cc="reset" data-i="${i}" aria-label="Terug naar standaard">↺</button>` : ''}</div>
    </div>`;
  }).join('');
  return `<div class="cb-kaart" data-catkaart>
    <div class="cb-kaart-kop"><b>Speeltijden per categorie</b></div>
    <p class="cb-uitleg">Wedstrijdvorm en speeltijd die een nieuw team of een nieuwe wedstrijd automatisch krijgt. Standaard volgens de KNVB; pas aan als jullie afwijken. Bestaande wedstrijden veranderen niet.</p>
    ${body}
    <div class="rij" style="margin-top:10px">
      <button type="button" class="knop licht klein" data-cc="nieuw" data-g="j">+ Categorie</button>
      <button type="button" class="knop licht klein" data-cc="nieuw" data-g="m">+ Meidencategorie</button>
      <button type="button" class="knop vol klein" data-cc="opslaan">Opslaan</button>
    </div>
    <button type="button" class="cb-inklap" data-cc="standaard">Alles terug naar de standaard <span>›</span></button>
  </div>`;
}
function koppelCatKaart(el, herteken){
  const rijen = catRijen();
  el.addEventListener('input', e => {
    const t = e.target.closest('[data-cc]'); if (!t) return;
    const r = rijen[Number(t.dataset.i)]; if (!r) return;
    if (t.dataset.cc === 'f') r.f[t.dataset.k] = t.value;
    if (t.dataset.cc === 'key') r.key = t.value;
  });
  el.addEventListener('change', e => { const t = e.target.closest('[data-cc="aan"]'); if (t){ rijen[Number(t.dataset.i)].uit = !t.checked; herteken(); } });
  el.addEventListener('click', e => {
    const t = e.target.closest('button[data-cc]'); if (!t) return;
    const a = t.dataset.cc, i = Number(t.dataset.i);
    if (a === 'weg'){ rijen.splice(i, 1); herteken(); }
    else if (a === 'reset'){ const o = ORIGINEEL.catJ[rijen[i].key] || ORIGINEEL.catM[rijen[i].key]; rijen[i].f = { format: o.format, periodes: o.periodes, duur: o.duur, knvb: o.knvb }; rijen[i].uit = false; herteken(); }
    else if (a === 'nieuw'){ rijen.push({ key: '', geslacht: t.dataset.g, extra: true, uit: false, f: { format: '11', periodes: 2, duur: 30, knvb: '' } }); herteken(); }
    else if (a === 'standaard'){
      if (!confirm('Alle speeltijden terugzetten naar de KNVB-standaard?')) return;
      vangFout(t, async () => { await bewaar([['lijsten.' + CAT_KEY, {}]]); delete DRAFT[CAT_KEY]; meld('Teruggezet'); herteken(); });
    }
    else if (a === 'opslaan'){
      const namen = new Set([...Object.keys(ORIGINEEL.catJ), ...Object.keys(ORIGINEEL.catM)].map(x => x.toLowerCase()));
      for (const r of rijen){
        if (r.extra){ const k = String(r.key || '').trim(); if (!k) return meld('Geef elke nieuwe categorie een naam'); if (namen.has(k.toLowerCase())) return meld(`“${k}” bestaat al`); namen.add(k.toLowerCase()); r.key = k; }
        const d = Number(r.f.duur); if (!r.uit && (!Number.isFinite(d) || d < 5 || d > 60)) return meld(`Speeltijd van ${r.key || 'een categorie'} moet tussen 5 en 60 minuten liggen`);
      }
      for (const g of ['j', 'm']) if (!rijen.some(r => r.geslacht === g && !r.uit)) return meld('Houd voor jongens en voor meiden minstens één categorie aan');
      const items = {}, extra = [];
      for (const r of rijen){
        const f = { format: String(r.f.format), periodes: Number(r.f.periodes), duur: Number(r.f.duur), knvb: String(r.f.knvb || '').trim() };
        if (r.extra){ extra.push({ key: r.key, geslacht: r.geslacht, ...f, ...(r.uit ? { uit: true } : {}) }); continue; }
        const o = ORIGINEEL.catJ[r.key] || ORIGINEEL.catM[r.key], p = {};
        for (const k of Object.keys(f)) if (String(f[k]) !== String(o[k])) p[k] = f[k];
        if (r.uit) p.uit = true;
        if (Object.keys(p).length) items[r.key] = p;
      }
      vangFout(t, async () => { await bewaar([['lijsten.' + CAT_KEY, { items, extra }]]); delete DRAFT[CAT_KEY]; meld('Opgeslagen'); herteken(); });
    }
  });
}

/* --- Beoordelingsniveaus 1–5 --- */
function niveauKaart(){
  const it = (lijstPatch('niveaus').items) || {};
  const rijen = [1, 2, 3, 4, 5].map(n => {
    const o = ORIGINEEL.niveaus[n], p = it[n] || {};
    return `<div class="ci-rij"><div class="ci-velden"><div class="ci-naam">Niveau ${n}</div>
      <label class="ci-veld"><span class="ci-l">Naam</span><input class="invoer" maxlength="16" value="${esc(p.label ?? o.label)}" data-cn="label" data-n="${n}"></label>
      <label class="ci-veld smal"><span class="ci-l">Kort</span><input class="invoer" maxlength="6" value="${esc(p.kort ?? o.kort)}" data-cn="kort" data-n="${n}"></label>
      <label class="ci-veld smal"><span class="ci-l">Kleur</span><input class="invoer ci-kleur" type="color" value="${p.kleur ?? o.kleur}" data-cn="kleur" data-n="${n}"></label></div></div>`;
  }).join('');
  return `<div class="cb-kaart" data-niveaukaart><div class="cb-kaart-kop"><b>Beoordelingsniveaus</b></div>
    <p class="cb-uitleg">De vijf niveaus van de beoordeling (1 = laagste). Alleen naam en kleur; het aantal ligt vast.</p>${rijen}
    <div class="rij" style="margin-top:10px"><button type="button" class="knop vol klein" data-cn-actie="opslaan">Opslaan</button></div>
    <button type="button" class="cb-inklap" data-cn-actie="standaard">Terug naar de standaard <span>›</span></button></div>`;
}
function koppelNiveauKaart(el, herteken){
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-cn-actie]'); if (!t) return;
    if (t.dataset.cnActie === 'standaard'){ vangFout(t, async () => { await bewaar([['lijsten.niveaus', {}]]); meld('Teruggezet'); herteken(); }); return; }
    const items = {};
    for (let n = 1; n <= 5; n++){
      const o = ORIGINEEL.niveaus[n], p = {};
      for (const k of ['label', 'kort', 'kleur']){
        const inp = el.querySelector(`[data-cn="${k}"][data-n="${n}"]`); const w = String(inp.value).trim();
        if (!w) return meld('Vul overal een naam in');
        if (k === 'kleur' && !/^#[0-9a-fA-F]{6}$/.test(w)) return meld('Kies geldige kleuren');
        if (w !== o[k]) p[k] = w;
      }
      if (Object.keys(p).length) items[n] = p;
    }
    vangFout(t, async () => { await bewaar([['lijsten.niveaus', { items }]]); meld('Opgeslagen'); herteken(); });
  });
}

/* --- Wedstrijddoel-suggesties per leeftijdsband --- */
function doelKaart(){
  const it = (lijstPatch('doelBanden').items) || {};
  const naam = tot => tot <= 9 ? 'Tot en met O9' : tot <= 12 ? 'O10 t/m O12' : tot <= 15 ? 'O13 t/m O15' : 'O16 en ouder';
  const rijen = ORIGINEEL.doelBanden.map(b => {
    const tekst = (it[b.tot] && it[b.tot].teksten ? it[b.tot].teksten : b.teksten).join('\n');
    return `<label class="ci-veld breed" style="margin-bottom:10px"><span class="ci-l">${naam(b.tot)}</span><textarea class="invoer" rows="4" data-cd="${b.tot}">${esc(tekst)}</textarea></label>`;
  }).join('');
  return `<div class="cb-kaart" data-doelkaart><div class="cb-kaart-kop"><b>Wedstrijddoel-suggesties</b></div>
    <p class="cb-uitleg">Voorbeelden die een coach als inspiratie ziet bij het invullen van een wedstrijddoel. Eén suggestie per regel.</p>${rijen}
    <div class="rij"><button type="button" class="knop vol klein" data-cd-actie="opslaan">Opslaan</button></div>
    <button type="button" class="cb-inklap" data-cd-actie="standaard">Terug naar de standaard <span>›</span></button></div>`;
}
function koppelDoelKaart(el, herteken){
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-cd-actie]'); if (!t) return;
    if (t.dataset.cdActie === 'standaard'){ vangFout(t, async () => { await bewaar([['lijsten.doelBanden', {}]]); meld('Teruggezet'); herteken(); }); return; }
    const items = {};
    for (const b of ORIGINEEL.doelBanden){
      const regels = el.querySelector(`[data-cd="${b.tot}"]`).value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!regels.length) return meld('Elke leeftijdsband heeft minstens één suggestie nodig');
      if (JSON.stringify(regels) !== JSON.stringify(b.teksten)) items[b.tot] = { teksten: regels };
    }
    vangFout(t, async () => { await bewaar([['lijsten.doelBanden', { items }]]); meld('Opgeslagen'); herteken(); });
  });
}

/* ==================== TABS ==================== */
export function htmlInstelNieuw(sub){
  const eff = effectief(S.club);
  if (sub === 'identiteit') return tabIdentiteit(eff);
  if (sub === 'competitie') return tabCompetitie(eff);
  if (sub === 'pedagogiek') return tabPedagogiek(eff);
  if (sub === 'lijsten') return ['skills', 'leercurve', 'teamCategorieen', 'snelTags', 'teamTags', 'wisselRedenen', 'afwezigRedenen', 'bouwen', 'docCategorieen'].map(lijstKaart).join('') + niveauKaart() + doelKaart();
  if (sub === 'regels') return tabRegels(eff) + catKaart();
  if (sub === 'ai') return tabAI(eff);
  return '';
}
export function koppelInstelNieuw(v, herteken){
  const sub = S._clubInstelTab;
  v.querySelectorAll('[data-lijstkaart]').forEach(k => koppelLijstKaart(v, k, herteken));
  const cat = v.querySelector('[data-catkaart]'); if (cat) koppelCatKaart(cat, herteken);
  const niv = v.querySelector('[data-niveaukaart]'); if (niv) koppelNiveauKaart(niv, herteken);
  const doel = v.querySelector('[data-doelkaart]'); if (doel) koppelDoelKaart(doel, herteken);
  if (sub === 'identiteit') koppelIdentiteit(v, herteken);
  else if (sub === 'competitie') koppelCompetitie(v, herteken);
  else if (sub === 'pedagogiek') koppelPedagogiek(v, herteken);
  else if (sub === 'regels') koppelRegels(v, herteken);
  else if (sub === 'ai') koppelAI(v, herteken);
}

/* ---------- Identiteit ---------- */
function tabIdentiteit(eff){
  const id = eff.identiteit, club = S.club;
  const logo = id.logo || '';
  const afkStand = clubAfk(club);
  return `
    ${kaart('Naam en afkorting', '', `
      ${veldGroep('Clubnaam', `<input class="invoer" id="idNaam" maxlength="60" value="${esc(club.naam || '')}" autocomplete="off">`,
        'Wijzigen past ook de naam bij de teams en berichten van deze club aan.')}
      ${veldGroep('Afkorting', `<input class="invoer" id="idAfk" maxlength="6" value="${esc(id.afkorting || '')}" placeholder="${esc(afkStand)}" autocomplete="off" style="text-transform:uppercase">`,
        `Voorvoegsel van nieuwe teamcodes en voorbeeldnamen. Leeg = ${esc(afkStand) || 'afgeleid uit de naam'}. Bestaande teamcodes veranderen niet.`)}
      <button class="knop vol klein" id="idOpslaanNaam">Opslaan</button>`)}
    ${kaart('Logo', '', `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
        <img id="idLogoVoorbeeld" src="${esc(logo || CLUPPIE_LOGO)}" alt="" style="width:72px;height:72px;object-fit:contain;border-radius:14px;background:rgba(255,255,255,.06);padding:6px">
        <div style="flex:1"><input type="file" id="idLogoBestand" accept="image/*" style="display:none">
          <button class="knop licht klein" id="idLogoKies">Logo kiezen…</button>
          ${logo ? '<button class="knop licht klein" id="idLogoWeg" style="margin-left:6px">Verwijderen</button>' : ''}</div></div>
      <p class="cb-uitleg" style="margin:0">Wordt verkleind opgeslagen en getoond op het startscherm en het loginscherm van je coaches. Zonder logo tonen we het Cluppie-icoon. Een vierkant of transparant logo werkt het best.</p>`)}
    ${kaart('Kleur', '', `
      <div style="display:flex;align-items:center;gap:12px">
        <input type="color" id="idKleur" value="${/^#[0-9a-fA-F]{6}$/.test(id.kleur) ? id.kleur : '#e2342f'}" style="width:56px;height:44px;border:none;background:none;padding:0">
        <button class="knop vol klein" id="idKleurOpslaan">Opslaan</button>
        <button class="knop licht klein" id="idKleurReset">Standaard</button></div>
      <p class="cb-uitleg">De hoofdkleur van de knoppen en accenten voor alle coaches van deze club.</p>`)}
    ${kaart('Uitnodigingscode', '', `
      <p class="cb-uitleg" style="margin:0 0 8px">De code in de uitnodigingslink voor mede-beheerders: <b>${esc(club.code || '—')}</b>. Lekt een link uit, ververs dan de code; oude links werken daarna niet meer.</p>
      <button class="knop licht klein" id="idCodeVers">Nieuwe code maken</button>`)}`;
}
function koppelIdentiteit(v, herteken){
  v.querySelector('#idOpslaanNaam')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    const naam = v.querySelector('#idNaam').value.trim();
    if (!naam) return meld('Vul een clubnaam in');
    const afk = v.querySelector('#idAfk').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hernoemd = naam !== S.club.naam;
    if (hernoemd) await hernoemClub(naam);
    await bewaar([['identiteit.afkorting', afk]]);
    meld('Opgeslagen'); herteken();
  }));
  const bestand = v.querySelector('#idLogoBestand');
  v.querySelector('#idLogoKies')?.addEventListener('click', () => bestand.click());
  bestand?.addEventListener('change', async () => {
    const f = bestand.files && bestand.files[0]; if (!f) return;
    try { const url = await verwerkLogo(f); await bewaar([['identiteit.logo', url]]); meld('Logo opgeslagen'); herteken(); }
    catch (e){ meld(e.message || 'Logo opslaan mislukt'); }
  });
  v.querySelector('#idLogoWeg')?.addEventListener('click', e => vangFout(e.currentTarget, async () => { await bewaar([['identiteit.logo', '']]); meld('Logo verwijderd'); herteken(); }));
  v.querySelector('#idKleurOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => { await bewaar([['identiteit.kleur', v.querySelector('#idKleur').value]]); meld('Kleur opgeslagen'); herteken(); }));
  v.querySelector('#idKleurReset')?.addEventListener('click', e => vangFout(e.currentTarget, async () => { await bewaar([['identiteit.kleur', '#e2342f']]); meld('Standaardkleur'); herteken(); }));
  v.querySelector('#idCodeVers')?.addEventListener('click', e => {
    if (!confirm('Nieuwe code maken? Bestaande uitnodigingslinks voor beheerders werken daarna niet meer.')) return;
    vangFout(e.currentTarget, async () => { await updateDoc(doc(db, 'clubs', S.clubId), { code: nieuweCode() }); meld('Nieuwe code gemaakt'); herteken(); });
  });
}
/* Clubnaam wijzigen: het club-document, en de gekopieerde naam (clubNaam) bij teams en clubbrede items. */
async function hernoemClub(naam){
  const id = S.clubId;
  await updateDoc(doc(db, 'clubs', id), { naam });
  S.club.naam = naam;
  const teamIds = Object.keys(S.club.teams || {});
  let mislukt = 0;
  const batchUpdate = async (refs) => {
    for (let i = 0; i < refs.length; i += 400){
      const b = writeBatch(db);
      refs.slice(i, i + 400).forEach(r => b.update(r, { clubNaam: naam }));
      try { await b.commit(); } catch (e){ mislukt++; console.warn('[Cluppie] hernoemen deels mislukt', e.code); }
    }
  };
  await batchUpdate(teamIds.map(t => doc(db, 'teams', t)));
  for (const col of ['berichten', 'trainingen', 'videos', 'documenten']){
    try {
      const snap = await getDocs(query(collection(db, col), where('club', '==', id)));
      await batchUpdate(snap.docs.map(d => d.ref));
    } catch (e){ mislukt++; }
  }
  if (mislukt) meld('Naam gewijzigd; niet overal doorgevoerd — controleer de Firestore-regels');
}

/* ---------- Competitie: plaats, district, KNVB-kalender ---------- */
function tabCompetitie(eff){
  const l = eff.locatie;
  const eigen = l.district === 'eigen';
  return `
    ${kaart('Plaats', '', `
      <p class="cb-uitleg" style="margin:0 0 8px">${l.plaats ? `Nu: <b>${esc(l.plaats)}</b> (${esc(l.lat)}, ${esc(l.lon)}).` : 'Nog geen plaats ingesteld; het weer op het startscherm blijft dan uit.'}</p>
      ${plaatsZoeker('cp', l.plaats)}
      ${l.plaats ? '<button class="cb-inklap" id="cpWis">Plaats wissen <span>›</span></button>' : ''}`)}
    ${kaart('KNVB-district en speeldagen', '', `
      ${veldGroep('Kalender', `<select class="invoer" id="cpDistrict">
          <option value="zuid" ${!eigen ? 'selected' : ''}>Ingebouwd: districten Zuid I en II (2026/’27)</option>
          <option value="eigen" ${eigen ? 'selected' : ''}>Eigen kalender importeren</option></select>`,
        'De speeldagen (competitie, beker, inhaal, vrij) verschillen per district. Kies “eigen” als je club buiten Zuid I/II speelt: zolang er dan geen kalender is geïmporteerd tonen we geen KNVB-speeldagen, in plaats van verkeerde data.')}
      ${eigen ? kalenderImport() : ''}`)}`;
}
function kalenderImport(){
  return `
    <div class="cb-uitleg" style="margin-bottom:8px">Plak de kalender als JSON, of kies een bestand. Gebruik de standaardkalender als voorbeeld van het formaat.</div>
    ${veldGroep('Seizoen (label)', `<input class="invoer" id="kalLabel" placeholder="2026/'27" maxlength="14" value="${esc(S.club.huidigSeizoen || '')}">`)}
    <textarea class="invoer" id="kalTekst" rows="6" placeholder='{"pup":[{"d":"2026-09-06","t":"wd","l":"Fase 1"}],"jun":[],"sen":[],"mei":[]}' spellcheck="false" style="font-family:monospace;font-size:12px"></textarea>
    <input type="file" id="kalBestand" accept=".json,application/json" style="display:none">
    <div class="rij" style="margin-top:8px">
      <button class="knop licht klein" id="kalKies">Bestand kiezen…</button>
      <button class="knop licht klein" id="kalVoorbeeld">Voorbeeld downloaden</button>
      <button class="knop vol klein" id="kalOpslaan">Kalender opslaan</button></div>
    <button class="cb-inklap" id="kalWeg">Eigen kalender verwijderen <span>›</span></button>
    <p class="cb-uitleg">Kolommen: <b>pup</b> = O7–O12, <b>jun</b> = O13–O19, <b>sen</b> = senioren/vrouwen, <b>mei</b> = meiden MO13–MO20. Types: wd, beker, inhaal, vrij.</p>`;
}
function koppelCompetitie(v, herteken){
  koppelPlaatsZoeker(v, 'cp', p => vangFout(null, async () => {
    await bewaar([['locatie.plaats', p.plaats], ['locatie.lat', p.lat], ['locatie.lon', p.lon]]); meld('Plaats opgeslagen: ' + p.plaats); herteken();
  }));
  v.querySelector('#cpWis')?.addEventListener('click', () => vangFout(null, async () => { await bewaar([['locatie.plaats', ''], ['locatie.lat', null], ['locatie.lon', null]]); meld('Plaats gewist'); herteken(); }));
  v.querySelector('#cpDistrict')?.addEventListener('change', e => vangFout(null, async () => { await bewaar([['locatie.district', e.target.value]]); herteken(); }));
  const bestand = v.querySelector('#kalBestand');
  v.querySelector('#kalKies')?.addEventListener('click', () => bestand.click());
  bestand?.addEventListener('change', async () => { const f = bestand.files && bestand.files[0]; if (f) v.querySelector('#kalTekst').value = await f.text(); });
  v.querySelector('#kalVoorbeeld')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(ORIGINEEL.kalender, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'knvb-kalender-voorbeeld.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  v.querySelector('#kalOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    let obj; try { obj = JSON.parse(v.querySelector('#kalTekst').value); } catch (x){ return meld('Dit is geen geldige JSON'); }
    const fout = valideerKalender(obj); if (fout) return meld(fout);
    const label = v.querySelector('#kalLabel').value.trim() || 'eigen kalender';
    await setDoc(doc(db, 'clubs', S.clubId, 'kalender', 'huidig'), {
      pup: obj.pup || [], jun: obj.jun || [], sen: obj.sen || [], mei: obj.mei || [], label, bijgewerkt: serverTimestamp(),
    });
    await herlaadKalender(); meld('Kalender opgeslagen'); herteken();
  }));
  v.querySelector('#kalWeg')?.addEventListener('click', e => {
    if (!confirm('Eigen kalender verwijderen?')) return;
    vangFout(e.currentTarget, async () => { await deleteDoc(doc(db, 'clubs', S.clubId, 'kalender', 'huidig')); await herlaadKalender(); meld('Verwijderd'); herteken(); });
  });
}

/* ---------- Pedagogiek ---------- */
function tabPedagogiek(eff){
  const p = eff.pedagogiek, id = eff.identiteit;
  return `
    ${kaart('Speelwijze', '', `
      ${veldGroep('Uitgangsformatie 11 tegen 11', `<input class="invoer" id="pdFormatie" maxlength="12" value="${esc(p.formatie11 || '')}" placeholder="bv. 4-3-3" autocomplete="off">`,
        'Als een coach bij 11v11 deze formatie kiest, ziet hij een hint dat dit het clubuitgangspunt is. Leeg = geen hint.')}
      <button class="knop vol klein" id="pdFormatieOpslaan">Opslaan</button>`)}
    ${kaart('Namen in de app', '', `
      ${veldGroep('Naam van de wekelijkse tip', `<input class="invoer" id="pdKompas" maxlength="30" value="${esc(id.kompasNaam || '')}" autocomplete="off">`, 'Bijvoorbeeld “ASV-kompas”. Zo heet het onderdeel op de Training-tab en in het beheer.')}
      ${veldGroep('Naam van het beleidsdocument', `<input class="invoer" id="pdBeleid" maxlength="30" value="${esc(id.beleidsplanNaam || '')}" autocomplete="off">`, 'Bijvoorbeeld “jeugdbeleidsplan” of “opleidingsplan”; verschijnt als bronvermelding.')}
      <button class="knop vol klein" id="pdNamenOpslaan">Opslaan</button>`)}
    ${kaart('Teksten van Cluppie', '', `
      <label class="ci-schakel"><input type="checkbox" id="pdStandaard" ${p.contentStandaard !== false ? 'checked' : ''}><span>Standaardteksten van Cluppie gebruiken<br><small>Leerthema-uitleg, wekelijkse tips en gouden regels. Uit = alleen jullie eigen teksten (onder Content) worden getoond. Eigen teksten gaan altijd voor.</small></span></label>
      <button class="knop vol klein" id="pdStandaardOpslaan" style="margin-top:10px">Opslaan</button>`)}
    <div class="cb-uitleg" style="margin:0 2px 12px">Domeinen, leercurve-thema’s, tags en redenen pas je aan onder <b>Lijsten</b>. De teksten bij de leerthema’s en tips staan onder <b>Content</b>.</div>`;
}
function koppelPedagogiek(v, herteken){
  v.querySelector('#pdFormatieOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    const w = v.querySelector('#pdFormatie').value.trim();
    if (w && !parseFormatie(w, '11')) return meld(`Geen geldige formatie voor 11v11 (de getallen moeten samen ${aantalVeldspelers('11')} zijn, bv. 4-3-3)`);
    await bewaar([['pedagogiek.formatie11', w]]); meld('Opgeslagen'); herteken();
  }));
  v.querySelector('#pdStandaardOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    await bewaar([['pedagogiek.contentStandaard', v.querySelector('#pdStandaard').checked]]); meld('Opgeslagen'); herteken();
  }));
  v.querySelector('#pdNamenOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    const k = v.querySelector('#pdKompas').value.trim(), b = v.querySelector('#pdBeleid').value.trim();
    if (!k || !b) return meld('Vul beide namen in');
    await bewaar([['identiteit.kompasNaam', k], ['identiteit.beleidsplanNaam', b]]); meld('Opgeslagen'); herteken();
  }));
}

/* ---------- Regels ---------- */
function tabRegels(eff){
  const r = eff.regels || {}, D = { tijdstraf: { pupilSec: 300, jeugdSec: 600, jeugdVanaf: 16 }, bouwGrenzen: { onderTm: 11, middenTm: 15 }, dashboard: { dagenInactief: 14, opkomstLaag: 50 }, maxVideoMB: 100 };
  const t = { ...D.tijdstraf, ...(r.tijdstraf || {}) }, b = { ...D.bouwGrenzen, ...(r.bouwGrenzen || {}) }, d = { ...D.dashboard, ...(r.dashboard || {}) };
  const getal = (id, w, min, max, stap = 1) => `<input class="invoer" type="number" inputmode="decimal" id="${id}" min="${min}" max="${max}" step="${stap}" value="${esc(w)}">`;
  return `
    ${kaart('Tijdstraf', '', `
      <div class="rij"><div style="flex:1">${veldGroep('Pupillen (minuten)', getal('rgTsPupil', t.pupilSec / 60, 1, 30, 0.5))}</div>
        <div style="flex:1">${veldGroep('Junioren en ouder (minuten)', getal('rgTsJeugd', t.jeugdSec / 60, 1, 30, 0.5))}</div></div>
      ${veldGroep('Junioren-regel geldt vanaf O-leeftijd', getal('rgTsVanaf', t.jeugdVanaf, 10, 19), 'Senioren en Vrouwen volgen altijd de tijd voor junioren en ouder. KNVB: 5 minuten t/m O15, daarna 10.')}
      <button class="knop vol klein" id="rgTijdstraf">Opslaan</button>`)}
    ${kaart('Indeling in bouwen', '', `
      <div class="rij"><div style="flex:1">${veldGroep('Onderbouw t/m O', getal('rgBouwOnder', b.onderTm, 7, 17))}</div>
        <div style="flex:1">${veldGroep('Middenbouw t/m O', getal('rgBouwMidden', b.middenTm, 8, 18))}</div></div>
      <p class="cb-uitleg">Daarboven, plus senioren en vrouwen, valt in de bovenbouw. Bestaande teams houden hun bouw; dit geldt voor nieuwe teams. De namen van de bouwen pas je aan onder Lijsten.</p>
      <button class="knop vol klein" id="rgBouw">Opslaan</button>`)}
    ${kaart('Aandachtspunten in het clubdashboard', '', `
      <div class="rij"><div style="flex:1">${veldGroep('Inactief na (dagen)', getal('rgDagen', d.dagenInactief, 3, 90))}</div>
        <div style="flex:1">${veldGroep('Lage opkomst onder (%)', getal('rgOpkomst', d.opkomstLaag, 10, 95))}</div></div>
      <button class="knop vol klein" id="rgDash">Opslaan</button>`)}
    ${kaart('Uploads', '', `
      ${veldGroep('Maximale videogrootte (MB)', getal('rgVideo', r.maxVideoMB || D.maxVideoMB, 5, 500))}
      <button class="knop vol klein" id="rgUpload">Opslaan</button>`)}`;
}
function koppelRegels(v, herteken){
  const n = id => Number(v.querySelector('#' + id).value);
  const knop = (id, fn) => v.querySelector('#' + id)?.addEventListener('click', e => vangFout(e.currentTarget, async () => { const fout = await fn(); if (fout) return meld(fout); meld('Opgeslagen'); herteken(); }));
  knop('rgTijdstraf', async () => {
    const p = n('rgTsPupil'), j = n('rgTsJeugd'), va = n('rgTsVanaf');
    if (![p, j].every(x => x >= 1 && x <= 30) || !(va >= 10 && va <= 19)) return 'Controleer de waarden (minuten 1–30, leeftijd 10–19)';
    await bewaar([['regels.tijdstraf', { pupilSec: Math.round(p * 60), jeugdSec: Math.round(j * 60), jeugdVanaf: Math.round(va) }]]);
  });
  knop('rgBouw', async () => {
    const o = Math.round(n('rgBouwOnder')), m = Math.round(n('rgBouwMidden'));
    if (!(o >= 7 && m > o && m <= 18)) return 'De middenbouw moet een hogere leeftijd hebben dan de onderbouw';
    await bewaar([['regels.bouwGrenzen', { onderTm: o, middenTm: m }]]);
  });
  knop('rgDash', async () => {
    const dg = Math.round(n('rgDagen')), op = Math.round(n('rgOpkomst'));
    if (!(dg >= 3 && dg <= 90 && op >= 10 && op <= 95)) return 'Controleer de waarden (dagen 3–90, opkomst 10–95%)';
    await bewaar([['regels.dashboard', { dagenInactief: dg, opkomstLaag: op }]]);
  });
  knop('rgUpload', async () => {
    const mb = Math.round(n('rgVideo')); if (!(mb >= 5 && mb <= 500)) return 'Kies tussen 5 en 500 MB';
    await bewaar([['regels.maxVideoMB', mb]]);
  });
}

/* ---------- AI & modules ---------- */
function tabAI(eff){
  const ai = eff.ai || {}, std = (eff.modules && eff.modules.standaard) || {};
  const aan = ai.aan !== false;
  return `
    ${kaart('AI-functies', '', `
      <label class="ci-schakel"><input type="checkbox" id="aiAan" ${aan ? 'checked' : ''}><span>AI-functies aan voor deze club</span></label>
      <p class="cb-uitleg">Trainingen structureren, wedstrijdverslagen en de hulp-chatbot. Uit = de knoppen verdwijnen bij alle coaches. Er gaan nooit spelersnamen naar de AI.</p>
      ${veldGroep('Maximaal aantal AI-aanroepen per maand (optioneel)', `<input class="invoer" type="number" inputmode="numeric" id="aiLimiet" min="0" max="100000" value="${ai.maandLimiet ?? ''}" placeholder="onbeperkt">`,
        'Wordt vastgelegd nu; de server gaat dit afdwingen zodra de Cloud Functions zijn bijgewerkt.')}
      <button class="knop vol klein" id="aiOpslaan">Opslaan</button>`)}
    ${kaart('Onderdelen die standaard aan staan', '', `
      <p class="cb-uitleg" style="margin:0 0 8px">Voor alle teams die hier zelf niets over hebben ingesteld. Per team kun je het afwijkend instellen onder Teams.</p>
      ${MODULE_DEFS.map(([k, naam, , , uitleg]) => `<label class="ci-schakel"><input type="checkbox" data-mod="${k}" ${std[k] !== false ? 'checked' : ''}><span><b>${esc(k === 'kompas' ? (eff.identiteit.kompasNaam || naam) : naam)}</b><br><small>${esc(uitleg)}</small></span></label>`).join('')}
      <button class="knop vol klein" id="modOpslaan" style="margin-top:10px">Opslaan</button>`)}`;
}
function koppelAI(v, herteken){
  v.querySelector('#aiOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    const raw = v.querySelector('#aiLimiet').value.trim();
    const lim = raw === '' ? null : Math.max(0, Math.round(Number(raw)));
    if (raw !== '' && !Number.isFinite(lim)) return meld('Vul een geldig aantal in');
    await bewaar([['ai', { aan: v.querySelector('#aiAan').checked, maandLimiet: lim }]]); meld('Opgeslagen'); herteken();
  }));
  v.querySelector('#modOpslaan')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    const std = {}; v.querySelectorAll('[data-mod]').forEach(c => { if (!c.checked) std[c.dataset.mod] = false; });
    await bewaar([['modules.standaard', std]]); meld('Opgeslagen'); herteken();
  }));
}

/* ==================== BANNERS IN "ALGEMEEN" ==================== */
export function htmlAlgemeenMelding(){
  const club = S.club; let uit = '';
  if (isLegacy(club)){
    const asv = effectief(club).identiteit.logo === 'icons/asv-schild.png';
    uit += `<div class="cb-kaart" data-legacy><div class="cb-kaart-kop"><b>Instellingen nog niet vastgelegd</b></div>
      <p class="cb-uitleg" style="margin:0 0 10px">${asv ? 'Deze club draait nu op de ingebouwde ASV’33-waarden (logo, kleur, plaats, formatie, kompas). ' : 'Deze club gebruikt de neutrale standaard. '}Leg de huidige waarden vast om ze onder Identiteit, Competitie en Pedagogiek te kunnen aanpassen. Er verandert niets zichtbaars.</p>
      <button class="knop vol klein" id="legacyVastleggen">Waarden vastleggen</button></div>`;
  }
  if (!club.huidigSeizoen){
    uit += `<div class="cb-kaart" data-seizoenmelding><div class="cb-kaart-kop"><b>Seizoen niet vastgelegd</b></div>
      <p class="cb-uitleg" style="margin:0 0 10px">Er staat nog geen seizoen op de club; nu geldt <b>${esc(SEIZOEN_FALLBACK)}</b>. Leg het vast zodat het niet ongemerkt verandert.</p>
      <button class="knop vol klein" id="seizoenVastleggen">Vastleggen als ${esc(SEIZOEN_FALLBACK)}</button></div>`;
  }
  return uit;
}
export function koppelAlgemeenMelding(v, herteken){
  v.querySelector('#legacyVastleggen')?.addEventListener('click', e => vangFout(e.currentTarget, async () => { await bewaar([]); meld('Waarden vastgelegd'); herteken(); }));
  v.querySelector('#seizoenVastleggen')?.addEventListener('click', e => vangFout(e.currentTarget, async () => {
    await updateDoc(doc(db, 'clubs', S.clubId), { huidigSeizoen: SEIZOEN_FALLBACK }); S.club.huidigSeizoen = SEIZOEN_FALLBACK; meld('Seizoen vastgelegd'); herteken();
  }));
}

/* ==================== WIZARD: NIEUWE CLUB ==================== */
export function modalNieuweClub(naCreatie){
  const bronnen = (S.clubs || []).slice();
  const W = {
    stap: 1, naam: '', plaats: '', lat: null, lon: null, district: 'zuid', afk: '', afkHandmatig: false,
    logo: '', kleur: '#e2342f', clientId: '', seizoen: seizoenVoorDatum(), ai: true, kopie: '',
  };
  openModal(`<h2>🏛 Nieuwe club</h2><div id="wzBody"></div>`);
  const body = () => $('#modalInhoud .modal-body') || $('#wzBody');
  const stappen = ['Club', 'Uiterlijk', 'Koppeling', 'Start'];
  const kop = () => `<div class="segment" style="margin-bottom:14px;pointer-events:none">${stappen.map((s, i) => `<button class="${W.stap === i + 1 ? 'actief' : ''}">${i + 1}. ${s}</button>`).join('')}</div>`;
  const knoppen = (laatste) => `<div class="rij" style="margin-top:14px">
      ${W.stap > 1 ? '<button class="knop licht vol" id="wzTerug">Terug</button>' : ''}
      <button class="knop vol" id="wzVerder">${laatste ? 'Club aanmaken' : 'Volgende'}</button></div>`;

  const teken = () => {
    const b = body(); if (!b) return;
    if (W.stap === 1){
      b.innerHTML = kop() + `
        <p class="cb-uitleg" style="margin-bottom:12px">Als clubbeheerder maak je teams aan en deel je trainingen met alle teams. Coaches nodig je uit met een persoonlijke teamlink. Alle onderdelen kun je later nog aanpassen.</p>
        ${veldGroep('Clubnaam', `<input class="invoer" id="wzNaam" maxlength="60" placeholder="Bijv. RKVV Mifano" value="${esc(W.naam)}" autocomplete="off">`)}
        ${veldGroep('Plaats', plaatsZoeker('wz', W.plaats), W.plaats ? `Gekozen: <b>${esc(W.plaats)}</b> — voor het weer op het startscherm. Optioneel.` : 'Voor het weer op het startscherm. Optioneel.')}
        ${veldGroep('KNVB-kalender', `<select class="invoer" id="wzDistrict"><option value="zuid" ${W.district === 'zuid' ? 'selected' : ''}>Districten Zuid I en II (ingebouwd)</option><option value="eigen" ${W.district === 'eigen' ? 'selected' : ''}>Ander district — kalender later importeren</option></select>`)}
        ${knoppen(false)}`;
      koppelPlaatsZoeker(b, 'wz', p => { W.plaats = p.plaats; W.lat = p.lat; W.lon = p.lon; W.naam = b.querySelector('#wzNaam').value; W.district = b.querySelector('#wzDistrict').value; teken(); });
    } else if (W.stap === 2){
      const vs = W.afkHandmatig ? W.afk : afkVoorstel(W.naam);
      b.innerHTML = kop() + `
        ${veldGroep('Afkorting', `<input class="invoer" id="wzAfk" maxlength="6" value="${esc(vs)}" style="text-transform:uppercase" autocomplete="off">`, 'Voorvoegsel van teamcodes, bv. RKVVJO11-1.')}
        <div class="veldgroep"><label>Logo (optioneel)</label>
          <div style="display:flex;align-items:center;gap:14px"><img id="wzLogoV" src="${esc(W.logo || CLUPPIE_LOGO)}" alt="" style="width:64px;height:64px;object-fit:contain;border-radius:12px;background:rgba(255,255,255,.06);padding:5px">
            <input type="file" id="wzLogoF" accept="image/*" style="display:none"><button class="knop licht klein" id="wzLogoK">Kiezen…</button>${W.logo ? '<button class="knop licht klein" id="wzLogoW">Weg</button>' : ''}</div></div>
        <div class="veldgroep"><label>Hoofdkleur</label><input type="color" id="wzKleur" value="${W.kleur}" style="width:56px;height:44px;border:none;background:none;padding:0"></div>
        ${knoppen(false)}`;
      b.querySelector('#wzLogoK').onclick = () => b.querySelector('#wzLogoF').click();
      b.querySelector('#wzLogoW')?.addEventListener('click', () => { W.logo = ''; teken(); });
      b.querySelector('#wzLogoF').onchange = async ev => {
        const f = ev.target.files && ev.target.files[0]; if (!f) return;
        W.afk = b.querySelector('#wzAfk').value; W.afkHandmatig = true; W.kleur = b.querySelector('#wzKleur').value;
        try { W.logo = await verwerkLogo(f); teken(); } catch (e){ meld(e.message || 'Logo mislukt'); }
      };
    } else if (W.stap === 3){
      b.innerHTML = kop() + `
        ${veldGroep('Sportlink Client ID (optioneel)', `<input class="invoer" id="wzClient" placeholder="Bijv. oEGJY6X0n9" value="${esc(W.clientId)}" autocomplete="off" spellcheck="false">`,
          'De Client ID van jullie Sportlink Club.Dataservice. Daarmee haalt Cluppie programma, uitslagen en standen op. Kan ook later.')}
        ${veldGroep('Huidig seizoen', `<input class="invoer" id="wzSeizoen" maxlength="12" value="${esc(W.seizoen)}" autocomplete="off">`, 'Nieuwe wedstrijden, trainingen en beoordelingen krijgen dit label.')}
        <label class="ci-schakel"><input type="checkbox" id="wzAi" ${W.ai ? 'checked' : ''}><span>AI-functies aan (trainingen structureren, verslagen, chatbot)</span></label>
        ${knoppen(false)}`;
    } else {
      const opties = [`<label class="ci-schakel"><input type="radio" name="wzKopie" value="" ${W.kopie === '' ? 'checked' : ''}><span><b>Cluppie-standaard</b><br><small>Standaard domeinen, tags, leercurve en KNVB-regels. Je past alles daarna aan.</small></span></label>`]
        .concat(bronnen.map(c => `<label class="ci-schakel"><input type="radio" name="wzKopie" value="${esc(c.id)}" ${W.kopie === c.id ? 'checked' : ''}><span><b>Kopie van ${esc(c.naam)}</b><br><small>Neemt lijsten, regels, formatie en namen over. Teams, spelers en koppelingen niet.</small></span></label>`));
      b.innerHTML = kop() + `<p class="cb-uitleg" style="margin-bottom:10px">Waarmee begint ${esc(W.naam)}?</p>${opties.join('')}${knoppen(true)}`;
    }
    b.querySelector('#wzTerug')?.addEventListener('click', () => { lees(b); W.stap--; teken(); });
    b.querySelector('#wzVerder')?.addEventListener('click', () => volgende(b));
  };
  const lees = b => {
    if (W.stap === 1){ W.naam = b.querySelector('#wzNaam').value; W.district = b.querySelector('#wzDistrict').value; }
    else if (W.stap === 2){ W.afk = b.querySelector('#wzAfk').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); W.afkHandmatig = true; W.kleur = b.querySelector('#wzKleur').value; }
    else if (W.stap === 3){ W.clientId = b.querySelector('#wzClient').value.trim(); W.seizoen = b.querySelector('#wzSeizoen').value.trim(); W.ai = b.querySelector('#wzAi').checked; }
    else { const r = b.querySelector('input[name="wzKopie"]:checked'); W.kopie = r ? r.value : ''; }
  };
  const volgende = async b => {
    lees(b);
    if (W.stap === 1 && !W.naam.trim()) return meld('Vul een clubnaam in');
    if (W.stap === 3){
      if (W.clientId && !/^[A-Za-z0-9]{6,}$/.test(W.clientId)) return meld('Dat lijkt geen geldige Client ID');
      if (!/^\d{4}\/'\d{2}$/.test(W.seizoen)) return meld("Seizoen als 2026/'27");
    }
    if (W.stap < 4){ W.stap++; teken(); return; }
    const knop = b.querySelector('#wzVerder'); knop.disabled = true; knop.textContent = 'Bezig…';
    try {
      const id = await maakClub(W, bronnen);
      sluitModal(); meld('Club aangemaakt ✓'); if (naCreatie) naCreatie(id);
    } catch (e){
      console.error(e); knop.disabled = false; knop.textContent = 'Club aanmaken'; meld('Aanmaken mislukt: ' + (e.code || e.message));
    }
  };
  teken();
}

async function maakClub(W, bronnen){
  const naam = W.naam.trim();
  const afk = (W.afk || afkVoorstel(naam)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let eff = klon(NEUTRAAL);
  const bron = W.kopie ? bronnen.find(c => c.id === W.kopie) : null;
  if (bron){
    const src = effectief(bron), bronAfk = clubAfk(bron);
    eff = klon(src);
    if (eff.identiteit.kompasNaam === `${bronAfk}-kompas`) eff.identiteit.kompasNaam = `${afk || 'Club'}-kompas`;
  }
  eff.v = 1;
  eff.identiteit.afkorting = afk;
  eff.identiteit.logo = W.logo || '';
  eff.identiteit.kleur = W.kleur;
  eff.locatie = { plaats: W.plaats || '', lat: W.lat, lon: W.lon, district: W.district };
  eff.ai = { ...(eff.ai || {}), aan: W.ai };
  const data = {
    naam, code: nieuweCode(),
    admins: { [S.user.uid]: true },
    adminsInfo: { [S.user.uid]: { naam: S.user.displayName || S.user.email } },
    leden: { [S.user.uid]: true },
    teams: {},
    huidigSeizoen: W.seizoen,
    instellingen: eff,
    gemaakt: serverTimestamp(),
  };
  if (W.clientId) data.sportlinkClientId = W.clientId;
  const ref = await addDoc(collection(db, 'clubs'), data);
  return ref.id;
}
