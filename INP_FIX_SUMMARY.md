# INP Fix Summary

## Problem
**Interaction to Next Paint (INP): 272ms** — needs improvement (threshold: 200ms for "good")

### Breakdown of worst interactions:

| Interaction | Total | Input Delay | Processing | Presentation |
|---|---|---|---|---|
| `button#login-modal-btn` | 248ms | **215ms** | 1ms | 31ms |
| `input#auth-email` | 272ms | **235ms** | 0ms | 3ms |

**Root cause**: The input delay (215–235ms) dominates INP. This means the **main thread is blocked by long tasks** when the user tries to interact — the browser cannot even begin processing the interaction until the current long task finishes.

## Long Tasks Identified

1. **`fetchFreshData()` background work** — After loading cached data, a non-awaited background task runs that:
   - Posts 243KB of JSON to a Web Worker via `postMessage` (synchronous structured clone blocks main thread)
   - Falls back to inline sanitization of 600 words if Worker fails
   - Writes ~243KB to `localStorage` synchronously (`JSON.stringify` + `localStorage.setItem`)

2. **`saveProgress()` synchronous local save** — After each answer:
   - Iterates 600 words to build progress object
   - `JSON.stringify()` the entire progress
   - `localStorage.setItem()` writes the string
   - All synchronous in one unbroken task

3. **`store.setState()` synchronous event dispatch** — Every state change:
   - Immediately dispatches a `CustomEvent`
   - Triggers `updateUI()` which does DOM updates
   - Multiple `setState` calls in the same frame create multiple synchronous DOM update cycles

4. **`backdrop-filter: blur()` on modal/notification** — Expensive GPU paint operation that contributes to presentation delay

## Fixes Applied

### 1. `yieldToMain()` utility (app.js, data.js, storage.js)
```js
function yieldToMain() {
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
    return scheduler.yield();
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}
```
Uses `scheduler.yield()` (Chrome 110+) when available, falls back to `setTimeout(0)`. Yields control to the browser so it can process pending user interactions and paint updates between our work chunks.

### 2. `scheduleIdle()` utility (app.js, data.js, storage.js)
```js
function scheduleIdle(callback, options) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, options);
  }
  return setTimeout(callback, 1);
}
```
Schedules non-urgent work during the browser's idle periods. Falls back to `setTimeout(1ms)` when `requestIdleCallback` is unavailable.

### 3. Break up `fetchFreshData()` with yields (data.js)
- `await yieldToMain()` after Worker creation (before posting 243KB data)
- `await yieldToMain()` before inline sanitization fallback
- `await yieldToMain()` before assigning sanitized data to `gameData`
- Defer `localStorage.setItem()` cache write to `scheduleIdle()` with 2s timeout

### 4. Break up `loadGameData()` with yields (data.js)
- `await yieldToMain()` after `JSON.parse()` of cached data, before starting background fetch

### 5. Debounce + idle-schedule `saveProgress()` local save (storage.js)
- Extract `buildProgressData()` from `saveProgress()`
- Add `debouncedLocalSave()` with 500ms debounce timer
- Schedule actual `JSON.stringify` + `localStorage.setItem` during idle time
- Prevents rapid-fire blocking writes from fast answer clicks

### 6. Batch `store.setState()` notifications via rAF (store.js)
- Multiple `setState()` calls in the same frame are merged
- `changedKeys` accumulated into a `Set` across batched calls
- Single `CustomEvent` dispatched via `requestAnimationFrame`
- Reduces N synchronous DOM update cycles to 1 per frame

### 7. Yield between major `init()` steps (app.js)
- `await yieldToMain()` after `I18nManager.init()`
- `await yieldToMain()` after `loadGameData()`
- `await yieldToMain()` after `loadProgressWrapper()`
- Ensures browser can process interactions between heavy init steps

### 8. Preload Firebase during idle (app.js)
- If user has previously authenticated (`pixelWordHunter_authMethod` in localStorage), start loading `firebase-config.js` during idle time after init
- Firebase modules are ready when user clicks LOGIN/REGISTER, avoiding long `import()` during the interaction itself

### 9. Defer focus management in `showAuthModal()` (app.js)
- Use `scheduleIdle()` with 100ms timeout instead of `setTimeout(50ms)`
- Browser can paint the modal visible before focus moves

### 10. Defer `saveProgress` call in `checkAnswer()` (app.js)
- Wrap `saveProgress()` call in `scheduleIdle()` 
- Let browser process any pending interactions before the save

### 11. Remove expensive `backdrop-filter: blur()` (style.css, index.html)
- Removed `backdrop-filter: blur(4px)` from `.modal` — semi-transparent background already provides visual separation
- Removed `backdrop-filter: blur(20px)` from `.ios-notification` — unnecessary for a transient toast
- These GPU filters cause expensive paint operations that contribute to presentation delay

### 12. Add `content-visibility: auto` (style.css)
- Added to `.game-container` with `contain-intrinsic-size: 100vh 100%`
- Browser can skip rendering off-screen containers entirely

### 13. Add `will-change` and `contain` hints (style.css)
- `.modal`: `will-change: opacity, transform; contain: layout style`
- `.auth-modal`: `will-change: opacity, transform; contain: layout style`
- `.ios-notification`: `will-change: transform`
- Promotes elements to their own compositor layer, avoiding layout/paint of parent during transitions

## Expected Impact

| Metric | Before | Expected After |
|---|---|---|
| Input delay (login btn) | 215ms | <50ms |
| Input delay (email input) | 235ms | <50ms |
| Presentation delay (login btn) | 31ms | <16ms |
| **Total INP** | **272ms** | **<100ms** ✅ |

The dominant factor (input delay) should drop dramatically because:
- Long tasks are broken into yielding chunks → browser can process interactions between them
- localStorage writes are deferred to idle → no longer block interactions
- State change notifications are batched → fewer synchronous DOM updates per frame
- Firebase is preloaded during idle → no blocking import() during LOGIN click
