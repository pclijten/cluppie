/* ====================================================================
   PLATFORMCENTRUM — eigen ruimte voor de eindbaas (alleen platformbeheerder).
   [20261111a] Vervangt de brede platform-pop-up (goedgekeurde mockup "Cluppie
   Platformcentrum", impactanalyse claude/eindbaas-platformcentrum-impactanalyse.md).

   Onderdelen: Overzicht (Vandaag doen), Uitrol (fases per club), Clubs
   (tabel + clubdetail in een lade), Maatwerk (alle clubs en onderdelen in één tabel, platform-maatwerk.js),
   Trainers (zonder club), Bibliotheek, Mails en Instellingen.
   Schakelaars per club staan alleen nog in het clubdetail; de ondersteuningsmodus
   start alleen nog via de knop in het tabblad Meehelpen.

   Schil: dezelfde vormtaal als de trainingscoördinator-app (.tc-app, zijbalk op
   desktop, onderbalk op de telefoon). Terugknop via terugLaag (geen state.js-wijziging).
   Pure logica (fases, Vandaag doen, filters) staat in platform-logica.js.
==================================================================== */
import { db, collection, getDocs, doc, getDoc, setDoc, query, where, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld, isPlatformBeheerder, terugLaag, terugLaagWeg, bewaakTerug } from './state.js?v=20261128k';
import { ico } from './icons.js?v=20261127b';
import { logoImgVoorDoc, DISTRICTEN, CLUPPIE_LOGO } from './clubconfig.js?v=20261128k';
import { STARTLIJST_STAPPEN } from './startlijst.js?v=20261011d';
import { BEHEERD, NAMEN as ONDERDEEL_NAMEN, platformToegestaan } from './onderdelen.js?v=20261128k';
import { FASES, FASE_NAAM, STANDAARD, KOPPEL_NAAM, faseVan, volgendeStap, filterClubs, vandaagDoen, trainersMetClub, kpiWaarden, dagenSinds } from './platform-logica.js?v=20261111a';
import { modulesVoorNieuweClub } from './onderdelen.js?v=20261128k';
import { OPTIES as TK_OPTIES } from './kamer-logica.js?v=20261127k';   /* [20261116m] mogelijkheden van de teamkamer, elk met een eigen schakelaar */
import { KEUZES as PDF_KEUZES, schoonProfiel, isStandaard, PDF_LIMIET_STANDAARD, AANWIJZING_MAX } from './pdf-profiel.js?v=20261115e';
import * as MW from './platform-maatwerk.js?v=20261128k';   /* [20261121a] Maatwerk-tabel, maatwerk en notities per club, rollen per club */
import { SPORTEN, sportVan, sportNaam } from './sporten.js?v=20261126g';   /* [20261125x] sportprofiel */

const STAP_NAAM = Object.fromEntries(STARTLIJST_STAPPEN.map(s => [s.id, s.titel]));
const MENU = [
  ['overzicht', 'Overzicht', 'navigation-dashboard'],
  ['uitrol', 'Uitrol', 'planning-week'],
  ['clubs', 'Clubs', 'admin-manage'],
  ['maatwerk', 'Maatwerk', 'action-filter'],     /* [20261121a] alle clubs en onderdelen in één tabel */
  ['trainers', 'Trainers', 'team-trainer'],
  ['bibliotheek', 'Bibliotheek', 'training-plan'],   /* [20261113d] trainingsvormen beheren */
  ['mails', 'Mails', 'communication-mail'],          /* [20261116p] teksten van alle mails */
  ['instellingen', 'Instellingen', 'navigation-settings'],
];
const LADE_TABS = [['overzicht', 'Overzicht'], ['mensen', 'Mensen'], ['onderdelen', 'Onderdelen en limieten'], ['pdf', 'PDF-trainingen'], ['profiel', 'Clubprofiel'], ['teams', 'Teams'], ['meehelpen', 'Meehelpen']];   /* [20261120b] Clubprofiel: documenten van de club inlezen (platform-clubprofiel.js) */

const P = {
  el: null, scherm: 'overzicht', filter: 'alle', zoek: '', faseFilter: null,
  lade: null,              // { clubId, tab }
  o: null, aanmeldingen: [], docs: {}, clubs: [], trainers: [],
  teams: {}, log: {}, platform: {}, laden: true, fout: '', alleTaken: false, alleTrainers: false,
  bevestig: null,          // aanmeldingId dat op een tweede tik wacht (afwijzen)
  pdf: {},                 // [20261114a] clubId → { concept, bestand, proef } (PDF-profiel instellen en proberen)
};

/* ---------- datahulp ---------- */
const telKeys = o => Object.keys(o || {}).length;
const datum = t => {
  try { const d = t && t.toDate ? t.toDate() : (typeof t === 'number' ? new Date(t) : null); return d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  catch (e) { return ''; }
};
function relatief(iso){
  const d = dagenSinds(iso);
  if (d == null) return 'nooit';
  if (d === 0) return 'vandaag';
  if (d === 1) return 'gisteren';
  return `${d} dagen`;
}

async function leesOverzicht(){
  try { const s = await getDoc(doc(db, 'platformstats', 'overzicht')); return s.exists() ? s.data() : null; }
  catch (e) { console.warn('[platform] overzicht lezen mislukt', e.code || e.message); return null; }
}
async function leesClubDocs(){
  const cs = await getDocs(collection(db, 'clubs')), m = {};
  cs.docs.forEach(d => { m[d.id] = { id: d.id, ...d.data() }; });
  return m;
}
async function leesAanmeldingen(){
  try { return (await getDocs(query(collection(db, 'clubAanmeldingen'), where('status', '==', 'nieuw')))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { return []; }
}
/* Terugval zonder platformstats/overzicht: alleen wat de client zelf kan lezen. */
async function terugval(docs){
  const wacht = {};
  try { (await getDocs(collection(db, 'aanvragen'))).docs.forEach(d => { const c = d.data().clubId; if (c) wacht[c] = (wacht[c] || 0) + 1; }); } catch (e) {}
  const clubs = Object.values(docs).map(c => ({ id: c.id, naam: c.naam || 'Club zonder naam', plaats: c.instellingen?.locatie?.plaats || '',
    teams: telKeys(c.teams), leden: telKeys(c.leden), wachtend: wacht[c.id] || 0, gemaakt: c.gemaakt, status: 'onbekend', signalen: [], terugvalRij: true }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
  return { clubs, totalen: { clubs: clubs.length, teams: clubs.reduce((n, c) => n + c.teams, 0), wachtend: Object.values(wacht).reduce((n, x) => n + x, 0) }, terugval: true };
}

async function laad(){
  P.laden = true; P.fout = ''; teken();
  try {
    const [o, docs, aanmeldingen, platform] = await Promise.all([leesOverzicht(), leesClubDocs(), leesAanmeldingen(), leesPlatformInstellingen()]);
    P.docs = docs; P.aanmeldingen = aanmeldingen; P.platform = platform;
    P.o = o || await terugval(docs);
    verrijk();
  } catch (e){
    console.error('[Cluppie] Platformcentrum kon niet laden:', e.code, e.message);
    P.fout = e.code === 'permission-denied'
      ? 'Firestore weigert het lezen. Controleer of de nieuwste firestore.rules zijn gedeployed en of je e-mailadres geverifieerd is.'
      : 'Laden mislukt (' + (e.code || e.message || 'onbekende fout') + ').';
  }
  P.laden = false; teken();
}
const uitrol = () => ({ ...STANDAARD, ...(P.platform?.uitrol || {}) });
function verrijk(){
  const nu = Date.now(), u = uitrol();
  P.clubs = (P.o.clubs || []).map(k => {
    const fase = faseVan(k, nu, u);
    return { ...k, fase, volgende: volgendeStap(k, fase, STAP_NAAM, nu, u) };
  });
  P.trainers = trainersMetClub(P.o.individueel, P.clubs);
}

/* ---------- openen en sluiten ---------- */
export async function openCentrum(scherm){
  if (!isPlatformBeheerder()) return;
  if (P.el){ if (scherm) zetScherm(scherm); return; }
  P.scherm = scherm || 'overzicht'; P.lade = null;
  const app = document.getElementById('app'); if (app) app.style.display = 'none';
  const el = document.createElement('div');
  el.id = 'pc-app'; el.className = 'tc-app pc-app';
  document.body.appendChild(el);
  P.el = el;
  el.addEventListener('click', klik);
  el.addEventListener('input', invoer);
  el.addEventListener('change', wijzig);
  el.addEventListener('keydown', e => { if (MW.toetsEnter(e)) return; if (e.key === 'Escape' && P.lade){ P.lade = null; teken(); } });
  MW.init({ P, teken, laadTeams });
  terugLaag('platform', { z: 40, open: () => !!P.el, sluit: terugStap });
  await laad();
}
function terugStap(){
  if (P.lade){ P.lade = null; teken(); return; }
  if (P.scherm !== 'overzicht'){ zetScherm('overzicht'); return; }
  sluitCentrum();
}
export function sluitCentrum(){
  if (!P.el) return;
  P.el.remove(); P.el = null; P.lade = null;
  terugLaagWeg('platform');
  const app = document.getElementById('app'); if (app) app.style.display = '';
  bewaakTerug();
}
function zetScherm(s){
  P.scherm = s; P.lade = null; P.bevestig = null;
  teken();
  const h = P.el?.querySelector('.tc-hoofd'); if (h) h.scrollTop = 0;
}

/* ---------- bouwstenen ---------- */
const chip = (tekst, soort) => `<span class="pf-chip ${soort || ''}">${esc(tekst)}</span>`;
const licht = st => `<span class="pf-licht ${esc(st || 'onbekend')}" aria-label="status ${esc(st || 'onbekend')}"></span>`;
function slChip(k){
  const sl = k.sportlink || {};
  if (!sl.gekoppeld) return chip('geen Sportlink', 'uit');
  return sl.fouten ? chip(`Sportlink: ${sl.fouten} fout`, 'let') : chip('Sportlink ✓', 'ok');
}
const voChip = k => k.privacy ? chip(k.privacy.vo ? 'VO ✓' : 'geen VO', k.privacy.vo ? 'ok' : 'let') : '';
function aiTekst(k){
  if (!k.ai) return '';
  return k.ai.aan ? `${k.ai.maand || 0}${k.ai.limiet ? ' / ' + k.ai.limiet : ''}` : 'uit';
}
function kop(titel, sub, knoppen = ''){
  return `<div class="pc-kop"><div><h1 class="tc-h1">${esc(titel)}</h1>${sub ? `<p class="tc-meta">${sub}</p>` : ''}</div>${knoppen ? `<div class="pc-knoppen">${knoppen}</div>` : ''}</div>`;
}
const knopNieuweClub = () => `<button class="knop fluo klein" data-pc="nieuweclub">${ico('action-add', 16)} Club toevoegen</button>`;
function bijgewerkt(){
  const b = P.o?.bijgewerkt;
  if (P.o?.terugval) return 'Basisoverzicht: fases en signalen verschijnen zodra <code>platformOverzichtNu</code> gedeployed is.';
  return b && b.toDate ? 'Bijgewerkt ' + esc(b.toDate().toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '';
}

/* ---------- Overzicht ---------- */
function taken(){
  return vandaagDoen({ clubs: P.clubs, aanmeldingen: P.aanmeldingen, trainers: P.trainers });
}
function taakRij(t){
  const knop = t.soort === 'aanmelding'
    ? `<span class="pc-knoppen">${afwijsKnop(t.aanmeldingId)}<button class="knop fluo klein" data-pc="goedkeuren" data-id="${esc(t.aanmeldingId)}">Goedkeuren</button></span>`
    : t.soort === 'trainer' ? `<button class="knop licht klein" data-pc="scherm" data-scherm="trainers">Bekijk</button>`
    : `<button class="knop licht klein" data-pc="club" data-id="${esc(t.clubId)}">Bekijk</button>`;
  return `<div class="pc-taak"><span class="pc-stip ${esc(t.niveau)}"></span><div class="pc-taak-tekst"><b>${esc(t.titel)}</b>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</div>${knop}</div>`;
}
function afwijsKnop(id){
  const zeker = P.bevestig === id;
  return `<button class="knop licht klein ${zeker ? 'pc-zeker' : ''}" data-pc="afwijzen" data-id="${esc(id)}">${zeker ? 'Zeker? Afwijzen' : 'Afwijzen'}</button>`;
}
function kpi(getal, label, sub, toon){
  return `<div class="pc-kpi ${toon || ''}"><div class="g">${getal}</div><div class="l">${esc(label)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
}
function htmlOverzicht(){
  const w = kpiWaarden(P.o, P.aanmeldingen, P.trainers);
  const lijst = taken(), toon = P.alleTaken ? lijst : lijst.slice(0, 8);
  const kpis = P.o.terugval
    ? [kpi(P.o.totalen.clubs || 0, 'clubs'), kpi(P.o.totalen.teams || 0, 'teams'), kpi(w.wacht, 'wachten op jou', w.wachtUitleg, w.wacht ? 'let' : '')]
    : [kpi(`${w.actieveClubs}<small>/${w.clubs}</small>`, 'actieve clubs', 'laatste 14 dagen'),
       kpi(w.coaches30, 'actieve coaches', 'laatste 30 dagen'),
       kpi(w.trainers, 'losse trainers', w.trainersNieuw ? `${w.trainersNieuw} nieuw deze week` : 'zonder club'),
       kpi(w.wacht, 'wachten op jou', w.wachtUitleg || 'niets open', w.wacht ? 'let' : ''),
       kpi(w.aiMaand, 'AI-aanroepen', `deze maand · ${w.aiClubs} club${w.aiClubs === 1 ? '' : 's'} aan`)];
  const fasen = FASES.map(f => { const cl = P.clubs.filter(k => k.fase === f.id);
    return `<button class="pc-taak pc-fase-rij" data-pc="fase" data-fase="${f.id}"><div class="pc-taak-tekst"><b>${esc(f.naam)}</b><small>${cl.length ? esc(cl.map(k => k.naam).slice(0, 4).join(', ') + (cl.length > 4 ? ` en ${cl.length - 4} meer` : '')) : '—'}</small></div>${chip(String(cl.length))}</button>`; }).join('');
  return `${kop('Overzicht', 'Wat vandaag jouw aandacht vraagt, en hoe het platform ervoor staat.', `<button class="knop licht klein" data-pc="scherm" data-scherm="uitrol">Naar uitrol</button>${knopNieuweClub()}`)}
    <div class="pc-kpis">${kpis.join('')}</div>
    <div class="pc-twee">
      <section class="kaart pc-blok"><div class="pc-blok-kop"><h2 class="tc-h2">Vandaag doen</h2><small>${lijst.length ? 'op volgorde van belang' : ''}</small></div>
        ${toon.length ? toon.map(taakRij).join('') : '<p class="tc-leeg-klein">Niets dat op jou wacht. Mooi zo.</p>'}
        ${lijst.length > 8 ? `<button class="knop licht klein" data-pc="alletaken">${P.alleTaken ? 'Toon minder' : `Toon alle ${lijst.length}`}</button>` : ''}</section>
      ${P.o.terugval ? '' : `<section class="kaart pc-blok"><div class="pc-blok-kop"><h2 class="tc-h2">Uitrol</h2><small>${P.clubs.length} club${P.clubs.length === 1 ? '' : 's'}</small></div>${fasen}</section>`}
    </div>`;
}

/* ---------- Uitrol ---------- */
function clubKaart(k){
  const st = k.startlijst || { gedaan: 0, totaal: 7 };
  const sig = (k.signalen || [])[0];
  return `<button class="pc-ck" data-pc="club" data-id="${esc(k.id)}">
    <span class="pc-ck-kop">${licht(k.status)}<b>${esc(k.naam)}</b></span>
    <small>${esc([k.plaats, `${k.teams || 0} teams`].filter(Boolean).join(' · '))}</small>
    <span class="pc-balk" title="Aan de slag ${st.gedaan} van ${st.totaal}"><i style="width:${Math.round(100 * st.gedaan / (st.totaal || 7))}%"></i></span>
    <small>Aan de slag ${st.gedaan}/${st.totaal}${sig ? ' · ' + esc(sig.tekst) : ''}</small>
    ${k.volgende ? `<span class="pc-volgende">${esc(k.volgende)} ›</span>` : ''}</button>`;
}
function aanmeldKaart(a){
  return `<div class="pc-taak pc-aanmeld"><span class="pc-stip info"></span>
    <div class="pc-taak-tekst"><b>${esc(a.clubNaam || '')}</b>${a.sportlinkClientId ? ' <span class="pf-chip ok">via Sportlink</span>' : ''}
      <small>${esc([a.plaats, a.district && (DISTRICTEN.find(d => d.id === a.district)?.naam || a.district), a.aantalTeams ? a.aantalTeams + ' teams' : '', a.gemaakt ? datum(a.gemaakt) : ''].filter(Boolean).join(' · '))}</small>
      <small>${esc(a.contactNaam || '')}${a.rol ? ' (' + esc(a.rol) + ')' : ''}${a.contactEmail ? ' · ' + esc(a.contactEmail) : ''}</small>
      ${a.bericht ? `<p class="pc-bericht">${esc(a.bericht)}</p>` : ''}</div>
    <span class="pc-knoppen">${afwijsKnop(a.id)}<button class="knop fluo klein" data-pc="goedkeuren" data-id="${esc(a.id)}">Goedkeuren</button></span></div>`;
}
function htmlUitrol(){
  if (P.o.terugval) return `${kop('Uitrol', bijgewerkt())}<div class="kaart leeg">De uitrol per club verschijnt zodra <code>platformOverzichtNu</code> gedeployed is en je één keer op Vernieuwen tikt.</div>`;
  return `${kop('Uitrol', 'Elke club loopt van aanmelding naar actief gebruik. Per kaart zie je de volgende stap.')}
    <div class="pc-trechter">${FASES.map(f => { const lijst = P.clubs.filter(k => k.fase === f.id);
      return `<div class="pc-kolom" title="${esc(f.uitleg)}"><h3>${esc(f.naam)}<b>${lijst.length}</b></h3>${lijst.length ? lijst.map(clubKaart).join('') : '<small class="tc-leeg-klein">Geen clubs</small>'}</div>`; }).join('')}</div>
    <section class="kaart pc-blok"><div class="pc-blok-kop"><h2 class="tc-h2">Aangemeld, nog te beoordelen</h2><small>${P.aanmeldingen.length}</small></div>
      ${P.aanmeldingen.length ? P.aanmeldingen.map(aanmeldKaart).join('') : '<p class="tc-leeg-klein">Geen nieuwe aanmeldingen.</p>'}</section>`;
}

/* ---------- Clubs ---------- */
function htmlClubs(){
  const lijst = filterClubs(P.clubs, { filter: P.filter, zoek: P.zoek, fase: P.faseFilter });
  const aandacht = P.clubs.filter(k => k.status === 'rood' || k.status === 'oranje').length;
  const seg = (id, label, n) => `<button data-pc="filter" data-filter="${id}" class="${P.filter === id ? 'actief' : ''}">${label}${n != null ? ` <small>${n}</small>` : ''}</button>`;
  return `${kop('Clubs', 'Eén regel per club. Instellingen, teams en meehelpen zitten in het clubdetail.', knopNieuweClub())}
    <div class="pc-zoekrij">
      <input class="invoer" id="pcZoek" placeholder="Zoek club, plaats of teamnaam" value="${esc(P.zoek)}" autocomplete="off" aria-label="Zoek club, plaats of teamnaam">
      ${P.o.terugval ? '' : `<div class="segment">${seg('alle', 'Alle', P.clubs.length)}${seg('aandacht', 'Aandacht', aandacht)}${seg('groen', 'In orde', P.clubs.length - aandacht)}</div>`}
      ${P.faseFilter ? `<button class="pf-chip pc-fasechip" data-pc="fasewis">Fase: ${esc(FASE_NAAM[P.faseFilter])} ✕</button>` : ''}
    </div>
    <div class="pc-tabel-wrap"><table class="pc-tabel">
      <thead><tr><th aria-label="Status"></th><th>Club</th><th>Fase</th><th class="r">Teams</th><th class="r">Coaches 30d</th><th>Laatst</th><th>Koppelingen</th><th class="r">AI deze maand</th></tr></thead>
      <tbody>${lijst.length ? lijst.map(k => `<tr data-pc="club" data-id="${esc(k.id)}" tabindex="0">
        <td>${licht(k.status)}</td>
        <td class="pc-naam"><b>${esc(k.naam)}</b><small>${esc([k.plaats, (k.signalen || [])[0]?.tekst].filter(Boolean).join(' · '))}</small></td>
        <td>${esc(FASE_NAAM[k.fase] || '–')}</td><td class="r">${k.teams ?? '–'}</td><td class="r">${k.coaches30 ?? '–'}</td>
        <td>${k.terugvalRij ? '–' : esc(relatief(k.laatsteGebruik))}</td>
        <td>${k.terugvalRij ? '' : slChip(k) + ' ' + voChip(k)}</td><td class="r">${esc(aiTekst(k)) || '–'}</td></tr>`).join('')
        : '<tr><td colspan="8" class="tc-leeg">Geen clubs in deze selectie.</td></tr>'}</tbody></table></div>`;
}

/* ---------- Trainers ---------- */
const STATUS_COACH = { 'eigen-team': ['eigen team', 'ok'], 'wacht-op-club': ['wacht op club', 'let'], 'nog-geen-team': ['nog geen team', ''] };
function trainerRij(t){
  const [st, soort] = STATUS_COACH[t.status] || [t.status, ''];
  const team = (t.teams || []).map(x => `${x.naam || x.categorie}${x.spelers ? ` · ${x.spelers} spelers` : ''}`).join(' | ');
  const act = t.status === 'nog-geen-team' && t.aangemeld ? `aangemeld ${relatief(t.aangemeld)}` : `ingelogd ${relatief(t.laatsteLogin)}`;
  return `<tr>
    <td class="pc-naam"><b>${esc(t.naam)}${t.nieuw ? ' <span class="pc-nieuw">nieuw</span>' : ''}</b><small>${t.email ? `<span class="pc-mail">${esc(t.email)}</span>` : ''}</small></td>
    <td>${team ? esc(team) : '<span class="tc-meta">—</span>'}</td>
    <td>${t.eigenClub ? esc(t.eigenClub.naam) + (t.eigenClub.plaats ? `<small class="pc-sub">${esc(t.eigenClub.plaats)}</small>` : '') : '—'}${t.club ? ' ' + chip('doet mee', 'ok') : ''}</td>
    <td>${chip(st, soort)}</td><td>${esc(act)}</td>
    <td class="r"><span class="pc-knoppen pc-rechts">${t.email ? `<button class="knop licht klein" data-pc="kopieer" data-tekst="${esc(t.email)}">${ico('action-copy', 15)} E-mail</button>` : ''}${koppelKnop(t)}</span></td></tr>`;
}
/* [20261111b] Koppel aan club: zet een voorstel klaar dat de trainer in zijn app ziet. */
function koppelKnop(t){
  if (!t.club || !t.teamId || t.status !== 'eigen-team') return '';
  if (t.koppel) return chip(KOPPEL_NAAM[t.koppel] || t.koppel, t.koppel === 'aangevraagd' ? 'let' : t.koppel === 'open' ? '' : 'uit');
  const zeker = P.bevestig === 'k:' + t.teamId;
  return `<button class="knop ${zeker ? 'fluo' : 'licht'} klein" data-pc="koppel" data-team="${esc(t.teamId)}" data-club="${esc(t.club.id)}">${zeker ? `Voorstel naar ${esc(t.naam.split(' ')[0])}?` : 'Koppel aan club'}</button>`;
}
function soloAIBlok(){
  const s = { aan: false, limiet: 20, chatLimiet: 30, ...(P.platform?.soloAI || {}) };
  const gebruikt = P.o?.totalen?.aiSolo || 0;
  return `<section class="kaart pc-blok">
    <div class="pc-schakel"><div><b>AI-hulp voor losse trainers</b><small>Uitleg bij Training maken, een jaarvoorstel in Seizoensplanning, de doelregel op de Nu-kaart en de hulpchat. Kost per aanroep; geldt voor alle trainers zonder club.${s.aan ? ` Deze maand ${gebruikt} aanroep${gebruikt === 1 ? '' : 'en'}.` : ''}</small></div>
      <button type="button" class="pc-sw" role="switch" aria-checked="${s.aan === true}" aria-label="AI-hulp voor losse trainers" data-pc="soloai"></button></div>
    <div class="pc-schakel"><div><b>Maximum per trainer per maand</b><small>Daarna werkt alles gewoon zonder AI.</small></div>
      <input class="invoer pc-getal" type="number" inputmode="numeric" min="0" max="1000" id="pcSoloLimiet" value="${esc(s.limiet)}" aria-label="Maximum AI-aanroepen per trainer per maand"></div>
    <div class="pc-schakel"><div><b>Maximum vragen aan de hulpchat per trainer per maand</b><small>Telt apart van het maximum hierboven. Met 0 staat de hulpchat uit voor trainers zonder club.</small></div>
      <input class="invoer pc-getal" type="number" inputmode="numeric" min="0" max="1000" id="pcSoloChat" value="${esc(s.chatLimiet)}" aria-label="Maximum vragen aan de hulpchat per trainer per maand"></div>
    <div class="pc-schakel"><div><b>Teamkamer voor losse trainers</b><small>Ouders en spelers kijken mee bij teams zonder club. Staat standaard uit.</small></div>
      <button type="button" class="pc-sw" role="switch" aria-checked="${P.platform?.teamkamerLos === true}" aria-label="Teamkamer voor losse trainers" data-pc="teamkamerlos"></button></div>
    ${P.platform?.teamkamerLos === true ? tkOptiesHtml(P.platform?.teamkamerLosOpties, 'tklosoptie') : ''}</section>`;
}
function htmlTrainers(){
  const ind = P.o.individueel;
  if (!ind) return `${kop('Trainers zonder club', '')}<div class="kaart leeg">${P.o.terugval ? 'Verschijnt zodra <code>platformOverzichtNu</code> gedeployed is.' : 'Tik op Vernieuwen om de trainers op te halen.'}</div>`;
  const lijst = P.alleTrainers ? P.trainers : P.trainers.slice(0, 25);
  const herkend = P.trainers.filter(t => t.club).length;
  return `${kop('Trainers zonder club', `${ind.totaal} account${ind.totaal === 1 ? '' : 's'} · ${ind.eigenTeam || 0} met eigen team · ${ind.wachtOpClub || 0} wachten op een club · ${ind.nogGeenTeam || 0} nog geen team${herkend ? ` · <b>${herkend}</b> bij een club die al meedoet` : ''}`)}
    ${soloAIBlok()}
    <p class="tc-meta pc-uitleg">"Doet mee" betekent dat de club die de trainer zelf invulde al Cluppie gebruikt. Met Koppel aan club ziet de trainer in de app een voorstel om zijn team bij de club onder te brengen; daarna keurt de clubbeheerder het goed. Spelers, wedstrijden en trainingen gaan mee.</p>
    <div class="pc-tabel-wrap"><table class="pc-tabel">
      <thead><tr><th>Trainer</th><th>Team</th><th>Club (zelf ingevuld)</th><th>Status</th><th>Activiteit</th><th></th></tr></thead>
      <tbody>${lijst.length ? lijst.map(trainerRij).join('') : '<tr><td colspan="6" class="tc-leeg">Nog geen trainers buiten een club.</td></tr>'}</tbody></table></div>
    ${P.trainers.length > 25 ? `<button class="knop licht klein" data-pc="alletrainers">${P.alleTrainers ? 'Toon minder' : `Toon alle ${P.trainers.length}`}</button>` : ''}
    ${ind.afgekapt ? '<p class="tc-meta">Alleen de nieuwste worden getoond.</p>' : ''}`;
}

/* ---------- Instellingen ---------- */
function htmlInstellingen(){
  const beheerders = P.platform?.beheerders || [];
  const st = modulesVoorNieuweClub(P.platform?.standaard), u = uitrol();
  const sw = (sl, naam, uitleg, aan) => `<div class="pc-schakel"><div><b>${esc(naam)}</b>${uitleg ? `<small>${esc(uitleg)}</small>` : ''}</div>
    <button type="button" class="pc-sw" role="switch" aria-checked="${aan}" aria-label="${esc(naam)} voor nieuwe clubs" data-pc="standaard" data-sl="${sl}"></button></div>`;
  const getal = (id, naam, uitleg, waarde, attr) => `<div class="pc-schakel"><div><b>${esc(naam)}</b>${uitleg ? `<small>${esc(uitleg)}</small>` : ''}</div>
    <input class="invoer pc-getal" type="number" inputmode="numeric" id="${id}" value="${waarde == null ? '' : esc(waarde)}" ${attr} aria-label="${esc(naam)}"></div>`;
  return `${kop('Instellingen', 'Geldt voor het hele platform. Per club pas je onderdelen en limieten aan in het clubdetail.')}
    <div class="pc-twee">
      <section class="kaart pc-blok"><h2 class="tc-h2">Standaard voor nieuwe clubs</h2>
        <p class="tc-meta">Zo begint elke club die je vanaf nu goedkeurt of aanmaakt. Bestaande clubs veranderen niet.</p>
        ${sw('trainingsmodule', 'Training maken', '', st.trainingsmodule)}
        ${sw('seizoensplan', 'Seizoensplanning', '', st.seizoensplan)}
        ${sw('ai', 'AI-functies', 'Kost per aanroep.', st.ai)}
        ${getal('pcStAiLimiet', 'AI per maand', 'Leeg = onbeperkt', st.aiLimiet, 'min="0" max="100000" placeholder="onbeperkt"')}
        ${getal('pcStVideo', 'Video max (MB)', 'Tussen 5 en 300', st.maxVideoMB, 'min="5" max="300"')}</section>
      <div class="pc-wrap">
        <section class="kaart pc-blok"><h2 class="tc-h2">Uitrol</h2>
          ${getal('pcProef', 'Proefperiode (dagen)', 'Zo lang staat een club na de start in Proef.', u.proefDagen, 'min="1" max="90"')}
          ${getal('pcSlapend', 'Slapend na (dagen)', 'Zonder gebruik gaat een club naar Slapend.', u.slapendDagen, 'min="7" max="120"')}</section>
        <section class="kaart pc-blok"><h2 class="tc-h2">Gedeelde gegevens</h2>
          <div class="pc-taak"><div class="pc-taak-tekst"><b>KNVB-kalenders</b><small>Speeldagen per district en seizoen; clubs krijgen ze automatisch.</small></div><button class="knop licht klein" data-pc="kalenders">Beheren</button></div>
          <div class="pc-taak"><div class="pc-taak-tekst"><b>Platformbeheerders</b><small>${esc(['jij', ...beheerders].join(' · '))}</small></div></div>
          <div class="pc-taak"><div class="pc-taak-tekst"><b>Cijfers</b><small>${bijgewerkt() || 'Nog niet bijgewerkt'}. Elke nacht vanzelf.</small></div><button class="knop licht klein" data-pc="vernieuw">Vernieuwen</button></div></section>
      </div>
    </div>`;
}

/* ---------- Clubdetail (lade) ---------- */
/* [20261120g] Een club openen. Staat het clubdocument niet in de lijst die bij het openen is gelezen (bijv. een club
   die net is aangemaakt), dan halen we het los op. Lukt dat niet, dan zeggen we dat, in plaats van niets te doen. */
async function openLade(id, tab = 'overzicht'){
  P.lade = { clubId: id, tab }; P.bevestig = null; P._fokusLade = true;
  if (!P.docs[id]){
    teken();
    try { const s = await getDoc(doc(db, 'clubs', id)); if (s.exists()) P.docs[id] = { id, ...s.data() }; }
    catch (e){ console.warn('[platform] club lezen', id, e.code || e.message); }
  }
  teken();
}
function htmlLadeVeilig(){
  try { return htmlLade(); }
  catch (e){
    console.error('[platform] clubdetail', P.lade?.clubId, e);
    return `<section class="pc-lade"><button class="knop licht klein pc-lade-terug" data-pc="sluitlade">${ico('navigation-back', 16)} Terug</button>
      <div class="pc-signaal rood"><b>Deze club kan niet worden getoond.</b><br>${esc(e.message || String(e))}</div></section>`;
  }
}
function htmlLade(){
  const k = P.clubs.find(x => x.id === P.lade.clubId), c = P.docs[P.lade.clubId];
  if (!k) return `<section class="pc-lade"><button class="knop licht klein pc-lade-terug" data-pc="sluitlade">${ico('navigation-back', 16)} Terug</button><div class="pc-signaal rood">Deze club staat niet meer in het overzicht. Tik op Vernieuwen.</div></section>`;
  if (!c) return `<section class="pc-lade"><button class="knop licht klein pc-lade-terug" data-pc="sluitlade">${ico('navigation-back', 16)} Terug</button><p class="tc-leeg-klein">${esc(k.naam)} laden…</p></section>`;
  const tab = P.lade.tab;
  let body = '';
  if (tab === 'onderdelen') body = ladeOnderdelen(c);
  else if (tab === 'pdf') body = ladePdf(c);
  else if (tab === 'profiel') body = '<div id="cpRoot" class="cp-root"></div>';
  else if (tab === 'teams') body = ladeTeams(k);
  else if (tab === 'mensen') body = MW.htmlMensen(k, c);
  else if (tab === 'meehelpen') body = ladeMeehelpen(k, c);
  else body = ladeOverzicht(k, c);
  const logo = logoImgVoorDoc(c, 'club-schild');
  /* [20261116n] De club opent in het hoofdscherm (was een smalle lade rechts): zelfde tabbladen, volle breedte.
     De terugknop van de telefoon of de browser sluit hem via terugStap(). */
  const vanwaar = MENU.find(m => m[0] === P.scherm)?.[1] || 'Overzicht';
  return `<section class="pc-lade" aria-label="${esc(k.naam)}">
      <button class="knop licht klein pc-lade-terug" data-pc="sluitlade">${ico('navigation-back', 16)} Terug naar ${esc(vanwaar)}</button>
      <div class="pc-lade-kop">${logo ? `<span class="club-shirt">${logo}</span>` : ''}<div class="pc-lade-titel"><h1 class="tc-h1">${esc(k.naam)}</h1><p class="tc-meta">${esc([k.plaats, k.terugvalRij ? '' : 'laatst gebruikt ' + relatief(k.laatsteGebruik), k.gemaakt ? 'sinds ' + datum(k.gemaakt) : ''].filter(Boolean).join(', '))}</p></div></div>
      <div class="pc-lade-tabs" role="tablist">${LADE_TABS.map(([id, n]) => `<button role="tab" aria-selected="${tab === id}" class="${tab === id ? 'actief' : ''}" data-pc="ladetab" data-tab="${id}">${esc(n)}</button>`).join('')}</div>
      <div class="pc-lade-body">${body}</div></section>`;
}
function ladeOverzicht(k, c){
  const st = k.startlijst || {}, pv = c.instellingen?.privacy || {};
  const admins = Object.entries(c.adminsInfo || {}).map(([, a]) => a?.naam).filter(Boolean);
  const sport = sportVan(c);
  return `<div class="pc-chips">${chip(sportNaam(sport))}${k.terugvalRij ? '' : slChip(k) + voChip(k)}${chip(FASE_NAAM[k.fase] || 'fase onbekend')}${k.ai?.aan ? chip(`AI ${aiTekst(k)}`, k.ai.limiet && k.ai.maand >= k.ai.limiet * 0.9 ? 'let' : '') : chip('AI uit', 'uit')}</div>
    ${(k.signalen || []).map(s => `<div class="pc-signaal ${esc(s.niveau)}"><b>Vraagt aandacht:</b> ${esc(s.tekst)}</div>`).join('')}
    <div class="pc-kpis pc-kpis-3">${kpi(k.teams ?? 0, 'teams')}${kpi(k.coaches30 ?? '–', 'coaches 30d')}${kpi(`${st.gedaan ?? '–'}<small>/${st.totaal || 7}</small>`, 'aan de slag')}</div>
    ${k.volgende ? `<div class="pc-taak"><div class="pc-taak-tekst"><b>Volgende stap</b><small>${esc(k.volgende)}</small></div></div>` : ''}
    ${(st.open || []).length ? `<div class="pc-taak"><div class="pc-taak-tekst"><b>Nog te doen</b><small>${esc(st.open.map(x => STAP_NAAM[x] || x).join(' · '))}</small></div></div>` : ''}
    ${k.wachtend ? `<div class="pc-taak"><div class="pc-taak-tekst"><b>Coaches wachten op goedkeuring</b><small>${k.wachtend} aanvra${k.wachtend === 1 ? 'ag' : 'gen'} bij de clubbeheerder</small></div></div>` : ''}
    <div class="pc-hernoem"><b>Naam en plaats</b>
      <div class="pc-hernoem-rij"><label><span>Clubnaam</span><input class="invoer" id="pcClubNaam" value="${esc(c.naam || '')}" maxlength="60" autocomplete="off"></label>
        <label><span>Plaats</span><input class="invoer" id="pcClubPlaats" value="${esc(c.instellingen?.locatie?.plaats || '')}" maxlength="60" autocomplete="off"></label>
        <button class="knop fluo klein" data-pc="hernoem">Opslaan</button></div>
      <small>Ook de naam die bij de teams en clubberichten staat, wordt bijgewerkt. Na een nieuwe plaats zoekt de clubbeheerder de plaats één keer opnieuw op in Instellingen, voor het weer.</small></div>
    <div class="pc-hernoem"><b>Sport</b>
      <div class="pc-hernoem-rij"><label><span>Sport van de club</span><select class="invoer" id="pcClubSport">${Object.values(SPORTEN).map(p => `<option value="${esc(p.id)}" ${p.id === sport ? 'selected' : ''}>${esc(p.naam)}</option>`).join('')}</select></label>
        <button class="knop licht klein" data-pc="sport">Wijzigen…</button></div>
      <small>Gekozen bij het aanmelden van de club. Alleen jij kunt dit wijzigen; de clubbeheerder ziet de sport onder Instellingen. Wijzigen verandert de categorieën, het veld, de opstellingen, de wedstrijdregels en de oefenstof voor alle teams. Bestaande wedstrijden en beoordelingen blijven staan.</small></div>
    <div class="pc-taak"><div class="pc-taak-tekst"><b>Clubbeheerder${admins.length === 1 ? '' : 's'}</b><small>${esc(admins.join(', ') || `${telKeys(c.admins)} beheerder${telKeys(c.admins) === 1 ? '' : 's'}`)}</small></div></div>
    ${pv.contactEmail ? `<div class="pc-taak"><div class="pc-taak-tekst"><b>Contact van de club</b><small class="pc-mail">${esc(pv.contactEmail)}</small></div><button class="knop licht klein" data-pc="kopieer" data-tekst="${esc(pv.contactEmail)}">${ico('action-copy', 15)} Kopieer</button></div>` : ''}
    ${MW.htmlRollenRegel(k, c)}
    ${MW.htmlMaatwerkBlok(c)}`;
}
/* [20261116m] Teamkamer: onder de hoofdschakelaar elke mogelijkheid apart. Alles staat standaard uit. */
function tkOptiesHtml(bron, actie){
  bron = bron || {};
  return `<div class="pc-tkopties"><p class="tc-meta">Mogelijkheden van de teamkamer. Wat uit staat, bestaat niet voor trainers, ouders en spelers. Met alles uit zien ouders alleen de agenda en hoeveel spelers erbij zijn.</p>
    ${TK_OPTIES.map(([k, naam, uitleg]) => `<div class="pc-schakel"><div><b>${esc(naam)}</b><small>${esc(uitleg)}</small></div><button type="button" class="pc-sw" role="switch" aria-checked="${bron[k] === true}" aria-label="Teamkamer: ${esc(naam)}" data-pc="${actie}" data-sl="${k}"></button></div>`).join('')}
    <div class="pc-taak"><div class="pc-taak-tekst"><b>In één keer</b></div><button type="button" class="knop licht klein" data-pc="${actie}alles" data-aan="1">Alles aan</button> <button type="button" class="knop licht klein" data-pc="${actie}alles" data-aan="0">Alles uit</button></div></div>`;
}
function ladeOnderdelen(c){
  const pm = c.platformModules || {};
  const sw = (sl, naam, uitleg, aan) => `<div class="pc-schakel"><div><b>${esc(naam)}</b>${uitleg ? `<small>${esc(uitleg)}</small>` : ''}</div>
    <button type="button" class="pc-sw" role="switch" aria-checked="${aan}" aria-label="${esc(naam)}" data-pc="schakel" data-sl="${sl}"></button></div>`;
  const getal = (sl, naam, uitleg, waarde, attr) => `<div class="pc-schakel"><div><b>${esc(naam)}</b>${uitleg ? `<small>${esc(uitleg)}</small>` : ''}</div>
    <input class="invoer pc-getal" type="number" inputmode="numeric" data-pcnum="${sl}" value="${waarde == null ? '' : esc(waarde)}" ${attr} aria-label="${esc(naam)}"></div>`;
  const k = P.clubs.find(x => x.id === c.id) || {};
  return `<p class="tc-meta">Wat deze club kan gebruiken. Wijzigingen gelden meteen.</p>
    ${sw('ai', 'AI-functies', 'Chat, verslagen, trainingsuitleg. Kost per aanroep.', pm.ai === true)}
    ${getal('aiLimiet', 'AI per maand', k.ai?.aan ? `${k.ai.maand || 0} gebruikt deze maand` : 'Leeg = onbeperkt', pm.aiLimiet, 'min="0" max="100000" placeholder="onbeperkt"')}
    ${BEHEERD.map(sl => sw(sl, ONDERDEEL_NAMEN[sl], '', platformToegestaan(c, sl))).join('')}
    ${sw('scouting', 'Scouting eerste elftal', 'AI-rapport over de tegenstander. Kost per rapport.', pm.scouting === true)}
    ${sw('teamkamer', 'Teamkamer', 'Ouders kijken mee bij het team van hun kind. Hoofdschakelaar: uit is alles uit. Eerst de functions en rules deployen.', pm.teamkamer === true)}
    ${pm.teamkamer === true ? tkOptiesHtml(pm.teamkamerOpties, 'tkoptie') : ''}
    ${sw('veldplanner', 'Veldplanner', 'Clubbeheer verdeelt de teams over velden, tijden en kleedkamers. Eerst de rules deployen.', pm.veldplanner === true)}
    ${sw('activiteiten', 'Activiteiten', 'Een comité organiseert clubactiviteiten: draaiboek, vrijwilligers, dagprogramma. Eerst de rules en functions deployen.', pm.activiteiten === true)}
    ${sw('leren', 'Leren van gebruik', 'Cluppie leert van hoe trainers deze club de app gebruiken.', pm.leren === true)}
    ${getal('maxVideoMB', 'Video max (MB)', 'Tussen 5 en 300', Number(pm.maxVideoMB) > 0 ? pm.maxVideoMB : 100, 'min="5" max="300"')}`;
}
/* ---------- [20261114a] PDF-trainingen: profiel per club (alleen de eindbaas) ----------
   Hoe de oefenstof-PDF's van deze club eruitzien (pdf-profiel.js), plus omzetten zonder
   AI-module met een eigen maandlimiet. "Proberen" leest een voorbeeld-PDF in deze browser
   en zet hem om met het nog niet bewaarde profiel; er wordt niets opgeslagen of geteld. */
function pdfStaat(c){
  if (!P.pdf[c.id]) P.pdf[c.id] = { concept: schoonProfiel(c.platformModules?.pdfProfiel), bestand: null, proef: null };
  return P.pdf[c.id];
}
const pdfGewijzigd = (st, c) => JSON.stringify(schoonProfiel(st.concept)) !== JSON.stringify(schoonProfiel(c.platformModules?.pdfProfiel));
const meervoud = (n, een, veel) => `${n} ${n === 1 ? een : veel}`;
function ladePdf(c){
  const pm = c.platformModules || {}, st = pdfStaat(c), p = st.concept, gewijzigd = pdfGewijzigd(st, c);
  const keuze = (veld, titel) => `<fieldset class="pc-pdf-veld"><legend>${esc(titel)}</legend>${PDF_KEUZES[veld].map(([w, n, u]) =>
    `<label class="pc-pdf-keuze"><input type="radio" name="pdf_${veld}" value="${w}" data-pdfveld="${veld}" ${p[veld] === w ? 'checked' : ''}><span><b>${esc(n)}</b><small>${esc(u)}</small></span></label>`).join('')}</fieldset>`;
  const omzetten = pm.ai === true
    ? '<div class="pc-signaal info">AI staat aan voor deze club: omzetten telt mee in de AI-limiet.</div>'
    : `<div class="pc-schakel"><div><b>PDF omzetten zonder AI-module</b><small>Ongeveer een cent per PDF. Staat het uit, dan zien trainers alleen de PDF.</small></div>
        <button type="button" class="pc-sw" role="switch" aria-checked="${pm.pdfOmzetten === true}" aria-label="PDF omzetten" data-pc="schakel" data-sl="pdfOmzetten"></button></div>
      ${pm.pdfOmzetten === true ? `<div class="pc-schakel"><div><b>PDF's per maand</b><small>Leeg = ${PDF_LIMIET_STANDAARD}</small></div>
        <input class="invoer pc-getal" type="number" inputmode="numeric" data-pcnum="pdfLimiet" value="${pm.pdfLimiet == null ? '' : esc(pm.pdfLimiet)}" min="0" max="10000" placeholder="${PDF_LIMIET_STANDAARD}" aria-label="PDF's per maand"></div>` : ''}`;
  const r = st.proef;
  const proef = !r ? ''
    : r.bezig ? `<div class="pc-pdf-res"><p class="tc-meta">${esc(r.naam || '')}: ${esc(r.stap || 'bezig…')}</p></div>`
    : r.fout ? `<div class="pc-signaal rood">Proberen mislukt: ${esc(r.fout)}</div>`
    : `<div class="pc-pdf-res">
        <div class="pc-chips">${chip(meervoud(r.aantalPaginas, 'pagina', "pagina's"))}${r.overgeslagen ? chip(`${r.overgeslagen} overgeslagen`) : ''}${chip(meervoud(r.plaatjes, 'plaatje', 'plaatjes'))}${chip(meervoud(r.aantal, 'oefening', 'oefeningen'))}</div>
        <div class="pc-signaal ${r.goed ? 'info' : ''}"><b>${r.goed ? 'Goed genoeg om vanzelf te delen' : 'Zou wachten op een blik'}</b> · ${r.score.dekkingPct}% van de tekst behouden, ${meervoud(r.score.verzonnenAantal, 'woord', 'woorden')} toegevoegd${r.score.verzonnenVoorbeelden?.length ? ` (${esc(r.score.verzonnenVoorbeelden.slice(0, 5).join(', '))})` : ''}.</div>
        <div class="trw-inline pc-pdf-oef">${r.html}</div></div>`;
  return `<p class="tc-meta">Hoe de oefenstof van deze club eruitziet. Bewaren geldt voor alle volgende uploads van de club; bestaande trainingen veranderen niet.</p>
    ${omzetten}
    ${keuze('indeling', 'Indeling')}
    ${keuze('plaatjes', 'Veldtekeningen')}
    ${keuze('naam', 'Bestandsnamen')}
    <fieldset class="pc-pdf-veld"><legend>Overslaan</legend>
      <label class="ci-schakel"><input type="checkbox" data-pdfveld="overslaanEerste" ${p.overslaanEerste ? 'checked' : ''}><span>Eerste pagina overslaan (voorblad)</span></label>
      <label class="pc-pdf-label" for="pcPdfWoorden">Pagina's overslaan waarvan de kop een van deze woorden bevat</label>
      <input class="invoer" id="pcPdfWoorden" data-pdfveld="overslaanWoorden" value="${esc(p.overslaanWoorden.join(', '))}" placeholder="Bijv. Legenda, Inhoud" maxlength="200"></fieldset>
    <fieldset class="pc-pdf-veld"><legend>Aanwijzing voor de AI (optioneel)</legend>
      <textarea class="invoer" rows="3" data-pdfveld="aanwijzing" maxlength="${AANWIJZING_MAX}" placeholder="Bijv. De kop Organisatie hoort bij Benodigdheden. Onderaan elke pagina staat een voettekst die niet bij de oefening hoort.">${esc(p.aanwijzing)}</textarea>
      <small class="tc-meta">Alleen over de opmaak. De tekst blijft letterlijk en de woordcontrole blijft gelden.</small></fieldset>
    <div class="rij pc-pdf-knoppen"><button class="knop vol" data-pc="pdfbewaar" ${gewijzigd ? '' : 'disabled'}>${gewijzigd ? 'Bewaren' : 'Bewaard'}</button>
      ${isStandaard(p) ? '' : '<button class="knop licht" data-pc="pdfstandaard">Standaard</button>'}</div>
    <section class="pc-pdf-proef"><h3 class="tc-h2">Proberen met een voorbeeld-PDF</h3>
      <p class="tc-meta">Met de keuzes hierboven, ook als ze nog niet bewaard zijn. Er wordt niets opgeslagen.</p>
      <input type="file" id="pcPdfBestand" accept="application/pdf,.pdf" hidden>
      <div class="rij"><button class="knop fluo" data-pc="pdfkies" ${r?.bezig ? 'disabled' : ''}>Kies een PDF</button>
        ${st.bestand && !r?.bezig ? `<button class="knop licht" data-pc="pdfopnieuw">Opnieuw met ${esc(st.bestand.name)}</button>` : ''}</div>
      ${proef}</section>`;
}
function pdfVeld(el){
  const clubId = P.lade?.clubId; if (!clubId) return;
  const c = P.docs[clubId], st = pdfStaat(c), v = el.dataset.pdfveld;
  if (el.type === 'checkbox') st.concept[v] = el.checked;
  else if (el.type === 'radio'){ if (el.checked) st.concept[v] = el.value; }
  else st.concept[v] = v === 'overslaanWoorden' ? el.value.split(',').map(x => x.trim()).filter(Boolean) : el.value;
  const k = P.el.querySelector('[data-pc="pdfbewaar"]');
  if (k){ const gew = pdfGewijzigd(st, c); k.disabled = !gew; k.textContent = gew ? 'Bewaren' : 'Bewaard'; }
}
async function pdfBewaar(b){
  const clubId = P.lade.clubId, c = P.docs[clubId], st = pdfStaat(c), schoon = schoonProfiel(st.concept);
  b.disabled = true;
  try {
    await zetModule(clubId, 'pdfProfiel', schoon);
    st.concept = schoon; meld('PDF-profiel bewaard voor ' + (c.naam || 'deze club'));
  } catch (x){ meld('Bewaren mislukt: ' + (x.message || x.code)); }
  teken();
}
async function pdfProef(file){
  const clubId = P.lade?.clubId; if (!clubId || !file) return;
  const st = pdfStaat(P.docs[clubId]), profiel = schoonProfiel(st.concept);
  st.bestand = file;
  const stap = t => { st.proef = { bezig: true, naam: file.name, stap: t }; if (P.lade?.clubId === clubId) teken(); };
  stap('PDF inlezen…');
  try {
    const ai = await import('./training-ai.js?v=20261128k');
    const tw = await import('./training-weergave.js?v=20261128k');
    const { paginas, diagramBlobs, aantalPaginas, overgeslagen } = await ai.leesPdf(file, profiel);
    if (!paginas.some(x => x.tekst.trim())) throw new Error('geen leesbare tekst (een scan?)');
    stap('Omzetten met de AI…');
    const ruw = {}; for (const d of diagramBlobs) if (d.blob) ruw[d.volgnr] = URL.createObjectURL(d.blob);
    const { oefeningen } = await ai.structureer(paginas, 'standaard', { proef: true, profiel, clubId });
    const urls = ai.koppelDiagrammen(ruw, oefeningen, profiel);
    const score = ai.berekenScore(paginas.map(x => x.tekst).join(' '), oefeningen);
    st.proef = { naam: file.name, aantalPaginas, overgeslagen: overgeslagen || 0, plaatjes: diagramBlobs.length, aantal: oefeningen.length,
      score, goed: ai.scoreGoed(score), html: oefeningen.map((o, i) => tw.oefHtml(i + 1, o, urls)).join('') };
  } catch (x){
    st.proef = { fout: x.code === 'functions/permission-denied' ? 'alleen de platformbeheerder kan proberen'
      : x.code === 'functions/not-found' ? 'de functie structureerTraining is nog niet opnieuw gedeployed'
      : (x.message || x.code || 'onbekende fout') };
  }
  if (P.lade?.clubId === clubId) teken();
}

function ladeTeams(k){
  const t = P.teams[k.id];
  if (t === undefined){ laadTeams(k.id); return '<p class="tc-leeg-klein">Teams laden…</p>'; }
  if (t === null) return '<p class="tc-leeg-klein">Teams lezen mislukt. Zijn de nieuwste firestore.rules gedeployed?</p>';
  if (!t.length) return `<p class="tc-leeg-klein">Deze club heeft nog geen teams.</p>`;
  return `<p class="tc-meta">${t.length} team${t.length === 1 ? '' : 's'}. Namen van spelers zie je hier niet; daarvoor gebruik je Meehelpen.</p>
    ${t.map(x => `<div class="pc-taak"><div class="pc-taak-tekst"><b>${esc(x.naam || 'Team')}</b><small>${esc([telKeys(x.leden) + ' coach' + (telKeys(x.leden) === 1 ? '' : 'es'), x.format ? x.format + ' tegen ' + x.format : ''].filter(Boolean).join(' · '))}</small></div>${x.bouw ? chip(String(x.bouw)) : ''}</div>`).join('')}`;
}
async function laadTeams(clubId){
  P.teams[clubId] = 'bezig';
  try {
    const s = await getDocs(query(collection(db, 'teams'), where('club', '==', clubId)));
    P.teams[clubId] = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl', { numeric: true }));
  } catch (e){ console.warn('[platform] teams lezen', e.code); P.teams[clubId] = null; }
  if (P.lade?.clubId === clubId && ['teams', 'mensen', 'overzicht'].includes(P.lade.tab)) teken();
}
function ladeMeehelpen(k, c){
  const uit = c.instellingen?.toegang?.ondersteuning === false;
  const log = P.log[k.id];
  if (log === undefined) laadLog(k.id);
  const rijen = Array.isArray(log) ? log.slice(0, 5).map(l => `<li>${esc(l.tijd ? datum(l.tijd) : '')} · ${l.gebeurtenis === 'ondersteuning_start' ? 'gestart' : 'gestopt'}${l.details ? ' · ' + esc(l.details) : ''}</li>`).join('') : '';
  return `<div class="pc-signaal ${uit ? 'rood' : 'info'}"><b>Meehelpen als beheerder</b><br>${uit
      ? `${esc(k.naam)} heeft ondersteuning door Cluppie uitgezet. Vraag de clubbeheerder om het aan te zetten (Clubinstellingen › Toegang).`
      : `Je werkt maximaal 2 uur als clubbeheerder in ${esc(k.naam)}. Start en stop komen in het toegangslog van de club; de clubbeheerder ziet dat.`}</div>
    <button class="knop fluo vol" data-pc="meehelpen" ${uit ? 'disabled' : ''}>Open ${esc(k.naam)} als beheerder</button>
    <div class="pc-taak"><div class="pc-taak-tekst"><b>Laatste keren</b>${log === 'bezig' || log === undefined ? '<small>Laden…</small>' : rijen ? `<ul class="pc-log">${rijen}</ul>` : '<small>Nog nooit meegeholpen in deze club.</small>'}</div></div>`;
}
async function laadLog(clubId){
  P.log[clubId] = 'bezig';
  try {
    const s = await getDocs(query(collection(db, 'toegangslog'), where('clubId', '==', clubId)));
    P.log[clubId] = s.docs.map(d => d.data()).filter(l => /^ondersteuning_/.test(l.gebeurtenis || ''))
      .sort((a, b) => (b.tijd?.seconds || 0) - (a.tijd?.seconds || 0));
  } catch (e){ P.log[clubId] = []; }
  if (P.lade?.clubId === clubId && P.lade.tab === 'meehelpen') teken();
}

/* ---------- tekenen ---------- */
function teken(){
  if (!P.el) return;
  const naam = (S.user?.displayName || (S.user?.email || '').split('@')[0] || 'Eindbaas').split(' ')[0];
  const telling = { overzicht: P.o ? taken().length : 0, trainers: P.o?.totalen?.individueelNieuw || 0 };
  let inhoud;
  if (P.laden && !P.o) inhoud = '<div class="tc-leeg">Cijfers laden…</div>';
  else if (P.fout) inhoud = `<div class="kaart leeg">${esc(P.fout)}</div>`;
  else inhoud = (P.lade && htmlLadeVeilig()) || ({ overzicht: htmlOverzicht, uitrol: htmlUitrol, clubs: htmlClubs, maatwerk: () => MW.htmlMaatwerk(kop), trainers: htmlTrainers, instellingen: htmlInstellingen, bibliotheek: () => '<div id="pbRoot"></div>', mails: () => '<div id="pmRoot"></div>' })[P.scherm]();
  const link = ([id, n, ic]) => `<button class="tc-link ${P.scherm === id ? 'actief' : ''}" data-pc="scherm" data-scherm="${id}">${ico(ic, 20)}<span>${n}</span>${telling[id] ? `<span class="pc-tel">${telling[id]}</span>` : ''}</button>`;
  const merk = `<img src="${CLUPPIE_LOGO}" alt=""><span><b class="cond">Platform</b><small>Cluppie · eindbaas</small></span>`;
  const sy = P.el.querySelector('.tc-hoofd')?.scrollTop || 0;
  const fokus = document.activeElement?.id === 'pcZoek' ? document.activeElement.selectionStart : null;
  P.el.innerHTML = `<div class="tc-schil">
      <aside class="tc-zij">
        <div class="tc-merk">${merk}</div>
        <nav class="tc-nav" aria-label="Platformmenu">${MENU.map(link).join('')}</nav>
        <button class="tc-link tc-terugapp" data-pc="naarapp">${ico('navigation-back', 20)}<span>Terug naar de app</span></button>
        <div class="tc-ik"><span class="tc-avatar">${esc(naam.charAt(0).toUpperCase())}</span><span><b>${esc(naam)}</b><small>${P.o && !P.o.terugval ? bijgewerkt() : 'Eindbaas'}</small></span>
          <button class="tc-uit" data-pc="vernieuw" title="Cijfers vernieuwen" aria-label="Cijfers vernieuwen">${ico('action-loading', 20)}</button></div>
      </aside>
      <main class="tc-hoofd">
        <header class="tc-balk"><button class="tc-uit" data-pc="naarapp" title="Terug naar de app" aria-label="Terug naar de app">${ico('navigation-back', 22)}</button>${merk}
          <button class="tc-uit" data-pc="vernieuw" title="Cijfers vernieuwen" aria-label="Cijfers vernieuwen">${ico('action-loading', 20)}</button></header>
        <div class="tc-inhoud-wrap pc-wrap">${inhoud}</div>
      </main>
    </div>
    <nav class="tc-onder" aria-label="Platformmenu">${MENU.map(([id, n, ic]) => `<button class="${P.scherm === id ? 'actief' : ''}" data-pc="scherm" data-scherm="${id}">${ico(ic, 22)}<span>${n}</span>${telling[id] ? `<i class="pc-tel-stip"></i>` : ''}</button>`).join('')}</nav>`;
  /* de club en de lijst erachter hebben elk hun eigen scrollstand */
  const ladeNu = P.lade ? P.lade.clubId : '';
  if (ladeNu && !P._ladeOpen) P._lijstScroll = sy;
  const h = P.el.querySelector('.tc-hoofd'); if (h) h.scrollTop = ladeNu ? (P._ladeOpen === ladeNu ? sy : 0) : (P._ladeOpen ? (P._lijstScroll || 0) : sy);
  P._ladeOpen = ladeNu;
  if (fokus != null){ const z = document.getElementById('pcZoek'); if (z){ z.focus(); try { z.setSelectionRange(fokus, fokus); } catch (e) {} } }
  if (P.lade && P._fokusLade){ P._fokusLade = false; P.el.querySelector('.pc-lade [aria-selected="true"]')?.focus({ preventScroll: true }); }
  const pb = P.el.querySelector('#pbRoot');
  if (pb) import('./platform-bibliotheek.js?v=20261128k').then(m => m.toonBibliotheek(pb)).catch(e => { pb.innerHTML = '<div class="kaart leeg">Bibliotheek laden mislukt.</div>'; console.error(e); });
  P.el.querySelector('.tc-onder .actief')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });   /* [20261116p] onderbalk schuift bij zeven onderdelen */
  const cp = P.el.querySelector('#cpRoot');
  if (cp && P.lade) import('./platform-clubprofiel.js?v=20261128k').then(m => m.toonClubprofiel(cp, P.docs[P.lade?.clubId] || {})).catch(e => { cp.innerHTML = '<div class="kaart leeg">Clubprofiel laden mislukt.</div>'; console.error(e); });
  const pm = P.el.querySelector('#pmRoot');
  if (pm) import('./platform-mails.js?v=20261128k').then(m => m.toonMails(pm)).catch(e => { pm.innerHTML = '<div class="kaart leeg">Mails laden mislukt.</div>'; console.error(e); });
  bewaakTerug();
}

/* ---------- acties ---------- */
async function klik(e){
  const b = e.target.closest('[data-pc]');
  if (!b || !P.el.contains(b) || b.disabled) return;
  const a = b.dataset.pc;
  if (a === 'scherm') return zetScherm(b.dataset.scherm);
  if (a === 'mwclub') return openLade(b.dataset.id, 'onderdelen');
  if (MW.klik(a, b)) return;
  if (a === 'naarapp') return sluitCentrum();
  if (a === 'club') return openLade(b.dataset.id);
  if (a === 'hernoem') return hernoem(b);
  if (a === 'sport') return zetSport(b);
  if (a === 'sluitlade'){ P.lade = null; return teken(); }
  if (a === 'ladetab'){ P.lade.tab = b.dataset.tab; P._fokusLade = true; return teken(); }
  if (a === 'filter'){ P.filter = b.dataset.filter; return teken(); }
  if (a === 'fase'){ P.faseFilter = b.dataset.fase; P.filter = 'alle'; return zetScherm('clubs'); }
  if (a === 'fasewis'){ P.faseFilter = null; return teken(); }
  if (a === 'alletaken'){ P.alleTaken = !P.alleTaken; return teken(); }
  if (a === 'alletrainers'){ P.alleTrainers = !P.alleTrainers; return teken(); }
  if (a === 'nieuweclub') return import('./club.js?v=20261128k').then(m => m.modalNieuwClub());
  if (a === 'kalenders') return import('./platform.js?v=20261128k').then(m => m.openKalenders());
  if (a === 'kopieer') return kopieer(b.dataset.tekst);
  if (a === 'vernieuw') return vernieuw(b);
  if (a === 'goedkeuren' || a === 'afwijzen') return beoordeel(b, a === 'goedkeuren');
  if (a === 'schakel') return schakel(b);
  if (a === 'pdfbewaar') return pdfBewaar(b);
  if (a === 'pdfstandaard'){ pdfStaat(P.docs[P.lade.clubId]).concept = schoonProfiel(null); return teken(); }
  if (a === 'pdfkies') return P.el.querySelector('#pcPdfBestand')?.click();
  if (a === 'pdfopnieuw') return pdfProef(pdfStaat(P.docs[P.lade.clubId]).bestand);
  if (a === 'meehelpen') return meehelpen(b);
  if (a === 'koppel') return koppel(b);
  if (a === 'tkoptie') return schakelTk(b);
  if (a === 'tkoptiealles') return schakelTk(b, b.dataset.aan === '1');
  if (a === 'tklosoptie') return bewaarPlatform({ teamkamerLosOpties: { ...(P.platform?.teamkamerLosOpties || {}), [b.dataset.sl]: b.getAttribute('aria-checked') !== 'true' } }, b).then(teken);
  if (a === 'tklosoptiealles') return bewaarPlatform({ teamkamerLosOpties: Object.fromEntries(TK_OPTIES.map(([k]) => [k, b.dataset.aan === '1'])) }, b).then(teken);
  if (a === 'teamkamerlos') return bewaarPlatform({ teamkamerLos: b.getAttribute('aria-checked') !== 'true' }, b);
  if (a === 'soloai') return bewaarPlatform({ soloAI: { ...soloNu(), aan: b.getAttribute('aria-checked') !== 'true' } }, b);
  if (a === 'standaard') return bewaarPlatform({ standaard: { ...modulesVoorNieuweClub(P.platform?.standaard), [b.dataset.sl]: b.getAttribute('aria-checked') !== 'true' } }, b);
}
function invoer(e){
  if (MW.invoer(e)) return;
  if (e.target.dataset?.pdfveld) return pdfVeld(e.target);
  if (e.target.id === 'pcZoek'){ P.zoek = e.target.value; teken(); }
}
async function wijzig(e){
  /* [20261111b] platforminstellingen (Trainers, Instellingen) */
  if (MW.wijzig(e)) return;
  const id = e.target.id, val = e.target.value.trim();
  if (e.target.dataset?.pdfveld) return pdfVeld(e.target);
  if (id === 'pcPdfBestand'){ const f = e.target.files?.[0]; e.target.value = ''; return pdfProef(f); }
  if (id === 'pcSoloLimiet') return bewaarPlatform({ soloAI: { ...soloNu(), limiet: val } }, e.target);
  if (id === 'pcSoloChat') return bewaarPlatform({ soloAI: { ...soloNu(), chatLimiet: val } }, e.target);
  if (id === 'pcStAiLimiet' || id === 'pcStVideo')
    return bewaarPlatform({ standaard: { ...modulesVoorNieuweClub(P.platform?.standaard), [id === 'pcStVideo' ? 'maxVideoMB' : 'aiLimiet']: val === '' ? null : val } }, e.target);
  if (id === 'pcProef' || id === 'pcSlapend')
    return bewaarPlatform({ uitrol: { ...uitrol(), [id === 'pcProef' ? 'proefDagen' : 'slapendDagen']: val } }, e.target);
  const inp = e.target.closest('[data-pcnum]'); if (!inp || !P.lade) return;
  const sl = inp.dataset.pcnum, raw = inp.value.trim(), clubId = P.lade.clubId;
  let w;
  if (sl === 'aiLimiet'){ w = raw === '' ? null : Math.round(Number(raw)); if (w !== null && !(w >= 0 && w <= 100000)) return meld('Vul een aantal tussen 0 en 100.000 in, of laat het leeg'); }
  else if (sl === 'pdfLimiet'){ w = raw === '' ? null : Math.round(Number(raw)); if (w !== null && !(w >= 0 && w <= 10000)) return meld('Vul een aantal tussen 0 en 10.000 in, of laat het leeg'); }
  else { w = Math.round(Number(raw)); if (!(w >= 5 && w <= 300)) return meld('Kies een videogrootte tussen 5 en 300 MB'); }
  inp.disabled = true;
  try { await zetModule(clubId, sl, w); meld(sl === 'aiLimiet' ? 'AI-limiet opgeslagen' : sl === 'pdfLimiet' ? 'PDF-limiet opgeslagen' : 'Videogrootte opgeslagen'); }
  catch (x){ meld('Opslaan mislukt: ' + (x.code === 'permission-denied' ? 'rules nog niet gedeployed?' : (x.message || x.code))); }
  inp.disabled = false;
}
/* [20261120g] naam en plaats van een club, via de functie hernoemClubPlatform (die ook de kopieën bij teams bijwerkt) */
async function hernoem(b){
  const clubId = P.lade?.clubId, c = P.docs[clubId], k = P.clubs.find(x => x.id === clubId);
  if (!c) return;
  const naam = P.el.querySelector('#pcClubNaam')?.value.replace(/\s+/g, ' ').trim() || '', plaats = P.el.querySelector('#pcClubPlaats')?.value.replace(/\s+/g, ' ').trim() || '';
  if (naam.length < 2) return meld('Vul een clubnaam in');
  if (naam === (c.naam || '') && plaats === (c.instellingen?.locatie?.plaats || '')) return meld('Er is niets veranderd');
  b.disabled = true; b.textContent = 'Opslaan…';
  try {
    await httpsCallable(functions, 'hernoemClubPlatform')({ clubId, naam, plaats });
    c.naam = naam; c.instellingen = { ...(c.instellingen || {}), locatie: { ...(c.instellingen?.locatie || {}), plaats } };
    if (k){ k.naam = naam; k.plaats = plaats; }
    meld('Naam en plaats opgeslagen');
  } catch (x){ meld(x.code === 'functions/not-found' && /function/i.test(x.message || '') ? 'Functie hernoemClubPlatform is nog niet gedeployed' : 'Opslaan mislukt: ' + (x.message || x.code)); }
  teken();
}
/* [20261125x] sportprofiel: de sport van een club zet alleen de eindbaas (rules: geldigeSport) */
async function zetSport(b){
  const clubId = P.lade?.clubId, c = P.docs[clubId];
  if (!c) return;
  const nieuw = P.el.querySelector('#pcClubSport')?.value || '', oud = sportVan(c);
  if (!SPORTEN[nieuw] || nieuw === oud) return meld('Er is niets veranderd');
  if (!confirm(`${c.naam || 'Deze club'} van ${sportNaam(oud)} naar ${sportNaam(nieuw)}?\n\nVoor alle teams veranderen de categorieën, het veld, de opstellingen, de wedstrijdregels en de oefenstof. Bestaande wedstrijden en beoordelingen blijven staan.`)) return;
  b.disabled = true;
  try {
    await setDoc(doc(db, 'clubs', clubId), { sport: nieuw }, { merge: true });
    c.sport = nieuw;
    meld(`Sport gezet op ${sportNaam(nieuw)}`);
  } catch (x){ meld('Opslaan mislukt: ' + (x.message || x.code)); }
  teken();
}
async function zetModule(clubId, sleutel, waarde){
  await setDoc(doc(db, 'clubs', clubId), { platformModules: { [sleutel]: waarde } }, { merge: true });
  const c = P.docs[clubId]; c.platformModules = { ...(c.platformModules || {}), [sleutel]: waarde };
  const k = P.clubs.find(x => x.id === clubId);
  if (k && sleutel === 'ai') k.ai = { ...(k.ai || {}), aan: waarde };
  if (k && sleutel === 'aiLimiet') k.ai = { ...(k.ai || {}), limiet: waarde || 0 };
}
/* één mogelijkheid van de teamkamer voor deze club (of alles tegelijk met alles = true/false) */
async function schakelTk(b, alles){
  const clubId = P.lade.clubId, c = P.docs[clubId], nu = { ...(c.platformModules?.teamkamerOpties || {}) };
  const nieuw = alles === undefined ? { ...nu, [b.dataset.sl]: nu[b.dataset.sl] !== true } : Object.fromEntries(TK_OPTIES.map(([k]) => [k, alles]));
  b.disabled = true;
  try {
    await setDoc(doc(db, 'clubs', clubId), { platformModules: { teamkamerOpties: nieuw } }, { merge: true });
    c.platformModules = { ...(c.platformModules || {}), teamkamerOpties: nieuw };
    meld(alles === undefined ? `${b.getAttribute('aria-label')} ${nieuw[b.dataset.sl] ? 'aan' : 'uit'} voor ${c.naam || 'deze club'}` : `Teamkamer: alles ${alles ? 'aan' : 'uit'} voor ${c.naam || 'deze club'}`);
    teken();
  } catch (x){ b.disabled = false; meld('Opslaan mislukt: ' + (x.code === 'permission-denied' ? 'rules nog niet gedeployed?' : (x.message || x.code))); }
}
async function schakel(b){
  const clubId = P.lade.clubId, sl = b.dataset.sl, c = P.docs[clubId];
  const nu = BEHEERD.includes(sl) ? platformToegestaan(c, sl) : c.platformModules?.[sl] === true;
  b.disabled = true;
  try {
    await zetModule(clubId, sl, !nu);
    meld(`${b.getAttribute('aria-label')} ${!nu ? 'aan' : 'uit'} voor ${c.naam || 'deze club'}`);
    teken();
  } catch (x){ b.disabled = false; meld('Opslaan mislukt: ' + (x.code === 'permission-denied' ? 'rules nog niet gedeployed?' : (x.message || x.code))); }
}
async function beoordeel(b, goed){
  const id = b.dataset.id;
  /* [20261116p] "Eerst laten zien" (Platform › Mails): de mail voor deze ene club bekijken en aanpassen.
     Staat dat uit, of zijn de functies er nog niet, dan gaat het zoals voorheen (afwijzen met een tweede tik). */
  b.disabled = true;
  let keuze = { direct: true };
  try { keuze = await (await import('./platform-mails.js?v=20261128k')).vraagMailBij(goed ? 'welkomClub' : 'afwijzing', P.aanmeldingen.find(a => a.id === id) || {}); }
  catch (x){ console.warn('[platform] mail vooraf tonen mislukt', x); }
  if (keuze === null){ b.disabled = false; return; }
  if (keuze.direct && !goed && P.bevestig !== id){ P.bevestig = id; return teken(); }
  try {
    await httpsCallable(functions, 'beoordeelClubAanmelding')({ id, besluit: goed ? 'goedkeuren' : 'afwijzen',
      ...(keuze.mail ? { mail: keuze.mail } : {}), ...(keuze.zonderMail ? { zonderMail: true } : {}), ...(keuze.reden ? { reden: keuze.reden } : {}) });
    meld(goed ? 'Club aangemaakt; de aanvrager is clubbeheerder ✓' : 'Aanmelding afgewezen');
    P.aanmeldingen = P.aanmeldingen.filter(a => a.id !== id); P.bevestig = null;
    if (goed) await laad(); else teken();
  } catch (x){ b.disabled = false; meld('Mislukt: ' + (x.message || x.code)); }
}
async function vernieuw(b){
  b.disabled = true; b.classList.add('pc-draait');
  try { await httpsCallable(functions, 'platformOverzichtNu')({}); meld('Cijfers bijgewerkt'); P.teams = {}; P.log = {}; MW.wisCache(); await laad(); }
  catch (x){ meld('Vernieuwen mislukt: ' + (x.code === 'functions/not-found' ? 'functie nog niet gedeployed' : (x.message || x.code))); }
  if (b.isConnected){ b.disabled = false; b.classList.remove('pc-draait'); }
}
async function meehelpen(b){
  const id = P.lade.clubId;
  b.disabled = true;
  const ond = await import('./ondersteuning.js?v=20261128k').catch(() => null);
  if (!ond || !(await ond.startOndersteuning(id))){ b.disabled = false; return; }
  sluitCentrum();
  import('./club.js?v=20261128k').then(m => m.openClub(id)).catch(() => meld('Club openen mislukt'));
}
const soloNu = () => ({ aan: false, limiet: 20, chatLimiet: 30, ...(P.platform?.soloAI || {}) });
/* platform/instellingen schrijven kan alleen via de functie zetPlatformInstellingen (valideert ook) */
async function bewaarPlatform(deel, el){
  if (el) el.disabled = true;
  try {
    const r = await httpsCallable(functions, 'zetPlatformInstellingen')(deel);
    const d = r?.data;
    P.platform = { ...(P.platform || {}), ...(d && typeof d === 'object' && Object.keys(d).length ? d : deel) };
    if (deel.uitrol) verrijk();
    meld('Opgeslagen');
  } catch (x){
    meld(x.code === 'functions/not-found' ? 'Functie zetPlatformInstellingen is nog niet gedeployed' : 'Opslaan mislukt: ' + (x.message || x.code));
  }
  teken();
}
async function koppel(b){
  const teamId = b.dataset.team, clubId = b.dataset.club;
  if (P.bevestig !== 'k:' + teamId){ P.bevestig = 'k:' + teamId; return teken(); }
  b.disabled = true;
  try {
    const r = await httpsCallable(functions, 'stelKoppelingVoor')({ teamId, clubId });
    meld(`Voorstel staat klaar; de trainer ziet het in de app${r?.data?.clubNaam ? ' (' + r.data.clubNaam + ')' : ''}`);
    const t = P.trainers.find(x => x.teamId === teamId); if (t) t.koppel = 'open';
    P.bevestig = null; teken();
  } catch (x){ b.disabled = false; meld(x.code === 'functions/not-found' && /function/i.test(x.message || '') ? 'Functie stelKoppelingVoor is nog niet gedeployed' : 'Mislukt: ' + (x.message || x.code)); }
}
async function kopieer(tekst){
  try { await navigator.clipboard.writeText(tekst); meld('Gekopieerd'); }
  catch (e){ meld(tekst); }
}

/* platform/instellingen (beheerders) voor het scherm Instellingen; alleen-lezen */
async function leesPlatformInstellingen(){
  try { const s = await getDoc(doc(db, 'platform', 'instellingen')); return s.exists() ? s.data() : {}; }
  catch (e){ return {}; }
}
