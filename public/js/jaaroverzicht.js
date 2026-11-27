/* ==================== JAAROVERZICHT (scherm) [20261122a] ====================
   Stats › Jaaroverzicht: één blad met het seizoen van het team, of van één speler, om aan de club te
   laten zien. De cijfers komen uit wat al in de state staat (wedstrijden, aanwezigheid, beoordelingen,
   teamevaluaties) en uit de bestaande rekenregels; er wordt niets gelezen of geschreven.
   Rekenregels en teksten: jaaroverzicht-logica.js (getest).

   Delen: "Afdrukken of pdf" zet alleen het blad op papier (zelfde aanpak als de pdf-viewer: een eigen
   afdrukvel, de rest van de app verborgen). "Deel samenvatting" is er alleen voor het team: een korte
   tekst zonder namen van spelers. Een speler deel je alleen als afdruk, binnen de club. */
import { S, esc, meld, openModal } from './state.js?v=20261130g';
import { SEIZOEN_FALLBACK } from './config.js?v=20261130g';
import { analyseWedstrijd, speeltijdReserve } from './analyse.js?v=20261130g';
import { opkomstVoor } from './opkomst.js?v=20260922c';
import { teamOverzicht, teamRegels, deelTekstTeam, spelerOverzicht, spelerRegels } from './jaaroverzicht-logica.js?v=20261122a';

const J = { soort: 'team', spelerId: '' };
const voornaam = p => String((p && p.naam) || '').trim().split(/\s+/)[0] || 'Speler';
const seizoenNu = () => (S.statsSeizoen && S.statsSeizoen !== 'alles') ? S.statsSeizoen : (S.huidigSeizoen || S.club?.huidigSeizoen || SEIZOEN_FALLBACK);
const vanSeizoen = (lijst, seizoen) => (lijst || []).filter(d => d && d.seizoen === seizoen);
const spelersNu = () => (S.spelers || []).filter(p => p && !p.gearchiveerd && !p.ingeleend);
const stand = w => ({ voor: (w.goals || []).filter(g => g.type === 'voor').length, tegen: (w.goals || []).filter(g => g.type === 'tegen').length });
const gespeeld = w => { try { return (w.goals || []).length > 0 || analyseWedstrijd(w).kwarten > 0; } catch (e){ return false; } };
/* beoordeling → één getal op de schaal 1 tot 5 (zelfde regel als het lijntje in Stats) */
function niveauVan(b){
  if (b.soort === 'snel' && b.niveau) return Number(b.niveau);
  if (b.soort === 'volledig'){
    const sc = Object.values(b.scores || {}).filter(n => Number(n) > 0).map(Number);
    if (sc.length) return sc.reduce((a, n) => a + n, 0) / sc.length;
  }
  return null;
}

function maakTeam(){
  const seizoen = seizoenNu(), spelers = spelersNu();
  const wedstrijden = vanSeizoen(S.wedstrijden, seizoen).filter(gespeeld);
  const presentie = vanSeizoen(S.presentie, seizoen);
  const sr = speeltijdReserve(wedstrijden);
  const beoordelingen = vanSeizoen(S.beoordelingen, seizoen).filter(b => !b.prive);
  return teamOverzicht({
    teamNaam: S.team?.naam || '', clubNaam: S.team?.clubNaam || S.team?.eigenClub?.naam || '', seizoen,
    wedstrijden: wedstrijden.map(stand), trainingen: presentie.length,
    opkomstPcts: spelers.map(p => opkomstVoor(p, presentie).pct).filter(v => v !== null),
    speeltijdPcts: spelers.map(p => sr[p.id]).filter(r => r && r.speelbaar > 0).map(r => (r.speeltijd / r.speelbaar) * 100),
    spelers: spelers.length, teamevaluaties: vanSeizoen(S.teamEvaluaties, seizoen).length,
    beoordelingen: beoordelingen.length, beoordeeldeSpelers: new Set(beoordelingen.map(b => b.spelerId)).size,
  });
}
function maakSpeler(pid){
  const p = spelersNu().find(x => x.id === pid); if (!p) return null;
  const seizoen = seizoenNu();
  const wedstrijden = vanSeizoen(S.wedstrijden, seizoen).filter(gespeeld);
  let aantal = 0, sec = 0, keeper = 0, goals = 0, assists = 0;
  for (const w of wedstrijden){
    for (const g of (w.goals || [])){ if (g.type !== 'voor') continue; if (g.pid === pid) goals++; if (g.assist === pid) assists++; }
    const a = analyseWedstrijd(w);
    if (a.tijd && a.tijd[pid]){ sec += a.tijd[pid]; aantal++; }
    if (a.keeper && a.keeper[pid]) keeper += a.keeper[pid];
  }
  const r = speeltijdReserve(wedstrijden)[pid];
  /* S.beoordelingen staat nieuwste eerst; de reeks loopt van oud naar nieuw */
  const reeks = vanSeizoen(S.beoordelingen, seizoen).filter(b => b.spelerId === pid && !b.prive).map(niveauVan).filter(v => v > 0).reverse();
  return spelerOverzicht({
    naam: voornaam(p), teamNaam: S.team?.naam || '', seizoen, wedstrijden: aantal, minuten: sec / 60,
    pctSpeeltijd: r && r.speelbaar > 0 ? (r.speeltijd / r.speelbaar) * 100 : null,
    opkomst: opkomstVoor(p, vanSeizoen(S.presentie, seizoen)), goals, assists, keeper, reeks,
  });
}

const MND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const vandaagTekst = () => { const d = new Date(); return `${d.getDate()} ${MND[d.getMonth()]} ${d.getFullYear()}`; };

function htmlVel(o){
  if (!o) return '<p class="meta">Kies een speler.</p>';
  const regels = o.soort === 'team' ? teamRegels(o) : spelerRegels(o);
  const titel = o.soort === 'team' ? o.teamNaam : `${o.naam}, ${o.teamNaam}`;
  return `<div class="jo-vel">
    <div class="jo-kop"><span>Jaaroverzicht</span><span>Seizoen ${esc(o.seizoen)}</span></div>
    <h3 class="jo-titel">${esc(titel)}</h3>
    ${o.soort === 'team' && o.clubNaam ? `<p class="jo-club">${esc(o.clubNaam)}</p>` : ''}
    ${o.leeg ? '<p class="meta">Er is dit seizoen nog niets vastgelegd. Het overzicht vult zich met wedstrijden, aanwezigheid en evaluaties.</p>' : ''}
    <dl class="jo-lijst">${regels.map(r => `<div><dt>${esc(r.label)}</dt><dd><b>${esc(r.waarde)}</b>${r.toelichting ? `<small>${esc(r.toelichting)}</small>` : ''}</dd></div>`).join('')}</dl>
    <p class="jo-voet">${o.soort === 'team' ? 'Zonder namen van spelers. ' : 'Alleen cijfers: geen notities of leerpunten. '}Gemaakt met Cluppie op ${esc(vandaagTekst())}.</p>
  </div>`;
}
function overzichtNu(){ return J.soort === 'team' ? maakTeam() : maakSpeler(J.spelerId); }

function html(){
  const spelers = spelersNu().slice().sort((a, b) => voornaam(a).localeCompare(voornaam(b), 'nl'));
  const o = overzichtNu();
  return `<div id="joRoot">
    <p class="meta" style="margin:-4px 0 12px">Het seizoen in cijfers, om aan je club te laten zien. Je kiest het seizoen met het filter boven Stats.</p>
    <div class="segment" id="joSoort"><button data-s="team" class="${J.soort === 'team' ? 'actief' : ''}">Team</button><button data-s="speler" class="${J.soort === 'speler' ? 'actief' : ''}">Speler</button></div>
    ${J.soort === 'speler' ? `<div class="veldgroep" style="margin-top:10px"><label for="joSpeler">Speler</label>
      <select class="invoer" id="joSpeler"><option value="">Kies een speler</option>${spelers.map(p => `<option value="${esc(p.id)}" ${p.id === J.spelerId ? 'selected' : ''}>${esc(voornaam(p))}</option>`).join('')}</select></div>` : ''}
    ${htmlVel(o)}
    ${o ? `<div class="rij" style="margin-top:12px"><button class="knop vol" id="joPrint">Afdrukken of pdf</button>${J.soort === 'team' ? '<button class="knop licht" id="joDeel">Deel samenvatting</button>' : ''}</div>` : ''}
    ${J.soort === 'speler' ? '<p class="meta" style="margin:10px 0 0">Deel het overzicht van een speler alleen binnen de club, niet met andere ouders.</p>' : ''}
  </div>`;
}
function herteken(){ const el = document.getElementById('joRoot'); if (el){ el.outerHTML = html(); koppel(); } }
function koppel(){
  document.querySelectorAll('#joSoort button').forEach(b => b.onclick = () => { J.soort = b.dataset.s; herteken(); });
  const sel = document.getElementById('joSpeler'); if (sel) sel.onchange = () => { J.spelerId = sel.value; herteken(); };
  const pr = document.getElementById('joPrint'); if (pr) pr.onclick = () => druk(overzichtNu());
  const dl = document.getElementById('joDeel'); if (dl) dl.onclick = () => deel(maakTeam());
}

/* Alleen het blad afdrukken: een eigen vel direct onder <body>, de rest verborgen (styles.css, blok jaaroverzicht). */
function ruimOp(){
  document.querySelectorAll('.jo-print-vel').forEach(v => v.remove());
  document.documentElement.classList.remove('jo-printen');
}
function druk(o){
  if (!o) return;
  ruimOp();
  const vel = document.createElement('div');
  vel.className = 'jo-print-vel';
  vel.innerHTML = htmlVel(o);
  document.body.appendChild(vel);
  document.documentElement.classList.add('jo-printen');
  window.addEventListener('afterprint', ruimOp, { once: true });
  import('./tracker.js?v=20261130g').then(m => m.telGebruik('jaaroverzicht_' + o.soort)).catch(() => {});
  try { window.print(); } catch (e){ ruimOp(); meld('Afdrukken lukt niet op dit apparaat'); }
}
async function deel(o){
  const tekst = deelTekstTeam(o);
  import('./tracker.js?v=20261130g').then(m => m.telGebruik('jaaroverzicht_deel')).catch(() => {});
  if (navigator.share){
    try { await navigator.share({ text: tekst }); return; }
    catch (e){ if (e && e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(tekst), '_blank', 'noopener');
}

export function openJaaroverzicht(){
  if (!S.team) return;
  J.soort = 'team'; J.spelerId = '';
  openModal('<h2>Jaaroverzicht</h2>' + html());   /* de kop staat buiten joRoot: openModal zet hem in de balk van het venster */
  koppel();
}
