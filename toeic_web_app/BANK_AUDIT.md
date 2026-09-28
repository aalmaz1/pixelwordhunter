# TOEIC question bank — audit

Audit of `toeic_web_app/toeic_database.json` — the 900 questions played in the
**TOEIC TESTS** mode of the app (9 "parts" x 100).
Date: 2026-09-28 · revision `247fac2`.

## Verdict

Every item is a well-formed 4-option multiple choice with a consistent data
shape, but the bank is **not clean and not fully TOEIC-like**:

* **767 / 900 (85%)** are incomplete-sentence items — the real
  TOEIC Part 5 task; **35** are "Which sentence is correct ?" grammar drills and
  **98** are dictionary definition quizzes. The latter two types do not exist in
  the TOEIC test at all.
* Only **213 questions (24%)** describe a workplace/business
  situation; real TOEIC Listening & Reading is 100 % business context.
* **5 questions repeat one of their own options** — in #70 *both* copies of the key
  are present, and the app compares option strings, so it paints **two** options green.
* **4 duplicate pairs**: one identical question served in two different parts,
  two near-identical sentences inside part 9, and one prompt repeated inside part 6.
* **1 question renders an empty answer button** (#869 — its first option is an empty string).
* **35 stems with misspellings**, **40 questions with a misspelled
  option**, **8 where the marked answer itself is misspelled**.
* **55 questions where the blank is glued to a word** (`man____________ only`),
  plus 224 fields with stray leading/trailing spaces and 75 with a space before
  punctuation (`… in May ?`).

## 1. What is fine

| check | result |
|---|---|
| categories x questions | 9 x 100 = 900 |
| fields | complete on all 900 items |
| options | exactly 4 everywhere, key always inside them |
| blank marker | `___` used consistently (no mixed styles) |
| answer-position spread | balanced (~25 % each) in parts 2-9 |

## 2. Item types vs the real TOEIC

Real TOEIC L&R: Part 5 = incomplete sentences (single sentence, 4 options),
Part 6 = text completion (a passage with 4 gaps), Part 7 = reading comprehension.
A TOEIC Part 6/7 item **cannot** be a single sentence — and this bank contains no
passages at all (longest stem 271 characters, median 64). So the whole bank trains
the Part 5 skill only.

| part | app label | fill-in-the-blank | which-sentence | definition quiz | business context |
|---|---|---|---|---|---|
| 1 | Incomplete Sentences Part 1 | 99 | 0 | 1 | 33% |
| 2 | Incomplete Sentences Part 2 | 100 | 0 | 0 | 22% |
| 3 | Grammar Part 1 | 99 | 1 | 0 | 9% |
| 4 | Grammar Part 2 | 77 | 23 | 0 | 3% |
| 5 | Grammar Part 3 | 79 | 11 | 10 | 4% |
| 6 | Grammar Part 4 | 13 | 0 | 87 | 9% |
| 7 | Grammar Part 5 | 100 | 0 | 0 | 44% |
| 8 | Grammar Part 6 | 100 | 0 | 0 | 45% |
| 9 | Grammar Part 7 | 100 | 0 | 0 | 44% |
| — | **total** | **767** | **35** | **98** | **24% (213/900)** |

* The part labelled **"Grammar Part 4"** (bank part 6) is a **vocabulary quiz**:
  87/100 items ask for a definition of a single word ("boorish" -> "lacking manners").
* **35 items** ask "Which sentence is correct ?" — a TOEFL-style drill, and the
  identical prompt is repeated 35 times.
* Business framing per part: parts 1-2 ~33-22 %, part 3 9 %, parts 4-5 3-4 %
  (generic everyday grammar), part 6 9 %, parts 7-9 ~44 %.

## 3. Duplicates

| kind | items |
|---|---|
| identical question **and** answer in two different parts | **#307** (part 4) == **#803** (part 9) — "It is ___ to go out without a coat…" -> "stupid of me" |
| same sentence, same answer, twice in part 9 | **#869** == **#877** ("Some companies cut the price…" -> "effort"); **#857** == **#878** (UNEP recruiting -> "to be located") |
| same prompt word and same answer twice in part 6 | **#573** == **#576** ("boorish" -> "lacking manners") |
| identical `question + options` pair | none |

## 4. Broken / unfair items

### 4.1 Repeated option (5)

* **#70** (part 1) — `desire | desirable | to be desired | desirable` -> key `desirable` — **the key appears twice, so two options are marked correct**
* **#102** (part 2) — `wrote | was written | was writing | was writing` -> key `was written`
* **#149** (part 2) — `asserts | assertively | asserting | asserts` -> key `assertively`
* **#229** (part 3) — `map with | map in | map with | map of` -> key `map of`
* **#258** (part 3) — `The weather is fine in May : | The weather is fine in May | The weather is fine in may. | The weather is fine in May.` -> key `The weather is fine in may.` — options C and D are the same sentence with a different letter case (see 4.2)

### 4.2 Empty option (1)

* **#869** (part 9) — options are `"" | effort | undertaking | venture` -> key `effort`.
  The first button renders **blank**. This question is also the corrupted twin of #877
  (see 3), where the same slot still holds `commission`, so #869 is a damaged copy.

### 4.3 Unanswerable by construction

* **#258** (part 3) — all four options are the same sentence with different
  punctuation/capitalisation: `The weather is fine in May :` / `The weather is fine in May` /
  `The weather is fine in may.` / `The weather is fine in May.`. The keyed option is the one with the
  **lowercase** month (`may.`), while option D is the same sentence correctly capitalised — a user
  cannot tell them apart, and the keyed variant is arguably the worse answer.
* **#426** (part 5) — the stem itself carries trailing garbage:
  `We consider the results __________________.s`

## 5. Typos

### 5.1 Stems (35)

```
#21 (part 1): evening.the
#67 (part 1): untill
#80 (part 1): excercises
#84 (part 1): profitablity
#86 (part 1): challeges
#90 (part 1): immensy
#126 (part 2): untill
#131 (part 2): inspite
#134 (part 2): biggger
#136 (part 2): fullfill
#142 (part 2): succcess
#148 (part 2): software____________with, fascilitates
#150 (part 2): specfications
#553 (part 6): theraputic
#572 (part 6): appelation
#603 (part 7): finallymade
#621 (part 7): thecapital
#632 (part 7): theytook
#636 (part 7): tocommon
#654 (part 7): officeby
#677 (part 7): expecthim
#685 (part 7): bywednesday
#689 (part 7): canexperience
#690 (part 7): providefor
#691 (part 7): nothave
#696 (part 7): identificatio
#704 (part 8): mustbe
#716 (part 8): newpatients
#719 (part 8): discountwill
#740 (part 8): his__________all
#748 (part 8): scams_________getting
#753 (part 8): is_____________to
#790 (part 8): jointhe
#800 (part 8): twocars
#857 (part 9): officein
```

Worst offenders: glued words (`finallymade`, `thecapital`, `theytook`, `tocommon`,
`officeby`, `expecthim`, `bywednesday`, `canexperience`, `providefor`, `nothave`,
`mustbe`, `newpatients`, `discountwill`, `jointhe`, `twocars`, `officein`),
a truncated word (`identificatio`), a missing space after a period (#21), and plain
misspellings (`untill`, `inspite`, `biggger`, `fullfill`, `succcess`, `fascilitates`,
`specfications`, `excercises`, `profitablity`, `challeges`, `immensy`, `theraputic`,
`appelation`).

*Not* errors (flagged by the raw spell-checker, verified by hand): part 3 `b.c`,
#423 McCain, #560 bête noire, #568 avant-garde, #581 bona fide, #591 OPEC,
#619 PelCro, #634 VitaTech, #711 IRA.

### 5.2 Options (40 questions)

Real words spelled wrong: `reliablity` #140, `dteriorated` #131, `agressive`
#566/#567, `pertaing` x6 (#519, #536, #582 …), `acuman` #490, `acument` #501,
`noticibly`/`differnt` #505, `anoying` #506, `explaing` #508, `equivilant` #509,
`orgainisms` #511, `arguement` #512, `importantance` #514, `deminish` #522,
`makred`/`lonleyness` #528, `relient` #531, `aggrivated` #532, `charasmatic` #538,
`immediatley` #541, `aotomated` #543, `succesion` #547, `possitve` #554,
`excitment` #560, `poliete` #576, `actualy` #581, `committ` #588,
`monitered` #705, `orbitted` #386, `angred` #209.

Nonsense distractors (not real words, so the item tests spelling instead of
grammar): `soo` #58, `allready` #210, `mightbe` #396, `tomatois` #478,
`delock/dislock/mislock` #248, `pulldown` #675, `A drug atic` #515.

### 5.3 Misspelled marked answers (8) — highest priority

```
#509 (part 6) — marked answer "A word equivilant in meaning to another word" contains "equivilant"
#511 (part 6) — marked answer "The quality of two dissimilar orgainisms" contains "orgainisms"
#512 (part 6) — marked answer "A form of logical arguement that features three propositions and finishes with a conclusion" contains "arguement"
#519 (part 6) — marked answer "Of or pertaing to bulls" contains "pertaing"
#536 (part 6) — marked answer "Of or pertaing to beasts" contains "pertaing"
#555 (part 6) — marked answer "encouragment" contains "encouragment"
#581 (part 6) — marked answer "actualy, genuine" contains "actualy"
#582 (part 6) — marked answer "Of or pertaing to plant life" contains "pertaing"
```

## 6. Formatting noise

| issue | count | examples |
|---|---|---|
| blank glued to a word | 55 | #2, #3, #110, #596, #710, #740 (`his__________all`), #748, #753 … |
| trailing space in a stem/option | 224 fields | 98 questions in part 7, 98 in part 8 |
| space before punctuation | 75 fields | `Are you __________________ ?` (#301, #305, #418 …) |
| double space inside a sentence | 12 | #102, #502, #677 … |

## 7. Gameplay notes (app code, not data)

* **Nothing is shuffled.** `startToeicTest()` plays the bank in stored order and
  renders options in stored order, so every attempt is identical. Part 1 answer
  positions: A 11 / B 47 / C 23 / D 19 — "always B" would score 47 % there.
* Part labels ("Grammar Part 1-7") do not map onto the real TOEIC part structure,
  so users cannot tell which exam skill they are practising.
* Answer keys spot-checked by reading ~80 items: no flagrant wrong key found, but
  **#3** ("The girl looked ___ of the small window") accepts both `out` and `into`.

## 8. Recommended order of work

1. Fix the 8 misspelled keys and the duplicated-key question (#70, plus the #258 case pair).
2. Repair the 35 stem typos and the glued words around blanks.
3. Remove the 4 duplicates.
4. Rename/re-scope the parts: part 6 is a vocabulary quiz; Parts 6-7 of the real
   exam need passages, which the bank has none of.
5. Raise the business-context share in parts 1-6.
6. Shuffle options at render time and even out part 1's answer positions.
7. Decide the fate of the 35 "Which sentence is correct ?" items.
