/**
 * Lumberyard's wallpaper: a sawmill's plank wall, and the work in front of it.
 *
 * A lumberjack chops a stump and the chips fly; a circular saw spins at the
 * far end of the yard throwing sawdust; a log rolls along the ground; a
 * woodpecker taps at a post; sawdust sifts down through the light.
 */

import { clamp, disc, line, rect, rng, sprite, type Ctx, type SceneFactory } from "../pixel";

const DARK = "#5e3513";
const MID = "#a36a2c";
const LIGHT = "#d9b97c";
const PALE = "#f0dcae";
const INK = "#2b1a0a";
const STEEL = "#aab4bd";
const STEEL_DARK = "#6b7782";
const RED = "#b3402a";

const JACK_UP = [
  "....XX.....",
  "...XXXX..A.",
  "...XXXX.A..",
  "....XX.A...",
  "..RRRRRA...",
  ".RRRRRRR...",
  ".RRRRRRR...",
  "..RRRRR....",
  "..RR.RR....",
  "..RR.RR....",
  ".BB..BB....",
];
const JACK_DOWN = [
  "....XX.....",
  "...XXXX....",
  "...XXXX....",
  "....XX.....",
  "..RRRRR....",
  ".RRRRRRR...",
  ".RRRRRRRA..",
  "..RRRRR.A..",
  "..RR.RR..A.",
  "..RR.RR...A",
  ".BB..BB....",
];
const PECKER_A = ["..RR..", ".RRRK.", ".RWWK.", ".RKK..", "..KKK.", "..KWK.", "..KWK.", "...K.."];
const PECKER_B = ["..RR..", ".RRRK.", ".RWWK.", ".RKK..", "..KKK.", "..KWK.", "..KWK.", "...K.."];

export const woodScene: SceneFactory = (w, h) => {
  const rand = rng(1852);

  /* ----- planks, drawn once ----- */
  const back = document.createElement("canvas");

  back.width = w;
  back.height = h;

  const b = back.getContext("2d")!;
  const plankH = 13;

  for (let row = 0; row * plankH < h; row++) {
    const y = row * plankH;

    rect(b, 0, y, w, plankH, row % 2 === 0 ? LIGHT : "#cfae6c");
    rect(b, 0, y, w, 1, MID);
    rect(b, 0, y + plankH - 1, w, 1, DARK);

    let x = -Math.floor(rand() * 60);

    while (x < w) {
      const len = 60 + Math.floor(rand() * 70);

      rect(b, x + len, y, 1, plankH, DARK);
      for (let g = 0; g < 7; g++) {
        const gx = x + Math.floor(rand() * len);
        const gy = y + 2 + Math.floor(rand() * (plankH - 4));

        rect(b, gx, gy, 6 + Math.floor(rand() * 14), 1, MID);
      }
      if (rand() < 0.35) {
        const kx = x + 10 + Math.floor(rand() * (len - 20));

        disc(b, kx, y + 6, 2, MID);
        disc(b, kx, y + 6, 1, DARK);
      }
      x += len;
    }
  }
  rect(b, 0, h - 14, w, 14, DARK);
  rect(b, 0, h - 14, w, 1, INK);

  /* ----- state ----- */
  const motes = Array.from({ length: 36 }, () => ({ x: rand() * w, y: rand() * h, s: 3 + rand() * 6, p: rand() * 6 }));
  let chips: { x: number; y: number; vx: number; vy: number; a: number }[] = [];
  let dust: { x: number; y: number; vx: number; vy: number; a: number }[] = [];
  let lastT = 0;
  let lastChop = -1;
  let dustClock = 0;

  return (ctx: Ctx, t: number) => {
    const dt = clamp(t - lastT, 0, 0.25);

    lastT = t;
    ctx.drawImage(back, 0, 0);

    const ground = h - 14;

    /* ---- the lumberjack and his stump (left) ---- */
    const jx = 24;
    const chopPhase = (t * 1.6) % 1;
    const down = chopPhase > 0.55 && chopPhase < 0.8;
    const palette = { X: "#e6b98a", R: RED, A: STEEL, B: INK };

    rect(ctx, jx + 18, ground - 9, 14, 9, DARK);
    rect(ctx, jx + 18, ground - 10, 14, 2, MID);
    rect(ctx, jx + 20, ground - 10, 10, 1, PALE);
    sprite(ctx, down ? JACK_DOWN : JACK_UP, jx, ground - 11, palette);
    const chop = Math.floor(t * 1.6);

    if (down && chop !== lastChop) {
      lastChop = chop;
      for (let i = 0; i < 6; i++) {
        chips.push({ x: jx + 24, y: ground - 11, vx: -10 + rand() * 40, vy: -22 - rand() * 22, a: 0 });
      }
    }
    chips.forEach((c) => {
      c.a += dt;
      c.vy += 70 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      rect(ctx, c.x, c.y, 2, 1, c.a % 0.2 < 0.1 ? PALE : MID);
    });
    chips = chips.filter((c) => c.a < 0.9 && c.y < ground);

    /* ---- the circular saw (right) ---- */
    const cx = w - 34;
    const cy = ground - 24;

    rect(ctx, cx - 6, cy + 10, 12, ground - cy - 10, DARK);
    rect(ctx, cx - 30, ground - 8, 62, 8, MID);
    rect(ctx, cx - 30, ground - 9, 62, 1, PALE);
    disc(ctx, cx, cy, 13, STEEL);
    disc(ctx, cx, cy, 10, "#c9d1d8");
    disc(ctx, cx, cy, 2, STEEL_DARK);
    for (let i = 0; i < 16; i++) {
      const a = t * 9 + (i / 16) * Math.PI * 2;

      rect(ctx, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 2, 2, STEEL);
      if (i % 4 === 0) line(ctx, cx, cy, cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, STEEL_DARK);
    }
    dustClock += dt;
    while (dustClock > 0.04) {
      dustClock -= 0.04;
      dust.push({ x: cx - 12, y: cy + 11, vx: -16 - rand() * 24, vy: -10 - rand() * 26, a: 0 });
    }
    dust.forEach((d) => {
      d.a += dt;
      d.vy += 36 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      rect(ctx, d.x, d.y, 1, 1, d.a < 0.5 ? PALE : LIGHT);
    });
    dust = dust.filter((d) => d.a < 1.3 && d.y < ground);

    /* ---- a log rolling along the ground ---- */
    const span = w + 50;
    const lx = w + 12 - ((t * 14) % span);
    const roll = t * 2;

    disc(ctx, lx, ground - 7, 7, DARK);
    disc(ctx, lx, ground - 7, 6, MID);
    disc(ctx, lx, ground - 7, 3, LIGHT);
    disc(ctx, lx, ground - 7, 1, DARK);
    line(ctx, lx, ground - 7, lx + Math.cos(roll) * 6, ground - 7 + Math.sin(roll) * 6, DARK);

    /* ---- the woodpecker on its post (top left) ---- */
    const px = 70;

    rect(ctx, px, 22, 8, ground - 22, DARK);
    rect(ctx, px + 1, 22, 2, ground - 22, MID);
    const tap = Math.floor(t * 6) % 6 < 2;

    sprite(ctx, tap ? PECKER_B : PECKER_A, px + (tap ? 5 : 8), 34, { R: RED, K: INK, W: PALE });
    if (tap) {
      rect(ctx, px + 4, 38, 1, 1, PALE);
      rect(ctx, px + 2, 36, 1, 1, MID);
    }

    /* ---- sawdust sifting through the light ---- */
    motes.forEach((m) => {
      m.y += m.s * dt;
      if (m.y > h) m.y = -2;
      rect(ctx, m.x + Math.sin(t + m.p) * 4, m.y, 1, 1, PALE);
    });
  };
};
