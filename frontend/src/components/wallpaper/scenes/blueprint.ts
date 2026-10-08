/**
 * Blueprint's wallpaper: a drafting table drawing itself in white ink.
 *
 * A compass sweeps a circle, a floor plan is inked wall by wall with its
 * dimension lines, a pair of gears turns, a set square slides along the
 * edge and a title block keeps its revision. The sheet redraws itself every
 * half minute.
 */

import { clamp, digits, disc, frac, line, rect, ring, type Ctx, type SceneFactory } from "../pixel";

const BG = "#0e3058";
const MINOR = "#154070";
const MAJOR = "#1f5290";
const INK = "#dcecff";
const SOFT = "#7fb0e4";
const CYCLE = 30;

const ease = (v: number) => v * v * (3 - 2 * v);
const stage = (t: number, from: number, to: number) => ease(clamp((t - from) / (to - from), 0, 1));

function gear(ctx: Ctx, cx: number, cy: number, r: number, teeth: number, angle: number, color: string) {
  ring(ctx, cx, cy, r, color);
  ring(ctx, cx, cy, r * 0.45, color);
  disc(ctx, cx, cy, 1, color);
  ctx.fillStyle = color;
  for (let i = 0; i < teeth; i++) {
    const a = angle + (i / teeth) * Math.PI * 2;

    ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * (r + 1)), 2, 2);
    ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 2)), Math.round(cy + Math.sin(a) * (r + 2)), 1, 1);
    line(ctx, cx, cy, cx + Math.cos(a + Math.PI / teeth) * r * 0.45, cy + Math.sin(a + Math.PI / teeth) * r * 0.45, color);
  }
}

export const blueprintScene: SceneFactory = (w, h) => {
  const back = document.createElement("canvas");

  back.width = w;
  back.height = h;

  const b = back.getContext("2d")!;

  rect(b, 0, 0, w, h, BG);
  for (let x = 0; x < w; x += 8) rect(b, x, 0, 1, h, x % 40 === 0 ? MAJOR : MINOR);
  for (let y = 0; y < h; y += 8) rect(b, 0, y, w, 1, y % 40 === 0 ? MAJOR : MINOR);

  /* the border of the sheet */
  rect(b, 4, 4, w - 8, 1, SOFT);
  rect(b, 4, h - 5, w - 8, 1, SOFT);
  rect(b, 4, 4, 1, h - 8, SOFT);
  rect(b, w - 5, 4, 1, h - 8, SOFT);

  return (ctx: Ctx, t: number) => {
    ctx.drawImage(back, 0, 0);

    const c = t % CYCLE;
    const fade = c > 26 ? 1 - (c - 26) / 4 : 1;

    ctx.globalAlpha = fade;

    /* ---- the compass and its circle (top left) ---- */
    const cx = Math.round(w * 0.2);
    const cy = Math.round(h * 0.32);
    const R = 26;
    const sweep = stage(c, 1, 9);
    const ang = -Math.PI / 2 + sweep * Math.PI * 2;
    const px = cx + Math.cos(ang) * R;
    const py = cy + Math.sin(ang) * R;
    const steps = Math.round(R * 7 * sweep);

    ctx.fillStyle = INK;
    for (let i = 0; i < steps; i++) {
      const a = -Math.PI / 2 + (i / (R * 7)) * Math.PI * 2;

      ctx.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 1, 1);
    }
    /* centre cross and radius */
    line(ctx, cx - 3, cy, cx + 3, cy, SOFT);
    line(ctx, cx, cy - 3, cx, cy + 3, SOFT);
    if (sweep < 1) {
      const ax = cx + (px - cx) * 0.5;
      const ay = cy - R - 12;

      line(ctx, ax, ay, cx, cy, INK);
      line(ctx, ax, ay, px, py, INK);
      disc(ctx, ax, ay, 2, INK);
    } else {
      line(ctx, cx, cy, cx + R, cy, SOFT);
      digits(ctx, "26", cx + 8, cy - 7, SOFT);
    }

    /* ---- the floor plan (top right) ---- */
    const fx = Math.round(w * 0.58);
    const fy = Math.round(h * 0.18);
    const walls: [number, number, number, number][] = [
      [0, 0, 72, 0],
      [72, 0, 72, 46],
      [72, 46, 30, 46],
      [30, 46, 30, 30],
      [30, 30, 0, 30],
      [0, 30, 0, 0],
      [30, 0, 30, 18],
      [48, 30, 48, 46],
    ];
    const draw = stage(c, 5, 17) * walls.length;

    walls.forEach(([x0, y0, x1, y1], i) => {
      const part = clamp(draw - i, 0, 1);

      if (part > 0) {
        line(ctx, fx + x0, fy + y0, fx + x1, fy + y1, INK, part);
        line(ctx, fx + x0 + 1, fy + y0 + 1, fx + x1 + 1, fy + y1 + 1, SOFT, part);
      }
    });
    const dim = stage(c, 15, 20);

    if (dim > 0) {
      line(ctx, fx, fy - 7, fx + 72, fy - 7, SOFT, dim);
      line(ctx, fx, fy - 9, fx, fy - 5, SOFT, dim);
      line(ctx, fx + 72, fy - 9, fx + 72, fy - 5, SOFT, dim);
      if (dim > 0.6) digits(ctx, "12.4m", fx + 26, fy - 15, SOFT);
      line(ctx, fx + 80, fy, fx + 80, fy + 46, SOFT, dim);
      line(ctx, fx + 78, fy, fx + 82, fy, SOFT, dim);
      line(ctx, fx + 78, fy + 46, fx + 82, fy + 46, SOFT, dim);
      if (dim > 0.6) digits(ctx, "8.2m", fx + 84, fy + 20, SOFT);
    }
    /* a door swing */
    if (draw > 6) {
      ctx.fillStyle = SOFT;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * (Math.PI / 2);

        ctx.fillRect(Math.round(fx + 30 + Math.sin(a) * 10), Math.round(fy + 18 + Math.cos(a) * 10), 1, 1);
      }
    }

    /* ---- the gears (bottom left) ---- */
    const gx = Math.round(w * 0.24);
    const gy = Math.round(h * 0.74);

    gear(ctx, gx, gy, 14, 12, t * 0.7, INK);
    gear(ctx, gx + 26, gy + 5, 9, 8, -t * 0.7 * (12 / 8) + 0.2, INK);
    digits(ctx, "12:8", gx - 4, gy + 22, SOFT);

    /* ---- the set square sliding along the bottom edge ---- */
    const sx = Math.round(w * 0.5 + Math.sin(t * 0.3) * w * 0.12);
    const sy = Math.round(h * 0.86);

    line(ctx, sx, sy, sx + 34, sy, SOFT);
    line(ctx, sx, sy, sx, sy - 22, SOFT);
    line(ctx, sx + 34, sy, sx, sy - 22, SOFT);
    line(ctx, sx + 5, sy - 4, sx + 15, sy - 4, SOFT);
    line(ctx, sx + 5, sy - 4, sx + 5, sy - 10, SOFT);

    /* ---- the title block (bottom right) ---- */
    const tx = w - 74;
    const ty = h - 26;

    rect(ctx, tx, ty, 66, 1, INK);
    rect(ctx, tx, ty + 18, 66, 1, INK);
    rect(ctx, tx, ty, 1, 19, INK);
    rect(ctx, tx + 65, ty, 1, 19, INK);
    rect(ctx, tx + 40, ty, 1, 19, INK);
    rect(ctx, tx, ty + 9, 40, 1, SOFT);
    rect(ctx, tx + 3, ty + 3, 20, 2, SOFT);
    rect(ctx, tx + 3, ty + 12, 14, 2, SOFT);
    digits(ctx, "---", tx + 43, ty + 3, SOFT);
    if (Math.floor(t * 1.5) % 2 === 0) digits(ctx, String(1 + Math.floor(t / CYCLE) % 9), tx + 55, ty + 11, INK);

    /* ---- a pencil line sweeping the top ---- */
    const pl = frac(t / 11);

    rect(ctx, Math.round(pl * w), 6, 1, 3, SOFT);

    ctx.globalAlpha = 1;
  };
};
