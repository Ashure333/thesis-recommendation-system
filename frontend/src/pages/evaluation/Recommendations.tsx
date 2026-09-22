import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { pipelineConfigs } from "../../data/pipelineConfigs";
import WeightBar from "../../components/WeightBar";
import { getRecommendations, getPaper, saveToLibrary, SearchResult, Paper } from "../../api";
import { Button, EmptyState, PageHeader, PageShell } from "../../components/ui";

const IMPLEMENTED = new Set(["tfidf", "sbert"]);

interface NavState {
  mode?: "keyword" | "title" | "seed";
  query?: string;
  seedPaperId?: number;
  pipeline?: string;
}

export default function Recommendations() {
  const location = useLocation();
  const navState = (location.state as NavState) ?? {};
  const [mode] = useState<"keyword" | "title" | "seed">(navState.mode ?? "keyword");
  const [queryText, setQueryText] = useState(navState.query ?? "");
  const [seedPaperId] = useState<number | undefined>(navState.seedPaperId);
  const [seedPaper, setSeedPaper] = useState<Paper | null>(null);
  const [pipeline, setPipeline] = useState(IMPLEMENTED.has(navState.pipeline ?? "") ? navState.pipeline! : "tfidf");
  const [topK, setTopK] = useState(10);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (seedPaperId !== undefined) getPaper(seedPaperId).then(setSeedPaper).catch(() => {});
  }, [seedPaperId]);

  function runSearch() {
    if (!IMPLEMENTED.has(pipeline)) return;
    if (mode !== "seed" && !queryText.trim()) return;
    setLoading(true);
    setError(null);
    getRecommendations({
      pipeline,
      query: mode !== "seed" ? queryText : undefined,
      seedPaperId: mode === "seed" ? seedPaperId : undefined,
      topK,
    }).then(setResults).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (mode === "seed" ? seedPaperId !== undefined : queryText.trim()) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, topK]);

  async function handleSave(paperId: number) {
    await saveToLibrary(paperId);
    setSavedIds((prev) => new Set(prev).add(paperId));
  }

  const activeConfig = pipelineConfigs.find((c) => c.id === pipeline) ?? pipelineConfigs[0];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Recommendation results"
        title="Related papers"
        description="Run a configured content-based pipeline against a query or seed document."
      />

      <section className="surface mb-7 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label className="filter-label">{mode === "seed" ? "Seed document" : mode === "title" ? "Title query" : "Keyword query"}</label>
            {mode === "seed" ? (
              <p className="text-sm leading-6 text-ink">{seedPaper?.title ?? `Paper #${seedPaperId}`}</p>
            ) : (
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder={mode === "title" ? "Enter a paper title…" : "e.g. neural network text similarity"}
                className="ui-input"
              />
            )}
          </div>
          {mode !== "seed" && <Button type="button" onClick={runSearch} disabled={!queryText.trim()}>Search</Button>}
          <label className="text-xs text-muted">
            <span className="mb-1.5 block">Results</span>
            <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="min-h-10 rounded-md border border-line bg-navy px-3 text-sm text-ink focus:border-gold focus:outline-none">
              <option value={5}>Top 5</option><option value={10}>Top 10</option><option value={20}>Top 20</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Pipeline</p>
            <p className="mt-1 text-xs text-muted">{activeConfig.subtitle}</p>
          </div>
          <div className="w-40 sm:w-56"><WeightBar weights={activeConfig.weights} /></div>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-line">
          {pipelineConfigs.map((config) => {
            const implemented = IMPLEMENTED.has(config.id);
            return (
              <button
                key={config.id}
                type="button"
                disabled={!implemented}
                onClick={() => implemented && setPipeline(config.id)}
                className={`border-b-2 px-3 py-2 text-xs transition-colors ${
                  config.id === pipeline ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                }`}
                title={implemented ? undefined : "Not built yet"}
              >
                {config.label}{!implemented && " · soon"}
              </button>
            );
          })}
        </div>
      </section>

      {error && <div className="status-error mb-5">{error}</div>}

      {loading ? (
        <div className="empty-state"><p className="text-sm text-muted">Searching…</p></div>
      ) : !IMPLEMENTED.has(pipeline) ? (
        <EmptyState title={`${activeConfig.label} is not built yet.`} description="TF-IDF and S-BERT are the implemented configurations currently available here." />
      ) : results.length === 0 ? (
        <EmptyState title="No matching papers found." description="Try a broader query or another pipeline." />
      ) : (
        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="grid grid-cols-[42px_1fr_100px_110px] border-b border-line bg-navy px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            <span>Rank</span><span>Paper</span><span>Score</span><span>Action</span>
          </div>
          {results.map((result, index) => (
            <div key={result.paper.id} className="grid grid-cols-[42px_1fr_100px_110px] items-center gap-2 border-b border-line px-4 py-4 last:border-b-0">
              <span className="text-sm text-muted">{index + 1}</span>
              <div className="min-w-0">
                <p className="paper-title">{result.paper.title}</p>
                <p className="paper-meta">{result.paper.author ?? "Unknown author"} · {result.paper.publication_year ?? "Year unavailable"}</p>
              </div>
              <div>
                <p className="text-sm tabular-nums text-gold">{result.score.toFixed(3)}</p>
                <div className="mt-1 h-1 w-14 bg-line"><div className="h-full bg-gold" style={{ width: `${Math.max(0, Math.min(1, result.score)) * 100}%` }} /></div>
              </div>
              <Button variant="secondary" type="button" onClick={() => handleSave(result.paper.id)} disabled={savedIds.has(result.paper.id)}>
                {savedIds.has(result.paper.id) ? "Saved" : "Save"}
              </Button>
            </div>
          ))}
        </section>
      )}
    </PageShell>
  );
}
