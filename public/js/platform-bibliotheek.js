/* ==================== PLATFORM › BIBLIOTHEEK (alleen platformbeheerder) ====================
   [20261113d] Beheer van de trainingsvormen (goedgekeurde mockup "Cluppie Bibliotheek beheren",
   besluiten in claude/trainingsbibliotheek-beheer-impactanalyse.md):
     • zoeken, filteren, tekst en instellingen bewerken; tekening blijft die van de basis (tekeneditor: fase 2);
     • dupliceren als eigen vorm, uitzetten (met vervanger in geplande trainingen), terug naar de basis;
     • test in de planner, gebruik in trainingen;
     • Excel exporteren en importeren met controle vooraf;
     • bewaren voert de wijziging door in alle trainingen met deze vorm (ook gepland en zichtbaar),
       behalve trainingen die een coach zelf aanpaste (aangepast:true) en trainingen in het verleden.
   Gegevens: platform/bibliotheek/vormen/{id} (bibliotheek.js). Trainingen: collectionGroup 'trainingen'
   op vormIds; oude trainingen eerst één keer koppelen (knop bovenaan). Rules: zie firestore.rules [20261113d].
   Wordt getekend in het platformcentrum (platform-centrum.js) in <div id="pbRoot">. */
import { db, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, writeBatch } from './firebase.js?v=20261011g';
import { S, esc, meld } from './state.js?v=20261113b';
import { BASIS, BASIS_VERSIE, FASES, alleVormen, vormen, laadBibliotheek, verschilMetBasis, valideerVorm,
  rijVan, KOLOMMEN, LIJSTVELDEN, vergelijkImport } from './bibliotheek.js?v=20261113e';
import { herbouwOefening, bronVanOefening, vormIdsVan } from './seizoensplan-club.js?v=20261113e';
import { maakPlan } from './trainingsplanner.js?v=20261113b';
import { vormSvg, TEKENING_LEGENDA } from './trainingsvorm-svg.js?v=20261012e';

const FS_URL = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const B = { root: null, zoek: '', fase: '', leeftijd: 0, filter: 'alle', sel: null, tab: 'tekst', concept: null, toonMeer: false,
  dlg: null, bezig: false, test: null, gebruik: {}, koppeling: null, importLijst: null };
const kloon = x => JSON.parse(JSON.stringify(x));
const vandaagIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lt = v => `O${v.leeftijd?.[0]}–O${v.leeftijd?.[1]}`;
const vormRef = id => doc(db, 'platform', 'bibliotheek', 'vormen', id);

/* ---------- openen ---------- */
export async function toonBibliotheek(root){
  B.root = root;
  root.innerHTML = '<div class="tc-leeg">Bibliotheek laden…</div>';
  await laadBibliotheek(true);
  if (B.koppeling === null){
    try { const d = await getDoc(doc(db, 'platform', 'bibliotheek')); B.koppeling = d.exists() ? (d.data().koppelingMs || 0) : 0; }
    catch (e){ B.koppeling = 0; }
  }
  if (!B.sel || !alleVormen().some(v => v.id === B.sel)) B.sel = alleVormen()[0]?.id || null;
  B.concept = null;
  root.innerHTML = `<div class="pb">
    <div class="pc-kop"><div><h1 class="tc-h1">Bibliotheek</h1><p class="tc-meta">Basis ${esc(BASIS_VERSIE)} · ${BASIS.length} vormen in de app. Wat je hier aanpast gebruiken Training maken en de seizoensplanning.</p></div>
      <div class="pc-knoppen"><button class="knop licht klein" data-pb="export">Exporteer naar Excel</button><label class="knop licht klein pb-imp">Importeer Excel<input type="file" accept=".xlsx" data-pb="import" hidden></label><button class="knop klein" data-pb="nieuw">+ Nieuwe vorm</button></div></div>
    <div id="pbKoppel"></div>
    <div class="pb-twee"><section class="pb-lijst"><div class="pb-filters">
        <input class="invoer" id="pbZoek" placeholder="Zoek op naam, thema of doel" value="${esc(B.zoek)}" aria-label="Zoeken">
        <select class="invoer" id="pbFase" aria-label="Fase"><option value="">Alle fases</option>${FASES.map(f => `<option${B.fase === f ? ' selected' : ''}>${f}</option>`).join('')}</select>
        <select class="invoer" id="pbLeeftijd" aria-label="Leeftijd"><option value="">Alle leeftijden</option>${[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19].map(l => `<option value="${l}"${B.leeftijd === l ? ' selected' : ''}>O${l}</option>`).join('')}</select></div>
        <div class="pb-tellers" id="pbTellers"></div><div id="pbRijen"></div></section>
      <section class="pb-detail" id="pbDetail"></section></div>
    <div class="pb-dlg-achter" id="pbDlg" hidden><div class="pb-dlg" role="dialog" aria-modal="true" id="pbDlgIn"></div></div></div>`;
  root.addEventListener('click', klik);
  root.addEventListener('input', invoer);
  root.addEventListener('change', wijzig);
  tekenKoppel(); tekenLijst(); tekenDetail();
}

/* ---------- lijst ---------- */
function gefilterd(){
  const q = B.zoek.trim().toLowerCase();
  return alleVormen().filter(v => (B.filter === 'alle' || v._status === B.filter)
    && (!B.fase || v.fase === B.fase)
    && (!B.leeftijd || (B.leeftijd >= v.leeftijd[0] && B.leeftijd <= v.leeftijd[1]))
    && (!q || `${v.naam} ${v.doel} ${(v.thema || []).join(' ')} ${v.id}`.toLowerCase().includes(q)));
}
function tekenLijst(){
  const alle = alleVormen(), tel = { alle: alle.length, basis: 0, aangepast: 0, eigen: 0, uit: 0 };
  alle.forEach(v => tel[v._status]++);
  B.root.querySelector('#pbTellers').innerHTML = [['alle', 'Alle'], ['aangepast', 'Aangepast'], ['eigen', 'Eigen'], ['uit', 'Uit']]
    .map(([k, n]) => `<button class="tm-chip${B.filter === k ? ' aan' : ''}" data-pb="filter" data-k="${k}">${n} ${tel[k]}</button>`).join('');
  const r = gefilterd(), toon = B.toonMeer ? r : r.slice(0, 60);
  B.root.querySelector('#pbRijen').innerHTML = toon.map(v => `<button class="pb-rij${v.id === B.sel ? ' aan' : ''}${v._status === 'uit' ? ' uit' : ''}" data-pb="sel" data-id="${esc(v.id)}">
      <span class="pb-schets" aria-hidden="true">${v.tekening ? vormSvg(v, v.veld) : ''}</span>
      <span class="pb-rt"><b>${esc(v.naam)}</b><small>${esc(v.fase)} · ${lt(v)} · ${v.spelers?.min}–${v.spelers?.max} spelers${(v.thema || []).length ? ' · ' + esc(v.thema.slice(0, 2).join(', ')) : ''}</small></span>
      <span class="pb-st ${v._status}">${v._status}</span></button>`).join('')
    + (r.length > toon.length ? `<button class="knop licht vol" data-pb="meer">Toon alle ${r.length}</button>` : '')
    + (!r.length ? '<p class="tc-leeg">Niets gevonden.</p>' : '');
}

/* ---------- detail ---------- */
const huidige = () => alleVormen().find(v => v.id === B.sel) || null;
function concept(){
  const v = huidige(); if (!v) return null;
  if (!B.concept || B.concept.id !== v.id) B.concept = kloon(v);
  return B.concept;
}
function veld(label, sleutel, waarde, soort = 'input', extra = ''){
  const v = huidige(), b = v?._basis;
  const basisW = b ? waardeVan(b, sleutel) : null;
  const gew = b && JSON.stringify(basisW) !== JSON.stringify(waarde);
  const toon = Array.isArray(waarde) ? waarde.join('\n') : (waarde ?? '');
  const inv = soort === 'area' ? `<textarea class="invoer" rows="3" data-pbv="${sleutel}">${esc(toon)}</textarea>`
    : soort === 'fase' ? `<select class="invoer" data-pbv="${sleutel}">${FASES.map(f => `<option${f === waarde ? ' selected' : ''}>${f}</option>`).join('')}</select>`
    : `<input class="invoer" data-pbv="${sleutel}" value="${esc(toon)}"${extra}>`;
  const was = Array.isArray(basisW) ? basisW.join(' / ') : String(basisW ?? '');
  return `<div class="pb-f${gew ? ' gew' : ''}"><label>${label}</label>${inv}${gew ? `<div class="pb-was">Basis: ${esc(was.slice(0, 140))}${was.length > 140 ? '…' : ''} <button class="tm-chip tm-mini" data-pb="basisveld" data-k="${sleutel}">terug</button></div>` : ''}</div>`;
}
/* Een "sleutel" is een veldnaam of een pad (spelers.min, leeftijd.0). */
function waardeVan(v, k){ return k.split('.').reduce((a, x) => a == null ? a : a[x], v); }
function zetWaarde(v, k, w){
  const d = k.split('.'); let o = v;
  d.slice(0, -1).forEach(x => { o[x] = o[x] ?? (/^\d+$/.test(d[d.indexOf(x) + 1]) ? [] : {}); o = o[x]; });
  o[d.at(-1)] = w;
}
const GETALLEN = new Set(['leeftijd.0', 'leeftijd.1', 'spelers.min', 'spelers.ideaal', 'spelers.max', 'veld.b', 'veld.l', 'duur.ronde', 'intensiteit', 'complexiteit', 'materiaal.pionnen', 'materiaal.ballen', 'materiaal.hesjes', 'materiaal.doeltjes']);

function tekenDetail(){
  const el = B.root.querySelector('#pbDetail'), v = huidige();
  if (!v){ el.innerHTML = '<p class="tc-leeg">Kies een vorm.</p>'; return; }
  const c = concept(), fouten = valideerVorm(c), gewijzigd = JSON.stringify(verschilMetBasis(c, v)) !== '{}';
  let body = '';
  if (B.tab === 'tekst') body = veld('Naam', 'naam', c.naam) + veld('Doel (één zin)', 'doel', c.doel, 'area') + veld('Wat zeg je tegen de spelers', 'uitleg', c.uitleg || '', 'area')
    + LIJSTVELDEN.map(k => veld({ organisatie: 'Zo zet je het uit (één regel per stap)', regels: 'Regels', coachpunten: 'Coachpunten', coachvragen: 'Coachvragen', makkelijker: 'Makkelijker', moeilijker: 'Moeilijker', letOp: 'Let op' }[k], k, c[k] || [], 'area')).join('');
  if (B.tab === 'inst') body = `<div class="pb-drie">${veld('Fase', 'fase', c.fase, 'fase')}${veld('Leeftijd van (O..)', 'leeftijd.0', c.leeftijd?.[0], 'input', ' inputmode="numeric"')}${veld('Leeftijd tot', 'leeftijd.1', c.leeftijd?.[1], 'input', ' inputmode="numeric"')}</div>
    <div class="pb-drie">${veld('Spelers min', 'spelers.min', c.spelers?.min)}${veld('Ideaal', 'spelers.ideaal', c.spelers?.ideaal)}${veld('Max', 'spelers.max', c.spelers?.max)}</div>
    <div class="pb-drie">${veld('Veld breed (m)', 'veld.b', c.veld?.b)}${veld('Veld lang (m)', 'veld.l', c.veld?.l)}${veld('Minuten per ronde', 'duur.ronde', c.duur?.ronde)}</div>
    <div class="pb-drie">${veld('Zwaarte (1–3)', 'intensiteit', c.intensiteit)}${veld('Niveau (1–3)', 'complexiteit', c.complexiteit)}${veld('Voetbalecht (ja/nee)', 'voetbalecht', c.voetbalecht ? 'ja' : 'nee')}</div>
    ${veld('Thema’s (komma ertussen)', 'thema', (c.thema || []).join(', '))}
    <div class="pb-drie">${veld('Pionnen', 'materiaal.pionnen', c.materiaal?.pionnen || 0)}${veld('Ballen', 'materiaal.ballen', c.materiaal?.ballen || 0)}${veld('Doeltjes', 'materiaal.doeltjes', c.materiaal?.doeltjes || 0)}</div>`;
  if (B.tab === 'test') body = B.test?.id === c.id ? B.test.html : `<div class="pb-kaart"><p>Laat de planner per leeftijd 40 trainingen maken met deze vorm erbij, en zie hoe vaak hij gekozen wordt.</p><button class="knop klein" data-pb="test">Start de test</button></div>`;
  if (B.tab === 'gebruik') body = B.gebruik[c.id] ? htmlGebruik(B.gebruik[c.id]) : `<div class="pb-kaart"><p>Tel de trainingen waarin deze vorm staat.</p><button class="knop klein" data-pb="gebruik">Tellen</button></div>`;
  el.innerHTML = `<h2 class="pb-h2">${esc(c.naam || 'Nieuwe vorm')}</h2>
    <div class="pb-sub">${esc(c.fase)} · ${lt(c)} · <span class="pb-st ${v._status}">${v._status}</span> · id ${esc(c.id)}</div>
    ${c.tekening ? `<div class="pb-veld">${vormSvg(c, c.veld)}</div>${TEKENING_LEGENDA}` : '<div class="pb-kaart">Deze vorm heeft nog geen tekening. Dupliceer een vorm met een passende tekening om er een te krijgen; tekeningen bewerken komt in fase 2.</div>'}
    <div class="pb-checks">${fouten.length ? fouten.map(f => `<span class="pb-ck fout">${esc(f)}</span>`).join('') : '<span class="pb-ck">Alle controles gehaald</span>'}</div>
    <div class="tm-tabs pb-tabs">${[['tekst', 'Tekst'], ['inst', 'Instellingen'], ['test', 'Test in planner'], ['gebruik', 'Gebruik']].map(([k, n]) => `<button class="${B.tab === k ? 'aan' : ''}" data-pb="tab" data-k="${k}">${n}</button>`).join('')}</div>
    <div class="pb-body">${body}</div>
    <div class="pb-voet"><button class="knop" data-pb="bewaar"${!gewijzigd || fouten.length || B.bezig ? ' disabled' : ''}>Bewaar</button>
      <button class="knop licht" data-pb="dupliceer">Dupliceer als nieuwe vorm</button>
      <button class="knop licht" data-pb="uit">${v._status === 'uit' ? 'Zet weer aan' : 'Zet uit'}</button>
      ${v._status === 'aangepast' ? '<button class="knop licht" data-pb="herstel">Alles terug naar basis</button>' : ''}
      ${gewijzigd ? '<button class="knop licht" data-pb="annuleer">Wijzigingen weggooien</button>' : ''}</div>`;
}
function htmlGebruik(g){
  return `<div class="pb-kaart"><table class="pb-tabel">
    <tr><td>Teams met deze vorm</td><td>${g.teams}</td></tr><tr><td>Geplande trainingen (nog niet zichtbaar)</td><td>${g.gepland}</td></tr>
    <tr><td>Zichtbaar voor teams</td><td>${g.zichtbaar}</td></tr><tr><td>Door een coach zelf aangepast</td><td>${g.aangepast}</td></tr>
    <tr><td>Al gegeven</td><td>${g.gegeven}</td></tr></table>${B.koppeling ? '' : '<p class="pb-noot">Oudere trainingen tellen pas mee na "Trainingen koppelen" bovenaan.</p>'}</div>`;
}

/* ---------- trainingen met een vorm (doorvoeren) ---------- */
async function trainingenMet(vormId){
  const fs = await import(FS_URL);
  const snap = await getDocs(query(fs.collectionGroup(db, 'trainingen'), where('vormIds', 'array-contains', vormId)));
  const vandaag = vandaagIso(), uit = { lijst: [], gepland: 0, zichtbaar: 0, aangepast: 0, gegeven: 0, teams: new Set() };
  for (const d of snap.docs){
    const t = d.data();
    (t.teams || []).forEach(x => uit.teams.add(x));
    const eind = t.datum || (t.weekStart ? plus(t.weekStart, 6) : '');
    if (eind && eind < vandaag){ uit.gegeven++; continue; }
    if (t.aangepast === true){ uit.aangepast++; continue; }
    const zichtbaar = !t.zichtbaarVanaf || t.zichtbaarVanaf <= vandaag;
    zichtbaar ? uit.zichtbaar++ : uit.gepland++;
    uit.lijst.push({ ref: d.ref, data: t });
  }
  uit.teams = uit.teams.size;
  return uit;
}
function plus(iso, n){ const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/* Vervanger voor een uitgezette vorm: zelfde fase, overlappende leeftijd, dichtst bij het ideale aantal spelers. */
function vervangerVoor(v, al){
  const kand = vormen().filter(x => x.id !== v.id && x.fase === v.fase && !al.includes(x.id) && x.leeftijd[0] <= v.leeftijd[1] && x.leeftijd[1] >= v.leeftijd[0]);
  return kand.sort((a, b) => Math.abs((a.spelers?.ideaal || 0) - (v.spelers?.ideaal || 0)) - Math.abs((b.spelers?.ideaal || 0) - (v.spelers?.ideaal || 0))
    || ((b.thema || []).filter(t => (v.thema || []).includes(t)).length - (a.thema || []).filter(t => (v.thema || []).includes(t)).length))[0] || null;
}
async function voerDoor(vormId, nieuw, { uitzetten = false } = {}){
  const r = await trainingenMet(vormId);
  let n = 0;
  for (let i = 0; i < r.lijst.length; i += 400){
    const batch = writeBatch(db);
    for (const { ref, data } of r.lijst.slice(i, i + 400)){
      const al = vormIdsVan(data.oefeningen);
      const oef = (data.oefeningen || []).map(o => {
        const br = bronVanOefening(o, BASIS);
        if (br?.vormId !== vormId) return o;
        const doelVorm = uitzetten ? vervangerVoor(nieuw, al) : nieuw;
        return doelVorm ? herbouwOefening({ ...o, bron: br }, doelVorm, { thema: data.thema || '' }) : o;
      });
      batch.update(ref, { oefeningen: oef, vormIds: vormIdsVan(oef), bibliotheekBijgewerktMs: Date.now() });
      n++;
    }
    await batch.commit();
  }
  return n;
}

/* ---------- opslaan ---------- */
async function schrijfOverlay(v, { status } = {}){
  const basis = v._basis, velden = verschilMetBasis(v, basis);
  await setDoc(vormRef(v.id), { velden, status: status || (v._status === 'uit' ? 'uit' : 'aan'), eigen: !basis,
    gewijzigdDoor: S.user?.uid || null, gewijzigdMs: Date.now() });
}
async function bewaarDialoog(){
  const c = concept(); if (!c) return;
  if (valideerVorm(c).length) return meld('Los eerst de controles op');
  dlg('<p class="tc-leeg">Trainingen tellen…</p>');
  let r;
  try { r = await trainingenMet(c.id); } catch (e){ return dlg(`<h3>Tellen lukt niet</h3><p>${esc(e.code || e.message)}. Zijn de nieuwste firestore.rules en indexen gedeployed?</p><div class="pb-knoppen"><button class="knop licht" data-pb="sluit">Sluiten</button><button class="knop" data-pb="alleennieuw">Alleen opslaan</button></div>`); }
  const doel = r.gepland + r.zichtbaar;
  dlg(`<h3>Wijziging opslaan en doorvoeren?</h3><p>${esc(c.naam)} wordt overal bijgewerkt, ook in trainingen die al gepland zijn.</p>
    <div class="pb-cijfers"><div><b>${r.gepland}</b><small>geplande trainingen</small></div><div><b>${r.zichtbaar}</b><small>al zichtbaar voor teams</small></div><div><b>${r.teams}</b><small>teams</small></div></div>
    <ul class="pb-ul"><li><b>${r.aangepast}</b> training${r.aangepast === 1 ? '' : 'en'} die een coach zelf aanpaste blijven zoals ze zijn.</li><li><b>${r.gegeven}</b> al gegeven trainingen blijven ongewijzigd.</li>${B.koppeling ? '' : '<li>Oudere trainingen zijn nog niet gekoppeld; gebruik eerst "Trainingen koppelen" bovenaan om die ook mee te nemen.</li>'}</ul>
    <div class="pb-knoppen"><button class="knop licht" data-pb="sluit">Annuleren</button><button class="knop licht" data-pb="alleennieuw">Alleen nieuwe trainingen</button><button class="knop" data-pb="doorvoeren">Opslaan en ${doel} training${doel === 1 ? '' : 'en'} bijwerken</button></div>`);
}
async function opslaan(doorvoeren){
  const c = concept(), v = huidige(); if (!c || !v) return;
  B.bezig = true; dlg('<p class="tc-leeg">Bezig met opslaan…</p>');
  try {
    await schrijfOverlay({ ...c, _basis: v._basis, _status: v._status });
    await laadBibliotheek(true);
    let n = 0;
    if (doorvoeren) n = await voerDoor(c.id, alleVormen().find(x => x.id === c.id));
    B.concept = null; delete B.gebruik[c.id]; sluitDlg();
    meld(doorvoeren ? `Opgeslagen. ${n} training${n === 1 ? '' : 'en'} bijgewerkt.` : 'Opgeslagen. Bestaande trainingen blijven zoals ze zijn.');
  } catch (e){ dlg(`<h3>Opslaan mislukt</h3><p>${esc(e.code || e.message)}</p><div class="pb-knoppen"><button class="knop" data-pb="sluit">Sluiten</button></div>`); }
  B.bezig = false; tekenLijst(); tekenDetail();
}

/* ---------- uitzetten, terug naar basis, dupliceren ---------- */
async function uitDialoog(){
  const v = huidige(); if (!v) return;
  if (v._status === 'uit'){
    try { await setDoc(vormRef(v.id), { status: 'aan', gewijzigdMs: Date.now(), gewijzigdDoor: S.user?.uid || null }, { merge: true }); await laadBibliotheek(true); meld('Vorm staat weer aan'); }
    catch (e){ meld('Mislukt: ' + (e.code || e.message)); }
    tekenLijst(); tekenDetail(); return;
  }
  dlg('<p class="tc-leeg">Trainingen tellen…</p>');
  let r = { gepland: 0, zichtbaar: 0 };
  try { r = await trainingenMet(v.id); } catch (e) {}
  const verv = vervangerVoor(v, []);
  dlg(`<h3>${esc(v.naam)} uitzetten?</h3><p>De planner kiest deze vorm niet meer. In ${r.gepland + r.zichtbaar} geplande en zichtbare trainingen komt ${verv ? `<b>${esc(verv.naam)}</b> (of een andere passende vorm uit dezelfde fase)` : 'een passende vorm uit dezelfde fase'} ervoor in de plaats. Gegeven en door coaches aangepaste trainingen blijven zoals ze waren.</p>
    <div class="pb-knoppen"><button class="knop licht" data-pb="sluit">Annuleren</button><button class="knop" data-pb="uitok">Zet uit en vervang</button></div>`);
}
async function zetUit(){
  const v = huidige(); B.bezig = true; dlg('<p class="tc-leeg">Bezig…</p>');
  try {
    await setDoc(vormRef(v.id), { velden: verschilMetBasis(v, v._basis), status: 'uit', eigen: !v._basis, gewijzigdMs: Date.now(), gewijzigdDoor: S.user?.uid || null }, { merge: true });
    await laadBibliotheek(true);
    const n = await voerDoor(v.id, v, { uitzetten: true });
    sluitDlg(); meld(`Uitgezet. ${n} training${n === 1 ? '' : 'en'} kregen een vervanger.`);
  } catch (e){ dlg(`<h3>Mislukt</h3><p>${esc(e.code || e.message)}</p><div class="pb-knoppen"><button class="knop" data-pb="sluit">Sluiten</button></div>`); }
  B.bezig = false; tekenLijst(); tekenDetail();
}
async function herstel(){
  const v = huidige(); if (!v?._basis) return;
  B.bezig = true; dlg('<p class="tc-leeg">Bezig…</p>');
  try { await deleteDoc(vormRef(v.id)); await laadBibliotheek(true); const n = await voerDoor(v.id, v._basis); sluitDlg(); meld(`Terug naar de basis. ${n} training${n === 1 ? '' : 'en'} bijgewerkt.`); }
  catch (e){ dlg(`<h3>Mislukt</h3><p>${esc(e.code || e.message)}</p><div class="pb-knoppen"><button class="knop" data-pb="sluit">Sluiten</button></div>`); }
  B.bezig = false; B.concept = null; tekenLijst(); tekenDetail();
}
async function dupliceer(bron){
  const v = bron || concept(); if (!v) return;
  const id = 'eigen_' + String(v.naam || 'vorm').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '_' + Date.now().toString(36);
  const nieuw = { ...kloon(v), id, naam: (v.naam || 'Vorm') + ' (kopie)' };
  for (const k of Object.keys(nieuw)) if (k.startsWith('_') || k === 'id' || nieuw[k] === undefined) delete nieuw[k];
  try { await setDoc(vormRef(id), { velden: nieuw, status: 'aan', eigen: true, gewijzigdDoor: S.user?.uid || null, gewijzigdMs: Date.now() }); }
  catch (e){ return meld('Dupliceren mislukt: ' + (e.code || e.message)); }
  await laadBibliotheek(true);
  B.sel = id; B.concept = null; B.tab = 'tekst'; tekenLijst(); tekenDetail();
  meld('Kopie gemaakt. Pas de naam en tekst aan en bewaar.');
}

/* ---------- test in de planner ---------- */
function test(){
  const c = concept(); if (!c) return;
  B.test = { id: c.id, html: '<p class="tc-leeg">De planner draait…</p>' }; tekenDetail();
  setTimeout(() => {
    const lijst = [...vormen().filter(x => x.id !== c.id), { ...c, _status: 'aan' }];
    const leeftijden = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17].filter(l => l >= c.leeftijd[0] - 1 && l <= c.leeftijd[1] + 1);
    const themas = (c.thema || []).length ? c.thema : [...new Set(lijst.flatMap(v => v.thema || []))].slice(0, 4);
    const rij = l => {
      if (l < c.leeftijd[0] || l > c.leeftijd[1]) return `<tr><td>O${l}</td><td>valt buiten de leeftijd</td></tr>`;
      let n = 0;
      for (let i = 0; i < 40; i++){
        try {
          const p = maakPlan(lijst, { categorie: 'O' + l, leeftijd: l, aantalSpelers: [8, 10, 12, 14, 16][i % 5], niveau: 1 + (i % 3), duur: l <= 8 ? 45 : l <= 11 ? 60 : 75,
            thema: themas[i % themas.length], blokFase: ['Ontdek', 'Verdiep', 'Pas toe', 'Wedstrijd'][i % 4], seed: 'pb' + i, recent: [] });
          if ([...p.onderdelen, p.afsluiting].some(o => o?.vormId === c.id)) n++;
        } catch (e) {}
      }
      return `<tr><td>O${l}</td><td>${n} van 40 trainingen</td></tr>`;
    };
    B.test = { id: c.id, html: `<div class="pb-kaart"><b>Waar komt deze vorm terecht?</b><table class="pb-tabel">${leeftijden.map(rij).join('')}
      <tr><td>Bij 6 spelers</td><td>${(c.spelers?.min || 0) <= 6 ? 'past' : `past niet (minimum ${c.spelers?.min})`}</td></tr></table>
      <p class="pb-noot">Per leeftijd 40 trainingen met 8 tot 16 spelers, alle niveaus en de thema's ${esc(themas.join(', '))}. Bewaar eerst om het effect van wijzigingen echt in Training maken te zien.</p><button class="knop licht klein" data-pb="test">Opnieuw</button></div>` };
    tekenDetail();
  }, 30);
}

/* ---------- oude trainingen koppelen (eenmalig) ---------- */
function tekenKoppel(){
  const el = B.root.querySelector('#pbKoppel');
  el.innerHTML = B.koppeling ? '' : `<div class="pb-kaart pb-koppel"><b>Eenmalig: bestaande trainingen koppelen</b>
    <p>Trainingen die vóór vandaag zijn gemaakt weten nog niet welke vormen erin staan. Koppel ze één keer, dan worden wijzigingen ook daarin doorgevoerd.</p>
    <button class="knop klein" data-pb="koppel">Trainingen koppelen</button></div>`;
}
async function koppel(knop){
  knop.disabled = true; knop.textContent = 'Bezig…';
  try {
    const fs = await import(FS_URL);
    const snap = await getDocs(fs.collectionGroup(db, 'trainingen'));
    const te = snap.docs.filter(d => !Array.isArray(d.data().vormIds) && Array.isArray(d.data().oefeningen) && d.data().oefeningen.length);
    let n = 0;
    for (let i = 0; i < te.length; i += 400){
      const batch = writeBatch(db);
      for (const d of te.slice(i, i + 400)){
        const oef = d.data().oefeningen.map(o => { const br = bronVanOefening(o, BASIS); return br ? { ...o, bron: br } : o; });
        const ids = vormIdsVan(oef);
        if (!ids.length) continue;
        batch.update(d.ref, { oefeningen: oef, vormIds: ids, bibliotheekBijgewerktMs: Date.now() }); n++;
      }
      await batch.commit();
    }
    await setDoc(doc(db, 'platform', 'bibliotheek'), { koppelingMs: Date.now() }, { merge: true });
    B.koppeling = Date.now(); tekenKoppel();
    meld(`${n} training${n === 1 ? '' : 'en'} gekoppeld (van ${snap.size}).`);
  } catch (e){ knop.disabled = false; knop.textContent = 'Trainingen koppelen'; meld('Koppelen mislukt: ' + (e.code || e.message)); }
}

/* ---------- Excel ---------- */
let excelLaden = null;
function laadExcel(){
  if (window.ExcelJS) return Promise.resolve();
  return excelLaden || (excelLaden = new Promise((ok, fout) => { const s = document.createElement('script'); s.src = 'vendor/exceljs.min.js'; s.onload = ok; s.onerror = () => { excelLaden = null; fout(new Error('Excel-bibliotheek laden mislukt')); }; document.head.appendChild(s); }));
}
async function exporteer(knop){
  knop.disabled = true;
  try {
    await laadExcel();
    const wb = new window.ExcelJS.Workbook(), ws = wb.addWorksheet('Vormen');
    ws.columns = KOLOMMEN.map(([k]) => ({ header: k, key: k, width: LIJSTVELDEN.includes(k) || ['doel', 'uitleg'].includes(k) ? 50 : k === 'naam' ? 34 : 14 }));
    alleVormen().forEach(v => ws.addRow(rijVan(v)));
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];
    ws.eachRow((r, i) => { if (i > 1) r.alignment = { wrapText: true, vertical: 'top' }; });
    const uitleg = wb.addWorksheet('Uitleg');
    [['Zo werkt het'], ['Pas waarden aan in het blad Vormen en importeer het bestand in Platform › Bibliotheek.'], ['id: laat staan. Een nieuwe rij zonder id wordt een eigen vorm (zonder tekening).'],
      ['status: aan of uit.'], ['Lijsten (organisatie, regels, coachpunten…): één regel per punt in dezelfde cel (Alt+Enter).'], ['fase: ' + FASES.join(', ')], ['Tekeningen gaan niet mee in Excel; die blijven bij het id.']].forEach(r => uitleg.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `cluppie-bibliotheek-${vandaagIso()}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e){ meld('Exporteren mislukt: ' + (e.message || e)); }
  knop.disabled = false;
}
async function importeer(input){
  const f = input.files?.[0]; input.value = ''; if (!f) return;
  dlg('<p class="tc-leeg">Bestand lezen…</p>');
  try {
    await laadExcel();
    const wb = new window.ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer());
    const ws = wb.getWorksheet('Vormen') || wb.worksheets[0];
    const kop = []; ws.getRow(1).eachCell((c, i) => { kop[i] = String(c.value || '').trim(); });
    const rijen = [];
    ws.eachRow((r, i) => { if (i === 1) return; const o = {}; r.eachCell({ includeEmpty: true }, (c, j) => { if (kop[j]) { const w = c.value; o[kop[j]] = w && typeof w === 'object' && 'richText' in w ? w.richText.map(x => x.text).join('') : w && typeof w === 'object' && 'text' in w ? w.text : w; } }); rijen.push(o); });
    B.importLijst = vergelijkImport(rijen, alleVormen());
    const z = B.importLijst.filter(x => x.soort !== 'gelijk');
    const tel = s => B.importLijst.filter(x => x.soort === s).length;
    const label = { gewijzigd: 'gewijzigd', nieuw: 'nieuw', status: 'aan/uit', fout: 'fout, overgeslagen' };
    dlg(`<h3>Importeer Excel: controle</h3><p>${esc(f.name)} gelezen: ${B.importLijst.length} rijen. Eerst nakijken, pas daarna opslaan.</p>
      <div class="pb-scroll"><table class="pb-tabel">${z.slice(0, 80).map(x => `<tr><td>${esc(x.naam || x.id)}</td><td>${x.soort === 'fout' ? esc(x.fouten.join(', ')) : x.soort === 'gewijzigd' ? esc(x.velden.join(', ')) : x.soort === 'status' ? (x.status === 'uit' ? 'uitzetten' : 'aanzetten') : 'nieuwe vorm'}</td><td><span class="pb-st ${x.soort === 'fout' ? 'uit' : x.soort === 'nieuw' ? 'eigen' : 'aangepast'}">${label[x.soort]}</span></td></tr>`).join('') || '<tr><td>Geen wijzigingen gevonden.</td></tr>'}</table></div>
      <p class="pb-noot">Gewijzigde vormen worden na opslaan ook in de geplande trainingen doorgevoerd (behalve door coaches aangepaste en al gegeven trainingen).</p>
      <div class="pb-knoppen"><button class="knop licht" data-pb="sluit">Annuleren</button><button class="knop" data-pb="importok"${tel('gewijzigd') + tel('nieuw') + tel('status') ? '' : ' disabled'}>Opslaan (${tel('gewijzigd')} gewijzigd, ${tel('nieuw')} nieuw${tel('status') ? ', ' + tel('status') + ' aan/uit' : ''})</button></div>`);
  } catch (e){ dlg(`<h3>Importeren mislukt</h3><p>${esc(e.message || e)}</p><div class="pb-knoppen"><button class="knop" data-pb="sluit">Sluiten</button></div>`); }
}
async function importOpslaan(){
  const lijst = (B.importLijst || []).filter(x => ['gewijzigd', 'nieuw', 'status'].includes(x.soort));
  dlg('<p class="tc-leeg">Opslaan en doorvoeren…</p>');
  let n = 0;
  try {
    const per = new Map(alleVormen().map(v => [v.id, v]));
    for (const x of lijst){
      const oud = per.get(x.id);
      const vorm = { ...x.vorm, id: x.id };
      await setDoc(vormRef(x.id), { velden: verschilMetBasis(vorm, oud?._basis || null), status: x.status, eigen: !oud?._basis, gewijzigdDoor: S.user?.uid || null, gewijzigdMs: Date.now() });
    }
    await laadBibliotheek(true);
    for (const x of lijst) if (x.soort !== 'nieuw'){
      const v = alleVormen().find(y => y.id === x.id);
      n += await voerDoor(x.id, v, { uitzetten: x.status === 'uit' });
    }
    sluitDlg(); meld(`Import opgeslagen: ${lijst.length} vormen, ${n} trainingen bijgewerkt.`);
  } catch (e){ dlg(`<h3>Opslaan mislukt</h3><p>${esc(e.code || e.message)}</p><div class="pb-knoppen"><button class="knop" data-pb="sluit">Sluiten</button></div>`); }
  B.importLijst = null; B.concept = null; tekenLijst(); tekenDetail();
}

/* ---------- dialoog ---------- */
function dlg(html){ const a = B.root.querySelector('#pbDlg'); B.root.querySelector('#pbDlgIn').innerHTML = html; a.hidden = false; a.querySelector('button')?.focus(); }
function sluitDlg(){ const a = B.root.querySelector('#pbDlg'); if (a) a.hidden = true; }

/* ---------- gebeurtenissen ---------- */
async function klik(e){
  if (e.target.id === 'pbDlg' && !B.bezig) return sluitDlg();
  const b = e.target.closest('[data-pb]'); if (!b || b.disabled || b.tagName === 'INPUT') return;
  const a = b.dataset.pb;
  if (a === 'sel'){ B.sel = b.dataset.id; B.concept = null; tekenLijst(); tekenDetail(); B.root.querySelector('#pbDetail').scrollTop = 0; }
  else if (a === 'filter'){ B.filter = b.dataset.k; tekenLijst(); }
  else if (a === 'meer'){ B.toonMeer = true; tekenLijst(); }
  else if (a === 'tab'){ B.tab = b.dataset.k; tekenDetail(); }
  else if (a === 'basisveld'){ const v = huidige(); zetWaarde(concept(), b.dataset.k, kloon(waardeVan(v._basis, b.dataset.k))); tekenDetail(); }
  else if (a === 'annuleer'){ B.concept = null; tekenDetail(); }
  else if (a === 'bewaar') bewaarDialoog();
  else if (a === 'doorvoeren') opslaan(true);
  else if (a === 'alleennieuw') opslaan(false);
  else if (a === 'sluit') sluitDlg();
  else if (a === 'dupliceer') dupliceer();
  else if (a === 'uit') uitDialoog();
  else if (a === 'uitok') zetUit();
  else if (a === 'herstel') herstel();
  else if (a === 'nieuw') dupliceer({ ...kloon(vormen().find(v => v.fase === 'spelvorm') || vormen()[0]), naam: 'Nieuwe vorm', doel: 'Vul het doel in', _basis: null });
  else if (a === 'test') test();
  else if (a === 'gebruik'){ b.disabled = true; try { B.gebruik[B.sel] = await trainingenMet(B.sel); } catch (err){ meld('Tellen mislukt: ' + (err.code || err.message)); } tekenDetail(); }
  else if (a === 'koppel') koppel(b);
  else if (a === 'export') exporteer(b);
  else if (a === 'importok') importOpslaan();
}
function invoer(e){
  if (e.target.id === 'pbZoek'){ B.zoek = e.target.value; tekenLijst(); return; }
  const k = e.target.dataset.pbv; if (!k) return;
  const c = concept(), w = e.target.value;
  if (LIJSTVELDEN.includes(k)) c[k] = w.split('\n').map(s => s.trim()).filter(Boolean);
  else if (k === 'thema') c.thema = w.split(',').map(s => s.trim()).filter(Boolean);
  else if (k === 'voetbalecht') c.voetbalecht = /^(ja|j|true|1)$/i.test(w.trim());
  else if (GETALLEN.has(k)) zetWaarde(c, k, w.trim() === '' ? null : Number(w.replace(',', '.')));
  else zetWaarde(c, k, w);
  werkKnoppenBij();
}
/* Bewaar-knop en controles bijwerken zonder het formulier opnieuw te tekenen (focus en klik blijven werken). */
function werkKnoppenBij(){
  const c = concept(), v = huidige(); if (!c || !v) return;
  const fouten = valideerVorm(c), gewijzigd = JSON.stringify(verschilMetBasis(c, v)) !== '{}';
  const k = B.root.querySelector('[data-pb="bewaar"]'); if (k) k.disabled = !gewijzigd || !!fouten.length || B.bezig;
  const ck = B.root.querySelector('.pb-checks');
  if (ck) ck.innerHTML = fouten.length ? fouten.map(f => `<span class="pb-ck fout">${esc(f)}</span>`).join('') : '<span class="pb-ck">Alle controles gehaald</span>';
}
function wijzig(e){
  if (e.target.id === 'pbFase'){ B.fase = e.target.value; tekenLijst(); return; }
  if (e.target.id === 'pbLeeftijd'){ B.leeftijd = Number(e.target.value) || 0; tekenLijst(); return; }
  if (e.target.dataset.pb === 'import') return importeer(e.target);
  if (e.target.dataset.pbv) invoer(e);
}
