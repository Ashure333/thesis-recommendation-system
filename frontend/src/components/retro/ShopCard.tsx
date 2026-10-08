/* ============================================================
   SHOP CARD — the card every garden shop shares.

   Modelled on the Theme shop: a framed pixel preview, the name with
   a status badge, a line of blurb, and one action on the right. The
   active card is lifted and tinted. Colours come from the adaptive
   theme tokens (ink, surface, accentSoft, onAccent), so the cards read
   in both light and dark mode.

   layout "strip": the preview runs across the top (the Theme shop's
   scenery strips). layout "side": the preview sits at the left, the
   text and action to its right (trees, fertilizer packs).
   ============================================================ */

import type { ReactNode } from "react";

export function ShopCard({
  preview,
  title,
  badge,
  blurb,
  active = false,
  layout = "strip",
  children,
}: {
  preview: ReactNode;
  title: string;
  badge?: ReactNode;
  blurb?: string;
  active?: boolean;
  layout?: "strip" | "side";
  /** The card's action: a CardButton, a CardTag, or nothing. */
  children?: ReactNode;
}) {
  const frame = `rounded-lg border-[3px] border-gray-900 p-2 transition-colors pixel-ease ${
    active
      ? "bg-accentSoft/80 shadow-[3px_3px_0_rgba(0,0,0,0.15)]"
      : "bg-white"
  }`;

  const text = (
    <div className="min-w-0">
      <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink">
        {title}
        {badge}
      </p>
      {blurb && (
        <p className="mt-0.5 text-[10px] leading-4 text-ink/80">{blurb}</p>
      )}
    </div>
  );

  if (layout === "side") {
    return (
      <div className={frame}>
        <div className="flex items-stretch gap-3">
          <div className="shrink-0">{preview}</div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
            {text}
            {children && <div className="flex justify-end">{children}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
      {preview}
      <div className="mt-2 flex items-center justify-between gap-2">
        {text}
        {children}
      </div>
    </div>
  );
}

/** The small status badge beside a card's name ("In use", "Planted"). */
export function CardBadge({
  children,
  tone = "good",
}: {
  children: ReactNode;
  tone?: "good" | "muted";
}) {
  return (
    <span
      className={`ml-2 rounded border-[2px] bg-white px-1.5 py-0.5 text-[8px] ${
        tone === "good"
          ? "border-[#1f7a33] text-[#1f7a33] [[data-mode=dark]_&]:border-[#7ddf8a] [[data-mode=dark]_&]:text-[#7ddf8a]"
          : "border-ink/50 text-ink/80"
      }`}
    >
      {children}
    </span>
  );
}

/** A static state on the right of a card ("Active", "Planted", "Owned"). */
export function CardTag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded border-[2px] border-gray-400 bg-surfaceAlt px-2 py-1 font-mono text-[9px] font-bold uppercase text-ink">
      {children}
    </span>
  );
}

/** A card's action button: accent when it can be pressed, dashed and
 *  quiet when it cannot (e.g. not enough tokens). */
export function CardButton({
  children,
  onClick,
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex shrink-0 items-center gap-1 rounded border-[3px] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-all pixel-ease ${
        disabled
          ? "cursor-not-allowed border-dashed border-gray-500 bg-transparent text-ink/85"
          : "border-gray-900 bg-accent text-onAccent hover:brightness-110 hover:bg-accent active:translate-y-[1px]"
      }`}
    >
      {children}
    </button>
  );
}
