/* TV-SJABLOON "SPORTNIEUWS" [20261126q]: een vast nieuwskader. Het hoofdvenster wisselt; de live standen rechts en de
   lopende banden onderin blijven altijd staan. Bij een doelpunt schiet er een rode balk in. Zie docs/tv-sjablonen.md. */
import { esc, maat, maatWoord, stip, klok, beeld, lint, label, bovenSponsor } from './tv-speler.js?v=20261126r';

export default {
  id: 'sportnieuws', per: 7, duur: 12000,
  kader: m => `<div class="ts-abs sn-top"><div class="sn-logo"><span class="ts-kap">${esc(m.club)}</span><i>tv</i></div><div class="l">${esc(m.dag)}</div><div class="k">${klok}</div></div>
    <div class="ts-abs sn-rail"><h4>${m.live.length ? stip + ' Live' : 'Uitslagen'}</h4><div class="sn-lv">${(m.live.length ? m.live : m.klaar.slice(-4)).slice(0, 4).map(r => `<div><div class="s"><span class="ts-kap">${esc(r.eigen)}</span><b>${esc(r.score || '0–0')}</b></div><small class="ts-kap">${esc(r.tegen)}${r.veld ? ' · ' + esc(r.veld) : ''}</small></div>`).join('') || '<p>Nog geen standen vandaag.</p>'}</div>
      ${m.straks.length ? `<div class="sn-nx">${m.straks.slice(0, 3).map(r => `<div><b>${esc(r.tijd)}</b><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span></div>`).join('')}</div>` : ''}</div>
    ${m.med ? `<div class="ts-abs sn-t1"><b>Mededeling</b>${lint(esc(m.med), 30)}</div>` : ''}
    ${m.sponsors.length ? `<div class="ts-abs sn-t2"><b>Met dank aan</b>${lint(m.sponsors.map(s => esc(s.titel)).join(' ● ') + ' ●', 44)}</div>` : ''}`,
  programma: (m, rijen, pag) => `<div class="sn-in"><h3>Vandaag op het park${pag.van > 1 ? `<small>${pag.nr} / ${pag.van}</small>` : ''}</h3>
    ${rijen.map(r => `<div class="sn-r ${r.status}"><b>${esc(r.tijd || '–')}</b><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><span class="v ts-kap">${esc(r.plek)}</span><em>${esc(r.score || label(r) || '–')}</em></div>`).join('') || '<p class="sn-leeg">Vandaag staan er geen wedstrijden op het programma.</p>'}</div>`,
  uitslagen: m => { const l = m.live[0] || m.klaar[m.klaar.length - 1], rest = [...m.live, ...m.klaar].filter(r => r !== l).slice(0, 6);
    return `<div class="sn-hoofd">${l.status === 'live' ? 'Live' : 'Uitslag'}<small>${esc(l.veld || 'Vandaag')}</small></div><div class="sn-gs"><div class="h"><span class="ts-kap" style="${maat(l.a, 68, 13)}">${esc(l.a)}</span></div><div class="s">${esc(l.score || '0–0')}</div><div class="u"><span class="ts-kap" style="${maat(l.b, 68, 13)}">${esc(l.b)}</span></div></div>
    <div class="sn-gm">Meer standen en uitslagen</div><div class="sn-gr">${rest.map(r => `<div><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><b>${esc(r.score || '0–0')}</b></div>`).join('')}</div>`; },
  dia: (m, x) => `<div class="sn-ad ${x.soort}">${x.soort === 'sponsor' ? '<span class="sn-tag">Sponsor</span>' : ''}${beeld(x, 'ts-beeld sn-img')}<div class="e">${esc(bovenSponsor(x))}</div><div class="n" style="${maatWoord(x.titel, x.img ? 110 : 170, x.img ? 16 : 10)}">${esc(x.titel)}</div>${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</div>`,
  goal: (m, g) => `<div class="sn-goal"><div class="sn-br">Goal<small>${esc(g.veld || 'Zojuist')}</small></div>
    <div class="w" style="${maat(g.team, 130, 18)}">${esc(g.team)}</div><div class="sn-gs"><div class="h"><span class="ts-kap" style="${maat(g.a, 68, 13)}">${esc(g.a)}</span></div><div class="s">${esc(g.stand)}</div><div class="u"><span class="ts-kap" style="${maat(g.b, 68, 13)}">${esc(g.b)}</span></div></div></div>`,
  css: `
.ts-sportnieuws{background:linear-gradient(160deg,#0a1120,#0f182a 55%,var(--club-dd))}
.ts-sportnieuws .ts-scenes{inset:auto;left:48px;top:124px;width:1352px;height:772px;overflow:hidden;border-radius:8px;background:#0d1524;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.sn-top{left:48px;right:48px;top:34px;height:66px;display:flex;align-items:center;gap:24px}
.sn-logo{background:var(--club);color:var(--club-ink);font:900 42px/66px var(--ts-display);text-transform:uppercase;padding:0 22px;letter-spacing:.02em;display:flex;align-items:center;max-width:900px;min-width:0}
.sn-logo i{font-style:normal;background:#fff;color:#111;padding:0 10px;margin-left:12px;line-height:1.25;flex:none}
.sn-top .l{font:700 22px/1 var(--ts-body);letter-spacing:.12em;text-transform:uppercase}
.sn-top .k{margin-left:auto;font:800 58px/1 var(--ts-display)}
.sn-rail{left:1424px;top:124px;width:448px;height:772px;display:grid;grid-template-rows:auto 1fr auto;gap:14px}
.sn-rail h4{background:var(--club);color:var(--club-ink);font:800 30px/1 var(--ts-display);text-transform:uppercase;padding:14px 18px;display:flex;gap:10px;align-items:center}
.sn-lv{display:grid;gap:12px;align-content:start}
.sn-lv>div{background:#121c30;padding:16px 18px;border-left:6px solid var(--club);min-width:0}
.sn-lv .s{display:grid;grid-template-columns:minmax(0,1fr) auto;font:800 34px/1.15 var(--ts-display);text-transform:uppercase;gap:10px}.sn-lv .s b{font-size:40px}
.sn-lv small{display:block;font:600 20px/1.3 var(--ts-body);color:#9fb0cc}
.sn-lv p{font:500 24px/1.3 var(--ts-body);color:#9fb0cc;padding:8px 4px}
.sn-nx{background:#121c30;padding:16px 18px;display:grid;gap:10px}
.sn-nx div{font:600 24px/1.2 var(--ts-body);display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:baseline}.sn-nx b{font:800 30px/1 var(--ts-display)}
.sn-t1,.sn-t2{left:48px;right:48px;display:flex;align-items:stretch}
.sn-t1{top:914px;height:72px}.sn-t2{top:994px;height:52px}
.sn-t1 b,.sn-t2 b{flex:none;display:flex;align-items:center;padding:0 22px;font:800 30px/1 var(--ts-display);text-transform:uppercase;letter-spacing:.04em}
.sn-t1 b{background:#ffd200;color:#111}.sn-t2 b{background:#fff;color:#111;font-size:24px}
.sn-t1 .ts-lintw{flex:1;background:#fff;color:#111;display:flex;align-items:center;font:600 32px/1 var(--ts-body)}
.sn-t2 .ts-lintw{flex:1;background:#0d1524;display:flex;align-items:center;font:700 26px/1 var(--ts-display);text-transform:uppercase;letter-spacing:.06em;color:#c7d2e6}
.sn-t1 .ts-lint span{padding:0 60px}.sn-t2 .ts-lint span{padding:0 14px}
.sn-in{padding:40px 52px;height:100%;display:flex;flex-direction:column}
.sn-in h3{margin:0 0 18px;font:900 72px/1 var(--ts-display);text-transform:uppercase;display:flex;justify-content:space-between;align-items:baseline}
.sn-in h3 small{font:600 26px/1 var(--ts-body);text-transform:none;color:#9fb0cc}
.sn-r{display:grid;grid-template-columns:110px minmax(0,1fr) 200px 150px;gap:0 14px;align-items:center;padding:15px 0;border-top:1px solid #22304a;font:600 30px/1.1 var(--ts-body)}
.sn-r b{font:800 40px/1 var(--ts-display)}
.sn-r .v{font:500 22px/1.2 var(--ts-body);color:#9fb0cc}
.sn-r em{font-style:normal;justify-self:end;font:800 30px/1 var(--ts-display);padding:6px 14px;background:#22304a}
.sn-r.live em{background:#ffd200;color:#111}
.sn-r.af span:not(.v){text-decoration:line-through;color:#6d7b95}
.sn-leeg{font:500 34px/1.3 var(--ts-body);color:#9fb0cc;margin-top:30px}
.sn-hoofd,.sn-br{position:absolute;left:0;right:0;top:0;height:120px;display:flex;align-items:center;gap:24px;padding:0 52px;font:900 92px/1 var(--ts-display);text-transform:uppercase;font-style:italic}
.sn-hoofd{background:#16233c}.sn-br{background:#e10600;color:#fff}
.sn-hoofd small,.sn-br small{font:800 30px/1 var(--ts-body);font-style:normal;letter-spacing:.1em;background:#fff;color:#16233c;padding:10px 14px}.sn-br small{color:#e10600}
.sn-gs{position:absolute;left:52px;right:52px;top:180px;display:grid;grid-template-columns:minmax(0,1fr) 280px minmax(0,1fr);height:190px}
.sn-gs>div{display:flex;align-items:center;justify-content:center;font:900 68px/1 var(--ts-display);text-transform:uppercase;text-align:center;padding:0 24px;min-width:0}
.sn-gs .h{background:var(--club);color:var(--club-ink)}.sn-gs .s{background:#fff;color:#111;font-size:140px;padding:0}.sn-gs .u{background:#1a2740}
.sn-gm{position:absolute;left:52px;top:400px;font:700 30px/1.3 var(--ts-body);color:#c7d2e6}
.sn-gr{position:absolute;left:52px;right:52px;top:460px;display:grid;grid-template-columns:1fr 1fr;gap:12px 24px}
.sn-gr div{display:flex;justify-content:space-between;gap:14px;font:700 32px/1.1 var(--ts-display);text-transform:uppercase;padding:16px 18px;background:#121c30;min-width:0}.sn-gr b{color:#ffd200;flex:none}
.sn-ad{position:absolute;inset:0;background:var(--club);color:var(--club-ink);padding:56px 70px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;overflow:hidden}
.sn-ad.scherm{background:#f3f4f6;color:#111}
.sn-ad::before{content:"";position:absolute;right:-120px;top:-100px;width:700px;height:1100px;background:rgba(255,255,255,.12);transform:skewX(-20deg)}
.sn-ad>*{position:relative}
.sn-ad .sn-tag{position:absolute;right:30px;top:24px;font:700 18px/1 var(--ts-body);letter-spacing:.14em;text-transform:uppercase;opacity:.75}
.sn-ad .e{font:700 24px/1 var(--ts-body);letter-spacing:.14em;text-transform:uppercase;opacity:.85;margin-bottom:12px}.sn-ad .e:empty{display:none}
.sn-ad .n{font:900 170px/.86 var(--ts-display);text-transform:uppercase}
.sn-ad p{font:600 38px/1.25 var(--ts-body);margin-top:20px;white-space:pre-line}
.sn-img{height:250px;max-width:640px;margin-bottom:30px}
.ts-sportnieuws .ts-in{animation:snIn .75s cubic-bezier(.7,0,.2,1) both}
.ts-sportnieuws .ts-uit{animation:snUit .75s cubic-bezier(.7,0,.2,1) both}
@keyframes snIn{from{transform:translateX(100%)}}
@keyframes snUit{to{transform:translateX(-100%)}}
@keyframes snBalk{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
.sn-goal{position:absolute;left:48px;top:124px;width:1352px;height:772px;border-radius:8px;overflow:hidden;background:#0d1524;animation:snIn .5s cubic-bezier(.7,0,.2,1) both}
.sn-goal .sn-br{animation:snBalk .5s cubic-bezier(.2,.8,.2,1) .35s both,snKnip .5s steps(1) 1s 5;height:170px;font-size:140px}
.sn-goal .w{position:absolute;left:52px;right:52px;top:210px;font:900 130px/1 var(--ts-display);text-transform:uppercase;animation:snBalk .5s .7s both}
.sn-goal .sn-gs{top:420px;height:230px;animation:snBalk .6s .9s both}.sn-goal .sn-gs .s{font-size:180px}
@keyframes snKnip{50%{background:#fff;color:#e10600}}
`,
};
