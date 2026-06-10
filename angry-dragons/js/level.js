import { CONFIG } from './config.js';
import { mulberry32, clamp } from './util.js';

const lerp = (a, b, k) => a + (b - a) * k;

// Set-piece event types keyed by distance threshold.
// main.js watches for these and builds the geometry.
export const SET_PIECES = [
  { dist: 420,  type: 'arch' },        // giant ice arch
  { dist: 900,  type: 'tunnel' },      // crystal tunnel (dense close spires)
  { dist: 1600, type: 'skychamber' },  // canyon opens wide, sun reveal
  { dist: 2400, type: 'arch' },
  { dist: 3200, type: 'tunnel' },
];

export function createLevelGen() {
  const rnd = mulberry32(CONFIG.seed);
  let prev = { dist: 0, x: 0, y: 8 };
  let swingX = 1;
  let swingY = 1;
  let untilGate = 3;
  let untilOrb = 2; // first orb comes faster
  let generatedUntil = 0;

  const difficulty = (d) => {
    // First 300m: forced easy approach (tutorial)
    if (d < 300) return 0;
    const t = (d - 300) / CONFIG.difficultyRamp;
    return t <= 1 ? t : 1 + (t - 1) * 0.25;
  };

  function nextWaypoint() {
    const t = difficulty(prev.dist);
    const tc = Math.min(t, 1);
    // First few hops are shorter so the player gets rewards quickly
    const baseClose = prev.dist < 200 ? 42 : 78;
    const spacing = lerp(baseClose, 48, tc) * (0.85 + rnd() * 0.3);
    const dist = prev.dist + spacing;
    const hopTime = spacing / CONFIG.boostSpeed;
    const safety = Math.min(lerp(0.45, 0.9, t), 0.92); // gentler early
    const maxDx = CONFIG.lateralSpeed * hopTime * safety;
    const maxDy = CONFIG.verticalSpeed * hopTime * safety;

    if (rnd() < 0.8) swingX *= -1;
    if (rnd() < 0.6) swingY *= -1;

    // First waypoint stays near centre so first ring is easy
    const swingFraction = prev.dist < 80 ? 0.2 : (0.45 + rnd() * 0.55);
    let x = prev.x + swingX * swingFraction * maxDx;
    let y = prev.y + swingY * swingFraction * maxDy;

    if (x < -10 || x > 10) { x = clamp(x, -10, 10); swingX *= -1; }
    if (y < 5.5 || y > 19) { y = clamp(y, 5.5, 19); swingY *= -1; }
    return { dist, x, y };
  }

  function hopObstacles(a, b, out) {
    const t = difficulty(a.dist);
    if (t <= 0) return; // tutorial zone: no obstacles
    const tc = Math.min(t, 1);
    const env = {
      minX: Math.min(a.x, b.x),
      maxX: Math.max(a.x, b.x),
      minY: Math.min(a.y, b.y),
      maxY: Math.max(a.y, b.y),
    };
    const cx = (env.minX + env.maxX) / 2;
    const cy = (env.minY + env.maxY) / 2;
    const halfW = (env.maxX - env.minX) / 2;
    const halfH = (env.maxY - env.minY) / 2;
    const CLEAR = CONFIG.pathClearance;

    const budget = 0.55 + tc * 1.1 + Math.max(0, t - 1) * 0.4;
    const count = Math.floor(budget) + (rnd() < budget % 1 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const d = a.dist + (0.3 + rnd() * 0.4) * (b.dist - a.dist);
      const roll = rnd();

      if (roll < 0.27) {
        const r = 1.6 + rnd() * 1.4;
        const side = cx > 4 ? -1 : cx < -4 ? 1 : rnd() < 0.5 ? -1 : 1;
        const edge = side < 0 ? env.minX : env.maxX;
        const x = clamp(edge + side * (r + CLEAR + rnd() * 3), -12.5, 12.5);
        if (x <= env.minX - (r + CLEAR) || x >= env.maxX + (r + CLEAR)) {
          out.obstacles.push({ type: 'pillar', dist: d, x, r, h: 8 + rnd() * 13 });
        }
      } else if (roll < 0.55) {
        const r = 1.4 + rnd() * 1.2;
        const ang = rnd() * Math.PI * 2;
        const off = Math.hypot(halfW, halfH) + r + CLEAR + rnd() * 2.5;
        const x = clamp(cx + Math.cos(ang) * off, -11, 11);
        const y = clamp(cy + Math.sin(ang) * off, 3, 20);
        const ddx = Math.max(env.minX - x, 0, x - env.maxX);
        const ddy = Math.max(env.minY - y, 0, y - env.maxY);
        if (Math.hypot(ddx, ddy) >= r + CLEAR) {
          out.obstacles.push({ type: 'shard', dist: d, x, y, r });
        }
      } else if (roll < 0.75) {
        if (halfH * 2 < 3) {
          const r = 0.7 + rnd() * 0.4;
          const below = env.minY - (r + 4) - rnd() * 1.5;
          const above = env.maxY + (r + 4) + rnd() * 1.5;
          if (below >= 1.4 && (rnd() < 0.5 || above > 21.5)) {
            out.obstacles.push({ type: 'bar', dist: d, y: below, r });
          } else if (above <= 21.5) {
            out.obstacles.push({ type: 'bar', dist: d, y: above, r });
          }
        }
      } else if (t > 0.25) {
        const r = 1.3 + rnd() * 0.9;
        const amp = 1.5 + tc * 2;
        const speed = 1 + tc * 1.4 + rnd() * 0.5;
        const side = cx > 4 ? -1 : cx < -4 ? 1 : rnd() < 0.5 ? -1 : 1;
        const edge = side < 0 ? env.minX : env.maxX;
        const baseX = clamp(edge + side * (r + CLEAR + amp + rnd() * 2), -12, 12);
        const y = clamp(cy + (rnd() * 2 - 1) * 2.5, 3, 20);
        const nearest = Math.abs(baseX - (side < 0 ? env.minX : env.maxX)) - amp;
        if (nearest >= r + CLEAR) {
          out.obstacles.push({
            type: 'shard', dynamic: true, dist: d, r,
            baseX, baseY: y, amp, speed, phase: rnd() * Math.PI * 2,
            x: baseX, y,
          });
        }
      }
    }
  }

  function ensure(target) {
    const out = { rings: [], obstacles: [], orbs: [], setPieces: [] };
    while (prev.dist < target) {
      const wp = nextWaypoint();
      const t = difficulty(wp.dist);
      const tc = Math.min(t, 1);
      hopObstacles(prev, wp, out);

      // Orbs: first one guaranteed early (dist ~120)
      untilOrb--;
      if (untilOrb <= 0) {
        untilOrb = prev.dist < 300 ? 3 : 4 + Math.floor(rnd() * 3);
        const ang = rnd() * Math.PI * 2;
        out.orbs.push({
          dist: (prev.dist + wp.dist) / 2,
          x: clamp((prev.x + wp.x) / 2 + Math.cos(ang) * 2.5, -11, 11),
          y: clamp((prev.y + wp.y) / 2 + Math.sin(ang) * 2.5, 4.5, 20),
        });
      }

      // Set-piece events
      for (const sp of SET_PIECES) {
        if (prev.dist < sp.dist && wp.dist >= sp.dist) {
          out.setPieces.push(sp);
        }
      }

      // Gates: only after 420m (safely past the tutorial zone)
      untilGate--;
      if (wp.dist > 420 && t > 0 && untilGate <= 0) {
        untilGate = tc > 0.7 ? 2 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 3);
        out.obstacles.push({
          type: 'gate',
          dist: wp.dist,
          gapX: wp.x,
          gapY: wp.y,
          gapW: Math.max(lerp(5.2, 2.7, tc) - Math.max(0, t - 1) * 0.2, 2.2),
          gapH: Math.max(lerp(4.8, 2.5, tc) - Math.max(0, t - 1) * 0.2, 2.1),
          thick: 1.5,
        });
      } else {
        out.rings.push({ dist: wp.dist, x: wp.x, y: wp.y });
      }
      prev = wp;
    }
    generatedUntil = prev.dist;
    return out;
  }

  return {
    ensure,
    difficulty,
    get generatedUntil() { return generatedUntil; },
  };
}
