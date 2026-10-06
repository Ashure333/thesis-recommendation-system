/**
 * PIXEL GROWTH TREE — the Tree of Knowledge's tree, grown like the
 * Crimson Tree reference: a 192x192 procedural pixel tree that
 * grows from the root up over a few seconds, with a per-species
 * five-tone foliage ramp, catmull-rom limbs, canopy clusters that
 * pop in at their birth time, and falling leaves once it is fully
 * grown.
 *
 * Controls: Pause/Play, a growth slider (0..1000 = 0%..100%), and
 * Replay. The tree's height in feet adds a few dark root pixels so
 * fertilizer visibly anchors a taller tree.
 */

import { useEffect, useRef, useState } from "react";
import {
  treeSpecies,
  type TreeSpeciesId,
} from "../../data/knowledge";

/* The reference's native window: 128x128, scaled by
   the 800-unit world just like the original. */
const W = 128;
const H = 128;
const S = W / 800;

/* ---------- palette helpers ---------- */

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  const hex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
}

function shift(color: string, amount: number): string {
  const [r, g, b] = hexToRgb(color);
  return rgbToHex([r + amount, g + amount, b + amount]);
}

/* ---------- seeded noise ---------- */

const rng = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return (h & 0xffff) / 65535;
};

const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

const lerpArr = (values: number[], u: number) => {
  const f = u * (values.length - 1);
  const i = Math.min(values.length - 2, f | 0);
  return values[i] + (values[i + 1] - values[i]) * (f - i);
};

function spline(pts: number[][], n: number): number[][] {
  const out: number[][] = [];
  const m = pts.length - 1;
  for (let i = 0; i < m; i++) {
    const a = pts[Math.max(i - 1, 0)];
    const b = pts[i];
    const c = pts[i + 1];
    const d = pts[Math.min(i + 2, m)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0,
        1,
      ].map((j) =>
        0.5 *
        (2 * b[j] +
          (-a[j] + c[j]) * t +
          (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 +
          (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3),
      ));
    }
  }
  out.push(pts[m]);
  return out;
}

/* ---------- per-species tree shapes ---------- */

interface TreeShape {
  trunk: number[][];
  trunkW: number[];
  branches: { pts: number[][]; ws: number[]; b0: number; dur: number }[];
  clusters: {
    cx: number; cy: number; rx: number; ry: number; tone: number;
    lo: number; hi: number;
  }[];
  /** Extra clusters (elder stage / ground clumps). */
  elder: {
    cx: number; cy: number; rx: number; ry: number; tone: number;
    lo?: number; hi?: number; start?: number;
  }[];
}

/* The reference's exact sprite palettes for the default tree. */
const CRIMSON_PALETTE: Palette = {
  bark: ["#221b2b", "#322a3f", "#443a52", "#5a4e66"],
  foliage: ["#3f0614", "#76091c", "#b30f20", "#e5111f", "#ff3345"],
  accent: "#4f5340",
  cream: ["#f3dcd2", "#ffeee8", "#e8c7bd"],
};

const SHAPES: Record<TreeSpeciesId, TreeShape> = {
  crimson: {
    trunk: [
      [400, 742], [398, 690], [396, 630], [398, 570], [402, 510],
      [404, 450], [403, 390], [402, 330], [402, 270], [403, 245],
    ],
    trunkW: [104, 94, 86, 80, 74, 68, 60, 50, 40, 32],
    branches: [
      { pts: [[402,520],[360,495],[310,455],[262,410],[225,360]], ws: [30,24,18,12,6], b0: .13, dur: .2 },
      { pts: [[404,515],[450,490],[500,450],[545,405],[580,355]], ws: [30,24,18,12,6], b0: .14, dur: .2 },
      { pts: [[403,440],[365,400],[325,350],[290,290],[262,230]], ws: [28,22,16,10,5], b0: .2, dur: .2 },
      { pts: [[404,435],[445,395],[485,345],[520,285],[545,225]], ws: [28,22,16,10,5], b0: .22, dur: .2 },
      { pts: [[403,350],[375,300],[350,240],[335,180],[330,125]], ws: [22,17,12,8,4], b0: .28, dur: .16 },
      { pts: [[402,345],[432,295],[455,235],[470,175],[475,120]], ws: [22,17,12,8,4], b0: .3, dur: .16 },
      { pts: [[402,260],[402,200],[404,140],[404,85]], ws: [20,14,9,4], b0: .32, dur: .14 },
      { pts: [[262,410],[235,430],[205,430]], ws: [10,6,3], b0: .36, dur: .12 },
      { pts: [[545,405],[575,430],[600,430]], ws: [10,6,3], b0: .38, dur: .12 },
      { pts: [[400,735],[350,742],[305,738]], ws: [20,12,5], b0: -.07, dur: .12 },
      { pts: [[403,735],[452,742],[497,738]], ws: [20,12,5], b0: -.06, dur: .12 },
    ],
    clusters: [
      [400,95,80,45,.72],[330,120,70,45,.68],[470,120,70,45,.68],[400,55,40,25,.8],
      [260,185,85,55,.62],[400,170,90,55,.6],[540,185,85,55,.62],
      [200,265,85,55,.55],[330,260,85,55,.52],[470,260,85,55,.52],[600,265,85,55,.55],
      [175,350,75,50,.5],[300,345,80,50,.46],[420,340,80,50,.44],[540,345,80,50,.46],[630,350,75,50,.5],
      [210,430,70,40,.44],[330,435,70,40,.4],[470,435,70,40,.4],[590,430,70,40,.44],
      [270,500,60,30,.4],[400,515,70,30,.38],[530,500,60,30,.4],
    ].map(([cx, cy, rx, ry, tone]) => ({
      cx, cy, rx, ry, tone, lo: 2.8, hi: 4.2,
    })),
    elder: [
      { cx: 520, cy: 725, rx: 26, ry: 9, tone: 0.5, lo: 2, hi: 3.2, start: 0.93 },
      { cx: 285, cy: 722, rx: 22, ry: 8, tone: 0.55, lo: 1.8, hi: 2.8, start: 0.95 },
    ],
  },
  oak: {
    trunk: [
      [400, 742], [396, 690], [392, 640], [395, 590], [402, 540],
      [408, 490], [410, 440], [408, 390], [404, 340], [404, 290],
      [406, 245],
    ],
    trunkW: [130, 118, 108, 100, 94, 86, 76, 66, 56, 48, 40],
    branches: [
      { pts: [[404,500],[360,470],[300,440],[230,420],[170,380],[120,340]], ws: [58,46,36,26,16,8], b0: .13, dur: .22 },
      { pts: [[410,490],[460,460],[530,440],[600,420],[660,380],[700,340]], ws: [58,46,36,26,16,8], b0: .14, dur: .22 },
      { pts: [[412,560],[470,550],[540,540],[600,550],[650,540]], ws: [30,22,16,10,6], b0: .2, dur: .2 },
      { pts: [[405,400],[380,340],[340,290],[300,240],[270,190]], ws: [40,30,22,14,8], b0: .25, dur: .18 },
      { pts: [[408,400],[440,340],[480,290],[520,240],[560,200]], ws: [40,30,22,14,8], b0: .27, dur: .18 },
      { pts: [[406,330],[404,280],[400,230],[398,170],[400,120]], ws: [32,24,18,12,6], b0: .3, dur: .15 },
      { pts: [[230,420],[200,440],[160,470],[130,470]], ws: [14,10,6,3], b0: .38, dur: .12 },
      { pts: [[600,420],[630,460],[650,480],[665,500]], ws: [14,10,6,3], b0: .4, dur: .12 },
      { pts: [[300,440],[290,400],[250,370],[220,340]], ws: [10,8,5,3], b0: .4, dur: .12 },
      { pts: [[530,440],[540,400],[580,370],[610,340]], ws: [10,8,5,3], b0: .42, dur: .12 },
      { pts: [[400,735],[340,742],[290,738]], ws: [26,14,5], b0: -.07, dur: .12 },
      { pts: [[405,735],[460,742],[510,738]], ws: [24,12,5], b0: -.06, dur: .12 },
    ],
    clusters: [
      [400,130,120,60,.62],[270,160,110,60,.58],[530,160,110,60,.6],
      [160,230,100,70,.55],[640,230,100,70,.57],[400,205,140,70,.5],
      [300,265,110,65,.45],[500,265,110,65,.47],[110,330,80,60,.55],
      [690,330,80,60,.55],[210,335,100,60,.5],[590,335,100,60,.5],
      [400,305,120,60,.4],[150,420,60,40,.5],[650,410,65,45,.5],
      [250,415,70,40,.42],[550,405,70,40,.42],[640,520,70,40,.5],
      [520,485,60,32,.42],[130,470,50,30,.5],[330,95,55,32,.7],
      [480,92,55,30,.7],[610,160,60,40,.65],[190,150,60,40,.65],
    ].map(([cx, cy, rx, ry, tone]) => ({
      cx, cy, rx, ry, tone, lo: 2.8, hi: 4.2,
    })),
    elder: [
      { cx: 520, cy: 725, rx: 26, ry: 9, tone: 0.5, lo: 2, hi: 3.2, start: 0.93 },
      { cx: 285, cy: 722, rx: 22, ry: 8, tone: 0.55, lo: 1.8, hi: 2.8, start: 0.95 },
    ],
  },
  birch: {
    trunk: [
      [440, 742], [432, 650], [424, 580], [418, 520], [414, 470],
      [412, 430], [412, 395], [413, 360], [416, 325],
    ],
    trunkW: [56, 50, 44, 38, 34, 30, 26, 22, 18],
    branches: [
      { pts: [[413,470],[350,455],[300,430],[265,410]], ws: [14,9,5,3], b0: .18, dur: .2 },
      { pts: [[413,430],[470,420],[510,400]], ws: [14,9,5], b0: .2, dur: .18 },
      { pts: [[414,380],[360,355],[330,320]], ws: [10,6,3], b0: .26, dur: .16 },
      { pts: [[415,350],[470,320],[500,290]], ws: [10,6,3], b0: .28, dur: .15 },
    ],
    clusters: [
      [300,290,55,40,.6],[395,245,45,32,.7],[500,250,55,40,.6],
      [375,315,40,30,.5],[440,335,35,28,.5],[340,390,40,28,.5],
      [480,405,42,30,.5],[260,435,40,30,.6],[490,220,40,26,.75],
    ].map(([cx, cy, rx, ry, tone]) => ({
      cx, cy, rx, ry, tone, lo: 2.2, hi: 4.2,
    })),
    elder: [
      { cx: 420, cy: 400, rx: 36, ry: 26, tone: .45 },
      { cx: 330, cy: 260, rx: 28, ry: 20, tone: .6 },
      { cx: 520, cy: 300, rx: 30, ry: 22, tone: .55 },
    ],
  },
  elm: {
    trunk: [
      [440, 742], [428, 645], [414, 560], [402, 490], [394, 430],
      [388, 370], [386, 320], [378, 280], [368, 250], [356, 225],
    ],
    trunkW: [84, 70, 56, 46, 40, 36, 32, 28, 22, 16],
    branches: [
      { pts: [[388,370],[340,340],[300,300],[270,255]], ws: [22,14,8,4], b0: .2, dur: .2 },
      { pts: [[386,320],[450,300],[510,270],[545,235]], ws: [22,14,8,4], b0: .24, dur: .18 },
      { pts: [[370,300],[320,250]], ws: [14,7], b0: .32, dur: .14 },
      { pts: [[300,300],[255,330],[220,380]], ws: [16,10,6], b0: .28, dur: .18 },
    ],
    clusters: [
      [300,180,70,50,.6],[410,150,70,48,.65],[500,190,60,45,.55],
      [270,250,50,40,.5],[360,240,55,40,.45],[470,245,55,40,.5],
      [545,300,65,50,.5],[230,340,55,42,.6],[330,315,45,35,.42],
      [420,330,48,36,.42],[560,370,55,42,.5],[250,420,40,30,.5],
      [480,410,45,32,.5],[600,430,50,38,.55],
    ].map(([cx, cy, rx, ry, tone]) => ({
      cx, cy, rx, ry, tone, lo: 2.5, hi: 4.6,
    })),
    elder: [
      { cx: 600, cy: 460, rx: 30, ry: 24, tone: .5 },
      { cx: 220, cy: 440, rx: 32, ry: 24, tone: .55 },
      { cx: 410, cy: 100, rx: 34, ry: 24, tone: .7 },
    ],
  },
  redwood: {
    trunk: [
      [440, 742], [430, 600], [422, 480], [416, 380], [412, 300],
      [409, 240], [407, 190],
    ],
    trunkW: [70, 58, 46, 38, 32, 26, 20],
    branches: [
      { pts: [[414,470],[340,455],[300,445]], ws: [18,10,6], b0: .2, dur: .15 },
      { pts: [[409,380],[520,370],[560,360]], ws: [18,10,6], b0: .24, dur: .14 },
      { pts: [[407,300],[330,285]], ws: [16,8], b0: .3, dur: .12 },
      { pts: [[408,240],[510,230]], ws: [16,8], b0: .34, dur: .12 },
    ],
    clusters: [
      [440,480,120,34,.6],[440,410,108,30,.64],[440,345,96,28,.68],
      [440,285,84,26,.72],[440,235,70,24,.76],[440,195,52,22,.8],
      [440,160,38,18,.84],
    ].map(([cx, cy, rx, ry, tone]) => ({
      cx, cy, rx, ry, tone, lo: 3, hi: 5.2,
    })),
    elder: [
      { cx: 440, cy: 520, rx: 126, ry: 36, tone: .55 },
      { cx: 440, cy: 452, rx: 112, ry: 32, tone: .62 },
      { cx: 440, cy: 320, rx: 90, ry: 28, tone: .7 },
    ],
  },
};

/* ---------- palettes ---------- */

interface Palette {
  bark: string[];
  foliage: string[];
  accent: string;
  cream: string[];
}

function ramps(light: string, mid: string, deep: string): Palette {
  return {
    bark: [shift(mid, -70), shift(mid, -55), shift(mid, -34), shift(mid, -16)],
    foliage: [shift(deep, -40), deep, shift(mid, 10), mid, light],
    accent: "#4f5340", /* the reference's moss, verbatim */
    cream: ["#f3dcd2", "#ffeee8", "#e8c7bd"],
  };
}

/* ---------- component ---------- */

/* The reference's phases: growth (P in [0, 0.46)), zoom into the
   giant (0.46..0.66), then the ancient ascent (0.66..1). */
const PA = 0.46;
const PB = 0.2;
const PC = 0.34;

interface Art {
  /** Oak leaves have seven lobes; the crimson family five. */
  leafPoints: number;
  leafAmp: number;
  BX: number;
  ROOTX: number;
  ZM: number;
  DYW: number;
  /** Ancient-bark cell height / width and edge thresholds. */
  cellY: number;
  cellW: number;
  fxE: number;
  fyE: number;
  noiseL: number;
  noiseY: number;
  /** World-trunk profile scalars. */
  baseW: number;
  fillCX: number;
  baseCX: number;
  baseRW: number;
  WP: number[][];
  wWdef: number;
  /** Oak sheds acorns and plants one in the soil. */
  acorn: boolean;
  ground: number[][];
  blinkNear: number;
  blinkWin: number;
  /** Canopy centre used for the cluster birth ramp. */
  clusterCX: number;
  clusterCY: number;
  /** Cluster-birth ramp radius in the 800-unit world. */
  clusterR: number;
  /** Maple leaves use the lobed silhouette and turn autumn. */
  mapleLeaf: boolean;
  /** A single autumn ramp the foliage turns into once grown. */
  turnRamp?: number[][];
}

const OAK_ART: Art = {
  leafPoints: 7,
  leafAmp: 0.22,
  BX: 64,
  ROOTX: 400,
  ZM: 3.4,
  DYW: 2600,
  cellY: 64,
  cellW: 8,
  fxE: 0.16,
  fyE: 0.035,
  noiseL: 14,
  noiseY: 18,
  baseW: 40,
  fillCX: 406,
  baseCX: 400,
  baseRW: 130,
  WP: [
    [742, 200], [600, 170], [400, 150], [245, 140],
    [0, 126], [-1000, 110], [-3000, 92],
  ],
  wWdef: 92,
  acorn: true,
  ground: [
    [150, 102, 54],
    [88, 58, 32],
  ],
  blinkNear: 3.4,
  blinkWin: 0.14,
  clusterCX: 405,
  clusterCY: 360,
  clusterR: 330,
  mapleLeaf: false,
};

const CRIMSON_ART: Art = {
  leafPoints: 5,
  leafAmp: 0.26,
  BX: 70.4,
  ROOTX: 440,
  ZM: 4.2,
  DYW: 2800,
  cellY: 24,
  cellW: 10,
  fxE: 0.13,
  fyE: 0.1,
  noiseL: 8,
  noiseY: 10,
  baseW: 12,
  fillCX: 403,
  baseCX: 440,
  baseRW: 100,
  WP: [
    [742, 110], [600, 100], [400, 92], [245, 84],
    [0, 76], [-1000, 66], [-3000, 54],
  ],
  wWdef: 54,
  acorn: false,
  ground: [
    [120, 84, 62],
    [96, 66, 50],
  ],
  blinkNear: 2.4,
  blinkWin: 0.05,
  clusterCX: 395,
  clusterCY: 300,
  clusterR: 330,
  mapleLeaf: false,
};

/* The maple reference's four autumn ramps: leaves pass from green
   to gold, orange, or crimson as the tree matures. */
const M_GOLD = ["#6b4a0a", "#a8740f", "#d9a21b", "#f2c53a", "#ffe16b"].map(
  hexToRgb,
);
const M_ORNG = ["#5a2008", "#963a0c", "#d2570f", "#f27a1a", "#ffa63c"].map(
  hexToRgb,
);
const M_CRIM = ["#4a0a12", "#861418", "#c42a1c", "#e8472a", "#ff7a4d"].map(
  hexToRgb,
);
const M_GRN = ["#0f2a16", "#1d4a22", "#2f7a2e", "#4fa83e", "#8fd45c"].map(
  hexToRgb,
);
const MAPLE_RAMPS = [M_GOLD, M_ORNG, M_CRIM, M_GRN];

const BIRCH_ART: Art = {
  leafPoints: 5,
  leafAmp: 0.22,
  BX: 64,
  ROOTX: 400,
  ZM: 3.4,
  DYW: 2600,
  cellY: 36,
  cellW: 6,
  fxE: 0.12,
  fyE: 0.04,
  noiseL: 6,
  noiseY: 8,
  baseW: 22,
  fillCX: 402,
  baseCX: 400,
  baseRW: 88,
  WP: [
    [742, 150], [600, 132], [400, 118], [245, 106],
    [0, 94], [-1000, 84], [-3000, 70],
  ],
  wWdef: 64,
  acorn: false,
  ground: [
    [120, 84, 62],
    [96, 66, 50],
  ],
  blinkNear: 2.6,
  blinkWin: 0.1,
  clusterCX: 400,
  clusterCY: 320,
  clusterR: 330,
  mapleLeaf: false,
};

const BIRCH_GOLD = ["#fff4b0", "#f2d14e", "#e2b811", "#c99700", "#8a6d00"].map(
  hexToRgb,
);
const BIRCH_SPL: number[][] = [
  [47, 53, 66],
  [30, 36, 43],
];

const ELM_ART: Art = {
  leafPoints: 5,
  leafAmp: 0.24,
  BX: 64,
  ROOTX: 400,
  ZM: 3.5,
  DYW: 2600,
  cellY: 88,
  cellW: 8,
  fxE: 0.15,
  fyE: 0.05,
  noiseL: 10,
  noiseY: 16,
  baseW: 34,
  fillCX: 403,
  baseCX: 400,
  baseRW: 110,
  WP: [
    [742, 175], [600, 152], [400, 136], [245, 124],
    [0, 110], [-1000, 98], [-3000, 84],
  ],
  wWdef: 88,
  acorn: false,
  ground: [
    [120, 84, 62],
    [96, 66, 50],
  ],
  blinkNear: 3.0,
  blinkWin: 0.12,
  clusterCX: 400,
  clusterCY: 310,
  clusterR: 330,
  mapleLeaf: false,
};

const REDWOOD_ART: Art = {
  leafPoints: 5,
  leafAmp: 0.26,
  BX: 64,
  ROOTX: 400,
  ZM: 3.2,
  DYW: 2600,
  cellY: 52,
  cellW: 7,
  fxE: 0.13,
  fyE: 0.05,
  noiseL: 8,
  noiseY: 12,
  baseW: 56,
  fillCX: 403,
  baseCX: 400,
  baseRW: 120,
  WP: [
    [742, 150], [600, 128], [400, 108], [245, 92],
    [0, 76], [-1000, 64], [-3000, 50],
  ],
  wWdef: 30,
  acorn: false,
  ground: [
    [120, 84, 62],
    [96, 66, 50],
  ],
  blinkNear: 2.6,
  blinkWin: 0.09,
  clusterCX: 400,
  clusterCY: 340,
  clusterR: 330,
  mapleLeaf: false,
};

const MAPLE_ART: Art = {
  leafPoints: 5,
  leafAmp: 0.26,
  BX: 64,
  ROOTX: 400,
  ZM: 3.6,
  DYW: 2600,
  cellY: 90,
  cellW: 9,
  fxE: 0.14,
  fyE: 0.03,
  noiseL: 7,
  noiseY: 8,
  baseW: 32,
  fillCX: 404,
  baseCX: 400,
  baseRW: 104,
  WP: [
    [742, 170], [600, 150], [400, 134], [245, 124],
    [0, 112], [-1000, 100], [-3000, 86],
  ],
  wWdef: 86,
  acorn: true,
  ground: [
    [140, 96, 52],
    [222, 198, 152],
  ],
  blinkNear: 3.4,
  blinkWin: 0.14,
  clusterCX: 402,
  clusterCY: 300,
  clusterR: 340,
  mapleLeaf: true,
};

/* The oak's exact palettes, verbatim from the reference. */
const MAPLE_PALETTE: Palette = {
  bark: ["#211c1a", "#383230", "#524a45", "#70665e"],
  foliage: ["#4a0a12", "#861418", "#c42a1c", "#e8472a", "#ff7a4d"],
  accent: "#4a6a34",
  cream: ["#c9741a", "#a8481a", "#d9a21b"],
};

const OAK_PALETTE: Palette = {
  bark: ["#1e1610", "#32261b", "#4a3a2a", "#66523b"],
  foliage: ["#0f2a16", "#1d4a22", "#2f7a2e", "#4fa83e", "#8fd45c"],
  accent: "#4a6a34",
  cream: ["#8a7a4a", "#a08a52", "#5f7a3a"],
};

const OAK_WORLD = {
  BK: ["#16110d", "#241b14", "#352a20", "#4a3c2e", "#605040", "#7d6a55"].map(
    hexToRgb,
  ),
  MS: ["#26401f", "#3f6a2c", "#6a9c3c"].map(hexToRgb),
  LICH: hexToRgb("#aebf9c"),
  AMB: ["#6a3c12", "#c27a1c", "#f0b43c"].map(hexToRgb),
  FUN: ["#e2c58a", "#c79a54", "#7a5a30"].map(hexToRgb),
};

const MAPLE_WORLD = {
  BK: ["#1a1514", "#2a2422", "#3d3532", "#554b46", "#70655d", "#8f8379"].map(
    hexToRgb,
  ),
  LICH: hexToRgb("#aebf9c"),
  AMB: ["#6a3c12", "#c27a1c", "#f0b43c"].map(hexToRgb),
  SPL: ["#a4a6ac", "#5a5c62"].map(hexToRgb),
  MS: ["#26401f", "#3f6a2c", "#6a9c3c"].map(hexToRgb),
};

function mixRgb(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/* Replays only on a full browser reload: this flag lives for the
   lifetime of the module, so SPA tab switches (which remount the
   component) snap to the current position instead of replaying. */
let replayedThisPage = false;

export default function PixelGrowthTree({
  speciesId,
  growth,
  onTreeClick,
}: {
  speciesId: TreeSpeciesId;
  /** 0..1 — the fertilizer position on the reference's timeline
   *  (20 packets take the acorn to the ancient oak). */
  growth: number;
  /** A plain click on the tree (no drag, no zoom gesture). */
  onTreeClick?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const dispRef = useRef(0);
  const [reduced] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  /* Viewer: once the tree has grown, drag to pan and zoom 1x-2x. */
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    px: number;
    py: number;
    vx: number;
    vy: number;
    moved: number;
    pointerId: number;
  } | null>(null);
  /* Panning returns once the tree grows large: from the Mature
     stage onward (two-thirds of the 3,000-packet march) the viewer
     unlocks and drag-to-pan / 1x-2x zoom take over. */
  const panEnabled = growth >= 0.66;

  /* Relative size: the 128x128 window scales up or down to taste,
     remembered between visits. */
  const SIZE_KEY = "paperrec_tree_size";
  const [canvasPx, setCanvasPx] = useState<number>(() => {
    try {
      const raw = Number(window.localStorage.getItem(SIZE_KEY));
      if (raw >= 96 && raw <= 336) return raw;
    } catch {
      // best-effort
    }
    return 176;
  });
  const resizeRef = useRef<{
    px: number;
    py: number;
    start: number;
    pointerId: number;
  } | null>(null);

  const shape = SHAPES[speciesId];
  const species = treeSpecies(speciesId);
  const pal =
    speciesId === "crimson"
      ? MAPLE_PALETTE
      : speciesId === "oak"
        ? OAK_PALETTE
        : ramps(species.leafLight, species.leaf, species.leafDeep);
  const art = speciesId === "oak"
    ? OAK_ART
    : speciesId === "crimson"
      ? MAPLE_ART
      : speciesId === "birch"
        ? BIRCH_ART
        : speciesId === "elm"
          ? ELM_ART
          : speciesId === "redwood"
            ? REDWOOD_ART
            : CRIMSON_ART;
  const speciesKey = `${speciesId}:${species.label}`;

  /* The growth prop ref, read by the animation loop. */
  const growthRef = useRef(growth);
  growthRef.current = growth;
  /* The viewer ref keeps the blit fresh without restarting the
     animation effect on every pan/zoom change. */
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (reduced) {
      dispRef.current = growthRef.current;
      replayedThisPage = true;
      return;
    }

    /* A fresh reload (module just loaded) replays from the acorn;
       same-page remounts (menu tab switches) snap into place. */
    dispRef.current = replayedThisPage ? growthRef.current : 0;
  }, [speciesKey]);


  useEffect(() => {
    if (!panEnabled) {
      setView({ s: 1, x: 0, y: 0 });
    }
  }, [speciesKey, panEnabled]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    offRef.current = document.createElement("canvas");
    offRef.current.width = W;
    offRef.current.height = H;
    const off = offRef.current.getContext("2d");
    if (!off) return;

    const img = off.createImageData(W, H);
    const buf = img.data;
    const cov = new Uint8Array(W * H);

    /* ---- species art tables ---- */
    const BARK = pal.bark.map(hexToRgb);
    const FOLI = pal.foliage.map(hexToRgb);
    const MOSS = hexToRgb(pal.accent);
    const CREAM = pal.cream.map(hexToRgb);
    const ACN = art.ground;
    let BK: number[][];
    let MS: number[][];
    let LICH: number[];
    let AMB: number[][];
    let FUN: number[][];
    let SPL: number[][] = [];
    if (speciesId === "oak") {
      BK = OAK_WORLD.BK;
      MS = OAK_WORLD.MS;
      LICH = OAK_WORLD.LICH;
      AMB = OAK_WORLD.AMB;
      FUN = OAK_WORLD.FUN;
    } else if (speciesId === "crimson") {
      BK = MAPLE_WORLD.BK;
      MS = MAPLE_WORLD.MS;
      LICH = MAPLE_WORLD.LICH;
      AMB = MAPLE_WORLD.AMB;
      SPL = MAPLE_WORLD.SPL;
    } else if (speciesId === "birch") {
      BK = [0, 1, 2, 3, 4, 5].map((i) => mixRgb(BARK[0], BARK[3], i / 5));
      BK[0] = mixRgb(BK[0], [0, 0, 0], 0.28);
      MS = [
        mixRgb(MOSS, [0, 0, 0], 0.4),
        MOSS,
        mixRgb(MOSS, [255, 255, 255], 0.3),
      ];
      LICH = mixRgb(MOSS, [255, 255, 255], 0.55);
      AMB = BIRCH_GOLD;
      SPL = BIRCH_SPL;
      FUN = [];
    } else {
      BK = [0, 1, 2, 3, 4, 5].map((i) => mixRgb(BARK[0], BARK[3], i / 5));
      BK[0] = mixRgb(BK[0], [0, 0, 0], 0.35);
      MS = [
        mixRgb(MOSS, [0, 0, 0], 0.4),
        MOSS,
        mixRgb(MOSS, [255, 255, 255], 0.3),
      ];
      LICH = mixRgb(MOSS, [255, 255, 255], 0.55);
      AMB = FOLI;
      FUN = [];
    }

    const put = (x: number, y: number, c: number[]) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const o = (y * W + x) * 4;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    };

    const R2 = rng(11);

    /* ---- pollen dust (the reference's own sprinkle) ---- */
    const SP: [number, number, number[], number][] = [];
    for (let i = 0; i < 280; i++) {
      const x = Math.round(
        art.BX + (R2() + R2() + R2() - 1.5) * 40,
      );
      const yv = Math.round(119 + (R2() - 0.5) * 3.4);
      SP.push([
        x,
        yv,
        CREAM[(R2() * 3) | 0],
        Math.abs(x - art.BX) / 70 * 0.2,
      ]);
    }

    /* ---- canopy clusters (per species) ---- */
    const leaves: {
      x: number; y: number; r: number; ph: number; tone: number; b: number;
      pal: number; sw: number;
    }[] = [];
    const cluster = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      tb: number,
      start: number,
      lo = 3,
      hi = 4.8,
    ) => {
      const la = (lo + hi) / 2;
      const n = Math.ceil((rx * ry * S * S) / (la * la * 0.3));
      for (let i = 0; i < n * 1.35; i++) {
        const edge = i >= n;
        const u = edge ? 0.95 + R2() * 0.15 : Math.sqrt(R2());
        const a2 = R2() * 6.283;
        const dx = Math.cos(a2) * u;
        const dy = Math.sin(a2) * u;
        const lr = edge ? 1.5 + R2() * 1 : lo + R2() * (hi - lo);
        leaves.push({
          x: (cx + dx * rx) * S,
          y: (cy + dy * ry) * S,
          r: lr,
          ph: R2() * 6.283,
          tone: tb - 0.22 * dy + (R2() - 0.5) * 0.2 + (edge ? 0.12 : 0),
          b: start + 0.09 * Math.hypot(dx, dy) + R2() * 0.03,
          /* maple leaves hold a hue — gold, orange, or crimson —
             and a growth threshold at which they turn. */
          pal: (() => {
            const q = R2() + dy * 0.18;
            return q < 0.3 ? 0 : q < 0.7 ? 1 : 2;
          })(),
          sw: 0.55 + 0.38 * R2(),
        });
      }
    };
    shape.clusters.forEach((c) => {
      const start =
        0.36 +
        0.36 *
          clamp(
            Math.hypot(c.cx - art.clusterCX, c.cy - art.clusterCY) / art.clusterR,
            0,
            1,
          );
      cluster(c.cx, c.cy, c.rx, c.ry, c.tone, start, c.lo, c.hi);
    });
    for (const c of shape.elder) {
      cluster(c.cx, c.cy, c.rx, c.ry, c.tone, c.start ?? 0.9, c.lo ?? 2.2, c.hi ?? 3.6);
    }
    leaves.sort((a, b) => a.y - b.y);

    /* ---- limbs (trunk + branches) with the reference's g0/gd ---- */
    const TR = {
      sp: spline(shape.trunk, 24),
      ws: shape.trunkW,
      g0: 0.03,
      gd: 0.2,
    };
    const BR = shape.branches.map((b) => ({
      sp: spline(b.pts, 24),
      ws: b.ws,
      g0: 0.18 + b.b0 * 1.2,
      gd: b.dur * 1.2,
    }));

    const limb = (
      o: { sp: number[][]; ws: number[]; g0: number; gd: number },
      g: number,
      sg: number,
      kx: number,
    ) => {
      const N = o.sp.length;
      const uM = clamp((g - o.g0) / o.gd, 0, 1);
      const salt = (o.g0 * 100 + 20) | 0;
      if (uM <= 0) return;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        if (u > uM) break;
        const [X, Y] = pt(o, u, sg, kx);
        const w = (lerpArr(o.ws, u) * S * sg) / 2;
        for (let py = Math.floor(Y - w - 1); py <= Math.ceil(Y + w + 1); py++) {
          for (let px = Math.floor(X - w - 1); px <= Math.ceil(X + w + 1); px++) {
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const dx = px + 0.5 - X;
            const dy = py + 0.5 - Y;
            if (dx * dx + dy * dy > w * w + 0.2) continue;
            const k = py * W + px;
            if (cov[k]) continue;
            cov[k] = 1;
            const n = clamp(dx / (w + 0.5), -1, 1);
            const band = Math.floor((n + 1) * 2.6) + salt * 8;
            const v = 0.5 - 0.34 * n + (hash(i >> 2, band) - 0.5) * 0.42;
            if (hash(px, py + 7) >= DM) {
              put(
                px,
                py,
                hash(i >> 2, band + 40) > 0.94
                  ? MOSS
                  : BARK[clamp(Math.floor(v * 4), 0, 3)],
              );
            }
          }
        }
      }
    };

    /* ---- world-trunk profile tables (species-shaped) ---- */
    const RX = new Float32Array(800).fill(art.fillCX);
    const RW = new Float32Array(800).fill(art.baseW);
    for (let y = 743; y < 800; y++) {
      RX[y] = art.baseCX;
      RW[y] = art.baseRW;
    }
    for (let i = 0; i < TR.sp.length - 1; i++) {
      const a = TR.sp[i];
      const b = TR.sp[i + 1];
      const ua = i / (TR.sp.length - 1);
      const ub = (i + 1) / (TR.sp.length - 1);
      for (let y = Math.ceil(b[1]); y <= Math.floor(a[1]); y++) {
        const f = (a[1] - y) / (a[1] - b[1] || 1);
        RX[y] = a[0] + (b[0] - a[0]) * f;
        RW[y] = lerpArr(TR.ws, ua + (ub - ua) * f);
      }
    }
    const vn = (x: number, y: number) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const a = hash(i, j);
      const b = hash(i + 1, j);
      const c = hash(i, j + 1);
      const d = hash(i + 1, j + 1);
      const u = fx * fx * (3 - 2 * fx);
      const v = fy * fy * (3 - 2 * fy);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const wW = (y: number) => {
      for (let i = 0; i < 6; i++) {
        if (y >= art.WP[i + 1][0]) {
          const a = art.WP[i];
          const b = art.WP[i + 1];
          return a[1] + (b[1] - a[1]) * (a[0] - y) / (a[0] - b[0]);
        }
      }
      return art.wWdef;
    };
    const cxw = (y: number) =>
      y >= 245
        ? RX[clamp(Math.round(y), 0, 799)]
        : art.fillCX + 38 * Math.sin((245 - y) * 0.0023);

    /* ---- camera anchors shared with the limb painter ---- */
    let AX = art.BX;
    let XF = art.ROOTX;
    let YF = 742;
    let DY = 0;
    let DM = 0;
    let GG = 0;

    const pt = (
      o: { sp: number[][]; ws: number[]; g0: number; gd: number },
      u: number,
      sg: number,
      kx: number,
    ) => {
      const p = o.sp[Math.min(o.sp.length - 1, Math.floor(u * (o.sp.length - 1)))];
      return [AX + (p[0] - XF) * S * sg * kx, AY + (p[1] - YF) * S * sg];
    };
    const AY = 118.7;

    /* ---- the ancient bark (per-pixel, value-noise art) — the
       maple reference's trunkPx, translated verbatim. ---- */
    const trunkPx = (
      sx: number,
      sy: number,
      Z: number,
      e: number,
      tm: number,
    ): number[] | null => {
      const pq = S * Z;
      const wx = XF + (sx + 0.5 - AX) / pq;
      const wy = YF + (sy + 0.5 - AY) / pq;
      if (wy > 746) return null;
      const yi = clamp(Math.round(wy), 0, 799);
      const cx = cxw(wy);
      const w =
        ((wy >= 245 ? RW[yi] : 32) * (1 - e) + wW(wy) * e) *
        (1 + 0.8 * Math.exp(-(742 - wy) / 38));
      const lat = wx - cx;
      const half =
        w / 2 + (vn(wy * 0.07, 5) - 0.5) * 5 + (vn(wy * 0.31, 2) - 0.5) * 2;
      const n = lat / half;
      if (Math.abs(n) > 1) return null;
      const nz = (a: number, b: number) =>
        hash(Math.floor(a * pq), Math.floor(b * pq));
      const L = lat + (vn(wy * 0.02, 5) - 0.5) * 7;
      const Y = wy + (vn(lat * 0.05, 9) - 0.5) * 8;
      const r = Math.floor(Y / 90);
      const fxp = (L + hash(r, 3) * 9) / 9;
      const c = Math.floor(fxp);
      const fx = fxp - c;
      const fy = Y / 90 - r;
      const pno = hash(c, r);
      let v =
        0.34 + 0.38 * pno + 0.22 * (1 - fx) * (1 - fy * 0.6) - 0.3 * n +
        (vn(L * 0.4, Y * 0.03) - 0.5) * 0.2;
      if (fx < 0.14 || fy < 0.03) v = 0.06 + 0.1 * pno;
      let idx = clamp(Math.floor(v * 6), 0, 5);
      if (n < -0.88) idx = Math.min(5, idx + 2);
      else if (n > 0.86) idx = Math.max(0, idx - 2);
      if (wy > 700) idx = Math.max(0, idx - 1);
      let col = BK[idx];
      if (
        pno > 0.86 && fx > 0.3 && fx < 0.7 && fy > 0.3 && fy < 0.7 &&
        hash(c + 7, r) > 0.4
      ) {
        col = LICH;
      }
      const ms =
        vn(L * 0.045, Y * 0.02) + (wy > 400 ? 0.08 : 0) - (n > 0 ? 0.06 : 0);
      if (ms > 0.66 && nz(L, Y + 3) > 0.35) {
        col = MS[clamp(Math.floor((ms - 0.66) * 14), 0, 2)];
      }
      for (let j = Math.floor(wy / 260) - 1; j <= Math.floor(wy / 260); j++) {
        if (hash(j, 6) < 0.35) continue;
        const ky = j * 260 + hash(j, 1) * 200;
        const rx = 12 + hash(j, 3) * 12;
        const d = Math.hypot(
          (lat - (hash(j, 2) - 0.5) * half * 0.9) / rx,
          (wy - ky) / (rx * 1.6),
        );
        if (d < 1) {
          col = d < 0.2 || d > 0.88 ? BK[0] : BK[Math.floor(d * 5.5) % 2 ? 1 : 3];
        } else if (d < 1.18) {
          col = BK[0];
        }
      }
      for (let j = Math.floor(wy / 340) - 1; j <= Math.floor(wy / 340); j++) {
        if (hash(j, 9) < 0.5) continue;
        const ky = j * 340 + hash(j, 4) * 240;
        const dl = lat - (hash(j, 5) - 0.5) * half * 1.2;
        const dy = wy - ky;
        const d = Math.hypot(dl, dy);
        const ln = 22 + hash(j, 7) * 20;
        if (d < 4) {
          col = SPL[d < 2.2 ? 0 : 1];
        } else if (dy > 0 && dy < ln && Math.abs(dl) < 1.7) {
          col = AMB[dy > ln - 5 ? 2 : 1];
        }
      }
      for (let k = 0; k < 2; k++) {
        const d = Math.abs(lat - Math.sin(wy * 0.0042 + k * 3.1) * half * 0.62);
        if (d < 0.6 / pq) col = MS[0];
        else if (
          d < 3.4 / pq &&
          (((wy / 58 + k * 0.3) % 1) + 1) % 1 < 0.14
        ) {
          col = FOLI[3];
        }
      }
      const sp = clamp((520 - wy) / 300, 0, 1);
      if (sp > 0) {
        const dd = Math.abs(
          vn(L * 0.05 + vn(wy * 0.004, 2) * 3, Y * 0.0035) - 0.5,
        );
        if (dd < 0.034 * sp) {
          const q = 0.5 + 0.5 * Math.sin(tm * 1.6 + wy * 0.012);
          col = AMB[q > 0.66 ? 2 : q > 0.33 ? 1 : 0];
        } else if (dd < 0.05 * sp) {
          col = AMB[0];
        }
      }
      return col;
    };

    /* ---- leaf sprites (the species' lobe count) ---- */
    const leaf = (
      X: number,
      Y: number,
      r: number,
      ph: number,
      tone: number,
      ramp: number[][] = FOLI,
    ) => {
      if (r < 0.8) {
        put(X | 0, Y | 0, ramp[3]);
        return;
      }
      for (let y = Math.floor(Y - r * 1.3); y <= Math.ceil(Y + r * 1.3); y++) {
        for (let x = Math.floor(X - r * 1.3); x <= Math.ceil(X + r * 1.3); x++) {
          const dx = x + 0.5 - X;
          const dy = y + 0.5 - Y;
          const d = Math.hypot(dx, dy);
          const e = art.mapleLeaf
            ? r * (0.55 + 0.5 * (1 - Math.abs(Math.sin(2.5 * Math.atan2(dy, dx) + ph))))
            : r *
              (1 +
                art.leafAmp *
                  Math.cos(art.leafPoints * Math.atan2(dy, dx) + ph)) *
              0.92;
          if (d > e) continue;
          const q = d / e;
          let v =
            tone + 0.28 * ((-dx * 0.6 - dy * 0.8) / e) - 0.16 * q * q;
          if (q > 0.72 && dx * 0.5 + dy * 0.85 > 0) v -= 0.3;
          put(x, y, ramp[clamp(Math.floor(v * 5), 0, 4)]);
        }
      }
    };
    const drawLeaf = (
      L: (typeof leaves)[number],
      s: number,
      sg: number,
      kx: number,
    ) => {
      if (s < 0.15) return;
      const X = AX + (L.x - art.BX) * sg * kx;
      const Y = AY + (L.y - 118.7) * sg;
      const r = L.r * (0.55 + 0.45 * sg) * s;
      if (Y + r * 1.3 < 0 || Y - r * 1.3 > H || X + r * 1.3 < 0 || X - r * 1.3 > W) {
        return;
      }
      const ramp = art.mapleLeaf
        ? GG > L.sw
          ? MAPLE_RAMPS[L.pal]
          : MAPLE_RAMPS[3]
        : art.turnRamp && GG > L.sw
          ? art.turnRamp
          : FOLI;
      leaf(X, Y, r, L.ph, L.tone, ramp);
    };

    const FALL: {
      x: number; y: number; ph: number; v: number; gy: number; a: boolean;
      p: number[][];
    }[] = [];
    const LAND: { x: number; y: number; a: boolean; p: number[][] }[] = [];
    let spawn = 0;

    const fall = (dt: number, shower: boolean) => {
      spawn += dt;
      if (spawn > (shower ? 0.3 : 0.45) && FALL.length < (shower ? 22 : 14)) {
        spawn = 0;
        let L = leaves[0];
        for (let i = 0; i < 6; i++) {
          L = leaves[(Math.random() * leaves.length) | 0];
          if (L.y < 90) break;
        }
        FALL.push({
          x: shower ? Math.random() * W : L.x,
          y: shower ? -2 : L.y + L.r,
          a: art.acorn && Math.random() < 0.3,
          p: art.mapleLeaf
            ? MAPLE_RAMPS[(Math.random() * 3) | 0]
            : FOLI,
          ph: Math.random() * 6,
          v: 5 + Math.random() * 4,
          gy: 116 + Math.random() * 5,
        });
      }
      for (let i = FALL.length - 1; i >= 0; i--) {
        const f = FALL[i];
        f.y += f.v * dt;
        f.ph += dt * 2.5;
        f.x += Math.sin(f.ph) * 7 * dt;
        if (f.y >= (DY > 0 ? H + 3 : f.gy)) {
          if (DY <= 0) {
            LAND.push({
              x: f.x | 0,
              y: f.gy | 0,
              a: f.a,
              p: f.p,
            });
            if (LAND.length > 45) LAND.shift();
          }
          FALL.splice(i, 1);
          continue;
        }
        if (f.a) {
          if (art.mapleLeaf) {
            const sd = Math.sin(f.ph * 3) > 0 ? 1 : -1;
            put(f.x | 0, f.y | 0, ACN[0]);
            put((f.x | 0) + sd, (f.y | 0) - 1, ACN[1]);
            put((f.x | 0) + sd * 2, (f.y | 0) - 1, ACN[1]);
          } else {
            put(f.x | 0, f.y | 0, ACN[0]);
            put(f.x | 0, (f.y | 0) - 1, ACN[1]);
          }
        } else {
          put(f.x | 0, f.y | 0, f.p[4]);
          put(
            (f.x | 0) + (Math.sin(f.ph) > 0 ? 1 : -1),
            f.y | 0,
            f.p[3],
          );
          put(f.x | 0, (f.y | 0) + 1, f.p[2]);
        }
      }
      LAND.forEach(({ x, y, a, p }) => {
        put(x, (y + DY) | 0, a ? ACN[0] : p[3]);
        put(x + 1, (y + DY) | 0, a ? ACN[1] : p[2]);
      });
    };

    const easeInOut = (u: number) => u * u * (3 - 2 * u);

    const render = (P: number, dt: number, tm: number) => {
      buf.fill(0);
      cov.fill(0);

      const g = clamp(P / PA, 0, 1);
      GG = g;
      const ux = clamp((P - PA) / PB, 0, 1);
      const vx = clamp((P - PA - PB) / PC, 0, 1);
      const m = clamp((g - 0.06) / 0.9, 0, 1);
      const eg = easeInOut(m);
      const eu = easeInOut(ux);
      const ea = easeInOut(vx);
      const Z = Math.exp(Math.log(art.ZM) * eu);
      const sg = (0.2 + 0.8 * eg) * Z;
      const kx = 0.4 + 0.6 * eg;

      AX = art.BX + (64 - art.BX) * eu;
      YF = 742 - art.DYW * ea;
      XF = art.ROOTX + (cxw(YF - 60) - art.ROOTX) * clamp(vx * 6, 0, 1);
      DY = (742 - YF) * S * Z;

      const sh = Math.round(AX - art.BX);
      for (const [x, y, c, b] of SP) {
        if (g >= b && y + DY < H) put(x + sh, (y + DY) | 0, c);
      }

      if (DY <= 0) {
        if (speciesId === "oak") {
          /* the acorn's tuft */
          for (let x = 52; x <= 76; x++) {
            const d = (x + 0.5 - art.BX) / 12;
            const h = 3 * (1 - d * d);
            if (h <= 0) continue;
            for (let y = Math.floor(119.2 - h); y <= 119; y++) {
              put(x + sh, y, BARK[hash(x, y) > 0.6 ? 1 : 0]);
            }
          }
          if (g < 0.05) {
            put(64, 117, ACN[0]);
            put(63, 117, ACN[0]);
            put(64, 116, ACN[1]);
            put(63, 116, ACN[1]);
          }
        } else {
          for (let x = 61; x <= 77; x++) {
            const d = (x + 0.5 - art.BX) / 8;
            const h = 2.8 * (1 - d * d);
            if (h <= 0) continue;
            for (let y = Math.floor(119.2 - h); y <= 119; y++) {
              put(x + sh, y, BARK[hash(x, y) > 0.6 ? 1 : 0]);
            }
          }
          if (g < 0.05) {
            if (art.mapleLeaf) {
              put(64, 117, ACN[0]);
              put(65, 116, ACN[1]);
              put(66, 115, ACN[1]);
              put(67, 115, ACN[1]);
            } else {
              put(70, 117, [120, 84, 62]);
              put(69, 117, [96, 66, 50]);
            }
          }
        }
      }

      DM = 0;
      if (ux < 0.08) {
        limb(TR, g, sg, kx);
        if (g > 0.45) {
          const N = TR.sp.length;
          const a = clamp((g - 0.45) / 0.3, 0, 1);
          for (let i = (N * 0.04) | 0; i < N * 0.6 * a; i++) {
            const t = i / (N - 1);
            const w = (lerpArr(TR.ws, t) * S * sg) / 2;
            const [X, Y] = pt(TR, t, sg, kx);
            const px = Math.round(X + Math.sin(t * 38) * w * 0.55);
            const py = Math.round(Y);
            if (
              px >= 0 && px < W && py >= 0 && py < H &&
              cov[py * W + px]
            ) {
              put(px, py, MOSS);
            }
          }
        }
      }

      DM = clamp(ux / 0.3, 0, 1);
      if (DM < 1) {
        BR.forEach((o) => limb(o, g, sg, kx));
      }

      if (ux > 0) {
        const bl = Math.min(1, ux / 0.08);
        let hits = 0;
        let nulls = 0;
        for (let sy = 0; sy < H; sy++) {
          for (let sx = 0; sx < W; sx++) {
            if (hash(sx * 3, sy) < bl) {
              const c = trunkPx(sx, sy, Z, eu, tm);
              if (c) {
                put(sx, sy, c);
                hits++;
              } else {
                nulls++;
              }
            }
          }
        }
        if (speciesId === "crimson") {
          console.info("MAPLE-PROBE trunkPx hits", hits, "nulls", nulls, "Z", Z.toFixed(3), "eu", eu.toFixed(3));
        }
      }

      const uT = clamp((g - 0.03) / 0.2, 0, 1);
      const cr = 1.9 * clamp(uT * 3, 0, 1) * (1 - clamp((g - 0.35) / 0.2, 0, 1));
      if (cr > 0.5) {
        const [tx, ty] = pt(TR, uT, sg, kx);
        leaf(tx - 1.8, ty + 0.4, cr, 0, 0.7);
        leaf(tx + 1.8, ty + 0.4, cr, 2, 0.7);
      }

      if (ux < 0.5) {
        const dens = clamp(
          0.08 + 1.1 * Math.pow(clamp((g - 0.2) / 0.7, 0, 1), 1.5),
          0,
          1,
        );
        for (const L of leaves) {
          const k = hash((L.x * 97) | 0, (L.y * 89) | 0);
          if (k > dens || ux > 0.1 + 0.38 * k) continue;
          const p = (g - (0.2 + (L.b - 0.34) * 1.2)) / 0.07;
          if (p <= 0) continue;
          drawLeaf(L, 1 - Math.pow(1 - Math.min(1, p), 3), sg, kx);
        }
      }

      if (g >= 1) fall(dt, ux > 0);

      if (speciesId === "crimson") {
        let n = 0;
        for (let i = 3; i < buf.length; i += 4) if (buf[i]) n++;
        console.info(
          "MAPLE-PROBE P", P.toFixed(3), "g", g.toFixed(2), "u", ux.toFixed(2),
          "leaves", leaves.length, "px", n, "SP", SP.length,
        );
      }

      off.putImageData(img, 0, 0);

      /* Blit: the viewer's pan (screen px) and zoom (1x-2x). */
      ctx.clearRect(0, 0, W, H);
      const Z2 = viewRef.current.s;
      const sw = W / Z2;
      const shh = H / Z2;
      const cx = 64 - viewRef.current.x / Z2;
      const cy = 64 - viewRef.current.y / Z2;
      const sx = clamp(cx - sw / 2, 0, W - sw);
      const sy = clamp(cy - shh / 2, 0, H - shh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offRef.current!, sx, sy, sw, shh, 0, 0, W, H);
    };

    try {
      render(dispRef.current, 0, performance.now() / 1000);
    } catch (err) {
      console.error("tree first paint failed (will retry):", err);
    }

    let raf = 0;
    let last = performance.now();
    let broken = false;
    let marked = false;
    const frame = (now: number) => {
      if (!marked) {
        /* Mark only on the first live tick so React StrictMode's
           dev double-mount doesn't swallow the fresh-reload replay. */
        replayedThisPage = true;
        marked = true;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const target = clamp(growthRef.current, 0, 1);
      if (!reduced) {
        /* The reference's own pace: the whole journey takes its
           DUR of 50 seconds; a single fertilizer packet is a
           smooth 2.5-second step, and a fresh mount replays it
           from the acorn. */
        dispRef.current = Math.min(target, dispRef.current + dt / 50);
      } else {
        dispRef.current = target;
      }

      if (!broken) {
        try {
          render(dispRef.current, dt, now / 1000);
        } catch (err) {
          /* Never die silently: report once and keep retrying so
             the tree appears (or recovers) on the next frame. */
          broken = true;
          console.error("tree render failed:", err);
          window.setTimeout(() => {
            broken = false;
          }, 250);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [shape, pal, speciesId, speciesKey, reduced]);

  const zoomBy = (delta: number) =>
    setView((current) => ({
      ...current,
      s: clamp(current.s + delta, 1, 2),
    }));

  return (
    <div
      className="flex w-full flex-col items-center"
      data-pixel-growth-tree
    >
      <div
        className="relative"
        style={{ width: `${canvasPx}px`, maxWidth: "100%" }}
      >
      <canvas
        ref={ref}
        width={W}
        height={H}
        role="img"
        aria-label="Pixel art tree growing"
        className={`block h-auto w-full ${
          panEnabled
            ? "cursor-grab active:cursor-grabbing"
            : "cursor-pointer"
        }`}
        style={{ imageRendering: "pixelated" }}
        onWheel={(event) => {
          if (!panEnabled) return;
          zoomBy(event.deltaY < 0 ? 0.25 : -0.25);
        }}
        onPointerDown={(event) => {
          if (!panEnabled) {
            onTreeClick?.();
            return;
          }
          dragRef.current = {
            px: event.clientX,
            py: event.clientY,
            vx: view.x,
            vy: view.y,
            moved: 0,
            pointerId: event.pointerId,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || event.pointerId !== drag.pointerId) return;
          const dx = event.clientX - drag.px;
          const dy = event.clientY - drag.py;
          drag.moved += Math.abs(dx) + Math.abs(dy);
          setView((current) => ({
            s: current.s,
            x: drag.vx - dx,
            y: drag.vy - dy,
          }));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || event.pointerId !== drag.pointerId) return;
          dragRef.current = null;
          if (drag.moved < 4) {
            onTreeClick?.();
          }
        }}
        onPointerLeave={(event) => {
          const drag = dragRef.current;
          if (drag && event.pointerId === drag.pointerId) {
            dragRef.current = null;
          }
        }}
      />

        {/* resize grip: drag the corner to scale the window */}
        <span
          role="slider"
          aria-label="Resize tree"
          aria-valuemin={96}
          aria-valuemax={336}
          aria-valuenow={canvasPx}
          className="absolute -bottom-1.5 -right-1.5 block h-3.5 w-3.5 cursor-nwse-resize border-[2px] border-gray-900 bg-[#f5e08a]"
          style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeRef.current = {
              px: event.clientX,
              py: event.clientY,
              start: canvasPx,
              pointerId: event.pointerId,
            };
          }}
          onPointerMove={(event) => {
            const drag = resizeRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            const next = Math.round(
              clamp(drag.start + (event.clientX - drag.px), 96, 336),
            );
            setCanvasPx(next);
            try {
              window.localStorage.setItem(SIZE_KEY, String(next));
            } catch {
              // best-effort
            }
          }}
          onPointerUp={(event) => {
            const drag = resizeRef.current;
            if (drag && event.pointerId === drag.pointerId) {
              resizeRef.current = null;
            }
          }}
        />
      </div>

      {panEnabled && (
        <div
          className="mt-1 flex items-center gap-1"
          aria-label="Tree viewer controls"
        >
          <button
            type="button"
            onClick={() => zoomBy(-0.25)}
            disabled={view.s <= 1}
            aria-label="Zoom out"
            className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {"\−"}
          </button>
          <button
            type="button"
            onClick={() => setView({ s: 1, x: 0, y: 0 })}
            aria-label="Reset zoom and pan"
            className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
          >
            1x
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.25)}
            disabled={view.s >= 2}
            aria-label="Zoom in"
            className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
          <span className="ml-1 hidden font-mono text-[9px] font-bold uppercase tracking-wide text-muted sm:inline">
            drag to pan · scroll to zoom
          </span>
        </div>
      )}
    </div>
  );
}
