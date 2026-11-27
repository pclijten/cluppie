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
