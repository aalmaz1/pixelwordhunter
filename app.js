/* jshint esversion: 8 */
console.log("Я ТУТ, ЭТО НОВЫЙ ФАЙЛ!");

// Мы берем данные из окна и переименовываем их в 'GAME_DATA',
// чтобы у Brave не было шанса спутать это с необъявленной GAME_DATA
var GAME_DATA = window.GAME_DATA || {};
var allWordsFlat = Object.values(GAME_DATA).flat();

let ui = {};
let currentRound = [];
let currentQ = 0;

// Создаем плоский список слов
var allWordsFlat = (function () {
  try {
    return Array.isArray(GAME_DATA)
      ? GAME_DATA
      : Object.values(GAME_DATA).flat();
  } catch (e) {
    return [];
  }
})();

currentRound = [];
currentQ = 0;
// Твои остальные переменные...

console.log("Старт игры. Слов в базе:", allWordsFlat.length);

function loadSavedProgress() {
  const rawData = localStorage.getItem("pixelWordHunter_save");
  if (!rawData) {
    console.log("📭 Сохранений пока нет.");
    return;
  }

  const savedStats = JSON.parse(rawData);
  let restoredCount = 0;

  // Проходимся по всем словам и возвращаем им уровни
  window.GAME_DATA.forEach((w) => {
    const key = w.eng.trim();
    if (savedStats[key]) {
      w.mastery = savedStats[key];
      restoredCount++;
    } else {
      w.mastery = 0; // Если слова нет в сохранении, оно новое
    }
  });

  console.log(`♻️ Восстановлен прогресс для ${restoredCount} слов.`);
  if (typeof updateMenuStats === "function") updateMenuStats();
}

function initProgress() {
  let savedData = {};
  console.log("📦 Инициализация данных при загрузке...");

  try {
    const raw = localStorage.getItem("pixelWordHunter_save");
    if (raw) {
      savedData = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("⚠️ LocalStorage заблокирован.");
    savedData = {};
  }

  // Проверяем, что GAME_DATA вообще существует
  if (!window.GAME_DATA) {
    console.error("❌ GAME_DATA не найден в window!");
    return;
  }

  Object.keys(window.GAME_DATA).forEach((cat) => {
    const categoryArray = window.GAME_DATA[cat];

    // БЕЗОПАСНОСТЬ: Перебираем только если это массив
    if (Array.isArray(categoryArray)) {
      categoryArray.forEach((w) => {
        if (w && w[0]) {
          const key = w[0].trim();
          w[4] = savedData[key] || 0;
        }
      });
    }
  });

  if (typeof updateMenuStats === "function") updateMenuStats();
  console.log("📊 Статистика инициализирована");
}

function saveProgress(wordArray, isCorrect) {
  if (!wordArray) return;

  let currentMastery = wordArray[4] || 0;
  if (isCorrect) {
    wordArray[4] = Math.min(currentMastery + 1, 3);
  } else {
    wordArray[4] = 1;
  }

  const saveObj = {};
  // Собираем прогресс со всех слов во всех категориях
  Object.keys(window.GAME_DATA).forEach((cat) => {
    window.GAME_DATA[cat].forEach((w) => {
      if (w[4] > 0) saveObj[w[0]] = w[4];
    });
  });

  localStorage.setItem("pixelWordHunter_save", JSON.stringify(saveObj));
  if (typeof updateMenuStats === "function") updateMenuStats();
}

// Вызови эту функцию сразу после того, как GAME_DATA загрузится из JSON!
// Например:
// fetch('words.json').then(res => res.json()).then(data => {
//    GAME_DATA = data;
//    initProgress();
// });

// 1. Сначала база данных прогресса
let wordProgress = JSON.parse(localStorage.getItem("toeic_progress")) || {};

function saveProgress(word, isCorrect) {
  console.log("--- ЗАПУСК СОХРАНЕНИЯ ---");
  if (!word) return;

  const searchKey = word.toString().toLowerCase().trim();

  // Поиск слова
  const wordObj = window.GAME_DATA.find(
    (w) => w.eng && w.eng.toString().toLowerCase().trim() === searchKey,
  );

  if (!wordObj) {
    console.error(`❌ Слово "${searchKey}" не найдено в базе!`);
    return;
  }

  // Обновляем mastery
  if (isCorrect) {
    wordObj.mastery = Math.min((wordObj.mastery || 0) + 1, 3);
  } else {
    wordObj.mastery = 1;
  }

  // Сохранение в LocalStorage
  try {
    const saveObj = {};
    window.GAME_DATA.forEach((w) => {
      if (w.mastery > 0) saveObj[w.eng] = w.mastery;
    });
    localStorage.setItem("pixelWordHunter_save", JSON.stringify(saveObj));
    console.log(
      "✅ УСПЕШНО СОХРАНЕНО:",
      searchKey,
      "Mastery:",
      wordObj.mastery,
    );
  } catch (e) {
    console.error("Ошибка записи в LocalStorage:", e);
  }

  // Обновляем экран
  if (typeof updateMenuStats === "function") updateMenuStats();
}

// 1. Проверка данных
if (typeof window.GAME_DATA === "undefined" || !window.GAME_DATA) {
  console.error("Критическая ошибка: Файл words_optimized.js не загружен!");
}

// 2. Игровые переменные
 allWordsFlat = window.GAME_DATA
  ? Object.values(window.GAME_DATA).flat()
  : [];
let xp = parseInt(localStorage.getItem("pixelWordHunter_xp")) || 0;
let selectedCategory = "All";
let wordStartTime = 0; // Твой алгоритм Echo-Pulse ожил!

// 3. Прогресс (важно для Эхо Пульса)
let progress =
  JSON.parse(localStorage.getItem("pixelWordHunter_progress")) || {};

function initUI() {
  ui = {
    menu: document.getElementById("menu-screen"),
    categoryScreen: document.getElementById("category-screen"),
    game: document.getElementById("game-screen"),
    word: document.getElementById("word"),
    options: document.getElementById("options"),
    xp: document.getElementById("xp"),
    category: document.getElementById("category"),
    progress: document.getElementById("progress"),
    feedback: document.getElementById("feedback"),
    quizBox: document.getElementById("quiz-box"),
    masteredCount: document.getElementById("mastered-count"),
    totalCount: document.getElementById("total-count"),
    explanationModal: document.getElementById("explanation-modal"),
    explanationList: document.getElementById("explanation-list"),
  };
  console.log("✅ Элементы UI успешно инициализированы:", ui);
}

function loadProgress() {
  const savedData = localStorage.getItem("pixelWordHunter_save");
  const parsedSave = savedData ? JSON.parse(savedData) : {};
  window.GAME_DATA = allWordsFlat.map((word) => ({
    ...word,
    mastery: parsedSave[word.eng] || 0,
  }));
}

function saveProgress() {
  const saveObj = {};
  window.GAME_DATA.forEach((w) => {
    if (w.mastery > 0) saveObj[w.eng] = w.mastery;
  });
  localStorage.setItem("pixelWordHunter_save", JSON.stringify(saveObj));
  updateMenuStats();
}

function updateMenuStats() {
  // 1. Считаем общую статистику
  const totalStats = calculateStats(window.GAME_DATA);

  // 2. Обновляем цифры в углу (то, что было раньше)
  if (ui.masteredCount) ui.masteredCount.textContent = totalStats.ms;
  if (ui.totalCount) ui.totalCount.textContent = window.GAME_DATA.length;

  // 3. Обновляем полоску вверху (NS / SL / MS)
  const statsElement = document.getElementById("total-stats");
  if (statsElement) {
    statsElement.innerHTML = `
            <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; font-size: 10px;">
                <span style="color:#f87171">NS: ${totalStats.ns}</span>
                <span style="color:#fbbf24">SL: ${totalStats.sl}</span>
                <span style="color:#4ade80">MS: ${totalStats.ms}</span>
            </div>
        `;
  }

  // 4. Перерисовываем папки категорий, чтобы в них тоже обновились цифры
  if (typeof showCategories === "function") {
    renderCategoryCards();
  }
}

function calculateStats(arr) {
  if (!arr || arr.length === 0) return { ns: 0, sl: 0, ms: 0 };
  let sl = 0,
    ms = 0;

  arr.forEach((w) => {
    const lvl = w[4] || 0;
    if (lvl >= 3) ms++;
    else if (lvl > 0) sl++;
  });

  return {
    ns: arr.length - sl - ms,
    sl: sl,
    ms: ms,
  };
}

function resetProgress() {
  if (confirm("Reset progress?")) {
    localStorage.removeItem("pixelWordHunter_save");
    location.reload();
  }
}

function showCategories() {
  ui.menu.classList.add("hidden");
  ui.categoryScreen.classList.remove("hidden");
}
function backToMenu() {
  ui.categoryScreen.classList.add("hidden");
  ui.menu.classList.remove("hidden");
}

// Функция выхода из игры в меню
function exitGame() {
  // 1. Скрываем всё лишнее
  document.getElementById("game-screen").classList.add("hidden");
  if (ui.explanationModal) ui.explanationModal.classList.add("hidden");
  if (ui.feedback) ui.feedback.classList.add("hidden");

  // 2. Показываем экран категорий
  document.getElementById("category-screen").classList.remove("hidden");

  // 3. ОБНОВЛЯЕМ ДАННЫЕ (важнейший этап)
  updateTotalStatsDisplay(); // Обновит плашку NS/SL/MS вверху
  renderCategoryMenu(); // Перерисует кнопки с новыми цифрами

  // Если на главном меню (menu-screen) тоже есть цифры, обновляем их
  if (typeof updateMenuStats === "function") updateMenuStats();
}

function startGame(category) {
  selectedCategory = category;

  // Переключение экранов
  document.getElementById("category-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  // Сброс состояния
  currentQ = 0;
  xp = 0;
  document.getElementById("xp").textContent = "0";
  document.getElementById("category").textContent = category.toUpperCase();

  // 1. Создаем умный набор слов для раунда
  generateSmartRound(category);

  // 2. Грузим первый вопрос
  loadQuestion();
}

function generateSmartRound(category) {
  // Если "All" — берем все слова, если категория — только её массив
  let pool = category === "All" ? allWordsFlat : window.GAME_DATA[category];

  if (!pool) {
    console.error("Категория не найдена:", category);
    return;
  }

  // Фильтруем по уровню мастерства (индекс [4])
  const newWords = pool.filter((w) => (w[4] || 0) === 0);
  const learning = pool.filter((w) => (w[4] || 0) === 1 || (w[4] || 0) === 2);
  const mastered = pool.filter((w) => (w[4] || 0) >= 3);

  // Собираем раунд из 10 слов (сначала новые и изучаемые)
  let roundWords = [...learning.slice(0, 5), ...newWords.slice(0, 5)];
  if (roundWords.length < 10) {
    roundWords = [...roundWords, ...mastered.slice(0, 10 - roundWords.length)];
  }

  currentRound = roundWords
    .sort(() => Math.random() - 0.5)
    .map((word) => {
      const isEngToRus = Math.random() > 0.5;
      return {
        question: isEngToRus ? word[0] : word[1],
        correct: isEngToRus ? word[1] : word[0],
        originalWord: word, // Передаем ссылку на массив слова для сохранения прогресса
        type: isEngToRus ? "eng-rus" : "rus-eng",
        optionsList: generateOptionsList(word, isEngToRus),
      };
    });
}

function generateOptionsList(correctWord, isEngToRus) {
  let options = [isEngToRus ? correctWord[1] : correctWord[0]]; // Правильный ответ

  // Берем случайные слова из плоского списка всех слов
  while (options.length < 4) {
    let randomWord =
      allWordsFlat[Math.floor(Math.random() * allWordsFlat.length)];
    let target = isEngToRus ? randomWord[1] : randomWord[0];

    if (!options.includes(target)) {
      options.push(target);
    }
  }
  return options.sort(() => Math.random() - 0.5);
}

function loadQuestion() {
  const q = currentRound[currentQ];

  // 1. Проверяем, существует ли ui и нужные элементы
  if (!q || !ui.word || !ui.options) {
    console.error("Ошибка: Данные вопроса или элементы UI не найдены");
    return;
  }

  // 2. Ставим текст вопроса (слово уже подготовлено в generateSmartRound)
  ui.word.textContent = q.question;
  ui.options.innerHTML = "";

  // 3. Создаем кнопки ответов
  q.optionsList.forEach((optionText) => {
    const btn = document.createElement("button");
    btn.className = "option-btn"; // Добавь класс для CSS

    // В твоем optionsList уже лежат готовые строки, просто берем их
    btn.textContent = optionText;

    // При клике передаем выбранный текст, текущий вопрос и саму кнопку
    btn.onclick = () => checkAnswer(optionText, q, btn);

    ui.options.appendChild(btn);
  });

  // 4. Прогресс-бар
  if (ui.progress) {
    ui.progress.style.width = `${(currentQ / 10) * 100}%`;
  }

  wordStartTime = Date.now();
  console.log(`📝 Вопрос ${currentQ + 1} загружен: ${q.question}`);
}

function checkAnswer(selectedText, qObj, btn) {
  try {
    // --- [ECHO-PULSE] ЗАМЕР ВРЕМЕНИ ---
    const reactionTime = (Date.now() - wordStartTime) / 1000;
    let status = "";
    let bonusXP = 0;
    let multiplier = 1;

    // 1. Блокируем кнопки
    const optionsContainer = document.getElementById("options");
    if (optionsContainer) {
      Array.from(optionsContainer.children).forEach((b) => (b.onclick = null));
    }

    const isCorrect = selectedText === qObj.correct;

    // 2. Сохранение и АЛГОРИТМ ОБУЧЕНИЯ
    const englishWord =
      qObj.eng || (qObj.originalWord && qObj.originalWord.eng) || qObj.question;

    if (isCorrect) {
      // --- [ECHO-PULSE] ОПРЕДЕЛЕНИЕ КАЧЕСТВА ОТВЕТА ---
      if (reactionTime < 1.2) {
        status = "INSTINCT KILL";
        bonusXP = 25;
        multiplier = 4; // Слово усвоено как рефлекс
      } else if (reactionTime <= 3.5) {
        status = "TACTICAL HIT";
        bonusXP = 15;
        multiplier = 2; // Хорошее знание
      } else {
        status = "FADING ECHO";
        bonusXP = 5;
        multiplier = 0.5; // Неуверенное знание, нужно повторить быстрее
      }

      btn.classList.add("correct");

      // Начисляем опыт по алгоритму
      if (typeof xp !== "undefined") {
        xp += bonusXP;
        const xpDisplay = document.getElementById("xp");
        if (xpDisplay) xpDisplay.textContent = xp;
        // Сохраняем общий опыт в память
        localStorage.setItem("pixelWordHunter_xp", xp);
      }

      showFeedback(status, true); // Показываем твой новый статус вместо "NICE!"
    } else {
      status = "MISFIRE...";
      btn.classList.add("wrong");
      if (optionsContainer) {
        const correctBtn = Array.from(optionsContainer.children).find(
          (b) => b.textContent === qObj.correct,
        );
        if (correctBtn) correctBtn.classList.add("correct");
      }
      showFeedback("LEARN!", false);
      multiplier = 0; // Сброс для интервальных повторений
    }

    if (englishWord) {
      // Передаем множитель в saveProgress, если ты захочешь усложнить сохранение позже
      saveProgress(englishWord, isCorrect, multiplier);
    }

    // 4. Обновление интерфейса
    if (typeof updateTotalStatsDisplay === "function")
      updateTotalStatsDisplay();
    if (typeof renderCategoryMenu === "function") renderCategoryMenu();

    // 5. Переход дальше
    setTimeout(() => {
      if (typeof showExplanation === "function") {
        showExplanation(qObj);
      } else {
        console.error("Функция showExplanation не найдена!");
      }
    }, 1000);
  } catch (error) {
    console.error("Критическая ошибка в checkAnswer:", error);
  }
}

// ОБНОВЛЕННАЯ ТАБЛИЦА (ЦВЕТНАЯ)
function showExplanation(qObj) {
  ui.explanationList.innerHTML = "";
  ui.explanationModal.classList.remove("hidden");

  let tableHTML = `
        <table class="review-table">
            <thead>
                <tr>
                    <th>WORD</th>
                    <th>MEANING</th>
                    <th>EXAMPLE</th>
                </tr>
            </thead>
            <tbody>
    `;

  qObj.optionsList.forEach((word) => {
    const isCorrectRow = word.eng === qObj.originalWord.eng;

    // Определяем, что нажал юзер
    const rowBtnText = qObj.type === "eng-rus" ? word.rus : word.eng;
    const isUserChoice = rowBtnText === qObj.userChoice;

    let rowStyle = "";
    let star = "";
    let wordColor = "#4ade80";

    // 1. ПРАВИЛЬНЫЙ ОТВЕТ (Всегда зеленый)
    if (isCorrectRow) {
      rowStyle =
        "background: rgba(74, 222, 128, 0.25); border-left: 3px solid #4ade80;";
      star = '<span style="color:#fbbf24">★</span>';
    }

    // 2. ОШИБКА ЮЗЕРА (Красный, если это не правильная строка)
    if (isUserChoice && !isCorrectRow) {
      rowStyle =
        "background: rgba(248, 113, 113, 0.25); border-left: 3px solid #f87171;";
      wordColor = "#f87171";
    }

    tableHTML += `
            <tr style="${rowStyle}">
                <td class="word-col" style="color: ${wordColor}">
                    ${word.eng} ${star}
                </td>
                <td class="def-col">${word.rus}</td>
                <td class="ex-col">
                    "${word.ex}"
                    <span class="ex-rus">${word.exRus}</span>
                </td>
            </tr>
        `;
  });

  tableHTML += `</tbody></table>`;
  ui.explanationList.innerHTML = tableHTML;
}

function nextQuestion() {
  ui.explanationModal.classList.add("hidden");
  currentQ++;
  if (currentQ < currentRound.length) loadQuestion();
  else finishGame();
}

function showFeedback(text, isGood) {
  ui.feedback.textContent = text;
  ui.feedback.style.color = isGood ? "#4ade80" : "#f87171";
  ui.feedback.classList.add("show");
  setTimeout(() => ui.feedback.classList.remove("show"), 800);
}

// ... (весь ваш код выше функции finishGame остается без изменений) ...

// ... (Ваш код выше функции finishGame остается без изменений) ...

function finishGame() {
  ui.progress.style.width = "100%";
  ui.quizBox.innerHTML = `
        <div class="question-card" style="margin-top:20px;">
            <h1 style="color:#4ade80; margin-bottom:20px">ROUND CLEAR!</h1>
            <p style="margin-bottom:20px; font-size:12px; line-height:1.8;">XP Gained: ${xp}<br>Progress Saved 💾</p>
        </div>
        <button onclick="location.reload()" style="background:#eab308; color:#000; width:100%">MAIN MENU</button>`;
}

function renderCategoryButtons() {
  console.log(
    "🛠️ Отрисовка категорий. Найдено в GAME_DATA:",
    Object.keys(window.GAME_DATA || {}).length,
  );
  const container = document.getElementById("category-list");
  if (!container) return;

  container.innerHTML = "";

  // 1. ПОЛУЧАЕМ КАТЕГОРИИ ПРАВИЛЬНО
  // Вместо map по словам, просто берем ключи из нашего глобального объекта
  const categories = Object.keys(window.GAME_DATA || {});

  const icons = {
    Contracts: "📄",
    Marketing: "📊",
    Warranties: "✅",
    Business_Planning: "💼",
    Computers: "💻",
    Office_Technology: "🖨️",
    Office_Procedures: "📋",
    Electronics: "🔌",
    Correspondence: "✉️",
    Recruiting: "🔍",
    Interviewing: "🤝",
    Hiring: "🎓",
    Salaries: "💰",
    Promotions: "📈",
    Shopping: "🛒",
    Supplies: "📦",
    Shipping: "🚢",
    Invoices: "🧾",
    Inventory: "📊",
    Marketing_Adv: "📣",
    Advertising: "📺",
    Warranties_Adv: "🛡️",
    Conferences_Adv: "🎙️",
    Finance_IT: "💻",
    Banking: "🏦",
    Accounting: "🧮",
    Investments: "📈",
    Taxes: "⚖️",
    Property: "🏢",
    Leasing: "🔑",
    Office_Space: "🖼️",
    Procedures: "📜",
    Dining: "🥗",
    Eating_Out: "🍽️",
    Entertainment: "🎭",
    Events: "🎊",
    Museums: "🖼️",
    Health: "👨‍⚕️",
    Dentist: "🦷",
    Insurance: "🛡️",
    Hospital: "🏥",
    Pharmacy: "💊",
    Airlines: "✈️",
    Trains: "🚆",
    Hotels: "🏨",
    Car_Rental: "🚗",
    Sightseeing: "📸",
  };

  // 2. Создаем кнопки для каждой категории
  categories.forEach((cat) => {
    // Проверка, что под этим ключом действительно лежит массив слов
    if (!Array.isArray(window.GAME_DATA[cat])) return;

    const btn = document.createElement("button");
    btn.className = "category-btn";
    const icon = icons[cat] || "📁";

    btn.innerHTML = `${icon}<br>${cat.toUpperCase()}`;
    btn.onclick = () => startGame(cat);
    container.appendChild(btn);
  });

  // 3. Добавляем кнопку "ALL WORDS"
  const allBtn = document.createElement("button");
  allBtn.className = "category-btn all";
  allBtn.innerHTML = `🌍<br>ALL WORDS`;
  allBtn.onclick = () => startGame("All");
  container.appendChild(allBtn);

  // 4. Кнопка BACK
  let backBtn = document.getElementById("js-back-btn");
  if (!backBtn) {
    backBtn = document.createElement("button");
    backBtn.id = "js-back-btn";
    backBtn.className = "back-btn";
    backBtn.textContent = "← BACK";
    backBtn.onclick = backToMenu;
    // Убедись, что ui.categoryScreen существует!
    if (ui && ui.categoryScreen) {
      ui.categoryScreen.appendChild(backBtn);
    }
  }
}

// --- ИСПРАВЛЕННЫЙ ЗАПУСК ---

// Функция showCategories теперь просто переключает экраны
// Кнопки уже будут отрисованы при старте
// 1. ГЛАВНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ (Строка 47 в HTML вызывает именно её)
function showCategories() {
    const menu = document.getElementById("menu-screen");
    const catScreen = document.getElementById("category-screen");
    
    if (menu && catScreen) {
        menu.classList.add("hidden");
        catScreen.classList.remove("hidden");
        
        // Запускаем отрисовку папок
        renderCategoryMenu();
        
        // Обновляем общую статистику
        if (typeof updateTotalStatsDisplay === "function") {
            updateTotalStatsDisplay();
        }
    }
}

// 2. БЕЗОПАСНАЯ ОТРИСОВКА КАТЕГОРИЙ
function renderCategoryMenu() {
    const container = document.getElementById("category-list");
    if (!container) return;

    container.innerHTML = "";

    // Получаем категории и убираем пустые
    const categories = [...new Set(allWordsFlat.map(w => w.category).filter(Boolean))];

    categories.forEach(cat => {
        const catWords = allWordsFlat.filter(w => w.category === cat);
        const s = calculateStats(catWords);
        const upperCat = cat.toUpperCase();

        const btn = document.createElement("button");
        btn.className = "category-btn";
        btn.onclick = () => startCategoryGame(cat);
        
        btn.innerHTML = `
            <div class="category-name" style="font-weight: bold; margin-bottom: 8px;">${upperCat}</div>
            <div style="font-size: 8px; line-height: 1.4;">
                <div style="color: #4ade80">MASTERED: ${s.ms}</div>
                <div style="color: #fbbf24">LEARNING: ${s.sl}</div>
                <div style="color: #f87171">NEW: ${s.ns}</div>
            </div>
        `;
        container.appendChild(btn);
    });
}

function updateTotalStatsDisplay() {
  // 1. Получаем статистику (убедись, что передаешь правильный массив слов)
  const s = calculateStats(
    typeof GAME_DATA !== "undefined" && Object.keys(GAME_DATA).length > 0
      ? allWordsFlat
      : [],
  );

  const statsElement = document.getElementById("total-stats");

  if (statsElement) {
    // Мы используем s.learning вместо s.sl и т.д., чтобы они совпадали с calculateStats
    statsElement.innerHTML = `
            <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; font-size: 10px;">
                <span style="color:#f87171"><span class="full-text">NOT STUDIED</span><span class="short-text">NS</span>: ${s.ns}</span>
                <span style="color:#fbbf24"><span class="full-text">STILL LEARNING</span><span class="short-text">SL</span>: ${s.learning}</span>
                <span style="color:#4ade80"><span class="full-text">MASTERED</span><span class="short-text">MS</span>: ${s.mastered}</span>
            </div>
        `;
  }

  const masteredCount = document.getElementById("mastered-count");
  const totalCount = document.getElementById("total-count");
  if (masteredCount) masteredCount.textContent = s.mastered;
  if (totalCount)
    totalCount.textContent = (
      typeof window.GAME_DATA !== "undefined" ? window.GAME_DATA : allWordsFlat
    ).length;
}

function renderCategoryMenu() {
  const container = document.getElementById("category-list"); // Убедись, что ID совпадает с HTML
  if (!container) return;

  // 1. Берем только уникальные и существующие категории
  const categories = [...new Set(allWordsFlat.map(w => w.category).filter(Boolean))];
  
  // 2. Очищаем контейнер перед отрисовкой, чтобы не дублировать кнопки
  container.innerHTML = "";

  // 3. Создаем кнопки с нуля (так надежнее, чем искать старые)
  categories.forEach(cat => {
    const catWords = allWordsFlat.filter(w => w.category === cat);
    const s = calculateStats(catWords);
    const upperCat = cat.toUpperCase();

    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.onclick = () => startCategoryGame(cat);
    btn.innerHTML = `
      <div class="category-name">${upperCat}</div>
      <div style="font-size:8px; margin-top:5px;">
        <span style="color:#f87171">NS: ${s.ns}</span> | 
        <span style="color:#fbbf24">SL: ${s.sl}</span> | 
        <span style="color:#4ade80">MS: ${s.ms}</span>
      </div>
    `;
    container.appendChild(btn);
  });
}

function saveProgress(word, isCorrect) {
  if (!word || !window.GAME_DATA) return;

  // Очищаем слово от мусора, чтобы поиск был точным
  const searchKey = word.toString().toLowerCase().trim();

  // Ищем слово в твоей базе данных
  const wordObj = window.GAME_DATA.find(
    (w) => w.eng && w.eng.toString().toLowerCase().trim() === searchKey,
  );

  if (!wordObj) {
    console.warn(
      `⚠️ SaveProgress: Слово "${searchKey}" не найдено в GAME_DATA.`,
    );
    return;
  }

  // Логика уровней (0 -> 1 -> 2 -> 3)
  // Если wordObj.mastery еще нет, считаем его 0
  let currentMastery = wordObj.mastery || 0;

  if (isCorrect) {
    // Повышаем уровень, но не больше 3
    wordObj.mastery = Math.min(currentMastery + 1, 3);
  } else {
    // При ошибке сбрасываем на "Still Learning" (1)
    wordObj.mastery = 1;
  }

  // Сохраняем ВСЮ базу в LocalStorage
  try {
    const saveObj = {};
    window.GAME_DATA.forEach((w) => {
      // Сохраняем только те слова, которые мы начали учить
      if (w.mastery > 0) saveObj[w.eng.trim()] = w.mastery;
    });

    localStorage.setItem("pixelWordHunter_save", JSON.stringify(saveObj));

    // ВАЖНО: Этот лог покажет тебе, что всё сработало!
    console.log(
      `✅ СОХРАНЕНО: "${wordObj.eng}" теперь уровень ${wordObj.mastery}`,
    );
  } catch (e) {
    console.error("Ошибка записи в LocalStorage:", e);
  }

  // Обновляем цифры в меню
  if (typeof updateMenuStats === "function") updateMenuStats();
  if (typeof renderCategoryMenu === "function") renderCategoryMenu();
}

// --- ФУНКЦИЯ-КАЛЬКУЛЯТОР (Вставь это, чтобы починить ошибку) ---

function calculateStats(sourceArray) {
  if (!sourceArray) return { ns: 0, learning: 0, mastered: 0, total: 0 };

  let learning = 0;
  let mastered = 0;

  sourceArray.forEach((w) => {
    const lvl = w.mastery || 0;
    if (lvl === 3) mastered++;
    else if (lvl > 0) learning++;
  });

  return {
    total: sourceArray.length,
    learning: learning,
    mastered: mastered,
    ns: sourceArray.length - learning - mastered, // Расчет Not Studied
  };
}
function calculateStats(sourceArray) {
  if (!sourceArray || sourceArray.length === 0)
    return { ns: 0, sl: 0, ms: 0, total: 0 };

  let sl = 0;
  let ms = 0;

  sourceArray.forEach((w) => {
    const lvl = w.mastery || 0;
    if (lvl >= 3) ms++;
    else if (lvl > 0) sl++;
  });

  return {
    total: sourceArray.length,
    sl: sl,
    ms: ms,
    ns: sourceArray.length - sl - ms,
  };
}
function renderCategoryMenu() {
  const container = document.getElementById("category-screen");
  
  // Добавляем фильтр .filter(Boolean), чтобы убрать undefined категории
  const categories = [...new Set(allWordsFlat.map((w) => w.category).filter(Boolean))];

  const listContainer = document.querySelector(".category-grid") || container;

  categories.forEach((cat) => {
    // На всякий случай проверяем cat еще раз перед использованием
    if (!cat) return;

    const catWords = window.GAME_DATA.filter((w) => w.category === cat);
    const s = calculateStats(catWords);

    const cards = document.querySelectorAll(".category-card, button");
    cards.forEach((card) => {
      // Используем опциональную цепочку ?. и проверку cat
      const upperCat = cat.toUpperCase(); 
      
      if (card.textContent && card.textContent.toUpperCase().includes(upperCat)) {
        const statsDiv = card.querySelector(".category-stats-grid") || card;
        statsDiv.innerHTML = `
            <div class="category-name">${upperCat}</div>
            <div style="color:#f87171">NOT STUDIED: ${s.ns}</div>
            <div style="color:#fbbf24">STILL LEARNING: ${s.sl}</div>
            <div style="color:#4ade80">MASTERED: ${s.ms}</div>
        `;}); // закрывает cards.forEach
  }); // закрывает categories.forEach
} // закрывает саму функцию renderCategoryMenu

function calculateStats(arr) {
  if (!arr) return { ns: 0, sl: 0, ms: 0 };
  let sl = 0,
    ms = 0;
  arr.forEach((w) => {
    if (w.mastery >= 3) ms++;
    else if (w.mastery > 0) sl++;
  });
  return {
    ns: arr.length - sl - ms,
    sl: sl,
    ms: ms,
  };
}
function renderCategoryCards() {
  const categories = Object.keys(window.GAME_DATA);
  const allCards = document.querySelectorAll(
    ".category-card, .folder-box, #category-screen button",
  );

  allCards.forEach((card) => {
    const cardText = card.innerText.split("\n")[0].trim();
    // Ищем категорию, игнорируя регистр
    const matchedCat = categories.find(
      (c) => c.toUpperCase() === cardText.toUpperCase(),
    );

    if (matchedCat) {
      const s = calculateStats(window.GAME_DATA[matchedCat]);
      card.innerHTML = `
        <div class="category-name" style="margin-bottom:8px; font-weight:bold;">${matchedCat.toUpperCase()}</div>
        <div style="color:#f87171; font-size:10px;">NOT STUDIED: ${s.ns}</div>
        <div style="color:#fbbf24; font-size:10px;">LEARNING: ${s.sl}</div>
        <div style="color:#4ade80; font-size:10px;">MASTERED: ${s.ms}</div>
      `;
    }
  });
}

// Ждем, пока всё загрузится, и запускаем обновление
// Этот код сработает ОДИН РАЗ сразу при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  console.log("📦 Инициализация данных при загрузке...");

  // 1. Восстанавливаем прогресс из памяти
  if (typeof loadSavedProgress === "function") {
    loadSavedProgress();
  } else if (typeof initProgress === "function") {
    initProgress();
  }

  // 2. Принудительно обновляем все цифры, чтобы не было undefined
  if (typeof updateMenuStats === "function") {
    updateMenuStats();
  }
});

// Это заставит Netlify показать статистику СРАЗУ при загрузке страницы
window.addEventListener("load", () => {
  if (typeof initProgress === "function") initProgress();
  if (typeof updateMenuStats === "function") updateMenuStats();
});

window.onload = function () {
  console.log("Страница загружена полностью. Инициализация...");
  if (typeof initProgress === "function") initProgress();
  // Если у тебя есть функция отрисовки меню, вызови её здесь:
  // if (typeof renderMenu === "function") renderMenu();
};

function initApp() {
  console.log("🚀 Запуск финальной сборки...");

  // 1. СОБИРАЕМ UI (Это фундамент!)
  ui = {
    menu: document.getElementById("menu-screen"),
    categoryScreen: document.getElementById("category-screen"),
    game: document.getElementById("game-screen"),
    word: document.getElementById("word"),
    options: document.getElementById("options"),
    xp: document.getElementById("xp"),
    category: document.getElementById("category"),
    progress: document.getElementById("progress"),
    feedback: document.getElementById("feedback"),
    quizBox: document.getElementById("quiz-box"),
    masteredCount: document.getElementById("mastered-count"),
    totalCount: document.getElementById("total-count"),
    explanationModal: document.getElementById("explanation-modal"),
    explanationList: document.getElementById("explanation-list"),
  };

  // 2. ЗАГРУЖАЕМ ДАННЫЕ
  // Проверь, как называется твоя функция: loadProgress или initProgress?
  // Используй то название, которое у тебя в коде.
  if (typeof loadProgress === "function") loadProgress();
  else if (typeof initProgress === "function") initProgress();

  // 3. ОБНОВЛЯЕМ ЭКРАН
  loadProgress();
  updateMenuStats();
  renderCategoryButtons();

  console.log("✅ Все системы в норме. UI готов.");
}

function getWordWeight(word) {
  // Достаем данные из нашего прогресса
  const stats = progress[word] || { score: 0, lastSeen: 0 };
  const now = Date.now();

  // --- АЛГОРИТМ ЭХО ПУЛЬСА ---

  // 1. Новые слова (score 0) - приоритет высокий
  if (stats.score === 0) return 100;

  // 2. Ошибки (score < 0) - "Пульс" частит, возвращаем немедленно
  if (stats.score < 0) return 200;

  // 3. Интервальное повторение
  const minsSince = (now - stats.lastSeen) / (1000 * 60);

  // Если слово уже почти выучено (score > 3), не показываем его слишком часто
  if (stats.score >= 3 && minsSince < 60) return 5;

  // Если слово требует закрепления
  return 50;
}

// Запускаем приложение
initApp();
