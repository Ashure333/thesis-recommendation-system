import { useEffect, useRef, useState } from "react";
import { useTypewriter } from "../../hooks/useTypewriter";
import { BlockCursor } from "./PixelIcons";

/* ============================================================
   BOOT SPLASH — arcade attract mode
   INSERT COIN → typed title → PRESS START.
   Shown once per browser session, skipped for reduced motion.

   Calm by design — nothing on this screen strobes or jitters:
   - fixed arcade-black screen that matches index.html's pre-paint
     color exactly, in every theme (the themed grays invert in
     dark mode, which used to flash black → cream on first run);
   - text waits for the pixel font, so it never swaps mid-boot;
   - the title's full line breaks are reserved up front, so typing
     never re-centers or re-wraps it, and PRESS START has its space
     before it appears (zero layout shift);
   - one CRT power-on, one glitch pulse when the title lands, then a
     soft fade-out on dismiss.
   ============================================================ */

const BOOT_KEY = "paperrec_booted";

const TITLE =
  "RE:SEARCH · BULSU BSMCS THESIS RECOMMENDATION SYSTEM";

const FONT_WAIT_MS = 1500;
const START_DELAY_MS = 450;
const FADE_OUT_MS = 260;

function waitForPixelFont(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;

  if (!fonts || typeof fonts.load !== "function") {
    return Promise.resolve();
  }

  return Promise.all([
    fonts.load('400 1em "Pixelify Sans"'),
    fonts.load('700 1em "Pixelify Sans"'),
  ]).then(
    () => undefined,
    () => undefined,
  );
}

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

  const [fontReady, setFontReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  const typed = useTypewriter(TITLE, 45, show && started);
  const titleDone = typed.length >= TITLE.length;

  // ----------------------------------------------------------
  // SEQUENCE: wait for the font -> power on -> type -> PRESS START
  // ----------------------------------------------------------

  useEffect(() => {
    if (!show) return;

    let cancelled = false;
    const finish = () => {
      if (!cancelled) setFontReady(true);
    };

    const giveUp = window.setTimeout(finish, FONT_WAIT_MS);
    waitForPixelFont().then(finish);

    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
    };
  }, [show]);

  useEffect(() => {
    if (!show || !fontReady) return;

    const id = window.setTimeout(() => setStarted(true), START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [show, fontReady]);

  // ----------------------------------------------------------
  // DISMISS: any key or click -> short fade -> unmount
  // ----------------------------------------------------------

  function finishDismiss() {
    setShow(false);
    // The inline pre-paint background was only there to avoid a white
    // flash before React mounted; hand the canvas back to the theme.
    document.documentElement.style.removeProperty("background");
  }

  function dismiss() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);

    try {
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      // Best-effort; the boot plays again next time.
    }

    // Safety net in case the animationend event never fires.
    window.setTimeout(finishDismiss, FADE_OUT_MS + 150);
  }

  useEffect(() => {
    if (!show) return;

    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
    // dismiss only touches refs and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`boot-screen fixed inset-0 z-[10000] cursor-pointer select-none overflow-hidden ${
        leaving ? "animate-boot-out" : ""
      }`}
      onClick={dismiss}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) {
          finishDismiss();
        }
      }}
      role="button"
      aria-label="Press start to continue"
    >
      {/* CRT scanlines + vignette: static, so the screen never flickers */}
      <div className="boot-scanlines" aria-hidden="true" />

      <div
        className={`boot-content absolute inset-0 flex flex-col items-center justify-center px-6 text-center ${
          fontReady ? "boot-ready animate-boot-on" : ""
        }`}
      >
        {/* Arcade HUD */}
        <div className="absolute left-6 top-6 text-left font-mono text-xs leading-relaxed text-[#9ca3af]">
          <p>1UP</p>
          <p className="text-accent">000000</p>
        </div>
        <div className="absolute right-6 top-6 text-right font-mono text-xs leading-relaxed text-[#9ca3af]">
          <p>HIGH SCORE</p>
          <p className="text-accent">000000</p>
        </div>

        {/* Attract mode */}
        <p className="mb-8 font-mono text-sm tracking-[0.35em] text-[#9ca3af]">
          INSERT COIN
        </p>

        <h1
          aria-label={TITLE}
          className={`font-mono text-2xl font-bold tracking-[0.1em] text-[#f4efe6] sm:text-4xl ${
            titleDone ? "animate-glitch-once" : ""
          }`}
        >
          {/* Typed part, a zero-width cursor, then the not-yet-typed rest
              kept invisible: the line breaks are those of the full title
              from the first frame, so nothing moves while it types. */}
          <span aria-hidden="true">{typed}</span>
          <span
            aria-hidden="true"
            className="relative inline-block h-[0.95em] w-0 align-[-0.1em]"
          >
            <BlockCursor className="animate-blink absolute left-[0.05em] top-0 h-full w-[0.6em]" />
          </span>
          <span aria-hidden="true" className="invisible">
            {TITLE.slice(typed.length)}
          </span>
        </h1>

        <p
          className={`mt-10 font-mono text-lg font-bold tracking-[0.3em] text-accent ${
            titleDone ? "animate-blink" : "invisible"
          }`}
        >
          PRESS START
        </p>

        <p className="mt-12 font-mono text-xs tracking-[0.2em] text-[#9ca3af]">
          CLICK ANYWHERE OR PRESS ANY KEY
        </p>
        <p className="mt-6 font-mono text-xs tracking-[0.15em] text-[#9ca3af]/70">
          © 2026 BULSU BSMCS · COLLEGE OF SCIENCE · BUILT BY TEMPEST
        </p>
      </div>
    </div>
  );
}
