/**
 * REPO STATS PANE — the repository's right-side "Stats for Nerds".
 *
 * The repository search is live, so this pane recomputes from the
 * currently filtered papers on every keystroke: a short COMPUTING
 * beat plays (the same stepped bar as the mode-switch screen), then
 * the snapshot and the pipeline pseudocode animate in.
 *
 * Toggled from the page header; the preference persists per browser.
 */

import { useEffect, useMemo, useState } from "react";

import type { Paper } from "../api";
import FreqBars, { type FreqDatum } from "./retro/FreqBars";
import StatsForNerds from "./StatsForNerds";

export default function RepoStatsPane({
  papers,
  query,
}: {
  papers: Paper[];
  query: string;
}) {
  const [computing, setComputing] = useState(true);

  // Every keystroke / filter change recomputes: a deliberate
  // computing beat, then the numbers step in.
  useEffect(() => {
    setComputing(true);

    const timer = window.setTimeout(() => setComputing(false), 420);

    return () => window.clearTimeout(timer);
  }, [papers, query]);

  const snapshot = useMemo(() => {
    const valid = papers.filter(
      (paper) => paper.is_valid_for_recommendation
    ).length;

    const years = papers
      .map((paper) => paper.publication_year)
      .filter((year): year is number => year !== null && year > 0);

    const typeCounts = new Map<string, number>();

    for (const paper of papers) {
      const key = (paper.document_type ?? "").trim() || "Unspecified";
      typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
    }

    const types: FreqDatum[] = [...typeCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));

    return {
      total: papers.length,
      valid,
      needsReview: papers.length - valid,
      minYear: years.length > 0 ? Math.min(...years) : null,
      maxYear: years.length > 0 ? Math.max(...years) : null,
      types,
    };
  }, [papers]);

  return (
    <div className="flex h-full flex-col" data-repo-stats>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink">
          Stats for Nerds
        </p>

        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          Live · repository
        </span>
      </div>

      {computing ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-6"
        >
          <p className="font-mono text-xs font-bold tracking-[0.25em] text-accent">
            COMPUTING…
          </p>

          <div className="h-3 w-40 overflow-hidden rounded border-[3px] border-gray-900 bg-white">
            <div className="animate-loader-fill h-full bg-accent" />
          </div>

          <p className="font-mono text-[10px] text-muted">
            {papers.length} paper{papers.length === 1 ? "" : "s"} in view
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="animate-step-in flex flex-col gap-4 p-4">
            {/* SNAPSHOT — the real-time numbers */}
            <section
              data-repo-snapshot
              className="rounded border-[3px] border-gray-900 bg-white p-4"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                Snapshot of the current view
              </p>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <StatCard label="Papers" value={snapshot.total} />
                <StatCard label="Valid for recs" value={snapshot.valid} />
                <StatCard
                  label="Year span"
                  value={
                    snapshot.minYear !== null
                      ? `${snapshot.minYear}–${snapshot.maxYear}`
                      : "—"
                  }
                />
                <StatCard
                  label="Needs review"
                  value={snapshot.needsReview}
                />
              </div>

              {snapshot.types.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                    Document types
                  </p>

                  <FreqBars
                    data={snapshot.types}
                    height={84}
                    ariaLabel="Document types in the current view"
                  />
                </div>
              )}
            </section>

            {/* MATH — the pipeline pseudocode, live trace on query */}
            <StatsForNerds
              hideHeader
              inputs={
                query.trim()
                  ? { mode: "keyword", query: query.trim(), topK: 10 }
                  : null
              }
              contextNote="Computed live as you search: the snapshot follows the filters, the pseudocode follows the active pipeline."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border-[2px] border-gray-900 bg-canvas px-2 py-1.5">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-bold leading-none text-ink">
        {value}
      </p>
    </div>
  );
}
