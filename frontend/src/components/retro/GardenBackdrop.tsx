/* ============================================================
   GARDEN BACKDROP — the animated landscape behind the tree.

   A port of the "Maple & Oak Landscape" reference (320 x 180):
   sky and drifting clouds, forest hills, mown lawn with a
   winding path, a picket fence, and a red maple + green oak that
   grow in as the main tree matures.

   Idle life on top of the reference: the clouds drift, both
   canopies rustle, leaves fall from the trees, and a bird crosses
   the sky now and then. The palette is softened to the app's warm
   paper and lawn greens.
   ============================================================ */

import { useEffect, useMemo, useRef } from "react";

const W = 320;
const H = 180;

const rng = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const R = rng(42);
const hx = (h: string) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
const hash = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return (h & 0xffff) / 65535;
};

const SKY = ["#96c3e0", "#aed4ea", "#c6e4f2"].map(hx);
const CLOUD = ["#ffffff", "#e8f0f4"].map(hx);
const BG_TREES = ["#2b5239", "#376845"].map(hx);
/* Five-tone ramps, borrowed from the main trees' painter. */
const GRASS = ["#2c4f20", "#38662a", "#4c8034", "#619f42", "#7cbe5c"].map(hx);
const PATH = ["#9a8466", "#a68b6d", "#735f49"].map(hx);
const WOOD = ["#241a12", "#38291e", "#4f3a2b", "#6b4e39", "#8a6a50"].map(hx);
/* The maple and oak refrains, verbatim. */
const RED_LEAF = ["#4a0a12", "#861418", "#c42a1c", "#e62e3d", "#ff7a4d"].map(hx);
const GRN_LEAF = ["#0f2a16", "#1d4a22", "#2f7a2e", "#4fa83e", "#8fd45c"].map(hx);
const ROCK = ["#7a8a80", "#90a196"].map(hx);

export default function GardenBackdrop() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  const scene = useMemo(() => {
    const falling: { x: number; y: number; v: number; ph: number; half: boolean }[] = [];
    for (let i = 0; i < 10; i++) {
      falling.push({
        x: R() * W,
        y: R() * 120,
        v: 0.4 + R() * 0.5,
        ph: R() * 6.28,
        half: R() > 0.5,
      });
    }
    return falling;
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const buf = img.data;

    const put = (x: number, y: number, c: number[]) => {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const o = (y * W + x) * 4;
      buf[o] = c[0];
      buf[o + 1] = c[1];
      buf[o + 2] = c[2];
      buf[o + 3] = 255;
    };

    /* Bounded circle, for the rocks. */
    const circle = (
      cx: number,
      cy: number,
      r: number,
      colArray: number[][],
    ) => {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) {
            const n = hash(Math.floor(cx + x), Math.floor(cy + y));
            const dist = Math.sqrt(x * x + y * y) / r;
            const colIdx = clamp(
              Math.floor((1 - dist) * 2 + n * 1.5),
              0,
              colArray.length - 1,
            );
            put(cx + x, cy + y, colArray[colIdx]);
          }
        }
      }
    };

    const drawScene = (now: number) => {
      buf.fill(0);
      const t = now / 1000;

      /* Idle: drifting clouds wrap across the sky. */
      const cloudDrift = (t * 14) % (W + 90);
      const cloud1x = 60 + cloudDrift - 45;
      const cloud2x = 250 + cloudDrift * 0.7 - 45 - 200;
      const cloud3x = (170 + cloudDrift * 1.3) % (W + 90) - 45;

      for (let y = 0; y < 100; y++) {
        for (let x = 0; x < W; x++) {
          const sCol = SKY[y < 40 ? 0 : y < 70 ? 1 : 2];
          const puff = (bx: number, by: number, rad: number) => {
            if (Math.hypot(x - bx, y - by) < rad + hash(x / 5, y / 5) * 10 && y < 55) {
              return CLOUD[hash(x, y) > 0.8 ? 1 : 0];
            }
            return sCol;
          };
          put(
            x,
            y,
            y < 60
              ? puff(cloud1x, 30, 20)
              : Math.hypot(x - cloud2x, y - 20) < 25 + hash(x / 6, y / 6) * 12 && y < 45
                ? CLOUD[hash(x, y) > 0.8 ? 1 : 0]
                : sCol,
          );
          if (y < 60) continue;
          const c2 = Math.hypot(x - cloud2x, y - 20);
          if (c2 < 25 + hash(x / 6, y / 6) * 12 && y < 45) {
            put(x, y, CLOUD[hash(x, y) > 0.8 ? 1 : 0]);
          } else if (y < 45 && Math.hypot(x - cloud3x, y - 32) < 18 + hash(x / 6, y / 6) * 8) {
            put(x, y, CLOUD[hash(x, y) > 0.85 ? 1 : 0]);
          }
        }
      }

      /* Forest hills. */
      for (let y = 80; y < 110; y++) {
        for (let x = 0; x < W; x++) {
          const hillY = 95 + Math.sin(x * 0.02) * 10 + Math.cos(x * 0.05) * 5;
          if (y > hillY && y <= hillY + 20) {
            put(x, y, BG_TREES[hash(x / 2, y / 2) > 0.5 ? 1 : 0]);
          }
        }
      }

      /* Ground and path. */
      for (let y = 100; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const pCenter = 140 + Math.sin(x * 0.015) * 30 + Math.cos(x * 0.04) * 15;
          const pWidth = 15 + hash(x, 0) * 5;
          if (Math.abs(y - pCenter) < pWidth) {
            put(x, y, PATH[hash(x, y) > 0.7 ? 1 : hash(x, y) < 0.3 ? 2 : 0]);
          } else {
            const h = hash(x, y);
            const h2 = hash(x * 2, y);
            if (h > 0.94) {
              put(x, y, GRASS[4]);
            } else if (h2 < 0.12) {
              put(x, y, GRASS[0]);
            } else {
              put(
                x,
                y,
                GRASS[
                  clamp(
                    Math.floor(((y - 140) / 55) * 2 + h * 2.4),
                    1,
                    3,
                  )
                ],
              );
            }
          }
        }
      }

      /* A temple rests on the hill: tiered roofs with upturned
         eaves, a dark door, and a pale moon behind it. */
      {
        const tx = 215;
        const gy = 108;
        for (let dy = -12; dy <= 12; dy++) {
          for (let dx = -12; dx <= 12; dx++) {
            if (dx * dx + dy * dy <= 12 * 12) {
              put(tx - 60 + dx, gy - 52 + dy, [228, 234, 228]);
            }
          }
        }
        const roof = [150, 166, 152];
        const roofHi = [182, 196, 184];
        const wall = [86, 100, 90];
        const dark = [52, 62, 56];
        for (let x = tx - 22; x <= tx + 22; x++) {
          for (let y = gy - 4; y <= gy; y++) {
            put(x, y, hash(x, y) > 0.5 ? wall : dark);
          }
        }
        for (let x = tx - 16; x <= tx + 16; x++) {
          for (let y = gy - 18; y <= gy - 6; y++) {
            put(x, y, hash(x, y) > 0.65 ? wall : dark);
          }
        }
        for (let x = tx - 22; x <= tx + 22; x++) {
          for (let y = gy - 22; y <= gy - 18; y++) {
            const eave = Math.abs(x - tx) > 16 ? 1 + Math.abs(x - tx) / 20 : 0;
            put(x, Math.floor(y - eave), hash(x, y) > 0.5 ? roofHi : roof);
          }
        }
        for (let x = tx - 6; x <= tx + 6; x++) {
          for (let y = gy - 16; y <= gy - 6; y++) {
            put(x, y, dark);
          }
        }
        for (let x = tx - 8; x <= tx + 8; x++) {
          for (let y = gy - 34; y <= gy - 24; y++) {
            put(x, y, hash(x, y) > 0.6 ? wall : dark);
          }
        }
        for (let x = tx - 14; x <= tx + 14; x++) {
          for (let y = gy - 38; y <= gy - 34; y++) {
            const eave = Math.abs(x - tx) > 8 ? 1 + Math.abs(x - tx) / 16 : 0;
            put(x, Math.floor(y - eave), hash(x, y) > 0.5 ? roofHi : roof);
          }
        }
        put(tx, gy - 41, roofHi);
        put(tx, gy - 43, roof);
        put(tx, gy - 46, dark);
      }

      /* Picket fence. */
      for (let x = 0; x < W; x++) {
          if (x % 40 < 4) {
            for (let y = 90; y < 105; y++) put(x, y, WOOD[hash(x, y) > 0.5 ? 1 : 0]);
          }
          if ((x + 20) % 40 > 4) {
            for (let y = 94; y < 96; y++) put(x, y, WOOD[1]);
            for (let y = 100; y < 102; y++) put(x, y, WOOD[1]);
          }
      }

      /* Idle sway for both trees. */
      const redSway = Math.sin(t * 1.1) * 3;
      const greenSway = Math.sin(t * 0.9 + 2) * 3;



      /* Rocks at the lawn edge. */
      circle(180, 130, 8, ROCK);
      circle(40, 140, 6, ROCK);

      /* Idle: leaves fall from the two canopies and the grass. */
      {
        for (const l of scene) {
          l.y += l.v;
          l.x += Math.sin(l.ph) * 0.7;
          l.ph += 0.08;
          const c = l.half ? RED_LEAF[2] : GRN_LEAF[3];
          if (l.y > 158) {
            l.y = 40 + R() * 60;
            l.x = R() * W;
            put(l.x, 160, c);
          } else if (l.y > 100) {
            put(l.x, Math.floor(l.y), c);
          } else {
            put(l.x, Math.floor(l.y), c);
          }
        }
      }

      /* Idle: a bird crosses the sky every few seconds. */
      const cycle = t % 7;
      if (cycle > 3.2 && cycle < 5.2) {
        const bx = ((cycle - 3.2) / 2) * (W + 40) - 20;
        const by = 26 + Math.sin(cycle * 3) * 4;
        const flap = Math.sin(t * 24) > 0 ? 1 : -1;
        put(bx, by, ROCK[0]);
        put(bx - 2, by - 1, ROCK[0]);
        put(bx + 2, by - 1, ROCK[0]);
        put(bx - 2, by - 1 - flap, ROCK[1]);
        put(bx + 2, by - 1 - flap, ROCK[1]);
      }

      /* Monochrome wash: mute the whole scene toward a sage hue at
         half strength, so the backdrop recedes behind the tree. */
      for (let i = 0; i < buf.length; i += 4) {
        if (!buf[i + 3]) continue;
        const g =
          buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114;
        buf[i] = Math.round(141 * 0.5 + g * 0.5);
        buf[i + 1] = Math.round(160 * 0.5 + g * 0.5);
        buf[i + 2] = Math.round(146 * 0.5 + g * 0.5);
      }

      ctx.putImageData(img, 0, 0);
    };

    let raf = 0;
    const frame = (now: number) => {
      drawScene(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [scene]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      role="img"
      aria-label="Pixel art maple and oak landscape growing behind the tree"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}