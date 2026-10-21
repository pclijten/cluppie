/* ==================== SNELSTART (schermen) [20261020c] ====================
   Trainer die zelf begint, zonder club: uitleg, club + plaats, team met slimme standaarden,
   en daarna de kaart "Eerste stappen" op het teamscherm. Logica en tests: snelstart-logica.js.
   Gegevens: teams/{id}.eigenClub en gebruikers/{uid}/meta/onboarding.snelstart (alleen UI-vlaggen). */
import { db, collection, doc, addDoc, updateDoc, setDoc, getDoc, getDocs, serverTimestamp } from './firebase.js?v=20261011g';
import { S, $, $$, esc, meld, teamCode, openModal, sluitModal } from './state.js?v=20261011g';
import { CATEGORIEEN, CATEGORIEEN_MEIDEN, catInfo, bouwVanCategorie, catLabel } from './config.js?v=20261011g';
import {
  bouwEigenClub, valideerClub, valideerPlaats, standaardTeamNaam, categorieVoor, STANDAARD_CAT,
  eersteStappenStatus, toonEersteStappen, toonClubTip,
} from './snelstart-logica.js?v=20261020c';

/* ---------- Plaats opzoeken (Open-Meteo, zonder sleutel) ---------- */
async function zoekPlaats(q){
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=nl&format=json`);
  if (!r.ok) throw new Error('Zoeken mislukt');
  const d = await r.json();
  return (d.results || []).filter(x => x.country_code === 'NL' || !x.country_code).map(x => ({
    plaats: x.name, lat: x.latitude, lon: x.longitude, toelichting: [x.admin2 || x.admin1].filter(Boolean).join(', '),
  }));
}

/* ---------- Club + plaats: velden die in de wizard en in de instellingen hetzelfde zijn ---------- */
function htmlClubPlaats(prefix, club = '', plaats = ''){
  return `
    <div class="veldgroep"><label for="${prefix}Club">Club</label>
      <input class="invoer" id="${prefix}Club" value="${esc(club)}" autocomplete="off" placeholder="Bijvoorbeeld VV Dorpsveld" maxlength="60"></div>
    <div class="veldgroep"><label for="${prefix}Plaats">Plaats of dorp van de club</label>
      <div class="tok-invoer"><input type="text" id="${prefix}Plaats" value="${esc(plaats)}" autocomplete="off" placeholder="Bijvoorbeeld Helmond" maxlength="60">
        <button type="button" class="knop licht" id="${prefix}Zoek" style="min-height:44px">Zoek</button></div>
      <div id="${prefix}Res" style="margin-top:8px"></div>
      <div class="sn-gekozen" id="${prefix}Gekozen" hidden></div></div>`;
}

/* Geeft { lees() } terug; lees() valideert en geeft { ok, eigenClub } of toont een melding. */
function koppelClubPlaats(root, prefix, begin = null){
  const sel = { plaats: '', lat: null, lon: null, zonderWeer: false };
  const inClub = root.querySelector('#' + prefix + 'Club'), inPlaats = root.querySelector('#' + prefix + 'Plaats');
  const knop = root.querySelector('#' + prefix + 'Zoek'), res = root.querySelector('#' + prefix + 'Res'), gek = root.querySelector('#' + prefix + 'Gekozen');
  const toonGekozen = () => {
    if (!sel.plaats){ gek.hidden = true; return; }
    gek.hidden = false;
    gek.textContent = sel.zonderWeer ? `✓ ${sel.plaats} (zonder weer)` : `✓ ${sel.plaats}. Het weer staat dan op je teamscherm.`;
  };
  if (begin && begin.plaats){ sel.plaats = begin.plaats; sel.lat = begin.lat ?? null; sel.lon = begin.lon ?? null; sel.zonderWeer = sel.lat === null; toonGekozen(); }
  const kies = (p, zonderWeer) => {
    sel.plaats = p.plaats; sel.lat = zonderWeer ? null : p.lat; sel.lon = zonderWeer ? null : p.lon; sel.zonderWeer = !!zonderWeer;
    inPlaats.value = p.plaats; res.innerHTML = ''; toonGekozen();
  };
  const zoek = async () => {
    const q = inPlaats.value.trim();
    if (q.length < 2){ meld('Typ minstens 2 letters van de plaats'); return false; }
    knop.disabled = true; res.innerHTML = '<p class="meta">Zoeken…</p>';
    try {
      const lijst = await zoekPlaats(q);
      res.innerHTML = (lijst.length ? lijst.map((r, i) => `<button type="button" class="lijst-item" data-ss-plaats="${i}" style="margin-bottom:6px"><div class="li-tekst"><div class="titel">${esc(r.plaats)}</div><div class="meta">${esc(r.toelichting)}</div></div></button>`).join('')
        : '<p class="meta">Niets gevonden. Controleer de schrijfwijze.</p>')
        + `<button type="button" class="knop licht vol" data-ss-zonder="1" style="margin-top:2px">Gebruik “${esc(q)}” zonder weer</button>`;
      res.querySelectorAll('[data-ss-plaats]').forEach(b => b.onclick = () => kies(lijst[Number(b.dataset.ssPlaats)]));
      res.querySelector('[data-ss-zonder]').onclick = () => kies({ plaats: q }, true);
    } catch (e){
      res.innerHTML = `<p class="meta">Zoeken lukt nu niet (geen verbinding?).</p><button type="button" class="knop licht vol" data-ss-zonder="1">Gebruik “${esc(q)}” zonder weer</button>`;
      res.querySelector('[data-ss-zonder]').onclick = () => kies({ plaats: q }, true);
    } finally { knop.disabled = false; }
    return true;
  };
  knop.onclick = zoek;
  inPlaats.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); zoek(); } };
  inPlaats.oninput = () => { if (sel.plaats && inPlaats.value.trim() !== sel.plaats){ sel.plaats = ''; sel.lat = sel.lon = null; sel.zonderWeer = false; toonGekozen(); } };
  return {
    /* Club en plaats zijn verplicht. Een plaats moet gekozen zijn in de lijst, of bewust zonder weer. */
    async lees(){
      const c = valideerClub(inClub.value);
      if (!c.ok){ meld(c.fout); inClub.focus(); return null; }
      if (!sel.plaats){
        const p = valideerPlaats({ plaats: inPlaats.value });
        if (!p.ok){ meld(p.fout); inPlaats.focus(); return null; }
        await zoek(); meld('Kies je plaats in de lijst'); return null;
      }
      const b = bouwEigenClub({ naam: c.naam, plaats: sel.plaats, lat: sel.lat, lon: sel.lon });
      if (!b.ok){ meld(b.fout); return null; }
      return b.eigenClub;
    },
  };
}

/* ---------- Voortgang en vlaggen (alleen UI, geen spelersgegevens) ---------- */
const metaRef = () => doc(db, 'gebruikers', S.user.uid, 'meta', 'onboarding');
async function leesVlaggen(){
  if (S._ssVlaggen) return S._ssVlaggen;
  let v = {};
  try { v = ((await getDoc(metaRef())).data() || {}).snelstart || {}; } catch (e) {}
  return (S._ssVlaggen = v);
}
async function zetVlag(sleutel, waarde){
  const v = await leesVlaggen(); v[sleutel] = waarde;
  try { await setDoc(metaRef(), { snelstart: v }, { merge: true }); } catch (e) { console.error(e); }
}

/* ==================== WIZARD: team starten ==================== */
export async function openSnelstart(){
  let akkoord = false;
  try { akkoord = (await getDoc(doc(db, 'gebruikers', S.user.uid, 'meta', 'eigenTeam'))).data()?.akkoord === true; } catch (e) {}
  const st = { stap: 1, geslacht: 'j', cat: STANDAARD_CAT.j, nr: '1', naamAangepast: false, naam: '', club: null };
  let cp = null;

  const stapKop = (n, titel) => `<div class="sn-stappen" aria-label="Stap ${n} van 3">${[1, 2, 3].map(i => `<span class="${i <= n ? 'aan' : ''}"></span>`).join('')}</div><h2>${titel}</h2>`;

  const tekenStap1 = () => {
    openModal(`${stapKop(1, 'Zo help ik je als trainer')}
      <ul class="sn-beloften">
        <li><b>Eerlijke speeltijd.</b> Maak de opstelling, de app houdt per speler bij wie hoeveel speelt.</li>
        <li><b>Training in minuten.</b> Kies een thema en je krijgt een volledig draaiboek voor je training.</li>
        <li><b>Alles voor je team.</b> Presentie, wedstrijdverslag en ontwikkeling per speler, op je telefoon.</li>
      </ul>
      <p class="meta sn-tip">Eerlijk vooraf: zonder club werkt Cluppie niet met Sportlink en heb je geen AI-hulp. Al het andere staat open.</p>
      <button class="knop vol" id="ssVerder">Laten we beginnen</button>
      <button class="knop licht vol" id="ssRond" style="margin-top:8px">Liever eerst een rondleiding</button>`);
    $('#ssVerder').onclick = tekenStap2;
    $('#ssRond').onclick = () => { sluitModal(); import('./onboarding.js?v=20261021a').then(m => m.startOnboarding(true)); };
  };

  const tekenStap2 = () => {
    const lijst = st.geslacht === 'j' ? CATEGORIEEN : CATEGORIEEN_MEIDEN;
    const cats = Object.keys(lijst);
    st.cat = categorieVoor(st.geslacht, st.cat, cats);
    const bewaar = st.club;
    openModal(`${stapKop(2, 'Voor welke club train je?')}
      <p class="meta" style="margin:-4px 0 12px">Zo zet ik het weer en de standaarden voor je klaar.</p>
      <div id="ssCP">${htmlClubPlaats('ss', bewaar ? bewaar.naam : '', bewaar ? bewaar.plaats : '')}</div>
      <div class="veldgroep"><label>Jongens of meiden</label>
        <div class="segment" id="ssGeslacht"><button data-g="j" class="${st.geslacht === 'j' ? 'actief' : ''}">Jongens (JO)</button><button data-g="m" class="${st.geslacht === 'm' ? 'actief' : ''}">Meiden (MO)</button></div></div>
      <div class="rij">
        <div class="veldgroep" style="flex:2"><label for="ssCat">Categorie</label><select class="invoer" id="ssCat">${cats.map(c => `<option value="${esc(c)}" ${c === st.cat ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select></div>
        <div class="veldgroep" style="flex:1"><label for="ssNr">Team</label><select class="invoer" id="ssNr">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${String(i + 1) === st.nr ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
      </div>
      <details class="sn-naam"><summary>Teamnaam aanpassen</summary><input class="invoer" id="ssNaam" autocomplete="off" maxlength="40" style="margin-top:8px"></details>
      <p class="meta" id="ssKnvb" style="margin:8px 2px 14px"></p>
      <button class="knop vol" id="ssVerder">Verder</button>
      <button class="knop licht vol" id="ssTerug" style="margin-top:8px">Terug</button>`);
    cp = koppelClubPlaats($('#ssCP'), 'ss', bewaar && bewaar.plaats ? { plaats: bewaar.plaats, lat: bewaar.lat, lon: bewaar.lon } : null);
    const werkBij = () => {
      st.cat = $('#ssCat').value; st.nr = $('#ssNr').value;
      if (!st.naamAangepast) $('#ssNaam').value = standaardTeamNaam(st.cat, catLabel(st.cat), st.nr);
      st.naam = $('#ssNaam').value.trim();
      const c = catInfo(st.cat);
      $('#ssKnvb').innerHTML = `<b>KNVB ${esc(catLabel(st.cat))}:</b> ${esc(c.knvb)}<br>Ik stel ${c.periodes === 2 ? '2 helften' : '4 kwarten'} van ${String(c.duur).replace('.', ',')} minuten in. Per wedstrijd aan te passen.`;
    };
    $$('#ssGeslacht button').forEach(b => b.onclick = () => {
      st.geslacht = b.dataset.g;
      $$('#ssGeslacht button').forEach(x => x.classList.toggle('actief', x === b));
      const nieuw = Object.keys(st.geslacht === 'j' ? CATEGORIEEN : CATEGORIEEN_MEIDEN);
      st.cat = categorieVoor(st.geslacht, st.cat, nieuw);
      $('#ssCat').innerHTML = nieuw.map(c => `<option value="${esc(c)}" ${c === st.cat ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('');
      werkBij();
    });
    $('#ssCat').onchange = werkBij; $('#ssNr').onchange = werkBij;
    $('#ssNaam').oninput = () => { st.naamAangepast = true; st.naam = $('#ssNaam').value.trim(); };
    if (st.naamAangepast) $('#ssNaam').value = st.naam;
    werkBij();
    $('#ssTerug').onclick = tekenStap1;
    $('#ssVerder').onclick = async () => {
      const eigenClub = await cp.lees();
      if (!eigenClub) return;
      if (!$('#ssNaam').value.trim()) return meld('Geef het team een naam');
      st.club = eigenClub; st.naam = $('#ssNaam').value.trim();
      tekenStap3();
    };
  };

  const tekenStap3 = () => {
    const c = catInfo(st.cat);
    openModal(`${stapKop(3, 'Je team staat klaar')}
      <dl class="sn-samen">
        <div><dt>Club</dt><dd>${esc(st.club.naam)}, ${esc(st.club.plaats)}</dd></div>
        <div><dt>Team</dt><dd>${esc(st.naam)}</dd></div>
        <div><dt>Wedstrijd</dt><dd>${esc(c.format)} tegen ${esc(c.format)}, ${c.periodes === 2 ? '2 helften' : '4 kwarten'} van ${String(c.duur).replace('.', ',')} min</dd></div>
      </dl>
      <div class="sn-wel-niet">
        <div><b>Je hebt</b><ul><li>Opstelling en speeltijd</li><li>Presentie en verslagen</li><li>Training maken</li><li>Weer op je teamscherm${st.club.lat === null ? ' (alleen met een gekozen plaats)' : ''}</li></ul></div>
        <div><b>Nog niet</b><ul><li>Sportlink-koppeling</li><li>AI-hulp</li><li>Clubbrede plannen</li></ul></div>
      </div>
      ${akkoord ? '' : `<label class="ci-schakel" style="margin:12px 0"><input type="checkbox" id="ssAkkoord"><span>Ik gebruik voornamen en geen gezondheidsgegevens van spelers, en ga akkoord met de <a href="privacy.html" target="_blank" rel="noopener">privacyverklaring</a>. Zonder club ben ik zelf verantwoordelijk voor deze gegevens.</span></label>`}
      <button class="knop vol" id="ssMaak" ${akkoord ? '' : 'disabled'}>Maak mijn team</button>
      <button class="knop licht vol" id="ssTerug" style="margin-top:8px">Terug</button>`);
    const ak = $('#ssAkkoord');
    if (ak) ak.onchange = () => { $('#ssMaak').disabled = !ak.checked; };
    $('#ssTerug').onclick = tekenStap2;
    $('#ssMaak').onclick = async () => {
      if (!akkoord && !(ak && ak.checked)) return meld('Vink aan dat je akkoord gaat om verder te gaan');
      const knop = $('#ssMaak'); knop.disabled = true;
      try {
        if (!akkoord) await setDoc(doc(db, 'gebruikers', S.user.uid, 'meta', 'eigenTeam'), { akkoord: true, datum: serverTimestamp() }, { merge: true });
        const bestaande = [...S.teams.map(t => t.code), ...(S.clubTeams || []).map(t => t.code)].filter(Boolean);
        const ref = await addDoc(collection(db, 'teams'), {
          naam: st.naam, categorie: st.cat, geslacht: st.geslacht, format: catInfo(st.cat).format,
          bouw: bouwVanCategorie(st.cat), code: teamCode(st.naam, '', bestaande),
          leden: { [S.user.uid]: true },
          ledenInfo: { [S.user.uid]: { naam: S.user.displayName || (S.user.email || '').split('@')[0] || 'Coach' } },
          eigenClub: st.club, gemaakt: serverTimestamp(),
        });
        sluitModal();
        import('./teams.js?v=20261021a').then(m => m.openTeam(ref.id));
      } catch (e){ console.error(e); knop.disabled = false; meld('Team aanmaken mislukt, probeer het nog eens'); }
    };
  };

  tekenStap1();
}

/* ==================== Club en plaats later invullen of wijzigen ==================== */
export function modalClubPlaats(){
  const t = S.team, e = t.eigenClub || {};
  openModal(`<h2>Club en plaats</h2>
    <p class="meta" style="margin:-4px 0 12px">Met je plaats zie ik het weer op je teamscherm.</p>
    <div id="ssCP2">${htmlClubPlaats('sc', e.naam || '', e.plaats || '')}</div>
    <button class="knop vol" id="scOk">Opslaan</button>`);
  const cp = koppelClubPlaats($('#ssCP2'), 'sc', e.plaats ? { plaats: e.plaats, lat: e.lat, lon: e.lon } : null);
  $('#scOk').onclick = async () => {
    const eigenClub = await cp.lees(); if (!eigenClub) return;
    try {
      await updateDoc(doc(db, 'teams', t.id), { eigenClub });
      t.eigenClub = eigenClub;
      sluitModal(); meld('Opgeslagen');
      import('./teams.js?v=20261021a').then(m => m.renderTeam && m.renderTeam());
    } catch (err){ console.error(err); meld('Opslaan mislukt, probeer het nog eens'); }
  };
}

/* Kaart voor Instellingen (alleen team zonder club, alleen voor wie in het team zit). */
export function htmlClubPlaatsInstelling(){
  const t = S.team;
  if (!t || t.club || !(t.leden && t.leden[S.user.uid])) return '';
  const e = t.eigenClub;
  return `<div class="kaart"><div class="sectie-kop" style="margin-top:0">Club en plaats</div>
    <p class="meta" style="margin:0 0 10px">${e ? `${esc(e.naam)}, ${esc(e.plaats)}${e.lat === null ? ' (zonder weer)' : ''}` : 'Nog niet ingevuld. Met je plaats zie je het weer op je teamscherm.'}</p>
    <button class="knop licht vol" id="ssClubWijzig">${e ? 'Wijzigen' : 'Invullen'}</button></div>`;
}
export function koppelClubPlaatsInstelling(v){
  const b = v.querySelector('#ssClubWijzig'); if (b) b.onclick = modalClubPlaats;
}

/* ==================== Kaart "Eerste stappen" op het teamscherm ==================== */
export function eersteStappenPlaats(){
  const t = S.team;
  if (!t || t.club || !(t.leden && t.leden[S.user.uid])) return '';
  return '<div id="ssKaart"></div>';
}

export async function koppelEersteStappen(v, { zetTeamTab } = {}){
  const el = v.querySelector('#ssKaart'); if (!el) return;
  const team = S.team, teamId = S.teamId;
  const vl = await leesVlaggen();
  let training = !!(S._ssTraining && S._ssTraining[teamId]);
  if (!training){
    try { training = !(await getDocs(collection(db, 'teams', teamId, 'trainingsplannen'))).empty; } catch (e) {}
    (S._ssTraining = S._ssTraining || {})[teamId] = training;
  }
  if (S.teamId !== teamId || !el.isConnected) return;
  const status = eersteStappenStatus(team, { spelers: S.spelers.length, wedstrijden: S.wedstrijden.length, training });
  let html = '';
  if (toonEersteStappen(team, { verborgen: !!vl.eersteStappenWeg, status })){
    html = `<section class="kaart sn-kaart"><div class="sn-kop"><b>Eerste stappen</b><span>${status.gedaan} van ${status.totaal}</span></div>
      <div class="sn-balk" role="progressbar" aria-valuemin="0" aria-valuemax="${status.totaal}" aria-valuenow="${status.gedaan}"><i style="width:${Math.round(100 * status.gedaan / status.totaal)}%"></i></div>
      ${status.stappen.map(s => `<button class="sn-stap ${s.klaar ? 'klaar' : ''} ${s.id === status.volgende ? 'nu' : ''}" data-ss-tab="${s.tab}">
        <span class="sn-vink" aria-hidden="true">${s.klaar ? '✓' : ''}</span><span class="sn-tekst"><b>${esc(s.titel)}</b><small>${esc(s.uitleg)}</small></span></button>`).join('')}
      <div class="sn-voet"><button class="sn-link" id="ssRondleiding">Liever een rondleiding?</button><button class="sn-link" id="ssVerberg">Verberg</button></div></section>`;
  } else if (toonClubTip(team, { verborgen: !!vl.clubTipWeg })){
    html = `<section class="kaart sn-kaart"><div class="sn-kop"><b>Vul je club en plaats in</b></div>
      <p class="meta" style="margin:0 0 10px">Dan zie je het weer op je teamscherm en weet ik waar je speelt.</p>
      <div class="rij"><button class="knop vol" id="ssClubVul">Invullen</button><button class="knop licht" id="ssClubWeg">Later</button></div></section>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-ss-tab]').forEach(b => b.onclick = () => zetTeamTab && zetTeamTab(b.dataset.ssTab));
  const r = el.querySelector('#ssRondleiding'); if (r) r.onclick = () => import('./onboarding.js?v=20261021a').then(m => m.startOnboarding(true));
  const w = el.querySelector('#ssVerberg'); if (w) w.onclick = async () => { el.innerHTML = ''; await zetVlag('eersteStappenWeg', true); };
  const cv = el.querySelector('#ssClubVul'); if (cv) cv.onclick = modalClubPlaats;
  const cw = el.querySelector('#ssClubWeg'); if (cw) cw.onclick = async () => { el.innerHTML = ''; await zetVlag('clubTipWeg', true); };
}
