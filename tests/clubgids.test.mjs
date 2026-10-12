// Clubgids in de app (20261012h): tegenstander zoeken en plek bepalen.
// Draaien: node --import ./tests/hulp/stub-loader.mjs tests/clubgids.test.mjs
import assert from 'node:assert/strict';
const { zoekTegenstanders, clubVanTeam, plekVoor, normNaam } = await import('../public/js/clubgids.js');

const gids = [
  { code: 'TMKG482', naam: 'SV de Middenpeel', teams: ['SV de Middenpeel O12-1JM', 'SV de Middenpeel 1'], accommodatie: 'Sportpark De Blaarpeel',
    route: 'https://www.google.com/maps/search/?api=1&query=x' },
  { code: 'BBJF08R', naam: 'Gemert', teams: ['Gemert O12-3'], accommodatie: 'Sportpark Molenbroek', adres: 'Molenbroek 1', plaatsAdres: '5421 AA Gemert',
    route: 'https://www.google.com/maps/search/?api=1&query=y' },
  { code: 'MIF0001', naam: 'Mifano', teams: ['Mifano 1'], accommodatie: 'Sportpark De Kluis', plaats: 'Mierlo' },
  { code: 'BBHT73Z', naam: "ASV'33", teams: ["ASV'33 O12-1"], accommodatie: 'Sportpark De Hut' },
];
const pouleTeams = ['SV de Middenpeel O12-1JM', 'Gemert O12-3', 'SJO SVHV O12-2'];

let r = zoekTegenstanders(gids, 'mid', { pouleTeams, eigenCode: 'BBHT73Z' });
assert.deepEqual(r.poule.map(p => p.naam), ['SV de Middenpeel O12-1JM'], 'poule-team op woordbegin');
assert.equal(r.poule[0].club.code, 'TMKG482', 'poule-team gekoppeld aan de club');
assert.deepEqual(r.clubs.map(c => c.code), [], 'club van een poule-team niet dubbel');

r = zoekTegenstanders(gids, 'mi', { pouleTeams, eigenCode: 'BBHT73Z' });
assert.ok(r.clubs.some(c => c.code === 'MIF0001'), 'andere club gevonden');
r = zoekTegenstanders(gids, 'asv', { pouleTeams, eigenCode: 'BBHT73Z' });
assert.equal(r.clubs.length, 0, 'eigen club nooit als tegenstander');
r = zoekTegenstanders(gids, 'mierlo', { pouleTeams: [] });
assert.deepEqual(r.clubs.map(c => c.code), ['MIF0001'], 'zoeken op plaats');
assert.deepEqual(zoekTegenstanders(gids, 'm', { pouleTeams }), { poule: [], clubs: [] }, 'minstens 2 tekens');
r = zoekTegenstanders(gids, 'svhv', { pouleTeams });
assert.equal(r.poule[0].naam, 'SJO SVHV O12-2'); assert.equal(r.poule[0].club, null, 'poule-team zonder gids-item kan ook');

assert.equal(clubVanTeam(gids, 'Gemert O12-3').code, 'BBJF08R');
assert.equal(clubVanTeam(gids, 'Gemert O13-1').code, 'BBJF08R', 'onbekend team van bekende club: op clubnaam');
assert.equal(clubVanTeam(gids, 'Onbekend FC'), null);

assert.deepEqual(plekVoor(gids[1]), { accommodatie: 'Sportpark Molenbroek', adres: 'Molenbroek 1', plaatsAdres: '5421 AA Gemert',
  route: 'https://www.google.com/maps/search/?api=1&query=y', adresBekend: true });
assert.equal(plekVoor(gids[0]).adresBekend, false);
assert.equal(plekVoor(null), null); assert.equal(plekVoor({ naam: 'X' }), null);
assert.equal(normNaam("SSA/SJO VBC'25"), 'ssasjovbc25');
console.log('clubgids: alle controles geslaagd');
