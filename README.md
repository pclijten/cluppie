# Cluppie.io

Multi-tenant coachplatform voor jeugdvoetbal. Vanilla JS ES-modules PWA + Firebase
(Firestore, Auth, Storage, Cloud Functions in `europe-west1`). Eén Firebase-project
voor alle clubs; per club een document `clubs/{id}` met `instellingen` die de
clubbeheerder in de beheeromgeving aanpast.

## Structuur

```
public/            hosting-root (firebase.json → "public")
├── index.html, styles.css, sw.js, manifest.webmanifest, over.html, readme.html
├── js/            alle app-modules (main.js is de ingang)
├── icons/         PWA-iconen en favicon (Cluppie-logo)
└── content/       seed.json (standaardinhoud voor "begin met een kopie")
functions/         Cloud Functions (AI, Sportlink-sync, opruimen) — zie LEESMIJ-deploy.md
firestore.rules    beveiligingsregels (ONGETEST — eerst in de emulator draaien)
_fase1-backup/     het oude fase-1-skelet (src/, oude public/, oude rules)
porteren/          patches en notities uit de eerste versie van de app
PORTEREN.md        open punten en deploy-volgorde per release
VERBETERPLAN.md    review oktober 2026 en wat daaruit gebouwd is
tools/             versie.mjs (release-versies zetten), pariteit.mjs (vergelijken met ASV'33)
tests/             npm test (logica) en npm run test:rules (Firestore-rules in de emulator)
```

## Lokaal draaien

```bash
npm install
npx firebase emulators:start      # hosting + firestore (+ functions)
```

## Deployen (pas na test in de emulator)

```bash
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions:chatHulp,functions:structureerTraining   # per functie, zie functions/LEESMIJ-deploy.md
```

Bij elke release: `node tools/versie.mjs JJJJMMDDx` (zet `?v=` van alle gewijzigde modules en hun importeurs en `CACHE_VERSIE` in `public/sw.js`), daarna `npm test`.
