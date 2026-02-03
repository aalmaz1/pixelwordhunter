// Состояние игры
const State = {
    cat: null,
    word: null,
    isAnswering: false,
    xp: 0
};

// Ссылки на элементы модального окна (чтобы не искать их каждый раз)
const modal = {
    el: document.getElementById('feedback-modal'),
    status: document.getElementById('feedback-status'),
    word: document.getElementById('feedback-word'),
    translation: document.getElementById('feedback-translation'),
    sentEn: document.getElementById('feedback-sentence-en'),
    sentRu: document.getElementById('feedback-sentence-ru'),
    nextBtn: document.getElementById('next-btn')
};

// 1. Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Игра готова!");
    const total = document.getElementById('total-count');
    if(total && window.GAME_DATA) {
        let count = 0;
        Object.values(window.GAME_DATA).forEach(a => count += a.length);
        total.innerText = count;
    }

    // Привязываем клик к кнопке NEXT в модальном окне
    if(modal.nextBtn) {
        modal.nextBtn.onclick = function() {
            modal.el.classList.add('hidden'); // Скрываем окно
            window.nextQuestion();            // Следующий вопрос
        };
    }
});

// 2. Показ категорий
window.showCategories = function() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('category-screen').classList.remove('hidden');
    
    // Используем renderCategoryCards, раз он у тебя есть, или пишем логику тут
    window.renderCategoryCards();
};

window.renderCategoryCards = function() {
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = "";
    
    Object.keys(window.GAME_DATA || {}).forEach(cat => {
        const btn = document.createElement('div'); // Или button
        btn.className = 'category-card'; 
        
        // ВАЖНО: Добавил переносы строк и структуру, чтобы не ломать верстку
        btn.innerHTML = `
            <div class="cat-title">${cat}</div>
            <div class="cat-stat">${window.GAME_DATA[cat].length} WORDS</div>
        `;
        
        btn.onclick = () => {
            State.cat = cat;
            document.getElementById('category-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            document.getElementById('category').innerText = cat;
            window.nextQuestion();
        };
        list.appendChild(btn);
    });
};

// 3. Логика игры (ГЕНЕРАЦИЯ ВОПРОСА)
window.nextQuestion = function() {
    State.isAnswering = false;
    const grid = document.getElementById('options');
    const wordDisplay = document.getElementById('word');
    // Старый фидбек (текст снизу) нам больше не нужен, но если он есть в HTML - скроем
    const feedback = document.getElementById('feedback'); 
    if(feedback) feedback.classList.add('hidden');

    grid.innerHTML = "";

    const words = window.GAME_DATA[State.cat];
    // Берем случайное слово
    State.word = words[Math.floor(Math.random() * words.length)];

    // Поддержка любой структуры (word/eng/term и translation/rus/definition)
    const questionText = State.word.word || State.word.eng || State.word.term || State.word[0];
    wordDisplay.innerText = questionText;

    // Генерируем 4 варианта
    let choices = [State.word];
    while(choices.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)];
        if(!choices.includes(r)) choices.push(r);
    }
    choices.sort(() => Math.random() - 0.5);

    // Рендерим кнопки
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'option-btn'; 
        const answerText = choice.translation || choice.rus || choice.definition || choice[1];
        btn.innerText = answerText;
        
        btn.onclick = () => {
            if(State.isAnswering) return; // Защита от двойного клика
            State.isAnswering = true;
            
            const correct = (choice === State.word);
            
            // Подсветка кнопки (для красоты на фоне)
            if(correct) {
                btn.style.background = "var(--green)";
                State.xp += 10;
                const xpEl = document.getElementById('xp');
                if(xpEl) xpEl.innerText = State.xp;
            } else {
                btn.style.background = "var(--red)";
            }
            
            // ВМЕСТО setTimeout -> ПОКАЗЫВАЕМ МОДАЛКУ!
            // Небольшая задержка (300мс), чтобы игрок успел увидеть цвет кнопки
            setTimeout(() => {
                showFeedbackModal(correct, State.word);
            }, 300);
        };
        grid.appendChild(btn);
    });
};

// 4. Функция показа модального окна
function showFeedbackModal(isCorrect, wordObj) {
    // Безопасное получение данных (чтобы не было undefined)
    const wWord = wordObj.word || wordObj.eng || wordObj.term || "Word";
    const wTrans = wordObj.translation || wordObj.rus || wordObj.definition || "Translation";
    const wExEn = wordObj.example || "No example available."; 
    const wExRu = wordObj.exampleTranslate || ""; 

    // Заполняем поля
    modal.word.textContent = wWord;
    modal.translation.textContent = wTrans;
    modal.sentEn.textContent = wExEn;
    modal.sentRu.textContent = wExRu;

    // Настраиваем статус (цвет и текст)
    if (isCorrect) {
        modal.status.textContent = "CORRECT!";
        modal.status.style.color = "var(--green)";
    } else {
        modal.status.textContent = "WRONG!";
        modal.status.style.color = "var(--red)";
    }

    // Показываем
    modal.el.classList.remove('hidden');
    modal.nextBtn.focus(); // Фокус на кнопку Next
}

// 5. Выход
window.exitGame = function() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
    // Скрываем модалку, если вдруг она открыта
    if(modal.el) modal.el.classList.add('hidden');
};
