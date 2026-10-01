/* ==================== CONTENTBEHEER (admin-only tabblad) ====================
   UI voor het clubdashboard-tabblad "Content": lijst + bewerken/toevoegen/
   verwijderen van leercurve-teksten, kompas-tips en gouden regels.
   Puur beheer — de daadwerkelijke opslag/lees-logica staat in content.js.
   [20260929c] Per club: een clubbeheerder bewerkt de EIGEN teksten van de club
   (clubs/{id}/content) en kan beginnen met een kopie van de Cluppie-standaard.
   De platformbeheerder kan daarnaast de standaard zelf bewerken (schakelaar).
   Zichtbaar voor elke clubbeheerder (isBeheerder(), zie club.js). De echte
   afdwinging van wie waar mag schrijven staat in de Firestore-regels. */
import { S, esc, meld, openModal, sluitModal, isPlatformBeheerder } from './state.js?v=20260929z';
import {
  startContentAdminListener, opslaanContent, verwijderContent, seedContentNaarFirestore, kopieerStandaardNaarClub
} from './content.js?v=20260929z';
import { kompasNaam, beleidsplanNaam } from './clubconfig.js?v=20260929z';

const scope = () => (S._contentScope === 'globaal' && isPlatformBeheerder()) ? 'globaal' : 'club';
const categorieLabel = () => ({
  leercurve: '📘 Leerlijn-thema',
  kompas: `🧭 ${kompasNaam()}-tip`,
  'gouden-regel': '⭐ Gouden regel',
});

let _huidigeLijst = [];

export function startClubContentListener(onData){
  return startContentAdminListener(lijst => { _huidigeLijst = lijst; onData(lijst); }, scope(), S.clubId);
}

export function htmlClubContent(lijst){
  const groepen = ['leercurve', 'kompas', 'gouden-regel'];
  const CATEGORIE_LABEL = categorieLabel();
  const sc = scope();
  return `
    ${isPlatformBeheerder() ? `<div class="segment" style="margin-bottom:12px"><button class="${sc === 'club' ? 'actief' : ''}" data-content-scope="club">Eigen teksten van de club</button><button class="${sc === 'globaal' ? 'actief' : ''}" data-content-scope="globaal">Cluppie-standaard</button></div>` : ''}
    <div class="kaart" style="margin-bottom:14px">
      <p style="font-size:calc(13px * var(--fs));color:var(--ink-2);line-height:1.5;margin-bottom:10px">
        ${sc === 'club'
          ? `Teksten uit het ${esc(beleidsplanNaam())} van ${esc(S.club?.naam || 'de club')} — leerlijn-uitleg, ${esc(kompasNaam())}-tips en gouden regels. Zolang je hier niets hebt staan, ziet de club de Cluppie-standaard. Eigen teksten vervangen de standaard: per leerthema, en bij tips en gouden regels als hele lijst.`
          : 'Je bewerkt de Cluppie-standaard: die zien alle clubs zonder eigen teksten.'}
        Wijzigingen zijn direct zichtbaar voor alle coaches. Status <b>concept</b> houdt een tekst verborgen
        voor coaches totdat je hem op <b>gepubliceerd</b> zet.
      </p>
      <button class="knop licht vol" id="btnContentNieuw">+ Nieuwe tekst</button>
      ${lijst.length === 0 ? (sc === 'club'
        ? `<button class="knop licht vol" id="btnContentKopie" style="margin-top:8px">📥 Begin met een kopie van de standaard</button>`
        : `<button class="knop licht vol" id="btnContentSeed" style="margin-top:8px">📥 Seed content vanuit jeugdbeleidsplan</button>`) : ''}
    </div>
    ${groepen.map(cat => {
      const items = lijst.filter(c => c.categorie === cat).sort((a,b) => (a.volgorde||0)-(b.volgorde||0));
      if (!items.length) return '';
      return `
        <div class="kaart" style="margin-bottom:14px">
          <h3 style="margin-bottom:8px">${CATEGORIE_LABEL[cat] || cat}</h3>
          ${items.map(c => `
            <div class="lijst-item" data-content-open="${c.id}" style="cursor:pointer">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:calc(13.5px * var(--fs))">${esc(c.titel || '(geen titel)')}</div>
                <div style="font-size:calc(11.5px * var(--fs));color:var(--ink-2)">
                  #${c.volgorde ?? '·'} · ${c.status === 'gepubliceerd' ? '✅ gepubliceerd' : '📝 concept'}
                  ${(c.tags||[]).length ? ' · ' + c.tags.map(esc).join(', ') : ''}
                </div>
              </div>
            </div>`).join('')}
        </div>`;
    }).join('')}
  `;
}

function modalContentBewerk(item){
  const isNieuw = !item;
  const c = item || { categorie:'leercurve', tags:[], volgorde:1, status:'concept', titel:'', achtergrond:'', tips:[] };
  openModal(`
    <h2>${isNieuw ? '+ Nieuwe tekst' : '✏️ ' + esc(c.titel || '')}</h2>
    <div class="veldgroep"><label>Categorie</label>
      <select class="invoer" id="cCategorie">
        <option value="leercurve" ${c.categorie==='leercurve'?'selected':''}>Leerlijn-thema</option>
        <option value="kompas" ${c.categorie==='kompas'?'selected':''}>${esc(kompasNaam())}-tip</option>
        <option value="gouden-regel" ${c.categorie==='gouden-regel'?'selected':''}>Gouden regel</option>
      </select></div>
    <div class="veldgroep"><label>Titel ${c.categorie==='leercurve' ? '(= themanaam, moet exact overeenkomen met de leerlijn)' : ''}</label>
      <input class="invoer" id="cTitel" value="${esc(c.titel||'')}"></div>
    <div class="veldgroep"><label>Achtergrond</label>
      <textarea class="invoer" id="cAchtergrond" rows="4">${esc(c.achtergrond||'')}</textarea></div>
    <div class="veldgroep"><label>Tips (één per regel)</label>
      <textarea class="invoer" id="cTips" rows="4">${(c.tips||[]).map(esc).join('\n')}</textarea></div>
    <div class="veldgroep"><label>Tags (komma-gescheiden)</label>
      <input class="invoer" id="cTags" value="${esc((c.tags||[]).join(', '))}"></div>
    <div class="veldgroep"><label>Volgorde</label>
      <input class="invoer" id="cVolgorde" type="number" value="${c.volgorde ?? 1}"></div>
    <div class="veldgroep"><label>Status</label>
      <select class="invoer" id="cStatus">
        <option value="concept" ${c.status==='concept'?'selected':''}>Concept (verborgen)</option>
        <option value="gepubliceerd" ${c.status==='gepubliceerd'?'selected':''}>Gepubliceerd</option>
      </select></div>
    <button class="knop vol" id="cOpslaan">Opslaan</button>
    ${!isNieuw ? `<button class="knop licht vol" id="cVerwijderen" style="margin-top:8px">🗑 Verwijderen</button>` : ''}
  `);
  document.getElementById('cOpslaan').onclick = async () => {
    const titel = document.getElementById('cTitel').value.trim();
    if (!titel) return meld('Vul een titel in');
    const data = {
      categorie: document.getElementById('cCategorie').value,
      titel,
      achtergrond: document.getElementById('cAchtergrond').value.trim(),
      tips: document.getElementById('cTips').value.split('\n').map(s => s.trim()).filter(Boolean),
      tags: document.getElementById('cTags').value.split(',').map(s => s.trim()).filter(Boolean),
      volgorde: Number(document.getElementById('cVolgorde').value) || 1,
      status: document.getElementById('cStatus').value,
    };
    if (data.categorie === 'leercurve') data.thema = titel;
    const id = isNieuw
      ? (data.categorie + '-' + titel.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')) || ('content-' + Date.now())
      : c.id;
    try {
      await opslaanContent(id, data, scope(), S.clubId);
      meld('Opgeslagen');
      sluitModal();
    } catch(e){
      meld('Opslaan mislukt: ' + (e.code || e.message));
    }
  };
  const verwijderKnop = document.getElementById('cVerwijderen');
  if (verwijderKnop){
    verwijderKnop.onclick = async () => {
      if (!confirm(`"${c.titel}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
      try { await verwijderContent(c.id, scope(), S.clubId); meld('Verwijderd'); sluitModal(); }
      catch(e){ meld('Verwijderen mislukt: ' + (e.code || e.message)); }
    };
  }
}

export function koppelClubContent(v, herteken){
  v.querySelectorAll('[data-content-scope]').forEach(b => b.addEventListener('click', () => { S._contentScope = b.dataset.contentScope; if (herteken) herteken(); }));
  v.querySelector('#btnContentKopie')?.addEventListener('click', async () => {
    meld('Bezig met kopiëren…');
    try { const { geschreven } = await kopieerStandaardNaarClub(S.clubId); meld(`${geschreven} teksten gekopieerd — pas ze nu aan naar jullie situatie`); }
    catch(e){ meld('Kopiëren mislukt: ' + (e.code || e.message)); }
  });
  v.querySelector('#btnContentNieuw')?.addEventListener('click', () => modalContentBewerk(null));
  v.querySelector('#btnContentSeed')?.addEventListener('click', async () => {
    meld('Bezig met seeden…');
    try {
      const { geschreven, overgeslagen } = await seedContentNaarFirestore();
      meld(`${geschreven} teksten toegevoegd, ${overgeslagen} bestonden al`);
    } catch(e){
      meld('Seeden mislukt: ' + (e.code || e.message));
    }
  });
  v.querySelectorAll('[data-content-open]').forEach(el => {
    el.addEventListener('click', () => {
      const item = _huidigeLijst.find(c => c.id === el.dataset.contentOpen);
      if (item) modalContentBewerk(item);
    });
  });
}
