import { CONFIG } from './config.js';

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

  reset() {
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.health = CONFIG.healthMax;
    this.stamina = CONFIG.staminaMax;
    this.ringsCollected = 0;
    this.time = 0;
  },
};
