/**
 * CONNECTIONS WORKBENCH — the shared similar-papers surface.
 *
 * Four separate views — GRAPH, PRIOR WORKS, DERIVATIVE WORKS,
 * CONTRAST — over two scopes: LOCAL (the repository graph + cached
 * citations) and WEB (live OpenAlex). Used large on the Search
 * page's Connections tab and compact inside the right pane / the
 * Repository record tab.
 */

import { useEffect, useMemo, useState } from "react";

import {
  getPaper,
  getSimilarPapersGraph,
  getWebConnections,
  type DialWeights,
  type Paper,
  type SimilarPapersGraph,
  type WebConnections,
} from "../api";
import ConnectedPapersGraph from "./ConnectedPapersGraph";
import ContrastPanel from "./ContrastPanel";
import LocalWorksList from "./LocalWorksList";
import WebContrast from "./WebContrast";
import WebGraph from "./WebGraph";
import WebWorksList from "./WebWorksList";

type Scope = "local" | "web";
type View = "graph" | "prior" | "derivative" | "contrast";

const SCOPE_KEY = "paperrec_connections_scope";
const VIEW_KEY = "paperrec_similar_tab";

const VIEWS: readonly View[] = [
  "graph",
  "prior",
  "derivative",
  "contrast",
] as const;

const VIEW_LABELS: Record<View, string> = {
  graph: "Graph",
  prior: "Prior works",
  derivative: "Derivative works",
  contrast: "Contrast",
};

function readStored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  try {
    const stored = window.localStorage.getItem(key);

    if (stored && (allowed as readonly string[]).includes(stored)) {
      return stored as T;
    }
  } catch {
    // Storage unavailable — fall through to the default.
  }

  return fallback;
}

export default function ConnectionsWorkbench({
  paperId,
  pipeline,
  pipelineLabel,
  weights,
  defaultTopK = 20,
  compact = false,
  onExpand,
}: {
  paperId: number;
  pipeline: string;
  pipelineLabel: string;
  weights?: DialWeights;
  defaultTopK?: number;
  compact?: boolean;
  /** When given, a "Full view" affordance is shown (compact panes). */
  onExpand?: () => void;
}) {
  const [scope, setScope] = useState<Scope>(() =>
    readStored(SCOPE_KEY, ["local", "web"] as const, "local")
  );
  const [view, setView] = useState<View>(() =>
    readStored(VIEW_KEY, VIEWS, "graph")
  );
  const [topK, setTopK] = useState(defaultTopK);

  const [localGraph, setLocalGraph] = useState<SimilarPapersGraph | null>(
    null
  );
  const [localError, setLocalError] = useState("");

  const [webData, setWebData] = useState<WebConnections | null>(null);
  const [webCenter, setWebCenter] = useState<Paper | null>(null);
  const [webError, setWebError] = useState("");

  const [activeWorkKey, setActiveWorkKey] = useState<string | null>(null);
  const [focusedPaperId, setFocusedPaperId] = useState<number | null>(null);

  const weightsKey = weights
    ? `${weights.tfidf}/${weights.sbert}/${weights.metadata}`
    : "";

  function persist(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Best-effort.
    }
  }

  // ----------------------------------------------------------
  // Data: local graph (lists, ranks, highlight sets)
  // ----------------------------------------------------------

  useEffect(() => {
    if (scope !== "local") {
      return;
    }

    let cancelled = false;
    setLocalError("");

    const timer = window.setTimeout(() => {
      getSimilarPapersGraph(paperId, pipeline, topK, weights)
        .then((data) => {
          if (!cancelled) {
            setLocalGraph(data);
          }
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setLocalError(error.message);
          }
        });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, paperId, pipeline, topK, weightsKey]);

  // ----------------------------------------------------------
  // Data: web neighbourhood (live OpenAlex)
  // ----------------------------------------------------------

  useEffect(() => {
    if (scope !== "web") {
      return;
    }

    let cancelled = false;
    setWebError("");
    setWebData(null);
    setWebCenter(null);

    getPaper(paperId)
      .then((paper) => {
        if (!cancelled) {
          setWebCenter(paper);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWebCenter(null);
        }
      });

    getWebConnections(paperId)
      .then((data) => {
        if (!cancelled) {
          setWebData(data);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setWebError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scope, paperId]);

  // New paper or scope -> drop stale focus.
  useEffect(() => {
    setActiveWorkKey(null);
    setFocusedPaperId(null);
  }, [paperId, scope]);

  // ----------------------------------------------------------
  // Derived values
  // ----------------------------------------------------------

  const rankById = useMemo(() => {
    const ranks = new Map<number, number>();

    if (!localGraph) {
      return ranks;
    }

    let rank = 0;

    for (const node of localGraph.nodes) {
      if (node.relationship === "similar") {
        rank += 1;
        ranks.set(node.id, rank);
      }
    }

    return ranks;
  }, [localGraph]);

  const activeWorkIds = useMemo(() => {
    if (!localGraph || !activeWorkKey) {
      return [] as number[];
    }

    const work = [
      ...localGraph.prior_works,
      ...localGraph.derivative_works,
    ].find((entry) => entry.work_id === activeWorkKey);

    return work?.graph_paper_ids ?? [];
  }, [localGraph, activeWorkKey]);

  const localPrior = localGraph?.prior_works ?? [];
  const localDerivative = localGraph?.derivative_works ?? [];
  const webPrior = webData?.prior_works ?? [];
  const webDerivative = webData?.derivative_works ?? [];

  const counts: Record<View, number | null> = {
    graph: null,
    prior:
      scope === "local" ? localPrior.length : webPrior.length || null,
    derivative:
      scope === "local"
        ? localDerivative.length
        : webDerivative.length || null,
    contrast: null,
  };

  // ----------------------------------------------------------
  // Shared loading / error helpers
  // ----------------------------------------------------------

  const localPending = scope === "local" && localGraph === null;
  const webPending = scope === "web" && webData === null && !webError;

  function Pending({ message }: { message: string }) {
    return (
      <p className="p-6 text-center font-mono text-xs tracking-[0.15em] text-muted">
        {message}
      </p>
    );
  }

  function ErrorPanel({
    message,
    hint,
  }: {
    message: string;
    hint?: string;
  }) {
    return (
      <div className="p-4">
        <p className="status-error text-sm" role="alert">
          {message}
        </p>

        {hint && (
          <p className="mt-2 text-xs leading-5 text-muted">{hint}</p>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------
  // View bodies
  // ----------------------------------------------------------

  function renderGraph() {
    if (scope === "local") {
      if (localError) {
        return <ErrorPanel message={localError} />;
      }

      return (
        <ConnectedPapersGraph
          paperId={paperId}
          pipeline={pipeline}
          topK={topK}
          weights={weights}
          hideClusterSections
          hideRankedList
          widened={!compact}
          highlightPaperIds={activeWorkIds}
          onSelectNode={setFocusedPaperId}
        />
      );
    }

    if (webError) {
      return (
        <ErrorPanel
          message={webError}
          hint="The WEB scope reads live from OpenAlex; without a DOI, or while the API is unreachable, switch back to the LOCAL scope — the repository graph always works offline."
        />
      );
    }

    if (webPending || !webCenter) {
      return <Pending message="QUERYING OPENALEX…" />;
    }

    return (
      <WebGraph
        centerTitle={webCenter.title}
        prior={webPrior}
        derivative={webDerivative}
        activeKey={activeWorkKey}
        onActiveKey={setActiveWorkKey}
        edges={webData?.edges}
        widened={!compact}
      />
    );
  }

  function renderWorks(side: "prior" | "derivative") {
    const isPrior = side === "prior";

    if (scope === "local") {
      if (localError) {
        return <ErrorPanel message={localError} />;
      }

      if (localPending) {
        return <Pending message="READING CACHED CITATIONS…" />;
      }

      return (
        <LocalWorksList
          side={side}
          works={isPrior ? localPrior : localDerivative}
          activeKey={activeWorkKey}
          onActiveKey={setActiveWorkKey}
          onShowInGraph={() => {
            setView("graph");
            persist(VIEW_KEY, "graph");
          }}
          rankById={rankById}
          startId={localGraph?.start_id ?? null}
          focusedPaperId={focusedPaperId}
          onFocusPaper={setFocusedPaperId}
          widened={!compact}
        />
      );
    }

    if (webError) {
      return (
        <ErrorPanel
          message={webError}
          hint="The WEB scope reads live from OpenAlex; switch back to LOCAL when offline."
        />
      );
    }

    if (webPending) {
      return <Pending message="QUERYING OPENALEX…" />;
    }

    return (
      <WebWorksList
        side={side}
        works={isPrior ? webPrior : webDerivative}
        activeKey={activeWorkKey}
        onActiveKey={setActiveWorkKey}
        onShowInGraph={() => {
          setView("graph");
          persist(VIEW_KEY, "graph");
        }}
        widened={!compact}
      />
    );
  }

  function renderContrast() {
    if (scope === "local") {
      return (
        <ContrastPanel
          centerId={paperId}
          pipeline={pipeline}
          pipelineLabel={pipelineLabel}
          topK={topK}
          weights={weights}
        />
      );
    }

    if (webError) {
      return <ErrorPanel message={webError} />;
    }

    if (webPending || !webCenter) {
      return <Pending message="QUERYING OPENALEX…" />;
    }

    return (
      <WebContrast
        center={webCenter}
        prior={webPrior}
        derivative={webDerivative}
      />
    );
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="flex flex-col" data-connections-workbench>
      {/* HEADER — view tabs + scope switch */}
      <div
        className={`flex shrink-0 flex-col gap-2 border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5 ${
          compact ? "" : "lg:flex-row lg:items-center lg:justify-between"
        }`}
      >
        <div
          role="tablist"
          aria-label="Similar papers view"
          className="flex flex-wrap gap-1"
        >
          {VIEWS.map((option) => {
            const active = view === option;
            const count = counts[option];

            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setView(option);
                  persist(VIEW_KEY, option);
                }}
                className={`rounded border-[3px] border-gray-900 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors pixel-ease ${
                  active
                    ? "bg-accent text-onAccent"
                    : "bg-white text-ink hover:bg-accentSoft"
                }`}
              >
                {VIEW_LABELS[option]}
                {count !== null && count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Connections scope"
            className="flex rounded border-[3px] border-gray-900 bg-white p-0.5"
          >
            {(["local", "web"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={scope === option}
                aria-label={`${option} scope`}
                onClick={() => {
                  setScope(option);
                  persist(SCOPE_KEY, option);
                }}
                className={`rounded px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors pixel-ease ${
                  scope === option
                    ? "bg-accent text-onAccent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {option === "local" ? "Local" : "Web"}
              </button>
            ))}
          </div>

          {scope === "local" ? (
            <div className="flex items-center gap-2">
              <select
                value={topK}
                onChange={(event) =>
                  setTopK(Number(event.target.value))
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
                {pipelineLabel}
              </span>
            </div>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              Live · OpenAlex
            </span>
          )}

          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="rounded border-[3px] border-gray-900 bg-white px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink transition-colors pixel-ease hover:bg-accent hover:text-onAccent"
            >
              Full view
            </button>
          )}
        </div>
      </div>

      {/* CONTENT — scrolls inside the pane so tall graphs and their
          details pop-up are never clipped by the pane frame */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === "graph"
          ? renderGraph()
          : view === "prior"
            ? renderWorks("prior")
            : view === "derivative"
              ? renderWorks("derivative")
              : renderContrast()}
      </div>
    </div>
  );
}
