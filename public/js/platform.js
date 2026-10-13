/* ====================================================================
   PLATFORM — overzicht van alle clubs (alleen platformbeheerder)
   Leest clubs/ en aanvragen/ zonder filter; de Firestore-regels laten dat
   alleen de platformbeheerder toe. Voor een club openen: openClub() (de
   regels geven de platformbeheerder daar volledige rechten).
==================================================================== */
import { db, collection, getDocs, doc, getDoc, setDoc, serverTimestamp, query, where, functions, httpsCallable } from './firebase.js?v=20261011g';
import { S, esc, meld, openModal, sluitModal, isPlatformBeheerder } from './state.js?v=20261011g';
import { logoImgVoorDoc, DISTRICTEN, kalenderId, valideerKalender, ORIGINEEL } from './clubconfig.js?v=20261013b';
import { STARTLIJST_STAPPEN } from './startlijst.js?v=20261011d';
import { BEHEERD, NAMEN as ONDERDEEL_NAMEN, platformToegestaan } from './onderdelen.js?v=20261013b';

/* [20261011d] Platformdashboard: eigen breed scherm i.p.v. een lijstje.
   Bron: platformstats/overzicht (Cloud Function platformOverzichtNu / nachtelijk), met
   per club stoplicht, signalen en kerncijfers. Zonder dat document (functions nog niet
   gedeployed) valt het scherm terug op de clublijst die we zelf kunnen lezen. */

const telKeys = o => Object.keys(o || {}).length;
const datum = t => {
  try { const d = t && t.toDate ? t.toDate() : (typeof t === 'number' ? new Date(t) : null); return d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  catch (e) { return ''; }
};
const dagenGeleden = iso => iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null;
const relatief = iso => {
  const d = dagenGeleden(iso);
  if (d == null) return 'nooit';
  if (d <= 0) return 'vandaag';
  if (d === 1) return 'gisteren';
  return `${d} dagen geleden`;
};
const STAP_NAAM = Object.fromEntries(STARTLIJST_STAPPEN.map(s => [s.id, s.titel]));
const PF = { filter: 'alle', zoek: '' };
/* [20261013b] eindbaas-keuze per club (Training maken / Seizoensplanning): { clubId: { platformModules, gemaakt } } */
let PM = null;
async function leesPlatformModules(){
  try {
    const cs = await getDocs(collection(db, 'clubs')); const m = {};
    cs.docs.forEach(d => { const c = d.data(); m[d.id] = { platformModules: c.platformModules || {}, gemaakt: c.gemaakt || null }; });
    return m;
  } catch (e) { console.warn('[platform] onderdelen lezen mislukt', e.code || e.message); return null; }
}
async function zetPlatformModule(clubId, sleutel, waarde){
  await setDoc(doc(db, 'clubs', clubId), { platformModules: { [sleutel]: waarde } }, { merge: true });
  PM[clubId] = { ...PM[clubId], platformModules: { ...(PM[clubId]?.platformModules || {}), [sleutel]: waarde } };
}
function onderdelenRij(k){
  if (!PM || !PM[k.id]) return '';
  return `<div class="pf-onderdelen">${BEHEERD.map(sl => { const aan = platformToegestaan(PM[k.id], sl);
    return `<button type="button" class="pf-onderdeel ${aan ? 'aan' : ''}" data-pf-od="${esc(k.id)}|${sl}" aria-pressed="${aan}" aria-label="${esc(ONDERDEEL_NAMEN[sl])} ${aan ? 'aan' : 'uit'} voor ${esc(k.naam)}">${esc(ONDERDEEL_NAMEN[sl])}: ${aan ? 'aan' : 'uit'}</button>`; }).join('')}</div>`;
}

async function leesOverzicht(){
  try { const s = await getDoc(doc(db, 'platformstats', 'overzicht')); return s.exists() ? s.data() : null; }
  catch (e) { console.warn('[platform] overzicht lezen mislukt', e.code || e.message); return null; }
}
/* Terugval: alleen wat de client zelf kan lezen (clubs + aanvragen), zonder stoplicht. */
async function leesTerugval(){
  const cs = await getDocs(collection(db, 'clubs'));
  const wacht = {};
  try { (await getDocs(collection(db, 'aanvragen'))).docs.forEach(d => { const c = d.data().clubId; if (c) wacht[c] = (wacht[c] || 0) + 1; }); } catch (e) {}
  const clubs = cs.docs.map(d => {
    const c = d.data();
    return { id: d.id, naam: c.naam || 'Club zonder naam', plaats: c.instellingen?.locatie?.plaats || '', teams: telKeys(c.teams), leden: telKeys(c.leden),
      admins: telKeys(c.admins), wachtend: wacht[d.id] || 0, gemaakt: c.gemaakt, status: 'onbekend', signalen: [], _doc: c };
  }).sort((a, b) => a.naam.localeCompare(b.naam));
  return { clubs, totalen: { clubs: clubs.length, teams: clubs.reduce((n, c) => n + c.teams, 0), wachtend: Object.values(wacht).reduce((n, x) => n + x, 0) }, terugval: true };
}
async function leesAanmeldingen(){
  try { return (await getDocs(query(collection(db, 'clubAanmeldingen'), where('status', '==', 'nieuw')))).docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { return []; }
}

export async function openPlatform(){
  if (!isPlatformBeheerder()) return;
  openModal('<h2>Platform</h2><div class="kaart leeg">Cijfers laden…</div>', { vorm: 'breed' });
  let o = await leesOverzicht();
  if (!o){
    try { o = await leesTerugval(); }
    catch (e) {
      console.error('[Cluppie] Platformoverzicht kon niet laden:', e.code, e.message);
      openModal('<h2>Platform</h2><div class="kaart leeg">Clubs laden mislukt' + (e.code === 'permission-denied' ? ': Firestore weigert het lezen. Controleer of de nieuwste firestore.rules zijn gedeployed en of je e-mailadres geverifieerd is.' : ' (' + esc(e.code || e.message || 'onbekende fout') + ').') + '</div>', { vorm: 'breed' });
      return;
    }
  }
  const aanmeldingen = await leesAanmeldingen();
  PM = await leesPlatformModules();
  tekenPlatform(o, aanmeldingen);
}

function kpi(getal, label, sub, toon){
  return `<div class="pf-kpi ${toon || ''}"><div class="g">${getal}</div><div class="l">${esc(label)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div>`;
}
function chip(tekst, soort){ return `<span class="pf-chip ${soort || ''}">${esc(tekst)}</span>`; }

function clubRij(k){
  const sl = k.sportlink || {}, pv = k.privacy || {}, ai = k.ai || {}, st = k.startlijst || {};
  const chips = [];
  if (k.terugvalRij) chips.push(chip(`${k.teams} teams · ${k.leden} leden`));
  else {
    chips.push(chip(sl.gekoppeld ? (sl.fouten ? `Sportlink: ${sl.fouten} fout` : 'Sportlink ✓') : 'geen Sportlink', sl.gekoppeld ? (sl.fouten ? 'let' : 'ok') : 'uit'));
    chips.push(chip(pv.vo ? 'VO ✓' : 'geen VO', pv.vo ? 'ok' : 'let'));
    if (pv.totaal) chips.push(chip(`privacy ${pv.akkoord}/${pv.totaal}`, pv.akkoord === pv.totaal ? 'ok' : ''));
    chips.push(chip(`start ${st.gedaan || 0}/${st.totaal || 7}`, st.gedaan === st.totaal ? 'ok' : ''));
    if (ai.aan) chips.push(chip(`AI ${ai.maand || 0}${ai.limiet ? '/' + ai.limiet : ''}`, ai.limiet && ai.maand >= ai.limiet * 0.9 ? 'let' : ''));
  }
  const signalen = (k.signalen || []).map(s => `<div class="pf-sig ${s.niveau}">${esc(s.tekst)}</div>`).join('');
  const open = (st.open || []).length && st.gedaan < st.totaal
    ? `<div class="pf-open">Nog te doen: ${st.open.map(x => esc(STAP_NAAM[x] || x)).join(' · ')}</div>` : '';
  const logo = k._doc ? logoImgVoorDoc({ id: k.id, ...k._doc }, 'club-schild') : '';
  return `<div class="pf-club" data-status="${esc(k.status || 'onbekend')}">
    <button class="pf-club-kop" data-platform-club="${esc(k.id)}">
      <span class="pf-licht ${esc(k.status || 'onbekend')}" aria-label="status ${esc(k.status || 'onbekend')}"></span>
      ${logo ? `<span class="club-shirt">${logo}</span>` : ''}
      <span class="pf-naam"><b>${esc(k.naam)}</b><small>${esc([k.plaats, k.teams != null && !k.terugvalRij ? k.teams + ' teams' : '', k.gemaakt ? 'sinds ' + datum(k.gemaakt) : ''].filter(Boolean).join(' · '))}</small></span>
      ${k.terugvalRij ? '' : `<span class="pf-act"><b>${k.sessies30 || 0}</b><small>sessies 30d</small></span>
      <span class="pf-act"><b>${k.coaches30 || 0}</b><small>coaches 30d</small></span>
      <span class="pf-act breed"><b>${esc(relatief(k.laatsteGebruik))}</b><small>laatst gebruikt</small></span>`}
      ${k.wachtend ? `<span class="club-badge">${k.wachtend} wacht${k.wachtend === 1 ? '' : 'en'}</span>` : ''}
      <span class="pijl">›</span>
    </button>
    <div class="pf-chips">${chips.join('')}</div>${onderdelenRij(k)}${signalen}${open}
  </div>`;
}

function aanmeldKaart(a){
  return `<div class="pf-aanmeld">
    ${a.logo ? `<img class="pf-aanmeld-logo" src="${esc(a.logo)}" alt="">` : ''}
    <div><b>${esc(a.clubNaam || '')}</b>${a.sportlinkClientId ? ' <span class="pf-sl" title="Gevonden met de Sportlink Client ID; de club krijgt meteen koppeling, logo en kleur">via Sportlink</span>' : ''} <small>${esc([a.plaats, a.district && (DISTRICTEN.find(d => d.id === a.district)?.naam || a.district), a.aantalTeams ? a.aantalTeams + ' teams' : ''].filter(Boolean).join(' · '))}</small></div>
    <div class="pf-aanmeld-meta">${esc(a.contactNaam || '')}${a.rol ? ' (' + esc(a.rol) + ')' : ''} · ${esc(a.contactEmail || '')}${a.gemaakt ? ' · ' + esc(datum(a.gemaakt)) : ''}</div>
    ${a.bericht ? `<div class="pf-aanmeld-bericht">${esc(a.bericht)}</div>` : ''}
    <div class="rij" style="margin-top:8px">
      <button class="knop licht klein" data-aanmeld-af="${esc(a.id)}">Afwijzen</button>
      <button class="knop fluo klein" data-aanmeld-ok="${esc(a.id)}">Goedkeuren en club aanmaken</button></div>
  </div>`;
}

function tekenPlatform(o, aanmeldingen){
  const t = o.totalen || {};
  const clubs = (o.clubs || []).map(k => o.terugval ? { ...k, terugvalRij: true } : k);
  const aandacht = clubs.filter(k => k.status === 'rood' || k.status === 'oranje');
  const zichtbaar = clubs.filter(k => (PF.filter === 'alle' || (PF.filter === 'aandacht' ? (k.status === 'rood' || k.status === 'oranje') : k.status === 'groen'))
    && (!PF.zoek || (k.naam + ' ' + (k.plaats || '')).toLowerCase().includes(PF.zoek.toLowerCase())));
  const totWacht = (t.wachtend || 0) + aanmeldingen.length;
  const kpis = o.terugval
    ? [kpi(t.clubs || 0, 'clubs'), kpi(t.teams || 0, 'teams'), kpi(totWacht, 'aanvragen open', '', totWacht ? 'let' : '')]
    : [kpi(`${t.actieveClubs || 0}<small>/${t.clubs || 0}</small>`, 'actieve clubs', 'laatste 14 dagen'),
       kpi(t.coaches30 || 0, 'actieve coaches', 'laatste 30 dagen'),
       kpi(totWacht, 'aanvragen open', `${t.wachtend || 0} coaches · ${aanmeldingen.length} clubs`, totWacht ? 'let' : ''),
       kpi(t.aiMaand || 0, 'AI-aanroepen', 'deze maand')];
  const seg = (id, label, n) => `<button data-pf-filter="${id}" class="${PF.filter === id ? 'actief' : ''}">${label}${n != null ? ` <small>${n}</small>` : ''}</button>`;
  const bijgewerkt = o.bijgewerkt && o.bijgewerkt.toDate ? o.bijgewerkt.toDate().toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  openModal(`<h2>Platform</h2>
    <div class="pf">
      <div class="pf-balk">
        <span class="cb-uitleg" style="margin:0">${o.terugval ? 'Basisoverzicht: stoplichten verschijnen zodra <code>platformOverzichtNu</code> gedeployed is.' : `Bijgewerkt ${esc(bijgewerkt)}`}</span>
        <span class="pf-knoppen">
          <button class="knop licht klein" id="pfVernieuw">Vernieuwen</button>
          <button class="knop licht klein" id="pfKalenders">KNVB-kalenders</button>
          <button class="knop fluo klein" id="pfNieuweClub">+ Nieuwe club</button></span>
      </div>
      <div class="pf-kpis">${kpis.join('')}</div>
      ${aanmeldingen.length ? `<div class="kaart"><div class="sectie-kop" style="margin-top:0">Nieuwe clubs die zich aanmeldden</div>${aanmeldingen.map(aanmeldKaart).join('')}</div>` : ''}
      ${aandacht.length && !o.terugval ? `<div class="kaart pf-signalen"><div class="sectie-kop" style="margin-top:0">Vraagt aandacht</div>
        ${aandacht.flatMap(k => (k.signalen || []).map(s => `<button class="pf-sigrij" data-platform-club="${esc(k.id)}"><span class="pf-licht ${s.niveau}"></span><b>${esc(k.naam)}</b><span>${esc(s.tekst)}</span></button>`)).slice(0, 12).join('')}</div>` : ''}
      <div class="pf-filter">
        <div class="segment">${seg('alle', 'Alle', clubs.length)}${o.terugval ? '' : seg('aandacht', 'Aandacht', aandacht.length) + seg('groen', 'In orde', clubs.length - aandacht.length)}</div>
        <input class="invoer" id="pfZoek" placeholder="Zoek club of plaats" value="${esc(PF.zoek)}" autocomplete="off">
      </div>
      <div class="pf-lijst">${zichtbaar.length ? zichtbaar.map(clubRij).join('') : '<div class="kaart leeg">Geen clubs in deze selectie.</div>'}</div>
    </div>`, { vorm: 'breed' });

  const opnieuw = () => tekenPlatform(o, aanmeldingen);
  document.querySelectorAll('[data-pf-filter]').forEach(b => b.onclick = () => { PF.filter = b.dataset.pfFilter; opnieuw(); });
  const zoek = document.getElementById('pfZoek');
  if (zoek) zoek.oninput = () => {
    PF.zoek = zoek.value;
    const pos = zoek.selectionStart; opnieuw();
    const z = document.getElementById('pfZoek'); if (z){ z.focus(); try { z.setSelectionRange(pos, pos); } catch (e) {} }
  };
  document.getElementById('pfKalenders')?.addEventListener('click', () => openKalenders());
  document.getElementById('pfNieuweClub')?.addEventListener('click', () => import('./club.js?v=20261013b').then(m => m.modalNieuwClub()));
  document.getElementById('pfVernieuw')?.addEventListener('click', async e => {
    const k = e.currentTarget; k.disabled = true; k.textContent = 'Bezig…';
    try { await httpsCallable(functions, 'platformOverzichtNu')({}); meld('Cijfers bijgewerkt'); openPlatform(); }
    catch (x){ k.disabled = false; k.textContent = 'Vernieuwen'; meld('Vernieuwen mislukt: ' + (x.code === 'functions/not-found' ? 'functie nog niet gedeployed' : (x.message || x.code))); }
  });
  document.querySelectorAll('[data-pf-od]').forEach(b => b.onclick = async () => {
    const [clubId, sl] = b.dataset.pfOd.split('|'), nieuw = !platformToegestaan(PM[clubId], sl);
    b.disabled = true;
    try { await zetPlatformModule(clubId, sl, nieuw); meld(`${ONDERDEEL_NAMEN[sl]} ${nieuw ? 'aan' : 'uit'} voor deze club`); opnieuw(); }
    catch (x){ b.disabled = false; meld('Opslaan mislukt: ' + (x.code === 'permission-denied' ? 'rules nog niet gedeployed?' : (x.message || x.code))); }
  });
  document.querySelectorAll('[data-platform-club]').forEach(b => b.onclick = () => {
    const id = b.dataset.platformClub;
    sluitModal();
    import('./club.js?v=20261013b').then(m => m.openClub(id)).catch(() => meld('Club openen mislukt'));
  });
  document.querySelectorAll('[data-aanmeld-ok], [data-aanmeld-af]').forEach(b => b.onclick = async () => {
    const id = b.dataset.aanmeldOk || b.dataset.aanmeldAf, goed = !!b.dataset.aanmeldOk;
    if (!goed && !confirm('Deze aanmelding afwijzen?')) return;
    b.disabled = true;
    try {
      const r = await httpsCallable(functions, 'beoordeelClubAanmelding')({ id, besluit: goed ? 'goedkeuren' : 'afwijzen' });
      meld(goed ? 'Club aangemaakt; de aanvrager is clubbeheerder ✓' : 'Aanmelding afgewezen');
      aanmeldingen = aanmeldingen.filter(a => a.id !== id);
      if (goed && r.data?.clubId) o = (await leesOverzicht()) || o;
      opnieuw();
    } catch (x){ b.disabled = false; meld('Mislukt: ' + (x.message || x.code)); }
  });
}

/* ---------- KNVB-kalenders per district en seizoen ----------
   Eén keer per district per seizoen invoeren; alle clubs in dat district krijgen hem automatisch
   (clubconfig.js leest kalenders/{seizoen}_{district} op basis van district en huidig seizoen van de club). */
const seizoenLabel = y => `${y}/'${String(y + 1).slice(-2)}`;
function seizoenen(){
  const nu = new Date(), y = nu.getMonth() >= 7 ? nu.getFullYear() : nu.getFullYear() - 1;
  return [seizoenLabel(y), seizoenLabel(y + 1)];
}
const KAL_DISTRICTEN = DISTRICTEN.filter(d => d.id !== 'zuid2');   // Zuid I en II delen één kalender

async function openKalenders(){
  openModal('<h2>KNVB-kalenders</h2><div class="kaart leeg">Laden…</div>');
  const szs = seizoenen(), staat = {};
  let leesFout = false;
  for (const sz of szs) for (const d of KAL_DISTRICTEN){
    try { const sn = await getDoc(doc(db, 'kalenders', kalenderId(sz, d.id))); staat[sz + '|' + d.id] = sn.exists() ? sn.data() : null; }
    catch (e) { leesFout = true; staat[sz + '|' + d.id] = null; }
  }
  const cel = (sz, d) => {
    const k = staat[sz + '|' + d.id];
    const n = k ? ['pup', 'jun', 'sen', 'mei'].reduce((t, c) => t + (k[c] || []).length, 0) : 0;
    const ingebouwd = !k && d.id === 'zuid1' && sz === "2026/'27";
    const tekst = k ? `✓ ${n} dagen` : ingebouwd ? '✓ ingebouwd' : '✗ ontbreekt';
    return `<button class="knop licht klein" data-kal="${esc(sz)}|${d.id}" style="${k || ingebouwd ? '' : 'color:var(--accent)'}">${tekst}</button>`;
  };
  openModal(`<h2>KNVB-kalenders</h2>
    <p class="cb-uitleg" style="margin:0 0 12px">Voer per district en seizoen één keer de speeldagen in. Clubs in dat district krijgen ze automatisch, zodra hun huidige seizoen overeenkomt. Zuid I en Zuid II delen één kalender. Een club kan hem zelf nog overschrijven.</p>
    ${leesFout ? '<p class="cb-uitleg" style="color:var(--accent)">Lezen mislukt: zijn de nieuwste firestore.rules gedeployed?</p>' : ''}
    <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:center">
      <b></b>${szs.map(s => `<b>${esc(s)}</b>`).join('')}
      ${KAL_DISTRICTEN.map(d => `<span>${esc(d.id === 'zuid1' ? 'Zuid I / II' : d.naam)}</span>${szs.map(sz => cel(sz, d)).join('')}`).join('')}
    </div>
    <button class="knop licht vol" id="kalTerug" style="margin-top:14px">Terug naar het platform</button>`);
  document.getElementById('kalTerug')?.addEventListener('click', () => openPlatform());
  document.querySelectorAll('[data-kal]').forEach(b => b.onclick = () => { const [sz, di] = b.dataset.kal.split('|'); kalenderEditor(sz, di, staat[b.dataset.kal]); });
}

function kalenderEditor(sz, districtId, bestaand){
  const d = DISTRICTEN.find(x => x.id === districtId);
  const start = bestaand ? JSON.stringify({ pup: bestaand.pup || [], jun: bestaand.jun || [], sen: bestaand.sen || [], mei: bestaand.mei || [] }, null, 1)
    : (districtId === 'zuid1' ? JSON.stringify(ORIGINEEL.kalender, null, 1) : '');
  openModal(`<h2>Kalender ${esc(sz)} · ${esc(districtId === 'zuid1' ? 'Zuid I / II' : d.naam)}</h2>
    <p class="cb-uitleg" style="margin:0 0 8px">Plak de kalender als JSON of kies een bestand. Kolommen: <b>pup</b> = O7–O12, <b>jun</b> = O13–O19, <b>sen</b> = senioren/vrouwen, <b>mei</b> = meiden. Per dag: <code>{"d":"2026-09-06","t":"wd","l":"Fase 1"}</code>; types wd, beker, inhaal, vrij.${districtId === 'zuid1' && !bestaand ? ' Als startpunt staat hier de ingebouwde Zuid-kalender van 2026/’27; pas de datums aan voor een ander seizoen.' : ''}</p>
    <textarea class="invoer" id="pkTekst" rows="10" spellcheck="false" style="font-family:monospace;font-size:12px" placeholder='{"pup":[],"jun":[],"sen":[],"mei":[]}'>${esc(start)}</textarea>
    <input type="file" id="pkBestand" accept=".json,application/json" style="display:none">
    <div class="rij" style="margin-top:10px">
      <button class="knop licht klein" id="pkKies">Bestand kiezen…</button>
      <button class="knop licht klein" id="pkTerug">Terug</button>
      <button class="knop vol klein" id="pkOpslaan">Opslaan voor alle clubs</button></div>`);
  const f = document.getElementById('pkBestand');
  document.getElementById('pkKies').onclick = () => f.click();
  f.onchange = async () => { const x = f.files && f.files[0]; if (x) document.getElementById('pkTekst').value = await x.text(); };
  document.getElementById('pkTerug').onclick = () => openKalenders();
  document.getElementById('pkOpslaan').onclick = async e => {
    let obj; try { obj = JSON.parse(document.getElementById('pkTekst').value); } catch (x){ return meld('Dit is geen geldige JSON'); }
    const fout = valideerKalender(obj); if (fout) return meld(fout);
    e.currentTarget.disabled = true;
    try {
      await setDoc(doc(db, 'kalenders', kalenderId(sz, districtId)), {
        pup: obj.pup || [], jun: obj.jun || [], sen: obj.sen || [], mei: obj.mei || [],
        label: sz, seizoen: sz, district: districtId, bijgewerkt: serverTimestamp(),
      });
      meld('Kalender opgeslagen'); openKalenders();
    } catch (x){ e.currentTarget.disabled = false; meld('Opslaan mislukt: ' + (x.code || x.message)); }
  };
}
