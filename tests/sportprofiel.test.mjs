/* Sportprofiel (stap 1): voetbal staat in sport-voetbal.js; config.js maakt er losse kopieën van.
   Bewaakt dat het profiel bevroren blijft, dat config.js dezelfde waarden geeft en dat
   aanpassen door clubconfig.js (in plaats) het profiel niet raakt. */
import assert from 'node:assert/strict';
/* zelfde specifier als config.js, anders laadt Node een tweede exemplaar */
const { sportProfiel, STANDAARD_SPORT, SPORTEN } = await import('../public/js/sporten.js?v=20261124a');
const VOETBAL = SPORTEN.voetbal;
const C = await import('../public/js/config.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

ok(STANDAARD_SPORT === 'voetbal', 'standaard is voetbal');
ok(sportProfiel() === VOETBAL && sportProfiel('') === VOETBAL && sportProfiel('onbekend') === VOETBAL, 'leeg of onbekend geeft voetbal');
ok(sportProfiel('voetbal') === VOETBAL && Object.isFrozen(SPORTEN), 'register');
const diepBevroren = o => !o || typeof o !== 'object' || (Object.isFrozen(o) && Object.values(o).every(diepBevroren));
ok(diepBevroren(VOETBAL), 'profiel is diep bevroren');

const paren = [['CATEGORIEEN', 'categorieen'], ['CATEGORIEEN_MEIDEN', 'categorieenMeiden'], ['FORMATIES', 'formaties'],
  ['LIJN_NAAM', 'lijnNaam'], ['POSITIE_GROEPEN', 'positieGroepen'], ['KNVB_KALENDER', 'kalender'], ['LEERCURVE', 'leercurve'],
  ['DOEL_SUGGESTIES_BANDEN', 'doelSuggesties']];
for (const [exp, key] of paren){
  assert.deepEqual(C[exp], VOETBAL[key]); n++;
  ok(C[exp] !== VOETBAL[key] && !Object.isFrozen(C[exp]), `${exp} is een losse, aanpasbare kopie`);
}
ok(C.KNVB_SEIZOEN === VOETBAL.kalenderSeizoen && C.CLUB_FORMATIE_11 === VOETBAL.formatie11, 'losse waarden');
assert.deepEqual({ ...C.ACTIEF_STANDAARD.tijdstraf }, { ...VOETBAL.tijdstraf }); n++;
assert.deepEqual({ ...C.ACTIEF_STANDAARD.bouwGrenzen }, { ...VOETBAL.bouwGrenzen }); n++;

/* Aanpassen zoals clubconfig.js doet raakt het profiel niet */
C.CATEGORIEEN.JO11.duur = 99; C.LEERCURVE.length = 0;
ok(VOETBAL.categorieen.JO11.duur === 15 && VOETBAL.leercurve.length === 14, 'profiel blijft ongewijzigd');
console.log(`sportprofiel: ${n} controles geslaagd`);
