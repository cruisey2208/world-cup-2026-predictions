// js/predictions.js

import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  collection
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

// ============================================
// SUBMIT A SINGLE PREDICTION
// ============================================

async function submitPrediction(matchId, predictedWinner, predictedScore) {
  try {
    // Get current user
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("You must be logged in to submit a prediction");
    }

    console.log(`Submitting prediction for match ${matchId}...`);

    // Reference to this user's predictions document
    const userRef = doc(db, "predictions", userId);
    
    // First, check if predictions are locked
    const userPredDoc = await getDoc(userRef);
    
    if (!userPredDoc.exists()) {
      throw new Error("Your predictions document not found");
    }

    if (userPredDoc.data().locked === true) {
      throw new Error("Tournament has started! No more predictions allowed.");
    }

    // Update the specific prediction (nested field)
    // This updates only that match's prediction, doesn't overwrite others
    await updateDoc(userRef, {
      [`predictions.${matchId}`]: {
        predictedWinner: predictedWinner,
        predictedScore: predictedScore,
        timestamp: serverTimestamp()
      },
      lastUpdated: serverTimestamp()
    });

    console.log("✅ Prediction submitted!");
    return true;

  } catch (error) {
    console.error("❌ Error submitting prediction:", error);
    throw error;
  }
}

// ============================================
// GET ALL PREDICTIONS FOR CURRENT USER
// ============================================

async function getUserPredictions() {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("You must be logged in");
    }

    const userPredDoc = await getDoc(doc(db, "predictions", userId));
    
    if (userPredDoc.exists()) {
      return userPredDoc.data().predictions || {};
    }
    return {};

  } catch (error) {
    console.error("❌ Error fetching predictions:", error);
    return {};
  }
}

// ============================================
// GET A SPECIFIC MATCH
// ============================================

async function getMatch(matchId) {
  try {
    const matchDoc = await getDoc(doc(db, "matches", matchId));
    
    if (matchDoc.exists()) {
      return {
        id: matchId,
        ...matchDoc.data()
      };
    }
    return null;

  } catch (error) {
    console.error("❌ Error fetching match:", error);
    return null;
  }
}

// ============================================
// GET ALL MATCHES
// ============================================

async function getAllMatches() {
  try {
    const matchesSnapshot = await getDocs(collection(db, "matches"));
    const matches = [];

    matchesSnapshot.forEach((doc) => {
      matches.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by match date
    matches.sort((a, b) => a.matchDate - b.matchDate);

    return matches;

  } catch (error) {
    console.error("❌ Error fetching matches:", error);
    return [];
  }
}

// ============================================
// GET USER'S PREDICTION FOR A SPECIFIC MATCH
// ============================================

async function getUserPredictionForMatch(matchId) {
  try {
    const allPredictions = await getUserPredictions();
    return allPredictions[matchId] || null;

  } catch (error) {
    console.error("❌ Error fetching user prediction:", error);
    return null;
  }
}

// ============================================
// UPDATE USER'S PREDICTION
// ============================================

async function updatePrediction(matchId, predictedWinner, predictedScore) {
  // Same as submitPrediction - Firebase treats it the same way
  return await submitPrediction(matchId, predictedWinner, predictedScore);
}

export {
  submitPrediction,
  getUserPredictions,
  getMatch,
  getAllMatches,
  getUserPredictionForMatch,
  updatePrediction
};