import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, makeGlowTexture } from './util.js';

// Sunset sky dome, warm fog, icy canyon walls, snow particles and lighting.
let sky = null;
let snow = null;
let snowPositions = null;
const SNOW_COUNT = 1200;
const SNOW_BOX = { x: 80, y: 50, z: 160 };

export function createEnvironment(scene) {
  const L = CONFIG.levelLength;

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
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.25, h));
        col = mix(col, topColor, smoothstep(0.2, 0.7, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.75, 0.45) * (pow(s, 600.0) * 1.3 + pow(s, 8.0) * 0.35);
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

  // --- Snowy canyon floor.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, L + 700),
    new THREE.MeshStandardMaterial({ color: 0xaccae0, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -L / 2);
  scene.add(floor);

  // --- Canyon walls: instanced crystal spires along both sides.
  const rnd = mulberry32(CONFIG.seed + 99);
  const wallGeo = new THREE.ConeGeometry(1, 1, 5);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x6fb7e8,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x123a55,
    emissiveIntensity: 0.4,
  });
  const perSide = Math.ceil((L + 300) / 13);
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, perSide * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let idx = 0;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < perSide; i++) {
      const z = 60 - i * 13 - rnd() * 6;
      const x = side * (17 + rnd() * 8);
      const h = 18 + rnd() * 32;
      const r = 3.5 + rnd() * 5;
      e.set((rnd() - 0.5) * 0.16, rnd() * Math.PI, side * (0.06 + rnd() * 0.1));
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, h * 0.42, z), q, new THREE.Vector3(r, h, r));
      walls.setMatrixAt(idx++, m);
    }
  }
  scene.add(walls);

  // --- Small foreground crystals near the lane edges.
  const smallCount = Math.ceil(L / 30) * 2;
  const small = new THREE.InstancedMesh(
    wallGeo,
    new THREE.MeshStandardMaterial({
      color: 0x9fd8f0,
      flatShading: true,
      roughness: 0.3,
      emissive: 0x1c4a66,
      emissiveIntensity: 0.5,
    }),
    smallCount
  );
  for (let i = 0; i < smallCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -((i / 2) * 30 + rnd() * 24);
    const x = side * (13.5 + rnd() * 3);
    const h = 2 + rnd() * 5;
    e.set(0, rnd() * Math.PI, side * rnd() * 0.3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, h * 0.4, z), q, new THREE.Vector3(h * 0.35, h, h * 0.35));
    small.setMatrixAt(i, m);
  }
  scene.add(small);

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

export function updateEnvironment(dt, camera, time) {
  sky.position.copy(camera.position);

  // Snowfall with gentle sway; wrap each flake into a box around the camera.
  const cx = camera.position.x;
  const cy = camera.position.y;
  const cz = camera.position.z;
  for (let i = 0; i < SNOW_COUNT; i++) {
    let x = snowPositions[i * 3];
    let y = snowPositions[i * 3 + 1] - (3.5 + (i % 5)) * dt;
    let z = snowPositions[i * 3 + 2];
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
