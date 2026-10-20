/* ==================== LEREN VAN GEBRUIK — versturen (fase 1h) ====================
   [20261019b] Stuurt anonieme signalen naar de Cloud Function leerSignaal, alleen als
     1. de eindbaas het voor deze club heeft aangezet (clubs/{id}.platformModules.leren === true) én
     2. de club zelf meedoet (instellingen.leren.meedoen === true).
   Het versturen blokkeert nooit en meldt nooit een fout: de app werkt hetzelfde zonder.
   De server controleert beide schakelaars opnieuw (functions/leren.js). */
import { functions, httpsCallable } from './firebase.js?v=20261011g';
import { S } from './state.js?v=20261011g';
import { cfg } from './clubconfig.js?v=20261020c';

export function lerenAan(){
  return !!(S._clubPlatform && S._clubPlatform.platformModules && S._clubPlatform.platformModules.leren === true)
    && !!(cfg().leren && cfg().leren.meedoen === true);
}
/* Eindbaas laat het toe, maar de club doet (nog) niet mee? Voor de uitleg in de instellingen. */
export function lerenBeschikbaar(){
  return !!(S._clubPlatform && S._clubPlatform.platformModules && S._clubPlatform.platformModules.leren === true);
}

export function stuurSignalen(lijst){
  try {
    if (!lerenAan() || !Array.isArray(lijst) || !lijst.length) return;
    httpsCallable(functions, 'leerSignaal')({ clubId: S.team?.club || S.clubId, teamId: S.teamId, signalen: lijst.slice(0, 10) }).catch(() => {});
  } catch (e){ /* bewust stil */ }
}
