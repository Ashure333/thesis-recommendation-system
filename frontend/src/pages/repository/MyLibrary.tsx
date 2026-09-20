import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLibrary, removeFromLibrary, LibraryEntry } from "../../api";

export default function MyLibrary() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getLibrary()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleRemove(paperId: number) {
    await removeFromLibrary(paperId);
    setEntries((prev) => prev.filter((e) => e.paper.id !== paperId));
  }

  function handleFindSimilar(paperId: number) {
    // Only tfidf/sbert have a real implementation right now -- default
    // to tfidf. The Recommendations page lets the user switch pipelines
    // (among the implemented ones) from there.
    navigate("/recommendations", {
      state: { mode: "seed", seedPaperId: paperId, pipeline: "tfidf" },
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 font-serif text-2xl text-ink">My Library</h1>
          <p className="text-sm text-muted">
            {loading ? "Loading…" : `${entries.length} saved papers`}
          </p>
        </div>
        <Link to="/repository" className="text-sm text-gold hover:underline">
          + Browse Repository
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded border border-sbert/40 bg-sbert/10 px-3 py-2 text-sm text-sbert">
          Couldn't load your library: {error}. Is the backend running on port 8000?
        </p>
      )}

      {!loading && entries.length === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-line py-16 text-center text-sm text-muted">
          You haven&apos;t saved any papers yet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {entries.map(({ paper }) => {
              const subject = paper.subject_category?.split(":")[0]?.trim() ?? "";
              const isCS = subject.toLowerCase().includes("computer");
              const keywordList = paper.keywords?.split(",").map((k) => k.trim()).filter(Boolean) ?? [];

              return (
                <div key={paper.id} className="rounded-lg border border-line bg-panel p-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 ${isCS ? "bg-cs/20 text-cs" : "bg-math/20 text-math"}`}>
                        {isCS ? "CS" : "Math"}
                      </span>
                      <span className="text-muted">{paper.publication_year ?? "—"}</span>
                    </div>
                    <span className="text-muted">{paper.citation_count ?? 0} cited</span>
                  </div>

                  <p className="text-sm font-medium text-ink">{paper.title}</p>
                  <p className="mt-1 text-xs text-muted">{paper.author ?? "Unknown author"}</p>
                  <p className="mt-2 text-xs text-muted line-clamp-2">
                    {paper.abstract ?? "No abstract available."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {keywordList.slice(0, 2).map((k) => (
                      <span key={k} className="rounded bg-panelAlt px-2 py-0.5 text-[11px] text-muted">
                        {k}
                      </span>
                    ))}
                    {keywordList.length > 2 && (
                      <span className="text-[11px] text-muted">+{keywordList.length - 2} more</span>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleFindSimilar(paper.id)}
                      disabled={!paper.is_valid_for_recommendation}
                      title={
                        paper.is_valid_for_recommendation
                          ? undefined
                          : "This paper is missing required fields for recommendation"
                      }
                      className="flex-1 rounded border border-line py-1.5 text-xs text-ink hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Find Similar
                    </button>
                    <button
                      onClick={() => handleRemove(paper.id)}
                      className="flex-1 rounded border border-sbert/40 py-1.5 text-xs text-sbert hover:border-sbert"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Use <span className="text-ink">&ldquo;Find Similar&rdquo;</span> on
            any saved paper to run seed-document recommendations.
          </p>
        </>
      )}
    </div>
  );
}
