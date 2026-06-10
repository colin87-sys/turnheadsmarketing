// Keyboard state. Game-flow keys (Enter/R) are handled in main.js.
export const input = { up: false, down: false, left: false, right: false, boost: false };

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
