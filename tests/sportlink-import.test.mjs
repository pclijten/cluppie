// Vertaling Sportlink-teamnaam → Cluppie-team.  Draaien: node --import ./tests/hulp/stub-loader.mjs tests/sportlink-import.test.mjs
import assert from 'node:assert/strict';
const { teamVoorstel, voorvoegselUit } = await import('../public/js/club-sportlink-import.js');
const { catLabel } = await import('../public/js/config.js');
const C = 'SV Voorbeeld', A = 'SVV';
const v = n => teamVoorstel(n, C, A);

/* weergave: jongens O17, meiden houden de M */
assert.equal(catLabel('JO17'), 'O17');
assert.equal(catLabel('MO20'), 'MO20');
assert.equal(catLabel('Senioren'), 'Senioren');
assert.equal(catLabel(''), '');

assert.deepEqual(v('SV Voorbeeld JO11-1'), { naam: 'O11-1', categorie: 'JO11', geslacht: 'j', standaardAan: true });
assert.deepEqual(v('SV Voorbeeld MO15-2'), { naam: 'MO15-2', categorie: 'MO15', geslacht: 'm', standaardAan: true });
assert.deepEqual(v('SV Voorbeeld O13-2'), { naam: 'O13-2', categorie: 'JO13', geslacht: 'j', standaardAan: true });
assert.equal(v('SV Voorbeeld JO8-3JM').naam, 'O8-3');
assert.equal(v('SV Voorbeeld 1').naam, 'Eerste elftal');
assert.equal(v('SV Voorbeeld 3 (zat)').naam, 'Senioren 3 (zaterdag)');
assert.equal(v('SV Voorbeeld VR1').categorie, 'Vrouwen');
const f = v('SV Voorbeeld JO13-1 Futsal'); assert.equal(f.naam, 'O13-1 Futsal'); assert.equal(f.standaardAan, false);
const o = v('SV Voorbeeld JO18-1'); assert.equal(o.categorie, null); assert.equal(o.standaardAan, false);
const vet = v('SV Voorbeeld 35+1'); assert.equal(vet.categorie, 'Senioren'); assert.equal(vet.naam, '35+1'); assert.equal(vet.standaardAan, true);

/* clubnaam in Sportlink wijkt af van de naam in Cluppie: het gezamenlijke voorvoegsel van de lijst gaat eraf */
const lijst = ["ASV'33 JO11-1", "ASV'33 MO13-1", "ASV'33 1"];
const vv = voorvoegselUit(lijst);
assert.equal(vv, "ASV'33 ");
assert.deepEqual(teamVoorstel(lijst[0], 'Aarle-Rixtel', '', vv), { naam: 'O11-1', categorie: 'JO11', geslacht: 'j', standaardAan: true });
assert.equal(teamVoorstel(lijst[1], 'Aarle-Rixtel', '', vv).naam, 'MO13-1');
assert.equal(teamVoorstel(lijst[2], 'Aarle-Rixtel', '', vv).naam, 'Eerste elftal');
assert.equal(voorvoegselUit(['Eén team']), '');
assert.equal(teamVoorstel("ASV'33 Walking Football", '', '', vv).naam, 'Walking Football');

console.log('teamVoorstel: alle controles geslaagd');
