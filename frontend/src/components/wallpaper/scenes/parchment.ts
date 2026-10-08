/**
 * Old Parchment's wallpaper: a scriptorium by candlelight.
 *
 * A quill writes line after line of looping script and the ink fades into
 * the page; a shaft of window light carries dust; a candle flickers at the
 * corner of the desk with a moth circling it; small flourishes rise like
 * embers.
 */

import { clamp, disc, rect, rng, sprite, type Ctx, type SceneFactory } from "../pixel";

const PAPER = "#eee2c4";
const FIBER = "#e2d2aa";
const EDGE = "#c9b07a";
const INK = "#3e2c18";
const LIGHT = "#fff6cf";
const FLAME_A = ["..Y..", ".YOY.", ".YOY.", "YOOOY", ".YOY."];
const FLAME_B = ["..Y..", "..YY.", ".YOY.", "YOOOY", ".YOY."];
const FLAME_C = [".Y...", ".YY..", ".YOY.", "YOOOY", ".YOY."];
const QUILL = ["........KK", ".......KWK", "......KWK.", ".....KWK..", "....KWK...", "...KK.....", "..KK......", ".K........"];
const MOTH_A = [".M...M.", "MMM.MMM", ".MMMMM.", "..MMM.."];
const MOTH_B = ["...M...", ".MMMMM.", "MM.M.MM", "..MMM.."];

export const parchmentScene: SceneFactory = (w, h) => {
  const rand = rng(1456);

  /* ----- the paper, drawn once: fibres and a banded vignette ----- */
  const back = document.createElement("canvas");

  back.width = w;
  back.height = h;

  const b = back.getContext("2d")!;

  rect(b, 0, 0, w, h, PAPER);
  for (let i = 0; i < w * h * 0.012; i++) {
    rect(b, Math.floor(rand() * w), Math.floor(rand() * h), 2 + Math.floor(rand() * 5), 1, FIBER);
  }
  for (let i = 0; i < 8; i++) {
    b.globalAlpha = 0.07;
    rect(b, 0, i * 3, w, 3, EDGE);
    rect(b, 0, h - (i + 1) * 3, w, 3, EDGE);
    rect(b, i * 3, 0, 3, h, EDGE);
    rect(b, w - (i + 1) * 3, 0, 3, h, EDGE);
  }
  b.globalAlpha = 1;
  /* ruled margin lines, very faint */
  rect(b, Math.round(w * 0.08), 0, 1, h, EDGE);
  rect(b, Math.round(w * 0.08) + 2, 0, 1, h, EDGE);

  /* ----- handwriting: a looping curve broken into words ----- */
  const WORDS = [18, 30, 14, 40, 24, 34, 20, 28];
  const writing = (x: number) => Math.sin(x * 0.85) * 1.8 + Math.sin(x * 0.29) * 1.4;
  const inWord = (x: number) => {
    let at = 0;

    for (const len of WORDS) {
      if (x >= at && x < at + len) return true;
      at += len + 6;
    }

    return false;
  };

  const motes = Array.from({ length: 34 }, () => ({ x: rand() * w, y: rand() * h, p: rand() * 6, s: 1 + rand() * 2 }));
  const sparks = Array.from({ length: 9 }, () => ({ x: rand() * w, y: rand() * h, p: rand() * 6, s: 2 + rand() * 3, kind: Math.floor(rand() * 2) }));
  const left = Math.round(w * 0.12);
  const lines = [0.62, 0.74, 0.86].map((k) => Math.round(h * k));
  let drops: { x: number; y: number; v: number }[] = [];
  let lastT = 0;
  let lastLine = -1;

  return (ctx: Ctx, t: number) => {
    const dt = clamp(t - lastT, 0, 0.25);

    lastT = t;
    ctx.drawImage(back, 0, 0);

    /* ---- the shaft of window light, falling from the top right ---- */
    ctx.globalAlpha = 0.16 + Math.sin(t * 0.4) * 0.03;
    for (let y = 0; y < h; y++) {
      const x0 = w * 0.55 - y * 0.55;

      rect(ctx, x0, y, Math.round(w * 0.22), 1, LIGHT);
    }
    ctx.globalAlpha = 1;
    motes.forEach((m) => {
      m.y -= m.s * 1.2 * dt;
      m.x += Math.sin(t * 0.7 + m.p) * 3 * dt;
      if (m.y < -2) {
        m.y = h + 2;
        m.x = rand() * w;
      }

      const inShaft = m.x > w * 0.55 - m.y * 0.55 && m.x < w * 0.77 - m.y * 0.55;

      rect(ctx, m.x, m.y, 1, 1, inShaft ? "#fffbe6" : EDGE);
    });

    /* ---- the quill writing a line at a time ---- */
    const PERIOD = 14;
    const lineNo = Math.floor(t / PERIOD) % lines.length;
    const phase = (t % PERIOD) / PERIOD;
    const progress = clamp(phase / 0.75, 0, 1);
    const reach = Math.round(progress * (w * 0.7));
    const fade = phase > 0.88 ? 1 - (phase - 0.88) / 0.12 : 1;
    const baseY = lines[lineNo];

    if (lineNo !== lastLine) {
      lastLine = lineNo;
      drops = [];
    }
    ctx.globalAlpha = 0.85 * fade;
    for (let x = 0; x < reach; x++) {
      if (!inWord(x)) continue;

      const y = baseY + Math.round(writing(x));

      rect(ctx, left + x, y, 1, 1, INK);
      if (Math.sin(x * 0.85) > 0.6) rect(ctx, left + x, y + 1, 1, 1, INK);
    }
    ctx.globalAlpha = 1;
    if (progress < 1) {
      const tipX = left + reach;
      const tipY = baseY + Math.round(writing(reach));

      sprite(ctx, QUILL, tipX, tipY - 8, { K: INK, W: "#f6ecd0" });
      if (rand() < 0.03) drops.push({ x: tipX, y: tipY, v: 0 });
    }
    drops.forEach((d) => {
      d.v += 60 * dt;
      d.y += d.v * dt;
      rect(ctx, d.x, d.y, 1, 2, INK);
    });
    drops = drops.filter((d) => d.y < h);

    /* ---- the candle, with its glow, flame and moth ---- */
    const cx = 22;
    const cy = h - 38;

    for (let r = 26; r >= 10; r -= 4) {
      ctx.globalAlpha = 0.05;
      disc(ctx, cx + 2, cy - 4, r, "#ffd480");
    }
    ctx.globalAlpha = 1;
    rect(ctx, cx - 3, cy + 18, 11, 2, "#8a6a2a");
    rect(ctx, cx - 1, cy + 14, 7, 4, "#b8923c");
    rect(ctx, cx, cy, 5, 15, "#f4ead0");
    rect(ctx, cx, cy, 1, 15, "#e0d2ae");
    rect(ctx, cx + 4, cy + 2, 1, 5, "#fffaf0");
    rect(ctx, cx + 2, cy - 2, 1, 2, INK);
    const flame = [FLAME_A, FLAME_B, FLAME_C][Math.floor(t * 7) % 3];

    sprite(ctx, flame, cx, cy - 8, { Y: "#ffe27a", O: "#ff9a2e" });

    const mx = cx + 3 + Math.sin(t * 1.3) * 24;
    const my = cy - 14 + Math.sin(t * 2.1) * 10;

    sprite(ctx, Math.floor(t * 9) % 2 === 0 ? MOTH_A : MOTH_B, mx, my, { M: "#9a8a6a" });

    /* ---- flourishes rising like embers ---- */
    sparks.forEach((s) => {
      s.y -= s.s * 2 * dt;
      if (s.y < -6) {
        s.y = h + 4;
        s.x = rand() * w;
      }

      const x = Math.round(s.x + Math.sin(t * 0.6 + s.p) * 5);
      const y = Math.round(s.y);

      ctx.globalAlpha = 0.45;
      if (s.kind === 0) {
        rect(ctx, x, y - 2, 1, 5, EDGE);
        rect(ctx, x - 2, y, 5, 1, EDGE);
      } else {
        rect(ctx, x, y - 2, 1, 1, EDGE);
        rect(ctx, x - 1, y - 1, 3, 1, EDGE);
        rect(ctx, x - 2, y, 5, 1, EDGE);
        rect(ctx, x - 1, y + 1, 3, 1, EDGE);
        rect(ctx, x, y + 2, 1, 1, EDGE);
      }
      ctx.globalAlpha = 1;
    });

  };
};
