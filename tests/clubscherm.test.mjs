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

/* stand tijdens de wedstrijd en doelpunten op de tv */
const kw = (b1, r1, b2 = 0, r2 = false) => ({ 1: { klok: { base: b1, running: r1 } }, 2: { klok: { base: b2, running: r2 } } });
const g = (...t) => t.map(type => ({ type, pid: 'geheim' }));
ok(JSON.stringify(C.standVan({ thuis: true })) === JSON.stringify({ stand: '', eind: false, bezig: false }), 'nog niet begonnen: geen stand');
ok(C.standVan({ thuis: true, goals: [], kwarten: kw(120, true) }).stand === '0 - 0' && C.standVan({ thuis: true, kwarten: kw(120, true) }).bezig === true, 'klok loopt: 0 - 0 en bezig');
ok(C.standVan({ thuis: true, goals: g('voor', 'voor', 'tegen'), kwarten: kw(1500, false, 300, true) }).stand === '2 - 1', 'thuis: voor - tegen');
ok(C.standVan({ thuis: false, goals: g('voor', 'voor', 'tegen'), kwarten: kw(1500, false, 300, true) }).stand === '1 - 2', 'uit: stand blijft thuis - uit');
const af = C.standVan({ thuis: true, goals: g('voor'), kwarten: kw(1500, false, 1500, false) });
ok(af.eind === true && af.bezig === false && af.stand === '1 - 0', 'laatste periode gespeeld en klok stil: afgelopen');
ok(C.standVan({ thuis: true, goals: g('voor'), uitslag: '3-1' }).stand === '3 - 1', 'de uitslag uit Sportlink gaat voor');
for (const w of [{ thuis: true, goals: g('voor', 'tegen'), kwarten: kw(100, true) }, { thuis: false, uitslag: '0-2' }, {}])
  ok(JSON.stringify(F.standVan(w)) === JSON.stringify(C.standVan(w)), 'de Cloud Function rekent de stand hetzelfde uit');
const live = C.programmaRij({ naam: 'JO11-1' }, { datum: '2026-11-28', aftrap: '10:30', tegenstander: 'Minor', thuis: true, goals: g('voor'), kwarten: kw(600, true) });
ok(live.stand === '1 - 0' && live.bezig === true && live.eind === false && !JSON.stringify(live).includes('geheim'), 'regel met tussenstand, zonder spelers');
ok(C.rijStatus(live, 640) === 'live' && C.rijStatus({ ...live, eind: true, bezig: false }, 700) === 'klaar' && C.rijStatus({ tijd: '12:00', afgelast: true }, 0) === 'af', 'status live, klaar, afgelast');
ok(C.rijStatus({ tijd: '12:00', thuis: true }, 600) === 'straks' && C.rijStatus({ tijd: '12:00', thuis: true }, 730) === 'live' && C.rijStatus({ tijd: '12:00', thuis: false }, 730) === 'voorbij', 'zonder gegevens: thuis op tijd, uit onbekend');
ok(C.rijStatus({ tijd: '09:00', stand: '2 - 2' }, 600) === 'klaar', 'oude regel met stand is afgelopen');

const thuisRij = { tijd: '10:30', a: 'JO11-1', b: 'Minor', thuis: true, veld: 'Veld 1', stand: '', eind: false }, uitRij = { tijd: '11:00', a: 'Hulsberg', b: 'JO13-1', thuis: false, stand: '0 - 0', eind: false };
const gezien = new Map();
ok(C.nieuweGoals(gezien, [{ ...thuisRij, stand: '1 - 0' }, uitRij], 'alle').length === 0, 'eerste keer zien: geen melding');
let gl = C.nieuweGoals(gezien, [{ ...thuisRij, stand: '2 - 0' }, { ...uitRij, stand: '0 - 1' }], 'park');
ok(gl.length === 1 && gl[0].team === 'JO11-1' && gl[0].eigen === true && gl[0].stand === '2–0' && gl[0].veld === 'Veld 1', 'park: alleen de goal op het eigen sportpark');
gl = C.nieuweGoals(gezien, [{ ...thuisRij, stand: '2 - 1' }, { ...uitRij, stand: '0 - 2' }], 'alle');
ok(gl.length === 2 && gl[0].eigen === false && gl[0].team === 'Minor' && gl[1].eigen === true && gl[1].team === 'JO13-1', 'alle: ook uit, en wie scoorde');
ok(C.nieuweGoals(gezien, [{ ...thuisRij, stand: '3 - 1' }], 'uit').length === 0, 'melding uit');
ok(C.nieuweGoals(gezien, [{ ...thuisRij, stand: '2 - 1' }], 'alle').length === 0 && C.nieuweGoals(gezien, [{ ...thuisRij, stand: '2 - 1' }], 'alle').length === 0, 'correctie naar beneden en geen verandering: geen melding');
const g2 = new Map(); C.nieuweGoals(g2, [thuisRij], 'alle');
ok(C.nieuweGoals(g2, [{ ...thuisRij, stand: '1 - 0', eind: true }], 'alle').length === 0, 'uitslag achteraf: geen melding');
const g3 = new Map(); C.nieuweGoals(g3, [thuisRij], 'alle');
ok(C.nieuweGoals(g3, [{ ...thuisRij, stand: '1 - 0' }], 'alle').length === 1, 'eerste doelpunt van een wedstrijd die al op het scherm stond');
ok(C.goalKeuze('x') === 'park' && C.tvKopie({ sjabloon: 'kubus', goals: 'alle' }).sjabloon === 'kubus' && C.tvKopie({ sjabloon: '<x>' }).sjabloon === 'bord' && C.tvKopie({}).goals === 'park', 'sjabloon en goal-keuze in de openbare kop');
ok(F.regelAnders({ datum: F.vandaagNL(), goals: [] }, { datum: F.vandaagNL(), goals: g('voor') }, F.vandaagNL()) === true && F.regelAnders({ datum: F.vandaagNL(), goals: g('voor'), selectie: [1] }, { datum: F.vandaagNL(), goals: g('voor'), selectie: [1, 2] }, F.vandaagNL()) === false && F.regelAnders({ datum: '2020-01-01' }, { datum: '2020-01-01', goals: g('voor') }, F.vandaagNL()) === false, 'functie: alleen bij een andere regel van vandaag');

// evenement (toernooi) op de kantine-tv
{
  const live = { open: true, naam: 'Pupillentoernooi', datum: '2026-11-28', duur: 12, wissel: 3, veldjes: [{ id: 'v1', naam: 'Veld A' }], poules: { p1: { naam: 'Poule A' } },
    teams: { t1: { naam: 'SV Cluppie' }, t2: { naam: 'RKSV Minor' } }, schema: [{ id: 'w2', a: 't2', b: 't1', v: 'v1', p: 'p1', t: '10:20' }, { id: 'w1', a: 't1', b: 't2', v: 'v1', p: 'p1', t: '10:00' }, { id: 'x', a: 't1', b: 't9', t: 'later' }],
    uitslag: { w1: { a: 2, b: 1 } }, mededelingen: [{ tekst: 'Prijsuitreiking om 16:00' }], schermen: [{ id: 's1', soort: 'sponsor', titel: 'Snackbar', tv: true }, { id: 's2', titel: 'Weg', tv: false }] };
  const e = C.evenementTv(live, '2026-11-28');
  ok(e && e.naam === 'Pupillentoernooi' && e.programma.length === 2 && e.programma[0].tijd === '10:00' && e.programma[0].stand === '2 - 1' && e.programma[0].eind === true && e.programma[1].veld === 'Veld A · Poule A', 'evenement: schema als programma, gesorteerd, met uitslag en veld');
  ok(e.mededeling === 'Prijsuitreiking om 16:00' && e.items.length === 1 && e.items[0].titel === 'Snackbar', 'evenement: mededeling en sponsoren van het toernooi');
  ok(C.evenementTv({ ...live, planB: 'Uitwijken naar de sporthal' }, '2026-11-28').mededeling === 'Uitwijken naar de sporthal', 'evenement: plan B gaat voor');
  ok(C.evenementTv(live, '2026-11-29') === null && C.evenementTv({ ...live, open: false }, '2026-11-28') === null && C.evenementTv(null, '2026-11-28') === null, 'evenement: alleen op de dag zelf en als de live pagina aan staat');
  ok(C.rijStatus(e.programma[1], 10 * 60 + 25) === 'live' && C.rijStatus(e.programma[1], 10 * 60 + 40) === 'voorbij' && C.rijStatus(e.programma[0], 10 * 60 + 5) === 'klaar', 'evenement: korte wedstrijden zijn na hun duur voorbij');
  ok(C.evenementId('abcdefghjk2345') === 'abcdefghjk2345' && C.evenementId('../x') === '' && C.tvKopie({ evenement: 'abcdefghjk2345' }).evenement === 'abcdefghjk2345' && C.tvKopie({}).evenement === '', 'evenement: id gecontroleerd in de tv-kopie');
}

/* doelpunten: minuut, maker, tijdlijn; achteraf telt niet */
{
  const w = { datum: '2026-11-28', thuis: true, kwartduur: 25, tegenstander: 'Minor', kwarten: kw(1500, false, 400, true),
    goals: [{ type: 'voor', pid: 'p1', assist: 'p2', kwart: 1, sec: 200 }, { type: 'tegen', kwart: 1, sec: 900 }, { type: 'voor', pid: 'p2', kwart: 2, sec: 130 }] };
  const namen = { p1: 'Daan de Vries', p2: 'Sem Jansen' };
  const d = C.doelpuntenVan(w, namen);
  ok(JSON.stringify(d) === JSON.stringify([{ m: 4, k: 'a', n: 'Daan', as: 'Sem' }, { m: 16, k: 'b' }, { m: 28, k: 'a', n: 'Sem' }]), 'doelpunten: minuut, kant en alleen de voornaam');
  ok(!JSON.stringify(C.doelpuntenVan(w)).includes('"n"') && C.doelpuntenVan({ ...w, thuis: false })[0].k === 'b', 'zonder namen geen naam; uit: eigen team is kant b');
  ok(JSON.stringify(F.doelpuntenVan(w, namen)) === JSON.stringify(d) && JSON.stringify(F.programmaRij({ naam: 'JO11-1' }, w, namen)) === JSON.stringify(C.programmaRij({ naam: 'JO11-1' }, w, namen)), 'de Cloud Function maakt dezelfde regel');
  const rij = C.programmaRij({ naam: 'JO11-1' }, w, namen);
  ok(rij.goals.length === 3 && rij.klok === true && C.programmaRij({ naam: 'JO11-1' }, { ...w, kwarten: {} }).klok === false && !('goals' in C.programmaRij({ naam: 'x' }, { datum: '2026-11-28' })), 'regel met doelpunten en of de klok liep');
  ok(C.tvKopie({ namen: true }).namen === true && C.tvKopie({ namen: 'ja' }).namen === false && C.tvKopie({}).namen === false, 'namen tonen staat uit tot de club het aanzet');
  const gz = new Map(), basis = { ...rij, tijd: '10:30', stand: '1 - 1', goals: rij.goals.slice(0, 2) };
  C.nieuweGoals(gz, [basis], 'alle');
  const [gl1] = C.nieuweGoals(gz, [{ ...rij, tijd: '10:30' }], 'alle');
  ok(gl1 && gl1.stand === '2–1' && gl1.oud === '1–1' && gl1.min === 28 && gl1.maker === 'Sem' && gl1.assist === '' && gl1.lijn.length === 3 && gl1.veld === '', 'melding met oude stand, minuut, maker en tijdlijn');
  const gz2 = new Map(); C.nieuweGoals(gz2, [basis], 'alle');
  ok(C.nieuweGoals(gz2, [{ ...rij, tijd: '10:30', eind: true, bezig: false }], 'alle').length === 0, 'doelpunt ingevoerd na het eindsignaal: geen melding');
  const gz3 = new Map(); C.nieuweGoals(gz3, [basis], 'alle');
  ok(C.nieuweGoals(gz3, [{ ...rij, tijd: '10:30', klok: false }], 'alle').length === 0, 'wedstrijd zonder klok bijgehouden: geen melding');
  const gz4 = new Map(); C.nieuweGoals(gz4, [basis], 'alle');
  ok(C.nieuweGoals(gz4, [{ ...rij, tijd: '10:30', goals: rij.goals.slice(0, 1) }], 'alle')[0].lijn.length === 0, 'tijdlijn alleen als elk doelpunt erin staat');
}

console.log(mis ? `clubscherm: ${mis} van ${n} MIS` : `clubscherm: ${n} controles geslaagd`);
process.exit(mis ? 1 : 0);
