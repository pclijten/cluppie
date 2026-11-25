/* ==================== TOERNOOI LIVE [20261125n] ====================
   Wordt aangeroepen door main.js zodra de URL ?live=<id> bevat, los van de normale login.
   Iedereen met de link of QR-code volgt een toernooi: wat er nu en straks speelt, het hele schema,
   de standen, de kleedkamers en de mededelingen van het comité. Met &tv=1 een weergave voor een
   tv of beamer in de kantine (grote letters, wisselt vanzelf tussen de poules).

   Zelfde opzet als activiteit-boot.js: anoniem inloggen en alleen het ene document
   toernooiLive/{id} lezen (firestore.rules). Geen spelersnamen, niets om in te vullen.
   De pagina werkt zichzelf bij (onSnapshot); het comité vult de uitslagen in via Activiteiten. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, onSnapshot } from './firebase.js?v=20261011g';
import * as T from './toernooi-logica.js?v=20261125v';

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
  stijl();
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

  const naam = id => st.d.teams?.[id]?.naam || '?';
  const veld = id => (st.d.veldjes || []).find(v => v.id === id)?.naam || '';
  const kleur = p => st.d.poules?.[p]?.kleur || '#999';
  const uit = w => { const u = st.d.uitslag?.[w.id]; return u ? `${u.a} – ${u.b}` : ''; };
  const wed = (w, { tijd = false } = {}) => `<div class="lv-wed ${st.team && [w.a, w.b].includes(st.team) ? 'mijn' : ''}" style="--pk:${esc(kleur(w.p))}">
      <span class="lv-wed-v">${tijd ? `<b>${esc(w.t)}</b>` : ''}${esc(veld(w.v))}</span><span class="lv-wed-a">${esc(naam(w.a))}</span>
      <span class="lv-wed-u ${uit(w) ? 'klaar' : ''}">${esc(uit(w) || '–')}</span><span class="lv-wed-b">${esc(naam(w.b))}</span></div>`;
  const standTabel = (pid, groot) => { const rijen = T.stand(st.d, pid), p = st.d.poules[pid];
    return rijen.length ? `<section class="lv-kaart"><h2><i class="lv-stip" style="--pk:${esc(p?.kleur || '#999')}"></i>${esc(p?.naam || 'Poule')}</h2>
      <table class="lv-stand"><thead><tr><th></th><th>Team</th><th>G</th>${groot ? '<th>W</th><th>GL</th><th>V</th>' : ''}<th>DS</th><th>P</th></tr></thead><tbody>
      ${rijen.map((r, i) => `<tr class="${st.team === r.id ? 'mijn' : ''}"><td>${i + 1}</td><td>${esc(r.naam)}</td><td>${r.g}</td>${groot ? `<td>${r.w}</td><td>${r.gl}</td><td>${r.v}</td>` : ''}<td>${r.saldo > 0 ? '+' : ''}${r.saldo}</td><td><b>${r.pnt}</b></td></tr>`).join('')}</tbody></table></section>` : ''; };
  const isVandaag = () => !st.d.datum || st.d.datum === vandaag();
  /* Sponsoren en eigen schermen: het plaatje is een data-URL die de regels van de planner al controleren; hier nog eens. */
  const schermen = waar => (st.d.schermen || []).filter(x => x && x[waar] !== false).map(x => ({ ...x, img: T.plaatjeOk(x.img) ? x.img : '', link: T.veiligeLink(x.link) }));
  const dia = x => `<section class="lv-kaart lv-dia ${x.soort === 'sponsor' ? 'sponsor' : ''}">${x.soort === 'sponsor' ? '<small class="lv-zacht">Met dank aan onze sponsor</small>' : ''}${x.img ? `<div class="lv-dia-img"><img src="${esc(x.img)}" alt=""></div>` : ''}${x.titel ? `<h2>${esc(x.titel)}</h2>` : ''}${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</section>`;
  const sponsorBalk = lijst => lijst.length ? `<div class="lv-sponsors">${lijst.map(x => { const b = x.img ? `<img src="${esc(x.img)}" alt="${esc(x.titel)}">` : `<b>${esc(x.titel)}</b>`; return x.link && !tv ? `<a href="${esc(x.link)}" target="_blank" rel="noopener sponsored">${b}</a>` : `<span>${b}</span>`; }).join('')}</div>` : '';

  function teken(){
    const d = st.d; if (!d) return;
    if (st.team && !d.teams?.[st.team]) st.team = '';
    el.innerHTML = tv ? htmlTv(d) : htmlTelefoon(d);
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
      nu: () => `${mijn ? `<section class="lv-kaart lv-mijn"><h2>${esc(mijn.naam)}</h2>${mijnVolgende ? `<p>Volgende wedstrijd om <b>${esc(mijnVolgende.t)}</b> op <b>${esc(veld(mijnVolgende.v))}</b>, tegen <b>${esc(naam(mijnVolgende.a === st.team ? mijnVolgende.b : mijnVolgende.a))}</b>.</p>` : '<p>Geen wedstrijden meer.</p>'}${mijn.kk ? `<p class="lv-zacht">Kleedkamer: ${esc(mijn.kk)}</p>` : ''}</section>` : ''}
        ${ns.nu.length ? `<section class="lv-kaart"><h2><i class="lv-live"></i>Nu op het veld <small>${esc(ns.nuT)}</small></h2>${ns.nu.map(w => wed(w)).join('')}</section>` : ''}
        ${ns.straks.length ? `<section class="lv-kaart"><h2>${ns.begonnen ? 'Hierna' : 'Eerste wedstrijden'} <small>${esc(ns.straksT)}</small></h2>${ns.straks.map(w => wed(w)).join('')}</section>` : ''}
        ${!ns.nu.length && !ns.straks.length ? `<section class="lv-kaart"><p>${ns.klaar ? 'Het toernooi is afgelopen. Bekijk de eindstand.' : (d.schema || []).length ? `Het toernooi is op ${esc(datumLang(d.datum))}. Het schema staat klaar.` : 'Het speelschema volgt nog.'}</p></section>` : ''}`,
      schema: () => schema.length ? `<section class="lv-kaart">${[...new Set(schema.map(w => w.t))].map(t => `<h3>${esc(t)}</h3>${schema.filter(w => w.t === t).map(w => wed(w)).join('')}`).join('')}</section>` : '<section class="lv-kaart"><p>Nog geen wedstrijden.</p></section>',
      stand: () => poules.filter(p => !mijn || p.id === mijn.poule).map(p => standTabel(p.id, true)).join('') || '<section class="lv-kaart"><p>Nog geen stand.</p></section>',
      info: () => `<section class="lv-kaart">${med.map(m => `<div class="lv-med"><small>${esc(new Date(m.ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</small><p>${esc(m.tekst)}</p></div>`).join('') || '<p>Nog geen mededelingen.</p>'}</section>
        ${teams.some(t => t.kk) ? `<section class="lv-kaart"><h2>Kleedkamers</h2>${teams.filter(t => t.kk && (!st.team || t.id === st.team)).map(t => `<div class="lv-rij"><span>${esc(t.naam)}</span><b>${esc(t.kk)}</b></div>`).join('')}</section>` : ''}`,
    }[st.tab] || (() => '');
    return `<div class="lv"><header class="lv-kop"><small>${esc([d.clubNaam, datumLang(d.datum), d.locatie].filter(Boolean).join(' · '))}</small><h1>${esc(d.naam || 'Toernooi')}</h1></header>
      ${d.planB ? `<div class="lv-banner rood"><b>Plan B:</b> ${esc(d.planB)}</div>` : ''}
      ${med[0] && st.tab !== 'info' ? `<button class="lv-banner" data-lv-tab="info"><b>${esc(new Date(med[0].ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</b> ${esc(med[0].tekst)}</button>` : ''}
      <select class="lv-kies" data-lv-team aria-label="Kies je team"><option value="">Alle teams</option>${teams.map(t => `<option value="${esc(t.id)}"${st.team === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('')}</select>
      <nav class="lv-tabs">${tabs.map(([id, n]) => `<button class="${st.tab === id ? 'aan' : ''}" data-lv-tab="${id}">${esc(n)}</button>`).join('')}</nav>
      ${inhoud()}${st.tab === 'nu' ? eigen.map(dia).join('') : ''}
      ${spons.length ? `<section class="lv-kaart"><h2>Sponsoren</h2>${sponsorBalk(spons)}</section>` : ''}<p class="lv-voet">Werkt zichzelf bij · Cluppie</p></div>`;
  }

  function htmlTv(d){
    const ns = isVandaag() ? T.nuEnStraks(d, nuMin()) : { nu: [], straks: [], nuT: '', straksT: '' };
    const poules = T.gesorteerd(d.poules).filter(p => T.stand(d, p.id).length), med = d.mededelingen || [];
    const alle = schermen('tv'), spons = alle.filter(x => x.soort === 'sponsor' && (x.img || x.titel));
    /* rechts wisselen de standen af met de dia's: na elk blok standen één dia (als die er zijn) */
    const per = spons.length ? 1 : 2, nStand = Math.max(1, Math.ceil(poules.length / per)), beurten = [];
    for (let i = 0, k = 0; i < Math.max(nStand, alle.length); i++){ if (i < nStand || !alle.length) beurten.push({ stand: i % nStand }); if (alle.length) beurten.push({ dia: alle[k++ % alle.length] }); }
    const blokken = beurten.length, b = st.tvPoule % blokken, beurt = beurten[b], toon = beurt.dia ? [] : poules.slice(beurt.stand * per, beurt.stand * per + per);
    const klok = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const laatste = [...(d.schema || [])].filter(w => d.uitslag?.[w.id]).sort((a, c) => T.naarMin(c.t) - T.naarMin(a.t)).slice(0, 6);
    return `<div class="lv lv-tv"><header class="lv-tvkop"><div><small>${esc([d.clubNaam, datumLang(d.datum)].filter(Boolean).join(' · '))}</small><h1>${esc(d.naam || 'Toernooi')}</h1></div><span class="lv-klok">${esc(klok)}</span></header>
      ${d.planB ? `<div class="lv-banner rood"><b>Plan B:</b> ${esc(d.planB)}</div>` : ''}
      <main class="lv-tvmain"><div class="lv-tvkolom">
          ${ns.nu.length ? `<section class="lv-kaart"><h2><i class="lv-live"></i>Nu op het veld <small>${esc(ns.nuT)}</small></h2>${ns.nu.map(w => wed(w)).join('')}</section>` : ''}
          ${ns.straks.length ? `<section class="lv-kaart"><h2>Hierna <small>${esc(ns.straksT)}</small></h2>${ns.straks.map(w => wed(w)).join('')}</section>` : ''}
          ${!ns.nu.length && !ns.straks.length && laatste.length ? `<section class="lv-kaart"><h2>Laatste uitslagen</h2>${laatste.map(w => wed(w, { tijd: true })).join('')}</section>` : ''}
          ${!ns.nu.length && !ns.straks.length && !laatste.length ? `<section class="lv-kaart"><p>${(d.schema || []).length ? 'Het schema staat klaar.' : 'Het speelschema volgt nog.'}</p></section>` : ''}</div>
        <div class="lv-tvkolom">${beurt.dia ? dia(beurt.dia) : toon.map(p => standTabel(p.id, true)).join('') || '<section class="lv-kaart"><p>Nog geen stand.</p></section>'}
          ${blokken > 1 ? `<p class="lv-zacht lv-bol">${Array.from({ length: blokken }, (_, i) => `<i class="${i === b ? 'aan' : ''}"></i>`).join('')}</p>` : ''}</div></main>
      ${spons.length ? `<div class="lv-tvspons"><small>Sponsoren</small>${sponsorBalk(spons)}</div>` : ''}
      <footer class="lv-tvvoet">${st.qr ? `<div class="lv-tvqr">${st.qr}</div>` : ''}<div class="lv-ticker">${med.length ? `<b>${esc(new Date(med[0].ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</b> ${esc(med[0].tekst)}${med[1] ? `<span> · ${esc(med[1].tekst)}</span>` : ''}` : 'Scan de code en volg je eigen team op je telefoon.'}</div></footer></div>`;
  }

  el.addEventListener('click', e => { const t = e.target.closest('[data-lv-tab]'); if (t){ st.tab = t.dataset.lvTab; teken(); scrollTo(0, 0); } });
  el.addEventListener('change', e => { if (e.target.matches('[data-lv-team]')){ st.team = e.target.value; try { localStorage.setItem(SLEUTEL + liveId, st.team); } catch { /* geen opslag */ } teken(); } });
}

function stijl(){
  if (document.getElementById('lvStijl')) return;
  const s = document.createElement('style'); s.id = 'lvStijl';
  s.textContent = `
.lv{max-width:720px;margin:0 auto;padding:16px 16px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;color:var(--ink)}
.lv-midden{min-height:60vh;justify-content:center;text-align:center}
.lv h1{font-family:var(--font-display);text-transform:uppercase;font-size:var(--t-3xl,30px);line-height:1;margin:2px 0 0}
.lv-kop small,.lv-tvkop small{color:var(--ink-2);font-size:var(--t-sm,14px)}
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
.lv-tv .lv-dia{flex:1;justify-content:center;gap:2vh;min-height:0}.lv-tv .lv-dia h2{font-size:2.6em;justify-content:center;text-align:center}.lv-tv .lv-dia p{font-size:1.7em;line-height:1.3}
.lv-tv .lv-dia-img{flex:0 1 auto;min-height:0;display:flex;padding:2vh 2vw}.lv-tv .lv-dia-img img{max-height:38vh;max-width:36vw}
.lv-tv .lv-dia small{font-size:1em}
.lv-tvspons{display:flex;align-items:center;gap:1.4vw;overflow:hidden}.lv-tvspons small{color:var(--ink-2);text-transform:uppercase;letter-spacing:.06em;font-size:.8em;flex-shrink:0}
.lv-tvspons .lv-sponsors{flex-wrap:nowrap;justify-content:flex-start;gap:1vw;overflow:hidden}.lv-tvspons .lv-sponsors span{height:9vh;min-width:8vw;padding:1vh 1vw;font-size:1.2em;flex-shrink:0}.lv-tvspons .lv-sponsors img{max-width:14vw}
.lv-voet{text-align:center;color:var(--ink-2);font-size:var(--t-xs,12px);margin:8px 0 0}
html.lv-tv-html,html.lv-tv-html body{height:100%;overflow:hidden}
.lv-tv{max-width:none;height:100vh;box-sizing:border-box;padding:2.2vh 2.4vw;gap:1.6vh;font-size:clamp(16px,1.25vw,30px)}
.lv-tvkop{display:flex;align-items:flex-end;justify-content:space-between}
.lv-tv h1{font-size:clamp(34px,4.2vw,96px)}.lv-tvkop small{font-size:1em}
.lv-klok{font-family:var(--font-display);font-size:clamp(34px,4.2vw,96px);line-height:1;font-variant-numeric:tabular-nums}
.lv-tvmain{flex:1;min-height:0;display:grid;grid-template-columns:1.1fr 1fr;gap:2vw}
.lv-tvkolom{display:flex;flex-direction:column;gap:1.6vh;min-height:0;overflow:hidden}
.lv-tv .lv-kaart{padding:1.6vh 1.2vw}.lv-tv .lv-kaart h2{font-size:1.5em}.lv-tv .lv-stand{font-size:1.1em}.lv-tv .lv-stand th{font-size:.8em}
.lv-tv .lv-wed{grid-template-columns:7em minmax(0,1fr) 5em minmax(0,1fr);font-size:1.25em;padding:.5em 0 .5em .6em;border-left-width:.35em}
.lv-tv .lv-wed-v{font-size:.7em}
.lv-bol{display:flex;gap:8px;justify-content:center}.lv-bol i{width:10px;height:10px;border-radius:50%;background:var(--hair)}.lv-bol i.aan{background:var(--accent)}
.lv-tvvoet{display:flex;align-items:center;gap:1.5vw}
.lv-tvqr{width:clamp(80px,7vw,150px);background:#fff;border-radius:10px;padding:4px;flex-shrink:0}.lv-tvqr svg{display:block;width:100%;height:auto}
.lv-ticker{flex:1;background:var(--accent);color:var(--accent-ink,#fff);border-radius:var(--r-m,14px);padding:1.2vh 1.4vw;font-size:1.4em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:420px){.lv-wed{grid-template-columns:52px minmax(0,1fr) 50px minmax(0,1fr)}}`;
  document.head.appendChild(s);
}
