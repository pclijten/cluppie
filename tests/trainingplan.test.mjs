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
console.log('trainingplan: alles groen');
