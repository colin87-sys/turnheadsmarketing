import * as THREE from 'three';
import { damp, makeGlowTexture, comboTier } from './util.js';
import { game } from './gameState.js';

let group = null;
let wingPivotL = null;
let wingPivotR = null;
let wingTipL = null;  // secondary fold joint for 2-segment wing
let wingTipR = null;
let head = null;
let neckSegs = [];    // S-curved neck chain (subtle sway at runtime)
let rider = null;     // rider group leans into turns
let tailSegs = [];
const TAIL_COUNT = 9; // more segments = snakier coil

// Materials animated at runtime (boost glow / fever tint)
let bodyMat = null;
let wingMat = null;
let wingEdgeMat = null; // glowing leading-edge wing bone (ramps with boost)
let eyeMat = null;
// Wing-tip contrail markers + fever aura + boost halo ("fake bloom")
let tipMarkerL = null;
let tipMarkerR = null;
let auraSprite = null;
let boostGlowSprite = null;
let quality = 1;

export function setDragonQuality(q) {
  quality = q;
}

// Rider ponytail
let riderHead = null;
const PONY_SEGS = 10;
const PONY_LEN = 0.24;
let ponyPoints = [];
let ponyMeshes = [];

// Rider scarf: second simulated chain, warm-coloured, whips harder at speed
const SCARF_SEGS = 9;
const SCARF_LEN = 0.22;
let scarfPoints = [];
let scarfMeshes = [];

// Speed trail: two separate pools — cyan (orb/boost) and blue (boost only)
const TRAIL_POOL = 140;
let trailSprites = [];
let boostTrailSprites = [];
let trailTimer = 0;
let boostTrailTimer = 0;
let contrailTimer = 0;

// Ice-burst death particles
const BURST_COUNT = 60;
let burstParticles = [];
let burstActive = false;
let burstTimer = 0;

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

// --- Body/wing geometry helpers ---
const WING_SCALE = 1.3; // bigger wings: hero silhouette, not a capsule with fins
function buildWingShape() {
  const s = WING_SCALE;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.8 * s, 0.5 * s, 2.2 * s, 1.0 * s, 3.0 * s, 0.7 * s); // leading edge sweep
  shape.lineTo(4.8 * s, 0.2 * s);
  shape.lineTo(5.2 * s, -0.5 * s);
  shape.bezierCurveTo(4.0 * s, -1.0 * s, 2.4 * s, -1.4 * s, 1.2 * s, -1.2 * s); // trailing membrane
  shape.lineTo(0, -0.4 * s);
  return shape;
}

// Bone "fingers" fanning across the membrane. The first finger doubles as
// the glowing leading edge (wingEdgeMat ramps up while boosting).
function buildWingBones(sign) {
  const g = new THREE.Group();
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0x2e3c5e, roughness: 0.6, flatShading: true,
  });
  const fingers = [
    { ang: 0.14, len: 6.0, r: 0.07, mat: wingEdgeMat },
    { ang: -0.1, len: 5.4, r: 0.05, mat: boneMat },
    { ang: -0.34, len: 4.3, r: 0.05, mat: boneMat },
  ];
  for (const f of fingers) {
    const holder = new THREE.Group();
    holder.rotation.y = sign > 0 ? f.ang : -f.ang;
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(f.r * 0.7, f.r, f.len, 5), f.mat);
    bone.rotation.z = sign * -Math.PI / 2;
    bone.position.x = sign * f.len / 2;
    holder.add(bone);
    g.add(holder);
  }
  return g;
}

export function createDragon(scene) {
  group = new THREE.Group();

  bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3d5080, roughness: 0.55, flatShading: true,
    emissive: 0xff44cc, emissiveIntensity: 0,
  });
  const hornMat  = new THREE.MeshStandardMaterial({ color: 0xd8e8f8, roughness: 0.3, flatShading: true });
  wingMat = new THREE.MeshStandardMaterial({
    color: 0x4e6ea8, roughness: 0.65, side: THREE.DoubleSide,
    transparent: true, opacity: 0.93, flatShading: true,
    emissive: 0x55ccff, emissiveIntensity: 0,
  });
  const scalesMat = new THREE.MeshStandardMaterial({ color: 0x5570a0, roughness: 0.4, metalness: 0.15, flatShading: true });
  // Rider reads warm against the cool blue/violet dragon: red/gold/amber kit
  const riderDark = new THREE.MeshStandardMaterial({ color: 0x2a1c20, roughness: 0.85 });
  const riderRed  = new THREE.MeshStandardMaterial({ color: 0xb33636, roughness: 0.7 });
  const riderGold = new THREE.MeshStandardMaterial({ color: 0xd9a13b, roughness: 0.45, metalness: 0.35 });
  const scarfMat  = new THREE.MeshStandardMaterial({ color: 0xd8452e, roughness: 0.7 });
  wingEdgeMat = new THREE.MeshStandardMaterial({
    color: 0x7fd4ff, emissive: 0x55ccff, emissiveIntensity: 0.4, flatShading: true,
  });

  // Serpentine body: big chest, narrow waist, tapered hips — one S-mass
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1.12, 12, 10), bodyMat);
  chest.scale.set(1, 1.04, 1.35);
  chest.position.set(0, 0.05, -0.75);
  const waist = new THREE.Mesh(new THREE.SphereGeometry(0.82, 11, 9), bodyMat);
  waist.scale.set(0.92, 0.9, 1.5);
  waist.position.set(0, -0.04, 0.55);
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 9), bodyMat);
  hips.scale.set(0.85, 0.82, 1.5);
  hips.position.set(0, -0.02, 1.7);
  group.add(chest, waist, hips);
  // Lighter belly plates under the chest
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), scalesMat);
  belly.scale.set(0.78, 0.7, 1.25);
  belly.position.set(0, -0.42, -0.7);
  group.add(belly);

  // Long S-curved neck rising from the chest to the head
  neckSegs = [];
  const NECK = [
    { r: 0.52, p: [0, 0.42, -1.75] },
    { r: 0.46, p: [0, 0.72, -2.3] },
    { r: 0.4,  p: [0, 0.95, -2.85] },
    { r: 0.36, p: [0, 1.06, -3.35] },
  ];
  for (const n of NECK) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(n.r, 9, 8), bodyMat);
    seg.scale.set(0.9, 1, 1.25);
    seg.position.set(...n.p);
    seg.userData.baseY = n.p[1];
    group.add(seg);
    neckSegs.push(seg);
  }

  // Spine spikes: large over the shoulders, tapering down the back
  const SPIKES = [
    { z: -2.55, y: 1.28, s: 0.5 },
    { z: -2.0,  y: 1.08, s: 0.62 },
    { z: -1.4,  y: 0.88, s: 0.78 },
    { z: -0.75, y: 1.1,  s: 1.0 },
    { z: -0.05, y: 0.98, s: 0.92 },
    { z: 0.6,   y: 0.78, s: 0.8 },
    { z: 1.3,   y: 0.6,  s: 0.65 },
    { z: 1.95,  y: 0.48, s: 0.5 },
  ];
  for (const sp of SPIKES) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15 * sp.s, 0.9 * sp.s, 5), scalesMat);
    spike.rotation.x = 0.5; // raked back toward the tail
    spike.position.set(0, sp.y, sp.z);
    group.add(spike);
  }

  // Head: bigger skull, long tapered snout with a separate lower jaw
  head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.66, 14, 12), bodyMat);
  skull.scale.set(0.95, 0.85, 1.15);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 8), bodyMat);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, -0.04, -1.05);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.0, 6), bodyMat);
  jaw.rotation.x = -Math.PI / 2 - 0.18;
  jaw.position.set(0, -0.3, -0.85);
  head.add(skull, snout, jaw);
  // Nostril gems
  for (const s of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), hornMat);
    nostril.position.set(0.14 * s, -0.06, -1.6);
    head.add(nostril);
  }
  // Horns: big back-swept main pair, smaller secondary pair, cheek frills
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.25, 6), hornMat);
    horn.position.set(0.3 * s, 0.5, 0.45);
    horn.rotation.x = 1.05;
    horn.rotation.z = s * -0.22;
    head.add(horn);
    const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 5), hornMat);
    horn2.position.set(0.48 * s, 0.28, 0.5);
    horn2.rotation.x = 1.2;
    horn2.rotation.z = s * -0.45;
    head.add(horn2);
    const frill = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), scalesMat);
    frill.position.set(0.55 * s, 0, 0.2);
    frill.rotation.z = s * -1.25;
    frill.rotation.x = 0.5;
    head.add(frill);
  }
  // Brow ridges
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 5), scalesMat);
    brow.position.set(0.3 * s, 0.4, -0.35);
    brow.rotation.x = 0.9;
    head.add(brow);
  }
  // Glowing eyes (cyan; shift magenta during Dragon Surge)
  eyeMat = new THREE.MeshStandardMaterial({
    color: 0x223344, emissive: 0x55e0ff, emissiveIntensity: 2.2,
  });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), eyeMat);
    eye.position.set(0.3 * s, 0.18, -0.55);
    head.add(eye);
  }
  head.position.set(0, 1.12, -3.8);
  group.add(head);

  // Tail: tapering segments with varying cone orientation for snake-like coil
  let radius = 0.52;
  let z = 2.5;
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
  wingPivotR.position.set(0.6, 0.55, -0.75);
  const wRRoot = new THREE.Mesh(wingGeo, wingMat);
  // Right tip pivot at the outer edge
  wingTipR = new THREE.Group();
  wingTipR.position.set(3.5 * WING_SCALE, 0, 0);
  const wRTip = new THREE.Mesh(new THREE.ShapeGeometry(buildWingShape()), wingMat);
  wRTip.scale.set(0.42, 0.42, 1);
  wingTipR.add(wRTip);
  tipMarkerR = new THREE.Object3D();
  tipMarkerR.position.set(2.0 * WING_SCALE, 0, -0.2); // true wing tip for contrails
  wingTipR.add(tipMarkerR);
  wingPivotR.add(wRRoot, wingTipR, buildWingBones(1));
  group.add(wingPivotR);

  // Left wing (mirrored)
  wingPivotL = new THREE.Group();
  wingPivotL.position.set(-0.6, 0.55, -0.75);
  const wLRoot = new THREE.Mesh(wingGeo, wingMat);
  wLRoot.scale.x = -1;
  wingTipL = new THREE.Group();
  wingTipL.position.set(-3.5 * WING_SCALE, 0, 0);
  const wLTip = new THREE.Mesh(new THREE.ShapeGeometry(buildWingShape()), wingMat);
  wLTip.scale.set(-0.42, 0.42, 1);
  wingTipL.add(wLTip);
  tipMarkerL = new THREE.Object3D();
  tipMarkerL.position.set(-2.0 * WING_SCALE, 0, -0.2);
  wingTipL.add(tipMarkerL);
  wingPivotL.add(wLRoot, wingTipL, buildWingBones(-1));
  group.add(wingPivotL);

  // Rider: warm red/gold kit on a dark saddle, leaning into the wind
  rider = new THREE.Group();
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.95), riderDark);
  saddle.position.set(0, -0.28, 0.05);
  const saddleTrim = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 1.0), riderGold);
  saddleTrim.position.set(0, -0.36, 0.05);
  rider.add(saddle, saddleTrim);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.4, 4, 6), riderDark);
    leg.position.set(0.3 * s, -0.32, 0.08);
    leg.rotation.z = s * 0.5;
    rider.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 8), riderRed);
  torso.rotation.x = -0.35;
  rider.add(torso);
  const chestStrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.3), riderGold);
  chestStrap.position.set(0, 0.12, -0.16);
  chestStrap.rotation.x = -0.35;
  rider.add(chestStrap);
  // Arms reaching forward to the reins
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 4, 6), riderRed);
    arm.position.set(0.2 * s, 0.28, -0.3);
    arm.rotation.x = -1.25;
    arm.rotation.z = s * 0.25;
    rider.add(arm);
  }
  riderHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), riderDark);
  riderHead.position.set(0, 0.55, -0.22);
  rider.add(riderHead);
  // Gold helmet cap
  const helm = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    riderGold
  );
  helm.position.set(0, 0.57, -0.22);
  rider.add(helm);
  // Scarf collar at the neck (the trailing scarf is a simulated chain)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 10), scarfMat);
  collar.position.set(0, 0.42, -0.18);
  collar.rotation.x = Math.PI / 2 - 0.3;
  rider.add(collar);
  rider.position.set(0, 1.42, -0.45);
  group.add(rider);

  // Gold girth straps wrapping the dragon's chest under the saddle
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.32), riderGold);
    strap.position.set(0.78 * s, 0.55, -0.6);
    strap.rotation.z = s * 0.5;
    group.add(strap);
  }

  // Fever aura: pulsing magenta glow enveloping the dragon during surge
  auraSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('255,130,235'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  auraSprite.scale.set(10, 10, 1);
  group.add(auraSprite);

  // Boost halo: large additive glow behind the dragon — cheap fake bloom
  boostGlowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('120,200,255'), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  boostGlowSprite.scale.set(7, 7, 1);
  boostGlowSprite.position.set(0, 0, 1.5);
  group.add(boostGlowSprite);

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

  // Scarf chain (world-space follow, warm red, whips harder than the hair)
  scarfPoints = [];
  scarfMeshes = [];
  for (let i = 0; i < SCARF_SEGS; i++) {
    scarfPoints.push(new THREE.Vector3(0, 9, i * SCARF_LEN));
    const r = 0.11 * (1 - i / (SCARF_SEGS + 3));
    const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r, 0.045), 8, 6), scarfMat);
    scene.add(m);
    scarfMeshes.push(m);
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

// Lethal crashes (wall/gate) explode hot coral-red; health deaths stay icy.
export function triggerDeathBurst(position, lethal = false) {
  burstActive = true;
  burstTimer = 1.0;
  const spread = lethal ? 30 : 22;
  for (const p of burstParticles) {
    p.visible = true;
    p.position.copy(position);
    if (lethal) {
      p.material.color.setHex(0xffb09a);
      p.material.emissive.setHex(0xff3322);
    } else {
      p.material.color.setHex(0xaaddff);
      p.material.emissive.setHex(0x44aaff);
    }
    p.userData.vel.set(
      (Math.random() - 0.5) * spread,
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

  // Banking and pitch — banking deepens with speed for drama
  const speedNorm = Math.min(Math.max((player.speed - 35) / 45, 0), 1);
  const bankFactor = 0.035 + speedNorm * 0.015;
  group.rotation.z = damp(group.rotation.z, -player.velocity.x * bankFactor, 9, dt);
  group.rotation.x = damp(group.rotation.x, player.velocity.y * 0.022, 9, dt);
  // Slight yaw toward lateral movement
  group.rotation.y = damp(group.rotation.y, player.velocity.x * 0.008, 6, dt);
  head.rotation.y = damp(head.rotation.y, -player.velocity.x * 0.014, 8, dt);
  head.rotation.x = damp(head.rotation.x, -player.velocity.y * 0.008, 8, dt);

  // Subtle serpentine neck sway, following the steering
  for (let i = 0; i < neckSegs.length; i++) {
    const seg = neckSegs[i];
    const k = (i + 1) / neckSegs.length;
    seg.position.y = seg.userData.baseY + Math.sin(time * 2.3 + i * 0.7) * 0.05 * k;
    seg.position.x = damp(seg.position.x, -player.velocity.x * 0.012 * k, 8, dt);
  }

  // Rider leans into turns and crouches forward at speed
  rider.rotation.z = damp(rider.rotation.z, -player.velocity.x * 0.028, 8, dt);
  rider.rotation.x = damp(rider.rotation.x, -speedNorm * 0.22 + player.velocity.y * 0.012, 6, dt);

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

  // Boost wing glow + fever tint + eyes + aura (cheap material writes)
  const tier = comboTier(game.combo);
  const wingGlowTarget = player.boosting ? 0.9 : 0;
  wingMat.emissiveIntensity = damp(wingMat.emissiveIntensity, wingGlowTarget, 6, dt);
  wingMat.emissive.setHex(player.feverActive ? 0xff44cc : 0x55ccff);
  // Leading-edge wing bones flare hard while boosting
  wingEdgeMat.emissiveIntensity = damp(wingEdgeMat.emissiveIntensity, player.boosting ? 2.4 : 0.4, 6, dt);
  wingEdgeMat.emissive.setHex(player.feverActive ? 0xff44cc : 0x55ccff);
  bodyMat.emissiveIntensity = damp(bodyMat.emissiveIntensity, player.feverActive ? 0.5 : 0, 4, dt);
  eyeMat.emissive.setHex(player.feverActive ? 0xff66ee : 0x55e0ff);
  const auraTarget = player.feverActive ? 0.5 + Math.sin(time * 5) * 0.18 : 0;
  auraSprite.material.opacity = damp(auraSprite.material.opacity, auraTarget, 5, dt);
  // Boost halo (fake bloom): brighter as the combo climbs
  const haloTarget = player.boosting ? 0.22 + tier * 0.05 : 0;
  boostGlowSprite.material.opacity = damp(boostGlowSprite.material.opacity, haloTarget, 5, dt);
  boostGlowSprite.material.color.setHex(player.feverActive ? 0xff9ad6 : 0x78c8ff);

  group.updateMatrixWorld(true);

  // Wing-tip contrails while boosting: small sprites pinned to the true
  // wing tips, sampled after the matrix update so they track the flap.
  if (player.boosting) {
    contrailTimer -= dt;
    if (contrailTimer <= 0) {
      contrailTimer = 0.03 / quality;
      for (const marker of [tipMarkerL, tipMarkerR]) {
        const s = trailSprites.find(s => !s.visible);
        if (!s) break;
        marker.getWorldPosition(tmpV);
        s.visible = true;
        // Shorter than body trail = crisp ribbon; surge contrails linger
        s.userData.life = player.feverActive ? 0.8 : 0.6;
        s.material.color.setHex(player.feverActive ? 0xff9ad6 : 0xcfeeff);
        s.position.copy(tmpV);
      }
    }
  }

  // Ponytail: hair chain — whips harder as speed climbs
  riderHead.getWorldPosition(tmpV);
  tmpV.y += 0.1;
  tmpV.z += 0.14;
  ponyPoints[0].copy(tmpV);
  for (let i = 1; i < PONY_SEGS; i++) {
    const dir = tmpV2.copy(ponyPoints[i]).sub(ponyPoints[i - 1]);
    dir.y -= 2.4 * dt;
    dir.z += (player.speed / 35) * 3.4 * dt;
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.setLength(PONY_LEN);
    ponyPoints[i].copy(ponyPoints[i - 1]).add(dir);
    ponyMeshes[i].position.copy(ponyPoints[i]);
  }
  ponyMeshes[0].position.copy(ponyPoints[0]);

  // Scarf: anchored at the rider's collar; flutters and whips at speed
  riderHead.getWorldPosition(tmpV);
  tmpV.y -= 0.12;
  tmpV.z += 0.22;
  scarfPoints[0].copy(tmpV);
  for (let i = 1; i < SCARF_SEGS; i++) {
    const dir = tmpV2.copy(scarfPoints[i]).sub(scarfPoints[i - 1]);
    dir.y -= 1.8 * dt;
    dir.z += (player.speed / 35) * 3.8 * dt;
    dir.x += Math.sin(time * 9 + i * 1.3) * 0.5 * dt;
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
    dir.setLength(SCARF_LEN);
    scarfPoints[i].copy(scarfPoints[i - 1]).add(dir);
    scarfMeshes[i].position.copy(scarfPoints[i]);
  }
  scarfMeshes[0].position.copy(scarfPoints[0]);

  // Cyan speed trail (orb/fast); shifts pink during fever, denser at high combo
  trailTimer -= dt;
  if (player.speedActive && trailTimer <= 0) {
    trailTimer = 0.015 / (quality * (1 + tier * 0.25));
    const s = trailSprites.find(s => !s.visible);
    if (s) {
      s.visible = true;
      s.userData.life = 1;
      s.material.color.setHex(player.feverActive ? 0xff9ad6 : 0xffffff);
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

  // Blue boost trail (only while boosting); shifts pink during fever
  boostTrailTimer -= dt;
  if (player.boosting && boostTrailTimer <= 0) {
    boostTrailTimer = 0.022 / (quality * (1 + tier * 0.25));
    const s = boostTrailSprites.find(s => !s.visible);
    if (s) {
      s.visible = true;
      s.userData.life = 1;
      s.material.color.setHex(player.feverActive ? 0xff88cc : 0xffffff);
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
  rider.rotation.set(0, 0, 0);
  wingMat.emissiveIntensity = 0;
  wingEdgeMat.emissiveIntensity = 0.4;
  bodyMat.emissiveIntensity = 0;
  auraSprite.material.opacity = 0;
  boostGlowSprite.material.opacity = 0;
  for (const p of ponyPoints) p.set(player.position.x, player.position.y + 1.5, player.position.z);
  for (const p of scarfPoints) p.set(player.position.x, player.position.y + 1.3, player.position.z);
  for (const s of trailSprites) { s.visible = false; s.userData.life = 0; }
  for (const s of boostTrailSprites) { s.visible = false; s.userData.life = 0; }
  for (const p of burstParticles) { p.visible = false; }
  burstActive = false;
}
