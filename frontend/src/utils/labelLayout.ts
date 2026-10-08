/**
 * Where to put the cluster names so that none overlap.
 *
 * Each name sits in a column at the left or right edge, on the side nearer
 * its cluster, as close as it can to the cluster's own height. Names in a
 * column are pushed apart to keep a gap, and kept inside the frame; a
 * leader line then joins each name to its cluster.
 *
 * Pure and dependency-free so it runs under `node --test`.
 */

export interface LabelIn {
  id: number;
  /** Where the cluster is. */
  ax: number;
  ay: number;
  /** The name's width. */
  w: number;
}

export interface LabelOut {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  side: "left" | "right";
}

export interface LabelFrame {
  width: number;
  height: number;
  /** A name's height. */
  h?: number;
  /** The least space between two names in a column. */
  gap?: number;
  /** Space kept between a name and the frame. */
  pad?: number;
  /** Put every name in one column (when the other edge is covered). */
  only?: "left" | "right";
}

/** Push boxes (sorted by y) apart, then back inside [lo, hi]. */
function relax(ys: number[], h: number, gap: number, lo: number, hi: number): number[] {
  const out = ys.slice();
  const step = h + gap;

  for (let i = 0; i < out.length; i++) {
    out[i] = Math.max(out[i], lo + i * step);
    if (i > 0) out[i] = Math.max(out[i], out[i - 1] + step);
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const cap = hi - h - (out.length - 1 - i) * step;

    out[i] = Math.min(out[i], cap);
    if (i < out.length - 1) out[i] = Math.min(out[i], out[i + 1] - step);
  }

  return out;
}

export function layoutLabels(items: LabelIn[], frame: LabelFrame): LabelOut[] {
  const h = frame.h ?? 18;
  const gap = frame.gap ?? 6;
  const pad = frame.pad ?? 8;
  const column = (frame.height - 2 * pad + gap) / (h + gap);
  const maxPerSide = Math.max(1, Math.floor(column));

  const left: LabelIn[] = [];
  const right: LabelIn[] = [];

  for (const item of items) {
    const toLeft = frame.only ? frame.only === "left" : item.ax < frame.width / 2;

    (toLeft ? left : right).push(item);
  }

  /* if one side is crowded past what fits, move its outermost to the other */
  const balance = (from: LabelIn[], to: LabelIn[], toward: number) => {
    while (from.length > maxPerSide && to.length < maxPerSide) {
      from.sort((a, b) => Math.abs(a.ax - toward) - Math.abs(b.ax - toward));
      to.push(from.shift()!);
    }
  };

  if (!frame.only) {
    balance(left, right, frame.width);
    balance(right, left, 0);
  }

  const place = (list: LabelIn[], side: "left" | "right"): LabelOut[] => {
    const sorted = list.slice().sort((a, b) => a.ay - b.ay);
    const ys = relax(
      sorted.map((item) => item.ay - h / 2),
      h,
      gap,
      pad,
      frame.height - pad,
    );

    return sorted.map((item, i) => ({
      id: item.id,
      w: item.w,
      h,
      y: ys[i],
      x: side === "left" ? pad : frame.width - pad - item.w,
      side,
    }));
  };

  return [...place(left, "left"), ...place(right, "right")];
}
