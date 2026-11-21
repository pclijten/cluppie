/* ==================== ROLLEN IN DE CLUB: WIE DOET WAT [20261121a] ====================
   PURE module (geen DOM, geen Firebase, geen imports): leest uit het clubdocument en de teams
   welke rollen bezet zijn en welke nog niet. Eén bron voor twee schermen:
     - Club › Mensen (club-mensen.js): de clubbeheerder ziet alle rollen op één plek;
     - Platformcentrum › clubdetail › Mensen (platform-centrum.js): de eindbaas ziet per club
       hoe ver de club is met het bezetten van de rollen.
   Getest in tests/rollen-bezetting.test.mjs.

   De uitleg per rol volgt de toegangsregels (firestore.rules, docs/rollenkaart.md, rolkaart.js):
   verander je die, pas dit aan. */

const BOUWEN_STD = [{ id: 'onder', naam: 'Onderbouw' }, { id: 'midden', naam: 'Middenbouw' }, { id: 'boven', naam: 'Bovenbouw' }];
const GRENZEN_STD = { onderTm: 11, middenTm: 15 };

/* Wat een rol ziet en doet, in één zin per regel. Gebruikt in het overzicht en bij het uitnodigen. */
export const ROL_UITLEG = {
  admin:      { doet: 'Richt de club in, nodigt mensen uit, wijst rollen toe en regelt de privacy.', ziet: 'Alles van de club.' },
  hoofdJeugd: { doet: 'Legt het seizoensplan en de speelwijze van de club vast en volgt de evaluatierondes.', ziet: 'Alle bouwen en de spelerslijsten. Geen clubinstellingen.' },
  bouw:       { doet: 'Stuurt de teams van één bouw aan, leent spelers uit en wijst het seizoensplan toe.', ziet: 'Alle teams van de eigen bouw. Geen beoordelingen van andere bouwen.' },
  eigen:      { doet: 'Zelfde als een bouwcoördinator, voor de teams van deze eigen bouw.', ziet: 'De teams van die bouw.' },
  trainco:    { doet: 'Kijkt mee wat er per week getraind wordt.', ziet: 'Trainingen en video’s van alle teams. Geen spelers, wedstrijden of beoordelingen.' },
  coach:      { doet: 'Traint en begeleidt het eigen team: wedstrijden, opstelling, aanwezigheid en ontwikkeling.', ziet: 'Het eigen team en de trainingen van de club.' },
};

const naamVan = x => String((x && typeof x === 'object' ? x.naam : x) || '').replace(/\s+/g, ' ').trim();
const aanUids = m => Object.keys(m || {}).filter(u => m[u] === true);
const uniek = l => [...new Set(l.filter(Boolean))];

/* Bouw van een team: het opgeslagen veld, anders afgeleid van de categorie (zoals config.js bouwVanCategorie). */
export function bouwVanTeamKaal(t, grenzen = GRENZEN_STD){
  if (t && ['onder', 'midden', 'boven', 'eigen'].includes(t.bouw)) return t.bouw;
  const m = String((t && t.categorie) || (t && t.naam) || '').toUpperCase().match(/[JM]?O(\d+)/);
  if (!m) return 'boven';
  const lft = Number(m[1]);
  return lft <= grenzen.onderTm ? 'onder' : lft <= grenzen.middenTm ? 'midden' : 'boven';
}

/* club = clubs/{id}-document; teams = [{ id, naam, leden, ledenInfo, bouw, categorie }].
   opties: bouwen (lijst { id, naam }), rolNamen ({ coach, coordinator, trainco, hoofdJeugd } zoals rolnamen.js levert),
           bouwVan (functie team → bouw-id), wachtend (aantal aanvragen van coaches dat op goedkeuring wacht).
   Geeft { rollen:[…], bezet, totaal, open:[id], klaar } terug. Een rol telt mee voor `totaal` als hij `nodig` is. */
export function rolBezetting(club = {}, teams = [], opties = {}){
  const bouwen = opties.bouwen || BOUWEN_STD;
  const grenzen = { ...GRENZEN_STD, ...((club.instellingen && club.instellingen.regels && club.instellingen.regels.bouwGrenzen) || {}) };
  const bouwVan = opties.bouwVan || (t => bouwVanTeamKaal(t, grenzen));
  const rn = opties.rolNamen || {};
  const rollen = [];

  /* clubbeheerders */
  const adminUids = aanUids(club.admins);
  rollen.push({ id: 'admin', soort: 'admin', naam: 'Clubbeheerder', nodig: true,
    mensen: uniek(adminUids.map(u => naamVan((club.adminsInfo || {})[u]) || naamVan((club.ledenInfo || {})[u]))), aantal: adminUids.length,
    advies: adminUids.length === 1 ? 'Eén beheerder is kwetsbaar: voeg een tweede toe voor als de eerste er niet is.' : '' });

  /* hoofd jeugdopleiding */
  const hjUids = aanUids(club.hoofdJeugd);
  rollen.push({ id: 'hoofdJeugd', soort: 'hoofdJeugd', naam: rn.hoofdJeugd || 'Hoofd jeugdopleiding', nodig: true,
    mensen: uniek(hjUids.map(u => naamVan((club.hoofdJeugdInfo || {})[u]))), aantal: hjUids.length });

  /* bouwcoördinatoren: alleen een bouw met teams heeft er een nodig */
  const bcInfo = club.bouwCoordinatorenInfo || {};
  for (const b of bouwen){
    const inBouw = teams.filter(t => bouwVan(t) === b.id);
    const uids = aanUids((club.bouwCoordinatoren || {})[b.id]);
    if (!inBouw.length && !uids.length) continue;
    rollen.push({ id: 'bouw:' + b.id, soort: 'bouw', bouw: b.id, naam: `${rn.coordinator || 'Bouwcoördinator'} ${String(b.naam || b.id).toLowerCase()}`, nodig: inBouw.length > 0,
      /* de info staat per uid, in oudere documenten per bouw en dan per uid */
      mensen: uniek(uids.map(u => naamVan(bcInfo[u]) || naamVan((bcInfo[b.id] || {})[u]))), aantal: uids.length, teams: inBouw.length });
  }

  /* eigen bouwen (bijv. Meiden, Keepers): gekoppelde coaches */
  for (const eb of (Array.isArray(club.eigenBouwen) ? club.eigenBouwen : []).filter(x => x && x.id)){
    const uids = aanUids(eb.coaches);
    rollen.push({ id: 'eigen:' + eb.id, soort: 'eigen', naam: `Coach bij ${eb.naam || 'eigen bouw'}`, nodig: false,
      mensen: uniek(uids.map(u => naamVan((club.eigenBouwCoachesInfo || {})[u]))), aantal: uids.length, teams: (eb.teams || []).length });
  }

  /* trainingscoördinator: geen clublid, eigen rol; niet verplicht */
  const tcUids = aanUids(club.trainingscoordinatoren);
  rollen.push({ id: 'trainco', soort: 'trainco', naam: rn.trainco || 'Trainingscoördinator', nodig: false,
    mensen: uniek(tcUids.map(u => naamVan((club.trainingscoordinatorenInfo || {})[u]) || naamVan((club.ledenInfo || {})[u]))), aantal: tcUids.length });

  /* coaches: elk team heeft er minstens één nodig (zelfde telling als coachesVanTeam in club-beheer.js) */
  const coachUids = new Set(), zonder = [];
  for (const t of teams){
    const leden = aanUids(t.leden);
    if (!leden.length) zonder.push(String(t.naam || 'Team'));
    leden.forEach(u => coachUids.add(u));
  }
  const wachtend = Math.max(0, Number(opties.wachtend) || 0);
  rollen.push({ id: 'coach', soort: 'coach', naam: rn.coach ? `${rn.coach}s` : 'Coaches', nodig: true, mensen: [], aantal: coachUids.size,
    teams: teams.length, teamsMet: teams.length - zonder.length, teamsZonder: zonder.sort((a, b) => a.localeCompare(b, 'nl', { numeric: true })), wachtend });

  for (const r of rollen){
    r.bezet = r.soort === 'coach' ? (teams.length > 0 && !zonder.length) : r.aantal > 0;
    r.doet = ROL_UITLEG[r.soort].doet; r.ziet = ROL_UITLEG[r.soort].ziet;
    r.stand = r.soort === 'coach'
      ? (!teams.length ? 'Nog geen teams' : zonder.length ? `${r.teamsMet} van ${teams.length} teams hebben een coach` : `Alle ${teams.length} teams hebben een coach`)
      : (r.aantal ? (r.mensen.join(', ') || `${r.aantal} ${r.aantal === 1 ? 'persoon' : 'personen'}`) : 'Nog niemand');
  }
  const telt = rollen.filter(r => r.nodig);
  const open = telt.filter(r => !r.bezet).map(r => r.id);
  return { rollen, bezet: telt.length - open.length, totaal: telt.length, open, klaar: !open.length };
}

/* Eén regel voor een lijst of kaart: "4 van 6 rollen bezet · nog open: hoofd jeugdopleiding, coaches". */
export function bezettingRegel(b){
  if (!b || !b.totaal) return '';
  if (b.klaar) return `Alle ${b.totaal} rollen bezet`;
  const namen = b.rollen.filter(r => b.open.includes(r.id)).map(r => r.naam.toLowerCase());
  return `${b.bezet} van ${b.totaal} rollen bezet · nog open: ${namen.join(', ')}`;
}

/* ---------- Vervolg op "Aan de slag" ----------
   De startlijst (startlijst.js) zet een club technisch klaar. Daarna gaat het om wie wat doet en welke
   richting de club kiest. Deze stappen staan alleen in de client: ze tellen niet mee voor de fase in het
   Platformcentrum (dat rekent met de zeven stappen uit functions/platform.js). */
export const VERVOLG_STAPPEN = [
  { id: 'werkwijze',  titel: 'Kies wie de trainingen maakt', uitleg: 'Trainers vrij, of de club stuurt met één plan.',                  actie: 'instellingen:ai' },
  { id: 'hoofdJeugd', titel: 'Wijs een hoofd jeugdopleiding aan', uitleg: 'Maakt het seizoensplan en legt de speelwijze vast.',         actie: 'mensen' },
  { id: 'bouwen',     titel: 'Wijs per bouw een coördinator aan', uitleg: 'Kijkt mee in de teams van de bouw en leent spelers uit.',    actie: 'mensen' },
  { id: 'coaches',    titel: 'Elk team een coach',                uitleg: 'Deel de teamlinks; een team zonder coach wordt niet gebruikt.', actie: 'mensen' },
  { id: 'speelwijze', titel: 'Leg de speelwijze vast',            uitleg: 'Hoe wil de club voetballen? Het stuurt trainingen en evaluaties.', actie: 'speelstijl' },
];
/* extra = { werkwijzeGekozen, speelwijzeVast }: wat niet uit club en teams af te leiden is. */
export function vervolgStatus(club = {}, teams = [], extra = {}, opties = {}){
  const b = rolBezetting(club, teams, opties);
  const rol = id => b.rollen.find(r => r.id === id);
  const bouwRollen = b.rollen.filter(r => r.soort === 'bouw' && r.nodig);
  const klaar = {
    werkwijze: extra.werkwijzeGekozen === true || !!(club.instellingen && club.instellingen.werkwijze),
    hoofdJeugd: !!(rol('hoofdJeugd') && rol('hoofdJeugd').bezet),
    bouwen: bouwRollen.length > 0 && bouwRollen.every(r => r.bezet),
    coaches: !!(rol('coach') && rol('coach').bezet),
    speelwijze: extra.speelwijzeVast === true,
  };
  const stappen = VERVOLG_STAPPEN.map(s => ({ ...s, klaar: !!klaar[s.id] }));
  const gedaan = stappen.filter(s => s.klaar).length;
  return { stappen, gedaan, totaal: stappen.length, compleet: gedaan === stappen.length, bezetting: b };
}
