import * as THREE from 'three';
import { damp, makeGlowTexture } from './util.js';

let group = null;
let wingPivotL = null;
let wingPivotR = null;
let wingTipL = null;  // secondary fold joint for 2-segment wing
let wingTipR = null;
let head = null;
let tailSegs = [];
const TAIL_COUNT = 9; // more segments = snakier coil

// Rider ponytail
let riderHead = null;
const PONY_SEGS = 10;
const PONY_LEN = 0.24;
let ponyPoints = [];
let ponyMeshes = [];

// Speed trail: two separate pools — cyan (orb/boost) and blue (boost only)
const TRAIL_POOL = 80;
let trailSprites = [];
let boostTrailSprites = [];
let trailTimer = 0;
let boostTrailTimer = 0;

// Ice-burst death particles
const BURST_COUNT = 28;
let burstParticles = [];
let burstActive = false;
let burstTimer = 0;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

// --- Body/wing geometry helpers ---
function buildWingShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.8, 0.5, 2.2, 1.0, 3.0, 0.7);   // leading edge sweep
  shape.lineTo(4.8, 0.2);
  shape.lineTo(5.2, -0.5);
  shape.bezierCurveTo(4.0, -1.0, 2.4, -1.4, 1.2, -1.2); // trailing membrane
  shape.lineTo(0, -0.4);
  return shape;
}

export function createDragon(scene) {
  group = new THREE.Group();

  const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x3d5080, roughness: 0.55, flatShading: true });
  const hornMat  = new THREE.MeshStandardMaterial({ color: 0xd8e8f8, roughness: 0.3, flatShading: true });
  const wingMat  = new THREE.MeshStandardMaterial({
    color: 0x4e6ea8, roughness: 0.65, side: THREE.DoubleSide,
    transparent: true, opacity: 0.93, flatShading: true,
  });
  const riderMat = new THREE.MeshStandardMaterial({ color: 0x1c1f2e, roughness: 0.8 });
  const scalesMat = new THREE.MeshStandardMaterial({ color: 0x5570a0, roughness: 0.4, metalness: 0.15, flatShading: true });

  // Main body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.88, 3.2, 8, 14), bodyMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Scale ridge along back
  for (let i = 0; i < 6; i++) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 5), scalesMat);
    ridge.rotation.x = -Math.PI / 2;
    ridge.position.set(0, 0.82, -1.8 + i * 0.6);
    group.add(ridge);
  }

  // Head
  head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.64, 14, 12), bodyMat);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.44, 1.2, 8), bodyMat);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, -0.06, -0.85);
  head.add(skull, snout);
  // Nostril gems
  for (const s of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), hornMat);
    nostril.position.set(0.14 * s, -0.1, -1.3);
    head.add(nostril);
  }
  // Horns
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.78, 6), hornMat);
    horn.position.set(0.32 * s, 0.42, 0.28);
    horn.rotation.x = 0.65;
    horn.rotation.z = s * -0.2;
    head.add(horn);
  }
  // Brow ridges
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), scalesMat);
    brow.position.set(0.28 * s, 0.44, -0.1);
    brow.rotation.x = 0.9;
    head.add(brow);
  }
  head.position.set(0, 0.38, -2.55);
  group.add(head);

  // Tail: tapering segments with varying cone orientation for snake-like coil
  let radius = 0.58;
  let z = 2.4;
  for (let i = 0; i < TAIL_COUNT; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.2, 7), bodyMat);
    seg.rotation.x = Math.PI / 2;
    seg.position.set(0, 0, z);
    group.add(seg);
    tailSegs.push(seg);
    z += 0.9;
    radius *= 0.76;
  }
  // Spiky tail tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 5), scalesMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0, z);
  group.add(tip);
  tailSegs.push(tip);

  // Wings: 2-segment (root + tip fold) for more organic flap
  const wingGeo = new THREE.ShapeGeometry(buildWingShape());
  wingGeo.rotateX(-Math.PI / 2);

  // Right wing root
  wingPivotR = new THREE.Group();
  wingPivotR.position.set(0.55, 0.4, -0.2);
  const wRRoot = new THREE.Mesh(wingGeo, wingMat);
  // Right tip pivot at the outer edge
  wingTipR = new THREE.Group();
  wingTipR.position.set(3.5, 0, 0);
  const wRTip = new THREE.Mesh(new THREE.ShapeGeometry(buildWingShape()), wingMat);
  wRTip.scale.set(0.42, 0.42, 1);
  wingTipR.add(wRTip);
  wingPivotR.add(wRRoot, wingTipR);
  group.add(wingPivotR);

  // Left wing (mirrored)
  wingPivotL = new THREE.Group();
  wingPivotL.position.set(-0.55, 0.4, -0.2);
  const wLRoot = new THREE.Mesh(wingGeo, wingMat);
  wLRoot.scale.x = -1;
  wingTipL = new THREE.Group();
  wingTipL.position.set(-3.5, 0, 0);
  const wLTip = new THREE.Mesh(new THREE.ShapeGeometry(buildWingShape()), wingMat);
  wLTip.scale.set(-0.42, 0.42, 1);
  wingTipL.add(wLTip);
  wingPivotL.add(wLRoot, wingTipL);
  group.add(wingPivotL);

  // Rider
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.52, 4, 8), riderMat);
  torso.rotation.x = -0.4;
  rider.add(torso);
  riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), riderMat);
  riderHead.position.set(0, 0.52, -0.2);
  rider.add(riderHead);
  // Scarf tail (static decorative)
  const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0xcc3344, roughness: 0.7 }));
  scarf.position.set(0.05, 0.2, 0.3);
  scarf.rotation.x = -0.6;
  rider.add(scarf);
  rider.position.set(0, 1.12, -0.6);
  group.add(rider);

  scene.add(group);

  // Ponytail chain (world-space follow)
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1020, roughness: 0.9 });
  ponyPoints = [];
  ponyMeshes = [];
  for (let i = 0; i < PONY_SEGS; i++) {
    ponyPoints.push(new THREE.Vector3(0, 9, i * PONY_LEN));
    const r = 0.12 * (1 - i / (PONY_SEGS + 2));
    const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r, 0.04), 8, 6), hairMat);
    scene.add(m);
    ponyMeshes.push(m);
  }

  // Speed-trail pools
  const cyanTex = makeGlowTexture('120,220,255');
  const blueTex = makeGlowTexture('80,130,255');

  for (let i = 0; i < TRAIL_POOL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cyanTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.visible = false; s.userData.life = 0;
    scene.add(s);
    trailSprites.push(s);
  }
  for (let i = 0; i < TRAIL_POOL; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: blueTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.visible = false; s.userData.life = 0;
    scene.add(s);
    boostTrailSprites.push(s);
  }

  // Death-burst crystal shards
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0xaaddff, emissive: 0x44aaff, emissiveIntensity: 2.5,
    transparent: true, opacity: 1,
  });
  burstParticles = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + Math.random() * 0.28, 0), shardMat.clone());
    shard.visible = false;
    shard.userData.vel = new THREE.Vector3();
    scene.add(shard);
    burstParticles.push(shard);
  }

  return group;
}

export function triggerDeathBurst(position) {
  burstActive = true;
  burstTimer = 1.0;
  for (const p of burstParticles) {
    p.visible = true;
    p.position.copy(position);
    p.userData.vel.set(
      (Math.random() - 0.5) * 22,
      (Math.random()) * 18 + 4,
      (Math.random() - 0.5) * 18
    );
    p.userData.spin = (Math.random() - 0.5) * 8;
    p.scale.setScalar(1);
    p.material.opacity = 1;
  }
}

export function updateDragon(dt, player, time) {
  // Follow flight position with hover bob
  group.position.set(
    player.position.x,
    player.position.y + Math.sin(time * 2.1) * 0.16,
    player.position.z
  );

  // Banking and pitch
  group.rotation.z = damp(group.rotation.z, -player.velocity.x * 0.035, 9, dt);
  group.rotation.x = damp(group.rotation.x, player.velocity.y * 0.022, 9, dt);
  // Slight yaw toward lateral movement
  group.rotation.y = damp(group.rotation.y, player.velocity.x * 0.008, 6, dt);
  head.rotation.y = damp(head.rotation.y, -player.velocity.x * 0.014, 8, dt);
  head.rotation.x = damp(head.rotation.x, -player.velocity.y * 0.008, 8, dt);

  // Wing flap: 2-segment articulation
  const feverBoost = player.feverActive ? 1.3 : 1;
  const flapSpeed = player.speedActive ? 11 * feverBoost : 6 * feverBoost;
  const flapAmp   = player.speedActive ? 0.65 : 0.50;
  const flap = Math.sin(time * flapSpeed) * flapAmp + 0.1;
  const flapPhase = Math.sin(time * flapSpeed + 0.8); // tip lags behind root
  wingPivotR.rotation.z = -flap;
  wingPivotL.rotation.z =  flap;
  // Tip fold: folds on up-stroke, extends on down-stroke
  wingTipR.rotation.z = damp(wingTipR.rotation.z, flapPhase * 0.35, 12, dt);
  wingTipL.rotation.z = damp(wingTipL.rotation.z, -flapPhase * 0.35, 12, dt);

  // Snake-like tail wave: each segment lags behind the previous
  for (let i = 0; i < tailSegs.length; i++) {
    const phase = time * 3.8 - i * 0.55;
    const amp = 0.09 * (i + 1) * (i < TAIL_COUNT ? 1 : 0.6);
    const waveX = Math.sin(phase) * amp;
    const waveY = Math.cos(phase * 0.7) * amp * 0.4;
    tailSegs[i].position.x = waveX;
    tailSegs[i].position.y = waveY;
    // Rotation follows the wave direction for organic feel
    tailSegs[i].rotation.z = damp(tailSegs[i].rotation.z, -waveX * 0.6, 14, dt);
    tailSegs[i].rotation.y = damp(tailSegs[i].rotation.y, waveX * 0.4, 14, dt);
  }

  group.updateMatrixWorld(true);

  // Ponytail: hair chain
  riderHead.getWorldPosition(tmpV);
  tmpV.y += 0.1;
  tmpV.z += 0.14;
  ponyPoints[0].copy(tmpV);
  for (let i = 1; i < PONY_SEGS; i++) {
    const dir = tmpV2.copy(ponyPoints[i]).sub(ponyPoints[i - 1]);
    dir.y -= 2.4 * dt;
    dir.z += (player.speed / 35) * 2.8 * dt;
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.setLength(PONY_LEN);
    ponyPoints[i].copy(ponyPoints[i - 1]).add(dir);
    ponyMeshes[i].position.copy(ponyPoints[i]);
  }
  ponyMeshes[0].position.copy(ponyPoints[0]);

  // Cyan speed trail (orb/fast)
  trailTimer -= dt;
  if (player.speedActive && trailTimer <= 0) {
    trailTimer = 0.015;
    const s = trailSprites.find(s => !s.visible);
    if (s) {
      s.visible = true;
      s.userData.life = 1;
      s.position.set(
        group.position.x + (Math.random() - 0.5) * 1.6,
        group.position.y + (Math.random() - 0.5) * 1.2,
        group.position.z + 3 + Math.random() * 2.5
      );
    }
  }
  for (const s of trailSprites) {
    if (!s.visible) continue;
    s.userData.life -= dt * 2.5;
    if (s.userData.life <= 0) { s.visible = false; s.material.opacity = 0; }
    else {
      s.material.opacity = s.userData.life * 0.65;
      const sz = 0.8 + (1 - s.userData.life) * 2.2;
      s.scale.set(sz, sz, 1);
    }
  }

  // Blue boost trail (only while boosting)
  boostTrailTimer -= dt;
  if (player.boosting && boostTrailTimer <= 0) {
    boostTrailTimer = 0.022;
    const s = boostTrailSprites.find(s => !s.visible);
    if (s) {
      s.visible = true;
      s.userData.life = 1;
      s.position.set(
        group.position.x + (Math.random() - 0.5) * 0.8,
        group.position.y + (Math.random() - 0.5) * 0.8,
        group.position.z + 2 + Math.random() * 4
      );
    }
  }
  for (const s of boostTrailSprites) {
    if (!s.visible) continue;
    s.userData.life -= dt * 2.0;
    if (s.userData.life <= 0) { s.visible = false; s.material.opacity = 0; }
    else {
      s.material.opacity = s.userData.life * 0.8;
      const sz = 1.2 + (1 - s.userData.life) * 3.5;
      s.scale.set(sz, sz, 1);
    }
  }

  // Death burst update
  if (burstActive) {
    burstTimer -= dt;
    const alive = burstTimer > 0;
    for (const p of burstParticles) {
      if (!p.visible) continue;
      p.position.x += p.userData.vel.x * dt;
      p.position.y += p.userData.vel.y * dt;
      p.position.z += p.userData.vel.z * dt;
      p.userData.vel.y -= 18 * dt; // gravity
      p.rotation.x += p.userData.spin * dt;
      p.rotation.z += p.userData.spin * 0.7 * dt;
      const life = Math.max(burstTimer, 0);
      p.material.opacity = life;
      p.scale.setScalar(life * 1.5 + 0.1);
      if (!alive) p.visible = false;
    }
    if (!alive) burstActive = false;
  }
}

export function resetDragon(player) {
  group.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  for (const p of ponyPoints) p.set(player.position.x, player.position.y + 1.5, player.position.z);
  for (const s of trailSprites) { s.visible = false; s.userData.life = 0; }
  for (const s of boostTrailSprites) { s.visible = false; s.userData.life = 0; }
  for (const p of burstParticles) { p.visible = false; }
  burstActive = false;
}
