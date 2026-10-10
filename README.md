# Cluppie 2.0

Multi-tenant SaaS platform for youth football coaching.

## Quick Start

```bash
npm install
firebase login
firebase serve
```

## Stack

- Frontend: Vanilla JS ES modules, PWA
- Backend: Firebase (Firestore, Auth, Storage, Cloud Functions)
- Hosting: Firebase Hosting
- Domains: Subdomains per club (e.g., `asv33.cluppie.io`)

## Architecture

- Multi-tenant: Club-based isolation
- Role-based access (Admin → Coach → Reader)
- Flexible pedagogy model
- i18n support (Dutch + English)

## Project Structure

```
public/            # Alles wat Firebase Hosting serveert (firebase.json: "public")
├── index.html
├── styles.css
├── sw.js          # service worker: moet in de hosting-root staan
├── manifest.webmanifest
└── js/            # alle ES-modules, één map (imports: ./naam.js?v=<release>)
functions/         # Cloud Functions
porteren/          # porteernotities uit ASV'33 (zie PORTEREN.md)
docs/              # achtergronddocumenten
firebase.json  firestore.rules  firestore.indexes.json
PORTEREN.md        # open punten + porteer-log
```

Een release = één versiestring: `?v=` in alle imports en `index.html`, plus `CACHE_VERSIE` in `public/sw.js`.

## Nog niet in de repo

De app verwijst naar bestanden die hier (nog) niet staan. Zonder deze start de app niet:
`public/js/firebase.js` (de echte; de aanwezige is een fase-1 placeholder met een ander exports-set),
`icons.js`, `opkomst.js`, `leerinhoud.js`, `thema.js`, `pwa.js`, de map `icons/`, `content/seed.json` en `over.html`.
