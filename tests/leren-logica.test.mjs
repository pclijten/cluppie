// Test van de app-kant van het leren van gebruik (public/js/leren-logica.js) en de overeenkomst met de server.
// Draaien: node --no-warnings tests/leren-logica.test.mjs  (na `cd functions && npm install`)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = await import('../public/js/leren-logica.js');
const S = require('../functions/leren.js');
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

/* de antwoorden in de app zijn precies die de server accepteert */
ok(JSON.stringify(L.ANTWOORDEN) === JSON.stringify(S.ANTWOORDEN), 'antwoordopties app = server');
ok(L.TERUGBLIK_VRAGEN.length === 3, 'drie tikken');

/* zetAntwoord */
let tb = L.zetAntwoord({}, 'natuurlijk', 'ja');
ok(tb.natuurlijk === 'ja', 'antwoord vastgelegd');
ok(L.zetAntwoord(tb, 'natuurlijk', 'nee').natuurlijk === 'nee', 'antwoord corrigeren kan');
ok(L.zetAntwoord(tb, 'natuurlijk', 'misschien').natuurlijk === 'ja' && !('x' in L.zetAntwoord(tb, 'x', 'ja')), 'ongeldig antwoord of vraag genegeerd');
ok(!L.terugblikKlaar(tb) && L.terugblikKlaar({ natuurlijk: 'ja', energie: 'meer', opnieuw: 'ja' }), 'klaar pas na drie antwoorden');

/* eigen terugblik */
ok(L.terugblikSamenvatting([]).n === 0 && L.terugblikSamenvatting([{ id: 'a' }]).tekst === '', 'zonder terugblik: niets tonen');
const lijst = [
  { terugblik: { natuurlijk: 'ja', energie: 'meer', opnieuw: 'ja', ms: 1 } },
  { terugblik: { natuurlijk: 'ongeveer', energie: 'gelijk', opnieuw: 'ja', ms: 2 } },
  { terugblik: { natuurlijk: 'ja', energie: 'meer', opnieuw: 'nee', ms: 3 } },
  { id: 'zonder' },
];
const sm = L.terugblikSamenvatting(lijst);
ok(sm.n === 3 && sm.tekst === 'Laatste 3 trainingen: 2× natuurlijk · 2× meer energie · 2× weer zo', 'samenvatting: ' + sm.tekst);
ok(L.terugblikSamenvatting([lijst[0]]).tekst.startsWith('Laatste 1 training:'), 'enkelvoud');

/* de signalen die de app maakt, komen schoon door de server */
const ctx = { leeftijd: 10, vormId: 'pos-vierhoek-1', slot: 'kern1' };
const pass = x => S.schoonSignaal(x);
ok(pass(L.signaalVormBewaard(10, ctx))?.actie === 'vorm_bewaard', 'vorm_bewaard komt door de server-filter');
ok(pass(L.signaalVormGewisseld(10, ctx))?.actie === 'vorm_gewisseld', 'vorm_gewisseld komt door de server-filter');
const t = pass(L.signaalTerugblik(10, ['pos-1', 'pos-2'], 'Positiespel opbouw', { natuurlijk: 'ja', energie: 'meer', opnieuw: 'nee', ms: 123 }));
ok(t && t.vormIds.length === 2 && !('ms' in t.antwoord), 'terugblik komt door; ms-veld valt weg');
ok(pass(L.signaalTerugblik(10, ['pos-1'], undefined, { natuurlijk: 'ja' }))?.thema === undefined, 'terugblik zonder thema is geldig');
ok(pass(L.signaalMateriaal(10, 'zuinig'))?.preset === 'zuinig', 'materiaal_gekozen');
ok(pass(L.signaalGat(10, 'materiaal'))?.reden === 'materiaal', 'plan_gat');
ok(L.gatRedenen({ controle: { checks: [{ id: 'materiaal', ok: false }, { id: 'ruimte', ok: true }, { id: 'duur', ok: false }] } }).join() === 'materiaal', 'gatRedenen: alleen materiaal en ruimte');
ok(L.gatRedenen(null).length === 0, 'gatRedenen zonder plan');
console.log(process.exitCode ? '\nFOUTEN' : '\nleren-logica: alle controles geslaagd');
