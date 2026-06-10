// Dragon Drift audio engine.
// Procedural chiptune-synthwave music reacts to gameplay.
// Layer unlock order: bass+melody always → arpeggio on boost →
// high-lead on combo≥2 → percussion on combo≥3 → fever sparkle on surge.

let ctx = null;
let masterGain = null;
export let musicMuted = false;

function getCtx() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

export function toggleMute() {
  musicMuted = !musicMuted;
  const a = getCtx();
  if (a && masterGain) masterGain.gain.setTargetAtTime(musicMuted ? 0 : 1, a.currentTime, 0.08);
  return musicMuted;
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
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  ring(combo = 1) {
    tone({ freq: 700 + combo * 60, end: 1100 + combo * 60, dur: 0.18, vol: 0.14 });
    tone({ freq: 1480, dur: 0.12, type: 'triangle', vol: 0.06, delay: 0.05 });
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
  },
  nearMiss() {
    tone({ freq: 880, end: 1320, dur: 0.15, type: 'triangle', vol: 0.12 });
    tone({ freq: 660, end: 1320, dur: 0.1, type: 'triangle', vol: 0.06, delay: 0.08 });
  },
  feverStart() {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) =>
      tone({ freq: f, end: f * 1.5, dur: 0.3, type: 'square', vol: 0.1, delay: i * 0.09 }));
    tone({ freq: 1046.50, end: 2093, dur: 0.5, type: 'sawtooth', vol: 0.08, delay: 0.38 });
  },
  comboBreak() {
    tone({ freq: 440, end: 200, dur: 0.35, type: 'square', vol: 0.08 });
  },
};

// --- Music engine ---
// C minor pentatonic: C, Eb, F, G, Bb (and octaves). Key frequencies (Hz):
const N = {
  Bb2:116.54, C3:130.81, Eb3:155.56, F3:174.81, G3:196.00, Bb3:233.08,
  C4:261.63, Eb4:311.13, F4:349.23, G4:392.00, Bb4:466.16,
  C5:523.25, Eb5:622.25, F5:698.46, G5:783.99, Bb5:932.33, C6:1046.50,
};

const BPM = 138;
const E8 = 60 / BPM / 2; // eighth-note duration = 0.2174s
// 8 bars × 4 beats × 2 eighths = 64 eighth notes total per loop

// Each entry: [freq_hz, duration_in_eighth_notes]  (0 = rest)
const MELODY_SEQ = [
  // Bar 1 – rising hook
  [N.C5,1],[0,1],[N.Eb5,1],[0,1],[N.G5,2],[0,2],
  // Bar 2 – falling answer
  [N.F5,1],[N.Eb5,1],[0,1],[N.C5,1],[N.Bb4,1],[0,2],[0,1],
  // Bar 3 – build
  [N.G4,1],[0,1],[N.Bb4,1],[N.C5,1],[N.Eb5,1],[N.F5,1],[N.G5,1],[0,1],
  // Bar 4 – breathe & resolve
  [N.G5,2],[N.Eb5,1],[0,1],[N.C5,2],[0,2],
  // Bar 5 – soar high
  [N.G5,1],[N.Bb5,1],[N.C6,2],[N.Bb5,1],[N.G5,1],[0,2],
  // Bar 6 – cascade
  [N.C6,1],[N.Bb5,1],[N.G5,1],[N.F5,1],[N.Eb5,1],[N.C5,1],[0,2],
  // Bar 7 – drive
  [N.Eb5,1],[N.F5,1],[N.G5,1],[0,1],[N.Bb5,2],[N.G5,2],
  // Bar 8 – return home
  [N.F5,1],[N.Eb5,1],[N.C5,1],[0,1],[N.C5,1],[0,1],[N.C5,2],
];

const BASS_SEQ = [
  [N.C3,2],[0,2],[N.C3,1],[N.Eb3,1],[0,2],          // bar 1 – Cm
  [N.Bb2,2],[0,2],[N.Bb2,1],[0,1],[N.C3,2],           // bar 2 – Bb
  [N.Eb3,2],[0,2],[N.Eb3,1],[N.F3,1],[0,2],           // bar 3 – Eb
  [N.G3,2],[0,2],[N.G3,1],[0,1],[N.Eb3,2],            // bar 4 – G→Eb
  [N.C3,1],[0,1],[N.C3,1],[0,1],[N.Eb3,1],[N.G3,1],[0,2], // bar 5 – pumping
  [N.Bb2,1],[0,1],[N.Bb2,1],[0,1],[N.Bb2,1],[N.C3,1],[0,2], // bar 6
  [N.Eb3,1],[0,1],[N.F3,1],[0,1],[N.Eb3,1],[N.F3,1],[N.G3,1],[0,1], // bar 7
  [N.C3,2],[0,2],[N.C3,4],                             // bar 8 – home
];

// High countermelody: silent bars 1-4, enters with the high section bars 5-8
const HIGH_SEQ = [
  [0,8],[0,8],[0,8],[0,8],
  [N.Bb5,2],[N.C6,2],[N.Bb5,2],[N.G5,2],
  [N.C6,2],[N.Bb5,2],[0,2],[N.G5,2],
  [N.Bb5,2],[N.G5,2],[N.Bb5,2],[N.C6,2],
  [N.Bb5,2],[N.G5,2],[N.F5,2],[0,2],
];

// Arpeggio for boost: Cm chord up and back (16th notes = E8/2)
const ARP = [N.C4, N.Eb4, N.G4, N.Bb4, N.C5, N.Bb4, N.G4, N.Eb4];

// Fever sparkle: high arpeggio
const FEVER_ARP = [N.C5, N.Eb5, N.G5, N.Bb5, N.C6, N.Bb5, N.G5, N.Eb5];

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

function seqToEvents(seq, layerKey, oscType, vol, durMult = 0.85) {
  const out = [];
  let t = 0;
  for (const [freq, dur] of seq) {
    if (freq > 0) out.push({ t, freq, durS: dur * E8 * durMult, layer: layerKey, osc: oscType, vol });
    t += dur * E8;
  }
  return out;
}

function buildEvents() {
  const all = [
    ...seqToEvents(MELODY_SEQ, 'melody', 'square', 0.16),
    ...seqToEvents(BASS_SEQ,   'bass',   'triangle', 0.22, 0.88),
    ...seqToEvents(HIGH_SEQ,   'high',   'triangle', 0.13),
  ];

  const e16 = E8 / 2;
  for (let bar = 0; bar < 8; bar++) {
    const barStart = bar * 8 * E8;
    for (let cycle = 0; cycle < 2; cycle++) {           // 2 × 8-note cycles per bar
      const cycleStart = barStart + cycle * 4 * E8;
      for (let i = 0; i < ARP.length; i++) {
        all.push({ t: cycleStart + i * e16, freq: ARP[i], durS: e16 * 0.65, layer: 'arp', osc: 'sawtooth', vol: 0.09 });
        all.push({ t: cycleStart + i * e16, freq: FEVER_ARP[i], durS: e16 * 0.55, layer: 'fever', osc: 'triangle', vol: 0.08 });
      }
    }
    // Percussion: kick/snare on beats, hat on every 8th
    const BEAT = 2 * E8;
    for (let beat = 0; beat < 4; beat++) {
      const bt = barStart + beat * BEAT;
      all.push({ t: bt,      special: beat % 2 === 0 ? 'kick' : 'snare', layer: 'perc' });
      all.push({ t: bt,      special: 'hat', layer: 'perc' });
      all.push({ t: bt + E8, special: 'hat', layer: 'perc' });
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
  g.connect(masterGain);
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

  // Walk through events; when we reach end of loop, wrap to next loop
  let safety = 0;
  while (safety++ < 800) {
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
      bass:   makeLayer(),
      melody: makeLayer(),
      high:   makeLayer(),
      arp:    makeLayer(),
      perc:   makeLayer(),
      fever:  makeLayer(),
    };

    // Permanently-on layers
    layers.bass.gain.value   = 1;
    layers.melody.gain.value = 1;

    loopOffset = a.currentTime + 0.05;
    nextEvtIdx = 0;
    runScheduler();
    schedulerTimer = setInterval(runScheduler, SCHED_INTERVAL);
  },

  stop() {
    musicActive = false;
    clearInterval(schedulerTimer);
  },

  // Called every frame from main.js to fade layers in/out.
  update(game, player) {
    if (!musicActive || !layers.bass) return;
    const a = getCtx();
    if (!a) return;
    const now = a.currentTime;
    const FAST = 0.15;
    const SLOW = 0.5;

    layers.arp.gain.setTargetAtTime(player.boosting ? 1 : 0, now, FAST);
    layers.high.gain.setTargetAtTime(game.combo >= 2 ? 1 : 0, now, SLOW);
    layers.perc.gain.setTargetAtTime(game.combo >= 3 ? 1 : 0, now, FAST);
    layers.fever.gain.setTargetAtTime(game.feverActive ? 1 : 0, now, FAST);

    // Slightly louder overall during fever
    if (!musicMuted) {
      masterGain.gain.setTargetAtTime(game.feverActive ? 1.15 : 1.0, now, SLOW);
    }
  },
};
