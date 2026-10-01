import { useEffect, useState } from "react";

/* ============================================================
   RETRO SCORE COUNTER
   Counts up to `target` like an arcade score ticker.
   ============================================================ */

export function useCountUp(
  target: number,
  duration = 700,
): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (
      typeof target !== "number" ||
      !Number.isFinite(target) ||
      target <= 0
    ) {
      setValue(target);
      return;
    }

    let raf = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(
        (now - startTime) / duration,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}