/* ==================== WEDSTRIJDSTATUS UIT SPORTLINK (20261012a) ====================
   Eén plek voor wat de Sportlink-sync sinds 20261012a op een wedstrijd zet:
     status: 'afgelast'      → afgelast door KNVB/tegenstander (afgelastingen-endpoint)
     sportlinkWeg: true      → staat niet meer in het Sportlink-programma, zonder afgelasting
     competitiesoort         → 'regulier' | 'beker' | 'oefen' | 'overig'
     info { accommodatie, veld, plaats, verzamel, vertrek, kleedkamer, adres, plaatsAdres, telefoon, route }
     infoEigen { verzamel, vertrek }   → door de coach ingevuld, gaat altijd voor
   Een afgelaste wedstrijd wordt nooit verwijderd (opstelling/presentie blijven staan), maar telt niet
   als "eerstvolgend" of "komend".

   Bewust zonder imports (zoals opkomst.js): wordt door teams.js, teams-hub.js, desktop-schermen.js,
   desktop-bouw.js en club.js gebruikt; zo kost een wijziging hier geen versie-cascade. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const isAfgelast = w => !!w && w.status === 'afgelast';
export const isWeg = w => !!w && !isAfgelast(w) && w.sportlinkWeg === true;
/* Telt mee als komende/eerstvolgende wedstrijd? */
export const telMee = w => !!w && !isAfgelast(w);

/* "Beker" / "Oefen" vóór de meta-regel. Competitie krijgt niets: dat is de normale situatie. */
export function soortPill(w){
  const s = w && w.competitiesoort;
  if (s === 'beker') return '<span class="ws-pill beker">Beker</span>';
  if (s === 'oefen') return '<span class="ws-pill oefen">Oefen</span>';
  return '';
}

/* Badge rechts in een wedstrijdregel; leeg als er niets bijzonders is. */
export function statusBadge(w){
  if (isAfgelast(w)) return '<span class="ws-badge afgelast">Afgelast</span>';
  if (isWeg(w)) return '<span class="ws-badge weg" title="Staat niet meer in het Sportlink-programma. Verplaatst of geschrapt? Je kunt hem zelf verwijderen.">Niet in Sportlink</span>';
  return '';
}

/* Info met de coachwaarden erover; `bron` zegt per tijd waar hij vandaan komt. */
export function wedstrijdInfo(w){
  const sl = (w && w.info) || {}, eigen = (w && w.infoEigen) || {};
  const tijd = k => eigen[k] ? { t: eigen[k], bron: 'eigen' } : sl[k] ? { t: sl[k], bron: 'sportlink' } : { t: '', bron: '' };
  return {
    verzamel: tijd('verzamel'), vertrek: tijd('vertrek'),
    aftrap: w && w.aftrap ? { t: w.aftrap, bron: w.bron === 'sportlink' ? 'sportlink' : 'eigen' } : { t: '', bron: '' },
    accommodatie: sl.accommodatie || '', veld: sl.veld || '', kleedkamer: sl.kleedkamer || '',
    plaats: sl.plaats || '', adres: sl.adres || '', plaatsAdres: sl.plaatsAdres || '', telefoon: sl.telefoon || '',
    route: /^https:\/\/www\.google\.com\/maps\//.test(sl.route || '') ? sl.route : '',
  };
}
export const heeftInfo = w => { const i = wedstrijdInfo(w); return !!(i.accommodatie || i.verzamel.t || i.vertrek.t); };

/* Korte plekregel voor de wedstrijdlijst: "Sportpark De Kempen · veld 3". */
export function plekKort(w){
  const i = wedstrijdInfo(w);
  return [i.accommodatie, i.veld].filter(Boolean).join(' · ');
}

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function datumKort(iso){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return iso || '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return `${DAGEN[d.getUTCDay()]} ${+m[3]} ${MAANDEN[+m[2] - 1]}`;
}

/* Bericht voor de oudergroep. Geen spelernamen: alleen tijden en plek. */
export function deelTekst(w, teamNaam){
  const i = wedstrijdInfo(w);
  const titel = w.thuis ? `${teamNaam} – ${w.tegenstander || ''}` : `${w.tegenstander || ''} – ${teamNaam}`;
  const r = [`${datumKort(w.datum).replace(/^./, c => c.toUpperCase())} — ${titel.trim()}`];
  if (isAfgelast(w)){ r.push('Deze wedstrijd is afgelast.'); return r.join('\n'); }
  const tijden = [i.verzamel.t && `verzamelen ${i.verzamel.t}`, i.vertrek.t && `vertrek ${i.vertrek.t}`].filter(Boolean);
  if (tijden.length) r.push(tijden.join(', ').replace(/^./, c => c.toUpperCase()));
  r.push([i.aftrap.t && `Aftrap ${i.aftrap.t}`, i.accommodatie, i.veld].filter(Boolean).join(', '));
  if (i.kleedkamer) r.push(`Kleedkamer ${i.kleedkamer}`);
  if (!w.thuis && i.adres) r.push(`Adres: ${[i.adres, i.plaatsAdres].filter(Boolean).join(', ')}`);
  if (!w.thuis && i.route) r.push(`Route: ${i.route}`);
  return r.filter(Boolean).join('\n');
}

/* ---------- melding op de teamhub ---------- */
const GEZIEN = 'cluppie.afgelastGezien';
function gezien(){ try { return JSON.parse(localStorage.getItem(GEZIEN) || '[]'); } catch { return []; } }
export function markeerGezien(id){
  try { localStorage.setItem(GEZIEN, JSON.stringify([...new Set([...gezien(), id])].slice(-50))); } catch {}
}
/* Afgelaste wedstrijden van vandaag t/m 7 dagen vooruit die de coach nog niet wegtikte. */
export function afgelastMeldingen(wedstrijden, vandaag = new Date().toISOString().slice(0, 10)){
  const tot = new Date(vandaag + 'T12:00:00Z'); tot.setUTCDate(tot.getUTCDate() + 7);
  const grens = tot.toISOString().slice(0, 10), weg = new Set(gezien());
  return (wedstrijden || []).filter(w => isAfgelast(w) && w.datum >= vandaag && w.datum <= grens && !weg.has(w.id))
    .sort((a, b) => (a.datum + (a.aftrap || '')).localeCompare(b.datum + (b.aftrap || '')));
}
export function htmlAfgelastBanner(wedstrijden, teamNaam, vandaag){
  const lijst = afgelastMeldingen(wedstrijden, vandaag);
  if (!lijst.length) return '';
  const w = lijst[0];
  const titel = w.thuis ? `${teamNaam} – ${w.tegenstander || ''}` : `${w.tegenstander || ''} – ${teamNaam}`;
  const wanneer = w.datum === vandaag ? 'van vandaag' : `van ${datumKort(w.datum)}`;
  return `<div class="ws-banner" role="status">
    <span class="ws-banner-ic" aria-hidden="true">⛔</span>
    <div class="ws-banner-t"><b>Wedstrijd ${esc(wanneer)} is afgelast${lijst.length > 1 ? ` (+${lijst.length - 1})` : ''}</b>
      <span>${esc(titel.trim())}${w.aftrap ? ' · ' + esc(w.aftrap) : ''}</span></div>
    <button class="knop licht klein" data-ws-gezien="${esc(lijst.map(x => x.id).join(','))}">Gezien</button></div>`;
}
