/**
 * Unit tests for the garden's whole-number pixel scaling.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import { fitStage, integerScale } from "../src/utils/pixelScale.ts";

const W = 256;
const H = 144;

test("a 2560x1440 screen is exactly 10x", () => {
  assert.equal(integerScale(2560, 1440, 1, W, H), 10);
});

test("a 4K screen is exactly 15x", () => {
  assert.equal(integerScale(3840, 2160, 1, W, H), 15);
});

test("1920x1080 floors to 7x (7.5 would split pixels)", () => {
  assert.equal(integerScale(1920, 1080, 1, W, H), 7);
});

test("the limiting axis decides", () => {
  // 2880x1800 device px: width allows 11.25x, height 12.5x
  assert.equal(integerScale(1440, 900, 2, W, H), 11);
  // a tall, narrow box is limited by its width
  assert.equal(integerScale(600, 4000, 1, W, H), 2);
});

test("an unbounded height is limited by the width alone", () => {
  assert.equal(integerScale(1074, Infinity, 1, W, H), 4);
  assert.equal(integerScale(794, Infinity, 1, W, H), 3);
});

test("it never drops below 1x", () => {
  assert.equal(integerScale(100, 50, 1, W, H), 1);
  assert.equal(integerScale(0, 0, 1, W, H), 1);
});

test("fractional display scales count in device pixels", () => {
  // 1600x900 css at 1.25 = 2000x1125 device px -> 7.8x / 7.8x -> 7
  assert.equal(integerScale(1600, 900, 1.25, W, H), 7);
});

test("floating-point noise cannot cost a whole step", () => {
  // 256 * 3 / 3 can come out as 255.99999999999997 in other arithmetic
  assert.equal(integerScale(2559.9999999, 1439.9999999, 1, W, H), 10);
  assert.equal(integerScale(0.1 * 7680, 0.1 * 4320, 1, W, H) >= 2, true);
});

test("fitStage returns the exact css box for the chosen scale", () => {
  const a = fitStage(1920, 1080, 1, W, H);

  assert.deepEqual(a, { scale: 7, cssScale: 7, cssW: 1792, cssH: 1008 });

  const b = fitStage(1440, 900, 2, W, H);

  assert.equal(b.scale, 11);
  assert.equal(b.cssScale, 5.5);
  assert.equal(b.cssW, 1408);
  assert.equal(b.cssH, 792);
});

test("every css length lands on whole device pixels", () => {
  for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    for (const [vw, vh] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]]) {
      const { scale, cssScale, cssW, cssH } = fitStage(vw, vh, dpr, W, H);

      assert.ok(Number.isInteger(scale));
      assert.ok(Math.abs(cssW * dpr - W * scale) < 1e-9, `${vw}x${vh}@${dpr}`);
      assert.ok(Math.abs(cssH * dpr - H * scale) < 1e-9);
      assert.ok(Math.abs(cssScale * dpr - scale) < 1e-9);
      assert.ok(cssW <= vw + 1e-9 || scale === 1);
    }
  }
});

test("art pixels centre without a half pixel", () => {
  // a 192x128 tree centred in the 256x144 stage leaves 32 art px each side
  for (const scale of [1, 2, 3, 7, 11]) {
    assert.equal(((W - 192) / 2) * scale, Math.floor(((W - 192) / 2) * scale));
  }
});
