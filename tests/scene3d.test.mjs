/* [20261115b] Elke oefenvorm met looplijnen geeft stappen voor de 3D-weergave, met een leesbare tekst en zonder namen. */
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { stappenVan } from '../public/js/scene3d.js';
const fouten = [];
let stappen = 0, met = 0;
for (const v of BIBLIOTHEEK.vormen){
  const s = stappenVan(v), n = (v.tekening?.lijnen || []).length;
  if (s.length !== n) fouten.push(`${v.id}: ${s.length} stappen voor ${n} lijnen`);
  for (const x of s){ if (!/^[A-ZÉ0-9].{8,}[.?!]$/.test(x.tekst)) fouten.push(`${v.id}: vreemde stap "${x.tekst}"`); }   /* [20261116i] een stap mag ook een vraag zijn */
  stappen += s.length; if (s.length) met++;
}
/* [20261116i] Een lijn met eigen tekst houdt die tekst; een lijn zonder tekst (eigen vormen van een club) krijgt een zin van de app. */
const y = stappenVan(BIBLIOTHEEK.vormen.find(v => v.id === 'pt-m-dubbele-y'));
if (!/starter speelt de middenspeler aan/i.test(y[0].tekst)) fouten.push('dubbele Y: eerste stap is ' + y[0].tekst);
const eigen = stappenVan({ naam: 'Eigen vorm', fase: 'spelvorm', veld: { b: 20, l: 20 }, tekening: { spelers: [{ nr: 1, x: 20, y: 80 }, { nr: 2, x: 60, y: 40 }], bal: [20, 80], lijnen: [{ soort: 'pass', punten: [[20, 80], [60, 40]] }] } });
if (!/speelt de bal naar speler 2/i.test(eigen[0].tekst)) fouten.push('eigen vorm zonder tekst: eerste stap is ' + eigen[0].tekst);
if (fouten.length){ console.log('FOUTEN:'); fouten.slice(0, 30).forEach(f => console.log(' ✗', f)); process.exit(1); }
console.log(`3D: ${met} vormen met ${stappen} stappen`);
