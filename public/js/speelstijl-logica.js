/* ==================== SPEELSTIJL VAN DE CLUB — logica (zonder DOM en zonder Firestore) ====================
   [20261019d] Een club legt haar speelstijl vast met een vragenlijst: acht onderdelen met twee kanten (A en B),
   per onderdeel twee situatievragen, plus leeftijdsfasen, wat de club belangrijk vindt en wat ze niet wil zien.
   Een korte lijst (8 vragen, één per onderdeel) geeft al een bruikbaar profiel; de volledige lijst (26 vragen) maakt het scherper.

   Deze eerste versie legt de stijl vast en toont hem. De planner past er nog niets op aan: daarvoor moet eerst elke
   vorm in de bibliotheek getagd worden (zie PORTEREN.md). "Weten we nog niet" is altijd toegestaan en telt als open.

   Eigen ontwerp (ervaring), geen gevalideerde test: er is geen gevalideerde vragenlijst voor de speelstijl van een
   amateurclub gevonden. De tekst bij elk onderdeel zegt of er onderzoek is of dat het een keuze is.
   Zonder imports (net als opkomst.js): scherm en tests gebruiken hem los van elkaar. */

export const MAX_INVULLERS = 5;
export const VERSIE = 1;

/* c = hoe goed onderbouwd: 'keuze' = een keuze van de club, geen goed of fout; 'ervaring' = ervaring van trainers, niet onderzocht bij jeugd */
export const CERT = { ervaring: 'Ervaring van trainers', keuze: 'Een keuze, geen goed of fout' };
export const DIMS = [
  { id: 'd1', n: 'Opbouw', A: 'Rustig opbouwen vanaf de keeper', B: 'Snel over de druk heen', c: 'keuze', why: 'Hoe beginnen jullie vanaf de keeper? Opbouwen vraagt veel oefening en geduld. Direct vooruit spelen vraagt andere vaardigheden. Beide zijn keuzes van de club.' },
  { id: 'd2', n: 'Tempo', A: 'Geduldig rondspelen', B: 'Snel vooruit', c: 'keuze', why: 'Hoe snel gaat de bal vooruit? Geduldig spelen geeft meer balcontacten. Snel vooruit geeft meer kansen in korte tijd.' },
  { id: 'd3', n: 'Druk zetten', A: 'Hoog druk zetten', B: 'Compact terugzakken', c: 'ervaring', why: 'Waar proberen we de bal te veroveren? Hoog druk zetten vraagt veel lopen en samenwerking. Bij jonge kinderen is druk als team vaak te moeilijk, daarom vragen we later vanaf welke leeftijd.' },
  { id: 'd4', n: 'Na balverlies', A: 'Direct terugpakken', B: 'Terugvallen en organiseren', c: 'ervaring', why: 'Wat doen spelers meteen nadat de bal is verloren? Bij profs geeft direct terugpakken veel kansen. Of het bij kinderen werkt, is niet onderzocht.' },
  { id: 'd5', n: 'Vrijheid van positie', A: 'Spelers wisselen vrij van plek', B: 'Vaste posities en taken', c: 'keuze', why: 'Mogen spelers van plek wisselen of heeft iedereen een vaste taak? Wisselen helpt spelers alle rollen te leren. Vaste taken geven duidelijkheid, vooral bij oudere teams.' },
  { id: 'd6', n: 'Aanvalsroute', A: 'Via het midden, combineren', B: 'Via de flanken', c: 'keuze', why: 'Waar willen jullie gevaar maken: door het midden met korte combinaties of via de zijkanten?' },
  { id: 'd7', n: 'Verdedigen', A: 'Zone: een ruimte bewaken', B: 'Man-op-man', c: 'keuze', why: 'Bewaakt een speler een stuk veld (zone) of een tegenstander? Zone vraagt meer inzicht. Man-op-man is makkelijker uit te leggen.' },
  { id: 'd8', n: 'Durf', A: 'Risico nemen, fouten horen erbij', B: 'Veilig spelen', c: 'ervaring', why: 'Mogen kinderen risico nemen en fouten maken om te leren, of speelt het team liever veilig? Leren vraagt meestal om ruimte voor fouten.' },
];
export const DIM_IDS = DIMS.map(d => d.id);

/* Twee situaties per onderdeel, bewust anders van vorm zodat zichtbaar wordt of iemand consequent antwoordt.
   Beide antwoorden zijn even redelijk geformuleerd. [vraag, tekst A, tekst B] */
const DQ = {
  d1: [['De keeper heeft de bal en de tegenstander staat hoog. Wat willen wij?', 'Rustig opbouwen via de keeper en de verdedigers, ook onder druk.', 'De bal snel naar voren spelen, over de druk heen.'], ['Een verdediger krijgt de bal onder druk. Wat is beter?', 'Risico nemen om te blijven spelen.', 'Weg ermee: veiligheid eerst.']],
  d2: [['Het team heeft de bal en niemand staat vrij. Wat willen wij?', 'Geduldig rondspelen tot er ruimte komt.', 'Snel vooruit, ook als je de bal soms verliest.'], ['Wat vinden wij het mooist?', 'Veel balbezit, ook zonder direct kansen.', 'Veel kansen, ook met weinig balbezit.']],
  d3: [['De tegenstander begint vanaf de keeper. Wat willen wij?', 'Hoog druk zetten en de bal ver van ons doel veroveren.', 'Terugzakken, compact staan en op een fout wachten.'], ['Waar willen wij dat spelers hun energie in steken?', 'In veel lopen om de bal snel te winnen.', 'In goed staan en samen de ruimte klein houden.']],
  d4: [['We verliezen de bal op het middenveld. Wat verwachten wij?', 'Direct met meerdere spelers de bal terugpakken.', 'Terugvallen en eerst de ruimte dichtzetten.'], ['Hoe snel willen we de bal terug?', 'Binnen een paar seconden.', 'Pas nadat we weer georganiseerd staan.']],
  d5: [['Een middenvelder loopt naar de zijkant om te helpen en de opstelling raakt even rommelig. Wat vinden wij?', 'Mooi: spelers mogen van plek wisselen als het helpt.', 'Liever niet: iedereen heeft een vaste taak.'], ['Wat vinden wij belangrijker?', 'Spelers die overal kunnen spelen.', 'Spelers die één positie heel goed leren.']],
  d6: [['Hoe willen wij het liefst gevaar maken?', 'Door het midden met korte combinaties.', 'Via de zijkanten met voorzetten.'], ['Een winger krijgt de bal aan de zijlijn. Wat willen wij?', 'Naar binnen dribbelen en combineren.', 'Doorgaan langs de lijn en voorzetten.']],
  d7: [['De tegenstander heeft de bal op onze helft. Hoe verdedigen wij?', 'Zone: ieder bewaakt een stuk veld.', 'Man-op-man: ieder pakt zijn eigen tegenstander.'], ['Een speler volgt zijn tegenstander ver buiten zijn positie. Wat vinden wij?', 'Niet goed: houd de organisatie.', 'Goed: dat is inzet.']],
  d8: [['Een speler probeert een trucje en verliest de bal. Wat is onze reactie?', 'Prima: zo leer je.', 'Liever veilig spelen, zonder onnodig risico.'], ['We staan 1-0 voor met 10 minuten te gaan. Wat doen wij?', 'Blijven spelen zoals altijd.', 'Veilig spelen en tijd laten verlopen.']],
};

/* Herkenningsstijlen: alleen ter oriëntatie, ze sturen niets. st = stand per onderdeel (−2 … +2). */
export const REFS = {
  pos: { n: 'Positiespel', t: 'Het team wil de bal houden, bouwt rustig op en zoekt de vrije speler in vaste structuren. Na balverlies direct terugpakken.', st: { d1: 2, d2: 2, d3: 1, d4: 2, d5: -1, d6: 2, d7: 2, d8: 1 } },
  druk: { n: 'Hoog druk en omschakelen', t: 'Het team zet hoog druk, pakt de bal direct terug en gaat snel naar voren. Veel energie en korte aanvallen.', st: { d1: 0, d2: -1, d3: 2, d4: 2, d5: -1, d6: -1, d7: 0, d8: 1 } },
  direct: { n: 'Direct voetbal', t: 'Het team speelt snel vooruit, via de flanken en lange ballen, en vecht om de tweede bal.', st: { d1: -2, d2: -2, d3: -1, d4: -1, d5: -1, d6: -2, d7: 0, d8: -1 } },
  compact: { n: 'Compact en counter', t: 'Het team staat compact, wacht op de fout en slaat snel toe. Vaste taken en veel discipline.', st: { d1: -2, d2: -2, d3: -2, d4: -2, d5: -1, d6: -2, d7: 2, d8: -1 } },
  ontdek: { n: 'Spelen en ontdekken', t: 'Weinig vaste afspraken. Spelers spelen veel, wisselen vrij van plek en leren van fouten maken.', st: { d1: 0, d2: 0, d3: 0, d4: 0, d5: 2, d6: 0, d7: 0, d8: 2 } },
};

/* Leeftijden voor de leeftijdsfasen; 99 = nooit (bij de jeugd). */
export const LEEFTIJDEN = [6, 8, 10, 12, 14, 16, 99];
export const FASEN = [
  { id: 'l1', n: 'Vaste positie', q: 'Vanaf welke leeftijd leren spelers een vaste positie?' },
  { id: 'l2', n: 'Hoog druk en omschakelen als team', q: 'Vanaf welke leeftijd oefenen we als team hoog druk zetten en omschakelen?' },
  { id: 'l3', n: 'Keeper speelt mee in de opbouw', q: 'Vanaf welke leeftijd speelt de keeper mee in de opbouw?' },
  { id: 'l4', n: 'Vaste opstelling (bijvoorbeeld 4-3-3)', q: 'Vanaf welke leeftijd spreken we een vaste opstelling af, zoals 4-3-3?' },
  { id: 'l5', n: 'Uitslagen en ranglijsten bespreken', q: 'Vanaf welke leeftijd bespreken we uitslagen en ranglijsten met de spelers?' },
];
export const NEE_OPTIES = [['lang', 'Lange bal vanaf de keeper bij jonge kinderen'], ['pos', 'Vaste posities bij spelers onder de 10'], ['schel', 'Schelden of straffen bij fouten'], ['beste', 'Alleen de beste spelers laten spelen'], ['tijd', 'Tijd rekken bij een voorsprong']];
export const DOEL_OPTIES = [['plezier', 'Plezier en blijven voetballen'], ['ontw', 'Spelers beter maken'], ['door', 'Doorstroom naar het eerste elftal'], ['res', 'Resultaten in de competitie']];
export const OPLEIDING_OPTIES = [['geen', 'Vrijwilligers zonder opleiding'], ['deels', 'Deels opgeleid'], ['ja', 'Vooral opgeleid']];
export const DEELN = { 1: 'Wie zijn wij', 2: 'Hoe willen wij voetballen', 3: 'Per leeftijd', 4: 'Wat is belangrijk', 5: 'Herkennen' };

/* Alle 26 vragen. k = soort: multi (max), one, ab (A, B of ? = weten we nog niet), age. */
export const VRAGEN = [
  { id: 'w1', deel: 1, k: 'multi', max: 2, q: 'Waar draait onze jeugdopleiding vooral om? Kies er twee.', o: DOEL_OPTIES },
  { id: 'w2', deel: 1, k: 'one', q: 'Hoe zijn de meeste trainers bij ons opgeleid?', o: OPLEIDING_OPTIES },
  ...DIMS.flatMap(d => DQ[d.id].map((x, i) => ({ id: d.id + 'ab'[i], deel: 2, k: 'ab', dim: d.id, q: x[0], A: x[1], B: x[2] }))),
  ...FASEN.map(f => ({ id: f.id, deel: 3, k: 'age', q: f.q })),
  { id: 't3', deel: 4, k: 'multi', max: 3, q: 'Welke drie onderdelen zijn voor ons het belangrijkst? Kies er drie.', o: DIMS.map(d => [d.id, d.n]) },
  { id: 'nee', deel: 4, k: 'multi', max: 5, q: 'Wat willen wij beslist niet zien? Kies wat past.', o: NEE_OPTIES },
  { id: 'hk', deel: 5, k: 'one', q: 'Welke wedstrijd lijkt het meest op hoe wij willen voetballen?', o: Object.entries(REFS).map(([k, r]) => [k, r.t]) },
];
export const KORT = VRAGEN.filter(q => /^d\da$/.test(q.id));
export const vragenVoor = modus => (modus === 'kort' ? KORT : VRAGEN);
const geldigeAntwoorden = {};
for (const q of VRAGEN) geldigeAntwoorden[q.id] = q;

/* Een antwoord opschonen tot een toegestane waarde, of undefined. */
export function schoonAntwoord(id, w){
  const q = geldigeAntwoorden[id]; if (!q) return undefined;
  if (q.k === 'ab') return ['A', 'B', '?'].includes(w) ? w : undefined;
  if (q.k === 'age') return LEEFTIJDEN.includes(Number(w)) ? Number(w) : undefined;
  const opties = q.o.map(o => o[0]);
  if (q.k === 'one') return opties.includes(w) ? w : undefined;
  if (q.k === 'multi'){
    if (!Array.isArray(w)) return undefined;
    return [...new Set(w.filter(x => opties.includes(x)))].slice(0, q.max);
  }
  return undefined;
}
export function schoonAntwoorden(a){
  const uit = {};
  for (const id of Object.keys(a || {})){ const w = schoonAntwoord(id, a[id]); if (w !== undefined) uit[id] = w; }
  return uit;
}
export const beantwoord = (a, q) => { const w = a && a[q.id]; return Array.isArray(w) ? w.length > 0 : w !== undefined && w !== null; };
export function voortgang(a, modus){
  const lijst = vragenVoor(modus);
  return { gedaan: lijst.filter(q => beantwoord(a, q)).length, totaal: lijst.length };
}

/* ---------- uitkomst van één invuller ---------- */
const PUNT = { A: 1, B: -1, '?': 0 };
/* Per onderdeel: stand (−2 … +2; A +1, B −1, ? 0), n = aantal echte antwoorden (A of B). Zonder antwoord: stand null. */
export function standenVan(a){
  const uit = {};
  for (const d of DIMS){
    const ws = ['a', 'b'].map(s => a && a[d.id + s]).filter(w => w !== undefined && w !== null);
    if (!ws.length){ uit[d.id] = { stand: null, n: 0 }; continue; }
    uit[d.id] = { stand: ws.reduce((s, w) => s + (PUNT[w] || 0), 0), n: ws.filter(w => w === 'A' || w === 'B').length };
  }
  return uit;
}
export function statusVan(stand){
  if (stand === null || stand === undefined) return 'open';
  const m = Math.abs(stand);
  return m >= 1.5 ? 'duidelijk' : m >= 0.5 ? 'neigt' : 'open';
}

/* ---------- club-uitkomst: meerdere invullers ---------- */
/* Verschil van mening bij een onderdeel: de invullers liggen drie of meer stappen uiteen, of kiezen tegengesteld (A tegenover B). */
export function verschilVan(standen){
  const echt = standen.filter(s => s !== null && s !== undefined);
  if (echt.length < 2) return false;
  const max = Math.max(...echt), min = Math.min(...echt);
  return (max - min >= 3) || (max > 0 && min < 0 && max - min >= 2);
}
const mediaan = lijst => { const s = [...lijst].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };

/* invullers = lijst met antwoordobjecten (max MAX_INVULLERS, de eersten tellen). */
export function clubUitkomst(invullers, modus = 'volledig'){
  const lijst = (invullers || []).slice(0, MAX_INVULLERS).map(schoonAntwoorden);
  const n = lijst.length;
  const perDim = {};
  const verschil = [];
  for (const d of DIMS){
    const standen = lijst.map(a => standenVan(a)[d.id].stand);
    const gedaan = standen.filter(s => s !== null);
    const gem = gedaan.length ? Math.round(gedaan.reduce((s, x) => s + x, 0) / gedaan.length * 10) / 10 : null;
    const heeftVerschil = verschilVan(standen);
    if (heeftVerschil) verschil.push(d.id);
    perDim[d.id] = { stand: gem, status: statusVan(gem), invullers: gedaan.length, verschil: heeftVerschil };
  }
  /* gewichten: de drie onderdelen die de meeste invullers kozen krijgen 2, de rest 1 */
  const telT = Object.fromEntries(DIM_IDS.map(id => [id, 0]));
  for (const a of lijst) for (const id of a.t3 || []) if (telT[id] !== undefined) telT[id]++;
  const top = DIM_IDS.filter(id => telT[id] > 0).sort((x, y) => telT[y] - telT[x] || DIM_IDS.indexOf(x) - DIM_IDS.indexOf(y)).slice(0, 3);
  const gewichten = Object.fromEntries(DIM_IDS.map(id => [id, top.includes(id) ? 2 : 1]));
  /* leeftijdsfasen: de middelste waarde (bij twee de lagere, dus eerder) van wie antwoordde */
  const fasen = {};
  for (const f of FASEN){
    const w = lijst.map(a => a[f.id]).filter(x => x !== undefined);
    fasen[f.id] = w.length ? mediaan(w) : null;
  }
  /* "dit willen wij niet": wat de helft of meer van de invullers koos */
  const telN = {};
  for (const a of lijst) for (const id of a.nee || []) telN[id] = (telN[id] || 0) + 1;
  const willenNiet = NEE_OPTIES.map(o => o[0]).filter(id => (telN[id] || 0) >= Math.ceil(n / 2) && telN[id] > 0);
  /* kruiscontrole: welke herkenningsstijl kozen ze, welke volgt uit de standen */
  const hk = {}; for (const a of lijst) if (a.hk) hk[a.hk] = (hk[a.hk] || 0) + 1;
  const gekozen = Object.keys(hk).sort((x, y) => hk[y] - hk[x])[0] || null;
  const herkenning = herkenStijl(Object.fromEntries(DIM_IDS.map(id => [id, perDim[id].stand])));
  return {
    versie: VERSIE, modus, invullers: n, perDim, gewichten, fasen, willenNiet, verschil,
    herkenning, gekozenStijl: gekozen, kruisverschil: !!(gekozen && herkenning && herkenning.sleutel !== gekozen),
    doel: topKeuze(lijst, 'w1', 2), opleiding: topKeuze(lijst, 'w2', 1)[0] || null,
    zin: samenvattingZin(perDim, gewichten),
  };
}
function topKeuze(lijst, id, max){
  const tel = {};
  for (const a of lijst){ const w = a[id]; for (const x of (Array.isArray(w) ? w : w ? [w] : [])) tel[x] = (tel[x] || 0) + 1; }
  return Object.keys(tel).sort((x, y) => tel[y] - tel[x]).slice(0, max);
}

/* Welke herkenningsstijl lijkt het meest op de standen? Alleen onderdelen met een stand tellen mee. */
export function herkenStijl(standen){
  const ids = DIM_IDS.filter(id => standen[id] !== null && standen[id] !== undefined);
  if (ids.length < 3) return null;
  let beste = null;
  for (const [sleutel, r] of Object.entries(REFS)){
    const afstand = ids.reduce((s, id) => s + Math.abs(standen[id] - r.st[id]), 0) / ids.length;
    const pct = Math.max(0, Math.round((1 - afstand / 4) * 100));
    if (!beste || pct > beste.pct) beste = { sleutel, pct };
  }
  return beste;
}

/* Eén zin met de duidelijkste kanten, bijvoorbeeld "Rustig opbouwen vanaf de keeper, geduldig rondspelen en direct terugpakken." */
export function samenvattingZin(perDim, gewichten = {}){
  const kandidaten = DIMS.map(d => ({ d, s: perDim[d.id]?.stand ?? 0 }))
    .filter(x => Math.abs(x.s) >= 0.5)
    .sort((x, y) => (Math.abs(y.s) * (gewichten[y.d.id] || 1)) - (Math.abs(x.s) * (gewichten[x.d.id] || 1)) || DIM_IDS.indexOf(x.d.id) - DIM_IDS.indexOf(y.d.id))
    .slice(0, 4);
  if (!kandidaten.length) return '';
  const delen = kandidaten.map(x => (x.s > 0 ? x.d.A : x.d.B).toLowerCase());
  const tekst = delen.length === 1 ? delen[0] : delen.slice(0, -1).join(', ') + ' en ' + delen[delen.length - 1];
  return tekst.charAt(0).toUpperCase() + tekst.slice(1) + '.';
}

/* Het document dat de clubadmin vastlegt: clubs/{clubId}/speelstijl/huidig. Alleen de uitkomst, geen antwoorden per persoon. */
export function huidigDoc(uitkomst, uid, nu = Date.now()){
  const u = uitkomst;
  return {
    versie: VERSIE, modus: u.modus, invullers: u.invullers,
    standen: Object.fromEntries(DIM_IDS.map(id => [id, { stand: u.perDim[id].stand, status: u.perDim[id].status }])),
    gewichten: u.gewichten, fasen: Object.fromEntries(Object.entries(u.fasen).filter(([, v]) => v !== null)),
    willenNiet: u.willenNiet, verschil: u.verschil, herkenning: u.herkenning || null,
    zin: u.zin, doel: u.doel, opleiding: u.opleiding,
    vastgelegdDoor: uid || null, vastgelegdMs: nu,
  };
}

/* Gespreksvraag bij een verschil van mening. */
export function gespreksvraag(dimId){
  const d = DIMS.find(x => x.id === dimId); if (!d) return '';
  return `Bij "${d.n}" liggen jullie uiteen: ${d.A.toLowerCase()} of ${d.B.toLowerCase()}? Wat willen we op onze jongste teams zeker anders doen dan op de oudste?`;
}
export const leeftijdTekst = l => (l === 99 ? 'nooit bij de jeugd' : `vanaf O${l}`);
