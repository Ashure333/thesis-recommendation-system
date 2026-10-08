/**
 * The tree's paint box, bottom right of the garden stage: a small button
 * that opens the species' colour variants as swatches. Picking one repaints
 * the tree at once and is remembered for that species.
 */

import { Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTreeVariant } from "../../state/treeVariant";
import {
  resolveVariant,
  variantSwatch,
  variantsFor,
} from "../../utils/treeVariants";

function Swatch({ colors }: { colors: string[] }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-8 shrink-0 overflow-hidden rounded-[3px] border-[2px] border-gray-900"
    >
      {colors.slice(0, 3).map((color, i) => (
        <span key={i} className="h-full flex-1" style={{ background: color }} />
      ))}
      <span
        className="h-full w-[6px]"
        style={{ background: colors[3] }}
      />
    </span>
  );
}

export default function TreeVariantPicker({
  speciesId,
  className = "",
}: {
  speciesId: string;
  className?: string;
}) {
  const [variantId, setVariant] = useTreeVariant(speciesId);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const variants = variantsFor(speciesId);
  const current = resolveVariant(speciesId, variantId);

  /* Esc and a click elsewhere fold the box back up. */
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (variants.length < 2) return null;

  return (
    <div
      ref={rootRef}
      data-tree-variants=""
      className={`absolute z-20 flex flex-col items-end gap-1.5 ${className}`}
    >
      {open && (
        <div
          role="radiogroup"
          aria-label="Tree colours"
          className="retro-shadow-light flex w-52 flex-col gap-1 rounded-md border-[3px] border-gray-900 bg-white p-1.5 shadow-[3px_3px_0_rgba(0,0,0,0.25)]"
        >
          <p className="px-1 pb-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink/80">
            Paint the tree
          </p>
          {variants.map((variant) => {
            const active = variant.id === current.id;

            return (
              <button
                key={variant.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setVariant(variant.id)}
                className={`flex items-center gap-2 rounded border-[2px] px-1.5 py-1 text-left font-mono text-[11px] font-bold transition-colors pixel-ease ${
                  active
                    ? "border-gray-900 bg-accent text-onAccent"
                    : "border-transparent bg-transparent text-ink hover:border-gray-900 hover:bg-accentSoft"
                }`}
              >
                <Swatch colors={variantSwatch(speciesId, variant)} />
                <span className="min-w-0 flex-1 truncate">{variant.label}</span>
                {active && <span aria-hidden="true">{"✓"}</span>}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Tree colours: ${current.label}`}
        title="Paint the tree in another colour scheme"
        className="retro-shadow-light flex items-center gap-1.5 rounded-md border-[3px] border-gray-900 bg-white px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wide text-ink transition-colors pixel-ease hover:bg-accentSoft"
      >
        <Palette className="h-3.5 w-3.5" aria-hidden="true" />
        <Swatch colors={variantSwatch(speciesId, current)} />
        <span className="hidden sm:inline">{current.label}</span>
      </button>
    </div>
  );
}
