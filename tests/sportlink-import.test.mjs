// Vertaling Sportlink-teamnaam → Cluppie-team.  Draaien: node --import ./tests/hulp/stub-loader.mjs tests/sportlink-import.test.mjs
import assert from 'node:assert/strict';
const { teamVoorstel } = await import('../public/js/club-sportlink-import.js');
const C = 'SV Voorbeeld', A = 'SVV';
const v = n => teamVoorstel(n, C, A);
assert.deepEqual(v('SV Voorbeeld JO11-1'), { naam: 'JO11-1', categorie: 'JO11', geslacht: 'j', standaardAan: true });
assert.deepEqual(v('SV Voorbeeld MO15-2'), { naam: 'MO15-2', categorie: 'MO15', geslacht: 'm', standaardAan: true });
assert.equal(v('SV Voorbeeld JO8-3JM').naam, 'JO8-3');
assert.equal(v('SV Voorbeeld 1').naam, 'Eerste elftal');
assert.equal(v('SV Voorbeeld 3 (zat)').naam, 'Senioren 3 (zaterdag)');
assert.equal(v('SV Voorbeeld VR1').categorie, 'Vrouwen');
const f = v('SV Voorbeeld JO13-1 Futsal'); assert.equal(f.naam, 'JO13-1 Futsal'); assert.equal(f.standaardAan, false);
const o = v('SV Voorbeeld JO18-1'); assert.equal(o.categorie, null); assert.equal(o.standaardAan, false);
assert.equal(v('SV Voorbeeld 35+1').standaardAan, false);
console.log('teamVoorstel: alle controles geslaagd');
