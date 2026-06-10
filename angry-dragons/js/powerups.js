import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';
import { makeGlowTexture } from './util.js';
import { burst } from './particles.js';

let scene = null;
let geo = null;
let glowTex = null;
let coreMat = null;
const orbs = [];

export function initPowerups(s) {
  scene = s;
  geo = new THREE.SphereGeometry(0.75, 16, 12);
  glowTex = makeGlowTexture('80,170,255');
  coreMat = new THREE.MeshStandardMaterial({
    color: 0x66ccff, emissive: 0x2299ff, emissiveIntensity: 2.2, roughness: 0.18,
  });
}

export function addOrb(p) {
  const mesh = new THREE.Mesh(geo, coreMat);
  mesh.position.set(p.x, p.y, -p.dist);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.set(4.8, 4.8, 1);
  mesh.add(glow);
  scene.add(mesh);
  orbs.push({ mesh, glow, dist: p.dist, x: p.x, y: p.y, collected: false, flash: 0 });
}

export function updatePowerups(dt, player, time) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    if (o.dist < player.dist - CONFIG.cullBehind) { removeAt(i); continue; }
    if (!o.collected) {
      o.mesh.position.y = o.y + Math.sin(time * 2 + o.dist) * 0.5;
      const pulse = 4.5 + Math.sin(time * 4 + o.dist) * 0.9;
      o.glow.scale.set(pulse, pulse, 1);

      const dx = player.position.x - o.x;
      const dy = player.position.y - o.mesh.position.y;
      const dz = player.dist - o.dist;
      if (dx * dx + dy * dy + dz * dz < 2.8 * 2.8) {
        o.collected = true;
        o.flash = 1;
        player.orbTimer = CONFIG.orbDuration;
        game.stamina = Math.min(CONFIG.staminaMax, game.stamina + CONFIG.orbStamina);
        game.speedOrbsCollected++;
        ui.orbFlash();
        sfx.orb();
        burst(o.mesh.position, 0x55ccff, { count: 20, speed: 14, size: 1.1 });
      }
    } else if (o.flash > 0) {
      o.flash -= dt * 3;
      const k = Math.max(o.flash, 0);
      const s = 4.5 + (1 - k) * 14;
      o.glow.scale.set(s, s, 1);
      o.glow.material.opacity = k;
      o.mesh.scale.setScalar(Math.max(k, 0.001));
      if (k <= 0) o.mesh.visible = false;
    }
  }
}

function removeAt(i) {
  const o = orbs[i];
  scene.remove(o.mesh);
  o.glow.material.dispose();
  orbs.splice(i, 1);
}

export function orbCount() { return orbs.length; }

export function resetPowerups() {
  while (orbs.length) removeAt(orbs.length - 1);
}
