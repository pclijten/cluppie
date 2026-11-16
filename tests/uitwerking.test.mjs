/* [20261116i] Elke oefening in de bibliotheek is met de hand uitgewerkt: spelverloop in stappen, zo zie je dat het lukt,
   kijk en grijp in, tel mee, spelers aan zet, waarom het werkt en de principes van de speelwijze.
   Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/uitwerking.test.mjs */
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { PRINCIPES } from '../public/js/speelwijze-logica.js';
import { zevenVelden } from '../public/js/oefenkaart.js';
import { stappen3D } from '../public/js/scene3d.js';
import { rijVan, vormUitRij, alsDanTekst, alsDanUitTekst } from '../public/js/bibliotheek.js';
import { controleerKeten } from '../tools/trainingsbibliotheek/keten.mjs';
import { UITWERKING, fouten as bouwFouten } from '../tools/trainingsbibliotheek/uitwerking/index.mjs';
import { VORMEN as BRON } from '../tools/trainingsbibliotheek/index.mjs';

const fouten = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fouten.push(m); };
const V = BIBLIOTHEEK.vormen, ids = new Set(PRINCIPES.map(p => p.id));
const zin = (t) => typeof t === 'string' && /^[A-ZÉ0-9"“].{12,}[.?!"”]$/.test(t.trim());
const ZONDER_VERLOOP = new Set(['afs-terugblik', 'afs-m-slotcirkel', 'afs-g-herstel']);   /* kring: er valt niets te lopen */

ok(bouwFouten.length === 0, 'de bron bouwt zonder fouten: ' + bouwFouten.slice(0, 3).join(' | '));
ok(JSON.stringify(BRON) === JSON.stringify(V), 'public/js/trainingsbibliotheek.js is opnieuw gebouwd uit de bron (node tools/trainingsbibliotheek/bouw.mjs)');
ok(V.every(v => UITWERKING[v.id]), 'elke vorm heeft een uitwerking: ' + V.filter(v => !UITWERKING[v.id]).map(v => v.id).slice(0, 5).join(', '));

for (const v of V){
  const t = v.tekening || {}, lijnen = t.lijnen || [];
  ok(Array.isArray(v.lukt) && v.lukt.length === 2 && v.lukt.every(zin), `${v.id}: twee zinnen bij "zo zie je dat het lukt"`);
  ok(Array.isArray(v.alsDan) && v.alsDan.length === 2 && v.alsDan.every(x => zin(x.zie) && zin(x.doe)), `${v.id}: twee keer kijk en grijp in (zie je, doe dan)`);
  ok(zin(v.meet) && /Tel|Meet|Laat/.test(v.meet), `${v.id}: een telopdracht`);
  ok(zin(v.regie), `${v.id}: spelers aan zet`);
  ok(zin(v.inzicht), `${v.id}: waarom dit werkt`);
  ok(Array.isArray(v.principes) && v.principes.every(p => ids.has(p)) && v.principes.length <= 3, `${v.id}: principes bestaan (${(v.principes || []).join(',')})`);
  if (v.fase === 'afsluiting') ok(v.principes.length === 0, `${v.id}: een afsluiting heeft geen principe`);
  if (ZONDER_VERLOOP.has(v.id)){ ok(lijnen.length === 0, `${v.id}: kring zonder verloop`); continue; }
  const eigen = lijnen.filter(l => !l.samen);
  ok(eigen.length >= 5, `${v.id}: vijf of meer eigen stappen (nu ${eigen.length})`);
  ok(lijnen.every(l => zin(l.tekst)), `${v.id}: elke stap is een hele zin`);
  ok(lijnen.filter(l => !l.vervolg).length <= 6, `${v.id}: de tekening blijft leesbaar (hooguit 6 lijnen)`);
  ok(lijnen.some(l => l.fase), `${v.id}: het verloop heeft benoemde fases`);
  ok(new Set((t.spelers || []).map(s => s.nr)).size === (t.spelers || []).length, `${v.id}: elk nummer staat één keer in de tekening`);
  const k = controleerKeten(v);
  ok(k.length === 0, `${v.id}: het verloop klopt voor de 3D-motor: ${k[0] || ''}`);
  ok(stappen3D(v).every(s => !s.auto), `${v.id}: geen automatisch vervolg meer nodig`);
  /* de maat in de tekst is de maat van het veld */
  const kop = v.organisatie[0] || '', mm = kop.match(/(\d+(?:,\d)?) bij (\d+(?:,\d)?) meter/);
  if (mm && /^(Veld|Vak|Zet een (veld|vak)|Klein veld|Speel)/.test(kop) && !/per (twee|tweetal|vier|drie|groepje|duo)|Zet per|vierkant|driehoek|middenstrook|eindzone van/.test(kop)){
    const a = +mm[1].replace(',', '.'), b = +mm[2].replace(',', '.');
    ok((a === v.veld.b && b === v.veld.l) || (a === v.veld.l && b === v.veld.b), `${v.id}: de maat in de tekst (${mm[0]}) is die van het veld (${v.veld.b} bij ${v.veld.l})`);
  }
}

/* geen verwijzing naar een bron of een club, en geen gedachtestreepjes in de teksten */
const alles = JSON.stringify(V);
ok(!/trainer\s?360|\bAarle\b/i.test(alles) && !/\bASV\b/.test(alles), 'geen naam van een bron of club in de bibliotheek');
ok(!/[—–]/.test(alles), 'geen gedachtestreepjes in de teksten');

/* koppen: het advies van de KNVB staat erbij */
const kop = V.find(v => v.id === 'wu-m-kopbal-estafette');
ok(kop.letOp.some(x => /KNVB/.test(x)) && kop.letOp.some(x => /twee dagen/.test(x)), 'kopbal-estafette: aantal kopballen en hersteltijd staan bij Veiligheid');

/* de oefenkaart toont de uitwerking in de 7 vaste velden */
const vb = V.find(v => v.id === 'pos-4v2'), velden = Object.fromEntries(zevenVelden(vb).map(x => [x.id, x.html]));
ok(/Zo zie je dat het lukt/.test(velden.doel) && /Waarom dit werkt/.test(velden.doel), 'Doel toont de kijkwijzer en de onderbouwing');
ok(/Kijk en grijp in/.test(velden.diff) && /class="zie"/.test(velden.diff), 'Differentiatie toont kijk en grijp in');
ok(/Tel mee/.test(velden.coach) && /Spelers aan zet/.test(velden.coach), 'Coachmomenten toont de telling en de regie');
ok(/Spelverloop stap voor stap/.test(velden.uitleg), 'Uitleg toont het spelverloop');
ok(zevenVelden({ naam: 'Eigen', doel: 'Doel.', tijd: 10, organisatie: ['Zet uit.'] }).length === 7, 'een eigen vorm zonder uitwerking toont nog steeds 7 velden');

/* beheer en Excel: de nieuwe velden gaan heen en terug zonder verlies */
const rij = rijVan(vb), terug = vormUitRij(rij, vb);
ok(JSON.stringify(terug.lukt) === JSON.stringify(vb.lukt) && JSON.stringify(terug.alsDan) === JSON.stringify(vb.alsDan) && terug.meet === vb.meet && terug.regie === vb.regie && terug.inzicht === vb.inzicht, 'Excel heen en terug: uitwerking blijft gelijk');
ok(JSON.stringify(terug.principes) === JSON.stringify(vb.principes), 'Excel heen en terug: principes blijven gelijk');
ok(JSON.stringify(alsDanUitTekst(alsDanTekst(vb.alsDan))) === JSON.stringify(vb.alsDan) && alsDanUitTekst('Te druk => Groter vak')[0].doe === 'Groter vak', 'kijk en grijp in: tekst heen en terug, ook met =>');

if (fouten.length){ console.log('FOUTEN:'); fouten.slice(0, 40).forEach(f => console.log(' ✗', f)); console.log(`${fouten.length} van ${n} controles mislukt`); process.exit(1); }
console.log(`uitwerking: ${n} controles geslaagd (${V.length} oefeningen)`);
