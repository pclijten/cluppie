/* TV-SJABLOON "WEDSTRIJDAVOND" [20261126q]: voetbal-tv met scorebalk, lower third en schuine kleurvlakken.
   Overgang: drie schuine banen vegen over het beeld. Zie docs/tv-sjablonen.md en tv-speler.js. */
import { esc, maat, maatWoord, stip, klok, beeld, label, bovenSponsor } from './tv-speler.js?v=20261126u';

const logo = m => m.logo ? `<span class="wa-logo"><img src="${esc(m.logo)}" alt=""></span>` : '<span class="wa-streep"></span>';
const rij = (r, i) => `<div class="wa-rij ts-a ${r.status}" style="--i:${i + 1}"><span class="t">${esc(r.tijd || '–')}</span>
  <span class="m"><b class="ts-kap">${esc(r.a)}</b><span class="vs ${r.score ? '' : 'leeg'}">${esc(r.score || 'vs')}</span><span class="ts-kap">${esc(r.b)}</span></span>
  <span class="v ts-kap">${esc(r.plek)}</span><span class="st">${r.status === 'live' ? stip + ' ' : ''}${label(r)}</span></div>`;

export default {
  id: 'wedstrijdavond', per: 6, duur: 12000,
  kader: m => `<div class="wa-bg"></div><div class="ts-abs wa-club">${logo(m)}<div><b class="ts-kap" style="${maat(m.club, 66, 20)}">${esc(m.club)}</b><i>${esc(m.dag)}</i></div></div>
    <div class="ts-abs wa-klok">${klok}</div>${m.med ? `<div class="ts-abs wa-lt"><b>Mededeling</b><span class="ts-kap">${esc(m.med)}</span></div>` : ''}`,
  programma: (m, rijen, pag) => `<div class="ts-abs wa-tab ts-a">Vandaag${pag.van > 1 ? ` · ${pag.nr}/${pag.van}` : ''}</div>
    <div class="ts-abs wa-lijst">${rijen.map(rij).join('') || '<div class="wa-leeg ts-a">Vandaag staan er geen wedstrijden op het programma.</div>'}</div>
    ${m.top ? `<div class="ts-abs wa-top ts-a" style="--i:4"><div class="e">Straks op het park</div><div class="tm"><span style="${maat(m.top.a, 92, 11)}">${esc(m.top.a)}</span><small>tegen</small><span style="${maat(m.top.b, 92, 11)}">${esc(m.top.b)}</span></div><div><div class="tijd">${esc(m.top.tijd)}</div><div class="meta">${esc(m.top.plek)}</div></div></div>`
      : `<div class="ts-abs wa-top ts-a" style="--i:4"><div class="e">${esc(m.dag)}</div><div class="tm"><small>Welkom bij</small><span style="${maat(m.club, 92, 11)}">${esc(m.club)}</span></div><div class="meta">Veel plezier vandaag!</div></div>`}`,
  uitslagen: m => { const l = m.live[0], rest = [...m.live.slice(1), ...m.klaar].slice(0, l ? 5 : 7);
    return `${l ? `<div class="ts-abs wa-live"><div class="wa-pil ts-a">${stip} Live${l.veld ? ' · ' + esc(l.veld) : ''}</div><div class="wa-bug ts-a" style="--i:1"><div class="h"><span class="ts-kap">${esc(l.a)}</span></div><div class="s">${esc(l.score || '0–0')}</div><div class="u"><span class="ts-kap">${esc(l.b)}</span></div></div></div>` : ''}
    <div class="ts-abs wa-uit ${l ? '' : 'hoog'}"><h3 class="ts-a" style="--i:2">${l ? 'Meer standen en uitslagen' : 'Uitslagen van vandaag'}</h3>${rest.map((r, i) => `<div class="wa-ur ts-a" style="--i:${i + 3}"><span class="ts-kap">${esc(r.a)}</span><b class="${r.status}">${esc(r.score || '–')}</b><span class="ts-kap">${esc(r.b)}</span></div>`).join('')}</div>`; },
  dia: (m, x) => `<div class="ts-abs wa-sp ts-a ${x.soort}"><div class="e">${esc(bovenSponsor(x) || m.club)}</div>${beeld(x, 'ts-beeld wa-img')}<div class="n" style="${maatWoord(x.titel, x.img ? 110 : 190, x.img ? 16 : 11)}">${esc(x.titel)}</div>${x.tekst ? `<div class="r">${esc(x.tekst)}</div>` : ''}</div>
    <div class="ts-abs wa-ook">${m.sponsors.filter(s => s !== x).slice(0, 4).map((s, i) => `<div class="ts-a ts-kap" style="--i:${i + 2}">${esc(s.titel)}</div>`).join('')}</div>`,
  goal: (m, g) => `<div class="wa-goal"><i></i><i></i><div class="in"><div class="k">Goal!</div><div class="w">${esc(g.team)}</div>
    <div class="wa-bug"><div class="h"><span class="ts-kap">${esc(g.a)}</span></div><div class="s">${esc(g.stand)}</div><div class="u"><span class="ts-kap">${esc(g.b)}</span></div></div>${g.veld ? `<div class="p">${esc(g.veld)}</div>` : ''}</div></div>`,
  fx: () => `<div class="wa-veeg" style="--i:0;background:var(--club)"></div><div class="wa-veeg" style="--i:1;background:#fff"></div><div class="wa-veeg" style="--i:2;background:#0b0d14"></div>`,
  css: `
.ts-wedstrijdavond{background:radial-gradient(1300px 900px at 88% 0%,color-mix(in oklab,var(--club) 50%,#0a0c14),#070910 70%)}
.wa-bg{position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 46px,rgba(255,255,255,.03) 46px 48px)}
.wa-bg::before{content:"";position:absolute;right:-260px;top:-120px;width:900px;height:1400px;background:var(--club);opacity:.16;transform:skewX(-18deg)}
.wa-club{left:64px;top:44px;display:flex;align-items:center;gap:22px;max-width:1300px}
.wa-logo{width:92px;height:92px;background:#fff;border-radius:18px;display:grid;place-items:center;flex:none}.wa-logo img{max-width:78%;max-height:78%;display:block}
.wa-streep{width:18px;height:86px;background:var(--club);transform:skewX(-14deg);flex:none;margin:0 6px}
.wa-club b{display:block;font:900 66px/.95 var(--ts-display);text-transform:uppercase;max-width:1150px}
.wa-club i{display:block;font:500 24px/1.3 var(--ts-body);font-style:normal;color:#c7cbd6}
.wa-klok{right:64px;top:52px;height:84px;clip-path:polygon(18px 0,100% 0,100% 100%,0 100%);background:#fff;color:#0b0d14;font:800 66px/84px var(--ts-display);padding:0 30px 0 44px}
.wa-lt{left:64px;right:64px;bottom:44px;height:80px;display:flex}
.wa-lt b{background:var(--club);color:var(--club-ink);font:800 34px/80px var(--ts-display);text-transform:uppercase;padding:0 46px 0 30px;clip-path:polygon(0 0,100% 0,calc(100% - 22px) 100%,0 100%);letter-spacing:.02em;flex:none}
.wa-lt span{background:#fff;color:#0b0d14;font:600 32px/80px var(--ts-body);flex:1;margin-left:-22px;clip-path:polygon(22px 0,100% 0,100% 100%,0 100%);padding:0 32px 0 52px}
.wa-tab{left:64px;top:182px;background:#fff;color:#0b0d14;font:800 40px/1 var(--ts-display);text-transform:uppercase;padding:12px 52px 10px 26px;clip-path:polygon(0 0,100% 0,calc(100% - 24px) 100%,0 100%)}
.wa-lijst{left:64px;top:252px;width:1120px;display:grid;gap:12px}
.wa-leeg{background:rgba(8,10,18,.78);border-left:8px solid var(--club);padding:40px 30px;font:600 36px/1.3 var(--ts-body)}
.wa-rij{height:92px;display:grid;grid-template-columns:118px minmax(0,1fr) 230px 170px;gap:0 12px;align-items:center;background:rgba(8,10,18,.78);border-left:8px solid var(--club);padding:0 24px}
.wa-rij .t{font:800 44px/1 var(--ts-display)}
.wa-rij .m{display:flex;gap:16px;align-items:center;font:600 30px/1.1 var(--ts-body);min-width:0}.wa-rij .m>b{flex:0 1 auto;min-width:min-content;max-width:48%}.wa-rij .m>.vs{flex:none}.wa-rij .m>span:last-child{flex:1 1 auto}
.wa-rij .m b{font:800 40px/1.1 var(--ts-display);text-transform:uppercase}
.wa-rij .vs{background:#fff;color:#0b0d14;font:800 36px/52px var(--ts-display);min-width:92px;text-align:center;padding:0 8px}
.wa-rij .vs.leeg{background:transparent;color:#8d94a3;box-shadow:inset 0 0 0 2px #3a4150}
.wa-rij .v{font:500 24px/1.2 var(--ts-body);color:#b9c0cc}
.wa-rij .st{justify-self:end;font:700 20px/1 var(--ts-body);text-transform:uppercase;letter-spacing:.06em;padding:10px 14px;background:#2a2f3c}
.wa-rij .st:empty{display:none}
.wa-rij.live .st{background:#fff;color:#0b0d14}
.wa-rij.af .m{color:#7d8494;text-decoration:line-through}.wa-rij.af .st{background:#4a1f24;color:#ffc9cc}
.wa-top{left:1236px;top:182px;width:620px;height:662px;background:var(--club);color:var(--club-ink);padding:44px 48px;display:flex;flex-direction:column;justify-content:space-between;clip-path:polygon(0 0,calc(100% - 70px) 0,100% 70px,100% 100%,0 100%)}
.wa-top .e{font:700 22px/1 var(--ts-body);letter-spacing:.14em;text-transform:uppercase;opacity:.85}
.wa-top .tm{font:900 92px/.9 var(--ts-display);text-transform:uppercase}.wa-top .tm span{display:block}
.wa-top .tm small{display:block;font:700 30px/1.6 var(--ts-body);text-transform:none;opacity:.8}
.wa-top .tijd{font:900 170px/.8 var(--ts-display)}
.wa-top .meta{font:600 28px/1.3 var(--ts-body);margin-top:14px}
.wa-live{left:270px;top:200px;width:1380px}
.wa-pil{display:inline-flex;gap:14px;align-items:center;background:#fff;color:#0b0d14;font:800 30px/1 var(--ts-display);text-transform:uppercase;padding:12px 20px;letter-spacing:.04em}
.wa-bug{display:grid;grid-template-columns:minmax(0,1fr) 260px minmax(0,1fr);height:150px;margin-top:18px}
.wa-bug>div{display:flex;align-items:center;padding:0 36px;font:900 70px/1 var(--ts-display);text-transform:uppercase;min-width:0}
.wa-bug .h{background:var(--club);color:var(--club-ink);justify-content:flex-end}
.wa-bug .s{background:#fff;color:#0b0d14;justify-content:center;font-size:124px;padding:0}
.wa-bug .u{background:#0b0d14;color:#fff}
.wa-uit{left:270px;top:470px;width:1380px;display:grid;gap:10px}.wa-uit.hoog{top:200px}
.wa-uit h3{margin:0 0 6px;font:800 34px/1 var(--ts-display);text-transform:uppercase;color:#c7cbd6}
.wa-ur{display:grid;grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr);height:66px;align-items:center;background:rgba(8,10,18,.78)}
.wa-ur span{font:700 34px/1.2 var(--ts-display);text-transform:uppercase;padding:0 28px}.wa-ur span:first-child{text-align:right}
.wa-ur b{background:#fff;color:#0b0d14;font:800 38px/66px var(--ts-display);text-align:center}.wa-ur b.live{background:var(--club);color:var(--club-ink)}
.wa-sp{left:64px;top:182px;width:1340px;height:662px;background:var(--club);color:var(--club-ink);padding:56px 130px 56px 72px;clip-path:polygon(0 0,100% 0,calc(100% - 90px) 100%,0 100%);display:flex;flex-direction:column;justify-content:center;gap:22px;align-items:flex-start}
.wa-sp.scherm{background:#fff;color:#0b0d14}
.wa-sp .e{font:700 24px/1 var(--ts-body);letter-spacing:.16em;text-transform:uppercase;opacity:.85}
.wa-sp .n{font:900 190px/.86 var(--ts-display);text-transform:uppercase;overflow-wrap:anywhere}
.wa-sp .r{font:600 38px/1.25 var(--ts-body);white-space:pre-line;max-width:1050px}
.wa-img{height:260px;max-width:760px}
.wa-ook{left:1440px;top:182px;width:416px;display:grid;gap:14px}
.wa-ook div{background:#fff;color:#0b0d14;font:800 36px/1.1 var(--ts-display);text-transform:uppercase;padding:26px}
.ts-wedstrijdavond .ts-in .ts-a{animation-name:waIn;animation-duration:.6s}
.ts-wedstrijdavond .ts-in .wa-top,.ts-wedstrijdavond .ts-in .wa-ook div{animation-name:waOp}
.ts-wedstrijdavond .ts-uit{animation:tsWeg .2s .25s both}
@keyframes waIn{from{clip-path:inset(0 100% 0 0);transform:translateX(-60px)}to{clip-path:inset(0 0 0 0)}}
@keyframes waOp{from{transform:translateY(70px);opacity:0}}
.wa-veeg{position:absolute;top:-20%;height:140%;width:130%;left:0;transform:translateX(-150%) skewX(-22deg);animation:waVeeg 1s cubic-bezier(.7,0,.25,1) both;animation-delay:calc(var(--i)*80ms)}
@keyframes waVeeg{to{transform:translateX(150%) skewX(-22deg)}}
.wa-goal{position:absolute;inset:0;background:#070910;animation:waGoalBg .4s both}
.wa-goal>i{position:absolute;top:-20%;height:140%;width:46%;background:var(--club);transform:skewX(-22deg);animation:waGoalBaan .7s cubic-bezier(.2,.8,.2,1) both}
.wa-goal>i:nth-child(1){left:-12%;background:linear-gradient(90deg,var(--club),var(--club-d))}.wa-goal>i:nth-child(2){right:-12%;background:#fff;opacity:.08;animation-delay:.1s}
.wa-goal .in{position:absolute;left:270px;right:270px;top:120px;text-shadow:0 4px 30px rgba(0,0,0,.75)}.wa-goal .wa-bug{text-shadow:none}
.wa-goal .k{font:900 330px/.8 var(--ts-display);font-style:italic;text-transform:uppercase;animation:waGoalK .8s cubic-bezier(.2,1.4,.4,1) .25s both;text-shadow:0 20px 60px rgba(0,0,0,.5)}
.wa-goal .w{font:800 64px/1.1 var(--ts-display);text-transform:uppercase;margin:24px 0 10px;animation:waOp .6s .6s both}
.wa-goal .wa-bug{animation:waIn .6s .8s both}
.wa-goal .p{font:600 30px/1 var(--ts-body);margin-top:22px;color:#c7cbd6;animation:waOp .6s 1s both}
@keyframes waGoalBg{from{opacity:0}}
@keyframes waGoalBaan{from{transform:translateY(-110%) skewX(-22deg)}}
@keyframes waGoalK{from{transform:scale(2.4) rotate(-6deg);opacity:0}}
`,
};
