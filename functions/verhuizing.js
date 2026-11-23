/* Verhuis-login (20261122c). Voor een clubomgeving die naar cluppie.io is verhuisd (ASV'33, project
   cluppieasv33, site cluppieasv33.nl). Inloggen is per webadres, dus zonder dit zou elke trainer op
   cluppie.io opnieuw moeten inloggen. De doorverwijspagina van het oude adres stuurt het inlogbewijs
   (ID-token) van het OUDE project hierheen; klopt dat, dan krijgt hij een eenmalig inlogbewijs
   (custom token, een uur geldig) voor HETZELFDE account in dit project terug. Zie VERHUIZING-ASV33.md.

   Callable `verhuisLogin({ idToken })`, zonder inloggen (de trainer is hier juist nog niet ingelogd).
   Antwoord: { token } of { token: null } (dan gewoon inloggen; nooit een reden terug, die staat in de logs).

   Wanneer wel een bewijs:
     • het ID-token is echt van het oude project (handtekening van Google, niet verlopen), niet anoniem;
     • in dit project bestaat een account met HETZELFDE id en hetzelfde e-mailadres (dus overgezet door
       tools/verhuis-asv33.mjs), óf, voor wie al een eigen cluppie.io-account had, een account met hetzelfde
       e-mailadres terwijl dat adres in het oude project bevestigd is (anders kon iemand met andermans adres
       een account in het oude project maken en zo binnenkomen);
     • het account is niet geblokkeerd, en het is vóór EINDE.
   Nodig in dit project: de service-account van de functie mag tokens ondertekenen
   (rol Service Account Token Creator op zichzelf; zie VERHUIZING-ASV33.md). Zonder dat recht komt er
   { token: null } terug en logt de trainer gewoon in.
   App Check staat voor deze functie bewust uit: de aanroep komt van het oude webadres. */

const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const REGIO = 'europe-west1';
const OUD_PROJECT = 'cluppieasv33';
/* Daarna doet de functie niets meer: wie dan nog het oude adres opent, logt gewoon in. Verwijder de functie dan. */
const EINDE = '2027-07-01';
const klein = s => String(s || '').trim().toLowerCase();

let oudApp = null;
function authOudProject(){
  if (!oudApp) oudApp = admin.initializeApp({ projectId: OUD_PROJECT }, 'verhuis-oud');
  return oudApp.auth();
}

/* Hele afhandeling, los van onCall zodat hij getest kan worden. Geeft { token, uitkomst } terug. */
async function verwerkVerhuisLogin(idToken, { authOud, authNieuw, nu = new Date() }){
  if (nu.toISOString().slice(0, 10) >= EINDE) return { token: null, uitkomst: 'voorbij' };
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 4096) return { token: null, uitkomst: 'ongeldig' };
  let oud;
  try { oud = await authOud.verifyIdToken(idToken); }
  catch (e){ return { token: null, uitkomst: 'ongeldig' }; }
  if (!oud || !oud.uid || (oud.firebase && oud.firebase.sign_in_provider === 'anonymous')) return { token: null, uitkomst: 'anoniem' };

  let account = null;
  try {
    const zelfde = await authNieuw.getUser(oud.uid);
    /* zelfde id: alleen als ook het adres klopt (een overgezet account) */
    if (klein(zelfde.email) && klein(zelfde.email) === klein(oud.email)) account = zelfde;
  } catch (e){
    if (!(e && e.code === 'auth/user-not-found')) throw e;
  }
  if (!account && oud.email && oud.email_verified === true){
    try { account = await authNieuw.getUserByEmail(oud.email); }
    catch (e){ if (!(e && e.code === 'auth/user-not-found')) throw e; }
  }
  if (!account) return { token: null, uitkomst: 'onbekend' };
  if (account.disabled) return { token: null, uitkomst: 'geblokkeerd' };
  const token = await authNieuw.createCustomToken(account.uid);
  return { token, uitkomst: account.uid === oud.uid ? 'zelfde' : 'gekoppeld' };
}

const verhuisLogin = onCall({ region: REGIO, cors: true, enforceAppCheck: false }, async (request) => {
  try {
    const r = await verwerkVerhuisLogin(request.data && request.data.idToken, { authOud: authOudProject(), authNieuw: admin.auth() });
    if (!r.token) logger.info('verhuisLogin: geen bewijs', { uitkomst: r.uitkomst });
    return { token: r.token };
  } catch (e){
    /* bv. het recht om te ondertekenen ontbreekt: de trainer logt dan gewoon in */
    logger.error('verhuisLogin mislukt', { code: e && e.code, message: e && e.message });
    return { token: null };
  }
});

module.exports = { verhuisLogin, verwerkVerhuisLogin, OUD_PROJECT, EINDE };
