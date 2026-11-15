// De lijst "Wat is er nieuw" (public/js/updates.json): geldig, nieuwste bovenaan, elke release compleet.
// Een typefout in dit bestand zou de lijst in de app leeg maken; daarom zit deze controle in npm test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lijst = JSON.parse(fs.readFileSync(new URL('../public/js/updates.json', import.meta.url), 'utf8'));
assert.ok(Array.isArray(lijst) && lijst.length > 100, 'een lijst met releases');
lijst.forEach((u, i) => {
  assert.match(u.datum, /^\d{4}-\d{2}-\d{2}$/, `release ${i + 1}: datum JJJJ-MM-DD`);
  assert.ok(typeof u.titel === 'string' && u.titel.trim().length > 3, `release ${i + 1}: titel`);
  assert.ok(Array.isArray(u.punten) && u.punten.length > 0 && u.punten.every(p => typeof p === 'string' && p.trim()), `release ${i + 1} (${u.titel}): punten`);
  assert.deepEqual(Object.keys(u).sort(), ['datum', 'punten', 'titel'], `release ${i + 1}: alleen datum, titel en punten`);
});
/* de app telt "nieuw" vanaf de bovenste release: die moet de nieuwste datum hebben (verderop staat de
   oude lijst niet overal strikt op datum; dat was al zo en verandert niets aan de melding) */
assert.equal(lijst[0].datum, lijst.map(u => u.datum).sort().at(-1), 'de nieuwste release staat bovenaan');
// de app zelf haalt de lijst op en bevat hem niet meer
const teams = fs.readFileSync(new URL('../public/js/teams.js', import.meta.url), 'utf8');
assert.ok(teams.includes("fetch('js/updates.json'") && !/const UPDATES = \[/.test(teams), 'teams.js haalt js/updates.json op');
console.log(`updates: ${lijst.length} releases in orde`);
