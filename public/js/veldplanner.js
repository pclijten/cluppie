/* ==================== VELDPLANNER [20261124v] ====================
   Release 1 (basis) van de goedgekeurde mockup (docs/mockups/veldplanner, P3 24-11-2026):
   clubbeheer verdeelt de teams over velden, tijden en kleedkamers. Nog alleen een concept:
   er gaat niets naar de teams (Publiceren komt in release 2).

   Aan of uit: de eindbaas zet hem per club aan in het Platformcentrum
   (clubs/{id}.platformModules.veldplanner). Staat hij uit, dan is er geen tegel en
   weigeren de rules het schrijven.

   Wat je ziet
     • Weekstrip met per dag het aantal trainingen en de controles.
     • Dagtijdlijn: per veld vier banen (de kwarten). Een blok sleep je naar een andere tijd
       of een ander veld; aan het randje rechts maak je hem langer of korter. Pijltjes op het
       toetsenbord doen hetzelfde (links/rechts 15 minuten, op/neer ander veld), Delete haalt
       hem weg.
     • Zijbalk "Nog in te plannen": teams die nog niet vaak genoeg staan. Sleep een team naar
       een veld; sleep een blok terug naar de zijbalk om hem uit het rooster te halen.
     • Kleedkamerstrook: open 15 minuten voor tot 20 minuten na de training (gestreept).
     • Controles: botsing op het veld, dubbele kleedkamer, trainer dubbel, onderbouw na 19:30,
       veld zonder licht, te klein vak, geen kleedkamer. Met een snelle oplossing waar dat kan.
     • Per veld "Indelen": heel, half en kwart staan vast, eigen vakken teken je erbij.
     • Kleedkamers: namen en aantal (voorstel uit de plekken van de veldkaart).

   Opslag (geen spelersgegevens)
     clubs/{clubId}/veldroosters/basis      { naam, status:'concept', blokken:[{id, team, dag, start, eind,
                                              veld, vak, kk:[kleedkamerId]}], bijgewerktMs, door }
     clubs/{clubId}/veldplanner/instellingen { kleedkamers:[{id, naam}], velden:{ veldId:{ licht, vakken:[{id,
                                              naam, x, y, w, h}] } }, bijgewerktMs }
   Bewust niet op sportparken/eigen: de veldkaart schrijft daar de hele lijst velden opnieuw en zou
   eigen vakken weggooien. De velden zelf (id, naam) komen wel uit de veldkaart.
   Rekenwerk in veldplanner-logica.js (getest). */
import { db, doc, getDoc, setDoc, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261130f';
import { ico } from './icons.js?v=20261127b';
import { bouwVanTeam } from './bouw-indeling.js?v=20261130f';
import { momentenVanTeam } from './trainingsmomenten.js?v=20261130f';
import { NODIG, MAAT_NAAM, KK_VOOR, KK_NA, MAX_EIGEN, naarMin, naarTijd, rondKwartier,
  vakkenVan, vakUit, deelVan, deelTekst, meters, banenVan, stukken, maatVanCategorie, duurVanCategorie,
  zoekVrijVak, vrijeKleedkamers, stapel, controleer, nogInTePlannen, schoonRooster, schoonKleedkamers, schoonVak,
  kleedkamersVoorstel, SOORTEN, MAX_OBJECTEN, schoonObjecten, meterTussen, verschuif, vlakUitHoeken,
  leesTijd, leesPlanning, zetKleedTijden, schoonMinuten, schoonTeamInstellingen, schoonNegeer, kopieerDag, opMoment, kleedkamersOpMoment, drukte, vrijeKwarten, dagBereik, inVak, vakkenOverlap } from './veldplanner-logica.js?v=20261129y';

const DAGEN = ['', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const DAGK = ['', 'ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const BOUW = { onder: 'Onderbouw', midden: 'Middenbouw', boven: 'Bovenbouw', overig: 'Overig' };
const LH = 26, KOPB = 128;          // hoogte van een baan, breedte van de veldkop

let P = null;                        // de open planner

/* ---------- openen ---------- */
export async function openVeldplanner(clubId){
  clubId = clubId || S.clubId;
  if (!clubId) return;
  if (S.club?.platformModules?.veldplanner !== true) return meld('De Veldplanner staat niet aan voor deze club.');
  stijl();
  const el = laag();
  el.innerHTML = `<div class="vp-app"><div class="vp-leeg">${ico('action-loading', 20)} Veldplanner laden…</div></div>`;
  P = { clubId, el, dag: vandaagDag(), sel: null, hist: [], blokken: [], velden: [], teams: [], inst: { kleedkamers: [], velden: {} },
        bewaar: null, staat: 'opgeslagen', venster: null, px: 2, park: null,
        weergave: 'tijdlijn', tekenen: false, tool: 'kies', objSel: null, kaartPos: null, kaart: null };
  try {
    const [park, inst, rooster] = await Promise.all([
      getDoc(doc(db, 'clubs', clubId, 'sportparken', 'eigen')),
      getDoc(doc(db, 'clubs', clubId, 'veldplanner', 'instellingen')),
      getDoc(doc(db, 'clubs', clubId, 'veldroosters', 'basis')),
    ]);
    P.park = park.exists() ? park.data() : null;
    P.velden = (P.park?.velden || []).filter(v => v && v.id).map(v => ({ id: String(v.id), naam: String(v.naam || 'Veld') }))
      .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
    const i = inst.exists() ? inst.data() : {};
    P.instBestaat = inst.exists();
    P.inst = { kleedkamers: i.kleedkamers ? schoonKleedkamers(i.kleedkamers) : kleedkamersVoorstel(P.park?.plekken), velden: i.velden && typeof i.velden === 'object' ? i.velden : {}, objecten: schoonObjecten(i.objecten),
      kkVoor: schoonMinuten(i.kkVoor, 15), kkNa: schoonMinuten(i.kkNa, 20), teams: schoonTeamInstellingen(i.teams), negeer: schoonNegeer(i.negeer) };
    zetKleedTijden(P.inst.kkVoor, P.inst.kkNa);
    P.blokken = schoonRooster(rooster.exists() ? rooster.data().blokken : []);
  } catch (e){
    console.error('[veldplanner] laden', e);
    el.innerHTML = `<div class="vp-app"><div class="vp-leeg"><p>${e?.code === 'permission-denied' ? 'Geen toegang tot de Veldplanner. Zijn de Firestore-regels gepubliceerd?' : 'Laden mislukt. Probeer het zo opnieuw.'}</p><button class="knop" data-vp="sluit">Sluiten</button></div></div>`;
    el.querySelector('[data-vp="sluit"]').onclick = sluitVeldplanner;
    return;
  }
  P.teams = teamsVan(S.clubTeams || []);
  teken();
}
export function sluitVeldplanner(){
  if (!P) return;
  if (P.bewaar){ clearTimeout(P.bewaar); bewaarNu(); }
  ovStop(); clearInterval(P.ov?.klok);
  P.el.classList.remove('toon'); P.el.innerHTML = '';
  document.documentElement.classList.remove('vp-open');
  P = null;
}
function laag(){
  let el = document.getElementById('vpLaag');
  if (!el){
    el = document.createElement('div'); el.id = 'vpLaag'; el.className = 'vp-laag';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Veldplanner');
    document.body.appendChild(el);
    document.addEventListener('keydown', e => {
      if (!P || e.key !== 'Escape') return;
      e.stopPropagation();
      if (P.venster) sluitVenster(); else if (P.objSel){ P.objSel = null; tekenKaartZij(); P.kaart?.tekenLagen(); } else if (P.sel){ P.sel = null; teken(); } else sluitVeldplanner();
    }, true);
    window.addEventListener('resize', () => { if (P && !P.venster && P.weergave === 'tijdlijn') teken(); });
  }
  el.classList.add('toon');
  document.documentElement.classList.add('vp-open');
  return el;
}
const vandaagDag = () => { const d = new Date().getDay(); return d === 0 ? 7 : d; };

/* ---------- teams ---------- */
function teamsVan(lijst){
  return lijst.filter(t => t && t.id && !t.gearchiveerd).map(t => {
    const mom = momentenVanTeam(t), duren = mom.map(m => (naarMin(m.eind) ?? 0) - (naarMin(m.start) ?? 0)).filter(d => d >= 30 && d <= 180);
    const coaches = Object.keys(t.leden || {}).filter(u => t.leden[u] === true);
    const b = bouwVanTeam(t), eigen = P?.inst?.teams?.[t.id] || {};
    const auto = { maat: NODIG[t.veldMaat] ? t.veldMaat : maatVanCategorie(t.categorie, t.naam), duur: duren[0] || duurVanCategorie(t.categorie, t.naam), per: mom.length || 2 };
    return {
      id: t.id, naam: String(t.naam || 'Team'), bouw: BOUW[b] ? b : 'overig', auto,
      maat: eigen.maat || auto.maat, duur: eigen.duur || auto.duur, per: eigen.per ?? auto.per, eigen: !!Object.keys(eigen).length, momenten: mom, coaches,
      coachNamen: Object.fromEntries(coaches.map(u => [u, String(t.ledenInfo?.[u]?.naam || '').split(' ')[0] || 'Een trainer'])),
    };
  }).sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
}
const teamVan = id => P.teams.find(t => t.id === id) || { id, naam: 'Onbekend team', bouw: 'overig', maat: 'kwart', duur: 60, per: 0, coaches: [] };
const veldVan = id => P.velden.find(v => v.id === id) || { id, naam: 'Onbekend veld' };
const instVan = id => P.inst.velden[id] || {};
const lichtVan = id => instVan(id).licht !== false;
const kkNaam = id => P.inst.kleedkamers.find(k => k.id === id)?.naam || 'Kleedkamer';
const kkKort = id => (kkNaam(id).match(/\d+/) || [kkNaam(id).slice(0, 3)])[0];
const blok = id => P.blokken.find(b => b.id === id);
const nieuwId = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function ctx(){
  return {
    teams: Object.fromEntries(P.teams.map(t => [t.id, t])),
    velden: Object.fromEntries(P.velden.map(v => [v.id, { naam: v.naam, licht: lichtVan(v.id) }])),
    inst: P.inst.velden, kleedkamers: P.inst.kleedkamers, negeer: P.inst.negeer,
  };
}
const plekTekst = b => { const k = vakUit(vakkenVan(instVan(b.veld)), b.vak); return `${veldVan(b.veld).naam}${k.kort ? ' ' + k.kort : ''}`; };

/* ---------- geschiedenis en opslaan ---------- */
function bewaarStap(){ P.hist.push(JSON.stringify({ b: P.blokken, i: P.inst })); if (P.hist.length > 60) P.hist.shift(); }
function ongedaan(){
  const v = P.hist.pop(); if (!v) return;
  const o = JSON.parse(v); P.blokken = o.b; P.inst = o.i; zetKleedTijden(P.inst.kkVoor, P.inst.kkNa); P.teams = teamsVan(S.clubTeams || []);
  if (P.sel && !blok(P.sel)) P.sel = null;
  P.instGewijzigd = true; planBewaar(); teken(); meld('Laatste stap ongedaan gemaakt');
}
function planBewaar(){
  P.staat = 'bewaren'; zetStaat();
  clearTimeout(P.bewaar); P.bewaar = setTimeout(bewaarNu, 900);
}
async function bewaarNu(){
  const p = P; if (!p) return;
  p.bewaar = null;
  const klus = [setDoc(doc(db, 'clubs', p.clubId, 'veldroosters', 'basis'),
    { naam: 'Basisrooster', status: 'concept', blokken: schoonRooster(p.blokken), bijgewerktMs: Date.now(), door: S.user?.uid || null })];
  if (p.instGewijzigd){
    const velden = {};
    for (const v of p.velden){
      const i = p.inst.velden[v.id]; if (!i) continue;
      velden[v.id] = { licht: i.licht !== false, vakken: (i.vakken || []).map(schoonVak).filter(Boolean).slice(0, MAX_EIGEN) };
    }
    klus.push(setDoc(doc(db, 'clubs', p.clubId, 'veldplanner', 'instellingen'), { kleedkamers: schoonKleedkamers(p.inst.kleedkamers), velden, objecten: schoonObjecten(p.inst.objecten),
      kkVoor: schoonMinuten(p.inst.kkVoor, 15), kkNa: schoonMinuten(p.inst.kkNa, 20), teams: schoonTeamInstellingen(p.inst.teams), negeer: schoonNegeer(p.inst.negeer), bijgewerktMs: Date.now() }));
    p.instGewijzigd = false;
  }
  try { await Promise.all(klus); p.staat = 'opgeslagen'; p.om = new Date(); }
  catch (e){ console.error('[veldplanner] opslaan', e); p.staat = 'fout'; p.instGewijzigd = true;
    meld(e?.code === 'permission-denied' ? 'Opslaan mislukt: geen rechten. Staat de Veldplanner nog aan?' : 'Opslaan mislukt, geen verbinding. We proberen het bij de volgende wijziging opnieuw.'); }
  if (P === p) zetStaat();
}
function staatTekst(){
  if (P.staat === 'bewaren') return 'Bewaren…';
  if (P.staat === 'fout') return 'Niet opgeslagen';
  return P.om ? `Opgeslagen ${P.om.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : 'Wijzigingen worden vanzelf bewaard';   /* [20261129f] was 'Concept', dat staat er al naast */
}
function zetStaat(){ const s = P?.el.querySelector('.vp-staat'); if (s){ s.textContent = staatTekst(); s.classList.toggle('fout', P.staat === 'fout'); } }

/* ---------- tekenen ---------- */
function bereik(){
  const dag = P.blokken.filter(b => b.dag === P.dag);
  const van = Math.min(16 * 60, ...dag.map(b => b.start - KK_VOOR)), tot = Math.max(22 * 60 + 30, ...dag.map(b => b.eind + KK_NA));
  return [Math.floor(van / 60) * 60, Math.ceil(tot / 30) * 30];
}
const xVan = m => (m - P.van) * P.px;

function teken(){
  if (!P) return;
  const scrollL = P.el.querySelector('.vp-tl-scroll')?.scrollLeft || 0, scrollT = P.el.querySelector('.vp-app')?.scrollTop || 0;
  [P.van, P.tot] = bereik();
  const breed = Math.min(window.innerWidth, 1600);
  const ruimte = breed >= 1100 ? breed - 260 - 320 - 80 : breed - 32;
  P.px = Math.max(1.6, (ruimte - KOPB) / (P.tot - P.van));
  const c = controleer(P.blokken, ctx());
  P.status = c.status;
  P.el.innerHTML = `<div class="vp-app">
    <header class="vp-kop">
      <button type="button" class="vp-terug" data-vp="sluit" aria-label="Sluiten">‹</button>
      <div class="vp-titel"><small>${esc(S.club?.naam || 'Club')}</small><h1>Veldplanner</h1></div>
      <span class="vp-concept">Concept · nog niet naar de teams</span><span class="vp-staat" aria-live="polite">${esc(staatTekst())}</span>
      <div class="vp-acties">
        <div class="segment vp-segment" role="group" aria-label="Weergave"><button type="button" data-weergave="tijdlijn" aria-pressed="${P.weergave === 'tijdlijn'}">Tijdlijn</button><button type="button" data-weergave="overzicht" aria-pressed="${P.weergave === 'overzicht'}">Overzicht</button><button type="button" data-weergave="kaart" aria-pressed="${P.weergave === 'kaart'}">Kaart</button></div>
        <button type="button" class="knop licht klein" data-vp="ongedaan" ${P.hist.length ? '' : 'disabled'}>Ongedaan</button>
        <button type="button" class="knop licht klein" data-vp="inlezen">Inlezen</button>
        <button type="button" class="knop licht klein" data-vp="teams">Teams</button>
        <button type="button" class="knop licht klein" data-vp="kleedkamers">Kleedkamers (${P.inst.kleedkamers.length})</button>
      </div>
    </header>
    ${P.weergave === 'kaart' ? htmlKaart() : P.weergave === 'overzicht' && P.velden.length ? htmlOverzicht(c) : P.velden.length ? `${htmlDagen(c)}
    <div class="vp-grid">
      ${htmlZijbalk()}
      <section class="vp-paneel vp-tl" aria-label="Tijdlijn ${DAGEN[P.dag]}">
        <div class="vp-paneel-kop"><h2>${DAGEN[P.dag]}</h2><span class="vp-zacht">${(n => `${n} ${n === 1 ? 'training' : 'trainingen'}`)(P.blokken.filter(b => b.dag === P.dag).length)} · stappen van 15 minuten</span></div>
        <div class="vp-tl-scroll">${htmlTijdlijn()}${htmlKleedstrook()}</div>
        <div class="vp-legenda">${['onder', 'midden', 'boven'].map(b => `<span><i class="b-${b}"></i>${BOUW[b]}</span>`).join('')}<span><i class="bots"></i>Botsing</span></div>
      </section>
      <aside class="vp-rechts">${P.sel && blok(P.sel) ? htmlDetail() : ''}${htmlControle(c)}</aside>
    </div>` : htmlGeenVelden()}
  </div>`;
  const sc = P.el.querySelector('.vp-tl-scroll'); if (sc) sc.scrollLeft = scrollL;
  const app = P.el.querySelector('.vp-app'); if (app) app.scrollTop = scrollT;
  koppel();
  if (P.weergave === 'kaart') maakKaart();
  if (P.weergave === 'overzicht' && P.velden.length) koppelOverzicht();
}
function htmlGeenVelden(){
  return `<div class="vp-leeg"><h2>Eerst de velden</h2><p>De Veldplanner gebruikt de velden van jullie eigen sportpark. Teken ze eerst in bij Sportparken; daarna verschijnen ze hier vanzelf.</p>
    <button type="button" class="knop fluo" data-vp="sportpark">Naar Sportparken</button></div>`;
}
function htmlDagen(c){
  const dagen = [1, 2, 3, 4, 5, 6, 7].filter(d => d <= 5 || d === P.dag || P.blokken.some(b => b.dag === d));
  return `<nav class="vp-dagen" aria-label="Dagen">${dagen.map(d => {
    const n = P.blokken.filter(b => b.dag === d).length, f = c.lijst.filter(x => x.dag === d && x.soort === 'fout').length, w = c.lijst.filter(x => x.dag === d && x.soort === 'warn').length;
    return `<button type="button" class="vp-dag${d === P.dag ? ' aan' : ''}" data-dag="${d}" aria-pressed="${d === P.dag}">
      <b><span class="lang">${DAGEN[d]}</span><span class="kort">${DAGK[d]}</span></b><small>${n} <span class="lang">${n === 1 ? 'training' : 'trainingen'}</span></small>
      <span class="vp-dagstat">${f ? `<em class="f">${f} botsing${f === 1 ? '' : 'en'}</em>` : ''}${w ? `<em class="w">${w} let op</em>` : ''}${!f && !w && n ? '<em class="ok">Klopt</em>' : ''}</span></button>`;
  }).join('')}${dagen.includes(6) ? '' : `<button type="button" class="vp-dag plus" data-dag="6" aria-label="Zaterdag tonen">+ za</button>`}
    <button type="button" class="vp-dag plus vp-kopieer" data-vp="kopieer" ${P.blokken.some(b => b.dag === P.dag) ? '' : 'disabled'} title="Zet de trainingen van ${DAGEN[P.dag]} ook op andere dagen">${ico('action-copy', 16)}<span>Dag kopiëren</span></button></nav>`;
}
function htmlZijbalk(){
  const nog = nogInTePlannen(P.teams, P.blokken);
  const groepen = ['onder', 'midden', 'boven', 'overig'].map(b => [b, nog.filter(x => x.t.bouw === b)]).filter(([, l]) => l.length);
  return `<aside class="vp-paneel vp-zij" data-zij aria-label="Nog in te plannen">
    <div class="vp-paneel-kop"><h2>Nog in te plannen</h2><span class="vp-zacht">${nog.length}</span></div>
    <p class="vp-zacht vp-uitleg">Sleep een team naar een veld. Sleep een blok hierheen om het uit het rooster te halen.</p>
    ${P.teams.length ? '' : '<p class="vp-zacht">Nog geen teams bij de club.</p>'}
    ${nog.length ? groepen.map(([b, l]) => `<div class="vp-groep"><h3><i class="b-${b}"></i>${BOUW[b]}</h3>${l.map(({ t, n }) => `
      <div class="vp-teamkaart b-${b}" data-team="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.naam)} inplannen op ${DAGEN[P.dag].toLowerCase()}">
        <span><b>${esc(t.naam)}</b><small>${MAAT_NAAM[t.maat]} · ${t.duur} min</small></span><em>${n} van ${t.per}</em></div>`).join('')}</div>`).join('')
      : P.teams.length ? '<p class="vp-klaar">Alle teams staan erin.</p>' : ''}
  </aside>`;
}
function htmlTijdlijn(){
  const uren = []; for (let m = P.van; m <= P.tot; m += 60) uren.push(m);
  const breed = KOPB + (P.tot - P.van) * P.px;
  const rijen = P.velden.map(v => {
    const vakken = vakkenVan(instVan(v.id)), eigen = vakken.filter(k => k.eigen).length;
    const lijst = P.blokken.filter(b => b.dag === P.dag && b.veld === v.id), st = stapel(lijst, vakken);
    return `<div class="vp-rij">
      <div class="vp-veldkop"><b>${esc(v.naam)}</b>
        <button type="button" class="vp-licht${lichtVan(v.id) ? '' : ' uit'}" data-licht="${esc(v.id)}" aria-pressed="${lichtVan(v.id)}" title="Licht aan of uit">${lichtVan(v.id) ? 'Licht' : 'Geen licht'}</button>
        <button type="button" class="vp-indeel" data-indeel="${esc(v.id)}">${miniVeld(vakken)}<span>${eigen ? `+${eigen} eigen` : 'Indelen'}</span></button></div>
      <div class="vp-baan" data-veld="${esc(v.id)}" style="height:${LH * 4}px;width:${(P.tot - P.van) * P.px}px">
        ${['a voor', 'a achter', 'b voor', 'b achter'].map((n, i) => `<span class="vp-baannaam" style="top:${i * LH}px">${n}</span>`).join('')}
        ${uren.map(m => `<i class="vp-uurlijn" style="left:${xVan(m)}px"></i>`).join('')}
        ${!lichtVan(v.id) ? `<i class="vp-donker" style="left:${Math.max(0, xVan(17 * 60))}px"></i>` : ''}
        ${lijst.map(b => htmlBlok(b, vakken, st[b.id])).join('')}
      </div></div>`;
  }).join('');
  return `<div class="vp-tijden" style="width:${breed}px">${uren.map(m => `<span style="left:${KOPB + xVan(m)}px">${naarTijd(m)}</span>`).join('')}</div>
    <div class="vp-rijen" style="width:${breed}px">${rijen}</div>`;
}
function htmlBlok(b, vakken, sp = { i: 0, n: 1 }){
  const t = teamVan(b.team), k = vakUit(vakken, b.vak), w = xVan(b.eind) - xVan(b.start);
  const st = P.status[b.id], klas = `${st === 'botsing' ? ' botsing' : st === 'waarsch' ? ' waarsch' : ''}${P.sel === b.id ? ' gekozen' : ''}`;
  const kk = (b.kk || []).map(kkKort).join(',');
  return stukken(banenVan(k)).map(([l0, l1], i) => {
    const hoog = (l1 - l0 + 1) * LH / sp.n, een = hoog < 40;
    const stijl = `left:${xVan(b.start) + 1}px;width:${w - 2}px;top:${l0 * LH + sp.i * hoog + 1}px;height:${hoog - 2}px`;
    if (i > 0) return `<div class="vp-blok vervolg b-${t.bouw}${klas}" data-id="${b.id}" aria-hidden="true" style="${stijl}"><span class="t">${esc(t.naam)}</span></div>`;
    return `<div class="vp-blok b-${t.bouw}${een ? ' een' : ''}${klas}" data-id="${b.id}" tabindex="0" role="button" style="${stijl}"
      aria-label="${esc(t.naam)}, ${naarTijd(b.start)} tot ${naarTijd(b.eind)}, ${esc(plekTekst(b))}${kk ? ', ' + esc((b.kk || []).map(kkNaam).join(' en ')) : ''}">
      <span class="t">${esc(t.naam)}</span><span class="s">${naarTijd(b.start)}${w > 90 ? '–' + naarTijd(b.eind) : ''}${kk && w > 110 ? ` · kk ${esc(kk)}` : ''}</span>
      <span class="vp-greep" data-greep="1" aria-hidden="true"></span></div>`;
  }).join('');
}
function htmlKleedstrook(){
  if (!P.inst.kleedkamers.length) return '';
  const dag = P.blokken.filter(b => b.dag === P.dag);
  return `<div class="vp-kk" style="width:${KOPB + (P.tot - P.van) * P.px}px">
    <h3>Kleedkamers <small>open ${KK_VOOR} min voor tot ${KK_NA} min na de training (gestreept)</small></h3>
    ${P.inst.kleedkamers.map(k => `<div class="vp-kkrij"><span class="vp-kknaam">${esc(k.naam)}</span><div class="vp-kkbaan" style="width:${(P.tot - P.van) * P.px}px">
      ${dag.filter(b => (b.kk || []).includes(k.id)).map(b => { const t = teamVan(b.team);
        return `<button type="button" class="vp-kkblok b-${t.bouw}${P.status[b.id] === 'botsing' ? ' botsing' : ''}" data-kies="${b.id}"
          style="left:${xVan(b.start - KK_VOOR)}px;width:${(b.eind - b.start + KK_VOOR + KK_NA) * P.px}px;--voor:${KK_VOOR * P.px}px;--na:${KK_NA * P.px}px">${esc(t.naam)}</button>`; }).join('')}
    </div></div>`).join('')}</div>`;
}
function htmlControle(c){
  const f = c.lijst.filter(x => x.soort === 'fout').length, w = c.lijst.length - f;
  const knop = x => {
    const fix = x.fix ? { kk: 'Kies vrije kleedkamer', licht: 'Zoek veld met licht', veld: 'Zoek vrije plek', vak: 'Zoek groter vak' }[x.fix.soort] : '';
    return `<button type="button" class="knop licht klein" data-toon="${x.ids[0]}">Toon</button>${fix ? `<button type="button" class="knop licht klein" data-fix="${x.fix.soort}" data-id="${x.fix.id}">${fix}</button>` : ''}${x.soort === 'warn' && x.sleutel ? `<button type="button" class="knop licht klein vp-negeer" data-negeer="${esc(x.sleutel)}" title="Deze melding niet meer tonen">Wegklikken</button>` : ''}${x.wie ? `<button type="button" class="knop licht klein vp-negeer" data-negeertr="${esc(x.wie.uid)}" data-naam="${esc(x.wie.naam)}" title="Alle meldingen dat ${esc(x.wie.naam)} twee teams tegelijk traint niet meer tonen">Negeer voor ${esc(x.wie.naam)}</button>` : ''}`;
  };
  /* trainers die bij veel 'tegelijk'-meldingen staan (vaak een beheerder als invuller): in één klik weg */
  const perTrainer = new Map();
  c.lijst.forEach(x => { if (x.wie){ const o = perTrainer.get(x.wie.uid) || { ...x.wie, n: 0 }; o.n++; perTrainer.set(x.wie.uid, o); } });
  const veel = [...perTrainer.values()].filter(o => o.n >= 3).sort((a, b) => b.n - a.n).slice(0, 3);
  const lijst = [...c.lijst].sort((a, b) => (a.soort === 'fout' ? 0 : 1) - (b.soort === 'fout' ? 0 : 1) || (a.dag === P.dag ? 0 : 1) - (b.dag === P.dag ? 0 : 1) || a.dag - b.dag).slice(0, 40);
  return `<section class="vp-paneel vp-controle" aria-label="Controle">
    <div class="vp-paneel-kop"><h2>Controle</h2><span class="vp-zacht">hele week</span></div>
    <div class="vp-tellers"><div class="${f ? 'f' : ''}"><b>${f}</b><small>botsing${f === 1 ? '' : 'en'}</small></div><div class="${w ? 'w' : ''}"><b>${w}</b><small>waarschuwing${w === 1 ? '' : 'en'}</small></div></div>
    ${veel.map(o => `<div class="vp-negeerbalk"><p>${o.n} meldingen gaan over <b>${esc(o.naam)}</b> die twee teams tegelijk traint. Staat ${esc(o.naam)} alleen als invuller bij teams?</p>
      <button type="button" class="knop licht klein" data-negeertr="${esc(o.uid)}" data-naam="${esc(o.naam)}">Negeer voor ${esc(o.naam)}</button></div>`).join('')}
    ${c.genegeerd ? `<p class="vp-zacht vp-genegeerd">${c.genegeerd} ${c.genegeerd === 1 ? 'melding' : 'meldingen'} weggeklikt · <button type="button" class="vp-link" data-vp="negeerterug">Weer tonen</button></p>` : ''}
    ${lijst.length ? lijst.map(x => `<div class="vp-mld ${x.soort}"><span class="ic">${ico(x.soort === 'fout' ? 'action-blocked' : 'action-warning', 16)}</span>
      <div><small>${DAGEN[x.dag]}</small><p>${esc(x.tekst)}</p><div class="vp-mld-knoppen">${knop(x)}</div></div></div>`).join('')
      : `<p class="vp-klaar">${P.blokken.length ? 'Alles klopt.' : 'Nog niets ingepland.'}</p>`}
  </section>`;
}
function htmlDetail(){
  const b = blok(P.sel), t = teamVan(b.team), vakken = vakkenVan(instVan(b.veld));
  const vrij = new Set(vrijeKleedkamers(P.blokken, P.inst.kleedkamers, b, b.id));
  return `<section class="vp-paneel vp-detail" aria-label="${esc(t.naam)}">
    <div class="vp-paneel-kop"><h2>${esc(t.naam)}</h2><button type="button" class="vp-x" data-vp="deselect" aria-label="Sluiten">×</button></div>
    <p class="vp-zacht">${BOUW[t.bouw]}${t.coaches.length ? ` · ${esc(t.coaches.map(u => t.coachNamen[u]).join(', '))}` : ''}</p>
    <div class="vp-maatkeuze"><span>Dit team traint op</span><div class="segment vp-segment" role="group" aria-label="Veldmaat van ${esc(t.naam)}">${['kwart', 'half', 'heel'].map(m =>
      `<button type="button" data-teammaat="${m}" aria-pressed="${t.maat === m}">${m}</button>`).join('')}</div></div>
    <div class="vp-velden2">
      <label>Dag<select class="invoer" data-veldin="dag">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option value="${d}" ${d === b.dag ? 'selected' : ''}>${DAGEN[d]}</option>`).join('')}</select></label>
      <label>Veld<select class="invoer" data-veldin="veld">${P.velden.map(v => `<option value="${esc(v.id)}" ${v.id === b.veld ? 'selected' : ''}>${esc(v.naam)}</option>`).join('')}</select></label>
      <label>Van<input class="invoer" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="uu:mm" data-veldin="start" data-tijd value="${naarTijd(b.start)}" title="Typ bijv. 1730 of 17:30. Pijltje omhoog of omlaag: een kwartier verder of terug."></label>
      <label>Tot<input class="invoer" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="uu:mm" data-veldin="eind" data-tijd value="${naarTijd(b.eind)}" title="Typ bijv. 1845 of 18:45. Pijltje omhoog of omlaag: een kwartier verder of terug."></label>
      <label class="breed">Deel van het veld<select class="invoer" data-veldin="vak">${vakken.map(k => `<option value="${esc(k.id)}" ${k.id === b.vak ? 'selected' : ''}>${esc(k.naam)} (${k.eigen ? meters(k) : deelTekst(deelVan(k))})</option>`).join('')}</select></label>
    </div>
    ${P.inst.kleedkamers.length ? `<span class="vp-label">Kleedkamer</span><div class="vp-chips">${P.inst.kleedkamers.map(k => {
      const aan = (b.kk || []).includes(k.id);
      return `<button type="button" class="vp-chip${aan ? ' aan' : ''}${!aan && !vrij.has(k.id) ? ' bezet' : ''}" data-kk="${esc(k.id)}" aria-pressed="${aan}">${esc(k.naam)}</button>`; }).join('')}</div>` : ''}
    <div class="vp-detail-voet"><button type="button" class="knop gevaar klein" data-vp="weg">Uit het rooster</button></div>
  </section>`;
}
function miniVeld(vakken){
  const w = 30, h = 20;
  return `<svg width="${w}" height="${h}" viewBox="-1 -1 ${w + 2} ${h + 2}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1"><rect width="${w}" height="${h}" rx="1.5"/><path d="M${w / 2} 0v${h}M0 ${h / 2}h${w}" stroke-dasharray="2 1.5"/>${vakken.filter(k => k.eigen).map(k => `<rect x="${k.x * w}" y="${k.y * h}" width="${k.w * w}" height="${k.h * h}" fill="currentColor" fill-opacity=".45" stroke="none"/>`).join('')}</svg>`;
}

/* ---------- wijzigen ---------- */
function verzet(b, wijz, stil){
  bewaarStap();
  Object.assign(b, wijz);
  if (b.eind <= b.start) b.eind = b.start + 30;
  if (b.eind > 24 * 60){ b.start -= b.eind - 24 * 60; b.eind = 24 * 60; }
  if (b.start < 6 * 60){ b.eind += 6 * 60 - b.start; b.start = 6 * 60; }
  planBewaar(); teken();
  if (!stil) focusBlok(b.id);
}
function focusBlok(id){ requestAnimationFrame(() => P?.el.querySelector(`.vp-blok[data-id="${id}"]:not(.vervolg)`)?.focus({ preventScroll: true })); }
function plaats(b, veld, start){
  const t = teamVan(b.team), duur = b.eind - b.start;
  const vak = zoekVrijVak(P.blokken, instVan(veld), { dag: b.dag, veld, start, eind: start + duur, nodig: NODIG[t.maat], voorkeur: b.vak }, b.id)
    || (vakkenVan(instVan(veld)).some(k => k.id === b.vak) ? b.vak : 'h');
  return { veld, start, eind: start + duur, vak };
}
function nieuwBlok(teamId, veld, start, voorkeur){
  const t = teamVan(teamId);
  const b = { id: nieuwId(), team: teamId, dag: P.dag, start, eind: start + t.duur, veld, vak: 'h', kk: [] };
  const zelfde = P.blokken.find(x => x.team === teamId && x.dag === P.dag);
  b.vak = zoekVrijVak(P.blokken, instVan(veld), { dag: b.dag, veld, start, eind: b.eind, nodig: NODIG[t.maat], voorkeur }) || zoekVrijVak(P.blokken, instVan(veld), { dag: b.dag, veld, start, eind: b.eind, nodig: 0 }) || 'h';
  const kk = vrijeKleedkamers(P.blokken, P.inst.kleedkamers, b)[0]; if (kk) b.kk = [kk];
  bewaarStap(); P.blokken.push(b); P.sel = b.id; planBewaar(); teken(); focusBlok(b.id);
  meld(`${t.naam} staat op ${DAGEN[b.dag].toLowerCase()} op ${plekTekst(b)} om ${naarTijd(b.start)}.${zelfde ? ' Let op: dit team traint die dag al.' : ''}`);
}
function weg(id){
  const b = blok(id); if (!b) return;
  bewaarStap(); P.blokken = P.blokken.filter(x => x.id !== id); if (P.sel === id) P.sel = null;
  planBewaar(); teken(); meld(`${teamVan(b.team).naam} is uit het rooster gehaald.`);
}
function herstel(soort, id){
  const b = blok(id); if (!b) return;
  if (soort === 'kk'){
    const vrij = vrijeKleedkamers(P.blokken, P.inst.kleedkamers, b, b.id);
    if (!vrij.length) return meld('Er is op dat moment geen kleedkamer vrij.');
    verzet(b, { kk: [vrij[0]] }, true); return meld(`${teamVan(b.team).naam} krijgt ${kkNaam(vrij[0])}.`);
  }
  const t = teamVan(b.team);
  const velden = soort === 'licht' ? P.velden.filter(v => lichtVan(v.id)) : [veldVan(b.veld), ...P.velden.filter(v => v.id !== b.veld)];
  for (const v of velden){
    const vak = zoekVrijVak(P.blokken, instVan(v.id), { dag: b.dag, veld: v.id, start: b.start, eind: b.eind, nodig: NODIG[t.maat] }, b.id);
    if (vak){ verzet(b, { veld: v.id, vak }, true); return meld(`${t.naam} staat nu op ${plekTekst(b)}.`); }
  }
  meld('Geen vrije plek gevonden op dit tijdstip. Schuif de training naar een andere tijd.');
}

/* ---------- koppelen ---------- */
function koppel(){
  const el = P.el;
  el.querySelectorAll('[data-vp]').forEach(k => k.onclick = () => {
    const a = k.dataset.vp;
    if (a === 'sluit') return sluitVeldplanner();
    if (a === 'ongedaan') return ongedaan();
    if (a === 'kleedkamers') return vensterKleedkamers();
    if (a === 'teams') return vensterTeams();
    if (a === 'inlezen') return vensterInlezen();
    if (a === 'kopieer') return vensterKopieer();
    if (a === 'negeerterug'){ bewaarStap(); P.inst.negeer = { trainers: [], meldingen: [] }; P.instGewijzigd = true; planBewaar(); teken(); return meld('Alle weggeklikte meldingen staan weer aan.'); }
    if (a === 'deselect'){ P.sel = null; return teken(); }
    if (a === 'weg') return weg(P.sel);
    if (a === 'sportpark'){ const c = P.clubId; sluitVeldplanner(); return import('./veldkaart.js?v=20261130f').then(m => m.openSportparkBeheer(c)); }
  });
  el.querySelectorAll('[data-weergave]').forEach(k => k.onclick = () => { ovStop(); P.weergave = k.dataset.weergave; P.sel = null; P.objSel = null; teken(); });
  el.querySelectorAll('[data-dag]').forEach(k => k.onclick = () => { P.dag = +k.dataset.dag; P.sel = null; if (P.ov){ ovStop(); P.ov.t = null; P.ov.live = false; } teken(); });
  el.querySelectorAll('[data-licht]').forEach(k => k.onclick = () => {
    bewaarStap(); const id = k.dataset.licht; P.inst.velden[id] = { ...instVan(id), licht: !lichtVan(id) }; P.instGewijzigd = true; planBewaar(); teken();
  });
  el.querySelectorAll('[data-indeel]').forEach(k => k.onclick = () => vensterIndeling(k.dataset.indeel));
  el.querySelectorAll('[data-negeer]').forEach(k => k.onclick = () => { negeer('meldingen', k.dataset.negeer); meld('Melding weggeklikt. Met Ongedaan of "Weer tonen" komt hij terug.'); });
  el.querySelectorAll('[data-negeertr]').forEach(k => k.onclick = () => { negeer('trainers', k.dataset.negeertr); meld(`Meldingen over ${k.dataset.naam} die teams tegelijk traint staan uit.`); });
  el.querySelectorAll('[data-toon]').forEach(k => k.onclick = () => { const b = blok(k.dataset.toon); if (!b) return; P.dag = b.dag; P.sel = b.id; teken(); focusBlok(b.id); P.el.querySelector(`.vp-blok[data-id="${b.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' }); });
  el.querySelectorAll('[data-fix]').forEach(k => k.onclick = () => herstel(k.dataset.fix, k.dataset.id));
  el.querySelectorAll('[data-kies]').forEach(k => k.onclick = () => { P.sel = k.dataset.kies; teken(); focusBlok(P.sel); });
  el.querySelectorAll('[data-teammaat]').forEach(k => k.onclick = () => {
    const b = blok(P.sel); if (!b) return;
    zetTeamInst(b.team, { maat: k.dataset.teammaat });
    const t = teamVan(b.team), vak = zoekVrijVak(P.blokken, instVan(b.veld), { dag: b.dag, veld: b.veld, start: b.start, eind: b.eind, nodig: NODIG[t.maat], voorkeur: b.vak }, b.id);
    if (vak && vak !== b.vak && deelVan(vakUit(vakkenVan(instVan(b.veld)), b.vak)) < NODIG[t.maat] - 1e-6) b.vak = vak;
    planBewaar(); teken(); meld(`${t.naam} traint voortaan op een ${MAAT_NAAM[t.maat]}.`);
  });
  el.querySelectorAll('[data-kk]').forEach(k => k.onclick = () => {
    const b = blok(P.sel), id = k.dataset.kk, kk = b.kk || [];
    verzet(b, { kk: kk.includes(id) ? kk.filter(x => x !== id) : [...kk, id].slice(0, 4) }, true);
  });
  el.querySelectorAll('[data-veldin]').forEach(k => k.onchange = () => {
    const b = blok(P.sel), v = k.value, s = k.dataset.veldin;
    if (s === 'dag') verzet(b, { dag: +v }, true);
    else if (s === 'veld') verzet(b, plaats(b, v, b.start), true);
    else if (s === 'vak') verzet(b, { vak: v }, true);
    else if (s === 'start' || s === 'eind'){   /* [20261127v] gewoon typen: 1730, 17:30, 17.30, 9 */
      const m = leesTijd(v), oud = s === 'start' ? b.start : b.eind;
      if (m == null){ k.value = naarTijd(oud); return meld('Dat is geen tijd. Typ bijvoorbeeld 1730 of 17:30.'); }
      if (m === oud){ k.value = naarTijd(oud); return; }
      if (s === 'start'){
        if (m < 6 * 60 || m + (b.eind - b.start) > 24 * 60){ k.value = naarTijd(oud); return meld('Een training kan tussen 06:00 en 24:00.'); }
        verzet(b, { start: m, eind: m + (b.eind - b.start) }, true);
      } else {
        if (m <= b.start){ k.value = naarTijd(oud); return meld(`De training begint om ${naarTijd(b.start)}; de eindtijd moet later zijn.`); }
        verzet(b, { eind: m }, true);
      }
    }
    if (s === 'dag'){ P.dag = b.dag; teken(); }
  });
  el.querySelectorAll('[data-tijd]').forEach(k => k.addEventListener('keydown', e => {
    const terug = () => { const n = P?.el.querySelector(`[data-veldin="${k.dataset.veldin}"]`); if (n && n !== k){ n.focus(); n.select(); } };
    if (e.key === 'Enter'){ e.preventDefault(); k.dispatchEvent(new Event('change')); terug(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      e.preventDefault();
      const m = leesTijd(k.value); if (m == null) return;
      k.value = naarTijd(Math.max(0, Math.min(24 * 60, e.key === 'ArrowUp' ? Math.floor(m / 15) * 15 + 15 : Math.ceil(m / 15) * 15 - 15)));
      k.dispatchEvent(new Event('change')); terug();
    }
  }));
  el.querySelectorAll('.vp-blok:not(.vervolg)').forEach(k => {
    k.addEventListener('pointerdown', e => sleepBlok(e, k));
    k.addEventListener('keydown', e => toetsBlok(e, k.dataset.id));
  });
  el.querySelectorAll('.vp-blok.vervolg').forEach(k => k.onclick = () => { P.sel = k.dataset.id; teken(); focusBlok(P.sel); });
  el.querySelectorAll('[data-team]').forEach(k => {
    k.addEventListener('pointerdown', e => sleepTeam(e, k));
    k.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); plaatsTeamVrij(k.dataset.team); } });
  });
}
/* Toetsenbord of tik zonder slepen: eerste vrije plek vanaf 17:00, op de gekozen dag of anders
   de eerstvolgende doordeweekse dag waarop het team nog niet traint (niet twee dagen achter elkaar als het kan). */
function plaatsTeamVrij(teamId){
  const t = teamVan(teamId), al = new Set(P.blokken.filter(b => b.team === teamId).map(b => b.dag));
  const volgorde = [0, 1, 2, 3, 4].map(i => ((P.dag - 1 + i) % 5) + 1).filter(d => !al.has(d));
  const rust = volgorde.filter(d => !al.has(d - 1) && !al.has(d + 1));
  const dagen = P.dag > 5 && !al.has(P.dag) ? [P.dag] : [...new Set([...rust, ...volgorde])];
  for (const dag of dagen) for (let m = 17 * 60; m + t.duur <= 22 * 60 + 30; m += 15) for (const v of P.velden){
    if (zoekVrijVak(P.blokken, instVan(v.id), { dag, veld: v.id, start: m, eind: m + t.duur, nodig: NODIG[t.maat] })){ P.dag = dag; return nieuwBlok(teamId, v.id, m); }
  }
  meld(`Geen vrije plek gevonden voor ${t.naam}. Sleep het team zelf naar een veld.`);
}
function toetsBlok(e, id){
  const b = blok(id); if (!b) return;
  const i = P.velden.findIndex(v => v.id === b.veld);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); const d = e.key === 'ArrowLeft' ? -15 : 15; verzet(b, { start: b.start + d, eind: b.eind + d }); }
  else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && P.velden.length > 1){
    e.preventDefault(); const v = P.velden[(i + (e.key === 'ArrowUp' ? -1 : 1) + P.velden.length) % P.velden.length];
    verzet(b, plaats(b, v.id, b.start));
  }
  else if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); weg(id); }
  else if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); P.sel = id; teken(); focusBlok(id); }
}
function baanOnder(x, y, behalve){
  const el = document.elementsFromPoint(x, y).find(e => !behalve || !behalve.contains(e));
  return { baan: el?.closest('.vp-baan'), zij: el?.closest('[data-zij]') };
}
function sleepBlok(e, k){
  if (e.button !== 0) return;
  const b = blok(k.dataset.id); if (!b) return;
  const rek = !!e.target.closest('[data-greep]');
  e.preventDefault(); k.setPointerCapture(e.pointerId);
  const x0 = e.clientX, y0 = e.clientY, start0 = b.start, eind0 = b.eind, w0 = k.offsetWidth;
  let bewogen = false, doel = null;
  const mv = ev => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!bewogen && Math.hypot(dx, dy) < 5) return;
    if (!bewogen){ bewogen = true; k.classList.add('sleept'); P.el.classList.add('vp-sleep'); }
    const dm = rondKwartier(dx / P.px);
    if (rek){ const eind = Math.max(start0 + 30, eind0 + dm); k.style.width = `${(eind - start0) * P.px - 2}px`; k.querySelector('.s').textContent = `${naarTijd(start0)}–${naarTijd(eind)}`; doel = { eind }; return; }
    k.style.transform = `translate(${dm * P.px}px, ${dy}px)`;
    k.querySelector('.s').textContent = `${naarTijd(start0 + dm)}–${naarTijd(eind0 + dm)}`;
    const o = baanOnder(ev.clientX, ev.clientY, k);
    P.el.querySelectorAll('.vp-baan.doel, [data-zij].doel').forEach(x => x.classList.remove('doel'));
    (o.baan || o.zij)?.classList.add('doel');
    doel = { start: start0 + dm, veld: o.baan?.dataset.veld, zij: !!o.zij };
  };
  const op = () => {
    k.removeEventListener('pointermove', mv); k.removeEventListener('pointerup', op); k.removeEventListener('pointercancel', op);
    P.el.classList.remove('vp-sleep');
    if (!bewogen){ P.sel = b.id; teken(); focusBlok(b.id); return; }
    if (!doel) return teken();
    if (rek) return verzet(b, { eind: doel.eind });
    if (doel.zij) return weg(b.id);
    if (!doel.veld){ k.style.width = `${w0}px`; return teken(); }
    verzet(b, plaats(b, doel.veld, doel.start));
  };
  k.addEventListener('pointermove', mv); k.addEventListener('pointerup', op); k.addEventListener('pointercancel', op);
}
function sleepTeam(e, k){
  if (e.button !== 0) return;
  const t = teamVan(k.dataset.team);
  e.preventDefault(); k.setPointerCapture(e.pointerId);
  const x0 = e.clientX, y0 = e.clientY;
  let spook = null, doel = null;
  const mv = ev => {
    if (!spook && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!spook){
      spook = document.createElement('div'); spook.className = `vp-blok vp-spook b-${t.bouw}`;
      spook.style.width = `${t.duur * P.px}px`; spook.style.height = `${LH * 2 - 2}px`;
      spook.innerHTML = `<span class="t">${esc(t.naam)}</span><span class="s"></span>`; document.body.appendChild(spook);
      P.el.classList.add('vp-sleep');
    }
    spook.style.left = `${ev.clientX - 10}px`; spook.style.top = `${ev.clientY - 12}px`;
    const o = baanOnder(ev.clientX, ev.clientY);
    P.el.querySelectorAll('.vp-baan.doel').forEach(x => x.classList.remove('doel'));
    if (o.baan){
      o.baan.classList.add('doel');
      const r = o.baan.getBoundingClientRect(), start = Math.max(P.van, rondKwartier(P.van + (ev.clientX - 10 - r.left) / P.px));
      spook.querySelector('.s').textContent = `${naarTijd(start)}–${naarTijd(start + t.duur)}`;
      doel = { veld: o.baan.dataset.veld, start };
    } else { spook.querySelector('.s').textContent = ''; doel = null; }
  };
  const op = () => {
    k.removeEventListener('pointermove', mv); k.removeEventListener('pointerup', op); k.removeEventListener('pointercancel', op);
    P.el.classList.remove('vp-sleep'); P.el.querySelectorAll('.vp-baan.doel').forEach(x => x.classList.remove('doel'));
    if (!spook) return plaatsTeamVrij(t.id);
    spook.remove();
    if (doel) nieuwBlok(t.id, doel.veld, doel.start);
  };
  k.addEventListener('pointermove', mv); k.addEventListener('pointerup', op); k.addEventListener('pointercancel', op);
}

/* ---------- kaart: luchtfoto met velden en eigen tekeningen [20261124v] ----------
   De luchtfoto en het schuiven en zoomen komen uit de veldkaart (Kaart in veldkaart.js). De velden en de
   plekken van de veldkaart staan erop ter oriëntatie; wat de club hier tekent (parkeren, kantine, AED …)
   staat in veldplanner/instellingen.objecten. Vlakken trek je met de muis of een vinger, punten tik je aan. */
function htmlKaart(){
  if (P.park?.lat == null) return `<div class="vp-leeg"><h2>Eerst het sportpark</h2><p>Zet het eigen sportpark eerst op de kaart bij Sportparken. Daarna kun je hier tekenen.</p>
    <button type="button" class="knop fluo" data-vp="sportpark">Naar Sportparken</button></div>`;
  return `<div class="vp-kaartgrid">
    <section class="vp-paneel vp-kaartpaneel" aria-label="Kaart van het sportpark">
      <div class="vp-paneel-kop"><h2>${esc(P.park.naam || 'Sportpark')}</h2>
        <button type="button" class="knop ${P.tekenen ? 'fluo' : 'licht'} klein" data-tekenen aria-pressed="${P.tekenen}">${P.tekenen ? 'Klaar met tekenen' : 'Tekenen'}</button></div>
      <div id="vpKaart" class="vk-kaart vp-kaart${P.tekenen && P.tool !== 'kies' ? ' kruis' : ''}"></div>
      <p class="vp-zacht vp-bron">Velden en de losse plekken komen uit Sportparken; wat je hier tekent staat in de Veldplanner.</p>
    </section>
    <aside class="vp-paneel vp-kaartzij" aria-label="Tekenen">${htmlKaartZij()}</aside></div>`;
}
function htmlKaartZij(){
  const o = P.inst.objecten.find(x => x.id === P.objSel), d = o && SOORTEN[o.soort];
  const lijst = P.inst.objecten.map(x => `<button type="button" class="vp-objregel${x.id === P.objSel ? ' aan' : ''}" data-objkies="${esc(x.id)}">
    <i style="--sk:${SOORTEN[x.soort].kleur}">${esc(SOORTEN[x.soort].kort)}</i><span>${esc(x.naam)}</span><small>${x.b ? `${Math.round(x.b)} × ${Math.round(x.h)} m` : 'punt'}</small></button>`).join('');
  return `<div class="vp-paneel-kop"><h2>${P.tekenen ? 'Tekenen' : 'Op de kaart'}</h2><span class="vp-zacht">${P.inst.objecten.length}</span></div>
    ${P.tekenen ? `<div class="vp-tools" role="group" aria-label="Wat teken je">
      <button type="button" class="vp-tool${P.tool === 'kies' ? ' aan' : ''}" data-tool="kies" aria-pressed="${P.tool === 'kies'}">Aanwijzen</button>
      ${Object.entries(SOORTEN).map(([k, x]) => `<button type="button" class="vp-tool${P.tool === k ? ' aan' : ''}" data-tool="${k}" aria-pressed="${P.tool === k}"><i style="--sk:${x.kleur}">${esc(x.kort)}</i>${esc(x.naam)}</button>`).join('')}</div>
      <p class="vp-zacht">${P.tool === 'kies' ? 'Tik iets aan om het te kiezen; sleep om te verplaatsen, of aan het hoekje voor de maat. Sleep op een lege plek om de kaart te schuiven.'
        : SOORTEN[P.tool].vlak ? `Sleep op de kaart om ${SOORTEN[P.tool].naam.toLowerCase()} te tekenen.` : `Tik op de kaart waar ${SOORTEN[P.tool].naam === 'AED' ? 'de AED hangt' : 'het ' + SOORTEN[P.tool].naam.toLowerCase() + ' is'}.`}${P.inst.objecten.length >= MAX_OBJECTEN ? ` Maximaal ${MAX_OBJECTEN} tekeningen.` : ''}</p>`
      : '<p class="vp-zacht">Parkeren, de kantine, de AED en meer. Klik op Tekenen om iets toe te voegen of te wijzigen.</p>'}
    ${o && P.tekenen ? `<div class="vp-objdetail"><label class="vp-label" for="vpONaam">${esc(d.naam)}${o.b ? ` · ${Math.round(o.b)} × ${Math.round(o.h)} m` : ''}</label>
      <div class="vp-rij2"><input class="invoer" id="vpONaam" value="${esc(o.naam)}" maxlength="40"><button type="button" class="knop gevaar klein" data-objweg>Verwijder</button></div></div>` : ''}
    <div class="vp-objlijst">${lijst || '<p class="vp-zacht">Nog niets getekend.</p>'}</div>`;
}
function tekenKaartZij(){
  const z = P?.el.querySelector('.vp-kaartzij'); if (!z) return;
  z.innerHTML = htmlKaartZij();
  const og = P.el.querySelector('[data-vp="ongedaan"]'); if (og) og.disabled = !P.hist.length;
  P.el.querySelector('#vpKaart')?.classList.toggle('kruis', P.tekenen && P.tool !== 'kies');
  z.querySelectorAll('[data-tool]').forEach(k => k.onclick = () => { P.tool = k.dataset.tool; P.objSel = null; tekenKaartZij(); P.kaart?.tekenLagen(); });
  z.querySelectorAll('[data-objkies]').forEach(k => k.onclick = () => {
    P.objSel = k.dataset.objkies; const o = P.inst.objecten.find(x => x.id === P.objSel);
    if (o && P.kaart) P.kaart.centreer({ lat: o.lat, lon: o.lon });
    tekenKaartZij(); P.kaart?.tekenLagen();
  });
  const naam = z.querySelector('#vpONaam');
  if (naam){
    let eerst = true;
    naam.oninput = () => { const o = P.inst.objecten.find(x => x.id === P.objSel); if (!o) return;
      if (eerst){ bewaarStap(); eerst = false; } o.naam = naam.value.slice(0, 40); P.instGewijzigd = true; planBewaar(); P.kaart?.tekenLagen();
      const r = z.querySelector(`[data-objkies="${o.id}"] span`); if (r) r.textContent = o.naam; };
  }
  z.querySelector('[data-objweg]')?.addEventListener('click', () => {
    bewaarStap(); P.inst.objecten = P.inst.objecten.filter(x => x.id !== P.objSel); P.objSel = null;
    P.instGewijzigd = true; planBewaar(); tekenKaartZij(); P.kaart?.tekenLagen();
  });
}
function lagenKaart(k){
  const uit = [];
  for (const v of P.park?.velden || []){
    if (v.lat == null) continue;
    const p = k.px(v.lat, v.lon);
    if (!v.lengte){ uit.push(`<div class="vk-stip" style="left:${p.x}px;top:${p.y}px"><span>${esc(v.naam || 'Veld')}</span></div>`); continue; }
    uit.push(`<div class="vk-veld" style="left:${p.x}px;top:${p.y}px;width:${k.m2px(v.lengte)}px;height:${k.m2px(v.breedte)}px;transform:translate(-50%,-50%) rotate(${v.hoek || 0}deg)">
      <i class="vk-l-rand"></i><i class="vk-l-mid"></i><i class="vk-l-cirkel"></i><span class="vk-veld-naam" style="transform:rotate(${-(v.hoek || 0)}deg)">${esc(v.naam || 'Veld')}</span></div>`);
  }
  for (const pl of P.park?.plekken || []){
    if (pl.lat == null) continue;
    const p = k.px(pl.lat, pl.lon);
    uit.push(`<div class="vp-oudplek" style="left:${p.x}px;top:${p.y}px">${esc(pl.naam || 'Plek')}</div>`);
  }
  for (const o of P.inst.objecten){
    const d = SOORTEN[o.soort], p = k.px(o.lat, o.lon), aan = o.id === P.objSel;
    if (d.vlak){
      const w = k.m2px(o.b), h = k.m2px(o.h);
      uit.push(`<div class="vp-obj vlak${aan ? ' aan' : ''}" style="--sk:${d.kleur};left:${p.x - w / 2}px;top:${p.y - h / 2}px;width:${w}px;height:${h}px">
        <span><i>${esc(d.kort)}</i>${w > 50 ? esc(o.naam) : ''}</span>${aan && P.tekenen ? '<b class="vp-objgreep"></b>' : ''}</div>`);
    } else uit.push(`<div class="vp-obj punt${aan ? ' aan' : ''}" style="--sk:${d.kleur};left:${p.x}px;top:${p.y}px"><i>${esc(d.kort)}</i><span>${esc(o.naam)}</span></div>`);
  }
  if (P.nieuwVlak){
    const a = k.px(P.nieuwVlak.a.lat, P.nieuwVlak.a.lon), b = k.px(P.nieuwVlak.b.lat, P.nieuwVlak.b.lon);
    uit.push(`<div class="vp-obj vlak nieuw" style="--sk:${SOORTEN[P.tool]?.kleur || '#fff'};left:${Math.min(a.x, b.x)}px;top:${Math.min(a.y, b.y)}px;width:${Math.abs(b.x - a.x)}px;height:${Math.abs(b.y - a.y)}px"></div>`);
  }
  return uit.join('');
}
/* Wat ligt er onder de vinger? Eerst het hoekje van het gekozen vlak, dan punten, dan vlakken (kleinste eerst). */
function raak(k, x, y){
  const sel = P.inst.objecten.find(o => o.id === P.objSel);
  if (sel?.b){ const p = k.px(sel.lat, sel.lon), w = k.m2px(sel.b), h = k.m2px(sel.h);
    if (Math.hypot(x - (p.x + w / 2), y - (p.y + h / 2)) < 16) return { o: sel, maat: true }; }
  for (const o of [...P.inst.objecten].reverse()) if (!o.b){ const p = k.px(o.lat, o.lon); if (Math.hypot(x - p.x, y - p.y) < 16) return { o }; }
  const vlakken = P.inst.objecten.filter(o => o.b).sort((a, b) => a.b * a.h - b.b * b.h);
  for (const o of vlakken){ const p = k.px(o.lat, o.lon), w = k.m2px(o.b) / 2, h = k.m2px(o.h) / 2;
    if (Math.abs(x - p.x) <= Math.max(w, 8) && Math.abs(y - p.y) <= Math.max(h, 8)) return { o }; }
  return null;
}
async function maakKaart(){
  const el = P.el.querySelector('#vpKaart'); if (!el) return;
  const { Kaart } = await import('./veldkaart.js?v=20261130f');
  if (!P || !el.isConnected) return;
  const pos = P.kaartPos || { lat: P.park.lat, lon: P.park.lon, z: Math.min(19, P.park.zoom || 18) };
  const rel = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const k = new Kaart(el, { lat: pos.lat, lon: pos.lon, z: pos.z, interactief: true, omgeving: () => P?.park?.omgeving?.vormen, lagen: lagenKaart,
    grijp: (e, kaart) => {
      if (!P.tekenen) return null;
      const q = rel(e), h = P.tool === 'kies' || !SOORTEN[P.tool]?.vlak ? raak(kaart, q.x, q.y) : null, start = kaart.ll(q.x, q.y);
      if (h){
        const o = h.o, oud = { ...o };
        const hoek = verschuif(o, -o.b / 2 || 0, -o.h / 2 || 0);      // linksboven blijft staan bij de maat
        let eerste = true;
        return {
          move: ll => {
            if (eerste){ bewaarStap(); eerste = false; P.objSel = o.id; }
            if (h.maat){ Object.assign(o, vlakUitHoeken({ lat: hoek.lat, lon: hoek.lon }, ll)); o.b = Math.max(2, o.b); o.h = Math.max(2, o.h); }
            else { const d = meterTussen(start, ll), n = verschuif(oud, d.x, d.y); o.lat = n.lat; o.lon = n.lon; }
            kaart.tekenLagen();
          },
          eind: bewogen => { P.objSel = o.id; if (bewogen){ P.instGewijzigd = true; planBewaar(); } tekenKaartZij(); kaart.tekenLagen(); },
        };
      }
      if (SOORTEN[P.tool]?.vlak && P.inst.objecten.length < MAX_OBJECTEN){
        P.nieuwVlak = { a: start, b: start };
        return {
          move: ll => { P.nieuwVlak.b = ll; kaart.tekenLagen(); },
          eind: () => {
            const v = vlakUitHoeken(P.nieuwVlak.a, P.nieuwVlak.b); P.nieuwVlak = null;
            if (v.b < 2 || v.h < 2){ kaart.tekenLagen(); return meld('Sleep een groter vlak, minstens 2 bij 2 meter.'); }
            voegObject({ soort: P.tool, ...v });
          },
        };
      }
      return null;
    },
    onTik: ll => {
      if (!P.tekenen) return;
      if (P.tool === 'kies'){ if (P.objSel){ P.objSel = null; tekenKaartZij(); k.tekenLagen(); } return; }
      if (!SOORTEN[P.tool].vlak && P.inst.objecten.length < MAX_OBJECTEN) voegObject({ soort: P.tool, lat: ll.lat, lon: ll.lon });
    } });
  P.kaart = k;
  const bewaarPos = () => { P.kaartPos = { lat: k.lat, lon: k.lon, z: k.z }; };
  el.addEventListener('pointerup', bewaarPos); el.addEventListener('wheel', bewaarPos, { passive: true });
  el.addEventListener('click', e => { if (e.target.closest('[data-vk-z]')) bewaarPos(); });
  if (!P.kaartPos && (P.park.velden || []).some(v => v.lat != null)) k.pasIn((P.park.velden || []).filter(v => v.lat != null), 40);
  tekenKaartZij();
  P.el.querySelector('[data-tekenen]').onclick = () => {
    P.tekenen = !P.tekenen; P.objSel = null; P.tool = 'kies';
    const b = P.el.querySelector('[data-tekenen]'); b.textContent = P.tekenen ? 'Klaar met tekenen' : 'Tekenen';
    b.classList.toggle('fluo', P.tekenen); b.classList.toggle('licht', !P.tekenen); b.setAttribute('aria-pressed', P.tekenen);
    tekenKaartZij(); k.tekenLagen();
  };
}
function voegObject(o){
  const nrs = P.inst.objecten.map(x => parseInt((x.id.match(/\d+/) || [0])[0], 10));
  const nieuw = { id: `o${Math.max(0, ...nrs) + 1}`, naam: SOORTEN[o.soort].naam, ...o };
  if (!SOORTEN[o.soort].vlak){ delete nieuw.b; delete nieuw.h; }
  bewaarStap(); P.inst.objecten.push(nieuw); P.objSel = nieuw.id; P.instGewijzigd = true; planBewaar();
  tekenKaartZij(); P.kaart?.tekenLagen();
  P.el.querySelector('#vpONaam')?.select();
  meld(`${SOORTEN[o.soort].naam} getekend. Geef het eventueel een naam.`);
}

/* ---------- overzicht: het park op één moment, met een tijdlijnbalk [20261127v] ----------
   Kies een dag, sleep door de tijd of druk op afspelen: op de luchtfoto (of, zonder ingetekende velden,
   op een schema) zie je welk team op welk deel van welk veld staat en in welke kleedkamer het zit.
   Filters dimmen wat niet past, zodat je de rest van het park blijft zien. Rechts: wie er nu is, wie
   straks komt en per kleedkamer of het team zich omkleedt, traint of doucht. Tik een team aan om het te
   wijzigen; met "Vrije plekken" zie je waar nog ruimte is en plan je daar meteen een team in.
   Alleen lezen en tekenen; wijzigen gaat via dezelfde functies als de tijdlijn. */
const FASE = { voor: 'omkleden', training: 'traint', na: 'douchen' };
const SNEL = [2.5, 5, 10, 20], SNELN = ['½×', '1×', '2×', '4×'];      // minuten per seconde
const nuMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
function ovStart(){
  if (!P.ov) P.ov = { t: null, spelen: false, snel: 1, bouw: [], team: '', veld: '', kk: '', vrij: false, live: false, raf: 0, klok: 0, getekend: null };
  return P.ov;
}
function ovBeginT(van, tot){
  const nu = nuMin();
  if (P.dag === vandaagDag() && nu >= van && nu <= tot) return nu;
  const d = P.blokken.filter(b => b.dag === P.dag).sort((a, b) => a.start - b.start);
  return d.length ? d[0].start + 5 : van;
}
function ovPast(b){
  const o = P.ov, t = teamVan(b.team);
  return (!o.bouw.length || o.bouw.includes(t.bouw)) && (!o.team || b.team === o.team) && (!o.veld || b.veld === o.veld) && (!o.kk || (b.kk || []).includes(o.kk));
}
const ovFilterAan = () => { const o = P.ov; return !!(o.bouw.length || o.team || o.veld || o.kk); };
const heeftGeo = () => P.park?.lat != null && (P.park.velden || []).some(v => v.lat != null && v.lengte);
const kkPlek = () => {
  const o = P.inst.objecten.find(x => x.soort === 'kleedkamers'); if (o) return o;
  return (P.park?.plekken || []).find(x => x.soort === 'kleedkamer' && x.lat != null) || null;
};
const kkLijst = b => (b.kk || []).map(kkKort).join(', ');
const I_SPEEL = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>';
const I_PAUZE = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z" fill="currentColor"/></svg>';

function htmlOverzicht(c){
  const o = ovStart();
  [o.van, o.tot] = dagBereik(P.blokken, P.dag);
  if (o.t == null || o.t < o.van || o.t > o.tot) o.t = ovBeginT(o.van, o.tot);
  o.getekend = Math.floor(o.t);
  const ids = [...new Set(P.blokken.map(b => b.team))];
  if (o.team && !ids.includes(o.team)) ids.push(o.team);
  const teams = ids.map(teamVan).sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
  const sel = (soort, leeg, lijst) => `<select class="invoer vp-fsel${o[soort] ? ' aan' : ''}" data-ovf="${soort}" aria-label="${leeg}"><option value="">${leeg}</option>${lijst.map(([id, naam]) => `<option value="${esc(id)}" ${o[soort] === id ? 'selected' : ''}>${esc(naam)}</option>`).join('')}</select>`;
  return `${htmlDagen(c)}
  <div class="vp-ovgrid">
    <section class="vp-paneel vp-ovpaneel" aria-label="Overzicht ${DAGEN[P.dag]}">
      <div class="vp-ovkop">
        <div class="vp-ovklok"><small>${DAGEN[P.dag]}</small><b data-ovklok>${naarTijd(o.getekend)}</b></div>
        <div class="vp-ovfilters" role="group" aria-label="Filters">
          ${['onder', 'midden', 'boven'].map(b => `<button type="button" class="vp-fchip b-${b}${o.bouw.includes(b) ? ' aan' : ''}" data-ovbouw="${b}" aria-pressed="${o.bouw.includes(b)}"><i></i>${BOUW[b]}</button>`).join('')}
          ${sel('team', 'Alle teams', teams.map(t => [t.id, t.naam]))}
          ${P.velden.length > 1 ? sel('veld', 'Alle velden', P.velden.map(v => [v.id, v.naam])) : ''}
          ${P.inst.kleedkamers.length ? sel('kk', 'Alle kleedkamers', P.inst.kleedkamers.map(k => [k.id, k.naam])) : ''}
          <button type="button" class="vp-fchip vrij${o.vrij ? ' aan' : ''}" data-ovvrij aria-pressed="${o.vrij}" title="Toon waar op dit moment nog een kwart veld vrij is">Vrije plekken</button>
          ${ovFilterAan() ? '<button type="button" class="vp-fwis" data-ovwis>Wis filters</button>' : ''}
        </div>
      </div>
      ${heeftGeo() ? '<div id="vpOvKaart" class="vk-kaart vp-kaart vp-ovkaart"></div>' : `<div class="vp-ovschema" data-ovschema>${htmlSchema()}</div>`}
      ${htmlTijdbalk()}
    </section>
    <aside class="vp-rechts">${P.sel && blok(P.sel) ? htmlDetail() : ''}<section class="vp-paneel vp-ovnu" data-ovnulijst aria-live="polite">${htmlOvNu()}</section></aside>
  </div>`;
}
function htmlTijdbalk(){
  const o = P.ov, span = Math.max(60, o.tot - o.van);
  const d = drukte(P.blokken, P.inst.velden, { dag: P.dag, van: o.van, tot: o.tot, stap: 5, velden: P.velden.length });
  const nKk = P.inst.kleedkamers.length;
  const balken = d.map((x, i) => x.veld ? `<rect x="${i * 5 + .4}" y="${(1 - x.veld) * 36}" width="4.2" height="${x.veld * 36}"/>` : '').join('');
  const lijn = nKk ? d.map((x, i) => `${i ? 'L' : 'M'}${i * 5 + 2.5} ${(1 - Math.min(1, x.kk / nKk)) * 36}`).join('') : '';
  const sporen = ovFilterAan() ? P.blokken.filter(b => b.dag === P.dag && ovPast(b))
    .map(b => `<rect class="b-${teamVan(b.team).bouw}" x="${b.start - o.van}" y="39" width="${b.eind - b.start}" height="5"/>`).join('') : '';
  const uren = []; for (let m = Math.ceil(o.van / 60) * 60; m <= o.tot; m += 60) uren.push(m);
  return `<div class="vp-tijdbalk">
    <div class="vp-tbknoppen">
      <button type="button" class="vp-speel" data-ovspeel aria-label="${o.spelen ? 'Pauzeren' : 'Afspelen'}">${o.spelen ? I_PAUZE : I_SPEEL}</button>
      <button type="button" class="vp-tbknop" data-ovsnel aria-label="Afspeelsnelheid ${SNELN[o.snel]}" title="Afspeelsnelheid">${SNELN[o.snel]}</button>
      <button type="button" class="vp-tbknop${o.live ? ' aan' : ''}" data-ovnu aria-pressed="${o.live}" title="Spring naar vandaag, nu">Nu</button>
    </div>
    <div class="vp-tbspoor">
      <svg class="vp-drukte" viewBox="0 0 ${span} 44" preserveAspectRatio="none" aria-hidden="true">
        ${uren.map(m => `<line x1="${m - o.van}" x2="${m - o.van}" y1="0" y2="36" class="uur" vector-effect="non-scaling-stroke"/>`).join('')}
        <g class="balk">${balken}</g>${lijn ? `<path class="kkl" d="${lijn}" vector-effect="non-scaling-stroke"/>` : ''}<g class="spoor">${sporen}</g></svg>
      <input type="range" class="vp-schuif" data-ovschuif min="${o.van}" max="${o.tot}" step="1" value="${Math.floor(o.t)}" aria-label="Tijdstip" aria-valuetext="${naarTijd(Math.floor(o.t))}">
      <div class="vp-tburen" aria-hidden="true">${uren.map(m => `<span style="left:${(m - o.van) / span * 100}%">${naarTijd(m)}</span>`).join('')}</div>
    </div>
  </div>
  <p class="vp-zacht vp-tbuitleg"><span class="vp-tbleg balk"></span>bezetting van de velden${nKk ? '<span class="vp-tbleg kkl"></span>kleedkamers in gebruik' : ''}${ovFilterAan() ? '<span class="vp-tbleg spoor"></span>wat aan je filter voldoet' : ''}. Sleep, gebruik de pijltjes of druk op afspelen.</p>`;
}
/* Wat er op één veld staat om minuut t. Het veld is een doos van 100% × 100%; vakken als percentages.
   `hoek` draait de tekst terug zodat hij op de luchtfoto recht staat. */
function htmlVeldInhoud(veldId, hoek, t, px = 300){
  const vakken = vakkenVan(instVan(veldId)), o = P.ov, rot = hoek ? ` style="transform:rotate(${-hoek}deg)"` : '';
  const pos = k => `left:${k.x * 100}%;top:${k.y * 100}%;width:${k.w * 100}%;height:${k.h * 100}%`;
  const nu = opMoment(P.blokken, P.dag, t).filter(b => b.veld === veldId);
  let h = '';
  if (o.vrij) for (const id of vrijeKwarten(P.blokken, instVan(veldId), { dag: P.dag, veld: veldId, t }))
    h += `<div class="vp-ovvak vrij" style="${pos(vakUit(vakken, id))}"><span${rot}>vrij</span></div>`;
  for (const b of P.blokken.filter(x => x.dag === P.dag && x.veld === veldId && x.start > t && x.start <= t + 20)){
    const k = vakUit(vakken, b.vak);
    if (nu.some(x => vakkenOverlap(vakUit(vakken, x.vak), k))) continue;
    h += `<div class="vp-ovvak straks b-${teamVan(b.team).bouw}${ovPast(b) ? '' : ' dim'}" style="${pos(k)}"><span${rot}><b>${esc(teamVan(b.team).naam)}</b><small>om ${naarTijd(b.start)}</small></span></div>`;
  }
  for (const b of nu){
    const t2 = teamVan(b.team), kk = kkLijst(b);
    const k = vakUit(vakken, b.vak), ruim = k.w * px >= 84;   /* op een klein vak alleen de naam */
    h += `<div class="vp-ovvak b-${t2.bouw}${ovPast(b) ? '' : ' dim'}${P.sel === b.id ? ' aan' : ''}${P.status?.[b.id] === 'botsing' ? ' botsing' : ''}" data-ovblok="${b.id}" style="${pos(k)}">
      <span${rot}><b>${esc(t2.naam)}</b>${ruim ? `<small>${kk ? `kk ${esc(kk)} · ` : ''}tot ${naarTijd(b.eind)}</small>` : kk ? `<small>kk ${esc(kk)}</small>` : ''}</span></div>`;
  }
  return h;
}
function htmlSchema(){
  const t = Math.floor(P.ov.t), o = P.ov;
  return P.velden.map(v => `<div class="vp-schemaveld${o.veld && o.veld !== v.id ? ' dim' : ''}"><b>${esc(v.naam)}</b>
    <div class="vp-schemagras" data-schemaveld="${esc(v.id)}"><div class="vp-schemalijn"></div>${htmlVeldInhoud(v.id, 0, t)}</div></div>`).join('')
    + '<p class="vp-zacht vp-schemauitleg">Teken de velden in bij Sportparken, dan zie je dit op de luchtfoto van jullie eigen park.</p>';
}
function lagenOverzicht(k){
  const o = P.ov, t = Math.floor(o.t), uit = [], namen = [];
  for (const v of P.park?.velden || []){
    if (v.lat == null) continue;
    const p = k.px(v.lat, v.lon);
    if (!v.lengte){
      const n = opMoment(P.blokken, P.dag, t).filter(b => b.veld === v.id).length;
      uit.push(`<div class="vk-stip" style="left:${p.x}px;top:${p.y}px"><span>${esc(v.naam || 'Veld')}${n ? ` · ${n} ${n === 1 ? 'team' : 'teams'}` : ''}</span></div>`); continue;
    }
    const w = k.m2px(v.lengte), hoek = v.hoek || 0;
    uit.push(`<div class="vk-veld vp-ovveld${o.veld && o.veld !== v.id ? ' dim' : ''}" style="left:${p.x}px;top:${p.y}px;width:${w}px;height:${k.m2px(v.breedte)}px;--fs:${Math.max(10, Math.min(15, w / 11))}px;transform:translate(-50%,-50%) rotate(${hoek}deg)">
      <i class="vk-l-rand"></i><i class="vk-l-mid"></i><i class="vk-l-cirkel"></i>${htmlVeldInhoud(v.id, hoek, t, w)}</div>`);
    /* naam net buiten de bovenrand (in de draairichting van het veld), na de velden zodat niets hem afdekt */
    const r = k.m2px(v.breedte) / 2 + 11, a = hoek * Math.PI / 180;
    namen.push(`<span class="vp-ovveldnaam" style="left:${p.x + Math.sin(a) * r}px;top:${p.y - Math.cos(a) * r}px">${esc(v.naam || 'Veld')}</span>`);
  }
  uit.push(...namen);
  const plek = kkPlek();
  if (plek && P.inst.kleedkamers.length){
    const p = k.px(plek.lat, plek.lon), kk = kleedkamersOpMoment(P.blokken, P.dag, t);
    uit.push(`<div class="vp-ovkkkaart" style="left:${p.x}px;top:${p.y}px"><small>Kleedkamers</small><div>${P.inst.kleedkamers.slice(0, 16).map(x => {
      const z = kk[x.id], b = z && teamVan(z.blok.team), dim = (o.kk && o.kk !== x.id) || (z && !ovPast(z.blok));
      return `<span class="${z ? `f-${z.fase} b-${b.bouw}` : 'vrij'}${dim ? ' dim' : ''}" title="${esc(x.naam)}"><b>${esc(kkKort(x.id))}</b>${z ? esc(b.naam) : ''}</span>`; }).join('')}</div></div>`);
  }
  return uit.join('');
}
function htmlOvNu(){
  const o = P.ov, t = Math.floor(o.t), alle = opMoment(P.blokken, P.dag, t);
  const vi = id => P.velden.findIndex(v => v.id === id);
  const nu = alle.filter(ovPast).sort((a, b) => vi(a.veld) - vi(b.veld) || a.start - b.start);
  const straks = P.blokken.filter(b => b.dag === P.dag && b.start > t && b.start <= t + 30 && ovPast(b)).sort((a, b) => a.start - b.start);
  const kk = kleedkamersOpMoment(P.blokken, P.dag, t), nKk = P.inst.kleedkamers.length;
  const regel = (b, sub) => { const tm = teamVan(b.team), k = kkLijst(b);
    return `<button type="button" class="vp-ovregel b-${tm.bouw}${P.sel === b.id ? ' aan' : ''}" data-kies="${b.id}"><i></i><span><b>${esc(tm.naam)}</b><small>${esc(plekTekst(b))} · ${sub}</small></span>${k ? `<em>kk ${esc(k)}</em>` : ''}</button>`; };
  const tot = z => z.fase === 'voor' ? `tot ${naarTijd(z.blok.start)}` : z.fase === 'training' ? `terug ${naarTijd(z.blok.eind)}` : `vrij ${naarTijd(z.blok.eind + KK_NA)}`;
  return `<div class="vp-paneel-kop"><h2>Om ${naarTijd(t)}</h2><span class="vp-zacht">${DAGEN[P.dag].toLowerCase()}</span></div>
    <div class="vp-tellers${nKk ? ' drie' : ''}"><div><b>${alle.length}</b><small>${alle.length === 1 ? 'team' : 'teams'} bezig</small></div>
      <div><b>${new Set(alle.map(b => b.veld)).size}/${P.velden.length}</b><small>velden bezet</small></div>
      ${nKk ? `<div><b>${Object.keys(kk).length}/${nKk}</b><small>kleedkamers</small></div>` : ''}</div>
    ${nu.length ? nu.map(b => regel(b, `nog ${b.eind - t} min`)).join('')
      : `<p class="vp-zacht">${alle.length ? 'Geen team dat aan je filter voldoet.' : 'Op dit moment traint er niemand.'}</p>`}
    ${straks.length ? `<h3 class="vp-ovh3">Straks</h3>${straks.map(b => regel(b, `om ${naarTijd(b.start)} (over ${b.start - t} min)`)).join('')}` : ''}
    ${nKk ? `<h3 class="vp-ovh3">Kleedkamers</h3><div class="vp-ovkks">${P.inst.kleedkamers.map(x => {
      const z = kk[x.id], b = z && teamVan(z.blok.team), dim = (o.kk && o.kk !== x.id) || (z && !ovPast(z.blok));
      return `<button type="button" class="vp-ovkkt ${z ? `f-${z.fase} b-${b.bouw}` : 'vrij'}${dim ? ' dim' : ''}" ${z ? `data-kies="${z.blok.id}"` : 'disabled'} aria-label="${esc(x.naam)}: ${z ? `${esc(b.naam)}, ${FASE[z.fase]}` : 'vrij'}">
        <b>${esc(kkKort(x.id))}</b><span>${z ? esc(b.naam) : 'vrij'}</span><small>${z ? `${FASE[z.fase]} · ${tot(z)}` : '&nbsp;'}</small></button>`; }).join('')}</div>
      <p class="vp-zacht vp-ovleg"><span class="f-voor"></span>omkleden <span class="f-training"></span>traint <span class="f-na"></span>douchen</p>` : ''}`;
}

/* tekenen op een nieuw moment, zonder de hele planner opnieuw op te bouwen */
function ovMoment(forceer){
  const o = P?.ov; if (!o) return;
  const m = Math.floor(o.t);
  if (!forceer && m === o.getekend) return;
  o.getekend = m;
  const kl = P.el.querySelector('[data-ovklok]'); if (kl) kl.textContent = naarTijd(m);
  const s = P.el.querySelector('[data-ovschuif]'); if (s){ s.value = m; s.setAttribute('aria-valuetext', naarTijd(m)); }
  P.ovKaart?.tekenLagen();
  const sc = P.el.querySelector('[data-ovschema]'); if (sc) sc.innerHTML = htmlSchema();
  const lijst = P.el.querySelector('[data-ovnulijst]');
  if (lijst){ lijst.innerHTML = htmlOvNu(); koppelKies(lijst); }
}
function ovKnoppen(){
  const o = P?.ov; if (!o) return;
  const k = P.el.querySelector('[data-ovspeel]');
  if (k){ k.innerHTML = o.spelen ? I_PAUZE : I_SPEEL; k.setAttribute('aria-label', o.spelen ? 'Pauzeren' : 'Afspelen'); }
  const n = P.el.querySelector('[data-ovnu]'); if (n){ n.classList.toggle('aan', o.live); n.setAttribute('aria-pressed', o.live); }
}
function ovSpeel(){
  const o = P.ov;
  if (o.spelen) return ovStop();
  if (o.t >= o.tot) o.t = o.van;
  o.spelen = true; o.live = false;
  let vorig = performance.now();
  const stap = nu => {
    if (!P || P.ov !== o || !o.spelen) return;
    o.t = Math.min(o.tot, o.t + Math.min(250, nu - vorig) / 1000 * SNEL[o.snel]); vorig = nu;
    ovMoment();
    if (o.t >= o.tot) return ovStop();
    o.raf = requestAnimationFrame(stap);
  };
  o.raf = requestAnimationFrame(stap);
  ovKnoppen();
}
function ovStop(){
  const o = P?.ov; if (!o) return;
  o.spelen = false; cancelAnimationFrame(o.raf);
  ovKnoppen();
}
function ovNu(){
  const o = P.ov; ovStop();
  const dag = vandaagDag(), nu = nuMin(), [van, tot] = dagBereik(P.blokken, dag);
  o.live = true;
  clearInterval(o.klok);
  o.klok = setInterval(() => { if (!P || P.ov !== o){ clearInterval(o.klok); return; }
    if (o.live && !o.spelen && P.weergave === 'overzicht'){ o.t = Math.max(o.van, Math.min(o.tot, nuMin())); ovMoment(); } }, 20000);
  if (nu < van || nu > tot) meld(nu < van ? `Vandaag begint de eerste training om ${naarTijd(van + KK_VOOR)}.` : 'Vandaag is er na dit tijdstip geen training meer.');
  o.t = Math.max(van, Math.min(tot, nu));
  if (P.dag !== dag){ P.dag = dag; P.sel = null; teken(); } else { ovMoment(true); ovKnoppen(); }
}
function ovTik(ll){
  for (const v of P.park?.velden || []){
    if (v.lat == null || !v.lengte) continue;
    const d = meterTussen({ lat: v.lat, lon: v.lon }, ll), h = (v.hoek || 0) * Math.PI / 180;
    const fx = (d.x * Math.cos(h) + d.y * Math.sin(h)) / v.lengte + .5, fy = (-d.x * Math.sin(h) + d.y * Math.cos(h)) / v.breedte + .5;
    if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) return ovKiesPlek(v.id, fx, fy);
  }
  if (P.sel){ P.sel = null; teken(); }
}
function ovKiesPlek(veldId, fx, fy){
  const t = Math.floor(P.ov.t), vakken = vakkenVan(instVan(veldId));
  const hier = opMoment(P.blokken, P.dag, t).filter(b => b.veld === veldId && inVak(vakUit(vakken, b.vak), fx, fy))
    .sort((a, b) => deelVan(vakUit(vakken, a.vak)) - deelVan(vakUit(vakken, b.vak)));
  if (hier.length){ ovStop(); P.sel = hier[0].id; return teken(); }
  if (P.ov.vrij){
    const q = (fx < .5 ? 'a' : 'b') + (fy < .5 ? 'v' : 'a');
    if (vrijeKwarten(P.blokken, instVan(veldId), { dag: P.dag, veld: veldId, t }).includes(q)){ ovStop(); return vensterPlanHier(veldId, q, Math.max(6 * 60, Math.floor(t / 15) * 15)); }
  }
  if (P.sel){ P.sel = null; teken(); }
}
function vensterPlanHier(veldId, vak, start){
  const nog = nogInTePlannen(P.teams, P.blokken).map(x => x.t), rest = P.teams.filter(t => !nog.includes(t));
  const knop = t => `<button type="button" class="vp-plankeuze b-${t.bouw}" data-plan="${esc(t.id)}"><b>${esc(t.naam)}</b><small>${MAAT_NAAM[t.maat]} · ${t.duur} min</small></button>`;
  const k = vakUit(vakkenVan(instVan(veldId)), vak);
  const v = venster(`<h2>Plan hier een team</h2>
    <p class="vp-zacht">${esc(veldVan(veldId).naam)} ${esc(k.kort)}, ${DAGEN[P.dag].toLowerCase()} vanaf ${naarTijd(start)}. Heeft het team meer ruimte nodig, dan zoeken we het passende vak op dit veld.</p>
    ${nog.length ? `<span class="vp-label">Nog in te plannen</span><div class="vp-planlijst">${nog.map(knop).join('')}</div>` : '<p class="vp-klaar">Alle teams staan al in het rooster.</p>'}
    ${rest.length ? `<details class="vp-planmeer"><summary>Ander team (${rest.length})</summary><div class="vp-planlijst">${rest.map(knop).join('')}</div></details>` : ''}
    <div class="vp-voet"><button type="button" class="knop licht" data-dicht>Annuleren</button></div>`);
  v.querySelector('[data-dicht]').onclick = sluitVenster;
  v.querySelectorAll('[data-plan]').forEach(x => x.onclick = () => { sluitVenster(); nieuwBlok(x.dataset.plan, veldId, start, vak); });
  v.querySelector('[data-plan]')?.focus();
}
function koppelKies(el){
  el.querySelectorAll('[data-kies]').forEach(k => k.onclick = () => { ovStop(); P.sel = k.dataset.kies; teken(); });
}
async function koppelOverzicht(){
  const el = P.el, o = P.ov;
  koppelKies(el.querySelector('[data-ovnulijst]'));
  el.querySelectorAll('[data-ovbouw]').forEach(k => k.onclick = () => {
    const b = k.dataset.ovbouw; o.bouw = o.bouw.includes(b) ? o.bouw.filter(x => x !== b) : [...o.bouw, b]; teken(); });
  el.querySelectorAll('[data-ovf]').forEach(k => k.onchange = () => { o[k.dataset.ovf] = k.value; teken(); });
  el.querySelector('[data-ovvrij]')?.addEventListener('click', () => { o.vrij = !o.vrij; teken(); });
  el.querySelector('[data-ovwis]')?.addEventListener('click', () => { Object.assign(o, { bouw: [], team: '', veld: '', kk: '' }); teken(); });
  el.querySelector('[data-ovspeel]').onclick = ovSpeel;
  el.querySelector('[data-ovsnel]').onclick = e => { o.snel = (o.snel + 1) % SNEL.length; e.currentTarget.textContent = SNELN[o.snel]; e.currentTarget.setAttribute('aria-label', `Afspeelsnelheid ${SNELN[o.snel]}`); };
  el.querySelector('[data-ovnu]').onclick = ovNu;
  const s = el.querySelector('[data-ovschuif]');
  s.addEventListener('input', () => { if (o.spelen) ovStop(); o.live = false; ovKnoppen(); o.t = +s.value; ovMoment(); });
  s.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'k'){ e.preventDefault(); ovSpeel(); } });
  const sc = el.querySelector('[data-ovschema]');
  if (sc) sc.addEventListener('click', e => {
    const g = e.target.closest('[data-schemaveld]'); if (!g) return;
    const r = g.getBoundingClientRect();
    ovKiesPlek(g.dataset.schemaveld, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  const kaartEl = el.querySelector('#vpOvKaart'); if (!kaartEl) return;
  const { Kaart } = await import('./veldkaart.js?v=20261130f');
  if (!P || !kaartEl.isConnected) return;
  const pos = P.kaartPos || { lat: P.park.lat, lon: P.park.lon, z: Math.min(19, P.park.zoom || 18) };
  const k = new Kaart(kaartEl, { lat: pos.lat, lon: pos.lon, z: pos.z, interactief: true, omgeving: () => P?.park?.omgeving?.vormen, lagen: lagenOverzicht, onTik: ovTik });
  P.ovKaart = k;
  const bewaarPos = () => { P.kaartPos = { lat: k.lat, lon: k.lon, z: k.z }; };
  kaartEl.addEventListener('pointerup', bewaarPos); kaartEl.addEventListener('wheel', bewaarPos, { passive: true });
  kaartEl.addEventListener('click', e => { if (e.target.closest('[data-vk-z]')) bewaarPos(); });
  if (!P.kaartPos) k.pasIn((P.park.velden || []).filter(v => v.lat != null).flatMap(v => { const r = (v.lengte || 20) / 2; return [verschuif(v, -r, -r), verschuif(v, r, r)]; }), 30);
}

/* ---------- vensters ---------- */
function venster(html, klas = ''){
  let v = P.el.querySelector('.vp-venster');
  if (!v){ v = document.createElement('div'); v.className = 'vp-venster-laag'; v.innerHTML = '<div class="vp-venster" role="dialog" aria-modal="true"></div>'; P.el.appendChild(v);
    v.addEventListener('click', e => { if (e.target === v) sluitVenster(); }); v = v.firstChild; }
  v.className = `vp-venster ${klas}`; v.innerHTML = html; P.venster = v; P.naSluiten = null;
  return v;
}
function sluitVenster(){ P.el.querySelector('.vp-venster-laag')?.remove(); P.venster = null; const na = P.naSluiten; P.naSluiten = null; na?.(); }
const svgPunt = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };

function vensterKleedkamers(){
  const ed = P.inst.kleedkamers.map(k => ({ ...k })), tijden = { voor: P.inst.kkVoor ?? 15, na: P.inst.kkNa ?? 20 };
  const render = () => {
    const v = venster(`<h2>Kleedkamers</h2>
      <p class="vp-zacht">${P.instBestaat ? 'De kleedkamers die je in de planner kunt kiezen.' : 'Voorstel uit de plekken van het sportpark. Pas de namen aan of voeg er een toe.'}</p>
      <div class="vp-kklijst">${ed.map((k, i) => `<div class="vp-kkregel"><input class="invoer" data-i="${i}" value="${esc(k.naam)}" maxlength="30" aria-label="Naam kleedkamer ${i + 1}">
        <button type="button" class="knop licht klein" data-weg="${i}" aria-label="${esc(k.naam)} weghalen">Weg</button></div>`).join('')}</div>
      <button type="button" class="knop licht klein" data-erbij ${ed.length >= 40 ? 'disabled' : ''}>+ Kleedkamer</button>
      <span class="vp-label">Hoe lang heeft een team de kleedkamer?</span>
      <div class="vp-velden2"><label>Minuten vóór de training<input class="invoer" type="number" inputmode="numeric" min="0" max="60" step="5" data-kktijd="voor" value="${tijden.voor}"></label>
        <label>Minuten na de training<input class="invoer" type="number" inputmode="numeric" min="0" max="60" step="5" data-kktijd="na" value="${tijden.na}"></label></div>
      <div class="vp-voet"><button type="button" class="knop licht" data-dicht>Annuleren</button><button type="button" class="knop fluo" data-ok>Opslaan</button></div>`);
    v.querySelectorAll('[data-i]').forEach(x => x.oninput = () => { ed[+x.dataset.i].naam = x.value; });
    v.querySelectorAll('[data-kktijd]').forEach(x => x.oninput = () => { tijden[x.dataset.kktijd] = x.value; });
    v.querySelectorAll('[data-weg]').forEach(x => x.onclick = () => { ed.splice(+x.dataset.weg, 1); render(); });
    v.querySelector('[data-erbij]').onclick = () => {
      const nrs = ed.map(k => parseInt((k.id.match(/\d+/) || [0])[0], 10)), n = Math.max(0, ...nrs) + 1;
      ed.push({ id: `k${n}`, naam: `Kleedkamer ${n}` }); render(); v.querySelector(`[data-i="${ed.length - 1}"]`)?.select();
    };
    v.querySelector('[data-dicht]').onclick = sluitVenster;
    v.querySelector('[data-ok]').onclick = () => {
      bewaarStap();
      P.inst.kleedkamers = schoonKleedkamers(ed);
      P.inst.kkVoor = schoonMinuten(tijden.voor, P.inst.kkVoor ?? 15); P.inst.kkNa = schoonMinuten(tijden.na, P.inst.kkNa ?? 20);
      zetKleedTijden(P.inst.kkVoor, P.inst.kkNa);
      const ids = new Set(P.inst.kleedkamers.map(k => k.id));
      P.blokken.forEach(b => { b.kk = (b.kk || []).filter(k => ids.has(k)); });
      P.instGewijzigd = true; P.instBestaat = true; sluitVenster(); planBewaar(); teken();
      meld(`${P.inst.kleedkamers.length} kleedkamers opgeslagen; open ${P.inst.kkVoor} min voor tot ${P.inst.kkNa} min na de training.`);
    };
  };
  render();
}

/* [20261127t] Een bestaande planning inlezen: PDF, Word (.docx), Excel (.xlsx), CSV of geplakte tekst.
   De tekst haal je in de browser uit het bestand; leesPlanning herkent per regel dag, tijd, team, veld, deel en
   kleedkamer. Lukt dat niet goed (een rooster als raster, dagen als kolommen), dan zet de AI de tekst eerst om
   naar vaste regels (veldplannerInlezenAI), als AI voor de club aan staat. Eerst een voorbeeld, dan pas overnemen. */
const laadScript = (src, test) => test() ? Promise.resolve() : new Promise((ok, mis) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mis(new Error('laden mislukt')); document.head.appendChild(s); });
async function tekstUitBestand(f){
  const naam = f.name.toLowerCase();
  if (/\.(csv|txt|tsv)$/.test(naam)) return (await f.text()).replace(/;/g, '\t');
  if (naam.endsWith('.pdf')){
    const { laadPdfJs } = await import('./pdf-viewer.js?v=20261130f');
    const { regelsUitTekstItems } = await import('./training-ai.js?v=20261130f');
    await laadPdfJs();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, uit = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 30); n++) uit.push(regelsUitTekstItems((await (await pdf.getPage(n)).getTextContent()).items));
    return uit.join('\n');
  }
  if (naam.endsWith('.docx')){
    await laadScript('vendor/jszip.min.js', () => !!window.JSZip);
    const { docxTekst } = await import('./clubprofiel-logica.js?v=20261121c');
    const zip = await window.JSZip.loadAsync(await f.arrayBuffer());
    /* tabelrij = één regel: alinea's binnen een cel worden spaties, een rij eindigt met een regeleinde */
    const xml = String(await zip.file('word/document.xml')?.async('string') || '')
      .replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, tc => tc.replace(/<\/w:p>/g, ' ')).replace(/<\/w:tr>/g, '</w:tr></w:p>');
    return docxTekst(xml);
  }
  if (naam.endsWith('.xlsx')){
    await laadScript('vendor/exceljs.min.js', () => !!window.ExcelJS);
    const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer());
    const uit = [];
    wb.worksheets.slice(0, 10).forEach(ws => { uit.push(ws.name || ''); ws.eachRow(rij => { const r = [];
      rij.eachCell({ includeEmpty: true }, (c, k) => { const v = c.value;
        r[k - 1] = v instanceof Date ? `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
          : typeof v === 'number' && v > 0 && v < 1 ? naarTijd(Math.round(v * 1440)) : v && typeof v === 'object' ? String(v.text ?? v.result ?? (v.richText || []).map(x => x.text).join('') ?? '') : String(v ?? ''); });
      uit.push(Array.from(r, x => x ?? '').join('\t')); }); });
    return uit.join('\n');
  }
  if (/\.(xls|doc)$/.test(naam)) throw new Error(`Sla het bestand op als ${naam.endsWith('.xls') ? '.xlsx' : '.docx'} (nieuwere versie) of als PDF, en probeer het opnieuw.`);
  throw new Error('Dit soort bestand kan ik niet lezen. Kies een PDF, Word (.docx), Excel (.xlsx) of CSV.');
}
function vensterInlezen(){
  const st = { tekst: '', bron: '', res: null, ai: false, bezig: false, modus: P.blokken.length ? 'erbij' : 'vervang', uit: new Set() };
  const aiMag = S.club?.platformModules?.ai === true;
  const ctx = () => ({ teams: P.teams, velden: P.velden, kleedkamers: P.inst.kleedkamers });
  const lees = () => { st.res = leesPlanning(st.tekst, ctx()); st.uit = new Set(); };
  const render = () => {
    const r = st.res, n = r ? r.gevonden.length - st.uit.size : 0;
    const v = venster(`<h2>Planning inlezen</h2>
      <p class="vp-zacht">Kies het bestand met jullie huidige trainingsrooster (PDF, Word, Excel of CSV), of plak de tekst. Je ziet eerst wat Cluppie herkent; pas daarna neem je het over.</p>
      <div class="vp-rij2"><label class="knop licht klein">${ico('admin-file', 16)} Bestand kiezen<input type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.tsv,.xls,.doc" data-inbestand hidden></label>
        <span class="vp-zacht">${esc(st.bron || 'nog geen bestand')}</span></div>
      <textarea class="invoer vp-inplak" data-inplak rows="5" placeholder="Of plak hier het rooster, bijvoorbeeld:&#10;Maandag 18:00-19:15 JO11-2 Veld 2 half a kk 3">${esc(st.tekst)}</textarea>
      <div class="vp-rij2"><button type="button" class="knop licht klein" data-inlees ${st.tekst.trim() ? '' : 'disabled'}>Herkennen</button>
        ${aiMag ? `<button type="button" class="knop licht klein" data-inai ${st.tekst.trim() && !st.bezig ? '' : 'disabled'} title="Voor roosters als raster of tabel met dagen als kolommen">${st.bezig ? 'AI leest mee…' : 'Laat AI meelezen'}</button>` : ''}</div>
      ${r ? `<span class="vp-label">${r.gevonden.length ? `${r.gevonden.length} ${r.gevonden.length === 1 ? 'training' : 'trainingen'} herkend${st.ai ? ' (met AI)' : ''}` : 'Geen trainingen herkend'}${r.overgeslagen.length ? `, ${r.overgeslagen.length} regels niet` : ''}</span>
        ${r.gevonden.length ? `<div class="vp-inlijst">${r.gevonden.map((x, i) => { const t = teamVan(x.team), k = x.vak ? vakUit(vakkenVan(instVan(x.veld)), x.vak).kort : '';
          return `<label class="vp-inregel b-${t.bouw}"><input type="checkbox" data-inkies="${i}" ${st.uit.has(i) ? '' : 'checked'}>
            <b>${esc(t.naam)}</b><span>${DAGK[x.dag]} ${naarTijd(x.start)}–${naarTijd(x.eind)}</span><span>${esc(veldVan(x.veld).naam)}${k ? ' ' + esc(k) : ''}</span><span>${x.kk.length ? 'kk ' + esc(x.kk.map(kkKort).join(', ')) : ''}</span></label>`; }).join('')}</div>` : ''}
        ${r.overgeslagen.length ? `<details class="vp-planmeer"><summary>Niet herkend (${r.overgeslagen.length})</summary><ul class="vp-inniet">${r.overgeslagen.slice(0, 40).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <p class="vp-zacht">Ontbreekt een team of veld? Controleer de namen bij Teams en bij Sportparken.${aiMag && !st.ai ? ' Of laat AI meelezen.' : ''}</p></details>` : ''}
        ${r.gevonden.length ? `<div class="segment vp-segment" role="group" aria-label="Hoe overnemen"><button type="button" data-inmodus="erbij" aria-pressed="${st.modus === 'erbij'}">Toevoegen aan het rooster</button><button type="button" data-inmodus="vervang" aria-pressed="${st.modus === 'vervang'}">Rooster vervangen</button></div>` : ''}` : ''}
      <div class="vp-voet"><button type="button" class="knop licht" data-dicht>Annuleren</button><button type="button" class="knop fluo" data-inok ${n ? '' : 'disabled'}>${n ? `${n} overnemen` : 'Overnemen'}</button></div>`, 'breed');
    v.querySelector('[data-dicht]').onclick = sluitVenster;
    v.querySelector('[data-inplak]').oninput = e => { st.tekst = e.target.value; st.bron = st.bron && st.bron.startsWith('geplakt') ? st.bron : st.bron; const b = v.querySelector('[data-inlees]'); if (b) b.disabled = !st.tekst.trim(); const a = v.querySelector('[data-inai]'); if (a) a.disabled = !st.tekst.trim(); };
    v.querySelector('[data-inbestand]').onchange = async e => {
      const f = e.target.files?.[0]; if (!f) return;
      if (f.size > 15 * 1024 * 1024) return meld('Dat bestand is te groot (meer dan 15 MB).');
      st.bron = `Bezig met lezen van ${f.name}…`; render();
      try { st.tekst = await tekstUitBestand(f); st.bron = f.name; st.ai = false; lees(); }
      catch (x){ console.warn('[veldplanner] inlezen', x); st.bron = ''; meld(x?.message || 'Het bestand lezen lukte niet.'); }
      if (P?.venster) render();
    };
    v.querySelector('[data-inlees]').onclick = () => { st.ai = false; lees(); render(); };
    v.querySelector('[data-inai]')?.addEventListener('click', async () => {
      st.bezig = true; render();
      try {
        const r = await httpsCallable(functions, 'veldplannerInlezenAI', { timeout: 120000 })({ clubId: P.clubId, tekst: st.tekst.slice(0, 40000),
          teams: P.teams.map(t => t.naam), velden: P.velden.map(x => x.naam), kleedkamers: P.inst.kleedkamers.map(k => k.naam) });
        st.res = leesPlanning(r.data?.regels || '', ctx()); st.uit = new Set(); st.ai = true;
      } catch (x){ console.warn('[veldplanner] AI inlezen', x); meld(x?.message ? `AI meelezen lukte niet: ${x.message}` : 'AI meelezen lukte niet.'); }
      st.bezig = false; if (P?.venster) render();
    });
    v.querySelectorAll('[data-inkies]').forEach(x => x.onchange = () => { const i = +x.dataset.inkies; x.checked ? st.uit.delete(i) : st.uit.add(i); render(); });
    v.querySelectorAll('[data-inmodus]').forEach(x => x.onclick = () => { st.modus = x.dataset.inmodus; render(); });
    v.querySelector('[data-inok]').onclick = () => {
      const lijst = st.res.gevonden.filter((x, i) => !st.uit.has(i));
      bewaarStap();
      if (st.modus === 'vervang') P.blokken = [];
      for (const x of lijst){
        const t = teamVan(x.team), b = { id: nieuwId(), team: x.team, dag: x.dag, start: x.start, eind: x.eind, veld: x.veld, vak: 'h', kk: x.kk };
        b.vak = x.vak || zoekVrijVak(P.blokken, instVan(x.veld), { dag: x.dag, veld: x.veld, start: x.start, eind: x.eind, nodig: NODIG[t.maat] })
          || zoekVrijVak(P.blokken, instVan(x.veld), { dag: x.dag, veld: x.veld, start: x.start, eind: x.eind, nodig: 0 }) || 'h';
        P.blokken.push(b);
      }
      P.blokken = schoonRooster(P.blokken);
      sluitVenster(); planBewaar();
      const dagen = [...new Set(lijst.map(x => x.dag))].sort(); if (dagen.length && !dagen.includes(P.dag)) P.dag = dagen[0];
      teken(); meld(`${lijst.length} ${lijst.length === 1 ? 'training' : 'trainingen'} ingelezen. Klopt er iets niet? Met Ongedaan zet je het terug.`);
    };
  };
  render();
}

/* [20261127u] meldingen wegklikken */
function negeer(soort, waarde){
  bewaarStap();
  const n = schoonNegeer(P.inst.negeer); n[soort] = [...n[soort], waarde];
  P.inst.negeer = schoonNegeer(n); P.instGewijzigd = true; planBewaar(); teken();
}
/* [20261127u] dag kopiëren naar andere dagen */
function vensterKopieer(){
  const van = P.dag, n = P.blokken.filter(b => b.dag === van).length;
  if (!n) return meld(`Op ${DAGEN[van].toLowerCase()} staat nog niets om te kopiëren.`);
  const st = { naar: new Set(), modus: 'vervang' };
  const render = () => {
    const v = venster(`<h2>${DAGEN[van]} kopiëren</h2>
      <p class="vp-zacht">Zet de ${n} ${n === 1 ? 'training' : 'trainingen'} van ${DAGEN[van].toLowerCase()} (zelfde tijden, velden en kleedkamers) ook op:</p>
      <div class="vp-kopdagen">${[1, 2, 3, 4, 5, 6, 7].filter(d => d !== van).map(d => { const m = P.blokken.filter(b => b.dag === d).length;
        return `<label class="vp-kopdag"><input type="checkbox" data-kopdag="${d}" ${st.naar.has(d) ? 'checked' : ''}><b>${DAGEN[d]}</b><small>${m ? `${m} ${m === 1 ? 'training' : 'trainingen'}` : 'leeg'}</small></label>`; }).join('')}</div>
      <div class="segment vp-segment" role="group" aria-label="Wat er al staat"><button type="button" data-kopmodus="vervang" aria-pressed="${st.modus === 'vervang'}">Dag vervangen</button><button type="button" data-kopmodus="erbij" aria-pressed="${st.modus === 'erbij'}">Erbij zetten</button></div>
      <p class="vp-zacht">${st.modus === 'vervang' ? 'Wat al op de gekozen dagen staat, gaat eruit.' : 'Wat al op de gekozen dagen staat, blijft staan. Botsingen zie je daarna bij Controle.'}</p>
      <div class="vp-voet"><button type="button" class="knop licht" data-dicht>Annuleren</button><button type="button" class="knop fluo" data-kopok ${st.naar.size ? '' : 'disabled'}>${st.naar.size ? `Kopieer naar ${st.naar.size} ${st.naar.size === 1 ? 'dag' : 'dagen'}` : 'Kies een dag'}</button></div>`);
    v.querySelector('[data-dicht]').onclick = sluitVenster;
    v.querySelectorAll('[data-kopdag]').forEach(x => x.onchange = () => { const d = +x.dataset.kopdag; x.checked ? st.naar.add(d) : st.naar.delete(d); render(); });
    v.querySelectorAll('[data-kopmodus]').forEach(x => x.onclick = () => { st.modus = x.dataset.kopmodus; render(); });
    v.querySelector('[data-kopok]').onclick = () => {
      bewaarStap();
      const r = kopieerDag(P.blokken, van, [...st.naar], st.modus, nieuwId);
      P.blokken = schoonRooster(r.rooster); sluitVenster(); planBewaar(); teken();
      meld(`${r.n} ${r.n === 1 ? 'training' : 'trainingen'} gekopieerd naar ${[...st.naar].sort().map(d => DAGEN[d].toLowerCase()).join(', ')}. Met Ongedaan zet je het terug.`);
    };
  };
  render();
}

/* [20261127t] Per team: welk deel van het veld, hoe lang en hoe vaak per week. Leeg = wat de planner zelf uitrekent. */
function zetTeamInst(teamId, wijz){
  bewaarStap();
  const oud = { ...(P.inst.teams?.[teamId] || {}) };
  for (const [k, v] of Object.entries(wijz)) if (v === '' || v == null) delete oud[k]; else oud[k] = v;
  P.inst.teams = schoonTeamInstellingen({ ...(P.inst.teams || {}), [teamId]: oud });
  P.instGewijzigd = true; P.teams = teamsVan(S.clubTeams || []);
}
function vensterTeams(){
  const groepen = ['onder', 'midden', 'boven', 'overig'].map(b => [b, P.teams.filter(t => t.bouw === b)]).filter(([, l]) => l.length);
  const v = venster(`<h2>Teams</h2>
    <p class="vp-zacht">Hoeveel veld heeft elk team nodig, hoe lang traint het en hoe vaak per week? Wat je niet invult, rekent de planner uit leeftijd en trainingsmomenten.</p>
    <div class="vp-teamlijst">${groepen.map(([b, l]) => `<h3 class="vp-ovh3"><i class="b-${b}"></i>${BOUW[b]}</h3>${l.map(t => `
      <div class="vp-teamregel b-${b}"><b>${esc(t.naam)}</b>
        <div class="segment vp-segment" role="group" aria-label="Veldmaat ${esc(t.naam)}">${['kwart', 'half', 'heel'].map(m => `<button type="button" data-tm="${esc(t.id)}" data-maat="${m}" aria-pressed="${t.maat === m}">${m}</button>`).join('')}</div>
        <label><input class="invoer" type="number" min="30" max="180" step="5" data-tduur="${esc(t.id)}" value="${t.duur}" aria-label="Minuten training ${esc(t.naam)}"> min</label>
        <label><input class="invoer" type="number" min="0" max="7" step="1" data-tper="${esc(t.id)}" value="${t.per}" aria-label="Trainingen per week ${esc(t.naam)}"> × p/w</label>
        ${t.eigen ? `<button type="button" class="vp-fwis" data-tauto="${esc(t.id)}" title="Terug naar ${MAAT_NAAM[t.auto.maat]}, ${t.auto.duur} min, ${t.auto.per}× per week">automatisch</button>` : '<span class="vp-zacht vp-auto">automatisch</span>'}
      </div>`).join('')}`).join('')}</div>
    <div class="vp-voet"><button type="button" class="knop fluo" data-dicht>Klaar</button></div>`, 'breed');
  P.naSluiten = () => { planBewaar(); teken(); };
  v.querySelector('[data-dicht]').onclick = sluitVenster;
  v.querySelectorAll('[data-tm]').forEach(x => x.onclick = () => { zetTeamInst(x.dataset.tm, { maat: x.dataset.maat }); vensterTeams(); });
  v.querySelectorAll('[data-tduur]').forEach(x => x.onchange = () => { zetTeamInst(x.dataset.tduur, { duur: x.value }); vensterTeams(); });
  v.querySelectorAll('[data-tper]').forEach(x => x.onchange = () => { zetTeamInst(x.dataset.tper, { per: x.value }); vensterTeams(); });
  v.querySelectorAll('[data-tauto]').forEach(x => x.onclick = () => { zetTeamInst(x.dataset.tauto, { maat: '', duur: '', per: '' }); vensterTeams(); });
}

function vensterIndeling(veldId){
  const V = veldVan(veldId);
  const ed = { vakken: vakkenVan(instVan(veldId)), sel: null, teller: vakkenVan(instVan(veldId)).filter(k => k.eigen).length + 1 };
  const W = 315, H = 204;                           /* 105 x 68 meter, 3 px per meter */
  const mx = f => Math.round(f * 105) / 105, my = f => Math.round(f * 68) / 68;
  const render = () => {
    const eigen = ed.vakken.filter(k => k.eigen), sel = ed.vakken.find(k => k.id === ed.sel);
    const fs = k => Math.max(6, Math.min(12, (k.w * W - 6) / (Math.max(4, k.naam.length) * 0.62)));
    const v = venster(`<h2>Indeling van ${esc(V.naam)}</h2>
      <p class="vp-zacht">Heel, half en kwart staan altijd klaar. Teken er zelf vakken bij door op het veld te slepen. Sleep een vak om het te verplaatsen, of aan het hoekje om de maat te veranderen.</p>
      <svg class="vp-iveld" viewBox="-8 -8 ${W + 16} ${H + 16}" role="img" aria-label="Tekenveld ${esc(V.naam)}">
        <rect x="-8" y="-8" width="${W + 16}" height="${H + 16}" rx="8" class="gras"/>
        ${Array.from({ length: 10 }, (_, i) => i % 2 ? `<rect x="${i * W / 10}" y="0" width="${W / 10}" height="${H}" class="gras2"/>` : '').join('')}
        <g class="kalk"><rect x="0" y="0" width="${W}" height="${H}"/><path d="M${W / 2} 0v${H}"/><circle cx="${W / 2}" cy="${H / 2}" r="27"/>
          <rect x="0" y="${H / 2 - 60}" width="48" height="120"/><rect x="${W - 48}" y="${H / 2 - 60}" width="48" height="120"/></g>
        <path class="istd" d="M${W / 2} 0v${H}M0 ${H / 2}h${W}"/>
        ${['a voor', 'b voor', 'a achter', 'b achter'].map((n, i) => `<text class="istd-t" x="${(i % 2) * W / 2 + 6}" y="${Math.floor(i / 2) * H / 2 + 13}">${n}</text>`).join('')}
        ${eigen.map(k => `<g class="ivak${k.id === ed.sel ? ' aan' : ''}" data-vak="${k.id}">
          <rect class="ivak-r" x="${k.x * W}" y="${k.y * H}" width="${k.w * W}" height="${k.h * H}" rx="4"/>
          <text class="ivak-t" x="${(k.x + k.w / 2) * W}" y="${(k.y + k.h / 2) * H}" text-anchor="middle" style="font-size:${fs(k)}px">${esc(k.naam)}</text>
          <text class="ivak-m" x="${(k.x + k.w / 2) * W}" y="${(k.y + k.h / 2) * H + 13}" text-anchor="middle">${meters(k)}</text>
          ${k.id === ed.sel ? `<rect class="igreep" data-greep="${k.id}" x="${(k.x + k.w) * W - 8}" y="${(k.y + k.h) * H - 8}" width="14" height="14" rx="3"/>` : ''}</g>`).join('')}
        <rect class="ivak-nieuw" x="0" y="0" width="0" height="0" rx="4"/>
      </svg>
      ${sel ? `<label class="vp-label" for="vpINaam">Gekozen vak · ${meters(sel)} · ${deelTekst(deelVan(sel))}</label>
        <div class="vp-rij2"><input class="invoer" id="vpINaam" value="${esc(sel.naam)}" maxlength="30" placeholder="Naam, bijv. Keepershoek"><button type="button" class="knop gevaar klein" data-iweg>Verwijder</button></div>`
        : `<p class="vp-zacht">Tip: een pannaveldje, een keepershoek of een strook langs de zijlijn voor de warming-up.${eigen.length >= MAX_EIGEN ? ` Maximaal ${MAX_EIGEN} eigen vakken.` : ''}</p>`}
      <span class="vp-label">Vakken op dit veld (${ed.vakken.length})</span>
      <div class="vp-chips">${ed.vakken.map(k => `<button type="button" class="vp-chip${k.id === ed.sel ? ' aan' : ''}${k.eigen ? '' : ' vast'}" data-ikies="${k.id}"><b>${esc(k.naam)}</b> <small>${k.eigen ? meters(k) : deelTekst(deelVan(k))}</small></button>`).join('')}</div>
      <div class="vp-voet"><button type="button" class="knop licht" data-dicht>Annuleren</button><button type="button" class="knop fluo" data-ok>Opslaan</button></div>`, 'breed');
    v.querySelectorAll('[data-ikies]').forEach(x => x.onclick = () => { const k = ed.vakken.find(q => q.id === x.dataset.ikies); ed.sel = k?.eigen ? k.id : null; render(); });
    const naam = v.querySelector('#vpINaam');
    if (naam) naam.oninput = () => { sel.naam = naam.value; sel.kort = naam.value.toLowerCase();
      const t = v.querySelector(`.ivak[data-vak="${sel.id}"] .ivak-t`); if (t) t.textContent = naam.value;
      const c = v.querySelector(`[data-ikies="${sel.id}"] b`); if (c) c.textContent = naam.value; };
    v.querySelector('[data-iweg]')?.addEventListener('click', () => { ed.vakken = ed.vakken.filter(k => k.id !== ed.sel); ed.sel = null; render(); });
    const svg = v.querySelector('.vp-iveld'), nieuw = svg.querySelector('.ivak-nieuw');
    let actie = null;
    const punt = e => { const p = svgPunt(svg, e); return [Math.max(0, Math.min(1, p.x / W)), Math.max(0, Math.min(1, p.y / H))]; };
    svg.addEventListener('pointerdown', e => {
      const [fx, fy] = punt(e), greep = e.target.closest('[data-greep]'), vak = e.target.closest('[data-vak]');
      e.preventDefault(); svg.setPointerCapture(e.pointerId);
      if (greep) actie = { soort: 'maat', k: ed.vakken.find(k => k.id === greep.dataset.greep) };
      else if (vak){ const k = ed.vakken.find(q => q.id === vak.dataset.vak); ed.sel = k.id; actie = { soort: 'schuif', k, dx: fx - k.x, dy: fy - k.y, el: vak }; }
      else if (eigen.length < MAX_EIGEN) actie = { soort: 'teken', x0: mx(fx), y0: my(fy), x: mx(fx), y: my(fy) };
      else { ed.sel = null; render(); }
    });
    const zetTekst = (g, k) => g.querySelectorAll('text').forEach((t, i) => { t.setAttribute('x', (k.x + k.w / 2) * W); t.setAttribute('y', (k.y + k.h / 2) * H + i * 13); });
    svg.addEventListener('pointermove', e => {
      if (!actie) return;
      const [fx, fy] = punt(e);
      if (actie.soort === 'teken'){ actie.x = mx(fx); actie.y = my(fy);
        nieuw.setAttribute('x', Math.min(actie.x0, actie.x) * W); nieuw.setAttribute('y', Math.min(actie.y0, actie.y) * H);
        nieuw.setAttribute('width', Math.abs(actie.x - actie.x0) * W); nieuw.setAttribute('height', Math.abs(actie.y - actie.y0) * H); }
      else if (actie.soort === 'schuif'){ const k = actie.k;
        k.x = mx(Math.max(0, Math.min(1 - k.w, fx - actie.dx))); k.y = my(Math.max(0, Math.min(1 - k.h, fy - actie.dy)));
        const r = actie.el.querySelector('.ivak-r'); r.setAttribute('x', k.x * W); r.setAttribute('y', k.y * H);
        zetTekst(actie.el, k); actie.el.querySelector('.igreep')?.remove(); }
      else if (actie.soort === 'maat'){ const k = actie.k;
        k.w = Math.max(3 / 105, mx(Math.min(1, fx)) - k.x); k.h = Math.max(3 / 68, my(Math.min(1, fy)) - k.y);
        const g = svg.querySelector(`.ivak[data-vak="${k.id}"]`), r = g.querySelector('.ivak-r');
        r.setAttribute('width', k.w * W); r.setAttribute('height', k.h * H); zetTekst(g, k);
        const gr = g.querySelector('.igreep'); gr.setAttribute('x', (k.x + k.w) * W - 8); gr.setAttribute('y', (k.y + k.h) * H - 8);
        g.querySelector('.ivak-m').textContent = meters(k); }
    });
    svg.addEventListener('pointerup', () => {
      if (!actie) return; const a = actie; actie = null;
      if (a.soort === 'teken'){
        const w = Math.abs(a.x - a.x0), h = Math.abs(a.y - a.y0);
        if (w * 105 >= 3 && h * 68 >= 3){
          let n = ed.teller; while (ed.vakken.some(k => k.id === `e${n}`)) n++;
          const k = { id: `e${n}`, naam: `Eigen vak ${ed.teller}`, kort: `eigen vak ${ed.teller}`, x: Math.min(a.x0, a.x), y: Math.min(a.y0, a.y), w, h, eigen: true };
          ed.teller++; ed.vakken.push(k); ed.sel = k.id; render(); P.venster?.querySelector('#vpINaam')?.select(); return;
        }
        ed.sel = null;
      }
      render();
    });
    v.querySelector('[data-dicht]').onclick = sluitVenster;
    v.querySelector('[data-ok]').onclick = () => {
      bewaarStap();
      const oudeVakken = vakkenVan(instVan(veldId));
      P.inst.velden[veldId] = { ...instVan(veldId), vakken: ed.vakken.filter(k => k.eigen).map((k, i) => schoonVak(k, i)).filter(Boolean) };
      P.instGewijzigd = true;
      const nieuw = vakkenVan(instVan(veldId));
      let verzetN = 0;
      for (const b of P.blokken.filter(x => x.veld === veldId && !nieuw.some(k => k.id === x.vak))){
        const nodig = deelVan(vakUit(oudeVakken, b.vak));
        b.vak = zoekVrijVak(P.blokken, instVan(veldId), { dag: b.dag, veld: veldId, start: b.start, eind: b.eind, nodig }, b.id) || 'h'; verzetN++;
      }
      sluitVenster(); planBewaar(); teken();
      const n = nieuw.filter(k => k.eigen).length;
      meld(`${V.naam} opgeslagen: heel, half, kwart${n ? ` en ${n} eigen ${n === 1 ? 'vak' : 'vakken'}` : ''}.${verzetN ? ` ${verzetN} ${verzetN === 1 ? 'training staat' : 'trainingen staan'} nu op een passend vak.` : ''}`);
    };
  };
  render();
}

/* ---------- opmaak (alleen geladen als de Veldplanner opengaat) ---------- */
function stijl(){
  if (document.getElementById('vpStijl')) return;
  const s = document.createElement('style'); s.id = 'vpStijl';
  s.textContent = `
html.vp-open{overflow:hidden}
.vp-laag{position:fixed;inset:0;z-index:80;background:var(--bg);color:var(--ink);display:none}
.vp-laag.toon{display:block}
.vp-app{height:100%;overflow:auto;padding:var(--space-md) 16px calc(var(--space-xl) + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:var(--space-sm);max-width:1600px;margin:0 auto}
.vp-leeg{margin:auto;max-width:440px;text-align:center;display:flex;flex-direction:column;gap:var(--space-sm);align-items:center}
.vp-kop{display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap}
.vp-terug{width:40px;height:40px;border-radius:50%;background:var(--card);font-size:24px;line-height:1;color:var(--ink);flex-shrink:0}
.vp-titel{display:flex;flex-direction:column;margin-right:auto}
.vp-titel small{font-size:var(--t-xs);color:var(--ink-2)}
.vp-titel h1{font-family:var(--font-display);font-weight:700;text-transform:uppercase;font-size:var(--t-3xl);margin:0;line-height:1}
.vp-concept{font-size:var(--t-xs);padding:4px 10px;border-radius:var(--r-pill);background:var(--amber-bg);color:var(--ink);border:1px solid var(--amber-lijn)}
.vp-staat{font-size:var(--t-xs);color:var(--ink-2);min-width:90px}
.vp-staat.fout{color:var(--uit);font-weight:600}
.vp-acties{display:flex;gap:var(--space-xs);flex-wrap:wrap}
.vp-dagen{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:var(--space-xs)}
.vp-dag{background:var(--card);border:1.5px solid var(--hair);border-radius:var(--r-s);padding:8px 10px;text-align:left;display:flex;flex-direction:column;gap:2px;color:var(--ink);min-height:44px}
.vp-dag b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg)}
.vp-dag small{font-size:var(--t-xs);color:var(--ink-2)}
.vp-dag.aan{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.vp-dag.plus{align-items:center;justify-content:center;color:var(--ink-2)}
.vp-dag .kort{display:none}
.vp-dagstat{display:flex;gap:6px;font-size:var(--t-2xs)}
.vp-dagstat em{font-style:normal;font-weight:600}
.vp-dagstat .f{color:var(--uit)}.vp-dagstat .w{color:var(--warn)}.vp-dagstat .ok{color:var(--ok)}
.vp-grid{display:grid;grid-template-columns:240px minmax(0,1fr) 300px;gap:var(--space-sm);align-items:start}
.vp-paneel{background:var(--card);border-radius:var(--r-m);padding:var(--space-sm);box-shadow:var(--shadow);min-width:0}
.vp-paneel-kop{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-xs);margin-bottom:6px}
.vp-paneel-kop h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-xl);margin:0}
.vp-zacht{color:var(--ink-2);font-size:var(--t-sm);margin:0}
.vp-uitleg{margin-bottom:var(--space-xs)}
.vp-klaar{color:var(--ok);font-weight:600;font-size:var(--t-sm)}
.vp-label{display:block;font-size:var(--t-xs);color:var(--ink-2);margin:var(--space-xs) 0 4px}
.b-onder{--bc:#3b82c4}.b-midden{--bc:#c9922e}.b-boven{--bc:#2f9e63}.b-overig{--bc:#8a8f98}
.vp-groep h3{display:flex;align-items:center;gap:6px;font-size:var(--t-sm);margin:var(--space-sm) 0 6px}
.vp-groep h3 i,.vp-legenda i{width:10px;height:10px;border-radius:3px;background:var(--bc);display:inline-block}
.vp-teamkaart{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:8px 10px;border-radius:var(--r-s);margin-bottom:6px;cursor:grab;touch-action:none;user-select:none;
  background:color-mix(in srgb,var(--bc) 18%,var(--card));border:1.5px solid color-mix(in srgb,var(--bc) 60%,transparent);min-height:44px}
.vp-teamkaart span{display:flex;flex-direction:column}
.vp-teamkaart b{font-family:var(--font-display);font-size:var(--t-lg);text-transform:uppercase;line-height:1}
.vp-teamkaart small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-teamkaart em{font-style:normal;font-size:var(--t-2xs);font-weight:700;white-space:nowrap}
.vp-zij.doel{outline:2px dashed var(--uit);outline-offset:2px}
.vp-tl-scroll{overflow-x:auto;overscroll-behavior-x:contain;padding-bottom:4px}
.vp-tijden{position:relative;height:18px;font-size:var(--t-2xs);color:var(--ink-2)}
.vp-tijden span{position:absolute;transform:translateX(-50%)}
.vp-rij{display:flex;border-top:1px solid var(--hair)}
.vp-veldkop{width:${KOPB}px;flex-shrink:0;padding:6px 8px 6px 0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.vp-veldkop b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg);line-height:1}
.vp-licht{font-size:var(--t-2xs);padding:2px 8px;border-radius:var(--r-pill);background:var(--surface-2);color:var(--ink-2)}
.vp-licht.uit{color:var(--warn);background:color-mix(in srgb,var(--warn) 14%,var(--surface-2))}
.vp-indeel{display:flex;align-items:center;gap:6px;font-size:var(--t-2xs);padding:3px 8px;border-radius:var(--r-s);background:var(--surface-2);color:var(--ink)}
.vp-baan{position:relative;flex-shrink:0;background:repeating-linear-gradient(to bottom,transparent 0 ${LH - 1}px,color-mix(in srgb,var(--hair) 70%,transparent) ${LH - 1}px ${LH}px)}
.vp-baan.doel{background-color:color-mix(in srgb,var(--info) 10%,transparent)}
.vp-baannaam{position:absolute;left:3px;font-size:9px;color:var(--ink-2);opacity:.7;line-height:${LH}px;pointer-events:none}
.vp-uurlijn{position:absolute;top:0;bottom:0;width:1px;background:var(--hair);pointer-events:none}
.vp-donker{position:absolute;top:0;bottom:0;right:0;background:repeating-linear-gradient(135deg,transparent 0 6px,color-mix(in srgb,var(--warn) 12%,transparent) 6px 12px);pointer-events:none}
.vp-blok{position:absolute;border-radius:7px;padding:3px 8px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;cursor:grab;touch-action:none;user-select:none;
  background:color-mix(in srgb,var(--bc) 30%,var(--card));border:1.5px solid var(--bc);color:var(--ink);line-height:1.15}
.vp-blok .t{font-family:var(--font-display);font-weight:700;text-transform:uppercase;font-size:var(--t-md);white-space:nowrap}
.vp-blok .s{font-size:var(--t-2xs);white-space:nowrap;color:var(--ink-2)}
.vp-blok.een{flex-direction:row;align-items:center;gap:6px;justify-content:flex-start}
.vp-blok.een .t{font-size:var(--t-sm)}
.vp-blok.vervolg{opacity:.6;border-style:dashed}
.vp-blok.waarsch{box-shadow:inset 0 0 0 1px var(--warn)}
.vp-blok.botsing{border-color:var(--uit);box-shadow:0 0 0 2px color-mix(in srgb,var(--uit) 45%,transparent)}
.vp-blok.gekozen{outline:3px solid var(--info);outline-offset:1px;z-index:2}
.vp-blok:focus-visible{outline:3px solid var(--info);outline-offset:1px}
.vp-blok.sleept{z-index:5;opacity:.9;box-shadow:var(--lift);cursor:grabbing}
.vp-spook{position:fixed;z-index:90;pointer-events:none;opacity:.9;box-shadow:var(--lift)}
.vp-greep{position:absolute;right:0;top:0;bottom:0;width:10px;cursor:ew-resize}
.vp-greep::after{content:'';position:absolute;right:3px;top:30%;bottom:30%;width:2px;border-radius:2px;background:var(--bc)}
.vp-sleep,.vp-sleep *{cursor:grabbing!important}
.vp-kk{margin-top:var(--space-sm);border-top:1px solid var(--hair);padding-top:6px}
.vp-kk h3{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg);margin:0 0 4px;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.vp-kk h3 small{font-family:var(--font-body);text-transform:none;font-size:var(--t-2xs);color:var(--ink-2);font-weight:400}
.vp-kkrij{display:flex;align-items:center;height:24px}
.vp-kknaam{width:${KOPB}px;flex-shrink:0;font-size:var(--t-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px}
.vp-kkbaan{position:relative;height:20px;background:var(--surface-2);border-radius:4px;flex-shrink:0}
.vp-kkblok{position:absolute;top:2px;bottom:2px;border-radius:4px;font-size:10px;font-weight:600;color:var(--ink);text-align:left;padding:0 0 0 calc(var(--voor) + 4px);white-space:nowrap;overflow:hidden;
  background:linear-gradient(90deg,transparent var(--voor),color-mix(in srgb,var(--bc) 45%,var(--card)) var(--voor) calc(100% - var(--na)),transparent calc(100% - var(--na))),
    repeating-linear-gradient(135deg,color-mix(in srgb,var(--bc) 40%,transparent) 0 3px,transparent 3px 6px)}
.vp-kkblok.botsing{outline:2px solid var(--uit)}
.vp-legenda{display:flex;flex-wrap:wrap;gap:var(--space-sm);font-size:var(--t-2xs);color:var(--ink-2);margin-top:6px}
.vp-legenda span{display:inline-flex;align-items:center;gap:4px}
.vp-legenda i.bots{background:transparent;border:2px solid var(--uit)}
.vp-rechts{display:flex;flex-direction:column;gap:var(--space-sm)}
.vp-tellers{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}
.vp-tellers div{background:var(--surface-2);border-radius:var(--r-s);padding:6px 10px}
.vp-tellers b{display:block;font-family:var(--font-display);font-size:var(--t-2xl);line-height:1}
.vp-tellers small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-tellers .f b{color:var(--uit)}.vp-tellers .w b{color:var(--warn)}
.vp-mld{display:flex;gap:8px;padding:8px 0;border-top:1px solid var(--hair)}
.vp-mld .ic{margin-top:2px}.vp-mld.fout .ic{color:var(--uit)}.vp-mld.warn .ic{color:var(--warn)}
.vp-mld small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-mld-knoppen .vp-negeer{color:var(--ink-2)}
.vp-negeerbalk{display:flex;flex-direction:column;gap:6px;padding:8px 10px;margin:6px 0;border-radius:var(--r-s);background:color-mix(in srgb,var(--warn) 12%,var(--surface-2))}
.vp-negeerbalk p{margin:0;font-size:var(--t-xs)}.vp-negeerbalk .knop{align-self:flex-start}
.vp-genegeerd{font-size:var(--t-xs);margin:4px 0}
.vp-link{background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;font:inherit;cursor:pointer}
.vp-kopieer{flex-direction:row!important;gap:6px}.vp-kopieer:disabled{opacity:.45}
.vp-kopdagen{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;margin:8px 0}
.vp-kopdag{display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;padding:8px 10px;border-radius:var(--r-s);background:var(--surface-2);cursor:pointer}
.vp-kopdag input{grid-row:span 2}.vp-kopdag b{font-family:var(--font-display);text-transform:uppercase}.vp-kopdag small{color:var(--ink-2);font-size:var(--t-2xs)}
.vp-mld p{margin:2px 0 6px;font-size:var(--t-sm)}
.vp-mld-knoppen{display:flex;gap:6px;flex-wrap:wrap}
.vp-x{width:36px;height:36px;border-radius:50%;background:var(--surface-2);font-size:20px;color:var(--ink)}
.vp-velden2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.vp-velden2 label{display:flex;flex-direction:column;gap:2px;font-size:var(--t-2xs);color:var(--ink-2)}
.vp-velden2 .breed{grid-column:1/-1}
.vp-velden2 .invoer{padding:6px 8px;font-size:var(--t-sm);background:var(--surface);color:var(--ink)}
.vp-chips{display:flex;flex-wrap:wrap;gap:6px}
.vp-chip{padding:6px 10px;border-radius:var(--r-pill);background:var(--surface-2);border:1.5px solid var(--hair);font-size:var(--t-xs);color:var(--ink);min-height:32px}
.vp-chip.aan{border-color:var(--info);background:color-mix(in srgb,var(--info) 18%,var(--surface-2));font-weight:600}
.vp-chip.bezet{opacity:.5;text-decoration:line-through}
.vp-chip.vast{opacity:.8}
.vp-chip small{color:var(--ink-2)}
.vp-detail-voet{margin-top:var(--space-sm);display:flex;justify-content:flex-end}
.vp-venster-laag{position:fixed;inset:0;z-index:85;background:color-mix(in srgb,var(--zwart) 60%,transparent);display:flex;align-items:center;justify-content:center;padding:16px}
.vp-venster{background:var(--card);color:var(--ink);border-radius:var(--r-l);padding:var(--space-md);width:100%;max-width:440px;max-height:92dvh;overflow:auto;display:flex;flex-direction:column;gap:var(--space-xs);box-shadow:var(--lift)}
.vp-venster.breed{max-width:640px}
.vp-venster h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-2xl);margin:0}
.vp-voet{display:flex;justify-content:flex-end;gap:var(--space-xs);margin-top:var(--space-sm)}
.vp-maatkeuze{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0;font-size:var(--t-xs);color:var(--ink-2)}
.vp-maatkeuze .segment button,.vp-teamregel .segment button{text-transform:capitalize;padding:4px 10px;min-height:30px}
.vp-teamlijst{display:flex;flex-direction:column;gap:4px;max-height:60dvh;overflow:auto}
.vp-teamlijst h3 i{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--bc);margin-right:6px}
.vp-teamregel{display:grid;grid-template-columns:minmax(70px,1fr) auto auto auto 78px;gap:8px;align-items:center;padding:6px 8px;border-radius:var(--r-s);background:var(--surface-2);border-left:4px solid var(--bc)}
.vp-teamregel b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-md)}
.vp-teamregel label{display:flex;align-items:center;gap:4px;font-size:var(--t-2xs);color:var(--ink-2);white-space:nowrap}
.vp-teamregel .invoer{width:62px;padding:4px 6px;font-size:var(--t-sm);background:var(--surface);color:var(--ink)}
.vp-auto{font-size:var(--t-2xs);text-align:center}
@media (max-width:600px){.vp-teamregel{grid-template-columns:1fr 1fr}.vp-teamregel b{grid-column:1/-1}}
.vp-inplak{width:100%;font-family:ui-monospace,monospace;font-size:var(--t-xs);background:var(--surface);color:var(--ink);resize:vertical}
.vp-inlijst{display:flex;flex-direction:column;gap:3px;max-height:38dvh;overflow:auto}
.vp-inregel{display:grid;grid-template-columns:auto minmax(64px,1fr) 1.2fr 1fr .8fr;gap:8px;align-items:center;padding:5px 8px;border-radius:var(--r-s);background:var(--surface-2);border-left:4px solid var(--bc);font-size:var(--t-xs);cursor:pointer}
.vp-inregel b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-md)}
.vp-inniet{font-size:var(--t-2xs);color:var(--ink-2);margin:4px 0;padding-left:18px;max-height:140px;overflow:auto}
.vp-kklijst{display:flex;flex-direction:column;gap:6px}
.vp-kkregel,.vp-rij2{display:flex;gap:6px;align-items:center}
.vp-kkregel .invoer,.vp-rij2 .invoer{background:var(--surface);color:var(--ink)}
.vp-iveld{width:100%;height:auto;display:block;border-radius:var(--r-s);touch-action:none;user-select:none;cursor:crosshair}
.vp-iveld .gras{fill:#2e7d3a}.vp-iveld .gras2{fill:#2a7335}
.vp-iveld .kalk{fill:none;stroke:rgba(255,255,255,.85);stroke-width:1.6}
.vp-iveld .istd{fill:none;stroke:rgba(255,255,255,.55);stroke-width:1.2;stroke-dasharray:6 5;pointer-events:none}
.vp-iveld .istd-t{font-size:9px;fill:rgba(255,255,255,.75);pointer-events:none}
.vp-iveld .ivak{cursor:move}
.vp-iveld .ivak-r{fill:rgba(109,179,255,.35);stroke:#6db3ff;stroke-width:2}
.vp-iveld .ivak.aan .ivak-r{fill:rgba(204,38,32,.4);stroke:#fff}
.vp-iveld .ivak-t{font-family:var(--font-display);font-weight:700;font-size:12px;fill:#fff;paint-order:stroke;stroke:rgba(0,0,0,.5);stroke-width:2px;pointer-events:none;text-transform:uppercase}
.vp-iveld .ivak-m{font-size:9px;fill:#fff;paint-order:stroke;stroke:rgba(0,0,0,.5);stroke-width:1.5px;pointer-events:none}
.vp-iveld .igreep{fill:#fff;stroke:#cc2620;stroke-width:2;cursor:nwse-resize}
.vp-iveld .ivak-nieuw{fill:rgba(204,38,32,.3);stroke:#fff;stroke-width:2;stroke-dasharray:5 4;pointer-events:none}
/* overzicht [20261127v] */
.vp-ovgrid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:var(--space-sm);align-items:start}
.vp-ovkop{display:flex;align-items:center;gap:var(--space-sm);flex-wrap:wrap;margin-bottom:var(--space-xs)}
.vp-ovklok{display:flex;flex-direction:column;min-width:86px}
.vp-ovklok small{font-size:var(--t-2xs);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.vp-ovklok b{font-family:var(--font-display);font-size:var(--t-3xl);line-height:1;font-variant-numeric:tabular-nums}
.vp-ovfilters{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:1}
.vp-fchip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:var(--r-pill);background:var(--surface-2);border:1.5px solid var(--hair);font-size:var(--t-xs);color:var(--ink);min-height:34px}
.vp-fchip i{width:10px;height:10px;border-radius:3px;background:var(--bc)}
.vp-fchip.aan{border-color:var(--bc,var(--info));background:color-mix(in srgb,var(--bc,var(--info)) 20%,var(--surface-2));font-weight:600}
.vp-fchip.vrij{--bc:#22c55e}
.vp-fsel{width:auto;min-height:34px;padding:4px 8px;font-size:var(--t-xs);background:var(--surface-2);color:var(--ink);border-radius:var(--r-pill);max-width:170px}
.vp-fsel.aan{border-color:var(--info);font-weight:600}
.vp-fwis{font-size:var(--t-xs);color:var(--ink-2);text-decoration:underline;padding:4px}
.vp-ovkaart{height:min(56dvh,560px);min-height:320px}
.vp-ovveld .vp-ovvak{position:absolute;box-sizing:border-box}
.vp-ovvak{display:flex;align-items:center;justify-content:center;border-radius:3px;transition:opacity .2s;pointer-events:none}
.vp-ovvak[data-ovblok]{background:color-mix(in srgb,var(--bc) 55%,transparent);border:2px solid var(--bc);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
.vp-ovvak span{display:flex;flex-direction:column;align-items:center;text-align:center;line-height:1.05;white-space:nowrap;color:#fff;background:rgba(0,0,0,.55);border-radius:6px;padding:2px 6px;font-size:var(--fs,12px)}
.vp-ovvak b{font-family:var(--font-display);text-transform:uppercase;font-size:1.15em;letter-spacing:.02em}
.vp-ovvak small{font-size:.78em;opacity:.9}
.vp-ovvak.straks{border:2px dashed var(--bc);background:color-mix(in srgb,var(--bc) 14%,transparent)}
.vp-ovvak.straks span{background:rgba(0,0,0,.4);opacity:.9}
.vp-ovvak.vrij{border:2px dashed #4ade80;background:rgba(74,222,128,.18)}
.vp-ovvak.vrij span{background:rgba(22,101,52,.75);font-size:calc(var(--fs,12px) * .85)}
.vp-ovvak.dim{opacity:.22}
.vp-ovvak.aan{outline:3px solid #fff;outline-offset:1px;z-index:2}
.vp-ovvak.botsing{border-color:var(--uit);box-shadow:0 0 0 2px var(--uit)}
.vp-ovveldnaam{position:absolute;transform:translate(-50%,-50%);font-size:var(--t-2xs);font-weight:800;color:#fff;background:rgba(0,0,0,.62);padding:1px 7px;border-radius:var(--r-pill);white-space:nowrap;pointer-events:none}
.vp-ovkkkaart{position:absolute;transform:translate(-50%,-50%);background:rgba(15,18,24,.86);color:#fff;border-radius:8px;padding:4px 6px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);max-width:260px}
.vp-ovkkkaart small{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.05em;opacity:.75;margin-bottom:2px}
.vp-ovkkkaart div{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:3px}
.vp-ovkkkaart span{font-size:9px;font-weight:700;border-radius:4px;padding:1px 4px;display:flex;gap:4px;align-items:center;white-space:nowrap;overflow:hidden;background:rgba(255,255,255,.1)}
.vp-ovkkkaart span b{font-size:11px;min-width:12px}
.vp-ovkkkaart span.dim,.vp-ovkkt.dim{opacity:.3}
.f-voor{--fc:#f59e0b}.f-training{--fc:#3b82c4}.f-na{--fc:#14b8a6}
.vp-ovkkkaart span[class*="f-"]{background:color-mix(in srgb,var(--fc) 70%,transparent)}
.vp-ovschema{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-sm)}
.vp-schemaveld b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg)}
.vp-schemaveld.dim{opacity:.35}
.vp-schemagras{position:relative;aspect-ratio:105/68;border-radius:6px;cursor:pointer;margin-top:4px;
  background:repeating-linear-gradient(90deg,#2e7d3a 0 10%,#2a7335 10% 20%);border:2px solid rgba(255,255,255,.8);--fs:11px}
.vp-schemalijn{position:absolute;left:50%;top:0;bottom:0;border-left:2px solid rgba(255,255,255,.75)}
.vp-schemagras .vp-ovvak{position:absolute;box-sizing:border-box}
.vp-schemauitleg{grid-column:1/-1}
.vp-tijdbalk{display:flex;gap:var(--space-sm);align-items:flex-start;margin-top:var(--space-sm)}
.vp-tbknoppen{display:flex;gap:6px;align-items:center;flex-shrink:0;padding-top:4px}
.vp-speel{width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center}
.vp-tbknop{min-width:40px;height:34px;padding:0 10px;border-radius:var(--r-pill);background:var(--surface-2);border:1.5px solid var(--hair);font-size:var(--t-xs);font-weight:600;color:var(--ink)}
.vp-tbknop.aan{border-color:#ef4444;color:#ef4444}
.vp-tbknop.aan::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;margin-right:5px;vertical-align:1px;animation:vpPuls 1.6s infinite}
@keyframes vpPuls{50%{opacity:.25}}
.vp-tbspoor{position:relative;flex:1;min-width:0;height:66px}
.vp-drukte{position:absolute;left:0;right:0;top:0;width:100%;height:44px;background:var(--surface-2);border-radius:6px}
.vp-drukte .balk rect{fill:color-mix(in srgb,var(--info) 60%,transparent)}
.vp-drukte .uur{stroke:var(--hair);stroke-width:1}
.vp-drukte .kkl{fill:none;stroke:#a78bfa;stroke-width:1.5}
.vp-drukte .spoor rect{fill:var(--bc)}
.vp-schuif{position:absolute;left:0;right:0;top:0;width:100%;height:44px;margin:0;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer}
.vp-schuif::-webkit-slider-runnable-track{height:44px;background:transparent}
.vp-schuif::-moz-range-track{height:44px;background:transparent}
.vp-schuif::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:44px;border-radius:4px;background:transparent;border:3px solid var(--ink);box-shadow:0 0 0 1px var(--card)}
.vp-schuif::-moz-range-thumb{width:8px;height:38px;border-radius:4px;background:transparent;border:3px solid var(--ink)}
.vp-schuif:focus-visible{outline:3px solid var(--info);outline-offset:2px;border-radius:6px}
.vp-tburen{position:absolute;left:0;right:0;top:48px;height:16px;font-size:var(--t-2xs);color:var(--ink-2)}
.vp-tburen span{position:absolute;transform:translateX(-50%)}
.vp-tburen span:first-child{transform:none}
.vp-tburen span:last-child:not(:first-child){transform:translateX(-100%)}
.vp-tbuitleg{font-size:var(--t-2xs);margin-top:2px}
.vp-tbleg{display:inline-block;width:12px;height:8px;border-radius:2px;margin:0 4px 0 8px;vertical-align:0}
.vp-tbleg:first-child{margin-left:0}
.vp-tbleg.balk{background:color-mix(in srgb,var(--info) 60%,transparent)}.vp-tbleg.kkl{height:2px;background:#a78bfa;vertical-align:3px}.vp-tbleg.spoor{background:linear-gradient(90deg,#3b82c4,#c9922e,#2f9e63)}
.vp-tellers.drie{grid-template-columns:repeat(3,1fr)}
.vp-ovregel{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:var(--r-s);background:var(--surface-2);color:var(--ink);text-align:left;margin-bottom:4px;border:1.5px solid transparent;min-height:44px}
.vp-ovregel.aan{border-color:var(--info)}
.vp-ovregel i{width:6px;align-self:stretch;border-radius:3px;background:var(--bc)}
.vp-ovregel span{flex:1;display:flex;flex-direction:column;min-width:0}
.vp-ovregel b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-md);line-height:1.1}
.vp-ovregel small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-ovregel em{font-style:normal;font-size:var(--t-2xs);font-weight:700;padding:2px 7px;border-radius:var(--r-pill);background:var(--card);white-space:nowrap}
.vp-ovh3{font-size:var(--t-sm);margin:var(--space-sm) 0 6px}
.vp-ovkks{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
.vp-ovkkt{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 8px;border-radius:var(--r-s);background:var(--surface-2);color:var(--ink);text-align:left;border:1.5px solid var(--hair);border-left:5px solid var(--fc,var(--hair));min-height:56px}
.vp-ovkkt b{font-family:var(--font-display);font-size:var(--t-lg);line-height:1}
.vp-ovkkt span{font-size:var(--t-xs);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.vp-ovkkt small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-ovkkt.vrij span{color:var(--ink-2);font-weight:400}
.vp-ovkkt[class*="f-"]{background:color-mix(in srgb,var(--fc) 14%,var(--surface-2))}
.vp-ovleg{font-size:var(--t-2xs);margin-top:6px}
.vp-ovleg span{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--fc);margin:0 3px 0 6px;vertical-align:-1px}
.vp-ovleg span:first-child{margin-left:0}
.vp-planlijst{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
.vp-plankeuze{display:flex;flex-direction:column;align-items:flex-start;padding:8px 10px;border-radius:var(--r-s);color:var(--ink);text-align:left;min-height:44px;
  background:color-mix(in srgb,var(--bc) 18%,var(--card));border:1.5px solid color-mix(in srgb,var(--bc) 60%,transparent)}
.vp-plankeuze b{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg);line-height:1}
.vp-plankeuze small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-planmeer summary{cursor:pointer;font-size:var(--t-sm);color:var(--ink-2);margin:var(--space-xs) 0}
.vp-segment button{padding:6px 12px;border-radius:var(--r-s);font-size:var(--t-sm);color:var(--ink-2);min-height:32px}
.vp-segment button[aria-pressed="true"]{background:var(--card);color:var(--ink);font-weight:600;box-shadow:var(--shadow)}
.vp-kaartgrid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:var(--space-sm);align-items:start}
.vp-kaart{height:min(70dvh,640px);min-height:320px}
.vp-kaart.kruis{cursor:crosshair}
.vp-bron{font-size:var(--t-2xs);margin-top:6px}
.vp-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.vp-tool{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--r-pill);background:var(--surface-2);border:1.5px solid var(--hair);font-size:var(--t-xs);color:var(--ink);min-height:36px}
.vp-tool.aan{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--surface-2));font-weight:600}
.vp-tool i,.vp-objregel i{font-style:normal;display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:10px;background:var(--sk);color:#fff;font-size:10px;font-weight:700}
.vp-objdetail{margin:var(--space-xs) 0}
.vp-objlijst{display:flex;flex-direction:column;gap:4px;margin-top:var(--space-xs)}
.vp-objregel{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-s);background:var(--surface-2);color:var(--ink);text-align:left;min-height:40px;border:1.5px solid transparent}
.vp-objregel.aan{border-color:var(--info)}
.vp-objregel span{flex:1;font-size:var(--t-sm)}
.vp-objregel small{font-size:var(--t-2xs);color:var(--ink-2)}
.vp-obj{position:absolute;pointer-events:none}
.vp-obj.vlak{border:2px solid var(--sk);background:color-mix(in srgb,var(--sk) 35%,transparent);border-radius:4px;display:flex;align-items:flex-start;justify-content:flex-start}
.vp-obj.vlak.aan{border-color:#fff;box-shadow:0 0 0 2px var(--sk)}
.vp-obj.vlak.nieuw{border-style:dashed}
.vp-obj.vlak span{display:inline-flex;align-items:center;gap:4px;margin:3px;padding:1px 6px 1px 1px;border-radius:9px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:600;white-space:nowrap;max-width:calc(100% - 6px);overflow:hidden}
.vp-obj i{font-style:normal;display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 3px;border-radius:9px;background:var(--sk);color:#fff;font-size:10px;font-weight:700}
.vp-obj.punt{transform:translate(-9px,-9px);display:flex;align-items:center;gap:4px}
.vp-obj.punt span{background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;white-space:nowrap}
.vp-obj.punt.aan i{box-shadow:0 0 0 3px #fff}
.vp-objgreep{position:absolute;right:-8px;bottom:-8px;width:14px;height:14px;border-radius:3px;background:#fff;border:2px solid var(--sk)}
.vk-tek .vp-obj.vlak{background:color-mix(in srgb,var(--sk) 45%,#f4efe4);border:none;border-radius:3px;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--sk) 70%,#333),3px 5px 0 rgba(30,50,20,.28)}
.vk-tek .vp-obj.vlak.aan{box-shadow:inset 0 0 0 2px #fff,0 0 0 2px var(--sk),3px 5px 0 rgba(30,50,20,.28)}
.vk-tek .vp-ovvak.vrij{background:rgba(255,255,255,.22);border-color:#fff}
.vp-oudplek{position:absolute;transform:translate(-50%,-50%);font-size:9px;color:#fff;background:rgba(0,0,0,.4);padding:1px 5px;border-radius:6px;white-space:nowrap;pointer-events:none}
@media (max-width:1099px){
  .vp-kaartgrid{grid-template-columns:1fr}
  .vp-ovgrid{grid-template-columns:1fr}
  .vp-ovkaart{height:min(56dvh,460px)}
  .vp-kaart{height:min(60dvh,480px)}
  .vp-grid{grid-template-columns:1fr}
  .vp-tl{order:1}.vp-rechts{order:2}.vp-zij{order:3}
  .vp-groep{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .vp-groep h3{width:100%;margin-bottom:0}
  .vp-teamkaart{margin:0}
}
@media (max-width:600px){
  .vp-dag .lang{display:none}.vp-dag .kort{display:inline}
  .vp-dag{padding:6px}
  .vp-titel h1{font-size:var(--t-2xl)}
  .vp-staat{min-width:0}
  .vp-ovkop{gap:6px}.vp-fsel{max-width:46%}
  .vp-tijdbalk{flex-direction:column;align-items:stretch}.vp-tbknoppen{padding-top:0}
}`;
  document.head.appendChild(s);
}
