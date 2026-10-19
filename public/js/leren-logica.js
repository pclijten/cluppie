/* ==================== LEREN VAN GEBRUIK — logica aan de kant van de app (fase 1h) ====================
   [20261019b] Twee dingen:
     1. De terugblik van de trainer na de training: drie tikken, alleen voor hemzelf (stap 1 van fase 1h).
        Opgeslagen bij de bewaarde training in het eigen team. Niets gaat naar anderen.
     2. De vorm van het anonieme signaal dat naar de server gaat ALS de club meedoet én de eindbaas het
        heeft aangezet (functions/leren.js controleert dat opnieuw). Alleen vorm-id's, leeftijdsgroep,
        slot, thema en de drie antwoorden; nooit namen, spelers, teamnaam of vrije tekst.
   Zonder imports (net als opkomst.js), zodat tests/leren-logica.test.mjs hem los kan testen en
   vergelijken met de server. */

export const TERUGBLIK_VRAGEN = [
  { sl: 'natuurlijk', vraag: 'Voelde de training natuurlijk voor jou?', opties: [['ja', 'Ja'], ['ongeveer', 'Ongeveer'], ['nee', 'Nee']] },
  { sl: 'energie', vraag: 'Hadden de spelers energie?', opties: [['meer', 'Meer dan normaal'], ['gelijk', 'Gelijk'], ['minder', 'Minder']] },
  { sl: 'opnieuw', vraag: 'Volgende week weer zo?', opties: [['ja', 'Ja'], ['aanpassen', 'Aanpassen'], ['nee', 'Nee']] },
];
export const ANTWOORDEN = Object.fromEntries(TERUGBLIK_VRAGEN.map(v => [v.sl, v.opties.map(o => o[0])]));

/* Een antwoord vastleggen; ongeldige waarden worden genegeerd. Geeft een nieuw object terug. */
export function zetAntwoord(tb, sl, waarde){
  const uit = { ...(tb || {}) };
  if (ANTWOORDEN[sl] && ANTWOORDEN[sl].includes(waarde)) uit[sl] = waarde;   // een keuze corrigeren kan, terugdraaien naar leeg niet (merge in Firestore)
  return uit;
}
export const terugblikKlaar = tb => TERUGBLIK_VRAGEN.every(v => tb && tb[v.sl]);

/* Eigen terugblik van de laatste trainingen: { n, tekst }. `lijst` = bewaarde trainingen met eventueel .terugblik. */
export function terugblikSamenvatting(lijst, max = 10){
  const met = (lijst || []).filter(x => x && x.terugblik && Object.keys(x.terugblik).length).slice(0, max);
  if (!met.length) return { n: 0, tekst: '' };
  const tel = (sl, w) => met.filter(x => x.terugblik[sl] === w).length;
  const delen = [];
  const nat = tel('natuurlijk', 'ja'); if (met.some(x => x.terugblik.natuurlijk)) delen.push(`${nat}× natuurlijk`);
  const en = tel('energie', 'meer'); if (met.some(x => x.terugblik.energie)) delen.push(`${en}× meer energie`);
  const op = tel('opnieuw', 'ja'); if (met.some(x => x.terugblik.opnieuw)) delen.push(`${op}× weer zo`);
  return { n: met.length, tekst: `Laatste ${met.length} training${met.length > 1 ? 'en' : ''}: ${delen.join(' · ')}` };
}

/* Signalen voor de server. `ctx` = { categorie → leeftijd, onderdelen:[{vormId, slot}], thema, terugblik, preset, reden }.
   De server schoont ze nog eens op; dit is de enige plek in de app die de velden samenstelt. */
export function signaalVormBewaard(leeftijd, od){ return { actie: 'vorm_bewaard', leeftijd, vormId: od.vormId, slot: od.slot }; }
export function signaalVormGewisseld(leeftijd, od){ return { actie: 'vorm_gewisseld', leeftijd, vormId: od.vormId, slot: od.slot }; }
export function signaalTerugblik(leeftijd, vormIds, thema, tb){ return { actie: 'terugblik', leeftijd, vormIds, thema: thema || undefined, antwoord: { ...tb } }; }
export function signaalMateriaal(leeftijd, preset){ return { actie: 'materiaal_gekozen', leeftijd, preset }; }
export function signaalGat(leeftijd, reden){ return { actie: 'plan_gat', leeftijd, reden }; }
/* Waarom viel er in dit plan iets af? Uit de controles van de planner. */
export function gatRedenen(plan){
  const uit = [];
  for (const c of (plan && plan.controle && plan.controle.checks) || []) if (!c.ok && (c.id === 'materiaal' || c.id === 'ruimte')) uit.push(c.id);
  return uit;
}
