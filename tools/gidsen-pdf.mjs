/* Maakt van elke handleiding (public/js/gidsen-data.js) een PDF, en één boekje met alles.
   Dezelfde teksten, schermbeelden en stippen als Help in de app: draai eerst tools/gidsen-schermen.mjs.

   Gebruik (vanuit de map van de repo):
     node tools/gidsen-pdf.mjs            alle PDF's en het boekje
     node tools/gidsen-pdf.mjs 05 18      alleen deze handleidingen (het boekje wordt dan niet opnieuw gemaakt)
   Nodig: playwright met Chromium (zet PLAYWRIGHT_PAD naar index.mjs van het pakket als `import 'playwright'` niet lukt).

   Schrijft public/hulp/pdf/cluppie-handleiding-<nr>-<naam>.pdf en cluppie-handleiding-compleet.pdf. */
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HIER, '..', 'public');
const UIT = join(PUBLIC, 'hulp', 'pdf');
mkdirSync(UIT, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_PAD ? pathToFileURL(process.env.PLAYWRIGHT_PAD).href : 'playwright');
const { GIDSEN, GIDS_ROLLEN } = await import(pathToFileURL(join(PUBLIC, 'js', 'gidsen-data.js')).href);
const { BEELDEN } = await import(pathToFileURL(join(PUBLIC, 'js', 'gidsen-beelden.js')).href);

const kies = process.argv.slice(2).filter(a => !a.startsWith('--'));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const opmaak = t => String(t || '').split(/(\*\*[^*]+\*\*)/g).map(d => { const m = d.match(/^\*\*([^*]+)\*\*$/); return m ? `<b>${esc(m[1])}</b>` : esc(d); }).join('');
const data = (pad, type) => `data:${type};base64,${readFileSync(pad).toString('base64')}`;
const font = (naam, gewicht, bestand) => `@font-face{font-family:'${naam}';font-weight:${gewicht};src:url('${data(join(PUBLIC, 'fonts', bestand), 'font/woff2')}') format('woff2')}`;
const LOGO = data(join(PUBLIC, 'icons', 'icon-192.png'), 'image/png');
const VANDAAG = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

const CSS = `
${font('Inter', 400, 'inter-latin-400-normal.woff2')}${font('Inter', 600, 'inter-latin-600-normal.woff2')}${font('Inter', 700, 'inter-latin-700-normal.woff2')}
${font('Barlow Condensed', 700, 'barlow-condensed-latin-700-normal.woff2')}${font('Barlow Condensed', 800, 'barlow-condensed-latin-800-normal.woff2')}
@page{size:A4;margin:16mm 15mm 18mm}
*{box-sizing:border-box}
html{font-family:Inter,system-ui,sans-serif;font-size:10.5pt;line-height:1.5;color:#14181e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0}
.gids{break-before:page}
.gids:first-child{break-before:auto}
.kop{display:flex;gap:6mm;align-items:flex-start;padding-bottom:5mm;margin-bottom:6mm;border-bottom:1.2mm solid #c8211c}
.kop img{width:14mm;height:14mm;border-radius:3mm;flex:none}
.kop .nr{font-size:8.5pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#c8211c}
.kop h1{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:27pt;line-height:1;margin:.6mm 0 1.4mm;text-transform:uppercase}
.kop p{margin:0;color:#4a5560;font-size:11pt}
.meta{display:flex;flex-wrap:wrap;gap:2mm;margin-top:2.5mm}
.meta span{font-size:8pt;font-weight:600;padding:.6mm 2.4mm;border-radius:99px;background:#eef0f3;color:#4a5560}
.stap{break-inside:avoid;display:grid;gap:6mm;padding:5mm 0;border-bottom:.3mm solid #e2e5ea}
.stap:last-of-type{border-bottom:0}
.stap.telefoon{grid-template-columns:1fr 50mm;align-items:start}
.stap h2{display:flex;align-items:center;gap:2.5mm;margin:0 0 2mm;font-size:13pt;line-height:1.2}
.nrbol{flex:none;width:7mm;height:7mm;border-radius:50%;background:#14181e;color:#fff;display:grid;place-items:center;font-size:9.5pt;font-weight:700}
.stap p{margin:0}
.leg{list-style:none;margin:3mm 0 0;padding:0;display:flex;flex-wrap:wrap;gap:1.6mm}
.leg li{display:flex;align-items:center;gap:1.4mm;font-size:8.5pt;font-weight:600;padding:.5mm 2.4mm .5mm .6mm;border-radius:99px;background:#eef0f3}
.punt{width:4.6mm;height:4.6mm;border-radius:50%;background:#c8211c;color:#fff;display:grid;place-items:center;font-size:7.5pt;font-weight:700;line-height:1;flex:none}
.scherm{position:relative;line-height:0;overflow:hidden;background:#eef0f3}
.scherm img{display:block;width:100%;height:auto}
.scherm .punt{position:absolute;transform:translate(-50%,-50%);box-shadow:0 0 0 .5mm #fff}
.telefoon .scherm{border:1.4mm solid #14181e;border-radius:5mm}
.laptop .scherm{border:.3mm solid #c9ced6;border-top:3mm solid #14181e;border-radius:2mm}
.tips{break-inside:avoid;margin-top:6mm;padding:4mm 5mm;border-radius:3mm;background:#fff6e3;border:.3mm solid #f0d28a}
.tips h2{margin:0 0 1.5mm;font-size:11pt}
.tips ul{margin:0;padding-left:5mm}
.slot{margin-top:6mm;font-size:8.5pt;color:#6a7480}
/* boekje */
.voorblad{height:255mm;display:flex;flex-direction:column;justify-content:center;gap:6mm}
.voorblad img{width:26mm;height:26mm;border-radius:6mm}
.voorblad h1{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:54pt;line-height:.95;margin:0;text-transform:uppercase}
.voorblad h1 span{color:#c8211c}
.voorblad p{font-size:13pt;color:#4a5560;margin:0;max-width:130mm}
.inhoud{break-before:page}
.inhoud h2{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24pt;text-transform:uppercase;margin:0 0 5mm}
.inhoud table{width:100%;border-collapse:collapse}
.inhoud td{padding:2.2mm 0;border-bottom:.3mm solid #e2e5ea;vertical-align:top}
.inhoud td:first-child{width:11mm;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14pt;color:#c8211c}
.inhoud td small{display:block;color:#6a7480;font-size:8.5pt}
.inhoud td:last-child{text-align:right;font-size:8.5pt;color:#6a7480;white-space:nowrap}
`;

function htmlStap(s, n){
  const b = s.b && BEELDEN[s.b];
  const punten = b ? (b.p || []).map((p, i) => p ? `<span class="punt" style="left:${p[0]}%;top:${p[1]}%">${i + 1}</span>` : '').join('') : '';
  const leg = b && (s.m || []).some((_, i) => b.p && b.p[i]) ? `<ul class="leg">${s.m.map((l, i) => b.p && b.p[i] ? `<li><span class="punt">${i + 1}</span>${esc(l)}</li>` : '').join('')}</ul>` : '';
  const beeld = b ? `<div class="scherm"><img src="${data(join(PUBLIC, 'hulp', 'beeld', s.b + '.jpg'), 'image/jpeg')}" alt="">${punten}</div>` : '';
  return `<section class="stap ${b ? b.a : 'zonder'}"><div><h2><span class="nrbol">${n + 1}</span>${esc(s.t)}</h2><p>${opmaak(s.x)}</p>${leg}</div>${beeld}</section>`;
}
function htmlGids(g){
  return `<article class="gids">
    <header class="kop"><img src="${LOGO}" alt=""><div><div class="nr">Cluppie handleiding ${g.id}</div><h1>${esc(g.titel)}</h1><p>${esc(g.kort)}</p>
      <div class="meta"><span>Voor: ${esc(g.voor.map(v => GIDS_ROLLEN[v] || v).join(', '))}</span><span>${g.apparaat === 'laptop' ? 'Schermbeelden van de laptop' : 'Schermbeelden van de telefoon'}</span><span>${g.stappen.length} stappen</span></div></div></header>
    ${g.stappen.map(htmlStap).join('')}
    ${(g.tips || []).length ? `<div class="tips"><h2>Goed om te weten</h2><ul>${g.tips.map(t => `<li>${opmaak(t)}</li>`).join('')}</ul></div>` : ''}
    <p class="slot">Kom je er niet uit? Open in Cluppie de Hulpchat (onder Alles, of linksonder op de laptop) en stel je vraag. De schermbeelden komen uit de demo van Cluppie; bij jouw club kunnen namen en kleuren anders zijn.</p>
  </article>`;
}
const pagina = inhoud => `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${inhoud}</body></html>`;
const voet = titel => `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#6a7480;padding:0 15mm;display:flex;justify-content:space-between"><span>cluppie.io · ${esc(titel)} · ${VANDAAG}</span><span>pagina <span class="pageNumber"></span> van <span class="totalPages"></span></span></div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
async function maak(html, bestand, titel){
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const pad = join(UIT, bestand);
  await page.pdf({ path: pad, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: voet(titel), margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' } });
  console.log(`${bestand}  ${(statSync(pad).size / 1024).toFixed(0)} kB`);
}

const lijst = GIDSEN.filter(g => !kies.length || kies.includes(g.id));
for (const g of lijst) await maak(pagina(htmlGids(g)), `cluppie-handleiding-${g.id}-${g.slug}.pdf`, `Handleiding ${g.id} ${g.titel}`);

if (!kies.length){
  const voorblad = `<div class="voorblad"><img src="${LOGO}" alt=""><h1>Cluppie<br><span>handleiding</span></h1>
    <p>Alle ${GIDSEN.length} handleidingen in één boekje: van inloggen en trainingen tot de wedstrijddag, het clubbeheer en de kantine-tv. Elke stap met het echte scherm erbij.</p><p style="font-size:10pt">Uitgave van ${VANDAAG} · cluppie.io</p></div>`;
  const inhoud = `<div class="inhoud"><h2>Inhoud</h2><table>${GIDSEN.map(g => `<tr><td>${g.id}</td><td><b>${esc(g.titel)}</b><small>${esc(g.kort)}</small></td><td>${esc(g.voor.map(v => GIDS_ROLLEN[v] || v).join(', '))}</td></tr>`).join('')}</table></div>`;
  await maak(pagina(voorblad + inhoud + GIDSEN.map(htmlGids).join('').replace('<article class="gids">', '<article class="gids" style="break-before:page">')), 'cluppie-handleiding-compleet.pdf', 'Alle handleidingen');
}
await browser.close();
