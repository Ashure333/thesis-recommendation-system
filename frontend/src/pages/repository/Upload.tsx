import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";

import {
  uploadPaper,
  updatePaper,
  previewIdentifier,
  importPaperFromMetadata,
  notifyRecommendationIndexStale,
  type Paper,
} from "../../api";
import FindPdfPanel from "../../components/FindPdfPanel";
import PixelProgress from "../../components/retro/PixelProgress";
import { triggerSlimeAnimation } from "../../utils/slimeEvents";
import {
  SUBJECTS,
  CATEGORIES,
  DOCUMENT_TYPES,
} from "../../data/catalog";
import { useCatalog } from "../../hooks/useCatalog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
} from "../../components/retro/PixelIcons";
import HuntItem from "../../components/retro/HuntItem";
import { HUNT_ITEMS } from "../../data/hunt";

const signalFields = [
  "title",
  "abstract",
  "keywords",
  "publication_year",
] as const;

const signalLabels: Record<string, string> = {
  title: "Title",
  abstract: "Abstract",
  keywords: "Keywords",
  publication_year: "Publication Year",
};

interface ScholarBibtexMessage {
  source: "paperrec-scholar-extension";
  type: "PAPERREC_SCHOLAR_BIBTEX";
  bibtex: string;
  sourceUrl?: string;
}

interface ScholarErrorMessage {
  source: "paperrec-scholar-extension";
  type: "PAPERREC_SCHOLAR_ERROR";
  error: string;
}

interface ManualEntry {
  key: string;
  file: File;
  preview: PaperPreview | null;
  status: "pending" | "approved" | "error";
  error?: string;
}

/*
 * Splits a BibTeX blob into individual @entry{...} blocks.
 * Braces are balanced so nested {..{..}..} values are kept intact.
 */
function splitBibtexEntries(text: string): string[] {
  const starts: number[] = [];
  const entryRe = /@\w+\s*\{/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRe.exec(text)) !== null) {
    starts.push(match.index);
  }

  const entries: string[] = [];

  for (const start of starts) {
    const open = text.indexOf("{", start);
    let depth = 0;
    let cursor = open;

    for (; cursor < text.length; cursor++) {
      if (text[cursor] === "{") {
        depth++;
      } else if (text[cursor] === "}") {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }

    if (cursor >= text.length) {
      // Unbalanced braces — keep whatever is left as one entry.
      entries.push(text.slice(start));
      break;
    }

    entries.push(text.slice(start, cursor + 1));
  }

  return entries;
}

function entryKey(bibtex: string, fallback: number): string {
  const keyMatch = /@\w+\s*\{\s*([^,\s]+)/.exec(bibtex);
  return keyMatch?.[1] ?? `entry-${fallback + 1}`;
}

interface PaperPreview {
  title: string;
  author: string | null;
  abstract: string | null;
  keywords: string | null;
  publication_year: number | null;
  doi: string | null;
  subject_category: string | null;
  document_type: string | null;
  citation_count: number | null;
  is_valid_for_recommendation: boolean;
  missing_fields: string | null;
  source_filename: string | null;
  extraction_method: string | null;
}

/**
 * Keeps a select's current value selectable even when the backend
 * classifier (or Crossref/arXiv) produced a value outside the
 * seeded list -- otherwise the dropdown would render blank for it.
 */
function withOption(
  options: readonly string[],
  value: string
): string[] {
  if (!value) return [...options];
  return options.includes(value)
    ? [...options]
    : [value, ...options];
}

/* ============================================================
   AUTO-SUGGEST COMBOBOX
   Free-text input with a filtered suggestion list. Used by the
   Subject / Category fields so the user can either pick an
   option that matches the imported-reference taxonomy or type
   a brand-new value (the backend extends the catalog on save).

   Keyboard: Down/Up move the highlight, Enter picks it,
   Escape closes. Mouse-down on an option selects it without
   blurring the input first.
   ============================================================ */

const MAX_SUGGESTIONS = 8;

function AutoSuggest({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const needle = value.trim().toLowerCase();

  const shown = [
    ...new Set(
      suggestions.filter((option) =>
        option.toLowerCase().includes(needle)
      )
    ),
  ].slice(0, MAX_SUGGESTIONS);

  function select(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((index) =>
              shown.length === 0 ? 0 : (index + 1) % shown.length
            );
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((index) =>
              shown.length === 0 ? 0 : (index - 1 + shown.length) % shown.length
            );
          } else if (e.key === "Enter" && open && shown[highlight]) {
            e.preventDefault();
            select(shown[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="ui-input"
      />

      {open && shown.length > 0 && (
        <ul
          role="listbox"
          aria-label="Suggestions"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded border-[3px] border-gray-900 bg-white py-0.5"
        >
          {shown.map((option, index) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`block w-full px-3 py-1.5 text-left text-sm font-medium ${
                  index === highlight
                    ? "bg-accent text-onAccent"
                    : "text-ink hover:bg-accentSoft"
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


export default function Upload() {
  const fileInput = useRef<HTMLInputElement>(null);

  const catalog = useCatalog();

  const [paper, setPaper] = useState<PaperPreview | Paper | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualBibtex, setManualBibtex] = useState("");

  // Add-by-identifier flow (DOI / arXiv / link): preview comes from
  // Crossref/arXiv instead of a file, so selectedFile stays null.
  const [identifierInput, setIdentifierInput] = useState("");
  const [identifierImport, setIdentifierImport] = useState(false);

  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [approveAllProgress, setApproveAllProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [approveAllCurrentKey, setApproveAllCurrentKey] = useState<
    string | null
  >(null);
  const [approveAllOutcome, setApproveAllOutcome] = useState<{
    approved: number;
    failedKeys: string[];
  } | null>(null);

  const [authors, setAuthors] = useState("");
  const [doi, setDoi] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [docType, setDocType] = useState("Journal Article");

  // Backend-owned taxonomy; seed lists until the catalog loads.
  // The current value is always kept selectable (withOption), so a
  // classified or typed value that the catalog has not seen yet
  // still appears in the list — and the backend adopts it on save.
  const subjectOptions = withOption(
    catalog?.subjects ?? SUBJECTS,
    subject
  );

  // Categories auto-suggest from the imported-reference taxonomy,
  // scoped to the selected subject (subject_categories is the
  // subject -> category co-occurrence map the backend derives from
  // stored papers). Falls back to the flat list for subjects the
  // reference set hasn't classified yet.
  const categoryOptions = withOption(
    catalog?.subject_categories?.[subject] ??
      catalog?.categories ??
      CATEGORIES,
    category
  );
  const docTypeOptions = withOption(
    catalog?.document_types ?? DOCUMENT_TYPES,
    docType
  );
  const [citations, setCitations] = useState("");

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [year, setYear] = useState("");

  const isPersistedPaper =
    paper !== null &&
    "id" in paper &&
    typeof paper.id === "number";

  const isPdf =
    paper !== null &&
    "stored_path" in paper &&
    typeof paper.stored_path === "string" &&
    paper.stored_path.toLowerCase().endsWith(".pdf");

  /*
   * Listen for BibTeX returned by the Chrome extension.
   *
   * The extension runs in the browser and retrieves the Google Scholar
   * BibTeX URL. It then sends the citation here using window.postMessage().
   */
  useEffect(() => {
    function handleExtensionMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as
        | ScholarBibtexMessage
        | ScholarErrorMessage
        | undefined;

      if (
        !data ||
        data.source !== "paperrec-scholar-extension"
      ) {
        return;
      }

      if (data.type === "PAPERREC_SCHOLAR_BIBTEX") {
        if (!data.bibtex?.trim()) {
          setError(
            "The Google Scholar extension returned an empty BibTeX citation."
          );
          return;
        }

        void handleScholarBibtex(data.bibtex);
        return;
      }

      if (data.type === "PAPERREC_SCHOLAR_ERROR") {
        setUploading(false);
        setError(
          data.error ||
            "The Google Scholar citation could not be retrieved."
        );
      }
    }

    window.addEventListener(
      "message",
      handleExtensionMessage
    );

    return () => {
      window.removeEventListener(
        "message",
        handleExtensionMessage
      );
    };
  }, []);

  async function previewFile(file: File): Promise<PaperPreview> {
    const formData = new FormData();
    formData.append("file", file);

    const apiUrl =
      import.meta.env.VITE_API_URL ??
      "http://localhost:8000";

    const response = await fetch(
      `${apiUrl}/api/papers/preview`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ??
          "Failed to preview the paper."
      );
    }

    return data as PaperPreview;
  }

  function populatePaper(result: PaperPreview | Paper) {
    setPaper(result);
    setIdentifierImport(false);

    setTitle(result.title ?? "");
    setAbstract(result.abstract ?? "");
    setKeywords(result.keywords ?? "");

    setYear(
      result.publication_year
        ? String(result.publication_year)
        : ""
    );

    setAuthors(result.author ?? "");
    setDoi(result.doi ?? "");

    /*
     * Subject, document type and citation count now come back from
     * the backend classifier and the Crossref/arXiv lookups.
     * Reflect them in the form instead of leaving the static
     * defaults -- previously every identifier import would save as
     * "Computer Science: Machine Learning" / "Journal Article" /
     * 0 citations no matter what the paper actually was.
     */
    const [classifiedSubject, classifiedCategory] = (
      result.subject_category ?? ""
    )
      .split(":")
      .map((part) => part.trim());

    if (classifiedSubject) {
      setSubject(classifiedSubject);
    }

    if (classifiedCategory) {
      setCategory(classifiedCategory);
    }

    if (result.document_type) {
      setDocType(result.document_type);
    }

    setCitations(
      result.citation_count != null
        ? String(result.citation_count)
        : ""
    );

    setJustSaved(false);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      const suffix = file.name
        .split(".")
        .pop()
        ?.toLowerCase();

      if (suffix !== "pdf" && suffix !== "bib" && suffix !== "tex") {
        throw new Error(
          "Only PDF, BibTeX (.bib), and LaTeX (.tex) files are accepted."
        );
      }

      /*
       * Multi-entry BibTeX files (e.g. a reference-manager
       * export with many citations) are split client-side and
       * routed through
       * the per-entry navigator so every paper can be imported,
       * not just the first one.
       */
      if (suffix === "bib") {
        const text = await file.text();
        const rawEntries = splitBibtexEntries(text);

        if (rawEntries.length > 1) {
          const entries: ManualEntry[] = rawEntries.map(
            (bibtex, index) => ({
              key: entryKey(bibtex, index),
              file: new File(
                [new Blob([bibtex], { type: "application/x-bibtex" })],
                `bibtex-export-${index + 1}.bib`,
                { type: "application/x-bibtex" }
              ),
              preview: null,
              status: "pending",
            })
          );

          setSelectedFile(null);
          setPaper(null);
          setManualEntries(entries);
          setCurrentIndex(0);

          void previewEntry(entries, 0);
          return;
        }
      }

      const result = await previewFile(file);

      setSelectedFile(file);
      populatePaper(result);
    } catch (e) {
      setSelectedFile(null);
      setPaper(null);
      setError(
        e instanceof Error
          ? e.message
          : "Failed to preview the file."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleScholarBibtex(bibtex: string) {
    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      const trimmed = bibtex.trim();

      if (!/@\w+\s*\{/i.test(trimmed)) {
        throw new Error(
          "The Google Scholar response does not appear to be valid BibTeX."
        );
      }

      const blob = new Blob(
        [trimmed],
        { type: "application/x-bibtex" }
      );

      const file = new File(
        [blob],
        "google-scholar.bib",
        { type: "application/x-bibtex" }
      );

      const result = await previewFile(file);

      setSelectedFile(file);
      populatePaper(result);
    } catch (e) {
      setSelectedFile(null);
      setPaper(null);
      setError(
        e instanceof Error
          ? e.message
          : "Failed to preview Google Scholar BibTeX."
      );
    } finally {
      setUploading(false);
    }
  }

  /*
   * Add by identifier: resolve a pasted DOI / arXiv id / link via
   * Crossref or arXiv and load it into the same review form the file
   * flow uses. Nothing is saved until Save paper below.
   */
  async function handleIdentifierLookup() {
    const raw = identifierInput.trim();

    if (!raw) {
      setError("Paste a DOI, an arXiv id, or a link to either.");
      return;
    }

    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      const result = await previewIdentifier(raw);

      // Identifier lookups are single-paper: clear any multi-entry
      // BibTeX navigator so the single Save button is the one shown.
      setManualEntries([]);
      setCurrentIndex(0);
      setPreviewingIndex(null);
      setApproveAllProgress(null);

      setSelectedFile(null);
      populatePaper(result);
      setIdentifierImport(true);
      setIdentifierInput("");
    } catch (e) {
      setSelectedFile(null);
      setPaper(null);
      setError(
        e instanceof Error
          ? e.message
          : "Could not resolve that identifier."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleParseManualBibtex() {
    const trimmed = manualBibtex.trim();

    if (!trimmed) {
      setError("Paste some BibTeX code first.");
      return;
    }

    if (!/@\w+\s*\{/i.test(trimmed)) {
      setError(
        "That does not look like valid BibTeX. It should start with @article, @inproceedings, @book, and so on."
      );
      return;
    }

    const rawEntries = splitBibtexEntries(trimmed);

    if (rawEntries.length === 0) {
      setError("No BibTeX entries were found in the pasted text.");
      return;
    }

    const entries: ManualEntry[] = rawEntries.map(
      (bibtex, index) => ({
        key: entryKey(bibtex, index),
        file: new File(
          [new Blob([bibtex], { type: "application/x-bibtex" })],
          `manual-entry-${index + 1}.bib`,
          { type: "application/x-bibtex" }
        ),
        preview: null,
        status: "pending",
      })
    );

    setError(null);
    setManualBibtex("");
    setManualOpen(false);
    setManualEntries(entries);
    setCurrentIndex(0);

    void previewEntry(entries, 0);
  }

  async function previewEntry(
    entries: ManualEntry[],
    index: number
  ): Promise<PaperPreview | null> {
    const entry = entries[index];

    if (!entry) {
      return null;
    }

    if (entry.preview) {
      return entry.preview;
    }

    setPreviewingIndex(index);
    setError(null);

    try {
      const result = await previewFile(entry.file);

      setManualEntries((current) =>
        current.map((item, i) =>
          i === index
            ? { ...item, preview: result }
            : item
        )
      );

      setSelectedFile(entry.file);
      populatePaper(result);

      return result;
    } catch (e) {
      setManualEntries((current) =>
        current.map((item, i) =>
          i === index
            ? {
                ...item,
                status: "error",
                error:
                  e instanceof Error
                    ? e.message
                    : "Failed to parse this entry.",
              }
            : item
        )
      );
      return null;
    } finally {
      setPreviewingIndex(null);
    }
  }

  function goTo(index: number) {
    if (approvingAll) {
      return;
    }

    const clamped = Math.max(
      0,
      Math.min(manualEntries.length - 1, index)
    );

    if (clamped === currentIndex) {
      return;
    }

    const entry = manualEntries[clamped];

    setCurrentIndex(clamped);
    setJustSaved(false);
    setError(null);

    if (entry.preview) {
      setSelectedFile(entry.file);
      populatePaper(entry.preview);
    } else {
      void previewEntry(manualEntries, clamped);
    }
  }

  /*
   * Shared persistence: uploads a previewed file and applies the
   * given field values. Used by the single-paper save and by the
   * per-entry / approve-all flows.
   */
  async function persistPaper(
    file: File,
    fields: {
      title: string;
      abstract: string;
      keywords: string;
      publication_year: number | null;
      author: string | null;
      doi: string | null;
      subject_category: string | null;
      document_type: string;
      citation_count: number | null;
    }
  ) {
    const uploaded = await uploadPaper(file);

    return updatePaper(uploaded.id, fields);
  }

  async function handleApproveCurrent() {
    const entry = manualEntries[currentIndex];

    if (
      !entry ||
      entry.status !== "pending" ||
      !entry.preview ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await persistPaper(entry.file, {
        title,
        abstract,
        keywords,
        publication_year: year ? Number(year) : null,
        author: authors || null,
        doi: doi || null,
        subject_category:
          subject && category ? `${subject}: ${category}` : subject || null,
        document_type: docType,
        citation_count: citations
          ? Number(citations)
          : null,
      });

      notifyRecommendationIndexStale();

      setManualEntries((current) =>
        current.map((item, i) =>
          i === currentIndex
            ? { ...item, status: "approved", paper: updated }
            : item
        )
      );

      setJustSaved(true);

      if (currentIndex < manualEntries.length - 1) {
        goTo(currentIndex + 1);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Failed to save this entry.";

      setError(message);

      setManualEntries((current) =>
        current.map((item, i) =>
          i === currentIndex
            ? { ...item, status: "error", error: message }
            : item
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAll() {
    const pending = manualEntries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.status === "pending");

    if (pending.length === 0) {
      setApproveAllOpen(false);
      return;
    }

    // The dialog stays open through the whole run — it becomes a
    // live progress view, then a summary, until the user dismisses.
    setApprovingAll(true);
    setApproveAllOutcome(null);
    setError(null);

    let done = 0;
    let approved = 0;
    const failedKeys: string[] = [];

    for (const { entry, index } of pending) {
      setApproveAllCurrentKey(entry.key);
      setApproveAllProgress({ done, total: pending.length });

      try {
        const preview =
          entry.preview ?? (await previewFile(entry.file));

        const updated = await persistPaper(entry.file, {
          title: preview.title ?? "",
          abstract: preview.abstract ?? "",
          keywords: preview.keywords ?? "",
          publication_year:
            preview.publication_year ?? null,
          author: preview.author ?? null,
          doi: preview.doi ?? null,
          subject_category:
            preview.subject_category ??
            "Computer Science: Machine Learning",
          document_type:
            preview.document_type ?? "Journal Article",
          citation_count:
            preview.citation_count ?? null,
        });

        notifyRecommendationIndexStale();
        approved += 1;

        setManualEntries((current) =>
          current.map((item, i) =>
            i === index
              ? { ...item, status: "approved", paper: updated }
              : item
          )
        );
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Failed to save this entry.";

        failedKeys.push(entry.key);

        setManualEntries((current) =>
          current.map((item, i) =>
            i === index
              ? { ...item, status: "error", error: message }
              : item
          )
        );
      }

      done++;
      setApproveAllProgress({ done, total: pending.length });
    }

    setApprovingAll(false);
    setApproveAllProgress(null);
    setApproveAllCurrentKey(null);
    setApproveAllOutcome({ approved, failedKeys });
    setJustSaved(true);
  }

  function getDroppedURL(
    dataTransfer: DataTransfer
  ): string | null {
    const uriList = dataTransfer.getData(
      "text/uri-list"
    );

    const plainText = dataTransfer.getData(
      "text/plain"
    );

    const sources = [
      uriList,
      plainText,
    ];

    for (const source of sources) {
      if (!source) {
        continue;
      }

      const lines = source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !line.startsWith("#")
        );

      for (const line of lines) {
        if (/^https?:\/\//i.test(line)) {
          return line;
        }
      }
    }

    return null;
  }

  function isScholarBibtexUrl(url: string): boolean {
    return (
      /^https?:\/\/(?:scholar\.googleusercontent\.com|scholar\.google\.com)\//i.test(
        url
      ) &&
      /\/scholar\.bib(?:\?|$)/i.test(url)
    );
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    const url = getDroppedURL(
      event.dataTransfer
    );

    /*
     * If the extension is installed, it intercepts Scholar
     * BibTeX drops before this handler.
     *
     * This fallback is useful for showing a clear message if
     * the extension is not installed.
     */
    if (url) {
      if (isScholarBibtexUrl(url)) {
        setError(
          "Google Scholar link detected. Make sure the Re:Search Chrome extension is installed and enabled."
        );
      } else {
        setError(
          "Please drag the BibTeX link from Google Scholar, not the paper's normal URL."
        );
      }

      return;
    }

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void handleFile(file);
      return;
    }

    setError(
      "Drop a PDF, BibTeX file, or Google Scholar BibTeX link."
    );
  }

  async function handleSave() {
    // A preview can only be persisted once. After a successful save,
    // the user must start a new preview before another database insert.
    if (!paper || justSaved || isPersistedPaper) {
      return;
    }

    // Identifier previews have no file; everything else does.
    if (!identifierImport && !selectedFile) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      /*
       * The preview step never touches the database.
       * The first persistent operation happens here, after
       * the user explicitly clicks Save.
       */
      const fields = {
        title,
        abstract,
        keywords,
        publication_year: year
          ? Number(year)
          : null,
        author: authors || null,
        doi: doi || null,
        subject_category:
          subject && category ? `${subject}: ${category}` : subject || null,
        document_type: docType,
        citation_count: citations
          ? Number(citations)
          : null,
      };

      const updated = identifierImport
        ? await importPaperFromMetadata({
            ...fields,
            source_filename: paper.source_filename,
          })
        : await persistPaper(selectedFile!, fields);

      notifyRecommendationIndexStale();

      setPaper(updated);
      // The pet eats the paper it just consumed.
      triggerSlimeAnimation("eat");
      setJustSaved(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to save the paper."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * Arrow-key navigation between parsed entries.
   * Ignored while typing in any field so arrow keys keep
   * working inside inputs.
   */
  useEffect(() => {
    if (manualEntries.length === 0 || approvingAll) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(currentIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(currentIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [manualEntries.length, currentIndex, approvingAll]);

  function handleResetUpload() {
    setPaper(null);
    setSelectedFile(null);
    setError(null);
    setJustSaved(false);

    setIdentifierInput("");
    setIdentifierImport(false);

    setManualBibtex("");
    setManualOpen(false);

    setManualEntries([]);
    setCurrentIndex(0);
    setPreviewingIndex(null);
    setApproveAllOpen(false);
    setApprovingAll(false);
    setApproveAllProgress(null);
    setApproveAllCurrentKey(null);
    setApproveAllOutcome(null);

    setAuthors("");
    setDoi("");
    setSubject("Computer Science");
    setCategory("Machine Learning");
    setDocType("Journal Article");
    setCitations("");

    setTitle("");
    setAbstract("");
    setKeywords("");
    setYear("");

    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }


  const filled: Record<string, boolean> = {
    Title: !!title,
    Abstract: !!abstract,
    Keywords: !!keywords,
    "Publication Year": !!year,
  };

  return (
    <div
      className={
        paper
          ? "mx-auto w-full max-w-[1200px]"
          : "mx-auto max-w-2xl"
      }
    >
      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-cartridge")!} />
      <h1 className="font-pixelify mb-1 text-3xl font-bold leading-none text-ink">
        Upload Paper
      </h1>

      <p className="mb-6 text-sm text-muted">
        Add an academic paper to the repository.
        Fields marked{" "}
        <span className="text-ink">*</span> are
        required for recommendation processing.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.bib,.tex"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (file) {
            void handleFile(file);
          }
        }}
      />

      {/* ====================================================
          IDLE LAYOUT — dropzone + identifier + import workflow.
          Hidden once a paper is loaded for review.
          ==================================================== */}

      {!paper && (
      <div className="space-y-6">
      <div
        data-paperrec-dropzone
        onClick={() => {
          if (!uploading) {
            fileInput.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDrop}
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded border-[3px] border-dashed border-gray-900 bg-canvas px-6 py-10 text-center hover:bg-accentSoft"
        data-tips="upload-dropzone"
      >
        <p className="text-sm text-ink">
          {uploading
            ? "Importing…"
            : "Drop a PDF or BibTeX (.bib) file here"}
        </p>

        {uploading && (
          <PixelProgress
            value={null}
            stage="EXTRACTING METADATA"
            className="mt-4 max-w-xs"
          />
        )}

        <p className="mt-1 text-xs text-muted">
          Multi-entry .bib exports (reference managers, journal
          sites) import every paper. Each entry goes through the
          review navigator below.
        </p>

        <p className="mt-2 text-xs text-muted">
          Or drag a Google Scholar{" "}
          <strong>BibTeX</strong> link directly into this box, or
          click to browse.
        </p>
      </div>

      {/* Add by identifier (DOI / arXiv / link) */}
      <div className="mb-6 rounded border-[3px] border-gray-900 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border-[2px] border-gray-900 bg-accent px-1.5 py-0.5 font-mono text-xs font-bold tracking-[0.15em] text-onAccent">
            DOI / ARXIV
          </span>
          <p className="text-sm font-bold text-ink">
            Add by identifier
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={identifierInput}
            onChange={(e) =>
              setIdentifierInput(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleIdentifierLookup();
              }
            }}
            placeholder="10.18653/v1/D19-1410 · arxiv.org/abs/1706.03762"
            aria-label="DOI or arXiv identifier"
            className="ui-input flex-1"
          />

          <button
            type="button"
            onClick={() => void handleIdentifierLookup()}
            disabled={uploading || !identifierInput.trim()}
            className="rounded border-[3px] border-gray-900 bg-accent px-4 py-2 text-sm font-bold text-onAccent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Looking up…" : "Look up"}
          </button>
        </div>

        <p className="mt-2 text-xs leading-5 text-muted">
          Paste a DOI, an arXiv id, or a link to either. Metadata
          comes from Crossref or arXiv, then flows through the same
          review form as a file. The open-access PDF is searched for
          in the background after you save.
        </p>
      </div>

      {/* Reference-manager BibTeX export workflow */}
      <div className="animate-step-in mb-6 rounded border-[3px] border-gray-900 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border-[2px] border-gray-900 bg-accent px-1.5 py-0.5 font-mono text-xs font-bold tracking-[0.15em] text-onAccent">
            BIBTEX EXPORT
          </span>
          <p className="text-sm font-bold text-ink">
            Import workflow
          </p>
        </div>

        <ol className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>
            <span className="font-mono font-bold text-ink">1.</span>{" "}
            In your reference manager, select the references you
            want and export them as BibTeX:{" "}
            <span className="font-bold text-ink">
              File → Export → BibTeX (.bib)
            </span>
            .
          </li>
          <li>
            <span className="font-mono font-bold text-ink">2.</span>{" "}
            Drop that .bib file on the box above. Every entry is
            parsed and listed in the review navigator.
          </li>
          <li>
            <span className="font-mono font-bold text-ink">3.</span>{" "}
            Approve each entry one by one (editing fields as you
            go), or{" "}
            <span className="font-bold text-ink">
              Approve all
            </span>{" "}
            to save the whole export at once.
          </li>
        </ol>

        <p className="mt-3 border-t-[2px] border-gray-200 pt-3 text-xs leading-5 text-muted">
          For a single reference, use your reference manager's{" "}
          <span className="font-bold text-ink">
            Copy As → BibTeX Citation
          </span>
          , then use{" "}
          <span className="font-bold text-ink">
            Paste BibTeX manually
          </span>{" "}
          below.
        </p>
      </div>

      {/* Manual BibTeX entry */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() =>
            setManualOpen((value) => !value)
          }
          aria-expanded={manualOpen}
          className="inline-flex items-center gap-1.5 rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 text-sm font-bold text-ink transition-colors pixel-ease hover:bg-accentSoft"
        >
          <span
            className={`inline-block transition-transform pixel-ease ${
              manualOpen ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
          Paste BibTeX manually
        </button>

        {manualOpen && (
          <div className="animate-step-in mt-3">
            <textarea
              id="manual-bibtex"
              rows={8}
              value={manualBibtex}
              onChange={(e) =>
                setManualBibtex(e.target.value)
              }
              placeholder={
                "@article{smith2024,\n  title = {A Study of Retrieval Pipelines},\n  author = {Smith, J. and Doe, A.},\n  year = {2024},\n  journal = {…}\n}"
              }
              className="ui-input font-mono text-xs leading-5"
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleParseManualBibtex}
                disabled={!manualBibtex.trim()}
                className="rounded border-[3px] border-gray-900 bg-accent px-4 py-2 text-sm font-bold text-onAccent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Parse citations
              </button>

              <span className="text-xs text-muted">
                Paste one or more BibTeX entries (from Google
                Scholar, a journal, or your own notes) and they
                will be parsed below. Approve each one, or all
                at once.
              </span>
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      {/* Parsed entries navigator */}
      {manualEntries.length > 0 && (
        <div className="animate-step-in mb-6 rounded border-[3px] border-gray-900 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">
              Parsed entries
            </p>

            <span className="font-mono text-xs text-muted">
              {manualEntries.filter((e) => e.status === "approved").length}
              /{manualEntries.length} approved · arrow keys to navigate
            </span>
          </div>

          {approvingAll && approveAllProgress && (
            <PixelProgress
              value={
                approveAllProgress.total > 0
                  ? approveAllProgress.done / approveAllProgress.total
                  : null
              }
              stage={`SAVING ${approveAllProgress.done}/${approveAllProgress.total}`}
              className="mt-3"
            />
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              aria-label="Previous entry"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-[3px] border-gray-900 bg-white font-bold text-ink hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-bold text-ink">
                @{manualEntries[currentIndex]?.key}
              </p>

              <p className="mt-0.5 text-xs text-muted">
                {approvingAll
                  ? `Saving… ${approveAllProgress?.done ?? 0}/${approveAllProgress?.total ?? 0}`
                  : previewingIndex === currentIndex
                    ? "Parsing…"
                    : manualEntries[currentIndex]?.status === "approved"
                      ? "Approved"
                      : manualEntries[currentIndex]?.status === "error"
                        ? manualEntries[currentIndex]?.error ?? "Failed"
                        : "Ready to review. Edit the fields below, then approve"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex >= manualEntries.length - 1}
              aria-label="Next entry"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-[3px] border-gray-900 bg-white font-bold text-ink hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* entry chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {manualEntries.map((entry, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Entry ${index + 1}: ${entry.key}`}
                className={`flex h-7 min-w-7 items-center justify-center rounded border-[2px] border-gray-900 px-1.5 font-mono text-xs font-bold transition-colors pixel-ease ${
                  index === currentIndex
                    ? "bg-accent text-onAccent"
                    : entry.status === "approved"
                      ? "bg-accentSoft text-ink"
                      : entry.status === "error"
                        ? "bg-white text-ink"
                        : "bg-white text-muted"
                }`}
              >
                {index + 1}
                {entry.status === "approved" ? (
                  <Check className="h-3 w-3" />
                ) : entry.status === "error" ? (
                  "!"
                ) : null}
              </button>
            ))}
          </div>

          {approvingAll && approveAllProgress && (
            <p className="mt-3 font-mono text-xs text-muted">
              {approveAllProgress.done}/{approveAllProgress.total} saved…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="status-error mb-4">
          {error}
        </p>
      )}

      {/* ====================================================
          REVIEW LAYOUT — form left, status rail right.
          ==================================================== */}

      {paper && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            <div className="rounded border-[3px] border-gray-900 bg-white p-4">
              <div className="space-y-4">
            <div>
              <label
                htmlFor="title"
                className="mb-1 field-label"
              >
                Title{" "}
                <span className="text-ink">*</span>
              </label>

              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                placeholder="Full paper title"
                className="ui-input"
              />
            </div>

            <div>
              <label
                htmlFor="authors"
                className="mb-1 field-label"
              >
                Authors{" "}
                <span className="text-ink">*</span>
              </label>

              <input
                id="authors"
                type="text"
                value={authors}
                onChange={(e) =>
                  setAuthors(e.target.value)
                }
                placeholder="Last, F., Last, F. (comma-separated)"
                className="ui-input"
              />
            </div>

            <div>
              <label
                htmlFor="abstract"
                className="mb-1 field-label"
              >
                Abstract{" "}
                <span className="text-ink">*</span>
              </label>

              <textarea
                id="abstract"
                rows={5}
                value={abstract}
                onChange={(e) =>
                  setAbstract(e.target.value)
                }
                placeholder="Full abstract text…"
                className="ui-input"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="keywords"
                  className="field-label"
                >
                  Keywords{" "}
                  <span className="text-ink">*</span>
                </label>

                <span className="text-xs text-muted">
                  Comma-separated
                </span>
              </div>

              <input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) =>
                  setKeywords(e.target.value)
                }
                placeholder="e.g. machine learning, neural networks, classification"
                className="ui-input"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="year"
                  className="mb-1 field-label"
                >
                  Publication Year{" "}
                  <span className="text-ink">*</span>
                </label>

                <input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) =>
                    setYear(e.target.value)
                  }
                  placeholder="e.g. 2023"
                  className="ui-input"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="doi"
                    className="field-label"
                  >
                    DOI
                  </label>

                  <span className="text-xs text-muted">
                    Optional
                  </span>
                </div>

                <input
                  id="doi"
                  type="text"
                  value={doi}
                  onChange={(e) =>
                    setDoi(e.target.value)
                  }
                  placeholder="10.xxxx/xxxxx"
                  className="ui-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="subject"
                  className="mb-1 field-label"
                >
                  Subject{" "}
                  <span className="text-ink">*</span>
                </label>

                <AutoSuggest
                  id="subject"
                  value={subject}
                  onChange={setSubject}
                  suggestions={subjectOptions}
                  placeholder="Type or pick a subject…"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-1 field-label"
                >
                  Category{" "}
                  <span className="text-ink">*</span>
                </label>

                <AutoSuggest
                  id="category"
                  value={category}
                  onChange={setCategory}
                  suggestions={categoryOptions}
                  placeholder="Type or pick a category…"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="docType"
                  className="mb-1 field-label"
                >
                  Document Type{" "}
                  <span className="text-ink">*</span>
                </label>

                <select
                  id="docType"
                  value={docType}
                  onChange={(e) =>
                    setDocType(e.target.value)
                  }
                  className="ui-input"
                >
                  {docTypeOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="citations"
                    className="field-label"
                  >
                    Citation Count
                  </label>

                  <span className="text-xs text-muted">
                    Optional
                  </span>
                </div>

                <input
                  id="citations"
                  type="number"
                  value={citations}
                  onChange={(e) =>
                    setCitations(e.target.value)
                  }
                  placeholder="0"
                  className="ui-input"
                />
              </div>
            </div>
          </div>
            </div>
          </div>

          <aside className="min-w-0 lg:col-span-2">
            <div className="space-y-4 lg:sticky lg:top-4">
          <div className="rounded border-[3px] border-gray-900 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-ink">
              Recommendation Signal Validation
            </p>

            <div className="grid grid-cols-2 gap-2">
              {signalFields.map((field) => {
                const label =
                  signalLabels[field];

                return (
                  <label
                    key={field}
                    className="flex items-center gap-2 text-sm text-muted"
                  >
                    <span
                      className={`h-3 w-3 rounded-full border-[2px] ${
                        filled[label]
                          ? "border-gray-900 bg-ink"
                          : "border-gray-900 bg-white"
                      }`}
                    />

                    {label}
                  </label>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-muted">
              These four fields drive all
              recommendation pipelines.
            </p>
          </div>

          {saving && (
            <PixelProgress
              value={null}
              stage="SAVING RECORD"
            />
          )}

          {justSaved && (
            <PixelProgress
              value={1}
              stage="PAPER SAVED"
              done
            />
          )}

          {isPersistedPaper && !isPdf && (
            <div className="rounded border-[3px] border-gray-900 bg-white p-4">
              <p className="text-sm font-medium text-ink">
                No PDF attached
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                This paper was imported from a citation and has no
                stored PDF. You can search for an open-access copy now.
              </p>
              <FindPdfPanel
                key={paper.id}
                paper={paper as Paper}
                onAttached={(updated) => {
                  setPaper(updated);
                }}
              />
            </div>
          )}

          {manualEntries.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleResetUpload}
                disabled={saving || approvingAll}
                className="flex-1 rounded border-[3px] border-gray-900 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-accent hover:text-onAccent disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApproveCurrent}
                disabled={
                  saving ||
                  approvingAll ||
                  manualEntries[currentIndex]?.status !== "pending" ||
                  !manualEntries[currentIndex]?.preview
                }
                className="flex-1 rounded border-[3px] border-gray-900 bg-accent px-4 py-2.5 text-sm font-bold text-onAccent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Approve entry"}
              </button>

              {manualEntries.some((e) => e.status === "pending") && (
                <button
                  type="button"
                  onClick={() => setApproveAllOpen(true)}
                  disabled={saving || approvingAll}
                  className="flex-1 rounded border-[3px] border-gray-900 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-accent hover:text-onAccent disabled:opacity-50"
                >
                  {approvingAll
                    ? `Saving ${approveAllProgress?.done ?? 0}/${approveAllProgress?.total ?? 0}…`
                    : `Approve all (${
                        manualEntries.filter((e) => e.status === "pending").length
                      })`}
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetUpload}
                disabled={saving}
                className="flex-1 rounded border-[3px] border-gray-900 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-accent hover:text-onAccent disabled:opacity-50"
              >
                {justSaved || isPersistedPaper
                  ? "Upload another paper"
                  : "Back"}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  (!selectedFile && !identifierImport) ||
                  justSaved ||
                  isPersistedPaper
                }
                className={`flex-1 rounded border-[3px] border-gray-900 px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-50 ${
                  justSaved || isPersistedPaper
                    ? "cursor-default bg-white"
                    : "bg-accent hover:bg-accentSoft"
                }`}
              >
                {saving
                  ? "Saving…"
                  : justSaved || isPersistedPaper
                    ? "Saved"
                    : "Save paper"}
              </button>
            </div>
          )}

          {justSaved && (
            <p className="status-success mt-3 text-center">
              {manualEntries.length > 0
                ? "Entry approved. Use the arrow keys to review the next one, or approve the rest."
                : paper?.is_valid_for_recommendation
                  ? "Paper saved successfully. This paper is valid for recommendation."
                  : `Paper saved successfully, but still missing: ${
                      paper?.missing_fields ??
                      "some required fields"
                    }.`}
            </p>
          )}
            </div>
          </aside>
        </div>
      )}

      {/* Approve-all dialog — persistent: confirm → live progress → summary */}
      {approveAllOpen && (
        <div
          className="fixed inset-0 z-[9995] flex items-center justify-center bg-gray-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Approve all entries"
          onClick={() => {
            if (!approvingAll) {
              setApproveAllOpen(false);
              setApproveAllOutcome(null);
            }
          }}
        >
          <div
            className="animate-step-in w-full max-w-md rounded border-[3px] border-gray-900 bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {approvingAll ? (
              /* ---- RUNNING: live progress ---- */
              <>
                <p className="text-lg font-bold text-ink">
                  Approving papers…
                </p>

                <p className="mt-2 font-mono text-sm text-muted">
                  {approveAllProgress?.done ?? 0}/
                  {approveAllProgress?.total ?? 0} saved
                  {approveAllCurrentKey
                    ? ` · @${approveAllCurrentKey}`
                    : ""}
                </p>

                <div className="mt-3 h-3 overflow-hidden rounded border-[2px] border-gray-900 bg-white">
                  <div
                    className="h-full bg-accent transition-[width] duration-100 pixel-ease"
                    style={{
                      width: `${
                        approveAllProgress && approveAllProgress.total > 0
                          ? (approveAllProgress.done /
                              approveAllProgress.total) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-sm leading-5 text-muted">
                  Keep this window open. The batch is running in
                  the background.
                </p>
              </>
            ) : approveAllOutcome ? (
              /* ---- DONE: summary ---- */
              <>
                <p className="text-lg font-bold text-ink">
                  {approveAllOutcome.failedKeys.length === 0
                    ? `All ${approveAllOutcome.approved} papers approved`
                    : `${approveAllOutcome.approved} approved · ${approveAllOutcome.failedKeys.length} failed`}
                </p>

                {approveAllOutcome.failedKeys.length > 0 ? (
                  <>
                    <p className="mt-2 text-sm leading-5 text-muted">
                      The entries below could not be saved (often
                      duplicates). They are marked with an exclamation
                      in the navigator. Select them to see why.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {approveAllOutcome.failedKeys.map((key) => (
                        <span
                          key={key}
                          className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-xs font-bold text-ink"
                        >
                          @{key}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-5 text-muted">
                    Every entry was saved and marked ✓ in the
                    navigator.
                  </p>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setApproveAllOpen(false);
                      setApproveAllOutcome(null);
                    }}
                    className="flex-1 rounded border-[3px] border-gray-900 bg-accent px-4 py-2.5 text-sm font-bold text-onAccent hover:brightness-110"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              /* ---- CONFIRM ---- */
              <>
                <p className="text-lg font-bold text-ink">
                  Approve all{" "}
                  {
                    manualEntries.filter((e) => e.status === "pending")
                      .length
                  }{" "}
                  papers?
                </p>

                <p className="mt-2 text-sm leading-5 text-muted">
                  Each entry will be saved with the metadata parsed
                  from its BibTeX citation. Entries that cannot be
                  saved (for example, duplicates already in the
                  repository) are skipped and marked. You can still
                  review and edit any entry individually before
                  approving all.
                </p>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setApproveAllOpen(false);
                      setApproveAllOutcome(null);
                    }}
                    className="flex-1 rounded border-[3px] border-gray-900 bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-accent hover:text-onAccent"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleApproveAll}
                    className="flex-1 rounded border-[3px] border-gray-900 bg-accent px-4 py-2.5 text-sm font-bold text-onAccent hover:brightness-110"
                  >
                    Approve all
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}