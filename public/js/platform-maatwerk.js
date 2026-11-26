/* ====================================================================
   PLATFORM › MAATWERK [20261121a] — onderdeel van het Platformcentrum (alleen de platformbeheerder).

   Drie dingen, alle drie bedoeld om per club snel te zien wat er anders is en dat aan te passen:
     1. Scherm Maatwerk: één tabel met alle clubs en alle onderdelen. Schakelen en limieten zetten in de
        tabel zelf, zien welke club afwijkt van de standaard voor nieuwe clubs, en de inrichting van een
        andere club (of de standaard) in één keer overnemen.
     2. Clubdetail › Overzicht: "Maatwerk voor deze club" (wat is hier anders, met een sprong naar het
        tabblad waar je het aanpast) en "Afspraken en wensen" (eigen notities van de eindbaas).
     3. Clubdetail › Mensen: welke rollen in de club bezet zijn en welke nog niet.

   De rekenregels staan in maatwerk-logica.js en rollen-bezetting.js (allebei zonder DOM, getest).
   Schrijven: onderdelen naar clubs/{id}.platformModules (zoals het tabblad Onderdelen en limieten),
   notities naar clubprofielen/{id}.maatwerk (rules: alleen de platformbeheerder).
   platform-centrum.js geeft bij init() zijn toestand P en zijn teken() mee. */
import { db, doc, getDoc, setDoc, serverTimestamp } from './firebase.js?v=20261011g';
import { esc, meld } from './state.js?v=20261127v';
import { ico } from './icons.js?v=20261127b';
import { BOUWEN } from './config.js?v=20261127v';
import { platformToegestaan, modulesVoorNieuweClub } from './onderdelen.js?v=20261127v';
import { ROLLEN as ROLNAMEN, eigenRolNaam } from './rolnamen.js?v=20261120c';
import { isStandaard as pdfIsStandaard, schoonProfiel as pdfSchoon } from './pdf-profiel.js?v=20261115e';
import { FASE_NAAM } from './platform-logica.js?v=20261111a';
import { ONDERDELEN, onderdeelOpId, waardenVan, standaardWaarden, patchNaar, patchTekst, controleerGetal, maatwerkRijen, filterMaatwerk, tellingPerOnderdeel,
  maatwerkOverzicht, schoonMaatwerk, wensErbij, wensZet, wensWeg, wensenGesorteerd, NOTITIE_MAX, WENS_MAX } from './maatwerk-logica.js?v=20261125m';
import { rolBezetting, bezettingRegel } from './rollen-bezetting.js?v=20261121a';

let P = null, teken = () => {}, laadTeams = () => {};
const M = {
  filter: 'alle', zoek: '',
  neem: null,            // { clubId, bron } : voorstel "neem over" dat op bevestigen wacht
  profiel: {},           // clubId → clubprofielen-document | 'bezig' | null (lezen mislukt)
  bezig: new Set(),      // clubId|sleutel die nu wordt opgeslagen
  concept: {},           // clubId → { mwNotitie, mwContact, mwWensNieuw }: wat getypt is en nog niet bewaard (teken() bouwt het scherm opnieuw op)
};
export function init(api){ P = api.P; teken = api.teken; laadTeams = api.laadTeams; }

const STANDAARD = '__standaard';
const standaard = () => modulesVoorNieuweClub(P.platform?.standaard);
const rijen = () => maatwerkRijen(P.clubs, P.docs, { toegestaan: platformToegestaan, standaard: standaard() });
const chip = (tekst, soort) => `<span class="pf-chip ${soort || ''}">${esc(tekst)}</span>`;
const sw = (aan, label, attrs, afwijkend) => `<button type="button" class="pc-sw ${afwijkend ? 'mw-anders' : ''}" role="switch" aria-checked="${aan === true}" aria-label="${esc(label)}" ${attrs}></button>`;
const foutTekst = x => x?.code === 'permission-denied' ? 'Firestore weigert dit. Zijn de nieuwste firestore.rules gedeployed?' : (x?.message || x?.code || 'onbekende fout');

/* ==================== 1. Scherm Maatwerk ==================== */
export function htmlMaatwerk(kop){
  const alle = rijen(), lijst = filterMaatwerk(alle, { filter: M.filter, zoek: M.zoek });
  const std = standaardWaarden(standaard()), tel = tellingPerOnderdeel(alle), afwijkend = alle.filter(r => r.afwijkend).length;
  const seg = (id, label, n) => `<button data-pc="mwfilter" data-filter="${id}" class="${M.filter === id ? 'actief' : ''}">${label} <small>${n}</small></button>`;
  const stdCel = o => o.soort === 'schakel' ? `<td class="mw-cel">${chip(std[o.id] ? 'aan' : 'uit', std[o.id] ? 'ok' : 'uit')}</td>` : `<td class="mw-cel r">${std[o.id] == null ? esc(o.leeg || '–') : esc(std[o.id])}</td>`;
  return `${kop('Maatwerk', 'Alle clubs en alle onderdelen in één tabel. Een wijziging geldt meteen voor die club. Een stip betekent: anders dan de standaard voor nieuwe clubs.')}
    <div class="pc-zoekrij">
      <input class="invoer" id="mwZoek" placeholder="Zoek club of plaats" value="${esc(M.zoek)}" autocomplete="off" aria-label="Zoek club of plaats">
      <div class="segment">${seg('alle', 'Alle', alle.length)}${seg('afwijkend', 'Wijkt af', afwijkend)}${seg('standaard', 'Standaard', alle.length - afwijkend)}</div>
    </div>
    <div class="pc-tabel-wrap mw-breed"><table class="pc-tabel mw-tabel">
      <thead><tr><th>Club</th>${ONDERDELEN.map(o => `<th class="${o.soort === 'getal' ? 'r' : 'mw-cel'}" title="${esc(o.uitleg || o.naam)}">${esc(o.kort)}${o.soort === 'schakel' ? `<small>${tel[o.id]} van ${alle.length}</small>` : ''}</th>`).join('')}<th>Overnemen</th></tr></thead>
      <tbody>
        <tr class="mw-std"><td class="pc-naam"><b>Standaard voor nieuwe clubs</b><small><button class="mw-link" data-pc="scherm" data-scherm="instellingen">Aanpassen in Instellingen</button></small></td>${ONDERDELEN.map(stdCel).join('')}<td></td></tr>
        ${lijst.length ? lijst.map(r => rijHtml(r, std, alle)).join('') : `<tr><td colspan="${ONDERDELEN.length + 2}" class="tc-leeg">Geen clubs in deze selectie.</td></tr>`}
      </tbody></table></div>
    <div class="mw-smal">${lijst.length ? lijst.map(kaartHtml).join('') : '<p class="tc-leeg-klein">Geen clubs in deze selectie.</p>'}
      <p class="tc-meta">Op een breder scherm staat hier de hele tabel, met schakelaars per onderdeel.</p></div>`;
}
function rijHtml(r, std, alle){
  const cel = o => {
    const w = r.waarden[o.id], anders = r.afwijkingen.some(a => a.id === o.id), druk = M.bezig.has(r.id + '|' + o.id);
    if (o.soort === 'schakel') return `<td class="mw-cel">${sw(w, `${o.naam} voor ${r.naam}`, `data-pc="mwschakel" data-club="${esc(r.id)}" data-sl="${o.id}" ${druk ? 'disabled' : ''}`, anders)}</td>`;
    const uit = o.id === 'aiLimiet' && !r.waarden.ai;
    return `<td class="mw-cel r"><input class="invoer pc-getal mw-getal ${anders ? 'mw-anders' : ''}" type="number" inputmode="numeric" min="${o.min}" max="${o.max}" data-mwnum="${o.id}" data-club="${esc(r.id)}"
      value="${w == null ? '' : esc(w)}" placeholder="${uit ? '–' : esc(o.leeg || '')}" aria-label="${esc(o.naam)} voor ${esc(r.naam)}" ${uit || druk ? 'disabled' : ''}>
      ${o.id === 'aiLimiet' && r.ai?.aan ? `<small class="mw-gebruik">${r.ai.maand || 0} gebruikt</small>` : ''}</td>`;
  };
  const voorstel = M.neem?.clubId === r.id ? neemVoorstel(r, alle) : '';
  return `<tr class="${r.afwijkend ? 'mw-afw' : ''}">
      <td class="pc-naam"><button class="mw-link mw-club" data-pc="mwclub" data-id="${esc(r.id)}"><b>${esc(r.naam)}</b></button>
        <small>${esc([r.plaats, FASE_NAAM[r.fase] || ''].filter(Boolean).join(' · '))}${r.afwijkend ? ` · <span class="mw-stip" aria-hidden="true"></span>${r.afwijkingen.length} anders` : ''}</small></td>
      ${ONDERDELEN.map(cel).join('')}
      <td><select class="invoer mw-neem" data-mwneem="${esc(r.id)}" aria-label="Inrichting overnemen voor ${esc(r.naam)}">
        <option value="">Neem over van…</option><option value="${STANDAARD}" ${M.neem?.clubId === r.id && M.neem.bron === STANDAARD ? 'selected' : ''}>De standaard</option>
        ${alle.filter(x => x.id !== r.id).map(x => `<option value="${esc(x.id)}" ${M.neem?.clubId === r.id && M.neem.bron === x.id ? 'selected' : ''}>${esc(x.naam)}</option>`).join('')}</select></td></tr>
    ${voorstel ? `<tr class="mw-voorstel"><td colspan="${ONDERDELEN.length + 2}">${voorstel}</td></tr>` : ''}`;
}
/* telefoon: per club wat er anders is; tikken opent het tabblad Onderdelen en limieten van die club */
function kaartHtml(r){
  return `<button class="pc-taak mw-kaart" data-pc="mwclub" data-id="${esc(r.id)}"><div class="pc-taak-tekst"><b>${esc(r.naam)}</b>
    <small>${esc([r.plaats, FASE_NAAM[r.fase] || ''].filter(Boolean).join(' · '))}</small>
    <span class="pc-chips">${r.afwijkend ? r.afwijkingen.map(a => chip(a.tekst, a.meer === false ? 'uit' : 'let')).join('') : chip('zoals de standaard', 'ok')}</span></div><span class="pijl" aria-hidden="true">›</span></button>`;
}
function doelVan(bron, alle){
  if (bron === STANDAARD) return { naam: 'de standaard', waarden: standaardWaarden(standaard()) };
  const b = alle.find(x => x.id === bron);
  return b ? { naam: b.naam, waarden: b.waarden } : null;
}
function neemVoorstel(r, alle){
  const doel = doelVan(M.neem.bron, alle); if (!doel) return '';
  const patch = patchNaar(r.waarden, doel.waarden), n = Object.keys(patch).length;
  if (!n) return `<div class="mw-voorstel-in"><span>${esc(r.naam)} is al ingericht zoals ${esc(doel.naam)}.</span><button class="knop licht klein" data-pc="mwneemweg">Sluiten</button></div>`;
  return `<div class="mw-voorstel-in"><span><b>${esc(r.naam)} inrichten zoals ${esc(doel.naam)}:</b> ${esc(patchTekst(patch))}.</span>
    <span class="pc-knoppen"><button class="knop licht klein" data-pc="mwneemweg">Annuleren</button><button class="knop fluo klein" data-pc="mwneemdoe">${n} wijziging${n === 1 ? '' : 'en'} toepassen</button></span></div>`;
}

/* schrijven naar clubs/{id}.platformModules; de toestand van het centrum (P.docs, P.clubs) loopt mee */
async function schrijfModules(clubId, patch){
  await setDoc(doc(db, 'clubs', clubId), { platformModules: patch }, { merge: true });
  const c = P.docs[clubId] || (P.docs[clubId] = { id: clubId });
  c.platformModules = { ...(c.platformModules || {}), ...patch };
  const k = P.clubs.find(x => x.id === clubId);
  if (k && ('ai' in patch || 'aiLimiet' in patch)) k.ai = { ...(k.ai || {}), ...('ai' in patch ? { aan: patch.ai } : {}), ...('aiLimiet' in patch ? { limiet: patch.aiLimiet || 0 } : {}) };
}
async function schakel(b){
  const clubId = b.dataset.club, sl = b.dataset.sl, o = onderdeelOpId(sl), c = P.docs[clubId] || { id: clubId };
  const nu = waardenVan(c, platformToegestaan)[sl], sleutel = clubId + '|' + sl;
  M.bezig.add(sleutel); b.disabled = true;
  try { await schrijfModules(clubId, { [sl]: !nu }); meld(`${o.naam} ${!nu ? 'aan' : 'uit'} voor ${c.naam || 'deze club'}`); }
  catch (x){ meld('Opslaan mislukt: ' + foutTekst(x)); }
  M.bezig.delete(sleutel); teken();
}
async function getal(inp){
  const clubId = inp.dataset.club, sl = inp.dataset.mwnum, o = onderdeelOpId(sl), c = P.docs[clubId] || { id: clubId };
  const r = controleerGetal(sl, inp.value);
  if (!r.ok){ meld(r.fout); return teken(); }
  if (r.waarde === waardenVan(c, platformToegestaan)[sl]) return;
  inp.disabled = true;
  try { await schrijfModules(clubId, { [sl]: r.waarde }); meld(`${o.naam} opgeslagen voor ${c.naam || 'deze club'}`); }
  catch (x){ meld('Opslaan mislukt: ' + foutTekst(x)); }
  teken();
}
async function neemDoe(b){
  const alle = rijen(), r = alle.find(x => x.id === M.neem?.clubId), doel = r && doelVan(M.neem.bron, alle);
  if (!r || !doel){ M.neem = null; return teken(); }
  const patch = patchNaar(r.waarden, doel.waarden);
  b.disabled = true;
  try { await schrijfModules(r.id, patch); meld(`${r.naam} is ingericht zoals ${doel.naam}`); M.neem = null; }
  catch (x){ meld('Overnemen mislukt: ' + foutTekst(x)); }
  teken();
}

/* ==================== 2. Clubdetail › Overzicht ==================== */
const profielRef = id => doc(db, 'clubprofielen', id);
async function laadProfiel(clubId){
  M.profiel[clubId] = 'bezig';
  try { const s = await getDoc(profielRef(clubId)); M.profiel[clubId] = s.exists() ? s.data() : {}; }
  catch (e){ console.warn('[maatwerk] clubprofiel lezen', clubId, e.code || e.message); M.profiel[clubId] = null; }
  if (P.lade?.clubId === clubId && P.lade.tab === 'overzicht') teken();
}
function profielVan(clubId){
  const p = M.profiel[clubId];
  if (p === undefined){ laadProfiel(clubId); return 'bezig'; }
  return p;
}
const eigenNamen = c => ROLNAMEN.map(([id, naam]) => { const e = eigenRolNaam(id, c); return e && e !== naam ? `${e} (${naam.toLowerCase()})` : ''; }).filter(Boolean);

export function htmlMaatwerkBlok(c){
  const p = profielVan(c.id), profiel = p && p !== 'bezig' ? p : null;
  const o = maatwerkOverzicht(c, { toegestaan: platformToegestaan, standaard: standaard(), profiel,
    pdfStandaard: pdfIsStandaard(pdfSchoon(c.platformModules?.pdfProfiel)), eigenRolNamen: eigenNamen(c) });
  return `<section class="mw-blok" aria-label="Maatwerk voor deze club">
      <div class="pc-blok-kop"><h2 class="tc-h2">Maatwerk voor deze club</h2><small>${o.eigen ? `${o.eigen} onderde${o.eigen === 1 ? 'el' : 'len'} op maat` : 'alles standaard'}</small></div>
      ${o.regels.map(r => `<button class="pc-taak mw-regel" data-pc="ladetab" data-tab="${r.tab}"><span class="mw-stip ${r.eigen ? '' : 'uit'}" aria-hidden="true"></span>
        <div class="pc-taak-tekst"><b>${esc(r.titel)}</b><small>${r.id === 'profiel' && p === 'bezig' ? 'Laden…' : esc(r.tekst)}</small></div><span class="pijl" aria-hidden="true">›</span></button>`).join('')}
      <p class="tc-meta">Huisstijl, werkwijze en lijsten zet de club zelf in haar instellingen. Jij past ze aan via Meehelpen of het Clubprofiel.</p>
    </section>
    ${htmlNotities(c, p)}`;
}
function htmlNotities(c, p){
  if (p === 'bezig') return `<section class="mw-blok"><h2 class="tc-h2">Afspraken en wensen</h2><p class="tc-leeg-klein">Laden…</p></section>`;
  if (p === null) return `<section class="mw-blok"><h2 class="tc-h2">Afspraken en wensen</h2><div class="pc-signaal">Je notities konden niet worden gelezen. Zijn de nieuwste firestore.rules gedeployed?</div></section>`;
  const m = schoonMaatwerk(p.maatwerk), wensen = wensenGesorteerd(m), open = wensen.filter(w => !w.klaar).length, k = M.concept[c.id] || {};
  const gewijzigd = (k.mwNotitie !== undefined && k.mwNotitie !== m.notitie) || (k.mwContact !== undefined && k.mwContact !== m.contact);
  return `<section class="mw-blok" aria-label="Afspraken en wensen">
      <div class="pc-blok-kop"><h2 class="tc-h2">Afspraken en wensen</h2><small>alleen jij ziet dit${open ? ` · ${open} open` : ''}</small></div>
      <label class="mw-veld"><span>Aanspreekpunt bij de club</span><input class="invoer" id="mwContact" maxlength="120" value="${esc(k.mwContact ?? m.contact)}" placeholder="Naam en functie" autocomplete="off"></label>
      <label class="mw-veld"><span>Notities</span><textarea class="invoer" id="mwNotitie" rows="4" maxlength="${NOTITIE_MAX}" placeholder="Wat is er met deze club afgesproken? Waar let je op?">${esc(k.mwNotitie ?? m.notitie)}</textarea></label>
      <div class="rij"><button class="knop ${gewijzigd ? 'fluo' : 'licht'} klein" data-pc="mwnotitie">${gewijzigd ? 'Notities opslaan' : 'Opgeslagen'}</button></div>
      <div class="mw-wensen">
        ${wensen.map(w => `<div class="mw-wens ${w.klaar ? 'klaar' : ''}"><label><input type="checkbox" data-mwwens="${esc(w.id)}" ${w.klaar ? 'checked' : ''}><span>${esc(w.tekst)}</span></label>
          <button class="tc-uit mw-wensweg" data-pc="mwwensweg" data-id="${esc(w.id)}" aria-label="Wens verwijderen: ${esc(w.tekst)}" title="Verwijderen">${ico('navigation-close', 16)}</button></div>`).join('') || '<p class="tc-leeg-klein">Nog geen wensen genoteerd.</p>'}
        <div class="mw-wens-nieuw"><input class="invoer" id="mwWensNieuw" maxlength="${WENS_MAX}" value="${esc(k.mwWensNieuw || '')}" placeholder="Wens of afspraak toevoegen" autocomplete="off" aria-label="Wens of afspraak toevoegen"><button class="knop licht klein" data-pc="mwwenserbij">Toevoegen</button></div>
      </div></section>`;
}
async function bewaarMaatwerk(clubId, nieuw, klaarTekst){
  const m = schoonMaatwerk(nieuw);
  try {
    await setDoc(profielRef(clubId), { clubId, maatwerk: m, maatwerkBijgewerkt: serverTimestamp() }, { merge: true });
    M.profiel[clubId] = { ...(M.profiel[clubId] && typeof M.profiel[clubId] === 'object' ? M.profiel[clubId] : {}), maatwerk: m };
    delete M.concept[clubId];
    if (klaarTekst) meld(klaarTekst);
  } catch (x){ meld('Opslaan mislukt: ' + foutTekst(x)); }
  teken();
}
/* wat nu in de velden staat gaat mee, zodat een wens afvinken een half getypte notitie niet weggooit */
function maatwerkNu(clubId){
  const p = M.profiel[clubId], m = schoonMaatwerk(p && typeof p === 'object' ? p.maatwerk : null);
  const k = M.concept[clubId] || {};
  return { ...m, notitie: k.mwNotitie ?? m.notitie, contact: k.mwContact ?? m.contact };
}

/* ==================== 3. Clubdetail › Mensen ==================== */
export function bezettingVan(k, c){
  const t = P.teams[k.id];
  if (!Array.isArray(t)) return null;
  const rn = Object.fromEntries(ROLNAMEN.map(([id]) => [id, eigenRolNaam(id, c)]));
  return rolBezetting(c, t, { bouwen: BOUWEN, rolNamen: rn, wachtend: k.wachtend || 0 });
}
/* één regel voor het tabblad Overzicht; laadt de teams als dat nog niet gebeurd is */
export function htmlRollenRegel(k, c){
  const t = P.teams[k.id];
  if (t === undefined) laadTeams(k.id);
  const b = bezettingVan(k, c);
  return `<button class="pc-taak mw-regel" data-pc="ladetab" data-tab="mensen"><span class="mw-stip ${b && !b.klaar ? '' : 'uit'}" aria-hidden="true"></span>
    <div class="pc-taak-tekst"><b>Rollen in de club</b><small>${b ? esc(bezettingRegel(b)) : t === null ? 'Teams lezen mislukt' : 'Laden…'}</small></div><span class="pijl" aria-hidden="true">›</span></button>`;
}
export function htmlMensen(k, c){
  const t = P.teams[k.id];
  if (t === undefined){ laadTeams(k.id); return '<p class="tc-leeg-klein">Rollen laden…</p>'; }
  if (t === null || t === 'bezig') return `<p class="tc-leeg-klein">${t === null ? 'Teams lezen mislukt. Zijn de nieuwste firestore.rules gedeployed?' : 'Rollen laden…'}</p>`;
  const b = bezettingVan(k, c);
  const rij = r => {
    const extra = r.soort === 'coach'
      ? [r.aantal ? `${r.aantal} coach${r.aantal === 1 ? '' : 'es'}` : '', r.teamsZonder.length ? `zonder coach: ${r.teamsZonder.slice(0, 8).join(', ')}${r.teamsZonder.length > 8 ? ` en ${r.teamsZonder.length - 8} meer` : ''}` : '', r.wachtend ? `${r.wachtend} wacht${r.wachtend === 1 ? '' : 'en'} op goedkeuring door de club` : ''].filter(Boolean).join(' · ')
      : (r.advies || '');
    return `<div class="pc-taak mw-rol"><span class="mw-vink ${r.bezet ? 'ok' : r.nodig ? 'open' : 'vrij'}" aria-hidden="true">${r.bezet ? ico('action-check', 14) : ''}</span>
      <div class="pc-taak-tekst"><b>${esc(r.naam)}</b><small>${esc(r.stand)}${extra ? ' · ' + esc(extra) : ''}</small><small class="mw-doet">${esc(r.doet)}</small></div>
      ${r.bezet ? chip('bezet', 'ok') : r.nodig ? chip('nog open', 'let') : chip('optioneel', 'uit')}</div>`;
  };
  return `<p class="tc-meta">Wie doet wat in ${esc(k.naam)}. De club wijst de rollen zelf toe; jij ziet hier hoe ver ze is. Namen van spelers staan hier niet.</p>
    <div class="pc-kpis pc-kpis-3"><div class="pc-kpi ${b.klaar ? '' : 'let'}"><div class="g">${b.bezet}<small>/${b.totaal}</small></div><div class="l">rollen bezet</div></div>
      <div class="pc-kpi"><div class="g">${b.rollen.find(r => r.soort === 'coach').aantal}</div><div class="l">coaches</div></div>
      <div class="pc-kpi ${k.wachtend ? 'let' : ''}"><div class="g">${k.wachtend || 0}</div><div class="l">wachten op de club</div></div></div>
    ${b.rollen.map(rij).join('')}
    ${b.klaar ? '' : `<div class="pc-signaal info"><b>Zo help je de club verder.</b> De clubbeheerder wijst rollen toe onder Club › Mensen en nodigt coaches uit met de teamlink. Loopt het vast, open de club dan via het tabblad Meehelpen.</div>`}`;
}

/* ==================== acties (aangeroepen door platform-centrum.js) ==================== */
export function klik(a, b){
  if (a === 'mwfilter'){ M.filter = b.dataset.filter; teken(); return true; }
  if (a === 'mwschakel'){ schakel(b); return true; }
  if (a === 'mwneemweg'){ M.neem = null; teken(); return true; }
  if (a === 'mwneemdoe'){ neemDoe(b); return true; }
  const clubId = P.lade?.clubId;
  if (a === 'mwnotitie'){ b.disabled = true; bewaarMaatwerk(clubId, maatwerkNu(clubId), 'Notities opgeslagen'); return true; }
  if (a === 'mwwenserbij'){
    const inp = P.el.querySelector('#mwWensNieuw'), tekst = inp ? inp.value.trim() : '';
    if (tekst && M.concept[clubId]) delete M.concept[clubId].mwWensNieuw;
    if (!tekst){ inp?.focus(); return true; }
    const metWens = wensErbij(maatwerkNu(clubId), tekst);
    bewaarMaatwerk(clubId, metWens, 'Wens toegevoegd'); return true;
  }
  if (a === 'mwwensweg'){ bewaarMaatwerk(clubId, wensWeg(maatwerkNu(clubId), b.dataset.id), 'Wens verwijderd'); return true; }
  return false;
}
export function invoer(e){
  if (e.target.id === 'mwZoek'){ M.zoek = e.target.value; const pos = e.target.selectionStart; teken(); const z = P.el.querySelector('#mwZoek'); if (z){ z.focus(); try { z.setSelectionRange(pos, pos); } catch (x) {} } return true; }
  if (['mwNotitie', 'mwContact', 'mwWensNieuw'].includes(e.target.id) && P.lade?.clubId){
    (M.concept[P.lade.clubId] ||= {})[e.target.id] = e.target.value;
    if (e.target.id !== 'mwWensNieuw'){ const b = P.el.querySelector('[data-pc="mwnotitie"]'); if (b){ b.textContent = 'Notities opslaan'; b.classList.add('fluo'); b.classList.remove('licht'); } }
    return true;
  }
  return false;
}
export function wijzig(e){
  const t = e.target;
  if (t.dataset?.mwnum){ getal(t); return true; }
  if (t.dataset?.mwneem){ M.neem = t.value ? { clubId: t.dataset.mwneem, bron: t.value } : null; teken(); return true; }
  if (t.dataset?.mwwens){ const clubId = P.lade?.clubId; bewaarMaatwerk(clubId, wensZet(maatwerkNu(clubId), t.dataset.mwwens, t.checked), t.checked ? 'Afgevinkt' : 'Weer open'); return true; }
  return false;
}
export function toetsEnter(e){
  if (e.key === 'Enter' && e.target.id === 'mwWensNieuw'){ e.preventDefault(); P.el.querySelector('[data-pc="mwwenserbij"]')?.click(); return true; }
  return false;
}
/* na Vernieuwen: gelezen profielen opnieuw ophalen */
export function wisCache(){ M.profiel = {}; M.neem = null; }
