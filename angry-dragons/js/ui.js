import { CONFIG } from './config.js';
import { game } from './gameState.js';

// DOM-based HUD: health/stamina bars, score, combo, distance, transient
// popups, damage vignette, the start/game-over screens, and the simplified
// share flow (Screenshot + Share & Challenge with IG / X / TikTok / link).
let els = {};
let handlers = {}; // { getCard, onRestart } supplied by main.js

// Coarse-pointer devices get touch wording and a tap-first menu.
const isTouch = () =>
  (globalThis.matchMedia && matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in globalThis;

const ICONS = {
  ig: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2z"/></svg>',
  tt: '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.77a5.76 5.76 0 0 0-.77-.05 5.66 5.66 0 1 0 5.66 5.66V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.22-1.48z"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.6 13.4a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.6l-1.2 1.2"/><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.6l1.2-1.2"/></svg>',
};

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
        <div class="dist" id="dist">0 m</div>
        <div class="best" id="best"></div>
      </div>
      <div class="popup" id="popup"></div>
      <div class="vignette" id="vignette"></div>
      <div class="blue-flash" id="blue-flash"></div>
      <div class="screen" id="screen"></div>
    `;
    document.body.appendChild(root);
    els = {
      health: root.querySelector('#health-fill'),
      stamina: root.querySelector('#stamina-fill'),
      score: root.querySelector('#score'),
      combo: root.querySelector('#combo'),
      dist: root.querySelector('#dist'),
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
    els.score.textContent = Math.floor(game.score);
    els.combo.textContent = `${game.combo.toFixed(2)}x COMBO`;
    els.combo.classList.toggle('hot', game.combo >= 2);
    els.dist.textContent = `${Math.floor(player.dist)} m`;
    els.best.textContent = game.highScore > 0 ? `BEST ${game.highScore}` : '';
  },

  ringPopup(points, perfect) {
    this._popup(perfect ? `+${points} PERFECT!` : `+${points}`, perfect ? 'gold' : 'green');
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
    const dist = Math.floor(game.distance);
    let html = '';

    if (type === 'start') {
      const touch = isTouch();
      const controls = touch
        ? `
          <li><b>Drag</b> anywhere — steer</li>
          <li><b>Hold a second finger</b> — boost (drains stamina; rings refill it)</li>`
        : `
          <li><b>W/A/S/D</b> or <b>Arrows</b> — steer</li>
          <li><b>Hold SPACE</b> — boost (drains stamina; rings refill it)</li>`;
      html = `
        <h1>ANGRY DRAGONS</h1>
        ${game.challengeScore ? `<p class="challenge">CHALLENGE — beat ${game.challengeScore} points!</p>` : ''}
        <p class="sub">The canyon never ends. It only gets meaner. Fly as far as you can.</p>
        ${game.highScore ? `<p class="sub">Your best: <b>${game.highScore}</b> pts · ${game.bestDistance} m</p>` : ''}
        <ul>
          ${controls}
          <li><span class="cg">Green rings</span> build your combo. <span class="c">Blue orbs</span> = free speed surge</li>
          <li>Floating ice chips your health. <b>Side walls end your flight instantly.</b></li>
          <li>Thread the glowing square holes in the crystal walls</li>
        </ul>
        <p class="action">${touch ? 'Tap to take off' : 'Press ENTER to take off'}</p>`;
    } else if (type === 'gameover') {
      const gap = game.highScore > score ? game.highScore - score : 0;
      html = `
        <h1 class="bad">CRASHED!</h1>
        ${game.isNewHighScore ? '<p class="newbest">&#9733; NEW HIGH SCORE &#9733;</p>' : ''}
        ${game.isNewBestDistance && !game.isNewHighScore ? '<p class="newbest">&#9733; LONGEST FLIGHT YET &#9733;</p>' : ''}
        <p class="sub big"><b>${score}</b> points &nbsp;·&nbsp; <b>${dist}</b> m</p>
        <p class="sub">Rings: ${game.ringsCollected} &nbsp;·&nbsp; Best combo: ${game.maxCombo.toFixed(2)}x &nbsp;·&nbsp; ${game.time.toFixed(1)}s</p>
        ${gap > 0 ? `<p class="sub gap">Only <b>${gap}</b> points from your best — go again!</p>` : ''}
        ${challengeResult(score)}
        <button id="btn-again" class="btn-primary">FLY AGAIN</button>
        <div class="share-row">
          <button id="btn-shot">SCREENSHOT</button>
          <button id="btn-share">SHARE &amp; CHALLENGE YOUR FRIENDS</button>
        </div>
        <div class="share-menu" id="share-menu" hidden>
          <button id="share-ig" title="Instagram">${ICONS.ig}</button>
          <button id="share-x" title="X">${ICONS.x}</button>
          <button id="share-tt" title="TikTok">${ICONS.tt}</button>
          <button id="share-link" title="Copy challenge link">${ICONS.link}</button>
        </div>
        <p class="share-hint" id="share-hint"></p>
        ${isTouch() ? '' : '<p class="action">or press R</p>'}`;
    }

    els.screen.innerHTML = html;
    els.screen.classList.add('visible');
    if (type === 'gameover') wireShareButtons(score, dist);
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

function challengeUrl(score) {
  return `${location.origin}${location.pathname}?challenge=${score}`;
}

function wireShareButtons(score, dist) {
  const shot = els.screen.querySelector('#btn-shot');
  const share = els.screen.querySelector('#btn-share');
  const menu = els.screen.querySelector('#share-menu');
  const hint = els.screen.querySelector('#share-hint');
  const text = `I scored ${score} and flew ${dist}m in Angry Dragons \u{1F409} Think you can beat me?`;

  const setHint = (t) => (hint.textContent = t);

  const downloadCard = () => {
    const card = handlers.getCard && handlers.getCard();
    if (!card) return false;
    const a = document.createElement('a');
    a.download = `angry-dragons-${score}.png`;
    a.href = card.toDataURL('image/png');
    a.click();
    return true;
  };

  const copyLink = () => {
    const url = challengeUrl(score);
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(url).then(
        () => true,
        () => (window.prompt('Copy this link:', url), true)
      );
    }
    window.prompt('Copy this link:', url);
    return Promise.resolve(true);
  };

  // Native share sheet with the crash screenshot attached (mobile opens
  // straight into IG/TikTok/etc). Returns false when unsupported.
  const tryNativeShare = async () => {
    try {
      const card = handlers.getCard && handlers.getCard();
      if (!card || !navigator.canShare) return false;
      const blob = await new Promise((res) => card.toBlob(res, 'image/png'));
      const file = new File([blob], 'angry-dragons.png', { type: 'image/png' });
      const data = { files: [file], text: `${text} ${challengeUrl(score)}` };
      if (!navigator.canShare(data)) return false;
      await navigator.share(data);
      return true;
    } catch {
      return false;
    }
  };

  // Desktop fallback for apps without a web post intent: save the crash
  // screenshot, copy the challenge link, then open the app's site.
  const appFallback = async (label, site) => {
    downloadCard();
    await copyLink();
    setHint(`Screenshot saved & challenge link copied — paste them into your ${label} post!`);
    window.open(site, '_blank', 'noopener');
  };

  const again = els.screen.querySelector('#btn-again');
  if (again) again.onclick = () => handlers.onRestart && handlers.onRestart();
  shot.onclick = () => {
    if (downloadCard()) setHint('Screenshot saved!');
  };
  share.onclick = () => {
    menu.hidden = !menu.hidden;
  };
  els.screen.querySelector('#share-ig').onclick = async () => {
    if (!(await tryNativeShare())) appFallback('Instagram', 'https://www.instagram.com');
  };
  els.screen.querySelector('#share-tt').onclick = async () => {
    if (!(await tryNativeShare())) appFallback('TikTok', 'https://www.tiktok.com');
  };
  els.screen.querySelector('#share-x').onclick = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(challengeUrl(score))}`;
    window.open(url, '_blank', 'noopener');
  };
  els.screen.querySelector('#share-link').onclick = async () => {
    await copyLink();
    setHint('Challenge link copied — send it to a friend!');
  };
}

// Restart a CSS animation from frame 0 even if it's mid-flight.
function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
