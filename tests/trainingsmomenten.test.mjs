// Trainingsmomenten per team (dag + begin- en eindtijd) en de coördinator-weekplanning.
// Draaien: node --no-warnings --import ./tests/hulp/stub-loader.mjs tests/trainingsmomenten.test.mjs
import assert from 'node:assert/strict';
const dir = new URL('../public/js/', import.meta.url);
const M = await import(new URL('trainingsmomenten.js', dir));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('OK   ' + m); };

// momentenVanTeam
const mt = M.momentenVanTeam({ trainingsmomenten: [{ dag: 4, start: '18:30', eind: '19:45' }, { dag: 1, start: '18:00', eind: '19:15' }], trainingsdagen: [1, 4] });
ok(mt.length === 2 && mt[0].dag === 1 && mt[1].dag === 4, 'momenten staan oplopend op dag');
const oud = M.momentenVanTeam({ trainingsdagen: [3, 1, 3] });
ok(oud.length === 2 && oud[0].dag === 1 && oud[1].dag === 3 && oud.every(m => m.start === '' && m.eind === ''), 'team met alleen dagen: unieke dagen zonder tijd');
ok(M.momentenVanTeam({}).length === 0 && M.momentenVanTeam(null).length === 0, 'geen gegevens: lege lijst');
const vies = M.momentenVanTeam({ trainingsmomenten: [{ dag: 9, start: '18:00', eind: '19:00' }, { dag: 2, start: '25:00', eind: 'x' }] });
ok(vies.length === 1 && vies[0].dag === 2 && vies[0].start === '' && vies[0].eind === '', 'ongeldige dag valt weg, ongeldige tijd wordt leeg');

// tijdTekst
ok(M.tijdTekst({ start: '18:30', eind: '19:45' }) === '18:30–19:45', 'tijdtekst met begin en eind');
ok(M.tijdTekst({ start: '18:30', eind: '' }) === '18:30', 'tijdtekst alleen begin');
ok(M.tijdTekst({ start: '', eind: '' }) === '', 'tijdtekst leeg zonder tijden');

// valideerMomenten
ok(M.valideerMomenten([{ dag: 1, start: '18:00', eind: '19:15' }, { dag: 3, start: '18:30', eind: '19:45' }]) === null, 'geldige lijst');
ok(/twee keer/.test(M.valideerMomenten([{ dag: 1, start: '18:00', eind: '19:00' }, { dag: 1, start: '20:00', eind: '21:00' }])), 'dezelfde dag twee keer wordt geweigerd');
ok(/begintijd/.test(M.valideerMomenten([{ dag: 2, start: '', eind: '19:00' }])), 'begintijd verplicht');
ok(/eindtijd/.test(M.valideerMomenten([{ dag: 2, start: '18:00', eind: '' }])), 'eindtijd verplicht');
ok(/na de begintijd/.test(M.valideerMomenten([{ dag: 2, start: '19:00', eind: '18:00' }])), 'eindtijd moet na begintijd liggen');
ok(/na de begintijd/.test(M.valideerMomenten([{ dag: 2, start: '18:00', eind: '18:00' }])), 'gelijke begin- en eindtijd wordt geweigerd');
ok(M.valideerMomenten([]) === null, 'geen momenten is toegestaan');

// html-kaart tekent per moment een rij
const html = M.htmlMomentenKaart({ id: 't1', trainingsmomenten: [{ dag: 1, start: '18:00', eind: '19:15' }] });
ok(html.includes('data-tmo-rij="0"') && html.includes('value="18:00"') && html.includes('Trainingsmomenten'), 'kaart toont het moment');
console.log(`\n${n} controles geslaagd`);
