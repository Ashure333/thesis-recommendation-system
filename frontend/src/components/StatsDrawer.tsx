/**
 * STATS DRAWER — the universal Statistics panel (top-bar Σ toggle).
 *
 * Three parts, stacked:
 *   1. Repository statistics — live totals from the backend.
 *   2. The published computation — the live trace of the most recent
 *      search or battle (query / seed), with the formulas as in the
 *      Engine, plus a link to the full Engine treatment.
 *   3. In-depth interpretations — each step of the process in plain
 *      words, with why it matters.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

import { getRepositoryStats, type RepositoryStats } from "../api";
import { STATS_INSIGHTS } from "../data/statsInsights";
import { useStatsDrawer } from "../state/statsDrawer";
import StatsForNerds from "./StatsForNerds";

export default function StatsDrawer() {
  const { open, setOpen, published } = useStatsDrawer();
  const [stats, setStats] = useState<RepositoryStats | null>(null);

  // Live totals — refreshed every time the drawer opens.
  useEffect(() => {
    if (!open) {
      return;
    }

    let stale = false;

    getRepositoryStats()
      .then((rows) => {
        if (!stale) {
          setStats(rows);
        }
      })
      .catch(() => {
        if (!stale) {
          setStats(null);
        }
      });

    return () => {
      stale = true;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const subjects = stats
    ? Object.entries(stats.by_subject).sort((a, b) => b[1] - a[1])
    : [];

  const maxSubject = subjects[0]?.[1] ?? 1;

  return (
    <div
      role="dialog"
      aria-label="Statistics and computations"
      className="fixed inset-0 z-[9200] flex justify-end bg-gray-900/40"
      onClick={() => setOpen(false)}
    >
      <aside
        data-stats-drawer
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-[760px] flex-col bg-canvas shadow-[inset_3px_0_0_rgba(0,0,0,0.15)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-white px-4 py-3">
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
            <span className="flex h-7 w-7 items-center justify-center rounded border-[2px] border-gray-900 bg-accent font-serif text-base font-bold text-onAccent">
              Σ
            </span>
            Statistics
          </p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close statistics"
            className="rounded border-[2px] border-gray-900 bg-white px-2 py-1 text-ink transition-colors hover:bg-accentSoft"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
          {/* 1 — Repository statistics */}
          <section className="rounded border-[3px] border-gray-900 bg-white p-4">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
              Repository statistics
            </h3>

            {stats ? (
              <>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                  <p className="font-pixelify text-2xl font-bold text-ink">
                    {stats.total_papers}
                    <span className="ml-2 font-pixelify text-sm font-bold text-muted">
                      papers
                    </span>
                  </p>
                  <p className="font-pixelify text-2xl font-bold text-ink">
                    {stats.category_count}
                    <span className="ml-2 font-pixelify text-sm font-bold text-muted">
                      subjects
                    </span>
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {subjects.slice(0, 8).map(([subject, count]) => (
                    <div key={subject} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-xs text-muted">
                        {subject}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full border-[1px] border-gray-900 bg-canvas">
                        <div
                          className="h-full bg-accent"
                          style={{
                            width: `${(count / maxSubject) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-xs text-ink">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted">
                Statistics unavailable right now.
              </p>
            )}
          </section>

          {/* 2 — The published computation */}
          <section className="rounded border-[3px] border-gray-900 bg-white p-4">
            <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
              Computations — live trace
            </h3>

            <p className="mb-3 text-xs leading-5 text-muted">
              The pipeline's real numbers for the most recent search on
              any page. The formulas are the ones the Engine explains in
              full.
            </p>

            {published ? (
              <StatsForNerds
                hideHeader
                contextNote={`Traced pipeline: ${published.pipelineId} · top_k = ${published.topK}${published.mmrLambda !== undefined ? " · Diversify on" : ""}`}
                inputs={{
                  mode: published.mode,
                  query: published.query,
                  seedPaperId: published.seedPaperId,
                  topK: published.topK,
                  mmrLambda: published.mmrLambda,
                }}
              />
            ) : (
              <p className="rounded border-[2px] border-gray-900 bg-canvas px-3 py-3 text-xs leading-5 text-muted">
                No computation published yet. Run a recommendation
                search (Repository → Recommend) or an Arena battle, then
                open this panel to walk the real numbers step by step.
              </p>
            )}

            <Link
              to="/walkthrough-engine"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center gap-1 rounded border-[2px] border-gray-900 bg-white px-2 py-1 text-xs font-bold text-ink transition-colors hover:bg-accentSoft"
            >
              Every formula, explained in the Engine →
            </Link>
          </section>

          {/* 3 — What each step means */}
          <section className="rounded border-[3px] border-gray-900 bg-white p-4">
            <h3 className="mb-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
              What each step means
            </h3>

            <p className="mb-3 text-xs leading-5 text-muted">
              The process, one stage at a time — the formula first, then
              what it computes, then why the design chose it.
            </p>

            <div className="space-y-3">
              {STATS_INSIGHTS.map((insight) => (
                <details key={insight.step} className="group rounded border-[2px] border-gray-900 bg-canvas">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-accentSoft">
                    {insight.step}
                    <span className="font-mono text-xs text-muted">
                      {insight.formula.length > 42
                        ? `${insight.formula.slice(0, 41)}…`
                        : insight.formula}
                    </span>
                  </summary>

                  <div className="space-y-2 border-t-[2px] border-gray-900 px-3 py-3">
                    <p className="whitespace-pre-wrap font-mono text-xs leading-5 text-ink">
                      {insight.formula}
                    </p>
                    <p className="text-xs leading-5 text-muted">
                      <span className="font-bold text-ink">What it does: </span>
                      {insight.plain}
                    </p>
                    <p className="text-xs leading-5 text-muted">
                      <span className="font-bold text-ink">Why: </span>
                      {insight.why}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}