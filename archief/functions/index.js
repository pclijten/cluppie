const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

/**
 * Cloud Function: Create a new club
 * Callable from client - restricted to authenticated users
 */
exports.createClub = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { name, slug, config } = data;
  const userId = context.auth.uid;

  // Validate inputs
  if (!name || !slug) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing name or slug');
  }

  try {
    // Create club document
    const clubRef = await db.collection('clubs').add({
      name,
      slug,
      config: config || {},
      members: [userId],
      memberRoles: {
        [userId]: 'admin'
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
      status: 'active'
    });

    // Create user profile if needed
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      await userRef.set({
        email: context.auth.token.email,
        displayName: context.auth.token.name || 'User',
        clubs: [clubRef.id],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await userRef.update({
        clubs: admin.firestore.FieldValue.arrayUnion(clubRef.id)
      });
    }

    return { clubId: clubRef.id, success: true };
  } catch (error) {
    console.error('Error creating club:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Add member to club
 */
exports.addClubMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { clubId, email, role } = data;
  const userId = context.auth.uid;

  try {
    // Check if user is club admin
    const clubRef = db.collection('clubs').doc(clubId);
    const clubSnap = await clubRef.get();

    if (!clubSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Club not found');
    }

    const clubData = clubSnap.data();
    if (clubData.memberRoles[userId] !== 'admin' && clubData.memberRoles[userId] !== 'club_admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be club admin');
    }

    // Find user by email
    const userRecord = await auth.getUserByEmail(email);
    const newMemberId = userRecord.uid;

    // Add to club
    await clubRef.update({
      members: admin.firestore.FieldValue.arrayUnion(newMemberId),
      [`memberRoles.${newMemberId}`]: role || 'coach'
    });

    // Add to user's clubs
    await db.collection('users').doc(newMemberId).update({
      clubs: admin.firestore.FieldValue.arrayUnion(clubId)
    }).catch(() => {
      // Create user document if doesn't exist
      return db.collection('users').doc(newMemberId).set({
        email,
        clubs: [clubId],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding member:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function: Sync with Sportlink (scheduled)
 * Runs nightly to fetch match data from Sportlink
 */
exports.syncSportlink = functions.pubsub
  .schedule('every day 03:00')
  .timeZone('Europe/Amsterdam')
  .onRun(async (context) => {
    console.log('Starting Sportlink sync');

    try {
      // TODO: Implement Sportlink integration
      // 1. Get all clubs with Sportlink config
      // 2. Fetch match data from Sportlink API
      // 3. Update Firestore

      console.log('Sportlink sync completed');
      return null;
    } catch (error) {
      console.error('Sportlink sync error:', error);
      return null;
    }
  });

/**
 * Cloud Function: Cleanup soft-deleted items
 * Runs monthly to remove old soft-deleted records
 */
exports.cleanupDeletedItems = functions.pubsub
  .schedule('1 of month 04:00')
  .timeZone('Europe/Amsterdam')
  .onRun(async (context) => {
    console.log('Starting cleanup of deleted items');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // TODO: Query and delete old soft-deleted items
      console.log('Cleanup completed');
      return null;
    } catch (error) {
      console.error('Cleanup error:', error);
      return null;
    }
  });

module.exports = {
  exports
};
