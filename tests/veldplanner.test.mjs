// Veldplanner: vakken, botsingen, controles, vrij vak, opslag schoonmaken. Draaien: node tests/veldplanner.test.mjs
import assert from 'node:assert/strict';
const V = await import('../public/js/veldplanner-logica.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* tijd */
gelijk(V.naarMin('18:15'), 1095); gelijk(V.naarTijd(1095), '18:15'); gelijk(V.naarMin('x'), null);
gelijk(V.rondKwartier(1102), 1095); gelijk(V.rondKwartier(1103), 1110);

/* vakken: vast heel/half/kwart, eigen erbij, rommel eruit */
const inst = { vakken: [
  { id: 'e1', naam: 'Pannaveldje', x: .4, y: .06, w: .2, h: .3 },
  { id: 'h', naam: 'Kaapt het vaste id', x: 0, y: 0, w: .1, h: .1 },
  { id: 'e3', naam: 'Te klein', x: 0, y: 0, w: .01, h: .01 },
  { naam: 'Zonder getallen' },
  { id: 'e4', naam: 'x'.repeat(50), x: .9, y: .9, w: .5, h: .5 },
] };
const vk = V.vakkenVan(inst);
gelijk(vk.slice(0, 7).map(k => k.id), ['h', 'a', 'b', 'av', 'aa', 'bv', 'ba']);
gelijk(vk.filter(k => k.eigen).map(k => k.naam.length), [11, 18, 30], 'pannaveld, hernoemd id, lange naam ingekort');
ok(vk.filter(k => k.eigen).every(k => k.id !== 'h'), 'eigen vak krijgt nooit een vast id');
const rand = vk.find(k => k.eigen && k.x === .9); gelijk([rand.w, rand.h], [.1, .1], 'eigen vak blijft binnen het veld');
gelijk(V.vakkenVan(null).length, 7);
gelijk(V.vakkenVan({ vakken: Array.from({ length: 20 }, (_, i) => ({ id: 'e' + i, naam: 'v', x: 0, y: 0, w: .2, h: .2 })) }).length, 7 + V.MAX_EIGEN);

/* overlap en banen */
const vak = id => V.vakUit(vk, id);
ok(V.vakkenOverlap(vak('h'), vak('av'))); ok(!V.vakkenOverlap(vak('a'), vak('b'))); ok(!V.vakkenOverlap(vak('av'), vak('aa')));
ok(V.vakkenOverlap(vak('e1'), vak('av')) && V.vakkenOverlap(vak('e1'), vak('bv')), 'pannaveld op de middenlijn raakt beide kwarten voor');
gelijk(V.banenVan(vak('h')), [0, 1, 2, 3]); gelijk(V.banenVan(vak('b')), [2, 3]); gelijk(V.banenVan(vak('e1')), [0, 2]);
gelijk(V.stukken([0, 2]), [[0, 0], [2, 2]]); gelijk(V.stukken([2, 3, 0]), [[0, 0], [2, 3]]);
gelijk(V.deelVan(vak('a')), .5); gelijk(V.deelTekst(.25), 'kwart veld'); gelijk(V.deelTekst(.06), '6% van het veld');
gelijk(V.meters(vak('av')), '53 × 34 m');

/* teams */
gelijk(V.maatVanCategorie('JO9'), 'kwart'); gelijk(V.maatVanCategorie('MO11'), 'half'); gelijk(V.maatVanCategorie('JO19', 'JO19-1'), 'heel');
gelijk(V.maatVanCategorie('JO17', 'JO17-2'), 'half'); gelijk(V.maatVanCategorie('', 'Senioren'), 'half'); gelijk(V.maatVanCategorie('', 'JO8-2'), 'kwart');
gelijk(V.duurVanCategorie('JO8'), 60); gelijk(V.duurVanCategorie('JO12'), 75); gelijk(V.duurVanCategorie('JO15'), 90);

/* vrij vak */
const t = V.naarMin;
const r = [
  { id: 'b1', team: 'A', dag: 2, start: t('18:00'), eind: t('19:15'), veld: 'v1', vak: 'a', kk: ['k1'] },
  { id: 'b2', team: 'B', dag: 2, start: t('18:00'), eind: t('19:00'), veld: 'v1', vak: 'bv', kk: ['k2'] },
];
gelijk(V.zoekVrijVak(r, inst, { dag: 2, veld: 'v1', start: t('18:30'), eind: t('19:30'), nodig: .25 }), 'ba', 'kleinste vrije kwart');
gelijk(V.zoekVrijVak(r, inst, { dag: 2, veld: 'v1', start: t('18:30'), eind: t('19:30'), nodig: .5 }), null, 'geen half vrij');
gelijk(V.zoekVrijVak(r, inst, { dag: 2, veld: 'v1', start: t('19:15'), eind: t('20:00'), nodig: .5, voorkeur: 'b' }), 'b', 'voorkeur als die vrij is');
gelijk(V.zoekVrijVak(r, inst, { dag: 2, veld: 'v1', start: t('18:00'), eind: t('19:00'), nodig: .25, voorkeur: 'a' }, 'b1'), 'a', 'eigen blok telt niet mee');
gelijk(V.zoekVrijVak(r, inst, { dag: 3, veld: 'v1', start: t('18:00'), eind: t('19:00'), nodig: 1 }), 'h');
const kks = [{ id: 'k1', naam: 'Kleedkamer 1' }, { id: 'k2', naam: 'Kleedkamer 2' }, { id: 'k3', naam: 'Kleedkamer 3' }];
gelijk(V.vrijeKleedkamers(r, kks, { dag: 2, start: t('19:45'), eind: t('20:30') }), ['k2', 'k3'], 'kk1 nog bezet tot 19:35');
gelijk(V.vrijeKleedkamers(r, kks, { dag: 2, start: t('20:00'), eind: t('20:30') }), ['k1', 'k2', 'k3']);

/* stapelen: kwart a voor en keepershoek links naast elkaar in dezelfde baan */
const inst4 = { vakken: [{ id: 'k1', naam: 'Keepershoek links', x: 0, y: .2, w: .16, h: .6 }, { id: 'p1', naam: 'Pionnen', x: .2, y: 0, w: .2, h: .4 }] };
const vk4 = V.vakkenVan(inst4);
const st = V.stapel([
  { id: 'x', team: 'A', dag: 1, start: 60, eind: 120, veld: 'v4', vak: 'bv' },
  { id: 'y', team: 'B', dag: 1, start: 60, eind: 120, veld: 'v4', vak: 'k1' },
  { id: 'z', team: 'C', dag: 1, start: 60, eind: 120, veld: 'v4', vak: 'p1' },
], vk4);
gelijk(st.x, { i: 0, n: 1 }); ok(st.y.n === 2 && st.z.n === 2 && st.y.i !== st.z.i, 'keepershoek en pionnenvak delen baan 0 zonder te botsen');

/* controles */
const ctx = {
  teams: {
    A: { naam: 'JO11-1', bouw: 'onder', maat: 'half', coaches: ['u1'], coachNamen: { u1: 'Ruud' } },
    B: { naam: 'JO12-1', bouw: 'midden', maat: 'half', coaches: ['u1', 'u2'], coachNamen: { u1: 'Ruud' } },
    C: { naam: 'JO17-1', bouw: 'boven', maat: 'heel', coaches: [] },
  },
  velden: { v1: { naam: 'Veld 1', licht: true }, v4: { naam: 'Veld 4', licht: false } },
  inst: { v1: inst },
  kleedkamers: kks,
};
const c = V.controleer([
  { id: 'b1', team: 'A', dag: 2, start: t('18:15'), eind: t('19:45'), veld: 'v1', vak: 'a', kk: ['k1'] },
  { id: 'b2', team: 'B', dag: 2, start: t('18:15'), eind: t('19:30'), veld: 'v1', vak: 'av', kk: ['k1'] },
  { id: 'b3', team: 'C', dag: 2, start: t('19:30'), eind: t('21:00'), veld: 'v4', vak: 'a', kk: [] },
  { id: 'b4', team: 'C', dag: 2, start: t('21:00'), eind: t('22:00'), veld: 'v1', vak: 'h', kk: ['k2'] },
], ctx);
const teksten = c.lijst.map(x => x.tekst);
ok(teksten.includes('JO11-1 en JO12-1 staan tegelijk op Veld 1 (18:15).'));
ok(teksten.includes('Kleedkamer 1 is dubbel: JO11-1 en JO12-1.'));
ok(teksten.includes('Ruud traint JO11-1 en JO12-1 tegelijk.'));
ok(teksten.includes('JO11-1 (onderbouw) traint tot 19:45. Advies: uiterlijk 19:30 klaar.'));
ok(teksten.includes('Veld 4 heeft geen licht en JO17-1 traint tot 21:00. In de winter is het om 17:00 donker.'));
ok(teksten.includes('JO12-1 heeft een half veld nodig en staat op kwart a voor (kwart veld).'));
ok(teksten.includes('JO17-1 heeft een heel veld nodig en staat op half a (half veld).'));
ok(teksten.includes('JO17-1 heeft nog geen kleedkamer.'));
ok(teksten.includes('JO17-1 traint twee keer op dezelfde dag.'));
gelijk(c.status.b1, 'botsing'); gelijk(c.status.b3, 'waarsch');
gelijk(V.controleer([], ctx).lijst, []);
gelijk(V.controleer([{ id: 'q', team: 'C', dag: 1, start: 1000, eind: 1090, veld: 'v1', vak: 'h', kk: [] }], { ...ctx, kleedkamers: [] }).lijst, [], 'zonder kleedkamers geen melding over kleedkamers');

/* nog in te plannen */
gelijk(V.nogInTePlannen([{ id: 'A', per: 2 }, { id: 'C', per: 2 }, { id: 'D', per: 0 }], [{ team: 'A' }, { team: 'C' }, { team: 'C' }]).map(x => [x.t.id, x.n]), [['A', 1]]);

/* opslag schoonmaken */
gelijk(V.schoonBlok({ id: 'b1', team: 'A', dag: '2', start: 1095, eind: 1170, veld: 'v1', vak: 'a', kk: ['k1', 'k1', 7], extra: 'x' }),
  { id: 'b1', team: 'A', dag: 2, start: 1095, eind: 1170, veld: 'v1', vak: 'a', kk: ['k1', '7'] });
gelijk(V.schoonBlok({ id: 'b1', team: 'A', dag: 8, start: 1095, eind: 1170, veld: 'v1' }), null, 'dag 8 bestaat niet');
gelijk(V.schoonBlok({ id: 'b1', team: 'A', dag: 1, start: 1170, eind: 1095, veld: 'v1' }), null, 'eind voor start');
gelijk(V.schoonBlok({ id: 'b 1', team: 'A', dag: 1, start: 1000, eind: 1095, veld: 'v1' }), null, 'vreemd id');
gelijk(V.schoonRooster([{ id: 'a', team: 'A', dag: 1, start: 1000, eind: 1060, veld: 'v1' }, { id: 'a', team: 'B', dag: 1, start: 1000, eind: 1060, veld: 'v1' }, null]).length, 1, 'dubbel id eruit');
gelijk(V.schoonKleedkamers([{ id: 'k1', naam: ' Kleedkamer 1 ' }, { id: 'k1', naam: 'dubbel' }, { id: '', naam: 'x' }, { id: 'k2', naam: '' }]), [{ id: 'k1', naam: 'Kleedkamer 1' }]);
gelijk(V.kleedkamersVoorstel([{ soort: 'kleedkamer', naam: 'Kleedkamers 1–4' }, { soort: 'kleedkamer', naam: 'Kleedkamer 7' }, { soort: 'kantine', naam: 'Kantine 9' }]).map(k => k.id), ['k1', 'k2', 'k3', 'k4', 'k7']);
gelijk(V.kleedkamersVoorstel([], 3).map(k => k.naam), ['Kleedkamer 1', 'Kleedkamer 2', 'Kleedkamer 3']);

console.log(`veldplanner: ${n} controles geslaagd`);
