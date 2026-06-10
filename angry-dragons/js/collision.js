import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { colliders } from './obstacles.js';
import { cameraCtl } from './cameraController.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';

// Hit rules: floating obstacles (pillars, shards, bars) chip 25 health with a
// grace period; the canyon walls, the ground and crystal-gate faces are
// instantly fatal — one clipped wing ends the flight.
let invuln = 0;

export function resetCollision() {
  invuln = 0;
}

export function updateCollision(dt, player) {
  if (game.state !== 'playing') return;
  if (invuln > 0) invuln -= dt;
  const p = player.position;
  const R = CONFIG.playerRadius;

  // Canyon walls and the ground: fatal.
  if (p.x > CONFIG.laneHalfWidth || p.x < -CONFIG.laneHalfWidth || p.y < CONFIG.laneMinY) {
    crash();
    return;
  }

  for (const c of colliders) {
    const dz = player.dist - c.dist;
    if (Math.abs(dz) > 25) continue;

    if (c.type === 'pillar') {
      if (Math.hypot(p.x - c.x, dz) < c.r * 0.8 + R && p.y < c.h) {
        hit(player, Math.sign(p.x - c.x) || 1, 0);
      }
    } else if (c.type === 'shard') {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      if (dx * dx + dy * dy + dz * dz < (c.r + R) * (c.r + R)) {
        hit(player, Math.sign(dx) || 1, 0);
      }
    } else if (c.type === 'bar') {
      if (Math.abs(dz) < c.r + R && Math.abs(p.y - c.y) < c.r + R) {
        hit(player, 0, p.y > c.y ? 1 : -1);
      }
    } else if (c.type === 'gate') {
      if (Math.abs(dz) < c.thick + R) {
        const inGap =
          Math.abs(p.x - c.gapX) < c.gapW - 0.5 && Math.abs(p.y - c.gapY) < c.gapH - 0.5;
        if (!inGap) {
          crash(); // smashed into the crystal wall
          return;
        }
      }
    }
    if (game.state !== 'playing') return;
  }
}

function hit(player, pushX, pushY) {
  if (invuln > 0) return;
  invuln = CONFIG.invulnTime;
  game.health = Math.max(0, game.health - CONFIG.obstacleDamage);
  if (pushX) player.velocity.x += pushX * 10; // knock off the obstacle
  if (pushY) player.velocity.y += pushY * 8;
  cameraCtl.shake(0.8);
  ui.damageFlash();
  sfx.damage();
  if (game.health <= 0) die();
}

function crash() {
  game.health = 0;
  cameraCtl.shake(1.4);
  die();
}

function die() {
  game.state = 'gameover';
  game.recordBests();
  ui.damageFlash();
  sfx.damage();
  sfx.gameover();
  ui.showScreen('gameover');
}
