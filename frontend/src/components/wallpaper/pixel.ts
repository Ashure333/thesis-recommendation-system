/**
 * Tiny pixel-art helpers shared by the look wallpapers. Every scene is drawn
 * on a small canvas (about 240 x 150 "pixels") that the page scales up by a
 * whole number, so everything here works in whole pixels: no anti-aliasing,
 * no sub-pixel anything.
 */

export type Ctx = CanvasRenderingContext2D;

/** A scene draws one frame at time `t` (seconds). It keeps its own state. */
export type Scene = (ctx: Ctx, t: number) => void;

/** A scene factory: build it for a canvas of `w` x `h` pixels. */
export type SceneFactory = (w: number, h: number) => Scene;

/** Deterministic random numbers, so a wallpaper looks the same every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;

    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

export const dot = (ctx: Ctx, x: number, y: number, color: string) => rect(ctx, x, y, 1, 1, color);

/** A filled disc, in whole-pixel spans. */
export function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;

  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r + r - dy * dy + 0.25));

    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

/** A one-pixel ring. */
export function ring(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;

  const steps = Math.max(12, Math.round(r * 7));

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;

    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}

/** A straight line from (x0, y0) to (x1, y1), `part` of the way (0..1). */
export function line(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  part = 1,
) {
  ctx.fillStyle = color;

  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const upto = Math.floor(steps * Math.min(1, Math.max(0, part)));

  for (let i = 0; i <= upto; i++) {
    const k = steps === 0 ? 0 : i / steps;

    ctx.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k), 1, 1);
  }
}

/**
 * A sprite from rows of text: any character in `palette` is a pixel of that
 * color, anything else is clear. `flip` mirrors it left to right.
 */
export function sprite(
  ctx: Ctx,
  rows: readonly string[],
  x: number,
  y: number,
  palette: Record<string, string>,
  flip = false,
) {
  const width = rows[0]?.length ?? 0;

  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < width; i++) {
      const ch = rows[j][flip ? width - 1 - i : i];
      const color = palette[ch];

      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
      }
    }
  }
}

/** 3 x 5 digits for little scoreboards. */
const DIGITS: Record<string, string[]> = {
  "0": ["XXX", "X.X", "X.X", "X.X", "XXX"],
  "1": [".X.", "XX.", ".X.", ".X.", "XXX"],
  "2": ["XXX", "..X", "XXX", "X..", "XXX"],
  "3": ["XXX", "..X", "XXX", "..X", "XXX"],
  "4": ["X.X", "X.X", "XXX", "..X", "..X"],
  "5": ["XXX", "X..", "XXX", "..X", "XXX"],
  "6": ["XXX", "X..", "XXX", "X.X", "XXX"],
  "7": ["XXX", "..X", "..X", ".X.", ".X."],
  "8": ["XXX", "X.X", "XXX", "X.X", "XXX"],
  "9": ["XXX", "X.X", "XXX", "..X", "XXX"],
  "-": ["...", "...", "XXX", "...", "..."],
  ".": ["...", "...", "...", "...", ".X."],
  m: ["...", "XXX", "X.X", "X.X", "X.X"],
};

export function digits(ctx: Ctx, text: string, x: number, y: number, color: string) {
  let cursor = x;

  for (const ch of text) {
    const glyph = DIGITS[ch];

    if (glyph) sprite(ctx, glyph, cursor, y, { X: color });
    cursor += 4;
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const frac = (v: number) => v - Math.floor(v);
