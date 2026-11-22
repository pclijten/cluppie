import assert from 'node:assert/strict';
// Verhuizing ASV'33 → cluppie.io: de regels (tools/verhuis-asv33/logica.mjs), zonder Firebase.
// Draaien: node --import ./tests/hulp/stub-loader.mjs tests/verhuis-asv33.test.mjs   (van begin tot eind tegen de emulators: npm run test:verhuis)
import fs from 'node:fs';
const L = await import('../tools/verhuis-asv33/logica.mjs');
const P = await import('../tools/verhuis-asv33/proef-server.mjs');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; }, is = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* ---- het inlogbewijs achter het hekje (public/js/verhuis-login.js; heeft de stub-loader nodig) ---- */
const { leesVerhuisHash } = await import('../public/js/verhuis-login.js');
is(leesVerhuisHash('#verhuis=aa.bb.cc'), { bewijs: 'aa.bb.cc', rest: '' });
is(leesVerhuisHash('#x=1&verhuis=aa.bb.cc&y=2'), { bewijs: 'aa.bb.cc', rest: '#x=1&y=2' });
is(leesVerhuisHash('#verhuis=<script>'), { bewijs: '', rest: '' }, 'alleen iets dat op een inlogbewijs lijkt');
is(leesVerhuisHash('#iets'), { bewijs: '', rest: '#iets' });
is(leesVerhuisHash(''), { bewijs: '', rest: '' });

/* ---- paden ---- */
is(L.doelPad('teams/t1/spelers/s1', {}), 'teams/t1/spelers/s1');
is(L.doelPad('content/k1', { clubId: 'c9' }), 'clubs/c9/content/k1', 'eigen inhoud gaat naar de club');
is(L.doelPad('content/k1', {}), null, 'zonder hoofdclub niet in de gedeelde standaard');
is(L.doelPad('trainingToegang/u1', {}), null);
is(L.doelPad('platform/instellingen', {}), null, 'onbekende collectie gaat niet mee');
is(L.doelPad('mail/x', {}), null);
is(L.doelPad('gebruikers/oud/gelezen/tr1', { uidMap: { oud: 'nieuw' } }), 'gebruikers/nieuw/gelezen/tr1');
is(L.doelPad('teams/oud/spelers/oud', { uidMap: { oud: 'nieuw' } }), 'teams/nieuw/spelers/nieuw', 'alleen document-id\'s, geen collectienamen');
is(L.doelPad('oud/x', { uidMap: { oud: 'nieuw' } }), null);
ok(!L.KOPIEER.some(c => L.SLA_OVER.includes(c) || L.NAAR_CLUB.includes(c)), 'een collectie staat in één lijst');

/* ---- accounts ---- */
const ww = (uid, email, extra = {}) => ({ uid, email, providerData: [{ providerId: 'password', uid: email }], passwordHash: 'aGFzaA==', passwordSalt: 'c2FsdA==', ...extra });
const google = (uid, email, gid) => ({ uid, email, providerData: [{ providerId: 'google.com', uid: gid, email }] });
ok(L.isAnoniem({ uid: 'a', providerData: [] })); ok(!L.isAnoniem(ww('a', 'a@x.test'))); ok(!L.isAnoniem(google('g', 'g@x.test', '1')));
const r = L.importRecord(ww('u1', 'a@x.test', { displayName: 'A', emailVerified: true, metadata: { creationTime: 'Mon, 01 Sep 2025 10:00:00 GMT', lastSignInTime: null } }));
is(r.uid, 'u1'); is(r.email, 'a@x.test'); is(r.emailVerified, true); is(r.disabled, false);
ok(Buffer.isBuffer(r.passwordHash) && r.passwordHash.toString() === 'hash' && r.passwordSalt.toString() === 'salt', 'hash en salt als bytes');
is(r.providerData, undefined, 'de wachtwoord-methode zit in de hash, niet in providerData');
is(r.metadata, { creationTime: 'Mon, 01 Sep 2025 10:00:00 GMT' });
const rg = L.importRecord({ ...google('u2', 'g@x.test', 'g-1'), passwordHash: undefined });
is(rg.providerData, [{ uid: 'g-1', providerId: 'google.com', email: 'g@x.test' }]); ok(!('passwordHash' in rg));
const beide = L.importRecord({ ...ww('u3', 'b@x.test'), providerData: [{ providerId: 'password', uid: 'b@x.test' }, { providerId: 'google.com', uid: 'g-2' }] });
is(beide.providerData, [{ uid: 'g-2', providerId: 'google.com' }]); ok(beide.passwordHash);

const index = lijst => { const a = new Map(), b = new Map(), c = new Map(); for (const u of lijst){ a.set(u.uid, u); if (u.email) b.set(u.email.toLowerCase(), u); for (const p of u.providerData || []) if (p.providerId !== 'password') c.set(p.providerId + '|' + p.uid, u); } return { doelOpUid: a, doelOpEmail: b, doelOpProvider: c }; };
let plan = L.planAccounts([ww('u1', 'a@x.test'), google('u2', 'g@x.test', 'g-1'), { uid: 'anon', providerData: [] }], index([]));
is(plan.importeer.map(u => u.uid), ['u1', 'u2']); is(plan.anoniem, 1); is(plan.uidMap, {}); is(plan.dubbel, []);
plan = L.planAccounts([ww('u1', 'A@X.test')], index([ww('anders', 'a@x.test')]));
is(plan.uidMap, { u1: 'anders' }, 'zelfde e-mailadres (hoofdletters tellen niet) = koppelen'); is(plan.importeer, []);
plan = L.planAccounts([google('u2', 'nieuw@x.test', 'g-1')], index([google('bestaand', 'oud@x.test', 'g-1')]));
is(plan.uidMap, { u2: 'bestaand' }, 'zelfde Google-account = koppelen, ook met een ander e-mailadres');
plan = L.planAccounts([ww('u1', 'a@x.test')], index([ww('u1', 'a@x.test')]));
is(plan.bijwerken.length, 1); is(plan.importeer, []); is(plan.uidMap, {}, 'al overgezet: blijft');
plan = L.planAccounts([ww('u1', 'a@x.test')], index([ww('u1', 'iemandanders@x.test')]));
is(plan.dubbel.length, 1); is(plan.uidMap, {}, 'zelfde id, ander adres: niet vanzelf koppelen');
plan = L.planAccounts([{ ...ww('u1', 'a@x.test'), passwordHash: undefined }], index([]));
is(plan.zonderHash.length, 1, 'wachtwoord-account zonder leesbare hash wordt gemeld');

/* ---- bestanden en waarden ---- */
is(L.bestandDoelNaam('veldfotos/c1/u1/1.jpg'), 'clubs/c1/veldfotos/u1/1.jpg'); is(L.bestandDoelNaam('clubs/c1/videos/a.mp4'), 'clubs/c1/videos/a.mp4');
class Ts { constructor(s){ this.s = s; } } class Ref { constructor(p){ this.path = p; } }
const zet = L.maakOmzetter({ uidMap: { oud: 'nieuw' }, bucketsVan: ['asv.firebasestorage.app', 'asv.appspot.com'], bucketNaar: 'doel-eu',
  soort: v => v instanceof Ts ? 'vast' : v instanceof Ref ? 'ref' : null, maakRef: p => new Ref('DOEL:' + p), padOpties: { clubId: 'c1', uidMap: { oud: 'nieuw' } } });
const t = new Ts(5);
const uit = zet({ leden: { oud: true, ander: true }, door: 'oud', tekst: 'oud is geen id hier', lijst: ['oud', 'x', { wie: 'oud' }], n: 3, b: false, leeg: null, tijd: t,
  url: 'https://firebasestorage.googleapis.com/v0/b/asv.firebasestorage.app/o/clubs%2Fc1%2Fvideos%2Fa.mp4?alt=media&token=t1',
  oudeUrl: 'https://firebasestorage.googleapis.com/v0/b/asv.appspot.com/o/x.pdf?alt=media&token=t2', gs: 'gs://asv.firebasestorage.app/clubs/c1/a.pdf',
  veld: 'veldfotos/c1/u9/2.jpg', veldUrl: 'https://firebasestorage.googleapis.com/v0/b/asv.firebasestorage.app/o/veldfotos%2Fc1%2Fu9%2F2.jpg?alt=media&token=t3',
  ref: new Ref('gebruikers/oud'), inhoud: new Ref('content/k1') });
is(uit.leden, { nieuw: true, ander: true }); is(uit.door, 'nieuw'); is(uit.tekst, 'oud is geen id hier', 'alleen een hele waarde wordt omgezet');
is(uit.lijst, ['nieuw', 'x', { wie: 'nieuw' }]); is([uit.n, uit.b, uit.leeg], [3, false, null]); ok(uit.tijd === t, 'Firestore-typen blijven ongemoeid');
is(uit.url, 'https://firebasestorage.googleapis.com/v0/b/doel-eu/o/clubs%2Fc1%2Fvideos%2Fa.mp4?alt=media&token=t1');
is(uit.oudeUrl, 'https://firebasestorage.googleapis.com/v0/b/doel-eu/o/x.pdf?alt=media&token=t2'); is(uit.gs, 'gs://doel-eu/clubs/c1/a.pdf');
is(uit.veld, 'clubs/c1/veldfotos/u9/2.jpg'); is(uit.veldUrl, 'https://firebasestorage.googleapis.com/v0/b/doel-eu/o/clubs%2Fc1%2Fveldfotos%2Fu9%2F2.jpg?alt=media&token=t3');
is(uit.ref.path, 'DOEL:gebruikers/nieuw'); is(uit.inhoud.path, 'DOEL:clubs/c1/content/k1');
const zonder = L.maakOmzetter({ bucketsVan: ['asv.firebasestorage.app'], bucketNaar: '' });
is(zonder({ url: 'https://x/v0/b/asv.firebasestorage.app/o/a' }).url, 'https://x/v0/b/asv.firebasestorage.app/o/a', 'zonder doel-bucket (proef) blijven de links naar de oude bucket wijzen');
const twee = L.maakOmzetter({ bucketsVan: ['asv.firebasestorage.app'], bucketNaar: 'doel-eu' });
is(twee(['v0/b/asv.firebasestorage.app/o/a', 'v0/b/asv.firebasestorage.app/o/b']), ['v0/b/doel-eu/o/a', 'v0/b/doel-eu/o/b'], 'ook de tweede keer (regex met g)');

/* ---- club ---- */
const sjabloon = JSON.parse(fs.readFileSync(new URL('../tools/verhuis-asv33/club-asv33.json', import.meta.url), 'utf8'));
let v = L.clubAanvulling({ naam: "ASV'33", leden: { a: true } }, sjabloon, [{ id: 't1', leden: { a: true, b: true, c: false } }]);
is(v.instellingen.v, 1); is(v.instellingen.identiteit.logo, 'icons/asv-schild.png'); is(v.instellingen.toegang.vasteCodes, true);
is(v['platformModules.ai'], true); is(v['platformModules.seizoensplan'], false); is(v['leden.b'], true); ok(!('leden.a' in v) && !('leden.c' in v));
v = L.clubAanvulling({ instellingen: { identiteit: { kleur: '#000000' } }, platformModules: { ai: false } }, sjabloon, []);
is(v.instellingen.identiteit.kleur, '#000000', 'wat de club al koos blijft'); is(v.instellingen.identiteit.afkorting, "ASV'33"); ok(!('platformModules.ai' in v));
v = L.clubAanvulling({ instellingen: { v: 1, toegang: { vasteCodes: false } }, platformModules: sjabloon.platformModules }, sjabloon, []);
is(v, { 'instellingen.toegang.vasteCodes': true }, 'vastgelegde instellingen blijven; alleen de oude codes gaan weer aan');
is(L.clubAanvulling({ instellingen: { v: 1, toegang: { vasteCodes: true } }, platformModules: sjabloon.platformModules }, sjabloon, []), {});
ok(fs.existsSync(new URL('../public/' + sjabloon.instellingen.identiteit.logo, import.meta.url)), 'het logo uit het sjabloon bestaat');

/* ---- vergelijken ---- */
is(L.vasteVorm({ b: 1, a: [1, { d: null, c: 'x' }] }), L.vasteVorm({ a: [1, { c: 'x', d: null }], b: 1 }), 'volgorde van sleutels telt niet');
ok(L.vasteVorm({ a: 1 }) !== L.vasteVorm({ a: '1' })); ok(L.vasteVorm([1, 2]) !== L.vasteVorm([2, 1]));
is(L.vasteVorm({ t: new Ts(5) }, x => x instanceof Ts ? 'ts:' + x.s : null), '{"t":ts:5}');

/* ---- proef-server ---- */
const cfg = P.leesConfig('const firebaseConfig = {\n  apiKey: "k1",\n  authDomain: "proef.firebaseapp.com",\n  projectId: "proef",\n  storageBucket: "proef.firebasestorage.app",\n  appId: "1:2:web:3"\n};');
is(cfg.projectId, 'proef'); is(P.leesConfig(JSON.stringify(cfg)), cfg, 'ook als JSON');
assert.throws(() => P.leesConfig('{ "apiKey": "k" }')); n++;
const fb = P.metProefConfig(fs.readFileSync(new URL('../public/js/firebase.js', import.meta.url), 'utf8'), cfg);
ok(fb.includes('"projectId": "proef"') && !fb.includes('projectId: "cluppie-ad329"') && fb.includes('export const STORAGE_BUCKET = "gs://proef.firebasestorage.app";'), 'js/firebase.js is nog om te zetten voor de proef');

console.log(`verhuis-asv33: ${n} controles geslaagd`);
