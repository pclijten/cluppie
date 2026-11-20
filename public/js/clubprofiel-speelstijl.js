/* ==================== CLUBPROFIEL: DE SPEELWIJZE VIA DE VRAGENLIJST (logica, zonder DOM en Firestore) ====================
   [20261120j] De speelwijze van een club komt in Cluppie uit een vaste vragenlijst (speelstijl-logica.js: kort 8 vragen,
   volledig 26). In het Clubprofiel beantwoordt de AI bij elk ingelezen document alvast de vragen van de VOLLEDIGE
   lijst waarop het document een duidelijk antwoord geeft (functie vulSpeelstijlIn). De eindbaas kiest de korte of de
   volledige lijst, vult aan of past aan, en legt de speelwijze vast (functie zetSpeelstijlPlatform).

   Datamodel (clubprofielen/{clubId}.speelstijl):
     modus:      'volledig' | 'kort'
     hand:       { <vraag>: waarde }          antwoorden van de eindbaas (gaan altijd voor; '?' = weten we nog niet)
     kandidaten: { <vraag>: [{ waarde, citaat, citaatOk, pagina, zeker, docId, bron, ms }] }   uit de documenten
     vastgelegd: { ms, modus, zin } | null

   Puur: alleen speelstijl-logica.js (ook puur). Getest in tests/clubprofiel.test.mjs. */
import { VRAGEN, KORT, DIMS, FASEN, LEEFTIJDEN, DEELN, REFS, vragenVoor, schoonAntwoord, clubUitkomst, huidigDoc, leeftijdTekst } from './speelstijl-logica.js?v=20261019e';

const DIM = Object.fromEntries(DIMS.map(d => [d.id, d]));
const FASE = Object.fromEntries(FASEN.map(f => [f.id, f]));
export const vraagOpId = id => VRAGEN.find(q => q.id === id) || null;
export const leegSpeelstijl = () => ({ modus: 'volledig', hand: {}, kandidaten: {}, vastgelegd: null });
export const schoonSp = sp => ({ ...leegSpeelstijl(), ...(sp && typeof sp === 'object' ? sp : {}), hand: { ...((sp && sp.hand) || {}) }, kandidaten: { ...((sp && sp.kandidaten) || {}) } });

/* Het onderwerp van een vraag, voor de AI en het scherm: "Opbouw", "Vanaf welke leeftijd: vaste positie". */
export function onderwerpVan(q){
  if (q.k === 'ab') return DIM[q.dim] ? DIM[q.dim].n : '';
  if (q.k === 'age') return FASE[q.id] ? FASE[q.id].n : '';
  return DEELN[q.deel] || '';
}
/* Wat de functie vulSpeelstijlIn nodig heeft: alle vragen van de volledige lijst. */
export function vragenVoorAI(){
  return VRAGEN.map(q => ({ id: q.id, k: q.k, q: q.q, onderwerp: onderwerpVan(q), A: q.A || '', B: q.B || '', max: q.max || 1, opties: (q.o || []).map(o => [o[0], o[1]]) }));
}

/* ---------- antwoorden uit een document ---------- */
const ZEKER = { hoog: 3, middel: 2, laag: 1 };
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* Nieuwe antwoorden van één document bij de kandidaten zetten; wat dit document eerder gaf vervalt (opnieuw inlezen). */
export function kandidatenSamenvoegen(kandidaten, antwoorden, doc, nuMs = Date.now()){
  const uit = {};
  for (const [id, lijst] of Object.entries(kandidaten || {})){
    const rest = (Array.isArray(lijst) ? lijst : []).filter(k => k && k.docId !== doc.id);
    if (rest.length) uit[id] = rest;
  }
  for (const a of (Array.isArray(antwoorden) ? antwoorden : [])){
    const w = schoonAntwoord(a && a.vraag, a && (vraagOpId(a.vraag)?.k === 'multi' ? a.waarde : Array.isArray(a.waarde) ? a.waarde[0] : a.waarde));
    if (w === undefined || w === '?') continue;
    (uit[a.vraag] ||= []).push({ waarde: w, citaat: String(a.citaat || '').slice(0, 400), citaatOk: a.citaatOk !== false, pagina: Number(a.pagina) > 0 ? Number(a.pagina) : null,
      zeker: ZEKER[a.zeker] ? a.zeker : 'middel', docId: doc.id, bron: String(doc.naam || '').slice(0, 120), ms: nuMs });
  }
  return uit;
}
/* Kandidaten van een document weghalen (document verwijderd). */
export function zonderDocument(kandidaten, docId){ return kandidatenSamenvoegen(kandidaten, [], { id: docId }); }

/* ---------- de keuze per vraag ---------- */
/* { waarde, door: 'hand'|'document'|null, bron (de beste kandidaat), kandidaten (verschillende antwoorden), tegenstrijdig } */
export function keuzeVan(sp, id){
  const hand = sp && sp.hand ? sp.hand[id] : undefined;
  const lijst = ((sp && sp.kandidaten && sp.kandidaten[id]) || []).slice()
    .sort((a, b) => (ZEKER[b.zeker] || 0) - (ZEKER[a.zeker] || 0) || (b.citaatOk === true) - (a.citaatOk === true) || (a.ms || 0) - (b.ms || 0));
  const verschillend = lijst.filter((k, i) => lijst.findIndex(x => gelijk(x.waarde, k.waarde)) === i);
  if (hand !== undefined && hand !== null) return { waarde: hand, door: 'hand', bron: null, kandidaten: verschillend, tegenstrijdig: false };
  if (!lijst.length) return { waarde: undefined, door: null, bron: null, kandidaten: [], tegenstrijdig: false };
  return { waarde: lijst[0].waarde, door: 'document', bron: lijst[0], kandidaten: verschillend, tegenstrijdig: verschillend.length > 1 };
}
/* Alle antwoorden voor de gekozen lijst. Bij de korte lijst telt een antwoord op de tweede vraag van hetzelfde
   onderdeel (d1b) mee als er geen antwoord op de eerste is (zelfde onderdeel, zelfde kanten A en B). */
export function antwoordenVan(sp, modus = (sp && sp.modus) || 'volledig'){
  const uit = {};
  for (const q of vragenVoor(modus)){
    let w = keuzeVan(sp, q.id).waarde;
    if ((w === undefined || w === '?') && modus === 'kort' && q.k === 'ab'){ const b = keuzeVan(sp, q.dim + 'b').waarde; if (b === 'A' || b === 'B') w = b; }
    if (w !== undefined) uit[q.id] = w;
  }
  return uit;
}
/* De manco's van de vragenlijst: onbeantwoord, "weten we nog niet" of tegenstrijdig tussen documenten. */
export function speelstijlManco(sp, modus = (sp && sp.modus) || 'volledig'){
  const antw = antwoordenVan(sp, modus), uit = [];
  for (const q of vragenVoor(modus)){
    const k = keuzeVan(sp, q.id), w = antw[q.id];
    const leeg = w === undefined || w === '?' || (Array.isArray(w) && !w.length);
    if (leeg) uit.push({ vraag: q.id, soort: w === '?' ? 'onbekend' : 'leeg', onderwerp: onderwerpVan(q), tekst: q.q });
    else if (k.door === 'document' && k.tegenstrijdig) uit.push({ vraag: q.id, soort: 'meerdere', onderwerp: onderwerpVan(q), tekst: q.q });
  }
  return uit;
}
export function telling(sp, modus = (sp && sp.modus) || 'volledig'){
  const vr = vragenVoor(modus), antw = antwoordenVan(sp, modus);
  const ingevuld = vr.filter(q => { const w = antw[q.id]; return w !== undefined && w !== '?' && !(Array.isArray(w) && !w.length); }).length;
  const uitDoc = vr.filter(q => keuzeVan(sp, q.id).door === 'document').length;
  return { totaal: vr.length, ingevuld, uitDoc, manco: speelstijlManco(sp, modus).length };
}
/* De uitkomst en het document voor clubs/{id}/speelstijl/huidig (zoals de app het vastlegt), of null zonder keuzes. */
export function uitkomstVan(sp, modus = (sp && sp.modus) || 'volledig'){
  const antw = antwoordenVan(sp, modus);
  if (!DIMS.some(d => ['A', 'B'].includes(antw[d.id + 'a']) || ['A', 'B'].includes(antw[d.id + 'b']))) return null;
  const u = clubUitkomst([antw], modus);
  return { uitkomst: u, doc: huidigDoc(u, null) };
}

/* ---------- tekst ---------- */
/* Een antwoord leesbaar maken: "A: Rustig opbouwen vanaf de keeper", "vanaf O10", "Plezier en blijven voetballen". */
export function antwoordTekst(q, w){
  if (w === undefined || w === null) return '';
  if (q.k === 'ab') return w === 'A' ? q.A : w === 'B' ? q.B : 'Weten we nog niet';
  if (q.k === 'age') return leeftijdTekst(Number(w));
  const naam = id => ((q.o || []).find(o => o[0] === id) || [])[1] || id;
  return Array.isArray(w) ? w.map(naam).join(', ') : naam(w);
}
/* De open vragen als tekst, voor "Vragen voor de club". */
export function speelstijlVragenTekst(sp){
  const lijst = speelstijlManco(sp);
  if (!lijst.length) return '';
  return ['', 'Speelwijze (vragenlijst)', ...lijst.map((m, i) => `${i + 1}. ${m.onderwerp ? m.onderwerp + ': ' : ''}${m.tekst}${m.soort === 'meerdere' ? ' (in de documenten staan verschillende antwoorden)' : ''}`)].join('\n') + '\n';
}
/* De speelwijze per onderdeel, voor de PDF en het scherm: [{ onderdeel, kant, tekst }] */
export function speelwijzeRegels(sp, modus){
  const u = uitkomstVan(sp, modus);
  if (!u) return [];
  return DIMS.map(d => { const s = u.uitkomst.perDim[d.id].stand; return { onderdeel: d.n, kant: s === null ? null : s > 0 ? 'A' : s < 0 ? 'B' : null, tekst: s === null || s === 0 ? 'nog open' : s > 0 ? d.A : d.B, status: u.uitkomst.perDim[d.id].status }; });
}
export { VRAGEN, KORT, DEELN, LEEFTIJDEN, REFS, DIMS, vragenVoor };
