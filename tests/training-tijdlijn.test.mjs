// [20261120k] Training als tijdlijn: tijden, materiaal, het uitzetplan en de html. Voor een reeks echte trainingen
// uit de planner: elke oefening krijgt een tijd, vakken overlappen nooit en liggen binnen het veld.
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { maakPlan } from '../public/js/trainingsplanner.js';
import { oefeningVan } from '../public/js/seizoensplan-club.js';
import { plusMinuten, materiaalVan, tijdlijnInfo, vakkenPlan, klaarzetten, verzetTekst, htmlVerloop, htmlUitzet, htmlUitzetKnop, alsOnderdeel, htmlKaart } from '../public/js/training-tijdlijn.js';

const V = BIBLIOTHEEK.vormen, fouten = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fouten.push(m); };
const opId = id => V.find(v => v.id === id) || null;

ok(plusMinuten('18:30', 15) === '18:45' && plusMinuten('23:50', 20) === '0:10', 'plusMinuten');
ok(JSON.stringify(materiaalVan({ blokken: [{ veld: 'mat', type: 'lijst', items: ['8 pionnen', '2 doeltjes', '6 hesjes', '4 ballen', 'fluitje'] }] })) === JSON.stringify({ pionnen: 8, ballen: 4, hesjes: 6, doeltjes: 2 }), 'materiaal uit Benodigdheden');
ok(verzetTekst({ b: 30, l: 40 }, { b: 32, l: 36 }) === '1 m per zijlijn naar buiten, 2 m per kant korter', 'verzettekst');

/* een training zonder vormen (eigen PDF): geen tijden, geen uitzetplan, geen fouten */
const eigen = tijdlijnInfo([{ titel: 'Eigen', blokken: [] }], opId, '18:30');
ok(!eigen.tijden && eigen.items[0].tijd === '' && htmlVerloop(eigen) === '' && htmlUitzetKnop(eigen) === '', 'eigen training zonder vormen');

const overlapt = (a, b) => !(a.x + a.b <= b.x || b.x + b.b <= a.x || a.y + a.l <= b.y || b.y + b.l <= a.y);
for (const cat of ['O9', 'O11', 'O13', 'O15']) for (const spelers of [8, 12, 16]) for (let seed = 1; seed <= 6; seed++){
  const p = maakPlan(V, { categorie: cat, aantalSpelers: spelers, niveau: 2, duur: 75, thema: '', blokFase: 'Verdiep', seed: `${cat}${spelers}${seed}`, recent: [] });
  const oef = p.onderdelen.map(oefeningVan);
  const info = tijdlijnInfo(oef, opId, '18:30');
  const w = `${cat}/${spelers}/${seed}`;
  ok(info.tijden && info.items.every(x => /^\d{1,2}:\d{2}$/.test(x.tijd)), `${w}: elke oefening een tijd`);
  ok(info.items[0].tijd === '18:30' && info.eind === plusMinuten('18:30', info.totaal), `${w}: begin en eind`);
  const plan = vakkenPlan(info), V0 = plan.veld, eigenV = plan.filter(q => q.deelt == null);
  ok(plan.every(q => q.x >= 0 && q.y >= 0 && q.x + q.b <= V0.b && q.y + q.l <= V0.l), `${w}: vakken binnen het veld`);
  ok(eigenV.every((a, i) => eigenV.every((b, j) => i === j || !overlapt(a, b))), `${w}: vakken overlappen niet`);
  ok(klaarzetten(info).pionnen >= eigenV.length * 4, `${w}: minstens vier pionnen per vak`);
  const html = htmlUitzet(info, 'alles') + htmlVerloop(info) + info.items.map(x => htmlKaart(x, false) + alsOnderdeel('<section class="trw-oef"><div class="trw-oef-kop"><span class="trw-oef-nr">1</span><h2>x</h2></div></section>', x, true)).join('');
  ok(!/undefined|NaN/.test(html), `${w}: geen undefined of NaN in de html`);
  ok(info.items.every(x => alsOnderdeel('<section class="trw-oef"><div class="trw-oef-kop"><span class="trw-oef-nr">1</span><h2>x</h2></div></section>', x, false).includes('class="tl-meta"')), `${w}: meta komt in de sectie`);
}

if (fouten.length){ console.error(fouten.slice(0, 20).join('\n')); console.error(`training-tijdlijn: ${fouten.length} van ${n} controles mislukt`); process.exit(1); }
console.log(`training-tijdlijn: ${n} controles geslaagd`);
