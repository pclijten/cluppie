// Controle van de trainingsbibliotheek: schema, tekeningen, dekking en een brede proefrun van de planner.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/trainingsplanner.test.mjs
const { BIBLIOTHEEK } = await import('../public/js/trainingsbibliotheek.js');
const { LEERCURVE, RUIMTE_PER_SPELER, maakPlan, jaarlijn, blokVoorWeek, OPBOUW, DUREN, kiesDuur, rondeIndeling, MAX_VORM, MAX_PARTIJ } = await import('../public/js/trainingsplanner.js');
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
  if (!v.uitleg || typeof v.uitleg !== 'string' || v.uitleg.length < 30) fout(id, 'uitleg voor de spelers ontbreekt');
  if (!v.soort || typeof v.soort !== 'string') fout(id, 'soort ontbreekt');
  if (!Array.isArray(v.letOp) || !v.letOp.length || v.letOp.some(x => typeof x !== 'string' || !x.trim())) fout(id, 'letOp ontbreekt');
  if (!Array.isArray(v.varianten) || v.varianten.length < 2 || v.varianten.some(x => !x?.naam || !x?.uitleg)) fout(id, 'minstens 2 spelvorm-varianten met naam en uitleg nodig');
  if (v.fase !== 'afsluiting'){
    if ((v.coachpunten || []).length < 3) fout(id, 'minstens 3 coachpunten');
    if ((v.coachvragen || []).length < 2) fout(id, 'minstens 2 coachvragen');
    if ((v.makkelijker || []).length < 2 || (v.moeilijker || []).length < 2) fout(id, 'differentiatie: minstens 2 makkelijker en 2 moeilijker');
  }
  if (v.fase === 'warming-up' && v.duur.ronde * v.duur.rondes[0] > 12) fout(id, 'warming-up te lang voor een kleine spelvorm');
  if (v.fase !== 'partijspel' && v.duur.ronde > MAX_VORM) fout(id, 'ronde langer dan 15 minuten');
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
for (const t of LEERCURVE) if (!THEMAREGELS[t.thema]) fout('themaregels', `ontbreekt voor ${t.thema}`);

/* 5. dekking: per thema en leeftijd minstens 1 kernvorm; per leeftijd een partijspel */
const dekking = [];
const LEEFTIJDEN = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
for (const t of LEERCURVE){
  const rij = { thema: t.thema };
  for (const l of LEEFTIJDEN){
    if (l < t.vanaf){ rij[l] = '–'; continue; }
    const n = VORMEN.filter(v => ['positiespel', 'spelvorm'].includes(v.fase) && v.thema.includes(t.thema) && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
    rij[l] = n; if (n < 3) fout('dekking', `${t.thema} heeft maar ${n} kernvorm(en) voor O${l} (minimaal 3 nodig)`);
  }
  dekking.push(rij);
}
for (const l of LEEFTIJDEN){
  const n = VORMEN.filter(v => v.fase === 'partijspel' && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
  const w = VORMEN.filter(v => v.fase === 'warming-up' && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
  const a = VORMEN.filter(v => v.fase === 'afsluiting' && l >= v.leeftijd[0] && l <= v.leeftijd[1]).length;
  if (n < 2) fout('dekking', `minder dan 2 partijspelen voor O${l}`); if (w < 4) fout('dekking', `minder dan 4 warming-up spelvormen voor O${l} (${w})`); if (!a) fout('dekking', `geen afsluiting voor O${l}`);
}

/* 6. brede proefrun van de planner: max 4 vormen, elke vorm ≤ 15 min (partij ≤ 20 met onderbreking) */
let runs = 0, mis = 0; const missers = {};
const duurVoor = (l) => (l <= 8 ? 45 : l <= 11 ? 60 : 75);
const aantallen = (l) => (l <= 7 ? [4, 6, 8, 10, 12] : l <= 10 ? [6, 8, 10, 12, 14, 16] : l <= 12 ? [8, 10, 12, 14, 16, 18] : [14, 16, 18, 20, 22]);
for (const l of LEEFTIJDEN) for (const N of aantallen(l)) for (const niveau of [1, 2, 3]) for (const dur of (l === 12 ? DUREN : [duurVoor(l)])){
  for (const t of LEERCURVE.filter(t => t.vanaf <= l)) for (const blokFase of ['Ontdek', 'Pas toe']){
    const p = maakPlan(VORMEN, { categorie: (l >= 7 ? 'JO' : 'JO') + l, aantalSpelers: N, niveau, duur: dur, thema: t.thema, blokFase, seed: runs, ruimteM2: l >= 13 ? 6000 : 3500 });
    runs++;
    const slecht = p.controle.checks.filter(c => !c.ok);
    if (p.onderdelen.length !== 4 || !p.afsluiting || slecht.length){
      mis++; const sl = p.onderdelen.length !== 4 ? ['onvolledig: ' + (p.meldingen[0] || '?')] : slecht.map(c => c.id);
      for (const s of sl) missers[s.split(':')[0] + ` (O${l})`] = (missers[s.split(':')[0] + ` (O${l})`] || 0) + 1;
    }
  }
}
/* duur-aliassen en rondes */
if (kiesDuur(90) !== 75 || kiesDuur(50) !== 45 || kiesDuur(60) !== 60) fout('duur', 'kiesDuur klopt niet');
const lang = VORMEN.find(v => v.fase === 'partijspel'); const ri = rondeIndeling(lang, 20);
if (ri.rondes < 2 || ri.rust < 1 || ri.ronde > MAX_VORM) fout('rondeIndeling', 'partijspel van 20 min heeft geen onderbreking');

/* 7. jaarlijn */
const beschik = new Set(VORMEN.flatMap(v => v.thema));
for (const [bouw, l] of [['onder', 7], ['onder', 9], ['midden', 10], ['midden', 12], ['boven', 13], ['boven', 16]]){
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
