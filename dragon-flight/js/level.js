import { CONFIG } from './config.js';
import { mulberry32, clamp } from './util.js';

// Procedurally lays out rings, obstacles and speed orbs along the canyon.
// Distances ("dist") run 0 -> levelLength; world z is -dist (the dragon flies -z).
export function generateLevel() {
  const rnd = mulberry32(CONFIG.seed);
  const L = CONFIG.levelLength;
  const rings = [];
  const obstacles = [];
  const orbs = [];

  // Rings wander smoothly through the lane; later rings jump further apart.
  const n = CONFIG.ringCount;
  let prevX = 0;
  let prevY = 9;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const dist = 120 + t * (L - 280);
    const range = 4 + t * 8; // difficulty ramp: wider position jumps later on
    const x = clamp(prevX + (rnd() * 2 - 1) * range, -10, 10);
    const y = clamp(prevY + (rnd() * 2 - 1) * range * 0.7, 4.5, 19);
    rings.push({ dist, x, y });
    prevX = x;
    prevY = y;
  }

  // Obstacles get denser as the level progresses. The first 200 units stay clear.
  let dist = 200;
  while (dist < L - 150) {
    const t = dist / L;
    // Keep obstacles off ring planes so rings are always honest to fly through.
    let d = dist;
    for (const r of rings) {
      if (Math.abs(r.dist - d) < 14) d = r.dist + 16;
    }
    const roll = rnd();
    if (roll < 0.4) {
      obstacles.push({
        type: 'pillar',
        dist: d,
        x: (rnd() * 2 - 1) * 12,
        r: 1.6 + rnd() * 1.4,
        h: 8 + rnd() * 12,
      });
    } else if (roll < 0.75) {
      obstacles.push({
        type: 'shard',
        dist: d,
        x: (rnd() * 2 - 1) * 11,
        y: 5 + rnd() * 14,
        r: 1.4 + rnd() * 1.2,
      });
    } else {
      obstacles.push({
        type: 'gate',
        dist: d,
        gapX: (rnd() * 2 - 1) * 7,
        gapY: 5 + rnd() * 12,
        gapW: 4.6 - t * 1.2, // half-extents; openings shrink later in the level
        gapH: 4.4 - t * 1.0,
      });
    }
    const spacing = 70 - t * 38;
    dist += spacing * (0.7 + rnd() * 0.6);
  }

  // Speed orbs sit off the easy line (lane edges, very high or very low).
  for (let i = 0; i < CONFIG.orbCount; i++) {
    const d = 300 + (i + rnd() * 0.5) * ((L - 520) / CONFIG.orbCount);
    const side = rnd() < 0.5 ? -1 : 1;
    const high = rnd() < 0.5;
    orbs.push({
      dist: d,
      x: side * (9 + rnd() * 2.5),
      y: high ? 16 + rnd() * 4 : 3.5 + rnd() * 1.5,
    });
  }

  return { rings, obstacles, orbs };
}
