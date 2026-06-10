import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';

let scene = null;
let geo = null;
const rings = [];

export function initRings(s) {
  scene = s;
  geo = new THREE.TorusGeometry(CONFIG.ringRadius, 0.38, 14, 48);
}

export function addRing(p) {
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
    if (r.dist < player.dist - CONFIG.cullBehind) { removeAt(i); continue; }

    if (!r.collected && !r.missed) {
      r.mesh.rotation.z = time * 0.6;

      // Rings glow brighter during fever
      const feverGlow = game.feverActive ? 4.5 : 1.8;
      r.mesh.material.emissiveIntensity = feverGlow;
      r.mesh.material.emissive.setHex(game.feverActive ? 0x80ffcc : 0x12c95e);
      r.mesh.scale.setScalar(1 + Math.sin(time * 3 + r.dist) * 0.05 + (game.feverActive ? 0.08 : 0));

      if (player.prevDist < r.dist && player.dist >= r.dist) {
        const d = Math.hypot(player.position.x - r.x, player.position.y - r.y);
        if (d <= CONFIG.ringCatchRadius) collect(r, d);
        else miss(r);
      }
    } else if (r.collected && r.flash > 0) {
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

  // Fever extends its own duration when a ring is collected
  if (game.feverActive) {
    game.feverTimer = Math.min(game.feverTimer + 1.2, CONFIG.feverDuration);
  }

  const feverBonus = game.feverActive ? CONFIG.feverMultiplier : 1;
  const points = Math.round(CONFIG.ringScore * game.combo * feverBonus) + (perfect ? CONFIG.ringCenterBonus : 0);
  game.score += points;
  game.ringsCollected++;
  if (perfect) game.perfectRings++;
  game.consecutiveRings++;
  game.combo = Math.min(CONFIG.comboMax, game.combo + CONFIG.comboStep);
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  game.stamina = Math.min(CONFIG.staminaMax, game.stamina + CONFIG.ringStamina);
  ui.ringPopup(points, perfect);
  sfx.ring(game.combo);

  // Check fever threshold
  if (!game.feverActive && game.consecutiveRings >= CONFIG.feverThreshold) {
    game.feverActive = true;
    game.feverTimer = CONFIG.feverDuration;
    ui.feverStart();
    sfx.feverStart();
  }
}

function miss(r) {
  r.missed = true;
  game.consecutiveRings = 0;
  if (game.feverActive) { game.feverActive = false; game.feverTimer = 0; }
  if (game.combo > 1) { ui.comboBreak(); sfx.comboBreak(); }
  game.combo = 1;
}

function removeAt(i) {
  const r = rings[i];
  scene.remove(r.mesh);
  r.mesh.material.dispose();
  rings.splice(i, 1);
}

export function ringCount() { return rings.length; }

export function resetRings() {
  while (rings.length) removeAt(rings.length - 1);
}
