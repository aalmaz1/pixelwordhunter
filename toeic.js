/**
 * toeic.js — Lazy-loaded bridge to the TOEIC test bank.
 *
 * Single source of truth: toeic_web_app/toeic_database.json
 * (900 unique questions — 9 parts x 100, synchronized with the standalone app
 * in toeic_web_app/). Imported via dynamic import() from app.js so the ~300 KB
 * bank is only fetched when the user opens the TOEIC TESTS mode.
 */

import toeicDatabase from './toeic_web_app/toeic_database.json';

export const TOEIC_DATA = toeicDatabase;
