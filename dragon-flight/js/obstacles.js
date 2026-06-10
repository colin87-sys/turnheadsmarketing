import * as THREE from 'three';
import { CONFIG } from './config.js';

// Ice obstacles: floor pillars, floating shards and crystal gates with openings.
// Visual meshes are built here; `colliders` is consumed by collision.js.
export const colliders = [];
const shards = []; // animated (rotate + bob)

export function createObstacles(scene, layout) {
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x7cc4ee,
    flatShading: true,
    roughness: 0.3,
    metalness: 0.1,
    emissive: 0x10324d,
    emissiveIntensity: 0.4,
  });
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0x8fd4f5,
    transparent: true,
    opacity: 0.55,
    roughness: 0.2,
    emissive: 0x1c4a66,
    emissiveIntensity: 0.5,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x55e0ff,
    emissive: 0x2299cc,
    emissiveIntensity: 1.2,
  });

  for (const o of layout.obstacles) {
    if (o.type === 'pillar') {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(o.r, o.h, 6), iceMat);
      mesh.position.set(o.x, o.h / 2, -o.dist);
      scene.add(mesh);
      colliders.push({ type: 'pillar', x: o.x, dist: o.dist, r: o.r, h: o.h });
    } else if (o.type === 'shard') {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(o.r), iceMat);
      mesh.position.set(o.x, o.y, -o.dist);
      scene.add(mesh);
      shards.push({ mesh, baseY: o.y, phase: o.dist });
      colliders.push({ type: 'shard', x: o.x, y: o.y, dist: o.dist, r: o.r });
    } else if (o.type === 'gate') {
      buildGate(scene, o, gateMat, frameMat);
      colliders.push({
        type: 'gate',
        dist: o.dist,
        gapX: o.gapX,
        gapY: o.gapY,
        gapW: o.gapW,
        gapH: o.gapH,
        thick: 1.2,
      });
    }
  }
}

// A translucent crystal wall spanning the lane with a rectangular opening,
// outlined by a glowing ring so the player can read it from a distance.
function buildGate(scene, o, gateMat, frameMat) {
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
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, T), gateMat);
    mesh.position.set(cx, cy, 0);
    group.add(mesh);
  };
  panel(left + X, TOP, (left - X) / 2, TOP / 2); // left of gap
  panel(X - right, TOP, (right + X) / 2, TOP / 2); // right of gap
  panel(right - left, TOP - top, o.gapX, (top + TOP) / 2); // above gap
  panel(right - left, bottom, o.gapX, bottom / 2); // below gap

  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(o.gapW, o.gapH) * 1.05, 0.18, 8, 28),
    frameMat
  );
  frame.position.set(o.gapX, o.gapY, 0);
  group.add(frame);

  group.position.z = -o.dist;
  scene.add(group);
}

export function updateObstacles(dt, time) {
  for (const s of shards) {
    s.mesh.rotation.y += dt * 0.8;
    s.mesh.rotation.x += dt * 0.3;
    s.mesh.position.y = s.baseY + Math.sin(time * 1.4 + s.phase) * 0.4;
  }
}
