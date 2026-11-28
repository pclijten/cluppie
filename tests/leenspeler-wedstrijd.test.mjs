/* [20261128] Leenspeler voor één gekozen wedstrijd moet in het wedstrijdscherm
   doorkomen. Het wedstrijdscherm leest de wedstrijd met snap.data(), dat geen
   id heeft; wedstrijd.js zet die id er niet-opsombaar bij. */
import assert from 'node:assert/strict';
import { spelersOpWedstrijd, ontbrekendeLeners } from '../public/js/uitleen-regels.js';

const leen = { soort: 'periode', versie: 2, vanaf: '2026-11-28', tot: '2026-11-28',
  wed: { keuze: 'een', vanaf: '2026-11-28', tot: '2026-11-28', aantal: null,
         wedstrijden: [{ id: 'w1', datum: '2026-11-28', aftrap: '10:15', tegenstander: 'X' }] },
  train: null };
const spelers = [
  { id: 'dyon', naam: 'Dyon', nummer: 4 },
  { id: 'pim', naam: 'Pim', nummer: 4, _ingeleend: true, _leen: leen },
];
const data = { datum: '2026-11-28', selectie: ['dyon'] };   // zoals snap.data()

// Zonder id viel Pim weg (de oude fout).
assert.deepEqual(spelersOpWedstrijd(spelers, data).lijst.map(p => p.id), ['dyon']);

// Met de id zoals wedstrijd.js die nu zet: Pim hoort erbij en wordt aangevuld.
Object.defineProperty(data, 'id', { value: 'w1', enumerable: false, writable: true, configurable: true });
assert.deepEqual(spelersOpWedstrijd(spelers, data).lijst.map(p => p.id), ['dyon', 'pim']);
assert.deepEqual(ontbrekendeLeners(data, spelers), ['pim']);

// De id komt niet als veld in het opgeslagen document.
assert.ok(!Object.keys(data).includes('id'));
assert.ok(!JSON.stringify(data).includes('"id"'));

// Andere wedstrijd van dezelfde dag: Pim niet.
assert.deepEqual(spelersOpWedstrijd(spelers, { id: 'w2', datum: '2026-11-28' }).lijst.map(p => p.id), ['dyon']);
console.log('leenspeler-wedstrijd: ok');
