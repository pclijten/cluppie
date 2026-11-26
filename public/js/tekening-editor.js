/* ==================== TEKENING- EN 3D-EDITOR (PLATFORM › BIBLIOTHEEK) ====================
   [20261116c] Alleen voor vormen in de trainingsbibliotheek, dus alleen voor de platformbeheerder
   (besluit Paul 16-11: "de 3D-editor is alleen voor trainingen die in de bibliotheek staan").

   De 3D-weergave van een oefening wordt afgeleid uit de tekening van de vorm (scene3d.js): elke lijn
   is één stap. Deze editor bewerkt dus de tekening: spelers, bal en lijnen in bovenaanzicht, met de
   stappen in volgorde eronder en een knop om het resultaat in 3D te bekijken.

   Gegevens: vorm.tekening = { spelers:[{nr,x,y,kant?}], lijnen:[{soort,punten:[[x,y],…]}], bal:[x,y],
   doeltjes, zones, pionnen }. Alle coördinaten zijn percentages van het speelvak (0–100), zoals in
   trainingsvorm-svg.js. Doeltjes, zones en pionnen blijven zoals ze zijn. Rolnamen, nooit spelersnamen.

   De functies bovenaan zijn puur (tests/tekening-editor.test.mjs). Opslaan doet platform-bibliotheek.js:
   de tekening is een gewoon veld van de vorm en gaat mee in de overlay (platform/bibliotheek/vormen/{id}). */
import { stappenVan, maak3DBlok } from './scene3d.js?v=20261126p';

export const SOORTEN = { pass: 'Pass', loopweg: 'Loopt', dribbel: 'Dribbelt', schot: 'Schot' };
export const KANTEN = { eigen: 'Eigen team', tegen: 'Tegenstander', joker: 'Joker', keeper: 'Keeper' };
const MAX_SPELERS = 22, MAX_LIJNEN = 30, VANG = 6;

/* ---------- puur ---------- */
export const rond = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const afstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function leegTekening(){ return { spelers: [], lijnen: [] }; }
function zeker(t){ t.spelers = Array.isArray(t.spelers) ? t.spelers : []; t.lijnen = Array.isArray(t.lijnen) ? t.lijnen : []; return t; }

export function voegSpelerToe(t, kant, x, y){
  zeker(t);
  if (t.spelers.length >= MAX_SPELERS) return -1;
  const nr = t.spelers.reduce((m, s) => Math.max(m, Number(s.nr) || 0), 0) + 1;
  const s = { nr, x: rond(x), y: rond(y) };
  if (kant && kant !== 'eigen' && KANTEN[kant]) s.kant = kant;
  t.spelers.push(s);
  return t.spelers.length - 1;
}
/* Verplaatst een speler; lijnpunten die op zijn plek lagen gaan mee, zodat de stappen blijven kloppen. */
export function verplaatsSpeler(t, i, x, y){
  zeker(t);
  const s = t.spelers[i]; if (!s) return;
  const oud = [s.x, s.y], nieuw = [rond(x), rond(y)];
  for (const l of t.lijnen) l.punten = l.punten.map(p => afstand(p, oud) <= 2.5 ? [...nieuw] : p);
  if (t.bal && afstand(t.bal, oud) <= 6) t.bal = [Math.min(100, nieuw[0] + (t.bal[0] - oud[0])), Math.min(100, nieuw[1] + (t.bal[1] - oud[1]))].map(rond);
  s.x = nieuw[0]; s.y = nieuw[1];
}
export function verwijderSpeler(t, i){ zeker(t); if (t.spelers[i]) t.spelers.splice(i, 1); }
export function zetKant(t, i, kant){
  zeker(t); const s = t.spelers[i]; if (!s || !KANTEN[kant]) return;
  if (kant === 'eigen') delete s.kant; else s.kant = kant;
}
/* Een punt dicht bij een speler klikt vast op die speler. */
export function vang(t, p){
  zeker(t);
  const dichtst = t.spelers.reduce((b, s) => { const d = afstand([s.x, s.y], p); return d <= VANG && (!b || d < b.d) ? { s, d } : b; }, null);
  return dichtst ? [dichtst.s.x, dichtst.s.y] : [rond(p[0]), rond(p[1])];
}
export function voegLijnToe(t, soort, van, naar){
  zeker(t);
  if (!SOORTEN[soort] || t.lijnen.length >= MAX_LIJNEN) return -1;
  const a = vang(t, van), b = soort === 'pass' ? vang(t, naar) : [rond(naar[0]), rond(naar[1])];
  if (afstand(a, b) < 3) return -1;                       /* te kort om een stap te zijn */
  t.lijnen.push({ soort, punten: [a, b] });
  return t.lijnen.length - 1;
}
export function verwijderLijn(t, i){ zeker(t); if (t.lijnen[i]) t.lijnen.splice(i, 1); }
export function verschuifLijn(t, i, richting){
  zeker(t); const j = i + richting;
  if (!t.lijnen[i] || j < 0 || j >= t.lijnen.length) return i;
  [t.lijnen[i], t.lijnen[j]] = [t.lijnen[j], t.lijnen[i]];
  return j;
}
/* [20261116h] Een stap alleen in 3D tonen (niet in de tekening) of tegelijk met de stap ervoor laten spelen. */
export function wisselVlag(t, i, vlag){
  zeker(t); const l = t.lijnen[i]; if (!l || !['vervolg', 'samen'].includes(vlag)) return;
  if (vlag === 'samen' && i === 0) return;                /* de eerste stap heeft geen stap ervoor */
  if (l[vlag]) delete l[vlag]; else l[vlag] = true;
}
export function zetSoort(t, i, soort){ zeker(t); if (t.lijnen[i] && SOORTEN[soort]) t.lijnen[i].soort = soort; }
export function zetBal(t, x, y){ t.bal = [rond(x), rond(y)]; }
export function balWeg(t){ delete t.bal; }

/* Controle vóór opslaan: lijst met meldingen (leeg = goed). */
export function controleerTekening(t){
  const f = [];
  if (!t) return f;
  const ok = v => typeof v === 'number' && v >= 0 && v <= 100;
  for (const s of t.spelers || []) if (!ok(s.x) || !ok(s.y)) f.push(`Speler ${s.nr} staat buiten het vak`);
  (t.lijnen || []).forEach((l, i) => {
    if (!SOORTEN[l.soort]) f.push(`Stap ${i + 1}: onbekende soort lijn`);
    if (!Array.isArray(l.punten) || l.punten.length < 2 || l.punten.some(p => !ok(p[0]) || !ok(p[1]))) f.push(`Stap ${i + 1}: lijn klopt niet`);
  });
  if (t.bal && (!ok(t.bal[0]) || !ok(t.bal[1]))) f.push('De bal ligt buiten het vak');
  return f;
}

/* ---------- tekenen ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const klas = k => k === 'tegen' ? 'tv-tegen' : (k === 'joker' || k === 'keeper') ? 'tv-joker' : 'tv-eigen';
const BREED = 340;
function hoogte(veld){ const v = veld || { b: 20, l: 20 }; return Math.max(150, Math.min(300, Math.round(BREED * (v.l || 20) / (v.b || 20)))); }

export function svgEditor(vorm, st){
  const t = vorm.tekening || leegTekening(), H = hoogte(vorm.veld);
  const X = x => +(x / 100 * BREED).toFixed(1), Y = y => +(y / 100 * H).toFixed(1);
  let s = `<svg class="tv-veld te-svg" viewBox="0 0 ${BREED} ${H}" data-h="${H}" role="application" aria-label="Tekening bewerken">`;
  s += `<defs><marker id="tePijl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1 L9 5 L0 9z" class="tv-pijl"/></marker></defs>`;
  s += `<rect x="0" y="0" width="${BREED}" height="${H}" rx="3" class="tv-rand"/>`;
  for (const z of t.zones || []){
    s += `<rect x="${X(z.x)}" y="${Y(z.y)}" width="${X(z.b)}" height="${Y(z.h)}" class="tv-zone"/>`;
    if (z.label) s += `<text x="${X(z.x + z.b / 2)}" y="${Y(z.y + z.h / 2)}" class="tv-zonetekst" text-anchor="middle" dominant-baseline="middle">${esc(z.label)}</text>`;
  }
  for (const d of t.doeltjes || []){
    const w = d.breed / 100 * BREED, y = d.kant === 'boven' ? 0 : H;
    s += `<rect x="${+(d.x / 100 * BREED - w / 2).toFixed(1)}" y="${y - 3}" width="${+w.toFixed(1)}" height="6" rx="1" class="tv-doel"/>`;
  }
  for (const p of t.pionnen || []){ const x = X(p[0]), y = Y(p[1]); s += `<polygon points="${x},${y - 5} ${x - 4},${y + 3} ${x + 4},${y + 3}" class="tv-pion"/>`; }
  (t.lijnen || []).forEach((l, i) => {
    const pts = l.punten.map(p => `${X(p[0])},${Y(p[1])}`).join(' ');
    const m = l.punten[Math.floor((l.punten.length - 1) / 2)], n = l.punten[Math.ceil((l.punten.length - 1) / 2)];
    const mx = X((m[0] + n[0]) / 2), my = Y((m[1] + n[1]) / 2);
    s += `<polyline points="${pts}" class="tv-lijn tv-${esc(l.soort)}${st.lijn === i ? ' te-gekozen' : ''}" marker-end="url(#tePijl)"/>`;
    s += `<g class="te-stapnr${st.lijn === i ? ' te-gekozen' : ''}" data-te-lijn="${i}"><circle cx="${mx}" cy="${my}" r="8"/><text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central">${i + 1}</text></g>`;
  });
  (t.spelers || []).forEach((p, i) => {
    s += `<g class="te-speler${st.speler === i ? ' te-gekozen' : ''}" data-te-speler="${i}"><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="11" class="tv-speler ${klas(p.kant)}"/><text x="${X(p.x)}" y="${Y(p.y)}" class="tv-nr ${klas(p.kant)}" text-anchor="middle" dominant-baseline="central">${p.kant === 'keeper' ? 'K' : esc(p.nr)}</text></g>`;
  });
  if (t.bal) s += `<circle cx="${X(t.bal[0])}" cy="${Y(t.bal[1])}" r="5" class="tv-bal"/>`;
  if (st.van) s += `<circle cx="${X(st.van[0])}" cy="${Y(st.van[1])}" r="6" class="te-van"/>`;
  return s + '</svg>';
}

export function htmlEditor(vorm, st){
  const t = vorm.tekening || leegTekening(), stappen = stappenVan(vorm);
  const knop = (m, n) => `<button type="button" class="tm-chip${st.modus === m ? ' aan' : ''}" data-te="modus" data-k="${m}">${n}</button>`;
  const hulp = st.modus === 'speler' ? 'Tik in het vak om een speler neer te zetten.'
    : st.modus === 'lijn' ? (st.van ? 'Tik waar de lijn eindigt.' : 'Tik waar de lijn begint (op een speler klikt hij vast).')
    : st.modus === 'bal' ? 'Tik waar de bal ligt.'
    : 'Sleep een speler. Tik op een speler of een stapnummer om te kiezen.';
  const sp = t.spelers?.[st.speler];
  return `<div class="te" data-te-root>
    <div class="te-balk">${knop('kies', 'Verplaatsen')}${knop('speler', '+ Speler')}${knop('lijn', '+ Lijn')}${knop('bal', 'Bal')}
      ${st.modus === 'speler' ? `<select class="invoer te-sel" data-te="kant" aria-label="Soort speler">${Object.entries(KANTEN).map(([k, n]) => `<option value="${k}"${st.kant === k ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}
      ${st.modus === 'lijn' ? `<select class="invoer te-sel" data-te="soort" aria-label="Soort lijn">${Object.entries(SOORTEN).map(([k, n]) => `<option value="${k}"${st.soort === k ? ' selected' : ''}>${n}</option>`).join('')}</select>` : ''}
    </div>
    <p class="te-hulp">${hulp}</p>
    <div class="pb-veld te-vak">${svgEditor(vorm, st)}</div>
    ${sp ? `<div class="te-keuze"><b>${sp.kant === 'keeper' ? 'Keeper' : 'Speler ' + esc(sp.nr)}</b>
        <select class="invoer te-sel" data-te="spelerkant" aria-label="Soort speler">${Object.entries(KANTEN).map(([k, n]) => `<option value="${k}"${(sp.kant || 'eigen') === k ? ' selected' : ''}>${n}</option>`).join('')}</select>
        <button type="button" class="knop licht klein" data-te="spelerweg">Verwijder speler</button></div>` : ''}
    <div class="te-kop">Stappen in 3D <small>(elke lijn is één stap, in deze volgorde)</small></div>
    <p class="te-hulp">Teken het hele spelverloop: ook de reactie van de tegenstander en de afronding. Met “alleen 3D” blijft de tekening rustig; met “tegelijk” speelt een stap samen met de vorige. Bij minder dan 5 stappen vult 3D zelf een voorbeeld van het vervolg aan.</p>
    ${stappen.length ? `<ol class="te-stappen">${stappen.map((s, i) => `<li class="${st.lijn === i ? 'te-gekozen' : ''}" data-te-rij="${i}">
        <span class="te-tekst">${esc(s.tekst)}</span>
        <span class="te-acties"><select class="invoer te-sel" data-te="lijnsoort" data-i="${i}" aria-label="Soort lijn van stap ${i + 1}">${Object.entries(SOORTEN).map(([k, n]) => `<option value="${k}"${t.lijnen[i].soort === k ? ' selected' : ''}>${n}</option>`).join('')}</select>
          <button type="button" class="tm-chip tm-mini${t.lijnen[i].vervolg ? ' aan' : ''}" data-te="vervolg" data-i="${i}" aria-pressed="${!!t.lijnen[i].vervolg}" title="Deze stap staat niet in de tekening, alleen in 3D">alleen 3D</button>
          ${i ? `<button type="button" class="tm-chip tm-mini${t.lijnen[i].samen ? ' aan' : ''}" data-te="samen" data-i="${i}" aria-pressed="${!!t.lijnen[i].samen}" title="Speelt tegelijk met de stap ervoor">tegelijk</button>` : ''}
          <button type="button" class="knop licht klein" data-te="op" data-i="${i}" aria-label="Stap ${i + 1} eerder"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="knop licht klein" data-te="neer" data-i="${i}" aria-label="Stap ${i + 1} later"${i === stappen.length - 1 ? ' disabled' : ''}>↓</button>
          <button type="button" class="knop licht klein" data-te="lijnweg" data-i="${i}" aria-label="Stap ${i + 1} verwijderen">✕</button></span></li>`).join('')}</ol>`
      : '<p class="te-hulp">Nog geen lijnen. Kies + Lijn en teken een pass, loopactie, dribbel of schot.</p>'}
    <div class="te-voet"><button type="button" class="knop licht klein" data-te="3d">${st.drieD ? 'Verberg 3D' : 'Bekijk in 3D'}</button>
      ${t.bal ? '<button type="button" class="knop licht klein" data-te="balweg">Bal weghalen</button>' : ''}</div>
    <div class="te-3d" data-te-3d></div>
  </div>`;
}

/* ---------- bediening ----------
   koppelEditor(houder, vorm, { opWijzig }): tekent de editor in `houder` en houdt hem bij.
   `vorm` is het concept dat platform-bibliotheek.js bewaart; de editor wijzigt alleen vorm.tekening. */
export function koppelEditor(houder, vorm, { opWijzig = () => {} } = {}){
  const st = { modus: 'kies', kant: 'eigen', soort: 'pass', speler: -1, lijn: -1, van: null, drieD: false };
  let blok3d = null, sleep = null;
  const t = () => (vorm.tekening = vorm.tekening || leegTekening());
  const punt = e => {
    const svg = houder.querySelector('.te-svg'), r = svg.getBoundingClientRect();
    return [rond((e.clientX - r.left) / r.width * 100), rond((e.clientY - r.top) / r.height * 100)];
  };
  const toon3D = () => {
    const el = houder.querySelector('[data-te-3d]'); if (!el) return;
    if (blok3d){ try { blok3d.weg(); } catch (e){ /* al weg */ } blok3d = null; }
    if (st.drieD){ blok3d = maak3DBlok(vorm, vorm.veld); el.appendChild(blok3d); }
  };
  const teken = (gewijzigd) => {
    houder.innerHTML = htmlEditor(vorm, st);
    toon3D();
    if (gewijzigd) opWijzig();
  };

  houder.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-te-speler]');
    if (!g || st.modus !== 'kies') return;
    const i = Number(g.dataset.teSpeler);
    sleep = { i, g, bewogen: false }; st.speler = i; st.lijn = -1;
    try { g.setPointerCapture(e.pointerId); } catch (err){ /* oudere browser */ }
    e.preventDefault();
  });
  /* Tijdens het slepen blijft het element staan (een aanraking blijft aan zijn element hangen): alleen de
     cirkel en het nummer schuiven mee. Lijnen en stappen worden bijgewerkt bij het loslaten. */
  houder.addEventListener('pointermove', e => {
    if (!sleep) return;
    const [x, y] = punt(e);
    verplaatsSpeler(t(), sleep.i, x, y); sleep.bewogen = true;
    const svg = houder.querySelector('.te-svg'), H = Number(svg?.dataset.h) || 200;
    const cx = (x / 100 * BREED).toFixed(1), cy = (y / 100 * H).toFixed(1);
    const c = sleep.g.querySelector('circle'), n = sleep.g.querySelector('text');
    if (c){ c.setAttribute('cx', cx); c.setAttribute('cy', cy); }
    if (n){ n.setAttribute('x', cx); n.setAttribute('y', cy); }
  });
  const klaar = () => { if (!sleep) return; const b = sleep.bewogen; sleep = null; teken(b); };
  houder.addEventListener('pointerup', klaar);
  houder.addEventListener('pointercancel', klaar);

  houder.addEventListener('click', e => {
    const b = e.target.closest('[data-te]');
    if (b && b.tagName !== 'SELECT'){
      const a = b.dataset.te, i = Number(b.dataset.i);
      if (a === 'modus'){ st.modus = b.dataset.k; st.van = null; return teken(false); }
      if (a === 'spelerweg'){ verwijderSpeler(t(), st.speler); st.speler = -1; return teken(true); }
      if (a === 'lijnweg'){ verwijderLijn(t(), i); st.lijn = -1; return teken(true); }
      if (a === 'vervolg' || a === 'samen'){ wisselVlag(t(), i, a); return teken(true); }
      if (a === 'op'){ st.lijn = verschuifLijn(t(), i, -1); return teken(true); }
      if (a === 'neer'){ st.lijn = verschuifLijn(t(), i, 1); return teken(true); }
      if (a === 'balweg'){ balWeg(t()); return teken(true); }
      if (a === '3d'){ st.drieD = !st.drieD; return teken(false); }
      return;
    }
    const nr = e.target.closest('[data-te-lijn]');
    if (nr && st.modus === 'kies'){ st.lijn = Number(nr.dataset.teLijn); st.speler = -1; return teken(false); }
    const rij = e.target.closest('[data-te-rij]');
    if (rij && !e.target.closest('select, button')){ st.lijn = Number(rij.dataset.teRij); st.speler = -1; return teken(false); }
    if (!e.target.closest('.te-svg')) return;
    const p = punt(e);
    if (st.modus === 'speler'){ st.speler = voegSpelerToe(t(), st.kant, p[0], p[1]); st.lijn = -1; return teken(st.speler >= 0); }
    if (st.modus === 'bal'){ zetBal(t(), p[0], p[1]); return teken(true); }
    if (st.modus === 'lijn'){
      if (!st.van){ st.van = vang(t(), p); return teken(false); }
      const j = voegLijnToe(t(), st.soort, st.van, p); st.van = null;
      if (j >= 0) st.lijn = j;
      return teken(j >= 0);
    }
  });
  houder.addEventListener('change', e => {
    const a = e.target.dataset.te; if (!a) return;
    e.stopPropagation();                                 /* niet door naar het formulier van de bibliotheek */
    if (a === 'kant'){ st.kant = e.target.value; return; }
    if (a === 'soort'){ st.soort = e.target.value; return; }
    if (a === 'spelerkant'){ zetKant(t(), st.speler, e.target.value); return teken(true); }
    if (a === 'lijnsoort'){ zetSoort(t(), Number(e.target.dataset.i), e.target.value); return teken(true); }
  });
  houder.addEventListener('input', e => { if (e.target.dataset.te) e.stopPropagation(); });
  teken(false);
  return { weg(){ if (blok3d){ try { blok3d.weg(); } catch (e){ /* al weg */ } } } };
}
