// Startlijst (client) en de kopie in functions/platform.js moeten gelijk blijven;
// plus het stoplicht van het platformdashboard.  Draaien: node tests/startlijst.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { startlijstStatus, STARTLIJST_STAPPEN } = await import('../public/js/startlijst.js');
const { startlijstKlaar, STARTLIJST_IDS, beoordeelClub } = require('../functions/platform.js');

assert.deepEqual(STARTLIJST_STAPPEN.map(s => s.id), STARTLIJST_IDS, 'zelfde stappen in dezelfde volgorde');
const gevallen = [
  [{}, []],
  [{ admins: { a: true }, sportlinkClientId: 'abc123', instellingen: { identiteit: { kleur: '#123456' }, privacy: { contactEmail: 'x@y.nl', verwerkersovereenkomst: { geaccepteerd: true } } } },
   [{ leden: { a: true, c: true }, trainingsdagen: [2] }]],
  [{ admins: { a: true }, instellingen: { identiteit: { kleur: '#E2342F' } } }, [{ leden: { a: true }, trainingsdagen: [] }]],
];
for (const [club, teams] of gevallen){
  const c = startlijstStatus(club, teams), s = startlijstKlaar(club, teams);
  for (const st of c.stappen) assert.equal(st.klaar, s[st.id], `stap ${st.id}`);
}
assert.equal(startlijstStatus(...gevallen[1]).compleet, true);
assert.equal(startlijstStatus(...gevallen[2]).stappen.find(s => s.id === 'uiterlijk').klaar, false, 'standaardkleur telt niet');

const nu = Date.parse('2026-10-11T12:00:00Z');
const basis = { teams: 5, wachtend: 0, laatsteGebruik: '2026-10-10', sportlink: { gekoppeld: true, fouten: 0, laatsteSync: nu - 3600000 }, privacy: { vo: true }, ai: { limiet: 0, maand: 0 } };
assert.equal(beoordeelClub(basis, nu).status, 'groen');
assert.equal(beoordeelClub({ ...basis, laatsteGebruik: '2026-09-01' }, nu).status, 'rood');
assert.equal(beoordeelClub({ ...basis, wachtend: 1 }, nu).status, 'oranje');
assert.equal(beoordeelClub({ ...basis, sportlink: { gekoppeld: true, fouten: 0, laatsteSync: nu - 4 * 86400000 } }, nu).status, 'rood');
assert.equal(beoordeelClub({ ...basis, privacy: { vo: false } }, nu).signalen[0].tekst, 'geen verwerkersovereenkomst');
console.log('startlijst en stoplicht: alle controles geslaagd');

const { benchmarkWaarden, benchmarkOverzicht } = require('../functions/platform.js');
const bw = benchmarkWaarden([{ tellingen: { snel_beoordeling: 10, volledige_beoordeling: 2, presentie: 8 } }, { tellingen: { presentie: 4, wedstrijd_start: 3 } }], 4, 3, 6);
assert.deepEqual(bw, { evaluaties: 3, presentie: 3, wedstrijden: 0.8, leerpunten: 0, actiefPct: 50 });
assert.equal(benchmarkOverzicht([bw, bw]).metrics, null, 'minder dan 3 clubs: geen vergelijking');
const bo = benchmarkOverzicht([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 10 }]);
assert.equal(bo.metrics.a.mediaan, 2.5); assert.equal(bo.metrics.a.p75, 4.8);
console.log('clubvergelijking: alle controles geslaagd');
