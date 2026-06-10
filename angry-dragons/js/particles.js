import * as THREE from 'three';
import { makeGlowTexture } from './util.js';

// Shared celebration-burst pool: ring collects, orb grabs, gate threads,
// combo tier-ups and fever starts all spray tinted glow sprites from here.
const POOL = 140;
let scene = null;
const sprites = [];
let tex = null;

export function initParticles(s) {
  scene = s;
  tex = makeGlowTexture('255,255,255');
  for (let i = 0; i < POOL; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.visible = false;
    sp.userData = { life: 0, decay: 1, size: 1, vel: new THREE.Vector3() };
    scene.add(sp);
    sprites.push(sp);
  }
}

export function burst(pos, colorHex, { count = 14, speed = 10, size = 0.9, life = 0.7 } = {}) {
  let spawned = 0;
  for (const sp of sprites) {
    if (sp.visible) continue;
    sp.visible = true;
    sp.position.copy(pos);
    sp.material.color.setHex(colorHex);
    const u = sp.userData;
    u.life = 1;
    u.decay = 1 / life;
    u.size = size * (0.7 + Math.random() * 0.6);
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    u.vel.set(Math.cos(a) * v, Math.sin(a) * v, (Math.random() - 0.5) * v * 0.6);
    if (++spawned >= count) break;
  }
}

export function updateParticles(dt) {
  for (const sp of sprites) {
    if (!sp.visible) continue;
    const u = sp.userData;
    u.life -= dt * u.decay;
    if (u.life <= 0) {
      sp.visible = false;
      sp.material.opacity = 0;
      continue;
    }
    sp.position.addScaledVector(u.vel, dt);
    u.vel.multiplyScalar(Math.max(0, 1 - 2.5 * dt));
    u.vel.y -= 4 * dt;
    sp.material.opacity = u.life * 0.9;
    const s = u.size * (0.6 + (1 - u.life) * 1.4);
    sp.scale.set(s, s, 1);
  }
}

export function resetParticles() {
  for (const sp of sprites) {
    sp.visible = false;
    sp.material.opacity = 0;
  }
}
