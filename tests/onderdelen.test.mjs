// Onderdelen (Training maken / Seizoensplanning) aan-uit over drie lagen.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/onderdelen.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir = new URL('../public/js/', import.meta.url);
/* dezelfde state.js-instantie als onderdelen.js (de ?v= wisselt per release) */
const stateSpec = fs.readFileSync(new URL('onderdelen.js', dir), 'utf8').match(/from '\.\/(state\.js[^']*)'/)[1];
const { S } = await import(new URL(stateSpec, dir));
const O = await import(new URL('onderdelen.js', dir));

const OUD = { seconds: Date.parse('2026-09-01T10:00:00Z') / 1000 };
const NIEUW = { seconds: Date.parse('2026-10-20T10:00:00Z') / 1000 };
const reset = () => { S.team = { id: 't', modules: {} }; S._modulesStandaard = {}; S._clubPlatform = { platformModules: {}, gemaakt: OUD }; };

/* bestaande club: alles blijft aan (zonder iets in te stellen) */
reset();
for (const k of O.BEHEERD) assert.equal(O.onderdeelAan(k), true, `${k}: bestaande club blijft aan`);

/* nieuwe club: standaard uit, ook voor een team dat het zelf aanzet */
reset(); S._clubPlatform.gemaakt = NIEUW;
for (const k of O.BEHEERD){
  assert.equal(O.onderdeelAan(k), false, `${k}: nieuwe club begint uit`);
  S.team.modules[k] = true;
  assert.equal(O.onderdeelAan(k), false, `${k}: team kan niet boven de eindbaas uit`);
}

/* eindbaas zet aan voor een nieuwe club → club- en teamkeuze gelden weer */
reset(); S._clubPlatform = { platformModules: { trainingsmodule: true }, gemaakt: NIEUW };
assert.equal(O.onderdeelAan('trainingsmodule'), true);
assert.equal(O.onderdeelAan('seizoensplan'), false, 'de andere blijft uit');
S._modulesStandaard.trainingsmodule = false;
assert.equal(O.onderdeelAan('trainingsmodule'), false, 'club zet standaard uit');
S.team.modules.trainingsmodule = true;
assert.equal(O.onderdeelAan('trainingsmodule'), true, 'team zet zelf aan');

/* eindbaas zet uit bij een bestaande club → uit, wat club of team ook kiest */
reset(); S._clubPlatform = { platformModules: { seizoensplan: false }, gemaakt: OUD };
S.team.modules.seizoensplan = true;
assert.equal(O.onderdeelAan('seizoensplan'), false);
assert.equal(O.doorPlatformUit('seizoensplan'), true);
assert.equal(O.doorPlatformUit('trainingsmodule'), false);

/* team of club zet uit terwijl de eindbaas toestaat */
reset(); S.team.modules.trainingsmodule = false;
assert.equal(O.onderdeelAan('trainingsmodule'), false);
assert.equal(O.onderdeelAan('seizoensplan'), true);

/* team zonder club of zonder aanmaakdatum: oude situatie (aan) */
reset(); S._clubPlatform = undefined;
assert.equal(O.onderdeelAan('trainingsmodule'), true);
assert.equal(O.platformToegestaan({ platformModules: {} }, 'seizoensplan'), true, 'geen datum = oud');

/* datumvormen: Timestamp, _seconds (server), ms, ISO */
const nieuwS = NIEUW.seconds;
for (const g of [{ seconds: nieuwS }, { _seconds: nieuwS }, nieuwS * 1000, new Date(nieuwS * 1000).toISOString()])
  assert.equal(O.platformToegestaan({ gemaakt: g }, 'trainingsmodule'), false, 'nieuw: ' + JSON.stringify(g));
assert.equal(O.platformToegestaan({ gemaakt: OUD.seconds * 1000 }, 'trainingsmodule'), true);

/* andere modules lopen ongewijzigd via modAan */
reset(); S._clubPlatform = { platformModules: { evaluaties: false }, gemaakt: NIEUW };
assert.equal(O.onderdeelAan('evaluaties'), true, 'niet beheerd door de eindbaas');
S.team.modules.evaluaties = false; assert.equal(O.onderdeelAan('evaluaties'), false);
console.log('onderdelen: alle controles groen');

/* server en client moeten hetzelfde beslissen */
const { createRequire } = await import('node:module');
const server = createRequire(import.meta.url)('../functions/onderdelen.js');
const gevallen = [OUD, NIEUW, null, undefined, '2026-09-01T10:00:00Z', '2026-10-20T10:00:00Z', Date.parse('2026-10-20') ];
for (const gemaakt of gevallen) for (const pm of [undefined, {}, { trainingsmodule: true }, { trainingsmodule: false, seizoensplan: true }]) for (const k of ['trainingsmodule', 'seizoensplan', 'chat']) {
  const club = { gemaakt, platformModules: pm };
  assert.equal(O.platformToegestaan(club, k), server.platformToegestaan(club, k), JSON.stringify([gemaakt, pm, k]));
}
console.log('onderdelen: client en server stemmen overeen');

/* ---- vierde laag: werkwijze ---- */
{
  const club = (w, leiding = {}) => ({ platformModules: {}, gemaakt: OUD, werkwijze: w, leiding });
  const zet = (w, team, uid, leiding) => { reset(); S._clubPlatform = club(w, leiding); S.team = { id: 't', club: 'c1', modules: {}, ...team }; S.user = { uid }; };
  zet('vrij', {}, 'u1');
  for (const k of O.BEHEERD) assert.equal(O.onderdeelAan(k), true, `${k}: Trainers vrij`);
  zet('club', {}, 'u1');
  for (const k of O.BEHEERD) assert.equal(O.onderdeelAan(k), false, `${k}: Club stuurt, gewone trainer`);
  zet('club', { werkwijzeVrij: true }, 'u1');
  for (const k of O.BEHEERD) assert.equal(O.onderdeelAan(k), true, `${k}: team met uitzondering`);
  zet('club', {}, 'u2', { admins: { u2: true } });
  assert.equal(O.onderdeelAan('seizoensplan'), true, 'admin blijft bouwen');
  zet('club', {}, 'u2', { hoofdJeugd: { u2: true } });
  assert.equal(O.onderdeelAan('trainingsmodule'), true, 'hoofd jeugd blijft bouwen');
  zet('club', {}, 'u2', { bouwCoordinatoren: { midden: { u2: true } } });
  assert.equal(O.onderdeelAan('trainingsmodule'), true, 'bouwcoördinator blijft bouwen');
  zet('club', {}, 'u2', { eigenBouwen: [{ id: 'e1', coaches: { u2: true } }] });
  assert.equal(O.onderdeelAan('seizoensplan'), true, 'coach van eigen bouw blijft bouwen');
  zet('club', { club: null }, 'u1');
  assert.equal(O.onderdeelAan('trainingsmodule'), true, 'team zonder club: alles open');
  zet('club', {}, 'u1');
  S._clubPlatform.platformModules = { trainingsmodule: false };
  assert.equal(O.onderdeelAan('trainingsmodule'), false, 'eindbaas gaat voor');
  assert.equal(O.werkwijzeVan(undefined), 'vrij');
  assert.equal(O.werkwijzeVan({ werkwijze: 'onzin' }), 'vrij');
  zet('club', {}, 'u1');
  assert.equal(O.onderdeelAan('kompas'), true, 'andere onderdelen ongemoeid');
}
