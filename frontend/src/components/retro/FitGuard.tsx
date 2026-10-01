import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Warning } from "./PixelIcons";

/* ============================================================
   FIT GUARD
   Watches the app's content region and, when the layout can no
   longer fit (viewport below the absolute floor, or actual
   horizontal overflow in the page area), shows a retro pop-up
   telling the user a wider device is needed.

   Overflows nested inside scrollable containers (e.g. the
   battle-grid table) are fine — those scroll. Only overflow of
   the page area itself, where elements would be clipped or
   crushed, trips the guard.
   ============================================================ */

const MIN_VIEWPORT_WIDTH = 360;
const OVERFLOW_EPSILON = 6;

export default function FitGuard({
  target,
}: {
  target: RefObject<HTMLElement | null>;
}) {
  const [blocked, setBlocked] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth < MIN_VIEWPORT_WIDTH
      : false,
  );
  const [currentWidth, setCurrentWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let raf = 0;
    let observing: HTMLElement | null = null;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });

    function ensureObserved() {
      const el = target.current;

      if (el && el !== observing) {
        if (observing) {
          observer.unobserve(observing);
        }
        observer.observe(el);
        observing = el;
      }
    }

    function measure() {
      setCurrentWidth(window.innerWidth);

      ensureObserved();

      const el = target.current;

      if (!el || el.clientWidth === 0) {
        return;
      }

      const tooNarrow =
        window.innerWidth < MIN_VIEWPORT_WIDTH;

      const overflows =
        el.scrollWidth - el.clientWidth > OVERFLOW_EPSILON;

      setBlocked(tooNarrow || overflows);
    }

    measure();
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [target]);

  if (!blocked || dismissed) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-gray-950/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Screen too narrow"
    >
      <div className="animate-step-in w-full max-w-sm rounded border-[3px] border-gray-900 bg-white p-6 text-center">
        <p className="animate-blink flex items-center justify-center gap-2 font-mono text-xs font-bold tracking-[0.3em] text-accent">
          <Warning className="h-4 w-4" />
          SCREEN TOO NARROW
        </p>

        <p className="mt-3 text-lg font-bold text-ink">
          The interface no longer fits this screen.
        </p>

        <p className="mt-2 text-sm leading-5 text-muted">
          Some panels can't lay out properly at this size.
          Please use a wider device — or widen this window.
        </p>

        <p className="mt-3 font-mono text-xs text-muted">
          Current width:{" "}
          <span className="font-bold text-ink">
            {currentWidth}px
          </span>
          <span className="text-ink"> · </span>
          minimum{" "}
          <span className="font-bold text-ink">
            {MIN_VIEWPORT_WIDTH}px
          </span>
        </p>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-5 w-full rounded border-[3px] border-gray-900 bg-accent px-4 py-2.5 text-sm font-bold text-onAccent hover:brightness-110"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}