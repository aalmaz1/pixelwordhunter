/* --- app.js (FINAL VERSION: Table Feedback) --- */

// Состояние игры
const State = {
    cat: null,
    targetWord: null,   // Правильное слово (массив [eng, rus, exEn, exRu])
    currentChoices: [], // Все 4 варианта этого раунда
    isAnswering: false,
    xp: 0
};

// Элементы модального окна
const modal = {
    el: document.getElementById('feedback-modal'),
    status: document.getElementById('feedback-status'),
    list: document.getElementById('feedback-list'),
    nextBtn: document.getElementById('next-btn')
};

// 1. Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Игра готова!");
    
    // Подсчет общего количества слов
    const total = document.getElementById('total-count');
    if(total && window.GAME_DATA) {
        let count = 0;
        Object.values(window.GAME_DATA).forEach(a => count += a.length);
        total.innerText = count;
    }

    // Настройка кнопки NEXT
    if(modal.nextBtn) {
        modal.nextBtn.onclick = () => {
            modal.el.classList.add('hidden'); // Скрываем окно
            window.nextQuestion();            // Генерируем новый вопрос
        };
    }
});

// 2. Показ экрана категорий
window.showCategories = function() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('category-screen').classList.remove('hidden');
    window.renderCategoryCards();
};

// 3. Рендер списка категорий
window.renderCategoryCards = function() {
    const list = document.getElementById('category-list');
    if (!list) return;

    list.innerHTML = "";
    
    Object.keys(window.GAME_DATA || {}).forEach(cat => {
        const btn = document.createElement('div');
        btn.className = 'category-card'; 
        
        btn.innerHTML = `
            <div class="cat-title">${cat}</div>
            <div class="cat-stat">${window.GAME_DATA[cat].length} WORDS</div>
        `;
        
        btn.onclick = () => {
            State.cat = cat;
            document.getElementById('category-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            
            // Обновляем заголовок
            const catTitle = document.getElementById('category');
            if(catTitle) catTitle.innerText = cat;
            
            window.nextQuestion();
        };
        list.appendChild(btn);
    });
};

// 4. Генерация вопроса
window.nextQuestion = function() {
    State.isAnswering = false;
    const grid = document.getElementById('options');
    const wordDisplay = document.getElementById('word');
    
    // Очищаем старое
    grid.innerHTML = "";
    const feedback = document.getElementById('feedback');
    if(feedback) feedback.classList.add('hidden');

    // Получаем слова категории
    const words = window.GAME_DATA[State.cat];
    
    // Выбираем правильное слово
    State.targetWord = words[Math.floor(Math.random() * words.length)];
    
    // Показываем английское слово (индекс 0)
    wordDisplay.innerText = State.targetWord[0];

    // Генерируем 4 варианта
    let choices = [State.targetWord];
    while(choices.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)];
        if(!choices.includes(r)) choices.push(r);
    }
    choices.sort(() => Math.random() - 0.5);
    
    // СОХРАНЯЕМ варианты в State для таблицы результатов
    State.currentChoices = choices;

    // Создаем кнопки ответов
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'option-btn'; 
        btn.innerText = choice[1]; // Показываем перевод (индекс 1)
        
        btn.onclick = () => {
            if(State.isAnswering) return;
            State.isAnswering = true;
            
            const isCorrect = (choice === State.targetWord);
            
            // Визуальная реакция кнопки
            if(isCorrect) {
                btn.style.background = "var(--green)";
                State.xp += 10;
                const xpEl = document.getElementById('xp');
                if(xpEl) xpEl.innerText = State.xp;
            } else {
                btn.style.background = "var(--red)";
            }
            
            // Задержка перед показом таблицы
            setTimeout(() => {
                showFeedbackModal(isCorrect, choice);
            }, 400);
        };
        grid.appendChild(btn);
    });
};

// 5. Функция показа Таблицы Результатов
function showFeedbackModal(isMainCorrect, userSelectedWord) {
    // Настраиваем заголовок
    if (isMainCorrect) {
        modal.status.textContent = "CORRECT!";
        modal.status.className = "status-text status-correct";
        modal.status.style.color = "var(--green)";
    } else {
        modal.status.textContent = "WRONG!";
        modal.status.className = "status-text status-wrong";
        modal.status.style.color = "var(--red)";
    }

    // Очищаем список
    modal.list.innerHTML = "";

    // Строим список из 4 вариантов
    State.currentChoices.forEach(wordArr => {
        // wordArr = [eng, rus, exEn, exRu]
        
        const item = document.createElement('div');
        item.className = 'feedback-item';

        // Логика подсветки:
        // 1. Если это ПРАВИЛЬНОЕ слово -> Зеленая рамка
        if (wordArr === State.targetWord) {
            item.classList.add('item-correct');
        }
        // 2. Если это ОШИБОЧНОЕ слово (которое выбрал юзер) -> Красная рамка
        else if (!isMainCorrect && wordArr === userSelectedWord) {
            item.classList.add('item-wrong');
        }

        // HTML карточки слова
        item.innerHTML = `
            <div class="fb-word-row">
                <span class="fb-word">${wordArr[0]}</span>
                <span class="fb-trans">${wordArr[1]}</span>
            </div>
            <div class="fb-ex">${wordArr[2] || "No example"}</div>
            <div class="fb-ex" style="color:#888;">${wordArr[3] || ""}</div>
        `;

        modal.list.appendChild(item);
    });

    // Показываем окно
    modal.el.classList.remove('hidden');
    modal.nextBtn.focus();
}

// 6. Выход в меню
window.exitGame = function() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
    if(modal.el) modal.el.classList.add('hidden');
};
