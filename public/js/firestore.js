import { db } from './firebase.js';
import { S, updateState } from './state.js';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

/**
 * Load bouwen (coaching layers) for current club
 */
export async function loadBouwen() {
  if (!S.clubId) return [];
  
  try {
    const q = query(
      collection(db, `clubs/${S.clubId}/bouwen`),
      where('deleted', '!=', true)
    );
    const snapshot = await getDocs(q);
    const bouwen = [];
    snapshot.forEach(doc => {
      bouwen.push({ id: doc.id, ...doc.data() });
    });
    updateState({ bouwen });
    return bouwen;
  } catch (err) {
    console.error('Error loading bouwen:', err);
    return [];
  }
}

/**
 * Load teams for current club
 */
export async function loadTeams() {
  if (!S.clubId) return [];
  
  try {
    const q = query(
      collection(db, `clubs/${S.clubId}/teams`),
      where('deleted', '!=', true)
    );
    const snapshot = await getDocs(q);
    const teams = [];
    snapshot.forEach(doc => {
      teams.push({ id: doc.id, ...doc.data() });
    });
    updateState({ teams });
    return teams;
  } catch (err) {
    console.error('Error loading teams:', err);
    return [];
  }
}

/**
 * Load players for a team
 */
export async function loadPlayers(teamId) {
  if (!S.clubId || !teamId) return [];
  
  try {
    const snapshot = await getDocs(
      collection(db, `clubs/${S.clubId}/teams/${teamId}/players`)
    );
    const players = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    updateState({ players });
    return players;
  } catch (err) {
    console.error('Error loading players:', err);
    return [];
  }
}

/**
 * Load matches for a team
 */
export async function loadMatches(teamId) {
  if (!S.clubId || !teamId) return [];
  
  try {
    const snapshot = await getDocs(
      collection(db, `clubs/${S.clubId}/teams/${teamId}/matches`)
    );
    const matches = [];
    snapshot.forEach(doc => {
      matches.push({ id: doc.id, ...doc.data() });
    });
    updateState({ matches });
    return matches;
  } catch (err) {
    console.error('Error loading matches:', err);
    return [];
  }
}

/**
 * Add a new bouw
 */
export async function addBouw(data) {
  if (!S.clubId) return null;
  
  try {
    const docRef = await addDoc(
      collection(db, `clubs/${S.clubId}/bouwen`),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
    await loadBouwen();
    return docRef.id;
  } catch (err) {
    console.error('Error adding bouw:', err);
    return null;
  }
}

/**
 * Update a bouw
 */
export async function updateBouw(bouwId, data) {
  if (!S.clubId) return false;
  
  try {
    const bouwRef = doc(db, `clubs/${S.clubId}/bouwen`, bouwId);
    await updateDoc(bouwRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    await loadBouwen();
    return true;
  } catch (err) {
    console.error('Error updating bouw:', err);
    return false;
  }
}

/**
 * Delete a bouw (soft delete)
 */
export async function deleteBouw(bouwId) {
  if (!S.clubId) return false;
  
  try {
    const bouwRef = doc(db, `clubs/${S.clubId}/bouwen`, bouwId);
    await updateDoc(bouwRef, { deleted: true });
    await loadBouwen();
    return true;
  } catch (err) {
    console.error('Error deleting bouw:', err);
    return false;
  }
}

/**
 * Add a team
 */
export async function addTeam(data) {
  if (!S.clubId) return null;
  
  try {
    const docRef = await addDoc(
      collection(db, `clubs/${S.clubId}/teams`),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
    await loadTeams();
    return docRef.id;
  } catch (err) {
    console.error('Error adding team:', err);
    return null;
  }
}

/**
 * Add a player to a team
 */
export async function addPlayer(teamId, playerData) {
  if (!S.clubId || !teamId) return null;
  
  try {
    const docRef = await addDoc(
      collection(db, `clubs/${S.clubId}/teams/${teamId}/players`),
      {
        ...playerData,
        createdAt: serverTimestamp()
      }
    );
    return docRef.id;
  } catch (err) {
    console.error('Error adding player:', err);
    return null;
  }
}

/**
 * Create a match
 */
export async function createMatch(teamId, matchData) {
  if (!S.clubId || !teamId) return null;
  
  try {
    const docRef = await addDoc(
      collection(db, `clubs/${S.clubId}/teams/${teamId}/matches`),
      {
        ...matchData,
        createdAt: serverTimestamp(),
        status: 'scheduled'
      }
    );
    return docRef.id;
  } catch (err) {
    console.error('Error creating match:', err);
    return null;
  }
}
