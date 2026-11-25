/* ==================== KANTINE-TV [20261125w] ====================
   Wordt aangeroepen door main.js zodra de URL ?scherm=<id> bevat, los van de normale login.
   De tv in de kantine: het wedstrijdprogramma van vandaag (tijd, teams, veld, kleedkamer, stand),
   sponsoren en eigen schermen van de club, en een mededeling. Op een telefoon dezelfde inhoud onder elkaar.

   Zelfde opzet als live-boot.js (en dezelfde stijl): anoniem inloggen, clubTv/{id} en de subcollectie
   schermen lezen. Het bestuur beheert het in Activiteiten › Kantine-tv en sponsoren; het programma
   houdt de Cloud Function kantineTv bij. Geen persoonsgegevens. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, collection, onSnapshot } from './firebase.js?v=20261011g';
import { plaatjeOk, veiligeLink } from './toernooi-logica.js?v=20261125w';
import { sorteer } from './clubscherm-logica.js?v=20261125w';
import { stijl as stijlLive } from './live-boot.js?v=20261125w';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
const nuMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const min = t => /^\d{1,2}:\d{2}$/.test(t || '') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : 9999;
const melding = (titel, tekst) => `<div class="lv lv-midden"><h1>${esc(titel)}</h1><p>${esc(tekst)}</p></div>`;
const PER = 8;      /* wedstrijden per pagina op de tv */

export async function bootSchermPagina(tvId){
  const el = document.getElementById('deel');
  if (!el) return;
  stijlLive(); stijl();
  el.style.display = 'block';
  const breed = () => innerWidth >= 900;
  el.innerHTML = melding('Even geduld', 'Het scherm wordt geladen…');
  try { await authKlaar(); await sessie(false); }
  catch { el.innerHTML = melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.'); return; }
  const st = { d: null, items: [], tik: 0, hersteld: false };
  let stops = [];
  function luister(){
    stops.push(onSnapshot(doc(db, 'clubTv', tvId), s => {
      if (!s.exists()){ if (s.metadata?.fromCache && !st.d) return; st.d = null; el.innerHTML = melding('Deze link werkt niet (meer)', 'Vraag het bestuur om een nieuwe link.'); return; }
      st.d = s.data(); document.title = `${st.d.clubNaam || 'Club'} · vandaag`; teken();
    }, async e => {
      console.error('[Cluppie] scherm', e);
      if (e?.code === 'permission-denied' && !st.hersteld){ st.hersteld = true; stops.forEach(u => u()); stops = []; try { await sessie(true); luister(); return; } catch { /* door */ } }
      el.innerHTML = e?.code === 'permission-denied' ? melding('Dit scherm staat uit', 'Het bestuur heeft de kantine-tv (nog) niet aan staan.') : melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.');
    }));
    stops.push(onSnapshot(collection(db, 'clubTv', tvId, 'schermen'), s => { st.items = sorteer(s.docs.map(d => ({ id: d.id, ...d.data() }))); if (st.d) teken(); }, () => {}));
  }
  luister();
  setInterval(() => { st.tik++; if (st.d) teken(); }, 12000);
  addEventListener('resize', () => { if (st.d) teken(); });
  /* een tv die dagen aan staat: elke nacht verversen, zodat een nieuwe versie van de pagina meekomt */
  setInterval(() => { const d = new Date(); if (d.getHours() === 4 && d.getMinutes() < 2) location.reload(); }, 60000);

  const rij = w => `<div class="lv-wed ks-wed ${w.afgelast ? 'ks-af' : ''}" style="--pk:${w.thuis ? 'var(--accent)' : 'var(--hair)'}">
      <span class="lv-wed-v"><b>${esc(w.tijd || '–')}</b>${esc(w.afgelast ? 'Afgelast' : [w.veld, w.kk ? 'kk ' + w.kk : ''].filter(Boolean).join(' · ') || (w.thuis ? '' : 'uit'))}</span>
      <span class="lv-wed-a">${esc(w.a)}</span><span class="lv-wed-u ${w.stand ? 'klaar' : ''}">${esc(w.stand || '–')}</span><span class="lv-wed-b">${esc(w.b)}</span></div>`;
  const dia = x => `<section class="lv-kaart lv-dia ${x.soort === 'sponsor' ? 'sponsor' : ''}">${x.soort === 'sponsor' ? `<small class="lv-zacht">${x.pakket === 'hoofd' ? 'Onze hoofdsponsor' : 'Met dank aan onze sponsor'}</small>` : ''}${plaatjeOk(x.img) ? `<div class="lv-dia-img"><img src="${esc(x.img)}" alt=""></div>` : ''}${x.titel ? `<h2>${esc(x.titel)}</h2>` : ''}${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</section>`;
  const balk = (lijst, klik) => lijst.length ? `<div class="lv-sponsors">${lijst.map(x => { const b = plaatjeOk(x.img) ? `<img src="${esc(x.img)}" alt="${esc(x.titel)}">` : `<b>${esc(x.titel)}</b>`, l = veiligeLink(x.link); return l && klik ? `<a href="${esc(l)}" target="_blank" rel="noopener sponsored">${b}</a>` : `<span>${b}</span>`; }).join('')}</div>` : '';

  function teken(){
    const d = st.d; if (!d) return;
    const tv = breed(), isVandaag = d.datum === vandaag();
    const alles = isVandaag ? (d.programma || []).filter(w => d.uit !== false || w.thuis) : [];
    const spons = st.items.filter(x => x.soort === 'sponsor' && (x.titel || x.img)), dias = st.items.filter(x => x.titel || x.tekst || x.img);
    const logo = plaatjeOk(d.logo) ? `<img class="lv-logo" src="${esc(d.logo)}" alt="">` : '', kleur = /^#[0-9a-f]{6}$/i.test(d.kleur || '') ? ` style="--accent:${d.kleur}"` : '';
    const dag = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    const klok = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    if (!tv){
      el.innerHTML = `<div class="lv"${kleur}><header class="lv-kop">${logo}<div><small>${esc(dag)}</small><h1>${esc(d.clubNaam || 'Vandaag')}</h1></div></header>
        ${d.mededeling ? `<div class="lv-banner">${esc(d.mededeling)}</div>` : ''}
        <section class="lv-kaart"><h2>Vandaag</h2>${alles.map(rij).join('') || '<p>Vandaag staan er geen wedstrijden op het programma.</p>'}</section>
        ${dias.filter(x => x.soort !== 'sponsor').map(dia).join('')}
        ${spons.length ? `<section class="lv-kaart"><h2>Sponsoren</h2>${balk(spons, true)}</section>` : ''}<p class="lv-voet">Werkt zichzelf bij · Cluppie</p></div>`;
      return;
    }
    /* tv: links het programma (de pagina waar we nu zijn eerst), rechts wisselend een dia; zonder dia's twee kolommen programma */
    const n = nuMin(), komend = alles.findIndex(w => min(w.tijd) + 100 >= n), start = Math.max(0, komend < 0 ? alles.length - PER : komend);
    const kolommen = dias.length ? 1 : 2, perBeeld = PER * kolommen, paginas = Math.max(1, Math.ceil(Math.max(0, alles.length - start) / perBeeld)), pag = st.tik % paginas;
    const deel = alles.slice(start + pag * perBeeld, start + pag * perBeeld + perBeeld), beurt = dias.length ? dias[st.tik % dias.length] : null;
    const lijst = l => l.map(rij).join('');
    el.innerHTML = `<div class="lv lv-tv"${kleur}><header class="lv-tvkop">${logo}<div class="lv-tvtitel"><small>${esc(dag)}</small><h1>${esc(d.clubNaam || 'Vandaag')}</h1></div><span class="lv-klok">${esc(klok)}</span></header>
      <main class="lv-tvmain"><div class="lv-tvkolom"><section class="lv-kaart ks-prog"><h2>Vandaag op het programma${paginas > 1 ? ` <small>${pag + 1} / ${paginas}</small>` : ''}</h2>
          ${deel.length ? lijst(deel.slice(0, PER)) : `<p class="ks-leeg">${alles.length ? 'Alle wedstrijden van vandaag zijn gespeeld.' : 'Vandaag staan er geen wedstrijden op het programma.'}</p>`}</section></div>
        <div class="lv-tvkolom">${beurt ? dia(beurt) : deel.length > PER ? `<section class="lv-kaart ks-prog"><h2>&nbsp;</h2>${lijst(deel.slice(PER))}</section>` : `<section class="lv-kaart lv-dia"><h2>Welkom bij ${esc(d.clubNaam || 'de club')}</h2><p>Veel plezier vandaag!</p></section>`}</div></main>
      ${spons.length ? `<div class="lv-tvspons"><small>Sponsoren</small>${balk(spons, false)}</div>` : ''}
      ${d.mededeling ? `<footer class="lv-tvvoet"><div class="lv-ticker">${esc(d.mededeling)}</div></footer>` : ''}</div>`;
    document.documentElement.classList.add('lv-tv-html');
  }
}

function stijl(){
  if (document.getElementById('ksStijl')) return;
  const s = document.createElement('style'); s.id = 'ksStijl';
  s.textContent = `
.ks-wed{grid-template-columns:92px minmax(0,1fr) 58px minmax(0,1fr)}
.ks-af{opacity:.55}.ks-af .lv-wed-a,.ks-af .lv-wed-b{text-decoration:line-through}
.lv-tv .ks-wed{grid-template-columns:9.5em minmax(0,1fr) 4.6em minmax(0,1fr);font-size:1.15em;padding:.42em 0 .42em .6em}
.lv-tv .ks-prog{flex:1;min-height:0;overflow:hidden}.ks-leeg{font-size:1.3em}
@media (max-width:420px){.ks-wed{grid-template-columns:78px minmax(0,1fr) 46px minmax(0,1fr)}}`;
  document.head.appendChild(s);
}
