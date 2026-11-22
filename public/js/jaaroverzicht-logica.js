/* ==================== JAAROVERZICHT (PURE LOGICA) [20261122a] ====================
   Eén blad met het seizoen van een team, of van één speler, om aan de club te laten zien. Geen DOM, geen
   Firebase, geen imports: het scherm (jaaroverzicht.js) rekent de wedstrijden en aanwezigheid door met
   de bestaande rekenregels (analyse.js, opkomst.js) en geeft hier alleen getallen aan.
   Getest in tests/jaaroverzicht.test.mjs.

   Privacy: het teamoverzicht bevat geen namen van spelers, alleen aantallen en percentages. Het
   overzicht van een speler bevat zijn voornaam en cijfers, geen notities, leerpunten of redenen van
   afwezigheid; delen kan alleen als afdruk of pdf, niet als tekstbericht. */

export const nl = n => String(n).replace('.', ',');
const rond1 = n => Math.round(n * 10) / 10;
const getallen = lijst => (lijst || []).map(Number).filter(n => Number.isFinite(n));
export function gemiddelde(lijst){
  const g = getallen(lijst);
  return g.length ? g.reduce((a, b) => a + b, 0) / g.length : null;
}
const meerv = (n, een, veel) => `${n} ${n === 1 ? een : veel}`;

/* wedstrijden = [{ voor, tegen }] (alleen gespeelde) */
export function balans(wedstrijden){
  const uit = { n: 0, gewonnen: 0, gelijk: 0, verloren: 0, voor: 0, tegen: 0 };
  for (const w of wedstrijden || []){
    const v = Number(w && w.voor) || 0, t = Number(w && w.tegen) || 0;
    uit.n++; uit.voor += v; uit.tegen += t;
    if (v > t) uit.gewonnen++; else if (v === t) uit.gelijk++; else uit.verloren++;
  }
  return uit;
}

/* Hoe eerlijk is de speeltijd verdeeld? Zelfde maat als het Stats-scherm: 100 = iedereen even veel,
   op basis van de spreiding van het aandeel speeltijd per speler. Minder dan drie spelers: geen oordeel. */
export function eerlijkheid(pcts){
  const p = getallen(pcts);
  if (p.length < 3) return null;
  const gem = p.reduce((a, b) => a + b, 0) / p.length;
  if (!(gem > 0)) return null;
  const sd = Math.sqrt(p.reduce((a, b) => a + (b - gem) ** 2, 0) / p.length);
  const score = Math.max(0, Math.min(100, Math.round(100 - (sd / gem) * 140)));
  return { score, gem: Math.round(gem), laagste: Math.round(Math.min(...p)), hoogste: Math.round(Math.max(...p)), spelers: p.length };
}
export function eerlijkTekst(e){
  if (!e) return '';
  return e.score >= 85 ? 'Iedereen speelt ongeveer even veel.' : e.score >= 70 ? 'De speeltijd is redelijk verdeeld.' : 'De speeltijd is ongelijk verdeeld.';
}

/* Ontwikkeling uit een reeks beoordelingen (oud → nieuw, schaal 1 tot 5). Eén meting zegt niets over groei. */
export function ontwikkeling(reeks){
  const r = getallen(reeks).filter(n => n > 0);
  if (r.length < 2) return null;
  const van = rond1(r[0]), naar = rond1(r[r.length - 1]), verschil = rond1(naar - van);
  return { van, naar, verschil, aantal: r.length, richting: verschil > 0.15 ? 'omhoog' : verschil < -0.15 ? 'omlaag' : 'gelijk' };
}

/* ---------- team ---------- */
/* invoer: { teamNaam, clubNaam, seizoen, wedstrijden:[{voor,tegen}], trainingen, opkomstPcts:[…], speeltijdPcts:[…],
             spelers, teamevaluaties, beoordelingen, beoordeeldeSpelers } */
export function teamOverzicht(i = {}){
  const b = balans(i.wedstrijden), opk = gemiddelde(i.opkomstPcts);
  const o = {
    soort: 'team', teamNaam: String(i.teamNaam || ''), clubNaam: String(i.clubNaam || ''), seizoen: String(i.seizoen || ''),
    balans: b, trainingen: Number(i.trainingen) || 0, opkomst: opk === null ? null : Math.round(opk),
    eerlijk: eerlijkheid(i.speeltijdPcts), spelers: Number(i.spelers) || 0,
    teamevaluaties: Number(i.teamevaluaties) || 0, beoordelingen: Number(i.beoordelingen) || 0, beoordeeldeSpelers: Number(i.beoordeeldeSpelers) || 0,
  };
  o.leeg = !b.n && !o.trainingen && !o.teamevaluaties && !o.beoordelingen;
  return o;
}
/* regels voor het blad: [{ label, waarde, toelichting }] */
export function teamRegels(o){
  const b = o.balans, e = o.eerlijk, uit = [];
  uit.push({ label: 'Wedstrijden', waarde: String(b.n), toelichting: b.n ? `${b.gewonnen} gewonnen, ${b.gelijk} gelijk, ${b.verloren} verloren` : 'Nog geen wedstrijden gespeeld' });
  if (b.n) uit.push({ label: 'Doelpunten', waarde: `${b.voor} voor, ${b.tegen} tegen`, toelichting: `Gemiddeld ${nl(rond1(b.voor / b.n))} voor en ${nl(rond1(b.tegen / b.n))} tegen per wedstrijd` });
  uit.push({ label: 'Trainingen met aanwezigheid', waarde: String(o.trainingen), toelichting: o.opkomst === null ? 'Nog geen aanwezigheid ingevuld' : `Gemiddelde opkomst ${o.opkomst}%` });
  if (e) uit.push({ label: 'Eerlijke speeltijd', waarde: `${e.score} van 100`, toelichting: `${eerlijkTekst(e)} De speler met de minste speeltijd stond ${e.laagste}% van de tijd op het veld, die met de meeste ${e.hoogste}%. Geteld over de wedstrijden waar een speler bij was.` });
  uit.push({ label: 'Spelers', waarde: String(o.spelers), toelichting: '' });
  uit.push({ label: 'Teamevaluaties', waarde: String(o.teamevaluaties), toelichting: o.teamevaluaties ? 'Na de wedstrijd ingevuld door de trainers' : 'Nog geen evaluaties ingevuld' });
  uit.push({ label: 'Beoordelingen van spelers', waarde: String(o.beoordelingen), toelichting: o.beoordelingen ? `${o.beoordeeldeSpelers} van de ${meerv(o.spelers, 'speler', 'spelers')} minstens één keer beoordeeld` : 'Nog geen beoordelingen' });
  return uit;
}
/* korte samenvatting om te versturen: geen namen van spelers */
export function deelTekstTeam(o){
  const b = o.balans, e = o.eerlijk, regels = [];
  regels.push(`Jaaroverzicht ${o.teamNaam}${o.clubNaam ? ` (${o.clubNaam})` : ''}, seizoen ${o.seizoen}`);
  if (b.n) regels.push(`${meerv(b.n, 'wedstrijd', 'wedstrijden')}: ${b.gewonnen} gewonnen, ${b.gelijk} gelijk, ${b.verloren} verloren. Doelpunten ${b.voor} voor, ${b.tegen} tegen.`);
  if (o.trainingen) regels.push(`${meerv(o.trainingen, 'training', 'trainingen')} met aanwezigheid${o.opkomst === null ? '' : `, gemiddelde opkomst ${o.opkomst}%`}.`);
  if (e) regels.push(`Eerlijke speeltijd: ${e.score} van 100. ${eerlijkTekst(e)}`);
  if (o.teamevaluaties || o.beoordelingen) regels.push(`${meerv(o.teamevaluaties, 'teamevaluatie', 'teamevaluaties')} en ${meerv(o.beoordelingen, 'beoordeling', 'beoordelingen')} van spelers.`);
  regels.push('Bijgehouden in Cluppie.');
  return regels.join('\n');
}

/* ---------- speler ---------- */
/* invoer: { naam, teamNaam, seizoen, wedstrijden, minuten, pctSpeeltijd, opkomst:{aanwezig,totaal,pct}, goals, assists, keeper, reeks:[…] } */
export function spelerOverzicht(i = {}){
  const opk = i.opkomst || {};
  const o = {
    soort: 'speler', naam: String(i.naam || ''), teamNaam: String(i.teamNaam || ''), seizoen: String(i.seizoen || ''),
    wedstrijden: Number(i.wedstrijden) || 0, minuten: Math.round(Number(i.minuten) || 0),
    pctSpeeltijd: Number.isFinite(Number(i.pctSpeeltijd)) && i.pctSpeeltijd !== null && i.pctSpeeltijd !== undefined ? Math.round(Number(i.pctSpeeltijd)) : null,
    opkomst: { aanwezig: Number(opk.aanwezig) || 0, totaal: Number(opk.totaal) || 0, pct: opk.pct === null || opk.pct === undefined ? null : Math.round(Number(opk.pct)) },
    goals: Number(i.goals) || 0, assists: Number(i.assists) || 0, keeper: Number(i.keeper) || 0,
    ontwikkeling: ontwikkeling(i.reeks), beoordelingen: getallen(i.reeks).filter(n => n > 0).length,
  };
  o.leeg = !o.wedstrijden && !o.opkomst.totaal && !o.beoordelingen;
  return o;
}
export function spelerRegels(o){
  const uit = [], g = o.ontwikkeling;
  uit.push({ label: 'Wedstrijden', waarde: String(o.wedstrijden), toelichting: o.wedstrijden ? `${o.minuten} minuten gespeeld${o.pctSpeeltijd === null ? '' : `, ${o.pctSpeeltijd}% van de tijd in de eigen wedstrijden`}` : 'Nog niet gespeeld' });
  uit.push({ label: 'Trainingen', waarde: o.opkomst.totaal ? `${o.opkomst.aanwezig} van ${o.opkomst.totaal}` : '0', toelichting: o.opkomst.pct === null ? 'Nog geen aanwezigheid ingevuld' : `Opkomst ${o.opkomst.pct}%` });
  uit.push({ label: 'Doelpunten en assists', waarde: `${o.goals} en ${o.assists}`, toelichting: o.keeper ? `${meerv(o.keeper, 'keer', 'keer')} gekeept` : '' });
  uit.push({ label: 'Beoordelingen', waarde: String(o.beoordelingen),
    toelichting: g ? `Van ${nl(g.van)} naar ${nl(g.naar)} op een schaal van 1 tot 5${g.richting === 'gelijk' ? ' (gelijk gebleven)' : ''}` : o.beoordelingen === 1 ? 'Eén beoordeling: nog geen ontwikkeling te zien' : 'Nog geen beoordelingen' });
  return uit;
}
