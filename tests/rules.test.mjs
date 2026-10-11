// Firestore-rules testen tegen de emulator.
// Draaien (vanuit de repo-root, Java nodig):  npm run test:rules
// Dat start de Firestore-emulator, draait dit bestand en stopt de emulator weer.
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, Timestamp, deleteDoc } from 'firebase/firestore';

let env;
const PLATFORM = { email: 'pclijten@gmail.com', email_verified: true };
const nu = Date.now();
const morgen = Timestamp.fromMillis(nu + 86400000), gisteren = Timestamp.fromMillis(nu - 86400000), volgendJaar = Timestamp.fromMillis(nu + 365 * 86400000);

const als = (uid, extra = {}) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' }, ...extra }).firestore();
const anoniem = uid => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const gast = () => env.unauthenticatedContext().firestore();

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'cluppie-rules-test',
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    // Club A: admin, coach (lid), coördinator onderbouw. Club B: andere club.
    await setDoc(doc(db, 'clubs/A'), { naam: 'Club A', admins: { adminA: true }, leden: { adminA: true, coachA: true, coordA: true },
      bouwCoordinatoren: { onder: { coordA: true } }, teams: { t1: true } });
    await setDoc(doc(db, 'clubs/B'), { naam: 'Club B', admins: { adminB: true }, leden: { adminB: true, coachB: true }, teams: { tB: true } });
    await setDoc(doc(db, 'teams/t1'), { club: 'A', naam: 'JO11-1', bouw: 'onder', leden: { coachA: true }, code: 'AJO111' });
    await setDoc(doc(db, 'teams/t2'), { club: 'A', naam: 'JO17-1', bouw: 'boven', leden: { coach2: true } });
    await setDoc(doc(db, 'teams/tB'), { club: 'B', naam: 'JO11-1', leden: { coachB: true } });
    await setDoc(doc(db, 'teams/t1/spelers/s1'), { naam: 'Speler', nr: 7 });
    await setDoc(doc(db, 'teams/t1/beoordelingen/b1'), { score: 3 });
    await setDoc(doc(db, 'clubs/A/geheim/_sportlink'), { teams: [] });
    await setDoc(doc(db, 'trainingen/tr1'), { club: 'A', titel: 'Passen' });
    await setDoc(doc(db, 'trainingDeel/d1'), { teamId: 't1', trainingId: 'tr1', vervaltOp: morgen, gemaaktDoor: 'coachA' });
    await setDoc(doc(db, 'trainingDeel/dOud'), { teamId: 't1', trainingId: 'tr1', vervaltOp: gisteren, gemaaktDoor: 'coachA' });
    await setDoc(doc(db, 'gebruikstats/A'), { lezers: ['adminA', 'coordA'], bron: {} });
  });
});

/* ---------- clubs ---------- */
test('club aanmaken: alleen platformbeheerder', async () => {
  const data = u => ({ naam: 'Nieuw', admins: { [u]: true }, leden: { [u]: true } });
  await assertFails(setDoc(doc(als('coachA'), 'clubs/N1'), data('coachA')));
  await assertSucceeds(setDoc(doc(als('paul', PLATFORM), 'clubs/N2'), data('paul')));
});
test('club lezen: alleen eigen club', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'clubs/A')));
  await assertFails(getDoc(doc(als('coachA'), 'clubs/B')));
  await assertFails(getDoc(doc(gast(), 'clubs/A')));
});
test('clubinstellingen wijzigen: alleen clubadmin', async () => {
  await assertSucceeds(updateDoc(doc(als('adminA'), 'clubs/A'), { 'instellingen.identiteit.kleur': '#123456' }));
  await assertFails(updateDoc(doc(als('coachA'), 'clubs/A'), { 'instellingen.identiteit.kleur': '#123456' }));
  await assertFails(updateDoc(doc(als('adminB'), 'clubs/A'), { naam: 'Gekaapt' }));
});
test('coach registreert nieuw team bij club (alleen veld teams)', async () => {
  await assertSucceeds(updateDoc(doc(als('coachA'), 'clubs/A'), { 'teams.t9': true }));
  await assertFails(updateDoc(doc(als('coachA'), 'clubs/A'), { 'teams.t9': true, naam: 'x' }));
});

/* ---------- teams ---------- */
test('nieuw team in eigen club, niet in andere club', async () => {
  await assertSucceeds(setDoc(doc(als('coachA'), 'teams/n1'), { club: 'A', naam: 'JO9-1', leden: { coachA: true } }));
  await assertFails(setDoc(doc(als('coachA'), 'teams/n2'), { club: 'B', naam: 'JO9-1', leden: { coachA: true } }));
});
test('team zoeken op teamcode lukt niet voor buitenstaanders (aansluiten loopt via sluitAan)', async () => {
  await assertFails(getDocs(query(collection(als('vreemde'), 'teams'), where('code', '==', 'AJO111'))));
});
test('teams van eigen club lezen via club-filter; andere club niet', async () => {
  await assertSucceeds(getDocs(query(collection(als('coachA'), 'teams'), where('club', '==', 'A'))));
  await assertFails(getDocs(query(collection(als('coachA'), 'teams'), where('club', '==', 'B'))));
});
test('beoordelingen: teamlid en coördinator van de bouw wel, andere coach van club niet', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'teams/t1/beoordelingen/b1')));
  await assertSucceeds(getDoc(doc(als('coordA'), 'teams/t1/beoordelingen/b1')));
  await assertSucceeds(getDoc(doc(als('adminA'), 'teams/t1/beoordelingen/b1')));
  await assertFails(getDoc(doc(als('coach2'), 'teams/t1/beoordelingen/b1')));
  await assertFails(getDoc(doc(als('adminB'), 'teams/t1/beoordelingen/b1')));
});
test('spelerslijst: leesbaar voor clubleden (uitleen), niet voor andere club', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'teams/t1/spelers/s1')));
  await assertFails(getDoc(doc(als('coachB'), 'teams/t1/spelers/s1')));
});

test('clubbeheerder maakt team aan zonder zelf lid te worden; coach niet', async () => {
  await assertSucceeds(setDoc(doc(als('adminA'), 'teams/imp1'), { club: 'A', naam: 'JO9-2', leden: {} }));
  await assertFails(setDoc(doc(als('coachA'), 'teams/imp2'), { club: 'A', naam: 'JO9-3', leden: {} }));
  await assertFails(setDoc(doc(als('adminB'), 'teams/imp3'), { club: 'A', naam: 'JO9-4', leden: {} }));
});

/* ---------- uitleningen ---------- */
test('uitlening: lid van de club wel, ander niet', async () => {
  await assertSucceeds(setDoc(doc(als('coachA'), 'clubs/A/uitleningen/u1'), { speler: 's1', van: 't1', naar: 't2' }));
  await assertFails(setDoc(doc(als('coachB'), 'clubs/A/uitleningen/u2'), { speler: 's1' }));
});

/* ---------- Sportlink-geheim ---------- */
test('Sportlink-teamlijst: alleen clubadmin', async () => {
  await assertSucceeds(getDoc(doc(als('adminA'), 'clubs/A/geheim/_sportlink')));
  await assertFails(getDoc(doc(als('coachA'), 'clubs/A/geheim/_sportlink')));
});

/* ---------- deel-link (anoniem) ---------- */
test('deel-link: geldige link geeft toegang tot training en spelers, niet tot beoordelingen', async () => {
  const db = anoniem('ouder1');
  await assertSucceeds(setDoc(doc(db, 'trainingToegang/ouder1'), { deelId: 'd1', teamId: 't1', trainingId: 'tr1', vervaltOp: morgen }));
  await assertSucceeds(getDoc(doc(db, 'trainingen/tr1')));
  await assertSucceeds(getDoc(doc(db, 'teams/t1/spelers/s1')));
  await assertFails(getDoc(doc(db, 'teams/t1/beoordelingen/b1')));
});
test('deel-link: verlopen link of zelf verlengde vervaldatum geweigerd', async () => {
  await assertFails(setDoc(doc(anoniem('ouder2'), 'trainingToegang/ouder2'), { deelId: 'dOud', teamId: 't1', trainingId: 'tr1', vervaltOp: gisteren }));
  await assertFails(setDoc(doc(anoniem('ouder3'), 'trainingToegang/ouder3'), { deelId: 'd1', teamId: 't1', trainingId: 'tr1', vervaltOp: volgendJaar }));
  await assertFails(setDoc(doc(anoniem('ouder4'), 'trainingToegang/ouder4'), { deelId: 'd1', teamId: 'tB', trainingId: 'tr1', vervaltOp: morgen }));
});

/* ---------- statistiek ---------- */
test('gebruikstats: admin en coördinator (lezers) wel, coach niet', async () => {
  await assertSucceeds(getDoc(doc(als('adminA'), 'gebruikstats/A')));
  await assertSucceeds(getDoc(doc(als('coordA'), 'gebruikstats/A')));
  await assertFails(getDoc(doc(als('coachA'), 'gebruikstats/A')));
  await assertFails(setDoc(doc(als('adminA'), 'gebruikstats/A'), { x: 1 }));
});
test('gebruik-teller: alleen eigen document', async () => {
  await assertSucceeds(setDoc(doc(als('coachA'), 'gebruik/coachA_2026-10-11'), { uid: 'coachA', clubId: 'A', datum: '2026-10-11' }));
  await assertFails(setDoc(doc(als('coachA'), 'gebruik/coachB_2026-10-11'), { uid: 'coachB', clubId: 'A', datum: '2026-10-11' }));
});
test('platformstats en clubaanmeldingen: alleen platformbeheerder', async () => {
  await assertFails(getDoc(doc(als('adminA'), 'platformstats/overzicht')));
  await assertSucceeds(getDoc(doc(als('paul', PLATFORM), 'platformstats/overzicht')));
  await assertFails(getDocs(collection(als('adminA'), 'clubAanmeldingen')));
  await assertSucceeds(getDoc(doc(als('nieuweling'), 'clubAanmeldingen/nieuweling')));
  await assertFails(getDoc(doc(als('nieuweling'), 'clubAanmeldingen/iemandAnders')));
  await assertFails(setDoc(doc(als('nieuweling'), 'clubAanmeldingen/nieuweling'), { status: 'goedgekeurd' }));
  await assertSucceeds(getDocs(collection(als('paul', PLATFORM), 'clubAanmeldingen')));
});
test('sjabloon: alleen eigen club publiceren, iedereen lezen', async () => {
  await assertSucceeds(setDoc(doc(als('adminA'), 'sjablonen/A'), { clubId: 'A', titel: 'Opzet A', instellingen: {} }));
  await assertFails(setDoc(doc(als('adminA'), 'sjablonen/B'), { clubId: 'B', titel: 'Nep', instellingen: {} }));
  await assertFails(setDoc(doc(als('coachA'), 'sjablonen/A'), { clubId: 'A', titel: 'x', instellingen: {} }));
  await assertSucceeds(getDoc(doc(als('coachB'), 'sjablonen/A')));
});
test('club-inhoud: training van andere club niet zichtbaar', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'trainingen/tr1')));
  await assertFails(getDoc(doc(als('coachB'), 'trainingen/tr1')));
  await assertFails(deleteDoc(doc(als('coachB'), 'trainingen/tr1')));
});
