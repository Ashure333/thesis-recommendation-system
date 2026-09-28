import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { uploadPaper, updatePaper, type Paper } from "../api";
import { Button, FieldLabel, PageHeader, SectionHeading, TextInput } from "./ui";

/* ============================================================
   GITINGEST DESIGN LANGUAGE
   Cream canvas · ink gray-900 · 3px outlines · 4px radius
   Depth = sibling slab (bg-gray-900, translate 4px/4px), never a blur.
   Orange = primary action + hover/drag/checked fills. Pale blue = text entry.
   No red/green state colours: errors and confirmations are plain ink text
   in an outlined panel. No divider rules: whitespace groups.
   ============================================================ */

const signalFields = ["title", "abstract", "keywords", "publication_year"] as const;
const signalLabels: Record<string, string> = {
  title: "Title",
  abstract: "Abstract",
  keywords: "Keywords",
  publication_year: "Publication Year",
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900";

// Shared with TextInput: same press-toward-the-slab feel on focus.
const CONTROL_MOTION =
  "transition-transform duration-100 focus:translate-x-0.5 focus:translate-y-0.5 focus:outline-none motion-reduce:transition-none";

/** Sibling layer that fakes the hard offset shadow. Sits behind the control. */
function Slab() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rounded bg-gray-900"
    />
  );
}

/** url-input construction for multi-line text: field fill + slab. */
function TextArea({
  mono = false,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return (
    <div className="relative w-full">
      <Slab />
      <textarea
        {...rest}
        className={
          "relative z-10 block w-full resize-y rounded border-[3px] border-gray-900 bg-[#E8F0FE] px-6 py-3.5 " +
          "text-gray-900 placeholder-gray-600 " +
          (mono ? "font-mono text-sm leading-normal " : "text-lg font-medium ") +
          CONTROL_MOTION +
          " " +
          className
        }
      />
    </div>
  );
}

/** Choice control: white fill (pale blue stays reserved for typing) + slab. */
function SelectInput({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <Slab />
      <select
        {...rest}
        className={
          "peer relative z-10 block w-full appearance-none rounded border-[3px] border-gray-900 bg-white py-3.5 pl-6 pr-12 " +
          "text-lg font-medium text-gray-900 " +
          CONTROL_MOTION +
          " " +
          className
        }
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={20}
        strokeWidth={3}
        className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 text-gray-900 transition-[margin,transform] duration-100 peer-focus:translate-x-0.5 peer-focus:mt-0.5 motion-reduce:transition-none"
      />
    </div>
  );
}

/** Custom checkbox: 3px outline, checkmark drawn with clip-path (no icon). */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-[3px] border-gray-900 ${
        checked ? "bg-[#FCA847]" : "bg-white"
      }`}
    >
      {checked && (
        <span className="block h-3 w-3 bg-gray-900 [clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0,43%_62%)]" />
      )}
    </span>
  );
}

type DropTarget = "scholar" | "file";

export default function Upload() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [bibtex, setBibtex] = useState("");
  const [dragTarget, setDragTarget] = useState<DropTarget | null>(null);

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

  // Drag feedback is a fill swap (white/cream -> orange), not a colour hint.
  function dropProps(target: DropTarget) {
    return {
      onDragOver: (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragTarget(target);
      },
      onDragLeave: (e: DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragTarget(null);
        }
      },
      onDrop: (e: DragEvent<HTMLDivElement>) => {
        setDragTarget(null);
        void handleDrop(e);
      },
    };
  }

  function openFilePicker() {
    fileInput.current?.click();
  }

  function onFileZoneKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  }

  const filled: Record<string, boolean> = {
    Title: !!title,
    Abstract: !!abstract,
    Keywords: !!keywords,
    "Publication Year": !!year,
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 text-gray-900">
      <PageHeader
        title="Upload Paper"
        description="Add an academic paper to the repository. Fields marked * are required for recommendation processing."
      />

      {/* result-panel: white fill, 3px outline, 4px radius, md padding */}
      <section className="rounded border-[3px] border-gray-900 bg-white p-4">
        <SectionHeading
          title="Import from Google Scholar"
          description="Drag the BibTeX link from Google Scholar here. The citation will be fetched and added to the repository automatically."
        />

        {/* Drop target: cream fill inside the white panel, orange while dragging over */}
        <div
          {...dropProps("scholar")}
          className={`mt-6 flex min-h-32 cursor-copy flex-col items-center justify-center rounded border-[3px] border-dashed border-gray-900 px-5 py-6 text-center transition-colors duration-100 motion-reduce:transition-none ${
            dragTarget === "scholar" ? "bg-[#FCA847]" : "bg-[#FFFDF8]"
          }`}
        >
          <p className="text-base font-bold">
            {uploading
              ? "Importing citation…"
              : "Drop Google Scholar BibTeX link here"}
          </p>
          <p
            className={`mt-1 max-w-lg text-sm ${
              dragTarget === "scholar" ? "text-gray-900" : "text-gray-600"
            }`}
          >
            For example, drag the link behind Google Scholar's{" "}
            <strong className="text-gray-900">BibTeX</strong> option directly
            into this box.
          </p>
        </div>

        <div className="mt-8">
          <FieldLabel htmlFor="bibtex-paste">Or paste BibTeX</FieldLabel>
          <TextArea
            id="bibtex-paste"
            mono
            value={bibtex}
            onChange={(e) => setBibtex(e.target.value)}
            rows={6}
            placeholder={`@article{example2025,
  title={Example Paper},
  author={Author, A.},
  year={2025}
}`}
          />
        </div>

        <div className="mt-6">
          <Button
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
          >
            {uploading ? "Importing…" : "Import BibTeX"}
          </Button>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <p className="text-center text-sm font-bold text-gray-600">
          Or upload a file
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.bib"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={onFileZoneKeyDown}
          {...dropProps("file")}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded border-[3px] border-dashed border-gray-900 px-6 py-10 text-center transition-colors duration-100 hover:bg-[#FCA847] motion-reduce:transition-none ${FOCUS} ${
            dragTarget === "file" ? "bg-[#FCA847]" : "bg-white"
          }`}
        >
          <p className="text-base font-bold">
            {uploading
              ? "Extracting…"
              : "Drop a PDF or BibTeX (.bib) file here, or click to browse"}
          </p>
          <p
            className={`mt-1 text-sm group-hover:text-gray-900 ${
              dragTarget === "file" ? "text-gray-900" : "text-gray-600"
            }`}
          >
            System uses Title, Abstract, Keywords, and Publication Year for
            recommendation
          </p>
        </div>
      </div>

      {error && (
        // No red: accents are never used for state. Plain ink text in an outlined panel.
        <p
          role="alert"
          className="rounded border-[3px] border-gray-900 bg-white px-3 py-2 text-sm font-medium text-gray-900"
        >
          {error}
        </p>
      )}

      {paper && (
        <>
          <div className="space-y-6">
            <div>
              <FieldLabel htmlFor="title" required>
                Title
              </FieldLabel>
              <TextInput
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Full paper title"
              />
            </div>

            <div>
              <FieldLabel htmlFor="authors" required>
                Authors
              </FieldLabel>
              <TextInput
                id="authors"
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Last, F., Last, F. (comma-separated)"
              />
            </div>

            <div>
              <FieldLabel htmlFor="abstract" required>
                Abstract
              </FieldLabel>
              <TextArea
                id="abstract"
                rows={5}
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                placeholder="Full abstract text…"
              />
            </div>

            <div>
              <FieldLabel htmlFor="keywords" required hint="Comma-separated">
                Keywords
              </FieldLabel>
              <TextInput
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. machine learning, neural networks, classification"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="year" required>
                  Publication Year
                </FieldLabel>
                <TextInput
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2023"
                />
              </div>
              <div>
                <FieldLabel htmlFor="doi" hint="Optional">
                  DOI
                </FieldLabel>
                <TextInput
                  id="doi"
                  type="text"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.xxxx/xxxxx"
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="subject" required>
                  Subject
                </FieldLabel>
                <SelectInput
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option>Computer Science</option>
                  <option>Mathematics</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="category" required>
                  Category
                </FieldLabel>
                <SelectInput
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>Machine Learning</option>
                  <option>Algorithms</option>
                  <option>Graph Theory</option>
                </SelectInput>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="docType" required>
                  Document Type
                </FieldLabel>
                <SelectInput
                  id="docType"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option>Journal Article</option>
                  <option>Conference Paper</option>
                  <option>Thesis</option>
                  <option>Technical Report</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel htmlFor="citations" hint="Optional">
                  Citation Count
                </FieldLabel>
                <TextInput
                  id="citations"
                  type="number"
                  value={citations}
                  onChange={(e) => setCitations(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* result-panel with a checkbox list; filled = orange fill + check */}
          <section className="rounded border-[3px] border-gray-900 bg-white p-4">
            <SectionHeading title="Recommendation Signal Validation" />
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {signalFields.map((field) => {
                const label = signalLabels[field];
                const isFilled = filled[label];
                return (
                  <li
                    key={field}
                    className="flex items-center gap-3 text-base font-medium"
                  >
                    <CheckBox checked={isFilled} />
                    {label}
                    <span className="sr-only">
                      {isFilled ? "(filled)" : "(missing)"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-gray-600">
              These four fields drive all recommendation pipelines.
            </p>
          </section>

          <div className="flex flex-col gap-6">
            <Button
              type="button"
              fullWidth
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save paper"}
            </Button>

            {justSaved && (
              <p
                role="status"
                className="rounded border-[3px] border-gray-900 bg-white px-3 py-2 text-center text-base font-medium text-gray-900"
              >
                {paper?.is_valid_for_recommendation
                  ? "Saved — this paper is valid for recommendation."
                  : `Saved — but still missing: ${paper?.missing_fields ?? "some required fields"}.`}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
