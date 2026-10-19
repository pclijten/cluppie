// Controle van de praktische trainingscontext: materiaal (met vervangers), veld, wedstrijddag en de planner.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/trainingscontext.test.mjs
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const { maakPlan, rangschik, DUREN, groepsindeling, standaardRuimte } = await import('../public/js/trainingsplanner.js');
const L = await import('../public/js/trainingscontext-logica.js');
const VORMEN = BIBLIOTHEEK.vormen;

const fouten = [];
const eis = (ok, t) => { if (!ok) fouten.push(t); };
const gelijk = (a, b, t) => eis(JSON.stringify(a) === JSON.stringify(b), `${t}: verwacht ${JSON.stringify(b)}, kreeg ${JSON.stringify(a)}`);

/* 1. behoefte en tekort */
gelijk(L.behoefte({ materiaal: { pionnen: 4, ballen: 2, hesjes: 0, doeltjes: 2 } }, 3), { ballen: 6, pionnen: 12, doeltjes: 6 }, 'behoefte × groepen, nullen weggelaten');
gelijk(L.tekort({ ballen: 2 }, { ballen: 6 }).ok, true, 'genoeg ballen');
gelijk(L.tekort({ ballen: 8 }, { ballen: 6 }).tekort, { ballen: 2 }, 'te weinig ballen: geen vervanger');
{
  const r = L.tekort({ doeltjes: 2, pionnen: 4 }, { doeltjes: 0, pionnen: 10, hesjes: 0 });
  gelijk(r.ok, true, 'doeltjes vervangen door poortjes van twee pionnen (6 pionnen over)');
  eis(r.vervangers.length === 1 && /poortje/.test(r.vervangers[0]), 'vervanger voor doeltje wordt benoemd');
}
{
  const r = L.tekort({ doeltjes: 2, pionnen: 4 }, { doeltjes: 0, pionnen: 6, hesjes: 0 });
  gelijk(r.tekort, { doeltjes: 1 }, 'maar één poortje van de pionnen die over zijn');
}
{
  const r = L.tekort({ pionnen: 12, hesjes: 2 }, { pionnen: 6, hesjes: 10 });
  gelijk(r.ok, true, 'pionnen vervangen door hesjes als afbakening');
}
{
  const r = L.tekort({ pionnen: 12, hesjes: 8 }, { pionnen: 6, hesjes: 10 });
  gelijk(r.tekort, { pionnen: 4 }, 'hesjes die nodig zijn tellen niet als vervanger');
}
gelijk(L.tekort({ doeltjes: 2 }, { doeltjes: 0, pionnen: 0 }).tekort, { doeltjes: 2 }, 'geen pionnen over: doeltjes blijven tekort');
{
  const voorraad = { doeltjes: 0, pionnen: 10, hesjes: 0 };
  L.tekort({ doeltjes: 2, pionnen: 4 }, voorraad);
  gelijk(voorraad, { doeltjes: 0, pionnen: 10, hesjes: 0 }, 'de voorraad wordt niet aangepast');
}

/* 2. context opschonen, veld, snelkeuzes */
gelijk(L.schoonContext(null), { materiaal: null, veld: null, wedstrijddag: null }, 'lege context');
gelijk(L.schoonContext({ materiaal: { ballen: '7', pionnen: -3, hesjes: 1.6, doeltjes: 'x', rommel: 5 }, veld: 'half', wedstrijddag: 6 }),
  { materiaal: { ballen: 7, pionnen: 0, hesjes: 2, doeltjes: 0 }, veld: 'half', wedstrijddag: 6 }, 'context opgeschoond');
gelijk(L.schoonContext({ veld: 'enorm', wedstrijddag: 9 }), { materiaal: null, veld: null, wedstrijddag: null }, 'ongeldig veld en wedstrijddag genegeerd');
gelijk(L.ruimteM2('half', 3500), 1750, 'half veld is de helft'); gelijk(L.ruimteM2('kwart', 6000), 1500, 'kwart veld'); gelijk(L.ruimteM2(null, 3500), 3500, 'geen veld = standaard');
gelijk(L.presetVan(L.PRESETS.normaal.materiaal), 'normaal', 'snelkeuze herkend'); gelijk(L.presetVan({ ballen: 13, pionnen: 30, hesjes: 14, doeltjes: 4 }), null, 'eigen aantallen');

/* 3. dag voor de wedstrijd */
gelijk(L.dagVoorWedstrijd('2026-10-23', { wedstrijddag: 6 }), true, 'vrijdag is de dag voor zaterdag');
gelijk(L.dagVoorWedstrijd('2026-10-22', { wedstrijddag: 6 }), false, 'donderdag niet');
gelijk(L.dagVoorWedstrijd('2026-10-25', { wedstrijddag: 1 }), true, 'zondag voor maandag (week eromheen)');
gelijk(L.dagVoorWedstrijd('2026-10-23', {}), false, 'geen wedstrijddag ingesteld');

/* 4. de planner zonder context doet precies wat hij deed */
const basis = o => ({ categorie: 'O11', aantalSpelers: 12, niveau: 2, duur: 60, thema: 'Positiespel opbouw', blokFase: 'Verdiep', seed: 'a', ...o });
const ids = p => p.onderdelen.map(x => x.vormId).concat(p.afsluiting?.vormId).join();
for (const lft of [7, 9, 11, 13, 16]) for (const N of [8, 12, 18]) for (const duur of DUREN){
  const o = basis({ categorie: 'O' + lft, aantalSpelers: N, duur });
  const a = maakPlan(VORMEN, o);
  eis(ids(a) === ids(maakPlan(VORMEN, { ...o, context: { materiaal: null } })), `context zonder materiaal wijzigt het plan niet (O${lft}, ${N}, ${duur})`);
  eis(ids(a) === ids(maakPlan(VORMEN, { ...o, context: null })), `geen context wijzigt het plan niet (O${lft}, ${N}, ${duur})`);
}

/* 5. materiaal: gekozen vormen passen, en het plan zegt dat */
const ZUINIG = L.PRESETS.zuinig.materiaal;
{
  const p = maakPlan(VORMEN, basis({ context: { materiaal: ZUINIG } }));
  eis(p.onderdelen.length === 4, 'zuinig materiaal geeft vier vormen');
  const ck = p.controle.checks.find(c => c.id === 'materiaal');
  eis(!!ck && ck.ok, 'materiaalcontrole aanwezig en geslaagd voor O11 met 12 spelers: ' + ck?.tekst);
  for (const od of p.onderdelen) eis(L.haalbaar(od.vorm, od.groepen, p.context).ok, `${od.vorm.naam} past bij zuinig materiaal`);
}
{
  const p = maakPlan(VORMEN, basis({ context: { materiaal: { ballen: 0, pionnen: 0, hesjes: 0, doeltjes: 0 } } }));
  eis(p.onderdelen.length === 4, 'zonder materiaal toch vier vormen (best passende)');
  eis(p.meldingen.some(m => /past geen vorm/.test(m)) || p.controle.checks.find(c => c.id === 'materiaal')?.ok === false, 'zonder materiaal wordt het tekort gemeld');
}
{
  const o = basis({ aantalSpelers: 20, context: { materiaal: ZUINIG } });
  const lst = rangschik(VORMEN, 'kern1', { ...o, categorie: 'O11', aantalSpelers: 20 });
  eis(lst.every(v => L.haalbaar(v, groepsindeling(v, 20).groepen, o.context).ok), 'rangschik (andere vorm) houdt rekening met het materiaal');
}

/* 6. veld */
{
  const o = basis({ categorie: 'O14', aantalSpelers: 18, duur: 75, thema: 'Positiespel opbouw' });
  const heel = maakPlan(VORMEN, { ...o, context: { materiaal: null, veld: 'heel' } });
  const kwart = maakPlan(VORMEN, { ...o, context: { materiaal: null, veld: 'kwart' } });
  eis(heel.ruimteM2 === standaardRuimte(14), 'heel veld = standaardruimte');
  eis(kwart.ruimteM2 === Math.round(standaardRuimte(14) / 4), 'kwart veld = een kwart');
  eis(Math.max(...kwart.onderdelen.map(x => x.totaleRuimte)) <= Math.max(...heel.onderdelen.map(x => x.totaleRuimte)), 'op een kwart veld kiest de planner niet méér ruimte');
  const hv = maakPlan(VORMEN, { ...o, context: { materiaal: null }, halfVeld: true });
  eis(hv.ruimteM2 === Math.round(standaardRuimte(14) / 2), 'plan B half veld halveert de ruimte');
}

/* 7. dag voor de wedstrijd: maximaal zwaarte 2 */
{
  let zwaar = 0, plannen = 0;
  for (const lft of [8, 10, 12, 14, 16, 18]) for (const N of [10, 14, 20]){
    const p = maakPlan(VORMEN, basis({ categorie: 'O' + lft, aantalSpelers: N, duur: 60, datum: '2026-10-23', context: { materiaal: null, wedstrijddag: 6 } }));
    plannen++; zwaar += p.onderdelen.concat(p.afsluiting ? [p.afsluiting] : []).filter(x => x.vorm.intensiteit > 2).length;
    eis(p.meldingen.some(m => /dag voor de wedstrijd/.test(m)), `melding dag voor de wedstrijd (O${lft}, ${N})`);
  }
  eis(zwaar === 0, `dag voor de wedstrijd: geen vormen met zwaarte 3 (${zwaar} gevonden in ${plannen} plannen)`);
  const gewoon = maakPlan(VORMEN, basis({ datum: '2026-10-22', context: { materiaal: null, wedstrijddag: 6 } }));
  eis(!gewoon.meldingen.some(m => /dag voor de wedstrijd/.test(m)), 'donderdag: geen melding');
}

/* 7b. regen of koud: buiten de afsluiting geen stilstaande vormen (zwaarte 1), tenzij er niets anders is */
{
  let laag = 0, plannen = 0, kort = 0, zonder = 0;
  for (const lft of [7, 9, 11, 13, 16]) for (const N of [8, 12, 16]) for (const thema of ['Positiespel opbouw', 'Uitspelen 1:1', 'Scoren']){
    const o = basis({ categorie: 'O' + lft, aantalSpelers: N, duur: 60, thema });
    const p = maakPlan(VORMEN, { ...o, slechtWeer: true });
    plannen++; if (p.onderdelen.length < 4) kort++;
    laag += p.onderdelen.filter(x => x.vorm.intensiteit < 2).length;
    if (!p.meldingen.some(m => /Regen of koud/.test(m))) zonder++;
    const gewoon = maakPlan(VORMEN, o);
    eis(!gewoon.meldingen.some(m => /Regen of koud/.test(m)), 'zonder slechtWeer geen weermelding');
  }
  eis(kort === 0, `regen of koud: altijd vier vormen (${kort} van ${plannen} korter)`);
  eis(zonder === 0, 'regen of koud: melding met tips aanwezig');
  eis(laag <= Math.ceil(plannen * 0.05), `regen of koud: bijna nooit een vorm met zwaarte 1 buiten de afsluiting (${laag} van ${plannen * 4})`);
  const o = basis({ aantalSpelers: 12 });
  gelijk(ids(maakPlan(VORMEN, { ...o, slechtWeer: false })), ids(maakPlan(VORMEN, o)), 'slechtWeer=false verandert niets');
}

/* 7c. de vormen met weinig materiaal bestaan en vragen echt weinig */
{
  const weinig = VORMEN.filter(v => /^(wu|sv)-l-/.test(v.id));
  eis(weinig.length >= 8, `minstens 8 vormen met weinig materiaal (${weinig.length})`);
  for (const v of weinig) eis(v.materiaal.ballen <= 6 && v.materiaal.doeltjes === 0, `${v.id} vraagt weinig ballen en geen doeltjes`);
}

/* 7d. keepervormen: iedereen rouleert, voor meerdere leeftijden en met een keeper in de tekening */
{
  const kp = VORMEN.filter(v => v.soort === 'keeper');
  eis(kp.length >= 5, `minstens 5 keepervormen (${kp.length})`);
  for (const lft of [9, 11, 13, 16]) eis(kp.some(v => lft >= v.leeftijd[0] && lft <= v.leeftijd[1]), `keepervorm voor O${lft}`);
  for (const v of kp) eis((v.tekening.spelers || []).some(p => p.kant === 'keeper'), `${v.id} toont een keeper in de tekening`);
}

/* 8. wat valt af en wat helpt */
{
  const kand = VORMEN.filter(v => v.leeftijd[0] <= 11 && v.leeftijd[1] >= 11 && v.spelers.min <= 14);
  const r = L.valtAf(kand, v => groepsindeling(v, 14).groepen, { materiaal: ZUINIG });
  eis(r.totaal === kand.length && r.passend + r.af === r.totaal, 'valtAf telt op');
  eis(r.af > 0, 'met zuinig materiaal valt er iets af (O11, 14 spelers)');
  for (const t of r.tips) { eis(t.extra > 0 && t.vormen > 0 && /^Met \d+ extra /.test(L.tipTekst(t)), 'tip is een concrete aankoop: ' + L.tipTekst(t)); }
  const ruim = L.valtAf(kand, v => groepsindeling(v, 14).groepen, { materiaal: L.PRESETS.ruim.materiaal });
  eis(ruim.af <= r.af, 'ruim materiaal laat niet méér vormen afvallen dan zuinig');
  gelijk(L.valtAf(kand, () => 1, { materiaal: null }).af, 0, 'zonder voorraad valt er niets af');
}

/* 9. dekking: de planner geeft altijd vier vormen, en de materiaalgaten mogen niet groter worden */
const GRENS = { zuinig: 66, normaal: 0, ruim: 0 };        /* stand van 19-10-2026 na de vormen met weinig materiaal (deel I); lager mag, hoger niet */
const rest = {};
for (const k of Object.keys(L.PRESETS)){
  let n = 0, gat = 0, kort = 0;
  for (let lft = 6; lft <= 19; lft++) for (let N = 6; N <= 24; N++) for (const duur of DUREN){
    const p = maakPlan(VORMEN, basis({ categorie: 'O' + lft, aantalSpelers: N, duur, context: { materiaal: L.PRESETS[k].materiaal } }));
    n++; if (p.onderdelen.length < 4) kort++;
    const ck = p.controle.checks.find(c => c.id === 'materiaal'); if (ck && !ck.ok) gat++;
  }
  rest[k] = { n, gat, kort };
  eis(kort === 0, `${k}: altijd vier vormen (${kort} plannen met minder)`);
  eis(gat <= GRENS[k], `${k}: materiaalgaten mogen niet toenemen (${gat} > ${GRENS[k]} van ${n} plannen)`);
}

if (fouten.length){ console.error('trainingscontext: ' + fouten.length + ' fout(en)\n - ' + fouten.slice(0, 30).join('\n - ')); process.exit(1); }
console.log(`trainingscontext: alle controles geslaagd (dekking: ${Object.entries(rest).map(([k, r]) => `${k} ${r.gat}/${r.n} met materiaalgat`).join(', ')})`);
