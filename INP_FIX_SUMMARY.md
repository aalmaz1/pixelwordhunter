# INP Fix Summary

## Problem
**Interaction to Next Paint (INP): 272ms** — needs improvement (good < 200ms)

### Breakdown of worst interactions:

| Interaction | Total | Input Delay | Processing | Presentation |
|---|---|---|---|---|
| `button#login-modal-btn` | 248ms | **215ms** | 1ms | 31ms |
| `input#auth-email` | 272ms | **235ms** | 0ms | 3ms |

## Root Cause

**The 243KB `words_optimized.json` was statically imported in `data.js`:**
```js
import wordsData from './words_optimized.json';
```

Vite bundles this as `JSON.parse(\`<243KB of JSON>\`)` **at module level** in the main JS bundle (227KB). This `JSON.parse()` runs synchronously during script evaluation, creating a **200ms+ long task** that blocks ALL user interactions.

Timeline:
```
t=0ms    HTML loads
t=50ms   CSS loads, page renders shell
t=100ms  JS bundle (227KB) starts downloading
t=200ms  JS starts parsing → hits JSON.parse(243KB)
t=200-400ms  ████████ LONG TASK: 200ms+ ████████  ← BLOCKS EVERYTHING
t=400ms  Module evaluation continues, init() runs
t=500ms  Page becomes interactive
t=600ms  User clicks LOGIN → sees 215-235ms input delay
         (because they clicked during/after the long task)
```

## Fix: Remove JSON from Main Bundle + Parse in Worker

### Before (main bundle = 227KB):
```
main.js [227KB]
  ├── App logic (~30KB)
  ├── Store, UI, i18n (~10KB)
  └── JSON.parse(`[{...600 words...}]`) ← 243KB INLINE!
```

### After (main bundle = 38KB):
```
main.js [38KB]                     ← Fast parse: ~30ms
  ├── App logic
  ├── Store, UI, i18n
  └── fetch() + Worker pipeline

words_optimized.json [243KB]       ← Fetched async, parsed in Worker
  └── (never touches main thread)
```

### Data Loading Pipeline (zero main-thread blocking):
```
1. fetch('./words_optimized.json')     → async, no blocking
2. response.text()                     → async, no blocking
3. worker.postMessage(jsonText)        → ~0.5ms (string clone)
4. Worker: JSON.parse() + sanitize    → OFF main thread
5. Worker → postMessage(sanitized)    → ~5-10ms (object clone)
6. gameData = sanitizedData            → fast assignment
```

**Total main-thread blocking: ~6-11ms** (down from 200ms+)

## All Changes Made

### Critical (directly fixes the 215ms input delay):
1. **Removed static JSON import** from `data.js` — eliminates 243KB from main bundle
2. **fetch() + Worker pipeline** for data loading — JSON.parse happens off main thread
3. **Removed localStorage word cache** — was redundant (data already in memory) and caused 100-200ms blocking I/O
4. **Fixed O(n²) applyProgress** — used Map for O(1) lookups instead of Array.find()

### Supporting (reduces remaining long tasks):
5. **yieldToMain()** — breaks long tasks with scheduler.yield() / setTimeout(0)
6. **scheduleIdle()** — defers non-urgent work to requestIdleCallback
7. **Debounced + idle-scheduled saveProgress()** — localStorage writes no longer block on every answer
8. **Batched store.setState() via rAF** — multiple state changes dispatch a single event per frame
9. **Yields between init() steps** — browser can process interactions between heavy operations
10. **Firebase preload during idle** — modules ready when user clicks LOGIN
11. **Removed backdrop-filter:blur()** — expensive GPU paint operations
12. **content-visibility:auto** — skip rendering off-screen containers
13. **will-change + contain hints** — promote animated elements to compositor layers

## Expected Impact

| Metric | Before | After |
|---|---|---|
| Main JS bundle | 227KB | **38KB** (-83%) |
| JS parse time | ~200ms | **~30ms** |
| JSON.parse location | Main thread (module level) | **Web Worker** (off thread) |
| localStorage word cache | 100-200ms blocking I/O | **Removed** (redundant) |
| applyProgress complexity | O(n²) = 360K ops | **O(n) = 1200 ops** |
| Input delay | 215-235ms | **<50ms** |
| **Total INP** | **272ms** | **<100ms** ✅ |
