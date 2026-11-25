/* ==================== SPORTPROFIELEN ====================
   [20261124a] Register van de sportprofielen. Nu alleen voetbal; een club of team
   zonder sport is voetbal. Zie docs/sportprofiel-impactanalyse.md. */
import { VOETBAL } from './sport-voetbal.js?v=20261125x';

export const STANDAARD_SPORT = 'voetbal';
export const SPORTEN = Object.freeze({ voetbal: VOETBAL });
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
export const meerdereSporten = () => Object.keys(SPORTEN).length > 1;

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
