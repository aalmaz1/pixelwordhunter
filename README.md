<div align="center">

# 👾 PIXEL WORD HUNTER

### // TOEIC EDITION //

**Learn business English like an arcade game.**

A neon pixel-art vocabulary hunt with 600 TOEIC cards, adaptive practice, XP, sound effects and full English / Русский / 한국어 support.

[![Play](https://img.shields.io/badge/PLAY%20THE%20GAME-pixelwordhunter.pages.dev-ff2d78?style=for-the-badge)](https://pixelwordhunter.pages.dev)
[![PWA](https://img.shields.io/badge/INSTALLABLE-PWA-bf5fff?style=flat-square)](https://pixelwordhunter.pages.dev)
[![Languages](https://img.shields.io/badge/LANGUAGES-EN%20%7C%20RU%20%7C%20KO-00f5ff?style=flat-square)](#-made-for-real-practice)
[![License](https://img.shields.io/badge/LICENSE-MIT-39ff14?style=flat-square)](#-license)

</div>

---

## 🎮 What is Pixel Word Hunter?

I built **Pixel Word Hunter** because vocabulary practice should feel like playing a game, not opening another spreadsheet.

It is a retro arcade-style TOEIC trainer: choose a hunt, answer fast, earn XP, discover your weak words and come back when they are ready for review. The interface combines CRT scanlines, neon themes, pixel typography and synthesized game sounds with a serious learning system underneath.

No endless setup. No account required. No giant course to navigate.

**Press HUNT. Pick an answer. Build your vocabulary.**

## ✨ The game at a glance

- **600 essential business-English cards** across 50 TOEIC categories;
- **10-question rounds** with four answer choices;
- questions in both directions: English → translation and translation → English;
- a clear English example sentence after every answer;
- XP and mastery progress that stay with you between sessions;
- **HARD WORDS** mode for focused practice;
- a **WORD REVIEW** recap after every three rounds;
- responsive play on phone, tablet and desktop;
- installable as a PWA and playable offline after the first load.

## 🕹 How a hunt works

1. Open the game and press **TRY** or **HUNT**.
2. Choose a category, or select **ALL** for a mixed hunt.
3. Answer ten questions.
4. Learn from the translation and business example.
5. Earn **10 XP** for every correct answer.
6. Keep going, review mistakes, or return later to your hard words.

The game does not only count your score. It remembers which cards need attention and brings them back at the right time.

## 🧠 Practice that adapts to you

Every card has its own mastery level:

```text
NEW → LEARNING → FAMILIAR → GOOD → STRONG → MASTER
```

Correct answers move a card forward. Wrong answers bring it back into practice. New, struggling and due cards are prioritized, while a random element keeps the wider word bank alive.

The result is a short daily loop that feels like a game but behaves like a real study tool:

> play → answer → understand → review → remember

## 📚 600 cards, made for real practice

The word bank contains **600 cards in 50 categories**, with 12 cards in each category. Here are some of the categories:

`Accounting` · `Airlines` · `Banking` · `Business Planning` · `Computers` · `Conferences` · `Contracts` · `Correspondence` · `Eating Out` · `Electronics` · `Events` · `Financial Statements` · `General Travel` · `Health Insurance` · `Hiring and Training` · `Hospitals` · `Hotels` · `Inventory` · `Investments` · `Invoices` · `Marketing` · `Media` · `Movies` · `Museums` · `Music` · `Office Procedures` · `Office Technology` · `Ordering Lunch` · `Ordering Supplies` · `Pharmacy` · `Product Development` · `Quality Control` · `Renting and Leasing` · `Salaries and Benefits` · `Shipping` · `Shopping` · `Taxes` · `Theater` · `Trains` · `Warranties` · and more.

Every card includes:

- the English term;
- a Russian translation;
- a Korean translation;
- an English example sentence;
- translated examples in Russian and Korean;
- independent progress, even when the same English word appears in a different context.

## 🌍 Made for real practice

Pixel Word Hunter supports three interface languages:

| Interface | Vocabulary and examples | Typeface |
|---|---|---|
| **English** | Russian | Press Start 2P |
| **Русский** | Russian | Press Start 2P |
| **한국어** | Korean | Mulmaru |

Switch language from Settings. The game remembers your choice.

## 🎨 Choose your atmosphere

Six visual themes change the mood without changing the gameplay:

- 💜 **Cyberpunk** — neon pink and cyan, CRT energy;
- 🌃 **Midnight** — deep space blues and violet;
- 🟢 **Matrix** — green terminal glow;
- 🌅 **Sunset** — warm retro dusk;
- 📟 **3310** — monochrome Nokia-inspired LCD;
- ⬛ **Mono** — high-contrast black and white.

Sound effects can be switched off at any time. Reduced-motion preferences are respected.

## ☁️ Your progress is yours

You can play without creating an account.

- Guest progress is saved locally in your browser.
- The **TRY** button can optionally create an anonymous Firebase session.
- Email accounts can sync progress and XP across devices.
- Guest and account progress are kept separate until you choose to merge them.
- Progress can be exported as a backup and imported later.
- If Firebase is unavailable, the local game remains playable.

## 📱 Install it like an app

Pixel Word Hunter is a Progressive Web App. Open it in a supported browser and use **Install** / **Add to Home Screen** when offered.

Once loaded, the app shell and word bank are cached for offline play. A brand-new browser still needs one online visit before offline mode can work.

## 🚀 Play now

**[Open Pixel Word Hunter →](https://pixelwordhunter.pages.dev)**

The game works in a modern desktop or mobile browser. No account is required to start.

## 🛠 Built with intention

Pixel Word Hunter is a small, focused web game built with:

- vanilla JavaScript and semantic HTML;
- CSS custom properties for the theme system;
- a Web Worker for dictionary parsing;
- Web Audio API for lightweight synthesized SFX;
- Vite for the production build;
- Firebase Auth and Firestore for optional sync;
- Workbox-powered PWA caching;
- Vitest and ESLint for quality checks.

The goal was to keep the game fast, installable and understandable instead of hiding a simple learning loop behind a heavy framework.

## ⌨️ Keyboard controls

| Key | Action |
|:---:|---|
| `1` – `4` | Select an answer |
| `Enter` / `Space` | Start, confirm or continue |
| `Esc` | Close a modal or leave results |

## 🧪 For developers

If you want to run the game locally or inspect the project:

### Requirements

- Node.js **20.19+** or **22.12+**;
- npm.

### Run locally

```bash
git clone https://github.com/aalmaz1/pixelwordhunter.git
cd pixelwordhunter
npm ci
npm run dev
```

Open the local URL printed by Vite.

### Quality checks

```bash
npm run lint
npm test
npm run build
npm run preview
```

Current checks cover the data pipeline, SRS selection, word IDs, sanitization, i18n, storage validation and progress migration.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the test suite |
| `npm run test:watch` | Watch tests while developing |

### Project map

```text
index.html             app shell and screens
app.js                 game flow, audio, auth and review
data.js                word loading and adaptive scheduler
data.worker.js         off-main-thread parsing and sanitization
sanitize.js            dictionary validation
storage.js             local progress, backups and cloud sync
ui.js                  DOM rendering and accessibility helpers
i18n.js                language loading
style.css              responsive UI and six themes
words_optimized.json   600-card dictionary
i18n/                  English, Russian and Korean UI text
assets/                fonts, logo, icons and favicon
tests/                 Vitest/jsdom tests
firestore.rules        per-user Firestore rules
vite.config.js         Vite and PWA configuration
wrangler.jsonc         Cloudflare deployment configuration
```

### Firebase

The public web client configuration is included so the deployed game can work out of the box. To use your own Firebase project, enable Email/Password and Anonymous Authentication, create Firestore, replace `FIREBASE_CONFIG` in `firebase-config.js`, and deploy the rules from `firestore.rules`.

```bash
firebase deploy --only firestore:rules
```

The rules restrict each user to their own `users/{uid}` document. Do not replace them with open development rules.

## 🤝 Contributing

Found a translation issue? Have an idea for a better hunt, theme or accessibility improvement? Contributions are welcome.

1. Fork the repository.
2. Create a focused branch.
3. Make the change.
4. Run `npm run lint`, `npm test` and `npm run build`.
5. Open a pull request with a short description and testing notes.

For dictionary changes, preserve the 600-card / 50-category structure, required translations and unique contextual IDs.

## 📄 License

This project is licensed under the **MIT License** — see the [`LICENSE`](LICENSE) file for the full text.

Bundled fonts (**Press Start 2P** and **Mulmaru**) are third-party works distributed under the **SIL Open Font License 1.1** — see [`assets/FONT_LICENSES.md`](assets/FONT_LICENSES.md).

---

<div align="center">

**© 2026 Khudayberdiev Almaz**

*Built with 💜 and pixels. Happy hunting!* 👾

</div>
