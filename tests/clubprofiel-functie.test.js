// Test van functions/clubprofiel.js met een nagebootste claude(): alleen de eindbaas, invoer begrensd,
// uitvoer gecontroleerd (bekende velden, citaat teruggezocht, contactgegevens gemaskeerd).
// Draaien: node --no-warnings tests/clubprofiel-functie.test.js
const assert = require('node:assert/strict');
const { maak, leesJson, schoonHoofdstukken, schoonUitvoer, citaatKlopt, maskeer, MAX_TEKST } = require('../functions/clubprofiel');
class HttpsError extends Error { constructor(code, m){ super(m); this.code = code; } }
let antwoord = '', stop = 'end_turn', laatste = null, baas = true, bestaat = true;
const f = maak({ onCall: (o, h) => Object.assign(h, { opties: o }), HttpsError, secrets: [], REGIO: 'x', apiKey: () => 'k',
  claude: async (a) => { laatste = a; return { tekst: antwoord, stopReason: stop }; },
  isPlatformBeheerder: async () => baas, db: () => ({ doc: () => ({ get: async () => ({ exists: bestaat }) }) }) });
const faalt = async (p, code) => { try { await p; } catch (e){ assert.equal(e.code, code); return; } assert.fail('verwachtte fout ' + code); };
const H = [{ id: 'bouwen', naam: 'Bouwen', velden: [{ id: 'bouw.indeling', label: 'Bouwen en hun namen', vraag: 'In welke bouwen?' }] },
  { id: 'rollen', naam: 'Rollen', velden: [{ id: 'rol.hoofd', label: 'Eindverantwoordelijke', vraag: 'Wie?' }] }];
const TEKST = '[pagina 2]\nDe jeugd is verdeeld in drie bouwen: de onderbouw, de midden-\nbouw en de bovenbouw. Het hoofd jeugdopleiding is eindverantwoordelijk voor alle teams van de club.';
const req = (data) => ({ auth: { uid: 'u' }, data: { clubId: 'c', documentNaam: 'Plan.pdf', tekst: TEKST, hoofdstukken: H, ...data } });

(async () => {
  assert.deepEqual(leesJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(leesJson('geen json'), null);
  assert.equal(schoonHoofdstukken([{ id: 'x', naam: 'X', velden: [] }, null, { id: 'bouwen', naam: 'B', velden: [{ id: 'bouw.x<script>', label: 'L' }] }])[0].velden[0].id, 'bouw.xscript');

  /* citaat terugzoeken: letterlijk, over een afgebroken regel heen, en niet bij een verzonnen zin */
  assert.equal(citaatKlopt(TEKST, 'drie bouwen: de onderbouw, de middenbouw en de bovenbouw'), true);
  assert.equal(citaatKlopt(TEKST, 'Het hoofd jeugdopleiding is eindverantwoordelijk voor alle teams'), true);
  assert.equal(citaatKlopt(TEKST, 'De technische commissie beslist over de indeling van de teams'), false);
  assert.equal(citaatKlopt(TEKST, ''), false);
  assert.equal(maskeer('Mail jan@club.nl of bel 06-12345678.'), 'Mail [e-mailadres] of bel [telefoonnummer].');

  /* uitvoer: onbekend veld weg, hoogstens drie per veld, overig mag */
  const uit = schoonUitvoer({ bevindingen: [
    { veld: 'bouw.indeling', waarde: 'Drie bouwen', citaat: 'verdeeld in drie bouwen', pagina: 2, zeker: 'hoog' },
    { veld: 'bouw.indeling', waarde: 'B' }, { veld: 'bouw.indeling', waarde: 'C' }, { veld: 'bouw.indeling', waarde: 'D' },
    { veld: 'verzonnen', waarde: 'x' }, { veld: 'rollen.overig', waarde: 'Materiaalman', citaat: 'staat er niet', pagina: 'x', zeker: '?' },
  ] }, H, TEKST);
  assert.equal(uit.length, 4);
  assert.deepEqual([uit[0].citaatOk, uit[0].pagina, uit[0].zeker], [true, 2, 'hoog']);
  assert.deepEqual([uit[3].veld, uit[3].citaatOk, uit[3].pagina, uit[3].zeker], ['rollen.overig', false, null, 'middel']);

  /* de functie zelf */
  antwoord = JSON.stringify({ bevindingen: [{ veld: 'rol.hoofd', waarde: 'Het hoofd jeugdopleiding', citaat: 'Het hoofd jeugdopleiding is eindverantwoordelijk', pagina: 2, zeker: 'hoog' }] });
  const r = await f.analyseerClubdocument(req());
  assert.equal(r.bevindingen.length, 1);
  assert.equal(r.bevindingen[0].citaatOk, true);
  assert.ok(laatste.system[0].cache_control, 'instructie en velden worden gecachet');
  assert.match(laatste.system[0].text, /bouw\.indeling: Bouwen en hun namen/);
  assert.match(laatste.messages[0].content, /Document: Plan\.pdf/);
  assert.equal(f.analyseerClubdocument.opties.timeoutSeconds, 300);

  baas = false; await faalt(f.analyseerClubdocument(req()), 'permission-denied'); baas = true;
  bestaat = false; await faalt(f.analyseerClubdocument(req()), 'not-found'); bestaat = true;
  await faalt(f.analyseerClubdocument(req({ tekst: 'kort' })), 'invalid-argument');
  await faalt(f.analyseerClubdocument(req({ tekst: 'x'.repeat(MAX_TEKST + 1) })), 'invalid-argument');
  await faalt(f.analyseerClubdocument(req({ hoofdstukken: [] })), 'invalid-argument');
  stop = 'max_tokens'; await faalt(f.analyseerClubdocument(req()), 'resource-exhausted'); stop = 'end_turn';
  antwoord = 'onzin'; await faalt(f.analyseerClubdocument(req()), 'internal');
  antwoord = '{"bevindingen":[]}'; assert.deepEqual((await f.analyseerClubdocument(req())).bevindingen, []);

  /* [20261120c] scan lezen: alleen de eindbaas, alleen een JPEG in base64, het beeld gaat vóór de tekst mee */
  const { schoonInstelVelden, schoonInstelWaarde, MAX_BEELD } = require('../functions/clubprofiel');
  const beeld = 'A'.repeat(4000);
  antwoord = 'Jeugdplan\nBel 06-12345678 voor vragen.';
  const scan = await f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld: 'data:image/jpeg;base64,' + beeld } });
  assert.deepEqual(scan, { tekst: 'Jeugdplan\nBel [telefoonnummer] voor vragen.', afgekapt: false });
  assert.deepEqual(laatste.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: beeld } });
  assert.equal(laatste.messages[0].content[1].type, 'text');
  antwoord = '[leeg]'; assert.equal((await f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld } })).tekst, '');
  stop = 'max_tokens'; antwoord = 'half'; assert.equal((await f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld } })).afgekapt, true); stop = 'end_turn';
  await faalt(f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld: 'geen base64 !!' + beeld } }), 'invalid-argument');
  await faalt(f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld: 'A'.repeat(MAX_BEELD + 4) } }), 'invalid-argument');
  baas = false; await faalt(f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld } }), 'permission-denied'); baas = true;

  /* [20261120c] voorstel voor instellingen: elke waarde tegen het veld gecontroleerd, onbekende paden weg */
  const V = [{ pad: 'regels.bouwGrenzen.onderTm', label: 'Jongste bouw tot en met', type: 'getal', min: 6, max: 17 },
    { pad: 'identiteit.kleur', label: 'Clubkleur', type: 'kleur' }, { pad: 'werkwijze', label: 'Werkwijze', type: 'keuze', opties: [['vrij', 'Trainers vrij'], ['club', 'Club stuurt']] },
    { pad: 'pedagogiek.formatie11', label: 'Formatie', type: 'formatie' }, { pad: 'rolNamen.coach', label: 'Naam coach', type: 'tekst', max: 40 }];
  const sv = schoonInstelVelden(V);
  assert.equal(sv.length, 5);
  assert.deepEqual([schoonInstelWaarde(sv[0], '10'), schoonInstelWaarde(sv[0], 30), schoonInstelWaarde(sv[1], '#CC0000'), schoonInstelWaarde(sv[1], 'rood'), schoonInstelWaarde(sv[2], 'club'),
    schoonInstelWaarde(sv[2], 'anders'), schoonInstelWaarde(sv[3], '4-3-3'), schoonInstelWaarde(sv[3], '1:4:3:3'), schoonInstelWaarde(sv[4], 'Trainer'), schoonInstelWaarde(sv[4], 'x'.repeat(41)), schoonInstelWaarde(sv[4], null)],
    [10, undefined, '#cc0000', undefined, 'club', undefined, '4-3-3', undefined, 'Trainer', undefined, undefined]);
  antwoord = JSON.stringify({ waarden: { 'regels.bouwGrenzen.onderTm': 10, 'identiteit.kleur': 'rood', werkwijze: 'club', 'platformModules.ai': true, 'rolNamen.coach': 'Trainer' } });
  const vs = await f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', onderwerp: 'Bouwen', antwoorden: ['Onderbouw t/m O10'], velden: V } });
  assert.deepEqual(vs.waarden, { 'regels.bouwGrenzen.onderTm': 10, werkwijze: 'club', 'rolNamen.coach': 'Trainer' });
  assert.match(laatste.messages[0].content, /pad "werkwijze" \(keuze, opties: "vrij" = Trainers vrij; "club" = Club stuurt\)/);
  assert.match(laatste.messages[0].content, /- Onderbouw t\/m O10/);
  await faalt(f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', antwoorden: [], velden: V } }), 'invalid-argument');
  antwoord = 'onzin'; await faalt(f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', antwoorden: ['x'], velden: V } }), 'internal');
  baas = false; await faalt(f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', antwoorden: ['x'], velden: V } }), 'permission-denied'); baas = true;
  console.log('clubprofiel-functie: ok');
})().catch(e => { console.error(e); process.exit(1); });
