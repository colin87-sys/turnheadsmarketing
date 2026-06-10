import { CONFIG } from './config.js';
import { game } from './gameState.js';

// DOM-based HUD: health/stamina bars, score, combo, course progress,
// transient popups, damage vignette and the start/gameover/finish screens.
let els = {};

export const ui = {
  init() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="hud-top-left">
        <div class="bar-label">HEALTH</div>
        <div class="bar"><div class="bar-fill health" id="health-fill"></div></div>
        <div class="bar-label">STAMINA</div>
        <div class="bar"><div class="bar-fill stamina" id="stamina-fill"></div></div>
        <div class="hint">Hold SPACE to boost</div>
      </div>
      <div class="hud-top-right">
        <div class="score" id="score">0</div>
        <div class="combo" id="combo">1.00x COMBO</div>
      </div>
      <div class="hud-progress"><div class="bar-fill progress" id="progress-fill"></div></div>
      <div class="popup" id="popup"></div>
      <div class="vignette" id="vignette"></div>
      <div class="blue-flash" id="blue-flash"></div>
      <div class="screen" id="screen"></div>
    `;
    document.body.appendChild(root);
    els = {
      health: root.querySelector('#health-fill'),
      stamina: root.querySelector('#stamina-fill'),
      progress: root.querySelector('#progress-fill'),
      score: root.querySelector('#score'),
      combo: root.querySelector('#combo'),
      popup: root.querySelector('#popup'),
      vignette: root.querySelector('#vignette'),
      blueFlash: root.querySelector('#blue-flash'),
      screen: root.querySelector('#screen'),
    };
  },

  update(player) {
    els.health.style.width = `${(game.health / CONFIG.healthMax) * 100}%`;
    els.stamina.style.width = `${(game.stamina / CONFIG.staminaMax) * 100}%`;
    els.stamina.classList.toggle('depleted', game.stamina <= 0.5);
    els.progress.style.width = `${Math.min(player.dist / CONFIG.levelLength, 1) * 100}%`;
    els.score.textContent = Math.floor(game.score);
    els.combo.textContent = `${game.combo.toFixed(2)}x COMBO`;
    els.combo.classList.toggle('hot', game.combo >= 2);
  },

  ringPopup(points, perfect) {
    this._popup(perfect ? `+${points} PERFECT!` : `+${points}`, perfect ? 'gold' : 'cyan');
  },

  comboBreak() {
    this._popup('COMBO LOST', 'red');
  },

  orbFlash() {
    this._popup('SPEED SURGE!', 'cyan');
    restartAnim(els.blueFlash, 'flash-anim');
  },

  damageFlash() {
    restartAnim(els.vignette, 'flash-anim');
  },

  _popup(text, color) {
    els.popup.textContent = text;
    els.popup.dataset.color = color;
    restartAnim(els.popup, 'popup-anim');
  },

  showScreen(type) {
    let html = '';
    if (type === 'start') {
      html = `
        <h1>DRAGON FLIGHT</h1>
        <p class="sub">Ride the dragon through the frozen canyon at sunset.</p>
        <ul>
          <li><b>W/A/S/D</b> or <b>Arrows</b> — steer</li>
          <li><b>Hold SPACE</b> — boost (drains stamina)</li>
          <li>Fly through <span class="c">glowing rings</span> to build your combo</li>
          <li>Grab <span class="c">blue orbs</span> for a free speed surge</li>
          <li>Avoid the ice — it bites back</li>
        </ul>
        <p class="action">Press ENTER to take off</p>`;
    } else if (type === 'gameover') {
      html = `
        <h1 class="bad">YOUR DRAGON HAS FALLEN</h1>
        <p class="sub">Final score: <b>${Math.floor(game.score)}</b></p>
        <p class="sub">Rings: ${game.ringsCollected} / ${game.ringsTotal} &nbsp;·&nbsp; Best combo: ${game.maxCombo.toFixed(2)}x</p>
        <p class="action">Press R to fly again</p>`;
    } else if (type === 'finished') {
      html = `
        <h1 class="good">COURSE COMPLETE!</h1>
        <p class="sub">Final score: <b>${Math.floor(game.score)}</b></p>
        <p class="sub">Rings: ${game.ringsCollected} / ${game.ringsTotal} &nbsp;·&nbsp; Best combo: ${game.maxCombo.toFixed(2)}x &nbsp;·&nbsp; Time: ${game.time.toFixed(1)}s</p>
        <p class="action">Press R to fly again</p>`;
    }
    els.screen.innerHTML = html;
    els.screen.classList.add('visible');
  },

  hideScreen() {
    els.screen.classList.remove('visible');
  },
};

// Restart a CSS animation from frame 0 even if it's mid-flight.
function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
