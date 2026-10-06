/* ============================================================
   RETRO DIALOG — the theme's pop-up: a hard-bordered retro card
   over a dimmed scrim, with a brown header and pixel buttons.
   Used for every confirm/notice in the garden and the shops.

   The overlay is pinned to the WEB APP's bounding box (the
   #app-shell layout), never the whole browser window — it can
   only dim and cover the app itself, never stray UI outside it.
   ============================================================ */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function appBox(): Rect {
  const app = document.getElementById("app-shell");
  if (app) {
    const rect = app.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

export default function RetroDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const [box, setBox] = useState<Rect | null>(null);

  useEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const measure = () => setBox(appBox());
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  /* While a dialog is open the page behind it is frozen: scroll
     (wheel, touch, arrow, space) is blocked so the layout cannot
     slide out from under the pop-up, focus is trapped inside it,
     and Tab/Shift+Tab cycle through its buttons only. */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    /* Seat focus inside the pop-up immediately so Tab never leaks
       into the page behind it. */
    const seat = window.setTimeout(() => {
      const dialog = document.querySelector(
        "[role='dialog'][aria-modal='true']",
      );
      const first = dialog?.querySelector<HTMLElement>("button");
      first?.focus();
    }, 0);

    const block = (event: Event) => event.preventDefault();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        event.preventDefault();
        return;
      }
      if (event.key === "Tab") {
        const dialog = document.querySelector(
          "[role='dialog'][aria-modal='true']",
        );
        const focusables = dialog
          ? Array.from(
              dialog.querySelectorAll<HTMLElement>(
                "button, [tabindex]:not([tabindex='-1'])",
              ),
            )
          : [];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(seat);
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open, onCancel]);

  if (!open || !box) return null;

  /* Portaled: the pop-up paints at the document root so the tree
     card's rounded clip can never truncate it — while its scrim
     still only covers the web app's bounding box. */
  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="z-[70] grid place-items-center bg-black/45 p-4 outline-none"
      style={{
        position: "fixed",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && onCancel) {
          onCancel();
        }
      }}
    >
      <div className="animate-pop-in w-[min(92%,430px)] overflow-hidden rounded-xl border-[3px] border-gray-900 bg-white shadow-[6px_6px_0_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-gradient-to-b from-[#96683a] to-[#82572c] px-4 py-2.5">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#ffe9a8]">
            {title}
          </p>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="grid h-5 w-5 place-items-center rounded border-[2px] border-[#ffe9a8]/80 font-mono text-[11px] font-bold leading-none text-[#ffe9a8] transition-colors pixel-ease hover:bg-[#ffe9a8]/15"
            >
              {"\u00D7"}
            </button>
          )}
        </div>

        <div className="p-4 text-xs leading-5 text-ink">{children}</div>

        <div className="flex justify-end gap-2 border-t-[3px] border-gray-900 bg-[#fbf7ee] dark:bg-[#241b12] px-4 py-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border-[2px] border-gray-900 bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink transition-colors pixel-ease hover:bg-accentSoft"
            >
              {cancelLabel}
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg border-[3px] border-gray-900 bg-[#e8b04b] px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#2b3347] shadow-[3px_3px_0_rgba(0,0,0,0.18)] transition-all pixel-ease hover:bg-[#f0c161] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.18)] active:translate-y-[3px] active:shadow-none"
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  ), document.body);
}