/* TV-SJABLOON "BENTO" [20261126q]: alles tegelijk in een raster van tegels; bij een wissel kantelen de tegels om.
   De klok blijft staan. Zie docs/tv-sjablonen.md. */
import { esc, standWissel, maat, maatWoord, stip, klok, beeld, bovenSponsor } from './tv-speler.js?v=20261130e';

const tegel = (gebied, i, klasse, html) => `<div class="be-t ${klasse}" style="grid-area:${gebied};--i:${i}">${html}</div>`;
const liveTegel = m => tegel('live', 1, '', m.live.length
  ? `<div class="lb">${stip} Live</div><div class="be-lm">${m.live.slice(0, 3).map(r => `<div><div class="tt"><span class="ts-kap">${esc(r.eigen)}</span><b>${esc(r.score || '0–0')}</b></div><small class="ts-kap">tegen ${esc(r.tegen)}${r.veld ? ' · ' + esc(r.veld) : ''}</small></div>`).join('')}</div>`
  : `<div class="lb">Uitslagen</div><div class="be-lm">${m.klaar.slice(-3).map(r => `<div><div class="tt"><span class="ts-kap">${esc(r.eigen)}</span><b>${esc(r.score)}</b></div><small class="ts-kap">tegen ${esc(r.tegen)}</small></div>`).join('') || '<p class="be-stil">Nog geen standen vandaag.</p>'}</div>`);
const klokTegel = m => `<div class="be-t be-klok" style="grid-area:klok"><div class="lb ts-kap">${esc(m.dag)}</div><b>${klok}</b></div>`;
const topTegel = m => tegel('next', 2, 'club be-next', m.top
  ? `<div class="lb">Straks · ${esc(m.top.tijd)}</div><b style="${maat(m.top.a + m.top.b, 62, 22)}">${esc(m.top.a)} – ${esc(m.top.b)}</b><span>${esc(m.top.plek)}</span>`
  : `<div class="lb">Welkom</div><b style="${maat(m.club, 62, 14)}">${esc(m.club)}</b><span>Veel plezier vandaag!</span>`);
const sponsTegel = (m, weg, i = 0) => { const lijst = m.sponsors.filter(s => s !== weg), s = lijst.length ? lijst[i % lijst.length] : null;
  return tegel('spons', 3, 'wit be-sp', s ? `<div class="lb">${esc(bovenSponsor(s))}</div>${s.img ? beeld(s, 'be-logo') : `<b style="${maat(s.titel, 60, 16)}">${esc(s.titel)}</b>`}` : `<div class="lb">${esc(m.club)}</div><b>Welkom</b>`); };
const medTegel = m => tegel('med', 4, 'be-med', m.med ? `<div class="lb">Mededeling</div><p style="${maat(m.med, 30, 90)}">${esc(m.med)}</p>` : `<div class="lb">Vandaag</div><p>${m.rijen.length} ${m.rijen.length === 1 ? 'wedstrijd' : 'wedstrijden'} op het programma.</p>`);
const rest = (m, weg, i) => liveTegel(m) + klokTegel(m) + topTegel(m) + sponsTegel(m, weg, i) + medTegel(m);

export default {
  id: 'bento', per: 6, duur: 13000,
  kader: () => '',
  programma: (m, rijen, pag) => tegel('big', 0, 'be-groot', `<div class="lb">${esc(m.club)}${pag.van > 1 ? ` · ${pag.nr} / ${pag.van}` : ''}</div><h3>Vandaag op het park</h3>
    ${rijen.map(r => `<div class="be-r ${r.status}"><b>${esc(r.tijd || '–')}</b><span><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><small class="ts-kap">${esc(r.plek)}</small></span>${r.score ? `<em>${esc(r.score)}</em>` : '<em>vs</em>'}</div>`).join('') || '<p class="be-stil">Vandaag staan er geen wedstrijden op het programma.</p>'}`) + rest(m, null, pag.nr - 1),
  uitslagen: m => tegel('big', 0, 'be-groot', `<div class="lb">Vandaag</div><h3>Standen en uitslagen</h3>
    ${[...m.live, ...m.klaar].slice(0, 6).map(r => `<div class="be-r ${r.status}"><b>${esc(r.score || '0–0')}</b><span><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><small>${r.status === 'live' ? 'Nu bezig' + (r.veld ? ' · ' + esc(r.veld) : '') : 'Afgelopen'}</small></span><em>${r.status === 'live' ? 'live' : 'einde'}</em></div>`).join('')}`) + rest(m, null, 1),
  dia: (m, x) => tegel('big', 0, 'wit be-groot be-show', `<div class="lb">${esc(bovenSponsor(x) || m.club)}</div>${x.img ? beeld(x, 'be-plaat') : ''}<div class="n" style="${maatWoord(x.titel, x.img ? 110 : 190, x.img ? 14 : 9)}">${esc(x.titel)}</div>${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}`) + rest(m, x, 2),
  goal: (m, g) => `<div class="be-goal"><div class="be-t club a"><div class="lb">${stip} Doelpunt${g.veld ? ' · ' + esc(g.veld) : ''}</div><b>Goal!</b><span style="${maat(g.team, 90, 16)}">${esc(g.team)}</span></div>
    <div class="be-t wit b"><div class="lb">Stand</div><b>${standWissel(g)}</b><span class="ts-kap">${esc(g.a)} – ${esc(g.b)}</span></div></div>`,
  css: `
.ts-bento{background:#0c0d10}
.ts-bento .ts-scene{padding:44px;display:grid;grid-template-columns:1.15fr 1.15fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;gap:24px;grid-template-areas:"big big live klok" "big big live next" "big big spons med"}
.be-t{background:#191b20;border-radius:36px;padding:34px 36px;overflow:hidden;position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;transform-origin:50% 0}
.be-t .lb{font:600 22px/1.2 var(--ts-body);color:#8d93a0;display:flex;gap:10px;align-items:center;flex:none}
.be-t.club{background:var(--club);color:var(--club-ink)}.be-t.club .lb{color:inherit;opacity:.8}
.be-t.wit{background:#f3f3f1;color:#111}.be-t.wit .lb{color:#666}
.be-groot h3{margin:14px 0 18px;font:800 66px/1 var(--ts-display);text-transform:uppercase}
.be-r{display:grid;grid-template-columns:104px minmax(0,1fr) auto;gap:18px;align-items:center;padding:19px 0;border-top:1px solid #2b2e35;font:600 30px/1.15 var(--ts-body)}
.be-r>b{font:800 42px/1 var(--ts-display)}
.be-r>span{min-width:0;display:block}
.be-r small{display:block;font:500 21px/1.3 var(--ts-body);color:#8d93a0}
.be-r em{font:800 34px/1 var(--ts-display);font-style:normal;background:#2b2e35;border-radius:12px;padding:8px 14px}
.be-r.live em{background:#fff;color:#111}
.be-r.af span .ts-kap{text-decoration:line-through;color:#6c717c}
.be-stil{font:500 30px/1.3 var(--ts-body);color:#8d93a0;margin-top:20px}
.be-klok b{font:900 150px/.9 var(--ts-display);margin-top:auto}
.be-lm{margin-top:18px;display:grid;gap:14px}
.be-lm>div{background:#23262c;border-radius:22px;padding:20px 24px;min-width:0}
.be-lm .tt{font:800 40px/1 var(--ts-display);text-transform:uppercase;display:flex;justify-content:space-between;gap:10px}
.be-lm .tt b{background:#fff;color:#111;border-radius:10px;padding:2px 12px;flex:none}
.be-lm small{display:block;font:500 21px/1.4 var(--ts-body);color:#9aa0ab;margin-top:6px}
.be-next b{font:900 62px/.94 var(--ts-display);text-transform:uppercase;margin-top:auto}
.be-next span{font:600 26px/1.3 var(--ts-body);opacity:.85;margin-top:8px}
.be-sp b{font:900 60px/.92 var(--ts-display);text-transform:uppercase;margin-top:auto}
.be-logo{flex:1;min-height:0;display:grid;place-items:center;padding-top:14px}.be-logo img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.be-med p{font:600 30px/1.25 var(--ts-body);margin-top:auto}
.be-show{justify-content:flex-end;gap:22px}.be-show .lb{margin-bottom:auto}
.be-show .n{font:900 190px/.86 var(--ts-display);text-transform:uppercase;overflow-wrap:anywhere}
.be-show p{font:600 38px/1.25 var(--ts-body);white-space:pre-line}
.be-plaat{height:300px;display:flex;align-items:center}.be-plaat img{max-height:100%;max-width:80%;object-fit:contain;display:block}
.ts-bento .ts-in .be-t{animation:beIn .65s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(420ms + var(--i,0) * 90ms)}
.ts-bento .ts-uit .be-t{animation:beUit .35s ease-in both;animation-delay:calc(var(--i,0) * 45ms);transform-origin:50% 100%}
.ts-bento .ts-in .be-klok,.ts-bento .ts-uit .be-klok{animation:none}
@keyframes beIn{from{transform:perspective(1600px) rotateX(-85deg);opacity:0}}
@keyframes beUit{to{transform:perspective(1600px) rotateX(85deg);opacity:0}}
.be-goal{position:absolute;inset:0;background:#0c0d10;padding:44px;display:grid;grid-template-columns:1.5fr 1fr;gap:24px}
.be-goal .be-t{justify-content:flex-end;animation:beIn .7s cubic-bezier(.2,.8,.2,1) both}.be-goal .be-t.b{animation-delay:.18s}
.be-goal .lb{margin-bottom:auto;font-size:30px}
.be-goal .a b{font:900 420px/.8 var(--ts-display);text-transform:uppercase;animation:beBons .9s cubic-bezier(.3,1.5,.5,1) .5s both}
.be-goal .a span{font:800 90px/1 var(--ts-display);text-transform:uppercase;margin-top:20px}
.be-goal .b b{font:900 330px/.8 var(--ts-display)}
.be-goal .b>span{font:600 34px/1.3 var(--ts-body);margin-top:20px}
.ts-metband .be-goal{padding-bottom:242px}.ts-metband .be-goal .a b{font-size:340px}.ts-metband .be-goal .b b{font-size:280px}
@keyframes beBons{from{transform:scale(.4);opacity:0}}
`,
};
