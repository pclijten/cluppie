import assert from 'node:assert/strict';
import * as C from '../public/js/coachmodel-logica.js';

let n = 0; const t = (f) => { f(); n++; };
const alleB = Object.fromEntries(C.DIM_IDS.flatMap(id => [[id + 'a', 'B'], [id + 'b', 'B']]));
const alleA = Object.fromEntries(C.DIM_IDS.flatMap(id => [[id + 'a', 'A'], [id + 'b', 'A']]));

t(() => {
  assert.equal(C.VRAGEN.length, 13);
  assert.equal(new Set(C.VRAGEN.map(q => q.id)).size, 13);
  for (const d of C.DIMS) assert.equal(C.SITUATIES[d.id].length, 2);
});
t(() => {
  assert.equal(C.schoonAntwoord('c1a', 'B'), 'B');
  assert.equal(C.schoonAntwoord('c1a', 'x'), undefined);
  assert.equal(C.schoonAntwoord('zz', 'A'), undefined);
  assert.deepEqual(C.schoonAntwoord('wd', ['plezier', 'leren', 'winnen', 'saam', 'foutief']), ['plezier', 'leren', 'winnen']);
  assert.deepEqual(C.voortgang({ c1a: 'A', wd: [] }), { gedaan: 1, totaal: 13 });
});
t(() => {
  const s = C.standenVan({ c1a: 'B', c1b: 'B', c2a: 'A', c2b: 'B', c3a: '?' });
  assert.equal(s.c1.stand, -2); assert.equal(s.c2.stand, 0); assert.equal(s.c3.n, 0); assert.equal(s.c4.stand, null);
  assert.equal(C.statusVan(-2), 'duidelijk'); assert.equal(C.statusVan(1), 'neigt'); assert.equal(C.statusVan(0), 'open'); assert.equal(C.statusVan(null), 'open');
  const zin = C.schetsZin({ c1: -2, c2: -2, c3: -1, c4: 0, c5: null, c6: 0 });
  assert.equal(zin, 'We bepalen samen, vragen stellen en laten lopen.');
  assert.equal(C.schetsZin({}), '');
});
/* ontdekpad: schets, niet bevestigd tot de trainer het zegt */
t(() => {
  let m = C.metAntwoorden(null, alleB);
  assert.ok(C.DIM_IDS.every(id => m.onderdelen[id].bevestigd === false));
  assert.equal(C.bevestigdStand(m, 'c3'), null);
  assert.equal(C.wilLatenLopen(m), false);
  m = C.bevestig(m, 'c3', { wil: 'nee' });
  assert.equal(C.bevestigdStand(m, 'c3'), -2);
  m = C.bevestig(m, 'c1', { stand: 5, wil: 'ja' });
  assert.equal(C.bevestigdStand(m, 'c1'), 2, 'schuif begrensd op +2');
  assert.equal(C.alleBevestigd(m), false);
  for (const id of C.DIM_IDS) m = C.bevestig(m, id, {});
  assert.equal(C.alleBevestigd(m), true);
  /* opnieuw invullen laat bevestigde onderdelen met rust */
  const m2 = C.metAntwoorden(m, alleA);
  assert.equal(C.bevestigdStand(m2, 'c3'), -2);
  assert.equal(C.bevestigdStand(m2, 'c1'), 2);
});
/* accent van de week en terugblik */
t(() => {
  let m = C.metAntwoorden(null, alleB);
  assert.equal(C.kiesAccent(m), null, 'niets bevestigd: geen accent');
  m = C.bevestig(m, 'c2', { wil: 'ja' });
  const a = C.kiesAccent(m);
  assert.equal(a.dim, 'c2'); assert.equal(a.richting, 'A', 'B-neiging: de proef gaat naar de andere kant');
  m = C.startAccent(m, a, 1000);
  assert.equal(m.accent.gestartMs, 1000);
  assert.equal(C.terugblikKlaar(m), false);
  assert.equal(C.schoonLog({ voelde: 'goed' }), null, 'drie tikken nodig');
  const log = { voelde: 'goed', spelers: 'positief', weer: 'ja' };
  for (let i = 0; i < 3; i++) m = C.logAccent(m, log);
  assert.equal(C.terugblikKlaar(m), false);
  m = C.logAccent(m, log);
  assert.equal(C.terugblikKlaar(m), true);
  assert.equal(C.terugblikKlaar(C.zetAccentUit(m)), false, 'uitgezet accent geen terugblik');
  const tb = C.terugblikTekst(m);
  assert.equal(tb.n, 4); assert.match(tb.voelde, /4 keer goed/);
  const ja = C.rondAccentAf(m, true);
  assert.equal(ja.accent, null);
  assert.equal(ja.onderdelen.c2.stand, -1, 'één stap naar de kant van de proef (B −2 → A: −1)');
  assert.ok(ja.afgerond.includes('c2'));
  const nee = C.rondAccentAf(m, false);
  assert.equal(nee.onderdelen.c2.stand, -2); assert.equal(nee.onderdelen.c2.wil, 'nee');
});
/* coachkaart en selectie */
t(() => {
  const vorm = { fase: 'spelvorm', duur: { ronde: 5 }, coachpunten: ['Kijk op voor je passt.', 'x', 'y'], coachvragen: ['Wat zag je?', 'z'], varianten: [{ naam: 'Met joker' }], makkelijker: ['Groter vak'] };
  let m = C.metAntwoorden(null, alleB); for (const id of C.DIM_IDS) m = C.bevestig(m, id, {});
  const kB = C.coachkaart(vorm, m).map(x => x.tekst).join(' | ');
  assert.match(kB, /Laat 5 minuten lopen/); assert.match(kB, /Vraag daarna: Wat zag je\?/); assert.match(kB, /Laat de spelers kiezen: Met joker/);
  let a = C.metAntwoorden(null, alleA); for (const id of C.DIM_IDS) a = C.bevestig(a, id, {});
  const kA = C.coachkaart(vorm, a).map(x => x.tekst).join(' | ');
  assert.match(kA, /Leg in drie zinnen uit: Kijk op voor je passt/); assert.match(kA, /Stop hooguit twee keer/);
  const neutraal = C.coachkaart(vorm, C.metAntwoorden(null, alleB));
  assert.equal(neutraal.length, 6); assert.ok(neutraal.every(x => x.tekst), 'niet bevestigd: neutrale tekst');
  assert.equal(C.coachkaart(null, m).length, 0);
  assert.equal(C.coachScore(vorm, m), 1);
  assert.equal(C.coachScore(vorm, a), 0);
  assert.equal(C.coachScore({ ...vorm, duur: { ronde: 2 } }, m), 0, 'kort onderdeel is geen doorlopend spel');
  assert.equal(C.coachScore({ ...vorm, fase: 'warming-up' }, m), 0);
  assert.equal(C.coachScore(vorm, null), 0);
});
console.log(`coachmodel: ${n} tests ok`);
