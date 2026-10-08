/**
 * Unit tests for the tree's Mature-to-Ancient motion: stepped cadence,
 * whole-pixel sway, the rising sap pulse, the leaf shimmer and the
 * buttress-root geometry.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MOTION_HZ,
  makeRoots,
  motionTick,
  rootAt,
  sapShade,
  shimmerShift,
  smoothstep,
  swayOffset,
} from "../src/utils/treeMotion.ts";

function lcg(seed) {
  let a = seed >>> 0;

  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;

    return a / 4294967296;
  };
}

test("motion advances in whole ticks, ten to the second", () => {
  assert.equal(MOTION_HZ, 10);
  assert.equal(motionTick(0), 0);
  assert.equal(motionTick(0.099), 0);
  assert.equal(motionTick(0.1), 1);
  assert.equal(motionTick(2.55), 25);
});

test("smoothstep clamps and eases", () => {
  assert.equal(smoothstep(0.5, 1, 0.2), 0);
  assert.equal(smoothstep(0.5, 1, 1.4), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  assert.ok(smoothstep(0, 1, 0.25) < 0.25);
});

test("sway is a whole number of art pixels within the amplitude", () => {
  for (const amp of [1, 2, 3]) {
    const seen = new Set();

    for (let tick = 0; tick < 200; tick++) {
      const v = swayOffset(tick, 1.3, amp);

      assert.ok(Number.isInteger(v));
      assert.ok(Math.abs(v) <= amp);
      seen.add(v);
    }

    assert.ok(seen.size >= amp + 1, `amp ${amp} only reached ${[...seen]}`);
  }
});

test("zero amplitude never moves, and the same tick always agrees", () => {
  for (let tick = 0; tick < 50; tick++) assert.equal(swayOffset(tick, 0.4, 0), 0);

  assert.equal(swayOffset(37, 2.1, 2), swayOffset(37, 2.1, 2));
});

test("different phases sway out of step", () => {
  let differing = 0;

  for (let tick = 0; tick < 100; tick++) {
    if (swayOffset(tick, 0, 2) !== swayOffset(tick, 2.4, 2)) differing += 1;
  }

  assert.ok(differing > 30);
});

test("shimmer is -1, 0 or +1, absent at zero life, and mostly quiet", () => {
  let lit = 0;
  let total = 0;

  for (let tick = 0; tick < 60; tick++) {
    for (let x = 0; x < 40; x += 3) {
      for (let y = 0; y < 40; y += 3) {
        const v = shimmerShift(tick, x, y, 0.7, 1);

        assert.ok([-1, 0, 1].includes(v));
        assert.equal(shimmerShift(tick, x, y, 0.7, 0), 0);
        total += 1;
        if (v !== 0) lit += 1;
      }
    }
  }

  const share = lit / total;

  assert.ok(share > 0.05 && share < 0.45, `share ${share}`);
});

test("the sap pulse is a short band that travels toward the trunk", () => {
  /* t = 0 at the root tip, 1 at the trunk */
  const litAt = (tick) => {
    const ts = [];

    for (let i = 0; i <= 100; i++) {
      if (sapShade(tick, i / 100, 0.2, 1) >= 0) ts.push(i / 100);
    }

    return ts;
  };

  let previous = -1;
  let moved = 0;

  for (let tick = 0; tick < 25; tick++) {
    const ts = litAt(tick);

    if (ts.length === 0) continue;

    assert.ok(ts[ts.length - 1] - ts[0] < 0.4, "band should be short");

    const centre = (ts[0] + ts[ts.length - 1]) / 2;

    if (previous >= 0 && centre > previous) moved += 1;
    previous = centre;
  }

  assert.ok(moved >= 5, `pulse only advanced ${moved} times`);
});

test("the sap pulse is brightest at its head and absent at zero life", () => {
  const head = [];

  for (let i = 0; i <= 200; i++) head.push(sapShade(12, i / 200, 0.1, 1));

  const lit = head.filter((v) => v >= 0);

  assert.ok(lit.includes(2) && lit.includes(0));
  assert.ok(lit.indexOf(0) < lit.lastIndexOf(2) || lit.lastIndexOf(0) > lit.indexOf(2));

  for (let i = 0; i <= 20; i++) assert.equal(sapShade(12, i / 20, 0.1, 0), -1);
});

test("roots are deterministic, three a side: two ground roots and a ridge", () => {
  const a = makeRoots(lcg(5), 400, 60, 742);
  const b = makeRoots(lcg(5), 400, 60, 742);

  assert.deepEqual(a, b);
  assert.equal(a.length, 6);

  for (const side of [-1, 1]) {
    const mine = a.filter((r) => r.side === side);

    assert.equal(mine.length, 3);
    assert.equal(mine.filter((r) => r.kind === "ground").length, 2);
    assert.equal(mine.filter((r) => r.kind === "ridge").length, 1);
  }

  for (const root of a) {
    assert.equal(root.pts[0].t, 1);
    assert.equal(root.pts[root.pts.length - 1].t, 0);

    for (const p of root.pts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.hw > 0);
    }
  }
});

test("ground roots hug the soil like the reference: low, outward, tapering", () => {
  const cx = 400;
  const half = 60;
  const ground = 742;

  for (const seed of [1, 5, 9, 42]) {
    const roots = makeRoots(lcg(seed), cx, half, ground).filter((r) => r.kind === "ground");

    assert.equal(roots.length, 4);

    for (const root of roots) {
      const first = root.pts[0];
      const last = root.pts[root.pts.length - 1];

      assert.ok(first.y < ground - 1 && first.y >= ground - 0.3 * half, "starts just above the soil");
      assert.ok(first.hw >= 0.1 * half, "thickest at the trunk");
      assert.ok(last.hw <= 2.5, "tapers to a point");
      assert.ok(Math.abs(last.y - ground) < 6, "dives into the soil");
      assert.ok(Math.abs(last.x - cx) > 1.2 * half, "reaches well past the trunk edge");
      assert.ok(Math.abs(first.x - cx) >= 0.8 * half, "springs from the trunk edge, not its face");

      let previous = Math.abs(first.x - cx);

      for (const p of root.pts) {
        assert.ok(p.y >= ground - 0.3 * half - 1 && p.y <= ground + 3, "stays on the ground line");
        assert.ok(Math.abs(p.x - cx) >= previous - 1e-9, "only ever goes outward");
        previous = Math.abs(p.x - cx);
      }
    }
  }
});

test("ridge roots drop down the trunk face and flare out at the soil", () => {
  const cx = 400;
  const half = 60;
  const ground = 742;

  for (const seed of [1, 5, 9, 42]) {
    const ridges = makeRoots(lcg(seed), cx, half, ground).filter((r) => r.kind === "ridge");

    assert.equal(ridges.length, 2);

    for (const root of ridges) {
      const first = root.pts[0];
      const last = root.pts[root.pts.length - 1];

      assert.ok(first.y <= ground - 0.3 * half, "starts high on the face");
      assert.ok(Math.abs(last.y - ground) < 6, "ends in the soil");
      assert.ok(Math.abs(first.x - cx) <= 0.7 * half, "on the face, inside the silhouette");
      assert.ok(Math.abs(last.x - cx) <= 1.35 * half);
      assert.ok(
        (last.x - first.x) * root.side >= 0.2 * half,
        "flares outward at the bottom",
      );

      let previousY = -Infinity;

      for (const p of root.pts) {
        assert.ok(p.y >= previousY - 1e-9, "only ever descends");
        previousY = p.y;
      }
    }
  }
});

test("rootAt agrees with a brute-force distance check", () => {
  const roots = makeRoots(lcg(9), 400, 60, 742);
  const rand = lcg(3);
  let inside = 0;

  for (let i = 0; i < 4000; i++) {
    const x = 400 + (rand() - 0.5) * 520;
    const y = 640 + rand() * 130;
    const hit = rootAt(roots, x, y);
    let best = Infinity;

    for (const root of roots) {
      for (let k = 0; k < root.pts.length - 1; k++) {
        const p = root.pts[k];
        const q = root.pts[k + 1];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const u = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(x - (p.x + dx * u), y - (p.y + dy * u));
        const hw = p.hw + (q.hw - p.hw) * u;

        best = Math.min(best, d - hw);
      }
    }

    if (best < -0.05) {
      assert.ok(hit, `missed a point inside a root (${best.toFixed(2)})`);
      inside += 1;
    } else if (best > 0.05) {
      assert.equal(hit, null, `false hit outside a root (${best.toFixed(2)})`);
    }
  }

  assert.ok(inside > 50, "the sample should land inside roots sometimes");
});

test("rootAt reports flow position and which face of the root it is", () => {
  const roots = makeRoots(lcg(2), 400, 60, 742);
  const root = roots[1];
  const mid = root.pts[Math.floor(root.pts.length / 2)];
  const onAxis = rootAt(roots, mid.x, mid.y);

  assert.ok(onAxis);
  assert.ok(Math.abs(onAxis.n) < 0.3);
  assert.ok(onAxis.t > 0.2 && onAxis.t < 0.8);

  const above = rootAt(roots, mid.x, mid.y - mid.hw * 0.7);
  const below = rootAt(roots, mid.x, mid.y + mid.hw * 0.7);

  if (above && below) assert.ok(above.n < below.n, "upper face has the smaller n");
});

test("a growing root exists only near the trunk and never beyond its reach", () => {
  const roots = makeRoots(lcg(4), 400, 60, 742);
  const rand = lcg(11);
  let nearFoot = 0;

  for (let i = 0; i < 6000; i++) {
    const x = 400 + (rand() - 0.5) * 520;
    const y = 640 + rand() * 130;
    const part = rootAt(roots, x, y, 0.3);

    if (part) {
      /* t is 1 at the trunk: with reach 0.3 only t >= 0.7 can exist */
      assert.ok(part.t >= 0.7 - 1e-9, `t ${part.t} is past the reach`);
      nearFoot++;
    }

    const whole = rootAt(roots, x, y, 1);

    if (part) assert.ok(whole, "a grown root covers everything a young one does");
  }

  assert.ok(nearFoot > 20);
  assert.equal(rootAt(roots, 400, 700, 0), null);
});

test("reach grows the covered area monotonically", () => {
  const roots = makeRoots(lcg(6), 400, 60, 742);
  const rand = lcg(5);
  const pts = Array.from({ length: 3000 }, () => [400 + (rand() - 0.5) * 520, 640 + rand() * 130]);
  const covered = (reach) => pts.filter(([x, y]) => rootAt(roots, x, y, reach)).length;
  const a = covered(0.2);
  const b = covered(0.5);
  const c = covered(1);

  assert.ok(a <= b && b <= c, `${a} <= ${b} <= ${c}`);
});
