/* ====================================================================
   PLATFORM-LOGICA — pure functies voor het platformcentrum (platform-centrum.js).
   Geen Firebase, geen DOM: getest in tests/platform-logica.test.mjs.
   Bron is platformstats/overzicht (functions/platform.js); zonder dat document
   (terugval) is er geen fase-informatie en geven de functies 'onbekend'.
==================================================================== */

export const FASES = [
  { id: 'goedgekeurd', naam: 'Goedgekeurd', uitleg: 'Club bestaat, nog geen teams' },
  { id: 'inrichten',   naam: 'Inrichten',   uitleg: 'Aan de slag nog niet af' },
  { id: 'proef',       naam: 'Proef',       uitleg: 'Eerste weken na de start' },
  { id: 'actief',      naam: 'Actief',      uitleg: 'Wordt gebruikt' },
  { id: 'slapend',     naam: 'Slapend',     uitleg: 'Al een tijd geen gebruik' },
];
export const FASE_NAAM = Object.fromEntries(FASES.map(f => [f.id, f.naam]));
export const STANDAARD = { proefDagen: 14, slapendDagen: 21 };

const DAG = 86400000;
export function dagenSinds(iso, nuMs = Date.now()){
  if (!iso) return null;
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((nuMs - t) / DAG)) : null;
}

/* Fase van een club in de uitrol. k = één club uit platformstats/overzicht.clubs. */
export function faseVan(k, nuMs = Date.now(), opties = {}){
  const { proefDagen, slapendDagen } = { ...STANDAARD, ...opties };
  if (!k || k.terugvalRij || !k.startlijst) return 'onbekend';
  if (!k.teams) return 'goedgekeurd';
  const stil = dagenSinds(k.laatsteGebruik, nuMs);
  const leeftijd = k.gemaakt ? dagenSinds(k.gemaakt, nuMs) : Infinity;
  const slaapt = stil == null ? leeftijd >= slapendDagen : stil >= slapendDagen;
  const st = k.startlijst;
  if (st.gedaan < st.totaal) return slaapt && leeftijd >= 30 ? 'slapend' : 'inrichten';
  if (leeftijd < proefDagen) return 'proef';
  return slaapt ? 'slapend' : 'actief';
}

/* Eén korte regel: wat is de volgende stap voor deze club? stapNaam = { stapId: titel } uit startlijst.js. */
export function volgendeStap(k, fase, stapNaam = {}, nuMs = Date.now(), opties = {}){
  const { proefDagen } = { ...STANDAARD, ...opties };
  if (fase === 'goedgekeurd') return k.sportlink?.gekoppeld ? 'Teams uit Sportlink halen' : 'Teams aanmaken';
  if (fase === 'inrichten'){ const s = (k.startlijst?.open || [])[0]; return s ? (stapNaam[s] || s) : ''; }
  if (fase === 'proef'){
    const rest = Math.max(1, proefDagen - (dagenSinds(k.gemaakt, nuMs) || 0));
    return `Proef loopt nog ${rest} dag${rest === 1 ? '' : 'en'}`;
  }
  if (fase === 'slapend') return 'Contact opnemen';
  return '';
}

/* Clubnamen vergelijken zonder voorvoegsels en leestekens: "V.V. De Leeuwen" == "De Leeuwen". */
const VOORVOEGSELS = /^(r\.?k\.?\s*)?(s\.?v\.?v\.?|v\.?v\.?|s\.?v\.?|f\.?c\.?|v\.?c\.?|s\.?c\.?|k\.?v\.?v\.?|rkvv|rksv|rkv|rkvb|vv|sv|fc|vc|sc|svv|kvv)\s+/i;
export function normClub(naam){
  let s = String(naam || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  s = s.replace(VOORVOEGSELS, '');
  return s.replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
/* Welke Cluppie-club hoort bij de clubnaam die een losse trainer zelf invulde? */
export function herkenClub(eigenNaam, clubs = []){
  const n = normClub(eigenNaam);
  if (n.length < 2) return null;
  return clubs.find(c => normClub(c.naam) === n) || null;
}

/* Zoeken in de clublijst: naam, plaats en teamnamen. */
export function clubPast(k, zoek){
  const z = String(zoek || '').trim().toLowerCase();
  if (!z) return true;
  return [k.naam, k.plaats, ...(k.teamNamen || [])].some(x => String(x || '').toLowerCase().includes(z));
}
export function filterClubs(clubs, { filter = 'alle', zoek = '', fase = null } = {}){
  return clubs.filter(k => {
    const aandacht = k.status === 'rood' || k.status === 'oranje';
    if (filter === 'aandacht' && !aandacht) return false;
    if (filter === 'groen' && k.status !== 'groen') return false;
    if (fase && k.fase !== fase) return false;
    return clubPast(k, zoek);
  });
}

/* "Vandaag doen": alles wat een actie van de eindbaas vraagt, op volgorde van belang.
   Elk item: { soort, niveau ('info'|'rood'|'oranje'), titel, sub, clubId?, aanmeldingId?, uid? }. */
export function vandaagDoen({ clubs = [], aanmeldingen = [], trainers = [] } = {}){
  const uit = [];
  for (const a of aanmeldingen) uit.push({ soort: 'aanmelding', niveau: 'info', aanmeldingId: a.id,
    titel: `${a.clubNaam || 'Een club'} wil Cluppie gebruiken`,
    sub: [a.plaats, a.aantalTeams ? a.aantalTeams + ' teams' : '', a.rol ? 'aangemeld door ' + String(a.rol).toLowerCase() : ''].filter(Boolean).join(' · ') });
  const sig = niveau => {
    for (const k of clubs) for (const s of (k.signalen || [])) if (s.niveau === niveau)
      uit.push({ soort: 'club', niveau, clubId: k.id, titel: `${k.naam}: ${s.tekst}`, sub: [FASE_NAAM[k.fase] || '', k.teams != null ? k.teams + ' teams' : ''].filter(Boolean).join(' · ') });
  };
  sig('rood');
  for (const t of trainers) if (t.club && t.club.id && t.status === 'eigen-team')
    uit.push({ soort: 'trainer', niveau: 'oranje', uid: t.uid, clubId: t.club.id,
      titel: `${t.naam} traint bij ${t.club.naam}, dat al Cluppie gebruikt`,
      sub: `los team ${(t.teams || []).map(x => x.naam).filter(Boolean).join(', ') || ''}`.trim() + ' · kan aan de club gekoppeld worden' });
  sig('oranje');
  return uit;
}

/* Losse trainers verrijken met de Cluppie-club die bij hun zelf ingevulde club hoort. */
export function trainersMetClub(individueel, clubs = []){
  return ((individueel && individueel.lijst) || []).map(t => {
    const eigen = (t.teams || []).map(x => x.eigenClub).find(Boolean) || t.eigenClub || null;
    const c = eigen ? herkenClub(eigen.naam, clubs) : null;
    return { ...t, eigenClub: eigen, club: c ? { id: c.id, naam: c.naam } : null };
  });
}

/* Kerncijfers bovenaan het overzicht. */
export function kpiWaarden(o, aanmeldingen = [], trainers = []){
  const t = (o && o.totalen) || {};
  const wachtCoaches = t.wachtend || 0;
  const syncFout = ((o && o.clubs) || []).filter(k => (k.signalen || []).some(s => /^Sportlink/.test(s.tekst) && s.niveau === 'rood')).length;
  return {
    actieveClubs: t.actieveClubs || 0, clubs: t.clubs || 0,
    coaches30: t.coaches30 || 0,
    trainers: t.individueel != null ? t.individueel : trainers.length, trainersNieuw: t.individueelNieuw || 0,
    wacht: aanmeldingen.length + wachtCoaches + syncFout,
    wachtUitleg: [aanmeldingen.length ? `${aanmeldingen.length} club${aanmeldingen.length === 1 ? '' : 's'}` : '', wachtCoaches ? `${wachtCoaches} coach${wachtCoaches === 1 ? '' : 'es'}` : '', syncFout ? `${syncFout} sync` : ''].filter(Boolean).join(' · '),
    aiMaand: t.aiMaand || 0,
    aiClubs: ((o && o.clubs) || []).filter(k => k.ai && k.ai.aan).length,
  };
}
