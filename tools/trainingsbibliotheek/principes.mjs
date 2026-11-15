/* Koppelt elke vorm aan de principes van de speelwijze (public/js/speelwijze-logica.js: d1A … d8B, w2A, w2B).
   [20261116h] Afgeleid met regels uit de soort, de thema's en de tekst van de vorm. Staat er in de bron al
   `principes` (bij de speelwijze-vormen in vormen-s.mjs), dan blijft dat staan. Een vorm kan bij meerdere
   principes horen; een vorm zonder principe is een basisvorm (techniek, plezier, afsluiting).
   Dit is een eigen indeling op basis van ervaring, geen norm. */
const heeft = (v, ...themas) => themas.some(t => v.thema.includes(t));
const tekst = v => [v.naam, v.doel, v.uitleg, ...(v.organisatie || []), ...(v.regels || []), ...(v.coachpunten || [])].join(' ').toLowerCase();

/* Vormen die met de hand bij een principe zijn gezet (komt bovenop de regels hieronder). */
const EXTRA = {
  'po-g-linies-6v4': ['d5B'], 'vd-g-linie-8v8': ['d5B', 'd7A'], 'pa-g-11v11-zones': ['d5B'], 'pt-m-vijf-posities': ['d5B'],
  'af-o-patroon-derde': ['d5B', 'd6A'], 'pos-p-nummer-tien': ['d5B', 'd6A'], 'vd-compact': ['d3B', 'd7A'],
  'ol-g-compact-zones': ['d4B', 'd3B'], 'tp-k-rollen-wisselen': ['d5A'],
};

export function principesVan(v){
  if (Array.isArray(v.principes)) return [...new Set(v.principes)];          /* met de hand gezet (ook leeg = basisvorm) */
  if (v.fase === 'afsluiting') return [];
  const t = tekst(v), s = v.soort, uit = new Set(EXTRA[v.id] || []);
  const w = re => re.test(t);
  /* wij hebben de bal: opbouwen en tempo */
  if (s === 'opbouw' || (heeft(v, 'Positiespel opbouw') && w(/keeper|doelman|achteruit|van achteruit|opbouw/))) uit.add('d1A');
  if (w(/lange bal|diepe bal|over de (druk|verdedig)|tweede bal|aanspeelpunt|spits aanspe/)) uit.add('d1B');
  if (s === 'rondo' || s === 'positiespel' || (heeft(v, 'Positiespel opbouw') && w(/overtal|vrije (man|speler)|rondspelen|balbezit|kantel|driehoek/))) uit.add('d2A');
  if (s === 'dieptespel' || (heeft(v, 'Dieptespel opbouw') && s !== 'opbouw')) uit.add('d2B');
  /* aanvalsroute */
  if (s === 'voorzet' || heeft(v, 'Aanvallen met voorzet') || w(/voorzet|achterlijn|flank|buitenspeler|vleugel/)) uit.add('d6B');
  if (heeft(v, 'Scoren', 'Positiespel opbouw', 'Dieptespel opbouw') && w(/kaats|één-twee|een-twee|1-2|derde man|steekbal|combinatie|combineer|tussen de linies|door het midden/)) uit.add('d6A');
  /* durf of zekerheid */
  if (heeft(v, 'Uitspelen 1:1') || (s === 'dribbelspel' && w(/passe|uitspe|schijn|actie|trucje/))) uit.add('d8A');
  if (s === 'passen' || (heeft(v, 'Technische vaardigheden') && w(/zuiver|strak passen|aannemen en passen|balverlies/))) uit.add('d8B');
  /* vrijheid of vaste plek */
  if (w(/wissel(t|en)? van (plek|positie|rol)|draai door|doordraaien|iedereen speelt overal|positiewissel|vrije rol/)) uit.add('d5A');
  if (w(/vaste (plek|positie|zone)|blijf in (je|zijn) (zone|vak)|eigen zone|per linie|per positie|linies?\b.*taak/)) uit.add('d5B');
  /* zij hebben de bal */
  if (s === 'pressing' || (heeft(v, 'Storen en veroveren') && w(/druk|jagen|jaag|veroveren|storen/))) uit.add('d3A');
  if (s === 'verdedigen-groep' || heeft(v, 'Voorkomen van doelpunten') && w(/compact|dicht bij elkaar|blok|klein maken|inzakken|terugzakken/)) uit.add('d3B');
  if (s === 'verdedigen-groep' || heeft(v, 'Verdedigen dieptespel', 'Verdedigen van voorzet') && w(/rugdekking|schuif|kantel|knijp|zone|linie|doorgeven/)) uit.add('d7A');
  if (heeft(v, 'Verdedigen 1:1') || (s === 'duel' && w(/verdedig|afpakken|duel winnen|tussen .* en (het )?doel/)) || s === 'blokkeren') uit.add('d7B');
  /* omschakelen */
  if (heeft(v, 'Omschakelen balverlies')){
    if (w(/terug achter|terugval|terug naar (je|het) eigen|organis|achter de bal/)) uit.add('d4B');
    if (w(/tellen|seconden|direct|meteen|terugpak|terug te pakken|terugwin|tegendruk|jaag/) || !uit.has('d4B')) uit.add('d4A');
  }
  if (heeft(v, 'Omschakelen balwinst')){
    if (w(/eerst|veilig|rust|balbezit|in de ploeg houden|drie passes/)) uit.add('w2A');
    if (w(/tellen|seconden|snel|counter|direct|meteen|diep|sprint/) || !uit.has('w2A')) uit.add('w2B');
  }
  return [...uit];
}
