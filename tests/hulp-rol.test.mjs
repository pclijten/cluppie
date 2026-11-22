// Hulp per rol: startvragen in de hulpchat, het hoofdstuk "Jouw rol" in de handleiding, de rolregel voor de
// hulpchat op de server, en de deelknop en clubherkenning voor een trainer zonder club.
// Draaien: node tests/hulp-rol.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ROL_NAMEN, ROL_VOLGORDE, ROL_UITLEG, START_VRAGEN, schoonRollen, startVragen, uitlegVoor, zoekTekst } from '../public/js/hulp-rol.js';
import { deelTekstClub, toonDeelClub, magClubHerkennen, DEEL_URL, HERKEN_DAGEN } from '../public/js/snelstart-logica.js';
const require = createRequire(import.meta.url);
const K = require('../functions/kennis.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

/* rollen opschonen en ordenen */
assert.deepEqual(schoonRollen(['coach', 'onzin', 'admin', 'coach']), ['admin', 'coach']); n++;
assert.deepEqual(schoonRollen(null), []); n++;
ok(ROL_VOLGORDE.every(r => ROL_NAMEN[r]), 'elke rol heeft een naam');

/* startvragen */
ok(ROL_VOLGORDE.every(r => Array.isArray(START_VRAGEN[r]) && START_VRAGEN[r].length >= 3 && START_VRAGEN[r].length <= 4), 'drie of vier startvragen per rol');
ok(Object.values(START_VRAGEN).flat().every(v => v.length <= 48 && v.endsWith('?')), 'korte vragen die op een vraagteken eindigen');
assert.equal(startVragen(['admin', 'coach'], { inTeam: false }), START_VRAGEN.admin); n++;
assert.equal(startVragen(['admin', 'coach'], { inTeam: true }), START_VRAGEN.coach, 'in een team stel je vragen als coach'); n++;
assert.equal(startVragen(['solo'], { inTeam: true }), START_VRAGEN.solo); n++;
assert.equal(startVragen(['bouw', 'trainco']), START_VRAGEN.bouw, 'de rol die het meest stuurt gaat voor'); n++;
assert.equal(startVragen(['eigenbouw']), START_VRAGEN.bouw); n++;
assert.equal(startVragen([]), START_VRAGEN.coach, 'zonder rol: de vragen van een coach'); n++;

/* handleiding: elke sturende rol en de trainer zonder club heeft uitleg */
for (const r of ['admin', 'hjo', 'bouw', 'eigenbouw', 'trainco', 'solo']) ok(ROL_UITLEG.some(u => u.voor.includes(r)), 'uitleg voor ' + r);
ok(ROL_UITLEG.every(u => u.titel && u.intro && u.niet && u.punten.length >= 3 && u.punten.every(p => p.length === 2 && p[0] && p[1])), 'elke uitleg is compleet');
const v = uitlegVoor(['coach', 'bouw']);
ok(v.length === ROL_UITLEG.length && v[0].id === 'bouw' && v[0].eigen === true && v.slice(1).every(u => !u.eigen), 'eigen rol bovenaan en gemarkeerd, de rest blijft staan');
ok(uitlegVoor([]).every(u => !u.eigen), 'zonder rol niets gemarkeerd');
ok(uitlegVoor(['admin', 'hjo']).filter(u => u.eigen).length === 2, 'twee rollen: twee gemarkeerd');
const z = zoekTekst(ROL_UITLEG[0]);
ok(z === z.toLowerCase() && !z.includes('"') && z.includes('sportlink') && z.includes('bewaartermijnen'), 'zoektekst in kleine letters, zonder aanhalingstekens');
/* geen gedachtestreepjes in tekst die de gebruiker leest (huisregel) */
ok(!/[—–]/.test(JSON.stringify(ROL_UITLEG) + JSON.stringify(START_VRAGEN)), 'geen gedachtestreepjes');

/* server: de regel met de rol van de vrager */
ok(/trainer zonder club/.test(K.rolRegel(['admin'], { solo: true })) && !/clubbeheerder,/.test(K.rolRegel(['admin'], { solo: true }).split('.')[0]), 'solo: altijd trainer zonder club, wat de app ook stuurt');
ok(!/clubbeheerder\./.test(K.rolRegel(['admin', 'coach'], { rol: 'coach' }).split(' Geef')[0]), 'admin van de app telt niet als de server het niet zegt');
ok(/DE VRAGER: clubbeheerder, hoofd jeugdopleiding\./.test(K.rolRegel(['hjo'], { rol: 'club_admin' })), 'admin komt van de server, de rest van de app');
ok(/DE VRAGER: coach van een team\./.test(K.rolRegel(undefined, { rol: 'coach' })) && /coach van een team/.test(K.rolRegel(['<script>', 'solo'], {})), 'onbekend of leeg: coach');
ok(K.rolRegel(['bouw', 'bouw', 'trainco', 'hjo', 'eigenbouw', 'coach'], {}).split('.')[0].split(',').length === 4, 'hooguit vier rollen');
for (const woord of ['clubbeheerder de club inrichten', 'hoofd jeugdopleiding:', 'bouwcoördinator en coach gekoppeld', 'trainingscoördinator:', 'trainer zonder club, club erbij halen', 'jaaroverzicht:', 'bewaartermijnen en opruimen'])
  ok(K.KENNIS_TEKST.includes(woord), 'kennisbank kent: ' + woord);
/* elke startvraag moet uit de kennisbank te beantwoorden zijn: het kernwoord staat erin */
for (const woord of ['teams uit sportlink', 'coach uitnodigen', 'club › mensen', 'seizoensplan', 'speelwijze', 'evaluatieronde', 'uitleningen', 'weekrooster', 'vraag aan'])
  ok(K.KENNIS_TEKST.includes(woord), 'kennisbank dekt de startvraag over: ' + woord);

/* deelknop voor de jeugdcoördinator */
const tekst = deelTekstClub();
ok(tekst.endsWith(DEEL_URL) && tekst.length < 500 && !/[—–]/.test(tekst) && !/\[naam\]/.test(tekst), 'deeltekst: kort, met de link, zonder invulplek');
const twee = { gedaan: 2 }, een = { gedaan: 1 };
ok(toonDeelClub({ leden: {} }, { status: twee }) === true, 'na twee eerste stappen');
ok(toonDeelClub({ leden: {} }, { status: een }) === false && toonDeelClub({ leden: {} }, {}) === false, 'niet te vroeg');
ok(toonDeelClub({ club: 'c1' }, { status: twee }) === false, 'niet bij een clubteam');
ok(toonDeelClub({ koppelVoorstel: { clubId: 'c1', status: 'open' } }, { status: twee }) === false, 'niet als de club al herkend is');
ok(toonDeelClub({}, { status: twee, verborgen: true }) === false && toonDeelClub(null, { status: twee }) === false, 'niet na Niet nu');

/* club herkennen: wanneer vraagt de app het */
const los = { eigenClub: { naam: 'VV Dorp', plaats: 'Dorp' } }, nu = Date.UTC(2026, 10, 22);
ok(magClubHerkennen(los, { nu }) === true, 'los team met club: vragen');
ok(magClubHerkennen({ ...los, club: 'c1' }, { nu }) === false && magClubHerkennen({}, { nu }) === false && magClubHerkennen(null, { nu }) === false, 'niet bij een clubteam of zonder ingevulde club');
ok(magClubHerkennen({ ...los, koppelVoorstel: { status: 'geweigerd' } }, { nu }) === false, 'niet als er al een voorstel is, ook een geweigerd');
ok(magClubHerkennen(los, { nu, laatstMs: nu - 86400000 }) === false, 'niet vaker dan eens per week');
ok(magClubHerkennen(los, { nu, laatstMs: nu - (HERKEN_DAGEN + 1) * 86400000 }) === true, 'na een week weer');

console.log(`hulp-rol: ${n} controles geslaagd`);
