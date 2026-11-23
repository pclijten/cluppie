// Blokplanning: bestandsnamen herkennen, weken plannen, zichtbaarheid, upload-wachtrij-schakelaar.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/trainingplan.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir = new URL('../public/js/', import.meta.url);
const P = await import(new URL('training-plan.js', dir));
const W = await import(new URL('upload-wachtrij.js', dir));

/* namen herkennen */
const h = n => P.herkenNaam(n);
assert.deepEqual(h('Blok 2 - Week 1 - Training 1.pdf'), { blok: 2, week: 1, nr: 1, voor: '', thema: '' });
assert.equal(h('JO7 - Week 2 - Bal = Vriend - Training 1.pdf').thema, 'Bal = Vriend');
assert.equal(h('JO7 - Week 2 - Bal = Vriend - Training 1.pdf').voor, 'JO7');
assert.equal(h('Week 6 - Behendigheid - Training 2.pdf').nr, 2);
assert.equal(h('Week 6 - Behendigheid - Training 2.pdf').blok, 0);
assert.equal(h('Blok 2 - Overzicht.pdf').overzicht, true);
assert.equal(h('map/Blok 3 - Week 4 - Training 3.pdf').blok, 3);
assert.equal(h('foto.png'), null);
assert.equal(h('iets anders.pdf'), null);

/* blokupload of niet */
const pdf = naam => ({ name: naam, type: 'application/pdf' });
assert.equal(P.isBlokUpload([{ name: 'blok.zip', type: 'application/zip' }]), true);
assert.equal(P.isBlokUpload([pdf('Week 1 - Training 1.pdf')]), false);
assert.equal(P.isBlokUpload([pdf('Week 1 - Training 1.pdf'), pdf('Week 1 - Training 2.pdf')]), false, 'één week = gewone upload');
assert.equal(P.isBlokUpload([pdf('Week 1 - Training 1.pdf'), pdf('Week 2 - Training 1.pdf')]), true);

/* weken plannen met vrije weken */
assert.equal(P.maandagVan('2026-10-14'), '2026-10-12');
assert.equal(P.isoWeekNr('2026-10-19'), 43);
assert.deepEqual(P.planWeken('2026-10-19', [], 3), ['2026-10-19', '2026-10-26', '2026-11-02']);
assert.deepEqual(P.planWeken('2026-10-19', ['2026-10-26'], 3), ['2026-10-19', '2026-11-02', '2026-11-09']);
assert.equal(P.titelVoor('2026-10-19', 1), 'Week 43 - training 1');

/* zichtbaarheid */
assert.equal(P.zichtbaarDatum('2026-10-19', 'zo'), '2026-10-18');
assert.equal(P.zichtbaarDatum('2026-10-19', 'meteen'), null);
assert.equal(P.zichtbaarNu({}, '2026-10-01'), true, 'zonder veld altijd zichtbaar');
assert.equal(P.zichtbaarNu({ zichtbaarVanaf: '2026-10-18' }, '2026-10-17'), false);
assert.equal(P.zichtbaarNu({ zichtbaarVanaf: '2026-10-18' }, '2026-10-18'), true);
assert.equal(P.zichtbaarLabel({ zichtbaarVanaf: '2999-01-01' }) !== '', true);
assert.equal(P.zichtbaarLabel({}), '');

/* "Nauwkeuriger" staat uit tot het model-id op de server is gekozen */
assert.equal(W.NAUWKEURIG_AAN, false);
assert.equal(W.htmlModelKeuze('x'), '');
const srv = fs.readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
assert.match(srv, /const MODEL_NAUWKEURIG = null;/, 'server en client moeten samen aan');

/* geen ASV-verwijzingen in de nieuwe modules */
for (const f of ['training-plan.js', 'upload-wachtrij.js']){
  assert.doesNotMatch(fs.readFileSync(new URL(f, dir), 'utf8'), /asv/i, `${f} bevat een ASV-verwijzing`);
}
/* [20261116o] weeklabel met de hand aangepast: de maandag van dat weeknummer, zo dicht mogelijk bij de oude */
assert.equal(P.weekStartBijLabel('Week 46', '2026-11-02'), '2026-11-09');          // week 45 -> week 46
assert.equal(P.weekStartBijLabel('wk 2', '2026-12-21'), '2027-01-11');             // over de jaargrens: het dichtstbijzijnde jaar
assert.equal(P.weekStartBijLabel('Week 45', '2026-11-02'), '2026-11-02');          // zelfde week: blijft staan
assert.equal(P.weekStartBijLabel('Blok 2, passen', '2026-11-02'), '2026-11-02');   // geen weeknummer: blijft staan
assert.equal(P.weekStartBijLabel('Week 46', ''), null);                            // niet ingepland: geen weekStart
/* [20261123a] Plannen: een week verslepen. De stand komt uit de trainingen zelf (weekStart). */
{
  const reeks = rijen => rijen.map(([ws, bw, nr = 1], i) => ({ id: 't' + i, weekStart: ws, blokWeek: bw, trainingNr: nr }));
  // week 48 = blokweek 9 (twee trainingen), week 49 = 10, week 50 = 11
  const R = reeks([['2026-11-23', 9], ['2026-11-23', 9, 2], ['2026-11-30', 10], ['2026-12-07', 11]]);
  const st = P.planStand(R);
  assert.deepEqual([...st.keys()], ['2026-11-23', '2026-11-30', '2026-12-07']);
  assert.equal(st.get('2026-11-23').n, 2);
  assert.deepEqual([...st.get('2026-11-23').bws], [9]);
  assert.equal(P.planStand(reeks([['2026-11-25', 9]])).has('2026-11-23'), true, 'een weekStart midden in de week telt bij de maandag');
  assert.equal(P.planStand([{ id: 'x', weekStart: '', blokWeek: 1 }]).size, 0, 'zonder weekStart geen plek');

  // hele reeks twee weken naar voren: alles erna schuift evenveel mee
  let r = P.rekenSleep(R, [], '2026-11-23', '2026-11-09', 'rest');
  assert.deepEqual([...r.zet], [['2026-11-23', '2026-11-09'], ['2026-11-30', '2026-11-16'], ['2026-12-07', '2026-11-23']]);
  assert.equal(r.botsing, null);
  assert.equal(r.eerste, '2026-11-09');
  // alleen deze week
  r = P.rekenSleep(R, [], '2026-11-30', '2026-12-14', 'een');
  assert.deepEqual([...r.zet], [['2026-11-30', '2026-12-14']]);
  // bezette week = wisselen, wat de keuze ook is
  r = P.rekenSleep(R, [], '2026-11-30', '2026-12-07', 'rest');
  assert.deepEqual([...r.zet], [['2026-11-30', '2026-12-07'], ['2026-12-07', '2026-11-30']]);
  assert.equal(r.botsing, null);
  // over een eerdere week heen springen: alles erna meenemen botst, alleen deze week niet
  r = P.rekenSleep(R, [], '2026-11-30', '2026-11-16', 'rest');
  assert.equal(r.botsing, '2026-11-23');
  assert.equal(P.rekenSleep(R, [], '2026-11-30', '2026-11-16', 'een').botsing, null);

  // vrije weken tellen niet als plek: wat meeschuift springt over de vakantie
  const V = reeks([['2026-11-30', 10], ['2026-12-07', 11], ['2026-12-28', 12]]);
  const vakantie = ['2026-12-14', '2026-12-21'];
  r = P.rekenSleep(V, vakantie, '2026-11-30', '2026-11-23', 'rest');
  assert.deepEqual([...r.zet], [['2026-11-30', '2026-11-23'], ['2026-12-07', '2026-11-30'], ['2026-12-28', '2026-12-07']]);
  assert.deepEqual(r.vrij, [], 'vrije weken buiten de reeks vervallen');
  // slepen naar een vrije week: die is daarna niet meer vrij
  r = P.rekenSleep(V, vakantie, '2026-12-07', '2026-12-14', 'een');
  assert.deepEqual([...r.zet], [['2026-12-07', '2026-12-14']]);
  assert.deepEqual(r.vrij, ['2026-12-21']);

  // tikken: week vrij, alles vanaf daar één plek op (over de vakantie heen)
  r = P.rekenVrij(V, vakantie, '2026-12-07');
  assert.equal(r.wordtVrij, true);
  assert.deepEqual([...r.zet], [['2026-12-07', '2026-12-28'], ['2026-12-28', '2027-01-04']]);
  assert.deepEqual(r.vrij, ['2026-12-07', '2026-12-14', '2026-12-21']);
  // en terugzetten: alles erna één plek terug
  const N = reeks([['2026-11-30', 10], ['2026-12-28', 11], ['2027-01-04', 12]]);
  r = P.rekenVrij(N, ['2026-12-07', '2026-12-14', '2026-12-21'], '2026-12-07');
  assert.equal(r.wordtVrij, false);
  assert.deepEqual([...r.zet], [['2026-12-28', '2026-12-07'], ['2027-01-04', '2026-12-28']]);
  assert.deepEqual(r.vrij, ['2026-12-14', '2026-12-21']);

  // de strook: drie lege weken ervoor, twee erna, elke week met trainingen is op te pakken
  const metPlan = R.map(t => ({ ...t, teams: ['a'], plan: { id: 'p1', naam: 'Blok 2', zichtbaar: 'vr', vrij: [] } }));
  const html = P.htmlPlannen(metPlan, [{ id: 'a', naam: 'O10-1' }]);
  assert.equal((html.match(/class="bp-wk /g) || []).length, 3 + 3 + 2);
  assert.equal((html.match(/data-bp-pak/g) || []).length, 3);
  assert.match(html, /data-bp-m="2026-11-02"/);
  assert.match(html, /wk 48 t\/m 50/);
  assert.doesNotMatch(html, / disabled/, 'lege weken zijn een plek om naartoe te slepen, dus niet uitgeschakeld');
}
console.log('trainingplan: alles groen');
