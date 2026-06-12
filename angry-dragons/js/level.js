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
  let lastDx = 0; // previous hop deltas, for late-game reversal damping
  let lastDy = 0;
  let untilGate = 3;
  let untilOrb = 2; // first orb comes faster
  let generatedUntil = 0;
  const auditReach =
    typeof location !== 'undefined' && location.search.includes('debug=reach');

  const difficulty = (d) => {
    // First 300m: forced easy approach (tutorial)
    if (d < 300) return 0;
    const t = (d - 300) / CONFIG.difficultyRamp;
    return t <= 1 ? t : 1 + (t - 1) * 0.25;
  };

  // Reach math is designed against the realistic late-game speed (orb + full
  // ramp), not raw boostSpeed — otherwise 2000m+ chains demand more steering
  // than the dragon has and force the player to stop boosting.
  const designSpeed = (tc) => lerp(CONFIG.boostSpeed, CONFIG.lineDesignSpeed, tc);

  function nextWaypoint() {
    const t = difficulty(prev.dist);
    const tc = Math.min(t, 1);
    const speed = designSpeed(tc);
    // Spacing is keyed to reaction time at design speed: every reward hop
    // gives at least minRewardHopTime of flight even at full late-game boost.
    let spacing;
    if (prev.dist < 200) {
      spacing = 42 * (0.85 + rnd() * 0.3); // tutorial: rewards come quickly
    } else {
      const hopT = Math.max(
        CONFIG.idealRewardHopTime * (0.9 + rnd() * 0.25),
        CONFIG.minRewardHopTime
      );
      spacing = hopT * speed;
    }
    const dist = prev.dist + spacing;
    const hopTime = spacing / speed;
    const safety = lerp(0.45, CONFIG.lateGameReachSafety, tc); // gentler early
    const maxDx = CONFIG.lateralSpeed * hopTime * safety;
    const maxDy = CONFIG.verticalSpeed * hopTime * safety;

    if (rnd() < 0.8) swingX *= -1;
    if (rnd() < 0.6) swingY *= -1;

    // First waypoint stays near centre so first ring is easy
    const swingFraction = prev.dist < 80 ? 0.2 : (0.45 + rnd() * 0.55);
    let dx = swingX * swingFraction * maxDx;
    let dy = swingY * swingFraction * maxDy;
    // After 1600m, soften hard direction reversals: a big swing one way
    // followed immediately by a big swing back is nearly unflyable boosted.
    if (prev.dist > 1600) {
      if (dx * lastDx < 0) dx *= 0.55;
      if (dy * lastDy < 0) dy *= 0.55;
    }
    let x = prev.x + dx;
    let y = prev.y + dy;

    if (x < -10 || x > 10) { x = clamp(x, -10, 10); swingX *= -1; }
    if (y < 5.5 || y > 19) { y = clamp(y, 5.5, 19); swingY *= -1; }
    lastDx = x - prev.x;
    lastDy = y - prev.y;
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

      // Gates: only after 420m (safely past the tutorial zone). The window is
      // a fixed, generous size — difficulty instead shoves it further off the
      // natural path, capped at gateReachSafety of what the dragon can
      // physically reach in this hop at design speed, so it always stays fair
      // even at full late-game boost. The waypoint itself moves to the window
      // so the rest of the course flows from it.
      untilGate--;
      const isGate = wp.dist > 420 && t > 0 && untilGate <= 0;
      if (isGate) {
        untilGate = tc > 0.7 ? 2 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 3);
        const hopTime = (wp.dist - prev.dist) / designSpeed(tc);
        const reachX = CONFIG.lateralSpeed * hopTime * CONFIG.gateReachSafety;
        const reachY = CONFIG.verticalSpeed * hopTime * CONFIG.gateReachSafety;
        const push = Math.min(1, Math.min(t, 1.5) * (0.45 + rnd() * 0.45));
        const dirX = Math.sign(wp.x - prev.x) || (rnd() < 0.5 ? -1 : 1);
        const dirY = Math.sign(wp.y - prev.y) || (rnd() < 0.5 ? -1 : 1);
        wp.x = clamp(wp.x + dirX * Math.max(0, reachX - Math.abs(wp.x - prev.x)) * push, -10, 10);
        wp.y = clamp(wp.y + dirY * Math.max(0, reachY - Math.abs(wp.y - prev.y)) * push, 5.5, 19);
        lastDx = wp.x - prev.x;
        lastDy = wp.y - prev.y;
      }

      // Reach audit (?debug=reach): flag rewards that demand most of the
      // dragon's steering authority at worst-case speed.
      if (auditReach) {
        const hopT = (wp.dist - prev.dist) / CONFIG.lineDesignSpeed;
        const need = Math.max(
          Math.abs(wp.x - prev.x) / (CONFIG.lateralSpeed * CONFIG.boostSteeringBonus * hopT),
          Math.abs(wp.y - prev.y) / (CONFIG.verticalSpeed * CONFIG.boostSteeringBonus * hopT)
        );
        if (need > 0.8) {
          console.warn(
            `[reach audit] ${isGate ? 'gate' : 'ring'} @${Math.round(wp.dist)}m ` +
            `demands ${Math.round(need * 100)}% of max steering at top speed`
          );
        }
      }

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

      if (isGate) {
        out.obstacles.push({
          type: 'gate',
          dist: wp.dist,
          gapX: wp.x,
          gapY: wp.y,
          gapW: CONFIG.gateGapW,
          gapH: CONFIG.gateGapH,
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
