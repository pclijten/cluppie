/* TV-SJABLOON "VERTREKHAL" [20261126q]: een klapbord zoals op het station. Elke letter klapt om, rij voor rij.
   Alles staat in letterblokjes; een logo van een sponsor komt op zijn eigen dia in een wit vlak. Zie docs/tv-sjablonen.md. */
import { esc, klok, beeld, bovenSponsor } from './tv-speler.js?v=20261130g';

const schoon = s => String(s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[–—]/g, '-').replace(/[^A-Z0-9 .,:!?'&+\-\/·]/g, ' ');
/* Een tekst als rij blokjes van vaste lengte; te lang wordt afgekapt, te kort aangevuld met lege blokjes. */
const blok = (tekst, len, klasse = '') => `<span class="vh-g ${klasse}">${[...schoon(tekst).padEnd(len).slice(0, len)].map((ch, c) => `<span class="vh-f" style="--c:${c}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</span>`;
const midden = (tekst, len) => { const t = schoon(tekst).slice(0, len); return ' '.repeat(Math.floor((len - t.length) / 2)) + t; };
/* Lange tekst over meerdere rijen van `len` blokjes, op woordgrens. */
function regels(tekst, len, max){
  const uit = []; let r = '';
  for (const w of schoon(tekst).split(/\s+/).filter(Boolean)){ if ((r + ' ' + w).trim().length > len){ if (r) uit.push(r); r = w.slice(0, len); } else r = (r + ' ' + w).trim(); }
  if (r) uit.push(r);
  return uit.slice(0, max);
}
const status = r => r.status === 'live' ? `SPEELT ${r.score.replace('–', '-')}` : r.status === 'af' ? 'AFGELAST' : r.status === 'klaar' ? `EINDE ${r.score.replace('–', '-')}` : r.thuis ? '' : 'UIT';
const kop = (titel, m) => `<div class="ts-abs vh-kop"><b>${esc(titel)}</b><span class="ts-kap">${esc(m.club)} · ${esc(m.dag)}</span></div>`;

export default {
  id: 'vertrekhal', per: 7, duur: 13000,
  kader: () => `<div class="ts-abs vh-klok">${klok}</div>`,
  programma: (m, rijen, pag) => `${kop('VANDAAG', m)}<div class="ts-abs vh-bord"><div class="vh-lab"><span style="width:148px">Tijd</span><span style="width:838px">Wedstrijd</span><span style="width:268px">Veld</span><span style="width:118px">Kk</span><span>Status${pag.van > 1 ? ` · ${pag.nr}/${pag.van}` : ''}</span></div>
    ${rijen.map((r, i) => `<div class="vh-rij ${r.status}" style="--r:${i}">${blok(r.tijd, 5)}${blok(`${r.a} - ${r.b}`, 28)}${blok(r.veld, 9)}${blok(r.kk, 4)}${blok(status(r), 11, 'st')}</div>`).join('') || `<div class="vh-rij" style="--r:0">${blok('VANDAAG GEEN WEDSTRIJDEN', 57)}</div>`}
    ${m.med ? regels(m.med, 57, 2).map((t, i) => `<div class="vh-rij med" style="--r:${8 + i};${i ? '' : 'margin-top:26px'}">${blok(t, 57)}</div>`).join('') : ''}</div>`,
  uitslagen: m => `${kop('UITSLAGEN', m)}<div class="ts-abs vh-bord"><div class="vh-lab"><span style="width:748px">Thuis</span><span style="width:658px">Uit</span><span style="width:208px">Stand</span><span>Status</span></div>
    ${[...m.live, ...m.klaar].slice(0, 9).map((r, i) => `<div class="vh-rij ${r.status}" style="--r:${i}">${blok(r.a, 25)}${blok(r.b, 22)}${blok(r.score.replace('–', '-'), 7)}${blok(r.status === 'live' ? 'LIVE' : 'EINDE', 5, 'st')}</div>`).join('')}</div>`,
  dia: (m, x) => { const naam = regels(x.titel, 12, 2), groot = !x.img;
    return `${kop(x.soort === 'sponsor' ? 'SPONSOR' : 'NIEUWS', m)}<div class="ts-abs vh-dia">${bovenSponsor(x) ? `<div class="vh-rij med" style="--r:0">${blok(bovenSponsor(x), bovenSponsor(x).length)}</div>` : ''}
    ${x.img ? beeld(x, 'ts-beeld vh-img') : ''}
    ${naam.map((t, i) => `<div class="vh-rij ${groot ? 'groot' : 'middel'}" style="--r:${1 + i}">${blok(midden(t, 12), 12)}</div>`).join('')}
    ${regels(x.tekst, 44, 3).map((t, i) => `<div class="vh-rij med" style="--r:${4 + i}">${blok(midden(t, 44), 44)}</div>`).join('')}</div>`; },
  goal: (m, g) => `<div class="vh-goal"><div class="vh-dia"><div class="vh-rij groot goal" style="--r:0">${blok(' GOAL! ', 7)}</div>
    <div class="vh-rij middel" style="--r:2">${blok(midden(g.team, 22), 22)}</div>
    <div class="vh-rij med" style="--r:4">${blok(midden(`${g.a} ${g.stand.replace('–', '-')} ${g.b}`, 50), 50)}</div>${g.veld ? `<div class="vh-rij med" style="--r:5">${blok(midden(g.veld, 20), 20)}</div>` : ''}</div></div>`,
  css: `
.ts-vertrekhal{background:#0a0a0a;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace}
.vh-kop{left:72px;top:52px;display:flex;align-items:baseline;gap:28px;max-width:1500px}
.vh-kop b{font:800 70px/1 'JetBrains Mono',monospace;color:#ffc400;letter-spacing:.02em}
.vh-kop span{font:500 30px/1.2 var(--ts-body);color:#d7d7d7}
.vh-klok{right:72px;top:46px;font:800 84px/1 'JetBrains Mono',monospace;color:#fff}
.vh-bord{left:72px;top:190px;display:grid;gap:14px}
.vh-lab{display:flex;gap:16px;font:600 21px/1 var(--ts-body);color:#8a8a8a;text-transform:uppercase;letter-spacing:.1em;padding-bottom:4px}
.vh-rij{display:flex;gap:16px;perspective:500px}
.vh-g{display:flex;gap:2px}
.vh-f{display:inline-block;width:28px;height:60px;background:linear-gradient(#1f1f1f 0 49%,#0c0c0c 49% 51%,#191919 51%);border-radius:3px;font:700 40px/60px 'JetBrains Mono',monospace;text-align:center;color:#f2f2f2}
.vh-rij.live .st .vh-f{color:#3ddc84}
.vh-rij.af .vh-f{color:#8a8a8a}.vh-rij.af .st .vh-f{color:#ff5a4f}
.vh-rij.klaar .st .vh-f,.vh-rij.med .vh-f{color:#ffc400}
.vh-dia{left:0;right:0;top:210px;display:grid;justify-items:center;gap:14px;position:absolute}
.vh-rij.groot{gap:4px}.vh-rij.groot .vh-f{width:100px;height:160px;font-size:124px;line-height:160px}
.vh-rij.middel .vh-f{width:64px;height:104px;font-size:78px;line-height:104px}
.vh-rij.goal .vh-f{color:#ffc400;width:150px;height:230px;font-size:180px;line-height:230px}
.vh-img{height:230px;max-width:700px;margin:8px 0}
.ts-vertrekhal .ts-in .vh-f,.vh-goal .vh-f{animation:vhKlap .5s both;animation-delay:calc(300ms + var(--r,0) * 110ms + var(--c) * 16ms)}
.ts-vertrekhal .ts-in .vh-img{animation:vhKlap .6s .4s both}
.ts-vertrekhal .ts-uit .vh-f{animation:vhWeg .22s both;animation-delay:calc(var(--c) * 5ms)}
.ts-vertrekhal .ts-uit .vh-img,.ts-vertrekhal .ts-uit .vh-kop{animation:tsWeg .2s both}
@keyframes vhKlap{0%{transform:rotateX(90deg);color:transparent}45%{color:transparent}70%{transform:rotateX(-14deg)}100%{transform:none}}
@keyframes vhWeg{to{transform:rotateX(-90deg);color:transparent}}
.vh-goal{position:absolute;inset:0;background:#0a0a0a}
.vh-goal .vh-rij.goal .vh-f{animation:vhKlap .5s both,vhKnip 1s steps(1) 1.4s 6;animation-delay:calc(200ms + var(--c) * 90ms),1.4s}
@keyframes vhKnip{50%{color:#fff;background:#3a2c00}}
`,
};
