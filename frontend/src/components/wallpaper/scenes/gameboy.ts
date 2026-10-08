/**
 * Pocket Green's wallpaper: a Nokia-style handheld screen that plays itself.
 *
 * Four shades of green, and the little games every old phone had: a snake
 * that eats its way around a board, a ship shooting its way through aliens,
 * a bouncing ball hopping pipes, an envelope, a heart and a phone drifting
 * past, a signal and battery gauge, and a small boy and his dog walking
 * along the bottom.
 */

import { clamp, digits, disc, rect, rng, sprite, type Ctx, type Scene, type SceneFactory } from "../pixel";

const C0 = "#0f380f";
const C1 = "#306230";
const C2 = "#8bac0f";
const C3 = "#9bbc0f";
const INK = { X: C0 };
const MID = { X: C1 };

const SHIP = [".X.......", "XXXXX....", "XXXXXXXXX", "XXXXX....", ".X......."];
const ALIEN = ["..XXX..", ".XXXXX.", "XX.X.XX", "XXXXXXX", ".X...X.", "X.....X"];
const ENVELOPE = ["XXXXXXXXX", "XX.....XX", "X.X...X.X", "X..X.X..X", "X...X...X", "XXXXXXXXX"];
const HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
const PHONE = ["..X..", "XXXXX", "X...X", "X...X", "XXXXX", "X.X.X", "XXXXX", "X.X.X", "XXXXX"];
const BOY_A = ["..XXX..", ".XXXXX.", ".XX.XX.", "..XXX..", ".XXXXX.", "X.XXX.X", "X.XXX.X", "..XXX..", ".XX.XX.", ".X...X."];
const BOY_B = ["..XXX..", ".XXXXX.", ".XX.XX.", "..XXX..", ".XXXXX.", "X.XXX.X", "X.XXX.X", "..XXX..", "..X.X..", ".XX.XX."];
const DOG_A = ["......XX.", "XX..XXXXX", "XXXXXXXX.", ".XXXXXXX.", ".X.X..X.X"];
const DOG_B = ["......XX.", "XX..XXXXX", "XXXXXXXX.", ".XXXXXXX.", "..X.XX.X."];

interface Cell {
  x: number;
  y: number;
}

export const gameboyScene: SceneFactory = (w, h) => {
  const rand = rng(1989);

  /* ----- the static layer: a faint dither over the pale green ----- */
  const back = document.createElement("canvas");

  back.width = w;
  back.height = h;

  const b = back.getContext("2d")!;

  rect(b, 0, 0, w, h, C3);
  for (let y = 0; y < h; y += 2) {
    for (let x = (y / 2) % 2 === 0 ? 0 : 2; x < w; x += 4) rect(b, x, y, 1, 1, C2);
  }
  for (let x = 0; x < w; x += 4) {
    rect(b, x, h - 4, 2, 4, C0);
    rect(b, x + 2, h - 4, 2, 4, C1);
  }
  rect(b, 0, h - 5, w, 1, C0);

  /* ----- Snake ----- */
  const CELL = 4;
  const cols = 26;
  const rows = 15;
  const fieldX = 8;
  const fieldY = h - rows * CELL - 22;
  let snake: Cell[] = [];
  let dir: Cell = { x: 1, y: 0 };
  let food: Cell = { x: 10, y: 6 };
  let score = 0;
  let snakeClock = 0;

  const place = () => {
    for (let tries = 0; tries < 60; tries++) {
      const c = { x: Math.floor(rand() * cols), y: Math.floor(rand() * rows) };

      if (!snake.some((s) => s.x === c.x && s.y === c.y)) return c;
    }

    return { x: 3, y: 3 };
  };
  const resetSnake = () => {
    snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
    dir = { x: 1, y: 0 };
    score = 0;
    food = place();
  };

  resetSnake();

  const stepSnake = () => {
    const head = snake[0];
    const options = [dir, { x: dir.y, y: -dir.x }, { x: -dir.y, y: dir.x }]
      .map((d) => ({ d, n: { x: head.x + d.x, y: head.y + d.y } }))
      .filter(
        ({ n }) =>
          n.x >= 0 && n.y >= 0 && n.x < cols && n.y < rows && !snake.slice(0, -1).some((s) => s.x === n.x && s.y === n.y),
      )
      .sort(
        (a, c) =>
          Math.abs(a.n.x - food.x) + Math.abs(a.n.y - food.y) - (Math.abs(c.n.x - food.x) + Math.abs(c.n.y - food.y)),
      );

    if (!options.length) {
      resetSnake();

      return;
    }

    dir = options[0].d;
    snake.unshift(options[0].n);

    if (options[0].n.x === food.x && options[0].n.y === food.y) {
      score += 10;
      food = place();
    } else snake.pop();
  };

  /* ----- Space Impact ----- */
  const sx = w - 132;
  const sy = 10;
  const sw = 120;
  const sh = 46;
  let shipY = sh / 2;
  let fireClock = 0;
  let spawnClock = 0;
  let bullets: Cell[] = [];
  let aliens: { x: number; y: number; phase: number }[] = [];
  let booms: { x: number; y: number; age: number }[] = [];
  let lastT = 0;

  /* ----- Bounce ----- */
  const bx = w - 132;
  const by = h - 48;
  const bw = 120;
  let pipes: { x: number; h: number }[] = [{ x: 90, h: 7 }];
  let ballY = 0;
  let ballV = 0;
  let pipeClock = 0;

  const frame = (ctx: Ctx, x: number, y: number, fw: number, fh: number) => {
    rect(ctx, x - 1, y - 1, fw + 2, fh + 2, C0);
    rect(ctx, x, y, fw, fh, C3);
  };

  return (ctx: Ctx, t: number) => {
    const dt = clamp(t - lastT, 0, 0.25);

    lastT = t;
    ctx.drawImage(back, 0, 0);

    /* ---- status bar: signal and battery ---- */
    for (let i = 0; i < 5; i++) {
      const lit = i < 2 + Math.floor((Math.sin(t * 0.6) + 1) * 1.5);

      rect(ctx, 6 + i * 3, 12 - i * 2 - 2, 2, 2 + i * 2, lit ? C0 : C1);
    }
    rect(ctx, 28, 4, 12, 7, C0);
    rect(ctx, 40, 6, 2, 3, C0);
    rect(ctx, 29, 5, 10, 5, C3);
    const level = 1 + Math.floor(((t * 0.35) % 1) * 4);

    for (let i = 0; i < level; i++) rect(ctx, 30 + i * 2 + i, 6, 2, 3, C0);

    /* ---- Snake ---- */
    snakeClock += dt;
    while (snakeClock > 0.11) {
      snakeClock -= 0.11;
      stepSnake();
    }
    frame(ctx, fieldX, fieldY, cols * CELL, rows * CELL);
    rect(ctx, fieldX + 2, fieldY - 8, 1, 1, C0);
    digits(ctx, String(score).padStart(4, "0"), fieldX + cols * CELL - 15, fieldY - 8, C0);
    snake.forEach((s, i) => {
      rect(ctx, fieldX + s.x * CELL, fieldY + s.y * CELL, 3, 3, C0);
      if (i > 0) {
        const p = snake[i - 1];

        rect(ctx, fieldX + ((s.x + p.x) * CELL) / 2, fieldY + ((s.y + p.y) * CELL) / 2, 3, 3, C0);
      }
    });
    if (Math.floor(t * 4) % 2 === 0) {
      rect(ctx, fieldX + food.x * CELL, fieldY + food.y * CELL, 3, 3, C1);
      rect(ctx, fieldX + food.x * CELL + 1, fieldY + food.y * CELL + 1, 1, 1, C0);
    }

    /* ---- Space Impact ---- */
    fireClock += dt;
    spawnClock += dt;
    if (spawnClock > 1.3) {
      spawnClock = 0;
      aliens.push({ x: sw + 4, y: 6 + rand() * (sh - 16), phase: rand() * 6 });
    }
    const target = aliens.filter((a) => a.x > 22).sort((a, c) => a.x - c.x)[0];

    if (target) shipY += clamp(target.y + 3 - shipY, -22 * dt, 22 * dt);
    if (fireClock > 0.38) {
      fireClock = 0;
      bullets.push({ x: 14, y: Math.round(shipY) });
    }
    bullets.forEach((bl) => (bl.x += 70 * dt));
    aliens.forEach((a) => {
      a.x -= 16 * dt;
      a.y += Math.sin(t * 2 + a.phase) * 8 * dt;
    });
    bullets = bullets.filter((bl) => {
      const hit = aliens.find((a) => bl.x > a.x && bl.x < a.x + 7 && bl.y > a.y && bl.y < a.y + 6);

      if (hit) {
        booms.push({ x: hit.x + 3, y: hit.y + 3, age: 0 });
        aliens = aliens.filter((a) => a !== hit);
      }

      return !hit && bl.x < sw;
    });
    aliens = aliens.filter((a) => a.x > -8);
    booms.forEach((bm) => (bm.age += dt));
    booms = booms.filter((bm) => bm.age < 0.3);

    frame(ctx, sx, sy, sw, sh);
    sprite(ctx, SHIP, sx + 4, sy + Math.round(shipY) - 2, INK);
    bullets.forEach((bl) => rect(ctx, sx + bl.x, sy + bl.y, 3, 1, C0));
    aliens.forEach((a) => sprite(ctx, ALIEN, sx + a.x, sy + a.y, INK));
    booms.forEach((bm) => {
      const r = 1 + Math.floor(bm.age * 14);

      rect(ctx, sx + bm.x - r, sy + bm.y, 2, 1, C0);
      rect(ctx, sx + bm.x + r, sy + bm.y, 2, 1, C0);
      rect(ctx, sx + bm.x, sy + bm.y - r, 1, 2, C0);
      rect(ctx, sx + bm.x, sy + bm.y + r, 1, 2, C0);
    });

    /* ---- Bounce ---- */
    pipeClock += dt;
    if (pipeClock > 2.1) {
      pipeClock = 0;
      pipes.push({ x: bw + 4, h: 5 + Math.floor(rand() * 5) });
    }
    pipes.forEach((p) => (p.x -= 26 * dt));
    pipes = pipes.filter((p) => p.x > -8);
    const next = pipes.filter((p) => p.x > 14).sort((a, c) => a.x - c.x)[0];

    if (ballY <= 0 && next && next.x - 20 < 9) ballV = 52;
    ballV -= 150 * dt;
    ballY = Math.max(0, ballY + ballV * dt);
    if (ballY === 0 && ballV < 0) ballV = 0;
    frame(ctx, bx, by, bw, 32);
    rect(ctx, bx, by + 28, bw, 4, C1);
    pipes.forEach((p) => {
      rect(ctx, bx + p.x, by + 28 - p.h, 6, p.h, C0);
      rect(ctx, bx + p.x - 1, by + 28 - p.h, 8, 2, C0);
    });
    disc(ctx, bx + 20, by + 25 - ballY, 2, C0);
    rect(ctx, bx + 19, by + 24 - ballY, 1, 1, C3);

    /* ---- things drifting past ---- */
    const drift = (rows: readonly string[], speed: number, y: number, offset: number, bob: number, p = INK) => {
      const span = w + 30;
      const x = ((t * speed + offset) % span) - 15;

      sprite(ctx, rows, x, y + Math.round(Math.sin(t * 1.6 + offset) * bob), p);
    };

    drift(ENVELOPE, 11, Math.round(h * 0.3), 40, 3);
    drift(HEART, 8, Math.round(h * 0.52), 130, 4, MID);
    drift(PHONE, 6, Math.round(h * 0.18), 210, 2);

    /* ---- the boy and his dog ---- */
    const bxw = ((t * 17) % (w + 40)) - 14;
    const step = Math.floor(t * 4) % 2 === 0;

    sprite(ctx, step ? BOY_A : BOY_B, bxw, h - 16, INK);
    sprite(ctx, step ? DOG_A : DOG_B, bxw - 14, h - 11, INK);
  };
};
