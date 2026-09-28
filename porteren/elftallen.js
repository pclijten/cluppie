/* ==================== ELFTALLEN + ASSISTS (cluppie.io) ====================
   Geport uit ASV'33-release 20260928e (js/elftallen.js). Alleen de logica:
   geen DOM, geen globale state, zodat de match- en stats-UI van cluppie.io
   het later kan gebruiken, wat de schermopbouw ook wordt.

   Datamodel — BEWUST gelijk aan ASV'33, zodat een migratie 1-op-1 kan:
     clubs/{clubId}/teams/{teamId}.tweedeElftal = { sportlinkNaam: string|null }
         aanwezig = team heeft een 1e én 2e elftal
     clubs/{clubId}/teams/{teamId}/players/{playerId}.elftal = '1' | '2' | 'b'  (leeg = '1')
     clubs/{clubId}/teams/{teamId}/matches/{matchId}.elftal = '1' | '2'          (leeg = '1')
     match.goals[] = { type:'voor'|'tegen', pid, assist?, kwart, sec }
         assist alleen bij type 'voor' en nooit gelijk aan pid.

   Firestore-rules: geen wijziging nodig — coaches mogen team, players en
   matches al schrijven (hasRole(clubId, 'coach')). Let op: tweedeElftal
   aanzetten is in ASV'33 een clubadmin-actie; overweeg hier hetzelfde. */

import { db } from './firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

/* ---------- basis ---------- */
export const heeftElftallen = team => !!(team && team.tweedeElftal);
export const elftalSpeler = p => (p?.elftal === '2' || p?.elftal === 'b') ? p.elftal : '1';
export const elftalWedstrijd = m => String(m?.elftal || '1') === '2' ? '2' : '1';
export const hoortBijElftal = (p, e) => { const x = elftalSpeler(p); return x === 'b' || x === e; };
const eigenSpeler = p => p && !p._ingeleend && !p.gast && !p._gast;

/* filter: '1' | '2' | 't' (totaal) */
export function filterOpElftal(team, matches, filter = 't'){
  if (!heeftElftallen(team) || filter === 't') return matches;
  return matches.filter(m => elftalWedstrijd(m) === filter);
}

/* Voorselectie voor een nieuwe wedstrijd van elftal e: eerst wie erbij hoort. */
export function spelersVoorElftal(players, e){
  const eigen = [], rest = [];
  for (const p of players) (!eigenSpeler(p) || hoortBijElftal(p, e) ? eigen : rest).push(p);
  return { eigen, rest };
}

/* ---------- goals + assists ---------- */
export function maakGoal({ type, pid = null, assist = null, kwart, sec }){
  const g = { type, pid, kwart, sec };
  if (type === 'voor' && assist && assist !== pid) g.assist = assist;
  return g;
}

/* ---------- cijfers ----------
   speeltijd(m) moet { [pid]: seconden } teruggeven — in ASV'33 is dat
   analyseWedstrijd(m).tijd uit analyse.js. Zolang cluppie.io nog geen
   klok/opstelling heeft, kan dat () => ({}) zijn: dan tellen alleen goals
   en assists. */
export function selectieCijfers(team, matches, { filter = 't', seizoen = null, speeltijd = () => ({}) } = {}){
  const lijst = filterOpElftal(team, matches.filter(m => !seizoen || !m.seizoen || m.seizoen === seizoen), filter);
  const per = {};
  const rij = pid => (per[pid] ||= { w:0, g:0, a:0, sec:0 });
  const tot = { wedstrijden:0, voor:0, tegen:0, winst:0, gelijk:0, verlies:0, assists:0 };
  for (const m of lijst){
    if (m.type === 'toernooi') continue;
    const tijd = speeltijd(m) || {};
    const gespeeld = (m.goals || []).length > 0 || Object.keys(tijd).length > 0;
    if (!gespeeld) continue;
    tot.wedstrijden++;
    let v = 0, t = 0;
    for (const g of (m.goals || [])){
      if (g.type === 'voor'){ v++; if (g.pid) rij(g.pid).g++; if (g.assist){ rij(g.assist).a++; tot.assists++; } }
      else if (g.type === 'tegen') t++;
    }
    tot.voor += v; tot.tegen += t;
    if (v > t) tot.winst++; else if (v === t) tot.gelijk++; else tot.verlies++;
    for (const [pid, s] of Object.entries(tijd)) if (s > 0){ rij(pid).w++; rij(pid).sec += s; }
  }
  return { per, ...tot };
}

/* ---------- opslaan ---------- */
export function zetElftalSpeler(clubId, teamId, playerId, elftal){
  return updateDoc(doc(db, `clubs/${clubId}/teams/${teamId}/players`, playerId), { elftal });
}
export function zetElftalWedstrijd(clubId, teamId, matchId, elftal){
  return updateDoc(doc(db, `clubs/${clubId}/teams/${teamId}/matches`, matchId), { elftal });
}
export function zetTweedeElftal(clubId, teamId, aan, sportlinkNaam = null){
  return updateDoc(doc(db, `clubs/${clubId}/teams`, teamId), { tweedeElftal: aan ? { sportlinkNaam: sportlinkNaam || null } : null });
}
