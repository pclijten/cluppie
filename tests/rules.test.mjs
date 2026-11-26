// Firestore-rules testen tegen de emulator.
// Draaien (vanuit de repo-root, Java nodig):  npm run test:rules
// Dat start de Firestore-emulator, draait dit bestand en stopt de emulator weer.
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, Timestamp, deleteDoc, deleteField, documentId } from 'firebase/firestore';

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
test('clubgids: ingelogd lezen, niemand schrijven', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'clubgids/XXTT12Z'), { naam: 'VV Voorbeeld', accommodatie: 'Sportpark De Hoef' }));
  await assertSucceeds(getDoc(doc(als('coachA'), 'clubgids/XXTT12Z')));
  await assertFails(getDoc(doc(gast(), 'clubgids/XXTT12Z')));
  await assertFails(setDoc(doc(als('coachA'), 'clubgids/XXTT12Z'), { naam: 'Gekaapt' }));
  await assertFails(setDoc(doc(als('paul', PLATFORM), 'clubgids/NIEUW01'), { naam: 'X' }));
});
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
  /* andere waarde dan hierboven: dezelfde waarde nog eens schrijven is geen wijziging en mag de rule terecht doorlaten */
  await assertFails(updateDoc(doc(als('coachA'), 'clubs/A'), { 'instellingen.identiteit.kleur': '#654321' }));
  await assertFails(updateDoc(doc(als('adminB'), 'clubs/A'), { naam: 'Gekaapt' }));
});
test('platformModules (onderdelen aan/uit): alleen de eindbaas, niet de clubadmin', async () => {
  await assertFails(updateDoc(doc(als('adminA'), 'clubs/A'), { 'platformModules.trainingsmodule': true }));
  await assertFails(updateDoc(doc(als('adminA'), 'clubs/A'), { platformModules: { seizoensplan: true } }));
  await assertSucceeds(updateDoc(doc(als('paul', PLATFORM), 'clubs/A'), { 'platformModules.trainingsmodule': true }));
  /* daarna kan de clubadmin gewoon andere velden blijven wijzigen */
  await assertSucceeds(updateDoc(doc(als('adminA'), 'clubs/A'), { 'instellingen.identiteit.kleur': '#abcdef' }));
  await assertFails(updateDoc(doc(als('adminA'), 'clubs/A'), { 'platformModules.trainingsmodule': false }));
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
/* [20261012i] Een 'in'-query met een verwijderd team faalt in de rules-engine ('resource == null'
   is bij list-queries niet te evalueren). Dat is geen probleem: teamsOpId (teams-ophalen.js) valt bij
   permission-denied terug op losse getDoc's, en die moeten dan wél lukken. Dat testen we hier. */
test('club.teams met een verwijderd team: losse get op het verwijderde team lukt (fallback teamsOpId)', async () => {
  await assertSucceeds(getDoc(doc(als('adminA'), 'teams/weg')));
  await assertSucceeds(getDoc(doc(als('adminA'), 'teams/t1')));
});
test('club.teams: in-query op bestaande eigen teams lukt, met een team van een andere club niet', async () => {
  await assertSucceeds(getDocs(query(collection(als('adminA'), 'teams'), where(documentId(), 'in', ['t1', 't2']))));
  await assertFails(getDocs(query(collection(als('adminA'), 'teams'), where(documentId(), 'in', ['t1', 'tB']))));
});
test('beoordelingen: teamlid en coördinator van de bouw wel, andere coach van club niet', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'teams/t1/beoordelingen/b1')));
  await assertSucceeds(getDoc(doc(als('coordA'), 'teams/t1/beoordelingen/b1')));
  await assertSucceeds(getDoc(doc(als('adminA'), 'teams/t1/beoordelingen/b1')));
  await assertFails(getDoc(doc(als('coach2'), 'teams/t1/beoordelingen/b1')));
  await assertFails(getDoc(doc(als('adminB'), 'teams/t1/beoordelingen/b1')));
});
test('spelerslijst: eigen team en sturende rollen van de club, geen andere coach en geen andere club', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'teams/t1/spelers/s1')));
  await assertSucceeds(getDocs(collection(als('coachA'), 'teams/t1/spelers')));
  await assertSucceeds(getDoc(doc(als('adminA'), 'teams/t1/spelers/s1')));
  await assertSucceeds(getDoc(doc(als('coordA'), 'teams/t1/spelers/s1')));
  /* [20261115e] een coach van een ander team van dezelfde club leest geen spelerdocumenten meer (notitie, leerpunten) */
  await assertFails(getDoc(doc(als('coach2'), 'teams/t1/spelers/s1')));
  await assertFails(getDoc(doc(als('coachB'), 'teams/t1/spelers/s1')));
});

test('clubbeheerder maakt team aan zonder zelf lid te worden; coach niet', async () => {
  await assertSucceeds(setDoc(doc(als('adminA'), 'teams/imp1'), { club: 'A', naam: 'JO9-2', leden: {} }));
  await assertFails(setDoc(doc(als('coachA'), 'teams/imp2'), { club: 'A', naam: 'JO9-3', leden: {} }));
  await assertFails(setDoc(doc(als('adminB'), 'teams/imp3'), { club: 'A', naam: 'JO9-4', leden: {} }));
});

/* ---------- uitleningen ---------- */
test('uitlening: aanmaken door clubadmin of bouwcoördinator, niet door een coach of een andere club', async () => {
  const data = { spelerId: 's1', vanTeam: 't1', naarTeam: 't2' };
  await assertSucceeds(setDoc(doc(als('adminA'), 'clubs/A/uitleningen/u1'), data));
  await assertSucceeds(setDoc(doc(als('coordA'), 'clubs/A/uitleningen/u2'), data));        /* t1 zit in zijn bouw */
  await assertFails(setDoc(doc(als('coachA'), 'clubs/A/uitleningen/u3'), data));           /* [20261115d] coach leent niet zelf uit */
  await assertFails(setDoc(doc(als('coachB'), 'clubs/A/uitleningen/u4'), data));
  await assertFails(setDoc(doc(als('adminA'), 'clubs/A/uitleningen/u5'), { spelerId: 's1', vanTeam: 't1', naarTeam: 'tB' }));   /* team van een andere club */
  /* de coach van een betrokken team werkt de uitlening bij en zet terug; een andere coach niet */
  await assertSucceeds(updateDoc(doc(als('coach2'), 'clubs/A/uitleningen/u1'), { 'overlay.nummer': 9 }));
  await assertFails(updateDoc(doc(als('coach2'), 'clubs/A/uitleningen/u1'), { naarTeam: 't1' }));
  await assertFails(deleteDoc(doc(als('coachB'), 'clubs/A/uitleningen/u1')));
  await assertSucceeds(deleteDoc(doc(als('coachA'), 'clubs/A/uitleningen/u1')));
});

/* ---------- Sportlink-geheim ---------- */
test('Sportlink-teamlijst: alleen clubadmin', async () => {
  await assertSucceeds(getDoc(doc(als('adminA'), 'clubs/A/geheim/_sportlink')));
  await assertFails(getDoc(doc(als('coachA'), 'clubs/A/geheim/_sportlink')));
});

/* ---------- deel-link (anoniem) ---------- */
test('deel-link: geldige link geeft toegang tot de training en de link zelf, niet tot spelers, team of beoordelingen', async () => {
  const db = anoniem('ouder1');
  await assertSucceeds(setDoc(doc(db, 'trainingToegang/ouder1'), { deelId: 'd1', teamId: 't1', trainingId: 'tr1', vervaltOp: morgen }));
  await assertSucceeds(getDoc(doc(db, 'trainingen/tr1')));
  await assertSucceeds(getDoc(doc(db, 'trainingDeel/d1')));
  /* [20261115d] naam en nummer staan op de link; spelerdocumenten (met notitie en leerpunten) en het teamdocument niet meer */
  await assertFails(getDoc(doc(db, 'teams/t1/spelers/s1')));
  await assertFails(getDoc(doc(db, 'teams/t1')));
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
/* [20261120b] clubprofiel: wat de eindbaas uit de documenten van een club haalt; de club zelf leest het niet */
test('clubprofiel: alleen de platformbeheerder leest en schrijft, de clubbeheerder niet', async () => {
  const profiel = { v: 1, clubId: 'A', bevindingen: { b1: { veld: 'bouw.indeling', waarde: 'Drie bouwen', oordeel: 'open' } } };
  await assertSucceeds(setDoc(doc(als('paul', PLATFORM), 'clubprofielen/A'), profiel));
  await assertSucceeds(getDoc(doc(als('paul', PLATFORM), 'clubprofielen/A')));
  await assertSucceeds(updateDoc(doc(als('paul', PLATFORM), 'clubprofielen/A'), { 'bevindingen.b1': deleteField() }));
  await assertFails(getDoc(doc(als('adminA'), 'clubprofielen/A')));
  await assertFails(setDoc(doc(als('adminA'), 'clubprofielen/A'), profiel));
  await assertFails(getDoc(doc(als('coachA'), 'clubprofielen/A')));
  await assertFails(getDoc(doc(als('paul', { email: PLATFORM.email, email_verified: false }), 'clubprofielen/A')));
  await assertFails(getDoc(doc(gast(), 'clubprofielen/A')));
});
/* [20261120d] goedkeuren en in Cluppie zetten: de eindbaas schrijft instellingen en clubteksten, en wat gezet is
   (met de paden van de instellingen als sleutel) komt ongeschonden terug */
test('clubprofiel: de platformbeheerder zet instellingen en Clubwijzer-teksten bij de club', async () => {
  const assert = (await import('node:assert/strict')).default;
  const baas = als('paul', PLATFORM);
  await setDoc(doc(baas, 'clubprofielen/A'), { v: 2, clubId: 'A', bevindingen: { b2: { veld: 'bouw.grenzen', waarde: 'Onderbouw t/m O10', oordeel: 'open' } } });
  await assertSucceeds(updateDoc(doc(baas, 'clubs/A'), { 'instellingen.regels.bouwGrenzen.onderTm': 10 }));
  await assertSucceeds(setDoc(doc(baas, 'clubs/A/content/afspraak-wed-speeltijd'), { categorie: 'afspraak', hoofdstuk: 'wedstrijd', titel: 'Speeltijd', achtergrond: 'Iedereen speelt minstens de helft.', status: 'concept', bron: 'clubprofiel' }));
  await assertSucceeds(deleteDoc(doc(baas, 'clubs/A/content/afspraak-wed-speeltijd')));
  await assertSucceeds(updateDoc(doc(baas, 'clubprofielen/A'), { 'bevindingen.b2.oordeel': 'akkoord', 'bevindingen.b2.verwerkt': true,
    'bevindingen.b2.gezet': { ms: 1, tekst: 'Onze onderbouw loopt t/m O10.', regels: [], instellingen: { 'regels.bouwGrenzen.onderTm': 10 }, status: 'concept', ids: ['afspraak-bouw-grenzen'] } }));
  const terug = (await getDoc(doc(baas, 'clubprofielen/A'))).data().bevindingen.b2;
  assert.equal(terug.gezet.instellingen['regels.bouwGrenzen.onderTm'], 10);
  assert.equal(terug.waarde, 'Onderbouw t/m O10');
  assert.equal((await getDoc(doc(als('adminA'), 'clubs/A'))).data().instellingen.regels.bouwGrenzen.onderTm, 10);
  await assertFails(setDoc(doc(als('coachA'), 'clubs/A/content/afspraak-x'), { categorie: 'afspraak', titel: 'x', status: 'gepubliceerd' }));
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
test('clubvergelijking: overzicht voor iedereen, eigen waarden alleen voor de clubbeheerder', async () => {
  await assertSucceeds(getDoc(doc(als('coachB'), 'benchmark/overzicht')));
  await assertSucceeds(getDoc(doc(als('adminA'), 'benchmark/A')));
  await assertFails(getDoc(doc(als('adminB'), 'benchmark/A')));
  await assertFails(setDoc(doc(als('adminA'), 'benchmark/A'), { waarden: {} }));
});
test('club-inhoud: training van andere club niet zichtbaar', async () => {
  await assertSucceeds(getDoc(doc(als('coachA'), 'trainingen/tr1')));
  await assertFails(getDoc(doc(als('coachB'), 'trainingen/tr1')));
  await assertFails(deleteDoc(doc(als('coachB'), 'trainingen/tr1')));
});
test('leren van gebruik: signalen en geheim dicht, samenvatting alleen platformbeheerder', async () => {
  for (const pad of ['leersignalen/x', 'leren_teller/x', 'leren_geheim/zout']){
    await assertFails(getDoc(doc(als('adminA'), pad)));
    await assertFails(setDoc(doc(als('adminA'), pad), { n: 1 }));
    await assertFails(getDoc(doc(als('x', PLATFORM), pad)));
  }
  await assertFails(getDoc(doc(als('adminA'), 'leerstatistiek/2026-10')));
  await assertFails(setDoc(doc(als('x', PLATFORM), 'leerstatistiek/2026-10'), { cellen: [] }));
  await assertSucceeds(getDoc(doc(als('x', PLATFORM), 'leerstatistiek/2026-10')));
});
test('leren van gebruik: clubbeheerder kan zelf meedoen aanzetten, maar niet de eindbaas-schakelaar', async () => {
  await assertSucceeds(updateDoc(doc(als('adminA'), 'clubs/A'), { 'instellingen.leren': { meedoen: true } }));
  await assertFails(updateDoc(doc(als('adminA'), 'clubs/A'), { 'platformModules.leren': true }));
});
test('speelstijl: huidig leest de club, legt vast de admin; antwoorden alleen deelnemers en alleen het eigen', async () => {
  await assertSucceeds(setDoc(doc(als('adminA'), 'clubs/A/speelstijl/huidig'), { versie: 1 }));
  await assertFails(setDoc(doc(als('coachA'), 'clubs/A/speelstijl/huidig'), { versie: 1 }));
  await assertSucceeds(getDoc(doc(als('coachA'), 'clubs/A/speelstijl/huidig')));
  await assertFails(getDoc(doc(als('coachB'), 'clubs/A/speelstijl/huidig')));
  await assertSucceeds(setDoc(doc(als('adminA'), 'clubs/A/speelstijlRondes/r1'), { naam: 'Ronde 1', modus: 'kort' }));
  await assertFails(getDoc(doc(als('coachA'), 'clubs/A/speelstijlRondes/r1')));
  await assertSucceeds(setDoc(doc(als('coordA'), 'clubs/A/speelstijlRondes/r1/antwoorden/coordA'), { antwoorden: { d1a: 'A' } }));
  await assertFails(setDoc(doc(als('coordA'), 'clubs/A/speelstijlRondes/r1/antwoorden/adminA'), { antwoorden: {} }));
  await assertFails(setDoc(doc(als('coachA'), 'clubs/A/speelstijlRondes/r1/antwoorden/coachA'), { antwoorden: {} }));
  await assertSucceeds(getDoc(doc(als('coordA'), 'clubs/A/speelstijlRondes/r1/antwoorden/coordA')));
});

/* ---------- [20261020a] ondersteuningsmodus van de eindbaas ---------- */
const zetOndersteuning = (uid, clubId, tot) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'ondersteuning/' + uid), { clubId, tot }));

test('ondersteuning: zonder modus ziet de eindbaas de teamlijst, maar geen spelers en schrijft niet', async () => {
  const db = als('paul', PLATFORM);
  await assertSucceeds(getDoc(doc(db, 'teams/t1')));
  await assertFails(getDoc(doc(db, 'teams/t1/spelers/s1')));
  await assertFails(getDoc(doc(db, 'teams/t1/beoordelingen/b1')));
  await assertFails(setDoc(doc(db, 'teams/t1/spelers/s2'), { naam: 'Nieuw' }));
  await assertFails(updateDoc(doc(db, 'teams/t1'), { naam: 'Anders' }));
});
test('ondersteuning: in de modus werkt de eindbaas als clubbeheerder in precies die club', async () => {
  await zetOndersteuning('paul', 'A', morgen);
  const db = als('paul', PLATFORM);
  await assertSucceeds(getDoc(doc(db, 'teams/t1/spelers/s1')));
  await assertSucceeds(getDoc(doc(db, 'teams/t1/beoordelingen/b1')));
  await assertSucceeds(setDoc(doc(db, 'teams/t1/spelers/s2'), { naam: 'Nieuw', nr: 9 }));
  await assertSucceeds(updateDoc(doc(db, 'teams/t1'), { naam: 'JO11-2' }));
  await assertSucceeds(updateDoc(doc(db, 'clubs/A'), { naam: 'Club A (nieuw)' }));
  await assertFails(getDoc(doc(db, 'teams/tB/spelers/s1')));
  await assertFails(setDoc(doc(db, 'teams/tB/spelers/s2'), { naam: 'Nieuw' }));
});
test('ondersteuning: verlopen modus geeft geen rechten meer', async () => {
  await zetOndersteuning('paul', 'A', gisteren);
  const db = als('paul', PLATFORM);
  await assertFails(getDoc(doc(db, 'teams/t1/spelers/s1')));
  await assertFails(updateDoc(doc(db, 'teams/t1'), { naam: 'Anders' }));
});
test('ondersteuning: alleen de eindbaas, en het document is niet door een client te schrijven', async () => {
  await zetOndersteuning('coachA', 'A', morgen);
  await assertFails(updateDoc(doc(als('coachA'), 'clubs/A'), { naam: 'Gekaapt' }));
  await assertFails(setDoc(doc(als('coachA'), 'ondersteuning/coachA'), { clubId: 'A', tot: morgen }));
  await assertFails(setDoc(doc(als('paul', PLATFORM), 'ondersteuning/paul'), { clubId: 'A', tot: morgen }));
  await assertSucceeds(getDoc(doc(als('coachA'), 'ondersteuning/coachA')));
  await assertFails(getDoc(doc(als('coachB'), 'ondersteuning/coachA')));
});

/* ---------- [20261103] trainingscoördinator ---------- */
test('trainingscoördinator: leest club, teams, trainingen en video\'s; geen spelers, geen schrijven, andere club dicht', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await updateDoc(doc(db, 'clubs/A'), { trainingscoordinatoren: { tcA: true }, trainingscoordinatorenInfo: { tcA: { naam: 'Tom' } } });
    await setDoc(doc(db, 'videos/v1'), { club: 'A', titel: 'Video' });
    await setDoc(doc(db, 'documenten/dc1'), { club: 'A', titel: 'Doc' });
    await setDoc(doc(db, 'trainingen/tr1/onderdelen/o1'), { tekst: 'x' });
  });
  const tc = als('tcA');
  await assertSucceeds(getDoc(doc(tc, 'clubs/A')));
  await assertSucceeds(getDocs(query(collection(tc, 'clubs'), where('trainingscoordinatoren.tcA', '==', true))));
  await assertSucceeds(getDoc(doc(tc, 'teams/t1')));
  await assertSucceeds(getDocs(query(collection(tc, 'teams'), where('club', '==', 'A'))));
  await assertSucceeds(getDoc(doc(tc, 'trainingen/tr1')));
  await assertSucceeds(getDocs(query(collection(tc, 'trainingen'), where('club', '==', 'A'))));
  await assertSucceeds(getDocs(query(collection(tc, 'videos'), where('club', '==', 'A'))));
  await assertSucceeds(getDoc(doc(tc, 'trainingen/tr1/onderdelen/o1')));
  /* niet: spelers en andere teamgegevens, documenten, een andere club, en elke schrijfactie */
  await assertFails(getDocs(collection(tc, 'teams/t1/spelers')));
  await assertFails(getDoc(doc(tc, 'teams/t1/spelers/s1')));
  await assertFails(getDoc(doc(tc, 'teams/t1/beoordelingen/b1')));
  await assertFails(getDoc(doc(tc, 'documenten/dc1')));
  await assertFails(getDoc(doc(tc, 'clubs/B')));
  await assertFails(getDoc(doc(tc, 'teams/tB')));
  await assertFails(updateDoc(doc(tc, 'teams/t1'), { naam: 'x' }));
  await assertFails(updateDoc(doc(tc, 'clubs/A'), { trainingscoordinatoren: { tcA: true, tcA2: true } }));
  await assertFails(setDoc(doc(tc, 'videos/v2'), { club: 'A', titel: 'x' }));
  await assertFails(updateDoc(doc(tc, 'trainingen/tr1'), { titel: 'x' }));
});
test('trainingscoördinator: zonder toekenning geen toegang, en zelf toekennen kan niet', async () => {
  await assertFails(getDocs(query(collection(als('stranger'), 'teams'), where('club', '==', 'A'))));
  await assertFails(updateDoc(doc(als('coachA'), 'clubs/A'), { 'trainingscoordinatoren.coachA': true }));
  await assertFails(updateDoc(doc(als('stranger'), 'clubs/A'), { 'trainingscoordinatoren.stranger': true }));
});
test('trainingscoördinator: clubbeheerder mag toekennen en intrekken', async () => {
  await assertSucceeds(updateDoc(doc(als('adminA'), 'clubs/A'), { 'trainingscoordinatoren.tcA': true }));
  await assertSucceeds(updateDoc(doc(als('adminA'), 'clubs/A'), { 'trainingscoordinatoren.tcA': deleteField() }));
});

/* [20261111d] seizoensplan toewijzen: de bouwcoördinator schrijft trainingen voor teams uit zijn eigen bouw */
test('trainingen: bouwcoördinator schrijft voor een team uit de eigen bouw, niet daarbuiten', async () => {
  const tr = (team) => ({ club: 'A', teams: [team], bron: 'seizoensplan', titel: 'Seizoensplan · week 1 · training 1' });
  await assertSucceeds(setDoc(doc(als('coordA'), 'trainingen/spC1'), tr('t1')));
  await assertSucceeds(deleteDoc(doc(als('coordA'), 'trainingen/spC1')));
  await assertFails(setDoc(doc(als('coordA'), 'trainingen/spC2'), tr('t2')));
  await assertFails(setDoc(doc(als('coordA'), 'trainingen/spC3'), { ...tr('t1'), club: 'B' }));
  await assertFails(setDoc(doc(als('coordA'), 'trainingen/spC4'), { club: 'A', teams: ['t1', 't2'], titel: 'x' }));
});
test('trainingen van een team zonder club: onder het team, alleen voor de coach', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'teams/tLos'), { naam: 'O9-1', leden: { losA: true } }));
  await assertSucceeds(setDoc(doc(als('losA'), 'teams/tLos/trainingen/sp1'), { teams: ['tLos'], bron: 'seizoensplan', titel: 'x' }));
  await assertSucceeds(getDoc(doc(als('losA'), 'teams/tLos/trainingen/sp1')));
  await assertFails(getDoc(doc(als('coachA'), 'teams/tLos/trainingen/sp1')));
});

/* [20261113d] trainingsbibliotheek: alleen de platformbeheerder schrijft; doorvoeren raakt alleen de oefeningen */
test('bibliotheek: platform schrijft vormen, een coach niet; iedereen leest', async () => {
  await assertSucceeds(setDoc(doc(als('baas', PLATFORM), 'platform/bibliotheek/vormen/eigen_x'), { velden: { naam: 'X' }, status: 'aan' }));
  await assertFails(setDoc(doc(als('coachA'), 'platform/bibliotheek/vormen/eigen_y'), { velden: { naam: 'Y' } }));
  await assertSucceeds(getDoc(doc(als('coachA'), 'platform/bibliotheek/vormen/eigen_x')));
});
test('bibliotheek doorvoeren: platform werkt alleen oefeningen bij', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'trainingen/bv1'), { club: 'A', teams: ['t1'], titel: 'x', oefeningen: [], vormIds: ['v1'] }));
  await assertSucceeds(updateDoc(doc(als('baas', PLATFORM), 'trainingen/bv1'), { oefeningen: [{ titel: 'nieuw' }], bibliotheekBijgewerktMs: 1 }));
  await assertFails(updateDoc(doc(als('baas', PLATFORM), 'trainingen/bv1'), { titel: 'anders' }));
  await assertFails(updateDoc(doc(als('stranger'), 'trainingen/bv1'), { oefeningen: [] }));
});

/* [20261114a] privé-rondebeoordelingen (ASV'33 PR #60): alleen wie in zichtbaarVoor staat leest */
test('privé-rondebeoordeling: schrijver en lezers lezen, andere trainer van het team niet', async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'teams/t1'), { 'leden.coachA2': true }));
  const data = { teamId: 't1', club: 'A', spelerId: 's1', soort: 'volledig', prive: true, ronde: 'r1',
    door: { uid: 'coachA' }, zichtbaarVoor: ['coachA', 'adminA', 'coordA'] };
  await assertSucceeds(setDoc(doc(als('coachA'), 'beoordelingenPrive/p1'), data));
  await assertSucceeds(getDoc(doc(als('coordA'), 'beoordelingenPrive/p1')));
  await assertSucceeds(getDocs(query(collection(als('adminA'), 'beoordelingenPrive'), where('teamId', '==', 't1'), where('zichtbaarVoor', 'array-contains', 'adminA'))));
  await assertFails(getDoc(doc(als('coachA2'), 'beoordelingenPrive/p1')));
  await assertFails(getDocs(query(collection(als('coachA2'), 'beoordelingenPrive'), where('teamId', '==', 't1'))));
  /* alleen de schrijver past aan of verwijdert; team en club blijven gelijk */
  await assertFails(updateDoc(doc(als('adminA'), 'beoordelingenPrive/p1'), { notitie: 'x' }));
  await assertFails(updateDoc(doc(als('coachA'), 'beoordelingenPrive/p1'), { teamId: 't2' }));
  await assertSucceeds(updateDoc(doc(als('coachA'), 'beoordelingenPrive/p1'), { notitie: 'x' }));
  await assertSucceeds(deleteDoc(doc(als('coachA'), 'beoordelingenPrive/p1')));
});
test('privé-rondebeoordeling aanmaken: niet voor een ander team, een andere club of op andermans naam', async () => {
  const data = (extra = {}) => ({ teamId: 't1', club: 'A', door: { uid: 'coachA' }, zichtbaarVoor: ['coachA'], ...extra });
  await assertFails(setDoc(doc(als('coachB'), 'beoordelingenPrive/q1'), data({ door: { uid: 'coachB' }, zichtbaarVoor: ['coachB'] })));
  await assertFails(setDoc(doc(als('coachA'), 'beoordelingenPrive/q2'), data({ club: 'B' })));
  await assertFails(setDoc(doc(als('coachA'), 'beoordelingenPrive/q3'), data({ door: { uid: 'adminA' } })));
  await assertFails(setDoc(doc(als('coachA'), 'beoordelingenPrive/q4'), data({ zichtbaarVoor: ['adminA'] })));
});

/* ---------- teamkamer: ouders en spelers [20261116m] ---------- */
async function zaaiKamer(extra = {}){
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const mag = { namen: true, spelers: true, polls: true, beurten: true, berichten: true, afmelden: true, uitslag: true, live: true, opstelling: true, thuis: true, lijn: true, agenda: true, weer: true };
    await setDoc(doc(db, 'teamkamer/t1'), { aan: true, mag, teamNaam: 'JO11-1', spelers: { s1: { n: 'Speler', nr: 7 }, s2: { v: true } }, ...(extra.kamer || {}) });
    await setDoc(doc(db, 'teamkamer/t1/agenda/w_1'), { soort: 'wedstrijd', datum: '2099-01-01', afwezig: ['s2'] });
    await setDoc(doc(db, 'teamkamer/t1/gezin/s1'), { voornaam: 'Speler', nr: 7 });
    await setDoc(doc(db, 'teamkamer/t1/gezin/s2'), { voornaam: 'Ander', nr: 9 });
    await setDoc(doc(db, 'teamkamer/t1/gezin/s1/ouder/stats'), { wedstrijden: { gespeeld: 8, totaal: 9 } });
    await setDoc(doc(db, 'teamkamer/t1/gezin/s2/ouder/stats'), { wedstrijden: { gespeeld: 2, totaal: 9 } });
    await setDoc(doc(db, 'teamkamer/t1/berichten/b1'), { tekst: 'Donderdag veld 3', ms: 1 });
    await setDoc(doc(db, 'teamkamer/t1/kamerleden/ouder1'), { teamId: 't1', uid: 'ouder1', rol: 'ouder', spelerIds: ['s1'], vervaltOp: volgendJaar });
    await setDoc(doc(db, 'teamkamer/t1/kamerleden/kind1'), { teamId: 't1', uid: 'kind1', rol: 'speler', spelerIds: ['s1'], door: 'ouder1', vervaltOp: volgendJaar });
    await setDoc(doc(db, 'teamkamer/t1/kamerleden/verlopen'), { teamId: 't1', uid: 'verlopen', rol: 'ouder', spelerIds: ['s1'], vervaltOp: gisteren });
    await setDoc(doc(db, 'teamkamer/t1/polls/open'), { vraag: 'Wie rijdt?', opties: [{ id: 'o1', tekst: 'Wij' }, { id: 'o2', tekst: 'Niet' }], status: 'open', sluitOp: morgen, spelers: false });
    await setDoc(doc(db, 'teamkamer/t1/polls/spelers'), { vraag: 'Welk uitje?', opties: [{ id: 'o1', tekst: 'A' }, { id: 'o2', tekst: 'B' }], status: 'open', sluitOp: morgen, spelers: true });
    await setDoc(doc(db, 'teamkamer/t1/polls/dicht'), { vraag: 'Oud', opties: [{ id: 'o1', tekst: 'A' }, { id: 'o2', tekst: 'B' }], status: 'gesloten', sluitOp: morgen });
    await setDoc(doc(db, 'teamkamer/t1/polls/verlopen'), { vraag: 'Te laat', opties: [{ id: 'o1', tekst: 'A' }, { id: 'o2', tekst: 'B' }], status: 'open', sluitOp: gisteren });
    await setDoc(doc(db, 'teamkamer/t1/polls/open/stemmen/s2'), { keuzes: ['o2'], door: 'iemand', ms: 1 });
    await setDoc(doc(db, 'teamkamer/tB'), { aan: true, teamNaam: 'JO11-1' });
    await setDoc(doc(db, 'teamkamer/tB/agenda/w_1'), { soort: 'wedstrijd', datum: '2099-01-01', afwezig: [] });
    await setDoc(doc(db, 'kamerAanvragen/t1_nieuw'), { teamId: 't1', uid: 'nieuw', email: 'nieuw@voorbeeld.test', kind: 'Speler' });
    await setDoc(doc(db, 'kamerLinks/CODE123456'), { teamId: 't1', gebruikt: 0 });
    await setDoc(doc(db, 'kindCodes/ABC234'), { teamId: 't1', spelerId: 's1', door: 'ouder1' });
    await setDoc(doc(db, 'teams/t1/wedstrijden/w1'), { datum: '2099-01-01', afwezigRedenen: { s2: { reden: 'ziek' } } });
    await setDoc(doc(db, 'teams/t1/presentie/p1'), { datum: '2099-01-02', afwezig: ['s2'], afwezigRedenen: { s2: { reden: 'blessure' } } });
  });
}
test('teamkamer: ouder en speler lezen de kopie van hun eigen team', async () => {
  await zaaiKamer();
  for (const db of [als('ouder1'), anoniem('kind1')]){
    await assertSucceeds(getDoc(doc(db, 'teamkamer/t1')));
    await assertSucceeds(getDocs(collection(db, 'teamkamer/t1/agenda')));
    await assertSucceeds(getDocs(collection(db, 'teamkamer/t1/berichten')));
    await assertSucceeds(getDocs(collection(db, 'teamkamer/t1/polls')));
    await assertSucceeds(getDoc(doc(db, 'teamkamer/t1/gezin/s1')));
  }
  await assertSucceeds(getDoc(doc(als('ouder1'), 'teamkamer/t1/kamerleden/ouder1')));
});
/* [20261116r] NOG NIET GEDRAAID: de emulator is in de werkomgeving van Claude niet te downloaden */
test('teamkamer: cijfers van het eigen kind leest alleen de ouder, niet de speler zelf of een ander gezin', async () => {
  await zaaiKamer();
  await assertSucceeds(getDoc(doc(als('ouder1'), 'teamkamer/t1/gezin/s1/ouder/stats')));
  await assertFails(getDoc(doc(anoniem('kind1'), 'teamkamer/t1/gezin/s1/ouder/stats')));
  await assertFails(getDoc(doc(als('ouder1'), 'teamkamer/t1/gezin/s2/ouder/stats')));
  await assertFails(getDoc(doc(als('verlopen'), 'teamkamer/t1/gezin/s1/ouder/stats')));
  await assertFails(setDoc(doc(als('ouder1'), 'teamkamer/t1/gezin/s1/ouder/stats'), { wedstrijden: { gespeeld: 9, totaal: 9 } }));
});
test('teamkamer: ouder en speler lezen NIETS van de coach, de club of een ander team', async () => {
  await zaaiKamer();
  for (const db of [als('ouder1'), anoniem('kind1')]){
    await assertFails(getDoc(doc(db, 'teams/t1')));
    await assertFails(getDoc(doc(db, 'teams/t1/spelers/s1')));
    await assertFails(getDocs(collection(db, 'teams/t1/spelers')));
    await assertFails(getDoc(doc(db, 'teams/t1/wedstrijden/w1')));
    await assertFails(getDoc(doc(db, 'teams/t1/presentie/p1')));
    await assertFails(getDoc(doc(db, 'teams/t1/beoordelingen/b1')));
    await assertFails(getDoc(doc(db, 'teams/t1/kamerBeheer/link')));
    await assertFails(getDoc(doc(db, 'clubs/A')));
    await assertFails(getDoc(doc(db, 'trainingen/tr1')));
    await assertFails(getDoc(doc(db, 'teamkamer/tB')));
    await assertFails(getDocs(collection(db, 'teamkamer/tB/agenda')));
    await assertFails(getDoc(doc(db, 'teamkamer/t1/gezin/s2')));                    // het gezin van een ander
    await assertFails(getDocs(collection(db, 'teamkamer/t1/gezin')));
    await assertFails(getDoc(doc(db, 'teamkamer/t1/kamerleden/verlopen')));         // wie er nog meer meekijkt
    await assertFails(getDocs(collection(db, 'teamkamer/t1/kamerleden')));
    await assertFails(getDoc(doc(db, 'teamkamer/t1/polls/open/stemmen/s2')));       // de stem van een ander gezin
    await assertFails(getDocs(collection(db, 'teamkamer/t1/polls/open/stemmen')));
    await assertFails(getDoc(doc(db, 'kamerLinks/CODE123456')));
    await assertFails(getDoc(doc(db, 'kindCodes/ABC234')));
    await assertFails(getDoc(doc(db, 'kamerAanvragen/t1_nieuw')));
  }
});
test('teamkamer: ouder en speler schrijven niets behalve de eigen stem', async () => {
  await zaaiKamer();
  for (const db of [als('ouder1'), anoniem('kind1')]){
    await assertFails(setDoc(doc(db, 'teamkamer/t1'), { aan: true }, { merge: true }));
    await assertFails(setDoc(doc(db, 'teamkamer/t1/agenda/w_1'), { afwezig: [] }, { merge: true }));     // beschikbaarheid is alleen lezen
    await assertFails(setDoc(doc(db, 'teamkamer/t1/agenda/nieuw'), { soort: 'training' }));
    await assertFails(setDoc(doc(db, 'teamkamer/t1/berichten/x'), { tekst: 'hoi' }));                    // geen chat
    await assertFails(setDoc(doc(db, 'teamkamer/t1/polls/x'), { vraag: 'eigen poll' }));
    await assertFails(updateDoc(doc(db, 'teamkamer/t1/polls/open'), { telling: { o1: 99 } }));
    await assertFails(setDoc(doc(db, 'teamkamer/t1/gezin/s1'), { beurten: { rijden: 0 } }, { merge: true }));
    await assertFails(setDoc(doc(db, 'teamkamer/t1/kamerleden/ouder1'), { spelerIds: ['s1', 's2'] }, { merge: true }));
    await assertFails(setDoc(doc(db, 'teams/t1/presentie/p1'), { afwezig: [] }, { merge: true }));
    await assertFails(updateDoc(doc(db, 'teams/t1/wedstrijden/w1'), { afwezigRedenen: {} }));
  }
});
test('teamkamer: stemmen alleen voor het eigen gezin, in een open poll, met vaste velden', async () => {
  await zaaiKamer();
  const o = als('ouder1'), k = anoniem('kind1'), stem = (uid, extra = {}) => ({ keuzes: ['o1'], door: uid, ms: 1, ...extra });
  await assertSucceeds(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), stem('ouder1')));
  await assertSucceeds(getDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1')));
  await assertSucceeds(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), stem('ouder1', { keuzes: [] })));     // stem intrekken
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s2'), stem('ouder1')));                        // voor een ander gezin
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), stem('iemandanders')));
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), stem('ouder1', { opmerking: 'vrije tekst' })));
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), stem('ouder1', { keuzes: 'o1' })));
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/dicht/stemmen/s1'), stem('ouder1')));
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/verlopen/stemmen/s1'), stem('ouder1')));
  await assertFails(deleteDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1')));
  await assertFails(setDoc(doc(k, 'teamkamer/t1/polls/open/stemmen/s1'), stem('kind1')));                         // poll alleen voor ouders
  await assertSucceeds(setDoc(doc(k, 'teamkamer/t1/polls/spelers/stemmen/s1'), stem('kind1')));
});
test('teamkamer: geen toegang zonder lidmaatschap, na verlopen of als de teamkamer uit staat', async () => {
  await zaaiKamer();
  for (const db of [als('vreemd'), als('verlopen'), anoniem('anon'), als('coachB'), als('ouderVanB')]){
    await assertFails(getDoc(doc(db, 'teamkamer/t1')));
    await assertFails(getDocs(collection(db, 'teamkamer/t1/agenda')));
    await assertFails(getDocs(collection(db, 'teamkamer/t1/polls')));
    await assertFails(setDoc(doc(db, 'teamkamer/t1/polls/open/stemmen/s1'), { keuzes: ['o1'], door: 'vreemd', ms: 1 }));
  }
  await assertFails(getDoc(doc(gast(), 'teamkamer/t1')));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'teamkamer/t1'), { aan: false }, { merge: true }));
  await assertFails(getDoc(doc(als('ouder1'), 'teamkamer/t1')));
  await assertFails(getDocs(collection(als('ouder1'), 'teamkamer/t1/agenda')));
  await assertFails(getDoc(doc(als('ouder1'), 'teamkamer/t1/gezin/s1')));
  await assertFails(setDoc(doc(als('ouder1'), 'teamkamer/t1/polls/open/stemmen/s1'), { keuzes: ['o1'], door: 'ouder1', ms: 1 }));
  await assertSucceeds(getDoc(doc(als('coachA'), 'teamkamer/t1')));                                              // de coach blijft erbij kunnen
});
test('teamkamer: de coach beheert mededelingen en polls van het eigen team, de kopie zelf niet', async () => {
  await zaaiKamer();
  const c = als('coachA');
  await assertSucceeds(getDocs(collection(c, 'teamkamer/t1/kamerleden')));
  await assertSucceeds(getDocs(collection(c, 'teamkamer/t1/gezin')));
  await assertSucceeds(getDocs(collection(c, 'teamkamer/t1/polls/open/stemmen')));
  await assertSucceeds(getDocs(query(collection(c, 'kamerAanvragen'), where('teamId', '==', 't1'))));
  await assertSucceeds(setDoc(doc(c, 'teamkamer/t1/berichten/n1'), { tekst: 'Veld 3', ms: 2 }));
  await assertSucceeds(setDoc(doc(c, 'teamkamer/t1/polls/n1'), { vraag: 'Wie wast?', opties: [{ id: 'o1', tekst: 'Wij' }, { id: 'o2', tekst: 'Niet' }], status: 'open' }));
  await assertSucceeds(updateDoc(doc(c, 'teamkamer/t1/polls/open'), { status: 'gesloten' }));
  await assertSucceeds(updateDoc(doc(c, 'teams/t1'), { 'teamkamer.aan': true }));
  await assertFails(setDoc(doc(c, 'teamkamer/t1'), { aan: true, spelers: {} }));
  await assertFails(setDoc(doc(c, 'teamkamer/t1/agenda/w_1'), { afwezig: [] }, { merge: true }));
  await assertFails(setDoc(doc(c, 'teamkamer/t1/kamerleden/vriend'), { teamId: 't1', uid: 'vriend', rol: 'ouder', spelerIds: ['s1'], vervaltOp: volgendJaar }));   // toegang alleen via de functies
  await assertFails(setDoc(doc(c, 'teamkamer/t1/gezin/s1'), { beurten: { rijden: 5 } }, { merge: true }));
  for (const db of [als('coachB'), als('coach2')]){                                                              // andere club, en ander team van dezelfde club
    await assertFails(getDoc(doc(db, 'teamkamer/t1')));
    await assertFails(getDocs(collection(db, 'teamkamer/t1/kamerleden')));
    await assertFails(setDoc(doc(db, 'teamkamer/t1/berichten/n2'), { tekst: 'x' }));
    await assertFails(getDocs(query(collection(db, 'kamerAanvragen'), where('teamId', '==', 't1'))));
  }
  await assertSucceeds(getDoc(doc(als('adminA'), 'teamkamer/t1')));
  await assertSucceeds(getDoc(doc(als('nieuw'), 'kamerAanvragen/t1_nieuw')));                                    // de aanvrager ziet de eigen aanvraag
  await assertFails(setDoc(doc(als('nieuw'), 'kamerAanvragen/t1_nieuw'), { status: 'goed' }, { merge: true }));
  await assertFails(getDoc(doc(als('ouder1'), 'kamerAanvragen/t1_nieuw')));
});
test('teamkamer: wat de eindbaas uit heeft staan, kan niemand gebruiken', async () => {
  await zaaiKamer({ kamer: { mag: {} } });                                                                          // alleen de hoofdschakelaar aan
  const c = als('coachA'), o = als('ouder1'), k = anoniem('kind1');
  await assertSucceeds(getDoc(doc(o, 'teamkamer/t1')));                                                             // de agenda blijft
  await assertSucceeds(getDocs(collection(o, 'teamkamer/t1/agenda')));
  await assertFails(setDoc(doc(c, 'teamkamer/t1/polls/n1'), { vraag: 'Wie wast?', opties: [{ id: 'o1', tekst: 'Wij' }, { id: 'o2', tekst: 'Niet' }], status: 'open' }));
  await assertFails(updateDoc(doc(c, 'teamkamer/t1/polls/open'), { vraag: 'Anders' }));
  await assertSucceeds(deleteDoc(doc(c, 'teamkamer/t1/polls/dicht')));                                              // opruimen mag altijd
  await assertFails(setDoc(doc(c, 'teamkamer/t1/berichten/n1'), { tekst: 'Veld 3', ms: 2 }));
  await assertFails(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), { keuzes: ['o1'], door: 'ouder1', ms: 1 }));
  await assertFails(getDoc(doc(k, 'teamkamer/t1')));                                                                // spelers staan uit
  await assertFails(getDocs(collection(k, 'teamkamer/t1/agenda')));
  await assertFails(getDoc(doc(k, 'teamkamer/t1/gezin/s1')));
  await env.withSecurityRulesDisabled(x => setDoc(doc(x.firestore(), 'teamkamer/t1'), { mag: { polls: true, spelers: true } }, { merge: true }));
  await assertSucceeds(setDoc(doc(o, 'teamkamer/t1/polls/open/stemmen/s1'), { keuzes: ['o1'], door: 'ouder1', ms: 1 }));
  await assertSucceeds(getDoc(doc(k, 'teamkamer/t1')));
  await assertFails(setDoc(doc(c, 'teamkamer/t1/berichten/n2'), { tekst: 'Veld 3', ms: 2 }));                       // mededelingen staan nog uit
  await assertFails(setDoc(doc(c, 'teamkamer/t1'), { mag: { berichten: true } }, { merge: true }));                 // de coach zet zelf niets aan
  await assertFails(updateDoc(doc(als('adminA'), 'clubs/A'), { 'platformModules.teamkamerOpties.polls': true }));   // de clubadmin ook niet
});

/* ---------- trainingshulp (Lijstjes): open link, teamkamer en staf [20261118a] ---------- */
const HULP_MAG = { namen: true, spelers: true, polls: true, hulp: true };
async function zaaiHulp(mag = HULP_MAG){
  await zaaiKamer({ kamer: { mag } });
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), momenten = { d20990105: { datum: '2099-01-05', start: '18:00', eind: '19:00', nodig: 2 } };
    await setDoc(doc(db, 'hulpDeel/beide'), { teamId: 't1', club: 'A', lijstId: 'l1', teamNaam: 'JO11-1', titel: 'Trainingshulp', open: true, kamer: true, standaard: 2, momenten });
    await setDoc(doc(db, 'hulpDeel/kamer'), { teamId: 't1', club: 'A', lijstId: 'l2', open: false, kamer: true, standaard: 2, momenten });
    await setDoc(doc(db, 'hulpDeel/link'), { teamId: 't1', club: 'A', lijstId: 'l3', open: true, kamer: false, standaard: 2, momenten });
    await setDoc(doc(db, 'hulpDeel/uit'), { teamId: 't1', club: 'A', lijstId: 'l4', open: false, kamer: false, standaard: 2, momenten });
    await setDoc(doc(db, 'hulpDeel/anderTeam'), { teamId: 'tB', club: 'B', lijstId: 'l5', open: false, kamer: true, standaard: 2, momenten });
    await setDoc(doc(db, 'hulpDeel/kamer/aanmeldingen/ouder9_d20990105'), { uid: 'ouder9', rij: 'd20990105', naam: 'Mark', ms: 1, door: 'kamer' });
    await setDoc(doc(db, 'hulpDeel/link/aanmeldingen/anon9_d20990105'), { uid: 'anon9', rij: 'd20990105', naam: 'Joyce', ms: 1, door: 'ouder' });
  });
}
const aanm = (uid, door, extra = {}) => ({ uid, rij: 'd20990105', naam: 'Sandra', ms: 2, door, ...extra });
test('trainingshulp: de open link leest één lijst en schrijft alleen de eigen aanmelding', async () => {
  await zaaiHulp();
  const a = anoniem('anon1');
  await assertSucceeds(getDoc(doc(a, 'hulpDeel/link')));
  await assertSucceeds(getDocs(collection(a, 'hulpDeel/link/aanmeldingen')));
  await assertFails(getDoc(doc(a, 'hulpDeel/kamer')));                                                              // link staat uit
  await assertFails(getDoc(doc(a, 'hulpDeel/uit')));
  await assertFails(getDocs(collection(a, 'hulpDeel/kamer/aanmeldingen')));
  await assertFails(getDocs(collection(a, 'hulpDeel')));                                                            // doorzoeken kan niet
  await assertFails(getDocs(query(collection(a, 'hulpDeel'), where('teamId', '==', 't1'), where('kamer', '==', true))));
  await assertFails(getDoc(doc(a, 'teams/t1')));                                                                    // en verder niets van het team
  await assertFails(getDocs(collection(a, 'teams/t1/spelers')));
  await assertFails(getDoc(doc(gast(), 'hulpDeel/link')));                                                          // niet ingelogd: niets
  await assertSucceeds(setDoc(doc(a, 'hulpDeel/link/aanmeldingen/anon1_d20990105'), aanm('anon1', 'ouder')));
  await assertFails(setDoc(doc(a, 'hulpDeel/link/aanmeldingen/anon1_d20990105'), aanm('anon1', 'ouder', { naam: 'Ander' })));   // wijzigen kan niet
  await assertFails(setDoc(doc(a, 'hulpDeel/link/aanmeldingen/vrij'), aanm('anon1', 'ouder')));                     // alleen het vaste id: één per training
  await assertFails(setDoc(doc(a, 'hulpDeel/link/aanmeldingen/anon1_d20990106'), aanm('anon1', 'ouder', { rij: 'd20990106' })));   // training staat niet in de lijst
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/link/aanmeldingen/anon2_d20990105'), aanm('anon1', 'ouder')));   // andermans uid
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/link/aanmeldingen/anon2_d20990105'), aanm('anon2', 'coach')));   // zich voordoen als staf
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/link/aanmeldingen/anon2_d20990105'), aanm('anon2', 'kamer')));   // of als teamkamer-ouder
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/link/aanmeldingen/anon2_d20990105'), aanm('anon2', 'ouder', { naam: '' })));
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/link/aanmeldingen/anon2_d20990105'), aanm('anon2', 'ouder', { naam: 'x'.repeat(25) })));
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/link/aanmeldingen/anon2_d20990105'), aanm('anon2', 'ouder', { telefoon: '06' })));   // geen extra velden
  await assertFails(setDoc(doc(anoniem('anon2'), 'hulpDeel/kamer/aanmeldingen/anon2_d20990105'), aanm('anon2', 'ouder')));  // link uit
  await assertFails(deleteDoc(doc(a, 'hulpDeel/link/aanmeldingen/anon9_d20990105')));                               // andermans aanmelding
  await assertSucceeds(deleteDoc(doc(a, 'hulpDeel/link/aanmeldingen/anon1_d20990105')));                            // de eigen wel
  await assertFails(updateDoc(doc(a, 'hulpDeel/link'), { open: false }));
  await assertFails(updateDoc(doc(a, 'hulpDeel/link'), { 'momenten.d20990105.nodig': 9 }));
});
test('trainingshulp: een ouder in de teamkamer vindt de lijsten van het eigen team en schrijft zich in', async () => {
  await zaaiHulp();
  const o = als('ouder1'), k = anoniem('kind1');
  const zoek = db => getDocs(query(collection(db, 'hulpDeel'), where('teamId', '==', 't1'), where('kamer', '==', true)));
  await assertSucceeds(zoek(o));
  await assertSucceeds(getDoc(doc(o, 'hulpDeel/kamer')));
  await assertSucceeds(getDocs(collection(o, 'hulpDeel/kamer/aanmeldingen')));
  await assertFails(getDocs(query(collection(o, 'hulpDeel'), where('teamId', '==', 't1'))));                        // ook de lijsten die niet voor de teamkamer zijn
  await assertFails(getDocs(query(collection(o, 'hulpDeel'), where('teamId', '==', 'tB'), where('kamer', '==', true))));   // ander team
  await assertFails(getDoc(doc(o, 'hulpDeel/anderTeam')));
  await assertFails(getDoc(doc(o, 'hulpDeel/uit')));
  await assertSucceeds(setDoc(doc(o, 'hulpDeel/kamer/aanmeldingen/ouder1_d20990105'), aanm('ouder1', 'kamer')));
  await assertFails(setDoc(doc(o, 'hulpDeel/kamer/aanmeldingen/los'), aanm('ouder1', 'kamer')));
  await assertFails(setDoc(doc(o, 'hulpDeel/kamer/aanmeldingen/ouder1_d20990105'), aanm('ouder1', 'coach')));
  await assertFails(setDoc(doc(o, 'hulpDeel/link/aanmeldingen/ouder1_d20990105'), aanm('ouder1', 'kamer')));        // deze lijst staat niet aan voor de teamkamer
  await assertFails(setDoc(doc(o, 'hulpDeel/anderTeam/aanmeldingen/ouder1_d20990105'), aanm('ouder1', 'kamer')));
  await assertFails(deleteDoc(doc(o, 'hulpDeel/kamer/aanmeldingen/ouder9_d20990105')));
  await assertSucceeds(deleteDoc(doc(o, 'hulpDeel/kamer/aanmeldingen/ouder1_d20990105')));
  await assertFails(updateDoc(doc(o, 'hulpDeel/kamer'), { kamer: false }));
  await assertSucceeds(zoek(k));                                                                                    // een speler leest mee
  await assertSucceeds(getDocs(collection(k, 'hulpDeel/kamer/aanmeldingen')));
  await assertFails(setDoc(doc(k, 'hulpDeel/kamer/aanmeldingen/kind1_d20990105'), aanm('kind1', 'kamer')));         // maar schrijft zich niet in
  for (const db of [als('verlopen'), als('vreemde'), als('coachB')]){                                               // verlopen toegang, geen lid, coach van een andere club
    await assertFails(zoek(db));
    await assertFails(getDoc(doc(db, 'hulpDeel/kamer')));
    await assertFails(setDoc(doc(db, 'hulpDeel/kamer/aanmeldingen/x_d20990105'), aanm('x', 'kamer')));
  }
});
test('trainingshulp: zonder de schakelaar van de eindbaas kan het niet via de teamkamer', async () => {
  await zaaiHulp({ namen: true, spelers: true, polls: true });                                                      // hulp staat uit
  const o = als('ouder1');
  await assertFails(getDocs(query(collection(o, 'hulpDeel'), where('teamId', '==', 't1'), where('kamer', '==', true))));
  await assertFails(getDoc(doc(o, 'hulpDeel/kamer')));
  await assertFails(setDoc(doc(o, 'hulpDeel/kamer/aanmeldingen/ouder1_d20990105'), aanm('ouder1', 'kamer')));
  await assertSucceeds(getDoc(doc(o, 'hulpDeel/beide')));                                                           // de open link werkt los daarvan, voor iedereen
  await assertSucceeds(setDoc(doc(o, 'hulpDeel/beide/aanmeldingen/ouder1_d20990105'), aanm('ouder1', 'ouder')));
  await assertFails(setDoc(doc(o, 'hulpDeel/beide/aanmeldingen/ouder1_d20990105x'), aanm('ouder1', 'kamer')));
});
test('trainingshulp: alleen de staf van het team maakt en beheert de lijst', async () => {
  await zaaiHulp();
  const c = als('coachA'), nieuw = { teamId: 't1', club: 'A', lijstId: 'l9', teamNaam: 'JO11-1', titel: 'Hulp', open: false, kamer: false, standaard: 2, momenten: {} };
  await assertSucceeds(setDoc(doc(c, 'hulpDeel/nieuw'), nieuw));
  await assertSucceeds(getDoc(doc(c, 'hulpDeel/uit')));                                                             // ook als alles uit staat
  await assertSucceeds(getDocs(collection(c, 'hulpDeel/uit/aanmeldingen')));
  await assertSucceeds(updateDoc(doc(c, 'hulpDeel/uit'), { standaard: 3, 'momenten.d20990105.nodig': 3 }));
  await assertSucceeds(updateDoc(doc(c, 'hulpDeel/nieuw'), { open: true, kamer: true }));                           // inschrijven aan- en uitzetten
  await assertFails(updateDoc(doc(c, 'hulpDeel/uit'), { teamId: 'tB' }));                                           // team en club liggen vast
  await assertFails(updateDoc(doc(c, 'hulpDeel/uit'), { club: 'B' }));
  await assertSucceeds(setDoc(doc(c, 'hulpDeel/kamer/aanmeldingen/eigen'), aanm('coachA', 'coach')));               // de coach vult zelf een naam in
  await assertFails(setDoc(doc(c, 'hulpDeel/kamer/aanmeldingen/eigen2'), aanm('iemand', 'coach')));
  await assertSucceeds(deleteDoc(doc(c, 'hulpDeel/kamer/aanmeldingen/ouder9_d20990105')));                          // en haalt een ouder weg
  await assertSucceeds(getDoc(doc(als('adminA'), 'hulpDeel/uit')));                                                 // clubadmin en coördinator van de bouw horen bij de staf
  await assertSucceeds(updateDoc(doc(als('coordA'), 'hulpDeel/uit'), { standaard: 2 }));
  await assertSucceeds(deleteDoc(doc(c, 'hulpDeel/nieuw')));
  for (const db of [als('coachB'), als('coach2'), als('ouder1')]){                                                  // andere club, ander team van de club, ouder
    await assertFails(setDoc(doc(db, 'hulpDeel/n2'), nieuw));
    await assertFails(getDoc(doc(db, 'hulpDeel/uit')));
    await assertFails(updateDoc(doc(db, 'hulpDeel/kamer'), { open: true }));
    await assertFails(deleteDoc(doc(db, 'hulpDeel/kamer')));
    await assertFails(setDoc(doc(db, 'hulpDeel/kamer/aanmeldingen/z'), aanm('z', 'coach')));
  }
  await assertFails(setDoc(doc(als('coachB'), 'hulpDeel/n3'), { ...nieuw, teamId: 'tB', club: 'A' }));              // club moet die van het team zijn
  await assertFails(setDoc(doc(c, 'hulpDeel/n4'), { ...nieuw, club: 'B' }));
});

/* ---------- [20261120a] veldkaart: sportparken en veldmeldingen per club ---------- */
test('veldkaart: de club leest sportparken, de clubbeheerder beheert ze; een coach meldt, clubbeheer handelt af', async () => {
  const c = als('coachA'), a = als('adminA'), b = als('coachB');
  const park = { naam: 'Sportpark A', eigen: true, lat: 52.1, lon: 5.1, velden: [], plekken: [] };
  await assertSucceeds(setDoc(doc(a, 'clubs/A/sportparken/eigen'), park));
  await assertSucceeds(setDoc(doc(a, 'clubs/A/sportparken/p-tegenstander'), { ...park, eigen: false }));
  await assertSucceeds(getDoc(doc(c, 'clubs/A/sportparken/eigen')));                                                // coach van de club leest
  await assertSucceeds(getDocs(collection(c, 'clubs/A/sportparken')));
  await assertFails(setDoc(doc(c, 'clubs/A/sportparken/p-test'), park));                                            // maar tekent niet in
  await assertFails(updateDoc(doc(c, 'clubs/A/sportparken/eigen'), { naam: 'Anders' }));
  await assertFails(deleteDoc(doc(c, 'clubs/A/sportparken/eigen')));
  await assertFails(getDoc(doc(b, 'clubs/A/sportparken/eigen')));                                                   // andere club
  await assertFails(getDoc(doc(gast(), 'clubs/A/sportparken/eigen')));
  await assertFails(setDoc(doc(als('adminB'), 'clubs/A/sportparken/p-b'), park));
  await assertFails(setDoc(doc(als('paul', PLATFORM), 'clubs/A/sportparken/p-eindbaas'), park));                    // eindbaas alleen in ondersteuningsmodus
  const melding = { park: 'eigen', parkNaam: 'Sportpark A', veld: 'Veld 3', reden: 'fout', toelichting: 'Staat een veld te ver naar links', teamId: 't1', teamNaam: 'JO11-1', door: 'coachA', status: 'open', ms: nu };
  await assertSucceeds(setDoc(doc(c, 'clubs/A/veldmeldingen/m1'), melding));
  await assertFails(setDoc(doc(c, 'clubs/A/veldmeldingen/m2'), { ...melding, door: 'iemand' }));                    // alleen onder de eigen naam
  await assertFails(setDoc(doc(c, 'clubs/A/veldmeldingen/m3'), { ...melding, status: 'opgelost' }));
  await assertFails(setDoc(doc(c, 'clubs/A/veldmeldingen/m4'), { ...melding, toelichting: 'x'.repeat(501) }));
  await assertFails(setDoc(doc(b, 'clubs/A/veldmeldingen/m5'), { ...melding, door: 'coachB' }));                    // andere club meldt hier niet
  await assertFails(getDoc(doc(c, 'clubs/A/veldmeldingen/m1')));                                                    // meldingen leest alleen clubbeheer
  await assertFails(updateDoc(doc(c, 'clubs/A/veldmeldingen/m1'), { status: 'opgelost' }));
  await assertSucceeds(getDocs(collection(a, 'clubs/A/veldmeldingen')));
  await assertSucceeds(updateDoc(doc(a, 'clubs/A/veldmeldingen/m1'), { status: 'opgelost', opgelostMs: nu }));
  await assertSucceeds(deleteDoc(doc(a, 'clubs/A/veldmeldingen/m1')));
});
/* ---------- [20261124v] veldplanner: roosters en instellingen, alleen als de eindbaas hem aanzet ---------- */
test('veldplanner: clubbeheer en trainingscoördinator plannen, alleen met de schakelaar van de eindbaas aan', async () => {
  const a = als('adminA'), tc = als('tcA'), c = als('coachA');
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { trainingscoordinatoren: { tcA: true } }); });
  const rooster = { naam: 'Basisrooster', status: 'concept', blokken: [{ id: 'b1', team: 't1', dag: 2, start: 1095, eind: 1170, veld: 'v1', vak: 'a', kk: ['k1'] }], bijgewerktMs: nu };
  await assertFails(setDoc(doc(a, 'clubs/A/veldroosters/basis'), rooster));                                         // schakelaar nog uit
  await assertFails(updateDoc(doc(a, 'clubs/A'), { 'platformModules.veldplanner': true }));                         // clubbeheer zet hem niet zelf aan
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { veldplanner: true } }); });
  await assertSucceeds(setDoc(doc(a, 'clubs/A/veldroosters/basis'), rooster));
  await assertSucceeds(updateDoc(doc(tc, 'clubs/A/veldroosters/basis'), { blokken: [] }));                          // trainingscoördinator plant mee
  await assertSucceeds(getDoc(doc(tc, 'clubs/A/veldroosters/basis')));
  await assertSucceeds(setDoc(doc(a, 'clubs/A/veldplanner/instellingen'), { kleedkamers: [{ id: 'k1', naam: 'Kleedkamer 1' }], velden: {} }));
  await assertFails(setDoc(doc(a, 'clubs/A/veldplanner/iets'), { x: 1 }));                                          // alleen het instellingendocument
  await assertFails(getDoc(doc(c, 'clubs/A/veldroosters/basis')));                                                  // coach ziet het concept niet
  await assertFails(setDoc(doc(c, 'clubs/A/veldroosters/basis'), rooster));
  await assertFails(getDoc(doc(als('adminB'), 'clubs/A/veldroosters/basis')));                                      // andere club
  await assertFails(setDoc(doc(a, 'clubs/A/veldroosters/groot'), { ...rooster, blokken: Array.from({ length: 401 }, (_, i) => ({ id: 'b' + i })) }));
  await assertFails(setDoc(doc(a, 'clubs/A/veldroosters/kapot'), { naam: 'zonder blokken' }));
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { veldplanner: false } }); });
  await assertFails(updateDoc(doc(a, 'clubs/A/veldroosters/basis'), { blokken: [] }));                              // weer uit: alleen nog lezen
  await assertSucceeds(getDoc(doc(a, 'clubs/A/veldroosters/basis')));
});
/* ---------- [20261125x] activiteiten: comité, agenda voor de teams, open vrijwilligerslink ---------- */
test('activiteiten: clubbeheer maakt aan, het comité werkt mee, alleen met de schakelaar van de eindbaas aan', async () => {
  const a = als('adminA'), coach = als('coachA'), coord = als('coordA');
  const act = { naam: 'Kersttoernooi', datum: '2026-12-19', comiteUids: [], taken: { t1: { titel: 'Zaal', d: 56, status: 'open' } }, budget: {} };
  await assertFails(setDoc(doc(a, 'clubs/A/activiteiten/k1'), act));                                                  // schakelaar nog uit
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { activiteiten: true } }); });
  await assertSucceeds(setDoc(doc(a, 'clubs/A/activiteiten/k1'), act));
  await assertFails(setDoc(doc(coach, 'clubs/A/activiteiten/k2'), { ...act, comiteUids: ['coachA'] }));               // een coach maakt geen activiteit
  await assertFails(getDoc(doc(coach, 'clubs/A/activiteiten/k1')));                                                    // nog niet in het comité
  await assertSucceeds(updateDoc(doc(a, 'clubs/A/activiteiten/k1'), { comiteUids: ['coachA'], 'comite.coachA': { naam: 'Coach', uid: 'coachA', rol: 'Voorzitter' } }));
  await assertSucceeds(getDoc(doc(coach, 'clubs/A/activiteiten/k1')));
  await assertSucceeds(getDocs(query(collection(coach, 'clubs/A/activiteiten'), where('comiteUids', 'array-contains', 'coachA'))));
  await assertFails(getDocs(collection(coach, 'clubs/A/activiteiten')));                                               // niet alles van de club
  await assertSucceeds(updateDoc(doc(coach, 'clubs/A/activiteiten/k1'), { 'taken.t1.status': 'klaar' }));             // comité werkt mee
  await assertFails(updateDoc(doc(coach, 'clubs/A/activiteiten/k1'), { comiteUids: ['coachA', 'coordA'] }));           // maar kiest het comité niet
  await assertFails(updateDoc(doc(coord, 'clubs/A/activiteiten/k1'), { 'taken.t1.status': 'open' }));                 // geen comité
  await assertFails(deleteDoc(doc(coach, 'clubs/A/activiteiten/k1')));
  await assertFails(getDoc(doc(als('adminB'), 'clubs/A/activiteiten/k1')));                                            // andere club
  await assertFails(updateDoc(doc(a, 'clubs/A/activiteiten/k1'), { naam: '' }));
  /* agenda voor de teams: elk clublid leest, het comité schrijft */
  await assertSucceeds(setDoc(doc(coach, 'clubs/A/activiteitenAgenda/k1'), { naam: 'Kersttoernooi', datum: '2026-12-19', teams: ['t1'] }));
  await assertSucceeds(getDoc(doc(coord, 'clubs/A/activiteitenAgenda/k1')));
  await assertFails(setDoc(doc(coord, 'clubs/A/activiteitenAgenda/k1'), { naam: 'Gekaapt' }));
  await assertFails(getDoc(doc(als('coachB'), 'clubs/A/activiteitenAgenda/k1')));
  /* clubsjablonen */
  await assertSucceeds(setDoc(doc(a, 'clubs/A/activiteitSjablonen/s1'), { naam: 'Ons toernooi', taken: [] }));
  await assertSucceeds(getDoc(doc(coach, 'clubs/A/activiteitSjablonen/s1')));
  await assertFails(setDoc(doc(coach, 'clubs/A/activiteitSjablonen/s2'), { naam: 'X', taken: [] }));
  /* schakelaar weer uit: alleen nog lezen */
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { activiteiten: false } }); });
  await assertFails(updateDoc(doc(a, 'clubs/A/activiteiten/k1'), { naam: 'Nieuw' }));
  await assertSucceeds(getDoc(doc(a, 'clubs/A/activiteiten/k1')));
});
test('toernooi live: iedereen met de link leest, alleen het comité schrijft, dicht is dicht', async () => {
  const a = als('adminA'), coach = als('coachA'), kijker = anoniem('anon1');
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await updateDoc(doc(db, 'clubs/A'), { platformModules: { activiteiten: true } });
    await setDoc(doc(db, 'clubs/A/activiteiten/k1'), { naam: 'Kersttoernooi', comiteUids: ['coachA'] });
  });
  const live = { club: 'A', actId: 'k1', open: true, naam: 'Kersttoernooi', schema: [{ id: 'w1', a: 't1', b: 't2', t: '09:00', v: 'v1' }], uitslag: {} };
  await assertFails(setDoc(doc(als('coordA'), 'toernooiLive/l1'), live));                                                // geen comité
  await assertFails(setDoc(doc(als('adminB'), 'toernooiLive/l1'), live));                                                // andere club
  await assertFails(setDoc(doc(kijker, 'toernooiLive/l1'), live));                                                       // anoniem schrijft niet
  await assertSucceeds(setDoc(doc(coach, 'toernooiLive/l1'), live));
  await assertSucceeds(getDoc(doc(kijker, 'toernooiLive/l1')));
  await assertFails(getDocs(collection(kijker, 'toernooiLive')));                                                        // niet opsommen
  await assertFails(updateDoc(doc(kijker, 'toernooiLive/l1'), { 'uitslag.w1': { a: 9, b: 0 } }));                          // kijker vult geen uitslag in
  await assertSucceeds(updateDoc(doc(a, 'toernooiLive/l1'), { 'uitslag.w1': { a: 2, b: 1 } }));
  await assertFails(updateDoc(doc(coach, 'toernooiLive/l1'), { actId: 'anders' }));                                       // niet omhangen
  await assertSucceeds(setDoc(doc(coach, 'toernooiLive/l1'), { open: false }, { merge: true }));
  await assertFails(getDoc(doc(kijker, 'toernooiLive/l1')));                                                             // dicht
  await assertSucceeds(getDoc(doc(coach, 'toernooiLive/l1')));
  await assertSucceeds(deleteDoc(doc(a, 'toernooiLive/l1')));
});
test('toernooi inschrijven: open link, contactgegevens alleen voor comité en inschrijver', async () => {
  const a = als('adminA'), coach = als('coachA'), gast = anoniem('anon1'), ander = anoniem('anon2');
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await updateDoc(doc(db, 'clubs/A'), { platformModules: { activiteiten: true } });
    await setDoc(doc(db, 'clubs/A/activiteiten/k1'), { naam: 'Kersttoernooi', comiteUids: ['coachA'] });
  });
  const ins = { club: 'A', actId: 'k1', open: true, naam: 'Kersttoernooi', cats: { c1: { naam: 'O11', max: 8, prijs: 25, bezet: 0 } } };
  await assertFails(setDoc(doc(als('coordA'), 'toernooiInschrijf/i1'), ins));                                             // geen comité
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1'), ins));
  await assertSucceeds(setDoc(doc(coach, 'toernooiInschrijf/i1'), ins));
  await assertSucceeds(getDoc(doc(gast, 'toernooiInschrijf/i1')));
  await assertFails(getDocs(collection(gast, 'toernooiInschrijf')));
  const aanm = { uid: 'anon1', club: 'SV Venray', team: 'JO11-1', cat: 'c1', contact: 'Jan', email: 'jan@voorbeeld.nl', tel: '0612345678', opm: '', ms: nu, status: 'nieuw' };
  await assertSucceeds(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_0'), aanm));
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anders'), aanm));                                 // vast id
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_10'), aanm));                               // hooguit tien
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_1'), { ...aanm, cat: 'c9' }));              // categorie bestaat niet
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_1'), { ...aanm, status: 'toegelaten' }));   // laat zichzelf niet toe
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_1'), { ...aanm, betaald: true }));
  await assertFails(setDoc(doc(ander, 'toernooiInschrijf/i1/aanmeldingen/anon2_0'), aanm));                               // niet op andermans uid
  await assertFails(getDoc(doc(ander, 'toernooiInschrijf/i1/aanmeldingen/anon1_0')));                                     // een ander leest geen contactgegevens
  await assertFails(getDocs(collection(ander, 'toernooiInschrijf/i1/aanmeldingen')));
  await assertSucceeds(getDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_0')));
  await assertSucceeds(getDocs(query(collection(gast, 'toernooiInschrijf/i1/aanmeldingen'), where('uid', '==', 'anon1'))));
  await assertSucceeds(getDocs(collection(coach, 'toernooiInschrijf/i1/aanmeldingen')));
  await assertFails(updateDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_0'), { status: 'toegelaten' }));
  await assertSucceeds(updateDoc(doc(coach, 'toernooiInschrijf/i1/aanmeldingen/anon1_0'), { status: 'toegelaten', teamId: 't1', betaald: true }));
  await assertFails(updateDoc(doc(coach, 'toernooiInschrijf/i1/aanmeldingen/anon1_0'), { email: 'ander@voorbeeld.nl' })); // comité past de inschrijving niet aan
  await assertSucceeds(setDoc(doc(coach, 'toernooiInschrijf/i1'), { open: false }, { merge: true }));
  await assertFails(setDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_2'), aanm));                                // dicht
  await assertSucceeds(deleteDoc(doc(gast, 'toernooiInschrijf/i1/aanmeldingen/anon1_0')));                                // zelf intrekken
});
test('kantine-tv en sponsoren: bedragen alleen voor clubbeheer, de tv is openbaar als hij aan staat', async () => {
  const a = als('adminA'), kijker = anoniem('anon1');
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { activiteiten: true } }); });
  await assertSucceeds(setDoc(doc(a, 'clubs/A/sponsoren/s1'), { soort: 'sponsor', titel: 'Bakker', bedrag: 500 }));
  await assertFails(getDoc(doc(als('coachA'), 'clubs/A/sponsoren/s1')));                                                  // coach ziet geen bedragen
  await assertFails(setDoc(doc(als('adminB'), 'clubs/A/sponsoren/s2'), { titel: 'x' }));
  const tv = { club: 'A', open: true, clubNaam: 'Club A', programma: [] };
  await assertFails(setDoc(doc(als('coachA'), 'clubTv/tv1'), tv));
  await assertFails(setDoc(doc(als('adminB'), 'clubTv/tv1'), tv));
  await assertSucceeds(setDoc(doc(a, 'clubTv/tv1'), tv));
  await assertSucceeds(setDoc(doc(a, 'clubTv/tv1/schermen/s1'), { soort: 'sponsor', titel: 'Bakker' }));
  await assertSucceeds(getDoc(doc(kijker, 'clubTv/tv1')));
  await assertSucceeds(getDocs(collection(kijker, 'clubTv/tv1/schermen')));
  await assertFails(getDocs(collection(kijker, 'clubTv')));
  await assertSucceeds(getDocs(query(collection(a, 'clubTv'), where('club', '==', 'A'))));                               // beheer vindt de eigen tv
  await assertFails(setDoc(doc(kijker, 'clubTv/tv1/schermen/s9'), { titel: 'reclame' }));
  await assertFails(updateDoc(doc(kijker, 'clubTv/tv1'), { mededeling: 'x' }));
  await assertFails(updateDoc(doc(a, 'clubTv/tv1'), { club: 'B' }));
  await assertSucceeds(updateDoc(doc(a, 'clubTv/tv1'), { open: false }));
  await assertFails(getDoc(doc(kijker, 'clubTv/tv1')));
  await assertFails(getDocs(collection(kijker, 'clubTv/tv1/schermen')));
});
test('kantine-tv: de clubbeheerder wijst tv-beheerders aan', async () => {
  const a = als('adminA'), tvb = als('coordA');
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { activiteiten: true } }); });
  await assertFails(updateDoc(doc(tvb, 'clubs/A'), { 'tvBeheerders.coordA': true }));                                   // niet zichzelf aanwijzen
  await assertFails(setDoc(doc(tvb, 'clubs/A/sponsoren/s5'), { soort: 'sponsor', titel: 'Bakker' }));
  await assertSucceeds(updateDoc(doc(a, 'clubs/A'), { 'tvBeheerders.coordA': true, 'tvBeheerdersInfo.coordA': { naam: 'Coord' } }));
  await assertSucceeds(setDoc(doc(tvb, 'clubs/A/sponsoren/s5'), { soort: 'sponsor', titel: 'Bakker', bedrag: 250 }));
  await assertSucceeds(getDoc(doc(tvb, 'clubs/A/sponsoren/s5')));
  await assertSucceeds(setDoc(doc(tvb, 'clubTv/tv5'), { club: 'A', open: true, clubNaam: 'Club A', programma: [] }));
  await assertSucceeds(updateDoc(doc(tvb, 'clubTv/tv5'), { sjabloon: 'kubus' }));
  await assertSucceeds(setDoc(doc(tvb, 'clubTv/tv5/schermen/s5'), { soort: 'sponsor', titel: 'Bakker' }));
  await assertFails(setDoc(doc(als('coachA'), 'clubTv/tv5/schermen/s6'), { titel: 'x' }));                              // gewone coach niet
  await assertSucceeds(updateDoc(doc(a, 'clubs/A'), { tvBeheerders: {} }));
  await assertFails(updateDoc(doc(tvb, 'clubTv/tv5'), { sjabloon: 'bord' }));                                            // na intrekken niet meer
});
test('vrijwilligersbank: taken openbaar, aanmeldingen alleen voor clubbeheer en de aanmelder', async () => {
  const a = als('adminA'), ouder = anoniem('anon1'), ander = anoniem('anon2');
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), 'clubs/A'), { platformModules: { activiteiten: true } }); });
  const bank = { club: 'A', open: true, clubNaam: 'Club A', taken: { t1: { titel: 'Bardienst zaterdag', wat: 'Koffie en tosti', nodig: 4 } } };
  await assertFails(setDoc(doc(als('coachA'), 'vrijwilligersBank/b1'), bank));
  await assertSucceeds(setDoc(doc(a, 'vrijwilligersBank/b1'), bank));
  await assertSucceeds(getDoc(doc(ouder, 'vrijwilligersBank/b1')));
  await assertFails(getDocs(collection(ouder, 'vrijwilligersBank')));
  const aanm = { uid: 'anon1', taak: 't1', naam: 'Sandra Jansen', contact: '0612345678', opm: '', ms: nu, status: 'nieuw' };
  await assertSucceeds(setDoc(doc(ouder, 'vrijwilligersBank/b1/aanmeldingen/anon1_t1'), aanm));
  await assertFails(setDoc(doc(ouder, 'vrijwilligersBank/b1/aanmeldingen/anders'), aanm));
  await assertFails(setDoc(doc(ouder, 'vrijwilligersBank/b1/aanmeldingen/anon1_t9'), { ...aanm, taak: 't9' }));
  await assertFails(setDoc(doc(ander, 'vrijwilligersBank/b1/aanmeldingen/anon2_t1'), { ...aanm, uid: 'anon2', status: 'geplaatst' }));
  await assertFails(getDoc(doc(ander, 'vrijwilligersBank/b1/aanmeldingen/anon1_t1')));                                    // geen contactgegevens van een ander
  await assertFails(getDocs(collection(ander, 'vrijwilligersBank/b1/aanmeldingen')));
  await assertSucceeds(getDocs(query(collection(ouder, 'vrijwilligersBank/b1/aanmeldingen'), where('uid', '==', 'anon1'))));
  await assertSucceeds(getDocs(collection(a, 'vrijwilligersBank/b1/aanmeldingen')));
  await assertFails(getDocs(collection(als('coachA'), 'vrijwilligersBank/b1/aanmeldingen')));
  await assertSucceeds(updateDoc(doc(a, 'vrijwilligersBank/b1/aanmeldingen/anon1_t1'), { status: 'geplaatst' }));
  await assertFails(updateDoc(doc(a, 'vrijwilligersBank/b1/aanmeldingen/anon1_t1'), { contact: 'x@y.nl' }));
  await assertSucceeds(updateDoc(doc(a, 'vrijwilligersBank/b1'), { open: false }));
  await assertFails(getDoc(doc(ouder, 'vrijwilligersBank/b1')));
  await assertSucceeds(deleteDoc(doc(ouder, 'vrijwilligersBank/b1/aanmeldingen/anon1_t1')));
});
test('activiteiten: vrijwilligers schrijven zich via de open link in, alleen een voornaam en één keer per dienst', async () => {
  const a = als('adminA'), coach = als('coachA'), ouder = anoniem('anon1'), ander = anoniem('anon2');
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await updateDoc(doc(db, 'clubs/A'), { platformModules: { activiteiten: true } });
    await setDoc(doc(db, 'clubs/A/activiteiten/k1'), { naam: 'Kersttoernooi', comiteUids: ['coachA'] });
  });
  const deel = { club: 'A', actId: 'k1', titel: 'Kersttoernooi', open: true, diensten: { d1: { naam: 'Kantine', start: '09:00', eind: '11:00', nodig: 2 } } };
  await assertFails(setDoc(doc(als('coordA'), 'activiteitDeel/x1'), deel));                                            // geen comité
  await assertFails(setDoc(doc(als('adminB'), 'activiteitDeel/x1'), deel));
  await assertSucceeds(setDoc(doc(coach, 'activiteitDeel/x1'), deel));                                                  // comitélid zet diensten klaar
  await assertSucceeds(getDoc(doc(ouder, 'activiteitDeel/x1')));
  await assertFails(getDocs(collection(ouder, 'activiteitDeel')));                                                     // niet alle links opvragen
  const aanm = { uid: 'anon1', dienst: 'd1', naam: 'Anna', ms: nu, door: 'link' };
  await assertSucceeds(setDoc(doc(ouder, 'activiteitDeel/x1/aanmeldingen/anon1_d1'), aanm));
  await assertFails(setDoc(doc(ouder, 'activiteitDeel/x1/aanmeldingen/anders'), aanm));                                // vast id
  await assertFails(setDoc(doc(ouder, 'activiteitDeel/x1/aanmeldingen/anon1_d9'), { ...aanm, dienst: 'd9' }));          // bestaat niet
  await assertFails(setDoc(doc(ander, 'activiteitDeel/x1/aanmeldingen/anon2_d1'), { ...aanm, uid: 'anon2', naam: 'x'.repeat(25) }));
  await assertFails(setDoc(doc(ander, 'activiteitDeel/x1/aanmeldingen/anon2_d1'), { ...aanm, uid: 'anon2', tel: '0612345678' }));
  await assertFails(setDoc(doc(ander, 'activiteitDeel/x1/aanmeldingen/anon2_d1'), { ...aanm, uid: 'anon2', door: 'comite' }));
  await assertFails(deleteDoc(doc(ander, 'activiteitDeel/x1/aanmeldingen/anon1_d1')));                                 // niet die van een ander
  await assertSucceeds(updateDoc(doc(coach, 'activiteitDeel/x1/aanmeldingen/anon1_d1'), { aanwezig: true }));          // op de dag aftekenen
  await assertFails(updateDoc(doc(coach, 'activiteitDeel/x1/aanmeldingen/anon1_d1'), { naam: 'Ander' }));
  await assertFails(updateDoc(doc(ouder, 'activiteitDeel/x1/aanmeldingen/anon1_d1'), { aanwezig: true }));
  await assertSucceeds(setDoc(doc(a, 'activiteitDeel/x1/aanmeldingen/c1'), { uid: 'adminA', dienst: 'd1', naam: 'Bas', ms: nu, door: 'comite' }));
  await assertFails(updateDoc(doc(coach, 'activiteitDeel/x1'), { club: 'B' }));                                         // club ligt vast
  await assertSucceeds(updateDoc(doc(coach, 'activiteitDeel/x1'), { open: false }));
  await assertFails(getDoc(doc(ander, 'activiteitDeel/x1')));                                                          // link dicht
  await assertFails(setDoc(doc(ander, 'activiteitDeel/x1/aanmeldingen/anon2_d1'), { ...aanm, uid: 'anon2' }));
  await assertSucceeds(deleteDoc(doc(ouder, 'activiteitDeel/x1/aanmeldingen/anon1_d1')));                              // eigen aanmelding weghalen mag altijd
});
test('toernooitje: het eigen team leest en schrijft, een ander team en een andere club niet', async () => {
  const t = { naam: 'Vrijdagtoernooi', status: 'opzet', gemaaktMs: nu };
  await assertSucceeds(setDoc(doc(als('coachA'), 'teams/t1/toernooitjes/x1'), t));
  await assertSucceeds(getDocs(collection(als('coachA'), 'teams/t1/toernooitjes')));
  await assertSucceeds(updateDoc(doc(als('adminA'), 'teams/t1/toernooitjes/x1'), { status: 'bezig' }));             // clubbeheerder mag in elk team van de club
  await assertFails(getDoc(doc(als('coach2'), 'teams/t1/toernooitjes/x1')));
  await assertFails(setDoc(doc(als('coachB'), 'teams/t1/toernooitjes/x2'), t));
});
