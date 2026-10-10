# Samenvoegen lokale lijn + GitHub (release 20261010c)

- Lokale branch `onboarding-avg` (commit 7337525: AVG, onboarding, toegang, tests, fonts, vendor) en GitHub `main` (verwachte speeltijd, speler-overdracht, `js/`-herstructurering uit PR #3) waren uit elkaar gelopen vanaf a71e1dc.
- Samengevoegd met een 3-way merge per bestand (basis a71e1dc). Versienummers genormaliseerd: alles op 20261010c, behalve firebase/icons/opkomst/leerinhoud/thema/pwa op 20260922c.
- **Layout:** de app staat in `public/` (Firebase-hostingmap, zoals `firebase.json` verwacht) met `public/js/`. De platte `js/`-structuur uit PR #3 is daarmee vervangen. `archief/` bevat de oorspronkelijke platte bestanden.
- Extra: speler verwijderen wist ook `vorigeTeams` (AVG).
- Rules: `vorigeTeams` valt onder de `/{sub=**}`-regel van `teams/{teamId}`; schrijven vraagt `magSchrijven` op beide teams.
