/* Eerste voorstel voor de speelstijl-tags per vorm (stijltags.mjs). Dit is een hulpmiddel: het leest de tekst van elke
   vorm en kent tags toe met trefwoorden, beperkt tot passende thema's. Het resultaat is een voorstel dat een trainer
   moet nalopen; wijzig daarna `stijltags.mjs` met de hand en draai dit script niet opnieuw (dat overschrijft je werk).
   Gebruik: node tools/trainingsbibliotheek/tag-genereer.mjs > tools/trainingsbibliotheek/stijltags.mjs */
import { BIBLIOTHEEK } from '../../public/js/trainingsbibliotheek.js';

const tekst = v => [v.naam, v.doel, v.uitleg, ...v.organisatie, ...v.regels, ...v.coachpunten, ...(v.varianten || []).map(x => x.naam + ' ' + x.uitleg)].join(' ').toLowerCase();
const thema = (v, ...namen) => v.thema.some(t => namen.some(n => t.startsWith(n)));
const REGELS = [
  ['d1A', (v, t) => v.id === 'kp-uitrollen-opbouw' || (thema(v, 'Dieptespel', 'Positiespel') && /via de keeper|uitrol|vanaf de keeper|keeper (begint|speelt mee|start)/.test(t))],
  ['d1B', (v, t) => thema(v, 'Dieptespel', 'Omschakelen', 'Aanvallen') && /lange bal|over de druk heen|ver naar voren/.test(t)],
  ['d2A', (v, t) => thema(v, 'Positiespel') && /rondo|balbezit|rondspelen|geduld/.test(t)],
  ['d2B', (v, t) => thema(v, 'Dieptespel', 'Omschakelen', 'Scoren') && /snel vooruit|direct (diep|vooruit)|dieptepass|counter|binnen \w+ seconden/.test(t)],
  ['d3A', (v, t) => thema(v, 'Storen', 'Omschakelen balverlies') && /hoog druk|druk zetten|pressing|jagen/.test(t)],
  ['d3B', (v, t) => thema(v, 'Storen', 'Verdedigen dieptespel', 'Omschakelen balverlies') && /terugzakken|compact|blok/.test(t)],
  ['d4A', (v, t) => thema(v, 'Omschakelen balverlies') && /direct|binnen \w+ seconden|tegenpressing|jagen|terugpakken/.test(t)],
  ['d4B', (v, t) => thema(v, 'Omschakelen balverlies') && /terugvallen|blok|compact|organis/.test(t)],
  ['d5A', (v, t) => /alle posities|alle rollen|rollen wisselen|van plek wisselen|vrij wisselen/.test(t)],
  ['d5B', (v, t) => /vaste (positie|plek|taak|taken)/.test(t)],
  ['d6A', (v, t) => thema(v, 'Positiespel', 'Uitspelen', 'Dieptespel') && /door het midden|via het midden|combineer|combinatie/.test(t)],
  ['d6B', (v, t) => thema(v, 'Aanvallen met voorzet') || (thema(v, 'Dieptespel', 'Scoren') && /flank|vleugel|zijkant/.test(t))],
  ['d7A', (v, t) => thema(v, 'Verdedigen', 'Voorkomen', 'Storen') && /zone|ruimte (bewaken|afdekken|dicht)/.test(t)],
  ['d7B', (v, t) => thema(v, 'Verdedigen 1:1') || (thema(v, 'Verdedigen', 'Storen') && /man-op-man|man op man|eigen tegenstander/.test(t))],
  ['d8A', (v, t) => thema(v, 'Technische', 'Uitspelen', 'Teamsport') && /risico|fouten (horen|maken|mag)|durf|trucje/.test(t)],
  ['d8B', (v, t) => thema(v, 'Verdedigen', 'Voorkomen') && /veilig|veiligheid eerst|weg ermee/.test(t)],
  ['xlang', (v, t) => /lange bal/.test(t)],
  ['xtijd', (v, t) => /tijd (laten verlopen|rekken)/.test(t)],
];
const uit = {};
for (const v of BIBLIOTHEEK.vormen){
  const t = tekst(v);
  let tags = REGELS.filter(([, f]) => f(v, t)).map(([k]) => k);
  /* een vorm die beide kanten van één onderdeel raakt, is neutraal voor dat onderdeel */
  tags = tags.filter(k => !/^d\d[AB]$/.test(k) || !tags.includes(k.slice(0, 2) + (k[2] === 'A' ? 'B' : 'A')));
  if (tags.includes('d5B')) tags.push('xpos');
  if (tags.length) uit[v.id] = tags;
}
console.log('/* Speelstijl-tags per vorm: d1…d8 = onderdeel van de speelstijl, A of B = de kant die de vorm oefent;\n   xlang / xpos / xtijd = wat een club kan uitsluiten ("dit willen wij niet"). Eerste voorstel uit tag-genereer.mjs,\n   nog door een trainer na te lopen. Vormen zonder tag zijn neutraal (techniek, ruimte, samenspel). */');
console.log('export const STIJLTAGS = {');
for (const [id, tags] of Object.entries(uit)) console.log(`  '${id}': ${JSON.stringify(tags).replace(/"/g, "'")},`);
console.log('};');
