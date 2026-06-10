import * as THREE from 'three';
import { damp, makeGlowTexture } from './util.js';

// Dragon model (body, wings, head, tail), rider silhouette with a flowing
// ponytail, and the high-speed glow trail. All built from placeholder primitives.
let group = null;
let wingPivotL = null;
let wingPivotR = null;
let head = null;
let tailSegs = [];

// Ponytail: world-space follow chain anchored to the rider's head.
let riderHead = null;
const PONY_SEGS = 8;
const PONY_LEN = 0.26;
let ponyPoints = [];
let ponyMeshes = [];

// Speed trail particle pool.
const TRAIL_POOL = 60;
let trailSprites = [];
let trailTimer = 0;
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

export function createDragon(scene) {
  group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44588a, roughness: 0.6, flatShading: true });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd8e6f2, roughness: 0.4, flatShading: true });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x5a7ab0,
    roughness: 0.7,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
    flatShading: true,
  });
  const riderMat = new THREE.MeshStandardMaterial({ color: 0x1c1f2e, roughness: 0.8 });

  // Body lies along z (head toward -z, the flight direction).
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 3, 6, 12), bodyMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Head with snout and horns.
  head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), bodyMat);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), bodyMat);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, -0.05, -0.8);
  head.add(skull, snout);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), hornMat);
    horn.position.set(0.3 * s, 0.4, 0.3);
    horn.rotation.x = 0.7;
    head.add(horn);
  }
  head.position.set(0, 0.35, -2.5);
  group.add(head);

  // Tapering tail segments (animated with a wave in update).
  let radius = 0.55;
  let z = 2.3;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.4, 8), bodyMat);
    seg.rotation.x = Math.PI / 2; // point backward (+z)
    seg.position.set(0, 0, z);
    group.add(seg);
    tailSegs.push(seg);
    z += 1.0;
    radius *= 0.72;
  }

  // Wings: flat membrane shapes on pivots so they can flap.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2.2, 0.8);
  shape.lineTo(4.4, 0.3);
  shape.lineTo(3.5, -1.1);
  shape.lineTo(1.3, -1.3);
  shape.lineTo(0, -0.4);
  const wingGeo = new THREE.ShapeGeometry(shape);
  wingGeo.rotateX(-Math.PI / 2); // lay flat: shape-y becomes world -z (chord)

  wingPivotR = new THREE.Group();
  wingPivotR.position.set(0.5, 0.35, -0.3);
  wingPivotR.add(new THREE.Mesh(wingGeo, wingMat));
  group.add(wingPivotR);

  wingPivotL = new THREE.Group();
  wingPivotL.position.set(-0.5, 0.35, -0.3);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.scale.x = -1;
  wingPivotL.add(wingL);
  group.add(wingPivotL);

  // Rider silhouette leaning forward on the dragon's back.
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), riderMat);
  torso.rotation.x = -0.4;
  rider.add(torso);
  riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), riderMat);
  riderHead.position.set(0, 0.5, -0.18);
  rider.add(riderHead);
  rider.position.set(0, 1.1, -0.7);
  group.add(rider);

  scene.add(group);

  // Ponytail chain lives in world space so it can trail freely.
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x241a2e, roughness: 0.9 });
  ponyPoints = [];
  ponyMeshes = [];
  for (let i = 0; i < PONY_SEGS; i++) {
    ponyPoints.push(new THREE.Vector3(0, 9, i * PONY_LEN));
    const r = 0.13 * (1 - i / (PONY_SEGS + 2));
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r, 0.045), 8, 6), hairMat);
    scene.add(mesh);
    ponyMeshes.push(mesh);
  }

  // Speed-trail sprite pool (additive cyan glow puffs).
  const trailTex = makeGlowTexture('130,220,255');
  for (let i = 0; i < TRAIL_POOL; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: trailTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sprite.visible = false;
    sprite.userData.life = 0;
    scene.add(sprite);
    trailSprites.push(sprite);
  }

  return group;
}

export function updateDragon(dt, player, time) {
  // Follow the flight position with a subtle hover bob.
  group.position.set(
    player.position.x,
    player.position.y + Math.sin(time * 2.2) * 0.15,
    player.position.z
  );

  // Banking and pitching with movement (forward is -z, so +x roll banks turns).
  group.rotation.z = damp(group.rotation.z, -player.velocity.x * 0.035, 8, dt);
  group.rotation.x = damp(group.rotation.x, player.velocity.y * 0.022, 8, dt);
  head.rotation.y = damp(head.rotation.y, -player.velocity.x * 0.012, 8, dt);

  // Wing flap, faster while moving fast.
  const flapSpeed = player.speedActive ? 10 : 5.5;
  const flap = Math.sin(time * flapSpeed) * 0.55 + 0.12;
  wingPivotR.rotation.z = -flap;
  wingPivotL.rotation.z = flap;

  // Tail wave.
  for (let i = 0; i < tailSegs.length; i++) {
    tailSegs[i].position.x = Math.sin(time * 3.2 - i * 0.9) * 0.07 * (i + 1);
  }

  group.updateMatrixWorld(true);

  // Ponytail: each segment chases the previous one, keeping its length while
  // drifting backward/down — flows and trails with movement for free.
  riderHead.getWorldPosition(tmpV);
  tmpV.y += 0.1;
  tmpV.z += 0.12;
  ponyPoints[0].copy(tmpV);
  for (let i = 1; i < PONY_SEGS; i++) {
    const dir = tmpV2.copy(ponyPoints[i]).sub(ponyPoints[i - 1]);
    dir.y -= 2.2 * dt; // droop
    dir.z += (player.speed / 35) * 2.5 * dt; // wind pushes the tail backward
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.setLength(PONY_LEN);
    ponyPoints[i].copy(ponyPoints[i - 1]).add(dir);
    ponyMeshes[i].position.copy(ponyPoints[i]);
  }
  ponyMeshes[0].position.copy(ponyPoints[0]);

  // Speed trail: emit glow puffs behind the tail while boost/orb speed is active.
  trailTimer -= dt;
  if (player.speedActive && trailTimer <= 0) {
    trailTimer = 0.018;
    const sprite = trailSprites.find((s) => !s.visible);
    if (sprite) {
      sprite.visible = true;
      sprite.userData.life = 1;
      sprite.position.set(
        group.position.x + (Math.random() - 0.5) * 1.4,
        group.position.y + (Math.random() - 0.5) * 1.2,
        group.position.z + 3 + Math.random() * 2
      );
    }
  }
  for (const sprite of trailSprites) {
    if (!sprite.visible) continue;
    sprite.userData.life -= dt * 2.4;
    if (sprite.userData.life <= 0) {
      sprite.visible = false;
      sprite.material.opacity = 0;
    } else {
      sprite.material.opacity = sprite.userData.life * 0.7;
      const s = 0.9 + (1 - sprite.userData.life) * 2;
      sprite.scale.set(s, s, 1);
    }
  }
}

export function resetDragon(player) {
  group.rotation.set(0, 0, 0);
  for (const p of ponyPoints) p.set(player.position.x, player.position.y + 1.5, player.position.z);
  for (const s of trailSprites) {
    s.visible = false;
    s.userData.life = 0;
  }
}
