/**
 * USE LONG PRESS FEED — touch long-press that behaves like a right
 * click, for lists rendered with .map().
 *
 * One hook per component (NOT per row): rows feed pointer events
 * through `start(runId, x, y)` / `move(x, y)` / `cancel()`. A 500 ms
 * hold without a 10 px move fires `run(runId, x, y)`.
 */

import { useRef } from "react";

export function useLongPressFeed(
  run: (runId: number, x: number, y: number) => void,
  ms = 500
) {
  const timer = useRef<{
    timer: number;
    runId: number;
    x: number;
    y: number;
  } | null>(null);

  function start(runId: number, x: number, y: number) {
    cancel();

    timer.current = {
      timer: window.setTimeout(() => {
        const entry = timer.current;
        timer.current = null;

        if (entry) {
          run(entry.runId, entry.x, entry.y);
        }
      }, ms),
      runId,
      x,
      y,
    };
  }

  function move(x: number, y: number) {
    const entry = timer.current;

    if (
      entry &&
      (Math.abs(x - entry.x) > 10 || Math.abs(y - entry.y) > 10)
    ) {
      cancel();
    }
  }

  function cancel() {
    if (timer.current) {
      window.clearTimeout(timer.current.timer);
      timer.current = null;
    }
  }

  return { start, move, cancel };
}