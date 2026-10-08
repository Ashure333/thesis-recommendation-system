/**
 * usePixelStage — the garden stage's whole-number size.
 *
 * Observes a container and returns the largest whole-number pixel scale
 * that fits it (see utils/pixelScale.ts), with the stage's exact css box.
 * Re-measures when the container resizes and when the display density
 * changes (browser zoom, or a window dragged to another monitor).
 *
 * `fitHeight` is false for the windowed garden, whose stage is limited by
 * its width alone (its height follows the stage, so measuring it would
 * feed back on itself), and true in full screen, where the container is
 * the whole screen.
 */

import { useEffect, useMemo, useState, type RefObject } from "react";

import { fitStage, type StageFit } from "../utils/pixelScale";

export interface PixelStage extends StageFit {
  dpr: number;
}

export function usePixelStage(
  containerRef: RefObject<HTMLElement | null>,
  logicalW: number,
  logicalH: number,
  fitHeight: boolean,
): PixelStage | null {
  const [box, setBox] = useState<{ w: number; h: number; dpr: number } | null>(
    null,
  );

  useEffect(() => {
    const node = containerRef.current;

    if (!node || typeof ResizeObserver === "undefined") return;

    let width = 0;
    let height = 0;

    const publish = () => {
      if (width <= 0 || height <= 0) return;

      setBox((previous) => {
        const next = { w: width, h: height, dpr: window.devicePixelRatio || 1 };

        return previous &&
          previous.w === next.w &&
          previous.h === next.h &&
          previous.dpr === next.dpr
          ? previous
          : next;
      });
    };

    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1].contentRect;

      width = rect.width;
      height = rect.height;
      publish();
    });

    observer.observe(node);

    /* Browser zoom and monitor changes alter devicePixelRatio, and a
       resize event accompanies both. */
    window.addEventListener("resize", publish);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [containerRef]);

  return useMemo(
    () =>
      box
        ? {
            ...fitStage(
              box.w,
              fitHeight ? box.h : Infinity,
              box.dpr,
              logicalW,
              logicalH,
            ),
            dpr: box.dpr,
          }
        : null,
    [box, fitHeight, logicalW, logicalH],
  );
}
