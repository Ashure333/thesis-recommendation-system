import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pipelineConfigs } from "../../data/pipelineConfigs";
import WeightBar from "../../components/WeightBar";
import { getRepositoryStats, listPapers, RepositoryStats, Paper } from "../../api";
import { Button, EmptyState, PageHeader, PageShell, SectionHeading } from "../../components/ui";

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
    listPapers({ sort_by: "date_added", limit: 4 }).then(setRecent).catch(() => {});
  }, []);

  const selectedConfig = pipelineConfigs.find((c) => c.id === activeConfig) ?? pipelineConfigs[0];

  function handleSearch() {
    if (queryMode !== "seed" && !queryText.trim()) return;
    navigate("/recommendations", {
      state: { mode: queryMode, query: queryText, pipeline: activeConfig },
    });
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Academic paper repository"
        title="Search the repository"
        description="Search by keywords or title, or choose a paper to use as a seed document for recommendations."
      />

      {/* Query Bar */}
      <section className="surface mb-10">
        <div className="border-b border-line px-5 py-4">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Search mode">
            {queryModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={queryMode === mode.id}
                onClick={() => setQueryMode(mode.id)}
                className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                  queryMode === mode.id
                    ? "border-gold text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            {queryMode === "seed" ? (
              <Link
                to="/repository"
                state={{ selectSeed: true, pipeline: activeConfig }}
                className="ui-input flex items-center text-muted hover:border-gold/60 hover:text-ink"
              >
                Choose a paper from the repository
              </Link>
            ) : (
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={
                  queryMode === "title"
                    ? "Enter a paper title…"
                    : "e.g. neural network text similarity"
                }
                aria-label={queryMode === "title" ? "Paper title" : "Search keywords"}
                className="ui-input flex-1"
              />
            )}
            {queryMode !== "seed" && (
              <Button type="button" onClick={handleSearch} disabled={!queryText.trim()}>
                Search
              </Button>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
            <label htmlFor="pipeline" className="text-xs text-muted">Pipeline</label>
            <select
              id="pipeline"
              value={activeConfig}
              onChange={(e) => setActiveConfig(e.target.value)}
              className="min-h-9 rounded-md border border-line bg-navy px-3 text-sm text-ink focus:border-gold focus:outline-none"
            >
              {pipelineConfigs.map((config) => (
                <option key={config.id} value={config.id}>{config.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted">{selectedConfig.subtitle}</span>
            <div className="sm:ml-auto sm:w-56">
              <WeightBar weights={selectedConfig.weights} />
            </div>
          </div>
        </div>
      </section>

      {/* Repository Stats */}
      <section className="mb-10 border-y border-line py-5">
        <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
          <Stat value={stats?.total_papers ?? "—"} label="Papers in repository" />
          {Object.entries(stats?.by_subject ?? {}).slice(0, 2).map(([subject, count]) => (
            <Stat key={subject} value={count} label={subject} />
          ))}
          <Stat value={stats?.category_count ?? "—"} label="Subject categories" />
        </div>
      </section>

      {/* Recommendation Pipelines */}
      <section className="mb-10">
        <SectionHeading
          title="Recommendation pipelines"
          description="The six configurations currently defined for the study."
        />
        <div className="overflow-hidden rounded-lg border border-line">
          {pipelineConfigs.map((config) => {
            const active = config.id === activeConfig;
            return (
              <button
                key={config.id}
                type="button"
                onClick={() => setActiveConfig(config.id)}
                className={`grid w-full grid-cols-[1fr_auto] gap-4 border-b border-line px-4 py-4 text-left last:border-b-0 ${
                  active ? "bg-panelAlt" : "bg-panel hover:bg-panelAlt/50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-ink">{config.label}</p>
                  <p className="mt-1 text-xs text-muted">{config.subtitle}</p>
                </div>
                <div className="w-40 self-center sm:w-56">
                  <WeightBar weights={config.weights} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Additions (Old Code Restored) */}
      <section>
        <SectionHeading
          title="Recent additions"
          action={<Link to="/repository" className="text-sm text-gold hover:underline">Browse repository →</Link>}
        />
        {recent.length === 0 ? (
          <EmptyState
            title="No papers in the repository yet."
            description="Upload a paper or import a Google Scholar BibTeX citation to add the first record."
          />
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
      </section>
    </PageShell>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="px-4 text-center first:pl-0 last:pr-0">
      <p className="font-serif text-xl text-gold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}