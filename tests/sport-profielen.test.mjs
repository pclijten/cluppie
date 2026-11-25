/* [20261126c] De vier sportprofielen (voetbal, hockey, volleybal, korfbal): volledig en consistent, en sport
   wisselen in config.js (laadSportStandaard) brengt voetbal daarna precies terug. Met de stub-loader. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const spec = fs.readFileSync(new URL('../public/js/config.js', import.meta.url), 'utf8').match(/'\.\/(sporten\.js\?v=[0-9a-z]+)'/)[1];
const SP = await import('../public/js/' + spec);
const C = await import('../public/js/config.js');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const SLEUTELS = ['id', 'naam', 'icoon', 'open', 'inhoud', 'ledenbron', 'veld', 'wedstrijd', 'woorden', 'tijdstraf', 'bouwGrenzen', 'categorieen',
  'categorieenMeiden', 'formaties', 'lijnNaam', 'zoneNaam', 'positieGroepen', 'kalenderSeizoen', 'kalender', 'leercurve', 'formatie11', 'doelSuggesties'];
const diepBevroren = o => !o || typeof o !== 'object' || (Object.isFrozen(o) && Object.values(o).every(diepBevroren));
ok(JSON.stringify(Object.keys(SP.SPORTEN)) === JSON.stringify(['voetbal', 'hockey', 'volleybal', 'korfbal']), 'vier sporten');
ok(SP.openSporten().map(p => p.id).join() === 'voetbal,hockey' && SP.meerdereSporten(), 'voetbal en hockey open, volleybal en korfbal pilot');

const voetbalVoor = JSON.stringify({ cat: C.CATEGORIEEN, catM: C.CATEGORIEEN_MEIDEN, f: C.FORMATIES, l: C.LIJN_NAAM, p: C.POSITIE_GROEPEN, k: C.KNVB_KALENDER,
  lc: C.LEERCURVE, d: C.DOEL_SUGGESTIES_BANDEN, s: C.KNVB_SEIZOEN, f11: C.CLUB_FORMATIE_11, ts: C.ACTIEF.tijdstraf, bg: C.ACTIEF.bouwGrenzen });

for (const P of Object.values(SP.SPORTEN)){
  const w = P.id;
  ok(SLEUTELS.every(k => k in P), `${w}: alle onderdelen`);
  ok(diepBevroren(P), `${w}: bevroren`);
  ok(P.woorden.bond && P.woorden.ledenbron && P.wedstrijd.kaarten.length >= 2 && P.wedstrijd.kaarten.every(k => C.KAART_NAAM[k.type]), `${w}: woorden en kaarten`);
  ok(P.leercurve.length >= 10 && P.leercurve.every(l => l.thema && l.vanaf >= 6 && ['GE', 'TE', 'TA'].includes(l.domein)), `${w}: leercurve`);
  ok(P.doelSuggesties.map(b => b.tot).join() === '9,12,15,99' && P.doelSuggesties.every(b => b.teksten.length === 4), `${w}: doelsuggesties`);
  ok(P.veld.lengte > P.veld.breedte && Array.isArray(P.veld.bord.dwars), `${w}: veld`);
  /* in die sport: elke categorie heeft een spelvorm met formaties en het juiste aantal veldspelers */
  SP.zetActieveSport(w); C.laadSportStandaard(w);
  for (const [cat, c] of Object.entries({ ...P.categorieen, ...P.categorieenMeiden })){
    ok(/^[JM]O\d+$|^(Senioren|Vrouwen)$/.test(cat) && c.periodes >= 2 && c.duur > 0 && c.knvb, `${w} ${cat}: categorie`);
    const f = C.FORMATIES[c.format];
    ok(f && Object.keys(f).length, `${w} ${cat}: formaties voor ${c.format}`);
    for (const [naam, punten] of Object.entries(f)){
      ok(punten.length === C.aantalVeldspelers(c.format), `${w} ${c.format} ${naam}: aantal veldspelers`);
      const slots = C.bouwSlots(c.format, naam);
      ok(slots.length === Number(c.format) && slots.some(s => s.id === 'K') === !SP.zonderKeeper(c.format), `${w} ${c.format} ${naam}: slots en keeper`);
      ok(slots.every(s => C.slotPositieNaam(c.format, naam, s.id)), `${w} ${c.format} ${naam}: positienamen`);
    }
  }
  ok(JSON.stringify(C.LEERCURVE) === JSON.stringify(P.leercurve) && C.KNVB_SEIZOEN === P.kalenderSeizoen, `${w}: config volgt de sport`);
  ok(C.periodeNaam({ periodes: 4 }) === (w === 'volleybal' ? 'Set' : 'Kwart'), `${w}: periodenaam`);
}
/* terug naar voetbal: alles precies zoals bij het laden */
SP.zetActieveSport('voetbal'); C.laadSportStandaard('voetbal');
ok(JSON.stringify({ cat: C.CATEGORIEEN, catM: C.CATEGORIEEN_MEIDEN, f: C.FORMATIES, l: C.LIJN_NAAM, p: C.POSITIE_GROEPEN, k: C.KNVB_KALENDER,
  lc: C.LEERCURVE, d: C.DOEL_SUGGESTIES_BANDEN, s: C.KNVB_SEIZOEN, f11: C.CLUB_FORMATIE_11, ts: C.ACTIEF.tijdstraf, bg: C.ACTIEF.bouwGrenzen }) === voetbalVoor, 'voetbal na wisselen gelijk');
ok(SP.heeftSportlink() && SP.sportInhoud(), 'voetbal: Sportlink en eigen inhoud');
SP.zetActieveSport('hockey'); ok(!SP.heeftSportlink() && !SP.sportInhoud() && SP.sportWoord('bond') === 'KNHB' && SP.kaartDef('groen').duur === 120, 'hockey: LISA, pilot zonder inhoud, groene kaart');
SP.zetActieveSport('voetbal');
console.log(`sport-profielen: ${n} controles geslaagd`);
