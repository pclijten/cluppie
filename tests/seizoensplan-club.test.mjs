// Seizoensplan jeugd op clubniveau: ISO-weken, rechten, uitrol naar trainingen. Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/seizoensplan-club.test.mjs
import assert from 'node:assert/strict';
const C = await import('../public/js/seizoensplan-club.js');
const L = await import('../public/js/seizoensplan-logica.js');
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const vormen = BIBLIOTHEEK.vormen;
let n = 0; const ok = (naam, fn) => { fn(); n++; console.log('  ✓', naam); };

/* ISO-weken en het jaar van een week (jaarovergang) */
ok('maandag 24 aug 2026 = week 35 van 2026', () => assert.deepEqual(C.isoWeekVan('2026-08-24'), { weekNr: 35, jaar: 2026 }));
ok('maandag 28 dec 2026 = week 53 van 2026', () => assert.deepEqual(C.isoWeekVan('2026-12-28'), { weekNr: 53, jaar: 2026 }));
ok('maandag 4 jan 2027 = week 1 van 2027', () => assert.deepEqual(C.isoWeekVan('2027-01-04'), { weekNr: 1, jaar: 2027 }));

/* bouw en jeugd */
ok('O9 hoort bij onderbouw, O11 bij middenbouw, O13 bij bovenbouw', () => {
  assert.equal(C.bouwVanTeam({ categorie: 'JO9-1' }), 'onder');
  assert.equal(C.bouwVanTeam({ categorie: 'JO11-1' }), 'midden');
  assert.equal(C.bouwVanTeam({ categorie: 'O13-2' }), 'boven');
});
ok('senioren zijn geen jeugd en krijgen geen bouw', () => {
  assert.equal(C.isJeugdCategorie('Senioren 1'), false);
  assert.equal(C.bouwVanTeam({ categorie: 'Senioren 1' }), null);
  assert.equal(C.isJeugdCategorie('O11-1'), true);
});

/* rechten: hoofd jeugdopleiding en clubadmin alles; bouwcoördinator alleen eigen bouw */
const club = { admins: { a: true }, hoofdJeugd: { h: true }, bouwCoordinatoren: { onder: { c: true }, midden: { d: true } } };
ok('clubadmin en hoofd jeugdopleiding mogen alles, ook clubbreed', () => {
  assert.equal(C.magVoorBouw(C.rechtenVoor(club, 'a'), 'club'), true);
  assert.equal(C.magVoorBouw(C.rechtenVoor(club, 'h'), 'boven'), true);
});
ok('bouwcoördinator mag alleen de eigen bouw, niet clubbreed', () => {
  const r = C.rechtenVoor(club, 'c');
  assert.equal(C.magVoorBouw(r, 'onder'), true);
  assert.equal(C.magVoorBouw(r, 'midden'), false);
  assert.equal(C.magVoorBouw(r, 'club'), false);
  assert.equal(C.rechtenVoor(club, 'x').magPlan, false);
});

/* uitrol: trainingen per week, vaste ids, geen undefined, herhaalbaar */
const start = '2026-08-24', eind = '2027-06-06', vrij = L.standaardVrij(start, eind);
const det = L.maakSeizoensplan({ categorie: 'JO9-1', leeftijd: 9, bouw: 'onder', model: 'leercurve', start, eind, vrij, accent: ['Verdedigen'], beschikbaar: L.beschikbareThemas(vormen) });
const plan = { ...det, params: { tpw: 2, duur: 60, niveau: 2, start, eind, vrij }, bouw: 'onder', model: 'leercurve' };
const team = { id: 'team-o9', categorie: 'JO9-1' };
ok('planVoorTeam geeft per team de eigen leercurve-volgorde (O9 en O13 verschillen)', () => {
  const beschikbaar = L.beschikbareThemas(vormen);
  const a = C.planVoorTeam({ model: 'leercurve', params: { start, eind, vrij, accent: [], tpw: 2, duur: 60, niveau: 2 } }, { id: 'a', categorie: 'JO9-1' }, beschikbaar);
  const b = C.planVoorTeam({ model: 'leercurve', params: { start, eind, vrij, accent: [], tpw: 2, duur: 60, niveau: 2 } }, { id: 'b', categorie: 'O13-1' }, beschikbaar);
  assert.notEqual(a.blokken.map(x => x.thema).join('|'), b.blokken.map(x => x.thema).join('|'));
  assert.equal(a.params.bouw, 'onder');
  assert.equal(b.params.bouw, 'boven');
});
const uit1 = C.trainingDocs({ plan, team, clubId: 'club-1', planId: 'plan-1', planVersie: 1, vormen, aantalSpelers: 12 });
const uit2 = C.trainingDocs({ plan, team, clubId: 'club-1', planId: 'plan-1', planVersie: 1, vormen, aantalSpelers: 12 });

ok('elke trainingsweek krijgt precies tpw trainingen', () => {
  assert.equal(uit1.docs.length, det.trainingsweken * 2);
});
ok('trainingen horen bij club en team, en hebben een week en seizoensjaar', () => {
  for (const d of uit1.docs){
    assert.equal(d.club, 'club-1'); assert.deepEqual(d.teams, ['team-o9']);
    assert.match(d.week, /^Week \d+$/); assert.ok(d.seizoenJaar === 2026 || d.seizoenJaar === 2027);
    assert.equal(d.bron, 'seizoensplan');
  }
});
ok('ids zijn uniek en herhaalbaar (uitrol twee keer geeft dezelfde documenten)', () => {
  assert.equal(new Set(uit1.docs.map(d => d.id)).size, uit1.docs.length);
  assert.equal(JSON.stringify(uit1.docs), JSON.stringify(uit2.docs));
});
ok('geen undefined-waarden (Firestore weigert die)', () => {
  const zoek = (v, pad) => {
    if (v === undefined) throw new Error('undefined op ' + pad);
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) zoek(x, pad + '.' + k);
  };
  uit1.docs.forEach((d, i) => zoek(d, 'doc' + i));
});
ok('elke training heeft onderdelen met tijd en een titel per vorm', () => {
  const d = uit1.docs[0];
  assert.ok(d.oefeningen.length >= 4, 'minstens warming-up, twee kernvormen en partij');
  for (const o of d.oefeningen){ assert.equal(typeof o.titel, 'string'); assert.ok(Array.isArray(o.blokken) && o.blokken.length); }
});
ok('de seizoensweken lopen door zonder gaten', () => {
  const weken = [...new Set(uit1.docs.map(d => d.seizoensWeek))];
  assert.deepEqual(weken, weken.map((_, i) => i + 1));
});

/* bezette weken en botsingen */
ok('handmatige trainingen tellen mee als bezette week, seizoenstrainingen niet', () => {
  const bezet = C.bezetteWeken([
    { week: 'Week 40', bron: undefined },
    { week: 'Week 41', bron: 'seizoensplan' },
  ]);
  assert.deepEqual([...bezet], [40]);
  assert.equal(C.botsingen(uit1.docs, new Set([40])), uit1.docs.filter(d => d.week === 'Week 40').length);
});

console.log(`seizoensplan-club: ${n} controles geslaagd`);
