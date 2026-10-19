/* ==================== SPEELSTIJL → PLANNER (zonder DOM en zonder Firestore) ====================
   [20261019g] Vertaalt de vastgelegde speelstijl van de club (clubs/{id}/speelstijl/huidig, zie speelstijl-logica.js)
   naar een lichte voorkeur in de trainingsplanner:
     - score:  een vorm met tag d3A (hoog druk zetten) krijgt een plus als de club "duidelijk" of "neigt" naar A,
               en een halve min als de club naar B neigt. Gewicht 2 voor de drie onderdelen die de club het belangrijkst vindt.
               De bijdrage is begrensd (±6) en kan het thema (+10) nooit overstemmen.
     - poorten: tags die bij een latere leeftijd horen (hoog druk, omschakelen na balverlies, keeper in de opbouw,
               vaste posities) verschijnen pas vanaf de leeftijd die de club koos; "nooit" sluit ze uit.
     - uitsluiten: wat de club niet wil zien (lange bal bij jonge kinderen, vaste posities onder de 10, tijd rekken).
   Open onderdelen (stand 0 of onbekend) doen niets. Zonder speelstijl is het gedrag exact zoals vroeger.
   De validator (veiligheid, groepsgrootte, ruimte) en de praktische context (materiaal, veld) hebben voorrang.
   Zonder imports: planner en tests gebruiken dit los van elkaar. */

export const MAX_BIJDRAGE = 6;
const DIMS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'];
/* tag → leeftijdsfase-vraag uit de lijst (speelstijl-logica FASEN) */
const POORT = { d3A: 'l2', d4A: 'l2', d1A: 'l3', d5B: 'l1' };

/* Zet het opgeslagen document om in wat de planner nodig heeft. Geeft null als er niets te sturen valt. Idempotent. */
export function voorbereidStijl(doc){
  if (!doc || typeof doc !== 'object') return null;
  if (doc.klaar) return doc;
  const stand = {}, gewicht = {};
  let sturend = false;
  for (const d of DIMS){
    const s = Number(doc.standen?.[d]?.stand);
    stand[d] = Number.isFinite(s) ? Math.max(-2, Math.min(2, s)) : null;
    gewicht[d] = Number(doc.gewichten?.[d]) === 2 ? 2 : 1;
    if (stand[d] !== null && Math.abs(stand[d]) >= 0.5) sturend = true;
  }
  const fasen = {};
  for (const k of ['l1', 'l2', 'l3', 'l4', 'l5']){ const v = Number(doc.fasen?.[k]); if (Number.isFinite(v)) fasen[k] = v; }
  const niet = Array.isArray(doc.willenNiet) ? doc.willenNiet.filter(x => typeof x === 'string') : [];
  if (!sturend && !Object.keys(fasen).length && !niet.length) return null;
  return { klaar: true, stand, gewicht, fasen, niet, sturend };
}

/* Bijdrage aan de score van een vorm (positief = past bij de stijl). */
export function stijlScore(v, st){
  if (!st || !st.sturend) return 0;
  let som = 0;
  for (const tag of v.p || []){
    const d = tag.slice(0, 2), kant = tag[2];
    if ((kant !== 'A' && kant !== 'B') || st.stand[d] === undefined || st.stand[d] === null) continue;
    const s = st.stand[d]; if (Math.abs(s) < 0.5) continue;
    const w = Math.abs(s) * (st.gewicht[d] || 1);
    som += ((kant === 'A') === (s > 0)) ? w : -0.5 * w;
  }
  return Math.max(-MAX_BIJDRAGE, Math.min(MAX_BIJDRAGE, som));
}

/* Valt deze vorm af door leeftijdspoorten of "dit willen wij niet"? */
export function stijlUitgesloten(v, st, leeftijd){
  if (!st) return false;
  const tags = v.p || [];
  for (const tag of tags){
    const k = POORT[tag];
    if (k && st.fasen[k] !== undefined && (st.fasen[k] === 99 || leeftijd < st.fasen[k])) return true;
  }
  if (st.niet.includes('lang') && tags.includes('xlang') && leeftijd < 12) return true;
  if (st.niet.includes('pos') && (tags.includes('xpos') || tags.includes('d5B')) && leeftijd < 10) return true;
  if (st.niet.includes('tijd') && tags.includes('xtijd')) return true;
  return false;
}

/* Melding bij het plan, of null als de stijl niets stuurt. */
export function stijlMelding(st){
  if (!st) return null;
  return 'De speelstijl van de club is meegenomen: vormen die erbij passen krijgen voorrang, het thema blijft leidend. Dit is een lichte voorkeur, geen verplichting.';
}
