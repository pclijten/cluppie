// Controle van het club-aanmeldformulier.  Draaien: node tests/aanmelding.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { controleerAanmelding, afkVoorstel } = require('../functions/aanmelding.js');
const goed = { clubNaam: 'RKVV Voorbeeld', contactNaam: 'Jan', contactEmail: 'Jan@Club.NL', akkoord: true, aantalTeams: '14', district: 'zuid1' };
assert.equal(controleerAanmelding(goed).data.contactEmail, 'jan@club.nl');
assert.equal(controleerAanmelding(goed).data.aantalTeams, 14);
assert.match(controleerAanmelding({ ...goed, akkoord: false }).fout, /akkoord/);
assert.match(controleerAanmelding({ ...goed, contactEmail: 'geen-mail' }).fout, /e-mail/);
assert.match(controleerAanmelding({ ...goed, clubNaam: ' ' }).fout, /naam van de club/);
assert.equal(controleerAanmelding({ ...goed, district: 'mars' }).data.district, '');
assert.equal(controleerAanmelding({ ...goed, bericht: 'a\u0000b' }).data.bericht, 'a b');
assert.equal(afkVoorstel('RKVV Voorbeeld'), 'RKVV'); assert.equal(afkVoorstel('Voetbal Club Gemert'), 'VCG');
console.log('aanmelding: alle controles geslaagd');

/* werkwijze bij aanmelding: alleen 'vrij' blijft vrij, al het andere wordt 'club' */
assert.equal(controleerAanmelding({ ...goed, werkwijze: 'vrij' }).data.werkwijze, 'vrij');
assert.equal(controleerAanmelding({ ...goed, werkwijze: 'club' }).data.werkwijze, 'club');
assert.equal(controleerAanmelding(goed).data.werkwijze, 'club');
assert.equal(controleerAanmelding({ ...goed, werkwijze: 'x' }).data.werkwijze, 'club');
