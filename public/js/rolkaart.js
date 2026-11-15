/* ==================== ROLKAART [20261116b] ====================
   Eenmalige uitleg voor wie een sturende rol in de club krijgt: wat zie je, wat kun je, wat kun je niet.
   Voor bouwcoördinator, gekoppelde coach van een eigen bouw, hoofd jeugdopleiding en trainingscoördinator.
   De teksten volgen de toegangsregels (firestore.rules, docs/rollenkaart.md): verander je die, pas dit aan.

   Vlag per rol in gebruikers/{uid}/meta/onboarding.rolkaart.<rol> (merge), alleen voor de weergave.
   Bewust een eigen module zonder wijziging in state.js; runtime-toestand staat op S._rolkaart. */
import { S, esc, openModal, sluitModal } from './state.js?v=20261116h';
import { db, doc, getDoc, setDoc } from './firebase.js?v=20261011g';

export const ROLKAARTEN = {
  bouw: {
    titel: 'Je bent bouwcoördinator',
    ziet: 'Alle teams van je bouw, en de spelerslijsten van de club.',
    kan: 'In de teams van je bouw alles wat een coach kan. Spelers uitlenen. Het seizoensplan van je bouw toewijzen.',
    kanNiet: 'Beoordelingen en aanwezigheid van teams buiten je bouw bekijken.',
  },
  eigenbouw: {
    titel: 'Je bent gekoppeld aan een bouw',
    ziet: 'De teams van die bouw, en de spelerslijsten van de club.',
    kan: 'In die teams hetzelfde als een bouwcoördinator: meekijken, bijwerken en spelers uitlenen.',
    kanNiet: 'Clubinstellingen wijzigen, of teams buiten je bouw bijwerken.',
  },
  hjo: {
    titel: 'Je bent {rolnaam}',
    ziet: 'Alle bouwen, het seizoensplan en de speelwijze van de club, en de spelerslijsten.',
    kan: 'Het plan en de speelwijze van de club vastleggen. Trainingen voor meerdere teams maken. Evaluatierondes volgen.',
    kanNiet: 'Clubinstellingen wijzigen: dat doet de clubbeheerder.',
  },
  trainco: {
    titel: 'Je bent trainingscoördinator',
    ziet: 'De trainingen en video’s van alle teams, per week.',
    kan: 'Meekijken wat er getraind wordt.',
    kanNiet: 'Spelers, wedstrijden of beoordelingen bekijken, of iets wijzigen.',
  },
};

/* Zuiver: welke rolkaarten horen bij deze gebruiker? Volgorde = volgorde van tonen. */
export function rollenVoorKaart({ uid, coordinatorBouwen = [], traincoClubs = [], leiding = null } = {}){
  const uit = [];
  if (!uid) return uit;
  if (coordinatorBouwen.some(b => b && !b.eigen)) uit.push('bouw');
  if (coordinatorBouwen.some(b => b && b.eigen)) uit.push('eigenbouw');
  if (leiding && leiding.hoofdJeugd && leiding.hoofdJeugd[uid] === true) uit.push('hjo');
  if (traincoClubs.length) uit.push('trainco');
  return uit;
}

export function htmlRolkaart(rol, rolnaam){
  const k = ROLKAARTEN[rol]; if (!k) return '';
  const rij = (kop, tekst) => `<div class="rk-rij"><div class="rk-kop">${kop}</div><div class="rk-tekst">${esc(tekst)}</div></div>`;
  return `<div class="rolkaart">
    <h2>${esc(k.titel.replace('{rolnaam}', rolnaam || 'hoofd jeugdopleiding'))}</h2>
    ${rij('Dit zie je', k.ziet)}${rij('Dit kun je', k.kan)}${rij('Dit kun je niet', k.kanNiet)}
    <div class="rij rk-knoppen"><button class="knop primair" id="rkBegrepen">Begrepen</button></div>
  </div>`;
}

const metaRef = () => doc(db, 'gebruikers', S.user.uid, 'meta', 'onboarding');

/* Toont hooguit één kaart per keer, en alleen als er geen ander venster open staat. */
export async function toonRolkaartZoNodig(){
  if (!S.user || document.documentElement.classList.contains('demo') && !window.__cluppieDemo?.rol) return;
  const st = (S._rolkaart = S._rolkaart || { gezien: null, bezig: false });
  if (st.bezig) return;
  const rollen = rollenVoorKaart({ uid: S.user.uid, coordinatorBouwen: S.coordinatorBouwen || [], traincoClubs: S.traincoClubs || [], leiding: S._clubPlatform && S._clubPlatform.leiding });
  if (!rollen.length) return;
  st.bezig = true;
  try {
    if (!st.gezien){
      try { const s = await getDoc(metaRef()); st.gezien = { ...((s.exists() && s.data().rolkaart) || {}) }; }
      catch (e){ st.gezien = {}; }
    }
    const rol = rollen.find(r => !st.gezien[r]);
    if (!rol) return;
    const achter = document.getElementById('modalAchter');
    if (achter && (achter.classList.contains('open') || achter.classList.contains('zichtbaar'))) return;   /* later nog eens */
    st.gezien[rol] = true;
    openModal(htmlRolkaart(rol, S.club?.instellingen?.jeugdRolNaam), { vorm: 'dialoog' });
    const knop = document.getElementById('rkBegrepen');
    if (knop) knop.onclick = () => sluitModal();
    try { await setDoc(metaRef(), { rolkaart: { [rol]: true } }, { merge: true }); } catch (e){ /* alleen een weergavevlag */ }
  } finally { st.bezig = false; }
}

/* Korte vertraging: de rollen komen binnen via losse listeners. */
let timer = null;
export function planRolkaart(){
  clearTimeout(timer);
  timer = setTimeout(() => { toonRolkaartZoNodig().catch(() => {}); }, 1800);
}
