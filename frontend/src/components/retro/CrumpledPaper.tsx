import { useEffect, useRef } from "react";

/* ============================================================
   CRUMPLED PAPER — a pixelated crumpled ball for the pet's
   "crumple" paper-destruction mode. The flat paper chip is
   replaced by this: a jittered white ball with crease folds
   and gray shading, ink-outlined like the pet. The CSS
   drop-crumple keyframes animate the element itself.
   ============================================================ */

const GRID = 32;
const PAD = 4;
const CV = GRID + PAD;

/** Deterministic jitter so the ball's silhouette stays stable. */
function jitter(i: number): number {
  return (
    Math.sin(i * 2.7) * 1.6 +
    Math.cos(i * 1.3) * 1.0 +
    Math.sin(i * 0.7 + 1.5) * 0.8
  );
}

function drawCrumple(ctx: CanvasRenderingContext2D) {
  const cx = 16;
  const cy = 15;
  const base = 13;

  /* Jagged ball silhouette (white + ink ring). */
  const pts: [number, number][] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = base + jitter(i);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = "#fdfdf7";
  ctx.fill();
  ctx.strokeStyle = "#171923";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  /* Light-gray shading patches near the edges. */
  ctx.fillStyle = "#d7d9d4";
  ctx.beginPath();
  ctx.ellipse(9, 9, 4, 3, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(23, 20, 4, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(13, 23, 3, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  /* Crease folds: dark zigzag lines across the ball. */
  ctx.strokeStyle = "#8b9197";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  const folds: [number, number][][] = [
    [
      [6, 8],
      [11, 12],
      [16, 9],
      [21, 13],
      [25, 11],
    ],
    [
      [8, 21],
      [13, 17],
      [18, 21],
      [24, 18],
      [27, 20],
    ],
    [
      [10, 5],
      [13, 10],
      [12, 16],
      [17, 20],
      [16, 25],
    ],
  ];
  for (const fold of folds) {
    ctx.beginPath();
    ctx.moveTo(fold[0][0], fold[0][1]);
    for (const [x, y] of fold.slice(1)) ctx.lineTo(x, y);
    ctx.stroke();
  }

  /* Threshold: strip anti-aliasing, leaving only hard pixels. */
  const img = ctx.getImageData(0, 0, CV, CV);
  const data = img.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] > 128 ? 255 : 0;
  }

  /* Close the ink ring: any transparent pixel touching the ball
     becomes outline, guaranteeing a sealed silhouette. */
  const solid = new Uint8Array(CV * CV);
  for (let y = 0; y < CV; y++) {
    for (let x = 0; x < CV; x++) {
      solid[y * CV + x] = data[(y * CV + x) * 4 + 3] > 0 ? 1 : 0;
    }
  }
  for (let y = 0; y < CV; y++) {
    for (let x = 0; x < CV; x++) {
      if (solid[y * CV + x]) continue;
      let adjacent = false;
      for (let dy = -1; dy <= 1 && !adjacent; dy++) {
        for (let dx = -1; dx <= 1 && !adjacent; dx++) {
          if ((dx || dy) && solid[(y + dy) * CV + (x + dx)]) adjacent = true;
        }
      }
      if (adjacent) {
        const o = (y * CV + x) * 4;
        data[o] = 0x17;
        data[o + 1] = 0x19;
        data[o + 2] = 0x23;
        data[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** A PNG data URL of the crumpled ball at the requested pixel size —
 *  used for drag ghosts and any other spot that needs the graphic. */
export function crumpledBallDataURL(size = 96): string {
  const src = document.createElement("canvas");
  src.width = CV;
  src.height = CV;
  const sctx = src.getContext("2d");
  if (sctx) {
    sctx.translate(PAD / 2, PAD / 2);
    drawCrumple(sctx);
  }
  const dst = document.createElement("canvas");
  dst.width = size;
  dst.height = size;
  const dctx = dst.getContext("2d");
  if (dctx) {
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(src, 0, 0, size, size);
  }
  return dst.toDataURL("image/png");
}

export default function CrumpledPaper({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = CV;
    canvas.height = CV;
    ctx.clearRect(0, 0, CV, CV);
    ctx.translate(PAD / 2, PAD / 2);
    drawCrumple(ctx);
  }, []);

  return (
    <canvas
      ref={ref}
      width={CV}
      height={CV}
      className={className}
      style={{ width: 64, height: 64, imageRendering: "pixelated" }}
    />
  );
}