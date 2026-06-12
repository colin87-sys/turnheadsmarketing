import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { colliders } from './obstacles.js';
import { cameraCtl } from './cameraController.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';
import { triggerDeathBurst } from './dragon.js';
import { burst, gateThreadBurst, nearMissSparks } from './particles.js';
import { comboTier } from './util.js';

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
    crash(player, 'wall');
    return;
  }
  // Ground: bounce + chip
  if (p.y < CONFIG.laneMinY) {
    p.y = CONFIG.laneMinY;
    player.velocity.y = Math.max(player.velocity.y, 6);
    hit(player, 0, 0, CONFIG.groundDamage, 'ground');
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
        hit(player, Math.sign(p.x - c.x) || 1, 0, CONFIG.obstacleDamage, 'pillar');
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
        hit(player, Math.sign(dx) || 1, 0, CONFIG.obstacleDamage, 'shard');
      } else if (dist3 < nearR) {
        awardNearMiss(c, player);
      }

    } else if (c.type === 'bar') {
      if (Math.abs(dz) < c.r + R && Math.abs(p.y - c.y) < c.r * 0.75 + R) {
        hit(player, 0, p.y > c.y ? 1 : -1, CONFIG.obstacleDamage, 'bar');
      } else if (Math.abs(dz) < c.r * 2 + R && Math.abs(p.y - c.y) < c.r * 1.6 + R) {
        awardNearMiss(c, player);
      }

    } else if (c.type === 'gate') {
      if (Math.abs(dz) < c.thick + R) {
        const inGap =
          Math.abs(p.x - c.gapX) < c.gapW - 0.5 &&
          Math.abs(p.y - c.gapY) < c.gapH - 0.5;
        if (!inGap) {
          crash(player, 'gate');
          return;
        }
        if (!c.passed) {
          c.passed = true;
          threadGate(player);
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

// Threading a window pays like a ring: score, combo, stamina, fever progress.
function threadGate(player) {
  const feverBonus = game.feverActive ? CONFIG.feverMultiplier : 1;
  const points = Math.round(CONFIG.gateScore * game.combo * feverBonus);
  game.score += points;
  const tierBefore = comboTier(game.combo);
  game.combo = Math.min(CONFIG.comboMax, game.combo + CONFIG.comboStep);
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.consecutiveRings++;
  game.stamina = Math.min(CONFIG.staminaMax, game.stamina + CONFIG.gateStamina);
  if (game.feverActive) {
    game.feverTimer = Math.min(game.feverTimer + 1.2, CONFIG.feverDuration);
  }
  ui.gatePopup(points);
  sfx.gate();
  gateThreadBurst(player.position);
  const tierAfter = comboTier(game.combo);
  if (tierAfter > tierBefore) sfx.comboUp(tierAfter);
  if (!game.feverActive && game.consecutiveRings >= game.feverGoal) {
    game.feverActive = true;
    game.feverTimer = CONFIG.feverDuration;
    game.markSurgeSeen();
    ui.feverStart();
    sfx.feverStart();
    burst(player.position, 0xff88ff, { count: 30, speed: 16, size: 1.3 });
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
  nearMissSparks(player.position);
}

function hit(player, pushX, pushY, damage = CONFIG.obstacleDamage, cause = 'shard') {
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
  if (game.health <= 0) die(player, cause, false);
}

function crash(player, cause) {
  game.health = 0;
  cameraCtl.shake(2.8);
  die(player, cause, true);
}

function die(player, cause, lethal) {
  game.state = 'gameover';
  game.deathCause = cause;
  game.deathFreezeTimer = CONFIG.deathFreezeDuration;
  triggerDeathBurst(player.position.clone(), lethal);
  sfx.crash();
  ui.damageFlash(lethal);
}
