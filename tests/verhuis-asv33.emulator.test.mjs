// Verhuizing ASV'33 → cluppie.io, van begin tot eind tegen de emulators (Auth, Firestore, Storage).
// Draaien:  npm run test:verhuis   (Java nodig; eigen poorten, zie firebase.verhuis.json)
// Twee nagebootste projecten: demo-asv (bron) en demo-doel (doel). Vaste fictieve accounts.
// Wat de emulator NIET kan nabootsen: dat een overgezette wachtwoord-hash bij het inloggen klopt
// (de emulator rekent geen scrypt na). Dat test de proefverhuizing in een echt proefproject.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const HIER = path.dirname(fileURLToPath(import.meta.url)), WORTEL = path.join(HIER, '..');
const require = createRequire(path.join(WORTEL, 'functions', 'package.json'));
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

const BRON = 'demo-asv', DOEL = 'demo-doel', BUCKET_BRON = `${BRON}.firebasestorage.app`, BUCKET_DOEL = 'demo-doel-eu';
const STAAT = path.join(WORTEL, '.verhuis', `asv33-${DOEL}.json`);
const bron = admin.initializeApp({ projectId: BRON }, 'test-bron'), doel = admin.initializeApp({ projectId: DOEL }, 'test-doel');
const bdb = getFirestore(bron), ddb = getFirestore(doel);
const CLUB = 'clubAsv', URL_OUD = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_BRON}/o/clubs%2F${CLUB}%2Ftrainingen%2Fm1%2Fweek47.pdf?alt=media&token=tok-123`;

function draai(opdracht, ...extra){
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'tools', 'verhuis-asv33.mjs'), opdracht, `--van=${BRON}`, `--naar=${DOEL}`, `--bucket=${BUCKET_DOEL}`, ...extra], { encoding: 'utf8', env: process.env });
  return { code: r.status, uit: (r.stdout || '') + (r.stderr || '') };
}

before(async () => {
  fs.rmSync(STAAT, { force: true });
  /* ---- bron: ASV'33 ---- */
  const a = getAuth(bron);
  await a.createUser({ uid: 'uTrainer', email: 'trainer@voorbeeld.test', password: 'geheim123', displayName: 'Tessa Trainer', emailVerified: true });
  await a.createUser({ uid: 'uBeheer', email: 'beheer@voorbeeld.test', password: 'geheim456', displayName: 'Bram Beheer' });
  await a.importUsers([{ uid: 'uGoogle', email: 'google@voorbeeld.test', displayName: 'Gijs Google', emailVerified: true,
    providerData: [{ uid: 'g-1001', providerId: 'google.com', email: 'google@voorbeeld.test', displayName: 'Gijs Google' }] }]);
  await a.createUser({ uid: 'uDubbel', email: 'dubbel@voorbeeld.test', password: 'geheim789', displayName: 'Daan Dubbel' });
  await a.createUser({ uid: 'uAnoniem' });                                           // ouder op een deellink
  await bdb.doc(`clubs/${CLUB}`).set({ naam: "ASV'33", code: 'ASV33X', admins: { uBeheer: true, uDubbel: true }, leden: { uBeheer: true, uDubbel: true },
    adminsInfo: { uDubbel: { naam: 'Daan Dubbel' } }, teams: { t1: true }, gemaakt: Timestamp.fromDate(new Date('2026-08-01')), sportlinkClientId: 'abc123XYZ' });
  await bdb.doc(`clubs/${CLUB}/geheim/_sportlink`).set({ teams: [{ code: '1', naam: 'JO11-1' }] });
  await bdb.doc('clubs/clubTest').set({ naam: 'Testclub', code: 'TEST01', admins: { uBeheer: true }, leden: { uBeheer: true } });
  await bdb.doc('teams/t1').set({ naam: 'JO11-1', club: CLUB, code: 'T1CODE', leden: { uTrainer: true, uDubbel: true, uGoogle: true }, rollen: { uTrainer: 'coach' }, gemaaktDoor: 'uDubbel' });
  await bdb.doc('teams/t1/spelers/s1').set({ naam: 'Speler Een', nummer: 7 });
  await bdb.doc('teams/t1/wedstrijden/sl_100').set({ datum: '2026-11-21', tegenstander: 'Tegenstander', aftrap: Timestamp.fromDate(new Date('2026-11-21T10:00:00Z')) });
  await bdb.doc('teams/t1/veldmeldingen/v1').set({ door: 'uDubbel', path: `veldfotos/${CLUB}/uDubbel/1.jpg`,
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET_BRON}/o/veldfotos%2F${CLUB}%2FuDubbel%2F1.jpg?alt=media&token=tok-veld` });
  await bdb.doc('trainingen/tr1').set({ club: CLUB, titel: 'Week 47 - training 1', teams: ['t1'], path: `clubs/${CLUB}/trainingen/m1/week47.pdf`, url: URL_OUD, teamRef: bdb.doc('teams/t1') });
  await bdb.doc('trainingen/tr1/notities/uDubbel').set({ tekst: 'ging goed' });      // document-id = account-id
  await bdb.doc('content/kompas1').set({ categorie: 'kompas', titel: 'Plezier voorop', status: 'gepubliceerd' });
  await bdb.doc('gebruikers/uTrainer').set({ naam: 'Tessa Trainer' });
  await bdb.doc('gebruikers/uTrainer/gelezen/tr1').set({ tijd: Timestamp.now() });
  await bdb.doc('gebruikers/uDubbel').set({ naam: 'Daan uit ASV' });
  await bdb.doc('gebruikers/uDubbel/gelezen/tr1').set({ tijd: Timestamp.now() });
  await bdb.doc('gebruikers/uAnoniem').set({ naam: '' });
  await bdb.doc('gebruikers/uLeeg/gelezen/tr1').set({ tijd: Timestamp.now() });      // 'leeg' ouderdocument
  await bdb.doc('trainingToegang/uAnoniem').set({ trainingId: 'tr1' });
  await bdb.doc('iets_onbekends/x').set({ a: 1 });
  const bb = getStorage(bron).bucket(BUCKET_BRON);
  await bb.file(`clubs/${CLUB}/trainingen/m1/week47.pdf`).save(Buffer.from('%PDF-proef'), { contentType: 'application/pdf', metadata: { metadata: { firebaseStorageDownloadTokens: 'tok-123' } } });
  await bb.file(`veldfotos/${CLUB}/uDubbel/1.jpg`).save(Buffer.from('jpg'), { contentType: 'image/jpeg', metadata: { metadata: { firebaseStorageDownloadTokens: 'tok-veld' } } });
  /* ---- doel: cluppie.io met een andere club en een account dat al bestaat ---- */
  await getAuth(doel).createUser({ uid: 'uBestaand', email: 'dubbel@voorbeeld.test', password: 'cluppie-ww', displayName: 'Daan Dubbel' });
  await getAuth(doel).createUser({ uid: 'uAnder', email: 'ander@voorbeeld.test', password: 'iets12345' });
  await ddb.doc('clubs/clubAnder').set({ naam: 'FC Ander', code: 'TEST01', admins: { uAnder: true }, leden: { uAnder: true } });
  await ddb.doc('gebruikers/uBestaand').set({ naam: 'Daan op cluppie.io' });
  await ddb.doc('content/standaard1').set({ categorie: 'kompas', titel: 'Cluppie-standaard' });
  await getStorage(doel).bucket(BUCKET_DOEL).file('clubs/clubAnder/documenten/x.pdf').save(Buffer.from('x'));
});
after(async () => { fs.rmSync(STAAT, { force: true }); await Promise.all([bron.delete(), doel.delete()]); });

test('zonder voorcontrole weigeren de schrijvende stappen', () => {
  const r = draai('gegevens');
  assert.notEqual(r.code, 0); assert.match(r.uit, /voorcontrole/);
});

test('voorcontrole: telt, vindt het dubbele account en de dubbele code, schrijft niets', async () => {
  const r = draai('voorcontrole');
  assert.equal(r.code, 0, r.uit);
  assert.match(r.uit, /anoniem \(gaan niet mee\)\s+1/);
  assert.match(r.uit, /nieuw over te zetten\s+3/);
  assert.match(r.uit, /Daan Dubbel <dubbel@voorbeeld\.test>: e-mailadres bestaat al/);
  assert.match(r.uit, /clubs-code TEST01 is in demo-doel al in gebruik/);
  assert.match(r.uit, /"iets_onbekends" kent het script niet/);
  assert.match(r.uit, /hoofdclub/);
  const s = JSON.parse(fs.readFileSync(STAAT, 'utf8'));
  assert.deepEqual(s.uidMap, { uDubbel: 'uBestaand' });
  assert.equal(s.clubId, CLUB);
  assert.deepEqual(s.overslaan, ['gebruikers/uBestaand'], 'het bestaande profiel wordt niet overschreven');
  assert.equal((await ddb.collection('teams').get()).size, 0, 'de voorcontrole schrijft niets in het doel');
  assert.equal((await getAuth(doel).listUsers()).users.length, 2);
});

test('droog: schrijft niets', async () => {
  for (const stap of ['accounts', 'gegevens', 'bestanden']){ const r = draai(stap, '--droog'); assert.equal(r.code, 0, r.uit); }
  assert.equal((await getAuth(doel).listUsers()).users.length, 2);
  assert.equal((await ddb.collection('teams').get()).size, 0);
  assert.equal(JSON.parse(fs.readFileSync(STAAT, 'utf8')).gegevensGestart, false);
});

test('accounts: zelfde id, e-mail, naam, Google-koppeling; anoniem en dubbel niet', async () => {
  const r = draai('accounts');
  assert.equal(r.code, 0, r.uit);
  const a = getAuth(doel);
  const t = await a.getUser('uTrainer');
  assert.equal(t.email, 'trainer@voorbeeld.test'); assert.equal(t.displayName, 'Tessa Trainer'); assert.equal(t.emailVerified, true);
  assert.ok(t.passwordHash, 'de wachtwoord-hash is mee');
  const g = await a.getUser('uGoogle');
  assert.deepEqual(g.providerData.map(p => [p.providerId, p.uid]), [['google.com', 'g-1001']]);
  await assert.rejects(a.getUser('uAnoniem')); await assert.rejects(a.getUser('uDubbel'));
  assert.equal((await a.getUserByEmail('dubbel@voorbeeld.test')).uid, 'uBestaand', 'het bestaande account blijft');
  const nog = draai('accounts'); assert.equal(nog.code, 0, 'opnieuw draaien mag: ' + nog.uit);
  assert.equal((await a.listUsers()).users.length, 5);
});

test('gegevens: zelfde paden en id\'s, dubbel account omgezet, links naar de nieuwe bucket, content naar de club', async () => {
  const r = draai('gegevens');
  assert.equal(r.code, 0, r.uit);
  const team = (await ddb.doc('teams/t1').get()).data();
  assert.deepEqual(team.leden, { uTrainer: true, uBestaand: true, uGoogle: true });
  assert.equal(team.gemaaktDoor, 'uBestaand'); assert.equal(team.code, 'T1CODE'); assert.equal(team.club, CLUB);
  const club = (await ddb.doc(`clubs/${CLUB}`).get()).data();
  assert.deepEqual(club.admins, { uBeheer: true, uBestaand: true }); assert.deepEqual(club.adminsInfo, { uBestaand: { naam: 'Daan Dubbel' } });
  assert.equal(club.sportlinkClientId, 'abc123XYZ'); assert.ok(club.gemaakt instanceof Timestamp);
  assert.ok((await ddb.doc(`clubs/${CLUB}/geheim/_sportlink`).get()).exists);
  assert.ok((await ddb.doc('clubs/clubTest').get()).exists, 'ook de andere clubs uit de bron gaan mee');
  assert.equal((await ddb.doc('teams/t1/spelers/s1').get()).data().nummer, 7);
  assert.ok((await ddb.doc('teams/t1/wedstrijden/sl_100').get()).data().aftrap instanceof Timestamp);
  const tr = (await ddb.doc('trainingen/tr1').get()).data();
  assert.equal(tr.url, URL_OUD.replace(BUCKET_BRON, BUCKET_DOEL)); assert.equal(tr.path, `clubs/${CLUB}/trainingen/m1/week47.pdf`);
  assert.equal(tr.teamRef.path, 'teams/t1'); assert.equal(tr.teamRef.firestore.projectId, DOEL);
  assert.ok((await ddb.doc('trainingen/tr1/notities/uBestaand').get()).exists, 'document-id van het dubbele account is omgezet');
  const veld = (await ddb.doc('teams/t1/veldmeldingen/v1').get()).data();
  assert.equal(veld.path, `clubs/${CLUB}/veldfotos/uDubbel/1.jpg`); assert.equal(veld.door, 'uBestaand');
  assert.match(veld.url, new RegExp(`/b/${BUCKET_DOEL}/o/clubs%2F${CLUB}%2Fveldfotos%2FuDubbel%2F1\\.jpg\\?alt=media&token=tok-veld$`));
  assert.ok((await ddb.doc(`clubs/${CLUB}/content/kompas1`).get()).exists, 'eigen inhoud staat bij de club');
  assert.ok(!(await ddb.doc('content/kompas1').get()).exists, 'en niet in de gedeelde Cluppie-standaard');
  assert.ok((await ddb.doc('content/standaard1').get()).exists);
  assert.equal((await ddb.doc('gebruikers/uBestaand').get()).data().naam, 'Daan op cluppie.io', 'bestaand profiel niet overschreven');
  assert.ok((await ddb.doc('gebruikers/uBestaand/gelezen/tr1').get()).exists, 'maar wat eronder hangt komt erbij');
  assert.ok((await ddb.doc('gebruikers/uLeeg/gelezen/tr1').get()).exists, 'subcollectie onder een leeg document');
  assert.ok(!(await ddb.doc('gebruikers/uAnoniem').get()).exists); assert.ok(!(await ddb.doc('trainingToegang/uAnoniem').get()).exists);
  assert.ok(!(await ddb.doc('iets_onbekends/x').get()).exists);
  assert.equal((await ddb.doc('clubs/clubAnder').get()).data().naam, 'FC Ander', 'bestaande clubs in het doel blijven ongemoeid');
});

test('bestanden: zelfde pad en download-token, veldfoto\'s onder clubs/', async () => {
  const r = draai('bestanden');
  assert.equal(r.code, 0, r.uit);
  const d = getStorage(doel).bucket(BUCKET_DOEL);
  const [pdf] = await d.file(`clubs/${CLUB}/trainingen/m1/week47.pdf`).download();
  assert.equal(pdf.toString(), '%PDF-proef');
  const [meta] = await d.file(`clubs/${CLUB}/trainingen/m1/week47.pdf`).getMetadata();
  assert.equal(meta.metadata.firebaseStorageDownloadTokens, 'tok-123'); assert.equal(meta.contentType, 'application/pdf');
  assert.ok((await d.file(`clubs/${CLUB}/veldfotos/uDubbel/1.jpg`).exists())[0]);
  assert.ok((await d.file('clubs/clubAnder/documenten/x.pdf').exists())[0]);
  assert.match(draai('bestanden').uit, /0 gekopieerd, 2 stonden er al/);
});

test('controle: gelijk; na een wijziging in de bron niet meer, na een nieuwe kopie weer wel', async () => {
  let r = draai('controle');
  assert.equal(r.code, 0, r.uit); assert.match(r.uit, /Gelijk: alles uit demo-asv staat in demo-doel/);
  await bdb.doc('teams/t1/spelers/s2').set({ naam: 'Speler Twee' });
  await bdb.doc('teams/t1/spelers/s1').update({ nummer: 8 });
  r = draai('controle');
  assert.equal(r.code, 2); assert.match(r.uit, /ontbreekt: teams\/t1\/spelers\/s2/); assert.match(r.uit, /wijkt af: teams\/t1\/spelers\/s1/);
  assert.equal(draai('gegevens').code, 0);
  assert.equal(draai('controle').code, 0);
});

test('club: instellingen, onderdelen en clubleden; daarna weigert gegevens een nieuwe kopie', async () => {
  const r = draai('club');
  assert.equal(r.code, 0, r.uit);
  const club = (await ddb.doc(`clubs/${CLUB}`).get()).data();
  assert.equal(club.instellingen.v, 1); assert.equal(club.instellingen.identiteit.logo, 'icons/asv-schild.png');
  assert.equal(club.instellingen.toegang.vasteCodes, true);
  assert.equal(club.platformModules.ai, true); assert.equal(club.platformModules.seizoensplan, false);
  assert.deepEqual(club.leden, { uBeheer: true, uBestaand: true, uTrainer: true, uGoogle: true });
  assert.equal(club.verhuisd.van, BRON);
  assert.equal(club.naam, "ASV'33"); assert.equal(club.sportlinkClientId, 'abc123XYZ');
  const nog = draai('gegevens');
  assert.notEqual(nog.code, 0); assert.match(nog.uit, /al afgerond/);
  assert.equal(draai('controle').code, 0, 'de controle blijft gelijk na het aanvullen van de club');
  assert.equal(draai('club').code, 0, 'opnieuw draaien verandert niets');
  assert.deepEqual((await ddb.doc(`clubs/${CLUB}`).get()).data().instellingen, club.instellingen);
});

test('het echte project vraagt om --echt', () => {
  const r = spawnSync(process.execPath, [path.join(WORTEL, 'tools', 'verhuis-asv33.mjs'), 'gegevens', '--naar=cluppie-ad329'], { encoding: 'utf8', env: process.env });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /--echt/);
});
