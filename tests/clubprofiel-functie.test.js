// Test van functions/clubprofiel.js met een nagebootst model: alleen de eindbaas, invoer begrensd, uitvoer
// gecontroleerd (bekende velden, citaat teruggezocht, instellingen geldig, contactgegevens gemaskeerd), en de
// aanroep van het model zelf (stroom lezen, terugvallen op een eenvoudiger aanvraag bij een 400).
// Draaien: node --no-warnings tests/clubprofiel-functie.test.js
const assert = require('node:assert/strict');
const { maak, vraagModel, leesStroom, leesJson, schoonHoofdstukken, schoonUitvoer, schoonVoorstel, schoonRondes, citaatKlopt, maskeer, veldenTekst,
  schoonInstelVelden, schoonInstelWaarde, ANALYSE_SCHEMA, VOORSTEL_SCHEMA, MODEL_PROFIEL, MAX_TEKST, MAX_BEELD } = require('../functions/clubprofiel');
class HttpsError extends Error { constructor(code, m){ super(m); this.code = code; } }
let antwoord = '', stop = 'end_turn', laatste = null, laatsteScan = null, baas = true, bestaat = true;
const f = maak({ onCall: (o, h) => Object.assign(h, { opties: o }), HttpsError, secrets: [], REGIO: 'x', apiKey: () => 'k',
  vraag: async (a) => { laatste = a; return { tekst: antwoord, stopReason: stop }; },
  claude: async (a) => { laatsteScan = a; return { tekst: antwoord, stopReason: stop }; },
  isPlatformBeheerder: async () => baas, db: () => ({ doc: () => ({ get: async () => ({ exists: bestaat }) }) }) });
const faalt = async (p, code) => { try { await p; } catch (e){ assert.equal(e.code, code, e.message); return; } assert.fail('verwachtte fout ' + code); };
const GRENZEN = [{ pad: 'regels.bouwGrenzen.onderTm', label: 'Jongste bouw tot en met', type: 'getal', min: 6, max: 17 }, { pad: 'regels.bouwGrenzen.middenTm', label: 'Middelste bouw tot en met', type: 'getal', min: 7, max: 19 }];
const H = [{ id: 'bouwen', naam: 'Bouwen', velden: [{ id: 'bouw.indeling', label: 'Bouwen en hun namen', vraag: 'In welke bouwen?', tekst: true, regels: false, instellingen: [] },
    { id: 'bouw.grenzen', label: 'Leeftijden per bouw', vraag: 'Welke leeftijden?', tekst: true, instellingen: GRENZEN }] },
  { id: 'gedrag', naam: 'Gedrag', velden: [{ id: 'gedrag.regels', label: 'Gedragsregels', vraag: 'Welke regels?', tekst: true, regels: true },
    { id: 'id.kleur', label: 'Clubkleuren', vraag: 'Welke kleur?', tekst: false, instellingen: [{ pad: 'identiteit.kleur', label: 'Clubkleur', type: 'kleur' }] }] }];
const TEKST = '[pagina 2]\nDe jeugd is verdeeld in drie bouwen: de onderbouw (O7 tot en met O10), de midden-\nbouw (O11 tot en met O13) en de bovenbouw. Het hoofd jeugdopleiding is eindverantwoordelijk voor alle teams van de club. Wij zijn altijd op tijd en tonen respect voor de scheidsrechter.';
const req = (data) => ({ auth: { uid: 'u' }, data: { clubId: 'c', documentNaam: 'Plan.pdf', tekst: TEKST, hoofdstukken: H, ...data } });
const bev = (extra) => ({ veld: 'bouw.indeling', status: 'volledig', antwoord: 'Drie bouwen', ontbreekt: '', citaat: 'verdeeld in drie bouwen', pagina: 2, zeker: 'hoog', tekst: 'Wij hebben drie bouwen.', regels: [], instellingen: [], ...extra });

/* een nagebootste stroom van de API */
const sse = (gebeurtenissen) => ({ ok: true, status: 200, body: (async function* (){ const enc = new TextEncoder(); for (const g of gebeurtenissen) yield enc.encode(`event: ${g.type}\ndata: ${JSON.stringify(g)}\n\n`); })() });

(async () => {
  assert.deepEqual(leesJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(leesJson('geen json'), null);
  const sh = schoonHoofdstukken([{ id: 'x', naam: 'X', velden: [] }, null, { id: 'bouwen', naam: 'B', velden: [{ id: 'bouw.x<script>', label: 'L', tekst: false, regels: true, instellingen: GRENZEN }] }]);
  assert.deepEqual([sh.length, sh[0].velden[0].id, sh[0].velden[0].tekst, sh[0].velden[0].regels, sh[0].velden[0].instellingen.length], [1, 'bouw.xscript', false, true, 2]);

  /* citaat terugzoeken: letterlijk, over een afgebroken regel heen, en niet bij een verzonnen zin */
  assert.equal(citaatKlopt(TEKST, 'de onderbouw (O7 tot en met O10), de middenbouw (O11 tot en met O13)'), true);
  assert.equal(citaatKlopt(TEKST, 'Het hoofd jeugdopleiding is eindverantwoordelijk voor alle teams'), true);
  assert.equal(citaatKlopt(TEKST, 'De technische commissie beslist over de indeling van de teams'), false);
  assert.equal(citaatKlopt(TEKST, ''), false);
  assert.equal(maskeer('Mail jan@club.nl of bel 06-12345678.'), 'Mail [e-mailadres] of bel [telefoonnummer].');

  /* instellingen */
  const V = [...GRENZEN, { pad: 'identiteit.kleur', label: 'Clubkleur', type: 'kleur' }, { pad: 'werkwijze', label: 'Werkwijze', type: 'keuze', opties: [['vrij', 'Trainers vrij'], ['club', 'Club stuurt']] },
    { pad: 'pedagogiek.formatie11', label: 'Formatie', type: 'formatie' }, { pad: 'rolNamen.coach', label: 'Naam coach', type: 'tekst', max: 40 }];
  const sv = schoonInstelVelden(V);
  assert.equal(sv.length, 6);
  assert.deepEqual([schoonInstelWaarde(sv[0], '10'), schoonInstelWaarde(sv[0], 'O10'), schoonInstelWaarde(sv[0], 30), schoonInstelWaarde(sv[2], '#CC0000'), schoonInstelWaarde(sv[2], 'rood'), schoonInstelWaarde(sv[3], 'club'),
    schoonInstelWaarde(sv[3], 'anders'), schoonInstelWaarde(sv[4], '4-3-3'), schoonInstelWaarde(sv[4], '1:4:3:3'), schoonInstelWaarde(sv[5], 'Trainer'), schoonInstelWaarde(sv[5], 'x'.repeat(41)), schoonInstelWaarde(sv[5], null)],
    [10, 10, undefined, '#cc0000', undefined, 'club', undefined, '4-3-3', undefined, 'Trainer', undefined, undefined]);

  /* voorstel: alleen wat bij het veld hoort */
  const shH = schoonHoofdstukken(H), grenzen = shH[0].velden[1], regels = shH[1].velden[0], kleur = shH[1].velden[1];
  assert.deepEqual(schoonVoorstel({ tekst: 'Onze onderbouw loopt\n\n\n\ntot en met O10.', regels: ['hoort hier niet'], instellingen: [{ pad: 'regels.bouwGrenzen.onderTm', waarde: 'O10' }, { pad: 'regels.bouwGrenzen.middenTm', waarde: '99' }, { pad: 'platformModules.ai', waarde: 'true' }] }, grenzen),
    { tekst: 'Onze onderbouw loopt\n\ntot en met O10.', regels: [], rondes: [], instellingen: { 'regels.bouwGrenzen.onderTm': 10 } });
  assert.deepEqual(schoonVoorstel({ tekst: 'Zo doen wij het.', regels: ['Op tijd', '', 'Bel 06-12345678'] }, regels).regels, ['Op tijd', 'Bel [telefoonnummer]']);
  assert.deepEqual(schoonVoorstel({ tekst: 'hoort hier niet', instellingen: { 'identiteit.kleur': '#CC0000' } }, kleur), { tekst: '', regels: [], rondes: [], instellingen: { 'identiteit.kleur': '#cc0000' } });

  /* uitvoer: onbekend veld weg, één per veld, overig hoogstens vier per hoofdstuk, halve antwoorden houden hun "ontbreekt" */
  const uit = schoonUitvoer({ bevindingen: [bev(), bev({ antwoord: 'Tweede keer hetzelfde veld' }), bev({ veld: 'verzonnen' }),
    bev({ veld: 'bouw.grenzen', status: 'deels', antwoord: 'Onderbouw t/m O10', ontbreekt: 'De grens van de middenbouw.', citaat: 'staat er niet in het document', pagina: 0, zeker: '?', instellingen: [{ pad: 'regels.bouwGrenzen.onderTm', waarde: '10' }] }),
    ...[1, 2, 3, 4, 5].map(i => bev({ veld: 'gedrag.overig', antwoord: 'Materiaal ' + i + ': iets' })), bev({ veld: 'gedrag.regels', regels: ['Op tijd', 'Respect'], citaat: 'Wij zijn altijd op tijd' }) ] }, shH, TEKST);
  assert.deepEqual(uit.map(b => b.veld), ['bouw.indeling', 'bouw.grenzen', 'gedrag.overig', 'gedrag.overig', 'gedrag.overig', 'gedrag.overig', 'gedrag.regels']);
  assert.deepEqual([uit[0].citaatOk, uit[0].pagina, uit[0].zeker, uit[0].status, uit[0].ontbreekt, uit[0].voorstel.tekst], [true, 2, 'hoog', 'volledig', '', 'Wij hebben drie bouwen.']);
  assert.deepEqual([uit[1].citaatOk, uit[1].pagina, uit[1].zeker, uit[1].status, uit[1].ontbreekt, uit[1].voorstel.instellingen], [false, null, 'middel', 'deels', 'De grens van de middenbouw.', { 'regels.bouwGrenzen.onderTm': 10 }]);
  assert.deepEqual(uit[6].voorstel.regels, ['Op tijd', 'Respect']);

  /* de opdracht noemt per veld wat er gevraagd wordt */
  const vt = veldenTekst(shH);
  assert.match(vt, /- bouw\.grenzen: Leeftijden per bouw\. Welke leeftijden\?\n    instelling "regels\.bouwGrenzen\.onderTm" \(getal, 6 tot en met 17\): Jongste bouw tot en met/);
  assert.match(vt, /- gedrag\.regels: Gedragsregels\. Welke regels\? \[regels\]/);
  assert.match(vt, /- id\.kleur: Clubkleuren\. Welke kleur\? \[geen tekst\]/);
  /* het schema voor gestructureerde uitvoer: elk object dicht, alles verplicht */
  const dicht = s => s.type !== 'object' ? (s.items ? dicht(s.items) : true) : s.additionalProperties === false && Object.keys(s.properties).every(k => s.required.includes(k) && dicht(s.properties[k]));
  assert.equal(dicht(ANALYSE_SCHEMA) && dicht(VOORSTEL_SCHEMA), true);

  /* analyseerClubdocument */
  antwoord = JSON.stringify({ bevindingen: [bev()] });
  const r = await f.analyseerClubdocument(req());
  assert.equal(r.bevindingen.length, 1);
  assert.equal(r.bevindingen[0].citaatOk, true);
  assert.equal(laatste.schema, ANALYSE_SCHEMA);
  assert.equal(laatste.effort, 'high');
  const inhoud = laatste.messages[0].content;
  assert.ok(inhoud[0].cache_control && /^DOCUMENT: Plan\.pdf\n\n\[pagina 2\]/.test(inhoud[0].text), 'het document staat vooraan en wordt gecachet');
  assert.ok(!inhoud[1].cache_control && /bouw\.indeling: Bouwen en hun namen/.test(inhoud[1].text), 'de velden van deze groep komen na het document');
  assert.ok(!/bouw\.indeling/.test(laatste.system[0].text), 'de vaste instructie is voor elke groep gelijk');
  assert.equal(f.analyseerClubdocument.opties.timeoutSeconds, 540);
  baas = false; await faalt(f.analyseerClubdocument(req()), 'permission-denied'); baas = true;
  bestaat = false; await faalt(f.analyseerClubdocument(req()), 'not-found'); bestaat = true;
  await faalt(f.analyseerClubdocument(req({ tekst: 'kort' })), 'invalid-argument');
  await faalt(f.analyseerClubdocument(req({ tekst: 'x'.repeat(MAX_TEKST + 1) })), 'invalid-argument');
  await faalt(f.analyseerClubdocument(req({ hoofdstukken: [] })), 'invalid-argument');
  stop = 'max_tokens'; await faalt(f.analyseerClubdocument(req()), 'resource-exhausted');
  stop = 'refusal'; await faalt(f.analyseerClubdocument(req()), 'failed-precondition'); stop = 'end_turn';
  antwoord = 'onzin'; await faalt(f.analyseerClubdocument(req()), 'internal');
  antwoord = '{"bevindingen":[]}'; assert.deepEqual((await f.analyseerClubdocument(req())).bevindingen, []);

  /* stelClubinstellingenVoor: één antwoord → voorstel (tekst, regels, instellingen) */
  antwoord = JSON.stringify({ tekst: 'Onze onderbouw loopt tot en met O10.', regels: ['x'], instellingen: [{ pad: 'regels.bouwGrenzen.onderTm', waarde: '10' }, { pad: 'platformModules.ai', waarde: 'true' }] });
  const vs = await f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', onderwerp: 'Leeftijden per bouw', vraag: 'Welke leeftijden?', antwoorden: ['Onderbouw t/m O10'], velden: GRENZEN } });
  assert.deepEqual(vs, { tekst: 'Onze onderbouw loopt tot en met O10.', regels: [], rondes: [], instellingen: { 'regels.bouwGrenzen.onderTm': 10 }, waarden: { 'regels.bouwGrenzen.onderTm': 10 } });
  assert.match(laatste.messages[0].content, /Onderwerp: Leeftijden per bouw\nVraag: Welke leeftijden\?\nInstellingen bij dit onderwerp:\n    instelling "regels\.bouwGrenzen\.onderTm"/);
  assert.match(laatste.messages[0].content, /Antwoord van de club:\n- Onderbouw t\/m O10/);
  assert.equal(laatste.schema, VOORSTEL_SCHEMA);
  const vr = await f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', onderwerp: 'Gedragsregels', antwoorden: ['Op tijd zijn'], velden: [], wilRegels: true, wilTekst: false } });
  assert.deepEqual([vr.tekst, vr.regels], ['', ['x']]);
  assert.match(laatste.messages[0].content, /\[geen tekst\] \[regels\]\nBij dit onderwerp horen geen instellingen\./);
  await faalt(f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', antwoorden: [], velden: GRENZEN } }), 'invalid-argument');
  antwoord = 'onzin'; await faalt(f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', antwoorden: ['x'], velden: GRENZEN } }), 'internal');
  baas = false; await faalt(f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', antwoorden: ['x'], velden: GRENZEN } }), 'permission-denied'); baas = true;

  /* [20261120e] evaluatierondes: alleen bij het veld dat ze vraagt, met geldige datums; het seizoen gaat mee naar het model */
  assert.deepEqual(schoonRondes([{ naam: 'Winter', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }, { naam: 'winter', tot: '2027-01-01' }, { naam: 'Fout', tot: 'mei' }, { naam: 'Om', van: '2027-06-01', tot: '2027-05-01' }]),
    [{ naam: 'Winter', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }]);
  const HE = schoonHoofdstukken([{ id: 'evalueren', naam: 'Evalueren', velden: [{ id: 'eval.momenten', label: 'Momenten in het jaar', vraag: 'Wanneer?', rondes: true }, { id: 'eval.wie', label: 'Wie beoordeelt', vraag: 'Wie?' }] }]);
  assert.match(veldenTekst(HE, "2026/'27 (augustus 2026 tot en met juni 2027)"), /^VELDEN\nSeizoen van de club: 2026\/'27 \(augustus 2026 tot en met juni 2027\)\n[\s\S]*- eval\.momenten: Momenten in het jaar\. Wanneer\? \[rondes\]/);
  const ru = schoonUitvoer({ bevindingen: [bev({ veld: 'eval.momenten', rondes: [{ naam: 'Winterevaluatie', soort: 'volledig', van: '2026-12-01', tot: '2026-12-31' }, { naam: 'Voorjaar', soort: 'x', van: '', tot: '2027-05-31' }] }),
    bev({ veld: 'eval.wie', rondes: [{ naam: 'Hoort hier niet', soort: 'snel', van: '', tot: '2027-05-31' }] })] }, HE, TEKST);
  assert.deepEqual(ru[0].voorstel.rondes, [{ naam: 'Winterevaluatie', soort: 'volledig', van: '2026-12-01', tot: '2026-12-31' }, { naam: 'Voorjaar', soort: 'volledig', van: null, tot: '2027-05-31' }]);
  assert.deepEqual(ru[1].voorstel.rondes, []);
  antwoord = JSON.stringify({ bevindingen: [] });
  await f.analyseerClubdocument(req({ hoofdstukken: HE, seizoen: "2026/'27 (augustus 2026 tot en met juni 2027)" }));
  assert.match(laatste.messages[0].content[1].text, /Seizoen van de club: 2026\/'27/);
  antwoord = JSON.stringify({ tekst: 'Wij beoordelen in december.', regels: [], rondes: [{ naam: 'Winter', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }], instellingen: [] });
  const vro = await f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', onderwerp: 'Momenten in het jaar', antwoorden: ['In december'], velden: [], wilRondes: true, seizoen: "2026/'27" } });
  assert.deepEqual(vro.rondes, [{ naam: 'Winter', soort: 'snel', van: '2026-12-01', tot: '2026-12-31' }]);
  assert.match(laatste.messages[0].content, /\[rondes\]\nSeizoen van de club: 2026\/'27\n/);
  assert.deepEqual((await f.stelClubinstellingenVoor({ auth: { uid: 'u' }, data: { clubId: 'c', onderwerp: 'Wie beoordeelt', antwoorden: ['De trainer'], velden: [] } })).rondes, [], 'zonder wilRondes geen rondes');

  /* leesClubscan: alleen de eindbaas, alleen een JPEG in base64, het beeld gaat vóór de tekst mee */
  const beeld = 'A'.repeat(4000);
  antwoord = 'Jeugdplan\nBel 06-12345678 voor vragen.';
  const scan = await f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld: 'data:image/jpeg;base64,' + beeld } });
  assert.deepEqual(scan, { tekst: 'Jeugdplan\nBel [telefoonnummer] voor vragen.', afgekapt: false });
  assert.deepEqual(laatsteScan.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: beeld } });
  antwoord = '[leeg]'; assert.equal((await f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld } })).tekst, '');
  stop = 'max_tokens'; antwoord = 'half'; assert.equal((await f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld } })).afgekapt, true); stop = 'end_turn';
  await faalt(f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld: 'geen base64 !!' + beeld } }), 'invalid-argument');
  await faalt(f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld: 'A'.repeat(MAX_BEELD + 4) } }), 'invalid-argument');
  baas = false; await faalt(f.leesClubscan({ auth: { uid: 'u' }, data: { clubId: 'c', beeld } }), 'permission-denied'); baas = true;

  /* de stroom van het model lezen: tekst uit de delta's, denkblokken overgeslagen, een terugvalblok begint opnieuw */
  const gewoon = await leesStroom(sse([{ type: 'message_start', message: {} }, { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'denk' } }, { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: '{"bevin' } }, { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'dingen":[]}' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 9 } }, { type: 'message_stop' }]), HttpsError);
  assert.deepEqual(gewoon, { tekst: '{"bevindingen":[]}', stopReason: 'end_turn' });
  const terug = await leesStroom(sse([{ type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'half antw' } }, { type: 'content_block_start', index: 1, content_block: { type: 'fallback' } },
    { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: '{"ok":1}' } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }]), HttpsError);
  assert.equal(terug.tekst, '{"ok":1}');
  await faalt(leesStroom(sse([{ type: 'error', error: { type: 'overloaded_error' } }]), HttpsError), 'unavailable');

  /* de aanvraag: gestreamd, zonder temperature (het model weigert die), met gestructureerde uitvoer en terugvalmodel;
     bij een 400 eerst zonder terugvalmodel, dan zonder gestructureerde uitvoer */
  const aanroepen = [];
  const nepFetch = (antwoorden) => async (url, o) => { aanroepen.push({ url, headers: o.headers, body: JSON.parse(o.body) }); const a = antwoorden.shift(); return typeof a === 'number' ? { ok: false, status: a, text: async () => '{"error":{"type":"x","message":"y"}}' } : sse(a); };
  const klaar = [{ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '{}' } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }];
  const basis = { apiKey: 'k', HttpsError, system: [{ type: 'text', text: 's' }], messages: [{ role: 'user', content: 'm' }], schema: VOORSTEL_SCHEMA, pauzeMs: 1 };
  assert.equal((await vraagModel({ ...basis, fetchFn: nepFetch([klaar]) })).tekst, '{}');
  const eerste = aanroepen[0];
  assert.deepEqual([eerste.body.model, eerste.body.stream, eerste.body.fallbacks, eerste.body.output_config.effort, eerste.body.output_config.format.type], [MODEL_PROFIEL, true, 'default', 'high', 'json_schema']);
  assert.ok(!('temperature' in eerste.body) && !('thinking' in eerste.body));
  assert.deepEqual([eerste.headers['x-api-key'], eerste.headers['anthropic-beta']], ['k', 'server-side-fallback-2026-07-01']);
  aanroepen.length = 0;
  assert.equal((await vraagModel({ ...basis, fetchFn: nepFetch([400, 400, klaar]) })).tekst, '{}');
  assert.deepEqual(aanroepen.map(a => [!!a.body.fallbacks, !!a.headers['anthropic-beta'], !!(a.body.output_config && a.body.output_config.format)]), [[true, true, true], [false, false, true], [false, false, false]]);
  aanroepen.length = 0;
  assert.equal((await vraagModel({ ...basis, fetchFn: nepFetch([529, klaar]) })).tekst, '{}', 'bij drukte één keer opnieuw, in dezelfde vorm');
  assert.equal(aanroepen.length, 2); assert.ok(aanroepen[1].body.fallbacks);
  aanroepen.length = 0;
  await faalt(vraagModel({ ...basis, fetchFn: nepFetch([401]) }), require('../functions/ai-fout').foutVanAntwoord(401, '{"error":{"type":"x","message":"y"}}').code);
  assert.equal(aanroepen.length, 1, 'een geweigerde sleutel proberen we niet opnieuw');

  console.log('clubprofiel-functie: ok');
})().catch(e => { console.error(e); process.exit(1); });
