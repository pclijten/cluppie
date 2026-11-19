// Meldt gewijzigde publieke pagina's bij IndexNow, zodat Bing en Copilot niet hoeven te wachten
// tot hun crawler langskomt. Google doet niet mee aan IndexNow; die blijft via de sitemap gaan.
//
//   node tools/indexnow.mjs            alleen de pagina's die in de laatste commit wijzigden
//   node tools/indexnow.mjs --alles    alle pagina's uit sitemap.xml
//   node tools/indexnow.mjs --droog    laat zien wat er gemeld zou worden, zonder te versturen
//
// De sleutel is de bestandsnaam van public/<sleutel>.txt; dat bestand bewijst aan de zoekmachine
// dat wij over dit domein gaan. Weg = IndexNow werkt niet meer.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORTEL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIEK = path.join(WORTEL, 'public');
const EINDPUNT = 'https://api.indexnow.org/indexnow';

export function leesSleutel(publiek = PUBLIEK) {
  const treffers = fs.readdirSync(publiek).filter((n) => /^[0-9a-f]{32}\.txt$/.test(n));
  if (treffers.length !== 1) {
    throw new Error(`Verwacht precies één IndexNow-sleutelbestand in public/, gevonden: ${treffers.length}`);
  }
  const sleutel = treffers[0].replace(/\.txt$/, '');
  const inhoud = fs.readFileSync(path.join(publiek, treffers[0]), 'utf8').trim();
  if (inhoud !== sleutel) {
    throw new Error(`public/${treffers[0]} moet exact de sleutel bevatten en niets anders`);
  }
  return sleutel;
}

export function sitemapUrls(publiek = PUBLIEK) {
  const xml = fs.readFileSync(path.join(publiek, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

// Een gewijzigd bestand telt alleen mee als de bijbehorende URL ook in de sitemap staat:
// de app achter de login hoeft niet gemeld te worden.
export function gewijzigdeUrls(bestanden, urls) {
  const uit = new Set();
  for (const b of bestanden) {
    // Sitemap gewijzigd, of de sleutel net aangezet: dan alles melden.
    if (b === 'public/sitemap.xml' || /^public\/[0-9a-f]{32}\.txt$/.test(b)) urls.forEach((u) => uit.add(u));
    const m = b.match(/^public\/(.+)$/);
    if (!m) continue;
    const treffer = urls.find((u) => new URL(u).pathname.replace(/^\//, '') === m[1]);
    if (treffer) uit.add(treffer);
  }
  return [...uit];
}

function bestandenLaatsteCommit() {
  try {
    return execFileSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch {
    console.log('Kon de vorige commit niet lezen; er wordt niets gemeld. Gebruik --alles als dat wel moet.');
    return [];
  }
}

async function main() {
  const alles = process.argv.includes('--alles');
  const droog = process.argv.includes('--droog');
  const urls = sitemapUrls();
  const teMelden = alles ? urls : gewijzigdeUrls(bestandenLaatsteCommit(), urls);
  if (teMelden.length === 0) {
    console.log('Geen publieke pagina gewijzigd; niets gemeld bij IndexNow.');
    return;
  }
  const sleutel = leesSleutel();
  const host = new URL(urls[0]).host;
  const lichaam = { host, key: sleutel, keyLocation: `https://${host}/${sleutel}.txt`, urlList: teMelden };
  console.log(`IndexNow: ${teMelden.length} pagina('s)\n  ${teMelden.join('\n  ')}`);
  if (droog) return;
  const antwoord = await fetch(EINDPUNT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(lichaam),
  });
  // 200 = aangenomen, 202 = aangenomen maar sleutel nog niet gecontroleerd. Beide goed.
  if (antwoord.ok) {
    console.log(`IndexNow antwoordde ${antwoord.status}: gemeld.`);
    return;
  }
  // Een mislukte melding mag de deploy niet laten klappen: de site staat dan al live en
  // de sitemap vangt het alsnog op.
  console.log(`::warning::IndexNow antwoordde ${antwoord.status} ${antwoord.statusText}. De pagina's staan gewoon live; de sitemap vangt dit op.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
