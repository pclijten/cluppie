const Module = require('module'); const fake = require('./fake-firestore.js');
const orig = Module._load;
Module._load = function(r, ...a){
  if (r === 'firebase-functions/v2/https') return { onCall: (o, f) => f, HttpsError: class extends Error { constructor(c, m){ super(m); this.code = c; } } };
  if (r === 'firebase-functions/v2/scheduler') return { onSchedule: () => {} };
  if (r === 'firebase-admin/firestore') return { getFirestore: () => fake.db, FieldValue: fake.FieldValue, Timestamp: fake.Timestamp };
  if (r === 'firebase-admin') return { firestore: { Timestamp: fake.Timestamp }, auth: () => ({}) };
  return orig.call(this, r, ...a);
};
const T = require('../functions/toegang.js');
const { store } = fake;
const req = (uid, data, extra = {}) => ({ auth: { uid, token: { email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra } }, data, rawRequest: { headers: {} } });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const throws = async (f, code, m) => { try { await f(); ok(false, m + ' (geen fout)'); } catch (e) { ok(e.code === code, m + ` -> ${e.code}`); } };
(async () => {
  store.set('clubs/c1', { naam: 'Testclub', admins: { adm: true }, adminsInfo: { adm: { naam: 'Admin' } }, leden: { adm: true }, ledenInfo: { adm: { naam: 'Admin' } } });
  store.set('teams/t1', { naam: 'JO11-1', club: 'c1', clubNaam: 'Testclub', code: 'JO111', leden: { coachA: true }, ledenInfo: { coachA: { naam: 'A' } } });
  store.set('teams/t2', { naam: 'JO12-1', club: 'c1', clubNaam: 'Testclub', code: 'JO121', leden: { x: true } });
  // 1 uitnodiging
  await throws(() => T.maakUitnodiging(req('rand', { clubId: 'c1', teamId: 't1' })), 'permission-denied', 'vreemde mag niet uitnodigen');
  await throws(() => T.maakUitnodiging(req('coachA', { clubId: 'c1' })), 'permission-denied', 'coach mag geen club-uitnodiging');
  const inv = await T.maakUitnodiging(req('coachA', { clubId: 'c1', teamId: 't1', geldigDagen: 7, maxGebruik: 2 }));
  ok(inv.code.length === 10, 'code 10 tekens: ' + inv.code);
  // 2 aansluiten met goedkeuring (default)
  await throws(() => T.sluitAan(req('nieuw', { code: inv.code, naam: 'Nina' }, { email_verified: false })), 'failed-precondition', 'ongeverifieerd e-mail geweigerd');
  const r1 = await T.sluitAan(req('nieuw', { code: inv.code, naam: 'Nina' }));
  ok(r1.status === 'aanvraag', 'status aanvraag');
  ok(!store.get('teams/t1').leden.nieuw, 'nog GEEN lid van team');
  ok(!!store.get('aanvragen/c1_nieuw'), 'aanvraag aangemaakt');
  ok(store.get(`uitnodigingen/${inv.id}`).gebruikt === 1, 'gebruik geteld');
  // 3 beoordelen
  await throws(() => T.beoordeelAanvraag(req('rand', { clubId: 'c1', uid: 'nieuw', besluit: 'goed' })), 'permission-denied', 'vreemde mag niet beoordelen');
  await T.beoordeelAanvraag(req('coachA', { clubId: 'c1', uid: 'nieuw', besluit: 'goed' }));
  const t1 = store.get('teams/t1');
  ok(t1.leden.nieuw === true && t1.rollen.nieuw === 'coach', 'goedgekeurd als coach (default)');
  ok(store.get('clubs/c1').leden.nieuw === true, 'ook clublid');
  ok(!store.get('aanvragen/c1_nieuw'), 'aanvraag opgeruimd');
  // 4 assistent (oude data) mag niet uitnodigen
  store.get('teams/t1').rollen.nieuw = 'assistent';
  await throws(() => T.maakUitnodiging(req('nieuw', { clubId: 'c1', teamId: 't1' })), 'permission-denied', 'assistent mag niet uitnodigen');
  // 5 rol wijzigen
  await T.wijzigRol(req('adm', { clubId: 'c1', teamId: 't1', uid: 'nieuw', rol: 'coach' }));
  ok(store.get('teams/t1').rollen.nieuw === 'coach', 'rol -> coach');
  // 6 max gebruik + intrekken
  await T.sluitAan(req('u2', { code: inv.code, naam: 'U2' }));
  await throws(() => T.sluitAan(req('u3', { code: inv.code, naam: 'U3' })), 'not-found', 'max gebruik bereikt');
  const inv2 = await T.maakUitnodiging(req('adm', { clubId: 'c1', teamId: 't2' }));
  await T.trekUitnodigingIn(req('adm', { id: inv2.id }));
  await throws(() => T.sluitAan(req('u4', { code: inv2.code, naam: 'U4' })), 'not-found', 'ingetrokken code werkt niet');
  // 7 verlopen
  store.get(`uitnodigingen/${inv2.id}`).ingetrokken = false; store.get(`uitnodigingen/${inv2.id}`).verlooptOp = fake.Timestamp.fromMillis(Date.now() - 1000);
  await throws(() => T.sluitAan(req('u4', { code: inv2.code, naam: 'U4' })), 'not-found', 'verlopen code werkt niet');
  // 8 oude teamcode + vasteCodes uit
  const r2 = await T.sluitAan(req('u5', { code: 'JO121', naam: 'U5' }));
  ok(r2.status === 'aanvraag', 'oude teamcode ook via aanvraag');
  store.get('clubs/c1').instellingen = { toegang: { vasteCodes: false, goedkeuring: false, standaardRol: 'coach' } };
  await throws(() => T.sluitAan(req('u6', { code: 'JO121', naam: 'U6' })), 'not-found', 'vaste codes uit');
  const inv3 = await T.maakUitnodiging(req('adm', { clubId: 'c1', teamId: 't2' }));
  const r3 = await T.sluitAan(req('u6', { code: inv3.code, naam: 'U6' }));
  ok(r3.status === 'lid' && store.get('teams/t2').rollen.u6 === 'coach', 'zonder goedkeuring direct lid met standaardrol');
  // 9 verwijderen
  await throws(() => T.verwijderLid(req('coachA', { clubId: 'c1', uid: 'u6' })), 'permission-denied', 'coach mag niet verwijderen');
  await T.verwijderLid(req('adm', { clubId: 'c1', uid: 'u6' }));
  ok(!store.get('teams/t2').leden.u6 && !store.get('clubs/c1').leden.u6 && !store.get('teams/t2').rollen.u6, 'lid volledig verwijderd');
  await throws(() => T.verwijderLid(req('adm', { clubId: 'c1', uid: 'adm' })), 'failed-precondition', 'enige admin niet verwijderbaar');
  // 10 rate limit
  for (let i = 0; i < 10; i++) { try { await T.sluitAan(req('spam', { code: 'ZZZZZZ' })); } catch (e) {} }
  await throws(() => T.sluitAan(req('spam', { code: 'ZZZZZZ' })), 'resource-exhausted', 'rate limit');
  console.log('log-regels:', [...store.keys()].filter(k => k.startsWith('toegangslog/')).length);
})();
