// Dragon Drift audio engine.
// Procedural chiptune-pop music reacts to gameplay.
// Layer unlock order: bass+melody always → arpeggio on boost →
// high-lead on combo≥2 → percussion on combo≥3 → fever sparkle on surge.

let ctx = null;
let masterGain = null;
let musicBus = null; // all music layers route here (independent mute)
let sfxBus = null;   // all one-shot sound effects route here

function loadMutePref(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function saveMutePref(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch {}
}

export let musicMuted = loadMutePref('dragonDriftMusicMuted');
export let sfxMuted = loadMutePref('dragonDriftSfxMuted');

// iOS routes Web Audio through the "ambient" session by default, which the
// hardware silent switch mutes. Ask for a "playback" session where supported.
try {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
} catch { /* not supported */ }

function getCtx() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicMuted ? 0 : 1;
      musicBus.connect(masterGain);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxMuted ? 0 : 1;
      sfxBus.connect(masterGain);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

// Even with a running AudioContext, iOS routes Web Audio through the
// "ambient" session, which the hardware mute switch silences — and most iOS
// versions don't support navigator.audioSession above. A *playing* HTML
// media element flips the session to "playback" (ignores the mute switch),
// so loop a tiny silent clip alongside the game audio. (unmute.js trick)
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
let silentMedia = null;
function ensureSilentMedia() {
  if (!silentMedia) {
    try {
      silentMedia = new Audio(SILENT_WAV);
      silentMedia.loop = true;
      silentMedia.setAttribute('playsinline', '');
    } catch { return; }
  }
  if (silentMedia.paused) {
    const p = silentMedia.play();
    if (p && p.catch) p.catch(() => {});
  }
}

// Background pause: while true, all buses are silenced and the scheduler is
// stopped. Audio only comes back through music.resumeFromBackground(), which
// must be driven by a user gesture — never auto-resume on visibilitychange.
let backgroundPaused = false;

// iOS/WebKit only unlocks audio from a *completed* gesture (touchend/click);
// the game's pointerdown handlers alone are not enough. Resume the context on
// any finished gesture, and kick output with a silent buffer for older iOS.
function unlockAudio() {
  // Any completed gesture while visible also counts as the "tap to resume"
  // for audio silenced by backgrounding.
  if (backgroundPaused) {
    if (document.hidden) return;
    music.resumeFromBackground();
  }
  ensureSilentMedia();
  const a = getCtx();
  if (!a || a.state === 'running') return;
  a.resume();
  try {
    const src = a.createBufferSource();
    src.buffer = a.createBuffer(1, 1, 22050);
    src.connect(a.destination);
    src.start(0);
  } catch { /* ignore */ }
}
for (const evt of ['touchend', 'pointerup', 'click', 'keydown']) {
  window.addEventListener(evt, unlockAudio, { passive: true });
}

// Backgrounding the tab (app switch, phone call, lock screen) must stop all
// sound immediately. Deliberately no auto-resume on becoming visible again —
// the game shows TAP TO RESUME and resumes from that gesture.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) music.pauseForBackground();
});

export function toggleMusicMute() {
  musicMuted = !musicMuted;
  saveMutePref('dragonDriftMusicMuted', musicMuted);
  const a = getCtx();
  if (a && musicBus) musicBus.gain.setTargetAtTime(musicMuted ? 0 : 1, a.currentTime, 0.08);
  return musicMuted;
}

export function toggleSfxMute() {
  sfxMuted = !sfxMuted;
  saveMutePref('dragonDriftSfxMuted', sfxMuted);
  const a = getCtx();
  if (a && sfxBus) sfxBus.gain.setTargetAtTime(sfxMuted ? 0 : 1, a.currentTime, 0.08);
  return sfxMuted;
}

// --- Noise helper: one cached 2s white-noise buffer, one-shot sources ---
let noiseBuffer = null;
function getNoiseBuffer(a) {
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Filtered noise burst (whooshes, impacts).
function noiseWhoosh({ from = 800, to = 3000, dur = 0.25, vol = 0.12, q = 1.2, delay = 0 }) {
  const a = getCtx();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = getNoiseBuffer(a);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t0);
  bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// --- SFX helpers ---
function tone({ freq = 440, end = 0, dur = 0.2, type = 'sine', vol = 0.12, delay = 0 }) {
  const a = getCtx();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  // Glassy ice-bell pluck: pure fundamental + bright inharmonic partial
  ring(combo = 1) {
    const f = 700 + combo * 60;
    tone({ freq: f, end: f * 1.5, dur: 0.16, vol: 0.13 });
    tone({ freq: f * 2.76, dur: 0.22, type: 'sine', vol: 0.07 });
    tone({ freq: 1480, dur: 0.1, type: 'triangle', vol: 0.05, delay: 0.04 });
  },
  orb() {
    tone({ freq: 300, end: 950, dur: 0.3, type: 'sawtooth', vol: 0.08 });
    tone({ freq: 600, end: 1900, dur: 0.2, type: 'triangle', vol: 0.05, delay: 0.1 });
  },
  damage() {
    tone({ freq: 160, end: 55, dur: 0.3, type: 'square', vol: 0.1 });
  },
  crash() {
    tone({ freq: 180, end: 30, dur: 0.8, type: 'sawtooth', vol: 0.15 });
    tone({ freq: 90, end: 20, dur: 1.0, type: 'square', vol: 0.1, delay: 0.05 });
    for (let i = 0; i < 5; i++) {
      tone({ freq: 500 + i * 350, end: 120, dur: 0.28, type: 'triangle', vol: 0.07, delay: i * 0.055 });
    }
  },
  boostStart() {
    tone({ freq: 200, end: 600, dur: 0.3, type: 'sawtooth', vol: 0.07 });
    noiseWhoosh({ from: 300, to: 1600, dur: 0.35, vol: 0.08 });
  },
  // Whipping air whoosh as something deadly slides past
  nearMiss() {
    noiseWhoosh({ from: 700, to: 3200, dur: 0.22, vol: 0.16, q: 1.6 });
    tone({ freq: 880, end: 1320, dur: 0.12, type: 'triangle', vol: 0.07, delay: 0.04 });
  },
  feverStart() {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
      tone({ freq: f, end: f * 1.5, dur: 0.3, type: 'square', vol: 0.1, delay: i * 0.09 }));
    tone({ freq: 1046.50, end: 2093, dur: 0.5, type: 'sawtooth', vol: 0.08, delay: 0.38 });
  },
  comboBreak() {
    tone({ freq: 440, end: 200, dur: 0.35, type: 'square', vol: 0.08 });
  },
  gate() {
    tone({ freq: 520, end: 1040, dur: 0.16, type: 'triangle', vol: 0.13 });
    tone({ freq: 780, end: 1560, dur: 0.18, type: 'square', vol: 0.06, delay: 0.06 });
  },
  // Rising jingle when the combo crosses an intensity tier — higher tier,
  // higher pitch.
  comboUp(tier) {
    const base = 600 + tier * 150;
    tone({ freq: base, dur: 0.09, type: 'square', vol: 0.09 });
    tone({ freq: base * 1.25, dur: 0.09, type: 'square', vol: 0.09, delay: 0.07 });
    tone({ freq: base * 1.5, end: base * 2, dur: 0.16, type: 'square', vol: 0.1, delay: 0.14 });
  },
  milestone() {
    [660, 880, 1320].forEach((f, i) =>
      tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.1, delay: i * 0.07 }));
  },
  record() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone({ freq: f, end: f * 1.2, dur: 0.22, type: 'square', vol: 0.09, delay: i * 0.08 }));
  },
};

// --- Music engine ---
// Bright C major over the classic I–V–vi–IV pop loop (C–G–Am–F), twice per
// 8-bar loop: bars 1-4 state the hook, bars 5-8 lift it an octave-ish for
// the soaring "takeoff" feel. Note frequencies (Hz):
const N = {
  F2:87.31, G2:98.00, A2:110.00,
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
  C6:1046.50, D6:1174.66, E6:1318.51,
};

const BPM = 160;
const E8 = 60 / BPM / 2; // eighth-note duration = 0.1875s
// 8 bars × 4 beats × 2 eighths = 64 eighth notes total per loop

// Each entry: [freq_hz, duration_in_eighth_notes]  (0 = rest)
const MELODY_SEQ = [
  // Bar 1 (C) – anthem hook: do-mi-sol-do leap
  [N.E5,1],[0,1],[N.G5,1],[0,1],[N.C6,2],[N.G5,2],
  // Bar 2 (G) – falling answer
  [N.A5,1],[N.G5,1],[0,1],[N.E5,1],[N.D5,2],[0,2],
  // Bar 3 (Am) – hook echoed in minor
  [N.C5,1],[0,1],[N.E5,1],[0,1],[N.A5,2],[N.G5,1],[N.E5,1],
  // Bar 4 (F) – climb back home
  [N.F5,1],[N.G5,1],[N.A5,2],[N.G5,2],[N.E5,1],[N.D5,1],
  // Bar 5 (C) – second pass takes off
  [N.G5,1],[0,1],[N.E5,1],[N.G5,1],[N.C6,2],[N.D6,2],
  // Bar 6 (G) – peak and cascade
  [N.E6,1],[N.D6,1],[N.C6,2],[N.B5,2],[N.G5,2],
  // Bar 7 (Am) – soar again
  [N.A5,1],[0,1],[N.C6,1],[0,1],[N.E6,2],[N.D6,1],[N.C6,1],
  // Bar 8 (F) – swing up to relaunch the hook
  [N.A5,1],[N.G5,1],[N.F5,1],[N.G5,1],[N.A5,2],[N.B5,2],
];

// Driving octave-pump bass: root/octave eighths under each chord
const BASS_SEQ = [];
for (const root of [N.C3, N.G2, N.A2, N.F2, N.C3, N.G2, N.A2, N.F2]) {
  for (let i = 0; i < 4; i++) BASS_SEQ.push([root, 1], [root * 2, 1]);
}

// High countermelody: silent bars 1-4, harmonizes the lift in bars 5-8
const HIGH_SEQ = [
  [0,8],[0,8],[0,8],[0,8],
  [N.G5,2],[N.E5,2],[N.G5,2],[N.C6,2],
  [N.B5,2],[N.G5,2],[N.D5,2],[N.G5,2],
  [N.A5,2],[N.E5,2],[N.C6,2],[N.E6,2],
  [N.C6,2],[N.A5,2],[N.F5,2],[N.G5,2],
];

// Boost arpeggios: one chord shape per bar (16th notes = E8/2), indexed
// bar % 4 → C, G, Am, F. Fever sparkle plays the same shapes an octave up.
const ARPS = [
  [N.C4, N.E4, N.G4, N.C5, N.E5, N.C5, N.G4, N.E4], // C
  [N.B3, N.D4, N.G4, N.B4, N.D5, N.B4, N.G4, N.D4], // G
  [N.A3, N.C4, N.E4, N.A4, N.C5, N.A4, N.E4, N.C4], // Am
  [N.A3, N.C4, N.F4, N.A4, N.C5, N.A4, N.F4, N.C4], // F
];

// --- Layer gain nodes ---
let layers = {};       // keyed: bass, melody, high, arp, perc, fever
let events = [];       // flattened note events sorted by time-offset
let musicActive = false;
let loopOffset = 0;    // absolute audioCtx time when current loop started
let nextEvtIdx = 0;
let schedulerTimer = null;
const LOOK_AHEAD = 0.4; // schedule this many seconds ahead
const SCHED_INTERVAL = 100; // ms between scheduler runs

const LOOP_LEN = 64 * E8; // total loop duration in seconds

// Boost wind: looped filtered noise under the arpeggio. Kept stoppable so
// background pause can kill the looping source outright.
let windSrc = null;

function startWind() {
  const a = getCtx();
  if (!a || !layers.wind || windSrc) return;
  windSrc = a.createBufferSource();
  windSrc.buffer = getNoiseBuffer(a);
  windSrc.loop = true;
  const windFilter = a.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 420;
  windSrc.connect(windFilter).connect(layers.wind);
  windSrc.start();
}

function stopWind() {
  if (!windSrc) return;
  try { windSrc.stop(); windSrc.disconnect(); } catch { /* already stopped */ }
  windSrc = null;
}

function seqToEvents(seq, layerKey, oscType, vol, durMult = 0.85, freqMult = 1) {
  const out = [];
  let t = 0;
  for (const [freq, dur] of seq) {
    if (freq > 0) out.push({ t, freq: freq * freqMult, durS: dur * E8 * durMult, layer: layerKey, osc: oscType, vol });
    t += dur * E8;
  }
  return out;
}

function buildEvents() {
  const all = [
    ...seqToEvents(MELODY_SEQ, 'melody', 'square', 0.16),
    ...seqToEvents(BASS_SEQ,   'bass',   'triangle', 0.22, 0.88),
    ...seqToEvents(HIGH_SEQ,   'high',   'triangle', 0.13),
    // Dragon Surge lead: the hook an octave up on a screaming saw
    ...seqToEvents(MELODY_SEQ, 'feverlead', 'sawtooth', 0.11, 0.8, 2),
  ];

  const e16 = E8 / 2;
  for (let bar = 0; bar < 8; bar++) {
    const barStart = bar * 8 * E8;
    const arp = ARPS[bar % 4];                          // follow the chord
    for (let cycle = 0; cycle < 2; cycle++) {           // 2 × 8-note cycles per bar
      const cycleStart = barStart + cycle * 4 * E8;
      for (let i = 0; i < arp.length; i++) {
        all.push({ t: cycleStart + i * e16, freq: arp[i], durS: e16 * 0.65, layer: 'arp', osc: 'sawtooth', vol: 0.09 });
        all.push({ t: cycleStart + i * e16, freq: arp[i] * 2, durS: e16 * 0.55, layer: 'fever', osc: 'triangle', vol: 0.08 });
      }
    }
    // Percussion: four-on-the-floor kick, backbeat snare, hat on every 8th
    const BEAT = 2 * E8;
    for (let beat = 0; beat < 4; beat++) {
      const bt = barStart + beat * BEAT;
      all.push({ t: bt, special: 'kick', layer: 'perc' });
      if (beat % 2 === 1) all.push({ t: bt, special: 'snare', layer: 'perc' });
      all.push({ t: bt,      special: 'hat', layer: 'perc' });
      all.push({ t: bt + E8, special: 'hat', layer: 'perc' });
      // Heavy layer at combo >= 3: deeper kick doubled, clap on backbeat
      all.push({ t: bt, special: 'kick2', layer: 'perc2' });
      if (beat % 2 === 1) all.push({ t: bt, special: 'clap', layer: 'perc2' });
    }
  }

  all.sort((a, b) => a.t - b.t);
  return all;
}

function makeLayer() {
  const a = getCtx();
  if (!a) return null;
  const g = a.createGain();
  g.gain.value = 0;
  g.connect(musicBus);
  return g;
}

function playNoteEvent(ev, absTime) {
  const a = getCtx();
  if (!a) return;
  const layerGain = layers[ev.layer];
  if (!layerGain) return;

  if (ev.special) {
    // Chiptune drums
    const osc = a.createOscillator();
    const g = a.createGain();
    if (ev.special === 'kick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, absTime);
      osc.frequency.exponentialRampToValueAtTime(28, absTime + 0.09);
      g.gain.setValueAtTime(0.45, absTime);
      g.gain.exponentialRampToValueAtTime(0.001, absTime + 0.10);
    } else if (ev.special === 'kick2') {
      // Deeper, longer kick layered under the main one
      osc.type = 'sine';
      osc.frequency.setValueAtTime(85, absTime);
      osc.frequency.exponentialRampToValueAtTime(22, absTime + 0.14);
      g.gain.setValueAtTime(0.5, absTime);
      g.gain.exponentialRampToValueAtTime(0.001, absTime + 0.16);
    } else if (ev.special === 'clap') {
      // Noise clap stacked on the snare backbeat
      const src = a.createBufferSource();
      src.buffer = getNoiseBuffer(a);
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600;
      bp.Q.value = 1.4;
      g.gain.setValueAtTime(0.3, absTime);
      g.gain.exponentialRampToValueAtTime(0.001, absTime + 0.08);
      src.connect(bp).connect(g).connect(layerGain);
      src.start(absTime);
      src.stop(absTime + 0.1);
      return;
    } else if (ev.special === 'snare') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, absTime);
      osc.frequency.exponentialRampToValueAtTime(110, absTime + 0.05);
      g.gain.setValueAtTime(0.18, absTime);
      g.gain.exponentialRampToValueAtTime(0.001, absTime + 0.06);
    } else { // hat
      osc.type = 'square';
      osc.frequency.value = 3200;
      g.gain.setValueAtTime(0.055, absTime);
      g.gain.exponentialRampToValueAtTime(0.001, absTime + 0.025);
    }
    osc.connect(g).connect(layerGain);
    osc.start(absTime);
    osc.stop(absTime + 0.12);
    return;
  }

  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = ev.osc;
  osc.frequency.value = ev.freq;
  const att = 0.008;
  const rel = Math.min(ev.durS * 0.2, 0.03);
  g.gain.setValueAtTime(0, absTime);
  g.gain.linearRampToValueAtTime(ev.vol, absTime + att);
  g.gain.setValueAtTime(ev.vol, absTime + ev.durS - rel);
  g.gain.exponentialRampToValueAtTime(0.0001, absTime + ev.durS);
  osc.connect(g).connect(layerGain);
  osc.start(absTime);
  osc.stop(absTime + ev.durS + 0.02);
}

function runScheduler() {
  const a = getCtx();
  if (!a || !musicActive) return;
  const now = a.currentTime;
  const horizon = now + LOOK_AHEAD;

  // Tab throttling can leave us several loops behind — skip ahead instead
  // of replaying every missed event into the safety cap.
  if (now - loopOffset > LOOP_LEN * 2) {
    loopOffset = now;
    nextEvtIdx = 0;
  }

  // Walk through events; when we reach end of loop, wrap to next loop
  let safety = 0;
  while (safety++ < 3000) {
    const ev = events[nextEvtIdx];
    const absTime = loopOffset + ev.t;

    if (absTime > horizon) break;

    if (absTime >= now - 0.01) { // allow tiny past tolerance
      playNoteEvent(ev, absTime);
    }

    nextEvtIdx++;
    if (nextEvtIdx >= events.length) {
      nextEvtIdx = 0;
      loopOffset += LOOP_LEN;
    }
  }
}

export const music = {
  start() {
    const a = getCtx();
    if (!a || musicActive) return;
    musicActive = true;
    events = buildEvents();

    layers = {
      bass:      makeLayer(),
      melody:    makeLayer(),
      high:      makeLayer(),
      arp:       makeLayer(),
      perc:      makeLayer(),
      perc2:     makeLayer(),
      fever:     makeLayer(),
      feverlead: makeLayer(),
      wind:      makeLayer(),
    };

    // Permanently-on layers
    layers.bass.gain.value   = 1;
    layers.melody.gain.value = 1;

    // Echo: dotted-eighth delay with filtered feedback. Sends tap the layer
    // gains so fading a layer also fades its echoes.
    const delay = a.createDelay(1);
    delay.delayTime.value = E8 * 1.5; // dotted eighth at 160 BPM
    const feedback = a.createGain();
    feedback.gain.value = 0.3;
    const echoFilter = a.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 2000;
    const echoOut = a.createGain();
    echoOut.gain.value = 0.4;
    delay.connect(echoFilter).connect(feedback).connect(delay);
    delay.connect(echoOut).connect(musicBus);
    layers.melody.connect(delay);
    layers.high.connect(delay);
    layers.feverlead.connect(delay);

    startWind();

    loopOffset = a.currentTime + 0.05;
    nextEvtIdx = 0;
    runScheduler();
    schedulerTimer = setInterval(runScheduler, SCHED_INTERVAL);
  },

  stop() {
    musicActive = false;
    clearInterval(schedulerTimer);
    stopWind();
  },

  // Hard-silence everything the moment the app is backgrounded: stop the
  // scheduler, kill looping sources, zero both buses, pause the silent iOS
  // media element, and suspend the context. No auto-resume — audio comes
  // back only via resumeFromBackground() from a user gesture.
  pauseForBackground() {
    backgroundPaused = true;
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    if (silentMedia) silentMedia.pause();
    stopWind();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const bus of [musicBus, sfxBus]) {
      if (!bus) continue;
      bus.gain.cancelScheduledValues(now);
      bus.gain.value = 0;
    }
    if (ctx.state === 'running') {
      const p = ctx.suspend();
      if (p && p.catch) p.catch(() => {});
    }
  },

  // Restore audio after a background pause. Must be called from a user
  // gesture. Restarts the music loop cleanly from "now" instead of
  // fast-forwarding through everything missed while backgrounded.
  resumeFromBackground() {
    if (!backgroundPaused) return;
    backgroundPaused = false;
    const a = getCtx(); // also resumes a suspended context
    if (!a) return;
    ensureSilentMedia();
    musicBus.gain.setTargetAtTime(musicMuted ? 0 : 1, a.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(sfxMuted ? 0 : 1, a.currentTime, 0.05);
    if (musicActive) {
      startWind();
      loopOffset = a.currentTime + 0.05;
      nextEvtIdx = 0;
      runScheduler();
      schedulerTimer = setInterval(runScheduler, SCHED_INTERVAL);
    }
  },

  // Called every frame from main.js to fade layers in/out.
  update(game, player) {
    if (!musicActive || !layers.bass) return;
    const a = getCtx();
    if (!a) return;
    const now = a.currentTime;
    const FAST = 0.15;
    const SLOW = 0.5;

    // Layers come in earlier so the track builds with the very first combos
    layers.arp.gain.setTargetAtTime(player.boosting ? 1 : 0, now, FAST);
    layers.wind.gain.setTargetAtTime(player.boosting ? 0.35 : 0, now, FAST);
    layers.high.gain.setTargetAtTime(game.combo >= 1.5 ? 1 : 0, now, SLOW);
    layers.perc.gain.setTargetAtTime(game.combo >= 2 ? 1 : 0, now, FAST);
    layers.perc2.gain.setTargetAtTime(game.combo >= 3 ? 1 : 0, now, FAST);
    layers.fever.gain.setTargetAtTime(game.feverActive ? 1 : 0, now, FAST);
    layers.feverlead.gain.setTargetAtTime(game.feverActive ? 1 : 0, now, FAST);

    // Slightly louder music during fever
    if (!musicMuted) {
      musicBus.gain.setTargetAtTime(game.feverActive ? 1.2 : 1.0, now, SLOW);
    }
  },
};
