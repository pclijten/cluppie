// Speeldag per team: de KNVB-kalender noemt een speelweekend bij de zondag, jeugd speelt op zaterdag.
// Draaien: node --import ./tests/hulp/stub-loader.mjs tests/speeldag.test.mjs
import assert from 'node:assert/strict';
const { speeldagDatum, knvbKalenderVoorTeam, KNVB_KALENDER } = await import('../public/js/config.js');
const weekdag = iso => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = zondag, 6 = zaterdag

// jeugd: zondag wordt de zaterdag ervoor, ook over een maandgrens
assert.equal(speeldagDatum({ categorie: 'MO17' }, '2026-11-22'), '2026-11-21');
assert.equal(speeldagDatum({ categorie: 'JO9' }, '2026-11-01'), '2026-10-31', 'over de maandgrens');
assert.equal(speeldagDatum({ categorie: 'JO15' }, '2027-01-03'), '2027-01-02');
assert.equal(speeldagDatum({ categorie: '' }, '2026-11-22'), '2026-11-21', 'onbekende categorie telt als jeugd');
assert.equal(speeldagDatum(null, '2026-11-22'), '2026-11-21', 'zonder team: jeugd');
// wat al op een andere dag staat blijft staan
assert.equal(speeldagDatum({ categorie: 'JO12' }, '2026-10-31'), '2026-10-31', 'zaterdag blijft zaterdag');
assert.equal(speeldagDatum({ categorie: 'JO12' }, '2027-03-29'), '2027-03-29', '2e Paasdag blijft maandag');
assert.equal(speeldagDatum({ categorie: 'MO15' }, '2027-05-06'), '2027-05-06', 'Hemelvaart blijft donderdag');
// senioren en vrouwen houden de datum uit de kalender
for (const categorie of ['Senioren', 'SENIOREN', 'Vrouwen'])
  assert.equal(speeldagDatum({ categorie }, '2026-11-22'), '2026-11-22', categorie);
// een kapotte datum gaat ongewijzigd terug
assert.equal(speeldagDatum({ categorie: 'JO12' }, 'geen-datum'), 'geen-datum');

// de ingebouwde kalender: geen zondag meer voor jeugd, en geen twee kalenderdagen op dezelfde dag
for (const categorie of ['JO8', 'JO12', 'JO13', 'JO19', 'MO13', 'MO17', 'MO20']){
  const team = { categorie }, dagen = knvbKalenderVoorTeam(team).map(k => speeldagDatum(team, k.d));
  assert.ok(dagen.length > 30, `${categorie}: kalender gevuld`);
  assert.ok(!dagen.some(d => weekdag(d) === 0), `${categorie}: geen zondag`);
  assert.equal(new Set(dagen).size, dagen.length, `${categorie}: geen dubbele dag`);
  assert.deepEqual([...dagen].sort(), dagen, `${categorie}: volgorde blijft gelijk`);
}
for (const k of KNVB_KALENDER.sen) assert.equal(speeldagDatum({ categorie: 'Senioren' }, k.d), k.d);
console.log('speeldag: alle controles geslaagd');
