// Clubkleur als tekst: genoeg contrast in het lichte en het donkere thema (clubconfig.js tekstKleur).
// node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/accent-tekst.test.mjs
import assert from 'node:assert/strict';
const { tekstKleur, contrastHex } = await import('../public/js/clubconfig.js');
const LICHT = '#e9edf2', DONKER = '#181d24';
let n = 0;
for (const kleur of ['#e20613', '#c8211c', '#f2c200', '#1f6feb', '#0b7a3b', '#ffffff', '#000000', '#7a7a7a']){
  const l = tekstKleur(kleur, LICHT), d = tekstKleur(kleur, DONKER);
  assert.ok(contrastHex(l, LICHT) >= 4.5, `${kleur} op licht: ${l} haalt ${contrastHex(l, LICHT).toFixed(2)}`); n++;
  assert.ok(contrastHex(d, DONKER) >= 4.5, `${kleur} op donker: ${d} haalt ${contrastHex(d, DONKER).toFixed(2)}`); n++;
  assert.match(l, /^#[0-9a-f]{6}$/); assert.match(d, /^#[0-9a-f]{6}$/); n += 2;
}
// een kleur die al voldoet blijft zoals hij is
assert.equal(tekstKleur('#c8211c', LICHT), '#c8211c'); n++;
assert.equal(tekstKleur('#f2c200', DONKER), '#f2c200', 'geel is op donker al leesbaar'); n++;
// fel rood wordt op licht iets donkerder, niet zwart
const rood = tekstKleur('#e20613', LICHT);
assert.notEqual(rood, '#e20613'); assert.ok(parseInt(rood.slice(1, 3), 16) > 150, 'blijft herkenbaar rood: ' + rood); n += 2;
// ongeldige invoer komt ongewijzigd terug
assert.equal(tekstKleur('rood', LICHT), 'rood'); assert.equal(tekstKleur('#e20613', 'x'), '#e20613'); n += 2;
console.log(`accent-tekst: ${n} controles geslaagd`);
