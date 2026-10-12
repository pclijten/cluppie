/* Hulpfuncties voor het opschrijven van trainingsvormen.
   Tekening-coördinaten: % van het speelvak (x: 0 links … 100 rechts, y: 0 boven … 100 onder),
   hetzelfde systeem als leerinhoud.js / het tactiekbord. De echte afmetingen staan in `veld` (meters). */

/* speler: kant ontbreekt = eigen team (rood), 'tegen' = tegenstander (blauw),
   'joker' = neutrale/steunspeler (amber), 'keeper' = keeper (amber, K) */
export const P = (nr, x, y, kant) => (kant ? { nr, x, y, kant } : { nr, x, y });
export const loop  = (...punten) => ({ soort: 'loopweg', punten });
export const pass  = (...punten) => ({ soort: 'pass', punten });
export const drib  = (...punten) => ({ soort: 'dribbel', punten });
export const schot = (...punten) => ({ soort: 'schot', punten });

export const doel   = (x, y, breed, kant) => ({ x, y, breed, kant });
export const zone   = (x, y, b, h, label = '') => ({ x, y, b, h, label });
export const pion   = (x, y, kleur) => (kleur ? [x, y, kleur] : [x, y]);

/* Ruimte per speler in m² (voor de validator). */
export const ruimtePerSpeler = (v) => (v.veld.b * v.veld.l) / v.spelers.ideaal;
