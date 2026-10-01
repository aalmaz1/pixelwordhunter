/**
 * Scrollable screens must not grow past the window.
 *
 * The reported bug: at 100% zoom on a 720px-tall window the Settings content is
 * ~652px plus padding, and `height: auto` let `#settings-screen` grow to 800px
 * while `html, body { overflow: hidden !important }` clipped everything. LOGOUT
 * ended up below the fold with no scrollbar anywhere — the only way out was
 * zooming the browser out.
 *
 * These checks are CSS-level on purpose: jsdom has no layout engine, so the
 * guard is the invariant (viewport height + scrollable + pinned BACK button)
 * rather than a screenshot.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Declaration blocks whose selector list contains `selector`. */
const rulesFor = (selector) => {
  const rules = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((s) => s.trim());
    if (selectors.includes(selector)) rules.push(match[2]);
  }
  return rules;
};

const declarations = (selector) => rulesFor(selector).join(';').replace(/\s+/g, ' ');

describe('scrollable screens', () => {
  it.each(['#settings-screen', '#category-screen'])(
    '%s is pinned to the viewport and scrolls its own content',
    (selector) => {
      const decls = declarations(selector);
      // A viewport-tall box is what makes `overflow-y: auto` do the scrolling.
      expect(decls).toMatch(/height: 100dvh/);
      expect(decls).toMatch(/min-height: 100dvh/);
      expect(decls).toMatch(/overflow-y: auto/);
      // `height: auto` is the regression: the screen grows and the body clips.
      expect(decls).not.toMatch(/height: auto/);
    },
  );

  it.each(['#settings-screen', '#category-screen'])(
    '%s lets its BACK button pin to the viewport while the content scrolls',
    (selector) => {
      // `position: fixed` only works when no ancestor is a containing block for
      // it: an identity transform, `content-visibility: auto` and `contain:
      // layout` each break it, and .game-container applies all three.
      const decls = declarations(selector);
      expect(decls).toMatch(/transform: none/);
      expect(decls).toMatch(/content-visibility: visible/);
      expect(decls).not.toMatch(/contain: layout/);
    },
  );

  it('keeps the pinned BACK button readable over scrolled content', () => {
    expect(declarations('#settings-screen .back-btn')).toMatch(/position: fixed/);
    expect(declarations('#settings-screen .back-btn')).toMatch(/background: var\(--bg-deep\)/);
    expect(declarations('#category-screen .back-btn')).toMatch(/position: fixed/);
  });
});
