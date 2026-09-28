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
src/              # Frontend code
├── index.html
├── main.js
├── firebase.js
├── auth.js
├── state.js
├── firestore.js
├── styles.css
├── manifest.webmanifest
├── sw.js
├── locales/       # i18n files
└── ui/            # UI components

functions/        # Cloud Functions
public/           # Static assets
```
