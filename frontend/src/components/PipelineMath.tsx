import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getRecommendationTrace,
  TraceEvent,
} from "../api";
import {
  pipelineConfigs,
  type DialAllocation,
  type PipelineConfig,
} from "../data/pipelineConfigs";
import { ArrowDown, ArrowUp, Dot } from "./retro/PixelIcons";

export interface PipelineMathInputs {
  mode: "keyword" | "title" | "seed";
  query?: string;
  seedPaperId?: number;
  topK: number;
  /** Set when Diversify (MMR) is on, so the trace explains that ranking. */
  mmrLambda?: number;
}

interface PipelineMathProps {
  pipelineId: string;
  inputs?: PipelineMathInputs | null;
  /** Preset config override for the custom (dial) pipeline. */
  configOverride?: PipelineConfig;
  /** Dial allocation (0..100 per signal) for pipeline="custom". */
  weights?: DialAllocation;
  /** Open the trace card immediately (Stats for Nerds tab). */
  defaultOpen?: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  input: "Inputs",
  prepared_query: "Prepared query",
  candidates: "Candidate set",
  "component.tfidf": "TF-IDF scores",
  "component.sbert": "S-BERT scores",
  "component.metadata.signals": "Metadata signals",
  normalization: "Normalization",
  combine: "Combination",
  rank: "Final ranking",
  "rerank.mmr": "MMR diversification",
};

function fmt(value: unknown): string {
  if (typeof value === "number") {
    return value.toFixed(4);
  }
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

/** Integer counts (top_k, dimensions, paper counts) print as-is, not as 10.0000. */
function fmtCount(value: unknown): string {
  return typeof value === "number" ? String(value) : fmt(value);
}

function truncate(title: string, max = 48): string {
  return title.length > max
    ? `${title.slice(0, max - 1)}…`
    : title;
}

function WeightsChip({ weights }: { weights: Record<string, unknown> }) {
  const entries = Object.entries(weights).filter(
    ([, value]) => (value as number) > 0
  );

  return (
    <span className="inline-flex flex-wrap gap-1">
      {entries.map(([name, value]) => (
        <span
          key={name}
          className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 text-xs font-bold text-ink"
        >
          {name}={fmt(value)}
        </span>
      ))}
    </span>
  );
}

function TermChips({ terms }: { terms: unknown }) {
  if (!Array.isArray(terms) || terms.length === 0) {
    return <span className="text-muted">none</span>;
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {terms.map((term, index) => {
        const [word, weight] = term as [string, number];
        return (
          <span
            key={index}
            className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-xs text-ink"
          >
            {word} <span className="text-muted">·</span> {weight.toFixed(4)}
          </span>
        );
      })}
    </span>
  );
}

function BoundRow({ label, data }: { label: string; data: unknown }) {
  const bounds = (data ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink">
      <span className="font-bold text-muted">{label}</span>
      <span className="font-mono">
        min = {fmt(bounds.min)}
      </span>
      <span className="font-mono">
        max = {fmt(bounds.max)}
      </span>
      {bounds.degenerate === true && (
        <span className="font-mono text-accent">
          degenerate (max = min) → all 1.0
        </span>
      )}
    </div>
  );
}

interface ScoreTableProps {
  scores: Record<string, unknown>;
  titleById: Map<string, string>;
  rankedIds: string[];
  columns: { key: string; label: string }[];
  showRank?: boolean;
}

function ScoreTable({
  scores,
  titleById,
  rankedIds,
  columns,
  showRank = false,
}: ScoreTableProps) {
  const entries = rankedIds
    .filter((id) => scores[id] !== undefined)
    .map((id, index) => ({ id, rank: index + 1, value: scores[id] }));

  const shown = entries.slice(0, 20);
  const restCount = entries.length - shown.length;
  const allCount = Object.keys(scores).length;

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted">
        No scored candidates (component did not run or corpus is empty).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b-[2px] border-gray-900 text-xs uppercase tracking-wide text-muted">
            {showRank && <th className="pr-2">#</th>}
            <th className="pr-2">Paper</th>
            {columns.map((column) => (
              <th key={column.key} className="px-2 text-right">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="font-mono">
          {shown.map((entry) => {
            const row =
              typeof entry.value === "number"
                ? {}
                : (entry.value as Record<string, unknown>);

            return (
              <tr
                key={entry.id}
                className="border-b border-gray-200 last:border-b-0"
              >
                {showRank && (
                  <td className="pr-2 text-muted">{entry.rank}</td>
                )}
                <td className="max-w-[220px] truncate pr-2 font-sans text-ink">
                  <span className="text-muted">#{entry.id}</span>{" "}
                  {truncate(titleById.get(entry.id) ?? "")}
                </td>
                {columns.map((column) => (
                  <td key={column.key} className="px-2 text-right text-ink">
                    {fmt(row[column.key] ?? entry.value)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {restCount > 0 && (
        <p className="mt-2 text-xs text-muted">
          … and {restCount} more of {allCount} candidates (component
          scores above are the top {shown.length} by final rank).
        </p>
      )}
    </div>
  );
}

export default function PipelineMath({
  pipelineId,
  inputs,
  configOverride,
  weights,
  defaultOpen = false,
}: PipelineMathProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [trace, setTrace] = useState<TraceEvent[] | null>(null);
  // Paper ids in the order the engine actually returned them (after MMR).
  const [finalIds, setFinalIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config =
    configOverride ??
    pipelineConfigs.find((item) => item.id === pipelineId) ??
    pipelineConfigs[pipelineConfigs.length - 1];

  const hasInputs = Boolean(
    inputs &&
      (inputs.mode === "seed"
        ? inputs.seedPaperId !== undefined
        : (inputs.query ?? "").trim().length > 0)
  );

  const canRunLive = open && hasInputs;

  // The effect depends on primitive values, not on the `inputs` object:
  // the pages build that object inline, so its identity changes on every
  // render, and each unrelated re-render (a layout toggle, a hover) used to
  // fire another full instrumented search. One trace now runs per distinct
  // query / seed / depth / MMR / pipeline / weights.
  const weightsRef = useRef(weights);
  weightsRef.current = weights;

  const inputMode = inputs?.mode;
  const inputQuery = (inputs?.query ?? "").trim();
  const inputSeedId = inputs?.seedPaperId;
  const inputTopK = inputs?.topK;
  const inputMmr = inputs?.mmrLambda;
  const weightsKey = weights
    ? `${weights.tfidf}|${weights.sbert}|${weights.metadata}`
    : "";

  useEffect(() => {
    if (
      !canRunLive ||
      inputMode === undefined ||
      inputTopK === undefined
    ) {
      setTrace(null);
      setFinalIds(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    // Debounced: dial drags emit a stream of weight updates; one trace
    // fires once the interaction settles.
    const timeout = window.setTimeout(() => {
      getRecommendationTrace({
        pipeline: pipelineId,
        query: inputMode === "seed" ? undefined : inputQuery,
        seedPaperId: inputMode === "seed" ? inputSeedId : undefined,
        topK: inputTopK,
        ...(inputMmr !== undefined ? { mmrLambda: inputMmr } : {}),
        ...(weightsRef.current ? { weights: weightsRef.current } : {}),
      })
        .then((data) => {
          if (cancelled) return;
          setTrace(data.events);
          setFinalIds(
            data.results.map((result) => String(result.paper.id))
          );
        })
        .catch((err) => {
          if (cancelled) return;
          setTrace(null);
          setFinalIds(null);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to trace the computation."
          );
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    canRunLive,
    inputMode,
    inputQuery,
    inputSeedId,
    inputTopK,
    inputMmr,
    pipelineId,
    weightsKey,
  ]);

  // ------------------------------------------------------------
  // Derived maps used by the trace renderer
  // ------------------------------------------------------------

  const candidatesEvent = trace?.find(
    (event) => event.event === "candidates"
  );

  const titleById = new Map<string, string>();

  if (candidatesEvent) {
    const papers = (candidatesEvent.data.papers ??
      []) as Array<{ id: number; title: string }>;

    for (const paper of papers) {
      titleById.set(String(paper.id), paper.title);
    }
  }

  const rankEvent = trace?.find(
    (event) => event.event === "rank"
  );

  const rankedIds: string[] = [];

  if (rankEvent) {
    const ranked = (rankEvent.data.ranked ??
      []) as Array<{ id: number; score: number }>;

    rankedIds.push(
      ...ranked.map((item) => String(item.id))
    );
  }

  const eventData = (eventName: string) =>
    trace?.find((event) => event.event === eventName)?.data;

  // Which components are actually in this pipeline (weight > 0).
  const inputWeights = (eventData("input")?.weights ?? {}) as Record<
    string,
    number
  >;
  const uses = (name: string) => (inputWeights[name] ?? 0) > 0;

  const mmrEvent = eventData("rerank.mmr");
  const isSeedQuery = eventData("prepared_query")?.source === "seed_paper";

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-accentSoft"
      >
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            Computation trace
            {loading && (
              <span className="animate-pulse flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-accent">
                <Dot className="animate-rec h-2 w-2" />
                tracing…
              </span>
            )}
          </span>

          <span className="text-xs text-muted">
            The exact computation performed by the{" "}
            <span className="font-semibold text-ink">
              {config.label}
            </span>{" "}
            pipeline, with the live values from the current search.
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1.5 rounded border-[2px] border-gray-900 bg-white px-2 py-1 text-xs font-bold text-ink">
          {open ? (
            <>
              <ArrowUp className="h-3 w-3" /> Hide
            </>
          ) : (
            <>
              <ArrowDown className="h-3 w-3" /> Show
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t-[3px] border-gray-900 bg-navy px-4 py-4 sm:px-6">
          {/* ------------------------------------------------ */}
          {/* LIVE EXECUTION TRACE                              */}
          {/* ------------------------------------------------ */}

          <div className="mb-6 rounded border-[3px] border-gray-900 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-ink">
                Live computation
              </h4>

              <span className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink">
                re-traced when the search changes
              </span>
            </div>

            {!hasInputs ? (
              <p className="text-xs leading-5 text-muted">
                Enter a query and run a search to see the real numbers
                flowing through this pipeline.
              </p>
            ) : error ? (
              <p className="text-xs leading-5 text-muted">
                Trace unavailable: {error}
              </p>
            ) : !trace || loading ? (
              <p className="text-xs leading-5 text-muted">
                Recomputing the pipeline with instrumentation…
              </p>
            ) : (
              <div className="space-y-5">
                {/* Inputs */}
                <section>
                  <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {EVENT_LABELS.input}
                  </h5>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink">
                    <span className="font-mono">
                      pipeline = {pipelineId}
                    </span>
                    <WeightsChip
                      weights={(eventData("input")?.weights ??
                        {}) as Record<string, unknown>}
                    />
                    <span className="font-mono">
                      top_k = {fmtCount(eventData("input")?.top_k)}
                    </span>
                  </div>
                </section>

                {/* Prepared query */}
                <section>
                  <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {EVENT_LABELS.prepared_query}
                  </h5>

                  <p className="rounded border-[2px] border-gray-900 bg-navy px-3 py-2 font-mono text-xs leading-5 text-ink">
                    {fmt(eventData("prepared_query")?.text)}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    {fmtCount(eventData("prepared_query")?.length)}{" "}
                    characters · source:{" "}
                    {fmt(eventData("prepared_query")?.source)}
                  </p>
                </section>

                {/* Candidate set */}
                <section>
                  <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {EVENT_LABELS.candidates}
                  </h5>

                  <p className="text-xs text-ink">
                    {fmtCount(eventData("candidates")?.count)} papers
                    passed the validity filter (valid for
                    recommendation and has prepared text)
                    {isSeedQuery
                      ? "; the seed paper itself is excluded from the ranking"
                      : ""}
                    .
                  </p>
                </section>

                {/* TF-IDF */}
                {eventData("component.tfidf") && (
                  <section>
                    <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      {EVENT_LABELS["component.tfidf"]}
                    </h5>

                    <p className="mb-2 text-xs text-ink">
                      query vector: dim ={" "}
                      <span className="font-mono">
                        {fmtCount(eventData("component.tfidf")?.vector_dim)}
                      </span>
                      , nonzero terms ={" "}
                      <span className="font-mono">
                        {fmtCount(eventData("component.tfidf")?.nonzero_terms)}
                      </span>
                      , top terms:{" "}
                      <TermChips
                        terms={
                          eventData("component.tfidf")
                            ?.top_terms
                        }
                      />
                    </p>

                    <ScoreTable
                      scores={
                        (eventData("component.tfidf")
                          ?.scores ?? {}) as Record<
                          string,
                          unknown
                        >
                      }
                      titleById={titleById}
                      rankedIds={rankedIds}
                      columns={[
                        { key: "s", label: "s_tfidf(d)" },
                      ]}
                    />
                  </section>
                )}

                {/* S-BERT */}
                {eventData("component.sbert") && (
                  <section>
                    <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      {EVENT_LABELS["component.sbert"]}
                    </h5>

                    <p className="mb-2 text-xs text-ink">
                      query embedding: dim ={" "}
                      <span className="font-mono">
                        {fmtCount(eventData("component.sbert")?.vector_dim)}
                      </span>{" "}
                      (all-MiniLM-L6-v2)
                    </p>

                    <ScoreTable
                      scores={
                        (eventData("component.sbert")
                          ?.scores ?? {}) as Record<
                          string,
                          unknown
                        >
                      }
                      titleById={titleById}
                      rankedIds={rankedIds}
                      columns={[
                        { key: "s", label: "s_sbert(d)" },
                      ]}
                    />
                  </section>
                )}

                {/* Metadata signals */}
                {eventData("component.metadata.signals") && (
                  <section>
                    <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      {EVENT_LABELS["component.metadata.signals"]}
                    </h5>

                    <p className="mb-2 text-xs leading-5 text-muted">
                      s_meta(d) = 0.25·s_title + 0.25·s_abstract +
                      0.25·s_keywords + 0.25·s_year; missing fields
                      contribute 0.
                    </p>

                    <ScoreTable
                      scores={
                        (eventData(
                          "component.metadata.signals"
                        )?.signals ?? {}) as Record<
                          string,
                          unknown
                        >
                      }
                      titleById={titleById}
                      rankedIds={rankedIds}
                      columns={[
                        { key: "title", label: "title" },
                        { key: "abstract", label: "abstract" },
                        { key: "keywords", label: "keywords" },
                        { key: "year", label: "year" },
                        { key: "total", label: "s_meta(d)" },
                      ]}
                    />
                  </section>
                )}

                {/* Normalization */}
                <section>
                  <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {EVENT_LABELS.normalization}
                  </h5>

                  <p className="mb-2 font-mono text-xs text-ink">
                    s'(d) = (s(d) − min) / (max − min)
                  </p>

                  <div className="space-y-1">
                    {uses("tfidf") && (
                      <BoundRow
                        label="TF-IDF"
                        data={eventData("normalization")?.tfidf}
                      />
                    )}
                    {uses("sbert") && (
                      <BoundRow
                        label="S-BERT"
                        data={eventData("normalization")?.sbert}
                      />
                    )}
                    {uses("metadata") && (
                      <BoundRow
                        label="Metadata (already 0–1, unnormalized)"
                        data={
                          eventData("normalization")?.metadata
                        }
                      />
                    )}
                  </div>
                </section>

                {/* Combination */}
                <section>
                  <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {EVENT_LABELS.combine}
                  </h5>

                  <p className="mb-2 text-xs text-ink">
                    S(d) = <WeightsChip
                      weights={
                        (eventData("combine")
                          ?.weights ?? {}) as Record<
                          string,
                          unknown
                        >
                      }
                    />{" "}
                    applied to the normalized component scores.
                  </p>

                  <ScoreTable
                    scores={
                      (eventData("combine")?.scores ??
                        {}) as Record<string, unknown>
                    }
                    titleById={titleById}
                    rankedIds={rankedIds}
                    columns={[
                      { key: "s", label: "S(d)" },
                    ]}
                  />
                </section>

                {/* Final ranking */}
                <section>
                  <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {mmrEvent
                      ? "Ranking by relevance (before MMR)"
                      : EVENT_LABELS.rank}
                  </h5>

                  <ScoreTable
                    scores={
                      (Object.fromEntries(
                        (
                          (rankEvent?.data.ranked ??
                            []) as Array<{
                            id: number;
                            score: number;
                          }>
                        ).map((item) => [
                          String(item.id),
                          item.score,
                        ])
                      ) ?? {}) as Record<string, unknown>
                    }
                    titleById={titleById}
                    rankedIds={rankedIds}
                    columns={[
                      { key: "s", label: "S(d)" },
                    ]}
                    showRank
                  />
                </section>

                {/* MMR diversification (only when Diversify is on) */}
                {mmrEvent && finalIds && (
                  <section>
                    <h5 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                      {EVENT_LABELS["rerank.mmr"]} — final order
                    </h5>

                    <p className="mb-2 font-mono text-xs text-ink">
                      λ = {String(mmrEvent.lambda)} · pool used ={" "}
                      {fmtCount(mmrEvent.pool_used)} (of {fmtCount(mmrEvent.pool)}) ·
                      similarity = {fmt(mmrEvent.similarity_source)}
                    </p>

                    <p className="mb-2 text-xs leading-5 text-muted">
                      MMR only reorders the relevance ranking above; S(d)
                      is unchanged. This is the order the Search page shows.
                    </p>

                    <ScoreTable
                      scores={
                        (eventData("combine")?.scores ??
                          {}) as Record<string, unknown>
                      }
                      titleById={titleById}
                      rankedIds={finalIds}
                      columns={[
                        { key: "s", label: "S(d)" },
                      ]}
                      showRank
                    />
                  </section>
                )}
              </div>
            )}
          </div>

          {/* ------------------------------------------------ */}
          {/* THE FORMULAS LIVE IN THE ENGINE                   */}
          {/* ------------------------------------------------ */}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded border-[2px] border-gray-900 bg-white px-3 py-2">
            <p className="text-xs leading-5 text-ink">
              Looking for the how? Every formula behind these numbers is
              explained in the Engine, with a worked example.
            </p>

            <Link
              to="/walkthrough-engine"
              className="shrink-0 rounded border-[2px] border-gray-900 bg-white px-2 py-1 text-xs font-bold text-ink transition-colors hover:bg-accentSoft"
            >
              Open the Engine
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}