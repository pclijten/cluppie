/* ==================== VERHUIS-LOGIN [20261122c] ====================
   Voor trainers die van een verhuisde clubomgeving komen (ASV'33: cluppieasv33.nl stuurt door naar
   cluppie.io). Inloggen is per webadres, dus op het nieuwe adres zou iedereen opnieuw moeten inloggen.
   De doorverwijspagina van het oude adres vraagt daarom bij de Cloud Function `verhuisLogin` een
   eenmalig inlogbewijs voor hetzelfde account en geeft dat mee achter het hekje: …/#verhuis=<bewijs>.
   Hier wordt dat bewijs ingewisseld, zodat de trainer meteen ingelogd is.

   - Het bewijs staat achter het hekje en gaat dus niet naar een server; het wordt direct uit de adresbalk
     gehaald (ook uit de geschiedenis) en is een uur geldig.
   - Is er op dit apparaat al iemand ingelogd op cluppie.io, dan gebeurt er niets: nooit stil van account wisselen.
   - Mislukt het, dan ziet de trainer het gewone inlogscherm.
   Zonder #verhuis doet deze module niets en laadt hij ook niets extra's. */
import { auth } from './firebase.js?v=20261011g';

/* PUUR (getest): haalt het bewijs uit het deel achter het hekje; geeft ook het hekje zonder het bewijs terug. */
export function leesVerhuisHash(hash){
  const delen = String(hash || '').replace(/^#/, '').split('&').filter(Boolean);
  const i = delen.findIndex(d => d.startsWith('verhuis='));
  if (i < 0) return { bewijs: '', rest: hash || '' };
  let bewijs = '';
  try { bewijs = decodeURIComponent(delen[i].slice(8)); } catch (e){ bewijs = ''; }
  delen.splice(i, 1);
  /* een inlogbewijs van Firebase is een JWT: drie stukken met punten ertussen */
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bewijs)) bewijs = '';
  return { bewijs, rest: delen.length ? '#' + delen.join('&') : '' };
}

export async function verhuisLogin(){
  if (!/(^#|&)verhuis=/.test(location.hash)) return false;
  const { bewijs, rest } = leesVerhuisHash(location.hash);
  try { history.replaceState(null, '', location.pathname + location.search + rest); } catch (e){}
  if (!bewijs) return false;
  try {
    if (auth.authStateReady) await auth.authStateReady();
    if (auth.currentUser && !auth.currentUser.isAnonymous) return false;
    const { signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    await signInWithCustomToken(auth, bewijs);
    return true;
  } catch (e){
    console.warn('[Cluppie] verhuis-login niet gelukt; gewoon inloggen kan altijd', e && e.code || e);
    return false;
  }
}
