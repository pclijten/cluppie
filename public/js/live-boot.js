/* ==================== TOERNOOI LIVE [20261125n] ====================
   Wordt aangeroepen door main.js zodra de URL ?live=<id> bevat, los van de normale login.
   Iedereen met de link of QR-code volgt een toernooi: wat er nu en straks speelt, het hele schema,
   de standen, de kleedkamers en de mededelingen van het comité. Met &tv=1 een weergave voor een
   tv of beamer in de kantine (grote letters, wisselt vanzelf tussen de poules).

   Zelfde opzet als activiteit-boot.js: anoniem inloggen en alleen het ene document
   toernooiLive/{id} lezen (firestore.rules). Geen spelersnamen, niets om in te vullen.
   De pagina werkt zichzelf bij (onSnapshot); het comité vult de uitslagen in via Activiteiten. */
import { auth, db, signInAnonymously, signOut, onAuthStateChanged, doc, onSnapshot } from './firebase.js?v=20261011g';
import * as T from './toernooi-logica.js?v=20261130k';
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
  /* [20261127w] Niet meer anoniem inloggen: een open live pagina of tv is zonder inloggen te lezen. Firebase staat
     ~100 nieuwe anonieme accounts per uur per IP-adres toe, en op een toernooi zit iedereen op dezelfde clubwifi.
     Wie al in de app is ingelogd (comité, tv-beheer), houdt die sessie en ziet ook een dichte pagina.
     Alleen als lezen geweigerd wordt (forceer: oude rules, of een dichte pagina) toch anoniem inloggen. */
  if (forceer && !auth.currentUser) await signInAnonymously(auth);
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
  const isVandaag = () => !st.d.datum || st.d.datum === vandaag();
  /* Sponsoren en eigen schermen: het plaatje is een data-URL die de regels van de planner al controleren; hier nog eens. */
  const schermen = waar => (st.d.schermen || []).filter(x => x && x[waar] !== false).map(x => ({ ...x, img: T.plaatjeOk(x.img) ? x.img : '', link: T.veiligeLink(x.link) }));

  function teken(){
    const d = st.d; if (!d) return;
    if (st.team && !d.teams?.[st.team]) st.team = '';
    if (tv){ tvZet(el, htmlTv(d)); return; }
    document.documentElement.classList.add('lb-html');
    st.breed = window.innerWidth >= 980;
    const links = el.querySelector('.lb-chips')?.scrollLeft || 0;
    el.innerHTML = htmlTelefoon(d);
    const chips = el.querySelector('.lb-chips'); if (chips) chips.scrollLeft = links;
  }

  /* ---- telefoon, tablet en laptop: het bord in clubkleur [20261127] ----
     Kop in clubkleur met veldlijnen (zoals de kantine-tv), teamkiezer als knoppen, tabbladen onderaan onder de duim,
     een eigen tabblad Finales met de wedstrijdboom. Op een breed scherm staan Nu, Finales en Stand naast elkaar. */
  const ICO = { nu: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', schema: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    finales: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>', stand: '<path d="M5 20V11M12 20V4M19 20v-6"/>', info: '<path d="M4 6h16v10H10l-4 4v-4H4z"/>' };
  const ico = (n, klasse = '') => `<svg class="${klasse}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
  const VELD_SVG = '<svg class="lb-veld" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="14" y="12" width="332" height="126" rx="3"/><line x1="180" y1="12" x2="180" y2="138"/><circle cx="180" cy="75" r="30"/><rect x="14" y="42" width="44" height="66"/><rect x="302" y="42" width="44" height="66"/><path class="lb-pass" d="M70 118 Q 130 70 200 62"/><path class="lb-pass" d="M200 62 Q 262 28 318 44"/><circle cx="70" cy="118" r="4"/><circle cx="200" cy="62" r="4"/><circle cx="318" cy="44" r="4"/></svg>';
  /* "Veld 1 (kunstgras) A" wordt "Veld 1A"; "SV De Kraai JO11-1" wordt clubnaam met het team eronder */
  const kortVeld = id => veld(id).replace(/\s*\([^)]*\)/g, '').replace(/(\d)\s+([A-Za-z])$/, '$1$2').trim();
  const teamDelen = id => { const tm = st.d.teams?.[id]; if (!tm) return null; const c = String(tm.club || '').trim(), n = String(tm.naam || '');
    return c && n.startsWith(c) && n.length > c.length ? [c, n.slice(c.length).trim()] : [n, '']; };
  const lbTeam = (w, z) => { const dl = teamDelen(w[z]); return dl ? `<div class="lb-team ${z}"><b>${esc(dl[0])}</b>${dl[1] ? `<span>${esc(dl[1])}</span>` : ''}</div>` : `<div class="lb-team ${z} nog"><b>${esc(w['l' + z] || '?')}</b></div>`; };
  const lbWed = (w, { groot = false, tijd = false, status = '' } = {}) => { const u = st.d.uitslag?.[w.id];
    return `<div class="lb-wed ${status} ${st.team && [w.a, w.b].includes(st.team) ? 'mij' : ''}"><div class="lb-meta"><i class="lb-stip" style="--pk:${esc(kleur(w.p))}"></i>${esc([tijd ? w.t : '', kortVeld(w.v), w.titel || st.d.poules?.[w.p]?.naam || ''].filter(Boolean).join(' · '))}${u?.w ? '<u>na strafschoppen</u>' : ''}</div>
      ${lbTeam(w, 'a')}${u ? `<div class="lb-score${groot ? '' : ' klein'}"><i>${esc(u.a)}</i><i>${esc(u.b)}</i></div>` : '<div class="lb-score lb-geen">vs</div>'}${lbTeam(w, 'b')}</div>`; };
  const overDagen = datum => { if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || '')) return ''; const n = Math.round((new Date(datum + 'T12:00') - new Date(vandaag() + 'T12:00')) / 86400000);
    return n === 1 ? 'Morgen' : n > 1 ? `Over ${n} dagen` : ''; };
  const prijsKaart = d => d.prijs?.van ? `<div class="lb-prijs">${ico('finales')}Prijsuitreiking<em>${esc(d.prijs.van)}</em></div>` : '';
  const kampioen = (d, lijst) => { const f = lijst.find(w => w.fase === 'finale'), z = f && T.winnaar(d.uitslag?.[f.id]); return z && f.a && f.b ? (z === 'a' ? f.a : f.b) : ''; };

  /* De boom staand: de twee helften als kolommen, lijnen omlaag naar de finale. Past zonder schuiven op een telefoon. */
  function lbBoom(d, lijst){
    const b = T.koBoom(lijst); if (!b.finale) return '';
    const kaart = (w, n) => { const u = d.uitslag?.[w.id], z = T.winnaar(u);
      const rij = k => `<div class="lb-brij ${z === k ? 'wint' : ''} ${w[k] ? '' : 'nog'} ${st.team && w[k] === st.team ? 'mij' : ''}"><span>${esc(naam(w[k], w['l' + k]))}</span><b>${u ? esc(u[k]) : ''}</b></div>`;
      return `<div class="lb-bk"><small>${esc([n, w.t, kortVeld(w.v)].filter(Boolean).join(' · '))}</small>${rij('a')}${rij('b')}</div>`; };
    const van = (zijde, fase) => zijde.find(l => l[0].fase === fase) || [];
    const kw = [van(b.links, 'kwart'), van(b.rechts, 'kwart')], hv = [van(b.links, 'halve')[0], van(b.rechts, 'halve')[0]].filter(Boolean), f = b.finale, fu = d.uitslag?.[f.id], win = kampioen(d, lijst);
    return `<div class="lb-boom">
      ${kw[0].length ? `<div class="lb-bkol">${kw[0].map((w, i) => kaart(w, `Kwartfinale ${i + 1}`)).join('')}</div><div class="lb-bkol">${kw[1].map((w, i) => kaart(w, `Kwartfinale ${i + 1 + kw[0].length}`)).join('')}</div><i class="lb-recht"></i><i class="lb-recht"></i>` : ''}
      ${hv.length ? `${hv.map((w, i) => `<div class="lb-bkol">${kaart(w, `Halve finale ${i + 1}`)}</div>`).join('')}<i class="lb-takken"></i>` : ''}
      <div class="lb-fin">${ico('finales', 'lb-beker')}<strong>Finale</strong><small>${esc([f.t, kortVeld(f.v)].filter(Boolean).join(' · '))}${fu?.w ? ' · na strafschoppen' : ''}</small>
        <div class="lb-tegen"><span>${esc(naam(f.a, f.la))}</span><i>${fu ? `${esc(fu.a)} – ${esc(fu.b)}` : 'vs'}</i><span>${esc(naam(f.b, f.lb))}</span></div>
        ${win ? `<p class="lb-winnaar">Winnaar: <b>${esc(naam(win))}</b></p>` : ''}</div></div>`;
  }

  function htmlTelefoon(d){
    const dag = isVandaag(), ns = dag ? T.nuEnStraks(d, nuMin()) : { nu: [], straks: [], nuT: '', straksT: '', begonnen: false, klaar: d.datum < vandaag() };
    const med = d.mededelingen || [], teams = T.gesorteerd(d.teams), poules = T.gesorteerd(d.poules);
    const mijnW = w => !st.team || [w.a, w.b].includes(st.team);
    const schema = [...(d.schema || [])].sort((a, b) => T.naarMin(a.t) - T.naarMin(b.t)), ko = schema.filter(w => w.ko), koGroepen = [...new Set(ko.map(w => w.ko))];
    const mijn = st.team ? d.teams[st.team] : null;
    const mijnVolgende = st.team ? schema.filter(w => [w.a, w.b].includes(st.team) && !d.uitslag?.[w.id])[0] : null;
    const alle = schermen('tel'), eigen = alle.filter(x => x.soort !== 'sponsor'), spons = alle.filter(x => x.soort === 'sponsor' && (x.img || x.titel));
    const uur = m => new Date(m.ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const sponsors = () => spons.length ? `<div class="lb-blok"><h2>Met dank aan</h2><div class="lb-spons">${spons.map(x => { const b = x.img ? `<img src="${esc(x.img)}" alt="${esc(x.titel)}">` : `<b>${esc(x.titel)}</b>`; return x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener sponsored">${b}</a>` : `<span>${b}</span>`; }).join('')}</div></div>` : '';
    const dia = x => `<div class="lb-paneel lb-dia">${x.img ? `<img src="${esc(x.img)}" alt="">` : ''}${x.titel ? `<h3>${esc(x.titel)}</h3>` : ''}${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}</div>`;
    const V = {
      nu(){ const nu = ns.nu.filter(mijnW), straks = ns.straks.filter(mijnW), bezig = T.naarMin(ns.nuT), duur = Number(d.duur) || 12, min = ns.nuT ? Math.max(0, nuMin() - bezig) : 0;
        const win = koGroepen.map(g => kampioen(d, ko.filter(w => w.ko === g))).filter(Boolean);
        return `${med[0] ? `<button class="lb-tick" data-lv-tab="info"><b>${esc(uur(med[0]))}</b><span>${esc(med[0].tekst)}</span></button>` : ''}
          ${mijn ? `<div class="lb-mijn"><small>Jouw team</small><strong>${esc(mijn.naam)}</strong><p>${mijnVolgende ? `Volgende wedstrijd om <b>${esc(mijnVolgende.t)}</b> op <b>${esc(kortVeld(mijnVolgende.v))}</b> tegen <b>${esc(mijnVolgende.a === st.team ? naamB(mijnVolgende) : naamA(mijnVolgende))}</b>.` : 'Geen wedstrijden meer.'}${mijn.kk ? ` ${/^kleedkamer/i.test(mijn.kk) ? '' : 'Kleedkamer '}${esc(mijn.kk)}.` : ''}</p></div>` : ''}
          ${ns.klaar && win.length ? `<div class="lb-fin">${ico('finales', 'lb-beker')}<small>Winnaar</small><strong>${win.map(id => esc(naam(id))).join(' · ')}</strong></div>` : ''}
          ${nu.length ? `<div class="lb-blok"><h2><i class="lb-punt"></i>Nu op het veld<em>${esc(ns.nuT)}${min < duur ? ` · nog ${duur - min} min` : ''}</em></h2><div class="lb-balk"><i style="width:${Math.min(100, Math.round(min / duur * 100))}%"></i></div>${nu.map(w => lbWed(w, { groot: true, status: 'nu' })).join('')}</div>` : ''}
          ${straks.length ? `<div class="lb-blok"><h2>${ns.begonnen ? 'Hierna' : 'Eerste wedstrijden'}<em>${esc(ns.straksT)}</em></h2>${straks.map(w => lbWed(w)).join('')}</div>` : ''}
          ${!ns.nu.length && !ns.straks.length ? `<div class="lb-aftel">${ns.klaar ? '<strong>Afgelopen</strong><p>Het toernooi is klaar. Bekijk de eindstand en de finales.</p>' : schema.length ? `<small>${esc(overDagen(d.datum) || 'Binnenkort')}</small><strong>${esc(datumLang(d.datum))}</strong><p>Aftrap om <b>${esc(schema[0].t)}</b>. Het schema staat klaar${teams.length ? `, met ${teams.length} teams` : ''}.</p>` : '<strong>Binnenkort</strong><p>Het speelschema volgt nog.</p>'}</div>` : ''}
          ${!ns.nu.length && !ns.straks.length && !ns.klaar && schema.length ? `<div class="lb-blok"><h2>Eerste wedstrijden<em>${esc(schema[0].t)}</em></h2>${schema.filter(w => w.t === schema[0].t && mijnW(w)).map(w => lbWed(w)).join('')}</div>` : ''}
          ${eigen.map(dia).join('')}${sponsors()}`; },
      schema(){ const ws = schema.filter(mijnW), tijden = [...new Set(ws.map(w => w.t))];
        return ws.length ? `${tijden.map(t => `<div class="lb-tijd">${esc(t)}${dag && t === ns.nuT ? '<span>nu bezig</span>' : ''}</div>${ws.filter(w => w.t === t).map(w => lbWed(w, { status: dag && t === ns.nuT ? 'nu' : d.uitslag?.[w.id] ? 'gespeeld' : '' })).join('')}`).join('')}
          ${d.prijs?.van ? `<div class="lb-tijd">${esc(d.prijs.van)}</div>${prijsKaart(d)}` : ''}` : '<div class="lb-aftel"><strong>Nog geen wedstrijden</strong><p>Het speelschema volgt nog.</p></div>'; },
      finales(){ return koGroepen.map(g => { const lijst = ko.filter(w => w.ko === g), rest = lijst.filter(w => w.fase === 'brons' || w.fase === 'plaats'), naamG = koGroepen.length > 1 ? (lijst[0].titel || '').split(' · ')[1] || '' : '';
          return `<div class="lb-blok"><h2>Wedstrijdboom${naamG ? `<em>${esc(naamG)}</em>` : ''}</h2>${lbBoom(d, lijst) || lijst.map(w => lbWed(w, { tijd: true })).join('')}</div>
            ${rest.length && lbBoom(d, lijst) ? `<div class="lb-blok"><h2>Plaatsingswedstrijden</h2>${rest.map(w => lbWed(w, { tijd: true })).join('')}</div>` : ''}`; }).join('') + prijsKaart(d); },
      stand(){ return poules.filter(p => !mijn || p.id === mijn.poule).map(p => { const rijen = T.stand(d, p.id), door = Number(d.door?.[p.id]) || 0;
          return rijen.length ? `<div class="lb-paneel"><h3><i class="lb-stip" style="--pk:${esc(p.kleur || '#999')}"></i>${esc(p.naam || 'Poule')}</h3>
            <table class="lb-stand"><thead><tr><th></th><th>Team</th><th>G</th><th class="lb-x">W</th><th class="lb-x">GL</th><th class="lb-x">V</th><th>DS</th><th>P</th></tr></thead><tbody>
            ${rijen.map((r, i) => `<tr class="${i < door ? 'door' : ''} ${st.team === r.id ? 'mij' : ''}"><td>${i + 1}</td><td>${esc(r.naam)}</td><td>${r.g}</td><td class="lb-x">${r.w}</td><td class="lb-x">${r.gl}</td><td class="lb-x">${r.v}</td><td>${r.saldo > 0 ? '+' : ''}${r.saldo}</td><td>${r.pnt}</td></tr>`).join('')}</tbody></table>
            ${door ? `<p class="lb-noot">${door === 1 ? 'De nummer 1 gaat' : door === 2 ? 'De nummers 1 en 2 gaan' : `De nummers 1 tot en met ${door} gaan`} door naar de finales.</p>` : ''}</div>` : ''; }).join('') || '<div class="lb-aftel"><strong>Nog geen stand</strong><p>De stand verschijnt zodra de eerste uitslag binnen is.</p></div>'; },
      info(){ return `<div class="lb-paneel"><h3>Mededelingen</h3>${med.map(m => `<div class="lb-rij"><span><b>${esc(uur(m))}</b> ${esc(m.tekst)}</span></div>`).join('') || '<p class="lb-noot">Nog geen mededelingen.</p>'}</div>
          ${teams.some(t => t.kk) ? `<div class="lb-paneel"><h3>Kleedkamers</h3>${teams.filter(t => t.kk && (!st.team || t.id === st.team)).map(t => `<div class="lb-rij"><span>${esc(t.naam)}</span><b>${esc(t.kk)}</b></div>`).join('')}</div>` : ''}
          ${eigen.map(dia).join('')}${sponsors()}`; },
    };
    const breed = st.breed, tabs = breed ? [['nu', 'Overzicht'], ['schema', 'Schema'], ['info', `Info${med.length ? ` (${med.length})` : ''}`]]
      : [['nu', 'Nu'], ['schema', 'Schema'], ...(ko.length ? [['finales', 'Finales']] : []), ['stand', 'Stand'], ['info', 'Info']];
    if (!tabs.some(([id]) => id === st.tab)) st.tab = 'nu';
    const nav = `<nav class="lb-nav">${tabs.map(([id, n]) => `<button class="${st.tab === id ? 'aan' : ''}" data-lv-tab="${id}">${ico(id === 'info' || id === 'schema' || id === 'nu' ? id : id)}${esc(n)}${id === 'info' && med.length && !breed ? '<i class="lb-nieuw"></i>' : ''}</button>`).join('')}</nav>`;
    const kiezer = teams.length > 12 ? `<select class="lb-kies" data-lv-team aria-label="Kies je team"><option value="">Alle teams</option>${teams.map(t => `<option value="${esc(t.id)}"${st.team === t.id ? ' selected' : ''}>${esc(t.naam)}</option>`).join('')}</select>`
      : teams.length ? `<div class="lb-chips"><button class="${st.team ? '' : 'aan'}" data-lb-team="">Alle teams</button>${teams.map(t => `<button class="${st.team === t.id ? 'aan' : ''}" data-lb-team="${esc(t.id)}">${esc(t.naam)}</button>`).join('')}</div>` : '';
    const img = T.plaatjeOk(d.logo) ? `<img class="lb-logo" src="${esc(d.logo)}" alt="">` : `<div class="lb-logo">${esc((d.clubNaam || d.naam || 'C').trim()[0] || 'C')}</div>`;
    const inhoud = breed && st.tab === 'nu' ? `<main class="lb-drie"><div>${V.nu()}</div><div>${ko.length ? V.finales() : V.schema()}</div><div>${V.stand()}</div></main>` : `<main class="lb-een">${V[st.tab]()}</main>`;
    return `<div class="lb ${breed ? 'breed' : ''}"${tvKleur(d.kleur)}><header class="lb-kop">${VELD_SVG}<div class="lb-kop-in"><div class="lb-kop-rij">${img}<div class="lb-titel"><small>${esc([d.clubNaam, datumLang(d.datum), d.locatie].filter(Boolean).join(' · '))}</small><h1>${esc(d.naam || 'Toernooi')}</h1></div>${ns.nu.length ? '<span class="lb-live"><i></i>Live</span>' : ''}</div>
        ${kiezer}${breed ? nav : ''}</div></header>
      ${d.planB ? `<div class="lb-planb"><b>Plan B:</b> ${esc(d.planB)}</div>` : ''}
      ${inhoud}<p class="lb-voet">Werkt zichzelf bij · Cluppie</p>${breed ? '' : nav}</div>`;
  }

  /* Tv: links wat er nu en straks speelt, rechts wisselend de standen en de dia's (elke 12 seconden). */
  const tvWed = (w, { tijd = false } = {}) => `<div class="kb-wed" style="--pk:${esc(kleur(w.p))}" data-tv-k="${esc(w.id)}" data-tv-stand="${esc(uit(w))}">
      <span class="kb-wed-v">${tijd ? `<b>${esc(w.t)}</b>` : ''}${esc(kortVeld(w.v))}${titel(w)}</span><span class="kb-wed-a">${esc(naamA(w))}</span>
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

  const kiesTeam = id => { st.team = id; try { localStorage.setItem(SLEUTEL + liveId, st.team); } catch { /* geen opslag */ } teken(); };
  el.addEventListener('click', e => { const t = e.target.closest('[data-lv-tab]'), c = e.target.closest('[data-lb-team]');
    if (t){ st.tab = t.dataset.lvTab; teken(); window.scrollTo(0, 0); } else if (c) kiesTeam(c.dataset.lbTeam); });
  if (!tv) window.addEventListener('resize', () => { if (st.d && (window.innerWidth >= 980) !== st.breed) teken(); });
  el.addEventListener('change', e => { if (e.target.matches('[data-lv-team]')) kiesTeam(e.target.value); });
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
/* ---- het bord: live pagina op telefoon, tablet en laptop [20261127] ---- */
html.lb-html,html.lb-html body{background:#0b0d10}
html.lb-html .lv-midden{color:#fdfdfe}
.lb{--accent:#cc2620;--lb-ink:#fdfdfe;--lb-zacht:rgba(253,253,254,.68);--lb-lijn:rgba(255,255,255,.13);--lb-vlak:rgba(255,255,255,.065);--lb-op:#fff;
  --lb-a:color-mix(in srgb,var(--accent) 58%,#fff);--lb-boven:color-mix(in srgb,var(--accent) 90%,#fff 10%);--lb-midden:color-mix(in srgb,var(--accent) 70%,#07080a);--lb-onder:color-mix(in srgb,var(--accent) 30%,#07080a);
  min-height:100vh;min-height:100dvh;box-sizing:border-box;display:flex;flex-direction:column;color:var(--lb-ink);font-size:15px;line-height:1.35;-webkit-font-smoothing:antialiased;
  background:radial-gradient(120% 480px at 0% 0%,color-mix(in srgb,var(--accent) 26%,transparent),transparent 70%),#0b0d10;padding-bottom:calc(74px + env(safe-area-inset-bottom))}
.lb[data-licht]{--lb-op:#111;--lb-a:var(--accent);--lb-boven:color-mix(in srgb,var(--accent) 62%,#07080a);--lb-midden:color-mix(in srgb,var(--accent) 45%,#07080a);--lb-onder:color-mix(in srgb,var(--accent) 16%,#07080a)}
.lb *{box-sizing:border-box}
.lb button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:inherit}
.lb button:focus-visible,.lb a:focus-visible,.lb select:focus-visible{outline:2px solid #fff;outline-offset:2px}
.lb svg{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.lb-kop{position:relative;overflow:hidden;background:linear-gradient(150deg,var(--lb-boven),var(--lb-midden) 55%,var(--lb-onder));padding:calc(16px + env(safe-area-inset-top)) 0 12px}
.lb-kop .lb-veld{position:absolute;inset:0;width:100%;height:100%;stroke:rgba(255,255,255,.2);stroke-width:1.5}
.lb-kop .lb-pass{stroke:rgba(255,255,255,.5);stroke-dasharray:6 6;animation:lbPass 2.6s linear infinite}
@keyframes lbPass{to{stroke-dashoffset:-24}}
.lb-kop-in{position:relative;max-width:1240px;margin:0 auto;padding:0 14px;display:flex;flex-direction:column;gap:12px}
.lb-kop-rij{display:flex;align-items:center;gap:11px}
.lb-logo{width:48px;height:48px;border-radius:13px;background:#fff;color:var(--accent);object-fit:contain;padding:4px;flex-shrink:0;display:grid;place-items:center;font-family:var(--font-display);font-size:28px;line-height:1}
.lb-titel{min-width:0;flex:1}
.lb-titel small{display:block;padding-right:74px;font-size:11.5px;font-weight:600;opacity:.88}
.lb-titel h1{font-family:var(--font-display);text-transform:uppercase;font-size:28px;line-height:.98;margin:2px 0 0;letter-spacing:.02em;font-weight:400;overflow-wrap:break-word}
.lb-live{position:absolute;top:0;right:14px;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.38);flex-shrink:0}
.lb-live i,.lb-punt{width:8px;height:8px;border-radius:50%;background:currentColor;animation:lvPuls 1.6s infinite;display:inline-block;flex-shrink:0}
.lb-punt{background:var(--lb-a)}
.lb-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -14px;padding:1px 14px}
.lb-chips::-webkit-scrollbar{display:none}
.lb .lb-chips button{flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:13px;font-weight:600;min-height:36px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.24);color:#fff}
.lb .lb-chips button.aan{background:#fff;color:#111;border-color:#fff}
.lb-kies{width:100%;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.35);color:#fff;font:inherit;font-size:16px}
.lb-kies option{color:#111}
.lb-nav{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;background:rgba(14,16,20,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-top:1px solid var(--lb-lijn);padding:0 4px env(safe-area-inset-bottom)}
.lb .lb-nav button{flex:1;position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:700;letter-spacing:.02em;padding:9px 0 10px;min-height:58px;color:var(--lb-zacht)}
.lb-nav svg{width:22px;height:22px}
.lb .lb-nav button.aan{color:#fff}.lb-nav button.aan svg{stroke:var(--lb-a);filter:drop-shadow(0 0 6px color-mix(in srgb,var(--accent) 70%,transparent))}
.lb-nieuw{position:absolute;top:8px;left:calc(50% + 8px);width:8px;height:8px;border-radius:50%;background:#f5a524}
.lb-een,.lb-drie{width:100%;max-width:640px;margin:0 auto;padding:14px 14px 4px;display:flex;flex-direction:column;gap:14px}
.lb-planb{max-width:612px;width:calc(100% - 28px);margin:12px auto 0;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,#e11 24%,transparent);border:1px solid color-mix(in srgb,#e11 55%,transparent)}
.lb-blok{display:flex;flex-direction:column;gap:8px}
.lb-blok>h2,.lb-paneel>h3{margin:0;display:flex;align-items:center;gap:8px;font-family:var(--font-display);text-transform:uppercase;font-weight:400;font-size:22px;letter-spacing:.03em;line-height:1}
.lb-paneel>h3{font-size:20px}
.lb-blok>h2 em{font-style:normal;font-family:var(--font-body,inherit);text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:700;margin-left:auto;color:var(--lb-zacht);font-variant-numeric:tabular-nums}
.lb-balk{height:4px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.12)}.lb-balk i{display:block;height:100%;border-radius:4px;background:var(--lb-a);transition:width .6s}
.lb-wed{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:5px 10px;align-items:center;padding:10px 12px;border-radius:14px;background:var(--lb-vlak);border:1px solid var(--lb-lijn)}
.lb-wed.nu{background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 28%,transparent),rgba(255,255,255,.05));border-color:color-mix(in srgb,var(--lb-a) 60%,transparent)}
.lb-wed.gespeeld{opacity:.66}
.lb-wed.mij{box-shadow:0 0 0 2px #fff inset;opacity:1}
.lb-meta{grid-column:1/-1;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--lb-zacht)}
.lb-meta u{text-decoration:none;margin-left:auto;text-transform:none;letter-spacing:0}
.lb-stip{width:9px;height:9px;border-radius:50%;background:var(--pk);flex-shrink:0;display:inline-block}
.lb-team{min-width:0;display:flex;flex-direction:column}.lb-team.a{text-align:right}
.lb-team b{font-weight:700;font-size:15px;overflow-wrap:break-word}.lb-team span{font-size:11px;font-weight:600;color:var(--lb-zacht)}
.lb-team.nog b{font-weight:500;font-style:italic;color:var(--lb-zacht)}
.lb-score{font-family:var(--font-display);font-size:30px;line-height:1;display:flex;gap:5px;align-items:center;font-variant-numeric:tabular-nums}
.lb-score i{font-style:normal;min-width:32px;padding:4px 0 2px;text-align:center;border-radius:7px;background:#fff;color:#0b0d10}
.lb-score.klein{font-size:22px}.lb-score.klein i{min-width:26px}
.lb-score.lb-geen{font-family:inherit;font-size:12px;font-weight:700;color:var(--lb-zacht)}
.lb-tijd{font-family:var(--font-display);font-size:19px;letter-spacing:.04em;display:flex;align-items:center;gap:8px;margin-top:4px}
.lb-tijd::after{content:'';flex:1;height:1px;background:var(--lb-lijn)}
.lb-tijd span{font-family:var(--font-body,inherit);font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:var(--accent);color:var(--lb-op)}
.lb-een>.lb-tijd+.lb-wed,.lb-een>.lb-wed{margin-top:-6px}.lb-een>.lb-tijd{margin-top:2px}
.lb-mijn{padding:13px 15px;border-radius:16px;background:#fff;color:#0b0d10;display:flex;flex-direction:column;gap:2px}
.lb-mijn small,.lb-aftel small{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.lb[data-licht] .lb-mijn small{color:#555}
.lb-mijn strong,.lb-aftel strong{font-family:var(--font-display);text-transform:uppercase;font-weight:400;font-size:27px;line-height:1;letter-spacing:.02em}
.lb-mijn p,.lb-aftel p{margin:4px 0 0;font-size:14px}
.lb-aftel{padding:18px 16px;border-radius:18px;border:1px dashed rgba(255,255,255,.3);background:var(--lb-vlak);display:flex;flex-direction:column;gap:3px}
.lb-aftel small{color:var(--lb-a)}.lb-aftel strong{font-size:34px}.lb-aftel p{color:var(--lb-zacht)}
.lb .lb-tick{display:flex;gap:9px;align-items:baseline;width:100%;padding:10px 12px;border-radius:12px;font-size:14px;border:1px solid color-mix(in srgb,#f5a524 55%,transparent);background:color-mix(in srgb,#f5a524 14%,transparent)}
.lb-tick b{font-variant-numeric:tabular-nums}
.lb-paneel{border-radius:16px;padding:12px 13px;display:flex;flex-direction:column;gap:7px;background:var(--lb-vlak);border:1px solid var(--lb-lijn)}
.lb-noot{font-size:12px;margin:0;color:var(--lb-zacht)}
.lb-stand{width:100%;border-collapse:collapse;font-size:14px}.lb-stand td:not(:nth-child(2)){font-variant-numeric:tabular-nums}
.lb-stand th{font-size:10.5px;font-weight:700;letter-spacing:.06em;padding:4px 6px;text-align:center;color:var(--lb-zacht)}
.lb-stand td{padding:8px 6px;text-align:center;border-top:1px solid var(--lb-lijn)}
.lb-stand td:nth-child(2),.lb-stand th:nth-child(2){text-align:left;width:100%;overflow-wrap:break-word}
.lb-stand td:first-child{font-family:var(--font-display);font-size:18px;width:22px;color:var(--lb-zacht)}
.lb-stand td:last-child{font-weight:800}
.lb-stand tr.door td:first-child{color:var(--lb-a)}.lb-stand tr.door td:nth-child(2){font-weight:700}
.lb-stand tr.mij td{background:rgba(255,255,255,.11)}
.lb-rij{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--lb-lijn);font-size:14px}
.lb-paneel>h3+.lb-rij{border-top:0}
.lb-boom{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
.lb-bkol{display:flex;flex-direction:column;gap:8px;min-width:0}
.lb-bk{display:flex;flex-direction:column;gap:4px;padding:9px 10px;border-radius:14px;font-size:14px;background:var(--lb-vlak);border:1px solid var(--lb-lijn)}
.lb-bk small,.lb-fin small{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--lb-zacht)}
.lb-brij{display:flex;justify-content:space-between;gap:6px;align-items:baseline}.lb-brij span{min-width:0;overflow-wrap:break-word;font-weight:600}
.lb-brij b{font-family:var(--font-display);font-size:18px;font-weight:400}
.lb-brij.wint span{font-weight:800}.lb-brij.wint b{color:var(--lb-a)}
.lb-brij.nog span{font-weight:500;font-style:italic;color:var(--lb-zacht)}
.lb-brij.mij span{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}
.lb-recht{height:18px;width:2px;background:var(--lb-a);justify-self:center;opacity:.8}
.lb-takken{grid-column:1/-1;height:28px;position:relative}
.lb-takken::before{content:'';position:absolute;left:25%;right:25%;top:0;height:14px;border:2px solid var(--lb-a);border-top:0;border-radius:0 0 10px 10px;opacity:.8}
.lb-takken::after{content:'';position:absolute;left:50%;top:14px;height:14px;width:2px;margin-left:-1px;background:var(--lb-a);opacity:.8}
.lb-fin{grid-column:1/-1;border-radius:18px;padding:16px 14px;display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center;color:var(--lb-op);
  background:linear-gradient(160deg,var(--lb-boven),var(--lb-midden) 60%,var(--lb-onder));box-shadow:0 16px 32px -16px var(--accent)}
.lb[data-licht] .lb-fin{color:#fff}
.lb-fin small{color:inherit;opacity:.85}
.lb-fin strong{font-family:var(--font-display);text-transform:uppercase;font-weight:400;font-size:32px;line-height:1;letter-spacing:.04em}
.lb-beker{width:36px;height:36px}
.lb-tegen{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center;width:100%;font-weight:700}
.lb-tegen span{overflow-wrap:break-word}.lb-tegen span:first-child{text-align:right}.lb-tegen span:last-child{text-align:left}
.lb-tegen i{font-style:normal;font-family:var(--font-display);font-size:24px;white-space:nowrap}
.lb-winnaar{margin:2px 0 0;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.3)}
.lb-prijs{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:14px;font-weight:700;background:var(--lb-vlak);border:1px solid var(--lb-lijn)}
.lb-prijs svg{width:22px;height:22px;stroke:var(--lb-a)}.lb-prijs em{font-style:normal;margin-left:auto;font-family:var(--font-display);font-size:22px}
.lb-spons{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -14px;padding:0 14px}.lb-spons::-webkit-scrollbar{display:none}
.lb-spons a,.lb-spons span{flex:0 0 auto;height:54px;min-width:92px;padding:8px 14px;border-radius:12px;background:rgba(255,255,255,.94);color:#111;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:13px;font-weight:800}
.lb-spons img{max-height:100%;max-width:140px;object-fit:contain;display:block}
.lb-dia{align-items:center;text-align:center}.lb-dia img{max-width:100%;max-height:220px;object-fit:contain;border-radius:10px;background:#fff;padding:8px}
.lb-dia p{margin:0;white-space:pre-line;color:var(--lb-zacht)}
.lb-voet{text-align:center;color:var(--lb-zacht);font-size:12px;margin:14px 0 0}
@media (max-width:479px){.lb-x{display:none}}
/* breed scherm: drie kolommen, tabbladen in de kop */
.lb.breed{padding-bottom:28px}
.lb.breed .lb-kop{padding:26px 0 16px}.lb.breed .lb-live{right:26px}.lb.breed .lb-kop-in{padding:0 26px;gap:14px}
.lb.breed .lb-titel h1{font-size:46px}.lb.breed .lb-logo{width:66px;height:66px;font-size:38px;border-radius:16px}
.lb.breed .lb-chips{flex-wrap:wrap;overflow:visible;margin:0;padding:0}
.lb.breed .lb-nav{position:static;background:none;border:0;padding:0;gap:6px;-webkit-backdrop-filter:none;backdrop-filter:none}
.lb.breed .lb-nav button{flex:0 0 auto;flex-direction:row;gap:7px;min-height:40px;padding:8px 16px;border-radius:10px;font-size:14px;background:rgba(0,0,0,.3);color:#fff}
.lb.breed .lb-nav button.aan{background:#0b0d10}.lb.breed .lb-nav svg{width:18px;height:18px}
.lb.breed .lb-drie{max-width:1240px;display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:22px;padding:22px 26px 4px;align-items:start}
.lb.breed .lb-drie>div{display:flex;flex-direction:column;gap:14px;min-width:0}
.lb.breed .lb-een{max-width:760px;padding-top:22px}
.lb.breed .lb-spons{flex-wrap:wrap;overflow:visible;margin:0;padding:0}
@media (prefers-reduced-motion:reduce){.lb-kop .lb-pass,.lb-live i,.lb-punt{animation:none}}
.lv-voet{text-align:center;color:var(--ink-2);font-size:var(--t-xs,12px);margin:8px 0 0}
@media (max-width:420px){.lv-wed{grid-template-columns:52px minmax(0,1fr) 50px minmax(0,1fr)}}`;
  document.head.appendChild(s);
}
