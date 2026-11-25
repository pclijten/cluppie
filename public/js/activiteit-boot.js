/* ==================== ACTIVITEIT-BOOT: VRIJWILLIGERS VIA DE OPEN LINK [20261125x] ====================
   Wordt aangeroepen door main.js zodra de URL ?act=<deelId> bevat, los van de normale login.
   Een ouder of vrijwilliger zonder Cluppie-account schrijft zich hier in voor een dienst bij een
   clubactiviteit (kantine, scheidsrechter, opbouw …). Zie activiteiten.js voor het comité-deel.

   Zelfde opzet als hulp-boot.js (Trainingshulp): anoniem inloggen, alleen het deel-document en de
   aanmeldingen lezen, per dienst één eigen aanmelding maken of weghalen. Niets anders van de club.
   Wie wat mag: firestore.rules, blok activiteitDeel. Alleen voornamen, geen telefoonnummers. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, collection, setDoc, deleteDoc, onSnapshot } from './firebase.js?v=20261011g';
import { NAAM_MAX, telDiensten, botstMet, datumLang, schoneNaam, ics } from './activiteiten-logica.js?v=20261125w';

const NAAM_SLEUTEL = 'cluppieHulpNaam';            /* zelfde als Trainingshulp: je vult je naam één keer in */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (pad, maat, dikte) => `<svg width="${maat}" height="${maat}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${dikte}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${pad}</svg>`;
const I_SLOT = svg('<rect x="4.6" y="10.4" width="14.8" height="9.8" rx="2.4"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4"/><circle cx="12" cy="15.2" r="1.4" fill="currentColor" stroke="none"/>', 18, 1.8);
const I_VINK = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16, 2.2);
const melding = (titel, tekst) => `<div class="hp"><div class="hp-melding">${I_SLOT}<h1 class="hp-h1">${esc(titel)}</h1><p class="hp-intro">${esc(tekst)}</p></div></div>`;
const authKlaar = () => new Promise(k => { const stop = onAuthStateChanged(auth, () => { stop(); k(); }, () => k()); });
async function sessie(forceer){
  const u = auth.currentUser;
  if (u){
    try { await u.getIdToken(!!forceer); return; }
    catch (e){ if (e?.code === 'auth/network-request-failed') return; if (auth.currentUser?.isAnonymous){ try { await signOut(auth); } catch { /* dan maar zo */ } } }
  }
  if (!auth.currentUser) await signInAnonymously(auth);
}

export async function bootActiviteitPagina(deelId){
  const el = document.getElementById('deel');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = '<div class="hp"><p class="hp-intro">Bezig met laden…</p></div>';
  try { await authKlaar(); await sessie(false); }
  catch { el.innerHTML = melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.'); return; }
  let uid = auth.currentUser.uid;
  const st = { deel: null, aanm: null, naam: '', bezig: false, getekend: false, ronde: 0, hersteld: false };
  let stops = [];
  try { st.naam = (localStorage.getItem(NAAM_SLEUTEL) || '').slice(0, NAAM_MAX); } catch { /* geen opslag */ }

  const stopAlles = () => { stops.forEach(u => { try { u(); } catch { /* al gestopt */ } }); stops = []; };
  const fout = async (e, ronde) => {
    if (ronde !== st.ronde) return;
    console.error('[Cluppie] activiteit', e);
    if (e?.code === 'permission-denied' && !st.hersteld){
      st.hersteld = true; st.ronde++; stopAlles();
      try { await sessie(true); uid = auth.currentUser.uid; st.deel = null; st.aanm = null; luister(); return; } catch { /* door */ }
    }
    st.ronde++; st.getekend = false; stopAlles();
    el.innerHTML = e?.code === 'permission-denied' ? melding('Deze inschrijflijst staat dicht', 'Vraag het organiserend comité om een nieuwe link.') : melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.');
  };
  function luister(){
    const ronde = st.ronde;
    stops.push(onSnapshot(doc(db, 'activiteitDeel', deelId), s => {
      if (ronde !== st.ronde) return;
      if (!s.exists()){
        if (s.metadata?.fromCache){ if (!st.deel){ st.getekend = false; el.innerHTML = melding('Even geduld', 'We maken verbinding met Cluppie. Lukt het niet, open de link dan in je gewone browser.'); } return; }
        st.getekend = false; el.innerHTML = melding('Deze link werkt niet (meer)', 'De activiteit is verwijderd. Vraag het comité om een nieuwe link.'); return;
      }
      st.deel = s.data(); teken();
    }, e => fout(e, ronde)));
    stops.push(onSnapshot(collection(db, 'activiteitDeel', deelId, 'aanmeldingen'), s => {
      if (ronde !== st.ronde) return;
      st.aanm = s.docs.map(d => ({ id: d.id, ...d.data() })); teken();
    }, e => fout(e, ronde)));
  }
  luister();

  const mijn = () => (st.aanm || []).filter(a => a.uid === uid && a.door === 'link').map(a => a.dienst);
  function waarschuw(t){ const w = el.querySelector('#hpWaarschuw'); if (!w) return; w.textContent = t || ''; w.hidden = !t; el.querySelector('#hpNaam')?.classList.toggle('fout', !!t); }

  function teken(){
    if (!st.deel || !st.aanm) return;
    if (!st.getekend){
      const d = st.deel;
      el.innerHTML = `<div class="hp">
        <div><div class="hp-label">${esc([d.clubNaam, datumLang(d.datum)].filter(Boolean).join(' · '))}</div>
          <h1 class="hp-h1">Help je mee bij ${esc(d.titel || 'de activiteit')}?</h1>
          <p class="hp-intro">${esc([d.start ? 'Vanaf ' + d.start : '', d.locatie].filter(Boolean).join(', '))}${d.start || d.locatie ? '. ' : ''}Kies een of meer diensten. Het comité legt op de dag uit wat je doet.</p></div>
        <div class="veldgroep"><label for="hpNaam">Je voornaam</label>
          <input class="invoer hp-naam" id="hpNaam" type="text" value="${esc(st.naam)}" placeholder="bv. Sandra" maxlength="${NAAM_MAX}" autocomplete="given-name" autocapitalize="words">
          <div class="hp-waarschuw" id="hpWaarschuw" role="alert" hidden></div></div>
        <div class="hp-lijst" id="hpLijst"></div>
        <div class="hp-dank" id="hpDank" role="status" hidden></div>
        <button class="knop" id="hpAgenda" hidden>Zet het in mijn agenda</button>
        <p class="hp-voet">${I_SLOT}<span>Anderen met deze link zien wie zich heeft ingeschreven, alleen met voornaam. Afmelden kan op deze telefoon of via het comité.</span></p></div>`;
      const inp = el.querySelector('#hpNaam');
      inp.oninput = () => { st.naam = inp.value.slice(0, NAAM_MAX); try { localStorage.setItem(NAAM_SLEUTEL, st.naam.trim()); } catch { /* geen opslag */ } waarschuw(''); };
      el.querySelector('#hpAgenda').onclick = agenda;
      st.getekend = true;
    }
    lijst();
  }
  function lijst(){
    const l = el.querySelector('#hpLijst'); if (!l) return;
    const ds = telDiensten(st.deel.diensten, st.aanm), ik = new Set(mijn());
    l.innerHTML = ds.lijst.length ? ds.lijst.map(d => {
      const wie = st.aanm.filter(a => a.dienst === d.id && a.naam).sort((a, b) => (a.ms || 0) - (b.ms || 0));
      const namen = wie.map(a => a.uid === uid && a.door === 'link' ? `${a.naam} (jij)` : a.naam);
      const vrij = Math.max(0, d.nodig - wie.length), mij = ik.has(d.id);
      const tekst = (namen.length ? namen.join(', ') : 'Nog niemand') + (vrij ? ` · nog ${vrij} ${vrij === 1 ? 'plek' : 'plekken'}` : '');
      const actie = mij ? `<button class="knop hp-knop" data-af="${esc(d.id)}">Afmelden</button>` : vrij ? `<button class="knop fluo hp-knop" data-help="${esc(d.id)}">Ik help</button>` : `<span class="hp-vol">${I_VINK} Vol</span>`;
      return `<div class="hp-rij ${mij ? 'ik' : ''}"><span class="lj-dag"><b>${esc(d.start || '–')}</b><small>${esc(d.eind ? 'tot ' + d.eind : '')}</small></span>
        <span class="hp-t"><b>${esc(d.naam)}${d.plek ? ` <span class="lh-tijd">${esc(d.plek)}</span>` : ''}</b><small>${esc(tekst)}</small></span>${actie}</div>`;
    }).join('') : '<div class="kaart leeg">Er staan nog geen diensten open.</div>';
    const n = ik.size, dank = el.querySelector('#hpDank');
    if (dank){ dank.hidden = !n; dank.textContent = n ? `Bedankt! Je staat ingeschreven voor ${n} ${n === 1 ? 'dienst' : 'diensten'}. Het comité ziet het direct.` : ''; }
    const ag = el.querySelector('#hpAgenda'); if (ag) ag.hidden = !n || !st.deel.datum;
    l.querySelectorAll('[data-help]').forEach(b => b.onclick = () => aan(b.dataset.help, b));
    l.querySelectorAll('[data-af]').forEach(b => b.onclick = () => af(b.dataset.af, b));
  }
  const ref = id => doc(db, 'activiteitDeel', deelId, 'aanmeldingen', `${uid}_${id}`);
  async function aan(id, knop){
    if (st.bezig) return;
    const naam = schoneNaam(st.naam);
    if (!naam){ waarschuw('Vul eerst je voornaam in, dan kun je een dienst kiezen.'); el.querySelector('#hpNaam')?.focus(); return; }
    const botst = botstMet(st.deel.diensten, mijn(), id);
    if (botst && !confirm(`Je staat op die tijd al bij "${st.deel.diensten[botst]?.naam}". Toch inschrijven?`)) return;
    st.bezig = true; knop.disabled = true;
    try { await setDoc(ref(id), { uid, dienst: id, naam, ms: Date.now(), door: 'link' }); waarschuw(''); }
    catch (e){ console.error('[Cluppie] inschrijven', e); waarschuw('Inschrijven is niet gelukt. Probeer het nog een keer.'); knop.disabled = false; }
    st.bezig = false;
  }
  async function af(id, knop){
    if (st.bezig) return;
    st.bezig = true; knop.disabled = true;
    try { await deleteDoc(ref(id)); } catch (e){ console.error('[Cluppie] afmelden', e); waarschuw('Afmelden is niet gelukt.'); knop.disabled = false; }
    st.bezig = false;
  }
  function agenda(){
    const d = st.deel, ds = telDiensten(d.diensten, st.aanm).lijst.filter(x => mijn().includes(x.id));
    const eerste = ds.map(x => x.start).filter(Boolean).sort()[0] || d.start || '', laatste = ds.map(x => x.eind).filter(Boolean).sort().slice(-1)[0] || '';
    const t = ics({ naam: `${d.titel} (vrijwilliger: ${ds.map(x => x.naam).join(', ')})`, datum: d.datum, start: eerste, eind: laatste, locatie: d.locatie || '', omschrijving: location.href }, { id: deelId + '-' + uid });
    if (!t) return;
    const url = URL.createObjectURL(new Blob([t], { type: 'text/calendar;charset=utf-8' })), a = document.createElement('a');
    a.href = url; a.download = 'vrijwilliger.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
