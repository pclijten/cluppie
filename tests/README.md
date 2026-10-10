# Tests (serverlogica)
`toegang.test.js` draait de onboarding-functies (uitnodigingen, aanvragen, rollen, uitschrijven, rate limit) tegen een kleine in-memory Firestore-mock.
Draaien vanuit deze map, met `firebase-functions` en `firebase-admin` bereikbaar (bijv. `cd ../functions && npm i`, daarna `NODE_PATH=../functions/node_modules node toegang.test.js`).
Dit is GEEN test van de rules of de UI: gebruik daarvoor `firebase emulators:start`.
