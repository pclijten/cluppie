/* ==========================================================================
   trainingsplanner.js — regelgebaseerde trainingsplanner + validator + leerlijn
   Geen AI en geen persoonsgegevens: alleen een teamprofiel
   (categorie, aantal spelers, niveau, duur, thema). De AI (Claude Haiku) mag
   daarna alleen de uitleg personaliseren; de keuze en controle gebeuren hier.
   ========================================================================== */

import { LEERCURVE } from './config.js?v=20261023a';
import { BIBLIOTHEEK } from './trainingsbibliotheek.js?v=20261019f';
import { haalbaar, MATERIAAL_NAAM, MAX_INTENSITEIT_VOOR_WEDSTRIJD, dagVoorWedstrijd, ruimteM2 } from './trainingscontext-logica.js?v=20261019a';
export { LEERCURVE };

/* ───────────── Trainingsopbouw ───────────── */
/* Een training heeft maximaal 4 trainingsvormen: een kleine warming-up spelvorm, twee kernvormen en een partijspel.
   Elke vorm duurt maximaal 15 minuten; een partijspel mag 20 minuten duren als er een onderbreking in zit.
   De rest van de tijd is "overgang": ontvangst en uitleg, omzetten en drinken tussen de vormen, en de afsluiting
   (uitlopen en terugblik, geen vierde of vijfde vorm). Standaardwaarden, geen KNVB-norm. */
export const MAX_VORM = 15;          /* minuten per vorm */
export const MAX_PARTIJ = 20;        /* partijspel, alleen met onderbreking */
export const MAX_VORMEN = 4;
export const DUREN = [45, 60, 75];
export const OPBOUW = {
  45: { onderdelen: [ s('warming-up', 8),  s('kern1', 10), s('kern2', 10), s('partij', 12) ], overgang: { ontvangst: 1, tussen: 3, afsluiting: 1 } },
  60: { onderdelen: [ s('warming-up', 10), s('kern1', 14), s('kern2', 14), s('partij', 15) ], overgang: { ontvangst: 2, tussen: 3, afsluiting: 2 } },
  75: { onderdelen: [ s('warming-up', 12), s('kern1', 15), s('kern2', 15), s('partij', 20) ], overgang: { ontvangst: 3, tussen: 6, afsluiting: 4 } },
};
/* Oude trainingsduren (90 minuten) en losse waarden komen uit bij de dichtstbijzijnde keuze. */
export const kiesDuur = (d) => { d = Number(d) || 60; return d <= 52 ? 45 : d <= 67 ? 60 : 75; };
export const overgangMinuten = (duur) => { const o = OPBOUW[kiesDuur(duur)].overgang; return o.ontvangst + o.tussen + o.afsluiting; };
function s(slot, minuten){ return { slot, minuten }; }
const SLOT_FASEN = {
  'warming-up': ['warming-up'],
  kern1:        ['positiespel', 'spelvorm'],
  kern2:        ['spelvorm', 'positiespel'],
  partij:       ['partijspel'],
  afsluiting:   ['afsluiting'],
};
export const SLOT_NAAM = { 'warming-up': 'Warming-up spelvorm', kern1: 'Kernvorm 1', kern2: 'Kernvorm 2', partij: 'Partijspel', afsluiting: 'Afsluiting' };

/* Ruimte per speler (m²) per fase: heuristiek, nog te kalibreren met coaches. */
export const RUIMTE_PER_SPELER = {
  'warming-up': [20, 60], positiespel: [18, 70], spelvorm: [40, 150], partijspel: [90, 300], afsluiting: [0, 1e9],
};

/* Fases in een leerblok. */
export const BLOKFASEN = {
  4: ['Ontdek', 'Verdiep', 'Pas toe', 'Wedstrijd'],
  5: ['Ontdek', 'Verdiep', 'Verdiep', 'Pas toe', 'Wedstrijd'],
  6: ['Ontdek', 'Verdiep', 'Verdiep', 'Verdiep', 'Pas toe', 'Wedstrijd'],
};
const FASE_COMPLEXITEIT = { Ontdek: 1, Verdiep: 2, 'Pas toe': 2, Wedstrijd: 2 };
export const FASE_UITLEG = {
  Ontdek: 'Kennismaken: speels, ruime vakken, de trainer legt kort uit en laat de spelers zelf ontdekken.',
  Verdiep: 'Verdiepen: de vormen worden iets moeilijker en de trainer coacht met vragen.',
  'Pas toe': 'Toepassen: het thema gaat naar de partij, met een themaregel.',
  Wedstrijd: 'Terugkoppelen: lichte training, geen nieuwe stof; kijk in de wedstrijd of het thema terugkomt.',
};

/* ───────────── Hulpfuncties ───────────── */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function hash(str){ let h = 2166136261; for (const c of str){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
export function leeftijdVan(categorie){ const m = String(categorie || '').match(/O(\d+)/); return m ? Number(m[1]) : 99; }
const heeftThema = (v, thema) => v.thema.includes(thema);

/* Groepsindeling voor N spelers: aantal groepen en groepsgrootte binnen min..max van de vorm. */
export function groepsindeling(v, N){
  const { min, ideaal, max } = v.spelers;
  let g = Math.max(1, Math.floor(N / ideaal));
  let grootte = Math.ceil(N / g);
  while (grootte > max && Math.floor(N / (g + 1)) >= min){ g++; grootte = Math.ceil(N / g); }
  if (grootte > max) grootte = max;
  const speeltMee = Math.min(N, g * grootte);
  return { groepen: g, groepGrootte: Math.min(grootte, max), wissel: Math.max(0, N - speeltMee) };
}

/* Afmeting aanpassen aan groepsgrootte (alleen voor vormen die schaalbaar zijn; wedstrijdvormen niet). */
export function schaalVeld(v, groepGrootte){
  if (v.fase === 'partijspel' || v.fase === 'afsluiting') return { b: v.veld.b, l: v.veld.l };
  const f = Math.sqrt(groepGrootte / v.spelers.ideaal);
  const rond = (x) => Math.max(5, Math.round(x));
  return { b: rond(v.veld.b * f), l: rond(v.veld.l * f) };
}

/* Rondes en rondeduur binnen de beschikbare minuten. Een partijspel van meer dan 15 minuten krijgt altijd
   een onderbreking (minstens 2 rondes met rust ertussen). Een ronde duurt nooit langer dan 15 minuten. */
export function rondeIndeling(v, minuten){
  const { ronde, rondes: [rMin, rMax], rust } = v.duur;
  const lang = minuten > MAX_VORM && v.fase === 'partijspel';
  let r = clamp(Math.round((minuten + rust) / (ronde + rust)), rMin, rMax);
  let rs = rust;
  if (lang){ r = 2; rs = Math.max(rust, 2); }
  let rd = Math.floor((minuten - (r - 1) * rs) / r);
  while (rd > MAX_VORM && r < 6){ r++; rd = Math.floor((minuten - (r - 1) * rs) / r); }
  return { rondes: r, ronde: Math.max(1, rd), rust: rs };
}

/* Standaard-ruimte in m² voor de check "past op het beschikbare veld" (aanname, instelbaar). */
export function standaardRuimte(leeftijd){ return leeftijd >= 13 ? 6000 : 3500; }

/* ───────────── Planner ───────────── */
/* o = { categorie, aantalSpelers, niveau (1-3), duur (60|75|90), thema, blokFase ('Ontdek'|…),
         recent: [vorm-id's], seed, ruimteM2, zwakDomein,
         context (optioneel, zie trainingscontext-logica.js): { materiaal, veld, wedstrijddag },
         datum ('JJJJ-MM-DD', voor de dag-voor-de-wedstrijd-regel), halfVeld (plan B: veld één stap kleiner),
         slechtWeer (plan B: regen of koud; buiten de afsluiting alleen vormen met zwaarte 2 of 3, zodat niemand stilstaat) } */
export function maakPlan(vormen, o){
  const leeftijd = o.leeftijd ?? leeftijdVan(o.categorie);
  const lftBib = clamp(leeftijd, 6, 19);               /* de bibliotheek loopt van 6 t/m 19 jaar; senioren gebruiken de oudste vormen */
  const N = o.aantalSpelers;
  const duur = kiesDuur(o.duur);
  const niveau = clamp(o.niveau ?? 2, 1, 3);
  const blokFase = o.blokFase || 'Verdiep';
  const doelC = clamp((FASE_COMPLEXITEIT[blokFase] ?? 2) + (niveau - 2), 1, 3);
  const recent = o.recent || [];
  const seed = String(o.seed ?? 0);
  const cx = contextVan(o, leeftijd);
  const ruimte = o.ruimteM2 ?? cx.ruimteM2 ?? standaardRuimte(leeftijd);
  const meldingen = [];
  if (cx.lichtMelding) meldingen.push(cx.lichtMelding);
  if (cx.weerMelding) meldingen.push(cx.weerMelding);
  const gebruikt = new Set();
  const onderdelen = [];
  const intens = [];                                  /* intensiteit van de gekozen onderdelen tot nu toe */
  const soorten = [];                                 /* soort spelvorm van de gekozen onderdelen (voor variatie) */

  for (const sl of OPBOUW[duur].onderdelen){
    const kand = kandidatenCx(vormen, sl.slot, { leeftijd: lftBib, N, gebruikt }, cx, meldingen);
    let gekozen = null;
    if (sl.slot === 'partij' && !kand.length){
      /* te weinig spelers voor de wedstrijdvorm → kleine voetbalechte vorm */
      const klein = kandidatenCx(vormen, 'kern2', { leeftijd: lftBib, N, gebruikt }, cx, meldingen).filter(v => v.voetbalecht);
      if (klein.length){
        gekozen = beste(klein, { ...o, doelC, recent, seed, thema: o.thema, slot: 'kern2', intens, soorten });
        meldingen.push(`Met ${N} spelers past de wedstrijdvorm niet; als partijspel is een kleine voetbalvorm gekozen.`);
      }
    } else {
      gekozen = beste(kand, { ...o, doelC, recent, seed, thema: o.thema, slot: sl.slot, intens, soorten });
    }
    if (!gekozen){ meldingen.push(`Geen passende vorm gevonden voor ${SLOT_NAAM[sl.slot]} (leeftijd ${leeftijd}, ${N} spelers).`); continue; }
    gebruikt.add(gekozen.id);
    intens.push(gekozen.intensiteit); soorten.push(gekozen.soort);
    const od = bouwOnderdeel(gekozen, sl, { N, thema: o.thema });
    if (gekozen.fase === 'partijspel' && N < gekozen.spelers.ideaal)
      meldingen.push(`Partijspel met ${N} spelers: speel ${Math.floor(N / 2)} tegen ${Math.ceil(N / 2)} op hetzelfde veld, of laat een speler als joker meedoen.`);
    onderdelen.push(od);
  }

  /* repareren: nooit drie zware (intensiteit 3) onderdelen achter elkaar */
  for (let ronde = 0; ronde < 3; ronde++){
    let mid = -1;
    for (let i = 0; i + 2 < onderdelen.length; i++) if ([0, 1, 2].every(k => onderdelen[i + k].vorm.intensiteit === 3)){ mid = i + 1; break; }
    if (mid < 0) break;
    const idx = [mid, mid - 1, mid + 1].find(i => ['kern1', 'kern2'].includes(onderdelen[i]?.slot));
    if (idx === undefined) break;
    const sl = { slot: onderdelen[idx].slot, minuten: onderdelen[idx].minuten };
    const ander = new Set(gebruikt); ander.delete(onderdelen[idx].vormId);
    const kand = kandidaten(vormen, sl.slot, { leeftijd: lftBib, N, gebruikt: ander }, cx).filter(v => v.intensiteit < 3);
    const nieuw = beste(kand, { ...o, doelC, recent, seed, thema: o.thema, slot: sl.slot, intens: [], soorten: onderdelen.filter((_, j) => j !== idx).map(x => x.vorm.soort) });
    if (!nieuw) break;
    gebruikt.delete(onderdelen[idx].vormId); gebruikt.add(nieuw.id);
    onderdelen[idx] = bouwOnderdeel(nieuw, sl, { N, thema: o.thema });
    meldingen.push('Een zware vorm is vervangen door een rustiger alternatief om overbelasting te voorkomen.');
  }

  /* bijsturen: thema in minstens 60% van de tijd en minstens 3 soorten spelvorm */
  const themaPct = () => { const tot = onderdelen.reduce((a, x) => a + x.minuten, 0) || 1; return 100 * onderdelen.filter(x => heeftThema(x.vorm, o.thema) || x.themaregel).reduce((a, x) => a + x.minuten, 0) / tot; };
  const vervang = (idx, filter) => {
    const sl = { slot: onderdelen[idx].slot, minuten: onderdelen[idx].minuten };
    const ander = new Set(gebruikt); ander.delete(onderdelen[idx].vormId);
    const zonderDrie = (v) => { let r = 0; return onderdelen.every((x, j) => { r = (j === idx ? v.intensiteit : x.vorm.intensiteit) === 3 ? r + 1 : 0; return r <= 2; }); };
    const kand = kandidaten(vormen, sl.slot, { leeftijd: lftBib, N, gebruikt: ander }, cx).filter(v => filter(v) && zonderDrie(v));
    const nieuw = beste(kand, { ...o, doelC, recent, seed, thema: o.thema, slot: sl.slot, intens: [], soorten: onderdelen.filter((_, j) => j !== idx).map(x => x.vorm.soort) });
    if (!nieuw) return false;
    gebruikt.delete(onderdelen[idx].vormId); gebruikt.add(nieuw.id);
    onderdelen[idx] = bouwOnderdeel(nieuw, sl, { N, thema: o.thema });
    return true;
  };
  for (let ronde = 0; ronde < 3 && themaPct() < 60; ronde++){
    const idx = onderdelen.findIndex(x => ['kern1', 'kern2'].includes(x.slot) && !heeftThema(x.vorm, o.thema));
    if (idx < 0 || !vervang(idx, v => heeftThema(v, o.thema))) break;
  }
  for (let ronde = 0; ronde < 2 && new Set(onderdelen.map(x => x.vorm.soort)).size < Math.min(3, onderdelen.length); ronde++){
    const soortenNu = onderdelen.map(x => x.vorm.soort);
    const idx = onderdelen.findIndex((x, i) => ['kern1', 'kern2', 'warming-up'].includes(x.slot) && soortenNu.indexOf(x.vorm.soort) !== i);
    if (idx < 0) break;
    const had = themaPct();
    const vorige = onderdelen[idx];
    if (!vervang(idx, v => !soortenNu.includes(v.soort) && (onderdelen[idx].slot === 'warming-up' || heeftThema(v, o.thema) || had >= 75))) break;
    if (themaPct() < 60){ gebruikt.delete(onderdelen[idx].vormId); gebruikt.add(vorige.vormId); onderdelen[idx] = vorige; break; }
  }

  /* afsluiting: geen vierde of vijfde vorm, maar de laatste minuten (uitlopen en terugblik) */
  const ov = OPBOUW[duur].overgang;
  const afsKand = kandidatenCx(vormen, 'afsluiting', { leeftijd: lftBib, N, gebruikt: new Set() }, cx, meldingen);
  const afsV = afsKand.sort((a, b) => hash(a.id + seed) - hash(b.id + seed))[0] || null;
  const afsluiting = afsV ? bouwOnderdeel(afsV, { slot: 'afsluiting', minuten: ov.afsluiting }, { N, thema: o.thema }) : null;
  if (o.duur && kiesDuur(o.duur) !== Number(o.duur)) meldingen.push(`Een training duurt ${duur} minuten (keuze: ${DUREN.join(', ')}); ${o.duur} is daarop afgerond.`);

  const plan = { profiel: { categorie: o.categorie, leeftijd, aantalSpelers: N, niveau, duur, thema: o.thema, blokFase, doelComplexiteit: doelC },
                 onderdelen, afsluiting, overgang: { ...ov }, meldingen, ruimteM2: ruimte };
  if (cx.actief) plan.context = cx.context;
  plan.controle = valideer(plan);
  return plan;
}

function kandidaten(vormen, slot, { leeftijd, N, gebruikt }, cx){
  const fasen = SLOT_FASEN[slot];
  let lijst = vormen.filter(v => fasen.includes(v.fase) && leeftijd >= v.leeftijd[0] && leeftijd <= v.leeftijd[1]
    && N >= v.spelers.min && !gebruikt.has(v.id));
  if (cx && cx.actief){
    if (cx.maxIntensiteit) lijst = lijst.filter(v => v.intensiteit <= cx.maxIntensiteit);
    if (cx.minIntensiteit && slot !== 'afsluiting') lijst = lijst.filter(v => v.intensiteit >= cx.minIntensiteit);
    if (cx.context.materiaal) lijst = lijst.filter(v => haalbaar(v, groepsindeling(v, N).groepen, cx.context).ok);
  }
  return lijst;
}
/* Zoals kandidaten, maar vindt de context niets, dan kiest hij toch de vorm met het kleinste materiaaltekort
   (en meldt dat), zodat een trainer nooit een lege training krijgt. */
function kandidatenCx(vormen, slot, a, cx, meldingen){
  const streng = kandidaten(vormen, slot, a, cx);
  if (streng.length || !cx.actief) return streng;
  /* eerst de dag-voor-de-wedstrijd-grens laten staan, daarna pas versoepelen */
  const zonderMat = kandidaten(vormen, slot, a, { ...cx, context: { ...cx.context, materiaal: null } });
  if (zonderMat.length && cx.context.materiaal){
    const maat = v => { const h = haalbaar(v, groepsindeling(v, a.N).groepen, cx.context); return Object.values(h.tekort).reduce((p, x) => p + x, 0); };
    const kleinste = Math.min(...zonderMat.map(maat));
    const keuze = zonderMat.filter(v => maat(v) === kleinste);
    meldingen.push(`Met jouw materiaal past geen vorm bij ${SLOT_NAAM[slot]}. De best passende vorm is gekozen; zie het materiaal bij die vorm.`);
    return keuze;
  }
  if (cx.minIntensiteit){
    const los = kandidaten(vormen, slot, a, { ...cx, minIntensiteit: 0 });
    if (los.length) return los;
  }
  if (cx.maxIntensiteit){
    const los = kandidaten(vormen, slot, a, { ...cx, maxIntensiteit: 0 });
    if (los.length) return los;
  }
  return streng;
}
/* Praktische context → grenzen voor de planner. Zonder context: alles uit, gedrag zoals vroeger. */
function contextVan(o, leeftijd){
  const c = o.context || null;
  const actief = !!(c && (c.materiaal || c.veld || c.wedstrijddag) ) || !!o.halfVeld || !!o.slechtWeer;
  if (!actief) return { actief: false, context: { materiaal: null }, maxIntensiteit: 0, minIntensiteit: 0, weerMelding: null, ruimteM2: undefined, lichtMelding: null };
  const context = { materiaal: c?.materiaal || null, veld: c?.veld || null, wedstrijddag: c?.wedstrijddag || null };
  const licht = dagVoorWedstrijd(o.datum, context);
  let veld = context.veld || 'heel';
  if (o.halfVeld && veld === 'heel') veld = 'half'; else if (o.halfVeld && veld === 'half') veld = 'kwart';
  const heeftVeld = !!context.veld || !!o.halfVeld;
  return {
    actief: true, context,
    maxIntensiteit: licht ? MAX_INTENSITEIT_VOOR_WEDSTRIJD : 0,
    minIntensiteit: o.slechtWeer ? 2 : 0,
    weerMelding: o.slechtWeer ? 'Regen of koud: vormen waarin spelers veel bewegen, geen lange uitleg en korte pauzes. Laat de spelers warme kleding aan houden in de pauzes. Dit is gewoonte onder trainers, niet onderzocht bij jeugd.' : null,
    ruimteM2: heeftVeld ? ruimteM2(veld, standaardRuimte(leeftijd)) : undefined,
    lichtMelding: licht ? 'De dag voor de wedstrijd: lichter, met maximaal zwaarte 2. Dit is gewoonte onder trainers, niet onderzocht bij jeugd.' : null,
  };
}

function score(v, o){
  let sc = 0;
  const themaMatch = heeftThema(v, o.thema);
  if (v.themaregelVorm) sc += 8;                        /* wedstrijdvorm met themaregel: altijd passend */
  else if (themaMatch) sc += 10;
  else if (o.zwakDomein && v.domeinen.includes(o.zwakDomein)) sc += 3;
  else if (v.fase === 'warming-up' && (v.thema.includes('Technische vaardigheden') || v.thema.includes('Teamsport en plezier'))) sc += 2;
  if (o.slot !== 'warming-up' && o.slot !== 'afsluiting' && !v.themaregelVorm) sc -= 2 * Math.abs(v.complexiteit - o.doelC);
  if (o.slot === 'warming-up') sc -= Math.abs(v.complexiteit - Math.min(o.doelC, 2));
  const gr = groepsindeling(v, o.aantalSpelers);
  sc -= 0.8 * gr.wissel;                                /* liever vormen waar iedereen in meespeelt */
  const i = o.recent.indexOf(v.id);
  if (i >= 0) sc -= 8 - Math.min(5, i);                 /* recent gebruikt: liever iets anders */
  const iv = o.intens || [];
  if (v.intensiteit === 3 && iv.length >= 2 && iv[iv.length - 1] === 3 && iv[iv.length - 2] === 3) sc -= 12;   /* nooit drie zware onderdelen achter elkaar */
  else if (v.intensiteit === 3 && iv[iv.length - 1] === 3) sc -= 3;
  if (o.slot === 'warming-up' && v.intensiteit === 3) sc -= 4;                                            /* eerst rustig opwarmen */
  if (o.slot === 'kern1' && v.fase === 'positiespel') sc += 1;
  if ((o.slot === 'kern1' || o.slot === 'kern2') && v.voetbalecht) sc += 3;   /* ruim de helft van de tijd voetbalecht */
  if (v.soort && (o.soorten || []).includes(v.soort)) sc -= 4;                                              /* liever een andere soort spelvorm dan eerder in de training */
  if (o.slot === 'warming-up' && v.voetbalecht) sc += 1.5;                                                 /* warming-up als kleine spelvorm */
  sc += hash(v.id + o.seed) * 0.9;                      /* stabiele variatie per week */
  return sc;
}
function beste(kand, o){ return kand.map(v => ({ v, s: score(v, o) })).sort((a, b) => b.s - a.s)[0]?.v || null; }
export function rangschik(vormen, slot, o){ /* alternatieven voor 'wissel vorm' */
  const leeftijd = o.leeftijd ?? leeftijdVan(o.categorie);
  const kand = kandidaten(vormen, slot, { leeftijd: clamp(leeftijd, 6, 19), N: o.aantalSpelers, gebruikt: new Set(o.uitsluiten || []) }, contextVan(o, clamp(leeftijd, 6, 19)));
  const doelC = o.doelC ?? 2;
  return kand.map(v => ({ v, s: score(v, { ...o, slot, doelC, recent: o.recent || [], seed: o.seed ?? 0, intens: o.intens || [], soorten: o.soorten || [] }) })).sort((a, b) => b.s - a.s).map(x => x.v);
}

export function bouwOnderdeel(v, sl, { N, thema }){
  const gr = groepsindeling(v, N);
  const veld = schaalVeld(v, gr.groepGrootte);
  const ri = rondeIndeling(v, sl.minuten);
  const regel = v.themaregelVorm ? (THEMAREGEL_BRON[thema] || null) : null;
  return {
    slot: sl.slot, slotNaam: SLOT_NAAM[sl.slot], minuten: sl.minuten, vormId: v.id, vorm: v,
    ...gr, veld, ...ri, themaregel: regel,
    ruimtePerSpeler: Math.round((veld.b * veld.l) / gr.groepGrootte),
    totaleRuimte: Math.round(veld.b * veld.l * gr.groepen),
  };
}
/* Themaregels komen uit de bibliotheek (één simpele regel per leercurve-thema). */
export const THEMAREGEL_BRON = {};
Object.assign(THEMAREGEL_BRON, BIBLIOTHEEK.themaregels);

/* Knoppen: complexiteit, druk en coachstijl. */
export function pasKnoppenToe(od, k = {}){
  const v = od.vorm;
  const regels = [];
  let veld = { ...od.veld };
  const druk = clamp(k.druk ?? 0, -1, 1);
  const compl = clamp(k.complexiteit ?? 0, -1, 1);
  if (druk !== 0 && v.fase !== 'partijspel'){
    const f = druk > 0 ? 0.85 : 1.2;
    veld = { b: Math.max(5, Math.round(veld.b * f)), l: Math.max(5, Math.round(veld.l * f)) };
    regels.push(druk > 0 ? 'Kleinere ruimte: minder tijd en ruimte voor de spelers.' : 'Grotere ruimte: meer tijd en ruimte voor de spelers.');
  }
  if (druk !== 0) regels.push(...(druk > 0 ? v.moeilijker : v.makkelijker).slice(-1));
  if (compl !== 0) regels.push(...(compl > 0 ? v.moeilijker : v.makkelijker).slice(0, 1));
  const stijl = k.stijl === 'ontdekkend' ? 'vragen' : 'punten';
  return { veld, aanpassingen: regels, coaching: stijl === 'vragen' ? v.coachvragen : v.coachpunten, stijl };
}

/* ───────────── Validator ───────────── */
export function valideer(plan){
  const c = [];
  const ond = plan.onderdelen;
  const ovMin = plan.overgang ? plan.overgang.ontvangst + plan.overgang.tussen + plan.overgang.afsluiting : 0;
  const totaal = ond.reduce((a, o) => a + o.minuten, 0);
  const gewenst = plan.profiel.duur;
  c.push({ id: 'duur', ok: totaal + ovMin === gewenst, tekst: `${totaal} min in vormen + ${ovMin} min overgangen = ${totaal + ovMin} van ${gewenst} minuten` });

  const slots = ond.map(o => o.slot).join(',');
  c.push({ id: 'opbouw', ok: ond.length <= MAX_VORMEN && slots === 'warming-up,kern1,kern2,partij', tekst: `${ond.length} trainingsvormen (maximaal ${MAX_VORMEN}): warming-up spelvorm, twee kernvormen en een partijspel` });

  const lang = ond.filter(o => o.minuten > (o.vorm.fase === 'partijspel' ? MAX_PARTIJ : MAX_VORM)
    || (o.minuten > MAX_VORM && (o.rondes < 2 || o.rust < 1)) || o.ronde > MAX_VORM);
  c.push({ id: 'vormduur', ok: lang.length === 0, tekst: lang.length ? `Te lang zonder onderbreking: ${lang.map(o => o.vorm.naam).join(', ')}` : `Elke vorm duurt maximaal ${MAX_VORM} minuten (partijspel ${MAX_PARTIJ} met onderbreking)` });

  const wu = ond[0];
  c.push({ id: 'warmingup', ok: !!wu && wu.vorm.fase === 'warming-up' && wu.minuten <= 12, tekst: 'De warming-up is een korte spelvorm die past bij de leeftijd' });

  const vb = ond.filter(o => o.vorm.voetbalecht).reduce((a, o) => a + o.minuten, 0);
  const vbPct = totaal ? Math.round(100 * vb / totaal) : 0;
  c.push({ id: 'voetbalecht', ok: vbPct >= 50, tekst: `${vbPct}% van de tijd in voetbalechte vormen (minimaal 50%)` });

  const th = plan.profiel.thema;
  const thMin = ond.filter(o => heeftThema(o.vorm, th) || o.themaregel).reduce((a, o) => a + o.minuten, 0);
  const thPct = totaal ? Math.round(100 * thMin / totaal) : 0;
  c.push({ id: 'thema', ok: thPct >= 60, tekst: `${thPct}% van de tijd werkt aan het thema (minimaal 60%)` });

  const wacht = ond.filter(o => o.vorm.wachtrij);
  c.push({ id: 'wachtrij', ok: wacht.length === 0, tekst: wacht.length ? `Wachtrijen in: ${wacht.map(o => o.vorm.naam).join(', ')}` : 'Geen wachtrijen: iedereen is steeds in actie' });

  const slecht = ond.filter(o => { const [a, b] = RUIMTE_PER_SPELER[o.vorm.fase]; return o.ruimtePerSpeler < a || o.ruimtePerSpeler > b; });
  c.push({ id: 'ruimte', ok: slecht.length === 0, tekst: slecht.length ? `Ruimte per speler buiten het bereik: ${slecht.map(o => `${o.vorm.naam} (${o.ruimtePerSpeler} m²)`).join(', ')}` : 'Ruimte per speler past bij elk onderdeel' });

  const maxM2 = Math.max(0, ...ond.map(o => o.totaleRuimte));
  c.push({ id: 'veld', ok: maxM2 <= plan.ruimteM2, tekst: `Grootste ruimtebehoefte ${maxM2} m² (beschikbaar ${plan.ruimteM2} m²)` });

  let streak = 0, maxStreak = 0;
  for (const o of ond){ streak = o.vorm.intensiteit === 3 ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak); }
  c.push({ id: 'intensiteit', ok: maxStreak <= 2, tekst: maxStreak <= 2 ? 'Intensiteit wisselt met rustmomenten' : 'Te veel zware onderdelen achter elkaar' });

  const grBad = ond.filter(o => o.groepGrootte < o.vorm.spelers.min || o.groepGrootte > o.vorm.spelers.max);
  c.push({ id: 'groepen', ok: grBad.length === 0, tekst: grBad.length ? 'Groepsgrootte past niet bij de vorm' : 'Groepsgrootte past bij elke vorm' });

  /* elke vorm heeft aanwijzingen voor de coach, differentiatie en verschillende spelvormen */
  const gat = ond.filter(o => !(o.vorm.coachpunten?.length >= 3 && o.vorm.coachvragen?.length >= 2 && o.vorm.makkelijker?.length >= 2
    && o.vorm.moeilijker?.length >= 2 && o.vorm.varianten?.length >= 2 && o.vorm.uitleg && o.vorm.letOp?.length));
  c.push({ id: 'coach', ok: gat.length === 0, tekst: gat.length ? `Aanwijzingen of differentiatie ontbreken bij: ${gat.map(o => o.vorm.naam).join(', ')}` : 'Elke vorm heeft coachaanwijzingen, differentiatie en varianten' });

  const soorten = new Set(ond.map(o => o.vorm.soort).filter(Boolean));
  c.push({ id: 'variatie', ok: soorten.size >= Math.min(3, ond.length), tekst: `${soorten.size} verschillende soorten spelvorm in deze training` });

  if (plan.context && plan.context.materiaal){
    const mis = ond.concat(plan.afsluiting ? [plan.afsluiting] : []).map(o => ({ o, h: haalbaar(o.vorm, o.groepen, plan.context) })).filter(x => !x.h.ok);
    c.push({ id: 'materiaal', ok: mis.length === 0, tekst: mis.length ? `Materiaal mist bij: ${mis.map(x => `${x.o.vorm.naam} (${Object.entries(x.h.tekort).map(([k, n]) => n + ' ' + (MATERIAAL_NAAM[k] || k).toLowerCase()).join(', ')})`).join('; ')}` : 'Het materiaal van het team is genoeg (eventueel met de vervangers)' });
  }

  c.push({ id: 'avg', ok: true, tekst: 'Geen namen of persoonsgegevens gebruikt (alleen teamprofiel)' });
  return { ok: c.every(x => x.ok), checks: c, voetbalechtPct: vbPct, themaPct: thPct };
}

/* ───────────── Leerlijn ───────────── */
/* Vaste volgorde van thema's per bouw; de generator filtert op leeftijd en op beschikbaarheid in de bibliotheek. */
export const VOLGORDE_PER_BOUW = {
  onder:  ['Teamsport en plezier', 'Technische vaardigheden', 'Uitspelen 1:1', 'Scoren', 'Positiespel opbouw', 'Dieptespel opbouw', 'Teamsport en plezier'],
  midden: ['Positiespel opbouw', 'Storen en veroveren', 'Dieptespel opbouw', 'Verdedigen 1:1', 'Verdedigen dieptespel', 'Aanvallen met voorzet', 'Verdedigen van voorzet', 'Voorkomen van doelpunten', 'Scoren'],
  boven:  ['Positiespel opbouw', 'Storen en veroveren', 'Dieptespel opbouw', 'Verdedigen dieptespel', 'Aanvallen met voorzet', 'Verdedigen van voorzet', 'Voorkomen van doelpunten', 'Scoren'],
};

/* Maakt een jaarlijn van leerblokken (4–6 weken). weken = aantal trainingsweken in het seizoen. */
export function jaarlijn({ bouw, leeftijd, weken = 36, beschikbaar = null }){
  const ok = new Set(LEERCURVE.filter(t => t.vanaf <= leeftijd).map(t => t.thema));
  let lijst = (VOLGORDE_PER_BOUW[bouw] || VOLGORDE_PER_BOUW.midden).filter(t => ok.has(t) && (!beschikbaar || beschikbaar.has(t)));
  if (!lijst.length) lijst = [...ok].filter(t => !beschikbaar || beschikbaar.has(t));
  const nBlokken = Math.max(1, Math.round(weken / 5));
  const blokken = [];
  let rest = weken;
  for (let i = 0; i < nBlokken; i++){
    const thema = lijst[i % lijst.length];
    const links = nBlokken - i;
    let len = clamp(Math.round(rest / links), 4, 6);
    if (i === nBlokken - 1) len = clamp(rest, 4, 6);
    len = Math.min(len, rest);
    if (len < 4 && blokken.length){ blokken[blokken.length - 1].weken += len; rest -= len; break; }
    blokken.push({ nr: i + 1, thema, weken: len, domein: LEERCURVE.find(t => t.thema === thema)?.domein, herhaling: i >= lijst.length });
    rest -= len;
    if (rest <= 0) break;
  }
  let w = 1;
  for (const b of blokken){ b.vanafWeek = w; b.totWeek = w + b.weken - 1; b.fasen = BLOKFASEN[b.weken] || BLOKFASEN[5]; w += b.weken; }
  return { bouw, leeftijd, weken: w - 1, blokken };
}
export function blokVoorWeek(lijn, week){
  const b = lijn.blokken.find(x => week >= x.vanafWeek && week <= x.totWeek) || lijn.blokken[lijn.blokken.length - 1];
  const idx = clamp(week - b.vanafWeek, 0, b.weken - 1);
  return { blok: b, weekInBlok: idx + 1, fase: b.fasen[idx] };
}
