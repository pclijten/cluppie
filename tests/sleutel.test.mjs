// Controleert dat de teamsleutel van de client (public/js/sportlink-sleutel.js)
// dezelfde uitkomst geeft als naamSleutel() in functions/index.js.
// Draaien: node tests/sleutel.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { teamSleutel } = await import(path.join(root, 'public/js/sportlink-sleutel.js'));

const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
function haalFunctie(naam){
  const start = src.indexOf('function ' + naam + '(');
  assert.ok(start >= 0, naam + ' niet gevonden in functions/index.js');
  let diepte = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++){
    if (src[i] === '{') diepte++;
    if (src[i] === '}' && --diepte === 0) return src.slice(start, i + 1);
  }
}
const { naamSleutel, clubVoorvoegsel } = new Function(
  haalFunctie('clubVoorvoegsel') + haalFunctie('naamSleutel') + '; return { naamSleutel, clubVoorvoegsel };'
)();

const CLUB = "ASV'33", AFK = 'ASV';
const lijst = [
  "ASV'33 1", "ASV'33 2", "ASV'33 3 (zondag)", "ASV'33 O8-1JM", "ASV'33 JO9-2", "ASV'33 JO11-1",
  "ASV'33 O11-2 (zat)", "ASV'33 JO12-1JM", "ASV'33 MO15-1", "ASV'33 VR30+1", "ASV'33 VR35+1", "ASV'33 Selectie",
];
const voorvoegsel = clubVoorvoegsel(lijst.map(teamnaam => ({ teamnaam })));
assert.equal(voorvoegsel, "ASV'33 ");

const gevallen = [...lijst, 'JO8-1', '1', 'MO15-1', 'VR30+1', 'Selectie', 'O11-2 (zat)'];
for (const naam of gevallen){
  assert.equal(teamSleutel(naam, CLUB, AFK), naamSleutel(naam, voorvoegsel), 'verschil bij ' + JSON.stringify(naam));
}
// VR30+1 en VR35+1 mogen niet botsen met het 1e senioren-elftal
assert.notEqual(teamSleutel("ASV'33 VR30+1", CLUB, AFK), teamSleutel("ASV'33 1", CLUB, AFK));

// Bekend verschil (bewust nog niet aangepast): een toevoeging als "Futsal" achter de teamnaam.
// Client: "ASV'33 O13-1 Futsal" -> o13-1 (botst met het veldteam); server: o131futsal (aparte sleutel).
console.log('bekend verschil futsal: client=%s server=%s',
  teamSleutel("ASV'33 O13-1 Futsal", CLUB, AFK), naamSleutel("ASV'33 O13-1 Futsal", voorvoegsel));
console.log(gevallen.length + ' teamnamen: client en server geven dezelfde sleutel');
