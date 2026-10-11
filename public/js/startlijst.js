/* ==================== STARTLIJST ("Aan de slag") ====================
   PURE module (geen DOM, geen Firebase): bepaalt welke opstartstappen een club al heeft gezet.
   Gebruikt door de club-hub (kaart "Aan de slag") en, als kopie, door functions/platform.js
   (platformdashboard). tests/startlijst.test.mjs controleert dat beide gelijk blijven.

   club:  clubs/{id}-document   teams: [{ leden, trainingsdagen, ... }] van deze club
   Elke stap: { id, titel, uitleg, klaar, actie }  — `actie` is het scherm dat de stap oplost. */

export const STARTLIJST_STAPPEN = [
  { id: 'uiterlijk',   titel: 'Logo en clubkleur',          uitleg: 'Je coaches herkennen meteen hun eigen club.',            actie: 'instellingen:identiteit' },
  { id: 'sportlink',   titel: 'Sportlink koppelen',          uitleg: 'Programma, uitslagen en standen komen dan vanzelf binnen.', actie: 'instellingen:competitie' },
  { id: 'teams',       titel: 'Teams aanmaken',              uitleg: 'In één keer uit Sportlink, of zelf.',                    actie: 'teams' },
  { id: 'trainingen',  titel: 'Trainingsdagen invullen',     uitleg: 'Voor aanwezigheid en de eerstvolgende training.',         actie: 'teams' },
  { id: 'coaches',     titel: 'Eerste coach uitnodigen',     uitleg: 'Deel de persoonlijke teamlink met een trainer.',         actie: 'teams' },
  { id: 'privacy',     titel: 'Privacycontact invullen',     uitleg: 'Wie vragen over persoonsgegevens beantwoordt.',          actie: 'instellingen:toegang' },
  { id: 'vo',          titel: 'Verwerkersovereenkomst',      uitleg: 'Eenmalig digitaal akkoord namens de club.',              actie: 'vo' },
];

const STANDAARD_KLEUR = '#e2342f';

export function startlijstStatus(club = {}, teams = []){
  const inst = club.instellingen || {};
  const id = inst.identiteit || {};
  const pv = inst.privacy || {};
  const admins = club.admins || {};
  const klaar = {
    uiterlijk: !!id.logo || (!!id.kleur && String(id.kleur).toLowerCase() !== STANDAARD_KLEUR),
    sportlink: !!String(club.sportlinkClientId || '').trim(),
    teams: teams.length > 0,
    trainingen: teams.length > 0 && teams.every(t => Array.isArray(t.trainingsdagen) && t.trainingsdagen.length > 0),
    coaches: teams.some(t => Object.keys(t.leden || {}).some(u => !admins[u])),
    privacy: !!String(pv.contactEmail || '').trim(),
    vo: !!(pv.verwerkersovereenkomst && pv.verwerkersovereenkomst.geaccepteerd),
  };
  const stappen = STARTLIJST_STAPPEN.map(s => ({ ...s, klaar: !!klaar[s.id] }));
  const gedaan = stappen.filter(s => s.klaar).length;
  return { stappen, gedaan, totaal: stappen.length, compleet: gedaan === stappen.length };
}
