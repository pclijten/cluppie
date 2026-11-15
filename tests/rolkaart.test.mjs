// Rolkaart: welke uitleg hoort bij welke gebruiker. node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/rolkaart.test.mjs
import assert from 'node:assert';
const { rollenVoorKaart, htmlRolkaart, ROLKAARTEN } = await import('../public/js/rolkaart.js');
let n = 0; const gelijk = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const U = 'u1';
gelijk(rollenVoorKaart({ uid: U }), [], 'gewone coach: geen kaart');
gelijk(rollenVoorKaart({}), [], 'niet ingelogd: geen kaart');
gelijk(rollenVoorKaart({ uid: U, coordinatorBouwen: [{ bouw: 'midden' }] }), ['bouw'], 'bouwcoördinator');
gelijk(rollenVoorKaart({ uid: U, coordinatorBouwen: [{ bouw: 'eb1', eigen: true }] }), ['eigenbouw'], 'gekoppelde coach bouw');
gelijk(rollenVoorKaart({ uid: U, leiding: { hoofdJeugd: { [U]: true } } }), ['hjo'], 'hoofd jeugd');
gelijk(rollenVoorKaart({ uid: U, leiding: { hoofdJeugd: { ander: true } } }), [], 'hoofd jeugd van een ander telt niet');
gelijk(rollenVoorKaart({ uid: U, traincoClubs: [{ id: 'c' }] }), ['trainco'], 'trainingscoördinator');
gelijk(rollenVoorKaart({ uid: U, coordinatorBouwen: [{ bouw: 'onder' }, { bouw: 'eb', eigen: true }], leiding: { hoofdJeugd: { [U]: true } }, traincoClubs: [{}] }),
  ['bouw', 'eigenbouw', 'hjo', 'trainco'], 'meerdere rollen in vaste volgorde');
for (const rol of Object.keys(ROLKAARTEN)){
  const h = htmlRolkaart(rol, 'Technisch <b>coördinator</b>');
  assert.ok(h.includes('Dit zie je') && h.includes('Dit kun je niet') && h.includes('rkBegrepen'), rol + ': drie regels en een knop'); n++;
  assert.ok(!h.includes('<b>coördinator</b>'), rol + ': rolnaam is ge-escaped'); n++;
}
assert.ok(htmlRolkaart('hjo', 'Technisch manager').includes('Je bent Technisch manager')); n++;
assert.strictEqual(htmlRolkaart('onbekend'), ''); n++;
console.log(`rolkaart: ${n} controles geslaagd`);
