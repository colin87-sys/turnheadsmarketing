import { CONFIG } from './config.js';
import { mulberry32, clamp } from './util.js';

// Course layout built around a "flight corridor": the piecewise-linear path
// through every ring. Each ring hop is reachable even at top (orb) speed, all
// obstacles keep a clearance from the corridor, gate openings sit exactly on
// it, and orbs sit just beside it — so a skilled player can hold boost the
// whole run, collect everything, and never be forced into a collision.
// Distances ("dist") run 0 -> levelLength; world z is -dist.
export function generateLevel() {
  const rnd = mulberry32(CONFIG.seed);
  const L = CONFIG.levelLength;

  // --- Rings: each hop stays inside the steering envelope at orb speed.
  const rings = [];
  const n = CONFIG.ringCount;
  const firstDist = 120;
  const lastDist = L - 160;
  let x = 0;
  let y = 8; // path starts at the spawn point (0, 8)
  let prevDist = 0;
  for (let i = 0; i < n; i++) {
    const dist = firstDist + (i / (n - 1)) * (lastDist - firstDist);
    const hopTime = (dist - prevDist) / CONFIG.orbSpeed; // worst case: full orb speed
    const safety = 0.55; // leave ~45% steering margin for reaction time and easing
    const maxDx = CONFIG.lateralSpeed * hopTime * safety;
    const maxDy = CONFIG.verticalSpeed * hopTime * safety;
    const wander = 0.5 + (i / (n - 1)) * 0.5; // ramp difficulty within the safe envelope
    x = clamp(x + (rnd() * 2 - 1) * maxDx * wander, -10, 10);
    y = clamp(y + (rnd() * 2 - 1) * maxDy * wander, 4.5, 19);
    rings.push({ dist, x, y });
    prevDist = dist;
  }

  // The safe flight path: linear interpolation through the rings.
  const pathAt = (d) => {
    if (d <= rings[0].dist) {
      const k = Math.max(d, 0) / rings[0].dist;
      return { x: rings[0].x * k, y: 8 + (rings[0].y - 8) * k };
    }
    const last = rings[rings.length - 1];
    if (d >= last.dist) return { x: last.x, y: last.y };
    let i = 1;
    while (rings[i].dist < d) i++;
    const a = rings[i - 1];
    const b = rings[i];
    const k = (d - a.dist) / (b.dist - a.dist);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  // The corridor isn't just the interpolated line: a player flying at full
  // speed covers the lateral move early in a hop, so anywhere between the two
  // waypoint positions is a legitimate racing line. boxAt(d) is that envelope.
  const waypoints = [{ dist: 0, x: 0, y: 8 }, ...rings];
  const boxAt = (d) => {
    let i = 0;
    while (i < waypoints.length - 2 && waypoints[i + 1].dist < d) i++;
    const a = waypoints[i];
    const b = waypoints[i + 1];
    return {
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y),
    };
  };

  // --- Obstacles: denser over time, never inside the corridor envelope.
  const obstacles = [];
  const CLEAR = CONFIG.pathClearance;
  let dist = 200;
  while (dist < L - 150) {
    const t = dist / L;
    // Keep obstacles off ring planes so rings are always honest to fly through.
    let d = dist;
    for (const r of rings) {
      if (Math.abs(r.dist - d) < 14) d = r.dist + 16;
    }
    const box = boxAt(d);
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const halfW = (box.maxX - box.minX) / 2;
    const halfH = (box.maxY - box.minY) / 2;
    const roll = rnd();

    if (roll >= 0.72 && halfW < 3 && halfH < 3) {
      // Gate only on straight-ish sections; its opening covers the whole
      // corridor envelope plus margin, shrinking a little late in the level.
      obstacles.push({
        type: 'gate',
        dist: d,
        gapX: cx,
        gapY: cy,
        gapW: halfW + 4.2 - t * 0.8,
        gapH: halfH + 4.0 - t * 0.8,
      });
    } else if (roll < 0.4) {
      // Pillar beside the corridor; if it hugs a wall, use the open side.
      const r = 1.6 + rnd() * 1.4;
      const side = cx > 5 ? -1 : cx < -5 ? 1 : rnd() < 0.5 ? -1 : 1;
      const edge = side < 0 ? box.minX : box.maxX;
      const px = clamp(edge + side * (r + CLEAR + rnd() * 3.5), -12.5, 12.5);
      if (px <= box.minX - (r + CLEAR) || px >= box.maxX + (r + CLEAR)) {
        obstacles.push({ type: 'pillar', dist: d, x: px, r, h: 8 + rnd() * 12 });
      }
    } else {
      // Shard offset radially from the corridor envelope.
      const r = 1.4 + rnd() * 1.2;
      const ang = rnd() * Math.PI * 2;
      const off = Math.hypot(halfW, halfH) + r + CLEAR + rnd() * 2.5;
      const sx = clamp(cx + Math.cos(ang) * off, -11, 11);
      const sy = clamp(cy + Math.sin(ang) * off, 3, 20);
      const ddx = Math.max(box.minX - sx, 0, sx - box.maxX);
      const ddy = Math.max(box.minY - sy, 0, sy - box.maxY);
      if (Math.hypot(ddx, ddy) >= r + CLEAR) {
        obstacles.push({ type: 'shard', dist: d, x: sx, y: sy, r });
      }
    }
    const spacing = 70 - t * 38;
    dist += spacing * (0.7 + rnd() * 0.6);
  }

  // --- Orbs: between rings, nudged just off the corridor center — a small
  // flick to grab, never a combo-breaking or collision-forcing detour.
  const orbs = [];
  const gates = obstacles.filter((o) => o.type === 'gate');
  const step = Math.floor((n - 2) / CONFIG.orbCount);
  for (let i = 0; i < CONFIG.orbCount; i++) {
    const a = rings[1 + i * step];
    const b = rings[2 + i * step];
    let d = (a.dist + b.dist) / 2;
    for (const g of gates) {
      if (Math.abs(g.dist - d) < 15) d = g.dist - 18;
    }
    const p = pathAt(d);
    const ang = rnd() * Math.PI * 2;
    orbs.push({
      dist: d,
      x: clamp(p.x + Math.cos(ang) * 3, -11, 11),
      y: clamp(p.y + Math.sin(ang) * 3, 3.5, 20),
    });
  }

  return { rings, obstacles, orbs, pathAt, boxAt };
}
