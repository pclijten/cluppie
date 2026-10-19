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
import { VERRIJKING } from './verrijking.mjs';

/* Eerste 48 vormen krijgen soort, uitleg, varianten en let-op-punten uit verrijking.mjs. */
function verrijk(v){
  const r = VERRIJKING[v.id];
  if (!r) return v;
  const uit = { ...v, coachvragen: r.vraag2 ? [...v.coachvragen, r.vraag2] : v.coachvragen, soort: r.soort, uitleg: r.uitleg, varianten: r.var.map(([naam, uitleg]) => ({ naam, uitleg })), letOp: r.letOp };
  if (r.lft) uit.leeftijd = r.lft;
  return uit;
}
const NIEUW = [DEEL_D, DEEL_E, DEEL_F, DEEL_G, DEEL_H, DEEL_I, DEEL_J];
const OUD = [...DEEL_A, ...DEEL_B, ...DEEL_C].map(verrijk);
export const VORMEN = [...OUD, ...NIEUW.flat()];

/* Themaregels voor de partijspelen (één eenvoudige regel per leercurve-thema). */
export const THEMAREGELS = {
  ...THEMAREGELS_BASIS,
  'Omschakelen balwinst': 'Verover je de bal en speel je hem binnen 5 seconden diep of naar de vrije speler, dan telt een doelpunt dubbel.',
  'Omschakelen balverlies': 'Verlies je de bal en win je hem binnen 5 seconden terug, dan krijg je een punt; na 5 seconden valt het team terug.',
};

export const BIBLIOTHEEK = {
  versie: '2026.10.19-keeper',
  taal: 'nl',
  licentie: 'Eigen werk (Cluppie). Referentiekader: KNVB-spelregels en -principes. Geen KNVB-tekst of -afbeeldingen overgenomen.',
  themaregels: THEMAREGELS,
  vormen: VORMEN,
};
