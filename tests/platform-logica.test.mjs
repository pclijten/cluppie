// Platformcentrum: fases, volgende stap, clubherkenning, Vandaag doen en filters.
// Draaien: node tests/platform-logica.test.mjs
import assert from 'node:assert/strict';
const L = await import('../public/js/platform-logica.js');

const nu = Date.parse('2026-11-11T12:00:00Z');
const dag = 86400000;
const st = (gedaan, open = []) => ({ gedaan, totaal: 7, open });
const club = o => ({ id: 'c', naam: 'VV Test', teams: 10, gemaakt: nu - 90 * dag, laatsteGebruik: '2026-11-10', startlijst: st(7), signalen: [], status: 'groen', ...o });

/* fases */
assert.equal(L.faseVan(club({ teams: 0 }), nu), 'goedgekeurd');
assert.equal(L.faseVan(club({ startlijst: st(4, ['coaches']) }), nu), 'inrichten');
assert.equal(L.faseVan(club({ gemaakt: nu - 5 * dag }), nu), 'proef');
assert.equal(L.faseVan(club({}), nu), 'actief');
assert.equal(L.faseVan(club({ laatsteGebruik: '2026-10-01' }), nu), 'slapend', '41 dagen stil');
assert.equal(L.faseVan(club({ laatsteGebruik: null }), nu), 'slapend', 'nooit gebruikt, al 90 dagen oud');
assert.equal(L.faseVan(club({ laatsteGebruik: '2026-10-01', startlijst: st(3, ['teams']) }), nu), 'slapend', 'inrichten maar al lang stil');
assert.equal(L.faseVan(club({ gemaakt: nu - 10 * dag, laatsteGebruik: null, startlijst: st(3, ['teams']) }), nu), 'inrichten', 'nieuw en nog niet gebruikt: inrichten');
assert.equal(L.faseVan(club({ terugvalRij: true }), nu), 'onbekend');
assert.equal(L.faseVan(club({ laatsteGebruik: '2026-10-25' }), nu, { slapendDagen: 30 }), 'actief', 'grens instelbaar');

/* volgende stap */
const naam = { coaches: 'Coaches uitnodigen' };
assert.equal(L.volgendeStap(club({ teams: 0, sportlink: { gekoppeld: true } }), 'goedgekeurd', naam, nu), 'Teams uit Sportlink halen');
assert.equal(L.volgendeStap(club({ teams: 0 }), 'goedgekeurd', naam, nu), 'Teams aanmaken');
assert.equal(L.volgendeStap(club({ startlijst: st(5, ['coaches', 'vo']) }), 'inrichten', naam, nu), 'Coaches uitnodigen');
assert.equal(L.volgendeStap(club({ gemaakt: nu - 5 * dag }), 'proef', naam, nu), 'Proef loopt nog 9 dagen');
assert.equal(L.volgendeStap(club({ gemaakt: nu - 13 * dag }), 'proef', naam, nu), 'Proef loopt nog 1 dag');
assert.equal(L.volgendeStap(club({}), 'actief', naam, nu), '');

/* clubnamen herkennen */
assert.equal(L.normClub('V.V. De Leeuwen'), 'de leeuwen');
assert.equal(L.normClub('RKSV Beekdal'), 'beekdal');
assert.equal(L.normClub("ASV'33"), 'asv33');
assert.equal(L.normClub('Sportclub Zuid'), 'sportclub zuid', 'geen voorvoegsel zonder spatie erachter');
const clubs = [{ id: 'a', naam: 'VV De Leeuwen' }, { id: 'b', naam: 'SV Brakel' }];
assert.equal(L.herkenClub('de leeuwen', clubs)?.id, 'a');
assert.equal(L.herkenClub('Brakel', clubs)?.id, 'b');
assert.equal(L.herkenClub('VV Zandberg', clubs), null);
assert.equal(L.herkenClub('', clubs), null);

/* losse trainers met club */
const ind = { lijst: [
  { uid: 'u1', naam: 'Sanne', status: 'eigen-team', teams: [{ naam: 'MO13-1', eigenClub: { naam: 'S.V. Brakel', plaats: 'Bakel' } }] },
  { uid: 'u2', naam: 'Ruben', status: 'eigen-team', teams: [{ naam: 'O9-2', eigenClub: { naam: 'VV Zandberg' } }] },
  { uid: 'u3', naam: 'Jeroen', status: 'nog-geen-team', teams: [] },
] };
const tr = L.trainersMetClub(ind, clubs);
assert.deepEqual(tr.map(t => t.club?.id || null), ['b', null, null]);
assert.equal(tr[0].eigenClub.plaats, 'Bakel');

/* Vandaag doen: aanmeldingen, dan rood, dan trainers bij een bekende club, dan oranje */
const doe = L.vandaagDoen({
  aanmeldingen: [{ id: 'm1', clubNaam: 'VV Lierop', aantalTeams: 14, rol: 'Jeugdcoördinator' }],
  clubs: [
    { id: 'x', naam: 'X', fase: 'actief', teams: 9, signalen: [{ niveau: 'oranje', tekst: 'geen verwerkersovereenkomst' }] },
    { id: 'y', naam: 'Y', fase: 'slapend', teams: 4, signalen: [{ niveau: 'rood', tekst: '23 dagen geen activiteit' }] },
  ],
  trainers: tr,
});
assert.deepEqual(doe.map(t => t.soort + ':' + t.niveau), ['aanmelding:info', 'club:rood', 'trainer:oranje', 'club:oranje']);
assert.equal(doe[0].titel, 'VV Lierop wil Cluppie gebruiken');
assert.match(doe[0].sub, /14 teams · aangemeld door jeugdcoördinator/);
assert.equal(doe[1].titel, 'Y: 23 dagen geen activiteit');
assert.equal(doe[2].clubId, 'b');

/* zoeken en filteren */
const lijst = [
  { id: '1', naam: 'VV De Leeuwen', plaats: 'Helmond', status: 'groen', fase: 'actief', teamNamen: ['O11-1', 'MO13-2'] },
  { id: '2', naam: 'SV Brakel', plaats: 'Bakel', status: 'oranje', fase: 'inrichten', teamNamen: [] },
];
assert.deepEqual(L.filterClubs(lijst, { zoek: 'mo13' }).map(k => k.id), ['1'], 'zoeken op teamnaam');
assert.deepEqual(L.filterClubs(lijst, { zoek: 'bakel' }).map(k => k.id), ['2'], 'zoeken op plaats');
assert.deepEqual(L.filterClubs(lijst, { filter: 'aandacht' }).map(k => k.id), ['2']);
assert.deepEqual(L.filterClubs(lijst, { filter: 'groen' }).map(k => k.id), ['1']);
assert.deepEqual(L.filterClubs(lijst, { fase: 'inrichten' }).map(k => k.id), ['2']);

/* kerncijfers */
const k = L.kpiWaarden({ totalen: { actieveClubs: 4, clubs: 6, coaches30: 48, individueel: 4, individueelNieuw: 2, wachtend: 1, aiMaand: 260 },
  clubs: [{ ai: { aan: true }, signalen: [{ niveau: 'rood', tekst: 'Sportlink: 4 dagen geen sync' }] }, { ai: { aan: false }, signalen: [] }] }, [{ id: 'm1' }], []);
assert.equal(k.wacht, 3);
assert.equal(k.wachtUitleg, '1 club · 1 coach · 1 sync');
assert.equal(k.aiClubs, 1);

console.log('platform-logica: alle controles geslaagd');
