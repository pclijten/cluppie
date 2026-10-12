/* ==================== CLUBGIDS (20261012f) ====================
   Platformbrede gids van clubs (clubgids/{clubcode}): naam, teamnamen, sportpark, plaats en —
   zodra bekend — adres en route. Gevuld door de Sportlink-sync (functions/index.js →
   schrijfClubgids); de app leest alleen. Gebruikt bij "Nieuwe wedstrijd" om een tegenstander
   te kiezen, zodat naam en plek kloppen.

   Eén keer per sessie gelezen en op S._clubgids bewaard (runtime-veld, niet in state.js).
   De zoekfuncties zijn PURE en getest (tests/clubgids.test.mjs). */

import { db, collection, getDocs } from './firebase.js?v=20261011g';
import { S } from './state.js?v=20261011g';

export async function laadClubgids(){
  if (Array.isArray(S._clubgids)) return S._clubgids;
  try {
    const snap = await getDocs(collection(db, 'clubgids'));
    S._clubgids = snap.docs.map(d => ({ code: d.id, ...d.data() })).filter(c => c.naam);
  } catch (e){ console.warn('[clubgids] lezen mislukt', e); S._clubgids = []; }
  return S._clubgids;
}

export const normNaam = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

/* Club in de gids waar deze teamnaam bij hoort (exacte teamnaam, anders clubnaam aan het begin). */
export function clubVanTeam(gids, teamnaam){
  const t = normNaam(teamnaam);
  if (!t) return null;
  return (gids || []).find(c => (c.teams || []).some(n => normNaam(n) === t))
      || (gids || []).filter(c => c.naam && t.startsWith(normNaam(c.naam))).sort((a, b) => b.naam.length - a.naam.length)[0]
      || null;
}

/* Suggesties voor het tegenstanderveld.
     pouleTeams: teamnamen uit de eigen poule(s) (zonder het eigen team)
     eigenCode:  Sportlink-clubcode van de eigen club (wordt niet als tegenstander voorgesteld)
   Geeft { poule: [{ naam, club }], clubs: [club] } — elk max 6, gerangschikt op begin-match. */
export function zoekTegenstanders(gids, q, { pouleTeams = [], eigenCode = '' } = {}){
  const z = normNaam(q);
  if (z.length < 2) return { poule: [], clubs: [] };
  const score = naam => { const n = normNaam(naam); return n.startsWith(z) ? 0 : n.includes(z) ? 1 : 2; };
  const woordBegin = naam => String(naam || '').toLowerCase().split(/[\s/'-]+/).some(w => normNaam(w).startsWith(z));
  const past = naam => score(naam) < 2 || woordBegin(naam);
  const poule = [...new Set(pouleTeams)]
    .filter(past)
    .sort((a, b) => score(a) - score(b) || a.localeCompare(b, 'nl'))
    .slice(0, 6)
    .map(naam => ({ naam, club: clubVanTeam(gids, naam) }));
  const al = new Set(poule.map(p => p.club?.code).filter(Boolean));
  const clubs = (gids || [])
    .filter(c => c.code !== eigenCode && !al.has(c.code) && (past(c.naam) || (c.plaats && normNaam(c.plaats).startsWith(z))))
    .sort((a, b) => score(a.naam) - score(b.naam) || a.naam.localeCompare(b.naam, 'nl'))
    .slice(0, 6);
  return { poule, clubs };
}

/* Plek voor een wedstrijd: uit = sportpark van de tegenstander, thuis = eigen sportpark. */
export function plekVoor(club){
  if (!club || !club.accommodatie) return null;
  return {
    accommodatie: club.accommodatie,
    ...(club.adres ? { adres: club.adres, plaatsAdres: club.plaatsAdres || '' } : {}),
    ...(club.route ? { route: club.route } : {}),
    adresBekend: !!club.adres,
  };
}

/* Teamnamen uit de eigen poule(s), zonder het eigen team. */
export function pouleTeamnamen(){
  const namen = [];
  for (const r of (S.pouleStand?.rijen || [])) if (!r.eigen && r.team) namen.push(r.team);
  for (const r of (S.pouleBeker?.stand || [])) if (!r.eigen && r.team) namen.push(r.team);
  return [...new Set(namen)];
}
