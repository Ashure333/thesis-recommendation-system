/**
 * Unit tests for the pixel shatter's geometry and motion.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import { shardGrid, shardMotion } from "../src/utils/shatter.ts";

test("the grid covers the box exactly, with no overlap", () => {
  for (const [w, h, cell] of [[100, 36, 9], [7, 7, 9], [150, 40, 12], [31, 5, 4]]) {
    const shards = shardGrid(w, h, cell);
    const area = shards.reduce((sum, s) => sum + s.w * s.h, 0);

    assert.equal(area, w * h, `${w}x${h}`);
    for (const s of shards) {
      assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= w && s.y + s.h <= h);
      assert.ok(s.w > 0 && s.h > 0);
    }
  }
});

test("a tiny cell size is clamped so a button is never cut into specks", () => {
  assert.ok(shardGrid(40, 20, 0).every((s) => s.w <= 2 && s.h <= 2));
  assert.equal(shardGrid(40, 20, 0).length, 20 * 10);
});

test("pieces fly outward from the center and then fall", () => {
  const box = { w: 100, h: 30 };
  const left = shardMotion({ x: 0, y: 10, w: 9, h: 9 }, box, 0);
  const right = shardMotion({ x: 91, y: 10, w: 9, h: 9 }, box, 0);

  assert.ok(left.dx < 0 && right.dx > 0);
  assert.ok(left.dy > 0 && right.dy > 0);
});

test("the same piece always flies the same way", () => {
  const box = { w: 80, h: 24 };
  const shard = { x: 18, y: 9, w: 9, h: 9 };

  assert.deepEqual(shardMotion(shard, box, 5), shardMotion(shard, box, 5));
  assert.notDeepEqual(shardMotion(shard, box, 5), shardMotion(shard, box, 6));
});
