# Dragon Flight

A browser-based 3D dragon-flight prototype built with [Three.js](https://threejs.org/) (loaded from CDN — no build step, no dependencies to install).

Ride a dragon through an icy crystal canyon at sunset: fly through glowing rings to build a score combo, dodge ice pillars, floating shards and crystal gates, grab blue speed orbs, and manage a stamina-based boost.

## Run it

ES modules require an HTTP server (opening `index.html` via `file://` won't work):

```bash
cd dragon-flight
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, GitHub Pages, etc.).

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | Move up |
| S / ↓ | Move down |
| A / ← | Move left |
| D / → | Move right |
| Hold Space | Boost (drains stamina) |
| Enter | Start |
| R | Restart after game over / finish |

## Rules

- **Rings**: 100 pts × combo. Each consecutive ring adds +0.25x combo (max 5x). Threading the exact center adds a +50 bonus. Missing a ring resets the combo.
- **Boost**: 35 → 65 speed while held; drains 25 stamina/s. Stamina regenerates 15/s after a 1s delay.
- **Speed orbs**: free 80-speed burst for 2 seconds plus 15 stamina, placed just off the racing line between rings.
- **Stamina from rings**: each ring restores 20 stamina — collecting rings is the real fuel for constant boosting.
- **Damage**: obstacles −25 HP, canyon walls/floor −15 HP, with a 1s grace period after each hit. At 0 HP the flight ends.
- **Speed bonus**: finishing under par (74s, the no-boost pace) awards 100 pts per second saved — flying fast and clean is the whole game.
- **High score & sharing**: your best score is saved locally. From the end screen you can save a score screenshot, share on X, or copy a challenge link (`?challenge=SCORE`) that shows friends your score to beat.

## Course design guarantee

The level generator builds everything around a "flight corridor" — the envelope between consecutive ring positions:

- Every ring-to-ring hop is steerable even at maximum (orb) speed, with ~45% margin.
- Obstacles always keep a clearance from the corridor envelope; crystal-gate openings are centered on it and cover it fully.
- Orbs sit a small flick off the corridor, never forcing a collision or a missed ring.

So a perfect run — full boost, every ring, every orb, no damage — is always physically possible. (A headless bot that simply chases rings at constant boost finishes 32/32 rings with full health.)

## Code layout

```
index.html              HTML shell, HUD styles, Three.js import map
js/main.js              Setup, game flow and the main loop
js/config.js            All tuning constants
js/gameState.js         Shared score/health/stamina/combo state
js/input.js             Keyboard state
js/player.js            Flight model: steering, boost, stamina, orb bursts
js/dragon.js            Dragon + rider models, ponytail physics, speed trail
js/cameraController.js  Cinematic chase camera, FOV kick, damage shake
js/level.js             Procedural course layout (seeded, deterministic)
js/environment.js       Sunset sky shader, fog, canyon walls, snow, lights
js/rings.js             Ring scoring, combo logic, collect effects
js/obstacles.js         Ice pillars, shards, crystal gates + collider data
js/powerups.js          Speed orbs
js/collision.js         Health, hit tests, damage feedback
js/ui.js                DOM HUD, popups, start/gameover/finish screens
js/sfx.js               Placeholder WebAudio sound effects
js/util.js              Seeded RNG, smoothing helpers, glow textures
```

Tuning lives almost entirely in `js/config.js` — speeds, damage, stamina rates, ring counts, level length, and the RNG seed for the course layout.
