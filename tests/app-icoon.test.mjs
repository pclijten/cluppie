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

// [20261127c] iconen als bestanden in Storage (Android haalt ze buiten de service worker om)
const { serverIconen, serverIcoonNodig, logoSig } = await import('../public/js/app-icoon.js');
const url = k => `https://firebasestorage.googleapis.com/v0/b/cluppie-ad329.firebasestorage.app/o/clubs%2Fc1%2Ftrainingen%2Fapp-icoon%2Fx-${k}.png?alt=media&token=abc`;
const icoon = { sig: logoSig('icons/asv-schild.png'), a192: url('a192'), a512: url('a512'), m192: url('m192'), m512: url('m512') };
assert.ok(serverIconen(icoon));
assert.equal(serverIconen({ ...icoon, a512: 'https://elders.nl/x.png' }), null);
assert.equal(serverIcoonNodig('icons/asv-schild.png', icoon), false);
assert.equal(serverIcoonNodig('data:image/png;base64,AAAA', icoon), true, 'ander logo: opnieuw maken');
assert.equal(serverIcoonNodig('icons/asv-schild.png', null), true);
assert.equal(serverIcoonNodig('', null), false);
const ms = maakManifest('Asv 33', "ASV'33", 'app', icoon);
assert.deepEqual(ms.icons.map(i => i.src), [icoon.a192, icoon.a512, icoon.m192, icoon.m512]);
assert.equal(maakManifest('Asv 33', "ASV'33", 'kamer', icoon).icons[1].src, icoon.a512);
const kIc = L.kamerDoc(team, { naam: 'Asv 33', platformModules: { teamkamer: true }, instellingen: { identiteit: { logo: 'icons/asv-schild.png', appIcoon: icoon } } }, [], {}, null).clubIcoon;
assert.equal(kIc.a512, icoon.a512);
assert.equal(L.kamerDoc(team, { naam: 'x', platformModules: { teamkamer: true }, instellingen: { identiteit: { appIcoon: { ...icoon, m192: 'javascript:x' } } } }, [], {}, null).clubIcoon, null);
console.log('app-icoon storage: alles goed');
