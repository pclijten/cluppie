/* ==================== APP CHECK AFDWINGEN [20261121b] ====================
   App Check (reCAPTCHA Enterprise) staat in de app aan sinds 11-10-2026 en meet sindsdien alleen.
   Afdwingen gaat op twee plekken, en dat is makkelijk te missen:
     1. Firestore, Storage en Authentication: in de Firebase-console (App Check › APIs › Enforce).
     2. De callables (Cloud Functions): NIET in de console, maar hier in de code, met `enforceAppCheck`.
        Tot nu toe stond dat nergens: "Enforce" in de console liet de functies dus open.

   AFDWINGEN = true weigert elke aanroep van een callable zonder geldig App Check-token (fout
   "unauthenticated"). index.js zet het met setGlobalOptions vóórdat de functies worden gemaakt; het geldt
   pas na een deploy van de callables. Triggers en geplande functies worden niet door een browser
   aangeroepen en vallen hier niet onder.

   Zet dit pas op true als (zie docs/appcheck-afdwingen.md):
     - de console bij App Check › APIs een paar dagen vrijwel alleen geverifieerde verzoeken toont;
     - er een debug-token is voor lokaal testen (op localhost start de app geen App Check).
   Terugdraaien: weer false en de callables opnieuw deployen. */
const AFDWINGEN = false;

module.exports = { AFDWINGEN };
