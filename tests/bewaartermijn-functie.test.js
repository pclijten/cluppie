// Bewaartermijnen op de server: beoordelingen uit evaluatierondes, teamkamer en trainingshulp.
// Draaien: node tests/bewaartermijn-functie.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } }
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp };
  return orig.call(this, r, ...a);
};
const B = require('../functions/bewaartermijn.js');
const { store, db } = fake;
let n = 0;
const ok = (c, m) => { n++; if (!c){ console.log('FAIL ' + m); process.exitCode = 1; } };
const throws = async (f, code, m) => { try { await f(); ok(false, m + ' (geen fout)'); } catch (e) { ok(e.code === code, m + ` -> ${e.code}`); } };
const req = (uid, data) => ({ auth: uid ? { uid, token: {} } : null, data });

(async () => {
  /* ---------- rekenregels ---------- */
  ok(B.schoonBewaar(null).seizoenen === 3 && B.schoonBewaar({ seizoenen: 0 }).seizoenen === 0 && B.schoonBewaar({ seizoenen: 4 }).seizoenen === 3, 'termijn: standaard 3, 0 is alles bewaren, onbekend wordt de standaard');
  ok(B.seizoenStart("2025/'26") === 2025 && B.seizoenStart('2024-2025') === 2024 && B.seizoenStart('') === null, 'startjaar uit het label');
  ok(B.seizoenVanDatum(Date.UTC(2026, 10, 22)) === 2026 && B.seizoenVanDatum(Date.UTC(2026, 5, 30)) === 2025 && B.seizoenVanDatum(Date.UTC(2026, 6, 1)) === 2026, 'seizoen van een dag: 1 juli is de grens');
  ok(B.huidigStart({ huidigSeizoen: "2025/'26" }, Date.UTC(2026, 10, 22)) === 2025 && B.huidigStart({}, Date.UTC(2026, 10, 22)) === 2026, 'lopend seizoen: label van de club, anders de kalender');
  ok(B.seizoenVerlopen("2023/'24", 2026, 3) === true && B.seizoenVerlopen("2024/'25", 2026, 3) === false, 'drie seizoenen: 2023 valt eruit, 2024 blijft');
  ok(B.seizoenVerlopen("2019/'20", 2026, 0) === false && B.seizoenVerlopen('', 2026, 3) === false, 'alles bewaren en zonder label: niets');
  const grens = B.seizoenBeginMs(2026);
  ok(new Date(grens).toISOString() === '2026-06-30T22:00:00.000Z', 'begin van het seizoen: 1 juli 00:00 Nederlandse tijd');
  ok(B.pollOud({ status: 'gesloten', gemaaktMs: grens - 1 }, grens) === true, 'gesloten poll van vorig seizoen');
  ok(B.pollOud({ status: 'open', gemaaktMs: grens - 1 }, grens) === false, 'open poll blijft');
  ok(B.pollOud({ status: 'gesloten', gemaaktMs: grens + 1 }, grens) === false && B.pollOud({ status: 'gesloten' }, grens) === false && B.pollOud(null, grens) === false, 'poll van dit seizoen of zonder datum blijft');
  const sp = new Map([['t1', new Set(['a', 'b'])]]);
  ok(B.priveReden({ teamId: 't1', spelerId: 'a', seizoen: "2026/'27" }, { huidig: 2026, bewaren: 3, spelersPerTeam: sp }) === '', 'beoordeling van dit seizoen, speler bestaat: blijft');
  ok(B.priveReden({ teamId: 't1', spelerId: 'a', seizoen: "2022/'23" }, { huidig: 2026, bewaren: 3, spelersPerTeam: sp }) === 'oud', 'oud seizoen');
  ok(B.priveReden({ teamId: 't1', spelerId: 'x', seizoen: "2026/'27" }, { huidig: 2026, bewaren: 3, spelersPerTeam: sp }) === 'wees', 'speler bestaat niet meer');
  ok(B.priveReden({ teamId: 'weg', spelerId: 'a', seizoen: "2026/'27" }, { huidig: 2026, bewaren: 3, spelersPerTeam: sp }) === 'wees', 'team bestaat niet meer');
  ok(B.priveReden({ teamId: 't1', spelerId: 'a', seizoen: "2019/'20" }, { huidig: 2026, bewaren: 0, spelersPerTeam: sp }) === '', 'alles bewaren: oud seizoen blijft');

  /* ---------- de functie ---------- */
  const nu = Date.UTC(2026, 10, 22), vorig = Date.UTC(2026, 2, 1), dit = Date.UTC(2026, 9, 1);
  store.clear();
  store.set('clubs/c1', { naam: 'FC Test', admins: { adm: true }, huidigSeizoen: "2026/'27", instellingen: { privacy: { bewaar: { spelersJaren: 1, seizoenen: 3 } } } });
  store.set('clubs/c2', { naam: 'Andere club', admins: { adm2: true }, huidigSeizoen: "2026/'27" });
  store.set('teams/t1', { naam: 'O11-1', club: 'c1', leden: { coach: true } });
  store.set('teams/t1/spelers/a', { naam: 'A' });
  store.set('teams/t1/spelers/b', { naam: 'B', gearchiveerd: true });
  store.set('teams/x1', { naam: 'O11-1', club: 'c2' });
  store.set('teams/x1/spelers/z', { naam: 'Z' });
  /* privé-beoordelingen */
  store.set('beoordelingenPrive/p1', { club: 'c1', teamId: 't1', spelerId: 'a', seizoen: "2026/'27" });        // blijft
  store.set('beoordelingenPrive/p2', { club: 'c1', teamId: 't1', spelerId: 'a', seizoen: "2022/'23" });        // oud
  store.set('beoordelingenPrive/p3', { club: 'c1', teamId: 't1', spelerId: 'gewist', seizoen: "2026/'27" });   // wees
  store.set('beoordelingenPrive/p4', { club: 'c1', teamId: 't1', spelerId: 'b', seizoen: "2025/'26" });        // gearchiveerd: blijft
  store.set('beoordelingenPrive/q1', { club: 'c2', teamId: 'x1', spelerId: 'gewist', seizoen: "2020/'21" });   // andere club
  /* teamkamer */
  store.set('teamkamer/t1', { club: 'c1', aan: true });
  store.set('teamkamer/t1/berichten/m1', { tekst: 'oud', ms: vorig });
  store.set('teamkamer/t1/berichten/m2', { tekst: 'nieuw', ms: dit });
  store.set('teamkamer/t1/polls/o1', { status: 'gesloten', gemaaktMs: vorig });
  store.set('teamkamer/t1/polls/o1/stemmen/a', { keuzes: ['x'] });
  store.set('teamkamer/t1/polls/o2', { status: 'open', gemaaktMs: vorig });
  store.set('teamkamer/t1/polls/o3', { status: 'gesloten', gemaaktMs: dit });
  store.set('teamkamer/t1/gezin/a', { voornaam: 'A' });
  store.set('teamkamer/t1/gezin/b', { voornaam: 'B' });
  store.set('teamkamer/t1/gezin/b/ouder/stats', { wedstrijden: 3 });
  store.set('teamkamer/t1/gezin/weg', { voornaam: 'Weg' });
  store.set('teamkamer/x1/berichten/m9', { tekst: 'andere club', ms: vorig });
  /* trainingshulp */
  store.set('hulpDeel/h1', { club: 'c1', teamId: 't1', titel: 'Trainingshulp' });
  store.set('hulpDeel/h1/aanmeldingen/u1', { naam: 'Jan', ms: vorig });
  store.set('hulpDeel/h1/aanmeldingen/u2', { naam: 'Els', ms: dit });
  store.set('hulpDeel/h9', { club: 'c2', teamId: 'x1' });
  store.set('hulpDeel/h9/aanmeldingen/u1', { naam: 'Ander', ms: vorig });

  await throws(() => B.bewaarOpruimen(req(null, { clubId: 'c1' })), 'unauthenticated', 'niet ingelogd');
  await throws(() => B.bewaarOpruimen(req('coach', { clubId: 'c1' })), 'permission-denied', 'coach mag niet opruimen');
  await throws(() => B.bewaarOpruimen(req('adm2', { clubId: 'c1' })), 'permission-denied', 'beheerder van een andere club mag niet');
  await throws(() => B.bewaarOpruimen(req('adm', { clubId: 'nope' })), 'not-found', 'onbekende club');
  await throws(() => B.bewaarOpruimen(req('adm', {})), 'invalid-argument', 'zonder club');

  const aantalVoor = store.size;
  const tel = await B.ruimOp(db, { clubId: 'c1', club: store.get('clubs/c1'), wis: false, nu });
  ok(tel.prive.oud === 1 && tel.prive.wees === 1, 'telt één oude en één verweesde beoordeling');
  ok(tel.kamer.berichten === 1 && tel.kamer.polls === 1 && tel.kamer.gezinnen === 2, 'telt mededeling, poll en twee gezinnen (weg en gearchiveerd)');
  ok(tel.hulp === 1 && tel.totaal === 7 && tel.gewist === false, 'telt één aanmelding; zeven in totaal; niets gewist');
  ok(store.size === aantalVoor, 'tellen verandert niets');

  const weg = await B.ruimOp(db, { clubId: 'c1', club: store.get('clubs/c1'), wis: true, nu, uid: 'adm' });
  ok(weg.gewist === true && weg.totaal === 7, 'gewist');
  ok(!store.has('beoordelingenPrive/p2') && !store.has('beoordelingenPrive/p3') && store.has('beoordelingenPrive/p1') && store.has('beoordelingenPrive/p4'), 'oude en verweesde beoordeling weg, de rest blijft');
  ok(!store.has('teamkamer/t1/berichten/m1') && store.has('teamkamer/t1/berichten/m2'), 'oude mededeling weg, nieuwe blijft');
  ok(!store.has('teamkamer/t1/polls/o1') && !store.has('teamkamer/t1/polls/o1/stemmen/a') && store.has('teamkamer/t1/polls/o2') && store.has('teamkamer/t1/polls/o3'), 'oude gesloten poll met stemmen weg; open poll en poll van dit seizoen blijven');
  ok(store.has('teamkamer/t1/gezin/a') && !store.has('teamkamer/t1/gezin/b') && !store.has('teamkamer/t1/gezin/b/ouder/stats') && !store.has('teamkamer/t1/gezin/weg'), 'gezinnen van spelers die weg zijn, met de cijfers eronder');
  ok(!store.has('hulpDeel/h1/aanmeldingen/u1') && store.has('hulpDeel/h1/aanmeldingen/u2') && store.has('hulpDeel/h1'), 'oude aanmelding weg, de lijst blijft');
  ok(store.has('beoordelingenPrive/q1') && store.has('teamkamer/x1/berichten/m9') && store.has('hulpDeel/h9/aanmeldingen/u1'), 'niets van een andere club');
  ok(store.has('teams/t1/spelers/a') && store.has('teams/t1/spelers/b') && store.has('teamkamer/t1'), 'spelers en de teamkamer zelf blijven');
  const logs = [...store.entries()].filter(([p, d]) => p.startsWith('toegangslog/') && d.gebeurtenis === 'bewaartermijn_opgeruimd');
  ok(logs.length === 1 && logs[0][1].clubId === 'c1' && logs[0][1].door === 'adm' && /2 beoordelingen/.test(logs[0][1].details) && !/Jan|Weg/.test(JSON.stringify(logs[0][1])), 'in het toegangslog, met aantallen en zonder namen');

  const na = await B.bewaarOpruimen(req('adm', { clubId: 'c1', wis: true }));
  ok(na.totaal === 0 && na.gewist === false, 'tweede keer: niets meer te doen');
  ok([...store.keys()].filter(p => p.startsWith('toegangslog/')).length === 1, 'geen logregel als er niets gewist is');

  /* alles bewaren: oude seizoenen blijven, wezen gaan nog steeds weg */
  store.set('clubs/c1', { ...store.get('clubs/c1'), instellingen: { privacy: { bewaar: { seizoenen: 0 } } } });
  store.set('beoordelingenPrive/p5', { club: 'c1', teamId: 't1', spelerId: 'a', seizoen: "2019/'20" });
  store.set('beoordelingenPrive/p6', { club: 'c1', teamId: 't1', spelerId: 'niemand', seizoen: "2019/'20" });
  const alles = await B.ruimOp(db, { clubId: 'c1', club: store.get('clubs/c1'), wis: false, nu });
  ok(alles.prive.oud === 0 && alles.prive.wees === 1, 'alles bewaren: alleen de verweesde');

  console.log(process.exitCode ? 'bewaartermijn-functie: FOUTEN' : `bewaartermijn-functie: ${n} controles geslaagd`);
})();
