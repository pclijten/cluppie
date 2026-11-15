// Welkom voor een coach die bij een clubteam komt (snelstart-logica.js). node tests/welkom-coach.test.mjs
import assert from 'node:assert/strict';
import { WELKOM_STAPPEN, isNieuwAccount, welkomCoachStatus, toonWelkomCoach } from '../public/js/snelstart-logica.js';

const NU = Date.parse('2026-11-16T12:00:00Z'), dag = 86400000;
// nieuw account: binnen 30 dagen, niet in de toekomst, niet zonder datum
assert.equal(isNieuwAccount(new Date(NU - 2 * dag).toUTCString(), NU), true);
assert.equal(isNieuwAccount(new Date(NU - 31 * dag).toUTCString(), NU), false);
assert.equal(isNieuwAccount(new Date(NU + dag).toUTCString(), NU), false);
assert.equal(isNieuwAccount(undefined, NU), false);
assert.equal(isNieuwAccount('geen datum', NU), false);

// status: drie stappen, de eerste open stap is "volgende"
let st = welkomCoachStatus({});
assert.equal(st.totaal, 3); assert.equal(st.gedaan, 0); assert.equal(st.volgende, 'training'); assert.equal(st.compleet, false);
st = welkomCoachStatus({ trainingGelezen: true, presentie: 4 });
assert.equal(st.gedaan, 2); assert.equal(st.volgende, 'wedstrijd');
st = welkomCoachStatus({ trainingGelezen: true, presentie: 1, opstelling: true });
assert.equal(st.compleet, true); assert.equal(st.volgende, null);
assert.deepEqual(WELKOM_STAPPEN.map(s => s.tab), ['trainingen', 'presentietraining', 'wedstrijden']);

// tonen: alleen clubteam, zelf coach, nieuw account, niet verborgen, niet af
const team = { naam: 'O11-1', club: 'c1', leden: { u1: true, u2: true } };
const open = welkomCoachStatus({});
assert.equal(toonWelkomCoach(team, 'u1', { nieuw: true, status: open }), true);
assert.equal(toonWelkomCoach(team, 'u1', { nieuw: false, status: open }), false, 'bestaande coach krijgt de kaart niet');
assert.equal(toonWelkomCoach(team, 'u1', { nieuw: true, verborgen: true, status: open }), false);
assert.equal(toonWelkomCoach(team, 'u9', { nieuw: true, status: open }), false, 'geen coach van dit team');
assert.equal(toonWelkomCoach({ naam: 'Los', leden: { u1: true } }, 'u1', { nieuw: true, status: open }), false, 'team zonder club heeft Eerste stappen');
assert.equal(toonWelkomCoach(team, 'u1', { nieuw: true, status: welkomCoachStatus({ trainingGelezen: true, presentie: 1, opstelling: true }) }), false, 'alles gedaan');
assert.equal(toonWelkomCoach(null, 'u1', { nieuw: true }), false);
console.log('welkom-coach: ok');
