/* Maakt de schermbeelden van de handleidingen (public/js/gidsen-data.js) uit de demo van de app.
   Nooit uit een echte club: de demo (index.html?demo=<rol>) draait volledig in het geheugen van de browser.

   Per stap met een beeld (`b`) opent dit script het scherm volgens tools/gidsen-opnames.mjs, zoekt de
   labels uit `m` op het scherm en zet daar de genummerde stippen. Staat een label niet (meer) op het
   scherm, dan meldt het script dat: zo merk je meteen dat de uitleg achterloopt op de app.

   Gebruik (vanuit de map van de repo):
     node tools/gidsen-schermen.mjs                 alle beelden
     node tools/gidsen-schermen.mjs 15 15-3         alleen handleiding 15, of alleen beeld 15-3
     node tools/gidsen-schermen.mjs --tekst 15-3    toont ook de tekst op het scherm (om labels te kiezen)
   Nodig: playwright met Chromium (zet PLAYWRIGHT_PAD naar index.mjs van het pakket als `import 'playwright'` niet lukt).
   KAART_TEGELS=<map>: speelt luchtfoto- en kaarttegels terug (tegels/z_x_y.jpeg en osm/z_x_y.pbf) waar internet dicht staat.

   Schrijft public/hulp/beeld/<naam>.jpg en public/js/gidsen-beelden.js (maat en plek van de stippen). */
import http from 'node:http';
import { readFile, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HIER, '..', 'public');
const UIT = join(PUBLIC, 'hulp', 'beeld');
const META_PAD = join(PUBLIC, 'js', 'gidsen-beelden.js');
mkdirSync(UIT, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_PAD ? pathToFileURL(process.env.PLAYWRIGHT_PAD).href : 'playwright');
const { GIDSEN } = await import(pathToFileURL(join(PUBLIC, 'js', 'gidsen-data.js')).href);
const { OPNAMES } = await import(pathToFileURL(join(HIER, 'gidsen-opnames.mjs')).href);

const args = process.argv.slice(2);
const TEKST = args.includes('--tekst');
const kies = args.filter(a => !a.startsWith('--'));
const TEGELS = process.env.KAART_TEGELS || '';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = normalize(join(PUBLIC, p)); if (!f.startsWith(PUBLIC)){ res.writeHead(403); return res.end(); }
  readFile(f, (e, d) => { if (e){ res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}`;

/* bestaande meta inlezen, zodat een deelrun de rest laat staan */
let META = {};
if (existsSync(META_PAD)){ try { META = JSON.parse(readFileSync(META_PAD, 'utf8').replace(/^[\s\S]*?export const BEELDEN = /, '').replace(/;\s*$/, '')); } catch { META = {}; } }

/* de stappen met een beeld, in volgorde */
const taken = [];
for (const g of GIDSEN) for (const s of g.stappen){
  if (!s.b) continue;
  if (kies.length && !kies.includes(g.id) && !kies.includes(s.b)) continue;
  if (taken.some(t => t.naam === s.b)) continue;
  taken.push({ naam: s.b, gids: g, stap: s });
}

const browser = await chromium.launch({ args: ['--lang=nl-NL'] });
let fouten = 0;
const SCHOON = '#melding,.demo-balk{visibility:hidden!important} *{caret-color:transparent!important;transition:none!important;animation-duration:0s!important;animation-delay:0s!important}';

for (const { naam, gids, stap } of taken){
  const op = OPNAMES[naam];
  if (!op){ console.log(`!! ${naam}: geen opname in tools/gidsen-opnames.mjs`); fouten++; continue; }
  const lap = op.laptop ?? (gids.apparaat === 'laptop');
  const vp = op.vp || (lap ? { width: 1180, height: 760 } : { width: 390, height: 844 });   /* laptop: zo smal als kan met het zijmenu erbij, dan blijft de tekst leesbaar */
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: lap ? 1 : 1.5, isMobile: !lap, hasTouch: !lap, colorScheme: 'light', locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => {
    const u = r.request().url();
    /* waar gstatic dicht staat: de twee cache-functies die bouw-hub.js rechtstreeks uit de SDK haalt (de demo heeft geen cache) */
    if (/gstatic\.com\/firebasejs\/.*firebase-firestore\.js/.test(u)) return r.fulfill({ contentType: 'text/javascript', body: "const nee = () => Promise.reject(new Error('geen cache in de demo')); export const getDocFromCache = nee; export const getDocsFromCache = nee;" });
    if (TEGELS){
      const m = u.match(/luchtfotorgb\/wmts\/v1_0\/[^/]+\/EPSG:3857\/(\d+)\/(\d+)\/(\d+)\.jpeg/); const f = m && join(TEGELS, 'tegels', `${m[1]}_${m[2]}_${m[3]}.jpeg`);
      if (f && existsSync(f)) return r.fulfill({ body: readFileSync(f), contentType: 'image/jpeg' });
      if (u === 'https://tiles.openfreemap.org/planet') return r.fulfill({ json: { tiles: ['https://tiles.openfreemap.org/planet/x/{z}/{x}/{y}.pbf'] } });
      const o = u.match(/openfreemap\.org\/planet\/x\/(\d+)\/(\d+)\/(\d+)\.pbf/); const of = o && join(TEGELS, 'osm', `${o[1]}_${o[2]}_${o[3]}.pbf`);
      if (of && existsSync(of)) return r.fulfill({ body: readFileSync(of), contentType: 'application/x-protobuf' });
      if (/locatieserver/.test(u)) return r.fulfill({ json: { response: { docs: [{ weergavenaam: 'Sportpark Cluppie, Utrecht', type: 'weg', centroide_ll: 'POINT(5.063968 52.075391)' }] } } });
    }
    return r.fallback();
  });
  /* de kantine-tv draait in een eigen venster (iframe) zonder ?demo: die krijgt dezelfde nagespeelde database als de app eromheen */
  let fbNamen = [];
  await page.route(/\/js\/firebase\.js/, r => r.request().frame() !== page.mainFrame() && !/[?&]demo/.test(r.request().frame().url()) && fbNamen.length
    ? r.fulfill({ contentType: 'text/javascript; charset=utf-8', body: 'const m = parent.__fb;\n' + fbNamen.map(n => `export const ${n} = m.${n};`).join('\n') }) : r.fallback());
  const meld = [];
  try {
    await page.goto(`${BASIS}/${op.url || 'index.html?demo=' + (op.rol || 'coach')}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1800);
    fbNamen = await page.evaluate(async () => { const u = [...document.querySelectorAll('script[type=importmap]')].map(x => JSON.parse(x.textContent).imports).flatMap(Object.keys).find(k => /firebase\.js/.test(k)); if (!u) return []; window.__fb = await import(u); return Object.keys(window.__fb).filter(n => n !== 'default'); }).catch(() => []);
    const k = await page.$('#rkBegrepen'); if (k){ await k.click().catch(() => {}); await page.waitForTimeout(300); }
    await page.addStyleTag({ content: SCHOON });
    for (const [soort, a, b] of (op.pad || [])){
      try {
        if (soort === 'wacht') await page.waitForTimeout(a);
        else if (soort === 'js'){ await page.evaluate(a); await page.waitForTimeout(b ?? 500); }
        else if (soort === 'klik'){ await page.locator(a).first().click({ timeout: 5000 }); await page.waitForTimeout(b ?? 800); }
        else if (soort === 'vul'){ await page.locator(a).first().fill(b, { timeout: 5000 }); await page.waitForTimeout(250); }
        else if (soort === 'kies'){ await page.locator(a).first().selectOption(b, { timeout: 5000 }); await page.waitForTimeout(400); }
        else if (soort === 'muis'){ await page.mouse.click(a, b); await page.waitForTimeout(600); }
        else if (soort === 'toets'){ await page.keyboard.press(a); await page.waitForTimeout(300); }
        else if (soort === 'rol'){ await page.locator(a).first().scrollIntoViewIfNeeded({ timeout: 5000 }); await page.evaluate(() => window.scrollBy(0, -90)); await page.waitForTimeout(300); }
      } catch (e){ meld.push(`${soort} ${JSON.stringify(a).slice(0, 70)}: ${e.message.split('\n')[0].slice(0, 90)}`); }
    }
    await page.addStyleTag({ content: SCHOON });
    /* labels opzoeken: eerst exact, dan als deel van de tekst; een eigen selector kan in de opname staan */
    const punten = [];
    const labels = stap.m || [];
    for (let i = 0; i < labels.length; i++){
      const label = labels[i];
      const eigen = op.punten && op.punten[label];
      const kandidaten = eigen ? [page.locator(eigen)] : [page.getByText(label, { exact: true }), page.getByText(label)];
      let rect = null;
      for (const loc of kandidaten){
        const n = Math.min(await loc.count(), 12);
        for (let j = 0; j < n && !rect; j++){
          const el = loc.nth(j);
          if (!(await el.isVisible().catch(() => false))) continue;
          if (i === 0 && !op.vast) await el.scrollIntoViewIfNeeded().catch(() => {});
          const r = await el.boundingBox();
          if (r && r.width > 0 && r.y >= 0 && r.y < vp.height - 6 && r.x >= 0 && r.x < vp.width) rect = r;
        }
        if (rect) break;
      }
      if (!rect){ meld.push(`label niet op het scherm: "${label}"`); punten.push(null); continue; }
      punten.push(rect);
    }
    /* na het scrollen de plekken opnieuw meten, in procenten van het beeld */
    const p = [];
    for (let i = 0; i < labels.length; i++){
      if (!punten[i]){ p.push(null); continue; }
      const label = labels[i]; const eigen = op.punten && op.punten[label];
      const loc = eigen ? page.locator(eigen) : page.getByText(label, { exact: true });
      let r = null; const n = Math.min(await loc.count(), 12);
      for (let j = 0; j < n && !r; j++){ const el = loc.nth(j); if (await el.isVisible().catch(() => false)){ const q = await el.boundingBox(); if (q && q.y >= 0 && q.y < vp.height - 6) r = q; } }
      if (!r){ const l2 = page.getByText(label); const n2 = Math.min(await l2.count(), 12); for (let j = 0; j < n2 && !r; j++){ const el = l2.nth(j); if (await el.isVisible().catch(() => false)){ const q = await el.boundingBox(); if (q && q.y >= 0 && q.y < vp.height - 6) r = q; } } }
      if (!r){ meld.push(`label uit beeld na scrollen: "${label}"`); p.push(null); continue; }
      /* de stip staat links naast het label; is daar geen ruimte, dan net erboven */
      const krap = r.x < 24;
      const x = Math.max(13, Math.min(vp.width - 13, r.x - 11)), y = Math.max(13, Math.min(vp.height - 13, krap ? r.y - 5 : r.y + Math.min(r.height / 2, 11)));
      p.push([Math.round(x / vp.width * 1000) / 10, Math.round(y / vp.height * 1000) / 10]);
    }
    await page.screenshot({ path: join(UIT, naam + '.jpg'), type: 'jpeg', quality: 78 });
    META[naam] = { w: vp.width, h: vp.height, a: lap ? 'laptop' : 'telefoon', p };
    if (TEKST) console.log((await page.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, '\n').slice(0, Number(process.env.TEKST_MAX) || 1400));
  } catch (e){ meld.push('mislukt: ' + e.message.split('\n')[0]); }
  if (meld.length) fouten++;
  console.log(`${meld.length ? '!!' : 'ok'} ${naam.padEnd(7)} ${gids.titel}${meld.length ? '\n     ' + meld.join('\n     ') : ''}`);
  await ctx.close().catch(() => {});
}
await browser.close(); server.close();

const geordend = Object.fromEntries(Object.keys(META).sort((a, b) => a.localeCompare(b, 'nl', { numeric: true })).map(k => [k, META[k]]));
writeFileSync(META_PAD, `/* Gemaakt door tools/gidsen-schermen.mjs: maat van elk schermbeeld en de plek van de stippen (in procenten).
   Niet met de hand wijzigen; draai het script opnieuw. */
export const BEELDEN = ${JSON.stringify(geordend, null, 0).replace(/\},"/g, '},\n"')};
`);
console.log(`\n${taken.length} beelden, ${fouten} met een melding.`);
process.exit(0);
