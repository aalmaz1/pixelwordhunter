/**
 * firebase-config.js
 * Firebase initialization using dynamic imports so the app stays lightweight.
 */

import { store } from './store.js';

// Firebase config
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCgKKrHIaDNzjUIaK2Z-Usf587px-lPMSY',
  authDomain: 'pixelwordhunter.firebaseapp.com',
  databaseURL: 'https://pixelwordhunter-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'pixelwordhunter',
  storageBucket: 'pixelwordhunter.firebasestorage.app',
  messagingSenderId: '1094897769595',
  appId: '1:1094897769595:web:392a30ef42f3b558b896de',
  measurementId: 'G-X90YSQL16F'
};

let firebaseAuth = null;
let firebaseDb = null;
let firebaseAvailable = false;
let xpUnsubscribe = null;
let authModuleApi = null;
let firestoreModuleApi = null;

export function setupXPListener(userId) {
  if (xpUnsubscribe) {
    xpUnsubscribe();
    xpUnsubscribe = null;
  }

  if (!firebaseDb || !userId || !firestoreModuleApi?.doc || !firestoreModuleApi?.onSnapshot) return;

  const userRef = firestoreModuleApi.doc(firebaseDb, 'users', userId);
  xpUnsubscribe = firestoreModuleApi.onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.xp !== undefined) {
        store.setState({ xp: data.xp });
        console.log(`[XP Sync] XP updated from server: ${data.xp}`);
      }
    }
  }, (error) => {
    console.warn('[XP Sync] Listener error:', error.message);
  });

  console.log('[XP Sync] Real-time listener established for user:', userId);
}

export function cleanupXPListener() {
  if (xpUnsubscribe) {
    xpUnsubscribe();
    xpUnsubscribe = null;
    console.log('[XP Sync] Real-time listener cleaned up');
  }
}

export async function logoutUser() {
  if (!firebaseAuth) return;

  try {
    if (!authModuleApi?.signOut) {
      authModuleApi = await import('firebase/auth');
    }
    await authModuleApi.signOut(firebaseAuth);
    localStorage.removeItem('pixelWordHunter_authMethod');
    cleanupXPListener();
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Logout failed:', error.message);
  }
}

export async function initFirebase() {
  if (firebaseAvailable) {
    return {
      firebaseAuth,
      firebaseDb,
      firebaseAvailable,
      doc: firestoreModuleApi?.doc,
      getDoc: firestoreModuleApi?.getDoc,
      setDoc: firestoreModuleApi?.setDoc,
      serverTimestamp: firestoreModuleApi?.serverTimestamp,
      onSnapshot: firestoreModuleApi?.onSnapshot
    };
  }

  try {
    const firebaseAppModule = await import('firebase/app');
    const firebaseAuthModule = await import('firebase/auth');
    const firestoreModule = await import('firebase/firestore');

    authModuleApi = firebaseAuthModule;
    firestoreModuleApi = firestoreModule;

    const app = firebaseAppModule.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebaseAuthModule.getAuth(app);
    firebaseDb = firestoreModule.initializeFirestore(app, {
      localCache: firestoreModule.persistentLocalCache({
        tabManager: firestoreModule.persistentMultipleTabManager()
      })
    });

    firebaseAvailable = true;
    console.log('✅ Firebase initialized (lazy)');

    const storedAuthMethod = localStorage.getItem('pixelWordHunter_authMethod');
    if (!storedAuthMethod || storedAuthMethod === 'anonymous') {
      firebaseAuthModule.onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          console.log('👤 User signed in:', user.uid);
        } else {
          console.log('⏳ No user detected, signing in anonymously...');
          firebaseAuthModule.signInAnonymously(firebaseAuth)
            .then((result) => {
              console.log('✅ Anonymous sign-in successful:', result.user.uid);
              localStorage.setItem('pixelWordHunter_authMethod', 'anonymous');
            })
            .catch((error) => {
              console.error('❌ Anonymous sign-in failed:', error.code, error.message);
            });
        }
      });
    }
  } catch (error) {
    console.warn('⚠️ Firebase not available - running in offline mode:', error.message);
    firebaseAvailable = false;
  }

  store.setState({ firebaseAvailable });

  if (firebaseAuth && authModuleApi) {
    authModuleApi.onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setupXPListener(user.uid);
      } else {
        cleanupXPListener();
      }
    });
  }

  window.firebaseAuth = firebaseAuth;
  window.firebaseDb = firebaseDb;
  window.firebaseAvailable = firebaseAvailable;

  return {
    firebaseAuth,
    firebaseDb,
    firebaseAvailable,
    doc: firestoreModuleApi?.doc,
    getDoc: firestoreModuleApi?.getDoc,
    setDoc: firestoreModuleApi?.setDoc,
    serverTimestamp: firestoreModuleApi?.serverTimestamp,
    onSnapshot: firestoreModuleApi?.onSnapshot
  };
}

export { firebaseAuth, firebaseDb, firebaseAvailable };
