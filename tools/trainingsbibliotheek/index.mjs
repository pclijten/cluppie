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
import { VERRIJKING } from './verrijking.mjs';

/* Eerste 48 vormen krijgen soort, uitleg, varianten en let-op-punten uit verrijking.mjs. */
function verrijk(v){
  const r = VERRIJKING[v.id];
  if (!r) return v;
  const uit = { ...v, coachvragen: r.vraag2 ? [...v.coachvragen, r.vraag2] : v.coachvragen, soort: r.soort, uitleg: r.uitleg, varianten: r.var.map(([naam, uitleg]) => ({ naam, uitleg })), letOp: r.letOp };
  if (r.lft) uit.leeftijd = r.lft;
  return uit;
}
const NIEUW = [DEEL_D, DEEL_E, DEEL_F, DEEL_G, DEEL_H, DEEL_I, DEEL_J, DEEL_K, DEEL_M, DEEL_N, DEEL_O, DEEL_P];
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
export const VORMEN = [...OUD, ...NIEUW.flat()].map(v => ({ ...v, tijd: tijdVan(v) }));

/* Themaregels voor de partijspelen (één eenvoudige regel per leercurve-thema). */
export const THEMAREGELS = {
  ...THEMAREGELS_BASIS,
  'Omschakelen balwinst': 'Verover je de bal en speel je hem binnen 5 seconden diep of naar de vrije speler, dan telt een doelpunt dubbel.',
  'Omschakelen balverlies': 'Verlies je de bal en win je hem binnen 5 seconden terug, dan krijg je een punt; na 5 seconden valt het team terug.',
};

export const BIBLIOTHEEK = {
  versie: '2026.11.14-zeven-velden',
  taal: 'nl',
  licentie: 'Eigen werk (Cluppie). Referentiekader: KNVB-spelregels en -principes. Geen KNVB-tekst of -afbeeldingen overgenomen.',
  themaregels: THEMAREGELS,
  vormen: VORMEN,
};
