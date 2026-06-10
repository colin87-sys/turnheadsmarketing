import { CONFIG } from './config.js';
import { game } from './gameState.js';

// DOM-based HUD: health/stamina bars, score, combo, course progress,
// transient popups, damage vignette, start/gameover/finish screens,
// and the share / challenge-link controls.
let els = {};
let handlers = {}; // { onScreenshot } supplied by main.js

export const ui = {
  init(h = {}) {
    handlers = h;
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="hud-top-left">
        <div class="bar-label">HEALTH</div>
        <div class="bar"><div class="bar-fill health" id="health-fill"></div></div>
        <div class="bar-label">STAMINA</div>
        <div class="bar"><div class="bar-fill stamina" id="stamina-fill"></div></div>
        <div class="hint">Hold SPACE to boost · rings refill stamina</div>
      </div>
      <div class="hud-top-right">
        <div class="score" id="score">0</div>
        <div class="combo" id="combo">1.00x COMBO</div>
        <div class="best" id="best"></div>
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
      best: root.querySelector('#best'),
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
    els.best.textContent = game.highScore > 0 ? `BEST ${game.highScore}` : '';
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
    const score = Math.floor(game.score);
    const stats = `Rings: ${game.ringsCollected} / ${game.ringsTotal} &nbsp;·&nbsp; Best combo: ${game.maxCombo.toFixed(2)}x &nbsp;·&nbsp; Time: ${game.time.toFixed(1)}s`;
    let html = '';

    if (type === 'start') {
      html = `
        <h1>DRAGON FLIGHT</h1>
        ${game.challengeScore ? `<p class="challenge">CHALLENGE — beat ${game.challengeScore} points!</p>` : ''}
        <p class="sub">Ride the dragon through the frozen canyon at sunset.</p>
        ${game.highScore ? `<p class="sub">Your best: <b>${game.highScore}</b></p>` : ''}
        <ul>
          <li><b>W/A/S/D</b> or <b>Arrows</b> — steer</li>
          <li><b>Hold SPACE</b> — boost (drains stamina; rings refill it)</li>
          <li>Fly through <span class="c">glowing rings</span> to build your combo</li>
          <li>Grab <span class="c">blue orbs</span> for a free speed surge</li>
          <li>Finish fast — every second under par is bonus points</li>
        </ul>
        <p class="action">Press ENTER to take off</p>`;
    } else if (type === 'gameover') {
      html = `
        <h1 class="bad">YOUR DRAGON HAS FALLEN</h1>
        ${game.isNewHighScore ? '<p class="newbest">&#9733; NEW HIGH SCORE &#9733;</p>' : ''}
        <p class="sub">Final score: <b>${score}</b></p>
        <p class="sub">${stats}</p>
        ${challengeResult(score)}
        ${shareRow()}
        <p class="action">Press R to fly again</p>`;
    } else if (type === 'finished') {
      html = `
        <h1 class="good">COURSE COMPLETE!</h1>
        ${game.isNewHighScore ? '<p class="newbest">&#9733; NEW HIGH SCORE &#9733;</p>' : ''}
        <p class="sub">Final score: <b>${score}</b>${game.timeBonus ? ` &nbsp;(includes +${game.timeBonus} speed bonus)` : ''}</p>
        <p class="sub">${stats}</p>
        ${challengeResult(score)}
        ${shareRow()}
        <p class="action">Press R to fly again</p>`;
    }

    els.screen.innerHTML = html;
    els.screen.classList.add('visible');
    wireShareButtons(score);
  },

  hideScreen() {
    els.screen.classList.remove('visible');
  },
};

function challengeResult(score) {
  if (!game.challengeScore) return '';
  return score > game.challengeScore
    ? `<p class="challenge won">CHALLENGE BEATEN! (${game.challengeScore})</p>`
    : `<p class="challenge">Challenge: ${game.challengeScore} — not this time</p>`;
}

function shareRow() {
  return `
    <div class="share-row">
      <button id="btn-copy">COPY CHALLENGE LINK</button>
      <button id="btn-tweet">SHARE ON X</button>
      <button id="btn-shot">SAVE SCREENSHOT</button>
    </div>`;
}

function challengeUrl(score) {
  return `${location.origin}${location.pathname}?challenge=${score}`;
}

function wireShareButtons(score) {
  const copy = els.screen.querySelector('#btn-copy');
  const tweet = els.screen.querySelector('#btn-tweet');
  const shot = els.screen.querySelector('#btn-shot');
  if (copy) {
    copy.onclick = () => {
      const url = challengeUrl(score);
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(url)
          .then(() => (copy.textContent = 'COPIED ✓'))
          .catch(() => window.prompt('Copy this link:', url));
      } else {
        window.prompt('Copy this link:', url);
      }
    };
  }
  if (tweet) {
    tweet.onclick = () => {
      const text = `I scored ${score} in Dragon Flight \u{1F409} Think you can beat me?`;
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(challengeUrl(score))}`;
      window.open(url, '_blank', 'noopener');
    };
  }
  if (shot) {
    shot.onclick = () => handlers.onScreenshot && handlers.onScreenshot();
  }
}

// Restart a CSS animation from frame 0 even if it's mid-flight.
function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
