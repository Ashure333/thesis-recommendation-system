import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listPapers,
  saveToLibrary,
  deletePaper,
  Paper,
} from "../../api";
import PaperViewerModal from "../../components/PaperViewerModal";

const subjects = ["All Subjects", "Computer Science", "Mathematics"];

const documentTypes = [
  "All",
  "Journal Article",
  "Conference Paper",
  "Thesis",
  "Technical Report",
];

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

  return {
    subject: parts?.[0] ?? "",
    category: parts?.[1] ?? "",
  };
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

  // --------------------------------------------------
  // PDF viewer
  // --------------------------------------------------

  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // --------------------------------------------------
  // Seed-document selection navigation state
  // --------------------------------------------------

  const location = useLocation();
  const navigate = useNavigate();

  const navigationState = location.state as {
    selectSeed?: boolean;
    pipeline?: string;
  } | null;

  const isSelectingSeed = navigationState?.selectSeed === true;
  const seedPipeline = navigationState?.pipeline ?? "tfidf";

  // --------------------------------------------------
  // Load repository papers
  // --------------------------------------------------

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
  }, [
    search,
    subject,
    category,
    documentType,
    minYear,
    maxYear,
    sortBy,
  ]);

  // --------------------------------------------------
  // Save paper
  // --------------------------------------------------

  async function handleSave(paperId: number) {
    await saveToLibrary(paperId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      next.add(paperId);
      return next;
    });
  }

  // --------------------------------------------------
  // PDF viewer
  // --------------------------------------------------

  function handleOpenPaper(paper: Paper) {
    setSelectedPaper(paper);
    setIsViewerOpen(true);
  }

  function handleClosePaper() {
    setIsViewerOpen(false);
    setSelectedPaper(null);
  }

  // --------------------------------------------------
  // Select seed document
  // --------------------------------------------------

  function handleSelectSeed(paperId: number) {
    navigate("/recommendations", {
      state: {
        mode: "seed",
        seedPaperId: paperId,
        pipeline: seedPipeline,
      },
    });
  }

  // --------------------------------------------------
  // Delete paper
  // --------------------------------------------------

  async function handleDelete(paperId: number, title: string) {
    const confirmed = window.confirm(
      `Delete "${title}" permanently? This removes it from the repository, ` +
        `any library it's saved in, and deletes its stored file. This can't be undone.`
    );

    if (!confirmed) return;

    await deletePaper(paperId);

    // If the deleted paper is currently open in the viewer,
    // close the viewer as well.
    if (selectedPaper?.id === paperId) {
      handleClosePaper();
    }

    setPapers((prev) => prev.filter((p) => p.id !== paperId));
  }

  return (
    <div className="flex gap-8">
      {/* ==================================================
          SIDEBAR
          ================================================== */}

      <aside className="w-56 shrink-0 space-y-6 text-sm">
        {/* Subject */}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Subject
          </p>

          <div className="space-y-1">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`block w-full rounded px-2 py-1.5 text-left ${
                  subject === s
                    ? "bg-panelAlt text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Document Type */}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Document Type
          </p>

          <div className="space-y-1">
            {documentTypes.map((d) => (
              <button
                key={d}
                onClick={() => setDocumentType(d)}
                className={`block w-full rounded px-2 py-1.5 text-left ${
                  documentType === d
                    ? "bg-panelAlt text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Category
          </p>

          <div className="space-y-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`block w-full rounded px-2 py-1.5 text-left ${
                  category === c
                    ? "bg-panelAlt text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Publication Year */}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">
            Publication Year
          </p>

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

      {/* ==================================================
          MAIN CONTENT
          ================================================== */}

      <div className="flex-1">
        {/* --------------------------------------------------
            Seed selection banner
            -------------------------------------------------- */}

        {isSelectingSeed && (
          <div className="mb-5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gold">
                  Select a seed document
                </p>

                <p className="mt-1 text-xs text-muted">
                  Choose a paper below to use as the basis for your
                  recommendations.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/search")}
                className="shrink-0 rounded border border-line px-3 py-1.5 text-xs text-muted hover:border-gold hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* --------------------------------------------------
            Search + Sort
            -------------------------------------------------- */}

        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, keyword…"
            className="flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          >
            <option value="date_added">Sort: Newest First</option>
            <option value="alphabetical">Sort: Alphabetical</option>
            <option value="publication_year">
              Sort: Publication Year
            </option>
          </select>
        </div>

        {/* --------------------------------------------------
            Error
            -------------------------------------------------- */}

        {error && (
          <p className="mb-3 rounded border border-sbert/40 bg-sbert/10 px-3 py-2 text-sm text-sbert">
            Couldn't load papers: {error}. Is the backend running on port
            8000?
          </p>
        )}

        {/* --------------------------------------------------
            Paper count
            -------------------------------------------------- */}

        <p className="mb-3 text-sm text-muted">
          {loading ? "Loading…" : `${papers.length} papers`}
        </p>

        {/* --------------------------------------------------
            Empty state
            -------------------------------------------------- */}

        {!loading && papers.length === 0 && !error ? (
          <div className="rounded-lg border border-dashed border-line py-16 text-center text-sm text-muted">
            No papers match the current filters.
          </div>
        ) : (
          /* --------------------------------------------------
             Paper list
             -------------------------------------------------- */

          <div className="divide-y divide-line rounded-lg border border-line bg-panel">
            {papers.map((paper) => {
              const { subject: paperSubject } = categoryOf(paper);
              const isCS = paperSubject.toLowerCase().includes("computer");

              return (
                <div
                  key={paper.id}
                  className={`flex items-center justify-between gap-4 px-4 py-4 ${
                    isSelectingSeed
                      ? "transition-colors hover:bg-panelAlt"
                      : ""
                  }`}
                >
                  {/* --------------------------------------------------
                      Paper information
                      -------------------------------------------------- */}

                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          isCS
                            ? "bg-cs/20 text-cs"
                            : "bg-math/20 text-math"
                        }`}
                      >
                        {isCS ? "CS" : "Mathematics"}
                      </span>

                      <span className="text-muted">
                        · {paper.document_type ?? "—"}
                      </span>
                    </div>

                    {/* --------------------------------------------------
                        Paper title
                        -------------------------------------------------- */}

                    {isSelectingSeed ? (
                      <button
                        type="button"
                        onClick={() => handleSelectSeed(paper.id)}
                        disabled={!paper.is_valid_for_recommendation}
                        title={
                          paper.is_valid_for_recommendation
                            ? "Use this paper as the seed document"
                            : "This paper is missing required fields for recommendation"
                        }
                        className="block max-w-full text-left text-sm font-medium text-gold hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {paper.title}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenPaper(paper)}
                        title="Open paper"
                        className="block max-w-full text-left text-sm font-medium text-gold hover:underline"
                      >
                        {paper.title}
                      </button>
                    )}

                    <p className="mt-1 text-xs text-muted">
                      {paper.publication_year ?? "—"}
                    </p>

                    {/* Recommendation validity information */}
                    {isSelectingSeed &&
                      !paper.is_valid_for_recommendation && (
                        <p className="mt-1 text-xs text-sbert">
                          Cannot be used as a seed: required recommendation
                          fields are missing.
                        </p>
                      )}
                  </div>

                  {/* --------------------------------------------------
                      Actions
                      -------------------------------------------------- */}

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">
                      {paper.citation_count ?? 0} cited
                    </span>

                    {/* Choose Seed */}
                    {isSelectingSeed && (
                      <button
                        type="button"
                        onClick={() => handleSelectSeed(paper.id)}
                        disabled={!paper.is_valid_for_recommendation}
                        title={
                          paper.is_valid_for_recommendation
                            ? "Use this paper as the seed document"
                            : "This paper is missing required fields for recommendation"
                        }
                        className="rounded bg-gold px-3 py-1.5 text-xs font-medium text-navy hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Choose
                      </button>
                    )}

                    {/* Save */}
                    <button
                      onClick={() => handleSave(paper.id)}
                      className="rounded border border-line px-3 py-1.5 text-xs text-ink hover:border-gold"
                    >
                      {savedIds.has(paper.id) ? "✓ Saved" : "+ Save"}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() =>
                        handleDelete(paper.id, paper.title)
                      }
                      className="rounded border border-sbert/40 px-3 py-1.5 text-xs text-sbert hover:border-sbert"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================
          PDF VIEWER MODAL
          ================================================== */}

      <PaperViewerModal
        paper={selectedPaper}
        open={isViewerOpen}
        onClose={handleClosePaper}
        canEdit={true}
        onPaperUpdated={(updatedPaper) => {
          setPapers((previousPapers) =>
            previousPapers.map((paper) =>
              paper.id === updatedPaper.id ? updatedPaper : paper
            )
          );

          setSelectedPaper(updatedPaper);
        }}
      />
    </div>
  );
}