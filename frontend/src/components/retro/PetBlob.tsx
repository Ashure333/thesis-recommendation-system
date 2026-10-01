import type { CSSProperties } from "react";
import type { PetVariant } from "../../data/petForms";

/* ============================================================
   PET BLOB — renders any of the ten pet forms.
   Every form shares the original architecture: an ink-outlined
   body with white eyes. Forms are distinct Tempest characters —
   the slime shifts into a dragon, kijin, wolf, goblin, flame
   spirit, demons, and more — and each wears the character's own
   palette (slime blue, crimson, wolf-white, demon-black…).
   Features (horns, ears, wings, tails, flames) are ink silhouettes
   pinned to the body edge. All proportions scale from `size`.
   ============================================================ */

interface PetBlobProps {
  variant: PetVariant;
  size: number;
  hungry?: boolean;
  className?: string;
}

const INK = "#1f2937"; // gray-900, the outline color
const TRI = "polygon(50% 0%, 0% 100%, 100% 100%)";

/** Canonical Tempest palettes: the body hue plus the feature (ink) color. */
const PALETTE: Record<PetVariant, { body: string; feature: string }> = {
  rimuru: { body: "#38bdf8", feature: INK }, // slime blue
  veldora: { body: "#14b8a6", feature: INK }, // storm dragon teal
  benimaru: { body: "#ef4444", feature: INK }, // kijin crimson
  shion: { body: "#a855f7", feature: INK }, // demon violet
  ranga: { body: "#f3f4f6", feature: INK }, // white wolf, black tips
  shuna: { body: "#ec4899", feature: INK }, // priestess pink
  gobta: { body: "#4ade80", feature: INK }, // goblin green
  ciel: { body: "#cbd5e1", feature: "#f8fafc" }, // silver sage, white hair
  diablo: { body: "#334155", feature: "#f8fafc" }, // black demon, silver hair
  milim: { body: "#f9a8d4", feature: INK }, // destroyer pink
};

const RADIUS: Record<PetVariant, string> = {
  rimuru: "50% 50% 45% 45% / 60% 60% 40% 40%",
  veldora: "52% 52% 44% 44% / 66% 66% 40% 40%",
  benimaru: "52% 52% 46% 46% / 64% 64% 42% 42%",
  shion: "52% 52% 46% 46% / 64% 64% 42% 42%",
  ranga: "50% 50% 44% 44% / 56% 56% 44% 44%",
  shuna: "50% 50% 45% 45% / 60% 60% 40% 40%",
  gobta: "48% 48% 44% 44% / 56% 56% 46% 46%",
  ciel: "50% 50% 44% 44% / 68% 68% 40% 40%",
  diablo: "50% 50% 44% 44% / 70% 70% 42% 42%",
  milim: "50% 50% 45% 45% / 60% 60% 40% 40%",
};

const SHAPE: Record<PetVariant, { w: number; h: number }> = {
  rimuru: { w: 1, h: 1 },
  veldora: { w: 1.14, h: 0.9 },
  benimaru: { w: 0.92, h: 1.04 },
  shion: { w: 0.92, h: 1.04 },
  ranga: { w: 1.2, h: 0.82 },
  shuna: { w: 0.98, h: 0.98 },
  gobta: { w: 1.06, h: 0.94 },
  ciel: { w: 0.92, h: 1.08 },
  diablo: { w: 0.88, h: 1.1 },
  milim: { w: 0.98, h: 0.98 },
};

/** An ink triangle pinned to the body edge (horns, ears, flames…). */
function spike(
  w: number,
  h: number,
  top: number,
  left: number,
  color: string,
  rotate = 0,
): CSSProperties {
  return {
    position: "absolute",
    top: `${top}%`,
    left: `${left}%`,
    width: w,
    height: h,
    background: color,
    clipPath: TRI,
    transform: rotate ? `rotate(${rotate}deg)` : undefined,
  };
}

function features(variant: PetVariant, size: number) {
  const u = (v: number) => v * size;
  const ink = PALETTE[variant].feature;

  switch (variant) {
    case "veldora":
      return (
        <>
          {/* horns */}
          <span style={spike(u(0.16), u(0.17), -6, 22, ink)} />
          <span style={spike(u(0.16), u(0.17), -6, 62, ink)} />
          {/* wings */}
          <span
            style={{
              position: "absolute",
              top: "34%",
              left: u(-0.14),
              width: u(0.22),
              height: u(0.3),
              background: ink,
              clipPath: "polygon(0 50%, 100% 0%, 100% 100%)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: "34%",
              right: u(-0.14),
              width: u(0.22),
              height: u(0.3),
              background: ink,
              clipPath: "polygon(100% 50%, 0% 0%, 0% 100%)",
            }}
          />
          {/* tail */}
          <span
            style={{
              position: "absolute",
              top: "70%",
              left: u(-0.1),
              width: u(0.18),
              height: u(0.14),
              background: ink,
              clipPath: "polygon(100% 50%, 0% 0%, 0% 100%)",
            }}
          />
        </>
      );
    case "benimaru":
      return (
        <>
          <span style={spike(u(0.15), u(0.2), -8, 27, ink)} />
          <span style={spike(u(0.15), u(0.2), -8, 58, ink)} />
        </>
      );
    case "shion":
      return <span style={spike(u(0.15), u(0.2), -8, 40, ink)} />;
    case "ranga":
      return (
        <>
          <span style={spike(u(0.16), u(0.2), -7, 16, ink)} />
          <span style={spike(u(0.16), u(0.2), -7, 68, ink)} />
          {/* bushy tail */}
          <span
            style={{
              position: "absolute",
              top: "26%",
              right: u(-0.18),
              width: u(0.22),
              height: u(0.16),
              borderRadius: "999px",
              background: ink,
              transform: "rotate(-18deg)",
            }}
          />
        </>
      );
    case "shuna":
      return (
        <>
          <span style={spike(u(0.18), u(0.2), -8, 10, ink, -18)} />
          <span style={spike(u(0.18), u(0.2), -8, 72, ink, 18)} />
        </>
      );
    case "gobta":
      return (
        <>
          <span
            style={{
              position: "absolute",
              top: "30%",
              left: u(-0.11),
              width: u(0.24),
              height: u(0.24),
              borderRadius: "50%",
              background: ink,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: "30%",
              right: u(-0.11),
              width: u(0.24),
              height: u(0.24),
              borderRadius: "50%",
              background: ink,
            }}
          />
        </>
      );
    case "ciel":
      return (
        <>
          {/* sage sparkle above the head */}
          <span
            style={{
              position: "absolute",
              top: u(-0.16),
              left: "52%",
              width: u(0.14),
              height: u(0.14),
              background: ink,
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            }}
          />
          {/* flowing hair locks */}
          <span
            style={{
              position: "absolute",
              top: u(-0.06),
              right: "6%",
              width: u(0.2),
              height: u(0.56),
              borderRadius: "999px",
              background: ink,
              transform: "rotate(14deg)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: u(0.14),
              right: u(-0.09),
              width: u(0.16),
              height: u(0.34),
              borderRadius: "999px",
              background: ink,
              transform: "rotate(-12deg)",
            }}
          />
        </>
      );
    case "diablo":
      return (
        <>
          <span style={spike(u(0.14), u(0.2), -6, 24, ink, -30)} />
          <span style={spike(u(0.14), u(0.2), -6, 62, ink, 30)} />
        </>
      );
    case "milim":
      return (
        <>
          <span style={spike(u(0.1), u(0.13), -4, 32, ink)} />
          <span style={spike(u(0.1), u(0.13), -4, 58, ink)} />
        </>
      );
    default:
      return null;
  }
}

export default function PetBlob({
  variant,
  size,
  hungry = false,
  className = "",
}: PetBlobProps) {
  const shape = SHAPE[variant];
  const width = size * shape.w;
  const height = size * shape.h;

  const eye = Math.max(3, size * 0.17);
  const eyeGap = Math.max(2, size * 0.08);
  const mouth = size * 0.1;

  return (
    <span
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={{ width, height }}
    >
      <span
        className="relative flex items-center justify-center border-[3px] border-gray-900"
        style={{
          width: "100%",
          height: "100%",
          borderRadius: RADIUS[variant],
          background: PALETTE[variant].body,
        }}
      >
        {features(variant, size)}

        {/* Eyes */}
        <span className="flex items-center justify-center" style={{ gap: eyeGap }}>
          {variant === "shuna" || variant === "ciel" ? (
            <>
              <span
                className="rounded-full bg-gray-900"
                style={{ width: eye * 1.2, height: Math.max(2, eye * 0.28) }}
              />
              <span
                className="rounded-full bg-gray-900"
                style={{ width: eye * 1.2, height: Math.max(2, eye * 0.28) }}
              />
            </>
          ) : (
            <>
              <span
                className={`rounded-full border-2 border-gray-900 bg-white transition-transform duration-100 pixel-ease ${
                  hungry ? "scale-y-75" : ""
                }`}
                style={{ width: eye, height: eye }}
              />
              <span
                className={`rounded-full border-2 border-gray-900 bg-white transition-transform duration-100 pixel-ease ${
                  hungry ? "scale-y-75" : ""
                }`}
                style={{ width: eye, height: eye }}
              />
            </>
          )}
        </span>

        {/* Smile */}
        {(variant === "shuna" || variant === "milim") && (
          <span
            className="absolute"
            style={{
              width: mouth * 1.6,
              height: mouth * 0.8,
              bottom: size * 0.16,
              borderBottom: "2px solid #2c3e50",
              borderRadius: "0 0 999px 999px",
            }}
          />
        )}
      </span>
    </span>
  );
}