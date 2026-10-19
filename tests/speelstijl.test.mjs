import assert from 'node:assert/strict';
import * as L from '../public/js/speelstijl-logica.js';

let n = 0; const t = (naam, f) => { f(); n++; };

t('26 vragen, 8 kort, ids uniek', () => {
  assert.equal(L.VRAGEN.length, 26);
  assert.equal(L.KORT.length, 8);
  assert.equal(new Set(L.VRAGEN.map(q => q.id)).size, 26);
  for (const q of L.VRAGEN.filter(q => q.k === 'ab')) assert.ok(q.A && q.B && L.DIM_IDS.includes(q.dim));
});

t('schoonAntwoord weigert onbekend en kapt multi af', () => {
  assert.equal(L.schoonAntwoord('d1a', 'X'), undefined);
  assert.equal(L.schoonAntwoord('d1a', '?'), '?');
  assert.equal(L.schoonAntwoord('nietbestaand', 'A'), undefined);
  assert.equal(L.schoonAntwoord('l1', 10), 10);
  assert.equal(L.schoonAntwoord('l1', 11), undefined);
  assert.deepEqual(L.schoonAntwoord('t3', ['d1', 'd2', 'd3', 'd4', 'd1', 'zz']), ['d1', 'd2', 'd3']);
  assert.equal(L.schoonAntwoord('w2', 'geen'), 'geen');
  assert.deepEqual(L.schoonAntwoorden(null), {});
});

t('standen en status', () => {
  const s = L.standenVan({ d1a: 'A', d1b: 'A', d2a: 'A', d2b: 'B', d3a: '?' });
  assert.equal(s.d1.stand, 2); assert.equal(s.d2.stand, 0); assert.equal(s.d3.stand, 0); assert.equal(s.d3.n, 0);
  assert.equal(s.d4.stand, null);
  assert.equal(L.statusVan(2), 'duidelijk'); assert.equal(L.statusVan(-1), 'neigt');
  assert.equal(L.statusVan(0), 'open'); assert.equal(L.statusVan(null), 'open');
});

t('voortgang kort en volledig', () => {
  assert.deepEqual(L.voortgang({ d1a: 'A', t3: [] }, 'kort'), { gedaan: 1, totaal: 8 });
  assert.deepEqual(L.voortgang({ d1a: 'A', t3: ['d1'] }, 'volledig'), { gedaan: 2, totaal: 26 });
});

t('verschil van mening', () => {
  assert.equal(L.verschilVan([2, -1]), true);
  assert.equal(L.verschilVan([1, -1]), true);
  assert.equal(L.verschilVan([1, 0]), false);
  assert.equal(L.verschilVan([2, 1, null]), false);
  assert.equal(L.verschilVan([2]), false);
});

const alleA = Object.fromEntries(L.DIM_IDS.flatMap(id => [[id + 'a', 'A'], [id + 'b', 'A']]));
const alleB = Object.fromEntries(L.DIM_IDS.flatMap(id => [[id + 'a', 'B'], [id + 'b', 'B']]));

t('clubUitkomst: eensgezind', () => {
  const u = L.clubUitkomst([alleA, alleA]);
  assert.equal(u.invullers, 2); assert.deepEqual(u.verschil, []);
  assert.equal(u.perDim.d1.status, 'duidelijk');
  assert.equal(u.herkenning.sleutel, 'pos');
  assert.match(u.zin, /^Rustig opbouwen/);
});

t('clubUitkomst: verschil en max 5 invullers', () => {
  const u = L.clubUitkomst([alleA, alleB]);
  assert.equal(u.verschil.length, 8);
  assert.equal(u.perDim.d1.stand, 0);
  const zes = L.clubUitkomst(Array(8).fill(alleA));
  assert.equal(zes.invullers, L.MAX_INVULLERS);
});

t('gewichten, fasen en willenNiet', () => {
  const u = L.clubUitkomst([{ t3: ['d1', 'd2', 'd3'], l1: 10, nee: ['lang', 'pos'] }, { t3: ['d1', 'd2', 'd4'], l1: 12, nee: ['lang'] }, { t3: ['d1'], l1: 8, nee: ['lang', 'schel'] }]);
  assert.equal(u.gewichten.d1, 2); assert.equal(u.gewichten.d8, 1);
  assert.equal(u.fasen.l1, 10); assert.equal(u.fasen.l2, null);
  assert.deepEqual(u.willenNiet, ['lang']);
  assert.equal(L.leeftijdTekst(99), 'nooit bij de jeugd'); assert.equal(L.leeftijdTekst(10), 'vanaf O10');
});

t('leeg en alles-onbekend blijven veilig', () => {
  const u = L.clubUitkomst([]);
  assert.equal(u.zin, ''); assert.equal(u.herkenning, null);
  const w = L.clubUitkomst([Object.fromEntries(L.DIM_IDS.map(id => [id + 'a', '?']))]);
  assert.equal(w.perDim.d1.status, 'open');
});

t('kruisverschil en huidigDoc', () => {
  const u = L.clubUitkomst([{ ...alleA, hk: 'direct' }]);
  assert.equal(u.kruisverschil, true);
  const d = L.huidigDoc(u, 'uid1', 5);
  assert.equal(d.vastgelegdDoor, 'uid1'); assert.equal(d.standen.d1.status, 'duidelijk');
  assert.ok(!('antwoorden' in d));
  assert.ok(L.gespreksvraag('d3').includes('Druk zetten'));
});

console.log(`speelstijl: ${n} tests ok`);
