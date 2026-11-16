// Teamkamer: wat ouders en spelers zien (kopie), toegang, polls en de browserlogica.
// Draaien: node --no-warnings tests/teamkamer.test.mjs
// De Firestore-regels zelf test tests/rules.test.mjs in de emulator (npm run test:rules).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Module = require('module'), fake = require('./fake-firestore.js'), orig = Module._load;
class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } }
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError };
  if (r === 'firebase-functions/v2/firestore') return { onDocumentWritten: (o, f) => f, onDocumentCreated: (o, f) => f };
  if (r === 'firebase-functions/v2/scheduler') return { onSchedule: (o, f) => f };
  if (r === 'firebase-functions/logger') return { warn(){}, info(){}, error(){} };
  if (r === 'firebase-functions/params') return { defineSecret: () => ({ value: () => '' }), defineString: () => ({ value: () => '' }) };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp };
  if (r === 'firebase-admin') return { firestore: { Timestamp: fake.Timestamp }, auth: () => ({ deleteUser: async () => {} }), apps: [1], initializeApp(){} };
  return orig.call(this, r, ...a);
};
const L = require('../functions/teamkamer-logica.js');
const T = require('../functions/teamkamer.js'), F = T.functies;
const K = await import('../public/js/kamer-logica.js');
const { store } = fake;
let n = 0; const ok = (c, m) => { n++; assert.ok(c, m); };
const gooit = async (f, code, m) => { n++; try { await f(); } catch (e){ return assert.equal(e.code, code, m); } assert.fail(m + ' (geen fout)'); };
const req = (uid, data, o = {}) => ({ auth: uid ? { uid, token: { email: o.email || uid + '@voorbeeld.test', email_verified: o.verified !== false, firebase: { sign_in_provider: o.anoniem ? 'anonymous' : 'password' } } } : null, data, rawRequest: { headers: { 'x-forwarded-for': o.ip || '10.0.0.' + Math.floor(Math.random() * 250) } } });
const event = (pad, voor, na, params) => ({ params, data: { before: { data: () => voor }, after: { data: () => na, ref: fake.db.doc(pad) } } });

/* ==================== 1. pure serverlogica ==================== */
const VANDAAG = '2026-11-16';                          // een maandag
ok(L.weekdag('2026-11-16') === 1 && L.weekdag('2026-11-22') === 7, 'weekdagen');
ok(L.plusDagen('2026-12-28', 7) === '2027-01-04', 'over de jaargrens');
ok(new Date(L.seizoenEindeMs('2026-11-16')).toISOString().startsWith('2027-06-30'), 'toegang loopt tot 30 juni');
ok(new Date(L.seizoenEindeMs('2027-06-10')).toISOString().startsWith('2028-06-30'), 'wie in juni instapt krijgt het nieuwe seizoen');
ok(L.inst({}).aan === false && L.inst({ teamkamer: { aan: true } }).namen === true && L.inst({ teamkamer: { aan: true } }).uitslag === false, 'standaard: uit, namen aan, uitslag uit');
ok(L.inst({ teamkamer: { lijn: ['', '  '] } }).lijn.length === 3, 'lege afspraken geven de standaardtekst');
ok(!L.toegestaan({ club: 'c1' }, { platformModules: {} }, null) && L.toegestaan({ club: 'c1' }, { platformModules: { teamkamer: true } }, null), 'club: alleen als de eindbaas het aanzet');
ok(!L.toegestaan({}, null, {}) && L.toegestaan({}, null, { teamkamerLos: true }), 'zonder club: alleen met de platformschakelaar');

const spelers = [
  { id: 'p1', naam: 'Pim de Vries', achternaam: 'de Vries', nummer: 7, geboortedatum: '2015-03-02', notitie: 'let op knie', leerpunten: ['kappen'] },
  { id: 'p2', naam: 'Sem', nummer: 13 }, { id: 'p3', naam: 'Noor Jansen', nummer: '' }, { id: 'p4', naam: 'Oud', gearchiveerd: true },
];
const team = { naam: 'O11-1', club: 'c1', leden: { coach: true }, ledenInfo: { coach: { naam: 'Mark Bakker' } },
  teamkamer: { aan: true, uitslag: false }, trainingsmomenten: [{ dag: 2, start: '18:00', eind: '19:00' }, { dag: 4, start: '18:00', eind: '19:00' }],
  vasteAfmeldingen: [{ id: 'r1', spelerId: 'p2', dag: 2, van: '2026-11-17', tot: '2026-12-15', reden: 'school', notitie: 'bijles' }] };
const club = { naam: 'SV Voorbeeld', platformModules: { teamkamer: true, teamkamerOpties: L.ALLES_AAN }, instellingen: { locatie: { plaats: 'Dorp', lat: 51.5, lon: 5.6 } } };
const kd = L.kamerDoc(team, club, spelers, { p2: true });
ok(kd.spelers.p1.n === 'Pim' && kd.spelers.p1.nr === 7, 'alleen voornaam en rugnummer');
ok(kd.spelers.p2.v === true && !kd.spelers.p2.n, 'verborgen speler: geen naam en geen nummer');
ok(kd.spelers.p3.nr === null && !kd.spelers.p4, 'leeg nummer is geen 0; gearchiveerd doet niet mee');
ok(kd.aantal === 3 && kd.plek.lat === 51.5, 'aantal spelers en plek van de club');
const kdTekst = JSON.stringify(kd);
for (const geheim of ['de Vries', 'Jansen', '2015', 'knie', 'kappen', 'Bakker', 'leden']) ok(!kdTekst.includes(geheim), 'niet in de kopie: ' + geheim);
ok(Object.keys(L.kamerDoc({ ...team, teamkamer: { aan: true, namen: false } }, club, spelers, {}).spelers).every(k => kd.spelers[k] && true), 'namen uit: nog steeds alle spelers, maar…');
ok(Object.values(L.kamerDoc({ ...team, teamkamer: { aan: true, namen: false } }, club, spelers, {}).spelers).every(p => p.v === true), '…allemaal zonder naam');

const w = { type: 'normaal', tegenstander: 'VV Elders O11-2', thuis: false, datum: '2026-11-21', aftrap: '09:30', selectie: ['p1'],
  afwezigRedenen: { p2: { reden: 'ziek', notitie: 'griep' }, p1: { reden: 'vakantie' } }, telaat: ['p1'], doel: 'hoog druk zetten', voorbereiding: { punten: ['geheim plan'] },
  info: { accommodatie: 'Sportpark De Elders', veld: 'veld 2', verzamel: '08:15', vertrek: '08:30', adres: 'Dorpsstraat 1', plaatsAdres: 'Elders', telefoon: '0612345678', route: 'https://www.google.com/maps/dir/?api=1&destination=x' },
  goals: [{ type: 'voor', speler: 'p1', minuut: 3 }, { type: 'tegen' }], kwarten: { 1: { lineup: { K: 'p1' }, klok: { running: true, base: 10 } } }, beoordelingen: { p1: 4 } };
const pw = L.projectWedstrijd(w, { uitslag: false, live: false }, VANDAAG);
ok(pw.afwezig.length === 1 && pw.afwezig[0] === 'p2', 'afwezig: alleen wie een afmelding heeft en niet in de selectie staat');
ok(pw.verzamel === '08:15' && pw.plek === 'Sportpark De Elders' && pw.route.startsWith('https://www.google.com/maps/'), 'tijden, plek en route');
ok(pw.stand === undefined && pw.opstelling === undefined, 'geen stand en geen opstelling zonder dat de coach het aanzet');
const pwTekst = JSON.stringify(pw);
for (const geheim of ['ziek', 'griep', 'vakantie', '0612345678', 'geheim plan', 'druk zetten', 'beoordelingen', 'minuut', 'telaat', 'speler']) ok(!pwTekst.includes(geheim), 'niet in de agenda: ' + geheim);
assert.deepEqual(Object.keys(pw).sort(), ['adres', 'afgelast', 'afwezig', 'datum', 'erbij', 'plaats', 'plek', 'route', 'soort', 'tegenstander', 'thuis', 'tijd', 'veld', 'vertrek', 'verzamel'], 'vaste lijst van velden'); n++;
ok(L.projectWedstrijd({ ...w, info: { ...w.info, route: 'javascript:alert(1)' } }, {}, VANDAAG).route === '', 'alleen een Google Maps-route');
ok(L.projectWedstrijd(w, { live: true }, '2026-11-21').stand.voor === 1 && L.projectWedstrijd(w, { live: true }, '2026-11-21').stand.bezig === true, 'live stand op de wedstrijddag');
ok(L.projectWedstrijd(w, { live: true }, VANDAAG).stand === undefined, 'geen live stand op een andere dag');
ok(L.projectWedstrijd(w, { uitslag: true }, '2026-11-21').stand === undefined && L.projectWedstrijd(w, { uitslag: true }, '2026-11-22').stand.tegen === 1, 'uitslag pas een dag later');
ok(Object.keys(L.projectWedstrijd(w, { live: true }, '2026-11-21').stand).sort().join() === 'bezig,tegen,voor', 'stand zonder namen van scorers');
ok(L.projectWedstrijd({ ...w, deelOpstelling: true }, {}, VANDAAG).opstelling === undefined, 'opstelling delen staat uit bij de eindbaas: geen opstelling, ook als de coach hem deelt');
const pwo = L.projectWedstrijd({ ...w, selectie: ['p1', 'p3'], deelOpstelling: true }, { opstelling: true }, VANDAAG);
ok(pwo.opstelling.basis.join() === 'p1' && pwo.opstelling.wissels.join() === 'p3', 'opstelling alleen als de coach hem deelt');
ok(L.projectWedstrijd({ ...w, datum: '2026-10-01' }, {}, VANDAAG) === null && L.projectWedstrijd({ datum: 5 }, {}, VANDAAG) === null && L.projectWedstrijd(undefined, {}, VANDAAG) === null, 'oud, kapot of weg: geen agenda-item');
ok(L.projectWedstrijd({ ...w, status: 'afgelast' }, { uitslag: true }, '2026-11-22').afgelast === true, 'afgelast');

/* eindbaas: elke mogelijkheid apart, standaard alles uit */
const uit = L.opties({ club: 'c1' }, { platformModules: { teamkamer: true } }, null);
ok(L.OPTIES.length === 13 && L.OPTIES.every(k => uit[k] === false), 'eindbaas: zonder keuze staat elke mogelijkheid uit');
ok(L.opties({ club: 'c1' }, { platformModules: { teamkamerOpties: { polls: true, onzin: true, live: 'ja' } } }, null).polls === true && L.opties({ club: 'c1' }, { platformModules: { teamkamerOpties: { live: 'ja' } } }, null).live === false, 'alleen echte true telt, onbekende sleutels vallen weg');
ok(L.opties({}, null, { teamkamerLosOpties: { polls: true } }).polls === true && L.opties({}, { platformModules: { teamkamerOpties: { polls: true } } }, null).polls === false, 'trainer zonder club: eigen schakelaars');
const coachAllesAan = { ...team, teamkamer: { aan: true, uitslag: true, live: true, thuis: { vormId: 'x', naam: 'X' }, lijn: ['Eigen regel'] } };
const kaal = L.kamerDoc(coachAllesAan, { naam: 'SV Voorbeeld', platformModules: { teamkamer: true }, instellingen: club.instellingen }, spelers, {}, null);
ok(Object.values(kaal.mag).every(v => v === false) && Object.values(kaal.spelers).every(p => p.v === true), 'alles uit: geen enkele naam in de kopie');
ok(kaal.uitslag === false && kaal.live === false && kaal.thuis === null && kaal.lijn.length === 0 && kaal.plek === null, 'alles uit: de keuzes van de coach tellen niet (uitslag, live, thuis, afspraken, weer)');
ok(!JSON.stringify(kaal).includes('Pim') && kaal.aantal === 3, 'alles uit: alleen aantallen');
const deels = L.kamerDoc(coachAllesAan, { naam: 'x', platformModules: { teamkamer: true, teamkamerOpties: { live: true, namen: true } } }, spelers, {}, null);
ok(deels.live === true && deels.uitslag === false && deels.spelers.p1.n === 'Pim' && deels.mag.polls === false, 'alleen wat de eindbaas aanzet werkt');

const tr = L.projectTrainingen(team, { '2026-11-19': ['p3'] }, VANDAAG, 14);
assert.deepEqual(Object.keys(tr), ['t_2026-11-17', 't_2026-11-19', 't_2026-11-24', 't_2026-11-26']); n++;
ok(tr['t_2026-11-17'].afwezig.join() === 'p2' && tr['t_2026-11-17'].tijd === '18:00', 'vaste afmelding op dinsdag');
ok(tr['t_2026-11-19'].afwezig.join() === 'p3', 'vastgelegde presentie gaat voor');
ok(!JSON.stringify(tr).includes('school') && !JSON.stringify(tr).includes('bijles'), 'geen reden of notitie van een vaste afmelding');
ok(Object.keys(L.projectTrainingen({ trainingsdagen: [1] }, {}, VANDAAG, 7)).length === 2, 'team met alleen trainingsdagen');

const poll = { vraag: 'Wie rijdt?', soort: 'rijden', namen: true, meer: false, opties: [{ id: 'o1', tekst: 'Wij rijden' }, { id: 'o2', tekst: 'Deze keer niet' }] };
ok(L.pollGeldig(poll) && !L.pollGeldig({ ...poll, opties: [poll.opties[0]] }) && !L.pollGeldig({ ...poll, opties: [poll.opties[0], poll.opties[0]] }), 'poll: minstens twee verschillende antwoorden');
ok(L.stemGeldig(poll, ['o1']) && !L.stemGeldig(poll, ['o1', 'o2']) && !L.stemGeldig(poll, ['x']) && L.stemGeldig({ ...poll, meer: true }, ['o1', 'o2']), 'stem: één antwoord, tenzij meer mag');
const stemmen = [{ spelerId: 'p1', keuzes: ['o1'] }, { spelerId: 'p2', keuzes: ['o2'] }, { spelerId: 'p3', keuzes: [] }, { spelerId: 'px', keuzes: ['o1', 'o2'] }];
const tel = L.telStemmen(poll, stemmen);
ok(tel.telling.o1 === 1 && tel.telling.o2 === 1 && tel.gestemd === 2 && tel.wie.o1.join() === 'p1', 'tellen: lege en ongeldige stemmen tellen niet');
ok(L.telStemmen({ ...poll, namen: false }, stemmen).wie === null, 'namen uit: de poll bevat niet wie wat koos');
ok(L.beurtenVan(poll, stemmen).join() === 'p1' && L.beurtenVan({ ...poll, soort: 'vrij' }, stemmen).length === 0, 'beurt alleen bij rijden, wassen, fruit en vlaggen');
ok(L.schoonKind('  Pim <script>1</script> ') === 'Pim script/script'.replace('/', '') || !/[<>0-9]/.test(L.schoonKind('  Pim <script>1</script> ')), 'naam van het kind: geen tekens of cijfers');

/* ==================== 2. functies tegen een nep-database ==================== */
store.set('clubs/c1', { ...club, admins: { adm: true }, bouwCoordinatoren: {} });
store.set('clubs/c2', { naam: 'SV Elders', admins: { ander: true }, platformModules: {} });
store.set('teams/t1', structuredClone(team));
store.set('teams/t2', { naam: 'O9-1', club: 'c2', leden: { coach2: true }, teamkamer: { aan: true } });
spelers.forEach(p => { const { id, ...rest } = p; store.set(`teams/t1/spelers/${id}`, rest); });
/* de functies rekenen met de echte datum van vandaag: de wedstrijd in de nep-database ligt daarom 5 dagen vooruit */
const WD = { ...w, datum: L.plusDagen(L.vandaagNL(), 5) };
store.set('teams/t1/wedstrijden/w1', structuredClone(WD));
store.set('teams/t1/presentie/pr1', { datum: '2099-01-01', afwezig: ['p3'], afwezigRedenen: { p3: { reden: 'ziek' } } });

/* kopie bouwen */
const b1 = await T.bouwKamer(fake.db, 't1');
ok(b1.aan === true && store.get('teamkamer/t1').aan === true && store.get('teamkamer/t1').teamNaam === 'O11-1', 'kopie gebouwd');
ok(store.get('teamkamer/t1/gezin/p1').voornaam === 'Pim' && store.get('teamkamer/t1/gezin/p1').nr === 7 && !store.get('teamkamer/t1/gezin/p4'), 'gezinsdocument per actieve speler');
const kopie = [...store.entries()].filter(([p]) => p.startsWith('teamkamer/'));
for (const geheim of ['ziek', 'griep', 'de Vries', 'Jansen', 'knie', 'geheim plan', 'Bakker', '0612345678']) ok(!JSON.stringify(kopie).includes(geheim), 'nergens in de hele kopie: ' + geheim);
ok((await T.bouwKamer(fake.db, 't2')).aan === false && store.get('teamkamer/t2') === undefined, 'club zonder schakelaar: geen teamkamer');
store.get('teams/t1').teamkamer.aan = false;
await F.kamerTeam(event('teams/t1', { ...team, teamkamer: { aan: true } }, store.get('teams/t1'), { teamId: 't1' }));
ok(store.get('teamkamer/t1').aan === false, 'coach zet uit: de kopie gaat dicht');
store.get('teams/t1').teamkamer.aan = true;
await F.kamerTeam(event('teams/t1', { ...team, teamkamer: { aan: false } }, store.get('teams/t1'), { teamId: 't1' }));
ok(store.get('teamkamer/t1').aan === true, 'en weer aan');

/* wedstrijd-trigger: alleen bij een wijziging die ouders raakt */
const voorSchrijf = JSON.stringify(store.get('teamkamer/t1/agenda/w_w1'));
store.get('teams/t1/wedstrijden/w1').afwezigRedenen = { p2: { reden: 'ziek' }, p3: { reden: 'school' } };
await F.kamerWedstrijd(event('x', WD, store.get('teams/t1/wedstrijden/w1'), { teamId: 't1', wedstrijdId: 'w1' }));
ok(store.get('teamkamer/t1/agenda/w_w1').afwezig.join() === 'p2,p3' && voorSchrijf !== JSON.stringify(store.get('teamkamer/t1/agenda/w_w1')), 'afmelding door de coach komt in de agenda');
await F.kamerWedstrijd(event('x', store.get('teams/t1/wedstrijden/w1'), undefined, { teamId: 't1', wedstrijdId: 'w1' }));
ok(store.get('teamkamer/t1/agenda/w_w1') === undefined, 'wedstrijd verwijderd: uit de agenda');

/* teamlink en aanvraag */
await gooit(() => F.maakKamerLink(req('vreemd', { teamId: 't1' })), 'permission-denied', 'vreemde maakt geen link');
await gooit(() => F.maakKamerLink(req('ander', { teamId: 't1' })), 'permission-denied', 'beheerder van een andere club maakt geen link');
await gooit(() => F.maakKamerLink(req('coach2', { teamId: 't2' })), 'failed-precondition', 'geen link als de club de teamkamer niet heeft');

/* eindbaas zet mogelijkheden aan en uit: de kopie volgt, de functies weigeren wat uit staat */
store.set('clubs/c3', { naam: 'FC Kaal', admins: {}, platformModules: { teamkamer: true } });
store.set('teams/t3', { naam: 'O13-1', club: 'c3', leden: { coach3: true }, teamkamer: { aan: true, live: true } });
store.set('teams/t3/spelers/q1', { naam: 'Tess Bos', nummer: 4 });
await T.bouwKamer(fake.db, 't3');
ok(store.get('teamkamer/t3').aan === true && store.get('teamkamer/t3').mag.polls === false && store.get('teamkamer/t3').spelers.q1.v === true && store.get('teamkamer/t3').live === false, 'club met alleen de hoofdschakelaar: teamkamer open, alles uit');
store.set('teamkamer/t3/kamerleden/ouder3', { teamId: 't3', club: 'c3', uid: 'ouder3', rol: 'ouder', spelerIds: ['q1'], vervaltOp: fake.Timestamp.fromMillis(Date.now() + 1e9) });
await gooit(() => F.maakKindCode(req('ouder3', { teamId: 't3', spelerId: 'q1' })), 'failed-precondition', 'spelers staan uit: geen code voor het kind');
store.set('teamkamer/t3/polls/z1', { ...poll, status: 'gesloten' });
store.set('teamkamer/t3/polls/z1/stemmen/q1', { keuzes: ['o1'], door: 'ouder3', ms: 1 });
await F.kamerPoll(event('teamkamer/t3/polls/z1', { ...poll, status: 'open' }, store.get('teamkamer/t3/polls/z1'), { teamId: 't3', pollId: 'z1' }));
ok(!store.get('teamkamer/t3/gezin/q1').beurten && store.get('teamkamer/t3/polls/z1').beurtenGeteld !== true, 'beurtenteller uit: er wordt niets geteld');
const c3voor = structuredClone(store.get('clubs/c3'));
store.get('clubs/c3').platformModules.teamkamerOpties = { namen: true, live: true, spelers: true };
await F.kamerClub(event('clubs/c3', c3voor, store.get('clubs/c3'), { clubId: 'c3' }));
ok(store.get('teamkamer/t3').spelers.q1.n === 'Tess' && store.get('teamkamer/t3').live === true && store.get('teamkamer/t3').mag.spelers === true && store.get('teamkamer/t3').mag.polls === false, 'eindbaas zet iets aan: de teamkamers van de club volgen meteen');
ok((await F.maakKindCode(req('ouder3', { teamId: 't3', spelerId: 'q1' }))).code.length === 6, 'spelers aan: code kan nu wel');
const c3aan = structuredClone(store.get('clubs/c3'));
store.get('clubs/c3').platformModules.teamkamer = false;
await F.kamerClub(event('clubs/c3', c3aan, store.get('clubs/c3'), { clubId: 'c3' }));
ok(store.get('teamkamer/t3').aan === false, 'eindbaas zet de hoofdschakelaar uit: de teamkamer gaat dicht');
store.set('teams/los1', { naam: 'Buurtteam', leden: { losse: true }, teamkamer: { aan: true } });
ok((await T.bouwKamer(fake.db, 'los1')).aan === false, 'trainer zonder club: uit zolang de eindbaas het niet aanzet');
store.set('platform/instellingen', { teamkamerLos: true, teamkamerLosOpties: { polls: true } });
ok((await T.bouwKamer(fake.db, 'los1')).aan === true && store.get('teamkamer/los1').mag.polls === true && store.get('teamkamer/los1').mag.namen === false && store.get('teamkamer/los1').club === null, 'trainer zonder club: eigen schakelaars van de eindbaas');
store.set('platform/instellingen', { teamkamerLos: false });
await F.kamerPlatform(event('platform/instellingen', { teamkamerLos: true, teamkamerLosOpties: { polls: true } }, store.get('platform/instellingen'), { docId: 'instellingen' }));
ok(store.get('teamkamer/los1').aan === false, 'eindbaas zet losse trainers uit: hun teamkamers gaan dicht');
const { schoonPlatformInstellingen } = require('../functions/platform.js');
ok(schoonPlatformInstellingen && JSON.stringify(schoonPlatformInstellingen({ teamkamerLos: true, teamkamerLosOpties: { polls: true, hack: true } })) === JSON.stringify({ teamkamerLos: true, teamkamerLosOpties: Object.fromEntries(L.OPTIES.map(k => [k, k === 'polls'])) }), 'platforminstellingen: alleen bekende mogelijkheden, de rest uit');
const link = await F.maakKamerLink(req('coach', { teamId: 't1' }));
ok(link.code.length === 10 && store.get('teams/t1/kamerBeheer/link').code === link.code, 'teamlink van 10 tekens');
const info = await F.kamerLinkInfo(req(null, { code: link.code }));
ok(info.geldig && info.teamNaam === 'O11-1' && Object.keys(info).sort().join() === 'clubNaam,geldig,teamNaam', 'link toont alleen team- en clubnaam');
ok((await F.kamerLinkInfo(req(null, { code: 'BESTAATNIET' }))).geldig === false, 'onbekende link');
await gooit(() => F.vraagKamerToegang(req('mama', { code: link.code, kind: 'Pim' }, { verified: false })), 'failed-precondition', 'eerst het e-mailadres bevestigen');
await gooit(() => F.vraagKamerToegang(req('anon', { code: link.code, kind: 'Pim' }, { anoniem: true })), 'permission-denied', 'anoniem kan geen ouder worden');
await gooit(() => F.vraagKamerToegang(req('mama', { code: link.code, kind: '123' })), 'invalid-argument', 'naam van het kind is nodig');
const vraag = await F.vraagKamerToegang(req('mama', { code: link.code, kind: 'Pim' }, { email: 'mama@voorbeeld.test' }));
ok(vraag.status === 'wacht' && store.get('kamerAanvragen/t1_mama').kind === 'Pim' && !store.get('teamkamer/t1/kamerleden/mama'), 'aanvraag wacht: nog geen toegang');
ok(store.get(`kamerLinks/${link.code}`).gebruikt === 1, 'gebruik geteld');
await F.vraagKamerToegang(req('mama', { code: link.code, kind: 'Pim' }));
ok(store.get(`kamerLinks/${link.code}`).gebruikt === 1, 'dezelfde ouder telt niet twee keer');
await gooit(() => F.beoordeelKamerAanvraag(req('vreemd', { id: 't1_mama', goed: true, spelerId: 'p1' })), 'permission-denied', 'alleen de trainer keurt goed');
await gooit(() => F.beoordeelKamerAanvraag(req('coach', { id: 't1_mama', goed: true, spelerId: 'p4' })), 'invalid-argument', 'niet koppelen aan een gearchiveerde speler');
await gooit(() => F.beoordeelKamerAanvraag(req('coach', { id: 't1_mama', goed: true, spelerId: 'bestaatniet' })), 'invalid-argument', 'niet koppelen aan een onbekende speler');
await F.beoordeelKamerAanvraag(req('coach', { id: 't1_mama', goed: true, spelerId: 'p1' }));
const mama = store.get('teamkamer/t1/kamerleden/mama');
ok(mama.rol === 'ouder' && mama.spelerIds.join() === 'p1' && mama.vervaltOp.toMillis() === L.seizoenEindeMs(L.vandaagNL()), 'ouder gekoppeld aan één speler, tot het einde van het seizoen');
ok(!store.get('kamerAanvragen/t1_mama') && store.get('gebruikers/mama/kamers/t1').rol === 'ouder', 'aanvraag weg, wijzer gezet');
const mail = [...store.entries()].find(([p]) => p.startsWith('mail/'));
ok(mail && !/Pim|Sem|Noor/.test(JSON.stringify(mail[1])), 'mail aan de ouder zonder namen van spelers');
await F.vraagKamerToegang(req('fout', { code: link.code, kind: 'Iemand' }));
await F.beoordeelKamerAanvraag(req('coach', { id: 't1_fout', goed: false }));
ok(!store.get('kamerAanvragen/t1_fout') && !store.get('teamkamer/t1/kamerleden/fout'), 'afgewezen: geen toegang');

/* kindcode */
await gooit(() => F.maakKindCode(req('vreemd', { teamId: 't1', spelerId: 'p1' })), 'permission-denied', 'geen code zonder lidmaatschap');
await gooit(() => F.maakKindCode(req('mama', { teamId: 't1', spelerId: 'p2' })), 'permission-denied', 'geen code voor het kind van een ander');
const kc = await F.maakKindCode(req('mama', { teamId: 't1', spelerId: 'p1' }));
ok(kc.code.length === 6 && kc.minuten === 15, 'kindcode: 6 tekens, 15 minuten');
await gooit(() => F.wisselKindCode(req('kind', { code: 'AAAAAA' }, { anoniem: true })), 'not-found', 'verkeerde code');
await gooit(() => F.wisselKindCode(req('mama', { code: kc.code })), 'failed-precondition', 'de ouder kan de code niet zelf gebruiken');
await F.wisselKindCode(req('kind', { code: kc.code }, { anoniem: true }));
const kind = store.get('teamkamer/t1/kamerleden/kind');
ok(kind.rol === 'speler' && kind.spelerIds.join() === 'p1' && kind.door === 'mama' && !kind.email, 'speler binnen zonder e-mail');
await gooit(() => F.wisselKindCode(req('kind2', { code: kc.code }, { anoniem: true })), 'not-found', 'code werkt één keer');
const kc2 = await F.maakKindCode(req('mama', { teamId: 't1', spelerId: 'p1' }));
store.get(`kindCodes/${kc2.code}`).vervaltOp = fake.Timestamp.fromMillis(Date.now() - 1000);
await gooit(() => F.wisselKindCode(req('kind3', { code: kc2.code }, { anoniem: true })), 'not-found', 'verlopen code');
await gooit(() => F.maakKindCode(req('kind', { teamId: 't1', spelerId: 'p1' }, { anoniem: true })), 'permission-denied', 'een speler maakt geen codes');
await gooit(() => F.kamerVerberg(req('kind', { teamId: 't1', spelerId: 'p1', verborgen: true }, { anoniem: true })), 'permission-denied', 'een speler verbergt niets');

/* verbergen */
await F.kamerVerberg(req('mama', { teamId: 't1', spelerId: 'p1', verborgen: true }));
ok(store.get('teamkamer/t1').spelers.p1.v === true && store.get('teamkamer/t1/gezin/p1').voornaam === 'Pim', 'verborgen voor anderen, het eigen gezin houdt de naam');
await gooit(() => F.kamerVerberg(req('mama', { teamId: 't1', spelerId: 'p2', verborgen: true })), 'permission-denied', 'alleen het eigen kind verbergen');
await F.kamerVerberg(req('mama', { teamId: 't1', spelerId: 'p1', verborgen: false }));
ok(store.get('teamkamer/t1').spelers.p1.n === 'Pim', 'weer zichtbaar');

/* polls: tellen, namen, sluiten, beurten */
store.set('teamkamer/t1/polls/q1', { ...poll, status: 'open', nodig: 4 });
store.set('teamkamer/t1/polls/q1/stemmen/p1', { keuzes: ['o1'], door: 'mama', ms: 1 });
store.set('teamkamer/t1/polls/q1/stemmen/p2', { keuzes: ['o2'], door: 'x', ms: 1 });
await F.kamerStem(event('x', undefined, {}, { teamId: 't1', pollId: 'q1', spelerId: 'p1' }));
ok(store.get('teamkamer/t1/polls/q1').telling.o1 === 1 && store.get('teamkamer/t1/polls/q1').gestemd === 2 && store.get('teamkamer/t1/polls/q1').wie.o1.join() === 'p1', 'stemmen geteld');
const zonderNamen = { ...store.get('teamkamer/t1/polls/q1'), namen: false };
store.set('teamkamer/t1/polls/q1', zonderNamen);
await F.kamerPoll(event('teamkamer/t1/polls/q1', { ...zonderNamen, namen: true }, zonderNamen, { teamId: 't1', pollId: 'q1' }));
ok(store.get('teamkamer/t1/polls/q1').wie === undefined, 'coach zet namen uit: wie-wat verdwijnt uit de poll');
const dicht = { ...store.get('teamkamer/t1/polls/q1'), status: 'gesloten' };
store.set('teamkamer/t1/polls/q1', dicht);
await F.kamerPoll(event('teamkamer/t1/polls/q1', { ...dicht, status: 'open' }, dicht, { teamId: 't1', pollId: 'q1' }));
ok(store.get('teamkamer/t1/gezin/p1').beurten.rijden === 1 && !store.get('teamkamer/t1/gezin/p2').beurten, 'beurt voor wie reed');
await F.kamerPoll(event('teamkamer/t1/polls/q1', dicht, store.get('teamkamer/t1/polls/q1'), { teamId: 't1', pollId: 'q1' }));
ok(store.get('teamkamer/t1/gezin/p1').beurten.rijden === 1, 'een poll telt maar één keer');
ok(store.get('teamkamer/t1').beurtenGem.rijden === 0.3, 'gemiddelde van het team (1 rit op 3 gezinnen)');

/* intrekken en opruimen */
await gooit(() => F.trekKamerToegangIn(req('vreemd', { teamId: 't1', uid: 'mama' })), 'permission-denied', 'een vreemde trekt niets in');
await gooit(() => F.trekKamerToegangIn(req('kind', { teamId: 't1', uid: 'mama' }, { anoniem: true })), 'permission-denied', 'een speler trekt de ouder niet in');
ok((await F.stopKindToegang(req('mama', { teamId: 't1', spelerId: 'p1' }))).aantal === 1 && !store.get('teamkamer/t1/kamerleden/kind'), 'ouder stopt de toegang van het kind');
await F.vraagKamerToegang(req('papa', { code: link.code, kind: 'Sem' }));
await F.beoordeelKamerAanvraag(req('coach', { id: 't1_papa', goed: true, spelerId: 'p2' }));
store.delete('teams/t1/spelers/p2');
await F.kamerSpeler(event('x', { naam: 'Sem', nummer: 13 }, undefined, { teamId: 't1', spelerId: 'p2' }));
ok(!store.get('teamkamer/t1/kamerleden/papa') && !store.get('teamkamer/t1/gezin/p2'), 'speler weg uit het team: toegang van het gezin stopt');
await F.trekKamerToegangIn(req('coach', { teamId: 't1', uid: 'mama' }));
ok(!store.get('teamkamer/t1/kamerleden/mama') && !store.get('gebruikers/mama/kamers/t1'), 'coach trekt in: lid en wijzer weg');
store.set('teamkamer/t1/kamerleden/oud', { teamId: 't1', uid: 'oud', rol: 'ouder', spelerIds: ['p1'], vervaltOp: fake.Timestamp.fromMillis(Date.now() - 1000) });
ok((await T.nacht(fake.db)).weg >= 1 && !store.get('teamkamer/t1/kamerleden/oud'), 'verlopen toegang verdwijnt in de nacht');

/* ==================== 3. browserlogica ==================== */
const ks = { p1: { n: 'Pim', nr: 7 }, p2: { v: true }, p3: { n: 'Noor', nr: null } };
ok(K.spelerNaam(ks, 'p2') === 'Speler' && K.namenLijst(ks, ['p3', 'p1', 'p2']) === 'Noor, Pim, 1 speler', 'verborgen spelers zonder naam in lijsten');
const item = { id: 'w_w1', soort: 'wedstrijd', datum: '2026-11-21', tijd: '09:30', verzamel: '08:15', tegenstander: 'VV Elders O11-2', thuis: false, afwezig: ['p2'], plek: 'Sportpark De Elders' };
ok(K.afmeldTekst('Pim', item) === 'Pim is er zaterdag 21 november niet bij (wedstrijd tegen VV Elders O11-2).', 'afmeldbericht voor WhatsApp');
ok(K.waUrl('a b').startsWith('https://wa.me/?text=a%20b'), 'WhatsApp-link zonder telefoonnummer');
ok(K.eigenStatus(item, 'p2') === 'Afwezig' && K.eigenStatus(item, 'p1') === 'Erbij', 'eigen kind erbij of afwezig');
ok(K.itemTitel(item) === 'Wedstrijd, uit bij VV Elders O11-2' && K.itemTelling(item, 14) === '13 van 14', 'titel en telling');
const ics = K.maakIcs([item, { id: 't_2026-11-17', soort: 'training', datum: '2026-11-17', tijd: '18:00', eind: '19:00' }, { ...item, id: 'x', afgelast: true }], 'O11-1', new Date('2026-11-16T10:00:00Z'));
ok(ics.includes('DTSTART;TZID=Europe/Amsterdam:20261121T081500') && ics.includes('DTEND;TZID=Europe/Amsterdam:20261117T190000') && (ics.match(/BEGIN:VEVENT/g) || []).length === 2, 'agenda-bestand: verzameltijd, eindtijd, afgelast niet');
ok(!/Pim|Noor|Speler/.test(ics), 'agenda-bestand zonder namen');
const mp = K.maakPoll({ vraag: ' Wie rijdt? ', opties: ['Wij rijden', '', 'Deze keer niet'], soort: 'rijden', nodig: 4, wedstrijdId: 'w1', wedstrijdDatum: '2026-11-21' });
ok(mp.poll.opties.length === 2 && mp.poll.nodig === 4 && mp.poll.status === 'open' && mp.poll.namen === true && mp.poll.spelers === false && L.pollGeldig(mp.poll), 'poll van de trainer klopt met de server');
ok(K.maakPoll({ vraag: '', opties: ['a', 'b'] }).fout && K.maakPoll({ vraag: 'x', opties: ['a'] }).fout && K.maakPoll({ vraag: 'x', opties: ['a', 'A'] }).fout, 'poll zonder vraag, met één of met dubbele antwoorden geweigerd');
ok(K.maakPoll({ vraag: 'x', opties: ['a', 'b'], soort: 'beschikbaar' }).poll.soort === 'vrij', 'onbekende soort wordt een gewone poll');
ok(!K.SJABLONEN.some(s => /beschikbaar|aanwezig|kan er/i.test(s.naam + s.vraag())), 'geen sjabloon voor beschikbaarheid');
const pv = K.pollWeergave({ ...mp.poll, telling: { o1: 3, o2: 5 }, gestemd: 8, wie: { o1: ['p1', 'p2'] } }, ks, ['o1'], 14);
ok(pv.nodig === '3 van 4 auto’s' && pv.opties[0].gekozen && pv.opties[0].namen === 'Pim, 1 speler' && pv.opties[1].pct === 36, 'poll voor een ouder: auto’s, eigen stem, namen');
ok(K.kiesOptie(mp.poll, ['o1'], 'o2').join() === 'o2' && K.kiesOptie(mp.poll, ['o1'], 'o1').length === 0 && K.kiesOptie({ ...mp.poll, meer: true }, ['o1'], 'o2').join() === 'o1,o2', 'stem wisselen, intrekken, meer antwoorden');
ok(K.magStemmen(mp.poll, 'ouder') && !K.magStemmen(mp.poll, 'speler') && K.magStemmen({ ...mp.poll, spelers: true }, 'speler') && !K.magStemmen({ ...mp.poll, status: 'gesloten' }, 'ouder'), 'wie mag stemmen');
ok(K.nogNiet(['p1', 'p2', 'p3'], ['p2']).join() === 'p1,p3', 'nog niet gestemd');
ok(K.raadSpeler(spelers, 'pim') === 'p1' && K.raadSpeler([...spelers, { id: 'p9', naam: 'Pim B' }], 'Pim') === '' && K.raadSpeler(spelers, '') === '', 'voorstel bij een aanvraag: alleen als de voornaam één keer voorkomt');
assert.deepEqual(K.OPTIES.map(o => o[0]), L.OPTIES, 'browser en server kennen dezelfde mogelijkheden'); n++;
ok(K.OPTIES.every(o => o[1] && o[2]) && Object.values(K.optiesVan({ club: 'c1' }, { platformModules: { teamkamer: true } }, {})).every(v => v === false), 'elke mogelijkheid heeft een naam en uitleg; standaard alles uit');
ok(K.optiesVan({ club: 'c1' }, { platformModules: { teamkamerOpties: { polls: true } } }, { live: true }).polls === true && K.optiesVan({}, null, { live: true }).live === true && K.optiesVan({}, { platformModules: { teamkamerOpties: { polls: true } } }, {}).polls === false, 'club en losse trainer hebben elk hun eigen schakelaars');
ok(K.teamkamerMag({ club: 'c1' }, { platformModules: { teamkamer: true } }) && !K.teamkamerMag({ club: 'c1' }, { platformModules: {} }) && !K.teamkamerMag({}, null, false) && K.teamkamerMag({}, null, true), 'tegel alleen als de eindbaas het aanzet');
ok(K.weerUrl({ lat: 51.4567, lon: 5.6789 }, '2026-11-21').includes('latitude=51.46') && K.weerUrl(null, 'x') === '', 'weer: afgeronde coördinaten, geen namen');
ok(K.weerTekst({ hourly: { time: ['2026-11-21T08:00'], temperature_2m: [6.4], precipitation_probability: [10] } }, '08:15') === '6 °C, waarschijnlijk droog', 'weertekst');
ok(K.schoonCode('k7m-4qx ', 6) === 'K7M4QX' && K.toonCode('K7M4QX') === 'K7M 4QX', 'codes');
ok(!K.linkTekst('O11-1', 'ABC').match(/Pim|Sem/) && K.pollTekst('Wie rijdt?', 'q1').includes('kamer.html?poll=q1'), 'WhatsApp-teksten zonder namen');

/* ==================== 4. regels en opzet (tekstcontrole; de emulator test het gedrag) ==================== */
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const blok = rules.slice(rules.indexOf('teamkamer: ouders en spelers'));
ok(blok.includes('match /teamkamer/{teamId}') && /match \/teamkamer\/\{teamId\} \{\s+allow read: if kamerLezen\(teamId\);\s+allow write: if false;/.test(blok), 'de kopie schrijft alleen de server');
ok(/match \/kamerleden\/\{lidUid\} \{[^}]*allow write: if false;/.test(blok) && /match \/gezin\/\{spelerId\} \{[^}]*allow write: if false;/.test(blok) && /match \/agenda\/\{id\} \{[^}]*allow write: if false;/.test(blok), 'lidmaatschap, gezin en agenda schrijft alleen de server');
ok(!rules.slice(0, rules.indexOf('teamkamer: ouders en spelers')).includes('isKamerLid') && !rules.slice(0, rules.indexOf('teamkamer: ouders en spelers')).includes('kamerLezen'), 'een ouder of speler komt in geen enkele bestaande regel voor');
ok(/allow create, update: if magSchrijven\(teamId\) && kamerMag\(teamId, 'polls'\)/.test(blok) && /allow create, update: if magSchrijven\(teamId\) && kamerMag\(teamId, 'berichten'\)/.test(blok) && blok.includes("kamerMag(teamId, 'polls') && pollOpen(teamId, pollId)") && blok.includes("kamerMag(t, 'spelers')"), 'rules: polls, mededelingen, stemmen en spelers alleen als de eindbaas het aanzet');
ok(blok.includes("hasOnly(['keuzes', 'door', 'ms'])") && blok.includes('pollOpen(teamId, pollId)') && blok.includes('kamerEigenSpeler(teamId, spelerId)'), 'stem: alleen eigen gezin, alleen open poll, vaste velden');
ok(/match \/kamerLinks\/\{id\} \{ allow read, write: if false; \}/.test(blok) && /match \/kindCodes\/\{id\} \{ allow read, write: if false; \}/.test(blok), 'links en codes zijn alleen voor de server');
const app = fs.readFileSync(new URL('../public/js/kamer-app.js', import.meta.url), 'utf8');
ok(!/from '\.\/(teams|state|club|wedstrijd)[a-z-]*\.js/.test(app) && !/doc\(db, 'teams'|collection\(db, 'teams'|'clubs'/.test(app), 'de pagina van ouders laadt geen trainerscode en leest niets onder teams of clubs');
ok(!/<textarea|contenteditable/.test(app), 'ouders en spelers kunnen nergens vrije tekst plaatsen');
const logica = fs.readFileSync(new URL('../functions/teamkamer-logica.js', import.meta.url), 'utf8');
ok(!/afwezigRedenen\[|\.reden\b|\.notitie\b|leerpunten|beoordeling/.test(logica.replace(/\/\*[\s\S]*?\*\//g, '')), 'de kopie neemt geen reden, notitie, leerpunt of beoordeling over');
const index = fs.readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
ok(index.includes("require('./teamkamer').functies") && Object.keys(F).length === 20, 'functies geëxporteerd');

/* [20261116n] thuis oefenen: video's. Alleen een YouTube-id of een video uit de opslag van Cluppie komt in de kopie. */
const opslag = 'https://firebasestorage.googleapis.com/v0/b/voorbeeld.appspot.com/o/clubs%2Fc1%2Fvideos%2Fclip.mp4?alt=media&token=x';
const metVideos = { ...team, teamkamer: { aan: true, thuisVideos: [{ titel: 'Kappen', yt: 'dQw4w9WgXcQ' }, { titel: 'Eigen clip', url: opslag }, { titel: 'Vreemd', url: 'https://voorbeeld.nl/x.mp4' }, { yt: 'te-kort' }, null] } };
const kv = L.kamerDoc(metVideos, { naam: 'x', platformModules: { teamkamer: true, teamkamerOpties: { thuis: true } } }, spelers, {}, null);
assert.deepEqual(kv.thuisVideos, [{ titel: 'Kappen', yt: 'dQw4w9WgXcQ' }, { titel: 'Eigen clip', url: opslag }], 'alleen YouTube en de eigen opslag komen in de kopie'); n++;
ok(L.kamerDoc(metVideos, { naam: 'x', platformModules: { teamkamer: true } }, spelers, {}, null).thuisVideos.length === 0, 'thuis uit bij de eindbaas: geen video\'s');
ok(L.kamerDoc({ ...team, teamkamer: { aan: true, thuisVideos: Array.from({ length: 9 }, () => ({ yt: 'dQw4w9WgXcQ' })) } }, { naam: 'x', platformModules: { teamkamer: true, teamkamerOpties: { thuis: true } } }, spelers, {}, null).thuisVideos.length === K.MAX_THUIS_VIDEOS, 'maximaal zes video\'s');
ok(K.youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3') === 'dQw4w9WgXcQ' && K.youtubeId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && K.youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && K.youtubeId('https://voorbeeld.nl') === '', 'YouTube-links herkennen');
assert.deepEqual(K.thuisVideo({ url: 'https://youtu.be/dQw4w9WgXcQ', titel: ' Kappen ' }), { titel: 'Kappen', yt: 'dQw4w9WgXcQ' }); n++;
assert.deepEqual(K.thuisVideo({ bron: 'upload', url: opslag, titel: 'Clip' }), { titel: 'Clip', url: opslag }); n++;
ok(K.thuisVideo({ url: 'https://voorbeeld.nl/x.mp4' }) === null && K.thuisVideo({ bron: 'upload', url: 'https://youtu.be/dQw4w9WgXcQ' }) === null, 'andere links komen er niet in');
/* de link moet met www: het certificaat van de site geldt alleen voor www.cluppie.io */
ok(K.KAMER_URL.startsWith('https://www.cluppie.io/') && K.linkTekst('O11-1', 'ABC').includes('https://www.cluppie.io/kamer.html?k=ABC'), 'teamlink met www');
ok(K.kindCodeTekst('Pim', 'D7JSGF').includes('D7J SGF') && K.kindCodeTekst('Pim', 'D7JSGF').includes(K.KAMER_URL), 'code doorsturen: code en adres in het bericht');

/* ==================== 5. ronde 2 [20261116p]: stem meteen meetellen, veldkaart, nieuw, terug naar de teamkamer ==================== */
const pe = { opties: [{ id: 'o1' }, { id: 'o2' }], telling: { o1: 3, o2: 4 }, gestemd: 7, wie: { o1: ['p2'], o2: ['p3'] } };
const pe1 = K.pollMetEigen(pe, 'p1', [], ['o1']);
ok(pe1.telling.o1 === 4 && pe1.telling.o2 === 4 && pe1.gestemd === 8 && pe1.wie.o1.join() === 'p2,p1', 'eerste stem telt meteen mee, met naam');
const pe2 = K.pollMetEigen(pe, 'p3', ['o2'], ['o1']);
ok(pe2.telling.o1 === 4 && pe2.telling.o2 === 3 && pe2.gestemd === 7 && pe2.wie.o2.length === 0 && pe2.wie.o1.includes('p3'), 'stem wisselen: de oude eraf, de nieuwe erbij');
ok(K.pollMetEigen(pe, 'p3', ['o2'], []).gestemd === 6 && K.pollMetEigen(pe, 'p3', ['o2'], []).telling.o2 === 3, 'stem intrekken');
ok(K.pollMetEigen(pe, 'p3', ['o2'], ['o2']) === pe && K.pollMetEigen(pe, '', [], ['o1']) === pe && pe.telling.o1 === 3, 'niets gewijzigd: de poll van de server, en die wordt nooit aangepast');
ok(K.pollMetEigen({ ...pe, wie: undefined }, 'p1', [], ['o1']).wie === undefined, 'poll zonder namen: er komen geen namen bij');
ok(K.stemGeteld({ geteldMs: 100 }, 100, '{}') && !K.stemGeteld({ geteldMs: 99, telling: { o1: 9 } }, 100, '{}'), 'geteld volgens de server (geteldMs)');
ok(!K.stemGeteld({ telling: { o1: 3 } }, 100, '{"o1":3}') && K.stemGeteld({ telling: { o1: 4 } }, 100, '{"o1":3}'), 'oude server zonder geteldMs: geteld zodra de telling verandert');
ok(K.nieuweBerichten([{ ms: 5 }, { ms: 9 }], 5).length === 1 && K.nieuweBerichten([{ ms: 5 }], 0).length === 1 && K.nieuweBerichten(null, 0).length === 0, 'nieuwe mededelingen sinds Gelezen');
const openPoll = { id: 'q', status: 'open', spelers: false };
ok(K.nogStemmen([openPoll], { q: [] }, 'ouder').length === 1 && K.nogStemmen([openPoll], { q: ['o1'] }, 'ouder').length === 0 && K.nogStemmen([openPoll], {}, 'ouder').length === 0 && K.nogStemmen([openPoll], { q: [] }, 'speler').length === 0,
  'nog stemmen: alleen als bekend is dat er geen stem is, en alleen wie mag stemmen');
const vp = K.veldPlekken({ formatie: '3-3-1', plekken: { K: 'p1', V1: 'p2', V3: 'p3', M2: 'p4', A1: 'p5' } });
ok(vp.length === 5 && vp.find(x => x.plek === 'V1').x < vp.find(x => x.plek === 'V3').x && vp.find(x => x.plek === 'A1').y < vp.find(x => x.plek === 'M2').y && vp.find(x => x.plek === 'K').y === 90, 'veldkaart: links naar rechts, aanval boven, keeper onder');
ok(K.veldPlekken({ formatie: '4-2-3-1', plekken: { M1: 'a', M2: 'b', M3: 'c', M5: 'd' } }).map(x => x.y).join() === '56,56,38,38', 'vier linies: de middenvelders tellen door over twee linies');
ok(K.veldPlekken({ formatie: 'onzin', plekken: { V1: 'a', V2: 'b', A1: 'c' } }).length === 3 && K.veldPlekken({ plekken: {} }).length === 0 && K.veldPlekken(null).length === 0, 'veldkaart zonder bruikbare formatie: de linies die er zijn; zonder plekken niets');
const wo = { ...w, format: '8', formatie: '3-3-1', selectie: ['p1', 'p3'], deelOpstelling: true, kwarten: { 1: { ...(w.kwarten && w.kwarten[1]), formatie: '3-3-1', lineup: { K: 'p1', 'x/y': 'p3', V1: 5 } } } };
const pwo2 = L.projectWedstrijd(wo, { opstelling: true }, VANDAAG);
assert.deepEqual(pwo2.opstelling, { basis: ['p1', 'p3'], wissels: [], plekken: { K: 'p1' }, formatie: '3-3-1', format: '8' }, 'opstelling in de kopie: alleen geldige plekken, formatie en format'); n++;
const VM = require('../functions/verificatie-mail.js');
ok(VM.terugUrl('kamer', 'ab-c 12') === 'https://www.cluppie.io/kamer.html?k=ABC12' && VM.terugUrl('kamer') === 'https://www.cluppie.io/kamer.html' && VM.terugUrl() === 'https://www.cluppie.io/' && VM.terugUrl('https://kwaad.nl', 'x') === 'https://www.cluppie.io/',
  'bevestigingsmail: een ouder komt terug in de teamkamer, een trainer in de app, nooit op een ander adres');
ok(app.includes("roep('verificatieMail', { naar: 'kamer', code })") && app.includes('pollMetEigen') && app.includes("data-doe=\"gelezen\""), 'de pagina gebruikt het: mail terug naar de teamkamer, stem meteen geteld, Gelezen');
const stijl = fs.readFileSync(new URL('../public/kamer.css', import.meta.url), 'utf8');
ok(/html\.tk-pagina body, \.tkb\{overflow-wrap:break-word\}/.test(stijl) && stijl.includes('.tk-adres{overflow-wrap:anywhere}'), 'lange woorden breken af (het scherm viel opzij bij een lang e-mailadres)');

console.log(`teamkamer: ${n} controles geslaagd`);
