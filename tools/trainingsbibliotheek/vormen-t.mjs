/* Deel T — techniek, bewegingen met een naam, afwerken en spelvormen (november 2026). Eigen werk.
   De oefeningen staan per groep in deel-t/*.mjs. Elke oefening staat daar in één blok: de vorm zelf
   (zoals in de andere delen) én de uitwerking (spelverloop op spelernummer, kijkwijzer, kijk en grijp in,
   telling, regie en onderbouwing). Hier wordt dat gesplitst in DEEL_T (de vormen) en UIT_T (de uitwerking).
   De namen van bekende voetballers staan er alleen bij als gangbare naam van een beweging. */
import { vorm } from './hulp.mjs';
import { BEWEGINGEN } from './deel-t/bewegingen.mjs';
import { TECHNIEK } from './deel-t/techniek.mjs';
import { AFWERKEN } from './deel-t/afwerken.mjs';
import { SPELVORMEN } from './deel-t/spelvormen.mjs';

const ALLES = [...BEWEGINGEN, ...TECHNIEK, ...AFWERKEN, ...SPELVORMEN];
const UIT = ['v', 'lukt', 'alsDan', 'meet', 'regie', 'inz'];
export const DEEL_T = ALLES.map(o => vorm({ ...o, principes: o.pr || [] }));
export const UIT_T = Object.fromEntries(ALLES.map(o => [o.id, { ...Object.fromEntries(UIT.map(k => [k, o[k]])), pr: o.pr || [], ...(o.teken ? { tek: o.teken } : {}) }]));
