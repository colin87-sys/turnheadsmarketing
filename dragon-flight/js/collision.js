import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { colliders } from './obstacles.js';
import { cameraCtl } from './cameraController.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';

// Health, damage, and all hit tests (canyon bounds + obstacles).
let invuln = 0;

export function resetCollision() {
  invuln = 0;
}

export function updateCollision(dt, player) {
  if (invuln > 0) invuln -= dt;
  const p = player.position;
  const R = CONFIG.playerRadius;

  // Canyon walls and floor: clamp back into the lane and take chip damage.
  if (p.x > CONFIG.laneHalfWidth) {
    p.x = CONFIG.laneHalfWidth;
    player.velocity.x = Math.min(player.velocity.x, 0);
    hit(CONFIG.wallDamage, player);
  } else if (p.x < -CONFIG.laneHalfWidth) {
    p.x = -CONFIG.laneHalfWidth;
    player.velocity.x = Math.max(player.velocity.x, 0);
    hit(CONFIG.wallDamage, player);
  }
  if (p.y < CONFIG.laneMinY) {
    p.y = CONFIG.laneMinY;
    player.velocity.y = Math.max(player.velocity.y, 0);
    hit(CONFIG.wallDamage, player);
  }

  // Obstacles near the player's current distance.
  for (const c of colliders) {
    const dz = player.dist - c.dist;
    if (Math.abs(dz) > 25) continue;

    if (c.type === 'pillar') {
      const horiz = Math.hypot(p.x - c.x, dz);
      if (horiz < c.r * 0.8 + R && p.y < c.h) {
        hit(CONFIG.obstacleDamage, player, Math.sign(p.x - c.x) || 1);
      }
    } else if (c.type === 'shard') {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      if (dx * dx + dy * dy + dz * dz < (c.r + R) * (c.r + R)) {
        hit(CONFIG.obstacleDamage, player, Math.sign(dx) || 1);
      }
    } else if (c.type === 'gate') {
      if (Math.abs(dz) < c.thick + R) {
        const inGap =
          Math.abs(p.x - c.gapX) < c.gapW - 0.5 && Math.abs(p.y - c.gapY) < c.gapH - 0.5;
        if (!inGap) hit(CONFIG.obstacleDamage, player, Math.sign(p.x - c.gapX) || 1);
      }
    }
  }
}

function hit(damage, player, pushDir = 0) {
  if (invuln > 0) return;
  invuln = CONFIG.invulnTime;

  game.health = Math.max(0, game.health - damage);
  if (pushDir) player.velocity.x += pushDir * 10; // small knockback off the obstacle
  cameraCtl.shake(damage >= CONFIG.obstacleDamage ? 0.8 : 0.45);
  ui.damageFlash();
  sfx.damage();

  if (game.health <= 0) {
    game.state = 'gameover';
    game.recordHighScore();
    ui.showScreen('gameover');
    sfx.gameover();
  }
}
