/* ====================================================================
   FIREBASE CONFIG 
   ------------------------------------------------------------------
   Vervang de placeholders hieronder door de config van je nieuwe project:
   Firebase Console → (nieuw project aanmaken) → Project settings →
   "Your apps" → Web app (</>) toevoegen → kopieer het firebaseConfig-object.

   Vergeet niet in datzelfde nieuwe project:
   1. Authentication → Sign-in method → Google én E-mail/Wachtwoord aanzetten.
   2. Firestore-database (default) in europe-west1 en een extra Storage-bucket 'cluppie-ad329-eu' in
      europe-west1 (zie MIGRATIE-EU.md); de standaard-bucket wordt niet gebruikt.
   3. firestore.rules deployen (Firebase CLI: `firebase deploy --only firestore:rules`,
      of plak de inhoud handmatig in Firebase Console → Firestore → Rules).
   4. (optioneel, voor de voetbal.nl-sync) cloud.functions deployen — zie
      LEES-MIJ-DEPLOY.md in de root van deze zip.
==================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyCQdUHv2TjMyPbWYuR9b8ChAe_Z1o8Fmqk",
  authDomain: "cluppie-ad329.firebaseapp.com",
  projectId: "cluppie-ad329",
  storageBucket: "cluppie-ad329.firebasestorage.app",
  messagingSenderId: "776624143952",
  appId: "1:776624143952:web:2fc01a748f5a5a7c415b55",
};

/* [20261011e] AVG: alles in de EU. De database (default) is opnieuw aangemaakt in europe-west1 (België);
   de standaard-bucket van dit project staat in de VS en kan niet verhuizen, dus bestanden staan in een
   extra bucket in europe-west1. Overstap en kopie: zie MIGRATIE-EU.md en tools/migreer-eu.mjs. */
export const STORAGE_BUCKET = 'gs://cluppie-ad329-eu';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously, updateProfile, signOut, onAuthStateChanged,         signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail, sendEmailVerification }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
         collection, doc, addDoc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch,
         getDoc, getDocs, query, where, onSnapshot, serverTimestamp, documentId, increment, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions, httpsCallable }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const app  = initializeApp(firebaseConfig);

/* App Check (reCAPTCHA Enterprise / Fraud Defense, score-sleutel voor cluppie.io): gaat misbruik van
   aansluiten/uitnodigingen door scripts tegen. De sleutel is publiek (staat in elke pagina).
   Pas na een paar dagen meekijken in de console "Enforce" aanzetten voor Functions, Firestore en
   Storage (zie AVG.md). Op localhost geen App Check, anders werkt lokaal testen niet zonder debug-token. */
const APP_CHECK_SITE_KEY = '6LdTROotAAAAAKaG8_4_GAdYfwwlBaPBCnmcz_iN';
if (APP_CHECK_SITE_KEY && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){
  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js")
    .then(m => m.initializeAppCheck(app, { provider: new m.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true }))
    .catch(e => console.warn('[Cluppie] App Check niet gestart', e));
}
const auth = getAuth(app);

/* Offline-persistence aan: langs de lijn met slecht of geen bereik blijft de
   app gewoon werken; wijzigingen synchroniseren automatisch zodra er weer
   verbinding is. Valt terug op de gewone modus als persistence niet kan. */
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn('Offline-persistence niet beschikbaar, terugval op standaard:', e);
  db = getFirestore(app);
}

const storage = getStorage(app, STORAGE_BUCKET);
const functions = getFunctions(app, 'europe-west1');

export {
  app, auth, db, storage,
  /* auth */
  GoogleAuthProvider, OAuthProvider, signInWithPopup, signInAnonymously, updateProfile, signOut, onAuthStateChanged,  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail, sendEmailVerification,
  /* firestore */
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch,
  getDoc, getDocs, query, where, onSnapshot, serverTimestamp, documentId, increment, Timestamp,
  /* storage */
  sRef, uploadBytes, getDownloadURL, deleteObject,
  /* functions */
  functions, httpsCallable,
};
