/* ==================== KANTINE-TV [20261125w] ====================
   Wordt aangeroepen door main.js zodra de URL ?scherm=<id> bevat, los van de normale login.
   De tv in de kantine: het wedstrijdprogramma van vandaag (tijd, teams, veld, kleedkamer, stand),
   sponsoren en eigen schermen van de club, en een mededeling. Op een telefoon dezelfde inhoud onder elkaar.

   Zelfde opzet als live-boot.js (en dezelfde stijl): anoniem inloggen, clubTv/{id} en de subcollectie
   schermen lezen. Het bestuur beheert het in Activiteiten › Kantine-tv en sponsoren; het programma
   houdt de Cloud Function kantineTv bij. Geen persoonsgegevens.

   [20261126p] Sjablonen: de club kiest hoe de tv eruitziet (clubTv.sjabloon, lijst in tv-sjablonen.js). 'bord' is het
   tactisch bord hieronder; elk ander sjabloon speelt tv-speler.js af. Een doelpunt (de stand van een wedstrijd gaat
   omhoog) geeft een melding over het hele scherm; clubTv.goals zegt voor welke wedstrijden (zie nieuweGoals).
   Voorbeeld bekijken zonder iets op te slaan: ?scherm=<id>&sjabloon=<id>, en &proef=1 voor proefwedstrijden met doelpunten. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, collection, onSnapshot } from './firebase.js?v=20261011g';
import { plaatjeOk, veiligeLink } from './toernooi-logica.js?v=20261125w';
import { sorteer, nieuweGoals, goalKeuze, evenementId, evenementTv } from './clubscherm-logica.js?v=20261126t';
import { sjabloonId, laadSjabloon } from './tv-sjablonen.js?v=20261126t';
import { maakSpeler, tvModel, proefProgramma, PROEF_DIAS } from './tv-speler.js?v=20261126t';
import { stijl as stijlLive } from './live-boot.js?v=20261126n';
import { tvStijl, tvKleur, tvZet, bordHtml, logoHtml, tikHtml, diaHtml, sponsHtml, voetHtml } from './tv-stijl.js?v=20261126n';

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
  stijlLive(); stijl(); tvStijl();
  el.style.display = 'block';
  /* Tv-weergave vanaf 900 px breed, of liggend vanaf 640 px: veel tv-browsers en tv-sticks melden een kleinere
     breedte dan het scherm echt heeft (1280 x 720 met schaal 1,5 is 853 px). &tv=1 in de link dwingt het af. */
  const dwing = new URLSearchParams(location.search).get('tv') === '1';
  const breed = () => dwing || innerWidth >= 900 || (innerWidth >= 640 && innerWidth > innerHeight);
  el.innerHTML = melding('Even geduld', 'Het scherm wordt geladen…');
  const qs = new URLSearchParams(location.search), kiesSjabloon = qs.get('sjabloon') || '', proef = qs.get('proef') === '1';
  /* Voorbeeld van een sjabloon voor een club die de tv nog niet heeft aangezet: niets uit de database, alles proef. */
  const alleenVoorbeeld = tvId === 'voorbeeld' && proef;
  if (!alleenVoorbeeld) try { await authKlaar(); await sessie(false); }
  catch { el.innerHTML = melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.'); return; }
  const st = { evId: '', evStop: null, ev: null, d: null, items: [], tik: 0, hersteld: false, gezien: new Map(), speler: null, T: null, laadt: '', kapot: '' };
  let stops = [];
  function luister(){
    stops.push(onSnapshot(doc(db, 'clubTv', tvId), s => {
      if (!s.exists()){ if (s.metadata?.fromCache && !st.d) return; st.d = null; el.innerHTML = melding('Deze link werkt niet (meer)', 'Vraag het bestuur om een nieuwe link.'); return; }
      st.d = s.data(); document.title = `${st.d.clubNaam || 'Club'} · vandaag`; volgEvenement(evenementId(st.d.evenement)); teken();
    }, async e => {
      console.error('[Cluppie] scherm', e);
      if (e?.code === 'permission-denied' && !st.hersteld){ st.hersteld = true; stops.forEach(u => u()); stops = []; try { await sessie(true); luister(); return; } catch { /* door */ } }
      el.innerHTML = e?.code === 'permission-denied' ? melding('Dit scherm staat uit', 'Het bestuur heeft de kantine-tv (nog) niet aan staan.') : melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.');
    }));
    stops.push(onSnapshot(collection(db, 'clubTv', tvId, 'schermen'), s => { st.items = sorteer(s.docs.map(d => ({ id: d.id, ...d.data() }))); if (st.d) teken(); }, () => {}));
  }
  /* Een evenement (toernooi) dat de club op de tv heeft gezet: de live pagina van dat toernooi volgen. */
  function volgEvenement(id){
    if (id === st.evId) return;
    st.evStop?.(); st.evStop = null; st.ev = null; st.evId = id;
    if (id) st.evStop = onSnapshot(doc(db, 'toernooiLive', id), s => { st.ev = s.exists() ? s.data() : null; if (st.d) teken(); }, () => { st.ev = null; if (st.d) teken(); });
  }
  if (alleenVoorbeeld){
    const k = qs.get('kleur') || '';
    st.d = { clubNaam: (qs.get('naam') || 'Jouw club').slice(0, 80), kleur: /^#[0-9a-f]{6}$/i.test(k) ? k : '', open: true, uit: true, goals: 'park',
      mededeling: 'Zo ziet je mededeling eruit. Die zet je zelf bij de instellingen.' };
    document.title = 'Voorbeeld kantine-tv'; teken();
  } else luister();
  setInterval(() => { st.tik++; if (st.d) teken(); }, 12000);
  addEventListener('resize', () => { if (st.d) teken(); });
  /* een tv die dagen aan staat: elke nacht verversen, zodat een nieuwe versie van de pagina meekomt */
  setInterval(() => { const d = new Date(); if (d.getHours() === 4 && d.getMinutes() < 2) location.reload(); }, 60000);
  /* Staat er een nieuwe versie van Cluppie online, dan ververst de tv zichzelf binnen een kwartier (niet pas 's nachts). */
  const mijnVersie = (document.querySelector('script[src*="js/main.js"]')?.getAttribute('src') || '').split('v=')[1] || '';
  if (mijnVersie) setInterval(async () => {
    try {
      const r = await fetch(`index.html?nieuw=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return;
      const v = (/js\/main\.js\?v=([0-9a-z]+)/.exec(await r.text()) || [])[1];
      if (v && v !== mijnVersie) location.reload();
    } catch { /* geen verbinding: volgende keer */ }
  }, 15 * 60000);

  const rij = w => `<div class="lv-wed ks-wed ${w.afgelast ? 'ks-af' : ''}" style="--pk:${w.thuis ? 'var(--accent)' : 'var(--hair)'}">
      <span class="lv-wed-v"><b>${esc(w.tijd || '–')}</b>${esc(w.afgelast ? 'Afgelast' : [w.veld, w.kk ? 'kk ' + w.kk : ''].filter(Boolean).join(' · ') || (w.thuis ? '' : 'uit'))}</span>
      <span class="lv-wed-a">${esc(w.a)}</span><span class="lv-wed-u ${w.stand ? 'klaar' : ''}">${esc(w.stand || '–')}</span><span class="lv-wed-b">${esc(w.b)}</span></div>`;
  const dia = x => `<section class="lv-kaart lv-dia ${x.soort === 'sponsor' ? 'sponsor' : ''}">${x.soort === 'sponsor' ? `<small class="lv-zacht">${x.pakket === 'hoofd' ? 'Onze hoofdsponsor' : 'Met dank aan onze sponsor'}</small>` : ''}${plaatjeOk(x.img) ? `<div class="lv-dia-img"><img src="${esc(x.img)}" alt=""></div>` : ''}${x.titel ? `<h2>${esc(x.titel)}</h2>` : ''}${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</section>`;
  const balk = (lijst, klik) => lijst.length ? `<div class="lv-sponsors">${lijst.map(x => { const b = plaatjeOk(x.img) ? `<img src="${esc(x.img)}" alt="${esc(x.titel)}">` : `<b>${esc(x.titel)}</b>`, l = veiligeLink(x.link); return l && klik ? `<a href="${esc(l)}" target="_blank" rel="noopener sponsored">${b}</a>` : `<span>${b}</span>`; }).join('')}</div>` : '';

  /* Doelpunt op het tactisch bord: een balk over het midden van het scherm. De sjablonen hebben hun eigen moment. */
  function bordGoal(g){
    document.querySelector('.ks-goal')?.remove();
    const b = document.createElement('div'); b.className = 'ks-goal';
    b.innerHTML = `<div><b>Goal!</b><span>${esc(g.team)}</span><p><span>${esc(g.a)}</span><strong>${esc(g.stand)}</strong><span>${esc(g.b)}</span></p>${g.veld ? `<small>${esc(g.veld)}</small>` : ''}</div>`;
    document.body.appendChild(b); setTimeout(() => b.remove(), 9000);
  }
  function stopSpeler(){ if (!st.speler) return; st.speler.stop(); st.speler = null; document.documentElement.classList.remove('ts-html'); document.getElementById('tsSjabloon')?.remove(); }

  function teken(){
    let d = st.d, eigenItems = st.items; if (!d) return;
    /* Op de dag van het gekozen toernooi: het schema, de uitslagen en de sponsoren van het toernooi, met de stijl van de club. */
    const ev = !proef && st.ev ? evenementTv(st.ev, vandaag()) : null;
    if (ev){ d = { ...d, clubNaam: ev.naam || d.clubNaam, datum: vandaag(), programma: ev.programma, mededeling: ev.mededeling || d.mededeling, uit: true }; eigenItems = [...ev.items, ...st.items]; }
    if (proef) d = { ...d, datum: vandaag(), programma: proefProgramma(new Date(), st.tik) };
    const tv = breed(), isVandaag = d.datum === vandaag();
    const goals = nieuweGoals(st.gezien, isVandaag ? (d.programma || []).filter(w => d.uit !== false || w.thuis) : [], goalKeuze(d.goals));
    const sj = sjabloonId(kiesSjabloon || d.sjabloon);
    if (tv && sj !== 'bord' && st.kapot !== sj){
      if (st.T?.id !== sj && st.laadt !== sj){
        st.laadt = sj;
        laadSjabloon(sj).then(T => { st.T = T; st.laadt = ''; teken(); }).catch(e => { console.error('[Cluppie] sjabloon', sj, e); st.kapot = sj; st.laadt = ''; teken(); });
      }
      if (!st.T) return;                       /* het eerste sjabloon is nog onderweg: de laadtekst blijft staan */
      if (!st.speler){ st.speler = maakSpeler(el); document.documentElement.classList.add('ts-html'); document.documentElement.classList.remove('lv-tv-html'); }
      const items = (proef && !eigenItems.length ? PROEF_DIAS : eigenItems).map(x => ({ ...x, img: plaatjeOk(x.img) ? x.img : '' }));
      st.speler.zet(st.T, tvModel({ ...d, logo: plaatjeOk(d.logo) ? d.logo : '', programma: isVandaag ? d.programma : [] }, items, new Date()));
      goals.forEach(g => st.speler.goal(g));
      return;
    }
    stopSpeler();
    if (tv) goals.slice(0, 1).forEach(bordGoal);
    const alles = isVandaag ? (d.programma || []).filter(w => d.uit !== false || w.thuis) : [];
    const spons = eigenItems.filter(x => x.soort === 'sponsor' && (x.titel || x.img)), dias = eigenItems.filter(x => x.titel || x.tekst || x.img);
    const logo = plaatjeOk(d.logo) ? `<img class="lv-logo" src="${esc(d.logo)}" alt="">` : '', kleur = /^#[0-9a-f]{6}$/i.test(d.kleur || '') ? ` style="--accent:${d.kleur}"` : '';
    const dag = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
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
    const tvRij = w => { const bezig = isVandaag && !w.afgelast && !w.stand && w.thuis && min(w.tijd) <= n && n < min(w.tijd) + 90;
      return `<div class="kb-wed ${w.afgelast ? 'af' : ''} ${bezig ? 'bezig' : ''}" style="--pk:${w.thuis ? 'var(--tv-wit)' : 'rgba(255,255,255,.28)'}" data-tv-k="${esc([w.tijd, w.a, w.b].join('|'))}" data-tv-stand="${esc(w.stand || '')}">
      <span class="kb-wed-v"><b>${esc(w.tijd || '–')}</b>${esc(w.afgelast ? 'Afgelast' : [w.veld, w.kk ? 'kk ' + w.kk : ''].filter(Boolean).join(' · ') || (w.thuis ? '' : 'uit'))}</span>
      <span class="kb-wed-a">${esc(w.a)}</span><span class="kb-wed-u ${w.stand ? 'klaar' : ''}">${esc(w.stand || 'vs')}</span><span class="kb-wed-b">${esc(w.b)}</span></div>`; };
    const lijst = l => l.map(tvRij).join('');
    const img = plaatjeOk(d.logo) ? `<img src="${esc(d.logo)}" alt="">` : '';
    const diaVan = x => diaHtml({ ...x, img: plaatjeOk(x.img) ? x.img : '' }, x.soort === 'sponsor' ? (x.pakket === 'hoofd' ? 'Onze hoofdsponsor' : 'Met dank aan onze sponsor') : '');
    const welkom = `<section class="kb-paneel kb-dia kb-welkom">${logoHtml(img)}<small>${esc(dag)}</small><h2>Welkom bij ${esc(d.clubNaam || 'de club')}</h2><p>Veel plezier vandaag!</p></section>`;
    const rechts = beurt ? diaVan(beurt) + tikHtml(dias.length, st.tik % dias.length, 12)
      : deel.length > PER ? `<section class="kb-paneel ks-prog"><h2>&nbsp;</h2>${lijst(deel.slice(PER))}</section>` : welkom;
    tvZet(el, `<div class="lv lv-tv"${tvKleur(d.kleur)}>${bordHtml()}
      <header class="kb-kop" data-tv="kop">${logoHtml(img)}<div class="kb-titel"><small>${esc(dag)}</small><h1>${esc(d.clubNaam || 'Vandaag')}</h1></div><div class="kb-klokblok"><div class="kb-klok" data-tv-klok></div></div></header>
      <main class="kb-main"><div class="kb-kolom" data-tv="links"><section class="kb-paneel ks-prog"><h2>Vandaag op het programma${paginas > 1 ? ` <small>${pag + 1} / ${paginas}</small>` : ''}</h2>
          ${deel.length ? lijst(deel.slice(0, PER)) : `<p class="kb-leeg">${alles.length ? 'Alle wedstrijden van vandaag zijn gespeeld.' : 'Vandaag staan er geen wedstrijden op het programma.'}</p>`}
          ${paginas > 1 ? tikHtml(paginas, pag, 12) : ''}</section></div>
        <div class="kb-kolom" data-tv="rechts">${rechts}</div></main>
      ${sponsHtml(spons.map(x => ({ ...x, img: plaatjeOk(x.img) ? x.img : '' })))}
      ${voetHtml({ regels: d.mededeling ? [{ tekst: d.mededeling }] : [] })}</div>`);
    document.documentElement.classList.add('lv-tv-html');
  }
}

function stijl(){
  if (document.getElementById('ksStijl')) return;
  const s = document.createElement('style'); s.id = 'ksStijl';
  s.textContent = `
.ks-wed{grid-template-columns:92px minmax(0,1fr) 58px minmax(0,1fr)}
.ks-af{opacity:.55}.ks-af .lv-wed-a,.ks-af .lv-wed-b{text-decoration:line-through}
.lv-tv .ks-prog{flex:1}.lv-tv .ks-prog .kb-wed{grid-template-columns:6.4em minmax(0,1fr) 3.8em minmax(0,1fr)}
.ks-goal{position:fixed;inset:0;z-index:500;display:grid;place-items:center;background:rgba(5,6,10,.82);color:#fff;text-align:center;animation:ksGoal 9s both;pointer-events:none}
.ks-goal b{display:block;font-family:var(--font-display);font-weight:800;text-transform:uppercase;font-size:22vw;line-height:.8;animation:ksGoalK .8s cubic-bezier(.2,1.4,.4,1) both}
.ks-goal div>span{display:block;font-family:var(--font-display);font-weight:800;text-transform:uppercase;font-size:4vw;margin:3vh 0 2vh}
.ks-goal p{margin:0;display:flex;align-items:center;justify-content:center;gap:1.5vw;font-size:2.6vw;font-weight:600}
.ks-goal strong{background:#fff;color:#111;border-radius:.3em;padding:.05em .5em;font-family:var(--font-display);font-weight:800;font-size:1.6em}
.ks-goal small{display:block;margin-top:2vh;font-size:1.6vw;opacity:.75}
@keyframes ksGoal{0%{opacity:0}4%,94%{opacity:1}100%{opacity:0}}
@keyframes ksGoalK{from{transform:scale(2.2) rotate(-5deg);opacity:0}}
@media (max-width:420px){.ks-wed{grid-template-columns:78px minmax(0,1fr) 46px minmax(0,1fr)}}`;
  document.head.appendChild(s);
}
