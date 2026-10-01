import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ArrowUp } from "./PixelIcons";

/* ============================================================
   SCROLL FOLLOW POPUP
   Once the page is scrolled down past SHOW_AFTER, a retro
   "back to top" popup appears (with a bouncy pop-in) and keeps
   following the user, fixed to the bottom-left corner. It
   disappears again once scrolled back near the top.

   The scroll container is the AppLayout <main>, not the window.
   ============================================================ */

const SHOW_AFTER = 480;
const HIDE_BELOW = 240;

export default function ScrollFollowPopup({
  target,
}: {
  target: RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const listening = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let raf = 0;

    function attach() {
      const el = target.current;

      if (el && el !== listening.current) {
        if (listening.current) {
          listening.current.removeEventListener("scroll", measure);
        }
        el.addEventListener("scroll", measure, { passive: true });
        listening.current = el;
      }
    }

    function measure() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        attach();

        const el = listening.current;

        if (!el) {
          return;
        }

        const top = el.scrollTop;

        setVisible((current) => {
          if (top > SHOW_AFTER) {
            return true;
          }
          if (top < HIDE_BELOW) {
            return false;
          }
          return current;
        });
      });
    }

    attach();
    measure();

    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      if (listening.current) {
        listening.current.removeEventListener("scroll", measure);
        listening.current = null;
      }
    };
  }, [target]);

  function handleBackToTop() {
    const el = listening.current ?? target.current;

    if (!el) {
      return;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced) {
      el.scrollTo({ top: 0 });
      return;
    }

    el.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-5 z-[9980]">
      <button
        type="button"
        onClick={handleBackToTop}
        className="animate-pop-in group flex items-center gap-2 rounded border-[3px] border-gray-900 bg-gray-900 px-4 py-2.5 font-mono text-xs font-bold tracking-[0.2em] text-onInk transition-transform duration-100 pixel-ease hover:brightness-125 active:translate-y-0.5"
      >
        <ArrowUp className="h-3 w-3 text-accent transition-transform duration-100 pixel-ease group-hover:-translate-y-0.5" />
        BACK TO TOP
      </button>
    </div>
  );
}