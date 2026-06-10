import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';

// Glowing score rings. A ring is judged the moment the player crosses its
// plane: inside the ring scores (center = bonus), outside breaks the combo.
const rings = [];

export function createRings(scene, layout) {
  const geo = new THREE.TorusGeometry(CONFIG.ringRadius, 0.35, 12, 40);
  for (const p of layout.rings) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x39c5ff,
      emissive: 0x1e90ff,
      emissiveIntensity: 1.6,
      transparent: true,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, p.y, -p.dist);
    scene.add(mesh);
    rings.push({ mesh, dist: p.dist, x: p.x, y: p.y, collected: false, missed: false, flash: 0 });
  }
  game.ringsTotal = rings.length;
}

export function updateRings(dt, player, time) {
  for (const r of rings) {
    if (!r.collected && !r.missed) {
      r.mesh.rotation.z = time * 0.6;
      r.mesh.scale.setScalar(1 + Math.sin(time * 3 + r.dist) * 0.05);

      if (player.prevDist < r.dist && player.dist >= r.dist) {
        const d = Math.hypot(player.position.x - r.x, player.position.y - r.y);
        if (d <= CONFIG.ringRadius - 0.6) collect(r, d);
        else miss(r);
      }
    } else if (r.collected && r.flash > 0) {
      // Collected: flash bright, expand and fade out.
      r.flash -= dt * 2;
      const k = Math.max(r.flash, 0);
      r.mesh.scale.setScalar(1 + (1 - k) * 1.5);
      r.mesh.material.opacity = k;
      r.mesh.material.emissiveIntensity = 3;
      if (k <= 0) r.mesh.visible = false;
    }
  }
}

function collect(r, centerDist) {
  r.collected = true;
  r.flash = 1;
  const perfect = centerDist <= CONFIG.ringCenterRadius;
  const points = Math.round(CONFIG.ringScore * game.combo) + (perfect ? CONFIG.ringCenterBonus : 0);
  game.score += points;
  game.ringsCollected++;
  game.combo = Math.min(CONFIG.comboMax, game.combo + CONFIG.comboStep);
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.stamina = Math.min(CONFIG.staminaMax, game.stamina + CONFIG.ringStamina);
  ui.ringPopup(points, perfect);
  sfx.ring(game.combo); // sound effect hook
}

function miss(r) {
  r.missed = true;
  if (game.combo > 1) ui.comboBreak();
  game.combo = 1;
}

export function resetRings() {
  for (const r of rings) {
    r.collected = false;
    r.missed = false;
    r.flash = 0;
    r.mesh.visible = true;
    r.mesh.scale.setScalar(1);
    r.mesh.material.opacity = 1;
    r.mesh.material.emissiveIntensity = 1.6;
  }
}
