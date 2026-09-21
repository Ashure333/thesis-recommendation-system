import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { pipelineConfigs } from "../../data/pipelineConfigs";
import WeightBar from "../../components/WeightBar";
import { getRepositoryStats, listPapers, RepositoryStats, Paper } from "../../api";

type QueryMode = "keyword" | "title" | "seed";

const queryModes: { id: QueryMode; label: string }[] = [
  { id: "keyword", label: "Keyword Query" },
  { id: "title", label: "Title Query" },
  { id: "seed", label: "Seed Document" },
];

export default function Search() {
  const navigate = useNavigate();
  const [queryMode, setQueryMode] = useState<QueryMode>("keyword");
  const [queryText, setQueryText] = useState("");
  const [activeConfig, setActiveConfig] = useState("tfidf");

  const [stats, setStats] = useState<RepositoryStats | null>(null);
  const [recent, setRecent] = useState<Paper[]>([]);

  useEffect(() => {
    getRepositoryStats().then(setStats).catch(() => {});
    listPapers({ sort_by: "date_added", limit: 4 })
      .then(setRecent)
      .catch(() => {});
  }, []);

  function handleSearch() {
    if (queryMode !== "seed" && !queryText.trim()) return;
    navigate("/recommendations", {
      state: { mode: queryMode, query: queryText, pipeline: activeConfig },
    });
  }

  return (
    <div>
      {/* Hero */}
      <div className="mb-10 text-center">
        <p className="mb-3 inline-block rounded border border-line px-3 py-1 text-xs uppercase tracking-wide text-muted">
          Bulacan State University · BSMCS 4A
        </p>
        <h1 className="font-serif text-3xl text-ink">
          Academic Paper Repository <br />
          <span className="text-gold">&amp; Recommendation System</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted">
          Discover related academic literature through hybrid content-based
          recommendation pipelines integrating TF-IDF, S-BERT, and Metadata
          signals.
        </p>
      </div>

      {/* Query bar */}
      <div className="mx-auto mb-10 max-w-2xl rounded-lg border border-line bg-panel p-5">
        <div className="mb-3 flex gap-2">
          {queryModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setQueryMode(mode.id)}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                queryMode === mode.id
                  ? "bg-gold text-navy"
                  : "bg-panelAlt text-muted hover:text-ink"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex gap-2">
          {queryMode === "seed" ? (
            <Link
            to="/repository"
            state={{
              selectSeed: true,
              pipeline: activeConfig,
            }}
            className="flex-1 rounded border border-line bg-navy px-3 py-2 text-sm text-muted hover:text-ink"
          >
            Choose a paper from your repository →
          </Link>
          ) : (
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. neural network text similarity…"
              className="flex-1 rounded border border-line bg-navy px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            />
          )}
          {queryMode !== "seed" && (
            <button
              onClick={handleSearch}
              className="rounded bg-gold px-5 text-sm font-medium text-navy hover:bg-gold/90"
            >
              Search
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>Pipeline:</span>
          <select
            value={activeConfig}
            onChange={(e) => setActiveConfig(e.target.value)}
            className="rounded border border-line bg-navy px-2 py-1 text-ink focus:border-gold focus:outline-none"
          >
            {pipelineConfigs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <div className="ml-auto flex gap-2">
            {pipelineConfigs
              .find((c) => c.id === activeConfig)
              ?.weights.map((w) => (
                <span key={w.name} className="rounded bg-panelAlt px-2 py-1">
                  {w.name} {w.pct}%
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-12 grid grid-cols-2 gap-4 border-y border-line py-6 sm:grid-cols-4">
        <div className="text-center">
          <p className="font-serif text-2xl text-gold">{stats?.total_papers ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">Papers in Repository</p>
        </div>
        {Object.entries(stats?.by_subject ?? {}).map(([subject, count]) => (
          <div key={subject} className="text-center">
            <p className="font-serif text-2xl text-gold">{count}</p>
            <p className="mt-1 text-xs text-muted">{subject}</p>
          </div>
        ))}
        <div className="text-center">
          <p className="font-serif text-2xl text-gold">{stats?.category_count ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">Subject Categories</p>
        </div>
      </div>

      {/* Pipeline overview grid */}
      <div className="mb-12">
        <h2 className="mb-1 text-base font-medium text-ink">Recommendation Pipelines</h2>
        <p className="mb-4 text-sm text-muted">
          Six configurations built from three components — choose one before searching.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pipelineConfigs.map((config) => {
            const isActive = config.id === activeConfig;
            return (
              <button
                key={config.id}
                onClick={() => setActiveConfig(config.id)}
                className={`rounded-lg border p-4 text-left ${
                  isActive ? "border-gold bg-panelAlt" : "border-line bg-panel"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{config.label}</p>
                  {isActive && (
                    <span className="rounded bg-gold/20 px-2 py-0.5 text-[10px] text-gold">
                      active
                    </span>
                  )}
                </div>
                <p className="mb-3 text-xs text-muted">{config.subtitle}</p>
                <WeightBar weights={config.weights} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent additions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-ink">Recent Additions</h2>
          <Link to="/repository" className="text-sm text-gold hover:underline">
            Browse all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line py-12 text-center text-sm text-muted">
            No papers in the repository yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recent.map((paper) => {
              const subject = paper.subject_category?.split(":")[0]?.trim() ?? "";
              const isCS = subject.toLowerCase().includes("computer");
              return (
                <div key={paper.id} className="rounded-lg border border-line bg-panel p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 ${isCS ? "bg-cs/20 text-cs" : "bg-math/20 text-math"}`}>
                      {isCS ? "CS" : "Math"}
                    </span>
                    <span className="text-muted">{paper.publication_year ?? "—"}</span>
                  </div>
                  <p className="text-sm font-medium text-ink">{paper.title}</p>
                  <p className="mt-1 text-xs text-muted">{paper.author ?? "Unknown author"}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
