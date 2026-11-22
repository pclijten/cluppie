// Jaaroverzicht per team en per speler: rekenregels en teksten.
// Draaien: node tests/jaaroverzicht.test.mjs
import assert from 'node:assert/strict';
import { nl, gemiddelde, balans, eerlijkheid, eerlijkTekst, ontwikkeling, teamOverzicht, teamRegels, deelTekstTeam, spelerOverzicht, spelerRegels } from '../public/js/jaaroverzicht-logica.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const gelijk = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

/* hulpjes */
ok(nl(2.5) === '2,5' && nl(3) === '3', 'komma als decimaalteken');
ok(gemiddelde([80, 90, 100]) === 90 && gemiddelde([]) === null && gemiddelde(null) === null && gemiddelde(['x', 50]) === 50, 'gemiddelde, ook bij lege of vervuilde invoer');

/* balans */
gelijk(balans([{ voor: 3, tegen: 1 }, { voor: 2, tegen: 2 }, { voor: 0, tegen: 4 }, { voor: 1, tegen: 0 }]), { n: 4, gewonnen: 2, gelijk: 1, verloren: 1, voor: 6, tegen: 7 }, 'gewonnen, gelijk, verloren en doelpunten');
gelijk(balans([]), { n: 0, gewonnen: 0, gelijk: 0, verloren: 0, voor: 0, tegen: 0 }, 'geen wedstrijden');
gelijk(balans([{}, null]).gelijk, 2, 'wedstrijd zonder doelpunten telt als 0-0');

/* eerlijke speeltijd */
ok(eerlijkheid([50, 60]) === null && eerlijkheid([]) === null && eerlijkheid([0, 0, 0]) === null, 'minder dan drie spelers of geen speeltijd: geen oordeel');
const gelijkVerdeeld = eerlijkheid([60, 60, 60, 60]);
ok(gelijkVerdeeld.score === 100 && gelijkVerdeeld.laagste === 60 && gelijkVerdeeld.hoogste === 60 && gelijkVerdeeld.spelers === 4, 'iedereen even veel: 100');
const scheef = eerlijkheid([20, 50, 90, 95]);
ok(scheef.score < 70 && scheef.laagste === 20 && scheef.hoogste === 95, 'ongelijk verdeeld: lage score, laagste en hoogste aandeel');
ok(eerlijkheid([10, 200, 5]).score >= 0, 'score nooit onder nul');
ok(/ongeveer even veel/.test(eerlijkTekst(gelijkVerdeeld)) && /ongelijk/.test(eerlijkTekst(scheef)) && eerlijkTekst(null) === '', 'tekst past bij de score');

/* ontwikkeling */
ok(ontwikkeling([3]) === null && ontwikkeling([]) === null && ontwikkeling([0, 0]) === null, 'één meting is geen ontwikkeling');
gelijk(ontwikkeling([2.8, 3, 3.44]), { van: 2.8, naar: 3.4, verschil: 0.6, aantal: 3, richting: 'omhoog' }, 'omhoog');
ok(ontwikkeling([4, 3.5]).richting === 'omlaag' && ontwikkeling([3, 3.1]).richting === 'gelijk', 'omlaag, en een klein verschil is gelijk');

/* team */
const team = teamOverzicht({ teamNaam: 'JO11-2', clubNaam: 'VV Dorp', seizoen: "2026/'27", wedstrijden: [{ voor: 3, tegen: 1 }, { voor: 1, tegen: 1 }, { voor: 0, tegen: 2 }],
  trainingen: 24, opkomstPcts: [90, 80, 85], speeltijdPcts: [60, 62, 58, 61], spelers: 12, teamevaluaties: 3, beoordelingen: 20, beoordeeldeSpelers: 11 });
ok(team.balans.n === 3 && team.opkomst === 85 && team.eerlijk.score >= 85 && team.leeg === false, 'teamoverzicht rekent door');
const tr = teamRegels(team);
ok(tr.find(r => r.label === 'Wedstrijden').toelichting === '1 gewonnen, 1 gelijk, 1 verloren', 'regel wedstrijden');
ok(tr.find(r => r.label === 'Doelpunten').waarde === '4 voor, 4 tegen' && /1,3 voor en 1,3 tegen/.test(tr.find(r => r.label === 'Doelpunten').toelichting), 'regel doelpunten met gemiddelden');
ok(/Gemiddelde opkomst 85%/.test(tr.find(r => r.label === 'Trainingen met aanwezigheid').toelichting), 'regel trainingen');
ok(/11 van de 12 spelers/.test(tr.find(r => r.label === 'Beoordelingen van spelers').toelichting), 'regel beoordelingen');
ok(tr.some(r => r.label === 'Eerlijke speeltijd'), 'regel eerlijke speeltijd');
const tekst = deelTekstTeam(team);
ok(tekst.startsWith("Jaaroverzicht JO11-2 (VV Dorp), seizoen 2026/'27") && /3 wedstrijden: 1 gewonnen/.test(tekst) && /24 trainingen met aanwezigheid, gemiddelde opkomst 85%/.test(tekst) && tekst.endsWith('Bijgehouden in Cluppie.'), 'deeltekst van het team');
ok(!/[—–]/.test(tekst + JSON.stringify(tr)), 'geen gedachtestreepjes');

const leeg = teamOverzicht({ teamNaam: 'JO9-1', seizoen: "2026/'27", spelers: 8 });
ok(leeg.leeg === true && leeg.opkomst === null && leeg.eerlijk === null, 'leeg seizoen');
const lr = teamRegels(leeg);
ok(!lr.some(r => r.label === 'Doelpunten' || r.label === 'Eerlijke speeltijd') && /Nog geen wedstrijden/.test(lr[0].toelichting) && /Nog geen aanwezigheid/.test(lr[1].toelichting), 'leeg seizoen: geen regels zonder cijfers');
ok(deelTekstTeam(leeg).split('\n').length === 2, 'deeltekst van een leeg seizoen: alleen kop en afzender');
ok(teamOverzicht().leeg === true && teamRegels(teamOverzicht()).length >= 5, 'zonder invoer geen fout');
ok(/1 wedstrijd:/.test(deelTekstTeam(teamOverzicht({ wedstrijden: [{ voor: 1, tegen: 0 }] }))), 'enkelvoud');

/* speler */
const sp = spelerOverzicht({ naam: 'Mila', teamNaam: 'JO11-2', seizoen: "2026/'27", wedstrijden: 10, minuten: 312.4, pctSpeeltijd: 61.6,
  opkomst: { aanwezig: 20, totaal: 24, pct: 83 }, goals: 4, assists: 2, keeper: 1, reeks: [2.5, 3, 3.5] });
ok(sp.minuten === 312 && sp.pctSpeeltijd === 62 && sp.beoordelingen === 3 && sp.ontwikkeling.richting === 'omhoog' && sp.leeg === false, 'speleroverzicht rekent door');
const srg = spelerRegels(sp);
ok(/312 minuten gespeeld, 62% van de tijd/.test(srg[0].toelichting), 'regel wedstrijden');
ok(srg[1].waarde === '20 van 24' && srg[1].toelichting === 'Opkomst 83%', 'regel trainingen');
ok(srg[2].waarde === '4 en 2' && srg[2].toelichting === '1 keer gekeept', 'regel doelpunten en assists');
ok(srg[3].toelichting === 'Van 2,5 naar 3,5 op een schaal van 1 tot 5', 'regel ontwikkeling');
const nieuw = spelerOverzicht({ naam: 'Tess', reeks: [3] });
ok(nieuw.leeg === false && nieuw.pctSpeeltijd === null && /Eén beoordeling/.test(spelerRegels(nieuw)[3].toelichting) && /Nog niet gespeeld/.test(spelerRegels(nieuw)[0].toelichting), 'speler met één beoordeling');
ok(spelerOverzicht().leeg === true && spelerRegels(spelerOverzicht()).length === 4, 'zonder invoer geen fout');
/* in het overzicht van een speler staan geen velden voor notities of redenen */
ok(Object.keys(sp).every(k => !/notitie|reden|leerpunt|achternaam/i.test(k)), 'geen notities, redenen of achternaam in het overzicht');

console.log(`jaaroverzicht: ${n} controles geslaagd`);
