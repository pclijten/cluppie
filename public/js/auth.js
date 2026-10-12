import {
  auth, db, GoogleAuthProvider, signInWithPopup, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  collection, doc, addDoc, setDoc, getDoc, serverTimestamp, increment, functions, httpsCallable, sendEmailVerification
} from './firebase.js?v=20261011g';
import { S, $, meld } from './state.js?v=20261011g';
import { startTracker } from './tracker.js?v=20261011g';

/* ====================================================================
   AANMELD-FLOW — Google of e-mail+wachtwoord.

   - Alle drie geven een STABIELE identiteit (vaste uid), dus opnieuw
     inloggen maakt geen dubbele coach meer aan.
   - E-mail+wachtwoord: bestaat het account nog niet, dan wordt het bij de
     eerste keer automatisch aangemaakt (registreren = eerste login).
   - Een uitnodigingslink (?team=CODE) bepaalt bij welk team je komt. De
     teamcode bewaren we in localStorage zodat hij een eventuele
     redirect/herlaad overleeft.
   - Alleen accounts in BEHEERDERS (state.js) mogen clubs/teams aanmaken;
     dat wordt in de UI verborgen én in de Firestore-regels afgedwongen.
==================================================================== */

const LS_CODE = 'opstelling_join_code';   // teamcode die na login gekoppeld moet worden

let pendingTeamInfo = null;   // {code, teamNaam} uit de uitnodigingslink
let deeplinkVerwerkt = false;

export function getPendingTeamInfo(){ return pendingTeamInfo; }

function bewaarCode(){
  if (pendingTeamInfo){ try { localStorage.setItem(LS_CODE, pendingTeamInfo.code); } catch(e){} }
}
/* ---------- knoppen koppelen (één keer, bij opstart) ---------- */
export function initAuthUI(){
  // ===== Inlogscherm =====
  $('#googleLogin').addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(e){ meldLoginFout(e); }
  });
  // e-mail + wachtwoord (form-submit vangt klik én Enter af)
  $('#mailLoginForm').addEventListener('submit', e => {
    e.preventDefault();
    wachtwoordLogin($('#loginEmail').value, $('#loginWachtwoord').value, $('#wwLoginOk'));
  });
  $('#wwVergeten').addEventListener('click', e => {
    e.preventDefault();
    wachtwoordVergeten($('#loginEmail').value);
  });

  // ===== Uitnodigingsscherm =====
  $('#uitnodigGoogle').addEventListener('click', async () => {
    bewaarCode();
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(e){ meldLoginFout(e); }
  });
  $('#uitnodigForm').addEventListener('submit', e => {
    e.preventDefault();
    bewaarCode();
    wachtwoordLogin($('#uitnodigEmail').value, $('#uitnodigWachtwoord').value, $('#uitnodigWwOk'));
  });

  $('#uitnodigAnders').addEventListener('click', () => {
    $('#uitnodiging').style.display = 'none';
    $('#login').style.display = '';
    $('#loginEmail').focus();
  });
}

/* nette foutmelding bij social login (popup gesloten = geen melding nodig) */
function meldLoginFout(e){
  if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
  if (e.code === 'auth/account-exists-with-different-credential'){
    meld('Dit e-mailadres is al gekoppeld aan een andere inlogmethode. Gebruik die methode om in te loggen.');
    return;
  }
  meld('Inloggen mislukt: ' + (e.code || e.message));
}

/* Log in met e-mail + wachtwoord. Bestaat het account nog niet, dan wordt het
   automatisch aangemaakt met dit wachtwoord. */
async function wachtwoordLogin(adresRuw, wachtwoord, knop){
  const adres = (adresRuw||'').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adres)) return meld('Vul een geldig e-mailadres in');
  if ((wachtwoord||'').length < 6) return meld('Wachtwoord moet minstens 6 tekens zijn');
  const oudeTekst = knop ? knop.textContent : '';
  if (knop){ knop.disabled = true; knop.textContent = 'Bezig...'; }
  try {
    await signInWithEmailAndPassword(auth, adres, wachtwoord);
  } catch(e){
    // Firebase geeft bij een onbekend account tegenwoordig vaak 'invalid-credential'
    // i.p.v. 'user-not-found'. We kunnen vooraf niet betrouwbaar weten of het account
    // bestaat, dus: probeer het account aan te maken. Lukt dat → nieuwe gebruiker.
    // Bestaat het al ('email-already-in-use') → dan was het écht een fout wachtwoord.
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential'
        || e.code === 'auth/invalid-login-credentials'){
      try {
        const nieuw = await createUserWithEmailAndPassword(auth, adres, wachtwoord);
        try { await sendEmailVerification(nieuw.user); meld('We hebben een bevestigingsmail gestuurd naar ' + adres); } catch(_) {}
      } catch(e2){
        if (e2.code === 'auth/email-already-in-use')
          meld('Onjuist wachtwoord voor dit account. Probeer opnieuw of gebruik "wachtwoord vergeten".');
        else if (e2.code === 'auth/weak-password')
          meld('Kies een wachtwoord van minstens 6 tekens');
        else if (e2.code === 'auth/operation-not-allowed')
          meld('E-mail/wachtwoord-login staat nog uit in Firebase. Zet de provider aan in de Console.');
        else
          meld('Aanmelden mislukt: ' + (e2.code||e2.message));
      }
    } else if (e.code === 'auth/wrong-password'){
      meld('Onjuist wachtwoord. Probeer opnieuw of gebruik "wachtwoord vergeten".');
    } else if (e.code === 'auth/operation-not-allowed'){
      meld('E-mail/wachtwoord-login staat nog uit in Firebase. Zet de provider aan in de Console.');
    } else {
      meld('Inloggen mislukt: ' + (e.code||e.message));
    }
  } finally {
    if (knop){ knop.disabled = false; knop.textContent = oudeTekst; }
  }
}

/* stuur een wachtwoord-reset-mail */
async function wachtwoordVergeten(adresRuw){
  const adres = (adresRuw||'').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adres)) return meld('Vul eerst je e-mailadres in');
  try {
    await sendPasswordResetEmail(auth, adres);
    meld('Reset-link gestuurd naar ' + adres + ' (check ook je spam)');
  } catch(e){
    if (e.code === 'auth/user-not-found')
      meld('Geen account met dit e-mailadres gevonden');
    else
      meld('Kon geen reset-mail sturen: ' + (e.code||e.message));
  }
}

export function doSignOut(){ signOut(auth); }

/* ====================================================================
   LOGIN-REGISTRATIE — voor het gebruiksoverzicht op het clubdashboard.
   Schrijft hooguit één keer per kalenderdag per apparaat (via localStorage,
   dus geen extra Firestore-read nodig om te bepalen of het al gebeurd is).
   - logins/{autoId}: één document per gebruiker per dag dat hij inlogt
   - gebruikers/{uid}: samenvatting (naam, laatste login, totaal aantal logins)
     voor het "meest actieve gebruikers"-lijstje, zonder de hele logins-
     collectie te hoeven doorlezen.
==================================================================== */
const LS_LOGINLOG = 'opstelling_login_log_datum';

export async function registreerLogin(){
  if (!S.user) return;
  startTracker(); // idempotent — zet de flush-triggers op, ook als login vandaag al geteld is
  const vandaag = new Date().toISOString().slice(0,10);
  try { if (localStorage.getItem(LS_LOGINLOG) === vandaag) return; } catch(e){}
  /* AVG-dataminimalisatie: geen naam of e-mailadres in logins/gebruikers.
     Alleen uid + datum; namen staan in het club-/teamdocument (ledenInfo). */
  try {
    await addDoc(collection(db,'logins'), { uid: S.user.uid, datum: vandaag, tijd: serverTimestamp() });
    await setDoc(doc(db,'gebruikers',S.user.uid), {
      laatsteLogin: serverTimestamp(), aantalLogins: increment(1),
    }, { merge: true });
    try { localStorage.setItem(LS_LOGINLOG, vandaag); } catch(e){}
  } catch(e){
    console.warn('Login registreren mislukt:', e);
  }
}

/* Stille zelf-reparatie: coaches die vóór deze fix via een teamcode zijn
   aangesloten, missen de clubs/{clubId}.leden-vermelding (zie joinMetCode)
   en krijgen permission-denied op club-brede listeners (seizoen, uitleningen).
   Wordt bij het openen van een team met een club aangeroepen; eenmaal per
   sessie per club, en negeert fouten stil (de bestaande listener-foutmelding
   blijft dan gewoon zichtbaar als er een dieperliggend rechtenprobleem is). */
const _clubLidGeprobeerd = new Set();
export async function zorgClubLidmaatschap(clubId){
  if (!clubId || !S.user || _clubLidGeprobeerd.has(clubId)) return;
  _clubLidGeprobeerd.add(clubId);
  try {
    await sluitAanCallable({ clubId, naam: weergaveNaam() });
  } catch(e){
    console.error(`[Cluppie] Zelf-reparatie club-lidmaatschap mislukt (clubId=${clubId}):`, e.code, e.message);
  }
}

/* AVG/tenant-isolatie: aansluiten gaat via de server (sluitAan), zodat teams en
   clubs voor niet-leden onleesbaar kunnen blijven. De server controleert de code. */
const sluitAanCallable = (data) => httpsCallable(functions, 'sluitAan')(data).then(r => r.data);
const uitnodigingCallable = (data) => httpsCallable(functions, 'uitnodigingInfo')(data).then(r => r.data);
function weergaveNaam(naam){
  return (naam && naam.trim()) || S.user.displayName
    || (S.user.email ? S.user.email.split('@')[0] : '') || 'Coach';
}

/* koppel de ingelogde gebruiker aan een team op basis van de teamcode */
export async function joinMetCode(code, naam = null){
  let res;
  try { res = await sluitAanCallable({ code, naam: weergaveNaam(naam) }); }
  catch(e){
    if (e.code === 'functions/not-found'){ meld(e.message && e.message !== 'Onbekende code.' ? e.message : 'Deze code of uitnodiging werkt niet (meer)'); return null; }
    if (e.code === 'functions/failed-precondition'){ meld(e.message); return null; }
    if (e.code === 'functions/resource-exhausted'){ meld('Te veel pogingen. Probeer het over een paar minuten opnieuw.'); return null; }
    throw e;
  }
  if (res.status === 'aanvraag'){
    S._aanvraagVerstuurd = { club: res.clubNaam, team: res.naam };
    import('./toegang.js?v=20261012a').then(m => m.toonAanvraagVerstuurd(res));
    return null;
  }
  if (!res.teamId){ if (res.clubNaam) meld('Gekoppeld aan ' + res.clubNaam); return null; }
  return await getDoc(doc(db,'teams',res.teamId));
}

/* uitnodigingslink herkennen en het uitnodigingsscherm voorbereiden */
export async function checkUitnodiging(){
  const p = new URLSearchParams(location.search);
  const code = (p.get('uitn') || p.get('team') || '').toUpperCase();
  if (!code) return false;
  pendingTeamInfo = {code, teamNaam: ''};
  try {
    const info = await uitnodigingCallable({ code }).catch(e => (e.code === 'functions/not-found' ? null : Promise.reject(e)));
    if (!info){
      $('#uitnodigTitel').textContent = 'Uitnodiging ongeldig';
      $('#uitnodigSubtitel').textContent = 'Deze link werkt niet meer. Controleer of je de volledige link hebt, of vraag een nieuwe aan je coach.';
      $('#uitnodigGoogle').style.display = 'none';
      $('#uitnodigForm').style.display = 'none';
      pendingTeamInfo = null;
    } else {
      $('#uitnodigTitel').textContent = '🏟 ' + info.naam;
      $('#uitnodigSubtitel').textContent = info.clubNaam
        ? 'Je bent uitgenodigd als coach bij ' + info.clubNaam + '. Log in om aan te sluiten.'
        : 'Je bent uitgenodigd als coach. Log in om aan te sluiten.';
      pendingTeamInfo = {code, teamNaam: info.naam};
    }
  } catch(e){
    $('#uitnodigTitel').textContent = 'Welkom!';
    $('#uitnodigSubtitel').textContent = 'Log in om als coach aan te sluiten bij het team.';
  }
  return true;
}

/* na inloggen: openstaande teamkoppeling afhandelen (uit localStorage).
   Geeft het team-document terug als er net is aangesloten, anders null. */
export async function handelPendingJoin(){
  let code = '';
  if (pendingTeamInfo) code = pendingTeamInfo.code;
  if (!code){ try { code = localStorage.getItem(LS_CODE) || ''; } catch(e){} }
  if (!code) return null;
  try { localStorage.removeItem(LS_CODE); } catch(e){}
  if (S.teams.find(t => (t.code||'').toUpperCase() === code.toUpperCase())) return null;
  return await joinMetCode(code);
}

/* deep-links (?team= of ?club=) na inloggen verwerken */
export async function verwerkDeeplink(openTeam, openClub){
  if (deeplinkVerwerkt) return;
  const p = new URLSearchParams(location.search);
  const teamParam = p.get('uitn') || p.get('team');
  const clubCode = p.get('club');
  if (teamParam){
    deeplinkVerwerkt = true;
    history.replaceState(null,'',location.pathname);
    const code = teamParam.toUpperCase();
    if (!S.teams.find(t => (t.code||'').toUpperCase() === code)){
      const t = await joinMetCode(code);
      if (t){ meld('Welkom bij ' + t.data().naam); openTeam(t.id); }
    }
  } else if (clubCode){
    deeplinkVerwerkt = true;
    history.replaceState(null,'',location.pathname);
    const t = await joinMetCode(clubCode.toUpperCase());
    if (t) meld('Gekoppeld aan ' + (t.data().clubNaam || 'de club'));
  }
}
