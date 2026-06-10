import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { input, getAxes } from './input.js';
import { damp } from './util.js';

// Player flight model. The dragon always moves forward (-z); "dist" is the
// distance flown so far, used by rings/powerups/collision for crossing tests.
export const player = {
  position: new THREE.Vector3(0, 8, 0),
  velocity: new THREE.Vector2(0, 0), // x = lateral, y = vertical
  speed: CONFIG.baseSpeed,
  dist: 0,
  prevDist: 0,
  boosting: false,
  orbTimer: 0,
  regenDelay: 0,

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
    this.orbTimer = 0;
    this.regenDelay = 0;
  },

  update(dt) {
    this.prevDist = this.dist;

    // Smooth steering: ease velocity toward the (analog) input direction.
    const axes = getAxes();
    this.velocity.x = damp(this.velocity.x, axes.x * CONFIG.lateralSpeed, CONFIG.moveAccel, dt);
    this.velocity.y = damp(this.velocity.y, axes.y * CONFIG.verticalSpeed, CONFIG.moveAccel, dt);
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Soft ceiling clamp (no damage; walls/floor are handled in collision.js).
    if (this.position.y > CONFIG.laneMaxY) {
      this.position.y = CONFIG.laneMaxY;
      this.velocity.y = Math.min(this.velocity.y, 0);
    }

    // Stamina boost (Spacebar).
    this.boosting = input.boost && game.stamina > 0;
    if (this.boosting) {
      game.stamina = Math.max(0, game.stamina - CONFIG.staminaDrain * dt);
      this.regenDelay = CONFIG.staminaRegenDelay;
    } else {
      this.regenDelay -= dt;
      if (this.regenDelay <= 0) {
        game.stamina = Math.min(CONFIG.staminaMax, game.stamina + CONFIG.staminaRegen * dt);
      }
    }

    // Speed orb burst (free speed, no stamina cost).
    if (this.orbTimer > 0) this.orbTimer -= dt;

    let targetSpeed = CONFIG.baseSpeed;
    if (this.boosting) targetSpeed = CONFIG.boostSpeed;
    if (this.orbTimer > 0) targetSpeed = Math.max(targetSpeed, CONFIG.orbSpeed);
    this.speed = damp(this.speed, targetSpeed, CONFIG.speedEase, dt);

    this.dist += this.speed * dt;
    this.position.z = -this.dist;
  },
};
