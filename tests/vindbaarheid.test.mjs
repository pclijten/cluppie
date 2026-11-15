// Vindbaarheid in zoekmachines en AI-assistenten: robots.txt, sitemap.xml, llms.txt en de koppen van
// de publieke pagina's. Een kapotte JSON-LD of een Disallow per ongeluk merk je anders pas weken later.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lees = (pad) => fs.readFileSync(new URL('../public/' + pad, import.meta.url), 'utf8');
const BASIS = 'https://www.cluppie.io/';
assert.equal(lees('CNAME').trim(), 'www.cluppie.io', 'BASIS hoort bij het domein in CNAME');

const robots = lees('robots.txt');
assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt sluit de site niet af');
assert.ok(robots.includes('Sitemap: ' + BASIS + 'sitemap.xml'), 'robots.txt verwijst naar de sitemap');
['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'].forEach(b =>
  assert.ok(robots.includes('User-agent: ' + b), `robots.txt noemt ${b}`));

const sitemap = lees('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
assert.ok(locs.includes(BASIS + 'over.html'), 'over.html staat in de sitemap');
locs.forEach(l => {
  assert.ok(l.startsWith(BASIS), `${l}: op het eigen domein`);
  const bestand = l.slice(BASIS.length) || 'index.html';
  assert.ok(fs.existsSync(new URL('../public/' + bestand, import.meta.url)), `${l}: bestand bestaat`);
});

const over = lees('over.html');
assert.ok(over.includes(`<link rel="canonical" href="${BASIS}over.html">`), 'over.html: canonical');
assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(over), 'over.html: geen noindex');
const titel = over.match(/<title>([^<]+)<\/title>/)[1];
const beschrijving = over.match(/<meta name="description" content="([^"]+)">/)[1];
assert.ok(titel.length <= 65 && /voetbal/i.test(titel), 'over.html: titel kort en met "voetbal"');
assert.ok(beschrijving.length >= 80 && beschrijving.length <= 260 && /voetbal/i.test(beschrijving), 'over.html: beschrijving');
const ogBeeld = over.match(/<meta property="og:image" content="([^"]+)">/)[1];
assert.ok(fs.existsSync(new URL('../public/' + ogBeeld.slice(BASIS.length), import.meta.url)), 'og:image bestaat');
const ld = JSON.parse(over.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const soorten = ld['@graph'].map(k => k['@type']);
['Organization', 'WebSite', 'SoftwareApplication'].forEach(s => assert.ok(soorten.includes(s), `JSON-LD: ${s}`));
ld['@graph'].flatMap(k => [k.url, k.logo, ...(k.screenshot || [])]).filter(Boolean).forEach(u => {
  assert.ok(u.startsWith(BASIS), `JSON-LD: ${u} op het eigen domein`);
  const b = u.slice(BASIS.length); if (b) assert.ok(fs.existsSync(new URL('../public/' + b, import.meta.url)), `JSON-LD: ${u} bestaat`);
});

// De app (index.html) wijst zoekmachines naar de pagina met inhoud.
assert.ok(lees('index.html').includes(`<link rel="canonical" href="${BASIS}over.html">`), 'index.html: canonical naar over.html');
assert.ok(lees('privacy.html').includes(`<link rel="canonical" href="${BASIS}privacy.html">`), 'privacy.html: canonical');

// llms.txt: begint met een kop en een samenvatting, alle links op het eigen domein; Cluppie is een eigen product.
const llms = lees('llms.txt');
assert.match(llms, /^# Cluppie\n\n> /, 'llms.txt: kop en samenvatting');
[...llms.matchAll(/\]\((https?:[^)]+)\)/g)].forEach(m => assert.ok(m[1].startsWith(BASIS), `llms.txt: ${m[1]}`));
[llms, robots, sitemap].forEach(t => assert.ok(!/ASV|trainer360/i.test(t), 'geen verwijzing naar ASV of bronnen'));
console.log(`vindbaarheid: robots, sitemap (${locs.length}), llms.txt en koppen in orde`);
