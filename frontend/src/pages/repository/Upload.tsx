import { useRef, useState } from "react";
import { uploadPaper, updatePaper, Paper } from "../../api";

const signalFields: (keyof Paper)[] = ["title", "abstract", "keywords", "publication_year"];
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

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadPaper(file);
      setPaper(result);
      setTitle(result.title ?? "");
      setAbstract(result.abstract ?? "");
      setKeywords(result.keywords ?? "");
      setYear(result.publication_year ? String(result.publication_year) : "");
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
    try {
      await updatePaper(paper.id, {
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

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.tex"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <div
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-panel px-6 py-10 text-center hover:border-gold"
      >
        <p className="text-sm text-ink">
          {uploading ? "Extracting…" : "Drop a PDF or LaTeX (.tex) file here, or click to browse"}
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
        </>
      )}
    </div>
  );
}
