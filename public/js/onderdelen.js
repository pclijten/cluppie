/* ==================== ONDERDELEN: Training maken en Seizoensplanning [20261013b] ====================
   Drie lagen bepalen of een onderdeel zichtbaar is:
     1. Eindbaas (platformbeheerder), per club:  clubs/{id}.platformModules.{sleutel} = true | false
        Staat er niets, dan geldt: clubs van vóór GRENS blijven aan, nieuwe clubs beginnen uit
        tot de eindbaas het aanzet (zie platformToegestaan).
     2. Clubbeheerder: standaard per club (instellingen.modules.standaard), via modAan().
     3. Team: eigen keuze (teams/{id}.modules), via modAan().
   Een onderdeel is zichtbaar als laag 1 het toestaat én modAan() (laag 2 en 3) aan zegt.
   Vierde laag, werkwijze (clubs/{id}.instellingen.werkwijze): bij 'club' (Club stuurt) bouwen alleen
   admins, hoofd jeugd en (bouw)coördinatoren zelf een training of seizoensplan; een gewone trainer
   ziet die tegels niet, tenzij het team een uitzondering heeft (teams/{id}.werkwijzeVrij === true).
   Standaard is 'vrij' (Trainers vrij). Een team zonder club kent geen werkwijze: alles open.
   Dit is een organisatiekeuze in de interface, geen beveiliging.
   Bewust een eigen module: modAan staat in state.js en daar iets in wijzigen kost een release
   van ~30 bestanden. Dit geldt alleen voor de sleutels in BEHEERD; de andere modules lopen
   gewoon via modAan(). Zonder imports van firebase, dus ook los te testen. */
import { S, modAan } from './state.js?v=20261011g';

export const BEHEERD = ['trainingsmodule', 'seizoensplan'];
export const NAMEN = { trainingsmodule: 'Training maken', seizoensplan: 'Seizoensplanning' };
/* clubs die vóór dit moment zijn aangemaakt blijven de onderdelen houden (13-10-2026, NL-tijd) */
export const GRENS_SEC = Date.parse('2026-10-13T00:00:00+02:00') / 1000;

function seconden(t){
  if (!t) return null;
  if (typeof t === 'number') return t > 1e11 ? t / 1000 : t;           // ms of s
  if (typeof t === 'string'){ const ms = Date.parse(t); return Number.isNaN(ms) ? null : ms / 1000; }
  const s = t.seconds ?? t._seconds;
  return typeof s === 'number' ? s : null;
}

/* Laag 1. `club` = { platformModules, gemaakt } (het clubdocument volstaat). Zonder club (een team
   zonder club) of zonder aanmaakdatum geldt de oude situatie: aan. */
export function platformToegestaan(club, sleutel){
  if (!BEHEERD.includes(sleutel)) return true;
  const v = club && club.platformModules && club.platformModules[sleutel];
  if (v === true || v === false) return v;
  const s = seconden(club && club.gemaakt);
  return !(s !== null && s >= GRENS_SEC);
}

/* Laag 4. `club` = { werkwijze, leiding:{ admins, hoofdJeugd, bouwCoordinatoren } }. */
export function werkwijzeVan(club){ return club && club.werkwijze === 'club' ? 'club' : 'vrij'; }

/* Sturende rol: admin, hoofd jeugd of coördinator van een bouw. */
export function isSturend(club, uid){
  const l = club && club.leiding;
  if (!l || !uid) return false;
  if (l.admins && l.admins[uid]) return true;
  if (l.hoofdJeugd && l.hoofdJeugd[uid]) return true;
  if (Object.values(l.bouwCoordinatoren || {}).some(m => !!(m && m[uid]))) return true;
  return (l.eigenBouwen || []).some(b => !!(b && b.coaches && b.coaches[uid]));
}

export function werkwijzeToestaat(sleutel, team, club = S._clubPlatform, uid = S.user && S.user.uid){
  if (!BEHEERD.includes(sleutel)) return true;
  if (!team || !team.club) return true;                    // zonder club geen werkwijze
  if (werkwijzeVan(club) !== 'club') return true;
  if (team.werkwijzeVrij === true) return true;
  return isSturend(club, uid);
}

/* Is het onderdeel nu zichtbaar voor dit team? */
export function onderdeelAan(sleutel, team = S.team){
  if (!BEHEERD.includes(sleutel)) return modAan(sleutel, team);
  return platformToegestaan(S._clubPlatform, sleutel) && modAan(sleutel, team) && werkwijzeToestaat(sleutel, team);
}

/* Door de eindbaas uitgezet? Dan tonen de beheerschermen het onderdeel grijs. */
export function doorPlatformUit(sleutel){
  return BEHEERD.includes(sleutel) && !platformToegestaan(S._clubPlatform, sleutel);
}
