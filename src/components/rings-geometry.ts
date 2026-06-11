/**
 * Shared geometry for the activity rings — consumed by both the Skia
 * implementation (native) and the SVG fallback (web).
 */

export const SIZE = 168;
export const STROKE = 10;
export const GAP = 3;
export const CENTER = SIZE / 2;
export const RADII = [
  (SIZE - STROKE) / 2,
  (SIZE - STROKE) / 2 - (STROKE + GAP),
  (SIZE - STROKE) / 2 - 2 * (STROKE + GAP),
] as const;

export type RingProgress = {
  key: string;
  color: string;
  /** Fraction of the goal, clamped to [0, 1] */
  progress: number;
  /** Entrance animation delay in ms */
  delay: number;
};

export type HeartGeometry = {
  /** Closed loop, equal arc-length spacing, starting at the top notch moving right. */
  points: Array<{ x: number; y: number }>;
  /** Unit tangents along the direction of travel, one per point. */
  tangents: Array<{ x: number; y: number }>;
  perimeter: number;
};

type Point = { x: number; y: number };

/** Classic parametric heart (16·sin³t), flipped into screen coordinates. */
const ROUNDNESS = 0.3;
/** Extra notch depth (raw units) and angular half-width of the deepened valley. */
const NOTCH_DEPTH = 4;
const NOTCH_SPREAD = 1.0;

function rawHeartPoint(t: number): Point {
  const hx = 16 * Math.sin(t) ** 3;
  const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  const cx = 14 * Math.sin(t);
  const cy = 2.5 - 14 * Math.cos(t);
  // Distance from the notch (t = 0), wrapped
  const dt = Math.abs(((t + Math.PI) % (2 * Math.PI)) - Math.PI);
  const dip = dt < NOTCH_SPREAD ? NOTCH_DEPTH * Math.cos((Math.PI * dt) / (2 * NOTCH_SPREAD)) ** 2 : 0;
  return {
    x: (1 - ROUNDNESS) * hx + ROUNDNESS * cx,
    y: (1 - ROUNDNESS) * hy + ROUNDNESS * cy + dip,
  };
}

const RAW_STEPS = 720;

/** Dense heart loop spanning 2·radius at its widest, vertically centered on the canvas. */
function traceHeart(radius: number): Point[] {
  const raw: Point[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = 0;

  for (let i = 0; i < RAW_STEPS; i++) {
    const p = rawHeartPoint((i / RAW_STEPS) * 2 * Math.PI);
    raw.push(p);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    maxX = Math.max(maxX, Math.abs(p.x));
  }

  const scale = radius / maxX;
  const offsetY = CENTER - ((minY + maxY) / 2) * scale;
  return raw.map((p) => ({ x: CENTER + p.x * scale, y: offsetY + p.y * scale }));
}

function distToSegmentSq(p: Point, a: Point, b: Point) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1))
  );
  const dx = p.x - (a.x + abx * t);
  const dy = p.y - (a.y + aby * t);
  return dx * dx + dy * dy;
}

function minDistToLoop(p: Point, loop: Point[]) {
  let best = Infinity;
  for (let i = 0; i < loop.length; i++) {
    best = Math.min(best, distToSegmentSq(p, loop[i], loop[(i + 1) % loop.length]));
  }
  return Math.sqrt(best);
}

function loopWidth(loop: Point[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  return maxX - minX;
}

/**
 * Offset a closed loop outward by distance d, so every ring keeps a constant
 * gap to its neighbor instead of being a scaled-up copy. Each point moves
 * along its outward normal; points that land closer than d to the source
 * curve (where the notch walls converge) are culled, which lets outer rings
 * soften the notch the way a true dilation does.
 */
function outsetLoop(loop: Point[], d: number): Point[] {
  const n = loop.length;

  const offsetBy = (sign: number) =>
    loop.map((p, i) => {
      const prev = loop[(i - 1 + n) % n];
      const next = loop[(i + 1) % n];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + sign * (dy / len) * d, y: p.y - sign * (dx / len) * d };
    });

  let offset = offsetBy(1);
  if (loopWidth(offset) < loopWidth(loop)) {
    offset = offsetBy(-1); // normals pointed inward — flip them
  }

  return smoothLoop(offset.filter((q) => minDistToLoop(q, loop) >= d - 0.5));
}

/** Moving-average smoothing — rounds off the chords left where corner points were culled. */
function smoothLoop(loop: Point[], iterations = 2, window = 7): Point[] {
  const half = Math.floor(window / 2);
  let pts = loop;
  for (let it = 0; it < iterations; it++) {
    const n = pts.length;
    const prev = pts;
    pts = prev.map((_, i) => {
      let sx = 0;
      let sy = 0;
      for (let k = -half; k <= half; k++) {
        const p = prev[(i + k + n) % n];
        sx += p.x;
        sy += p.y;
      }
      return { x: sx / window, y: sy / window };
    });
  }
  return pts;
}

/** Resample a closed loop at equal arc-length steps so a trim fraction maps onto an index. */
function resampleLoop(loop: Point[], samples: number): HeartGeometry {
  const m = loop.length;
  const cumulative = [0];
  for (let i = 1; i <= m; i++) {
    const a = loop[i - 1];
    const b = loop[i % m];
    cumulative.push(cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const perimeter = cumulative[m];

  const points: Point[] = [];
  let seg = 0;
  for (let i = 0; i < samples; i++) {
    const target = (i / samples) * perimeter;
    while (cumulative[seg + 1] < target) seg++;
    const span = cumulative[seg + 1] - cumulative[seg];
    const f = span > 0 ? (target - cumulative[seg]) / span : 0;
    const a = loop[seg];
    const b = loop[(seg + 1) % m];
    points.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }

  const tangents = points.map((_, i) => {
    const next = points[(i + 1) % samples];
    const prev = points[(i - 1 + samples) % samples];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  });

  return { points, tangents, perimeter };
}

/**
 * Heart loop for one ring. The innermost ring is the base heart — its centre
 * stays open — and the outer rings wrap around it, offset outward by
 * STROKE + GAP per step for a constant gap.
 */
export function makeHeartGeometry(ringIndex: number, samples = 240): HeartGeometry {
  const base = traceHeart(RADII[RADII.length - 1]);
  const growth = (RADII.length - 1 - ringIndex) * (STROKE + GAP);
  const loop = growth === 0 ? base : outsetLoop(base, growth);
  return resampleLoop(loop, samples);
}

/** Mix a #RRGGBB color toward white (amount 0..1). */
export function lighten(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.round(c + (255 - c) * amount);
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
