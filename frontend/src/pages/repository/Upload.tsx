import { useRef, useState, type DragEvent } from "react";
import {
  uploadPaper,
  updatePaper,
  type Paper,
} from "../../api";

const signalFields: (keyof Paper)[] = [
  "title",
  "abstract",
  "keywords",
  "publication_year",
];

const signalLabels: Record<string, string> = {
  title: "Title",
  abstract: "Abstract",
  keywords: "Keywords",
  publication_year: "Publication Year",
};

export default function Upload() {
  const fileInput = useRef<HTMLInputElement>(null);

  const [paper, setPaper] = useState<Paper | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [authors, setAuthors] = useState("");
  const [doi, setDoi] = useState("");
  const [subject, setSubject] = useState("Computer Science");
  const [category, setCategory] = useState("Machine Learning");
  const [docType, setDocType] = useState("Journal Article");
  const [citations, setCitations] = useState("");

  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [year, setYear] = useState("");

  // ------------------------------------------------------------
  // Populate form from backend Paper
  // ------------------------------------------------------------

  function populatePaper(result: Paper) {
    setPaper(result);

    setTitle(result.title ?? "");
    setAbstract(result.abstract ?? "");
    setKeywords(result.keywords ?? "");

    setYear(
      result.publication_year !== null &&
        result.publication_year !== undefined
        ? String(result.publication_year)
        : ""
    );

    setAuthors(result.author ?? "");
    setDoi(result.doi ?? "");

    if (result.subject_category) {
      const parts = result.subject_category.split(":");

      setSubject(
        parts[0]?.trim() || "Computer Science"
      );

      setCategory(
        parts.slice(1).join(":").trim() ||
          "Machine Learning"
      );
    }

    setDocType(
      result.document_type || "Journal Article"
    );

    setCitations(
      result.citation_count !== null &&
        result.citation_count !== undefined
        ? String(result.citation_count)
        : ""
    );
  }

  // ------------------------------------------------------------
  // Normal file upload
  // ------------------------------------------------------------

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      const result = await uploadPaper(file);

      populatePaper(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to upload the file."
      );
    } finally {
      setUploading(false);
    }
  }

  // ------------------------------------------------------------
  // Extract URL from browser drag-and-drop
  // ------------------------------------------------------------

  function getDroppedUrl(
    dataTransfer: DataTransfer
  ): string | null {
    // Chrome/Edge commonly expose dragged links here.
    const uriList =
      dataTransfer.getData("text/uri-list");

    if (uriList) {
      const firstUrl = uriList
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(
          (line) =>
            line &&
            !line.startsWith("#") &&
            /^https?:\/\//i.test(line)
        );

      if (firstUrl) {
        return firstUrl;
      }
    }

    // Fallback to plain text.
    const plainText =
      dataTransfer.getData("text/plain").trim();

    if (/^https?:\/\//i.test(plainText)) {
      return plainText;
    }

    return null;
  }

  // ------------------------------------------------------------
  // Google Scholar URL import
  // ------------------------------------------------------------

  async function handleScholarUrl(url: string) {
    const normalizedUrl = url.trim();

    const isGoogleScholarBibtex =
      /googleusercontent\.com\/scholar\.bib/i.test(
        normalizedUrl
      );

    if (!isGoogleScholarBibtex) {
      setError(
        "Please drag the BibTeX link from Google Scholar. " +
          "The link should contain scholar.bib."
      );
      return;
    }

    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      /*
       * Important:
       *
       * We fetch the Google Scholar BibTeX URL from the
       * browser rather than from FastAPI.
       *
       * If Google allows the request, the returned BibTeX
       * is converted into a .bib File and sent through the
       * normal /api/papers/upload endpoint.
       */

      const response = await fetch(normalizedUrl, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(
          `Google Scholar returned HTTP ${response.status}.`
        );
      }

      const bibtex = await response.text();

      if (!bibtex.trim()) {
        throw new Error(
          "Google Scholar returned an empty response."
        );
      }

      if (!bibtex.trim().startsWith("@")) {
        throw new Error(
          "The Google Scholar link did not return valid BibTeX."
        );
      }

      // Convert the downloaded BibTeX text into a .bib file.
      const blob = new Blob([bibtex], {
        type: "application/x-bibtex",
      });

      const bibFile = new File(
        [blob],
        "google-scholar.bib",
        {
          type: "application/x-bibtex",
        }
      );

      // Use the existing upload pipeline.
      const result = await uploadPaper(bibFile);

      populatePaper(result);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Could not retrieve the Google Scholar citation.";

      setError(
        `${message} ` +
          "If Google Scholar blocks the browser request, " +
          "download the BibTeX citation as a .bib file " +
          "and drag that file here instead."
      );
    } finally {
      setUploading(false);
    }
  }

  // ------------------------------------------------------------
  // Drop handler
  // ------------------------------------------------------------

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (uploading) {
      return;
    }

    const file = event.dataTransfer.files?.[0];

    // Normal file drop.
    if (file) {
      handleFile(file);
      return;
    }

    // URL/link drop.
    const url = getDroppedUrl(
      event.dataTransfer
    );

    if (url) {
      handleScholarUrl(url);
      return;
    }

    setError(
      "Nothing usable was dropped. " +
        "Drop a PDF, .bib file, or Google Scholar BibTeX link."
    );
  }

  // ------------------------------------------------------------
  // Save edited metadata
  // ------------------------------------------------------------

  async function handleSave() {
    if (!paper) {
      return;
    }

    setSaving(true);
    setError(null);
    setJustSaved(false);

    try {
      const updated = await updatePaper(
        paper.id,
        {
          title,
          abstract,
          keywords,
          publication_year: year
            ? Number(year)
            : null,
          author: authors || null,
          doi: doi || null,
          subject_category:
            `${subject}: ${category}`,
          document_type: docType,
          citation_count: citations
            ? Number(citations)
            : null,
        }
      );

      setPaper(updated);
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

  // ------------------------------------------------------------
  // Recommendation signal status
  // ------------------------------------------------------------

  const filled: Record<string, boolean> = {
    Title: !!title.trim(),
    Abstract: !!abstract.trim(),
    Keywords: !!keywords.trim(),
    "Publication Year": !!year.trim(),
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 font-serif text-2xl text-ink">
        Upload Paper
      </h1>

      <p className="mb-6 text-sm text-muted">
        Add an academic paper to the repository.
        Fields marked{" "}
        <span className="text-gold">*</span> are
        required for recommendation processing.
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf,.bib"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            handleFile(file);
          }

          // Allow selecting the same file again.
          event.target.value = "";
        }}
      />

      {/* Drop zone */}
      <div
        onClick={() => {
          if (!uploading) {
            fileInput.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();

          if (!uploading) {
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={handleDrop}
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-panel px-6 py-10 text-center transition hover:border-gold"
      >
        <div className="mb-3 text-2xl">
          {uploading ? "⏳" : "↑"}
        </div>

        <p className="text-sm text-ink">
          {uploading
            ? "Importing paper…"
            : "Drop a PDF, BibTeX file, or Google Scholar BibTeX link here"}
        </p>

        <p className="mt-2 text-xs text-muted">
          You can also click to browse for a PDF or
          .bib file.
        </p>

        <p className="mt-1 text-xs text-muted">
          Google Scholar → Cite → BibTeX → drag the
          BibTeX link here.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded border border-sbert/40 bg-sbert/10 px-3 py-3 text-sm text-sbert">
          {error}
        </div>
      )}

      {/* Paper metadata */}
      {paper && (
        <>
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label
                htmlFor="title"
                className="mb-1 block text-sm text-ink"
              >
                Title{" "}
                <span className="text-gold">*</span>
              </label>

              <input
                id="title"
                type="text"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Full paper title"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            {/* Authors */}
            <div>
              <label
                htmlFor="authors"
                className="mb-1 block text-sm text-ink"
              >
                Authors{" "}
                <span className="text-gold">*</span>
              </label>

              <input
                id="authors"
                type="text"
                value={authors}
                onChange={(event) =>
                  setAuthors(event.target.value)
                }
                placeholder="Last, F., Last, F. (comma-separated)"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            {/* Abstract */}
            <div>
              <label
                htmlFor="abstract"
                className="mb-1 block text-sm text-ink"
              >
                Abstract{" "}
                <span className="text-gold">*</span>
              </label>

              <textarea
                id="abstract"
                rows={5}
                value={abstract}
                onChange={(event) =>
                  setAbstract(event.target.value)
                }
                placeholder="Full abstract text…"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            {/* Keywords */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="keywords"
                  className="block text-sm text-ink"
                >
                  Keywords{" "}
                  <span className="text-gold">*</span>
                </label>

                <span className="text-xs text-muted">
                  Comma-separated
                </span>
              </div>

              <input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(event) =>
                  setKeywords(event.target.value)
                }
                placeholder="e.g. machine learning, neural networks, classification"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            {/* Year + DOI */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="year"
                  className="mb-1 block text-sm text-ink"
                >
                  Publication Year{" "}
                  <span className="text-gold">*</span>
                </label>

                <input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(event) =>
                    setYear(event.target.value)
                  }
                  placeholder="e.g. 2023"
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="doi"
                    className="block text-sm text-ink"
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
                  onChange={(event) =>
                    setDoi(event.target.value)
                  }
                  placeholder="10.xxxx/xxxxx"
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
                />
              </div>
            </div>

            {/* Subject + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="subject"
                  className="mb-1 block text-sm text-ink"
                >
                  Subject{" "}
                  <span className="text-gold">*</span>
                </label>

                <select
                  id="subject"
                  value={subject}
                  onChange={(event) =>
                    setSubject(event.target.value)
                  }
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  <option>
                    Computer Science
                  </option>
                  <option>Mathematics</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-1 block text-sm text-ink"
                >
                  Category{" "}
                  <span className="text-gold">*</span>
                </label>

                <select
                  id="category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value)
                  }
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  <option>
                    Machine Learning
                  </option>
                  <option>Algorithms</option>
                  <option>Graph Theory</option>
                </select>
              </div>
            </div>

            {/* Document type + citations */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="docType"
                  className="mb-1 block text-sm text-ink"
                >
                  Document Type{" "}
                  <span className="text-gold">*</span>
                </label>

                <select
                  id="docType"
                  value={docType}
                  onChange={(event) =>
                    setDocType(event.target.value)
                  }
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  <option>
                    Journal Article
                  </option>
                  <option>
                    Conference Paper
                  </option>
                  <option>Thesis</option>
                  <option>
                    Technical Report
                  </option>
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="citations"
                    className="block text-sm text-ink"
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
                  onChange={(event) =>
                    setCitations(event.target.value)
                  }
                  placeholder="0"
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Recommendation validation */}
          <div className="mt-6 rounded-lg border border-line bg-panel p-4">
            <p className="mb-3 text-sm font-medium text-ink">
              Recommendation Signal Validation
            </p>

            <div className="grid grid-cols-2 gap-2">
              {signalFields.map((field) => {
                const label =
                  signalLabels[field];

                return (
                  <div
                    key={field}
                    className="flex items-center gap-2 text-sm text-muted"
                  >
                    <span
                      className={`h-3 w-3 rounded-full border ${
                        filled[label]
                          ? "border-tfidf bg-tfidf"
                          : "border-line"
                      }`}
                    />

                    {label}
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-muted">
              These four fields drive all recommendation
              pipelines.
            </p>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 w-full rounded bg-gold py-2.5 text-sm font-medium text-navy hover:bg-gold/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save paper"}
          </button>

          {/* Success */}
          {justSaved && (
            <p className="mt-3 rounded border border-tfidf/40 bg-tfidf/10 px-3 py-2 text-center text-sm text-tfidf">
              {paper.is_valid_for_recommendation
                ? "Saved — this paper is valid for recommendation."
                : `Saved — but still missing: ${
                    paper.missing_fields ??
                    "some required fields"
                  }.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}