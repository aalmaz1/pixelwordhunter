/**
 * firebase-config.js
 * Firebase initialization using NPM packages
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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
  onAuthStateChanged(firebaseAuth, (user) => {      
    if (user) {        
      // Пользователь уже вошел (или только что вошел)        
      console.log('👤 User signed in:', user.uid);      
    } else {        
      // Пользователя нет -> выполняем анонимный вход        
      console.log('⏳ No user detected, signing in anonymously...');        
      signInAnonymously(firebaseAuth)          
        .then((result) => {            
          console.log('✅ Anonymous sign-in successful:', result.user.uid);          
        })          
        .catch((error) => {            
          console.error('❌ Anonymous sign-in failed:', error.code, error.message);          
        });      
    }    
  });
  
  } catch (error) {
    console.warn('⚠️ Firebase not available - running in offline mode:', error.message);
    firebaseAvailable = false;
  }
  
  // Sync with store
  store.setState({ firebaseAvailable });
  
  // Export for legacy support if needed
  window.firebaseAuth = firebaseAuth;
  window.firebaseDb = firebaseDb;
  window.firebaseAvailable = firebaseAvailable;

  return { firebaseAuth, firebaseDb, firebaseAvailable };
  }

  export { firebaseAuth, firebaseDb, firebaseAvailable };
