import { useEffect, useRef, useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";

import {
  ACCENTS,
  deriveDarkTokens,
  tripletToHex,
  useTheme,
  type AccentId,
  type ThemeMode,
} from "../theme";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

/* ============================================================
   ACCENT PICKER
   Small palette button in the top nav. Opens a list of theme
   colors plus a light/dark mode toggle; both selections
   persist in localStorage.
   ============================================================ */

export default function AccentPicker() {
  const { accent, setAccent, mode, setMode } = useTheme();

  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = ACCENTS.find((option) => option.id === accent) ?? ACCENTS[0];

  // Swatches preview the palette the way it will actually render:
  // the accent plus the mode-aware canvas tint.
  function canvasFor(option: (typeof ACCENTS)[number]) {
    return mode === "dark"
      ? deriveDarkTokens(option).canvas
      : option.canvas;
  }

  function choose(id: AccentId) {
    setAccent(id);
    setOpen(false);
  }

  function chooseMode(nextMode: ThemeMode) {
    setMode(nextMode);
  }

  return (
    <div ref={containerRef} data-tips="theme-picker" className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={mode === "dark" ? "Theme: dark" : "Theme: light"}
        aria-label="Theme color and mode"
        aria-expanded={open}
        aria-haspopup="true"
        className={`font-pixelify flex h-9 items-center gap-2 rounded border-[3px] border-gray-900 bg-white px-2.5 text-sm font-bold text-gray-900 hover:bg-accentSoft ${FOCUS}`}
      >
        {mode === "dark" ? <Moon size={15} /> : <Palette size={15} />}
        <span
          aria-hidden="true"
          className="flex h-4 w-4 items-center justify-center gap-[2px] rounded-[2px] border-[2px] border-gray-900 p-[2px]"
        >
          <span
            className="h-full flex-1 rounded-[1px]"
            style={{ backgroundColor: tripletToHex(current.accent) }}
          />
          <span
            className="h-full flex-1 rounded-[1px]"
            style={{ backgroundColor: tripletToHex(canvasFor(current)) }}
          />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute right-0 top-[calc(100%+8px)] z-[200] w-52 rounded border-[3px] border-gray-900 bg-white p-2"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-2 pt-1">
            <p className="text-xs font-bold text-gray-600">Theme</p>

            <div
              role="group"
              aria-label="Light or dark mode"
              className="flex rounded border-[3px] border-gray-900"
            >
              {(
                [
                  { id: "light", label: "Light", icon: Sun },
                  { id: "dark", label: "Dark", icon: Moon },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = mode === id;

                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => chooseMode(id)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-bold ${FOCUS} ${
                      active
                        ? "bg-accent text-onAccent"
                        : "text-gray-600 hover:bg-accentSoft"
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {ACCENTS.map((option) => {
              const active = option.id === accent;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(option.id)}
                  className={`flex w-full items-center gap-2.5 rounded border-[3px] px-2 py-1.5 text-left text-sm font-medium ${FOCUS} ${
                    active
                      ? "border-gray-900 bg-accent text-onAccent"
                      : "border-transparent text-gray-900 hover:border-gray-900 hover:bg-accentSoft"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 shrink-0 items-center justify-center gap-[2px] rounded-[2px] border-[2px] border-gray-900 p-[2px]"
                  >
                    <span
                      className="h-full flex-1 rounded-[1px]"
                      style={{ backgroundColor: tripletToHex(option.accent) }}
                    />
                    <span
                      className="h-full flex-1 rounded-[1px]"
                      style={{ backgroundColor: tripletToHex(canvasFor(option)) }}
                    />
                  </span>

                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>

                  {active && <Check size={15} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}