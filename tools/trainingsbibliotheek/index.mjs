/* Bibliotheek samenstellen: alle vormen + themaregels. */
import { DEEL_A } from './vormen-a.mjs';
import { DEEL_B } from './vormen-b.mjs';
import { DEEL_C, THEMAREGELS } from './vormen-c.mjs';

export const VORMEN = [...DEEL_A, ...DEEL_B, ...DEEL_C];
export { THEMAREGELS };

export const BIBLIOTHEEK = {
  versie: '2026.10.12-startset',
  taal: 'nl',
  licentie: 'Eigen werk (Cluppie). Referentiekader: KNVB-spelregels en -principes. Geen KNVB-tekst of -afbeeldingen overgenomen.',
  themaregels: THEMAREGELS,
  vormen: VORMEN,
};
