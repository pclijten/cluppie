/* ====================================================================
   CLUBPROFIEL — documenten van een club inlezen (alleen de platformbeheerder).
   Tabblad "Clubprofiel" in het clubdetail van het Platformcentrum (platform-centrum.js).

   De eindbaas sleept de documenten van een club erin (PDF, Word .docx, tekst). Elk document wordt in
   deze browser gelezen, in stukken naar de functie analyseerClubdocument gestuurd en de bevindingen
   komen in de vaste hoofdstukken te staan (clubprofiel-logica.js). Daarna per bevinding:
   akkoord of afwijzen, aanpassen, en afvinken zodra het in Cluppie is gezet. Waar een antwoord rechtstreeks
   een instelling is (bouwen, rolnamen, werkwijze, formatie …) zet "Zet in Cluppie" hem met een voorstel van de AI.
   Wat nergens staat wordt een vraag voor de club.

   Opslag: clubprofielen/{clubId} (rules: alleen de platformbeheerder). De tekst van een document
   wordt niet bewaard, alleen de bevindingen met een kort citaat. Clubbeheerders zien dit niet.
==================================================================== */
import { db, doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp, functions, httpsCallable } from './firebase.js?v=20261011g';
import { esc, meld } from './state.js?v=20261117a';
import { ico } from './icons.js?v=20261116t';
import { VERSIE, MAX_DOCUMENT, FILTERS, veldenVoorAI, veldOpId, documentId, splitsDocument, halveer, docxTekst, schoonBevinding,
  opTeRuimen, nieuweBevindingen, overzicht, pastInFilter, vragenTekst, profielTekst, werklijstTekst,
  instelVelden, instelWaarde, instelWijzigingen, instelVeldenVoorAI } from './clubprofiel-logica.js?v=20261120c';

const K = {};                 // clubId → toestand van het scherm
let root = null, club = null;
const leeg = () => ({ v: VERSIE, documenten: {}, bevindingen: {} });
function staat(id){
  if (!K[id]) K[id] = { profiel: null, laden: false, fout: '', hoofdstuk: 'documenten', filter: 'alles', wachtrij: [], bezig: false, bewerk: null, nieuw: null, plak: false, zeker: null, instel: null };
  return K[id];
}
const ref = id => doc(db, 'clubprofielen', id);
let teller = 0;
const maakId = () => 'b' + Date.now().toString(36) + (teller++).toString(36) + Math.random().toString(36).slice(2, 5);
const foutTekst = x => x?.code === 'permission-denied' ? 'Firestore weigert dit. Zijn de nieuwste firestore.rules gedeployed?'
  : x?.code === 'functions/not-found' ? 'Deze functie is nog niet gedeployed (analyseerClubdocument, leesClubscan, stelClubinstellingenVoor).'
  : x?.code === 'functions/permission-denied' ? 'Alleen de platformbeheerder kan documenten inlezen.'
  : (x?.message || x?.code || 'onbekende fout');

/* ---------- openen ---------- */
export function toonClubprofiel(el, clubDoc){
  root = el; club = clubDoc;
  if (!el.dataset.cpKlaar){
    el.dataset.cpKlaar = '1';
    el.addEventListener('click', klik);
    el.addEventListener('change', wijzig);
    el.addEventListener('input', e => { const pad = e.target.dataset?.cppad, st = club && staat(club.id); if (pad && st?.instel && (e.target.type !== 'radio' || e.target.checked)) st.instel.waarden[pad] = e.target.value; });
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('cp-drop')){ e.preventDefault(); e.target.click(); } });
    el.addEventListener('dragover', e => { if (e.target.closest('.cp-drop')){ e.preventDefault(); e.target.closest('.cp-drop').classList.add('over'); } });
    el.addEventListener('dragleave', e => e.target.closest?.('.cp-drop')?.classList.remove('over'));
    el.addEventListener('drop', e => { const d = e.target.closest('.cp-drop'); if (!d) return; e.preventDefault(); d.classList.remove('over'); voegBestandenToe([...(e.dataTransfer?.files || [])]); });
  }
  const st = staat(club.id);
  if (!st.profiel && !st.laden) laad(club.id);
  teken();
}
async function laad(id){
  const st = staat(id); st.laden = true; st.fout = '';
  try { const s = await getDoc(ref(id)); st.profiel = { ...leeg(), ...(s.exists() ? s.data() : {}) }; st.profiel.documenten ||= {}; st.profiel.bevindingen ||= {}; }
  catch (x){ console.error('[clubprofiel] laden', x); st.fout = foutTekst(x); }
  st.laden = false;
  if (club?.id === id) teken();
}
async function schrijf(id, deel){
  await setDoc(ref(id), { v: VERSIE, clubId: id, bijgewerkt: serverTimestamp(), ...deel }, { merge: true });
}

/* ---------- bestanden lezen (in deze browser) ---------- */
let jszip = null;
function laadJSZip(){
  if (window.JSZip) return Promise.resolve(window.JSZip);
  jszip ||= new Promise((ok, nok) => {
    const s = document.createElement('script'); s.src = 'vendor/jszip.min.js';
    s.onload = () => window.JSZip ? ok(window.JSZip) : nok(new Error('Word-bestanden lezen lukt nu niet'));
    s.onerror = () => { jszip = null; nok(new Error('Word-bestanden lezen lukt nu niet')); };
    document.head.appendChild(s);
  });
  return jszip;
}
/* [20261120c] Een pagina zonder tekstlaag (scan) of een foto van een pagina: als JPEG naar de functie
   leesClubscan, die de tekst overneemt. Hoogstens MAX_SCAN pagina's per document. */
const MAX_SCAN = 60, SCAN_RAND = 1568;
async function beeldNaarTekst(canvas, clubId){
  let data = canvas.toDataURL('image/jpeg', 0.82);
  if (data.length > 4200000) data = canvas.toDataURL('image/jpeg', 0.6);
  const r = await httpsCallable(functions, 'leesClubscan', { timeout: 120000 })({ clubId, beeld: data.slice(data.indexOf(',') + 1) });
  return String(r?.data?.tekst || '').trim();
}
async function scanPagina(page, clubId){
  const basis = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(3, SCAN_RAND / Math.max(basis.width, basis.height)) });
  const canvas = document.createElement('canvas'); canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return beeldNaarTekst(canvas, clubId);
}
async function fotoNaarTekst(file, clubId){
  const bmp = await createImageBitmap(file), f = Math.min(1, SCAN_RAND / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bmp.width * f); canvas.height = Math.round(bmp.height * f);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return beeldNaarTekst(canvas, clubId);
}
async function leesBestand(file, clubId, voortgang = () => {}){
  const naam = file.name || '';
  if (/\.pdf$/i.test(naam) || file.type === 'application/pdf'){
    const { laadPdfJs } = await import('./pdf-viewer.js?v=20261117a');
    const { regelsUitTekstItems } = await import('./training-ai.js?v=20261117a');
    await laadPdfJs();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const delen = []; let scans = 0;
    for (let n = 1; n <= pdf.numPages; n++){
      const page = await pdf.getPage(n);
      let t = regelsUitTekstItems((await page.getTextContent()).items).trim();
      if (t.replace(/\s/g, '').length < 40){
        if (++scans > MAX_SCAN) throw new Error(`meer dan ${MAX_SCAN} ingescande pagina's: knip het document in delen`);
        voortgang(`pagina ${n} van ${pdf.numPages} lezen (scan)…`);
        t = await scanPagina(page, clubId);
      }
      if (t) delen.push(`[pagina ${n}]\n${t}\n\n`);
    }
    return { tekst: delen.join(''), paginas: pdf.numPages, scans };
  }
  if (/\.docx$/i.test(naam)){
    const zip = await (await laadJSZip()).loadAsync(await file.arrayBuffer());
    const xml = zip.file('word/document.xml');
    if (!xml) throw new Error('dit is geen geldig Word-bestand');
    return { tekst: docxTekst(await xml.async('string')), paginas: null };
  }
  if (/\.(txt|md)$/i.test(naam) || /^text\//.test(file.type || '')) return { tekst: await file.text(), paginas: null };
  if (/\.(jpe?g|png|webp)$/i.test(naam) || /^image\/(jpeg|png|webp)$/.test(file.type || '')){
    voortgang('foto lezen…');
    const t = await fotoNaarTekst(file, clubId);
    return { tekst: t ? `[pagina 1]\n${t}\n` : '', paginas: 1, scans: 1 };
  }
  if (/\.doc$/i.test(naam)) throw new Error('een oud Word-bestand (.doc): sla het op als .docx of PDF');
  throw new Error('dit bestandstype kan ik niet lezen (wel PDF, Word .docx, tekst en een foto van een pagina)');
}

/* ---------- wachtrij: document voor document ---------- */
function voegBestandenToe(files){
  if (!club || !files.length) return;
  const st = staat(club.id);
  for (const f of files) st.wachtrij.push({ naam: f.name || 'document', file: f, stand: 'wacht', stap: 'wacht' });
  teken(); verwerk(club.id);
}
function voegTekstToe(naam, tekst){
  const st = staat(club.id);
  st.wachtrij.push({ naam: naam || 'Geplakte tekst', tekst, stand: 'wacht', stap: 'wacht' });
  st.plak = false; teken(); verwerk(club.id);
}
async function verwerk(id){
  const st = staat(id);
  if (st.bezig) return;
  st.bezig = true;
  for (;;){
    const item = st.wachtrij.find(w => w.stand === 'wacht');
    if (!item) break;
    const toon = (stand, stap) => { item.stand = stand; item.stap = stap; if (club?.id === id) teken(); };
    try {
      toon('bezig', 'lezen…');
      const { tekst, paginas } = item.file ? await leesBestand(item.file, id, stap => toon('bezig', stap)) : { tekst: item.tekst, paginas: null };
      item.file = null; item.tekst = null;
      const n = await analyseer(id, item.naam, tekst, paginas, (i, van) => toon('bezig', `analyseren, deel ${i} van ${van}…`));
      toon('klaar', `${n} bevinding${n === 1 ? '' : 'en'}`);
    } catch (x){ console.error('[clubprofiel]', item.naam, x); toon('fout', foutTekst(x)); }
  }
  st.bezig = false;
  if (club?.id === id) teken();
}
async function analyseer(id, naam, tekst, paginas, voortgang){
  const st = staat(id), schoon = String(tekst || '').replace(/\r/g, '').trim();
  if (schoon.replace(/\[pagina \d+\]/g, '').trim().length < 80) throw new Error('geen leesbare tekst gevonden. Plak de tekst dan zelf.');
  if (schoon.length > MAX_DOCUMENT) throw new Error(`dit document is te groot (${Math.round(schoon.length / 1000)} duizend tekens). Knip het in delen.`);
  if (!st.profiel) await laad(id);
  if (!st.profiel) throw new Error(st.fout || 'het clubprofiel kon niet geladen worden');
  const p = st.profiel, docId = documentId(naam, schoon.length), nu = Date.now();
  const meta = { naam: naam.slice(0, 120), tekens: schoon.length, paginas: paginas || null, toegevoegdMs: p.documenten[docId]?.toegevoegdMs || nu, geanalyseerdMs: null, gevonden: 0, stukken: 0 };
  /* opnieuw inlezen: wat van dit document nog niet beoordeeld is, gaat weg */
  const weg = opTeRuimen(p, docId);
  p.documenten[docId] = meta;
  await schrijf(id, { documenten: { [docId]: meta } });
  if (weg.length){
    for (const b of weg) delete p.bevindingen[b];
    await updateDoc(ref(id), Object.fromEntries(weg.map(b => ['bevindingen.' + b, deleteField()])));
  }
  const fn = httpsCallable(functions, 'analyseerClubdocument', { timeout: 300000 });
  const hoofdstukken = veldenVoorAI(), rij = splitsDocument(schoon);
  let gedaan = 0, gevonden = 0;
  while (rij.length){
    const stuk = rij.shift();
    voortgang(gedaan + 1, gedaan + 1 + rij.length);
    let r;
    try { r = await fn({ clubId: id, documentNaam: naam, tekst: stuk, hoofdstukken }); }
    catch (x){
      /* te veel uitkomsten voor één antwoord: het stuk in tweeën en opnieuw */
      if (x?.code === 'functions/resource-exhausted' && stuk.length > 3000){ rij.unshift(...halveer(stuk)); continue; }
      throw x;
    }
    gedaan++;
    const nieuw = nieuweBevindingen(p, r?.data?.bevindingen, { id: docId, naam: meta.naam }, Date.now(), maakId);
    if (Object.keys(nieuw).length){
      Object.assign(p.bevindingen, nieuw); gevonden += Object.keys(nieuw).length;
      await schrijf(id, { bevindingen: nieuw });
    }
  }
  Object.assign(meta, { geanalyseerdMs: Date.now(), gevonden, stukken: gedaan });
  await schrijf(id, { documenten: { [docId]: meta } });
  return gevonden;
}

/* ---------- tekenen ---------- */
const chip = (t, soort) => `<span class="pf-chip ${soort || ''}">${esc(t)}</span>`;
const datum = ms => ms ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const STAND = { leeg: ['niet gevonden', 'uit'], open: ['te beoordelen', 'let'], akkoord: ['akkoord', 'ok'], verwerkt: ['verwerkt', 'ok'] };
const kpi = (g, l, s, toon) => `<div class="pc-kpi ${toon || ''}"><div class="g">${g}</div><div class="l">${esc(l)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`;

function teken(){
  if (!root || !root.isConnected || !club) return;
  const st = staat(club.id);
  if (st.fout){ root.innerHTML = `<div class="pc-signaal rood">Clubprofiel laden mislukt: ${esc(st.fout)}</div><button class="knop licht" data-cp="opnieuw">Opnieuw proberen</button>`; return; }
  if (!st.profiel){ root.innerHTML = '<p class="tc-leeg-klein">Clubprofiel laden…</p>'; return; }
  const o = overzicht(st.profiel), t = o.totaal, gevonden = t.velden - t.leeg;
  const h = o.hoofdstukken.find(x => x.id === st.hoofdstuk);
  const nav = [`<button class="cp-nav-knop ${!h ? 'actief' : ''}" data-cp="nav" data-h="documenten" ${!h ? 'aria-current="true"' : ''}><span>Documenten</span><small>${o.documenten}</small></button>`,
    ...o.hoofdstukken.map(x => `<button class="cp-nav-knop ${h?.id === x.id ? 'actief' : ''}" data-cp="nav" data-h="${x.id}" ${h?.id === x.id ? 'aria-current="true"' : ''}>
      <span>${esc(x.naam)}</span><small>${x.tel.open ? `<i class="cp-stip" title="${x.tel.open} te beoordelen"></i>` : ''}${x.tel.velden - x.tel.leeg}/${x.tel.velden}</small></button>`)].join('');
  root.innerHTML = `<div class="cp">
    <p class="tc-meta">Lees de documenten van ${esc(club.naam || 'deze club')} in. Cluppie zet wat erin staat in vaste hoofdstukken; jij keurt goed, past aan en vinkt af wat je in Cluppie hebt gezet. De club ziet dit niet.</p>
    <div class="cp-kpis">${kpi(o.documenten, 'documenten')}${kpi(`${gevonden}<small>/${t.velden}</small>`, 'onderwerpen gevonden')}${kpi(t.open, 'te beoordelen', '', t.open ? 'let' : '')}${kpi(t.leeg, 'vragen voor de club')}${kpi(t.akkoord, 'nog verwerken', '', t.akkoord ? 'let' : '')}</div>
    <div class="cp-acties">
      <button class="knop fluo klein" data-cp="kies">${ico('action-add', 16)} Documenten toevoegen</button>
      <button class="knop licht klein" data-cp="vragen">${ico('action-copy', 15)} Vragen voor de club</button>
      <button class="knop licht klein" data-cp="werklijst">${ico('action-copy', 15)} Werklijst</button>
      <button class="knop licht klein" data-cp="download">Profiel downloaden</button>
      <input type="file" id="cpBestanden" accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp" multiple hidden>
    </div>
    ${htmlWachtrij(st)}
    <div class="cp-raster"><nav class="cp-nav" aria-label="Hoofdstukken">${nav}</nav>
      <section class="cp-inhoud">${h ? htmlHoofdstuk(st, h) : htmlDocumenten(st, o)}</section></div></div>`;
  root.querySelector('.cp-nav .actief')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const f = root.querySelector('[data-cpfocus]'); if (f){ f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} }
}
function htmlWachtrij(st){
  if (!st.wachtrij.length) return '';
  return `<div class="cp-wachtrij" aria-live="polite">${st.wachtrij.map(w => `<div class="cp-wacht w-${w.stand}"><b>${esc(w.naam)}</b><span>${esc(w.stap)}</span></div>`).join('')}
    ${st.bezig ? '' : '<button class="knop licht klein" data-cp="wachtrijweg">Lijst wissen</button>'}</div>`;
}
function htmlDocumenten(st, o){
  const docs = Object.entries(st.profiel.documenten).sort((a, b) => (b[1].toegevoegdMs || 0) - (a[1].toegevoegdMs || 0));
  return `<h2 class="tc-h2">Documenten</h2>
    <div class="cp-drop" data-cp="kies" role="button" tabindex="0"><b>Sleep documenten hierheen</b><span>of tik om te kiezen. PDF, Word (.docx), tekst of een foto van een pagina; meer tegelijk mag. Een scan wordt ook gelezen.</span></div>
    ${st.plak ? `<div class="cp-plak"><input class="invoer" id="cpPlakNaam" placeholder="Naam van het document" maxlength="100">
        <textarea class="invoer" id="cpPlakTekst" rows="8" placeholder="Plak hier de tekst" data-cpfocus></textarea>
        <div class="rij"><button class="knop licht" data-cp="plak">Annuleren</button><button class="knop vol" data-cp="plakgo">Analyseren</button></div></div>`
      : '<button class="knop licht klein cp-los" data-cp="plak">Tekst plakken</button>'}
    <p class="tc-meta">De tekst van een document wordt niet bewaard, alleen de bevindingen met een kort citaat. Lever geen ledenlijsten of notulen met namen aan. Hetzelfde document opnieuw inlezen vervangt wat je nog niet beoordeeld hebt.</p>
    ${docs.length ? docs.map(([id, d]) => `<div class="pc-taak"><div class="pc-taak-tekst"><b>${esc(d.naam)}</b><small>${esc([d.paginas ? d.paginas + " pagina's" : '', Math.round((d.tekens || 0) / 1000) + ' duizend tekens', d.geanalyseerdMs ? `${d.gevonden || 0} bevindingen op ${datum(d.geanalyseerdMs)}` : 'analyse niet afgemaakt: lees het opnieuw in'].filter(Boolean).join(', '))}</small></div>
        <button class="knop licht klein ${st.zeker === 'd:' + id ? 'pc-zeker' : ''}" data-cp="docweg" data-id="${id}">${st.zeker === 'd:' + id ? 'Zeker? Verwijderen' : 'Verwijderen'}</button></div>`).join('')
      : `<div class="pc-signaal info"><b>Nog geen documenten.</b><br>De hoofdstukken links zijn nu de vragenlijst voor een eerste gesprek: ${o.totaal.velden} onderwerpen. Met "Vragen voor de club" kopieer je ze.</div>`}`;
}
function htmlHoofdstuk(st, h){
  const velden = h.velden.filter(v => pastInFilter(v, st.filter));
  const kanAkkoord = h.velden.some(v => v.bevindingen.some(b => b.oordeel === 'open' && b.citaatOk !== false && b.zeker !== 'laag'));
  return `<div class="cp-hkop"><div><h2 class="tc-h2">${esc(h.naam)}</h2><p class="tc-meta">${esc(h.uitleg)}</p></div>
      ${kanAkkoord ? '<button class="knop licht klein" data-cp="allesakkoord" title="Alleen bevindingen waarvan het citaat is teruggevonden en de zekerheid niet laag is">Alles akkoord</button>' : ''}</div>
    <div class="cp-filters" role="group" aria-label="Filter">${FILTERS.map(([id, n]) => `<button class="pf-chip cp-filter ${st.filter === id ? 'actief' : ''}" data-cp="filter" data-f="${id}" aria-pressed="${st.filter === id}">${esc(n)}</button>`).join('')}</div>
    ${velden.length ? velden.map(v => htmlVeld(st, v)).join('') : '<p class="tc-leeg-klein">Niets in dit hoofdstuk voor dit filter.</p>'}`;
}
function htmlVeld(st, v){
  const s = v.stand, [naam, soort] = STAND[s.stand];
  const afg = v.bevindingen.filter(b => b.oordeel === 'afgewezen');
  return `<article class="cp-veld st-${s.stand}">
    <header><h3>${esc(v.label)}</h3><span class="pc-chips">${s.meerdere ? chip('verschillende antwoorden', 'let') : ''}${chip(naam, soort)}</span></header>
    <p class="cp-doel">In Cluppie: ${esc(v.doel)}</p>
    ${s.mee.map(b => htmlBevinding(st, b)).join('')}
    ${s.stand === 'leeg' && v.vraag ? `<p class="cp-vraag"><b>Vraag voor de club:</b> ${esc(v.vraag)}</p>` : ''}
    ${htmlInstel(st, v)}
    ${st.nieuw === v.id ? `<div class="cp-bewerk"><textarea class="invoer" rows="3" maxlength="600" placeholder="Wat is het antwoord van de club?" data-cpfocus data-cptekst></textarea>
        <div class="rij"><button class="knop licht klein" data-cp="annuleer">Annuleren</button><button class="knop fluo klein" data-cp="nieuwopslaan" data-veld="${v.id}">Opslaan</button></div></div>`
      : `<button class="knop licht klein cp-los" data-cp="nieuw" data-veld="${v.id}">${s.mee.length ? 'Antwoord toevoegen' : 'Zelf invullen'}</button>`}
    ${afg.length ? `<details class="cp-afg"><summary>${afg.length} afgewezen</summary>${afg.map(b => `<div class="cp-afg-rij"><span>${esc(b.waarde)}</span><button class="knop licht klein" data-cp="oordeel" data-o="open" data-id="${b.id}">Terugzetten</button><button class="knop licht klein" data-cp="wis" data-id="${b.id}">Verwijderen</button></div>`).join('')}</details>` : ''}
  </article>`;
}
/* [20261120c] Zet in Cluppie: bij een goedgekeurd antwoord dat rechtstreeks een instelling is. Het formulier
   toont wat er nu staat; de AI vult een voorstel in (stelClubinstellingenVoor) en jij past toe. */
const instelTekst = (d, w) => d.type === 'keuze' ? ((d.opties.find(([id]) => id === w) || [])[1] || '').split(':')[0] : (w === '' ? 'niets ingesteld' : String(w));
function htmlInstel(st, v){
  const defs = instelVelden(v.id);
  if (!defs || !v.stand.mee.some(b => b.oordeel === 'akkoord')) return '';
  const i = st.instel;
  if (!i || i.veld !== v.id) return `<button class="knop fluo klein cp-los" data-cp="instel" data-veld="${v.id}">Zet in Cluppie</button>`;
  const veld = d => {
    const w = i.waarden[d.pad], nu = instelWaarde(club.instellingen, d);
    const invoer = d.type === 'keuze'
      ? d.opties.map(([id, n]) => `<label class="ci-schakel"><input type="radio" name="cp_${esc(d.pad)}" value="${id}" data-cppad="${esc(d.pad)}" ${String(w) === id ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')
      : `<input class="invoer ${d.type === 'getal' ? 'pc-getal' : ''}" id="cp_${esc(d.pad)}" data-cppad="${esc(d.pad)}" value="${esc(w)}" ${d.type === 'getal' ? `type="number" inputmode="numeric" min="${d.min}" max="${d.max}"` : d.type === 'kleur' ? 'type="color"' : `type="text" maxlength="${d.type === 'formatie' ? 9 : d.max}"`}>`;
    return `<div class="cp-instel-veld"><label ${d.type === 'keuze' ? '' : `for="cp_${esc(d.pad)}"`}>${esc(d.label)}</label>${invoer}
      <small>Nu in Cluppie: ${esc(instelTekst(d, nu))}${i.voorstel?.[d.pad] !== undefined ? ` · voorstel: ${esc(instelTekst(d, i.voorstel[d.pad]))}` : ''}</small></div>`;
  };
  return `<div class="cp-instel"><b>Zet in Cluppie</b>
    <p class="cp-doel" data-cpmelding>${esc(i.melding)}</p>
    ${defs.map(veld).join('')}
    <div class="rij"><button class="knop licht klein" data-cp="annuleer">Annuleren</button><button class="knop fluo klein" data-cp="instelgo" data-veld="${v.id}">Toepassen</button></div></div>`;
}
async function openInstel(veldId){
  const st = staat(club.id), clubId = club.id, defs = instelVelden(veldId);
  const o = overzicht(st.profiel).hoofdstukken.flatMap(h => h.velden).find(v => v.id === veldId);
  if (!defs || !o) return;
  const begin = Object.fromEntries(defs.map(d => [d.pad, String(instelWaarde(club.instellingen, d))]));
  const i = st.instel = { veld: veldId, waarden: { ...begin }, voorstel: null, melding: 'Voorstel uit het antwoord ophalen…' };
  st.bewerk = st.nieuw = null; teken();
  let waarden = null, melding;
  try {
    const r = await httpsCallable(functions, 'stelClubinstellingenVoor', { timeout: 60000 })({ clubId, onderwerp: o.label,
      antwoorden: o.stand.mee.filter(b => b.oordeel === 'akkoord').map(b => b.waarde), velden: instelVeldenVoorAI(veldId) });
    waarden = r?.data?.waarden || {};
    melding = Object.keys(waarden).length ? 'Voorstel ingevuld. Controleer het en pas toe.' : 'Het antwoord geeft geen duidelijke waarde. Vul het zelf in.';
  } catch (x){ console.warn('[clubprofiel] voorstel', x); melding = 'Geen voorstel (' + foutTekst(x) + '). Vul het zelf in.'; }
  if (st.instel !== i) return;
  i.melding = melding;
  /* het voorstel komt alleen in velden die je nog niet zelf hebt aangepast */
  if (waarden){ i.voorstel = waarden; for (const [pad, w] of Object.entries(waarden)) if (i.waarden[pad] === begin[pad]) i.waarden[pad] = String(w); }
  if (club?.id === clubId) teken();
}
async function pasInstelToe(veldId){
  const st = staat(club.id), clubId = club.id, i = st.instel, p = st.profiel;
  if (!i || i.veld !== veldId) return;
  const r = instelWijzigingen(veldId, club.instellingen, i.waarden);
  if (r.fout) return meld(r.fout);
  const doel = club;
  try {
    if (r.wijzigingen.length) await updateDoc(doc(db, 'clubs', clubId), Object.fromEntries(r.wijzigingen.map(([pad, w]) => ['instellingen.' + pad, w])));
  } catch (x){ return meld('Instellen mislukt: ' + foutTekst(x)); }
  /* het clubdocument in het Platformcentrum bijwerken, zodat het formulier de nieuwe stand toont */
  doel.instellingen = JSON.parse(JSON.stringify(doel.instellingen || {}));
  for (const [pad, w] of r.wijzigingen){ const k = pad.split('.'); let o = doel.instellingen; for (const d of k.slice(0, -1)) o = (o[d] && typeof o[d] === 'object') ? o[d] : (o[d] = {}); o[k.at(-1)] = w; }
  const ids = Object.entries(p.bevindingen).filter(([, b]) => b.veld === veldId && b.oordeel === 'akkoord' && !b.verwerkt).map(([id]) => id);
  for (const id of ids) p.bevindingen[id] = { ...p.bevindingen[id], verwerkt: true };
  st.instel = null; teken();
  meld(r.wijzigingen.length ? `${r.wijzigingen.length} instelling${r.wijzigingen.length === 1 ? '' : 'en'} gezet voor ${doel.naam || 'de club'}` : 'Dit stond al zo in Cluppie; afgevinkt');
  try { if (ids.length) await schrijf(clubId, { bevindingen: Object.fromEntries(ids.map(id => [id, { verwerkt: true }])) }); }
  catch (x){ meld('Afvinken mislukt: ' + foutTekst(x)); }
}
function htmlBevinding(st, b){
  if (st.bewerk === b.id) return `<div class="cp-bev cp-bewerk"><textarea class="invoer" rows="3" maxlength="600" data-cpfocus data-cptekst>${esc(b.waarde)}</textarea>
    <div class="rij"><button class="knop licht klein" data-cp="annuleer">Annuleren</button><button class="knop fluo klein" data-cp="bewaar" data-id="${b.id}">Opslaan</button></div></div>`;
  const bron = [b.handmatig ? 'zelf ingevuld' : b.bron + (b.pagina ? ', p. ' + b.pagina : ''), b.handmatig ? '' : 'zekerheid ' + b.zeker].filter(Boolean).join(', ');
  const knoppen = b.oordeel === 'open'
    ? `<button class="knop licht klein cp-ok" data-cp="oordeel" data-o="akkoord" data-id="${b.id}">${ico('action-check', 15)} Akkoord</button>
       <button class="knop licht klein" data-cp="oordeel" data-o="afgewezen" data-id="${b.id}">Afwijzen</button>
       <button class="knop licht klein" data-cp="bewerk" data-id="${b.id}">Aanpassen</button>`
    : `<button class="cp-vink" role="switch" aria-checked="${b.verwerkt}" data-cp="verwerkt" data-id="${b.id}"><i></i>In Cluppie gezet</button>
       <button class="knop licht klein" data-cp="bewerk" data-id="${b.id}">Aanpassen</button>
       <button class="knop licht klein" data-cp="oordeel" data-o="open" data-id="${b.id}">Terugzetten</button>`;
  return `<div class="cp-bev o-${b.oordeel}${b.verwerkt ? ' is-verwerkt' : ''}">
    <p class="cp-waarde">${esc(b.waarde)}</p>
    ${b.citaat ? `<blockquote class="cp-citaat">${esc(b.citaat)}</blockquote>` : ''}
    <p class="cp-bron">${esc(bron)}${b.citaatOk === false && !b.handmatig ? ' <span class="cp-let">' + ico('action-warning', 14) + ' citaat niet teruggevonden in het document: controleer dit zelf</span>' : ''}</p>
    <div class="cp-knoppen">${knoppen}</div></div>`;
}

/* ---------- acties ---------- */
async function zetBevinding(id, deel){
  const st = staat(club.id), clubId = club.id, oud = st.profiel.bevindingen[id];
  if (!oud) return;
  st.profiel.bevindingen[id] = { ...oud, ...deel }; teken();
  try { await schrijf(clubId, { bevindingen: { [id]: deel } }); }
  catch (x){ st.profiel.bevindingen[id] = oud; meld('Opslaan mislukt: ' + foutTekst(x)); if (club?.id === clubId) teken(); }
}
async function wisBevindingen(ids){
  const st = staat(club.id), clubId = club.id;
  if (!ids.length) return;
  for (const id of ids) delete st.profiel.bevindingen[id];
  teken();
  try { await updateDoc(ref(clubId), Object.fromEntries(ids.map(id => ['bevindingen.' + id, deleteField()]))); }
  catch (x){ meld('Verwijderen mislukt: ' + foutTekst(x)); st.profiel = null; laad(clubId); }
}
async function kopieer(tekst, klaar){
  try { await navigator.clipboard.writeText(tekst); meld(klaar); }
  catch (e){ download('cluppie-tekst.txt', tekst); }
}
function download(naam, tekst){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([tekst], { type: 'text/plain;charset=utf-8' })); a.download = naam;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const bestandsnaam = s => String(s || 'club').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'club';

async function klik(e){
  const b = e.target.closest('[data-cp]');
  if (!b || !root.contains(b) || b.disabled || !club) return;
  const a = b.dataset.cp, st = staat(club.id), p = st.profiel, id = b.dataset.id;
  if (a === 'opnieuw') return laad(club.id).then(teken);
  if (!p) return;
  if (a !== 'docweg') st.zeker = null;
  if (a === 'nav'){ st.hoofdstuk = b.dataset.h; st.bewerk = st.nieuw = st.instel = null; teken(); root.closest('.tc-hoofd')?.scrollTo?.({ top: 0 }); return; }
  if (a === 'filter'){ st.filter = b.dataset.f; return teken(); }
  if (a === 'kies') return root.querySelector('#cpBestanden')?.click();
  if (a === 'plak'){ st.plak = !st.plak; st.hoofdstuk = 'documenten'; return teken(); }
  if (a === 'plakgo'){
    const tekst = root.querySelector('#cpPlakTekst')?.value || '';
    if (tekst.trim().length < 200) return meld('Plak eerst (meer) tekst');
    return voegTekstToe(root.querySelector('#cpPlakNaam')?.value.trim(), tekst);
  }
  if (a === 'wachtrijweg'){ st.wachtrij = []; return teken(); }
  if (a === 'vragen') return kopieer(vragenTekst(p, club.naam), 'Vragen gekopieerd');
  if (a === 'werklijst') return kopieer(werklijstTekst(p, club.naam), 'Werklijst gekopieerd');
  if (a === 'download') return download(`clubprofiel-${bestandsnaam(club.naam)}.md`, profielTekst(p, club.naam));
  if (a === 'oordeel') return zetBevinding(id, { oordeel: b.dataset.o, ...(b.dataset.o === 'akkoord' ? {} : { verwerkt: false }) });
  if (a === 'verwerkt') return zetBevinding(id, { verwerkt: !p.bevindingen[id]?.verwerkt });
  if (a === 'bewerk'){ st.bewerk = id; st.nieuw = null; return teken(); }
  if (a === 'nieuw'){ st.nieuw = b.dataset.veld; st.bewerk = null; return teken(); }
  if (a === 'annuleer'){ st.bewerk = st.nieuw = st.instel = null; return teken(); }
  if (a === 'instel') return openInstel(b.dataset.veld);
  if (a === 'instelgo') return pasInstelToe(b.dataset.veld);
  if (a === 'bewaar'){
    const w = b.closest('.cp-bewerk')?.querySelector('[data-cptekst]')?.value.replace(/\s+/g, ' ').trim();
    if (!w) return meld('Vul een antwoord in');
    st.bewerk = null;
    return zetBevinding(id, { waarde: w.slice(0, 600) });
  }
  if (a === 'nieuwopslaan'){
    const w = b.closest('.cp-bewerk')?.querySelector('[data-cptekst]')?.value;
    const nieuw = schoonBevinding({ veld: b.dataset.veld, waarde: w, oordeel: 'akkoord', handmatig: true, gemaaktMs: Date.now() });
    if (!nieuw || !veldOpId(nieuw.veld)) return meld('Vul een antwoord in');
    const nid = maakId(), clubId = club.id;
    p.bevindingen[nid] = nieuw; st.nieuw = null; teken();
    try { await schrijf(clubId, { bevindingen: { [nid]: nieuw } }); }
    catch (x){ delete p.bevindingen[nid]; meld('Opslaan mislukt: ' + foutTekst(x)); teken(); }
    return;
  }
  if (a === 'wis') return wisBevindingen([id]);
  if (a === 'allesakkoord'){
    const h = overzicht(p).hoofdstukken.find(x => x.id === st.hoofdstuk); if (!h) return;
    const ids = h.velden.flatMap(v => v.bevindingen).filter(x => x.oordeel === 'open' && x.citaatOk !== false && x.zeker !== 'laag').map(x => x.id);
    if (!ids.length) return;
    const clubId = club.id;
    for (const i of ids) p.bevindingen[i] = { ...p.bevindingen[i], oordeel: 'akkoord' };
    teken();
    try { await schrijf(clubId, { bevindingen: Object.fromEntries(ids.map(i => [i, { oordeel: 'akkoord' }])) }); meld(`${ids.length} bevinding${ids.length === 1 ? '' : 'en'} akkoord`); }
    catch (x){ meld('Opslaan mislukt: ' + foutTekst(x)); st.profiel = null; laad(clubId); }
    return;
  }
  if (a === 'docweg'){
    if (st.zeker !== 'd:' + id){ st.zeker = 'd:' + id; return teken(); }
    st.zeker = null;
    /* het document en wat ervan nog niet is goedgekeurd; goedgekeurde bevindingen blijven staan */
    const weg = Object.entries(p.bevindingen).filter(([, x]) => x.docId === id && x.oordeel !== 'akkoord').map(([i]) => i), clubId = club.id;
    delete p.documenten[id]; for (const i of weg) delete p.bevindingen[i];
    teken();
    try { await updateDoc(ref(clubId), { ['documenten.' + id]: deleteField(), ...Object.fromEntries(weg.map(i => ['bevindingen.' + i, deleteField()])) }); meld('Document verwijderd'); }
    catch (x){ meld('Verwijderen mislukt: ' + foutTekst(x)); st.profiel = null; laad(clubId); }
  }
}
function wijzig(e){
  if (e.target.id !== 'cpBestanden') return;
  const files = [...(e.target.files || [])]; e.target.value = '';
  voegBestandenToe(files);
}
