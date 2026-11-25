// Controle van het club-aanmeldformulier.  Draaien: node tests/aanmelding.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { controleerAanmelding, afkVoorstel, OPEN_SPORTEN } = require('../functions/aanmelding.js');
const goed = { clubNaam: 'RKVV Voorbeeld', contactNaam: 'Jan', contactEmail: 'Jan@Club.NL', akkoord: true, aantalTeams: '14', district: 'zuid1' };
assert.equal(controleerAanmelding(goed).data.contactEmail, 'jan@club.nl');
assert.equal(controleerAanmelding(goed).data.aantalTeams, 14);
assert.match(controleerAanmelding({ ...goed, akkoord: false }).fout, /akkoord/);
assert.match(controleerAanmelding({ ...goed, contactEmail: 'geen-mail' }).fout, /e-mail/);
assert.match(controleerAanmelding({ ...goed, clubNaam: ' ' }).fout, /naam van de club/);
assert.equal(controleerAanmelding({ ...goed, district: 'mars' }).data.district, '');
assert.equal(controleerAanmelding({ ...goed, bericht: 'a\u0000b' }).data.bericht, 'a b');
assert.equal(afkVoorstel('RKVV Voorbeeld'), 'RKVV'); assert.equal(afkVoorstel('Voetbal Club Gemert'), 'VCG');

/* werkwijze bij aanmelding: alleen 'vrij' blijft vrij, al het andere wordt 'club' */
assert.equal(controleerAanmelding({ ...goed, werkwijze: 'vrij' }).data.werkwijze, 'vrij');
assert.equal(controleerAanmelding({ ...goed, werkwijze: 'club' }).data.werkwijze, 'club');
assert.equal(controleerAanmelding(goed).data.werkwijze, 'club');
assert.equal(controleerAanmelding({ ...goed, werkwijze: 'x' }).data.werkwijze, 'club');
// [20261126f] sport bij aanmelden: alleen open sporten, voetbal of onbekend = geen veld
assert.equal(controleerAanmelding({ ...goed, sport: 'hockey' }).data.sport, 'hockey');
assert.equal('sport' in controleerAanmelding({ ...goed, sport: 'voetbal' }).data, false);
assert.equal('sport' in controleerAanmelding({ ...goed, sport: 'korfbal' }).data, false);
assert.equal('sport' in controleerAanmelding(goed).data, false);
// de lijst open sporten is op drie plekken gelijk: functions, profielen, rules
{
  const fs = await import('node:fs');
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const m = rules.match(/function openSport\(d\) \{ return d\.get\('sport', 'voetbal'\) in \[([^\]]*)\]/);
  assert.ok(m, 'openSport in de rules');
  assert.deepEqual(m[1].split(',').map(x => x.trim().replace(/'/g, '')), OPEN_SPORTEN);
  const profielen = fs.readdirSync(new URL('../public/js/', import.meta.url)).filter(f => /^sport-[a-z]+\.js$/.test(f))
    .filter(f => /\n  open: true,/.test(fs.readFileSync(new URL('../public/js/' + f, import.meta.url), 'utf8'))).map(f => f.slice(6, -3));
  assert.deepEqual([...profielen].sort(), [...OPEN_SPORTEN].sort());
}
console.log('aanmelding: alle controles geslaagd');
