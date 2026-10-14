/* ==================== SEIZOENSPLAN — LOGICA (puur, geen DOM, geen Firestore) ====================
   Van opbouwmodel + parameters naar een concept-jaarlijn (blokken van 4–6 weken), en van
   wedstrijdevaluaties naar een voorstel om de lijn bij te sturen. Alles hier is deterministisch
   en testbaar (tests/seizoensplan.test.mjs). De AI mag een jaarvoorstel doen en teksten
   verwoorden (functie seizoensVoorstel), maar KIEST hier niets: een AI-voorstel wordt eerst
   door valideerBlokken() gehaald en valt anders terug op de deterministische lijn.

   Privacy: signalen zijn teamgemiddelden en tellingen. Geen namen, geen uitslagen.

   Opbouwmodellen — eigen vertaling naar de thema's van de leercurve:
     leercurve : volgorde per bouw uit de leercurve (VOLGORDE_PER_BOUW in trainingsplanner.js)
     momenten  : aanvallen en verdedigen wisselen af; elk "moment van het spel" komt terug
     cyclus    : opbouwen · centrum · flank · verdedigen in korte cycli
   (Idee van periodes en herhaling: KNVB-seizoensplanning en De Voetbalmethode deel 4; geen tekst overgenomen.) */
import { LEERCURVE, VOLGORDE_PER_BOUW, BLOKFASEN, jaarlijn } from './trainingsplanner.js?v=20261014a';

export const MODELLEN = {
  leercurve: { naam: 'Leercurve-thema’s', tekst: 'Eén thema per blok, in de vaste volgorde van de leercurve voor jouw bouw.', seq: null },
  momenten: { naam: 'Vier momenten van het spel', tekst: 'Periodes waarin aanvallen en verdedigen steeds terugkomen, zodat alles regelmatig herhaald wordt.',
    opm: 'Omschakelen zit nog niet in de bibliotheek (leercurve vanaf O14); nu alleen aanvallen en verdedigen.',
    seq: ['Positiespel opbouw', 'Storen en veroveren', 'Dieptespel opbouw', 'Verdedigen dieptespel', 'Scoren', 'Verdedigen 1:1', 'Aanvallen met voorzet', 'Voorkomen van doelpunten', 'Verdedigen van voorzet'] },
  cyclus: { naam: 'Opbouw · centrum · flank · verdedigen', tekst: 'Korte cycli van 4 tot 6 weken met steeds een andere teamfunctie, het hele seizoen herhaald.',
    seq: ['Positiespel opbouw', 'Uitspelen 1:1', 'Aanvallen met voorzet', 'Storen en veroveren', 'Dieptespel opbouw', 'Scoren', 'Verdedigen van voorzet', 'Verdedigen dieptespel'] },
};
export const ACCENTEN = {
  'Verdedigen': ['Verdedigen 1:1', 'Storen en veroveren', 'Verdedigen dieptespel'],
  'Techniek': ['Technische vaardigheden', 'Uitspelen 1:1'],
  'Plezier & teamgevoel': ['Teamsport en plezier'],
  'Aanvallen': ['Scoren', 'Dieptespel opbouw'],
};

/* ---------- kalender ---------- */
const dag = iso => new Date(iso + 'T12:00:00');
const iso = d => { const z = new Date(d.getTime()); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`; };
export function maandagVan(isoDatum){ const d = dag(isoDatum); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
export function plusWeken(isoDatum, n){ const d = dag(isoDatum); d.setDate(d.getDate() + 7 * n); return iso(d); }
/* Standaard vrij: de twee weken rond Kerst (week van 25 dec en de week erna). Vakanties verschillen per regio: de coach past aan. */
export function standaardVrij(start, eind){
  const uit = [];
  for (let jaar = dag(start).getFullYear(); jaar <= dag(eind).getFullYear(); jaar++){
    const kerst = maandagVan(`${jaar}-12-25`);
    for (const m of [kerst, plusWeken(kerst, 1)]) if (m >= maandagVan(start) && m <= eind) uit.push(m);
  }
  return uit;
}
export function weekKalender(start, eind, vrij = []){
  const v = new Set(vrij.map(maandagVan));
  const uit = []; let nr = 0;
  for (let m = maandagVan(start); m <= eind; m = plusWeken(m, 1)){
    const isVrij = v.has(m);
    uit.push({ iso: m, vrij: isVrij, nr: isVrij ? null : ++nr });
  }
  return uit;
}

/* ---------- blokken ---------- */
export function fasenVoor(b){
  if (b.soort === 'herhaling') return b.weken >= 2 ? ['Verdiep', 'Pas toe', ...(b.weken > 2 ? ['Wedstrijd'] : [])].slice(0, b.weken) : ['Pas toe'];
  return BLOKFASEN[b.weken] || BLOKFASEN[5];
}
export function herreken(blokken, kal){
  const tw = kal.filter(w => !w.vrij);
  let w = 1;
  blokken.forEach((b, i) => {
    b.nr = i + 1; b.vanafWeek = w; b.totWeek = w + b.weken - 1; b.fasen = fasenVoor(b);
    b.van = tw[b.vanafWeek - 1]?.iso || null; b.tot = tw[b.totWeek - 1]?.iso || null;
    w += b.weken;
  });
  return blokken;
}
export function beschikbareThemas(vormen){ return new Set(vormen.flatMap(v => v.thema)); }

/* Thema-volgorde voor een model, gefilterd op leeftijd en bibliotheek, met accenten extra vaak. */
export function themaVolgorde({ model, bouw, leeftijd, accent = [], beschikbaar }){
  const ok = new Set(LEERCURVE.filter(t => t.vanaf <= leeftijd).map(t => t.thema));
  const bruikbaar = t => ok.has(t) && (!beschikbaar || beschikbaar.has(t));
  const bron = MODELLEN[model]?.seq || VOLGORDE_PER_BOUW[bouw] || VOLGORDE_PER_BOUW.midden;
  let seq = bron.filter(bruikbaar);
  if (!seq.length) seq = [...ok].filter(bruikbaar);
  const acc = accent.flatMap(a => ACCENTEN[a] || []).filter(bruikbaar);
  if (!acc.length) return seq;
  const set = new Set(acc), uit = [];
  seq.forEach(t => { uit.push(t); if (set.has(t)) uit.push(t); });          /* accentthema's twee keer in de cyclus */
  acc.filter(t => !seq.includes(t)).forEach(t => uit.push(t));
  return uit;
}

/* Maakt het concept. p = { categorie, leeftijd, bouw, model, start, eind, vrij[], accent[], tpw, duur, niveau, beschikbaar:Set } */
export function maakSeizoensplan(p){
  const kal = weekKalender(p.start, p.eind, p.vrij || []);
  const n = kal.filter(w => !w.vrij).length;
  const volgorde = themaVolgorde({ model: p.model, bouw: p.bouw, leeftijd: p.leeftijd, accent: p.accent || [], beschikbaar: p.beschikbaar });
  VOLGORDE_PER_BOUW._eigen = volgorde;                /* jaarlijn() verdeelt de weken over blokken van 4–6 weken */
  const lijn = jaarlijn({ bouw: '_eigen', leeftijd: p.leeftijd, weken: Math.max(4, n), beschikbaar: p.beschikbaar });
  delete VOLGORDE_PER_BOUW._eigen;
  const blokken = lijn.blokken.map(b => ({ thema: b.thema, domein: b.domein, weken: b.weken, herhaling: !!b.herhaling, soort: 'basis' }));
  herreken(blokken, kal);
  blokken.forEach((b, i) => { b.waarom = waarom(b, p); });
  return { kal, trainingsweken: n, blokken };
}

/* Regel-gebaseerde uitleg per blok (de AI mag dit mooier verwoorden, maar niet veranderen). */
export function waarom(b, p){
  const r = [];
  if (b.soort === 'herhaling') return `Herhaalblok na bijsturing: ${b.reden || 'dit thema vraagt extra aandacht'}.`;
  const lv = LEERCURVE.find(t => t.thema === b.thema)?.vanaf;
  if (p.model === 'leercurve') r.push(`Volgorde uit de leercurve voor de ${p.bouw}bouw; ${b.thema} (${b.domein}) komt vanaf ${lv} jaar aan bod.`);
  else if (p.model === 'momenten') r.push('Model “vier momenten”: aanvallen en verdedigen wisselen elkaar af, zodat beide regelmatig terugkomen.');
  else r.push('Model “opbouw · centrum · flank · verdedigen”: korte cyclus met één teamfunctie per blok.');
  const acc = (p.accent || []).find(a => (ACCENTEN[a] || []).includes(b.thema));
  if (acc) r.push(`Jij koos het accent “${acc}”, daarom komt dit thema extra vaak.`);
  if (b.herhaling) r.push('Tweede keer dit seizoen: herhalen versterkt wat geleerd is.');
  if (b.weken < 5) r.push(`Kort blok (${b.weken} weken) i.v.m. het aantal beschikbare weken.`);
  return r.join(' ');
}

/* Controle van een (AI-)voorstel voor blokken. Geeft { ok, fouten[] }. */
export function valideerBlokken(blokken, { weken, toegestaan }){
  const f = [];
  if (!Array.isArray(blokken) || !blokken.length) return { ok: false, fouten: ['geen blokken'] };
  let som = 0;
  blokken.forEach((b, i) => {
    if (!toegestaan.has(b?.thema)) f.push(`blok ${i + 1}: onbekend of niet toegestaan thema`);
    if (!Number.isInteger(b?.weken) || b.weken < 4 || b.weken > 6) f.push(`blok ${i + 1}: ${b?.weken} weken (4–6 toegestaan)`);
    som += Number(b?.weken) || 0;
    if (i && blokken[i - 1].thema === b.thema) f.push(`blok ${i + 1}: zelfde thema als het vorige blok`);
  });
  if (som !== weken) f.push(`som van de weken is ${som}, verwacht ${weken}`);
  return { ok: f.length === 0, fouten: f };
}

/* ---------- huidige positie in het plan ---------- */
export function positieOp(plan, isoDatum){
  const kal = plan.kal || [], m = maandagVan(isoDatum);
  const w = kal.find(x => x.iso === m);
  if (!w || w.vrij || !w.nr) return null;
  const b = plan.blokken.find(x => w.nr >= x.vanafWeek && w.nr <= x.totWeek) || plan.blokken[plan.blokken.length - 1];
  const idx = Math.max(0, Math.min(b.weken - 1, w.nr - b.vanafWeek));
  return { weekNr: w.nr, blok: b, weekInBlok: idx + 1, fase: b.fasen[idx] };
}
export function positieWeek(plan, weekNr){
  const b = plan.blokken.find(x => weekNr >= x.vanafWeek && weekNr <= x.totWeek) || plan.blokken[plan.blokken.length - 1];
  const idx = Math.max(0, Math.min(b.weken - 1, weekNr - b.vanafWeek));
  return { weekNr, blok: b, weekInBlok: idx + 1, fase: b.fasen[idx] };
}

/* ---------- bijsturen op evaluaties ---------- */
export const BIJSTUREN = { minMetingen: 3, venster: 4, drempelGem: 2.5, laagScore: 2, minLaag: 2, checkMin: 3 };
const gem = a => a.reduce((x, y) => x + y, 0) / a.length;

/* Teamsignalen uit wedstrijdevaluaties: alleen cijfers per categorie/thema. evals: [{datum, scores:{cat:1-5}, themaCheck?:{thema, antwoord}}] */
export function teamSignalen(evals, { start = '', catThema = {} } = {}){
  const lijst = (evals || []).filter(e => e && (!start || (e.datum || '') >= start)).sort((a, b) => (a.datum || '').localeCompare(b.datum || '')).slice(-BIJSTUREN.venster);
  const perCat = {};
  for (const cat of Object.keys(catThema)){
    const w = lijst.map(e => e.scores?.[cat]).filter(x => typeof x === 'number');
    if (w.length) perCat[cat] = { thema: catThema[cat], n: w.length, gem: gem(w), laag: w.filter(x => x <= BIJSTUREN.laagScore).length };
  }
  const checks = {};
  for (const e of lijst){
    const c = e.themaCheck; if (!c?.thema) continue;
    const x = c.antwoord === 'ja' ? 1 : c.antwoord === 'deels' ? 0.5 : c.antwoord === 'nee' ? 0 : null; if (x === null) continue;
    (checks[c.thema] ||= []).push(x);
  }
  const perThema = Object.fromEntries(Object.entries(checks).map(([t, w]) => [t, { n: w.length, gem: gem(w), nee: w.filter(x => x === 0).length }]));
  return { metingen: lijst.length, perCat, perThema };
}

/* Voorstellen. besloten = [{thema, soort, weekNr}] eerder genomen besluiten (toegepast of genegeerd). Maximaal één voorstel per week. */
export function stelBijsturingVoor({ plan, weekNr, signalen, besloten = [], kal }){
  const uit = { voorstellen: [], uitgesteld: [], opm: '' };
  if (!plan?.blokken?.length) return uit;
  if (signalen.metingen < BIJSTUREN.minMetingen){
    uit.opm = `Nog maar ${signalen.metingen} wedstrijdevaluatie${signalen.metingen === 1 ? '' : 's'} in dit seizoen. Er zijn er minstens ${BIJSTUREN.minMetingen} nodig voordat het schema zich aanpast.`;
    return uit;
  }
  const pos = positieWeek(plan, weekNr);
  const kand = [];
  const kandidaat = (thema, feiten, ernst, bron) => {
    const blok = plan.blokken.find(b => b.thema === thema && b.soort !== 'herhaling');
    if (!blok) return;
    const loopt = pos.blok.thema === thema && pos.blok.soort !== 'herhaling';
    const geweest = blok.totWeek < weekNr;
    if (!loopt && !geweest) return;                                           /* blok moet lopen of al geweest zijn */
    if (besloten.some(x => x.thema === thema && Math.abs((x.weekNr ?? -99) - weekNr) < 4)) return;   /* niet drie weken achter elkaar over hetzelfde thema */
    if (loopt && pos.blok.verlengd) return;                                    /* per blok maximaal één keer verlengen */
    if (!loopt && plan.blokken.some(b => b.soort === 'herhaling' && b.thema === thema)) return;       /* per thema maximaal één herhaalblok */
    kand.push({ id: `v-${bron}-${thema}`.replace(/\s+/g, '-'), thema, soort: loopt ? 'verleng' : 'herhaal', bron, ernst, feiten });
  };
  for (const [cat, s] of Object.entries(signalen.perCat)){
    if (s.n >= BIJSTUREN.minMetingen && s.gem < BIJSTUREN.drempelGem && s.laag >= BIJSTUREN.minLaag)
      kandidaat(s.thema, { bron: 'categorie', categorie: cat, gemiddelde: +s.gem.toFixed(1), metingen: s.n, laag: s.laag, schaal: 5 }, s.gem / 5, 'cat');
  }
  for (const [thema, s] of Object.entries(signalen.perThema)){
    if (s.n >= BIJSTUREN.checkMin && s.gem < 0.4 && s.nee >= 2)
      kandidaat(thema, { bron: 'themacheck', gemiddelde: +s.gem.toFixed(2), metingen: s.n, nee: s.nee }, s.gem, 'chk');
  }
  kand.sort((a, b) => a.ernst - b.ernst);
  if (!kand.length) return uit;
  const eerste = kand[0];
  uit.voorstellen.push(maakVoorstel(eerste, plan, pos, weekNr));
  uit.uitgesteld = [...new Set(kand.slice(1).map(k => k.thema).filter(t => t !== eerste.thema))];
  return uit;
}
function maakVoorstel(k, plan, pos, weekNr){
  const nu = k.soort === 'verleng';
  const volgend = plan.blokken.find(b => b.vanafWeek > (nu ? pos.blok.totWeek : weekNr - 1) && b.thema !== k.thema && b.soort !== 'herhaling');
  const f = k.feiten;
  const feitTekst = f.bron === 'categorie'
    ? `${f.laag} van de laatste ${f.metingen} wedstrijden scoorde het team laag (≤ ${BIJSTUREN.laagScore}); gemiddeld ${String(f.gemiddelde).replace('.', ',')} van ${f.schaal}.`
    : `Bij ${f.nee} van de laatste ${f.metingen} wedstrijden kwam het thema niet terug in het spel.`;
  return {
    id: k.id, thema: k.thema, soort: k.soort, weekNr, feiten: f,
    titel: nu ? `Blok “${k.thema}” 1 week verlengen` : `Herhaalblok “${k.thema}” van 2 weken invoegen`,
    gevolg: volgend ? `Het blok “${volgend.thema}” wordt ${nu ? 1 : 2} week${nu ? '' : 'en'} korter; het seizoen blijft even lang.` : 'Er is geen volgend blok om weken van af te halen; het voorstel kan niet worden toegepast.',
    toepasbaar: !!volgend,
    uitleg: `${feitTekst} Dat hoort bij het thema ${k.thema}. ${nu ? 'Dit blok loopt nu; één week extra geeft meer herhalingen in de partijvorm.' : 'Dit blok is al geweest; een korte herhaling houdt het vast.'}`,
  };
}

/* Past een voorstel toe op (een kopie van) het plan. Het totaal aantal weken blijft gelijk. Geeft null als het niet kan. */
export function pasVoorstelToe(plan, v){
  const blokken = plan.blokken.map(b => ({ ...b }));
  const i = blokken.findIndex(b => b.thema === v.thema && b.soort !== 'herhaling');
  if (i < 0) return null;
  const pos = positieWeek({ ...plan, blokken }, v.weekNr);
  const huidig = pos.blok.nr - 1;                      /* index van het blok waarin we nu zitten */
  const weg = (n) => {                                 /* haalt n weken weg uit de blokken ná het huidige blok, nooit onder 4 */
    let rest = n;
    for (let j = huidig + 1; j < blokken.length && rest > 0; j++){
      if (blokken[j].soort === 'herhaling') continue;
      while (rest > 0 && blokken[j].weken > 4){ blokken[j].weken--; rest--; }
    }
    return rest === 0;
  };
  if (v.soort === 'verleng'){
    if (!weg(1)) return null;
    blokken[huidig].weken++; blokken[huidig].verlengd = true;
  } else {
    if (!weg(2)) return null;
    const nieuw = { thema: v.thema, domein: blokken[i].domein, weken: 2, herhaling: true, soort: 'herhaling', reden: String(v.uitleg || '').split('. ')[0].toLowerCase() };
    nieuw.waarom = waarom(nieuw, {});
    blokken.splice(huidig + 1, 0, nieuw);
  }
  herreken(blokken, plan.kal);
  return { ...plan, blokken };
}

/* Welk thema liep er op een wedstrijddatum? (voor de thema-check in de teamevaluatie) */
export function themaOpDatum(plan, isoDatum){
  const p = positieOp(plan, isoDatum);
  return p ? p.blok.thema : null;
}
