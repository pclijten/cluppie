# App Check op afdwingen

21-11-2026. App Check (reCAPTCHA Enterprise) staat sinds 11-10-2026 in de app en meet alleen. Dit document zegt wat er nodig is om het af te dwingen, en wat daarbij tot nu toe ontbrak.

## Wat er ontbrak

`PORTEREN.md` zei: "Enforce aan voor Firestore, Storage en Functions" in de console. Voor callables bestaat die knop niet. Een callable dwingt App Check alleen af als dat in de code staat (`enforceAppCheck`), en dat stond nergens. Had je in de console alles op Enforce gezet, dan waren de 57 callables (aansluiten met een code, uitnodigingen, AI, platformfuncties) gewoon open gebleven voor aanroepen zonder token.

Sinds release 20261121b staat er één schakelaar: `functions/appcheck.js`, `AFDWINGEN`. Hij staat op `false`, dus er verandert nu niets. Getest: met de schakelaar aan weigert een callable een aanroep zonder token met "Unauthenticated".

## Wat App Check wel en niet doet

Het maakt het moeilijk om de database en de functies aan te roepen vanuit iets anders dan de echte app op cluppie.io: een script dat teamcodes raadt, of een nagemaakte pagina. Het vervangt de toegangsregels niet: wie in de echte app is ingelogd, mag nog steeds precies wat de rules toestaan.

## Stappen

1. **Kijk naar de cijfers.** Firebase-console › App Check › APIs. Per product (Cloud Firestore, Storage, Authentication) staat welk deel van de verzoeken geverifieerd is. Verwacht vrijwel alles. Zie je een flink deel "niet geverifieerd" of "verouderde client", zoek dan eerst uit waar dat vandaan komt (een oude versie van de app in de cache, een pagina die `firebase.js` niet gebruikt).
2. **Debug-token voor jezelf.** Op `localhost` start de app geen App Check (`firebase.js`). Na het afdwingen werkt lokaal testen tegen de echte database dus niet meer, tenzij je een debug-token registreert (console › App Check › Apps › Debug-tokens beheren) en `self.FIREBASE_APPCHECK_DEBUG_TOKEN` zet. De emulator en de demo (`?demo`) hebben hier geen last van.
3. **Firestore en Storage op Enforce** in de console. Dit gaat meteen in, zonder deploy. Loop direct daarna de app na: inloggen, een team openen, een training met plaatje, de teamkamer (`kamer.html`), een gedeelde training via een link, de trainingshulp via een open link.
4. **Callables.** Zet in `functions/appcheck.js` `AFDWINGEN = true`, commit naar `main` en deploy alle callables (stap 4 van `tools/deploy-alles.ps1` doet dat). Loop daarna na: aansluiten met een uitnodigingslink, wachtwoord vergeten, de hulp-chat, Platform › Vernieuwen.
5. **Authentication op Enforce** als laatste, als 3 en 4 een paar dagen goed gaan.

## Terugdraaien

- Firestore, Storage, Authentication: in de console terug naar "Niet afgedwongen". Meteen.
- Callables: `AFDWINGEN = false` en opnieuw deployen. Reken op een kwartier.

Zet de stappen daarom niet op een zaterdagochtend.

## Wat kan misgaan

| Wat | Hoe je het merkt | Wat je doet |
|---|---|---|
| reCAPTCHA geeft een echte gebruiker geen token (strenge browser, adblocker, bedrijfsnetwerk) | Die gebruiker krijgt "Geen toegang" of een leeg scherm, anderen niet | Terug naar meten; kijk in de console welk deel dit is |
| Een oude versie van de app in de cache van een telefoon | Verouderde client in de cijfers | De service worker ververst bij de volgende start; wacht een paar dagen met afdwingen na een grote release |
| Een pagina die Firebase niet via `firebase.js` start | Alleen die pagina faalt | Nu gebruiken `index.html`, `kamer.html`, de deel-link en de trainingshulp allemaal `firebase.js` (nagelopen 21-11) |

## Nog niet gedaan

Afdwingen is niet getest tegen de echte database. Tweestapsverificatie voor het eindbaas-account en de CSP-header (staat op Report-Only) horen bij dezelfde ronde; zie `AVG.md`, restpunt 8.
