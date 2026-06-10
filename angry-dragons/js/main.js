import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { initInput, initTouch } from './input.js';
import { createLevelGen } from './level.js';
import { createEnvironment, updateEnvironment, resetEnvironment } from './environment.js';
import { createDragon, updateDragon, resetDragon } from './dragon.js';
import { player } from './player.js';
import { cameraCtl } from './cameraController.js';
import { initRings, addRing, updateRings, resetRings } from './rings.js';
import { initObstacles, addObstacle, updateObstacles, resetObstacles } from './obstacles.js';
import { initPowerups, addOrb, updatePowerups, resetPowerups } from './powerups.js';
import { updateCollision, resetCollision } from './collision.js';
import { ui } from './ui.js';
import { music, sfx } from './sfx.js';

// --- Renderer / scene / camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1600);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Build the world ---
createEnvironment(scene);
createDragon(scene);
initRings(scene);
initObstacles(scene);
initPowerups(scene);

// Set-piece meshes must exist before the first spawnAhead() call below,
// since the first chunk can contain set-pieces.
const setpieceMeshes = [];

let levelGen = createLevelGen();
function spawnAhead() {
  if (levelGen.generatedUntil >= player.dist + CONFIG.spawnAhead) return;
  const chunk = levelGen.ensure(player.dist + CONFIG.spawnAhead);
  chunk.rings.forEach(addRing);
  chunk.obstacles.forEach(addObstacle);
  chunk.orbs.forEach(addOrb);
  // Set-pieces
  chunk.setPieces && chunk.setPieces.forEach(sp => triggerSetPiece(sp));
}
spawnAhead();

// --- Set-pieces (dramatic environment moments) ---
function triggerSetPiece(sp) {
  if (sp.type === 'arch') buildArch(sp.dist);
  else if (sp.type === 'tunnel') buildTunnel(sp.dist);
}

function buildArch(dist) {
  // Giant ice arch spanning the lane
  const mat = new THREE.MeshStandardMaterial({
    color: 0x88ccee, emissive: 0x1a4466, emissiveIntensity: 0.6,
    transparent: true, opacity: 0.82, roughness: 0.25,
  });
  const group = new THREE.Group();
  // Two pillars
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 28, 8), mat.clone());
    pillar.position.set(sx * 14, 14, -dist);
    group.add(pillar);
  }
  // Cross-beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(32, 2.5, 2.5), mat.clone());
  beam.position.set(0, 28, -dist);
  group.add(beam);
  // Icicles hanging from beam
  for (let i = -5; i <= 5; i++) {
    const h = 2 + Math.abs(i % 3) * 1.5;
    const ic = new THREE.Mesh(new THREE.ConeGeometry(0.35, h, 5), mat.clone());
    ic.position.set(i * 2.8, 28 - h / 2 - 1.2, -dist + (Math.abs(i) % 2) * 1.5);
    group.add(ic);
  }
  scene.add(group);
  setpieceMeshes.push({ object: group, dist });
}

function buildTunnel(dist) {
  // Dense crystal spires forming a tunnel for ~120m
  const mat = new THREE.MeshStandardMaterial({
    color: 0x99ddff, emissive: 0x2266aa, emissiveIntensity: 0.9,
    transparent: true, opacity: 0.72, roughness: 0.2,
  });
  const group = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const z = dist + i * 6;
    for (const sx of [-1, 1]) {
      const h = 14 + Math.sin(i * 0.8) * 6;
      const r = 1.4 + Math.cos(i * 1.3) * 0.5;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat.clone());
      spire.position.set(sx * (15 + Math.sin(i) * 2), h / 2, -z);
      spire.rotation.z = sx * (0.05 + Math.abs(Math.sin(i)) * 0.1);
      group.add(spire);
      // Ceiling stalactites
      const sh = 5 + Math.sin(i * 1.5) * 2;
      const stal = new THREE.Mesh(new THREE.ConeGeometry(0.5, sh, 5), mat.clone());
      stal.rotation.z = Math.PI;
      stal.position.set(sx * 8 + Math.cos(i) * 3, 26, -z);
      group.add(stal);
    }
  }
  scene.add(group);
  setpieceMeshes.push({ object: group, dist: dist - 20 }); // cull start a little before
}

// --- Challenge param ---
const challengeParam = parseInt(new URLSearchParams(window.location.search).get('challenge'), 10);
if (Number.isFinite(challengeParam) && challengeParam > 0) game.challengeScore = challengeParam;

initInput();
initTouch(renderer.domElement);
ui.init({ getCard: makeShareCard, onRestart: restart });
cameraCtl.init(camera, player);
ui.showScreen('start');

window.addEventListener('pointerdown', () => {
  if (game.state === 'ready') startGame();
});

// Share card: re-renders the scene at crash moment (with death particles visible)
// and stamps stats over it.
function makeShareCard() {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);

  const s = c.width / 1280;
  const top = c.height * 0.28;
  g.fillStyle = 'rgba(8, 14, 30, 0.6)';
  g.fillRect(0, top, c.width, 195 * s);
  g.textAlign = 'center';

  g.fillStyle = '#aaddff';
  g.font = `700 ${24 * s}px sans-serif`;
  g.fillText('DRAGON DRIFT', c.width / 2, top + 36 * s);

  g.fillStyle = '#ffd86a';
  g.font = `700 ${66 * s}px sans-serif`;
  g.fillText(`${Math.floor(game.score).toLocaleString()} PTS`, c.width / 2, top + 108 * s);

  g.fillStyle = '#9fd8f0';
  g.font = `${18 * s}px sans-serif`;
  g.fillText(
    `${Math.floor(game.distance)} m  ·  ${game.ringsCollected} rings  ·  ${game.maxCombo.toFixed(2)}x combo  ·  ${game.nearMisses} near misses`,
    c.width / 2, top + 142 * s
  );

  g.fillStyle = '#ffa06a';
  g.font = `${15 * s}px sans-serif`;
  g.fillText(`Seed: Frost-${CONFIG.seed}  ·  Can you beat my canyon?`, c.width / 2, top + 172 * s);

  return c;
}

// --- Game flow ---
function startGame() {
  game.state = 'playing';
  music.start();
  ui.hideScreen();
}

let boostWasActive = false;

function restart() {
  game.reset();
  player.reset();
  resetDragon(player);
  resetRings();
  resetObstacles();
  resetPowerups();
  resetCollision();
  resetEnvironment();
  // Cull old set-pieces
  for (const sp of setpieceMeshes) scene.remove(sp.object);
  setpieceMeshes.length = 0;
  levelGen = createLevelGen();
  spawnAhead();
  cameraCtl.init(camera, player);
  ui.hideScreen();
  game.state = 'playing';
  boostWasActive = false;
}

window.addEventListener('keydown', (e) => {
  if (game.state === 'ready'    && (e.code === 'Enter' || e.code === 'Space')) startGame();
  else if (game.state === 'gameover' && e.code === 'KeyR') restart();
});

// --- Main loop ---
const clock = new THREE.Clock();
// Screenshot capture: delayed slightly after death to catch burst particles
let screenshotPending = false;
let screenshotTimer = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (game.state === 'playing') {
    game.time += dt;
    player.update(dt);
    game.distance = player.dist;
    game.score += player.speed * dt * CONFIG.distanceScore;
    spawnAhead();
    updateCollision(dt, player);
    updateRings(dt, player, clock.getElapsedTime());
    updatePowerups(dt, player, clock.getElapsedTime());
    music.update(game, player);
    ui.update(player);

    // Boost start: camera kick + whoosh SFX
    if (player.boosting && !boostWasActive) {
      cameraCtl.boostKick();
      sfx.boostStart();
    }
    boostWasActive = player.boosting;

    // Fever timer
    if (game.feverActive) {
      game.feverTimer -= dt;
      if (game.feverTimer <= 0) {
        game.feverActive = false;
        game.feverTimer = 0;
      }
    }

  } else if (game.state === 'gameover') {
    // Death freeze: hold the crash frame briefly, then show game-over screen
    if (game.deathFreezeTimer > 0) {
      game.deathFreezeTimer -= dt;
      if (game.deathFreezeTimer <= 0) {
        game.recordBests();
        ui.showScreen('gameover');
      }
    }
  }

  // Cull old set-pieces
  for (let i = setpieceMeshes.length - 1; i >= 0; i--) {
    if (setpieceMeshes[i].dist < player.dist - CONFIG.cullBehind - 200) {
      scene.remove(setpieceMeshes[i].object);
      setpieceMeshes.splice(i, 1);
    }
  }

  const t = clock.getElapsedTime();
  updateDragon(dt, player, t);
  updateObstacles(dt, t, player.dist);
  cameraCtl.update(dt, player);
  updateEnvironment(dt, camera, t, player.dist);

  renderer.render(scene, camera);
}

tick();
