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
index.html, styles.css, sw.js, manifest.webmanifest   # app-schil (sw.js moet in de root staan)
js/               # alle JS-modules (ES modules, geladen via js/main.js)
icons/            # PWA-iconen en logo's
content/          # seed.json (standaardinhoud)
over.html, readme.html
functions/        # Cloud Functions
porteren/         # porteerdocumenten ASV'33 -> cluppie.io (zie PORTEREN.md)
public/, src/     # oude fase-1 stubs, niet in gebruik door de app
```
