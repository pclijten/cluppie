// Speelwijze: de rode draad van speelstijl naar seizoen, training en 3D.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/speelwijze.test.mjs
const L = await import('../public/js/speelstijl-logica.js');
const W = await import('../public/js/speelwijze-logica.js');
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const { maakPlan, LEERCURVE } = await import('../public/js/trainingsplanner.js');
const { themaVolgorde, maakSeizoensplan, beschikbareThemas, speelwijzeExtra } = await import('../public/js/seizoensplan-logica.js');
const { trainingenVanPlan } = await import('../public/js/seizoensplan-club.js');
const { stappenVan, stappen3D, vervolgVan, metVervolg, MIN_STAPPEN } = await import('../public/js/scene3d.js');
const { controleerKeten } = await import('../tools/trainingsbibliotheek/keten.mjs');
const { zevenVelden } = await import('../public/js/oefenkaart.js');

let n = 0; const fouten = [];
const ok = (voorwaarde, tekst) => { n++; if (!voorwaarde) fouten.push(tekst); };
const VORMEN = BIBLIOTHEEK.vormen, THEMAS = new Set(LEERCURVE.map(t => t.thema));
const stijl = k => W.huidigUitStijl(k, 'u1', 1);

/* 1. de principes zelf */
ok(W.PRINCIPES.length === 18, '18 principes');
ok(new Set(W.PRINCIPE_IDS).size === W.PRINCIPES.length, 'unieke id\'s');
for (const p of W.PRINCIPES){
  ok(L.DIM_IDS.includes(p.dim) && ['A', 'B'].includes(p.kant), `${p.id}: onderdeel en kant`);
  ok(W.MOMENTEN.some(m => m.id === p.moment), `${p.id}: moment`);
  ok(p.titel && p.kort && p.regel && p.vraag && /\?$/.test(p.vraag), `${p.id}: titel, regel en vraag`);
  ok(p.zie.length === 3 && p.woorden.length === 3, `${p.id}: drie succescriteria en drie coachwoorden`);
  ok(['onder', 'midden', 'boven'].every(b => p.bouw[b]), `${p.id}: tekst per leeftijd`);
  ok(p.themas.length >= 2 && p.themas.every(t => THEMAS.has(t)), `${p.id}: thema's bestaan in de leercurve`);
  ok(!p.poort || L.FASEN.some(f => f.id === p.poort), `${p.id}: leeftijdspoort bestaat`);
  for (const t of [p.titel, p.regel, p.vraag, ...p.zie, ...p.woorden, ...Object.values(p.bouw)]) ok(!/—|–/.test(t), `${p.id}: geen gedachtestreepjes`);
}
/* elk onderdeel heeft voor beide kanten een principe; elk moment heeft principes */
for (const d of L.DIMS) for (const k of ['A', 'B']) ok(W.PRINCIPES.some(p => p.dim === d.id && p.kant === k), `${d.id}${k} heeft een principe`);
for (const m of W.MOMENTEN) ok(W.PRINCIPES.some(p => p.moment === m.id), `moment ${m.id} heeft principes`);
ok(W.tegenhanger('d1A') === 'd1B' && W.tegenhanger('w2B') === 'w2A' && W.tegenhanger('d2A') === 'd2B', 'tegenhanger');

/* 2. van speelstijl naar speelwijze */
ok(W.speelwijzeVan(null) === null && W.speelwijzeVan({}) === null, 'zonder speelstijl geen speelwijze');
const pos = stijl('pos');
const sw15 = W.speelwijzeVan(pos, 15), sw9 = W.speelwijzeVan(pos, 9), sw7 = W.speelwijzeVan(pos, 7);
ok(W.actieveIds(sw15).includes('d1A') && W.actieveIds(sw15).includes('d4A') && W.actieveIds(sw15).includes('w2A'), 'positiespel O15: opbouwen, terugpakken, balwinst veilig');
ok(!W.actieveIds(sw15).includes('d1B'), 'nooit beide kanten van één onderdeel');
ok(!W.actieveIds(sw9).includes('d4A') && sw9.later.some(p => p.id === 'd4A' && p.vanaf === 12), 'O9: direct terugpakken als team komt later (standaard vanaf O12)');
ok(!W.actieveIds(sw7).includes('d1A') && sw7.later.some(p => p.id === 'd1A'), 'O7: opbouwen vanaf de keeper komt later');
ok(W.actieveIds(W.speelwijzeVan({ ...pos, fasen: { l2: 10 } }, 10)).includes('d4A'), 'de club kan de leeftijd vervroegen');
ok(!W.actieveIds(W.speelwijzeVan({ ...pos, fasen: { l2: 99 } }, 17)).includes('d4A'), 'nooit bij de jeugd blijft uit');
ok(sw15.actief.every((p, i, a) => !i || a[i - 1].kracht >= p.kracht), 'gesorteerd op kracht');
ok(W.speelwijzeVan(stijl('ontdek'), 12).open.length >= 5, 'spelen en ontdekken laat veel open');
/* korte lijst: één antwoord per onderdeel geeft een stand ±1 (neigt) en telt dus mee */
const kort = L.huidigDoc(L.clubUitkomst([{ d1a: 'A', d2a: 'B', d3a: '?', t3: ['d1'] }], 'kort'), 'u1', 1);
const swKort = W.speelwijzeVan(kort, 13);
ok(W.actieveIds(swKort).join() === ['d1A', 'd2B', 'w2B'].join() && swKort.actief[0].id === 'd1A' && swKort.actief[0].belangrijk, 'korte lijst: neigt telt, het gekozen onderdeel weegt dubbel');
for (const k of Object.keys(L.REFS)) ok(W.huidigUitStijl(k).herkenning.sleutel === k && W.huidigUitStijl(k).zin !== undefined, `stijl ${k} geeft een document`);

/* 3. seizoen: de speelwijze stuurt de thema's, de leeftijd gaat voor */
const bes = beschikbareThemas(VORMEN);
for (const k of Object.keys(L.REFS)) for (const [bouw, lv] of [['onder', 8], ['midden', 11], ['boven', 15], ['boven', 18]]) for (const model of ['leercurve', 'momenten', 'cyclus']){
  const sw = W.speelwijzeVan(stijl(k), lv);
  const zonder = themaVolgorde({ model, bouw, leeftijd: lv, beschikbaar: bes }), met = themaVolgorde({ model, bouw, leeftijd: lv, beschikbaar: bes, speelwijze: sw });
  ok(met.every(t => LEERCURVE.find(x => x.thema === t).vanaf <= lv), `${k} ${lv} ${model}: geen thema waar het team te jong voor is`);
  ok(met.every((t, i) => !i || met[i - 1] !== t || zonder.some((z, j) => j && zonder[j - 1] === z)), `${k} ${lv} ${model}: speelwijze zet geen thema naast zichzelf`);
  const extra = speelwijzeExtra(sw, t => LEERCURVE.find(x => x.thema === t).vanaf <= lv && bes.has(t));
  for (const t of extra) ok(met.filter(x => x === t).length > zonder.filter(x => x === t).length || zonder.filter(x => x === t).length >= 2, `${k} ${lv} ${model}: ${t} komt een keer extra`);
  ok(met.length <= zonder.length + 2, `${k} ${lv} ${model}: hooguit twee thema's extra`);
}
const planP = { categorie: 'O13', leeftijd: 13, bouw: 'boven', model: 'leercurve', start: '2026-08-24', eind: '2027-06-06', vrij: [], accent: [], tpw: 2, duur: 75, niveau: 2, beschikbaar: bes };
const metSW = maakSeizoensplan({ ...planP, speelstijl: pos }), zonderSW = maakSeizoensplan(planP);
ok(JSON.stringify(zonderSW.blokken) === JSON.stringify(maakSeizoensplan({ ...planP, speelstijl: null }).blokken), 'zonder speelstijl verandert er niets aan het plan');
ok(metSW.trainingsweken === zonderSW.trainingsweken && metSW.blokken.reduce((a, b) => a + b.weken, 0) === metSW.trainingsweken, 'het seizoen blijft even lang');
ok(metSW.blokken.some(b => /Speelwijze: dit blok traint/.test(b.waarom)) && !zonderSW.blokken.some(b => /Speelwijze/.test(b.waarom)), 'de uitleg bij een blok noemt het principe');
const dek = W.dekking(metSW, W.speelwijzeVan(pos, 13));
ok(dek.totaal === metSW.trainingsweken && dek.basis + Object.values(dek.perMoment).reduce((a, b) => a + b, 0) === dek.totaal, 'dekking telt elke week precies één keer');
ok(dek.perPrincipe.find(x => x.id === 'd1A').weken > 0, 'het zwaarste principe krijgt weken');
ok(W.dekking(zonderSW, null).basis === zonderSW.trainingsweken, 'zonder speelwijze is alles basis');

/* het seizoen van een nieuw plan: een verlopen seizoenstekst geeft het seizoen dat nu loopt */
const { seizoenStartJaar } = await import('../public/js/seizoensplan-logica.js');
ok(seizoenStartJaar("2026/'27", '2026-11-15') === 2026 && seizoenStartJaar("2025/'26", '2026-03-01') === 2025, 'seizoen: lopend seizoen blijft');
ok(seizoenStartJaar("2025/'26", '2026-11-15') === 2026 && seizoenStartJaar("2025/'26", '2026-07-05') === 2026, 'seizoen: verlopen tekst geeft het seizoen van vandaag');
ok(seizoenStartJaar("2026/'27", '2026-05-01') === 2026 && seizoenStartJaar('', '2027-02-01') === 2026 && seizoenStartJaar('', '2026-08-01') === 2026, 'seizoen: volgend seizoen vooruit plannen en zonder tekst');

/* 4. bibliotheek: tags en dekking */
for (const v of VORMEN){
  ok(Array.isArray(v.principes) && v.principes.every(id => W.PRINCIPE_IDS.includes(id)), `${v.id}: principes bestaan`);
  ok(new Set(v.principes).size === v.principes.length, `${v.id}: geen dubbele principes`);
}
for (const p of W.PRINCIPES){
  const lijst = VORMEN.filter(v => v.principes.includes(p.id));
  ok(lijst.length >= 2, `${p.id}: minstens twee vormen in de bibliotheek (nu ${lijst.length})`);
  ok(lijst.some(v => v.id.startsWith('sw-')), `${p.id}: minstens één speelwijze-vorm met volledig spelverloop`);
}
const telling = W.vormenPerPrincipe(VORMEN, sw15, 15);
ok(Object.keys(telling).length === sw15.actief.length && Object.values(telling).every(x => x >= 1), 'vormen per principe voor O15');

/* 5. planner: speelwijze geeft voorrang, alle controles blijven gelden */
const basisO = { aantalSpelers: 12, niveau: 2, duur: 75, blokFase: 'Verdiep' };
ok(W.vormBonus({ principes: ['d1A'] }, sw15) > 0 && W.vormBonus({ principes: ['d1B'] }, sw15) < 0 && W.vormBonus({ principes: [] }, sw15) === 0 && W.vormBonus({ principes: ['d1A'] }, null) === 0, 'bonus, straf en nul');
ok(W.vormBonus({ principes: ['d1A'] }, sw15, 'd1A') === W.vormBonus({ principes: ['d1A'] }, sw15) + 2, 'het principe van de training telt extra');
let plannen = 0, metPrincipe = 0, meer = 0, minder = 0;
for (const k of Object.keys(L.REFS)) for (const lv of [8, 10, 12, 14, 17]) for (const t of LEERCURVE.filter(x => x.vanaf <= lv && bes.has(x.thema)).map(x => x.thema)) for (const seed of [1, 2]) for (const N of [10, 14]){
  const sw = W.speelwijzeVan(stijl(k), lv);
  const o = { ...basisO, categorie: 'O' + lv, leeftijd: lv, aantalSpelers: N, duur: lv <= 8 ? 45 : lv <= 11 ? 60 : 75, thema: t, seed: `t:${seed}` };
  const a = maakPlan(VORMEN, o), b = maakPlan(VORMEN, { ...o, speelwijze: sw });
  plannen++;
  if (!b.controle.ok && a.controle.ok) fouten.push(`plan ${k} O${lv} ${t} seed ${seed} N ${N}: controle faalt alleen met speelwijze: ${b.controle.checks.filter(c => !c.ok).map(c => c.id)}`);
  ok(b.controle.themaPct >= 60 || a.controle.themaPct < 60, `plan ${k} O${lv} ${t}: thema blijft leidend`);
  const tel = p => p.onderdelen.reduce((s, od) => s + W.vormBonus(od.vorm, sw), 0);
  if (tel(b) > tel(a)) meer++; else if (tel(b) < tel(a)) minder++;
  if (b.profiel.principe){
    metPrincipe++;
    ok(b.onderdelen.some(od => od.speelwijzeRegel) === b.onderdelen.some(od => od.vorm.fase === 'partijspel'), `plan ${k} O${lv} ${t}: het partijspel heeft de regel van het principe`);
    ok(b.controle.checks.some(c => c.id === 'speelwijze' && c.ok), `plan ${k} O${lv} ${t}: controle speelwijze`);
  } else ok(!b.onderdelen.some(od => od.speelwijzeRegel), 'zonder principe geen regel');
  ok(JSON.stringify(a) === JSON.stringify(maakPlan(VORMEN, o)), 'zonder speelwijze blijft de planner dezelfde');
}
ok(meer > minder * 5 && meer > plannen * 0.3, `met speelwijze passen de vormen vaker bij de principes (beter ${meer}, slechter ${minder} van ${plannen})`);
ok(metPrincipe > plannen * 0.5, `de meeste trainingen hebben een principe (${metPrincipe} van ${plannen})`);
/* seizoenstrainingen: alleen met een speelstijl in het plan */
const kal = metSW.kal;
const tA = trainingenVanPlan({ plan: { ...zonderSW, params: { tpw: 1, duur: 75, niveau: 2 } }, team: { id: 't', categorie: 'O13' }, vormen: VORMEN, planId: 'p' });
const tB = trainingenVanPlan({ plan: { ...metSW, params: { tpw: 1, duur: 75, niveau: 2, speelstijl: pos } }, team: { id: 't', categorie: 'O13' }, vormen: VORMEN, planId: 'p' });
ok(tA.every(x => !x.p.profiel.principe) && tB.some(x => x.p.profiel.principe), 'seizoenstrainingen: principe alleen met speelstijl in het plan');
ok(tB.every(x => x.p.controle.ok) , 'seizoenstrainingen met speelwijze halen alle controles');
void kal;

/* 6. rode draad */
const draad = W.rodeDraad(sw15, { thema: 'Positiespel opbouw', fase: 'Verdiep', blok: 2, weekInBlok: 2, weken: 5, leeftijd: 15 });
ok(draad.principe.id === 'd1A' && draad.moment.id === 'ab' && draad.succes.length === 3 && draad.woorden.length === 3 && draad.regel && draad.wedstrijdvraag, 'rode draad met principe');
ok(/^Beter worden in “opbouwen vanaf de keeper”/.test(draad.leerdoel), 'leerdoel noemt fase en principe: ' + draad.leerdoel);
const los = W.rodeDraad(null, { thema: 'Scoren', fase: 'Ontdek' });
ok(los.principe === null && /Scoren/.test(los.leerdoel) && !los.regel, 'zonder speelwijze stuurt alleen het thema');

/* 7. 3D: eigen spelverloop en het voorbeeld van het vervolg */
let weinig = 0, totaal = 0;
for (const v of VORMEN){
  const eigen = stappenVan(v), per3d = stappen3D(metVervolg(v)), extra = vervolgVan(v);
  ok(eigen.length === (v.tekening.lijnen || []).length, `${v.id}: stappenVan geeft één regel per lijn (voor de editor)`);
  ok(extra.every(l => l.vervolg && l.auto && l.punten.every(p => p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100)), `${v.id}: vervolg binnen het vak en gemarkeerd`);
  ok(extra.every(l => typeof l.tekst === 'string' && !/undefined|null/.test(l.tekst)), `${v.id}: vervolgtekst is compleet`);
  ok(per3d.every(s => s.tekst && /[.!?]$/.test(s.tekst.trim())), `${v.id}: elke stap heeft een zin`);
  if ((v.tekening.lijnen || []).filter(l => !l.samen).length >= MIN_STAPPEN) ok(extra.length === 0, `${v.id}: bij ${MIN_STAPPEN} of meer eigen stappen geen automatisch vervolg`);
  /* het vervolg sluit aan volgens de regels van de 3D-motor: elke loopactie begint bij een speler, elke pass bij de bal */
  const f = controleerKeten({ ...v, tekening: { ...v.tekening, lijnen: [...(v.tekening.lijnen || []).map(l => ({ ...l })), ...extra] } }).filter(x => { const i = Number(x.match(/stap (\d+)/)?.[1]); return i > (v.tekening.lijnen || []).length; });
  ok(f.length === 0, `${v.id}: vervolg sluit niet aan: ${f.join('; ')}`);
  if (v.fase !== 'afsluiting'){ totaal++; if (per3d.length < 4) weinig++; }
}
ok(weinig / totaal < 0.12, `minstens 88% van de vormen heeft vier of meer stappen in 3D (nu ${totaal - weinig} van ${totaal})`);
for (const v of VORMEN.filter(x => x.id.startsWith('sw-'))){
  ok(controleerKeten(v).length === 0, `${v.id}: spelverloop klopt: ${controleerKeten(v).join('; ')}`);
  const s = stappen3D(v);
  ok(s.length >= 5 && s.every(x => !x.auto), `${v.id}: vijf of meer eigen stappen`);
  ok(new Set(s.map(x => x.fase).filter(Boolean)).size >= 2, `${v.id}: het verloop heeft fases`);
  ok(v.tekening.lijnen.filter(l => !l.vervolg).length <= 6, `${v.id}: de tekening blijft leesbaar (hooguit 6 lijnen)`);
  ok(v.tekening.lijnen.every(l => l.tekst), `${v.id}: elke stap heeft een eigen tekst`);
  ok(/Spelverloop/.test(zevenVelden(v).find(x => x.id === 'uitleg').html), `${v.id}: het spelverloop staat in de oefenkaart`);
}

if (fouten.length){ console.error(fouten.slice(0, 40).join('\n')); console.error(`\n${fouten.length} van ${n} controles mislukt`); process.exit(1); }
console.log(`speelwijze: ${n} controles geslaagd (${plannen} proefplannen: ${meer} beter passend, ${minder} minder; ${totaal - weinig} van ${totaal} vormen met vier of meer 3D-stappen)`);
