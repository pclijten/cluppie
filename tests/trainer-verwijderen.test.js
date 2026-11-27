// Losse trainer verwijderen door de eindbaas (functions/trainer-verwijderen.js): wie mag weg, bevestigen, teams verdelen, overzicht bijwerken.
// Draaien: node tests/trainer-verwijderen.test.js   (eerst één keer: cd functions && npm install)
const assert = require('node:assert/strict');
const { magTrainerWeg, bevestigKlopt, bevestigTekst, verdeelTeams, zonderTrainer, BESCHERMD } = require('../functions/trainer-verwijderen.js');
const a = { uid: 'u1', email: 'Roy@Voorbeeld.nl', naam: 'Roy' };
assert.equal(magTrainerWeg({ account: a, aanroeper: 'eindbaas' }), '', 'losse trainer mag weg');
assert.match(magTrainerWeg({ account: null }), /bestaat niet/);
assert.match(magTrainerWeg({ account: a, aanroeper: 'u1' }), /eigen account/);
for (const m of BESCHERMD) assert.match(magTrainerWeg({ account: { uid: 'x', email: m.toUpperCase() }, aanroeper: 'y' }), /platformbeheerder/, m + ' nooit');
assert.match(magTrainerWeg({ account: a, aanroeper: 'y', beheerders: ['roy@voorbeeld.nl'] }), /platformbeheerder/, 'extra beheerder ook niet');
assert.match(magTrainerWeg({ account: a, aanroeper: 'y', clubs: [{ id: 'asv33', naam: "ASV'33" }] }), /hoort bij ASV'33/, 'trainer van een club (ASV\'33) kan hier nooit weg');
assert.match(magTrainerWeg({ account: a, aanroeper: 'y', clubTeams: [{ id: 't', naam: 'JO11-1', club: 'asv33' }] }), /clubteam/, 'ook niet als alleen een clubteam');
assert.ok(bevestigKlopt(a, '  roy@voorbeeld.NL '), 'hoofdletters en spaties maken niet uit');
assert.ok(!bevestigKlopt(a, 'Roy'), 'met e-mail telt de naam niet');
assert.ok(!bevestigKlopt(a, 'roy@voorbeeld'), 'deel van het adres is niet genoeg');
assert.ok(bevestigKlopt({ uid: 'u', email: '', naam: 'Sem' }, 'sem') && bevestigTekst({ email: '', naam: 'Sem' }) === 'Sem', 'zonder e-mail de naam');
assert.ok(!bevestigKlopt({ uid: 'u', email: '', naam: '' }, ''), 'zonder e-mail en naam nooit');
const { weg, blijft } = verdeelTeams([
  { id: 'alleen', leden: { u1: true } },
  { id: 'samen', leden: { u1: true, u2: true } },
  { id: 'oud', leden: { u1: true, u2: false } },
  { id: 'club', club: 'c', leden: { u1: true } },
], 'u1');
assert.deepEqual(weg.map(t => t.id), ['alleen', 'oud'], 'enige coach: team gaat weg');
assert.deepEqual(blijft.map(t => t.id), ['samen'], 'met een andere coach blijft het team');
const ind = { totaal: 3, nieuw7: 1, eigenTeam: 1, wachtOpClub: 0, nogGeenTeam: 2, lijst: [{ uid: 'u1', status: 'nog-geen-team', nieuw: true }, { uid: 'u2', status: 'eigen-team' }, { uid: 'u3', status: 'nog-geen-team' }] };
const na = zonderTrainer(ind, 'u1');
assert.deepEqual([na.totaal, na.nieuw7, na.nogGeenTeam, na.eigenTeam, na.lijst.length], [2, 0, 1, 1, 2]);
assert.equal(zonderTrainer(ind, 'onbekend'), ind);
const bron = require('node:fs').readFileSync(require('node:path').join(__dirname, '../functions/index.js'), 'utf8');
assert.ok(/exports\.verwijderTrainerPlatform = require\('\.\/trainer-verwijderen'\)\.maak\(/.test(bron), 'staat in index.js');
assert.equal(typeof require('../functions/avg.js').wisAccount, 'function', 'avg.js deelt wisAccount');
assert.equal(typeof require('../functions/club-verwijderen.js').scanBij, 'function');
assert.equal(typeof require('../functions/trainer-verwijderen.js').maak({ isPlatformBeheerder: async () => false }), 'function');
console.log('trainer-verwijderen: alle controles geslaagd');
