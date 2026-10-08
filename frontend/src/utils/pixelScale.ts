/**
 * PIXEL SCALE — whole-number scaling for pixel-art stages.
 *
 * Pixel art stays crisp only when every art pixel covers the same whole
 * number of DEVICE pixels. A fluid layout (width: 100%) gives scales like
 * 4.195, and nearest-neighbour then draws some art pixels 4 device pixels
 * wide and others 5. So the garden picks the largest whole scale that fits
 * and sizes its stage to exactly that, measured in device pixels (a 2x
 * display at scale 11 is 5.5 css px per art pixel: still 11 device pixels).
 *
 * Pure and dependency-free so it runs under `node --test`.
 */

/** Guards against floating-point noise costing a whole step (9.9999999 -> 9). */
const EPSILON = 1e-6;

/**
 * The largest whole number of device pixels per art pixel that fits the
 * available css box. Pass Infinity for an axis that is not constrained
 * (a windowed stage is limited by its width alone). Never below 1.
 */
export function integerScale(
  availCssW: number,
  availCssH: number,
  dpr: number,
  logicalW: number,
  logicalH: number,
): number {
  const raw = Math.min(
    (availCssW * dpr) / logicalW,
    (availCssH * dpr) / logicalH,
  );

  if (!Number.isFinite(raw)) return 1;

  return Math.max(1, Math.floor(raw + EPSILON));
}

export interface StageFit {
  /** Device pixels per art pixel (a whole number). */
  scale: number;
  /** Css pixels per art pixel (scale / dpr; whole device pixels). */
  cssScale: number;
  cssW: number;
  cssH: number;
}

export function fitStage(
  availCssW: number,
  availCssH: number,
  dpr: number,
  logicalW: number,
  logicalH: number,
): StageFit {
  const scale = integerScale(availCssW, availCssH, dpr, logicalW, logicalH);
  const cssScale = scale / dpr;

  return {
    scale,
    cssScale,
    cssW: logicalW * cssScale,
    cssH: logicalH * cssScale,
  };
}
