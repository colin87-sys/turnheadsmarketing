import * as THREE from 'three';
import { mulberry32, makeGlowTexture, damp } from './util.js';
import { CONFIG } from './config.js';

// Sunset sky dome, warm fog, icy canyon walls, snow particles and lighting.
// Endless: the floor and sky follow the player; crystal wall instances are
// recycled — anything that falls behind leapfrogs ahead with fresh jitter.
let sky = null;
let floor = null;
let snow = null;
let snowPositions = null;
const SNOW_COUNT = 1200;
const SNOW_BOX = { x: 80, y: 50, z: 160 };

const WALL_WINDOW = 900; // wall band: 100 behind the player to 800 ahead
let bigBand = null;
let smallBand = null;
let rnd = null;

// Dragon Surge: damped 0..1 mix driving the aurora sky and snow tint.
let feverMix = 0;
const snowBaseColor = new THREE.Color(0xffffff);
const snowFeverColor = new THREE.Color(0xff9aee);

export function createEnvironment(scene) {
  rnd = mulberry32(CONFIG.seed + 99);
  scene.fog = new THREE.Fog(0xd99a7a, 70, 380);

  // --- Sky dome: sunset gradient with a low sun ahead of the player.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x1c2e5e) },
      midColor: { value: new THREE.Color(0x9a5a8e) },
      horizonColor: { value: new THREE.Color(0xff9a55) },
      sunDir: { value: new THREE.Vector3(-0.22, 0.1, -1).normalize() },
      feverMix: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 topColor, midColor, horizonColor, sunDir;
      uniform float feverMix, time;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        // Dragon Surge palette shift: horizon -> magenta, mid -> violet
        vec3 hor = mix(horizonColor, vec3(1.0, 0.35, 0.85), feverMix * 0.8);
        vec3 mid = mix(midColor, vec3(0.55, 0.25, 0.9), feverMix * 0.7);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, topColor, smoothstep(0.2, 0.7, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.75, 0.45) * (pow(s, 600.0) * 1.3 + pow(s, 8.0) * 0.35);
        // Aurora bands during surge: two drifting sine curtains in the upper
        // sky, fading cyan <-> magenta. Branchless — everything * feverMix.
        float band1 = sin(d.x * 9.0 + time * 0.7 + d.y * 14.0);
        float band2 = sin(d.x * 5.0 - time * 0.45 + d.y * 9.0 + 2.1);
        float curtain = smoothstep(0.15, 0.65, h) * (0.5 + 0.5 * sin(time * 0.3));
        vec3 aurora = vec3(0.25, 0.95, 0.85) * max(band1, 0.0)
                    + vec3(0.95, 0.3, 0.95) * max(band2, 0.0);
        col += aurora * curtain * feverMix * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 16), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // --- Lighting: warm sun ahead, cool ice bounce from below/around.
  const sun = new THREE.DirectionalLight(0xffb070, 1.6);
  sun.position.set(-60, 45, -150);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x9ab8ff, 0x32435e, 0.8));

  // --- Snowy canyon floor: a plain plane that quietly follows the player.
  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 1200),
    new THREE.MeshStandardMaterial({ color: 0xaccae0, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // --- Canyon walls: recycled instanced crystal spires along both sides.
  // Walls glow less than gameplay objects so hazards/rewards pop.
  bigBand = makeBand(scene, 13, {
    color: 0x6fb7e8,
    emissive: 0x123a55,
    emissiveIntensity: 0.25,
    place(side) {
      return {
        x: side * (17 + rnd() * 8),
        h: 18 + rnd() * 32,
        r: 3.5 + rnd() * 5,
        tilt: side * (0.06 + rnd() * 0.1),
      };
    },
  });
  smallBand = makeBand(scene, 30, {
    color: 0x9fd8f0,
    emissive: 0x1c4a66,
    emissiveIntensity: 0.3,
    place(side) {
      const h = 2 + rnd() * 5;
      return { x: side * (13.5 + rnd() * 3), h, r: h * 0.35, tilt: side * rnd() * 0.3 };
    },
  });

  // --- Snow particles, wrapped around the camera as it travels.
  snowPositions = new Float32Array(SNOW_COUNT * 3);
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * SNOW_BOX.x;
    snowPositions[i * 3 + 1] = Math.random() * SNOW_BOX.y;
    snowPositions[i * 3 + 2] = -Math.random() * SNOW_BOX.z + 30;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({
      size: 0.4,
      map: makeGlowTexture('255,255,255'),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      color: 0xffffff,
    })
  );
  snow.frustumCulled = false;
  scene.add(snow);
}

// A pair-sided band of instanced crystal cones spread over WALL_WINDOW,
// recycled forward as the player advances.
function makeBand(scene, step, opts) {
  const perSide = Math.ceil(WALL_WINDOW / step);
  const mesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 5),
    new THREE.MeshStandardMaterial({
      color: opts.color,
      flatShading: true,
      roughness: 0.32,
      metalness: 0.1,
      emissive: opts.emissive,
      emissiveIntensity: opts.emissiveIntensity,
    }),
    perSide * 2
  );
  mesh.frustumCulled = false;
  const data = [];
  let idx = 0;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < perSide; i++) {
      const d = { side, slot: i, dist: i * step + rnd() * step - 100, ...opts.place(side) };
      data.push(d);
      writeMatrix(mesh, idx++, d);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return { mesh, data, step, place: opts.place };
}

const m4 = new THREE.Matrix4();
const quat = new THREE.Quaternion();
const eul = new THREE.Euler();
function writeMatrix(mesh, i, d) {
  eul.set(0, d.rotY ?? (d.rotY = rnd() * Math.PI), d.tilt);
  quat.setFromEuler(eul);
  m4.compose(new THREE.Vector3(d.x, d.h * 0.42, -d.dist), quat, new THREE.Vector3(d.r, d.h, d.r));
  mesh.setMatrixAt(i, m4);
}

function recycleBand(band, playerDist) {
  let changed = false;
  for (let i = 0; i < band.data.length; i++) {
    const d = band.data[i];
    if (d.dist < playerDist - 100) {
      const fresh = band.place(d.side);
      Object.assign(d, fresh, { dist: d.dist + WALL_WINDOW, rotY: rnd() * Math.PI });
      writeMatrix(band.mesh, i, d);
      changed = true;
    }
  }
  if (changed) band.mesh.instanceMatrix.needsUpdate = true;
}

// Re-seat a band's instances around the start line. Without this, restarting
// leaves every crystal parked thousands of metres ahead — an empty canyon
// with an invisible (but still fatal) wall.
function reseedBand(band) {
  for (let i = 0; i < band.data.length; i++) {
    const d = band.data[i];
    Object.assign(d, band.place(d.side), {
      dist: d.slot * band.step + rnd() * band.step - 100,
      rotY: rnd() * Math.PI,
    });
    writeMatrix(band.mesh, i, d);
  }
  band.mesh.instanceMatrix.needsUpdate = true;
}

export function resetEnvironment() {
  reseedBand(bigBand);
  reseedBand(smallBand);
  feverMix = 0;
}

export function updateEnvironment(dt, camera, time, playerDist, feverActive = false, playerSpeed = 0) {
  sky.position.copy(camera.position);
  floor.position.z = -playerDist;
  recycleBand(bigBand, playerDist);
  recycleBand(smallBand, playerDist);

  // Dragon Surge sky + snow tint (damped so it sweeps in/out smoothly)
  feverMix = damp(feverMix, feverActive ? 1 : 0, 2.5, dt);
  sky.material.uniforms.feverMix.value = feverMix;
  sky.material.uniforms.time.value = time;
  snow.material.color.lerpColors(snowBaseColor, snowFeverColor, feverMix);
  snow.material.opacity = 0.75 + feverMix * 0.2;

  // Extra streaming at speed: flakes drift toward the camera so boosting
  // reads as rushing through the snowfall (cheap speed lines).
  const speedDrift = Math.max(0, playerSpeed - 35) * 0.5 * dt;

  // Snowfall with gentle sway; wrap each flake into a box around the camera.
  const cx = camera.position.x;
  const cy = camera.position.y;
  const cz = camera.position.z;
  for (let i = 0; i < SNOW_COUNT; i++) {
    let x = snowPositions[i * 3];
    let y = snowPositions[i * 3 + 1] - (3.5 + (i % 5)) * dt;
    let z = snowPositions[i * 3 + 2] + speedDrift;
    x += Math.sin(time * 1.5 + i) * 0.6 * dt;

    if (y < cy - 25) y += SNOW_BOX.y;
    while (x < cx - SNOW_BOX.x / 2) x += SNOW_BOX.x;
    while (x > cx + SNOW_BOX.x / 2) x -= SNOW_BOX.x;
    while (z < cz - SNOW_BOX.z + 30) z += SNOW_BOX.z;
    while (z > cz + 30) z -= SNOW_BOX.z;

    snowPositions[i * 3] = x;
    snowPositions[i * 3 + 1] = y;
    snowPositions[i * 3 + 2] = z;
  }
  snow.geometry.attributes.position.needsUpdate = true;
}
