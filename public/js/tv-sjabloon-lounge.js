/* TV-SJABLOON "LOUNGE" [20261126q]: rustig en chic, voor de bestuurskamer of businessclub. Schreefletters,
   veel ruimte en zacht bewegend licht in de clubkleur; een wissel is een trage vervaging. Zie docs/tv-sjablonen.md. */
import { esc, maat, stip, klok, beeld, bovenSponsor } from './tv-speler.js?v=20261126q';

/* Het laatste woord cursief in de clubkleur. */
const sier = t => { const w = String(t || '').trim().split(/\s+/); const l = w.pop(); return `${esc(w.join(' '))}${w.length ? ' ' : ''}<i>${esc(l)}</i>`; };
const rechts = r => r.status === 'live' ? `${stip} ${esc(r.score || '0–0')}` : r.status === 'af' ? 'afgelast' : r.status === 'klaar' ? esc(r.score || 'gespeeld') : esc(r.plek);
const zin = m => { const n = m.rijen.length; if (!n) return 'Vandaag staan er geen wedstrijden op het programma.';
  return `${n} ${n === 1 ? 'wedstrijd' : 'wedstrijden'} vandaag${m.live.length ? `, ${m.live.length} nu bezig` : ''}.${m.top ? ` Om ${esc(m.top.tijd)} ${esc(m.top.a)} tegen ${esc(m.top.b)}.` : ''}`; };

export default {
  id: 'lounge', per: 7, duur: 15000,
  kader: m => `<div class="lo-licht"><i></i><i></i><i></i></div><div class="ts-abs lo-top"><span class="ts-kap">${esc(m.club)} · ${esc(m.dag)}</span><b>${klok}</b></div>
    ${m.med ? `<div class="ts-abs lo-med ts-kap">${esc(m.med)}</div>` : ''}`,
  programma: (m, rijen, pag) => `<div class="ts-abs lo-h"><div class="e">Programma${pag.van > 1 ? ` · ${pag.nr} van ${pag.van}` : ''}</div><h3>Vandaag bij <i style="${maat(m.club, 168, 12)}">${esc(m.club)}</i></h3><p>${zin(m)}</p></div>
    <div class="ts-abs lo-l">${rijen.map(r => `<div class="${r.status}"><b>${esc(r.tijd || '–')}</b><span class="ts-kap">${esc(r.a)} – ${esc(r.b)}</span><small>${rechts(r)}</small></div>`).join('')}</div>`,
  uitslagen: m => { const groot = m.live[0] || m.klaar[m.klaar.length - 1], ander = [...m.live, ...m.klaar].filter(r => r !== groot).slice(0, 3);
    return `<div class="ts-abs lo-h lo-hk"><div class="e">${groot.status === 'live' ? stip + ' Tussenstand' : 'Eindstand'}${groot.veld ? ' · ' + esc(groot.veld) : ''}</div></div>
    <div class="ts-abs lo-sc">${esc((groot.score || '0–0').replace('–', ' – '))}</div>
    <div class="ts-abs lo-sct"><span class="ts-kap">${esc(groot.a)} tegen ${esc(groot.b)}</span>${ander.length ? `<small class="ts-kap">Verder: ${ander.map(r => `${esc(r.eigen)} ${esc(r.score || '0–0')}`).join(' · ')}</small>` : ''}</div>`; },
  dia: (m, x) => { const ook = m.sponsors.filter(s => s !== x && s.titel).slice(0, 4);
    return `<div class="ts-abs lo-sp"><div class="e">${esc(bovenSponsor(x) || m.club)}</div>${beeld(x, 'lo-img')}<h3 style="${maat(x.titel, x.img ? 150 : 230, x.img ? 22 : 15)}">${sier(x.titel)}</h3>${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</div>
    ${x.soort === 'sponsor' && ook.length ? `<div class="ts-abs lo-ook">${ook.map(s => `<span class="ts-kap">${esc(s.titel)}</span>`).join('')}</div>` : ''}`; },
  goal: (m, g) => `<div class="lo-goal"><div class="lo-licht"><i></i><i></i><i></i></div>
    <div class="e">${stip} Doelpunt${g.veld ? ' · ' + esc(g.veld) : ''}</div>
    <div class="sc">${esc(g.stand.replace('–', ' – '))}</div><div class="lijn"></div>
    <div class="t"><i>${esc(g.team)}</i> scoort.<small class="ts-kap">${esc(g.a)} tegen ${esc(g.b)}</small></div></div>`,
  css: `
.ts-lounge,.lo-goal{background:#0b0a0e}
.lo-licht{position:absolute;inset:-200px;filter:blur(110px);opacity:.75}
.lo-licht i{position:absolute;border-radius:50%;animation:loZweef 26s ease-in-out infinite alternate}
.lo-licht i:nth-child(1){width:1000px;height:800px;left:1100px;top:100px;background:var(--club)}
.lo-licht i:nth-child(2){width:800px;height:700px;left:300px;top:800px;background:color-mix(in oklab,var(--club) 45%,#d89a4a);animation-duration:34s}
.lo-licht i:nth-child(3){width:600px;height:600px;left:1700px;top:1000px;background:#1d3b4a;animation-duration:30s}
/* Bij een lichte clubkleur (geel, wit) dimt het licht, anders valt de witte tekst weg. */
.ts-licht .lo-licht i:nth-child(1){background:color-mix(in oklab,var(--club) 48%,#0b0a0e)}.ts-licht .lo-licht i:nth-child(2){background:color-mix(in oklab,var(--club) 30%,#5a3a1a)}
@keyframes loZweef{to{transform:translate(-220px,140px) scale(1.2)}}
.lo-top{left:120px;right:120px;top:64px;display:flex;justify-content:space-between;align-items:baseline;gap:40px;font:600 22px/1.3 var(--ts-body);letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.75)}
.lo-top b{font:400 70px/1 'Instrument Serif',Georgia,serif;letter-spacing:0;color:#fff;flex:none}
.lo-med{left:120px;right:120px;bottom:52px;font:400 34px/1.3 'Instrument Serif',Georgia,serif;font-style:italic;color:rgba(255,255,255,.85);border-top:1px solid rgba(255,255,255,.2);padding-top:22px}
.ts-lounge .e,.lo-goal .e{font:600 22px/1 var(--ts-body);letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.7);display:flex;gap:14px;align-items:center}
.lo-h{left:120px;top:210px;width:820px}
.lo-hk{top:170px}
.lo-h h3{margin:26px 0 30px;font:400 168px/.92 'Instrument Serif',Georgia,serif}
.lo-h h3 i,.lo-sp h3 i{color:var(--club-l)}.lo-h h3 i{display:block;white-space:nowrap;line-height:1.02}
.lo-h p{font:400 32px/1.45 var(--ts-body);color:rgba(255,255,255,.8);max-width:680px}
.lo-l{left:1040px;top:200px;width:760px}
.lo-l div{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:22px;align-items:baseline;padding:21px 0;border-top:1px solid rgba(255,255,255,.2)}
.lo-l div:last-child{border-bottom:1px solid rgba(255,255,255,.2)}
.lo-l b{font:500 28px/1 var(--ts-body);color:rgba(255,255,255,.7)}
.lo-l span{font:400 42px/1.1 'Instrument Serif',Georgia,serif}
.lo-l small{font:500 21px/1 var(--ts-body);color:rgba(255,255,255,.65);text-align:right;white-space:nowrap}
.lo-l .live small{color:#fff;font-size:26px}
.lo-l .af span{text-decoration:line-through;opacity:.5}.lo-l .voorbij span,.lo-l .klaar span{opacity:.7}
.lo-sc{left:110px;top:230px;font:400 430px/.8 'Instrument Serif',Georgia,serif;letter-spacing:-.02em;white-space:nowrap}
.lo-sct{left:120px;top:630px;width:1500px;font:400 60px/1.15 'Instrument Serif',Georgia,serif;font-style:italic}
.lo-sct span,.lo-sct small{display:block}
.lo-sct small{font:500 24px/1.6 var(--ts-body);font-style:normal;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-top:20px}
.lo-sp{left:120px;top:220px;right:120px}
.lo-sp h3{margin:26px 0 24px;font:400 230px/.9 'Instrument Serif',Georgia,serif}
.lo-sp p{font:400 34px/1.4 var(--ts-body);color:rgba(255,255,255,.85);white-space:pre-line;max-width:1300px}
.lo-img{height:230px;margin-top:30px;display:inline-flex;align-items:center;background:#fff;border-radius:6px;padding:24px 32px}.lo-img img{max-height:100%;max-width:600px;object-fit:contain;display:block}
.lo-ook{left:120px;right:120px;bottom:130px;display:flex;gap:56px;font:400 38px/1.1 'Instrument Serif',Georgia,serif;color:rgba(255,255,255,.75);border-top:1px solid rgba(255,255,255,.2);padding-top:26px}
.ts-lounge .ts-scene.ts-in{animation:loIn 1.5s cubic-bezier(.2,.7,.2,1) both .15s}
.ts-lounge .ts-scene.ts-uit{animation:loUit 1s ease both}
@keyframes loIn{from{opacity:0;filter:blur(26px);transform:scale(1.06)}}
@keyframes loUit{to{opacity:0;filter:blur(26px);transform:scale(.97)}}
.lo-goal{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.lo-goal>*{position:relative}.lo-goal .lo-licht{position:absolute;opacity:.95}
.lo-goal .e{animation:loIn 1.2s ease both}
.lo-goal .sc{font:400 520px/.86 'Instrument Serif',Georgia,serif;letter-spacing:-.02em;animation:loIn 1.6s cubic-bezier(.2,.7,.2,1) .2s both}
.lo-goal .lijn{width:900px;height:1px;background:rgba(255,255,255,.5);margin:26px 0 30px;animation:loLijn 1.4s cubic-bezier(.2,.7,.2,1) .7s both}
.lo-goal .t{font:400 76px/1.1 'Instrument Serif',Georgia,serif;animation:loIn 1.4s ease .9s both;max-width:1600px}
.lo-goal .t i{color:var(--club-l)}
.lo-goal .t small{display:block;font:500 24px/1.6 var(--ts-body);letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-top:18px}
@keyframes loLijn{from{transform:scaleX(0)}}
`,
};
