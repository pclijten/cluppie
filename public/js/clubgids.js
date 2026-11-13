/* ==================== CLUBGIDS (20261012h) ====================
   Platformbrede gids van clubs (clubgids/{clubcode}): naam, teamnamen, sportpark, plaats en —
   zodra bekend — adres en route. Gevuld door de Sportlink-sync (functions/index.js →
   schrijfClubgids); de app leest alleen. Gebruikt bij "Nieuwe wedstrijd" om een tegenstander
   te kiezen, zodat naam en plek kloppen.

   Eén keer per sessie gelezen en op S._clubgids bewaard (runtime-veld, niet in state.js).
   De zoekfuncties zijn PURE en getest (tests/clubgids.test.mjs). */

import { db, collection, getDocs } from './firebase.js?v=20261011g';
import { S } from './state.js?v=20261111d';

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

/* [20261113b] Plaats van een club uit de gids: `plaats`, anders uit het adres ("5421 AA Gemert" → "Gemert"). */
export function plaatsVan(c){
  if (!c) return '';
  if (c.plaats) return c.plaats;
  return String(c.plaatsAdres || '').replace(/^\s*\d{4}\s?[A-Za-z]{2}\s+/, '').trim();
}

/* [20261113b] Clubnamen voorstellen terwijl iemand typt (snelstart, club aanmelden).
   PURE (getest). Rangorde: naam begint ermee, een woord in de naam begint ermee, plaats begint ermee.
   Een naam die vaker voorkomt (twee clubs "Rood Wit") houdt elk zijn eigen plaats. Max 8. */
export function zoekClubs(gids, q, max = 8){
  const z = normNaam(q);
  if (z.length < 2) return [];
  const rang = c => {
    const n = normNaam(c.naam);
    if (n.startsWith(z)) return 0;
    if (String(c.naam || '').toLowerCase().split(/[\s/'.-]+/).some(w => normNaam(w).startsWith(z))) return 1;
    if (n.includes(z)) return 2;
    if (normNaam(plaatsVan(c)).startsWith(z)) return 3;
    return 9;
  };
  return (gids || [])
    .filter(c => c && c.naam)
    .map(c => ({ c, r: rang(c) }))
    .filter(x => x.r < 9)
    .sort((a, b) => a.r - b.r || a.c.naam.length - b.c.naam.length || a.c.naam.localeCompare(b.c.naam, 'nl'))
    .slice(0, max)
    .map(x => ({ code: x.c.code, naam: x.c.naam, plaats: plaatsVan(x.c), accommodatie: x.c.accommodatie || '' }));
}

/* [20261113b] Suggestielijst onder een clubnaam-veld. `kies(club)` krijgt { code, naam, plaats, accommodatie }.
   De gids wordt pas geladen als iemand begint te typen (één keer per sessie). */
export function koppelClubSuggesties(invoer, kies){
  if (!invoer || invoer._cgGekoppeld) return;
  invoer._cgGekoppeld = true;
  const lijst = document.createElement('div');
  lijst.className = 'cg-sugg'; lijst.hidden = true; lijst.setAttribute('role', 'listbox');
  invoer.setAttribute('aria-autocomplete', 'list');
  invoer.insertAdjacentElement('afterend', lijst);
  let gids = null, sel = -1, items = [];
  const esc = t => String(t || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const sluit = () => { lijst.hidden = true; sel = -1; };
  const teken = () => {
    if (!items.length){ sluit(); return; }
    lijst.innerHTML = items.map((c, i) => `<button type="button" role="option" class="cg-item${i === sel ? ' sel' : ''}" data-i="${i}"><b>${esc(c.naam)}</b><small>${esc(c.plaats || c.accommodatie || '')}</small></button>`).join('')
      + '<p class="cg-noot">Uit de KNVB-gegevens van clubs die met Cluppie werken. Staat je club er niet bij? Typ de naam gewoon in.</p>';
    lijst.hidden = false;
  };
  const kiesI = i => { const c = items[i]; if (!c) return; invoer.value = c.naam; sluit(); kies(c); };
  invoer.addEventListener('input', async () => {
    const q = invoer.value;
    if (normNaam(q).length < 2){ items = []; sluit(); return; }
    if (!gids) gids = await laadClubgids();
    if (invoer.value !== q) return;              // intussen verder getypt
    items = zoekClubs(gids, q); sel = -1; teken();
  });
  invoer.addEventListener('keydown', e => {
    if (lijst.hidden) return;
    if (e.key === 'ArrowDown'){ sel = Math.min(items.length - 1, sel + 1); teken(); e.preventDefault(); }
    else if (e.key === 'ArrowUp'){ sel = Math.max(0, sel - 1); teken(); e.preventDefault(); }
    else if (e.key === 'Enter' && sel >= 0){ kiesI(sel); e.preventDefault(); }
    else if (e.key === 'Escape'){ sluit(); }
  });
  lijst.addEventListener('mousedown', e => e.preventDefault());   // focus blijft in het veld
  lijst.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) kiesI(Number(b.dataset.i)); });
  invoer.addEventListener('blur', () => setTimeout(sluit, 150));
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
