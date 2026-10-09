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
├── icons/         PWA-iconen (let op: nu nog de ASV'33-set)
└── content/       seed.json (standaardinhoud voor "begin met een kopie")
functions/         Cloud Functions (AI, Sportlink-sync, opruimen) — zie LEESMIJ-deploy.md
firestore.rules    beveiligingsregels (ONGETEST — eerst in de emulator draaien)
_fase1-backup/     het oude fase-1-skelet (src/, oude public/, oude rules)
porteren/          patches en notities uit ASV'33
PORTEREN.md        open punten
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

Bij elke release: verhoog `?v=` in `index.html`/modules én `CACHE_VERSIE` in `public/sw.js`.
