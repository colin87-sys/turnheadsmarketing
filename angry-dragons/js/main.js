import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { initInput } from './input.js';
import { createLevelGen } from './level.js';
import { createEnvironment, updateEnvironment } from './environment.js';
import { createDragon, updateDragon, resetDragon } from './dragon.js';
import { player } from './player.js';
import { cameraCtl } from './cameraController.js';
import { initRings, addRing, updateRings, resetRings } from './rings.js';
import { initObstacles, addObstacle, updateObstacles, resetObstacles } from './obstacles.js';
import { initPowerups, addOrb, updatePowerups, resetPowerups } from './powerups.js';
import { updateCollision, resetCollision } from './collision.js';
import { ui } from './ui.js';

// --- Renderer / scene / camera ---------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
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

// --- Build the world ---------------------------------------------------------
createEnvironment(scene);
createDragon(scene);
initRings(scene);
initObstacles(scene);
initPowerups(scene);

// Endless course: keep it generated ahead of the dragon, spawn what's new.
let levelGen = createLevelGen();
function spawnAhead() {
  if (levelGen.generatedUntil >= player.dist + CONFIG.spawnAhead) return;
  const chunk = levelGen.ensure(player.dist + CONFIG.spawnAhead);
  chunk.rings.forEach(addRing);
  chunk.obstacles.forEach(addObstacle);
  chunk.orbs.forEach(addOrb);
}
spawnAhead();

// A shared ?challenge=1234 link sets a friend's score to beat.
const challengeParam = parseInt(new URLSearchParams(window.location.search).get('challenge'), 10);
if (Number.isFinite(challengeParam) && challengeParam > 0) game.challengeScore = challengeParam;

initInput();
ui.init({ getCard: makeShareCard });
cameraCtl.init(camera, player);
ui.showScreen('start');

// The share card: the scene is frozen at the crash moment, so rendering on
// demand captures "right before they died", stamped with their stats.
function makeShareCard() {
  renderer.render(scene, camera); // fresh frame: the GL buffer isn't preserved
  const src = renderer.domElement;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);

  const s = c.width / 1280;
  const top = c.height * 0.3;
  g.fillStyle = 'rgba(8, 16, 34, 0.55)';
  g.fillRect(0, top, c.width, 175 * s);
  g.textAlign = 'center';
  g.fillStyle = '#eaf4ff';
  g.font = `700 ${28 * s}px sans-serif`;
  g.fillText('ANGRY DRAGONS', c.width / 2, top + 42 * s);
  g.fillStyle = '#ffd86a';
  g.font = `700 ${64 * s}px sans-serif`;
  g.fillText(`${Math.floor(game.score)} PTS`, c.width / 2, top + 110 * s);
  g.fillStyle = '#9fd8f0';
  g.font = `${20 * s}px sans-serif`;
  g.fillText(
    `${Math.floor(game.distance)} m · ${game.ringsCollected} rings · best combo ${game.maxCombo.toFixed(2)}x`,
    c.width / 2,
    top + 150 * s
  );
  return c;
}

// --- Game flow ----------------------------------------------------------------
function startGame() {
  game.state = 'playing';
  ui.hideScreen();
}

function restart() {
  game.reset();
  player.reset();
  resetDragon(player);
  resetRings();
  resetObstacles();
  resetPowerups();
  resetCollision();
  levelGen = createLevelGen(); // same seed: every run flies the same canyon
  spawnAhead();
  cameraCtl.init(camera, player);
  ui.hideScreen();
  game.state = 'playing';
}

window.addEventListener('keydown', (e) => {
  if (game.state === 'ready' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  else if (game.state === 'gameover' && e.code === 'KeyR') restart();
});

// --- Main loop ------------------------------------------------------------------
const clock = new THREE.Clock();
let time = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (game.state === 'playing') {
    game.time += dt;
    player.update(dt);
    game.distance = player.dist;
    game.score += player.speed * dt * CONFIG.distanceScore; // flying fast is score
    spawnAhead();
    updateCollision(dt, player);
    updateRings(dt, player, time);
    updatePowerups(dt, player, time);
    ui.update(player);
  }

  // Cosmetic updates run in every state so menus (and the crash frame) stay alive.
  updateDragon(dt, player, time);
  updateObstacles(dt, time, player.dist);
  cameraCtl.update(dt, player);
  updateEnvironment(dt, camera, time, player.dist);

  renderer.render(scene, camera);
}

tick();
