/* [20261115a] Elke oefening in de bibliotheek heeft de 7 vaste velden:
   doel, tijdbestek (5/10/15/20, 20 alleen met een pauze erin), benodigdheden, uitleg, differentiatie, coachmomenten, spelvormen. */
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { zevenVelden } from '../public/js/oefenkaart.js';
const fouten = [];
const tekst = (x) => typeof x === 'string' && x.trim().length > 3;
for (const v of BIBLIOTHEEK.vormen.filter(v => v.fase !== 'afsluiting')){   /* afsluiting = uitlopen en terugblik, geen oefening */
  const f = (m) => fouten.push(`${v.id}: ${m}`);
  if (!tekst(v.doel)) f('geen doel');
  if (![5, 10, 15, 20].includes(v.tijd)) f(`tijd ${v.tijd} is geen 5, 10, 15 of 20`);
  if (v.tijd === 20 && v.duur.rondes[1] < 2) f('20 minuten zonder pauze');
  const mat = Object.values(v.materiaal || {}).reduce((a, n) => a + n, 0);
  if (!mat && !(v.materiaalExtra || []).length && v.fase !== 'afsluiting') f('geen benodigdheden');
  if (!tekst(v.uitleg) || !(v.organisatie || []).length) f('geen uitleg');
  if ((v.makkelijker || []).length < 2 || (v.moeilijker || []).length < 2) f('differentiatie: minstens 2 makkelijker en 2 moeilijker');
  if ((v.coachpunten || []).length < 3 || (v.coachvragen || []).length < 1) f('coachmomenten: minstens 3 punten en 1 vraag');
  if ((v.varianten || []).length < 2) f('minstens 2 spelvormen');
  const k = zevenVelden(v, { minuten: v.tijd });
  if (k.length !== 7 || k.some(x => !x.kort)) f('oefenkaart mist een veld');
}
if (fouten.length){ console.log('FOUTEN:'); fouten.slice(0, 40).forEach(x => console.log(' ✗', x)); process.exit(1); }
console.log(`zeven velden: ${BIBLIOTHEEK.vormen.length} oefeningen compleet`);
