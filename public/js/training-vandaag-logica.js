/* ==================== TRAINING AANPASSEN VOOR VANDAAG — LOGICA (puur, geen DOM, geen Firestore) ====================
   [20261116l] Bij elke training geeft de coach aan hoeveel spelers er zijn en wat voor weer het is; de training
   past zich dan aan, met dezelfde oefeningen. Ontwerp en besluiten: projectdocument
   claude/training-vandaag-aanpassen-impactanalyse.md (akkoord Paul 16-11-2026).

   Wat er verandert:
     • groepen, wissels en veldmaat per oefening (groepsindeling en schaalVeld van de planner), en daarmee
       het materiaal en de tekst bij Tijdbestek;
     • de tijdsindeling bij het weer (opbouwVoor): koud of regen = korte ontvangst en korte drinkpauzes, de
       vrijgekomen minuten naar de warming-up; warm = langere drinkpauzes, korter partijspel;
     • een oefening die met dit aantal niet kan (minder spelers dan het minimum van de vorm) wordt vervangen
       door de best passende vorm met hetzelfde thema (rangschik van de planner). De gekozen vervanger wordt
       bewaard (keuze.vervangen), zodat hij niet verspringt en medecoaches dezelfde training zien.
   Wat nooit verandert: thema, leerdoel, het principe van de speelwijze, de regel in het partijspel en de duur.
   Oefeningen zonder vorm uit de bibliotheek (een eigen PDF) blijven zoals ze zijn.

   Alleen aantallen en keuzes; nooit namen van spelers. */
import { bouwOnderdeel, opbouwVoor, rangschik, kiesDuur, WEER, SLOT_NAAM } from './trainingsplanner.js?v=20261130f';
import { oefeningVan, bronVanOefening, rondBlok } from './seizoensplan-club.js?v=20261130f';

export const MIN_SPELERS = 6;
export const MAX_SPELERS = 24;
export const WEERKEUZES = [['', 'Gewoon'], ...Object.entries(WEER).map(([k, w]) => [k, w.naam])];
const klem = (x, a, b) => Math.max(a, Math.min(b, x));

/* Keuze zoals hij bewaard wordt: { spelers (6–24) of null, weer ('koud'|'regen'|'warm') of null, vervangen: { index: vormId } }. PUUR. */
export function schoonKeuze(k){
  const n = Number(k?.spelers);
  const vervangen = {};
  for (const [i, id] of Object.entries(k?.vervangen || {})) if (/^\d+$/.test(i) && typeof id === 'string' && id) vervangen[i] = id;
  return { spelers: Number.isFinite(n) && n > 0 ? klem(Math.round(n), MIN_SPELERS, MAX_SPELERS) : null, weer: WEER[k?.weer] ? k.weer : null, vervangen };
}
/* Is er iets aangepast ten opzichte van het plan? */
export function isAangepast(keuze, gepland){
  const k = schoonKeuze(keuze);
  return (k.spelers !== null && k.spelers !== gepland) || !!k.weer;
}

/* Voor hoeveel spelers is de training gemaakt? Elke oefening bewaart bron.spelers = groepen × groepsgrootte + wissels;
   dat is naar boven afgerond op volle groepen, dus nooit minder dan het echte aantal. Het kleinste getal is het echte
   aantal (een vorm met één groep, zoals het partijspel, bewaart het precies). PUUR. */
export function geplandAantal(oefeningen, terugval = 12){
  const ns = (oefeningen || []).map(o => Number(o?.bron?.spelers)).filter(n => n > 0);
  return ns.length ? Math.min(...ns) : terugval;
}

/* "2 groepen van 5 of 6", "1 groep van 8 en 1 wissel". PUUR. */
export function indelingTekst(od){
  const g = od.groepen || 1, mee = Math.max(0, (od.groepen || 1) * (od.groepGrootte || 0));
  const totaal = od._spelers ? Math.min(od._spelers, mee) : mee;
  const klein = Math.floor(totaal / g), groot = Math.ceil(totaal / g);
  const maat = klein === groot ? String(groot) : `${klein} of ${groot}`;
  return `${g} ${g === 1 ? 'groep' : 'groepen'} van ${maat}${od.wissel ? ` en ${od.wissel} ${od.wissel === 1 ? 'wissel' : 'wissels'}` : ''}`;
}
const veldTekst = od => (od.veld ? `${od.veld.b}×${od.veld.l} m` : '');

/* De plek in de training. Een oefening zonder (bekende) plek krijgt de plek die bij de soort vorm hoort. PUUR. */
const SLOT_BIJ_FASE = { 'warming-up': 'warming-up', positiespel: 'kern1', spelvorm: 'kern2', partijspel: 'partij', afsluiting: 'afsluiting' };
export function slotVan(slot, vorm){
  if (slot === 'afsluiting' || SLOT_NAAM[slot]) return slot;
  /* de naam in plaats van de sleutel ("Kernvorm 1", "Partijspel"): terugzoeken */
  const naam = String(slot || '').trim().toLowerCase();
  const op = naam ? Object.entries(SLOT_NAAM).find(([, n]) => n.toLowerCase() === naam || n.toLowerCase().startsWith(naam + ' ')) : null;
  if (op) return op[0];
  return SLOT_BIJ_FASE[vorm?.fase] || 'kern1';
}

/* De minuten per onderdeel bij dit weer: het verschil tussen de gewone opbouw en de opbouw bij dit weer, opgeteld bij
   wat de training zelf had (zo blijft een training met eigen minuten heel). Geeft ook de overgang (ontvangst, pauzes). PUUR. */
export function tijdBijWeer(duur, weer){
  const gewoon = opbouwVoor(duur, null), nu = opbouwVoor(duur, weer || null);
  const verschil = {};
  for (const o of nu.onderdelen) verschil[o.slot] = o.minuten - (gewoon.onderdelen.find(x => x.slot === o.slot)?.minuten ?? o.minuten);
  verschil.afsluiting = nu.overgang.afsluiting - gewoon.overgang.afsluiting;
  return { verschil, overgang: nu.overgang, gewoon: gewoon.overgang };
}

/* De training voor vandaag.
   training = { oefeningen, thema, duur }; keuze = { spelers, weer, vervangen };
   cx = { vormen (lijst uit de bibliotheek), categorie, speelwijze (optioneel), seed (optioneel, voor een vaste vervanger) }.
   Geeft { kan (er is iets om aan te passen), aangepast, gepland, spelers, weer, oefeningen, wijzigingen, vervangen,
           eigen (aantal oefeningen dat niet uit de bibliotheek komt), weerMelding }.
   Elke aangepaste oefening krijgt `vandaag: { label, was }` voor de weergave. PUUR. */
export function pasAan(training, keuze0, cx = {}){
  const basis = Array.isArray(training?.oefeningen) ? training.oefeningen : [];
  const vormen = cx.vormen || [], opId = id => vormen.find(v => v.id === id) || null;
  const keuze = schoonKeuze(keuze0);
  const bronnen = basis.map(o => { const b = bronVanOefening(o, vormen); return b?.vormId && opId(b.vormId) ? b : null; });
  const uitBib = bronnen.filter(Boolean).length;
  const gepland = geplandAantal(basis.map((o, i) => (bronnen[i] ? { bron: { spelers: o?.bron?.spelers } } : null)), cx.terugvalSpelers || 12);
  const N = keuze.spelers ?? gepland, weer = keuze.weer;
  const uit = { kan: uitBib > 0, aangepast: false, gepland, spelers: N, weer, oefeningen: basis, wijzigingen: [], vervangen: {}, eigen: basis.length - uitBib, weerMelding: weer ? WEER[weer].melding : '' };
  if (!uitBib || !isAangepast(keuze, gepland)) return uit;

  const thema = training.thema || '';
  const duur = kiesDuur(training.duur || basis.reduce((a, o, i) => a + (bronnen[i]?.minuten || 0), 0) + 10);
  const tijd = tijdBijWeer(duur, weer);
  const inGebruik = new Set(bronnen.filter(Boolean).map(b => b.vormId));
  const wijzigingen = [], vervangen = {};

  const oefeningen = basis.map((oef, i) => {
    const b = bronnen[i];
    if (!b) return oef;
    const v0 = opId(b.vormId);
    const slot = slotVan(b.slot, v0);
    const min0 = b.minuten || rondBlok(v0.tijd || 10, slot) || 10;
    const N0 = gepland;
    /* minuten bij dit weer: nooit onder 5, een vorm nooit boven 15 en het partijspel nooit boven 20 */
    const dv = tijd.verschil[slot] || 0;
    const min = !dv ? min0 : slot === 'afsluiting' ? Math.max(1, min0 + dv) : klem(min0 + dv, 5, Math.max(min0, slot === 'partij' ? 20 : 15));
    const slotNaam = slot === 'afsluiting' ? 'Afsluiting' : (SLOT_NAAM[slot] || '');

    /* past de vorm bij dit aantal? zo niet: de bewaarde vervanger, anders de best passende van hetzelfde thema */
    let v = v0, reden = '';
    if (N < v0.spelers.min){
      const bewaard = keuze.vervangen[i] ? opId(keuze.vervangen[i]) : null;
      const zoek = (sl, filter = () => true) => rangschik(vormen, sl, { categorie: cx.categorie, aantalSpelers: N, thema, weer, uitsluiten: [...inGebruik], seed: `${cx.seed || ''}:${i}`,
        ...(cx.speelwijze ? { speelwijze: cx.speelwijze } : {}) }).filter(filter)[0] || null;
      let nieuw = bewaard && N >= bewaard.spelers.min ? bewaard : (slot === 'afsluiting' ? null : zoek(slot));
      if (!nieuw && slot === 'partij') nieuw = zoek('kern2', x => x.voetbalecht);          /* te weinig spelers voor een wedstrijdvorm: een kleine voetbalvorm */
      if (nieuw){ v = nieuw; inGebruik.add(nieuw.id); vervangen[i] = nieuw.id; reden = `${v0.naam} kan niet met ${N} spelers (minimaal ${v0.spelers.min}).`; }
    }
    const regel = (oef.blokken || []).find(x => x.kop === 'Regel van de speelwijze')?.tekst || null;
    const od0 = { ...bouwOnderdeel(v0, { slot, minuten: min0 }, { N: N0, thema }), slotNaam, _spelers: N0 };
    const od = { ...bouwOnderdeel(v, { slot, minuten: min }, { N, thema, weer, speelwijzeRegel: regel }), slotNaam, _spelers: N };
    const was = [], kop = slotNaam.replace(' spelvorm', '') || 'Oefening';
    let label = '';
    if (v !== v0){
      label = 'Vervangen'; was.push(`Was: ${v0.naam}. Die vorm kan niet met ${N} spelers (minimaal ${v0.spelers.min}).`);
      wijzigingen.push({ soort: 'vervangen', label: 'Vervangen', idx: i, kop, tekst: `${reden} Nu: ${v.naam}, ${indelingTekst(od)}.` });
    } else {
      const ind0 = indelingTekst(od0), ind = indelingTekst(od), vd0 = veldTekst(od0), vd = veldTekst(od);
      if (ind0 !== ind || vd0 !== vd){
        label = 'Aangepast'; was.push(`Was: ${ind0}${vd0 ? ', ' + vd0 : ''}.`);
        wijzigingen.push({ soort: 'groepen', label: 'Groepen', idx: i, kop, tekst: `${ind0} wordt ${ind}${vd0 !== vd && vd ? `; veld ${vd}` : ''}.` });
      } else if (N < v0.spelers.min){
        label = 'Let op'; was.push(`Deze oefening is gemaakt voor minstens ${v0.spelers.min} spelers. Er is geen passende vervanger gevonden.`);
        wijzigingen.push({ soort: 'letop', label: 'Let op', idx: i, kop, tekst: `${v0.naam} is gemaakt voor minstens ${v0.spelers.min} spelers; er is geen passende vervanger gevonden.` });
      }
    }
    if (min !== min0){
      if (!label) label = 'Aangepast';
      was.push(`Was: ${min0} minuten.`);
      if (slot !== 'afsluiting') wijzigingen.push({ soort: 'tijd', label: 'Tijd', idx: i, kop, tekst: `${min0} wordt ${min} minuten.` });
    }
    if (!label && !weer) return oef;                                    /* niets veranderd aan deze oefening */
    const nieuw = oefeningVan(od);
    /* het principe van de speelwijze hoort bij de vorm: bij dezelfde vorm blijft het staan */
    /* bron.spelers is het echte aantal van vandaag (oefeningVan rondt naar boven af op volle groepen) */
    return { ...nieuw, bron: { ...nieuw.bron, spelers: N }, ...(v === v0 && oef.principe ? { principe: oef.principe } : {}), ...(label ? { vandaag: { label, was: was.join(' ') } } : {}) };
  });

  /* ontvangst en drinkpauzes bij het weer */
  if (weer){
    const o = tijd.overgang, g = tijd.gewoon;
    if (o.ontvangst !== g.ontvangst) wijzigingen.push({ soort: 'tijd', label: 'Tijd', kop: 'Ontvangst', tekst: `${g.ontvangst} wordt ${o.ontvangst} ${o.ontvangst === 1 ? 'minuut' : 'minuten'}: geef de uitleg tijdens de eerste vorm.` });
    if (o.tussen !== g.tussen) wijzigingen.push({ soort: 'tijd', label: 'Tijd', kop: 'Drinkpauzes', tekst: `samen ${g.tussen} wordt ${o.tussen} minuten.` });
    wijzigingen.push({ soort: 'tijd', label: 'Tijd', kop: 'Rust tussen de rondes', tekst: weer === 'warm' ? 'minstens 2 minuten.' : 'hooguit 1 minuut, zodat niemand stilstaat.' });
  }
  return { ...uit, aangepast: true, oefeningen, wijzigingen, vervangen };
}

/* Tips bij een training die Cluppie niet zelf kan aanpassen (eigen PDF of eigen tekst). PUUR. */
export function tipsVoorEigen(keuze0, gepland){
  const k = schoonKeuze(keuze0), tips = [];
  if (k.spelers !== null && k.spelers !== gepland){
    if (k.spelers % 2) tips.push(['Oneven aantal', 'maak één joker die bij het team met de bal speelt, of wissel elke 3 minuten door.']);
    tips.push(k.spelers < gepland ? ['Minder spelers', 'maak het vak per speler die ontbreekt ongeveer 2 meter korter, en kies kleinere groepen in plaats van wachtrijen.']
      : ['Meer spelers', 'maak een extra groep of een extra vak in plaats van grotere groepen, zodat iedereen aan de bal komt.']);
  }
  if (k.weer) tips.push([WEER[k.weer].naam, WEER[k.weer].melding.replace(/^[^:]+:\s*/, '')]);
  return tips;
}

/* Voorstel voor het weer op het trainingsmoment (grenzen uit het voorstel van 11-11-2026, gewoonte onder trainers):
   onweer = waarschuwing; 1 mm per uur of 70% kans = regen; gevoelstemperatuur 5 °C of lager = koud; 25 °C of hoger = warm.
   uur = { temp, gevoel, mm, kans, code } van Open-Meteo. Geeft { weer ('koud'|'regen'|'warm'|null), tekst, onweer }. PUUR. */
export function weerVoorstel(uur){
  if (!uur || !Number.isFinite(Number(uur.temp))) return null;
  const temp = Math.round(Number(uur.temp)), gevoel = Number.isFinite(Number(uur.gevoel)) ? Number(uur.gevoel) : Number(uur.temp);
  const mm = Number(uur.mm) || 0, kans = Number(uur.kans) || 0, onweer = [95, 96, 99].includes(Number(uur.code));
  const nat = mm >= 1 || kans >= 70;
  const weer = nat ? 'regen' : gevoel <= 5 ? 'koud' : Number(uur.temp) >= 25 ? 'warm' : null;
  const tekst = `${temp} °C, ${nat ? (mm >= 1 ? `${String(Math.round(mm * 10) / 10).replace('.', ',')} mm regen` : `${Math.round(kans)}% kans op regen`) : 'droog'}`;
  return { weer, tekst, onweer };
}
