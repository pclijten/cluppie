/* ==================== SPORTPROFIELEN ====================
   [20261124a] Register van de sportprofielen. Nu alleen voetbal; een club of team
   zonder sport is voetbal. Zie docs/sportprofiel-impactanalyse.md. */
import { HOCKEY } from './sport-hockey.js?v=20261126c';
import { VOLLEYBAL } from './sport-volleybal.js?v=20261126c';
import { KORFBAL } from './sport-korfbal.js?v=20261126c';
import { VOETBAL } from './sport-voetbal.js?v=20261126c';

export const STANDAARD_SPORT = 'voetbal';
/* [20261126c] de vier grootste teamsporten; een sport met open: false is een pilot (alleen de eindbaas zet hem) */
export const SPORTEN = Object.freeze({ voetbal: VOETBAL, hockey: HOCKEY, volleybal: VOLLEYBAL, korfbal: KORFBAL });
/* Het profiel voor een sport-id; onbekend of leeg geeft het standaardprofiel. */
export function sportProfiel(id){ return SPORTEN[id] || SPORTEN[STANDAARD_SPORT]; }

/* [20261125x] De sport van een club of team. Een clubteam volgt altijd de club; een team zonder club
   heeft zijn eigen veld (gezet bij het aanmaken). Ontbreekt het veld, dan is het voetbal. */
export function sportVan(club, team){
  const id = club ? club.sport : (team && team.sport);
  return SPORTEN[id] ? id : STANDAARD_SPORT;
}
export const sportNaam = id => sportProfiel(id).naam;
/* Meer dan één sport: pas dan tonen we een keuze aan de trainer (mockup 3). */
/* [20261126c] sporten waarmee een trainer of club zelf kan beginnen (open), de rest is een pilot */
export const openSporten = () => Object.values(SPORTEN).filter(p => p.open !== false);
export const meerdereSporten = () => openSporten().length > 1;

/* [20261125y] Stap 3: de sport van het team dat nu open staat. clubconfig.js zet hem bij het laden
   van de club, teams.js bij een team zonder club. Tot dan het standaardprofiel. */
let actief = STANDAARD_SPORT;
export function zetActieveSport(id){ actief = SPORTEN[id] ? id : STANDAARD_SPORT; }
export const actieveSport = () => actief;
/* Een woord uit het profiel van de actieve sport, bijv. sportWoord('bond') = 'KNVB'.
   hoofd = true zet de eerste letter in een hoofdletter. Onbekend woord: het woord zelf. */
export function sportWoord(sleutel, hoofd = false){
  const w = (sportProfiel(actief).woorden || {})[sleutel] ?? sleutel;
  return hoofd ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

/* [20261125z] Stap 4: het veld van de actieve sport (tactiekbord, deelplaatje, veldkaart). */
export const sportVeld = () => sportProfiel(actief).veld || sportProfiel(STANDAARD_SPORT).veld;
/* Lijnen van het tactiekbord als html: dwarslijnen, middencirkel en de vakken aan beide doelkanten.
   Voor voetbal precies dezelfde maten als de vroegere vaste css-klassen. */
export function bordLijnenHtml(veld = sportVeld()){
  const b = veld.bord, uit = [];
  for (const y of b.dwars || []) uit.push(y === 50 ? '<div class="tb-lijn tb-midden"></div>' : `<div class="tb-lijn tb-midden" style="top:${y}%"></div>`);
  if (b.cirkel) uit.push(b.cirkel === 24 ? '<div class="tb-lijn tb-cirkel"></div>' : `<div class="tb-lijn tb-cirkel" style="width:${b.cirkel}%"></div>`);
  for (const v of b.vakken || []){
    const zij = (100 - v.b) / 2, boog = v.vorm === 'boog' ? ' tb-vak-boog' : '';
    for (const k of ['o', 'b']) uit.push(`<div class="tb-lijn tb-vak-${k}${boog}" style="left:${zij}%;right:${zij}%;height:${v.h}%"></div>`);
  }
  return uit.join('\n        ');
}

/* [20261126a] Stap 5: wedstrijdregels van de actieve sport. */
const WEDSTRIJD_STANDAARD = { zonderKeeper: [], periodeNaam: { 2: 'Helft', 4: 'Kwart' }, periodeKort: { 2: 'H', 4: 'K' }, kaarten: [], tweedeGeelRood: false, kaartUitleg: '' };
export const sportWedstrijd = () => ({ ...WEDSTRIJD_STANDAARD, ...(sportProfiel(actief).wedstrijd || {}) });
/* Speelt deze spelvorm zonder keeper? (voetbal: 4 tegen 4) */
export const zonderKeeper = format => sportWedstrijd().zonderKeeper.includes(String(format));
/* Naam van een periode bij dit aantal periodes; 'alle' wint (volleybal: Set). */
export function periodeNaamVoor(aantal){ const pn = sportWedstrijd().periodeNaam; return pn.alle || (aantal === 2 ? pn[2] : pn[4]); }
export function periodeKortVoor(aantal){ const pk = sportWedstrijd().periodeKort; return pk.alle || (aantal === 2 ? pk[2] : pk[4]); }
/* De kaarten van deze sport; een kaart die een andere sport kent maar deze niet, valt terug op zijn eigen naam. */
export const sportKaarten = () => sportWedstrijd().kaarten;
export const kaartDef = type => sportKaarten().find(k => k.type === type) || null;

/* [20261126b] Stap 6: heeft deze sport eigen oefenstof en plannen? Zo niet, dan blijven de onderdelen
   die daarop draaien (Training maken, Seizoensplanning) uit, in plaats van voetbalstof te tonen. */
export const sportInhoud = () => sportProfiel(actief).inhoud === true;

/* [20261126c] Stap 7: werkt deze sport met Sportlink? (voetbal, korfbal en volleybal wel, hockey met LISA niet) */
export const heeftSportlink = () => sportProfiel(actief).ledenbron === 'sportlink';
