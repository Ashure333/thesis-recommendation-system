/* ============================================================
   GARDEN BACKDROP — the animated 16:9 scene behind the tree.

   Driven by the "Seven Scenes" engine (backdrops.ts): Meadow by
   default, plus Winter, Desert, Shore, Violet Keep, Rose Ruins,
   and Frost Spire, each with its own palette markers.

   Switching themes is smooth: the day position and animation
   clock carry over (the scene keeps advancing), and the outgoing
   scene fades out over the incoming one. The day moves faster
   than the reference so the transition always reads clearly.
   Under prefers-reduced-motion it shows a static midday still.
   ============================================================ */

import { useEffect, useRef, useState } from "react";
import {
  BACKDROP_H,
  BACKDROP_W,
  DEFAULT_BACKDROP_THEME,
  buildScene,
  renderFrame,
  type BackdropThemeId,
} from "../../data/backdrops";
import type { TreeSpeciesId } from "../../data/knowledge";

/* The day cycle no longer loops on its own timer: the scene is
   pinned to the viewer's own time zone, so the garden shows night
   when it is night, dawn at dawn, and midday at noon — relative
   to the local clock. The animation clock (clouds, fireflies, the
   sun disc's shimmer) still runs freely on top. */
const FADE_SECONDS = 0.7;

/* The scene is CPU-rendered pixel art (about 2 ms a frame, 9 ms for the
   three castle scenes). 30 fps reads as pixel-art motion, halves that
   cost, and keeps a 120 Hz display from rendering it 120 times a second. */
const DEFAULT_MAX_FPS = 30;

function localTimeOfDay(): number {
  const d = new Date();
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
}

export default function GardenBackdrop({
  theme = DEFAULT_BACKDROP_THEME,
  parallax = 0,
  speciesId,
  maxFps = DEFAULT_MAX_FPS,
  layersOff,
}: {
  theme?: BackdropThemeId;
  /** 0..1 — the tree's growth: layer parallax, and the drifting
      cloud sea that swallows the scene as the tree rises. */
  parallax?: number;
  /** The planted tree's species — gives the haze-leaves that
      drift through the climb their own color and silhouette. */
  speciesId?: TreeSpeciesId;
  /** Animation rate cap; the scene is redrawn at most this often. */
  maxFps?: number;
  /** Scenery the player has switched off (clouds, fence, house ...). */
  layersOff?: string[];
}) {
  const offRef = useRef<ReadonlySet<string>>(new Set(layersOff ?? []));
  offRef.current = new Set(layersOff ?? []);
  const curRef = useRef<HTMLCanvasElement | null>(null);
  const fadeRef = useRef<HTMLCanvasElement | null>(null);
  /* The day clock lives across themes: switching scenes keeps the
     same time of day and the animation keeps advancing. */
  const clockRef = useRef({ t: 0.28, A: 0 });
  const prevThemeRef = useRef<BackdropThemeId | null>(null);
  const [fade, setFade] = useState<HTMLCanvasElement | null>(null);
  /* Parallax tracks the growing tree continuously; it must NOT
     restart the animation loop (the effect deps exclude it), so the
     sky keeps moving even while the tree morphs. */
  const parallaxRef = useRef(parallax);
  parallaxRef.current = parallax;

  useEffect(() => {
    if (
      prevThemeRef.current !== null &&
      prevThemeRef.current !== theme &&
      curRef.current
    ) {
      const snap = document.createElement("canvas");
      snap.width = BACKDROP_W;
      snap.height = BACKDROP_H;
      snap.getContext("2d")?.drawImage(curRef.current, 0, 0);
      setFade(snap);
    }
    prevThemeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = curRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scene = buildScene(theme);
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = clockRef.current;
    /* Start the scene at the actual local time of day. */
    clock.t = localTimeOfDay();

    /* One buffer for the life of the effect (the renderer writes every
       pixel; it is cleared anyway so a frame never inherits the last). */
    const img = ctx.createImageData(BACKDROP_W, BACKDROP_H);

    const frameMs = 1000 / Math.max(1, maxFps);
    let fadeAlpha = 1;
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);

      /* A couple of ms of slack: rAF timestamps jitter around the cap. */
      if (now - last < frameMs - 2) return;

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced) {
        /* Re-sync to the local clock every frame: the phase follows
           the viewer's time zone exactly, even after tab sleeps. */
        clock.t = localTimeOfDay();
        clock.A += dt;
      }

      img.data.fill(0);
      renderFrame(
        img.data,
        scene,
        clock.t,
        clock.A,
        parallaxRef.current,
        speciesId,
        offRef.current,
      );
      ctx.putImageData(img, 0, 0);

      /* The outgoing scene fades out on the overlay above. */
      const overlay = fadeRef.current;
      if (overlay && fade) {
        const octx = overlay.getContext("2d");
        if (octx) {
          octx.clearRect(0, 0, BACKDROP_W, BACKDROP_H);
          fadeAlpha = Math.max(0, fadeAlpha - dt / FADE_SECONDS);
          octx.globalAlpha = fadeAlpha;
          octx.drawImage(fade, 0, 0);
          octx.globalAlpha = 1;
        }
        if (fadeAlpha <= 0) {
          octx?.clearRect(0, 0, BACKDROP_W, BACKDROP_H);
          setFade(null);
          fadeAlpha = 1;
        }
      }
    };

    /* First paint, with the species too (it used to be left out, so the
       haze leaves flashed the wrong color for a frame). */
    renderFrame(
      img.data,
      scene,
      clock.t,
      clock.A,
      parallaxRef.current,
      speciesId,
      offRef.current,
    );
    ctx.putImageData(img, 0, 0);
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, [theme, fade, speciesId, maxFps]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <canvas
        ref={curRef}
        width={BACKDROP_W}
        height={BACKDROP_H}
        role="img"
        aria-label="Pixel art 16:9 landscape backdrop with a sun and moon crossing the sky"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {fade && (
        <canvas
          ref={fadeRef}
          width={BACKDROP_W}
          height={BACKDROP_H}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
      )}
    </div>
  );
}