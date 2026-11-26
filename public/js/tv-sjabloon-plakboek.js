/* TV-SJABLOON "PLAKBOEK" [20261126q]: kaartjes met tape, stickers en stift op papier. Alles valt van boven in beeld
   en valt er onderaan weer uit. Zie docs/tv-sjablonen.md. */
import { esc, standWissel, maat, maatWoord, klok, beeld } from './tv-speler.js?v=20261127t';

const R = [-2, 1.5, -1, 2, -1.5, 1];
const streep = '<svg viewBox="0 0 620 26"><path d="M4 18 C 120 4, 240 26, 360 12 S 560 8, 616 16" fill="none" stroke="var(--club)" stroke-width="7" stroke-linecap="round"/></svg>';
const ster = '<svg viewBox="0 0 100 100"><polygon fill="#ffe14d" stroke="#111" stroke-width="1.2" points="50,2 58,30 86,14 70,40 98,50 70,60 86,86 58,70 50,98 42,70 14,86 30,60 2,50 30,40 14,14 42,30"/></svg>';
const titel = t => `<div class="ts-abs pb-titel pb-a" style="--r:-1.5deg">${esc(t)}${streep}</div>`;
const stempel = r => r.status === 'af' ? '<span class="pb-stempel">Afgelast</span>' : r.status === 'live' ? `<span class="pb-stempel">Live ${esc(r.score || '0–0')}</span>` : r.status === 'klaar' && r.score ? `<span class="pb-stempel z">${esc(r.score)}</span>` : '';
const kaartje = (r, i) => `<div class="pb-tk pb-a ${r.status}" style="left:${60 + (i % 3) * 600}px;top:${300 + Math.floor(i / 3) * 300}px;--r:${R[i % 6]}deg;--i:${i + 1}">
  <div class="tt">${esc(r.tijd || '–')}</div><div class="in"><b class="ts-kap" style="${maat(r.a, 48, 15)}">${esc(r.a)}</b><span class="ts-kap">${esc(r.b)}</span><small class="ts-kap">${esc(r.plek)}</small></div>${stempel(r)}</div>`;

export default {
  id: 'plakboek', per: 6, duur: 13000,
  kader: m => `<div class="pb-raster"></div><div class="ts-abs pb-naam" style="${maat(m.club, 78, 20)}">${esc(m.club)}</div><div class="ts-abs pb-klok">${klok}</div>
    ${m.med ? `<div class="ts-abs pb-note" style="${maat(m.med, 32, 80)}">${esc(m.med)}</div>` : ''}`,
  programma: (m, rijen, pag) => titel(`Vandaag op het park!${pag.van > 1 ? ` (${pag.nr}/${pag.van})` : ''}`)
    + (rijen.map(kaartje).join('') || `<div class="ts-abs pb-leeg pb-a" style="--r:-2deg;--i:1">Vandaag geen wedstrijden. Tot snel!</div>`),
  uitslagen: m => { const groot = m.live[0] || m.klaar[m.klaar.length - 1], lijst = [...m.live, ...m.klaar].filter(r => r !== groot).slice(0, 7);
    return `<div class="pb-pol pb-a" style="--r:-3deg;--i:0"><div class="pb-foto">${ster}<div class="g"><b>${groot.status === 'live' ? 'Live' : 'Einde'}</b><span>${esc(groot.score || '0–0')}</span></div></div><div class="cap ts-kap">${esc(groot.a)} – ${esc(groot.b)}</div></div>
    <div class="pb-blad pb-a" style="--r:2deg;--i:1"><h3>Uitslagen</h3>${lijst.map(r => `<div><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><b>${esc(r.score || '0–0')}</b></div>`).join('') || '<div><span>Verder nog niets.</span></div>'}</div>`; },
  dia: (m, x) => { const ook = m.sponsors.filter(s => s !== x && s.titel).slice(0, 4);
    return (x.img
      ? `<div class="pb-pol pb-a" style="--r:-3deg;--i:0"><div class="pb-foto wit">${beeld(x, 'pb-img')}</div><div class="cap ts-kap">${esc(x.titel)}</div></div>`
      : `<div class="pb-sticker pb-a" style="--r:-6deg;--i:0"><div><div class="e">${esc(x.soort === 'sponsor' ? (x.pakket === 'hoofd' ? 'Hoofdsponsor' : 'Sponsor') : m.club)}</div><div class="n" style="${maatWoord(x.titel, 130, 9)}">${esc(x.titel)}</div></div></div>`)
      + `<div class="pb-dank pb-a" style="--r:-3deg;--i:1;${maat(x.tekst, 84, 34)}">${esc(x.tekst || (x.soort === 'sponsor' ? 'Dank je wel!' : ''))}</div>`
      + (x.soort === 'sponsor' ? ook.map((s, i) => `<div class="pb-kl pb-a ts-kap" style="left:${920 + (i % 2) * 440}px;top:${600 + Math.floor(i / 2) * 130}px;--r:${[3, -2, -3, 2][i]}deg;--i:${i + 2}">${esc(s.titel)}</div>`).join('') : ''); },
  goal: (m, g) => `<div class="pb-goal"><div class="pb-raster"></div>
    <div class="pb-pol pb-g1" style="--r:-4deg"><div class="pb-foto">${ster}<div class="g"><b>Goal!</b><span>${standWissel(g)}</span></div></div><div class="cap ts-kap">${esc(g.team)} scoort!</div></div>
    <div class="pb-gt pb-g2" style="--r:2deg"><span>${esc(g.veld || 'Doelpunt')}</span><b style="${maat(g.a, 110, 12)}">${esc(g.a)}</b><i>${esc(g.stand)}</i><b style="${maat(g.b, 110, 12)}">${esc(g.b)}</b></div></div>`,
  css: `
.ts-plakboek,.pb-goal{background:#e8e6e1;color:#111;font-family:var(--ts-display)}
.pb-raster{position:absolute;right:-120px;top:-160px;width:900px;height:900px;background-image:radial-gradient(color-mix(in oklab,var(--club) 60%,transparent) 3px,transparent 3.6px);background-size:22px 22px;-webkit-mask-image:radial-gradient(circle,#000 30%,transparent 68%);mask-image:radial-gradient(circle,#000 30%,transparent 68%)}
.pb-naam{left:56px;top:40px;background:#111;color:#fff;font:900 78px/1 var(--ts-display);text-transform:uppercase;padding:10px 24px;transform:rotate(-2deg);white-space:nowrap}
.pb-klok{right:70px;top:30px;width:180px;height:180px;border-radius:50%;background:var(--club);color:var(--club-ink);display:grid;place-items:center;font:900 62px/1 var(--ts-display);transform:rotate(8deg);box-shadow:6px 6px 0 #111;border:4px solid #111}
.pb-note{right:70px;bottom:36px;width:560px;max-height:150px;overflow:hidden;background:#ffe14d;padding:20px 26px;font:400 32px/1.25 'Permanent Marker',cursive;transform:rotate(-2.5deg);box-shadow:0 14px 24px -10px rgba(0,0,0,.4);z-index:5}
.pb-titel{left:60px;top:170px;font:400 66px/1 'Permanent Marker',cursive;transform:rotate(-1.5deg)}
.pb-titel svg{display:block;width:620px;height:26px;margin-top:4px}
.pb-leeg{left:60px;top:400px;font:400 90px/1.1 'Permanent Marker',cursive;transform:rotate(var(--r));width:1200px}
.pb-tk{position:absolute;width:540px;height:232px;background:#fff;border:4px solid #111;box-shadow:9px 9px 0 #111;display:grid;grid-template-columns:150px minmax(0,1fr);transform:rotate(var(--r))}
.pb-tk::before{content:"";position:absolute;left:50%;top:-22px;width:130px;height:40px;margin-left:-65px;background:rgba(255,225,77,.75);transform:rotate(-4deg)}
.pb-tk .tt{background:var(--club);color:var(--club-ink);display:grid;place-items:center;font:900 54px/1 var(--ts-display);border-right:4px solid #111}
.pb-tk .in{padding:22px 24px;display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:0}
.pb-tk .in b{font:900 48px/.95 var(--ts-display);text-transform:uppercase}
.pb-tk .in span{font:700 28px/1.05 var(--ts-display);text-transform:uppercase}
.pb-tk .in small{font:500 21px/1.3 var(--ts-body);color:#444}
.pb-stempel{position:absolute;right:16px;bottom:14px;font:900 34px/1 var(--ts-display);text-transform:uppercase;border:4px solid #d61f26;color:#d61f26;padding:4px 10px;transform:rotate(-10deg);background:rgba(255,255,255,.85)}
.pb-stempel.z{border-color:#111;color:#111}
.pb-tk.af .in,.pb-tk.voorbij .in{opacity:.5}
.pb-tk.af .pb-stempel{right:auto;left:50%;top:50%;bottom:auto;transform:translate(-50%,-50%) rotate(-12deg);font-size:58px}
.pb-pol{position:absolute;left:90px;top:190px;width:820px;height:760px;background:#fff;padding:30px 30px 120px;box-shadow:0 30px 50px -20px rgba(0,0,0,.45);transform:rotate(var(--r))}
.pb-foto{width:100%;height:100%;background:var(--club);position:relative;overflow:hidden;display:grid;place-items:center}
.pb-foto.wit{background:#f4f3ef}
.pb-foto svg{position:absolute;width:620px;height:620px}
.pb-foto .g{position:relative;text-align:center;color:#111}
.pb-foto .g b{display:block;font:900 150px/.85 var(--ts-display);text-transform:uppercase}
.pb-foto .g span{font:900 120px/1 var(--ts-display)}
.pb-img{width:86%;height:86%;display:grid;place-items:center}.pb-img img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.pb-pol .cap{position:absolute;left:30px;right:30px;bottom:34px;font:400 40px/1.1 'Permanent Marker',cursive;text-align:center}
.pb-blad{position:absolute;left:1000px;top:230px;width:800px;height:600px;background:#fff;background-image:repeating-linear-gradient(transparent 0 62px,#9cc3ea 62px 64px);padding:60px 50px 40px 90px;box-shadow:0 20px 40px -20px rgba(0,0,0,.4);transform:rotate(var(--r));border-left:3px solid #f08a8a;overflow:hidden}
.pb-blad h3{margin:-46px 0 6px;font:400 54px/64px 'Permanent Marker',cursive}
.pb-blad div{display:flex;justify-content:space-between;gap:20px;font:400 34px/64px 'Permanent Marker',cursive}
.pb-blad b{font-weight:400;color:#d61f26;flex:none}
.pb-sticker{position:absolute;left:150px;top:210px;width:680px;height:680px;border-radius:50%;background:var(--club);color:var(--club-ink);border:6px solid #111;box-shadow:12px 12px 0 #111;display:grid;place-items:center;text-align:center;transform:rotate(var(--r));padding:60px}
.pb-sticker::before{content:"";position:absolute;inset:22px;border-radius:50%;border:4px dashed currentColor;opacity:.6}
.pb-sticker .e{font:700 30px/1 var(--ts-body);letter-spacing:.14em;text-transform:uppercase}
.pb-sticker .n{font:900 130px/.86 var(--ts-display);text-transform:uppercase;margin:16px 0}
.pb-dank{position:absolute;left:900px;top:250px;font:400 84px/1.08 'Permanent Marker',cursive;transform:rotate(var(--r));width:820px;max-height:330px;overflow:hidden;white-space:pre-line}
.pb-kl{position:absolute;max-width:410px;background:#fff;border:4px solid #111;box-shadow:6px 6px 0 #111;font:900 40px/1 var(--ts-display);text-transform:uppercase;padding:18px 24px;transform:rotate(var(--r))}
.ts-plakboek .ts-in .pb-a{animation:pbVal .8s cubic-bezier(.3,1.45,.5,1) both;animation-delay:calc(450ms + var(--i,0) * 80ms)}
.ts-plakboek .ts-uit .pb-a{animation:pbWeg .55s cubic-bezier(.5,0,.9,.5) both;animation-delay:calc(var(--i,0) * 40ms)}
@keyframes pbVal{from{transform:translateY(-1200px) rotate(calc(var(--r,0deg) + 24deg))}to{transform:rotate(var(--r,0deg))}}
@keyframes pbWeg{to{transform:translateY(1300px) rotate(calc(var(--r,0deg) - 30deg))}}
.pb-goal{position:absolute;inset:0}
.pb-g1{left:120px;top:150px;animation:pbVal .9s cubic-bezier(.3,1.45,.5,1) both}
.pb-g1 .pb-foto svg{width:900px;height:900px;animation:pbDraai 9s linear infinite}
.ts-metband .pb-g1{top:40px}.ts-metband .pb-gt{top:110px}
.pb-g1 .g b{font-size:210px}.pb-g1 .g span{font-size:150px}
@keyframes pbDraai{to{transform:rotate(360deg)}}
.pb-gt{position:absolute;left:1040px;top:200px;width:760px;background:#fff;border:6px solid #111;box-shadow:14px 14px 0 #111;padding:40px 44px;display:flex;flex-direction:column;gap:10px;transform:rotate(var(--r));animation:pbVal .9s cubic-bezier(.3,1.45,.5,1) .25s both}
.pb-gt::before{content:"";position:absolute;left:50%;top:-26px;width:190px;height:50px;margin-left:-95px;background:rgba(255,225,77,.8);transform:rotate(-4deg)}
.pb-gt span{font:400 44px/1 'Permanent Marker',cursive;color:#d61f26}
.pb-gt b{font:900 110px/.95 var(--ts-display);text-transform:uppercase;white-space:nowrap}
.pb-gt i{font:900 200px/.9 var(--ts-display);font-style:normal;background:var(--club);color:var(--club-ink);align-self:flex-start;padding:6px 26px;border:5px solid #111;transform:rotate(-3deg)}
`,
};
