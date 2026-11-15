/* Bibliotheek samenstellen: alle vormen + themaregels. */
import { DEEL_A } from './vormen-a.mjs';
import { DEEL_B } from './vormen-b.mjs';
import { DEEL_C, THEMAREGELS as THEMAREGELS_BASIS } from './vormen-c.mjs';
import { DEEL_D } from './vormen-d.mjs';
import { DEEL_E } from './vormen-e.mjs';
import { DEEL_F } from './vormen-f.mjs';
import { DEEL_G } from './vormen-g.mjs';
import { DEEL_H } from './vormen-h.mjs';
import { DEEL_I } from './vormen-i.mjs';
import { DEEL_J } from './vormen-j.mjs';
import { DEEL_K } from './vormen-k.mjs';
import { DEEL_M } from './vormen-m.mjs';
import { DEEL_N } from './vormen-n.mjs';
import { DEEL_O } from './vormen-o.mjs';
import { DEEL_P } from './vormen-p.mjs';
import { DEEL_S } from './vormen-s.mjs';
import { principesVan } from './principes.mjs';
import { VERRIJKING } from './verrijking.mjs';
import { werkUit } from './uitwerking/index.mjs';

/* Eerste 48 vormen krijgen soort, uitleg, varianten en let-op-punten uit verrijking.mjs. */
function verrijk(v){
  const r = VERRIJKING[v.id];
  if (!r) return v;
  const uit = { ...v, coachvragen: r.vraag2 ? [...v.coachvragen, r.vraag2] : v.coachvragen, soort: r.soort, uitleg: r.uitleg, varianten: r.var.map(([naam, uitleg]) => ({ naam, uitleg })), letOp: r.letOp };
  if (r.lft) uit.leeftijd = r.lft;
  return uit;
}
/* [20261115b] Voor de 3D-weergave moet de bal bij een speler liggen. Ligt hij in een tekening los
   in het veld (vaak bij spelers uit ploeg()), dan schuiven bal en het beginpunt van de lijnen naar de dichtstbijzijnde eigen speler. */
const balBijSpeler = (v) => {
  const t = v.tekening; if (!t?.bal || !(t.spelers || []).length) return v;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const eigen = t.spelers.filter(s => !s.kant || s.kant === 'eigen');
  const alle = eigen.length ? eigen : t.spelers;
  if (t.spelers.some(s => d([s.x, s.y], t.bal) < 7)) return v;
  const s = alle.reduce((b, x) => (d([x.x, x.y], t.bal) < d([b.x, b.y], t.bal) ? x : b));
  const oud = t.bal, nieuw = [s.x, s.y];
  const lijnen = (t.lijnen || []).map(l => ({ ...l, punten: l.punten.map(p => (d(p, oud) < 3 ? nieuw : p)) }));
  return { ...v, tekening: { ...t, bal: nieuw, lijnen } };
};
const NIEUW = [DEEL_D, DEEL_E, DEEL_F, DEEL_G, DEEL_H, DEEL_I, DEEL_J, DEEL_K, DEEL_M, DEEL_N, DEEL_O, DEEL_P, DEEL_S];
const OUD = [...DEEL_A, ...DEEL_B, ...DEEL_C].map(verrijk);
/* Tijdbestek: elke vorm heeft een vaste standaardtijd van 5, 10, 15 of 20 minuten (20 alleen met een pauze erin).
   Staat die niet in de bron, dan volgt hij uit de rondes: het midden van de rondes, afgerond op 5 minuten. */
export const TIJDEN = [5, 10, 15, 20];
export function tijdVan(v){
  if (TIJDEN.includes(v.tijd)) return v.tijd;
  const { ronde, rondes: [a, b], rust } = v.duur;
  const r = Math.round((a + b) / 2);
  let t = Math.round((r * ronde + (r - 1) * rust) / 5) * 5;
  const [lo, hi] = { 'warming-up': [5, 15], afsluiting: [5, 5], partijspel: [10, 20] }[v.fase] || [10, 15];
  return Math.max(lo, Math.min(hi, t));
}
/* [20261116h] principes: bij welke principes van de speelwijze hoort de vorm (principes.mjs; leeg = basisvorm). */
/* [20261116i] werkUit: de uitwerking met de hand per oefening (uitwerking/*.mjs): spelverloop, succescriteria,
   kijk-en-grijp-in, telling, regie, onderbouwing en de principes van de speelwijze. */
export const VORMEN = [...OUD, ...NIEUW.flat()].map(balBijSpeler).map(werkUit).map(v => ({ ...v, tijd: tijdVan(v) })).map(v => ({ ...v, principes: principesVan(v) }));

/* Themaregels voor de partijspelen (één eenvoudige regel per leercurve-thema). */
export const THEMAREGELS = {
  ...THEMAREGELS_BASIS,
  'Omschakelen balwinst': 'Verover je de bal en speel je hem binnen 5 seconden diep of naar de vrije speler, dan telt een doelpunt dubbel.',
  'Omschakelen balverlies': 'Verlies je de bal en win je hem binnen 5 seconden terug, dan krijg je een punt; na 5 seconden valt het team terug.',
};

export const BIBLIOTHEEK = {
  versie: '2026.11.16-uitwerking',
  taal: 'nl',
  licentie: 'Eigen werk (Cluppie). Referentiekader: KNVB-spelregels en -principes. Geen KNVB-tekst of -afbeeldingen overgenomen.',
  themaregels: THEMAREGELS,
  vormen: VORMEN,
};
