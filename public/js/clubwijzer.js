/* ==================== CLUBWIJZER: zo werken wij bij deze club ====================
   [20261120d] De afspraken van de club, per hoofdstuk, leesbaar voor elke trainer. De teksten komen uit
   het Clubprofiel (de eindbaas leest de documenten van de club in en zet per onderwerp een tekst klaar,
   zie platform-clubprofiel.js) en staan als clubcontent in clubs/{id}/content met categorie 'afspraak':
     { categorie: 'afspraak', hoofdstuk, hoofdstukNaam, veld, titel, achtergrond, volgorde, status }
   Trainers zien alleen wat gepubliceerd is (content.js). De clubbeheerder bewerkt en publiceert de
   teksten in Club › Content, onder "Clubwijzer".

   Te vinden op het tabblad Documenten van een team, bovenaan. Zonder afspraken is er niets te zien.
   [20261120g] Ook de eigen gouden regels van de club staan hier (die werden nergens aan trainers getoond).
   [20261120j] Een inhoudsopgave per hoofdstuk met zoekveld in plaats van één lange lijst (zie openClubwijzer).
   Leest alleen; schrijft niets. */
import { S, esc, openModal } from './state.js?v=20261127b';
import { contentVoorCategorie, clubEigenVoorCategorie } from './content.js?v=20261127b';

export const clubwijzerItems = () => contentVoorCategorie('afspraak').filter(c => c && c.titel && c.achtergrond);
/* [20261120g] de eigen gouden regels van de club (niet de standaard van Cluppie): bovenaan de Clubwijzer */
export const clubRegels = () => clubEigenVoorCategorie('gouden-regel').filter(c => c && c.titel);
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
/* ---------- [20261120j] de Clubwijzer als inhoudsopgave ----------
   Was: alle afspraken onder elkaar in één lang venster. Nu drie standen in hetzelfde venster:
     inhoud     de gouden regels (kort, altijd bovenaan) en de hoofdstukken als lijst, elk met het aantal afspraken
                en de eerste onderwerpen; met een zoekveld
     hoofdstuk  de afspraken van één hoofdstuk, elk inklapbaar (titel en eerste regel; tik voor de hele tekst)
     zoeken     de afspraken waarin het gezochte woord staat, uit alle hoofdstukken
   openClubwijzer(veld) opent meteen het hoofdstuk van dat onderwerp met het onderwerp open (voor het voorbeeld in het
   Clubprofiel). De kenmerken data-veld en data-bev blijven op elk onderwerp staan: het aanwijzen in het Clubprofiel
   gebruikt ze. Puur voor de weergave: groepeerAfspraken en zoekAfspraken zijn los te testen. */
const CW = { stand: 'inhoud', hoofdstuk: null, zoek: '', open: null };
const voorproef = t => { const r = String(t || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || ''; return r.length > 110 ? r.slice(0, 108).trim() + '…' : r; };
/* De afspraken waarin alle woorden van de zoekvraag staan (in titel, tekst of hoofdstuk). */
export function zoekAfspraken(items, vraag){
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const woorden = norm(vraag).split(/\s+/).filter(w => w.length >= 2);
  if (!woorden.length) return [];
  return items.filter(c => { const t = norm(`${c.titel} ${c.achtergrond} ${c.hoofdstukNaam || ''}`); return woorden.every(w => t.includes(w)); });
}
const markeer = (tekst, vraag) => {
  let h = esc(tekst);
  for (const w of String(vraag || '').split(/\s+/).filter(x => x.length >= 2)) h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  return h.replace(/\n/g, '<br>');
};
function cwItem(c, open, vraag){
  return `<details class="cw-item" data-veld="${esc(c.veld || '')}" data-bev="${esc(c.bevinding || '')}" ${open ? 'open' : ''}>
    <summary><b>${markeer(c.titel, vraag)}</b><span class="cw-voorproef">${esc(voorproef(c.achtergrond))}</span></summary>
    <p>${markeer(c.achtergrond, vraag)}</p></details>`;
}
function cwHtml(){
  const items = clubwijzerItems(), groepen = groepeerAfspraken(items), regels = clubRegels();
  const kop = '';   /* de titel staat in de kopbalk van het venster (openModal haalt de eerste <h2> eruit) */
  const zoekveld = `<input class="invoer cw-zoek" type="search" data-cw-zoek placeholder="Zoek in de afspraken, bijvoorbeeld speeltijd" value="${esc(CW.zoek)}" aria-label="Zoek in de afspraken">`;
  if (CW.stand === 'hoofdstuk'){
    const g = groepen.find(x => x.id === CW.hoofdstuk) || groepen[0];
    if (!g){ CW.stand = 'inhoud'; return cwHtml(); }
    return `${kop}<button class="cw-terug" data-cw-terug>‹ Alle onderwerpen</button>
      <h3 class="cw-hkop">${esc(g.naam)}</h3>
      <div class="cw-lijst">${g.items.map(c => cwItem(c, c.veld && c.veld === CW.open)).join('')}</div>`;
  }
  if (CW.stand === 'zoeken' && CW.zoek.trim().length >= 2){
    const gevonden = zoekAfspraken(items, CW.zoek);
    return `${kop}${zoekveld}<button class="cw-terug" data-cw-terug>‹ Alle onderwerpen</button>
      <p class="cb-uitleg cw-aantal">${gevonden.length ? `${gevonden.length} afspra${gevonden.length === 1 ? 'ak' : 'ken'} gevonden` : 'Niets gevonden. Probeer een ander woord.'}</p>
      <div class="cw-lijst">${gevonden.map(c => `<small class="cw-waar">${esc(c.hoofdstukNaam || '')}</small>${cwItem(c, true, CW.zoek)}`).join('')}</div>`;
  }
  return `${kop}<p class="cb-uitleg cw-intro">De afspraken van de club, uit haar eigen beleid. Kies een onderwerp.</p>
    ${zoekveld}
    ${regels.length ? `<section class="cw-regelkaart" data-veld="gouden-regels"><h3 class="cw-kop">Onze gouden regels</h3><ol class="cw-regels">${regels.map(r => `<li data-id="${esc(r.id || '')}" data-veld="${esc(r.veld || '')}">${esc(r.titel)}</li>`).join('')}</ol></section>` : ''}
    <div class="cw-hoofdstukken">${groepen.map(g => `<button class="cw-hoofdstuk" data-cw-h="${esc(g.id)}">
      <span><b>${esc(g.naam)}</b><small>${esc(g.items.slice(0, 3).map(c => c.titel).join(', '))}${g.items.length > 3 ? ' …' : ''}</small></span>
      <span class="cw-tel">${g.items.length}</span><span class="cw-pijl" aria-hidden="true">›</span></button>`).join('')}</div>`;
}
function cwTeken(focusZoek){
  const el = document.getElementById('modalInhoud');
  if (!el || !el.querySelector('.cw-wijzer')) return;
  const box = el.querySelector('.cw-wijzer');
  box.innerHTML = cwHtml();
  el.scrollTop = 0; const lijf = el.querySelector('.modal-body'); if (lijf) lijf.scrollTop = 0;
  if (focusZoek){ const z = box.querySelector('[data-cw-zoek]'); if (z){ z.focus(); z.setSelectionRange(z.value.length, z.value.length); } }
}
/* veld: (vanuit het voorbeeld in het Clubprofiel) naar dat onderwerp: het hoofdstuk open, het onderwerp open en even laten oplichten */
export function openClubwijzer(veld){
  const items = clubwijzerItems(), regels = clubRegels();
  if (!items.length && !regels.length) return;
  const doel = veld && veld !== 'gouden-regels' ? items.find(c => c.veld === veld) : null;
  Object.assign(CW, doel ? { stand: 'hoofdstuk', hoofdstuk: doel.hoofdstuk || 'overig', open: veld, zoek: '' } : { stand: 'inhoud', hoofdstuk: null, open: null, zoek: '' });
  openModal(`<h2>Zo werken wij bij ${esc(clubNaam())}</h2><div class="cw-wijzer">${cwHtml()}</div>`);
  const el = document.getElementById('modalInhoud');
  if (el && !el.__cw){
    el.__cw = true;
    el.addEventListener('click', e => {
      if (!el.querySelector('.cw-wijzer')) return;
      const h = e.target.closest('[data-cw-h]'), t = e.target.closest('[data-cw-terug]');
      if (h){ Object.assign(CW, { stand: 'hoofdstuk', hoofdstuk: h.dataset.cwH, open: null }); cwTeken(); }
      else if (t){ Object.assign(CW, { stand: 'inhoud', hoofdstuk: null, open: null, zoek: '' }); cwTeken(); }
    });
    el.addEventListener('input', e => {
      if (!e.target.matches?.('[data-cw-zoek]')) return;
      CW.zoek = e.target.value; CW.stand = CW.zoek.trim().length >= 2 ? 'zoeken' : 'inhoud'; cwTeken(true);
    });
  }
  const doelEl = veld ? document.querySelector(`#modalInhoud [data-veld="${String(veld).replace(/[^a-z.-]/g, '')}"]`) : null;
  if (doelEl){ doelEl.classList.add('cw-licht'); doelEl.scrollIntoView({ block: 'center' }); }
}
if (typeof document !== 'undefined' && document.addEventListener){
  const open = e => { if (e.target && e.target.closest && e.target.closest('[data-open-clubwijzer]')){ if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); openClubwijzer(); } };
  document.addEventListener('click', open);
  document.addEventListener('keydown', open);
}
