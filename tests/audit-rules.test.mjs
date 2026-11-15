// Beveiligingsaudit (WP1): legt vast wat de Firestore-rules NU toelaten, per gebruikerstype.
// Dit bestand keurt niets goed of af: elke proef meldt TOEGESTAAN of GEWEIGERD, met wat veilig zou zijn.
// Draaien:  npm run audit:rules   (Java nodig; start de emulator)
// Vaste fictieve testaccounts (zie docs/rollenkaart.md), nooit echte gegevens.
import { test, before, after } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, Timestamp, deleteDoc } from 'firebase/firestore';

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
    projectId: 'cluppie-rules-test',
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
    await setDoc(doc(db, 'teams/mo11'), { club: 'test-fc', naam: 'MO11-1', bouw: 'midden', leden: { andereCoach: true } });
    await setDoc(doc(db, 'teams/e11'), { club: 'sv-elders', naam: 'O11-1', bouw: 'midden', leden: { ander: true } });
    await setDoc(doc(db, 'teams/los'), { naam: 'Buurtteam O10', leden: { los: true }, eigenClub: { naam: 'Buurt', plaats: 'Testdorp' } });
    for (const t of ['o11', 'o13', 'mo11', 'e11', 'los'])
      await setDoc(doc(db, `teams/${t}/spelers/s1`), { naam: 'Speler 1', nummer: 7, notitie: 'fictieve notitie van de coach', leerpunten: [{ id: 'l1', tekst: 'fictief leerpunt' }] });
    await setDoc(doc(db, 'teams/o13/beoordelingen/b1'), { score: 3 });
    await setDoc(doc(db, 'trainingen/tr1'), { club: 'test-fc', titel: 'Passen', teams: ['o11'] });
    await setDoc(doc(db, 'trainingen/tr1/notities/n1'), { tekst: 'fictieve aantekening', door: 'coach' });
    await setDoc(doc(db, 'trainingDeel/d1'), { teamId: 'o11', trainingId: 'tr1', vervaltOp: morgen, gemaaktDoor: 'coach' });
    await setDoc(doc(db, 'trainingToegang/ouder'), { deelId: 'd1', teamId: 'o11', trainingId: 'tr1', vervaltOp: morgen });
    await setDoc(doc(db, 'clubs/test-fc/uitleningen/u1'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'o11' });
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
  await proef(9, 'coach', 'verplaatst het eigen team naar een andere bouw', 'weigeren', () => updateDoc(doc(als('coach'), 'teams/o11'), { bouw: 'boven' }));
  await proef(10, 'coach', 'voegt zichzelf toe aan een ander team', 'weigeren', () => updateDoc(doc(als('coach'), 'teams/o13'), { 'leden.coach': true }));
  await proef(11, 'coach', 'maakt de teamlijst van de club leeg (clubs.teams)', 'weigeren', () => updateDoc(doc(als('coach'), 'clubs/test-fc'), { teams: {} }));
  await proef(12, 'coach', 'maakt een uitlening aan (interface: alleen admin en coördinator)', 'weigeren',
    () => setDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u2'), { spelerId: 's1', vanTeam: 'o13', naarTeam: 'o11' }));
  await proef(13, 'coach', 'verwijdert een uitlening van een ander team', 'weigeren', () => deleteDoc(doc(als('coach'), 'clubs/test-fc/uitleningen/u1')));
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
  await proef(22, 'trainingscoördinator', 'leest aantekeningen van coaches bij een training (subcollectie)', 'weigeren', () => getDoc(doc(als('trainco'), 'trainingen/tr1/notities/n1')));
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
  /* als laatste: verwijderen maakt het team onbruikbaar voor de andere proeven */
  await proef(7, 'coach', 'verwijdert het eigen clubteam', 'weigeren', () => deleteDoc(doc(als('coach'), 'teams/o11')));
});
