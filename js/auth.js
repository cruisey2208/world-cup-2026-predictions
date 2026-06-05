// js/auth.js

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
  doc, 
  setDoc, 
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

// ============================================
// SIGN UP FUNCTION
// ============================================

async function signup(email, password, username) {
  try {
    // Step 1: Create authentication user
    console.log("Creating auth user...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    console.log("Auth user created with ID:", userId);

    // Step 2: Create user profile document in Firestore
    console.log("Creating user profile document...");
    await setDoc(doc(db, "users", userId), {
      username: username,
      email: email,
      createdAt: serverTimestamp(), // Server timestamp ensures consistency
      bio: "",
      avatar: "",
      totalPredictions: 0
    });

    console.log("User profile created");

    // Step 3: Create user's predictions document
    console.log("Creating predictions document...");
    await setDoc(doc(db, "predictions", userId), {
      locked: false, // Will be set to true when tournament starts
      predictions: {}, // Will store predictions like { match_1: {...}, match_2: {...} }
      lastUpdated: serverTimestamp(),
      totalScore: 0
    });

    console.log("Predictions document created");
    console.log("✅ Signup successful!");
    return userId;

  } catch (error) {
    console.error("❌ Signup error:", error.code, error.message);
    
    // Provide user-friendly error messages
    if (error.code === "auth/email-already-in-use") {
      throw new Error("Email is already registered");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password should be at least 6 characters");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email format");
    }
    throw error;
  }
}

// ============================================
// LOGIN FUNCTION
// ============================================

async function login(email, password) {
  try {
    console.log("Logging in user...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login successful!");
    return userCredential.user;
  } catch (error) {
    console.error("❌ Login error:", error.code, error.message);
    
    if (error.code === "auth/user-not-found") {
      throw new Error("No account found with this email");
    } else if (error.code === "auth/wrong-password") {
      throw new Error("Incorrect password");
    }
    throw error;
  }
}

// ============================================
// LOGOUT FUNCTION
// ============================================

async function logout() {
  try {
    await signOut(auth);
    console.log("✅ Logged out successfully");
  } catch (error) {
    console.error("❌ Logout error:", error);
    throw error;
  }
}

// ============================================
// GET CURRENT USER
// ============================================

function getCurrentUser() {
  return auth.currentUser;
}

// ============================================
// LISTEN TO AUTH CHANGES
// ============================================

function onAuthStateChanged(callback) {
  return firebaseOnAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("User is signed in:", user.uid);
      callback(user);
    } else {
      console.log("User is signed out");
      callback(null);
    }
  });
}

// Export all functions
export { signup, login, logout, getCurrentUser, onAuthStateChanged };
