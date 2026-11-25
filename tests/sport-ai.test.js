/* [20261126b] Sportprofiel stap 6: de AI-opdracht per sport (functions/sport.js). Voor voetbal precies dezelfde tekst. */
const assert = require('node:assert/strict');
const { voorSport, sportVan, SPORTEN } = require('../functions/sport');
const T = 'Je bent een ervaren adviseur jeugdvoetbal voor een Nederlandse amateurvoetbalclub. Voetbal volgens de KNVB.';
assert.equal(voorSport(T, 'voetbal'), T);
assert.equal(voorSport(T, undefined), T);
assert.equal(voorSport(T, 'curling'), T);
assert.equal(sportVan('hockey'), 'hockey'); assert.equal(sportVan('x'), 'voetbal');
const h = voorSport(T, 'hockey');
assert.ok(h.startsWith('Je bent een ervaren adviseur jeugdhockey voor een Nederlandse amateurhockeyclub. Hockey volgens de KNHB.'));
assert.ok(/SPORT: hockey \(bond: KNHB\)/.test(h) && !/voetbal(?!termen)/.test(h));
assert.ok(voorSport(T, 'korfbal').includes('KNKV') && voorSport(T, 'volleybal').includes('Nevobo'));
assert.deepEqual(Object.keys(SPORTEN), ['voetbal', 'hockey', 'volleybal', 'korfbal']);
console.log('sport-ai: 9 controles geslaagd');
