// Test van functions/trainingsai.js met een nagebootste claude(): invoer wordt begrensd, uitvoer gevalideerd.
// Draaien: node --no-warnings tests/trainingsai.test.js
const assert = require('node:assert/strict');
const { maak, valideerBlokken, leesJson } = require('../functions/trainingsai');
class HttpsError extends Error { constructor(code, m){ super(m); this.code = code; } }
let antwoord = '';
let laatste = null;
const f = maak({ onCall: (o, h) => h, HttpsError, secrets: [], REGIO: 'x', vereisAI: async () => ({}), claude: async (a) => { laatste = a; return { tekst: antwoord, stopReason: 'end_turn' }; }, apiKey: () => 'k', scrubPII: (t) => t });
const req = (data) => ({ auth: { uid: 'u' }, data: { clubId: 'c', ...data } });
const faalt = async (p, code) => { try { await p; } catch (e){ assert.equal(e.code, code); return; } assert.fail('verwachtte fout ' + code); };

(async () => {
  assert.deepEqual(leesJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(leesJson('geen json'), null);

  /* personaliseerTraining */
  const basis = { profiel: { categorie: 'O10', aantalSpelers: 12, niveau: 2, duur: 75, thema: 'Scoren', blokFase: 'Verdiep' }, stijl: 'punten',
    onderdelen: [{ slot: 'warming-up', minuten: 12, vormId: 'x', naam: 'Tikkertje met bal', doel: 'Opwarmen' }, { slot: 'kern1', minuten: 15, naam: 'Vorm 2', doel: 'Doel' }] };
  antwoord = JSON.stringify({ teksten: { 'warming-up': { intro: 'Rustig beginnen.', tip: 'Hoofd omhoog.' }, onbekend: { intro: 'x', tip: 'y' } } });
  const r1 = await f.personaliseerTraining(req(basis));
  assert.deepEqual(Object.keys(r1.teksten), ['warming-up']);
  assert.ok(laatste.system[0].cache_control, 'vaste instructie wordt gecachet');
  assert.ok(!JSON.stringify(laatste.messages).includes('vormId'), 'vormId wordt niet doorgestuurd');
  await faalt(f.personaliseerTraining(req({ ...basis, onderdelen: [] })), 'invalid-argument');
  antwoord = 'onzin';
  await faalt(f.personaliseerTraining(req(basis)), 'internal');

  /* seizoensVoorstel: jaarplan */
  const th = ['Positiespel opbouw', 'Scoren', 'Dieptespel opbouw'];
  const jaar = { modus: 'jaarplan', categorie: 'O10', bouw: 'midden', model: 'Leercurve', weken: 15, toegestaneThemas: th, voorkeursvolgorde: th };
  antwoord = JSON.stringify({ blokken: th.map(t => ({ thema: t, weken: 5, waarom: 'Past hier.' })) });
  assert.equal((await f.seizoensVoorstel(req(jaar))).blokken.length, 3);
  antwoord = JSON.stringify({ blokken: [{ thema: 'Scoren', weken: 5 }, { thema: 'Scoren', weken: 10 }] });
  await faalt(f.seizoensVoorstel(req(jaar)), 'internal');
  antwoord = JSON.stringify({ blokken: [{ thema: 'Verzonnen', weken: 15 }] });
  await faalt(f.seizoensVoorstel(req(jaar)), 'internal');
  await faalt(f.seizoensVoorstel(req({ ...jaar, weken: 2 })), 'invalid-argument');
  assert.equal(valideerBlokken([{ thema: 'A', weken: 4 }, { thema: 'B', weken: 6 }], 10, new Set(['A', 'B'])), true);
  assert.equal(valideerBlokken([{ thema: 'A', weken: 3 }], 3, new Set(['A'])), false);

  /* uitleg */
  antwoord = JSON.stringify({ uitleg: 'Het gemiddelde was 2,3. Jij beslist.' });
  const u = await f.seizoensVoorstel(req({ modus: 'uitleg', voorstel: { titel: 'Blok verlengen', thema: 'Scoren', soort: 'verleng', feiten: { gemiddelde: 2.3, laag: 3 } } }));
  assert.match(u.uitleg, /2,3/);
  await faalt(f.seizoensVoorstel(req({ modus: 'uitleg', voorstel: {} })), 'invalid-argument');
  await faalt(f.seizoensVoorstel(req({ modus: 'raar' })), 'invalid-argument');
  console.log('trainingsai: alle controles geslaagd');
})().catch(e => { console.error(e); process.exit(1); });
