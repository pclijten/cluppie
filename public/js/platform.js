/* ====================================================================
   PLATFORM — overzicht van alle clubs (alleen platformbeheerder)
   Leest clubs/ en aanvragen/ zonder filter; de Firestore-regels laten dat
   alleen de platformbeheerder toe. Voor een club openen: openClub() (de
   regels geven de platformbeheerder daar volledige rechten).
==================================================================== */
import { db, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from './firebase.js?v=20260922c';
import { S, esc, meld, openModal, sluitModal, isPlatformBeheerder } from './state.js?v=20261010c';
import { logoImgVoorDoc, DISTRICTEN, kalenderId, valideerKalender, ORIGINEEL } from './clubconfig.js?v=20261010c';

const telKeys = o => Object.keys(o || {}).length;
const datum = t => {
  try { const d = t && t.toDate ? t.toDate() : null; return d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  catch (e) { return ''; }
};

export async function openPlatform(){
  if (!isPlatformBeheerder()) return;
  openModal('<h2>Alle clubs</h2><div class="kaart leeg">Clubs laden…</div>');
  let clubs = [], aanvragen = {}, aanvragenOk = true;
  try {
    const cs = await getDocs(collection(db, 'clubs'));
    clubs = cs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  } catch (e) {
    console.error('[Cluppie] Platformoverzicht (clubs) kon niet laden:', e.code, e.message);
    openModal('<h2>Alle clubs</h2><div class="kaart leeg">Clubs laden mislukt' + (e.code === 'permission-denied' ? ': Firestore weigert het lezen. Controleer of de nieuwste firestore.rules zijn gedeployed en of je e-mailadres geverifieerd is.' : ' (' + esc(e.code || e.message || 'onbekende fout') + ').') + '</div>');
    return;
  }
  /* Aanvragen apart: lukt dit niet (bv. oude rules), dan blijft de clublijst gewoon zichtbaar. */
  try {
    const as = await getDocs(collection(db, 'aanvragen'));
    as.docs.forEach(d => { const c = d.data().clubId; if (c) aanvragen[c] = (aanvragen[c] || 0) + 1; });
  } catch (e) {
    aanvragenOk = false;
    console.error('[Cluppie] Platformoverzicht (aanvragen) kon niet laden:', e.code, e.message);
  }
  const totTeams = clubs.reduce((n, c) => n + telKeys(c.teams), 0);
  const totLeden = clubs.reduce((n, c) => n + telKeys(c.leden), 0);
  const totWacht = Object.values(aanvragen).reduce((n, x) => n + x, 0);
  const rij = c => {
    const w = aanvragen[c.id] || 0;
    const plaats = c.instellingen && c.instellingen.locatie && c.instellingen.locatie.plaats;
    const meta = [telKeys(c.teams) + ' teams', telKeys(c.leden) + ' leden', telKeys(c.admins) + ' admin' + (telKeys(c.admins) === 1 ? '' : 's'), plaats, datum(c.gemaakt) && ('sinds ' + datum(c.gemaakt))].filter(Boolean).join(' · ');
    return `<button class="lijst-item" data-platform-club="${esc(c.id)}">
      <div class="club-shirt">${logoImgVoorDoc(c, 'club-schild')}</div>
      <div class="li-tekst"><div class="titel">${esc(c.naam || 'Club zonder naam')}${w ? ` <span class="club-badge">${w} wacht${w === 1 ? '' : 'en'}</span>` : ''}</div>
      <div class="meta">${esc(meta)}</div></div><span class="pijl">›</span></button>`;
  };
  openModal(`<h2>Alle clubs</h2>
    <p class="cb-uitleg" style="margin:0 0 12px">${clubs.length} club${clubs.length === 1 ? '' : 's'} · ${totTeams} teams · ${totLeden} leden · ${aanvragenOk ? totWacht + ' aanvra' + (totWacht === 1 ? 'ag' : 'gen') + ' in behandeling' : 'aanvragen niet beschikbaar (rules nog niet gedeployed?)'}</p>
    <button class="knop licht vol" id="platformKalenders" style="margin-bottom:12px">KNVB-kalenders per district beheren</button>
    ${clubs.length ? clubs.map(rij).join('') : '<div class="kaart leeg">Er zijn nog geen clubs.</div>'}`);
  document.getElementById('platformKalenders')?.addEventListener('click', () => openKalenders());
  document.querySelectorAll('[data-platform-club]').forEach(b => b.onclick = () => {
    const id = b.dataset.platformClub;
    sluitModal();
    import('./club.js?v=20261010c').then(m => m.openClub(id)).catch(e => meld('Club openen mislukt'));
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
    <button class="knop licht vol" id="kalTerug" style="margin-top:14px">Terug naar clubs</button>`);
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
