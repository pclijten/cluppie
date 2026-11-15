/* Test voor functions/ai-fout.js: vertaling van API-fouten en de verbruiksregel. node tests/ai-fout.test.js */
const assert = require('node:assert');
const { foutVanAntwoord, verbruikRegel } = require('../functions/ai-fout');
let n = 0;
const ok = (v, m) => { assert.ok(v, m); n++; };
const j = (type, message) => JSON.stringify({ type: 'error', error: { type, message } });

// tijdelijk: opnieuw proberen
for (const s of [429, 500, 502, 503, 529]) ok(foutVanAntwoord(s, j('overloaded_error', 'Overloaded')).code === 'unavailable', `${s} is tijdelijk`);
// tegoed of bestedingslimiet op: AI staat uit, geen storing
ok(foutVanAntwoord(402, j('billing_error', 'Payment required')).code === 'failed-precondition', '402');
ok(foutVanAntwoord(400, j('invalid_request_error', 'Your credit balance is too low to access the Anthropic API.')).code === 'failed-precondition', '400 tegoed');
ok(foutVanAntwoord(400, j('invalid_request_error', 'You have reached your specified API usage limits.')).code === 'failed-precondition', '400 limiet');
ok(foutVanAntwoord(400, j('billing_error', 'x')).soort === 'tegoed', 'type billing_error');
// afgewezen aanvraag of sleutel: nooit als 503 (unavailable)
for (const [s, t] of [[400, 'invalid_request_error'], [401, 'authentication_error'], [403, 'permission_error'], [404, 'not_found_error'], [413, 'request_too_large']]){
  const f = foutVanAntwoord(s, j(t, 'max_tokens: must be positive'));
  ok(f.code === 'internal' && f.soort === 'afgewezen', `${s} is afgewezen`);
}
// geen JSON of leeg antwoord
ok(foutVanAntwoord(400, '<html>').code === 'internal', 'geen json');
ok(foutVanAntwoord(500, '').code === 'unavailable', 'leeg 500');
ok(foutVanAntwoord(400).code === 'internal', 'zonder tekst');
// de melding verraadt geen details van de API
ok(!/credit|balance|api/i.test(foutVanAntwoord(400, j('invalid_request_error', 'credit balance')).bericht.replace('AI-tegoed', '')), 'geen API-details');

// verbruik
ok(verbruikRegel('m', { input_tokens: 12, cache_creation_input_tokens: 4500, cache_read_input_tokens: 0, output_tokens: 80 })
  === '[claude] verbruik model=m invoer=12 cacheSchrijven=4500 cacheLezen=0 uitvoer=80', 'regel');
ok(verbruikRegel('m', null).endsWith('invoer=0 cacheSchrijven=0 cacheLezen=0 uitvoer=0'), 'zonder usage');
console.log(`ai-fout: ${n} controles geslaagd`);

// AI voor losse trainers: alleen met een bevestigd e-mailadres (audit M7)
(async () => {
  const { vereisSoloAI } = require('../functions/solo-ai');
  class HttpsError extends Error { constructor(code, m){ super(m); this.code = code; } }
  let code = null;
  try { await vereisSoloAI({ db: null, HttpsError, FieldValue: {}, request: { auth: { uid: 'los', token: { email_verified: false } }, data: { teamId: 't' } } }); }
  catch (e){ code = e.code; }
  assert.strictEqual(code, 'failed-precondition', 'solo-AI zonder bevestigd adres geweigerd');
  console.log('ai-fout: solo-AI vraagt een bevestigd e-mailadres');
})().catch(e => { console.error(e); process.exit(1); });
