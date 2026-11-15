// Posities verwisselen binnen een periode (analyse.js verwisselSlots) en de speeltijd die eruit volgt.
// node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/opstelling.test.mjs
import assert from 'node:assert';
const { verwisselSlots, effectieveLineup, analyseKwart } = await import('../public/js/analyse.js');
const w = { kwartduur: 10, format: '4', formatie: null };
const kwart = () => ({ lineup: { K: 'A', V1: 'B', M1: 'D' }, events: [{ in: 'C', uit: 'B', slot: 'V1', sec: 300 }], klok: { base: 400, running: false, start: 0 } });
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; };

// invaller C (via wissel op V1) wisselt van plek met starter D op M1
let k = kwart(); verwisselSlots(k, 'V1', 'M1');
let l = effectieveLineup(k);
ok(l.M1 === 'C' && l.V1 === 'D' && l.K === 'A', 'na verwisselen staat iedereen één keer op het veld');
ok(k.lineup.M1 === 'B' && k.lineup.V1 === 'D', 'de speler die begon blijft in de startopstelling');
let a = analyseKwart(w, k);
ok(a.tijd.B === 300 && a.tijd.C === 300 && a.tijd.D === 600 && a.tijd.A === 600, `speeltijd klopt (${JSON.stringify(a.tijd)})`);

// invaller naar een lege plek: geen dubbele speler
k = kwart(); delete k.lineup.M1; verwisselSlots(k, 'V1', 'M1');
l = effectieveLineup(k);
ok(Object.values(l).filter(p => p === 'C').length === 1 && l.M1 === 'C' && l.V1 === undefined, 'invaller staat op één plek');
a = analyseKwart(w, k);
ok(a.tijd.B === 300 && a.tijd.C === 300, 'speeltijd bij lege plek klopt');

// vóór de aftrap (geen wissels): gewoon verplaatsen en omwisselen
k = { lineup: { K: 'A', V1: 'B' }, events: [], klok: { base: 0, running: false, start: 0 } };
verwisselSlots(k, 'V1', 'M1'); ok(k.lineup.M1 === 'B' && k.lineup.V1 === undefined, 'verplaatsen naar lege plek');
verwisselSlots(k, 'K', 'M1'); ok(k.lineup.K === 'B' && k.lineup.M1 === 'A', 'twee starters wisselen');
verwisselSlots(k, 'K', 'K'); ok(k.lineup.K === 'B', 'zelfde plek doet niets');
console.log(`opstelling: ${n} controles geslaagd`);
