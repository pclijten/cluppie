/* TV-SJABLOON "VELDKAART" [20261126p]: het tactisch bord als plattegrond van het sportpark. Elk veld dat vandaag
   gebruikt wordt krijgt een eigen veldje met de wedstrijd die er nu speelt of straks begint.
   De velden komen uit het programma (het veld dat bij de wedstrijd is ingevuld); er hoeft niets ingesteld te worden.
   Overgang: de krijtlijnen tekenen zichzelf en een pass schiet over het beeld. Zie docs/tv-sjablonen.md. */
import { esc, maat, maatWoord, stip, klok, beeld, bovenSponsor } from './tv-speler.js?v=20261126p';

/* Een voetbalveld in lijnen. i: volgorde waarin de lijnen verschijnen. */
function veld(x, y, w, h, i = 0){
  const cx = x + w / 2, cy = y + h / 2, pb = h * .5, pd = w * .15;
  return `<rect class="vdk-vlak" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="vdk-ln" style="--i:${i}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>
  <line class="vdk-ln" style="--i:${i + 1}" x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h}"/><circle class="vdk-ln" style="--i:${i + 1}" cx="${cx}" cy="${cy}" r="${h * .16}"/>
  <rect class="vdk-ln" style="--i:${i + 2}" x="${x}" y="${cy - pb / 2}" width="${pd}" height="${pb}"/><rect class="vdk-ln" style="--i:${i + 2}" x="${x + w - pd}" y="${cy - pb / 2}" width="${pd}" height="${pb}"/>`;
}
/* De velden van vandaag, met per veld de wedstrijd die telt: wat nu speelt, anders wat straks komt, anders de laatste uitslag. */
function velden(m){
  const per = new Map();
  for (const r of m.rijen) if (r.thuis && r.veld && r.status !== 'af'){ if (!per.has(r.veld)) per.set(r.veld, []); per.get(r.veld).push(r); }
  return [...per.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl', { numeric: true })).slice(0, 6).map(([naam, l]) => ({ naam,
    nu: l.find(r => r.status === 'live') || l.find(r => r.status === 'straks') || l[l.length - 1], daarna: l.filter(r => r.status === 'straks').length }));
}
const RASTER = { 1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2], 5: [3, 2], 6: [3, 2] };
function kaart(m){
  const v = velden(m);
  if (!v.length) return `<div class="ts-abs vdk-kaart"><svg viewBox="0 0 1160 780">${veld(10, 10, 1140, 760)}</svg><div class="vdk-k ts-a" style="left:580px;top:390px"><div class="m">Nog geen velden ingedeeld</div><div class="x">Vul bij een wedstrijd het veld in, dan staat het hier.</div></div></div>`;
  const [kol, rij] = RASTER[v.length], w = 1160 / kol, h = 780 / rij;
  return `<div class="ts-abs vdk-kaart"><svg viewBox="0 0 1160 780">${v.map((_, i) => veld((i % kol) * w + 10, Math.floor(i / kol) * h + 10, w - 20, h - 20, i * 2)).join('')}</svg>
    ${v.map((f, i) => { const r = f.nu, x = (i % kol) * w + w / 2, y = Math.floor(i / kol) * h + h / 2;
      return `<div class="vdk-k ts-a ${r.status}" style="left:${x}px;top:${y}px;--i:${i};max-width:${w - 60}px"><div class="e">${r.status === 'live' ? stip + ' ' : ''}${esc(f.naam)} · ${r.status === 'live' ? 'live' : r.status === 'klaar' ? 'gespeeld' : esc(r.tijd)}</div>
        <div class="m"><span class="ts-kap">${esc(r.a)}</span>${r.score ? `<b>${esc(r.score)}</b>` : ''}</div><div class="m2 ts-kap">${esc(r.b)}</div><div class="x">${r.kk ? 'Kleedkamer ' + esc(r.kk) : ''}${f.daarna > (r.status === 'straks' ? 1 : 0) ? `${r.kk ? ' · ' : ''}daarna nog ${f.daarna - (r.status === 'straks' ? 1 : 0)}` : ''}</div></div>`; }).join('')}</div>`;
}
const zij = (titel, html) => `<div class="ts-abs vdk-zij"><h3 class="ts-a">${titel}</h3>${html}</div>`;

export default {
  id: 'veldkaart', per: 6, duur: 13000,
  kader: m => `<div class="vdk-bord"></div><div class="ts-abs vdk-naam">${m.logo ? `<span class="vdk-logo"><img src="${esc(m.logo)}" alt=""></span>` : ''}<div><b class="ts-kap" style="${maat(m.club, 62, 22)}">${esc(m.club)}</b><span>${esc(m.dag)}</span></div></div>
    <div class="ts-abs vdk-klok">${klok}</div>${m.med ? `<div class="ts-abs vdk-med"><b>Mededeling</b><span class="ts-kap">${esc(m.med)}</span></div>` : ''}`,
  programma: (m, rijen, pag) => kaart(m) + zij(`Vandaag${pag.van > 1 ? ` <small>${pag.nr} / ${pag.van}</small>` : ''}`,
    rijen.map((r, i) => `<div class="vdk-zr ts-a ${r.status}" style="--i:${i + 1}"><b>${esc(r.tijd || '–')}</b><span><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><small class="ts-kap">${r.status === 'live' ? `Nu ${esc(r.score || '0–0')}${r.veld ? ' · ' + esc(r.veld) : ''}` : r.status === 'klaar' ? `Gespeeld ${esc(r.score)}` : esc(r.plek)}</small></span></div>`).join('') || '<div class="vdk-zr ts-a"><span>Vandaag staan er geen wedstrijden op het programma.</span></div>'),
  uitslagen: m => { const l = m.live[0] || m.klaar[m.klaar.length - 1];
    return `<div class="ts-abs vdk-groot ts-a"><svg viewBox="0 0 1100 780">${veld(-560, 40, 1500, 700)}</svg><div class="t"><div class="e">${l.status === 'live' ? stip + ' Live' : 'Uitslag'}${l.veld ? ' · ' + esc(l.veld) : ''}</div><b>${esc(l.score || '0–0')}</b><span class="ts-kap">${esc(l.a)} – ${esc(l.b)}</span></div></div>`
    + zij('Standen en uitslagen', [...m.live, ...m.klaar].filter(r => r !== l).slice(0, 6).map((r, i) => `<div class="vdk-zr ts-a" style="--i:${i + 1}"><b>${esc(r.score || '0–0')}</b><span><span class="ts-kap">${esc(r.eigen)}</span><small class="ts-kap">${r.status === 'live' ? 'nu bezig · ' : ''}tegen ${esc(r.tegen)}</small></span></div>`).join('')); },
  dia: (m, x) => `<div class="ts-abs vdk-mid"><svg viewBox="0 0 1920 800" preserveAspectRatio="xMidYMid meet">${veld(110, 20, 1700, 760)}<circle class="vdk-ln" style="--i:3" cx="960" cy="400" r="330"/></svg>
    <div class="vdk-sp ts-a" style="--i:1">${bovenSponsor(x) ? `<div class="e">${esc(bovenSponsor(x))}</div>` : ''}${beeld(x, 'ts-beeld vdk-img')}<div class="n" style="${maatWoord(x.titel, x.img ? 100 : 170, x.img ? 16 : 10)}">${esc(x.titel)}</div>${x.tekst ? `<div class="r">${esc(x.tekst)}</div>` : ''}</div></div>`,
  goal: (m, g) => `<div class="vdk-goal"><div class="vdk-bord"></div><svg viewBox="0 0 1920 1080">${veld(-500, 90, 2300, 900)}<path class="vdk-krijt" d="M 300 860 Q 760 420 1180 560"/><path class="vdk-krijt b" d="M 1180 560 Q 1500 360 1700 520"/><circle class="vdk-doel" cx="1700" cy="520" r="26"/><circle class="vdk-golf" cx="1700" cy="520" r="26"/></svg>
    <div class="t"><b>Goal!</b><div class="w" style="${maat(g.team, 90, 20)}">${esc(g.team)}</div><div class="s"><span class="ts-kap">${esc(g.a)}</span><strong>${esc(g.stand)}</strong><span class="ts-kap">${esc(g.b)}</span></div>${g.veld ? `<div class="p">${esc(g.veld)}</div>` : ''}</div></div>`,
  fx: () => `<svg class="vdk-pass" viewBox="0 0 1920 1080"><path d="M 120 1000 Q 700 200 1820 160"/></svg><div class="vdk-bal"></div>`,
  css: `
.ts-veldkaart{background:var(--club-dd)}
.vdk-bord{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px}
.vdk-bord::after{content:"";position:absolute;inset:0;background:radial-gradient(1100px 700px at 30% 40%,color-mix(in oklab,var(--club) 40%,transparent),transparent 70%)}
.vdk-naam{left:64px;top:40px;display:flex;gap:20px;align-items:center;max-width:1400px}
.vdk-logo{width:88px;height:88px;border-radius:18px;background:#fff;display:grid;place-items:center;flex:none}.vdk-logo img{max-width:78%;max-height:78%;display:block}
.vdk-naam b{display:block;font:900 62px/.95 var(--ts-display);text-transform:uppercase;max-width:1250px}
.vdk-naam span{font:500 23px/1.4 var(--ts-body);color:rgba(255,255,255,.72)}
.vdk-klok{right:64px;top:40px;font:800 92px/1 var(--ts-display)}
.vdk-med{left:64px;right:64px;bottom:36px;height:72px;display:flex;align-items:center;gap:20px;border-top:2px solid rgba(255,255,255,.2);font:600 30px/1 var(--ts-body)}
.vdk-med b{font:800 30px/1 var(--ts-display);text-transform:uppercase;letter-spacing:.06em;background:#fff;color:#111;padding:8px 14px;border-radius:6px;flex:none}
.vdk-kaart{left:64px;top:172px;width:1160px;height:780px}
.vdk-kaart svg,.vdk-groot svg,.vdk-mid svg{position:absolute;inset:0;width:100%;height:100%}
.vdk-ln{fill:none;stroke:rgba(255,255,255,.55);stroke-width:3;stroke-dasharray:5000;stroke-dashoffset:0}
.vdk-vlak{fill:rgba(255,255,255,.04)}
.vdk-k{position:absolute;transform:translate(-50%,-50%);background:rgba(6,8,10,.88);border:2px solid rgba(255,255,255,.22);border-radius:16px;padding:16px 22px;min-width:300px;width:max-content}
.vdk-k .e{font:700 19px/1 var(--ts-body);letter-spacing:.1em;text-transform:uppercase;color:var(--club-l);display:flex;gap:10px;align-items:center}
.vdk-k .m{font:800 38px/1.1 var(--ts-display);text-transform:uppercase;margin-top:8px;display:flex;gap:10px;align-items:center;min-width:0}
.vdk-k .m b{background:#fff;color:#111;border-radius:6px;padding:0 10px;flex:none;margin-left:auto}.vdk-k .m2{font:700 30px/1.15 var(--ts-display);text-transform:uppercase;color:rgba(255,255,255,.85)}
.vdk-k .x{font:500 21px/1.3 var(--ts-body);color:rgba(255,255,255,.75);margin-top:6px}.vdk-k .x:empty{display:none}
.vdk-k.live{border-color:var(--club-l);box-shadow:0 0 0 4px color-mix(in oklab,var(--club) 50%,transparent)}
.vdk-zij{left:1268px;top:178px;width:588px;display:grid;gap:13px}
.vdk-zij h3{font:800 44px/1 var(--ts-display);text-transform:uppercase;display:flex;justify-content:space-between;align-items:baseline}.vdk-zij h3 small{font:600 24px/1 var(--ts-body);opacity:.7}
.vdk-zr{display:grid;grid-template-columns:110px minmax(0,1fr);gap:16px;align-items:center;background:rgba(6,8,10,.5);border-radius:14px;padding:17px 20px;border:1px solid rgba(255,255,255,.12)}
.vdk-zr b{font:800 40px/1 var(--ts-display)}
.vdk-zr>span{font:600 27px/1.15 var(--ts-body);min-width:0;display:block}
.vdk-zr small{display:block;font:500 20px/1.3 var(--ts-body);color:rgba(255,255,255,.7)}
.vdk-zr.af>span>.ts-kap{text-decoration:line-through;color:rgba(255,255,255,.6)}
.vdk-groot{left:64px;top:172px;width:1100px;height:780px;border-radius:24px;background:rgba(6,8,10,.55);border:2px solid rgba(255,255,255,.18);overflow:hidden}
.vdk-groot .t{position:absolute;left:56px;right:56px;bottom:48px}
.vdk-groot .e{font:700 26px/1 var(--ts-body);letter-spacing:.1em;text-transform:uppercase;color:var(--club-l);display:flex;gap:12px;align-items:center}
.vdk-groot .t b{display:block;font:900 300px/.86 var(--ts-display)}
.vdk-groot .t span{display:block;font:700 44px/1.2 var(--ts-display);text-transform:uppercase;color:rgba(255,255,255,.88)}
.vdk-mid{left:0;right:0;top:150px;bottom:130px}
.vdk-sp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;width:1100px}
.vdk-sp .e{font:700 24px/1 var(--ts-body);letter-spacing:.16em;text-transform:uppercase;color:var(--club-l)}
.vdk-sp .n{font:900 170px/.88 var(--ts-display);text-transform:uppercase;margin:16px 0}
.vdk-sp .r{font:600 34px/1.3 var(--ts-body);white-space:pre-line}
.vdk-img{height:240px;max-width:640px;margin-top:18px}
.ts-veldkaart .ts-in .vdk-ln{animation:vdkTeken 1.3s ease both;animation-delay:calc(250ms + var(--i,0) * 70ms)}
.ts-veldkaart .ts-in .vdk-k,.ts-veldkaart .ts-in .vdk-sp{animation-name:vdkPop;animation-duration:.55s;--b:700ms}
.ts-veldkaart .ts-in .vdk-zr,.ts-veldkaart .ts-in .vdk-zij h3,.ts-veldkaart .ts-in .vdk-groot{animation-name:vdkOp;animation-duration:.55s;--b:600ms}
.ts-veldkaart .ts-uit{animation:tsWeg .35s both}
@keyframes vdkTeken{from{stroke-dashoffset:5000}}
@keyframes vdkPop{from{opacity:0;transform:translate(-50%,-50%) scale(.85)}}
@keyframes vdkOp{from{opacity:0;transform:translateY(30px)}}
.vdk-pass{position:absolute;inset:0;width:100%;height:100%}
.vdk-pass path{fill:none;stroke:#fff;stroke-width:5;stroke-dasharray:16 16;stroke-linecap:round;animation:vdkLijn 1.1s ease-out both}
@keyframes vdkLijn{0%{stroke-dashoffset:2200;opacity:0}10%{opacity:.9}80%{opacity:.9}100%{stroke-dashoffset:0;opacity:0}}
.vdk-bal{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px;border-radius:50%;background:#fff;box-shadow:0 0 30px #fff;offset-path:path('M 120 1000 Q 700 200 1820 160');animation:vdkBal 1.1s cubic-bezier(.5,0,.3,1) both}
@keyframes vdkBal{from{offset-distance:0%}to{offset-distance:100%;opacity:0}}
.vdk-goal{position:absolute;inset:0;background:var(--club-dd);animation:vdkGoalIn .4s both}
.vdk-goal svg{position:absolute;inset:0;width:100%;height:100%}
.vdk-goal .vdk-ln{animation:vdkTeken 1.2s ease both}
.vdk-krijt{fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round;stroke-dasharray:1200;animation:vdkTeken2 .7s ease-out .5s both}.vdk-krijt.b{animation-delay:1.1s}
.vdk-doel{fill:#fff;animation:vdkStip .3s 1.7s both}
.vdk-golf{fill:none;stroke:#fff;stroke-width:5;transform-box:fill-box;transform-origin:center;animation:vdkGolf 1.4s ease-out 1.7s 4 both}
.vdk-goal .t{position:absolute;left:90px;top:70px;width:1200px}
.vdk-goal .t>b{display:block;font:900 380px/.8 var(--ts-display);text-transform:uppercase;animation:vdkGoalK .8s cubic-bezier(.2,1.4,.4,1) 1.7s both}
.vdk-goal .w{font:800 90px/1 var(--ts-display);text-transform:uppercase;margin-top:24px;animation:vdkOp .5s 2.1s both}
.vdk-goal .s{display:flex;gap:18px;align-items:center;font:700 44px/1 var(--ts-display);text-transform:uppercase;margin-top:22px;animation:vdkOp .5s 2.3s both}
.vdk-goal .s strong{background:#fff;color:#111;border-radius:10px;padding:6px 18px;font-size:70px;flex:none}
.vdk-goal .p{font:600 28px/1 var(--ts-body);color:var(--club-l);letter-spacing:.1em;text-transform:uppercase;margin-top:22px;animation:vdkOp .5s 2.5s both}
@keyframes vdkGoalIn{from{opacity:0}}
@keyframes vdkTeken2{from{stroke-dashoffset:1200}to{stroke-dashoffset:0}}
@keyframes vdkStip{from{opacity:0}}
@keyframes vdkGolf{from{transform:scale(1);opacity:.9}to{transform:scale(7);opacity:0}}
@keyframes vdkGoalK{from{transform:scale(1.8);opacity:0}}
`,
};
