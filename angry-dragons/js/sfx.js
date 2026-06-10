// Tiny WebAudio synth used as placeholder sound effects.
// Swap these implementations for real samples later if desired.
let ctx = null;

function audio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone({ freq = 440, end = 0, dur = 0.2, type = 'sine', vol = 0.12, delay = 0 }) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(end || freq, 1), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
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
  },
  damage() {
    tone({ freq: 160, end: 55, dur: 0.3, type: 'square', vol: 0.1 });
  },
  gameover() {
    tone({ freq: 220, end: 70, dur: 0.9, type: 'sawtooth', vol: 0.1 });
  },
  finish() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.25, delay: i * 0.12, vol: 0.1 }));
  },
};
