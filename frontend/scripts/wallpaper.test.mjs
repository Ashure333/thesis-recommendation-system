/**
 * Unit tests for the look wallpapers' helpers and setting.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import { clamp, digits, disc, line, rng, sprite } from "../src/components/wallpaper/pixel.ts";
import { DEFAULT_UI_CUSTOM, SKINS, normalize } from "../src/utils/uiCustom.ts";

const recorder = () => {
  const calls = [];

  return {
    calls,
    set fillStyle(v) {
      this.color = v;
    },
    fillRect(x, y, w, h) {
      calls.push([x, y, w, h, this.color]);
    },
  };
};

test("wallpapers are on by default and can be switched off", () => {
  assert.equal(DEFAULT_UI_CUSTOM.wallpaper, true);
  assert.equal(normalize(null).wallpaper, true);
  assert.equal(normalize({ wallpaper: false }).wallpaper, false);
  assert.equal(normalize({ wallpaper: "no" }).wallpaper, true);
});

test("there is a look to give a wallpaper to", () => {
  assert.ok(SKINS.length >= 6);
});

test("the random numbers repeat, so a wallpaper always looks the same", () => {
  const a = rng(42);
  const b = rng(42);

  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.notEqual(rng(1)(), rng(2)());
  for (let i = 0; i < 50; i++) {
    const v = a();

    assert.ok(v >= 0 && v < 1);
  }
});

test("a line plots whole pixels, end to end, and part of it plots less", () => {
  const full = recorder();
  const half = recorder();

  line(full, 0, 0, 10, 4, "#fff");
  line(half, 0, 0, 10, 4, "#fff", 0.5);
  assert.deepEqual(full.calls[0].slice(0, 2), [0, 0]);
  assert.deepEqual(full.calls.at(-1).slice(0, 2), [10, 4]);
  assert.ok(half.calls.length < full.calls.length);
  assert.ok(full.calls.every(([x, y, w, h]) => Number.isInteger(x) && Number.isInteger(y) && w === 1 && h === 1));
});

test("a disc is symmetric and as tall as its diameter", () => {
  const ctx = recorder();

  disc(ctx, 10, 10, 3, "#000");

  const ys = ctx.calls.map((c) => c[1]);

  assert.equal(Math.max(...ys) - Math.min(...ys), 6);
  assert.equal(ctx.calls.length, 7);
  ctx.calls.forEach(([x, , w]) => assert.equal(x + (w - 1) / 2, 10));
});

test("a sprite paints only the characters in its palette, and can flip", () => {
  const ctx = recorder();
  const flipped = recorder();

  sprite(ctx, ["X.", ".Y"], 5, 5, { X: "#111" });
  sprite(flipped, ["X."], 5, 5, { X: "#111" }, true);
  assert.deepEqual(ctx.calls, [[5, 5, 1, 1, "#111"]]);
  assert.deepEqual(flipped.calls, [[6, 5, 1, 1, "#111"]]);
});

test("digits draw 4 pixels apart and ignore what they do not know", () => {
  const ctx = recorder();

  digits(ctx, "1?1", 0, 0, "#000");

  const xs = new Set(ctx.calls.map((c) => c[0]));

  assert.ok(xs.has(0) || xs.has(1));
  assert.ok([...xs].some((x) => x >= 8));
});

test("clamp bounds a value", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
