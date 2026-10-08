/**
 * LIGHTBOX — the full-screen viewer for the walkthrough's figures and
 * screenshots. Open an image or a diagram, step through a set with the arrow
 * keys, flip between "fit to screen" and "actual size" (scrolling), close
 * with Esc. Focus stays inside while it is open and returns to the figure
 * that opened it.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export interface LightboxItem {
  title: string;
  caption?: string;
  /** A screenshot. */
  src?: string;
  /** Or any node (an SVG diagram). Rendered at the width chosen by the fit toggle. */
  node?: ReactNode;
  /** Natural width of a node item at "actual size". */
  nodeWidth?: number;
}

export function useLightbox() {
  const [state, setState] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (items: LightboxItem[], index = 0, from?: HTMLElement | null) => {
      trigger.current = from ?? (document.activeElement as HTMLElement | null);
      setState({ items, index });
    },
    [],
  );

  const close = useCallback(() => {
    setState(null);
    const back = trigger.current;

    window.setTimeout(() => back?.focus?.(), 0);
  }, []);

  const element = state ? (
    <Lightbox
      items={state.items}
      index={state.index}
      onIndex={(index) => setState({ items: state.items, index })}
      onClose={close}
    />
  ) : null;

  return { open, element };
}

function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: LightboxItem[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [fit, setFit] = useState(true);
  const dialog = useRef<HTMLDivElement | null>(null);
  const item = items[index];
  const many = items.length > 1;

  const step = useCallback(
    (delta: number) => onIndex((index + delta + items.length) % items.length),
    [index, items.length, onIndex],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (many && event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (many && event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "Tab") {
        const buttons = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>("button") ?? [],
        );

        if (!buttons.length) return;

        const first = buttons[0];
        const last = buttons[buttons.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const seat = window.setTimeout(() => dialog.current?.focus(), 0);
    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(seat);
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [many, onClose, step]);

  if (!item) return null;

  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      tabIndex={-1}
      data-lightbox
      className="fixed inset-0 z-[9400] flex flex-col bg-black/85 outline-none"
    >
      <div className="flex shrink-0 items-center gap-3 border-b-[3px] border-gray-900 bg-gray-900 px-4 py-2 text-onInk">
        <p className="min-w-0 flex-1 truncate font-pixelify text-sm font-bold">
          {item.title}
          {many && (
            <span className="ml-2 font-mono text-xs text-onInk/70">
              {index + 1} / {items.length}
            </span>
          )}
        </p>
        {many && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous"
              className="rounded border-2 border-onInk/60 px-2 py-0.5 font-mono text-xs font-bold hover:bg-white/15"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next"
              className="rounded border-2 border-onInk/60 px-2 py-0.5 font-mono text-xs font-bold hover:bg-white/15"
            >
              →
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setFit((value) => !value)}
          aria-pressed={!fit}
          className="rounded border-2 border-onInk/60 px-2 py-0.5 font-mono text-xs font-bold hover:bg-white/15"
        >
          {fit ? "Actual size" : "Fit to screen"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded border-2 border-onInk/60 px-2 py-0.5 font-mono text-xs font-bold hover:bg-white/15"
        >
          ✕
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {item.src ? (
          <img
            src={item.src}
            alt={item.title}
            className={
              fit
                ? "mx-auto block max-h-full max-w-full rounded border-[3px] border-gray-900 bg-white object-contain"
                : "mx-auto block max-w-none rounded border-[3px] border-gray-900 bg-white"
            }
            style={fit ? { maxHeight: "calc(100vh - 11rem)" } : undefined}
          />
        ) : (
          <div
            className="mx-auto rounded border-[3px] border-gray-900 bg-white p-4"
            style={{
              width: fit ? "min(100%, 1500px)" : `${item.nodeWidth ?? 1500}px`,
              maxWidth: fit ? undefined : "none",
            }}
          >
            {item.node}
          </div>
        )}
      </div>

      {item.caption && (
        <p className="shrink-0 border-t-[3px] border-gray-900 bg-gray-900 px-4 py-2 text-xs leading-5 text-onInk/90">
          {item.caption}
        </p>
      )}
    </div>,
    document.body,
  );
}
