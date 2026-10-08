import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  BarChart3,
  History,
  Layers,
  Quote,
  Table,
  Trophy,
} from "lucide-react";

import {
  comparePipelines,
  webComparePipelines,
  getBattleHistory,
  BattleRun,
  CompareResponse,
} from "../../api";

import { pipelineConfigs } from "../../data/pipelineConfigs";
import { triggerSlimeAnimation } from "../../utils/slimeEvents";
import PixelProgress from "../../components/retro/PixelProgress";
import { useSun } from "../../state/sun";
import StaggerIn from "../../components/retro/StaggerIn";
import PageTabs from "../../components/PageTabs";
import StatsForNerds from "../../components/StatsForNerds";
import FreqBars from "../../components/retro/FreqBars";
import Pagination from "../../components/retro/Pagination";
import { ArrowRight, Star } from "../../components/retro/PixelIcons";
import { Button, PageHeader, PageShell } from "../../components/ui";
import HuntItem from "../../components/retro/HuntItem";
import { HUNT_ITEMS } from "../../data/hunt";
import { useStatsDrawer } from "../../state/statsDrawer";

// ============================================================
// PIPELINE BATTLE — EVALUATION PAGE
// ============================================================
//
// Runs all six recommendation pipelines against the same query
// and shows them side by side: consensus ranking, the battle
// grid (which pipeline ranked which paper where), score bars,
// and pairwise agreement statistics.

const configById = new Map(
  pipelineConfigs.map((config) => [config.id, config])
);

const BATTLE_IDS = [
  "tfidf",
  "sbert",
  "tfidf_sbert",
  "tfidf_metadata",
  "sbert_metadata",
  "tfidf_sbert_metadata",
];

/* Battle round names: the six pipelines in execution order. */
const BATTLE_STAGES = BATTLE_IDS.map(
  (id) => configById.get(id)?.codename ?? id,
);

/* Minimum loading-state duration so the battle rounds play. */
const MIN_BATTLE_MS = 2_400;

function formatScore(value: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toFixed(4);
}

function PipelineChip({
  pipelineId,
  grow = false,
}: {
  pipelineId: string;
  /** Grow to fill its flex column and truncate long names. */
  grow?: boolean;
}) {
  const config = configById.get(pipelineId);

  return (
    <span
      className={
        grow
          ? "flex w-full max-w-full flex-col items-stretch gap-1"
          : "inline-flex flex-col items-start gap-1"
      }
    >
      <span
        className={`rounded border-[2px] border-gray-900 bg-surface px-1.5 py-0.5 font-mono text-xs font-bold tracking-[0.12em] text-ink ${
          grow ? "max-w-full truncate" : "max-w-[150px] truncate"
        }`}
      >
        {config?.codename ?? pipelineId}
      </span>
      <span
        className={`font-mono text-xs text-muted ${
          grow ? "w-full truncate" : "max-w-[150px] truncate"
        }`}
      >
        {pipelineId}
      </span>
    </span>
  );
}

export default function Evaluation() {
  const { grantTokens } = useSun();
  const { publish: publishStats } = useStatsDrawer();

  const [queryText, setQueryText] = useState("");
  const [topK, setTopK] = useState(10);
  const [battle, setBattle] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // A newer battle cancels the web fetch still in flight.
  const battleAbortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BattleRun[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [serverTally, setServerTally] = useState<
    { pipeline_id: string; wins: number }[]
  >([]);
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);

  /* Page-level view: the battle, or the ranking math. */
  const [pageTab, setPageTab] = useState<"battle" | "stats">("battle");

  /* Arena results are tab-separated instead of one long stack. */
  const [resultsTab, setResultsTab] = useState<
    "overview" | "consensus" | "pairwise" | "grid" | "scores" | "cite"
  >("overview");

  /* Web mode: battle the pipelines over live OpenAlex/Crossref/arXiv
     hits instead of the repository. */
  const [webMode, setWebMode] = useState(false);
  const [webSources, setWebSources] = useState(
    "openalex,crossref,arxiv",
  );
  const [webSort, setWebSort] = useState("relevance");
  const [openAccess, setOpenAccess] = useState(false);

  const HISTORY_PAGE_SIZE = 5;

  async function loadHistory(page: number = historyPage) {
    try {
      const response = await getBattleHistory(page, HISTORY_PAGE_SIZE);
      setHistory(response.runs);
      setHistoryTotal(response.total);
      setHistoryPages(response.pages);
      setHistoryPage(response.page);
      setServerTally(response.tally);
    } catch {
      // History is best-effort; the battle itself still works.
    }
  }

  useEffect(() => {
    void loadHistory(1);
  }, []);

  /* Battle-round ticker: walks the six codenames while loading. */
  const [battleStageIndex, setBattleStageIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setBattleStageIndex(0);
      return;
    }

    const id = window.setInterval(() => {
      setBattleStageIndex((index) =>
        Math.min(BATTLE_STAGES.length - 1, index + 1),
      );
    }, 400);

    return () => window.clearInterval(id);
  }, [loading]);

  async function runBattle() {
    if (!queryText.trim()) {
      setError("Enter a query to start the battle.");
      return;
    }

    setLoading(true);
    setError(null);

    // The pet zaps when the battle starts.
    triggerSlimeAnimation("zap");

    // The local battle resolves in milliseconds; hold the loading
    // state open long enough for the six battle rounds to play.
    const startedAt = Date.now();

    battleAbortRef.current?.abort();
    const controller = new AbortController();
    battleAbortRef.current = controller;

    try {
      const data = webMode
        ? await webComparePipelines({
            q: queryText.trim(),
            topK,
            sources: webSources || "openalex,crossref,arxiv",
            sort: webSort,
            openAccess,
            signal: controller.signal,
          })
        : await comparePipelines({
            query: queryText.trim(),
            topK,
          });

      if (controller.signal.aborted) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_BATTLE_MS) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, MIN_BATTLE_MS - elapsed),
        );
      }

      setBattle(data);

      // Publish the battle to the universal statistics panel.
      if (!webMode) {
        publishStats({
          pipelineId: "compare",
          mode: "keyword",
          query: queryText.trim(),
          topK,
        });
      }
      // Web battles never touch the tally/history.
      if (!webMode) {
        void loadHistory();
        // Every finished local battle pays a growth token (3/day).
        grantTokens(1, undefined, "battle");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      setBattle(null);
      setError(
        err instanceof Error
          ? err.message
          : "Pipeline comparison failed."
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  // ----------------------------------------------------------
  // WIN TALLY over time, derived from the recorded battle runs.
  // ----------------------------------------------------------

  const tally = BATTLE_IDS.map((id) => ({
    id,
    wins: serverTally.find((entry) => entry.pipeline_id === id)?.wins ?? 0,
  })).sort(
    (a, b) =>
      b.wins - a.wins ||
      BATTLE_IDS.indexOf(a.id) - BATTLE_IDS.indexOf(b.id),
  );

  const leader = tally[0];
  const totalRuns = historyTotal;

  /* Winner-score histogram over the loaded history page: buckets
     in 10-point steps from 50% up (battle winners below 50% are
     rare and pooled into the first bucket by the clamp). */
  const scoreBuckets = [0, 1, 2, 3, 4].map((bucket) => ({
    label: `${50 + bucket * 10}-${59 + bucket * 10}%`,
    value: history.filter((run) => {
      if (run.winner_value == null) return false;

      const pct =
        run.winner_metric === "independence_weighted_consensus"
          ? run.winner_value * 100
          : null;

      if (pct === null) return false;

      return (
        Math.min(4, Math.max(0, Math.floor((pct - 50) / 10))) ===
        bucket
      );
    }).length,
  }));
  const currentStreak =
    leader && leader.wins > 0
      ? (() => {
          let count = 0;
          for (const run of history) {
            if (run.winner_pipeline_id === leader.id) {
              count++;
            } else {
              break;
            }
          }
          return count;
        })()
      : 0;

  function formatRunTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const rankById = (pipelineId: string, paperId: number): number | null => {
    const pipeline = battle?.pipelines.find(
      (entry) => entry.id === pipelineId
    );

    if (!pipeline) return null;

    const found = pipeline.results.find(
      (result) => result.paper_id === paperId
    );

    return found
      ? pipeline.results.indexOf(found) + 1
      : null;
  };

  const scoreById = (pipelineId: string, paperId: number): number | null => {
    const pipeline = battle?.pipelines.find(
      (entry) => entry.id === pipelineId
    );

    const found = pipeline?.results.find(
      (result) => result.paper_id === paperId
    );

    return found?.score ?? null;
  };

  // Papers shown in the battle grid: the consensus ranking,
  // trimmed to the requested depth (top_k), then paged.
  const gridPapers =
    battle?.consensus.slice(0, battle.top_k) ?? [];

  const GRID_PAGE_SIZE = 5;
  const gridPageCount = Math.max(
    1,
    Math.ceil(gridPapers.length / GRID_PAGE_SIZE),
  );
  const [gridPage, setGridPage] = useState(1);

  // Pairwise cards page at 6 per page (3 card rows x 2 columns) so
  // the section stays roughly the same height as the consensus
  // podium it sits next to.
  const PAIR_PAGE_SIZE = 6;
  const pairPageCount = Math.max(
    1,
    Math.ceil((battle?.pairwise.length ?? 0) / PAIR_PAGE_SIZE),
  );
  const [pairPage, setPairPage] = useState(1);

  useEffect(() => {
    setGridPage(1);
    setPairPage(1);
    setResultsTab("overview");
  }, [battle]);

  const gridPageStart = (gridPage - 1) * GRID_PAGE_SIZE;
  const pagedGridPapers = gridPapers.slice(
    gridPageStart,
    gridPageStart + GRID_PAGE_SIZE,
  );

  const pairPageStart = (pairPage - 1) * PAIR_PAGE_SIZE;
  const pagedPairs = (battle?.pairwise ?? []).slice(
    pairPageStart,
    pairPageStart + PAIR_PAGE_SIZE,
  );

  /* Citation-ready write-ups of the current battle, one per style,
     for copy-paste into a manuscript. Every figure comes straight
     from this run. */
  const citations = (() => {
    if (!battle) return null;

    const today = new Date();
    const monthLong = today.toLocaleString("en-US", { month: "long" });
    const monthShort = today.toLocaleString("en-US", { month: "short" });
    const day = today.getDate();
    const year = today.getFullYear();

    const mlaDate = `${day} ${monthShort}. ${year}`;
    const chicagoDate = `${monthLong} ${day}, ${year}`;
    const ieeeDate = `${monthShort}. ${day}, ${year}`;

    const subject = battle.query
      ? `"${battle.query}"`
      : `seed paper #${battle.seed_paper_id}`;

    const winnerId = battle.winner?.pipeline_id ?? "n/a";
    const winnerChip = configById.get(winnerId)?.codename ?? winnerId;
    const winnerPct = battle.winner
      ? Math.round(battle.winner.value * 100)
      : 0;

    const leader = battle.consensus[0];
    const leaderText =
      leader?.title != null
        ? ` Top consensus paper: "${leader.title}"` +
          (leader.year ? ` (${leader.year})` : "") +
          "."
        : "";

    /* Pairwise extremes for the verbose APA interpretation. */
    const resultCount = (id: string) =>
      battle.pipelines.find((pipeline) => pipeline.id === id)?.results
        .length ?? 0;

    const normalizedOverlap = (pair: (typeof battle.pairwise)[number]) =>
      pair.overlap / Math.max(1, Math.min(resultCount(pair.a), resultCount(pair.b)));

    const rankedPairs = [...battle.pairwise].sort(
      (first, second) => normalizedOverlap(second) - normalizedOverlap(first),
    );
    const closest = rankedPairs[0];
    const farthest = rankedPairs[rankedPairs.length - 1];
    const nameOf = (id: string) => configById.get(id)?.codename ?? id;
    const pairText = (pair: (typeof battle.pairwise)[number] | undefined) =>
      pair
        ? `${nameOf(pair.a)} and ${nameOf(pair.b)}, which shared ` +
          `${pair.overlap} of ${Math.min(resultCount(pair.a), resultCount(pair.b))} ` +
          `returned papers (mean rank gap ` +
          `${
            pair.mean_rank_gap != null
              ? pair.mean_rank_gap.toFixed(2)
              : "n/a"
          })`
        : null;

    const pipelineNames = battle.pipelines
      .map((pipeline) => nameOf(pipeline.id))
      .join(", ");

    /* Verbose APA-style interpretation: a full paragraph a reader
       can drop into a manuscript, not a reference-list entry. */
    const apaText =
      `On ${monthLong} ${day}, ${year}, the Re:Search prototype ` +
      `compared ${battle.pipelines.length} content-based recommendation ` +
      `pipelines on the ${battle.query ? "query" : "seed paper"} ` +
      `${subject} at a depth of ${battle.top_k} results per pipeline: ` +
      `${pipelineNames}. The winner was ${winnerChip} ` +
      `(${winnerId}), which captured ${winnerPct}% of the available ` +
      "independence-weighted consensus" +
      (battle.winner?.avg_consensus_rank != null
        ? ` at an average consensus rank of #${battle.winner.avg_consensus_rank}`
        : "") +
      ". Agreement was strongest between " +
      (pairText(closest) ?? "n/a") +
      ", while the least agreement occurred between " +
      (pairText(farthest) ?? "n/a") +
      "." +
      (leader?.title != null
        ? ` Across all pipelines, the paper with the broadest consensus ` +
          `was "${leader.title}"` +
          (leader.year ? ` (${leader.year})` : "") +
          (leader.votes != null
            ? `, ranked by ${leader.votes} of ${battle.pipelines.length} pipelines`
            : "") +
          "."
        : "") +
      " Agreement is interpreted with independence weighting, so a " +
      "pipeline's consensus is discounted when the agreeing pipeline " +
      "shares its signals, which prevents a hybrid from being " +
      "confirmed by its own components.";

    return [
      {
        id: "apa",
        label: "APA 7 (interpretation)",
        text: apaText,
      },
      {
        id: "mla",
        label: "MLA 9",
        text:
          `"Comparative Pipeline Battle for ${subject}." ` +
          "Re:Search Arena, local Re:Search recommendation " +
          `prototype, ${mlaDate}. Software battle report. Winner: ` +
          `${winnerChip}, ${winnerPct}% independence-weighted ` +
          `consensus at top-${battle.top_k}.${leaderText}`,
      },
      {
        id: "chicago",
        label: "Chicago",
        text:
          `Re:Search Arena. "Comparative Pipeline Battle for ` +
          `${subject}." Software battle report, local Re:Search ` +
          `recommendation prototype, ${chicagoDate}. Winner: ` +
          `${winnerChip} at ${winnerPct} percent independence-` +
          `weighted consensus.${leaderText}`,
      },
      {
        id: "ieee",
        label: "IEEE",
        text:
          `Re:Search Arena, "Comparative pipeline battle for ` +
          `${subject}," software battle report, local Re:Search ` +
          `recommendation prototype, ${ieeeDate}. Winner: ` +
          `${winnerChip}, ${winnerPct}% independence-weighted ` +
          `consensus.${leaderText}`,
      },
    ];
  })();

  async function copyCitation(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCitation(id);
      window.setTimeout(
        () =>
          setCopiedCitation((current) =>
            current === id ? null : current,
          ),
        1600,
      );
    } catch {
      setCopiedCitation(null);
    }
  }

  /* Result tabs: an arcade cartridge rail — numbered, icon-led
     chips on an ink rail, active tab pressed in accent. */
  const RESULT_TABS = [
    { id: "overview", label: "Winner", icon: Trophy },
    { id: "consensus", label: "Consensus", icon: Layers },
    { id: "pairwise", label: "Pairwise", icon: ArrowLeftRight },
    { id: "grid", label: "Battle grid", icon: Table },
    { id: "scores", label: "Scores", icon: BarChart3 },
    { id: "cite", label: "Interpretation", icon: Quote },
  ] as const;

  return (
    <PageShell>
      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-key")!} />
      <PageHeader
        eyebrow="Arena"
        title="Pipeline battle"
        description="Run all six pipelines on one query. Compare the consensus ranking, the per-pipeline ranks, and the pairwise agreement."
      />

      <div className="mt-6">
        <PageTabs
          label="Arena view"
          active={pageTab}
          onChange={setPageTab}
          options={[
            { id: "battle", label: "Battle" },
            { id: "stats", label: "Stats for Nerds" },
          ]}
        />
      </div>

      {pageTab === "stats" ? (
        <section className="mt-4">
          <StatsForNerds
            inputs={{
              mode: "keyword",
              query: queryText,
              topK,
            }}
            contextNote="Every battle runs the six presets on the same query; this is the shared computation behind their scores — expand the live trace to walk the current query through one pipeline."
          />
        </section>
      ) : (
        <>

      {/* ======================================================
          THE CABINET — marquee, the screen (the query), and the
          high scores. The default view: insert a query, press start.
          ====================================================== */}

      <section
        aria-label="Battle cabinet"
        data-arena-cabinet=""
        className="mb-6 overflow-hidden rounded-lg border-[3px] border-gray-900 bg-gray-900 text-onInk shadow-[6px_6px_0_rgba(0,0,0,0.25)]"
      >
        {/* the marquee */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-gray-900 bg-accent px-4 py-2 text-onAccent">
          <p className="flex items-center gap-2 font-pixelify text-lg font-bold uppercase leading-none tracking-[0.2em]">
            <Star className="h-4 w-4" aria-hidden="true" />
            Pipeline battle
            <Star className="h-4 w-4" aria-hidden="true" />
          </p>
          <p
            aria-live="polite"
            className={`font-mono text-xs font-bold uppercase tracking-[0.25em] ${
              loading || !battle ? "animate-blink" : ""
            }`}
          >
            {loading
              ? `Round ${battleStageIndex + 1} of ${BATTLE_STAGES.length}`
              : battle
                ? "Battle complete"
                : "Insert query"}
          </p>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* THE SCREEN */}
          <div className="rounded border-[3px] border-black/60 bg-gray-950 p-4 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),inset_0_0_36px_rgba(0,0,0,0.55)]">
            {/* mode select */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-onInk/70">
                Select field
              </span>
              {(["repository", "web"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setWebMode(scope === "web")}
                  aria-pressed={webMode === (scope === "web")}
                  className={`rounded border-[2px] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition-colors pixel-ease ${
                    webMode === (scope === "web")
                      ? "border-accent bg-accent text-onAccent"
                      : "border-onInk/40 text-onInk/80 hover:border-accent hover:text-accent"
                  }`}
                >
                  {scope === "repository" ? "Repository" : "Web"}
                </button>
              ))}
              {webMode && (
                <span className="ml-auto max-w-sm text-[11px] leading-4 text-onInk/70">
                  Live OpenAlex / Crossref / arXiv hits; never recorded to the tally.
                </span>
              )}
            </div>

            <label
              htmlFor="arena-query"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-onInk"
            >
              Player one · enter query
            </label>
            <div className="mt-1.5 flex items-center gap-2 border-b-[3px] border-accent pb-1.5">
              <span aria-hidden="true" className="font-pixelify text-xl font-bold text-onInk">
                &gt;
              </span>
              <input
                id="arena-query"
                type="text"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runBattle();
                }}
                placeholder="e.g. neural network text similarity"
                disabled={loading}
                className="min-w-0 flex-1 bg-transparent font-pixelify text-lg text-onInk caret-[rgb(var(--accent))] placeholder:text-onInk/50 focus:outline-none"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-onInk/80">
                Depth
                <select
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                  disabled={loading}
                  className="rounded border-[2px] border-onInk/40 bg-gray-950 px-2 py-1 font-mono text-xs text-onInk focus:border-accent focus:outline-none"
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={15}>Top 15</option>
                </select>
              </label>

              <button
                type="button"
                onClick={runBattle}
                disabled={loading || !queryText.trim()}
                className={`ml-auto rounded border-[3px] border-black/60 bg-accent px-6 py-2 font-pixelify text-base font-bold uppercase tracking-[0.2em] text-onAccent shadow-[0_4px_0_rgba(0,0,0,0.45)] transition-all pixel-ease hover:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.45)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  !loading && queryText.trim() ? "animate-blink" : ""
                }`}
              >
                {loading ? "Battling…" : "Press start"}
              </button>
            </div>

            {webMode && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-onInk/80">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-onInk/70">
                    Sources
                  </span>
                  {(["openalex", "crossref", "arxiv"] as const).map((source) => (
                    <label key={source} className="flex cursor-pointer items-center gap-1.5 hover:text-onInk">
                      <input
                        type="checkbox"
                        checked={webSources.includes(source)}
                        onChange={() =>
                          setWebSources((current) =>
                            current.includes(source)
                              ? current
                                  .split(",")
                                  .filter((item) => item !== source)
                                  .join(",")
                              : [current, source].filter(Boolean).join(","),
                          )
                        }
                        className="accent-gold"
                      />
                      {source === "openalex" ? "OpenAlex" : source === "crossref" ? "Crossref" : "arXiv"}
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 hover:text-onInk">
                  <input
                    type="checkbox"
                    checked={openAccess}
                    onChange={(event) => setOpenAccess(event.target.checked)}
                    className="accent-gold"
                  />
                  Open access only
                </label>
                <label className="flex items-center gap-1.5 hover:text-onInk">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Sort</span>
                  <select
                    value={webSort}
                    onChange={(event) => setWebSort(event.target.value)}
                    className="rounded border-[2px] border-onInk/40 bg-gray-950 px-2 py-0.5 text-xs text-onInk focus:outline-none"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="year">Newest first</option>
                  </select>
                </label>
              </div>
            )}

            {/* what the screen says: the attract text, the rounds, or the result line */}
            <div className="mt-4 border-t-2 border-dashed border-onInk/25 pt-3">
              {loading ? (
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.15em] text-onInk">
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    Battling: {BATTLE_STAGES[battleStageIndex]}
                  </p>
                  <PixelProgress
                    value={(battleStageIndex + 1) / BATTLE_STAGES.length}
                    stage={`ROUND ${battleStageIndex + 1} OF ${BATTLE_STAGES.length}`}
                    className="mt-2 w-full"
                  />
                </div>
              ) : battle?.winner ? (
                <p className="font-mono text-xs leading-5 text-onInk/90">
                  <span className="font-bold uppercase tracking-[0.2em] text-onInk">Last battle · </span>
                  {configById.get(battle.winner.pipeline_id)?.codename ?? battle.winner.pipeline_id} won with{" "}
                  {(battle.winner.value * 100).toFixed(0)}% of the consensus. The result is below.
                </p>
              ) : (
                <p className="text-xs leading-5 text-onInk/80">
                  A battle runs all six pipelines on one query. The pipelines compete on the same prepared text; the
                  winner takes the largest share of independence-weighted consensus. Seed-paper mode is in{" "}
                  <Link to="/recommendations" className="font-bold text-onInk underline hover:decoration-2">
                    Recommendations
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>

          {/* HIGH SCORES */}
          <aside
            aria-label="High scores"
            className="flex flex-col rounded border-[3px] border-black/60 bg-gray-950 p-3 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)]"
          >
            <p className="flex items-center gap-1.5 font-pixelify text-sm font-bold uppercase tracking-[0.2em] text-onInk">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              High scores
            </p>
            <ol className="mt-3 space-y-1.5">
              {tally.map((entry, index) => {
                const share = totalRuns > 0 ? entry.wins / totalRuns : 0;

                return (
                  <li key={entry.id} className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-right text-onInk/85">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-bold tracking-[0.1em] text-onInk">
                        {configById.get(entry.id)?.codename ?? entry.id}
                      </span>
                      {index === 0 && entry.wins > 0 && (
                        <Star className="animate-blink h-3 w-3 text-accent" aria-label="Champion" />
                      )}
                      <span className="w-8 text-right font-bold text-onInk">{entry.wins}</span>
                    </div>
                    <div className="ml-6 mt-0.5 h-1 overflow-hidden bg-onInk/15" aria-hidden="true">
                      <div className="h-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-auto border-t border-onInk/20 pt-3 font-mono text-[10px] font-bold uppercase leading-4 tracking-[0.15em] text-onInk/75">
              {totalRuns} {totalRuns === 1 ? "battle" : "battles"} fought
              {currentStreak > 1
                ? ` · streak ×${currentStreak} for ${configById.get(leader.id)?.codename ?? leader.id}`
                : ""}
            </p>
          </aside>
        </div>
      </section>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <div className="status-error mb-5">{error}</div>
      )}

      {/* ======================================================
          RESULTS
          ====================================================== */}

      {!loading && battle && (
        <div className="space-y-6">
          {/* ------------------------------------------------
              RESULT TABS — one panel per result type, the first
              one is the summary, the last the recorded history
              ------------------------------------------------ */}

          {/* RAIL — always visible; the battle grid/scores/records are the
              default view, the rest adapt once a battle lands */}
          <div className="overflow-x-auto rounded border-[3px] border-gray-900 bg-gray-900 p-1.5">
            <div
              role="tablist"
              aria-label="Arena results"
              className="flex min-w-max gap-1.5"
            >
              {RESULT_TABS.map(({ id, label, icon: Icon }, index) => {
                const active = resultsTab === id;

                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={label}
                    onClick={() => setResultsTab(id)}
                    className={`relative flex items-center gap-1.5 rounded border-[2px] px-2.5 py-1.5 font-pixelify text-[11px] font-bold uppercase tracking-[0.12em] transition-colors pixel-ease ${
                      active
                        ? "border-gray-900 bg-accent text-onAccent shadow-[inset_0_-3px_0_rgba(0,0,0,0.3)]"
                        : "border-gray-700 bg-gray-800 text-onInk/75 hover:border-accent hover:text-accent"
                    }`}
                  >
                    <span
                      className={`text-[9px] leading-none ${
                        active ? "text-onAccent/70" : "text-onInk/40"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <Icon className="h-3.5 w-3.5" />

                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div key={resultsTab} className="animate-step-in space-y-6">

          {/* ------------------------------------------------
              WINNER BANNER
              ------------------------------------------------ */}

          {resultsTab === "overview" && battle?.winner && (
            <section className="rounded border-[3px] border-gray-900 bg-gray-900 p-5 text-onInk">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="animate-blink flex items-center gap-2 font-mono text-xs font-bold tracking-[0.3em] text-accent">
                    <Star className="h-3.5 w-3.5" />
                    WINNER
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded border-[2px] border-gray-900 bg-surface px-2 py-1 font-mono text-sm font-bold tracking-[0.12em] text-ink">
                      {configById.get(battle.winner.pipeline_id)?.codename ??
                        battle.winner.pipeline_id}
                    </span>
                    <span className="font-mono text-xs text-onInk/70">
                      {battle.winner.pipeline_id}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-onInk/70">
                    Captured the most independence-weighted
                    consensus across its top-{battle.top_k} results
                    {battle.winner.avg_consensus_rank !== null
                      ? ` · avg consensus rank #${battle.winner.avg_consensus_rank}`
                      : ""}
                    . Agreement with a rival pipeline counts only as
                    much as that rival is built from different
                    signals, a pipeline can.t be confirmed by its
                    own hybrids.
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono text-3xl font-bold leading-none text-accent">
                    {(battle.winner.value * 100).toFixed(0)}%
                  </p>
                  <p className="mt-1 font-mono text-xs text-onInk/70">
                    of available consensus
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ------------------------------------------------
              SCORE DISTRIBUTION — GROUPED BY RANK
              ------------------------------------------------ */}

          {resultsTab === "scores" && battle && (
          <section className="rounded border-[3px] border-gray-900 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-sm font-bold text-ink">
                Score distribution
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                One row per rank position: the six pipelines'
                scores for that spot, scaled against the highest
                score across all pipelines.
              </p>
            </div>

            {(() => {
              const allScores = battle.pipelines.flatMap(
                (pipeline) =>
                  pipeline.results.map((result) => result.score)
              );

              const globalMax =
                allScores.length > 0
                  ? Math.max(...allScores)
                  : 0;

              const maxRanks = Math.min(
                5,
                Math.max(
                  0,
                  ...battle.pipelines.map(
                    (pipeline) => pipeline.results.length
                  ),
                ),
              );

              if (maxRanks === 0) {
                return (
                  <p className="px-5 py-6 text-sm leading-6 text-muted">
                    No scores to chart. The repository returned
                    no results for this query.
                  </p>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="border-b-[3px] border-gray-900">
                        <th className="px-5 py-3 text-left text-xs uppercase tracking-wide text-muted">
                          Rank
                        </th>

                        {BATTLE_IDS.map((id) => (
                          <th key={id} className="px-2 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <PipelineChip pipelineId={id} />
                              {id === battle.winner?.pipeline_id && (
                                <span className="animate-blink flex items-center gap-1 font-mono text-xs font-bold tracking-[0.2em] text-accent">
                                  <Star className="h-3 w-3" />
                                  WINNER
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {Array.from(
                        { length: maxRanks },
                        (_, index) => index + 1
                      ).map((rank) => (
                        <tr
                          key={rank}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          <td className="whitespace-nowrap px-5 py-2.5 font-mono text-sm font-bold text-ink">
                            #{rank}
                          </td>

                          {BATTLE_IDS.map((id) => {
                            const pipeline = battle.pipelines.find(
                              (entry) => entry.id === id
                            );
                            const result = pipeline?.results[rank - 1];

                            if (!result) {
                              return (
                                <td
                                  key={id}
                                  className="px-2 py-2.5 text-center font-mono text-xs text-muted"
                                >
                                  —
                                </td>
                              );
                            }

                            const isWinner =
                              id === battle.winner?.pipeline_id;

                            return (
                              <td key={id} className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-4 flex-1 overflow-hidden rounded border-[2px] border-gray-900 bg-field ${
                                      isWinner ? "ring-2 ring-gray-900" : ""
                                    }`}
                                  >
                                    <div
                                      className={`h-full ${
                                        isWinner ? "bg-accent" : "bg-ink"
                                      }`}
                                      style={{
                                        width: `${
                                          globalMax > 0
                                            ? (result.score / globalMax) * 100
                                            : 0
                                        }%`,
                                      }}
                                    />
                                  </div>
                                  <span className="w-14 shrink-0 text-right font-mono text-xs text-muted">
                                    {formatScore(result.score)}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
          )}

          {/* ------------------------------------------------
              CONSENSUS PODIUM
              ------------------------------------------------ */}

          {resultsTab === "consensus" && battle && (
          <div>

          <section className="rounded border-[3px] border-gray-900 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-sm font-bold text-ink">
                Consensus ranking
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Papers ordered by how many of the {battle.pipelines.length}{" "}
                pipelines ranked them, then by average rank.
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {gridPapers.slice(0, 5).map((entry, index) => (
                <StaggerIn key={entry.paper_id} index={index}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-gray-900 bg-surface font-mono text-xs font-bold text-ink">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {entry.title ?? `Paper #${entry.paper_id}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Paper #{entry.paper_id}
                        {entry.year ? ` · ${entry.year}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded border-[2px] border-gray-900 bg-accent px-2 py-0.5 font-mono text-xs font-bold text-onAccent">
                        {entry.votes}/{battle.pipelines.length} votes
                      </span>
                      <span className="font-mono text-xs text-muted">
                        avg rank {formatScore(entry.avg_rank)}
                        {entry.best_rank
                          ? ` · best #${entry.best_rank}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </StaggerIn>
              ))}
            </div>
          </section>
          </div>
          )}

          {/* ------------------------------------------------
              PAIRWISE AGREEMENT
              ------------------------------------------------ */}

          {resultsTab === "pairwise" && battle && (
          <div>
              <section className="rounded border-[3px] border-gray-900 bg-white">
                <div className="border-b border-gray-200 px-5 py-4">
                  <p className="text-sm font-bold text-ink">
                    Pairwise agreement
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Overlap = papers both pipelines ranked. Mean rank gap =
                    average absolute rank difference over shared papers
                    (lower = more agreement).
                  </p>
                </div>

                <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
                  {pagedPairs.map((pair, index) => {
                    const countA =
                      battle.pipelines.find((p) => p.id === pair.a)
                        ?.results.length ?? 0;
                    const countB =
                      battle.pipelines.find((p) => p.id === pair.b)
                        ?.results.length ?? 0;

                    // Overlap can never exceed what both pipelines
                    // actually returned — use that as the denominator.
                    const maxOverlap = Math.min(countA, countB);

                    return (
                    <StaggerIn
                      key={`${pair.a}-${pair.b}`}
                      index={pairPageStart + index}
                    >
                      <div className="rounded border-[2px] border-gray-900 bg-canvas p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <PipelineChip pipelineId={pair.a} />
                          <span className="font-mono text-xs text-muted">vs</span>
                          <PipelineChip pipelineId={pair.b} />
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink">
                          <span>
                            overlap{" "}
                            <span className="font-bold">
                              {pair.overlap}/{maxOverlap}
                            </span>
                          </span>
                          <span>
                            rank gap{" "}
                            <span className="font-bold">
                              {formatScore(pair.mean_rank_gap)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </StaggerIn>
                    );
                  })}
                </div>

                <Pagination
                  page={pairPage}
                  pageCount={pairPageCount}
                  onPageChange={setPairPage}
                  total={battle.pairwise.length}
                  pageSize={PAIR_PAGE_SIZE}
                  className="border-t-[3px] border-gray-900"
                />
              </section>
            </div>
          )}

          {/* ------------------------------------------------
              BATTLE GRID
              ------------------------------------------------ */}

          {resultsTab === "grid" && battle && (
          <section className="rounded border-[3px] border-gray-900 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="font-pixelify text-sm font-bold text-ink">
                Battle grid
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Rank of each paper under each pipeline. Empty cell =
                the paper did not make that pipeline's top-{battle.top_k}.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b-[3px] border-gray-900">
                    <th className="px-4 py-3 text-xs uppercase tracking-wide text-muted">
                      Paper
                    </th>
                    {BATTLE_IDS.map((id) => (
                      <th
                        key={id}
                        className="whitespace-nowrap px-2 py-3 text-right"
                      >
                        <PipelineChip pipelineId={id} />
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pagedGridPapers.map((entry, index) => (
                    <StaggerIn
                      as="tr"
                      key={entry.paper_id}
                      index={gridPageStart + index}
                      className="border-b border-gray-200 last:border-b-0"
                    >
                      <td className="max-w-[260px] px-4 py-3">
                          <p className="truncate font-medium text-ink">
                            {entry.title ?? `Paper #${entry.paper_id}`}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            #{entry.paper_id}
                            {entry.year ? ` · ${entry.year}` : ""}
                          </p>
                        </td>

                        {BATTLE_IDS.map((id) => {
                          const rank = rankById(id, entry.paper_id);
                          const score = scoreById(id, entry.paper_id);

                          return (
                            <td
                              key={id}
                              className="whitespace-nowrap px-2 py-3 text-right"
                            >
                              {rank === null ? (
                                <span className="inline-block min-w-[52px] text-muted">—</span>
                              ) : (
                                <span className="inline-flex min-w-[52px] flex-col items-end">
                                  <span className="font-mono text-sm font-bold leading-5 text-ink">
                                    #{rank}
                                  </span>
                                  <span className="font-mono text-xs leading-5 text-muted">
                                    {formatScore(score)}
                                  </span>
                                </span>
                              )}
                            </td>
                          );
                        })}
                    </StaggerIn>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={gridPage}
                pageCount={gridPageCount}
                onPageChange={setGridPage}
                total={gridPapers.length}
                pageSize={GRID_PAGE_SIZE}
                className="border-t-[3px] border-gray-900"
              />
            </div>
          </section>
          )}

          {/* ------------------------------------------------
              SCORE BARS
              ------------------------------------------------ */}

          {resultsTab === "scores" && battle && (
          <section className="rounded border-[3px] border-gray-900 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <p className="text-sm font-bold text-ink">
                Score distribution
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Each pipeline's top 5 scores, scaled against the
                highest score across all pipelines for comparison.
              </p>
            </div>

            <div className="space-y-4 px-5 py-4">
              {(() => {
                const allScores = battle.pipelines.flatMap(
                  (pipeline) =>
                    pipeline.results.map((result) => result.score)
                );

                const globalMax =
                  allScores.length > 0
                    ? Math.max(...allScores)
                    : 0;

                return BATTLE_IDS.map((id) => {
                  const pipeline = battle.pipelines.find(
                    (entry) => entry.id === id
                  );

                  if (!pipeline || pipeline.results.length === 0) {
                    return null;
                  }

                  const maxScore = Math.max(
                    ...pipeline.results.map((result) => result.score)
                  );

                  return (
                    <div key={id}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <PipelineChip pipelineId={id} />
                          {id === battle.winner?.pipeline_id && (
                            <span className="animate-blink flex items-center gap-1 font-mono text-xs font-bold tracking-[0.2em] text-accent">
                              <Star className="h-3 w-3" />
                              WINNER
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-muted">
                          max {formatScore(maxScore)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {pipeline.results.slice(0, 5).map((result) => (
                          <div
                            key={result.paper_id}
                            className="flex items-center gap-3"
                          >
                            <span className="w-7 shrink-0 text-right font-mono text-xs text-muted">
                              #{pipeline.results.indexOf(result) + 1}
                            </span>

                            <div
                              className={`h-4 flex-1 overflow-hidden rounded border-[2px] border-gray-900 bg-field ${
                                id === battle.winner?.pipeline_id
                                  ? "ring-2 ring-gray-900"
                                  : ""
                              }`}
                            >
                              <div
                                className={`h-full ${
                                  id === battle.winner?.pipeline_id
                                    ? "bg-accent"
                                    : "bg-ink"
                                }`}
                                style={{
                                  width: `${
                                    globalMax > 0
                                      ? (result.score / globalMax) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>

                            <span className="w-14 shrink-0 font-mono text-xs text-muted">
                              {formatScore(result.score)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>
          )}

          {/* ------------------------------------------------
              INTERPRETATION — citation-ready result summaries
              ------------------------------------------------ */}

          {resultsTab === "cite" && battle && citations && (
            <section className="rounded border-[3px] border-gray-900 bg-white">
              <div className="border-b border-gray-200 px-5 py-4">
                <p className="font-pixelify text-sm font-bold text-ink">
                  Result interpretation
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  The current battle written up citation-style. Copy a
                  whole block into a manuscript, then fit it to your
                  sentence; every figure comes straight from this run.
                </p>
              </div>

              <div className="space-y-4 px-5 py-4">
                {citations.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded border-[2px] border-gray-900 bg-canvas p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
                        {entry.label}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void copyCitation(entry.id, entry.text)
                        }
                        className="rounded border-[2px] border-gray-900 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
                      >
                        {copiedCitation === entry.id
                          ? "Copied \u2713"
                          : "Copy"}
                      </button>
                    </div>
                    <p className="select-all whitespace-pre-wrap font-mono text-xs leading-5 text-ink">
                      {entry.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          </div>
        </div>
      )}

      {/* ======================================================
          BATTLE LOG — the scoreboard of past runs. Always here;
          a finished battle lands on top of it.
          ====================================================== */}

      <section
        aria-label="Battle log"
        data-arena-log=""
        className="mt-6 overflow-hidden rounded-lg border-[3px] border-gray-900 bg-white shadow-[4px_4px_0_rgba(0,0,0,0.2)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-gray-900 bg-gray-900 px-4 py-2 text-onInk">
          <p className="flex items-center gap-2 font-pixelify text-sm font-bold uppercase tracking-[0.2em]">
            <History className="h-4 w-4 text-accent" aria-hidden="true" />
            Battle log
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-onInk/80">
            {historyTotal} {historyTotal === 1 ? "run" : "runs"} · page {historyPage} of {historyPages}
          </p>
        </div>

        {history.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="animate-blink font-pixelify text-lg font-bold uppercase tracking-[0.2em] text-ink">
              No battles yet
            </p>
            <p className="mt-1 text-xs text-muted">Enter a query above and press start. Every battle is logged here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs [&_th]:align-middle [&_td]:align-middle">
                <thead>
                  <tr className="border-b-[3px] border-gray-900 bg-canvas">
                    <th className="w-12 px-4 py-2.5 text-right uppercase tracking-wide text-muted">#</th>
                    <th className="px-3 py-2.5 uppercase tracking-wide text-muted">Time</th>
                    <th className="px-3 py-2.5 uppercase tracking-wide text-muted">Query</th>
                    <th className="px-3 py-2.5 text-left uppercase tracking-wide text-muted">Winner</th>
                    <th className="px-4 py-2.5 text-right uppercase tracking-wide text-muted">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run, index) => {
                    const fresh = index === 0 && historyPage === 1 && battle !== null && !webMode && !loading;

                    return (
                      <StaggerIn
                        as="tr"
                        key={run.id}
                        index={index}
                        className={`border-b border-gray-200 last:border-b-0 ${fresh ? "shadow-[inset_4px_0_0_rgb(var(--accent))]" : ""}`}
                      >
                        <td className="px-4 py-3 text-right font-mono text-muted">
                          {historyTotal - ((historyPage - 1) * HISTORY_PAGE_SIZE + index)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-muted">
                          {formatRunTime(run.created_at)}
                          {fresh && (
                            <span className="animate-blink ml-2 rounded bg-accent px-1 py-0.5 text-[9px] font-bold tracking-[0.15em] text-onAccent">
                              NEW
                            </span>
                          )}
                        </td>
                        <td className="max-w-[280px] px-3 py-3">
                          <p className="truncate font-medium text-ink">
                            {run.query ?? `Seed paper #${run.seed_paper_id}`}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-left">
                          <div className="w-full">
                            <PipelineChip pipelineId={run.winner_pipeline_id} grow />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-ink">
                          {run.winner_value != null
                            ? run.winner_metric === "independence_weighted_consensus"
                              ? `${(run.winner_value * 100).toFixed(0)}%`
                              : `${run.winner_value.toFixed(2)}/6`
                            : "—"}
                        </td>
                      </StaggerIn>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 px-4 py-3">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                Winner score spread (this page)
              </p>
              <FreqBars data={scoreBuckets} ariaLabel="Winner score frequency distribution" />
            </div>

            <Pagination
              page={historyPage}
              pageCount={historyPages}
              onPageChange={(next) => void loadHistory(next)}
              total={historyTotal}
              pageSize={HISTORY_PAGE_SIZE}
              className="border-t-[3px] border-gray-900"
            />
          </>
        )}
      </section>
        </>
      )}
    </PageShell>
  );
}