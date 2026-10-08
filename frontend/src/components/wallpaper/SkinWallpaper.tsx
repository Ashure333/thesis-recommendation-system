/**
 * The live wallpaper of a look: each look (skin) has its own scene, drawn on
 * a small canvas and scaled up by a whole number so the pixels stay crisp.
 * It runs at a gentle frame rate, stops while the tab is hidden and shows a
 * single frame for people who prefer reduced motion.
 */

import { useEffect, useRef } from "react";

import type { SkinId } from "../../utils/uiCustom";
import type { SceneFactory } from "./pixel";
import { blueprintScene } from "./scenes/blueprint";
import { gameboyScene } from "./scenes/gameboy";
import { parchmentScene } from "./scenes/parchment";
import { synthwaveScene } from "./scenes/synthwave";
import { terminalScene } from "./scenes/terminal";
import { woodScene } from "./scenes/wood";

export const WALLPAPERS: Record<SkinId, SceneFactory> = {
  gameboy: gameboyScene,
  wood: woodScene,
  terminal: terminalScene,
  blueprint: blueprintScene,
  synthwave: synthwaveScene,
  parchment: parchmentScene,
};

/** Frames per second: lively, and nearly still when asked. */
const FPS = 12;
const STILL_FPS = 0.2;

/** About 240 pixels across, however wide the window is. */
function pixelSize(width: number): number {
  return Math.min(8, Math.max(3, Math.round(width / 240)));
}

export default function SkinWallpaper({ skin, still }: { skin: SkinId; still: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let timer = 0;
    let started = performance.now();

    const build = () => {
      const size = pixelSize(window.innerWidth);
      const w = Math.ceil(window.innerWidth / size);
      const h = Math.ceil(window.innerHeight / size);

      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;

      return WALLPAPERS[skin](w, h);
    };

    let scene = build();

    const tick = () => {
      const t = (performance.now() - started) / 1000;

      if (!document.hidden) scene(ctx, reduced ? 4 : t);
      if (!reduced) timer = window.setTimeout(tick, 1000 / (still ? STILL_FPS : FPS));
    };

    tick();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        window.clearTimeout(timer);
        started = performance.now();
        scene = build();
        tick();
      }, 200);
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [skin, still]);

  return (
    <canvas
      ref={canvasRef}
      data-wallpaper={skin}
      className="absolute inset-0 h-full w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
