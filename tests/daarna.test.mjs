import assert from 'node:assert/strict';
// Daarna op het startscherm: welke regels onder de Nu-kaart staan en met welk belang.
// Draaien: node tests/daarna.test.mjs
const { kiesDaarna, losseEvenementen, evenementen, bepaalNu } = await import('../public/js/nu-context.js');
// [20261121a] een training van vandaag blijft tot middernacht op de kaart; daarom net na middernacht
const nu = new Date(2026, 10, 18, 0, 30);                        // wo 18 nov 00:30
const team = { trainingsmomenten: [{ dag: 2, start: '19:00', eind: '20:15' }, { dag: 4, start: '19:00', eind: '20:15' }] };
const W = (id, datum, aftrap, extra = {}) => ({ id, datum, aftrap, tegenstander: id, thuis: true, ...extra });
const kort = r => r.map(x => `${x.prio}:${x.type === 'dag' ? 'dag' : x.type[0]}:${x.datum.slice(5)}`).join(' ');
const draai = (wedstrijden, planning, opt = {}) => {
  const c = bepaalNu({ nu: opt.nu || nu, team, wedstrijden, presentie: {}, plek: 'onbekend' });
  return { c, r: kiesDaarna({ nu: opt.nu || nu, hoofd: c.event, events: evenementen(opt.nu || nu, team, wedstrijden), losse: opt.losse || [], planning,
    wedstrijdDatums: new Set(wedstrijden.map(w => w.datum).concat(opt.extraDatums || [])), afgelast: opt.afgelast }) };
};
let { c, r } = draai([W('w1', '2026-11-21', '14:30')], [{ bron: 'eigen', type: 'eigen', datum: '2026-11-25', label: 'Teamfoto' }]);
assert.equal(c.event.type, 'training'); assert.equal(c.event.datum, '2026-11-19');
assert.equal(kort(r), '1:w:11-21 3:t:11-24 2:dag:11-25 3:t:11-26', 'mockup-situatie');
// kaart = wedstrijd -> de vaste regel is de training
({ c, r } = draai([W('w1', '2026-11-21', '14:30'), W('w2', '2026-11-28', '12:00')], [], { nu: new Date(2026, 10, 21, 9, 30) }));
assert.equal(c.event.type, 'wedstrijd'); assert.equal(r[0].type, 'training'); assert.equal(r[0].prio, 1);
assert.ok(!r.some(x => x.id === 'w1'), 'de kaart zelf staat niet onder Daarna');
assert.equal(r.filter(x => x.prio === 1).length, 1);
// vrij/beker/inhaal vervallen als er dat weekend een wedstrijd staat (zaterdag of de kalenderzondag)
const knvb = (type, datum, knvbDatum) => ({ bron: 'knvb', type, datum, knvbDatum, label: type });
({ r } = draai([W('w1', '2026-11-21', '14:30')], [knvb('beker', '2026-11-21', '2026-11-22')]));
assert.ok(!r.some(x => x.type === 'dag'), 'beker met wedstrijd op zaterdag');
({ r } = draai([W('w1', '2026-11-22', '14:30')], [knvb('vrij', '2026-11-21', '2026-11-22')]));
assert.ok(!r.some(x => x.type === 'dag'), 'vrij met wedstrijd op de kalenderzondag');
({ r } = draai([], [knvb('vrij', '2026-11-21', '2026-11-22'), knvb('wd', '2026-11-28', '2026-11-29')]));
assert.equal(r.filter(x => x.type === 'dag').length, 1); assert.equal(r.find(x => x.type === 'dag').datum, '2026-11-21');
assert.equal(r.find(x => x.type === 'dag').prio, 2);
// gewone speeldag en lijstje tellen niet als bijzondere dag; een clubactiviteit wel
({ r } = draai([], [knvb('wd', '2026-11-21', '2026-11-22'), { bron: 'lijst', type: 'lijst', datum: '2026-11-20', label: 'x' }]));
assert.ok(!r.some(x => x.type === 'dag'));
({ r } = draai([W('w1', '2026-11-21', '09:00')], [{ bron: 'club', type: 'club', datum: '2026-11-23', label: 'Algemene ledenvergadering', opmerking: '20:00' }]));
assert.equal(kort(r), '1:w:11-21 2:dag:11-23 3:t:11-24 3:t:11-26', 'ALV als bijzondere dag');
{ // volgorde binnen een dag: de vergadering van 20:00 staat na de training van 19:00, een dag zonder tijd ervoor
  const di = [{ bron: 'club', type: 'club', datum: '2026-11-24', label: 'ALV', tijd: '20:00' }];
  let x = draai([], di).r; assert.deepEqual(x.filter(y => y.datum === '2026-11-24').map(y => y.type), ['training', 'dag']);
  x = draai([], [{ ...di[0], tijd: '9:30' }]).r; assert.deepEqual(x.filter(y => y.datum === '2026-11-24').map(y => y.type), ['dag', 'training']);
  x = draai([], [{ ...di[0], tijd: '' }]).r; assert.deepEqual(x.filter(y => y.datum === '2026-11-24').map(y => y.type), ['dag', 'training']);
}
({ r } = draai([W('w1', '2026-11-21', '09:00')], [{ bron: 'club', type: 'club', datum: '2026-11-21', label: 'Clubdag' }]));
assert.ok(r.some(x => x.type === 'dag'), 'een clubactiviteit blijft staan, ook op een wedstrijddag');
({ r } = draai([], [{ bron: 'club', type: 'club', datum: '2026-11-25', label: 'later' }, { bron: 'eigen', type: 'eigen', datum: '2026-11-20', label: 'eerder' }]));
assert.equal(r.filter(x => x.type === 'dag').length, 1); assert.equal(r.find(x => x.type === 'dag').item.label, 'eerder', 'alleen de eerstvolgende');
// horizon: 14 dagen, verleden niet
({ r } = draai([], [knvb('vrij', '2026-12-03', '2026-12-03'), knvb('vrij', '2026-11-17', '2026-11-17')]));
assert.ok(!r.some(x => x.type === 'dag'), '15 dagen vooruit en gisteren vallen af');
({ r } = draai([], [knvb('vrij', '2026-12-02', '2026-12-02')])); assert.ok(r.some(x => x.type === 'dag'), 'precies 14 dagen telt');
({ r } = draai([], [{ bron: 'eigen', type: 'eigen', datum: '2026-11-18', label: 'vandaag' }])); assert.equal(r[0].type, 'dag', 'een eigen dag vandaag staat bovenaan');
// hooguit 4 regels, op datum
({ r } = draai([W('w1', '2026-11-21', '14:30'), W('w2', '2026-11-22', '10:00'), W('w3', '2026-11-23', '10:00')], [{ bron: 'eigen', type: 'eigen', datum: '2026-11-20', label: 'x' }]));
assert.equal(r.length, 4); assert.deepEqual(r.map(x => x.datum), [...r.map(x => x.datum)].sort());
// afgelaste wedstrijd telt niet als eerstvolgende zolang er een andere is
const afg = e => e.type === 'wedstrijd' && e.w.id === 'w1';
({ r } = draai([W('w1', '2026-11-21', '14:30'), W('w2', '2026-11-28', '12:00')], [], { afgelast: afg }));
assert.equal(r.find(x => x.prio === 1).id, 'w2');
({ r } = draai([W('w1', '2026-11-21', '14:30')], [], { afgelast: afg })); assert.equal(r.find(x => x.prio === 1).id, 'w1', 'enige wedstrijd blijft staan');
// activiteiten zonder tijd (op di 17 nov 21:30, zoals voorheen)
const nuDi = new Date(2026, 10, 17, 21, 30);
const los = losseEvenementen(nuDi, { trainingsmomenten: [{ dag: 2 }, { dag: 4, start: '19:00' }] }, [{ id: 'w5', datum: '2026-11-21', aftrap: '' }, { id: 'w6', datum: '2026-11-10', aftrap: '' }, { id: 'w7', datum: '2026-11-22', aftrap: '10:00' }]);
assert.deepEqual(los.map(e => e.id), ['t-2026-11-17', 't-2026-11-24', 'w5'], 'alleen zonder tijd, niet in het verleden');
r = kiesDaarna({ nu: nuDi, hoofd: null, events: [], losse: los, planning: [], wedstrijdDatums: new Set() });
assert.equal(kort(r), '1:t:11-17 1:w:11-21 3:t:11-24', 'zonder kaart: eerste wedstrijd en eerste training vast');
assert.deepEqual(kiesDaarna({ nu, hoofd: null, events: [], losse: [], planning: [], wedstrijdDatums: [] }), []);
assert.deepEqual(kiesDaarna({ nu }), []);
console.log('logica Daarna: alle controles geslaagd');
