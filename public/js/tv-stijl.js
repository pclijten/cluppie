/* ==================== TV-WEERGAVE "TACTISCH BORD" [20261126n] ====================
   Gedeeld door de toernooi-tv (live-boot.js, ?live=<id>&tv=1) en de kantine-tv (scherm-boot.js, ?scherm=<id>).
   Dezelfde beeldtaal als het opstart-laadscherm in index.html: verloop in de clubkleur, stippenraster,
   witte tactische lijnen en passlijnen waar een bal overheen loopt.

   Zo blijft het beeld rustig terwijl het leeft:
   - tvZet() vervangt alleen de delen ([data-tv="…"]) die echt veranderd zijn. Een nieuw deel komt binnen
     met een animatie; wat gelijk blijft (het bord, de lopende tekst, de sponsorband) loopt gewoon door.
   - de klok tikt los van de rest (dubbele punt knippert), dus de pagina hoeft niet elke minuut opnieuw.
   - verandert een stand ([data-tv-stand]), dan licht die rij even op.
   - te lange mededelingen en sponsorrijen lopen als een band door het beeld.
   Geen externe bestanden; de lettertypen komen uit fonts/fonts.css. */

const doelGezien = new Map();
let klokLoopt = false;

/* Het bord achter alles: stippen, veldlijnen en drie passlijnen met een bal. Verandert nooit. */
export function bordHtml(){
  return `<div class="kb-bord" data-tv="bord" aria-hidden="true"><div class="kb-gloed"></div><div class="kb-raster"></div>
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <g class="kb-veld"><rect x="70" y="60" width="1460" height="780" rx="4"/><line x1="800" y1="60" x2="800" y2="840"/><circle cx="800" cy="450" r="150"/>
        <rect x="70" y="250" width="200" height="400"/><rect x="1330" y="250" width="200" height="400"/><path d="M270 370 A 110 110 0 0 1 270 530"/><path d="M1330 370 A 110 110 0 0 0 1330 530"/></g>
      <line class="kb-schuin" x1="260" y1="900" x2="1340" y2="0"/>
      <path id="tvPass1" class="kb-pass" d="M 300 690 Q 470 470 700 430"/>
      <path id="tvPass2" class="kb-pass" d="M 700 430 Q 980 240 1240 300"/>
      <path id="tvPass3" class="kb-pass" d="M 1240 300 Q 1210 560 1010 700"/>
      <g class="kb-speler"><circle cx="300" cy="690" r="13"/><circle class="kb-ring" cx="300" cy="690" r="13"/></g>
      <g class="kb-speler"><circle cx="700" cy="430" r="13"/><circle class="kb-ring" cx="700" cy="430" r="13" style="animation-delay:-1.3s"/></g>
      <g class="kb-speler"><circle cx="1240" cy="300" r="13"/><circle class="kb-ring" cx="1240" cy="300" r="13" style="animation-delay:-2.6s"/></g>
      <g class="kb-speler"><circle cx="1010" cy="700" r="13"/><circle class="kb-ring" cx="1010" cy="700" r="13" style="animation-delay:-.6s"/></g>
      <g class="kb-tegen"><path d="M 520 300 l 16 16 m 0 -16 l -16 16"/><path d="M 960 520 l 16 16 m 0 -16 l -16 16"/><path d="M 1120 180 l 16 16 m 0 -16 l -16 16"/></g>
      <circle class="kb-bal" r="8"><animateMotion dur="10.5s" repeatCount="indefinite" keyPoints="0;0;.333;.333;.666;.666;1" keyTimes="0;.12;.33;.45;.66;.78;1" calcMode="linear" path="M 300 690 Q 470 470 700 430 Q 980 240 1240 300 Q 1210 560 1010 700"/></circle>
    </svg></div>`;
}

/* Logo in een witte tegel met een draaiende ring eromheen, zoals het app-icoon op het laadscherm. */
export const logoHtml = img => img ? `<div class="kb-logo"><svg viewBox="0 0 100 100"><circle class="kb-logo-bg" cx="50" cy="50" r="48"/><circle class="kb-logo-vol" cx="50" cy="50" r="48"/></svg><span>${img}</span></div>` : '';

/* Balkje dat in `sec` seconden volloopt: laat zien wanneer het volgende scherm komt. */
export const tikHtml = (aantal, nu, sec) => aantal > 1 ? `<div class="kb-tik"><i style="--tik:${sec}s"></i><span>${Array.from({ length: aantal }, (_, i) => `<b class="${i === nu ? 'aan' : ''}"></b>`).join('')}</span></div>` : '';

/* Zet de tv-html neer, maar vervang alleen de delen ([data-tv], niet genest) die veranderd zijn.
   Verandert het geraamte eromheen (een deel erbij of eraf, andere clubkleur), dan alles opnieuw. */
export function tvZet(el, html){
  const t = document.createElement('template'); t.innerHTML = html.trim();
  const nieuw = t.content.firstElementChild; if (!nieuw) return;
  const delen = [...nieuw.querySelectorAll('[data-tv]')], teksten = delen.map(n => n.outerHTML);
  const geraamte = (() => { const k = nieuw.cloneNode(true); k.querySelectorAll('[data-tv]').forEach(n => n.replaceChildren()); return k.outerHTML; })();
  const oud = el.firstElementChild, st = el._tv;
  if (!oud || !st || !oud.classList.contains('lv-tv') || st.geraamte !== geraamte){
    el.replaceChildren(nieuw);
    el._tv = { geraamte, teksten };
    bereid(nieuw, true);
    return;
  }
  const oudeDelen = [...oud.querySelectorAll('[data-tv]')];
  delen.forEach((n, i) => { if (st.teksten[i] !== teksten[i]){ oudeDelen[i].replaceWith(n); bereid(n, false); } });
  st.teksten = teksten;
  doelpunten(oud);
}

function bereid(n, alles){
  n.querySelectorAll('.kb-wed, .kb-stand tbody tr').forEach((r, i) => r.style.setProperty('--i', i));
  if (alles) doelpunten(n);
  klok();
  const loop = () => n.querySelectorAll('.kb-loop').forEach(lint);
  (document.fonts?.ready || Promise.resolve()).then(loop);
  n.querySelectorAll('[data-tv-van]').forEach(ronde);
}

/* Een band die doorloopt als de inhoud niet past (mededelingen, sponsoren). */
function lint(l){
  if (l.dataset.klaar) return;
  const ruimte = l.parentElement.clientWidth, breed = l.scrollWidth;
  if (!ruimte || !breed) return;
  l.dataset.klaar = '1';
  if (breed <= ruimte) return;
  const kopie = l.innerHTML;
  l.insertAdjacentHTML('beforeend', `<span class="kb-kopie" aria-hidden="true">${kopie}</span>`);
  l.style.setProperty('--duur', `${Math.max(12, Math.round(breed / 70))}s`);
  l.classList.add('loopt');
}

/* Speelronde: balk die meeloopt met de klok, van begin tot eind van de ronde. */
function ronde(r){
  const van = Number(r.dataset.tvVan), tot = Number(r.dataset.tvTot), nu = Date.now();
  if (!(tot > van)) return;
  const deel = Math.min(1, Math.max(0, (nu - van) / (tot - van)));
  r.style.setProperty('--van', deel.toFixed(4));
  r.style.setProperty('--rest', `${Math.max(0, (tot - nu) / 1000).toFixed(1)}s`);
}

/* Is een stand veranderd sinds de vorige keer? Dan licht de rij op. De eerste keer niet. */
function doelpunten(root){
  root.querySelectorAll('[data-tv-k]').forEach(r => {
    const k = r.dataset.tvK, s = r.dataset.tvStand || '';
    if (doelGezien.has(k) && doelGezien.get(k) !== s && s){ r.classList.remove('kb-goal'); void r.offsetWidth; r.classList.add('kb-goal'); }
    doelGezien.set(k, s);
  });
}

function klok(){
  const zet = () => {
    const d = new Date(), u = String(d.getHours()).padStart(2, '0'), m = String(d.getMinutes()).padStart(2, '0');
    document.querySelectorAll('[data-tv-klok]').forEach(k => { if (k.dataset.tijd !== u + m){ k.dataset.tijd = u + m; k.innerHTML = `${u}<span class="kb-dp">:</span>${m}`; } });
  };
  zet();
  if (!klokLoopt){ klokLoopt = true; setInterval(zet, 1000); }
}

export function tvStijl(){
  if (document.getElementById('tvStijl')) return;
  const s = document.createElement('style'); s.id = 'tvStijl';
  s.textContent = `
html.lv-tv-html,html.lv-tv-html body{height:100%;overflow:hidden;background:#0b0d10}
.lv-tv{--accent:#cc2620;--tv-wit:#fdfdfe;--tv-zacht:rgba(253,253,254,.72);--tv-lijn:rgba(255,255,255,.14);--tv-paneel:rgba(9,11,15,.68);--tv-paneel-rand:rgba(255,255,255,.12);
  --tv-boven:color-mix(in srgb,var(--accent) 88%,#fff 12%);--tv-midden:color-mix(in srgb,var(--accent) 72%,#07080a 28%);--tv-onder:color-mix(in srgb,var(--accent) 22%,#07080a 78%);
  --ink:var(--tv-wit);--ink-2:var(--tv-zacht);--hair:var(--tv-lijn);
  position:relative;isolation:isolate;max-width:none;height:100vh;box-sizing:border-box;margin:0;padding:2.4vh 2.4vw;gap:1.8vh;overflow:hidden;
  display:flex;flex-direction:column;color:var(--tv-wit);font-size:clamp(16px,1.25vw,30px);-webkit-font-smoothing:antialiased;
  background:var(--accent);background:linear-gradient(150deg,var(--tv-boven) 0%,var(--tv-midden) 34%,var(--tv-onder) 78%,#07080a 100%)}
.lv-tv[data-licht]{--tv-boven:color-mix(in srgb,var(--accent) 62%,#07080a 38%);--tv-midden:color-mix(in srgb,var(--accent) 45%,#07080a 55%);--tv-onder:color-mix(in srgb,var(--accent) 16%,#07080a 84%)}
.lv-tv>*{position:relative;z-index:1}
/* --- het bord --- */
.lv-tv>.kb-bord{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.kb-gloed{position:absolute;width:70vw;height:70vw;left:-18vw;top:-38vw;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.16),transparent 62%);animation:tvGloed 18s ease-in-out infinite alternate}
.kb-raster,.kb-bord svg{position:absolute;inset:0;-webkit-mask-image:radial-gradient(ellipse 75% 80% at 50% 45%,#000 30%,transparent 92%);mask-image:radial-gradient(ellipse 75% 80% at 50% 45%,#000 30%,transparent 92%)}
.kb-raster{background-image:radial-gradient(rgba(255,255,255,.1) 1.2px,transparent 1.2px);background-size:28px 28px;animation:tvRaster 40s linear infinite}
.kb-bord svg{width:100%;height:100%;display:block}
.kb-veld *{fill:none;stroke:rgba(255,255,255,.075);stroke-width:2}
.kb-schuin{stroke:rgba(255,255,255,.08);stroke-width:2}
.kb-pass{fill:none;stroke:rgba(255,255,255,.26);stroke-width:2.4;stroke-dasharray:10 10;animation:tvPass 2.6s linear infinite}
.kb-speler circle{fill:rgba(255,255,255,.2);stroke:rgba(255,255,255,.55);stroke-width:2.4}
.kb-speler .kb-ring{fill:none;stroke:rgba(255,255,255,.5);transform-box:fill-box;transform-origin:center;animation:tvRing 3.9s ease-out infinite}
.kb-tegen path{stroke:rgba(255,255,255,.3);stroke-width:3;stroke-linecap:round;fill:none}
.kb-bal{fill:var(--tv-wit);filter:drop-shadow(0 0 6px rgba(255,255,255,.7))}
@keyframes tvPass{to{stroke-dashoffset:-40}}
@keyframes tvRing{0%{transform:scale(1);opacity:.7}70%,100%{transform:scale(3.2);opacity:0}}
@keyframes tvGloed{to{transform:translate(30vw,18vw) scale(1.2)}}
@keyframes tvRaster{to{background-position:280px 0}}
/* --- kop --- */
.kb-kop{display:flex;align-items:center;gap:1.6vw;animation:tvOp .7s cubic-bezier(.16,1,.3,1) both}
.kb-logo{position:relative;flex-shrink:0;width:clamp(72px,9.5vh,140px);aspect-ratio:1;display:grid;place-items:center}
.kb-logo svg{position:absolute;inset:-9%;width:118%;height:118%;overflow:visible;transform:rotate(-90deg)}
.kb-logo-bg,.kb-logo-vol{fill:none;stroke-width:2.2}.kb-logo-bg{stroke:rgba(255,255,255,.18)}
.kb-logo-vol{stroke:var(--tv-wit);stroke-linecap:round;stroke-dasharray:302;animation:tvLogoRing 7s cubic-bezier(.45,.05,.55,.95) infinite}
.kb-logo span{width:100%;height:100%;border-radius:22.5%;background:var(--tv-wit);display:grid;place-items:center;overflow:hidden;box-shadow:0 18px 36px -10px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.25)}
.kb-logo img{width:82%;height:82%;object-fit:contain;display:block}
@keyframes tvLogoRing{0%{stroke-dashoffset:302}50%{stroke-dashoffset:60}100%{stroke-dashoffset:-302}}
.kb-titel{flex:1;min-width:0}
.kb-titel small{display:flex;align-items:center;gap:.8em;font-size:.95em;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-zacht)}
.lv-tv h1{font-family:var(--font-display);font-weight:800;text-transform:uppercase;font-size:clamp(38px,4.6vw,110px);line-height:.92;margin:.08em 0 0;letter-spacing:.02em;text-shadow:0 4px 24px rgba(0,0,0,.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kb-livepil{display:inline-flex;align-items:center;gap:.45em;background:var(--tv-wit);color:#111;border-radius:999px;padding:.18em .7em;font-size:.82em;letter-spacing:.14em;font-weight:800}
.kb-livepil i{width:.6em;height:.6em;border-radius:50%;background:#e5251e;animation:tvPuls 1.4s ease-in-out infinite}
.kb-klokblok{text-align:right;flex-shrink:0}
.kb-klok{font-family:var(--font-display);font-weight:800;font-size:clamp(42px,5.4vw,128px);line-height:.9;font-variant-numeric:tabular-nums;letter-spacing:.02em;text-shadow:0 4px 24px rgba(0,0,0,.25)}
.kb-dp{animation:tvKnipper 2s steps(1) infinite;opacity:1;display:inline-block;transform:translateY(-.06em)}
.kb-klokblok small{display:block;font-size:.8em;letter-spacing:.14em;text-transform:uppercase;color:var(--tv-zacht);margin-top:.35em}
@keyframes tvKnipper{0%{opacity:1}50%{opacity:.35}}
@keyframes tvPuls{50%{opacity:.25;transform:scale(.8)}}
/* --- panelen --- */
.lv-tv .lv-banner{background:var(--tv-wit);color:#111;border-radius:14px;padding:1.2vh 1.2vw;font-size:1.2em;animation:tvOp .6s both}
.lv-tv .lv-banner.rood{background:#fff3f2;box-shadow:inset .4em 0 0 #e5251e}
.kb-main{flex:1;min-height:0;display:grid;grid-template-columns:1.12fr 1fr;gap:1.6vw}
.kb-kolom{display:flex;flex-direction:column;gap:1.6vh;min-height:0;overflow:hidden}
.kb-paneel{background:var(--tv-paneel);border:1px solid var(--tv-paneel-rand);border-radius:20px;padding:2vh 1.4vw;display:flex;flex-direction:column;gap:.5vh;min-height:0;overflow:hidden;
  box-shadow:0 30px 60px -30px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);animation:tvPaneel .8s cubic-bezier(.16,1,.3,1) both}
.kb-kolom>.kb-paneel:nth-child(2){animation-delay:.12s}
.kb-paneel>.kb-paneel{background:none;border:0;box-shadow:none;padding:0;animation:none}
.kb-paneel h2{font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:1.5em;line-height:1;margin:0 0 .3em;display:flex;align-items:center;gap:.45em}
.kb-paneel h2+h2,.kb-wed+h2{margin-top:.7em}
.kb-paneel h2 small{margin-left:auto;font-family:inherit;font-size:.8em;color:var(--tv-wit);background:rgba(255,255,255,.12);border-radius:10px;padding:.12em .45em;font-variant-numeric:tabular-nums;letter-spacing:.04em}
.kb-paneel p{margin:0}
.kb-paneel .lv-live{width:.55em;height:.55em;background:#ff3b30;box-shadow:0 0 0 0 rgba(255,59,48,.6);animation:tvLive 1.6s infinite}
@keyframes tvLive{0%{box-shadow:0 0 0 0 rgba(255,59,48,.55)}80%,100%{box-shadow:0 0 0 .7em rgba(255,59,48,0)}}
.kb-stip{width:.55em;height:.55em;border-radius:50%;background:var(--pk);box-shadow:0 0 0 .18em color-mix(in srgb,var(--pk) 35%,transparent);display:inline-block;flex-shrink:0}
@keyframes tvOp{0%{opacity:0;transform:translateY(-.6em)}100%{opacity:1;transform:none}}
@keyframes tvPaneel{0%{opacity:0;transform:translateY(1.4em) scale(.985);clip-path:inset(0 0 100% 0 round 20px)}100%{opacity:1;transform:none;clip-path:inset(0 0 0 0 round 20px)}}
/* --- speelronde --- */
.kb-ronde{flex-shrink:0;height:.32em;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin:-.1em 0 .5em}
.kb-ronde i{display:block;height:100%;background:linear-gradient(90deg,var(--tv-wit),color-mix(in srgb,var(--accent) 30%,#fff));transform-origin:left;transform:scaleX(var(--van,0));animation:tvRonde var(--rest,0s) linear forwards;border-radius:inherit}
@keyframes tvRonde{from{transform:scaleX(var(--van,0))}to{transform:scaleX(1)}}
/* --- wedstrijden --- */
.kb-wed{position:relative;display:grid;grid-template-columns:5.2em minmax(0,1fr) 3.8em minmax(0,1fr);gap:.6em;align-items:center;font-size:1.1em;line-height:1.1;padding:.36em .6em .36em .9em;border-radius:12px;
  background:linear-gradient(90deg,rgba(255,255,255,.075),rgba(255,255,255,.03));animation:tvRij .6s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0) * 70ms + .15s)}
.kb-wed::before{content:"";position:absolute;left:0;top:.35em;bottom:.35em;width:.3em;border-radius:99px;background:var(--pk)}
.kb-wed+.kb-wed{margin-top:.28em}
.kb-wed-v{display:flex;flex-direction:column;font-size:.68em;color:var(--tv-zacht);line-height:1.2;min-width:0}
.kb-wed-v b{font-family:var(--font-display);font-weight:700;font-size:1.55em;color:var(--tv-wit);font-variant-numeric:tabular-nums;letter-spacing:.02em;display:flex;align-items:center;gap:.3em}
.kb-wed-a{text-align:right;font-weight:600;overflow-wrap:anywhere}.kb-wed-b{font-weight:600;overflow-wrap:anywhere}
.kb-wed-u{text-align:center;color:var(--tv-zacht);font-family:var(--font-display);font-weight:800;font-size:1.2em;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1;padding:.2em 0;border-radius:10px;border:1.5px dashed rgba(255,255,255,.25)}
.kb-wed-u.klaar{background:var(--tv-wit);color:#111;border:0;box-shadow:0 6px 16px -6px rgba(0,0,0,.5)}
.kb-wed.af{opacity:.45}.kb-wed.af .kb-wed-a,.kb-wed.af .kb-wed-b{text-decoration:line-through}
.kb-wed.bezig{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 40%,transparent),rgba(255,255,255,.05));box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.22)}
.kb-wed.bezig .kb-wed-v b::after{content:"";width:.32em;height:.32em;border-radius:50%;background:#ff3b30;animation:tvLive 1.6s infinite}
.kb-wed.kb-goal{animation:tvGoal 2.4s ease-out both}
.kb-wed.kb-goal .kb-wed-u{animation:tvGoalStand 2.4s cubic-bezier(.16,1,.3,1) both}
@keyframes tvRij{0%{opacity:0;transform:translateX(-1.2em)}100%{opacity:1;transform:none}}
@keyframes tvGoal{0%,30%{background:color-mix(in srgb,#fff 34%,transparent)}100%{background:linear-gradient(90deg,rgba(255,255,255,.075),rgba(255,255,255,.03))}}
@keyframes tvGoalStand{0%{transform:scale(1)}15%{transform:scale(1.35)}35%{transform:scale(.95)}50%,100%{transform:scale(1)}}
.kb-leeg{font-size:1.4em;color:var(--tv-zacht);margin:auto 0}
/* --- stand --- */
.kb-stand{width:100%;border-collapse:separate;border-spacing:0 .28em;font-size:1.12em;font-variant-numeric:tabular-nums}
.kb-stand th{color:var(--tv-zacht);font-weight:600;font-size:.72em;letter-spacing:.08em;text-transform:uppercase;padding:0 .45em;text-align:center}
.kb-stand td{padding:.42em .45em;text-align:center;background:rgba(255,255,255,.06)}
.kb-stand td:first-child{border-radius:10px 0 0 10px;width:2.2em}.kb-stand td:last-child{border-radius:0 10px 10px 0}
.kb-stand td:nth-child(2),.kb-stand th:nth-child(2){text-align:left;width:100%;font-weight:600}
.kb-stand td:first-child span{display:inline-grid;place-items:center;width:1.6em;height:1.6em;border-radius:50%;background:rgba(255,255,255,.12);font-family:var(--font-display);font-weight:800}
.kb-stand tbody tr{animation:tvRij .6s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0) * 70ms + .2s)}
.kb-stand tbody tr:first-child td{background:rgba(255,255,255,.16)}
.kb-stand tbody tr:first-child td:first-child span{background:var(--tv-wit);color:#111}
.kb-stand td:last-child b{font-family:var(--font-display);font-weight:800;font-size:1.25em}
/* --- dia's --- */
.kb-dia{flex:1;align-items:center;justify-content:center;text-align:center;gap:2.2vh;position:relative}
.kb-dia::before{content:"";position:absolute;width:62%;aspect-ratio:1;border-radius:50%;border:2px solid rgba(255,255,255,.08);left:50%;top:50%;transform:translate(-50%,-50%);animation:tvDiaRing 12s linear infinite}
.kb-dia::after{content:"";position:absolute;width:140%;height:2px;background:rgba(255,255,255,.07);left:-20%;top:50%;transform:rotate(-32deg)}
.kb-dia>*{position:relative;z-index:1}
.kb-dia small{font-size:.95em;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-zacht);font-weight:600;animation:tvOp .6s .2s both}
.kb-dia h2{font-size:3em;justify-content:center;margin:0;animation:tvOp .7s .3s both}
.kb-dia p{font-size:1.6em;line-height:1.3;white-space:pre-line;max-width:28em;color:var(--tv-zacht);animation:tvOp .7s .4s both}
.kb-dia-img{background:var(--tv-wit);border-radius:22px;padding:2.4vh 2.4vw;max-width:90%;box-shadow:0 30px 60px -24px rgba(0,0,0,.6);animation:tvPop .8s cubic-bezier(.16,1,.3,1) .15s both}
.kb-dia-img img{max-height:36vh;max-width:34vw;object-fit:contain;display:block}
.kb-dia.sponsor h2{font-size:3.4em}
.kb-welkom .kb-logo{width:clamp(110px,16vh,220px);animation:tvPop .9s cubic-bezier(.16,1,.3,1) .1s both}
@keyframes tvPop{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:none}}
@keyframes tvDiaRing{to{transform:translate(-50%,-50%) rotate(360deg)}}
/* --- wisselen: balkje dat volloopt en bolletjes --- */
.kb-tik{flex-shrink:0;display:flex;align-items:center;gap:1em;margin-top:auto;padding-top:1vh}
.kb-tik>i{flex:1;height:.22em;border-radius:99px;background:rgba(255,255,255,.12);position:relative;overflow:hidden}
.kb-tik>i::after{content:"";position:absolute;inset:0;background:var(--tv-wit);transform-origin:left;animation:tvTik var(--tik,12s) linear both}
.kb-tik span{display:flex;gap:.4em}.kb-tik b{width:.5em;height:.5em;border-radius:50%;background:rgba(255,255,255,.25);transition:all .3s}.kb-tik b.aan{background:var(--tv-wit);width:1.3em;border-radius:99px}
@keyframes tvTik{from{transform:scaleX(0)}to{transform:scaleX(1)}}
/* --- sponsoren en lopende band --- */
.kb-spons{display:flex;align-items:center;gap:1.2vw;animation:tvOp .7s .3s both}
.kb-spons>small{flex-shrink:0;font-size:.8em;letter-spacing:.16em;text-transform:uppercase;color:var(--tv-zacht);font-weight:600;writing-mode:horizontal-tb}
.kb-lint{flex:1;min-width:0;overflow:hidden}.kb-lint:has(.loopt){-webkit-mask-image:linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent);mask-image:linear-gradient(90deg,transparent,#000 3%,#000 97%,transparent)}
.kb-loop{display:flex;width:max-content;gap:var(--gap,1vw);align-items:center}
.kb-loop.loopt{animation:tvLoop var(--duur,30s) linear 2.5s infinite}
.kb-loop>.kb-kopie{display:contents}
@keyframes tvLoop{to{transform:translateX(calc(-50% - var(--gap,1vw) / 2))}}
.kb-sponsor{background:var(--tv-wit);color:#111;border-radius:14px;height:9vh;min-width:9vw;padding:1vh 1.4vw;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.15em;flex-shrink:0;position:relative;overflow:hidden}
.kb-sponsor img{max-height:100%;max-width:14vw;object-fit:contain;display:block}
.kb-sponsor::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.75) 50%,transparent 60%);transform:translateX(-120%);animation:tvGlans 7s ease-in-out infinite;animation-delay:calc(var(--i,0) * .9s)}
@keyframes tvGlans{0%,70%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
.kb-voet{display:flex;align-items:stretch;gap:1.4vw;animation:tvOp .7s .4s both}
.kb-qr{flex-shrink:0;display:flex;align-items:center;gap:.8em;background:var(--tv-wit);color:#111;border-radius:14px;padding:.6vh .9vw .6vh .6vh}
.kb-qr svg{display:block;width:clamp(70px,8.5vh,130px);height:auto}
.kb-qr small{font-family:var(--font-display);font-weight:800;text-transform:uppercase;font-size:1.05em;line-height:1;letter-spacing:.04em;max-width:5.5em}
.kb-ticker{flex:1;min-width:0;display:flex;align-items:center;background:var(--tv-wit);color:#111;border-radius:14px;overflow:hidden;font-size:1.35em;box-shadow:0 20px 40px -20px rgba(0,0,0,.6)}
.kb-ticker-kop{align-self:stretch;display:flex;align-items:center;gap:.45em;flex-shrink:0;background:#111;color:var(--tv-wit);font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:0 1em;font-size:.9em}
.kb-ticker-kop i{width:.5em;height:.5em;border-radius:50%;background:var(--accent);box-shadow:0 0 0 .15em rgba(255,255,255,.9);animation:tvPuls 1.6s infinite}
.kb-ticker .kb-lint{padding:1.2vh 0 1.2vh 1em}
.kb-ticker .kb-lint:has(.loopt){-webkit-mask-image:linear-gradient(90deg,#000 94%,transparent);mask-image:linear-gradient(90deg,#000 94%,transparent)}
.kb-ticker .kb-loop{--gap:3em;white-space:nowrap}
.kb-ticker .kb-loop b{font-variant-numeric:tabular-nums;color:color-mix(in srgb,var(--accent) 85%,#000)}
.kb-ticker .kb-loop span>span{display:inline-block;width:.4em;height:.4em;border-radius:50%;background:currentColor;opacity:.35;margin:0 1em;vertical-align:middle}
/* rustig voor wie dat wil (en voor goedkope tv-sticks die het systeem zo instellen) */
@media (prefers-reduced-motion: reduce){
  .lv-tv *,.lv-tv *::before,.lv-tv *::after{animation:none!important}
  .kb-bal{display:none}.kb-ronde i{transform:scaleX(var(--van,0))}}`;
  document.head.appendChild(s);
}

/* ---------- bouwstenen die beide tv's delen ---------- */
/* Clubkleur op de tv. Bij een lichte kleur (geel, lichtblauw) wordt het bord donkerder, anders is witte tekst niet te lezen. */
export function tvKleur(hex){
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const licht = .2126 * r + .7152 * g + .0722 * b > .3;
  return ` style="--accent:${hex}"${licht ? ' data-licht="1"' : ''}`;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Een sponsor of eigen scherm, groot in beeld. img is al gecontroleerd (plaatjeOk) of leeg. */
export const diaHtml = (x, boven = '') => `<section class="kb-paneel kb-dia ${x.soort === 'sponsor' ? 'sponsor' : ''}">${boven ? `<small>${esc(boven)}</small>` : ''}${x.img ? `<div class="kb-dia-img"><img src="${esc(x.img)}" alt=""></div>` : ''}${x.titel ? `<h2>${esc(x.titel)}</h2>` : ''}${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</section>`;

/* Band met sponsoren onderin; loopt door als ze niet naast elkaar passen. */
export const sponsHtml = lijst => lijst.length ? `<div class="kb-spons" data-tv="spons"><small>Met dank aan</small><div class="kb-lint"><div class="kb-loop">${lijst.map((x, i) => `<span class="kb-sponsor" style="--i:${i}">${x.img ? `<img src="${esc(x.img)}" alt="${esc(x.titel)}">` : esc(x.titel)}</span>`).join('')}</div></div></div>` : '';

/* Onderbalk: eventueel een QR-code en een lopende mededeling. regels: [{ tijd, tekst }] */
export const voetHtml = ({ qr = '', qrTekst = '', kop = 'Mededeling', regels = [] } = {}) => (qr || regels.length) ? `<footer class="kb-voet" data-tv="voet">${qr ? `<div class="kb-qr">${qr}${qrTekst ? `<small>${esc(qrTekst)}</small>` : ''}</div>` : ''}${regels.length ? `<div class="kb-ticker"><b class="kb-ticker-kop"><i></i>${esc(kop)}</b><div class="kb-lint"><div class="kb-loop"><span>${regels.map(r => `${r.tijd ? `<b>${esc(r.tijd)}</b> ` : ''}${esc(r.tekst)}`).join('<span></span>')}</span></div></div></div>` : ''}</footer>` : '';
