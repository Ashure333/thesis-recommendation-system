
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  getRecommendations,
  getPaper,
  saveToLibrary,
  SearchResult,
  Paper,
} from "../../api";

import { pipelineConfigs } from "../../data/pipelineConfigs";
import WeightBar from "../../components/WeightBar";

import {
  Button,
  EmptyState,
  PageHeader,
  PageShell,
} from "../../components/ui";

const IMPLEMENTED = new Set([
  "tfidf",
  "sbert",
  "tfidf_sbert",
  "tfidf_metadata",
  "sbert_metadata",
  "tfidf_sbert_metadata",
]);

interface NavState {
  mode?: "keyword" | "title" | "seed";
  query?: string;
  seedPaperId?: number;
  pipeline?: string;
}

export default function Recommendations() {
  const location = useLocation();

  const navState =
    (location.state as NavState | null) ?? {};

  const [mode] = useState<
    "keyword" | "title" | "seed"
  >(navState.mode ?? "keyword");

  const [queryText, setQueryText] = useState(
    navState.query ?? ""
  );

  const [seedPaperId] = useState<
    number | undefined
  >(navState.seedPaperId);

  const [seedPaper, setSeedPaper] =
    useState<Paper | null>(null);

  const initialPipeline =
    navState.pipeline &&
    IMPLEMENTED.has(navState.pipeline)
      ? navState.pipeline
      : "tfidf";

  const [pipeline, setPipeline] =
    useState(initialPipeline);

  const [topK, setTopK] = useState(10);

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [savedIds, setSavedIds] =
    useState<Set<number>>(new Set());

  // ==========================================================
  // LOAD SEED PAPER
  // ==========================================================

  useEffect(() => {
    if (seedPaperId === undefined) {
      setSeedPaper(null);
      return;
    }

    getPaper(seedPaperId)
      .then(setSeedPaper)
      .catch(() => setSeedPaper(null));
  }, [seedPaperId]);

  // ==========================================================
  // SEARCH
  // ==========================================================

  async function runSearch() {
    if (!IMPLEMENTED.has(pipeline)) {
      return;
    }

    if (mode === "seed") {
      if (seedPaperId === undefined) {
        setError("No seed paper was selected.");
        return;
      }
    } else {
      if (!queryText.trim()) {
        setError("Enter a search query.");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getRecommendations({
        pipeline,
        query:
          mode !== "seed"
            ? queryText.trim()
            : undefined,
        seedPaperId:
          mode === "seed"
            ? seedPaperId
            : undefined,
        topK,
      });

      setResults(data);
    } catch (err) {
      setResults([]);

      setError(
        err instanceof Error
          ? err.message
          : "Recommendation search failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // RERUN WHEN PIPELINE OR TOP K CHANGES
  // ==========================================================

  useEffect(() => {
    const hasInput =
      mode === "seed"
        ? seedPaperId !== undefined
        : queryText.trim().length > 0;

    if (!hasInput) {
      return;
    }

    runSearch();

    // The search intentionally uses the latest state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, topK]);

  // ==========================================================
  // SAVE
  // ==========================================================

  async function handleSave(paperId: number) {
    try {
      await saveToLibrary(paperId);

      setSavedIds((previous) => {
        const next = new Set(previous);
        next.add(paperId);
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save paper."
      );
    }
  }

  // ==========================================================
  // ACTIVE PIPELINE
  // ==========================================================

  const activeConfig =
    pipelineConfigs.find(
      (config) => config.id === pipeline
    ) ?? pipelineConfigs[0];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Recommendation results"
        title="Related papers"
        description="Find related academic papers using configurable recommendation pipelines."
      />

      {/* ====================================================== */}
      {/* SEARCH CONTROLS */}
      {/* ====================================================== */}

      <section className="surface mb-7 p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label className="filter-label">
                {mode === "seed"
                  ? "Seed document"
                  : mode === "title"
                    ? "Title query"
                    : "Keyword query"}
              </label>

              {mode === "seed" ? (
                <div className="rounded-md border border-line bg-navy px-3 py-2.5">
                  <p className="text-sm leading-6 text-ink">
                    {seedPaper?.title ??
                      `Paper #${seedPaperId}`}
                  </p>
                </div>
              ) : (
                <input
                  value={queryText}
                  onChange={(event) =>
                    setQueryText(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      runSearch();
                    }
                  }}
                  placeholder={
                    mode === "title"
                      ? "Enter a paper title…"
                      : "e.g. neural network text similarity"
                  }
                  className="ui-input"
                />
              )}
            </div>

            {mode !== "seed" && (
              <Button
                type="button"
                onClick={runSearch}
                disabled={
                  loading ||
                  !queryText.trim()
                }
              >
                {loading
                  ? "Searching…"
                  : "Search"}
              </Button>
            )}

            <label className="text-xs text-muted">
              <span className="mb-1.5 block">
                Results
              </span>

              <select
                value={topK}
                onChange={(event) =>
                  setTopK(
                    Number(event.target.value)
                  )
                }
                className="min-h-10 rounded-md border border-line bg-navy px-3 text-sm text-ink focus:border-gold focus:outline-none"
              >
                <option value={5}>
                  Top 5
                </option>

                <option value={10}>
                  Top 10
                </option>

                <option value={20}>
                  Top 20
                </option>
              </select>
            </label>
          </div>

          {/* Active pipeline summary */}
          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Active pipeline
                </span>

                <span className="rounded-full border border-line bg-navy px-2.5 py-1 text-xs font-medium text-ink">
                  {activeConfig.label}
                </span>
              </div>

              <p className="mt-1.5 text-xs leading-5 text-muted">
                {activeConfig.subtitle}
              </p>
            </div>

            <div className="w-full sm:w-64">
              <WeightBar
                weights={activeConfig.weights}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================== */}
      {/* PIPELINE SELECTOR */}
      {/* ====================================================== */}

      <section className="mb-7">
        <div className="mb-3">
          <p className="text-sm font-medium text-ink">
            Recommendation pipeline
          </p>

          <p className="mt-1 text-xs leading-5 text-muted">
            Choose how the system combines lexical,
            semantic, and metadata signals.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {pipelineConfigs.map((config) => {
            const implemented =
              IMPLEMENTED.has(config.id);

            const active =
              config.id === pipeline;

            return (
              <button
                key={config.id}
                type="button"
                disabled={!implemented}
                onClick={() => {
                  if (implemented) {
                    setPipeline(config.id);
                  }
                }}
                className={`group rounded-lg border p-4 text-left transition ${
                  active
                    ? "border-gold bg-gold/5"
                    : "border-line bg-surface hover:border-muted"
                } ${
                  !implemented
                    ? "cursor-not-allowed opacity-40"
                    : ""
                }`}
                title={
                  implemented
                    ? undefined
                    : "Not implemented"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        active
                          ? "text-ink"
                          : "text-ink"
                      }`}
                    >
                      {config.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted">
                      {config.subtitle}
                    </p>
                  </div>

                  {active && (
                    <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy">
                      Active
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <WeightBar
                    weights={config.weights}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ====================================================== */}
      {/* ERROR */}
      {/* ====================================================== */}

      {error && (
        <div className="status-error mb-5">
          {error}
        </div>
      )}

      {/* ====================================================== */}
      {/* RESULTS */}
      {/* ====================================================== */}

      {loading ? (
        <div className="empty-state">
          <p className="text-sm text-muted">
            Searching with{" "}
            {activeConfig.label}…
          </p>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title={
            mode === "seed"
              ? "No recommendations found."
              : queryText.trim()
                ? "No matching papers found."
                : "Start a recommendation search."
          }
          description={
            mode === "seed"
              ? "Try another seed paper or recommendation pipeline."
              : "Enter a query above and choose one of the six recommendation pipelines."
          }
        />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">
                Results
              </p>

              <p className="mt-1 text-xs text-muted">
                {results.length} paper
                {results.length === 1 ? "" : "s"} found
                using {activeConfig.label}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {results.map((result, index) => {
              const paper = result.paper;

              const isSaved =
                savedIds.has(paper.id);

              return (
                <article
                  key={paper.id}
                  className="surface p-5 transition-colors hover:border-muted"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-4">
                      {/* Rank */}
                      <div className="hidden shrink-0 pt-0.5 sm:block">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-navy text-xs font-semibold text-muted">
                          {index + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="text-base font-medium leading-6 text-ink">
                              {paper.title}
                            </h2>

                            {paper.author && (
                              <p className="mt-1 text-xs leading-5 text-muted">
                                {paper.author}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0">
                            <div className="rounded-md border border-line bg-navy px-3 py-2 text-right">
                              <p className="text-[10px] uppercase tracking-wide text-muted">
                                Score
                              </p>

                              <p className="mt-0.5 text-sm font-semibold text-ink">
                                {Number(
                                  result.score
                                ).toFixed(4)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {paper.abstract && (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
                            {paper.abstract}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          {paper.publication_year && (
                            <span>
                              {paper.publication_year}
                            </span>
                          )}

                          {paper.subject_category && (
                            <span>
                              {paper.subject_category}
                            </span>
                          )}

                          <span>
                            Paper #{paper.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-line pt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          handleSave(paper.id)
                        }
                        disabled={isSaved}
                      >
                        {isSaved
                          ? "Saved"
                          : "Save to library"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </PageShell>
  );
}