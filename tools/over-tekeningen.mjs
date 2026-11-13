/* Zet echte oefenvormen uit de trainingsbibliotheek als SVG in public/over.html.
   De tekeningen komen uit dezelfde tekenmodule als de app (js/trainingsvorm-svg.js),
   zodat de over-pagina laat zien wat een trainer echt krijgt.
   Gebruik:  node --no-warnings tools/over-tekeningen.mjs
   In over.html staat per tekening een blok:  <!--tekening:VORM-ID-->…<!--/tekening-->  */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const { BIBLIOTHEEK } = await import(pathToFileURL(join(root, 'js/trainingsbibliotheek.js')).href);
const { vormSvg } = await import(pathToFileURL(join(root, 'js/trainingsvorm-svg.js')).href);

const pad = join(root, 'over.html');
let html = readFileSync(pad, 'utf8');
let n = 0;
html = html.replace(/<!--tekening:([\w-]+)-->[\s\S]*?<!--\/tekening-->/g, (_, id) => {
  const vorm = BIBLIOTHEEK.vormen.find(v => v.id === id);
  if (!vorm) throw new Error('Onbekende vorm: ' + id);
  let svg = vormSvg(vorm, vorm.veld, { label: 'Tekening van de oefenvorm ' + vorm.naam });
  n++;
  /* pathLength op doorgetrokken lijnen, zodat ze zich op de pagina kunnen "tekenen" */
  svg = svg.replace(/<path d="([^"]+)" class="tv-lijn tv-(pass|dribbel|schot)"/g, '<path d="$1" pathLength="1" class="tv-lijn tv-$2"');
  /* de gegevens van de vorm erbij, voor de 3D-weergave (over/over-3d.js) */
  const data = JSON.stringify({ naam: vorm.naam, veld: vorm.veld, tekening: vorm.tekening }).replace(/</g, '\\u003c');
  return `<!--tekening:${id}-->${svg}<script type="application/json" data-vorm>${data}</script><!--/tekening-->`;
});
writeFileSync(pad, html);
console.log(`over.html: ${n} tekening(en) bijgewerkt`);
