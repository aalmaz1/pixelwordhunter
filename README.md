<div align="center">

# 👾 PIXEL WORD HUNTER

### // TOEIC EDITION //

**Learn business English like an arcade game.**

A neon pixel-art hunt with 600 TOEIC business-English vocabulary cards, adaptive spaced practice, typed recall, XP, pronunciation, optional cloud sync, and English / Русский / 한국어 interface localization.

[![Play](https://img.shields.io/badge/PLAY%20THE%20GAME-pixelwordhunter.pages.dev-ff2d78?style=for-the-badge)](https://pixelwordhunter.pages.dev)
[![PWA](https://img.shields.io/badge/INSTALLABLE-PWA-bf5fff?style=flat-square)](https://pixelwordhunter.pages.dev)
[![Languages](https://img.shields.io/badge/LANGUAGES-EN%20%7C%20RU%20%7C%20KO-00f5ff?style=flat-square)](#-languages-and-study-direction)
[![License](https://img.shields.io/badge/LICENSE-MIT-39ff14?style=flat-square)](#-license-attribution-and-trademarks)

</div>

---

## 🎮 What is Pixel Word Hunter?

**Pixel Word Hunter** is a retro arcade-style business-English vocabulary trainer for TOEIC study. Choose a category, answer short prompts, earn XP, identify difficult cards, and return when earlier cards are due for review.

The interface combines CRT scanlines, six neon and monochrome themes, pixel typography, synthesized sound effects, and a compact spaced-practice scheduler. There is no course setup and no account is required for local play.

**Press TRY or HUNT. Pick an answer. Build your vocabulary.**

## ✨ The game at a glance

- **600 business-English vocabulary cards** across 50 TOEIC categories;
- **10-prompt standard hunts** selected from one category or the complete word bank;
- four-choice questions for new cards and most previously seen cards;
- a **25% typed-recall chance** for cards that have already been answered at least once;
- questions in both directions: English → translation and translation → English;
- the English term, active translation, and translated example shown after every answer;
- **10 XP** for each correct answer, plus score and accuracy summaries;
- per-card mastery, per-category progress bars, and a local daily streak;
- category search, focused **HARD WORDS** practice, and immediate mistake replay;
- a complete **WORD REVIEW** after continuing from every third round;
- tap-to-pronounce controls powered by the browser's speech engine;
- responsive play on phone, tablet, and desktop;
- installable PWA support and offline play after the first successful online load.

Standard category and mixed hunts contain ten prompts. A hard-word round or a mistake-review round can contain fewer when fewer eligible cards are available.

## 🕹 How a hunt works

1. Open the game and press **TRY**, or **HUNT** when already authenticated.
2. Choose one of the 50 categories, or select **ALL** for a mixed hunt.
3. Answer ten prompts in a standard hunt. New cards begin with multiple choice; previously seen cards can switch to typed recall.
4. After each answer, review the English term, its active translation, and example sentences in both languages.
5. Earn **10 XP** for each correct answer.
6. At the end of the round, see correct answers, mistakes, accuracy, and XP earned.
7. Continue with the same hunt, replay only the mistakes, or exit to the menu.
8. Continuing after every third completed round opens a recap of all cards answered during those rounds.

The **TRY** button attempts an anonymous Firebase sign-in and immediately opens guest play. If Firebase is unavailable, the game continues with local browser storage. Email registration is optional and is only needed for cross-device synchronization.

## 🧠 Adaptive practice and mastery

Each card stores an independent numeric mastery score from **0 to 9**. A card counts as mastered in the menu and category progress bars when it reaches level **5 or higher**.

- a correct answer adds one mastery level, capped at 9;
- a wrong answer removes one level, floored at 0;
- every answer updates the card's last-seen time and correct/incorrect counters;
- previously saved levels from older versions are migrated to the current contextual card IDs.

The next review interval is based on the card's new mastery level:

| Mastery | Next review interval | Counts as mastered |
|:---:|---:|:---:|
| `0` | immediately eligible | No |
| `1` | 1 hour | No |
| `2` | 6 hours | No |
| `3` | 1 day | No |
| `4` | 3 days | No |
| `5` | 7 days | Yes |
| `6` | 14 days | Yes |
| `7` | 30 days | Yes |
| `8` | 90 days | Yes |
| `9` | 180 days | Yes |

Due and struggling cards are selected before the remaining pool whenever the round has room. Other slots combine priority-ranked cards with random exploration, which keeps new and less frequently selected material in circulation.

A card is considered **hard** when either:

- it has more incorrect answers than correct answers; or
- it has been seen and still has mastery below level 2.

The HARD WORDS button displays the current number of eligible cards and selects up to ten of the hardest cards. It remains disabled until at least one card meets those rules.

Typed recall is introduced only after a card has been seen once. Matching ignores capitalization and punctuation. When a translated definition contains several comma-, semicolon-, slash-, or pipe-separated glosses, entering any one complete gloss is accepted.

## 📚 The 600-card word bank

The canonical dictionary contains:

- **600 contextual cards**;
- **50 categories**;
- exactly **12 cards per category**;
- **600 stable unique card IDs**;
- **598 unique English terms**.

Two English terms appear in more than one context. Their category-specific cards retain independent mastery and answer history.

<details>
<summary><strong>View all 50 categories</strong></summary>

`Contracts` · `Marketing` · `Warranties` · `Business Planning` · `Conferences` · `Computers` · `Office Technology` · `Office Procedures` · `Electronics` · `Job Advertising and Recruiting` · `Applying and Interviewing` · `Hiring and Training` · `Salaries and Benefits` · `Promotions, Pensions, and Awards` · `Shopping` · `Ordering Supplies` · `Shipping` · `Invoices` · `Inventory` · `Banking` · `Accounting` · `Investments` · `Taxes` · `Financial Statements` · `Property and Departments` · `Board Meeting and Committees` · `Quality Control` · `Product Development` · `Renting and Leasing` · `Selecting a Restaurant` · `Eating Out` · `Ordering Lunch` · `Cooking as a Career` · `Events` · `General Travel` · `Airlines` · `Trains` · `Hotels` · `Car Rentals` · `Movies` · `Theater` · `Music` · `Museums` · `Media` · `Doctors Office` · `Dentists Office` · `Health Insurance` · `Hospitals` · `Pharmacy` · `Correspondence`

</details>

Every card includes:

- an English term and category;
- Russian and Korean translations;
- an English example sentence;
- Russian and Korean versions of the example;
- a stable contextual ID used for independent progress tracking.

The runtime sanitizer validates the dictionary before it reaches the game. In normal browsers, JSON parsing and sanitization run off the main thread in a Web Worker; a main-thread fallback is available when module workers cannot start.

## 🌍 Languages and study direction

The main interface is localized in three languages. The active interface language also controls the study translation:

| Interface | Questions, definitions, and translated examples | Typeface |
|---|---|---|
| **English** | English ↔ Russian | Press Start 2P |
| **Русский** | English ↔ Russian | Press Start 2P |
| **한국어** | English ↔ Korean | Mulmaru |

The initial language follows a supported browser language when no preference has been saved. Change it from Settings at any time; the choice is remembered locally. Category names and English vocabulary terms remain in English in every interface mode.

## 🎨 Themes, sound, and pronunciation

Six visual themes change the atmosphere without changing the learning rules:

- 💜 **Cyberpunk** — neon pink and cyan with CRT energy;
- 🌃 **Midnight** — deep blues and violet;
- 🟢 **Matrix** — green terminal glow;
- 🌅 **Sunset** — warm retro dusk;
- 📟 **3310** — monochrome Nokia-inspired LCD;
- ⬛ **Mono** — high-contrast black and white.

Correct, incorrect, navigation, and hover effects are synthesized with the Web Audio API. Sound can be disabled in Settings.

Tap or click the current prompt to hear it through the browser's Speech Synthesis API. English terms in answer explanations and review cards can also be pronounced on demand. Voice availability and quality depend on the browser, operating system, and installed voices.

The interface includes visible keyboard focus, modal focus trapping, a skip link, touch-sized controls, responsive layouts, and reduced-motion handling through `prefers-reduced-motion`.

## ☁️ Progress, accounts, and backups

Local play does not require an account.

- Guest card progress and XP are stored in the browser.
- **TRY** requests anonymous Firebase authentication when available, while guest learning data remains in the local guest namespace.
- Email/password accounts synchronize card progress and XP through Firebase Auth and Firestore.
- Guest and email-account data use separate local namespaces.
- When an email account is opened with existing guest data, the game asks whether to merge it.
- A merge keeps the strongest mastery, latest last-seen time, and largest answer counters for each card, then adds guest XP to account XP.
- The daily streak, language, theme, and sound preference remain local to the current browser rather than syncing through Firestore.
- Backups can export and restore progress, XP, language, theme, and sound preference as JSON.
- Progress can be reset locally, with an additional choice to clear synchronized progress and XP for the current account.
- If Firebase is unavailable, local gameplay, progress, and backups continue to work.

### What is stored

Guest learning data is written to `localStorage`. Pressing TRY can create a Firebase anonymous user ID, but it does not require a name or email. Registering an email account stores authentication data in Firebase Auth and stores the username, email, XP, card progress, and synchronization timestamps in that user's Firestore document.

The included Firestore rules restrict each `users/{uid}` document to the matching authenticated user. The Firebase web configuration is public client configuration, not an administrator credential; authorization is enforced by Firebase Auth and Firestore Security Rules.

## 📱 Install and play offline

Pixel Word Hunter is a Progressive Web App. Open it in a supported browser and use **Install** or **Add to Home Screen** when offered.

After one successful production load and Service Worker installation, the application shell, fonts, icons, all three interface language files, and the versioned word bank are precached. The word bank also uses a network-first runtime cache so a deployed dictionary update can replace the previous offline copy.

A completely new browser profile still needs one online visit before offline mode can work. Authentication, cloud synchronization, password recovery, and downloading a missing system speech voice can still require a connection.

On platforms that expose PWA shortcuts, the installed app provides:

- **Quick Round** — opens an ALL-category hunt;
- **Hard Words** — opens the current hard-word queue.

## 🚀 Play now

**[Open Pixel Word Hunter →](https://pixelwordhunter.pages.dev)**

The game runs in a modern desktop or mobile browser. No account is required to start.

## 🛠 Built with intention

Pixel Word Hunter is a small, framework-free web game built with:

- vanilla JavaScript and semantic HTML;
- CSS custom properties for six themes;
- a Web Worker for off-main-thread dictionary parsing and sanitization;
- Web Speech API for on-demand pronunciation;
- Web Audio API for synthesized sound effects;
- Vite for development and production builds;
- Firebase Auth and Firestore for optional account synchronization;
- Workbox-powered PWA precaching and runtime caching;
- Content Security Policy and per-user Firestore rules;
- Vitest, jsdom, and ESLint for automated checks.

The application keeps the learning loop understandable and avoids a heavy front-end framework.

## ⌨️ Keyboard controls

| Key | Action |
|:---:|---|
| `1` – `4` | Select a multiple-choice answer when choices are visible |
| `Enter` | Submit typed recall or authentication forms; activate a focused control |
| `Enter` / `Space` | Start from the menu or continue after an answered question |
| `Esc` | Close an open dialog; from round results, return to the menu |
| `Tab` / `Shift+Tab` | Move through controls; focus remains inside supported open dialogs |

## 🧪 For developers

### Requirements

- Node.js **20.19+ within the 20.x line, or 22.12+** (matching Vite 8);
- npm;
- Python 3 only when rebuilding the dictionary;
- optional Firebase CLI access for deploying Firestore rules;
- optional Wrangler access for deploying the Cloudflare static app.

### Run locally

```bash
git clone https://github.com/aalmaz1/pixelwordhunter.git
cd pixelwordhunter
npm ci
npm run dev
```

Open the URL printed by Vite.

### Quality checks

```bash
npm run lint
npm test
npm run build
```

The current suite checks dictionary size and required data, usable Korean content, contextual word IDs, option fairness, SRS selection and long-term levels, hard-word selection, sanitization, i18n key parity, storage validation and migration, progress merging, final local saves, and state-update batching.

The automated suite does not currently perform live Firebase network tests or a full browser installation/offline integration test. A successful production build still verifies that Vite and Workbox can generate the deployable PWA assets.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Create the production app in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `python3 build_words.py` | Validate source rows and rebuild the canonical dictionary |

### Rebuild the dictionary

Dictionary source rows live in `build_data_a.py` through `build_data_d.py`. Edit those source files rather than editing generated JSON alone, then rebuild and verify:

```bash
python3 build_words.py
npm test
npm run build
```

The builder requires exactly 50 known categories, 12 rows per category, six localized fields per row, 600 total cards, non-empty translations, and unique contextual IDs. It overwrites `public/words_optimized.json`.

The generated file ships in a compact single-letter key format to keep it small (`i`=id, `c`=category, `e`=eng, `r`=rus, `E`=exampleEng, `R`=exampleRus, `k`=kor, `K`=exampleKor). `sanitize.js` reads both this format and the long key names, so hand-written long-key data keeps working.

### Project map

```text
index.html                    app shell, screens, dialogs, and metadata
app.js                        game flow, audio, speech, auth, and review UI
store.js                      central reactive application state
data.js                       dictionary loading and adaptive scheduler
data.worker.js                off-main-thread parsing and sanitization
sanitize.js                   shared dictionary sanitizer
storage.js                    local saves, backups, migration, XP, and cloud sync
ui.js                         category rendering and accessibility helpers
i18n.js                       lazy interface-language loading
style.css                     responsive UI, fonts, motion rules, and six themes
firebase-config.js            lazy Firebase initialization and auth bridge
firestore.rules               per-user Firestore security rules
firebase.json                 Firebase CLI rules configuration
public/words_optimized.json   canonical generated 600-card dictionary
public/_headers               deployed anti-framing security headers
i18n/                         English, Russian, and Korean interface strings
assets/                       fonts, licenses, logo, icons, and favicon
build_words.py                dictionary validator and generator
build_data_[a-d].py           editable localized dictionary source rows
tests/                        Vitest/jsdom unit and data-integrity tests
eslint.config.js              ESLint configuration
vitest.config.js              Vitest/jsdom configuration
package.json / package-lock.json  npm scripts and pinned dependency tree
vite.config.js                Vite build, Web Worker, and PWA configuration
wrangler.jsonc                Cloudflare static-asset deployment configuration
```

### Firebase

The public Firebase web client configuration is included so the deployed game works without environment setup. To use another Firebase project:

1. enable **Email/Password** and **Anonymous** providers in Firebase Authentication;
2. create a Firestore database;
3. replace `FIREBASE_CONFIG` in `firebase-config.js`;
4. deploy the included rules to the selected project.

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```

`firebase.json` maps the CLI to `firestore.rules`. The rules allow a signed-in user to access only `users/{theirUid}`, validate allowed fields and value ranges, and deny every other document path. Do not replace them with open development rules in production.

### Cloudflare deployment

Build and deploy the static assets described by `wrangler.jsonc`:

```bash
npm run build
npx wrangler deploy
```

The production output is generated in `dist/`. The deployed `_headers` file supplies anti-framing headers that cannot be enforced from an HTML `<meta>` policy.

## 🤝 Contributing

Translation corrections, accessibility improvements, scheduler tests, themes, and focused gameplay changes are welcome.

1. Fork the repository.
2. Create a focused branch.
3. Make the change.
4. For dictionary edits, update `build_data_*.py` and run `python3 build_words.py`.
5. Run `npm run lint`, `npm test`, and `npm run build`.
6. Open a pull request with a short description and testing notes.

Dictionary changes must preserve the 600-card / 50-category structure, complete English/Russian/Korean fields, and stable unique contextual IDs unless a deliberate data-format migration accompanies the change.

## 📄 License, attribution, and trademarks

The original project source code is licensed under the **MIT License** — see [`LICENSE`](LICENSE).

Bundled fonts (**Press Start 2P** and **Mulmaru**) are third-party works distributed under the **SIL Open Font License 1.1** — see [`assets/FONT_LICENSES.md`](assets/FONT_LICENSES.md).

As documented by the dictionary builder, the category organization and English term selection follow Lin Lougheed's *600 Essential Words for the TOEIC* (Barron's). The localized translations and example corpus are maintained in this repository. Third-party titles, names, and source works remain the property of their respective owners.

Pixel Word Hunter is an independent, unofficial study project. It is not affiliated with or endorsed by ETS, Barron's, or Lin Lougheed. **TOEIC** is a trademark of Educational Testing Service (ETS).

---

<div align="center">

**© 2026 Khudayberdiev Almaz**

*Built with 💜 and pixels. Happy hunting!* 👾

</div>
