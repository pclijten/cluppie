/* ==================== BEWAARTERMIJNEN: VERTROKKEN SPELERS EN OUDE SEIZOENEN [20261121b] ====================
   PURE module (geen DOM, geen Firebase, geen imports). Rekent uit wat een club volgens haar eigen
   bewaartermijn mag opruimen. Het scherm en het wissen zelf staan in club-bewaartermijn.js.
   Getest in tests/bewaartermijn.test.mjs.

   Achtergrond (AVG.md, restpunt 3): gegevens van kinderen bewaar je niet langer dan nodig. De club is
   verantwoordelijk en kiest de termijn; Cluppie stelt voor: een vertrokken speler één jaar na het einde
   van het seizoen waarin hij vertrok, en het lopende seizoen plus de twee seizoenen ervoor.
   Er wordt nooit iets vanzelf gewist: de clubbeheerder ziet eerst wat het is en bevestigt.

   Opslag van de keuze: clubs/{id}.instellingen.privacy.bewaar = { spelersJaren, seizoenen, laatst }.
   Een seizoen loopt van 1 juli tot en met 30 juni; het label is bijvoorbeeld "2025/'26". */

export const STANDAARD = Object.freeze({ spelersJaren: 1, seizoenen: 3 });
/* [waarde, tekst]. seizoenen 0 = alles bewaren (geen voorstel om seizoenen te wissen). */
export const KEUZES_SPELERS = [[1, '1 jaar na het seizoen van vertrek'], [2, '2 jaar na het seizoen van vertrek'], [3, '3 jaar na het seizoen van vertrek']];
export const KEUZES_SEIZOENEN = [[2, 'Dit seizoen en het vorige'], [3, 'Dit seizoen en de twee ervoor'], [5, 'Dit seizoen en de vier ervoor'], [0, 'Alles bewaren']];
/* subcollecties van een team met een seizoenslabel (zelfde lijst als "Oude data labelen" in club.js) */
export const SEIZOEN_COLLECTIES = [['wedstrijden', 'wedstrijd', 'wedstrijden'], ['presentie', 'training met aanwezigheid', 'trainingen met aanwezigheid'], ['beoordelingen', 'beoordeling', 'beoordelingen'], ['teamevaluaties', 'teamevaluatie', 'teamevaluaties']];

export function schoonBewaar(b){
  const x = b && typeof b === 'object' ? b : {};
  const sj = Number(x.spelersJaren), sz = Number(x.seizoenen);
  return {
    spelersJaren: KEUZES_SPELERS.some(([w]) => w === sj) ? sj : STANDAARD.spelersJaren,
    seizoenen: KEUZES_SEIZOENEN.some(([w]) => w === sz) ? sz : STANDAARD.seizoenen,
  };
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
/* Startjaar van een seizoenslabel ("2025/'26", "2025-2026", "2025") of null. */
export function seizoenStart(label){
  const m = /^\s*(\d{4})/.exec(String(label || ''));
  return m ? Number(m[1]) : null;
}
/* Startjaar van het seizoen waarin een datum valt (1 juli is de grens). */
export function seizoenVanDatum(iso){
  const m = ISO.exec(String(iso || '')); if (!m) return null;
  return Number(m[2]) >= 7 ? Number(m[1]) : Number(m[1]) - 1;
}
/* Laatste dag van het seizoen waarin een datum valt. */
export function seizoenseinde(iso){
  const j = seizoenVanDatum(iso);
  return j === null ? null : `${j + 1}-06-30`;
}
/* De dag vanaf wanneer een speler die op `vertrokkenOp` is gearchiveerd, opgeruimd mag worden. */
export function opruimenVanaf(vertrokkenOp, jaren = STANDAARD.spelersJaren){
  const e = seizoenseinde(vertrokkenOp); if (!e) return null;
  return `${Number(e.slice(0, 4)) + jaren}${e.slice(4)}`;
}

/* Een gearchiveerde speler (overgezet naar een ander team, of vertrokken) waarvan de termijn voorbij is.
   Zonder datum van archiveren doen we niets: dan is niet te zeggen wanneer hij vertrok. */
export function spelerVerlopen(p, jaren, vandaag){
  if (!p || p.gearchiveerd !== true) return false;
  const vanaf = opruimenVanaf(p.gearchiveerdOp, jaren);
  return !!vanaf && String(vandaag) > vanaf;
}
/* spelers = [{ id, gearchiveerd, gearchiveerdOp, naarTeam }]. Geeft { verlopen:[…], later:[…], zonderDatum } terug:
   `later` zijn gearchiveerde spelers die nog binnen de termijn vallen, met de dag waarop ze verlopen. */
export function sorteerSpelers(spelers, jaren, vandaag){
  const verlopen = [], later = []; let zonderDatum = 0;
  for (const p of spelers || []){
    if (!p || p.gearchiveerd !== true) continue;
    const vanaf = opruimenVanaf(p.gearchiveerdOp, jaren);
    if (!vanaf){ zonderDatum++; continue; }
    const rij = { id: p.id, sinds: String(p.gearchiveerdOp).slice(0, 10), vanaf, weg: !p.naarTeam };
    (String(vandaag) > vanaf ? verlopen : later).push(rij);
  }
  later.sort((a, b) => a.vanaf.localeCompare(b.vanaf));
  return { verlopen, later, zonderDatum };
}

/* Het oudste startjaar dat blijft. bewaren = aantal seizoenen inclusief het lopende; 0 = alles bewaren (null). */
export function oudsteBewaard(huidigLabel, bewaren){
  const h = seizoenStart(huidigLabel);
  if (h === null || !(bewaren > 0)) return null;
  return h - (bewaren - 1);
}
/* Hoort dit document bij een seizoen dat buiten de termijn valt? Zonder label: nee (eerst labelen). */
export function seizoenVerlopen(label, huidigLabel, bewaren){
  const s = seizoenStart(label), grens = oudsteBewaard(huidigLabel, bewaren);
  return s !== null && grens !== null && s < grens;
}

/* Aanwezigheid van één training zonder de gewiste spelers. Geeft de velden die veranderen, of null als de
   speler er niet in voorkomt. De telling (aantalSpelers e.d.) blijft staan: die zegt niets over een persoon. */
export function presentieZonder(d, ids){
  const weg = new Set(ids), patch = {};
  for (const veld of ['afwezig', 'telaat', 'selectie']){
    if (Array.isArray(d && d[veld]) && d[veld].some(x => weg.has(x))) patch[veld] = d[veld].filter(x => !weg.has(x));
  }
  const r = d && d.afwezigRedenen;
  if (r && typeof r === 'object' && !Array.isArray(r) && Object.keys(r).some(k => weg.has(k)))
    patch.afwezigRedenen = Object.fromEntries(Object.entries(r).filter(([k]) => !weg.has(k)));
  return Object.keys(patch).length ? patch : null;
}

/* ---------- tekst voor het scherm ---------- */
export function datumNL(iso){
  const m = ISO.exec(String(iso || '')); if (!m) return '';
  const MND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  return `${Number(m[3])} ${MND[Number(m[2]) - 1]} ${m[1]}`;
}
export const seizoenLabel = start => `${start}/'${String(start + 1).slice(-2)}`;
/* tellingen = { wedstrijden: 12, presentie: 30, … } → "12 wedstrijden, 30 trainingen met aanwezigheid" */
export function tellingTekst(tellingen){
  return SEIZOEN_COLLECTIES.map(([id, een, veel]) => { const n = (tellingen && tellingen[id]) || 0; return n ? `${n} ${n === 1 ? een : veel}` : ''; }).filter(Boolean).join(', ');
}
/* Eén regel voor Instellingen: wanneer is er voor het laatst opgeruimd? laatst = { ms, spelers, documenten }. */
export function laatstTekst(laatst){
  if (!laatst || !Number(laatst.ms)) return 'Nog niet opgeruimd';
  const d = new Date(Number(laatst.ms)), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const wat = [laatst.spelers ? `${laatst.spelers} speler${laatst.spelers === 1 ? '' : 's'}` : '', laatst.documenten ? `${laatst.documenten} document${laatst.documenten === 1 ? '' : 'en'} uit oude seizoenen` : ''].filter(Boolean).join(' en ');
  return `Laatst opgeruimd op ${datumNL(iso)}${wat ? `: ${wat}` : ''}`;
}
