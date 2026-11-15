// Storage-regels per gebruikerstype, tegen de emulator (Firestore erbij: de regels lezen het clubdocument).
// Draaien:  npm run test:storage   (Java nodig; eigen poorten, zie firebase.test.json)
// Vaste fictieve accounts, geen echte bestanden.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env;
const uitkomsten = [];
const WW = { firebase: { sign_in_provider: 'password' } };
const opslag = (uid, extra = {}) => (uid ? env.authenticatedContext(uid, { ...WW, ...extra }) : env.unauthenticatedContext()).storage();
const anoniem = uid => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).storage();
const PDF = new Uint8Array([37, 80, 68, 70, 45]), PNG = new Uint8Array([137, 80, 78, 71]), MP4 = new Uint8Array([0, 0, 0, 24]);

async function proef(nr, rol, wat, veilig, actie){
  let uit;
  try { await actie(); uit = 'TOEGESTAAN'; }
  catch (e){ uit = /unauthorized|permission|unauthenticated/i.test(String(e.code || e.message)) ? 'GEWEIGERD' : 'FOUT: ' + (e.code || e.message); }
  uitkomsten.push({ nr, rol, wat, uit, klopt: (veilig === 'weigeren' && uit === 'GEWEIGERD') || (veilig === 'toestaan' && uit === 'TOEGESTAAN') });
}
const zet = (pad, bytes, contentType) => env.withSecurityRulesDisabled(c => uploadBytes(ref(c.storage(), pad), bytes, { contentType }));

before(async () => {
  const [fh, fp] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
  const [sh, sp] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9195').split(':');
  env = await initializeTestEnvironment({
    projectId: 'cluppie-rules-test',
    firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: fh, port: Number(fp) },
    storage: { rules: fs.readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'), host: sh, port: Number(sp) },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'clubs/test-fc'), { naam: 'FC Testdorp', admins: { admin: true }, leden: { admin: true, coach: true }, trainingscoordinatoren: { trainco: true } });
    await setDoc(doc(db, 'clubs/sv-elders'), { naam: 'SV Elders', admins: { ander: true }, leden: { ander: true } });
  });
  await zet('clubs/test-fc/trainingen/m1/training.pdf', PDF, 'application/pdf');
  await zet('clubs/test-fc/videos/v1.mp4', MP4, 'video/mp4');
  await zet('clubs/test-fc/documenten/d1.pdf', PDF, 'application/pdf');
  await zet('clubs/test-fc/trainingvideos/t1/o1.mp4', MP4, 'video/mp4');
});
after(async () => {
  await env?.cleanup();
  console.log('\n=== STORAGE-UITKOMSTEN ===');
  for (const u of uitkomsten.sort((a, b) => a.nr - b.nr))
    console.log(`${u.klopt ? 'ok  ' : 'GAT '} ${String(u.nr).padStart(2)} | ${u.rol.padEnd(22)} | ${u.uit.padEnd(10)} | ${u.wat}`);
  console.log(`=== ${uitkomsten.filter(u => !u.klopt).length} afwijkingen van ${uitkomsten.length} proeven ===`);
});

test('storage: proeven per gebruikerstype', async () => {
  const T = 'clubs/test-fc/trainingen/m1/training.pdf';
  await proef(1, 'coach', 'leest een trainings-PDF van de eigen club', 'toestaan', () => getBytes(ref(opslag('coach'), T)));
  await proef(2, 'coach', 'uploadt een trainings-PDF', 'toestaan', () => uploadBytes(ref(opslag('coach'), 'clubs/test-fc/trainingen/m2/t.pdf'), PDF, { contentType: 'application/pdf' }));
  await proef(3, 'coach', 'uploadt een plaatje bij een training (png)', 'toestaan', () => uploadBytes(ref(opslag('coach'), 'clubs/test-fc/trainingen/m2/diagram1.png'), PNG, { contentType: 'image/png' }));
  await proef(4, 'coach', 'uploadt een ander soort bestand in de trainingsmap (html)', 'weigeren', () => uploadBytes(ref(opslag('coach'), 'clubs/test-fc/trainingen/m2/x.html'), PDF, { contentType: 'text/html' }));
  await proef(5, 'coach', 'uploadt een video', 'toestaan', () => uploadBytes(ref(opslag('coach'), 'clubs/test-fc/videos/v2.mp4'), MP4, { contentType: 'video/mp4' }));
  await proef(6, 'coach', 'uploadt een niet-video in de videomap', 'weigeren', () => uploadBytes(ref(opslag('coach'), 'clubs/test-fc/videos/v3.exe'), MP4, { contentType: 'application/octet-stream' }));
  await proef(7, 'coach', 'uploadt een clubdocument (alleen de clubadmin)', 'weigeren', () => uploadBytes(ref(opslag('coach'), 'clubs/test-fc/documenten/d2.pdf'), PDF, { contentType: 'application/pdf' }));
  await proef(8, 'coach', 'verwijdert een clubvideo (alleen de clubadmin)', 'weigeren', () => deleteObject(ref(opslag('coach'), 'clubs/test-fc/videos/v1.mp4')));
  await proef(9, 'coach andere club', 'leest een bestand van een andere club', 'weigeren', () => getBytes(ref(opslag('ander'), T)));
  await proef(10, 'coach', 'uploadt in de map van een andere club', 'weigeren', () => uploadBytes(ref(opslag('coach'), 'clubs/sv-elders/trainingen/m1/t.pdf'), PDF, { contentType: 'application/pdf' }));
  await proef(11, 'trainingscoördinator', 'leest een trainings-PDF en een video', 'toestaan', async () => { await getBytes(ref(opslag('trainco'), T)); await getBytes(ref(opslag('trainco'), 'clubs/test-fc/videos/v1.mp4')); });
  await proef(12, 'trainingscoördinator', 'leest een clubdocument', 'weigeren', () => getBytes(ref(opslag('trainco'), 'clubs/test-fc/documenten/d1.pdf')));
  await proef(13, 'trainingscoördinator', 'uploadt een training', 'weigeren', () => uploadBytes(ref(opslag('trainco'), 'clubs/test-fc/trainingen/m3/t.pdf'), PDF, { contentType: 'application/pdf' }));
  await proef(14, 'clubadmin', 'uploadt een clubdocument en verwijdert een video', 'toestaan', async () => { await uploadBytes(ref(opslag('admin'), 'clubs/test-fc/documenten/d3.pdf'), PDF, { contentType: 'application/pdf' }); await deleteObject(ref(opslag('admin'), 'clubs/test-fc/videos/v1.mp4')); });
  await proef(15, 'losse trainer', 'leest een bestand van een club', 'weigeren', () => getBytes(ref(opslag('los'), T)));
  await proef(16, 'losse trainer', 'uploadt in een clubmap', 'weigeren', () => uploadBytes(ref(opslag('los'), 'clubs/test-fc/trainingen/m4/t.pdf'), PDF, { contentType: 'application/pdf' }));
  await proef(17, 'ouder (anoniem)', 'leest een trainings-PDF', 'weigeren', () => getBytes(ref(anoniem('ouder'), T)));
  await proef(18, 'niet ingelogd', 'leest een trainings-PDF', 'weigeren', () => getBytes(ref(opslag(null), T)));
  await proef(19, 'coach', 'schrijft buiten de clubmappen', 'weigeren', () => uploadBytes(ref(opslag('coach'), 'los/x.pdf'), PDF, { contentType: 'application/pdf' }));
  await proef(20, 'eindbaas', 'leest een trainings-PDF zonder ondersteuningsmodus', 'weigeren', () => getBytes(ref(opslag('paul', { email: 'pclijten@gmail.com', email_verified: true }), T)));
  const fout = uitkomsten.filter(u => !u.klopt).map(u => `${u.nr} ${u.rol}: ${u.wat} -> ${u.uit}`);
  assert.deepStrictEqual(fout, [], 'afwijkingen van wat veilig is');
});
