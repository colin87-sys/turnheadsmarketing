import * as THREE from 'three';
import { makeGlowTexture, makeRingTexture, makeRectTexture } from './util.js';

// Celebration particle engine. One pooled set of additive glow sprites
// (tinted per spawn — no material churn) plus a small pool of shockwave
// sprites (ring / rectangle outlines that expand and fade).
//
// Per-sprite userData flags let specialized effects opt out of the default
// drag/gravity/grow behaviour:
//   gravityScale — 0 for streaks/shockwaves that shouldn't fall
//   drag         — 0 to keep streaks fast
//   stretch      — >1 elongates the sprite along its velocity (screen-space)
const POOL = 320;
const SHOCK_POOL = 8;
// Hard cap on concurrently-visible spark sprites (each sprite = 1 draw
// call). Scaled by the adaptive quality factor from main.js.
const VISIBLE_CAP = 150;

let scene = null;
const sprites = [];
const shocks = [];
let tex = null;
let cursor = 0;       // rotating allocation cursor (avoids O(n) find scans)
let visibleCount = 0;
let quality = 1;

const tmpV = new THREE.Vector3();

export function setParticleQuality(q) {
  quality = q;
}

export function initParticles(s) {
  scene = s;
  tex = makeGlowTexture('255,255,255');
  for (let i = 0; i < POOL; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.visible = false;
    sp.userData = {
      life: 0, decay: 1, size: 1, vel: new THREE.Vector3(),
      gravityScale: 1, drag: 1, stretch: 1,
    };
    scene.add(sp);
    sprites.push(sp);
  }
  const ringTex = makeRingTexture();
  const rectTex = makeRectTexture();
  for (let i = 0; i < SHOCK_POOL; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: i % 2 ? rectTex : ringTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.visible = false;
    sp.userData = { life: 0, decay: 1, grow: 10, isRect: !!(i % 2) };
    scene.add(sp);
    shocks.push(sp);
  }
}

function acquire() {
  if (visibleCount >= VISIBLE_CAP * quality) return null;
  for (let n = 0; n < POOL; n++) {
    const sp = sprites[cursor];
    cursor = (cursor + 1) % POOL;
    if (!sp.visible) {
      sp.visible = true;
      visibleCount++;
      return sp;
    }
  }
  return null;
}

function spawn(pos, colorHex, opts) {
  const sp = acquire();
  if (!sp) return;
  sp.position.copy(pos);
  sp.material.color.setHex(colorHex);
  sp.material.rotation = 0;
  const u = sp.userData;
  u.life = 1;
  u.decay = 1 / (opts.life || 0.7);
  u.size = (opts.size || 0.9) * (0.7 + Math.random() * 0.6);
  u.gravityScale = opts.gravityScale ?? 1;
  u.drag = opts.drag ?? 1;
  u.stretch = opts.stretch ?? 1;
  const a = Math.random() * Math.PI * 2;
  const v = (opts.speed || 10) * (0.4 + Math.random() * 0.6);
  u.vel.set(Math.cos(a) * v, Math.sin(a) * v, (Math.random() - 0.5) * v * 0.6);
  if (opts.velBias) u.vel.add(opts.velBias);
  return sp;
}

// Generic celebration burst (kept for orbs / fever / one-off flashes).
export function burst(pos, colorHex, { count = 14, speed = 10, size = 0.9, life = 0.7 } = {}) {
  const n = Math.round(count * quality) || 1;
  for (let i = 0; i < n; i++) spawn(pos, colorHex, { speed, size, life });
}

function shockwave(pos, colorHex, { rect = false, grow = 16, life = 0.5, aspect = 1 } = {}) {
  for (const sp of shocks) {
    if (sp.visible || sp.userData.isRect !== rect) continue;
    sp.visible = true;
    sp.position.copy(pos);
    sp.material.color.setHex(colorHex);
    sp.material.opacity = 1;
    const u = sp.userData;
    u.life = 1;
    u.decay = 1 / life;
    u.grow = grow;
    u.aspect = aspect;
    sp.scale.set(1, aspect, 1);
    return;
  }
}

// Ring collect: green sparks; perfect = gold sparks + gold ring shockwave.
export function ringBurst(pos, perfect) {
  if (perfect) {
    burst(pos, 0xffd86a, { count: 20, speed: 13, size: 1.0 });
    burst(pos, 0xfff2c0, { count: 8, speed: 18, size: 0.6, life: 0.5 });
    shockwave(pos, 0xffd86a, { grow: 22, life: 0.55 });
  } else {
    burst(pos, 0x4dffa0, { count: 14, speed: 10 });
  }
}

// Gate thread: cyan crystal sparks + rectangular shockwave shaped like the window.
export function gateThreadBurst(pos) {
  burst(pos, 0x7fe0ff, { count: 16, speed: 12 });
  burst(pos, 0xeaffff, { count: 6, speed: 17, size: 0.6, life: 0.45 });
  shockwave(pos, 0x7fe0ff, { rect: true, grow: 20, life: 0.5, aspect: 0.85 });
}

// Near miss: coral streaks that whip past the camera. Lateral velocity plus
// a strong +z bias; the streaks are elongated along their screen velocity.
const NEAR_BIAS = new THREE.Vector3();
export function nearMissSparks(pos) {
  const n = Math.round(6 * quality) || 1;
  for (let i = 0; i < n; i++) {
    NEAR_BIAS.set(0, 0, 28 + Math.random() * 14);
    spawn(pos, i % 3 ? 0xff7449 : 0xffb13d, {
      speed: 9, size: 0.55, life: 0.45,
      gravityScale: 0, drag: 0, stretch: 3.2,
      velBias: NEAR_BIAS,
    });
  }
}

export function updateParticles(dt, camera) {
  for (const sp of sprites) {
    if (!sp.visible) continue;
    const u = sp.userData;
    u.life -= dt * u.decay;
    if (u.life <= 0) {
      sp.visible = false;
      sp.material.opacity = 0;
      visibleCount--;
      continue;
    }
    sp.position.addScaledVector(u.vel, dt);
    if (u.drag) u.vel.multiplyScalar(Math.max(0, 1 - 2.5 * u.drag * dt));
    u.vel.y -= 4 * u.gravityScale * dt;
    sp.material.opacity = u.life * 0.9;
    const s = u.size * (0.6 + (1 - u.life) * 1.4);
    if (u.stretch > 1 && camera) {
      // Orient the sprite along its screen-space velocity for a streak look
      tmpV.copy(u.vel);
      const sx = tmpV.x;
      const sy = tmpV.y;
      sp.material.rotation = Math.atan2(sy, sx);
      sp.scale.set(s * u.stretch, s * 0.45, 1);
    } else {
      sp.scale.set(s, s, 1);
    }
  }

  for (const sp of shocks) {
    if (!sp.visible) continue;
    const u = sp.userData;
    u.life -= dt * u.decay;
    if (u.life <= 0) {
      sp.visible = false;
      sp.material.opacity = 0;
      continue;
    }
    const k = 1 - u.life;
    const sc = 1 + k * u.grow;
    sp.scale.set(sc, sc * (u.aspect || 1), 1);
    sp.material.opacity = u.life * 0.85;
  }
}

export function resetParticles() {
  for (const sp of sprites) {
    sp.visible = false;
    sp.material.opacity = 0;
  }
  for (const sp of shocks) {
    sp.visible = false;
    sp.material.opacity = 0;
  }
  visibleCount = 0;
}
