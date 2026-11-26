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

/* De stand van een wedstrijd, altijd thuis – uit. Komt uit de uitslag (Sportlink) of, tijdens de wedstrijd,
   uit de doelpunten die de coach in de app bijhoudt (w.goals). eind: de wedstrijd is afgelopen;
   bezig: de klok van een periode loopt of heeft gelopen en er is nog geen einde. Geen spelersnamen. */
export function standVan(w = {}){
  const thuis = w.thuis !== false, zet = (v, t) => thuis ? `${v} - ${t}` : `${t} - ${v}`;
  const voor = Number(w.doelBin), tg = Number(w.doelTegen);
  if (w.resultaat && Number.isFinite(voor) && Number.isFinite(tg)) return { stand: zet(voor, tg), eind: true, bezig: false };
  if (/^\d+\s*-\s*\d+$/.test(String(w.uitslag || ''))) return { stand: String(w.uitslag).replace(/\s*-\s*/, ' - '), eind: true, bezig: false };
  const goals = Array.isArray(w.goals) ? w.goals : [], kw = w.kwarten && typeof w.kwarten === 'object' ? w.kwarten : {};
  const nrs = Object.keys(kw).sort((a, b) => Number(a) - Number(b)), klok = k => (kw[k] && kw[k].klok) || {};
  const loopt = nrs.some(k => klok(k).running), gestart = loopt || nrs.some(k => Number(klok(k).base) > 0);
  const laatste = nrs[nrs.length - 1], eind = !!laatste && !loopt && Number(klok(laatste).base) > 0;
  if (!goals.length && !gestart) return { stand: '', eind: false, bezig: false };
  return { stand: zet(goals.filter(g => g && g.type === 'voor').length, goals.filter(g => g && g.type === 'tegen').length), eind, bezig: !eind };
}
/* Eén wedstrijd van een team als regel voor de tv. Stand altijd thuis – uit. */
export function programmaRij(team = {}, w = {}){
  if (!w || !isIso(w.datum)) return null;
  const thuis = w.thuis !== false, eigen = tekst(team.naam, 40) || 'Team', tegen = tekst(w.tegenstander, 60) || 'Tegenstander';
  const { stand, eind, bezig } = standVan(w);
  return { datum: w.datum, tijd: isTijd(w.aftrap) ? w.aftrap.padStart(5, '0') : '', thuis, a: thuis ? eigen : tegen, b: thuis ? tegen : eigen,
    veld: tekst(w.info?.veld, 30), kk: tekst(w.info?.kleedkamer, 30), stand, eind, bezig, afgelast: w.status === 'afgelast', soort: tekst(w.competitiesoort, 20) };
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
export function tvKopie({ clubNaam = '', logo = '', kleur = '', mededeling = '', uit = true, datum = '', programma = [], sjabloon = '', goals = '', evenement = '' } = {}){
  return { clubNaam: tekst(clubNaam, 80), logo: plaatjeOk(logo) ? logo : '', kleur: /^#[0-9a-f]{6}$/i.test(kleur || '') ? kleur : '', mededeling: tekst(mededeling, 200),
    uit: uit !== false, datum: isIso(datum) ? datum : '', programma: (Array.isArray(programma) ? programma : []).slice(0, MAX_PROGRAMMA),
    sjabloon: /^[a-z0-9-]{1,30}$/.test(sjabloon || '') ? sjabloon : 'bord', goals: goalKeuze(goals), evenement: evenementId(evenement) };
}
/* [20261126r] Een evenement (toernooi) op de kantine-tv: de id van de live pagina (toernooiLive/{id}), of leeg. */
export const evenementId = v => /^[a-z0-9]{10,40}$/.test(String(v || '')) ? String(v) : '';
/* Zet de live pagina van een toernooi om naar wat de tv kent: programmaregels, een mededeling en dia's.
   Alleen op de dag van het toernooi (vandaag: JJJJ-MM-DD); anders null, dan toont de tv het gewone programma. */
export function evenementTv(live, vandaag){
  if (!live || live.open !== true || (live.datum && live.datum !== vandaag)) return null;
  const teams = live.teams || {}, velden = Object.fromEntries((live.veldjes || []).map(v => [v.id, v.naam])), poules = live.poules || {};
  const duur = (Number(live.duur) || 12) + (Number(live.wissel) || 0), uitslag = live.uitslag || {};
  const programma = (Array.isArray(live.schema) ? live.schema : []).filter(w => isTijd(w.t))
    .map(w => { const u = uitslag[w.id], p = poules[w.p]?.naam;
      return { tijd: w.t, thuis: true, a: tekst(teams[w.a]?.naam || 'Nog onbekend', 40), b: tekst(teams[w.b]?.naam || 'Nog onbekend', 40),
        veld: tekst([velden[w.v], p].filter(Boolean).join(' · '), 60), kk: '', duur,
        stand: u ? `${u.a} - ${u.b}` : '', eind: !!u, bezig: false }; })
    .sort((x, y) => min(x.tijd) - min(y.tijd)).slice(0, MAX_PROGRAMMA);
  const med = live.planB || (Array.isArray(live.mededelingen) && live.mededelingen[0]?.tekst) || '';
  const items = (Array.isArray(live.schermen) ? live.schermen : []).filter(x => x && x.tv !== false && (x.titel || x.tekst || x.img))
    .map(x => ({ id: 'ev-' + x.id, soort: x.soort === 'sponsor' ? 'sponsor' : 'scherm', pakket: 'sponsor', titel: tekst(x.titel, 60), tekst: tekst(x.tekst, 240), img: plaatjeOk(x.img) ? x.img : '' }));
  return { naam: tekst(live.naam, 80), programma, mededeling: tekst(med, 200), items };
}

/* ---------- tv: status van een wedstrijd en doelpunten ---------- */
/* Welke doelpunten krijgen een melding op de tv? park: alleen wedstrijden op het eigen sportpark (thuis). */
export const GOAL_KEUZES = { park: 'Alleen wedstrijden op ons sportpark', alle: 'Alle wedstrijden, ook uit', uit: 'Geen melding' };
export const goalKeuze = v => GOAL_KEUZES[v] ? v : 'park';
const cijfers = s => { const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(s || '')); return m ? [Number(m[1]), Number(m[2])] : null; };
export const rijSleutel = r => [r.tijd, r.a, r.b].join('|');
/* af | klaar | live | straks | voorbij. nuMin: minuten sinds middernacht. Oude regels (zonder eind) met een stand zijn afgelopen. */
export function rijStatus(r = {}, nuMin = 0){
  if (r.afgelast) return 'af';
  const t = min(r.tijd), heeftTijd = t !== 9999;
  if (r.eind === true || (r.eind === undefined && r.stand) || (r.stand && heeftTijd && nuMin > t + 150)) return 'klaar';
  if (r.bezig || r.stand || (r.thuis && heeftTijd && t <= nuMin && nuMin < t + (Number(r.duur) || 105))) return 'live';
  return !heeftTijd || nuMin < t ? 'straks' : 'voorbij';
}
/* Vergelijkt het programma met wat de tv al gezien had (gezien: Map sleutel -> stand) en geeft de nieuwe doelpunten.
   De eerste keer dat een wedstrijd gezien wordt geeft nooit een melding (anders flitst het scherm bij het opstarten),
   net zomin als een uitslag die achteraf binnenkomt of een correctie naar beneden. Werkt gezien bij. */
export function nieuweGoals(gezien, programma = [], keuze = 'park'){
  const uit = [];
  for (const r of programma){
    const k = rijSleutel(r), nu = cijfers(r.stand), had = gezien.has(k), oud = had ? (cijfers(gezien.get(k)) || [0, 0]) : null;
    const achteraf = had && !gezien.get(k) && r.eind === true;
    gezien.set(k, r.stand || '');
    if (!nu || !oud || achteraf || r.afgelast || keuze === 'uit' || (keuze !== 'alle' && !r.thuis)) continue;
    const da = nu[0] - oud[0], db = nu[1] - oud[1];
    if (da < 0 || db < 0 || da + db < 1 || da + db > 2) continue;
    const kant = da > 0 ? 'a' : 'b';
    uit.push({ sleutel: k, a: r.a, b: r.b, stand: `${nu[0]}–${nu[1]}`, kant, team: kant === 'a' ? r.a : r.b, eigen: (kant === 'a') === !!r.thuis, thuis: !!r.thuis, veld: r.veld || '' });
  }
  return uit;
}
