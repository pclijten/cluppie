/* ==================== TV-SJABLONEN: DE LIJST [20261126q] ====================
   De sjablonen waaruit een club kiest voor de kantine-tv (Activiteiten › Kantine-tv en sponsoren).
   'bord' is het tactisch bord uit tv-stijl.js; de andere staan elk in een eigen bestand tv-sjabloon-<id>.js
   en worden pas geladen als een tv ze nodig heeft.

   EEN SJABLOON TOEVOEGEN
   1. Kopieer een bestaand bestand, bijvoorbeeld tv-sjabloon-affiche.js, naar tv-sjabloon-<id>.js en pas het aan.
   2. Zet hieronder één regel in SJABLONEN (id, naam, kort) en één regel in LADERS.
   Meer is niet nodig: de keuze verschijnt vanzelf bij de instellingen en het voorbeeld werkt meteen
   (?scherm=<tv>&sjabloon=<id>&proef=1). Wat een sjabloon moet kunnen staat in docs/tv-sjablonen.md.

   EEN SJABLOON WIJZIGEN: alleen zijn eigen bestand aanpassen. De id blijft gelijk, want die staat bij de clubs opgeslagen.
   EEN SJABLOON WEGHALEN: de regel uit SJABLONEN halen; clubs die hem hadden vallen terug op het tactisch bord. */

export const SJABLONEN = [
  { id: 'bord', naam: 'Tactisch bord', kort: 'Het bord in clubkleur met veldlijnen en een bal die rondgaat.' },
  { id: 'wedstrijdavond', naam: 'Wedstrijdavond', kort: 'Voetbal-tv: scorebalk, lower third en schuine kleurvlakken.' },
  { id: 'vertrekhal', naam: 'Vertrekhal', kort: 'Een klapbord zoals op het station: elke letter klapt om.' },
  { id: 'affiche', naam: 'Affiche', kort: 'Eén boodschap per dia in enorme letters.' },
  { id: 'bento', naam: 'Bento', kort: 'Alles tegelijk in tegels die omkantelen.' },
  { id: 'veldkaart', naam: 'Veldkaart', kort: 'Plattegrond van het sportpark: wat speelt op welk veld.' },
  { id: 'sportnieuws', naam: 'Sportnieuws', kort: 'Nieuwskader met een vaste live-rail en lopende banden.' },
  { id: 'lichtkrant', naam: 'Lichtkrant', kort: 'LED-scorebord met neon en een glitch-overgang.' },
  { id: 'plakboek', naam: 'Plakboek', kort: 'Kaartjes, tape, stickers en stift.' },
  { id: 'kubus', naam: 'Kubus', kort: 'Glazen panelen op een draaiende kubus.' },
  { id: 'lounge', naam: 'Lounge', kort: 'Rustig en chic, met zacht bewegend licht.' },
];

const LADERS = {
  wedstrijdavond: () => import('./tv-sjabloon-wedstrijdavond.js?v=20261127u'),
  vertrekhal: () => import('./tv-sjabloon-vertrekhal.js?v=20261127u'),
  affiche: () => import('./tv-sjabloon-affiche.js?v=20261127u'),
  bento: () => import('./tv-sjabloon-bento.js?v=20261127u'),
  veldkaart: () => import('./tv-sjabloon-veldkaart.js?v=20261127u'),
  sportnieuws: () => import('./tv-sjabloon-sportnieuws.js?v=20261127u'),
  lichtkrant: () => import('./tv-sjabloon-lichtkrant.js?v=20261127u'),
  plakboek: () => import('./tv-sjabloon-plakboek.js?v=20261127u'),
  kubus: () => import('./tv-sjabloon-kubus.js?v=20261127u'),
  lounge: () => import('./tv-sjabloon-lounge.js?v=20261127u'),
};

/* Een onbekende of weggehaalde id valt terug op het tactisch bord. */
export const sjabloonId = v => (SJABLONEN.some(s => s.id === v) && (v === 'bord' || LADERS[v])) ? v : 'bord';
export const laadSjabloon = async id => (await LADERS[id]()).default;
