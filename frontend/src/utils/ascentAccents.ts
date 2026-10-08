/**
 * Accents that come into view as the camera climbs: vines hanging from the
 * top of the frame, sylphs flying about, motes of light drifting up, and
 * shafts of sun. These are the pure parts: where things are at a given
 * moment, as whole pixels on the garden's 256x144 grid. The renderer
 * draws them.
 *
 * Everything is a function of time, with no state, so a frame is the same
 * wherever it is drawn and the motion needs nothing stored between frames.
 *
 * Dependency-free so it runs under `node --test`.
 */

export const FRAME_W = 256;
export const FRAME_H = 144;

const TAU = Math.PI * 2;

/** A small, repeatable 0..1 number for a pair of integers. */
export function unit(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;

  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------ */
/* Sylphs                                                        */
/* ------------------------------------------------------------ */

export interface SylphPose {
  x: number;
  y: number;
  /** Which way it faces: 1 right, -1 left. */
  dir: 1 | -1;
  /** Wings up (0) or down (1), flapping several times a second. */
  flap: 0 | 1;
  /** 0..1 brightness, pulsing slowly. */
  glow: number;
}

/** Where sylph `i` is at time `t` (seconds): a slow loop across the frame. */
export function sylphPose(i: number, t: number): SylphPose {
  const fx = 0.13 + 0.035 * (i % 3);
  const fy = 0.21 + 0.025 * (i % 4);
  const px = i * 2.1 + 0.7;
  const py = i * 1.3 + 0.2;
  const x =
    FRAME_W * (0.5 + 0.4 * Math.sin(t * fx + px) + 0.06 * Math.sin(t * 0.9 + i));
  const y =
    FRAME_H * (0.32 + 0.2 * Math.sin(t * fy + py)) + 5 * Math.sin(t * 1.7 + i * 0.8);

  return {
    x: Math.round(x),
    y: Math.round(y),
    dir: Math.cos(t * fx + px) >= 0 ? 1 : -1,
    flap: Math.floor(t * 9 + i) % 2 === 0 ? 0 : 1,
    glow: 0.65 + 0.35 * Math.sin(t * 2.3 + i * 1.9),
  };
}

/* ------------------------------------------------------------ */
/* Hanging vines                                                 */
/* ------------------------------------------------------------ */

export interface VineSpec {
  x: number;
  /** Full length in pixels once the climb has reached them. */
  length: number;
  phase: number;
}

/** `n` vines spread across the top of the frame, each its own length. */
export function vineSpecs(n: number, seed: number): VineSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(
      (FRAME_W * (i + 0.5)) / n + (unit(i, seed) - 0.5) * (FRAME_W / n) * 0.7,
    ),
    length: Math.round(16 + unit(i + 40, seed) * 38 + (i % 3 === 0 ? 14 : 0)),
    phase: unit(i + 90, seed) * TAU,
  }));
}

/**
 * How far down a vine of `length` shows when the climb is `growth` (0..1):
 * none at first, the whole of it by the time the climb is well on.
 */
export function vineShown(length: number, growth: number): number {
  const t = Math.min(1, Math.max(0, growth));

  return Math.round(length * t * t * (3 - 2 * t));
}

/* ------------------------------------------------------------ */
/* Motes of light                                                */
/* ------------------------------------------------------------ */

export interface Mote {
  x: number;
  y: number;
  /** 0..1 twinkle. */
  glow: number;
}

/** Mote `k` at time `t`: drifting upward, wandering a little, twinkling. */
export function motePose(k: number, t: number): Mote {
  const speed = 2.5 + (k % 5) * 0.9;
  const cycle = FRAME_H + 14;
  const rise = (t * speed + unit(k, 3) * cycle) % cycle;

  return {
    x: Math.round(unit(k, 1) * FRAME_W + 6 * Math.sin(t * 0.6 + k * 1.7)),
    y: Math.round(FRAME_H + 4 - rise),
    glow: 0.5 + 0.5 * Math.sin(t * (1.2 + (k % 3) * 0.5) + k * 2.9),
  };
}
