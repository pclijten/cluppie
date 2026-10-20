// Individuele coaches in het eindbaasscherm (functions/platform.js → bepaalIndividueleCoaches).
// Draaien: node tests/individuele-coaches.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { bepaalIndividueleCoaches: bepaal } = require('../functions/platform.js');

const NU = Date.parse('2026-10-20T12:00:00Z');
const dag = n => NU - n * 86400000;
const gebruikers = [
  { uid: 'club1', email: 'a@club.nl', naam: 'Anna', aangemeld: dag(40) },          // lid van een club
  { uid: 'admin1', email: 'b@club.nl', naam: 'Bas', aangemeld: dag(40) },           // clubadmin
  { uid: 'soloA', email: 'c@mail.nl', naam: 'Cor', aangemeld: dag(2) },             // eigen team, nieuw
  { uid: 'leeg', email: 'd@mail.nl', naam: '', aangemeld: dag(1) },                 // nog niets gedaan
  { uid: 'wacht', email: 'e@mail.nl', naam: 'Eva', aangemeld: dag(20) },            // aanvraag open
  { uid: 'eig', email: 'pclijten@gmail.com', naam: 'Paul', aangemeld: dag(90) },    // eindbaas zelf
  { uid: 'viaTeam', email: 'f@club.nl', naam: 'Fred', aangemeld: dag(5) },          // alleen in een clubteam
  { uid: 'soloB', email: 'g@mail.nl', naam: 'Gijs', aangemeld: dag(30), laatsteLogin: dag(3) },
];
const clubs = [{ id: 'c1', leden: { club1: true }, admins: { admin1: true } }];
const teams = [
  { id: 't1', club: 'c1', leden: { club1: true, viaTeam: true } },
  { id: 't2', naam: 'O9-1', categorie: 'JO9', leden: { soloA: true }, spelers: 11 },
  { id: 't3', naam: 'O11-1', categorie: 'JO11', leden: { soloB: true }, spelers: 14 },
];
const r = bepaal({ gebruikers, teams, clubs, aanvragen: [{ uid: 'wacht', clubId: 'c1' }], uitsluiten: ['pclijten@gmail.com'], nuMs: NU });

const per = Object.fromEntries(r.lijst.map(x => [x.uid, x]));
assert.deepEqual(Object.keys(per).sort(), ['leeg', 'soloA', 'soloB', 'wacht'], 'alleen accounts zonder club, eindbaas uitgesloten');
assert.equal(per.soloA.status, 'eigen-team');
assert.equal(per.soloA.teamNaam, 'O9-1');
assert.equal(per.soloA.teams[0].spelers, 11, 'alleen een telling, geen namen');
assert.equal(per.wacht.status, 'wacht-op-club');
assert.equal(per.leeg.status, 'nog-geen-team');
assert.equal(per.leeg.naam, 'd', 'zonder naam: eerste deel van het e-mailadres');
assert.equal(per.soloA.nieuw, true);
assert.equal(per.soloB.nieuw, false, 'ouder dan 7 dagen is niet nieuw');
assert.equal(r.totaal, 4);
assert.equal(r.nieuw7, 2);
assert.equal(r.eigenTeam, 2);
assert.equal(r.wachtOpClub, 1);
assert.equal(r.nogGeenTeam, 1);
assert.deepEqual(r.lijst.map(x => x.uid), ['leeg', 'soloA', 'wacht', 'soloB'], 'nieuwste aanmelding eerst');

/* een team zonder club van iemand die later in een club komt telt niet meer als individueel */
const r2 = bepaal({ gebruikers: [{ uid: 'x', email: 'x@m.nl', aangemeld: dag(3) }], teams: [{ id: 't', naam: 'A', leden: { x: true } }],
  clubs: [{ id: 'c', leden: { x: true } }], nuMs: NU });
assert.equal(r2.totaal, 0);

/* begrenzing */
const veel = Array.from({ length: 5 }, (_, i) => ({ uid: 'u' + i, email: `u${i}@m.nl`, aangemeld: dag(i) }));
const r3 = bepaal({ gebruikers: veel, nuMs: NU, max: 3 });
assert.equal(r3.lijst.length, 3); assert.equal(r3.totaal, 5); assert.equal(r3.afgekapt, true);
/* geen gegevens → leeg */
assert.equal(bepaal({ nuMs: NU }).totaal, 0);
console.log('individuele-coaches: alles groen');
