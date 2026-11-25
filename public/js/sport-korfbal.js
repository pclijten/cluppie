/* ==================== SPORTPROFIEL: KORFBAL ====================
   [20261126c] Korfbal volgens de KNKV. Gemengde teams (geen aparte meidencategorieën), geen keeper.
   Senioren en jeugd vanaf O12: 8-tal (4 dames en 4 heren, 2 in de aanval en 2 in de verdediging per
   geslacht), 2×25 min op een veld van 40×20 m. Jongste jeugd: 4Korfbal (4-tal), 4×10 min. De exacte
   leeftijdsgrenzen en speeltijden van de jeugd zijn met de pilotclub te controleren (aan te passen onder
   Instellingen). Eigen oefenstof en plannen ontbreken nog (inhoud: false). Pure data, zonder imports. */
const vries = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)){ Object.freeze(o); Object.values(o).forEach(vries); } return o; };

export const KORFBAL = vries({
  id: 'korfbal',
  naam: 'Korfbal',
  icoon: 'football-pitch',
  open: false,
  inhoud: false,
  ledenbron: 'sportlink',
  veld: {
    lengte: 40, breedte: 20,
    /* middenlijn tussen de twee vakken; de korven staan op 1/6 van de lengte en tekenen we nog niet */
    bord: { dwars: [50], cirkel: 0, vakken: [] },
    kaart: { cirkel: 0 },
  },
  wedstrijd: {
    zonderKeeper: ['4', '8'],
    periodeNaam: { 2: 'Helft', 4: 'Kwart' }, periodeKort: { 2: 'H', 4: 'K' },
    kaarten: [
      { type: 'geel', naam: 'gele kaart', knop: 'Geel' },
      { type: 'rood', naam: 'rode kaart', knop: 'Rood', eruit: true },
    ],
    tweedeGeelRood: true,
    kaartUitleg: 'een gele kaart is een waarschuwing; een tweede gele kaart is rood. Bij rood moet de speler eruit en mag een wissel zijn plaats innemen.',
  },
  woorden: { bond: 'KNKV', ledenbron: 'Sportlink', keeper: 'keeper', elftal: 'achttal', buitenspel: 'buitenspel' },
  tijdstraf: { pupilSec: 0, jeugdSec: 0, jeugdVanaf: 99 },
  bouwGrenzen: { onderTm: 10, middenTm: 14 },
  categorieen: {
    'JO8':  { format: '4', periodes: 4, duur: 10, knvb: '4Korfbal: 4 tegen 4, 4×10 min' },
    'JO10': { format: '4', periodes: 4, duur: 10, knvb: '4Korfbal: 4 tegen 4, 4×10 min' },
    'JO12': { format: '8', periodes: 2, duur: 20, knvb: '8 tegen 8 (4 dames, 4 heren), 2×20 min' },
    'JO14': { format: '8', periodes: 2, duur: 25, knvb: '8 tegen 8 (4 dames, 4 heren), 2×25 min' },
    'JO16': { format: '8', periodes: 2, duur: 25, knvb: '8 tegen 8 (4 dames, 4 heren), 2×25 min' },
    'JO19': { format: '8', periodes: 2, duur: 25, knvb: '8 tegen 8 (4 dames, 4 heren), 2×25 min' },
    'Senioren': { format: '8', periodes: 2, duur: 25, knvb: '8 tegen 8 (4 dames, 4 heren), 2×25 min' },
  },
  categorieenMeiden: {},
  /* V = verdedigingsvak, A = aanvalsvak; geen keeper */
  formaties: {
    '4': {
      '2-2': [[32, 72, 'V'], [68, 72, 'V'], [32, 28, 'A'], [68, 28, 'A']],
    },
    '8': {
      '4-4': [[20, 70, 'V'], [40, 80, 'V'], [60, 80, 'V'], [80, 70, 'V'], [20, 30, 'A'], [40, 20, 'A'], [60, 20, 'A'], [80, 30, 'A']],
    },
  },
  lijnNaam: { K: 'Keeper', V: 'Verdediging', M: 'Midden', A: 'Aanval' },
  zoneNaam: {
    V: { links: 'Verdediger links', midden: 'Verdediger', rechts: 'Verdediger rechts' },
    M: { links: 'Links', midden: 'Midden', rechts: 'Rechts' },
    A: { links: 'Aanvaller links', midden: 'Aanvaller', rechts: 'Aanvaller rechts' },
  },
  positieGroepen: [
    { lijn: 'A', naam: 'Aanval', posities: ['Aanvaller links', 'Aanvaller', 'Aanvaller rechts'] },
    { lijn: 'V', naam: 'Verdediging', posities: ['Verdediger links', 'Verdediger', 'Verdediger rechts'] },
  ],
  kalenderSeizoen: "2026/'27",
  kalender: { pup: [], jun: [], sen: [], mei: [] },
  leercurve: [
    { thema: 'Teamsport en plezier', vanaf: 6, domein: 'GE' },
    { thema: 'Gooien en vangen', vanaf: 6, domein: 'TE' },
    { thema: 'Doorloopbal', vanaf: 7, domein: 'TE' },
    { thema: 'Afstandsschot', vanaf: 8, domein: 'TE' },
    { thema: 'Vrijlopen en loskomen', vanaf: 8, domein: 'TA' },
    { thema: 'Verdedigen: dekken en hand voor', vanaf: 9, domein: 'TE' },
    { thema: 'Rebound', vanaf: 10, domein: 'TE' },
    { thema: 'Aanvalsopzet en balcirculatie', vanaf: 10, domein: 'TA' },
    { thema: 'Strafworp en vrije bal', vanaf: 10, domein: 'TE' },
    { thema: 'Samenwerken in de verdediging', vanaf: 11, domein: 'TA' },
    { thema: 'Omschakelen tussen aanval en verdediging', vanaf: 12, domein: 'TA' },
  ],
  formatie11: '',
  doelSuggesties: [
    { tot: 9, teksten: ['Iedereen minstens 1x een schot op de korf', 'Bal vangen met twee handen', 'Na een doelpunt samen juichen', 'Na een pass meteen weglopen'] },
    { tot: 12, teksten: ['Vrijlopen voordat je de bal vraagt', 'Iedereen in de aanval schiet een keer', 'Verdedigen met de hand voor', 'Na een schot naar de rebound'] },
    { tot: 15, teksten: ['Balcirculatie: de bal rondspelen tot er een kans is', 'Doorloopballen uit een bewuste actie', 'Samen verdedigen: helpen bij de doorloopbal', 'Rebound bezetten bij elk schot'] },
    { tot: 99, teksten: ['Scorende kans afmaken uit de aanvalsopzet', 'Verdedigend afstoppen op de vrije man', 'Rustig blijven bij een strafworp', 'Communiceren bij omschakelen'] },
  ],
});
