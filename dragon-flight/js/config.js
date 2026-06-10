// Central tuning constants for Dragon Flight.
export const CONFIG = {
  // Flight lane bounds (the playable corridor)
  laneHalfWidth: 13,
  laneMinY: 2.5,
  laneMaxY: 22,
  playerRadius: 1.2,

  // Speed system
  baseSpeed: 35,
  boostSpeed: 65,
  orbSpeed: 80,
  orbDuration: 4, // seconds of speed burst per orb
  speedEase: 3, // how fast forward speed eases toward its target
  lateralSpeed: 24,
  verticalSpeed: 18,
  moveAccel: 6, // easing rate for lateral/vertical velocity

  // Stamina system
  staminaMax: 100,
  staminaDrain: 25, // per second while boosting
  staminaRegen: 15, // per second
  staminaRegenDelay: 1, // seconds after boosting before regen starts

  // Health / collision
  healthMax: 100,
  obstacleDamage: 25,
  wallDamage: 15,
  invulnTime: 1.0, // seconds of damage immunity after a hit

  // Scoring
  ringScore: 100,
  ringCenterBonus: 50,
  ringCenterRadius: 1.4, // distance from ring center that counts as "perfect"
  comboStep: 0.25,
  comboMax: 5,

  // Rings
  ringRadius: 3.6,
  ringCount: 32,

  // Level
  levelLength: 2600, // ~75s at base speed
  orbCount: 6,
  seed: 1337, // fixed seed so every run uses the same course
};
