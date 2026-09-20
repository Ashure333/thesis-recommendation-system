import { useEffect, useState } from "react";
import { listPapers, saveToLibrary, Paper } from "../../api";

const subjects = ["All Subjects", "Computer Science", "Mathematics"];
const documentTypes = ["All", "Journal Article", "Conference Paper", "Thesis", "Technical Report"];
const categories = [
  "All Categories",
  "Algorithms",
  "Distributed Systems",
  "Graph Theory",
  "Information Retrieval",
  "Linear Algebra",
  "Machine Learning",
  "Natural Language Processing",
  "Numerical Analysis",
  "Probability Theory",
  "Topology",
];

function categoryOf(paper: Paper) {
  const parts = paper.subject_category?.split(":", 2).map((p) => p.trim());
  return { subject: parts?.[0] ?? "", category: parts?.[1] ?? "" };
}

export default function Repository() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(subjects[0]);
  const [category, setCategory] = useState(categories[0]);
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [minYear, setMinYear] = useState(2009);
  const [maxYear, setMaxYear] = useState(2023);
  const [sortBy, setSortBy] = useState("date_added");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    setError(null);
    listPapers({
      search: search || undefined,
      subject,
      category,
      document_type: documentType,
      min_year: minYear,
      max_year: maxYear,
      sort_by: sortBy,
    })
      .then(setPapers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, subject, category, documentType, minYear, maxYear, sortBy]);

  async function handleSave(paperId: number) {
    await saveToLibrary(paperId);
    setSavedIds((prev) => new Set(prev).add(paperId));
  }

  return (
    <div className="flex gap-8">
      <aside className="w-56 shrink-0 space-y-6 text-sm">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Subject</p>
          <div className="space-y-1">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`block w-full rounded px-2 py-1.5 text-left ${
                  subject === s ? "bg-panelAlt text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Document Type</p>
          <div className="space-y-1">
            {documentTypes.map((d) => (
              <button
                key={d}
                onClick={() => setDocumentType(d)}
                className={`block w-full rounded px-2 py-1.5 text-left ${
                  documentType === d ? "bg-panelAlt text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Category</p>
          <div className="space-y-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`block w-full rounded px-2 py-1.5 text-left ${
                  category === c ? "bg-panelAlt text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Publication Year</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={minYear}
              onChange={(e) => setMinYear(Number(e.target.value))}
              className="w-full rounded border border-line bg-navy px-2 py-1 text-xs text-ink focus:border-gold focus:outline-none"
            />
            <span className="text-muted">to</span>
            <input
              type="number"
              value={maxYear}
              onChange={(e) => setMaxYear(Number(e.target.value))}
              className="w-full rounded border border-line bg-navy px-2 py-1 text-xs text-ink focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, author, keyword…"
            className="flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          >
            <option value="date_added">Sort: Newest First</option>
            <option value="alphabetical">Sort: Alphabetical</option>
            <option value="publication_year">Sort: Publication Year</option>
          </select>
        </div>

        {error && (
          <p className="mb-3 rounded border border-sbert/40 bg-sbert/10 px-3 py-2 text-sm text-sbert">
            Couldn't load papers: {error}. Is the backend running on port 8000?
          </p>
        )}

        <p className="mb-3 text-sm text-muted">
          {loading ? "Loading…" : `${papers.length} papers`}
        </p>

        {!loading && papers.length === 0 && !error ? (
          <div className="rounded-lg border border-dashed border-line py-16 text-center text-sm text-muted">
            No papers match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-line rounded-lg border border-line bg-panel">
            {papers.map((paper) => {
              const { subject: paperSubject } = categoryOf(paper);
              const isCS = paperSubject.toLowerCase().includes("computer");
              return (
                <div key={paper.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className={`rounded px-1.5 py-0.5 ${isCS ? "bg-cs/20 text-cs" : "bg-math/20 text-math"}`}>
                        {isCS ? "CS" : "Math"}
                      </span>
                      <span className="text-muted">· {paper.document_type ?? "—"}</span>
                    </div>
                    <p className="text-sm font-medium text-gold">{paper.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {paper.author ?? "Unknown author"} · {paper.publication_year ?? "—"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">{paper.citation_count ?? 0} cited</span>
                    <button
                      onClick={() => handleSave(paper.id)}
                      className="rounded border border-line px-3 py-1.5 text-xs text-ink hover:border-gold"
                    >
                      {savedIds.has(paper.id) ? "✓ Saved" : "+ Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
