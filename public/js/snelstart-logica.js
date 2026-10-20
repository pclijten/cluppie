/* ==================== SNELSTART (PURE LOGICA) [20261020b] ====================
   Voor een trainer die zelf begint, zonder club. Geen DOM en geen Firebase, zodat het te testen is
   (tests/snelstart.test.mjs). De schermen staan in snelstart.js.

   Teamdocument, nieuw veld (geen rules-wijziging nodig, zie firestore.rules):
     eigenClub: { naam, plaats, lat, lon, clubcode? }
   `club` en `clubNaam` blijven voorbehouden aan een echte Cluppie-club. */

export const STANDAARD_CAT = { j: 'JO11', m: 'MO11' };

const spaties = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const rond = n => Math.round(n * 1000) / 1000;

/* Club: vrije tekst is altijd goed; alleen te kort of te lang valt af. */
export function valideerClub(invoer){
  const naam = spaties(invoer);
  if (naam.length < 2) return { ok: false, naam, fout: 'Vul de naam van je club in' };
  if (naam.length > 60) return { ok: false, naam, fout: 'De clubnaam is te lang (maximaal 60 tekens)' };
  return { ok: true, naam, fout: '' };
}

/* Plaats: {plaats, lat?, lon?}. Zonder coördinaten mag het, maar dan is er geen weer. */
export function valideerPlaats(p){
  const plaats = spaties(p && p.plaats);
  if (plaats.length < 2) return { ok: false, plaats, lat: null, lon: null, weer: false, fout: 'Vul de plaats van je club in' };
  if (plaats.length > 60) return { ok: false, plaats, lat: null, lon: null, weer: false, fout: 'De plaatsnaam is te lang (maximaal 60 tekens)' };
  const lat = Number(p.lat), lon = Number(p.lon);
  const weer = p.lat !== null && p.lat !== undefined && p.lon !== null && p.lon !== undefined && p.lat !== '' && p.lon !== ''
    && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return { ok: true, plaats, lat: weer ? rond(lat) : null, lon: weer ? rond(lon) : null, weer, fout: '' };
}

/* Het object dat op het team komt. Geen `undefined` (Firestore weigert dat). */
export function bouwEigenClub({ naam, plaats, lat = null, lon = null, clubcode = '' } = {}){
  const c = valideerClub(naam), p = valideerPlaats({ plaats, lat, lon });
  if (!c.ok) return { ok: false, fout: c.fout };
  if (!p.ok) return { ok: false, fout: p.fout };
  const eigenClub = { naam: c.naam, plaats: p.plaats, lat: p.lat, lon: p.lon };
  const code = spaties(clubcode);
  if (code) eigenClub.clubcode = code;
  return { ok: true, eigenClub, weer: p.weer };
}

/* Is stap 2 (club + plaats) af? */
export function teamStapKlaar(club, plaats){
  return valideerClub(club).ok && valideerPlaats({ plaats }).ok;
}

/* Standaard teamnaam, zelfde regels als "Nieuw team" in teams.js. `label` is catLabel(categorie). */
export function standaardTeamNaam(categorie, label, nr){
  const n = String(nr || '1');
  if (categorie === 'Senioren') return n === '1' ? 'Eerste elftal' : 'Senioren ' + n;
  if (categorie === 'Vrouwen') return n === '1' ? 'Vrouwen 1' : 'Vrouwen ' + n;
  return (label || categorie) + '-' + n;
}

/* Een categorie die bij het gekozen geslacht past; anders de standaard. */
export function categorieVoor(geslacht, huidig, lijst){
  const g = geslacht === 'm' ? 'm' : 'j';
  return (lijst || []).includes(huidig) ? huidig : (lijst || []).includes(STANDAARD_CAT[g]) ? STANDAARD_CAT[g] : (lijst || [])[0] || '';
}

/* Weerlocatie voor een team zonder club. `teams` = de teams van de coach, `team` = het geopende team (of null).
   Een team met club gebruikt de clubinstellingen; dit is alleen de terugval. */
export function weerVanTeam(teams, team){
  const bruikbaar = t => t && !t.club && t.eigenClub && valideerPlaats({ plaats: t.eigenClub.plaats, lat: t.eigenClub.lat, lon: t.eigenClub.lon }).weer;
  const t = bruikbaar(team) ? team : (teams || []).find(bruikbaar);
  if (!t) return null;
  const e = t.eigenClub;
  return { plaats: e.plaats, lat: Number(e.lat), lon: Number(e.lon) };
}

/* ---------- Eerste stappen ---------- */
export const EERSTE_STAPPEN = [
  { id: 'spelers',   titel: 'Voeg je spelers toe',       uitleg: 'Alleen voornamen. Plak een lijst of tik ze één voor één in.', tab: 'spelers' },
  { id: 'wedstrijd', titel: 'Maak je eerste wedstrijd',  uitleg: 'Daarna maak je de opstelling met eerlijke speeltijd.',        tab: 'wedstrijden' },
  { id: 'training',  titel: 'Maak je eerste training',   uitleg: 'Kies een thema. Je krijgt een volledig draaiboek.',           tab: 'trainingsmodule' },
  { id: 'collega',   titel: 'Nodig een collega uit',     uitleg: 'Deel de persoonlijke link. Handig als je met twee trainers bent.', tab: 'instellingen' },
];

/* Moet de kaart getoond worden? Alleen bij een team zonder club, niet verborgen, niet af. */
export function toonEersteStappen(team, { verborgen = false, status = null } = {}){
  if (!team || team.club) return false;
  if (verborgen) return false;
  return !(status && status.compleet);
}

/* team: teamdocument. data: { spelers, wedstrijden, training } (aantallen of booleans). */
export function eersteStappenStatus(team, data = {}){
  const klaar = {
    spelers: Number(data.spelers) > 0,
    wedstrijd: Number(data.wedstrijden) > 0,
    training: !!data.training,
    collega: Object.keys((team && team.leden) || {}).length > 1,
  };
  const stappen = EERSTE_STAPPEN.map(s => ({ ...s, klaar: !!klaar[s.id] }));
  const gedaan = stappen.filter(s => s.klaar).length;
  const volgende = stappen.find(s => !s.klaar);
  return { stappen, gedaan, totaal: stappen.length, compleet: gedaan === stappen.length, volgende: volgende ? volgende.id : null };
}

/* Tip voor een bestaand los team (gemaakt vóór Snelstart): club en plaats ontbreken. */
export function toonClubTip(team, { verborgen = false } = {}){
  return !!team && !team.club && !team.eigenClub && !verborgen;
}
