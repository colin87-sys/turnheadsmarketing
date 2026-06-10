import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';

// Glowing score rings, spawned ahead and culled behind the dragon. A ring is
// judged the moment the player crosses its plane: inside scores (center =
// bonus) and restores stamina; outside breaks the combo.
let scene = null;
let geo = null;
const rings = [];

export function initRings(s) {
  scene = s;
  geo = new THREE.TorusGeometry(CONFIG.ringRadius, 0.35, 12, 40);
}

export function addRing(p) {
  // Green: contrasts with the blue speed orbs AND the orange sunset sky.
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3dff8f,
    emissive: 0x12c95e,
    emissiveIntensity: 1.8,
    transparent: true,
    roughness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p.x, p.y, -p.dist);
  scene.add(mesh);
  rings.push({ mesh, dist: p.dist, x: p.x, y: p.y, collected: false, missed: false, flash: 0 });
}

export function updateRings(dt, player, time) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    if (r.dist < player.dist - CONFIG.cullBehind) {
      removeAt(i);
      continue;
    }
    if (!r.collected && !r.missed) {
      r.mesh.rotation.z = time * 0.6;
      r.mesh.scale.setScalar(1 + Math.sin(time * 3 + r.dist) * 0.05);

      if (player.prevDist < r.dist && player.dist >= r.dist) {
        const d = Math.hypot(player.position.x - r.x, player.position.y - r.y);
        // Generous: anywhere through the hoop (even a wing graze) counts;
        // threading the center still pays the bonus.
        if (d <= CONFIG.ringCatchRadius) collect(r, d);
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
  ui.ringPopup(points, perfect); // popup + chime even on edge catches
  sfx.ring(game.combo); // sound effect hook
}

function miss(r) {
  r.missed = true;
  if (game.combo > 1) ui.comboBreak();
  game.combo = 1;
}

function removeAt(i) {
  const r = rings[i];
  scene.remove(r.mesh);
  r.mesh.material.dispose(); // geometry is shared, materials are per-ring
  rings.splice(i, 1);
}

export function ringCount() {
  return rings.length;
}

export function resetRings() {
  while (rings.length) removeAt(rings.length - 1);
}
