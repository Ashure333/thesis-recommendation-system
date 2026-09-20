import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { pipelineConfigs } from "../../data/pipelineConfigs";
import WeightBar from "../../components/WeightBar";
import { getRecommendations, getPaper, saveToLibrary, SearchResult, Paper } from "../../api";

// Only these two have a real implementation behind them right now --
// see app/services/recommendation/search_service.py. The other four
// configurations are shown but disabled, rather than hidden, so it's
// clear they're planned, not forgotten.
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
  const [pipeline, setPipeline] = useState(navState.pipeline && IMPLEMENTED.has(navState.pipeline) ? navState.pipeline : "tfidf");
  const [topK, setTopK] = useState(10);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (seedPaperId !== undefined) {
      getPaper(seedPaperId).then(setSeedPaper).catch(() => {});
    }
  }, [seedPaperId]);

  function runSearch() {
    if (!IMPLEMENTED.has(pipeline)) {
      setResults([]);
      setError(null);
      return;
    }
    if (mode !== "seed" && !queryText.trim()) return;

    setLoading(true);
    setError(null);
    getRecommendations({
      pipeline,
      query: mode !== "seed" ? queryText : undefined,
      seedPaperId: mode === "seed" ? seedPaperId : undefined,
      topK,
    })
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // Re-run whenever the pipeline changes (if there's already a query/seed
  // to search with), so switching TF-IDF <-> S-BERT re-fetches automatically.
  useEffect(() => {
    if (mode === "seed" ? seedPaperId !== undefined : queryText.trim()) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline]);

  async function handleSave(paperId: number) {
    await saveToLibrary(paperId);
    setSavedIds((prev) => new Set(prev).add(paperId));
  }

  const activeConfig = pipelineConfigs.find((c) => c.id === pipeline)!;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Query / seed summary */}
      <div className="mb-6 rounded-lg border border-line bg-panel p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-2 text-xs">
            <span className="rounded bg-panelAlt px-2 py-1 text-muted">
              {mode === "seed" ? "Seed Document" : mode === "title" ? "Title Query" : "Keyword Query"}
            </span>
            <span className="rounded bg-panelAlt px-2 py-1 text-muted">Top-{topK}</span>
          </div>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="rounded border border-line bg-navy px-2 py-1 text-xs text-ink focus:border-gold focus:outline-none"
          >
            <option value={5}>K = 5</option>
            <option value={10}>K = 10</option>
            <option value={20}>K = 20</option>
          </select>
        </div>

        {mode === "seed" ? (
          <p className="font-serif text-lg text-ink">
            {seedPaper ? seedPaper.title : `Paper #${seedPaperId}`}
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="e.g. neural network text similarity"
              className="flex-1 rounded border border-line bg-navy px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
            <button
              onClick={runSearch}
              className="rounded bg-gold px-4 text-sm font-medium text-navy hover:bg-gold/90"
            >
              Search
            </button>
          </div>
        )}
      </div>

      {/* Pipeline selector */}
      <div className="mb-6">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted">
          Active Pipeline Configuration
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          {pipelineConfigs.map((c) => {
            const implemented = IMPLEMENTED.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => implemented && setPipeline(c.id)}
                disabled={!implemented}
                title={implemented ? undefined : "Not built yet"}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  c.id === pipeline
                    ? "bg-gold text-navy"
                    : implemented
                    ? "bg-panel text-muted hover:text-ink"
                    : "cursor-not-allowed bg-panel text-muted/40"
                }`}
              >
                {c.label}
                {!implemented && <span className="ml-1">· soon</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-xs text-muted">
            {activeConfig.weights.map((w) => (
              <span key={w.name}>
                {w.name} {w.pct}%
              </span>
            ))}
          </div>
          <span className="text-xs text-muted">— {activeConfig.subtitle}</span>
        </div>
        <div className="mt-2 max-w-xs">
          <WeightBar weights={activeConfig.weights} />
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded border border-sbert/40 bg-sbert/10 px-3 py-2 text-sm text-sbert">
          {error}
        </p>
      )}

      {!IMPLEMENTED.has(pipeline) ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center text-sm text-muted">
          {activeConfig.label} isn't built yet — try TF-IDF or S-BERT.
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center text-sm text-muted">
          Searching…
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center text-sm text-muted">
          No matching papers found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Paper</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-panel">
              {results.map((r, i) => {
                const subject = r.paper.subject_category?.split(":")[0]?.trim() ?? "";
                const isCS = subject.toLowerCase().includes("computer");
                return (
                  <tr key={r.paper.id}>
                    <td className="px-4 py-3 text-muted">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className={`rounded px-1.5 py-0.5 ${isCS ? "bg-cs/20 text-cs" : "bg-math/20 text-math"}`}>
                          {isCS ? "CS" : "Math"}
                        </span>
                        <span className="text-muted">{r.paper.publication_year ?? "—"}</span>
                      </div>
                      <p className="font-medium text-ink">{r.paper.title}</p>
                      <p className="text-xs text-muted">{r.paper.author ?? "Unknown author"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gold">{r.score.toFixed(3)}</p>
                      <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-line">
                        <div className="h-full bg-gold" style={{ width: `${Math.max(0, Math.min(1, r.score)) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSave(r.paper.id)}
                        className="rounded border border-line px-2 py-1 text-xs text-ink hover:border-gold"
                      >
                        {savedIds.has(r.paper.id) ? "✓" : "+"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
