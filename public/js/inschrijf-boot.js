/* ==================== TOERNOOI INSCHRIJVEN [20261125w] ====================
   Wordt aangeroepen door main.js zodra de URL ?inschrijf=<id> bevat, los van de normale login.
   Een gastclub, school of bedrijf schrijft hier zonder account een team in voor een toernooi.
   Het comité ziet de inschrijving direct in Activiteiten › Toernooi › Inschrijven en laat het team toe.

   Zelfde opzet als activiteit-boot.js en live-boot.js: anoniem inloggen, het document
   toernooiInschrijf/{id} lezen (categorieën, prijs, betaalinformatie) en eigen aanmeldingen maken
   onder het vaste id <uid>_<0-9>. Contactgegevens leest alleen het comité en dit toestel zelf
   (firestore.rules). Online betalen zit er niet in: de club zet er een betaallink of rekeningnummer bij. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, collection, query, where, setDoc, deleteDoc, onSnapshot } from './firebase.js?v=20261011g';
import * as T from './toernooi-logica.js?v=20261130n';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLEUTEL = 'cluppieInschrijfContact';
const authKlaar = () => new Promise(k => { const stop = onAuthStateChanged(auth, () => { stop(); k(); }, () => k()); });
async function sessie(forceer){
  const u = auth.currentUser;
  if (u){
    try { await u.getIdToken(!!forceer); return; }
    catch (e){ if (e?.code === 'auth/network-request-failed') return; if (auth.currentUser?.isAnonymous){ try { await signOut(auth); } catch { /* dan maar zo */ } } }
  }
  if (!auth.currentUser) await signInAnonymously(auth);
}
const vandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const datumLang = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? new Date(s + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
const melding = (titel, tekst) => `<div class="is is-midden"><h1>${esc(titel)}</h1><p>${esc(tekst)}</p></div>`;

export async function bootInschrijfPagina(insId){
  const el = document.getElementById('deel');
  if (!el) return;
  stijl();
  el.style.display = 'block';
  el.innerHTML = melding('Even geduld', 'De inschrijfpagina wordt geladen…');
  try { await authKlaar(); await sessie(false); }
  catch { el.innerHTML = melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.'); return; }
  let uid = auth.currentUser.uid;
  const st = { d: null, mijn: [], form: { club: '', team: '', cat: '', contact: '', email: '', tel: '', opm: '' }, fout: '', foutVeld: '', bezig: false, klaar: '', nogEen: false, hersteld: false };
  try { Object.assign(st.form, JSON.parse(localStorage.getItem(SLEUTEL) || '{}')); } catch { /* geen opslag */ }
  let stops = [];
  const stopAlles = () => { stops.forEach(u => { try { u(); } catch { /* al gestopt */ } }); stops = []; };

  function luister(){
    stops.push(onSnapshot(doc(db, 'toernooiInschrijf', insId), s => {
      if (!s.exists()){ if (s.metadata?.fromCache && !st.d) return; st.d = null; el.innerHTML = melding('Deze link werkt niet (meer)', 'Vraag de organisatie om een nieuwe link.'); return; }
      st.d = s.data(); document.title = `Inschrijven ${st.d.naam || 'toernooi'}`; teken();
    }, async e => {
      console.error('[Cluppie] inschrijven', e);
      if (e?.code === 'permission-denied' && !st.hersteld){ st.hersteld = true; stopAlles(); try { await sessie(true); uid = auth.currentUser.uid; luister(); return; } catch { /* door */ } }
      el.innerHTML = e?.code === 'permission-denied' ? melding('Inschrijven kan niet meer', 'De inschrijving is gesloten. Neem contact op met de organisatie.') : melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.');
    }));
    stops.push(onSnapshot(query(collection(db, 'toernooiInschrijf', insId, 'aanmeldingen'), where('uid', '==', uid)), s => {
      st.mijn = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ms || 0) - (b.ms || 0)); if (st.d) teken();
    }, () => { /* eigen inschrijvingen niet te lezen: het formulier werkt nog */ }));
  }
  luister();

  const lees = () => { el.querySelectorAll('[data-is]').forEach(i => { st.form[i.dataset.is] = i.value; }); };
  const inv = (k, label, o = {}) => `<div class="veldgroep"><label for="is_${k}">${esc(label)}</label><input class="invoer ${st.foutVeld === k ? 'fout' : ''}" id="is_${k}" data-is="${k}" type="${o.type || 'text'}" value="${esc(st.form[k] || '')}" placeholder="${esc(o.ph || '')}" maxlength="${o.max || 60}" ${o.extra || ''}></div>`;

  function teken(){
    const d = st.d; if (!d) return;
    if (el.querySelector('[data-is]')) lees();
    const SO = T.SOORTEN[d.soort] || T.SOORTEN.vereniging, cats = T.gesorteerd(d.cats), dicht = T.inschrijvingDicht(d, vandaag());
    const mijn = st.mijn, prijsTotaal = mijn.filter(x => x.status !== 'afgewezen' && !x.betaald).reduce((s, x) => s + (d.cats?.[x.cat]?.prijs || 0), 0);
    const toonForm = !dicht && mijn.length < 10 && (!mijn.length || st.nogEen);
    const statusTekst = { nieuw: 'Ontvangen, de organisatie bevestigt nog', toegelaten: 'Toegelaten, jullie doen mee', wachtlijst: 'Op de wachtlijst', afgewezen: 'Niet toegelaten' };
    el.innerHTML = `<div class="is"${/^#[0-9a-f]{6}$/i.test(d.kleur || '') ? ` style="--accent:${d.kleur}"` : ''}>
      <header>${T.plaatjeOk(d.logo) ? `<img class="is-logo" src="${esc(d.logo)}" alt="">` : ''}<div><small>${esc([d.clubNaam, datumLang(d.datum)].filter(Boolean).join(' · '))}</small><h1>${esc(d.naam || 'Toernooi')}</h1>
        <p class="is-zacht">${esc([d.start ? 'Aanvang ' + d.start : '', d.locatie].filter(Boolean).join(' · '))}</p></div></header>
      ${d.tekst ? `<section class="is-kaart"><p class="is-tekst">${esc(d.tekst)}</p></section>` : ''}
      <section class="is-kaart"><h2>Categorieën</h2>${cats.map(c => `<div class="is-rij"><span><b>${esc(c.naam)}</b><small>${c.max ? `${Math.max(0, c.max - (c.bezet || 0))} van ${c.max} plekken vrij` : 'Plek genoeg'}</small></span><b>${c.prijs ? esc(T.euro(c.prijs)) : 'Gratis'}</b></div>`).join('')}
        ${d.tot ? `<p class="is-zacht">Inschrijven kan tot en met ${esc(datumLang(d.tot))}.</p>` : ''}</section>
      ${mijn.length ? `<section class="is-kaart is-mijn"><h2>Jouw ${mijn.length === 1 ? 'inschrijving' : 'inschrijvingen'}</h2>
          ${mijn.map(x => `<div class="is-rij"><span><b>${esc(x.club)}${x.team && x.team !== x.club ? ' · ' + esc(x.team) : ''}</b><small>${esc(d.cats?.[x.cat]?.naam || '')} · ${esc(statusTekst[x.status] || statusTekst.nieuw)}${x.betaald ? ' · betaald' : ''}</small></span>
            ${x.status === 'toegelaten' ? '' : `<button class="knop is-klein" data-is-weg="${esc(x.id)}">Intrekken</button>`}</div>`).join('')}
          ${prijsTotaal ? `<div class="is-betaal"><b>Nog te betalen: ${esc(T.euro(prijsTotaal))}</b>${d.betaal ? `<p class="is-tekst">${esc(d.betaal)}</p>` : ''}${d.betaalLink ? `<a class="knop fluo" href="${esc(d.betaalLink)}" target="_blank" rel="noopener">Nu betalen</a>` : ''}</div>` : ''}
          <p class="is-zacht">Bewaar deze link: op dit toestel zie je hier of jullie zijn toegelaten.</p>
          ${!toonForm && !dicht && mijn.length < 10 ? '<button class="knop" data-is-nog>Nog een team inschrijven</button>' : ''}</section>` : ''}
      ${dicht ? '<section class="is-kaart"><p><b>De inschrijving is gesloten.</b> Neem voor vragen contact op met de organisatie.</p></section>' : ''}
      ${toonForm ? `<section class="is-kaart"><h2>${mijn.length ? 'Nog een team' : 'Team inschrijven'}</h2>
          ${inv('club', `Naam van je ${SO.een}`, { ph: SO.vb })}
          <div class="veldgroep"><label for="is_cat">Categorie</label><select class="invoer ${st.foutVeld === 'cat' ? 'fout' : ''}" id="is_cat" data-is="cat"><option value="">Kies…</option>${cats.map(c => `<option value="${esc(c.id)}"${st.form.cat === c.id ? ' selected' : ''}>${esc(c.naam)}${c.prijs ? ' · ' + esc(T.euro(c.prijs)) : ''}${T.catVol(c) ? ' (vol, wachtlijst)' : ''}</option>`).join('')}</select></div>
          ${inv('team', `Naam van je ${SO.team} (mag leeg)`, { ph: SO.teamVb, max: 40 })}
          ${inv('contact', 'Contactpersoon', { ph: 'Voor- en achternaam', extra: 'autocomplete="name"' })}
          ${inv('email', 'E-mailadres', { type: 'email', max: 120, extra: 'autocomplete="email" inputmode="email"' })}
          ${inv('tel', 'Telefoon (mag leeg, handig op de dag zelf)', { type: 'tel', max: 20, extra: 'autocomplete="tel" inputmode="tel"' })}
          <div class="veldgroep"><label for="is_opm">Opmerking (mag leeg)</label><textarea class="invoer" id="is_opm" data-is="opm" rows="2" maxlength="300" placeholder="Bijvoorbeeld: niveau, of met hoeveel spelers jullie komen.">${esc(st.form.opm || '')}</textarea></div>
          <div class="is-fout" role="alert" ${st.fout ? '' : 'hidden'}>${esc(st.fout)}</div>
          <button class="knop fluo is-breed" data-is-stuur ${st.bezig ? 'disabled' : ''}>${st.bezig ? 'Bezig…' : 'Inschrijven'}</button>
          <p class="is-zacht">De organisatie gebruikt je gegevens alleen voor dit toernooi. Andere deelnemers zien ze niet.</p></section>` : ''}
      ${d.contact || d.contactMail ? `<p class="is-voet">Vragen? ${esc(d.contact || '')}${d.contactMail ? ` <a href="mailto:${esc(d.contactMail)}">${esc(d.contactMail)}</a>` : ''}</p>` : ''}
      <p class="is-voet">Cluppie</p></div>`;
    if (st.foutVeld) el.querySelector(`#is_${st.foutVeld}`)?.focus();
  }

  async function stuur(){
    if (st.bezig) return;
    lees();
    const r = T.schoneInschrijving(st.form, st.d.cats || {});
    if (!r.ok){ st.fout = r.fout; st.foutVeld = r.veld; return teken(); }
    const vrij = [...Array(10).keys()].find(n => !st.mijn.some(x => x.id === `${uid}_${n}`));
    if (vrij === undefined){ st.fout = 'Je kunt vanaf dit toestel hooguit tien teams inschrijven. Neem contact op met de organisatie.'; st.foutVeld = ''; return teken(); }
    st.bezig = true; st.fout = ''; st.foutVeld = ''; teken();
    try {
      await setDoc(doc(db, 'toernooiInschrijf', insId, 'aanmeldingen', `${uid}_${vrij}`), { uid, ...r.data, ms: Date.now(), status: 'nieuw' });
      try { localStorage.setItem(SLEUTEL, JSON.stringify({ club: r.data.club, contact: r.data.contact, email: r.data.email, tel: r.data.tel })); } catch { /* geen opslag */ }
      st.form.team = ''; st.form.opm = ''; st.form.cat = ''; st.nogEen = false;
    } catch (e){
      console.error('[Cluppie] inschrijven', e);
      st.fout = e?.code === 'permission-denied' ? 'Inschrijven kan niet meer: de inschrijving is gesloten.' : 'Inschrijven is niet gelukt. Controleer je verbinding en probeer het nog een keer.';
    }
    st.bezig = false; teken(); scrollTo(0, 0);
  }

  el.addEventListener('click', async e => {
    if (e.target.closest('[data-is-stuur]')) return stuur();
    if (e.target.closest('[data-is-nog]')){ st.nogEen = true; teken(); el.querySelector('#is_cat')?.scrollIntoView({ block: 'center' }); return; }
    const weg = e.target.closest('[data-is-weg]');
    if (weg && confirm('Deze inschrijving intrekken?')){ try { await deleteDoc(doc(db, 'toernooiInschrijf', insId, 'aanmeldingen', weg.dataset.isWeg)); } catch { alert('Intrekken is niet gelukt.'); } }
  });
}

function stijl(){
  if (document.getElementById('isStijl')) return;
  const s = document.createElement('style'); s.id = 'isStijl';
  s.textContent = `
.is{max-width:560px;margin:0 auto;padding:16px 16px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;color:var(--ink)}
.is-midden{min-height:60vh;justify-content:center;text-align:center}
.is h1{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-3xl,30px);line-height:1;margin:2px 0 4px}
.is header{display:flex;align-items:center;gap:12px}.is header>div{min-width:0}.is-logo{width:60px;height:60px;object-fit:contain;flex-shrink:0;border-radius:10px;background:#fff;padding:3px}
.is header small{color:var(--ink-2);font-size:var(--t-sm,14px)}
.is-kaart{background:var(--card);border-radius:var(--r-m,14px);padding:14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}
.is-kaart h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg,18px);margin:0}
.is-kaart p{margin:0}.is-kaart .veldgroep{margin:0}
.is-mijn{border:2px solid var(--accent)}
.is-zacht{color:var(--ink-2);font-size:var(--t-sm,14px);margin:0}
.is-tekst{white-space:pre-line}
.is-rij{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--hair)}
.is-rij span{display:flex;flex-direction:column;min-width:0}.is-rij small{color:var(--ink-2);font-size:var(--t-sm,14px)}
.is-betaal{background:color-mix(in srgb,var(--warn,#f59e0b) 18%,var(--card));border-radius:var(--r-s,10px);padding:10px 12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.is-fout{background:color-mix(in srgb,var(--uit,#e11) 16%,var(--card));border-radius:var(--r-s,10px);padding:8px 10px;font-weight:600}
.is .invoer{font-size:16px}.is .invoer.fout{border-color:var(--uit,#e11)}
.is-breed{width:100%;min-height:48px;justify-content:center}.is-klein{min-height:36px;padding:6px 12px;font-size:var(--t-sm,14px)}
.is-voet{text-align:center;color:var(--ink-2);font-size:var(--t-sm,14px);margin:4px 0 0}.is-voet a{color:var(--accent)}`;
  document.head.appendChild(s);
}
