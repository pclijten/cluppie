// Standaardbestemming bij de seizoensovergang.  Draaien: node --import ./tests/hulp/stub-loader.mjs tests/seizoen.test.mjs
import assert from 'node:assert/strict';
const { volgendeCategorie, standaardBestemming } = await import('../public/js/club-seizoen.js');
const teams = [
  { id: 'a', naam: 'JO11-1', categorie: 'JO11' }, { id: 'b', naam: 'JO11-2', categorie: 'JO11' },
  { id: 'c', naam: 'JO12-1', categorie: 'JO12' }, { id: 'd', naam: 'JO12-2', categorie: 'JO12' },
  { id: 'e', naam: 'JO13-1', categorie: 'JO13' }, { id: 'f', naam: 'JO15-1', categorie: 'JO15' },
  { id: 'g', naam: 'MO13-1', categorie: 'MO13' }, { id: 'h', naam: 'MO15-1', categorie: 'MO15' },
  { id: 'i', naam: 'JO19-1', categorie: 'JO19' }, { id: 's', naam: 'Eerste elftal', categorie: 'Senioren' },
];
const cats = teams.map(t => t.categorie);
assert.equal(volgendeCategorie('JO11', cats), 'JO12');
assert.equal(volgendeCategorie('JO13', cats), 'JO15', 'slaat ontbrekende JO14 over');
assert.equal(volgendeCategorie('MO13', cats), 'MO15', 'meiden blijven bij meiden');
assert.equal(volgendeCategorie('JO19', cats), null, 'JO19 schuift niet automatisch door');
assert.equal(standaardBestemming(teams[0], teams), 'c', 'JO11-1 → JO12-1');
assert.equal(standaardBestemming(teams[1], teams), 'd', 'JO11-2 → JO12-2');
assert.equal(standaardBestemming(teams[3], teams), 'e', 'JO12-2 → JO13-1 (geen JO13-2)');
assert.equal(standaardBestemming(teams[8], teams), '__blijft');
console.log('seizoensovergang: alle controles geslaagd');
