/* ==================== BOUWCOÖRDINATOREN ====================
   Bewust een eigen, klein bestand — niet toegevoegd aan state.js, want
   elke state.js-wijziging triggert een dure transitieve versie-bump over
   tientallen bestanden. Dit module importeert alleen wat het nodig heeft
   uit de bestaande state.js/config.js, zonder die te wijzigen.

   Datamodel (Firestore: clubs/{clubId}):
     bouwCoordinatoren:     { onder: {uid:true,...}, midden: {...}, boven: {...} }
     bouwCoordinatorenInfo: { uid: {naam} }   — alleen voor weergave, geen
                                                 rechtenbron (die is bouwCoordinatoren)

   Rechten: een bouwcoördinator is voor ELK team in zijn bouw gelijk aan een
   gewone coach (zie firestore.rules: isTeamMember() telt coördinatoren nu
   mee). Dit bestand levert alleen de CLIENT-SIDE zichtbaarheidscheck —
   welke knoppen/schermen tonen we — de eigenlijke afdwinging staat in de
   rules. Een coördinator die ook zelf coach is, blijft dat gewoon; beide
   rollen tellen los van elkaar mee. */
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261130b';
import { db, doc, updateDoc, deleteField } from './firebase.js?v=20261011g';
import { BOUWEN, bouwNaam } from './config.js?v=20261130b';
import { rolNaam as clubRolNaam } from './rolnamen.js?v=20261120c';   /* [20261120c] eigen rolnamen van de club */

/* ---------- Rechten-check (zelfde patroon als isBeheerder() in state.js) ---------- */
export function isBouwCoordinator(bouw){
  if (!bouw || !S.user || !S.club) return false;
  return !!(S.club.bouwCoordinatoren?.[bouw]?.[S.user.uid]);
}
/* Alle bouwen waar de ingelogde gebruiker coördinator van is (meestal 0 of 1,
   maar niets belet iemand coördinator van meerdere bouwen te maken). */
export function bouwenVanCoordinator(){
  if (!S.user || !S.club?.bouwCoordinatoren) return [];
  return BOUWEN.map(b => b.id).filter(id => isBouwCoordinator(id));
}

/* ---------- Admin-scherm: coördinatoren aanwijzen ----------
   Wordt gerenderd binnen htmlClubInstel() in club.js. `teams` is dezelfde
   lijst die club.js daar al doorgeeft (S.clubTeams), gebruikt om de
   kandidatenlijst (alle coaches in de club) op te bouwen. */
function kandidaten(teams){
  const map = new Map(); // uid -> naam
  for (const t of (teams || [])){
    for (const [uid, info] of Object.entries(t.ledenInfo || {})){
      if (!map.has(uid)) map.set(uid, info?.naam || '(onbekend)');
    }
  }
  return [...map.entries()].map(([uid, naam]) => ({uid, naam})).sort((a,b) => a.naam.localeCompare(b.naam));
}


export function koppelCoordinatorenBeheer(v, teams){
  v.querySelectorAll('[data-coord-toevoegen]').forEach(btn => {
    btn.onclick = () => modalCoordinatorToevoegen(btn.dataset.coordToevoegen, teams);
  });
  v.querySelectorAll('[data-coord-weg]').forEach(btn => {
    btn.onclick = async () => {
      const [bouw, uid] = btn.dataset.coordWeg.split('|');
      const naam = btn.closest('[data-coord-rij]')?.querySelector('.lid-naam')?.textContent || 'deze coach';
      if (!confirm(`${naam} niet langer coördinator van ${bouwNaam(bouw)}?`)) return;
      await updateDoc(doc(db, 'clubs', S.clubId), {
        [`bouwCoordinatoren.${bouw}.${uid}`]: deleteField(),
      });
      meld(`${naam} is geen coördinator meer van ${bouwNaam(bouw)}`);
    };
  });
}

function modalCoordinatorToevoegen(bouw, teams){
  const bestaand = new Set(Object.keys(S.club.bouwCoordinatoren?.[bouw] || {}));
  const opties = kandidaten(teams).filter(k => !bestaand.has(k.uid));
  openModal(`
    <h2>${esc(clubRolNaam('coordinator', S.club, 'Coördinator'))}<span class="sep" aria-hidden="true"></span>${esc(bouwNaam(bouw))}</h2>
    <p class="u-t-sm u-zacht u-mb-sm">Kies een coach die al bij de club bekend is.</p>
    ${opties.length ? opties.map(k => `
      <button class="knop licht" data-coord-kies="${k.uid}" style="text-align:left;justify-content:flex-start">${esc(k.naam)}</button>`).join('')
    : `<p class="u-t-sm u-zacht">Geen kandidaten gevonden, er moet eerst iemand als coach bij een team staan.</p>`}
    <button class="knop licht vol u-mt-sm" id="coordToevoegenAnnuleer" >Annuleren</button>`);
  document.getElementById('coordToevoegenAnnuleer').onclick = sluitModal;
  document.querySelectorAll('[data-coord-kies]').forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.coordKies;
      const naam = btn.textContent;
      await updateDoc(doc(db, 'clubs', S.clubId), {
        [`bouwCoordinatoren.${bouw}.${uid}`]: true,
        [`bouwCoordinatorenInfo.${uid}`]: {naam},
      });
      sluitModal();
      meld(`${naam} is coördinator van ${bouwNaam(bouw)}`);
    };
  });
}
