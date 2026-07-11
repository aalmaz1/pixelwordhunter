# Полное руководство по интеграции Firebase Authentication с базами данных

## 📋 Обзор текущей архитектуры

Ваш проект **Pixel Word Hunter** уже использует:
- ✅ Firebase Authentication (Email/Password + Anonymous)
- ✅ Firestore Database с синхронизацией в реальном времени
- ✅ LocalStorage для офлайн-режима
- ✅ Atomic XP increments для предотвращения race conditions

---

## 🔧 1. Настройка слушателя `onAuthStateChanged`

### Текущая реализация (уже работает правильно)

Файл: `/workspace/app.js` (строки 86-109)

```javascript
// Настраиваем слушатель состояния аутентификации
if (firebaseAuth) {
  onAuthStateChanged(firebaseAuth, async (user) => {
    console.log('[Auth] Auth state changed:', user ? user.uid : 'null');
    store.setUser(user);
    
    if (user) {
      // Пользователь вошёл - загружаем данные с сервера
      console.log('[Auth] User authenticated, loading progress from Firestore...');
      try {
        const progress = await loadProgress(firebaseDb, doc, getDoc);
        applyProgress(progress, true); // true = данные с сервера
        console.log('[Auth] Progress loaded successfully');
      } catch (error) {
        console.error('[Auth] Failed to load progress:', error);
      }
    } else {
      // Пользователь вышел - очищаем состояние
      console.log('[Auth] User logged out, resetting to local data');
      const localProgress = await loadProgressWrapper();
      applyProgress(localProgress, false);
    }
  });
}
```

### ✅ Что работает правильно:
1. Слушатель устанавливается сразу после инициализации Firebase
2. При входе пользователя данные загружаются из Firestore
3. При выходе данные сбрасываются на локальные (LocalStorage)
4. UID пользователя используется как ключ документа

---

## 📥 2. Функция загрузки данных пользователя

### Вариант A: Firestore (текущая реализация)

Файл: `/workspace/storage.js` (строки 43-95)

```javascript
/**
 * Load progress with Cloud Sync priority
 */
export async function loadProgress(firebaseDb, doc, getDoc) {
  const { user, isAuthenticated } = store.getState();
  let progress = {};

  // 1. Try Firebase if authenticated
  if (isAuthenticated && user && firebaseDb && doc && getDoc) {
    try {
      // Ключевой момент: используем user.uid как ID документа
      const userRef = doc(firebaseDb, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const serverData = userSnap.data();
        if (serverData.progress && validateSaveData(serverData.progress)) {
          progress = serverData.progress;
          // Cache for offline use
          storageSet(STORAGE_KEY, JSON.stringify(progress));
          
          // Загружаем XP с сервера и сохраняем локально
          if (serverData.xp !== undefined) {
            const serverXP = Number(serverData.xp) || 0;
            storageSet(`xp_${user.uid}`, String(serverXP));
            store.setState({ xp: serverXP });
            console.log(`[Storage] XP loaded from server: ${serverXP}`);
          }
          
          console.log('[Storage] Cloud sync successful');
          return progress;
        }
      } else {
        // Документ не существует - создадим пустой при первом сохранении
        console.log('[Storage] No user document found, will create on first save');
      }
    } catch (error) {
      console.warn('[Storage] Cloud load failed, using local:', error.message);
    }
  }

  // 2. Fallback to LocalStorage
  const raw = storageGet(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (validateSaveData(parsed)) {
        console.log('[Storage] Local data loaded');
        return parsed;
      }
    } catch {
      console.error('[Storage] Parse error');
    }
  }

  return {};
}
```

### Вариант B: Realtime Database (альтернатива)

Если вы хотите использовать Realtime Database вместо Firestore, создайте новый файл:

```javascript
// firebase-rtdb-loader.js
import { getDatabase, ref, get, set, onValue } from 'firebase/database';

/**
 * Загрузка прогресса из Realtime Database
 * @param {string} uid - UID пользователя
 * @returns {Promise<Object>} Прогресс пользователя
 */
export async function loadUserProgressFromRTDB(uid, db) {
  if (!db || !uid) {
    console.warn('[RTDB] Cannot load progress: missing db or uid');
    return {};
  }

  try {
    // Путь: /users/{uid}/progress
    const progressRef = ref(db, `users/${uid}/progress`);
    const snapshot = await get(progressRef);

    if (snapshot.exists()) {
      const progress = snapshot.val();
      console.log(`[RTDB] Progress loaded for user ${uid}:`, Object.keys(progress).length, 'words');
      
      // Также загружаем XP
      const xpRef = ref(db, `users/${uid}/xp`);
      const xpSnapshot = await get(xpRef);
      const xp = xpSnapshot.exists() ? xpSnapshot.val() : 0;
      
      // Сохраняем XP локально
      localStorage.setItem(`xp_${uid}`, String(xp));
      
      return progress;
    } else {
      console.log('[RTDB] No progress found for user, will create on first save');
      return {};
    }
  } catch (error) {
    console.error('[RTDB] Load progress failed:', error.message);
    return {};
  }
}

/**
 * Сохранение прогресса в Realtime Database
 * @param {string} uid - UID пользователя
 * @param {Object} progress - Объект прогресса
 * @param {number} xp - Очки опыта
 */
export async function saveUserProgressToRTDB(uid, progress, xp, db) {
  if (!db || !uid) {
    console.warn('[RTDB] Cannot save progress: missing db or uid');
    return false;
  }

  try {
    const updates = {};
    
    // Сохраняем прогресс
    updates[`users/${uid}/progress`] = progress;
    updates[`users/${uid}/xp`] = xp;
    updates[`users/${uid}/lastSync`] = Date.now();
    updates[`users/${uid}/updatedAt`] = new Date().toISOString();

    await set(ref(db), updates);
    console.log('[RTDB] Progress saved successfully');
    return true;
  } catch (error) {
    console.error('[RTDB] Save progress failed:', error.message);
    return false;
  }
}

/**
 * Real-time слушатель для синхронизации между вкладками
 * @param {string} uid - UID пользователя
 * @param {Function} callback - Функция обратного вызова при изменении данных
 */
export function subscribeToProgressChanges(uid, db, callback) {
  if (!db || !uid) return null;

  const progressRef = ref(db, `users/${uid}/progress`);
  
  const unsubscribe = onValue(progressRef, (snapshot) => {
    if (snapshot.exists()) {
      const progress = snapshot.val();
      callback(progress);
      console.log('[RTDB] Real-time update received');
    }
  });

  console.log('[RTDB] Real-time listener established');
  return unsubscribe;
}
```

---

## 📤 3. Функция сохранения данных пользователя

### Вариант A: Firestore (текущая реализация)

Файл: `/workspace/storage.js` (строки 112-174)

```javascript
/**
 * Save progress with atomic LocalStorage + Async Firebase
 */
export async function saveProgress(firebaseDb, doc, setDoc, serverTimestamp) {
  const words = getGameData();
  const progress = {};
  
  // Собираем прогресс по всем словам
  words.forEach((w) => {
    if (w.mastery > 0 || w.lastSeen > 0) {
      progress[w.eng] = {
        mastery: w.mastery,
        lastSeen: w.lastSeen,
        correctCount: w.correctCount || 0,
        incorrectCount: w.incorrectCount || 0
      };
    }
  });

  // Local Save (синхронно)
  const newData = JSON.stringify(progress);
  const oldData = storageGet(STORAGE_KEY);
  if (oldData) storageSet(BACKUP_KEY, oldData);
  storageSet(STORAGE_KEY, newData);

  // Firestore Sync (асинхронно, с debouncing)
  const { user, isAuthenticated, xp } = store.getState();
  
  if (isAuthenticated && user && firebaseDb && doc && setDoc && serverTimestamp) {
    // Debounce: ждём 2 секунды перед записью
    if (saveProgress._timeout) clearTimeout(saveProgress._timeout);
    
    saveProgress._timeout = setTimeout(async () => {
      try {
        const userRef = doc(firebaseDb, 'users', user.uid);
        
        // Проверяем существование документа
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          // Создаём новый документ с начальными данными
          await setDoc(userRef, {
            progress,
            xp: xp || 0,
            lastSync: serverTimestamp(),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          }, { merge: true });
          console.log('[Storage] New user document created in Firestore');
        } else {
          // Обновляем существующий документ
          await setDoc(userRef, {
            progress,
            lastSync: serverTimestamp(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log('[Storage] Cloud saved');
        }
        
        storageRemove(BACKUP_KEY);
      } catch (error) {
        console.warn('[Storage] Cloud save failed:', error.message);
      }
    }, 2000);
  }
}
```

### Вариант B: Realtime Database

```javascript
/**
 * Сохранение результатов игры (упрощённая версия)
 * @param {string} uid - UID пользователя
 * @param {number} completed - Количество пройденных вопросов
 * @param {number} total - Общее количество вопросов
 * @param {Object} db - Экземпляр Realtime Database
 */
export async function saveUserProgress(uid, completed, total, db) {
  if (!db || !uid) {
    console.warn('[RTDB] Cannot save: missing db or uid');
    return false;
  }

  try {
    const updates = {};
    const path = `users/${uid}`;
    
    updates[`${path}/completed`] = completed;
    updates[`${path}/total`] = total;
    updates[`${path}/lastSync`] = Date.now();
    updates[`${path}/updatedAt`] = new Date().toISOString();

    await set(ref(db, path), updates);
    console.log(`[RTDB] Saved: ${completed}/${total} for user ${uid}`);
    return true;
  } catch (error) {
    console.error('[RTDB] Save failed:', error.message);
    return false;
  }
}
```

---

## 🔄 4. Интеграция в жизненный цикл игры

### Полный пример инициализации

```javascript
// app.js или main.js

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
// ИЛИ для Realtime Database:
// import { getDatabase, ref, get, set, onValue } from 'firebase/database';

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCgKKrHIaDNzjUIaK2Z-Usf587px-lPMSY",
  authDomain: "pixelwordhunter.firebaseapp.com",
  projectId: "pixelwordhunter",
  storageBucket: "pixelwordhunter.firebasestorage.app",
  messagingSenderId: "1094897769595",
  appId: "1:1094897769595:web:392a30ef42f3b558b896de"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // ИЛИ: const db = getDatabase(app);

let currentUser = null;
let gameProgress = {};

/**
 * Загрузка прогресса при входе пользователя
 */
async function loadUserProgress(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      gameProgress = data.progress || {};
      
      // Обновляем UI с загруженными данными
      updateGameUI(gameProgress);
      console.log('✅ Progress loaded:', Object.keys(gameProgress).length, 'words');
    } else {
      console.log('ℹ️ New user, starting fresh');
      gameProgress = {};
    }
  } catch (error) {
    console.error('❌ Load failed:', error);
    gameProgress = {};
  }
}

/**
 * Сохранение прогресса после завершения раунда
 */
async function saveUserProgress(completed, total) {
  if (!currentUser) {
    console.warn('⚠️ No user logged in, saving locally only');
    saveProgressLocally(gameProgress);
    return;
  }

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    
    await setDoc(userRef, {
      progress: gameProgress,
      completedQuestions: completed,
      totalQuestions: total,
      lastPlayed: serverTimestamp(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('✅ Progress saved to cloud');
  } catch (error) {
    console.error('❌ Save failed:', error);
    // Fallback to local storage
    saveProgressLocally(gameProgress);
  }
}

/**
 * Главный слушатель аутентификации
 */
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Пользователь вошёл
    currentUser = user;
    console.log('👤 User authenticated:', user.email, 'UID:', user.uid);
    
    // Загружаем прогресс СРАЗУ после входа
    loadUserProgress(user.uid);
    
    // Показываем игровой интерфейс
    showGameInterface();
  } else {
    // Пользователь вышел
    currentUser = null;
    console.log('👋 User logged out');
    
    // Загружаем локальный прогресс (гостевой режим)
    gameProgress = loadProgressFromLocalStorage();
    
    // Показываем экран входа
    showLoginScreen();
  }
});

/**
 * Инициализация игры
 */
async function initGame() {
  console.log('🎮 Game initializing...');
  
  // Ждём определения состояния аутентификации
  // onAuthStateChanged сработает автоматически
  
  // Загружаем игровые данные
  await loadGameData();
  
  // Рендерим начальный экран
  renderMainMenu();
}

/**
 * Обработчик завершения раунда
 */
function onRoundComplete(roundStats) {
  const { completed, total, score } = roundStats;
  
  // Обновляем локальный прогресс
  updateLocalProgress(roundStats);
  
  // Сохраняем в облако
  if (currentUser) {
    saveUserProgress(completed, total);
  } else {
    saveProgressLocally(gameProgress);
  }
  
  // Показываем результаты
  showRoundResults(score);
}

// Запуск игры
initGame();
```

---

## 🧪 5. Проверка изоляции данных пользователей

### Тест 1: Вход под разными аккаунтами

```javascript
// Откройте DevTools Console (F12) и выполните:

// 1. Проверьте текущего пользователя
console.log('Current user:', firebase.auth().currentUser);
// Ожидаемый вывод: { uid: "abc123...", email: "user1@example.com" }

// 2. Проверьте путь к данным
const uid = firebase.auth().currentUser.uid;
console.log('Data path:', `users/${uid}`);
// Ожидаемый вывод: "users/abc123XYZ..."

// 3. Выйдите и войдите под другим аккаунтом
await firebase.auth().signOut();
await firebase.auth().signInWithEmailAndPassword('user2@example.com', 'password');

// 4. Убедитесь, что UID изменился
const newUid = firebase.auth().currentUser.uid;
console.log('New user UID:', newUid);
// UID должен отличаться от предыдущего
```

### Тест 2: Проверка в Firebase Console

1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Выберите проект `pixelwordhunter`
3. Перейдите в **Authentication** → **Users**
4. Найдите пользователей:
   - `becoda5573@pckage.com` → скопируйте UID
   - Другой пользователь → скопируйте UID
5. Перейдите в **Firestore Database**
6. Проверьте коллекцию `users`:
   - Должны быть документы с именами = UID пользователей
   - Каждый документ содержит только данные соответствующего пользователя

### Тест 3: Автоматическая проверка в коде

```javascript
/**
 * Функция для проверки изоляции данных
 */
async function verifyDataIsolation() {
  const user1 = await signInAndGetProgress('user1@example.com', 'password1');
  const user2 = await signInAndGetProgress('user2@example.com', 'password2');
  
  console.log('User 1 progress keys:', Object.keys(user1.progress));
  console.log('User 2 progress keys:', Object.keys(user2.progress));
  
  // Проверка: данные не должны пересекаться
  const hasOverlap = Object.keys(user1.progress).some(key => 
    key in user2.progress
  );
  
  if (hasOverlap && Object.keys(user1.progress).length > 0) {
    console.error('❌ DATA LEAK DETECTED! Users share progress!');
  } else {
    console.log('✅ Data isolation verified');
  }
}
```

---

## 📊 6. Структура базы данных

### Firestore (рекомендуется)

```
(pixelwordhunter)
└── users (collection)
    ├── {uid_1} (document)
    │   ├── createdAt: "2025-01-15T10:30:00.000Z"
    │   ├── updatedAt: "2025-01-15T14:45:00.000Z"
    │   ├── lastSync: timestamp(2025-01-15T14:45:00.000Z)
    │   ├── xp: 1250
    │   └── progress: map {
    │         "apple": {
    │           mastery: 3,
    │           lastSeen: 1736949600000,
    │           correctCount: 5,
    │           incorrectCount: 1
    │         },
    │         "banana": { ... }
    │       }
    ├── {uid_2} (document)
    │   └── ...
    └── {uid_3} (document)
        └── ...
```

### Realtime Database (альтернатива)

```json
{
  "users": {
    "{uid_1}": {
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T14:45:00.000Z",
      "lastSync": 1736949900000,
      "xp": 1250,
      "progress": {
        "apple": {
          "mastery": 3,
          "lastSeen": 1736949600000,
          "correctCount": 5,
          "incorrectCount": 1
        },
        "banana": { ... }
      },
      "stats": {
        "completed": 45,
        "total": 100,
        "accuracy": 0.87
      }
    },
    "{uid_2}": { ... }
  }
}
```

---

## 🔐 7. Правила безопасности Firestore

### Рекомендуемые правила

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Пользователи могут читать/записывать только свои данные
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Запрет доступа ко всем остальным коллекциям
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Как установить:

1. Firebase Console → **Firestore Database** → **Rules**
2. Замените существующие правила на приведённые выше
3. Нажмите **Publish**
4. Протестируйте с разными пользователями

---

## 🐛 8. Диагностика проблем

### Проблема: Данные не загружаются при входе

**Симптомы:**
```
[Auth] Auth state changed: abc123...
[Storage] No user document found
```

**Решение:**
```javascript
// Добавьте принудительную загрузку после входа
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('User logged in, forcing data load...');
    
    // Небольшая задержка для полной инициализации
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const progress = await loadUserProgress(user.uid);
    applyProgress(progress);
  }
});
```

### Проблема: Данные одного пользователя видны другому

**Проверка:**
```javascript
// В консоли браузера выполните:
console.log('Current UID:', firebase.auth().currentUser?.uid);
console.log('LocalStorage XP key:', `xp_${firebase.auth().currentUser?.uid}`);

// Очистите кэш localStorage
localStorage.clear();
location.reload();
```

### Проблема: XP не обновляется в реальном времени

**Проверка listener'а:**
```javascript
// В firebase-config.js убедитесь, что listener активен:
console.log('[XP Sync] Listener status:', xpUnsubscribe ? 'ACTIVE' : 'INACTIVE');

// Переподключите listener вручную
setupXPListener(firebase.auth().currentUser?.uid);
```

---

## 📈 9. Мониторинг и отладка

### Логирование всех операций

```javascript
// Добавьте в начало app.js
const DEBUG = true;

function debugLog(category, message, data = null) {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}] [${category}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// Использование:
debugLog('AUTH', 'User logged in', { uid: user.uid, email: user.email });
debugLog('STORAGE', 'Progress loaded', { wordCount: Object.keys(progress).length });
debugLog('GAME', 'Round complete', { score, completed, total });
```

### Проверка в Firebase Console

1. **Firestore Dashboard**:
   - Перейдите в **Firestore Database**
   - Проверьте коллекцию `users`
   - Убедитесь, что документы создаются с правильными UID

2. **Usage Statistics**:
   - **Project Overview** → **Usage**
   - Отслеживайте количество чтений/записей
   - Spark Plan: 50,000 reads/day, 20,000 writes/day

3. **Authentication Logs**:
   - **Authentication** → **Users**
   - Фильтруйте по дате входа
   - Проверяйте email и UID

---

## ✅ Чеклист проверки

- [ ] Firebase инициализирован корректно
- [ ] `onAuthStateChanged` слушатель установлен
- [ ] При входе пользователя вызывается `loadUserProgress(uid)`
- [ ] Данные загружаются из пути `/users/{uid}`
- [ ] При завершении игры вызывается `saveUserProgress()`
- [ ] Данные сохраняются с привязкой к UID
- [ ] LocalStorage используется как fallback
- [ ] Правила безопасности Firestore настроены
- [ ] Данные разных пользователей изолированы
- [ ] XP синхронизируется между вкладками (real-time listener)
- [ ] Логи показывают правильные UID

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи в консоли браузера (F12)
2. Убедитесь, что Firebase настроен правильно
3. Проверьте правила безопасности Firestore
4. Очистите localStorage и кэш браузера
5. Перезагрузите страницу с Ctrl+Shift+R

**Полезные команды для отладки:**

```javascript
// Проверить текущего пользователя
firebase.auth().currentUser

// Проверить наличие документа в Firestore
const db = firebase.firestore();
doc(db, 'users', firebase.auth().currentUser.uid).get()
  .then(snap => console.log('Exists:', snap.exists, 'Data:', snap.data()));

// Очистить localStorage
localStorage.clear();

// Принудительно перезагрузить прогресс
loadUserProgress(firebase.auth().currentUser.uid);
```
