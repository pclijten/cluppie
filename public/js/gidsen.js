/* ==================== HELP: HANDLEIDINGEN PER ONDERDEEL [20261127] ====================
   Het scherm achter Alles › Help (en het Help-icoon linksonder op de laptop). Toont de handleidingen
   uit gidsen-data.js: een overzicht dat past bij je rol, en per handleiding de stappen met het echte
   schermbeeld (public/hulp/beeld/, gemaakt uit de demo door tools/gidsen-schermen.mjs).

   Bij elke handleiding: Open dit scherm, de video (zodra die op de vaste plek staat), de PDF en de
   hulpchat. De oude doorlopende handleiding blijft onderaan staan als naslag.

   State (bewust los op S, niet in state.js): S._gids = id van de open handleiding, S._gidsStap = stap om
   naartoe te scrollen, S._gidsFilter = 'mij' | 'alles' | een rol, S._gidsZoek = zoekterm. */
import { S, esc, modAan } from './state.js?v=20261130q';
import { ico } from './icons.js?v=20261127b';
import { GIDSEN, GIDS_ROLLEN, SCHERMEN, gidsMet, gidsVoor, zoekGidsen } from './gidsen-data.js?v=20261130c';
import { BEELDEN } from './gidsen-beelden.js?v=20261130c';
import { mijnRollen } from './rolkaart.js?v=20261130q';
import { onderdeelAan } from './onderdelen.js?v=20261130q';
import { teamkamerMag } from './kamer-logica.js?v=20261127k';
import { htmlHandleiding } from './teams-handleiding.js?v=20261130q';
import { telGebruik } from './tracker.js?v=20261130q';

/* versie van de beelden en PDF's: verandert bij elke release, zodat een nieuw beeld niet uit de cache komt */
const V = new URL(import.meta.url).searchParams.get('v') || '';
const metV = pad => V ? `${pad}?v=${V}` : pad;
export const beeldUrl = naam => metV(`hulp/beeld/${naam}.jpg`);
export const pdfUrl = g => metV(`hulp/pdf/cluppie-handleiding-${g.id}-${g.slug}.pdf`);
export const PDF_ALLES = () => metV('hulp/pdf/cluppie-handleiding-compleet.pdf');
/* De video's staan op één vaste plek in de opslag van Cluppie (storage.rules: /hulp/** is voor iedereen te lezen). */
const VIDEO_BASIS = 'https://firebasestorage.googleapis.com/v0/b/cluppie-ad329.firebasestorage.app/o/';
export const videoUrl = g => g.video ? `${VIDEO_BASIS}${encodeURIComponent('hulp/video/' + g.video + '.mp4')}?alt=media` : '';

/* ---------- wie kijkt er, en wat staat aan ---------- */
const isLos = () => !!(S.team && S.teamId && !S.team.club);
export function gidsRollen(){ return isLos() ? ['solo'] : mijnRollen(); }

/* Staat het onderdeel van deze handleiding aan? true als de handleiding geen onderdeel heeft. */
export function gidsOnderdeelAan(g){
  const o = g.onderdeel; if (!o) return true;
  const pm = (S._clubPlatform && S._clubPlatform.platformModules) || (S.club && S.club.platformModules) || {};
  try {
    if (o === 'trainingsmodule') return S.team ? onderdeelAan('trainingsmodule') : true;
    if (o === 'speelwijze') return modAan('speelwijze');
    if (o === 'evaluaties') return modAan('evaluaties');
    if (o === 'teamkamer') return S.team ? teamkamerMag(S.team, S._clubPlatform, S._teamkamerLos) : true;
    if (o === 'activiteiten' || o === 'veldplanner') return pm[o] === true;
  } catch (e){ /* bij twijfel tonen */ }
  return true;
}

/* **vet** naar <b>, de rest veilig */
function opmaak(tekst){
  return String(tekst || '').split(/(\*\*[^*]+\*\*)/g).map(d => { const m = d.match(/^\*\*([^*]+)\*\*$/); return m ? `<b>${esc(m[1])}</b>` : esc(d); }).join('');
}
const apparaatNaam = a => a === 'laptop' ? 'Laptop' : 'Telefoon';
const voorTekst = g => g.voor.map(v => GIDS_ROLLEN[v] || v).join(', ');

/* ---------- video: pas tonen als de bestanden er staan ---------- */
function videoKlaar(){
  if (S._gidsVideo === undefined){
    S._gidsVideo = null;   // bezig
    const eerste = GIDSEN.find(g => g.video);
    fetch(videoUrl(eerste).replace('?alt=media', ''), { method: 'GET' })
      .then(r => { S._gidsVideo = r.ok; if (r.ok) document.querySelectorAll('[data-gd-video]').forEach(b => { b.hidden = false; }); })
      .catch(() => { S._gidsVideo = false; });
  }
  return S._gidsVideo === true;
}

/* ---------- overzicht ---------- */
function kaart(g){
  const aan = gidsOnderdeelAan(g);
  const n = g.stappen.length;
  return `<button class="gd-kaart${aan ? '' : ' uit'}" data-gd-open="${g.id}">
    <span class="gd-kaart-nr">${g.id}</span>
    <span class="gd-kaart-t"><b>${esc(g.titel)}</b><small>${esc(aan ? g.kort : 'Staat niet aan bij jouw club')}</small></span>
    <span class="gd-kaart-r">${aan ? `${n} stappen` : 'uit'}<small>${apparaatNaam(g.apparaat)}</small></span>
  </button>`;
}

function htmlOverzicht(){
  const rollen = gidsRollen();
  const filter = S._gidsFilter || 'mij';
  const zoek = (S._gidsZoek || '').trim();
  const keuzes = [['mij', 'Voor jou'], ['coach', 'Trainer'], ['admin', 'Clubbeheer'], ['bouw', 'Coördinator'], ['alles', 'Alles']];
  let lijst;
  if (filter === 'alles') lijst = GIDSEN;
  else if (filter === 'mij') lijst = GIDSEN.filter(g => gidsVoor(g, rollen));
  else lijst = GIDSEN.filter(g => gidsVoor(g, [filter, ...(filter === 'bouw' ? ['trainco', 'hjo'] : [])]));
  if (filter === 'mij' && !lijst.length) lijst = GIDSEN;
  const treffers = zoek ? zoekGidsen(zoek, { max: 8 }) : [];
  const zoekHtml = !zoek ? '' : treffers.length
    ? `<div class="gd-treffers">${treffers.map(({ gids, stap }) => `<button class="gd-treffer" data-gd-open="${gids.id}" data-gd-stap="${stap}">
        <span class="gd-kaart-nr">${gids.id}</span><span class="gd-kaart-t"><b>${esc(gids.stappen[stap].t)}</b><small>${esc(gids.titel)} · stap ${stap + 1}</small></span></button>`).join('')}</div>`
    : `<div class="hl-geen">Niets gevonden voor <b>${esc(zoek)}</b>. Probeer een ander woord, of stel je vraag aan de hulpchat.</div>`;
  return `
    <div class="hl-zoekbalk gd-zoekbalk">
      <span class="hl-zoek-ico">${ico('navigation-search', 20)}</span>
      <input type="search" id="gdZoek" class="hl-zoek-input" placeholder="Zoek, bijvoorbeeld wissel plannen" value="${esc(zoek)}" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Zoek in de handleidingen">
    </div>
    ${zoek ? zoekHtml : `
    <button class="gd-chatbalk" data-open-hulpchat="1">${ico('communication-chat', 22)}<span><b>Stel je vraag aan de hulpchat</b><small>Antwoord in gewone woorden, met de weg ernaartoe.</small></span><span class="gd-pijl">›</span></button>
    <div class="gd-filter" role="tablist" aria-label="Voor wie">${keuzes.map(([id, naam]) => `<button role="tab" aria-selected="${filter === id}" class="${filter === id ? 'aan' : ''}" data-gd-filter="${id}">${naam}</button>`).join('')}</div>
    <div class="gd-lijst">${lijst.map(kaart).join('')}</div>
    <a class="gd-boekje" href="${PDF_ALLES()}" target="_blank" rel="noopener" download>${ico('admin-document', 18)}<span>Alle handleidingen in één PDF</span></a>`}`;
}

/* ---------- één handleiding ---------- */
function htmlBeeld(stap){
  const b = stap.b && BEELDEN[stap.b]; if (!b) return '';
  const punten = (b.p || []).map((p, i) => p ? `<span class="gd-punt" style="left:${p[0]}%;top:${p[1]}%">${i + 1}</span>` : '').join('');
  return `<figure class="gd-beeld ${b.a}"><div class="gd-scherm" data-gd-groot="${stap.b}" role="button" tabindex="0" title="Tik om te vergroten"><img src="${beeldUrl(stap.b)}" width="${b.w}" height="${b.h}" loading="lazy" decoding="async" alt="Scherm bij stap: ${esc(stap.t)}">${punten}</div></figure>`;
}
function htmlLegenda(stap){
  const b = stap.b && BEELDEN[stap.b]; if (!b || !(stap.m || []).length) return '';
  return `<ul class="gd-leg">${stap.m.map((l, i) => b.p && b.p[i] ? `<li><span class="gd-punt klein">${i + 1}</span>${esc(l)}</li>` : '').join('')}</ul>`;
}

function htmlGids(g){
  const aan = gidsOnderdeelAan(g);
  const magOpenen = aan && schermMag(g.plek);
  const i = GIDSEN.indexOf(g), vorige = GIDSEN[i - 1], volgende = GIDSEN[i + 1];
  return `
    <button class="gd-terug" data-gd-terug="1">‹ Alle handleidingen</button>
    <header class="gd-kop">
      <span class="gd-kop-nr">Handleiding ${g.id}</span>
      <h2>${esc(g.titel)}</h2>
      <p>${esc(g.kort)}</p>
      <div class="gd-meta"><span>Voor: ${esc(voorTekst(g))}</span><span>${apparaatNaam(g.apparaat)}</span><span>${g.stappen.length} stappen</span></div>
      ${aan ? '' : `<div class="tip"><b>Staat niet aan.</b> Dit onderdeel staat bij jouw club uit. Cluppie zet het per club aan; vraag het je clubbeheerder.</div>`}
      <div class="gd-acties">
        ${magOpenen ? `<button class="knop klein fluo" data-gd-plek="${g.id}">${ico('navigation-forward', 16)}Open dit scherm</button>` : ''}
        ${g.video ? `<button class="knop klein licht" data-gd-video="${g.id}" ${videoKlaar() ? '' : 'hidden'}>${ico('training-video', 16)}Bekijk de video</button>` : ''}
        <a class="knop klein licht" href="${pdfUrl(g)}" target="_blank" rel="noopener" download>${ico('admin-document', 16)}Download PDF</a>
      </div>
    </header>
    <ol class="gd-stappen">${g.stappen.map((s, n) => `
      <li class="gd-stap${s.b && BEELDEN[s.b] ? ' met-beeld ' + BEELDEN[s.b].a : ''}" id="gd-stap-${n}">
        <div class="gd-stap-tekst"><h3><span class="gd-nr">${n + 1}</span>${esc(s.t)}</h3><p>${opmaak(s.x)}</p>${htmlLegenda(s)}</div>
        ${htmlBeeld(s)}
      </li>`).join('')}</ol>
    ${(g.tips || []).length ? `<div class="gd-tips"><h3>Goed om te weten</h3><ul>${g.tips.map(t => `<li>${opmaak(t)}</li>`).join('')}</ul></div>` : ''}
    <button class="gd-chatbalk" data-gd-chat="${g.id}">${ico('communication-chat', 22)}<span><b>Kom je er niet uit?</b><small>Vraag het de hulpchat. Die kent deze handleiding.</small></span><span class="gd-pijl">›</span></button>
    <nav class="gd-nav">
      ${vorige ? `<button data-gd-open="${vorige.id}"><small>Vorige</small>${esc(vorige.titel)}</button>` : '<span></span>'}
      ${volgende ? `<button data-gd-open="${volgende.id}"><small>Volgende</small>${esc(volgende.titel)}</button>` : '<span></span>'}
    </nav>`;
}

/* Eén stap als kaartje, voor in de hulpchat: tekst, legenda en het schermbeeld met de stippen. */
export function htmlStapKaart(id, stap){
  const g = gidsMet(id), s = g && g.stappen[stap]; if (!s) return '';
  return `<div class="gd-stap-tekst"><p>${opmaak(s.x)}</p>${htmlLegenda(s)}</div>${htmlBeeld(s)}`;
}
export { videoKlaar, speelVideo, toonGroot };

/* Het hele Help-scherm. `herstart` = het blok van de rondleiding (onboardingHerstartBlok), alleen in het overzicht. */
export function htmlHulp(){
  const g = S._gids ? gidsMet(S._gids) : null;
  if (g) return `<div class="gd gd-open">${htmlGids(g)}</div>`;
  return `<div class="gd">${htmlOverzicht()}</div>
    <details class="gd-naslag"${S._helpZoek ? ' open' : ''}><summary>Naslag: alle uitleg op één pagina</summary>${htmlHandleiding()}</details>`;
}

/* Opent Help op een handleiding (en eventueel een stap). `naarHelp` zet het tabblad. */
export function openGids(id, stap = null, naarHelp = null){
  const g = gidsMet(id); if (!g) return false;
  S._gids = g.id; S._gidsStap = Number.isInteger(stap) ? stap : null;
  telGebruik('handleiding_' + g.id);
  if (naarHelp) naarHelp();
  return true;
}

/* ---------- waar "Open dit scherm" heen gaat (ook gebruikt door de hulpchat) ---------- */
/* Kan deze gebruiker het scherm nu openen? Teamschermen vragen een open team, de club vraagt een beheerrol. */
export function schermMag(code){
  if (!code || !SCHERMEN[code]) return false;
  const [soort, naam] = code.split(':');
  if (soort === 'team') return !!S.teamId && naam !== 'help';
  const clubId = S.clubId || (S.team && S.team.club); if (!clubId) return false;
  const r = gidsRollen();
  if (r.includes('admin')) return true;
  return soort === 'club' && r.includes('hjo') && ['speelstijl', 'jeugdplan', 'evals', 'trainingen'].includes(naam);
}
export async function naarScherm(code){
  if (!schermMag(code)) return false;
  const [soort, naam] = code.split(':');
  if (soort === 'team'){ (await import('./teams.js?v=20261130q')).zetTeamTab(naam); return true; }
  const clubId = S.clubId || (S.team && S.team.club);
  if (soort === 'club'){ (await import('./club.js?v=20261130q')).openClub(clubId); if (naam !== 'hub') S.clubTab = naam; return true; }
  if (naam === 'activiteiten') (await import('./activiteiten.js?v=20261130q')).openActiviteiten(clubId);
  else if (naam === 'tv') (await import('./activiteiten.js?v=20261130q')).openActiviteiten(clubId, '', { extra: 'schermen' });
  else if (naam === 'veldplanner') (await import('./veldplanner.js?v=20261130q')).openVeldplanner(clubId);
  else if (naam === 'sportparken') (await import('./veldkaart.js?v=20261130q')).openSportparkBeheer(clubId);
  return true;
}

/* Schermbeeld groot bekijken (tik op het beeld) */
function toonGroot(schermEl){
  const laag = document.createElement('div');
  laag.className = 'gd-videolaag gd-grootlaag';
  const kopie = schermEl.cloneNode(true); kopie.removeAttribute('data-gd-groot'); kopie.removeAttribute('title');
  laag.innerHTML = '<button class="gd-video-x" aria-label="Sluiten">✕</button>';
  const kader = document.createElement('div'); kader.className = 'gd-beeld groot ' + (schermEl.parentElement.classList.contains('laptop') ? 'laptop' : 'telefoon');
  kader.appendChild(kopie); laag.appendChild(kader);
  laag.addEventListener('click', () => laag.remove());
  document.body.appendChild(laag);
}

function speelVideo(g){
  const laag = document.createElement('div');
  laag.className = 'gd-videolaag';
  laag.innerHTML = `<div class="gd-videokader" role="dialog" aria-label="Video ${esc(g.titel)}">
    <button class="gd-video-x" aria-label="Sluiten">✕</button>
    <video src="${videoUrl(g)}" controls autoplay playsinline></video></div>`;
  const dicht = () => { laag.querySelector('video')?.pause(); laag.remove(); };
  laag.addEventListener('click', e => { if (e.target === laag || e.target.closest('.gd-video-x')) dicht(); });
  document.body.appendChild(laag);
  telGebruik('handleiding_video');
}

/* Koppelt de knoppen. `hulp` = { zetTeamTab, opnieuw } uit teams.js. */
export function koppelHulp(v, hulp){
  const opnieuw = () => { hulp.opnieuw(); window.scrollTo(0, 0); };
  v.querySelectorAll('[data-gd-open]').forEach(b => b.onclick = () => {
    openGids(b.dataset.gdOpen, b.dataset.gdStap != null ? Number(b.dataset.gdStap) : null); opnieuw();
    if (S._gidsStap != null) requestAnimationFrame(() => v.querySelector('#gd-stap-' + S._gidsStap)?.scrollIntoView({ block: 'start' }));
  });
  v.querySelectorAll('[data-gd-terug]').forEach(b => b.onclick = () => { S._gids = null; S._gidsStap = null; opnieuw(); });
  v.querySelectorAll('[data-gd-filter]').forEach(b => b.onclick = () => { S._gidsFilter = b.dataset.gdFilter; hulp.opnieuw(); });
  v.querySelectorAll('[data-gd-plek]').forEach(b => b.onclick = () => { const g = gidsMet(b.dataset.gdPlek); S._gids = null; naarScherm(g.plek); });
  v.querySelectorAll('[data-gd-groot]').forEach(b => { b.onclick = () => toonGroot(b); b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toonGroot(b); } }; });
  v.querySelectorAll('[data-gd-video]').forEach(b => b.onclick = () => speelVideo(gidsMet(b.dataset.gdVideo)));
  v.querySelectorAll('[data-gd-chat]').forEach(b => b.onclick = () => import('./chatbot.js?v=20261130q').then(m => m.openChatbot({ gids: b.dataset.gdChat })));
  v.querySelectorAll('.gd [data-open-hulpchat]').forEach(b => b.onclick = () => import('./chatbot.js?v=20261130q').then(m => m.openChatbot()));
  const zoek = v.querySelector('#gdZoek');
  if (zoek){
    let t = 0;
    zoek.oninput = () => { S._gidsZoek = zoek.value; clearTimeout(t); t = setTimeout(() => { hulp.opnieuw(); const n = document.getElementById('gdZoek'); if (n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 220); };
  }
  /* open op de gevraagde stap (vanuit de hulpchat) */
  if (S._gids && S._gidsStap != null){
    const doel = v.querySelector('#gd-stap-' + S._gidsStap);
    if (doel) requestAnimationFrame(() => { doel.scrollIntoView({ block: 'start' }); doel.classList.add('gd-raak'); });
    S._gidsStap = null;
  }
}
