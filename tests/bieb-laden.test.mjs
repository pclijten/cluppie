/* [20261127y] De basis van de trainingsbibliotheek laadt pas met laadBasis(): daarvoor leeg, daarna gevuld,
   en wie BASIS of BIEB al importeerde ziet de inhoud vanzelf (zelfde objecten). */
import assert from 'node:assert/strict';
const B = await import('../public/js/bibliotheek.js?los=1');
const basis = B.BASIS, themaregels = B.BIEB.themaregels;
assert.equal(B.basisGeladen(), false, 'basis hoort niet vanzelf te laden');
assert.equal(B.BASIS.length, 0);
assert.equal(B.alleVormen().length, 0, 'zonder basis nog geen vormen');
await B.laadBasis();
assert.equal(B.basisGeladen(), true);
assert.ok(B.BASIS.length > 300, 'basis gevuld');
assert.equal(B.BASIS, basis, 'zelfde lijst als vooraf geïmporteerd');
assert.equal(B.BIEB.themaregels, themaregels);
assert.ok(Object.keys(themaregels).length > 0, 'themaregels gevuld');
assert.ok(B.BASIS_VERSIE && B.BASIS_VERSIE === B.BIEB.versie, 'versie bekend');
assert.ok(B.alleVormen().length >= B.BASIS.length, 'vormen na laden');
const twee = await Promise.all([B.laadBasis(), B.laadBasis()]);
assert.equal(B.BASIS.length, twee[0].vormen.length, 'twee keer laden vult niet dubbel');
console.log('bieb-laden: in orde');
