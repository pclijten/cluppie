/* Sportprofiel (stap 1): voetbal staat in sport-voetbal.js; config.js maakt er losse kopieën van.
   Bewaakt dat het profiel bevroren blijft, dat config.js dezelfde waarden geeft en dat
   aanpassen door clubconfig.js (in plaats) het profiel niet raakt. */
import assert from 'node:assert/strict';
/* zelfde specifier als config.js (met ?v=), anders laadt Node een tweede exemplaar */
import fs from 'node:fs';
const spec = fs.readFileSync(new URL('../public/js/config.js', import.meta.url), 'utf8').match(/'\.\/(sporten\.js\?v=[0-9a-z]+)'/)[1];
const { sportProfiel, STANDAARD_SPORT, SPORTEN, sportVan, sportNaam, meerdereSporten, sportWoord, zetActieveSport, actieveSport } = await import('../public/js/' + spec);
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

/* [20261125x] sport van club of team: clubteam volgt de club, onbekend of leeg = voetbal */
ok(sportVan(null, null) === 'voetbal' && sportVan({}, null) === 'voetbal' && sportVan(null, {}) === 'voetbal', 'zonder veld: voetbal');
ok(sportVan({ sport: 'voetbal' }, { sport: 'curling' }) === 'voetbal', 'clubteam volgt de club');
ok(sportVan(null, { sport: 'curling' }) === 'voetbal' && sportVan({ sport: 'curling' }) === 'voetbal', 'onbekende sport: voetbal');
ok(sportNaam('voetbal') === 'Voetbal' && meerdereSporten() === false, 'naam en nog maar één sport');

/* [20261125y] stap 3: woorden uit het profiel van de actieve sport */
ok(actieveSport() === 'voetbal' && sportWoord('bond') === 'KNVB' && sportWoord('ledenbron') === 'Sportlink', 'woorden voetbal');
ok(sportWoord('keeper') === 'keeper' && sportWoord('keeper', true) === 'Keeper', 'hoofdletter');
ok(sportWoord('onbekend') === 'onbekend', 'onbekend woord blijft staan');
zetActieveSport('curling'); ok(actieveSport() === 'voetbal', 'onbekende sport: voetbal');
zetActieveSport(undefined); ok(sportWoord('bond') === 'KNVB', 'zonder sport: voetbal');

/* Aanpassen zoals clubconfig.js doet raakt het profiel niet */
C.CATEGORIEEN.JO11.duur = 99; C.LEERCURVE.length = 0;
ok(VOETBAL.categorieen.JO11.duur === 15 && VOETBAL.leercurve.length === 14, 'profiel blijft ongewijzigd');
console.log(`sportprofiel: ${n} controles geslaagd`);
