/* Maakt de schermafbeeldingen voor over.html uit de demomodus van de app (index.html?demo).
   Laptop (1440 × 900) en telefoon (390 × 844, 2×), in het lichte en het donkere thema.

   Gebruik (met de site lokaal gestart, bv. `npm run serve` op poort 5002):
     node tools/over-schermen.mjs [http://localhost:5002] [--donker] [--licht]
   Zonder --donker/--licht worden beide gemaakt. Nodig: puppeteer-core en Chrome
   (npm i -g puppeteer-core, of zet PUPPETEER_PAD naar een map met puppeteer-core).
   Schrijft naar public/over/app/<naam>.jpg (licht) en <naam>-donker.jpg (donker). */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let puppeteer;
for (const p of [process.env.PUPPETEER_PAD, 'puppeteer-core'].filter(Boolean)){
  try { puppeteer = require(p); break; } catch {}
}
if (!puppeteer){ console.error('puppeteer-core niet gevonden (npm i -g puppeteer-core, of zet PUPPETEER_PAD)'); process.exit(1); }
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium']
  .find(p => p && existsSync(p));

const args = process.argv.slice(2);
const BASIS = (args.find(a => /^https?:/.test(a)) || 'http://localhost:5002').replace(/\/$/, '');
const themas = args.includes('--donker') || args.includes('--licht')
  ? ['licht', 'donker'].filter(t => args.includes('--' + t)) : ['licht', 'donker'];
const UIT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'over', 'app');
const wacht = ms => new Promise(r => setTimeout(r, ms));
const TEAM = 'demo-o11-2';

/* laptop: [naam, stap in de desktop-schil (klik op een data-actie), of null voor het dashboard] */
const LAPTOP = [
  ['trainer-dashboard', null],
  ['trainer-evaluatie', '[data-actie=tab][data-tab=evaluatie]'],
  ['trainer-training', '[data-actie=tab][data-tab=presentietraining]'],
  ['bouwcoordinator', '[data-actie=bouwtoggle][data-bouw=onder]'],
  ['trainingscoordinator', '[data-actie=trainco]'],
];
/* telefoon: [naam, functie die in de app het scherm opent] */
const TELEFOON = [
  ['telefoon-vandaag', null],
  ['telefoon-wedstrijd', async pg => pg.evaluate(async () => {
    /* precies dezelfde module-URL's als de app (anders krijg je een tweede, lege kopie van de state) */
    const bron = await (await fetch('js/teams.js')).text();
    const v = naam => (bron.match(new RegExp("\\./" + naam + "\\.js\\?v=([\\w]+)")) || [])[1];
    const { S } = await import('./js/state.js?v=' + v('state'));
    const vandaag = new Date().toISOString().slice(0, 10);
    const w = [...(S.wedstrijden || [])].filter(x => x.datum > vandaag).sort((a, b) => a.datum.localeCompare(b.datum))[0];
    const m = await import('./js/wedstrijd.js?v=' + v('wedstrijd'));
    if (w) m.openWedstrijd(w.id);
  })],
  ['telefoon-training', async pg => {
    await openTab(pg, 'trainingen'); await wacht(2500);
    await pg.evaluate(() => document.querySelector('[data-open-training]')?.click());
  }],
  ['telefoon-evaluatie', async pg => openTab(pg, 'evaluatie')],
  ['telefoon-speeltijd', async pg => openTab(pg, 'stats')],
];
async function openTab(pg, tab){
  await pg.evaluate(async (team, tab) => {
    const bron = await (await fetch('js/main.js')).text();
    const v = (bron.match(/\.\/teams\.js\?v=(\w+)/) || [])[1];
    const m = await import('./js/teams.js?v=' + v);
    m.openTeam(team, tab);
  }, TEAM, tab);
}

async function nieuwePagina(browser, thema, telefoon){
  /* elke opname een eigen, schone sessie: de app onthoudt anders waar de vorige opname was */
  const ctx = await browser.createBrowserContext();
  const pg = await ctx.newPage();
  pg.sluit = () => ctx.close();
  pg.on('pageerror', e => console.warn('  [pagina]', e.message));
  await pg.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: thema === 'donker' ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (telefoon) await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  else await pg.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await pg.goto(BASIS + '/index.html?demo', { waitUntil: 'networkidle0' });
  await wacht(3500);
  return pg;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
for (const thema of themas){
  const achter = thema === 'donker' ? '-donker' : '';
  for (const [naam, klik] of LAPTOP){
    const pg = await nieuwePagina(browser, thema, false);
    if (klik){ await pg.evaluate(s => document.querySelector(s)?.click(), klik); await wacht(3000); }
    await pg.screenshot({ path: join(UIT, naam + achter + '.jpg'), type: 'jpeg', quality: 84 });
    await pg.sluit(); console.log('✓', naam + achter);
  }
  for (const [naam, stap] of TELEFOON){
    const pg = await nieuwePagina(browser, thema, true);
    if (stap){ await stap(pg); await wacht(3000); }
    await pg.screenshot({ path: join(UIT, naam + achter + '.jpg'), type: 'jpeg', quality: 82 });
    await pg.sluit(); console.log('✓', naam + achter);
  }
}
await browser.close();
