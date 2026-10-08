/**
 * Colours for the similar-papers clusters.
 *
 * The clusters need to be told apart at a glance, yet still belong to the
 * site's palette. So the first cluster takes the theme's own accent, and
 * the others turn round the colour wheel from it at equal steps, keeping
 * the accent's saturation (never too pale to see). Each colour's lightness
 * is then moved until it stands out from the page background: dark enough
 * on a light canvas, light enough on a dark one.
 *
 * Pure and dependency-free so it runs under `node --test`.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const lin = (v: number) => {
  const c = v / 255;

  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return [0, 0, l];

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;

  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t0: number) => {
    let t = t0;

    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;

    return p;
  };

  return {
    r: Math.round(ch(hue + 1 / 3) * 255),
    g: Math.round(ch(hue) * 255),
    b: Math.round(ch(hue - 1 / 3) * 255),
  };
}

export const MIN_CLUSTER_CONTRAST = 3.2;

/** `n` clearly different colours that belong to the theme and read on `canvas`. */
export function clusterColors(n: number, accent: Rgb, canvas: Rgb): Rgb[] {
  const [h0, s0] = rgbToHsl(accent);
  const sat = Math.min(0.85, Math.max(0.5, s0));
  const darkCanvas = luminance(canvas) < 0.3;
  const out: Rgb[] = [];

  for (let k = 0; k < n; k++) {
    const hue = h0 + (k * 360) / Math.max(1, n);
    /* nudge the lightness until it stands out from the background */
    let l = darkCanvas ? 0.62 : 0.42;
    let color = hslToRgb(hue, sat, l);

    for (let i = 0; i < 24 && contrast(color, canvas) < MIN_CLUSTER_CONTRAST; i++) {
      l += darkCanvas ? 0.02 : -0.02;
      color = hslToRgb(hue, sat, Math.min(0.92, Math.max(0.08, l)));
    }

    out.push(color);
  }

  return out;
}

export const cssColor = ({ r, g, b }: Rgb) => `rgb(${r} ${g} ${b})`;
