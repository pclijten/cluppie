/* ==================== TOERNOOI LIVE [20261125n] ====================
   Wordt aangeroepen door main.js zodra de URL ?live=<id> bevat, los van de normale login.
   Iedereen met de link of QR-code volgt een toernooi: wat er nu en straks speelt, het hele schema,
   de standen, de kleedkamers en de mededelingen van het comité. Met &tv=1 een weergave voor een
   tv of beamer in de kantine (grote letters, wisselt vanzelf tussen de poules).

   Zelfde opzet als activiteit-boot.js: anoniem inloggen en alleen het ene document
   toernooiLive/{id} lezen (firestore.rules). Geen spelersnamen, niets om in te vullen.
   De pagina werkt zichzelf bij (onSnapshot); het comité vult de uitslagen in via Activiteiten. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, onSnapshot } from './firebase.js?v=20261011g';
import * as T from './toernooi-logica.js?v=20261127m';
import { tvStijl, tvKleur, tvZet, bordHtml, logoHtml, tikHtml, diaHtml, sponsHtml, voetHtml } from './tv-stijl.js?v=20261126n';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLEUTEL = 'cluppieLiveTeam';
const authKlaar = () => new Promise(k => { const stop = onAuthStateChanged(auth, () => { stop(); k(); }, () => k()); });
async function sessie(forceer){
  const u = auth.currentUser;
  if (u){
    try { await u.getIdToken(!!forceer); return; }
    catch (e){ if (e?.code === 'auth/network-request-failed') return; if (auth.currentUser?.isAnonymous){ try { await signOut(auth); } catch { /* dan maar zo */ } } }
  }
  if (!auth.currentUser) await signInAnonymously(auth);
}
const nuMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const vandaag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const datumLang = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? new Date(s + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
const melding = (titel, tekst) => `<div class="lv lv-midden"><h1>${esc(titel)}</h1><p>${esc(tekst)}</p></div>`;

export async function bootLivePagina(liveId, { tv = false } = {}){
  const el = document.getElementById('deel');
  if (!el) return;
  stijl(); if (tv) tvStijl();
  el.style.display = 'block';
  document.documentElement.classList.toggle('lv-tv-html', tv);
  el.innerHTML = melding('Even geduld', 'Het toernooi wordt geladen…');
  try { await authKlaar(); await sessie(false); }
  catch { el.innerHTML = melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.'); return; }
  const st = { d: null, tab: 'nu', team: '', hersteld: false, tvPoule: 0, qr: '' };
  try { st.team = localStorage.getItem(SLEUTEL + liveId) || ''; } catch { /* geen opslag */ }
  let stop = null;
  function luister(){
    stop = onSnapshot(doc(db, 'toernooiLive', liveId), s => {
      if (!s.exists()){ if (s.metadata?.fromCache && !st.d) return; st.d = null; el.innerHTML = melding('Deze link werkt niet (meer)', 'Vraag de organisatie om een nieuwe link.'); return; }
      st.d = s.data(); document.title = `${st.d.naam || 'Toernooi'} live`; teken();
    }, async e => {
      console.error('[Cluppie] live', e);
      if (e?.code === 'permission-denied' && !st.hersteld){ st.hersteld = true; try { stop?.(); await sessie(true); luister(); return; } catch { /* door */ } }
      el.innerHTML = e?.code === 'permission-denied' ? melding('Deze pagina staat uit', 'De organisatie heeft de live pagina (nog) niet aan staan.') : melding('Laden is niet gelukt', 'Controleer je verbinding en ververs de pagina.');
    });
  }
  luister();
  setInterval(() => { if (st.d) teken(); }, 30000);                 /* nu/straks schuift mee met de klok */
  if (tv){ setInterval(() => { st.tvPoule++; if (st.d) teken(); }, 12000); maakQr(); }

  async function maakQr(){
    try {
      if (typeof window.qrcode !== 'function') await new Promise((ok, mis) => { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = ok; s.onerror = mis; document.head.appendChild(s); });
      const q = window.qrcode(0, 'M'); q.addData(location.href.replace(/[?&]tv=1/, '').replace(/\?$/, '')); q.make();
      st.qr = q.createSvgTag({ cellSize: 4, margin: 8, scalable: true }); if (st.d) teken();
    } catch { /* zonder QR */ }
  }

  const naam = (id, nog = '?') => st.d.teams?.[id]?.naam || nog || '?';
  /* knock-out: zolang het team nog niet bekend is staat er "1e Poule A" of "Winnaar HF1" (la/lb) */
  const naamA = w => naam(w.a, w.la), naamB = w => naam(w.b, w.lb);
  const titel = w => w.titel ? `<i class="lv-ko">${esc(w.titel)}</i>` : '';
  const veld = id => (st.d.veldjes || []).find(v => v.id === id)?.naam || '';
  const kleur = p => st.d.poules?.[p]?.kleur || '#999';
  const uit = w => { const u = st.d.uitslag?.[w.id]; return u ? `${u.a} – ${u.b}${u.w ? '*' : ''}` : ''; };
  const wed = (w, { tijd = false } = {}) => `<div class="lv-wed ${st.team && [w.a, w.b].includes(st.team) ? 'mijn' : ''}" style="--pk:${esc(kleur(w.p))}">
      <span class="lv-wed-v">${tijd ? `<b>${esc(w.t)}</b>` : ''}${esc(veld(w.v))}${titel(w)}</span><span class="lv-wed-a">${esc(naamA(w))}</span>
      <span class="lv-wed-u ${uit(w) ? 'klaar' : ''}">${esc(uit(w) || '–')}</span><span class="lv-wed-b">${esc(naamB(w))}</span></div>`;
  const standTabel = (pid, groot) => { const rijen = T.stand(st.d, pid), p = st.d.poules[pid];
    return rijen.length ? `<section class="lv-kaart"><h2><i class="lv-stip" style="--pk:${esc(p?.kleur || '#999')}"></i>${esc(p?.naam || 'Poule')}</h2>
      <table class="lv-stand"><thead><tr><th></th><th>Team</th><th>G</th>${groot ? '<th>W</th><th>GL</th><th>V</th>' : ''}<th>DS</th><th>P</th></tr></thead><tbody>
      ${rijen.map((r, i) => `<tr class="${st.team === r.id ? 'mijn' : ''}"><td>${i + 1}</td><td>${esc(r.naam)}</td><td>${r.g}</td>${groot ? `<td>${r.w}</td><td>${r.gl}</td><td>${r.v}</td>` : ''}<td>${r.saldo > 0 ? '+' : ''}${r.saldo}</td><td><b>${r.pnt}</b></td></tr>`).join('')}</tbody></table></section>` : ''; };
  /* Finales (knock-out) bovenaan de stand, met wie er nog in zit */
  const koKaart = d => { const ws = (d.schema || []).filter(w => w.ko).sort((a, b) => T.naarMin(a.t) - T.naarMin(b.t));
    return ws.length ? `<section class="lv-kaart"><h2>🏆 Finales</h2>${ws.map(w => wed(w, { tijd: true })).join('')}${ws.some(w => st.d.uitslag?.[w.id]?.w) ? '<p class="lv-zacht">* na strafschoppen</p>' : ''}</section>` : ''; };
  const isVandaag = () => !st.d.datum || st.d.datum === vandaag();
  const logo = d => T.plaatjeOk(d.logo) ? `<img class="lv-logo" src="${esc(d.logo)}" alt="">` : '';
  const accent = d => /^#[0-9a-f]{6}$/i.test(d.kleur || '') ? ` style="--accent:${d.kleur}"` : '';
  /* Sponsoren en eigen schermen: het plaatje is een data-URL die de regels van de planner al controleren; hier nog eens. */
  const schermen = waar => (st.d.schermen || []).filter(x => x && x[waar] !== false).map(x => ({ ...x, img: T.plaatjeOk(x.img) ? x.img : '', link: T.veiligeLink(x.link) }));
  const dia = x => `<section class="lv-kaart lv-dia ${x.soort === 'sponsor' ? 'sponsor' : ''}">${x.soort === 'sponsor' ? '<small class="lv-zacht">Met dank aan onze sponsor</small>' : ''}${x.img ? `<div class="lv-dia-img"><img src="${esc(x.img)}" alt=""></div>` : ''}${x.titel ? `<h2>${esc(x.titel)}</h2>` : ''}${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</section>`;
  const sponsorBalk = lijst => lijst.length ? `<div class="lv-sponsors">${lijst.map(x => { const b = x.img ? `<img src="${esc(x.img)}" alt="${esc(x.titel)}">` : `<b>${esc(x.titel)}</b>`; return x.link && !tv ? `<a href="${esc(x.link)}" target="_blank" rel="noopener sponsored">${b}</a>` : `<span>${b}</span>`; }).join('')}</div>` : '';

  function teken(){
    const d = st.d; if (!d) return;
    if (st.team && !d.teams?.[st.team]) st.team = '';
    if (tv) tvZet(el, htmlTv(d)); else el.innerHTML = htmlTelefoon(d);
  }

  function htmlTelefoon(d){
    const ns = isVandaag() ? T.nuEnStraks(d, nuMin()) : { nu: [], straks: [], nuT: '', straksT: '', begonnen: false, klaar: d.datum < vandaag() };
    const med = d.mededelingen || [], teams = T.gesorteerd(d.teams), poules = T.gesorteerd(d.poules);
    const schema = [...(d.schema || [])].sort((a, b) => T.naarMin(a.t) - T.naarMin(b.t)).filter(w => !st.team || [w.a, w.b].includes(st.team));
    const mijn = st.team ? d.teams[st.team] : null;
    const mijnVolgende = st.team ? (d.schema || []).filter(w => [w.a, w.b].includes(st.team) && !d.uitslag?.[w.id]).sort((a, b) => T.naarMin(a.t) - T.naarMin(b.t))[0] : null;
    const alle = schermen('tel'), eigen = alle.filter(x => x.soort !== 'sponsor'), spons = alle.filter(x => x.soort === 'sponsor');
    const tabs = [['nu', 'Nu'], ['schema', 'Schema'], ['stand', 'Stand'], ['info', `Mededelingen${med.length ? ` (${med.length})` : ''}`]];
    const inhoud = {
      nu: () => `${mijn ? `<section class="lv-kaart lv-mijn"><h2>${esc(mijn.naam)}</h2>${mijnVolgende ? `<p>Volgende wedstrijd om <b>${esc(mijnVolgende.t)}</b> op <b>${esc(veld(mijnVolgende.v))}</b>, tegen <b>${esc(mijnVolgende.a === st.team ? naamB(mijnVolgende) : naamA(mijnVolgende))}</b>.</p>` : '<p>Geen wedstrijden meer.</p>'}${mijn.kk ? `<p class="lv-zacht">Kleedkamer: ${esc(mijn.kk)}</p>` : ''}</section>` : ''}
        ${ns.nu.length ? `<section class="lv-kaart"><h2><i class="lv-live"></i>Nu op het veld <small>${esc(ns.nuT)}</small></h2>${ns.nu.map(w => wed(w)).join('')}</section>` : ''}
        ${ns.straks.length ? `<section class="lv-kaart"><h2>${ns.begonnen ? 'Hierna' : 'Eerste wedstrijden'} <small>${esc(ns.straksT)}</small></h2>${ns.straks.map(w => wed(w)).join('')}</section>` : ''}
        ${!ns.nu.length && !ns.straks.length ? `<section class="lv-kaart"><p>${ns.klaar ? 'Het toernooi is afgelopen. Bekijk de eindstand.' : (d.schema || []).length ? `Het toernooi is op ${esc(datumLang(d.datum))}. Het schema staat klaar.` : 'Het speelschema volgt nog.'}</p></section>` : ''}`,
      schema: () => schema.length ? `<section class="lv-kaart">${[...new Set(schema.map(w => w.t))].map(t => `<h3>${esc(t)}</h3>${schema.filter(w => w.t === t).map(w => wed(w)).join('')}`).join('')}</section>` : '<section class="lv-kaart"><p>Nog geen wedstrijden.</p></section>',
      stand: () => (koKaart(d) + poules.filter(p => !mijn || p.id === mijn.poule).map(p => standTabel(p.id, true)).join('')) || '<section class="lv-kaart"><p>Nog geen stand.</p></section>',
      info: () => `<section class="lv-kaart">${med.map(m => `<div class="lv-med"><small>${esc(new Date(m.ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</small><p>${esc(m.tekst)}</p></div>`).join('') || '<p>Nog geen mededelingen.</p>'}</section>
        ${teams.some(t => t.kk) ? `<section class="lv-kaart"><h2>Kleedkamers</h2>${teams.filter(t => t.kk && (!st.team || t.id === st.team)).map(t => `<div class="lv-rij"><span>${esc(t.naam)}</span><b>${esc(t.kk)}</b></div>`).join('')}</section>` : ''}`,
    }[st.tab] || (() => '');
    return `<div class="lv"${accent(d)}><header class="lv-kop">${logo(d)}<div><small>${esc([d.clubNaam, datumLang(d.datum), d.locatie].filter(Boolean).join(' · '))}</small><h1>${esc(d.naam || 'Toernooi')}</h1></div></header>
      ${d.planB ? `<div class="lv-banner rood"><b>Plan B:</b> ${esc(d.planB)}</div>` : ''}
      ${med[0] && st.tab !== 'info' ? `<button class="lv-banner" data-lv-tab="info"><b>${esc(new Date(med[0].ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</b> ${esc(med[0].tekst)}</button>` : ''}
      <select class="lv-kies" data-lv-team aria-label="Kies je team"><option value="">Alle teams</option>${teams.map(t => `<option value="${esc(t.id)}"${st.team === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('')}</select>
      <nav class="lv-tabs">${tabs.map(([id, n]) => `<button class="${st.tab === id ? 'aan' : ''}" data-lv-tab="${id}">${esc(n)}</button>`).join('')}</nav>
      ${inhoud()}${st.tab === 'nu' ? eigen.map(dia).join('') : ''}
      ${spons.length ? `<section class="lv-kaart"><h2>Sponsoren</h2>${sponsorBalk(spons)}</section>` : ''}<p class="lv-voet">Werkt zichzelf bij · Cluppie</p></div>`;
  }

  /* Tv: links wat er nu en straks speelt, rechts wisselend de standen en de dia's (elke 12 seconden). */
  const tvWed = (w, { tijd = false } = {}) => `<div class="kb-wed" style="--pk:${esc(kleur(w.p))}" data-tv-k="${esc(w.id)}" data-tv-stand="${esc(uit(w))}">
      <span class="kb-wed-v">${tijd ? `<b>${esc(w.t)}</b>` : ''}${esc(veld(w.v))}${titel(w)}</span><span class="kb-wed-a">${esc(naamA(w))}</span>
      <span class="kb-wed-u ${uit(w) ? 'klaar' : ''}">${esc(uit(w) || 'vs')}</span><span class="kb-wed-b">${esc(naamB(w))}</span></div>`;
  const tvStand = pid => { const rijen = T.stand(st.d, pid), p = st.d.poules[pid];
    return rijen.length ? `<section class="kb-paneel"><h2><i class="kb-stip" style="--pk:${esc(p?.kleur || '#999')}"></i>${esc(p?.naam || 'Poule')}</h2>
      <table class="kb-stand"><thead><tr><th></th><th>Team</th><th>G</th><th>W</th><th>GL</th><th>V</th><th>DS</th><th>P</th></tr></thead><tbody>
      ${rijen.map((r, i) => `<tr><td><span>${i + 1}</span></td><td>${esc(r.naam)}</td><td>${r.g}</td><td>${r.w}</td><td>${r.gl}</td><td>${r.v}</td><td>${r.saldo > 0 ? '+' : ''}${r.saldo}</td><td><b>${r.pnt}</b></td></tr>`).join('')}</tbody></table></section>` : ''; };
  const tijdStip = t => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() + T.naarMin(t) * 60000; };

  function htmlTv(d){
    const ns = isVandaag() ? T.nuEnStraks(d, nuMin()) : { nu: [], straks: [], nuT: '', straksT: '' };
    const poules = T.gesorteerd(d.poules).filter(p => T.stand(d, p.id).length), med = d.mededelingen || [];
    const alle = schermen('tv'), spons = alle.filter(x => x.soort === 'sponsor' && (x.img || x.titel));
    /* rechts wisselen de standen af met de dia's: na elk blok standen één dia (als die er zijn) */
    const per = spons.length ? 1 : 2, nStand = Math.max(1, Math.ceil(poules.length / per)), beurten = [];
    for (let i = 0, k = 0; i < Math.max(nStand, alle.length); i++){ if (i < nStand || !alle.length) beurten.push({ stand: i % nStand }); if (alle.length) beurten.push({ dia: alle[k++ % alle.length] }); }
    const blokken = beurten.length, b = st.tvPoule % blokken, beurt = beurten[b], toon = beurt.dia ? [] : poules.slice(beurt.stand * per, beurt.stand * per + per);
    const laatste = [...(d.schema || [])].filter(w => d.uitslag?.[w.id]).sort((a, c) => T.naarMin(c.t) - T.naarMin(a.t)).slice(0, 6);
    const van = ns.nuT ? tijdStip(ns.nuT) : 0, tot = van + (Number(d.duur) || 12) * 60000;
    const img = T.plaatjeOk(d.logo) ? `<img src="${esc(d.logo)}" alt="">` : '';
    return `<div class="lv lv-tv"${tvKleur(d.kleur)}>${bordHtml()}
      <header class="kb-kop" data-tv="kop">${logoHtml(img)}<div class="kb-titel"><small>${isVandaag() ? '<span class="kb-livepil"><i></i>Live</span>' : ''}${esc([d.clubNaam, datumLang(d.datum)].filter(Boolean).join(' · '))}</small><h1>${esc(d.naam || 'Toernooi')}</h1></div><div class="kb-klokblok"><div class="kb-klok" data-tv-klok></div></div></header>
      ${d.planB ? `<div class="lv-banner rood" data-tv="planb"><b>Plan B:</b> ${esc(d.planB)}</div>` : ''}
      <main class="kb-main"><div class="kb-kolom" data-tv="links">
          ${ns.nu.length ? `<section class="kb-paneel"><h2><i class="lv-live"></i>Nu op het veld <small>${esc(ns.nuT)}</small></h2><div class="kb-ronde" data-tv-van="${van}" data-tv-tot="${tot}"><i></i></div>${ns.nu.map(w => tvWed(w)).join('')}</section>` : ''}
          ${ns.straks.length ? `<section class="kb-paneel"><h2>Hierna <small>${esc(ns.straksT)}</small></h2>${ns.straks.map(w => tvWed(w)).join('')}</section>` : ''}
          ${!ns.nu.length && !ns.straks.length && laatste.length ? `<section class="kb-paneel"><h2>Laatste uitslagen</h2>${laatste.map(w => tvWed(w, { tijd: true })).join('')}</section>` : ''}
          ${!ns.nu.length && !ns.straks.length && !laatste.length ? `<section class="kb-paneel"><p class="kb-leeg">${(d.schema || []).length ? 'Het schema staat klaar.' : 'Het speelschema volgt nog.'}</p></section>` : ''}</div>
        <div class="kb-kolom" data-tv="rechts">${beurt.dia ? diaHtml(beurt.dia, beurt.dia.soort === 'sponsor' ? 'Met dank aan onze sponsor' : '') : toon.map(p => tvStand(p.id)).join('') || '<section class="kb-paneel"><p class="kb-leeg">Nog geen stand.</p></section>'}
          ${tikHtml(blokken, b, 12)}</div></main>
      ${sponsHtml(spons)}
      ${voetHtml({ qr: st.qr, qrTekst: 'Volg je team live', kop: med.length ? 'Mededeling' : 'Live', regels: med.length ? med.slice(0, 3).map(m => ({ tijd: new Date(m.ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }), tekst: m.tekst })) : [{ tekst: 'Scan de code en volg je eigen team op je telefoon.' }] })}</div>`;
  }

  el.addEventListener('click', e => { const t = e.target.closest('[data-lv-tab]'); if (t){ st.tab = t.dataset.lvTab; teken(); scrollTo(0, 0); } });
  el.addEventListener('change', e => { if (e.target.matches('[data-lv-team]')){ st.team = e.target.value; try { localStorage.setItem(SLEUTEL + liveId, st.team); } catch { /* geen opslag */ } teken(); } });
}

export function stijl(){
  if (document.getElementById('lvStijl')) return;
  const s = document.createElement('style'); s.id = 'lvStijl';
  s.textContent = `
.lv{max-width:720px;margin:0 auto;padding:16px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;color:var(--ink)}
.lv-midden{min-height:60vh;justify-content:center;text-align:center}
.lv h1{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-3xl,30px);line-height:1;margin:2px 0 0}
.lv-kaart{background:var(--card);border-radius:var(--r-m,14px);padding:12px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:6px}
.lv-kaart h2{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-lg,18px);margin:0;display:flex;align-items:center;gap:8px}
.lv-kaart h2 small{font-family:inherit;color:var(--ink-2);margin-left:auto;font-variant-numeric:tabular-nums}
.lv-kaart h3{margin:8px 0 0;font-size:var(--t-sm,14px);color:var(--ink-2);font-variant-numeric:tabular-nums}
.lv-kaart p{margin:0}
.lv-mijn{border:2px solid var(--accent)}
.lv-zacht{color:var(--ink-2);font-size:var(--t-sm,14px)}
.lv-stip{width:12px;height:12px;border-radius:50%;background:var(--pk);display:inline-block}
.lv-live{width:10px;height:10px;border-radius:50%;background:var(--uit,#e11);display:inline-block;animation:lvPuls 1.6s infinite}
@keyframes lvPuls{50%{opacity:.25}}
.lv-wed{display:grid;grid-template-columns:64px minmax(0,1fr) 58px minmax(0,1fr);gap:6px;align-items:center;border-left:4px solid var(--pk);padding:6px 0 6px 8px;border-radius:2px}
.lv-wed.mijn{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.lv-wed-v{font-size:var(--t-xs,12px);color:var(--ink-2);display:flex;flex-direction:column}
.lv-wed-v b{color:var(--ink);font-variant-numeric:tabular-nums}
.lv-ko{font-style:normal;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--pk)}
.lv-wed-a{text-align:right;font-weight:600;overflow-wrap:anywhere}.lv-wed-b{font-weight:600;overflow-wrap:anywhere}
.lv-wed-u{text-align:center;color:var(--ink-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.lv-wed-u.klaar{background:var(--ink);color:var(--bg);border-radius:8px;padding:3px 0;font-weight:700}
.lv-stand{width:100%;border-collapse:collapse;font-size:var(--t-sm,14px)}
.lv-stand th,.lv-stand td{padding:5px 6px;border-bottom:1px solid var(--hair);text-align:center;font-variant-numeric:tabular-nums}
.lv-stand th{color:var(--ink-2);font-weight:600;font-size:var(--t-xs,12px)}
.lv-stand td:nth-child(2),.lv-stand th:nth-child(2){text-align:left;width:100%}
.lv-stand tr.mijn td{background:color-mix(in srgb,var(--accent) 12%,transparent);font-weight:700}
.lv-tabs{display:flex;gap:4px;overflow-x:auto;position:sticky;top:0;background:var(--bg);padding:6px 0;z-index:2}
.lv-tabs button{flex:1 0 auto;padding:8px 12px;border-radius:999px;background:var(--card);color:var(--ink);border:1.5px solid var(--hair);min-height:40px;font-size:var(--t-sm,14px)}
.lv-tabs button.aan{background:var(--accent);color:var(--accent-ink,#fff);border-color:var(--accent);font-weight:600}
.lv-kies{width:100%;min-height:44px;padding:8px 10px;border-radius:var(--r-s,10px);border:1.5px solid var(--hair);background:var(--card);color:var(--ink);font:inherit;font-size:16px}
.lv-banner{display:block;width:100%;text-align:left;background:color-mix(in srgb,var(--warn,#f59e0b) 22%,var(--card));color:var(--ink);border-radius:var(--r-m,14px);padding:10px 12px;font-size:var(--t-base,16px)}
.lv-banner.rood{background:color-mix(in srgb,var(--uit,#e11) 18%,var(--card))}
.lv-med{border-bottom:1px solid var(--hair);padding:6px 0}.lv-med small{color:var(--ink-2)}
.lv-rij{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--hair)}
.lv-sponsors{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center}
.lv-sponsors a,.lv-sponsors span{background:#fff;color:#111;border-radius:10px;padding:8px 12px;height:64px;min-width:96px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:700}
.lv-sponsors img{max-height:100%;max-width:150px;object-fit:contain;display:block}
.lv-dia{align-items:center;text-align:center}.lv-dia-img{background:#fff;border-radius:12px;padding:10px;max-width:100%}.lv-dia-img img{max-width:100%;max-height:220px;object-fit:contain;display:block}
.lv-dia p{font-size:var(--t-lg,18px);white-space:pre-line}
.lv-kop{display:flex;align-items:center;gap:12px}.lv-kop>div{min-width:0}
.lv-logo{width:56px;height:56px;object-fit:contain;flex-shrink:0;border-radius:10px;background:#fff;padding:3px}
.lv-voet{text-align:center;color:var(--ink-2);font-size:var(--t-xs,12px);margin:8px 0 0}
@media (max-width:420px){.lv-wed{grid-template-columns:52px minmax(0,1fr) 50px minmax(0,1fr)}}`;
  document.head.appendChild(s);
}
