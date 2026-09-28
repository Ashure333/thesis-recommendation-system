import { useEffect, useMemo, useState } from "react";

import {
  Folder,
  Bookmark,
  Search,
  ExternalLink,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  AlertCircle,
} from "lucide-react";
import { FaRegFilePdf } from "react-icons/fa6";
import { CiFileOff } from "react-icons/ci";

import ConnectedPapersGraph from "../../components/ConnectedPapersGraph";
import ResearchAssistant, {
  ResearchReferencePanel,
} from "../../components/ResearchAssistant";
import { Button } from "../../components/ui";

import {
  listPapers,
  getRepositoryStats,
  getPaperPdfUrl,
  saveToLibrary,
  Paper,
  RepositoryStats,
  ResearchChatSource,
} from "../../api";

/* ============================================================
   GITINGEST DESIGN LANGUAGE
   Canvas #FFFDF8 · ink gray-900 · muted gray-600
   3px outlines on every interactive surface · 4px radius
   Orange #FCA847 = primary + active fill · field blue #E8F0FE = main input
   Depth = sibling slab (bg-gray-900, translate 4px/4px), never a blur
   Hairline (gray-200) only for incidental row separators
   No pills, no tracked all-caps labels, no state colours.
   ============================================================ */

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

/* ============================================================
   TYPES
   ============================================================ */

type DetailTab = "details" | "abstract";

type RecommendationPipeline =
  | "tfidf"
  | "sbert"
  | "tfidf_sbert"
  | "tfidf_metadata"
  | "sbert_metadata"
  | "tfidf_sbert_metadata";

const RECOMMENDATION_PIPELINES: {
  value: RecommendationPipeline;
  label: string;
}[] = [
  { value: "tfidf", label: "TF-IDF" },
  { value: "sbert", label: "S-BERT" },
  { value: "tfidf_sbert", label: "TF-IDF + S-BERT" },
  { value: "tfidf_metadata", label: "TF-IDF + Metadata" },
  { value: "sbert_metadata", label: "S-BERT + Metadata" },
  {
    value: "tfidf_sbert_metadata",
    label: "TF-IDF + S-BERT + Metadata",
  },
];

type PdfTab = {
  id: number;
  title: string;
};

/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function getFileName(path: string | null): string | null {
  if (!path) return null;

  const parts = path.split(/[\\/]/);

  return parts[parts.length - 1] || null;
}

function hasPdf(paper: Paper): boolean {
  return Boolean(
    paper.stored_path &&
      paper.stored_path.toLowerCase().endsWith(".pdf")
  );
}

function splitKeywords(value: string | null): string[] {
  if (!value) return [];

  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function LibraryUITest() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [stats, setStats] = useState<RepositoryStats | null>(null);

  const [selectedPaper, setSelectedPaper] =
    useState<Paper | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);

  const [detailTab, setDetailTab] =
    useState<DetailTab>("details");

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState<string | null>(null);

  /* ==========================================================
     PDF TABS
     ========================================================== */

  const [pdfTabs, setPdfTabs] =
    useState<PdfTab[]>([]);

  const [activePdfTabId, setActivePdfTabId] =
    useState<number | null>(null);

  const [activeView, setActiveView] =
    useState<"repository" | "research">("repository");

  const [researchSources, setResearchSources] =
    useState<ResearchChatSource[]>([]);

  /* ============================================================
     LOAD WHOLE REPOSITORY
     ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadRepository() {
      setLoading(true);
      setError(null);

      try {
        const [paperData, statsData] =
          await Promise.all([
            listPapers({
              sort_by: "created_at",
            }),
            getRepositoryStats(),
          ]);

        if (cancelled) return;

        setPapers(paperData);
        setStats(statsData);

        if (paperData.length > 0) {
          setSelectedPaper(paperData[0]);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load repository."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRepository();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================================================
     CATEGORIES
     ============================================================ */

  const categories = useMemo(() => {
    if (!stats?.by_subject) return [];

    return Object.entries(stats.by_subject).sort(
      (a, b) => a[0].localeCompare(b[0])
    );
  }, [stats]);

  /* ============================================================
     FILTERED PAPERS
     ============================================================ */

  const filteredPapers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return papers.filter((paper) => {
      const matchesCategory =
        !selectedCategory ||
        (paper.subject_category ||
          "Uncategorized") === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        paper.title,
        paper.author,
        paper.abstract,
        paper.keywords,
        paper.subject_category,
        paper.document_type,
        paper.doi,
        paper.source_filename,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    papers,
    searchQuery,
    selectedCategory,
  ]);

  /* ============================================================
     KEEP SELECTED PAPER VALID
     ============================================================ */

  useEffect(() => {
    if (filteredPapers.length === 0) {
      setSelectedPaper(null);
      return;
    }

    const stillExists =
      selectedPaper &&
      filteredPapers.some(
        (paper) =>
          paper.id === selectedPaper.id
      );

    if (!stillExists) {
      setSelectedPaper(filteredPapers[0]);
    }
  }, [
    filteredPapers,
    selectedPaper,
  ]);

  /* ============================================================
     SELECT PAPER
     ============================================================ */

  function selectPaper(paper: Paper) {
    setSelectedPaper(paper);
    setDetailTab("details");
    setSaveMessage(null);
  }

  /* ============================================================
     OPEN PDF IN MIDDLE APP TAB
     ============================================================ */

  function openPdfTab(paper: Paper) {
    if (!hasPdf(paper)) {
      return;
    }

    const existingTab = pdfTabs.find(
      (tab) => tab.id === paper.id
    );

    if (!existingTab) {
      setPdfTabs((current) => [
        ...current,
        {
          id: paper.id,
          title:
            paper.title ||
            "Untitled Paper",
        },
      ]);
    }

    setSelectedPaper(paper);
    setActiveView("repository");
    setActivePdfTabId(paper.id);
  }

  /* ============================================================
     CLOSE PDF TAB
     ============================================================ */

  function closePdfTab(paperId: number) {
    const tabIndex = pdfTabs.findIndex(
      (tab) => tab.id === paperId
    );

    const remainingTabs =
      pdfTabs.filter(
        (tab) => tab.id !== paperId
      );

    setPdfTabs(remainingTabs);

    if (activePdfTabId !== paperId) {
      return;
    }

    const replacement =
      remainingTabs[tabIndex - 1] ??
      remainingTabs[tabIndex] ??
      null;

    if (!replacement) {
      setActivePdfTabId(null);

      if (filteredPapers.length > 0) {
        setSelectedPaper(
          filteredPapers[0]
        );
      }

      return;
    }

    setActivePdfTabId(
      replacement.id
    );

    const replacementPaper =
      papers.find(
        (paper) =>
          paper.id === replacement.id
      );

    if (replacementPaper) {
      setSelectedPaper(
        replacementPaper
      );
    }
  }

  /* ============================================================
     ACTIVATE PDF TAB
     ============================================================ */

  function activatePdfTab(
    paperId: number
  ) {
    const paper = papers.find(
      (item) => item.id === paperId
    );

    if (!paper) return;

    setSelectedPaper(paper);
    setActiveView("repository");
    setActivePdfTabId(paperId);
  }

  /* ============================================================
     SHOW REPOSITORY
     ============================================================ */

  function showRepository() {
    setActiveView("repository");
    setActivePdfTabId(null);

    if (filteredPapers.length > 0) {
      setSelectedPaper(
        filteredPapers[0]
      );
    }
  }

  function showResearchAssistant() {
    setActiveView("research");
    setActivePdfTabId(null);
  }

  /* ============================================================
     SAVE TO LIBRARY
     ============================================================ */

  async function handleSave() {
    if (!selectedPaper || saving) {
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      await saveToLibrary(
        selectedPaper.id
      );

      setSaveMessage(
        "Saved to My Library."
      );

      window.setTimeout(() => {
        setSaveMessage(null);
      }, 2500);
    } catch (err) {
      setSaveMessage(
        err instanceof Error
          ? err.message
          : "Failed to save paper."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ============================================================
     CATEGORY
     ============================================================ */

  function selectCategory(
    category: string | null
  ) {
    setSelectedCategory(category);
    setActiveView("repository");
    setDetailTab("details");

    setActivePdfTabId(null);
  }

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FFFDF8]">
        <div className="text-center">
          {/* Small circular indicator: the one place rounded-full is allowed */}
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-[3px] border-gray-900 border-t-transparent motion-reduce:animate-none" />

          <p className="text-sm font-medium text-gray-900">
            Loading repository...
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     ERROR
     ============================================================ */

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FFFDF8] px-6">
        <div
          role="alert"
          className="max-w-md rounded border-[3px] border-gray-900 bg-white p-6 text-center"
        >
          <p className="text-xl font-bold leading-snug text-gray-900">
            Unable to load repository
          </p>

          <p className="mt-2 text-sm text-gray-600">
            {error}
          </p>

          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              onClick={() =>
                window.location.reload()
              }
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     PAGE
     ============================================================ */

  return (
    <div className="h-screen w-full overflow-hidden bg-[#FFFDF8] text-gray-900">

      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[256px_minmax(0,1fr)_420px] overflow-hidden">

        {/* ======================================================
            LEFT SIDEBAR
            ====================================================== */}

        <aside className="h-full min-h-0 min-w-0 overflow-hidden border-r-[3px] border-gray-900 bg-[#FFFDF8]">
          <div className="flex h-full min-h-0 flex-col">

            {/* HEADER */}

            <div className="shrink-0 border-b-[3px] border-gray-900 px-5 py-5">
              <h1 className="text-3xl font-bold leading-none tracking-tighter text-gray-900">
                RE: Search
              </h1>
            </div>

            {/* SIDEBAR CONTENT */}

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">

              <SidebarLabel>
                Repository
              </SidebarLabel>

              <div className="space-y-1">
                <SidebarButton
                  icon={<Bookmark size={15} />}
                  label="All papers"
                  count={
                    stats?.total_papers ??
                    papers.length
                  }
                  active={
                    selectedCategory === null
                  }
                  onClick={() =>
                    selectCategory(null)
                  }
                />

                <SidebarButton
                  icon={<Folder size={15} />}
                  label="Recently added"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery("");
                    setActiveView("repository");
                    setActivePdfTabId(null);
                  }}
                />
              </div>

              <div className="mt-7">

                <SidebarLabel>
                  Categories
                </SidebarLabel>

                <div className="space-y-1">
                  {categories.map(
                    ([category, count]) => {
                      const active =
                        selectedCategory ===
                        category;

                      return (
                        <SidebarButton
                          key={category}
                          icon={
                            <Folder
                              size={15}
                            />
                          }
                          label={category}
                          count={Number(count)}
                          active={active}
                          onClick={() =>
                            selectCategory(
                              category
                            )
                          }
                        />
                      );
                    }
                  )}
                </div>

                {categories.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-600">
                    No categories
                  </p>
                )}

              </div>
            </div>
          </div>
        </aside>

        {/* ======================================================
            MIDDLE
            ====================================================== */}

        <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">

          {/* ==================================================
              IN-APP TABS  (toggle-segment / toggle-segment-active)
              ================================================== */}

          <div className="flex h-16 min-w-0 shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden border-b-[3px] border-gray-900 bg-[#FFFDF8] px-3">

            {/* REPOSITORY TAB */}

            <button
              type="button"
              onClick={showRepository}
              aria-current={
                activeView === "repository" && activePdfTabId === null
                  ? "page"
                  : undefined
              }
              className={`h-10 shrink-0 rounded border-[3px] border-gray-900 px-4 text-sm font-medium text-gray-900 ${FOCUS} ${
                activePdfTabId === null
                  ? "bg-[#FCA847]"
                  : "bg-white hover:bg-[#FFFDF8]"
              }`}
            >
              Repository
            </button>

            {/* RESEARCH ASSISTANT TAB */}

            <button
              type="button"
              onClick={showResearchAssistant}
              aria-current={
                activeView === "research" ? "page" : undefined
              }
              className={`h-10 shrink-0 rounded border-[3px] border-gray-900 px-4 text-sm font-medium text-gray-900 ${FOCUS} ${
                activeView === "research"
                  ? "bg-[#FCA847]"
                  : "bg-white hover:bg-[#FFFDF8]"
              }`}
            >
              Research Assistant
            </button>

            {/* PDF TABS */}

            {pdfTabs.map((tab) => {
              const active =
                activePdfTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  className={`flex h-10 min-w-0 max-w-[260px] shrink-0 items-center rounded border-[3px] border-gray-900 ${
                    active
                      ? "bg-[#FCA847]"
                      : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      activatePdfTab(
                        tab.id
                      )
                    }
                    title={tab.title}
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={`flex min-w-0 flex-1 items-center gap-2 truncate pl-3 pr-1 text-left text-sm font-medium text-gray-900 ${FOCUS}`}
                  >
                    <FaRegFilePdf
                      size={14}
                      className="shrink-0"
                    />

                    <span className="truncate">
                      {tab.title}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      closePdfTab(
                        tab.id
                      )
                    }
                    aria-label={`Close ${tab.title}`}
                    className={`mx-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-900 hover:bg-gray-900 hover:text-white ${FOCUS}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* ==================================================
              REPOSITORY / PDF VIEW
              ================================================== */}

          {activeView === "research" ? (
            <ResearchAssistant
              onSourcesChange={setResearchSources}
            />
          ) : activePdfTabId === null ? (
            <RepositoryView
              selectedCategory={
                selectedCategory
              }
              filteredPapers={
                filteredPapers
              }
              searchQuery={
                searchQuery
              }
              setSearchQuery={
                setSearchQuery
              }
              selectedPaper={
                selectedPaper
              }
              onSelectPaper={
                selectPaper
              }
              onOpenPdf={
                openPdfTab
              }
            />
          ) : (
            <PdfViewer
              paperId={
                activePdfTabId
              }
              papers={papers}
              onOpenExternally={() => {
                const paper =
                  papers.find(
                    (item) =>
                      item.id ===
                      activePdfTabId
                  );

                if (!paper) return;

                window.open(
                  getPaperPdfUrl(
                    paper.id
                  ),
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
            />
          )}
        </main>

        {/* ======================================================
            RIGHT DETAILS PANEL
            ====================================================== */}

        <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l-[3px] border-gray-900 bg-[#FFFDF8]">

          {activeView === "research" ? (
            <ResearchReferencePanel sources={researchSources} />
          ) : selectedPaper ? (
            <>
              {/* ==================================================
                  RIGHT HEADER
                  ================================================== */}

              <div className="shrink-0 border-b-[3px] border-gray-900 px-5 py-4">

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span>
                        Paper{" "}
                        {selectedPaper.id}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded border-[3px] border-gray-900 bg-white px-2 text-sm font-medium text-gray-900">
                        {hasPdf(selectedPaper) ? (
                          <FaRegFilePdf size={12} />
                        ) : (
                          <CiFileOff size={12} />
                        )}
                        {hasPdf(selectedPaper)
                          ? "File attached"
                          : "No file"}
                      </span>
                    </div>

                    <h2
                      title={
                        selectedPaper.title
                      }
                      className="mt-2 line-clamp-4 text-xl font-bold leading-snug text-gray-900"
                    >
                      {selectedPaper.title ||
                        "Untitled paper"}
                    </h2>

                    <p className="mt-2 truncate text-sm text-gray-600">
                      {selectedPaper.author ||
                        "Unknown author"}
                    </p>
                  </div>

                  {/* BUTTONS */}

                  <div className="flex shrink-0 flex-col gap-2">

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !hasPdf(
                          selectedPaper
                        )
                      }
                      onClick={() =>
                        openPdfTab(
                          selectedPaper
                        )
                      }
                    >
                      Open
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={
                        handleSave
                      }
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : "Save"}
                    </Button>
                  </div>
                </div>

                {saveMessage && (
                  <div
                    role="status"
                    className="mt-3 rounded border-[3px] border-gray-900 bg-white px-3 py-2 text-sm font-medium text-gray-900"
                  >
                    {saveMessage}
                  </div>
                )}
              </div>

              {/* ==================================================
                  DETAILS / ABSTRACT TABS ONLY
                  ================================================== */}

              <div className="flex shrink-0 border-b-[3px] border-gray-900 px-5 py-3">

                <DetailTabButton
                  edge="first"
                  active={
                    detailTab ===
                    "details"
                  }
                  onClick={() =>
                    setDetailTab(
                      "details"
                    )
                  }
                >
                  Details
                </DetailTabButton>

                <DetailTabButton
                  edge="last"
                  active={
                    detailTab ===
                    "abstract"
                  }
                  onClick={() =>
                    setDetailTab(
                      "abstract"
                    )
                  }
                >
                  Abstract
                </DetailTabButton>

              </div>

              {/* ==================================================
                  IMPORTANT:
                  THIS ENTIRE AREA SCROLLS.
                  ATTACHMENT IS INSIDE DetailsPanel.
                  NOTHING IS FIXED TO THE BOTTOM.
                  ================================================== */}

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5">

                {detailTab === "details" && (
                  <DetailsPanel
                    paper={
                      selectedPaper
                    }
                    onOpenAttachment={() =>
                      openPdfTab(
                        selectedPaper
                      )
                    }
                  />
                )}

                {detailTab === "abstract" && (
                  <AbstractPanel
                    paper={
                      selectedPaper
                    }
                  />
                )}

              </div>
            </>
          ) : (
            <EmptyDetails />
          )}
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   REPOSITORY VIEW
   ============================================================ */

function RepositoryView({
  selectedCategory,
  filteredPapers,
  searchQuery,
  setSearchQuery,
  selectedPaper,
  onSelectPaper,
  onOpenPdf,
}: {
  selectedCategory: string | null;
  filteredPapers: Paper[];
  searchQuery: string;
  setSearchQuery: (
    value: string
  ) => void;
  selectedPaper: Paper | null;
  onSelectPaper: (
    paper: Paper
  ) => void;
  onOpenPdf: (
    paper: Paper
  ) => void;
}) {
  const TH =
    "border-b-[3px] border-gray-900 bg-white px-3 py-3 text-left text-sm font-bold text-gray-900";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      {/* ======================================================
          REPOSITORY HEADER
          ====================================================== */}

      <div className="shrink-0 border-b-[3px] border-gray-900 bg-[#FFFDF8] px-5 py-5">

        <div className="mb-5 flex min-w-0 items-center justify-between gap-4">

          <h2 className="min-w-0 truncate text-xl font-bold leading-snug text-gray-900">
            {selectedCategory ||
              "All papers"}
          </h2>

          <span className="shrink-0 text-sm text-gray-600">
            {filteredPapers.length}{" "}
            papers
          </span>
        </div>

        {/* SEARCH — url-input construction: field fill + offset slab */}

        <div className="relative">

          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded bg-gray-900"
          />

          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2 text-gray-900"
          />

          <input
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder="Search repository..."
            aria-label="Search repository"
            className="relative z-10 block w-full min-w-0 rounded border-[3px] border-gray-900 bg-[#E8F0FE] py-3 pl-11 pr-4 text-lg font-medium text-gray-900 placeholder-gray-600 transition-transform duration-100 focus:translate-x-0.5 focus:translate-y-0.5 focus:outline-none motion-reduce:transition-none"
          />
        </div>
      </div>

      {/* ======================================================
          TABLE
          ====================================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">

        <table className="w-full table-fixed border-separate border-spacing-0">

          <thead className="sticky top-0 z-10">

            <tr>
              <th className={`w-[34%] pl-5 ${TH}`}>
                Title
              </th>

              <th className={`w-[19%] ${TH}`}>
                Creator
              </th>

              <th className={`w-[8%] ${TH}`}>
                Year
              </th>

              <th className={`w-[17%] ${TH}`}>
                Subject
              </th>

              <th className={`w-[12%] ${TH}`}>
                Type
              </th>

              <th className={`w-[10%] ${TH}`}>
                File
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPapers.map(
              (paper) => {
                const selected =
                  selectedPaper?.id ===
                  paper.id;

                const pdf =
                  hasPdf(paper);

                // Selected rows sit on orange, so secondary text goes to ink.
                const muted = selected
                  ? "text-gray-900"
                  : "text-gray-600";

                return (
                  <tr
                    key={paper.id}
                    onClick={() =>
                      onSelectPaper(
                        paper
                      )
                    }
                    onDoubleClick={() => {
                      if (pdf) {
                        onOpenPdf(
                          paper
                        );
                      }
                    }}
                    className={`cursor-pointer ${
                      selected
                        ? "bg-[#FCA847]"
                        : "bg-white hover:bg-[#FFFDF8]"
                    }`}
                  >

                    {/* TITLE */}

                    <td className="min-w-0 border-b border-gray-200 py-3.5 pl-5 pr-3">

                      <div className="flex min-w-0 items-center gap-3">

                        {/* solid outline = has PDF, dashed = no PDF */}
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border-[3px] ${
                            pdf
                              ? "border-gray-900 bg-white text-gray-900"
                              : `border-dashed border-gray-900 bg-transparent ${muted}`
                          }`}
                        >
                          {pdf ? (
                            <FaRegFilePdf
                              size={15}
                            />
                          ) : (
                            <CiFileOff
                              size={15}
                            />
                          )}
                        </div>

                        <div className="min-w-0">

                          <p
                            title={
                              paper.title
                            }
                            className="truncate text-sm font-bold text-gray-900"
                          >
                            {paper.title ||
                              "Untitled paper"}
                          </p>

                          <p className={`mt-0.5 truncate text-sm ${muted}`}>
                            {paper.source_filename ||
                              paper.document_type ||
                              "No source information"}
                          </p>

                        </div>
                      </div>
                    </td>

                    {/* CREATOR */}

                    <td className="min-w-0 border-b border-gray-200 px-3 py-3.5">

                      <span
                        title={
                          paper.author ||
                          undefined
                        }
                        className="block truncate text-sm text-gray-900"
                      >
                        {paper.author ||
                          "Unknown author"}
                      </span>

                    </td>

                    {/* YEAR */}

                    <td className="border-b border-gray-200 px-3 py-3.5">

                      <span className={`text-sm ${muted}`}>
                        {paper.publication_year ||
                          "—"}
                      </span>

                    </td>

                    {/* SUBJECT */}

                    <td className="min-w-0 border-b border-gray-200 px-3 py-3.5">

                      <span
                        title={
                          paper.subject_category ||
                          undefined
                        }
                        className={`block truncate text-sm ${muted}`}
                      >
                        {paper.subject_category ||
                          "—"}
                      </span>

                    </td>

                    {/* TYPE */}

                    <td className="min-w-0 border-b border-gray-200 px-3 py-3.5">

                      <span
                        title={
                          paper.document_type ||
                          undefined
                        }
                        className={`block truncate text-sm ${muted}`}
                      >
                        {paper.document_type ||
                          "—"}
                      </span>

                    </td>

                    {/* FILE */}

                    <td className="border-b border-gray-200 px-3 py-3.5">

                      {pdf ? (
                        <span className="inline-flex items-center gap-1 rounded border-[3px] border-gray-900 bg-white px-1.5 text-sm font-medium text-gray-900">
                          <FaRegFilePdf
                            size={13}
                          />
                          PDF
                        </span>
                      ) : paper.stored_path ? (
                        <span className={`inline-flex items-center gap-1 text-sm ${muted}`}>
                          <CiFileOff
                            size={13}
                          />
                          File
                        </span>
                      ) : (
                        <span className={`text-sm ${muted}`}>
                          —
                        </span>
                      )}

                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>

        {/* EMPTY */}

        {filteredPapers.length === 0 && (
          <div className="flex min-h-[260px] items-center justify-center px-6">

            <div className="rounded border-[3px] border-gray-900 bg-white p-6 text-center">

              <p className="text-xl font-bold leading-snug text-gray-900">
                No papers found
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Try changing your
                search or category.
              </p>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ============================================================
   PDF VIEWER
   ============================================================ */

function PdfViewer({
  paperId,
  papers,
  onOpenExternally,
}: {
  paperId: number;
  papers: Paper[];
  onOpenExternally: () => void;
}) {
  const paper = papers.find(
    (item) => item.id === paperId
  );

  if (!paper) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#FFFDF8]">
        <div className="rounded border-[3px] border-gray-900 bg-white p-6 text-center">
          <p className="text-xl font-bold leading-snug text-gray-900">
            Paper not found
          </p>
        </div>
      </div>
    );
  }

  const pdfUrl =
    getPaperPdfUrl(paper.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">

      {/* PDF TOOLBAR */}

      <div className="flex h-16 shrink-0 items-center justify-between border-b-[3px] border-gray-900 bg-[#FFFDF8] px-4">

        <div className="min-w-0">

          <p
            title={paper.title}
            className="truncate text-sm font-bold text-gray-900"
          >
            {paper.title ||
              "Untitled paper"}
          </p>

          <p className="truncate text-sm text-gray-600">
            {paper.author ||
              "Unknown author"}
          </p>

        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={
            onOpenExternally
          }
          className="ml-4 shrink-0"
        >
          <ExternalLink
            size={14}
          />
          Open externally
        </Button>
      </div>

      {/* PDF */}

      <div className="min-h-0 flex-1 overflow-hidden">

        <iframe
          src={pdfUrl}
          title={
            paper.title ||
            "PDF Viewer"
          }
          className="block h-full w-full border-0"
        />

      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */

function SidebarLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="mb-2 px-3 text-sm font-bold text-gray-600">
      {children}
    </p>
  );
}

// Same construction as the `quiet` button: transparent 3px outline
// (so nothing shifts), outlined on hover, orange when active.
function SidebarButton({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex w-full min-w-0 items-center gap-2.5 rounded border-[3px] px-3 py-1.5 text-left text-gray-900 ${FOCUS} ${
        active
          ? "border-gray-900 bg-[#FCA847]"
          : "border-transparent hover:border-gray-900 hover:bg-white"
      }`}
    >
      <span className="shrink-0">
        {icon}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {label}
      </span>

      {count !== undefined && (
        <span className="shrink-0 text-sm text-gray-900">
          {count}
        </span>
      )}
    </button>
  );
}

/* ============================================================
   DETAIL TAB BUTTON  (toggle-segment pair, joined edge to edge)
   ============================================================ */

function DetailTabButton({
  active,
  onClick,
  children,
  edge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  edge: "first" | "last";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`border-[3px] border-gray-900 px-5 py-1.5 text-sm font-medium text-gray-900 ${FOCUS} ${
        edge === "first"
          ? "rounded-l rounded-r-none"
          : "-ml-[3px] rounded-l-none rounded-r"
      } ${
        active
          ? "bg-[#FCA847]"
          : "bg-white hover:bg-[#FFFDF8]"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================================================
   DETAILS PANEL
   ============================================================ */

function DetailsPanel({
  paper,
  onOpenAttachment,
}: {
  paper: Paper;
  onOpenAttachment: () => void;
}) {
  const keywords =
    splitKeywords(
      paper.keywords
    );

  return (
    <div className="space-y-8">

      {/* ======================================================
          BIBLIOGRAPHIC INFORMATION
          ====================================================== */}

      <div>

        <DetailSectionTitle>
          Bibliographic information
        </DetailSectionTitle>

        <div className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">

          <InfoRow
            label="Author"
            value={
              paper.author ||
              "—"
            }
          />

          <InfoRow
            label="Year"
            value={
              paper.publication_year
                ? String(
                    paper.publication_year
                  )
                : "—"
            }
          />

          <InfoRow
            label="Subject"
            value={
              paper.subject_category ||
              "—"
            }
          />

          <InfoRow
            label="Document type"
            value={
              paper.document_type ||
              "—"
            }
          />

          <InfoRow
            label="Citations"
            value={
              paper.citation_count !==
                null &&
              paper.citation_count !==
                undefined
                ? String(
                    paper.citation_count
                  )
                : "—"
            }
          />

          <InfoRow
            label="DOI"
            value={
              paper.doi ||
              "—"
            }
            last
          />

        </div>
      </div>

      {/* ======================================================
          KEYWORDS  (example-chip)
          ====================================================== */}

      <div>

        <DetailSectionTitle>
          Keywords
        </DetailSectionTitle>

        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">

            {keywords.map(
              (keyword, index) => (
                <span
                  key={`${keyword}-${index}`}
                  className="max-w-full rounded border-[3px] border-gray-900 bg-white px-2.5 py-0.5 text-sm text-gray-900"
                >
                  {keyword}
                </span>
              )
            )}

          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No keywords available.
          </p>
        )}

      </div>

      {/* ======================================================
          RECORD
          ====================================================== */}

      <div>

        <DetailSectionTitle>
          Record
        </DetailSectionTitle>

        <div className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">

          <InfoRow
            label="Added"
            value={formatDate(
              paper.created_at
            )}
          />

          <InfoRow
            label="Source"
            value={
              paper.source_filename ||
              "—"
            }
            last
          />

        </div>
      </div>

      {/* ======================================================
          EXTRACTION
          ====================================================== */}

      {paper.extraction_method && (
        <div>

          <DetailSectionTitle>
            Extraction
          </DetailSectionTitle>

          <div className="rounded border-[3px] border-gray-900 bg-white px-3 py-3 text-sm text-gray-900">
            {paper.extraction_method}
          </div>

        </div>
      )}

      {/* ======================================================
          RECOMMENDATION SIGNAL
          No green/red: state is carried by icon, wording and
          outline style (solid = valid, dashed = not valid).
          ====================================================== */}

      <div>

        <DetailSectionTitle>
          Recommendation signal
        </DetailSectionTitle>

        <div
          className={`flex items-start gap-2 rounded border-[3px] border-gray-900 px-3 py-3 text-sm font-medium text-gray-900 ${
            paper.is_valid_for_recommendation
              ? "bg-white"
              : "border-dashed bg-[#FFFDF8]"
          }`}
        >
          {paper.is_valid_for_recommendation ? (
            <Check
              size={16}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <AlertCircle
              size={16}
              className="mt-0.5 shrink-0"
            />
          )}

          <span className="min-w-0 break-words">
            {paper.is_valid_for_recommendation
              ? "Valid for recommendation."
              : paper.missing_fields
                ? `Missing: ${paper.missing_fields}`
                : "Not currently valid for recommendation."}
          </span>
        </div>

      </div>

      {/* ======================================================
          ATTACHMENT

          THIS IS INTENTIONALLY PART OF THE SCROLLABLE
          DETAILS CONTENT.

          IT IS NOT:
          - fixed
          - sticky
          - absolute
          - a tab
          - a separate bottom panel
          ====================================================== */}

      <div className="pb-2">

        <DetailSectionTitle>
          Attachment
        </DetailSectionTitle>

        {!paper.stored_path ? (
          <div className="rounded border-[3px] border-dashed border-gray-900 bg-[#FFFDF8] px-4 py-4">

            <p className="text-sm text-gray-600">
              This paper does not
              have an attached file.
            </p>

          </div>
        ) : (
          <AttachmentCard
            paper={paper}
            onOpen={
              onOpenAttachment
            }
          />
        )}

      </div>

      {/* ======================================================
          SIMILAR PAPERS

          This stays outside the Details/Abstract tabs so the
          graph gets its own vertical space and does not make
          the tab contents feel cramped. It remains part of the
          normal scroll flow of the right details panel.
          ====================================================== */}

      <SimilarPapersSection paper={paper} />

    </div>
  );
}

/* ============================================================
   SIMILAR PAPERS
   ============================================================ */

function SimilarPapersSection({
  paper,
}: {
  paper: Paper;
}) {
  const [open, setOpen] = useState(true);
  const [pipeline, setPipeline] =
    useState<RecommendationPipeline>(
      "tfidf_sbert_metadata"
    );

  const activePipelineLabel =
    RECOMMENDATION_PIPELINES.find(
      (item) => item.value === pipeline
    )?.label ?? pipeline;

  return (
    <section className="pb-2">

      <div className="overflow-hidden rounded border-[3px] border-gray-900 bg-white">

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#FFFDF8] ${FOCUS}`}
        >
          <div className="min-w-0">
            <p className="text-lg font-bold leading-snug text-gray-900">
              Similar papers
            </p>

            <p className="mt-0.5 truncate text-sm text-gray-600">
              {open
                ? "Repository papers ranked by the selected recommendation pipeline."
                : `Using ${activePipelineLabel}`}
            </p>
          </div>

          <ChevronDown
            size={18}
            className={`shrink-0 text-gray-900 transition-transform motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="border-t-[3px] border-gray-900 p-4">

            <div className="mb-3 flex items-center justify-between gap-2">
              <label
                htmlFor="recommendation-pipeline"
                className="min-w-0 text-sm font-bold text-gray-900"
              >
                Recommendation pipeline
              </label>

              <select
                id="recommendation-pipeline"
                value={pipeline}
                onChange={(event) =>
                  setPipeline(
                    event.target.value as RecommendationPipeline
                  )
                }
                className={`max-w-[220px] rounded border-[3px] border-gray-900 bg-white px-2.5 py-1 text-sm font-medium text-gray-900 ${FOCUS}`}
              >
                {RECOMMENDATION_PIPELINES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              These are similar papers already available in your repository.
              The selected paper is the center node.
            </p>

            <div className="min-h-[430px] w-full overflow-hidden rounded border-[3px] border-gray-900 bg-white">
              <ConnectedPapersGraph
                paperId={paper.id}
                pipeline={pipeline}
                topK={10}
              />
            </div>

          </div>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   ATTACHMENT CARD
   ============================================================ */

function AttachmentCard({
  paper,
  onOpen,
}: {
  paper: Paper;
  onOpen: () => void;
}) {
  const fileName =
    getFileName(
      paper.stored_path
    );

  const pdf =
    hasPdf(paper);

  return (
    <button
      type="button"
      onClick={
        pdf
          ? onOpen
          : undefined
      }
      disabled={!pdf}
      className={`group flex w-full items-center gap-3 rounded border-[3px] border-gray-900 bg-white px-3 py-3 text-left ${FOCUS} ${
        pdf
          ? "cursor-pointer hover:bg-[#FCA847]"
          : "cursor-default"
      }`}
    >

      {/* FILE ICON */}

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-[3px] border-gray-900 bg-white text-gray-900">
        {pdf ? (
          <FaRegFilePdf size={16} />
        ) : (
          <CiFileOff size={16} />
        )}
      </div>

      {/* FILE INFORMATION */}

      <div className="min-w-0 flex-1">

        <p
          title={
            fileName ||
            undefined
          }
          className="truncate text-sm font-bold text-gray-900"
        >
          {fileName ||
            "Attached file"}
        </p>

        <p className="mt-0.5 text-sm text-gray-600 group-hover:text-gray-900">
          {pdf
            ? "PDF document"
            : "Attached file"}
        </p>

      </div>

      {/* ARROW */}

      {pdf && (
        <ChevronRight
          size={18}
          className="shrink-0 text-gray-900 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      )}

    </button>
  );
}

/* ============================================================
   ABSTRACT
   ============================================================ */

function AbstractPanel({
  paper,
}: {
  paper: Paper;
}) {
  return (
    <div>

      <DetailSectionTitle>
        Abstract
      </DetailSectionTitle>

      {paper.abstract ? (
        <div className="whitespace-pre-wrap text-base leading-normal text-gray-900">
          {paper.abstract}
        </div>
      ) : (
        <div className="rounded border-[3px] border-dashed border-gray-900 bg-[#FFFDF8] px-4 py-5 text-sm text-gray-600">
          No abstract available
          for this paper.
        </div>
      )}

    </div>
  );
}

/* ============================================================
   SMALL DETAIL COMPONENTS
   ============================================================ */

function DetailSectionTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-3 text-lg font-bold leading-snug text-gray-900">
      {children}
    </h3>
  );
}

function InfoRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-3 ${
        !last
          ? "border-b border-gray-200"
          : ""
      }`}
    >

      <span className="truncate text-sm text-gray-600">
        {label}
      </span>

      <span
        title={value}
        className="min-w-0 break-words text-sm text-gray-900"
      >
        {value}
      </span>

    </div>
  );
}

/* ============================================================
   EMPTY DETAILS
   ============================================================ */

function EmptyDetails() {
  return (
    <div className="flex h-full items-center justify-center px-6">

      <div className="text-center">

        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded border-[3px] border-dashed border-gray-900 text-gray-900">
          <ChevronRight
            size={18}
          />
        </div>

        <p className="text-xl font-bold leading-snug text-gray-900">
          Select a paper
        </p>

        <p className="mt-1 text-sm text-gray-600">
          Paper details will
          appear here.
        </p>

      </div>
    </div>
  );
}
