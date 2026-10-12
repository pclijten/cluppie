// Seizoensplan: kalender, modellen, validatie, bijsturen. Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/seizoensplan.test.mjs
import assert from 'node:assert/strict';
const L = await import('../public/js/seizoensplan-logica.js');
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const beschikbaar = L.beschikbareThemas(BIBLIOTHEEK.vormen);

/* kalender */
assert.equal(L.maandagVan('2026-08-26'), '2026-08-24');
assert.equal(L.maandagVan('2026-08-23'), '2026-08-17', 'zondag hoort bij de week ervoor');
assert.deepEqual(L.standaardVrij('2026-08-24', '2027-06-06'), ['2026-12-21', '2026-12-28']);
const kal = L.weekKalender('2026-08-24', '2027-06-06', ['2026-10-19', '2026-12-21', '2026-12-28']);
assert.equal(kal.filter(w => w.vrij).length, 3);
assert.equal(kal.filter(w => !w.vrij).at(-1).nr, kal.filter(w => !w.vrij).length, 'trainingsweken lopen door zonder gaten');

/* alle modellen × leeftijden: blokken 4–6 weken, som klopt, alleen toegestane thema's */
for (const model of Object.keys(L.MODELLEN)) for (const leeftijd of [8, 9, 10, 11, 12, 13]) for (const accent of [[], ['Verdedigen'], ['Techniek', 'Aanvallen']]){
  const bouw = leeftijd <= 9 ? 'onder' : leeftijd <= 11 ? 'midden' : 'boven';
  const p = { model, leeftijd, bouw, start: '2026-08-24', eind: '2027-06-06', vrij: L.standaardVrij('2026-08-24', '2027-06-06'), accent, beschikbaar };
  const plan = L.maakSeizoensplan(p);
  const som = plan.blokken.reduce((a, b) => a + b.weken, 0);
  assert.equal(som, plan.trainingsweken, `${model} O${leeftijd}: som weken`);
  const ok = L.valideerBlokken(plan.blokken, { weken: plan.trainingsweken, toegestaan: beschikbaar });
  assert.ok(ok.ok || ok.fouten.every(f => /zelfde thema/.test(f)), `${model} O${leeftijd}: ${ok.fouten}`);
  for (const b of plan.blokken){ assert.ok(b.waarom && b.fasen.length === b.weken, 'waarom en fasen'); assert.ok(b.van && b.tot, 'datums'); }
  if (accent.includes('Verdedigen') && leeftijd >= 10) assert.ok(plan.blokken.filter(b => ACC(b.thema)).length >= 2, 'accent komt vaker voor');
}
function ACC(t){ return L.ACCENTEN['Verdedigen'].includes(t); }

/* validatie van een AI-voorstel */
const t1 = new Set(['Scoren', 'Positiespel opbouw']);
assert.equal(L.valideerBlokken([{ thema: 'Scoren', weken: 5 }, { thema: 'Positiespel opbouw', weken: 5 }], { weken: 10, toegestaan: t1 }).ok, true);
assert.equal(L.valideerBlokken([{ thema: 'Scoren', weken: 3 }, { thema: 'Verzonnen', weken: 7 }], { weken: 10, toegestaan: t1 }).ok, false);
assert.equal(L.valideerBlokken([{ thema: 'Scoren', weken: 5 }], { weken: 10, toegestaan: t1 }).ok, false, 'som klopt niet');

/* bijsturen */
const plan = L.maakSeizoensplan({ model: 'leercurve', leeftijd: 10, bouw: 'midden', start: '2026-08-24', eind: '2027-06-06', vrij: [], accent: [], beschikbaar });
const druk = plan.blokken.find(b => b.thema === 'Storen en veroveren'), opb = plan.blokken.find(b => b.thema === 'Positiespel opbouw');
const catThema = { opbouw: 'Positiespel opbouw', druk: 'Storen en veroveren' };
const ev = (datum, opbouw, druk_) => ({ datum, scores: { opbouw, druk: druk_ } });
/* te weinig metingen → niets */
let sig = L.teamSignalen([ev('2026-10-03', 2, 2)], { catThema });
let r = L.stelBijsturingVoor({ plan, weekNr: druk.vanafWeek, signalen: sig });
assert.equal(r.voorstellen.length, 0); assert.match(r.opm, /Nog maar 1/);
/* genoeg metingen, opbouw laag en al geweest → herhaalblok; druk laag en loopt → verlengen, maar maximaal één voorstel */
sig = L.teamSignalen([ev('2026-09-12', 2, 2), ev('2026-09-19', 2, 3), ev('2026-10-03', 3, 2), ev('2026-10-10', 2, 2)], { catThema });
r = L.stelBijsturingVoor({ plan, weekNr: druk.vanafWeek, signalen: sig });
assert.equal(r.voorstellen.length, 1, 'maximaal één voorstel per week');
assert.equal(r.uitgesteld.length, 1);
const v = r.voorstellen[0];
assert.ok(v.toepasbaar && v.feiten.metingen === 4);
const nieuw = L.pasVoorstelToe(plan, v);
assert.ok(nieuw, 'voorstel toepasbaar');
assert.equal(nieuw.blokken.reduce((a, b) => a + b.weken, 0), plan.trainingsweken, 'totaal aantal weken blijft gelijk');
assert.ok(nieuw.blokken.every(b => b.soort === 'herhaling' ? b.weken === 2 : (b.weken >= 4 && b.weken <= 6)), 'blokken binnen grenzen');
assert.equal(plan.blokken.reduce((a, b) => a + b.weken, 0), plan.trainingsweken, 'origineel niet gewijzigd');
/* niet drie weken achter elkaar over hetzelfde thema */
const r2 = L.stelBijsturingVoor({ plan, weekNr: druk.vanafWeek + 1, signalen: sig, besloten: [{ thema: v.thema, weekNr: druk.vanafWeek }] });
assert.ok(!r2.voorstellen.some(x => x.thema === v.thema), 'recent besloten thema wordt overgeslagen');
/* thema-check */
sig = L.teamSignalen([0, 1, 2, 3].map(i => ({ datum: `2026-10-0${i + 1}`, scores: {}, themaCheck: { thema: 'Scoren', antwoord: i < 3 ? 'nee' : 'deels' } })), { catThema });
assert.equal(sig.perThema['Scoren'].nee, 3);
/* positie en datum */
const pos = L.positieOp(plan, '2026-08-24'); assert.equal(pos.weekNr, 1); assert.equal(pos.fase, 'Ontdek');
assert.equal(L.positieOp(plan, '2020-01-01'), null);
console.log('seizoensplan: alle controles geslaagd');
