import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxx", // Replace with actual
  projectId: "cluppie-2-0",
  authDomain: "cluppie-2-0.firebaseapp.com",
  databaseURL: "https://cluppie-2-0.firebaseio.com",
  storageBucket: "cluppie-2-0.appspot.com",
  messagingSenderId: "xxxxxxxxxx",
  appId: "1:xxxxxxxxxx:web:xxxxxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
