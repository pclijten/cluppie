// Trainingsbibliotheek: basis + beheerlaag (20261113d).
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/bibliotheek.test.mjs
import assert from 'node:assert/strict';
const B = await import('../public/js/bibliotheek.js');
const SC = await import('../public/js/seizoensplan-club.js');
const { maakPlan } = await import('../public/js/trainingsplanner.js');

const basis = B.BASIS;
assert.ok(basis.length > 100, 'basis geladen');
const eerste = basis[0], tweede = basis[1];

// samenvoegen
let alle = B.voegSamen(basis, {});
assert.equal(alle.length, basis.length); assert.ok(alle.every(v => v._status === 'basis'));
alle = B.voegSamen(basis, {
  [eerste.id]: { velden: { naam: 'Nieuwe naam' } },
  [tweede.id]: { velden: {}, status: 'uit' },
  eigen_x: { velden: { ...basis[2], naam: 'Eigen vorm' }, status: 'aan', eigen: true },
  eigen_leeg: { velden: {} },
});
assert.equal(alle.find(v => v.id === eerste.id).naam, 'Nieuwe naam');
assert.equal(alle.find(v => v.id === eerste.id)._status, 'aangepast');
assert.equal(alle.find(v => v.id === eerste.id).tekening, eerste.tekening, 'tekening blijft uit de basis');
assert.equal(alle.find(v => v.id === tweede.id)._status, 'uit');
assert.equal(alle.find(v => v.id === 'eigen_x')._status, 'eigen');
assert.ok(!alle.some(v => v.id === 'eigen_leeg'), 'overlay zonder naam en zonder basis telt niet');
assert.equal(eerste.naam === 'Nieuwe naam', false, 'basis zelf niet aangepast');

// runtime: uitgezette vorm niet in de planner, wel op te zoeken
B.zetOverlays({ [tweede.id]: { velden: {}, status: 'uit' } });
assert.ok(!B.vormen().some(v => v.id === tweede.id));
assert.ok(B.vormOpId(tweede.id));
const p = maakPlan(B.vormen(), { categorie: 'O11', leeftijd: 11, aantalSpelers: 12, niveau: 2, duur: 60, thema: B.vormen()[0].thema[0], blokFase: 'Ontdek', seed: 'x', recent: [] });
assert.ok(p.onderdelen.every(o => o.vormId !== tweede.id), 'planner kiest geen uitgezette vorm');
B.zetOverlays({});

// verschil en controle
assert.deepEqual(B.verschilMetBasis({ ...eerste, doel: 'x' }, eerste), { doel: 'x' });
assert.deepEqual(B.valideerVorm(eerste), [], 'basisvorm is geldig: ' + B.valideerVorm(eerste).join(', '));
assert.ok(basis.every(v => !B.valideerVorm(v).length), 'alle basisvormen geldig: ' + basis.filter(v => B.valideerVorm(v).length).map(v => v.id + ' ' + B.valideerVorm(v)).slice(0, 3).join(' | '));
assert.ok(B.valideerVorm({ ...eerste, leeftijd: [14, 12] }).length);
assert.ok(B.valideerVorm({ ...eerste, spelers: { min: 10, ideaal: 8, max: 12 } }).length);

// Excel heen en terug
const rij = B.rijVan({ ...eerste, _status: 'basis' });
assert.equal(rij.id, eerste.id); assert.equal(rij.status, 'aan');
const terug = B.vormUitRij(rij, eerste);
assert.deepEqual(B.verschilMetBasis(terug, eerste), {}, 'rij → vorm geeft dezelfde vorm');
const imp = B.vergelijkImport([
  { ...rij, doel: 'Ander doel' },
  { ...B.rijVan({ ...tweede, _status: 'basis' }), status: 'uit' },
  { ...rij, id: '', naam: 'Nieuw ding' },
  { ...rij, id: eerste.id, leeftijdVan: 14, leeftijdTot: 12 },
  { ...rij, id: 'bestaat_niet' },
], B.voegSamen(basis, {}));
assert.deepEqual(imp.map(x => x.soort), ['gewijzigd', 'status', 'nieuw', 'fout', 'fout']);
assert.deepEqual(imp[0].velden, ['doel']);
assert.ok(imp[2].id.startsWith('eigen_'));

// oefening herbouwen met een gewijzigde vorm
const pl = maakPlan(basis, { categorie: 'O11', leeftijd: 11, aantalSpelers: 12, niveau: 2, duur: 60, thema: basis[5].thema[0], blokFase: 'Ontdek', seed: 'y', recent: [] });
const oef = SC.oefeningVan(pl.onderdelen[0]);
assert.equal(oef.bron.vormId, pl.onderdelen[0].vormId); assert.ok(oef.bron.minuten > 0);
assert.deepEqual(SC.vormIdsVan([oef]), [pl.onderdelen[0].vormId]);
const v0 = pl.onderdelen[0].vorm;
const nieuw = SC.herbouwOefening(oef, { ...v0, naam: 'Hernoemd', coachpunten: ['Kijk om je heen'] }, { thema: pl.profiel.thema });
assert.equal(nieuw.titel, 'Hernoemd');
assert.ok(nieuw.blokken.some(b => b.kop === 'Coachpunten' && b.items.includes('Kijk om je heen')));
assert.equal(nieuw.blokken[0].tekst, oef.blokken[0].tekst, 'minuten en onderdeel blijven gelijk');
// oude oefening zonder bron: vorm op titel, minuten uit de tekst
const oud = { ...oef }; delete oud.bron;
const br = SC.bronVanOefening(oud, basis);
assert.equal(br.vormId, v0.id); assert.equal(br.minuten, oef.bron.minuten); assert.equal(br.slot, oef.bron.slot);
console.log('bibliotheek: alle controles geslaagd');
