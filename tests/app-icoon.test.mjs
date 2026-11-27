// tests/app-icoon.test.mjs — het clublogo als app-icoon (public/js/app-icoon.js + sw.js)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { korteNaam, maakManifest, handtekening, APP_CACHE, VULLING } from '../public/js/app-icoon.js';

// naam onder het icoon
assert.equal(korteNaam('Asv 33', "ASV'33"), "ASV'33");
assert.equal(korteNaam('Asv 33', ''), 'Asv 33');
assert.equal(korteNaam('Rooms Katholieke Voetbalvereniging Juventa', ''), 'Cluppie');
assert.equal(korteNaam('', ''), 'Cluppie');

// manifest: zelfde app als public/manifest.webmanifest (start_url, scope, geen eigen id)
const basis = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const m = maakManifest('Asv 33', "ASV'33");
for (const k of ['start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.equal(m[k], basis[k], k);
assert.equal(m.id, basis.id);
assert.equal(m.short_name, "ASV'33");
assert.equal(m.name, 'Asv 33 · Cluppie');
assert.deepEqual(m.icons.map(i => i.src), ['icons/club-192.png', 'icons/club-512.png', 'icons/club-192-maskable.png', 'icons/club-512-maskable.png']);
assert.ok(m.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'));

// de terugvalbestanden bestaan op de site (Cluppie-logo als de cache leeg is)
for (const i of m.icons) readFileSync(new URL('../public/' + i.src, import.meta.url));

// handtekening verandert met logo en naam
assert.notEqual(handtekening('a', 'X', 'l1'), handtekening('a', 'X', 'l2'));
assert.notEqual(handtekening('a', 'X', 'l1', 'A'), handtekening('a', 'X', 'l1', 'B'));
assert.equal(handtekening('a', 'X', 'l1'), handtekening('a', 'X', 'l1'));

// maskable: Android knipt een cirkel/druppel uit; alleen de middelste 80% is zeker zichtbaar.
// Clublogo's zijn meestal rond of een schild, dus het vak mag iets ruimer dan de strikte diagonaal.
assert.ok(VULLING.maskable < VULLING.any && VULLING.maskable <= 0.7);

// sw.js: zelfde cachenaam, en die valt niet onder de opruiming van 'cluppie-'-caches
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
assert.ok(sw.includes(`const APP_CACHE = '${APP_CACHE}'`));
assert.ok(!APP_CACHE.startsWith('cluppie-'));
console.log('app-icoon: alles goed');

// teamkamer: eigen manifest, zelfde app als public/kamer.webmanifest
const kb = JSON.parse(readFileSync(new URL('../public/kamer.webmanifest', import.meta.url), 'utf8'));
const km = maakManifest('Asv 33', "ASV'33", 'kamer');
for (const k of ['id', 'start_url', 'scope', 'display', 'orientation']) assert.equal(km[k], kb[k], 'kamer ' + k);
assert.equal(km.short_name, "ASV'33 Team");
assert.equal(maakManifest('Club met een lange naam', '', 'kamer').short_name, 'Teamkamer');
assert.ok(km.icons.every(i => i.src.startsWith('icons/kamer-')));
for (const i of km.icons) readFileSync(new URL('../public/' + i.src, import.meta.url));
assert.ok(sw.includes("pad === 'kamer.webmanifest'"));

// de server zet logo en afkorting in teamkamer/{teamId}, alleen veilige vormen
const { createRequire } = await import('node:module');
const L = createRequire(import.meta.url)('../functions/teamkamer-logica.js');
const team = { naam: 'O11-1', club: 'c1', teamkamer: { aan: true } };
const metLogo = l => L.kamerDoc(team, { naam: 'Asv 33', platformModules: { teamkamer: true }, instellingen: { identiteit: { logo: l, afkorting: "ASV'33" } } }, [], {}, null);
assert.equal(metLogo('icons/asv-schild.png').clubLogo, 'icons/asv-schild.png');
assert.equal(metLogo('icons/asv-schild.png').clubAfk, "ASV'33");
assert.equal(metLogo('data:image/webp;base64,AAAA').clubLogo, 'data:image/webp;base64,AAAA');
assert.equal(metLogo('icons/icon-192.png').clubLogo, '');
assert.equal(metLogo('javascript:alert(1)').clubLogo, '');
assert.equal(metLogo('https://elders.nl/x.png').clubLogo, '');
assert.equal(metLogo('data:image/png;base64,' + 'A'.repeat(200000)).clubLogo, '');
console.log('app-icoon teamkamer: alles goed');
