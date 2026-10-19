// Controle van de kleine voorkeur voor doorlopend spel bij "laten lopen" (coachmodel-logica.js + trainingsplanner.js).
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/coachmodel-planner.test.mjs
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const { maakPlan } = await import('../public/js/trainingsplanner.js');
const C = await import('../public/js/coachmodel-logica.js');
const VORMEN = BIBLIOTHEEK.vormen;

const fouten = [];
const eis = (ok, t) => { if (!ok) fouten.push(t); };
const model = (c3) => { let m = C.metAntwoorden(null, { c3a: c3, c3b: c3 }); for (const id of C.DIM_IDS) m = C.bevestig(m, id, {}); return m; };
const lopen = model('B'), stoppen = model('A');
eis(C.wilLatenLopen(lopen) && !C.wilLatenLopen(stoppen), 'laten lopen wordt herkend');

const basis = (o) => ({ categorie: 'JO11', aantalSpelers: 12, niveau: 2, duur: 60, thema: 'Positiespel opbouw', blokFase: 'Verdiep', ...o });
const ids = p => p.onderdelen.map(x => x.vormId).join(',');
for (let seed = 0; seed < 20; seed++){
  const a = maakPlan(VORMEN, basis({ seed }));
  eis(ids(maakPlan(VORMEN, basis({ seed, coach: null }))) === ids(a), `seed ${seed}: geen coachmodel = ongewijzigd`);
  eis(ids(maakPlan(VORMEN, basis({ seed, coach: stoppen }))) === ids(a), `seed ${seed}: vaak stoppen = ongewijzigd`);
  eis(ids(maakPlan(VORMEN, basis({ seed, coach: C.metAntwoorden(null, { c3a: 'B', c3b: 'B' }) }))) === ids(a), `seed ${seed}: niet bevestigd = ongewijzigd`);
}
const aandeel = (coach) => {
  let n = 0, tot = 0;
  for (let seed = 0; seed < 80; seed++) for (const o of maakPlan(VORMEN, basis({ seed, coach })).onderdelen){ tot++; if (C.doorlopend(o.vorm)) n++; }
  return n / tot;
};
const zonder = aandeel(null), met = aandeel(lopen);
eis(met >= zonder, `laten lopen kiest niet minder doorlopend spel (${met.toFixed(2)} tegenover ${zonder.toFixed(2)})`);
/* het blijft een kleine voorkeur: de validator blijft groen en het thema leidend */
for (let seed = 0; seed < 30; seed++){
  const p = maakPlan(VORMEN, basis({ seed, coach: lopen }));
  eis(p.controle.ok !== false, `seed ${seed}: validator ${JSON.stringify(p.controle.fouten)}`);
}
if (fouten.length){ console.error('FOUTEN:\n' + fouten.map(f => ' ✗ ' + f).join('\n')); process.exit(1); }
console.log('coachmodel-planner: alle controles geslaagd');
