/* --- app.js (Адаптирован под структуру массива [eng, rus, exEn, exRu]) --- */

// Состояние игры
const State = {
    cat: null,
    word: null, // Здесь будет массив ["word", "trans", "exEn", "exRu"]
    isAnswering: false,
    xp: 0
};

// Ссылки на элементы модального окна
const modal = {
    el: document.getElementById('feedback-modal'),
    status: document.getElementById('feedback-status'),
    word: document.getElementById('feedback-word'),
    translation: document.getElementById('feedback-translation'),
    sentEn: document.getElementById('feedback-sentence-en'),
    sentRu: document.getElementById('feedback-sentence-ru'),
    nextBtn: document.getElementById('next-btn')
};

// 1. Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Игра загружена. Структура данных: Array");

    // Подсчет общего количества слов
    const total = document.getElementById('total-count');
    if(total && window.GAME_DATA) {
        let count = 0;
        Object.values(window.GAME_DATA).forEach(list => count += list.length);
        total.innerText = count;
    }

    // Логика кнопки "NEXT" в модальном окне
    if(modal.nextBtn) {
        modal.nextBtn.onclick = function() {
            modal.el.classList.add('hidden'); // Скрываем окно
            window.nextQuestion();            // Генерируем новый вопрос
        };
    }
});

// 2. Показ категорий (Главное меню)
window.showCategories = function() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('category-screen').classList.remove('hidden');
    window.renderCategoryCards();
};

window.renderCategoryCards = function() {
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = "";
    
    // Пробегаем по всем категориям
    Object.keys(window.GAME_DATA || {}).forEach(cat => {
        const btn = document.createElement('div');
        btn.className = 'category-card'; 
        
        // Красивая карточка с количеством слов
        btn.innerHTML = `
            <div class="cat-title">${cat}</div>
            <div class="cat-stat">${window.GAME_DATA[cat].length} WORDS</div>
        `;
        
        // Клик по категории
        btn.onclick = () => {
            State.cat = cat;
            document.getElementById('category-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            
            // Обновляем заголовок игры на название категории
            const titleEl = document.getElementById('category');
            if(titleEl) titleEl.innerText = cat;
            
            window.nextQuestion(); // Начинаем игру
        };
        list.appendChild(btn);
    });
};

// 3. Генерация вопроса
window.nextQuestion = function() {
    State.isAnswering = false;
    const grid = document.getElementById('options');
    const wordDisplay = document.getElementById('word');

    // Очищаем старые варианты
    grid.innerHTML = "";

    // Получаем список слов текущей категории
    const words = window.GAME_DATA[State.cat];
    
    // Выбираем случайное слово (ЭТО МАССИВ [eng, rus, exEn, exRu])
    State.word = words[Math.floor(Math.random() * words.length)];

    // Показываем Английское слово (индекс 0)
    wordDisplay.innerText = State.word[0];

    // Генерируем варианты ответов (неправильные + правильный)
    let choices = [State.word];
    while(choices.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)];
        // Чтобы не было дубликатов
        if(!choices.includes(r)) choices.push(r);
    }
    // Перемешиваем варианты
    choices.sort(() => Math.random() - 0.5);

    // Рендерим кнопки
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'option-btn'; 
        
        // Показываем ПЕРЕВОД (индекс 1)
        btn.innerText = choice[1];
        
        btn.onclick = () => {
            if(State.isAnswering) return; // Защита от двойного клика
            State.isAnswering = true;
            
            const correct = (choice === State.word);
            
            // Визуальная реакция кнопки
            if(correct) {
                btn.style.background = "var(--green)";
                State.xp += 10;
                const xpEl = document.getElementById('xp');
                if(xpEl) xpEl.innerText = State.xp;
            } else {
                btn.style.background = "var(--red)";
            }
            
            // Ждем 300мс и открываем карточку
            setTimeout(() => {
                showFeedbackModal(correct, State.word);
            }, 300);
        };
        grid.appendChild(btn);
    });
};

// 4. Показ модального окна (АДАПТИРОВАНО ПОД МАССИВ)
function showFeedbackModal(isCorrect, wordArr) {
    // wordArr = ["eng", "rus", "exEn", "exRu"]
    
    // Заполняем данные из массива по индексам
    modal.word.textContent = wordArr[0];       // Английское слово
    modal.translation.textContent = wordArr[1]; // Перевод
    modal.sentEn.textContent = wordArr[2] || "No example."; // Пример EN
    modal.sentRu.textContent = wordArr[3] || "";           // Пример RU

    // Настраиваем статус (цвет и текст)
    if (isCorrect) {
        modal.status.textContent = "CORRECT!";
        modal.status.className = "status-text status-correct";
        modal.status.style.color = "var(--green)";
    } else {
        modal.status.textContent = "WRONG!";
        modal.status.className = "status-text status-wrong";
        modal.status.style.color = "var(--red)";
    }

    // Показываем
    modal.el.classList.remove('hidden');
    modal.nextBtn.focus();
}

// 5. Выход в меню
window.exitGame = function() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
    if(modal.el) modal.el.classList.add('hidden');
};
