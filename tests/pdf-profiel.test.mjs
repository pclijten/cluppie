// PDF-profiel per club [20261114a].  Draaien: node --import ./tests/hulp/stub-loader.mjs tests/pdf-profiel.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as C from '../public/js/pdf-profiel.js';
import { herkenNaam, isBlokUpload } from '../public/js/training-plan.js';
import { diagramVoorOefening } from '../public/js/training-weergave.js';
const require = createRequire(import.meta.url);
const SV = require('../functions/pdf-profiel.js');

/* client en server zijn gelijk */
assert.deepEqual({ ...C.STANDAARD }, { ...SV.STANDAARD });
for (const p of [null, {}, { indeling: 'geheel', plaatjes: 'pagina', naam: 'geen', overslaanEerste: true, overslaanWoorden: 'Legenda, In, Inhoud', aanwijzing: 'x'.repeat(900) },
  { indeling: 'raar', plaatjes: 1, overslaanWoorden: ['a', 'Legenda', 'Legenda'] }])
  assert.deepEqual(C.schoonProfiel(p), SV.schoonProfiel(p), JSON.stringify(p));
for (const club of [{}, { platformModules: { pdfOmzetten: true } }, { platformModules: { pdfOmzetten: true, pdfLimiet: '7' } }, { platformModules: { pdfOmzetten: false } }])
  for (const ai of [{ aan: false, limiet: null }, { aan: true, limiet: 100 }])
    assert.deepEqual(C.pdfBeleid(club, ai), SV.pdfBeleid(club, ai));

/* standaard = gedrag van vóór deze release */
assert.deepEqual(C.schoonProfiel(null), { ...C.STANDAARD, overslaanWoorden: [] });
assert.ok(C.isStandaard(null) && C.isStandaard({}));
assert.equal(SV.profielPrompt(null), '', 'standaardprofiel geeft geen extra prompt');
assert.match(SV.profielPrompt({ indeling: 'geheel' }), /HELE training/);
assert.match(SV.profielPrompt({ aanwijzing: 'Kop Organisatie = Benodigdheden' }), /Organisatie/);
assert.equal(C.schoonProfiel({ aanwijzing: 'x'.repeat(900) }).aanwijzing.length, C.AANWIJZING_MAX);
assert.deepEqual(C.schoonProfiel({ overslaanWoorden: 'Legenda, In , Inhoud,Legenda' }).overslaanWoorden, ['Legenda', 'Inhoud'], 'korte woorden en dubbelen eruit');

/* beleid: AI aan → via AI; anders alleen met pdfOmzetten, limiet standaard 40 */
assert.deepEqual(C.pdfBeleid({}, { aan: true, limiet: 5 }), { aan: true, viaAI: true, limiet: 5 });
assert.equal(C.pdfBeleid({}, { aan: false }).aan, false, 'zonder AI en zonder schakelaar: uit');
assert.deepEqual(C.pdfBeleid({ platformModules: { pdfOmzetten: true } }, { aan: false }), { aan: true, viaAI: false, limiet: 40 });
assert.equal(C.pdfBeleid({ platformModules: { pdfOmzetten: true, pdfLimiet: 0 } }, { aan: false }).limiet, 0);

/* overslaan */
const pg = [{ pagina: 1, tekst: 'Voorblad\nSeizoen 26/27' }, { pagina: 2, tekst: 'Rondo 4 tegen 1\nDoel\nPassen' }, { pagina: 3, tekst: 'LEGENDA\npionnen' }];
assert.deepEqual([...C.overTeSlaan(pg, null)], [], 'standaard slaat niets over');
assert.deepEqual([...C.overTeSlaan(pg, { overslaanEerste: true, overslaanWoorden: ['Legenda'] })], [1, 3]);
assert.deepEqual([...C.overTeSlaan([pg[2]], { overslaanWoorden: ['Legenda'] })], [], 'nooit alle pagina’s');

/* plaatjes koppelen */
const oef = [{ diagramPagina: 1 }, { diagramPagina: 1 }, { diagramPagina: 2 }];
assert.deepEqual(C.koppelDiagrammen({ 1: 'a', 2: 'b' }, oef, null), { 1: 'a', 2: 'b' }, 'standaard: ongewijzigd');
const pp = C.koppelDiagrammen({ 1: 'p1', 2: 'p2' }, oef, { plaatjes: 'pagina' });
assert.deepEqual(pp, { _perOefening: true, 1: 'p1', 3: 'p2' }, 'eerste oefening van elke pagina krijgt het paginaplaatje');
assert.equal(diagramVoorOefening(2, pp), null, 'tweede oefening van pagina 1: geen plaatje, niet opgeschoven');
assert.equal(diagramVoorOefening(3, pp), 'p2');
assert.equal(diagramVoorOefening(1, { 2: 'x', 3: 'y' }), 'x', 'oude koppeling op volgorde blijft');

/* bestandsnamen */
assert.equal(herkenNaam('Blok 2 - Week 1 - Training 1.pdf').week, 1);
assert.equal(herkenNaam('Blok 2 - Week 1 - Training 1.pdf', { naam: 'geen' }), null);
assert.deepEqual(herkenNaam('Blok 2 - Overzicht.pdf', { naam: 'geen' }), { overzicht: true });
const f = n => ({ name: n, type: 'application/pdf' });
assert.equal(isBlokUpload([f('Week 1 - Training 1.pdf'), f('Week 2 - Training 1.pdf')]), true);
assert.equal(isBlokUpload([f('Week 1 - Training 1.pdf'), f('Week 2 - Training 1.pdf')], { naam: 'geen' }), false);

console.log('pdf-profiel: alle controles geslaagd');
