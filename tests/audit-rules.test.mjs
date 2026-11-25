// Beveiligingsaudit (WP1): toetst de Firestore-rules per gebruikerstype.
// Elke proef meldt TOEGESTAAN of GEWEIGERD naast wat veilig is; een afwijking laat de test falen.
// Draaien:  npm run test:rules  of  npm run audit:rules   (Java nodig; start de emulator)
// [20261116n] Eigen projectId: anders wist clearFirestore() hier de database van tests/rules.test.mjs,
// dat in dezelfde emulator draait. Daarnaast draait npm run test:rules de bestanden na elkaar
// (--test-concurrency=1); node --test start meerdere bestanden standaard tegelijk.
// Vaste fictieve testaccounts (zie docs/rollenkaart.md), nooit echte gegevens.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, Timestamp, deleteDoc, deleteField } from 'firebase/firestore';

let env;
const uitkomsten = [];
const morgen = Timestamp.fromMillis(Date.now() + 86400000);
const WW = { firebase: { sign_in_provider: 'password' } };
const als = (uid, extra = {}) => env.authenticatedContext(uid, { ...WW, ...extra }).firestore();
const anoniem = uid => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const EINDBAAS = { email: 'pclijten@gmail.com', email_verified: true };

/* proef(nr, rol, wat, veilig, actie): veilig = 'weigeren' of 'toestaan' (wat de rules zouden moeten doen) */
async function proef(nr, rol, wat, veilig, actie){
  await vulDatabase();   /* elke proef op een verse database: proeven beinvloeden elkaar niet */
  let uit;
  try { await actie(); uit = 'TOEGESTAAN'; }
  catch (e){ uit = /permission|PERMISSION_DENIED|insufficient/i.test(String(e.code || e.message)) ? 'GEWEIGERD' : 'FOUT: ' + (e.code || e.message); }
  const klopt = (veilig === 'weigeren' && uit === 'GEWEIGERD') || (veilig === 'toestaan' && uit === 'TOEGESTAAN');
  uitkomsten.push({ nr, rol, wat, uit, klopt });
}

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'cluppie-audit-test',
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host, port: Number(port) },
  });
});
after(async () => {
  await env?.cleanup();
  console.log('\n=== AUDIT-UITKOMSTEN ===');
  for (const u of uitkomsten.sort((a, b) => a.nr - b.nr))
    console.log(`${u.klopt ? 'ok  ' : 'GAT '} ${String(u.nr).padStart(2)} | ${u.rol.padEnd(22)} | ${u.uit.padEnd(10)} | ${u.wat}`);
  console.log(`=== ${uitkomsten.filter(u => !u.klopt).length} afwijkingen van ${uitkomsten.length} proeven ===`);
});

async function vulDatabase(){
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    /* FC Testdorp: alle rollen bezet. hjo, bouw en meiden zijn ook clublid; bouwLos is coördinator zonder lidmaatschap. */
    await setDoc(doc(db, 'clubs/test-fc'), { naam: 'FC Testdorp',
      admins: { admin: true }, leden: { admin: true, coach: true, coach2: true, meiden: true, bouw: true, hjo: true },
      bouwCoordinatoren: { midden: { bouw: true }, boven: { bouwLos: true } }, hoofdJeugd: { hjo: true },
      trainingscoordinatoren: { trainco: true },
      eigenBouwen: [{ id: 'eb1', naam: 'Meiden', teams: ['mo11'], coaches: { meiden: true } }],
      eigenBouwCoaches: ['meiden'], eigenBouwToegang: { mo11: { meiden: true } },
      teams: { o9: true, o11: true, o13: true, mo11: true } });
    await setDoc(doc(db, 'clubs/sv-elders'), { naam: 'SV Elders', admins: { ander: true }, leden: { ander: true }, teams: { e11: true } });
    await setDoc(doc(db, 'teams/o11'), { club: 'test-fc', naam: 'O11-1', bouw: 'midden', leden: { coach: true, coach2: true }, rollen: { coach: 'coach', coach2: 'coach' } });
    await setDoc(doc(db, 'teams/o13'), { club: 'test-fc', naam: 'O13-1', bouw: 'boven', leden: { andereCoach: true } });
    await setDoc(doc(db, 'teams/mo11'), { club: 'test-fc', naam: 'MO11-1', bouw: 'midden', bouwHandmatig: true, leden: { andereCoach: true } });
    await setDoc(doc(db, 'teams/e11'), { club: 'sv-elders', naam: 'O11-1', bouw: 'midden', leden: { ander: true } });
    await setDoc(doc(db, 'teams/los'), { naam: 'Buurtteam O10', leden: { los: true }, eigenClub: { naam: 'Buurt', plaats: 'Testdorp' } });
    await setDoc(doc(db, 'teams/los-sport'), { naam: 'Buurt O9', leden: { los: true }, eigenClub: { naam: 'Buurt', plaats: 'Testdorp' }, sport: 'voetbal' });   /* [20261125x] */
    for (const t of ['o11', 'o13', 'mo11', 'e11', 'los'])
      await setDoc(doc(db, `teams/${t}/spelers/s1`), { naam: 'Speler 1', nummer: 7, notitie: 'fictieve notitie van de coach', leerpunten: [{ id: 'l1', tekst: 'fictief leerpunt' }] });
    await setDoc(doc(db, 'teams/o13/beoordelingen/b1'), { score: 3 });
    await setDoc(doc(db, 'trainingen/tr1'), { club: 'test-fc', titel: 'Passen', teams: ['o11'] });
    await setDoc(doc(db, 'trainingen/tr1/hotspotSamenvattingen/h1'), { tekst: 'fictieve samenvatting van aantekeningen' });
    await setDoc(doc(db, 'trainingDeel/d1'), { teamId: 'o11', trainingId: 'tr1', vervaltOp: morgen, gemaaktDoor: 'coach' });
    await setDoc(doc(db, 'trainingToegang/ouder'), { deelId: 'd1', teamId: 'o11', trainingId: 'tr1', vervaltOp: morgen });
    await setDoc(doc(db, 'clubs/test-fc/uitleningen/u1'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'o11', overlay: {} });
    await setDoc(doc(db, 'clubs/test-fc/uitleningen/u3'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'mo11', overlay: {} });
    await setDoc(doc(db, 'teams/los2'), { naam: 'Buurtteam O12', leden: { los: true }, koppelVoorstel: { clubId: 'test-fc', clubNaam: 'FC Testdorp', status: 'voorgesteld' } });
  });
}


test('proeven per gebruikerstype', async () => {
  /* --- ouder met een anonieme deel-link --- */
  await proef(1, 'ouder (deel-link)', 'leest volledige spelerdocumenten van het team, met notitie en leerpunten van de coach', 'weigeren',
    async () => { const s = await getDocs(collection(anoniem('ouder'), 'teams/o11/spelers')); if (!s.docs[0].data().notitie) throw { code: 'permission-denied' }; });
  await proef(2, 'ouder (deel-link)', 'leest spelers van een ander team', 'weigeren', () => getDocs(collection(anoniem('ouder'), 'teams/o13/spelers')));

  /* --- coach --- */
  await proef(3, 'coach', 'leest notitie en leerpunten van een speler uit een ander team van de club', 'weigeren',
    async () => { const d = await getDoc(doc(als('coach'), 'teams/o13/spelers/s1')); if (!d.data().notitie) throw { code: 'permission-denied' }; });
  await proef(4, 'coach', 'leest beoordelingen van een ander team van de club', 'weigeren', () => getDoc(doc(als('coach'), 'teams/o13/beoordelingen/b1')));
  await proef(5, 'coach', 'leest spelers van een team van een andere club', 'weigeren', () => getDoc(doc(als('coach'), 'teams/e11/spelers/s1')));
  await proef(6, 'coach', 'plaatst een training in een ANDERE club (club: sv-elders, teams: eigen team)', 'weigeren',
    () => setDoc(doc(als('coach'), 'trainingen/inbraak'), { club: 'sv-elders', titel: 'Ongewenst', teams: ['o11'] }));
  await proef(8, 'coach', 'zet een medecoach op assistent via teams.rollen (buiten wijzigRol en het log om)', 'weigeren',
    () => updateDoc(doc(als('coach'), 'teams/o11'), { 'rollen.coach2': 'assistent' }));
  await proef(9, 'coach', 'verplaatst het eigen team naar een andere bouw zonder de categorie te wijzigen', 'weigeren', () => updateDoc(doc(als('coach'), 'teams/o11'), { bouw: 'boven' }));
  await proef(10, 'coach', 'voegt zichzelf toe aan een ander team', 'weigeren', () => updateDoc(doc(als('coach'), 'teams/o13'), { 'leden.coach': true }));
  await proef(11, 'coach', 'maakt de teamlijst van de club leeg (clubs.teams)', 'weigeren', () => updateDoc(doc(als('coach'), 'clubs/test-fc'), { teams: {} }));
  await proef(12, 'coach', 'maakt een uitlening aan (interface: alleen admin en coördinator)', 'weigeren',
    () => setDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u2'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'o11' }));
  await proef(13, 'coach', 'verwijdert een uitlening tussen twee andere teams', 'weigeren', () => deleteDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u3')));
  await proef(14, 'coach', 'schrijft een speler in het eigen team', 'toestaan', () => updateDoc(doc(als('coach'), 'teams/o11/spelers/s1'), { nummer: 8 }));

  /* --- gekoppelde coach bouw (eigen bouw Meiden met team MO11-1) --- */
  await proef(15, 'gekoppelde coach bouw', 'schrijft een speler in een team van de eigen bouw (beloofd: rechten als bouwcoördinator)', 'toestaan',
    () => updateDoc(doc(als('meiden'), 'teams/mo11/spelers/s1'), { nummer: 9 }));
  await proef(16, 'gekoppelde coach bouw', 'schrijft in een team buiten de eigen bouw', 'weigeren', () => updateDoc(doc(als('meiden'), 'teams/o13/spelers/s1'), { nummer: 9 }));

  /* --- bouwcoördinator --- */
  await proef(17, 'bouwcoördinator', 'schrijft een speler in een team van de eigen bouw', 'toestaan', () => updateDoc(doc(als('bouw'), 'teams/o11/spelers/s1'), { nummer: 10 }));
  await proef(18, 'bouwcoördinator', 'schrijft in een team van een andere bouw', 'weigeren', () => updateDoc(doc(als('bouw'), 'teams/o13/spelers/s1'), { nummer: 10 }));
  await proef(19, 'bouwcoördinator', 'leest beoordelingen van een andere bouw', 'weigeren', () => getDoc(doc(als('bouw'), 'teams/o13/beoordelingen/b1')));
  await proef(20, 'bouwcoördinator', 'coördinator zonder clublidmaatschap leest het clubdocument', 'toestaan', () => getDoc(doc(als('bouwLos'), 'clubs/test-fc')));

  /* --- trainingscoördinator --- */
  await proef(21, 'trainingscoördinator', 'leest een clubtraining', 'toestaan', () => getDoc(doc(als('trainco'), 'trainingen/tr1')));
  await proef(22, 'trainingscoördinator', 'leest de samenvattingen van aantekeningen van coaches bij een training', 'weigeren', () => getDoc(doc(als('trainco'), 'trainingen/tr1/hotspotSamenvattingen/h1')));
  await proef(23, 'trainingscoördinator', 'leest spelers', 'weigeren', () => getDoc(doc(als('trainco'), 'teams/o11/spelers/s1')));
  await proef(24, 'trainingscoördinator', 'wijzigt een training', 'weigeren', () => updateDoc(doc(als('trainco'), 'trainingen/tr1'), { titel: 'x' }));

  /* --- hoofd jeugdopleiding --- */
  await proef(25, 'hoofd jeugdopleiding', 'maakt een clubbreed seizoensplan', 'toestaan', () => setDoc(doc(als('hjo'), 'clubs/test-fc/seizoensplannen/p1'), { bouw: 'club', model: 'a' }));
  await proef(26, 'hoofd jeugdopleiding', 'schrijft een training voor meerdere teams', 'toestaan', () => setDoc(doc(als('hjo'), 'trainingen/tr2'), { club: 'test-fc', titel: 'Club', teams: ['o11', 'o13'] }));
  await proef(27, 'hoofd jeugdopleiding', 'leest beoordelingen van een team waar hij geen coach is', 'weigeren', () => getDoc(doc(als('hjo'), 'teams/o13/beoordelingen/b1')));
  await proef(28, 'hoofd jeugdopleiding', 'wijzigt clubinstellingen', 'weigeren', () => updateDoc(doc(als('hjo'), 'clubs/test-fc'), { naam: 'x' }));

  /* --- clubadmin --- */
  await proef(29, 'clubadmin', 'zet zijn eigen platformModules (schakelaars van de eindbaas)', 'weigeren', () => updateDoc(doc(als('admin'), 'clubs/test-fc'), { 'platformModules.ai': true }));
  await proef(30, 'clubadmin', 'leest spelers van een andere club', 'weigeren', () => getDoc(doc(als('admin'), 'teams/e11/spelers/s1')));
  await proef(31, 'clubadmin', 'haalt een team van een andere club naar de eigen club', 'weigeren', () => updateDoc(doc(als('admin'), 'teams/e11'), { club: 'test-fc' }));
  await proef(32, 'clubadmin', 'haalt een LOS team (zonder club) naar de eigen club zonder aanvraag', 'weigeren', () => updateDoc(doc(als('admin'), 'teams/los'), { club: 'test-fc' }));

  /* --- losse trainer --- */
  await proef(33, 'losse trainer', 'schrijft een training onder het eigen team', 'toestaan', () => setDoc(doc(als('los'), 'teams/los/trainingen/t1'), { titel: 'Eigen' }));
  await proef(34, 'losse trainer', 'leest een clubtraining', 'weigeren', () => getDoc(doc(als('los'), 'trainingen/tr1')));
  await proef(35, 'losse trainer', 'koppelt zijn team zelf aan een club (veld club)', 'weigeren', () => updateDoc(doc(als('los'), 'teams/los'), { club: 'test-fc' }));
  await proef(36, 'losse trainer', 'zet zelf een koppelvoorstel naar een willekeurige club op zijn team (hoort van de eindbaas te komen)', 'weigeren',
    () => updateDoc(doc(als('los'), 'teams/los'), { koppelVoorstel: { clubId: 'test-fc', clubNaam: 'FC Testdorp', status: 'voorgesteld' } }));
  await proef(37, 'losse trainer', 'leest het clubdocument van een club', 'weigeren', () => getDoc(doc(als('los'), 'clubs/test-fc')));

  /* --- eindbaas zonder ondersteuningsmodus --- */
  await proef(38, 'eindbaas', 'leest spelers (met namen) zonder ondersteuningsmodus', 'weigeren', () => getDoc(doc(als('paul', EINDBAAS), 'teams/o11/spelers/s1')));
  await proef(39, 'eindbaas', 'leest een teamdocument (namen van coaches) zonder ondersteuningsmodus', 'toestaan', () => getDoc(doc(als('paul', EINDBAAS), 'teams/o11')));
  await proef(40, 'eindbaas', 'leest spelers van een LOS team zonder ondersteuningsmodus', 'weigeren', () => getDoc(doc(als('paul', EINDBAAS), 'teams/los/spelers/s1')));
  await proef(41, 'eindbaas', 'eindbaas-adres zonder bevestigd e-mailadres leest clubs', 'weigeren', () => getDoc(doc(als('nep', { email: 'pclijten@gmail.com', email_verified: false }), 'clubs/sv-elders')));
  await proef(42, 'coach', 'voegt een willekeurig account toe als coach van het eigen team (teams.leden), buiten uitnodiging en log om', 'weigeren',
    () => updateDoc(doc(als('coach'), 'teams/o11'), { 'leden.indringer': true }));
  await proef(43, 'coach', 'zet werkwijzeVrij op het eigen team (omzeilt Club stuurt)', 'weigeren', () => updateDoc(doc(als('coach'), 'teams/o11'), { werkwijzeVrij: true }));
  await proef(44, 'coach', 'verplaatst het eigen clubteam naar een andere club (veld club)', 'weigeren', () => updateDoc(doc(als('coach'), 'teams/o11'), { club: 'sv-elders' }));
  await proef(45, 'ouder (deel-link)', 'leest het teamdocument (namen van coaches, vaste afmeldingen)', 'weigeren', () => getDoc(doc(anoniem('ouder'), 'teams/o11')));
  await proef(46, 'coach', 'leest het Sportlink-geheim van de club', 'weigeren', () => getDoc(doc(als('coach'), 'clubs/test-fc/geheim/_sportlink')));
  await proef(47, 'clubadmin', 'leest het toegangslog van een andere club', 'weigeren', () => getDocs(collection(als('admin'), 'toegangslog')));

  /* --- wat moet blijven werken na de aanscherping [20261115d] --- */
  await proef(48, 'coach', 'haalt een medecoach uit het eigen team', 'toestaan', () => updateDoc(doc(als('coach'), 'teams/o11'), { 'leden.coach2': deleteField(), 'ledenInfo.coach2': deleteField() }));
  await proef(49, 'coach', 'verlaat het eigen team', 'toestaan', () => updateDoc(doc(als('coach'), 'teams/o11'), { 'leden.coach': deleteField() }));
  await proef(50, 'coach', 'wijzigt naam en trainingsmomenten van het eigen team', 'toestaan', () => updateDoc(doc(als('coach'), 'teams/o11'), { naam: 'O11-1 nieuw', trainingsmomenten: [{ dag: 2, begin: '18:00', eind: '19:00' }] }));
  await proef(73, 'coach', 'wijzigt de categorie van het eigen team; de bouw volgt', 'toestaan', () => updateDoc(doc(als('coach'), 'teams/o11'), { categorie: 'JO13', format: '11v11', bouw: 'boven' }));
  await proef(74, 'coach', 'wijzigt de categorie van een team dat de club met de hand heeft ingedeeld, mét bouw', 'weigeren', () => updateDoc(doc(als('andereCoach'), 'teams/mo11'), { categorie: 'JO13', bouw: 'boven' }));
  await proef(51, 'coach', 'werkt een uitlening naar het eigen team bij (nummer, positie)', 'toestaan', () => updateDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u1'), { 'overlay.nummer': 12 }));
  await proef(52, 'coach', 'zet een ingeleende speler terug (uitlening naar het eigen team verwijderen)', 'toestaan', () => deleteDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u1')));
  await proef(53, 'coach', 'maakt een training voor het eigen team in de eigen club', 'toestaan', () => setDoc(doc(als('coach'), 'trainingen/eigen'), { club: 'test-fc', titel: 'Eigen', teams: ['o11'] }));
  await proef(54, 'coach', 'registreert een nieuw team in de teamlijst van de club (alleen toevoegen)', 'toestaan', () => updateDoc(doc(als('coach'), 'clubs/test-fc'), { 'teams.nieuw': true }));
  await proef(55, 'gekoppelde coach bouw', 'leent een speler uit vanuit een team van de eigen bouw', 'toestaan', () => setDoc(doc(als('meiden'), 'clubs/test-fc/uitleningen/u4'), { spelerId: 's1', vanTeam: 'mo11', naarTeam: 'o13', overlay: {} }));
  await proef(56, 'gekoppelde coach bouw', 'leest beoordelingen van een team buiten de eigen bouw', 'weigeren', () => getDoc(doc(als('meiden'), 'teams/o13/beoordelingen/b1')));
  await proef(57, 'bouwcoördinator', 'leent een speler uit vanuit de eigen bouw', 'toestaan', () => setDoc(doc(als('bouw'), 'clubs/test-fc/uitleningen/u5'), { spelerId: 's1', vanTeam: 'o11', naarTeam: 'o13', overlay: {} }));
  await proef(58, 'bouwcoördinator', 'leent een speler uit tussen twee teams buiten de eigen bouw', 'weigeren', () => setDoc(doc(als('bouw'), 'clubs/test-fc/uitleningen/u6'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'o13', overlay: {} }));
  await proef(59, 'bouwcoördinator', 'zet een team van de eigen bouw in een andere bouw en voegt een coach toe', 'toestaan', () => updateDoc(doc(als('bouw'), 'teams/o11'), { bouw: 'boven', 'leden.nieuweCoach': true }));
  await proef(60, 'bouwcoördinator', 'wijst een training toe aan één team van de eigen bouw', 'toestaan', () => setDoc(doc(als('bouw'), 'trainingen/toew'), { club: 'test-fc', titel: 'Plan', teams: ['o11'] }));
  await proef(61, 'bouwcoördinator', 'verplaatst een team van de eigen bouw naar een andere club', 'weigeren', () => updateDoc(doc(als('bouw'), 'teams/o11'), { club: 'sv-elders' }));
  await proef(62, 'clubadmin', 'leent een speler uit tussen twee teams van de club', 'toestaan', () => setDoc(doc(als('admin'), 'clubs/test-fc/uitleningen/u7'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'o11', overlay: {} }));
  await proef(63, 'clubadmin', 'leent uit naar een team van een andere club', 'weigeren', () => setDoc(doc(als('admin'), 'clubs/test-fc/uitleningen/u8'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'e11', overlay: {} }));
  await proef(64, 'clubadmin', 'koppelt een team los van de club en verwijdert een clubteam', 'toestaan', async () => { await updateDoc(doc(als('admin'), 'teams/o13'), { club: deleteField() }); await deleteDoc(doc(als('admin'), 'teams/o11')); });
  await proef(65, 'clubadmin', 'verplaatst een eigen team naar een andere club', 'weigeren', () => updateDoc(doc(als('admin'), 'teams/o11'), { club: 'sv-elders' }));
  await proef(66, 'losse trainer', 'verwijdert het eigen team', 'toestaan', () => deleteDoc(doc(als('los'), 'teams/los')));
  await proef(67, 'losse trainer', 'reageert op een koppelvoorstel van de eindbaas (alleen de status)', 'toestaan', () => updateDoc(doc(als('los'), 'teams/los2'), { 'koppelVoorstel.status': 'later' }));
  await proef(68, 'losse trainer', 'laat een bestaand koppelvoorstel naar een andere club wijzen', 'weigeren', () => updateDoc(doc(als('los'), 'teams/los2'), { 'koppelVoorstel.clubId': 'sv-elders' }));
  await proef(69, 'losse trainer', 'zet een Sportlink-teamcode op het eigen team', 'weigeren', () => updateDoc(doc(als('los'), 'teams/los'), { sportlinkTeamcode: '123456' }));
  await proef(70, 'ouder (deel-link)', 'leest de gedeelde training en de deel-link (met naam en nummer van de spelers)', 'toestaan', async () => { await getDoc(doc(anoniem('ouder'), 'trainingen/tr1')); await getDoc(doc(anoniem('ouder'), 'trainingDeel/d1')); });
  await proef(71, 'coach', 'maakt een deel-link voor het eigen team', 'toestaan', () => setDoc(doc(als('coach'), 'trainingDeel/d2'), { teamId: 'o11', trainingId: 'tr1', vervaltOp: morgen, gemaaktDoor: 'coach', spelers: [{ id: 's1', naam: 'Speler 1', nummer: 7 }] }));
  await proef(72, 'trainingscoördinator', 'leest het clubdocument en de teams van de club', 'toestaan', async () => { await getDoc(doc(als('trainco'), 'clubs/test-fc')); await getDoc(doc(als('trainco'), 'teams/o11')); });

  /* --- [20261115e] spelerdocumenten, uitleningen en privé-beoordelingen (audit H2) --- */
  await proef(75, 'coach', 'leest de spelerslijst van het eigen team', 'toestaan', () => getDocs(collection(als('coach'), 'teams/o11/spelers')));
  await proef(76, 'coach', 'leest de uitleningen naar het eigen team', 'toestaan', () => getDocs(query(collection(als('coach'), 'clubs/test-fc/uitleningen'), where('naarTeam', '==', 'o11'))));
  await proef(77, 'coach', 'leest een uitlening tussen twee andere teams (snapshot met leerpunten)', 'weigeren', () => getDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u3')));
  await proef(78, 'coach', 'leest alle uitleningen van de club', 'weigeren', () => getDocs(collection(als('coach'), 'clubs/test-fc/uitleningen')));
  await proef(79, 'bouwcoördinator', 'leest spelers van een team uit een andere bouw (uitlenen)', 'toestaan', () => getDocs(collection(als('bouw'), 'teams/o13/spelers')));
  await proef(80, 'bouwcoördinator', 'leest alle uitleningen van de club', 'toestaan', () => getDocs(collection(als('bouw'), 'clubs/test-fc/uitleningen')));
  await proef(81, 'gekoppelde coach bouw', 'leest spelers van een ander team van de club (uitlenen)', 'toestaan', () => getDoc(doc(als('meiden'), 'teams/o13/spelers/s1')));
  await proef(82, 'gekoppelde coach bouw', 'leest beoordelingen van een team in de eigen bouw', 'toestaan', () => setDoc(doc(als('meiden'), 'teams/mo11/beoordelingen/b9'), { score: 2 }));
  await proef(83, 'hoofd jeugdopleiding', 'leest spelers van een team van de club', 'toestaan', () => getDoc(doc(als('hjo'), 'teams/o13/spelers/s1')));
  await proef(84, 'trainingscoördinator', 'leest uitleningen van de club', 'weigeren', () => getDocs(collection(als('trainco'), 'clubs/test-fc/uitleningen')));
  await proef(85, 'clubadmin', 'leest spelers en uitleningen van de hele club', 'toestaan', async () => { await getDocs(collection(als('admin'), 'teams/o13/spelers')); await getDocs(collection(als('admin'), 'clubs/test-fc/uitleningen')); });
  await proef(86, 'coach', 'bewaart een privé-beoordeling, zichtbaar voor zichzelf en de sturende rollen', 'toestaan',
    () => setDoc(doc(als('coach'), 'beoordelingenPrive/p1'), { teamId: 'o11', club: 'test-fc', door: { uid: 'coach' }, zichtbaarVoor: ['coach', 'admin', 'hjo', 'bouw'] }));
  await proef(87, 'coach', 'zet een buitenstaander in de lezerslijst van een privé-beoordeling', 'weigeren',
    () => setDoc(doc(als('coach'), 'beoordelingenPrive/p2'), { teamId: 'o11', club: 'test-fc', door: { uid: 'coach' }, zichtbaarVoor: ['coach', 'ander'] }));
  await proef(88, 'coach', 'zet een medecoach in de lezerslijst van een privé-beoordeling', 'weigeren',
    () => setDoc(doc(als('coach'), 'beoordelingenPrive/p3'), { teamId: 'o11', club: 'test-fc', door: { uid: 'coach' }, zichtbaarVoor: ['coach', 'coach2'] }));
  /* --- sportprofiel [20261125x]: de sport zet alleen de eindbaas; een team kiest alleen zonder club, daarna vast --- */
  await proef(89, 'clubadmin', 'wijzigt de sport van de eigen club', 'weigeren', () => updateDoc(doc(als('admin'), 'clubs/test-fc'), { sport: 'voetbal' }));
  await proef(90, 'eindbaas', 'zet de sport van een club', 'toestaan', () => updateDoc(doc(als('paul', EINDBAAS), 'clubs/test-fc'), { sport: 'voetbal' }));
  await proef(91, 'eindbaas', 'zet een sport die de app niet kent', 'weigeren', () => updateDoc(doc(als('paul', EINDBAAS), 'clubs/test-fc'), { sport: 'curling' }));
  await proef(92, 'losse trainer', 'maakt een team zonder club met een sport', 'toestaan', () => setDoc(doc(als('los'), 'teams/los-nieuw'), { naam: 'Buurt O8', leden: { los: true }, sport: 'voetbal' }));
  await proef(93, 'losse trainer', 'maakt een team met een sport die de app niet kent', 'weigeren', () => setDoc(doc(als('los'), 'teams/los-nieuw2'), { naam: 'Buurt O8', leden: { los: true }, sport: 'curling' }));
  await proef(94, 'coach', 'maakt een clubteam met een eigen sport (een clubteam volgt de club)', 'weigeren', () => setDoc(doc(als('coach'), 'teams/o9-sport'), { naam: 'O9-1', club: 'test-fc', leden: { coach: true }, sport: 'voetbal' }));
  await proef(95, 'losse trainer', 'wijzigt de sport van het eigen team', 'weigeren', () => updateDoc(doc(als('los'), 'teams/los-sport'), { sport: 'hockey' }));
  await proef(96, 'bouwcoördinator', 'zet een sport op een team van de eigen bouw', 'weigeren', () => updateDoc(doc(als('bouw'), 'teams/o11'), { sport: 'voetbal' }));
  await proef(97, 'losse trainer', 'wijzigt de naam van het eigen team (sport blijft gelijk)', 'toestaan', () => updateDoc(doc(als('los'), 'teams/los'), { naam: 'Buurtteam O10 groen' }));
  await proef(98, 'losse trainer', 'wijzigt de naam van het eigen team met een sport (sport blijft gelijk)', 'toestaan', () => updateDoc(doc(als('los'), 'teams/los-sport'), { naam: 'Buurt O9 groen' }));
  /* [20261126c] vier sporten: de eindbaas zet elke sport op een club; een losse trainer alleen een open sport (hockey e.a. zijn nog pilot) */
  await proef(99, 'eindbaas', 'zet een club op hockey', 'toestaan', () => updateDoc(doc(als('paul', EINDBAAS), 'clubs/test-fc'), { sport: 'hockey' }));
  await proef(100, 'eindbaas', 'zet een club op korfbal', 'toestaan', () => updateDoc(doc(als('paul', EINDBAAS), 'clubs/test-fc'), { sport: 'korfbal' }));
  await proef(101, 'losse trainer', 'maakt een hockeyteam zonder club (pilot)', 'weigeren', () => setDoc(doc(als('los'), 'teams/los-hockey'), { naam: 'Buurt O9', leden: { los: true }, sport: 'hockey' }));
  await proef(102, 'clubadmin', 'zet de eigen club op volleybal', 'weigeren', () => updateDoc(doc(als('admin'), 'clubs/test-fc'), { sport: 'volleybal' }));
  /* als laatste: verwijderen maakt het team onbruikbaar voor de andere proeven */
  await proef(7, 'coach', 'verwijdert het eigen clubteam', 'weigeren', () => deleteDoc(doc(als('coach'), 'teams/o11')));
  const fout = uitkomsten.filter(u => !u.klopt).map(u => `${u.nr} ${u.rol}: ${u.wat} -> ${u.uit}`);
  assert.deepStrictEqual(fout, [], 'afwijkingen van wat veilig is');
});
