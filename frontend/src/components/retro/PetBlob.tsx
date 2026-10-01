import { useEffect, useRef } from "react";
import type { PetVariant } from "../../data/petForms";

/* ============================================================
   PET BLOB — renders every pet form from its real Petdex sprite
   sheet: an 8×9 atlas of 192×208 frames. Idle animation plays
   the first 6 frames of row 0, looping like the Petdex web
   client. Frames are drawn at native resolution with
   image-rendering: pixelated.
   ============================================================ */

interface PetBlobProps {
  variant: PetVariant;
  size: number;
  hungry?: boolean;
  className?: string;
}

const FRAME_W = 192; // native Petdex frame width
const FRAME_H = 208; // native Petdex frame height
const SPRITE_FRAMES = 6;
const SPRITE_LOOP_MS = 1100;
const INK = "#171923";

/** Grow a uniform ink ring around the silhouette: *passes* dilation
 *  passes over the alpha channel. */
function pixelOutline(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  passes: number,
) {
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3];

  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      solid[y * w + x] = at(x, y) > 0 ? 1 : 0;
    }
  }

  const ring: Uint8Array[] = [];
  let prev = solid;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (prev[y * w + x]) continue;
        let near = 0;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1 && !near; dx++) {
            if (dx || dy) near = prev[(y + dy) * w + (x + dx)];
          }
        }
        next[y * w + x] = near;
      }
    }
    ring.push(next);
    prev = next;
  }

  for (const layer of ring) {
    for (let i = 0; i < layer.length; i++) {
      if (layer[i]) {
        const o = i * 4;
        data[o] = 0x17;
        data[o + 1] = 0x19;
        data[o + 2] = 0x23;
        data[o + 3] = 255;
      }
    }
  }
}

const SPRITE_SHEETS: Record<PetVariant, string> = {
  rimuru: "/pets/rimuru.webp",
  veldora: "/pets/veldora.webp",
  benimaru: "/pets/benimaru.webp",
  shion: "/pets/shion.webp",
  ranga: "/pets/ranga.webp",
  shuna: "/pets/shuna.webp",
  gobta: "/pets/gobta.webp",
  ciel: "/pets/ciel.webp",
  diablo: "/pets/diablo.webp",
  milim: "/pets/milim.webp",
  original: "", // handled by the procedural blob
};

/** The original pet: a theme-accent slime blob with ink-outlined eyes.
 *  Reads the live --accent token, so the blob follows the active theme. */
function drawOriginalBlob(canvas: HTMLCanvasElement, hungry: boolean, blink = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = FRAME_W;
  canvas.height = FRAME_H;
  ctx.clearRect(0, 0, FRAME_W, FRAME_H);

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  const bodyColor = accent ? `rgb(${accent})` : "#f39c12";

  /* blob body */
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(96, 106, 58, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
  /* eyes — hungry opens wide, blink closes them */
  if (blink) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    for (const x of [68, 124]) {
      ctx.beginPath();
      ctx.moveTo(x - 14, 94);
      ctx.quadraticCurveTo(x, 88, x + 14, 94);
      ctx.stroke();
    }
  } else {
    const eyeY = hungry ? 108 : 88;
    const eyeH = hungry ? 22 : 26;
    for (const x of [68, 124]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x, eyeY, 16, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }

  /* threshold + ink ring, matching the sprite forms */
  const img = ctx.getImageData(0, 0, FRAME_W, FRAME_H);
  const data = img.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] > 128 ? 255 : 0;
  }
  pixelOutline(data, FRAME_W, FRAME_H, 2);
  ctx.putImageData(img, 0, 0);
}

export default function PetBlob({
  variant,
  size,
  hungry = false,
  className = "",
}: PetBlobProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (variant === "original") {
      const canvas = ref.current;
      if (!canvas) return;
      drawOriginalBlob(canvas, hungry);

      /* idle blink loop + live theme reactivity: redraw whenever the
         --accent token changes or the blink timer fires. */
      let blinkTimer: number | null = null;
      const draw = () => drawOriginalBlob(canvas, hungry, false);
      const root = document.documentElement;
      let lastAccent = getComputedStyle(root).getPropertyValue("--accent").trim();
      const observer = new MutationObserver(() => {
        const next = getComputedStyle(root).getPropertyValue("--accent").trim();
        if (next !== lastAccent) {
          lastAccent = next;
          draw();
        }
      });
      observer.observe(root, { attributes: true, attributeFilter: ["style"] });

      const blink = () => {
        drawOriginalBlob(canvas, hungry, true);
        blinkTimer = window.setTimeout(() => draw(), 150);
      };
      const blinkLoop = window.setInterval(blink, 3400);

      return () => {
        observer.disconnect();
        window.clearInterval(blinkLoop);
        if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      };
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
    };
    img.src = SPRITE_SHEETS[variant];
    return () => {
      imgRef.current = null;
    };
  }, [variant, hungry]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (variant === "original") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const loop = (time: number) => {
      const img = imgRef.current;
      if (img) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, FRAME_W, FRAME_H);
        const frame = Math.floor(time / (SPRITE_LOOP_MS / SPRITE_FRAMES)) % SPRITE_FRAMES;
        ctx.drawImage(img, frame * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  void hungry;

  return (
    <canvas
      ref={ref}
      width={FRAME_W}
      height={FRAME_H}
      className={className}
      style={{
        width: size * (FRAME_W / FRAME_H),
        height: size,
        imageRendering: "pixelated",
      }}
    />
  );
}