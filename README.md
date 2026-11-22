# Cluppie.io

Multi-tenant coachplatform voor jeugdvoetbal. Vanilla JS ES-modules PWA + Firebase
(Firestore, Auth, Storage, Cloud Functions in `europe-west1`, project `cluppie-ad329`).
Eén Firebase-project voor alle clubs; per club een document `clubs/{id}` met
`instellingen` die de clubbeheerder in de beheeromgeving aanpast. De website en de app
staan op GitHub Pages (www.cluppie.io).

## Structuur

```
public/            de website en de app (GitHub Pages publiceert deze map)
├── index.html, styles.css, sw.js, manifest.webmanifest, over.html, privacy.html, kamer.html
├── js/            alle app-modules (main.js is de ingang)
├── icons/         PWA-iconen en favicon (Cluppie-logo)
└── content/       seed.json (standaardinhoud voor "begin met een kopie")
functions/         Cloud Functions (AI, Sportlink, mail, teamkamer, opruimen), zie functions/LEESMIJ-deploy.md
firestore.rules    beveiligingsregels Firestore (getest met npm run test:rules)
storage.rules      beveiligingsregels Storage (getest met npm run test:storage)
.github/workflows/ pages.yml (website) en deploy-functions.yml (Cloud Functions)
tools/             deploy-alles.ps1 (rules, indexen, toegang callables), versie.mjs, pariteit.mjs, rooktest.mjs
tests/             npm test (logica), npm run test:rules en test:storage (in de emulator)
docs/              achtergrond: deploy-openstaand.md, appcheck-afdwingen.md, beveiligingsaudit.md, juridisch/
archief/           het oude fase-1-skelet en oude notities
porteren/          patches en notities uit de eerste versie van de app
PORTEREN.md        stand van zaken en open punten per release
VERBETERPLAN.md    review oktober 2026 en wat daaruit gebouwd is
```

## Lokaal draaien

```bash
npm install
cd functions && npm install && cd ..
npx firebase emulators:start      # hosting + firestore (+ functions)
```

## Deployen: drie routes

Alles gaat live vanaf `main`. Er zijn drie routes, elk voor een eigen deel:

| Wat | Hoe | Wanneer |
|---|---|---|
| Website en app (`public/`) | GitHub Actions, `.github/workflows/pages.yml`, naar GitHub Pages | vanzelf bij elke push naar `main` |
| Cloud Functions (`functions/`) | GitHub Actions, `.github/workflows/deploy-functions.yml` | vanzelf bij een push naar `main` die iets in `functions/` wijzigt; met de hand via Actions › Deploy Cloud Functions › Run workflow (eventueel alleen bepaalde functies) |
| Firestore-rules, indexen, Storage-rules en de toegang (invoker `allUsers`) voor callables | `tools/deploy-alles.ps1` op de pc van Paul | met de hand, na een release die rules, indexen of een nieuwe callable bevat |

**Website.** `pages.yml` publiceert `public/` en meldt daarna de gewijzigde publieke pagina's
bij IndexNow (`tools/indexnow.mjs`). Firebase Hosting wordt niet gebruikt; `npm run deploy:hosting`
hoort niet meer bij de route.

**Functions.** De workflow deployt zonder `--force`: zou er een functie verdwijnen, dan stopt de
deploy in plaats van te wissen. Instellingen voor de functions komen uit het secret `FUNCTIONS_ENV`,
inloggen gaat met `FIREBASE_SERVICE_ACCOUNT` en het project met `FIREBASE_PROJECT_ID`. Geheimen als
`ANTHROPIC_API_KEY` en `SMTP_WACHTWOORD` staan in Secret Manager en zet je met
`firebase functions:secrets:set`. De workflow zet geen toegang voor nieuwe callables; zie hieronder.

**Rules, indexen en toegang.** Vanuit de map Cluppie, op `main` en gelijk met GitHub:

```
powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1 -Proef     # alleen tonen
powershell -ExecutionPolicy Bypass -File tools\deploy-alles.ps1            # echt uitvoeren
```

Het script draait eerst `npm test`, `npm run test:rules` en `npm run test:storage` (zonder groen geen
deploy), deployt dan alle functions (acht per keer), zet voor elke callable de invoker `allUsers`
(zonder dat geeft de app een CORS-fout) en deployt als laatste `firestore:rules,firestore:indexes,storage`.
Functions gaan vóór de rules, zoals `AVG.md` voorschrijft. Opnieuw starten is veilig. Zie
`docs/deploy-openstaand.md` voor wat je daarna in de app nakijkt.

## Bij elke release

`node tools/versie.mjs JJJJMMDDx origin/main` (zet `?v=` van alle gewijzigde modules en hun importeurs
en `CACHE_VERSIE` in `public/sw.js`), daarna `npm test`. Wijzigt de release rules, indexen of een nieuwe
callable, noteer dat in `PORTEREN.md` en draai na het mergen `tools/deploy-alles.ps1`.
