/* ==================== SPORTPROFIEL: VOLLEYBAL ====================
   [20261126c] Zaalvolleybal volgens de Nevobo. Geen speeltijd maar sets: een wedstrijd heeft vier sets
   (Nevobo-competitie); elke set is hier een periode met een geschatte duur van 20 minuten, zodat de
   speeltijdverdeling blijft werken (per set telt wie er in het veld stond). CMV (tot 12 jaar) speelt
   met 3 of 4 spelers, vanaf de C-jeugd 6 tegen 6. Geen keeper; posities zijn de zes plekken in het
   veld (rotatie). Exacte CMV-niveaus: met de pilotclub invullen. Eigen oefenstof en plannen ontbreken
   nog (inhoud: false). Pure data, zonder imports. */
const vries = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)){ Object.freeze(o); Object.values(o).forEach(vries); } return o; };

export const VOLLEYBAL = vries({
  id: 'volleybal',
  naam: 'Volleybal',
  icoon: 'football-pitch',
  open: false,
  inhoud: false,
  ledenbron: 'sportlink',
  veld: {
    lengte: 18, breedte: 9,
    /* net in het midden, aanvalslijnen op 3 m van het net */
    bord: { dwars: [33.3, 50, 66.7], cirkel: 0, vakken: [] },
    kaart: { cirkel: 0 },
  },
  wedstrijd: {
    zonderKeeper: ['3', '4', '6'],
    periodeNaam: { alle: 'Set' }, periodeKort: { alle: 'S' },
    kaarten: [
      { type: 'geel', naam: 'gele kaart', knop: 'Geel' },
      { type: 'rood', naam: 'rode kaart', knop: 'Rood' },
    ],
    tweedeGeelRood: false,
    kaartUitleg: 'geel is een waarschuwing, rood is een straf (een punt voor de tegenstander). Uitsluiting of diskwalificatie zet je met rood en een notitie.',
  },
  woorden: { bond: 'Nevobo', ledenbron: 'Sportlink', keeper: 'libero', elftal: 'team', buitenspel: 'buitenspel' },
  tijdstraf: { pupilSec: 0, jeugdSec: 0, jeugdVanaf: 99 },
  bouwGrenzen: { onderTm: 12, middenTm: 15 },
  categorieen: {
    'JO10': { format: '3', periodes: 4, duur: 15, knvb: 'CMV: 3 tegen 3, sets' },
    'JO12': { format: '4', periodes: 4, duur: 15, knvb: 'CMV: 4 tegen 4, sets' },
    'JO15': { format: '6', periodes: 4, duur: 20, knvb: 'C-jeugd: 6 tegen 6, 4 sets' },
    'JO17': { format: '6', periodes: 4, duur: 20, knvb: 'B-jeugd: 6 tegen 6, 4 sets' },
    'JO19': { format: '6', periodes: 4, duur: 20, knvb: 'A-jeugd: 6 tegen 6, 4 sets' },
    'Senioren': { format: '6', periodes: 4, duur: 20, knvb: 'Heren: 6 tegen 6, 4 sets' },
  },
  categorieenMeiden: {
    'MO10': { format: '3', periodes: 4, duur: 15, knvb: 'CMV: 3 tegen 3, sets' },
    'MO12': { format: '4', periodes: 4, duur: 15, knvb: 'CMV: 4 tegen 4, sets' },
    'MO15': { format: '6', periodes: 4, duur: 20, knvb: 'C-jeugd: 6 tegen 6, 4 sets' },
    'MO17': { format: '6', periodes: 4, duur: 20, knvb: 'B-jeugd: 6 tegen 6, 4 sets' },
    'MO19': { format: '6', periodes: 4, duur: 20, knvb: 'A-jeugd: 6 tegen 6, 4 sets' },
    'Vrouwen': { format: '6', periodes: 4, duur: 20, knvb: 'Dames: 6 tegen 6, 4 sets' },
  },
  /* V = achterveld, A = voorveld (aan het net); boven in het bord is het net */
  formaties: {
    '3': {
      '1-2': [[50, 72, 'V'], [28, 32, 'A'], [72, 32, 'A']],
    },
    '4': {
      '2-2': [[30, 72, 'V'], [70, 72, 'V'], [30, 32, 'A'], [70, 32, 'A']],
    },
    '6': {
      '3-3': [[20, 74, 'V'], [50, 78, 'V'], [80, 74, 'V'], [20, 30, 'A'], [50, 30, 'A'], [80, 30, 'A']],
    },
  },
  lijnNaam: { K: 'Libero', V: 'Achterveld', M: 'Midden', A: 'Voorveld' },
  zoneNaam: {
    V: { links: 'Linksachter (5)', midden: 'Middenachter (6)', rechts: 'Rechtsachter (1)' },
    M: { links: 'Links', midden: 'Midden', rechts: 'Rechts' },
    A: { links: 'Linksvoor (4)', midden: 'Middenvoor (3)', rechts: 'Rechtsvoor (2)' },
  },
  positieGroepen: [
    { lijn: 'A', naam: 'Spelverdeling en aanval', posities: ['Spelverdeler', 'Diagonaal', 'Middenaanvaller', 'Passer-loper'] },
    { lijn: 'V', naam: 'Verdediging', posities: ['Libero'] },
  ],
  kalenderSeizoen: "2026/'27",
  kalender: { pup: [], jun: [], sen: [], mei: [] },
  leercurve: [
    { thema: 'Teamsport en plezier', vanaf: 6, domein: 'GE' },
    { thema: 'Bovenhands spelen', vanaf: 6, domein: 'TE' },
    { thema: 'Onderhands spelen', vanaf: 7, domein: 'TE' },
    { thema: 'Opslag', vanaf: 8, domein: 'TE' },
    { thema: 'Communicatie en samenspel', vanaf: 8, domein: 'GE' },
    { thema: 'Pass en ontvangst', vanaf: 9, domein: 'TE' },
    { thema: 'Spelverdeling', vanaf: 10, domein: 'TA' },
    { thema: 'Aanval (smash)', vanaf: 11, domein: 'TE' },
    { thema: 'Veldverdediging', vanaf: 11, domein: 'TA' },
    { thema: 'Blokkeren', vanaf: 12, domein: 'TE' },
    { thema: 'Spelsysteem en rotatie', vanaf: 12, domein: 'TA' },
  ],
  formatie11: '',
  doelSuggesties: [
    { tot: 9, teksten: ['De bal drie keer over laten gaan aan onze kant', 'Iedereen doet minstens 1x een opslag', 'Roepen "ik" als je de bal speelt', 'Na elke rally samen een high five'] },
    { tot: 12, teksten: ['Opslag over het net bij 3 van de 4 pogingen', 'Eerste bal hoog naar het midden spelen', 'Klaar staan in de lage houding', 'Na de opslag snel naar je plek'] },
    { tot: 15, teksten: ['Pass naar de spelverdeler', 'Aanvallen met een gerichte smash', 'Blok sluiten met twee spelers', 'Rotatie zonder fouten'] },
    { tot: 99, teksten: ['Pass-percentage op de opslag van de tegenstander omhoog', 'Snel spel via de middenaanvaller', 'Veldverdediging achter het blok', 'Rustig blijven bij een achterstand in de set'] },
  ],
});
