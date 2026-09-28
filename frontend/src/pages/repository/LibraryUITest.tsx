import { useEffect, useMemo, useState } from "react";

import {
  FileText,
  Folder,
  Bookmark,
  Search,
  ExternalLink,
  Paperclip,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import ConnectedPapersGraph from "../../components/ConnectedPapersGraph";

import {
  listPapers,
  getRepositoryStats,
  getPaperPdfUrl,
  saveToLibrary,
  Paper,
  RepositoryStats,
} from "../../api";

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
    setActivePdfTabId(paperId);
  }

  /* ============================================================
     SHOW REPOSITORY
     ============================================================ */

  function showRepository() {
    setActivePdfTabId(null);

    if (filteredPapers.length > 0) {
      setSelectedPaper(
        filteredPapers[0]
      );
    }
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
    setDetailTab("details");

    setActivePdfTabId(null);
  }

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f7f6f3]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-[#c9c4bc] border-t-[#4b5563]" />

          <p className="text-[12px] text-[#777169]">
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
      <div className="flex h-screen w-full items-center justify-center bg-[#f7f6f3] px-6">
        <div className="max-w-md text-center">
          <p className="font-serif text-[22px] text-[#25211d]">
            Unable to load repository
          </p>

          <p className="mt-2 text-[13px] leading-6 text-[#777169]">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-5 rounded-md border border-[#d4d0c9] bg-white px-4 py-2 text-[12px] text-[#403b35] hover:bg-[#f4f2ee]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     PAGE
     ============================================================ */

  return (
    <div className="h-screen w-full overflow-hidden bg-[#f7f6f3] text-[#24211d]">

      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[236px_minmax(0,1fr)_420px] overflow-hidden">

        {/* ======================================================
            LEFT SIDEBAR
            ====================================================== */}

        <aside className="h-full min-h-0 min-w-0 overflow-hidden border-r border-[#dcd8d1] bg-[#eeece7]">
          <div className="flex h-full min-h-0 flex-col">

            {/* HEADER */}

            <div className="shrink-0 border-b border-[#dcd8d1] px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.17em] text-[#81796f]">
                Repository
              </p>

              <h1 className="mt-1 font-serif text-[23px] leading-tight text-[#17202a]">
                Paper Repository
              </h1>
            </div>

            {/* SIDEBAR CONTENT */}

            <div className="min-h-0 flex-1 overflow-hidden px-3 py-4">

              <SidebarLabel>
                Repository
              </SidebarLabel>

              <SidebarButton
                icon={<Bookmark size={15} />}
                label="All Papers"
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
                label="Recently Added"
                onClick={() => {
                  setSelectedCategory(null);
                  setSearchQuery("");
                  setActivePdfTabId(null);
                }}
              />

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
                  <p className="px-3 py-2 text-[11px] text-[#99938a]">
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
              IN-APP TABS
              ================================================== */}

          <div className="flex h-11 shrink-0 min-w-0 items-end overflow-hidden border-b border-[#dcd8d1] bg-[#f5f3ef]">

            {/* REPOSITORY TAB */}

            <button
              type="button"
              onClick={showRepository}
              className={`relative flex h-full shrink-0 items-center border-r border-[#ddd8d0] px-5 text-[11px] ${
                activePdfTabId === null
                  ? "bg-white text-[#25211d]"
                  : "text-[#817a72] hover:bg-[#eeece8]"
              }`}
            >
              Repository

              {activePdfTabId === null && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3e3933]" />
              )}
            </button>

            {/* PDF TABS */}

            {pdfTabs.map((tab) => {
              const active =
                activePdfTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  className={`relative flex h-full min-w-0 max-w-[260px] shrink-0 items-center border-r border-[#ddd8d0] ${
                    active
                      ? "bg-white"
                      : "bg-[#f5f3ef]"
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
                    className="min-w-0 flex-1 truncate px-4 pr-1 text-left text-[11px] text-[#4b4640]"
                  >
                    <span className="mr-2 text-[#7f897f]">
                      ▤
                    </span>

                    {tab.title}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      closePdfTab(
                        tab.id
                      )
                    }
                    aria-label={`Close ${tab.title}`}
                    className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8c857d] hover:bg-[#e6e2dc] hover:text-[#292520]"
                  >
                    <X size={13} />
                  </button>

                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3e3933]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* ==================================================
              REPOSITORY / PDF VIEW
              ================================================== */}

          {activePdfTabId === null ? (
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

        <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#dcd8d1] bg-[#faf9f7]">

          {selectedPaper ? (
            <>
              {/* ==================================================
                  RIGHT HEADER
                  ================================================== */}

              <div className="shrink-0 border-b border-[#dedbd5] bg-[#faf9f7] px-5 py-4">

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <p className="text-[9px] uppercase tracking-[0.16em] text-[#8a8177]">
                      Paper{" "}
                      {selectedPaper.id}
                      {" · "}
                      {hasPdf(selectedPaper)
                        ? "File Attached"
                        : "No File"}
                    </p>

                    <h2
                      title={
                        selectedPaper.title
                      }
                      className="mt-2 line-clamp-4 font-serif text-[21px] leading-[1.15] text-[#171717]"
                    >
                      {selectedPaper.title ||
                        "Untitled paper"}
                    </h2>

                    <p className="mt-3 truncate text-[11px] text-[#777169]">
                      {selectedPaper.author ||
                        "Unknown author"}
                    </p>
                  </div>

                  {/* BUTTONS */}

                  <div className="flex shrink-0 flex-col gap-2">

                    <button
                      type="button"
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
                      className="rounded-md border border-[#d4d0c9] bg-white px-3 py-2 text-[11px] text-[#403b35] transition hover:bg-[#f3f1ed] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Open
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleSave
                      }
                      disabled={saving}
                      className="rounded-md border border-[#d4d0c9] bg-white px-3 py-2 text-[11px] text-[#403b35] transition hover:bg-[#f3f1ed] disabled:cursor-wait disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : "Save"}
                    </button>
                  </div>
                </div>

                {saveMessage && (
                  <div className="mt-3 rounded border border-[#ddd8cf] bg-white px-3 py-2 text-[10px] text-[#6b665f]">
                    {saveMessage}
                  </div>
                )}
              </div>

              {/* ==================================================
                  DETAILS / ABSTRACT TABS ONLY
                  ================================================== */}

              <div className="flex shrink-0 border-b border-[#dedbd5] bg-[#faf9f7] px-5">

                <DetailTabButton
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
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

      {/* ======================================================
          REPOSITORY HEADER
          ====================================================== */}

      <div className="shrink-0 border-b border-[#dedbd5] bg-[#faf9f7] px-5 py-4">

        <div className="mb-4 flex min-w-0 items-center justify-between gap-4">

          <div className="min-w-0">

            <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a8177]">
              Repository
            </p>

            <h2 className="mt-1 truncate font-serif text-[22px] leading-tight text-[#17202a]">
              {selectedCategory ||
                "All Papers"}
            </h2>
          </div>

          <span className="shrink-0 text-[11px] text-[#8a8177]">
            {filteredPapers.length}{" "}
            papers
          </span>
        </div>

        {/* SEARCH */}

        <div className="relative">

          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8d8982]"
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
            className="h-10 w-full min-w-0 rounded-md border border-[#d9d5ce] bg-white pl-9 pr-3 text-[13px] text-[#2f2b27] outline-none placeholder:text-[#aaa39a] focus:border-[#aaa49b]"
          />
        </div>
      </div>

      {/* ======================================================
          TABLE
          ====================================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">

        <table className="w-full table-fixed border-collapse">

          <thead className="sticky top-0 z-10 bg-[#f7f5f2]">

            <tr className="border-b border-[#dedbd5]">

              <th className="w-[34%] px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#827b72]">
                Title
              </th>

              <th className="w-[19%] px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#827b72]">
                Creator
              </th>

              <th className="w-[8%] px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#827b72]">
                Year
              </th>

              <th className="w-[17%] px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#827b72]">
                Subject
              </th>

              <th className="w-[12%] px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#827b72]">
                Type
              </th>

              <th className="w-[10%] px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-[#827b72]">
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
                    className={`cursor-pointer border-b border-[#e5e2dd] transition-colors ${
                      selected
                        ? "bg-[#eeebe5]"
                        : "bg-white hover:bg-[#f8f7f4]"
                    }`}
                  >

                    {/* TITLE */}

                    <td className="min-w-0 px-5 py-3.5">

                      <div className="flex min-w-0 items-center gap-3">

                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                            pdf
                              ? "bg-[#eaf2ed] text-[#668b72]"
                              : "bg-[#f1efeb] text-[#918c84]"
                          }`}
                        >
                          <FileText
                            size={15}
                          />
                        </div>

                        <div className="min-w-0">

                          <p
                            title={
                              paper.title
                            }
                            className="truncate text-[13px] font-medium text-[#111827]"
                          >
                            {paper.title ||
                              "Untitled paper"}
                          </p>

                          <p className="mt-1 truncate text-[10px] text-[#8b857d]">
                            {paper.source_filename ||
                              paper.document_type ||
                              "No source information"}
                          </p>

                        </div>
                      </div>
                    </td>

                    {/* CREATOR */}

                    <td className="min-w-0 px-3 py-3.5">

                      <span
                        title={
                          paper.author ||
                          undefined
                        }
                        className="block truncate text-[11px] text-[#4f4a44]"
                      >
                        {paper.author ||
                          "Unknown author"}
                      </span>

                    </td>

                    {/* YEAR */}

                    <td className="px-3 py-3.5">

                      <span className="text-[11px] text-[#777169]">
                        {paper.publication_year ||
                          "—"}
                      </span>

                    </td>

                    {/* SUBJECT */}

                    <td className="min-w-0 px-3 py-3.5">

                      <span
                        title={
                          paper.subject_category ||
                          undefined
                        }
                        className="block truncate text-[11px] text-[#777169]"
                      >
                        {paper.subject_category ||
                          "—"}
                      </span>

                    </td>

                    {/* TYPE */}

                    <td className="min-w-0 px-3 py-3.5">

                      <span
                        title={
                          paper.document_type ||
                          undefined
                        }
                        className="block truncate text-[11px] text-[#777169]"
                      >
                        {paper.document_type ||
                          "—"}
                      </span>

                    </td>

                    {/* FILE */}

                    <td className="px-3 py-3.5">

                      {pdf ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#668b72]">
                          <Paperclip
                            size={13}
                          />
                          PDF
                        </span>
                      ) : paper.stored_path ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-[#8d8982]">
                          <Paperclip
                            size={13}
                          />
                          File
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#aaa39a]">
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

            <div className="text-center">

              <p className="font-serif text-[18px] text-[#4d4842]">
                No papers found
              </p>

              <p className="mt-1 text-[12px] text-[#99938a]">
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
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#e8e6e2]">
        <div className="text-center">
          <p className="font-serif text-[18px] text-[#4d4842]">
            Paper not found
          </p>
        </div>
      </div>
    );
  }

  const pdfUrl =
    getPaperPdfUrl(paper.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e5e3df]">

      {/* PDF TOOLBAR */}

      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#d3cfc8] bg-white px-4">

        <div className="min-w-0">

          <p
            title={paper.title}
            className="truncate text-[12px] font-medium text-[#302b26]"
          >
            {paper.title ||
              "Untitled paper"}
          </p>

          <p className="truncate text-[10px] text-[#8b847c]">
            {paper.author ||
              "Unknown author"}
          </p>

        </div>

        <button
          type="button"
          onClick={
            onOpenExternally
          }
          className="ml-4 flex shrink-0 items-center gap-2 rounded-md border border-[#d4d0c9] bg-white px-3 py-2 text-[10px] text-[#514b45] hover:bg-[#f3f1ed]"
        >
          <ExternalLink
            size={12}
          />
          Open externally
        </button>
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
    <p className="mb-2 px-3 text-[9px] uppercase tracking-[0.16em] text-[#837b71]">
      {children}
    </p>
  );
}

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
      className={`flex w-full min-w-0 items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors ${
        active
          ? "bg-[#ddd9d2] text-[#2e2a26]"
          : "text-[#5f5952] hover:bg-[#e5e2dc]"
      }`}
    >
      <span className="shrink-0">
        {icon}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12px]">
        {label}
      </span>

      {count !== undefined && (
        <span className="shrink-0 text-[10px] text-[#918a81]">
          {count}
        </span>
      )}
    </button>
  );
}

/* ============================================================
   DETAIL TAB BUTTON
   ============================================================ */

function DetailTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative mr-6 px-0 pb-2.5 pt-3 text-[11px] transition-colors ${
        active
          ? "text-[#25211d]"
          : "text-[#898279] hover:text-[#4e4841]"
      }`}
    >
      {children}

      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#4c4842]" />
      )}
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
    <div className="space-y-6">

      {/* ======================================================
          BIBLIOGRAPHIC INFORMATION
          ====================================================== */}

      <div>

        <DetailSectionTitle>
          Bibliographic Information
        </DetailSectionTitle>

        <div className="overflow-hidden rounded-md border border-[#ddd8d0] bg-white">

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
            label="Document Type"
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
          KEYWORDS
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
                  className="max-w-full rounded-full border border-[#ddd8d0] bg-white px-2.5 py-1.5 text-[10px] text-[#686159]"
                >
                  {keyword}
                </span>
              )
            )}

          </div>
        ) : (
          <p className="text-[11px] text-[#99938a]">
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

        <div className="overflow-hidden rounded-md border border-[#ddd8d0] bg-white">

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

          <div className="rounded-md border border-[#ddd8d0] bg-white px-3 py-3 text-[11px] text-[#686159]">
            {paper.extraction_method}
          </div>

        </div>
      )}

      {/* ======================================================
          RECOMMENDATION SIGNAL
          ====================================================== */}

      <div>

        <DetailSectionTitle>
          Recommendation Signal
        </DetailSectionTitle>

        <div
          className={`rounded-md border px-3 py-3 text-[11px] ${
            paper.is_valid_for_recommendation
              ? "border-[#d4e1d7] bg-[#f1f7f2] text-[#59715f]"
              : "border-[#e3d8d0] bg-[#faf4f0] text-[#826b5d]"
          }`}
        >
          {paper.is_valid_for_recommendation
            ? "Valid for recommendation."
            : paper.missing_fields
              ? `Missing: ${paper.missing_fields}`
              : "Not currently valid for recommendation."}
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
          <div className="rounded-md border border-[#ddd8d0] bg-white px-4 py-4">

            <p className="text-[11px] text-[#777169]">
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

      <div className="overflow-hidden rounded-md border border-[#ddd8d0] bg-white">

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-[#faf9f7]"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#686159]">
              Similar Papers
            </p>

            <p className="mt-1 truncate text-[10px] text-[#99938a]">
              {open
                ? "Repository papers ranked by the selected recommendation pipeline."
                : `Using ${activePipelineLabel}`}
            </p>
          </div>

          <ChevronDown
            size={15}
            className={`shrink-0 text-[#918a81] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="border-t border-[#e5e0d9] p-3">

            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.14em] text-[#918a81]">
                  Recommendation Pipeline
                </p>
              </div>

              <select
                value={pipeline}
                onChange={(event) =>
                  setPipeline(
                    event.target.value as RecommendationPipeline
                  )
                }
                className="max-w-[220px] rounded-md border border-[#d9d5ce] bg-[#faf9f7] px-2.5 py-1.5 text-[10px] text-[#514b44] outline-none focus:border-[#aaa49b]"
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

            <p className="mb-3 text-[10px] leading-5 text-[#777169]">
              These are similar papers already available in your repository.
              The selected paper is the center node.
            </p>

            <div className="min-h-[430px] w-full overflow-hidden rounded-md border border-[#e3dfd8] bg-[#faf9f7]">
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
      className={`group flex w-full items-center gap-3 rounded-md border border-[#ddd8d0] bg-white px-3 py-3 text-left transition ${
        pdf
          ? "cursor-pointer hover:bg-[#f7f5f1]"
          : "cursor-default"
      }`}
    >

      {/* FILE ICON */}

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eaf2ed] text-[#668b72]">
        <Paperclip size={16} />
      </div>

      {/* FILE INFORMATION */}

      <div className="min-w-0 flex-1">

        <p
          title={
            fileName ||
            undefined
          }
          className="truncate text-[11px] font-medium text-[#403b35]"
        >
          {fileName ||
            "Attached file"}
        </p>

        <p className="mt-1 text-[9px] text-[#918a81]">
          {pdf
            ? "PDF document"
            : "Attached file"}
        </p>

      </div>

      {/* ARROW */}

      {pdf && (
        <ChevronRight
          size={15}
          className="shrink-0 text-[#918a81] transition-transform group-hover:translate-x-0.5"
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
        <div className="whitespace-pre-wrap text-[12px] leading-6 text-[#5f5952]">
          {paper.abstract}
        </div>
      ) : (
        <div className="rounded-md border border-[#ddd8d0] bg-white px-4 py-5 text-[11px] text-[#99938a]">
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
    <p className="mb-3 text-[9px] uppercase tracking-[0.16em] text-[#837b71]">
      {children}
    </p>
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
      className={`grid grid-cols-[116px_minmax(0,1fr)] gap-3 px-3 py-3 ${
        !last
          ? "border-b border-[#e5e0d9]"
          : ""
      }`}
    >

      <span className="truncate text-[10px] text-[#918a81]">
        {label}
      </span>

      <span
        title={value}
        className="min-w-0 break-words text-[11px] text-[#514b44]"
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

        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#efede8] text-[#9a948c]">
          <ChevronRight
            size={17}
          />
        </div>

        <p className="font-serif text-[17px] text-[#5b554e]">
          Select a paper
        </p>

        <p className="mt-1 text-[11px] text-[#99938a]">
          Paper details will
          appear here.
        </p>

      </div>
    </div>
  );
}