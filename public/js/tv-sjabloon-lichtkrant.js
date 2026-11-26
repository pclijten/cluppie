/* TV-SJABLOON "LICHTKRANT" [20261126q]: een LED-scorebord met neon. Gloed, knipperende live-stand en een glitch als overgang.
   Puntjesletters lezen minder goed bij lange tekst, dus de regels zijn kort. Zie docs/tv-sjablonen.md. */
import { esc, standWissel, maat, maatWoord, klok, beeld, lint, bovenSponsor } from './tv-speler.js?v=20261127v';

const led = s => esc(String(s ?? '').toUpperCase().replace(/[–—]/g, '-'));
const st = r => r.status === 'live' ? '<span class="g">LIVE</span>' : r.status === 'af' ? '<span class="rd">AFGELAST</span>' : r.status === 'klaar' ? 'EINDE' : led(r.veld || (r.thuis ? '' : 'UIT'));

export default {
  id: 'lichtkrant', per: 6, duur: 12000,
  kader: m => `<div class="ts-abs lk-naam ts-kap" style="${maat(m.club, 76, 26)}">${esc(m.club)}</div><div class="ts-abs lk-klok">${klok}</div><div class="ts-abs lk-rand"></div>
    <div class="ts-abs lk-onder">${lint(led([m.med, m.top ? `Straks ${m.top.tijd} ${m.top.a} - ${m.top.b}` : '', m.dag].filter(Boolean).join(' · ') + ' · '), 34)}</div><div class="lk-scan"></div>`,
  programma: (m, rijen, pag) => `<div class="lk-in"><div class="lk-h">Vandaag${pag.van > 1 ? ` ${pag.nr}/${pag.van}` : ''}</div>
    ${rijen.map(r => `<div class="lk-r lk-led ${r.status}"><span>${led(r.tijd || '--:--')}</span><span class="ts-kap">${led(r.a)} <b>${led(r.score || '-')}</b> ${led(r.b)}</span><span class="st">${st(r)}</span></div>`).join('') || '<div class="lk-r lk-led"><span></span><span>GEEN WEDSTRIJDEN VANDAAG</span></div>'}</div>`,
  uitslagen: m => { const l = m.live[0] || m.klaar[m.klaar.length - 1], rest = [...m.live, ...m.klaar].filter(r => r !== l).slice(0, 6);
    return `<div class="lk-in"><div class="lk-h">${l.status === 'live' ? 'Nu live' : 'Uitslag'}${l.veld ? ' · ' + esc(l.veld) : ''}</div><div class="lk-sc lk-led">${led(l.score || '0-0')}</div>
    <div class="lk-tm lk-led"><span class="ts-kap">${led(l.a)}</span><span class="ts-kap">${led(l.b)}</span></div>
    <div class="lk-rs lk-led">${rest.map(r => `<div><span class="ts-kap">${led(r.eigen)}</span><span class="${r.status === 'live' ? 'g' : ''}">${led(r.score || '0-0')}</span></div>`).join('')}</div></div>`; },
  dia: (m, x) => `<div class="lk-in lk-dia">${bovenSponsor(x) ? `<div class="lk-h">${esc(bovenSponsor(x))}</div>` : ''}${beeld(x, 'ts-beeld lk-img')}<div class="lk-neon neon" style="${maatWoord(x.titel, x.img ? 130 : 230, x.img ? 14 : 9)}">${esc(x.titel)}</div>${x.tekst ? `<div class="lk-tekst lk-led">${led(x.tekst)}</div>` : ''}</div>`,
  goal: (m, g) => `<div class="lk-goal"><div class="lk-rand"></div><div class="k">Goal</div><div class="s lk-led">${standWissel(g, led, '-')}</div>
    <div class="w lk-led ts-kap">${led(g.team)}</div><div class="t lk-led ts-kap">${led(g.a)} - ${led(g.b)}${g.veld ? ' · ' + led(g.veld) : ''}</div><div class="lk-scan"></div></div>`,
  fx: () => `<div class="lk-lijn"></div>`,
  css: `
.ts-lichtkrant{background:#040406;--led:#ffb21a}
.lk-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.028) 0 2px,transparent 2px 5px);z-index:40;pointer-events:none}
.lk-naam{left:64px;top:44px;max-width:1300px;font:900 76px/1 var(--ts-display);text-transform:uppercase;color:#fff;text-shadow:0 0 10px var(--club),0 0 30px var(--club),0 0 60px var(--club)}
.lk-klok{right:64px;top:40px;font:900 96px/1 'Doto','JetBrains Mono',monospace;color:var(--led);text-shadow:0 0 12px rgba(255,178,26,.7),0 0 34px rgba(255,140,0,.4)}
.lk-rand{left:64px;top:168px;width:1792px;height:764px;position:absolute;border-radius:26px;border:3px solid var(--club-l);box-shadow:0 0 24px var(--club),inset 0 0 24px color-mix(in oklab,var(--club) 60%,transparent);background-image:radial-gradient(rgba(255,255,255,.06) 1.6px,transparent 2.2px);background-size:12px 12px}
.lk-onder{left:64px;right:64px;bottom:40px;height:64px;font:900 40px/64px 'Doto','JetBrains Mono',monospace;color:#39ff88;text-shadow:0 0 12px rgba(57,255,136,.6)}
.lk-onder .ts-lint span{padding-right:20px}
.lk-in{position:absolute;left:64px;top:168px;width:1792px;height:764px;padding:44px 60px}
.lk-led{font-family:'Doto','JetBrains Mono',monospace;font-weight:900;color:var(--led);text-shadow:0 0 10px rgba(255,178,26,.65),0 0 30px rgba(255,140,0,.35)}
.lk-h{font:900 46px/1 var(--ts-display);text-transform:uppercase;letter-spacing:.14em;color:var(--club-l);text-shadow:0 0 14px var(--club)}
.lk-r{display:grid;grid-template-columns:170px minmax(0,1fr) 300px;gap:20px;align-items:center;font-size:48px;line-height:1;padding:21px 0;border-bottom:2px dashed rgba(255,178,26,.15)}
.lk-r b{color:#fff;text-shadow:0 0 12px rgba(255,255,255,.7)}
.lk-r .st{justify-self:end;white-space:nowrap}
.lk-led .g{color:#39ff88;text-shadow:0 0 12px rgba(57,255,136,.7);animation:lkKnip 1.2s steps(1) infinite}
.lk-led .rd{color:#ff3b3b;text-shadow:0 0 12px rgba(255,59,59,.7)}
.lk-r.af>span:nth-child(-n+2){opacity:.45}
@keyframes lkKnip{50%{opacity:.25}}
.lk-sc{position:absolute;right:80px;top:30px;font-size:330px;line-height:1}
.lk-tm{position:absolute;left:60px;top:130px;width:900px;font-size:64px;line-height:1.35;display:grid}
.lk-rs{position:absolute;left:60px;right:60px;top:440px;display:grid;grid-template-columns:1fr 1fr;gap:16px 70px;font-size:42px}
.lk-rs div{display:flex;justify-content:space-between;gap:20px;min-width:0}
.lk-dia{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center}
.lk-neon{font:900 230px/.9 var(--ts-display);text-transform:uppercase;color:#fff;text-shadow:0 0 8px #fff,0 0 22px var(--club),0 0 50px var(--club),0 0 100px var(--club)}
.lk-tekst{font-size:44px;line-height:1.25;max-width:1500px}
.lk-img{height:230px;max-width:640px;box-shadow:0 0 40px var(--club)}
.ts-lichtkrant .ts-in{animation:lkGlitch .6s steps(1) both .25s}
.ts-lichtkrant .ts-in .neon,.lk-goal .k{animation:lkFlik 1.3s linear both .8s}
.ts-lichtkrant .ts-uit{animation:lkUit .3s ease-in both}
@keyframes lkGlitch{0%{clip-path:inset(0 0 88% 0);transform:translateX(-40px);filter:hue-rotate(80deg) saturate(3)}18%{clip-path:inset(42% 0 30% 0);transform:translateX(30px)}36%{clip-path:inset(72% 0 4% 0);transform:translateX(-16px);filter:hue-rotate(-60deg)}54%{clip-path:inset(8% 0 58% 0);transform:translateX(10px)}72%{clip-path:inset(0 0 20% 0);transform:translateX(-4px);filter:none}100%{clip-path:inset(0);transform:none;filter:none}}
@keyframes lkFlik{0%,8%,14%,30%{opacity:.1}6%,12%,20%,40%,100%{opacity:1}}
@keyframes lkUit{60%{transform:scaleY(.02);filter:brightness(3);opacity:1}100%{transform:scale(0,.02);opacity:0}}
.lk-lijn{position:absolute;left:0;right:0;height:8px;top:-10px;background:#fff;box-shadow:0 0 30px 10px rgba(255,255,255,.5);animation:lkLijn .7s ease-in-out both .2s}
@keyframes lkLijn{from{top:-10px}to{top:1090px}}
.lk-goal{position:absolute;inset:0;background:#040406;animation:lkGlitch .5s steps(1) both}
.lk-goal .lk-rand{top:60px;height:960px;animation:lkRand .5s steps(1) 6}
.lk-goal .k{position:absolute;left:130px;top:90px;font:900 400px/1 var(--ts-display);text-transform:uppercase;color:transparent;-webkit-text-stroke:5px #fff;filter:drop-shadow(0 0 18px var(--club)) drop-shadow(0 0 50px var(--club));animation:lkFlik 1s linear both .3s,lkKnip 1s steps(1) 1.4s 7}
.lk-goal .s{position:absolute;right:140px;top:110px;font-size:420px;line-height:1}
.lk-goal .w{position:absolute;left:130px;right:130px;top:590px;font-size:110px;line-height:1.1;color:#39ff88;text-shadow:0 0 14px rgba(57,255,136,.7)}
.lk-goal .t{position:absolute;left:130px;right:130px;top:760px;font-size:54px}
@keyframes lkRand{50%{box-shadow:0 0 70px var(--club-l),inset 0 0 70px var(--club)}}
`,
};
