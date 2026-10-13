// Vaste afmeldingen: datums, weekdagen, prefill. Draaien: node --no-warnings tests/vaste-afmeldingen.test.mjs
import assert from 'node:assert/strict';
const V = await import('../public/js/vaste-afmeldingen.js');

/* weekdagen: 1 = ma … 7 = zo */
assert.equal(V.weekdagVan('2026-10-12'), 1, '12-10-2026 is een maandag');
assert.equal(V.weekdagVan('2026-10-18'), 7, 'zondag = 7');
assert.equal(V.plusDagen('2026-10-28', 7), '2026-11-04', 'over de maandgrens');
assert.equal(V.plusDagen('2026-12-28', 7), '2027-01-04', 'over de jaargrens');
assert.equal(V.eersteOpDag('2026-10-13', 1), '2026-10-19', 'dinsdag → volgende maandag');
assert.equal(V.eersteOpDag('2026-10-12', 1), '2026-10-12', 'dezelfde dag telt mee');

/* regel van 10 weken op maandag */
const regel = { id: 'r1', spelerId: 'p1', dag: 1, van: '2026-10-19', tot: '2026-12-21', reden: 'ziek', notitie: 'n' };
const datums = V.regelDatums(regel);
assert.equal(datums.length, 10);
assert.ok(datums.every(d => V.weekdagVan(d) === 1), 'alle datums zijn maandagen');
assert.equal(datums[0], '2026-10-19'); assert.equal(datums.at(-1), '2026-12-21');
assert.deepEqual(V.regelDatums(null), []);
assert.deepEqual(V.regelDatums({ van: '2026-10-19' }), [], 'zonder tot niets');

/* geldt op */
assert.equal(V.regelGeldtOp(regel, '2026-10-26'), true);
assert.equal(V.regelGeldtOp(regel, '2026-10-27'), false, 'andere weekdag');
assert.equal(V.regelGeldtOp(regel, '2026-10-12'), false, 'vóór start');
assert.equal(V.regelGeldtOp(regel, '2026-12-28'), false, 'na einde');

/* vastOp en prefill */
const team = { vasteAfmeldingen: [regel, { id: 'r2', spelerId: 'p2', dag: 3, van: '2026-10-21', tot: '2026-11-11' }, null, { id: 'r3', spelerId: 'weg', dag: 1, van: '2026-10-19', tot: '2026-12-21' }] };
assert.deepEqual([...V.vastOp(team, '2026-10-26').keys()].sort(), ['p1', 'weg']);
assert.deepEqual([...V.vastOp(team, '2026-10-26', ['p1', 'p2']).keys()], ['p1'], 'vertrokken speler valt af');
assert.equal(V.vastOp({}, '2026-10-26').size, 0, 'team zonder regels');
const pf = V.vastePrefill(team, '2026-10-28', ['p1', 'p2']);
assert.deepEqual(pf.afwezig, ['p2']);
assert.deepEqual(pf.redenen.p2, { type: 'anders', notitie: '', vast: 'r2' }, 'standaardreden en vast-markering');
const pf1 = V.vastePrefill(team, '2026-10-19', ['p1']);
assert.deepEqual(pf1.redenen.p1, { type: 'ziek', notitie: 'n', vast: 'r1' });

/* actieve regels: verlopen weg, gesorteerd op start */
const act = V.actieveRegels(team, '2026-11-12');
assert.deepEqual(act.map(r => r.id), ['r1', 'r3'], 'r2 is op 11-11 afgelopen');
assert.deepEqual(V.actieveRegels(null, '2026-11-12'), []);
console.log('vaste-afmeldingen: alle controles groen');
