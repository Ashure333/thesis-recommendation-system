/**
 * Unit tests for the climb's accents.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  FRAME_H,
  FRAME_W,
  motePose,
  sylphPose,
  vineShown,
  vineSpecs,
} from "../src/utils/ascentAccents.ts";

test("sylphs stay inside the frame, in whole pixels, at any moment", () => {
  for (let i = 0; i < 6; i++) {
    for (let t = 0; t < 600; t += 0.37) {
      const s = sylphPose(i, t);

      assert.ok(Number.isInteger(s.x) && Number.isInteger(s.y));
      assert.ok(s.x >= 4 && s.x <= FRAME_W - 4, `x ${s.x}`);
      assert.ok(s.y >= 4 && s.y <= FRAME_H - 4, `y ${s.y}`);
      assert.ok(s.glow >= 0 && s.glow <= 1);
      assert.ok(s.dir === 1 || s.dir === -1);
      assert.ok(s.flap === 0 || s.flap === 1);
    }
  }
});

test("sylphs fly different courses and flap", () => {
  const at = (i) => sylphPose(i, 12.3);

  assert.notDeepEqual([at(0).x, at(0).y], [at(1).x, at(1).y]);
  assert.notDeepEqual([at(1).x, at(1).y], [at(2).x, at(2).y]);

  const flaps = new Set();

  for (let t = 0; t < 2; t += 0.05) flaps.add(sylphPose(0, t).flap);

  assert.equal(flaps.size, 2, "wings should go up and down");
});

test("a sylph's position is a pure function of time", () => {
  assert.deepEqual(sylphPose(2, 33.3), sylphPose(2, 33.3));
});

test("vines hang from the top, spread across it, each its own length", () => {
  const vines = vineSpecs(9, 5);

  assert.equal(vines.length, 9);
  assert.ok(vines.every((v) => v.x >= 0 && v.x < FRAME_W));
  assert.ok(vines.every((v) => v.length >= 16 && v.length <= 70));
  assert.ok(new Set(vines.map((v) => v.length)).size >= 5);

  const xs = vines.map((v) => v.x);

  assert.deepEqual(xs, [...xs].sort((a, b) => a - b), "left to right");
  assert.deepEqual(vineSpecs(9, 5), vines, "the same every time");
  assert.notDeepEqual(vineSpecs(9, 6), vines, "another seed hangs differently");
});

test("vines grow in with the climb, from nothing to their full length", () => {
  assert.equal(vineShown(40, 0), 0);
  assert.equal(vineShown(40, 1), 40);
  assert.equal(vineShown(40, -3), 0);
  assert.equal(vineShown(40, 9), 40);

  let last = -1;

  for (let g = 0; g <= 1; g += 0.05) {
    const v = vineShown(40, g);

    assert.ok(v >= last);
    last = v;
  }
});

test("motes rise, wander and twinkle inside the frame", () => {
  let moved = 0;

  for (let k = 0; k < 40; k++) {
    for (let t = 0; t < 120; t += 1.7) {
      const m = motePose(k, t);

      assert.ok(Number.isInteger(m.x) && Number.isInteger(m.y));
      assert.ok(m.y >= -12 && m.y <= FRAME_H + 6, `y ${m.y}`);
      assert.ok(m.glow >= 0 && m.glow <= 1);
    }

    if (motePose(k, 4).y < motePose(k, 1).y || motePose(k, 4).y > FRAME_H - 20) moved++;
  }

  assert.ok(moved >= 30, "most motes should be drifting");
});
