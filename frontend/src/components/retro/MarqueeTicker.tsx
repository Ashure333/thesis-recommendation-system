import { useEffect, useState } from "react";
import { Diamond } from "./PixelIcons";

/* ============================================================
   ARCADE ATTRACT TICKER
   A scrolling "now loading" style strip under the nav bar,
   like an arcade machine's attract-mode marquee.

   After EXPLODE_AFTER_MS the ticker self-destructs: the bar
   shatters into pixels that scatter upward and fade, then the
   strip unmounts for the rest of the session.
   ============================================================ */

const EXPLODE_AFTER_MS = 60_000;
const EXPLODE_DURATION_MS = 1_000;
const PIXEL_SIZE = 8;

const TICKER_ITEMS = [
  "PAPER RECOMMENDATION SYSTEM",
  "BULSU BSMCS · THESIS RECOMMENDATION SYSTEM",
  "TF-IDF + S-BERT + METADATA PIPELINE ACTIVE",
  "FINAL BOSS MODE: ALL SIGNALS ON",
  "INSERT COIN TO CONTINUE",
  "1 PLAYER GAME",
  "HIGH SCORE · SAVE 10 PAPERS TO TOP THE TABLE",
  "PRESS START TO BEGIN",
];

interface Pixel {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
}

function buildPixels(): Pixel[] {
  const pixels: Pixel[] = [];
  const cols = Math.ceil(window.innerWidth / PIXEL_SIZE) + 2;
  const rows = 4;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pixels.push({
        x: col * PIXEL_SIZE,
        y: row * PIXEL_SIZE,
        dx: (Math.random() - 0.5) * 200,
        dy: -24 - Math.random() * 150,
        delay: Math.random() * 320,
      });
    }
  }

  return pixels;
}

export default function MarqueeTicker() {
  const [exploded, setExploded] = useState<
    "idle" | "exploding" | "gone"
  >("idle");
  const [pixels, setPixels] = useState<Pixel[]>([]);

  const strip = [...TICKER_ITEMS, ...TICKER_ITEMS];

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const explodeTimer = window.setTimeout(() => {
      if (reduced) {
        setExploded("gone");
        return;
      }

      setPixels(buildPixels());
      setExploded("exploding");
    }, EXPLODE_AFTER_MS);

    return () => window.clearTimeout(explodeTimer);
  }, []);

  useEffect(() => {
    if (exploded !== "exploding") {
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setExploded("gone");
    }, EXPLODE_DURATION_MS);

    return () => window.clearTimeout(hideTimer);
  }, [exploded]);

  if (exploded === "gone") {
    return null;
  }

  return (
    <div
      className="shrink-0 overflow-hidden border-b-[3px] border-gray-900 bg-gray-900 py-1.5"
      aria-hidden="true"
    >
      {exploded === "idle" ? (
        <div className="flex w-max animate-marquee">
          {strip.map((item, index) => (
            <span
              key={index}
              className="flex items-center gap-3 pl-2 pr-7 font-mono text-xs font-bold tracking-[0.25em] text-onInk"
            >
              <Diamond className="h-2.5 w-2.5 text-accent" />
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="relative h-7">
          {pixels.map((pixel, index) => (
            <span
              key={index}
              className="pixel-explode"
              style={{
                left: pixel.x,
                top: pixel.y,
                animationDelay: `${pixel.delay}ms`,
                // @ts-expect-error CSS custom properties for the keyframe.
                "--dx": `${pixel.dx}px`,
                "--dy": `${pixel.dy}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}