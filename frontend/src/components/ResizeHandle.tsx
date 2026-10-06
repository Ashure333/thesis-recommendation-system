import { useCallback, useRef, useState } from "react";

/* ============================================================
   RESIZABLE PANES
   Shared plumbing for the three-pane pages (Search and
   Repository): a persisted pane width hook and the drag handle
   rendered between panes. Widths are stored per browser so a
   user's layout survives reloads, and every read/update is
   clamped to the pane's minimum and maximum.
   ============================================================ */

export function readPaneWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      const raw = Number(stored);
      if (Number.isFinite(raw)) {
        return Math.max(min, Math.min(max, raw));
      }
    }
  } catch {
    // localStorage unavailable (private mode) — use the fallback.
  }
  return fallback;
}

/**
 * Persisted, clamped pane width.
 *
 * Returns [width, resize], where resize(delta) adds `delta`
 * pixels to the current width and stores the clamped result.
 */
export function usePaneWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
): [number, (delta: number) => void] {
  const [width, setWidth] = useState(() =>
    readPaneWidth(key, fallback, min, max),
  );

  const resize = useCallback(
    (delta: number) => {
      setWidth((current) => {
        const next = Math.max(min, Math.min(max, current + delta));

        try {
          window.localStorage.setItem(key, String(next));
        } catch {
          // Persistence is best-effort only.
        }

        return next;
      });
    },
    [key, min, max],
  );

  return [width, resize];
}

export default function PaneHandle({
  label,
  onResize,
  direction = "left",
}: {
  label: string;
  onResize: (delta: number) => void;
  /**
   * Which side of the pane the handle sits on. A right-side handle
   * moves the pane's edge the other way, so dragging left must
   * GROW the pane — without this the resize feels inverted.
   */
  direction?: "left" | "right";
}) {
  const startXRef = useRef<number | null>(null);
  const lastDeltaRef = useRef(0);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    startXRef.current = event.clientX;
    lastDeltaRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    const delta = event.clientX - startXRef.current;
    const signed = direction === "right" ? -delta : delta;
    onResize(signed - lastDeltaRef.current);
    lastDeltaRef.current = signed;
  }

  function handlePointerUp() {
    startXRef.current = null;
    lastDeltaRef.current = 0;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="group hidden w-2 shrink-0 cursor-col-resize touch-none items-center justify-center lg:flex"
    >
      <span className="h-10 w-1 rounded-full bg-gray-300 transition-colors pixel-ease group-hover:bg-accent group-active:bg-accent" />
    </div>
  );
}
