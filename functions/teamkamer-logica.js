/* ==================== TEAMKAMER — pure logica [20261116m] ====================
   De Teamkamer is de omgeving voor ouders en spelers. Zij lezen NOOIT teams/** (de gegevens van de
   coach), maar een aparte kopie onder teamkamer/{teamId}. Dit bestand bepaalt wat er in die kopie
   komt. Regel: alleen velden die hier met naam worden overgenomen bestaan voor een ouder. Een nieuw
   veld bij de coach komt dus nooit vanzelf mee.

   Bewust NIET in de kopie: reden van afwezigheid, notities, beoordelingen, leerpunten, achternaam,
   geboortedatum, speeltijd, wie niet geselecteerd is, namen van coaches (alleen de voornaam bij een
   mededeling die de coach zelf plaatst).

   Zonder firebase-imports, dus los te testen (tests/teamkamer.test.mjs). */
'use strict';

const BEURT_SOORTEN = ['rijden', 'wassen', 'fruit', 'vlaggen'];
const LIJN_STANDAARD = [
  'We moedigen het hele team aan, niet alleen ons eigen kind.',
  'De trainer coacht, wij juichen.',
  'De scheidsrechter doet zijn best. Dat laten we zo.',
];
const MAX_VOLWASSENEN = 4, MAX_TOESTELLEN = 3;
const KINDCODE_MINUTEN = 15;

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoVan = (d) => d.toISOString().slice(0, 10);
function plusDagen(iso, n){ const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoVan(d); }
/* 1 = ma … 7 = zo */
function weekdag(iso){ return ((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1; }
/* vandaag in Nederland (YYYY-MM-DD) */
function vandaagNL(nu = new Date()){
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(nu);
}
/* einde van het lopende seizoen: 30 juni (ms). Vanaf 1 juni schuift het een jaar op, zodat
   wie in juni instapt niet na een paar weken alles kwijt is. */
function seizoenEindeMs(vandaag){
  const j = Number(vandaag.slice(0, 4)), m = Number(vandaag.slice(5, 7));
  const jaar = m >= 6 ? j + 1 : j;
  return Date.UTC(jaar, 5, 30, 21, 59, 59);
}
const voornaam = (naam) => str(String(naam || '').split(/\s+/)[0], 24);

/* ---------- wat de eindbaas toestaat ----------
   Naast de hoofdschakelaar (toegestaan, hieronder) heeft elke mogelijkheid een eigen schakelaar van de
   eindbaas: per club in clubs/{id}.platformModules.teamkamerOpties, voor trainers zonder club in
   platform/instellingen.teamkamerLosOpties. Alles staat standaard UIT. Met alleen de hoofdschakelaar aan
   zien ouders de agenda en hoeveel spelers erbij zijn, meer niet. */
const OPTIES = ['namen', 'spelers', 'polls', 'beurten', 'berichten', 'afmelden', 'uitslag', 'live', 'opstelling', 'thuis', 'lijn', 'agenda', 'weer'];
function opties(team, club, platform){
  const bron = team && team.club ? (club && club.platformModules && club.platformModules.teamkamerOpties) : (platform && platform.teamkamerLosOpties);
  const uit = {};
  for (const k of OPTIES) uit[k] = !!(bron && bron[k] === true);
  return uit;
}
const ALLES_AAN = Object.fromEntries(OPTIES.map(k => [k, true]));

/* ---------- instellingen van het team (teams/{id}.teamkamer; de coach schrijft die zelf) ----------
   mag = wat de eindbaas toestaat: een keuze van de coach telt alleen als de eindbaas die mogelijkheid aan heeft. */
/* Video's bij "Thuis oefenen": van YouTube alleen de video-id, een eigen video alleen uit de opslag van
   Cluppie (clubs/{clubId}/videos). Zelfde regels als public/js/kamer-logica.js. */
const MAX_THUIS_VIDEOS = 6;
function thuisVideos(lijst){
  if (!Array.isArray(lijst)) return [];
  const uit = [];
  for (const v of lijst){
    if (!v || typeof v !== 'object') continue;
    const titel = str(v.titel, 80) || 'Video';
    if (typeof v.yt === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.yt)) uit.push({ titel, yt: v.yt });
    else if (typeof v.url === 'string' && v.url.length < 900 && /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[a-z0-9.-]+\/o\/clubs%2F/.test(v.url)) uit.push({ titel, url: v.url });
    if (uit.length >= MAX_THUIS_VIDEOS) break;
  }
  return uit;
}
function inst(team, mag = ALLES_AAN){
  const k = (team && team.teamkamer) || {};
  const lijn = Array.isArray(k.lijn) ? k.lijn.map(x => str(x, 90)).filter(Boolean).slice(0, 3) : [];
  return {
    aan: k.aan === true,
    namen: k.namen !== false && mag.namen === true,          /* voornamen van teamgenoten */
    uitslag: k.uitslag === true && mag.uitslag === true,
    live: k.live === true && mag.live === true,
    opstelling: mag.opstelling === true,
    lijn: mag.lijn === true ? (lijn.length ? lijn : LIJN_STANDAARD) : [],
    thuis: mag.thuis === true && k.thuis && typeof k.thuis.vormId === 'string' && k.thuis.vormId
      ? { vormId: str(k.thuis.vormId, 60), naam: str(k.thuis.naam, 80) } : null,
    thuisVideos: mag.thuis === true ? thuisVideos(k.thuisVideos) : [],
  };
}
/* Mag dit team een teamkamer hebben? De eindbaas zet het per club aan (platformModules.teamkamer);
   voor een trainer zonder club geldt platform/instellingen.teamkamerLos. Standaard uit. */
function toegestaan(team, club, platform){
  if (!team) return false;
  if (team.club) return !!(club && club.platformModules && club.platformModules.teamkamer === true);
  return !!(platform && platform.teamkamerLos === true);
}
/* Welke velden van het teamdocument tellen voor de kopie? (vergelijken vóór en na een wijziging) */
function teamSleutel(team){
  if (!team) return 'geen';
  return JSON.stringify([team.naam || '', team.club || '', team.teamkamer || null, team.trainingsmomenten || null,
    team.trainingsdagen || null, (team.vasteAfmeldingen || []).map(r => r && [r.spelerId, r.dag, r.van, r.tot]),
    (team.eigenClub && [team.eigenClub.naam, team.eigenClub.lat, team.eigenClub.lon]) || null]);
}

/* ---------- spelers ---------- */
const spelerActief = (p) => !!p && p.gearchiveerd !== true && p.verwijderd !== true && !!str(p.naam, 60);
/* { spelerId: { n: voornaam, nr } } of { v: true } (verborgen) */
function kamerSpelers(spelers, verborgen, namen){
  const uit = {};
  for (const p of spelers){
    if (!spelerActief(p)) continue;
    if (!namen || (verborgen && verborgen[p.id] === true)) uit[p.id] = { v: true };
    else uit[p.id] = { n: voornaam(p.naam), nr: Number.isFinite(Number(p.nummer)) && p.nummer !== '' && p.nummer != null ? Number(p.nummer) : null };
  }
  return uit;
}
const spelerSleutel = (p) => (spelerActief(p) ? JSON.stringify([voornaam(p.naam), p.nummer ?? null]) : 'geen');

/* ---------- het hoofddocument teamkamer/{teamId} ---------- */
function kamerDoc(team, club, spelers, verborgen, platform){
  const mag = opties(team, club, platform), i = inst(team, mag);
  const loc = (club && club.instellingen && club.instellingen.locatie) || (team && team.eigenClub) || {};
  const lat = Number(loc.lat), lon = Number(loc.lon);
  return {
    aan: true,
    teamNaam: str(team.naam, 60),
    clubNaam: str((club && club.naam) || (team.eigenClub && team.eigenClub.naam), 80),
    club: team.club || null,
    mag,                                   /* wat de eindbaas toestaat: de rules en de pagina van ouders lezen dit */
    namen: i.namen, uitslag: i.uitslag, live: i.live,
    lijn: i.lijn, thuis: i.thuis, thuisVideos: i.thuisVideos,
    plek: mag.weer && Number.isFinite(lat) && Number.isFinite(lon) && loc.lat != null && loc.lon != null ? { lat, lon } : null,
    spelers: kamerSpelers(spelers, verborgen, i.namen),
    aantal: spelers.filter(spelerActief).length,
  };
}

/* ---------- agenda: wedstrijd ---------- */
function projectWedstrijd(w, i, vandaag){
  if (!w || typeof w.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(w.datum)) return null;
  const datum = w.datum.slice(0, 10);
  if (datum < plusDagen(vandaag, -14) || datum > plusDagen(vandaag, 120)) return null;
  const sl = w.info || {}, eigen = w.infoEigen || {};
  const eigenPlek = !!eigen.accommodatie;
  const sel = new Set(Array.isArray(w.selectie) ? w.selectie : []);
  const afwezig = Object.keys(w.afwezigRedenen || {}).filter(id => !sel.has(id)).sort();
  const route = eigenPlek ? eigen.route : sl.route;
  const uit = {
    soort: 'wedstrijd', datum,
    tijd: str(w.aftrap, 5), thuis: w.thuis === true, tegenstander: str(w.tegenstander, 80),
    afgelast: w.status === 'afgelast',
    verzamel: str(eigen.verzamel || sl.verzamel, 5), vertrek: str(eigen.vertrek || sl.vertrek, 5),
    plek: str(eigen.accommodatie || sl.accommodatie, 120), veld: eigenPlek ? '' : str(sl.veld, 30),
    adres: str(eigenPlek ? eigen.adres : sl.adres, 120),
    plaats: str(eigenPlek ? eigen.plaatsAdres : (sl.plaatsAdres || sl.plaats), 80),
    route: /^https:\/\/www\.google\.com\/maps\//.test(route || '') ? route : '',
    afwezig, erbij: sel.size || null,
  };
  /* stand: live alleen op de wedstrijddag zelf en pas na de aftrap; de uitslag een dag later */
  const goals = Array.isArray(w.goals) ? w.goals : [];
  const kwarten = Object.values(w.kwarten || {});
  const gestart = kwarten.some(k => k && k.klok && (k.klok.running === true || k.klok.base > 0));
  const gespeeld = goals.length > 0 || kwarten.some(k => k && Object.keys(k.lineup || {}).length > 0);
  const telt = (type) => goals.filter(g => g && g.type === type).length;
  if (i.live && datum === vandaag && gestart) uit.stand = { voor: telt('voor'), tegen: telt('tegen'), bezig: kwarten.some(k => k && k.klok && k.klok.running === true) };
  else if ((i.uitslag || i.live) && datum < vandaag && gespeeld && !uit.afgelast) uit.stand = { voor: telt('voor'), tegen: telt('tegen'), bezig: false };
  /* opstelling: alleen als de coach hem voor deze wedstrijd deelt */
  if (w.deelOpstelling === true && i.opstelling === true){
    const nrs = Object.keys(w.kwarten || {}).sort((a, b) => Number(a) - Number(b));
    const lineup = (nrs.length && w.kwarten[nrs[0]] && w.kwarten[nrs[0]].lineup) || {};
    const basis = [...new Set(Object.values(lineup).filter(x => typeof x === 'string'))];
    /* [20261116p] plekken en formatie erbij, zodat ouders de opstelling op een veld zien (zelfde plek-id's als de app: K, V1, M2, A1) */
    const plekken = {};
    for (const [plek, id] of Object.entries(lineup)) if (/^(K|[VMA]\d{1,2})$/.test(plek) && typeof id === 'string') plekken[plek] = id;
    const eerste = w.kwarten[nrs[0]] || {};
    if (basis.length) uit.opstelling = { basis, wissels: [...sel].filter(id => !basis.includes(id)).sort(), plekken,
      formatie: str(eerste.formatie || w.formatie, 14), format: str(String(w.format || ''), 2) };
  }
  return uit;
}

/* ---------- agenda: trainingen ---------- */
function vasteAfwezig(team, datum){
  const dag = weekdag(datum);
  return [...new Set((team.vasteAfmeldingen || []).filter(r => r && r.spelerId && Number(r.dag) === dag
    && typeof r.van === 'string' && typeof r.tot === 'string' && r.van <= datum && datum <= r.tot).map(r => r.spelerId))].sort();
}
function momenten(team){
  if (Array.isArray(team.trainingsmomenten) && team.trainingsmomenten.length)
    return team.trainingsmomenten.filter(m => m && m.dag >= 1 && m.dag <= 7).map(m => ({ dag: Number(m.dag), start: str(m.start, 5), eind: str(m.eind, 5) }));
  return (Array.isArray(team.trainingsdagen) ? team.trainingsdagen : []).filter(d => d >= 1 && d <= 7).map(d => ({ dag: Number(d), start: '', eind: '' }));
}
/* presentie: { datum: [spelerId] } van records die al bestaan (de coach legde afwezigheid vast) */
function projectTrainingen(team, presentie, vandaag, dagen = 28){
  const ms = momenten(team), uit = {};
  for (let n = 0; n <= dagen; n++){
    const datum = plusDagen(vandaag, n), m = ms.find(x => x.dag === weekdag(datum));
    if (!m) continue;
    const rec = presentie && presentie[datum];
    uit['t_' + datum] = { soort: 'training', datum, tijd: m.start, eind: m.eind, afgelast: false,
      afwezig: Array.isArray(rec) ? [...new Set(rec)].sort() : vasteAfwezig(team, datum), erbij: null };
  }
  return uit;
}

/* ---------- polls ---------- */
/* Een poll zoals de coach hem plaatst; alles wat niet klopt wordt geweigerd (ook in de rules). */
function pollGeldig(p){
  if (!p || !str(p.vraag, 140)) return false;
  if (!Array.isArray(p.opties) || p.opties.length < 2 || p.opties.length > 12) return false;
  const ids = new Set();
  for (const o of p.opties){ if (!o || !str(o.id, 12) || !str(o.tekst, 80) || ids.has(o.id)) return false; ids.add(o.id); }
  return true;
}
function stemGeldig(poll, keuzes){
  if (!Array.isArray(keuzes) || keuzes.length > 12) return false;
  const ids = new Set((poll.opties || []).map(o => o.id));
  if (keuzes.some(k => typeof k !== 'string' || !ids.has(k))) return false;
  if (new Set(keuzes).size !== keuzes.length) return false;
  return poll.meer === true || keuzes.length <= 1;
}
/* stemmen: [{ spelerId, keuzes }] (één document per speler = één stem per gezin) */
function telStemmen(poll, stemmen){
  const telling = {}, wie = {};
  for (const o of (poll.opties || [])){ telling[o.id] = 0; wie[o.id] = []; }
  let gestemd = 0;
  for (const s of stemmen){
    if (!s || !stemGeldig(poll, s.keuzes) || !s.keuzes.length) continue;
    gestemd++;
    for (const k of s.keuzes){ telling[k]++; wie[k].push(s.spelerId); }
  }
  for (const k of Object.keys(wie)) wie[k].sort();
  return { telling, gestemd, wie: poll.namen === true ? wie : null };
}
/* wie krijgt een beurt bij het sluiten? Het eerste antwoord is "ja" (Wij rijden, Wij wassen). */
function beurtenVan(poll, stemmen){
  if (!BEURT_SOORTEN.includes(poll.soort) || !poll.opties || !poll.opties.length) return [];
  const ja = poll.opties[0].id;
  return [...new Set(stemmen.filter(s => s && stemGeldig(poll, s.keuzes) && s.keuzes.includes(ja)).map(s => s.spelerId))].sort();
}

/* ---------- toegang ---------- */
/* Wat een ouder invult bij "ik ben ouder van": alleen letters, spaties, streepje en apostrof. */
const schoonKind = (v) => str(String(v || '').replace(/[^\p{L}\p{M} '\-]/gu, ''), 40);
const lidId = (teamId, uid) => `${teamId}_${uid}`;

module.exports = {
  BEURT_SOORTEN, LIJN_STANDAARD, MAX_VOLWASSENEN, MAX_TOESTELLEN, KINDCODE_MINUTEN,
  plusDagen, weekdag, vandaagNL, seizoenEindeMs, voornaam,
  OPTIES, ALLES_AAN, opties, inst, toegestaan, teamSleutel, spelerActief, kamerSpelers, spelerSleutel, kamerDoc,
  projectWedstrijd, vasteAfwezig, momenten, projectTrainingen,
  pollGeldig, stemGeldig, telStemmen, beurtenVan, schoonKind, lidId,
};
