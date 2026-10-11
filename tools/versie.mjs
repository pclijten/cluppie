// Release-versie zetten: elke module die sinds <basis> is gewijzigd krijgt ?v=<versie> in ALLE
// imports die ernaar wijzen, en dat werkt door naar de modules die hem importeren (hun inhoud
// verandert immers ook). Zo laadt een browser nooit een oude module uit de cache (max-age 1 jaar)
// en bestaat een module nooit twee keer met verschillende ?v= (dubbele module-instanties).
// Ook styles.css en main.js in index.html en CACHE_VERSIE in sw.js.
//   node tools/versie.mjs 20261011d [origin/main]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const [versie, basis = 'origin/main'] = process.argv.slice(2);
if (!/^\d{8}[a-z]$/.test(versie || '')) { console.error('Gebruik: node tools/versie.mjs JJJJMMDDx [basis]'); process.exit(1); }
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const jsDir = path.join(root, 'js');
const bestanden = [...fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f)), path.join(root, 'index.html')];

const gewijzigd = new Set(execSync(`git diff --name-only ${basis} -- public`, { encoding: 'utf8' }).split('\n')
  .filter(Boolean).map(f => path.basename(f)).filter(f => /\.(js|css)$/.test(f)));
// nieuwe (ongetrackte) bestanden tellen ook
for (const f of execSync('git ls-files --others --exclude-standard -- public', { encoding: 'utf8' }).split('\n').filter(Boolean)) gewijzigd.add(path.basename(f));

const RE = /((?:\.\/|js\/)?)([A-Za-z0-9_-]+\.(?:js|css))\?v=([0-9]{8}[a-z]?)/g;
let ronde = 0, aangepast = new Set();
for (;;){
  ronde++; let nieuw = 0;
  for (const f of bestanden){
    const oud = fs.readFileSync(f, 'utf8');
    const s = oud.replace(RE, (m, pre, naam, v) => gewijzigd.has(naam) && v !== versie ? `${pre}${naam}?v=${versie}` : m);
    if (s !== oud){
      fs.writeFileSync(f, s); aangepast.add(path.basename(f));
      if (!gewijzigd.has(path.basename(f))){ gewijzigd.add(path.basename(f)); nieuw++; }
    }
  }
  if (!nieuw || ronde > 50) break;
}
const sw = path.join(root, 'sw.js');
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/CACHE_VERSIE = 'cluppie-v[0-9a-z]+'/, `CACHE_VERSIE = 'cluppie-v${versie}'`));
console.log(`versie ${versie}: ${gewijzigd.size} gewijzigde bestanden, ${aangepast.size} bestanden aangepast in ${ronde} ronde(s)`);
