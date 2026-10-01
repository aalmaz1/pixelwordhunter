/**
 * The focus ring has to be visible, or keyboard navigation silently "does
 * nothing": every arrow press moves focus, but the user cannot tell where it
 * went. Two things used to hide it on the list/answer buttons:
 *
 *  - `clip-path` cuts a normal `outline` off (the slanted pixel-art corners);
 *  - category colours and correct/wrong verdicts force `box-shadow` with
 *    `!important`, which beat the plain inset ring.
 *
 * The fix is an inset `!important` ring on the focus rule; this test pins it so
 * a future theme pass cannot quietly take the keyboard back away.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Comments are stripped first: a block comment sitting right before a rule
// would otherwise be captured as part of that rule's selector.
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Rules whose selector list contains `selector`. */
const rulesFor = (selector) => {
  const rules = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((s) => s.trim());
    if (selectors.includes(selector)) rules.push(match[2]);
  }
  return rules;
};

describe('focus visibility', () => {
  it('gives every interactive element a ring, including plain inputs', () => {
    const universal = rulesFor('button:focus-visible').find((b) => /outline/.test(b));
    expect(universal, 'button:focus-visible must exist').toBeTruthy();
    expect(universal).toMatch(/3px solid var\(--neon-green\)/);
    expect(universal).toMatch(/!important/);
    // `[tabindex]:not([tabindex="-1"])` — the screen containers are focused
    // programmatically and must not get a ring.
    expect(css).toContain('[tabindex]:not([tabindex="-1"]):focus-visible');
    expect(rulesFor('input:focus-visible').join()).toMatch(/outline/);
  });

  it('reveals the skip link when it takes focus', () => {
    const rule = rulesFor('.skip-link:focus').join(' ');
    expect(rule).toMatch(/top:\s*0\s*!important/);
  });

  it.each(['.category-btn:focus-visible', '.option-btn:focus-visible', '.mode-btn:focus-visible'])(
    '%s paints an inset ring that beats the theme glows',
    (selector) => {
      const ring = rulesFor(selector).find((body) => /box-shadow/.test(body));
      expect(ring, `${selector} must set box-shadow`).toBeTruthy();
      expect(ring).toMatch(/inset/);
      expect(ring).toMatch(/!important/);
    },
  );

  it('keeps the verdict colour when a graded option is focused', () => {
    expect(rulesFor('.option-btn.correct:focus-visible').join()).toMatch(/inset.*!important/s);
    expect(rulesFor('.option-btn.wrong:focus-visible').join()).toMatch(/inset.*!important/s);
  });
});
