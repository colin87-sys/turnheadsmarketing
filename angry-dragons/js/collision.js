import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { colliders } from './obstacles.js';
import { cameraCtl } from './cameraController.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';
import { triggerDeathBurst } from './dragon.js';

// Near-miss cooldown: track per-collider so same obstacle can't spam
const nearMissCooldowns = new WeakMap();

let invuln = 0;

export function resetCollision() {
  invuln = 0;
}

export function updateCollision(dt, player) {
  if (game.state !== 'playing') return;
  if (invuln > 0) invuln -= dt;
  const p = player.position;
  const R = CONFIG.playerRadius;

  // Tick down near-miss cooldowns
  for (const c of colliders) {
    const cd = nearMissCooldowns.get(c);
    if (cd !== undefined && cd > 0) nearMissCooldowns.set(c, cd - dt);
  }

  // Canyon walls: fatal
  if (p.x > CONFIG.laneHalfWidth || p.x < -CONFIG.laneHalfWidth) {
    crash(player);
    return;
  }
  // Ground: bounce + chip
  if (p.y < CONFIG.laneMinY) {
    p.y = CONFIG.laneMinY;
    player.velocity.y = Math.max(player.velocity.y, 6);
    hit(player, 0, 0, CONFIG.groundDamage);
  }

  for (const c of colliders) {
    const dz = player.dist - c.dist;
    if (Math.abs(dz) > 28) continue;

    if (c.type === 'pillar') {
      // Reduced hitbox (0.65 instead of 0.8) = more forgiving side scrapes
      const horiz = Math.hypot(p.x - c.x, dz);
      const hitR   = c.r * 0.65 + R;
      const nearR  = c.r * 1.5 + R;
      if (horiz < hitR && p.y < c.h) {
        hit(player, Math.sign(p.x - c.x) || 1, 0);
      } else if (horiz < nearR && horiz >= hitR && p.y < c.h) {
        awardNearMiss(c, player);
      }

    } else if (c.type === 'shard') {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const dist3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Reduced effective radius by ~30%: shard looks bigger than its hitbox
      const hitR  = c.r * 0.70 + R;
      const nearR = c.r * 1.8 + R;
      if (dist3 < hitR) {
        hit(player, Math.sign(dx) || 1, 0);
      } else if (dist3 < nearR) {
        awardNearMiss(c, player);
      }

    } else if (c.type === 'bar') {
      if (Math.abs(dz) < c.r + R && Math.abs(p.y - c.y) < c.r * 0.75 + R) {
        hit(player, 0, p.y > c.y ? 1 : -1);
      } else if (Math.abs(dz) < c.r * 2 + R && Math.abs(p.y - c.y) < c.r * 1.6 + R) {
        awardNearMiss(c, player);
      }

    } else if (c.type === 'gate') {
      if (Math.abs(dz) < c.thick + R) {
        const inGap =
          Math.abs(p.x - c.gapX) < c.gapW - 0.5 &&
          Math.abs(p.y - c.gapY) < c.gapH - 0.5;
        if (!inGap) {
          crash(player);
          return;
        }
        // Threading through gate close to the edge = near miss
        const marginX = c.gapW - Math.abs(p.x - c.gapX);
        const marginY = c.gapH - Math.abs(p.y - c.gapY);
        if (Math.min(marginX, marginY) < 1.2) {
          awardNearMiss(c, player);
        }
      }
    }
    if (game.state !== 'playing') return;
  }
}

function awardNearMiss(collider, player) {
  const cd = nearMissCooldowns.get(collider) || 0;
  if (cd > 0) return;
  nearMissCooldowns.set(collider, CONFIG.nearMissCooldown);
  game.nearMisses++;
  const bonus = Math.round(CONFIG.nearMissBonus * game.combo);
  game.score += bonus;
  ui.nearMissPopup(bonus);
  sfx.nearMiss();
}

function hit(player, pushX, pushY, damage = CONFIG.obstacleDamage) {
  if (invuln > 0) return;
  invuln = CONFIG.invulnTime;
  game.health = Math.max(0, game.health - damage);
  if (pushX) player.velocity.x += pushX * 10;
  if (pushY) player.velocity.y += pushY * 8;
  cameraCtl.shake(0.8);
  ui.damageFlash();
  sfx.damage();
  // Breaking a combo on damage
  if (game.combo > 1) {
    game.consecutiveRings = 0;
    if (game.feverActive) { game.feverActive = false; game.feverTimer = 0; }
  }
  if (game.health <= 0) die(player);
}

function crash(player) {
  game.health = 0;
  cameraCtl.shake(2.8);
  die(player);
}

function die(player) {
  game.state = 'gameover';
  game.deathFreezeTimer = CONFIG.deathFreezeDuration;
  triggerDeathBurst(player.position.clone());
  sfx.crash();
  ui.damageFlash();
}
