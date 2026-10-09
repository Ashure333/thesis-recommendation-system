import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Download,
  Layers,
  Trophy,
} from "lucide-react";

import {
  exportTournament,
  GatherJob,
  gatherLiterature,
  getGatherStatus,
  getTournament,
  getTournamentHistory,
  getTournamentPool,
  linkReferences,
  runTournament,
  TournamentExportFormat,
  TournamentMetric,
  TournamentOutcome,
  TournamentPair,
  TournamentResult,
  TournamentRunSummary,
} from "../api";
import { pipelineConfigs, pipelineName } from "../data/pipelineConfigs";
import GatherProgress from "./GatherProgress";
import PixelProgress from "./retro/PixelProgress";
import RetroDialog from "./retro/RetroDialog";
import { Star } from "./retro/PixelIcons";

/* ============================================================
   TOURNAMENT PANEL
   The statistically grounded sibling of the battle. Same cabinet:
   a marquee, the screen (the rules + press start) and a high-score
   board; then a numbered rail of result tabs and a log.

   Every pipeline is scored on many leave-one-out citation queries
   against the paper's real references, and paired tests decide
   whether anyone is actually better. Unlike the single-bout
   consensus winner, a verdict here can honestly be "tie" or
   "inconclusive".
   ============================================================ */

const configById = new Map(pipelineConfigs.map((c) => [c.id, c]));

function name(id: string): string {
  const config = configById.get(id);
  return config ? pipelineName(config) : id;
}

const METRIC_LABELS: Record<TournamentMetric, string> = {
  ndcg: "nDCG@k",
  mrr: "MRR@k",
  recall: "Recall@20",
  hit: "Hit@k",
};

const OUTCOME_COPY: Record<TournamentOutcome, { title: string; blink: boolean }> =
  {
    winner: { title: "WINNER", blink: true },
    tie: { title: "TIE GROUP · NO SINGLE WINNER", blink: false },
    inconclusive: { title: "INCONCLUSIVE · NEED MORE QUERIES", blink: false },
  };

const RESULT_TABS = [
  { id: "verdict", label: "Verdict", icon: Trophy },
  { id: "board", label: "Leaderboard", icon: BarChart3 },
  { id: "pairwise", label: "Pairwise", icon: ArrowLeftRight },
  { id: "metrics", label: "Metrics", icon: Layers },
  { id: "data", label: "Data", icon: Download },
] as const;

type ResultTab = (typeof RESULT_TABS)[number]["id"];

const EXPORT_MIME: Record<TournamentExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  pairwise: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
};

const EXPORT_LABELS: Record<TournamentExportFormat, string> = {
  csv: "Per-query scores (CSV)",
  pairwise: "Pairwise tests (CSV)",
  json: "Full record (JSON)",
};

function fmt(value: number, digits = 3): string {
  return value.toFixed(digits);
}

/** "p < 0.001" / "p = 0.043" -- the operator belongs to the value. */
function fmtP(p: number): string {
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}

/** Hand a text export to the browser under the server's filename. */
function saveText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* Shared control styles: light buttons for panels, dark for the screen. */
const BTN =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded border-[3px] border-gray-900 bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-ink transition-colors pixel-ease hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-50";

const SCREEN_BTN =
  "rounded border-[2px] border-onInk/40 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-onInk/80 transition-colors pixel-ease hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";

const SCREEN_INPUT =
  "h-8 w-full min-w-0 rounded border-[2px] border-onInk/40 bg-gray-950 px-2 font-mono text-xs text-onInk placeholder:text-onInk/40 focus:border-accent focus:outline-none disabled:opacity-60";

function ScreenField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      title={hint}
      className="flex min-w-0 flex-col gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-onInk/80"
    >
      {label}
      {children}
    </label>
  );
}

/* ------------------------------------------------------------
   THE PANEL
   ------------------------------------------------------------ */

export default function TournamentPanel() {
  const [nQueries, setNQueries] = useState(60);
  const [topK, setTopK] = useState(10);
  const [minRefs, setMinRefs] = useState(3);
  const [metric, setMetric] = useState<TournamentMetric>("ndcg");
  const [seed, setSeed] = useState(0);
  const [label, setLabel] = useState("");

  const [pool, setPool] = useState<{
    available: number;
    required: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [linking, setLinking] = useState(false);
  const [job, setJob] = useState<GatherJob | null>(null);
  const gathering = job?.state === "running";
  const [gatherOpen, setGatherOpen] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [poolTick, setPoolTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [history, setHistory] = useState<TournamentRunSummary[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [tab, setTab] = useState<ResultTab>("verdict");

  const busy = running || gathering || linking;

  function refreshHistory() {
    getTournamentHistory(1, 100)
      .then((data) => {
        setHistory(data.runs);
        setHistoryTotal(data.total);
      })
      .catch(() => {
        setHistory([]);
        setHistoryTotal(0);
      });
  }

  useEffect(refreshHistory, []);

  useEffect(() => {
    let cancelled = false;
    getTournamentPool(minRefs)
      .then((data) => {
        if (!cancelled)
          setPool({
            available: data.available,
            required: data.required_n_for_0_05,
          });
      })
      .catch(() => {
        if (!cancelled) setPool(null);
      });
    return () => {
      cancelled = true;
    };
  }, [minRefs, poolTick]);

  async function start() {
    setRunning(true);
    setError(null);
    setLinkNote(null);
    try {
      const data = await runTournament({
        topK,
        nQueries,
        minRefs,
        primaryMetric: metric,
        seed,
        label,
      });
      setResult(data);
      setTab("verdict");
      refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tournament failed.");
    } finally {
      setRunning(false);
    }
  }

  async function link() {
    setLinking(true);
    setError(null);
    setLinkNote(null);
    try {
      const out = await linkReferences();
      setLinkNote(
        `Linked ${out.rows_linked} references to library papers` +
          (out.failed_batches
            ? ` (${out.failed_batches} lookup batch(es) failed; try again).`
            : "."),
      );
      setPoolTick((tick) => tick + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Linking failed.");
    } finally {
      setLinking(false);
    }
  }

  async function gather() {
    setGatherOpen(false);
    setError(null);
    setLinkNote(null);
    try {
      setJob(await gatherLiterature(300));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gathering failed.");
    }
  }

  /* Pick up a gather that is already running (page reload) once. */
  useEffect(() => {
    getGatherStatus()
      .then((status) => {
        if (status.state === "running") setJob(status);
      })
      .catch(() => undefined);
  }, []);

  /* Poll while a gather runs; refresh the eligible count when done. */
  useEffect(() => {
    if (job?.state !== "running") return;
    const timer = window.setInterval(() => {
      getGatherStatus()
        .then((status) => {
          setJob(status);
          if (status.state !== "running") setPoolTick((tick) => tick + 1);
        })
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job?.state]);

  async function load(id: number) {
    setError(null);
    try {
      setResult(await getTournament(id));
      setTab("verdict");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load run.");
    }
  }

  /* High scores: tournaments won per pipeline, from the full log. */
  const board = useMemo(() => {
    const wins = new Map<string, number>();
    for (const run of history) {
      if (run.outcome === "winner" && run.winner_pipeline_id) {
        wins.set(
          run.winner_pipeline_id,
          (wins.get(run.winner_pipeline_id) ?? 0) + 1,
        );
      }
    }
    const decisive = [...wins.values()].reduce((sum, n) => sum + n, 0);
    const rows = pipelineConfigs
      .map((c) => ({ id: c.id, wins: wins.get(c.id) ?? 0 }))
      .sort((a, b) => b.wins - a.wins);
    return { rows, decisive, undecided: history.length - decisive };
  }, [history]);

  const status = running
    ? "Scoring"
    : gathering
      ? "Gathering"
      : result
        ? "Tournament complete"
        : "Insert coin";

  return (
    <div className="space-y-3">
      {/* ======================================================
          THE CABINET
          ====================================================== */}
      <section
        aria-label="Tournament cabinet"
        className="overflow-hidden rounded-lg border-[3px] border-gray-900 bg-gray-900 text-onInk shadow-[6px_6px_0_rgba(0,0,0,0.25)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-gray-900 bg-accent px-3 py-1.5 text-onAccent">
          <p className="flex items-center gap-2 font-pixelify text-lg font-bold uppercase leading-none tracking-[0.2em]">
            <Star className="h-4 w-4" aria-hidden="true" />
            Tournament
            <Star className="h-4 w-4" aria-hidden="true" />
          </p>
          <p
            aria-live="polite"
            className={`font-mono text-xs font-bold uppercase tracking-[0.25em] ${
              busy || !result ? "animate-blink" : ""
            }`}
          >
            {status}
          </p>
        </div>

        <div className="grid gap-2 p-2.5 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* THE SCREEN */}
          <div className="rounded border-[3px] border-black/60 bg-gray-950 p-3 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),inset_0_0_36px_rgba(0,0,0,0.55)]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-onInk">
              Player one · set the rules
            </p>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-b-[3px] border-accent pb-3 sm:grid-cols-3 xl:grid-cols-6">
              <ScreenField label="Queries" hint="Papers to use as queries">
                <input
                  className={SCREEN_INPUT}
                  type="number"
                  min={2}
                  max={300}
                  value={nQueries}
                  disabled={busy}
                  onChange={(e) => setNQueries(Number(e.target.value) || 2)}
                />
              </ScreenField>
              <ScreenField label="Top-k" hint="List length the metrics score">
                <input
                  className={SCREEN_INPUT}
                  type="number"
                  min={1}
                  max={50}
                  value={topK}
                  disabled={busy}
                  onChange={(e) => setTopK(Number(e.target.value) || 1)}
                />
              </ScreenField>
              <ScreenField
                label="Min refs"
                hint="A paper needs this many resolved references to be a query"
              >
                <input
                  className={SCREEN_INPUT}
                  type="number"
                  min={1}
                  max={20}
                  value={minRefs}
                  disabled={busy}
                  onChange={(e) => setMinRefs(Number(e.target.value) || 1)}
                />
              </ScreenField>
              <ScreenField
                label="Metric"
                hint="Chosen before the run; it decides the verdict"
              >
                <select
                  className={SCREEN_INPUT}
                  value={metric}
                  disabled={busy}
                  onChange={(e) =>
                    setMetric(e.target.value as TournamentMetric)
                  }
                >
                  {(Object.keys(METRIC_LABELS) as TournamentMetric[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {METRIC_LABELS[key]}
                      </option>
                    ),
                  )}
                </select>
              </ScreenField>
              <ScreenField label="Seed" hint="Fixes sampling and resampling">
                <input
                  className={SCREEN_INPUT}
                  type="number"
                  value={seed}
                  disabled={busy}
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
                />
              </ScreenField>
              <ScreenField label="Label">
                <input
                  className={SCREEN_INPUT}
                  type="text"
                  maxLength={60}
                  value={label}
                  placeholder="optional"
                  disabled={busy}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </ScreenField>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={SCREEN_BTN}
                onClick={() => void link()}
                disabled={busy}
                title="Match each paper's cached references to papers in your library (OpenAlex lookup)"
              >
                {linking ? "Linking…" : "Link references"}
              </button>
              <button
                type="button"
                className={SCREEN_BTN}
                onClick={() => setGatherOpen(true)}
                disabled={busy}
                title="Import the works your papers cite (from OpenAlex) so there are references to score against"
              >
                {gathering ? "Gathering…" : "Gather literature"}
              </button>

              <button
                type="button"
                onClick={() => void start()}
                disabled={busy || (pool != null && pool.available < 2)}
                className={`ml-auto rounded border-[3px] border-black/60 bg-accent px-5 py-1.5 font-pixelify text-base font-bold uppercase tracking-[0.2em] text-onAccent shadow-[0_4px_0_rgba(0,0,0,0.45)] transition-all pixel-ease hover:brightness-110 active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.45)] disabled:cursor-not-allowed disabled:opacity-50 ${
                  !busy && (pool == null || pool.available >= 2)
                    ? "animate-blink"
                    : ""
                }`}
              >
                {running ? "Running…" : "Press start"}
              </button>
            </div>

            {/* what the screen says: the live job, or the attract text */}
            <div className="mt-2 border-t-2 border-dashed border-onInk/25 pt-2">
              {running ? (
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-onInk">
                    Scoring {Math.min(nQueries, pool?.available ?? nQueries)}{" "}
                    queries across every pipeline
                  </p>
                  <PixelProgress
                    value={null}
                    stage="SEARCHING, SCORING, TESTING"
                    className="mt-2 w-full"
                  />
                </div>
              ) : job && job.state !== "idle" ? (
                <GatherProgress job={job} />
              ) : (
                <>
                  <p className="font-mono text-xs leading-5 text-onInk/90">
                    {pool
                      ? `${pool.available} eligible ${
                          pool.available === 1 ? "query" : "queries"
                        }${
                          pool.available < nQueries
                            ? ` (fewer than the ${nQueries} requested)`
                            : ""
                        } · detecting a 0.05 nDCG gap at SD 0.2 needs about ${pool.required}.`
                      : "Checking eligible queries…"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-onInk/80">
                    Each query is a paper&apos;s own title, abstract and
                    keywords; the relevant set is its resolved references
                    (grade 2) and citers (grade 1). The paper and its
                    duplicates are hidden from every pipeline, and the winner
                    must beat every rival in paired tests, not just lead on
                    average.
                  </p>
                </>
              )}

              {pool != null && pool.available < 2 && !running && (
                <p className="mt-2 text-xs leading-5 text-onInk/80">
                  No paper has {minRefs}+ references that resolve to other
                  papers in your library, so there is nothing to score
                  against. Press <strong>Link references</strong>, or{" "}
                  <strong>Gather literature</strong> to import the works they
                  cite.
                </p>
              )}
              {linkNote && (
                <p className="mt-2 font-mono text-xs text-onInk/80">
                  {linkNote}
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
            <ol className="mt-2 space-y-1.5">
              {board.rows.map((entry, index) => {
                const share =
                  board.decisive > 0 ? entry.wins / board.decisive : 0;
                return (
                  <li key={entry.id} className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-right text-onInk/85">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold tracking-[0.1em] text-onInk">
                        {name(entry.id)}
                      </span>
                      {index === 0 && entry.wins > 0 && (
                        <Star
                          className="animate-blink h-3 w-3 text-accent"
                          aria-label="Champion"
                        />
                      )}
                      <span className="w-8 text-right font-bold text-onInk">
                        {entry.wins}
                      </span>
                    </div>
                    <div
                      className="ml-6 mt-0.5 h-1 overflow-hidden bg-onInk/15"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${Math.round(share * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-auto border-t border-onInk/20 pt-2 font-mono text-[10px] font-bold uppercase leading-4 tracking-[0.15em] text-onInk/75">
              {historyTotal} {historyTotal === 1 ? "tournament" : "tournaments"}{" "}
              run
              {board.undecided > 0
                ? ` · ${board.undecided} without a winner`
                : ""}
            </p>
          </aside>
        </div>
      </section>

      {error && <div className="status-error">{error}</div>}

      {/* ======================================================
          RESULTS
          ====================================================== */}
      {result && !running && (
        <TournamentResults
          result={result}
          tab={tab}
          onTab={setTab}
          onError={setError}
        />
      )}

      {/* ======================================================
          LOG
          ====================================================== */}
      <section
        aria-label="Tournament log"
        className="rounded border-[3px] border-gray-900 bg-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-gray-900 bg-canvas px-3 py-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Tournament log · {historyTotal}{" "}
            {historyTotal === 1 ? "run" : "runs"}
          </p>
        </div>
        {history.length === 0 ? (
          <div className="px-3 py-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink">
              No tournaments yet
            </p>
            <p className="mt-1 text-xs text-ink/70">
              Press start above. Every tournament is logged here with its
              verdict and every per-query score.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-900/20 text-xs">
            {history.slice(0, 10).map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 font-mono">
                  #{run.id} · {new Date(run.created_at).toLocaleString()} ·{" "}
                  {run.n_queries} queries
                  {run.label ? ` · ${run.label}` : ""} ·{" "}
                  <strong>
                    {run.outcome === "winner" && run.winner_pipeline_id
                      ? `winner ${name(run.winner_pipeline_id)}`
                      : run.outcome}
                  </strong>
                </span>
                <button
                  type="button"
                  className={BTN}
                  onClick={() => void load(run.id)}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RetroDialog
        open={gatherOpen}
        title="Gather literature"
        confirmLabel="Gather up to 300"
        cancelLabel="Not now"
        onCancel={() => setGatherOpen(false)}
        onConfirm={() => void gather()}
      >
        <div className="flex flex-col gap-2.5">
          <p className="text-ink">
            Look up reference lists and fetch the works your papers cite from OpenAlex, adding up to{" "}
            <span className="font-bold">300</span> of them to your library,
            so the tournament has references to score against.
          </p>

          <ul className="list-disc space-y-1 pl-5 text-ink">
            <li>
              Papers with no cached reference list get theirs first, so they
              can act as queries; then references are linked to your library.
            </li>
            <li>
              Most-cited references still missing come next; works without an
              abstract are skipped.
            </li>
            <li>Papers you already have are linked, not duplicated.</li>
            <li>
              The recommendation index is rebuilt afterwards, which can take
              a few minutes.
            </li>
          </ul>

          <p className="select-all rounded border-[2px] border-gray-900 bg-canvas px-2 py-1 font-mono text-[11px] text-ink">
            extraction_method = &quot;openalex-gather&quot;
          </p>

          <p className="text-muted">
            Added papers carry the tag above, so you can find them again.
          </p>
        </div>
      </RetroDialog>
    </div>
  );
}

/* ------------------------------------------------------------
   RESULTS: the cartridge rail and one panel per result type
   ------------------------------------------------------------ */

function TournamentResults({
  result,
  tab,
  onTab,
  onError,
}: {
  result: TournamentResult;
  tab: ResultTab;
  onTab: (tab: ResultTab) => void;
  onError: (message: string | null) => void;
}) {
  const { verdict } = result;
  const copy = OUTCOME_COPY[verdict.outcome];
  const metricName =
    METRIC_LABELS[result.primary_metric]?.replace("k", String(result.top_k)) ??
    result.primary_metric;

  const groupOf = useMemo(() => {
    const map = new Map<string, number>();
    verdict.tie_groups.forEach((group, index) =>
      group.forEach((id) => map.set(id, index)),
    );
    return map;
  }, [verdict.tie_groups]);

  const maxHi = Math.max(0.0001, ...verdict.ranking.map((row) => row.hi));
  const pct = (value: number) => `${Math.min(100, (value / maxHi) * 100)}%`;

  const pairs = useMemo(() => {
    const map = new Map<string, TournamentPair>();
    verdict.pairwise.forEach((p) => map.set(`${p.a}|${p.b}`, p));
    return map;
  }, [verdict.pairwise]);

  const order = verdict.ranking.map((row) => row.pipeline);

  return (
    <div className="space-y-3">
      {/* RAIL */}
      <div className="overflow-x-auto rounded border-[3px] border-gray-900 bg-gray-900 p-1.5">
        <div
          role="tablist"
          aria-label="Tournament results"
          className="flex min-w-max gap-1.5"
        >
          {RESULT_TABS.map(({ id, label, icon: Icon }, index) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={label}
                onClick={() => onTab(id)}
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

      <div key={tab} className="animate-step-in space-y-3">
        {/* ---------------- VERDICT ---------------- */}
        {tab === "verdict" && (
          <section className="rounded border-[3px] border-gray-900 bg-gray-900 p-3 text-onInk">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 basis-80">
                <p
                  className={`flex items-center gap-2 font-mono text-xs font-bold tracking-[0.3em] text-accent ${
                    copy.blink ? "animate-blink" : ""
                  }`}
                >
                  <Star className="h-3.5 w-3.5" />
                  {copy.title}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {verdict.winner ? (
                    <>
                      <span className="rounded border-[2px] border-gray-900 bg-surface px-2 py-1 font-mono text-sm font-bold tracking-[0.12em] text-ink">
                        {name(verdict.winner)}
                      </span>
                      <span className="font-mono text-xs text-onInk/70">
                        {verdict.winner}
                      </span>
                    </>
                  ) : (
                    verdict.top_group?.map((id) => (
                      <span
                        key={id}
                        className="rounded border-[2px] border-gray-900 bg-surface px-2 py-1 font-mono text-sm font-bold tracking-[0.12em] text-ink"
                      >
                        {name(id)}
                      </span>
                    ))
                  )}
                </div>

                <p className="mt-2 text-xs leading-5 text-onInk/70">
                  {verdict.reason} {result.n_queries} queries scored
                  {result.dropped.length > 0
                    ? `, ${result.dropped.length} dropped`
                    : ""}
                  ; {metricName} was fixed before the run.{" "}
                  {verdict.omnibus
                    ? `Omnibus Friedman χ²(${verdict.omnibus.df}) = ${fmt(
                        verdict.omnibus.statistic,
                        2,
                      )}, ${fmtP(verdict.omnibus.p_value)}.`
                    : ""}{" "}
                  Seed {result.seed}.
                </p>
              </div>

              {verdict.ranking[0] && (
                <div className="ml-auto shrink-0 text-right">
                  <p className="font-mono text-3xl font-bold leading-none text-accent">
                    {fmt(verdict.ranking[0].mean, 2)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-onInk/70">
                    top mean {metricName}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---------------- LEADERBOARD ---------------- */}
        {tab === "board" && (
          <section className="rounded border-[3px] border-gray-900 bg-surface p-3">
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-ink">
              LEADERBOARD · MEAN {metricName.toUpperCase()} WITH 95% CI
            </p>
            <ol className="mt-2 space-y-2">
              {verdict.ranking.map((row, index) => {
                const group = groupOf.get(row.pipeline) ?? 0;
                const tied = verdict.tie_groups[group]?.length > 1;
                return (
                  <li
                    key={row.pipeline}
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-1 sm:grid-cols-[1.5rem_9rem_minmax(0,1fr)_11rem_2rem]"
                  >
                    <span className="font-mono text-xs text-ink/70">
                      {index + 1}
                    </span>
                    <span className="truncate font-mono text-xs font-bold">
                      {name(row.pipeline)}
                    </span>
                    <div className="relative order-last col-span-3 h-4 rounded bg-gray-900/10 sm:order-none sm:col-span-1">
                      <div
                        className="absolute inset-y-0 left-0 rounded bg-accent/70"
                        style={{ width: pct(row.mean) }}
                      />
                      <div
                        className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-gray-900"
                        style={{
                          left: pct(row.lo),
                          width: `calc(${pct(row.hi)} - ${pct(row.lo)})`,
                        }}
                        title={`${fmt(row.lo)} – ${fmt(row.hi)}`}
                      />
                    </div>
                    <span className="hidden text-right font-mono text-xs tabular-nums sm:block">
                      {fmt(row.mean)} [{fmt(row.lo)}, {fmt(row.hi)}]
                    </span>
                    <span
                      className="text-right font-mono text-xs font-bold"
                      title={tied ? "Not separable from its group" : "Alone"}
                    >
                      {tied ? `G${group + 1}` : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-ink/70">
              Pipelines sharing a G-label are not statistically separable
              after Holm correction. Overlapping intervals alone are not the
              test; the Pairwise tab is.
            </p>
          </section>
        )}

        {/* ---------------- PAIRWISE ---------------- */}
        {tab === "pairwise" && (
          <section className="overflow-x-auto rounded border-[3px] border-gray-900 bg-surface p-3">
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-ink">
              PAIRWISE SIGNIFICANCE · ROW MINUS COLUMN
            </p>
            <table className="mt-2 w-full min-w-[640px] table-fixed border-collapse text-xs">
              <colgroup>
                <col className="w-36" />
                {order.map((id) => (
                  <col key={id} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th />
                  {order.map((id) => (
                    <th
                      key={id}
                      className="truncate px-1 pb-1 text-center font-mono"
                      title={name(id)}
                    >
                      {name(id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.map((rowId, i) => (
                  <tr key={rowId}>
                    <th
                      className="truncate pr-2 text-left font-mono"
                      title={name(rowId)}
                    >
                      {name(rowId)}
                    </th>
                    {order.map((colId, j) => {
                      if (i === j)
                        return (
                          <td
                            key={colId}
                            className="bg-gray-900/10 text-center"
                          >
                            —
                          </td>
                        );
                      const forward = pairs.get(`${rowId}|${colId}`);
                      const backward = pairs.get(`${colId}|${rowId}`);
                      const pair = forward ?? backward;
                      if (!pair) return <td key={colId} />;
                      const sign = forward ? 1 : -1;
                      const diff = pair.mean_diff * sign;
                      return (
                        <td
                          key={colId}
                          className={`border border-gray-900/20 p-1 text-center font-mono ${
                            pair.significant
                              ? diff > 0
                                ? "bg-accent/30 font-bold"
                                : "bg-red-500/25 font-bold"
                              : ""
                          }`}
                          title={`Δ ${fmt(diff)} (95% CI ${fmt(
                            forward ? pair.lo : -pair.hi,
                          )} to ${fmt(
                            forward ? pair.hi : -pair.lo,
                          )}), Cliff's δ ${fmt(
                            pair.cliffs_delta * sign,
                            2,
                          )}, Holm ${fmtP(pair.p_adjusted)}`}
                        >
                          {diff >= 0 ? "+" : ""}
                          {fmt(diff)}
                          <br />
                          <span className="text-[10px] font-normal text-ink/70">
                            {fmtP(pair.p_adjusted)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink/70">
              Shaded cells are significant after Holm correction. Hover a cell
              for the CI on the difference and Cliff&apos;s δ. A significant
              but tiny difference is not a meaningful win.
            </p>
          </section>
        )}

        {/* ---------------- METRICS ---------------- */}
        {tab === "metrics" && (
          <section className="overflow-x-auto rounded border-[3px] border-gray-900 bg-surface p-3">
            <p className="font-mono text-xs font-bold tracking-[0.2em] text-ink">
              SECONDARY METRICS · NOT USED FOR THE VERDICT
            </p>
            <table className="mt-2 w-full min-w-[480px] text-xs">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                  <th className="pb-1">Pipeline</th>
                  {Object.keys(result.secondary).map((key) => (
                    <th key={key} className="pb-1">
                      {METRIC_LABELS[key as TournamentMetric]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.map((id) => (
                  <tr key={id} className="font-mono">
                    <td className="py-0.5 font-bold">{name(id)}</td>
                    {Object.entries(result.secondary).map(
                      ([key, byPipeline]) => {
                        const cell = byPipeline[id];
                        return (
                          <td key={key}>
                            {cell
                              ? `${fmt(cell.mean)} [${fmt(cell.lo)}, ${fmt(cell.hi)}]`
                              : "—"}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ---------------- DATA ---------------- */}
        {tab === "data" && (
          <DataPanel result={result} onError={onError} />
        )}
      </div>
    </div>
  );
}

/** Run facts and the export picker, laid out like the battle log's. */
function DataPanel({
  result,
  onError,
}: {
  result: TournamentResult;
  onError: (message: string | null) => void;
}) {
  const [format, setFormat] = useState<TournamentExportFormat>("csv");
  const [downloading, setDownloading] = useState(false);
  const runId = result.run_id;

  async function download() {
    if (runId == null) return;
    setDownloading(true);
    onError(null);
    try {
      const payload = await exportTournament(runId, format);
      saveText(payload.filename, payload.text, EXPORT_MIME[format]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setDownloading(false);
    }
  }

  const facts: [string, string][] = [
    ["Run", runId != null ? `#${runId}` : "unsaved"],
    ["Queries", `${result.n_queries} (${result.dropped.length} dropped)`],
    ["Pipelines", String(result.pipelines.length)],
    ["Metric", `${result.primary_metric}@${result.top_k}`],
    ["Min refs", String(result.min_refs)],
    ["Seed", String(result.seed)],
  ];

  return (
    <section className="rounded border-[3px] border-gray-900 bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b-[3px] border-gray-900 bg-canvas px-3 py-2">
        <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export
          <select
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as TournamentExportFormat)
            }
            disabled={downloading || runId == null}
            aria-label="Export format"
            className="h-9 rounded border-[3px] border-gray-900 bg-surface px-2 font-mono text-[11px] normal-case tracking-normal text-ink"
          >
            {(Object.keys(EXPORT_LABELS) as TournamentExportFormat[]).map(
              (key) => (
                <option key={key} value={key}>
                  {EXPORT_LABELS[key]}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading || runId == null}
          title={runId == null ? "Unsaved runs can't be exported" : undefined}
          className={BTN}
        >
          {downloading ? "Exporting…" : "Download"}
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-3 font-mono text-xs sm:grid-cols-3">
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              {key}
            </dt>
            <dd className="font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="border-t border-gray-900/20 px-3 py-2 text-xs text-ink/70">
        The per-query CSV has one row per pipeline per query, enough to
        re-run any test elsewhere. The JSON holds the whole verdict, the
        secondary metrics and the dropped queries.
      </p>
    </section>
  );
}
