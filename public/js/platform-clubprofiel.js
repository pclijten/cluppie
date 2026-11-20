/* ====================================================================
   CLUBPROFIEL — documenten van een club inlezen en in Cluppie zetten (alleen de platformbeheerder).
   Tabblad "Clubprofiel" in het clubdetail van het Platformcentrum (platform-centrum.js).

   [20261120d] Opnieuw opgezet rond één handeling per onderwerp:
     1. Documenten erin slepen (PDF, Word, tekst, scan of foto). De AI leest elk document in zijn geheel,
        per groep hoofdstukken (analyseerClubdocument), en levert per onderwerp het antwoord van de club
        mét het voorstel voor Cluppie.
     2. Per onderwerp staat links wat de club zegt (met citaat) en rechts "Zo komt het in Cluppie":
        de instellingen, de tekst voor de Clubwijzer, de gouden regels en (bij beoordelen) de evaluatierondes,
        al ingevuld. [20261120e] Beoordelen: momenten worden rondes, de schaal en de domeinen worden instellingen.
     3. "Goedkeuren en in Cluppie zetten" schrijft alles in één keer: instellingen naar clubs/{id}.instellingen,
        teksten naar clubs/{id}/content. Aanpassen kan in het formulier zelf.
     4. Manco's: wat nergens staat, maar half staat of elkaar tegenspreekt, met de vraag voor de club.
        Een antwoord dat je zelf invult krijgt ook een voorstel (stelClubinstellingenVoor).

   Opslag: clubprofielen/{clubId} (rules: alleen de platformbeheerder). De tekst van een document wordt niet
   bewaard, alleen de bevindingen met een kort citaat. Clubbeheerders zien dit scherm niet; wat gezet is
   zien ze gewoon in hun instellingen en onder Content.
==================================================================== */
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, functions, httpsCallable } from './firebase.js?v=20261011g';
import { esc, meld } from './state.js?v=20261120g';
import { ico } from './icons.js?v=20261116t';
import { VERSIE, MAX_DOCUMENT, FILTERS, GROEPEN, veldenVoorAI, veldOpId, hoofdstukOpId, documentId, docxTekst, schoonBevinding, schoonVoorstel, voorstelLeeg,
  opTeRuimen, nieuweBevindingen, overzicht, pastInFilter, mancos, vragenTekst, profielTekst, regelsUit, titelVan, contentDocs,
  instelVelden, instelWaarde, instelWijzigingen, controleerInstelling, instelVeldenVoorAI, schoonRondes, rondesSamenvoegen, seizoenVan, inrichtingOverzicht, voorbeeldVoor, voorbeeldInrichting } from './clubprofiel-logica.js?v=20261120g';

const K = {};                 // clubId → toestand van het scherm
let root = null, club = null;
const leeg = () => ({ v: VERSIE, documenten: {}, bevindingen: {}, tekstStatus: 'concept' });
function staat(id){
  if (!K[id]) K[id] = { profiel: null, laden: false, fout: '', hoofdstuk: 'documenten', filter: 'alles', wachtrij: [], bezig: false,
    concept: {}, bewerk: new Set(), druk: new Set(), nieuw: null, plak: false, zeker: null };
  return K[id];
}
const ref = id => doc(db, 'clubprofielen', id);
const contentRef = (clubId, id) => doc(db, 'clubs', clubId, 'content', id);
const seizoenTekst = () => { const z = seizoenVan(club && club.huidigSeizoen); return `${z.label} (${z.tekst})`; };
let teller = 0;
const maakId = () => 'b' + Date.now().toString(36) + (teller++).toString(36) + Math.random().toString(36).slice(2, 5);
const foutTekst = x => x?.code === 'permission-denied' ? 'Firestore weigert dit. Zijn de nieuwste firestore.rules gedeployed?'
  : x?.code === 'functions/not-found' ? 'Deze functie is nog niet gedeployed (analyseerClubdocument, leesClubscan, stelClubinstellingenVoor).'
  : x?.code === 'functions/permission-denied' ? 'Alleen de platformbeheerder kan dit.'
  : x?.code === 'functions/deadline-exceeded' ? 'De analyse duurde te lang. Probeer het opnieuw.'
  : (x?.message || x?.code || 'onbekende fout');

/* ---------- openen ---------- */
export function toonClubprofiel(el, clubDoc){
  root = el; club = clubDoc;
  if (!el.dataset.cpKlaar){
    el.dataset.cpKlaar = '1';
    el.addEventListener('click', klik);
    el.addEventListener('change', wijzig);
    el.addEventListener('input', invoer);
    el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('cp-drop')){ e.preventDefault(); e.target.click(); } });
    el.addEventListener('dragover', e => { if (e.target.closest('.cp-drop')){ e.preventDefault(); e.target.closest('.cp-drop').classList.add('over'); } });
    el.addEventListener('dragleave', e => e.target.closest?.('.cp-drop')?.classList.remove('over'));
    el.addEventListener('drop', e => { const d = e.target.closest('.cp-drop'); if (!d) return; e.preventDefault(); d.classList.remove('over'); voegBestandenToe([...(e.dataTransfer?.files || [])]); });
  }
  const st = staat(club.id);
  if (!st.profiel && !st.laden) laad(club.id);
  teken();
  /* [20261120g] voorbeeld op de telefoon (alleen op een breed scherm standaard aan) */
  if (TEL.open && window.innerWidth >= 1100){ telefoonPaneel(); if (!TEL.frame.getAttribute('src')) laadFrame(); else if (TEL.klaar) synchroniseer().then(() => toonOpTelefoon(TEL.veld)); }
}
async function laad(id){
  const st = staat(id); st.laden = true; st.fout = '';
  try {
    const s = await getDoc(ref(id)); st.profiel = { ...leeg(), ...(s.exists() ? s.data() : {}) }; st.profiel.documenten ||= {};
    /* elke bevinding door de schoonmaak: oude bevindingen (zonder voorstel) blijven bruikbaar */
    st.profiel.bevindingen = Object.fromEntries(Object.entries(st.profiel.bevindingen || {}).map(([k, b]) => [k, schoonBevinding(b)]).filter(([, b]) => b));
  } catch (x){ console.error('[clubprofiel] laden', x); st.fout = foutTekst(x); }
  st.laden = false;
  if (club?.id === id){ teken(); if (TEL.klaar) synchroniseerStraks(); }
}
/* samenvoegen (nieuwe bevindingen, documenten, losse velden) */
async function schrijf(id, deel){
  await setDoc(ref(id), { v: VERSIE, clubId: id, bijgewerkt: serverTimestamp(), ...deel }, { merge: true });
}
/* vervangen op een pad: een heel voorstel of een hele "gezet" in één keer, zonder oude sleutels te laten staan */
async function vervang(id, paden){
  await updateDoc(ref(id), { bijgewerkt: serverTimestamp(), ...paden });
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
    const { laadPdfJs } = await import('./pdf-viewer.js?v=20261120g');
    const { regelsUitTekstItems } = await import('./training-ai.js?v=20261120g');
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
    const toon = (stand, stap) => { item.stand = stand; item.stap = stap; if (club?.id === id) tekenWachtrij(); };
    try {
      toon('bezig', 'lezen…');
      const { tekst, paginas } = item.file ? await leesBestand(item.file, id, stap => toon('bezig', stap)) : { tekst: item.tekst, paginas: null };
      item.file = null; item.tekst = null;
      const n = await analyseer(id, item.naam, tekst, paginas, (klaar, totaal) => toon('bezig', `analyseren: ${klaar} van ${totaal} hoofdstukken klaar…`));
      toon('klaar', `${n} onderwerp${n === 1 ? '' : 'en'} gevonden`);
    } catch (x){ console.error('[clubprofiel]', item.naam, x); toon('fout', foutTekst(x)); }
    if (club?.id === id) teken();
  }
  st.bezig = false;
  if (club?.id === id) teken();
}
/* Het hele document gaat per groep hoofdstukken naar de AI. De eerste groep eerst (die zet het document in de
   cache van het model), de rest tegelijk. Levert een groep te veel op voor één antwoord, dan in tweeën. */
async function analyseer(id, naam, tekst, paginas, voortgang){
  const st = staat(id), schoon = String(tekst || '').replace(/\r/g, '').trim();
  if (schoon.replace(/\[pagina \d+\]/g, '').trim().length < 80) throw new Error('geen leesbare tekst gevonden. Plak de tekst dan zelf.');
  if (schoon.length > MAX_DOCUMENT) throw new Error(`dit document is te groot (${Math.round(schoon.length / 1000)} duizend tekens). Knip het in delen.`);
  if (!st.profiel) await laad(id);
  if (!st.profiel) throw new Error(st.fout || 'het clubprofiel kon niet geladen worden');
  const p = st.profiel, docId = documentId(naam, schoon.length), nu = Date.now();
  const meta = { naam: naam.slice(0, 120), tekens: schoon.length, paginas: paginas || null, toegevoegdMs: p.documenten[docId]?.toegevoegdMs || nu, geanalyseerdMs: null, gevonden: 0 };
  /* opnieuw inlezen: wat van dit document nog niet beoordeeld is, gaat weg */
  const weg = opTeRuimen(p, docId);
  p.documenten[docId] = meta;
  await schrijf(id, { documenten: { [docId]: meta } });
  if (weg.length){
    for (const b of weg) delete p.bevindingen[b];
    await updateDoc(ref(id), Object.fromEntries(weg.map(b => ['bevindingen.' + b, deleteField()])));
  }
  const fn = httpsCallable(functions, 'analyseerClubdocument', { timeout: 540000 });
  const totaal = GROEPEN.flat().length;
  let klaar = 0, gevonden = 0;
  voortgang(0, totaal);
  const doe = async (ids) => {
    let r;
    try { r = await fn({ clubId: id, documentNaam: naam, tekst: schoon, hoofdstukken: veldenVoorAI(ids), seizoen: seizoenTekst() }); }
    catch (x){
      if (x?.code === 'functions/resource-exhausted' && ids.length > 1){ const h = Math.ceil(ids.length / 2); await doe(ids.slice(0, h)); await doe(ids.slice(h)); return; }
      throw x;
    }
    const nieuw = nieuweBevindingen(p, r?.data?.bevindingen, { id: docId, naam: meta.naam }, Date.now(), maakId);
    if (Object.keys(nieuw).length){
      Object.assign(p.bevindingen, nieuw); gevonden += Object.keys(nieuw).length;
      await schrijf(id, { bevindingen: nieuw });
    }
    klaar += ids.length; voortgang(klaar, totaal);
    if (club?.id === id && !document.activeElement?.closest?.('.cp-cluppie, .cp-bewerk, .cp-plak')) teken();
    if (TEL.klaar && club?.id === id) synchroniseerStraks();
  };
  await doe(GROEPEN[0]);
  const uitkomsten = await Promise.allSettled(GROEPEN.slice(1).map(doe));
  const mis = uitkomsten.find(u => u.status === 'rejected');
  if (mis && !gevonden) throw mis.reason;
  Object.assign(meta, { geanalyseerdMs: mis ? null : Date.now(), gevonden });
  await schrijf(id, { documenten: { [docId]: meta } });
  if (mis) throw new Error(`${gevonden} onderwerpen gevonden, maar niet alle hoofdstukken zijn gelukt (${foutTekst(mis.reason)}). Lees het document opnieuw in.`);
  return gevonden;
}

/* ---------- het concept van één bevinding: wat er in het formulier staat ---------- */
function conceptVan(st, v, b){
  if (st.concept[b.id]) return st.concept[b.id];
  const bron = b.gezet || b.voorstel || {};
  const inst = {};
  for (const d of (instelVelden(v.id) || [])){
    const w = (bron.instellingen || {})[d.pad];
    inst[d.pad] = String(w === undefined || w === null || w === '' ? instelWaarde(club.instellingen, d) : w);
  }
  return (st.concept[b.id] = { titel: bron.titel || titelVan(v, b.waarde), tekst: bron.tekst || '', regels: (bron.regels || []).join('\n'), rondes: (bron.rondes || []).map(r => ({ ...r, van: r.van || '' })), inst });
}

/* ==================== [20261120g] VOORBEELD OP DE TELEFOON ====================
   Een telefoonvenster rechts naast het Clubprofiel met de echte app in demomodus (index.html?demo=coach),
   bekeken als trainer. Daarin staat de inrichting van deze club zoals hij wordt als je alles goedkeurt
   (voorbeeldInrichting: wat al in Cluppie staat plus de voorstellen), en per onderwerp springt de telefoon
   naar het scherm waar een trainer het ziet (voorbeeldVoor). Je kunt er gewoon doorheen tikken.

   Alles gebeurt in de demo-database van het venster zelf (in het geheugen): er gaat niets naar Firebase en
   niets naar de club. Het venster hangt aan <body> en niet in het scherm, omdat een iframe opnieuw laadt
   zodra het in de pagina wordt verplaatst; het scherm maakt ruimte met de klasse cp-telefoon-aan. */
const TEL = { el: null, frame: null, klaar: false, veld: null, ids: [], open: true, timer: null, bezig: null, wacht: null };
const DEMO_TEAM = 'demo-o11-2';
try { TEL.open = localStorage.getItem('cpTelefoon') !== 'uit'; } catch (e) {}
const SCHERM_NAAM = { clubwijzer: 'Documenten › Clubwijzer', hub: 'Het team (startscherm)', spelers: 'Spelers' };

function telefoonPaneel(){
  if (TEL.el) return TEL.el;
  const el = document.createElement('aside');
  el.className = 'cp-tel'; el.setAttribute('aria-label', 'Voorbeeld op de telefoon');
  el.innerHTML = `<div class="cp-tel-kop"><div><b>Zo ziet een trainer het</b><small>Voorbeeld met wat in Cluppie staat en alle voorstellen. Er gaat niets naar de club.</small></div>
      <button class="knop licht klein" data-cptel="vernieuw" title="Voorbeeld opnieuw laden">${ico('action-loading', 15)}</button>
      <button class="knop licht klein" data-cptel="dicht" title="Telefoon verbergen">${ico('navigation-close', 15)}</button></div>
    <div class="cp-tel-wrap"><div class="cp-tel-frame"><iframe title="Cluppie zoals een trainer het ziet"></iframe><div class="cp-tel-laden">Voorbeeld laden…</div></div></div>
    <div class="cp-tel-uitleg" aria-live="polite"></div>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-cptel]'); if (!b) return;
    if (b.dataset.cptel === 'dicht') return zetTelefoon(false);
    if (b.dataset.cptel === 'vernieuw'){ TEL.klaar = false; TEL.ids = []; laadFrame(); return; }
    if (b.dataset.cptel === 'clubwijzer') return toonOpTelefoon(TEL.veld, 'clubwijzer');
  });
  document.body.appendChild(el);
  TEL.el = el; TEL.frame = el.querySelector('iframe');
  TEL.frame.addEventListener('load', () => { TEL.klaar = false; wachtOpApp(); });
  window.addEventListener('resize', schaalTelefoon);
  /* het venster verdwijnt als het Clubprofiel niet meer in beeld is (ander tabblad, andere club, centrum dicht) */
  TEL.wacht = setInterval(() => { if (TEL.el) TEL.el.hidden = !(TEL.open && root && root.isConnected); document.body.classList.toggle('cp-telefoon-aan', !!(TEL.el && !TEL.el.hidden)); }, 500);
  return el;
}
function laadFrame(){
  telefoonPaneel();
  TEL.el.querySelector('.cp-tel-laden').hidden = false;
  TEL.frame.src = 'index.html?demo=coach&voorbeeld=' + Date.now().toString(36);
  schaalTelefoon();
}
function schaalTelefoon(){
  if (!TEL.el) return;
  const ruimte = Math.max(420, window.innerHeight - 190);
  TEL.el.style.setProperty('--cp-tel-schaal', String(Math.min(1, ruimte / 844).toFixed(3)));
}
function zetTelefoon(aan){
  TEL.open = aan;
  try { localStorage.setItem('cpTelefoon', aan ? 'aan' : 'uit'); } catch (e) {}
  if (aan){ telefoonPaneel(); if (!TEL.frame.getAttribute('src')) laadFrame(); else synchroniseer(); }
  if (TEL.el) TEL.el.hidden = !aan;
  document.body.classList.toggle('cp-telefoon-aan', aan);
  if (root) teken();
}
/* wachten tot de app in het venster een gebruiker en teams heeft */
async function wachtOpApp(){
  const w = TEL.frame?.contentWindow;
  for (let i = 0; i < 80; i++){
    try { const vb = w.__cluppieVoorbeeld, demo = w.__cluppieDemo; if (vb && demo?.api && (vb.S.teams || []).length){ TEL.klaar = true; break; } } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  TEL.el.querySelector('.cp-tel-laden').hidden = TEL.klaar;
  if (!TEL.klaar){ TEL.el.querySelector('.cp-tel-laden').textContent = 'Het voorbeeld laadt niet. Probeer Vernieuwen.'; TEL.el.querySelector('.cp-tel-laden').hidden = false; return; }
  await synchroniseer();
  await toonOpTelefoon(TEL.veld);
}
/* de inrichting van deze club in de demo zetten: naam, instellingen, evaluatierondes en de teksten */
async function synchroniseer(){
  if (!TEL.klaar || !club) return;
  const st = staat(club.id); if (!st.profiel) return;
  const w = TEL.frame.contentWindow, demo = w.__cluppieDemo, { db: ddb, doc: ddoc, getDoc: dget, setDoc: dset, updateDoc: dupd, deleteDoc: ddel } = demo.api;
  const inr = voorbeeldInrichting(st.profiel, club.instellingen, (v, b) => conceptVan(st, v, b));
  const ref = ddoc(ddb, 'clubs', demo.club), huidig = (await dget(ref)).data() || {};
  const teams = Object.keys(huidig.teams || {});
  await dset(ref, { ...huidig, naam: club.naam || huidig.naam, instellingen: inr.instellingen,
    evaluatieRondes: inr.rondes.map((r, i) => ({ id: 'vb' + i, naam: r.naam, soort: r.soort, van: null, tot: r.tot, teams, status: 'open', seizoen: huidig.huidigSeizoen || '' })) });
  const nieuw = new Set(inr.content.map(d => d.id));
  for (const id of TEL.ids) if (!nieuw.has(id)) await ddel(ddoc(ddb, 'clubs', demo.club, 'content', id));
  for (const d of inr.content) await dset(ddoc(ddb, 'clubs', demo.club, 'content', d.id), d.data);
  TEL.ids = [...nieuw]; TEL.rondes = inr.rondes.map(r => r.naam);
  /* de clubnaam die bij de teams staat (de Clubwijzer en de kop van een team gebruiken die) */
  for (const t of teams){ try { await dupd(ddoc(ddb, 'teams', t), { clubNaam: club.naam || '' }); } catch (e) {} }
  try { w.__cluppieVoorbeeld.renderTeam(); } catch (e) {}
}
function synchroniseerStraks(){ clearTimeout(TEL.timer); TEL.timer = setTimeout(() => synchroniseer().then(() => toonOpTelefoon(TEL.veld, TEL.laatsteScherm)).catch(e => console.warn('[clubprofiel] voorbeeld', e)), 700); }
/* een tekst in de telefoon opzoeken, ernaartoe scrollen en het blok even laten oplichten */
function markeerInTelefoon(tekst){
  try {
    const d = TEL.frame.contentDocument, w = TEL.frame.contentWindow, it = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()){
      if (!n.nodeValue.includes(tekst)) continue;
      const blok = n.parentElement.closest('.kaart, button, section, li, div') || n.parentElement;
      blok.scrollIntoView({ block: 'center' }); blok.classList.add('cw-licht'); setTimeout(() => blok.classList.remove('cw-licht'), 2600);
      return;
    }
  } catch (e) {}
}
/* de telefoon naar het scherm van één onderwerp brengen */
async function toonOpTelefoon(veldId, scherm){
  if (veldId) TEL.veld = veldId;
  const v = TEL.veld && veldOpId(TEL.veld), uitleg = TEL.el?.querySelector('.cp-tel-uitleg');
  const vb = v ? voorbeeldVoor(v) : null;
  const doel = scherm || (vb ? vb.scherm : 'hub');
  TEL.laatsteScherm = scherm || null;
  if (uitleg) uitleg.innerHTML = v ? `<b>${esc(v.overig ? 'Overig' : v.label)}</b><span>Op de telefoon: ${esc(SCHERM_NAAM[doel] || doel)}</span><p>${esc(vb.uitleg)}</p>
      ${vb.clubwijzer && doel !== 'clubwijzer' ? '<button class="knop licht klein" data-cptel="clubwijzer">Ook de tekst in de Clubwijzer bekijken</button>' : ''}`
    : '<p>Tik bij een onderwerp op <b>Op de telefoon</b> om te zien waar een trainer het ziet. Je kunt ook gewoon door de app tikken.</p>';
  if (!TEL.klaar) return;
  const vbApp = TEL.frame.contentWindow.__cluppieVoorbeeld;
  try {
    vbApp.sluitModal();
    const tab = doel === 'clubwijzer' ? 'documenten' : doel;
    if (vbApp.S.teamId !== DEMO_TEAM || vbApp.S.wedstrijdId) vbApp.openTeam(DEMO_TEAM, tab); else vbApp.zetTeamTab(tab);
    if (doel === 'clubwijzer') setTimeout(() => vbApp.openClubwijzer(v && v.id), 250);
    else if (v && v.rondes && (TEL.rondes || []).length) setTimeout(() => markeerInTelefoon(TEL.rondes[0]), 400);
    TEL.frame.contentWindow.scrollTo(0, 0);
  } catch (e){ console.warn('[clubprofiel] voorbeeld navigeren', e); }
}

/* ---------- tekenen ---------- */
const chip = (t, soort) => `<span class="pf-chip ${soort || ''}">${esc(t)}</span>`;
const datum = ms => ms ? new Date(ms).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const STAND = { leeg: ['niet gevonden', 'uit'], open: ['te beoordelen', 'let'], akkoord: ['te beoordelen', 'let'], verwerkt: ['staat in Cluppie', 'ok'] };
const kpi = (g, l, s, toon) => `<div class="pc-kpi ${toon || ''}"><div class="g">${g}</div><div class="l">${esc(l)}</div>${s ? `<div class="s">${esc(s)}</div>` : ''}</div>`;
const lijn = t => esc(t).replace(/\n/g, '<br>');

function tekenWachtrij(){
  const w = root?.isConnected ? root.querySelector('.cp-wachtrij-vak') : null;
  if (w && club) w.innerHTML = htmlWachtrij(staat(club.id));
}
function teken(){
  if (!root || !root.isConnected || !club) return;
  const st = staat(club.id);
  if (st.fout){ root.innerHTML = `<div class="pc-signaal rood">Clubprofiel laden mislukt: ${esc(st.fout)}</div><button class="knop licht" data-cp="opnieuw">Opnieuw proberen</button>`; return; }
  if (!st.profiel){ root.innerHTML = '<p class="tc-leeg-klein">Clubprofiel laden…</p>'; return; }
  const o = overzicht(st.profiel), t = o.totaal, direct = st.profiel.tekstStatus === 'gepubliceerd';
  const h = o.hoofdstukken.find(x => x.id === st.hoofdstuk), beoordelen = t.open + t.akkoord;
  const knop = (id, naam, rechts, actief) => `<button class="cp-nav-knop ${actief ? 'actief' : ''}" data-cp="nav" data-h="${id}" ${actief ? 'aria-current="true"' : ''}><span>${esc(naam)}</span><small>${rechts}</small></button>`;
  const nav = [knop('documenten', 'Documenten', o.documenten, st.hoofdstuk === 'documenten'), knop('mancos', 'Manco’s', t.manco, st.hoofdstuk === 'mancos'),
    '<div class="cp-nav-streep"></div>',
    ...o.hoofdstukken.map(x => knop(x.id, x.naam, `${x.tel.open + x.tel.akkoord ? `<i class="cp-stip" title="${x.tel.open + x.tel.akkoord} te beoordelen"></i>` : ''}${x.tel.verwerkt}/${x.tel.velden}`, h?.id === x.id))].join('');
  const sy = root.closest('.tc-hoofd')?.scrollTop;
  root.innerHTML = `<div class="cp">
    <ol class="cp-stappen"><li><b>1</b> Lees de documenten van ${esc(club.naam || 'de club')} in.</li><li><b>2</b> Per onderwerp zie je wat de club zegt en wat er in Cluppie komt.</li><li><b>3</b> Keur goed of pas de tekst aan; Cluppie zet het op de goede plek.</li></ol>
    <div class="cp-kpis">${kpi(o.documenten, 'documenten')}${kpi(`${t.verwerkt}<small>/${t.velden}</small>`, 'staat in Cluppie', '', '')}${kpi(beoordelen, 'te beoordelen', '', beoordelen ? 'let' : '')}${kpi(t.manco, 'manco’s', 'niet gevonden, half of tegenstrijdig', '')}</div>
    <div class="cp-acties">
      <button class="knop fluo klein" data-cp="kies">${ico('action-add', 16)} Documenten toevoegen</button>
      <button class="knop licht klein" data-cp="vragen">${ico('action-copy', 15)} Vragen voor de club</button>
      <button class="knop licht klein" data-cp="download">Profiel downloaden</button>
      <button class="knop licht klein" data-cp="telefoon" aria-pressed="${TEL.open && !!TEL.el && !TEL.el.hidden}">${ico('navigation-home', 15)} ${TEL.open && TEL.el && !TEL.el.hidden ? 'Telefoon verbergen' : 'Op de telefoon bekijken'}</button>
      <button class="knop licht klein" data-cp="pdf" title="Wat er in Cluppie is gezet, per hoofdstuk, om met de club te delen">${ico('admin-document', 15)} Inrichting als PDF</button>
      <span class="cp-schakel" role="group" aria-label="Teksten voor trainers"><span>Teksten voor trainers:</span>
        <button class="${direct ? '' : 'actief'}" data-cp="tekststatus" data-s="concept" aria-pressed="${!direct}">als concept</button><button class="${direct ? 'actief' : ''}" data-cp="tekststatus" data-s="gepubliceerd" aria-pressed="${direct}">direct zichtbaar</button></span>
      <input type="file" id="cpBestanden" accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/jpeg,image/png,image/webp" multiple hidden>
    </div>
    <div class="cp-wachtrij-vak" aria-live="polite">${htmlWachtrij(st)}</div>
    <div class="cp-raster"><nav class="cp-nav" aria-label="Hoofdstukken">${nav}</nav>
      <section class="cp-inhoud">${h ? htmlHoofdstuk(st, h) : st.hoofdstuk === 'mancos' ? htmlMancos(st) : htmlDocumenten(st, o)}</section></div></div>`;
  const hoofd = root.closest('.tc-hoofd'); if (hoofd && sy != null) hoofd.scrollTop = sy;
  root.querySelector('.cp-nav .actief')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const f = root.querySelector('[data-cpfocus]'); if (f){ f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'nearest' }); }
}
function htmlWachtrij(st){
  if (!st.wachtrij.length) return '';
  return `<div class="cp-wachtrij">${st.wachtrij.map(w => `<div class="cp-wacht w-${w.stand}"><b>${esc(w.naam)}</b><span>${esc(w.stap)}</span></div>`).join('')}
    ${st.bezig ? '<p class="cp-doel">Een document van zestig pagina’s duurt een paar minuten. Je kunt intussen al beoordelen wat binnen is.</p>' : '<button class="knop licht klein" data-cp="wachtrijweg">Lijst wissen</button>'}</div>`;
}
function htmlDocumenten(st, o){
  const docs = Object.entries(st.profiel.documenten).sort((a, b) => (b[1].toegevoegdMs || 0) - (a[1].toegevoegdMs || 0));
  return `<h2 class="tc-h2">Documenten</h2>
    <div class="cp-drop" data-cp="kies" role="button" tabindex="0"><b>Sleep documenten hierheen</b><span>of tik om te kiezen. PDF, Word (.docx), tekst of een foto van een pagina; meer tegelijk mag. Een scan wordt ook gelezen.</span></div>
    ${st.plak ? `<div class="cp-plak"><input class="invoer" id="cpPlakNaam" placeholder="Naam van het document" maxlength="100">
        <textarea class="invoer" id="cpPlakTekst" rows="8" placeholder="Plak hier de tekst" data-cpfocus></textarea>
        <div class="rij"><button class="knop licht" data-cp="plak">Annuleren</button><button class="knop vol" data-cp="plakgo">Analyseren</button></div></div>`
      : '<button class="knop licht klein cp-los" data-cp="plak">Tekst plakken</button>'}
    <p class="tc-meta">Lever alles aan wat de club heeft: beleidsplan, jeugdplan, reglementen, functiebeschrijvingen, het informatieboekje. Hoe meer, hoe minder manco’s. De tekst van een document wordt niet bewaard, alleen de uitkomst met een kort citaat. Geen ledenlijsten of notulen met namen.</p>
    ${docs.length ? docs.map(([id, d]) => `<div class="pc-taak"><div class="pc-taak-tekst"><b>${esc(d.naam)}</b><small>${esc([d.paginas ? d.paginas + " pagina's" : '', Math.round((d.tekens || 0) / 1000) + ' duizend tekens', d.geanalyseerdMs ? `${d.gevonden || 0} onderwerpen gevonden op ${datum(d.geanalyseerdMs)}` : 'analyse niet afgemaakt: lees het opnieuw in'].filter(Boolean).join(', '))}</small></div>
        <button class="knop licht klein ${st.zeker === 'd:' + id ? 'pc-zeker' : ''}" data-cp="docweg" data-id="${id}">${st.zeker === 'd:' + id ? 'Zeker? Verwijderen' : 'Verwijderen'}</button></div>`).join('')
      : `<div class="pc-signaal info"><b>Nog geen documenten.</b><br>Onder Manco’s staan nu alle ${o.totaal.velden} onderwerpen als vraag: dat is je lijst voor een eerste gesprek met de club.</div>`}`;
}
function htmlMancos(st){
  const lijst = mancos(st.profiel), SOORT = { leeg: ['niet gevonden', 'uit'], deels: ['half beantwoord', 'let'], meerdere: ['tegenstrijdig', 'let'] };
  if (!lijst.length) return '<h2 class="tc-h2">Manco’s</h2><div class="pc-signaal info"><b>Geen manco’s.</b> Elk onderwerp is in de documenten gevonden.</div>';
  let vorig = '';
  return `<div class="cp-hkop"><div><h2 class="tc-h2">Manco’s</h2><p class="tc-meta">Wat de documenten niet, maar half of tegenstrijdig beantwoorden. Dit zijn je vragen voor de club. Vul het antwoord in en Cluppie maakt er een voorstel van.</p></div>
      <button class="knop licht klein" data-cp="vragen">${ico('action-copy', 15)} Kopieer als vragen</button></div>
    ${lijst.map(m => { const kop = m.hoofdstuk !== vorig ? `<h3 class="cp-mkop">${esc(m.hoofdstukNaam)}</h3>` : ''; vorig = m.hoofdstuk;
      return `${kop}<div class="cp-manco"><div class="cp-manco-tekst"><b>${esc(m.label)}</b> ${chip(...SOORT[m.soort])}<small>${esc(m.vraag)}</small>${m.antwoorden.map(a => `<small class="cp-manco-antw">${esc(a)}</small>`).join('')}</div>
        <button class="knop licht klein" data-cp="naarveld" data-h="${m.hoofdstuk}" data-veld="${m.veld}">${m.soort === 'leeg' ? 'Antwoord invullen' : 'Bekijk'}</button></div>`; }).join('')}`;
}
/* welke bevindingen in één keer gezet kunnen worden: volledig, citaat teruggevonden, niet onzeker, met voorstel, en het enige antwoord */
function inEenKeer(h){
  return h.velden.filter(v => !v.stand.meerdere).flatMap(v => v.stand.mee.filter(b => !b.verwerkt && b.status !== 'deels' && b.zeker !== 'laag' && (b.citaatOk !== false || b.handmatig) && !voorstelLeeg(b.voorstel)));
}
function htmlHoofdstuk(st, h){
  const velden = h.velden.filter(v => pastInFilter(v, st.filter)), n = inEenKeer(h).length;
  return `<div class="cp-hkop"><div><h2 class="tc-h2">${esc(h.naam)}</h2><p class="tc-meta">${esc(h.uitleg)}</p></div>
      ${n ? `<button class="knop licht klein ${st.zeker === 'alles' ? 'pc-zeker' : ''}" data-cp="alleszetten" title="Alleen volledige antwoorden waarvan het citaat is teruggevonden">${st.zeker === 'alles' ? `Zeker? ${n} onderwerp${n === 1 ? '' : 'en'} zetten` : `Alles goedkeuren en zetten (${n})`}</button>` : ''}</div>
    <div class="cp-filters" role="group" aria-label="Filter">${FILTERS.map(([id, naam]) => `<button class="pf-chip cp-filter ${st.filter === id ? 'actief' : ''}" data-cp="filter" data-f="${id}" aria-pressed="${st.filter === id}">${esc(naam)}</button>`).join('')}</div>
    ${velden.length ? velden.map(v => htmlVeld(st, h, v)).join('') : '<p class="tc-leeg-klein">Niets in dit hoofdstuk voor dit filter.</p>'}`;
}
function htmlVeld(st, h, v){
  const s = v.stand, [naam, soort] = STAND[s.stand];
  const afg = v.bevindingen.filter(b => b.oordeel === 'afgewezen');
  return `<article class="cp-veld st-${s.stand}" data-veldkaart="${v.id}">
    <header><h3>${esc(v.label)}</h3><button class="knop licht klein cp-optel ${TEL.veld === v.id && TEL.open ? 'actief' : ''}" data-cp="optel" data-veld="${v.id}" title="Laat zien waar een trainer dit ziet">${ico('navigation-home', 14)} Op de telefoon</button><span class="pc-chips">${s.meerdere ? chip('verschillende antwoorden: kies er één', 'let') : ''}${s.deels ? chip('half beantwoord', 'let') : ''}${chip(naam, soort)}</span></header>
    ${s.mee.map(b => htmlBevinding(st, h, v, b)).join('')}
    ${s.stand === 'leeg' && v.vraag ? `<p class="cp-vraag"><b>Niet in de documenten.</b> Vraag voor de club: ${esc(v.vraag)}</p>` : ''}
    ${st.nieuw === v.id ? `<div class="cp-bewerk"><textarea class="invoer" rows="3" maxlength="1500" placeholder="Het antwoord van de club, in gewone woorden" data-cpfocus data-cptekst></textarea>
        <div class="rij"><button class="knop licht klein" data-cp="annuleer">Annuleren</button><button class="knop fluo klein" data-cp="nieuwopslaan" data-veld="${v.id}">Opslaan en voorstel maken</button></div></div>`
      : v.overig ? '' : `<button class="knop licht klein cp-los" data-cp="nieuw" data-veld="${v.id}">${s.mee.length ? 'Ander antwoord invullen' : 'Antwoord invullen'}</button>`}
    ${afg.length ? `<details class="cp-afg"><summary>${afg.length} niet gebruikt</summary>${afg.map(b => `<div class="cp-afg-rij"><span>${esc(b.waarde)}</span><button class="knop licht klein" data-cp="terug" data-id="${b.id}">Terugzetten</button><button class="knop licht klein" data-cp="wis" data-id="${b.id}">Verwijderen</button></div>`).join('')}</details>` : ''}
  </article>`;
}
function htmlBevinding(st, h, v, b){
  const bron = b.handmatig ? 'Zelf ingevuld' : `Uit ${b.bron || 'het document'}${b.pagina ? ', p. ' + b.pagina : ''}`;
  const links = `<div class="cp-uit"><span class="cp-kop">${esc(bron)}${b.handmatig ? '' : ` <i>zekerheid ${esc(b.zeker)}</i>`}</span>
      <p class="cp-waarde">${lijn(b.waarde)}</p>
      ${b.citaat ? `<blockquote class="cp-citaat">${esc(b.citaat)}</blockquote>` : ''}
      ${b.citaatOk === false && !b.handmatig ? `<p class="cp-let">${ico('action-warning', 14)} Dit citaat is niet teruggevonden in het document. Controleer het antwoord zelf.</p>` : ''}
      ${b.status === 'deels' && b.ontbreekt ? `<p class="cp-ontbreekt"><b>Ontbreekt nog:</b> ${esc(b.ontbreekt)}</p>` : ''}</div>`;
  return `<div class="cp-bev ${b.verwerkt ? 'is-verwerkt' : ''}">${links}${b.gezet && !st.bewerk.has(b.id) ? htmlGezet(v, b) : htmlCluppie(st, h, v, b)}</div>`;
}
function htmlGezet(v, b){
  const g = b.gezet, defs = instelVelden(v.id) || [];
  const regels = [...defs.filter(d => g.instellingen?.[d.pad] !== undefined).map(d => `<li><b>${esc(d.label)}:</b> ${esc(instelTekst(d, g.instellingen[d.pad]))}</li>`),
    (g.rondes || []).map(r => `<li><b>Evaluatieronde:</b> ${esc(r.naam)}, ${r.soort === 'snel' ? 'snelle' : 'volledige'} beoordeling, ${r.van ? esc(dag(r.van)) + ' tot ' : 'tot '}${esc(dag(r.tot))}</li>`).join(''),
    g.tekst ? `<li><b>Clubwijzer:</b> ${lijn(g.tekst)}</li>` : '', (g.regels || []).length ? `<li><b>Gouden regels:</b> ${g.regels.map(esc).join(' · ')}</li>` : ''].join('');
  return `<div class="cp-gezet"><span class="cp-kop cp-ok-tekst">${ico('action-check', 15)} Staat in Cluppie sinds ${esc(datum(g.ms))}${(g.tekst || (g.regels || []).length) && g.status !== 'gepubliceerd' ? ' <i>teksten als concept: de clubbeheerder publiceert ze onder Content</i>' : ''}</span>
    <ul>${regels}</ul><div class="cp-knoppen"><button class="knop licht klein" data-cp="heropen" data-id="${b.id}">Aanpassen</button></div></div>`;
}
const dag = iso => { try { return new Date(iso + 'T12:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e){ return iso; } };
const instelTekst = (d, w) => d.type === 'keuze' ? ((d.opties.find(([id]) => id === String(w)) || [])[1] || '').split(':')[0] : (w === '' || w == null ? 'niets ingesteld' : String(w));
function htmlCluppie(st, h, v, b){
  const defs = instelVelden(v.id) || [], c = conceptVan(st, v, b), druk = st.druk.has(b.id);
  const zonder = voorstelLeeg(b.voorstel) && !b.gezet;
  const inst = d => {
    const w = c.inst[d.pad], nu = instelWaarde(club.instellingen, d), kenmerk = `data-cpc="inst" data-pad="${esc(d.pad)}" data-id="${b.id}"`;
    const invoerVeld = d.type === 'keuze'
      ? d.opties.map(([id, n]) => `<label class="ci-schakel"><input type="radio" name="cp_${b.id}_${esc(d.pad)}" value="${id}" ${kenmerk} ${String(w) === id ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')
      : `<input class="invoer ${d.type === 'getal' ? 'pc-getal' : ''}" ${kenmerk} value="${esc(w)}" aria-label="${esc(d.label)}" ${d.type === 'getal' ? `type="number" inputmode="numeric" min="${d.min}" max="${d.max}"` : d.type === 'kleur' ? 'type="color"' : `type="text" maxlength="${d.type === 'formatie' ? 9 : d.max}"`}>`;
    return `<div class="cp-instel-veld"><label>${esc(d.label)}</label>${invoerVeld}<small>${String(w) === String(nu) ? 'staat nu al zo in Cluppie' : 'nu in Cluppie: ' + esc(instelTekst(d, nu))}</small></div>`;
  };
  const tekst = v.tekst === false ? '' : `<div class="cp-instel-veld"><span class="cp-plek">Clubwijzer › ${esc(h.naam)}</span>
      ${v.overig ? `<input class="invoer" data-cpc="titel" data-id="${b.id}" value="${esc(c.titel)}" maxlength="80" aria-label="Titel in de Clubwijzer">` : `<label>${esc(v.label)}</label>`}
      <textarea class="invoer" rows="${Math.min(9, Math.max(3, Math.ceil((c.tekst.length || 80) / 90) + (c.tekst.match(/\n/g) || []).length))}" maxlength="1500" data-cpc="tekst" data-id="${b.id}" placeholder="De tekst die trainers in de Clubwijzer lezen" aria-label="Tekst voor de Clubwijzer">${esc(c.tekst)}</textarea></div>`;
  const regels = !v.regels ? '' : `<div class="cp-instel-veld"><span class="cp-plek">Gouden regels</span><label>Eén regel per regel</label>
      <textarea class="invoer" rows="${Math.min(8, Math.max(3, c.regels.split('\n').length + 1))}" data-cpc="regels" data-id="${b.id}" placeholder="Bijv. We zijn op tijd" aria-label="Gouden regels">${esc(c.regels)}</textarea></div>`;
  const rondes = !v.rondes ? '' : `<div class="cp-instel-veld"><span class="cp-plek">Evaluatierondes</span>
      ${c.rondes.length ? c.rondes.map((r, i) => { const k = `data-cpc="ronde" data-id="${b.id}" data-i="${i}"`; return `<div class="cp-ronde">
        <input class="invoer" ${k} data-k="naam" value="${esc(r.naam)}" maxlength="60" placeholder="Naam van de ronde" aria-label="Naam van de ronde">
        <select class="invoer" ${k} data-k="soort" aria-label="Soort beoordeling"><option value="volledig" ${r.soort !== 'snel' ? 'selected' : ''}>Volledige beoordeling</option><option value="snel" ${r.soort === 'snel' ? 'selected' : ''}>Snelle beoordeling</option></select>
        <label>van <input class="invoer" type="date" ${k} data-k="van" value="${esc(r.van || '')}"></label><label>tot <input class="invoer" type="date" ${k} data-k="tot" value="${esc(r.tot || '')}"></label>
        <button class="knop licht klein" data-cp="rondemin" data-id="${b.id}" data-i="${i}" aria-label="Ronde ${esc(r.naam)} weghalen">Weg</button></div>`; }).join('')
        : '<small>De documenten noemen geen maanden of periodes. Voeg zelf een ronde toe, of zet alleen de tekst.</small>'}
      <button class="knop licht klein cp-los" data-cp="rondeplus" data-id="${b.id}">${ico('action-add', 14)} Ronde toevoegen</button>
      <small>Voor alle teams van de club. Trainers zien een ronde vanaf de startdatum bovenaan hun team.</small></div>`;
  return `<div class="cp-cluppie"><span class="cp-kop">Zo komt het in Cluppie</span>
    ${zonder ? `<p class="cp-doel">${druk ? 'Voorstel maken…' : 'Bij dit antwoord is nog geen voorstel gemaakt.'}</p>` : ''}
    ${defs.length ? `<span class="cp-plek">Clubinstellingen</span><div class="cp-instellingen ${defs.length > 1 ? 'twee' : ''}">${defs.map(inst).join('')}</div>` : ''}${rondes}${tekst}${regels}
    <div class="cp-knoppen"><button class="knop fluo klein" data-cp="zet" data-id="${b.id}" ${druk ? 'disabled' : ''}>${ico('action-check', 15)} ${b.gezet ? 'Opnieuw in Cluppie zetten' : 'Goedkeuren en in Cluppie zetten'}</button>
      ${zonder && !druk ? `<button class="knop licht klein" data-cp="voorstel" data-id="${b.id}">Voorstel maken</button>` : ''}
      ${b.gezet ? `<button class="knop licht klein" data-cp="sluit" data-id="${b.id}">Annuleren</button>` : `<button class="knop licht klein" data-cp="nietgebruiken" data-id="${b.id}" ${druk ? 'disabled' : ''}>Niet gebruiken</button>`}</div></div>`;
}

/* ---------- acties ---------- */
function invoer(e){
  const el = e.target, sleutel = el.dataset?.cpc, st = club && staat(club.id);
  if (!sleutel || !st) return;
  const c = st.concept[el.dataset.id]; if (!c) return;
  if (sleutel === 'inst'){ if (el.type !== 'radio' || el.checked) c.inst[el.dataset.pad] = el.value; }
  else if (sleutel === 'ronde'){ const r = c.rondes[Number(el.dataset.i)]; if (r) r[el.dataset.k] = el.value; }
  else c[sleutel] = el.value;
  if (TEL.klaar && TEL.open) synchroniseerStraks();
}
/* Eén bevinding in Cluppie zetten: instellingen, Clubwijzer-tekst en gouden regels in één keer. */
async function zet(bevId, stil){
  const st = staat(club.id), clubId = club.id, doel = club, p = st.profiel, b = p.bevindingen[bevId];
  if (!b || st.druk.has(bevId)) return false;
  const v = veldOpId(b.veld), defs = instelVelden(v.id) || [], c = conceptVan(st, v, { id: bevId, ...b });
  let wijz = [];
  if (defs.length){ const r = instelWijzigingen(v.id, doel.instellingen, c.inst); if (r.fout){ if (!stil) meld(r.fout); return false; } wijz = r.wijzigingen; }
  const status = p.tekstStatus === 'gepubliceerd' ? 'gepubliceerd' : 'concept';
  const docs = contentDocs({ veldId: v.id, bevId, titel: c.titel, tekst: c.tekst, regels: c.regels, status });
  /* evaluatierondes: elke ingevulde rij moet kloppen, anders zetten we niets */
  const rondes = v.rondes ? schoonRondes(c.rondes) : [];
  if (v.rondes && rondes.length !== c.rondes.filter(r => r.naam || r.tot || r.van).length){ if (!stil) meld('Een ronde klopt niet: geef elke ronde een eigen naam en een einddatum na de startdatum'); return false; }
  if (!defs.length && !docs.length && !rondes.length){ if (!stil) meld('Er is nog niets om te zetten: vul eerst de tekst in'); return false; }
  /* wat eerder voor dit onderwerp is gezet en nu niet meer: weg (ook van een ander antwoord op hetzelfde veld) */
  const zelfde = Object.entries(p.bevindingen).filter(([id, x]) => id !== bevId && x.veld === v.id && !v.overig);
  const oudeIds = [...(b.gezet?.ids || []), ...zelfde.flatMap(([, x]) => x.gezet?.ids || [])].filter(i => !docs.some(d => d.id === i));
  st.druk.add(bevId); if (!stil) teken();
  try {
    if (wijz.length) await updateDoc(doc(db, 'clubs', clubId), Object.fromEntries(wijz.map(([pad, w]) => ['instellingen.' + pad, w])));
    if (rondes.length){
      /* de rondes van de club vers lezen: de clubbeheerder kan er intussen zelf een hebben gemaakt */
      const vers = (await getDoc(doc(db, 'clubs', clubId))).data() || {};
      const samen = rondesSamenvoegen(vers.evaluatieRondes, rondes, { teams: Object.keys(vers.teams || doel.teams || {}), seizoen: seizoenVan(vers.huidigSeizoen || doel.huidigSeizoen).label });
      await updateDoc(doc(db, 'clubs', clubId), { evaluatieRondes: samen.lijst });
      doel.evaluatieRondes = samen.lijst;
    }
    for (const d of docs) await setDoc(contentRef(clubId, d.id), d.data);
    for (const i of new Set(oudeIds)) await deleteDoc(contentRef(clubId, i));
  } catch (x){ st.druk.delete(bevId); meld('In Cluppie zetten mislukt: ' + foutTekst(x)); if (club?.id === clubId) teken(); return false; }
  /* het clubdocument in het Platformcentrum bijwerken, zodat "nu in Cluppie" klopt */
  doel.instellingen = JSON.parse(JSON.stringify(doel.instellingen || {}));
  for (const [pad, w] of wijz){ const k = pad.split('.'); let o = doel.instellingen; for (const d of k.slice(0, -1)) o = (o[d] && typeof o[d] === 'object') ? o[d] : (o[d] = {}); o[k.at(-1)] = w; }
  const tekstDoc = docs.find(d => d.data.categorie === 'afspraak');
  const gezet = { ms: Date.now(), titel: tekstDoc ? tekstDoc.data.titel : '', tekst: tekstDoc ? tekstDoc.data.achtergrond : '', regels: docs.filter(d => d.data.categorie === 'gouden-regel').map(d => d.data.titel),
    rondes, instellingen: Object.fromEntries(defs.map(d => [d.pad, controleerInstelling(d, c.inst[d.pad]).waarde])), status, ids: docs.map(d => d.id) };
  const paden = { [`bevindingen.${bevId}.oordeel`]: 'akkoord', [`bevindingen.${bevId}.verwerkt`]: true, [`bevindingen.${bevId}.gezet`]: gezet };
  p.bevindingen[bevId] = { ...b, oordeel: 'akkoord', verwerkt: true, gezet };
  /* een ander antwoord op hetzelfde onderwerp vervalt: er staat er maar één in Cluppie */
  for (const [id, x] of zelfde){
    if (x.oordeel === 'afgewezen' && !x.gezet) continue;
    p.bevindingen[id] = { ...x, oordeel: 'afgewezen', verwerkt: false, gezet: null };
    Object.assign(paden, { [`bevindingen.${id}.oordeel`]: 'afgewezen', [`bevindingen.${id}.verwerkt`]: false, [`bevindingen.${id}.gezet`]: null });
  }
  delete st.concept[bevId]; st.bewerk.delete(bevId); st.druk.delete(bevId);
  try { await vervang(clubId, paden); }
  catch (x){ meld('Het staat in Cluppie, maar afvinken mislukte: ' + foutTekst(x)); }
  if (!stil){
    const wat = [wijz.length ? `${wijz.length} instelling${wijz.length === 1 ? '' : 'en'}` : '', rondes.length ? `${rondes.length} evaluatieronde${rondes.length === 1 ? '' : 's'}` : '', tekstDoc ? 'tekst in de Clubwijzer' : '', gezet.regels.length ? `${gezet.regels.length} gouden regels` : ''].filter(Boolean).join(', ');
    meld(wat ? `In Cluppie gezet: ${wat}` : 'Dit stond al zo in Cluppie; afgevinkt');
    if (club?.id === clubId) teken();
  }
  if (TEL.klaar) synchroniseerStraks();
  return true;
}
/* Een voorstel voor Cluppie maken bij één antwoord (zelf ingevuld, of van vóór 20261120d). */
async function maakVoorstel(bevId){
  const st = staat(club.id), clubId = club.id, p = st.profiel, b = p.bevindingen[bevId];
  if (!b || st.druk.has(bevId)) return;
  const v = veldOpId(b.veld);
  st.druk.add(bevId); teken();
  try {
    const r = await httpsCallable(functions, 'stelClubinstellingenVoor', { timeout: 180000 })({ clubId, onderwerp: v.overig ? titelVan(v, b.waarde) : v.label, vraag: v.vraag,
      antwoorden: [b.waarde], velden: instelVeldenVoorAI(v.id), wilTekst: v.tekst !== false, wilRegels: v.regels === true, wilRondes: v.rondes === true, seizoen: seizoenTekst() });
    const voorstel = schoonVoorstel({ tekst: r?.data?.tekst, regels: r?.data?.regels, rondes: r?.data?.rondes, instellingen: r?.data?.instellingen || r?.data?.waarden }, v.id);
    if (voorstelLeeg(voorstel)) meld('Uit dit antwoord volgt geen duidelijk voorstel. Vul de tekst zelf in.');
    else { p.bevindingen[bevId] = { ...p.bevindingen[bevId], voorstel }; delete st.concept[bevId]; await vervang(clubId, { [`bevindingen.${bevId}.voorstel`]: voorstel }); if (TEL.klaar) synchroniseerStraks(); }
  } catch (x){ console.warn('[clubprofiel] voorstel', x); meld('Geen voorstel: ' + foutTekst(x) + ' Vul de tekst zelf in.'); }
  st.druk.delete(bevId);
  if (club?.id === clubId) teken();
}
async function zetBevinding(id, deel){
  const st = staat(club.id), clubId = club.id, oud = st.profiel.bevindingen[id];
  if (!oud) return;
  st.profiel.bevindingen[id] = { ...oud, ...deel }; teken();
  if (TEL.klaar) synchroniseerStraks();
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
  a.href = URL.createObjectURL(tekst instanceof Blob ? tekst : new Blob([tekst], { type: 'text/plain;charset=utf-8' })); a.download = naam;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const bestandsnaam = s => String(s || 'club').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'club';

async function klik(e){
  const b = e.target.closest('[data-cp]');
  if (!b || !root.contains(b) || b.disabled || !club) return;
  const a = b.dataset.cp, st = staat(club.id), p = st.profiel, id = b.dataset.id;
  if (a === 'opnieuw') return laad(club.id).then(teken);
  if (!p) return;
  const wasZeker = st.zeker;
  if (a !== 'docweg' && a !== 'alleszetten') st.zeker = null;
  if (a === 'nav'){ st.hoofdstuk = b.dataset.h; st.nieuw = null; teken(); root.closest('.tc-hoofd')?.scrollTo?.({ top: 0 }); return; }
  if (a === 'naarveld'){
    st.hoofdstuk = b.dataset.h; st.filter = 'alles'; st.nieuw = p && !Object.values(p.bevindingen).some(x => x.veld === b.dataset.veld && x.oordeel !== 'afgewezen') ? b.dataset.veld : null;
    teken(); root.querySelector(`[data-veldkaart="${b.dataset.veld}"]`)?.scrollIntoView({ block: 'center' }); return;
  }
  if (a === 'filter'){ st.filter = b.dataset.f; return teken(); }
  if (a === 'kies') return root.querySelector('#cpBestanden')?.click();
  if (a === 'plak'){ st.plak = !st.plak; st.hoofdstuk = 'documenten'; return teken(); }
  if (a === 'plakgo'){
    const tekst = root.querySelector('#cpPlakTekst')?.value || '';
    if (tekst.trim().length < 80) return meld('Plak eerst (meer) tekst');
    return voegTekstToe(root.querySelector('#cpPlakNaam')?.value.trim(), tekst);
  }
  if (a === 'wachtrijweg'){ st.wachtrij = []; return teken(); }
  if (a === 'vragen') return kopieer(vragenTekst(p, club.naam), 'Vragen gekopieerd');
  if (a === 'download') return download(`clubprofiel-${bestandsnaam(club.naam)}.md`, profielTekst(p, club.naam));
  if (a === 'pdf'){
    /* [20261120f] wat er in Cluppie is gezet, als PDF om met de club te delen (clubprofiel-pdf.js) */
    const ov = inrichtingOverzicht(p, club);
    if (!ov.aantal) return meld('Er staat nog niets in Cluppie. Keur eerst een onderwerp goed.');
    const oud = b.innerHTML; b.disabled = true; b.textContent = 'PDF maken…';
    try { const m = await import('./clubprofiel-pdf.js?v=20261120f'); download(`cluppie-inrichting-${bestandsnaam(club.naam)}.pdf`, await m.maakInrichtingPdf(ov)); meld(`PDF met ${ov.aantal} onderwerp${ov.aantal === 1 ? '' : 'en'} gedownload`); }
    catch (x){ console.error('[clubprofiel] pdf', x); meld('PDF maken mislukt: ' + foutTekst(x)); }
    if (b.isConnected){ b.disabled = false; b.innerHTML = oud; }
    return;
  }
  if (a === 'tekststatus'){
    const s = b.dataset.s === 'gepubliceerd' ? 'gepubliceerd' : 'concept', clubId = club.id;
    if (p.tekstStatus === s) return;
    p.tekstStatus = s; teken();
    try { await schrijf(clubId, { tekstStatus: s }); meld(s === 'gepubliceerd' ? 'Teksten die je vanaf nu zet zijn direct zichtbaar voor trainers' : 'Teksten die je vanaf nu zet komen als concept bij de clubbeheerder'); }
    catch (x){ meld('Opslaan mislukt: ' + foutTekst(x)); }
    return;
  }
  if (a === 'rondeplus' || a === 'rondemin'){
    const c = st.concept[id]; if (!c) return;
    if (a === 'rondeplus') c.rondes.push({ naam: '', soort: 'volledig', van: '', tot: '' }); else c.rondes.splice(Number(b.dataset.i), 1);
    return teken();
  }
  if (a === 'telefoon') return zetTelefoon(!(TEL.open && TEL.el && !TEL.el.hidden));
  if (a === 'optel'){ if (!(TEL.open && TEL.el && !TEL.el.hidden)) zetTelefoon(true); toonOpTelefoon(b.dataset.veld); root.querySelectorAll('.cp-optel.actief').forEach(x => x.classList.remove('actief')); b.classList.add('actief'); return; }
  if (a === 'zet') return zet(id);
  if (a === 'voorstel') return maakVoorstel(id);
  if (a === 'heropen'){ st.bewerk.add(id); delete st.concept[id]; return teken(); }
  if (a === 'sluit'){ st.bewerk.delete(id); delete st.concept[id]; return teken(); }
  if (a === 'nietgebruiken'){ delete st.concept[id]; return zetBevinding(id, { oordeel: 'afgewezen', verwerkt: false }); }
  if (a === 'terug') return zetBevinding(id, { oordeel: 'open' });
  if (a === 'wis') return wisBevindingen([id]);
  if (a === 'nieuw'){ st.nieuw = b.dataset.veld; return teken(); }
  if (a === 'annuleer'){ st.nieuw = null; return teken(); }
  if (a === 'nieuwopslaan'){
    const w = b.closest('.cp-bewerk')?.querySelector('[data-cptekst]')?.value;
    const nieuw = schoonBevinding({ veld: b.dataset.veld, waarde: w, oordeel: 'open', handmatig: true, gemaaktMs: Date.now() });
    if (!nieuw) return meld('Vul een antwoord in');
    const nid = maakId(), clubId = club.id;
    p.bevindingen[nid] = nieuw; st.nieuw = null; teken();
    try { await schrijf(clubId, { bevindingen: { [nid]: nieuw } }); }
    catch (x){ delete p.bevindingen[nid]; meld('Opslaan mislukt: ' + foutTekst(x)); return teken(); }
    return maakVoorstel(nid);
  }
  if (a === 'alleszetten'){
    const h = overzicht(p).hoofdstukken.find(x => x.id === st.hoofdstuk); if (!h) return;
    const lijst = inEenKeer(h); if (!lijst.length) return;
    if (wasZeker !== 'alles'){ st.zeker = 'alles'; return teken(); }
    st.zeker = null; b.disabled = true; b.textContent = 'Bezig…';
    let goed = 0;
    for (const x of lijst) if (await zet(x.id, true)) goed++;
    meld(`${goed} van ${lijst.length} onderwerpen in Cluppie gezet`);
    return teken();
  }
  if (a === 'docweg'){
    if (wasZeker !== 'd:' + id){ st.zeker = 'd:' + id; return teken(); }
    st.zeker = null;
    /* het document en wat ervan nog niet in Cluppie staat; wat gezet is blijft staan */
    const weg = Object.entries(p.bevindingen).filter(([, x]) => x.docId === id && !x.verwerkt).map(([i]) => i), clubId = club.id;
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
