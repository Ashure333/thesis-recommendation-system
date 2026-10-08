/**
 * Unit tests for the cluster colors and the label layout.
 *
 *   npm run test:units
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MIN_CLUSTER_CONTRAST, clusterColors, contrast, rgbToHsl } from "../src/utils/clusterColors.ts";
import { layoutLabels } from "../src/utils/labelLayout.ts";

const LIGHT = { r: 255, g: 250, b: 240 };
const DARK = { r: 28, g: 24, b: 20 };
const ACCENTS = [
  { r: 243, g: 156, b: 18 },
  { r: 52, g: 152, b: 219 },
  { r: 155, g: 89, b: 182 },
  { r: 120, g: 120, b: 120 },
];

test("every cluster color stands out from the page, light or dark", () => {
  for (const accent of ACCENTS) {
    for (const canvas of [LIGHT, DARK]) {
      for (const n of [1, 2, 3, 5, 8]) {
        for (const c of clusterColors(n, accent, canvas)) {
          assert.ok(contrast(c, canvas) >= MIN_CLUSTER_CONTRAST - 0.05, `${JSON.stringify(c)} on ${canvas.r}`);
        }
      }
    }
  }
});

test("clusters are told apart: their hues are spread round the wheel", () => {
  for (const accent of ACCENTS.slice(0, 3)) {
    for (const n of [2, 3, 5]) {
      const hues = clusterColors(n, accent, LIGHT).map((c) => rgbToHsl(c)[0]);

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = Math.abs(hues[i] - hues[j]);
          const apart = Math.min(d, 360 - d);

          assert.ok(apart >= 360 / n - 12, `n=${n}: hues ${hues[i].toFixed(0)} and ${hues[j].toFixed(0)}`);
        }
      }
    }
  }
});

test("the first cluster keeps the theme's accent hue", () => {
  const accent = { r: 52, g: 152, b: 219 };
  const [first] = clusterColors(4, accent, LIGHT);
  const d = Math.abs(rgbToHsl(first)[0] - rgbToHsl(accent)[0]);

  assert.ok(Math.min(d, 360 - d) < 8);
});

test("even a gray theme gets colored, separable clusters", () => {
  const colors = clusterColors(4, ACCENTS[3], LIGHT);

  assert.ok(colors.every((c) => rgbToHsl(c)[1] > 0.3));
});

const overlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("labels never overlap, even when the clusters are on top of each other", () => {
  const frame = { width: 560, height: 440 };

  for (const n of [1, 2, 3, 5, 8]) {
    const items = Array.from({ length: n }, (_, i) => ({
      id: i,
      ax: 250 + (i % 3) * 20,
      ay: 200 + i * 4,
      w: 90 + i * 12,
    }));
    const out = layoutLabels(items, frame);

    assert.equal(out.length, n);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        assert.ok(!overlap(out[i], out[j]), `n=${n}: ${i} and ${j} overlap`);
      }
    }
  }
});

test("labels stay inside the frame", () => {
  const frame = { width: 560, height: 440 };
  const items = [
    { id: 0, ax: 10, ay: 4, w: 100 },
    { id: 1, ax: 550, ay: 436, w: 120 },
    { id: 2, ax: 300, ay: 430, w: 80 },
    { id: 3, ax: 280, ay: 6, w: 80 },
  ];

  for (const l of layoutLabels(items, frame)) {
    assert.ok(l.x >= 0 && l.x + l.w <= frame.width, `x of ${l.id}`);
    assert.ok(l.y >= 0 && l.y + l.h <= frame.height, `y of ${l.id}`);
  }
});

test("a label sits on the side of its cluster and near its height", () => {
  const out = layoutLabels(
    [
      { id: 0, ax: 100, ay: 120, w: 90 },
      { id: 1, ax: 480, ay: 300, w: 90 },
    ],
    { width: 560, height: 440 },
  );
  const a = out.find((l) => l.id === 0);
  const b = out.find((l) => l.id === 1);

  assert.equal(a.side, "left");
  assert.equal(b.side, "right");
  assert.ok(Math.abs(a.y + a.h / 2 - 120) < 2);
  assert.ok(Math.abs(b.y + b.h / 2 - 300) < 2);
});

test("a crowded side spills over to the other so everything fits", () => {
  const items = Array.from({ length: 26 }, (_, i) => ({ id: i, ax: 100, ay: 220, w: 80 }));
  const out = layoutLabels(items, { width: 560, height: 440 });

  assert.ok(out.some((l) => l.side === "right"));
});
