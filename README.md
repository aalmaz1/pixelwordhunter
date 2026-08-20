<div align="center">

# 👾 PIXEL WORD HUNTER

### // TOEIC EDITION //

**Master 600 essential business English words through a retro pixel-art quiz game
with adaptive spaced repetition, XP progression, and full offline support.**

[![Version](https://img.shields.io/badge/version-1.0.0-ff2d78?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-00f5ff?style=flat-square)](#-license)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-bf5fff?style=flat-square)](manifest.json)
[![Built with Vite](https://img.shields.io/badge/built%20with-Vite%208-646cff?style=flat-square&logo=vite&logoColor=white)](vite.config.js)
[![Firebase](https://img.shields.io/badge/sync-Firebase%2011-ffca28?style=flat-square&logo=firebase&logoColor=black)](firebase-config.js)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-39ff14?style=flat-square)](../../pulls)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [How to Play](#-how-to-play)
- [Spaced Repetition System](#-spaced-repetition-system)
- [Word Bank](#-word-bank)
- [Internationalization & Themes](#-internationalization--themes)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Getting Started](#-getting-started)
- [Scripts](#-scripts)
- [Firebase Setup](#-firebase-setup)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Performance Engineering](#-performance-engineering)
- [Accessibility](#-accessibility)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎮 About

**Pixel Word Hunter** is a Progressive Web App (PWA) that turns TOEIC vocabulary
drilling into an arcade experience. Wrapped in a neon cyberpunk aesthetic — CRT
scanlines, glowing pixel typography, synthwave sound effects — the app takes you
through **600 hand-picked business English words across 50 real-world categories**,
from *Contracts* and *Banking* to *Ordering Lunch*.

Built entirely with **vanilla JavaScript** (no UI framework), it is ruthlessly
optimized for instant loads and silky interactions: the dictionary is parsed in a
Web Worker, Firebase is lazy-loaded only when needed, and the whole game works
**100% offline** once installed.

> 🌍 UI and translations are available in **English**, **Русский** and **한국어**.

---

## ✨ Features

### 🧠 Smart Learning Engine
- **Adaptive spaced repetition** (SM-2 inspired) — words you know well fade away, words you struggle with come back sooner
- **600 TOEIC-core vocabulary words** organized into 50 themed categories (12 words each)
- **Bidirectional quizzes** — answer EN → your language *or* your language → EN
- **Real business context** — every word ships with an authentic example sentence and its translation
- **Mastery tracking** — six levels from `NEW` to `MASTER` per word

### 🕹 Game Experience
- 10-question rounds with 4-option multiple-choice answers
- **XP system** — earn `+10 XP` for every correct answer, watch your score grow
- **WORD REVIEW sessions** — a Quizlet-style recap of every word after every 3 rounds
- Retro **Web Audio** sound effects (correct / wrong / hover / transitions), synthesized live — zero audio files
- Instant visual feedback: correct ✓ / wrong ✗ highlighting with pixel-perfect animations

### 🎨 Personalization
- **6 handcrafted themes**: Cyberpunk, Midnight, Matrix, Sunset, 3310 (Nokia-retro), and Mono
- **3 languages**: English, Russian, Korean (UI + word translations)
- Sound on/off toggle persisted across sessions

### ☁️ Accounts & Sync
- Email/password **and** anonymous sign-in via Firebase Auth
- **Cloud progress sync** through Firestore — pick up on any device where you left off
- **Real-time XP synchronization** across open tabs via Firestore snapshots
- **Offline-first**: full game works without an account; progress lives locally until you sign in
- **Backup & restore** — export/import your entire progress as a JSON file (`pwh-backup-YYYY-MM-DD.json`)

### 📱 PWA & Performance
- Installable on desktop and mobile (standalone mode, themed splash)
- **Fully offline-capable** via Workbox service worker with smart precaching and runtime caching
- Engineered for near-zero INP latency (see [Performance Engineering](#-performance-engineering))

---

## 🎯 How to Play

1. **Sign in** (optional) — create an account to sync progress, or just start playing.
2. Press **▸ HUNT ◂** and pick a category — or choose **ALL** for a mixed run.
3. Answer **10 questions** per round by picking the correct translation.
4. After each question, review the word with its **real-life business example**.
5. Every **3 rounds** you get a **WORD REVIEW** recap of all attempted words.
6. Repeat — the SRS engine automatically resurfaces words exactly when you're about to forget them.

### ⌨️ Keyboard Shortcuts

| Key | Action |
|:---:|---|
| `1` – `4` | Select answer option |
| `Enter` / `Space` | Next question / start hunting |
| `Esc` | Close modal dialogs |

---

## 🧠 Spaced Repetition System

Each word carries a mastery level from 0 to 5. Correct answers level the word up;
mistakes bump it back down. Words become *due* for review once their interval
elapses, and the scheduler prioritizes new, struggling and due words when
building each round:

| Mastery | Label | Review Interval |
|:--:|:---:|---:|
| 0 | 🆕 NEW | Immediately |
| 1 | 📗 LEARNING | 1 hour |
| 2 | 📘 FAMILIAR | 6 hours |
| 3 | 📙 GOOD | 24 hours |
| 4 | 📕 STRONG | 3 days |
| 5 | 👑 MASTER | 7 days |

> A word counts as **Mastered** at level 4+ and is tracked on your stats line.

---

## 📚 Word Bank

The dictionary (`words_optimized.json`) contains **600 contextual learning cards**
(325 unique English terms; recurring terms are intentionally practiced in multiple
categories) with Russian and Korean translations plus example sentences in all
three languages. Every card has a stable category-aware `id`, so repeated terms
keep independent mastery and SRS history. Categories are drawn from the classic
TOEIC 600-word curriculum — business,
travel, office life, finance, dining, health and more.

<details>
<summary><b>📂 All 50 categories (click to expand)</b></summary>

<br>

`Accounting` · `Airlines` · `Applying and Interviewing` · `Banking` ·
`Board Meeting and Committees` · `Business Planning` · `Car Rentals` ·
`Computers` · `Conferences` · `Contracts` · `Cooking as a Career` ·
`Correspondence` · `Dentists Office` · `Doctors Office` · `Eating Out` ·
`Electronics` · `Events` · `Financial Statements` · `General Travel` ·
`Health Insurance` · `Hiring and Training` · `Hospitals` · `Hotels` ·
`Inventory` · `Investments` · `Invoices` · `Job Advertising and Recruiting` ·
`Marketing` · `Media` · `Movies` · `Museums` · `Music` · `Office Procedures` ·
`Office Technology` · `Ordering Lunch` · `Ordering Supplies` · `Pharmacy` ·
`Product Development` · `Promotions, Pensions, and Awards` ·
`Property and Departments` · `Quality Control` · `Renting and Leasing` ·
`Salaries and Benefits` · `Selecting a Restaurant` · `Shipping` · `Shopping` ·
`Taxes` · `Theater` · `Trains` · `Warranties`

</details>

### Progress and backup format

Progress uses the version 3, ID-keyed format. On first load, legacy version 2
saves keyed by English text are migrated automatically; a legacy result is copied
to every matching contextual card to avoid data loss. Guest and signed-in users
have separate local namespaces, and the app asks before merging guest progress
into an email account. Version 2 backup files remain importable.

The UI language (EN/RU/KO) and vocabulary translation language (RU/KO) are
separate settings.

### Word entry format

```json
{
  "id": "contracts--abide-by",
  "category": "Contracts",
  "eng": "abide by",
  "rus": "соблюдать",
  "kor": "준수하다",
  "exampleEng": "You must abide by the company rules.",
  "exampleRus": "Вы должны соблюдать правила компании.",
  "exampleKor": "회사 규칙을 준수해야 합니다."
}
```

---

## 🌐 Internationalization & Themes

### Languages

| Code | Language | Coverage |
|:---:|---|---|
| `EN` | English | UI + questions |
| `RU` | Русский | UI + word translations + examples |
| `KO` | 한국어 | UI + word translations + examples |

Translations are lazy-loaded JSON files (`i18n/*.json`) — adding a fourth
language is as simple as dropping in a new file and a button.

### Themes

| Theme | Vibe |
|:---:|---|
| 💜 **Cyberpunk** *(default)* | Neon pink/cyan synthwave glow with CRT scanlines |
| 🌃 **Midnight** | Deep-space blues and violet |
| 🟢 **Matrix** | Classic falling-code green |
| 🌅 **Sunset** | Warm retro dusk palette |
| 📟 **3310** | Legendary Nokia monochrome LCD — no glow, all nostalgia |
| ⬛ **Mono** | Pure high-contrast black & white |

Themes are powered by CSS custom properties, switch instantly, and persist
between sessions.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Core** | Vanilla JavaScript (ES Modules), HTML5, CSS3 — zero UI frameworks |
| **Build** | [Vite 8](https://vite.dev) + esbuild minification |
| **PWA** | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + Workbox (auto-update, precache, runtime cache) |
| **Backend** | [Firebase 11](https://firebase.google.com) — Authentication (email + anonymous), Cloud Firestore (progress & real-time XP sync) |
| **Concurrency** | Web Worker (`data.worker.js`) for off-main-thread JSON parsing |
| **Audio** | Web Audio API — all SFX synthesized in code, no audio assets |
| **Fonts** | Press Start 2P (UI) · Mulmaru (Korean glyphs) — self-hosted `.woff2` |
| **Quality** | ESLint 9 (flat config) |
| **Deploy targets** | Cloudflare Workers Static Assets (`wrangler.jsonc`), GitHub Pages, any static host |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js ≥ 18** and npm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/aalmaz1/pixelwordhunter.git
cd pixelwordhunter

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open the URL printed by Vite (default: <http://localhost:5173>).

### Production build

```bash
# Build an optimized bundle into dist/
npm run build

# Preview the production build locally
npm run preview
```

The `dist/` folder contains everything needed to deploy — including the sealed
service worker, manifest, word data and i18n assets.

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Produce the optimized production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint the codebase with ESLint |

---

## 🔥 Firebase Setup

The repository ships with a working public Firebase web config
(`firebase-config.js`), so the app runs out of the box. To use **your own**
Firebase project:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Authentication → Email/Password** and **Anonymous** providers.
3. Create a **Cloud Firestore** database.
4. Replace the `FIREBASE_CONFIG` object in `firebase-config.js` with your own
   web app credentials.
5. Apply security rules so users can only access their own document:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

> **Data model:** one document per user at `users/{uid}` — stores `username`,
> `email`, `xp`, `progress` (per-word mastery map), `lastSync`.

No Firebase? No problem — the app detects its absence and runs in pure
local-storage mode.

---

## 🚢 Deployment

The app is a static site (`base: './'`), so it deploys anywhere.

### Cloudflare Workers Static Assets (preconfigured)

A `wrangler.jsonc` is included and points at `dist/`:

```bash
npm run build
npx wrangler deploy        # requires Wrangler CLI & a Cloudflare account
```

`public/_headers` ships a real HTTP `Content-Security-Policy: frame-ancestors 'none'`
header (plus `X-Frame-Options: DENY`) — clickjacking protection that the `<meta>`
CSP in `index.html` cannot provide, because browsers ignore `frame-ancestors`
delivered via `<meta>`. Cloudflare parses the file at deploy time; it is never
served as an asset. Other static hosts need the equivalent header configured
on their side.

### GitHub Pages

```bash
npm run build
# Push dist/ to a gh-pages branch, or wire up a GitHub Actions
# workflow that runs `npm ci && npm run build` and deploys dist/.
```

### Netlify / Vercel / any static host

- **Build command:** `npm run build`
- **Publish directory:** `dist`

---

## 🗂 Project Structure

```
pixelwordhunter/
├── index.html            # App shell — inline critical CSS, SEO meta, screens
├── app.js                # Entry point: game flow, audio engine, auth, themes
├── data.js               # Word loading pipeline + SM-2-inspired SRS scheduler
├── data.worker.js        # Web Worker: JSON.parse + sanitization off the main thread
├── store.js              # Central reactive state store (rAF-batched notifications)
├── storage.js            # Persistence: localStorage, Firestore sync, backup/restore
├── ui.js                 # UI initialization & DOM helpers (a11y-aware)
├── i18n.js               # Lazy-loading internationalization manager
├── firebase-config.js    # Lazy Firebase init, XP real-time listener, logout
├── style.css             # Theme system (6 themes) & full component styling
├── words_optimized.json  # 600-word TOEIC dictionary (EN/RU/KO, 50 categories)
├── i18n/                 # UI translations: en.json · ru.json · ko.json
├── assets/               # Fonts (woff2), logo, favicon
├── manifest.json         # Web app manifest
├── robots.txt
├── vite.config.js        # Vite + PWA config, asset-copy plugins
├── eslint.config.js      # ESLint flat config
├── wrangler.jsonc        # Cloudflare static-assets deploy config
└── package.json
```

---

## ⚡ Performance Engineering

This project obsesses over Core Web Vitals — in particular **INP** (Interaction
to Next Paint):

- 🧵 **Web Worker data pipeline** — the 243 KB dictionary is `fetch`ed as text and
  parsed *entirely off the main thread* (the main thread never runs
  `JSON.parse` on it), with graceful dynamic-import fallback
- 💤 **Lazy Firebase** — `firebase/app`, `auth`, and `firestore` are dynamically
  imported only when the user actually logs in, and preloaded during idle time
- 🎯 **Task scheduling** — `scheduler.yield()` / `requestIdleCallback()` break up
  long tasks; progress saving is debounced and idle-scheduled
- 🖼 **rAF-batched state** — the store merges rapid `setState` calls into a single
  notification per animation frame, minimizing synchronous DOM churn
- 🪶 **Render discipline** — `content-visibility`, CSS containment, and async
  font loading keep first paint fast
- 📦 **Smart caching** — Workbox precaches the app shell and caches the word
  bank (30 days) and Google Fonts (1 year) at runtime

---

## ♿ Accessibility

- Semantic landmarks, ARIA roles, `aria-live` regions and descriptive labels
- Skip-to-content link and fully keyboard-navigable gameplay
- Focus management & restoration for modals (`Esc` to close)
- `prefers-reduced-motion` respected across all animations
- Touch targets ≥ 44 px, safe-area insets for notched devices
- Both portrait and landscape orientations fully supported

---

## 🤝 Contributing

Contributions are welcome — new words, translations, themes, or features!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-idea`
3. Commit your changes: `git commit -m "Add amazing idea"`
4. Push and open a Pull Request

Please run `npm run lint` before submitting and keep the pixel spirit alive. 💜

---

## 📄 License

Distributed under the **MIT License** — see the `license` field in
[`package.json`](package.json). You are free to use, modify and share this project.

---

<div align="center">

**© 2026 ALMAZ CORP**

*Built with 💜 and pixels. Happy hunting!* 👾

</div>
