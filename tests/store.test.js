import { describe, it, expect } from 'vitest';

// Queue-based rAF: pushes callbacks onto a list and flushes them on demand,
// which lets us verify the store batches multiple setState calls in one frame.
const rafQueue = [];
globalThis.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
if (typeof window !== 'undefined') window.requestAnimationFrame = globalThis.requestAnimationFrame;
function flushRaf() { const q = rafQueue.splice(0); q.forEach(cb => cb(0)); }

const { store } = await import('../store.js');

describe('store setState batching', () => {
  it('merges multiple setState calls in a single dispatch', () => {
    const events = [];
    const handler = (e) => events.push(e.detail.changedKeys);
    store.addEventListener('stateChange', handler);

    store.setState({ xp: 10 });
    store.setState({ theme: 'matrix' });

    // Before flush: nothing dispatched yet.
    expect(events.length).toBe(0);
    flushRaf();
    expect(events.length).toBe(1);
    expect(events[0].sort()).toEqual(['theme', 'xp']);

    store.removeEventListener('stateChange', handler);
  });

  it('setUser toggles isAuthenticated (state visible immediately)', () => {
    store.setUser({ uid: 'u1' });
    expect(store.getState().isAuthenticated).toBe(true);
    store.setUser(null);
    expect(store.getState().isAuthenticated).toBe(false);
    flushRaf();
  });
});
