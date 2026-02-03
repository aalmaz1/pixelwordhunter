/**
 * PIXEL WORD HUNTER - ULTIMATE ENGINE v1.0
 */

// Состояние игры
const State = {
    currentCategory: null,
    currentWord: null,
    isAnswering: false,
    xp: 0
};

// 1. Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Engine Started. Words loaded:", window.GAME_DATA ? Object.keys(window.GAME_DATA).length : 0);
    updateStats();
});

// 2. Главное меню -> Экран категорий
window.showCategories = function() {
    switchScreen('category-screen');
    renderCategories();
};

// 3. Отрисовка категорий
function renderCategories() {
    const container = document.getElementById('category-list');
    if (!container) return;

    container.innerHTML = "";
    const categories = Object.keys(window.GAME_DATA || {});

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-card'; // Использует твой CSS
        btn.innerHTML = `
            <div class="cat-title">${cat.toUpperCase()}</div>
            <div class="cat-stat">${window.GAME_DATA[cat].length} WORDS</div>
        `;
        btn.onclick = () => startGame(cat);
        container.appendChild(btn);
    });
}

// 4. Запуск игры
function startGame(category) {
    State.currentCategory = category;
    switchScreen('game-screen');
    document.getElementById('category').innerText = category;
    nextQuestion();
}

// 5. Логика вопросов (Универсальная - лечит undefined)
window.nextQuestion = function() {
    State.isAnswering = false;
    const optionsGrid = document.getElementById('options');
    const wordDisplay = document.getElementById('word');
    const feedback = document.getElementById('feedback');
    
    if(feedback) feedback.classList.add('hidden');
    optionsGrid.innerHTML = "";

    const words = window.GAME_DATA[State.currentCategory];
    State.currentWord = words[Math.floor(Math.random() * words.length)];

    // АВТО-ОПРЕДЕЛЕНИЕ ПОЛЕЙ (лечим undefined)
    const qText = State.currentWord.word || State.currentWord.term || State.currentWord.eng || State.currentWord[0];
    wordDisplay.innerText = qText;

    // Генерируем 4 варианта
    let choices = [State.currentWord];
    while(choices.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)];
        if(!choices.includes(r)) choices.push(r);
    }
    choices.sort(() => Math.random() - 0.5);

    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        
        // Авто-определение перевода
        const aText = choice.translation || choice.rus || choice.definition || choice[1];
        btn.innerText = aText;

        btn.onclick = () => checkAnswer(choice, btn);
        optionsGrid.appendChild(btn);
    });
};

// 6. Проверка ответа
function checkAnswer(choice, btn) {
    if(State.isAnswering) return;
    State.isAnswering = true;

    const feedback = document.getElementById('feedback');
    const isCorrect = choice === State.currentWord;

    if(isCorrect) {
        btn.classList.add('correct'); // Твой стиль из CSS
        State.xp += 10;
        document.getElementById('xp').innerText = State.xp;
        feedback.innerText = "⭐ PERFECT!";
        feedback.style.color = "var(--green)";
    } else {
        btn.classList.add('wrong'); // Твой стиль из CSS
        feedback.innerText = "❌ WRONG";
        feedback.style.color = "var(--red)";
    }

    feedback.classList.remove('hidden');
    setTimeout(nextQuestion, 1200);
}

// 7. Выход
window.exitGame = function() {
    switchScreen('menu-screen');
};

// Утилиты
function switchScreen(id) {
    document.querySelectorAll('.game-container').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function updateStats() {
    const mastered = document.getElementById('mastered-count');
    const total = document.getElementById('total-count');
    if(mastered && total && window.GAME_DATA) {
        let count = 0;
        Object.values(window.GAME_DATA).forEach(a => count += a.length);
        total.innerText = count;
    }
}
