// Test van de pure aggregatie achter aggregeerGebruik (functions/gebruik.js).
// Draaien: node tests/gebruik.test.mjs  (na `cd functions && npm install`)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { bouwStats, categorie } = require('../functions/gebruik.js');

// Maandag 6 okt 2026 19:00 NL (= 17:00 UTC) — team traint op di (2) en do (4)
const ma19 = Date.UTC(2026, 9, 5, 17, 0, 0);
const sessies = [
  { uid: 'a', teamId: 't1', start: ma19, stappen: [
    { s: 'team:hub', t: 0 }, { s: 'team:trainingen', t: 30000 }, { s: 'team:spelers', t: 150000 }, { s: 'team:hub', t: 3600000 } ] },
  { uid: 'b', teamId: 't1', start: ma19 + 5 * 86400000, stappen: [   // zaterdag
    { s: 'wedstrijd:opstelling', t: 0 }, { s: 'wedstrijd:kwart1', t: 60000 }, { s: 'wedstrijd:kwart2', t: 120000 } ] },
  { uid: 'a', teamId: null, start: ma19, stappen: [] },
];
const s = bouwStats({ sessies, teams: { t1: { naam: 'JO11-1', trainingsdagen: [2, 4] } }, namen: { a: 'Anna' }, vanaf: '2026-07-08', tot: '2026-10-05' });

assert.equal(s.bron.sessies, 3); assert.equal(s.bron.coaches, 2); assert.equal(s.bron.teams, 1);
assert.equal(s.heatmap.length, 168);
assert.equal(s.heatmap[0 * 24 + 19], 3, 'drie schermen op maandag 19u (NL)');
assert.equal(s.dag[5], 3, 'zaterdag: drie schermen');
assert.equal(s.voorbereiding.dag1, 1, 'training geopend op maandag = dag voor dinsdag');
assert.equal(s.wedstrijd.opstelling_n, 1); assert.equal(s.wedstrijd.live_n, 1); assert.equal(s.wedstrijd.liveDag[5], 1);
const t = s.teams[0]; assert.equal(t.naam, 'JO11-1'); assert.equal(t.ses, 2); assert.equal(t.coaches, 2);
assert.equal(t.cat.Spelers, 600, 'verblijf afgekapt op 10 minuten');
assert.equal(t.profiel, 'spelersgericht');
assert.equal(s.paginas.find(p => p.s === 'team:trainingen').med, 120);
assert.equal(s.coaches.find(c => c.uid === 'a').naam, 'Anna');
assert.equal(categorie('wedstrijd:kwart3'), 'Wedstrijden'); assert.equal(categorie('team:videos'), 'Media');
assert.ok(!JSON.stringify(s).includes('undefined'));
assert.ok(s.heatmap.every(Number.isFinite) && !s.heatmap.some(Array.isArray), 'heatmap plat (Firestore: geen geneste arrays)');
console.log('aggregeerGebruik: alle controles geslaagd');
