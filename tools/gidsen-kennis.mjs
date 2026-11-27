/* Schrijft functions/gidsen-kennis.js: de handleidingen (public/js/gidsen-data.js) als kennis voor de hulpchat.
   Zo weet de hulpchat precies wat er in Help staat en kan hij naar een stap verwijzen.

   Gebruik (vanuit de map van de repo):  node tools/gidsen-kennis.mjs
   Draai dit na elke wijziging in gidsen-data.js; tests/gidsen.test.mjs faalt als het bestand achterloopt. */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const { GIDSEN, GIDS_ROLLEN, SCHERMEN, platTekst } = await import(pathToFileURL(join(HIER, '..', 'public', 'js', 'gidsen-data.js')).href);

export function kennisTekst(){
  return GIDSEN.map(g => {
    const kop = `## HANDLEIDING ${g.id}: ${g.titel} (${g.kort}). Voor: ${g.voor.map(v => GIDS_ROLLEN[v] || v).join(', ')}.`
      + (g.plek ? ` Scherm: ${g.plek}.` : '') + (g.onderdeel ? ` Onderdeel dat per club aan of uit staat: ${g.onderdeel}.` : '');
    const stappen = g.stappen.map((s, i) => `[${g.id}#${i + 1}] ${s.t}: ${platTekst(s.x)}`);
    const tips = (g.tips || []).map(t => `Tip: ${platTekst(t)}`);
    return [kop, ...stappen, ...tips].join('\n');
  }).join('\n\n');
}
export function kennisBestand(){
  const stappen = Object.fromEntries(GIDSEN.map(g => [g.id, g.stappen.length]));
  return `/* Gemaakt door tools/gidsen-kennis.mjs uit public/js/gidsen-data.js. Niet met de hand wijzigen. */
const GIDS_KENNIS = ${JSON.stringify(kennisTekst())};
/* aantal stappen per handleiding, en de schermen waar de hulpchat naar mag verwijzen */
const GIDS_STAPPEN = ${JSON.stringify(stappen)};
const GIDS_SCHERMEN = ${JSON.stringify(SCHERMEN)};
module.exports = { GIDS_KENNIS, GIDS_STAPPEN, GIDS_SCHERMEN };
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  const pad = join(HIER, '..', 'functions', 'gidsen-kennis.js');
  writeFileSync(pad, kennisBestand());
  console.log(`functions/gidsen-kennis.js geschreven (${(kennisTekst().length / 1024).toFixed(1)} kB tekst, ${GIDSEN.length} handleidingen)`);
}
