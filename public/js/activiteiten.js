/* ==================== ACTIVITEITEN (organisatiecomité) [20261125x] ====================
   Clubbrede activiteiten organiseren: kersttoernooi, pietentraining, informatieavond, clubdag …
   Opzet en keuzes: docs/clubevenementen-impactanalyse.md (P2, 25-11-2026; Paul: "Alle releases bouwen").

   Aan of uit: de eindbaas zet Activiteiten per club aan (clubs/{id}.platformModules.activiteiten,
   standaard uit). Staat hij uit, dan is er geen tegel en weigeren de rules het schrijven.

   Wie
     • clubbeheerder: maakt activiteiten, kiest het comité, ziet alles;
     • comitélid: iemand van de club (coach, coördinator …) die de beheerder aan een activiteit koppelt.
       Hij ziet en bewerkt alleen de eigen activiteiten. Iemand zonder account kan als naam in het comité
       (taken toewijzen, takenlijst via WhatsApp), maar werkt dan niet zelf in de app;
     • coaches van deelnemende teams: zien de activiteit in de Planning (activiteitenAgenda, alleen naam,
       datum, tijd, locatie en de vrijwilligerslink) en maken daar met één knop een deelnemerslijstje;
     • ouders: zien hem in de Teamkamer-agenda als het comité dat aanzet (Cloud Function kamerActiviteit);
     • iedereen met de link: schrijft zich in voor een vrijwilligersdienst (activiteit-boot.js, ?act=).

   Opslag
     clubs/{clubId}/activiteiten/{id}           de activiteit (zie activiteiten-logica.js voor de vorm)
     clubs/{clubId}/activiteitenAgenda/{id}     kopie voor de teams (agendaKopie), alleen als agenda aan staat
     clubs/{clubId}/activiteitSjablonen/{id}    eigen draaiboeken van de club
     activiteitDeel/{deelId}                    vrijwilligersdiensten + open link, met /aanmeldingen
   Wijzigingen gaan per regel (veldpaden), zodat het comité tegelijk kan werken.
   Rekenwerk, export en import: activiteiten-logica.js (getest). Sjablonen: activiteit-sjablonen.js. */
import { db, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, deleteField, query, where, onSnapshot,
  serverTimestamp, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld, isPlatformBeheerder } from './state.js?v=20261126p';
import { ico } from './icons.js?v=20261116t';
import { SJABLONEN, sjabloonVan } from './activiteit-sjablonen.js?v=20261125w';
import * as L from './activiteiten-logica.js?v=20261125w';
import { datumVeld, koppelDatumkiezer, sluitDatumkiezer } from './datumkiezer.js?v=20261126p';
import * as TN from './activiteit-toernooi.js?v=20261126p';
import * as CS from './clubschermen.js?v=20261126p';
import * as VB from './vrijwilligers.js?v=20261126p';

let A = null;
const vandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nuMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const uid = () => S.user?.uid || '';
const isAdmin = () => !!(S.club?.admins?.[uid()]) || isPlatformBeheerder();
/* Toernooi staat standaard alleen aan bij een toernooi-draaiboek; de rest standaard aan. */
const tabAan = (a, id) => id === 'toernooi' ? (a.tabs?.toernooi ?? /toernooi/i.test(`${a.type || ''} ${a.sjabloon || ''}`)) === true : a.tabs?.[id] !== false;
const tnCtx = () => ({ act: A.act, actNu: () => A?.act, actId: A.id, clubId: A.clubId, el: A.el, kopieer: kopieKlembord, waLink, zet, herteken: () => hertekenZacht(), venster: html => { A.venster = html; teken(); }, sluitVenster,
  download, bestandsnaam, printen, csvLees: L.csvLees });
/* Clubbrede onderdelen naast de activiteiten: de kantine-tv met sponsoren en de vrijwilligersbank. */
const extraCtx = () => ({ clubId: A.clubId, herteken: () => { if (A?.extra) hertekenZacht(); }, kop: (titel, sub) => kop(titel, sub), kopieer: kopieKlembord, waLink, download, printen,
  venster: html => { A.venster = html; teken(); }, sluitVenster, opgeslagen: toonOpgeslagen });
const aiAan = () => S.club?.platformModules?.ai === true;
const actRef = id => doc(db, 'clubs', A.clubId, 'activiteiten', id);
const deelLink = id => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?act=${encodeURIComponent(id)}`;
const kopieKlembord = async (t, ok = 'Gekopieerd') => { try { await navigator.clipboard.writeText(t); meld(ok); } catch { prompt('Kopieer deze tekst', t); } };
const waLink = t => 'https://wa.me/?text=' + encodeURIComponent(t);
const opt = (w, t, sel) => `<option value="${esc(w)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;

/* ---------- openen en sluiten ---------- */
export async function openActiviteiten(clubId, actId = ''){
  clubId = clubId || S.clubId;
  if (!clubId) return;
  if (S.club?.platformModules?.activiteiten !== true) return meld('Activiteiten staat niet aan voor deze club.');
  stijl();
  const el = laag();
  A = { clubId, el, lijst: [], sjablonen: [], act: null, id: '', tab: 'overzicht', weergave: 'lijst', deel: null, aanm: [], subs: [], venster: null,
        vuil: false, live: false, liveTik: null, progB: false };
  el.innerHTML = `<div class="ac-app"><div class="ac-leeg">${ico('action-loading', 20)} Activiteiten laden…</div></div>`;
  await laadLijst();
  if (actId) return openAct(actId);
  teken();
}
export function sluitActiviteiten(){
  if (!A) return;
  sluitDatumkiezer(); stopSubs(); clearInterval(A.liveTik); CS.resetSchermen(); VB.resetVrijwilligers();
  A.el.classList.remove('toon'); A.el.innerHTML = '';
  document.documentElement.classList.remove('ac-open');
  A = null;
}
function laag(){
  let el = document.getElementById('acLaag');
  if (!el){
    el = document.createElement('div'); el.id = 'acLaag'; el.className = 'ac-laag';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Activiteiten');
    document.body.appendChild(el);
    document.addEventListener('keydown', e => {
      if (!A || e.key !== 'Escape') return;
      e.stopPropagation();
      if (A.venster) sluitVenster(); else if (A.live){ A.live = false; clearInterval(A.liveTik); teken(); } else if (A.id) terugNaarLijst(); else if (A.extra){ A.extra = ''; teken(); } else sluitActiviteiten();
    }, true);
    el.addEventListener('click', klik);
    koppelDatumkiezer(el, () => ({ stip: s => (A?.lijst || []).filter(x => x.datum === s && x.id !== A.id).map(x => x.naam).join(', ') }));
    document.addEventListener('click', e => { if (A && e.target.closest?.('#zijbalk')) sluitActiviteiten(); }, true);
    el.addEventListener('change', wijzig);
    el.addEventListener('input', e => { if (A?.act) TN.invoerToernooi(tnCtx(), e.target); });
    el.addEventListener('focusout', () => setTimeout(() => { if (A?.vuil && !actiefVeld() && !A.druk) { A.vuil = false; teken(); } }, 50));
    /* Tijdens een tik of klik niet hertekenen: anders verdwijnt de knop onder de vinger en gaat de klik verloren
       (bijvoorbeeld als je net een veld hebt ingevuld en meteen op een knop drukt). */
    el.addEventListener('pointerdown', () => { if (A) A.druk = true; });
    el.addEventListener('dragstart', e => { const k = e.target.closest?.('[data-sleep]'); if (k){ e.dataTransfer.setData('text/plain', k.dataset.sleep); e.dataTransfer.effectAllowed = 'move'; } });
    el.addEventListener('dragover', e => { if (e.target.closest?.('[data-kolom]')) e.preventDefault(); });
    el.addEventListener('drop', e => { const k = e.target.closest?.('[data-kolom]'); const id = e.dataTransfer.getData('text/plain'); if (k && id){ e.preventDefault(); zet({ [`taken.${id}.status`]: k.dataset.kolom }); } });
  }
  el.classList.add('toon');
  document.documentElement.classList.add('ac-open');
  return el;
}
const actiefVeld = () => { const a = document.activeElement; return a && A?.el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(checkbox|radio|file|color)$/.test(a.type || '') ? a : null; };
function stopSubs(){ (A?.subs || []).forEach(f => { try { f(); } catch { /* al weg */ } }); if (A) A.subs = []; }

async function laadLijst(){
  try {
    const kol = collection(db, 'clubs', A.clubId, 'activiteiten');
    const snap = await getDocs(isAdmin() ? kol : query(kol, where('comiteUids', 'array-contains', uid())));
    A.lijst = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.datum || '9999').localeCompare(String(b.datum || '9999')));
  } catch (e){ console.error('[activiteiten] lijst', e); A.fout = e?.code === 'permission-denied' ? 'Geen toegang. Zijn de Firestore-regels gepubliceerd?' : 'Laden mislukt. Probeer het zo opnieuw.'; }
  try { A.sjablonen = (await getDocs(collection(db, 'clubs', A.clubId, 'activiteitSjablonen'))).docs.map(d => ({ id: 'club:' + d.id, docId: d.id, eigen: true, ...d.data() })); }
  catch { A.sjablonen = []; }
}

function openAct(id){
  stopSubs(); if (A.id !== id) TN.resetToernooi();
  A.id = id; A.act = null; A.deel = null; A.aanm = []; A.tab = A.tab || 'overzicht';
  teken();
  A.subs.push(onSnapshot(actRef(id), s => {
    if (!s.exists()){ meld('Deze activiteit bestaat niet meer.'); return terugNaarLijst(); }
    const oudDeel = A.act?.deelId;
    A.act = { id: s.id, ...s.data() };
    if (A.act.deelId && A.act.deelId !== oudDeel) volgDeel(A.act.deelId);
    hertekenZacht();
  }, e => { console.error('[activiteiten] open', e); meld('Openen mislukt.'); terugNaarLijst(); }));
}
function volgDeel(deelId){
  A.subs.push(onSnapshot(doc(db, 'activiteitDeel', deelId), s => { A.deel = s.exists() ? { id: s.id, ...s.data() } : null; hertekenZacht(); }, () => {}));
  A.subs.push(onSnapshot(collection(db, 'activiteitDeel', deelId, 'aanmeldingen'), s => { A.aanm = s.docs.map(d => ({ id: d.id, ...d.data() })); hertekenZacht(); }, () => {}));
}
function hertekenZacht(){ if (actiefVeld() || A.druk) A.vuil = true; else teken(); }
for (const soort of ['pointerup', 'pointercancel']) addEventListener(soort, () => { if (!A?.druk) return; A.druk = false; setTimeout(() => { if (A?.vuil && !actiefVeld() && !A.druk){ A.vuil = false; teken(); } }, 0); });
async function terugNaarLijst(){ stopSubs(); A.id = ''; A.act = null; A.live = false; clearInterval(A.liveTik); await laadLijst(); teken(); }

/* ---------- schrijven ---------- */
const AGENDA_VELDEN = ['naam', 'datum', 'start', 'eind', 'locatie', 'omschrijving', 'teams', 'agenda', 'kamer', 'status', 'planB', 'deelId', 'vraag', 'vraagTot'];
async function zet(patch, { stil = false } = {}){
  if (!A?.id) return;
  try {
    await updateDoc(actRef(A.id), { ...patch, bijgewerktMs: Date.now(), bijgewerktDoor: uid() });
    if (Object.keys(patch).some(k => AGENDA_VELDEN.includes(k.split('.')[0]))) syncAgenda();
    if (A.act?.toernooi?.liveId && Object.keys(patch).some(k => ['toernooi', 'naam', 'datum', 'locatie', 'planB'].includes(k.split('.')[0]))) TN.planLive(tnCtx());
    if (A.act?.toernooi?.inschrijfId && Object.keys(patch).some(k => ['toernooi', 'naam', 'datum', 'start', 'locatie'].includes(k.split('.')[0]))) TN.planInschrijf(tnCtx());
    if (Object.keys(patch).some(k => ['naam', 'datum', 'start', 'locatie'].includes(k)) && A.act?.deelId)
      setDoc(doc(db, 'activiteitDeel', A.act.deelId), { titel: patch.naam ?? A.act.naam, datum: patch.datum ?? A.act.datum, start: patch.start ?? A.act.start ?? '', locatie: patch.locatie ?? A.act.locatie ?? '' }, { merge: true }).catch(() => {});
    if (!stil) toonOpgeslagen();
  } catch (e){ console.error('[activiteiten] opslaan', e); meld(e?.code === 'permission-denied' ? 'Opslaan mag niet (alleen het comité, en Activiteiten moet aan staan).' : 'Opslaan mislukt.'); }
}
let _agT = null;
function syncAgenda(){
  clearTimeout(_agT);
  _agT = setTimeout(async () => {
    if (!A?.act) return;
    const ref = doc(db, 'clubs', A.clubId, 'activiteitenAgenda', A.id);
    try {
      if (A.act.agenda === true && L.isIso(A.act.datum)) await setDoc(ref, { ...L.agendaKopie(A.act, { clubNaam: S.club?.naam || '', link: A.act.deelId && A.deel?.open ? deelLink(A.act.deelId) : '' }), bijgewerktMs: Date.now() });
      else await deleteDoc(ref);
    } catch (e){ console.warn('[activiteiten] agenda', e); }
  }, 400);
}
function toonOpgeslagen(){ const s = A?.el.querySelector('[data-staat]'); if (s){ s.textContent = 'Opgeslagen'; clearTimeout(toonOpgeslagen._t); toonOpgeslagen._t = setTimeout(() => { s.textContent = ''; }, 1600); } }
const volgende = map => Object.values(map || {}).reduce((m, x) => Math.max(m, Number(x?.volg) || 0), 0) + 1;

/* ---------- tekenen ---------- */
function teken(){
  if (!A) return;
  const scroll = A.el.querySelector('.ac-app')?.scrollTop || 0;
  if (A.live && A.act) A.el.innerHTML = htmlLive();
  else A.el.innerHTML = `<div class="ac-app">${A.id ? (A.act ? htmlAct() : `<div class="ac-leeg">${ico('action-loading', 20)} Laden…</div>`) : A.extra === 'schermen' ? CS.htmlSchermen(extraCtx()) : A.extra === 'vrijwilligers' ? VB.htmlVrijwilligers(extraCtx()) : htmlLijst()}</div>${A.venster ? `<div class="ac-venster" data-ac="venster-achter"><div class="ac-blad" role="dialog" aria-modal="true">${typeof A.venster === 'function' ? A.venster() : A.venster}</div></div>` : ''}`;
  const app = A.el.querySelector('.ac-app'); if (app) app.scrollTop = scroll;
}
function kop(titel, sub, acties = ''){
  return `<header class="ac-kop"><button class="ac-terug" data-ac="${A.id ? 'terug' : A.extra ? 'extra-terug' : 'sluit'}" aria-label="Terug">‹</button>
    <div class="ac-titel"><small>${esc(sub)}</small><h1>${esc(titel)}</h1></div><span class="ac-staat" data-staat aria-live="polite"></span>${acties}</header>`;
}

/* lijst van activiteiten */
function htmlLijst(){
  if (A.fout) return `${kop('Activiteiten', S.club?.naam || '')}<div class="ac-leeg"><p>${esc(A.fout)}</p></div>`;
  const v = vandaag();
  const komend = A.lijst.filter(a => !a.datum || a.datum >= v).filter(a => a.status !== 'geannuleerd');
  const geweest = A.lijst.filter(a => a.datum && a.datum < v || a.status === 'geannuleerd');
  const kaart = a => {
    const o = L.overzicht(a, v);
    return `<button class="ac-kaart" data-open="${esc(a.id)}"><span class="ac-datum">${a.datum ? `<b>${Number(a.datum.slice(8))}</b>${esc(L.datumKort(a.datum).split(' ')[1])}` : '<b>?</b>'}</span>
      <span class="ac-kaart-t"><b>${esc(a.naam || 'Activiteit')}</b><small>${esc([L.aftelTekst(o.dagenTot), L.STATUS_ACT[a.status] || '', a.locatie].filter(Boolean).join(' · '))}</small>
      ${o.taken.totaal ? `<span class="ac-balk"><i style="width:${o.taken.pct}%"></i></span><small>${o.taken.klaar} van ${o.taken.totaal} taken klaar${o.taken.telaat.length ? ` · <em class="rood">${o.taken.telaat.length} te laat</em>` : ''}</small>` : ''}</span></button>`;
  };
  return `${kop('Activiteiten', S.club?.naam || '', `<button class="knop vol" data-ac="nieuw">${ico('action-add', 18)} Nieuwe activiteit</button>`)}
    <p class="ac-zacht">Organiseer clubactiviteiten met een draaiboek dat terugplant vanaf de datum, vrijwilligersdiensten met een open link en een live dagprogramma. ${isAdmin() ? '' : 'Je ziet de activiteiten waarvan je in het comité zit.'}</p>
    ${isAdmin() ? `<div class="ac-extra"><button class="ac-extra-k" data-ac="extra" data-id="vrijwilligers">${ico('team-members', 22)}<span><b>Vrijwilligers</b><small>Waar zoekt de club mensen voor? Taken met een vaste omschrijving en een open aanmeldpagina.</small></span></button>
      <button class="ac-extra-k" data-ac="extra" data-id="schermen">${ico('communication-announcement', 22)}<span><b>Kantine-tv en sponsoren</b><small>Het programma van vandaag op de tv in de kantine, met de sponsoren van dit seizoen.</small></span></button></div>` : ''}
    ${komend.length ? `<h2 class="ac-h2">Komend</h2><div class="ac-kaarten">${komend.map(kaart).join('')}</div>` : `<div class="ac-paneel ac-midden"><p>Nog geen activiteiten.</p>${isAdmin() ? '<button class="knop vol" data-ac="nieuw">Begin met een draaiboek</button>' : ''}</div>`}
    ${geweest.length ? `<h2 class="ac-h2">Geweest</h2><div class="ac-kaarten">${geweest.slice().reverse().map(kaart).join('')}</div>` : ''}
    ${isAdmin() ? `<h2 class="ac-h2">Draaiboeken van de club</h2>
      <div class="ac-paneel">${A.sjablonen.length ? A.sjablonen.map(s => `<div class="ac-rij"><span class="ac-groei"><b>${esc(s.naam)}</b><small class="ac-zacht"> ${(s.taken || []).length} taken</small></span>
        <button class="knop klein licht" data-ac="sj-export" data-id="${esc(s.docId)}">Exporteren</button><button class="knop klein licht" data-ac="sj-weg" data-id="${esc(s.docId)}" aria-label="Verwijderen">✕</button></div>`).join('')
        : '<p class="ac-zacht">Nog geen eigen draaiboeken. Bewaar een activiteit als draaiboek (tab Evaluatie), of lees er een in.</p>'}
        <div class="ac-acties"><label class="knop licht klein">JSON inlezen<input type="file" accept=".json,application/json" data-ac-bestand="json" hidden></label></div></div>` : ''}`;
}

/* één activiteit */
function htmlAct(){
  const a = A.act, tabs = L.TABS.filter(([id]) => L.VASTE_TABS.includes(id) || tabAan(a, id));
  if (!tabs.some(([id]) => id === A.tab)) A.tab = 'overzicht';
  const sub = [a.datum ? L.datumLang(a.datum) : 'Nog geen datum', a.start ? `${a.start}${a.eind ? '–' + a.eind : ''}` : '', L.STATUS_ACT[a.status] || ''].filter(Boolean).join(' · ');
  const inhoud = { overzicht: htmlOverzicht, taken: htmlTaken, programma: htmlProgramma, mensen: htmlMensen, vrijwilligers: htmlVrijwilligers, deelnemers: htmlDeelnemers,
    toernooi: () => TN.htmlToernooi(tnCtx()), locatie: htmlLocatie, communicatie: htmlCommunicatie, budget: htmlBudget, documenten: htmlDocumenten, evaluatie: htmlEvaluatie }[A.tab];
  return `${kop(a.naam || 'Activiteit', sub, `<button class="knop licht" data-ac="export">${ico('admin-download', 18)} Exporteren</button>`)}
    ${a.planB?.actief ? `<div class="ac-melding rood">${ico('action-warning', 18)} <span><b>Plan B is actief.</b> ${esc(a.planB.tekst || '')}</span><button class="knop klein licht" data-ac="planb-uit">Terug naar plan A</button></div>` : ''}
    <nav class="ac-tabs" role="tablist">${tabs.map(([id, n]) => `<button role="tab" aria-selected="${A.tab === id}" class="${A.tab === id ? 'aan' : ''}" data-tab="${id}">${esc(n)}${tabTeller(id)}</button>`).join('')}</nav>
    <section class="ac-inhoud">${inhoud()}</section>`;
}
function tabTeller(id){
  const a = A.act;
  if (id === 'taken'){ const n = L.overzicht(a, vandaag()).taken.telaat.length; return n ? ` <em class="ac-tel rood">${n}</em>` : ''; }
  if (id === 'vrijwilligers' && A.deel){ const t = L.telDiensten(A.deel.diensten, A.aanm).tekort; return t > 0 ? ` <em class="ac-tel">${t}</em>` : ''; }
  return '';
}
const veld = (pad, waarde, { type = 'text', ph = '', klasse = '', extra = '' } = {}) =>
  `<input class="ac-in ${klasse}" type="${type}" data-veld="${esc(pad)}" value="${esc(waarde ?? '')}" placeholder="${esc(ph)}" ${extra}>`;
const tekstvak = (pad, waarde, ph = '', rijen = 3) => `<textarea class="ac-in" data-veld="${esc(pad)}" rows="${rijen}" placeholder="${esc(ph)}">${esc(waarde ?? '')}</textarea>`;
const stip = k => `<i class="ac-stip ${k}"></i>`;

/* Overzicht */
function htmlOverzicht(){
  const a = A.act, o = L.overzicht(a, vandaag(), A.aanm, A.deel?.diensten);
  const lid = id => a.comite?.[id]?.naam || '';
  const taakRegel = t => `<button class="ac-rij knopje" data-taak="${esc(t.id)}"><span class="ac-groei">${esc(t.titel)}</span><small class="ac-zacht">${esc([lid(t.eigenaar), L.datumKort(L.taakDatum(t, a.datum))].filter(Boolean).join(' · '))}</small></button>`;
  const tegel = (kleur, titel, tekst, tab) => `<button class="ac-tegel" data-tab="${tab}">${stip(kleur)}<span><b>${esc(titel)}</b><small>${tekst}</small></span></button>`;
  const v = a.vorige;
  return `<div class="ac-grid2">
    <div class="ac-paneel ac-aftel"><b>${esc(L.aftelTekst(o.dagenTot))}</b><span>${esc(a.datum ? L.datumLang(a.datum) : 'Kies een datum')}</span></div>
    <div class="ac-stoplicht">
      ${tegel(o.kleur.taken, 'Draaiboek', o.taken.totaal ? `${o.taken.klaar} van ${o.taken.totaal} klaar${o.taken.telaat.length ? `, ${o.taken.telaat.length} te laat` : ''}` : 'Nog geen taken', 'taken')}
      ${a.tabs?.vrijwilligers !== false ? tegel(o.kleur.diensten, 'Vrijwilligers', A.deel ? `${o.diensten.gevuld} van ${o.diensten.nodig} plekken gevuld` : 'Nog geen diensten', 'vrijwilligers') : ''}
      ${a.tabs?.budget !== false ? tegel(o.kleur.budget, 'Budget', o.budget.uitBegroot ? `${L.euro(o.budget.uitWerkelijk)} van ${L.euro(o.budget.uitBegroot)} uitgegeven` : 'Geen begroting', 'budget') : ''}
      ${a.tabs?.locatie !== false ? tegel(o.kleur.checks, 'Veiligheid', o.checks.totaal ? `${o.checks.totaal - o.checks.open} van ${o.checks.totaal} afgevinkt` : 'Geen checklist', 'locatie') : ''}
    </div></div>
    <div class="ac-grid2">
      <div class="ac-paneel"><h3>Deze week te doen</h3>${o.taken.week.map(taakRegel).join('') || '<p class="ac-zacht">Niets deze week.</p>'}
        ${o.taken.telaat.length ? `<h3 class="rood">Te laat</h3>${o.taken.telaat.map(taakRegel).join('')}` : ''}
        ${o.taken.zonderEigenaar ? `<p class="ac-zacht">${o.taken.zonderEigenaar} open ${o.taken.zonderEigenaar === 1 ? 'taak heeft' : 'taken hebben'} nog geen eigenaar.</p>` : ''}</div>
      <div class="ac-paneel"><h3>Gegevens</h3>
        <label class="ac-label">Naam</label>${veld('naam', a.naam)}
        <div class="ac-rij2"><span><label class="ac-label">Datum</label>${datumVeld('data-veld="datum"', a.datum)}</span>
          <span><label class="ac-label">Status</label><select class="ac-in" data-veld="status">${Object.entries(L.STATUS_ACT).map(([k, n]) => opt(k, n, a.status === k)).join('')}</select></span></div>
        <div class="ac-rij2"><span><label class="ac-label">Begin</label>${veld('start', a.start, { type: 'time' })}</span><span><label class="ac-label">Einde</label>${veld('eind', a.eind, { type: 'time' })}</span></div>
        <label class="ac-label">Locatie</label>${veld('locatie', a.locatie, { ph: 'Sportpark, kantine, sporthal…' })}
        <label class="ac-label">Omschrijving</label>${tekstvak('omschrijving', a.omschrijving, 'Waar gaat het om, voor wie?')}
      </div></div>
    ${v ? `<div class="ac-paneel ac-geheugen"><h3>${ico('admin-archive', 18)} Lessen van ${esc(v.naam || 'vorige keer')}${v.datum ? ` (${esc(L.datumKort(v.datum))} ${esc(v.datum.slice(0, 4))})` : ''}</h3>
      ${v.goed ? `<p><b>Ging goed:</b> ${esc(v.goed)}</p>` : ''}${v.beter ? `<p><b>Kan beter:</b> ${esc(v.beter)}</p>` : ''}<p class="ac-zacht">Tips van vorige keer staan bij de taken in het draaiboek.</p></div>` : ''}
    <div class="ac-paneel"><h3>Onderdelen</h3><p class="ac-zacht">Zet aan wat je nodig hebt. Een informatieavond heeft geen velden nodig, een toernooi wel.</p>
      <div class="ac-chips">${L.TABS.filter(([id]) => !L.VASTE_TABS.includes(id)).map(([id, n]) => `<label class="ac-chip ${tabAan(a, id) ? 'aan' : ''}"><input type="checkbox" data-veld="tabs.${id}" data-bool ${tabAan(a, id) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div></div>
    ${isAdmin() ? `<div class="ac-acties"><button class="knop licht" data-ac="kopie">Kopie maken (bv. volgend jaar)</button><button class="knop gevaar" data-ac="weg">Activiteit verwijderen</button></div>` : ''}`;
}

/* Draaiboek */
function htmlTaken(){
  const a = A.act, w = A.weergave;
  return `<div class="ac-balkje"><div class="ac-schakel" role="group" aria-label="Weergave">${[['lijst', 'Lijst'], ['bord', 'Bord'], ['tijdlijn', 'Tijdlijn']].map(([k, n]) => `<button class="${w === k ? 'aan' : ''}" data-weergave="${k}">${n}</button>`).join('')}</div>
    <span class="ac-groei"></span><label class="knop licht klein">Taken inlezen (CSV/Excel)<input type="file" accept=".csv,text/csv,.txt" data-ac-bestand="csv" hidden></label>
    <button class="knop vol klein" data-ac="taak-nieuw">${ico('action-add', 16)} Taak</button></div>
    ${w === 'bord' ? htmlBord() : w === 'tijdlijn' ? htmlTijdlijn() : htmlTakenLijst()}
    <p class="ac-zacht">Taken staan in dagen vóór de datum. Verschuift de datum, dan schuift het draaiboek mee.</p>`;
  void a;
}
function taakKaart(t, { bord = false } = {}){
  const a = A.act, staat = L.taakStaat(t, a.datum, vandaag()), d = L.taakDatum(t, a.datum);
  const st = t.status || 'open', volg = { open: 'bezig', bezig: 'klaar', klaar: 'open' }[st];
  return `<div class="ac-taak ${staat}" ${bord ? `draggable="true" data-sleep="${esc(t.id)}"` : ''}>
    <button class="ac-vink ${st}" data-ac="status" data-id="${esc(t.id)}" data-naar="${volg}" aria-label="Status: ${L.STATUS_TAAK[st]}">${st === 'klaar' ? ico('action-check', 16) : st === 'bezig' ? '½' : ''}</button>
    <button class="ac-taak-t" data-taak="${esc(t.id)}"><b>${esc(t.titel)}</b>
      <small>${esc([d ? (staat === 'telaat' ? 'te laat: ' : 'vóór ') + L.datumKort(d) : '', isTijd0(t) ? '' : L.dTekst(t.d), a.comite?.[t.eigenaar]?.naam || (t.rol ? `(${t.rol})` : '')].filter(Boolean).join(' · '))}</small>
      ${t.tip ? `<small class="ac-tip">${ico('action-info', 14)} ${esc(t.tip)}</small>` : ''}</button>
    ${bord ? `<span class="ac-pijlen">${st !== 'open' ? `<button data-ac="status" data-id="${esc(t.id)}" data-naar="${st === 'klaar' ? 'bezig' : 'open'}" aria-label="Terug">‹</button>` : ''}${st !== 'klaar' ? `<button data-ac="status" data-id="${esc(t.id)}" data-naar="${st === 'open' ? 'bezig' : 'klaar'}" aria-label="Verder">›</button>` : ''}</span>` : ''}</div>`;
}
const isTijd0 = t => L.isIso(t.datum);
function htmlTakenLijst(){
  const a = A.act, taken = L.takenOpDatum(a);
  if (!taken.length) return '<div class="ac-paneel ac-midden"><p>Nog geen taken. Voeg er een toe of lees een draaiboek in.</p></div>';
  return (a.fasen || L.FASEN).map(f => { const lijst = taken.filter(t => (t.fase || L.faseVan(t.d)) === f.id); return lijst.length || f.id !== 'na' ? `<div class="ac-paneel"><h3>${esc(f.naam)} <small class="ac-zacht">${lijst.filter(t => t.status === 'klaar').length}/${lijst.length}</small></h3>${lijst.map(t => taakKaart(t)).join('') || '<p class="ac-zacht">Geen taken.</p>'}</div>` : ''; }).join('');
}
function htmlBord(){
  const taken = L.takenOpDatum(A.act);
  return `<div class="ac-bord">${Object.entries(L.STATUS_TAAK).map(([k, n]) => { const l = taken.filter(t => (t.status || 'open') === k); return `<div class="ac-kolom" data-kolom="${k}"><h3>${esc(n)} <small class="ac-zacht">${l.length}</small></h3>${l.map(t => taakKaart(t, { bord: true })).join('')}</div>`; }).join('')}</div>`;
}
function htmlTijdlijn(){
  const a = A.act, v = vandaag(), taken = L.takenOpDatum(a);
  if (!L.isIso(a.datum)) return '<div class="ac-paneel"><p>Kies eerst een datum, dan staat het draaiboek op een tijdlijn.</p></div>';
  const maandag = iso => { const d = new Date(iso + 'T12:00:00Z'), w = (d.getUTCDay() + 6) % 7; return L.plusDagen(iso, -w); };
  const weken = new Map();
  for (const t of taken){ const d = L.taakDatum(t, a.datum); const k = d ? maandag(d) : 'zonder'; if (!weken.has(k)) weken.set(k, []); weken.get(k).push(t); }
  const sleutels = [...weken.keys()].filter(k => k !== 'zonder').sort();
  const dezeWeek = maandag(v), dagWeek = maandag(a.datum);
  return `<div class="ac-tijdlijn">${sleutels.map(k => `<div class="ac-week ${k === dezeWeek ? 'nu' : ''} ${k === dagWeek ? 'dag' : ''}"><div class="ac-week-kop"><b>Week van ${esc(L.datumKort(k))}</b>
      <small>${k === dezeWeek ? 'deze week' : ''}${k === dagWeek ? ' · de activiteit' : ''}${k < dezeWeek ? ' · geweest' : ''}</small></div>${weken.get(k).map(t => taakKaart(t)).join('')}</div>`).join('')}
    ${weken.has('zonder') ? `<div class="ac-week"><div class="ac-week-kop"><b>Zonder datum</b></div>${weken.get('zonder').map(t => taakKaart(t)).join('')}</div>` : ''}</div>`;
}
function vensterTaak(id){
  const a = A.act, t = a.taken?.[id];
  if (!t) return;
  const vast = L.isIso(t.datum);
  A.venster = `<h2>Taak</h2>
    <label class="ac-label">Wat</label>${veld(`taken.${id}.titel`, t.titel)}
    <div class="ac-rij2"><span><label class="ac-label">Eigenaar</label><select class="ac-in" data-veld="taken.${id}.eigenaar">${opt('', '— nog niemand —')}${L.gesorteerd(a.comite, (x, y) => String(x.naam).localeCompare(String(y.naam))).map(l => opt(l.id, `${l.naam}${l.rol ? ' (' + l.rol + ')' : ''}`, t.eigenaar === l.id)).join('')}</select></span>
      <span><label class="ac-label">Fase</label><select class="ac-in" data-veld="taken.${id}.fase">${(a.fasen || L.FASEN).map(f => opt(f.id, f.naam, (t.fase || L.faseVan(t.d)) === f.id)).join('')}</select></span></div>
    <div class="ac-rij2"><span><label class="ac-label">Klaar … dagen vooraf ${vast ? '(staat op vaste datum)' : ''}</label>${veld(`taken.${id}.d`, t.d ?? '', { type: 'number', extra: 'data-num inputmode="numeric" step="1" min="-365" max="730"' })}</span>
      <span><label class="ac-label">Of een vaste datum</label>${datumVeld(`data-veld="taken.${esc(id)}.datum"`, t.datum || '', { leeg: 'Geen vaste datum' })}</span></div>
    <p class="ac-zacht">${esc(L.dTekst(vast ? null : t.d))}${L.taakDatum(t, a.datum) ? ` → klaar vóór ${esc(L.datumLang(L.taakDatum(t, a.datum)))}` : ''}. Negatief = na de activiteit.</p>
    <label class="ac-label">Status</label><div class="ac-schakel">${Object.entries(L.STATUS_TAAK).map(([k, n]) => `<button class="${(t.status || 'open') === k ? 'aan' : ''}" data-ac="status" data-id="${esc(id)}" data-naar="${k}">${n}</button>`).join('')}</div>
    <label class="ac-label">Notitie</label>${tekstvak(`taken.${id}.notitie`, t.notitie, 'Afspraken, telefoonnummer leverancier, link…')}
    ${t.tip ? `<p class="ac-tip">${ico('action-info', 14)} ${esc(t.tip)}</p>` : ''}
    <div class="ac-acties"><button class="knop gevaar klein" data-ac="taak-weg" data-id="${esc(id)}">Verwijderen</button><span class="ac-groei"></span><button class="knop vol" data-ac="venster-dicht">Klaar</button></div>`;
  teken();
}

/* Dagprogramma */
function htmlProgramma(){
  const a = A.act, b = A.progB, sleutel = b ? 'programmaB' : 'programma';
  const { lijst } = L.programmaLijst(a[sleutel], 0);
  return `<div class="ac-balkje"><div class="ac-schakel">${[[false, 'Plan A'], [true, 'Plan B']].map(([k, n]) => `<button class="${b === k ? 'aan' : ''}" data-progb="${k}">${n}</button>`).join('')}</div><span class="ac-groei"></span>
    <button class="knop licht klein" data-ac="prog-nieuw">${ico('action-add', 16)} Punt</button><button class="knop vol klein" data-ac="live">Live op de dag</button></div>
    ${b ? `<div class="ac-paneel"><h3>Plan B</h3><p class="ac-zacht">Wat doen we bij slecht weer, een afgekeurd veld of te weinig mensen? Met één knop zet je plan B live; teams en vrijwilligers zien het meteen.</p>
      ${tekstvak('planB.tekst', a.planB?.tekst, 'Bijvoorbeeld: bij vorst naar de sporthal, schema korter.')}
      <div class="ac-acties">${a.planB?.actief ? '<button class="knop licht" data-ac="planb-uit">Terug naar plan A</button>' : '<button class="knop gevaar" data-ac="planb-aan">Plan B nu inschakelen</button>'}</div></div>` : ''}
    <div class="ac-paneel"><div class="ac-prog ac-prog-kop"><span>Tijd</span><span>Min</span><span>Wat</span><span>Waar</span><span>Wie</span><span></span></div>
      ${lijst.map(p => `<div class="ac-prog">${veld(`${sleutel}.${p.id}.tijd`, p.tijd, { type: 'time' })}${veld(`${sleutel}.${p.id}.duur`, p.duur, { type: 'number', extra: 'data-num min="0" max="600" step="5" inputmode="numeric"' })}
        ${veld(`${sleutel}.${p.id}.wat`, p.wat, { ph: 'Wat gebeurt er' })}${veld(`${sleutel}.${p.id}.waar`, p.waar, { ph: 'Waar' })}${veld(`${sleutel}.${p.id}.wie`, p.wie, { ph: 'Wie' })}
        <button class="ac-x" data-ac="prog-weg" data-pad="${sleutel}.${esc(p.id)}" aria-label="Weg">✕</button></div>`).join('') || `<p class="ac-zacht">${b ? 'Plan B heeft nog geen eigen programma. Laat leeg als het programma gelijk blijft.' : 'Nog geen programma.'}</p>`}</div>`;
}
function htmlLive(){
  const a = A.act, b = a.planB?.actief && Object.keys(a.programmaB || {}).length;
  const { lijst, nu, straks } = L.programmaLijst(b ? a.programmaB : a.programma, a.vertraging, nuMin());
  const v = Number(a.vertraging) || 0;
  return `<div class="ac-app ac-live"><header class="ac-kop"><button class="ac-terug" data-ac="live-uit" aria-label="Terug">‹</button><div class="ac-titel"><small>Live · ${esc(a.naam)}</small><h1>${esc(new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</h1></div></header>
    ${a.planB?.actief ? `<div class="ac-melding rood">Plan B: ${esc(a.planB.tekst || '')}</div>` : ''}
    <div class="ac-nu"><small>Nu</small><b>${esc(nu ? nu.wat : 'Even niets')}</b><span>${nu ? esc(`${nu.tijdNu}–${nu.eindNu}${nu.waar ? ' · ' + nu.waar : ''}${nu.wie ? ' · ' + nu.wie : ''}`) : ''}</span></div>
    <div class="ac-straks"><small>Straks</small><b>${esc(straks ? straks.wat : 'Klaar!')}</b><span>${straks ? esc(`${straks.tijdNu}${straks.waar ? ' · ' + straks.waar : ''}`) : ''}</span></div>
    <div class="ac-paneel"><h3>Uitloop: ${v > 0 ? '+' : ''}${v} min</h3><div class="ac-acties"><button class="knop licht" data-ac="vertraag" data-n="-5">−5</button><button class="knop licht" data-ac="vertraag" data-n="5">+5</button><button class="knop licht" data-ac="vertraag" data-n="15">+15</button><button class="knop licht" data-ac="vertraag" data-n="0">Op schema</button></div>
      <p class="ac-zacht">Uitloop schuift de rest van het programma mee, op elk toestel van het comité.</p></div>
    <div class="ac-paneel">${lijst.map(p => `<div class="ac-rij ${p === nu ? 'nu' : ''} ${p.eindMin !== null && p.eindMin <= nuMin() ? 'geweest' : ''}"><b class="ac-tijd">${esc(p.tijdNu)}</b><span class="ac-groei">${esc(p.wat)}</span><small class="ac-zacht">${esc(p.waar || '')}</small></div>`).join('')}</div>
    ${!a.planB?.actief ? '<button class="knop gevaar" data-ac="planb-aan">Plan B inschakelen</button>' : ''}</div>`;
}

/* Comité */
function mensenVanClub(){
  const c = S.club || {}, m = new Map();
  const voeg = (map, info) => Object.keys(map || {}).filter(u => map[u] === true).forEach(u => { if (!m.has(u)) m.set(u, String(info?.[u]?.naam || '').trim() || 'Clublid'); });
  voeg(c.admins, c.adminsInfo); voeg(c.leden, c.ledenInfo);
  return [...m.entries()].map(([id, naam]) => ({ id, naam })).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}
function htmlMensen(){
  const a = A.act, leden = L.gesorteerd(a.comite, (x, y) => String(x.naam).localeCompare(String(y.naam), 'nl'));
  const open = id => L.gesorteerd(a.taken).filter(t => t.eigenaar === id && t.status !== 'klaar').length;
  const vrij = mensenVanClub().filter(p => !a.comite?.[p.id]);
  return `<div class="ac-paneel"><h3>Comité</h3>${leden.map(l => `<div class="ac-rij"><span class="ac-groei"><b>${esc(l.naam)}</b> ${l.uid ? '' : '<small class="ac-zacht">(geen account)</small>'}</span>
      <select class="ac-in smal" data-veld="comite.${esc(l.id)}.rol">${opt('', 'Rol…')}${(a.rollen || []).map(r => opt(r, r, l.rol === r)).join('')}${l.rol && !(a.rollen || []).includes(l.rol) ? opt(l.rol, l.rol, true) : ''}</select>
      <small class="ac-zacht">${open(l.id)} open</small>
      <a class="knop klein licht" href="${esc(waLink(L.takenTekst(a, l.id, vandaag())))}" target="_blank" rel="noopener" title="Takenlijst via WhatsApp">${ico('action-whatsapp', 16)}</a>
      ${isAdmin() ? `<button class="ac-x" data-ac="lid-weg" data-id="${esc(l.id)}" aria-label="Uit het comité">✕</button>` : ''}</div>`).join('') || '<p class="ac-zacht">Nog niemand in het comité.</p>'}
    ${isAdmin() ? `<div class="ac-toevoeg"><select class="ac-in" data-kies="lid">${opt('', 'Iemand van de club toevoegen…')}${vrij.map(p => opt(p.id, p.naam)).join('')}</select>
      <span class="ac-of">of</span><input class="ac-in" data-kies="lidnaam" placeholder="Naam zonder account (ouder, vrijwilliger)" maxlength="40"><button class="knop licht klein" data-ac="lid-naam">Toevoegen</button></div>
      <p class="ac-zacht">Mensen van de club werken zelf mee in de app en zien alleen deze activiteit. Iemand zonder account kun je taken geven; die krijgt de takenlijst via WhatsApp.</p>` : ''}</div>
    <div class="ac-paneel"><h3>Rollen</h3><div class="ac-chips">${(a.rollen || []).map((r, i) => `<span class="ac-chip aan">${esc(r)} <button class="ac-x" data-ac="rol-weg" data-n="${i}" aria-label="Rol weg">✕</button></span>`).join('')}</div>
      <div class="ac-toevoeg"><input class="ac-in" data-kies="rol" placeholder="Nieuwe rol, bv. Kantine" maxlength="40"><button class="knop licht klein" data-ac="rol-nieuw">Toevoegen</button></div>
      <p class="ac-zacht">Taken uit een draaiboek hebben vaak al een rol. Krijgt iemand een rol, dan kun je de taken van die rol in één keer aan hem geven.</p>
      ${leden.length ? `<button class="knop licht klein" data-ac="rol-verdeel">Open taken verdelen op rol</button>` : ''}</div>`;
}

/* Vrijwilligers */
function htmlVrijwilligers(){
  const a = A.act;
  if (!a.deelId || !A.deel) return `<div class="ac-paneel ac-midden"><h3>Vrijwilligersdiensten</h3><p>Zet diensten klaar (kantine, scheidsrechter, opbouw…). Vrijwilligers schrijven zich in via een link, zonder account. Ze zien alleen de diensten en voornamen.</p>
    ${(a.dienstenSjabloon || []).length ? `<p class="ac-zacht">Het draaiboek stelt ${a.dienstenSjabloon.length} diensten voor.</p>` : ''}<button class="knop vol" data-ac="deel-aan">Diensten klaarzetten</button></div>`;
  const ds = L.telDiensten(A.deel.diensten, A.aanm), link = deelLink(a.deelId), op = a.datum === vandaag();
  return `<div class="ac-paneel"><div class="ac-balkje"><h3 class="ac-groei">Inschrijflink</h3><label class="ac-chip ${A.deel.open ? 'aan' : ''}"><input type="checkbox" data-deel="open" ${A.deel.open ? 'checked' : ''}> Link staat ${A.deel.open ? 'open' : 'dicht'}</label></div>
      <div class="ac-link"><code>${esc(link)}</code><button class="knop licht klein" data-ac="kopieer" data-tekst="${esc(link)}">Kopiëren</button>
      <a class="knop licht klein" href="${esc(waLink(L.oproepTekst(a, ds, link)))}" target="_blank" rel="noopener">${ico('action-whatsapp', 16)} Oproep</a></div>
      <p class="ac-zacht">${ds.gevuld} van ${ds.nodig} plekken gevuld${ds.tekort ? `, nog <b>${ds.tekort}</b> nodig` : ' 🎉'}. ${a.kamer ? 'Ouders zien de link ook in de Teamkamer.' : ''}</p></div>
    ${ds.lijst.map(d => { const wie = A.aanm.filter(x => x.dienst === d.id); return `<div class="ac-paneel ac-dienst ${d.tekort ? (d.aantal ? 'oranje' : 'rood') : 'groen'}">
      <div class="ac-dienst-kop">${veld(`d:${d.id}.naam`, d.naam, { klasse: 'vet' })}${veld(`d:${d.id}.start`, d.start, { type: 'time' })}<span>–</span>${veld(`d:${d.id}.eind`, d.eind, { type: 'time' })}
        ${veld(`d:${d.id}.plek`, d.plek, { ph: 'Plek', klasse: 'smal' })}<label class="ac-nodig">nodig ${veld(`d:${d.id}.nodig`, d.nodig, { type: 'number', extra: 'data-num min="0" max="50" inputmode="numeric"', klasse: 'getal' })}</label>
        <button class="ac-x" data-ac="dienst-weg" data-id="${esc(d.id)}" aria-label="Dienst weg">✕</button></div>
      <div class="ac-namen">${wie.map(x => `<span class="ac-chip ${x.aanwezig ? 'aan' : ''}">${op ? `<input type="checkbox" data-aanwezig="${esc(x.id)}" ${x.aanwezig ? 'checked' : ''} aria-label="Aanwezig">` : ''}${esc(x.naam)} <button class="ac-x" data-ac="aanm-weg" data-id="${esc(x.id)}" aria-label="Weghalen">✕</button></span>`).join('')}
        ${Array.from({ length: d.tekort }, () => '<span class="ac-chip leeg">open</span>').join('')}
        <span class="ac-toevoeg klein"><input class="ac-in smal" data-kies="aanm-${esc(d.id)}" placeholder="Naam" maxlength="24"><button class="knop klein licht" data-ac="aanm-nieuw" data-id="${esc(d.id)}">+</button></span></div></div>`; }).join('')}
    <div class="ac-acties"><button class="knop licht" data-ac="dienst-nieuw">${ico('action-add', 16)} Dienst</button><button class="knop licht" data-ac="print-rooster">Rooster printen (PDF)</button></div>
    ${op ? '<p class="ac-zacht">Vandaag is het zover: vink aan wie er is.</p>' : ''}`;
}

/* Deelnemers */
function htmlDeelnemers(){
  const a = A.act, teams = (S.clubTeams || []).filter(t => t && t.id && !t.gearchiveerd).sort((x, y) => String(x.naam).localeCompare(String(y.naam), 'nl', { numeric: true }));
  const gekozen = new Set(a.teams || []);
  return `<div class="ac-paneel"><h3>Welke teams doen mee?</h3><div class="ac-acties"><button class="knop klein licht" data-ac="teams-alle">Alle teams</button><button class="knop klein licht" data-ac="teams-geen">Geen</button></div>
      <div class="ac-chips">${teams.map(t => `<label class="ac-chip ${gekozen.has(t.id) ? 'aan' : ''}"><input type="checkbox" data-team="${esc(t.id)}" ${gekozen.has(t.id) ? 'checked' : ''}> ${esc(t.naam)}</label>`).join('') || '<p class="ac-zacht">Geen teams gevonden.</p>'}</div></div>
    <div class="ac-paneel"><h3>Zichtbaar maken</h3>
      <label class="ac-schak"><input type="checkbox" data-veld="agenda" data-bool ${a.agenda ? 'checked' : ''}> <span><b>In de Planning van de gekozen teams</b><small>Coaches zien naam, datum, tijd, locatie en de vrijwilligerslink, en maken met één knop een deelnemerslijstje voor hun team.</small></span></label>
      <label class="ac-schak"><input type="checkbox" data-veld="kamer" data-bool ${a.kamer ? 'checked' : ''} ${a.agenda ? '' : 'disabled'}> <span><b>Ook in de Teamkamer van ouders</b><small>Alleen bij teams waar de Teamkamer aan staat. Geen namen van kinderen.</small></span></label></div>
    <div class="ac-paneel"><h3>Vraag wie meedoet</h3>
      <label class="ac-schak"><input type="checkbox" data-veld="vraag" data-bool ${a.vraag ? 'checked' : ''}> <span><b>Deelnemerslijstje en vraag aan ouders klaarzetten</b><small>Elk gekozen team krijgt meteen een lijstje "Doet mee" bij Lijstjes. Staat de Teamkamer aan, dan vragen we het ook aan de ouders; hun antwoord komt vanzelf in het lijstje.</small></span></label>
      ${a.vraag ? `<div class="ac-rij2"><span><label class="ac-label">Antwoord graag vóór</label>${datumVeld('data-veld="vraagTot"', a.vraagTot || '', { leeg: '3 dagen vooraf' })}</span></div>` : ''}</div>
    <div class="ac-paneel"><h3>Aantallen</h3><div class="ac-rij2"><span><label class="ac-label">Verwacht aantal deelnemers</label>${veld('deelnemers.verwacht', a.deelnemers?.verwacht ?? '', { type: 'number', extra: 'data-num min="0" max="5000" inputmode="numeric"' })}</span></div>
      <label class="ac-label">Notitie (bv. ook vriendjes welkom, aanmelden vóór …)</label>${tekstvak('deelnemers.notitie', a.deelnemers?.notitie, '')}
      <p class="ac-zacht">Wie er per team meedoet, staat in het lijstje van dat team (alleen de staf van het team ziet namen).</p></div>`;
}

/* Locatie en spullen */
function htmlLocatie(){
  const a = A.act, vp = S.club?.platformModules?.veldplanner === true && isAdmin();
  const mat = L.gesorteerd(a.materiaal), checks = L.gesorteerd(a.checks), leden = L.gesorteerd(a.comite);
  return `<div class="ac-paneel"><h3>Locatie</h3>${veld('locatie', a.locatie, { ph: 'Sportpark, kantine, sporthal…' })}
      <div class="ac-acties">${vp ? '<button class="knop licht klein" data-ac="veldplanner">Velden en kleedkamers in de Veldplanner</button>' : ''}
      ${isAdmin() && L.isIso(a.datum) ? `<button class="knop licht klein" data-ac="aflasten">Trainingen op ${esc(L.datumKort(a.datum))} afgelasten</button>` : ''}</div></div>
    <div class="ac-paneel"><h3>Spullen</h3>${mat.map(m => `<div class="ac-rij"><input type="checkbox" data-veld="materiaal.${esc(m.id)}.klaar" data-bool ${m.klaar ? 'checked' : ''} aria-label="Klaar">
        ${veld(`materiaal.${m.id}.naam`, m.naam, { klasse: 'ac-groei' })}${veld(`materiaal.${m.id}.aantal`, m.aantal ?? '', { type: 'number', ph: 'Aantal', extra: 'data-num min="0" inputmode="numeric"', klasse: 'getal' })}
        <select class="ac-in smal" data-veld="materiaal.${esc(m.id)}.wie">${opt('', 'Wie neemt mee?')}${leden.map(l => opt(l.id, l.naam, m.wie === l.id)).join('')}</select>
        <button class="ac-x" data-ac="regel-weg" data-pad="materiaal.${esc(m.id)}" aria-label="Weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen spullen.</p>'}
      <button class="knop licht klein" data-ac="regel-nieuw" data-soort="materiaal">${ico('action-add', 16)} Spullen</button></div>
    <div class="ac-paneel"><h3>Veiligheid en vergunningen</h3>${checks.map(c => `<div class="ac-rij"><input type="checkbox" data-veld="checks.${esc(c.id)}.klaar" data-bool ${c.klaar ? 'checked' : ''} aria-label="Afgevinkt">${veld(`checks.${c.id}.titel`, c.titel, { klasse: 'ac-groei' })}
        <button class="ac-x" data-ac="regel-weg" data-pad="checks.${esc(c.id)}" aria-label="Weg">✕</button></div>`).join('') || '<p class="ac-zacht">Geen checklist.</p>'}
      <button class="knop licht klein" data-ac="regel-nieuw" data-soort="checks">${ico('action-add', 16)} Punt</button></div>`;
}

/* Communicatie */
function htmlCommunicatie(){
  const a = A.act, link = a.deelId ? deelLink(a.deelId) : '';
  const lijst = L.gesorteerd(a.berichten, (x, y) => (Number(y.d) || 0) - (Number(x.d) || 0));
  return `<p class="ac-zacht">Kant-en-klare berichten per moment. {naam}, {datum}, {tijd}, {locatie} en {link} worden vanzelf ingevuld.</p>
    ${lijst.map(b => { const dt = L.isIso(a.datum) ? L.plusDagen(a.datum, -(Number(b.d) || 0)) : ''; const t = L.vulIn(b.tekst, a, link); const tl = L.vulIn(b.titel, a, link);
      const laat = dt && dt <= vandaag() && !b.geplaatstMs; return `<div class="ac-paneel ac-bericht ${laat ? 'nu' : ''}"><div class="ac-balkje"><b class="ac-groei">${dt ? esc(L.datumKort(dt)) : esc(L.dTekst(b.d))}${laat ? ' · nu versturen' : ''}${b.geplaatstMs ? ' · verstuurd ✓' : ''}</b>
        <select class="ac-in smal" data-veld="berichten.${esc(b.id)}.kanaal">${Object.entries(L.KANALEN).map(([k, n]) => opt(k, n, b.kanaal === k)).join('')}</select>
        ${veld(`berichten.${b.id}.d`, b.d, { type: 'number', extra: 'data-num min="-60" max="365" inputmode="numeric" title="Dagen vooraf"', klasse: 'getal' })}</div>
        ${veld(`berichten.${b.id}.titel`, b.titel, { klasse: 'vet' })}${tekstvak(`berichten.${b.id}.tekst`, b.tekst, '', 3)}
        <p class="ac-voorbeeld"><b>${esc(tl)}</b><br>${esc(t)}</p>
        <div class="ac-acties">${b.kanaal === 'teams' && isAdmin() ? `<button class="knop vol klein" data-ac="bericht-plaats" data-id="${esc(b.id)}" ${(a.teams || []).length ? '' : 'disabled title="Kies eerst teams bij Deelnemers"'}>Plaatsen bij ${(a.teams || []).length} teams</button>` : ''}
          <a class="knop licht klein" href="${esc(waLink(tl + '\n' + t))}" target="_blank" rel="noopener" data-ac="bericht-wa" data-id="${esc(b.id)}">${ico('action-whatsapp', 16)} WhatsApp</a>
          <button class="knop licht klein" data-ac="kopieer" data-tekst="${esc(tl + '\n' + t)}">Kopiëren</button><span class="ac-groei"></span>
          <button class="ac-x" data-ac="regel-weg" data-pad="berichten.${esc(b.id)}" aria-label="Weg">✕</button></div></div>`; }).join('') || '<div class="ac-paneel"><p class="ac-zacht">Nog geen berichten.</p></div>'}
    <button class="knop licht" data-ac="regel-nieuw" data-soort="berichten">${ico('action-add', 16)} Bericht</button>
    <p class="ac-zacht">Berichten aan coaches komen als balk bovenaan het teamscherm. Ouders bereik je via de Teamkamer-agenda (tab Deelnemers) of WhatsApp.</p>`;
}

/* Budget */
function htmlBudget(){
  const a = A.act, t = L.budgetTotaal(a.budget);
  const regels = soort => L.gesorteerd(a.budget).filter(p => (p.soort === 'in') === (soort === 'in')).map(p => `<div class="ac-rij">${veld(`budget.${p.id}.naam`, p.naam, { klasse: 'ac-groei' })}
      ${veld(`budget.${p.id}.begroot`, p.begroot ?? '', { type: 'number', ph: 'Begroot', extra: 'data-num step="0.01" inputmode="decimal"', klasse: 'geld' })}
      ${veld(`budget.${p.id}.werkelijk`, p.werkelijk ?? '', { type: 'number', ph: 'Werkelijk', extra: 'data-num step="0.01" inputmode="decimal"', klasse: 'geld' })}
      <button class="ac-x" data-ac="regel-weg" data-pad="budget.${esc(p.id)}" aria-label="Weg">✕</button></div>`).join('');
  return `<div class="ac-paneel"><div class="ac-rij ac-zacht"><span class="ac-groei">Uitgaven</span><span class="geld">Begroot</span><span class="geld">Werkelijk</span><span style="width:28px"></span></div>${regels('uit') || '<p class="ac-zacht">Geen uitgaven.</p>'}
      <button class="knop licht klein" data-ac="regel-nieuw" data-soort="budget" data-sub="uit">${ico('action-add', 16)} Uitgave</button></div>
    <div class="ac-paneel"><h3>Inkomsten</h3>${regels('in') || '<p class="ac-zacht">Geen inkomsten.</p>'}<button class="knop licht klein" data-ac="regel-nieuw" data-soort="budget" data-sub="in">${ico('action-add', 16)} Inkomst</button></div>
    <div class="ac-paneel ac-totaal"><div class="ac-rij"><span class="ac-groei">Uitgaven</span><b class="geld">${L.euro(t.uitBegroot)}</b><b class="geld">${L.euro(t.uitWerkelijk)}</b></div>
      <div class="ac-rij"><span class="ac-groei">Inkomsten</span><b class="geld">${L.euro(t.inBegroot)}</b><b class="geld">${L.euro(t.inWerkelijk)}</b></div>
      <div class="ac-rij"><span class="ac-groei"><b>Saldo</b></span><b class="geld ${t.saldoBegroot < 0 ? 'rood' : ''}">${L.euro(t.saldoBegroot)}</b><b class="geld ${t.saldoWerkelijk < 0 ? 'rood' : ''}">${L.euro(t.saldoWerkelijk)}</b></div>
      ${t.verschil > 0 ? `<p class="rood">${L.euro(t.verschil)} meer uitgegeven dan begroot.</p>` : ''}</div>
    <p class="ac-zacht">Eenvoudig bijhouden, geen boekhouding. Bonnetjes horen bij de penningmeester.</p>`;
}

/* Documenten */
function htmlDocumenten(){
  const docs = L.gesorteerd(A.act.documenten);
  return `<div class="ac-paneel"><h3>Links en bestanden</h3>${docs.map(d => `<div class="ac-rij">${veld(`documenten.${d.id}.naam`, d.naam, { ph: 'Naam', klasse: 'smal' })}${veld(`documenten.${d.id}.url`, d.url, { ph: 'https://…', type: 'url', klasse: 'ac-groei' })}
      ${/^https:\/\//.test(d.url || '') ? `<a class="knop klein licht" href="${esc(d.url)}" target="_blank" rel="noopener">Open</a>` : ''}<button class="ac-x" data-ac="regel-weg" data-pad="documenten.${esc(d.id)}" aria-label="Weg">✕</button></div>`).join('') || '<p class="ac-zacht">Nog geen links. Denk aan de plattegrond, het speelschema of de huurovereenkomst (bijvoorbeeld in Google Drive of OneDrive).</p>'}
    <button class="knop licht klein" data-ac="regel-nieuw" data-soort="documenten">${ico('action-add', 16)} Link</button></div>
    <p class="ac-zacht">Documenten voor alle teams (bijvoorbeeld een reglement) plaats je bij Club › Documenten.</p>`;
}

/* Evaluatie */
function htmlEvaluatie(){
  const a = A.act, e = a.evaluatie || {}, taken = L.takenOpDatum(a);
  return `<div class="ac-paneel"><h3>Hoe ging het?</h3><label class="ac-label">Wat ging goed?</label>${tekstvak('evaluatie.goed', e.goed, '', 3)}
      <label class="ac-label">Wat kan beter?</label>${tekstvak('evaluatie.beter', e.beter, '', 3)}</div>
    <div class="ac-paneel"><h3>Tips voor volgende keer</h3><p class="ac-zacht">Een tip bij een taak staat er volgend jaar bij, ook als het comité dan anders is. Zo blijft de kennis bij de club.</p>
      ${taken.map(t => `<div class="ac-tiprij"><b>${esc(t.titel)}</b>${veld(`evaluatie.tips.${t.id}`, e.tips?.[t.id] || '', { ph: 'Tip voor volgende keer (mag leeg)' })}</div>`).join('')}</div>
    <div class="ac-acties"><button class="knop vol" data-ac="als-sjabloon">Bewaar als draaiboek van de club</button>${isAdmin() ? '<button class="knop licht" data-ac="kopie">Kopie voor volgend jaar</button>' : ''}</div>`;
}

/* ---------- vensters ---------- */
function sluitVenster(){ A.venster = null; teken(); }
function vensterNieuw(){
  const ai = aiAan();
  const kaart = s => `<button class="ac-sj" data-ac="nieuw-sj" data-id="${esc(s.id)}">${ico(s.icoon || 'planning-event', 28)}<b>${esc(s.naam)}</b><small>${esc(s.omschrijving || `${(s.taken || []).length} taken`)}</small></button>`;
  const eerder = A.lijst.slice().reverse().slice(0, 12);
  A.venster = `<h2>Nieuwe activiteit</h2><p class="ac-zacht">Kies een draaiboek. Alles is daarna aan te passen.</p>
    <div class="ac-sjablonen">${SJABLONEN.map(kaart).join('')}${A.sjablonen.map(s => kaart({ ...s, icoon: 'admin-archive', omschrijving: 'Draaiboek van de club' })).join('')}</div>
    ${eerder.length ? `<h3>Of kopieer een eerdere activiteit</h3><div class="ac-chips">${eerder.map(x => `<button class="ac-chip" data-ac="nieuw-kopie" data-id="${esc(x.id)}">${esc(x.naam)}${x.datum ? ' · ' + esc(x.datum.slice(0, 4)) : ''}</button>`).join('')}</div>` : ''}
    ${ai ? `<h3>Of laat Cluppie een concept maken</h3><textarea class="ac-in" data-kies="ai" rows="3" maxlength="600" placeholder="Bijvoorbeeld: Halloweentraining voor O9 tot O11, 60 kinderen, zaterdagmiddag, met speurtocht"></textarea>
      <button class="knop licht" data-ac="nieuw-ai">Concept maken</button><p class="ac-zacht">Cluppie stuurt alleen deze omschrijving mee, geen namen.</p>` : ''}
    <div class="ac-acties"><label class="knop licht klein">Activiteit of draaiboek inlezen (JSON)<input type="file" accept=".json,application/json" data-ac-bestand="json" hidden></label><span class="ac-groei"></span><button class="knop licht" data-ac="venster-dicht">Annuleren</button></div>`;
  teken();
}
function vensterGegevens(bron){
  A._bron = bron;
  const naam = bron.soort === 'kopie' ? bron.act.naam : bron.sj?.naam || '';
  A.venster = `<h2>${esc(bron.soort === 'kopie' ? 'Kopie van ' + bron.act.naam : bron.sj?.naam || 'Nieuwe activiteit')}</h2>
    <label class="ac-label">Naam</label><input class="ac-in" data-kies="naam" value="${esc(naam)}" maxlength="80">
    <label class="ac-label">Datum</label>${datumVeld('data-kies="datum"', '')}
    ${bron.soort === 'kopie' ? '<label class="ac-schak"><input type="checkbox" data-kies="mensen" checked> <span><b>Comité en eigenaren meenemen</b></span></label>' : ''}
    <p class="ac-zacht">${bron.soort === 'kopie' ? 'Taken staan weer open, vaste datums schuiven mee en de tips uit de evaluatie staan bij de taken.' : 'De taken worden teruggerekend vanaf deze datum.'}</p>
    <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-ac="nieuw-maak">Aanmaken</button></div>`;
  teken();
}
async function maakNieuw(){
  const b = A._bron, naam = A.el.querySelector('[data-kies="naam"]')?.value || '', datum = A.el.querySelector('[data-kies="datum"]')?.value || '';
  let data;
  if (b.soort === 'kopie') data = L.kopie(b.act, { naam, datum, door: uid(), zonderMensen: !A.el.querySelector('[data-kies="mensen"]')?.checked });
  else data = L.vanSjabloon(b.sj, { naam, datum, door: uid() });
  const dienstenOud = b.soort === 'kopie' ? b.diensten : null;
  delete data.id;
  if (b.soort === 'kopie' && dienstenOud) data.dienstenSjabloon = L.gesorteerd(dienstenOud).map(({ naam: n, start, eind, plek, nodig }) => ({ naam: n, start, eind, plek, nodig }));
  try {
    const ref = await addDoc(collection(db, 'clubs', A.clubId, 'activiteiten'), data);
    A.venster = null; A.tab = 'overzicht';
    meld('Activiteit aangemaakt');
    openAct(ref.id);
  } catch (e){ console.error('[activiteiten] nieuw', e); meld(e?.code === 'permission-denied' ? 'Aanmaken mag niet. Alleen de clubbeheerder maakt activiteiten.' : 'Aanmaken mislukt.'); }
}
function vensterExport(){
  const a = A.act;
  A.venster = `<h2>Exporteren</h2><p class="ac-zacht">Alles kan eruit: om te printen, in Excel verder te werken, in je agenda te zetten of als back-up.</p>
    <div class="ac-export">
      <button data-exp="pdf">${ico('admin-document', 22)}<b>Draaiboek (PDF)</b><small>Alles op papier: taken, programma, diensten, spullen</small></button>
      ${A.deel ? `<button data-exp="pdf-rooster">${ico('admin-document', 22)}<b>Vrijwilligersrooster (PDF)</b><small>Om op te hangen</small></button>` : ''}
      <button data-exp="csv-taken">${ico('admin-file', 22)}<b>Taken (Excel/CSV)</b><small>Ook weer in te lezen</small></button>
      ${a.tabs?.programma !== false ? `<button data-exp="csv-programma">${ico('admin-file', 22)}<b>Dagprogramma (Excel/CSV)</b></button>` : ''}
      ${A.deel ? `<button data-exp="csv-diensten">${ico('admin-file', 22)}<b>Diensten (Excel/CSV)</b><small>Met voornamen</small></button>` : ''}
      ${a.tabs?.budget !== false ? `<button data-exp="csv-budget">${ico('admin-file', 22)}<b>Budget (Excel/CSV)</b></button>` : ''}
      ${a.tabs?.locatie !== false ? `<button data-exp="csv-materiaal">${ico('admin-file', 22)}<b>Spullen (Excel/CSV)</b></button>` : ''}
      ${L.isIso(a.datum) ? `<button data-exp="ics">${ico('planning-calendar', 22)}<b>Agenda (ICS)</b><small>Met het dagprogramma</small></button>` : ''}
      ${tabAan(a, 'toernooi') ? TN.exportKnoppen(a) : ''}
      <button data-exp="json">${ico('admin-download', 22)}<b>Alles (JSON)</b><small>Back-up, of overzetten naar een andere club</small></button>
      <button data-exp="json-sj">${ico('admin-archive', 22)}<b>Als draaiboek (JSON)</b><small>Zonder datums, namen en bedragen</small></button>
    </div><div class="ac-acties"><span class="ac-groei"></span><button class="knop licht" data-ac="venster-dicht">Sluiten</button></div>`;
  teken();
}
const bestandsnaam = (ext, extra = '') => `${String(A.act?.naam || 'activiteit').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}${extra ? '-' + extra : ''}${A.act?.datum ? '-' + A.act.datum : ''}.${ext}`;
function download(naam, inhoud, type){
  const blob = new Blob([inhoud], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exporteer(soort){
  const a = A.act, v = vandaag();
  const zonder = { soort: 'cluppie-sjabloon' };
  void zonder;
  if (soort === 'csv-taken') return download(bestandsnaam('csv', 'taken'), L.csvTaken(a, v), 'text/csv;charset=utf-8');
  if (soort === 'csv-programma') return download(bestandsnaam('csv', 'programma'), L.csvProgramma(a), 'text/csv;charset=utf-8');
  if (soort === 'csv-diensten') return download(bestandsnaam('csv', 'diensten'), L.csvDiensten(A.deel?.diensten, A.aanm), 'text/csv;charset=utf-8');
  if (soort === 'csv-budget') return download(bestandsnaam('csv', 'budget'), L.csvBudget(a), 'text/csv;charset=utf-8');
  if (soort === 'csv-materiaal') return download(bestandsnaam('csv', 'spullen'), L.csvMateriaal(a), 'text/csv;charset=utf-8');
  if (soort === 'ics') return download(bestandsnaam('ics'), L.ics(a, { id: A.id, programma: true, url: a.deelId ? deelLink(a.deelId) : '' }), 'text/calendar;charset=utf-8');
  if (soort === 'json') return download(bestandsnaam('json'), L.jsonExport(a, { diensten: A.deel?.diensten, aanmeldingen: A.aanm }), 'application/json');
  if (soort === 'json-sj') return download(bestandsnaam('json', 'draaiboek').replace(/-\d{4}-\d{2}-\d{2}/, ''), L.jsonSjabloon(L.alsSjabloon(a, { diensten: A.deel?.diensten })), 'application/json');
  if (TN.exporteerToernooi(tnCtx(), soort)) return;
  if (soort === 'pdf') return printen(htmlPrintDraaiboek());
  if (soort === 'pdf-rooster') return printen(htmlPrintRooster());
}

/* ---------- printen (PDF via het printvenster) ---------- */
function printen(body){
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open(); d.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${esc(A.act?.naam || 'Activiteit')}</title><style>
    body{font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#111;margin:18mm 14mm}h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;margin:18px 0 6px;border-bottom:2px solid #111;padding-bottom:2px}
    .sub{color:#555;margin-bottom:10px}table{width:100%;border-collapse:collapse;margin:4px 0 8px}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #ccc;vertical-align:top}th{font-size:11px;color:#555}
    .k{width:16px}.vak{display:inline-block;width:11px;height:11px;border:1.5px solid #111;border-radius:2px}.tip{color:#555;font-style:italic}.lijn{border-bottom:1px solid #999;height:22px}
    .voet{margin-top:24px;color:#777;font-size:10px}@page{margin:12mm}</style></head><body>${body}<p class="voet">Gemaakt met Cluppie · ${esc(new Date().toLocaleString('nl-NL'))}</p></body></html>`);
  d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { meld('Printen lukt niet in deze browser.'); } setTimeout(() => f.remove(), 60000); }, 250);
}
function htmlPrintDraaiboek(){
  const a = A.act, v = vandaag(), fase = Object.fromEntries((a.fasen || L.FASEN).map(f => [f.id, f.naam]));
  const lid = id => a.comite?.[id]?.naam || '';
  const prog = L.programmaLijst(a.planB?.actief && Object.keys(a.programmaB || {}).length ? a.programmaB : a.programma, a.vertraging).lijst;
  const ds = A.deel ? L.telDiensten(A.deel.diensten, A.aanm) : null, t = L.budgetTotaal(a.budget);
  return `<h1>${esc(a.naam)}</h1><div class="sub">${esc([L.datumLang(a.datum), a.start ? `${a.start}${a.eind ? '–' + a.eind : ''}` : '', a.locatie].filter(Boolean).join(' · '))}</div>
    ${a.omschrijving ? `<p>${esc(a.omschrijving)}</p>` : ''}
    ${Object.keys(a.comite || {}).length ? `<h2>Comité</h2><table>${L.gesorteerd(a.comite).map(l => `<tr><td>${esc(l.naam)}</td><td>${esc(l.rol || '')}</td></tr>`).join('')}</table>` : ''}
    <h2>Draaiboek</h2><table><tr><th class="k"></th><th>Klaar vóór</th><th>Taak</th><th>Wie</th><th>Fase</th></tr>${L.takenOpDatum(a).map(x => `<tr><td><span class="vak">${x.status === 'klaar' ? '✓' : ''}</span></td>
      <td>${esc(L.datumKort(L.taakDatum(x, a.datum)))}</td><td>${esc(x.titel)}${x.notitie ? `<br><small>${esc(x.notitie)}</small>` : ''}${x.tip ? `<br><small class="tip">Tip: ${esc(x.tip)}</small>` : ''}</td><td>${esc(lid(x.eigenaar) || x.rol || '')}</td><td>${esc(fase[x.fase] || '')}</td></tr>`).join('')}</table>
    ${prog.length ? `<h2>Dagprogramma${a.planB?.actief ? ' (plan B)' : ''}</h2><table><tr><th>Tijd</th><th>Wat</th><th>Waar</th><th>Wie</th></tr>${prog.map(p => `<tr><td>${esc(p.tijdNu)}–${esc(p.eindNu)}</td><td>${esc(p.wat)}</td><td>${esc(p.waar || '')}</td><td>${esc(p.wie || '')}</td></tr>`).join('')}</table>` : ''}
    ${a.planB?.tekst ? `<h2>Plan B</h2><p>${esc(a.planB.tekst)}</p>` : ''}
    ${ds ? `<h2>Vrijwilligers</h2><table><tr><th>Dienst</th><th>Tijd</th><th>Plek</th><th>Wie</th></tr>${ds.lijst.map(d => `<tr><td>${esc(d.naam)}</td><td>${esc(d.start)}–${esc(d.eind)}</td><td>${esc(d.plek || '')}</td><td>${esc(A.aanm.filter(x => x.dienst === d.id).map(x => x.naam).join(', '))}${d.tekort ? ` <b>(nog ${d.tekort})</b>` : ''}</td></tr>`).join('')}</table>` : ''}
    ${Object.keys(a.materiaal || {}).length ? `<h2>Spullen</h2><table>${L.gesorteerd(a.materiaal).map(m => `<tr><td class="k"><span class="vak">${m.klaar ? '✓' : ''}</span></td><td>${esc(m.naam)}</td><td>${esc(m.aantal ?? '')}</td><td>${esc(lid(m.wie))}</td></tr>`).join('')}</table>` : ''}
    ${Object.keys(a.checks || {}).length ? `<h2>Veiligheid</h2><table>${L.gesorteerd(a.checks).map(c => `<tr><td class="k"><span class="vak">${c.klaar ? '✓' : ''}</span></td><td>${esc(c.titel)}</td></tr>`).join('')}</table>` : ''}
    ${t.uitBegroot || t.inBegroot ? `<h2>Budget</h2><table><tr><th>Post</th><th>Begroot</th><th>Werkelijk</th></tr>${L.gesorteerd(a.budget).map(p => `<tr><td>${p.soort === 'in' ? '+ ' : '− '}${esc(p.naam)}</td><td>${L.euro(p.begroot)}</td><td>${p.werkelijk != null ? L.euro(p.werkelijk) : ''}</td></tr>`).join('')}
      <tr><th>Saldo</th><th>${L.euro(t.saldoBegroot)}</th><th>${L.euro(t.saldoWerkelijk)}</th></tr></table>` : ''}
    <p class="sub">Stand op ${esc(L.datumLang(v))}.</p>`;
}
function htmlPrintRooster(){
  const a = A.act, ds = L.telDiensten(A.deel?.diensten, A.aanm);
  return `<h1>Vrijwilligers · ${esc(a.naam)}</h1><div class="sub">${esc([L.datumLang(a.datum), a.locatie].filter(Boolean).join(' · '))}</div>
    ${ds.lijst.map(d => { const wie = A.aanm.filter(x => x.dienst === d.id); return `<h2>${esc(d.naam)} · ${esc(d.start)}–${esc(d.eind)}${d.plek ? ' · ' + esc(d.plek) : ''}</h2><table>
      ${wie.map(x => `<tr><td class="k"><span class="vak"></span></td><td>${esc(x.naam)}</td></tr>`).join('')}${Array.from({ length: d.tekort }, () => '<tr><td class="k"><span class="vak"></span></td><td class="lijn"></td></tr>').join('')}</table>`; }).join('')}`;
}

/* ---------- klikken ---------- */
async function klik(e){
  if (!A) return;
  const t = e.target;
  const tab = t.closest('[data-tab]'); if (tab){ A.tab = tab.dataset.tab; A.venster = null; teken(); const app = A.el.querySelector('.ac-app'), nav = app?.querySelector('.ac-tabs'); if (app && nav && app.scrollTop > nav.offsetTop) app.scrollTop = nav.offsetTop - 8; nav?.querySelector('.aan')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
  const w = t.closest('[data-weergave]'); if (w){ A.weergave = w.dataset.weergave; return teken(); }
  const pb = t.closest('[data-progb]'); if (pb){ A.progB = pb.dataset.progb === 'true'; return teken(); }
  const op = t.closest('[data-open]'); if (op){ A.tab = 'overzicht'; return openAct(op.dataset.open); }
  const tk = t.closest('[data-taak]'); if (tk) return vensterTaak(tk.dataset.taak);
  const ex = t.closest('[data-exp]'); if (ex) return exporteer(ex.dataset.exp);
  const tn = t.closest('[data-tn]'); if (tn && A.act){ if (tn.disabled) return; return TN.klikToernooi(tnCtx(), tn); }
  const cs = t.closest('[data-cs]'); if (cs && A.extra === 'schermen'){ if (cs.disabled) return; return CS.klikSchermen(extraCtx(), cs); }
  const vb = t.closest('[data-vb]'); if (vb && A.extra === 'vrijwilligers'){ if (vb.disabled) return; return VB.klikVrijwilligers(extraCtx(), vb); }
  if (t.classList.contains('ac-venster')) return sluitVenster();
  const b = t.closest('[data-ac]'); if (!b) return;
  const ac = b.dataset.ac, id = b.dataset.id, a = A.act;
  switch (ac){
    case 'sluit': return sluitActiviteiten();
    case 'terug': return terugNaarLijst();
    case 'extra': if (!isAdmin()) return meld('Alleen de clubbeheerder.'); A.extra = id; A.venster = null; teken(); A.el.querySelector('.ac-app')?.scrollTo(0, 0); return;
    case 'extra-terug': A.extra = ''; A.venster = null; return teken();
    case 'venster-dicht': return sluitVenster();
    case 'nieuw': return isAdmin() ? vensterNieuw() : meld('Alleen de clubbeheerder maakt nieuwe activiteiten.');
    case 'nieuw-sj': { const sj = sjabloonVan(id) || A.sjablonen.find(s => s.id === id); return sj && vensterGegevens({ soort: 'sjabloon', sj }); }
    case 'nieuw-kopie': {
      const bron = A.lijst.find(x => x.id === id); if (!bron) return;
      let diensten = null;
      if (bron.deelId){ try { const s = await getDoc(doc(db, 'activiteitDeel', bron.deelId)); diensten = s.exists() ? s.data().diensten : null; } catch { /* zonder diensten */ } }
      return vensterGegevens({ soort: 'kopie', act: bron, diensten });
    }
    case 'nieuw-maak': return maakNieuw();
    case 'nieuw-ai': return conceptAI();
    case 'export': return vensterExport();
    case 'kopie': return vensterGegevens({ soort: 'kopie', act: a, diensten: A.deel?.diensten || null });
    case 'weg': return vensterWeg();
    case 'weg-ja': return verwijder();
    case 'status': { await zet({ [`taken.${id}.status`]: b.dataset.naar }); if (A.venster) vensterTaak(id); return; }
    case 'taak-nieuw': {
      const nid = L.nieuwId('t');
      await zet({ [`taken.${nid}`]: { titel: 'Nieuwe taak', fase: 'voor', eigenaar: '', d: 14, datum: '', status: 'open', notitie: '', tip: '', volg: volgende(a.taken) } });
      return vensterTaak(nid);
    }
    case 'taak-weg': { A.venster = null; return zet({ [`taken.${id}`]: deleteField() }); }
    case 'prog-nieuw': {
      const sl = A.progB ? 'programmaB' : 'programma', laatste = L.programmaLijst(a[sl]).lijst.slice(-1)[0];
      return zet({ [`${sl}.${L.nieuwId('p')}`]: { tijd: laatste?.eindNu || a.start || '', duur: 15, wat: '', waar: '', wie: '', volg: volgende(a[sl]) } });
    }
    case 'prog-weg': case 'regel-weg': return zet({ [b.dataset.pad]: deleteField() });
    case 'regel-nieuw': {
      const s = b.dataset.soort, nid = L.nieuwId(s.slice(0, 1));
      const nieuw = { materiaal: { naam: '', aantal: null, wie: '', klaar: false }, checks: { titel: '', klaar: false }, documenten: { naam: '', url: '' },
        berichten: { d: 7, titel: 'Nieuw bericht', tekst: '', kanaal: 'whatsapp', geplaatstMs: null }, budget: { naam: '', soort: b.dataset.sub === 'in' ? 'in' : 'uit', begroot: 0, werkelijk: null } }[s];
      return zet({ [`${s}.${nid}`]: { ...nieuw, volg: volgende(a[s]) } });
    }
    case 'live': A.live = true; teken(); clearInterval(A.liveTik); A.liveTik = setInterval(() => { if (A?.live && !A.venster) teken(); }, 30000); return;
    case 'live-uit': A.live = false; clearInterval(A.liveTik); return teken();
    case 'vertraag': { const n = Number(b.dataset.n); return zet({ vertraging: n === 0 ? 0 : (Number(a.vertraging) || 0) + n }); }
    case 'planb-aan': await zet({ 'planB.actief': true }); return meld('Plan B staat aan. Teams die de activiteit in hun Planning hebben, zien het meteen.');
    case 'planb-uit': return zet({ 'planB.actief': false });
    case 'lid-weg': {
      const l = a.comite?.[id]; if (!l) return;
      return zet({ [`comite.${id}`]: deleteField(), comiteUids: (a.comiteUids || []).filter(u => u !== l.uid) });
    }
    case 'lid-naam': {
      const inp = A.el.querySelector('[data-kies="lidnaam"]'), naam = L.schoneNaam(inp?.value).slice(0, 40);
      if (!naam) return meld('Vul een naam in');
      return zet({ [`comite.${L.nieuwId('n')}`]: { naam, rol: '' } });
    }
    case 'rol-nieuw': {
      const r = String(A.el.querySelector('[data-kies="rol"]')?.value || '').trim().slice(0, 40);
      if (!r || (a.rollen || []).includes(r)) return;
      return zet({ rollen: [...(a.rollen || []), r] });
    }
    case 'rol-weg': return zet({ rollen: (a.rollen || []).filter((_, i) => i !== Number(b.dataset.n)) });
    case 'rol-verdeel': {
      const perRol = {}; for (const l of L.gesorteerd(a.comite)) if (l.rol && !perRol[l.rol]) perRol[l.rol] = l.id;
      const patch = {}; for (const tk2 of L.gesorteerd(a.taken)) if (!tk2.eigenaar && tk2.status !== 'klaar' && perRol[tk2.rol]) patch[`taken.${tk2.id}.eigenaar`] = perRol[tk2.rol];
      if (!Object.keys(patch).length) return meld('Geen open taken zonder eigenaar met een rol die iemand heeft.');
      await zet(patch); return meld(`${Object.keys(patch).length} taken verdeeld`);
    }
    case 'deel-aan': return zetDeelAan();
    case 'dienst-nieuw': return zetDeel({ [`diensten.${L.nieuwId('d')}`]: { naam: 'Nieuwe dienst', start: a.start || '', eind: a.eind || '', plek: '', nodig: 2, volg: volgende(A.deel?.diensten) } });
    case 'dienst-weg': {
      if (A.aanm.some(x => x.dienst === id) && !confirm('Er staan mensen ingeschreven. Dienst toch weghalen?')) return;
      return zetDeel({ [`diensten.${id}`]: deleteField() });
    }
    case 'aanm-nieuw': {
      const inp = A.el.querySelector(`[data-kies="aanm-${CSS.escape(id)}"]`), naam = L.schoneNaam(inp?.value);
      if (!naam) return meld('Vul een voornaam in');
      try { await addDoc(collection(db, 'activiteitDeel', a.deelId, 'aanmeldingen'), { uid: uid(), dienst: id, naam, ms: Date.now(), door: 'comite' }); } catch (er){ console.error(er); meld('Toevoegen mislukt.'); }
      return;
    }
    case 'aanm-weg': try { await deleteDoc(doc(db, 'activiteitDeel', a.deelId, 'aanmeldingen', id)); } catch { meld('Weghalen mislukt.'); } return;
    case 'print-rooster': return printen(htmlPrintRooster());
    case 'kopieer': return kopieKlembord(b.dataset.tekst);
    case 'teams-alle': return zet({ teams: (S.clubTeams || []).filter(x => x && x.id && !x.gearchiveerd).map(x => x.id).slice(0, L.MAX.teams) });
    case 'teams-geen': return zet({ teams: [] });
    case 'veldplanner': return import('./veldplanner.js?v=20261126p').then(m => m.openVeldplanner(A.clubId));
    case 'aflasten': return vensterAflasten();
    case 'aflasten-ja': return aflasten();
    case 'bericht-plaats': return plaatsBericht(id);
    case 'bericht-wa': if (!a.berichten?.[id]?.geplaatstMs) zet({ [`berichten.${id}.geplaatstMs`]: Date.now() }, { stil: true }); return;
    case 'als-sjabloon': return bewaarSjabloon();
    case 'sj-export': { const s = A.sjablonen.find(x => x.docId === id); if (s){ const { id: _i, docId: _d, eigen: _e, ...rest } = s; download(`draaiboek-${String(s.naam).replace(/[^\w-]+/g, '-')}.json`, L.jsonSjabloon(rest), 'application/json'); } return; }
    case 'sj-weg': { if (!confirm('Dit draaiboek van de club verwijderen?')) return; try { await deleteDoc(doc(db, 'clubs', A.clubId, 'activiteitSjablonen', id)); A.sjablonen = A.sjablonen.filter(x => x.docId !== id); teken(); } catch { meld('Verwijderen mislukt.'); } return; }
  }
}
/* ---------- wijzigen (velden) ---------- */
async function wijzig(e){
  if (!A) return;
  const t = e.target;
  if (A.act && await TN.wijzigToernooi(tnCtx(), t)) return;
  if (A.extra === 'schermen' && await CS.wijzigSchermen(extraCtx(), t)) return;
  if (A.extra === 'vrijwilligers' && await VB.wijzigVrijwilligers(extraCtx(), t)) return;
  if (t.matches('[data-ac-bestand]')) return leesBestand(t);
  if (t.matches('[data-kies="lid"]')){
    const u = t.value; if (!u) return;
    const p = mensenVanClub().find(x => x.id === u);
    return zet({ [`comite.${u}`]: { naam: p?.naam || 'Clublid', rol: '', uid: u }, comiteUids: [...new Set([...(A.act.comiteUids || []), u])] });
  }
  if (t.matches('[data-team]')){
    const set = new Set(A.act.teams || []); t.checked ? set.add(t.dataset.team) : set.delete(t.dataset.team);
    return zet({ teams: [...set].slice(0, L.MAX.teams) });
  }
  if (t.matches('[data-deel]')) return zetDeel({ [t.dataset.deel]: t.checked }).then(syncAgenda);
  if (t.matches('[data-aanwezig]')){ try { await updateDoc(doc(db, 'activiteitDeel', A.act.deelId, 'aanmeldingen', t.dataset.aanwezig), { aanwezig: t.checked }); } catch { meld('Opslaan mislukt.'); } return; }
  if (!t.matches('[data-veld]')) return;
  const pad = t.dataset.veld;
  let w = t.type === 'checkbox' ? t.checked : t.value;
  if (t.hasAttribute('data-num')) w = String(w).trim() === '' ? null : Number(String(w).replace(',', '.'));
  if (typeof w === 'number' && !Number.isFinite(w)) return meld('Dat is geen getal');
  if (typeof w === 'string') w = w.slice(0, t.tagName === 'TEXTAREA' ? 2000 : 300);
  if (pad.startsWith('d:')) return zetDeel({ [`diensten.${pad.slice(2)}`]: w });
  if (/^taken\.[^.]+\.datum$/.test(pad) && w && !L.isIso(w)) return;
  if (pad === 'datum' && w && !L.isIso(w)) return;
  const patch = { [pad]: w };
  if (pad === 'vraag' && w === true) patch.agenda = true;
  if (pad === 'agenda' && w === false) patch.vraag = false;
  if (pad === 'datum') patch.seizoen = L.seizoenVan(w);
  if (pad === 'agenda' && !w) patch.kamer = false;
  await zet(patch);
  if (A?.venster && /^taken\./.test(pad) && /\.(d|datum|eigenaar|fase)$/.test(pad)) vensterTaak(pad.split('.')[1]);
}

/* ---------- vrijwilligers: deel-document ---------- */
async function zetDeelAan(){
  const a = A.act, id = L.nieuwId('a');
  try {
    await setDoc(doc(db, 'activiteitDeel', id), { club: A.clubId, clubNaam: S.club?.naam || '', actId: A.id, titel: a.naam || '', datum: a.datum || '', start: a.start || '', locatie: a.locatie || '',
      open: true, diensten: L.dienstenNaarMap(a.dienstenSjabloon || []), gemaaktMs: Date.now() });
    await zet({ deelId: id });
    meld('Diensten staan klaar. Deel de link!');
  } catch (e){ console.error('[activiteiten] deel', e); meld(e?.code === 'permission-denied' ? 'Mag niet. Zijn de Firestore-regels gepubliceerd?' : 'Mislukt.'); }
}
async function zetDeel(patch){
  if (!A?.act?.deelId) return;
  try { await updateDoc(doc(db, 'activiteitDeel', A.act.deelId), patch); toonOpgeslagen(); }
  catch (e){ console.error('[activiteiten] deel opslaan', e); meld('Opslaan mislukt.'); }
}

/* ---------- verwijderen, afgelasten, berichten, sjablonen ---------- */
function vensterWeg(){
  A.venster = `<h2>${esc(A.act.naam)} verwijderen?</h2><p>Het draaiboek, de vrijwilligersdiensten en de aanmeldingen verdwijnen. Dit kan niet terug. Wil je het bewaren? Exporteer het eerst (JSON).</p>
    <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop gevaar" data-ac="weg-ja">Verwijderen</button></div>`;
  teken();
}
async function verwijder(){
  const id = A.id, deelId = A.act?.deelId;
  stopSubs();
  try {
    if (deelId){
      const aan = await getDocs(collection(db, 'activiteitDeel', deelId, 'aanmeldingen'));
      await Promise.all(aan.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'activiteitDeel', deelId));
    }
    await deleteDoc(doc(db, 'clubs', A.clubId, 'activiteitenAgenda', id)).catch(() => {});
    if (A.act?.toernooi?.liveId) await deleteDoc(doc(db, 'toernooiLive', A.act.toernooi.liveId)).catch(() => {});
    if (A.act?.toernooi?.inschrijfId) await TN.wisInschrijven(A.act.toernooi.inschrijfId);
    await deleteDoc(actRef(id));
    A.venster = null; meld('Verwijderd');
  } catch (e){ console.error('[activiteiten] verwijderen', e); meld('Verwijderen mislukt.'); }
  terugNaarLijst();
}
function vensterAflasten(){
  const a = A.act, n = (a.teams || []).length;
  A.venster = `<h2>Trainingen afgelasten op ${esc(L.datumLang(a.datum))}</h2><p>Coaches en het Nu-scherm zien dat de training niet doorgaat, met als reden "${esc(a.naam)}".</p>
    <label class="ac-schak"><input type="radio" name="afl" value="deel" ${n ? 'checked' : 'disabled'}> <span><b>Alleen de deelnemende teams (${n})</b></span></label>
    <label class="ac-schak"><input type="radio" name="afl" value="alle" ${n ? '' : 'checked'}> <span><b>Alle teams van de club</b></span></label>
    <div class="ac-acties"><button class="knop licht" data-ac="venster-dicht">Annuleren</button><span class="ac-groei"></span><button class="knop vol" data-ac="aflasten-ja">Afgelasten</button></div>`;
  teken();
}
async function aflasten(){
  const a = A.act, alle = A.el.querySelector('input[name="afl"]:checked')?.value !== 'deel';
  const teams = (S.clubTeams || []).filter(t => t && t.id && !t.gearchiveerd && (alle || (a.teams || []).includes(t.id)));
  const data = { datum: a.datum, reden: a.naam, tijd: serverTimestamp() };
  try {
    await Promise.all(teams.map(t => updateDoc(doc(db, 'teams', t.id), { afgelast: data })));
    await addDoc(collection(db, 'clubs', A.clubId, 'afgelastingen'), { ...data, activiteit: A.id });
    A.venster = null; meld(`Training afgelast voor ${teams.length} teams`); teken();
  } catch (e){ console.error('[activiteiten] aflasten', e); meld('Afgelasten mislukt.'); }
}
async function plaatsBericht(id){
  const a = A.act, b = a.berichten?.[id];
  if (!b || !(a.teams || []).length) return;
  const link = a.deelId ? deelLink(a.deelId) : '';
  try {
    await addDoc(collection(db, 'berichten'), { club: A.clubId, clubNaam: S.club?.naam || '', titel: L.vulIn(b.titel, a, link).slice(0, 120), body: L.vulIn(b.tekst, a, link).slice(0, 2000),
      teams: a.teams.slice(0, L.MAX.teams), gemaakt: serverTimestamp(), zichtbaarTot: L.isIso(a.datum) ? Date.parse(L.plusDagen(a.datum, 1) + 'T00:00:00') : null, activiteit: A.id });
    await zet({ [`berichten.${id}.geplaatstMs`]: Date.now() }, { stil: true });
    meld(`Geplaatst bij ${a.teams.length} teams`);
  } catch (e){ console.error('[activiteiten] bericht', e); meld('Plaatsen mislukt.'); }
}
async function bewaarSjabloon(){
  const naam = prompt('Naam van het draaiboek', A.act.naam);
  if (!naam) return;
  try {
    const sj = { ...L.alsSjabloon(A.act, { naam, diensten: A.deel?.diensten }), gemaaktDoor: uid(), gemaaktMs: Date.now() };
    await addDoc(collection(db, 'clubs', A.clubId, 'activiteitSjablonen'), JSON.parse(JSON.stringify(sj)));
    meld('Bewaard bij de draaiboeken van de club');
  } catch (e){ console.error('[activiteiten] sjabloon', e); meld(e?.code === 'permission-denied' ? 'Alleen de clubbeheerder bewaart draaiboeken.' : 'Bewaren mislukt.'); }
}

/* ---------- bestanden inlezen ---------- */
async function leesBestand(inp){
  const f = inp.files?.[0]; inp.value = '';
  if (!f) return;
  if (f.size > 1024 * 1024) return meld('Dit bestand is te groot (max 1 MB).');
  const tekst = await f.text();
  if (inp.dataset.acBestand === 'csv'){
    const { taken, fout } = L.takenUitCsv(tekst, A.act.datum);
    if (fout) return meld(fout);
    const patch = {}; let v = volgende(A.act.taken);
    for (const t of taken) patch[`taken.${L.nieuwId('t')}`] = { ...t, volg: v++ };
    await zet(patch); return meld(`${taken.length} taken ingelezen`);
  }
  const r = L.jsonLees(tekst);
  if (r.fout) return meld(r.fout);
  if (r.soort === 'sjabloon'){
    if (A.id) return meld('Lees een draaiboek in vanaf het overzicht van activiteiten.');
    if (confirm(`Draaiboek "${r.data.naam}" bewaren bij de draaiboeken van de club?`)){
      try { await addDoc(collection(db, 'clubs', A.clubId, 'activiteitSjablonen'), { ...JSON.parse(JSON.stringify(r.data)), gemaaktDoor: uid(), gemaaktMs: Date.now() }); await laadLijst(); }
      catch { return meld('Bewaren mislukt.'); }
    }
    return vensterGegevens({ soort: 'sjabloon', sj: r.data });
  }
  /* een hele activiteit: als kopie, zonder mensen (die horen bij een andere club of een ander jaar) */
  return vensterGegevens({ soort: 'kopie', act: r.data, diensten: r.diensten });
}

/* ---------- AI-concept ---------- */
async function conceptAI(){
  const t = String(A.el.querySelector('[data-kies="ai"]')?.value || '').trim();
  if (t.length < 10) return meld('Beschrijf de activiteit in een paar zinnen.');
  const knop = A.el.querySelector('[data-ac="nieuw-ai"]'); if (knop){ knop.disabled = true; knop.textContent = 'Even denken…'; }
  try {
    const r = await httpsCallable(functions, 'activiteitConceptAI')({ clubId: A.clubId, omschrijving: t.slice(0, 600) });
    const sj = L.schoonConcept(r.data?.concept);
    if (!sj) throw new Error('leeg');
    vensterGegevens({ soort: 'sjabloon', sj });
  } catch (e){
    console.error('[activiteiten] ai', e);
    meld(e?.code === 'functions/failed-precondition' ? 'AI staat uit voor deze club.' : e?.code === 'functions/resource-exhausted' ? 'De AI-limiet van deze maand is bereikt.' : 'Het concept lukte niet. Kies een draaiboek of probeer het zo opnieuw.');
    if (knop){ knop.disabled = false; knop.textContent = 'Concept maken'; }
  }
}

/* ---------- stijl ---------- */
function stijl(){
  if (document.getElementById('acStijl')) return;
  const s = document.createElement('style'); s.id = 'acStijl';
  s.textContent = `
html.ac-open{overflow:hidden}
.ac-laag{position:fixed;inset:0;z-index:80;background:var(--bg);color:var(--ink);display:none}
.ac-laag.toon{display:block}
.ac-app{height:100%;overflow:auto;padding:var(--space-md) 16px calc(var(--space-xl) + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:var(--space-sm);max-width:1100px;margin:0 auto}
.ac-leeg{margin:auto;max-width:440px;text-align:center;display:flex;flex-direction:column;gap:var(--space-sm);align-items:center}
.ac-kop{display:flex;align-items:center;gap:var(--space-sm);position:relative}
.ac-kop .knop{flex-shrink:0;width:auto}
.ac-acties .knop.vol{width:auto}
html.desk .ac-laag{left:var(--zij-w,0px)}
html.desk .ac-venster{left:var(--zij-w,0px);align-items:center}
html.desk .ac-blad{border-radius:var(--r-l)}
.ac-terug{width:40px;height:40px;border-radius:50%;background:var(--card);font-size:24px;line-height:1;color:var(--ink);flex-shrink:0}
.ac-titel{display:flex;flex-direction:column;margin-right:auto;min-width:0;flex:1 1 0}
.ac-titel small{font-size:var(--t-xs);color:var(--ink-2)}
.ac-titel h1{font-family:var(--font-display);font-weight:700;text-transform:uppercase;font-size:var(--t-3xl);margin:0;line-height:1;overflow-wrap:anywhere}
.ac-staat{font-size:var(--t-xs);color:var(--ok);position:absolute;right:16px;top:calc(100% - 2px);pointer-events:none}
.ac-h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-xl);margin:var(--space-sm) 0 0}
.ac-zacht{color:var(--ink-2);font-size:var(--t-sm);margin:4px 0}
.ac-paneel{background:var(--card);border-radius:var(--r-m);padding:var(--space-sm);box-shadow:var(--shadow);min-width:0;display:flex;flex-direction:column;gap:6px}
.ac-paneel h3{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg);margin:0;display:flex;align-items:center;gap:6px}
.ac-midden{align-items:center;text-align:center}
.ac-kaarten{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-xs)}
.ac-kaart{display:flex;gap:var(--space-sm);align-items:flex-start;text-align:left;background:var(--card);border-radius:var(--r-m);padding:var(--space-sm);box-shadow:var(--shadow);color:var(--ink);min-height:44px}
.ac-datum{display:flex;flex-direction:column;align-items:center;min-width:48px;padding:6px;border-radius:var(--r-s);background:color-mix(in srgb,var(--accent) 14%,var(--card));font-size:var(--t-xs);text-transform:uppercase}
.ac-datum b{font-family:var(--font-display);font-size:var(--t-2xl);line-height:1}
.ac-kaart-t{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.ac-kaart-t small{color:var(--ink-2);font-size:var(--t-xs)}
.ac-balk{height:6px;border-radius:3px;background:var(--hair);overflow:hidden;display:block}
.ac-balk i{display:block;height:100%;background:var(--ok)}
.rood{color:var(--uit)!important;font-style:normal}
.ac-tabs{display:flex;gap:4px;overflow-x:auto;padding:6px 0 4px;scrollbar-width:thin;position:sticky;top:calc(-1 * var(--space-md));z-index:3;background:var(--bg);margin-block:-6px -4px;flex-shrink:0}
.ac-tabs button{flex-shrink:0;padding:8px 12px;border-radius:var(--r-pill);background:var(--card);color:var(--ink);font-size:var(--t-sm);min-height:40px;border:1.5px solid var(--hair)}
.ac-tabs button.aan{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--card));font-weight:600}
.ac-tel{font-style:normal;font-size:var(--t-2xs);background:var(--warn);color:#111;border-radius:var(--r-pill);padding:1px 6px}
.ac-tel.rood{background:var(--uit);color:#fff!important}
.ac-inhoud{display:flex;flex-direction:column;gap:var(--space-sm)}
.ac-grid2{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)}
.ac-aftel{justify-content:center}
.ac-aftel b{font-family:var(--font-display);font-size:var(--t-4xl);text-transform:uppercase;line-height:1}
.ac-stoplicht{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xs)}
.ac-tegel{display:flex;gap:8px;align-items:flex-start;text-align:left;background:var(--card);border-radius:var(--r-m);padding:10px;box-shadow:var(--shadow);color:var(--ink);min-height:44px}
.ac-tegel span{display:flex;flex-direction:column;gap:2px}.ac-tegel small{color:var(--ink-2);font-size:var(--t-xs)}
.ac-stip{width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:4px;background:var(--hair)}
.ac-stip.groen{background:var(--ok)}.ac-stip.oranje{background:var(--warn)}.ac-stip.rood{background:var(--uit)}
.ac-rij{display:flex;align-items:center;gap:6px;min-height:40px;flex-wrap:wrap}
.ac-rij.knopje{background:none;text-align:left;color:var(--ink);width:100%;border-bottom:1px solid var(--hair)}
.ac-rij.nu{background:color-mix(in srgb,var(--accent) 18%,transparent);border-radius:var(--r-s);padding:0 6px}
.ac-rij.geweest{opacity:.5}
.ac-groei{flex:1;min-width:0}
.ac-rij2{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xs)}
.ac-label{display:block;font-size:var(--t-xs);color:var(--ink-2);margin:4px 0 2px}
.ac-in{width:100%;min-height:40px;padding:8px 10px;border-radius:var(--r-s);border:1.5px solid var(--hair);background:var(--surface,var(--card));color:var(--ink);font:inherit;font-size:16px;box-sizing:border-box}
textarea.ac-in{resize:vertical}
.ac-in.smal{width:auto;max-width:180px}.ac-in.getal{width:76px}.ac-in.geld,.geld{width:100px;text-align:right}.ac-in.vet{font-weight:600}
.ac-rij .ac-in.ac-groei{width:auto;flex:1 1 120px}
.ac-rij select.ac-in.smal{flex:1 1 140px}
.ac-acties{display:flex;gap:var(--space-xs);flex-wrap:wrap;align-items:center}
.ac-balkje{display:flex;gap:var(--space-xs);flex-wrap:wrap;align-items:center}
.ac-schakel{display:inline-flex;background:var(--card);border-radius:var(--r-pill);padding:3px;border:1.5px solid var(--hair)}
.ac-schakel button{padding:6px 14px;border-radius:var(--r-pill);background:none;color:var(--ink);min-height:36px;font-size:var(--t-sm)}
.ac-schakel button.aan{background:var(--accent);color:var(--accent-ink,#fff);font-weight:600}
.ac-chips{display:flex;flex-wrap:wrap;gap:6px}
.ac-chip{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:var(--r-pill);border:1.5px solid var(--hair);background:var(--card);color:var(--ink);font-size:var(--t-sm);min-height:36px;cursor:pointer}
.ac-chip.aan{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--card))}
.ac-chip.leeg{border-style:dashed;color:var(--ink-2)}
.ac-chip input{margin:0}
.ac-x{background:none;color:var(--ink-2);min-width:28px;min-height:28px;border-radius:50%;font-size:14px}
.ac-x:hover{background:var(--hair)}
.ac-taak{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--hair)}
.ac-taak:last-child{border-bottom:0}
.ac-taak.telaat .ac-taak-t small:first-of-type{color:var(--uit)}
.ac-taak.klaar .ac-taak-t b{text-decoration:line-through;color:var(--ink-2)}
.ac-vink{width:28px;height:28px;flex-shrink:0;border-radius:8px;border:2px solid var(--hair);background:var(--card);color:var(--ink);display:grid;place-items:center;font-size:12px;font-weight:700;margin-top:2px}
.ac-vink.bezig{border-color:var(--warn)}.ac-vink.klaar{background:var(--ok);border-color:var(--ok);color:#fff}
.ac-taak-t{flex:1;min-width:0;text-align:left;background:none;color:var(--ink);display:flex;flex-direction:column;gap:2px;padding:0}
.ac-taak-t small{font-size:var(--t-xs);color:var(--ink-2)}
.ac-tip{color:var(--ink-2);font-size:var(--t-xs);display:flex;gap:4px;align-items:flex-start;font-style:italic}
.ac-pijlen{display:flex;gap:2px}.ac-pijlen button{width:28px;height:28px;border-radius:50%;background:var(--hair);color:var(--ink)}
.ac-bord{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-sm)}
.ac-kolom{background:color-mix(in srgb,var(--ink) 4%,var(--bg));border-radius:var(--r-m);padding:var(--space-xs);min-height:160px;display:flex;flex-direction:column;gap:6px}
.ac-kolom h3{font-family:var(--font-display);text-transform:uppercase;margin:0 4px;font-size:var(--t-lg)}
.ac-kolom .ac-taak{background:var(--card);border-radius:var(--r-s);padding:8px;border:0;box-shadow:var(--shadow);cursor:grab}
.ac-tijdlijn{display:flex;flex-direction:column;gap:var(--space-xs);border-left:3px solid var(--hair);margin-left:6px;padding-left:12px}
.ac-week{background:var(--card);border-radius:var(--r-m);padding:var(--space-xs) var(--space-sm);box-shadow:var(--shadow);position:relative}
.ac-week::before{content:'';position:absolute;left:-19px;top:14px;width:11px;height:11px;border-radius:50%;background:var(--hair)}
.ac-week.nu::before{background:var(--accent)}.ac-week.dag::before{background:var(--ok);width:15px;height:15px;left:-21px}
.ac-week.nu{outline:2px solid var(--accent)}
.ac-week-kop{display:flex;gap:6px;align-items:baseline}.ac-week-kop small{color:var(--ink-2);font-size:var(--t-xs)}
.ac-prog{display:grid;grid-template-columns:96px 64px minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 28px;gap:4px;align-items:center}
.ac-prog-kop{font-size:var(--t-xs);color:var(--ink-2)}
.ac-melding{display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:var(--r-m);background:var(--amber-bg);border:1px solid var(--amber-lijn);flex-wrap:wrap}
.ac-melding.rood{background:color-mix(in srgb,var(--uit) 14%,var(--card));border-color:var(--uit)}
.ac-melding span{flex:1;min-width:200px}
.ac-geheugen{border-left:4px solid var(--accent)}
.ac-geheugen p{margin:0}
.ac-toevoeg{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ac-toevoeg .ac-in{flex:1;min-width:160px}
.ac-toevoeg.klein .ac-in{min-width:90px;max-width:120px;min-height:34px;padding:4px 8px}
.ac-of{color:var(--ink-2);font-size:var(--t-sm)}
.ac-link{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ac-link code{flex:1;min-width:0;overflow-wrap:anywhere;font-size:var(--t-xs);background:var(--hair);padding:6px 8px;border-radius:var(--r-s)}
.ac-dienst{border-left:4px solid var(--hair)}
.ac-dienst.groen{border-left-color:var(--ok)}.ac-dienst.oranje{border-left-color:var(--warn)}.ac-dienst.rood{border-left-color:var(--uit)}
.ac-dienst-kop{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.ac-dienst-kop .ac-in[type=time]{width:110px}
.ac-dienst-kop .ac-in.vet{flex:1;min-width:140px}
.ac-nodig{display:flex;align-items:center;gap:4px;font-size:var(--t-xs);color:var(--ink-2)}
.ac-namen{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ac-schak{display:flex;gap:10px;align-items:flex-start;padding:6px 0;cursor:pointer}
.ac-schak input{margin-top:4px;width:20px;height:20px;flex-shrink:0}
.ac-schak span{display:flex;flex-direction:column;gap:2px}.ac-schak small{color:var(--ink-2);font-size:var(--t-xs)}
.ac-bericht.nu{outline:2px solid var(--warn)}
.ac-voorbeeld{background:color-mix(in srgb,var(--ink) 5%,var(--card));border-radius:var(--r-s);padding:8px 10px;font-size:var(--t-sm);margin:0;white-space:pre-line}
.ac-totaal .ac-rij{min-height:30px}
.ac-tiprij{display:flex;flex-direction:column;gap:2px;padding:6px 0;border-bottom:1px solid var(--hair)}
.ac-venster{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;z-index:2}
.ac-blad{background:var(--bg);width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:var(--r-l) var(--r-l) 0 0;padding:var(--space-md) 16px calc(var(--space-md) + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px}
.ac-blad h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-2xl);margin:0}
.ac-blad h3{margin:var(--space-sm) 0 0;font-size:var(--t-md)}
.ac-sjablonen{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.ac-sj{display:flex;flex-direction:column;gap:4px;align-items:flex-start;text-align:left;background:var(--card);border:1.5px solid var(--hair);border-radius:var(--r-m);padding:10px;color:var(--ink);min-height:44px}
.ac-sj small{color:var(--ink-2);font-size:var(--t-xs);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ac-sj:hover,.ac-sj:focus-visible{border-color:var(--accent)}
.ac-export{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px}
.ac-export button{display:grid;grid-template-columns:28px 1fr;gap:2px 8px;text-align:left;background:var(--card);border:1.5px solid var(--hair);border-radius:var(--r-m);padding:10px;color:var(--ink);align-items:center}
.ac-export button svg{grid-row:span 2}.ac-export small{color:var(--ink-2);font-size:var(--t-xs)}
.ac-live .ac-nu,.ac-live .ac-straks{border-radius:var(--r-l);padding:var(--space-md);display:flex;flex-direction:column;gap:4px}
.ac-live .ac-nu{background:var(--accent);color:var(--accent-ink,#fff)}
.ac-live .ac-straks{background:var(--card);box-shadow:var(--shadow)}
.ac-live .ac-nu b{font-family:var(--font-display);font-size:var(--t-4xl);text-transform:uppercase;line-height:1.05}
.ac-live .ac-straks b{font-family:var(--font-display);font-size:var(--t-2xl);text-transform:uppercase}
.ac-live small{text-transform:uppercase;letter-spacing:.06em;font-size:var(--t-xs);opacity:.8}
.ac-tijd{font-family:var(--font-mono,monospace);min-width:52px}
@media (max-width:720px){
  .ac-grid2,.ac-rij2{grid-template-columns:1fr}
  .ac-bord{grid-template-columns:1fr}
  .ac-prog{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 28px;grid-template-areas:"tijd duur x" "wat wat wat" "waar wie wie"}
  .ac-prog > :nth-child(1){grid-area:tijd}.ac-prog > :nth-child(2){grid-area:duur}.ac-prog > :nth-child(3){grid-area:wat}
  .ac-prog > :nth-child(4){grid-area:waar}.ac-prog > :nth-child(5){grid-area:wie}.ac-prog > :nth-child(6){grid-area:x}
  .ac-in.geld,.geld{width:84px}
  .ac-prog-kop{display:none}
  .ac-prog{padding-bottom:8px;border-bottom:1px solid var(--hair)}
  .ac-titel h1{font-size:var(--t-2xl)}
  .ac-kop .knop{padding-inline:10px}
  .ac-staat{display:none}
}
.ac-extra{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin:4px 0 6px}
.ac-extra-k{display:flex;gap:12px;align-items:flex-start;text-align:left;background:var(--card);color:var(--ink);border:1px solid var(--hair);border-radius:var(--r-m,14px);padding:12px 14px;font:inherit;cursor:pointer;min-height:64px}
.ac-extra-k:hover{border-color:var(--accent)}.ac-extra-k svg{flex-shrink:0;color:var(--accent);margin-top:2px}
.ac-extra-k span{display:flex;flex-direction:column;gap:2px}.ac-extra-k small{color:var(--ink-2);font-size:var(--t-sm,14px)}
${TN.TOERNOOI_CSS}${CS.SCHERM_CSS}${VB.VRIJWILLIGERS_CSS}`;
  document.head.appendChild(s);
}
