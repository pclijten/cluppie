// Controle van de doorwerking van de speelstijl in de planner (speelstijl-planner.js + trainingsplanner.js).
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/speelstijl-planner.test.mjs
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const { maakPlan, DUREN } = await import('../public/js/trainingsplanner.js');
const S = await import('../public/js/speelstijl-planner.js');
const VORMEN = BIBLIOTHEEK.vormen;

const fouten = [];
const eis = (ok, t) => { if (!ok) fouten.push(t); };
const gelijk = (a, b, t) => eis(JSON.stringify(a) === JSON.stringify(b), `${t}: verwacht ${JSON.stringify(b)}, kreeg ${JSON.stringify(a)}`);

const doc = (standen = {}, extra = {}) => ({
  standen: Object.fromEntries(Object.entries(standen).map(([k, s]) => [k, { stand: s }])),
  gewichten: {}, fasen: {}, willenNiet: [], ...extra,
});

/* 1. voorbereiden */
gelijk(S.voorbereidStijl(null), null, 'geen stijl = null');
gelijk(S.voorbereidStijl(doc({ d1: 0, d2: null })), null, 'alleen open onderdelen = niets te sturen');
{
  const st = S.voorbereidStijl(doc({ d3: 2 }, { gewichten: { d3: 2 } }));
  eis(st && st.sturend && st.gewicht.d3 === 2 && st.gewicht.d1 === 1, 'gewicht 2 voor een gekozen onderdeel');
  eis(S.voorbereidStijl(st) === st, 'voorbereiden is idempotent');
}

/* 2. score */
const vA = { p: ['d3A'] }, vB = { p: ['d3B'] }, vN = { p: [] };
{
  const st = S.voorbereidStijl(doc({ d3: 2 }, { gewichten: { d3: 2 } }));
  gelijk(S.stijlScore(vA, st), 4, 'duidelijk A, gewicht 2: +4');
  gelijk(S.stijlScore(vB, st), -2, 'tegengestelde kant: een halve straf');
  gelijk(S.stijlScore(vN, st), 0, 'neutrale vorm: 0');
  const neigt = S.voorbereidStijl(doc({ d3: -1 }));
  gelijk(S.stijlScore(vB, neigt), 1, 'neigt naar B: +1');
  eis(S.stijlScore({ p: ['d3A', 'd4A', 'd2A', 'd1A'] }, S.voorbereidStijl(doc({ d1: 2, d2: 2, d3: 2, d4: 2 }, { gewichten: { d1: 2, d2: 2, d3: 2, d4: 2 } }))) <= S.MAX_BIJDRAGE, 'bijdrage is begrensd');
  gelijk(S.stijlScore(vA, S.voorbereidStijl(doc({ d3: 0, d1: 2 }))), 0, 'open onderdeel doet niets');
}

/* 3. poorten en uitsluiten */
{
  const st = S.voorbereidStijl(doc({ d3: 2 }, { fasen: { l2: 12, l3: 99 }, willenNiet: ['lang', 'tijd', 'pos'] }));
  eis(S.stijlUitgesloten({ p: ['d3A'] }, st, 10), 'hoog druk vóór de gekozen leeftijd valt af');
  eis(!S.stijlUitgesloten({ p: ['d3A'] }, st, 12), 'hoog druk vanaf de gekozen leeftijd mag');
  eis(S.stijlUitgesloten({ p: ['d1A'] }, st, 18), 'nooit (99) sluit uit op elke leeftijd');
  eis(S.stijlUitgesloten({ p: ['xlang'] }, st, 10) && !S.stijlUitgesloten({ p: ['xlang'] }, st, 13), 'lange bal alleen onder O12 uitgesloten');
  eis(S.stijlUitgesloten({ p: ['xtijd'] }, st, 15), 'tijd rekken uitgesloten');
  eis(S.stijlUitgesloten({ p: ['d5B'] }, st, 9) && !S.stijlUitgesloten({ p: ['d5B'] }, st, 10), 'vaste posities onder O10 uitgesloten');
  eis(!S.stijlUitgesloten({ p: ['d3A'] }, S.voorbereidStijl(doc({ d3: 2 })), 8), 'zonder leeftijdsfasen geen poort');
}

/* 4. bibliotheek: tags zijn bekend */
const GELDIG = /^(d[1-8][AB]|xlang|xpos|xtijd)$/;
for (const v of VORMEN){ eis(Array.isArray(v.p), `${v.id}: p ontbreekt`); for (const t of v.p || []) eis(GELDIG.test(t), `${v.id}: onbekende tag ${t}`); }
eis(VORMEN.filter(v => v.p.length).length >= 60, 'minstens 60 vormen hebben een tag');

/* 5. planner: zonder stijl precies zoals vroeger, met stijl een merkbare maar kleine verschuiving */
const basis = (o) => ({ categorie: 'JO15', aantalSpelers: 16, niveau: 2, duur: 60, thema: 'Storen en veroveren', blokFase: 'Verdiep', seed: 1, ...o });
for (let seed = 0; seed < 20; seed++){
  const a = maakPlan(VORMEN, basis({ seed })), b = maakPlan(VORMEN, basis({ seed, stijl: null })), c = maakPlan(VORMEN, basis({ seed, stijl: doc({ d3: 0 }) }));
  gelijk(b.onderdelen.map(x => x.vormId), a.onderdelen.map(x => x.vormId), `seed ${seed}: stijl null = ongewijzigd`);
  gelijk(c.onderdelen.map(x => x.vormId), a.onderdelen.map(x => x.vormId), `seed ${seed}: alleen open onderdelen = ongewijzigd`);
}
const deel = (stijl, tag) => {
  let n = 0, tot = 0;
  for (let seed = 0; seed < 60; seed++) for (const o of maakPlan(VORMEN, basis({ seed, stijl })).onderdelen){ tot++; if ((o.vorm.p || []).includes(tag)) n++; }
  return n / tot;
};
{
  const druk = doc({ d3: 2 }, { gewichten: { d3: 2 } });
  const terug = doc({ d3: -2 }, { gewichten: { d3: 2 } });
  const zonder = deel(null, 'd3A'), a = deel(druk, 'd3A'), b = deel(terug, 'd3A');
  eis(a > zonder, `hoog druk-stijl kiest vaker d3A-vormen (${a.toFixed(2)} tegenover ${zonder.toFixed(2)})`);
  eis(b < zonder, `compacte stijl kiest minder d3A-vormen (${b.toFixed(2)} tegenover ${zonder.toFixed(2)})`);
}
/* het thema blijft leidend en de validator blijft groen, ook met een sterke stijl */
{
  const sterk = doc({ d1: 2, d2: 2, d3: 2, d4: 2, d5: 2, d6: 2, d7: 2, d8: 2 }, { gewichten: { d1: 2, d2: 2, d3: 2 }, willenNiet: ['lang', 'pos', 'tijd'], fasen: { l1: 12, l2: 12, l3: 14 } });
  let runs = 0;
  for (const cat of ['JO8', 'JO11', 'JO13', 'JO15', 'JO17']) for (const N of [8, 12, 16, 20]) for (const dur of [60, 75]) for (const seed of [1, 2]){
    const p = maakPlan(VORMEN, { categorie: cat, aantalSpelers: N, niveau: 2, duur: dur, thema: 'Positiespel opbouw', blokFase: 'Verdiep', seed, stijl: sterk });
    runs++;
    eis(p.onderdelen.length >= 3, `${cat}/${N}/${dur}: te weinig onderdelen`);
    eis(!p.controle || p.controle.ok !== false, `${cat}/${N}/${dur}: validator ${JSON.stringify(p.controle && p.controle.fouten)}`);
    const leeftijd = Number(cat.slice(2));
    for (const od of p.onderdelen) eis(!S.stijlUitgesloten(od.vorm, S.voorbereidStijl(sterk), Math.min(19, Math.max(6, leeftijd))), `${cat}/${N}: uitgesloten vorm ${od.vormId} gekozen`);
  }
  eis(runs === 80, 'alle sterke-stijl-plannen gedraaid');
}
/* melding verschijnt alleen als de stijl iets stuurt */
eis(maakPlan(VORMEN, basis({ stijl: doc({ d3: 2 }) })).meldingen.some(m => /speelstijl/i.test(m)), 'melding bij sturende stijl');
eis(!maakPlan(VORMEN, basis({ stijl: doc({ d3: 0 }) })).meldingen.some(m => /speelstijl/i.test(m)), 'geen melding bij open stijl');

if (fouten.length){ console.error('FOUTEN:\n' + fouten.map(f => ' ✗ ' + f).join('\n')); process.exit(1); }
console.log('speelstijl-planner: alle controles geslaagd');
