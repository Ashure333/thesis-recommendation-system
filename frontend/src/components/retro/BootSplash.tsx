import { useEffect, useState } from "react";
import { useTypewriter } from "../../hooks/useTypewriter";
import { BlockCursor } from "./PixelIcons";

/* ============================================================
   BOOT SPLASH — arcade attract mode
   INSERT COIN → typed title → PRESS START.
   Shown once per browser session, skipped for reduced motion.
   ============================================================ */

const BOOT_KEY = "paperrec_booted";

const TITLE =
  "RE:SEARCH · BULSU BSMCS THESIS RECOMMENDATION SYSTEM";

export default function BootSplash() {
  const [show, setShow] = useState<boolean>(() => {
    try {
      if (sessionStorage.getItem(BOOT_KEY) === "1") {
        return false;
      }
      if (
        window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches
      ) {
        return false;
      }
    } catch {
      // Storage can be unavailable; play the boot anyway.
    }
    return true;
  });

  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  const typed = useTypewriter(TITLE, 45, show && phase >= 1);
  const titleDone = typed.length >= TITLE.length;

  // ----------------------------------------------------------
  // SEQUENCE: flicker in -> start typing -> PRESS START
  // ----------------------------------------------------------

  useEffect(() => {
    if (!show) return;

    const timers = [
      window.setTimeout(() => setPhase(1), 450),
      window.setTimeout(
        () => setPhase(2),
        650 + TITLE.length * 45,
      ),
    ];

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [show]);

  // ----------------------------------------------------------
  // DISMISS: any key or click
  // ----------------------------------------------------------

  useEffect(() => {
    if (!show) return;

    function dismiss() {
      setShow(false);
      try {
        sessionStorage.setItem(BOOT_KEY, "1");
      } catch {
        // Best-effort; the boot plays again next time.
      }
    }

    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="animate-boot-flicker fixed inset-0 z-[10000] flex cursor-pointer select-none flex-col items-center justify-center bg-gray-950 px-6 text-center"
      onClick={() => {
        setShow(false);
        try {
          sessionStorage.setItem(BOOT_KEY, "1");
        } catch {
          // ignore
        }
      }}
      role="button"
      aria-label="Press start to continue"
    >
      {/* CRT scanlines on the boot screen itself */}
      <div className="crt-overlay" aria-hidden="true" />

      {/* Arcade HUD */}
      <div className="absolute left-6 top-6 text-left font-mono text-xs leading-relaxed text-gray-400">
        <p>1UP</p>
        <p className="text-accent">000000</p>
      </div>
      <div className="absolute right-6 top-6 text-right font-mono text-xs leading-relaxed text-gray-400">
        <p>HIGH SCORE</p>
        <p className="text-accent">000000</p>
      </div>

      {/* Attract mode */}
      <p className="animate-blink mb-8 font-mono text-sm tracking-[0.35em] text-gray-400">
        INSERT COIN
      </p>

      <h1 className="animate-glitch font-mono text-2xl font-bold tracking-[0.1em] text-onInk sm:text-4xl">
        {typed}
        <BlockCursor className="animate-blink ml-1 inline-block h-[0.95em] w-[0.6em]" />
      </h1>

      {titleDone && phase >= 2 && (
        <p className="animate-blink mt-10 font-mono text-lg font-bold tracking-[0.3em] text-accent">
          PRESS START
        </p>
      )}

      <p className="mt-12 font-mono text-xs tracking-[0.2em] text-gray-500">
        CLICK ANYWHERE OR PRESS ANY KEY
      </p>
      <p className="mt-6 font-mono text-xs tracking-[0.15em] text-gray-600">
        © 2026 BULSU BSMCS · DEPARTMENT OF COMPUTER SCIENCE
      </p>
    </div>
  );
}