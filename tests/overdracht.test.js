// Speler overzetten in één transactie (functions/overdracht.js).  Draaien: node tests/overdracht.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
class Ts { constructor(s, n){ this.seconds = s; this.nanoseconds = n; } }
const orig = Module._load;
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError: class extends Error { constructor(c, m){ super(m); this.code = c; } } };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue, Timestamp: Ts };
  return orig.call(this, r, ...a);
};
const O = require('../functions/overdracht.js');
const { store } = fake;
const req = (uid, data) => ({ auth: { uid }, data });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const throws = async (f, code, m) => { try { await f(); ok(false, m + ' (geen fout)'); } catch (e) { ok(e.code === code, m + ` -> ${e.code}`); } };
const dossier = (sp, team) => ({ versie: 1, spelerId: sp, teamId: team, wedstrijden: [{ id: 'w1', tijd: 600 }], beoordelingen: [{ id: 'b1', gemaakt: { seconds: 100, nanoseconds: 5 } }] });

function zetKlaar(){
  store.clear();
  store.set('clubs/c1', { admins: { adm: true }, bouwCoordinatoren: { midden: { coord: true } } });
  store.set('clubs/c2', { admins: { ander: true } });
  store.set('teams/a', { club: 'c1', naam: 'O11-1', bouw: 'onder', leden: { coachA: true } });
  store.set('teams/b', { club: 'c1', naam: 'O13-1', bouw: 'midden', leden: { coachB: true } });
  store.set('teams/x', { club: 'c2', naam: 'Elders', leden: {} });
  store.set('teams/a/spelers/s1', { naam: 'Speler', nummer: 7, leerpunten: [{ id: 'l1' }], notitie: 'oud' });
  store.set('teams/a/spelers/s1/vorigeTeams/z_2025-08-01', { teamId: 'z' });
  store.set('clubs/c1/uitleningen/u1', { vanTeam: 'a', naarTeam: 'b', spelerId: 's1', overlay: { nummer: 10 } });
}

(async () => {
  /* controle */
  ok(O.controleer({ soort: 'raar' }).fout, 'onbekende soort geweigerd');
  ok(O.controleer({ soort: 'seizoen', clubId: 'c1', vanTeam: 'a', spelerId: 's1', naarTeam: 'a', datum: '2026-08-01' }).fout, 'zelfde team geweigerd');
  ok(O.controleer({ soort: 'seizoen', clubId: 'c1', vanTeam: 'a', spelerId: 's1', naarTeam: 'b', datum: '2026-08-01', dossier: dossier('s2', 'a') }).fout, 'dossier van andere speler geweigerd');
  ok(O.controleer({ soort: 'seizoen', clubId: 'c/1', vanTeam: 'a', spelerId: 's1', datum: '2026-08-01' }).fout, 'pad-injectie in id geweigerd');
  ok(!O.controleer({ soort: 'seizoen', clubId: 'c1', vanTeam: 'a', spelerId: 's1', naarTeam: null, datum: '2026-08-01' }).fout, 'club verlaten zonder dossier mag');
  ok(O.herstelTijden({ t: { seconds: 1, nanoseconds: 2 } }).t instanceof Ts, 'timestamp hersteld');

  /* uitleen: rechten */
  zetKlaar();
  const u = { soort: 'uitleen', clubId: 'c1', uitleenId: 'u1', vanTeam: 'a', spelerId: 's1', naarTeam: 'b', naarTeamNaam: 'O13-1', datum: '2026-10-01', mee: { not: false }, dossier: dossier('s1', 'a') };
  await throws(() => O.zetSpelerOver(req('coachB', u)), 'permission-denied', 'gewone coach mag niet definitief overzetten');
  ok(!store.get('teams/b/spelers/s1') && !store.get('teams/a/spelers/s1').gearchiveerd, 'na weigering niets veranderd');

  /* uitleen: coördinator van ontvangende bouw */
  const r = await O.zetSpelerOver(req('coord', u));
  ok(r.ok && !r.alGedaan, 'coördinator zet over');
  const nieuw = store.get('teams/b/spelers/s1');
  ok(nieuw && nieuw.nummer === 10 && nieuw.meetelVanaf === '2026-10-01' && nieuw.heeftVorigeTeams, 'spelerdocument met overlay en datum');
  ok(nieuw.notitie === undefined, 'notitie niet mee (mee.not=false)');
  ok(store.get('teams/a/spelers/s1').gearchiveerd === true && store.get('teams/a/spelers/s1').naarTeam === 'b', 'origineel gearchiveerd');
  ok(!store.get('clubs/c1/uitleningen/u1'), 'uitlening opgeruimd');
  ok(!!store.get('teams/b/spelers/s1/vorigeTeams/z_2025-08-01'), 'eerder dossier meegekopieerd');
  const d = store.get('teams/b/spelers/s1/vorigeTeams/a_2026-10-01');
  ok(d && d.beoordelingen[0].gemaakt.seconds === 100 && d.spelerId === 's1', 'dossier geschreven');

  /* opnieuw: herkend */
  store.set('clubs/c1/uitleningen/u1', { vanTeam: 'a', naarTeam: 'b', spelerId: 's1' });
  ok((await O.zetSpelerOver(req('coord', u))).alGedaan === true, 'tweede keer: alGedaan');

  /* seizoen: andere club geweigerd */
  zetKlaar();
  const sz = { soort: 'seizoen', clubId: 'c1', vanTeam: 'a', spelerId: 's1', naarTeam: 'x', datum: '2026-07-01', dossier: dossier('s1', 'a') };
  await throws(() => O.zetSpelerOver(req('adm', sz)), 'failed-precondition', 'doelteam van andere club geweigerd');

  /* seizoen: coach van alleen het bronteam mag niet naar team b */
  await throws(() => O.zetSpelerOver(req('coachA', { ...sz, naarTeam: 'b' })), 'permission-denied', 'coach zonder rechten op doelteam geweigerd');

  /* seizoen: clubbeheerder */
  await O.zetSpelerOver(req('adm', { ...sz, naarTeam: 'b' }));
  ok(store.get('teams/b/spelers/s1')?.meetelVanaf === '2026-07-01' && store.get('teams/a/spelers/s1').gearchiveerdOp === '2026-07-01', 'seizoen: verhuisd en gearchiveerd op datum');
  ok(!!store.get('clubs/c1/uitleningen/u1'), 'seizoen raakt uitleningen niet');

  /* seizoen: club verlaten */
  store.set('teams/a/spelers/s2', { naam: 'Twee' });
  await O.zetSpelerOver(req('coachA', { soort: 'seizoen', clubId: 'c1', vanTeam: 'a', spelerId: 's2', naarTeam: null, datum: '2026-07-01' }));
  ok(store.get('teams/a/spelers/s2').naarTeamNaam === 'Verlaat de club', 'speler verlaat club: alleen gearchiveerd');

  /* al naar ander team: geweigerd */
  await throws(() => O.zetSpelerOver(req('adm', { ...sz, naarTeam: null, dossier: null })), 'failed-precondition', 'al elders overgezet geweigerd');
  console.log(process.exitCode ? 'overdracht: FOUTEN' : 'overdracht: alle controles geslaagd');
})();
