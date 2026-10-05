import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listPapers,
  saveToLibrary,
  removeFromLibrary,
  deletePaper,
  deletePaperPdf,
  getPaperPdfUrl,
  getLibrary,
  rebuildRecommendationIndex,
  searchWeb,
  importPaperFromMetadata,
  getRecommendations,
  notifyRecommendationIndexStale,
  Paper,
  WebSearchResult,
} from "../../api";
import PaperViewerModal from "../../components/PaperViewerModal";
import FindPdfPanel from "../../components/FindPdfPanel";
import MathText from "../../components/MathText";
import PetFigure from "../../components/PetFigure";
import LayoutOptions from "../../components/LayoutOptions";
import StaggerIn from "../../components/retro/StaggerIn";
import Pagination from "../../components/retro/Pagination";
import WeightBar from "../../components/WeightBar";
import PaneHandle, { usePaneWidth } from "../../components/ResizeHandle";
import Highlight from "../../components/Highlight";
import { Check, Star } from "../../components/retro/PixelIcons";
import { Button, EmptyState, PageHeader, TextInput } from "../../components/ui";
import HuntItem from "../../components/retro/HuntItem";
import { HUNT_ITEMS } from "../../data/hunt";
import { usePipelineMode } from "../../state/pipelineMode";
import {
  pipelineConfigs,
  customPipelineConfig,
} from "../../data/pipelineConfigs";
import {
  SUBJECT_FILTERS,
  CATEGORY_FILTERS,
  DOCUMENT_TYPE_FILTERS,
} from "../../data/catalog";
import { useCatalog } from "../../hooks/useCatalog";
import { useLayoutPrefs } from "../../state/layoutPrefs";
import { triggerSlimeAnimation } from "../../utils/slimeEvents";

function categoryOf(paper: Paper) {
  const parts = paper.subject_category?.split(":", 2).map((p) => p.trim());
  return { subject: parts?.[0] ?? "", category: parts?.[1] ?? "" };
}

const SIGNAL_FIELDS = ["title", "abstract", "keywords", "publication_year"] as const;

/* Resizable pane bounds (persisted per browser). */
const REPO_LEFT_KEY = "paperrec_repo_pane_left";
const REPO_LEFT_MIN = 220;
const REPO_LEFT_MAX = 420;
const REPO_RIGHT_KEY = "paperrec_repo_pane_right";
const REPO_RIGHT_MIN = 300;
const REPO_RIGHT_MAX = 560;

type SearchMode = "repository" | "web";

/** Stable identity for a web hit (dedupe across repeat searches). */
function webKey(result: WebSearchResult): string {
  return result.doi ?? result.landing_url ?? result.title;
}

export default function Repository() {
  const catalog = useCatalog();
  const { prefs } = useLayoutPrefs();

  /* Resizable pane widths (persisted per browser). */
  const [leftPaneW, resizeLeft] = usePaneWidth(
    REPO_LEFT_KEY,
    256,
    REPO_LEFT_MIN,
    REPO_LEFT_MAX,
  );

  const [rightPaneW, resizeRight] = usePaneWidth(
    REPO_RIGHT_KEY,
    384,
    REPO_RIGHT_MIN,
    REPO_RIGHT_MAX,
  );

  // Backend-owned taxonomy: seed filters until the catalog loads,
  // then the live values (including any subjects/categories added
  // by new references).
  const subjects: string[] = [
    "All Subjects",
    ...(catalog?.subjects ?? SUBJECT_FILTERS.slice(1)),
  ];
  const categories: string[] = [
    "All Categories",
    ...(catalog?.categories ?? CATEGORY_FILTERS.slice(1)),
  ];
  const documentTypes: string[] = [
    "All",
    ...(catalog?.document_types ?? DOCUMENT_TYPE_FILTERS.slice(1)),
  ];

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(subjects[0]);
  const [category, setCategory] = useState(categories[0]);
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [minYear, setMinYear] = useState(2008);
  const [maxYear, setMaxYear] = useState(2026);

  // Year-filter helpers: an emptied field is 0 (unset) and must not
  // reach the backend as a literal 0 -- max_year=0 would filter
  // everything out. Swap the pair when the user inverts the range.
  function parseYear(raw: string): number {
    if (raw === "") return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function handleMinYearChange(raw: string) {
    const value = parseYear(raw);
    setMinYear(value);
    if (value > 0 && maxYear > 0 && value > maxYear) setMaxYear(value);
  }

  function handleMaxYearChange(raw: string) {
    const value = parseYear(raw);
    setMaxYear(value);
    if (value > 0 && minYear > 0 && value < minYear) setMinYear(value);
  }

  // null (not 0) means "no year filter" on the backend.
  const yearFilter = (year: number) => (year > 0 ? year : undefined);
  const [sortBy, setSortBy] = useState("relevance");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "notes" | "pdf">("details");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ------------------------------------------------------------
  // Mendeley-style library views + sortable table
  // ------------------------------------------------------------
  const [systemView, setSystemView] = useState<
    "all" | "recent" | "favorites" | "unsorted"
  >("all");
  const [sortColumn, setSortColumn] = useState<
    "title" | "author" | "year" | "date"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);

  // Load the saved-library set once so Favorites/★ reflect reality.
  useEffect(() => {
    getLibrary()
      .then((entries) =>
        setSavedIds(new Set(entries.map((entry) => entry.paper.id))),
      )
      .catch(() => {});
  }, []);

  // Notes live in localStorage (no backend field yet).
  const [notes, setNotes] = useState<Record<number, string>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("paperrec_notes") ?? "{}",
      );
    } catch {
      return {};
    }
  });

  function saveNotes(id: number, text: string) {
    setNotes((prev) => {
      const next = { ...prev, [id]: text };
      try {
        localStorage.setItem("paperrec_notes", JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    });
  }

  // ------------------------------------------------------------
  // Pipeline integration: pick an algorithm (shared with the nav
  // MODE chip and the Search tab) and rank the repository list by
  // similarity to the selected paper.
  // ------------------------------------------------------------
  const { pipelineId, setPipelineId, customWeights } =
    usePipelineMode();
  const activePipelineConfig =
    pipelineId === "custom"
      ? customPipelineConfig(customWeights)
      : pipelineConfigs.find((config) => config.id === pipelineId) ??
    pipelineConfigs[pipelineConfigs.length - 1];

  const similarityMode = sortBy === "similarity";

  const [similarity, setSimilarity] = useState<
    Map<number, { score: number; rank: number }> | null
  >(null);
  const [similarityLoading, setSimilarityLoading] = useState(false);

  useEffect(() => {
    if (!similarityMode || !selectedPaper) {
      setSimilarity(null);
      return;
    }

    let cancelled = false;
    setSimilarityLoading(true);

    getRecommendations({
      pipeline: pipelineId,
      seedPaperId: selectedPaper.id,
      // The API bounds recommendation requests at 100.
      topK: 100,
      // The custom pipeline needs the dial allocation; without it
      // the API rejects the request and the sort silently dies.
      ...(pipelineId === "custom"
        ? { weights: customWeights }
        : {}),
    })
      .then((results) => {
        if (cancelled) {
          return;
        }
        const map = new Map<number, { score: number; rank: number }>();
        results.forEach((result, index) => {
          map.set(result.paper.id, {
            score: result.score,
            rank: index + 1,
          });
        });
        setSimilarity(map);
      })
      .catch(() => {
        if (!cancelled) {
          setSimilarity(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSimilarityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [similarityMode, selectedPaper?.id, pipelineId, customWeights]);

  // ------------------------------------------------------------
  // Web search (OpenAlex + Crossref) — toggled next to the
  // repository scope. Peer-reviewed only by default.
  // ------------------------------------------------------------
  const [searchMode, setSearchMode] = useState<SearchMode>("repository");
  const [webResults, setWebResults] = useState<WebSearchResult[]>([]);
  const [selectedWeb, setSelectedWeb] = useState<WebSearchResult | null>(null);
  const [webLoading, setWebLoading] = useState(false);
  const [webSearched, setWebSearched] = useState(false);
  // A newer web search cancels the one still in flight, so repeated
  // clicks never leave a stale response to overwrite fresh results.
  const webAbortRef = useRef<AbortController | null>(null);
  const [peerReviewed, setPeerReviewed] = useState(true);
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [webSources, setWebSources] = useState("openalex,crossref,arxiv");
  const [webSort, setWebSort] = useState<"relevance" | "citations" | "year">(
    "relevance",
  );
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [webImportStatus, setWebImportStatus] = useState<
    Record<string, "saved" | "exists">
  >({});
  const [webRowErrors, setWebRowErrors] = useState<Record<string, string>>({});

  // Pagination (10 papers per page; resets whenever the filtered
  // result set changes).
  const PAPERS_PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [papers]);

  // System views filter the fetched set (backend filters apply first).
  const viewPapers = useMemo(() => {
    if (systemView === "favorites") {
      return papers.filter((p) => savedIds.has(p.id));
    }
    if (systemView === "unsorted") {
      return papers.filter((p) => !p.subject_category);
    }
    if (systemView === "recent") {
      return [...papers].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    }
    return papers;
  }, [papers, systemView, savedIds]);

  // Sortable columns (client-side; similarity ranking overrides).
  const sortedPapers = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...viewPapers];

    arr.sort((a, b) => {
      let result = 0;

      if (sortColumn === "title") {
        result = (a.title ?? "").localeCompare(b.title ?? "");
      } else if (sortColumn === "author") {
        result = (a.author ?? "").localeCompare(b.author ?? "");
      } else if (sortColumn === "year") {
        result = (a.publication_year ?? 0) - (b.publication_year ?? 0);
      } else {
        result = a.created_at.localeCompare(b.created_at);
      }

      return result * dir;
    });

    return arr;
  }, [viewPapers, sortColumn, sortDir]);

  function toggleSort(column: typeof sortColumn) {
    if (sortColumn === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDir("desc");
    }
  }

  // In similarity mode the filtered set is re-ranked by the
  // selected pipeline's score against the selected paper.
  const rankedPapers =
    similarityMode && similarity
      ? [...sortedPapers].sort(
          (a, b) =>
            (similarity.get(b.id)?.score ?? -Infinity) -
            (similarity.get(a.id)?.score ?? -Infinity),
        )
      : sortedPapers;

  const pageCount = Math.max(
    1,
    Math.ceil(rankedPapers.length / PAPERS_PAGE_SIZE),
  );
  const pageStart = (page - 1) * PAPERS_PAGE_SIZE;
  const pagedPapers = rankedPapers.slice(
    pageStart,
    pageStart + PAPERS_PAGE_SIZE,
  );

  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as { selectSeed?: boolean; pipeline?: string } | null;
  const isSelectingSeed = navigationState?.selectSeed === true;
  const seedPipeline = navigationState?.pipeline ?? "tfidf";

  useEffect(() => {
    // Local fetch is suspended while the web scope is active so the
    // query typed for a web search doesn't re-hit the backend.
    if (searchMode === "web") return;

    setLoading(true);
    setError(null);
    listPapers({
      search: search || undefined,
      subject,
      category,
      document_type: documentType,
      min_year: yearFilter(minYear),
      max_year: yearFilter(maxYear),
      sort_by: sortBy,
    })
      .then(setPapers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [searchMode, search, subject, category, documentType, minYear, maxYear, sortBy]);

  /* ------------------------------------------------------------
     Web search uses legitimate APIs only (OpenAlex, Crossref,
     arXiv), peer-reviewed types by default, server-side
     filtering.
     ------------------------------------------------------------ */

  async function runWebSearch() {
    const query = search.trim();

    if (!query) {
      setError("Enter search terms to search the web.");
      return;
    }

    setWebLoading(true);
    setError(null);

    webAbortRef.current?.abort();
    const controller = new AbortController();
    webAbortRef.current = controller;

    try {
      const results = await searchWeb({
        q: query,
        year_min: yearFilter(minYear),
        year_max: yearFilter(maxYear),
        peer_reviewed: peerReviewed,
        open_access: openAccessOnly,
        sources: webSources,
        sort: webSort,
        limit: 20,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setWebResults(results);
      setSelectedWeb(null);
      setWebSearched(true);
      setWebImportStatus({});
      setWebRowErrors({});
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;

      setError(
        e instanceof Error ? e.message : "The web search failed.",
      );
    } finally {
      if (!controller.signal.aborted) setWebLoading(false);
    }
  }

  async function importWebResult(result: WebSearchResult) {
    const key = webKey(result);

    if (importingKey || webImportStatus[key]) return;

    setImportingKey(key);
    setWebRowErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });

    try {
      await importPaperFromMetadata({
        title: result.title,
        author: result.author,
        abstract: result.abstract,
        publication_year: result.publication_year,
        doi: result.doi,
        // Subject/category stays unset: it is a curator's judgment
        // call (same as the validation module's contract).
        document_type: result.document_type ?? "Journal Article",
        citation_count: result.citations,
        pdf_url: result.pdf_url ?? undefined,
        source_filename: `web:${result.source}`,
      });

      notifyRecommendationIndexStale();
      setWebImportStatus((previous) => ({ ...previous, [key]: "saved" }));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Couldn't import this paper.";

      if (message.toLowerCase().includes("duplicate")) {
        setWebImportStatus((previous) => ({ ...previous, [key]: "exists" }));
      } else {
        setWebRowErrors((previous) => ({ ...previous, [key]: message }));
      }
    } finally {
      setImportingKey(null);
    }
  }

  async function handleSave(paperId: number) {
    try {
      await saveToLibrary(paperId);
      setSavedIds((prev) => new Set(prev).add(paperId));
    } catch (e) {
      setError(e instanceof Error ? `Couldn't save paper: ${e.message}` : "Couldn't save paper.");
    }
  }

  async function handleUnsave(paperId: number) {
    try {
      await removeFromLibrary(paperId);
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(paperId);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? `Couldn't remove paper: ${e.message}` : "Couldn't remove paper.");
    }
  }

  function toggleSaved(paperId: number) {
    if (savedIds.has(paperId)) {
      void handleUnsave(paperId);
    } else {
      void handleSave(paperId);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBatchSave() {
    for (const id of selectedIds) {
      if (!savedIds.has(id)) {
        await handleSave(id);
      }
    }
    clearSelection();
  }

  async function handleBatchDelete() {
    const targets = rankedPapers.filter((p) => selectedIds.has(p.id));
    if (
      targets.length === 0 ||
      !window.confirm(
        `Delete ${targets.length} paper${targets.length === 1 ? "" : "s"} permanently? This removes records, library entries, and stored files.`,
      )
    ) {
      return;
    }
    for (const paper of targets) {
      await handleDelete(paper.id, paper.title);
    }
    clearSelection();
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await rebuildRecommendationIndex();
      notifyRecommendationIndexStale();
      const filters = {
        search: search || undefined,
        subject,
        category,
        document_type: documentType,
        min_year: yearFilter(minYear),
        max_year: yearFilter(maxYear),
        sort_by: sortBy,
      };
      const fresh = await listPapers(filters);
      setPapers(fresh);
    } catch (e) {
      setError(
        e instanceof Error ? `Sync failed: ${e.message}` : "Sync failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  function handleSelectSeed(paperId: number) {
    navigate("/recommendations", { state: { mode: "seed", seedPaperId: paperId, pipeline: seedPipeline } });
  }

  async function handleDelete(paperId: number, title: string) {
    if (!window.confirm(`Delete "${title}" permanently? This removes the repository record, library entry, and stored file.`)) return;
    try {
      setError(null);
      await deletePaper(paperId);
      // The pet burns the paper it just erased.
      triggerSlimeAnimation("burn");
      setPapers((prev) => prev.filter((paper) => paper.id !== paperId));
      if (selectedPaper?.id === paperId) setSelectedPaper(null);
    } catch (e) {
      setError(e instanceof Error ? `Couldn't delete "${title}": ${e.message}` : `Couldn't delete "${title}".`);
    }
  }

  function selectPaper(paper: Paper) {
    setSelectedPaper(paper);
    setViewerOpen(false);
    setDetailTab("details");
  }

  /** Open the viewer pop-up frame for the given PDF URL (or the stored PDF). */
  function openPdfPreview(url: string | null) {
    setPreviewUrl(url);
    setViewerOpen(true);
  }

  function hasPdf(paper: Paper | null): boolean {
    return paper?.stored_path?.toLowerCase().endsWith(".pdf") ?? false;
  }

  async function handleDeletePdf(paper: Paper) {
    if (
      !window.confirm(
        `Delete the stored PDF of "${paper.title}"? The bibliographic record stays intact.`,
      )
    ) {
      return;
    }

    try {
      const updated = await deletePaperPdf(paper.id);
      setPapers((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
      setSelectedPaper(updated);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't delete the PDF: ${e.message}`
          : "Couldn't delete the PDF.",
      );
    }
  }

  const selected = selectedPaper;
  const selectedSaved = selected ? savedIds.has(selected.id) : false;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-orb")!} />
      <PageHeader
        eyebrow="Repository"
        title="Browse academic papers"
        description={
          loading
            ? "Loading papers…"
            : searchMode === "web"
              ? `Web search · legitimate sources (OpenAlex, Crossref, arXiv) · ${
                  webSearched
                    ? `${webResults.length} result${webResults.length === 1 ? "" : "s"}`
                    : "peer-reviewed by default"
                }`
              : `${papers.length} papers · three-pane layout: filter on the left, list in the middle, details on the right.`
        }
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <LayoutOptions />
            <Button type="button" onClick={() => navigate("/upload")}>
              Upload paper
            </Button>
          </div>
        }
      />

      {isSelectingSeed && (
        <div className="status-warning mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Select a paper to use as the seed document.</span>
          <button type="button" onClick={() => navigate("/repository", { replace: true })} className="text-sm font-bold text-ink underline">
            Cancel
          </button>
        </div>
      )}

      <div
        className="mt-6 flex min-h-0 flex-col gap-4 lg:h-[calc(100dvh-19rem)] lg:flex-row lg:min-h-[480px]"
        style={
          {
            "--pane-left": `${leftPaneW}px`,
            "--pane-right": `${rightPaneW}px`,
          } as React.CSSProperties
        }
      >
        {/* ====================================================
            LEFT PANE — filters
            ==================================================== */}

        {prefs.sidebar && (
        <aside
          className="shrink-0 overflow-y-auto rounded border-[3px] border-gray-900 bg-white p-4 lg:w-[var(--pane-left)]"
          data-tips="repo-filters"
        >
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
            Filters
          </p>

          <div className="space-y-3">
            {/* Search scope: local repository vs the open web */}
            <div>
              <span className="filter-label">Search in</span>
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setSearchMode("repository")}
                  aria-pressed={searchMode === "repository"}
                  className={`rounded-l border-[3px] border-gray-900 px-3 py-1.5 text-sm font-bold text-ink transition-colors pixel-ease ${
                    searchMode === "repository"
                      ? "bg-accent"
                      : "bg-surface hover:bg-accentSoft"
                  }`}
                >
                  Repository
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("web")}
                  aria-pressed={searchMode === "web"}
                  className={`-ml-[3px] rounded-r border-[3px] border-gray-900 px-3 py-1.5 text-sm font-bold text-ink transition-colors pixel-ease ${
                    searchMode === "web"
                      ? "bg-accent"
                      : "bg-surface hover:bg-accentSoft"
                  }`}
                >
                  Web
                </button>
              </div>
            </div>

            <div>
              <label className="filter-label" htmlFor="repo-search">
                {searchMode === "web" ? "Topic, method, or title" : "Search"}
              </label>
              <TextInput
                id="repo-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchMode === "web") {
                    void runWebSearch();
                  }
                }}
                placeholder={
                  searchMode === "web"
                    ? "e.g. graph neural networks"
                    : "Title, author, keywords…"
                }
              />
            </div>

            {searchMode === "web" && (
              <>
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  onClick={() => void runWebSearch()}
                  disabled={webLoading || !search.trim()}
                >
                  {webLoading ? "Searching…" : "Search web"}
                </Button>

                <div className="space-y-2.5 border-t-[2px] border-gray-200 pt-3">
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={peerReviewed}
                      onChange={(e) => setPeerReviewed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                      Peer-reviewed only
                      <span className="block text-xs leading-4 text-muted">
                        Journals, conferences, book chapters, no
                        preprints, datasets, or retracted work. Selecting arXiv as a source
                        includes preprints by design.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={openAccessOnly}
                      onChange={(e) => setOpenAccessOnly(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                      Open access only
                      <span className="block text-xs leading-4 text-muted">
                        Free full text available
                        {openAccessOnly ? " · searches OpenAlex" : ""}.
                      </span>
                    </span>
                  </label>

                  <div>
                    <label className="filter-label" htmlFor="web-sources">
                      Sources
                    </label>
                    <select
                      id="web-sources"
                      value={webSources}
                      onChange={(e) => setWebSources(e.target.value)}
                      className="min-h-10 w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2 text-sm font-medium text-ink"
                    >
                      <option value="openalex,crossref,arxiv">
                        All (OpenAlex + Crossref + arXiv)
                      </option>
                      <option value="openalex,crossref">
                        OpenAlex + Crossref
                      </option>
                      <option value="openalex,arxiv">
                        OpenAlex + arXiv
                      </option>
                      <option value="crossref,arxiv">
                        Crossref + arXiv
                      </option>
                      <option value="openalex">OpenAlex only</option>
                      <option value="crossref">Crossref only</option>
                      <option value="arxiv">arXiv only</option>
                    </select>
                  </div>

                  <div>
                    <label className="filter-label" htmlFor="web-sort">
                      Sort
                    </label>
                    <select
                      id="web-sort"
                      value={webSort}
                      onChange={(e) =>
                        setWebSort(
                          e.target.value as "relevance" | "citations" | "year",
                        )
                      }
                      className="min-h-10 w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2 text-sm font-medium text-ink"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="citations">Most cited</option>
                      <option value="year">Newest</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {searchMode === "repository" && (
              <>
                {/* My Library system views */}
                <div className="border-b-[2px] border-gray-200 pb-3">
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
                    My Library
                  </p>
                  <div className="space-y-1">
                    {(
                      [
                        ["all", "All Documents"],
                        ["recent", "Recently Added"],
                        ["favorites", "Favorites"],
                        ["unsorted", "Unsorted"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSystemView(id)}
                        aria-pressed={systemView === id}
                        className={`block w-full rounded border-[2px] border-gray-900 px-2.5 py-1.5 text-left text-sm font-semibold transition-colors pixel-ease ${
                          systemView === id
                            ? "bg-accent text-onAccent"
                            : "bg-surface text-ink hover:bg-accentSoft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <FilterSelect label="Subject" value={subject} options={subjects} onChange={setSubject} />
                <FilterSelect label="Category" value={category} options={categories} onChange={setCategory} />
                <FilterSelect label="Document type" value={documentType} options={documentTypes} onChange={setDocumentType} />
              </>
            )}

            <div>
              <span className="filter-label">Year range</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minYear === 0 ? "" : minYear}
                  onChange={(e) => handleMinYearChange(e.target.value)}
                  aria-label="Minimum publication year"
                  placeholder="From"
                  className="min-h-10 w-24 rounded border-[3px] border-gray-900 bg-field px-2 py-2 text-center text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
                />
                <span className="text-muted">–</span>
                <input
                  type="number"
                  value={maxYear === 0 ? "" : maxYear}
                  onChange={(e) => handleMaxYearChange(e.target.value)}
                  aria-label="Maximum publication year"
                  placeholder="To"
                  className="min-h-10 w-24 rounded border-[3px] border-gray-900 bg-field px-2 py-2 text-center text-sm font-medium text-ink placeholder:text-muted focus:outline-none"
                />
              </div>
            </div>

            {searchMode === "repository" && (
              <div>
                <label className="filter-label" htmlFor="repo-sort">Sort</label>
                <select
                  id="repo-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="min-h-10 w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2 text-sm font-medium text-ink"
                >
                  <option value="date_added">Date added</option>
                  <option value="title">Title</option>
                  <option value="publication_year">Publication year</option>
                  <option value="relevance">Relevance</option>
                  <option value="similarity">
                    Similarity ({activePipelineConfig.codename})
                  </option>
                </select>

                {similarityMode && (
                  <p className="mt-1.5 text-xs leading-5 text-muted">
                    {!selectedPaper
                      ? "Select a paper in the list to rank by similarity."
                      : `Ranked by ${activePipelineConfig.codename} against the selected paper.`}
                  </p>
                )}
              </div>
            )}

            {searchMode === "repository" && (
              <div className="border-t-[2px] border-gray-200 pt-4">
                <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
                  Pipeline
                </p>

                <div className="space-y-1.5">
                  {pipelineConfigs.map((config) => {
                    const active = config.id === pipelineId;

                    return (
                      <button
                        key={config.id}
                        type="button"
                        onClick={() => setPipelineId(config.id)}
                        className={`w-full rounded border-[3px] border-gray-900 px-2.5 py-2 text-left text-sm font-semibold transition pixel-ease ${
                          active
                            ? "bg-accent"
                            : "bg-surface hover:bg-accentSoft"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between gap-2 rounded border-[2px] px-2 py-1 ${
                            active
                              ? "border-white/40 bg-white/25"
                              : "border-gray-900 bg-surfaceAlt"
                          }`}
                        >
                          <span
                            className={`whitespace-nowrap text-xs font-bold ${
                              active ? "text-onAccent" : "text-ink"
                            }`}
                          >
                            {config.codename}
                          </span>
                          <span
                            className={`truncate font-mono text-xs font-bold tracking-[0.12em] ${
                              active ? "text-onAccent" : "text-muted"
                            }`}
                          >
                            {config.label}
                          </span>
                        </div>

                        <div className="mt-1.5">
                          <WeightBar weights={config.weights} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 border-t-[2px] border-gray-200 pt-3 text-xs text-muted">
            {searchMode === "web"
              ? "Web searches run when you press Search web."
              : "Filters apply as you change them."}
          </p>
        </aside>
        )}

        {prefs.sidebar && (
        <PaneHandle
          label="Resize filters panel"
          onResize={resizeLeft}
        />
        )}

        {/* ====================================================
            MIDDLE PANE — paper list
            ==================================================== */}

        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border-[3px] border-gray-900 bg-white"
          aria-label="Paper results"
          data-tips="repo-results"
        >
          {/* Toolbar: Add / Sync / Help (Mendeley-style actions) */}
          {searchMode === "repository" && (
            <div className="flex shrink-0 items-center gap-1.5 border-b-[3px] border-gray-900 bg-canvas px-4 py-2">
              <button
                type="button"
                onClick={() => navigate("/upload")}
                className="rounded border-[2px] border-gray-900 bg-surface px-2.5 py-1 text-sm font-semibold text-ink hover:bg-accentSoft transition-colors pixel-ease"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="rounded border-[2px] border-gray-900 bg-surface px-2.5 py-1 text-sm font-semibold text-ink hover:bg-accentSoft transition-colors pixel-ease disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "⟳ Sync"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/faq")}
                className="rounded border-[2px] border-gray-900 bg-white px-2.5 py-1 text-sm font-semibold text-ink hover:bg-accentSoft transition-colors pixel-ease"
              >
                ? Help
              </button>
            </div>
          )}

          <div className="flex shrink-0 items-center justify-between border-b-[3px] border-gray-900 bg-canvas px-4 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-ink">
              {searchMode === "web" ? "Web results" : "Papers"}
            </p>
            <p className="font-mono text-xs text-muted">
              {searchMode === "web"
                ? webLoading
                  ? "…"
                  : `${webResults.length} result${webResults.length === 1 ? "" : "s"}`
                : similarityMode
                  ? similarityLoading
                    ? `ranking via ${activePipelineConfig.codename}…`
                    : `${rankedPapers.length} ranked via ${activePipelineConfig.codename}`
                  : loading
                    ? "…"
                    : `${rankedPapers.length} result${rankedPapers.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error && <div className="status-error m-4">{error}</div>}

            {searchMode === "web" ? (
              /* --------------------------------------------------
                  WEB RESULTS — legitimate sources, with provenance
                  and a per-row import into the repository.
                  -------------------------------------------------- */
              webLoading ? (
                <div className="p-8 text-center">
                  <p className="animate-blink text-sm font-bold text-muted">
                    Searching OpenAlex &amp; Crossref…
                  </p>
                </div>
              ) : !webSearched ? (
                <div className="p-6">
                  <EmptyState
                    title="Search the open scholarly web."
                    description="Peer-reviewed journal articles, conference papers, and book chapters from OpenAlex and Crossref. Import any hit straight into your repository."
                  />
                </div>
              ) : webResults.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No results."
                    description="Try broader terms, widen the year range, or turn off a filter."
                  />
                </div>
              ) : (
                webResults.map((result, index) => {
                  const key = webKey(result);
                  const status = webImportStatus[key];
                  const active = selectedWeb !== null && webKey(selectedWeb) === key;

                  return (
                    <StaggerIn key={key} index={index} className="border-b border-gray-200 last:border-b-0">
                      <article
                        className={`paper-row cursor-pointer p-4 transition-colors pixel-ease ${
                          active ? "bg-accentSoft" : "hover:bg-canvas"
                        }`}
                        onClick={() => setSelectedWeb(result)}
                      >
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink">
                            {result.source}
                          </span>
                          <span className="text-muted">{result.publication_year ?? "—"}</span>
                          <span className="text-muted">·</span>
                          <span className="text-muted">{result.document_type ?? "Work"}</span>
                          {result.is_oa === true && (
                            <span className="rounded border-[2px] border-gray-900 bg-accent px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-onAccent">
                              Open access
                            </span>
                          )}
                          {result.citations != null && result.citations > 0 && (
                            <span className="text-muted">· cited {result.citations}</span>
                          )}
                        </div>

                        <p className="text-sm font-bold leading-5 text-ink">
                          {result.landing_url ? (
                            <a
                              href={result.landing_url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              <MathText text={result.title} />
                            </a>
                          ) : (
                            <MathText text={result.title} />
                          )}
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          {result.author ?? "Unknown author"}
                          {result.venue ? ` · ${result.venue}` : ""}
                        </p>

                        {result.abstract && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">
                            {result.abstract}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {status === "saved" ? (
                            <span className="inline-flex items-center gap-1 rounded border-[2px] border-gray-900 bg-accent px-2 py-1 text-xs font-bold text-onAccent">
                              <Check className="h-2.5 w-2.5" />
                              Saved to repository
                            </span>
                          ) : status === "exists" ? (
                            <span className="inline-flex items-center gap-1 rounded border-[2px] border-gray-900 bg-white px-2 py-1 text-xs font-bold text-ink">
                              <Check className="h-2.5 w-2.5" />
                              Already in repository
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void importWebResult(result)}
                              disabled={importingKey !== null}
                              className="rounded border-[3px] border-gray-900 bg-accent px-3 py-1 text-xs font-bold text-onAccent transition-colors pixel-ease hover:bg-accentSoft disabled:opacity-50"
                            >
                              {importingKey === key ? "Importing…" : "Import"}
                            </button>
                          )}

                          {webRowErrors[key] && (
                            <span className="text-xs font-bold text-ink">
                              {webRowErrors[key]}
                            </span>
                          )}
                        </div>
                      </article>
                    </StaggerIn>
                  );
                })
              )
            ) : loading ? (
              <div className="p-8 text-center">
                <p className="animate-blink text-sm font-bold text-muted">Loading repository…</p>
              </div>
            ) : rankedPapers.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No papers match these filters." description="Try broadening the search, switching the library view, or changing one of the filters." figure={<PetFigure size={80} />} />
              </div>
            ) : (
              /* ------------------------------------------------
                 TABULAR REFERENCE LIST — sortable columns,
                 favorites, PDF indicators, multi-select.
                 ------------------------------------------------ */
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b-[3px] border-gray-900 text-xs uppercase tracking-wide text-muted">
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all on page"
                        checked={
                          pagedPapers.length > 0 &&
                          pagedPapers.every((p) => selectedIds.has(p.id))
                        }
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          for (const p of pagedPapers) {
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                          }
                          setSelectedIds(next);
                        }}
                        className="h-3.5 w-3.5"
                      />
                    </th>
                    <th className="w-10 px-1 py-2.5 text-center" aria-label="PDF" />
                    <th className="w-12 px-1 py-2.5 text-center" aria-label="Favorite" />
                    {(
                      [
                        ["title", "Title"],
                        ["author", "Authors"],
                        ["year", "Year"],
                        ["date", "Date Added"],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className="px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className={`inline-flex items-center gap-1 font-mono text-sm font-semibold uppercase tracking-wide transition-colors pixel-ease ${
                            sortColumn === key ? "text-ink" : "text-muted hover:text-ink"
                          }`}
                        >
                          {label}
                          {sortColumn === key
                            ? sortDir === "asc"
                              ? "↑"
                              : "↓"
                            : ""}
                        </button>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-right font-mono text-xs uppercase tracking-wide">
                      Type
                    </th>
                    {similarityMode && (
                      <th className="px-2 py-2.5 text-right font-mono text-xs uppercase tracking-wide">
                        Score
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {pagedPapers.map((paper, index) => {
                    const { subject: paperSubject, category: paperCategory } = categoryOf(paper);
                    const isCS = paperSubject.toLowerCase().includes("computer");
                    const active = selected?.id === paper.id;
                    const sim = similarity?.get(paper.id);
                    const isSaved = savedIds.has(paper.id);
                    const isSelected = selectedIds.has(paper.id);

                    return (
                      <tr
                        key={paper.id}
                        onClick={() => selectPaper(paper)}
                        className={`cursor-pointer border-b border-gray-200 last:border-b-0 transition-colors pixel-ease ${
                          isSelected ? "bg-accentSoft" : active ? "bg-accentSoft/60" : "hover:bg-canvas"
                        }`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${paper.title}`}
                            checked={isSelected}
                            onChange={() => toggleSelected(paper.id)}
                            className="h-3.5 w-3.5"
                          />
                        </td>
                        <td className="px-1 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {hasPdf(paper) && (
                            <span
                              className="inline-flex items-center rounded border-[2px] border-gray-900 bg-accent px-1 py-0.5 font-mono text-xs font-bold leading-none text-onAccent"
                              title="PDF attached"
                            >
                              PDF
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleSaved(paper.id)}
                            aria-label={isSaved ? "Remove from favorites" : "Add to favorites"}
                            className={`transition-colors pixel-ease ${
                              isSaved ? "text-accent" : "text-muted hover:text-ink"
                            }`}
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="max-w-[280px] px-2 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {paperSubject && (
                              <span className={`shrink-0 rounded border-[2px] border-gray-900 bg-surface px-1 py-0.5 text-xs font-bold ${isCS ? "text-cs" : "text-math"}`}>
                                {paperSubject}
                              </span>
                            )}
                            <span className="truncate font-bold text-ink">
                              <MathText text={paper.title} />
                            </span>
                          </div>
                          {paperCategory && (
                            <span className="mt-0.5 block truncate text-xs text-muted">
                              {paperCategory}
                            </span>
                          )}
                          {paper.snippet && (
                            <span
                              className="mt-0.5 block truncate text-xs italic text-muted"
                              title={paper.snippet}
                            >
                              <Highlight
                                text={paper.snippet}
                                terms={search.trim().split(/\s+/)}
                              />
                            </span>
                          )}
                          {typeof paper.duplicate_count === "number" &&
                            paper.duplicate_count > 0 && (
                              <span
                                className="mt-0.5 inline-flex items-center rounded border-[2px] border-gray-900 bg-canvas px-1 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-muted"
                                title="Near-duplicate records hidden from this result list"
                              >
                                +{paper.duplicate_count} duplicate
                                {paper.duplicate_count === 1 ? "" : "s"}
                              </span>
                            )}
                        </td>
                        <td className="max-w-[200px] truncate px-2 py-2.5 text-muted">
                          {paper.author ?? "Unknown author"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-mono text-muted">
                          {paper.publication_year ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 font-mono text-muted">
                          {new Date(paper.created_at).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-right text-muted">
                          {paper.document_type ?? "—"}
                        </td>
                        {similarityMode && (
                          <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-muted">
                            {sim ? `#${sim.rank} · ${sim.score.toFixed(4)}` : "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Batch action bar */}
            {searchMode === "repository" && selectedIds.size > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-t-[3px] border-gray-900 bg-canvas px-4 py-2">
                <span className="font-mono text-xs font-bold text-ink">
                  {selectedIds.size} selected
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleBatchSave()}
                  >
                    Save to library
                  </Button>
                  <button
                    type="button"
                    onClick={() => void handleBatchDelete()}
                    className="inline-flex h-9 items-center justify-center rounded border-[3px] border-gray-900 bg-surface px-3 text-sm font-semibold text-ink hover:bg-accent hover:text-onAccent transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex h-9 items-center justify-center rounded border-[3px] border-gray-900 bg-surface px-3 text-sm font-semibold text-ink hover:bg-accentSoft transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {searchMode === "repository" && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              total={rankedPapers.length}
              pageSize={PAPERS_PAGE_SIZE}
              className="shrink-0 border-t-[3px] border-gray-900"
            />
          )}
        </section>

        {/* ====================================================
            RIGHT PANE — paper details
            ==================================================== */}

        {prefs.details && (
        <PaneHandle
          label="Resize details panel"
          onResize={resizeRight}
        />
        )}

        {prefs.details && (
        <aside className="w-full shrink-0 overflow-y-auto rounded border-[3px] border-gray-900 bg-white lg:w-[var(--pane-right)]">
          {searchMode === "web" ? (
            /* ------------------------------------------------
               WEB RESULT DETAILS
               ------------------------------------------------ */
            !selectedWeb ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                  NO WEB RESULT SELECTED
                </p>
                <p className="max-w-xs text-sm leading-6 text-muted">
                  Click a web result to see its record here. Then
                  import it into the repository.
                </p>
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-ink">
                    {selectedWeb.source}
                  </span>
                  <span className="text-muted">{selectedWeb.publication_year ?? "—"}</span>
                  <span className="text-muted">·</span>
                  <span className="text-muted">{selectedWeb.document_type ?? "Work"}</span>
                  {selectedWeb.is_oa === true && (
                    <span className="rounded border-[2px] border-gray-900 bg-accent px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-onAccent">
                      Open access
                    </span>
                  )}
                </div>

                <h2 className="text-base font-bold leading-6 text-ink">
                  {selectedWeb.title}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {selectedWeb.author ?? "Unknown author"}
                  {selectedWeb.venue ? ` · ${selectedWeb.venue}` : ""}
                  {selectedWeb.citations != null && selectedWeb.citations > 0
                    ? ` · cited ${selectedWeb.citations}`
                    : ""}
                </p>

                {selectedWeb.abstract && (
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted">
                    {selectedWeb.abstract}
                  </p>
                )}

                {selectedWeb.doi && (
                  <p className="mt-3 break-all text-xs text-muted">
                    <span className="font-bold text-ink">DOI:</span>{" "}
                    {selectedWeb.doi}
                  </p>
                )}

                {selectedWeb.landing_url && (
                  <a
                    href={selectedWeb.landing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block break-all text-xs font-bold text-ink underline hover:decoration-2"
                  >
                    Open landing page ↗
                  </a>
                )}

                {/* Actions */}
                <div className="mt-5 flex flex-wrap gap-2 border-t-[3px] border-gray-900 pt-4">
                  {(() => {
                    const key = webKey(selectedWeb);
                    const status = webImportStatus[key];

                    if (status === "saved") {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-accent px-3 py-2 text-sm font-bold text-onAccent">
                          <Check className="h-3.5 w-3.5" />
                          Saved to repository
                        </span>
                      );
                    }

                    if (status === "exists") {
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-white px-3 py-2 text-sm font-bold text-ink">
                          <Check className="h-3.5 w-3.5" />
                          Already in repository
                        </span>
                      );
                    }

                    return (
                      <Button
                        variant="primary"
                        type="button"
                        onClick={() => void importWebResult(selectedWeb)}
                        disabled={importingKey !== null}
                      >
                        {importingKey === key
                          ? "Importing…"
                          : "Import into repository"}
                      </Button>
                    );
                  })()}

                  {webRowErrors[webKey(selectedWeb)] && (
                    <span className="text-xs font-bold text-ink">
                      {webRowErrors[webKey(selectedWeb)]}
                    </span>
                  )}
                </div>
              </div>
            )
          ) : !selected ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-ink">
                NO PAPER SELECTED
              </p>
              <p className="max-w-xs text-sm leading-6 text-muted">
                Click a paper in the list to see its full record,
                abstract, and actions here.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Detail / Notes / PDF tabs */}
              <div className="flex shrink-0 gap-0.5 border-b-[3px] border-gray-900 bg-canvas p-2">
                {(["details", "notes", "pdf"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    aria-pressed={detailTab === tab}
                    className={`flex-1 rounded border-[3px] border-gray-900 px-2 py-1.5 text-sm font-semibold transition-colors pixel-ease ${
                      detailTab === tab
                        ? "bg-accent text-onAccent"
                        : "bg-surface text-ink hover:bg-accentSoft"
                    }`}
                  >
                    {tab === "details" ? "Details" : tab === "notes" ? "Notes" : "PDF"}
                  </button>
                ))}
              </div>

              {detailTab === "notes" ? (
                /* ----------------------------------------------
                   NOTES TAB
                   ---------------------------------------------- */
                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <p className="mb-2 text-xs font-bold text-muted">
                    Notes on this paper
                  </p>
                  <textarea
                    value={notes[selected.id] ?? ""}
                    onChange={(e) => saveNotes(selected.id, e.target.value)}
                    placeholder="Write annotations, quotes, or reading notes here…"
                    className="ui-input min-h-40 flex-1 resize-y font-mono text-xs leading-5"
                  />
                  <p className="mt-2 text-xs text-muted">
                    Saved automatically in this browser.
                  </p>
                </div>
              ) : detailTab === "pdf" ? (
                /* ----------------------------------------------
                   PDF TAB — preview, fetch, delete
                   ---------------------------------------------- */
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {hasPdf(selected) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openPdfPreview(null)}
                        title="Preview in the pop-up viewer"
                        className="block w-full overflow-hidden rounded border-[2px] border-gray-900 bg-canvas transition-colors pixel-ease hover:border-gray-600"
                      >
                        <iframe
                          src={getPaperPdfUrl(selected.id)}
                          title={selected.title || "Paper PDF"}
                          className="pointer-events-none h-72 w-full border-0"
                        />
                      </button>

                      <p className="mt-3 break-all font-mono text-xs text-muted">
                        <span className="font-bold text-ink">File:</span>{" "}
                        {selected.stored_path}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => openPdfPreview(null)}
                        >
                          Preview in viewer
                        </Button>

                        <a
                          href={getPaperPdfUrl(selected.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center rounded border-[3px] border-gray-900 bg-white px-3 text-sm font-semibold text-ink hover:bg-accent hover:text-onAccent transition-colors"
                        >
                          Open full PDF ↗
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeletePdf(selected)}
                          className="inline-flex h-9 items-center justify-center rounded border-[3px] border-gray-900 bg-white px-3 text-sm font-semibold text-ink hover:bg-accent hover:text-onAccent transition-colors"
                        >
                          Delete PDF
                        </button>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-muted">
                        Deleting the PDF keeps the bibliographic record. The PDF
                        you can fetch a different open-access copy here
                        afterwards.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-3 text-xs leading-5 text-muted">
                        No PDF attached to this paper yet. Search the
                        open-access sources below, or delete and
                        replace an existing copy.
                      </p>

                      <FindPdfPanel
                        key={selected.id}
                        paper={selected}
                        onPreview={(url) => openPdfPreview(url)}
                        onAttached={(updated) => {
                          setPapers((prev) =>
                            prev.map((p) =>
                              p.id === updated.id ? updated : p,
                            ),
                          );
                          setSelectedPaper(updated);
                        }}
                      />
                    </>
                  )}
                </div>
              ) : (
              <div className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                {(() => {
                  const { subject: s, category: c } = categoryOf(selected);
                  const isCS = s.toLowerCase().includes("computer");
                  return (
                    <>
                      {s && (
                        <span className={`rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 text-xs font-bold ${isCS ? "text-cs" : "text-math"}`}>
                          {s}
                        </span>
                      )}
                      {c && <span className="text-muted">{c}</span>}
                      <span className="text-muted">·</span>
                      <span className="text-muted">{selected.publication_year ?? "—"}</span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">{selected.document_type ?? "Document"}</span>
                    </>
                  );
                })()}
              </div>

              <h2 className="text-base font-bold leading-6 text-ink">
                {selected.title || "Untitled paper"}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {selected.author ?? "Unknown author"}
                {selected.citation_count != null ? ` · ${selected.citation_count} cited` : ""}
              </p>

              {selected.abstract && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-muted">
                  {selected.abstract}
                </p>
              )}

              {/* Recommendation signal dots */}
              <div className="mt-4 rounded border-[2px] border-gray-900 bg-canvas p-3">
                <p className="mb-2 text-xs font-bold text-ink">
                  Recommendation signals
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SIGNAL_FIELDS.map((field) => {
                    const filled =
                      selected[field] != null && selected[field] !== "";
                    return (
                      <span key={field} className="flex items-center gap-1.5 text-xs text-muted">
                        <span
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-[2px] ${
                            filled ? "border-gray-900 bg-ink" : "border-gray-900 bg-white"
                          }`}
                        >
                          {filled && <Check className="h-2 w-2 text-onInk" />}
                        </span>
                        {field === "publication_year" ? "Year" : field[0].toUpperCase() + field.slice(1)}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {selected.is_valid_for_recommendation
                    ? "Valid for recommendation."
                    : `Missing: ${selected.missing_fields ?? "some fields"}.`}
                </p>
              </div>

              {selected.doi && (
                <p className="mt-3 break-all text-xs text-muted">
                  <span className="font-bold text-ink">DOI:</span> {selected.doi}
                </p>
              )}

              {selected.keywords && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selected.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 6).map((k) => (
                    <span key={k} className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-xs text-ink">
                      {k}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-3 break-all font-mono text-xs text-muted">
                <span className="font-bold text-ink">File:</span> {selected.stored_path || "No file"}
              </p>

              {/* Actions */}
              <div className="mt-5 flex flex-wrap gap-2 border-t-[3px] border-gray-900 pt-4">
                {isSelectingSeed ? (
                  <Button
                    variant="primary"
                    type="button"
                    disabled={!selected.is_valid_for_recommendation}
                    onClick={() => handleSelectSeed(selected.id)}
                  >
                    Use as seed
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => handleSave(selected.id)}
                      disabled={selectedSaved}
                    >
                      {selectedSaved ? "Saved" : "Save paper"}
                    </Button>

                    <Button variant="quiet" type="button" onClick={() => openPdfPreview(null)}>
                      View
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleDelete(selected.id, selected.title)}
                      className="inline-flex h-9 items-center justify-center rounded border-[3px] border-gray-900 bg-white px-3 text-sm font-semibold text-ink hover:bg-accent hover:text-onAccent transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
              )}
            </div>
          )}
        </aside>
        )}
      </div>

      <PaperViewerModal
        paper={selectedPaper}
        open={viewerOpen && !!selectedPaper}
        onClose={() => {
          setViewerOpen(false);
          setPreviewUrl(null);
        }}
        previewUrl={previewUrl}
        canEdit
        onPaperUpdated={(updated) => {
          setPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setSelectedPaper(updated);
        }}
      />
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="filter-label">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-10 w-full rounded border-[3px] border-gray-900 bg-field px-3 py-2 text-sm font-medium text-ink">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </div>
  );
}
