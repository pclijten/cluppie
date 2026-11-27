// Draait tools/maak-leeg.mjs tegen de Firestore-emulator: npm run test:maak-leeg
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const PROJECT = 'demo-verhuis';
const db = getFirestore(admin.initializeApp({ projectId: PROJECT }));
const draai = (...a) => execFileSync('node', ['tools/maak-leeg.mjs', ...a, `--project=${PROJECT}`], { encoding: 'utf8' });

await db.doc('clubs/proef').set({ naam: 'Proefclub', leden: { u1: true } });
await db.doc('clubs/proef/content/x').set({ a: 1 });
await db.doc('clubs/blijf').set({ naam: 'Blijfclub' });
await db.doc('clubs/asv').set({ naam: 'Asv 33', verhuisd: true });
await db.doc('teams/t1').set({ naam: 'JO11', club: 'proef' });
await db.doc('teams/t1/spelers/s1').set({ naam: 'A' });
await db.doc('teams/t2').set({ naam: 'JO12', club: 'blijf' });
await db.doc('teams/los').set({ naam: 'Los team' });
await db.doc('teams/tasv').set({ naam: 'JO9', club: 'asv' });
await db.doc('wedstrijden/w1').set({ team: 't1' });
await db.doc('wedstrijden/w2').set({ team: 't2' });
await db.doc('teamCodes/ABC').set({ teamId: 'los' });
await db.doc('clubPubliek/proef').set({ naam: 'Proefclub' });
await db.doc('gebruikers/u1').set({ club: 'proef' });
await db.doc('content/oef1').set({ club: 'proef' });
await db.doc('platform/instellingen').set({ a: 1 });
const er = async p => (await db.doc(p).get()).exists;

const droog = draai('wis', '--droog', '--behoud=blijf,asv');
assert.match(droog, /Droog: er is niets gewijzigd/);
assert.ok(await er('clubs/proef'), 'droog schrijft niets');

assert.throws(() => draai('wis', '--echt', '--behoud=blijf'), 'verhuisde club wordt geweigerd');
assert.ok(await er('clubs/asv') && await er('clubs/proef'), 'na weigering staat alles er nog');
assert.throws(() => draai('wis', '--echt', '--behoud=bestaatniet'), 'onbekend id wordt geweigerd');

const uit = draai('wis', '--echt', '--behoud=blijf,asv');
assert.match(uit, /Klaar: 1 clubs, 2 teams/);
for (const p of ['clubs/proef', 'clubs/proef/content/x', 'teams/t1', 'teams/t1/spelers/s1', 'teams/los', 'wedstrijden/w1', 'teamCodes/ABC', 'clubPubliek/proef'])
  assert.equal(await er(p), false, p + ' is weg');
for (const p of ['clubs/blijf', 'clubs/asv', 'teams/t2', 'teams/tasv', 'wedstrijden/w2', 'gebruikers/u1', 'content/oef1', 'platform/instellingen'])
  assert.equal(await er(p), true, p + ' staat er nog');
console.log('maak-leeg (emulator): alle controles geslaagd');
process.exit(0);
