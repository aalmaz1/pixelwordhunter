# Аудит: соответствие слов и переводов тематике TOEIC

Дата: 2026-08-20. Источник сверки — **Lin Lougheed, «600 Essential Words for the TOEIC»
(Barron's)**, полный Word Index книги (слово → номер урока). Сверялись 600 карточек
(50 категорий × 12 слов, 458 уникальных английских терминов) из `words_optimized.json`.

---

## 1. Главный итог

| Метрика | Значение |
|---|---|
| Всего карточек | 600 |
| Карточек, чьё слово **совпадает** со словом соответствующего урока книги | **192** (32%) |
| Карточек, чьё слово **НЕ совпадает** с уроком книги | **408** (68%) |
| Категорий с точным списком (12/12) | **8** |
| Категорий с частичным совпадением (1–11/12) | **24** |
| Категорий полностью «не из книги» (0/12) | **18** |

### Важное уточнение (две разные шкалы)

1. **Тематическое соответствие (мягкая шкала).** Практически все 600 слов — это
   деловая/офисная/финансовая/туристическая/медицинская лексика, то есть *по теме*
   они TOEIC-уместны. Явно «не по тематике» — всего ~5 карточек
   (`compere`, `congregate`, `choreographer`, `choreograph` ×2).

2. **Соответствие книге (строгая шкала).** Книга учит **общую** деловую лексику в
   тематическом контексте («The new words taught in each chapter are not specialized
   words»). Поэтому 36 категорий, которые не были приведены к книге в предыдущей
   правке (`toeic_theme_review.md`), содержат «тематические», но **не те** слова, что в
   книге. Именно они дают 408 несовпадающих карточек.

---

## 2. Соответствие категорий книге

### ✅ Точное совпадение (12/12) — 8 категорий
Board Meeting and Committees, Quality Control, Car Rentals, Movies, Media,
Dentists Office, Hospitals, Pharmacy.

### 🟡 Почти точное (9–11/12, различие только в форме слова) — 6 категорий
| Категория | Совпало | Расхождения |
|---|---|---|
| Museums | 11/12 | `express` в книге дан как `express (v.)` — фактически совпадение |
| Selecting a Restaurant | 11/12 | книга `suggest`, в данных `suggestion` |
| Cooking as a Career | 11/12 | книга `demanding`, в данных `demand` |
| Health Insurance | 11/12 | ⚠️ книга `salary`, в данных `assess` (реальная ошибка прошлой правки) |
| Doctors Office | 10/12 | книга `annual`/`recommend`, в данных `annually`/`recommendation` |
| Music | 9/12 | книга `broad`/`favorite`/`preference`, в данных `broaden`/`favor`/`prefer` |

### ❌ Полностью «не из книги» (0/12) — 18 категорий
Business Planning, Office Technology, Office Procedures, Correspondence,
Applying and Interviewing, Promotions/Pensions/Awards, Ordering Supplies, Inventory,
Investments, Financial Statements, Product Development, Eating Out, Ordering Lunch,
Events, General Travel, Airlines, Trains, Theater.

### 🔶 Частично (1–3/12) — 18 категорий
Contracts, Marketing, Warranties, Conferences, Computers, Electronics,
Job Advertising and Recruiting, Hiring and Training, Salaries and Benefits, Shopping,
Shipping, Invoices, Banking, Accounting, Taxes, Property and Departments,
Renting and Leasing, Hotels.

> Полная таблица «урок → категория → сколько из 12 совпало» приведена в
> `toeic_audit_categories.md` (если нужно — сгенерирую детальную таблицу слово-в-слово).

---

## 3. Ошибки в переводах (RU / KO)

### 3.1 Явные ошибки (16 карточек)

| Карточка | Проблема | Как должно быть |
|---|---|---|
| `brief` (Business Planning, Office Procedures) | KO `간략한` — прилагательное, а слово учится как глагол «ввести в курс дела»; **пример RU вообще не про brief** («Юрисконсульт подготовил письменное заключение…») | KO `설명하다`; пример: «Директор ввёл совет в курс стратегии» |
| `post` (Applying, Hiring) | RU `должность` (сущ.) ≠ KO `게시하다` (глагол «опубликовать») | привести RU и KO к одному смыслу |
| `check` (Ordering Supplies, Invoices, Banking) | RU `чек` (сущ.) ≠ KO `확인하다` (глагол «подтвердить»). Пример «pay by check» → нужен `чек/수표` | KO `수표` |
| `compound` (Investments) | RU `сложный` и KO `복합 단지` («жилой комплекс») неверны для «compound interest» | RU `сложный процент`, KO `복리` |
| `drive` (Electronics) | RU `диск` — это «disk», а `drive` = накопитель/дисковод | RU `накопитель` |
| `carrier` (Shipping, Inventory, Trains) | KO `운송業者` — битый символ (китайский иероглиф 業) | KO `운송업자` |
| `commencement` (Theater) | RU `начало` ≠ KO `졸업식` (выпускной) — разные смыслы | унифицировать |
| `engage` (Contracts) | RU `нанимать` ≠ KO `참여하다` (участвовать) | KO `고용하다` |
| `document` (Computers) | RU `документировать` (глагол) ≠ KO `문서` (сущ.) | унифицировать |
| `file` (Office Procedures) | RU/KO `файл/파일` (сущ.), а пример использует глагол «подшить/оформить» | привести к глаголу |

### 3.2 Слово не в своей категории (1 карточка)
`monitor` (Office Technology) — дано как глагол «отслеживать» (`점검하다`), но в книге
`monitor` относится к уроку 50 (Pharmacy), а в «Office Technology» его нет.

### 3.3 Мелкие замечания (не блокируют, но стоит поправить)
- `arrear` — нестандартная форма ед. ч.; в книге/речи «in arrears».
- `bank` / `debit` (×2) — слово дано существительным, а пример использует глагол.
- `attention` (Shipping) — буквальный перевод «внимание»; в деловой переписке это «на имя / к сведению».
- `compensation` (Job Advertising) — «компенсация»; в HR-контексте точнее «оплата труда / вознаграждение».
- `courtesy` (Hotels) — «любезность», но в примере `courtesy van` = «бесплатный микроавтобус».
- `cot` (Hotels) — «детская кроватка» (это crib); `cot` = раскладная кровать.
- `collate` (Office Procedures) — KO `편집하다` («редактировать»), а `collate` = сортировать/сшивать.
- `delicious` (Ordering Lunch) — слишком базовое слово для «600 essential words».
- Примеры с «utility bill / real estate agent / customer experience» в категориях, где нужен другой контекст (ресторан, туризм, HR).

### 3.4 Явно не-тематические / не для TOEIC (5 карточек)
`compere`, `congregate`, `choreographer` (Theater) и `choreograph` (Theater + Events) —
редкая/узкоспециальная лексика, отсутствующая в Word Index книги.

---

## 4. Вывод

- **Строго по книге:** соответствует **192 из 600** (32%); не соответствует **408** (68%).
- **Тематически:** почти все слова TOEIC-уместны; реально «не в тему» лишь ~5 карточек.
- **Переводы:** ~16 карточек с явными ошибками, ~1 слово не в своей категории,
  ~15 мелких замечаний; остальные переводы корректны.

Чтобы довести проект до полного соответствия книге, нужно привести 36 «не-книжных»
категорий (аналогично тому, как это уже сделано для 14 категорий в `fix_words_exact.py`),
а также исправить перечисленные ошибки переводов.
