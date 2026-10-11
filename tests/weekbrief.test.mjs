// Signalen van de coördinator-weekbrief.  Draaien: node --import ./tests/hulp/stub-loader.mjs tests/weekbrief.test.mjs
import assert from 'node:assert/strict';
const { weekbriefTeam } = await import('../public/js/club-weekbrief.js');
const vandaag = '2026-10-11';   // zondag
const team = { id: 't', naam: 'JO11-1', categorie: 'JO11', trainingsdagen: [2, 4] };   // di + do
const spelers = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, naam: 'S' + i, leerpunten: i < 2 ? [{ tekst: 'X' }] : [] }));
const leercurve = [{ thema: 'X', vanaf: 8 }, { thema: 'Y', vanaf: 9 }, { thema: 'Z', vanaf: 14 }];
let r = weekbriefTeam({ team, spelers, presentie: [{ datum: '2026-10-06', afwezig: [] }], wedstrijden: [], beoordelingen: [{ datum: '2026-10-01' }], vandaag, leercurve });
assert.equal(r.signalen.find(s => s.soort === 'presentie').tekst, '1 van 2 trainingen zonder aanwezigheid');
assert.ok(!r.signalen.some(s => s.soort === 'evaluatie'), 'beoordeling 10 dagen geleden is prima');
assert.equal(r.dekking, 50, 'X van X+Y (Z is nog te oud)');
r = weekbriefTeam({ team, spelers, presentie: [{ datum: '2026-10-06' }, { datum: '2026-10-08' }], wedstrijden: [], beoordelingen: [], vandaag, leercurve });
assert.ok(!r.signalen.some(s => s.soort === 'presentie'));
assert.equal(r.signalen.find(s => s.soort === 'evaluatie').ernst, 2);
const veelAfwezig = [{ datum: '2026-10-06', afwezig: ['p0', 'p1', 'p2', 'p3', 'p4'] }, { datum: '2026-10-08', afwezig: ['p0', 'p1', 'p2', 'p3', 'p4'] }];
r = weekbriefTeam({ team, spelers, presentie: veelAfwezig, wedstrijden: [], beoordelingen: [{ datum: '2026-10-10' }], vandaag, leercurve });
assert.match(r.signalen.find(s => s.soort === 'opkomst').tekst, /opkomst 38%/);
console.log('weekbrief: alle controles geslaagd');
