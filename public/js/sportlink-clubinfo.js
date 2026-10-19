/* ==================== CLUB OPZOEKEN IN SPORTLINK (20261012a) ====================
   Eén Client ID → clubnaam, plaats, logo, kleur en aantal teams, via de callable
   sportlinkClubInfo (functions/index.js). Gebruikt door:
     - club-aanmelden.js    (een club meldt zich aan)
     - club-instellingen.js (wizard "Nieuwe club", stap 1)
     - club.js              (Instellingen → Sportlink → Koppeling testen)
   De functie geeft nooit bank-, KvK- of contactgegevens terug. Het logo wordt hier verkleind
   met dezelfde verwerkLogo als bij uploaden; een slecht leesbare kleur krijgt het kleuradvies. */

import { functions, httpsCallable } from './firebase.js?v=20261011g';
import { esc } from './state.js?v=20261011g';

/* Geeft { gevonden, bestaatAl, clubnaam, clubcode, plaats, logo, kleur, kleurTekst, aantalTeams, metCompetitie, metBeker }
   of gooit een Error met een leesbare melding. */
export async function zoekClubInSportlink(clientId, clubId = null){
  const id = String(clientId || '').trim();
  if (!/^[A-Za-z0-9]{6,40}$/.test(id)) throw new Error('Dat lijkt geen geldige Client ID. Hij bestaat uit letters en cijfers, zonder spaties.');
  try {
    const r = await httpsCallable(functions, 'sportlinkClubInfo')({ clientId: id, ...(clubId ? { clubId } : {}) });
    return r.data || { gevonden: false };
  } catch (e){
    if (e.code === 'functions/not-found') throw new Error('Opzoeken in Sportlink is nog niet beschikbaar. Vul de gegevens zelf in.');
    if (e.code === 'functions/resource-exhausted') throw new Error(e.message || 'Je hebt dit uur al vaak gezocht. Probeer het later opnieuw.');
    throw new Error('Sportlink is nu niet bereikbaar. Probeer het later opnieuw of vul de gegevens zelf in.');
  }
}

/* Sportlink-logo (data:image/png;base64,…) → klein bestand zoals bij uploaden. Lukt het niet, dan ''. */
export async function verkleinSportlinkLogo(dataUrl){
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return '';
  try {
    const [kop, b64] = dataUrl.split(',');
    const type = (/data:([^;]+)/.exec(kop) || [])[1] || 'image/png';
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { verwerkLogo } = await import('./club-instellingen.js?v=20261019i');
    return await verwerkLogo(new File([bytes], 'sportlink-logo.png', { type }));
  } catch (e){ console.warn('[clubinfo] logo verkleinen mislukt', e); return ''; }
}

/* Tenuekleur → knopkleur met leesbare witte tekst (zelfde advies als in Instellingen → Identiteit). */
export async function leesbareKleur(hex){
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  try {
    const { kleurAdvies } = await import('./club-instellingen.js?v=20261019i');
    const a = kleurAdvies(hex);
    return a.ok ? hex.toLowerCase() : (a.advies || hex).toLowerCase();
  } catch { return hex.toLowerCase(); }
}

/* Kaart met het resultaat. `fout` = Error uit zoekClubInSportlink. */
export function htmlClubVondst(info, { fout = null, logo = '', kleur = null, eigenClub = false } = {}){
  if (fout) return `<div class="sl-vondst-melding fout" role="alert"><b>Opzoeken lukte niet</b><span>${esc(fout.message || fout)}</span></div>`;
  if (!info) return '';
  if (!info.gevonden) return `<div class="sl-vondst-melding fout" role="alert"><b>Sportlink herkent deze Client ID niet</b>
    <span>Controleer of je hem volledig hebt overgenomen. Je vindt hem in Sportlink Club onder Koppelingen → Club.Dataservice.${eigenClub ? '' : ' Je kunt ook zonder ID verder.'}</span></div>`;
  if (info.bestaatAl && !eigenClub) return `<div class="sl-vondst-melding let" role="alert"><b>${esc(info.clubnaam)} staat al op Cluppie</b>
    <span>Vraag je clubbeheerder om een uitnodiging. Je hoeft de club niet opnieuw aan te melden.</span></div>`;
  const teams = info.aantalTeams ? `${info.aantalTeams} team${info.aantalTeams === 1 ? '' : 's'} in Sportlink` : 'nog geen teams in Sportlink';
  const extra = eigenClub && info.aantalTeams
    ? `${info.metCompetitie || 0} met een competitiepoule, ${info.metBeker || 0} met een bekerpoule.`
    : 'Naam, plaats, logo en kleur zijn ingevuld. Klopt iets niet? Pas het hieronder aan.';
  return `<div class="sl-vondst">
    <div class="sl-vondst-logo">${logo ? `<img src="${esc(logo)}" alt="">` : ''}</div>
    <div class="sl-vondst-t"><b>${eigenClub ? '✓ Werkt: ' : ''}${esc(info.clubnaam)}</b><span>${esc([info.plaats, teams].filter(Boolean).join(' · '))}</span></div>
    ${kleur ? `<span class="sl-vondst-kleur" style="background:${esc(kleur)}" title="Clubkleur uit &quot;${esc(info.kleurTekst || '')}&quot;"></span>` : ''}
  </div>
  <p class="sl-vondst-hint">${extra}</p>`;
}
