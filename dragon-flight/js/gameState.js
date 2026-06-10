import { CONFIG } from './config.js';

function loadHighScore() {
  try {
    return Number(localStorage.getItem('dragonFlightHighScore')) || 0;
  } catch {
    return 0; // private browsing / no storage
  }
}

// Shared mutable game state. Modules read/write this; main.js drives transitions.
export const game = {
  state: 'ready', // ready | playing | gameover | finished
  score: 0,
  combo: 1,
  maxCombo: 1,
  health: CONFIG.healthMax,
  stamina: CONFIG.staminaMax,
  ringsCollected: 0,
  ringsTotal: 0,
  time: 0,
  timeBonus: 0,
  highScore: loadHighScore(),
  isNewHighScore: false,
  challengeScore: 0, // set from a shared ?challenge= link

  reset() {
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.health = CONFIG.healthMax;
    this.stamina = CONFIG.staminaMax;
    this.ringsCollected = 0;
    this.time = 0;
    this.timeBonus = 0;
    this.isNewHighScore = false;
  },

  recordHighScore() {
    this.isNewHighScore = this.score > this.highScore && this.score > 0;
    if (this.isNewHighScore) {
      this.highScore = Math.floor(this.score);
      try {
        localStorage.setItem('dragonFlightHighScore', String(this.highScore));
      } catch {
        // storage unavailable; the run still counts, it just won't persist
      }
    }
  },
};
