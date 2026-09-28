import { auth, db } from './firebase.js';
import { S, updateState } from './state.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc, query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

/**
 * Load clubs where user is a member
 */
export async function loadUserClubs() {
  if (!S.user || !S.userId) return [];
  
  try {
    // Query clubs where user is in members array
    const clubsRef = collection(db, 'clubs');
    const q = query(clubsRef, where('members', 'array-contains', S.userId));
    const snapshot = await getDocs(q);
    
    const clubs = [];
    snapshot.forEach(doc => {
      clubs.push({
        id: doc.id,
        name: doc.data().name,
        role: doc.data().memberRoles?.[S.userId] || 'reader'
      });
    });
    
    updateState({ clubs });
    return clubs;
  } catch (err) {
    console.error('Error loading clubs:', err);
    updateState({ error: err.message });
    return [];
  }
}

/**
 * Select a club and load its config
 */
export async function selectClub(clubId) {
  if (!clubId) return false;
  
  try {
    updateState({ loading: true });
    
    const clubRef = doc(db, 'clubs', clubId);
    const clubSnap = await getDoc(clubRef);
    
    if (!clubSnap.exists()) {
      throw new Error('Club not found');
    }
    
    const clubData = clubSnap.data();
    updateState({
      clubId,
      clubConfig: clubData,
      view: 'home',
      loading: false
    });
    
    return true;
  } catch (err) {
    console.error('Error selecting club:', err);
    updateState({ error: err.message, loading: false });
    return false;
  }
}

/**
 * Initialize auth listener
 */
export function setupAuthListener(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      updateState({
        user,
        userId: user.uid,
        view: 'club-picker'
      });
      await loadUserClubs();
    } else {
      updateState({
        user: null,
        userId: null,
        view: 'login'
      });
    }
    
    if (onReady) onReady();
  });
}

/**
 * Register new user
 */
export async function registerUser(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, uid: cred.user.uid };
  } catch (err) {
    updateState({ error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Login user
 */
export async function loginUser(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (err) {
    updateState({ error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Logout
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    updateState({ error: err.message });
    return { success: false, error: err.message };
  }
}
