# 🚀 Быстрая шпаргалка: Firebase + Прогресс пользователя

## 1️⃣ Минимальный рабочий код (Firestore)

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = { /* ваши настройки */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// 🔴 ГЛАВНЫЙ СЛУШАТЕЛЬ - срабатывает при входе/выходе
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log('✅ Вошёл:', user.email, 'UID:', user.uid);
    
    // Загружаем прогресс ИЗ FIRESTORE
    const progress = await loadUserProgress(user.uid);
    applyToGame(progress);
  } else {
    currentUser = null;
    console.log('👋 Вышел');
    // Загружаем из localStorage (гостевой режим)
    const progress = JSON.parse(localStorage.getItem('save') || '{}');
    applyToGame(progress);
  }
});

// 📥 ЗАГРУЗКА из Firestore
async function loadUserProgress(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  
  if (snap.exists()) {
    const data = snap.data();
    console.log('📊 Загружено слов:', Object.keys(data.progress || {}).length);
    return data.progress || {};
  }
  return {};
}

// 📤 СОХРАНЕНИЕ в Firestore
async function saveUserProgress(progress, xp = 0) {
  if (!currentUser) return;
  
  const userRef = doc(db, 'users', currentUser.uid);
  await setDoc(userRef, {
    progress,
    xp,
    lastSync: new Date().toISOString()
  }, { merge: true });
  
  console.log('💾 Сохранено в облако');
}

// 🎮 Пример использования в игре
function onGameComplete(completed, total, score) {
  const progress = collectGameProgress(); // ваша функция
  
  // Сохраняем локально (быстро)
  localStorage.setItem('save', JSON.stringify(progress));
  
  // Сохраняем в облако (асинхронно)
  if (currentUser) {
    saveUserProgress(progress, score);
  }
}
```

---

## 2️⃣ Realtime Database (альтернатива)

```javascript
import { getDatabase, ref, get, set } from 'firebase/database';

const db = getDatabase(app);

// Загрузка
async function loadUserProgress(uid) {
  const snap = await get(ref(db, `users/${uid}/progress`));
  return snap.exists() ? snap.val() : {};
}

// Сохранение
async function saveUserProgress(uid, completed, total) {
  await set(ref(db, `users/${uid}`), {
    completed,
    total,
    lastSync: Date.now()
  });
}
```

---

## 3️⃣ Структура данных в Firestore

```
users/{UID}/
├── createdAt: "2025-01-15T10:30:00.000Z"
├── updatedAt: "2025-01-15T14:45:00.000Z"
├── lastSync: timestamp
├── xp: 1250
└── progress: {
      "apple": { mastery: 3, correctCount: 5, incorrectCount: 1 },
      "banana": { mastery: 2, correctCount: 3, incorrectCount: 2 }
    }
```

---

## 4️⃣ Проверка работы

### В консоли браузера (F12):

```javascript
// 1. Проверить текущего пользователя
firebase.auth().currentUser
// → { uid: "abc123...", email: "user@example.com" }

// 2. Проверить документ в Firestore
const db = firebase.firestore();
const uid = firebase.auth().currentUser.uid;
doc(db, 'users', uid).get().then(snap => {
  console.log('Exists:', snap.exists());
  console.log('Data:', snap.data());
});

// 3. Очистить кэш и перезагрузиться
localStorage.clear();
location.reload();
```

### В Firebase Console:

1. **Authentication** → **Users** → найти email → скопировать UID
2. **Firestore Database** → коллекция `users` → документ `{UID}`
3. Убедиться, что поля `progress` и `xp` заполнены

---

## 5️⃣ Правила безопасности

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

---

## 6️⃣ Тест на изоляцию данных

```javascript
// Войдите как user1@example.com → пройдите 5 вопросов
// Выйдите → войдите как user2@example.com
// Прогресс должен быть НОВЫМ (пустым)

// Проверка в консоли:
console.log('UID 1:', uid1);
console.log('UID 2:', uid2);
console.log('Изоляция:', uid1 !== uid2 ? '✅' : '❌');
```

---

## 7️⃣ Частые ошибки

| Проблема | Решение |
|----------|---------|
| Данные не загружаются | Проверьте `onAuthStateChanged` - он должен вызываться ДО начала игры |
| Прогресс одинаковый у всех | Убедитесь, что используете `user.uid`, а не фиксированный ID |
| XP не сохраняется | Проверьте правила Firestore и наличие `currentUser` |
| Данные пропадают при выходе | Это нормально - при выходе загружаются локальные данные |

---

## 8️⃣ Логи для отладки

Добавьте в код:

```javascript
console.log('[AUTH] User:', user?.email, 'UID:', user?.uid);
console.log('[STORAGE] Load from:', currentUser ? 'Firestore' : 'LocalStorage');
console.log('[STORAGE] Save to:', currentUser ? 'Firestore' : 'LocalStorage');
console.log('[GAME] Progress:', Object.keys(progress).length, 'words');
```

Ожидаемый вывод при входе:
```
[Auth] Auth state changed: abc123XYZ...
[Auth] User authenticated, loading progress from Firestore...
[Storage] Cloud sync successful
[Storage] XP loaded from server: 150
[App] Progress applied: 25 words, XP: 150
```

---

## ✅ Чеклист

- [ ] `onAuthStateChanged` установлен
- [ ] При входе вызывается `loadUserProgress(uid)`
- [ ] Путь к данным: `users/{uid}`
- [ ] При выходе загружается localStorage
- [ ] `saveUserProgress()` вызывается после каждого раунда
- [ ] Правила безопасности настроены
- [ ] Разные пользователи видят разный прогресс

---

## 📞 Если что-то не работает

1. Откройте DevTools (F12) → Console
2. Посмотрите логи с префиксами `[Auth]`, `[Storage]`
3. Проверьте, что UID в логах совпадает с UID в Firebase Console
4. Очистите localStorage: `localStorage.clear()`
5. Перезагрузите страницу: Ctrl+Shift+R
