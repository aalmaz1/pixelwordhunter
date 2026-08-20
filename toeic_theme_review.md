# Отчёт: приведение лексики к книге «600 Essential Words for the TOEIC»

## Проблема, выявленная при сверке с первоисточником

Первоначальный аудит и первая правка исходили из «тематической уместности» слов.
При сверке с реальной книгой **Lin Lougheed «600 Essential Words for the TOEIC»
(Barron's)** выяснилось, что книга учит **общую (general) деловую лексику в
тематическом контексте**, а не специализированные термины. Сама книга прямо
пишет: «The new words taught in each chapter are not specialized words».

Поэтому реальные слова по урокам отличаются и от исходных данных проекта, и от
первой (тематической) правки. По запросу пользователя решено привести затронутые
категории к **точным 12 словам соответствующих уроков книги**.

## Что сделано

14 категорий (7 полностью переписаны ранее + 7 с точечными заменами) приведены к
**точным спискам слов из книги** (проверено по Word Index книги и независимым
разборам уроков). Для каждой карточки заново написан перевод EN→RU, перевод EN→KO
и примеры-предложения на трёх языках.

### Точные слова из книги по урокам

| Урок | Категория | 12 слов книги |
|---|---|---|
| 27 | Board Meeting and Committees | adhere to, agenda, bring up, conclude, go ahead, goal, lengthy, matter, periodically, priority, progress, waste |
| 28 | Quality Control | brand, conform, defect, enhance, garment, inspect, perceive, repel, take back, throw out, uniform, wrinkle |
| 31 | Selecting a Restaurant | appeal, arrive, compromise, daring, familiar, guide, majority, mix, rely, secure, subjective, suggestion |
| 34 | Cooking as a Career | accustom to, apprentice, culinary, demand, draw, incorporate, influx, method, outlet, profession, relinquish, theme |
| 40 | Car Rentals | busy, coincide, confusion, contact, disappoint, intend, license, nervous, optional, tempt, thrill, tier |
| 41 | Movies | attain, combine, continue, description, disperse, entertainment, influence, range, release, represent, separate, successive |
| 43 | Music | available, broaden, category, disparate, divide, favor, instinct, prefer, reason, relaxation, taste, urge |
| 44 | Museums | acquire, admire, collection, criticism, express, fashion, leisure, respond, schedule, significant, specialize, spectrum |
| 45 | Media | assignment, choose, constant, constitute, decisive, disseminate, impact, in depth, investigative, link, subscribe, thorough |
| 46 | Doctors Office | annually, appointment, assess, diagnose, effective, instrument, manage, prevent, recommendation, record, refer, serious |
| 47 | Dentists Office | aware, catch up, distraction, encouragement, evident, habit, illuminate, irritate, overview, position, regularly, restore |
| 48 | Health Insurance | allow, alternative, aspect, assess, concern, emphasize, incur, personnel, policy, portion, regardless, suitable |
| 49 | Hospitals | admit, authorization, designate, escort, identify, mission, permit, pertinent, procedure, result, statement, usual |
| 50 | Pharmacy | consult, control, convenient, detect, factor, interaction, limit, monitor, potential, sample, sense, volunteer |

### Переводы, исправленные в первой правке (остаются в силе)

`convention→съезд`, `capacity→ёмкость`, `monitor→отслеживать`, `position→должность`,
`increment→прибавка`, `backlog→невыполненные заказы`, `adjust→корректировать`,
`appreciate→расти в цене`, `bracket→налоговая категория`, `aroma→аромат`,
`choreograph→ставить хореографию`, `assemble→собираться`, `assembly→сбор` —
эти слова уже были в книге, исправлялся только перевод.

## Итог

- **600 карточек**, по 12 в каждой из 50 категорий.
- **458 уникальных английских терминов** (было 325 в исходнике).
- Затронутые категории содержат **ровно слова книги**.
- `rus == correct` для всех карточек, пустых переводов и плейсхолдеров нет.
- Тесты: **25/25 пройдено**, `vite build` успешен.
- Файл синхронизирован с `public/words_optimized.json`.

## Примечания

- Скрипт миграции: **`fix_words_exact.py`** (идемпотентный). Файл `fix_words.py`
  оставлен как история первой (тематической) правки.
- У существующих пользователей прогресс привязан к `id` карточек, поэтому для
  переписанных слов статистика начнётся заново. При необходимости можно подготовить
  миграцию прогресса по старому `id`.
- Остальные 36 категорий не трогались; при желании их тоже можно сверить с книгой
  (это потребует отдельной проверки по Word Index всех 50 уроков).
