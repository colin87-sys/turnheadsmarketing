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

// A shared ?challenge=1234 link sets a friend's score to beat.
const challengeParam = parseInt(new URLSearchParams(window.location.search).get('challenge'), 10);
if (Number.isFinite(challengeParam) && challengeParam > 0) game.challengeScore = challengeParam;

initInput();
ui.init({ onScreenshot: captureScreenshot });
cameraCtl.init(camera, player);
ui.showScreen('start');

// Composite the rendered frame with the final stats into a downloadable PNG.
function captureScreenshot() {
  renderer.render(scene, camera); // fresh frame: the GL buffer isn't preserved between frames
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
  g.fillText('DRAGON FLIGHT', c.width / 2, top + 42 * s);
  g.fillStyle = '#ffd86a';
  g.font = `700 ${64 * s}px sans-serif`;
  g.fillText(`${Math.floor(game.score)} PTS`, c.width / 2, top + 110 * s);
  g.fillStyle = '#9fd8f0';
  g.font = `${20 * s}px sans-serif`;
  g.fillText(
    `${game.ringsCollected}/${game.ringsTotal} rings · best combo ${game.maxCombo.toFixed(2)}x · ${game.time.toFixed(1)}s`,
    c.width / 2,
    top + 150 * s
  );

  const a = document.createElement('a');
  a.download = `dragon-flight-${Math.floor(game.score)}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
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
      // Speed bonus: points for every second under par (par = base-speed pace),
      // so constant boosting is rewarded alongside ring combos.
      const parTime = CONFIG.levelLength / CONFIG.baseSpeed;
      game.timeBonus = Math.max(0, Math.round((parTime - game.time) * CONFIG.timeBonusPerSec));
      game.score += game.timeBonus;
      game.recordHighScore();
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
