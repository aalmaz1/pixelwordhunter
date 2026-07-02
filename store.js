/**
 * store.js
 * Central State Management for Pixel Word Hunter
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
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // Notify listeners about the change
    this.dispatchEvent(new CustomEvent('stateChange', { 
      detail: { 
        state: this.state,
        prevState,
        changedKeys: Object.keys(newState)
      } 
    }));
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
