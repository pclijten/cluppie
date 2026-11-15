// Los team koppelen aan een club, AI voor trainers zonder club en platforminstellingen.
// Draaien: node tests/koppelen.test.js
const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
class HttpsError extends Error { constructor(c, m){ super(m); this.code = c; } }
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError };
  if (r === 'firebase-functions/v2/scheduler') return { onSchedule: () => {} };
  if (r === 'firebase-functions/v2/firestore') return { onDocumentCreated: (o, f) => f };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp };
  if (r === 'firebase-admin/auth') return { getAuth: () => ({}) };
  if (r === 'firebase-admin') return { firestore: { Timestamp: fake.Timestamp }, auth: () => ({}) };
  return orig.call(this, r, ...a);
};
const T = require('../functions/toegang.js');
const SOLO = require('../functions/solo-ai.js');
const P = require('../functions/platform.js');
const { store, db, FieldValue } = fake;
const req = (uid, data, extra = {}) => ({ auth: { uid, token: { email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra } }, data, rawRequest: { headers: {} } });
const eindbaas = data => req('baas', data, { email: 'pclijten@gmail.com' });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const throws = async (f, code, m) => { try { await f(); ok(false, m + ' (geen fout)'); } catch (e) { ok(e.code === code, m + ` -> ${e.code}`); } };

(async () => {
  store.clear();
  store.set('clubs/c1', { naam: 'SV Brakel', admins: { adm: true }, adminsInfo: { adm: { naam: 'Admin' } }, leden: { adm: true }, ledenInfo: {}, teams: {} });
  store.set('teams/solo', { naam: 'MO13-1', categorie: 'MO13', leden: { sanne: true, hulp: true }, ledenInfo: { sanne: { naam: 'Sanne' }, hulp: { naam: 'Hulp' } }, eigenClub: { naam: 'S.V. Brakel', plaats: 'Bakel' } });
  store.set('teams/solo/spelers/s1', { naam: 'Mila' });
  store.set('teams/solo/spelers/s2', { naam: 'Tess', achternaam: 'Jansen' });
  store.set('teams/clubteam', { naam: 'O11-1', club: 'c1', leden: { x: true } });

  /* 1. voorstel: alleen de eindbaas, alleen voor een team zonder club */
  await throws(() => T.stelKoppelingVoor(req('sanne', { teamId: 'solo', clubId: 'c1' })), 'permission-denied', 'trainer mag zelf geen voorstel doen');
  await throws(() => T.stelKoppelingVoor(eindbaas({ teamId: 'clubteam', clubId: 'c1' })), 'failed-precondition', 'team met club kan niet');
  await throws(() => T.stelKoppelingVoor(eindbaas({ teamId: 'solo', clubId: 'nope' })), 'not-found', 'onbekende club');
  await T.stelKoppelingVoor(eindbaas({ teamId: 'solo', clubId: 'c1' }));
  ok(store.get('teams/solo').koppelVoorstel.status === 'open' && store.get('teams/solo').koppelVoorstel.clubNaam === 'SV Brakel', 'voorstel staat open op het team');

  /* 2. aanvragen door de trainer */
  await throws(() => T.vraagKoppelingAan(req('vreemd', { teamId: 'solo' })), 'permission-denied', 'niet-coach mag niet aanvragen');
  await T.vraagKoppelingAan(req('sanne', { teamId: 'solo' }));
  const a = store.get('aanvragen/c1_sanne_team');
  ok(a && a.rol === 'team' && a.teamId === 'solo' && a.spelers === 2 && a.naam === 'Sanne', 'aanvraag met rol team, teamnaam en aantal spelers');
  ok(store.get('teams/solo').koppelVoorstel.status === 'aangevraagd', 'voorstel op aangevraagd');
  ok(!store.get('teams/solo').club, 'team nog niet bij de club');
  await throws(() => T.vraagKoppelingAan(req('sanne', { teamId: 'solo' })), 'failed-precondition', 'tweede keer aanvragen kan niet');

  /* 3. beoordelen: alleen clubbeheerder */
  await throws(() => T.beoordeelAanvraag(req('sanne', { clubId: 'c1', uid: 'sanne', soort: 'team', besluit: 'goed' })), 'permission-denied', 'trainer keurt zichzelf niet goed');
  const r = await T.beoordeelAanvraag(req('adm', { clubId: 'c1', uid: 'sanne', soort: 'team', besluit: 'goed' }));
  const t = store.get('teams/solo'), c = store.get('clubs/c1');
  ok(r.ok && t.club === 'c1' && t.clubNaam === 'SV Brakel', 'team hoort nu bij de club');
  ok(!t.koppelVoorstel, 'voorstel opgeruimd');
  ok(c.teams.solo === true && c.leden.sanne === true && c.leden.hulp === true, 'team en beide coaches in de club');
  ok(c.ledenInfo.sanne.naam === 'Sanne' && c.ledenInfo.hulp.naam === 'Hulp', 'namen van de coaches bij de club');
  ok(!!store.get('teams/solo/spelers/s1'), 'spelers blijven bij het team');
  ok(!store.get('aanvragen/c1_sanne_team'), 'aanvraag weg');
  ok([...store.entries()].some(([p, d]) => p.startsWith('toegangslog/') && d.gebeurtenis === 'goedgekeurd' && /gekoppeld/.test(d.details || '')), 'in het toegangslog');

  /* afwijzen: voorstel blijft zichtbaar als afgewezen */
  store.set('teams/solo2', { naam: 'O9-2', leden: { ruben: true }, koppelVoorstel: { clubId: 'c1', status: 'open' } });
  await T.vraagKoppelingAan(req('ruben', { teamId: 'solo2' }));
  await T.beoordeelAanvraag(req('adm', { clubId: 'c1', uid: 'ruben', soort: 'team', besluit: 'af' }));
  ok(store.get('teams/solo2').koppelVoorstel.status === 'afgewezen' && !store.get('teams/solo2').club, 'afgewezen: team blijft los');

  /* 4. AI zonder club */
  const solo = (uid, teamId) => SOLO.vereisSoloAI({ db, request: req(uid, { teamId }), HttpsError, FieldValue, nu: new Date('2026-11-11T10:00:00Z') });
  ok(SOLO.soloBeleid(undefined).aan === false && SOLO.soloBeleid({}).limiet === 20, 'standaard uit, limiet 20');
  await throws(() => solo('ruben', 'solo2'), 'failed-precondition', 'AI uit: geweigerd');
  store.set('platform/instellingen', { soloAI: { aan: true, limiet: 2 } });
  await throws(() => solo('vreemd', 'solo2'), 'permission-denied', 'geen coach: geweigerd');
  await throws(() => solo('sanne', 'solo'), 'failed-precondition', 'team met club: via de club');
  const r1 = await solo('ruben', 'solo2');
  ok(r1.solo === true && r1.clubId === null && r1.teamId === 'solo2', 'losse trainer mag');
  await solo('ruben', 'solo2');
  ok(store.get('aiGebruikSolo/ruben_2026-11').aantal === 2, 'geteld per trainer per maand');
  await throws(() => solo('ruben', 'solo2'), 'resource-exhausted', 'limiet bereikt');
  const namen = await SOLO.namenVanTeam(db, 'solo');
  ok(namen.includes('Mila') && namen.includes('Tess Jansen') && namen.includes('Sanne'), 'namen van spelers en coaches voor de scrub');

  /* 5. platforminstellingen valideren */
  const s = P.schoonPlatformInstellingen({ soloAI: { aan: true, limiet: '25' }, standaard: { trainingsmodule: true, ai: 'ja', aiLimiet: '', maxVideoMB: 150 }, uitrol: { proefDagen: 14, slapendDagen: 30 }, onzin: 1 });
  ok(s.soloAI.aan === true && s.soloAI.limiet === 25, 'soloAI geschoond');
  ok(s.standaard.trainingsmodule === true && s.standaard.seizoensplan === false && s.standaard.ai === false && s.standaard.aiLimiet === null && s.standaard.maxVideoMB === 150, 'standaard geschoond');
  ok(s.uitrol.slapendDagen === 30 && !('onzin' in s), 'uitrol geschoond, onbekende velden weg');
  const fout = (d, m) => { try { P.schoonPlatformInstellingen(d); ok(false, m); } catch (e) { ok(e.code === 'invalid-argument', m); } };
  fout({ soloAI: { aan: true, limiet: -1 } }, 'negatieve limiet geweigerd');
  fout({ standaard: { maxVideoMB: 900 } }, 'te grote video geweigerd');
  fout({ uitrol: { proefDagen: 0, slapendDagen: 21 } }, 'proef 0 dagen geweigerd');
  fout({}, 'leeg geweigerd');

  /* 6. [20261114a] club aangemeld door een trainer zonder club: na goedkeuring gaan zijn losse teams mee */
  const A = require('../functions/aanmelding.js');
  store.set('clubs/nieuw', { naam: 'VV Nieuw', admins: { piet: true }, adminsInfo: { piet: { naam: 'Piet' } }, leden: { piet: true }, ledenInfo: {}, teams: {} });
  store.set('teams/losP', { naam: 'O9-1', leden: { piet: true, maat: true }, ledenInfo: { piet: { naam: 'Piet' }, maat: { naam: 'Maat' } }, eigenClub: { naam: 'VV Nieuw', plaats: 'X' } });
  store.set('teams/losP/spelers/s1', { naam: 'Daan' });
  store.set('teams/anderP', { naam: 'O13-2', club: 'c1', leden: { piet: true } });
  store.set('teams/vreemd', { naam: 'O7-1', leden: { iemand: true } });
  const mee = await A.neemLosseTeamsMee(db, { clubId: 'nieuw', clubNaam: 'VV Nieuw', uid: 'piet', naam: 'Piet' });
  ok(mee.length === 1 && mee[0] === 'O9-1', 'alleen het losse team van de aanvrager gaat mee');
  ok(store.get('teams/losP').club === 'nieuw' && store.get('teams/losP').clubNaam === 'VV Nieuw', 'team staat bij de nieuwe club');
  ok(store.get('clubs/nieuw').teams.losP === true && store.get('clubs/nieuw').leden.maat === true, 'club kent het team en de mede-coach');
  ok(store.has('teams/losP/spelers/s1'), 'spelers blijven bij het team');
  ok(store.get('teams/anderP').club === 'c1' && !store.get('teams/vreemd').club, 'teams van een andere club of een ander blijven ongemoeid');

  /* 7. [20261114a] via een uitnodiging bij een club: losse teams krijgen vanzelf een koppelvoorstel */
  store.set('teams/losK', { naam: 'O10-1', leden: { kim: true } });
  store.set('teams/losK2', { naam: 'O12-1', leden: { kim: true }, koppelVoorstel: { clubId: 'x', status: 'geweigerd' } });
  store.set('teams/clubK', { naam: 'O13-1', club: 'c1', leden: { kim: true } });
  await T.stelLosseTeamsVoor(db, { uid: 'kim', clubId: 'c1', clubNaam: 'SV Brakel' });
  const kv = store.get('teams/losK').koppelVoorstel;
  ok(kv && kv.clubId === 'c1' && kv.status === 'open' && kv.clubNaam === 'SV Brakel', 'los team krijgt een open koppelvoorstel');
  ok(store.get('teams/losK2').koppelVoorstel.status === 'geweigerd', 'een eerder geweigerd voorstel blijft staan');
  ok(!store.get('teams/clubK').koppelVoorstel, 'clubteam krijgt geen voorstel');

  console.log(process.exitCode ? 'koppelen: FOUTEN' : 'koppelen: alle controles geslaagd');
})();
