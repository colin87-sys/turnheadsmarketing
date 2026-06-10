import { CONFIG } from './config.js';
import { mulberry32, clamp } from './util.js';

const lerp = (a, b, k) => a + (b - a) * k;

// Endless course generator.
//
// The course is a chain of WAYPOINTS — most are rings, some are the holes in
// crystal-gate walls — emitted lazily as the player advances. Every hop
// between waypoints stays inside the steering envelope at boost speed, but:
//   - swings always use a real fraction of that envelope and alternate
//     direction, so the path weaves around the canyon instead of running
//     straight;
//   - difficulty rises with distance: tighter spacing, swings closer to the
//     steering limit, smaller gate holes, more (and moving) obstacles. Past
//     the ramp it keeps creeping — the canyon eventually wins. That's the run.
// Obstacles between waypoints keep a clearance from the hop envelope (the
// region between the two waypoint positions), so the racing line itself is
// never blocked; gates ON the line are the navigation test.
export function createLevelGen() {
  const rnd = mulberry32(CONFIG.seed);
  let prev = { dist: 0, x: 0, y: 8 };
  let swingX = 1;
  let swingY = 1;
  let untilGate = 3;
  let untilOrb = 3;
  let generatedUntil = 0;

  const difficulty = (d) => {
    const t = d / CONFIG.difficultyRamp;
    return t <= 1 ? t : 1 + (t - 1) * 0.25; // keeps creeping past 1.0, slowly
  };

  function nextWaypoint() {
    const t = difficulty(prev.dist);
    const tc = Math.min(t, 1);
    const spacing = lerp(78, 48, tc) * (0.85 + rnd() * 0.3);
    const dist = prev.dist + spacing;
    const hopTime = spacing / CONFIG.boostSpeed;
    // Swings approach (never exceed) the steering limit as difficulty rises.
    const safety = Math.min(lerp(0.55, 0.9, t), 0.92);
    const maxDx = CONFIG.lateralSpeed * hopTime * safety;
    const maxDy = CONFIG.verticalSpeed * hopTime * safety;
    // Mostly alternate direction and always move at least 45% of the budget:
    // the course weaves instead of drifting in a straight line.
    if (rnd() < 0.8) swingX *= -1;
    if (rnd() < 0.6) swingY *= -1;
    let x = prev.x + swingX * (0.45 + rnd() * 0.55) * maxDx;
    let y = prev.y + swingY * (0.45 + rnd() * 0.55) * maxDy;
    if (x < -10 || x > 10) {
      x = clamp(x, -10, 10);
      swingX *= -1;
    }
    if (y < 4.5 || y > 19) {
      y = clamp(y, 4.5, 19);
      swingY *= -1;
    }
    return { dist, x, y };
  }

  // Obstacles for the hop a->b, all kept clear of the hop envelope.
  function hopObstacles(a, b, out) {
    const t = difficulty(a.dist);
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
        // Ice pillar beside the corridor; if it hugs a wall, use the open side.
        const r = 1.6 + rnd() * 1.4;
        const side = cx > 4 ? -1 : cx < -4 ? 1 : rnd() < 0.5 ? -1 : 1;
        const edge = side < 0 ? env.minX : env.maxX;
        const x = clamp(edge + side * (r + CLEAR + rnd() * 3), -12.5, 12.5);
        if (x <= env.minX - (r + CLEAR) || x >= env.maxX + (r + CLEAR)) {
          out.obstacles.push({ type: 'pillar', dist: d, x, r, h: 8 + rnd() * 13 });
        }
      } else if (roll < 0.55) {
        // Static floating shard offset radially from the envelope.
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
        // Horizontal ice bar spanning the lane, above or below the corridor.
        // Only fits where the hop is vertically tight.
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
        // Mover: oscillating shard whose whole sweep stays clear of the
        // envelope — animated menace that punishes sloppy lines.
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

  // Generate forward until the course exists out to `target` distance.
  // Returns the newly created entities for the scene modules to spawn.
  function ensure(target) {
    const out = { rings: [], obstacles: [], orbs: [] };
    while (prev.dist < target) {
      const wp = nextWaypoint();
      const t = difficulty(wp.dist);
      const tc = Math.min(t, 1);
      hopObstacles(prev, wp, out);

      untilOrb--;
      if (untilOrb <= 0) {
        untilOrb = 4 + Math.floor(rnd() * 3);
        const ang = rnd() * Math.PI * 2;
        out.orbs.push({
          dist: (prev.dist + wp.dist) / 2,
          x: clamp((prev.x + wp.x) / 2 + Math.cos(ang) * 3, -11, 11),
          y: clamp((prev.y + wp.y) / 2 + Math.sin(ang) * 3, 3.5, 20),
        });
      }

      untilGate--;
      if (wp.dist > 260 && untilGate <= 0) {
        // This waypoint is the HOLE in a crystal wall: gates force navigation.
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
    get generatedUntil() {
      return generatedUntil;
    },
  };
}
