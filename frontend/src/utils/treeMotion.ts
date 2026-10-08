/**
 * TREE MOTION — the Mature-to-Ancient tree comes alive.
 *
 * Pure helpers (no imports, no browser APIs) for the motion the pixel tree
 * adds once it is mature: buttress roots with a sap pulse rising toward the
 * trunk, vines and leaf tufts that sway in the wind, and a slow wave of
 * light through the leaves.
 *
 * Everything advances on a STEPPED clock (MOTION_HZ ticks a second) and
 * moves in WHOLE art pixels, so it reads as pixel-art animation and never
 * splits a pixel. Colors are chosen by the caller from the species' own
 * palettes; this module only decides indices, offsets and geometry.
 */

/** Pixel-art cadence: ten steps a second. */
export const MOTION_HZ = 10;

export function motionTick(tm: number): number {
  return Math.floor(tm * MOTION_HZ);
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));

  return t * t * (3 - 2 * t);
}

/**
 * Sway of `amp` art pixels at most, as a whole number: two slow sines at
 * incommensurate rates so it drifts instead of ticking back and forth.
 */
export function swayOffset(tick: number, phase: number, amp: number): number {
  const v =
    0.7 * Math.sin(tick * 0.42 + phase) +
    0.3 * Math.sin(tick * 0.17 + phase * 1.7);

  /* `+ 0` turns -0 into 0 */
  return Math.round(v * amp) + 0;
}

/**
 * A wave of light drifting through foliage: +1 brightens a leaf one step
 * along its ramp, -1 darkens it, 0 leaves it. `life` (0..1) fades it in.
 */
export function shimmerShift(
  tick: number,
  x: number,
  y: number,
  phase: number,
  life: number,
): -1 | 0 | 1 {
  if (life <= 0) return 0;

  const w = Math.sin(tick * 0.5 - (x * 0.9 + y * 0.6) * 0.35 + phase) * life;

  if (w > 0.86) return 1;
  if (w < -0.93) return -1;

  return 0;
}

const SAP_SPEED = 0.03;
const SAP_BAND = 0.26;

/**
 * The sap pulse: a short band that rises from the soil toward the trunk.
 * `t` runs 0 at the root tip to 1 at the trunk. Returns -1 where there is
 * no pulse, else 0 (tail), 1 (body) or 2 (bright head) as an index into
 * the species' resin ramp.
 */
export function sapShade(
  tick: number,
  t: number,
  phase: number,
  life: number,
): -1 | 0 | 1 | 2 {
  if (life <= 0) return -1;

  const cycle = (tick * SAP_SPEED + phase) % 1;
  const head = cycle * 1.6 - 0.3;
  const d = head - t;

  if (d < 0 || d > SAP_BAND * life) return -1;
  if (d < 0.06) return 2;
  if (d < 0.15) return 1;

  return 0;
}

/* ------------------------------------------------------------ */
/* Buttress roots                                                */
/* ------------------------------------------------------------ */

export interface RootPoint {
  x: number;
  y: number;
  /** Half the root's thickness here (world units). */
  hw: number;
  /** 0 at the root tip, 1 where it joins the trunk (the sap's way). */
  t: number;
}

export interface Root {
  /** Ground roots lie along the soil past the trunk's edge; ridges are
   *  the buttress fins that drop down the trunk's face and flare out. */
  kind: "ground" | "ridge";
  side: -1 | 1;
  phase: number;
  pts: RootPoint[];
  box: { x0: number; y0: number; x1: number; y1: number };
  /** Per segment k: [x0, y0, x1, y1] of segment k padded by its thickness,
   *  flattened (4 numbers a segment). Lets rootAt skip nearly all segments
   *  with four comparisons instead of a distance test. */
  segBox: number[];
}

const ROOT_SAMPLES = 40;

/**
 * The base's roots, in world units, built the way the reference draws
 * them: low and dark, thickest where they leave the trunk, running OUT
 * along the soil and tapering into it. Per side, two ground roots (a long
 * one and a shorter one) leave the trunk's edge just above the ground, and
 * one buttress ridge drops down the trunk's face and flares out at the
 * bottom (a concave "J"). Deterministic for a given `rand` sequence;
 * `baseHalf` is half the trunk's width where it meets the ground.
 */
export function makeRoots(
  rand: () => number,
  cx: number,
  baseHalf: number,
  groundY: number,
  count = 6,
): Root[] {
  const roots: Root[] = [];
  const B = baseHalf;

  for (let i = 0; i < count; i++) {
    const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
    const slot = Math.floor(i / 2) % 3;
    const kind: Root["kind"] = slot === 2 ? "ridge" : "ground";
    const r1 = rand();
    const r2 = rand();
    const r3 = rand();
    const r4 = rand();

    let x0: number, y0: number, x1: number, y1: number, x2: number, y2: number;
    let w0: number;

    if (kind === "ground") {
      /* leaves the trunk edge just above the soil, arches a little,
         then runs outward and dives into the ground */
      x0 = cx + side * B * (0.82 + 0.1 * r2);
      y0 = groundY - B * (0.1 + 0.04 * r3);
      x1 = cx + side * B * (1.05 + 0.25 * r1);
      y1 = groundY - B * 0.16;
      x2 = cx + side * B * (1.35 + 0.9 * r1 + (slot === 0 ? 0.4 : 0));
      y2 = groundY + 2;
      w0 = B * (0.13 + 0.05 * r1);
    } else {
      /* a fin on the trunk's face: nearly vertical, then it bends out
         along the soil */
      x0 = cx + side * B * (0.15 + 0.5 * r2);
      y0 = groundY - B * (0.38 + 0.2 * r3);
      x1 = x0 + side * B * 0.04;
      y1 = groundY - B * 0.05;
      x2 = x0 + side * B * (0.35 + 0.3 * r1);
      y2 = groundY + 2;
      w0 = B * (0.08 + 0.04 * r1);
    }

    const w1 = kind === "ground" ? 2.2 : 2.5;
    const pts: RootPoint[] = [];

    for (let k = 0; k < ROOT_SAMPLES; k++) {
      const u = k / (ROOT_SAMPLES - 1);
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;

      pts.push({
        x: a * x0 + b * x1 + c * x2,
        y: a * y0 + b * y1 + c * y2,
        hw: w0 + (w1 - w0) * Math.pow(u, 0.8),
        t: 1 - u,
      });
    }

    let x0b = Infinity;
    let y0b = Infinity;
    let x1b = -Infinity;
    let y1b = -Infinity;

    for (const p of pts) {
      x0b = Math.min(x0b, p.x - p.hw);
      y0b = Math.min(y0b, p.y - p.hw);
      x1b = Math.max(x1b, p.x + p.hw);
      y1b = Math.max(y1b, p.y + p.hw);
    }

    const segBox: number[] = [];

    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k];
      const q = pts[k + 1];
      const pad = Math.max(p.hw, q.hw);

      segBox.push(
        Math.min(p.x, q.x) - pad,
        Math.min(p.y, q.y) - pad,
        Math.max(p.x, q.x) + pad,
        Math.max(p.y, q.y) + pad,
      );
    }

    roots.push({
      kind,
      side,
      phase: r4,
      pts,
      box: { x0: x0b, y0: y0b, x1: x1b, y1: y1b },
      segBox,
    });
  }

  return roots;
}

export interface RootHit {
  root: number;
  /** Position along the root for the sap: 0 at the tip, 1 at the trunk. */
  t: number;
  /** -1 on the root's upper (lit) face, +1 on its underside. */
  n: number;
}

/** The root, if any, covering the world point (x, y). */
export function rootAt(
  roots: Root[],
  x: number,
  y: number,
  /** How much of each root exists, 0..1 from the trunk outward; a root
   *  that is still growing ends in a tapering tip. */
  reach = 1,
): RootHit | null {
  let best = 0;
  let hit: RootHit | null = null;

  for (let r = 0; r < roots.length; r++) {
    const { box, pts, segBox } = roots[r];

    if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) continue;

    for (let k = 0; k < pts.length - 1; k++) {
      const b = k * 4;

      if (x < segBox[b] || y < segBox[b + 1] || x > segBox[b + 2] || y > segBox[b + 3]) {
        continue;
      }

      const p = pts[k];
      const q = pts[k + 1];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / len2));
      const px = p.x + dx * u;
      const py = p.y + dy * u;
      const hw = p.hw + (q.hw - p.hw) * u;
      const t = p.t + (q.t - p.t) * u;
      /* position along the root from its foot: 0 at the trunk, 1 at the tip */
      const born = (1 - t) / Math.max(reach, 1e-6);

      if (born > 1) continue;

      const thin = reach >= 1 ? 1 : Math.min(1, 0.25 + (1 - born) * 5);
      const gap = Math.hypot(x - px, y - py) - hw * thin;

      if (gap > 0 || (hit !== null && gap >= best)) continue;

      /* the face normal, pointing down: the upper face is negative */
      const len = Math.sqrt(len2);
      let nx = -dy / len;
      let ny = dx / len;

      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }

      best = gap;
      hit = {
        root: r,
        t,
        n: Math.max(-1, Math.min(1, ((x - px) * nx + (y - py) * ny) / (hw * thin))),
      };
    }
  }

  return hit;
}
