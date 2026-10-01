import { useState } from "react";
import StaggerIn from "../components/retro/StaggerIn";
import { CHANGELOG, type ChangeTag } from "../data/changelog";

/* ============================================================
   CHANGELOG — the recent changes to Re:Search.
   Two exchangeable layouts: a vertical TIMELINE with a date rail,
   and a GRID of cards. Same entries, same tags (NEW / FIXED /
   ENHANCED) — only the arrangement changes. The entries live in
   data/changelog.ts, shared with the wikis' citations.
   ============================================================ */

const ENTRIES = CHANGELOG;

const TAG_STYLE: Record<ChangeTag, string> = {
  NEW: "bg-accent text-onAccent",
  FIXED: "bg-gray-900 text-onInk",
  ENHANCED: "bg-surface text-ink border-[2px] border-gray-900",
};

type LayoutView = "timeline" | "grid";

export default function Changelog() {
  const [view, setView] = useState<LayoutView>("timeline");

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-bold text-muted">
          Release Notes
        </p>

        <h1 className="font-pixelify mt-2 text-3xl font-bold leading-none text-ink">
          Changelog
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          The recent changes to Re:Search — new features, fixes, and
          polish, newest first. Swap between the timeline and card
          layouts however you like to read them.
        </p>
      </div>

      {/* Exchangeable layout switcher */}
      <div className="mb-6 flex items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
          Layout
        </span>

        <div className="flex rounded border-[3px] border-gray-900">
          {(["timeline", "grid"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`px-3 py-1 font-mono text-xs font-semibold tracking-[0.1em] transition-colors pixel-ease ${
                option !== "timeline" ? "-ml-[3px]" : ""
              } ${
                view === option
                  ? "bg-accent text-onAccent"
                  : "bg-white text-ink hover:bg-accentSoft"
              }`}
            >
              {option === "timeline" ? "TIMELINE" : "GRID"}
            </button>
          ))}
        </div>

        <span className="ml-auto hidden text-xs text-muted sm:block">
          {ENTRIES.length} changes logged
        </span>
      </div>

      {view === "timeline" ? (
        /* ================= TIMELINE ================= */
        <div className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-[3px] before:bg-gray-900/15 sm:before:left-[104px]">
          {ENTRIES.map((entry, index) => (
            <StaggerIn key={entry.title} index={index} className="relative flex flex-col gap-1 pl-8 sm:flex-row sm:items-baseline sm:gap-0 sm:pl-0">
              {/* date rail dot */}
              <span
                aria-hidden="true"
                className="absolute top-1.5 left-0 h-[17px] w-[17px] rounded-full border-[3px] border-gray-900 bg-white sm:left-[96px]"
              />

              <p className="w-20 shrink-0 pl-4 font-mono text-xs font-bold text-muted sm:pl-0 sm:pr-6 sm:text-right">
                {entry.date}
              </p>

              <div className="min-w-0 flex-1 rounded border-[3px] border-gray-900 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-ink">
                    {entry.title}
                  </h2>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.15em] ${TAG_STYLE[entry.tag]}`}
                  >
                    {entry.tag}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {entry.body}
                </p>
              </div>
            </StaggerIn>
          ))}
        </div>
      ) : (
        /* ================= GRID ================= */
        <div className="grid gap-4 sm:grid-cols-2">
          {ENTRIES.map((entry, index) => (
            <StaggerIn
              key={entry.title}
              index={index}
              className="flex flex-col rounded border-[3px] border-gray-900 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-xs font-bold text-muted">
                  {entry.date}
                </p>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.15em] ${TAG_STYLE[entry.tag]}`}
                >
                  {entry.tag}
                </span>
              </div>

              <h2 className="mt-2 text-sm font-bold text-ink">
                {entry.title}
              </h2>

              <p className="mt-1 text-sm leading-6 text-muted">
                {entry.body}
              </p>
            </StaggerIn>
          ))}
        </div>
      )}
    </div>
  );
}