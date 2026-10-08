/**
 * Garden charms, drawn.
 *
 * Each tree has five charms (see data/charms.ts); this file draws them onto
 * the tree's pixel canvas. A charm is either fixed to the world (a bucket
 * on the trunk, ferns at the foot, a slug on the bark) and so moves with
 * the camera as the tree is climbed, or it lives on the screen (falling
 * seeds, embers, light) and just plays.
 *
 * Everything is a function of time and the camera, with no state kept
 * between frames, and all motion steps in whole pixels.
 */

import { swayOffset } from "../../utils/treeMotion";

export interface CharmEnv {
  W: number;
  H: number;
  /** Seconds. */
  tm: number;
  /** The 10 Hz motion tick. */
  tick: number;
  reduced: boolean;
  put: (x: number, y: number, c: number[]) => void;
  blend: (x: number, y: number, c: number[], a: number) => void;
  /** World point to screen pixel. */
  proj: (wx: number, wy: number) => [number, number];
  /** Screen pixels per world unit. */
  scale: number;
  /** The trunk's axis and half-width at a world height. */
  trunk: (wy: number) => { cx: number; half: number };
  /** Screen row of the ground. */
  groundY: number;
  /** World height of the top of the trunk right now: it rises as the tree grows. */
  trunkTop: number;
  /** 0 on the ground .. 1 high in the climb. */
  asc: number;
  /** Places where things can hang, in screen pixels, each with a stable id. */
  anchors: { id: number; x: number; y: number }[];
  /** Seconds since the player poked this creature (Infinity if not lately). */
  since: (key: string) => number;
  /** Register where a creature is, so a click or tap can find it. */
  hit: (key: string, x: number, y: number, w: number, h: number) => void;
  /** The creature the pointer is over, if any. */
  hover: string | null;
  /** The species' colours. */
  foliage: number[][];
  bark: number[][];
  moss: number[][];
}

const hash = (a: number, b: number): number => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;

  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const mixc = (a: number[], b: number[], t: number): number[] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const WHITE = [255, 255, 255];

/** Stamp a small picture. `.` is empty; other letters look up `pal`. */
function stamp(
  env: CharmEnv,
  x: number,
  y: number,
  rows: string[],
  pal: Record<string, number[]>,
  flip = false,
  alpha = 1,
) {
  const w = rows[0].length;

  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < w; i++) {
      const ch = rows[j][flip ? w - 1 - i : i];
      const c = pal[ch];

      if (!c) continue;
      if (alpha >= 0.995) env.put(x + i, y + j, c);
      else env.blend(x + i, y + j, c, alpha);
    }
  }
}


/** A small "!" over a creature the pointer is on. */
function bang(env: CharmEnv, key: string, x: number, y: number) {
  if (env.hover !== key) return;

  const dark = [30, 20, 14];

  for (let j = 0; j < 5; j++) {
    if (j === 3) continue;
    env.put(x - 1, y + j, dark);
    env.put(x + 1, y + j, dark);
    env.put(x, y + j, [255, 246, 200]);
  }
  env.put(x, y - 1, dark);
  env.put(x, y + 5, dark);
}

const ease = (u: number) => u * u * (3 - 2 * u);
const clampu = (u: number) => Math.min(1, Math.max(0, u));

/* ------------------------------------------------------------ */
/* shared pieces                                                 */
/* ------------------------------------------------------------ */

/** Things that drift down the screen: seeds, coins, acorns, drops. */
function fallers(
  env: CharmEnv,
  count: number,
  speed: number,
  seed: number,
  draw: (x: number, y: number, k: number, phase: number) => void,
  sway = 6,
) {
  const span = env.H + 16;

  for (let k = 0; k < count; k++) {
    const sp = speed * (0.75 + hash(k, seed) * 0.6);
    const y = ((env.reduced ? 0 : env.tm) * sp + hash(k, seed + 1) * span) % span - 8;
    const x =
      hash(k, seed + 2) * env.W +
      sway * Math.sin((env.reduced ? 0 : env.tm) * (0.6 + hash(k, 3) * 0.5) + k * 1.9);

    draw(Math.round(x), Math.round(y), k, hash(k, seed + 4) * 6.28);
  }
}

/** Flowers dotted along the ground at the foot of the tree. */
function groundFlowers(
  env: CharmEnv,
  count: number,
  seed: number,
  draw: (x: number, y: number, k: number) => void,
) {
  if (env.groundY > env.H + 30) return;

  const c = env.trunk(742);

  for (let k = 0; k < count; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    const wx = c.cx + side * (c.half * 1.2 + 25 + hash(k, seed) * 330);
    const wy = 742 + hash(k, seed + 1) * 18;
    const [x, y] = env.proj(wx, wy);

    if (x < -6 || x > env.W + 6 || y < -6 || y > env.H + 6) continue;
    draw(Math.round(x), Math.round(y), k);
  }
}

/* ------------------------------------------------------------ */
/* the maple's                                                   */
/* ------------------------------------------------------------ */

function drawKeys(env: CharmEnv) {
  const wing = [222, 184, 124];
  const wingDark = [186, 120, 74];
  const seed = [150, 70, 48];

  fallers(env, 8, 11, 31, (x, y, _k, ph) => {
    const turn = env.reduced ? 0 : Math.floor(env.tm * 7 + ph) % 4;

    env.put(x, y, seed);
    env.put(x, y + 1, seed);
    /* the wing whirls round the seed */
    const dx = [1, 0, -1, 0][turn];
    const dy = [0, 1, 0, -1][turn];

    for (let i = 1; i <= 3; i++) {
      env.put(x + dx * i, y + dy * i - (turn === 1 ? 0 : 0), i === 3 ? wingDark : wing);
    }
    env.put(x + dx * 2 + dy, y + dy * 2 + dx, wing);
  }, 9);
}

/** The creeper climbs with the tree: it follows the trunk's top up, always a little short of it. */
function drawCreeper(env: CharmEnv) {
  const stem = [96, 44, 44];
  const reds = [[214, 52, 44], [238, 88, 56], [168, 34, 40]];
  const tender = [[236, 120, 90], [250, 170, 110]];
  const reach = Math.max(0, 742 - env.trunkTop);
  const tipWy = 742 - 22 - reach * 0.9;

  for (let i = 0; i < 700; i++) {
    const wy = 742 - 22 - i * 5.2;

    if (wy < tipWy) break;

    const [, sy] = env.proj(0, wy);

    if (sy < -6) break;
    if (sy > env.H + 6) continue;

    const { cx, half } = env.trunk(wy);
    const a = i * 0.26;
    const front = Math.cos(a);

    if (front < -0.2) continue;

    const [sx] = env.proj(cx + Math.sin(a) * half * 0.9, wy);
    const x = Math.round(sx);
    const y = Math.round(sy);
    /* the youngest few feet are pale and bare, a tendril feeling upward */
    const young = (wy - tipWy) / 5.2 < 8;

    env.put(x, y, young ? [170, 96, 80] : stem);
    if (i % 5 === 0) {
      /* a leaflet of five on its stalk, smaller and paler near the tip */
      const c = young ? tender[(i / 5) % 2 | 0] : reds[(i / 5) % 3 | 0];
      const sway = swayOffset(env.tick, i * 0.7, 1);

      env.put(x + sway, y - 1, c);
      env.put(x + sway, y, c);
      if (!young) {
        env.put(x + 1 + sway, y, c);
        env.put(x - 1 + sway, y, c);
        env.put(x + sway, y + 1, c);
        env.put(x + sway, y, reds[1]);
      }
    }
  }
}

const SQUIRREL = [
  "........r.",
  "......rrrr",
  ".....rrrer",
  "..tt.rrrrc",
  ".tttrrrrc.",
  ".ttrrrrcc.",
  ".tt.rrrcc.",
  "..ttrrrrr.",
  "...trr.rr.",
];

const SQUIRREL_CLIMB = [
  ".rr....",
  "rrer...",
  ".rrc...",
  ".rrrc..",
  "trrrc..",
  "ttrrr..",
  "tt.rr..",
  "t..rr..",
];

/** The squirrel sits, then dashes up the trunk, sits, and comes back down. */
function drawSquirrel(env: CharmEnv) {
  const t = env.reduced ? 0 : env.tm;
  const cycle = t % 18;
  /* 0 low .. 1 high: still for a while, then a quick run */
  let u = 0;
  let moving = false;

  if (cycle >= 7 && cycle < 8.6) {
    u = ease(clampu((cycle - 7) / 1.6));
    moving = true;
  } else if (cycle >= 8.6 && cycle < 15) {
    u = 1;
  } else if (cycle >= 15 && cycle < 16.6) {
    u = 1 - ease(clampu((cycle - 15) / 1.6));
    moving = true;
  }

  const wy = 742 - 235 - u * 110;
  const { cx, half } = env.trunk(wy);
  const [x, y] = env.proj(cx + half * 0.98, wy);

  if (y < -16 || y > env.H + 16) return;

  const poked = env.since("squirrel");
  const chatter = poked < 1.9;
  const hop = chatter ? -Math.round(3 * Math.abs(Math.sin(poked * 9))) : 0;
  const flick = chatter
    ? Math.floor(poked * 14) % 2 === 0
    : !env.reduced && Math.floor(env.tm * 1.4) % 3 === 0;
  const pal = {
    r: [176, 84, 40],
    t: flick ? [226, 130, 70] : [208, 112, 56],
    c: [242, 218, 182],
    e: [20, 14, 12],
  };
  const sx = Math.round(x);
  const sy = Math.round(y) + hop;

  if (moving) {
    /* running: head up the trunk, legs working */
    stamp(env, sx - 1, sy - 8, SQUIRREL_CLIMB, pal);
    if (env.tick % 2 === 0) env.put(sx + 2, sy, pal.r);
    else env.put(sx + 3, sy - 1, pal.r);
    env.hit("squirrel", sx - 2, sy - 9, 9, 11);
    bang(env, "squirrel", sx + 2, sy - 16);

    return;
  }

  stamp(env, sx - 1, sy - 8, SQUIRREL, pal);
  if (flick) {
    env.put(sx - 2, sy - 8, pal.t);
    env.put(sx - 3, sy - 9, pal.t);
  }
  env.hit("squirrel", sx - 3, sy - 9, 13, 11);
  bang(env, "squirrel", sx + 3, sy - 17);

  if (chatter) {
    /* it scolds, and flings an acorn */
    const ax = sx + 8 + poked * 14;
    const ay = sy - 7 - 9 * poked + 16 * poked * poked;

    env.put(Math.round(ax), Math.round(ay), [96, 66, 38]);
    env.put(Math.round(ax), Math.round(ay) + 1, [196, 144, 80]);
    /* little "chk" dashes by the mouth */
    if (Math.floor(poked * 10) % 2 === 0) {
      env.put(sx + 10, sy - 6, [255, 246, 200]);
      env.put(sx + 11, sy - 7, [255, 246, 200]);
      env.put(sx + 11, sy - 5, [255, 246, 200]);
    }
  }
}

function drawBlaze(env: CharmEnv) {
  const warm = [255, 150, 60];

  for (let y = 0; y < env.H * 0.55; y++) {
    const a = 0.05 * (1 - y / (env.H * 0.55));

    for (let x = 0; x < env.W; x += 1) env.blend(x, y, warm, a);
  }

  const cols = [[255, 110, 40], [255, 170, 60], [255, 220, 120], [220, 60, 30]];

  for (let k = 0; k < 34; k++) {
    const span = env.H + 10;
    const sp = 6 + hash(k, 5) * 10;
    const rise = ((env.reduced ? 0 : env.tm) * sp + hash(k, 6) * span) % span;
    const y = Math.round(env.H + 4 - rise);
    const x = Math.round(
      hash(k, 7) * env.W + 5 * Math.sin((env.reduced ? 0 : env.tm) * 0.9 + k * 2.3),
    );
    const flick = Math.sin((env.reduced ? 0 : env.tm) * 6 + k) > -0.3;

    if (!flick) continue;
    env.blend(x, y, cols[k % 4], 0.85);
    env.blend(x, y + 1, cols[k % 4], 0.35);
  }
}

function drawSyrup(env: CharmEnv) {
  const wy = 742 - 130;
  const { cx, half } = env.trunk(wy);
  const [sx, sy] = env.proj(cx - half * 0.98, wy);

  if (sy < -16 || sy > env.H + 16) return;

  const x = Math.round(sx);
  const y = Math.round(sy);
  const metal = [150, 156, 168];
  const dark = [92, 98, 112];
  const rim = [196, 202, 214];
  const syrup = [214, 142, 38];

  /* the spile: a pipe from the trunk to the bucket */
  env.put(x + 1, y - 3, dark);
  env.put(x, y - 3, dark);
  env.put(x - 1, y - 3, rim);

  /* the bucket, hung below it */
  const rows = ["rrrrrrr", "mmmmmmm", "mmmmmmd", "mmmmmmd", ".mmmmd."];

  stamp(env, x - 7, y - 1, rows, { r: rim, m: metal, d: dark });
  stamp(env, x - 6, y, ["sssss"], { s: syrup });

  /* a drop swells at the spile, falls into the bucket */
  const cycle = env.reduced ? 0.2 : (env.tm % 2.2) / 2.2;

  if (cycle < 0.3) env.put(x - 1, y - 2, syrup);
  else if (cycle < 0.55) env.put(x - 1, y - 2 + Math.round((cycle - 0.3) * 10), syrup);
}

/* ------------------------------------------------------------ */
/* the oak's                                                     */
/* ------------------------------------------------------------ */

function drawMast(env: CharmEnv) {
  const cap = [96, 66, 38];
  const nut = [196, 144, 80];

  fallers(env, 6, 14, 53, (x, y, _k, ph) => {
    const tumble = env.reduced ? 0 : Math.floor(env.tm * 5 + ph) % 2;

    env.put(x, y, cap);
    env.put(x + 1, y, cap);
    env.put(x + tumble, y + 1, nut);
    env.put(x + 1 - tumble, y + 1, nut);
    env.put(x + (tumble ? 0 : 1), y + 2, nut);
  }, 3);
}

function drawDaisies(env: CharmEnv) {
  groundFlowers(env, 13, 71, (x, y, k) => {
    const sw = swayOffset(env.tick, k * 1.3, 1);
    const stem = [58, 130, 60];

    env.put(x, y, stem);
    env.put(x, y - 1, stem);
    env.put(x, y - 2, stem);
    const fx = x + sw;
    const fy = y - 4;

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
      env.put(fx + dx, fy + dy, [250, 250, 244]);
    }
    env.put(fx, fy, [244, 196, 56]);
  });
}

const JAY = [
  "..bb.....",
  ".bbbb....",
  ".bBbbbb..",
  "wwbbbbbb.",
  ".wwBbbbbk",
  "..wwbbbk.",
  "...bbbb..",
  "....k.k..",
];

/** The jay hops about the roots; poked, it flies a loop and lands again. */
function drawJay(env: CharmEnv) {
  if (env.groundY > env.H + 20) return;

  const c = env.trunk(742);
  const t = env.reduced ? 0 : env.tm;
  const period = 1.5;
  const n = Math.floor(t / period);
  const u = (t % period) / period;
  const spot = (i: number) =>
    c.cx + c.half * 1.2 + 90 + 70 * (hash(i, 9) - 0.5);
  const hopU = clampu(u / 0.25);
  const wx = spot(n - 1) + (spot(n) - spot(n - 1)) * ease(hopU);
  const arc = u < 0.25 ? Math.round(5 * Math.sin(Math.PI * hopU)) : 0;
  const face = spot(n) < spot(n - 1);
  const [gx, gy] = env.proj(wx, 742);
  let x = Math.round(gx);
  let y = Math.round(gy) - 8 - arc;
  const poked = env.since("jay");
  const FLIGHT = 3.4;

  if (poked < FLIGHT) {
    /* up and away to the right, then back round to land */
    const f = poked / FLIGHT;
    const loop = Math.sin(Math.PI * f);

    x += Math.round(78 * loop * (f < 0.5 ? 1 : 0.85));
    y -= Math.round(60 * Math.pow(loop, 0.7));

    const flap = env.reduced ? 0 : env.tick % 2;
    const dirR = f < 0.5 ? 1 : -1;
    const bl = [70, 120, 214];
    const dk = [30, 52, 120];
    const wh = [236, 240, 248];

    for (let i = 0; i < 5; i++) env.put(x + i * dirR, y + 3, i < 2 ? wh : bl);
    for (let i = 1; i < 4; i++) env.put(x + i * dirR, y + 2, bl);
    env.put(x + 5 * dirR, y + 3, [24, 22, 28]);
    env.put(x + 4 * dirR, y + 2, dk);
    env.put(x + 4 * dirR, y + 1, bl);
    env.put(x + 3 * dirR, y + 1, bl);
    /* wings: up, then down */
    for (let i = 1; i <= 4; i++) {
      env.put(x + (2 - i * 0.4) * dirR | 0, y + 2 + (flap ? i : -i), i > 2 ? dk : bl);
      env.put(x + (3 - i * 0.4) * dirR | 0, y + 2 + (flap ? i : -i), bl);
    }
    env.hit("jay", x - 3, y - 4, 12, 12);
    bang(env, "jay", x + 2, y - 9);

    return;
  }

  const pal = { b: [70, 120, 214], B: [30, 52, 120], w: [236, 240, 248], k: [24, 22, 28] };
  const peck = u > 0.45 && u < 0.7 && hash(n, 12) > 0.4 ? 1 : 0;

  stamp(env, x - 4, y + peck, JAY, pal, face);
  if (hash(n, 2) > 0.5) {
    env.put(x + (face ? -5 : 5), y + 3 + peck, [150, 96, 52]);
  }
  env.hit("jay", x - 5, y - 1, 11, 10);
  bang(env, "jay", x + 1, y - 8);

  /* a scolding "rakk" after being poked, as it lands */
  if (poked < FLIGHT + 0.8 && Math.floor(poked * 10) % 2 === 0) {
    env.put(x + (face ? -7 : 7), y + 1, [255, 246, 200]);
    env.put(x + (face ? -8 : 8), y, [255, 246, 200]);
  }
}

function drawDapple(env: CharmEnv) {
  const t = env.reduced ? 0 : env.tm;

  for (let k = 0; k < 11; k++) {
    const cx = (hash(k, 11) * env.W + t * (1.2 + hash(k, 12)) * 2) % (env.W + 30) - 15;
    const cy = 30 + hash(k, 13) * (env.H - 40) + 4 * Math.sin(t * 0.4 + k);
    const rx = 5 + hash(k, 14) * 7;
    const ry = rx * 0.55;

    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x / rx) ** 2 + (y / ry) ** 2;

        if (d > 1) continue;
        if (hash(Math.round(cx + x), Math.round(cy + y)) > 0.72 + 0.28 * (1 - d)) continue;
        env.blend(Math.round(cx + x), Math.round(cy + y), [255, 240, 170], 0.15 * (1 - d * 0.6));
      }
    }
  }
}

function drawHollow(env: CharmEnv) {
  const wy = 742 - 180;
  const { cx, half } = env.trunk(wy);
  const [sx, sy] = env.proj(cx + half * 0.15, wy);

  if (sy < -16 || sy > env.H + 16) return;

  const x = Math.round(sx);
  const y = Math.round(sy);
  const rim = [70, 52, 34];
  const dark = [18, 12, 10];
  const moss = env.moss[1];

  for (let j = -5; j <= 5; j++) {
    for (let i = -3; i <= 3; i++) {
      const d = (i / 3.4) ** 2 + (j / 5.4) ** 2;

      if (d <= 0.62) env.put(x + i, y + j, dark);
      else if (d <= 1) env.put(x + i, y + j, j < -3 ? moss : rim);
    }
  }

  const shut = !env.reduced && Math.floor(env.tm * 10) % 42 < 2;
  const eye = [255, 214, 70];

  if (!shut) {
    env.put(x - 2, y - 1, eye);
    env.put(x + 1, y - 1, eye);
    env.put(x - 2, y, [255, 150, 40]);
    env.put(x + 1, y, [255, 150, 40]);
  } else {
    env.put(x - 2, y - 1, rim);
    env.put(x + 1, y - 1, rim);
  }
}

/* ------------------------------------------------------------ */
/* the birch's                                                   */
/* ------------------------------------------------------------ */

function drawCatkins(env: CharmEnv) {
  const tan = [214, 184, 108];
  const fleck = [150, 118, 62];

  for (const a of env.anchors) {
    for (let j = 0; j < 3; j++) {
      const len = 5 + Math.floor(hash(a.id, j) * 4);
      const sx = Math.round(a.x + (j - 1) * 3) + swayOffset(env.tick, a.id * 0.9 + j, 1);
      const sy = Math.round(a.y) + 1;

      for (let i = 0; i < len; i++) {
        env.put(sx + (i > len - 3 ? swayOffset(env.tick, a.id + j + i * 0.3, 1) : 0), sy + i, i % 2 === 0 ? tan : fleck);
      }
    }
  }
}

function drawAnemones(env: CharmEnv) {
  groundFlowers(env, 16, 83, (x, y, k) => {
    const sw = swayOffset(env.tick, k * 1.7, 1);
    const leaf = [44, 118, 62];

    env.put(x - 1, y, leaf);
    env.put(x, y - 1, leaf);
    env.put(x + 1, y, leaf);
    env.put(x, y, leaf);
    env.put(x + sw, y - 2, leaf);
    const fx = x + sw;
    const fy = y - 4;

    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]]) {
      if (Math.abs(dx) + Math.abs(dy) <= 3) env.put(fx + dx, fy + dy, [250, 250, 252]);
    }
    env.put(fx, fy, [246, 214, 90]);
  });
}

const WOODPECKER = [
  "..rr.",
  ".kkkw",
  ".kkkk",
  "kwkkw",
  "kkwkk",
  "kwkkk",
  ".kkkw",
  ".kkk.",
  "..k..",
];

/** The woodpecker works up and down the trunk, tapping as it goes. */
function drawWoodpecker(env: CharmEnv) {
  const t = env.reduced ? 0 : env.tm;
  const hopLen = 0.8;
  const step = Math.floor(t / hopLen);
  const within = (t % hopLen) / hopLen;
  /* up the trunk in steps, then back down */
  const stepsTotal = 9;
  const tri = (i: number) => {
    const m = i % (stepsTotal * 2);

    return m < stepsTotal ? m : stepsTotal * 2 - m;
  };
  const from = tri(step);
  const to = tri(step + 1);
  const pos = from + (to - from) * (within < 0.25 ? ease(within / 0.25) : 1);
  const wy = 742 - 150 - pos * 26;
  const { cx, half } = env.trunk(wy);
  const [sx, sy] = env.proj(cx + half * 0.96, wy);

  if (sy < -16 || sy > env.H + 16) return;

  const poked = env.since("woodpecker");
  const drumroll = poked < 2.4;
  const tapping = drumroll || within >= 0.3;
  const beat = tapping
    ? drumroll
      ? Math.floor(poked * 22) % 2
      : Math.floor((within - 0.3) * 18) % 2
    : 0;
  const x = Math.round(sx) - 1 - beat;
  const y = Math.round(sy) - 5;

  stamp(env, x, y, WOODPECKER, { r: [214, 40, 44], k: [30, 28, 32], w: [244, 244, 240] }, true);
  env.hit("woodpecker", x - 1, y - 1, 8, 11);
  bang(env, "woodpecker", x + 4, y - 8);

  if (tapping && beat === 1) {
    const k = drumroll ? Math.floor(poked * 22) : Math.floor(within * 18);

    env.put(x + 5 + (k % 4), y + 2 - (k % 3), [220, 190, 140]);
    env.put(x + 6 + (k % 3), y + 4 + (k % 2), [200, 170, 120]);
  }
  if (drumroll && Math.floor(poked * 11) % 2 === 0) {
    /* "tok tok" lines flying off the beak */
    env.put(x + 7, y + 3, [255, 246, 200]);
    env.put(x + 8, y + 2, [255, 246, 200]);
    env.put(x + 8, y + 4, [255, 246, 200]);
  }
}

function drawMoonbeam(env: CharmEnv) {
  const cool = [196, 214, 255];
  const t = env.reduced ? 0 : env.tm;

  for (let i = 0; i < 3; i++) {
    const x0 = 24 + i * 84 + Math.sin(i * 2.7) * 10;
    const half = 9 + i * 2;
    const breathe = 0.75 + 0.25 * Math.sin(t * 0.45 + i * 1.9);

    for (let y = 0; y < env.H; y++) {
      const cx = x0 + y * 0.42;
      const a = (1 - y / env.H) * 0.12 * breathe;

      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const e = 1 - Math.abs(x - cx) / half;

        if (e > 0) env.blend(x, y, cool, a * Math.min(1, e * 1.5));
      }
    }
  }

  for (let k = 0; k < 20; k++) {
    const span = env.H + 10;
    const rise = (t * (3 + hash(k, 3) * 4) + hash(k, 4) * span) % span;
    const y = Math.round(env.H + 4 - rise);
    const x = Math.round(hash(k, 5) * env.W + 6 * Math.sin(t * 0.5 + k));
    const tw = Math.sin(t * 2 + k * 3) > 0;

    if (tw) env.blend(x, y, mixc(cool, WHITE, 0.5), 0.85);
  }
}

function drawRibbons(env: CharmEnv) {
  const bark = [240, 234, 220];
  const under = [176, 170, 156];

  for (let k = 0; k < 6; k++) {
    const wy = 742 - 80 - k * 90;
    const { cx, half } = env.trunk(wy);
    const dir = k % 2 === 0 ? -1 : 1;
    const [sx, sy] = env.proj(cx + dir * half * 0.97, wy);

    if (sy < -20 || sy > env.H + 20) continue;

    const len = 13 + (k % 3) * 3;
    const ph = k * 1.9;

    for (let i = 0; i < len; i++) {
      const t = i / len;
      const flutter = swayOffset(env.tick, ph + i * 0.35, 2) * t;
      const x = Math.round(sx + dir * (i * 0.85 + 1) + flutter);
      const y = Math.round(sy + Math.sin(t * 3.4 + ph) * 3 + t * 5);

      env.put(x, y, bark);
      if (i % 2 === 0) env.put(x, y + 1, under);
    }
  }
}

/* ------------------------------------------------------------ */
/* the elm's                                                     */
/* ------------------------------------------------------------ */

function drawCoins(env: CharmEnv) {
  const disc = [214, 214, 150];
  const edge = [160, 168, 100];
  const heart = [120, 110, 70];

  fallers(env, 9, 6, 91, (x, y) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) env.put(x + dx, y + dy, disc);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) env.put(x + dx, y + dy, edge);
    env.put(x, y, heart);
  }, 16);
}

function drawWisteria(env: CharmEnv) {
  const stem = [58, 96, 60];
  const bloom = [[150, 110, 206], [186, 152, 232], [124, 86, 178]];

  for (const a of env.anchors) {
    if (hash(a.id, 33) > 0.7) continue;

    const len = 9 + Math.floor(hash(a.id, 3) * 6);
    const sx = Math.round(a.x) + swayOffset(env.tick, a.id * 0.6, 1);
    const sy = Math.round(a.y) + 1;

    for (let i = 0; i < len; i++) {
      const wide = i < 2 ? 0 : i < len - 3 ? 1 : 0;
      const sw = Math.round(swayOffset(env.tick, a.id + i * 0.25, 2) * (i / len));

      env.put(sx + sw, sy + i, i < 2 ? stem : bloom[(i + a.id) % 3]);
      if (wide) {
        env.put(sx + sw - 1, sy + i, bloom[(i + a.id + 1) % 3]);
        if (i > 3) env.put(sx + sw + 1, sy + i, bloom[(i + a.id + 2) % 3]);
      }
    }
  }
}

function drawOriole(env: CharmEnv) {
  if (env.anchors.length === 0) return;

  let best = env.anchors[0];

  for (const a of env.anchors) {
    if (hash(a.id, 7) < hash(best.id, 7)) best = a;
  }

  const t = env.reduced ? 0 : env.tm;
  const poked = env.since("oriole");
  const x = Math.round(best.x);
  const y = Math.round(best.y);
  const thread = [150, 128, 90];
  const nest = [168, 140, 96];
  const nestDark = [122, 98, 64];
  const pal = { o: [246, 140, 24], k: [26, 22, 26], w: [244, 244, 236], e: [255, 214, 120] };

  for (let i = 0; i < 3; i++) env.put(x, y + i, thread);

  const sway = swayOffset(env.tick, best.id, poked < 2.6 ? 2 : 1);
  const rows = [".nnn.", "nNnNn", "nnnnn", "nNnNn", ".nnn.", "..n.."];

  stamp(env, x - 2 + sway, y + 3, rows, { n: nest, N: nestDark });
  env.put(x + sway, y + 6, [30, 22, 16]);

  /* the bird: it sits on the bough, hopping between two spots, and bobs */
  const spot = Math.floor(t / 5) % 2 === 0 ? 8 : 14;
  let bx = x + spot;
  let by = y - 1 + (env.tick % 6 < 2 ? 1 : 0);
  let flying = false;

  if (poked < 2.6) {
    /* it flits once round the nest, singing */
    const a = poked * 5.2;

    bx = Math.round(x + 2 + Math.cos(a) * 13);
    by = Math.round(y + 4 + Math.sin(a) * 8 - 2);
    flying = true;
  }

  if (flying) {
    const flap = env.tick % 2;

    stamp(env, bx, by, [".kk..", "kkkoo", ".ookk", ".ooow", "..o.k"], pal);
    env.put(bx + 1, by + 1, pal.e);
    env.put(bx - 1, by + (flap ? -1 : 2), pal.o);
    env.put(bx - 2, by + (flap ? -2 : 3), pal.k);
  } else {
    stamp(env, bx, by, [".kk..", "kkkoo", ".ookk", ".ooow", "..o.k"], pal);
    env.put(bx + 1, by + 1, pal.e);
  }
  env.hit("oriole", bx - 2, by - 2, 9, 8);
  bang(env, "oriole", bx + 2, by - 8);

  /* it sings now and then, and a great deal when poked */
  const song = poked < 2.6 ? ((poked * 2.4) % 1) * 0.5 : env.reduced ? 0.5 : (t % 4.2) / 4.2;

  if (song < 0.5) {
    const nx = bx + 5 + Math.round(song * 8);
    const ny = by - Math.round(song * 12) - 1;

    env.put(nx, ny, [255, 236, 170]);
    env.put(nx, ny - 1, [255, 236, 170]);
    env.put(nx + 1, ny - 2, [255, 236, 170]);
  }
  if (poked < 2.6) {
    const k = Math.floor(poked * 4) % 3;

    env.put(bx - 4 - k, by - 4 - k * 2, [255, 236, 170]);
    env.put(bx - 4 - k, by - 5 - k * 2, [255, 236, 170]);
    env.put(bx - 3 - k, by - 6 - k * 2, [255, 236, 170]);
  }
}

function drawShade(env: CharmEnv) {
  const cool = [10, 34, 30];

  /* a cool vault over the top of the frame */
  for (let y = 0; y < env.H * 0.34; y++) {
    const a = 0.2 * (1 - y / (env.H * 0.34)) ** 1.4;

    for (let x = 0; x < env.W; x++) env.blend(x, y, cool, a);
  }

  /* dappled patches of shade sliding over the ground */
  const t = env.reduced ? 0 : env.tm;

  for (let k = 0; k < 9; k++) {
    const cx = (hash(k, 21) * env.W + t * (1 + hash(k, 22) * 1.4)) % (env.W + 40) - 20;
    const cy = env.H * 0.62 + hash(k, 23) * env.H * 0.3;
    const rx = 9 + hash(k, 24) * 12;
    const ry = rx * 0.38;

    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x / rx) ** 2 + (y / ry) ** 2;

        if (d > 1) continue;
        env.blend(Math.round(cx + x), Math.round(cy + y), cool, 0.2 * (1 - d * 0.7));
      }
    }
  }
}

function drawLantern(env: CharmEnv) {
  if (env.groundY > env.H + 30) return;

  const c = env.trunk(742);
  const [sx, sy] = env.proj(c.cx + c.half * 1.2 + 200, 742);
  const x = Math.round(sx);
  const y = Math.round(sy);

  if (x < -10 || x > env.W + 10) return;

  const iron = [44, 46, 54];
  const flick = env.reduced ? 1 : 0.8 + 0.2 * Math.sin(env.tm * 7 + 1);

  for (let i = 0; i < 24; i++) env.put(x, y - i, iron);
  env.put(x - 1, y - 1, iron);
  env.put(x + 1, y - 1, iron);
  env.put(x - 2, y, iron);
  env.put(x + 2, y, iron);
  /* the lamp: a glass box with a flame inside and a little cap */
  stamp(env, x - 3, y - 31, ["..ccc..", ".ccccc."], { c: iron });
  stamp(env, x - 3, y - 29, [".gfffg.", ".gfyfg.", ".gfyfg.", ".gfffg."], {
    g: iron,
    f: mixc([255, 214, 120], [255, 170, 60], 1 - flick),
    y: [255, 246, 190],
  });

  /* its light */
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const d = Math.hypot(dx, dy);

      if (d > 12) continue;
      env.blend(x + dx, y - 27 + dy, [255, 214, 120], 0.2 * flick * (1 - d / 12));
    }
  }
  for (let dx = -14; dx <= 14; dx++) {
    env.blend(x + dx, y, [255, 214, 120], 0.12 * flick * (1 - Math.abs(dx) / 15));
  }
}

/* ------------------------------------------------------------ */
/* the redwood's                                                 */
/* ------------------------------------------------------------ */

function drawDrip(env: CharmEnv) {
  const drop = [200, 226, 246];

  fallers(env, 9, 16, 41, (x, y) => {
    env.put(x, y, drop);
    env.put(x, y + 1, mixc(drop, WHITE, 0.4));
    if (env.groundY < env.H + 4 && y > env.groundY - 4 && y < env.groundY) {
      env.blend(x - 1, env.groundY, drop, 0.7);
      env.blend(x + 1, env.groundY, drop, 0.7);
    }
  }, 3);
}

function drawFerns(env: CharmEnv) {
  if (env.groundY > env.H + 30) return;

  const c = env.trunk(742);
  const greens = [[28, 92, 48], [48, 132, 70], [86, 176, 100]];

  for (let f = 0; f < 5; f++) {
    const side = f % 2 === 0 ? -1 : 1;
    const wx = c.cx + side * (c.half * 1.1 + 40 + (f >> 1) * 85 + hash(f, 5) * 30);
    const [bx, by] = env.proj(wx, 742 + 6);
    const x0 = Math.round(bx);
    const y0 = Math.round(by);

    if (x0 < -20 || x0 > env.W + 20) continue;

    for (let k = 0; k < 7; k++) {
      const ang = -Math.PI / 2 + (k - 3) * 0.42;
      const len = 9 + (3 - Math.abs(k - 3)) * 2 + hash(f * 9 + k, 8) * 2;
      const sway = swayOffset(env.tick, f * 1.4 + k * 0.5, 1);

      for (let s = 0; s <= len; s += 1) {
        const t = s / len;
        const x = x0 + Math.cos(ang) * s + Math.round(sway * t);
        const y = y0 + Math.sin(ang) * s * 0.9 + t * t * len * 0.55;

        env.put(Math.round(x), Math.round(y), greens[t < 0.35 ? 0 : t < 0.75 ? 1 : 2]);
        if (s % 2 === 0 && t > 0.15) {
          env.put(Math.round(x) + (k < 3 ? -1 : 1), Math.round(y) + 1, greens[1]);
        }
      }
    }
  }
}

function drawSlug(env: CharmEnv) {
  const t = env.reduced ? 120 : env.tm;
  const climb = (t * 2.6) % 460;
  const wy = 742 - 60 - climb;
  const { cx, half } = env.trunk(wy);
  const [sx, sy] = env.proj(cx + half * 0.88, wy);

  if (sy < -10 || sy > env.H + 10) return;

  const x = Math.round(sx);
  const y = Math.round(sy);
  const fade = Math.min(1, climb / 30, (460 - climb) / 30);
  const body = [244, 218, 64];
  const spot = [120, 84, 30];
  const poked = env.since("slug");
  const curled = poked < 3.6;

  /* the shining trail it leaves */
  for (let i = 1; i < 26; i++) {
    env.blend(x - 1 + (i % 3 === 0 ? 1 : 0), y + i, [236, 244, 250], 0.34 * (1 - i / 26) * fade);
  }

  if (curled) {
    /* it bunches up, feelers in, and blows a slow bubble */
    for (let i = 0; i < 4; i++) env.blend(x - 1 + i, y, body, fade);
    for (let i = 0; i < 4; i++) env.blend(x - 1 + i, y - 1, body, 0.9 * fade);
    env.blend(x, y - 2, body, fade);
    env.blend(x + 1, y - 2, body, fade);
    env.blend(x, y - 1, spot, fade);
    const b = (poked * 1.2) % 1;

    env.blend(x + 3, y - 3 - Math.round(b * 8), [236, 244, 250], 0.8 * (1 - b));
    env.blend(x + 4, y - 3 - Math.round(b * 8), [236, 244, 250], 0.5 * (1 - b));
  } else {
    for (let i = 0; i < 7; i++) env.blend(x - 3 + i, y, body, fade);
    for (let i = 0; i < 6; i++) env.blend(x - 3 + i, y - 1, body, 0.9 * fade);
    env.blend(x - 2, y - 1, spot, fade);
    env.blend(x + 1, y - 1, spot, fade);
    env.blend(x + 3, y - 2, body, fade);
    /* feelers, waving a pixel */
    const w = env.tick % 8 < 4 ? 0 : 1;

    env.blend(x + 3 + w, y - 3, [60, 50, 30], fade);
    env.blend(x + 2 - w, y - 3, [60, 50, 30], fade);
  }
  env.hit("slug", x - 5, y - 5, 12, 8);
  bang(env, "slug", x + 1, y - 11);
}

function drawMist(env: CharmEnv) {
  const fog = [226, 236, 242];
  const t = env.reduced ? 0 : env.tm;

  /* banks of fog at set heights up the tree: low at the ground, and again
     as the climb passes through them */
  for (let band = 0; band < 5; band++) {
    const wy = 742 - 24 - band * 520;
    const [, sy] = env.proj(0, wy);

    if (sy < -30 || sy > env.H + 30) continue;

    const thick = band === 0 ? 20 : 15;
    const strength = band === 0 ? 0.3 : 0.2;

    for (let y = -thick; y <= thick; y++) {
      for (let x = 0; x < env.W; x += 1) {
        const n =
          Math.sin((x + t * (4 + band)) * 0.045 + band * 2.1) * 0.5 +
          Math.sin((x - t * 3) * 0.11 + y * 0.05) * 0.5;
        const edge = 1 - Math.abs(y) / thick;
        const a = strength * edge * (0.45 + 0.35 * n + 0.2) ;

        if (a <= 0.02) continue;
        if (hash(x, y + band * 7) > 0.35 + edge) continue;
        env.blend(x, Math.round(sy) + y, fog, a);
      }
    }
  }
}

function drawGrove(env: CharmEnv) {
  if (env.groundY > env.H + 30) return;

  const c = env.trunk(742);
  const greens = [[18, 70, 44], [30, 100, 58], [56, 140, 82]];
  const trunk = [92, 48, 30];
  const spots = [-250, -170, -105, 120, 195, 270];

  spots.forEach((dx, i) => {
    const [bx, by] = env.proj(c.cx + dx, 742 + 3 + (i % 2) * 8);
    const x = Math.round(bx);
    const y = Math.round(by);
    const h = 11 + (i % 3) * 3;

    if (x < -10 || x > env.W + 10) return;

    env.put(x, y, trunk);
    env.put(x, y - 1, trunk);

    for (let j = 0; j < h; j++) {
      const w = Math.round((1 - j / h) * (4 + (i % 2)));
      const sway = swayOffset(env.tick, i * 1.1 + j * 0.2, 1) * (j / h);

      for (let k = -w; k <= w; k++) {
        env.put(x + k + Math.round(sway), y - 2 - j, greens[(k + j + 20) % 3 === 0 ? 2 : j % 2]);
      }
    }
  });
}

/* ------------------------------------------------------------ */

const DRAWERS: Record<string, (env: CharmEnv) => void> = {
  keys: drawKeys,
  creeper: drawCreeper,
  squirrel: drawSquirrel,
  blaze: drawBlaze,
  syrup: drawSyrup,
  mast: drawMast,
  daisies: drawDaisies,
  jay: drawJay,
  dapple: drawDapple,
  hollow: drawHollow,
  catkins: drawCatkins,
  anemone: drawAnemones,
  woodpecker: drawWoodpecker,
  moonbeam: drawMoonbeam,
  ribbons: drawRibbons,
  coins: drawCoins,
  wisteria: drawWisteria,
  oriole: drawOriole,
  shade: drawShade,
  lantern: drawLantern,
  drip: drawDrip,
  ferns: drawFerns,
  slug: drawSlug,
  mist: drawMist,
  grove: drawGrove,
};

/** Draw every charm that is switched on, light first and creatures last. */
export function drawCharms(words: readonly string[], env: CharmEnv) {
  const order = ["dapple", "shade", "moonbeam", "mist", "blaze"];
  const sorted = [
    ...words.filter((w) => order.includes(w)),
    ...words.filter((w) => !order.includes(w)),
  ];

  for (const word of sorted) DRAWERS[word]?.(env);
}

export const CHARM_WORDS = Object.keys(DRAWERS);
