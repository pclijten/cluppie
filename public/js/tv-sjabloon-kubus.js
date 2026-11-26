/* TV-SJABLOON "KUBUS" [20261126q]: glazen panelen op een kubus die bij elke wissel een kwartslag draait.
   Naam, klok en de mededeling onderaan blijven staan. Zie docs/tv-sjablonen.md. */
import { esc, standWissel, maat, maatWoord, stip, lint, klok, beeld, bovenSponsor, label } from './tv-speler.js?v=20261127v';

const rij = r => `<div class="ku-m ${r.status}"><b>${esc(r.tijd || '–')}</b><div><span>${esc(r.a)} – ${esc(r.b)}</span><small class="ts-kap">${esc(r.plek)}</small></div>${r.score ? `<em>${esc(r.score)}</em>` : `<em class="l">${esc(label(r))}</em>`}</div>`;
const top = m => m.top ? `<div class="ku-top"><span>Straks · ${esc(m.top.tijd)}${m.top.plek ? ' · ' + esc(m.top.plek) : ''}</span><b style="${maat(m.top.a + m.top.b, 54, 22)}">${esc(m.top.a)} – ${esc(m.top.b)}</b></div>` : '';

export default {
  id: 'kubus', per: 8, duur: 13000,
  kader: m => `<div class="ts-abs ku-naam"><i></i><span style="${maat(m.club, 64, 26)}">${esc(m.club)}</span></div><div class="ts-abs ku-klok">${klok}</div>
    <div class="ts-abs ku-onder"><b>${m.med ? 'Mededeling' : 'Vandaag'}</b>${lint(`<span>${esc(m.med || m.dag)}</span>`, 30)}</div>`,
  programma: (m, rijen, pag) => `<div class="ku-3">
    <div class="ku-gl"><h3>Vandaag${pag.van > 1 ? ` <small>${pag.nr} / ${pag.van}</small>` : ''}</h3>${rijen.slice(0, 4).map(rij).join('') || '<p class="ku-stil">Vandaag staan er geen wedstrijden op het programma.</p>'}</div>
    <div class="ku-gl">${rijen.length > 4 ? `<h3>&nbsp;</h3>${rijen.slice(4).map(rij).join('')}` : `<h3>Welkom</h3><p class="ku-stil">Fijn dat je er bent. Veel plezier vandaag bij ${esc(m.club)}!</p>`}</div>
    <div class="ku-gl ku-col"><h3>${m.live.length ? stip + ' Nu bezig' : 'Uitslagen'}</h3>
      ${(m.live.length ? m.live : m.klaar.slice(-3)).slice(0, 3).map(r => `<div class="ku-l"><div class="tm"><span class="ts-kap">${esc(r.eigen)}</span><b>${esc(r.score || '0–0')}</b></div><small class="ts-kap">tegen ${esc(r.tegen)}${r.veld ? ' · ' + esc(r.veld) : ''}</small></div>`).join('') || '<p class="ku-stil">Nog geen standen.</p>'}
      ${top(m)}</div></div>`,
  uitslagen: m => { const groot = m.live[0] || m.klaar[m.klaar.length - 1];
    return `<div class="ku-2"><div class="ku-gl"><h3>Standen en uitslagen</h3>${[...m.live, ...m.klaar].slice(0, 6).map(r => `<div class="ku-rr ${r.status}"><span class="ts-kap">${esc(r.a)}</span><b>${esc(r.score || '0–0')}</b><span class="ts-kap">${esc(r.b)}</span></div>`).join('')}</div>
    <div class="ku-gl ku-col ku-kleur"><h3>${groot.status === 'live' ? stip + ' Nu bezig' : 'Afgelopen'}${groot.veld ? ' · ' + esc(groot.veld) : ''}</h3><div class="ku-wie" style="${maat(groot.a + groot.b, 46, 26)}">${esc(groot.a)} – ${esc(groot.b)}</div><div class="ku-big">${esc(groot.score || '0–0')}</div></div></div>`; },
  dia: (m, x) => { const ook = m.sponsors.filter(s => s !== x && s.titel).slice(0, 5);
    return `<div class="ku-2 ku-sp"><div class="ku-gl ku-col ku-kleur"><div class="e">${esc(bovenSponsor(x) || m.club)}</div>${beeld(x, 'ku-img')}<div class="n" style="${maatWoord(x.titel, x.img ? 110 : 190, x.img ? 16 : 10)}">${esc(x.titel)}</div>${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</div>
    <div class="ku-gl">${x.soort === 'sponsor' && ook.length ? `<h3>Ook dank aan</h3><div class="ku-ook">${ook.map(s => `<div class="ts-kap">${esc(s.titel)}</div>`).join('')}</div>` : `<h3>${m.live.length ? stip + ' Nu bezig' : 'Straks'}</h3>${(m.live.length ? m.live : m.straks).slice(0, 4).map(rij).join('') || '<p class="ku-stil">Veel plezier vandaag!</p>'}`}</div></div>`; },
  goal: (m, g) => `<div class="ku-goal"><div class="ku-gk"><div class="ku-gl ku-kleur">
    <div class="e">${stip} Doelpunt${g.veld ? ' · ' + esc(g.veld) : ''}</div><div class="gg">Goal!</div>
    <div class="st"><span style="${maat(g.a, 80, 14)}">${esc(g.a)}</span><b>${standWissel(g)}</b><span style="${maat(g.b, 80, 14)}">${esc(g.b)}</span></div></div></div></div>`,
  css: `
.ts-kubus,.ku-goal{background:radial-gradient(1500px 650px at 50% 112%,color-mix(in oklab,var(--club) 60%,transparent),transparent 62%),linear-gradient(#06070b,#0e1118)}
.ts-kubus .ts-scenes{inset:auto;left:80px;top:150px;width:1760px;height:770px;perspective:2600px}
.ts-kubus .ts-scene{backface-visibility:hidden}
.ku-naam{left:80px;top:46px;font:900 64px/1 var(--ts-display);text-transform:uppercase;display:flex;gap:18px;align-items:center;white-space:nowrap}
.ku-naam i{width:20px;height:56px;background:var(--club);display:block;transform:skewX(-14deg)}
.ku-klok{right:80px;top:40px;font:300 84px/1 var(--ts-body);letter-spacing:-.02em}
.ku-onder{left:80px;right:80px;bottom:44px;height:68px;border-radius:34px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;overflow:hidden}
.ku-onder>b{flex:none;height:100%;display:flex;align-items:center;padding:0 28px;background:var(--club);color:var(--club-ink);font:800 28px/1 var(--ts-display);text-transform:uppercase;border-radius:34px}
.ku-onder .ts-lintw{flex:1;font:500 30px/1 var(--ts-body)}.ku-onder .ts-lint span span{padding:0 60px}
.ku-gl{background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.035));border:1px solid rgba(255,255,255,.18);border-radius:30px;padding:36px 38px;box-shadow:0 40px 80px -40px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.2);min-width:0;overflow:hidden}
.ku-gl h3{margin:0 0 20px;font:800 46px/1 var(--ts-display);text-transform:uppercase;display:flex;gap:14px;align-items:center}
.ku-gl h3 small{font:600 24px/1 var(--ts-body);color:#b4bccb;margin-left:auto}
.ku-kleur{background:linear-gradient(150deg,color-mix(in oklab,var(--club) 70%,transparent),rgba(255,255,255,.04))}
.ku-col{display:flex;flex-direction:column}
.ku-3{display:grid;grid-template-columns:1.2fr 1.2fr 1fr;gap:28px;height:100%}
.ku-2{display:grid;grid-template-columns:1.5fr 1fr;gap:28px;height:100%}
.ku-m{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:14px;align-items:center;padding:17px 0;min-height:112px;border-top:1px solid rgba(255,255,255,.14)}
.ku-m>b{font:800 40px/1 var(--ts-display)}
.ku-m span{font:600 27px/1.2 var(--ts-body);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ku-m small{display:block;font:500 21px/1.35 var(--ts-body);color:#b4bccb}
.ku-m em{font:800 34px/1 var(--ts-display);font-style:normal;background:rgba(255,255,255,.92);color:#111;border-radius:10px;padding:7px 12px}
.ku-m em.l{background:rgba(255,255,255,.1);color:#d5dae3;font-size:24px;text-transform:uppercase}.ku-m em.l:empty{display:none}
.ku-m.af span,.ku-m.voorbij span{color:#7e8798}.ku-m.af span{text-decoration:line-through}
.ku-l{padding:20px 0;border-top:1px solid rgba(255,255,255,.14);min-width:0}
.ku-l .tm{font:800 40px/1.05 var(--ts-display);text-transform:uppercase;display:flex;justify-content:space-between;gap:12px}
.ku-l .tm b{font-size:52px;color:var(--club-l);flex:none}
.ku-l small{display:block;font:500 22px/1.35 var(--ts-body);color:#b4bccb}
.ku-stil{font:500 30px/1.35 var(--ts-body);color:#b4bccb}
.ku-top{margin-top:auto;background:var(--club);color:var(--club-ink);border-radius:22px;padding:22px 26px}
.ku-top b{display:block;font:900 54px/.95 var(--ts-display);text-transform:uppercase;margin-top:6px}
.ku-top span{font:600 23px/1.3 var(--ts-body)}
.ku-rr{display:grid;grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr);align-items:center;padding:19px 0;border-top:1px solid rgba(255,255,255,.14);font:800 38px/1.1 var(--ts-display);text-transform:uppercase}
.ku-rr span:first-child{text-align:right;padding-right:20px}.ku-rr span:last-child{padding-left:20px}
.ku-rr b{text-align:center;background:rgba(255,255,255,.92);color:#111;border-radius:12px;padding:8px 0}
.ku-rr.live b{background:var(--club);color:var(--club-ink)}
.ku-wie{font:800 46px/1.1 var(--ts-display);text-transform:uppercase}
.ku-big{font:900 280px/.8 var(--ts-display);margin-top:auto}
.ku-sp .ku-kleur{justify-content:flex-end}
.ku-sp .e,.ku-goal .e{font:700 24px/1 var(--ts-body);letter-spacing:.16em;text-transform:uppercase;opacity:.85;display:flex;gap:12px;align-items:center}
.ku-sp .e{margin-bottom:auto}
.ku-sp .n{font:900 190px/.84 var(--ts-display);text-transform:uppercase;overflow-wrap:anywhere}
.ku-sp p{font:600 36px/1.25 var(--ts-body);margin-top:18px;white-space:pre-line}
.ku-img{height:260px;align-self:flex-start;background:#fff;border-radius:20px;padding:22px 28px;display:flex;align-items:center;margin-bottom:26px}.ku-img img{max-height:100%;max-width:560px;object-fit:contain;display:block}
.ku-ook div{font:800 42px/1 var(--ts-display);text-transform:uppercase;padding:24px 0;border-top:1px solid rgba(255,255,255,.14)}
.ts-kubus .ts-scene.ts-in{transform-origin:0 50%;animation:kuIn 1s cubic-bezier(.65,0,.25,1) both .05s}
.ts-kubus .ts-scene.ts-uit{transform-origin:100% 50%;animation:kuUit 1s cubic-bezier(.65,0,.25,1) both .05s}
@keyframes kuIn{from{transform:translateX(100%) rotateY(90deg)}}
@keyframes kuUit{to{transform:translateX(-100%) rotateY(-90deg)}}
.ku-goal{position:absolute;inset:0;perspective:2400px;display:grid;place-items:center}
.ku-gk{width:1500px;height:800px;animation:kuTol 1.5s cubic-bezier(.2,.8,.2,1) both}
.ku-gk .ku-gl{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-radius:44px}
.ku-goal .e{font-size:32px}
.ku-goal .gg{font:900 430px/.82 var(--ts-display);text-transform:uppercase;font-style:italic;margin:10px 0 30px;animation:kuBons .8s cubic-bezier(.3,1.5,.5,1) 1.1s both}
.ku-goal .st{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:30px;align-items:center;width:100%;font:800 80px/1 var(--ts-display);text-transform:uppercase}
.ku-goal .st span{white-space:nowrap}.ku-goal .st span:first-child{text-align:right}.ku-goal .st span:last-child{text-align:left}
.ku-goal .st b{font:900 130px/1 var(--ts-display);background:#fff;color:#111;border-radius:22px;padding:6px 34px}
@keyframes kuTol{from{transform:rotateY(-540deg) scale(.2);opacity:0}}
@keyframes kuBons{from{transform:scale(.5);opacity:0}}
`,
};
