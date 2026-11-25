/* [20261126a] Sportprofiel stap 5: vaste voetbalwedstrijden en vaste opstellingen. De uitkomst is
   vastgelegd op main vóór stap 5 (tests/data/sport-wedstrijd-voetbal.json) en moet daarna precies
   gelijk blijven: speeltijd, keeperbeurten, posities, strafbank, slots en tijdstraffen.
   Draaien met de stub-loader (browsermodules in Node). Met --schrijf leg je de uitkomst opnieuw vast. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(hier, '..', 'public', 'js');
/* zelfde ?v= als de app gebruikt, anders laden we een tweede instantie van config.js */
const spec = naam => { const s = fs.readFileSync(path.join(pub, 'wedstrijd.js'), 'utf8').match(new RegExp(`'\\./(${naam}\\.js\\?v=[0-9a-z]+)'`)); return '../public/js/' + s[1]; };
const C = await import(spec('config'));
const A = await import(spec('analyse'));
const { S } = await import(spec('state'));

const klok = sec => ({ base: sec, running: false, start: 0 });
/* drie vaste wedstrijden: pupillen 8-tal (4 kwarten), junioren 11-tal (2 helften), 4-tal zonder keeper */
const W = [
  { naam: 'JO11 8-tal', w: { format: '8', formatie: '3-3-1', periodes: 4, kwartduur: 15, startBankReden: { p10: { disciplinair: true } },
    kwarten: {
      1: { lineup: { K: 'p1', V1: 'p2', V2: 'p3', V3: 'p4', M1: 'p5', M2: 'p6', M3: 'p7', A1: 'p8' }, klok: klok(900),
           events: [{ uit: 'p8', in: 'p9', slot: 'A1', sec: 420 }, { uit: 'p2', in: 'p10', slot: 'V1', sec: 600 }] },
      2: { lineup: { K: 'p9', V1: 'p10', V2: 'p3', V3: 'p4', M1: 'p5', M2: 'p6', M3: 'p7', A1: 'p8' }, klok: klok(960),
           events: [{ uit: 'p7', in: null, slot: 'M3', sec: 500, disciplinair: true }, { uit: null, in: 'p7', slot: 'M3', sec: 800 }] },
      3: { lineup: { K: 'p1', V1: 'p2', V2: 'p3', V3: 'p4', M1: 'p5', M2: 'p6', M3: 'p7', A1: 'p8' }, klok: klok(0), events: [], correcties: { p11: 300 } },
      4: { lineup: {}, klok: klok(0), events: [] } } } },
  { naam: 'JO15 11-tal', w: { format: '11', formatie: '4-3-3', periodes: 2, kwartduur: 35,
    kwarten: {
      1: { lineup: { K: 'k1', V1: 'a', V2: 'b', V3: 'c', V4: 'd', M1: 'e', M2: 'f', M3: 'g', A1: 'h', A2: 'i', A3: 'j' }, klok: klok(2220),
           events: [{ uit: 'j', in: 'l', slot: 'A3', sec: 1200 }, { uit: 'k1', in: 'k2', slot: 'K', sec: 1800 }] },
      2: { formatie: '4-4-2', lineup: { K: 'k2', V1: 'a', V2: 'b', V3: 'c', V4: 'd', M1: 'e', M2: 'f', M3: 'g', M4: 'l', A1: 'h', A2: 'i' }, klok: klok(2100),
           events: [{ uit: 'h', in: 'j', slot: 'A1', sec: 2500 }, { uit: 'q', in: 'h', slot: 'A1', sec: 2600 }] } } } },
  { naam: 'JO7 4-tal', w: { format: '4', formatie: '1-2-1', periodes: 4, kwartduur: 10,
    kwarten: {
      1: { lineup: { V1: 'x1', M1: 'x2', M2: 'x3', A1: 'x4' }, klok: klok(600), events: [{ uit: 'x4', in: 'x5', slot: 'A1', sec: 300 }] },
      2: { lineup: { V1: 'x5', M1: 'x2', M2: 'x3', A1: 'x4' }, klok: klok(610), events: [] } } } },
];
const setNaarLijst = o => JSON.parse(JSON.stringify(o, (k, v) => v instanceof Set ? [...v].sort() : v));

const uitkomst = { wedstrijden: {}, slots: {}, veldspelers: {}, formaties: {}, tijdstraf: {} };
for (const { naam, w } of W){
  uitkomst.wedstrijden[naam] = setNaarLijst({
    analyse: A.analyseWedstrijd(w), disciplinair: A.disciplinaireTijd(w), telaat: A.telaatTijd(w),
    kwarten: Object.fromEntries(Object.entries(w.kwarten).map(([nr, k]) => [nr, { a: A.analyseKwart(w, k), lineup: A.effectieveLineup(k) }])),
  });
}
for (const [format, f] of Object.entries(C.FORMATIES)){
  uitkomst.veldspelers[format] = C.aantalVeldspelers(format);
  for (const naam of Object.keys(f)) uitkomst.slots[format + '|' + naam] = C.bouwSlots(format, naam);
  uitkomst.slots[format + '|onbekend'] = C.bouwSlots(format, 'zzz');
}
for (const [format, naam] of [['11', '4-2-3-1'], ['11', '3-5-2'], ['8', '2-3-2'], ['4', '2-1-1'], ['6', '2-2-1'], ['9', '3-3-2'], ['11', '4-4-3'], ['4', '1-1-1']])
  uitkomst.formaties[format + '|' + naam] = C.parseFormatie(naam, format);
for (const cat of ['JO7', 'JO11', 'JO13', 'JO15', 'JO16', 'JO19', 'MO13', 'MO17', 'Senioren', 'Vrouwen', '']){
  S.team = { categorie: cat }; uitkomst.tijdstraf[cat || 'leeg'] = C.tijdstrafSec();
}
S.team = null;

const bestand = path.join(hier, 'data', 'sport-wedstrijd-voetbal.json');
if (process.argv.includes('--schrijf')){ fs.writeFileSync(bestand, JSON.stringify(uitkomst, null, 1) + '\n'); console.log('vastgelegd'); }
else {
  const vast = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  let n = 0;
  for (const deel of Object.keys(vast)) for (const k of Object.keys(vast[deel])){ assert.deepEqual(uitkomst[deel][k], vast[deel][k], `${deel} ${k}`); n++; }
  assert.deepEqual(Object.keys(uitkomst.slots).sort(), Object.keys(vast.slots).sort()); n++;
  console.log(`sport-wedstrijd: ${n} vaste uitkomsten gelijk`);
}
