/* ==================== TRAINING-WEERGAVE ====================
   Fullscreen, verticaal scrolbare weergave van een AI-gestructureerde training.
   Toont per oefening: nummer, titel, diagram (uit Storage) en de tekstblokken in
   de vertrouwde handleiding-stijl (.hl). Bovenaan een knop naar het ORIGINELE
   PDF (opent de bestaande pdf-viewer), zodat de coach altijd terug kan naar de
   bron.

   Gebruikt dezelfde overlay-aanpak en terug-bewaking als pdf-viewer.js, zodat de
   Android-terugknop / veeg-terug de weergave sluit i.p.v. de app te verlaten. */

import { bewaakTerug, vangnetStilTerugAlsNodig, esc, terugLaag } from './state.js?v=20261125t';
import { principe as principeOpId } from './speelwijze-logica.js?v=20261116j';
import { htmlPrincipeChip } from './speelwijze-html.js?v=20261116j';
import { maak3DBlok, heeftWebGL } from './scene3d.js?v=20261121b';

let _overlay = null;

function bouwOverlay(){
  if (_overlay) return _overlay;
  const el = document.createElement('div');
  el.className = 'trw-overlay';
  el.innerHTML = `
    <div class="trw-balk">
      <button class="trw-terug" aria-label="Sluiten">‹</button>
      <div class="trw-kop">
        <div class="trw-titel"></div>
        <div class="trw-meta"></div>
      </div>
    </div>
    <div class="trw-stage"></div>
    <button type="button" class="tl-start" data-tl-start hidden><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>Start training</button>
    <div class="tl-live" hidden aria-live="polite">
      <span class="tl-live-nr"></span>
      <div class="tl-live-t"><small></small><b></b><span></span></div>
      <div class="tl-live-k"><button type="button" class="knop klein licht" data-tl-live="vorige">‹ Vorige</button><button type="button" class="knop klein" data-tl-live="volgende">Volgende ›</button><button type="button" class="knop klein licht" data-tl-live="stop">Stoppen</button></div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('.trw-terug').onclick = () => sluitTrainingWeergave();
  /* Hardware-terug sluit de trainingweergave (z-index 45). */
  terugLaag('trw', { z:45, vast:true, open: () => el.classList.contains('open'), sluit: sluitTrainingWeergave });
  _overlay = el;
  return el;
}

export function sluitTrainingWeergave(){
  if (!_overlay) return;
  const wasOpen = _overlay.classList.contains('open');
  _overlay.classList.remove('open');
  _overlay.querySelector('.trw-stage').innerHTML = '';
  _overlay.querySelector('.tl-start').hidden = true; _overlay.querySelector('.tl-live').hidden = true; _overlay.classList.remove('tl-loopt');
  import('./training-tijdlijn.js?v=20261125t').then(m => m.sluitUitzet()).catch(() => {});
  _overlay._beurt = (_overlay._beurt || 0) + 1;                 /* een open-aanroep die nog laadt, vervalt */
  if (_stopVandaag){ _stopVandaag(); _stopVandaag = null; }
  // notitie-knop uit de balk verwijderen zodat een volgende training schoon start
  // ("not(.trw-deel-knop)": de deel-knop hergebruikt dezelfde stijl-klasse,
  // dus zonder deze uitzondering kon deze regel per ongeluk de deel-knop
  // verwijderen i.p.v. de notitie-knop — resetTrainingDelen() hieronder
  // ruimt de deel-knop al op zijn eigen manier op).
  const nb = _overlay.querySelector('.trw-notitie-knop:not(.trw-deel-knop)');
  if (nb) nb.remove();
  import('./training-aantekeningen.js?v=20261125t').then(m => m.resetAantekeningen()).catch(() => {});
  import('./training-video.js?v=20261125t').then(m => m.resetTrainingVideos()).catch(() => {});
  import('./training-tactiek.js?v=20261125t').then(m => m.resetTrainingTactiek()).catch(() => {});
  import('./training-delen.js?v=20261125t').then(m => m.resetTrainingDelen()).catch(() => {});
  vangnetStilTerugAlsNodig(wasOpen);
}

/* ---- Diagram-lightbox: schermvullende weergave met pinch/dubbeltik-zoom ----
   De app zet globaal user-scalable=no; net als in pdf-viewer.js zetten we de
   viewport tijdelijk zoombaar zolang de lightbox open staat, zodat de coach
   met knijpen of dubbeltikken op het diagram kan inzoomen. */
let _lb = null, _viewportOrigineel = null;

function zetViewportZoombaar(aan){
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  if (_viewportOrigineel === null) _viewportOrigineel = meta.getAttribute('content');
  meta.setAttribute('content', aan
    ? 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes'
    : _viewportOrigineel);
}

function bouwLightbox(){
  if (_lb) return _lb;
  const el = document.createElement('div');
  el.className = 'trw-lb';
  el.innerHTML = `
    <div class="trw-lb-balk">
      <div class="trw-lb-titel"></div>
      <button class="trw-lb-sluit" aria-label="Sluiten">✕</button>
    </div>
    <div class="trw-lb-canvas"><img alt=""></div>
    <div class="trw-lb-voet"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3 20 20"/></svg> knijp of dubbeltik om in te zoomen</div>`;
  document.body.appendChild(el);
  el.querySelector('.trw-lb-sluit').onclick = () => sluitLightbox();
  el.addEventListener('click', e => { if (e.target === el) sluitLightbox(); });
  _lb = el;
  return el;
}

export function openLightbox(url, titel){
  const el = bouwLightbox();
  el.querySelector('.trw-lb-titel').textContent = titel || 'Diagram';
  el.querySelector('.trw-lb-canvas img').src = url;
  zetViewportZoombaar(true);
  el.classList.add('open');
  bewaakTerug();
}

export function sluitLightbox(){
  if (!_lb) return;
  const wasOpen = _lb.classList.contains('open');
  _lb.classList.remove('open');
  _lb.querySelector('.trw-lb-canvas img').src = '';
  zetViewportZoombaar(false);
  vangnetStilTerugAlsNodig(wasOpen);
}

export function blokHtml(blok){
  const kop = blok.kop ? `<h3>${esc(blok.kop)}</h3>` : '';
  if (blok.type === 'lijst' && Array.isArray(blok.items)){
    const items = blok.items.map(x => `<li>${esc(x)}</li>`).join('');
    return `${kop}<ul>${items}</ul>`;
  }
  return `${kop}<p>${esc(blok.tekst || '')}</p>`;
}

/* Koppelt diagram aan oefening op VOLGORDE: het N-de diagram hoort bij de N-de
   oefening, ongeacht onder welk nummer het is opgeslagen.
   Nieuwe uploads zijn doorlopend genummerd (1,2,3…). Oudere uploads zijn per
   PDF-pagina genummerd; begon zo'n PDF met een lege kaftpagina (alleen een
   avatar-icoontje), dan liepen de sleutels 2,3,4,5 en schoof elk plaatje één
   oefening op. Door de sleutels te sorteren en op positie te koppelen klopt het
   voor beide: bij 1,2,3,4 verandert er niets, bij 2,3,4,5 schuift alles terug. */
export function diagramVoorOefening(idx, diagramUrls){
  const D = diagramUrls || {};
  /* [20261114a] PDF-profiel 'hele pagina als plaatje': plaatjes staan al per oefening (koppelDiagrammen) */
  if (D._perOefening) return D[idx] || D[String(idx)] || null;
  const sleutels = Object.keys(D)
    .filter(k => D[k] && Number.isFinite(Number(k)))
    .sort((a, b) => Number(a) - Number(b));
  const sleutel = sleutels[idx - 1];
  return sleutel != null ? D[sleutel] : null;
}

export function oefHtml(idx, oef, diagramUrls){
  const url = diagramVoorOefening(idx, diagramUrls);
  /* [20261116k] Een oefening uit de bibliotheek staat altijd in 3D (de keuze Tekening/3D is weg). De tekening
     staat er als terugval onder: die blijft zichtbaar zonder WebGL, als de vorm niet meer in de bibliotheek
     staat, en bij afdrukken. Het 3D-veld zelf komt erin zodra de oefening in beeld schuift (beheer3D). */
  const drie = !url && oef.svg && oef.bron?.vormId;
  const figuur = `<figure class="trw-diagram trw-svg">${oef.svg || ''}</figure>`;
  const diagram = drie
    ? `<div class="trw-teken${kan3D() ? ' wacht' : ''}" data-trw-vorm="${esc(oef.bron.vormId)}" data-trw-plek="${idx}">${figuur}</div>`
    : !url && oef.svg
    ? figuur
    : url
    ? `<figure class="trw-diagram" data-zoom="${esc(url)}" data-zoomtitel="${esc(oef.titel || 'Oefening ' + idx)}"><img src="${esc(url)}" alt="" loading="lazy"><span class="trw-zoomhint"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3 20 20"/></svg> tik om te vergroten</span></figure>`
    : '';
  const zeven = (oef.blokken || []).some(b => b.veld);
  const blokken = zeven ? htmlVeldenVan(oef.blokken) : (oef.blokken || []).map(blokHtml).join('');
  return `
    <section class="trw-oef">
      <div class="trw-oef-kop">
        <span class="trw-oef-nr">${idx}</span>
        <h2>${esc(oef.titel || 'Oefening ' + idx)}</h2>
      </div>
      ${oef.principe && principeOpId(oef.principe) ? `<div class="sw-blokchip">${htmlPrincipeChip(principeOpId(oef.principe))}</div>` : ''}
      ${oef.vandaag ? `<div class="tv-was"><b>${esc(oef.vandaag.label)}</b><span>${esc(oef.vandaag.was || '')}</span></div>` : ''}
      ${diagram}
      <div class="${zeven ? 'ok-kaart trw-ok' : 'hl'}">${blokken}</div>
    </section>`;
}

/* [20261115c] Blokken met `veld` als de 7 vaste velden van de oefenkaart: openklapbaar met <details>,
   zodat er geen extra klik-afhandeling nodig is. Uitleg staat standaard open. */
const VELDEN = [['doel', 'Doel'], ['tijd', 'Tijdbestek'], ['mat', 'Benodigdheden'], ['uitleg', 'Uitleg'], ['diff', 'Differentiatie'], ['coach', 'Coachmomenten'], ['spel', 'Spelvormen']];
const SUBKOP = { Organisatie: 'Opstelling en verloop', Coachpunten: 'Let op', Coachvragen: 'Vraag aan de spelers', Spelverloop: 'Spelverloop stap voor stap' };
function htmlVeldenVan(blokken){
  return VELDEN.map(([id, naam], i) => {
    const bs = blokken.filter(b => b.veld === id); if (!bs.length) return '';
    const eerste = bs[0], kort = eerste.type === 'lijst' ? (eerste.items || []).join(' · ') : (eerste.tekst || '');
    const inhoud = bs.map(b => {
      const kop = b.kop && b.kop !== naam && !(id === 'tijd' && b.kop === 'Tijdbestek') ? `<div class="ok-sub">${esc(SUBKOP[b.kop] || b.kop)}</div>` : '';
      /* [20261116i] uitwerking per oefening, in dezelfde opmaak als de oefenkaart */
      if (b.kop === 'Kijk en grijp in' && b.type === 'lijst') return `${kop}<div class="ok-alsdan">${(b.items || []).map(x => { const [zie, ...doe] = String(x).split(' → '); return `<div><span class="zie">${esc(zie)}</span>${doe.length ? `<span class="doe">${esc(doe.join(' → '))}</span>` : ''}</div>`; }).join('')}</div>`;
      if (b.kop === 'Waarom dit werkt' && b.type !== 'lijst') return `<p class="ok-waarom"><b>Waarom dit werkt:</b> ${esc(b.tekst)}</p>`;
      if (b.kop === 'Tel mee' && b.type !== 'lijst') return `${kop}<p class="ok-meet">${esc(b.tekst)}</p>`;
      if (b.type === 'lijst') return `${kop}<ul class="ok-ul">${(b.items || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      return `${kop}${b.kop === 'Uitleg' ? `<div class="ok-zeg">${esc(String(b.tekst).replace(/^Zeg:\s*/i, ''))}</div>` : `<p>${esc(b.tekst)}</p>`}`;
    }).join('');
    return `<details class="ok-veld"${id === 'uitleg' ? ' open' : ''}><summary><span class="ok-nr">${i + 1}</span><span class="ok-lbl">${naam}</span><span class="ok-kort">${esc(kort)}</span><span class="ok-pijl" aria-hidden="true">›</span></summary><div class="ok-inhoud">${inhoud}</div></details>`;
  }).join('');
}

/* ---------- [20261116k] Altijd 3D: beheer van de 3D-velden ----------
   oefHtml zet per oefening uit de bibliotheek een plek neer (.trw-teken[data-trw-vorm]). Dat gebeurt op meer
   schermen (deze weergave, het trainingsscherm op desktop, de trainingscoördinator, de deelpagina), en die
   schermen tekenen zichzelf soms opnieuw. Daarom regelt één beheerder hier alles, los van wie de html plaatste:
     • een veld wordt pas gemaakt als de oefening (bijna) in beeld is, en weer vrijgegeven als hij uit beeld
       schuift: een browser staat maar een beperkt aantal 3D-velden tegelijk toe en een telefoon heeft weinig
       geheugen. De plek houdt dan zijn hoogte, zodat de pagina niet verspringt;
     • tekent een scherm zichzelf opnieuw, dan verhuist het lopende veld naar de nieuwe plek (zelfde scherm,
       oefening en vorm), zodat de animatie niet opnieuw begint;
     • een plek die uit de pagina verdwijnt, ruimt zijn veld op.
   Zonder WebGL, of als de vorm niet meer in de bibliotheek staat, blijft de tekening staan. */
let _kan3D = null;
function kan3D(){
  if (_kan3D === null) _kan3D = typeof document !== 'undefined' && typeof IntersectionObserver !== 'undefined' && typeof MutationObserver !== 'undefined' && heeftWebGL();
  return _kan3D;
}
const D3 = { io: null, gepland: false, gezien: new WeakSet(), aan: new Set() };
const sleutel3D = el => (el.closest('.trw-overlay') ? 'o' : 'i') + ':' + el.dataset.trwPlek + ':' + el.dataset.trwVorm;
function plaats3D(el, blok){
  el._blok = blok; el.appendChild(blok); el.classList.add('is-3d'); el.classList.remove('wacht'); el.style.minHeight = ''; D3.aan.add(el);
}
async function zet3D(el){
  if (el._blok || el._bezig || !el.isConnected || !kan3D()) return;
  el._bezig = true;
  try {
    const { vormOpId } = await import('./bibliotheek.js?v=20261121b');
    const v = vormOpId(el.dataset.trwVorm);
    if (!v){ el.classList.remove('wacht'); el.style.minHeight = ''; return; }      /* vorm bestaat niet meer: de tekening blijft */
    if (el.isConnected && el._inBeeld && !el._blok) plaats3D(el, maak3DBlok(v, v.veld));
  } catch (e){ el.classList.remove('wacht'); el.style.minHeight = ''; }
  finally { el._bezig = false; }
}
function haal3D(el, houdPlek = true){
  if (!el._blok) return;
  if (houdPlek && el.isConnected){ el.style.minHeight = el.offsetHeight + 'px'; el.classList.add('wacht'); }
  el._blok.weg?.(); el._blok.remove(); el._blok = null; el.classList.remove('is-3d'); D3.aan.delete(el);
}
function beheer3D(){
  D3.gepland = false;
  const wezen = new Map();                                   /* velden waarvan de plek uit de pagina is verdwenen */
  for (const el of [...D3.aan]) if (!el.isConnected){ D3.aan.delete(el); if (el._blok) wezen.set(el._sleutel, el); }
  document.querySelectorAll('.trw-teken[data-trw-vorm]').forEach(el => {
    if (D3.gezien.has(el)) return;
    D3.gezien.add(el); el._sleutel = sleutel3D(el);
    const oud = wezen.get(el._sleutel);
    if (oud){ wezen.delete(el._sleutel); const blok = oud._blok; oud._blok = null; el._inBeeld = true; plaats3D(el, blok); }
    D3.io.observe(el);
  });
  for (const el of wezen.values()){ el._blok.weg?.(); el._blok = null; }
}
function start3D(){
  if (D3.io || typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
  D3.io = new IntersectionObserver(es => { for (const e of es){ e.target._inBeeld = e.isIntersecting; if (e.isIntersecting) zet3D(e.target); else haal3D(e.target); } }, { rootMargin: '300px 0px' });
  const plan = () => { if (!D3.gepland){ D3.gepland = true; requestAnimationFrame(beheer3D); } };
  new MutationObserver(plan).observe(document.body, { childList: true, subtree: true });
  plan();
}
if (typeof document !== 'undefined'){ if (document.body) start3D(); else document.addEventListener('DOMContentLoaded', start3D); }

/* openTrainingWeergave({ training, diagramUrls, oefeningen, onOrigineel })
   - training: het Firestore-doc (voor titel/meta)
   - diagramUrls: { pagina: url }
   - oefeningen: de AI-structuur
   - onOrigineel: callback die de PDF-viewer opent
   - vandaag: [20261116l] het trainingsdocument, als de balk "Vandaag" (spelers en weer) erbij hoort. De module
     training-vandaag.js wordt dan pas geladen (zo blijft de deelpagina voor ouders licht), levert de balk en de
     oefeningen zoals ze vandaag zijn, en laat de weergave zichzelf opnieuw tekenen na een tik in de balk. */
let _stopVandaag = null;
export async function openTrainingWeergave({ titel, meta, oefeningen, diagramUrls, onOrigineel, trainingId, oefeningVideos, oefeningTactiek, trainingClub, teamId, teamNaam, clubNaam, draadHtml = '', vandaag = null, start = false }){
  const el = bouwOverlay();
  el.querySelector('.trw-titel').textContent = titel || 'Training';
  el.querySelector('.trw-meta').textContent = meta || '';
  const stage = el.querySelector('.trw-stage'), balk = el.querySelector('.trw-balk');
  if (_stopVandaag){ _stopVandaag(); _stopVandaag = null; }
  const beurt = (el._beurt = (el._beurt || 0) + 1);            /* een nieuwere aanroep (of sluiten) wint van een oudere */

  let TV = null;
  if (vandaag && teamId){
    try { TV = await import('./training-vandaag.js?v=20261125t'); } catch (e){ TV = null; }
    if (el._beurt !== beurt) return;
  }
  /* [20261120k] de tijdlijn: fase, duur en veld komen uit de vorm in de bibliotheek (als die er is) */
  let TL = null, vormVan = () => null;
  try { TL = await import('./training-tijdlijn.js?v=20261125t'); } catch (e){ TL = null; }
  if (TL && (oefeningen || []).some(o => o?.bron?.vormId)){
    try { const B = await import('./bibliotheek.js?v=20261121b'); vormVan = B.vormOpId; } catch (e){ /* zonder bibliotheek: tijdlijn zonder fase en veld */ }
  }
  if (el._beurt !== beurt) return;
  const desk = () => document.documentElement.classList.contains('desk') && window.matchMedia?.('(min-width:1100px)').matches;
  const T = { open: 0, live: false, info: null };

  const origKnop = onOrigineel
    ? `<button class="trw-orig"><span class="trw-pdftag">PDF</span> Origineel bekijken</button>`
    : '';

  /* De lagen bovenop de oefeningen (aantekeningen, video, tactiekbord, delen). Bij opnieuw tekenen eerst opruimen,
     precies zoals bij sluiten, en dan opnieuw koppelen aan de nieuwe oefeningen. */
  const lagen = async (opnieuw) => {
    const [aant, vid, tac, del] = await Promise.all([
      import('./training-aantekeningen.js?v=20261125t').catch(() => null),
      import('./training-video.js?v=20261125t').catch(() => null),
      import('./training-tactiek.js?v=20261125t').catch(() => null),
      import('./training-delen.js?v=20261125t').catch(() => null),
    ]);
    if (el._beurt !== beurt || !el.classList.contains('open')) return;
    const veilig = f => { try { f(); } catch (e){ console.warn('[training] laag koppelen mislukt', e); } };
    if (opnieuw){
      balk.querySelector('.trw-notitie-knop:not(.trw-deel-knop)')?.remove();
      veilig(() => aant?.resetAantekeningen()); veilig(() => vid?.resetTrainingVideos()); veilig(() => tac?.resetTrainingTactiek()); veilig(() => del?.resetTrainingDelen());
    }
    // Aantekeningen: notitie-knop in de balk + tik-op-regel.
    veilig(() => { if (aant){ aant.initAantekeningen({ stage, balk, trainingId }); if (!opnieuw) aant.bindItemKlik(stage); } });   /* de tik-afhandeling hangt aan het blijvende scherm: één keer per openen */
    // Video-uitleg: knop in de balk die de zichtbare oefening volgt + afspeeltegel per oefening.
    veilig(() => vid?.initTrainingVideos({ stage, balk, trainingId, videos: oefeningVideos || {}, trainingClub }));
    // Tactiekbord: compact icoon per oefening, op één lijn met het video-icoon.
    veilig(() => tac?.initTrainingTactiek({ stage, trainingId, borden: oefeningTactiek || {} }));
    // Deel-knop: de training + de presentie tijdelijk delen met een meehelpende ouder.
    veilig(() => del?.initTrainingDelen({ balk, trainingId, teamId, teamNaam, clubNaam, titel }));
  };

  const teken = (eerste) => {
    const tv = TV ? TV.vandaagVan(vandaag, teamId) : null;
    const lijst = tv ? tv.oefeningen : oefeningen;
    const y = stage.scrollTop;
    const info = TL ? TL.tijdlijnInfo(lijst, vormVan, vandaag && TV?.startTijd ? TV.startTijd(vandaag, teamId) : null) : null;
    T.info = info;
    if (T.open == null || T.open >= lijst.length) T.open = desk() ? 0 : T.open == null ? null : 0;
    const onderdelen = info
      ? info.items.map(x => TL.htmlKaart(x, x.i === T.open) + TL.alsOnderdeel(oefHtml(x.i + 1, x.oef, diagramUrls), x, x.i === T.open)
          + (x.i < info.items.length - 1 ? TL.htmlOvergang(info.items[x.i + 1]) : '')).join('')
        + (info.eind ? `<div class="tl-einde"><span class="tl-tijd">${esc(info.eind)}</span><span class="tl-knoop"></span>Einde training</div>` : '')
      : lijst.map((o, i) => oefHtml(i + 1, o, diagramUrls)).join('');
    stage.innerHTML = `
    ${origKnop}
    <div class="tl-boven">
      ${info ? TL.htmlUitzetKnop(info) : ''}
      ${draadHtml ? `<div class="trw-draad tm">${draadHtml}</div>` : ''}
      ${tv?.html || ''}
      ${info ? TL.htmlVerloop(info, T.open) : ''}
    </div>
    <div class="${info ? `tl-onder${info.tijden ? ' met-tijd' : ''}` : 'tl-los'}">${onderdelen}</div>`;
    el.querySelector('.tl-start').hidden = !info || T.live;

    // origineel-knop → PDF-viewer
    const ob = stage.querySelector('.trw-orig');
    if (ob && onOrigineel) ob.onclick = () => onOrigineel();


    // diagram → schermvullende lightbox met zoom
    stage.querySelectorAll('.trw-diagram[data-zoom]').forEach(fig => {
      fig.onclick = () => openLightbox(fig.dataset.zoom, fig.dataset.zoomtitel);
    });

    stage.scrollTop = eerste ? 0 : y;
    if (trainingId) lagen(!eerste);
    if (T.live) toonLive();
  };

  /* ---------- [20261120k] tijdlijn: één onderdeel open, uitzetten, start training ---------- */
  const zetOpen = (i, scroll) => {
    T.open = i;
    stage.querySelectorAll('.tl-oef').forEach(s => s.classList.toggle('tl-open', Number(s.dataset.tl) === i));
    stage.querySelectorAll('.tl-kaart').forEach(k => { const aan = Number(k.dataset.tlOpen) === i; k.classList.toggle('open', aan); k.setAttribute('aria-pressed', String(aan)); });
    stage.querySelectorAll('.tl-balk').forEach(g => g.querySelectorAll('rect')[0]?.setAttribute('fill-opacity', Number(g.dataset.tlGa) === i ? '.6' : '.3'));
    if (scroll && i != null){
      const doel = desk() ? stage.querySelector(`.tl-kaart[data-tl-open="${i}"]`) : stage.querySelector(`.tl-oef[data-tl="${i}"]`);
      doel?.scrollIntoView({ behavior: 'smooth', block: desk() ? 'nearest' : 'start' });
    }
  };
  const toonLive = () => {
    const live = el.querySelector('.tl-live'), x = T.info?.items[T.open];
    if (!x){ stopLive(); return; }
    const volg = T.info.items[T.open + 1];
    live.style.setProperty('--fc', x.fase && TL.FASE[x.fase] ? TL.FASE[x.fase].kl : 'var(--accent)');
    live.querySelector('.tl-live-nr').textContent = String(x.i + 1);
    live.querySelector('.tl-live-t small').textContent = [x.fase ? TL.FASE[x.fase]?.naam : '', x.min ? `${x.min} min` : '', x.groepen ? `${x.groepen} ${x.groepen === 1 ? 'groep' : 'groepen'}` : ''].filter(Boolean).join(' · ');
    live.querySelector('.tl-live-t b').textContent = x.titel;
    live.querySelector('.tl-live-t span').textContent = volg ? `Hierna: ${volg.titel}` : 'Hierna: afsluiten';
    live.querySelector('[data-tl-live="vorige"]').disabled = x.i === 0;
    live.querySelector('[data-tl-live="volgende"]').textContent = volg ? 'Volgende ›' : 'Afronden ✓';
    stage.querySelectorAll('.tl-oef, .tl-kaart').forEach(n => n.classList.toggle('tl-nu', Number(n.dataset.tl ?? n.dataset.tlOpen) === x.i));
  };
  const naar = (i) => {
    if (!T.info) return;
    if (i >= T.info.items.length){ stopLive(); return; }
    zetOpen(Math.max(0, i), true); toonLive();
  };
  const stopLive = () => {
    T.live = false; el.classList.remove('tl-loopt');
    el.querySelector('.tl-live').hidden = true; el.querySelector('.tl-start').hidden = !T.info;
    stage.querySelectorAll('.tl-nu').forEach(n => n.classList.remove('tl-nu'));
  };
  const startLive = () => { if (!T.info) return; T.live = true; el.classList.add('tl-loopt'); el.querySelector('.tl-start').hidden = true; el.querySelector('.tl-live').hidden = false; naar(0); };
  const knipOp = (n) => !!n.closest('button, a, input, textarea, select, label, summary, .trw-oef-acties, .trw-video-tegel, .trw-ann-item, .tv');
  stage.onclick = (e) => {
    const k = e.target.closest('[data-tl-open]');
    if (k){ zetOpen(Number(k.dataset.tlOpen), false); if (T.live) toonLive(); return; }
    const g = e.target.closest('[data-tl-ga]');
    if (g){ zetOpen(Number(g.dataset.tlGa), true); if (T.live) toonLive(); return; }
    if (e.target.closest('[data-tl-uitzet]') && T.info){ TL.openUitzet(T.info); return; }
    /* telefoon: tik op de kop van een onderdeel klapt het open of dicht */
    const kop = !desk() && e.target.closest('.tl-oef .trw-oef-kop, .tl-oef .tl-meta');
    if (kop && !knipOp(e.target)){
      const i = Number(kop.closest('.tl-oef').dataset.tl);
      zetOpen(T.open === i ? null : i, T.open !== i);
    }
  };
  stage.onkeydown = (e) => { const g = e.target.closest?.('[data-tl-ga]'); if (g && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); zetOpen(Number(g.dataset.tlGa), true); } };
  el.querySelector('.tl-start').onclick = startLive;
  el.querySelector('.tl-live').onclick = (e) => {
    const b = e.target.closest('[data-tl-live]'); if (!b) return;
    if (b.dataset.tlLive === 'volgende') naar(T.open + 1);
    else if (b.dataset.tlLive === 'vorige') naar(T.open - 1);
    else stopLive();
  };
  stopLive();

  teken(true);
  el.classList.add('open');
  bewaakTerug();
  if (start) startLive();
  if (TV) _stopVandaag = TV.opWijziging(() => { if (el._beurt === beurt && el.classList.contains('open')) teken(false); });
}
