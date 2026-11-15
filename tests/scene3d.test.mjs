/* [20261115b] Elke oefenvorm met looplijnen geeft stappen voor de 3D-weergave, met een leesbare tekst en zonder namen. */
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { stappenVan } from '../public/js/scene3d.js';
const fouten = [];
let stappen = 0, met = 0;
for (const v of BIBLIOTHEEK.vormen){
  const s = stappenVan(v), n = (v.tekening?.lijnen || []).length;
  if (s.length !== n) fouten.push(`${v.id}: ${s.length} stappen voor ${n} lijnen`);
  for (const x of s){ if (!/^[A-Z].{8,}\.$/.test(x.tekst)) fouten.push(`${v.id}: vreemde stap "${x.tekst}"`); }
  stappen += s.length; if (s.length) met++;
}
const y = stappenVan(BIBLIOTHEEK.vormen.find(v => v.id === 'pt-m-dubbele-y'));
if (!/speelt de bal naar speler 2/i.test(y[0].tekst)) fouten.push('dubbele Y: eerste stap is ' + y[0].tekst);
if (fouten.length){ console.log('FOUTEN:'); fouten.slice(0, 30).forEach(f => console.log(' ✗', f)); process.exit(1); }
console.log(`3D: ${met} vormen met ${stappen} stappen`);
