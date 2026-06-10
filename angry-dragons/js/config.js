// Central tuning constants for Angry Dragons.
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
  orbDuration: 2, // seconds of speed burst per orb
  speedEase: 3, // how fast forward speed eases toward its target
  lateralSpeed: 24,
  verticalSpeed: 18,
  moveAccel: 6, // easing rate for lateral/vertical velocity

  // Stamina system
  staminaMax: 100,
  staminaDrain: 25, // per second while boosting
  staminaRegen: 15, // per second
  staminaRegenDelay: 1, // seconds after boosting before regen starts
  ringStamina: 20, // stamina restored per ring collected
  orbStamina: 15, // stamina restored per speed orb collected

  // Health / collision: floating obstacles chip health, the ground bounces
  // and chips a little; canyon side walls and crystal-gate faces are fatal.
  healthMax: 100,
  obstacleDamage: 25,
  groundDamage: 15,
  invulnTime: 1.0, // seconds of damage immunity after a (non-fatal) hit

  // Scoring
  ringScore: 100,
  ringCenterBonus: 50,
  ringCenterRadius: 1.4, // distance from ring center that counts as "perfect"
  comboStep: 0.25,
  comboMax: 5,
  distanceScore: 1, // points per unit flown — flying fast IS score

  // Rings
  ringRadius: 3.6,
  ringCatchRadius: 3.9, // generous: anywhere through (or grazing) the hoop counts

  // Endless generation
  spawnAhead: 500, // keep the course built this far ahead of the dragon
  cullBehind: 80, // tear down scenery this far behind
  difficultyRamp: 1800, // distance for difficulty to reach 1.0; it keeps creeping after
  pathClearance: 5, // min gap between obstacles and the flight corridor envelope
  seed: 1337, // fixed seed: every run (and every challenger) flies the same canyon
};
