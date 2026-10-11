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

const CLUB = "FC Voorbeeld", AFK = 'FCV';
const lijst = [
  "FC Voorbeeld 1", "FC Voorbeeld 2", "FC Voorbeeld 3 (zondag)", "FC Voorbeeld O8-1JM", "FC Voorbeeld JO9-2", "FC Voorbeeld JO11-1",
  "FC Voorbeeld O11-2 (zat)", "FC Voorbeeld JO12-1JM", "FC Voorbeeld MO15-1", "FC Voorbeeld VR30+1", "FC Voorbeeld VR35+1", "FC Voorbeeld Selectie",
];
const voorvoegsel = clubVoorvoegsel(lijst.map(teamnaam => ({ teamnaam })));
assert.equal(voorvoegsel, "FC Voorbeeld ");

const gevallen = [...lijst, 'FC Voorbeeld O13-1 Futsal', 'FC Voorbeeld JO11-1 (zat)', 'JO8-1', '1', 'MO15-1', 'VR30+1', 'Selectie', 'O11-2 (zat)'];
for (const naam of gevallen){
  assert.equal(teamSleutel(naam, CLUB, AFK), naamSleutel(naam, voorvoegsel), 'verschil bij ' + JSON.stringify(naam));
}
// VR30+1 en VR35+1 mogen niet botsen met het 1e senioren-elftal
assert.notEqual(teamSleutel("FC Voorbeeld VR30+1", CLUB, AFK), teamSleutel("FC Voorbeeld 1", CLUB, AFK));

// Futsal e.d.: client volgt de server (eigen sleutel, geen botsing met het veldteam).
assert.equal(teamSleutel("FC Voorbeeld O13-1 Futsal", CLUB, AFK), naamSleutel("FC Voorbeeld O13-1 Futsal", voorvoegsel));
assert.notEqual(teamSleutel("FC Voorbeeld O13-1 Futsal", CLUB, AFK), teamSleutel("FC Voorbeeld O13-1", CLUB, AFK));
console.log(gevallen.length + ' teamnamen: client en server geven dezelfde sleutel');
