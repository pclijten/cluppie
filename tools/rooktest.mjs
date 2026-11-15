/* Rooktest per gebruikerstype, in een echte browser, op de demo (index.html?demo=<rol>).
   Doel: vóór een release of een grote verbouwing (bijv. teams.js splitsen) zien of elk scherm nog opent
   zonder fouten, voor elke rol, op de telefoon (414 × 896) en de laptop (1440 × 900).
   Meet daarnaast per scherm: horizontaal schuiven, tikdoelen onder 44 px en contrast onder de WCAG-norm.

   Gebruik:  node tools/rooktest.mjs [--donker] [--rol=coach] [--kort]
   Nodig: puppeteer-core en Chrome (zelfde afspraak als tools/over-schermen.mjs: npm i -g puppeteer-core,
   of zet PUPPETEER_PAD naar een map met puppeteer-core). De site wordt zelf geserveerd vanuit public/.

   De demo kent geen toegangsregels: dit test wat de app een rol laat zien, niet wat de server toestaat
   (dat doen tests/rules.test.mjs, tests/audit-rules.test.mjs en tests/storage-rules.test.mjs).
   Sluit af met code 1 bij een fout in de console, een mislukte aanvraag of een scherm dat leeg blijft. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { existsSync, readFile } from 'node:fs';
import http from 'node:http';

const require = createRequire(import.meta.url);
let puppeteer;
for (const p of [process.env.PUPPETEER_PAD, 'puppeteer-core'].filter(Boolean)){ try { puppeteer = require(p); break; } catch { /* volgende */ } }
if (!puppeteer){ console.error('puppeteer-core niet gevonden (npm i -g puppeteer-core, of zet PUPPETEER_PAD)'); process.exit(2); }
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => p && existsSync(p));
if (!CHROME){ console.error('Chrome niet gevonden (zet CHROME_PATH)'); process.exit(2); }

const args = process.argv.slice(2);
const DONKER = args.includes('--donker'), KORT = args.includes('--kort');
const ALLEEN = (args.find(a => a.startsWith('--rol=')) || '').slice(6);
const ROLLEN = ['los', 'coach', 'eigenbouw', 'bouw', 'trainco', 'hjo', 'admin'].filter(r => !ALLEEN || r === ALLEEN);
const SCHERMEN = [{ naam: 'telefoon', width: 414, height: 896, isMobile: true, hasTouch: true }, { naam: 'laptop', width: 1440, height: 900, isMobile: false, hasTouch: false }];
const wacht = ms => new Promise(r => setTimeout(r, ms));

/* ---------- eigen statische server ---------- */
const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', 'public'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  readFile(f, (e, d) => { if (e){ res.writeHead(404); return res.end('niet gevonden'); } res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}`;

/* ---------- meten in de pagina ---------- */
function meet(){
  /* rgb(…), rgba(…) en color(srgb r g b / a): die laatste komt uit color-mix() en loopt van 0 tot 1 */
  const lum = c => {
    const m = (c.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number), srgb = /^color\(srgb/.test(c);
    const k = srgb ? m.slice(0, 3) : m.slice(0, 3).map(v => v / 255);
    const f = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return { L: 0.2126 * f(k[0] || 0) + 0.7152 * f(k[1] || 0) + 0.0722 * f(k[2] || 0), a: m[3] === undefined ? 1 : m[3] };
  };
  /* achtergrond: de eerste dekkende kleur omhoog. Ligt er een verloop of afbeelding onder de tekst, dan is het contrast zo niet te meten: null. */
  const bgVan = el => { let e = el; while (e){ const s = getComputedStyle(e); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const l = lum(s.backgroundColor); if (l.a > 0.9) return l.L; e = e.parentElement; } return lum(getComputedStyle(document.body).backgroundColor).L; };
  const zicht = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight * 4; };
  const naam = el => (el.id ? '#' + el.id : '.' + [...el.classList].slice(0, 2).join('.')) || el.tagName;
  const klein = new Map();
  for (const el of document.querySelectorAll('button, a[href], [role=button], select, input:not([type=hidden])')){
    if (!zicht(el)) continue;
    const r = el.getBoundingClientRect();
    /* het raakvlak telt: een ::after die de knop vergroot (blok TIKDOELEN in styles.css) */
    const na = getComputedStyle(el, '::after'), w = Math.max(r.width, parseFloat(na.width) || 0), h = Math.max(r.height, parseFloat(na.height) || 0);
    if (w < 43 || h < 43) klein.set(naam(el) + ' ' + Math.round(w) + 'x' + Math.round(h), true);
  }
  const laag = new Map();
  for (const el of document.querySelectorAll('body *')){
    if (!zicht(el)) continue;
    const tekst = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim().length > 1).map(n => n.textContent.trim()).join(' ');
    if (!tekst) continue;
    const s = getComputedStyle(el), fg = lum(s.color); if (fg.a < 0.5 || Number(s.opacity) < 0.5) continue;
    const bg = bgVan(el); if (bg === null) continue;
    const c = (Math.max(fg.L, bg) + 0.05) / (Math.min(fg.L, bg) + 0.05);
    const px = parseFloat(s.fontSize), groot = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight) >= 700);
    if (c < (groot ? 3 : 4.5)) laag.set(naam(el) + ' ' + c.toFixed(2) + ' ' + Math.round(px) + 'px "' + tekst.slice(0, 18) + '" ' + s.color.replace(/\s/g, ''), true);
  }
  const view = [...document.querySelectorAll('.view')].find(e => getComputedStyle(e).display !== 'none');
  return {
    view: view ? view.id : null, tekens: ((view || document.body).innerText || '').trim().length,
    schuift: document.documentElement.scrollWidth > innerWidth + 1,
    klein: [...klein.keys()], contrast: [...laag.keys()],
    thema: document.documentElement.getAttribute('data-thema') || document.documentElement.className,
  };
}

/* ---------- lopen ---------- */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const rijen = [], fouten = [];
for (const rol of ROLLEN){
  for (const sch of SCHERMEN){
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: sch.width, height: sch.height, isMobile: sch.isMobile, hasTouch: sch.hasTouch });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: DONKER ? 'dark' : 'light' }]);
    /* geen service worker in de test: die herlaadt de pagina na installatie en bewaart oude bestanden */
    await page.evaluateOnNewDocument(() => { try { const nooit = new Promise(() => {}); Object.defineProperty(navigator, 'serviceWorker', { get: () => ({ register: () => nooit, ready: nooit, controller: null, getRegistrations: async () => [], getRegistration: async () => undefined, addEventListener(){}, removeEventListener(){} }) }); } catch (e) { /* laat maar */ } });
    const waar = { scherm: 'start' };
    const meld = (soort, tekst) => fouten.push({ rol, apparaat: sch.naam, scherm: waar.scherm, soort, tekst: String(tekst).slice(0, 300) });
    page.on('pageerror', e => meld('fout in de pagina', e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED.*gstatic/.test(m.text())) meld('console', m.text()); });
    page.on('requestfailed', r => { if (r.url().startsWith(BASIS)) meld('aanvraag mislukt', r.url().replace(BASIS, '')); });
    page.on('response', r => { if (r.url().startsWith(BASIS) && r.status() >= 400) meld('http ' + r.status(), r.url().replace(BASIS, '')); });

    await page.goto(`${BASIS}/index.html?demo=${rol}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await wacht(2500);
    /* de rolkaart (eenmalige uitleg) sluiten zodat hij de meting niet afdekt; hij telt wel mee als scherm */
    const kaart = await page.$('#rkBegrepen');
    if (kaart){ waar.scherm = 'rolkaart'; rijen.push({ rol, apparaat: sch.naam, scherm: 'rolkaart', ...(await page.evaluate(meet)) }); await kaart.click(); await wacht(400); }
    waar.scherm = 'start';
    const start = await page.evaluate(meet);
    rijen.push({ rol, apparaat: sch.naam, scherm: 'start', ...start });
    if (start.tekens < 20) meld('leeg scherm', 'het startscherm heeft geen inhoud');

    /* telefoon: elke tegel van het teamscherm openen en weer terug */
    if (sch.isMobile && !KORT){
      const tabs = await page.evaluate(() => {
        const k = document.getElementById('hubAllesKnop'); if (k && k.getAttribute('aria-expanded') !== 'true') k.click();
        return [...new Set([...document.querySelectorAll('.hub-tegel[data-hub-open]')].map(b => b.dataset.hubOpen))];
      });
      for (const tab of tabs){
        waar.scherm = tab;
        const ok = await page.evaluate(t => {
          const k = document.getElementById('hubAllesKnop'); if (k && k.getAttribute('aria-expanded') !== 'true') k.click();
          const b = document.querySelector(`.hub-tegel[data-hub-open="${t}"]`); if (!b) return false; b.click(); return true;
        }, tab);
        if (!ok){ meld('tegel ontbreekt', tab); continue; }
        await wacht(900);
        const m = await page.evaluate(meet);
        rijen.push({ rol, apparaat: sch.naam, scherm: tab, ...m });
        if (m.tekens < 20) meld('leeg scherm', tab);
        const terug = await page.$('#naarTeams');
        if (terug){ await terug.click(); await wacht(500); }
        if (!(await page.$('#hubAllesKnop'))){ await page.goto(`${BASIS}/index.html?demo=${rol}`, { waitUntil: 'networkidle2' }); await wacht(1500); const k2 = await page.$('#rkBegrepen'); if (k2){ await k2.click(); await wacht(300); } }
      }
    }
    await ctx.close();
  }
}
await browser.close(); server.close();

/* ---------- verslag ---------- */
const som = (r, k) => r.reduce((n, x) => n + x[k].length, 0);
console.log(`\nRooktest ${DONKER ? 'donker' : 'licht'} thema: ${rijen.length} schermen, ${ROLLEN.length} rollen`);
console.log('rol        apparaat  schermen  schuift  klein  contrast');
for (const rol of ROLLEN) for (const sch of SCHERMEN){
  const r = rijen.filter(x => x.rol === rol && x.apparaat === sch.naam);
  console.log(`${rol.padEnd(10)} ${sch.naam.padEnd(9)} ${String(r.length).padStart(8)}  ${String(r.filter(x => x.schuift).length).padStart(7)}  ${String(som(r, 'klein')).padStart(5)}  ${String(som(r, 'contrast')).padStart(8)}`);
}
const tel = (k, alleen) => { const m = new Map(); for (const r of rijen.filter(alleen || (() => true))) for (const x of r[k]) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
console.log('\nTikdoelen onder 44 px op de telefoon (aantal schermen):');
for (const [x, n] of tel('klein', r => r.apparaat === 'telefoon').slice(0, 25)) console.log(`  ${String(n).padStart(3)}  ${x}`);
console.log('\nContrast onder de norm (aantal schermen):');
for (const [x, n] of tel('contrast').slice(0, 25)) console.log(`  ${String(n).padStart(3)}  ${x}`);
const schuif = rijen.filter(r => r.schuift).map(r => `${r.rol}/${r.apparaat}/${r.scherm}`);
if (schuif.length) console.log('\nHorizontaal schuiven: ' + schuif.join(', '));
if (fouten.length){
  console.log(`\nFOUTEN (${fouten.length}):`);
  for (const f of fouten.slice(0, 40)) console.log(`  ${f.rol}/${f.apparaat}/${f.scherm}: ${f.soort}: ${f.tekst}`);
  process.exit(1);
}
console.log('\nGeen fouten: elk scherm opent en heeft inhoud.');
