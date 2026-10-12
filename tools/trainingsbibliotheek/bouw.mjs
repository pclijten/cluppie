// Bouwt public/js/trainingsbibliotheek.js uit de bronbestanden in deze map (vormen-a/b/c.mjs).
// De bibliotheek is eigen werk van Cluppie; er is geen KNVB-tekst of -afbeelding in overgenomen.
//   node tools/trainingsbibliotheek/bouw.mjs
import fs from 'node:fs';
import { BIBLIOTHEEK } from './index.mjs';
const uit = new URL('../../public/js/trainingsbibliotheek.js', import.meta.url);
const kop = `/* ==================== TRAINGSBIBLIOTHEEK (gegenereerd) ====================
   NIET HANDMATIG WIJZIGEN. Bron: tools/trainingsbibliotheek/vormen-*.mjs.
   Opnieuw bouwen:  node tools/trainingsbibliotheek/bouw.mjs
   Controleren:     node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/trainingsplanner.test.mjs
   Eigen werk van Cluppie, met de KNVB-principes als referentiekader (geen KNVB-tekst of -beeld). */
`.replace('TRAINGS', 'TRAININGS');
fs.writeFileSync(uit, kop + 'export const BIBLIOTHEEK = ' + JSON.stringify(BIBLIOTHEEK) + ';\n');
console.log('trainingsbibliotheek.js geschreven:', BIBLIOTHEEK.vormen.length, 'vormen');
