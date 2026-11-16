// [20261116k] Op desktop mag geen enkel dekkend, schermvullend scherm over de zijbalk vallen.
// Deze test leest styles.css en de modules en faalt als er een schermvullende laag met een dekkende achtergrond
// bijkomt die niet naast de zijbalk is gezet (styles.css, blok 20261116k) en niet bewust is uitgezonderd.
// Ook bewaakt hij dat desktop.js elke laag die naast de zijbalk staat kan sluiten bij een klik in de zijbalk.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; };

/* Bewust niet naast de zijbalk, met de reden. */
const UITZONDERING = {
  '.tc-app': 'trainingscoördinator en platformcentrum: eigen omgeving met een eigen zijbalk',
  '.deel-pagina': 'deelpagina voor ouders: buiten de app, er is geen zijbalk',
  '.vb-naslag': 'op desktop een paneel rechts (left:auto), bedekt de zijbalk niet',
};
/* Al eerder naast de zijbalk gezet (20261113b). */
const EERDER = ['.modal-achter', '.wz-achter'];

/* 1. alle schermvullende, dekkende lagen in styles.css (buiten @media-blokken: de basisregel) */
const dekkend = /background:\s*(var\(--(bg|paper|wit|card|surface)\)|#[0-9a-f]{3,8})\s*[;}]/i;
const lagen = [];
for (const m of css.matchAll(/(^|\})\s*([.#][\w-]+)\s*\{([^{}]*)\}/gm)){
  const sel = m[2], regel = m[3];
  if (/position:\s*fixed/.test(regel) && /inset:\s*0\b/.test(regel) && dekkend.test(regel)) lagen.push(sel);
}
ok(lagen.includes('.trw-overlay') && lagen.includes('.tb-board') && lagen.length >= 10, `de test vindt de bekende schermvullende lagen (${lagen.length})`);

/* 2. het blok dat ze naast de zijbalk zet */
const i = css.indexOf('[20261116k] Desktop: geen enkel dekkend scherm over de zijbalk');
ok(i > 0, 'het blok 20261116k staat in styles.css');
const blok = css.slice(i, css.indexOf('}\n', css.indexOf('#bouwhubPagina{', i)) + 1);
ok(/@media screen and \(min-width:1100px\)/.test(blok), 'alleen op het scherm (niet bij afdrukken) en alleen op desktop');
ok(/left:var\(--zij-w\)/.test(blok), 'de lagen beginnen rechts van de zijbalk');

for (const sel of lagen){
  if (UITZONDERING[sel] || EERDER.includes(sel)) continue;
  ok(blok.includes(`html.desk ${sel}`), `${sel} is schermvullend en dekkend: zet hem naast de zijbalk (styles.css, blok 20261116k) of zet hem met een reden bij UITZONDERING`);
}
for (const sel of EERDER) ok(new RegExp(`html\\.desk ${sel.replace('.', '\\.')}[^{]*\\{[^}]*left:var\\(--zij-w\\)`).test(css), `${sel} staat naast de zijbalk`);

/* 3. schermvullende lagen die een module zelf met een inline stijl maakt */
const js = readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js') && f !== 'trainingsbibliotheek.js');
for (const f of js){
  const bron = readFileSync(join(ROOT, 'js', f), 'utf8');
  for (const m of bron.matchAll(/(\w+)\.id\s*=\s*'([\w-]+)';\s*\n?\s*\1\.style\.cssText\s*=\s*'([^']*)'/g)){
    if (/position:fixed/.test(m[3]) && /inset:0/.test(m[3]) && /background:var\(--(bg|paper)\)/.test(m[3]))
      ok(blok.includes(`html.desk #${m[2]}`), `${f}: #${m[2]} is schermvullend en dekkend (inline stijl): zet hem naast de zijbalk`);
  }
}

/* 4. een klik in de zijbalk sluit elke laag uit het blok */
const desktop = readFileSync(join(ROOT, 'js', 'desktop.js'), 'utf8');
const sluit = desktop.slice(desktop.indexOf('async function sluitPaginaLagen'), desktop.indexOf('async function klik'));
ok(sluit.length > 200, 'desktop.js heeft sluitPaginaLagen');
for (const m of blok.matchAll(/html\.desk ([.#][\w-]+)/g)){
  const sel = m[1];
  ok(sel === '#bouwhubPagina' ? sluit.includes("'bouwhubPagina'") : sluit.includes(`'${sel}`), `desktop.js sluit ${sel} bij een klik in de zijbalk`);
}
ok(/await sluitPaginaLagen\(\);\s*\n\s*voerActieUit/.test(desktop), 'de zijbalk sluit eerst de lagen en navigeert dan');

/* 5. altijd 3D: geen keuze Tekening/3D en geen schuifjes meer */
const alles = js.map(f => readFileSync(join(ROOT, 'js', f), 'utf8')).join('\n');
ok(!/s3d-keuze|s3d-kijk|data-s3d-r=/.test(alles + css), 'de keuze Tekening/3D en de schuifjes Hoek en Draai zijn weg');
ok(/\.trw-teken\.wacht>\.trw-diagram,\.trw-teken\.is-3d>\.trw-diagram\{display:none\}/.test(css), 'de tekening is de terugval onder het 3D-veld');
ok(/@media print\{[^@]*\.trw-teken>\.trw-diagram\{display:block !important\}/.test(css), 'bij afdrukken staat de tekening er');

console.log(`zijbalk vrij en altijd 3D: ${n} controles, ${lagen.length} schermvullende lagen`);
