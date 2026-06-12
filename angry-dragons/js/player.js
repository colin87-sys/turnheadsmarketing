import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { input, getAxes } from './input.js';
import { damp } from './util.js';

// Time-based speed ramp: game gets faster as the run progresses.
function speedRamp(t) {
  if (t <= CONFIG.speedRampStart) return 1;
  if (t >= CONFIG.speedRampEnd) return CONFIG.speedRampMax;
  const k = (t - CONFIG.speedRampStart) / (CONFIG.speedRampEnd - CONFIG.speedRampStart);
  return 1 + (CONFIG.speedRampMax - 1) * k;
}

export const player = {
  position: new THREE.Vector3(0, 8, 0),
  velocity: new THREE.Vector2(0, 0),
  speed: CONFIG.baseSpeed,
  dist: 0,
  prevDist: 0,
  boosting: false,
  wasBoosting: false,  // for boost-start detection
  orbTimer: 0,
  regenDelay: 0,
  feverActive: false,  // mirror from game for dragon.js access

  get speedActive() {
    return this.speed > CONFIG.baseSpeed + 8;
  },

  reset() {
    this.position.set(0, 8, 0);
    this.velocity.set(0, 0);
    this.speed = CONFIG.baseSpeed;
    this.dist = 0;
    this.prevDist = 0;
    this.boosting = false;
    this.wasBoosting = false;
    this.orbTimer = 0;
    this.regenDelay = 0;
    this.feverActive = false;
  },

  update(dt) {
    this.prevDist = this.dist;
    this.wasBoosting = this.boosting;

    const axes = getAxes();
    // Boost steering assist: extra control authority while boosting so high
    // speed stays flyable — boost should feel fast, not slippery.
    const steer = this.boosting ? CONFIG.boostSteeringBonus : 1;
    this.velocity.x = damp(this.velocity.x, axes.x * CONFIG.lateralSpeed * steer, CONFIG.moveAccel * steer, dt);
    this.velocity.y = damp(this.velocity.y, axes.y * CONFIG.verticalSpeed * steer, CONFIG.moveAccel * steer, dt);
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.y > CONFIG.laneMaxY) {
      this.position.y = CONFIG.laneMaxY;
      this.velocity.y = Math.min(this.velocity.y, 0);
    }

    this.boosting = input.boost && (game.stamina > 0 || this.orbTimer > 0);
    if (this.boosting) {
      // Orb surge = free boost; fever halves the burn. Combined with ring /
      // window / orb refills, a skilled chain sustains boost indefinitely.
      if (this.orbTimer <= 0) {
        const drain = CONFIG.staminaDrain * (game.feverActive ? 0.5 : 1);
        game.stamina = Math.max(0, game.stamina - drain * dt);
      }
      this.regenDelay = CONFIG.staminaRegenDelay;
    } else {
      this.regenDelay -= dt;
      if (this.regenDelay <= 0) {
        game.stamina = Math.min(CONFIG.staminaMax, game.stamina + CONFIG.staminaRegen * dt);
      }
    }

    if (this.orbTimer > 0) this.orbTimer -= dt;

    const ramp = speedRamp(game.time);
    let targetSpeed = CONFIG.baseSpeed * ramp;
    if (this.boosting)     targetSpeed = CONFIG.boostSpeed * ramp;
    if (this.orbTimer > 0) targetSpeed = Math.max(targetSpeed, CONFIG.orbSpeed * ramp);
    this.speed = damp(this.speed, targetSpeed, CONFIG.speedEase, dt);

    // Track max speed for stats
    if (this.speed > game.maxSpeed) game.maxSpeed = this.speed;

    this.dist += this.speed * dt;
    this.position.z = -this.dist;
    this.feverActive = game.feverActive;
  },
};
