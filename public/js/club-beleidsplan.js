/* ==================== BELEIDSPLAN IMPORTEREN ====================
   Een clubbeheerder haalt teksten uit het eigen beleidsplan (PDF of geplakte tekst) in de app.
   Stappen: bron → (AI-analyse óf handmatig splitsen) → controleren/aanpassen → opslaan als CONCEPT
   in clubs/{id}/content. Niets wordt aan coaches getoond tot de beheerder het publiceert (tabblad Content).
   Het plan van een andere club mag alleen worden gebruikt met toestemming van die club. */
import { S, esc, meld, openModal, sluitModal } from './state.js?v=20261011g';
import { LEERCURVE } from './config.js?v=20261011g';
import { functions, httpsCallable } from './firebase.js?v=20261011g';
import { aiAan, kompasNaam, beleidsplanNaam } from './clubconfig.js?v=20261011g';
import { opslaanContent } from './content.js?v=20261011g';
import { huidigeContentLijst } from './club-content.js?v=20261011g';

const MAX_STUK = 12000;
const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
const THEMAS = () => LEERCURVE.map(l => l.thema);

/* Tekst in stukken van ≤ MAX_STUK tekens, bij voorkeur op een lege regel. */
export function splitsInStukken(tekst){
  const stukken = []; let huidig = '';
  for (const alinea of String(tekst).split(/\n\s*\n/)){
    if ((huidig + '\n\n' + alinea).length > MAX_STUK && huidig){ stukken.push(huidig); huidig = ''; }
    huidig = huidig ? huidig + '\n\n' + alinea : alinea;
    while (huidig.length > MAX_STUK){ stukken.push(huidig.slice(0, MAX_STUK)); huidig = huidig.slice(MAX_STUK); }
  }
  if (huidig.trim()) stukken.push(huidig);
  return stukken;
}

/* Zonder AI: kop-achtige regels (kort, geen eindpunt) openen een nieuw onderdeel. */
export function splitsOpKoppen(tekst){
  const regels = String(tekst).split('\n');
  const delen = []; let kop = null, body = [];
  const sluit = () => { const b = body.join(' ').replace(/\s+/g, ' ').trim(); if (kop && b.length > 40) delen.push({ categorie: '', titel: kop, achtergrond: b.slice(0, 1200), tips: [], tags: [] }); body = []; };
  for (const r of regels){
    const t = r.trim(); if (!t) continue;
    const isKop = t.length <= 70 && !/[.!?:;,]$/.test(t) && /^[A-Z0-9À-Ý]/.test(t) && t.split(' ').length <= 9;
    if (isKop){ sluit(); kop = t.replace(/^\d+(\.\d+)*\s*/, ''); } else body.push(t);
  }
  sluit();
  return delen;
}

async function pdfNaarTekst(file){
  const { laadPdfJs } = await import('./pdf-viewer.js?v=20261011g');
  const { regelsUitTekstItems } = await import('./training-ai.js?v=20261011g');
  await laadPdfJs();
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n++){
    const c = await (await pdf.getPage(n)).getTextContent();
    paginas.push(regelsUitTekstItems(c.items));
  }
  return paginas.join('\n\n');
}

export function openBeleidsplanImport(){
  const st = { tekst: '', items: [], bezig: false };
  const naam = beleidsplanNaam();
  const stap1 = () => {
    openModal(`<h2>📄 ${esc(naam)} importeren</h2>
      <p class="cb-uitleg" style="margin:0 0 10px">Kies het ${esc(naam)} van <b>${esc(S.club?.naam || 'je club')}</b> (PDF) of plak de tekst. Cluppie stelt daaruit teksten voor: leerlijn-thema’s, ${esc(kompasNaam())}-tips en gouden regels. Alles komt als <b>concept</b> te staan; coaches zien niets totdat jij publiceert.</p>
      <p class="cb-uitleg" style="margin:0 0 10px">Gebruik alleen een plan van je eigen club, of van een andere club met haar toestemming.</p>
      <input type="file" id="bpBestand" accept="application/pdf,.pdf,.txt,text/plain" style="display:none">
      <button class="knop licht vol" id="bpKies">PDF of tekstbestand kiezen…</button>
      <textarea class="invoer" id="bpTekst" rows="8" placeholder="…of plak hier de tekst" style="margin-top:10px">${esc(st.tekst)}</textarea>
      <p class="cb-uitleg" id="bpInfo" style="margin:6px 0 0"></p>
      <div class="rij" style="margin-top:12px">
        <button class="knop licht vol" id="bpHandmatig">Zonder AI: in onderdelen splitsen</button>
        <button class="knop vol" id="bpAi" ${aiAan() ? '' : 'disabled'}>Analyseren met AI</button></div>
      ${aiAan() ? '' : '<p class="cb-uitleg">AI staat uit voor deze club (Instellingen → AI &amp; modules).</p>'}`);
    const bestand = document.getElementById('bpBestand'), tekstEl = document.getElementById('bpTekst'), info = document.getElementById('bpInfo');
    document.getElementById('bpKies').onclick = () => bestand.click();
    bestand.onchange = async () => {
      const f = bestand.files && bestand.files[0]; if (!f) return;
      info.textContent = 'Bestand lezen…';
      try {
        tekstEl.value = /pdf$/i.test(f.name) || f.type === 'application/pdf' ? await pdfNaarTekst(f) : await f.text();
        info.textContent = tekstEl.value.trim().length < 80 ? 'Er is weinig tekst gevonden. Is dit een ingescande PDF? Plak dan de tekst handmatig.' : `${tekstEl.value.length.toLocaleString('nl-NL')} tekens gelezen.`;
      } catch (e){ console.error(e); info.textContent = 'Lezen mislukt: ' + (e.message || e); }
    };
    const lees = () => { st.tekst = tekstEl.value.trim(); if (st.tekst.length < 80){ meld('Voeg eerst (meer) tekst toe'); return false; } return true; };
    document.getElementById('bpHandmatig').onclick = () => {
      if (!lees()) return;
      st.items = splitsOpKoppen(st.tekst);
      if (!st.items.length) return meld('Geen onderdelen gevonden. Probeer de AI-analyse.');
      stap2();
    };
    document.getElementById('bpAi').onclick = async e => {
      if (!lees()) return;
      const knop = e.currentTarget; knop.disabled = true;
      const stukken = splitsInStukken(st.tekst), alle = [];
      try {
        const fn = httpsCallable(functions, 'analyseerBeleidsplan');
        for (let i = 0; i < stukken.length; i++){
          knop.textContent = `Analyseren ${i + 1}/${stukken.length}…`;
          const r = await fn({ clubId: S.clubId, tekst: stukken[i], themas: THEMAS() });
          alle.push(...((r.data && r.data.items) || []));
        }
      } catch (err){
        console.error(err); knop.disabled = false; knop.textContent = 'Analyseren met AI';
        return meld('Analyse mislukt: ' + (err.message || err.code) + ' — je kunt ook zonder AI splitsen.');
      }
      /* dubbele thema's uit meerdere stukken samenvoegen */
      const perThema = new Map(), rest = [];
      for (const i of alle){
        if (i.categorie !== 'leercurve'){ rest.push(i); continue; }
        const b = perThema.get(i.thema);
        if (!b) perThema.set(i.thema, { ...i, tips: [...(i.tips || [])] });
        else { b.achtergrond = (b.achtergrond + ' ' + (i.achtergrond || '')).trim().slice(0, 1200); b.tips = [...new Set([...b.tips, ...(i.tips || [])])].slice(0, 8); b.tags = [...new Set([...(b.tags || []), ...(i.tags || [])])]; }
      }
      st.items = [...perThema.values(), ...rest];
      if (!st.items.length){ knop.disabled = false; knop.textContent = 'Analyseren met AI'; return meld('De AI vond geen bruikbare teksten. Probeer het zonder AI.'); }
      stap2();
    };
  };

  const stap2 = () => {
    const bestaand = huidigeContentLijst();
    const heeft = (cat, titel) => bestaand.some(c => c.categorie === cat && (c.titel || '').toLowerCase() === String(titel).toLowerCase());
    openModal(`<h2>Controleer de voorstellen</h2>
      <p class="cb-uitleg" style="margin:0 0 10px">${st.items.length} onderdelen gevonden. Pas aan of zet uit wat je niet wilt. Dit wordt als <b>concept</b> opgeslagen; publiceren doe je daarna in het tabblad Content.</p>
      <div id="bpLijst">${st.items.map((it, i) => `
        <div class="kaart" data-bp="${i}" style="margin-bottom:10px">
          <label class="ci-schakel"><input type="checkbox" class="bpAan" ${it.categorie ? 'checked' : ''}><span><b>Opnemen</b></span></label>
          <select class="invoer bpCat" style="margin:6px 0">
            <option value="" ${!it.categorie ? 'selected' : ''}>— overslaan —</option>
            <option value="leercurve" ${it.categorie === 'leercurve' ? 'selected' : ''}>Leerlijn-thema</option>
            <option value="kompas" ${it.categorie === 'kompas' ? 'selected' : ''}>${esc(kompasNaam())}-tip</option>
            <option value="gouden-regel" ${it.categorie === 'gouden-regel' ? 'selected' : ''}>Gouden regel</option></select>
          <select class="invoer bpThema" style="margin-bottom:6px;${it.categorie === 'leercurve' ? '' : 'display:none'}">
            ${THEMAS().map(t => `<option ${t === (it.thema || it.titel) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <input class="invoer bpTitel" value="${esc(it.titel || '')}" style="${it.categorie === 'leercurve' ? 'display:none' : ''}" maxlength="300">
          <textarea class="invoer bpAch" rows="3" style="margin-top:6px" placeholder="Achtergrond">${esc(it.achtergrond || '')}</textarea>
          <textarea class="invoer bpTips" rows="3" style="margin-top:6px" placeholder="Tips, één per regel">${esc((it.tips || []).join('\n'))}</textarea>
          ${it.categorie === 'leercurve' && heeft('leercurve', it.thema || it.titel) ? '<p class="cb-uitleg" style="margin:4px 0 0;color:var(--accent)">Vervangt de bestaande eigen tekst voor dit thema.</p>' : ''}
        </div>`).join('')}</div>
      <div class="rij"><button class="knop licht vol" id="bpTerug">Terug</button><button class="knop vol" id="bpOpslaan">Opslaan als concept</button></div>`);
    document.querySelectorAll('[data-bp]').forEach(k => {
      const cat = k.querySelector('.bpCat');
      cat.onchange = () => { const l = cat.value === 'leercurve'; k.querySelector('.bpThema').style.display = l ? '' : 'none'; k.querySelector('.bpTitel').style.display = l ? 'none' : ''; k.querySelector('.bpAan').checked = !!cat.value; };
    });
    document.getElementById('bpTerug').onclick = stap1;
    document.getElementById('bpOpslaan').onclick = async e => {
      const knop = e.currentTarget; knop.disabled = true;
      const basis = Math.max(0, ...bestaand.map(c => Number(c.volgorde) || 0));
      let n = 0, gedaan = 0;
      try {
        for (const k of document.querySelectorAll('[data-bp]')){
          const cat = k.querySelector('.bpCat').value;
          if (!k.querySelector('.bpAan').checked || !cat) continue;
          const titel = (cat === 'leercurve' ? k.querySelector('.bpThema').value : k.querySelector('.bpTitel').value).trim();
          if (!titel) continue;
          const i = st.items[Number(k.dataset.bp)];
          const data = {
            categorie: cat, titel, tags: i.tags || [], volgorde: basis + (++n), status: 'concept', bron: 'beleidsplan-import',
            achtergrond: k.querySelector('.bpAch').value.trim(),
            tips: k.querySelector('.bpTips').value.split('\n').map(s => s.trim()).filter(Boolean),
          };
          if (cat === 'leercurve') data.thema = titel;
          const id = cat === 'leercurve' ? 'leercurve-' + slug(titel) : `${cat}-${slug(titel)}-${Date.now().toString(36)}${n}`;
          await opslaanContent(id, data, 'club', S.clubId); gedaan++;
        }
      } catch (err){ knop.disabled = false; return meld('Opslaan mislukt: ' + (err.code || err.message)); }
      sluitModal(); meld(gedaan ? `${gedaan} teksten als concept opgeslagen — controleer en publiceer ze hieronder` : 'Niets opgeslagen');
    };
  };
  stap1();
}
