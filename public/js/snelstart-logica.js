/* ==================== SNELSTART (PURE LOGICA) [20261020c] ====================
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

/* ---------- [20261116e] Welkom voor een coach die bij een clubteam komt (meestal via een uitnodiging) ----------
   Het team bestaat al, dus de stappen gaan over gebruiken, niet over inrichten. Alleen voor een nieuw
   account (standaard 30 dagen), zodat coaches die al langer meedoen de kaart niet ineens krijgen. */
export const WELKOM_STAPPEN = [
  { id: 'training',  titel: 'Bekijk de training van deze week',            uitleg: 'Onder Trainingen staan de trainingen voor je team.',        tab: 'trainingen' },
  { id: 'presentie', titel: 'Vul de aanwezigheid in',                      uitleg: 'Eén tik per speler. Zo klopt de opkomst over het seizoen.', tab: 'presentietraining' },
  { id: 'wedstrijd', titel: 'Maak de opstelling voor je volgende wedstrijd', uitleg: 'Cluppie houdt de speeltijd per speler voor je bij.',       tab: 'wedstrijden' },
];
export function isNieuwAccount(creationTime, nu = Date.now(), dagen = 30){
  const t = Date.parse(creationTime || '');
  return Number.isFinite(t) && nu - t >= 0 && nu - t <= dagen * 86400000;
}
/* data: { trainingGelezen, presentie, opstelling } (booleans of aantallen) */
export function welkomCoachStatus(data = {}){
  const klaar = { training: !!data.trainingGelezen, presentie: Number(data.presentie) > 0 || data.presentie === true, wedstrijd: !!data.opstelling };
  const stappen = WELKOM_STAPPEN.map(s => ({ ...s, klaar: !!klaar[s.id] }));
  const gedaan = stappen.filter(s => s.klaar).length, volgende = stappen.find(s => !s.klaar);
  return { stappen, gedaan, totaal: stappen.length, compleet: gedaan === stappen.length, volgende: volgende ? volgende.id : null };
}
/* Alleen bij een clubteam waar je zelf coach van bent, met een nieuw account, niet verborgen, niet af. */
export function toonWelkomCoach(team, uid, { verborgen = false, nieuw = false, status = null } = {}){
  if (!team || !team.club || !uid || !(team.leden && team.leden[uid] === true)) return false;
  if (verborgen || !nieuw) return false;
  return !(status && status.compleet);
}

/* Tip voor een bestaand los team (gemaakt vóór Snelstart): club en plaats ontbreken. */
export function toonClubTip(team, { verborgen = false } = {}){
  return !!team && !team.club && !team.eigenClub && !verborgen;
}

/* ---------- [20261122a] Deelknop: stuur je jeugdcoördinator een bericht ----------
   Voor een trainer zonder club die de app echt gebruikt (minstens twee eerste stappen gedaan).
   Niet als zijn club al herkend is: dan staat de kaart "… gebruikt Cluppie" er (koppelVoorstel).
   De tekst is die uit marketing/verkoopteksten.md, deel 1. Verandert het aanbod, pas dan beide aan. */
export const DEEL_URL = 'https://www.cluppie.io';
export function deelTekstClub(){
  return 'Hoi, ik gebruik sinds kort Cluppie voor mijn team. Ik maak er de opstelling in, het houdt de speeltijd per speler bij en ik haal er mijn trainingen uit. '
    + 'Het werkt ook voor de hele club: één seizoensplan per bouw, teams en wedstrijden uit Sportlink, en als een trainer stopt blijft alles bewaard. '
    + 'Clubs die nu beginnen gebruiken het een half jaar gratis. Wil je er eens naar kijken? ' + DEEL_URL;
}
export function toonDeelClub(team, { verborgen = false, status = null } = {}){
  if (!team || team.club || verborgen) return false;
  if (team.koppelVoorstel && team.koppelVoorstel.clubId) return false;
  return !!status && status.gedaan >= 2;
}

/* ---------- [20261122a] Herkennen dat de club al meedoet ----------
   De server (functie herkenClub) zoekt de club; hier alleen: wanneer vragen we het? Een team zonder
   club, met een ingevulde club, zonder voorstel, en hooguit één keer per week per team. */
export const HERKEN_DAGEN = 7;
export function magClubHerkennen(team, { laatstMs = 0, nu = Date.now() } = {}){
  if (!team || team.club || !team.eigenClub || !team.eigenClub.naam) return false;
  if (team.koppelVoorstel) return false;
  return !(Number(laatstMs) > 0 && nu - Number(laatstMs) < HERKEN_DAGEN * 86400000);
}
