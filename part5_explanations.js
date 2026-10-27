/**
 * Part 5 Reading Explanations — simplified EN + RU
 *
 * Transforms dry grammar-rule explanations into plain language.
 * Each entry: { en: simplifiedEnglish, ru: русскийTranslation }
 *
 * Matched by substring of the original explanation.
 * Falls back to generic simplification if no pattern matches.
 */

const PART5_SIMPLIFICATIONS = {
  // ── Grammar structure patterns ──────────────────────────

  'Article + ___ + noun → adjective': {
    en: 'The blank needs an adjective to describe the noun. Look for words ending in -al, -ive, -ous, -ful, or -able.',
    ru: 'На месте пропуска нужен прилагательное, описывающее существительное. Ищите слова на -al, -ive, -ous, -ful, -able.'
  },
  'Adjective + ___ → noun': {
    en: 'The blank needs a noun. "Make a decision" is a common phrase to remember.',
    ru: 'На месте пропуска нужно существительное. Запомните фразу "make a decision".'
  },
  'Verb + ___ + noun → the blank modifies the noun': {
    en: 'The blank describes the noun, so it needs an adjective, not a verb.',
    ru: 'Пропуск описывает существительное, поэтому нужно прилагательное, а не глагол.'
  },
  'Preposition + ___ → noun': {
    en: 'After a preposition, the blank needs a noun (or a gerund -ing form). "Years of experience" is a fixed phrase in job ads.',
    ru: 'После предлога на месте пропуска нужно существительное (или герундий -ing). "Years of experience" — устоявшаяся фраза.'
  },
  'a / an / the + (adjective) + ______ + of': {
    en: 'The blank needs a noun. Structure: article + adjective + noun + of.',
    ru: 'На месте пропуска нужно существительное. Строка: артикль + прилагательное + существительное + of.'
  },
  'the + ______ + noun': {
    en: 'The blank needs an adjective to describe the noun.',
    ru: 'На месте пропуска нужно прилагательное для описания существительного.'
  },
  'Possessive + ___ + noun': {
    en: 'The blank needs an adjective. Words ending in -ing can be nouns too (handling, planning), so check what the blank actually describes.',
    ru: 'На месте пропуска нужно прилагательное. Слова на -ing могут быть существительными (handling, planning) — проверяйте, что именно описывает пропуск.'
  },
  'article + ___ + adjective + noun → adverb': {
    en: 'The blank is an adverb modifying the adjective (unusually high, exceptionally large).',
    ru: 'На месте пропуска наречие, описывающее прилагательное (unusually high, exceptionally large).'
  },
  'be + ___ + p.p. → adverb': {
    en: 'The blank is an adverb. Common pairs: warmly received, enthusiastically received, widely reported.',
    ru: 'На месте пропуска наречие. Частые сочетания: warmly received, enthusiastically received, widely reported.'
  },
  'be + ______ + past participle': {
    en: 'The blank is almost always an adverb ending in -ly.',
    ru: 'На месте пропуска почти всегда наречие на -ly.'
  },
  'be + ___ + past participle': {
    en: 'The blank is almost always an adverb ending in -ly.',
    ru: 'На месте пропуска почти всегда наречие на -ly.'
  },
  'Verb (+ object) + ______: describing HOW': {
    en: 'The blank describes how an action is done, so it needs an adverb.',
    ru: 'Пропуск описывает, как выполняется действие, поэтому нужно наречие.'
  },
  'so + adjective/adverb + that': {
    en: 'Pattern: so + adjective/adverb + that. Ask what the blank describes — if it is a verb or participle, it needs an -ly adverb.',
    ru: 'Строка: so + прилагательное/наречие + that. Если пропуск описывает глагол или причастие — нужен наречие на -ly.'
  },
  'Adverbs modify adjectives and comparatives too': {
    en: 'Adverbs can also modify adjectives and comparatives: significantly lower, considerably higher, slightly better.',
    ru: 'Наречия могут описывать прилагательные и сравнительные степени: significantly lower, considerably higher, slightly better.'
  },
  'Adverbs modify verbs and usually sit right before': {
    en: 'In a passive sentence, the adverb goes right before the past participle: was + ADV + decorated.',
    ru: 'В пассивном предложении наречие ставится перед причастием: was + наречие + decorated.'
  },
  'People feel -ED': {
    en: 'People feel -ED (confused, interested). Things that cause the feeling are -ING (confusing, interesting).',
    ru: 'Люди чувствуют -ED (confused, interested). Вещи, вызывающие чувство, — -ING (confusing, interesting).'
  },
  'Noun + ___ + prepositional phrase': {
    en: 'The blank is a reduced relative clause. Use -ed for passive meaning, -ing for active meaning.',
    ru: 'Пропуск — сокращённое придаточное. Используйте -ed для пассивного значения, -ing для активного.'
  },
  'Noun + past participle = passive meaning': {
    en: 'Noun + past participle = passive (reports submitted late). Noun + -ing = active (staff submitting reports).',
    ru: 'Существительное + причастие = пассив (reports submitted late). Существительное + -ing = актив (staff submitting reports).'
  },
  '"Those + p.p./-ing"': {
    en: '"Those + past participle / -ing" means "the people who..." (Those interested, Those attending).',
    ru: '"Those + причастие / -ing" означает "люди, которые..." (Those interested, Those attending).'
  },
  '"Those + p.p./-ing" = the people who': {
    en: '"Those + past participle / -ing" means "the people who..." (Those interested, Those attending, Those invited).',
    ru: '"Those + причастие / -ing" — "люди, которые..." (Those interested, Those attending, Those invited).'
  },

  // ── Time and tense ───────────────────────────────────────

  'In time clauses (when, as soon as, once, after)': {
    en: 'In time clauses with "when", "as soon as", "once", or "after", use the present tense even for future actions.',
    ru: 'В временных придаточных с when, as soon as, once, after используется настоящее время, даже о будущем.'
  },
  'by the time + past simple': {
    en: 'With "by the time" + past simple, use past perfect in the other clause. With "by the time" + present simple, use future perfect.',
    ru: 'By the time + прошедшее время → в другом предложении past perfect. By the time + настоящее время → future perfect.'
  },
  'By the time + present tense (future meaning)': {
    en: '"By the time" + present tense (future meaning) + future perfect "will have + past participle".',
    ru: '"By the time" + настоящее время (будущее значение) + future perfect "will have + причастие".'
  },
  'Always scan the sentence for time markers': {
    en: 'Always look for time markers (next, last, since, by the time) before choosing a verb tense.',
    ru: 'Всегда ищите временные маркеры (next, last, since, by the time) перед выбором времени глагола.'
  },
  'Time adverbs like': {
    en: 'Time adverbs like "now", "currently", "today" signal present tense. Check the surrounding verb tense first.',
    ru: 'Наречия времени (now, currently, today) указывают на настоящее время. Сначала проверяйте время глагола.'
  },
  'A time phrase like "in the next couple of days"': {
    en: 'A time phrase like "in the next couple of days" signals a planned future action, often expressed with present continuous (is/am/are + V-ing).',
    ru: 'Временная фраза "in the next couple of days" указывает на запланированное будущее действие — часто используем present continuous (is/am/are + V-ing).'
  },
  'A sentence starting with Had/Should/Were without "if"': {
    en: 'A sentence starting with Had, Should, or Were without "if" is an inverted conditional. Had → would have + past participle.',
    ru: 'Начало с Had, Should, Were без "if" — инверсный условный. Had → would have + причастие.'
  },
  'Had + subject + past participle': {
    en: 'Inverted conditional: Had + subject + past participle ..., subject + would have + past participle (= If + had ...).',
    ru: 'Инверсный условный: Had + подлежащее + причастие ..., подлежащее + would have + причастие (= If + had ...).'
  },
  'Inversion in conditionals': {
    en: 'Inversion: Had + S + past participle (past), Should + S + verb (future), Were + S + to/noun (present). Match it with the main clause.',
    ru: 'Инверсия: Had + S + причастие (прошедшее), Should + S + глагол (будущее), Were + S + to/noun (настоящее). Согласуйте с главной частью.'
  },
  'Only after / Not until / Rarely / Never at the start': {
    en: 'Starting with "Only after", "Not until", "Rarely", or "Never" triggers inverted word order: auxiliary + subject + verb.',
    ru: 'Начало с Only after, Not until, Rarely, Never вызывает инверсию: вспомогательный + подлежащее + глагол.'
  },
  'Negative adverbs at the start': {
    en: 'Starting with "Not only", "Rarely", "Seldom", "Never", or "Only after" triggers question word order: auxiliary + subject.',
    ru: 'Начало с Not only, Rarely, Seldom, Never, Only after вызывает порядок вопроса: вспомогательный + подлежащее.'
  },
  'Inverted time expressions': {
    en: 'Fixed inverted patterns: "No sooner had ... THAN ..." / "Hardly (Scarcely) had ... WHEN ..."',
    ru: 'Устойчивые инверсные конструкции: "No sooner had ... THAN ..." / "Hardly (Scarcely) had ... WHEN ..."'
  },
  'First check whether the sentence has a main verb': {
    en: 'First check if the sentence already has a main verb. If not, the blank must be a finite verb.',
    ru: 'Сначала проверьте, есть ли главное сказуемое. Если нет — на месте пропуска сказуемое.'
  },
  'Ongoing action done TO the subject now': {
    en: 'For an ongoing action done to the subject now: am/is/are + being + past participle.',
    ru: 'Для длительного действия, выполняемого над подлежащим: am/is/are + being + причастие.'
  },
  'This is a classic time-clause pattern': {
    en: 'Classic pattern: main clause uses future tense, but the "when" clause stays in simple present — do not put "will" in both clauses.',
    ru: 'Классическая строка: главное предложение в будущем, а придаточное с when — в настоящем. Не ставьте will в оба предложения.'
  },
  'This is the fixed future-perfect time pattern': {
    en: 'Fixed future-perfect pattern: "will have + past participle" + "by the time" + present tense clause.',
    ru: 'Устойчивая конструкция будущего совершенного: "will have + причастие" + "by the time" + придаточное в настоящем.'
  },
  'by the time + past simple → past perfect': {
    en: 'By the time + past simple → past perfect in the other clause; by the time + present simple → future perfect.',
    ru: 'By the time + прошедшее время → past perfect в другом предложении; by the time + настоящее время → future perfect.'
  },

  // ── Prepositions and connectors ──────────────────────────

  'on + day/date, in + month/year, at + clock time': {
    en: 'Use "on" for days and dates, "in" for months and years, "at" for clock times.',
    ru: 'On — для дней и дат, in — для месяцев и лет, at — для времени по часам.'
  },
  'at + clock time (at noon, at 5 P.M.)': {
    en: 'Use "at" for clock times (at noon, at 5 P.M.), "on" for days/dates, "in" for months/years.',
    ru: 'At — для времени (at noon, at 5 P.M.), on — для дней/дат, in — для месяцев/лет.'
  },
  'Check what follows the blank': {
    en: 'Check what follows the blank. If it is a clause (subject + verb), use a conjunction. If it is a noun phrase, use a preposition.',
    ru: 'Проверяйте, что после пропуска. Если придаточное (подлежащее + сказуемое) — союз. Если существительное — предлог.'
  },
  'Before a clause (subject + verb) use a conjunction': {
    en: 'Before a clause (subject + verb) use a conjunction; before a noun phrase use a preposition. "Until" can be both, "by" and "during" cannot.',
    ru: 'Перед придаточным (подлежащее + сказуемое) — союз; перед существительным — предлог. Until — и то, и другое, by и during — нет.'
  },
  'Contrast + clause: although': {
    en: 'Contrast + clause: although, even though, even if. Contrast + noun: despite, in spite of, notwithstanding.',
    ru: 'Противопоставление + придаточное: although, even though, even if. Противопоставление + существительное: despite, in spite of, notwithstanding.'
  },
  'Contrast + clause = although': {
    en: 'Contrast + clause = although / even though. Contrast + noun = despite / in spite of.',
    ru: 'Противопоставление + придаточное = although / even though. Противопоставление + существительное = despite / in spite of.'
  },
  'despite / in spite of + noun': {
    en: 'Use "despite" or "in spite of" before a noun, and "although" or "even though" before a clause.',
    ru: 'Despite / in spite of перед существительным, although / even though перед придаточным.'
  },
  'regardless of / irrespective of + noun': {
    en: '"Regardless of" / "irrespective of" + noun = no matter what the noun is. Common in policy sentences.',
    ru: '"Regardless of" / "irrespective of" + существительное = "независимо от". Часто вpolicy-предложениях.'
  },
  'in lieu of = instead of': {
    en: '"In lieu of" = instead of. "On behalf of" = representing someone. "In charge of" = responsible for.',
    ru: '"In lieu of" = вместо. "On behalf of" = представляя кого-то. "In charge of" = отвечая за.'
  },
  'Fixed preposition phrases': {
    en: 'Fixed preposition phrases: prior to, ahead of, in advance of, subsequent to (= after).',
    ru: 'Устойчивые предложные фразы: prior to, ahead of, in advance of, subsequent to (= после).'
  },
  'comply with / adhere to / conform to': {
    en: 'Use "comply with", "adhere to", "conform to" + rules. "Obey", "follow", "observe" + rules (no preposition).',
    ru: 'Comply with, adhere to, conform to + правила. Obey, follow, observe + правила (без предлога).'
  },
  'Learn the preposition with the adjective': {
    en: 'Learn the preposition that goes with the adjective: contingent on/upon, subject to, eligible for, responsible for, compliant with.',
    ru: 'Учите предлог с прилагательным: contingent on/upon, subject to, eligible for, responsible for, compliant with.'
  },
  'preposition with the adjective': {
    en: 'Learn the preposition that goes with the adjective: contingent on/upon, subject to, eligible for, responsible for, compliant with.',
    ru: 'Учите предлог с прилагательным: contingent on/upon, subject to, eligible for, responsible for, compliant with.'
  },
  'reimbursement of expenses': {
    en: 'Common phrases: "reimbursement of expenses" / "reimburse someone for costs" — typical in TOEIC expense policies.',
    ru: 'Распространённые фразы: "reimbursement of expenses" / "reimburse someone for costs" — типично для TOEIC.'
  },
  'For + period + from + starting point': {
    en: '"For + period + from + starting point" is a common warranty and contract pattern.',
    ru: '"For + период + from + начальная точка" — распространённая конструкция в гарантиях и контрактах.'
  },
  'for the duration of + event': {
    en: '"For the duration of + event" = for the whole time the event lasts.',
    ru: '"For the duration of + событие" = на всё время события.'
  },
  'Preposition + which time': {
    en: 'Preposition + "which time" = after which time, during which time, by which time.',
    ru: 'Предлог + "which time" = после которого времени, в течение которого времени, к которому времени.'
  },
  'Relative expressions like at which point': {
    en: 'Relative expressions like "at which point", "by which time", "in which case" can join clauses. Plain adverbs (then, by then) cannot.',
    ru: 'Относительные выражения (at which point, by which time, in which case) объединяют придаточные. Простые наречия (then, by then) — нет.'
  },
  'Verbs and prepositions pair up as fixed collocations': {
    en: 'Verbs and prepositions pair up: register for, depend on, apply for. Memorize the pair as one unit.',
    ru: 'Глаголы и предлоги образуют устойчивые сочетания: register for, depend on, apply for. Заучите как одно целое.'
  },
  '"Agree with someone"': {
    en: '"Agree with someone" (a person) vs "agree to something" (a plan or proposal) — check what follows the blank.',
    ru: '"Agree with someone" (человек) vs "agree to something" (план или предложение) — проверяйте, что после пропуска.'
  },
  'under pressure': {
    en: 'Idioms like "under pressure" must be learned as a fixed phrase — swapping the preposition is a common trap.',
    ru: 'Идиомы типа "under pressure" нужно учить как целое — замена предлога — распространённая ошибка.'
  },
  'Because of is followed directly by a noun phrase': {
    en: '"Because of" is followed by a noun phrase. "Because" is followed by a subject and verb — check what comes after the blank.',
    ru: '"Because of" — затем существительное. "Because" — затем подлежащее и сказуемое. Проверяйте, что после пропуска.'
  },
  'cause-and-effect': {
    en: 'Trace the logic chain: which event causes which. Wrong answers often reverse the cause-and-effect direction.',
    ru: 'Прослежите цепочку: что вызывает что. Неправильные ответы часто переворачивают причину и следствие.'
  },
  'When a sentence is already grammatically complete': {
    en: 'When the sentence is already grammatically complete, the blank is usually an adverb.',
    ru: 'Если предложение уже грамматически полно, на месте пропуска обычно наречие.'
  },
  'When the sentence is already complete': {
    en: 'When the sentence is already complete, a reflexive pronoun can be added for emphasis (do it yourself, review it herself).',
    ru: 'Если предложение уже полно, можно добавить возвратное местоимение для акцента (do it yourself, review it herself).'
  },
  'When the sentence is already complete, a reflexive pronoun': {
    en: 'When the sentence is already complete, a reflexive pronoun can be added for emphasis (do it yourself, review it herself).',
    ru: 'Если предложение уже полно, можно добавить возвратное местоимение для акцента (do it yourself, review it herself).'
  },
  'When the sentence reads as grammatically complete': {
    en: 'When the sentence is already complete, the blank is usually an adverb — do not overthink it into a noun or adjective.',
    ru: 'Если предложение уже полно, на месте пропуска обычно наречие — не утяжеляйте существительным или прилагательным.'
  },
  'A sentence that is already complete (subject + passive verb)': {
    en: 'A sentence that is already complete (subject + passive verb) only has room for an adverb in the blank.',
    ru: 'Если предложение уже полно (подлежащее + пассивное сказуемое), на месте пропуска только наречие.'
  },
  'When the subject and the object of a sentence refer to the same person': {
    en: 'When the subject and object are the same person, use a reflexive pronoun (himself, herself) instead of a regular pronoun.',
    ru: 'Если подлежащее и дополнение — один человек, используйте возвратное местоимение (himself, herself).'
  },
  'Reflexive pronouns (herself, himself, themselves)': {
    en: 'Reflexive pronouns are used when the subject and object are the same person — "Emily introduced herself" means Emily is both.',
    ru: 'Возвратные местоимения используются, когда подлежащее и дополнение — один человек. "Emily introduced herself" — Эмили и presenter, и presenter.'
  },
  'A reflexive pronoun at the end of a clause': {
    en: 'A reflexive pronoun at the end of a clause can mean "personally / without help": do it yourself, submit it themselves.',
    ru: 'Возвратное местоимение в конце может означать "лично / без помощи": do it yourself, submit it themselves.'
  },

  // ── Purpose and infinitive ───────────────────────────────

  'When the blank explains why someone does something': {
    en: 'When the blank explains why someone does something, look for "to + verb" or "in order to + verb".',
    ru: 'Если пропуск объясняет, почему кто-то что-то делает — ищите "to + глагол" или "in order to + глагол".'
  },
  'To + verb expressing purpose': {
    en: '"To + verb" expresses purpose. "For + noun / V-ing" also expresses purpose but requires a different structure.',
    ru: '"To + глагол" выражает цель. "For + существительное / V-ing" тоже выражает цель, но с другой конструкцией.'
  },
  'To + BASE verb (purpose)': {
    en: '"To + base verb" expresses purpose. Expedite = speed up; expeditious (adj.) = fast.',
    ru: '"To + инфинитив" выражает цель. Expedite = ускорить; expeditious (adj.) = быстрый.'
  },
  'To avoid repeating a singular noun': {
    en: 'To avoid repeating a singular noun before a relative clause, use "the one (that/which)...". Plural: "the ones".',
    ru: 'Чтобы не повторять единственное существительное перед придаточным, используйте "the one (that/which)...". Множественное: "the ones".'
  },
  'The passive pattern "was created by ... to V"': {
    en: 'The passive pattern "was created by ... to V" needs the bare infinitive after "to" — ask "created in order to do what?"',
    ru: 'Пассивная конструкция "was created by ... to V" требует инфинитива после "to" — вопрос: "created in order to do what?"'
  },
  '"Be instructed to do something"': {
    en: '"Be instructed to do something" — after "to" comes the base infinitive, not a passive or perfect form.',
    ru: '"Be instructed to do something" — после "to" инфинитив, не пассив и не perfect.'
  },
  '"Be predicted to do something"': {
    en: '"Be predicted to do something" follows: be + past participle + infinitive. Recognize this passive reporting structure.',
    ru: '"Be predicted to do something" = be + причастие + инфинитив. Это пассивная конструкция передачи информации.'
  },
  'request / recommend / insist / require + that': {
    en: 'After "request", "recommend", "insist", "require" + "that" + subject + base verb (no -s, no tense). Passive: "be + past participle".',
    ru: 'После request, recommend, insist, require + that + подлежащее + инфинитив (без -s, без времени). Пассив: "be + причастие".'
  },
  'require / ask / encourage / allow + someone + TO do': {
    en: 'Use "require / ask / encourage / allow + someone + to do". For "insist / demand / suggest" use "that" clause.',
    ru: 'Require / ask / encourage / allow + кто-то + to do. Insist / demand / suggest — придаточное с that.'
  },
  'It is essential / important / vital / necessary that': {
    en: 'Pattern: "It is essential / important / vital / necessary that + subject + base verb".',
    ru: 'Конструкция: "It is essential / important / vital / necessary that + подлежащее + инфинитив".'
  },
  'In an imperative sentence giving instructions': {
    en: 'In imperative sentences, keep parallel structure: "Respond... and ask..." uses two base-form verbs joined by "and".',
    ru: 'В повелительном предложении сохраняйте параллельную структуру: "Respond... and ask..." — два инфинитива, соединённых "and".'
  },

  // ── Correlative pairs and conjunctions ───────────────────

  'Correlative pairs: either': {
    en: 'Correlative pairs: either...or, neither...nor, both...and, not only...but also. Spot the first word and you have the answer.',
    ru: 'Парные союзы: either...or, neither...nor, both...and, not only...but also. Найдите первое слово — ответ уже ясен.'
  },
  'Correlative pairs: not only': {
    en: 'Correlative pairs: not only ... but also / both ... and / either ... or / neither ... nor.',
    ru: 'Парные союзы: not only ... but also / both ... and / either ... or / neither ... nor.'
  },
  '"only if" = in that one condition': {
    en: '"Only if" = in that one condition. Contrast with "unless" = except if.',
    ru: '"Only if" = только если. В отличие от "unless" = если не.'
  },
  '"Whether...or" is a fixed double-conjunction pattern': {
    en: '"Whether...or" is a fixed pair — do not break it apart with "if...or" or "either...or".',
    ru: '"Whether...or" — устойчивая пара. Не разрывайте "if...or" или "either...or".'
  },
  'so that is a fixed purpose conjunction': {
    en: '"So that" is a fixed purpose conjunction always paired with a clause (subject + verb).',
    ru: '"So that" — устойчивый союз цели, всегда с придаточным (подлежащее + сказуемое).'
  },
  'instead = in place of the original plan': {
    en: 'Instead = in place of the original plan; otherwise = if that does not happen; nevertheless = despite that.',
    ru: 'Instead = вместо исходного плана; otherwise = если этого не случится; nevertheless = несмотря на это.'
  },
  'Cause verbs in TOEIC': {
    en: 'Cause verbs in TOEIC: prompted by, triggered by, attributed to, resulting from. Watch for look-alike words (prompted / promoted).',
    ru: 'Глаголы причины в TOEIC: prompted by, triggered by, attributed to, resulting from. Остерегайтесь созвучных слов (prompted / promoted).'
  },
  '"If" clauses about safety or risk': {
    en: '"If" clauses about safety or risk describe a hypothetical condition and its consequence — check that the second half states a result.',
    ru: 'Придаточные с "If" об опасности описывают гипотетическое условие и его следствие — проверяйте, есть ли результат во второй части.'
  },
  '"If" introduces a conditional clause': {
    en: '"If" introduces a conditional clause — distinguish it from "until" (deadline) or "so" (result).',
    ru: '"If" вводит условное придаточное — не путать с "until" (дедлайн) или "so" (результат).'
  },
  'This sentence tests reading comprehension of the whole logic chain': {
    en: 'This tests reading comprehension of the whole logic chain — trace which event causes which. Wrong answers often reverse cause and effect.',
    ru: 'Тест на понимание логической цепочки — что вызывает что. Неправильные ответы часто переворачивают причину и следствие.'
  },

  // ── Vocabulary and collocations ──────────────────────────

  'For vocabulary questions, test each verb with its object': {
    en: 'For vocabulary questions, test each verb with its object: present results, attend a meeting, remind someone.',
    ru: 'Для вопросов по лексике проверяйте глагол с дополнением: present results, attend a meeting, remind someone.'
  },
  'Learn adverb collocations as units': {
    en: 'Learn adverb collocations as units: fully booked, highly recommended, widely used, deeply concerned.',
    ru: 'Учите сочетания наречий целиком: fully booked, highly recommended, widely used, deeply concerned.'
  },
  'Memorize: a wide range of': {
    en: 'Memorize: a wide range of, a wide variety of, a wide selection of.',
    ru: 'Запомните: a wide range of, a wide variety of, a wide selection of.'
  },
  'Regarding, concerning, and about are interchangeable': {
    en: '"Regarding", "concerning", and "about" are interchangeable in TOEIC business sentences.',
    ru: '"Regarding", "concerning", "about" взаимозаменяемы в TOEIC.'
  },
  'High-level verbs for faster/easier': {
    en: 'High-level verbs for faster/easier: expedite, accelerate, streamline, facilitate.',
    ru: 'Высокий стиль для "быстрее/проще": expedite, accelerate, streamline, facilitate.'
  },
  'Synonyms to know: mandatory': {
    en: 'Synonyms to know: mandatory = compulsory = required = obligatory; the opposite is optional.',
    ru: 'Синонимы: mandatory = compulsory = required = obligatory; противоположность — optional.'
  },
  'repeal / revoke / abolish a law': {
    en: '"Repeal", "revoke", "abolish" a law = cancel it. "Enact", "pass" a law = create it.',
    ru: '"Repeal", "revoke", "abolish" закон = отменить. "Enact", "pass" закон = принять.'
  },
  'Phrasal verbs (come up with': {
    en: 'Phrasal verbs (come up with, drop by, look in on, run out of) carry a fixed meaning — memorize them as whole units.',
    ru: 'Фразовые глаголы (come up with, drop by, look in on, run out of) имеют фиксированное значение — учите целиком.'
  },
  'production / seating / storage capacity': {
    en: '"Production / seating / storage capacity" = the maximum amount something can hold or produce.',
    ru: '"Production / seating / storage capacity" = максимальный объём, который что-то может вместить или произвести.'
  },
  '"Be promoted to + position"': {
    en: '"Be promoted to + position" is a high-frequency TOEIC phrase. Also learn "be transferred to + place".',
    ru: '"Be promoted to + должность" — часто встречается в TOEIC. Также учите "be transferred to + место".'
  },
  '"Work closely with"': {
    en: '"Work closely with" = cooperate tightly. Do not confuse with "close" as an adjective (a close friend).',
    ru: '"Work closely with" = тесно сотрудничать. Не путать с "close" как прилагательным (a close friend).'
  },
  '"Those invited"': {
    en: '"Those + past participle / -ing" = the people who... (Those interested, Those attending, Those invited).',
    ru: '"Those + причастие / -ing" = люди, которые... (Those interested, Those attending, Those invited).'
  },
  '"Brief statement" is a natural, fixed collocation': {
    en: '"Brief statement" is a fixed collocation meaning "a short statement". Always sanity-check meaning first.',
    ru: '"Brief statement" — устойчивое сочетание = "краткое заявление". Сначала проверяйте смысл.'
  },
  '"Approved vendors" is a fixed collocation': {
    en: '"Approved vendors" — "approved" functions as an adjective. A common trap is picking the verb form "approve" instead.',
    ru: '"Approved vendors" — "approved" как прилагательное. Ошибка — глагол "approve".'
  },
  '"For + period + from + starting point" is a common warranty': {
    en: '"For + period + from + starting point" is a common warranty and contract pattern.',
    ru: '"For + период + from + начальная точка" — распространённая конструкция в гарантиях и контрактах.'
  },
  'Audit / quality vocabulary': {
    en: 'Audit / quality vocabulary: discrepancy, inconsistency, deviation, defect, error.',
    ru: 'Термины аудита и качества: discrepancy, inconsistency, deviation, defect, error.'
  },
  '-able/-ible adjectives = can be ___': {
    en: '-able / -ible adjectives mean "can be ___" (measurable, noticeable, achievable). Prefer them when the meaning is "possible".',
    ru: 'Прилагательные на -able / -ible = "можно ___" (measurable, noticeable, achievable). Уместны, когда значение "возможно".'
  },
  'Learn the full phrase: visitors from as far away as': {
    en: 'Learn the full phrase: "visitors from as far away as..."',
    ru: 'Учите фразу целиком: "visitors from as far away as..."'
  },
  '"Increased by X percent"': {
    en: '"Increased by X percent" uses "by" to show the amount of change — memorize this pattern.',
    ru: '"Increased by X percent" — by указывает величину изменения. Заучите.'
  },
  '"Limited to" a number': {
    en: '"Limited to" a number is a fixed collocation for capping a quantity.',
    ru: '"Limited to" + число — устойчивое сочетание для ограничения количества.'
  },
  '"Little" has an irregular comparative form': {
    en: '"Little" has an irregular comparative ("less") — learn irregular comparatives by heart.',
    ru: '"Little" — иррегулярное сравнительное ("less"). Учите иррегулярные формы наизусть.'
  },
  '"Provide something to someone" needs a noun': {
    en: '"Provide something to someone" needs a noun referring to people after the blank.',
    ru: '"Provide something to someone" — после пропуска нужно существительное, обозначающее людей.'
  },
  '"Register for", "depend on", "apply for"': {
    en: 'Verbs and prepositions pair up: register for, depend on, apply for. Memorize the pair as one unit.',
    ru: 'Глаголы и предлоги: register for, depend on, apply for. Заучите как одно целое.'
  },
  'serve as / act as / function as + role': {
    en: '"Serve as" / "act as" / "function as" + role. "Like" compares, "as" states the role.',
    ru: '"Serve as" / "act as" / "function as" + роль. "Like" сравнивает, "as" обозначает роль.'
  },
  '"Shortly before / shortly after"': {
    en: '"Shortly before / shortly after" = soon before / soon after. Use the adverb, not "short".',
    ru: '"Shortly before / shortly after" = вскоре до / вскоре после. Используйте наречие, не "short".'
  },
  '"In comparisons, replace a singular noun with "that"': {
    en: 'In comparisons, replace a singular noun with "that" and a plural noun with "those".',
    ru: 'В сравнениях единственное существительное заменяем "that", множественное — "those".'
  },
  'tentatively = provisionally': {
    en: '"Tentatively" = provisionally (tentatively scheduled, tentatively approved), often with "pending" or "subject to".',
    ru: '"Tentatively" = условно (tentatively scheduled, tentatively approved), часто с "pending" или "subject to".'
  },
  '"Given + noun / Given that + clause"': {
    en: '"Given + noun" / "Given that + clause" = because of / considering. Very common at the start of TOEIC sentences.',
    ru: '"Given + существительное" / "Given that + придаточное" = учитывая. Часто в начале TOEIC-предложений.'
  },
  'Adverbs like solely, primarily, exclusively': {
    en: 'Adverbs like solely, primarily, exclusively, partly can modify a whole phrase (solely to cover, primarily for).',
    ru: 'Наречия solely, primarily, exclusively, partly могут описывать всю фразу (solely to cover, primarily for).'
  },
  'appoint / assign / designate someone to': {
    en: '"Appoint / assign / designate someone to (do) a role" — fixed collocations for roles.',
    ru: '"Appoint / assign / designate someone to (do) a role" — устойчивые сочетания для ролей.'
  },
  '"Documents detailing X" is a reduced relative clause': {
    en: '"Documents detailing X" = "documents which detail X" — an -ing word after a noun often replaces a "which/who + verb" clause.',
    ru: '"Documents detailing X" = "documents which detail X" — -ing после существительного часто заменяет придаточное.'
  },
  '"Dedicated to" is followed by a gerund (-ing)': {
    en: '"Dedicated to" is followed by a gerund (-ing), not the base verb — treat "to" here as a preposition.',
    ru: '"Dedicated to" — затем герундий (-ing), не инфинитив. Here "to" — предлог.'
  },
  '"Based on" is a fixed expression': {
    en: '"Based on" = determined by. When something depends on or is calculated from a factor, use "based on".',
    ru: '"Based on" = определяется. Если что-то зависит от фактора — "based on".'
  },
  '"As observed by"': {
    en: '"As observed by..." = reduced passive clause. After "As" introducing this kind of clause, expect a past participle.',
    ru: '"As observed by..." — сокращённое пассивное придаточное. После "As" — причастие.'
  },
  '"Be distributed"': {
    en: 'Passive version: "be + past participle". After "request / recommend / insist / require + that" + subject + base verb.',
    ru: 'Пассив: "be + причастие". После "request / recommend / insist / require + that" + подлежащее + инфинитив.'
  },
  '"For the past decade" is the exact trigger phrase': {
    en: '"For the past decade" triggers present perfect — not simple past or present tense.',
    ru: '"For the past decade" вызывает present perfect — не простой прошедший или настоящее время.'
  },
  '"Have been" is always followed by a past participle': {
    en: '"Have been" is always followed by a past participle (V3), never a plain base verb or present participle.',
    ru: '"Have been" всегда с причастием (V3), не с инфинитивом или present participle.'
  },
  '"Having joined"': {
    en: '"Having joined Vince\'s Gym, Mr. Pinter could attend" is a reduced participle clause = "Because Mr. Pinter has joined..."',
    ru: '"Having joined Vince\'s Gym, Mr. Pinter could attend" — сокращённое причастное придаточное = "Because Mr. Pinter has joined..."'
  },
  '"Restore something to its original condition"': {
    en: '"Restore something to its original condition" is a fixed phrase.',
    ru: '"Restore something to its original condition" — устойчивая фраза.'
  },
  '"Accommodate" (to provide space for a group)': {
    en: '"Accommodate" means to provide space for a group. It is easily confused with similar-sounding words.',
    ru: '"Accommodate" = обеспечить место для группы. Часто путают со созвучными словами.'
  },
  '"Among" is the trap that comes to mind for "among"': {
    en: '"Between" is for two, "among" is for three or more. "Volunteers" (a group) signals "among".',
    ru: '"Between" — для двух, "among" — для трёх и более. "Volunteers" (группа) сигнализирует "among".'
  },
  '"Between time and time"': {
    en: '"Between" pairs with "and" when bracketing a time range (between Monday and Friday).',
    ru: '"Between" с "and" для временного диапазона (between Monday and Friday).'
  },
  '"Due to" (meaning "because of")': {
    en: '"Due to" means "because of". "Due" alone means "expected/scheduled" — very different roles.',
    ru: '"Due to" = из-за. "Due" alone = ожидается/запланировано — разные роли.'
  },
  '"Each" is a frequent wrong pick': {
    en: '"Each" must be followed by a singular noun. Check the number of the noun after the quantifier.',
    ru: '"Each" требует единственного существительного. Проверяйте число после квантора.'
  },
  '"Elsewhere" (somewhere else)': {
    en: '"Elsewhere" = somewhere else. Often signals contrast with a usual location.',
    ru: '"Elsewhere" = в другом месте. Часто противопоставляется обычному месту.'
  },
  '"Enthusiast" (B, a noun for a person)': {
    en: '"Enthusiast" is a noun. A blank modifying a verb always needs an adverb, not a noun.',
    ru: '"Enthusiast" — существительное. Пропуск, описывающий глагол, всегда требует наречия.'
  },
  '"Everyone" is a singular pronoun': {
    en: '"Everyone" is a singular pronoun despite referring to a group — takes singular verbs.',
    ru: '"Everyone" — единственное число, несмотря на группу. Требует глагола в единственном числе.'
  },
  '"Excited" (C) is the classic trap': {
    en: 'People are "excited". Things that cause excitement are "exciting" — check what the blank describes.',
    ru: 'Люди "excited". Вещи, вызывающие воодушевление, — "exciting". Проверяйте, что описывает пропуск.'
  },
  '"Follow" (B) and "unfold" (D)': {
    en: '"Follow" and "unfold" are plausible verbs, but "limit" is the only one matching "keep within a length constraint".',
    ru: '"Follow" и "unfold" подходят грамматически, но "limit" единственно, что означает "ограничить длину".'
  },
  '"Minor" (small in importance)': {
    en: '"Minor" = small in importance. "Critical" = very important. Read the full sentence for contrast clues.',
    ru: '"Minor" = мелкий. "Critical" = важный. Читай всё предложение для контраста.'
  },
  '"Natural" (B, adjective) is the classic trap': {
    en: '"Natural" is an adjective, "naturally" is an adverb. Check whether the blank modifies a noun or a verb/adjective.',
    ru: '"Natural" — прилагательное, "naturally" — наречие. Проверяйте, что описывает пропуск.'
  },
  '"Only" (limited to no more than)': {
    en: '"Only" can be an adverb or adjective depending on position. Check exactly what it is meant to restrict.',
    ru: '"Only" — наречие или прилагательное в зависимости от позиций. Проверяйте, что именно ограничивает.'
  },
  '"Others" is a common wrong pick': {
    en: '"Others" implies other people were already mentioned. "Anyone" introduces a new, general person.',
    ru: '"Others" — другие уже упомянуты. "Anyone" — новый общий человек.'
  },
  '"Presentation" and "presenting" both sound reasonable': {
    en: '"Presentable" (adjective: neat/attractive) is the only option fitting both grammar and meaning after "is".',
    ru: '"Presentable" (прилагательное: опрятный/привлекательный) — единственный вариант после "is".'
  },
  '"Thereafter" (from that point onward)': {
    en: '"Thereafter" = from that point onward. Common in TOEIC reading passages.',
    ru: '"Thereafter" = с этого момента. Часто в TOEIC-текстах.'
  },
  '"Toward" (in the direction of)': {
    en: '"Toward" = in the direction of, closer to. Check whether the sentence describes movement toward something.',
    ru: '"Toward" = в направлении, ближе к. Проверяйте, описывает ли предложение движение.'
  },
  '"Us" (D, object pronoun) is a common wrong pick': {
    en: 'A blank standing alone with no following noun needs the absolute possessive form "ours", not the object pronoun "us".',
    ru: 'Пропуск без существительного после нуждается в обособленном притяжательном "ours", не в "us".'
  },
  '"Variously" (in several different ways)': {
    en: '"Variously" = in several different ways. Do not pick a degree adverb (like "very") instead.',
    ru: '"Variously" = разными способами. Не путать с наречием степени (very).'
  },
  '"Whatever" (meaning "it doesn\'t matter what")': {
    en: '"Whatever" = it doesn\'t matter what. Match it to exactly what kind of uncertainty the sentence expresses.',
    ru: '"Whatever" = неважно, что. Соотносите с тем, какой неопределённость в предложении.'
  },
  '"With" (B) is a strong trap': {
    en: '"While" can mean "together with" in casual speech, but grammatically it needs a clause. "With" is the correct preposition for "send X together with Y".',
    ru: '"While" в разговорной речи может означать "вместе с", но грамматически требует придаточного. "With" — правильный предлог.'
  },
  '"Who" (B) and "them" (C) are common wrong picks': {
    en: '"Who" is a relative pronoun, "them" is an object pronoun. Only "anyone" can stand alone as the subject.',
    ru: '"Who" — относительное местоимение, "them" — дополнение. Только "anyone" может быть подлежащим.'
  },
  '"Who" (D) is the classic trap for "whose"': {
    en: '"Who" replaces a subject/object. "Whose" shows possession. Check whether the clause needs a person or something that person owns.',
    ru: '"Who" — подлежащее/дополнение. "Whose" — притяжательное. Проверяйте, нужно ли лицо или его собственность.'
  },
  '"Who" replacing "Beta Airways passengers"': {
    en: '"Who" is a relative clause structure. Always identify what the relative pronoun is replacing (subject vs object vs possessive).',
    ru: '"Who" — придаточное. Определяйте, что заменяется: подлежащее, дополнение или притяжательное.'
  },
  '"Will + adverb + verb" places the adverb between the modal and the main verb': {
    en: '"Will + adverb + verb" — the adverb goes between the modal and the main verb.',
    ru: '"Will + наречие + глагол" — наречие между модальным и основным глаголом.'
  },
  '"To + verb" expressing purpose': {
    en: '"To + verb" expresses purpose. "For + noun / V-ing" also expresses purpose but requires a different structure after it.',
    ru: '"To + глагол" выражает цель. "For + существительное / V-ing" тоже, но с другой конструкцией.'
  },
  '"Visiting"': {
    en: 'Learn the full phrase: "visitors from as far away as..."',
    ru: 'Учите фразу: "visitors from as far away as..."'
  },
  '"Accommodate"': {
    en: '"Accommodate" means to provide space for a group. Easily confused with similar-sounding words.',
    ru: '"Accommodate" = обеспечить место для группы. Часто путают со созвучными словами.'
  },
  '"Agreed" (D) is a strong trap': {
    en: '"Agreed" implies terms are already settled. "Agreeable" means acceptable to both sides — check the sentence context.',
    ru: '"Agreed" — условия уже согласованы. "Agreeable" — приемлемо для обеих сторон. Проверяйте контекст.'
  },
  '"Alleviated" alone in an active form': {
    en: 'Pain is always the receiver of relief (passive). Since a doctor predicts a future outcome, use the future passive "will be alleviated".',
    ru: 'Боль — всегда объект облегчения (пассив). Если врач предсказывает будущее — будущий пассив "will be alleviated".'
  },
  '"Among" (D) is tempting': {
    en: '"Between" is for two. "Among" is for three or more. "Volunteers" signals "among".',
    ru: '"Between" — для двух. "Among" — для трёх и более. "Volunteers" сигнализирует "among".'
  },
  '"Appearance" (how something looks to others)': {
    en: '"Appearance" = how something looks to others. Easily confused with related but different words.',
    ru: '"Appearance" = то, как что-то выглядит для других. Часто путают со связанными словами.'
  },
  '"As long as" is a strong distractor': {
    en: '"As long as" also expresses condition, but the sentence needs a different connector — check the exact relationship.',
    ru: '"As long as" тоже выражает условие, но предложению нужен другой союз — проверяйте точное отношение.'
  },
  '"Athletic" (strong, healthy, good at sports)': {
    en: '"Athletic" describes physical strength. Check if the sentence is about physical performance.',
    ru: '"Athletic" = физическая сила. Проверяйте, о физической форме ли речь.'
  },
  '"Attract" (A, verb) and "attracted" (C, past participle)': {
    en: '"Attract" is a verb, "attracted" is a past participle. Check the grammatical role the blank needs.',
    ru: '"Attract" — глагол, "attracted" — причастие. Проверяйте грамматическую роль.'
  },
  '"Attracts" (to pull/draw people or things by appealing qualities)': {
    en: '"Attracts" = to pull/draw people or things. Check if the sentence describes drawing something toward itself.',
    ru: '"Attracts" = привлекать людей или вещи. Проверяйте, описывает ли предложение притягивание.'
  },
  '"Be promoted to + position" is a high-frequency TOEIC phrase': {
    en: '"Be promoted to + position" is a high-frequency TOEIC phrase. Also learn "be transferred to + place".',
    ru: '"Be promoted to + должность" — часто в TOEIC. Также "be transferred to + место".'
  },
  '"Because" is tempting since the sentence involves a condition': {
    en: '"Because" is tempting, but the sentence needs a different connector — check the exact logical relationship.',
    ru: '"Because" кажется правильным, но предложению нужен другой союз — проверяйте логическое отношение.'
  },
  '"Between time and time" (e.g. "between Monday and Friday")': {
    en: '"Between" pairs with "and" when bracketing a time range. Do not use "from...to" or "among".',
    ru: '"Between" с "and" для временного диапазона. Не "from...to" или "among".'
  },
  '"Colleague" (a co-worker, one of a group working together)': {
    en: '"Colleague" = a co-worker, one of a group working together. Easily confused with similar words.',
    ru: '"Colleague" = коллега, участник группы. Часто путают со словами.'
  },
  '"Complemented" (praised) is a sound-alike trap': {
    en: '"Complemented" = praised. Sound-alike trap for "complimented" — check the exact meaning.',
    ru: '"Complemented" = похвалён. Созвучный намёк на "complimented" — проверяйте значение.'
  },
  '"Considering" is the classic trap': {
    en: '"Considering" means "taking into account" — the opposite of exclusion. Check whether the sentence is excluding or factoring in.',
    ru: '"Considering" = учитывая — противоположность исключения. Проверяйте, исключает или учитывает.'
  },
  '"Contemporary" (B) is tempting': {
    en: '"Contemporary" is a common formal word, but the sentence needs a different meaning — check the context.',
    ru: '"Contemporary" — формальное слово, но предложению нужно другое значение — проверяйте контекст.'
  },
  '"Convinced" and "cautioned"': {
    en: '"Convinced" and "cautioned" are near-miss verbs. Check the exact meaning the sentence needs.',
    ru: '"Convinced" и "cautioned" — похожие глаголы. Проверяйте точное значение.'
  },
  '"Corrections" (A, noun) and "correct" (C, adjective)': {
    en: '"Corrections" is a noun, "correct" is an adjective. Check the grammatical role the blank needs.',
    ru: '"Corrections" — существительное, "correct" — прилагательное. Проверяйте роль.'
  },
  '"Decreased" is a plausible-sounding negative adjective': {
    en: '"Decreased" describes a reduced quantity, not a dangerous situation. "Risky" captures potential harm.',
    ru: '"Decreased" = сокращённое количество, не опасная ситуация. "Risky" = потенциально вредно.'
  },
  '"Despite" and "past" (B, D) are tempting': {
    en: '"Despite" and "past" are tempting, but the sentence needs a different word — check the context.',
    ru: '"Despite" и "past" кажутся правильными, но нужен другой вариант — проверяйте контекст.'
  },
  '"Developed" (B, bare verb) is tempting': {
    en: '"Developed" looks like a base verb, but the sentence needs a different form — check the grammar.',
    ru: '"Developed" похоже на инфинитив, но нужно другое время — проверяйте грамматику.'
  },
  '"Disposable" (meant to be thrown away after one use)': {
    en: '"Disposable" = meant to be thrown away after one use. Check if the sentence describes a product\'s lifespan.',
    ru: '"Disposable" = одноразовый. Проверяйте, описывает ли предложение срок продукта.'
  },
  '"Due to" (meaning "because of") is often confused': {
    en: '"Due to" = because of. "Due" alone = expected/scheduled. Very different grammatical roles.',
    ru: '"Due to" = из-за. "Due" alone = ожидается. Совершенно разные роли.'
  },
  '"Each" is a frequent wrong pick because it also means "every"': {
    en: '"Each" must be followed by a singular noun. "Cyclists" is plural — check the noun\'s number.',
    ru: '"Each" требует единственного существительного. "Cyclists" — множественное. Проверяйте число.'
  },
  '"Elsewhere" (somewhere else) is a single-word adverb of place': {
    en: '"Elsewhere" = somewhere else. Often signals contrast with a usual location mentioned earlier.',
    ru: '"Elsewhere" = в другом месте. Часто противопоставляется обычному месту.'
  },
  '"Energetic" and "accomplished" (A, D) are positive-sounding adjectives': {
    en: '"Energetic" and "accomplished" are positive, but "straightforward" = easy to understand. Check the exact meaning.',
    ru: '"Energetic" и "accomplished" положительные, но "straightforward" = понятный. Проверяйте значение.'
  },
  '"Enthusiast" (B, a noun for a person) is a sneaky trap': {
    en: '"Enthusiast" is a noun. A blank modifying a verb needs an adverb, not a noun.',
    ru: '"Enthusiast" — существительное. Пропуск, описывающий глагол, требует наречия.'
  },
  '"Everybody" and "another" (C, D) are tempting': {
    en: '"Everybody" and "another" are tempting, but the sentence needs a different pronoun — check the context.',
    ru: '"Everybody" и "another" кажутся правильными, но нужно другое местоимение — проверяйте контекст.'
  },
  '"Everyone" is a singular pronoun despite referring to a group': {
    en: '"Everyone" is singular despite referring to a group — takes singular verbs.',
    ru: '"Everyone" — единственное число, несмотря на группу. Глагол в единственном числе.'
  },
  '"Excited" (C) is the classic trap here because it\'s grammatically an adjective': {
    en: 'People are "excited". Things that cause excitement are "exciting" — check what the blank describes.',
    ru: 'Люди — "excited". Вещи, вызывающие воодушевление — "exciting". Проверяйте, что описывает пропуск.'
  },
  '"Expand", "solicit", and "allow" (A, B, C) are all verbs': {
    en: '"Expand", "solicit", "allow" are verbs, but only "outline" matches "summarize a schedule" — check meaning.',
    ru: '"Expand", "solicit", "allow" — глаголы, но только "outline" = резюмировать. Проверяйте значение.'
  },
  '"Express" (A) and "predict" (B) are both verbs': {
    en: '"Express" and "predict" are verbs, but only "issued" describes a receipt being given out.',
    ru: '"Express" и "predict" — глаголы, но только "issued" = выпущен чек.'
  },
  '"Extent", "awareness", and "proposal" (A, C, D) are all abstract nouns': {
    en: '"Extent", "awareness", "proposal" are abstract nouns, but only "confirmation" fits a notice sent after purchase.',
    ru: '"Extent", "awareness", "proposal" — абстрактные существительные, но только "confirmation" = уведомление после покупки.'
  },
  '"Finally", "routinely", "rarely", and "strongly" are all valid adverbs': {
    en: 'All options are grammatically valid — this is a pure vocabulary-meaning question. Match the adverb to the sentence\'s nuance.',
    ru: 'Все варианты грамматически правильные — вопрос по лексике. Соотносите наречие с оттенком предложения.'
  },
  '"Follow" (B) and "unfold" (D) are both plausible verbs': {
    en: '"Follow" and "unfold" are plausible, but "limit" = keep within a length constraint — check the meaning.',
    ru: '"Follow" и "unfold" подходят, но "limit" = ограничить длину. Проверяйте значение.'
  },
  '"Formative" (relating to early development)': {
    en: '"Formative" = relating to early development. "The company\'s formative years" = when it was just starting out.',
    ru: '"Formative" = ранний период. "The company\'s formative years" = когда компания только начинала.'
  },
  '"Function" and "distance" are both abstract nouns': {
    en: '"Function" and "distance" are abstract nouns, but only "region" pairs with a geographic direction.',
    ru: '"Function" и "distance" — абстрактные, но только "region" с географическим направлением.'
  },
  '"Have been" is always followed by a past participle (V3)': {
    en: '"Have been" is always followed by a past participle (V3), never a plain base verb or present participle.',
    ru: '"Have been" всегда с причастием (V3), не с инфинитивом или present participle.'
  },
  '"Having joined Vince\'s Gym, Mr. Pinter could attend"': {
    en: '"Having joined..." is a reduced participle clause = "Because Mr. Pinter has joined..."',
    ru: '"Having joined..." — сокращённое причастное придаточное = "Because Mr. Pinter has joined..."'
  },
  '"Himself" is the most common wrong pick': {
    en: 'A reflexive pronoun fits at a clause\'s end or right after the subject, not right before a noun like "diagnosis".',
    ru: 'Возвратное местоимение в конце предложения или после подлежащего, не перед существительным (diagnosis).'
  },
  '"His" (A, possessive adjective) is a common wrong pick': {
    en: '"His" is a possessive adjective, but the phrase needs a reflexive pronoun for emphasis — "he can do it himself".',
    ru: '"His" — притяжательное, но нужно возвратное для акцента — "he can do it himself".'
  },
  '"Impress" (A) and "employ" (B) are both verbs': {
    en: '"Impress" and "employ" are verbs, but only "attend" is the collocation for going to an event.',
    ru: '"Impress" и "employ" — глаголы, но только "attend" = посетить мероприятие.'
  },
  '"Interior" (opposite of the correct "exterior")': {
    en: '"Interior" = inside, "exterior" = outside. This tests vocabulary meaning, not grammar.',
    ru: '"Interior" = внутри, "exterior" = снаружи. Вопрос по лексике, не грамматике.'
  },
  '"Interpreter" (someone who translates spoken language)': {
    en: '"Interpreter" = someone who translates spoken language. Easily confused with related words.',
    ru: '"Interpreter" = человек, переворачивающий речь. Часто путают со словами.'
  },
  '"Later" is an easy wrong pick': {
    en: '"The most recent" is the fixed collocation. "The most later" is never grammatical.',
    ru: '"The most recent" — устойчивое сочетание. "The most later" — неверно.'
  },
  '"Minor" (small in importance) is easy to confuse': {
    en: '"Minor" = small in importance, "critical" = very important. Read for contrast clues.',
    ru: '"Minor" = мелкий, "critical" = важный. Читай с учётом контраста.'
  },
  '"Natural" (B, adjective) is the classic trap for "naturally"': {
    en: '"Natural" is an adjective, "naturally" is an adverb. Check whether the blank modifies a noun or a verb/adjective.',
    ru: '"Natural" — прилагательное, "naturally" — наречие. Проверяйте, что описывает пропуск.'
  },
  '"Occupy" is a tricky near-miss': {
    en: '"Occupy" can relate to space, but check the exact meaning the sentence needs.',
    ru: '"Occupy" связано с пространством, но проверяйте точное значение.'
  },
  '"Only" (limited to no more than / nothing other than)': {
    en: '"Only" can be an adverb or adjective depending on position. Check exactly what it is meant to restrict.',
    ru: '"Only" — наречие или прилагательное. Проверяйте, что ограничивает.'
  },
  '"Otherwise", "as well", and "hardly ever"': {
    en: '"Otherwise", "as well", "hardly ever" are adverbs, but "in addition to" is a preposition that connects to a noun phrase.',
    ru: '"Otherwise", "as well", "hardly ever" — наречия, но "in addition to" — предлог с существительным.'
  },
  '"Oversee" (B) is tempting': {
    en: '"Oversee" is workplace-related, but check the exact meaning the sentence needs.',
    ru: '"Oversee" связано с рабочим местом, но проверяйте точное значение.'
  },
  '"Practices" (regularly done habits/customs, plural noun)': {
    en: '"Practices" = regularly done habits, plural noun. Check the grammatical role.',
    ru: '"Practices" = привычки, множественное существительное. Проверяйте роль.'
  },
  '"Premises", "impacts", and "distractions" (A, C, D) are all plausible nouns': {
    en: '"Premises", "impacts", "distractions" are plausible, but only "defects" fits manufacturing problems.',
    ru: '"Premises", "impacts", "distractions" подходят, но только "defects" = дефекты производства.'
  },
  '"Proceed" (A, verb) and "proceeded" (B, past tense verb)': {
    en: '"Proceed" is a verb, "proceeded" is past tense. Check the grammatical role.',
    ru: '"Proceed" — глагол, "proceeded" — прошедшее время. Проверяйте роль.'
  },
  '"Proposal" (B) is a near-miss': {
    en: '"Proposal" is related to form, but check the exact meaning the sentence needs.',
    ru: '"Proposal" связано с формой, но проверяйте точное значение.'
  },
  '"Provide something to someone" needs a noun referring to people': {
    en: '"Provide something to someone" needs a noun referring to people after the blank.',
    ru: '"Provide something to someone" — после пропуска существительное, обозначающее людей.'
  },
  '"Purposes" and "standards" (A, D) are both plausible nouns': {
    en: '"Purposes" and "standards" are plausible, but check the exact meaning the sentence needs.',
    ru: '"Purposes" и "standards" подходят, но проверяйте точное значение.'
  },
  '"Rarely" (D) is a strong trap': {
    en: '"Rarely" is an adverb, but check if the sentence needs a different word.',
    ru: '"Rarely" — наречие, но проверяйте, нужно ли другое слово.'
  },
  '"Rather than" is the sneakiest wrong option': {
    en: '"Rather than" also expresses contrast, but the sentence needs a different connector — check the context.',
    ru: '"Rather than" тоже выражает противопоставление, но нужно другое — проверяйте контекст.'
  },
  '"Reflect" (B) and "invite" (C) are both plausible-sounding verbs': {
    en: '"Reflect" and "invite" are plausible, but check the exact meaning the sentence needs.',
    ru: '"Reflect" и "invite" подходят, но проверяйте точное значение.'
  },
  '"Regarding" (B) is a common wrong pick': {
    en: '"Regarding" sounds business-appropriate, but check the exact meaning the sentence needs.',
    ru: '"Regarding" звучит делово, но проверяйте точное значение.'
  },
  '"Regarding" (about/concerning) is a common formal preposition': {
    en: '"Regarding" = about/concerning. Common in TOEIC business sentences.',
    ru: '"Regarding" = о, concernant. Часто в TOEIC.'
  },
  '"Remarkably" is tempting': {
    en: '"Remarkably" is an adverb, but check if the sentence needs a different word.',
    ru: '"Remarkably" — наречие, но проверяйте, нужно ли другое слово.'
  },
  '"Responded" (B) is tempting': {
    en: '"Responded" relates to communication, but check the exact meaning the sentence needs.',
    ru: '"Responded" связано с коммуникацией, но проверяйте точное значение.'
  },
  '"Restore something to its original condition" is a fixed phrase': {
    en: '"Restore something to its original condition" is a fixed phrase.',
    ru: '"Restore something to its original condition" — устойчивая фраза.'
  },
  '"Satisfied" (D) is a sneaky trap': {
    en: '"Satisfied" sounds positive, but check the exact meaning the sentence needs.',
    ru: '"Satisfied" звучит положительно, но проверяйте точное значение.'
  },
  '"Shorten" (A) is a very tempting near-synonym': {
    en: '"Shorten" is a near-synonym, but check the exact meaning the sentence needs.',
    ru: '"Shorten" — синоним, но проверяйте точное значение.'
  },
  '"Since" (D) is a trap because it also means "because"': {
    en: '"Since" can mean "because", but check if the sentence needs a different word.',
    ru: '"Since" может означать "because", но проверяйте, нужно ли другое слово.'
  },
  '"So that" is a fixed purpose conjunction': {
    en: '"So that" is a fixed purpose conjunction always paired with a clause (subject + verb).',
    ru: '"So that" — устойчивый союз цели, всегда с придаточным.'
  },
  '"So" (D)': {
    en: '"So" expresses result. Check if the sentence needs a different connector.',
    ru: '"So" выражает следствие. Проверяйте, нужен ли другой союз.'
  },
  '"Than" (D)': {
    en: '"Than" is used in comparisons. Check if the sentence needs a different word.',
    ru: '"Than" используется в сравнениях. Проверяйте, нужно ли другое слово.'
  },
  '"Temporarily" (D)': {
    en: '"Temporarily" means for a short time. Check if the sentence needs a different word.',
    ru: '"Temporarily" = временно. Проверяйте, нужно ли другое слово.'
  },
  '"Value" (C)': {
    en: '"Value" can mean importance or worth. Check the exact meaning the sentence needs.',
    ru: '"Value" = ценность. Проверяйте точное значение.'
  },
  '"Will import" (C)': {
    en: '"Will import" is a verb phrase. Check the grammatical role the blank needs.',
    ru: '"Will import" — глагольная фраза. Проверяйте роль.'
  },
  '"Yet" (D)': {
    en: '"Yet" = still / however. Check if the sentence needs a different word.',
    ru: '"Yet" = ещё / однако. Проверяйте, нужно ли другое слово.'
  },
};

/**
 * Get simplified explanation for a Part 5 item.
 * @param {string} originalEn - original English explanation from bank
 * @returns {{en: string, ru: string}} simplified EN + RU
 */
function getPart5SimplifiedExplanation(originalEn) {
  if (!originalEn) return { en: '', ru: '' };

  // Try exact match first
  if (PART5_SIMPLIFICATIONS[originalEn]) {
    return PART5_SIMPLIFICATIONS[originalEn];
  }

  // Try prefix match (first 40-60 chars)
  const sortedKeys = Object.keys(PART5_SIMPLIFICATIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (originalEn.startsWith(key) || originalEn.includes(key)) {
      return PART5_SIMPLIFICATIONS[key];
    }
  }

  // Fallback: generic simplification
  return {
    en: 'Look at the full sentence. Check what the blank needs — a noun, adjective, adverb, or verb form. Match the word to the meaning.',
    ru: 'Посмотрите на всё предложение. Проверьте, что нужно на месте пропуска — существительное, прилагательное, наречие или форма глагола. Соотнесите слово со значением.'
  };
}

export { getPart5SimplifiedExplanation };
