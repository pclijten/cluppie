// Kantine-tv en sponsoren: het programma van vandaag, sponsoren per seizoen, en wat openbaar mag.
// Draaien: node tests/clubscherm.test.mjs   (eerst één keer: cd functions && npm install)
import { createRequire } from 'node:module';
import * as C from '../public/js/clubscherm-logica.js';
const require = createRequire(import.meta.url);
process.env.GCLOUD_PROJECT ||= 'cluppie-test'; process.env.FIREBASE_CONFIG ||= '{}';
const F = require('../functions/kantine-tv.js');
let n = 0, mis = 0;
const ok = (v, wat) => { n++; if (!v){ mis++; console.log('MIS: ' + wat); } };

const teams = [{ id: 't1', naam: 'JO11-1' }, { id: 't2', naam: 'JO13-2' }, { id: 't3', naam: 'MO15-1' }];
const perTeam = {
  t1: [{ datum: '2026-11-28', aftrap: '9:00', tegenstander: 'SV Venray JO11-2', thuis: true, info: { veld: 'Veld 2', kleedkamer: '3' } },
       { datum: '2026-11-29', aftrap: '10:00', tegenstander: 'Morgen FC', thuis: true }],
  t2: [{ datum: '2026-11-28', aftrap: '08:30', tegenstander: 'RKSV Minor JO13-1', thuis: false, resultaat: 'w', doelBin: 3, doelTegen: 1 }],
  t3: [{ datum: '2026-11-28', aftrap: '11:15', tegenstander: 'VV Hulsberg MO15-1', thuis: true, status: 'afgelast', uitslag: '2-2' }, { datum: 'fout' }],
};
const p = C.bouwProgramma(teams, perTeam, '2026-11-28');
ok(p.length === 3 && p[0].tijd === '08:30' && p[1].tijd === '09:00' && p[2].tijd === '11:15', 'alleen vandaag, op tijd');
ok(p[1].a === 'JO11-1' && p[1].b === 'SV Venray JO11-2' && p[1].veld === 'Veld 2' && p[1].kk === '3' && p[1].thuis === true && !('datum' in p[1]), 'thuiswedstrijd met veld en kleedkamer');
ok(p[0].a === 'RKSV Minor JO13-1' && p[0].b === 'JO13-2' && p[0].stand === '1 - 3' && p[0].thuis === false, 'uitwedstrijd: stand thuis - uit');
ok(p[2].afgelast === true && p[2].stand === '2 - 2', 'afgelast en uitslag uit Sportlink');
ok(JSON.stringify(F.bouwProgramma(teams, perTeam, '2026-11-28')) === JSON.stringify(p), 'de Cloud Function bouwt hetzelfde programma');
ok(/^\d{4}-\d{2}-\d{2}$/.test(F.vandaagNL()) && F.vandaagNL(new Date('2026-11-28T23:30:00Z')) === '2026-11-29', 'vandaag in Nederlandse tijd');
ok(C.bouwProgramma(teams, {}, '2026-11-28').length === 0, 'geen wedstrijden');

/* sponsoren */
const png = 'data:image/png;base64,iVBORw0KGgo=';
const s1 = C.schoonItem({ soort: 'sponsor', titel: ' Bakkerij  Jansen ', pakket: 'hoofd', bedrag: '750', tot: '2027-06-30', link: 'bakkerjansen.nl', img: png, notitie: 'contract bij penningmeester' });
ok(s1.titel === 'Bakkerij Jansen' && s1.pakket === 'hoofd' && s1.bedrag === 750 && s1.link === 'https://bakkerjansen.nl' && s1.img === png && s1.tv === true, 'sponsor opgeschoond');
ok(C.schoonItem({ soort: 'scherm', titel: 'Menu', bedrag: 50, pakket: 'hoofd' }).bedrag === 0 && C.schoonItem({ soort: 'scherm', pakket: 'hoofd' }).pakket === '' && C.schoonItem({ pakket: 'x' }).pakket === 'sponsor', 'eigen scherm heeft geen pakket of bedrag');
ok(C.verlopen(s1, '2027-07-01') && !C.verlopen(s1, '2027-06-30') && C.bijnaVerlopen(s1, '2027-05-15') && !C.bijnaVerlopen(s1, '2026-11-25'), 'verlopen en bijna verlopen');
const o = C.openbaarItem({ ...s1 }, '2026-11-25');
ok(o && !('bedrag' in o) && !('notitie' in o) && !('tot' in o) && o.pakket === 'hoofd', 'openbaar zonder bedrag, notitie en einddatum');
ok(C.openbaarItem(s1, '2027-07-01') === null && C.openbaarItem({ ...s1, tv: false }, '2026-11-25') === null && C.openbaarItem({ soort: 'scherm' }, '2026-11-25') === null, 'verlopen, uit of leeg komt niet op tv');
const lijst = [s1, { soort: 'sponsor', titel: 'Garage', pakket: 'vriend', bedrag: 100 }, { soort: 'sponsor', titel: 'Oud', bedrag: 300, tot: '2026-06-30' }, { soort: 'scherm', titel: 'Menu' }];
const tot = C.sponsorTotaal(lijst, '2026-11-25');
ok(tot.n === 3 && tot.actief === 2 && tot.bedrag === 850 && tot.verlopen === 1, 'totaal sponsoren');
ok(C.sorteer(lijst.map(C.schoonItem))[0].titel === 'Bakkerij Jansen' && C.sorteer(lijst.map(C.schoonItem)).slice(-1)[0].soort === 'scherm', 'hoofdsponsor eerst, eigen schermen achteraan');
const csv = C.csvSponsoren(lijst, '2026-11-25');
ok(csv.includes('Bakkerij Jansen;Hoofdsponsor;750;2027-06-30;actief') && csv.includes('Oud;Sponsor;300;2026-06-30;verlopen') && !csv.includes('Menu'), 'csv sponsoren');
const k = C.tvKopie({ clubNaam: 'SV Demo', logo: 'http://x', kleur: '#0055aa', mededeling: ' Welkom ', datum: '2026-11-28', programma: p });
ok(k.logo === '' && k.kleur === '#0055aa' && k.mededeling === 'Welkom' && k.programma.length === 3 && k.uit === true, 'openbare kop van de tv');

console.log(mis ? `clubscherm: ${mis} van ${n} MIS` : `clubscherm: ${n} controles geslaagd`);
process.exit(mis ? 1 : 0);
