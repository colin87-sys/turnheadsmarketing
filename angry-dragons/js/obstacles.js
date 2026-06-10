import * as THREE from 'three';
import { CONFIG } from './config.js';

// Ice obstacles, spawned ahead and culled behind the dragon:
//   pillar — floor spike (health damage)
//   shard  — floating octahedron, optionally oscillating ("dynamic") (damage)
//   bar    — horizontal beam spanning the lane (damage)
//   gate   — crystal wall with a hole on the flight path (FATAL on contact)
// Each entry doubles as its own collider; `colliders` is consumed by collision.js.
let scene = null;
let mats = null;
const entries = [];
export const colliders = entries; // same objects, same array

export function initObstacles(s) {
  scene = s;
  mats = {
    ice: new THREE.MeshStandardMaterial({
      color: 0x7cc4ee,
      flatShading: true,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0x10324d,
      emissiveIntensity: 0.4,
    }),
    mover: new THREE.MeshStandardMaterial({
      color: 0x9adcff,
      flatShading: true,
      roughness: 0.25,
      emissive: 0x2a6a99,
      emissiveIntensity: 0.7,
    }),
    gate: new THREE.MeshStandardMaterial({
      color: 0x8fd4f5,
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
      emissive: 0x1c4a66,
      emissiveIntensity: 0.5,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: 0x55e0ff,
      emissive: 0x2299cc,
      emissiveIntensity: 1.2,
    }),
  };
}

export function addObstacle(o) {
  const e = { ...o, object: null };
  if (o.type === 'pillar') {
    e.object = new THREE.Mesh(new THREE.ConeGeometry(o.r, o.h, 6), mats.ice);
    e.object.position.set(o.x, o.h / 2, -o.dist);
  } else if (o.type === 'shard') {
    e.object = new THREE.Mesh(new THREE.OctahedronGeometry(o.r), o.dynamic ? mats.mover : mats.ice);
    e.object.position.set(o.x, o.y, -o.dist);
  } else if (o.type === 'bar') {
    e.object = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, 30, 8), mats.ice);
    e.object.rotation.z = Math.PI / 2;
    e.object.position.set(0, o.y, -o.dist);
  } else if (o.type === 'gate') {
    e.object = buildGate(o);
  }
  scene.add(e.object);
  entries.push(e);
}

// A translucent crystal wall spanning the lane with a rectangular opening.
// The hole is outlined with a RECTANGULAR glow frame — deliberately not a
// circle, so it can't be mistaken for a score ring. The wall itself is fatal.
function buildGate(o) {
  const group = new THREE.Group();
  const T = 1.6; // wall thickness
  const X = 16; // wall half-span
  const TOP = 24;
  const left = o.gapX - o.gapW;
  const right = o.gapX + o.gapW;
  const bottom = o.gapY - o.gapH;
  const top = o.gapY + o.gapH;

  const panel = (w, h, cx, cy) => {
    if (w <= 0.1 || h <= 0.1) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, T), mats.gate);
    mesh.position.set(cx, cy, 0);
    group.add(mesh);
  };
  panel(left + X, TOP, (left - X) / 2, TOP / 2); // left of gap
  panel(X - right, TOP, (right + X) / 2, TOP / 2); // right of gap
  panel(right - left, TOP - top, o.gapX, (top + TOP) / 2); // above gap
  panel(right - left, bottom, o.gapX, bottom / 2); // below gap

  const edge = (w, h, cx, cy) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.35), mats.frame);
    mesh.position.set(cx, cy, 0);
    group.add(mesh);
  };
  const W = o.gapW * 2;
  const H = o.gapH * 2;
  edge(W + 0.6, 0.28, o.gapX, top + 0.14); // top edge
  edge(W + 0.6, 0.28, o.gapX, bottom - 0.14); // bottom edge
  edge(0.28, H + 0.6, left - 0.14, o.gapY); // left edge
  edge(0.28, H + 0.6, right + 0.14, o.gapY); // right edge

  group.position.z = -o.dist;
  return group;
}

export function updateObstacles(dt, time, playerDist) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.dist < playerDist - CONFIG.cullBehind) {
      removeAt(i);
      continue;
    }
    if (e.type === 'shard') {
      e.object.rotation.y += dt * 0.8;
      e.object.rotation.x += dt * 0.3;
      if (e.dynamic) {
        // Oscillates; the collider position (e.x) moves with the mesh.
        e.x = e.baseX + Math.sin(time * e.speed + e.phase) * e.amp;
        e.object.position.x = e.x;
        e.object.position.y = e.baseY;
      } else {
        e.object.position.y = e.y + Math.sin(time * 1.4 + e.dist) * 0.4;
      }
    } else if (e.type === 'bar') {
      e.object.rotation.x += dt * 0.5; // spin around its long axis
    }
  }
}

function removeAt(i) {
  const e = entries[i];
  scene.remove(e.object);
  e.object.traverse((m) => {
    if (m.geometry) m.geometry.dispose(); // materials are shared
  });
  entries.splice(i, 1);
}

export function obstacleCount() {
  return entries.length;
}

export function resetObstacles() {
  while (entries.length) removeAt(entries.length - 1);
}
