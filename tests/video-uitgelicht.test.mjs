// Uitgelichte video op het Nu-scherm (public/js/video-uitgelicht.js): welke video groot bovenaan
// staat, welke klein eronder, en dat een geopende video niet opnieuw groot verschijnt.
import assert from 'node:assert/strict';
const m = await import('../public/js/video-uitgelicht.js');
const vs = [
  { id: 'a', uitgelicht: true, url: 'u', teams: ['t1'], uitgelichtOp: { seconds: 10 } },
  { id: 'b', uitgelicht: true, url: 'u', teams: ['t1', 't2'], uitgelichtOp: { seconds: 20 } },
  { id: 'c', url: 'u', teams: ['t1'] },
  { id: 'd', uitgelicht: true, url: 'u', teams: ['t2'] },
];
let k = m.kiesUitgelicht({ videos: vs, teamId: 't1' });
assert.equal(k.nieuw.id, 'b', 'de nieuwste uitgelichte video staat groot');
assert.deepEqual(k.terug.map(v => v.id), ['a']);
k = m.kiesUitgelicht({ videos: vs, teamId: 't1', gezien: { b: 1 } });
assert.equal(k.nieuw.id, 'a'); assert.deepEqual(k.terug.map(v => v.id), ['b'], 'een geziene video blijft klein vindbaar');
k = m.kiesUitgelicht({ videos: vs, teamId: 't1', gezien: { a: 1, b: 1 } });
assert.equal(k.nieuw, null); assert.equal(k.terug.length, 2);
k = m.kiesUitgelicht({ videos: vs, teamId: 't1', geladen: false });
assert.equal(k.nieuw, null, 'niets groots zolang onbekend is wat elders gezien is');
k = m.kiesUitgelicht({ videos: vs, teamId: 't1', later: new Set(['a', 'b']) });
assert.equal(k.nieuw, null); assert.equal(k.terug.length, 2, '"Later" laat de video klein staan');
k = m.kiesUitgelicht({ videos: null, teamId: 't1' });
assert.equal(k.nieuw, null); assert.equal(k.terug.length, 0);
await m.markeerGezien(null, 'a');
assert.ok(m.gezienNu().a, 'openen onthoudt de video, ook zonder gebruiker');
console.log('video-uitgelicht: in orde');
