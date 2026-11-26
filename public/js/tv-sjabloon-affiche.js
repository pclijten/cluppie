/* TV-SJABLOON "AFFICHE" [20261126p]: één boodschap per dia in enorme letters, als een campagneposter.
   Overgang: een nieuw kleurvlak schuift van onder over het oude, de regels rijzen uit een masker.
   Dit is het eenvoudigste sjabloon: een goed begin voor een nieuw. Zie docs/tv-sjablonen.md. */
import { esc, maat, stip, klok, beeld, lint, bovenSponsor } from './tv-speler.js?v=20261126p';

const regel = (html, i, extra = '') => `<span class="ts-regel"><span style="--i:${i};${extra}">${html}</span></span>`;
const onder = r => r.status === 'live' ? `Nu bezig: ${esc(r.score || '0–0')}` : r.status === 'af' ? 'Afgelast' : r.status === 'klaar' ? `Gespeeld: ${esc(r.score)}` : esc(r.plek);
const band = m => `<div class="ts-abs af-band">${lint(`${m.top ? `Straks: ${esc(m.top.a)} – ${esc(m.top.b)} · ${esc(m.top.tijd)}${m.top.veld ? ' · ' + esc(m.top.veld) : ''} · ` : ''}${m.med ? esc(m.med) + ' · ' : ''}${esc(m.club)} · `, 40)}</div>`;

export default {
  id: 'affiche', per: 6, duur: 12000,
  kader: () => `<div class="ts-abs af-klok">${klok}</div>`,
  programma: (m, rijen, pag) => { const n = m.rijen.length;
    return `<div class="af-vlak club"></div><div class="ts-abs af-kop">${regel('Vandaag', 0, 'color:transparent;-webkit-text-stroke:4px var(--club-ink)')}${regel(n ? `${n} ${n === 1 ? 'wedstrijd' : 'wedstrijden'}` : 'geen wedstrijden', 1)}${regel(esc(m.club), 2, maat(m.club, 172, 13))}</div>
    <div class="ts-abs af-lijst">${rijen.map((r, i) => `<div class="ts-a ${r.status}" style="--i:${i}"><b>${esc(r.tijd || '–')}</b><span><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><small>${r.status === 'live' ? stip + ' ' : ''}${onder(r)}</small></span></div>`).join('')}${pag.van > 1 ? `<em class="ts-a" style="--i:7">${pag.nr} / ${pag.van}</em>` : ''}</div>${band(m)}`; },
  uitslagen: m => { const l = m.live[0] || m.klaar[m.klaar.length - 1], rest = [...m.live, ...m.klaar].filter(r => r !== l).slice(0, 5);
    return `<div class="af-vlak zwart"></div><div class="ts-abs af-score">${regel(esc(l.score || '0–0'), 0)}</div>
    <div class="ts-abs af-wie"><span class="p ts-a">${l.status === 'live' ? stip + ' Live' : 'Uitslag'}${l.veld ? ' · ' + esc(l.veld) : ''}</span>${regel(esc(l.a), 1, maat(l.a, 150, 9))}<span class="ts-regel"><span class="u" style="--i:2">tegen ${esc(l.b)}</span></span></div>
    <div class="ts-abs af-rest">${rest.map((r, i) => `<div class="ts-a" style="--i:${i + 2}"><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><b>${r.status === 'live' ? stip + ' ' : ''}${esc(r.score || '–')}</b></div>`).join('')}</div>`; },
  dia: (m, x) => { const w = String(x.titel || '').split(' '), half = Math.ceil(w.length / 2), a = w.slice(0, half).join(' '), b = w.slice(half).join(' '), langste = Math.max(a.length, b.length);
    return `<div class="af-vlak wit"></div>${x.img ? `<div class="ts-abs af-img ts-a">${beeld(x, 'af-plaat')}</div>` : ''}
    <div class="ts-abs af-naam ${x.img ? 'klein' : ''}" style="${maat('x'.repeat(langste), x.img ? 150 : 300, x.img ? 12 : 8)}">${regel(esc(a), 0)}${b ? regel(esc(b), 1, 'color:color-mix(in oklab,var(--club) 85%,#000)') : ''}</div>
    ${x.tekst ? `<div class="ts-abs af-tekst ts-a" style="--i:2">${esc(x.tekst)}</div>` : ''}${bovenSponsor(x) ? `<div class="ts-abs af-zij ts-a" style="--i:3">${esc(bovenSponsor(x))}</div>` : ''}${band(m)}`; },
  goal: (m, g) => `<div class="af-goal"><div class="g">${regel('Goal!', 0)}</div><div class="s">${regel(esc(g.stand), 2)}</div>
    <div class="t">${regel(esc(g.team), 3, maat(g.team, 120, 16))}<span class="ts-regel"><span style="--i:4" class="k">${esc(g.a)} – ${esc(g.b)}${g.veld ? ' · ' + esc(g.veld) : ''}</span></span></div></div>`,
  css: `
.ts-affiche{background:#0b0b0c;font-family:var(--ts-display)}
.af-vlak{position:absolute;inset:0}.af-vlak.club{background:var(--club)}.af-vlak.zwart{background:#0b0b0c}.af-vlak.wit{background:#f2f1ee}
.ts-affiche .ts-programma{color:var(--club-ink)}.ts-affiche .ts-dia{color:#0b0b0c}
.af-klok{right:0;top:0;font:900 44px/1 var(--ts-display);z-index:70;background:#0b0b0c;color:#fff;padding:14px 26px 12px}
.af-kop{left:80px;top:110px;width:1090px;font:900 172px/.9 var(--ts-display);text-transform:uppercase}
.af-lijst{left:1230px;top:104px;width:630px}
.af-lijst div{display:grid;grid-template-columns:150px minmax(0,1fr);gap:18px;padding:17px 0;border-top:3px solid currentColor;align-items:baseline}
.af-lijst b{font:900 62px/1 var(--ts-display)}
.af-lijst span{font:700 30px/1.15 var(--ts-body);min-width:0;display:block}
.af-lijst small{display:block;font:500 22px/1.3 var(--ts-body);opacity:.85}
.af-lijst .af span.ts-kap{text-decoration:line-through;opacity:.7}
.af-lijst em{display:block;font:700 26px/1 var(--ts-body);font-style:normal;border-top:3px solid currentColor;padding-top:14px}
.af-band{left:0;right:0;bottom:0;height:120px;background:#0b0b0c;color:#fff;display:flex;align-items:center;font:900 64px/1 var(--ts-display);text-transform:uppercase}
.ts-affiche .ts-dia .af-band{background:var(--club);color:var(--club-ink)}
.af-band .ts-lint span{padding-right:50px}
.af-score{left:50px;top:40px;font:900 620px/.86 var(--ts-display);color:color-mix(in oklab,var(--club) 78%,#fff);letter-spacing:-.02em;white-space:nowrap}
.af-wie{left:1180px;top:120px;width:680px;text-transform:uppercase;color:#fff}
.af-wie .p{display:inline-flex;gap:14px;align-items:center;font:800 34px/1 var(--ts-display);border:3px solid #fff;padding:10px 18px;margin-bottom:26px}
.af-wie .ts-regel{font:900 150px/.9 var(--ts-display)}
.af-wie .u{font:800 54px/1.1 var(--ts-display);color:#bdbdbd}
.af-rest{left:1180px;top:600px;width:680px;font:600 30px/1.2 var(--ts-body);display:grid;color:#fff}
.af-rest div{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-top:2px solid #333}
.af-rest b{font:800 36px/1 var(--ts-display);flex:none}
.af-naam{left:80px;top:70px;right:80px;font:900 300px/.84 var(--ts-display);text-transform:uppercase}.af-naam .ts-regel{line-height:.84}
.af-naam.klein{left:760px;top:150px}
.af-img{left:80px;top:150px;width:600px;height:520px}.af-plaat{width:100%;height:100%;background:#fff;display:grid;place-items:center;padding:40px;box-shadow:14px 14px 0 #0b0b0c}.af-plaat img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.af-tekst{left:84px;right:200px;bottom:170px;font:600 44px/1.2 var(--ts-body);white-space:pre-line}
.af-zij{right:50px;top:130px;font:800 30px/1 var(--ts-display);text-transform:uppercase;letter-spacing:.06em;writing-mode:vertical-rl;transform:rotate(180deg)}
.ts-affiche .ts-in{animation:afVeeg .75s cubic-bezier(.75,0,.2,1) both}
.ts-affiche .ts-in .ts-regel>span,.af-goal .ts-regel>span{animation:afRijs .75s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(480ms + var(--i,0) * 90ms)}
.ts-affiche .ts-in .ts-a{animation-name:afOp;animation-duration:.6s;--b:700ms}
@keyframes afVeeg{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0)}}
@keyframes afRijs{from{transform:translateY(108%)}}
@keyframes afOp{from{opacity:0;transform:translateY(30px)}}
.af-goal{position:absolute;inset:0;background:var(--club);color:var(--club-ink);animation:afVeeg .6s cubic-bezier(.75,0,.2,1) both;text-transform:uppercase}
.af-goal .g{position:absolute;left:70px;top:30px;font:900 520px/.84 var(--ts-display);font-style:italic}
.af-goal .s{position:absolute;right:80px;top:470px;font:900 400px/.84 var(--ts-display);color:#0b0b0c;background:#fff;padding:0 40px}
.af-goal .t{position:absolute;left:80px;top:560px;width:1000px;font:900 120px/.92 var(--ts-display)}
.af-goal .k{font:700 38px/1.3 var(--ts-body);text-transform:none;margin-top:16px}
`,
};
