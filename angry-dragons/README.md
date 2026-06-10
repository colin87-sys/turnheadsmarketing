# Angry Dragons

A browser-based endless 3D dragon-flight game built with [Three.js](https://threejs.org/) (vendored locally — no build step, no dependencies to install).

Ride a dragon through an icy crystal canyon at sunset. The canyon never ends — it only gets meaner. Build a ring combo, thread the glowing holes in crystal walls, dodge floating ice, manage a stamina-based boost, and fly as far and as fast as you can before the canyon wins.

## Run it

ES modules require an HTTP server (opening `index.html` via `file://` won't work):

```bash
cd angry-dragons
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
| R | Restart after a crash |

## Rules

- **Rings**: 100 pts × combo. Each consecutive ring adds +0.25x combo (max 5x). Threading the exact center adds a +50 bonus. Missing a ring resets the combo. Each ring restores 20 stamina — rings are the fuel for constant boosting.
- **Boost**: 35 → 65 speed while held; drains 25 stamina/s (regen 15/s after a 1s delay).
- **Speed orbs**: free 80-speed burst for 2 seconds plus 15 stamina, placed just off the racing line.
- **Distance is score**: 1 point per metre flown — flying fast is worth points by itself.
- **Damage**: floating ice (pillars, shards, bars, movers) chips 25 health with a 1s grace period. **Canyon walls, the ground and crystal-gate faces are instantly fatal.**
- **High scores & sharing**: best score and longest flight are saved locally. After a crash: **Screenshot** (downloads a stamped image of your crash moment) or **Share & Challenge Your Friends** — Instagram, X, TikTok, or a copyable challenge link (`?challenge=SCORE`) that shows friends your score to beat.

## Difficulty & course design

The endless generator emits a chain of waypoints — most are rings, some are the holes in crystal-gate walls — so the path itself weaves around the canyon. Every hop:

- stays inside the dragon's steering envelope at boost speed (the perfect line always exists),
- always uses a real fraction of that envelope and alternates direction (no straight-line cruising),
- gets harder with distance: tighter spacing, swings closer to the steering limit, smaller gate holes, more obstacles, and oscillating shards.

Difficulty ramps to "hard" over the first ~1800 m and keeps creeping after that — every run ends in a crash eventually. Obstacles between waypoints always keep a clearance from the hop envelope, so deaths come from the navigation test (gates, walls, your own line), not from unfair blockades. The course is seeded, so every run — and every challenger — flies the same canyon.

## Code layout

```
index.html              HTML shell, HUD styles, Three.js import map
js/main.js              Setup, game flow, endless spawning, share card, main loop
js/config.js            All tuning constants
js/gameState.js         Shared score/health/stamina/combo state, best-score storage
js/input.js             Keyboard state
js/player.js            Flight model: steering, boost, stamina, orb bursts
js/dragon.js            Dragon + rider models, ponytail physics, speed trail
js/cameraController.js  Cinematic chase camera, FOV kick, damage shake
js/level.js             Endless seeded generator: weaving waypoints, difficulty ramp
js/environment.js       Sunset sky shader, fog, recycled canyon walls, snow
js/rings.js             Ring scoring, combo logic, spawn/cull
js/obstacles.js         Pillars, shards, bars, movers, crystal gates + colliders
js/powerups.js          Speed orbs
js/collision.js         Health, hit tests, fatal walls, damage feedback
js/ui.js                DOM HUD, popups, start/crash screens, share menu
js/sfx.js               Placeholder WebAudio sound effects
js/util.js              Seeded RNG, smoothing helpers, glow textures
```

Tuning lives almost entirely in `js/config.js` — speeds, damage, stamina rates, difficulty ramp length, and the RNG seed.
