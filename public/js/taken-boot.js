/* ==================== VRIJWILLIGERSBANK (openbare pagina) [20261125w] ====================
   Wordt aangeroepen door main.js zodra de URL ?taken=<id> bevat, los van de normale login.
   Leden, ouders en buurtgenoten zien hier waar de club vrijwilligers voor zoekt. Per taak staat
   precies wat je doet (in stappen), wanneer, hoe lang, waar en bij wie je terecht kunt.
   Aanmelden kan zonder account: naam en een e-mailadres of telefoonnummer.

   Zelfde opzet als inschrijf-boot.js: anoniem inloggen, vrijwilligersBank/{id} lezen en een eigen
   aanmelding maken onder het vaste id <uid>_<taak>. Contactgegevens leest alleen het clubbeheer en
   dit toestel zelf (firestore.rules). */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, collection, query, where, setDoc, deleteDoc, onSnapshot } from './firebase.js?v=20261011g';
import * as V from './vrijwilligers-logica.js?v=20261130g';
import { plaatjeOk } from './toernooi-logica.js?v=20261130g';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLEUTEL = 'cluppieVrijwilligerContact';
const authKlaar = () => new Promise(k => { const stop = onAuthStateChanged(auth, () => { stop(); k(); }, () => k()); });
async function sessie(forceer){
  const u = auth.currentUser;
  if (u){
    try { await u.getIdToken(!!forceer); return; }
    catch (e){ if (e?.code === 'auth/network-request-failed') return; if (auth.currentUser?.isAnonymous){ try { await signOut(auth); } catch { /* dan maar zo */ } } }
  }
  if (!auth.currentUser) await signInAnonymously(auth);
}
const melding = (titel, tekst) => `<div class="vp vp-midden"><h1>${esc(titel)}</h1><p>${esc(tekst)}</p></div>`;

export async function bootTakenPagina(bankId){
  const el = document.getElementById('deel');
  if (!el) return;
  stijl();
  el.style.display = 'block';
  el.innerHTML = melding('Even geduld', 'De taken worden geladen…');
  try { await authKlaar(); await sessie(false); }
  catch { el.innerHTML = melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.'); return; }
  let uid = auth.currentUser.uid;
  const st = { d: null, mijn: [], cat: '', open: '', form: { naam: '', contact: '', opm: '' }, fout: '', foutVeld: '', bezig: false, hersteld: false };
  try { Object.assign(st.form, JSON.parse(localStorage.getItem(SLEUTEL) || '{}')); } catch { /* geen opslag */ }
  let stops = [];
  const stopAlles = () => { stops.forEach(u => { try { u(); } catch { /* al gestopt */ } }); stops = []; };

  function luister(){
    stops.push(onSnapshot(doc(db, 'vrijwilligersBank', bankId), s => {
      if (!s.exists()){ if (s.metadata?.fromCache && !st.d) return; st.d = null; el.innerHTML = melding('Deze link werkt niet (meer)', 'Vraag de club om een nieuwe link.'); return; }
      st.d = s.data(); document.title = `Vrijwilligers ${st.d.clubNaam || ''}`.trim(); teken();
    }, async e => {
      console.error('[Cluppie] vrijwilligersbank', e);
      if (e?.code === 'permission-denied' && !st.hersteld){ st.hersteld = true; stopAlles(); try { await sessie(true); uid = auth.currentUser.uid; luister(); return; } catch { /* door */ } }
      el.innerHTML = e?.code === 'permission-denied' ? melding('Deze pagina staat dicht', 'De club heeft de vrijwilligersbank gesloten. Vraag het even na bij de club.') : melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.');
    }));
    stops.push(onSnapshot(query(collection(db, 'vrijwilligersBank', bankId, 'aanmeldingen'), where('uid', '==', uid)), s => {
      st.mijn = s.docs.map(d => ({ id: d.id, ...d.data() })); if (st.d) teken();
    }, () => { /* eigen aanmeldingen niet te lezen: aanmelden werkt nog */ }));
  }
  luister();

  const lees = () => { el.querySelectorAll('[data-vp]').forEach(i => { st.form[i.dataset.vp] = i.value; }); };
  const statusTekst = { nieuw: 'Je bent aangemeld. De club neemt contact met je op.', gesproken: 'Je bent aangemeld. De club heeft contact met je gehad.', geplaatst: 'Je bent ingedeeld. Fijn dat je helpt!', afgewezen: 'Deze taak is al door iemand anders ingevuld. Dank voor je aanbod.' };

  function formulier(t){
    return `<div class="vp-form"><p><b>Aanmelden voor ${esc(t.titel)}</b></p>
      <div class="veldgroep"><label for="vp_naam">Je naam</label><input class="invoer ${st.foutVeld === 'naam' ? 'fout' : ''}" id="vp_naam" data-vp="naam" maxlength="60" autocomplete="name" value="${esc(st.form.naam || '')}"></div>
      <div class="veldgroep"><label for="vp_contact">E-mailadres of telefoonnummer</label><input class="invoer ${st.foutVeld === 'contact' ? 'fout' : ''}" id="vp_contact" data-vp="contact" maxlength="120" value="${esc(st.form.contact || '')}"></div>
      <div class="veldgroep"><label for="vp_opm">Opmerking (mag leeg)</label><textarea class="invoer" id="vp_opm" data-vp="opm" rows="2" maxlength="300" placeholder="Bijvoorbeeld: wanneer je wel en niet kunt.">${esc(st.form.opm || '')}</textarea></div>
      <div class="vp-fout" role="alert" ${st.fout ? '' : 'hidden'}>${esc(st.fout)}</div>
      <div class="vp-knoppen"><button class="knop fluo" data-vp-stuur="${esc(t.id)}" ${st.bezig ? 'disabled' : ''}>${st.bezig ? 'Bezig…' : 'Aanmelden'}</button><button class="knop" data-vp-dicht>Annuleren</button></div>
      <p class="vp-zacht">Je zit nog nergens aan vast: de club neemt eerst contact met je op. Alleen de club ziet je gegevens.</p></div>`;
  }
  function kaart(t){
    const mijn = st.mijn.find(a => a.taak === t.id), nog = V.nogNodig(t), vervuld = t.status === 'vervuld' || nog === 0;
    const feiten = [['Wanneer', t.moment], ['Hoe lang', t.duur], ['Waar', t.waar], ['Voor wie', t.voorWie], ['Dit krijg je', t.krijgt], ['Vragen', t.contact]].filter(([, w]) => w);
    return `<article class="vp-kaart ${vervuld ? 'vervuld' : ''}" id="vp_${esc(t.id)}">
      <div class="vp-kop"><div><small>${esc([V.CATS[t.cat], V.FREQ[t.freq]].filter(Boolean).join(' · '))}</small><h2>${esc(t.titel)}</h2></div>
        <span class="vp-tag ${vervuld ? 'ok' : ''}">${vervuld ? '✓ Vervuld' : nog === null ? 'Gezocht' : `Nog ${nog} gezocht`}</span></div>
      ${t.wat ? `<p>${esc(t.wat)}</p>` : ''}
      ${t.stappen.length ? `<p class="vp-sub">Dit doe je precies</p><ol>${t.stappen.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${feiten.length ? `<dl>${feiten.map(([k, w]) => `<div><dt>${k}</dt><dd>${esc(w)}</dd></div>`).join('')}</dl>` : ''}
      ${mijn ? `<div class="vp-mijn"><b>${esc(statusTekst[mijn.status] || statusTekst.nieuw)}</b>${mijn.status === 'geplaatst' ? '' : `<button class="knop vp-klein" data-vp-weg="${esc(mijn.id)}">Aanmelding intrekken</button>`}</div>`
        : vervuld ? '' : st.open === t.id ? formulier(t) : `<button class="knop fluo vp-breed" data-vp-open="${esc(t.id)}">Dit wil ik doen</button>`}
    </article>`;
  }
  function teken(){
    const d = st.d; if (!d) return;
    if (el.querySelector('[data-vp]')) lees();
    const alle = V.zichtbaar(V.takenLijst(d.taken)), cats = Object.keys(V.CATS).filter(c => alle.some(t => t.cat === c));
    if (st.cat && !cats.includes(st.cat)) st.cat = '';
    const taken = alle.filter(t => !st.cat || t.cat === st.cat).sort((a, b) => (a.status === 'vervuld') - (b.status === 'vervuld'));
    const nOpen = alle.filter(t => t.status === 'open' && V.nogNodig(t) !== 0).length;
    el.innerHTML = `<div class="vp"${/^#[0-9a-f]{6}$/i.test(d.kleur || '') ? ` style="--accent:${d.kleur}"` : ''}>
      <header>${plaatjeOk(d.logo) ? `<img class="vp-logo" src="${esc(d.logo)}" alt="">` : ''}<div><small>${esc(d.clubNaam || '')}</small><h1>Help je mee?</h1>
        <p class="vp-zacht">${nOpen === 1 ? 'Er staat 1 taak open' : `Er staan ${nOpen} taken open`}. Bij elke taak staat precies wat je doet.</p></div></header>
      ${d.intro ? `<p class="vp-intro">${esc(d.intro)}</p>` : ''}
      ${cats.length > 1 ? `<nav class="vp-filter" aria-label="Soort taak"><button class="${st.cat ? '' : 'aan'}" data-vp-cat="">Alles</button>${cats.map(c => `<button class="${st.cat === c ? 'aan' : ''}" data-vp-cat="${c}">${esc(V.CATS[c])}</button>`).join('')}</nav>` : ''}
      ${taken.map(kaart).join('') || '<article class="vp-kaart"><p>Er staan op dit moment geen taken open. Kom later nog eens kijken.</p></article>'}
      ${d.contact || d.contactMail ? `<p class="vp-voet">Vragen of een ander idee? ${esc(d.contact || '')}${d.contactMail ? ` <a href="mailto:${esc(d.contactMail)}">${esc(d.contactMail)}</a>` : ''}</p>` : ''}
      <p class="vp-voet">Cluppie</p></div>`;
    if (st.foutVeld) el.querySelector(`#vp_${st.foutVeld}`)?.focus();
  }

  async function stuur(taak){
    if (st.bezig) return;
    lees();
    const r = V.schoneAanmelding(st.form);
    if (!r.ok){ st.fout = r.fout; st.foutVeld = r.veld; return teken(); }
    st.bezig = true; st.fout = ''; st.foutVeld = ''; teken();
    try {
      await setDoc(doc(db, 'vrijwilligersBank', bankId, 'aanmeldingen', `${uid}_${taak}`), { uid, taak, ...r.data, ms: Date.now(), status: 'nieuw' });
      try { localStorage.setItem(SLEUTEL, JSON.stringify({ naam: r.data.naam, contact: r.data.contact })); } catch { /* geen opslag */ }
      st.form.opm = ''; st.open = '';
    } catch (e){
      console.error('[Cluppie] vrijwilligersbank', e);
      st.fout = e?.code === 'permission-denied' ? 'Aanmelden kan niet meer: de club heeft de pagina gesloten of de taak is weg.' : 'Aanmelden is niet gelukt. Controleer je verbinding en probeer het nog een keer.';
    }
    st.bezig = false; teken();
  }

  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.vpCat !== undefined){ st.cat = b.dataset.vpCat; return teken(); }
    if (b.dataset.vpOpen){ st.open = b.dataset.vpOpen; st.fout = ''; st.foutVeld = ''; teken(); el.querySelector('#vp_naam')?.focus(); return; }
    if (b.dataset.vpDicht !== undefined){ lees(); st.open = ''; st.fout = ''; st.foutVeld = ''; return teken(); }
    if (b.dataset.vpStuur) return stuur(b.dataset.vpStuur);
    if (b.dataset.vpWeg && confirm('Je aanmelding intrekken?')){ try { await deleteDoc(doc(db, 'vrijwilligersBank', bankId, 'aanmeldingen', b.dataset.vpWeg)); } catch { alert('Intrekken is niet gelukt.'); } }
  });
}

function stijl(){
  if (document.getElementById('vpStijl')) return;
  const s = document.createElement('style'); s.id = 'vpStijl';
  s.textContent = `
.vp{max-width:620px;margin:0 auto;padding:16px 16px calc(28px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;color:var(--ink)}
.vp-midden{min-height:60vh;justify-content:center;text-align:center}
.vp h1{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-3xl,30px);line-height:1;margin:2px 0 4px}
.vp header{display:flex;align-items:center;gap:12px}.vp header>div{min-width:0}.vp-logo{width:64px;height:64px;object-fit:contain;flex-shrink:0;border-radius:10px;background:#fff;padding:3px}
.vp header small{color:var(--ink-2);font-size:var(--t-sm,14px)}
.vp-zacht{color:var(--ink-2);font-size:var(--t-sm,14px);margin:0}.vp-intro{margin:0;white-space:pre-line}
.vp-filter{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.vp-filter::-webkit-scrollbar{display:none}
.vp-filter button{flex-shrink:0;min-height:40px;padding:6px 14px;border-radius:999px;border:1px solid var(--hair);background:var(--card);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.vp-filter button.aan{background:var(--accent);border-color:var(--accent);color:var(--accent-ink,#fff)}
.vp-kaart{background:var(--card);border-radius:var(--r-m,14px);padding:14px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:8px}
.vp-kaart.vervuld{opacity:.7}
.vp-kaart p{margin:0}.vp-kaart ol{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:3px}
.vp-kop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.vp-kop>div{min-width:0}
.vp-kop small{color:var(--ink-2);font-size:var(--t-sm,14px)}
.vp-kop h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-xl,21px);line-height:1.1;margin:2px 0 0}
.vp-tag{flex-shrink:0;border-radius:999px;padding:4px 10px;font-size:var(--t-sm,14px);font-weight:700;background:color-mix(in srgb,var(--accent) 16%,var(--card));white-space:nowrap}
.vp-tag.ok{background:color-mix(in srgb,var(--ok,#16a34a) 18%,var(--card))}
.vp-sub{font-weight:700}
.vp-kaart dl{margin:0;display:flex;flex-direction:column;border-top:1px solid var(--hair)}
.vp-kaart dl>div{display:grid;grid-template-columns:104px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid var(--hair)}
.vp-kaart dt{color:var(--ink-2);font-size:var(--t-sm,14px)}.vp-kaart dd{margin:0}
.vp-breed{width:100%;min-height:48px;justify-content:center}.vp-klein{min-height:36px;padding:6px 12px;font-size:var(--t-sm,14px)}
.vp-form{border:2px solid var(--accent);border-radius:var(--r-s,10px);padding:12px;display:flex;flex-direction:column;gap:8px}.vp-form .veldgroep{margin:0}
.vp .invoer{font-size:16px}.vp .invoer.fout{border-color:var(--uit,#e11)}
.vp-knoppen{display:flex;gap:8px;flex-wrap:wrap}.vp-knoppen .knop{min-height:46px}
.vp-fout{background:color-mix(in srgb,var(--uit,#e11) 16%,var(--card));border-radius:var(--r-s,10px);padding:8px 10px;font-weight:600}
.vp-mijn{background:color-mix(in srgb,var(--ok,#16a34a) 14%,var(--card));border-radius:var(--r-s,10px);padding:10px 12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.vp-voet{text-align:center;color:var(--ink-2);font-size:var(--t-sm,14px);margin:4px 0 0}.vp-voet a{color:var(--accent)}`;
  document.head.appendChild(s);
}
