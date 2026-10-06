import { useEffect, useRef, useState } from "react";
import {
  comparePipelines,
  webComparePipelines,
  type CompareResponse,
} from "../../api";
import { pipelineConfigs, adjustDialAllocation } from "../../data/pipelineConfigs";
import PixelProgress from "../../components/retro/PixelProgress";
import FreqBars from "../../components/retro/FreqBars";
import Pagination from "../../components/retro/Pagination";
import TreeOfKnowledge from "../../components/retro/TreeOfKnowledge";
import SunGlyph from "../../components/retro/SunGlyph";
import TokenGlyph from "../../components/retro/TokenGlyph";
import {
  knowledgeStageFromHeight,
  nextKnowledgeHeight,
  TREE_GROWTH_MARKERS,
  TREE_GROWTH_TARGET,
  KNOWLEDGE_STAGES,
} from "../../data/knowledge";
import { useSun } from "../../state/sun";
import SunShop from "../../components/retro/SunShop";
import StatsForNerds from "../../components/StatsForNerds";
import { PageHeader } from "../../components/ui";
import { ArrowRight } from "../../components/retro/PixelIcons";

/* ============================================================
   LAB — the recipe workshop.
   Build a custom algorithm recipe from the three signals with
   freely adjustable percentages, save recipes, then simulate a
   battle against the six presets. Every simulation is recorded
   in a local leaderboard with a win tally like the Arena's.
   ============================================================ */

interface Recipe {
  id: string;
  name: string;
  weights: { tfidf: number; sbert: number; metadata: number };
  /** Pre-loaded starter recipe, deletable like any other. */
  preset?: boolean;
}

interface LabRun {
  recipeName: string;
  weights: { tfidf: number; sbert: number; metadata: number };
  winnerPipelineId: string;
  winnerValue: number;
  createdAt: string;
}

const RECIPES_KEY = "paperrec_lab_recipes";
const BATTLES_KEY = "paperrec_lab_battles";
const SEEDED_KEY = "paperrec_lab_recipes_seeded";

/* Battle history shows five simulations per page, matching the
   Arena's records table. */
const LAB_RUNS_PAGE_SIZE = 5;

/* Pre-loaded recipes: two signal purists, an even split, the
   learned weights from the citation benchmark, and a
   metadata-heavy mix. They load into the dials in one click and
   battle like any saved recipe. */
const PRESET_RECIPES: Recipe[] = [
  {
    id: "preset-lexical",
    name: "Lexical Purist",
    weights: { tfidf: 100, sbert: 0, metadata: 0 },
    preset: true,
  },
  {
    id: "preset-semantic",
    name: "Semantic Purist",
    weights: { tfidf: 0, sbert: 100, metadata: 0 },
    preset: true,
  },
  {
    id: "preset-even",
    name: "Even Split",
    weights: { tfidf: 34, sbert: 33, metadata: 33 },
    preset: true,
  },
  {
    id: "preset-learned",
    name: "Citation Winner",
    weights: { tfidf: 10, sbert: 90, metadata: 0 },
    preset: true,
  },
  {
    id: "preset-biblio",
    name: "Bibliographer",
    weights: { tfidf: 20, sbert: 20, metadata: 60 },
    preset: true,
  },
];

/** Seed the starter recipes once per browser. */
function initialRecipes(): Recipe[] {
  const stored = readRecipes();

  if (stored.length > 0) return stored;

  try {
    if (window.localStorage.getItem(SEEDED_KEY)) return stored;

    window.localStorage.setItem(SEEDED_KEY, "1");
    window.localStorage.setItem(
      RECIPES_KEY,
      JSON.stringify(PRESET_RECIPES),
    );
  } catch {
    // best-effort
  }

  return PRESET_RECIPES;
}

const LABEL: Record<string, string> = {
  tfidf: "TF-IDF",
  sbert: "S-BERT",
  metadata: "Metadata",
};

function readRecipes(): Recipe[] {
  try {
    const raw = window.localStorage.getItem(RECIPES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readBattles(): LabRun[] {
  try {
    const raw = window.localStorage.getItem(BATTLES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBattles(runs: LabRun[]) {
  try {
    window.localStorage.setItem(BATTLES_KEY, JSON.stringify(runs));
  } catch {
    // best-effort
  }
}

export default function Lab() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(10);

  const [dials, setDials] = useState({ tfidf: 40, sbert: 40, metadata: 20 });
  const [recipeName, setRecipeName] = useState("My Recipe");
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);

  /* Experimental knobs beyond the three signals. */
  const [diversify, setDiversify] = useState(false);
  const [diversifyLambda, setDiversifyLambda] = useState(0.7);

  const [battle, setBattle] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // A newer simulation cancels the web fetch still in flight.
  const battleAbortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Web mode: battle the pipelines over live OpenAlex/Crossref/
     arXiv hits instead of the repository. */
  const [webMode, setWebMode] = useState(false);
  const [webSources, setWebSources] = useState(
    "openalex,crossref,arxiv",
  );
  const [webSort, setWebSort] = useState("relevance");
  const [openAccess, setOpenAccess] = useState(false);

  const [runs, setRuns] = useState<LabRun[]>(readBattles);
  const [runsPage, setRunsPage] = useState(1);



  const [tab, setTab] = useState<"recipe" | "garden" | "stats">(
    "recipe",
  );



  const total = dials.tfidf + dials.sbert + dials.metadata;
  const normalized = {
    tfidf: total > 0 ? Math.round((dials.tfidf / total) * 1000) / 10 : 0,
    sbert: total > 0 ? Math.round((dials.sbert / total) * 1000) / 10 : 0,
    metadata: total > 0 ? Math.round((dials.metadata / total) * 1000) / 10 : 0,
  };

  const currentRecipeName =
    recipes.find((r) => r.name === recipeName)?.name ?? recipeName;

  function setDial(key: "tfidf" | "sbert" | "metadata", value: number) {
    setDials((current) => adjustDialAllocation(current, key, value));
  }

  function saveRecipe() {
    const name = recipeName.trim() || "Unnamed Recipe";
    const id = `${name}-${Date.now()}`;
    const recipe: Recipe = { id, name, weights: { ...dials } };
    setRecipes((current) => {
      const next = [...current, recipe];
      try {
        window.localStorage.setItem(RECIPES_KEY, JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }

  function deleteRecipe(id: string) {
    setRecipes((current) => {
      const next = current.filter((recipe) => recipe.id !== id);
      try {
        window.localStorage.setItem(RECIPES_KEY, JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }

  function loadRecipe(recipe: Recipe) {
    setRecipeName(recipe.name);
    setDials({ ...recipe.weights });
  }

  async function runBattle() {
    if (!query.trim()) {
      setError("Enter a query to start the simulation.");
      return;
    }

    setLoading(true);
    setError(null);

    const startedAt = Date.now();

    battleAbortRef.current?.abort();
    const controller = new AbortController();
    battleAbortRef.current = controller;

    try {
      const customWeights = {
        tfidf: normalized.tfidf,
        sbert: normalized.sbert,
        metadata: normalized.metadata,
      };

      const data = webMode
        ? await webComparePipelines({
            q: query.trim(),
            topK,
            sources: webSources || "openalex,crossref,arxiv",
            sort: webSort,
            openAccess,
            customWeights,
            signal: controller.signal,
          })
        : await comparePipelines({
            query: query.trim(),
            topK,
            customWeights,
            mmrLambda: diversify ? diversifyLambda : undefined,
            recordBattle: false,
          });

      if (controller.signal.aborted) return;

      const elapsed = Date.now() - startedAt;
      if (elapsed < 2400) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 2400 - elapsed),
        );
      }

      setBattle(data);

      if (data.winner) {
        const run: LabRun = {
          recipeName: currentRecipeName,
          weights: { ...normalized },
          winnerPipelineId: data.winner.pipeline_id,
          winnerValue: data.winner.value,
          createdAt: new Date().toISOString(),
        };
        const next = [run, ...runs].slice(0, 60);
        setRuns(next);
        writeBattles(next);
        setRunsPage(1);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      setBattle(null);
      setError(
        err instanceof Error ? err.message : "Lab battle failed.",
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // Leaderboard: win tally across presets + recipes
  // ------------------------------------------------------------

  const tally = new Map<string, number>();
  for (const run of runs) {
    const key =
      run.winnerPipelineId === "custom"
        ? `custom:${run.recipeName}`
        : run.winnerPipelineId;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  const tallyRows = [...tally.entries()]
    .map(([key, wins]) => ({ key, wins }))
    .sort((a, b) => b.wins - a.wins);

  /* Battle history pages five simulations at a time. */
  const runsPageCount = Math.max(
    1,
    Math.ceil(runs.length / LAB_RUNS_PAGE_SIZE),
  );
  const safeRunsPage = Math.min(runsPage, runsPageCount);
  const pagedRuns = runs.slice(
    (safeRunsPage - 1) * LAB_RUNS_PAGE_SIZE,
    safeRunsPage * LAB_RUNS_PAGE_SIZE,
  );

  function tallyLabel(key: string): string {
    if (key.startsWith("custom:")) return key.slice("custom:".length);
    const config = pipelineConfigs.find((c) => c.id === key);
    return config?.codename ?? key;
  }

  const configById = new Map(
    pipelineConfigs.map((config) => [config.id, config]),
  );

  function pipelineLabel(id: string): string {
    if (id === "custom") return currentRecipeName;
    return configById.get(id)?.codename ?? id;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        eyebrow="Lab"
        title="Re:Search Laboratory"
        description="Combine the three signals into your own recipe, then test it against the six presets. The Tree of Knowledge gives one piece of system trivia per question."
      />

      <div className="mt-5 flex" role="tablist" aria-label="Lab sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recipe"}
          onClick={() => setTab("recipe")}
          className={`rounded-l border-[3px] border-gray-900 px-3 py-1.5 text-sm font-semibold transition pixel-ease ${
            tab === "recipe"
              ? "bg-accent text-onAccent"
              : "bg-surface text-ink hover:bg-accentSoft"
          }`}
        >
          Re:Search Laboratory
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "garden"}
          onClick={() => setTab("garden")}
          className={`-ml-[3px] border-[3px] border-gray-900 px-3 py-1.5 text-sm font-semibold transition pixel-ease ${
            tab === "garden"
              ? "bg-accent text-onAccent"
              : "bg-surface text-ink hover:bg-accentSoft"
          }`}
        >
          Garden
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stats"}
          onClick={() => setTab("stats")}
          className={`-ml-[3px] rounded-r border-[3px] border-gray-900 px-3 py-1.5 text-sm font-semibold transition pixel-ease ${
            tab === "stats"
              ? "bg-accent text-onAccent"
              : "bg-surface text-ink hover:bg-accentSoft"
          }`}
        >
          Stats for Nerds
        </button>
      </div>

      {tab === "recipe" && (
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ================= RECIPE BENCH ================= */}
        <section className="rounded border-[3px] border-gray-900 bg-white p-4">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
            Recipe bench
          </p>

          {(["tfidf", "sbert", "metadata"] as const).map((signal) => (
            <div key={signal} className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor={`lab-${signal}`}
                  className="filter-label !mb-0"
                >
                  {LABEL[signal]}
                </label>
                <span className="font-mono text-sm font-bold text-ink">
                  {dials[signal]}%
                </span>
              </div>
              <input
                id={`lab-${signal}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={dials[signal]}
                onChange={(e) => setDial(signal, Number(e.target.value))}
                className="w-full accent-[#f39c18]"
              />
            </div>
          ))}

          <div className="rounded border-[2px] border-gray-900 bg-canvas p-3 font-mono text-xs leading-5 text-ink">
            <p className="font-bold text-accent">S(d) =</p>
            <p className="mt-1">
              {normalized.tfidf / 100} · s'_tfidf(d)
              {normalized.sbert > 0 && (
                <>
                  <br />+ {normalized.sbert / 100} · s'_sbert(d)
                </>
              )}
              {normalized.metadata > 0 && (
                <>
                  <br />+ {normalized.metadata / 100} · s'_meta(d)
                </>
              )}
            </p>
          </div>

          {/* Experimental — extra knobs beyond the three signals */}
          <div className="mt-4 border-t-[2px] border-gray-200 pt-3">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
              Experimental
            </p>

            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={diversify}
                onChange={(event) =>
                  setDiversify(event.target.checked)
                }
                className="h-4 w-4"
              />
              Diversify every pipeline (MMR)
            </label>

            <label className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
              λ
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={diversifyLambda}
                disabled={!diversify}
                onChange={(event) =>
                  setDiversifyLambda(Number(event.target.value))
                }
                aria-label="MMR lambda"
                className="min-w-0 flex-1 accent-[#f39c18] disabled:opacity-40"
              />
              <span className="w-8 shrink-0 text-right font-bold text-ink">
                {diversifyLambda.toFixed(2)}
              </span>
            </label>

            <button
              type="button"
              onClick={() =>
                setDials({ tfidf: 10, sbert: 90, metadata: 0 })
              }
              className="mt-2 rounded border-[2px] border-gray-900 bg-white px-2 py-1 font-mono text-[10px] font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
            >
              Load learned weights (10/90/0)
            </button>

            <p className="mt-2 text-[10px] leading-4 text-muted">
              Learned weights come from an 18-query OpenAlex citation
              benchmark, where they beat the 40/40/20 hybrid by about
              0.06 NDCG; they are a research preset, not the deployed
              default. Diversification applies to repository battles —
              web battles ignore it.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="Recipe name"
              aria-label="Recipe name"
              className="min-w-0 flex-1 rounded border-[3px] border-gray-900 bg-field px-3 py-2 text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={saveRecipe}
              className="shrink-0 rounded border-[3px] border-gray-900 bg-accent px-3 py-2 text-sm font-semibold text-onAccent hover:brightness-110"
            >
              Save
            </button>
          </div>

          {recipes.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {recipes.map((recipe) => (
                <li
                  key={recipe.id}
                  className="flex items-center gap-2 rounded border-2 border-gray-900 bg-surface px-2 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => loadRecipe(recipe)}
                    title={`${recipe.weights.tfidf}/${recipe.weights.sbert}/${recipe.weights.metadata}`}
                    className="min-w-0 flex-1 truncate text-left text-sm font-bold text-ink hover:text-accent"
                  >
                    {recipe.name}
                  </button>
                  {recipe.preset && (
                    <span className="shrink-0 rounded border border-gray-900 px-1 font-mono text-[9px] font-bold uppercase tracking-wide text-muted">
                      preset
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {recipe.weights.tfidf}/
                    {recipe.weights.sbert}/
                    {recipe.weights.metadata}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRecipe(recipe.id)}
                    aria-label={`Delete ${recipe.name}`}
                    className="shrink-0 rounded border-2 border-gray-900 bg-white px-1.5 font-mono text-xs font-bold text-ink hover:bg-accent hover:text-onAccent"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ================= BATTLE SIM ================= */}
        <section className="flex flex-col gap-4">
          <div className="rounded border-[3px] border-gray-900 bg-white p-4">
            {/* Repository / Web scope switcher */}
            <div className="mb-3 flex items-center gap-2">
              {(["repository", "web"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setWebMode(scope === "web")}
                  aria-pressed={webMode === (scope === "web")}
                  className={`rounded border-2 border-gray-900 px-2.5 py-1 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors ${
                    webMode === (scope === "web")
                      ? "bg-accent text-onAccent"
                      : "bg-white text-ink hover:bg-field"
                  }`}
                >
                  {scope === "repository" ? "Repository" : "Web"}
                </button>
              ))}

              {webMode && (
                <span className="ml-auto text-[10px] leading-4 text-muted">
                  Web battles run the pipelines against live
                  OpenAlex / Crossref / arXiv hits.
                </span>
              )}
            </div>

            <label className="filter-label" htmlFor="lab-query">
              Query
            </label>
            <input
              id="lab-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runBattle();
              }}
              placeholder="e.g. neural network text similarity"
              className="ui-input text-base"
            />

            {webMode && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold tracking-[0.15em] text-muted uppercase">
                    Sources
                  </span>

                  {(["openalex", "crossref", "arxiv"] as const).map(
                    (source) => (
                      <label
                        key={source}
                        className="flex cursor-pointer items-center gap-1 text-xs font-medium text-ink"
                      >
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
                                : [current, source]
                                    .filter(Boolean)
                                    .join(",")
                            )
                          }
                          className="accent-gold"
                        />
                        {source === "openalex"
                          ? "OpenAlex"
                          : source === "crossref"
                            ? "Crossref"
                            : "arXiv"}
                      </label>
                    ),
                  )}
                </div>

                <label className="flex items-center gap-1 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={openAccess}
                    onChange={(e) => setOpenAccess(e.target.checked)}
                    className="accent-gold"
                  />
                  Open access only
                </label>

                <label className="flex items-center gap-1 text-xs font-medium text-ink">
                  <span className="text-[10px] font-bold tracking-[0.15em] text-muted uppercase">
                    Sort
                  </span>
                  <select
                    value={webSort}
                    onChange={(e) => setWebSort(e.target.value)}
                    className="rounded border-[2px] border-gray-900 bg-field px-2 py-1 text-xs font-medium text-ink focus:outline-none"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="year">Newest first</option>
                  </select>
                </label>
              </div>
            )}

            <div className="mt-3 flex items-end justify-between gap-3">
              <label className="filter-label" htmlFor="lab-topk">
                <span>Depth</span>
              </label>
              <select
                id="lab-topk"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="min-h-10 rounded border-[3px] border-gray-900 bg-field px-3 text-sm font-medium text-ink focus:outline-none"
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={15}>Top 15</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void runBattle()}
              disabled={loading || !query.trim()}
              className="mt-4 w-full rounded border-[3px] border-gray-900 bg-accent px-4 py-2.5 text-sm font-semibold text-onAccent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Simulating battle…" : "Simulate battle"}
            </button>
          </div>

          {loading && (
            <div className="rounded border-[3px] border-gray-900 bg-white p-4">
              <PixelProgress
                value={null}
                stage="RUNNING 7 PIPELINES"
              />
            </div>
          )}

          {error && <div className="status-error">{error}</div>}

          {battle && !loading && (
            <>
              {battle.winner && (
                <div className="rounded border-[3px] border-gray-900 bg-gray-900 p-4 text-onInk">
                  <p className="animate-blink flex items-center gap-2 font-mono text-xs font-bold tracking-[0.3em] text-accent">
                    <ArrowRight className="h-3 w-3" />
                    WINNER
                  </p>
                  <p className="mt-2 font-mono text-sm font-bold tracking-[0.12em] text-onInk">
                    {pipelineLabel(battle.winner.pipeline_id)}
                  </p>
                  <p className="mt-1 text-xs text-onInk/70">
                    {(battle.winner.value * 100).toFixed(0)}% of
                    available consensus · avg consensus rank #
                    {battle.winner.avg_consensus_rank}
                  </p>
                </div>
              )}

              <div className="rounded border-[3px] border-gray-900 bg-white p-4">
                <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
                  Results
                </p>
                <ul className="space-y-2">
                  {battle.pipelines.map((pipeline) => {
                    const isCustom = pipeline.id === "custom";
                    const top = pipeline.results[0];
                    return (
                      <li
                        key={pipeline.id}
                        className={`rounded border-2 border-gray-900 px-3 py-2 ${
                          isCustom ? "bg-accentSoft" : "bg-canvas"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-bold text-ink">
                            {pipelineLabel(pipeline.id)}
                            {isCustom && (
                              <span className="ml-2 rounded border-2 border-gray-900 bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-onAccent">
                                YOURS
                              </span>
                            )}
                          </p>
                          <p className="shrink-0 font-mono text-xs text-muted">
                            {pipeline.results.length} results
                          </p>
                        </div>
                        {top && (
                          <p className="mt-1 truncate text-xs text-muted">
                            #1 {top.title ?? `Paper #${top.paper_id}`}
                            {top.year ? ` · ${top.year}` : ""}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </section>

        {/* ================= LEADERBOARD ================= */}
        <section className="rounded border-[3px] border-gray-900 bg-white p-4">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
            Leaderboard
          </p>

          {runs.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              No simulations yet. Run a battle and the winner takes
              a place on the board.
            </p>
          ) : (
            <>
              <ol className="divide-y divide-gray-200">
                {tallyRows.map((row, index) => (
                  <li
                    key={row.key}
                    className={`flex items-center gap-3 py-2 ${
                      index === 0 ? "bg-canvas" : ""
                    }`}
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-muted">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                      {tallyLabel(row.key)}
                    </span>
                    {index === 0 && (
                      <span className="animate-blink font-mono text-xs font-bold tracking-[0.2em] text-accent">
                        CHAMPION
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {row.wins} win{row.wins === 1 ? "" : "s"} ·{" "}
                      {Math.round((row.wins / runs.length) * 100)}%
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-4 border-t-2 border-gray-200 pt-3">
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                  Wins by entry
                </p>
                <FreqBars
                  data={tallyRows.map((row) => ({
                    label: tallyLabel(row.key),
                    value: row.wins,
                  }))}
                  ariaLabel="Win frequency per recipe or preset"
                />
              </div>

              <p className="mt-3 border-t-2 border-gray-200 pt-2 font-mono text-xs text-muted">
                Battle history · {runs.length} simulations · page{" "}
                {safeRunsPage} of {runsPageCount}
              </p>
              <ul className="mt-2 space-y-1">
                {pagedRuns.map((run, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate font-mono text-muted">
                      {run.winnerPipelineId === "custom"
                        ? run.recipeName
                        : tallyLabel(run.winnerPipelineId)}
                    </span>
                    <span className="shrink-0 font-mono text-muted">
                      {new Date(run.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>

              {runsPageCount > 1 && (
                <Pagination
                  page={safeRunsPage}
                  pageCount={runsPageCount}
                  onPageChange={setRunsPage}
                  total={runs.length}
                  pageSize={LAB_RUNS_PAGE_SIZE}
                  className="mt-2 border-t-2 border-gray-200"
                />
              )}
            </>
          )}
        </section>
      </div>
      )}

      {tab === "garden" && (
        <div className="mt-6">
          {/* garden heading */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-pixelify text-xl font-bold leading-none text-ink">
                The Garden
              </p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-muted">
                The tree carries its own menus: the sun and token
                chips open the shop, the skins, and the wallet in the
                card itself. Three thousand packets take it from seed to
                ancient oak.
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-lg border-[3px] border-[#8a5a2b]/45 bg-[#fffdf5] px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#6b4c1f] shadow-[2px_2px_0_rgba(0,0,0,0.06)]"
              title="Three thousand packets take the tree from seed to ancient maple"
            >
              <span aria-hidden="true" className="text-[#8a5a2b]">
                {"\u25CF"}
              </span>
              3,000 packets
            </div>
          </div>

          {/* the Tree of Knowledge card is the whole garden; its
              toolbar hosts the menus (shop, skins, wallet). */}
          <TreeOfKnowledge />
        </div>
      )}

      {tab === "stats" && (
        <div className="mt-6">
          <StatsForNerds contextNote="Tune the dials in the Recipe bench and watch the pseudocode follow the live weights — the same maths the search runs, ready for your methodology chapter." />
        </div>
      )}
    </div>
  );
}