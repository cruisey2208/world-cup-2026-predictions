// js/leaderboard.js

import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

// ============================================
// CALCULATE LEADERBOARD (One-time fetch)
// ============================================

async function getLeaderboard() {
  try {
    // Fetch all data
    const predictionsSnapshot = await getDocs(collection(db, "predictions"));
    const matchesSnapshot = await getDocs(collection(db, "matches"));
    const usersSnapshot = await getDocs(collection(db, "users"));

    // Create lookup maps for easier access
    const matchesMap = {};
    matchesSnapshot.forEach(doc => {
      matchesMap[doc.id] = doc.data();
    });

    const usersMap = {};
    usersSnapshot.forEach(doc => {
      usersMap[doc.id] = doc.data();
    });

    // Calculate scores for each user
    const leaderboard = [];

    predictionsSnapshot.forEach(userDoc => {
      const userId = userDoc.id;
      const userPreds = userDoc.data().predictions || {};
      const userData = usersMap[userId];

      let totalScore = 0;
      let correctPredictions = 0;
      let correctScores = 0;
      let totalPredictions = 0;

      // Check each prediction against actual match results
      Object.entries(userPreds).forEach(([matchId, prediction]) => {
        const match = matchesMap[matchId];

        // Only score if match has finished (has actualWinner)
        if (match && match.actualWinner) {
          totalPredictions++;

          // Correct winner prediction = 3 points
          if (prediction.predictedWinner === match.actualWinner) {
            totalScore += 3;
            correctPredictions++;
          }

          // Correct score = 2 points
          if (prediction.predictedScore === match.actualScore) {
            totalScore += 2;
            correctScores++;
          }
        }
      });

      // Calculate accuracy percentage
      const accuracy = totalPredictions > 0 
        ? ((correctPredictions / totalPredictions) * 100).toFixed(1) 
        : 0;

      leaderboard.push({
        userId: userId,
        username: userData?.username || "Unknown User",
        totalScore: totalScore,
        correctWinners: correctPredictions,
        correctScores: correctScores,
        totalPredictions: totalPredictions,
        accuracy: parseFloat(accuracy)
      });
    });

    // Sort by score (highest first)
    return leaderboard.sort((a, b) => b.totalScore - a.totalScore);

  } catch (error) {
    console.error("❌ Error calculating leaderboard:", error);
    return [];
  }
}

// ============================================
// WATCH LEADERBOARD (Real-time updates)
// ============================================

function watchLeaderboard(callback) {
  try {
    // Set up real-time listener on predictions collection
    const unsubscribe = onSnapshot(collection(db, "predictions"), async (snapshot) => {
      console.log("Predictions updated, recalculating leaderboard...");
      const leaderboard = await getLeaderboard();
      callback(leaderboard);
    });

    // Return unsubscribe function so caller can stop listening if needed
    return unsubscribe;

  } catch (error) {
    console.error("❌ Error watching leaderboard:", error);
    return () => {};
  }
}

// ============================================
// GET USER'S RANK ON LEADERBOARD
// ============================================

async function getUserRank(userId) {
  try {
    const leaderboard = await getLeaderboard();
    const rank = leaderboard.findIndex(user => user.userId === userId);
    return rank >= 0 ? rank + 1 : null;

  } catch (error) {
    console.error("❌ Error fetching user rank:", error);
    return null;
  }
}

export {
  getLeaderboard,
  watchLeaderboard,
  getUserRank
};