/* [20261127] Nette titels en duur voor video's (public/js/video-thumb.js) */
import assert from 'node:assert/strict';
const { netteVideoTitel, duurTekst } = await import('../public/js/video-thumb.js');

assert.equal(netteVideoTitel('01-aan-de-slag'), 'Aan de slag');
assert.equal(netteVideoTitel('13-clubbeheer-evaluaties-inzicht-instellingen'), 'Clubbeheer evaluaties inzicht instellingen');
assert.equal(netteVideoTitel('4Skills_blok_1_O7.mp4'), '4Skills blok 1 O7');
assert.equal(netteVideoTitel('Uitleg blok 2 voor trainers'), 'Uitleg blok 2 voor trainers');   // zelf getypt: blijft
assert.equal(netteVideoTitel('Passen'), 'Passen');
assert.equal(netteVideoTitel(''), 'Video');
assert.equal(netteVideoTitel(undefined), 'Video');
assert.equal(netteVideoTitel('2026-11-27'), '2026 11 27');

assert.equal(duurTekst(37), '0:37');
assert.equal(duurTekst(71.4), '1:11');
assert.equal(duurTekst(3725), '1:02:05');
assert.equal(duurTekst(0), '');
assert.equal(duurTekst(NaN), '');
assert.equal(duurTekst(Infinity), '');
console.log('video-thumb: ok');
