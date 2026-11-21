// De lijst met Cloud Functions waar tools/deploy-alles.ps1 op draait, en de schakelaar voor App Check.
// Draaien: node tests/functies-lijst.test.mjs   (eerst één keer: cd functions && npm install)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { functies, groepen } = await import('../tools/functies-lijst.mjs');
const require = createRequire(import.meta.url);

const lijst = functies();
assert.ok(lijst.length >= 70, 'alle functies uit functions/index.js');
assert.equal(new Set(lijst.map(f => f.naam)).size, lijst.length, 'geen dubbele namen');
assert.ok(lijst.every(f => ['callable', 'trigger', 'gepland', 'https', 'anders'].includes(f.soort)));
for (const naam of ['sluitAan', 'kamerTeam', 'leesMailteksten', 'analyseerClubdocument', 'bewaartermijnen', 'verstuurMail'])
  assert.ok(lijst.some(f => f.naam === naam), naam + ' staat in de lijst');
assert.equal(lijst.find(f => f.naam === 'sluitAan').soort, 'callable');
assert.equal(lijst.find(f => f.naam === 'kamerTeam').soort, 'trigger');
assert.equal(lijst.find(f => f.naam === 'bewaartermijnen').soort, 'gepland');
const g = groepen(lijst, 8);
assert.equal(g.length, Math.ceil(lijst.length / 8));
assert.ok(g.every(r => /^functions:[A-Za-z]+(,functions:[A-Za-z]+){0,7}$/.test(r)), 'elke regel past achter firebase deploy --only');
assert.equal(g.join(',').split(',').length, lijst.length, 'elke functie zit in precies één groep');

/* App Check: één schakelaar, standaard uit, en index.js geeft hem door vóór de functies worden gemaakt */
assert.equal(require('../functions/appcheck.js').AFDWINGEN, false, 'afdwingen gaat pas aan na de stappen in docs/appcheck-afdwingen.md');
assert.equal(require('../functions/node_modules/firebase-functions/lib/v2/options.js').getGlobalOptions().enforceAppCheck, false);
const bron = require('node:fs').readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
assert.ok(bron.indexOf('setGlobalOptions') > 0 && bron.indexOf('setGlobalOptions') < bron.indexOf("require('firebase-functions/v2/https')"), 'setGlobalOptions staat vóór de eerste onCall');
console.log(`functies-lijst: ${lijst.length} functies, ${g.length} groepen, App Check-schakelaar in orde`);
process.exit(0);
