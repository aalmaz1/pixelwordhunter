/* --- app.js (Адаптирован под структуру массива [eng, rus, exEn, exRu]) --- */

// Состояние игры
/* --- ОБНОВЛЕННЫЙ JS С ТАБЛИЦЕЙ РЕЗУЛЬТАТОВ --- */

const State = {
    cat: null,
    targetWord: null, // Правильное слово (массив)
    currentChoices: [], // Все 4 варианта этого раунда
    isAnswering: false,
    xp: 0
};

const modal = {
    el: document.getElementById('feedback-modal'),
    status: document.getElementById('feedback-status'),
    list: document.getElementById('feedback-list'), // Наш новый контейнер
    nextBtn: document.getElementById('next-btn')
};

// ... (Инициализация и showCategories без изменений) ...
// Оставил их краткими, они такие же как были
document.addEventListener('DOMContentLoaded', () => { /* то же самое */ 
    if(modal.nextBtn) modal.nextBtn.onclick = () => {
        modal.el.classList.add('hidden');
        window.nextQuestion();
    };
});
// ... (renderCategoryCards то же самое) ...

// ГЕНЕРАЦИЯ ВОПРОСА
window.nextQuestion = function() {
    State.isAnswering = false;
    const grid = document.getElementById('options');
    const wordDisplay = document.getElementById('word');
    grid.innerHTML = "";

    const words = window.GAME_DATA[State.cat];
    State.targetWord = words[Math.floor(Math.random() * words.length)];
    wordDisplay.innerText = State.targetWord[0]; // Английское слово

    // Генерируем варианты
    let choices = [State.targetWord];
    while(choices.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)];
        if(!choices.includes(r)) choices.push(r);
    }
    choices.sort(() => Math.random() - 0.5);
    
    // СОХРАНЯЕМ варианты в State, чтобы показать их в конце
    State.currentChoices = choices;

    // Рендерим кнопки
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'option-btn'; 
        btn.innerText = choice[1]; // Перевод
        
        btn.onclick = () => {
            if(State.isAnswering) return;
            State.isAnswering = true;
            
            const isCorrect = (choice === State.targetWord);
            
            if(isCorrect) {
                btn.style.background = "var(--green)";
                State.xp += 10;
                document.getElementById('xp').innerText = State.xp;
            } else {
                btn.style.background = "var(--red)";
            }
            
            // Передаем в модалку: (правильно ли, какое слово выбрал юзер)
            setTimeout(() => {
                showFeedbackModal(isCorrect, choice);
            }, 300);
        };
        grid.appendChild(btn);
    });
};

// НОВАЯ ФУНКЦИЯ ПОКАЗА ТАБЛИЦЫ
function showFeedbackModal(isMainCorrect, userSelectedWord) {
    // 1. Статус заголовка
    if (isMainCorrect) {
        modal.status.textContent = "CORRECT!";
        modal.status.style.color = "var(--green)";
    } else {
        modal.status.textContent = "WRONG!";
        modal.status.style.color = "var(--red)";
    }

    // 2. Очищаем список
    modal.list.innerHTML = "";

    // 3. Строим список из ВСЕХ 4 вариантов
    State.currentChoices.forEach(wordArr => {
        // wordArr = [eng, rus, exEn, exRu]
        
        const item = document.createElement('div');
        item.className = 'feedback-item';

        // Логика подсветки:
        // Если это Правильное слово (target) -> Зеленая рамка
        if (wordArr === State.targetWord) {
            item.classList.add('item-correct');
        }
        // Если это слово, которое юзер выбрал ОШИБОЧНО -> Красная рамка
        else if (!isMainCorrect && wordArr === userSelectedWord) {
            item.classList.add('item-wrong');
        }

        // HTML внутри карточки
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
