import { useRef, useState, type DragEvent } from "react";
import { uploadPaper, updatePaper, type Paper } from "../api";

const signalFields = ["title", "abstract", "keywords", "publication_year"] as const;
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
  const [bibtex, setBibtex] = useState("");

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

  function populatePaper(result: Paper) {
    setPaper(result);
    setTitle(result.title ?? "");
    setAbstract(result.abstract ?? "");
    setKeywords(result.keywords ?? "");
    setYear(result.publication_year ? String(result.publication_year) : "");
    setAuthors(result.author ?? "");
    setDoi(result.doi ?? "");
    setJustSaved(false);
  }

  async function handleScholarURL(url: string) {
    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      const normalizedUrl = url.trim();

      if (!/^https?:\/\//i.test(normalizedUrl)) {
        throw new Error("The dropped item is not a valid HTTP/HTTPS URL.");
      }

      // Google Scholar's "BibTeX" link returns a .bib document.
      const response = await fetch(normalizedUrl, {
        method: "GET",
        headers: {
          Accept: "text/plain, application/x-bibtex, */*",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Could not retrieve the citation (${response.status} ${response.statusText}).`
        );
      }

      const content = await response.text();

      if (!/@\w+\s*\{/i.test(content)) {
        throw new Error(
          "The dropped link did not return a valid BibTeX citation."
        );
      }

      const file = new File(
        [content],
        "google-scholar.bib",
        { type: "application/x-bibtex" }
      );

      const result = await uploadPaper(file);
      populatePaper(result);
    } catch (e) {
      setError(
        (e as Error).message ||
          "Unable to import the Google Scholar citation."
      );
    } finally {
      setUploading(false);
    }
  }

  function getDroppedURL(dataTransfer: DataTransfer): string | null {
    const uriList = dataTransfer.getData("text/uri-list");
    const plainText = dataTransfer.getData("text/plain");

    const candidate = (uriList || plainText).trim();

    if (!candidate) return null;

    // text/uri-list may contain comments beginning with #.
    const url = candidate
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#"));

    return typeof url === "string" && /^https?:\/\//i.test(url)
      ? url
      : null;
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await handleFile(files[0]);
      return;
    }

    const url = getDroppedURL(e.dataTransfer);

    if (url) {
      await handleScholarURL(url);
      return;
    }

    setError(
      "Drop a PDF/.bib file or drag a Google Scholar BibTeX link here."
    );
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setJustSaved(false);

    try {
      const result = await uploadPaper(file);
      populatePaper(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!paper) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const updated = await updatePaper(paper.id, {
        title,
        abstract,
        keywords,
        publication_year: year ? Number(year) : null,
        author: authors || null,
        doi: doi || null,
        subject_category: `${subject}: ${category}`,
        document_type: docType,
        citation_count: citations ? Number(citations) : null,
      });
      setPaper(updated); // refresh validity checklist with the real saved state
      setJustSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const filled: Record<string, boolean> = {
    Title: !!title,
    Abstract: !!abstract,
    Keywords: !!keywords,
    "Publication Year": !!year,
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 font-serif text-2xl text-ink">Upload Paper</h1>
      <p className="mb-6 text-sm text-muted">
        Add an academic paper to the repository. Fields marked{" "}
        <span className="text-gold">*</span> are required for recommendation
        processing.
      </p>

      <div className="mb-5 rounded-lg border border-line bg-panel p-5">
        <div className="mb-3">
          <h2 className="font-serif text-lg text-ink">
            Import from Google Scholar
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Drag the <strong>BibTeX</strong> link from Google Scholar here.
            The citation will be fetched and added to the repository
            automatically.
          </p>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-32 cursor-copy flex-col items-center justify-center rounded border border-dashed border-gold/60 bg-bg px-5 py-6 text-center hover:border-gold"
        >
          <p className="text-sm font-medium text-ink">
            {uploading
              ? "Importing citation…"
              : "Drop Google Scholar BibTeX link here"}
          </p>
          <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
            For example, drag the link behind Google Scholar's
            <strong> BibTeX </strong>
            option directly into this box.
          </p>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          <span>OR PASTE BIBTEX</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <textarea
          value={bibtex}
          onChange={(e) => setBibtex(e.target.value)}
          rows={6}
          placeholder={`@article{example2025,
  title={Example Paper},
  author={Author, A.},
  year={2025}
}`}
          className="w-full rounded border border-line bg-bg px-3 py-2 font-mono text-xs text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
        />

        <button
          type="button"
          disabled={uploading || !bibtex.trim()}
          onClick={async () => {
            const content = bibtex.trim();

            if (!/@\w+\s*\{/i.test(content)) {
              setError("The pasted text does not appear to be valid BibTeX.");
              return;
            }

            const file = new File(
              [content],
              "google-scholar.bib",
              { type: "application/x-bibtex" }
            );

            await handleFile(file);
            setBibtex("");
          }}
          className="mt-3 rounded bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold/90 disabled:opacity-50"
        >
          {uploading ? "Importing…" : "Import BibTeX"}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        <span>OR UPLOAD A FILE</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.bib"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-panel px-6 py-10 text-center hover:border-gold"
      >
        <p className="text-sm text-ink">
          {uploading
            ? "Extracting…"
            : "Drop a PDF or BibTeX (.bib) file here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted">
          System uses Title, Abstract, Keywords, and Publication Year for recommendation
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded border border-sbert/40 bg-sbert/10 px-3 py-2 text-sm text-sbert">
          {error}
        </p>
      )}

      {paper && (
        <>
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm text-ink">
                Title <span className="text-gold">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Full paper title"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="authors" className="mb-1 block text-sm text-ink">
                Authors <span className="text-gold">*</span>
              </label>
              <input
                id="authors"
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Last, F., Last, F. (comma-separated)"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="abstract" className="mb-1 block text-sm text-ink">
                Abstract <span className="text-gold">*</span>
              </label>
              <textarea
                id="abstract"
                rows={5}
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                placeholder="Full abstract text…"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="keywords" className="block text-sm text-ink">
                  Keywords <span className="text-gold">*</span>
                </label>
                <span className="text-xs text-muted">Comma-separated</span>
              </div>
              <input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. machine learning, neural networks, classification"
                className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="year" className="mb-1 block text-sm text-ink">
                  Publication Year <span className="text-gold">*</span>
                </label>
                <input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2023"
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="doi" className="block text-sm text-ink">
                    DOI
                  </label>
                  <span className="text-xs text-muted">Optional</span>
                </div>
                <input
                  id="doi"
                  type="text"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.xxxx/xxxxx"
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="subject" className="mb-1 block text-sm text-ink">
                  Subject <span className="text-gold">*</span>
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  <option>Computer Science</option>
                  <option>Mathematics</option>
                </select>
              </div>
              <div>
                <label htmlFor="category" className="mb-1 block text-sm text-ink">
                  Category <span className="text-gold">*</span>
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  <option>Machine Learning</option>
                  <option>Algorithms</option>
                  <option>Graph Theory</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="docType" className="mb-1 block text-sm text-ink">
                  Document Type <span className="text-gold">*</span>
                </label>
                <select
                  id="docType"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                >
                  <option>Journal Article</option>
                  <option>Conference Paper</option>
                  <option>Thesis</option>
                  <option>Technical Report</option>
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="citations" className="block text-sm text-ink">
                    Citation Count
                  </label>
                  <span className="text-xs text-muted">Optional</span>
                </div>
                <input
                  id="citations"
                  type="number"
                  value={citations}
                  onChange={(e) => setCitations(e.target.value)}
                  placeholder="0"
                  className="w-full rounded border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-gold focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-line bg-panel p-4">
            <p className="mb-3 text-sm font-medium text-ink">
              Recommendation Signal Validation
            </p>
            <div className="grid grid-cols-2 gap-2">
              {signalFields.map((field) => {
                const label = signalLabels[field];
                return (
                  <label key={field} className="flex items-center gap-2 text-sm text-muted">
                    <span
                      className={`h-3 w-3 rounded-full border ${
                        filled[label] ? "border-tfidf bg-tfidf" : "border-line"
                      }`}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              These four fields drive all recommendation pipelines.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 w-full rounded bg-gold py-2.5 text-sm font-medium text-navy hover:bg-gold/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save paper"}
          </button>

          {justSaved && (
            <p className="mt-3 rounded border border-tfidf/40 bg-tfidf/10 px-3 py-2 text-center text-sm text-tfidf">
              {paper?.is_valid_for_recommendation
                ? "Saved — this paper is valid for recommendation."
                : `Saved — but still missing: ${paper?.missing_fields ?? "some required fields"}.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
