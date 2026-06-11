import { CONFIG } from './config.js';
import { game } from './gameState.js';
import { toggleMusicMute, toggleSfxMute, musicMuted, sfxMuted } from './sfx.js';
import { comboTier } from './util.js';

let els = {};
let handlers = {};

const isTouch = () =>
  (globalThis.matchMedia && matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in globalThis;

const ICONS = {
  ig:   '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.3" fill="currentColor"/></svg>',
  x:    '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2z"/></svg>',
  tt:   '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.77a5.76 5.76 0 0 0-.77-.05 5.66 5.66 0 1 0 5.66 5.66V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.22-1.48z"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.6 13.4a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.6l-1.2 1.2"/><path d="M13.4 10.6a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.6l1.2-1.2"/></svg>',
  music:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  musicOff: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="3" x2="22" y2="21"/></svg>',
  sfxOn:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  sfxOff:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
};

// Popup text IDs used across multiple popups
let popupTimer = null;
let lastCombo = 1;

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
        <div class="hint">Hold SPACE to boost · rings, windows &amp; orbs refill it</div>
      </div>
      <div class="hud-top-right">
        <div class="score" id="score">0</div>
        <div class="combo" id="combo" data-tier="0"><span class="combo-x" id="combo-x">×1.00</span><span class="combo-word">COMBO</span></div>
        <div class="dist" id="dist">0 m</div>
        <div class="best" id="best"></div>
      </div>
      <div class="audio-btns">
        <button class="mute-btn" id="music-btn" title="Toggle music">${ICONS.music}</button>
        <button class="mute-btn" id="sfx-btn" title="Toggle sound effects">${ICONS.sfxOn}</button>
      </div>
      <div class="popup" id="popup"></div>
      <div class="popup popup2" id="popup2"></div>
      <div class="vignette" id="vignette"></div>
      <div class="blue-flash" id="blue-flash"></div>
      <div class="fever-overlay" id="fever-overlay"></div>
      <div class="screen" id="screen"></div>
    `;
    document.body.appendChild(root);
    els = {
      health:       root.querySelector('#health-fill'),
      stamina:      root.querySelector('#stamina-fill'),
      score:        root.querySelector('#score'),
      combo:        root.querySelector('#combo'),
      comboX:       root.querySelector('#combo-x'),
      dist:         root.querySelector('#dist'),
      best:         root.querySelector('#best'),
      popup:        root.querySelector('#popup'),
      popup2:       root.querySelector('#popup2'),
      vignette:     root.querySelector('#vignette'),
      blueFlash:    root.querySelector('#blue-flash'),
      feverOverlay: root.querySelector('#fever-overlay'),
      screen:       root.querySelector('#screen'),
      musicBtn:     root.querySelector('#music-btn'),
      sfxBtn:       root.querySelector('#sfx-btn'),
    };

    // Music / SFX mute buttons (muted state persists across sessions)
    const paintMusicBtn = (muted) => {
      els.musicBtn.innerHTML = muted ? ICONS.musicOff : ICONS.music;
      els.musicBtn.classList.toggle('off', muted);
    };
    const paintSfxBtn = (muted) => {
      els.sfxBtn.innerHTML = muted ? ICONS.sfxOff : ICONS.sfxOn;
      els.sfxBtn.classList.toggle('off', muted);
    };
    paintMusicBtn(musicMuted);
    paintSfxBtn(sfxMuted);
    els.musicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      paintMusicBtn(toggleMusicMute());
    });
    els.sfxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      paintSfxBtn(toggleSfxMute());
    });
  },

  update(player) {
    els.health.style.width  = `${(game.health / CONFIG.healthMax) * 100}%`;
    els.stamina.style.width = `${(game.stamina / CONFIG.staminaMax) * 100}%`;
    els.stamina.classList.toggle('depleted', game.stamina <= 0.5);
    els.score.textContent = Math.floor(game.score);

    // Score pulses while boosting, warms with combo, glows pink during fever
    els.score.classList.toggle('boost-pulse', player.boosting);
    els.score.classList.toggle('fever', game.feverActive);
    const tier = game.feverActive ? 5 : comboTier(game.combo);
    els.score.dataset.tier = tier;

    // Combo: intensity tiers escalate the styling; fever overrides everything
    els.comboX.textContent = `×${game.combo.toFixed(2)}`;
    els.combo.dataset.tier = tier;
    if (game.combo > lastCombo + 0.001) restartAnim(els.comboX, 'combo-pop');
    lastCombo = game.combo;

    els.dist.textContent  = `${Math.floor(player.dist)} m`;
    els.best.textContent  = game.highScore > 0 ? `BEST ${game.highScore}` : '';

    // Fever overlay pulse
    els.feverOverlay.classList.toggle('active', game.feverActive);
  },

  ringPopup(points, perfect) {
    this._popup(perfect ? `+${points} PERFECT!` : `+${points}`, perfect ? 'gold' : 'green');
  },

  nearMissPopup(points) {
    this._popup2(`NEAR MISS +${points}`, 'orange');
  },

  gatePopup(points) {
    this._popup(`THREADED +${points}`, 'cyan');
  },

  milestonePopup(metres) {
    this._popup2(`${metres} m!`, 'gold');
  },

  recordPopup() {
    this._popup('★ NEW RECORD ★', 'gold');
  },

  comboBreak() {
    this._popup('COMBO LOST', 'red');
  },

  orbFlash() {
    this._popup('SPEED SURGE!', 'cyan');
    restartAnim(els.blueFlash, 'flash-anim');
  },

  feverStart() {
    this._popup('DRAGON SURGE!', 'fever');
  },

  damageFlash(lethal = false) {
    els.vignette.classList.toggle('lethal', lethal);
    restartAnim(els.vignette, 'flash-anim');
  },

  _popup(text, color) {
    els.popup.textContent = text;
    els.popup.dataset.color = color;
    restartAnim(els.popup, 'popup-anim');
  },

  _popup2(text, color) {
    els.popup2.textContent = text;
    els.popup2.dataset.color = color;
    restartAnim(els.popup2, 'popup2-anim');
  },

  showScreen(type) {
    const score = Math.floor(game.score);
    const dist  = Math.floor(game.distance);
    let html = '';

    if (type === 'start') {
      const touch = isTouch();
      const controls = touch
        ? `<li><b>Drag</b> anywhere — steer</li>
           <li><b>Hold a second finger</b> — boost (drains stamina; rings refill it)</li>`
        : `<li><b>W/A/S/D</b> or <b>Arrows</b> — steer</li>
           <li><b>Hold SPACE</b> — boost (drains stamina; rings refill it)</li>`;
      html = `
        <h1>DRAGON DRIFT</h1>
        ${game.challengeScore ? `<p class="challenge">CHALLENGE — beat ${game.challengeScore} points!</p>` : ''}
        <p class="sub">The canyon never ends. It only gets meaner. Fly as far as you can.</p>
        ${game.highScore ? `<p class="sub">Your best: <b>${game.highScore}</b> pts · ${game.bestDistance} m</p>` : ''}
        <ul>
          ${controls}
          <li><span class="cg">Green rings</span> &amp; <span class="c">crystal windows</span> build your combo. Hit ${CONFIG.feverThreshold} in a row = <span class="cf">DRAGON SURGE</span></li>
          <li><span class="c">Blue orbs</span> = free boost · chain rings, windows &amp; orbs to <b>boost forever</b></li>
          <li>Squeeze past obstacles for near-miss bonuses. <b>Side walls end your flight instantly.</b></li>
        </ul>
        <p class="action">${touch ? 'Tap to take off' : 'Press ENTER to take off'}</p>`;

    } else if (type === 'gameover') {
      const causeText = {
        wall:   'FLEW INTO THE CANYON WALL',
        gate:   'CLIPPED THE CRYSTAL WINDOW',
        shard:  'SHATTERED BY AN ICE SHARD',
        pillar: 'IMPALED ON AN ICE SPIKE',
        bar:    'SMASHED INTO AN ICE BEAM',
        ground: 'GROUND DOWN TO ZERO',
      }[game.deathCause] || '';
      const pb    = game.highScore;
      const gap   = pb > score ? pb - score : 0;
      const pct   = pb > 0 && gap > 0 ? Math.round((1 - gap / pb) * 100) : null;
      const maxSpd = Math.round(game.maxSpeed);
      html = `
        <h1 class="bad">CRASHED!</h1>
        ${causeText ? `<p class="death-cause">${causeText}</p>` : ''}
        ${game.isNewHighScore  ? '<p class="newbest">★ NEW HIGH SCORE ★</p>' : ''}
        ${game.isNewBestDistance && !game.isNewHighScore ? '<p class="newbest">★ LONGEST FLIGHT ★</p>' : ''}
        <p class="sub big"><b>${score}</b> points</p>
        ${pb > 0 ? `<p class="sub">Personal best: <b>${pb}</b></p>` : ''}
        ${gap > 0 ? `<p class="sub gap">Only <b>${gap}</b> pts away from your best${pct !== null ? ` (${pct}% there!)` : ''}</p>` : ''}
        ${challengeResult(score)}
        <div class="run-stats">
          <div class="stat"><span class="stat-val">${dist} m</span><span class="stat-lbl">distance</span></div>
          <div class="stat"><span class="stat-val">${game.ringsCollected}</span><span class="stat-lbl">rings</span></div>
          <div class="stat"><span class="stat-val">${game.perfectRings}</span><span class="stat-lbl">perfect</span></div>
          <div class="stat"><span class="stat-val">${game.maxCombo.toFixed(2)}x</span><span class="stat-lbl">best combo</span></div>
          <div class="stat"><span class="stat-val">${game.nearMisses}</span><span class="stat-lbl">near misses</span></div>
          <div class="stat"><span class="stat-val">${game.speedOrbsCollected}</span><span class="stat-lbl">orbs</span></div>
          <div class="stat"><span class="stat-val">${maxSpd}</span><span class="stat-lbl">top speed</span></div>
          <div class="stat"><span class="stat-val">${game.time.toFixed(1)}s</span><span class="stat-lbl">time</span></div>
        </div>
        <div class="action-row">
          <button id="btn-again" class="btn-primary">FLY AGAIN</button>
          <button id="btn-share" class="btn-secondary">SHARE &amp; CHALLENGE</button>
        </div>
        <div class="share-menu" id="share-menu" hidden>
          <button id="share-ig"   title="Instagram">${ICONS.ig}</button>
          <button id="share-x"    title="X">${ICONS.x}</button>
          <button id="share-tt"   title="TikTok">${ICONS.tt}</button>
          <button id="share-link" title="Copy challenge link">${ICONS.link}</button>
        </div>
        <p class="share-hint" id="share-hint"></p>
        ${isTouch() ? '' : '<p class="action-key">or press R to retry</p>'}`;
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
    ? `<p class="challenge won">CHALLENGE BEATEN! (beat ${game.challengeScore})</p>`
    : `<p class="challenge">Challenge: ${game.challengeScore} — not this time!</p>`;
}

function challengeUrl(score) {
  return `${location.origin}${location.pathname}?challenge=${score}`;
}

function wireShareButtons(score, dist) {
  const share = els.screen.querySelector('#btn-share');
  const menu  = els.screen.querySelector('#share-menu');
  const hint  = els.screen.querySelector('#share-hint');

  const shareText = buildShareText(score, dist);
  const setHint = (t) => (hint.textContent = t);

  const downloadCard = () => {
    const card = handlers.getCard && handlers.getCard();
    if (!card) return false;
    const a = document.createElement('a');
    a.download = `dragon-drift-${score}.png`;
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

  const tryNativeShare = async () => {
    try {
      const card = handlers.getCard && handlers.getCard();
      if (!card || !navigator.canShare) return false;
      const blob = await new Promise(res => card.toBlob(res, 'image/png'));
      const file = new File([blob], 'dragon-drift.png', { type: 'image/png' });
      const data = { files: [file], text: `${shareText}\n${challengeUrl(score)}` };
      if (!navigator.canShare(data)) return false;
      await navigator.share(data);
      return true;
    } catch { return false; }
  };

  const appFallback = async (label, site) => {
    downloadCard();
    await copyLink();
    setHint(`Screenshot saved & challenge link copied — paste into your ${label} post!`);
    window.open(site, '_blank', 'noopener');
  };

  const again = els.screen.querySelector('#btn-again');
  if (again) again.onclick = () => handlers.onRestart && handlers.onRestart();

  share.onclick = () => { menu.hidden = !menu.hidden; };

  els.screen.querySelector('#share-ig').onclick   = async () => { if (!(await tryNativeShare())) appFallback('Instagram', 'https://www.instagram.com'); };
  els.screen.querySelector('#share-tt').onclick   = async () => { if (!(await tryNativeShare())) appFallback('TikTok', 'https://www.tiktok.com'); };
  els.screen.querySelector('#share-x').onclick    = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(challengeUrl(score))}`;
    window.open(url, '_blank', 'noopener');
  };
  els.screen.querySelector('#share-link').onclick = async () => {
    await copyLink();
    setHint('Challenge link copied — send it to a friend!');
  };
}

function buildShareText(score, dist) {
  const seed = CONFIG.seed;
  return [
    `I scored ${score.toLocaleString()} in Dragon Drift 🐉`,
    `Can you beat my canyon?`,
    ``,
    `Seed: Frost-${seed}`,
    `Combo: ${game.maxCombo.toFixed(2)}x · Perfect Rings: ${game.perfectRings} · Near Misses: ${game.nearMisses}`,
  ].join('\n');
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
