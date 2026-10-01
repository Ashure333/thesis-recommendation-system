import { ArrowLeft, ArrowRight } from "./PixelIcons";

/* ============================================================
   RETRO PAGINATION
   Arrows + numbered pages (windowed with ellipses for long
   lists). Hidden entirely when there is nothing to page.
   ============================================================ */

function pageList(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const wanted = new Set(
    [1, pageCount, page - 1, page, page + 1].filter(
      (p) => p >= 1 && p <= pageCount,
    ),
  );

  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let previous = 0;

  for (const p of sorted) {
    if (p - previous > 1) {
      out.push("…");
    }
    out.push(p);
    previous = p;
  }

  return out;
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  className = "",
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Optional "Showing X–Y of Z" caption. */
  total?: number;
  pageSize?: number;
  className?: string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const from = total != null && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total != null && pageSize ? Math.min(page * pageSize, total) : null;

  const pageButton =
    "flex h-7 min-w-7 items-center justify-center rounded border-[2px] border-gray-900 px-1.5 font-mono text-xs font-bold transition-colors pixel-ease disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${className}`}
    >
      {from != null && total != null && to != null ? (
        <p className="font-mono text-xs text-muted">
          {from}–{to} of {total}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={pageButton}
        >
          <ArrowLeft className="h-3 w-3" />
        </button>

        {pageList(page, pageCount).map((entry, index) =>
          entry === "…" ? (
            <span
              key={`gap-${index}`}
              className="px-1 font-mono text-xs text-muted"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? "page" : undefined}
              onClick={() => onPageChange(entry)}
              className={`${pageButton} ${
                entry === page
                  ? "bg-accent text-onAccent"
                  : "bg-white text-ink hover:bg-accentSoft"
              }`}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className={pageButton}
        >
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}