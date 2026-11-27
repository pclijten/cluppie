/* ==================== TV-SPELER [20261126q] ====================
   Speelt een tv-sjabloon af (tv-sjabloon-<id>.js, lijst in tv-sjablonen.js) op de kantine-tv.
   De speler doet alles wat voor elk sjabloon gelijk is; een sjabloon levert alleen html en css.

   - Het beeld is een vast vlak van 1920 x 1080 dat meeschaalt met de tv. Een sjabloon rekent dus in gewone px.
   - De dia's wisselen vanzelf: programma (in pagina's), uitslagen, en de sponsoren en eigen schermen van de club.
     Tussen elke twee sponsordia's komt het programma of de uitslagen terug.
   - Verandert er iets terwijl een dia staat (een stand, een mededeling), dan wordt alleen dat deel ververst, zonder overgang.
   - goal(g) legt het doelpunt-moment van het sjabloon over het beeld; de dia's wachten zolang.
   Wat een sjabloon moet leveren staat in docs/tv-sjablonen.md. */
import { rijStatus } from './clubscherm-logica.js?v=20261130g';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Lettergrootte die krimpt als de tekst langer is dan `tekens`: voor namen van sponsoren en teams in grote letters. */
export const maat = (tekst, px, tekens) => `font-size:${Math.round(px * Math.min(1, tekens / Math.max(1, String(tekst ?? '').length)))}px`;
/* Hetzelfde, maar op het langste woord: voor een naam die over meer regels mag lopen. */
export const maatWoord = (tekst, px, tekens) => maat('x'.repeat(Math.max(1, ...String(tekst ?? '').split(/\s+/).map(w => w.length))), px, tekens);
export const stip = '<i class="ts-stip"></i>';
/* Lopende band. De inhoud staat er twee keer in, zodat hij naadloos doorloopt. */
export const lint = (html, sec = 36) => `<div class="ts-lintw"><div class="ts-lint" style="animation-duration:${sec}s">${`<span>${html}</span>`.repeat(6)}</div></div>`;
/* Afbeelding van een sponsor of eigen scherm (al gecontroleerd door de speler), of niets. */
export const beeld = (x, klasse = 'ts-beeld') => x?.img ? `<div class="${klasse}"><img src="${esc(x.img)}" alt=""></div>` : '';
export const plek = r => r.status === 'af' ? 'Afgelast' : [r.veld, r.kk ? 'kk ' + r.kk : ''].filter(Boolean).join(' · ') || (r.thuis ? '' : 'Uit');
export const label = r => ({ live: 'Live', klaar: 'Gespeeld', af: 'Afgelast', straks: 'Straks', voorbij: '' }[r.status]);
export const bovenSponsor = x => x.soort === 'sponsor' ? (x.pakket === 'hoofd' ? 'Onze hoofdsponsor' : 'Met dank aan onze sponsor') : '';
export const klok = '<span data-ts-klok></span>';


/* [20261126v] Het doelpunt-moment, voor elk sjabloon gelijk.
   standWissel: de stand waarin het cijfer van het scorende team zichtbaar omspringt van de oude naar de nieuwe stand.
   vorm: hoe een cijfer getekend wordt (standaard gewoon), streep: wat ertussen staat. */
export function standWissel(g, vorm = esc, streep = '–'){
  const [na = '', nb = ''] = String(g.stand || '').split('–'), [oa, ob] = String(g.oud || '').split('–');
  const c = (n, o, rol) => rol && o !== undefined && o !== n ? `<span class="ts-sw-rol"><span class="o">${vorm(o)}</span><span class="n">${vorm(n)}</span></span>` : `<span>${vorm(n)}</span>`;
  return `<span class="ts-sw">${c(na, oa, g.kant === 'a')}<span class="ts-sw-s">${streep}</span>${c(nb, ob, g.kant === 'b')}</span>`;
}
/* De balk onder het doelpunt: minuut, maker en assist (als de club namen toont), het veld, en bij twee of meer
   doelpunten de tijdlijn van de wedstrijd (thuis boven de lijn, uit eronder). Leeg als er niets te melden is. */
export function goalBand(g = {}){
  const lijn = Array.isArray(g.lijn) && g.lijn.length >= 2 ? g.lijn.slice(0, 16) : [];
  const wie = g.maker ? `<b>${esc(g.maker)}</b>${g.assist ? `<small>assist van ${esc(g.assist)}</small>` : ''}` : `<b>${esc(g.team || '')}</b>`;
  if (!g.min && !g.maker && !g.veld && !lijn.length) return '';
  let tl = '';
  if (lijn.length){
    const max = Math.max(...lijn.map(x => x.m || 0), 1) * 1.06, laatste = [...lijn].reverse().find(x => x.k === g.kant);
    let vorige = { a: -99, b: -99 }, hoog = { a: false, b: false };
    const punten = lijn.map(x => { const pos = Math.max(2, Math.min(98, (x.m || 0) / max * 100));
      hoog[x.k] = pos - vorige[x.k] < 9 ? !hoog[x.k] : false; vorige[x.k] = pos;
      return `<i class="${x.k} ${x === laatste ? 'nu' : ''} ${hoog[x.k] ? 'hoog' : ''}" style="left:${pos.toFixed(1)}%"><u>${x.m ? x.m + "'" : ''}${x.n ? ' ' + esc(x.n) : ''}</u></i>`; }).join('');
    tl = `<div class="ts-gb-tl"><span class="ta ts-kap">${esc(g.a || '')}</span><span class="tb ts-kap">${esc(g.b || '')}</span><div class="ts-gb-lijn">${punten}</div></div>`;
  }
  return `<div class="ts-gband ${lijn.length ? '' : 'kort'}"><div class="ts-gb-l">${g.min ? `<span class="ts-gb-min">${Number(g.min)}'</span>` : ''}<div class="ts-gb-wie">${wie}${g.veld ? `<em><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.800 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2.200"/><circle cx="12" cy="10" r="2.600" fill="currentColor"/></svg>${esc(g.veld)}</em>` : ''}</div></div>${tl}</div>`;
}
export const GOAL_CSS = `
.ts-sw{display:inline-flex;align-items:baseline;white-space:nowrap}
.ts-sw-rol{display:inline-grid;animation:tsSwPop 1s cubic-bezier(.2,1.5,.4,1) 2.300s both}
.ts-sw-rol>span{grid-area:1/1;text-align:center}
.ts-sw-rol .o{animation:tsSwUit .45s cubic-bezier(.6,0,.9,.4) 1.900s both}
.ts-sw-rol .n{animation:tsSwIn .5s cubic-bezier(.1,.7,.2,1) 2.250s both}
@keyframes tsSwUit{to{transform:translateY(-60%) scale(.6);opacity:0}}
@keyframes tsSwIn{from{transform:translateY(70%) scale(.6);opacity:0}}
@keyframes tsSwPop{0%{transform:scale(1)}30%{transform:scale(1.5);text-shadow:0 0 .35em currentColor}100%{transform:scale(1)}}
.ts-gband{position:absolute;left:56px;right:56px;bottom:40px;height:178px;z-index:90;display:flex;align-items:center;gap:44px;padding:0 44px;border-radius:30px;
  background:rgba(8,10,16,.9);border:2px solid rgba(255,255,255,.16);box-shadow:0 24px 60px rgba(0,0,0,.45);color:#fff;
  font-family:var(--ts-body,Inter,system-ui,sans-serif);animation:tsGbIn .7s cubic-bezier(.2,.8,.2,1) 1.200s both;box-sizing:border-box;line-height:1.15;text-transform:none;letter-spacing:0}
.ts-gband *{box-sizing:border-box}
.ts-gband.kort{left:50%;right:auto;transform:translateX(-50%);animation-name:tsGbInM;max-width:1500px}
@keyframes tsGbIn{from{transform:translateY(240px);opacity:0}}
@keyframes tsGbInM{from{transform:translate(-50%,240px);opacity:0}}
.ts-gb-l{display:flex;align-items:center;gap:30px;flex:none;max-width:760px;min-width:0}
.ts-gb-min{font:900 104px/1 var(--ts-display,'Barlow Condensed','Arial Narrow',Impact,sans-serif);background:var(--club,#c8102e);color:var(--club-ink,#fff);border-radius:20px;padding:10px 26px 6px;flex:none}
.ts-gb-wie{display:flex;flex-direction:column;gap:6px;min-width:0}
.ts-gb-wie b{font:800 58px/1 var(--ts-display,'Barlow Condensed','Arial Narrow',Impact,sans-serif);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:560px}
.ts-gb-wie small{font:600 30px/1.1 var(--ts-body,Inter,system-ui,sans-serif);opacity:.8}
.ts-gb-wie em{font:700 30px/1.1 var(--ts-body,Inter,system-ui,sans-serif);font-style:normal;display:flex;align-items:center;gap:8px;color:#ffd84a}
.ts-gb-wie em svg{width:30px;height:30px;flex:none}
.ts-gb-tl{flex:1;min-width:0;position:relative;height:100%;padding-left:230px}
.ts-gb-tl .ta,.ts-gb-tl .tb{position:absolute;left:0;width:210px;font:700 24px/1.1 var(--ts-body,Inter,system-ui,sans-serif);opacity:.75;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ts-gb-tl .ta{top:44px}.ts-gb-tl .tb{bottom:44px}
.ts-gb-lijn{position:relative;height:100%;margin-right:40px}
.ts-gb-lijn::before{content:"";position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:rgba(255,255,255,.3);transform-origin:0 50%;animation:tsGbLijn .9s ease-out 1.700s both}
@keyframes tsGbLijn{from{transform:scaleX(0)}}
.ts-gb-lijn i{position:absolute;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#fff;animation:tsGbPunt .4s cubic-bezier(.3,1.6,.5,1) 2.200s both}
.ts-gb-lijn i.b{background:rgba(255,255,255,.55)}
.ts-gb-lijn i u{position:absolute;left:50%;transform:translateX(-50%);text-decoration:none;white-space:nowrap;font:700 24px/1 var(--ts-body,Inter,system-ui,sans-serif);font-style:normal}
.ts-gb-lijn i.a u{bottom:30px}.ts-gb-lijn i.b u{top:30px}
.ts-gb-lijn i.a.hoog u{bottom:56px}.ts-gb-lijn i.b.hoog u{top:56px}
.ts-gb-lijn i.nu{background:var(--club,#c8102e);box-shadow:0 0 0 5px #fff;animation:tsGbPunt .4s cubic-bezier(.3,1.6,.5,1) 2.600s both,tsGbPuls 1.400s ease-out 3s infinite}
.ts-gb-lijn i.nu u{color:#ffd84a}
@keyframes tsGbPunt{from{transform:scale(0)}}
@keyframes tsGbPuls{0%{box-shadow:0 0 0 5px #fff,0 0 0 5px rgba(255,255,255,.7)}100%{box-shadow:0 0 0 5px #fff,0 0 0 30px rgba(255,255,255,0)}}`;
export function goalStijl(){
  if (document.getElementById('tsGoalStijl')) return;
  const s = document.createElement('style'); s.id = 'tsGoalStijl'; s.textContent = GOAL_CSS; document.head.appendChild(s);
}

const min = t => /^\d{1,2}:\d{2}$/.test(t || '') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : 9999;
const inktOp = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b > .3 ? '#111111' : '#ffffff'; };

/* Alles wat een sjabloon mag gebruiken. d: het document clubTv/{id}; items: sponsoren en eigen schermen (al gesorteerd,
   plaatjes al gecontroleerd); nu: Date. Geen DOM, zodat het te testen is. */
export function tvModel(d = {}, items = [], nu = new Date()){
  const n = nu.getHours() * 60 + nu.getMinutes();
  const rijen = (d.programma || []).filter(w => d.uit !== false || w.thuis).map(w => {
    const status = rijStatus(w, n), r = { ...w, status, score: w.stand ? String(w.stand).replace(/\s*-\s*/, '–') : '' };
    r.plek = plek(r); r.eigen = w.thuis ? w.a : w.b; r.tegen = w.thuis ? w.b : w.a;
    return r;
  });
  const sponsors = items.filter(x => x.soort === 'sponsor' && (x.titel || x.img));
  const straks = rijen.filter(r => r.status === 'straks');
  return {
    club: d.clubNaam || 'Onze club', logo: d.logo || '', med: d.mededeling || '',
    dag: nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }),
    kleur: /^#[0-9a-f]{6}$/i.test(d.kleur || '') ? d.kleur : '#c8102e',
    rijen, live: rijen.filter(r => r.status === 'live'), straks, klaar: rijen.filter(r => r.status === 'klaar'),
    top: straks.find(r => r.thuis) || straks[0] || null,
    sponsors, hoofd: sponsors[0] || null,
    dias: items.filter(x => x.titel || x.tekst || x.img),
  };
}

/* De volgorde van de dia's. per: wedstrijden per programmapagina. */
export function diaReeks(m, per = 6){
  const n = m.rijen.length, komend = m.rijen.findIndex(r => r.status === 'live' || r.status === 'straks');
  const start = n > per ? Math.max(0, Math.min(komend < 0 ? n - per : komend, n - per)) : 0;   /* wat geweest is schuift weg als het niet meer past */
  const basis = [];
  for (let i = start; i < Math.max(n, 1); i += per) basis.push({ soort: 'programma', van: i, tot: i + per });
  basis.forEach((b, i) => { b.pag = { nr: i + 1, van: basis.length }; });
  if (m.live.length || m.klaar.length) basis.push({ soort: 'uitslagen' });
  if (!m.dias.length) return basis;
  const uit = []; let b = 0;
  for (let i = 0; i < m.dias.length || b < basis.length; i += 2){
    uit.push(basis[b++ % basis.length]);
    m.dias.slice(i, i + 2).forEach(x => uit.push({ soort: 'dia', x }));
  }
  return uit;
}

export function maakSpeler(el){
  stijl(); goalStijl();
  let T = null, m = null, tik = 0, beeldNu = '', kaderNu = '', sleutelNu = '', wissel = 0, goalTot = 0, vast = null;
  const wachtrij = [];
  el.innerHTML = `<div class="ts-kast"><div class="ts-stage"><div class="ts-kader"></div><div class="ts-scenes"></div><div class="ts-fx"></div><div class="ts-goal"></div></div></div>`;
  const stage = el.querySelector('.ts-stage'), kader = stage.querySelector('.ts-kader'), scenes = stage.querySelector('.ts-scenes'), fx = stage.querySelector('.ts-fx'), goalEl = stage.querySelector('.ts-goal');
  const schaal = () => stage.style.setProperty('--ts-s', Math.min(innerWidth / 1920, innerHeight / 1080));
  addEventListener('resize', schaal); schaal();
  const zetKlok = () => { const d = new Date(), t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; stage.querySelectorAll('[data-ts-klok]').forEach(k => { if (k.textContent !== t) k.textContent = t; }); };
  const klokTimer = setInterval(zetKlok, 1000);

  function diaHtml(dia){
    if (dia.soort === 'programma') return T.programma(m, m.rijen.slice(dia.van, dia.tot), dia.pag);
    if (dia.soort === 'uitslagen') return T.uitslagen(m);
    return T.dia(m, dia.x);
  }
  function teken(metOvergang){
    if (!T || !m) return;
    const k = T.kader(m);
    if (k !== kaderNu){ kaderNu = k; kader.innerHTML = k; }
    const reeks = diaReeks(m, T.per || 6), dia = (vast && kiesVast(reeks)) || reeks[tik % reeks.length];
    const sleutel = dia.soort + (dia.van ?? '') + (dia.x?.id ?? dia.x?.titel ?? ''), html = diaHtml(dia);
    const nieuweDia = metOvergang || sleutel !== sleutelNu;
    if (!nieuweDia && html === beeldNu){ zetKlok(); return; }
    beeldNu = html; sleutelNu = sleutel;
    const scene = document.createElement('div');
    scene.className = `ts-scene ts-${dia.soort} ${nieuweDia ? 'ts-in' : 'ts-stil'}`; scene.innerHTML = html;
    if (nieuweDia){
      scenes.querySelectorAll('.ts-scene').forEach(s => { s.classList.remove('ts-in', 'ts-stil'); s.classList.add('ts-uit'); setTimeout(() => s.remove(), 1600); });
      fx.innerHTML = T.fx ? T.fx() : '';
    } else scenes.replaceChildren();
    scenes.appendChild(scene);
    zetKlok();
  }
  /* Ontwerpen in de app: één soort dia vasthouden (programma, uitslagen, of een sponsor of eigen scherm op id). */
  function kiesVast(reeks){
    if (vast.soort === 'dia') return reeks.find(d => d.soort === 'dia' && d.x.id === vast.id) || (m.dias.find(x => x.id === vast.id) ? { soort: 'dia', x: m.dias.find(x => x.id === vast.id) } : null);
    return reeks.find(d => d.soort === vast.soort) || reeks.find(d => d.soort === 'programma');
  }
  function volgende(){ tik++; wissel = Date.now(); teken(true); }
  function toonGoal(){
    if (!T || !m || Date.now() < goalTot || !wachtrij.length) return;
    const g = wachtrij.shift();
    goalTot = Date.now() + 9000;
    const band = goalBand(g);
    goalEl.innerHTML = T.goal(m, g) + band; goalEl.classList.toggle('ts-metband', !!band); goalEl.classList.remove('aan'); void goalEl.offsetWidth; goalEl.classList.add('aan');
    setTimeout(() => { goalEl.classList.remove('aan'); goalEl.innerHTML = ''; wissel = Date.now(); toonGoal(); }, 9000);
  }
  const lus = setInterval(() => { if (T && m && !vast && Date.now() >= goalTot && Date.now() - wissel >= (T.duur || 12000)) volgende(); }, 500);

  return {
    /* Nieuw sjabloon of nieuwe gegevens. */
    zet(sjabloon, model){
      const ander = sjabloon !== T; T = sjabloon; m = model;
      if (ander){
        document.getElementById('tsSjabloon')?.remove();
        const s = document.createElement('style'); s.id = 'tsSjabloon'; s.textContent = T.css || ''; document.head.appendChild(s);
        stage.className = `ts-stage ts-${T.id}`; kaderNu = ''; beeldNu = ''; sleutelNu = ''; scenes.replaceChildren(); wissel = Date.now();
      }
      stage.style.setProperty('--club', m.kleur); stage.style.setProperty('--club-ink', inktOp(m.kleur));
      stage.classList.toggle('ts-licht', inktOp(m.kleur) !== '#ffffff');   /* lichte clubkleur: een sjabloon kan daar rekening mee houden */
      teken(ander);
    },
    /* Scoren er teams tegelijk, dan komen de doelpunten na elkaar: elk zijn volle tijd. */
    goal(g){ if (wachtrij.length < 8) wachtrij.push(g); toonGoal(); },
    /* null: de dia's wisselen weer vanzelf. */
    vast(keuze){ vast = keuze && keuze.soort ? keuze : null; teken(true); },
    stop(){ clearInterval(lus); clearInterval(klokTimer); removeEventListener('resize', schaal); },
  };
}

/* Voorbeeld zonder echte wedstrijden (?proef=1): een zaterdag rond het huidige uur, met een wedstrijd waarin om de
   halve minuut een doelpunt valt. stap telt op bij elke verversing. */
export function proefProgramma(nu = new Date(), stap = 0){
  const u = Math.min(20, Math.max(9, nu.getHours())), t = (du, mm) => `${String(u + du).padStart(2, '0')}:${mm}`;
  const g = Math.floor(stap / 3), sA = 1 + Math.ceil(g / 2), sB = Math.floor(g / 2);
  return [
    { tijd: t(-1, '00'), thuis: true, a: 'JO8-1', b: 'VV Hulsberg JO8-2', veld: 'Veld 2', kk: '1', stand: '6 - 4', eind: true, bezig: false },
    { tijd: t(-1, '00'), thuis: false, a: 'Schinveld JO9-1', b: 'JO9-2', veld: '', kk: '', stand: '3 - 3', eind: true, bezig: false },
    { tijd: t(0, '00'), thuis: true, a: 'JO11-1', b: 'RKSV Minor JO11-1', veld: 'Veld 1', kk: '3', stand: `${sA} - ${sB}`, eind: false, bezig: true, klok: true,
      goals: Array.from({ length: sA + sB }, (_, i) => i % 2 === 0 ? { m: 4 + i * 7, k: 'a', n: PROEF_NAMEN[i % PROEF_NAMEN.length], ...(i % 4 === 0 ? { as: PROEF_NAMEN[(i + 1) % PROEF_NAMEN.length] } : {}) } : { m: 4 + i * 7, k: 'b' }) },
    { tijd: t(0, '00'), thuis: true, a: 'MO13-1', b: 'Sporting Heerlen MO13-1', veld: 'Veld 3', kk: '4', stand: '0 - 0', eind: false, bezig: true },
    { tijd: t(1, '00'), thuis: true, a: 'JO13-2', b: 'FC Geleen-Zuid JO13-1', veld: '', kk: '', stand: '', eind: false, bezig: false, afgelast: true },
    { tijd: t(1, '30'), thuis: true, a: 'JO15-1', b: 'SVN JO15-1', veld: 'Veld 2', kk: '5', stand: '', eind: false, bezig: false },
    { tijd: t(3, '30'), thuis: true, a: 'Cluppie 1', b: "Fortuna '54 1", veld: 'Hoofdveld', kk: '1', stand: '', eind: false, bezig: false },
  ];
}
const PROEF_NAMEN = ['Daan', 'Sem', 'Noor', 'Finn', 'Mila', 'Jesse'];
export const PROEF_DIAS = [
  { id: 'p1', soort: 'sponsor', pakket: 'hoofd', titel: 'Bakkerij Jansen', tekst: 'Vers van de warme bakker. Dorpsstraat 12.', img: '' },
  { id: 'p2', soort: 'sponsor', pakket: 'sponsor', titel: 'Café De Kroon', tekst: 'Na de wedstrijd een rondje?', img: '' },
  { id: 'p3', soort: 'sponsor', pakket: 'sponsor', titel: 'Garage Peters', tekst: '', img: '' },
  { id: 'p4', soort: 'scherm', pakket: '', titel: 'Kantine', tekst: 'Tosti € 2,50 · koffie € 1,80 · erwtensoep € 3,50', img: '' },
];

function stijl(){
  if (document.getElementById('tsStijl')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'fonts/tv/tv-fonts.css'; document.head.appendChild(l);
  const s = document.createElement('style'); s.id = 'tsStijl';
  s.textContent = `
html.ts-html,html.ts-html body{height:100%;overflow:hidden;background:#000;margin:0}
.ts-kast{position:fixed;inset:0;background:#000;overflow:hidden;z-index:5}
.ts-stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;overflow:hidden;transform:translate(-50%,-50%) scale(var(--ts-s,1));color:#fff;
  --club:#c8102e;--club-ink:#fff;--club-d:color-mix(in oklab,var(--club) 55%,#000);--club-dd:color-mix(in oklab,var(--club) 26%,#06070a);--club-l:color-mix(in oklab,var(--club) 72%,#fff);
  --ts-display:'Barlow Condensed','Arial Narrow',Impact,sans-serif;--ts-body:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-family:var(--ts-body);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;line-height:1.2}
.ts-stage *{box-sizing:border-box}
.ts-stage h1,.ts-stage h2,.ts-stage h3,.ts-stage h4,.ts-stage p{margin:0}
.ts-kader,.ts-scenes,.ts-scene{position:absolute;inset:0}
.ts-fx,.ts-goal{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.ts-fx{z-index:60}.ts-goal{z-index:80;display:none}.ts-goal.aan{display:block;animation:tsWeg .5s ease-in 8.5s both}
.ts-in{z-index:2}.ts-uit{z-index:1;pointer-events:none}
.ts-a{animation-fill-mode:both;animation-delay:calc(var(--b,0ms) + var(--i,0) * 80ms);animation-timing-function:cubic-bezier(.2,.8,.2,1)}
.ts-in{--b:450ms}
.ts-abs{position:absolute}
.ts-kap{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ts-stip{display:inline-block;width:.5em;height:.5em;border-radius:50%;background:#ff3b30;box-shadow:0 0 0 0 rgba(255,59,48,.6);animation:tsPuls 1.6s infinite;vertical-align:middle;flex:none}
@keyframes tsPuls{0%{box-shadow:0 0 0 0 rgba(255,59,48,.6)}100%{box-shadow:0 0 0 .6em rgba(255,59,48,0)}}
@keyframes tsWeg{to{opacity:0}}
@keyframes tsLint{to{transform:translateX(-50%)}}
.ts-lintw{overflow:hidden;white-space:nowrap;min-width:0}
.ts-lint{display:inline-flex;white-space:nowrap;animation:tsLint 36s linear infinite}
.ts-beeld{background:#fff;border-radius:18px;padding:22px 28px;display:inline-flex;align-items:center;justify-content:center}
.ts-beeld img{display:block;max-width:100%;max-height:100%;object-fit:contain}
.ts-regel{display:block;overflow:hidden}.ts-regel>span{display:block}
@media (prefers-reduced-motion:reduce){.ts-stage *,.ts-stage *::before,.ts-stage *::after{animation-duration:1ms!important;animation-delay:0ms!important;animation-iteration-count:1!important}}`;
  document.head.appendChild(s);
}
