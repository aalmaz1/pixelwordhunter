// Состояние игры
const State = {
    cat: null,
    word: null,
    isAnswering: false,
    xp: 0
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
});

// 2. Показ категорий
window.showCategories = function() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('category-screen').classList.remove('hidden');
    
    const list = document.getElementById('category-list');
    list.innerHTML = "";
    
    Object.keys(window.GAME_DATA || {}).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-card'; // Твой класс из CSS
        btn.innerHTML = `
            <div class="cat-title">${cat}</div>
            <div class="cat-stat">${window.GAME_DATA[cat].length} WORDS</div>
        `;
        btn.onclick = () => {
            State.cat = cat;
            document.getElementById('category-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            document.getElementById('category').innerText = cat;
            nextQuestion();
        };
        list.appendChild(btn);
    });
};

// 3. Логика игры
window.nextQuestion = function() {
    State.isAnswering = false;
    const grid = document.getElementById('options');
    const wordDisplay = document.getElementById('word');
    const feedback = document.getElementById('feedback');
    
    feedback.classList.add('hidden');
    grid.innerHTML = "";

    const words = window.GAME_DATA[State.cat];
    State.word = words[Math.floor(Math.random() * words.length)];

    // Поддержка любой структуры (word/eng/term и translation/rus/definition)
    wordDisplay.innerText = State.word.word || State.word.eng || State.word.term || State.word[0];

    let choices = [State.word];
    while(choices.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)];
        if(!choices.includes(r)) choices.push(r);
    }
    choices.sort(() => Math.random() - 0.5);

    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'option-btn'; // Класс из твоего CSS
        btn.innerText = choice.translation || choice.rus || choice.definition || choice[1];
        btn.onclick = () => {
            if(State.isAnswering) return;
            State.isAnswering = true;
            
            const correct = (choice === State.word);
            if(correct) {
                btn.style.background = "var(--green)";
                State.xp += 10;
                document.getElementById('xp').innerText = State.xp;
            } else {
                btn.style.background = "var(--red)";
            }
            
            feedback.innerText = correct ? "NICE!" : "WRONG!";
            feedback.classList.remove('hidden');
            setTimeout(nextQuestion, 1000);
        };
        grid.appendChild(btn);
    });
};


window.renderCategoryCards = function() {
    const container = document.getElementById("category-list");
    if (!container) return;

    container.innerHTML = ""; 
    const categories = Object.keys(window.GAME_DATA || {});

    categories.forEach(cat => {
        const card = document.createElement("div"); // Создаем div, как в старой версии
        card.className = "category-card"; 
        
        // Вставляем структуру, которая не раздувает блоки
        card.innerHTML = `
            <div style="margin-bottom: 5px;">${cat.toUpperCase()}</div>
            <div style="font-size: 7px; color: #666;">${window.GAME_DATA[cat].length} WDS</div>
        `;
        
        card.onclick = () => window.startQuiz(cat);
        container.appendChild(card);
    });
};

// 4. Выход
window.exitGame = function() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
};
