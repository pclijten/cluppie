// Club verwijderen door de eindbaas (functions/club-verwijderen.js): wat hoort bij de club, naam bevestigen, verhuisde club.
// Draaien: node tests/club-verwijderen.test.js   (eerst één keer: cd functions && npm install)
const assert = require('node:assert/strict');
const { hoortBij, naamKlopt, magWeg, NOOIT } = require('../functions/club-verwijderen.js');
const ids = new Set(['c1', 't1', 't2']);
assert.ok(hoortBij('x', { club: 'c1' }, ids) && hoortBij('x', { clubId: 'c1' }, ids) && hoortBij('x', { team: 't1' }, ids) && hoortBij('x', { teamId: 't2' }, ids));
assert.ok(hoortBij('c1', {}, ids) && hoortBij('t2', null, ids), 'document-id is dat van de club of een team');
assert.ok(!hoortBij('x', { club: 'asv' }, ids) && !hoortBij('x', { club: ['c1'] }, ids) && !hoortBij('x', {}, ids), 'andere club, lijst of leeg telt niet');
assert.ok(!hoortBij('uid_c1', { uid: 'u' }, ids), 'een id dat de club alleen bevat, telt niet');
assert.ok(naamKlopt({ naam: 'Asv 33' }, '  asv   33 '), 'hoofdletters en spaties maken niet uit');
assert.ok(!naamKlopt({ naam: 'Asv 33' }, 'Asv'), 'een deel van de naam is niet genoeg');
assert.ok(!naamKlopt({ naam: '' }, ''), 'zonder naam nooit');
assert.ok(!naamKlopt({ naam: 'Mifano' }, undefined));
assert.match(magWeg({ naam: 'Asv 33', verhuisd: { van: 'cluppieasv33' } }), /verhuisde club/, 'ASV\'33 kan nooit weg');
assert.equal(magWeg({ naam: 'Mifano' }), '');
assert.match(magWeg(null), /bestaat niet/);
for (const k of ['platform', 'content', 'gebruikers', 'privacyKennisname', 'platformstats', 'clubs', 'teams']) assert.ok(NOOIT.includes(k), k + ' wordt nooit doorzocht');
const bron = require('node:fs').readFileSync(require('node:path').join(__dirname, '../functions/index.js'), 'utf8');
assert.ok(/exports\.verwijderClubPlatform = require\('\.\/club-verwijderen'\)\.maak\(/.test(bron), 'staat in index.js');
assert.equal(typeof require('../functions/club-verwijderen.js').maak({ isPlatformBeheerder: async () => false }), 'function');
console.log('club-verwijderen: alle controles geslaagd');
