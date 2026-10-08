import { useState } from "react";
import Pagination from "../components/retro/Pagination";
import StaggerIn from "../components/retro/StaggerIn";
import { CHANGELOG, type ChangeTag, type ChangelogEntry } from "../data/changelog";

/* ============================================================
   CHANGELOG — the recent changes to Re:Search.
   Two exchangeable layouts: a vertical TIMELINE with a date rail,
   and a GRID of cards. Same entries, same tags (NEW / FIXED /
   ENHANCED) — only the arrangement changes. The entries live in
   data/changelog.ts, shared with the wikis' citations.

   TIMELINE GEOMETRY
   The rail runs down the LEFT EDGE (x=10px), and the date sits in
   its own fixed 104px column on the sm+ breakpoint. Content starts
   at pl-[124px], which leaves the date column and the rail clear of
   it. The earlier version pinned the rail at x=104px while content
   began at x=80px, so the dot landed on top of the card.

   Hover: the whole row is a group. The card lifts 2px with a hard
   pixel shadow, the dot fills with the accent, and a "DETAILS"
   affordance fades in on the card. Entries carrying `details` also
   toggle an expandable technical breakdown.
   ============================================================ */

const ENTRIES = CHANGELOG;

/** Entries per page: enough to read in one sitting. */
const PAGE_SIZE = 8;

const TAG_STYLE: Record<ChangeTag, string> = {
  NEW: "bg-accent text-onAccent",
  FIXED: "bg-gray-900 text-onInk",
  ENHANCED: "bg-surface text-ink border-[2px] border-gray-900",
};

type LayoutView = "timeline" | "grid";

/** Collapsed-by-default technical breakdown. */
function ChangeDetails({ lines, id }: { lines: string[]; id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 border-t-2 border-dashed border-gray-900/15 pt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`${id}-details`}
        className="font-mono text-[10px] font-bold tracking-[0.15em] text-muted transition-colors pixel-ease hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      >
        <span
          aria-hidden="true"
          className={`mr-1 inline-block transition-transform duration-100 pixel-ease ${
            open ? "rotate-90" : ""
          }`}
        >
          &rsaquo;
        </span>
        {open ? "HIDE DETAILS" : "DETAILS"}
      </button>

      <div
        id={`${id}-details`}
        className={`grid transition-[grid-template-rows] duration-200 pixel-ease ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="mt-2 space-y-1.5">
            {lines.map((line, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-5 text-muted"
              >
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-[3px] w-[3px] shrink-0 bg-accent"
                />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-ink">{entry.title}</h2>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.15em] ${TAG_STYLE[entry.tag]}`}
        >
          {entry.tag}
        </span>
      </div>

      <p className="mt-1 text-sm leading-6 text-muted">{entry.body}</p>

      {entry.details ? (
        <ChangeDetails lines={entry.details} id={entry.id} />
      ) : null}
    </>
  );
}

export default function Changelog() {
  const [view, setView] = useState<LayoutView>("timeline");
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(ENTRIES.length / PAGE_SIZE));
  const shown = ENTRIES.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function goTo(next: number) {
    setPage(Math.min(pageCount, Math.max(1, next)));
    window.requestAnimationFrame(() =>
      document.getElementById("changelog-top")?.scrollIntoView({ block: "start" }),
    );
  }

  return (
    <div id="changelog-top" className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-bold text-muted">Release Notes</p>

        <h1 className="font-pixelify mt-2 text-3xl font-bold leading-none text-ink">
          Changelog
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          The recent changes to Re:Search — new features, fixes, and
          polish, newest first. Swap between the timeline and card layouts
          however you like to read them. Open a DETAILS line for the
          engineering behind the summary.
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
          {ENTRIES.length} changes · page {page} of {pageCount}
        </span>
      </div>

      {view === "timeline" ? (
        /* ================= TIMELINE =================
           Rail sits at x=10 (a 3px bar at left-[9px], centered 10.5).
           Dot is left-[2px] at 17px wide, so it spans 2-19 and shares the
           rail's center. Because the row has no horizontal padding on
           sm+, the dot resolves against the same x-origin as the rail.

           Mobile: content sits at pl-9 (36px), 17px clear of the dot.
           sm+:    date is right-aligned in a 72px column starting at
                   x=32 (ml-8), so "Sep 30" ends at x=104 — 45px clear of
                   the dot. Content starts at x=128, 24px past the date.

           The previous version pinned the rail at x=104 while the card
           began at x=80, drawing the dot straight through the card. */
        <div className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[9px] before:w-[3px] before:bg-gray-900/15">
          {shown.map((entry, index) => (
            <StaggerIn
              key={entry.id}
              index={index}
              className="group relative flex flex-col gap-1 pl-9 sm:flex-row sm:items-start sm:gap-0 sm:pl-0"
            >
              {/* date rail dot — centered on the rail at x=10.5 */}
              <span
                aria-hidden="true"
                className="absolute top-[7px] left-[2px] h-[17px] w-[17px] rounded-full border-[3px] border-gray-900 bg-white transition-[transform,background-color] duration-150 pixel-ease group-hover:scale-110 group-hover:bg-accent"
              />

              {/* 72px date column, starting at x=32 */}
              <p className="w-full shrink-0 font-mono text-xs font-bold text-muted sm:ml-8 sm:w-[72px] sm:shrink-0 sm:pt-[6px] sm:text-right">
                {entry.date}
              </p>

              {/* content — clears the date column */}
              <div className="min-w-0 flex-1 sm:pl-6">
                <div className="rounded border-[3px] border-gray-900 bg-white px-4 py-3 transition-[transform,box-shadow] duration-100 pixel-ease group-hover:-translate-y-0.5 group-hover:shadow-[3px_3px_0_0_rgba(44,62,80,0.9)] group-focus-within:-translate-y-0.5 group-focus-within:shadow-[3px_3px_0_0_rgba(44,62,80,0.9)]">
                  <EntryCard entry={entry} />
                </div>
              </div>
            </StaggerIn>
          ))}
        </div>
      ) : (
        /* ================= GRID ================= */
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((entry, index) => (
            <StaggerIn
              key={entry.id}
              index={index}
              className="group flex flex-col rounded border-[3px] border-gray-900 bg-white p-4 transition-[transform,box-shadow] duration-100 pixel-ease hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(44,62,80,0.9)] focus-within:-translate-y-0.5 focus-within:shadow-[3px_3px_0_0_rgba(44,62,80,0.9)]"
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

              <EntryCard entry={entry} />
            </StaggerIn>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={goTo}
        total={ENTRIES.length}
        pageSize={PAGE_SIZE}
        className="mt-6"
      />
    </div>
  );
}