/* ==================== SPORTPROFIELEN ====================
   [20261124a] Register van de sportprofielen. Nu alleen voetbal; een club of team
   zonder sport is voetbal. Zie docs/sportprofiel-impactanalyse.md. */
import { VOETBAL } from './sport-voetbal.js?v=20261124a';

export const STANDAARD_SPORT = 'voetbal';
export const SPORTEN = Object.freeze({ voetbal: VOETBAL });
/* Het profiel voor een sport-id; onbekend of leeg geeft het standaardprofiel. */
export function sportProfiel(id){ return SPORTEN[id] || SPORTEN[STANDAARD_SPORT]; }
