/* [20261115c] Bestaande trainingen naar de nieuwe opbouw: zelfde vorm, minuten in blokken van 5, 7 velden. */
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { naarNieuweOpbouw, rondBlok, oefeningVan, bronVanOefening } from '../public/js/seizoensplan-club.js';
import { bouwOnderdeel } from '../public/js/trainingsplanner.js';
const V = BIBLIOTHEEK.vormen, fouten = [], ok = (c, m) => { if (!c) fouten.push(m); };
ok(rondBlok(14, 'kern1') === 15 && rondBlok(12, 'warming-up') === 10 && rondBlok(8, 'kern1') === 10 && rondBlok(3, 'afsluiting') === 3, 'rondBlok');
/* een oude oefening zoals die in Firestore staat: koppen van vóór 20261115 */
const v = V.find(x => x.id === 'pos-4v2');
const oud = { titel: v.naam, blokken: [{ kop: 'Tijd en groepen', type: 'tekst', tekst: '14 minuten · Kernvorm 1 · 2 groepen' }, { kop: 'Uitleg', type: 'tekst', tekst: 'oud' }], svg: '<svg/>' };
const n = naarNieuweOpbouw(oud, V, '');
ok(n.bron?.vormId === v.id, 'vorm herkend');
ok(n.bron?.minuten === 15, 'minuten afgerond: ' + n.bron?.minuten);
ok(n.titel === v.naam, 'zelfde vorm');
const velden = new Set(n.blokken.map(b => b.veld));
for (const k of ['doel', 'tijd', 'mat', 'uitleg', 'diff', 'coach', 'spel']) ok(velden.has(k), 'veld ' + k);
ok(/^15 minuten/.test(n.blokken.find(b => b.kop === 'Tijdbestek').tekst), 'tijdbestek tekst');
ok(bronVanOefening({ titel: n.titel, blokken: n.blokken }, V)?.minuten === 15, 'nieuwe koppen blijven herkenbaar');
/* zonder herkenbare vorm (geüploade PDF): onveranderd */
const pdf = { titel: 'Eigen oefening van de club', blokken: [{ kop: 'Uitleg', type: 'tekst', tekst: 'x' }] };
ok(naarNieuweOpbouw(pdf, V) === pdf, 'onbekende oefening blijft');
/* nieuw gemaakte oefening heeft de 7 velden */
const od = { ...bouwOnderdeel(V.find(x => x.id === 'pt-m-ster'), { slot: 'warming-up', minuten: 10 }, { N: 8 }), slotNaam: 'Warming-up' };
ok(oefeningVan(od).blokken.some(b => b.veld === 'spel'), 'oefeningVan met spelvormen');
if (fouten.length){ console.log('FOUTEN:'); fouten.forEach(f => console.log(' ✗', f)); process.exit(1); }
console.log('nieuwe opbouw: oude trainingen worden goed omgezet');
