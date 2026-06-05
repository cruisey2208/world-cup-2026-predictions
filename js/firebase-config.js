// js/firebase-config.js

// Import Firebase SDK (from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase configuration (paste from Firebase Console)

const firebaseConfig = {
  apiKey: "AIzaSyDN7kYZKAYRFL1fWWaHtgXXUHhRdbaFXLU",
  authDomain: "nathans-wc-2026.firebaseapp.com",
  projectId: "nathans-wc-2026",
  storageBucket: "nathans-wc-2026.firebasestorage.app",
  messagingSenderId: "868588354154",
  appId: "1:868588354154:web:32015d8f11cbea99656813",
  measurementId: "G-904CXEJ39R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Firestore Database
export const db = getFirestore(app);

// Export the app in case you need it elsewhere
export default app;