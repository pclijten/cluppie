// Bewaartermijnen: vertrokken spelers en oude seizoenen. Draaien: node tests/bewaartermijn.test.mjs
import assert from 'node:assert/strict';
const B = await import('../public/js/bewaartermijn-logica.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* keuze */
gelijk(B.schoonBewaar(null), { spelersJaren: 1, seizoenen: 3 });
gelijk(B.schoonBewaar({ spelersJaren: '2', seizoenen: '0' }), { spelersJaren: 2, seizoenen: 0 }, 'waarden uit een select zijn tekst');
gelijk(B.schoonBewaar({ spelersJaren: 9, seizoenen: 4 }), { spelersJaren: 1, seizoenen: 3 }, 'onbekende keuze valt terug op het voorstel');

/* seizoenen */
gelijk(B.seizoenStart("2025/'26"), 2025); gelijk(B.seizoenStart('2025-2026'), 2025); gelijk(B.seizoenStart(''), null); gelijk(B.seizoenStart('seizoen 1'), null);
gelijk(B.seizoenVanDatum('2026-06-30'), 2025, '30 juni hoort nog bij het oude seizoen');
gelijk(B.seizoenVanDatum('2026-07-01'), 2026, '1 juli is het nieuwe seizoen');
gelijk(B.seizoenVanDatum('onzin'), null);
gelijk(B.seizoenseinde('2025-11-21'), '2026-06-30'); gelijk(B.seizoenseinde('2026-03-01'), '2026-06-30'); gelijk(B.seizoenseinde(null), null);
gelijk(B.seizoenLabel(2025), "2025/'26");

/* vertrokken spelers: einde van het seizoen van vertrek plus de termijn */
gelijk(B.opruimenVanaf('2024-05-18', 1), '2025-06-30');
gelijk(B.opruimenVanaf('2024-07-02', 1), '2026-06-30', 'vertrokken in het nieuwe seizoen: een jaar later');
gelijk(B.opruimenVanaf('2024-05-18', 3), '2027-06-30');
gelijk(B.opruimenVanaf('', 1), null);
const sp = (o) => ({ id: 'p', gearchiveerd: true, gearchiveerdOp: '2024-05-18', naarTeam: null, ...o });
gelijk(B.spelerVerlopen(sp(), 1, '2025-07-01'), true);
gelijk(B.spelerVerlopen(sp(), 1, '2025-06-30'), false, 'op de laatste dag nog niet');
gelijk(B.spelerVerlopen(sp(), 2, '2025-07-01'), false);
gelijk(B.spelerVerlopen(sp({ gearchiveerd: false }), 1, '2030-01-01'), false, 'een actieve speler nooit');
gelijk(B.spelerVerlopen(sp({ gearchiveerd: 'ja' }), 1, '2030-01-01'), false, 'alleen echt true telt');
gelijk(B.spelerVerlopen(sp({ gearchiveerdOp: undefined }), 1, '2030-01-01'), false, 'zonder datum niets doen');
gelijk(B.spelerVerlopen(null, 1, '2030-01-01'), false);
{
  const r = B.sorteerSpelers([sp({ id: 'a' }), sp({ id: 'b', naarTeam: 't2', gearchiveerdOp: '2024-06-30' }), sp({ id: 'c', gearchiveerdOp: '2026-10-01' }), sp({ id: 'd', gearchiveerdOp: '2025-09-01' }),
    sp({ id: 'e', gearchiveerdOp: null }), { id: 'f', naam: 'actief' }], 1, '2026-11-21');
  gelijk(r.verlopen.map(p => [p.id, p.weg]), [['a', true], ['b', false]]);
  gelijk(r.later.map(p => [p.id, p.vanaf]), [['d', '2027-06-30'], ['c', '2028-06-30']], 'later: eerst wie het eerst verloopt');
  gelijk(r.zonderDatum, 1);
  gelijk(B.sorteerSpelers(null, 1, '2026-11-21'), { verlopen: [], later: [], zonderDatum: 0 });
}

/* oude seizoenen */
gelijk(B.oudsteBewaard("2026/'27", 3), 2024); gelijk(B.oudsteBewaard("2026/'27", 2), 2025); gelijk(B.oudsteBewaard("2026/'27", 0), null); gelijk(B.oudsteBewaard('', 3), null);
gelijk(B.seizoenVerlopen("2023/'24", "2026/'27", 3), true);
gelijk(B.seizoenVerlopen("2024/'25", "2026/'27", 3), false, 'het oudste bewaarde seizoen blijft');
gelijk(B.seizoenVerlopen("2026/'27", "2026/'27", 2), false, 'het lopende seizoen nooit');
gelijk(B.seizoenVerlopen("2027/'28", "2026/'27", 2), false, 'een toekomstig label nooit');
gelijk(B.seizoenVerlopen('', "2026/'27", 2), false, 'zonder label blijft het staan');
gelijk(B.seizoenVerlopen("2010/'11", "2026/'27", 0), false, 'alles bewaren');
gelijk(B.seizoenVerlopen("2010/'11", '', 3), false, 'zonder lopend seizoen niets wissen');

/* aanwezigheid zonder de gewiste spelers */
{
  const d = { datum: '2024-03-12', afwezig: ['a', 'x'], telaat: ['b'], selectie: ['a', 'b', 'x', 'y'], afwezigRedenen: { a: 'ziek', x: 'school' }, aantalSpelers: 4 };
  gelijk(B.presentieZonder(d, ['a', 'b']), { afwezig: ['x'], telaat: [], selectie: ['x', 'y'], afwezigRedenen: { x: 'school' } });
  gelijk(B.presentieZonder(d, ['q']), null, 'speler komt er niet in voor');
  gelijk(B.presentieZonder({ afwezig: ['a'] }, ['a']), { afwezig: [] }, 'oud document zonder selectie');
  gelijk(B.presentieZonder({}, ['a']), null); gelijk(B.presentieZonder(null, ['a']), null);
  gelijk(d.afwezig, ['a', 'x'], 'het origineel verandert niet');
}

/* tekst */
gelijk(B.datumNL('2025-06-30'), '30 juni 2025'); gelijk(B.datumNL(''), '');
gelijk(B.tellingTekst({ wedstrijden: 1, presentie: 30, teamevaluaties: 2 }), '1 wedstrijd, 30 trainingen met aanwezigheid, 2 teamevaluaties');
gelijk(B.tellingTekst(null), '');
gelijk(B.laatstTekst(null), 'Nog niet opgeruimd');
ok(/^Laatst opgeruimd op \d+ \w+ \d{4}: 3 spelers en 1 document uit oude seizoenen$/.test(B.laatstTekst({ ms: Date.parse('2026-11-21T12:00:00'), spelers: 3, documenten: 1 })));
ok(/^Laatst opgeruimd op \d+ \w+ \d{4}$/.test(B.laatstTekst({ ms: 1795000000000 })), 'zonder aantallen');
for (const [, een, veel] of B.SEIZOEN_COLLECTIES) ok(een && veel);
console.log(`bewaartermijn: ${n} controles geslaagd`);
