/* ==================== SPORTPROFIEL: HOCKEY ====================
   [20261126c] Veldhockey volgens de KNHB. Zelfde opbouw als sport-voetbal.js (zie daar en
   docs/sportprofiel-impactanalyse.md). Spelvormen jeugd: O8 3 tegen 3 zonder keeper, O9 6 tegen 6,
   O10 8 tegen 8, O11 9 tegen 9 op driekwart veld (sinds 2025/26), vanaf O12 11 tegen 11.
   Speeltijden van O11 en ouder en de kaartduur per leeftijd: te controleren met de pilotclub
   (de club kan ze aanpassen onder Instellingen › Regels en Lijsten). Eigen oefenstof en plannen
   ontbreken nog (inhoud: false). Bewust zonder imports: pure data. */
const vries = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)){ Object.freeze(o); Object.values(o).forEach(vries); } return o; };

export const HOCKEY = vries({
  id: 'hockey',
  naam: 'Hockey',
  icoon: 'football-pitch',
  open: true,           /* [20261126f] open voor iedereen (besluit Paul 25-11-2026); oefenstof volgt met de clubs */
  inhoud: false,
  ledenbron: 'lisa',
  veld: {
    lengte: 91.4, breedte: 55,
    /* 23-meterlijnen (25% en 75%), middenlijn, de cirkel (14,63 m) als boog aan beide kanten */
    bord: { dwars: [25, 50, 75], cirkel: 0, vakken: [{ id: 'cirkel', b: 60, h: 16, vorm: 'boog' }] },
    kaart: { cirkel: 0 },
  },
  wedstrijd: {
    zonderKeeper: ['3'],
    periodeNaam: { 2: 'Helft', 4: 'Kwart' }, periodeKort: { 2: 'H', 4: 'K' },
    kaarten: [
      { type: 'groen', naam: 'groene kaart', knop: 'Groen', duur: 120 },
      { type: 'geel', naam: 'gele kaart', knop: 'Geel', duur: 300 },
      { type: 'rood', naam: 'rode kaart', knop: 'Rood', eruit: true },
    ],
    tweedeGeelRood: false,
    kaartUitleg: 'groen is 2 minuten eruit, geel minstens 5 minuten (de scheidsrechter kan langer geven), rood is de rest van de wedstrijd. Het team speelt in die tijd met een speler minder.',
  },
  woorden: { bond: 'KNHB', ledenbron: 'LISA', keeper: 'keeper', elftal: 'elftal', buitenspel: 'buitenspel' },
  tijdstraf: { pupilSec: 300, jeugdSec: 300, jeugdVanaf: 16 },
  bouwGrenzen: { onderTm: 10, middenTm: 14 },
  categorieen: {
    'JO8':  { format: '3',  periodes: 2, duur: 20, knvb: '3 tegen 3, geen keeper, 2×20 min' },
    'JO9':  { format: '6',  periodes: 2, duur: 25, knvb: '6 tegen 6 met keeper, kwart veld, 2×25 min' },
    'JO10': { format: '8',  periodes: 2, duur: 30, knvb: '8 tegen 8 met keeper, half veld, 2×30 min' },
    'JO11': { format: '9',  periodes: 2, duur: 30, knvb: '9 tegen 9 met keeper, driekwart veld, 2×30 min' },
    'JO12': { format: '11', periodes: 2, duur: 30, knvb: '11 tegen 11, heel veld, 2×30 min' },
    'JO14': { format: '11', periodes: 2, duur: 30, knvb: '11 tegen 11, 2×30 min' },
    'JO16': { format: '11', periodes: 2, duur: 35, knvb: '11 tegen 11, 2×35 min' },
    'JO18': { format: '11', periodes: 2, duur: 35, knvb: '11 tegen 11, 2×35 min' },
    'Senioren': { format: '11', periodes: 4, duur: 17.5, knvb: '11 tegen 11, 4×17,5 min' },
  },
  categorieenMeiden: {
    'MO8':  { format: '3',  periodes: 2, duur: 20, knvb: '3 tegen 3, geen keeper, 2×20 min' },
    'MO9':  { format: '6',  periodes: 2, duur: 25, knvb: '6 tegen 6 met keeper, kwart veld, 2×25 min' },
    'MO10': { format: '8',  periodes: 2, duur: 30, knvb: '8 tegen 8 met keeper, half veld, 2×30 min' },
    'MO11': { format: '9',  periodes: 2, duur: 30, knvb: '9 tegen 9 met keeper, driekwart veld, 2×30 min' },
    'MO12': { format: '11', periodes: 2, duur: 30, knvb: '11 tegen 11, heel veld, 2×30 min' },
    'MO14': { format: '11', periodes: 2, duur: 30, knvb: '11 tegen 11, 2×30 min' },
    'MO16': { format: '11', periodes: 2, duur: 35, knvb: '11 tegen 11, 2×35 min' },
    'MO18': { format: '11', periodes: 2, duur: 35, knvb: '11 tegen 11, 2×35 min' },
    'Vrouwen': { format: '11', periodes: 4, duur: 17.5, knvb: '11 tegen 11, 4×17,5 min' },
  },
  /* [x%, y%, lijn]; de keeper komt er automatisch bij (behalve bij 3 tegen 3) */
  formaties: {
    '3': {
      '1-2': [[50, 70, 'V'], [30, 30, 'A'], [70, 30, 'A']],
      '2-1': [[30, 70, 'V'], [70, 70, 'V'], [50, 28, 'A']],
    },
    '6': {
      '2-2-1': [[30, 74, 'V'], [70, 74, 'V'], [30, 49, 'M'], [70, 49, 'M'], [50, 22, 'A']],
      '2-1-2': [[30, 74, 'V'], [70, 74, 'V'], [50, 49, 'M'], [30, 22, 'A'], [70, 22, 'A']],
      '3-2':   [[22, 70, 'V'], [50, 74, 'V'], [78, 70, 'V'], [32, 30, 'A'], [68, 30, 'A']],
    },
    '8': {
      '3-3-1': [[22, 76, 'V'], [50, 76, 'V'], [78, 76, 'V'], [22, 49, 'M'], [50, 49, 'M'], [78, 49, 'M'], [50, 22, 'A']],
      '2-3-2': [[32, 76, 'V'], [68, 76, 'V'], [22, 49, 'M'], [50, 49, 'M'], [78, 49, 'M'], [32, 22, 'A'], [68, 22, 'A']],
      '3-2-2': [[22, 76, 'V'], [50, 76, 'V'], [78, 76, 'V'], [32, 49, 'M'], [68, 49, 'M'], [32, 22, 'A'], [68, 22, 'A']],
    },
    '9': {
      '3-3-2': [[22, 76, 'V'], [50, 76, 'V'], [78, 76, 'V'], [22, 49, 'M'], [50, 49, 'M'], [78, 49, 'M'], [32, 22, 'A'], [68, 22, 'A']],
      '3-2-3': [[22, 76, 'V'], [50, 76, 'V'], [78, 76, 'V'], [32, 49, 'M'], [68, 49, 'M'], [22, 22, 'A'], [50, 22, 'A'], [78, 22, 'A']],
    },
    '11': {
      '4-3-3': [[14, 76, 'V'], [38, 76, 'V'], [62, 76, 'V'], [86, 76, 'V'], [22, 49, 'M'], [50, 49, 'M'], [78, 49, 'M'], [22, 22, 'A'], [50, 22, 'A'], [78, 22, 'A']],
      '3-4-3': [[22, 76, 'V'], [50, 76, 'V'], [78, 76, 'V'], [14, 49, 'M'], [38, 49, 'M'], [62, 49, 'M'], [86, 49, 'M'], [22, 22, 'A'], [50, 22, 'A'], [78, 22, 'A']],
      '4-4-2': [[14, 76, 'V'], [38, 76, 'V'], [62, 76, 'V'], [86, 76, 'V'], [14, 49, 'M'], [38, 49, 'M'], [62, 49, 'M'], [86, 49, 'M'], [32, 22, 'A'], [68, 22, 'A']],
    },
  },
  lijnNaam: { K: 'Keeper', V: 'Verdediging', M: 'Middenveld', A: 'Aanval' },
  zoneNaam: {
    V: { links: 'Linksachter', midden: 'Centrale verdediger', rechts: 'Rechtsachter' },
    M: { links: 'Linkshalf', midden: 'Centrale middenvelder', rechts: 'Rechtshalf' },
    A: { links: 'Linksbuiten', midden: 'Midvoor', rechts: 'Rechtsbuiten' },
  },
  positieGroepen: [
    { lijn: 'K', naam: 'Keeper', posities: ['Keeper'] },
    { lijn: 'V', naam: 'Verdediging', posities: ['Linksachter', 'Centrale verdediger', 'Rechtsachter'] },
    { lijn: 'M', naam: 'Middenveld', posities: ['Linkshalf', 'Centrale middenvelder', 'Rechtshalf'] },
    { lijn: 'A', naam: 'Aanval', posities: ['Linksbuiten', 'Midvoor', 'Rechtsbuiten'] },
  ],
  kalenderSeizoen: "2026/'27",
  kalender: { pup: [], jun: [], sen: [], mei: [] },
  leercurve: [
    { thema: 'Teamsport en plezier', vanaf: 6, domein: 'GE' },
    { thema: 'Stickvaardigheid en balbeheersing', vanaf: 6, domein: 'TE' },
    { thema: 'Passen en aannemen', vanaf: 7, domein: 'TE' },
    { thema: 'Dribbelen en passeren 1:1', vanaf: 8, domein: 'TE' },
    { thema: 'Scoren in de cirkel', vanaf: 8, domein: 'TE' },
    { thema: 'Vrijlopen en aanspeelbaar zijn', vanaf: 9, domein: 'TA' },
    { thema: 'Opbouwen van achteruit', vanaf: 10, domein: 'TA' },
    { thema: 'Verdedigen 1:1 (jab en tackle)', vanaf: 10, domein: 'TE' },
    { thema: 'Druk zetten en veroveren', vanaf: 10, domein: 'TA' },
    { thema: 'Cirkelverdediging', vanaf: 11, domein: 'TA' },
    { thema: 'Strafcorner aanvallen', vanaf: 12, domein: 'TA' },
    { thema: 'Strafcorner verdedigen', vanaf: 12, domein: 'TA' },
    { thema: 'Omschakelen balwinst', vanaf: 13, domein: 'TA' },
    { thema: 'Omschakelen balverlies', vanaf: 13, domein: 'TA' },
  ],
  formatie11: '4-3-3',
  doelSuggesties: [
    { tot: 9, teksten: ['Iedereen houdt de bal aan de platte kant van de stick', 'Na balverovering meteen naar het doel dribbelen', 'Iedereen minstens 1x een schot op doel', 'Elkaar aanmoedigen na een fout'] },
    { tot: 12, teksten: ['Bal aannemen en in één beweging meenemen', 'Vrijlopen in de ruimte, niet naar de bal toe', 'Direct druk zetten na balverlies', 'In de cirkel binnen 2 tikken schieten'] },
    { tot: 15, teksten: ['Opbouwen via de achterlijn met een vrije man', 'Bij balverlies de middenlijn snel dichtzetten', 'Strafcorner: iedereen kent zijn taak', 'Verdedigen 1:1: blijven staan en jabben'] },
    { tot: 99, teksten: ['Snel omschakelen na balverovering', 'Compact verdedigen rond de cirkel', 'Strafcornervarianten uitvoeren zoals getraind', 'Rust in de opbouw onder druk'] },
  ],
});
