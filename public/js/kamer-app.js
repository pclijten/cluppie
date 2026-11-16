/* ==================== TEAMKAMER — de pagina van ouders en spelers (kamer.html) [20261116n] ====================
   Bewust los van de trainersapp: deze pagina laadt geen teams.js of state.js en leest niets onder
   teams/**. Alles wat hier staat komt uit de kopie teamkamer/{teamId} (zie firestore.rules en
   functions/teamkamer.js).
   - Ouder: eigen account met bevestigd e-mailadres, binnen via de teamlink (?k=CODE) en goedkeuring
     van de trainer.
   - Speler: geen e-mail en geen wachtwoord; een code van de eigen ouder (anoniem account).
   - Geen chat, geen vrije tekst, geen foto's. Afmelden gaat via WhatsApp: de knop zet alleen het
     bericht klaar, Cluppie verstuurt en bewaart niets. */
import { auth, db, functions, httpsCallable, signInAnonymously, signOut, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, collection, doc, getDoc, getDocs, setDoc, onSnapshot } from './firebase.js?v=20261011g';
import * as K from './kamer-logica.js?v=20261116q';

const wortel = document.getElementById('tk');
const qs = new URLSearchParams(location.search);
const roep = (naam, data) => httpsCallable(functions, naam)(data || {}).then(r => r.data);
const bewaar = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* geen opslag */ } } };

const A = { scherm: 'laden', fout: '', bezig: false, user: null, link: null, lid: null, teamId: '', teams: [], kind: '',
  kamer: null, agenda: [], polls: [], berichten: [], gezin: {}, stats: {}, stemmen: {}, stemGeteld: {}, stemWacht: {}, gelezen: 0, weer: {}, tab: qs.get('poll') ? 'polls' : 'vandaag',
  open: '', blad: null, code: null, thuisOpen: false, subs: [] };
let naarPoll = qs.get('poll') || '';                   /* [20261116p] link uit WhatsApp: één keer naar die poll schuiven */
const TABNAAM = { vandaag: 'Vandaag', agenda: 'Agenda', polls: 'Polls', kind: 'Mijn kind' };
if (qs.get('k')) bewaar.set('tkCode', K.schoonCode(qs.get('k'), 12));

const ICO = {
  huis: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"></path>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  poll: '<path d="M5 20V10M12 20V4M19 20v-7"></path>',
  mens: '<circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 4-6 8-6s8 2 8 6"></path>',
  slot: '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  plek: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"></path><circle cx="12" cy="10" r="2.5"></circle>',
};
const ico = (n, klein) => `<svg class="tk-ico${klein ? ' klein' : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
const e = K.esc;
const foutTekst = (x) => (x && x.message ? String(x.message).replace(/^Firebase:\s*/, '') : 'Er ging iets mis. Probeer het opnieuw.');
const AUTH_FOUT = { 'auth/invalid-credential': 'E-mailadres of wachtwoord klopt niet.', 'auth/wrong-password': 'E-mailadres of wachtwoord klopt niet.',
  'auth/user-not-found': 'E-mailadres of wachtwoord klopt niet.', 'auth/weak-password': 'Kies een wachtwoord van minstens 6 tekens.',
  'auth/invalid-email': 'Dit e-mailadres klopt niet.', 'auth/too-many-requests': 'Te veel pogingen. Probeer het later opnieuw.',
  'auth/network-request-failed': 'Geen verbinding. Probeer het opnieuw.' };

function toast(tekst){
  document.querySelectorAll('.tk-toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'tk-toast'; t.setAttribute('role', 'status'); t.textContent = tekst;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}
function zet(o){ Object.assign(A, o); teken(); }
function stopSubs(){ A.subs.forEach(u => { try { u(); } catch { /* al gestopt */ } }); A.subs = []; }

/* ==================== inloggen en binnenkomen ==================== */
const merkregel = (naam, sub) => `<div class="tk-merkregel"><img class="tk-merk" src="icons/icon.svg" alt="" width="40" height="40"><span><b>${e(naam)}</b><small>${e(sub)}</small></span></div>`;
const merk = `<div class="tk-kop">${merkregel('Cluppie', 'Teamkamer voor ouders en spelers')}</div>`;
const smal = (html) => `<div class="tk-smal">${html}</div>`;
const foutHtml = () => (A.fout ? `<p class="tk-fout" role="alert">${e(A.fout)}</p>` : '');
const privacyLink = '<a href="privacy.html#teamkamer" target="_blank" rel="noopener">privacy-uitleg voor ouders</a>';

function htmlStart(){
  return `${merk}<div class="tk-inhoud">
    <section class="tk-kaart"><h1 class="tk-h2">Ik ben ouder of verzorger</h1>
      <form data-form="login" class="tk-kaart kaal">
        <div class="tk-veld"><label for="f-mail">E-mailadres</label><input class="tk-invoer" id="f-mail" name="mail" type="email" autocomplete="email" required></div>
        <div class="tk-veld"><label for="f-ww">Wachtwoord</label><input class="tk-invoer" id="f-ww" name="ww" type="password" autocomplete="current-password" required></div>
        ${foutHtml()}
        <button class="tk-knop" ${A.bezig ? 'disabled' : ''}>Inloggen</button>
        <button type="button" class="tk-knop tekst" data-doe="reset">Wachtwoord vergeten</button>
      </form>
      <p class="tk-klein tk-zacht" style="margin:0">Nog geen toegang? De trainer deelt een teamlink in de groepsapp. Open die link om je aan te melden.</p>
    </section>
    <section class="tk-kaart"><h2 class="tk-h2">Ik ben speler</h2>
      <form data-form="kindcode" class="tk-kaart kaal">
        <div class="tk-veld"><label for="f-code">Code van je ouder (6 tekens)</label><input class="tk-invoer tk-code" id="f-code" name="code" inputmode="text" autocapitalize="characters" autocomplete="off" maxlength="7" placeholder="ABC 234" required></div>
        <button class="tk-knop" ${A.bezig ? 'disabled' : ''}>Ga naar mijn team</button>
      </form>
      <p class="tk-klein tk-zacht" style="margin:0">Je hebt geen e-mailadres of wachtwoord nodig. Je ouder maakt de code in de teamkamer en kan je toegang altijd stoppen.</p>
    </section>
  </div>`;
}
function htmlUitnodiging(){
  const l = A.link || {};
  if (l.geldig === false) return `${merk}<div class="tk-inhoud"><section class="tk-kaart"><h1 class="tk-h2">Deze link werkt niet meer</h1>
    <p class="tk-zacht" style="margin:0">Vraag de trainer om een nieuwe teamlink.</p><button class="tk-knop licht" data-doe="vergeetlink">Verder zonder link</button></section></div>`;
  return `${merk}<div class="tk-inhoud">
    <div><h1 class="tk-h1">Je bent uitgenodigd</h1><p class="tk-zacht" style="margin:6px 0 0">Voor de teamkamer van ${e(l.teamNaam || 'het team')}${l.clubNaam ? ', ' + e(l.clubNaam) : ''}. Je ziet de agenda, wie erbij is, mededelingen en polls.</p></div>
    ${A.teams.length ? '<button class="tk-knop licht" data-doe="vergeetlink">Ik heb al toegang: naar mijn teamkamer</button>' : ''}
    ${stappen(1)}
    <form data-form="aanmelden" class="tk-kaart">
      ${A.user ? `<p class="tk-zacht" style="margin:0">Ingelogd als ${e(A.user.email || '')}.</p>` : `
      <div class="tk-veld"><label for="f-mail">E-mailadres</label><input class="tk-invoer" id="f-mail" name="mail" type="email" autocomplete="email" required></div>
      <div class="tk-veld"><label for="f-ww">Kies een wachtwoord</label>
        <div class="tk-met-knop"><input class="tk-invoer" id="f-ww" name="ww" type="password" autocomplete="new-password" minlength="6" required><button type="button" class="tk-knop licht klein" data-doe="toonww" aria-controls="f-ww">Toon</button></div>
        <span class="tk-klein tk-zacht">Minstens 6 tekens. Heb je al een Cluppie-account? Gebruik dan dat wachtwoord.</span></div>`}
      <div class="tk-veld"><label for="f-kind">Ik ben ouder of verzorger van</label><input class="tk-invoer" id="f-kind" name="kind" type="text" maxlength="40" placeholder="Voornaam van je kind" required>
        <span class="tk-klein tk-zacht">De trainer koppelt je aan de juiste speler. Je kiest niet uit een lijst met namen.</span></div>
      <label class="tk-vink"><input type="checkbox" name="ok" required><span>Ik heb de ${privacyLink} gelezen</span></label>
      ${foutHtml()}
      <button class="tk-knop" ${A.bezig ? 'disabled' : ''}>${A.bezig ? 'Even geduld…' : 'Vraag toegang aan'}</button>
      ${A.user ? '' : '<button type="button" class="tk-knop tekst" data-doe="reset">Wachtwoord vergeten</button>'}
    </form>
    <div class="tk-melding">${ico('slot', true)}<span>Tot de trainer je goedkeurt, zie je niets van het team.</span></div>
  </div>`;
}
/* [20261116p] waar je bent in het aanmelden: 1 account, 2 e-mailadres bevestigen, 3 de trainer keurt goed */
const STAPPEN = ['Account', 'E-mail bevestigen', 'Trainer keurt goed'];
const stappen = (nu) => `<ol class="tk-stappen" aria-label="Stap ${nu} van 3">${STAPPEN.map((s, n) => `<li class="${n + 1 < nu ? 'klaar' : n + 1 === nu ? 'nu' : ''}"${n + 1 === nu ? ' aria-current="step"' : ''}><b>${n + 1}</b><span>${s}</span></li>`).join('')}</ol>`;
function htmlBevestig(){
  return `${merk}<div class="tk-inhoud">${bewaar.get('tkCode') ? stappen(2) : ''}<section class="tk-kaart"><h1 class="tk-h2">Bevestig je e-mailadres</h1>
    <p style="margin:0">We hebben een mail gestuurd naar:</p>
    <p class="tk-vet tk-adres" style="margin:0">${e(A.user?.email || 'je e-mailadres')}</p>
    <p style="margin:0">Klik op de knop in die mail. Deze pagina gaat daarna vanzelf verder; je hoeft hem niet te sluiten.</p>
    <p class="tk-klein tk-zacht" style="margin:0">Geen mail? Kijk bij ongewenste mail, of stuur hem opnieuw.</p>
    ${foutHtml()}
    <button class="tk-knop" data-doe="bevestigd" ${A.bezig ? 'disabled' : ''}>Ik heb bevestigd</button>
    <button class="tk-knop licht" data-doe="mailopnieuw">Stuur de mail opnieuw</button>
    <button class="tk-knop tekst" data-doe="uitloggen">Uitloggen</button></section></div>`;
}
function htmlWacht(){
  return `${merk}<div class="tk-inhoud">${stappen(3)}<div><h1 class="tk-h1">Wacht op de trainer</h1>
    <p class="tk-zacht" style="margin:6px 0 0">Je aanvraag is verstuurd. De trainer ziet je e-mailadres en de naam die je invulde.</p></div>
    <section class="tk-kaart">
      <div><b class="tk-ok">Aanvraag verstuurd</b></div>
      <div><b>De trainer keurt goed</b><div class="tk-klein tk-zacht">En koppelt je aan je kind</div></div>
      <div><b>Je krijgt een e-mail</b><div class="tk-klein tk-zacht">Zonder namen van spelers erin. Deze pagina gaat dan vanzelf open.</div></div>
    </section>
    <p class="tk-zacht" style="margin:0">Je ziet nu nog niets van het team: geen namen, geen agenda.</p>
    <button class="tk-knop licht" data-doe="uitloggen">Uitloggen</button></div>`;
}
function htmlGeen(){
  return `${merk}<div class="tk-inhoud"><section class="tk-kaart"><h1 class="tk-h2">Je hebt nog geen toegang</h1>
    <p style="margin:0">${A.dicht ? 'De teamkamer van dit team staat uit, of je toegang is gestopt.' : 'Vraag de trainer om de teamlink en open die op dit toestel.'}</p>
    ${A.user && !A.user.isAnonymous ? '<a class="tk-knop licht" href="index.html?app=1">Naar de trainersapp</a>' : ''}
    <button class="tk-knop tekst" data-doe="uitloggen">Uitloggen</button></section></div>`;
}

/* ==================== de teamkamer ==================== */
const rol = () => (A.lid && A.lid.rol) || 'speler';
const mag = (k) => !!(A.kamer && A.kamer.mag && A.kamer.mag[k] === true);            /* wat de eindbaas heeft aangezet */
const isOuder = () => rol() === 'ouder';
const kindId = () => (A.lid && (A.lid.spelerIds || []).includes(A.kind) ? A.kind : (A.lid?.spelerIds || [])[0]) || '';
const kindNaam = () => (A.gezin[kindId()] && A.gezin[kindId()].voornaam) || K.spelerNaam(A.kamer?.spelers, kindId());
const spelers = () => (A.kamer && A.kamer.spelers) || {};
const pollsVan = (wedstrijdId) => A.polls.filter(p => p.wedstrijdId === wedstrijdId);
const zichtbarePolls = () => (mag('polls') ? K.sorteerPolls(A.polls) : []);
/* [20261116p] de poll zoals hij eruitziet met de eigen stem er al in (de server telt een paar tellen later) */
const metEigen = (p) => K.pollMetEigen(p, kindId(), A.stemGeteld[p.id], A.stemmen[p.id]);
const nieuweBerichten = () => (mag('berichten') ? K.nieuweBerichten(A.berichten, A.gelezen) : []);
const nogStemmen = () => K.nogStemmen(zichtbarePolls(), A.stemmen, rol());

/* [20261116q] eigen kind: erbij, afwezig, of niet geselecteerd voor deze wedstrijd (dat laatste ziet alleen het eigen gezin) */
const status = (i) => K.eigenStatus(i, kindId(), (A.gezin[kindId()] || {}).nietMee);
const statusHtml = (i) => `<span class="tk-vet ${status(i) === 'Erbij' ? 'tk-ok' : 'tk-let'}">${status(i)}</span>`;
/* [20261116q] wat er getraind wordt: thema en oefeningen, alleen kijken. Een oefening uit de bibliotheek opent in 3D. */
function htmlTrainingInhoud(i){
  const t = i.training; if (!t || !A.kamer?.trainingen || !mag('trainingen')) return '';
  return `<div class="tk-lijn" style="display:flex;flex-direction:column;gap:8px">
    ${t.thema || t.titel ? `<div class="tk-rij"><span class="tk-zacht">${t.thema ? 'Thema' : 'Training'}</span><span class="tk-vet">${e(t.thema || t.titel)}</span></div>` : ''}
    ${t.vormen.length ? `<div class="tk-label">Wat gaan ze doen</div>${t.vormen.map((v, n) => `<${v.vormId ? `button class="tk-oef" data-doe="oef3d" data-id="${e(i.id)}" data-n="${n}"` : 'div class="tk-oef"'}>
      <span class="tk-item-tekst"><span class="tk-klein tk-zacht" style="display:block">${e(v.slot || 'Oefening ' + (n + 1))}</span><span class="tk-vet">${e(v.naam)}</span></span>
      <span class="tk-klein tk-zacht">${v.min ? v.min + ' min' : ''}${v.vormId ? (v.min ? ', ' : '') + '3D' : ''}</span></${v.vormId ? 'button' : 'div'}>`).join('')}` : ''}
    <div class="tk-klein tk-zacht">Alleen kijken. De aantekeningen van de trainer staan er niet bij, en de trainer kan de training nog aanpassen.</div></div>`;
}
/* [20261116p] opstelling op een veld; zonder plekken (oude kopie) de namen als tekst */
function htmlOpstelling(op){
  if (!op) return '';
  const sp = spelers(), plekken = K.veldPlekken(op), eigen = kindId();
  const wissels = (op.wissels || []).length ? `<div class="tk-rij" style="align-items:flex-start"><span class="tk-zacht" style="white-space:nowrap">Begint als wissel</span><span>${e(K.namenLijst(sp, op.wissels))}</span></div>` : '';
  if (!plekken.length) return `<div class="tk-rij" style="align-items:flex-start"><span class="tk-zacht">Start</span><span>${e(K.namenLijst(sp, op.basis))}</span></div>${wissels}`;
  const tekst = plekken.map(x => K.spelerNaam(sp, x.spelerId)).join(', ');
  return `<div class="tk-opstelling"><div class="tk-rij"><span class="tk-label">Opstelling bij de aftrap</span>${op.formatie ? `<span class="tk-klein tk-zacht">${e(op.formatie)}</span>` : ''}</div>
    <div class="tk-gras" role="img" aria-label="Opstelling: ${e(tekst)}">${plekken.map(x => { const s = sp[x.spelerId] || {};
      return `<span class="tk-pos${x.spelerId === eigen ? ' eigen' : ''}" style="left:${x.x}%;top:${x.y}%"><b>${s.nr != null ? e(s.nr) : ''}</b><span>${e(x.spelerId === eigen ? kindNaam() : K.spelerNaam(sp, x.spelerId))}</span></span>`; }).join('')}</div>
    ${wissels}<div class="tk-klein tk-zacht">De trainer kan de opstelling nog wijzigen.</div></div>`;
}

function htmlWedstrijdKaart(i){
  const d = K.hoofdletter(K.datumLang(i.datum)), polls = mag('polls') ? pollsVan(i.id.replace(/^w_/, '')) : [];
  const tijden = [['Verzamelen', i.verzamel], ['Vertrek', i.vertrek], ['Aftrap', i.tijd]].filter(t => t[1]);
  const adres = [i.adres, i.plaats].filter(Boolean).join(', ');
  const weer = A.weer[i.id];
  return `<section class="tk-kaart">
    <div class="tk-rij"><span class="tk-label accent">${e(d)}</span><span class="tk-klein tk-zacht">${i.thuis ? 'Wedstrijd, thuis' : 'Wedstrijd, uit'}</span></div>
    <h2 class="tk-h2 ${i.afgelast ? 'tk-afgelast' : ''}">${e(i.thuis ? 'Thuis tegen ' : 'Uit bij ')}${e(i.tegenstander || 'tegenstander nog onbekend')}</h2>
    ${i.afgelast ? '<p class="tk-let tk-vet" style="margin:0">Deze wedstrijd is afgelast.</p>' : ''}
    ${i.stand ? `<div class="tk-stand" aria-label="Stand">${i.stand.voor} – ${i.stand.tegen}</div><div class="tk-klein tk-zacht" style="text-align:center">${i.stand.bezig ? 'De wedstrijd is bezig' : 'Stand'}</div>` : ''}
    ${tijden.length ? `<div class="tk-tijden">${tijden.map(t => `<div class="tk-tijd"><span>${t[0]}</span><b>${e(t[1])}</b></div>`).join('')}</div>` : ''}
    ${i.plek ? `<div class="tk-rij" style="justify-content:flex-start">${ico('plek', true)}<div style="flex:1;min-width:0;text-align:left"><div class="tk-vet">${e([i.plek, i.veld].filter(Boolean).join(', '))}</div>${adres ? `<div class="tk-klein tk-zacht">${e(adres)}</div>` : ''}</div>
      ${i.route ? `<a class="tk-knop licht klein" href="${e(i.route)}" target="_blank" rel="noopener">Route</a>` : ''}</div>` : ''}
    <div class="tk-lijn" style="display:flex;flex-direction:column;gap:8px">
      ${polls.map(p => { const w = K.pollWeergave(metEigen(p), spelers(), A.stemmen[p.id]); const ja = w.opties[0];
        return `<div class="tk-rij"><span class="tk-zacht">${e(K.BEURT_NAMEN[p.soort] || 'Poll')}</span><span class="tk-vet">${e(w.nodig || (ja ? (ja.namen || `${ja.aantal} keer ${ja.tekst.toLowerCase()}`) : ''))}</span></div>`; }).join('')}
      ${weer ? `<div class="tk-rij"><span class="tk-zacht">Weer bij de club</span><span class="tk-vet">${e(weer)}</span></div>` : ''}
      <div class="tk-rij"><span class="tk-zacht">${e(isOuder() ? kindNaam() : 'Jij')}</span>${statusHtml(i)}</div>
    </div>
    ${i.opstelling && !i.afgelast ? htmlOpstelling(i.opstelling) : ''}
    ${isOuder() && mag('afmelden') && !i.afgelast ? `<button class="tk-knop licht" data-doe="afmelden" data-id="${e(i.id)}">Afmelden via WhatsApp</button>` : ''}
  </section>`;
}
function htmlTrainingKaart(i){
  return `<section class="tk-kaart">
    <div class="tk-rij"><span class="tk-label accent">${e(K.hoofdletter(K.datumLang(i.datum)))}</span><span class="tk-klein tk-zacht">Training</span></div>
    <h2 class="tk-h2 ${i.afgelast ? 'tk-afgelast' : ''}">Training${i.tijd ? ' om ' + e(i.tijd) : ''}</h2>
    ${i.afgelast ? '<p class="tk-let tk-vet" style="margin:0">Deze training is afgelast.</p>' : `<div class="tk-rij"><span class="tk-zacht">${e(isOuder() ? kindNaam() : 'Jij')}</span>${statusHtml(i)}</div>${htmlTrainingInhoud(i)}`}
    ${isOuder() && mag('afmelden') && !i.afgelast ? `<button class="tk-knop licht" data-doe="afmelden" data-id="${e(i.id)}">Afmelden via WhatsApp</button>` : ''}
  </section>`;
}
function htmlVandaag(){
  const vandaag = K.vandaagIso(), kom = K.komend(A.agenda, vandaag), eerst = kom[0];
  const open = zichtbarePolls().filter(p => p.status === 'open');
  const nieuw = nieuweBerichten(), stem = nogStemmen();
  const eerder = mag('berichten') ? A.berichten.filter(b => !nieuw.includes(b)).slice(0, 2) : [];
  const meta = (b) => e([b.door && 'Trainer ' + b.door, b.datum && K.datumLang(b.datum)].filter(Boolean).join(', '));
  /* [20261116p] wat nieuw is of nog iets van je vraagt staat bovenaan, vóór de agenda */
  const boven = `${nieuw.length ? `<section class="tk-kaart nieuw" aria-live="polite"><div class="tk-rij"><h2 class="tk-label accent">${nieuw.length === 1 ? 'Nieuw van de trainer' : nieuw.length + ' nieuwe mededelingen'}</h2><span class="tk-stip" aria-hidden="true"></span></div>
      ${nieuw.slice(0, 3).map(b => `<div class="tk-nieuw-bericht"><p style="margin:0;white-space:pre-line">${e(b.tekst)}</p><div class="tk-klein tk-zacht">${meta(b)}</div></div>`).join('')}
      <button class="tk-knop licht klein" data-doe="gelezen">Gelezen</button></section>` : ''}
    ${stem.length ? `<section class="tk-kaart nieuw" style="gap:4px"><h2 class="tk-label accent">${stem.length === 1 ? 'Je stem is nodig' : 'Je stem is nodig bij ' + stem.length + ' polls'}</h2>
      ${stem.map(p => `<button class="tk-item-kop" style="padding:4px 0;min-height:52px" data-doe="naarpoll" data-id="${e(p.id)}"><span class="tk-item-tekst tk-vet">${e(p.vraag)}</span><span class="tk-klein tk-let">Stem nu</span></button>`).join('')}</section>` : ''}`;
  const wedstrijdSnel = kom.find(i => i.soort === 'wedstrijd' && K.binnenDagen(i.datum, vandaag, 2));
  const wedstrijdWeek = kom.find(i => i.soort === 'wedstrijd' && K.binnenDagen(i.datum, vandaag, 7));
  const videos = (A.kamer?.thuisVideos || []).filter(v => v && (v.yt || v.url));
  /* [20261116q] daarna: de volgende training en de volgende wedstrijd, voor zover ze hierboven niet al staan */
  const rest = kom.filter(i => i !== eerst && i !== wedstrijdWeek);
  const daarna = [rest.find(i => i.soort === 'training'), rest.find(i => i.soort === 'wedstrijd')].filter(Boolean).sort((a, b) => a.datum.localeCompare(b.datum));
  return `<div class="tk-kolom">${boven}${eerst ? (eerst.soort === 'wedstrijd' ? htmlWedstrijdKaart(eerst) : htmlTrainingKaart(eerst)) : '<section class="tk-kaart"><p class="tk-zacht" style="margin:0">Er staat nog niets in de agenda.</p></section>'}
    ${wedstrijdWeek && wedstrijdWeek !== eerst ? htmlWedstrijdKaart(wedstrijdWeek) : ''}
    ${daarna.length ? `<h2 class="tk-label">Daarna</h2>${daarna.map(htmlItem).join('')}` : ''}
    ${kom.length && mag('agenda') ? '<button class="tk-knop licht" data-doe="ics">Zet alles in mijn agenda</button>' : ''}</div>
    <div class="tk-kolom">${open.filter(p => !stem.includes(p)).length ? `<section class="tk-kaart" style="gap:4px"><h2 class="tk-label">Open polls</h2>
      ${open.filter(p => !stem.includes(p)).map(p => `<button class="tk-item-kop" style="padding:4px 0;min-height:52px" data-doe="naarpoll" data-id="${e(p.id)}"><span class="tk-item-tekst">${e(p.vraag)}</span>
        <span class="tk-klein ${(A.stemmen[p.id] || []).length ? 'tk-ok' : 'tk-let'}">${(A.stemmen[p.id] || []).length ? 'Gestemd' : (K.magStemmen(p, rol()) ? 'Nog stemmen' : 'Voor ouders')}</span></button>`).join('')}</section>` : ''}
    ${eerder.length ? `<section class="tk-kaart"><h2 class="tk-label">${eerder.length === 1 ? 'Mededeling' : 'Mededelingen'}</h2>
      ${eerder.map(b => `<div class="tk-nieuw-bericht"><p style="margin:0;white-space:pre-line">${e(b.tekst)}</p><div class="tk-klein tk-zacht">${meta(b)}</div></div>`).join('')}</section>` : ''}
    ${A.kamer?.thuis || videos.length ? `<section class="tk-kaart"><h2 class="tk-label">Thuis oefenen</h2>
      ${A.kamer?.thuis ? `<div class="tk-vet">${e(A.kamer.thuis.naam || 'Oefening van de week')}</div>
      <div id="tk-thuis" class="tk-3d" ${A.thuisOpen ? '' : 'hidden'}></div>
      ${A.thuisOpen ? '' : '<button class="tk-knop licht" data-doe="thuis">Bekijk de oefening in 3D</button>'}` : ''}
      ${videos.map((v, n) => `<button class="tk-video-rij tk-video-speel" data-doe="video" data-n="${n}"><span class="tk-video-beeld">${v.yt ? `<img src="${e(K.ytThumb(v.yt))}" alt="" loading="lazy">` : ''}</span>
        <span class="tk-item-tekst tk-vet">${e(v.titel || 'Video')}</span><span class="tk-klein tk-zacht">Bekijk</span></button>`).join('')}</section>` : ''}
    ${wedstrijdSnel && (A.kamer?.lijn || []).length ? `<section class="tk-kaart" style="gap:6px"><h2 class="tk-label">Zo moedigen wij aan</h2>${A.kamer.lijn.map(r => `<div>${e(r)}</div>`).join('')}</section>` : ''}
    ${rol() === 'speler' ? `<div class="tk-melding">${ico('slot', true)}<span>Je ouder beheert je toegang. Chatten kan hier niet.</span></div>` : ''}</div>`;
}
function htmlItem(i){
  const d = K.datumDelen(i.datum), isOpen = A.open === i.id, af = i.afwezig || [];
  const op = i.opstelling;
  return `<section class="tk-item"><button class="tk-item-kop" data-doe="open" data-id="${e(i.id)}" aria-expanded="${isOpen}">
      <span class="tk-datum"><span>${d.dag}</span><b>${d.nr}</b><span>${d.maand}</span></span>
      <span class="tk-item-tekst"><span class="tk-vet ${i.afgelast ? 'tk-afgelast' : ''}" style="display:block">${e(K.itemTitel(i))}</span><span class="tk-klein ${i.afgelast ? 'tk-let' : 'tk-zacht'}">${e(K.itemSub(i))}</span></span>
      <span class="tk-klein tk-vet">${i.stand ? `${i.stand.voor} – ${i.stand.tegen}` : e(K.itemTelling(i, A.kamer?.aantal))}</span></button>
    ${isOpen ? `<div class="tk-item-meer">
      <div class="tk-rij"><span class="tk-zacht">${e(isOuder() ? kindNaam() : 'Jij')}</span>${statusHtml(i)}</div>
      ${i.soort === 'training' && !i.afgelast ? htmlTrainingInhoud(i) : ''}
      <div class="tk-rij"><span class="tk-zacht">Afwezig</span><span class="tk-vet ${af.length ? 'tk-let' : ''}">${af.length ? e(K.namenLijst(spelers(), af)) : 'Niemand'}</span></div>
      ${op ? htmlOpstelling(op) : ''}
      ${i.plek ? `<div class="tk-klein tk-zacht">${e([i.plek, i.veld].filter(Boolean).join(', '))}</div>` : ''}
      ${isOuder() && mag('afmelden') && !i.afgelast && i.datum >= K.vandaagIso() ? `<button class="tk-knop licht klein" data-doe="afmelden" data-id="${e(i.id)}">Afmelden via WhatsApp</button>` : ''}
    </div>` : ''}</section>`;
}
function htmlAgenda(){
  const vandaag = K.vandaagIso(), kom = K.komend(A.agenda, vandaag), oud = K.geweest(A.agenda, vandaag);
  return `<div class="tk-melding">${ico('slot', true)}<span>Alleen lezen. Afmelden doe je in de groepsapp; de trainer verwerkt het hier.</span></div>
    ${kom.map(htmlItem).join('') || '<section class="tk-kaart"><p class="tk-zacht" style="margin:0">Er staat nog niets in de agenda.</p></section>'}
    ${oud.length ? `<h2 class="tk-label" style="margin-top:8px">Geweest</h2>${oud.slice(0, 6).map(htmlItem).join('')}` : ''}`;
}
function htmlPoll(p){
  const w = K.pollWeergave(metEigen(p), spelers(), A.stemmen[p.id], A.kamer?.aantal), mag = K.magStemmen(p, rol());
  if (!w.open){
    const top = K.BEURT_SOORTEN.includes(p.soort) ? w.opties[0] : [...w.opties].sort((a, b) => b.aantal - a.aantal)[0];   /* bij een beurt telt wie "ja" zei */
    return `<section class="tk-kaart" style="gap:4px"><div class="tk-vet">${e(p.vraag)}</div><div class="tk-klein tk-zacht">Gesloten. ${top ? e(top.tekst) + ': ' + (top.namen ? e(top.namen) : top.aantal) : ''}</div></section>`;
  }
  return `<section class="tk-kaart" style="gap:12px" id="poll-${e(p.id)}">
    <div class="tk-rij"><span class="tk-label ${p.wedstrijdId ? 'accent' : ''}">${p.wedstrijdId && p.wedstrijdDatum ? 'Wedstrijd ' + e(K.datumKort(p.wedstrijdDatum)) : 'Losse poll'}${p.meer ? ', meer antwoorden mogelijk' : ''}</span>${w.nodig ? `<span class="tk-klein tk-vet">${e(w.nodig)}</span>` : ''}</div>
    <h2 class="tk-h3">${e(p.vraag)}</h2>
    ${w.opties.map(o => `<button class="tk-optie" data-doe="stem" data-poll="${e(p.id)}" data-optie="${e(o.id)}" aria-pressed="${o.gekozen}" ${mag ? '' : 'disabled'}>
      <span class="tk-optie-kop"><span>${e(o.tekst)}</span>${o.gekozen ? '<span class="tk-jouw">Jouw stem</span>' : ''}<b>${o.aantal}</b></span>
      <span class="tk-balk"><i style="width:${o.pct}%"></i></span>${o.namen ? `<span class="tk-klein tk-zacht">${e(o.namen)}</span>` : ''}</button>`).join('')}
    <div class="tk-klein tk-zacht">${mag ? 'Eén stem per gezin.' : 'Deze poll is voor ouders.'} ${p.namen ? '' : 'Alleen aantallen zichtbaar; de trainer ziet wie wat koos.'} ${p.sluitDatum ? 'Sluit ' + e(K.datumLang(p.sluitDatum)) + '.' : ''}</div>
  </section>`;
}
function htmlPolls(){
  const ps = zichtbarePolls();
  return ps.map(htmlPoll).join('') || '<section class="tk-kaart"><p class="tk-zacht" style="margin:0">Er zijn nog geen polls.</p></section>';
}
function htmlKind(){
  const id = kindId(), p = spelers()[id] || {}, g = A.gezin[id] || {}, tot = A.lid?.vervaltOp?.toDate ? A.lid.vervaltOp.toDate() : null;
  const meer = (A.lid?.spelerIds || []).length > 1;
  const zichtbaar = !p.v, gem = A.kamer?.beurtenGem || {};
  const beurten = mag('beurten') ? K.BEURT_SOORTEN.filter(s => (g.beurten && g.beurten[s]) || gem[s]) : [];
  if (!isOuder()) return `<section class="tk-kaart" style="flex-direction:row;align-items:center;gap:14px"><div class="tk-nr">${g.nr ?? ''}</div><div><div class="tk-h2">${e(kindNaam())}</div><div class="tk-klein tk-zacht">${e(A.kamer?.teamNaam || '')}</div></div></section>
    <div class="tk-melding">${ico('slot', true)}<span>Je ouder beheert je toegang. Chatten en foto's delen kan hier niet. Afmelden doet je ouder in de groepsapp.</span></div>
    <button class="tk-knop licht" data-doe="uitloggen">Uitloggen op dit toestel</button>`;
  return `${meer ? `<div class="tk-seg">${A.lid.spelerIds.map(s => `<button data-doe="kind" data-id="${e(s)}" aria-pressed="${s === id}">${e((A.gezin[s] && A.gezin[s].voornaam) || 'Kind')}</button>`).join('')}</div>` : ''}
    <section class="tk-kaart" style="flex-direction:row;align-items:center;gap:14px"><div class="tk-nr">${g.nr ?? ''}</div><div><div class="tk-h2">${e(kindNaam())}</div>
      <div class="tk-klein tk-zacht">${e(A.kamer?.teamNaam || '')}${tot ? ', toegang tot ' + e(K.datumLang(K.vandaagIso(tot))) : ''}</div></div></section>
    ${mag('spelers') ? `<section class="tk-kaart"><h2 class="tk-label">Toegang voor ${e(kindNaam())} zelf</h2>
      ${A.code ? `<div class="tk-bericht" style="text-align:center"><div class="tk-code" style="min-height:0">${e(K.toonCode(A.code))}</div><div class="tk-klein tk-zacht">15 minuten geldig, één keer te gebruiken. ${e(kindNaam())} vult hem in op www.cluppie.io/kamer.html.</div></div>
        <div class="tk-twee"><a class="tk-knop" href="${e(K.waUrl(K.kindCodeTekst(kindNaam(), A.code)))}" target="_blank" rel="noopener">Stuur via WhatsApp</a><button class="tk-knop licht" data-doe="kopieercode">Kopieer de code</button></div>
        <p class="tk-klein tk-zacht" style="margin:0">Stuur de code alleen naar ${e(kindNaam())} zelf, niet naar een groep.</p>`
        : `<button class="tk-knop" data-doe="kindcode" ${A.bezig ? 'disabled' : ''}>Maak een code voor ${e(kindNaam())}</button>`}
      <p class="tk-klein tk-zacht" style="margin:0">${e(kindNaam())} heeft geen e-mailadres of wachtwoord nodig en ziet hetzelfde als jij, zonder dit scherm.</p>
      <button class="tk-knop licht klein" data-doe="stopkind">Stop de toegang van ${e(kindNaam())}</button>
    </section>` : ''}
    ${A.kamer?.namen ? `<section class="tk-kaart" style="flex-direction:row;align-items:center"><div style="flex:1"><div class="tk-vet" id="lbl-naam">Toon de voornaam van ${e(kindNaam())}</div>
      <div class="tk-klein tk-zacht">${zichtbaar ? `Andere gezinnen zien: ${e(kindNaam())}${g.nr != null ? ', nummer ' + g.nr : ''}.` : 'Andere gezinnen zien: Speler.'}</div></div>
      <button class="tk-sw" role="switch" aria-checked="${zichtbaar}" aria-labelledby="lbl-naam" data-doe="verberg"></button></section>` : ''}
    ${(() => { const st = A.stats[id], tegels = K.statsTegels(st); if (!mag('stats') || !tegels.length) return '';
      const laatste = (st.speeltijd && st.speeltijd.laatste) || [];
      return `<section class="tk-kaart"><div class="tk-rij"><h2 class="tk-label">Dit seizoen in cijfers</h2>${st.tm ? `<span class="tk-klein tk-zacht">tot en met ${e(K.datumKort(st.tm))}</span>` : ''}</div>
        <div class="tk-tijden">${tegels.map(t => `<div class="tk-tijd"><b>${e(t[0])}</b><span>${e(t[1])}</span></div>`).join('')}</div>
        ${laatste.length ? `<div class="tk-lijn" style="display:flex;flex-direction:column;gap:6px"><div class="tk-label">Laatste wedstrijden</div>${laatste.map(x => `<div class="tk-rij"><span>${e(K.hoofdletter(K.datumKort(x.datum)))}</span><span class="tk-klein tk-zacht">${x.min} van ${x.van} min</span></div>`).join('')}</div>` : ''}
        <div class="tk-klein tk-zacht">Alleen de cijfers van ${e(kindNaam())}, zoals de trainer ze bijhoudt. Cijfers van teamgenoten staan hier niet. ${e(kindNaam())} zelf ziet dit niet.</div></section>`; })()}
    ${beurten.length ? `<section class="tk-kaart"><h2 class="tk-label">Beurten dit seizoen</h2>${beurten.map(s => `<div class="tk-rij"><span>${K.BEURT_NAMEN[s]}</span><span><b>${(g.beurten && g.beurten[s]) || 0}</b> <span class="tk-klein tk-zacht">gemiddeld in het team ${gem[s] ?? 0}</span></span></div>`).join('')}</section>` : ''}
    <section class="tk-kaart" style="gap:8px"><h2 class="tk-label">Dit staat niet in de teamkamer</h2><div>Beoordelingen en leerpunten</div><div>Cijfers van andere kinderen</div><div>De reden van een afmelding</div><div>Achternamen en geboortedata</div><div>E-mail of telefoon van andere ouders</div>
      <a href="privacy.html#teamkamer" target="_blank" rel="noopener" class="tk-vet" style="min-height:44px;display:inline-flex;align-items:center">Privacy in gewone taal</a></section>
    <button class="tk-knop licht" data-doe="verlaat">Teamkamer verlaten</button>
    <button class="tk-knop tekst" data-doe="uitloggen">Uitloggen</button>`;
}
function htmlBlad(){
  const b = A.blad; if (!b) return '';
  return `<div class="tk-blad-achter" data-doe="sluitblad"><div class="tk-blad" role="dialog" aria-modal="true" aria-labelledby="blad-kop">
    <h2 class="tk-h2" id="blad-kop">Afmelden via WhatsApp</h2>
    <p class="tk-zacht" style="margin:0">Dit bericht staat klaar. Jij kiest in WhatsApp de groep van het team.</p>
    <div class="tk-bericht">${e(b.tekst)}</div>
    <p class="tk-klein tk-zacht" style="margin:0">In Cluppie verandert niets. De trainer verwerkt de afmelding.</p>
    <a class="tk-knop" href="${e(K.waUrl(b.tekst))}" target="_blank" rel="noopener" data-doe="sluitblad-na">Open WhatsApp</a>
    <button class="tk-knop licht" data-doe="sluitblad-knop">Annuleren</button></div></div>`;
}
function htmlKamer(){
  if (!A.kamer) return smal(`${merk}<div class="tk-inhoud"><p class="tk-zacht">Laden…</p></div>`);
  const tabs = [['vandaag', 'Vandaag', 'huis'], ['agenda', 'Agenda', 'agenda'], ...(mag('polls') ? [['polls', 'Polls', 'poll']] : []), ['kind', isOuder() ? 'Mijn kind' : 'Ik', 'mens']];
  const tab = tabs.some(t => t[0] === A.tab) ? A.tab : 'vandaag';
  const inhoud = tab === 'agenda' ? htmlAgenda() : tab === 'polls' ? htmlPolls() : tab === 'kind' ? htmlKind() : htmlVandaag();
  const teller = { vandaag: nieuweBerichten().length, polls: nogStemmen().length };
  const tellerTekst = { vandaag: 'nieuwe mededelingen', polls: 'polls waar je nog op stemt' };
  const knoppen = tabs.map(t => `<button data-doe="tab" data-tab="${t[0]}" aria-current="${tab === t[0]}"${teller[t[0]] ? ` aria-label="${t[1]}, ${teller[t[0]]} ${tellerTekst[t[0]]}"` : ''}><span class="tk-ico-vak">${ico(t[2])}${teller[t[0]] ? `<i class="tk-badge">${teller[t[0]]}</i>` : ''}</span><span>${t[1]}</span></button>`).join('');
  try { const n = teller.vandaag + teller.polls; document.title = (n ? `(${n}) ` : '') + 'Teamkamer · Cluppie'; } catch { /* geen titel */ }
  const ander = A.teams.length > 1 ? '<button class="tk-knop licht klein" data-doe="wisselteam">Ander team</button>' : '';
  const team = A.kamer.teamNaam || 'Team', club = A.kamer.clubNaam || 'Teamkamer';
  /* op de computer: zijbalk en kruimelpad zoals in de app; op de telefoon: kop en balk onderaan */
  return `<div class="tk-schil">
      <aside class="tk-zij">${merkregel(team, club)}
        <div class="tk-zij-kop">Teamkamer</div>
        <nav aria-label="Teamkamer">${knoppen}</nav>
        <div class="tk-zij-voet"><button data-doe="uitloggen">${ico('slot')}<span>Uitloggen</span></button></div></aside>
      <div class="tk-hoofd">
        <header class="tk-kop"><div class="tk-kop-tekst"><div class="tk-label">Teamkamer</div><h1 class="tk-h1">${e([A.kamer.teamNaam, A.kamer.clubNaam].filter(Boolean).join(', '))}</h1></div>${ander}</header>
        <div class="tk-kruimel"><span>${e(team)} / <b>${tab === 'kind' && !isOuder() ? 'Ik' : TABNAAM[tab]}</b></span>${ander}</div>
        <main class="tk-inhoud${tab === 'vandaag' ? ' breed' : ''}">${inhoud}</main>
      </div></div>
    <nav class="tk-nav" aria-label="Teamkamer"><div class="tk-nav-in">${knoppen}</div></nav>
    ${htmlBlad()}`;
}

function teken(){
  const vorigeThuis = document.getElementById('tk-thuis');
  const blok3d = vorigeThuis && vorigeThuis.firstElementChild;
  /* [20261116p] wat iemand al intypte blijft staan als het scherm opnieuw wordt getekend (bezig, foutmelding).
     Eerder was het formulier na een fout leeg en moest alles opnieuw. */
  const ingevuld = {}; let focus = '';
  wortel.querySelectorAll('input[id]').forEach(x => { ingevuld[x.id] = x.type === 'checkbox' ? x.checked : x.value; });
  wortel.querySelectorAll('input[name="ok"]').forEach(x => { ingevuld['@ok'] = x.checked; });
  if (document.activeElement && wortel.contains(document.activeElement)) focus = document.activeElement.id || '';
  wortel.innerHTML = A.scherm === 'kamer' ? htmlKamer() : smal(A.scherm === 'start' ? htmlStart() : A.scherm === 'uitnodiging' ? htmlUitnodiging()
    : A.scherm === 'bevestig' ? htmlBevestig() : A.scherm === 'wacht' ? htmlWacht() : A.scherm === 'geen' ? htmlGeen()
    : `${merk}<div class="tk-inhoud"><p class="tk-zacht">Laden…</p></div>`);
  /* het 3D-veld overleeft een hertekening (anders begint de animatie opnieuw) */
  const nieuw = document.getElementById('tk-thuis');
  if (nieuw && blok3d && A.thuisOpen) nieuw.appendChild(blok3d);
  for (const [id, v] of Object.entries(ingevuld)){
    const x = id === '@ok' ? wortel.querySelector('input[name="ok"]') : document.getElementById(id);
    if (!x || !wortel.contains(x)) continue;
    if (x.type === 'checkbox') x.checked = v === true; else if (!x.value) x.value = v;
  }
  if (focus && document.getElementById(focus)) document.getElementById(focus).focus({ preventScroll: true });
  bewaakBevestiging();
  if (naarPoll && A.scherm === 'kamer' && A.tab === 'polls'){
    const doel = document.getElementById('poll-' + naarPoll);
    if (doel){ naarPoll = ''; doel.classList.add('nieuw'); doel.scrollIntoView({ block: 'center' }); }
  }
  legNet();
}
/* [20261116p] Op het scherm "Bevestig je e-mailadres" kijken we zelf of het adres al bevestigd is (elke 4 tellen
   en als je terugkomt op de pagina). Eerder moest je terug naar deze pagina en op een knop tikken. */
let bevestigTimer = 0, bevestigBezig = false;
async function kijkBevestigd(){
  if (bevestigBezig || A.scherm !== 'bevestig' || !auth.currentUser || document.hidden) return;
  bevestigBezig = true;
  try {
    await auth.currentUser.reload();
    if (auth.currentUser && auth.currentUser.emailVerified && A.scherm === 'bevestig'){ await auth.currentUser.getIdToken(true); await naInloggen(auth.currentUser); }
  } catch { /* geen verbinding: straks opnieuw */ }
  bevestigBezig = false;
}
function bewaakBevestiging(){
  if (A.scherm === 'bevestig'){ if (!bevestigTimer) bevestigTimer = setInterval(kijkBevestigd, 4000); }
  else if (bevestigTimer){ clearInterval(bevestigTimer); bevestigTimer = 0; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) kijkBevestigd(); });

/* ==================== video afspelen (Thuis oefenen) ====================
   De speler staat buiten #tk, zodat een hertekening (nieuwe gegevens) de video niet opnieuw start.
   YouTube speelt via youtube-nocookie, met rel=0: na afloop geen video's van andere kanalen. */
let speler = null;
function openSpeler(v){
  sluitSpeler();
  const achter = document.createElement('div'); achter.className = 'tk-blad-achter';
  achter.innerHTML = `<div class="tk-blad breed" role="dialog" aria-modal="true" aria-labelledby="speler-kop">
    <h2 class="tk-h2" id="speler-kop">${e(v.titel || 'Video')}</h2>
    <div class="tk-speler">${v.yt ? `<iframe src="${e(K.ytEmbed(v.yt))}" title="${e(v.titel || 'Video')}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
      : `<video src="${e(v.url)}" controls playsinline preload="metadata"></video>`}</div>
    <button class="tk-knop licht" data-sluit>Sluiten</button></div>`;
  achter.addEventListener('click', (ev) => { if (ev.target === achter || ev.target.closest('[data-sluit]')) sluitSpeler(); });
  achter.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') sluitSpeler(); });
  document.body.appendChild(achter); speler = achter;
  achter.querySelector('[data-sluit]').focus();
  legNet();
}
function sluitSpeler(){ if (speler){ speler.remove(); speler = null; } }
/* [20261116q] een oefening van de training in 3D, met het doel erbij */
async function openOefening(v){
  sluitSpeler();
  const achter = document.createElement('div'); achter.className = 'tk-blad-achter';
  achter.innerHTML = `<div class="tk-blad breed" role="dialog" aria-modal="true" aria-labelledby="speler-kop">
    <h2 class="tk-h2" id="speler-kop">${e(v.naam)}</h2>${v.doel ? `<p style="margin:0">${e(v.doel)}</p>` : ''}
    <div class="tk-3d" id="tk-oef3d">Oefening laden…</div><button class="tk-knop licht" data-sluit>Sluiten</button></div>`;
  achter.addEventListener('click', (ev) => { if (ev.target === achter || ev.target.closest('[data-sluit]')) sluitSpeler(); });
  achter.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') sluitSpeler(); });
  document.body.appendChild(achter); speler = achter; achter.querySelector('[data-sluit]').focus(); legNet();
  const doel = achter.querySelector('#tk-oef3d');
  try {
    const [{ BIBLIOTHEEK }, S3] = await Promise.all([import('./trainingsbibliotheek.js?v=20261116j'), import('./scene3d.js?v=20261116k')]);
    if (speler !== achter) return;
    const vorm = BIBLIOTHEEK.vormen.find(x => x.id === v.vormId);
    doel.textContent = '';
    if (!vorm || !S3.heeftWebGL()){ doel.textContent = vorm ? (vorm.uitleg || '') : 'Deze oefening is niet meer beschikbaar.'; doel.style.padding = '12px'; return; }
    doel.appendChild(S3.maak3DBlok(vorm, vorm.veld));
  } catch { doel.textContent = 'De oefening kon niet laden.'; }
}

/* ==================== terugknop ====================
   Zelfde afspraak als de app (state.js): de terugknop van de telefoon of de browser gaat één stap terug
   binnen de teamkamer en sluit niet meteen alles. Daarvoor ligt er één extra stap in de geschiedenis (het
   vangnet), pas na een eerste aanraking: Chrome op Android slaat stappen over die zonder aanraking zijn
   toegevoegd. Na een terugtik stappen we met history.forward() terug op dat vangnet in plaats van een
   nieuw te leggen: een nieuwe stap zonder aanraking laat Chrome de vorige overslaan, en dan sluit de
   volgende terugtik alles in één keer. Als geïnstalleerde app sluit op het eerste scherm pas een tweede
   tik de app. */
let net = false, netGelegd = false, opBasis = false, vooruit = 0, gewapend = false;
const alsApp = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
function legNet(){
  if (net || A.scherm !== 'kamer') return;
  if (opBasis && netGelegd){                       /* het vangnet ligt nog vooruit: stap erop terug */
    if (vooruit) return;
    net = true;
    vooruit = setTimeout(() => { vooruit = 0; net = false; netGelegd = false; opBasis = false; legNet(); }, 400);
    try { history.forward(); } catch { /* de timer hierboven vangt dit op */ }
    return;
  }
  try { const act = navigator.userActivation; if (act && !act.hasBeenActive) return; } catch { /* oudere browser: gewoon leggen */ }
  try { history.pushState({ tk: true }, ''); net = true; netGelegd = true; opBasis = false; } catch { /* geen geschiedenis beschikbaar */ }
}
function stapTerug(){
  if (speler){ sluitSpeler(); return true; }
  if (A.scherm !== 'kamer') return false;
  if (A.blad){ zet({ blad: null }); return true; }
  if (A.open){ zet({ open: '' }); return true; }
  if (A.tab !== 'vandaag'){ zet({ tab: 'vandaag' }); return true; }
  return false;
}
window.addEventListener('popstate', (ev) => {
  if (vooruit || (ev.state && ev.state.tk)){ clearTimeout(vooruit); vooruit = 0; net = true; netGelegd = true; opBasis = false; return; }   /* weer op het vangnet */
  net = false; opBasis = netGelegd;
  if (stapTerug()){ gewapend = false; return legNet(); }
  if (A.scherm !== 'kamer') return;
  if (!alsApp()) return history.back();          /* in de browser: gewoon terug naar de vorige pagina */
  if (gewapend) return;
  gewapend = true; toast('Tik nog een keer op terug om af te sluiten');
  setTimeout(() => { gewapend = false; legNet(); }, 2000);
});

/* ==================== gegevens ==================== */
function openKamer(teamId, lid){
  stopSubs();
  bewaar.set('tkTeam', teamId);
  Object.assign(A, { scherm: 'kamer', teamId, lid, kamer: null, agenda: [], polls: [], berichten: [], gezin: {}, stats: {}, stemmen: {}, stemGeteld: {}, stemWacht: {}, weer: {}, dicht: false, fout: '',
    gelezen: Number(bewaar.get('tkGelezen:' + teamId)) || 0 });
  const basis = doc(db, 'teamkamer', teamId);
  const mis = () => { stopSubs(); zet({ scherm: 'geen', dicht: true }); };
  A.subs.push(onSnapshot(doc(basis, 'kamerleden', A.user.uid), s => { if (!s.exists()) mis(); else { A.lid = s.data(); teken(); } }, mis));
  A.subs.push(onSnapshot(basis, s => { const k = s.data(); if (!k || k.aan !== true) return mis(); A.kamer = k; teken(); weerHalen(); }, mis));
  A.subs.push(onSnapshot(collection(basis, 'agenda'), s => { A.agenda = s.docs.map(d => ({ id: d.id, ...d.data() })); teken(); weerHalen(); }, () => {}));
  A.subs.push(onSnapshot(collection(basis, 'berichten'), s => { A.berichten = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.ms || 0) - (a.ms || 0)); teken(); }, () => {}));
  A.subs.push(onSnapshot(collection(basis, 'polls'), s => { A.polls = s.docs.map(d => ({ id: d.id, ...d.data() })); stemmenIngehaald(); teken(); eigenStemmen(); }, () => {}));
  (lid.spelerIds || []).forEach(id => A.subs.push(onSnapshot(doc(basis, 'gezin', id), s => { A.gezin[id] = s.data() || {}; teken(); }, () => {})));
  /* [20261116q] cijfers van het eigen kind: alleen ouders mogen dit document lezen (rules) */
  if (lid.rol === 'ouder') (lid.spelerIds || []).forEach(id => A.subs.push(onSnapshot(doc(basis, 'gezin', id, 'ouder', 'stats'), s => { A.stats[id] = s.data() || null; teken(); }, () => {})));
  teken();
}
/* [20261116p] alle eigen stemmen tegelijk ophalen (was één voor één), en per kind apart: bij twee kinderen
   bleef na het wisselen de stem van het andere kind staan. */
async function eigenStemmen(){
  const id = kindId(), teamId = A.teamId; if (!id) return;
  const halen = A.polls.filter(p => !A.stemmen['_' + p.id + '|' + id]);
  if (!halen.length) return;
  halen.forEach(p => { A.stemmen['_' + p.id + '|' + id] = true; });
  await Promise.all(halen.map(async p => {
    let keuzes = [];
    try { const s = await getDoc(doc(db, 'teamkamer', teamId, 'polls', p.id, 'stemmen', id)); keuzes = s.exists() ? (s.data().keuzes || []) : []; } catch { /* geen stem te lezen */ }
    if (A.teamId !== teamId || kindId() !== id || A.stemWacht[p.id]) return;       /* intussen gewisseld of zelf gestemd */
    A.stemmen[p.id] = keuzes; A.stemGeteld[p.id] = keuzes;
  }));
  teken();
}
/* de server heeft geteld: de eigen stem zit nu in poll.telling */
function stemmenIngehaald(){
  for (const p of A.polls){
    const w = A.stemWacht[p.id];
    if (w && K.stemGeteld(p, w.ms, w.telling)){ A.stemGeteld[p.id] = A.stemmen[p.id] || []; delete A.stemWacht[p.id]; }
  }
}
async function weerHalen(){
  const vandaag = K.vandaagIso(), i = K.komend(A.agenda, vandaag).find(x => x.soort === 'wedstrijd' && !x.afgelast && K.binnenDagen(x.datum, vandaag, 6));
  if (!i || A.weer[i.id] !== undefined || !A.kamer?.plek) return;
  A.weer[i.id] = '';
  try { const r = await fetch(K.weerUrl(A.kamer.plek, i.datum)); if (r.ok){ A.weer[i.id] = K.weerTekst(await r.json(), i.verzamel || i.tijd); teken(); } }
  catch { /* geen weer is geen probleem */ }
}
async function ledenVan(user){
  const uit = [];
  if (user.isAnonymous){
    const t = bewaar.get('tkTeam');
    if (t){ try { const s = await getDoc(doc(db, 'teamkamer', t, 'kamerleden', user.uid)); if (s.exists()) uit.push({ teamId: t, lid: s.data() }); } catch { /* geen toegang meer */ } }
    return uit;
  }
  try {
    const wijzers = await getDocs(collection(db, 'gebruikers', user.uid, 'kamers'));
    for (const w of wijzers.docs){
      try { const s = await getDoc(doc(db, 'teamkamer', w.id, 'kamerleden', user.uid)); if (s.exists()) uit.push({ teamId: w.id, lid: s.data() }); } catch { /* verlopen */ }
    }
  } catch { /* nog geen wijzers */ }
  return uit;
}
function wachtOp(teamId){
  stopSubs();
  bewaar.set('tkWacht', teamId);
  zet({ scherm: 'wacht', fout: '' });
  A.subs.push(onSnapshot(doc(db, 'teamkamer', teamId, 'kamerleden', A.user.uid), s => {
    if (s.exists()){ bewaar.set('tkWacht', ''); bewaar.set('tkCode', ''); bewaar.set('tkKind', ''); A.teams = [{ teamId, lid: s.data() }]; openKamer(teamId, s.data()); }
  }, () => {}));
}
async function vraagAan(){
  const code = bewaar.get('tkCode'), kind = bewaar.get('tkKind');
  const r = await roep('vraagKamerToegang', { code, kind });
  bewaar.set('tkCode', ''); bewaar.set('tkKind', '');
  wachtOp(r.teamId);
}
async function naInloggen(user){
  A.user = user;
  if (!user){
    stopSubs();
    const code = bewaar.get('tkCode');
    /* [20261116p] A.link werd hier eerst op {} gezet en daarna nooit meer opgehaald: wie niet was ingelogd zag
       "de teamkamer van het team" zonder naam, en een verlopen link werd pas na het aanmelden gemeld */
    if (code){ const had = !!A.link; zet({ scherm: 'uitnodiging', link: A.link || {} }); if (!had){ try { A.link = await roep('kamerLinkInfo', { code }); } catch { A.link = { geldig: false }; } if (!A.user) teken(); } }
    else zet({ scherm: 'start' });
    return;
  }
  if (A.kindCodeKlaar){ const c = A.kindCodeKlaar; A.kindCodeKlaar = ''; return wisselCode(c); }
  if (!user.isAnonymous && !user.emailVerified) return zet({ scherm: 'bevestig' });
  zet({ scherm: 'laden' });
  A.teams = await ledenVan(user);
  const code = bewaar.get('tkCode');
  if (!user.isAnonymous && code){
    if (bewaar.get('tkKind')){ try { return await vraagAan(); } catch (x){ bewaar.set('tkKind', ''); A.fout = foutTekst(x); } }
    try { A.link = await roep('kamerLinkInfo', { code }); } catch { A.link = { geldig: false }; }
    /* [20261116p] de teamlink staat in de groepsapp en wordt steeds opnieuw aangetikt: wie al binnen is (of al
       wacht op de trainer) hoort niet opnieuw het aanmeldformulier te krijgen */
    const al = A.link && A.link.teamId ? A.teams.find(x => x.teamId === A.link.teamId) : null;
    if (al){ bewaar.set('tkCode', ''); return openKamer(al.teamId, al.lid); }
    if (A.link && A.link.teamId && (A.link.status === 'wacht' || bewaar.get('tkWacht') === A.link.teamId) && !bewaar.get('tkKind')){ bewaar.set('tkCode', ''); return wachtOp(A.link.teamId); }
    return zet({ scherm: 'uitnodiging' });
  }
  if (A.teams.length){
    const t = A.teams.find(x => x.teamId === bewaar.get('tkTeam')) || A.teams[0];
    return openKamer(t.teamId, t.lid);
  }
  if (!user.isAnonymous && bewaar.get('tkWacht')) return wachtOp(bewaar.get('tkWacht'));
  if (user.isAnonymous){ await signOut(auth); return; }
  zet({ scherm: 'geen', dicht: false });
}
async function wisselCode(code){
  zet({ bezig: true, fout: '' });
  try {
    if (!auth.currentUser){ A.kindCodeKlaar = code; await signInAnonymously(auth); return; }
    const r = await roep('wisselKindCode', { code });
    bewaar.set('tkTeam', r.teamId);
    A.bezig = false;
    await naInloggen(auth.currentUser);
  } catch (x){
    if (auth.currentUser && auth.currentUser.isAnonymous && !bewaar.get('tkTeam')) await signOut(auth).catch(() => {});
    zet({ bezig: false, fout: foutTekst(x), scherm: 'start' }); toast(foutTekst(x));
  }
}

/* ==================== bediening ==================== */
wortel.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, soort = f.dataset.form, d = new FormData(f);
  if (A.bezig) return;
  if (soort === 'kindcode'){
    const code = K.schoonCode(d.get('code'), 6);
    if (code.length !== 6) return toast('De code heeft 6 tekens.');
    return wisselCode(code);
  }
  zet({ bezig: true, fout: '' });
  try {
    if (soort === 'login') await signInWithEmailAndPassword(auth, String(d.get('mail')).trim(), String(d.get('ww')));
    if (soort === 'aanmelden'){
      bewaar.set('tkKind', String(d.get('kind') || '').trim().slice(0, 40));
      if (A.user && !A.user.isAnonymous){ A.bezig = false; return await naInloggen(A.user); }
      const mail = String(d.get('mail')).trim(), ww = String(d.get('ww'));
      try {
        const c = await createUserWithEmailAndPassword(auth, mail, ww);
        await stuurBevestiging(c.user);
      } catch (x){
        if (x.code !== 'auth/email-already-in-use') throw x;
        await signInWithEmailAndPassword(auth, mail, ww);
      }
    }
    A.bezig = false;
  } catch (x){ zet({ bezig: false, fout: AUTH_FOUT[x.code] || foutTekst(x) }); }
});
/* [20261116p] de link in de mail brengt je terug naar de teamkamer (met de code van de teamlink), niet naar de trainersapp */
async function stuurBevestiging(user){
  const code = bewaar.get('tkCode');
  try { await roep('verificatieMail', { naar: 'kamer', code }); }
  catch { try { await sendEmailVerification(user, { url: K.KAMER_URL + (code ? '?k=' + code : '') }); } catch { try { await sendEmailVerification(user); } catch { /* later opnieuw */ } } }
}
wortel.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-doe]'); if (!b) return;
  const doe = b.dataset.doe;
  if (doe === 'sluitblad' && ev.target !== b) return;            /* tik in het blad zelf sluit niet */
  try {
    legNet();
    if (doe === 'tab') return zet({ tab: b.dataset.tab, open: '' });
    if (doe === 'video'){ const v = (A.kamer?.thuisVideos || []).filter(x => x && (x.yt || x.url))[Number(b.dataset.n)]; if (v) openSpeler(v); return; }
    if (doe === 'oef3d'){ const i = A.agenda.find(x => x.id === b.dataset.id), v = i && i.training && i.training.vormen[Number(b.dataset.n)]; if (v) openOefening(v); return; }
    if (doe === 'kopieercode'){ await navigator.clipboard.writeText(K.toonCode(A.code)); return toast('Code gekopieerd'); }
    if (doe === 'open') return zet({ open: A.open === b.dataset.id ? '' : b.dataset.id });
    if (doe === 'kind'){ A.kind = b.dataset.id; A.code = null; A.stemmen = {}; A.stemGeteld = {}; A.stemWacht = {}; teken(); return eigenStemmen(); }
    if (doe === 'gelezen'){ A.gelezen = Math.max(Date.now(), ...A.berichten.map(x => Number(x.ms) || 0)); bewaar.set('tkGelezen:' + A.teamId, String(A.gelezen)); return teken(); }
    if (doe === 'naarpoll'){ naarPoll = b.dataset.id; return zet({ tab: 'polls', open: '' }); }
    if (doe === 'toonww'){ const x = document.getElementById('f-ww'); if (x){ x.type = x.type === 'password' ? 'text' : 'password'; b.textContent = x.type === 'password' ? 'Toon' : 'Verberg'; } return; }
    if (doe === 'afmelden'){ const i = A.agenda.find(x => x.id === b.dataset.id); if (i) zet({ blad: { tekst: K.afmeldTekst(kindNaam(), i) } }); return; }
    if (doe === 'sluitblad' || doe === 'sluitblad-knop') return zet({ blad: null });
    if (doe === 'sluitblad-na') return setTimeout(() => zet({ blad: null }), 300);
    if (doe === 'uitloggen'){ sluitSpeler(); stopSubs(); bewaar.set('tkWacht', ''); if (auth.currentUser?.isAnonymous) bewaar.set('tkTeam', ''); A.link = null; await signOut(auth); return; }
    if (doe === 'vergeetlink'){ bewaar.set('tkCode', ''); A.link = null; return naInloggen(auth.currentUser); }
    if (doe === 'wisselteam'){ const n = (A.teams.findIndex(t => t.teamId === A.teamId) + 1) % A.teams.length; return openKamer(A.teams[n].teamId, A.teams[n].lid); }
    if (doe === 'reset'){
      const mail = (document.getElementById('f-mail')?.value || '').trim();
      if (!mail) return toast('Vul eerst je e-mailadres in.');
      await roep('wachtwoordReset', { email: mail }); return toast('Als dit adres bekend is, krijg je een mail.');
    }
    if (doe === 'bevestigd'){
      zet({ bezig: true, fout: '' });
      await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
      A.bezig = false;
      if (!auth.currentUser.emailVerified) return zet({ fout: 'Je adres is nog niet bevestigd. Klik eerst op de link in de mail.' });
      return naInloggen(auth.currentUser);
    }
    if (doe === 'mailopnieuw'){ await stuurBevestiging(auth.currentUser); return toast('De mail is opnieuw verstuurd.'); }
    if (doe === 'ics'){
      const tekst = K.maakIcs(K.komend(A.agenda, K.vandaagIso()), A.kamer?.teamNaam);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tekst], { type: 'text/calendar' })); a.download = 'teamkamer.ics';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return;
    }
    if (doe === 'stem'){
      const p = A.polls.find(x => x.id === b.dataset.poll); if (!p || !K.magStemmen(p, rol())) return;
      const keuzes = K.kiesOptie(p, A.stemmen[p.id], b.dataset.optie), vorige = A.stemmen[p.id], wachtVoor = A.stemWacht[p.id], ms = Date.now();
      if (A.stemGeteld[p.id] === undefined) A.stemGeteld[p.id] = vorige || [];
      /* meteen zichtbaar, met het aantal erbij; de server telt daarna (zie pollMetEigen) */
      A.stemmen[p.id] = keuzes; A.stemWacht[p.id] = { ms, telling: wachtVoor ? wachtVoor.telling : JSON.stringify(p.telling || {}) }; teken();
      try { await setDoc(doc(db, 'teamkamer', A.teamId, 'polls', p.id, 'stemmen', kindId()), { keuzes, door: A.user.uid, ms }); }
      catch { if (A.stemWacht[p.id] && A.stemWacht[p.id].ms === ms){ A.stemmen[p.id] = vorige; if (wachtVoor) A.stemWacht[p.id] = wachtVoor; else delete A.stemWacht[p.id]; teken(); } toast('Stemmen lukte niet. Is de poll al gesloten?'); }
      return;
    }
    if (doe === 'kindcode'){ zet({ bezig: true }); const r = await roep('maakKindCode', { teamId: A.teamId, spelerId: kindId() }); return zet({ bezig: false, code: r.code }); }
    if (doe === 'stopkind'){
      if (!confirm(`De toegang van ${kindNaam()} stoppen op alle toestellen?`)) return;
      const r = await roep('stopKindToegang', { teamId: A.teamId, spelerId: kindId() }); A.code = null; teken();
      return toast(r.aantal ? 'De toegang is gestopt.' : 'Er was geen toegang om te stoppen.');
    }
    if (doe === 'verberg'){ const zichtbaar = b.getAttribute('aria-checked') === 'true'; b.disabled = true; await roep('kamerVerberg', { teamId: A.teamId, spelerId: kindId(), verborgen: zichtbaar }); return; }
    if (doe === 'verlaat'){
      if (!confirm('Teamkamer verlaten? Je ziet daarna niets meer van dit team.')) return;
      await roep('trekKamerToegangIn', { teamId: A.teamId }); return;
    }
    if (doe === 'thuis'){
      A.thuisOpen = true; teken();
      const doel = document.getElementById('tk-thuis'); if (!doel) return;
      doel.textContent = 'Oefening laden…';
      const [{ BIBLIOTHEEK }, S3] = await Promise.all([import('./trainingsbibliotheek.js?v=20261116j'), import('./scene3d.js?v=20261116k')]);
      const vorm = BIBLIOTHEEK.vormen.find(v => v.id === A.kamer.thuis.vormId);
      doel.textContent = '';
      if (!vorm){ doel.textContent = 'Deze oefening is niet meer beschikbaar.'; return; }
      if (S3.heeftWebGL()) doel.appendChild(S3.maak3DBlok(vorm, vorm.veld));
      const uitleg = document.createElement('p'); uitleg.style.cssText = 'margin:0;padding:12px'; uitleg.textContent = vorm.uitleg || vorm.doel || '';
      doel.appendChild(uitleg);
      return;
    }
  } catch (x){ A.bezig = false; teken(); toast(foutTekst(x)); }
});

onAuthStateChanged(auth, (user) => { naInloggen(user).catch(x => zet({ scherm: user ? 'geen' : 'start', fout: foutTekst(x) })); });
