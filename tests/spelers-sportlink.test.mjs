// Spelers uit Sportlink (20261012e): wie staat al in de selectie?
// Draaien: node --import ./tests/hulp/stub-loader.mjs tests/spelers-sportlink.test.mjs
import assert from 'node:assert/strict';
const { markeerBestaand } = await import('../public/js/teams-spelers.js');

const selectie = [
  { id: 'a', naam: 'Luuk', achternaam: 'Bakker' },
  { id: 'b', naam: 'Sém' },                         // geen achternaam, accent
  { id: 'c', naam: 'Jesse', _ingeleend: true },     // ingeleend telt niet
  { id: 'd', naam: 'Noor', gast: true },            // gast telt niet
];
const r = markeerBestaand([
  { voornaam: 'Luuk', achternaam: 'Bakker' },
  { voornaam: 'Luuk', achternaam: 'Peters' },      // andere Luuk
  { voornaam: 'Sem', achternaam: 'de Vries' },     // selectie zonder achternaam → zelfde Sem
  { voornaam: 'Jesse' }, { voornaam: 'Noor' }, { voornaam: 'Finn' },
], selectie);
assert.deepEqual(r.map(x => x.al), [true, false, true, false, false, false]);
assert.deepEqual(markeerBestaand([], selectie), []);
assert.deepEqual(markeerBestaand([{ voornaam: 'Luuk' }], []).map(x => x.al), [false]);
assert.deepEqual(markeerBestaand([{ voornaam: 'luuk' }], selectie).map(x => x.al), [true]);   // hoofdletters
console.log('spelers uit Sportlink: alle controles geslaagd');
