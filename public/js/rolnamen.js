/* ==================== ROLNAMEN VAN DE CLUB ====================
   [20261120c] Een club noemt haar functies vaak anders dan Cluppie: "TC-lid" in plaats van
   bouwcoördinator, "trainer" in plaats van coach. De eigen namen staan in het clubdocument:
     clubs/{id}.instellingen.rolNamen     { coach, coordinator, trainco }
     clubs/{id}.instellingen.jeugdRolNaam (bestond al: de naam van het hoofd jeugdopleiding)
   Ze worden nu gezet vanuit het Clubprofiel van de eindbaas (platform-clubprofiel.js).

   Gebruikt op de plekken waar de rol als LABEL staat (rolregel, tegel, kaartkop). Lopende tekst
   en de handleiding houden de woorden van Cluppie: een eigen naam past daar niet altijd in de zin.

   Zonder imports: elk scherm geeft zelf het clubdocument mee, en de test draait los. */
export const ROLLEN = [
  ['coach', 'Coach', 'Wie een team traint en begeleidt'],
  ['coordinator', 'Bouwcoördinator', 'Wie de teams van één bouw of leeftijdsgroep aanstuurt'],
  ['trainco', 'Trainingscoördinator', 'Wie de trainingen en de weekplanning van alle teams overziet'],
  ['hoofdJeugd', 'Hoofd jeugdopleiding', 'Wie eindverantwoordelijk is voor de jeugdopleiding'],
];
const STANDAARD = Object.fromEntries(ROLLEN.map(([id, naam]) => [id, naam]));
export const ROLNAAM_MAX = 40;

/* De naam die de club zelf heeft vastgelegd, of '' als ze de naam van Cluppie gebruikt. */
export function eigenRolNaam(sleutel, club){
  const i = (club && club.instellingen) || {};
  const w = sleutel === 'hoofdJeugd' ? i.jeugdRolNaam : (i.rolNamen || {})[sleutel];
  return typeof w === 'string' ? w.replace(/\s+/g, ' ').trim().slice(0, ROLNAAM_MAX) : '';
}
/* De naam om te tonen. `standaard` is het woord dat op die plek stond (bijv. het korte "Coördinator"). */
export function rolNaam(sleutel, club, standaard){
  return eigenRolNaam(sleutel, club) || standaard || STANDAARD[sleutel] || '';
}
