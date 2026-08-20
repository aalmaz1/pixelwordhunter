/**
 * store.js
 * Central State Management for Pixel Word Hunter
 *
 * INP optimization: setState notifications are scheduled via
 * requestAnimationFrame so rapid state changes (e.g. during a
 * checkAnswer → updateWordProgress → saveProgress sequence) are
 * batched into a single frame, avoiding multiple synchronous
 * event dispatches that each trigger DOM updates.
 */

class Store extends EventTarget {
  constructor() {
    super();
    this.state = {
      // User & Auth
      user: null,
      isAuthenticated: false,
      authMode: 'login',

      // Progress & Stats
      xp: 0,
      masteredCount: 0,
      learningCount: 0,
      reviewCount: 0,
      dailyStreak: 0,

      // Game State
      currentCategory: 'All',
      currentRound: null,
      currentQ: 0,
      roundScore: 0,
      wordStartTime: null,
      isAnswerLocked: false,
      difficulty: 'NORMAL', // TACTICAL, INSTINCT
      
      // Settings
      theme: 'cyberpunk',
      audioEnabled: true,
      language: 'en', // 'en', 'ru', 'ko'

      // Data
      words: [],
      categories: [],
      
      // Review Session State (moved from global variables)
      reviewSessionData: [],
      completedRoundsCount: 0
    };

    // rAF-based notification batching
    this._pendingNotify = null;
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    const changedKeys = Object.keys(newState);

    // Batch notifications via requestAnimationFrame.
    // If multiple setState calls happen in the same frame
    // (e.g. during answer checking), we merge the changedKeys
    // and dispatch a single event, reducing synchronous DOM updates.
    if (!this._pendingNotify) {
      this._pendingNotify = {
        prevState,
        changedKeys: new Set(changedKeys)
      };
      requestAnimationFrame(() => {
        if (!this._pendingNotify) return;
        const { prevState: prev, changedKeys: keys } = this._pendingNotify;
        this._pendingNotify = null;
        this.dispatchEvent(new CustomEvent('stateChange', {
          detail: {
            state: this.state,
            prevState: prev,
            changedKeys: Array.from(keys)
          }
        }));
      });
    } else {
      // Merge changed keys from this call into the pending batch
      for (const k of changedKeys) {
        this._pendingNotify.changedKeys.add(k);
      }
    }
  }

  // Helper actions
  updateXP(amount) {
    const newXP = this.state.xp + amount;
    this.setState({ xp: newXP });
    return newXP;
  }

  setUser(user) {
    this.setState({
      user,
      isAuthenticated: !!user
    });
  }

  setTheme(theme) {
    this.setState({ theme });
    document.body.setAttribute('data-theme', theme);
  }

  toggleAudio() {
    this.setState({ audioEnabled: !this.state.audioEnabled });
  }
}

export const store = new Store();
