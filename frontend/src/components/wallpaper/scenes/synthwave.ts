/**
 * Neon Horizon's wallpaper: the retro-future sunset.
 *
 * A striped sun sits on the horizon behind outlined mountains, a perspective
 * grid races toward you, stars twinkle, palms sway at the edges and a
 * saucer glides across the sky now and then.
 */

import { frac, line, rect, rng, sprite, type Ctx, type SceneFactory } from "../pixel";

const MAGENTA = "#ff2d95";
const CYAN = "#19e3ff";
const VIOLET = "#7a2cff";
const NIGHT = "#0a0216";
const SAUCER = [".....CCC.....", "...CCCCCCC...", "WWWWWWWWWWWWW", ".W.W.W.W.W.W.", "..............", "......."];

const lerp = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export const synthwaveScene: SceneFactory = (w, h) => {
  const rand = rng(1984);
  const hz = Math.round(h * 0.58);
  const cxw = Math.round(w / 2);

  const back = document.createElement("canvas");

  back.width = w;
  back.height = h;

  const b = back.getContext("2d")!;

  /* sky bands, 2 px tall, from deep violet to hot pink at the horizon */
  const top = [16, 4, 44];
  const mid = [74, 14, 96];
  const low = [255, 45, 149];

  for (let y = 0; y < hz; y += 2) {
    const k = y / hz;
    const color = k < 0.7 ? lerp(top, mid, k / 0.7) : lerp(mid, low, (k - 0.7) / 0.3);

    rect(b, 0, y, w, 2, rgb(color));
  }
  rect(b, 0, hz, w, h - hz, "#14052e");

  /* two ranges of mountains with a neon outline */
  const range = (base: number, amp: number, seed: number, fill: string, edge: string) => {
    let prev = base;

    for (let x = 0; x < w; x++) {
      const y = Math.round(
        base - Math.abs(Math.sin(x * 0.045 + seed)) * amp - Math.abs(Math.sin(x * 0.11 + seed * 2)) * amp * 0.35,
      );

      rect(b, x, y, 1, hz - y, fill);
      rect(b, x, Math.min(y, prev), 1, Math.abs(y - prev) + 1, edge);
      prev = y;
    }
  };

  range(hz, 26, 1.2, "#2a0a52", "#7a2cff");
  range(hz, 14, 4.1, "#1d0640", "#19e3ff");

  const stars = Array.from({ length: 70 }, () => ({ x: Math.floor(rand() * w), y: Math.floor(rand() * hz * 0.65), p: rand() * 6 }));

  return (ctx: Ctx, t: number) => {
    ctx.drawImage(back, 0, 0);

    /* stars */
    stars.forEach((s) => {
      if (Math.sin(t * 1.4 + s.p) > -0.2) rect(ctx, s.x, s.y, 1, 1, s.p > 4 ? CYAN : "#ffe8ff");
    });

    /* the sun, bobbing a pixel, stripes cut out of its lower half */
    const sunY = hz - 22 + Math.round(Math.sin(t * 0.5) * 1.5);
    const R = 26;

    for (let dy = -R; dy <= R; dy++) {
      const yy = sunY + dy;

      if (yy >= hz) break;

      const rel = (dy + R) / (2 * R);
      const cut = rel > 0.52 && Math.floor((yy + t * 3) / 3) % 2 === 0 && (rel - 0.52) * 9 > (Math.floor((yy + t * 3) / 3) % 4) * 0.5;

      if (cut) continue;

      const half = Math.floor(Math.sqrt(R * R - dy * dy));
      const k = rel;
      const color = [255, Math.round(225 - k * 180), Math.round(77 + k * 72)];

      rect(ctx, cxw - half, yy, half * 2 + 1, 1, rgb(color));
    }

    /* the grid */
    rect(ctx, 0, hz, w, 1, CYAN);
    rect(ctx, 0, hz + 1, w, 1, "#0f6c80");
    const N = 14;
    const slide = frac(t * 0.45);

    for (let n = 0; n < N; n++) {
      const d = (n + slide) / N;
      const y = hz + 1 + Math.round((h - hz) * d * d);

      rect(ctx, 0, y, w, 1, d > 0.15 ? MAGENTA : VIOLET);
    }
    for (let i = -12; i <= 12; i++) {
      line(ctx, cxw, hz + 1, cxw + i * (w / 7), h, i === 0 ? CYAN : VIOLET);
    }

    /* palms at the edges */
    const palm = (x: number, lean: number) => {
      for (let j = 0; j < 30; j++) {
        rect(ctx, x + Math.round(Math.sin(j * 0.12) * lean * 4), hz + 12 - j, 2, 1, NIGHT);
      }

      const tx = x + Math.round(Math.sin(30 * 0.12) * lean * 4);
      const ty = hz + 12 - 30;

      for (let f = 0; f < 6; f++) {
        const a = Math.PI + (f / 5) * Math.PI + Math.sin(t * 1.1 + f) * 0.08;

        for (let r = 1; r < 13; r++) {
          rect(ctx, tx + Math.cos(a) * r, ty - Math.sin(a) * r * 0.6 + (r * r) * 0.025, 1, 1, NIGHT);
        }
      }
    };

    palm(12, 1);
    palm(w - 14, -1);

    /* a saucer crossing the sky every so often */
    const lap = (t % 16) / 16;

    if (lap < 0.6) {
      const sx = -16 + (lap / 0.6) * (w + 32);

      sprite(ctx, SAUCER, sx, Math.round(hz * 0.3 + Math.sin(t * 2) * 2), { C: CYAN, W: "#ffe8ff" });
      if (Math.floor(t * 6) % 2 === 0) rect(ctx, sx + 4, Math.round(hz * 0.3) + 5, 5, 1, MAGENTA);
    }

  };
};
