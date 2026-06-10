import { clamp } from './util.js';

// Input state. Keyboard (WASD/arrows + Space) and touch (drag to steer,
// second finger held = boost). Game-flow keys/taps are handled in main.js.
export const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  tx: 0, // touch-drag analog axes, -1..1
  ty: 0,
};

// Combined analog steering axes used by the flight model.
export function getAxes() {
  return {
    x: clamp((input.right ? 1 : 0) - (input.left ? 1 : 0) + input.tx, -1, 1),
    y: clamp((input.up ? 1 : 0) - (input.down ? 1 : 0) + input.ty, -1, 1),
  };
}

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'boost',
};

export function initInput() {
  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (action) {
      input[action] = true;
      e.preventDefault(); // stop arrows/space scrolling the page
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input[action] = false;
  });
}

// Touch controls on the game canvas (not the HUD, so menu buttons still work):
// the first finger is a relative joystick — drag from wherever it landed and
// the dragon steers by the offset. Any additional finger held down = boost.
export function initTouch(el) {
  const SPAN = 110; // px of drag for full deflection
  let steerId = null;
  let baseX = 0;
  let baseY = 0;

  el.addEventListener(
    'touchstart',
    (e) => {
      for (const t of e.changedTouches) {
        if (steerId === null) {
          steerId = t.identifier;
          baseX = t.clientX;
          baseY = t.clientY;
        } else {
          input.boost = true;
        }
      }
      e.preventDefault(); // no scrolling/zooming over the game
    },
    { passive: false }
  );

  el.addEventListener(
    'touchmove',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === steerId) {
          input.tx = clamp((t.clientX - baseX) / SPAN, -1, 1);
          input.ty = clamp(-(t.clientY - baseY) / SPAN, -1, 1); // drag up = fly up
        }
      }
      e.preventDefault();
    },
    { passive: false }
  );

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === steerId) {
        steerId = null;
        input.tx = 0;
        input.ty = 0;
      }
    }
    // Promote a surviving finger to steering so a lifted thumb mid-flight
    // doesn't strand the player.
    const remaining = [...e.touches];
    if (steerId === null && remaining.length > 0) {
      steerId = remaining[0].identifier;
      baseX = remaining[0].clientX;
      baseY = remaining[0].clientY;
      input.tx = 0;
      input.ty = 0;
    }
    input.boost = remaining.filter((t) => t.identifier !== steerId).length > 0;
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}
