import * as THREE from 'three';

// Deterministic PRNG so the course layout is stable between runs.
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Framerate-independent exponential smoothing.
export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Combo intensity tier (drives HUD styling and tier-up jingles).
export function comboTier(c) {
  return c >= 5 ? 4 : c >= 3.5 ? 3 : c >= 2.5 ? 2 : c >= 1.5 ? 1 : 0;
}

// Soft radial glow sprite texture, generated at runtime (no asset files).
export function makeGlowTexture(rgb = '160,220,255') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, `rgba(${rgb},0.8)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Circle-outline shockwave texture (white; tint via material color).
export function makeRingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 10;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

// Rectangle-outline shockwave texture (matches the gate window shape).
export function makeRectTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.shadowColor = 'rgba(255,255,255,0.9)';
  g.shadowBlur = 10;
  g.lineWidth = 7;
  g.strokeRect(20, 26, 88, 76);
  return new THREE.CanvasTexture(c);
}
