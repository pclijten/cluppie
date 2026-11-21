// [20261116l] Training aanpassen voor vandaag: aantal spelers en weer. Voor elk aantal van 6 tot 24 en elk weer
// blijft de duur gelijk, heeft elke oefening een indeling die bij het aantal past, en verspringt een vervanger niet.
import { BIBLIOTHEEK } from '../public/js/trainingsbibliotheek.js';
import { maakPlan, WEER } from '../public/js/trainingsplanner.js';
import { oefeningVan } from '../public/js/seizoensplan-club.js';
import { pasAan, schoonKeuze, isAangepast, geplandAantal, indelingTekst, tijdBijWeer, tipsVoorEigen, weerVoorstel, MIN_SPELERS, MAX_SPELERS, WEERKEUZES } from '../public/js/training-vandaag-logica.js';

const V = BIBLIOTHEEK.vormen, fouten = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fouten.push(m); };
const opId = id => V.find(v => v.id === id);

function training(categorie, spelers, duur, thema, seed){
  const p = maakPlan(V, { categorie, aantalSpelers: spelers, niveau: 2, duur, thema, blokFase: 'Verdiep', seed, recent: [] });
  const oefeningen = [...p.onderdelen.map(oefeningVan), ...(p.afsluiting ? [oefeningVan(p.afsluiting)] : [])];
  return { t: { id: 'tr-' + seed, oefeningen, thema, duur }, plan: p };
}
const minuten = oef => oef.reduce((a, o) => a + (o.bron?.minuten || 0), 0);

/* keuze opschonen */
ok(schoonKeuze({ spelers: 3 }).spelers === MIN_SPELERS && schoonKeuze({ spelers: 40 }).spelers === MAX_SPELERS, 'aantal tussen 6 en 24');
ok(schoonKeuze({ weer: 'storm' }).weer === null && schoonKeuze({ weer: 'regen' }).weer === 'regen', 'alleen bekend weer');
ok(schoonKeuze(null).spelers === null && JSON.stringify(schoonKeuze({ vervangen: { 2: 'x', a: 'y', 3: 5 } }).vervangen) === '{"2":"x"}', 'vervangen alleen index → vorm-id');
ok(!isAangepast({ spelers: 14 }, 14) && isAangepast({ spelers: 13 }, 14) && isAangepast({ spelers: 14, weer: 'koud' }, 14), 'aangepast = ander aantal of weer');
ok(WEERKEUZES.length === 4 && WEERKEUZES[0][1] === 'Gewoon', 'vier weerkeuzes');

let vervangingen = 0, groepswijzigingen = 0, plannen = 0;
for (const [cat, basisN, duur, thema] of [['JO11', 14, 75, 'Positiespel opbouw'], ['JO9', 12, 60, 'Scoren'], ['JO15', 16, 75, 'Omschakelen'], ['JO8', 10, 45, 'Technische vaardigheden'], ['MO13', 13, 75, 'Uitspelen 1:1'],
  /* [20261121a] een training met vormen die pas vanaf 7 of 8 spelers kunnen: zo blijft de test ook het vervangen raken */
  ['JO17', 18, 75, 'Aanvallen met voorzet']]){
  const themas = new Set(V.flatMap(v => v.thema));
  const th = themas.has(thema) ? thema : [...themas][0];
  const { t, plan } = training(cat, basisN, duur, th, cat + duur);
  plannen++;
  ok(geplandAantal(t.oefeningen) === basisN, `${cat}: gepland aantal ${geplandAantal(t.oefeningen)} is ${basisN}`);
  const cx = { vormen: V, categorie: cat, seed: t.id };
  /* zonder keuze, of met het geplande aantal: het plan zelf, onaangeroerd */
  const zelfde = pasAan(t, null, cx);
  ok(zelfde.kan && !zelfde.aangepast && zelfde.oefeningen === t.oefeningen && zelfde.wijzigingen.length === 0, `${cat}: zonder keuze blijft het plan`);
  ok(!pasAan(t, { spelers: basisN }, cx).aangepast, `${cat}: gepland aantal is geen aanpassing`);
  const basisMin = minuten(t.oefeningen) + plan.overgang.ontvangst + plan.overgang.tussen;

  for (let N = MIN_SPELERS; N <= MAX_SPELERS; N++) for (const weer of [null, 'koud', 'regen', 'warm']){
    const keuze = { spelers: N, weer };
    const r = pasAan(t, keuze, cx), wie = `${cat} ${N} spelers ${weer || 'gewoon'}`;
    if (N === basisN && !weer){ ok(!r.aangepast, wie + ': geen aanpassing'); continue; }
    ok(r.aangepast && r.spelers === N && r.weer === weer && r.gepland === basisN, wie + ': aangepast');
    ok(r.oefeningen.length === t.oefeningen.length, wie + ': evenveel oefeningen');
    /* de duur blijft gelijk: vormen + afsluiting + ontvangst + pauzes */
    const tijd = tijdBijWeer(duur, weer);
    const som = minuten(r.oefeningen.map((o, i) => (o.bron ? o : t.oefeningen[i]))) + tijd.overgang.ontvangst + tijd.overgang.tussen;
    ok(som === basisMin, `${wie}: duur blijft ${basisMin} (is ${som})`);
    r.oefeningen.forEach((o, i) => {
      const oud = t.oefeningen[i], v = opId(o.bron?.vormId);
      ok(v && o.titel === v.naam && Array.isArray(o.blokken) && o.blokken.some(b => b.veld === 'uitleg'), `${wie} oefening ${i + 1}: volledige oefenkaart`);
      ok(o.bron.slot === oud.bron.slot, `${wie} oefening ${i + 1}: zelfde plek in de training`);
      if (o === oud) return;
      ok(o.bron.spelers === N, `${wie} oefening ${i + 1}: de oefening is voor ${N} spelers (${o.bron.spelers})`);
      if (o.bron.vormId !== oud.bron.vormId){
        vervangingen++;
        ok(r.vervangen[i] === o.bron.vormId, `${wie} oefening ${i + 1}: vervanger is bewaard`);
        ok(N < opId(oud.bron.vormId).spelers.min, `${wie} oefening ${i + 1}: alleen vervangen als de vorm niet kan`);
        ok(N >= v.spelers.min, `${wie} oefening ${i + 1}: de vervanger kan met ${N} spelers`);
        ok(o.vandaag?.label === 'Vervangen' && /kan niet met/.test(o.vandaag.was), `${wie} oefening ${i + 1}: er staat bij waarom`);
        ok(r.oefeningen.filter(x => x.bron?.vormId === o.bron.vormId).length === 1, `${wie} oefening ${i + 1}: geen vorm twee keer`);
      } else if (o.vandaag){
        groepswijzigingen++;
        ok(['Aangepast', 'Let op'].includes(o.vandaag.label) && o.vandaag.was, `${wie} oefening ${i + 1}: label met wat het was`);
      }
    });
    ok(r.wijzigingen.every(w => w.label && w.kop && w.tekst && !/undefined|NaN/.test(w.kop + w.tekst)), wie + ': elke wijziging is een leesbare regel');
    if (weer){ ok(r.weerMelding === WEER[weer].melding, wie + ': advies bij het weer'); ok(r.wijzigingen.some(w => w.soort === 'tijd'), wie + ': het weer verandert de tijdsindeling'); }
    /* de bewaarde vervanger verspringt niet, ook niet met een ander zaadje */
    const weerOp = pasAan(t, { ...keuze, vervangen: r.vervangen }, { ...cx, seed: 'anders' });
    ok(weerOp.oefeningen.every((o, i) => o.bron?.vormId === r.oefeningen[i].bron?.vormId), wie + ': dezelfde training bij opnieuw openen');
  }
}
ok(vervangingen > 0, 'de test raakt gevallen waarin een oefening vervangen wordt (' + vervangingen + ')');
ok(groepswijzigingen > 100, 'de test raakt gevallen waarin groepen veranderen (' + groepswijzigingen + ')');

/* een training uit een eigen PDF: niets om aan te passen, wel tips */
const pdf = { id: 'pdf', oefeningen: [{ titel: 'Eigen oefening van de club', blokken: [{ kop: 'Uitleg', type: 'tekst', tekst: 'x' }] }] };
const rp = pasAan(pdf, { spelers: 11, weer: 'regen' }, { vormen: V, categorie: 'JO11' });
ok(!rp.kan && !rp.aangepast && rp.oefeningen === pdf.oefeningen && rp.eigen === 1, 'eigen PDF blijft zoals hij is');
const tips = tipsVoorEigen({ spelers: 11, weer: 'regen' }, 12);
ok(tips.length === 3 && tips[0][0] === 'Oneven aantal' && tips[2][0] === 'Regen', 'tips voor een eigen training');
ok(tipsVoorEigen({ spelers: 12 }, 12).length === 0, 'geen tips zonder aanpassing');
/* gemengd: één oefening uit de bibliotheek, één eigen */
const { t: tg } = training('JO11', 14, 75, [...new Set(V.flatMap(v => v.thema))][0], 'gemengd');
const gemengd = { ...tg, oefeningen: [tg.oefeningen[0], pdf.oefeningen[0], ...tg.oefeningen.slice(1)] };
const rg = pasAan(gemengd, { spelers: 9 }, { vormen: V, categorie: 'JO11' });
ok(rg.kan && rg.aangepast && rg.eigen === 1 && rg.oefeningen[1] === pdf.oefeningen[0], 'eigen oefening tussen de andere blijft staan');

/* indeling in woorden */
ok(indelingTekst({ groepen: 3, groepGrootte: 4, wissel: 0, _spelers: 11 }) === '3 groepen van 3 of 4', indelingTekst({ groepen: 3, groepGrootte: 4, wissel: 0, _spelers: 11 }));
ok(indelingTekst({ groepen: 1, groepGrootte: 8, wissel: 1, _spelers: 9 }) === '1 groep van 8 en 1 wissel', 'één groep met wissel');
ok(indelingTekst({ groepen: 2, groepGrootte: 6, wissel: 2, _spelers: 14 }) === '2 groepen van 6 en 2 wissels', 'twee wissels');

/* weervoorstel: grenzen */
ok(weerVoorstel({ temp: 4, gevoel: 1, mm: 0, kans: 10 }).weer === 'koud', 'koud bij gevoelstemperatuur 5 of lager');
ok(weerVoorstel({ temp: 8, gevoel: 5, mm: 0, kans: 0 }).weer === 'koud' && weerVoorstel({ temp: 8, gevoel: 6, mm: 0, kans: 0 }).weer === null, 'grens koud');
ok(weerVoorstel({ temp: 12, gevoel: 11, mm: 1.2, kans: 40 }).weer === 'regen' && weerVoorstel({ temp: 12, gevoel: 11, mm: 0.2, kans: 70 }).weer === 'regen', 'regen bij 1 mm of 70% kans');
ok(weerVoorstel({ temp: 26, gevoel: 27, mm: 0, kans: 5 }).weer === 'warm' && weerVoorstel({ temp: 24.9, gevoel: 26, mm: 0, kans: 5 }).weer === null, 'warm vanaf 25 graden');
ok(weerVoorstel({ temp: 18, gevoel: 18, mm: 3, kans: 90, code: 95 }).onweer === true, 'onweer geeft een waarschuwing');
ok(weerVoorstel({ temp: 4.4, gevoel: 1, mm: 0, kans: 10 }).tekst === '4 °C, droog' && weerVoorstel({ temp: 12, gevoel: 11, mm: 1.25 }).tekst === '12 °C, 1,3 mm regen', 'tekst van het weerbericht');
ok(weerVoorstel(null) === null && weerVoorstel({}) === null, 'zonder gegevens geen voorstel');

if (fouten.length){ console.log(`FOUTEN (${fouten.length}):`); fouten.slice(0, 25).forEach(f => console.log(' ✗', f)); process.exit(1); }
console.log(`training vandaag: ${n} controles op ${plannen} trainingen, ${vervangingen} vervangingen, ${groepswijzigingen} aangepaste oefeningen`);
