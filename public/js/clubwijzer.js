/* ==================== CLUBWIJZER: zo werken wij bij deze club ====================
   [20261120d] De afspraken van de club, per hoofdstuk, leesbaar voor elke trainer. De teksten komen uit
   het Clubprofiel (de eindbaas leest de documenten van de club in en zet per onderwerp een tekst klaar,
   zie platform-clubprofiel.js) en staan als clubcontent in clubs/{id}/content met categorie 'afspraak':
     { categorie: 'afspraak', hoofdstuk, hoofdstukNaam, veld, titel, achtergrond, volgorde, status }
   Trainers zien alleen wat gepubliceerd is (content.js). De clubbeheerder bewerkt en publiceert de
   teksten in Club › Content, onder "Clubwijzer".

   Te vinden op het tabblad Documenten van een team, bovenaan. Zonder afspraken is er niets te zien.
   [20261120g] Ook de eigen gouden regels van de club staan hier (die werden nergens aan trainers getoond).
   Leest alleen; schrijft niets. */
import { S, esc, openModal } from './state.js?v=20261120g';
import { contentVoorCategorie, clubEigenVoorCategorie } from './content.js?v=20261120g';

export const clubwijzerItems = () => contentVoorCategorie('afspraak').filter(c => c && c.titel && c.achtergrond);
/* [20261120g] de eigen gouden regels van de club (niet de standaard van Cluppie): bovenaan de Clubwijzer */
export const clubRegels = () => clubEigenVoorCategorie('gouden-regel').map(c => c.titel).filter(Boolean);
/* De afspraken per hoofdstuk, in de vaste volgorde van het Clubprofiel. Puur: ook los te testen. */
export function groepeerAfspraken(items){
  const groepen = new Map();
  for (const c of [...items].sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0))){
    const sleutel = c.hoofdstuk || 'overig';
    if (!groepen.has(sleutel)) groepen.set(sleutel, { id: sleutel, naam: c.hoofdstukNaam || 'Overig', items: [] });
    groepen.get(sleutel).items.push(c);
  }
  return [...groepen.values()];
}
const clubNaam = () => (S.club && S.club.naam) || (S.team && S.team.clubNaam) || 'onze club';

/* De rij bovenaan het tabblad Documenten. Leeg als de club (nog) geen afspraken en geen eigen gouden regels heeft. */
export function htmlClubwijzerRij(){
  const n = clubwijzerItems().length, r = clubRegels().length;
  if (!n && !r) return '';
  const meta = [n ? `${n} afspra${n === 1 ? 'ak' : 'ken'} van de club, per onderwerp` : '', r ? `${r} gouden regel${r === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
  return `<div class="sectie-kop">Clubwijzer</div>
    <div class="training-rij" data-open-clubwijzer role="button" tabindex="0" style="cursor:pointer">
      <div class="ico">CLUB</div>
      <div class="t"><div class="t-titel">Zo werken wij bij ${esc(clubNaam())}</div>
        <div class="t-meta">${esc(meta)}</div></div>
      <div class="acties"><button title="Openen" aria-label="Clubwijzer openen">↗</button></div>
    </div>`;
}
/* veld: (vanuit het voorbeeld in het Clubprofiel) naar dat onderwerp scrollen en het even laten oplichten */
export function openClubwijzer(veld){
  const groepen = groepeerAfspraken(clubwijzerItems()), regels = clubRegels();
  if (!groepen.length && !regels.length) return;
  openModal(`<h2>Zo werken wij bij ${esc(clubNaam())}</h2>
    <p class="cb-uitleg" style="margin:0 0 12px">De afspraken van de club, uit haar eigen beleid.</p>
    ${regels.length ? `<section class="cw-groep" data-veld="gouden-regels"><h3 class="cw-kop">Onze gouden regels</h3><ol class="cw-regels">${regels.map(r => `<li>${esc(r)}</li>`).join('')}</ol></section>` : ''}
    ${groepen.map(g => `<section class="cw-groep"><h3 class="cw-kop">${esc(g.naam)}</h3>
      ${g.items.map(c => `<div class="cw-item" data-veld="${esc(c.veld || '')}"><b>${esc(c.titel)}</b><p>${esc(c.achtergrond).replace(/\n/g, '<br>')}</p></div>`).join('')}</section>`).join('')}`);
  if (veld){
    const el = document.querySelector(`#modalInhoud [data-veld="${String(veld).replace(/[^a-z.-]/g, '')}"]`);
    if (el){ el.classList.add('cw-licht'); el.scrollIntoView({ block: 'center' }); }
  }
}
if (typeof document !== 'undefined' && document.addEventListener){
  const open = e => { if (e.target && e.target.closest && e.target.closest('[data-open-clubwijzer]')){ if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); openClubwijzer(); } };
  document.addEventListener('click', open);
  document.addEventListener('keydown', open);
}
