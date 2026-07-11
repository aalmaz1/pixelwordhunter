/**
 * firebase-config.js
 * Firebase initialization using NPM packages
 */

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot } from 'firebase/firestore';
import { store } from './store.js';

// Firebase config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCgKKrHIaDNzjUIaK2Z-Usf587px-lPMSY",
  authDomain: "pixelwordhunter.firebaseapp.com",
  databaseURL: "https://pixelwordhunter-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pixelwordhunter",
  storageBucket: "pixelwordhunter.firebasestorage.app",
  messagingSenderId: "1094897769595",
  appId: "1:1094897769595:web:392a30ef42f3b558b896de",
  measurementId: "G-X90YSQL16F"
};

let firebaseAuth = null;
let firebaseDb = null;
let firebaseAvailable = false;
let xpUnsubscribe = null; // Store unsubscribe function for XP listener

/**
 * Sets up real-time listener for XP synchronization across tabs/devices
 */
export function setupXPListener(userId) {
  // Unsubscribe from previous listener if exists
  if (xpUnsubscribe) {
    xpUnsubscribe();
    xpUnsubscribe = null;
  }
  
  if (!firebaseDb || !userId) return;
  
  const userRef = doc(firebaseDb, 'users', userId);
  
  xpUnsubscribe = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.xp !== undefined) {
        // Update local store with server XP value
        store.setState({ xp: data.xp });
        console.log(`[XP Sync] XP updated from server: ${data.xp}`);
      }
    }
  }, (error) => {
    console.warn('[XP Sync] Listener error:', error.message);
  });
  
  console.log('[XP Sync] Real-time listener established for user:', userId);
}

/**
 * Cleans up the XP listener when user logs out
 */
export function cleanupXPListener() {
  if (xpUnsubscribe) {
    xpUnsubscribe();
    xpUnsubscribe = null;
    console.log('[XP Sync] Real-time listener cleaned up');
  }
}

export async function initFirebase() {
  if (firebaseAvailable) return { firebaseAuth, firebaseDb, firebaseAvailable };
  
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = getAuth(app);
    
    // Initialize Firestore with modern persistent cache
    firebaseDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    
    firebaseAvailable = true;
    console.log('✅ Firebase initialized (Bundled)');
  } catch (error) {
    console.warn('⚠️ Firebase not available - running in offline mode:', error.message);
    firebaseAvailable = false;
  }
  
  // Sync with store
  store.setState({ firebaseAvailable });
  
  // Set up auth state listener to manage XP synchronization
  if (firebaseAuth) {
    onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        // User logged in - set up real-time XP listener
        setupXPListener(user.uid);
      } else {
        // User logged out - clean up listener
        cleanupXPListener();
      }
    });
  }
  
  // Export for legacy support if needed
  window.firebaseAuth = firebaseAuth;
  window.firebaseDb = firebaseDb;
  window.firebaseAvailable = firebaseAvailable;

  return { firebaseAuth, firebaseDb, firebaseAvailable };
  }

  export { firebaseAuth, firebaseDb, firebaseAvailable };
