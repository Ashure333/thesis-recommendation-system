
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FileText, Search, Type } from "lucide-react";

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
import StaggerIn from "../../components/retro/StaggerIn";
import Pagination from "../../components/retro/Pagination";
import MathText from "../../components/MathText";
import PetFigure from "../../components/PetFigure";
import LayoutOptions from "../../components/LayoutOptions";
import PixelProgress from "../../components/retro/PixelProgress";
import { ArrowRight, Dot } from "../../components/retro/PixelIcons";
import { usePipelineMode } from "../../state/pipelineMode";
import { useSiteMode } from "../../state/siteMode";
import { useLayoutPrefs } from "../../state/layoutPrefs";
import { triggerSlimeAnimation } from "../../utils/slimeEvents";
import StatsForNerds from "../../components/StatsForNerds";
import AnnouncementsPanel from "../../components/AnnouncementsPanel";
import PageTabs from "../../components/PageTabs";
import ConnectionsPane from "../../components/ConnectionsPane";
import ConnectionsWorkbench from "../../components/ConnectionsWorkbench";
import PaneHandle, { usePaneWidth } from "../../components/ResizeHandle";
import ScoreBreakdown from "../../components/ScoreBreakdown";

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

/** The Diversify (MMR) checkbox's lambda: used by the search and the trace. */
const MMR_LAMBDA = 0.7;

const LEFT_PANE_MIN = 240;
const LEFT_PANE_MAX = 400;
const RIGHT_PANE_MIN = 260;
const RIGHT_PANE_MAX = 520;

const LEFT_PANE_KEY = "paperrec_pane_left";
const RIGHT_PANE_KEY = "paperrec_pane_right";

const IMPLEMENTED = new Set([
  "tfidf",
  "sbert",
  "tfidf_sbert",
  "tfidf_metadata",
  "sbert_metadata",
  "tfidf_sbert_metadata",
]);

const queryModes: {
  id: "keyword" | "title" | "seed";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "keyword", label: "Keyword", icon: Search },
  { id: "title", label: "Title", icon: Type },
  { id: "seed", label: "Seed", icon: FileText },
];

interface NavState {
  mode?: "keyword" | "title" | "seed";
  query?: string;
  seedPaperId?: number;
  pipeline?: string;
  /** Open straight onto the big Connections tab, centered here. */
  graphPaperId?: number;
  searchTab?: "results" | "connections" | "stats";
}

export default function Recommendations() {
  const location = useLocation();
  const { mode: siteMode } = useSiteMode();
  const { prefs } = useLayoutPrefs();

  const navState =
    (location.state as NavState | null) ?? {};

  /* Resizable pane widths (persisted per browser). */

  const [leftPaneW, resizeLeft] = usePaneWidth(
    LEFT_PANE_KEY,
    288,
    LEFT_PANE_MIN,
    LEFT_PANE_MAX,
  );

  const [rightPaneW, resizeRight] = usePaneWidth(
    RIGHT_PANE_KEY,
    384,
    RIGHT_PANE_MIN,
    RIGHT_PANE_MAX,
  );

  const { pipelineId: sharedPipeline, customWeights } = usePipelineMode();

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

  // Frozen at mount: the pipeline is chosen in the Repository filter console.
  const [pipeline] = useState(initialPipeline);

  const [topK, setTopK] = useState(10);

  // Opt-in MMR reranking: spreads near-duplicate papers apart while
  // keeping the same scored result set.
  const [diversify, setDiversify] = useState(false);

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
  // follows the result the user clicks (rank badge). A center passed
  // through navigation state (e.g. "Full view" from the Repository)
  // stands until the next search replaces it.
  const [graphPaperId, setGraphPaperId] = useState<number | null>(
    navState.graphPaperId ?? null
  );

  useEffect(() => {
    if (results.length === 0) {
      // Keep whatever is set — a nav-supplied center may still be
      // waiting for the first search; StrictMode re-runs are no-ops.
      return;
    }

    setGraphPaperId((current) =>
      current !== null && results.some((r) => r.paper.id === current)
        ? current
        : results[0].paper.id,
    );
  }, [results]);

  // Page-level view: results, the big Connections tab, or the math.
  const [searchTab, setSearchTab] = useState<
    "results" | "connections" | "stats"
  >(() => {
    if (navState.searchTab) {
      return navState.searchTab;
    }

    try {
      const stored = window.localStorage.getItem(
        "paperrec_search_tab"
      );

      return stored === "connections" || stored === "stats"
        ? stored
        : "results";
    } catch {
      return "results";
    }
  });

  function selectSearchTab(
    tab: "results" | "connections" | "stats"
  ) {
    setSearchTab(tab);

    try {
      window.localStorage.setItem("paperrec_search_tab", tab);
    } catch {
      // Best-effort.
    }
  }

    function renderResultsSection() {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border-[3px] border-gray-900 bg-white">

          <div className="flex shrink-0 items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-canvas px-3 py-2">
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

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {error && <div className="status-error">{error}</div>}

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 p-10">
                <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-ink">
                  <ArrowRight className="h-3 w-3 text-accent" />
                  Searching with {activeConfig.codename}
                </p>
                <PixelProgress value={null} stage="SCANNING CORPUS" className="max-w-xs" />
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                figure={<PetFigure size={80} />}
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
                        <div className="hidden shrink-0 sm:block">
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

                          <ScoreBreakdown
                            components={result.components}
                            className="mt-3 max-w-sm"
                          />

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
    );
  }

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

    // The pet zaps when the search fires.
    triggerSlimeAnimation("zap");

    // The local backend answers in milliseconds; hold the loading
    // state open long enough for the scanner to actually be seen.
    const startedAt = Date.now();

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
        ...(diversify ? { mmrLambda: MMR_LAMBDA } : {}),
        ...(pipeline === "custom"
          ? { weights: customWeights }
          : {}),
      });

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOAD_MS) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, MIN_LOAD_MS - elapsed),
        );
      }

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

/* Minimum loading-state duration so the scanner animation reads. */
const MIN_LOAD_MS = 900;
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
    <div className="mx-auto w-full max-w-[1560px]">
      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-cassette")!} />
      <PageHeader
        eyebrow="Search"
        title="Search the repository"
        description="Search with three query modes and six pipelines. The page shows results, a connections graph, and the ranking mathematics."
        action={<LayoutOptions />}
        icon={<Search className="h-4 w-4" />}
      />

      {/* Library mode: the search page carries the announcements,
          because the RE:SEARCH home button lands here. */}
      {siteMode === "library" && (
        <div className="mt-4">
          <AnnouncementsPanel compact />
        </div>
      )}

      {/* Page tabs: results, the big connections view, or the math */}

      <div className="mt-4">
        <PageTabs
          label="Search view"
          active={searchTab}
          onChange={selectSearchTab}
          options={[
            { id: "results", label: "Results" },
            { id: "connections", label: "Connections" },
            { id: "stats", label: "Stats for Nerds" },
          ]}
        />
      </div>


      {siteMode === "researcher" && (
        <>
      {searchTab !== "stats" && (
      <div
        className="mt-3 flex min-h-0 flex-col gap-3 lg:h-[calc(100dvh-20rem)] lg:min-h-[480px] lg:flex-row"
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

        {prefs.sidebar && (
        <aside
          className="w-full shrink-0 overflow-y-auto rounded border-[3px] border-gray-900 bg-white lg:w-[var(--pane-left)] lg:max-w-[var(--pane-left)]"
          data-tips="search-modes"
        >
          <div className="flex items-center gap-1.5 border-b-[3px] border-gray-900 bg-canvas px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted" />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
              Query console
            </p>
          </div>

          <div className="p-3">

          {/* Mode tabs */}
          <div
            className="flex gap-1 rounded border-[3px] border-gray-900 bg-canvas p-1"
            role="tablist"
            aria-label="Search mode"
          >
            {queryModes.map((queryMode) => {
              const Icon = queryMode.icon;
              const active = mode === queryMode.id;

              return (
                <button
                  key={queryMode.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={queryMode.label}
                  onClick={() => setMode(queryMode.id)}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded border-[2px] px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors pixel-ease ${
                    active
                      ? "border-gray-900 bg-accent text-onAccent shadow-[inset_0_-3px_0_rgba(0,0,0,0.3)]"
                      : "border-transparent text-muted hover:text-accent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {queryMode.label}
                </button>
              );
            })}
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

            <label
              className="mt-3 flex items-center gap-2 text-sm font-medium text-ink"
              data-pro-only
            >
              <input
                type="checkbox"
                checked={diversify}
                onChange={(event) =>
                  setDiversify(event.target.checked)
                }
                className="h-4 w-4"
              />
              Diversify (MMR)
            </label>
          </div>
          </div>
        </aside>
        )}

        {prefs.sidebar && (
        <PaneHandle
          label="Resize query panel"
          onResize={resizeLeft}
        />
        )}


  
 {/* ====================================================
            MIDDLE PANE — results (hidden on the Connections tab)
            ==================================================== */}

        {searchTab === "results" && renderResultsSection()}

        {searchTab === "results" && prefs.details && (
        <PaneHandle
          label="Resize similar-papers panel"
          direction="right"
          onResize={resizeRight}
        />
        )}

        {/* ====================================================
            RIGHT PANE — similar papers graph
            ==================================================== */}

        {searchTab === "results" && prefs.details && (
        <aside className="w-full shrink-0 overflow-y-auto rounded border-[3px] border-gray-900 bg-white lg:w-[var(--pane-right)]">
          {graphPaperId === null ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                NO CONNECTIONS YET
              </p>
              <p className="max-w-xs text-sm leading-6 text-muted">
                Run a search. The top result becomes the center of
                the connection graph. Click any result's rank badge
                to re-center.
              </p>
            </div>
          ) : (
            <ConnectionsPane
              paperId={graphPaperId}
              pipeline={pipeline}
              pipelineLabel={activeConfig.codename}
              weights={
                pipeline === "custom"
                  ? customWeights
                  : undefined
              }
            />
          )}
        </aside>
        )}

        {/* ====================================================
            CONNECTIONS TAB — the big similar-papers workbench
            ==================================================== */}

        {searchTab === "connections" && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border-[3px] border-gray-900 bg-white">
          {graphPaperId === null ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                NO CONNECTIONS YET
              </p>
              <p className="max-w-md text-sm leading-6 text-muted">
                Run a search, then click any result's rank badge to
                center the connection graph — or open "Full view"
                from a paper in the Repository.
              </p>
            </div>
          ) : (
            <ConnectionsWorkbench
              paperId={graphPaperId}
              pipeline={pipeline}
              pipelineLabel={activeConfig.codename}
              weights={
                pipeline === "custom"
                  ? customWeights
                  : undefined
              }
            />
          )}
        </section>
        )}
      </div>
      )}
        </>
      )}

      {/* LIBRARY MODE — the single-column search layout */}
      {siteMode === "library" && searchTab !== "stats" && (
        <div className="mt-3 flex flex-col gap-3">
                  <section
            className="rounded border-[3px] border-gray-900 bg-white p-4"
            data-library-search-bar
          >
            <div
              className="flex gap-1 rounded border-[3px] border-gray-900 bg-canvas p-1"
              role="tablist"
              aria-label="Search mode"
            >
              {queryModes.map((queryMode) => {
                const Icon = queryMode.icon;
                const active = mode === queryMode.id;

                return (
                  <button
                    key={queryMode.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={queryMode.label}
                    onClick={() => setMode(queryMode.id)}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded border-[2px] px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors pixel-ease ${
                      active
                        ? "border-gray-900 bg-accent text-onAccent shadow-[inset_0_-3px_0_rgba(0,0,0,0.3)]"
                        : "border-transparent text-muted hover:text-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {queryMode.label}
                  </button>
                );
              })}
            </div>

            {mode === "seed" ? (
              seedPaper ? (
                <div className="mt-4 rounded border-[3px] border-gray-900 bg-field px-3 py-2.5">
                  <p className="truncate text-base leading-7 text-ink">
                    {seedPaper.title ?? `Paper #${seedPaperId}`}
                  </p>
                </div>
              ) : (
                <Link
                  to="/repository"
                  state={{ selectSeed: true, pipeline }}
                  className="ui-input mt-4 flex items-center text-base text-muted hover:border-gray-900 hover:text-ink"
                >
                  Choose a paper from the repository
                </Link>
              )
            ) : (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
                  aria-label={
                    mode === "title"
                      ? "Title query"
                      : "Keyword query"
                  }
                  className="ui-input min-w-0 flex-1 px-4 py-3 text-base"
                />

                <button
                  type="button"
                  onClick={runSearch}
                  disabled={loading || !queryText.trim()}
                  className="ui-button ui-button-primary shrink-0"
                >
                  <Search className="h-4 w-4" />
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>
            )}

            {mode !== "seed" && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label
                  className="flex items-center gap-2 text-sm font-medium text-ink"
                  htmlFor="library-topk"
                >
                  Results (top-K)
                  <select
                    id="library-topk"
                    value={topK}
                    onChange={(event) =>
                      setTopK(Number(event.target.value))
                    }
                    className="min-h-9 rounded border-[3px] border-gray-900 bg-field px-2 py-1 text-sm font-medium text-ink"
                  >
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={20}>Top 20</option>
                  </select>
                </label>

                <span className="ml-auto font-mono text-xs text-muted">
                  Ranked by {activeConfig.codename}
                </span>
              </div>
            )}
          </section>
          {/* SEARCH BAR — one full-width card */}


          {/* RESULTS — full width */}
          {searchTab === "results" && renderResultsSection()}

          {/* SIMILAR PAPERS — a section below the results */}
          {searchTab === "results" && graphPaperId !== null && (
            <section className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">
              <div className="flex items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink">
                  Similar papers
                </p>

                <span className="font-mono text-xs text-muted">
                  {activeConfig.codename}
                </span>
              </div>

              <ConnectionsWorkbench
                paperId={graphPaperId}
                pipeline={pipeline}
                pipelineLabel={activeConfig.codename}
                weights={
                  pipeline === "custom"
                    ? customWeights
                    : undefined
                }
              />
            </section>
          )}

          {/* CONNECTIONS TAB — full workbench */}
          {searchTab === "connections" && graphPaperId === null && (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded border-[3px] border-gray-900 bg-white p-6 text-center">
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                NO CONNECTIONS YET
              </p>
              <p className="max-w-md text-sm leading-6 text-muted">
                Run a search, then click any result's rank badge to
                center the connection graph.
              </p>
            </div>
          )}

          {searchTab === "connections" && graphPaperId !== null && (
            <section className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">
              <ConnectionsWorkbench
                paperId={graphPaperId}
                pipeline={pipeline}
                pipelineLabel={activeConfig.codename}
                weights={
                  pipeline === "custom"
                    ? customWeights
                    : undefined
                }
              />
            </section>
          )}
        </div>
      )}

      {/* STATS FOR NERDS TAB — the live computation trace */}
      {searchTab === "stats" && (
        <section className="mt-4">
          <StatsForNerds
            inputs={{
              mode,
              query: queryText,
              seedPaperId,
              topK,
              mmrLambda: diversify ? MMR_LAMBDA : undefined,
            }}
            contextNote="The active pipeline, its live weights, and the live trace that produced your ranking — expand it to walk the very query above through every step."
          />
        </section>
      )}

    </div>
  );
}