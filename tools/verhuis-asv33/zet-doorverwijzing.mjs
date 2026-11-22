// Zet de doorverwijspagina in een werkmap van de repo cluppieasv33 (de site cluppieasv33.nl, GitHub Pages).
// Pas draaien op het moment van de echte verhuizing: zodra dit op main van cluppieasv33 staat, gaat elk
// bezoek aan cluppieasv33.nl door naar www.cluppie.io. Zie VERHUIZING-ASV33.md.
//
//   node tools/verhuis-asv33/zet-doorverwijzing.mjs <pad-naar-werkmap-cluppieasv33> [--droog]
//
// Vervangt index.html, over.html, readme.html, nu-test.html en sw.js en voegt 404.html toe (voor elk ander pad).
// CNAME, het manifest en de iconen blijven staan: het icoon op het beginscherm van trainers blijft werken.
// De oude js/ en styles.css blijven staan (niemand laadt ze nog); opruimen kan later.
// Het script commit en pusht niet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const doel = process.argv[2], DROOG = process.argv.includes('--droog');
export const PAGINAS = ['index.html', '404.html', 'over.html', 'readme.html', 'nu-test.html'];
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  if (!doel || !fs.existsSync(path.join(doel, 'CNAME'))){ console.error('Gebruik: node tools/verhuis-asv33/zet-doorverwijzing.mjs <pad-naar-werkmap-cluppieasv33> [--droog]\n(de map moet het bestand CNAME van cluppieasv33.nl bevatten)'); process.exit(1); }
  const cname = fs.readFileSync(path.join(doel, 'CNAME'), 'utf8').trim();
  if (cname !== 'cluppieasv33.nl'){ console.error(`In ${doel} staat CNAME "${cname}", niet cluppieasv33.nl. Gestopt: dit is niet de site van ASV'33.`); process.exit(1); }
  const pagina = fs.readFileSync(path.join(HIER, 'doorverwijzing', 'doorverwijs.html'));
  for (const f of PAGINAS){ if (!DROOG) fs.writeFileSync(path.join(doel, f), pagina); console.log(`  ${f}`); }
  if (!DROOG) fs.copyFileSync(path.join(HIER, 'doorverwijzing', 'sw.js'), path.join(doel, 'sw.js'));
  console.log('  sw.js');
  console.log(DROOG ? '\nDroog: er is niets geschreven.' : `\nKlaar. Controleer met "git status" in ${doel}, commit en push naar main: daarna verwijst cluppieasv33.nl door.`);
}
