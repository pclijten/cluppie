import assert from 'node:assert/strict';
import {
  valideerClub, valideerPlaats, bouwEigenClub, teamStapKlaar, standaardTeamNaam,
  categorieVoor, weerVanTeam, eersteStappenStatus, toonEersteStappen, toonClubTip, EERSTE_STAPPEN,
} from '../public/js/snelstart-logica.js';

// club
assert.equal(valideerClub('  VV   Dorp ').naam, 'VV Dorp');
assert.equal(valideerClub('x').ok, false);
assert.equal(valideerClub('').ok, false);
assert.equal(valideerClub(null).ok, false);
assert.equal(valideerClub('a'.repeat(61)).ok, false);

// plaats
assert.equal(valideerPlaats({ plaats: '' }).ok, false);
assert.equal(valideerPlaats({ plaats: 'Aarle-Rixtel' }).ok, true);
assert.equal(valideerPlaats({ plaats: 'Aarle-Rixtel' }).weer, false);
const pw = valideerPlaats({ plaats: 'Helmond', lat: '51.4816', lon: 5.6611 });
assert.equal(pw.weer, true); assert.equal(pw.lat, 51.482);
assert.equal(valideerPlaats({ plaats: 'Helmond', lat: 999, lon: 5 }).weer, false);
assert.equal(valideerPlaats({ plaats: 'Helmond', lat: null, lon: null }).weer, false);

// eigenClub
let b = bouwEigenClub({ naam: 'VV Dorp', plaats: 'Dorp' });
assert.equal(b.ok, true);
assert.deepEqual(b.eigenClub, { naam: 'VV Dorp', plaats: 'Dorp', lat: null, lon: null });
assert.ok(!Object.values(b.eigenClub).includes(undefined));
b = bouwEigenClub({ naam: 'VV Dorp', plaats: 'Dorp', lat: 51.5, lon: 5.5, clubcode: 'BXYZ' });
assert.equal(b.eigenClub.clubcode, 'BXYZ'); assert.equal(b.weer, true);
assert.equal(bouwEigenClub({ naam: '', plaats: 'Dorp' }).ok, false);
assert.equal(bouwEigenClub({ naam: 'VV', plaats: '' }).ok, false);
assert.equal(bouwEigenClub().ok, false);

assert.equal(teamStapKlaar('VV Dorp', 'Dorp'), true);
assert.equal(teamStapKlaar('VV Dorp', ''), false);

// defaults
assert.equal(standaardTeamNaam('JO11', 'O11', 1), 'O11-1');
assert.equal(standaardTeamNaam('Senioren', 'Senioren', 1), 'Eerste elftal');
assert.equal(standaardTeamNaam('Vrouwen', 'Vrouwen', 3), 'Vrouwen 3');
assert.equal(categorieVoor('j', 'JO9', ['JO9', 'JO11']), 'JO9');
assert.equal(categorieVoor('m', 'O9', ['MO11', 'MO13']), 'MO11');
assert.equal(categorieVoor('m', 'x', ['MO13']), 'MO13');

// weer
const a = { id: 'a', eigenClub: { plaats: 'Aa', lat: 1, lon: 2 } };
const c = { id: 'c', eigenClub: { plaats: 'Cc', lat: 3, lon: 4 } };
const zonder = { id: 'z', eigenClub: { plaats: 'Zz', lat: null, lon: null } };
const metClub = { id: 'm', club: 'x', eigenClub: { plaats: 'Mm', lat: 5, lon: 6 } };
assert.equal(weerVanTeam([a, c], c).plaats, 'Cc');
assert.equal(weerVanTeam([a, c], zonder).plaats, 'Aa');
assert.equal(weerVanTeam([metClub], null), null);
assert.equal(weerVanTeam([], null), null);

// eerste stappen
let s = eersteStappenStatus({ leden: { u1: 1 } }, {});
assert.equal(s.gedaan, 0); assert.equal(s.totaal, EERSTE_STAPPEN.length); assert.equal(s.volgende, 'spelers');
s = eersteStappenStatus({ leden: { u1: 1, u2: 1 } }, { spelers: 12, wedstrijden: 1, training: true });
assert.equal(s.compleet, true); assert.equal(s.volgende, null);
s = eersteStappenStatus({ leden: { u1: 1 } }, { spelers: 5 });
assert.equal(s.gedaan, 1); assert.equal(s.volgende, 'wedstrijd');
assert.equal(toonEersteStappen({ id: 1 }, { status: s }), true);
assert.equal(toonEersteStappen({ id: 1, club: 'x' }, {}), false);
assert.equal(toonEersteStappen({ id: 1 }, { verborgen: true }), false);
assert.equal(toonEersteStappen({ id: 1 }, { status: { compleet: true } }), false);
assert.equal(toonEersteStappen(null), false);

// club-tip
assert.equal(toonClubTip({ id: 1 }), true);
assert.equal(toonClubTip({ id: 1, eigenClub: {} }), false);
assert.equal(toonClubTip({ id: 1, club: 'x' }), false);
assert.equal(toonClubTip({ id: 1 }, { verborgen: true }), false);

console.log('snelstart: ok');
assert.equal(categorieVoor('j', 'MO13', ['JO9', 'JO11', 'JO13']), 'JO11');
