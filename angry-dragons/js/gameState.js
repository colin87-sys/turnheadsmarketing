import { CONFIG } from './config.js';

function load(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0; // private browsing / no storage
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable; the run still counts, it just won't persist
  }
}

// Shared mutable game state. Modules read/write this; main.js drives transitions.
export const game = {
  state: 'ready', // ready | playing | gameover
  score: 0,
  combo: 1,
  maxCombo: 1,
  health: CONFIG.healthMax,
  stamina: CONFIG.staminaMax,
  ringsCollected: 0,
  distance: 0,
  time: 0,
  highScore: load('angryDragonsHighScore'),
  bestDistance: load('angryDragonsBestDist'),
  isNewHighScore: false,
  isNewBestDistance: false,
  challengeScore: 0, // set from a shared ?challenge= link

  reset() {
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.health = CONFIG.healthMax;
    this.stamina = CONFIG.staminaMax;
    this.ringsCollected = 0;
    this.distance = 0;
    this.time = 0;
    this.isNewHighScore = false;
    this.isNewBestDistance = false;
  },

  recordBests() {
    this.isNewHighScore = this.score > this.highScore && this.score > 0;
    if (this.isNewHighScore) {
      this.highScore = Math.floor(this.score);
      save('angryDragonsHighScore', this.highScore);
    }
    this.isNewBestDistance = this.distance > this.bestDistance;
    if (this.isNewBestDistance) {
      this.bestDistance = Math.floor(this.distance);
      save('angryDragonsBestDist', this.bestDistance);
    }
  },
};
