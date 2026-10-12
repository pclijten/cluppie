// Controle van de trainingsbibliotheek: schema, tekeningen, dekking en een brede proefrun van de planner.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/trainingsplanner.test.mjs
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const { LEERCURVE, RUIMTE_PER_SPELER, maakPlan, jaarlijn, blokVoorWeek } = await import('../public/js/trainingsplanner.js');
const VORMEN = BIBLIOTHEEK.vormen, THEMAREGELS = BIBLIOTHEEK.themaregels;

const fouten = [], waarschuwingen = [];
const fout = (id, t) => fouten.push(`${id}: ${t}`);
const waarsch = (id, t) => waarschuwingen.push(`${id}: ${t}`);
const THEMAS = new Set(LEERCURVE.map(t => t.thema));
const FASEN = ['warming-up', 'positiespel', 'spelvorm', 'partijspel', 'afsluiting'];
const DOMEINEN = ['TE', 'TA', 'FY', 'ME', 'GE'];
const KANTEN = [undefined, 'tegen', 'joker', 'keeper'];
const inBereik = (x) => typeof x === 'number' && x >= 0 && x <= 100;

/* 1. schema */
const ids = new Set();
for (const v of VORMEN){
  const id = v.id;
  if (ids.has(id)) fout(id, 'dubbele id'); ids.add(id);
  if (!/^[a-z0-9-]+$/.test(id)) fout(id, 'id moet kleine letters/cijfers/streepjes zijn');
  if (!FASEN.includes(v.fase)) fout(id, `onbekende fase ${v.fase}`);
  if (!(v.leeftijd?.length === 2 && v.leeftijd[0] <= v.leeftijd[1] && v.leeftijd[0] >= 6 && v.leeftijd[1] <= 19)) fout(id, 'leeftijd ongeldig');
  const sp = v.spelers; if (!(sp && sp.min <= sp.ideaal && sp.ideaal <= sp.max)) fout(id, 'spelers min<=ideaal<=max');
  if (!(v.veld?.b > 0 && v.veld?.l > 0)) fout(id, 'veld ontbreekt');
  const d = v.duur; if (!(d && d.ronde > 0 && d.rondes?.[0] <= d.rondes?.[1] && d.rust >= 0)) fout(id, 'duur ongeldig');
  for (const t of v.thema) if (!THEMAS.has(t)) fout(id, `onbekend thema "${t}"`);
  if (!v.themaregelVorm && v.fase !== 'afsluiting' && v.fase !== 'warming-up' && !v.thema.length) fout(id, 'geen thema');
  for (const dm of v.domeinen) if (!DOMEINEN.includes(dm)) fout(id, `onbekend domein ${dm}`);
  if (![1, 2, 3].includes(v.complexiteit) || ![1, 2, 3].includes(v.intensiteit)) fout(id, 'complexiteit/intensiteit 1-3');
  for (const k of ['naam', 'doel']) if (!v[k] || typeof v[k] !== 'string') fout(id, `${k} ontbreekt`);
  for (const k of ['organisatie', 'regels', 'coachpunten', 'coachvragen', 'makkelijker', 'moeilijker'])
    if (!Array.isArray(v[k]) || !v[k].length || v[k].some(x => typeof x !== 'string' || !x.trim())) fout(id, `${k} leeg of ongeldig`);
  if (!v.materiaal || ['pionnen', 'ballen', 'hesjes', 'doeltjes'].some(k => typeof v.materiaal[k] !== 'number')) fout(id, 'materiaal onvolledig');
  if (v.wachtrij) fout(id, 'wachtrij niet toegestaan in de startset');
  /* voetbalecht: moet minstens één doel/doeltje hebben of een kasteel/punten-spel */
  if (v.voetbalecht && !(v.tekening.doeltjes?.length || v.tekening.zones?.some(z => /kasteel|zone/i.test(z.label)) || v.tekening.pionnen?.length))
    waarsch(id, 'voetbalecht zonder doel in de tekening');

  /* 2. tekening */
  const t = v.tekening; if (!t){ fout(id, 'tekening ontbreekt'); continue; }
  const nrs = new Set();
  for (const p of t.spelers || []){
    if (!inBereik(p.x) || !inBereik(p.y)) fout(id, `speler ${p.nr} buiten 0-100`);
    if (!KANTEN.includes(p.kant)) fout(id, `speler ${p.nr}: onbekende kant ${p.kant}`);
    if (nrs.has(p.nr)) fout(id, `dubbel spelersnummer ${p.nr}`); nrs.add(p.nr);
  }
  if ((t.spelers || []).length > sp.max) fout(id, `tekening toont ${t.spelers.length} spelers, max ${sp.max}`);
  for (const l of t.lijnen || []){
    if (!['loopweg', 'pass', 'dribbel', 'schot'].includes(l.soort)) fout(id, `lijnsoort ${l.soort}`);
    if (!(l.punten?.length >= 2) || l.punten.some(([x, y]) => !inBereik(x) || !inBereik(y))) fout(id, 'lijn met ongeldige punten');
  }
  for (const z of t.zones || []) if (![z.x, z.y, z.x + z.b, z.y + z.h].every(inBereik)) fout(id, `zone "${z.label}" buiten vak`);
  for (const g of t.doeltjes || []) if (!['boven', 'onder'].includes(g.kant) || !inBereik(g.x) || !inBereik(g.y) || !(g.breed > 0 && g.breed <= 60)) fout(id, 'doeltje ongeldig');
  for (const p of t.pionnen || []) if (!inBereik(p[0]) || !inBereik(p[1])) fout(id, 'pion buiten vak');
  if (t.bal && (!inBereik(t.bal[0]) || !inBereik(t.bal[1]))) fout(id, 'bal buiten vak');

  /* 3. ruimte per speler */
  const m2 = (v.veld.b * v.veld.l) / sp.ideaal, [a, b] = RUIMTE_PER_SPELER[v.fase];
  if (m2 < a || m2 > b) fout(id, `ruimte per speler ${m2.toFixed(0)} m² buiten ${a}–${b} voor ${v.fase}`);
}

/* 4. themaregels voor alle thema's ≤ 13 */
for (const t of LEERCURVE.filter(t => t.vanaf <= 13)) if (!THEMAREGELS[t.thema]) fout('themaregels', `ontbreekt voor ${t.thema}`);

/* 5. dekking: per thema en leeftijd minstens 1 kernvorm; per leeftijd een partijspel */
const dekking = [];
const LEEFTIJDEN = [8, 9, 10, 11, 12, 13];
for (const t of LEERCURVE.filter(t => t.vanaf <= 13)){
  const rij = { thema: t.thema };
  for (const l of LEEFTIJDEN){
    if (l < t.vanaf){ rij[l] = '–'; continue; }
    const n = VORMEN.filter(v => ['positiespel', 'spelvorm'].includes(v.fase) && v.thema.includes(t.thema) && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
    rij[l] = n; if (n === 0) fout('dekking', `${t.thema} heeft geen kernvorm voor O${l}`); else if (n === 1) waarsch('dekking', `${t.thema} O${l}: maar 1 kernvorm (geen alternatief bij wisselen)`);
  }
  dekking.push(rij);
}
for (const l of LEEFTIJDEN){
  const n = VORMEN.filter(v => v.fase === 'partijspel' && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
  const w = VORMEN.filter(v => v.fase === 'warming-up' && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
  const a = VORMEN.filter(v => v.fase === 'afsluiting' && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
  if (!n) fout('dekking', `geen partijspel voor O${l}`); if (!w) fout('dekking', `geen warming-up voor O${l}`); if (!a) fout('dekking', `geen afsluiting voor O${l}`);
}

/* 6. brede proefrun van de planner */
let runs = 0, mis = 0; const missers = {};
const duurVoor = (l) => (l <= 9 ? 60 : l <= 12 ? 75 : 90);
for (const l of LEEFTIJDEN) for (const N of [8, 10, 12, 14, 16, 20]) for (const niveau of [1, 2, 3]){
  for (const t of LEERCURVE.filter(t => t.vanaf <= l)) for (const blokFase of ['Ontdek', 'Pas toe']){
    if (l >= 13 && N < 14) continue;               /* O13 speelt 11 tegen 11 */
    const p = maakPlan(VORMEN, { categorie: 'JO' + l, aantalSpelers: N, niveau, duur: duurVoor(l), thema: t.thema, blokFase, seed: runs, ruimteM2: l >= 13 ? 6000 : 3500 });
    runs++;
    const slecht = p.controle.checks.filter(c => !c.ok);
    if (p.onderdelen.length < 5 || slecht.length){
      mis++; const sl = p.onderdelen.length < 5 ? ['onvolledig: ' + p.meldingen[0]] : slecht.map(c => c.id);
      for (const s of sl) missers[s.split(':')[0] + ` (O${l})`] = (missers[s.split(':')[0] + ` (O${l})`] || 0) + 1;
    }
  }
}

/* 7. jaarlijn */
const beschik = new Set(VORMEN.flatMap(v => v.thema));
for (const [bouw, l] of [['onder', 9], ['midden', 10], ['midden', 12], ['boven', 13]]){
  const j = jaarlijn({ bouw, leeftijd: l, weken: 36, beschikbaar: beschik });
  const som = j.blokken.reduce((a, b) => a + b.weken, 0);
  if (som !== 36) fout('jaarlijn', `${bouw} O${l}: ${som} weken i.p.v. 36`);
  for (const b of j.blokken) if (b.weken < 4 || b.weken > 6) fout('jaarlijn', `${bouw}: blok ${b.nr} duurt ${b.weken} weken`);
  for (const w of [1, 12, 36]){ const x = blokVoorWeek(j, w); if (!x.fase) fout('jaarlijn', 'blokVoorWeek mislukt'); }
}

if (mis) console.log('Missers per controle:', missers);
if (waarschuwingen.length){ console.log('Waarschuwingen:'); waarschuwingen.forEach(w => console.log(' ·', w)); }
if (fouten.length){ console.log('FOUTEN:'); fouten.forEach(f => console.log(' ✗', f)); process.exit(1); }
if (mis){ console.log(`${mis} van ${runs} proefplannen voldoen niet aan de controles`); process.exit(1); }
console.log(`trainingsplanner: ${VORMEN.length} vormen, ${runs} proefplannen, alle controles geslaagd`);
