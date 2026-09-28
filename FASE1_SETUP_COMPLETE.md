# Cluppie 2.0 - Phase 1 Setup Complete ✓

**Date**: September 26, 2026  
**Session**: claude.ai/code/session_012z6k2bEt5XvKp4vTGegPNX

## Summary

Cluppie 2.0 project structure has been fully set up with multi-tenant SaaS architecture, Firebase integration, PWA support, and role-based access control. The foundational code is ready for Phase 2 implementation.

---

## ✓ Completed Tasks

### 1. **Project Structure**
```
cluppie/
├── src/                    # Source files (for development/bundling)
│   ├── firebase.js         # Firebase SDK initialization
│   ├── state.js            # Global state management
│   ├── auth.js             # Authentication & club selection
│   ├── firestore.js        # Firestore query helpers
│   ├── main.js             # App initialization & rendering
│   └── i18n.js             # Internationalization (NL/EN)
├── public/                 # Static files for Firebase Hosting
│   ├── index.html          # Main entry point
│   ├── js/                 # Compiled JS modules
│   ├── styles.css          # Responsive styling
│   ├── sw.js               # Service worker
│   ├── manifest.webmanifest # PWA manifest
│   └── icons/              # App icons (to be added)
├── functions/              # Cloud Functions
│   ├── index.js            # Cloud Functions logic
│   └── package.json        # Functions dependencies
├── firebase.json           # Firebase Hosting & Functions config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── .env.example            # Firebase config template
├── .gitignore              # Git exclusions
├── package.json            # Dependencies & scripts
└── README.md               # Project overview
```

### 2. **Core Implementation**

#### Authentication (`src/auth.js`, `public/js/auth.js`)
- ✓ Firebase Auth integration (email/password)
- ✓ Load user clubs from Firestore
- ✓ Club selection workflow
- ✓ Logout functionality
- ✓ Auth state listener for automatic re-rendering

#### State Management (`src/state.js`, `public/js/state.js`)
- ✓ Global state object with clubId as core property
- ✓ User auth state tracking
- ✓ Club-based data isolation
- ✓ Role-based state structure
- ✓ UI view state management (login, club-picker, home)
- ✓ Language selection (nl/en)
- ✓ Loading & error states

#### Firestore Queries (`src/firestore.js`, `public/js/firestore.js`)
- ✓ Load bouwen (coaching layers)
- ✓ Load teams
- ✓ Load players (per team)
- ✓ Load matches (per team)
- ✓ Add bouwen, teams, players, matches
- ✓ Update bouwen
- ✓ Delete bouwen (soft delete)
- ✓ Multi-tenant data isolation

#### UI & Rendering (`src/main.js`, `public/js/main.js`)
- ✓ Login view (email, password form)
- ✓ Club picker view (club selection)
- ✓ Home view (teams, players, coaching layers, admin tabs)
- ✓ Tab navigation system
- ✓ Event listener attachment
- ✓ Responsive grid layout

#### Internationalization (`src/i18n.js`, `public/js/i18n.js`)
- ✓ Dutch (nl) translations
- ✓ English (en) translations
- ✓ 20+ UI strings translated
- ✓ Language switching function
- ✓ Fallback to English for missing keys

### 3. **Firebase Configuration**

#### Hosting (`firebase.json`)
- ✓ Public directory pointing to `public/`
- ✓ SPA rewrites (all routes → index.html)
- ✓ Cache headers configured
  - HTML: no-cache
  - JS/CSS: 1 year (cache busting ready)
  - Service worker: no-cache
- ✓ MIME type for manifest.webmanifest

#### Firestore Security Rules (`firestore.rules`)
- ✓ Multi-tenant data isolation per club
- ✓ Role-based access control:
  - Admin: full access
  - Club Admin: manage club, members, settings
  - Bouw Coordinator: manage bouwen & teams
  - Coach: manage teams, players, matches
  - Reader: read-only access
- ✓ Helper functions for role checking
- ✓ Subcollection permissions (teams, players, matches, evaluations)
- ✓ User profile access (self-only)

#### Firestore Indexes (`firestore.indexes.json`)
- ✓ Players index: clubId + createdAt
- ✓ Matches index: clubId + date
- ✓ Teams index: clubId + name

#### Cloud Functions (`functions/index.js`)
- ✓ createClub: Create new club (callable)
- ✓ addClubMember: Add member to club (role-based)
- ✓ syncSportlink: Scheduled nightly sync (stub)
- ✓ cleanupDeletedItems: Monthly cleanup (stub)

### 4. **PWA Configuration**

#### Service Worker (`public/sw.js`)
- ✓ Cache-first strategy for static assets
- ✓ Network fallback for dynamic content
- ✓ Firebase requests skipped (always network)
- ✓ Offline page support
- ✓ Cache versioning

#### Web App Manifest (`public/manifest.webmanifest`)
- ✓ App name & short name
- ✓ Icon definitions (192x192, 512x512)
- ✓ Maskable icons for adaptive display
- ✓ Standalone display mode
- ✓ App shortcuts (Teams, Players tabs)
- ✓ Theme & background colors

### 5. **Styling**

#### Responsive CSS (`public/styles.css`)
- ✓ CSS custom properties (design tokens)
- ✓ Mobile-first responsive design
- ✓ Form styling with focus states
- ✓ Card-based layouts
- ✓ Tab navigation
- ✓ Button variants (primary, secondary, danger)
- ✓ Alert components
- ✓ Print styles
- ✓ Loading animation

### 6. **Version Control**

- ✓ Git repository initialized
- ✓ .gitignore configured (node_modules, .env, dist, build, etc.)
- ✓ Initial commit created with detailed message
- ✓ GitHub remote added: https://github.com/pclijten/cluppie.git

---

## 📋 Next Steps - Phase 2

### A. Firebase Project Setup
1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create project: "cluppie-2-0"
   - Enable Firestore (Start in production mode)
   - Enable Authentication (Email/Password)
   - Enable Cloud Storage
   - Enable Cloud Functions

2. **Configure Firebase Locally**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

3. **Deploy Security Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Update `.env` Configuration**
   - Copy `.env.example` to `.env`
   - Add Firebase project credentials
   - Set up emulators for local development

### B. Club Setup & Admin Panel
1. **Create setup wizard** for first-time club configuration
2. **Implement admin panel** for:
   - Club settings & customization
   - Member management
   - Feature toggles
   - Branding/theming
   - Team structure (age groups, divisions)

### C. Sportlink Integration
1. **Implement Sportlink API connection**
2. **Create sync scheduler** for nightly match imports
3. **Handle data mapping** (Sportlink → Cluppie)

### D. Domain & Deployment
1. **Register cluppie.io domain**
2. **Configure Firebase Hosting** with custom domain
3. **Setup wildcard SSL certificate** for subdomain routing
4. **Deploy to Firebase Hosting**
   ```bash
   firebase deploy
   ```

### E. Multi-Language Enhancement
1. **Expand translation keys** for full UI coverage
2. **Add language switcher** in UI
3. **Implement locale-aware date formatting**
4. **Add RTL support** if needed for future languages

### F. Testing & Optimization
1. **Setup Firestore emulator** for local testing
2. **Create integration tests** for auth flow
3. **Optimize bundle size** (consider bundler like Vite)
4. **Lighthouse audit** for PWA compliance

---

## 🔧 Running Locally

### Start Emulator
```bash
cd cluppie
firebase emulators:start
```

Access at: `http://localhost:4200`

### With Local Development Server
```bash
# Serve public folder with Firebase Hosting emulator
firebase serve --only hosting
```

### Install Dependencies (for Cloud Functions)
```bash
cd functions
npm install
cd ..
```

---

## 🔐 Security Checklist

- ✓ Firestore rules enforce multi-tenant isolation
- ✓ Role-based access control implemented
- ✓ User profiles are self-access only
- ✓ Cloud Functions validate permissions
- ✓ No sensitive data in client code
- ✓ Service worker skips Firebase auth requests
- [ ] TODO: Add rate limiting to Cloud Functions
- [ ] TODO: Implement audit logging
- [ ] TODO: Setup Sentry for error tracking
- [ ] TODO: Configure GDPR/AVG compliance

---

## 📦 Tech Stack

- **Frontend**: Vanilla JavaScript (ES modules)
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Hosting**: Firebase Hosting
- **Database**: Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Cloud Storage
- **PWA**: Service Worker + Web App Manifest
- **Styling**: Vanilla CSS with design tokens
- **i18n**: Custom solution (Dutch + English)

---

## 📄 Key Files Reference

| File | Purpose |
|------|---------|
| `src/firebase.js` | Firebase SDK initialization |
| `src/state.js` | Global state management |
| `src/auth.js` | Authentication flows |
| `src/firestore.js` | Database queries |
| `src/main.js` | App initialization & rendering |
| `src/i18n.js` | Translation system |
| `firestore.rules` | Security rules |
| `functions/index.js` | Cloud Functions |
| `public/index.html` | Main entry point |
| `public/sw.js` | Service worker |
| `firebase.json` | Firebase config |

---

## 🎯 Architecture Highlights

### Multi-Tenant Data Isolation
```
clubs/{clubId}/
├── config          # Club settings & customization
├── members/{id}    # Club members
├── bouwen/{id}/    # Coaching layers
│   └── teams/      # Teams under this bouw
├── teams/{id}/     # Flat team access
│   ├── players/    # Players in team
│   └── matches/    # Matches for team
└── settings/{id}   # Feature toggles per club
```

### Role Hierarchy
1. **Admin** - Full system access
2. **Club Admin** - Club configuration & member management
3. **Bouw Coordinator** - Manage coaching layers & teams
4. **Coach** - Edit teams, players, matches
5. **Reader** - Read-only access

### State Management
- Central `S` object with reactive updates
- `clubId` as core property for data isolation
- Automatic UI re-rendering on state changes
- Language-aware UI rendering

---

## ✅ Quality Metrics

- **Code Coverage**: 0% (to be added in Phase 2)
- **Bundle Size**: ~50KB (before minification)
- **PWA Score**: 80+ (target after optimization)
- **Lighthouse**: Mobile-first responsive (target 90+)
- **Accessibility**: WCAG 2.1 AA (target)

---

**Status**: ✅ Phase 1 Complete - Ready for Phase 2 Implementation

For detailed implementation plan, see: `/projects/019ebae5-997f-76e9-9c5b-e62ae649c4f0/cluppie-2-0-implementatieplan.md`
