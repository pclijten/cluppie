/* ==========================================================================
   trainingsplanner.js — regelgebaseerde trainingsplanner + validator + leerlijn
   Geen AI en geen persoonsgegevens: alleen een teamprofiel
   (categorie, aantal spelers, niveau, duur, thema). De AI (Claude Haiku) mag
   daarna alleen de uitleg personaliseren; de keuze en controle gebeuren hier.
   ========================================================================== */

import { LEERCURVE } from './config.js?v=20261011g';
import { BIBLIOTHEEK } from './trainingsbibliotheek.js?v=20261012e';
export { LEERCURVE };

/* ───────────── Trainingsopbouw ───────────── */
/* Standaardopbouw per trainingsduur (instelbaar per club/team; géén KNVB-norm). */
export const OPBOUW = {
  60: [ s('warming-up', 10), s('kern1', 14), s('kern2', 15), s('partij', 18), s('afsluiting', 3) ],
  75: [ s('warming-up', 12), s('kern1', 15), s('kern2', 18), s('partij', 25), s('afsluiting', 5) ],
  90: [ s('warming-up', 15), s('kern1', 18), s('kern2', 20), s('partij', 30), s('afsluiting', 7) ],
};
function s(slot, minuten){ return { slot, minuten }; }
const SLOT_FASEN = {
  'warming-up': ['warming-up'],
  kern1:        ['positiespel', 'spelvorm'],
  kern2:        ['spelvorm', 'positiespel'],
  partij:       ['partijspel'],
  afsluiting:   ['afsluiting'],
};
export const SLOT_NAAM = { 'warming-up': 'Warming-up', kern1: 'Kernvorm 1', kern2: 'Kernvorm 2', partij: 'Partijspel', afsluiting: 'Afsluiting' };

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

/* Rondes en rondeduur binnen de beschikbare minuten. */
export function rondeIndeling(v, minuten){
  const { ronde, rondes: [rMin, rMax], rust } = v.duur;
  let r = clamp(Math.floor((minuten + rust) / (ronde + rust)), rMin, rMax);
  let rd = ronde;
  if (r * rd + (r - 1) * rust > minuten) rd = Math.max(1, Math.floor((minuten - (r - 1) * rust) / r));
  return { rondes: r, ronde: rd, rust };
}

/* Standaard-ruimte in m² voor de check "past op het beschikbare veld" (aanname, instelbaar). */
export function standaardRuimte(leeftijd){ return leeftijd >= 13 ? 6000 : 3500; }

/* ───────────── Planner ───────────── */
/* o = { categorie, aantalSpelers, niveau (1-3), duur (60|75|90), thema, blokFase ('Ontdek'|…),
         recent: [vorm-id's], seed, ruimteM2, zwakDomein } */
export function maakPlan(vormen, o){
  const leeftijd = o.leeftijd ?? leeftijdVan(o.categorie);
  const N = o.aantalSpelers;
  const duur = o.duur in OPBOUW ? o.duur : 75;
  const niveau = clamp(o.niveau ?? 2, 1, 3);
  const blokFase = o.blokFase || 'Verdiep';
  const doelC = clamp((FASE_COMPLEXITEIT[blokFase] ?? 2) + (niveau - 2), 1, 3);
  const recent = o.recent || [];
  const seed = String(o.seed ?? 0);
  const ruimte = o.ruimteM2 ?? standaardRuimte(leeftijd);
  const meldingen = [];
  const gebruikt = new Set();
  const onderdelen = [];
  const intens = [];                                  /* intensiteit van de gekozen onderdelen tot nu toe */

  for (const sl of OPBOUW[duur]){
    const kand = kandidaten(vormen, sl.slot, { leeftijd, N, gebruikt });
    let gekozen = null;
    if (sl.slot === 'partij' && !kand.length){
      /* te weinig spelers voor de wedstrijdvorm → kleine voetbalechte vorm */
      const klein = kandidaten(vormen, 'kern2', { leeftijd, N, gebruikt }).filter(v => v.voetbalecht);
      if (klein.length){
        gekozen = beste(klein, { ...o, doelC, recent, seed, thema: o.thema, slot: 'kern2', intens });
        meldingen.push(`Met ${N} spelers past de wedstrijdvorm niet; als partijspel is een kleine voetbalvorm gekozen.`);
      }
    } else {
      gekozen = beste(kand, { ...o, doelC, recent, seed, thema: o.thema, slot: sl.slot, intens });
    }
    if (!gekozen){ meldingen.push(`Geen passende vorm gevonden voor ${SLOT_NAAM[sl.slot]} (leeftijd ${leeftijd}, ${N} spelers).`); continue; }
    gebruikt.add(gekozen.id);
    intens.push(gekozen.intensiteit);
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
    const kand = kandidaten(vormen, sl.slot, { leeftijd, N, gebruikt: ander }).filter(v => v.intensiteit < 3);
    const nieuw = beste(kand, { ...o, doelC, recent, seed, thema: o.thema, slot: sl.slot, intens: [] });
    if (!nieuw) break;
    gebruikt.delete(onderdelen[idx].vormId); gebruikt.add(nieuw.id);
    onderdelen[idx] = bouwOnderdeel(nieuw, sl, { N, thema: o.thema });
    meldingen.push('Een zware vorm is vervangen door een rustiger alternatief om overbelasting te voorkomen.');
  }

  const plan = { profiel: { categorie: o.categorie, leeftijd, aantalSpelers: N, niveau, duur, thema: o.thema, blokFase, doelComplexiteit: doelC },
                 onderdelen, meldingen, ruimteM2: ruimte };
  plan.controle = valideer(plan);
  return plan;
}

function kandidaten(vormen, slot, { leeftijd, N, gebruikt }){
  const fasen = SLOT_FASEN[slot];
  return vormen.filter(v => fasen.includes(v.fase) && leeftijd >= v.leeftijd[0] && leeftijd <= v.leeftijd[1]
    && N >= v.spelers.min && !gebruikt.has(v.id));
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
  sc += hash(v.id + o.seed) * 0.9;                      /* stabiele variatie per week */
  return sc;
}
function beste(kand, o){ return kand.map(v => ({ v, s: score(v, o) })).sort((a, b) => b.s - a.s)[0]?.v || null; }
export function rangschik(vormen, slot, o){ /* alternatieven voor 'wissel vorm' */
  const leeftijd = o.leeftijd ?? leeftijdVan(o.categorie);
  const kand = kandidaten(vormen, slot, { leeftijd, N: o.aantalSpelers, gebruikt: new Set(o.uitsluiten || []) });
  const doelC = o.doelC ?? 2;
  return kand.map(v => ({ v, s: score(v, { ...o, slot, doelC, recent: o.recent || [], seed: o.seed ?? 0, intens: o.intens || [] }) })).sort((a, b) => b.s - a.s).map(x => x.v);
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
  const totaal = ond.reduce((a, o) => a + o.minuten, 0);
  const gewenst = plan.profiel.duur;
  c.push({ id: 'duur', ok: totaal === gewenst, tekst: `Totale duur ${totaal} van ${gewenst} minuten` });

  c.push({ id: 'opbouw', ok: ond[0]?.slot === 'warming-up' && ond[ond.length - 1]?.slot === 'afsluiting', tekst: 'Begint met warming-up met bal, eindigt met afsluiting' });

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

  const lang = ond.filter(o => o.ronde > 15);
  c.push({ id: 'rust', ok: lang.length === 0, tekst: lang.length ? 'Te lange blokken zonder drinkpauze' : 'Drinkpauzes tussen en binnen de onderdelen' });

  const grBad = ond.filter(o => o.groepGrootte < o.vorm.spelers.min || o.groepGrootte > o.vorm.spelers.max);
  c.push({ id: 'groepen', ok: grBad.length === 0, tekst: grBad.length ? 'Groepsgrootte past niet bij de vorm' : 'Groepsgrootte past bij elke vorm' });

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
