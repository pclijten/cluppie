// Tv-sjablonen: elk sjabloon uit de lijst laadt, levert alle onderdelen en overleeft een lege dag en rare namen.
// Draaien: node tests/tv-sjablonen.test.mjs
import { SJABLONEN, sjabloonId, laadSjabloon } from '../public/js/tv-sjablonen.js';
import { tvModel, diaReeks, proefProgramma, PROEF_DIAS } from '../public/js/tv-speler.js';
let n = 0, mis = 0;
const ok = (v, wat) => { n++; if (!v){ mis++; console.log('MIS: ' + wat); } };

const nu = new Date(2026, 10, 28, 10, 15), vies = '<img src=x onerror=alert(1)>';
const vol = tvModel({ clubNaam: 'SV Cluppie', kleur: '#f2c500', mededeling: vies, programma: proefProgramma(nu, 0) }, PROEF_DIAS, nu);
const leeg = tvModel({}, [], nu);
const raar = tvModel({ clubNaam: vies, programma: [{ tijd: '10:00', thuis: true, a: vies, b: vies, veld: vies, kk: vies, stand: '1 - 0', bezig: true }] },
  [{ soort: 'sponsor', pakket: 'hoofd', titel: vies, tekst: vies, img: '' }], nu);
const g = { team: vies, a: vies, b: 'B', stand: '1–0', veld: vies, thuis: true, eigen: true };

ok(vol.live.length === 2 && vol.klaar.length === 2 && vol.straks.length === 2 && vol.rijen.find(r => r.afgelast).status === 'af', 'model: wedstrijden per status');
ok(vol.rijen[2].score === '1–0' && vol.rijen[1].eigen === 'JO9-2' && vol.rijen[1].tegen === 'Schinveld JO9-1' && vol.top.a === 'JO15-1', 'model: score, eigen team en eerstvolgende thuiswedstrijd');
ok(tvModel({ uit: false, programma: proefProgramma(nu, 0) }, [], nu).rijen.every(r => r.thuis), 'model: zonder uitwedstrijden');
ok(leeg.kleur === '#c8102e' && leeg.rijen.length === 0 && leeg.top === null, 'model: lege tv');
const reeks = diaReeks(vol, 3);
ok(reeks.filter(d => d.soort === 'programma').length >= 2 && reeks.some(d => d.soort === 'uitslagen') && reeks.filter(d => d.soort === 'dia').length === 4, 'reeks: pagina\'s, uitslagen en alle dia\'s');
ok(reeks.every((d, i) => i < 2 || !(d.soort === 'dia' && reeks[i - 1].soort === 'dia' && reeks[i - 2].soort === 'dia')), 'reeks: nooit meer dan twee dia\'s achter elkaar');
ok(diaReeks(leeg).length === 1 && diaReeks(leeg)[0].soort === 'programma', 'reeks: lege dag geeft alleen het programma');
ok(sjabloonId('kubus') === 'kubus' && sjabloonId('bestaat-niet') === 'bord' && sjabloonId(undefined) === 'bord', 'onbekend sjabloon valt terug op het bord');
ok(new Set(SJABLONEN.map(s => s.id)).size === SJABLONEN.length && SJABLONEN.every(s => /^[a-z0-9-]{1,30}$/.test(s.id) && s.naam && s.kort), 'lijst: unieke ids met naam en omschrijving');

for (const s of SJABLONEN.filter(s => s.id !== 'bord')){
  let T; try { T = await laadSjabloon(s.id); } catch (e){ ok(false, `${s.id}: laadt niet (${e.message})`); continue; }
  ok(T.id === s.id && typeof T.css === 'string' && ['kader', 'programma', 'uitslagen', 'dia', 'goal'].every(k => typeof T[k] === 'function'), `${s.id}: levert alle onderdelen`);
  for (const [naam, m] of [['vol', vol], ['leeg', leeg], ['raar', raar]]){
    try {
      const delen = [T.kader(m), ...diaReeks(m, T.per || 6).map(d => d.soort === 'programma' ? T.programma(m, m.rijen.slice(d.van, d.tot), d.pag) : d.soort === 'uitslagen' ? T.uitslagen(m) : T.dia(m, d.x)), T.goal(m, g), T.fx ? T.fx() : ''];
      ok(delen.every(h => typeof h === 'string') && !delen.join('').includes('<img src=x') && !/undefined|\[object|NaN/.test(delen.join('')), `${s.id} (${naam}): nette html zonder lekken`);
    } catch (e){ ok(false, `${s.id} (${naam}): fout ${e.message}`); }
  }
  ok(T.css.includes(`.ts-${s.id}`) && !/@import|url\(\s*['"]?https?:/.test(T.css), `${s.id}: css hoort bij dit sjabloon en haalt niets van buiten`);
}
console.log(mis ? `tv-sjablonen: ${mis} van ${n} MIS` : `tv-sjablonen: ${n} controles geslaagd`);
process.exit(mis ? 1 : 0);
