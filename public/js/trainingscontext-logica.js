/* ==================== TRAININGSCONTEXT — logica (zonder DOM en zonder Firestore) ====================
   [20261019a] De praktische kant van een training: welk materiaal heeft het team, hoe groot is het veld,
   welke dag is de wedstrijd. De planner (trainingsplanner.js) gebruikt dit als harde grens: past een vorm
   niet bij het materiaal van het team, dan komt hij er niet in (en als er echt niets past, kiest de
   planner de best passende vorm en meldt hij wat er mist).

   Alles is optioneel. Zonder context ({ materiaal: null }) doet de planner precies wat hij altijd deed.

   Context (teams/{teamId}/trainingscontext/huidig, geen rules-wijziging nodig; alleen aantallen):
     { materiaal: { ballen, pionnen, hesjes, doeltjes } | null,
       veld: 'kwart' | 'half' | 'heel' | null,      // null = standaard (heel veld)
       wedstrijddag: 1..7 | null }                  // 1 = ma … 7 = zo
   De hoeveelheden in de bibliotheek (vorm.materiaal) gelden PER GROEP; de planner deelt de spelers in groepen
   (groepsindeling), dus de behoefte van een vorm is hoeveelheid × aantal groepen.

   Bewust een eigen module zonder imports (net als opkomst.js): de planner, het scherm en de tests gebruiken
   hem, zonder dat de een de ander hoeft te importeren. */

export const MATERIAAL = [
  ['ballen', 'Ballen'],
  ['pionnen', 'Pionnen'],
  ['hesjes', 'Hesjes'],
  ['doeltjes', 'Kleine doeltjes'],
];
export const MATERIAAL_NAAM = Object.fromEntries(MATERIAAL);
const SLEUTELS = MATERIAAL.map(m => m[0]);

/* Snelkeuzes: een trainer hoeft geen aantallen in te vullen om te beginnen. */
export const PRESETS = {
  zuinig: { naam: 'Zo weinig mogelijk', materiaal: { ballen: 6, pionnen: 12, hesjes: 8, doeltjes: 0 } },
  normaal: { naam: 'Normaal', materiaal: { ballen: 12, pionnen: 30, hesjes: 14, doeltjes: 4 } },
  ruim: { naam: 'Ruim', materiaal: { ballen: 20, pionnen: 50, hesjes: 20, doeltjes: 6 } },
};
/* Welke snelkeuze hoort bij deze aantallen? null = eigen aantallen. */
export function presetVan(materiaal){
  if (!materiaal) return null;
  return Object.keys(PRESETS).find(k => SLEUTELS.every(s => (PRESETS[k].materiaal[s] || 0) === (materiaal[s] || 0))) || null;
}

export const VELDEN = [['kwart', 'Kwart veld'], ['half', 'Half veld'], ['heel', 'Heel veld']];
const VELD_FACTOR = { kwart: 0.25, half: 0.5, heel: 1 };

/* Beschikbare ruimte in m² voor de planner. `standaard` = de bestaande aanname per leeftijd
   (standaardRuimte in trainingsplanner.js); kleiner veld = evenredig minder. */
export function ruimteM2(veld, standaard){
  return Math.round(standaard * (VELD_FACTOR[veld] ?? 1));
}

/* Schoon een context op: alleen bekende sleutels, hele getallen ≥ 0. Gooit nooit. */
export function schoonContext(c){
  const uit = { materiaal: null, veld: null, wedstrijddag: null };
  if (!c || typeof c !== 'object') return uit;
  if (c.materiaal && typeof c.materiaal === 'object'){
    uit.materiaal = {};
    for (const s of SLEUTELS) uit.materiaal[s] = Math.max(0, Math.min(500, Math.round(Number(c.materiaal[s]) || 0)));
  }
  if (VELD_FACTOR[c.veld]) uit.veld = c.veld;
  const w = Number(c.wedstrijddag);
  if (Number.isInteger(w) && w >= 1 && w <= 7) uit.wedstrijddag = w;
  return uit;
}

/* ---------- materiaal ---------- */
/* Wat een vorm nodig heeft bij dit aantal groepen: { ballen, pionnen, hesjes, doeltjes } (alleen > 0). */
export function behoefte(vorm, groepen){
  const m = vorm?.materiaal || {}, g = Math.max(1, groepen || 1), uit = {};
  for (const s of SLEUTELS){ const n = (m[s] || 0) * g; if (n > 0) uit[s] = n; }
  return uit;
}

/* Wat er na vervangen nog mist. Vervangers (eerst het doeltje, dan de pion):
     - een doeltje wordt een poortje van twee pionnen, uit de pionnen die over zijn;
     - een pion wordt een hesje als afbakening, uit de hesjes die over zijn.
   Geeft { ok, tekort:{item:n}, vervangers:[tekst] }. */
export function tekort(behoeft, voorraad){
  let have = voorraad || {};
  const tk = {}, vervangers = [];
  for (const s of SLEUTELS){ const d = (behoeft[s] || 0) - (have[s] || 0); if (d > 0) tk[s] = d; }
  if (tk.doeltjes){
    const over = Math.max(0, (have.pionnen || 0) - (behoeft.pionnen || 0));
    const nu = Math.min(Math.floor(over / 2), tk.doeltjes);
    if (nu > 0){
      vervangers.push(`${nu} poortje${nu > 1 ? 's' : ''} van 2 pionnen in plaats van een doeltje`);
      tk.doeltjes -= nu; if (tk.doeltjes <= 0) delete tk.doeltjes;
      have = { ...have, pionnen: (have.pionnen || 0) - nu * 2 };
    }
  }
  if (tk.pionnen){
    const over = Math.max(0, (have.hesjes || 0) - (behoeft.hesjes || 0));
    const nu = Math.min(over, tk.pionnen);
    if (nu > 0){
      vervangers.push(`${nu} hesje${nu > 1 ? 's' : ''} als afbakening in plaats van pionnen`);
      tk.pionnen -= nu; if (tk.pionnen <= 0) delete tk.pionnen;
    }
  }
  return { ok: !Object.keys(tk).length, tekort: tk, vervangers };
}

/* Past deze vorm bij het materiaal van het team? Zonder voorraad (niet ingesteld) altijd ja. */
export function haalbaar(vorm, groepen, context){
  const behoeft = behoefte(vorm, groepen);
  if (!context || !context.materiaal) return { ok: true, tekort: {}, vervangers: [], behoefte: behoeft };
  return { ...tekort(behoeft, context.materiaal), behoefte: behoeft };
}

/* Totaal voor een hele training: per soort het maximum over de vormen (je schakelt tussen vormen,
   het materiaal wordt hergebruikt). Onderdelen zijn de onderdelen uit een plan ({ vorm, groepen }). */
export function trainingsBehoefte(onderdelen){
  const uit = {};
  for (const od of onderdelen || []){
    const b = behoefte(od.vorm, od.groepen);
    for (const s of Object.keys(b)) uit[s] = Math.max(uit[s] || 0, b[s]);
  }
  return uit;
}

/* ---------- wedstrijd ---------- */
const plusDag = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d; };
const weekdagIso = d => (d.getDay() + 6) % 7 + 1;
/* De dag voor de wedstrijd: lichter trainen (ervaring van trainers, niet onderzocht bij jeugd). */
export function dagVoorWedstrijd(datumIso, context){
  const w = context?.wedstrijddag;
  if (!w || !datumIso) return false;
  return weekdagIso(plusDag(datumIso, 1)) === w;
}
export const MAX_INTENSITEIT_VOOR_WEDSTRIJD = 2;

/* ---------- wat valt af en wat helpt ---------- */
/* `vormen` zijn de vormen die voor leeftijd en aantal spelers in aanmerking komen. `groepenVan(v)` geeft het aantal
   groepen. Telt hoeveel vormen door het materiaal afvallen en welke kleine aanschaf de meeste vormen oplevert. */
export function valtAf(vormen, groepenVan, context){
  if (!context || !context.materiaal) return { totaal: vormen.length, passend: vormen.length, af: 0, tips: [] };
  let passend = 0;
  const enkel = {};                                   /* soort → lijst tekorten van vormen waar alleen die soort mist */
  for (const v of vormen){
    const h = haalbaar(v, groepenVan(v), context);
    if (h.ok){ passend++; continue; }
    const soorten = Object.keys(h.tekort);
    if (soorten.length === 1) (enkel[soorten[0]] = enkel[soorten[0]] || []).push(h.tekort[soorten[0]]);
  }
  const tips = [];
  for (const [soort, lijst] of Object.entries(enkel)){
    lijst.sort((a, b) => a - b);
    const k = Math.min(3, lijst.length);              /* kleinste aankoop die minstens k vormen oplevert */
    const extra = lijst[k - 1];
    tips.push({ soort, extra, vormen: lijst.filter(x => x <= extra).length });
  }
  tips.sort((a, b) => b.vormen - a.vormen || a.extra - b.extra);
  return { totaal: vormen.length, passend, af: vormen.length - passend, tips: tips.slice(0, 2) };
}
export function tipTekst(t){
  const naam = (MATERIAAL_NAAM[t.soort] || t.soort).toLowerCase();
  return `Met ${t.extra} extra ${naam} ${t.vormen > 1 ? 'komen ' + t.vormen + ' vormen' : 'komt 1 vorm'} erbij.`;
}
