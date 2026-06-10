import * as THREE from 'three';
import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { initInput } from './input.js';
import { generateLevel } from './level.js';
import { createEnvironment, updateEnvironment } from './environment.js';
import { createDragon, updateDragon, resetDragon } from './dragon.js';
import { player } from './player.js';
import { cameraCtl } from './cameraController.js';
import { createRings, updateRings, resetRings } from './rings.js';
import { createObstacles, updateObstacles } from './obstacles.js';
import { createPowerups, updatePowerups, resetPowerups } from './powerups.js';
import { updateCollision, resetCollision } from './collision.js';
import { ui } from './ui.js';
import { sfx } from './sfx.js';

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
const layout = generateLevel();
createEnvironment(scene);
createDragon(scene);
createRings(scene, layout);
createObstacles(scene, layout);
createPowerups(scene, layout);

initInput();
ui.init();
cameraCtl.init(camera, player);
ui.showScreen('start');

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
  resetPowerups();
  resetCollision();
  cameraCtl.init(camera, player);
  ui.hideScreen();
  game.state = 'playing';
}

window.addEventListener('keydown', (e) => {
  if (game.state === 'ready' && (e.code === 'Enter' || e.code === 'Space')) startGame();
  else if ((game.state === 'gameover' || game.state === 'finished') && e.code === 'KeyR') restart();
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
    updateCollision(dt, player);
    updateRings(dt, player, time);
    updatePowerups(dt, player, time);
    ui.update(player);

    if (player.dist >= CONFIG.levelLength) {
      game.state = 'finished';
      ui.showScreen('finished');
      sfx.finish();
    }
  }

  // Cosmetic updates run in every state so menus stay alive.
  updateDragon(dt, player, time);
  updateObstacles(dt, time);
  cameraCtl.update(dt, player);
  updateEnvironment(dt, camera, time);

  renderer.render(scene, camera);
}

tick();
