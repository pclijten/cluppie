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

/* tekenen op de luchtfoto */
{
  let m = 0; const ok2 = (v, t) => { assert.ok(v, t); m++; }, gelijk2 = (a, b, t) => { assert.deepEqual(a, b, t); m++; };
  gelijk2(V.schoonObject({ id: 'o1', soort: 'parkeren', naam: ' P1 ', lat: 52.1, lon: 5.1, b: 40, h: 20.04 }), { id: 'o1', soort: 'parkeren', naam: 'P1', lat: 52.1, lon: 5.1, b: 40, h: 20 });
  gelijk2(V.schoonObject({ id: 'o2', soort: 'aed', lat: 52.1, lon: 5.1, b: 40 }), { id: 'o2', soort: 'aed', naam: 'AED', lat: 52.1, lon: 5.1 }, 'punt zonder maat');
  gelijk2(V.schoonObject({ soort: 'raket', lat: 1, lon: 1 }), null, 'onbekende soort');
  gelijk2(V.schoonObject({ soort: 'kantine', lat: 52, lon: 5, b: 1, h: 10 }), null, 'vlak te klein');
  gelijk2(V.schoonObject({ soort: 'kantine', lat: 'x', lon: 5, b: 10, h: 10 }), null);
  gelijk2(V.schoonObjecten(Array.from({ length: 80 }, (_, i) => ({ id: 'o' + i, soort: 'ingang', lat: 52, lon: 5 }))).length, V.MAX_OBJECTEN);
  const a = { lat: 52.1, lon: 5.1 }, b = V.verschuif(a, 40, 20), v = V.vlakUitHoeken(a, b);
  ok2(Math.abs(v.b - 40) < .01 && Math.abs(v.h - 20) < .01, 'vlak uit twee hoeken: 40 x 20 m');
  const d = V.meterTussen(a, b); ok2(Math.abs(d.x - 40) < .01 && Math.abs(d.y - 20) < .01);
  console.log(`veldplanner kaart: ${m} controles geslaagd`);
}

/* overzicht en tijd typen [20261127v] */
{
  let m = 0; const g = (a, b, t) => { assert.deepEqual(a, b, t); m++; };
  for (const [in_, uit] of [['17:30', 1050], ['17.30', 1050], ['17u30', 1050], ['1730', 1050], ['930', 570], ['9', 540], ['17', 1020],
    ['7:5', 470], [' 18:15 ', 1095], ['18 uur', 1080], ['24:00', 1440], ['24:15', null], ['25', null], ['17:75', null], ['abc', null], ['', null], ['12345', null]])
    g(V.leesTijd(in_), uit, `leesTijd(${JSON.stringify(in_)})`);
  const r = [
    { id: 'x1', team: 't1', dag: 1, start: 1080, eind: 1155, veld: 'v1', vak: 'av', kk: ['k1'] },
    { id: 'x2', team: 't2', dag: 1, start: 1110, eind: 1200, veld: 'v1', vak: 'b', kk: ['k2'] },
    { id: 'x3', team: 't3', dag: 2, start: 1080, eind: 1170, veld: 'v1', vak: 'h', kk: ['k1'] },
  ];
  g(V.opMoment(r, 1, 1080).map(b => b.id), ['x1']); g(V.opMoment(r, 1, 1155).map(b => b.id), ['x2'], 'einde telt niet mee');
  g([1064, 1065, 1100, 1160, 1175].map(t => V.kleedFase(r[0], t)), [null, 'voor', 'training', 'na', null]);
  const kk = V.kleedkamersOpMoment(r, 1, 1100); g(Object.keys(kk).sort(), ['k1', 'k2']); g(kk.k2.fase, 'voor');
  const d = V.drukte(r, {}, { dag: 1, van: 1080, tot: 1200, stap: 30, velden: 2 });
  g(d.map(x => x.veld), [.125, .375, .375, .25]); g(d.map(x => x.kk), [1, 2, 2, 2]);
  g(V.vrijeKwarten(r, {}, { dag: 1, veld: 'v1', t: 1120 }), ['aa']);
  g(V.dagBereik(r, 1), [1020, 1260]); g(V.dagBereik(r, 5), [960, 1320]);
  g(V.inVak({ x: .5, y: 0, w: .5, h: .5 }, .7, .2), true); g(V.inVak({ x: .5, y: 0, w: .5, h: .5 }, .2, .2), false);
  console.log(`veldplanner overzicht: ${m} controles geslaagd`);
}

/* kleedkamertijden en team-instellingen [20261127t] */
{
  let m = 0; const g = (a, b, t) => { assert.deepEqual(a, b, t); m++; };
  V.zetKleedTijden(5, 30); g([V.KK_VOOR, V.KK_NA], [5, 30], 'live binding');
  const b = { dag: 1, start: 1080, eind: 1140, kk: ['k1'] };
  g([1074, 1075, 1169, 1170].map(t => V.kleedFase(b, t)), [null, 'voor', 'na', null], 'fase met eigen tijden');
  V.zetKleedTijden('x', 99); g([V.KK_VOOR, V.KK_NA], [15, 20], 'onzin wordt standaard');
  g(V.schoonTeamInstellingen({ t1: { maat: 'half', duur: 77, per: 3 }, t2: { maat: 'groot', duur: 10, per: 9 }, 'kw@d': { maat: 'heel' }, t3: { per: 0 }, t4: { per: '' } }),
    { t1: { maat: 'half', duur: 75, per: 3 }, t3: { per: 0 } });
  g(V.schoonTeamInstellingen(null), {}); g(V.schoonTeamInstellingen([1]), {});
  console.log(`veldplanner instellingen: ${m} controles geslaagd`);
}

/* planning inlezen [20261127t] */
{
  let m = 0; const g = (a, b, t) => { assert.deepEqual(a, b, t); m++; };
  const ctx = { teams: [{ id: 't1', naam: 'O11-2', duur: 75 }, { id: 't2', naam: 'O9-1', duur: 60 }, { id: 't3', naam: 'MO13-1', duur: 75 }, { id: 't4', naam: 'O11-1' }],
    velden: [{ id: 'v1', naam: 'Veld 1' }, { id: 'v2', naam: 'Veld 2' }], kleedkamers: [{ id: 'k1', naam: 'Kleedkamer 1' }, { id: 'k3', naam: 'Kleedkamer 3' }] };
  const r = V.leesPlanning(`Trainingsschema najaar
MAANDAG
JO11-2\t18:00 - 19:15\tVeld 2 half a\tKK 3
JO9-1  17.00-18.00  veld 1 kwart b voor  kleedkamer 1
Dinsdag 19:00-20:30 MO13-1 Veld 1 heel kk 1 en 3
woensdag O11-1 18:30 veld 2b
JO11-2 18:00-19:15 veld 9
Algemene opmerking zonder team`, ctx);
  g(r.gevonden.map(x => [x.team, x.dag, x.start, x.eind, x.veld, x.vak, x.kk]), [
    ['t1', 1, 1080, 1155, 'v2', 'a', ['k3']],
    ['t2', 1, 1020, 1080, 'v1', 'bv', ['k1']],
    ['t3', 2, 1140, 1230, 'v1', 'h', ['k1', 'k3']],
    ['t4', 3, 1110, 1185, 'v2', 'b', []],
  ]);
  g(r.overgeslagen, ['JO11-2 18:00-19:15 veld 9'], 'onbekend veld wordt overgeslagen, losse tekst niet gemeld');
  g(V.leesPlanning('', ctx), { gevonden: [], overgeslagen: [] });
  /* tabel met kopregel: kale nummers onder Kleedkamer/Veld; JO13-1 is niet MO13-1; "kwart a" */
  const ctx2 = { ...ctx, teams: [...ctx.teams, { id: 't5', naam: 'O13-1' }] };
  const t = V.leesPlanning('Dag\tTijd\tTeam\tVeld\tDeel\tKleedkamer\nMaandag\t17:30-18:45\tJO13-1\t2\tkwart a\t3\nMaandag\t17:30-18:45\tMO13-1\tVeld 1\thalf b\t1', ctx2);
  g(t.gevonden.map(x => [x.team, x.veld, x.vak, x.kk]), [['t5', 'v2', 'av', ['k3']], ['t3', 'v1', 'b', ['k1']]]);
  console.log(`veldplanner inlezen: ${m} controles geslaagd`);
}

/* meldingen wegklikken en dag kopiëren [20261127u] */
{
  let m = 0; const g = (a, b, t) => { assert.deepEqual(a, b, t); m++; };
  const ctx = { teams: { t1: { naam: 'O11-1', bouw: 'boven', maat: 'kwart', coaches: ['p'], coachNamen: { p: 'Paul' } }, t2: { naam: 'O15-1', bouw: 'boven', maat: 'kwart', coaches: ['p'], coachNamen: { p: 'Paul' } } },
    velden: { v1: { naam: 'Veld 1', licht: true }, v2: { naam: 'Veld 2', licht: true } }, inst: {}, kleedkamers: [] };
  const r = [{ id: 'a', team: 't1', dag: 1, start: 1080, eind: 1155, veld: 'v1', vak: 'h', kk: [] }, { id: 'b', team: 't2', dag: 1, start: 1080, eind: 1155, veld: 'v2', vak: 'h', kk: [] }];
  const c0 = V.controleer(r, ctx);
  g(c0.lijst.map(x => [x.sleutel, x.wie?.uid]), [['coach:1:t1+t2:p', 'p']]);
  g(c0.status, { a: 'waarsch', b: 'waarsch' });
  const c1 = V.controleer(r, { ...ctx, negeer: { trainers: ['p'], meldingen: [] } });
  g([c1.lijst.length, c1.genegeerd, c1.status], [0, 1, {}]);
  g(V.controleer(r, { ...ctx, negeer: { trainers: [], meldingen: ['coach:1:t1+t2:p'] } }).lijst.length, 0);
  /* botsing blijft, ook als de sleutel zou passen */
  const bots = [{ ...r[0] }, { ...r[1], veld: 'v1' }];
  g(V.controleer(bots, { ...ctx, negeer: { trainers: ['p'], meldingen: [] } }).lijst.map(x => x.soort), ['fout']);
  g(V.schoonNegeer({ trainers: ['p', 'p', '', 'a b'], meldingen: 'x' }), { trainers: ['p'], meldingen: [] });
  let i = 0; const id = () => 'n' + (++i);
  const k = V.kopieerDag([...r, { id: 'c', team: 't1', dag: 3, start: 1000, eind: 1075, veld: 'v1', vak: 'h', kk: ['k1'] }], 1, [3, 4, 1], 'vervang', id);
  g([k.n, k.rooster.map(b => [b.id, b.dag]).sort()], [4, [['a', 1], ['b', 1], ['n1', 3], ['n2', 3], ['n3', 4], ['n4', 4]]]);
  g(V.kopieerDag(r, 1, [2], 'erbij', id).rooster.length, 4);
  console.log(`veldplanner wegklikken en kopiëren: ${m} controles geslaagd`);
}
