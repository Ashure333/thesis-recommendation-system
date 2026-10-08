/**
 * Phosphor's wallpaper: digital rain on an old green terminal.
 *
 * Columns of small glyphs fall, a bright head leading a trail that fades
 * through the phosphor greens; the glyphs flicker as they go, a cursor
 * blinks near the bottom, and now and then a column races ahead.
 */

import { clamp, rng, type Ctx, type SceneFactory } from "../pixel";

const SHADES = ["#d8ffe0", "#78ff8c", "#3cdc5c", "#1e9c3c", "#126024", "#0a3a16"];
const BG = "#050d07";
const GLYPH_W = 5;
const GLYPH_H = 7;
const CELL_W = 6;
const CELL_H = 8;

export const terminalScene: SceneFactory = (w, h) => {
  const rand = rng(1999);

  /* a set of glyphs: random 5 x 7 scribbles, drawn once per shade */
  const glyphs: HTMLCanvasElement[][] = [];

  for (let g = 0; g < 18; g++) {
    const bits: boolean[] = [];

    for (let i = 0; i < GLYPH_W * GLYPH_H; i++) {
      const col = i % GLYPH_W;

      /* mirror the left half: it reads as letters, not noise */
      bits.push(col < 3 ? rand() < 0.5 : false);
    }
    for (let j = 0; j < GLYPH_H; j++) {
      bits[j * GLYPH_W + 4] = bits[j * GLYPH_W + 0];
      bits[j * GLYPH_W + 3] = bits[j * GLYPH_W + 1];
    }
    bits[2] = true;
    bits[GLYPH_W * (GLYPH_H - 1) + 2] = rand() < 0.6;

    glyphs.push(
      SHADES.map((color) => {
        const c = document.createElement("canvas");

        c.width = GLYPH_W;
        c.height = GLYPH_H;

        const x = c.getContext("2d")!;

        x.fillStyle = color;
        bits.forEach((on, i) => on && x.fillRect(i % GLYPH_W, Math.floor(i / GLYPH_W), 1, 1));

        return c;
      }),
    );
  }

  const columns = Math.ceil(w / CELL_W);
  const rows = Math.ceil(h / CELL_H);
  const drops = Array.from({ length: columns }, () => ({
    y: -rand() * rows * 2,
    speed: 5 + rand() * 12,
    len: 8 + Math.floor(rand() * 16),
    seed: Math.floor(rand() * 1e6),
  }));
  let lastT = 0;

  const glyphAt = (col: number, row: number, tick: number) => {
    const n = Math.imul(col * 7919 + row * 104729 + tick * 31, 2654435761) >>> 0;

    return n % glyphs.length;
  };

  return (ctx: Ctx, t: number) => {
    const dt = clamp(t - lastT, 0, 0.25);

    lastT = t;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    drops.forEach((d, col) => {
      d.y += d.speed * dt;
      if (d.y - d.len > rows) {
        d.y = -rand() * 12;
        d.speed = 5 + rand() * 12;
        d.len = 8 + Math.floor(rand() * 16);
      }

      const head = Math.floor(d.y);

      for (let k = 0; k < d.len; k++) {
        const row = head - k;

        if (row < 0 || row >= rows) continue;

        const shade = k === 0 ? 0 : clamp(1 + Math.floor((k / d.len) * 5), 1, 5);
        /* glyphs change a little while they fall */
        const tick = Math.floor(t * 3 + col + (k === 0 ? t * 9 : 0));

        ctx.drawImage(glyphs[glyphAt(col, row, tick)][shade], col * CELL_W, row * CELL_H);
      }
    });

    /* a blinking block cursor, low and to the left */
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = SHADES[1];
      ctx.fillRect(10, h - 16, 5, 8);
    }
  };
};
