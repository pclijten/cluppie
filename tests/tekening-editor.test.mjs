// Tekening- en 3D-editor (bibliotheek): de zuivere bewerkingen en de stappen die eruit volgen.
// node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/tekening-editor.test.mjs
import assert from 'node:assert';
const E = await import('../public/js/tekening-editor.js');
const { stappenVan } = await import('../public/js/scene3d.js');
let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; };

const t = E.leegTekening();
const a = E.voegSpelerToe(t, 'eigen', 20, 80), b = E.voegSpelerToe(t, 'eigen', 60, 40), k = E.voegSpelerToe(t, 'keeper', 50, 5);
ok(a === 0 && b === 1 && k === 2 && t.spelers[0].nr === 1 && t.spelers[1].nr === 2, 'spelers krijgen oplopende nummers');
ok(t.spelers[0].kant === undefined && t.spelers[2].kant === 'keeper', 'eigen team heeft geen kant-veld, keeper wel');
E.zetBal(t, 22, 78);

// een pass klikt vast op de spelers
const p = E.voegLijnToe(t, 'pass', [22, 82], [58, 42]);
ok(p === 0 && JSON.stringify(t.lijnen[0].punten) === '[[20,80],[60,40]]', 'pass klikt vast op beide spelers');
const l = E.voegLijnToe(t, 'loopweg', [20, 80], [30, 50]);
ok(l === 1 && JSON.stringify(t.lijnen[1].punten[1]) === '[30,50]', 'loopactie eindigt waar je tikt');
ok(E.voegLijnToe(t, 'pass', [20, 80], [21, 80]) === -1 && t.lijnen.length === 2, 'te korte lijn wordt geweigerd');
ok(E.voegLijnToe(t, 'vliegen', [0, 0], [50, 50]) === -1, 'onbekende soort wordt geweigerd');

let st = stappenVan({ tekening: t });
ok(st.length === 2 && st[0].tekst === 'Speler 1 speelt de bal naar speler 2.', `stap 1 klopt (${st[0].tekst})`);
ok(/^Speler 1 /.test(st[1].tekst), `stap 2 is van speler 1 (${st[1].tekst})`);

// speler verplaatsen: de lijnen die bij hem beginnen of eindigen gaan mee, de bal ook
E.verplaatsSpeler(t, 1, 70, 30);
ok(JSON.stringify(t.lijnen[0].punten[1]) === '[70,30]', 'einde van de pass volgt de speler');
E.verplaatsSpeler(t, 0, 10, 90);
ok(JSON.stringify(t.lijnen[0].punten[0]) === '[10,90]' && JSON.stringify(t.lijnen[1].punten[0]) === '[10,90]', 'beginpunten volgen de speler');
ok(JSON.stringify(t.bal) === '[12,88]', `de bal schuift mee (${JSON.stringify(t.bal)})`);
ok(stappenVan({ tekening: t })[0].tekst === 'Speler 1 speelt de bal naar speler 2.', 'stappen kloppen nog na verplaatsen');

// volgorde, soort, verwijderen
ok(E.verschuifLijn(t, 1, -1) === 0 && t.lijnen[0].soort === 'loopweg', 'stap omhoog');
ok(E.verschuifLijn(t, 0, -1) === 0, 'bovenste stap kan niet hoger');
E.zetSoort(t, 1, 'schot'); ok(t.lijnen[1].soort === 'schot', 'soort wijzigen');
ok(/schiet op doel/.test(stappenVan({ tekening: t })[1].tekst), 'een schot wordt een schot in de stappen');
E.verwijderLijn(t, 0); ok(t.lijnen.length === 1, 'stap verwijderen');
E.zetKant(t, 0, 'tegen'); ok(t.spelers[0].kant === 'tegen', 'kant wijzigen');
E.zetKant(t, 0, 'eigen'); ok(t.spelers[0].kant === undefined, 'terug naar eigen team');
E.verwijderSpeler(t, 2); ok(t.spelers.length === 2, 'speler verwijderen');
E.balWeg(t); ok(t.bal === undefined, 'bal weghalen');

// grenzen en controle
ok(E.rond(-5) === 0 && E.rond(140) === 100 && E.rond('x') === 0, 'coördinaten blijven binnen het vak');
ok(E.controleerTekening(t).length === 0 && E.controleerTekening(undefined).length === 0, 'geldige tekening geeft geen meldingen');
ok(E.controleerTekening({ spelers: [{ nr: 1, x: 120, y: 5 }], lijnen: [{ soort: 'x', punten: [[1, 1]] }] }).length === 3, 'ongeldige tekening wordt gemeld');
const vol = E.leegTekening(); for (let i = 0; i < 30; i++) E.voegSpelerToe(vol, 'eigen', i, i);
ok(vol.spelers.length === 22, 'hooguit 22 spelers');

// weergave: geen namen, wel stappen en bediening; tekst wordt ge-escaped
const vorm = { naam: 'Test <b>', veld: { b: 20, l: 30 }, tekening: { spelers: [{ nr: 1, x: 20, y: 80 }, { nr: 2, x: 60, y: 40 }], lijnen: [{ soort: 'pass', punten: [[20, 80], [60, 40]] }], zones: [{ x: 0, y: 0, b: 50, h: 50, label: '<script>' }] } };
const html = E.htmlEditor(vorm, { modus: 'kies', kant: 'eigen', soort: 'pass', speler: 0, lijn: 0, van: null, drieD: false });
ok(html.includes('data-te-speler="0"') && html.includes('data-te-lijn="0"') && html.includes('Bekijk in 3D'), 'editor heeft spelers, stapnummers en de 3D-knop');
ok(!html.includes('<script>') && html.includes('&lt;script&gt;'), 'labels worden ge-escaped');
ok(html.includes('Speler 1 speelt de bal naar speler 2.'), 'de stap staat in de lijst');
console.log(`tekening-editor: ${n} controles geslaagd`);

// opslagvorm: Firestore kent geen lijsten in lijsten, dus de tekening gaat als tekst de database in
const Bib = await import('../public/js/bibliotheek.js');
const heeftGenest = o => Array.isArray(o) ? o.some(x => Array.isArray(x) || heeftGenest(x)) : (o && typeof o === 'object') ? Object.values(o).some(heeftGenest) : false;
const velden = { naam: 'Eigen vorm', tekening: { spelers: [{ nr: 1, x: 1, y: 2 }], lijnen: [{ soort: 'pass', punten: [[1, 2], [3, 4]] }], bal: [1, 2] } };
assert.ok(heeftGenest(velden), 'de tekening zelf heeft lijsten in lijsten');
const op = Bib.veldenNaarOpslag(velden);
assert.ok(!heeftGenest(op) && typeof op.tekeningJson === 'string' && op.tekening === undefined && op.naam === 'Eigen vorm', 'opslagvorm heeft geen geneste lijsten');
assert.deepStrictEqual(Bib.veldenUitOpslag(op), velden, 'heen en terug geeft dezelfde velden');
assert.deepStrictEqual(Bib.veldenNaarOpslag({ naam: 'x' }), { naam: 'x' }, 'zonder tekening verandert er niets');
const samen = Bib.voegSamen([{ id: 'a', naam: 'Basis', tekening: { spelers: [], lijnen: [] } }], { a: { velden: op, status: 'aan' }, eigen1: { velden: op, status: 'aan', eigen: true } });
assert.strictEqual(samen.find(v => v.id === 'a').tekening.lijnen[0].punten[1][0], 3, 'aangepaste tekening komt terug als object');
assert.strictEqual(samen.find(v => v.id === 'eigen1').tekening.bal[1], 2, 'ook bij een eigen vorm');
assert.strictEqual(Bib.voegSamen([{ id: 'a', naam: 'Basis', tekening: { spelers: [{ nr: 9 }] } }], { a: { velden: { tekeningJson: '{kapot' }, status: 'aan' } })[0].tekening.spelers[0].nr, 9, 'onleesbare tekst: tekening van de basis blijft');
console.log('tekening-editor: opslagvorm zonder geneste lijsten');
