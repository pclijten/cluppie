/* [20261116j] Taalregels voor de trainingsbibliotheek: iedereen moet een oefening in één keer kunnen lezen.
   Korte zinnen, gewone woorden, geen afvallers, geen "zwakke" voet, geen "hij" of "man" voor een speler,
   open coachvragen, en één manier van schrijven voor tijd en maat.
   Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/taal.test.mjs */
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';

const fouten = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fouten.push(m); };
const V = BIBLIOTHEEK.vormen;
const zinnen = (s) => String(s).split(/(?<=[.!?])\s+/).filter(Boolean);
const woorden = (s) => s.split(/\s+/).filter(Boolean).length;

function teksten(v){
  const uit = [], zet = (veld, s) => { if (typeof s === 'string' && s.trim()) uit.push([veld, s]); };
  zet('doel', v.doel); zet('uitleg', v.uitleg); zet('tel mee', v.meet); zet('spelers aan zet', v.regie); zet('waarom', v.inzicht);
  for (const k of ['organisatie', 'regels', 'coachpunten', 'coachvragen', 'makkelijker', 'moeilijker', 'letOp', 'lukt']) (v[k] || []).forEach(s => zet(k, s));
  (v.varianten || []).forEach(x => { zet('variant', x.naam); zet('variant', x.uitleg); });
  (v.alsDan || []).forEach(x => { zet('zie je', x.zie); zet('doe dan', x.doe); });
  ((v.tekening || {}).lijnen || []).forEach(l => { zet('stap', l.tekst); zet('fase', l.fase); });
  zet('naam', v.naam);
  return uit;
}

const VERBODEN = [
  [/\bzwakk?e(re)? (voet|been|kant|hand|spelers?)\b/i, 'schrijf "andere voet" of "minder sterke kant", niet "zwakke"'],
  [/\b(vrije|laatste|tweede|eerste|extra|achterste) man\b|\bmiddenman\b|\b(zijn|jouw|je|hun|onze) man\b|\bmannen\b/i, 'schrijf speler, verdediger of tegenstander, niet "man"'],
  [/\bploeg(en|spel|genoo?t\w*)?\b/i, 'schrijf team, niet ploeg'],
  [/\bgoals?\b/i, 'schrijf doelpunt, niet goal'],
  [/\b(ben je af|(?<!Niemand )valt af|vallen af|afvallers?|uitgevallen speler|laatste is de koning)\b/i, 'geen afvallers: wie de bal kwijt is, doet meteen weer mee'],
  [/\bdie de fout maakte\b/i, 'schrijf "die de bal verloor", niet "die de fout maakte"'],
  [/\b(herorganis\w+|balwinner|tegenpressing|voorwaartse speler|buitenspelval|sidestep\w*|inpass)\b/i, 'vaktaal: schrijf het in gewone woorden'],
  [/\b(mijnenveld|mijnen)\b/i, 'geen oorlogsbeelden in een spel voor kinderen'],
  [/\b\d+ tellen\b|\b(twee|drie|vier|vijf|zes|zeven|acht|negen|tien|twaalf|vijftien|twintig|dertig) (tellen|seconden|meter|minuten)\b/i, 'tijd en maat in cijfers, en seconden in plaats van tellen'],
  [/\b(dood(leggen|vallen)?|doodt)\b/i, 'schrijf stilleggen of stilvallen'],
  [/ {2}| [,.;:!?](?:\s|$)|\b(?<w>de|het|een|en|van|in|te|is) \k<w>\b/i, 'spatie- of dubbelwoordfout'],
];

for (const v of V){
  for (const [veld, s] of teksten(v)){
    for (const z of zinnen(s)) ok(veld === 'naam' || woorden(z) <= 22, `${v.id} (${veld}): zin van ${woorden(z)} woorden, hooguit 22: "${z.slice(0, 70)}"`);
    for (const [re, waarom] of VERBODEN) ok(!re.test(s), `${v.id} (${veld}): ${waarom}: "${s.slice(0, 80)}"`);
    if (veld === 'stap') ok(!/^Hij\b|\bhij\b.*\bhij\b/.test(s), `${v.id}: noem de speler in de stap, niet "hij": "${s}"`);
  }
  ok(/^Zeg: "/.test(v.uitleg) && woorden(v.uitleg) <= 46, `${v.id}: de uitleg is een zin om te zeggen, hooguit 45 woorden (nu ${woorden(v.uitleg)})`);
  ok(v.coachpunten.length >= 2 && v.coachpunten.length <= 4, `${v.id}: twee tot vier coachpunten`);
  ok(v.coachvragen.length >= 2 && new Set(v.coachvragen).size === v.coachvragen.length, `${v.id}: minstens twee verschillende coachvragen`);
  for (const q of v.coachvragen) ok(/\?$/.test(q.trim()) && !/^(Kun|Kan|Is|Zijn|Heb|Heeft|Mag|Moet|Wil|Ga|Doe|Zie|Lukt|Weet)\b/.test(q), `${v.id}: een open coachvraag (wat, hoe, waar, wanneer, wie): "${q}"`);
  ok(new Set(v.makkelijker).size === v.makkelijker.length && !v.moeilijker.some(m => v.makkelijker.includes(m)), `${v.id}: makkelijker en moeilijker verschillen`);
  ok(v.alsDan[0].zie !== v.alsDan[1].zie && v.alsDan[0].doe !== v.alsDan[1].doe, `${v.id}: twee verschillende situaties bij kijk en grijp in`);
}

/* een duel van 1 tegen 1 of 2 tegen 2 waar iedereen tegelijk speelt, duurt kort: hooguit 2 minuten per ronde */
for (const v of V){
  const m = v.naam.match(/(\d+) tegen (\d+)/);
  if (m && +m[1] + +m[2] <= 4 && v.spelers.ideaal <= 4 && !['rondo', 'positiespel'].includes(v.soort)) ok(v.duur.ronde <= 2 && v.duur.rust >= 1, `${v.id}: een klein duel duurt hooguit 2 minuten per ronde, met rust (nu ${v.duur.ronde} en ${v.duur.rust})`);
}

if (fouten.length){ console.error(`taal: ${fouten.length} van ${n} controles fout`); for (const f of fouten.slice(0, 40)) console.error(' - ' + f); process.exit(1); }
console.log(`taal: ${n} controles goed`);
