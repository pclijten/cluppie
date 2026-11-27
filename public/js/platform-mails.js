/* ==================== PLATFORM › MAILS (alleen platformbeheerder) ====================
   [20261116p] Elke mail die Cluppie verstuurt op één plek (goedgekeurde mockup "Cluppie Platform › Mails",
   besluiten in claude/eindbaas-mails-beheren-impactanalyse.md):
     • Teksten: per mail onderwerp, kop, tekst, knop, afsluiting en kleine regel aanpassen, met invulvelden,
       een voorbeeld dat meetypt, een proef naar jezelf, aan/uit en terug naar standaard;
     • Verzonden: wat er de laatste 30 dagen is verstuurd en of het aankwam;
     • Algemeen: naam van de afzender en de regel onderaan, voor elke mail;
     • "Eerst laten zien": bij goedkeuren of afwijzen van een aanmelding de mail voor die ene club aanpassen.
   De teksten staan op de server (platformMails/teksten); lezen en schrijven gaat alleen via de functies
   leesMailteksten, zetMailtekst en stuurProefmail. Opmaak en links zitten vast in functions/mail-sjabloon.js.
   Wordt getekend in het platformcentrum (platform-centrum.js) in <div id="pmRoot">. */
import { functions, httpsCallable } from './firebase.js?v=20261011g';
import { esc, meld } from './state.js?v=20261128k';
import { ico } from './icons.js?v=20261127b';
import { TEKSTVELDEN, VELDNAAM, controleer, zelfde, statusVan, voorbeeldVan, voorAanmelding, tijdTekst } from './platform-mails-logica.js?v=20261116q';

const M = { root: null, data: null, laden: false, fout: '', tab: 'teksten', sel: null, concept: {}, algemeen: null,
  laatsteVeld: 'tekst', zeker: null, bezig: false };
const TABS = [['teksten', 'Teksten'], ['verzonden', 'Verzonden'], ['algemeen', 'Algemeen']];
const roep = (naam, d) => httpsCallable(functions, naam)(d || {}).then(r => r.data);
const foutTekst = x => (x && (x.code === 'functions/not-found' || x.code === 'not-found')) ? 'De functies voor Mails zijn nog niet gedeployed.' : ((x && x.message) || 'Dat lukte niet.');

const soortNu = () => M.data.soorten.find(s => s.id === M.sel) || M.data.soorten[0];
const tekstNu = s => M.concept[s.id] || s.tekst;

/* ---------- openen ---------- */
export async function toonMails(root){
  M.root = root;
  if (!root.dataset.pmKlaar){
    root.dataset.pmKlaar = '1';
    root.addEventListener('click', klik);
    root.addEventListener('input', invoer);
    root.addEventListener('focusin', e => { if (e.target.dataset?.pmVeld) M.laatsteVeld = e.target.dataset.pmVeld; });
  }
  if (M.data) return teken();
  await laad();
}
async function laad(){
  M.laden = true; M.fout = ''; teken();
  try {
    M.data = await roep('leesMailteksten');
    if (!M.sel || !M.data.soorten.some(s => s.id === M.sel)) M.sel = (M.data.soorten.find(s => s.id === 'welkomClub') || M.data.soorten[0]).id;
    licht = null;
  } catch (x){ M.fout = foutTekst(x); }
  M.laden = false; teken();
}

/* ---------- tekenen ---------- */
function teken(){
  if (!M.root || !M.root.isConnected) return;
  const kop = `<div class="pc-kop"><div><h1 class="tc-h1">Mails</h1><p class="tc-meta">Elke mail die Cluppie verstuurt. Pas de tekst aan, bekijk meteen het resultaat en stuur jezelf een proef.</p></div></div>`;
  if (M.laden && !M.data){ M.root.innerHTML = kop + '<div class="tc-leeg">Mails laden…</div>'; return; }
  if (M.fout && !M.data){
    M.root.innerHTML = kop + `<div class="kaart leeg"><p>${esc(M.fout)}</p><p class="tc-meta">Deploy eerst de functies (zie PORTEREN.md), daarna werkt dit scherm.</p><button class="knop licht klein" data-pm="opnieuw">Opnieuw proberen</button></div>`;
    return;
  }
  const tabs = `<div class="pc-lade-tabs pm-tabs" role="tablist" aria-label="Onderdelen van Mails">${TABS.map(([id, n]) =>
    `<button type="button" role="tab" aria-selected="${M.tab === id}" class="${M.tab === id ? 'actief' : ''}" data-pm="tab" data-tab="${id}">${n}</button>`).join('')}</div>`;
  M.root.innerHTML = kop + tabs + ({ teksten: htmlTeksten, verzonden: htmlVerzonden, algemeen: htmlAlgemeen })[M.tab]();
  if (M.tab === 'teksten') werkVoorbeeldBij();
}

function htmlLijst(){
  let groep = '';
  return M.data.soorten.map(s => {
    const kop = s.groep !== groep ? `<h2 class="pm-groep">${esc(s.groep)}</h2>` : '';
    groep = s.groep;
    const st = statusVan(s, M.concept[s.id]);
    return `${kop}<button type="button" class="pm-rij ${s.id === M.sel ? 'actief' : ''}" aria-pressed="${s.id === M.sel}" data-pm="kies" data-id="${s.id}">
      <span class="pm-rij-kop"><b>${esc(s.naam)}</b><span class="pm-status ${st === 'Standaard' ? '' : st === 'Aangepast' ? 'ok' : 'let'}" data-pm-status="${s.id}">${st}</span></span>
      <small>${esc(s.wanneer)}</small>
      <small>${s.aantal ? `${s.aantal} keer verstuurd in ${M.data.bewaarDagen} dagen` : 'Nog niet verstuurd'}</small></button>`;
  }).join('');
}
const veld = (s, k, t, rijen) => {
  const id = `pm-${k}`, max = M.data.max?.[k] || '';
  const invoer = rijen
    ? `<textarea class="invoer" id="${id}" rows="${rijen}" data-pm-veld="${k}" maxlength="${max}">${esc(t[k])}</textarea>`
    : `<input class="invoer" id="${id}" type="text" data-pm-veld="${k}" maxlength="${max}" value="${esc(t[k])}">`;
  return `<div class="pm-veld"><label for="${id}">${VELDNAAM[k]}</label>${invoer}</div>`;
};
const schakel = (actie, naam, uitleg, aan) => `<div class="pc-schakel"><div><b>${esc(naam)}</b><small>${esc(uitleg)}</small></div>
  <button type="button" class="pc-sw" role="switch" aria-checked="${aan}" aria-label="${esc(naam)}" data-pm="${actie}"></button></div>`;

function htmlTeksten(){
  const s = soortNu(), t = tekstNu(s);
  const zeker = M.zeker === s.id;
  return `<div class="pm-drie">
    <section class="pm-lijst" aria-label="Alle mails">${htmlLijst()}</section>
    <section class="kaart pm-editor" aria-label="Tekst aanpassen">
      <div><h2 class="tc-h2">${esc(s.naam)}</h2>
        <p class="tc-meta">Naar ${esc(s.aan)}. ${esc(s.wanneer)}.</p></div>
      ${veld(s, 'onderwerp', t)}${veld(s, 'titel', t)}${veld(s, 'tekst', t, 8)}
      <div class="pm-veld"><span class="pm-label">Invulvelden voor deze mail</span>
        <div class="pc-chips">${s.velden.map(v => `<button type="button" class="pm-chip" data-pm="chip" data-veld="${v.id}" aria-label="Zet het invulveld ${esc(v.naam)} in de tekst">${esc(v.naam)} <code>{${v.id}}</code></button>`).join('')}</div>
        <small class="tc-meta">Tik op een veld om het op de plek van je cursor te zetten; Cluppie vult het bij het versturen in. Tekst tussen [haken] valt weg als het veld leeg is. Een lege regel begint een nieuwe alinea.</small></div>
      ${s.heeftKnop ? veld(s, 'knop', t) : ''}${veld(s, 'slot', t, 4)}${veld(s, 'voet', t)}
      ${s.vast ? `<p class="pc-signaal info"><b>Staat er altijd in:</b> ${esc(s.vast)}</p>` : ''}
      <p class="pc-signaal" id="pmFout" role="alert" hidden></p>
      ${s.kanUit ? schakel('uit', 'Deze mail versturen', s.uit ? 'Uit. Er gaat niets de deur uit tot je hem weer aanzet.' : 'Aan. Zet uit als je deze mail niet meer wilt laten versturen.', !s.uit)
        : '<p class="tc-meta pm-vast">Deze mail staat altijd aan: zonder kan iemand niet inloggen.</p>'}
      ${s.magEerstTonen ? schakel('eerst', 'Eerst laten zien bij versturen', 'Bij goedkeuren of afwijzen zie je deze mail eerst en kun je hem voor die ene club nog aanpassen.', s.eerstTonen) : ''}
      <div class="pc-knoppen pm-acties">
        <button type="button" class="knop fluo" data-pm="bewaar">Tekst bewaren</button>
        <button type="button" class="knop licht" data-pm="proef">${ico('communication-mail', 18)} Stuur mij een proef</button>
        <button type="button" class="knop licht ${zeker ? 'pc-zeker' : ''}" data-pm="herstel" ${s.aangepast || M.concept[s.id] ? '' : 'disabled'}>${zeker ? 'Zeker? Terug naar standaard' : 'Terug naar standaard'}</button>
      </div>
    </section>
    <section class="pm-voorbeeld" aria-label="Voorbeeld van de mail">
      <div class="pm-voorbeeld-kop"><h2 class="pm-groep">Zo komt hij aan</h2><small class="tc-meta">Ingevuld met voorbeeldgegevens</small></div>
      <div class="pm-mail" id="pmVoorbeeld"></div>
    </section>
  </div>`;
}

/* De mail zelf is altijd licht (zo komt hij ook aan), ongeacht het thema van de app. */
function htmlMail(v){
  const p = a => `<p>${esc(a).replace(/\r?\n/g, '<br>')}</p>`;
  return `<div class="pm-mail-kop"><b>${esc(v.onderwerp)}</b><small>Van: ${esc(v.afzender)} &lt;paul@cluppie.io&gt;</small></div>
    <div class="pm-mail-vel"><div class="pm-mail-kaart">
      <div class="pm-mail-merk"><span aria-hidden="true">C</span><b>Cluppie</b></div>
      <div class="pm-mail-inhoud">
        ${v.voorkop ? `<div class="pm-mail-voorkop">${esc(v.voorkop)}</div>` : ''}
        <div class="pm-mail-titel">${esc(v.titel)}</div>
        ${v.alineas.map(p).join('')}
        ${v.stappen.length ? `<ol class="pm-mail-stappen">${v.stappen.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${v.gegevens.length ? `<dl class="pm-mail-gegevens">${v.gegevens.map(([l, w]) => `<dt>${esc(l)}</dt><dd>${esc(w)}</dd>`).join('')}</dl>` : ''}
        ${v.knop ? `<div><span class="pm-mail-knop">${esc(v.knop)}</span></div>` : ''}
        ${v.slot.map(p).join('')}
      </div>
      <div class="pm-mail-voet">${esc(v.merkregel)} · www.cluppie.io${v.voet ? `<br>${esc(v.voet)}` : ''}</div>
    </div></div>`;
}
/* Alleen het voorbeeld, de foutregel en de status in de lijst: het formulier blijft staan, zodat de cursor niet verspringt. */
function werkVoorbeeldBij(){
  const s = soortNu(), t = tekstNu(s);
  const doel = M.root.querySelector('#pmVoorbeeld');
  if (doel) doel.innerHTML = htmlMail(voorbeeldVan(s, t, M.algemeen || M.data.algemeen));
  const fout = controleer(s, t, M.data.max), f = M.root.querySelector('#pmFout');
  if (f){ f.hidden = !fout; f.innerHTML = fout ? `<b>Let op:</b> ${esc(fout)} Bewaren kan pas als dit is opgelost.` : ''; }
  const st = M.root.querySelector(`[data-pm-status="${s.id}"]`), nu = statusVan(s, M.concept[s.id]);
  if (st){ st.textContent = nu; st.className = `pm-status ${nu === 'Standaard' ? '' : nu === 'Aangepast' ? 'ok' : 'let'}`; }
  const h = M.root.querySelector('[data-pm="herstel"]'); if (h) h.disabled = !(s.aangepast || M.concept[s.id]);
}

function htmlVerzonden(){
  const rijen = M.data.verzonden.map(v => `<tr><td class="pm-tijd">${esc(tijdTekst(v.tijd))}</td><td><b>${esc(v.naam)}</b></td><td>${esc(v.naar)}</td>
    <td><span class="pm-status ${v.status === 'aangekomen' ? 'ok' : 'let'}">${v.status === 'aangekomen' ? 'Aangekomen' : v.status === 'mislukt' ? 'Mislukt' : 'Bezig'}</span>${v.fout ? `<small class="pm-reden">${esc(v.fout)}</small>` : ''}</td></tr>`).join('');
  return `<div class="pc-kop"><p class="tc-meta pm-uitleg">Wat er de laatste ${M.data.bewaarDagen} dagen is verstuurd en of het is aangekomen. Daarna wordt de regel gewist. De inhoud van inlogmails wordt direct na het versturen gewist.${M.data.vol ? ' Je ziet de 100 nieuwste.' : ''}</p>
      <div class="pc-knoppen"><button type="button" class="knop licht klein" data-pm="opnieuw">${ico('action-loading', 16)} Vernieuwen</button></div></div>
    ${rijen ? `<div class="pc-tabel-wrap"><table class="pc-tabel pm-tabel"><thead><tr><th scope="col">Wanneer</th><th scope="col">Mail</th><th scope="col">Naar</th><th scope="col">Status</th></tr></thead><tbody>${rijen}</tbody></table></div>`
      : '<div class="kaart leeg">Er is in deze periode nog niets verstuurd.</div>'}`;
}

function htmlAlgemeen(){
  const a = M.algemeen || M.data.algemeen;
  return `<div class="pc-twee">
    <section class="kaart pm-editor"><h2 class="tc-h2">Geldt voor elke mail</h2>
      <div class="pm-veld"><label for="pm-afzender">Naam van de afzender</label><input class="invoer" id="pm-afzender" type="text" maxlength="40" data-pm-alg="afzender" value="${esc(a.afzender)}"></div>
      <div class="pm-veld"><label for="pm-merkregel">Regel onderaan</label><input class="invoer" id="pm-merkregel" type="text" maxlength="120" data-pm-alg="merkregel" value="${esc(a.merkregel)}">
        <small class="tc-meta">Daarachter staat altijd www.cluppie.io.</small></div>
      <div class="pm-veld"><span class="pm-label">Antwoorden komen binnen op</span><span class="tc-meta">paul@cluppie.io (vast, staat in de instellingen van de server)</span></div>
      <div class="pc-knoppen pm-acties"><button type="button" class="knop fluo" data-pm="bewaaralgemeen">Algemeen bewaren</button>
        <button type="button" class="knop licht" data-pm="standaardalgemeen">Terug naar standaard</button></div>
    </section>
    <section class="kaart pc-blok"><h2 class="tc-h2">Wat je hier niet kunt breken</h2>
      <div class="pc-taak"><div class="pc-taak-tekst"><b>Opmaak, logo en links zitten vast</b><small>Je past alleen woorden aan.</small></div></div>
      <div class="pc-taak"><div class="pc-taak-tekst"><b>Een verkeerd invulveld wordt geweigerd</b><small>Bewaren kan pas als elk invulveld bij de mail hoort.</small></div></div>
      <div class="pc-taak"><div class="pc-taak-tekst"><b>Terug naar standaard</b><small>Zet per mail de oorspronkelijke tekst terug.</small></div></div>
      <div class="pc-taak"><div class="pc-taak-tekst"><b>Reserve</b><small>Valt de eigen mailfunctie uit, dan stuurt Firebase zijn standaardmail voor bevestigen en wachtwoord. Die tekst beheer je in de Firebase-console.</small></div></div>
    </section></div>`;
}

/* ---------- acties ---------- */
function invoer(e){
  const el = e.target;
  if (el.dataset?.pmVeld){
    const s = soortNu();
    M.concept[s.id] = { ...tekstNu(s), [el.dataset.pmVeld]: el.value };
    if (zelfde(M.concept[s.id], s.tekst)) delete M.concept[s.id];
    M.zeker = null;
    return werkVoorbeeldBij();
  }
  if (el.dataset?.pmAlg) M.algemeen = { ...(M.algemeen || M.data.algemeen), [el.dataset.pmAlg]: el.value };
}
async function klik(e){
  const b = e.target.closest('[data-pm]');
  if (!b || !M.root.contains(b) || b.disabled) return;
  const a = b.dataset.pm;
  if (a === 'opnieuw') return laad();
  if (a === 'tab'){ M.tab = b.dataset.tab; M.zeker = null; return teken(); }
  if (a === 'kies'){
    M.sel = b.dataset.id; M.zeker = null; M.laatsteVeld = 'tekst'; teken();
    /* op de telefoon staat de lijst boven het formulier: breng het formulier in beeld */
    if (window.matchMedia('(max-width:999px)').matches) M.root.querySelector('.pm-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  if (a === 'chip') return voegVeldIn(b.dataset.veld);
  if (a === 'bewaar') return bewaar(b);
  if (a === 'proef') return proef(b);
  if (a === 'herstel') return herstel(b);
  if (a === 'uit' || a === 'eerst') return schakelaar(b, a);
  if (a === 'bewaaralgemeen') return bewaarAlgemeen(b, M.algemeen || M.data.algemeen);
  if (a === 'standaardalgemeen') return bewaarAlgemeen(b, M.data.algemeenStd);
}
function voegVeldIn(k){
  const el = M.root.querySelector(`#pm-${M.laatsteVeld}`) || M.root.querySelector('#pm-tekst');
  if (!el) return;
  const van = el.selectionStart ?? el.value.length, tot = el.selectionEnd ?? el.value.length;
  el.setRangeText(`{${k}}`, van, tot, 'end');
  el.focus();
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
async function bezig(b, fn){
  if (M.bezig) return;
  M.bezig = true; b.disabled = true;
  try { await fn(); }
  catch (x){ meld(foutTekst(x)); }
  M.bezig = false; if (b.isConnected) b.disabled = false;
}
const bewaar = b => bezig(b, async () => {
  const s = soortNu(), t = tekstNu(s);
  const fout = controleer(s, t, M.data.max);
  if (fout){ meld(fout); return; }
  await roep('zetMailtekst', { soort: s.id, tekst: t });
  s.tekst = Object.fromEntries(TEKSTVELDEN.map(k => [k, String(t[k] || '').trim()]));
  s.aangepast = !zelfde(s.tekst, s.std); delete M.concept[s.id]; licht = null;
  meld('Tekst bewaard. Vanaf nu gaat deze tekst mee.'); teken();
});
const proef = b => bezig(b, async () => {
  const s = soortNu(), t = tekstNu(s);
  const fout = controleer(s, t, M.data.max);
  if (fout){ meld(fout); return; }
  const r = await roep('stuurProefmail', { soort: s.id, tekst: t });
  meld(`Proef onderweg naar ${r.naar}. Kijk over een minuut in je inbox.`);
});
function herstel(b){
  const s = soortNu();
  if (M.zeker !== s.id){ M.zeker = s.id; return teken(); }
  return bezig(b, async () => {
    await roep('zetMailtekst', { soort: s.id, herstel: true });
    M.zeker = null; delete M.concept[s.id];
    await laad();
    meld('De standaardtekst staat er weer.');
  });
}
const schakelaar = (b, welke) => bezig(b, async () => {
  const s = soortNu();
  if (welke === 'uit'){ await roep('zetMailtekst', { soort: s.id, uit: !s.uit }); s.uit = !s.uit; meld(s.uit ? `"${s.naam}" wordt niet meer verstuurd` : `"${s.naam}" wordt weer verstuurd`); }
  else { await roep('zetMailtekst', { soort: s.id, eerstTonen: !s.eerstTonen }); s.eerstTonen = !s.eerstTonen; meld(s.eerstTonen ? 'Je ziet deze mail voortaan eerst' : 'Deze mail gaat voortaan meteen de deur uit'); }
  licht = null;
  teken();   /* het formulier opnieuw tekenen mag: een schakelaar is geen typen, en het concept blijft staan */
});
const bewaarAlgemeen = (b, waarden) => bezig(b, async () => {
  await roep('zetMailtekst', { algemeen: waarden });
  M.data.algemeen = { afzender: String(waarden.afzender).trim(), merkregel: String(waarden.merkregel).trim() }; M.algemeen = null;
  meld('Bewaard. Geldt voor elke mail.'); teken();
});

/* ==================== EERST LATEN ZIEN (bij goedkeuren en afwijzen van een aanmelding) ====================
   Geeft terug wat er met de mail moet gebeuren:
     { direct: true }       niets vragen (staat uit, of de functies zijn er nog niet): de server stuurt de vaste tekst
     { mail, reden? }       deze tekst sturen, alleen voor deze aanmelding
     { zonderMail: true }   wel beoordelen, geen mail
     null                   geannuleerd: niets doen                                                    */
let licht = null;   // soorten zonder het verzonden-overzicht, onthouden tot er iets wordt bewaard
export async function vraagMailBij(soortId, aanmelding){
  let s;
  try {
    if (!licht) licht = await roep('leesMailteksten', { licht: true });
    s = licht.soorten.find(x => x.id === soortId);
  } catch (x){ return { direct: true }; }
  if (!s || s.uit || !s.eerstTonen) return { direct: true };
  const bekend = { naam: aanmelding.contactNaam || '', club: aanmelding.clubNaam || '' };
  const t = voorAanmelding(s, bekend);
  const afwijzen = soortId === 'afwijzing';
  const rest = s.velden.filter(v => !(v.id in bekend));
  return new Promise(klaar => {
    const d = document.createElement('dialog');
    d.className = 'pm-dialoog';
    const veldHtml = (k, rijen) => `<div class="pm-veld"><label for="pmd-${k}">${VELDNAAM[k]}</label>${rijen
      ? `<textarea class="invoer" id="pmd-${k}" rows="${rijen}" maxlength="${licht.max?.[k] || ''}">${esc(t[k])}</textarea>`
      : `<input class="invoer" id="pmd-${k}" type="text" maxlength="${licht.max?.[k] || ''}" value="${esc(t[k])}">`}</div>`;
    d.innerHTML = `<form method="dialog" class="pm-dialoog-vorm">
      <div class="pm-dialoog-kop"><h2 class="tc-h2">${afwijzen ? 'Afwijzen' : 'Goedkeuren'}: mail aan ${esc(aanmelding.contactNaam || 'de aanvrager')}</h2>
        <p class="tc-meta">Naar ${esc(aanmelding.contactEmail || 'het adres van de aanmelding')}. Wat je hier wijzigt geldt alleen voor ${esc(aanmelding.clubNaam || 'deze club')}.</p></div>
      <div class="pm-dialoog-body">
        ${afwijzen ? `<div class="pm-veld"><label for="pmd-reden">Reden (mag leeg blijven)</label><textarea class="invoer" id="pmd-reden" rows="2" maxlength="300"></textarea></div>` : ''}
        ${veldHtml('onderwerp')}${veldHtml('titel')}${veldHtml('tekst', 8)}${s.heeftKnop ? veldHtml('knop') : ''}${veldHtml('slot', 3)}
        ${rest.length ? `<p class="tc-meta">${rest.map(v => `<code>{${v.id}}</code> vult Cluppie zelf in (${esc(v.naam.toLowerCase())}); is er niets, dan valt de regel weg.`).join(' ')}</p>` : ''}
        <p class="pc-signaal" id="pmdFout" role="alert" hidden></p>
      </div>
      <div class="pc-knoppen pm-dialoog-voet">
        <button type="button" class="knop fluo" data-uit="mail">${afwijzen ? 'Afwijzen en mail sturen' : 'Goedkeuren en mail sturen'}</button>
        <button type="button" class="knop licht" data-uit="zonder">${afwijzen ? 'Afwijzen zonder mail' : 'Goedkeuren zonder mail'}</button>
        <button type="button" class="knop licht" data-uit="stop">Annuleren</button>
      </div></form>`;
    const sluit = uitkomst => { d.close(); d.remove(); klaar(uitkomst); };
    d.addEventListener('cancel', e => { e.preventDefault(); sluit(null); });
    d.addEventListener('click', e => {
      const k = e.target.closest('[data-uit]');
      if (!k) return;
      if (k.dataset.uit === 'stop') return sluit(null);
      const reden = d.querySelector('#pmd-reden')?.value.trim() || '';
      if (k.dataset.uit === 'zonder') return sluit({ zonderMail: true, reden });
      const mail = { voet: s.tekst.voet };
      for (const veldId of ['onderwerp', 'titel', 'tekst', 'knop', 'slot']){ const el = d.querySelector(`#pmd-${veldId}`); mail[veldId] = el ? el.value : ''; }
      const fout = controleer(s, mail, licht.max), f = d.querySelector('#pmdFout');
      if (fout){ f.hidden = false; f.innerHTML = `<b>Let op:</b> ${esc(fout)}`; return; }
      sluit({ mail, reden });
    });
    document.body.appendChild(d);
    d.showModal();
  });
}
