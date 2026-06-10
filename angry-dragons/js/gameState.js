import { CONFIG } from './config.js';

function load(key, fallback) {
  try {
    const v = Number(localStorage.getItem(key));
    if (v) return v;
    // Migrate from old Angry Dragons key on first rename
    if (fallback) {
      const fb = Number(localStorage.getItem(fallback));
      if (fb) { localStorage.setItem(key, String(fb)); return fb; }
    }
    return 0;
  } catch { return 0; }
}

function save(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

export const game = {
  state: 'ready', // ready | playing | gameover
  score: 0,
  combo: 1,
  maxCombo: 1,
  health: CONFIG.healthMax,
  stamina: CONFIG.staminaMax,
  ringsCollected: 0,
  perfectRings: 0,
  nearMisses: 0,
  speedOrbsCollected: 0,
  maxSpeed: CONFIG.baseSpeed,
  consecutiveRings: 0,
  feverActive: false,
  feverTimer: 0,
  distance: 0,
  time: 0,
  deathFreezeTimer: 0,
  milestone: 0,        // last distance-milestone announced
  recordBeaten: false, // live "NEW RECORD" shown this run
  highScore: load('dragonDriftHighScore', 'angryDragonsHighScore'),
  bestDistance: load('dragonDriftBestDist', 'angryDragonsBestDist'),
  isNewHighScore: false,
  isNewBestDistance: false,
  challengeScore: 0,

  reset() {
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.health = CONFIG.healthMax;
    this.stamina = CONFIG.staminaMax;
    this.ringsCollected = 0;
    this.perfectRings = 0;
    this.nearMisses = 0;
    this.speedOrbsCollected = 0;
    this.maxSpeed = CONFIG.baseSpeed;
    this.consecutiveRings = 0;
    this.feverActive = false;
    this.feverTimer = 0;
    this.distance = 0;
    this.time = 0;
    this.deathFreezeTimer = 0;
    this.milestone = 0;
    this.recordBeaten = false;
    this.isNewHighScore = false;
    this.isNewBestDistance = false;
  },

  recordBests() {
    this.isNewHighScore = this.score > this.highScore && this.score > 0;
    if (this.isNewHighScore) {
      this.highScore = Math.floor(this.score);
      save('dragonDriftHighScore', this.highScore);
    }
    this.isNewBestDistance = this.distance > this.bestDistance;
    if (this.isNewBestDistance) {
      this.bestDistance = Math.floor(this.distance);
      save('dragonDriftBestDist', this.bestDistance);
    }
  },
};
