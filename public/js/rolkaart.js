/* ==================== ROLKAART [20261116b] ====================
   Eenmalige uitleg voor wie een sturende rol in de club krijgt: wat zie je, wat kun je, wat kun je niet.
   Voor bouwcoördinator, gekoppelde coach van een eigen bouw, hoofd jeugdopleiding en trainingscoördinator.
   De teksten volgen de toegangsregels (firestore.rules, docs/rollenkaart.md): verander je die, pas dit aan.

   Vlag per rol in gebruikers/{uid}/meta/onboarding.rolkaart.<rol> (merge), alleen voor de weergave.
   Bewust een eigen module zonder wijziging in state.js; runtime-toestand staat op S._rolkaart.

   [20261121a] Ook voor de clubbeheerder (ook wie later als medebeheerder aansluit), en elke kaart heeft
   een knop naar het scherm waar die rol begint. In de handleiding staat dezelfde tekst onder "Rollen in de club". */
import { S, esc, openModal, sluitModal } from './state.js?v=20261129v';
import { db, doc, getDoc, setDoc } from './firebase.js?v=20261011g';

export const ROLKAARTEN = {
  admin: {
    titel: 'Je bent clubbeheerder',
    ziet: 'Alles van de club: teams, mensen, trainingen en instellingen.',
    kan: 'De club inrichten, mensen uitnodigen en rollen toewijzen. Bovenaan de club staat wat nog moet gebeuren; onder Mensen zie je wie wat doet.',
    kanNiet: 'Onderdelen aanzetten die Cluppie per club beheert, zoals AI. Vraag dat aan Cluppie.',
    knop: 'Open mijn club',
  },
  bouw: {
    titel: 'Je bent bouwcoördinator',
    ziet: 'Alle teams van je bouw, en de spelerslijsten van de club.',
    kan: 'In de teams van je bouw alles wat een coach kan. Spelers uitlenen. Het seizoensplan van je bouw toewijzen.',
    kanNiet: 'Beoordelingen en aanwezigheid van teams buiten je bouw bekijken.',
    knop: 'Open mijn bouw',
  },
  eigenbouw: {
    titel: 'Je bent gekoppeld aan een bouw',
    ziet: 'De teams van die bouw, en de spelerslijsten van de club.',
    kan: 'In die teams hetzelfde als een bouwcoördinator: meekijken, bijwerken en spelers uitlenen.',
    kanNiet: 'Clubinstellingen wijzigen, of teams buiten je bouw bijwerken.',
    knop: 'Open mijn bouw',
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
    knop: 'Open de trainingen',
  },
};

/* Zuiver: welke rolkaarten horen bij deze gebruiker? Volgorde = volgorde van tonen. */
export function rollenVoorKaart({ uid, coordinatorBouwen = [], traincoClubs = [], leiding = null, clubs = [] } = {}){
  const uit = [];
  if (!uid) return uit;
  if (clubs.some(c => c && c.admins && c.admins[uid] === true)) uit.push('admin');
  if (coordinatorBouwen.some(b => b && !b.eigen)) uit.push('bouw');
  if (coordinatorBouwen.some(b => b && b.eigen)) uit.push('eigenbouw');
  if (leiding && leiding.hoofdJeugd && leiding.hoofdJeugd[uid] === true) uit.push('hjo');
  if (traincoClubs.length) uit.push('trainco');
  return uit;
}

/* [20261122a] De rollen van wie nu ingelogd is, voor de handleiding en de hulpchat (hulp-rol.js):
   de sturende rollen hierboven, plus 'coach' of 'solo' voor het team dat open staat (of, zonder
   open team, voor de teams die je hebt). */
export function mijnRollen(){
  if (!S.user) return [];
  const uit = rollenVoorKaart({ uid: S.user.uid, coordinatorBouwen: S.coordinatorBouwen || [], traincoClubs: S.traincoClubs || [], leiding: S._clubPlatform && S._clubPlatform.leiding, clubs: S.clubs || [] });
  const t = S.team && S.teamId ? S.team : null;
  if (t && t.leden && t.leden[S.user.uid]) uit.push(t.club ? 'coach' : 'solo');
  else if (!t && (S.teams || []).length) uit.push((S.teams || []).some(x => x.club) ? 'coach' : 'solo');
  return uit;
}

export function htmlRolkaart(rol, rolnaam){
  const k = ROLKAARTEN[rol]; if (!k) return '';
  const rij = (kop, tekst) => `<div class="rk-rij"><div class="rk-kop">${kop}</div><div class="rk-tekst">${esc(tekst)}</div></div>`;
  return `<div class="rolkaart">
    <h2>${esc(k.titel.replace('{rolnaam}', rolnaam || 'hoofd jeugdopleiding'))}</h2>
    ${rij('Dit zie je', k.ziet)}${rij('Dit kun je', k.kan)}${rij('Dit kun je niet', k.kanNiet)}
    <div class="rij rk-knoppen">${k.knop ? `<button class="knop licht" id="rkBegrepen">Begrepen</button><button class="knop fluo" id="rkOpen">${esc(k.knop)}</button>` : '<button class="knop primair" id="rkBegrepen">Begrepen</button>'}</div>
  </div>`;
}

const metaRef = () => doc(db, 'gebruikers', S.user.uid, 'meta', 'onboarding');

/* Toont hooguit één kaart per keer, en alleen als er geen ander venster open staat. */
export async function toonRolkaartZoNodig(){
  if (!S.user || document.documentElement.classList.contains('demo') && !window.__cluppieDemo?.rol) return;
  const st = (S._rolkaart = S._rolkaart || { gezien: null, bezig: false });
  if (st.bezig) return;
  const rollen = rollenVoorKaart({ uid: S.user.uid, coordinatorBouwen: S.coordinatorBouwen || [], traincoClubs: S.traincoClubs || [], leiding: S._clubPlatform && S._clubPlatform.leiding, clubs: S.clubs || [] });
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
    const open = document.getElementById('rkOpen');
    if (open) open.onclick = () => { sluitModal(); naarRol(rol).catch(() => {}); };
    try { await setDoc(metaRef(), { rolkaart: { [rol]: true } }, { merge: true }); } catch (e){ /* alleen een weergavevlag */ }
  } finally { st.bezig = false; }
}

/* Het scherm waar de rol begint. Lukt het niet (bijv. de club is nog niet geladen), dan blijft de gebruiker waar hij is. */
async function naarRol(rol){
  if (rol === 'admin'){ const c = (S.clubs || []).find(x => x.admins && x.admins[S.user.uid]); if (c) (await import('./club.js?v=20261129v')).openClub(c.id); return; }
  if (rol === 'bouw' || rol === 'eigenbouw'){
    const b = (S.coordinatorBouwen || []).find(x => x && !!x.eigen === (rol === 'eigenbouw'));
    if (b) (await import('./bouw-hub.js?v=20261129v')).openBouwHub(b.clubId, b.bouw);
    return;
  }
  if (rol === 'trainco'){ const c = (S.traincoClubs || [])[0]; if (c) (await import('./trainco.js?v=20261129v')).openVanuitApp(c.id); }
}

/* Korte vertraging: de rollen komen binnen via losse listeners. */
let timer = null;
export function planRolkaart(){
  clearTimeout(timer);
  timer = setTimeout(() => { toonRolkaartZoNodig().catch(() => {}); }, 1800);
}
