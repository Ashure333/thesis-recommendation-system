
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  getRecommendations,
  getPaper,
  saveToLibrary,
  SearchResult,
  Paper,
} from "../../api";

import {
  pipelineConfigs,
  customPipelineConfig,
} from "../../data/pipelineConfigs";
import PipelineDials from "../../components/PipelineDials";
import WeightBar from "../../components/WeightBar";
import StaggerIn from "../../components/retro/StaggerIn";
import Pagination from "../../components/retro/Pagination";
import MathText from "../../components/MathText";
import { ArrowRight, Dot } from "../../components/retro/PixelIcons";
import { usePipelineMode } from "../../state/pipelineMode";
import PipelineMath from "../../components/PipelineMath";
import ConnectedPapersGraph from "../../components/ConnectedPapersGraph";

import {
  Button,
  EmptyState,
  PageHeader,
} from "../../components/ui";
import HuntItem from "../../components/retro/HuntItem";
import { HUNT_ITEMS } from "../../data/hunt";

/* ------------------------------------------------------------
   RESIZABLE PANES
   The query and similar-papers panes are user-resizable on wide
   screens; widths persist per browser. Bounds keep the results
   pane usable at any layout.
   ------------------------------------------------------------ */

const LEFT_PANE_MIN = 200;
const LEFT_PANE_MAX = 400;
const RIGHT_PANE_MIN = 260;
const RIGHT_PANE_MAX = 520;

const LEFT_PANE_KEY = "paperrec_pane_left";
const RIGHT_PANE_KEY = "paperrec_pane_right";

function readPaneWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      const raw = Number(stored);
      if (Number.isFinite(raw)) {
        return Math.max(min, Math.min(max, raw));
      }
    }
  } catch {
    // best-effort
  }
  return fallback;
}

function PaneHandle({
  label,
  onResize,
}: {
  label: string;
  onResize: (delta: number) => void;
}) {
  const startXRef = useRef<number | null>(null);
  const lastDeltaRef = useRef(0);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    startXRef.current = event.clientX;
    lastDeltaRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    const delta = event.clientX - startXRef.current;
    onResize(delta - lastDeltaRef.current);
    lastDeltaRef.current = delta;
  }

  function handlePointerUp() {
    startXRef.current = null;
    lastDeltaRef.current = 0;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="group hidden w-2 shrink-0 cursor-col-resize touch-none items-center justify-center lg:flex"
    >
      <span className="h-10 w-1 rounded-full bg-gray-300 transition-colors pixel-ease group-hover:bg-accent group-active:bg-accent" />
    </div>
  );
}

const IMPLEMENTED = new Set([
  "tfidf",
  "sbert",
  "tfidf_sbert",
  "tfidf_metadata",
  "sbert_metadata",
  "tfidf_sbert_metadata",
]);

const FOCUS_INSET =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

const queryModes: { id: "keyword" | "title" | "seed"; label: string }[] = [
  { id: "keyword", label: "Keyword" },
  { id: "title", label: "Title" },
  { id: "seed", label: "Seed" },
];

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

  /* Resizable pane widths (persisted per browser). */
  const [leftPaneW, setLeftPaneW] = useState(() =>
    readPaneWidth(LEFT_PANE_KEY, 288, LEFT_PANE_MIN, LEFT_PANE_MAX),
  );
  const [rightPaneW, setRightPaneW] = useState(() =>
    readPaneWidth(RIGHT_PANE_KEY, 384, RIGHT_PANE_MIN, RIGHT_PANE_MAX),
  );

  function resizeLeft(delta: number) {
    setLeftPaneW((current) => {
      const next = Math.max(
        LEFT_PANE_MIN,
        Math.min(LEFT_PANE_MAX, current + delta),
      );
      try {
        window.localStorage.setItem(LEFT_PANE_KEY, String(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }

  function resizeRight(delta: number) {
    setRightPaneW((current) => {
      const next = Math.max(
        RIGHT_PANE_MIN,
        Math.min(RIGHT_PANE_MAX, current + delta),
      );
      try {
        window.localStorage.setItem(RIGHT_PANE_KEY, String(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }

  const {
    pipelineId: sharedPipeline,
    setPipelineId,
    customWeights,
    setCustomWeights,
  } = usePipelineMode();

  const [mode, setMode] = useState<
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

  const isSelectable = (id?: string | null): id is string =>
    Boolean(id) && (IMPLEMENTED.has(id!) || id === "custom");

  const initialPipeline = isSelectable(navState.pipeline)
    ? navState.pipeline
    : isSelectable(sharedPipeline)
      ? sharedPipeline
      : "tfidf";

  const [pipeline, setPipeline] =
    useState(initialPipeline);

  // The preset to return to when leaving the Dials tab.
  const [lastPreset, setLastPreset] = useState(
    initialPipeline === "custom"
      ? "tfidf_sbert_metadata"
      : initialPipeline
  );

  const [topK, setTopK] = useState(10);

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [page, setPage] = useState(1);

  // New result set → back to page 1.
  useEffect(() => {
    setPage(1);
  }, [results]);

  // Similar-papers graph center: defaults to the top result and
  // follows the result the user clicks (rank badge).
  const [graphPaperId, setGraphPaperId] = useState<number | null>(null);

  // How many labeled links the graph shows; follows the selected
  // top-K upward, and can go beyond 20 links.
  const [graphLinks, setGraphLinks] = useState(20);

  useEffect(() => {
    setGraphLinks((current) => Math.max(current, topK));
  }, [topK]);

  useEffect(() => {
    if (results.length === 0) {
      setGraphPaperId(null);
      return;
    }

    setGraphPaperId((current) =>
      current !== null && results.some((r) => r.paper.id === current)
        ? current
        : results[0].paper.id,
    );
  }, [results]);

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
    if (pipeline !== "custom" && !IMPLEMENTED.has(pipeline)) {
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
        ...(pipeline === "custom"
          ? { weights: customWeights }
          : {}),
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
  // RERUN WHEN THE DIALS MOVE (custom pipeline)
  //
  // A dial drag emits many updates; debounce so exactly one
  // search fires once the user stops turning.
  // ==========================================================

  useEffect(() => {
    if (pipeline !== "custom") {
      return;
    }

    const hasInput =
      mode === "seed"
        ? seedPaperId !== undefined
        : queryText.trim().length > 0;

    if (!hasInput) {
      return;
    }

    const timeout = window.setTimeout(() => {
      runSearch();
    }, 500);

    return () => window.clearTimeout(timeout);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customWeights]);

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
    pipeline === "custom"
      ? customPipelineConfig(customWeights)
      : pipelineConfigs.find(
          (config) => config.id === pipeline
        ) ?? pipelineConfigs[0];

  // ==========================================================
  // PAGINATION (5 results per page)
  // ==========================================================

  const RESULTS_PAGE_SIZE = 5;
  const pageCount = Math.max(
    1,
    Math.ceil(results.length / RESULTS_PAGE_SIZE),
  );
  const pageStart = (page - 1) * RESULTS_PAGE_SIZE;
  const pagedResults = results.slice(
    pageStart,
    pageStart + RESULTS_PAGE_SIZE,
  );

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-cassette")!} />
      <PageHeader
        eyebrow="Search"
        title="Search the repository"
        description="Query modes, six pipelines, live results, and a similar-papers graph: three panes, reference-manager style."
      />

      <div
        className="mt-6 flex min-h-0 flex-col gap-4 lg:h-[calc(100dvh-19rem)] lg:min-h-[480px] lg:flex-row"
        style={
          {
            "--pane-left": `${leftPaneW}px`,
            "--pane-right": `${rightPaneW}px`,
          } as React.CSSProperties
        }
      >
        {/* ====================================================
            LEFT PANE — query controls
            ==================================================== */}

        <aside
          className="w-full shrink-0 overflow-y-auto rounded border-[3px] border-gray-900 bg-white p-4 lg:w-[var(--pane-left)]"
          data-tips="search-modes"
        >
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
            Query
          </p>

          {/* Mode tabs */}
          <div className="flex gap-0.5" role="tablist" aria-label="Search mode">
            {queryModes.map((queryMode) => (
              <button
                key={queryMode.id}
                type="button"
                role="tab"
                aria-selected={mode === queryMode.id}
                onClick={() => setMode(queryMode.id)}
                className={`flex-1 rounded border-[3px] border-gray-900 px-2 py-1.5 text-sm font-semibold transition-colors pixel-ease ${
                  mode === queryMode.id
                    ? "bg-accent text-onAccent"
                    : "bg-surface text-ink hover:bg-accentSoft"
                }`}
              >
                {queryMode.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <label className="filter-label">
              {mode === "seed"
                ? "Seed document"
                : mode === "title"
                  ? "Title query"
                  : "Keyword query"}
            </label>

            {mode === "seed" ? (
              seedPaper ? (
                <div className="rounded border-[3px] border-gray-900 bg-field px-3 py-2.5">
                  <p className="truncate text-base leading-7 text-ink">
                    {seedPaper.title ?? `Paper #${seedPaperId}`}
                  </p>
                </div>
              ) : (
                <Link
                  to="/repository"
                  state={{ selectSeed: true, pipeline }}
                  className="ui-input flex items-center text-base text-muted hover:border-gray-900 hover:text-ink"
                >
                  Choose a paper from the repository
                </Link>
              )
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
                className="ui-input text-base"
              />
            )}
          </div>

          {mode !== "seed" && (
            <Button
              type="button"
              onClick={runSearch}
              disabled={loading || !queryText.trim()}
              fullWidth
              className="mt-3"
            >
              {loading ? "Searching…" : "Search"}
            </Button>
          )}

          <div className="mt-4" data-tips="rec-topk">
            <label className="filter-label" htmlFor="topk">
              Results (top-K)
            </label>
            <select
              id="topk"
              value={topK}
              onChange={(event) =>
                setTopK(Number(event.target.value))
              }
              className="min-h-10 w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2 text-sm font-medium text-ink"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
          </div>

          {/* Pipeline selector */}
          <div className="mt-5 border-t-[2px] border-gray-200 pt-4" data-tips="rec-pipelines">
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
              Pipeline
            </p>

            {/* Presets / Dials tabs */}
            <div className="mb-2 flex">
              <button
                type="button"
                onClick={() => {
                  if (pipeline === "custom") {
                    setPipeline(lastPreset);
                    setPipelineId(lastPreset);
                  }
                }}
                aria-pressed={pipeline !== "custom"}
                className={`rounded-l border-[3px] border-gray-900 px-3 py-1 text-sm font-semibold transition pixel-ease ${FOCUS_INSET} ${
                  pipeline !== "custom"
                    ? "bg-accent text-onAccent"
                    : "bg-surface text-ink hover:bg-accentSoft"
                }`}
              >
                Presets
              </button>

              <button
                type="button"
                onClick={() => {
                  setPipeline("custom");
                  setPipelineId("custom");
                }}
                aria-pressed={pipeline === "custom"}
                className={`-ml-[3px] rounded-r border-[3px] border-gray-900 px-3 py-1 text-sm font-semibold transition pixel-ease ${FOCUS_INSET} ${
                  pipeline === "custom"
                    ? "bg-accent text-onAccent"
                    : "bg-surface text-ink hover:bg-accentSoft"
                }`}
              >
                Dials
              </button>
            </div>

            {pipeline === "custom" ? (
              <PipelineDials
                value={customWeights}
                onChange={setCustomWeights}
              />
            ) : (
            <div className="space-y-1.5">
              {pipelineConfigs.map((config) => {
                const implemented = IMPLEMENTED.has(config.id);
                const active = config.id === pipeline;

                return (
                  <button
                    key={config.id}
                    type="button"
                    disabled={!implemented}
                    onClick={() => {
                      if (implemented) {
                        setPipeline(config.id);
                        setPipelineId(config.id);
                        setLastPreset(config.id);
                      }
                    }}
                    title={implemented ? undefined : "Not implemented"}
                    className={`w-full rounded border-[3px] border-gray-900 px-2.5 py-2 text-left text-sm font-semibold transition pixel-ease ${
                      active
                        ? "bg-accent"
                        : "bg-surface hover:bg-accentSoft"
                    } ${!implemented ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <div
                      className={`flex items-center justify-between gap-2 rounded border-[2px] px-2 py-1 ${
                        active
                          ? "border-white/40 bg-white/25"
                          : "border-gray-900 bg-surfaceAlt"
                      }`}
                    >
                      <span
                        className={`whitespace-nowrap text-sm font-semibold ${
                          active ? "text-onAccent" : "text-ink"
                        }`}
                      >
                        {config.codename}
                      </span>
                      <span
                        className={`truncate font-mono text-xs font-bold tracking-[0.12em] ${
                          active ? "text-onAccent" : "text-muted"
                        }`}
                      >
                        {config.label}
                      </span>
                    </div>

                    <div className="mt-1.5" data-tips="weight-bar">
                      <WeightBar weights={config.weights} />
                    </div>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        </aside>

        <PaneHandle
          label="Resize query panel"
          onResize={resizeLeft}
        />

        {/* ====================================================
            MIDDLE PANE — results
            ==================================================== */}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border-[3px] border-gray-900 bg-white">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink">
              Results
            </p>

            <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted">
              <Dot className="animate-rec h-2 w-2 shrink-0 text-gold" />
              <span className="truncate">
                {results.length} found · {activeConfig.codename}
              </span>
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {error && <div className="status-error">{error}</div>}

            {loading ? (
              <div className="flex items-center justify-center p-10">
                <p className="animate-blink flex items-center justify-center gap-1.5 text-sm font-bold text-muted">
                  <ArrowRight className="h-3 w-3" />
                  Searching with {activeConfig.codename}…
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
                    : "Enter a query in the left pane and choose one of the six pipelines."
                }
              />
            ) : (
              pagedResults.map((result, index) => {
                const paper = result.paper;
                const rank = pageStart + index + 1;

                const isSaved =
                  savedIds.has(paper.id);

                return (
                  <StaggerIn key={paper.id} index={pageStart + index}>
                    <article
                      className="surface scan-sweep p-5 transition-colors pixel-ease hover:border-muted"
                    >
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-4">
                        {/* Rank — click to center the similar-papers graph */}
                        <div className="hidden shrink-0 pt-0.5 sm:block">
                          <button
                            type="button"
                            onClick={() => setGraphPaperId(paper.id)}
                            title="Show similar papers for this result"
                            aria-label={`Show similar papers for ${paper.title}`}
                            className={`flex h-8 w-8 items-center justify-center rounded border-[2px] border-gray-900 text-xs font-bold transition-colors pixel-ease ${
                              graphPaperId === paper.id
                                ? "bg-accent text-onAccent"
                                : "bg-surface text-ink hover:bg-accentSoft"
                            }`}
                          >
                            {rank}
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h2 className="text-base font-bold leading-6 text-ink">
                                <MathText text={paper.title} />
                              </h2>

                              {paper.author && (
                                <p className="mt-1 text-xs leading-5 text-muted">
                                  {paper.author}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0">
                              <div className="rounded border-[3px] border-gray-900 bg-surface px-3 py-2 text-right">
                                <p className="text-xs font-bold text-muted">
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
                              <MathText text={paper.abstract} />
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

                      <div className="flex justify-end border-t border-gray-200 pt-3">
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
                  </StaggerIn>
                );
              })
            )}
          </div>

          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            total={results.length}
            pageSize={RESULTS_PAGE_SIZE}
            className="shrink-0 border-t-[3px] border-gray-900"
          />
        </section>

        <PaneHandle
          label="Resize similar-papers panel"
          onResize={resizeRight}
        />

        {/* ====================================================
            RIGHT PANE — similar papers graph
            ==================================================== */}

        <aside className="w-full shrink-0 overflow-y-auto rounded border-[3px] border-gray-900 bg-white lg:w-[var(--pane-right)]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink">
              Similar papers
            </p>

            <div className="flex items-center gap-2">
              <select
                value={graphLinks}
                onChange={(event) =>
                  setGraphLinks(Number(event.target.value))
                }
                aria-label="Number of graph links"
                className="min-h-7 rounded border-[2px] border-gray-900 bg-surface px-1.5 py-0.5 font-mono text-xs font-bold text-ink"
              >
                {[10, 20, 30, 40].map((count) => (
                  <option key={count} value={count}>
                    {count} links
                  </option>
                ))}
              </select>

              <span className="font-mono text-xs text-muted">
                {activeConfig.codename}
              </span>
            </div>
          </div>

          {graphPaperId === null ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                NO GRAPH YET
              </p>
              <p className="max-w-xs text-sm leading-6 text-muted">
                Run a search. The top result becomes the graph
                center. Click any result's rank badge to re-center.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <p className="mb-3 text-xs leading-5 text-muted">
                Papers ranked similar to the highlighted result
                (ink node = center), re-centered by clicking a rank
                badge. Small dots suggest even more connections.
              </p>

              <div className="overflow-hidden rounded border-[2px] border-gray-900 bg-white">
                <ConnectedPapersGraph
                  paperId={graphPaperId}
                  pipeline={pipeline}
                  topK={graphLinks}
                />
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Pipeline math — full width below the panes */}
      <div className="mt-4">
        <PipelineMath
          pipelineId={pipeline}
          inputs={{
            mode,
            query: queryText,
            seedPaperId,
            topK,
          }}
        />
      </div>
    </div>
  );
}