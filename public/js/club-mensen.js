/* ==================== CLUB › MENSEN: WIE DOET WAT [20261121a] ====================
   Eén overzicht van alle rollen in de club, bovenaan het scherm Mensen (voorheen Coaches).
   De rollen worden op verschillende plekken toegewezen (beheerders in Instellingen, hoofd jeugd bij
   Seizoensplan, coördinatoren bij Bouwen, coaches per team). Dit overzicht laat per rol zien wie hem
   heeft, wat die rol doet en ziet, en brengt de clubbeheerder met één tik naar de plek om iemand toe te voegen.
   Wie geen beheerder is ziet hetzelfde overzicht zonder knoppen: zo weet een coach wie zijn coördinator is.

   Daarnaast: de kaart "En daarna" op de club-hub, het vervolg op "Aan de slag" (startlijst.js).
   De rekenregels staan in rollen-bezetting.js (zonder DOM, getest). */
import { S, esc } from './state.js?v=20261121c';
import { db, doc, getDoc } from './firebase.js?v=20261011g';
import { ico } from './icons.js?v=20261116t';
import { BOUWEN } from './config.js?v=20261121c';
import { bouwVanTeam } from './bouw-indeling.js?v=20261121c';
import { ROLLEN as ROLNAMEN, eigenRolNaam } from './rolnamen.js?v=20261120c';
import { rolBezetting, vervolgStatus } from './rollen-bezetting.js?v=20261121a';

const isAdmin = () => !!(S.club?.admins?.[S.user?.uid]);
const opties = () => ({ bouwen: BOUWEN, bouwVan: bouwVanTeam, rolNamen: Object.fromEntries(ROLNAMEN.map(([id]) => [id, eigenRolNaam(id, S.club)])) });

/* waar de clubbeheerder een rol toewijst: [actie, tekst op de knop] */
const WAAR = {
  admin: ['instellingen:beheer', 'Beheerder toevoegen'],
  hoofdJeugd: ['jeugdplan', 'Aanwijzen'],
  bouw: ['bouwen', 'Aanwijzen'],
  eigen: ['bouwen', 'Koppelen'],
  trainco: ['trainco', 'Uitnodigen'],
  coach: ['links', 'Coaches uitnodigen'],
};

export function htmlMensen(teams){
  if (!S.club) return '';
  const b = rolBezetting(S.club, teams, opties()), admin = isAdmin();
  let dicht = false; try { dicht = localStorage.getItem('cluppie_mensen_dicht_' + S.clubId) === '1'; } catch (e) {}
  if (b.klaar && admin && dicht) return `<button class="cm-open" id="cmOpen">${ico('admin-roles', 18)}<span><b>Wie doet wat</b><small>Alle ${b.totaal} rollen bezet</small></span><span class="pijl" aria-hidden="true">›</span></button>`;
  const rij = r => {
    const [actie, knop] = WAAR[r.soort];
    const extra = r.soort === 'coach' && r.teamsZonder.length ? `Zonder coach: ${r.teamsZonder.slice(0, 6).join(', ')}${r.teamsZonder.length > 6 ? ` en ${r.teamsZonder.length - 6} meer` : ''}.` : (admin && r.advies) || '';
    return `<div class="cm-rol ${r.bezet ? 'bezet' : r.nodig ? 'open' : ''}">
      <span class="cm-vink" aria-hidden="true">${r.bezet ? ico('action-check', 14) : ''}</span>
      <div class="cm-tekst"><b>${esc(r.naam)}</b><span class="cm-stand">${esc(r.stand)}${r.soort === 'coach' && r.aantal ? ` · ${r.aantal} coach${r.aantal === 1 ? '' : 'es'}` : ''}</span>
        <small>${esc(r.doet)} <span class="cm-ziet">Ziet: ${esc(r.ziet.charAt(0).toLowerCase() + r.ziet.slice(1))}</span></small>${extra ? `<small class="cm-let">${esc(extra)}</small>` : ''}</div>
      ${admin ? `<button class="knop ${r.bezet || !r.nodig ? 'licht' : 'fluo'} klein" data-cm="${actie}" aria-label="${esc(knop)}: ${esc(r.naam)}">${esc(r.bezet && r.soort !== 'coach' ? 'Wijzigen' : knop)}</button>` : ''}</div>`;
  };
  return `<div class="cb-kaart cm-kaart" id="cmKaart">
      <div class="cb-kaart-kop">${ico('admin-roles', 18)}<b>Wie doet wat</b><span class="cb-telling">${b.bezet} van ${b.totaal}</span>
        ${b.klaar && admin ? `<button class="sl-weg" id="cmDicht" aria-label="Inklappen">${ico('navigation-close', 18)}</button>` : ''}</div>
      <p class="cb-uitleg" style="margin:0 0 var(--space-xs)">${admin
        ? (b.klaar ? 'Elke rol is bezet. Hier zie je wie wat doet en pas je het aan.' : 'Elke rol met wie hem heeft en wat die persoon ziet. Bij een open rol kom je met één tik op de plek om iemand aan te wijzen.')
        : 'Wie in de club welke rol heeft, en wat die rol doet.'}</p>
      ${b.rollen.map(rij).join('')}
    </div>`;
}
/* api: { naar(actie), herteken() }. Acties: instellingen:<tab>, jeugdplan, bouwen, links (alle teamlinks) en trainco (zelfde scherm). */
export function koppelMensen(v, api){
  v.querySelector('#cmDicht')?.addEventListener('click', () => { try { localStorage.setItem('cluppie_mensen_dicht_' + S.clubId, '1'); } catch (e) {} api.herteken(); });
  v.querySelector('#cmOpen')?.addEventListener('click', () => { try { localStorage.removeItem('cluppie_mensen_dicht_' + S.clubId); } catch (e) {} api.herteken(); });
  v.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => {
    const a = b.dataset.cm;
    if (a === 'trainco'){ const k = v.querySelector('#traincoKaart'); if (k){ k.scrollIntoView({ behavior: 'smooth', block: 'start' }); k.querySelector('#tcMaakLink, #traincoKopieer')?.focus({ preventScroll: true }); } return; }
    api.naar(a);
  });
}

/* ---------- "En daarna": het vervolg op Aan de slag, op de club-hub ---------- */
/* de vastgelegde speelwijze staat in een eigen document; één keer per club lezen */
function speelwijzeVast(herteken){
  const st = (S._cmSpeelwijze = S._cmSpeelwijze && S._cmSpeelwijze.club === S.clubId ? S._cmSpeelwijze : { club: S.clubId, vast: undefined });
  if (st.vast === undefined && !st.bezig){
    st.bezig = true; const club = S.clubId;
    getDoc(doc(db, 'clubs', club, 'speelstijl', 'huidig')).then(s => { st.vast = s.exists() && !!s.data()?.standen; }).catch(() => { st.vast = false; })
      .finally(() => { st.bezig = false; if (S.clubId === club && (S.clubTab || 'hub') === 'hub') herteken(); });
  }
  return st.vast;
}
/* startKlaar: of "Aan de slag" compleet is (de club-hub weet dat al). */
export function htmlVervolg(teams, startKlaar, herteken){
  if (!isAdmin() || !startKlaar || !teams.length) return '';
  let weg = false; try { weg = localStorage.getItem('cluppie_vervolg_weg_' + S.clubId) === '1'; } catch (e) {}
  if (weg) return '';
  const vast = speelwijzeVast(herteken);
  if (vast === undefined) return '';
  const st = vervolgStatus(S.club, teams, { speelwijzeVast: vast }, opties());
  if (st.compleet) return '';
  const volgende = st.stappen.find(s => !s.klaar);
  return `<div class="sl-kaart cm-vervolg">
    <div class="sl-kop"><div><b>En daarna</b><small>De club staat klaar. Nu: wie doet wat, en hoe wil de club voetballen. ${st.gedaan} van ${st.totaal} gedaan</small></div>
      <button class="sl-weg" id="vervolgWeg" aria-label="Verbergen">${ico('navigation-close', 18)}</button></div>
    <div class="sl-balk"><span style="width:${Math.round(100 * st.gedaan / st.totaal)}%"></span></div>
    <div class="sl-stappen">${st.stappen.map(s => `
      <button class="sl-stap ${s.klaar ? 'klaar' : ''} ${s === volgende ? 'volgende' : ''}" data-vervolg="${esc(s.actie)}" ${s.klaar ? 'disabled' : ''}>
        <span class="sl-vink">${s.klaar ? ico('action-check', 14) : ''}</span>
        <span class="sl-tekst"><b>${esc(s.titel)}</b>${s.klaar ? '' : `<small>${esc(s.uitleg)}</small>`}</span>
        ${s.klaar ? '' : '<span class="pijl">›</span>'}
      </button>`).join('')}</div>
  </div>`;
}
/* api: { naar(actie), herteken() } */
export function koppelVervolg(v, api){
  v.querySelector('#vervolgWeg')?.addEventListener('click', () => { try { localStorage.setItem('cluppie_vervolg_weg_' + S.clubId, '1'); } catch (e) {} api.herteken(); });
  v.querySelectorAll('[data-vervolg]').forEach(b => b.onclick = () => api.naar(b.dataset.vervolg));
}
