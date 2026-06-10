// Central tuning constants for Dragon Drift.
export const CONFIG = {
  // Flight lane bounds
  laneHalfWidth: 13,
  laneMinY: 2.5,
  laneMaxY: 22,
  playerRadius: 1.2,

  // Speed system
  baseSpeed: 35,
  boostSpeed: 65,
  orbSpeed: 80,
  orbDuration: 2,
  speedEase: 3,
  lateralSpeed: 24,
  verticalSpeed: 18,
  moveAccel: 6,

  // Time-based speed ramp (separate from distance difficulty)
  speedRampStart: 20,     // seconds before ramp begins
  speedRampEnd: 90,       // seconds to reach max ramp
  speedRampMax: 1.35,     // max multiplier on base/boost speed

  // Stamina system
  staminaMax: 100,
  staminaDrain: 25,
  staminaRegen: 15,
  staminaRegenDelay: 1,
  ringStamina: 20,
  orbStamina: 15,

  // Health / collision
  healthMax: 100,
  obstacleDamage: 25,
  groundDamage: 15,
  invulnTime: 1.0,

  // Scoring
  ringScore: 100,
  ringCenterBonus: 50,
  ringCenterRadius: 1.4,
  comboStep: 0.25,
  comboMax: 5,
  distanceScore: 1,

  // Near-miss system
  nearMissBonus: 25,
  nearMissCooldown: 1.8,  // seconds before same obstacle can award near-miss again

  // Fever / Dragon Surge
  feverThreshold: 8,      // consecutive rings to trigger fever
  feverDuration: 8,       // seconds of surge state
  feverMultiplier: 2.0,   // score multiplier during surge

  // Rings
  ringRadius: 3.6,
  ringCatchRadius: 3.9,

  // Endless generation
  spawnAhead: 500,
  cullBehind: 80,
  difficultyRamp: 1800,
  pathClearance: 5,
  seed: 1337,

  // Death freeze-frame
  deathFreezeDuration: 0.45, // seconds of freeze before game-over screen
};
