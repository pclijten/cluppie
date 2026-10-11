// Kleurcontrast-advies voor de clubkleur.  Draaien: node --import ./tests/hulp/stub-loader.mjs tests/kleur.test.mjs
import assert from 'node:assert/strict';
const { contrast, kleurAdvies } = await import('../public/js/club-instellingen.js');
assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
assert.equal(kleurAdvies('#b3211d').ok, true, 'donkerrood is goed');
assert.equal(kleurAdvies('#e2342f').ok, true, 'Cluppie-rood is goed');
assert.equal(kleurAdvies('#ffcc00').ok, false, 'geel met witte tekst is slecht');
for (const k of ['#f5e663', '#e2342f', '#9ad1ff', '#ffffff', '#0a0a0a', '#ffcc00']){
  const a = kleurAdvies(k);
  if (!a.ok){
    assert.ok(contrast(a.advies, '#ffffff') >= 4.5, `${k} → ${a.advies}: witte tekst leesbaar`);
    assert.notEqual(a.advies, k);
  }
}
assert.equal(kleurAdvies('geen').ok, false);
console.log('kleur: alle controles geslaagd', ['#e2342f', '#ffcc00', '#9ad1ff'].map(k => `${k}→${kleurAdvies(k).advies}`).join(' '));
