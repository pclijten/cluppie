/* ==================== CLUBSCHERM-LOGICA [20261125w] ====================
   Pure logica (geen DOM, geen Firebase) voor de kantine-tv en de sponsoren van de club.
   - het programma van vandaag uit de wedstrijden van de teams (teams/{t}/wedstrijden);
   - sponsoren per seizoen (pakket, einddatum, bedrag) en eigen schermen;
   - wat er in de openbare kopie mag (clubTv/{id} en clubTv/{id}/schermen/{sid}): geen bedragen, geen notities.
   De Cloud Function functions/kantine-tv.js bouwt hetzelfde programma (zelfde velden) elke tien minuten.
   Getest in tests/clubscherm.test.mjs. */
import { plaatjeOk, veiligeLink } from './toernooi-logica.js?v=20261125w';

export const MAX_ITEMS = 40, MAX_PROGRAMMA = 120;
export const PAKKETTEN = { hoofd: 'Hoofdsponsor', sponsor: 'Sponsor', vriend: 'Vriend van de club' };
const tekst = (v, max = 60) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isTijd = s => /^\d{1,2}:\d{2}$/.test(String(s || ''));
const min = t => isTijd(t) ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : 9999;

/* Eén wedstrijd van een team als regel voor de tv. Stand altijd thuis – uit. */
export function programmaRij(team = {}, w = {}){
  if (!w || !isIso(w.datum)) return null;
  const thuis = w.thuis !== false, eigen = tekst(team.naam, 40) || 'Team', tegen = tekst(w.tegenstander, 60) || 'Tegenstander';
  let stand = '';
  const voor = Number(w.doelBin), tg = Number(w.doelTegen);
  if (w.resultaat && Number.isFinite(voor) && Number.isFinite(tg)) stand = thuis ? `${voor} - ${tg}` : `${tg} - ${voor}`;
  else if (/^\d+\s*-\s*\d+$/.test(String(w.uitslag || ''))) stand = String(w.uitslag).replace(/\s*-\s*/, ' - ');
  return { datum: w.datum, tijd: isTijd(w.aftrap) ? w.aftrap.padStart(5, '0') : '', thuis, a: thuis ? eigen : tegen, b: thuis ? tegen : eigen,
    veld: tekst(w.info?.veld, 30), kk: tekst(w.info?.kleedkamer, 30), stand, afgelast: w.status === 'afgelast', soort: tekst(w.competitiesoort, 20) };
}
/* teams: [{ id, naam }], perTeam: { teamId: [wedstrijden] }. Alleen de gevraagde dag, op tijd. */
export function bouwProgramma(teams = [], perTeam = {}, datum = ''){
  const uit = [];
  for (const t of teams) for (const w of perTeam[t.id] || []){ const r = programmaRij(t, w); if (r && r.datum === datum){ delete r.datum; uit.push(r); } }
  return uit.sort((x, y) => min(x.tijd) - min(y.tijd) || x.a.localeCompare(y.a, 'nl', { numeric: true })).slice(0, MAX_PROGRAMMA);
}

/* Sponsoren en eigen schermen, zoals het clubbestuur ze beheert (met bedrag en notitie). */
export function schoonItem(x = {}){
  const soort = x.soort === 'scherm' ? 'scherm' : 'sponsor';
  return { soort, titel: tekst(x.titel, 60), tekst: tekst(x.tekst, 240), link: veiligeLink(x.link), img: plaatjeOk(x.img) ? x.img : '',
    pakket: soort === 'sponsor' && PAKKETTEN[x.pakket] ? x.pakket : (soort === 'sponsor' ? 'sponsor' : ''), tot: isIso(x.tot) ? x.tot : '',
    bedrag: soort === 'sponsor' ? Math.max(0, Math.min(999999, Math.round(Number(x.bedrag) || 0))) : 0, notitie: tekst(x.notitie, 200),
    tv: x.tv !== false, volg: Number(x.volg) || 0 };
}
export const verlopen = (x, vandaag) => !!(x?.tot && vandaag && vandaag > x.tot);
export const bijnaVerlopen = (x, vandaag, dagen = 60) => !!(x?.tot && vandaag && !verlopen(x, vandaag) && (new Date(x.tot + 'T12:00') - new Date(vandaag + 'T12:00')) / 864e5 <= dagen);
const RANG = { hoofd: 0, sponsor: 1, vriend: 2, '': 3 };
export const sorteer = lijst => [...lijst].sort((a, b) => (RANG[a.pakket] ?? 3) - (RANG[b.pakket] ?? 3) || (a.volg || 0) - (b.volg || 0) || String(a.titel).localeCompare(String(b.titel), 'nl'));
/* Wat de tv mag zien: alleen wat aan staat en niet verlopen is, zonder bedrag en notitie. */
export function openbaarItem(x, vandaag){
  const s = schoonItem(x);
  if (!s.tv || verlopen(s, vandaag) || !(s.titel || s.tekst || s.img)) return null;
  return { soort: s.soort, titel: s.titel, tekst: s.tekst, link: s.link, img: s.img, pakket: s.pakket, volg: s.volg };
}
export function sponsorTotaal(lijst = [], vandaag = ''){
  const sp = lijst.map(schoonItem).filter(x => x.soort === 'sponsor'), actief = sp.filter(x => !verlopen(x, vandaag));
  return { n: sp.length, actief: actief.length, bedrag: actief.reduce((s, x) => s + x.bedrag, 0), verlopen: sp.length - actief.length, bijna: actief.filter(x => bijnaVerlopen(x, vandaag)).length };
}
const csvCel = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csvSponsoren(lijst = [], vandaag = ''){
  const rijen = sorteer(lijst.map(schoonItem).filter(x => x.soort === 'sponsor')).map(x => [x.titel, PAKKETTEN[x.pakket] || '', x.bedrag || '', x.tot, verlopen(x, vandaag) ? 'verlopen' : 'actief', x.link, x.notitie]);
  return '﻿' + [['Sponsor', 'Pakket', 'Bedrag per jaar', 'Loopt tot', 'Status', 'Website', 'Notitie'], ...rijen].map(r => r.map(csvCel).join(';')).join('\r\n');
}
/* De openbare kop van de tv: clubnaam, logo, kleur, mededeling en het programma. */
export function tvKopie({ clubNaam = '', logo = '', kleur = '', mededeling = '', uit = true, datum = '', programma = [] } = {}){
  return { clubNaam: tekst(clubNaam, 80), logo: plaatjeOk(logo) ? logo : '', kleur: /^#[0-9a-f]{6}$/i.test(kleur || '') ? kleur : '', mededeling: tekst(mededeling, 200),
    uit: uit !== false, datum: isIso(datum) ? datum : '', programma: (Array.isArray(programma) ? programma : []).slice(0, MAX_PROGRAMMA) };
}
