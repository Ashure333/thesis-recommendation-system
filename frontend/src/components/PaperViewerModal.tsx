import { useEffect, useState } from "react";
import {
  getPaperPdfUrl,
  updatePaper,
} from "../api";
import type { Paper } from "../api";
import FindPdfPanel from "./FindPdfPanel";
import { Button } from "./ui";

interface PaperViewerModalProps {
  paper: Paper | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
  onPaperUpdated?: (paper: Paper) => void;
}

interface PaperForm {
  title: string;
  author: string;
  abstract: string;
  keywords: string;
  publication_year: string;
  doi: string;
  subject_category: string;
  document_type: string;
  citation_count: string;
}

/* ============================================================
   GITINGEST DESIGN LANGUAGE
   Cream canvas #FFFDF8 · 3px gray-900 outlines · 4px radius
   Depth = a solid offset slab behind the dialog (8px, offset-lg)
   Orange = the one primary action · errors are plain ink text
   ============================================================ */

/* Compact version of the url-input (pale-blue field, chunky outline).
   No slab: nine stacked slabs in a sidebar would be noise, and the
   slab is reserved for the one dominant input on a page. */
const INPUT =
  "block w-full rounded border-[3px] border-gray-900 bg-[#E8F0FE] px-3 py-2 " +
  "text-sm font-medium text-gray-900 placeholder-gray-600 " +
  "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-gray-900 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// Fields shown in the metadata panel, in display order.
interface FieldConfig {
  key: keyof PaperForm;
  label: string;
  control: "input" | "textarea";
  type?: "number";
  rows?: number;
  emptyText?: string;
  /** whitespace-pre-wrap + relaxed leading, for long prose */
  prose?: boolean;
  breakAll?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: "title", label: "Title", control: "input" },
  { key: "author", label: "Author", control: "input" },
  { key: "publication_year", label: "Publication year", control: "input", type: "number" },
  {
    key: "abstract",
    label: "Abstract",
    control: "textarea",
    rows: 7,
    emptyText: "No abstract available.",
    prose: true,
  },
  { key: "keywords", label: "Keywords", control: "textarea", rows: 3 },
  { key: "doi", label: "DOI", control: "input", breakAll: true },
  { key: "subject_category", label: "Subject category", control: "input" },
  { key: "document_type", label: "Document type", control: "input" },
  { key: "citation_count", label: "Citation count", control: "input", type: "number" },
];

function formFromPaper(paper: Paper): PaperForm {
  return {
    title: paper.title ?? "",
    author: paper.author ?? "",
    abstract: paper.abstract ?? "",
    keywords: paper.keywords ?? "",
    publication_year:
      paper.publication_year != null ? String(paper.publication_year) : "",
    doi: paper.doi ?? "",
    subject_category: paper.subject_category ?? "",
    document_type: paper.document_type ?? "",
    citation_count:
      paper.citation_count != null ? String(paper.citation_count) : "",
  };
}

export default function PaperViewerModal({
  paper,
  open,
  onClose,
  canEdit = false,
  onPaperUpdated,
}: PaperViewerModalProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(paper);

  const [form, setForm] = useState<PaperForm>({
    title: "",
    author: "",
    abstract: "",
    keywords: "",
    publication_year: "",
    doi: "",
    subject_category: "",
    document_type: "",
    citation_count: "",
  });

  useEffect(() => {
    setCurrentPaper(paper);

    if (!paper) {
      return;
    }

    setForm(formFromPaper(paper));
    setEditing(false);
    setError(null);
  }, [paper]);

  if (!open || !currentPaper) {
    return null;
  }

  const pdfUrl = getPaperPdfUrl(currentPaper.id);

  const isPdf =
    currentPaper.stored_path?.toLowerCase().endsWith(".pdf") ?? false;

  const handleChange = (field: keyof PaperForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const updatedPaper = await updatePaper(currentPaper.id, {
        title: form.title.trim() || undefined,
        author: form.author.trim() || undefined,
        abstract: form.abstract.trim() || undefined,
        keywords: form.keywords.trim() || undefined,
        publication_year: form.publication_year.trim()
          ? Number(form.publication_year)
          : undefined,
        doi: form.doi.trim() || undefined,
        subject_category: form.subject_category.trim() || undefined,
        document_type: form.document_type.trim() || undefined,
        citation_count: form.citation_count.trim()
          ? Number(form.citation_count)
          : undefined,
      });

      setCurrentPaper(updatedPaper);
      setEditing(false);

      if (onPaperUpdated) {
        onPaperUpdated(updatedPaper);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update paper."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!currentPaper) {
      return;
    }

    setForm(formFromPaper(currentPaper));
    setEditing(false);
    setError(null);
  };

  // --------------------------------------------------------
  // Called by FindPdfPanel once a candidate PDF has been
  // confirmed and successfully attached to this paper.
  // --------------------------------------------------------
  const handlePdfAttached = (updatedPaper: Paper) => {
    setCurrentPaper(updatedPaper);

    if (onPaperUpdated) {
      onPaperUpdated(updatedPaper);
    }
  };

  return (
    /* Scrim is the solid cream canvas rather than a translucent black:
       the spec allows no translucency, and the ink outline + slab read
       best against cream. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FFFDF8] p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Sizing lives on the wrapper so the slab matches the dialog exactly. */}
      <div className="relative h-[92vh] w-[95vw] max-w-[1600px]">
        {/* offset-lg slab: second solid layer, 8px right / 8px down */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded bg-gray-900"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="paper-viewer-title"
          className="relative z-10 flex h-full w-full flex-col overflow-hidden rounded border-[3px] border-gray-900 bg-white text-gray-900"
        >
          {/* ================================================= */}
          {/* HEADER (navbar treatment: cream, ink rule below) */}
          {/* ================================================= */}

          <div className="flex items-center justify-between gap-4 border-b-[3px] border-gray-900 bg-[#FFFDF8] px-5 py-3">
            <div className="min-w-0">
              <h2
                id="paper-viewer-title"
                className="truncate text-xl font-bold leading-snug text-gray-900"
              >
                {currentPaper.title || "Untitled Paper"}
              </h2>

              <p className="text-sm text-gray-600">
                {isPdf ? "PDF reader" : "Bibliographic record"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {canEdit && !editing && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              )}

              {editing && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>

                  {/* button-primary, scaled down for the header bar */}
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="!px-4 !py-1.5 !text-base"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </>
              )}

              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                aria-label="Close"
                className="!px-3 !py-0.5 !text-2xl !leading-none"
              >
                ×
              </Button>
            </div>
          </div>

          {/* ================================================= */}
          {/* ERROR: no red, plain ink text on white */}
          {/* ================================================= */}

          {error && (
            <div
              role="alert"
              className="border-b-[3px] border-gray-900 bg-white px-5 py-3 text-sm font-medium text-gray-900"
            >
              {error}
            </div>
          )}

          {/* ================================================= */}
          {/* BODY */}
          {/* ================================================= */}

          <div className="flex min-h-0 flex-1">
            {/* ----------------- PDF READER ----------------- */}
            <div className="min-w-0 flex-1 bg-[#FFFDF8]">
              {isPdf ? (
                <iframe
                  src={pdfUrl}
                  title={currentPaper.title || "Paper PDF"}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  {/* result-panel */}
                  <div className="w-full max-w-md rounded border-[3px] border-gray-900 bg-white p-6 text-left">
                    <p className="text-xl font-bold leading-snug text-gray-900">
                      PDF unavailable
                    </p>

                    <p className="mt-2 text-sm leading-normal text-gray-600">
                      This paper was imported as a BibTeX citation and does
                      not have a stored PDF file.
                    </p>

                    <FindPdfPanel
                      paper={currentPaper}
                      onAttached={handlePdfAttached}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ----------------- METADATA PANEL ----------------- */}
            <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l-[3px] border-gray-900 bg-white">
              <div className="p-5">
                <h3 className="text-xl font-bold leading-snug text-gray-900">
                  Paper information
                </h3>

                {/* whitespace groups the fields; no divider rules */}
                <div className="mt-6 space-y-5">
                  {FIELDS.map((field) => {
                    const inputId = `paper-field-${field.key}`;
                    const raw = currentPaper[field.key];
                    const isEmpty = raw == null || raw === "";

                    return (
                      <div key={field.key}>
                        <label
                          htmlFor={editing ? inputId : undefined}
                          className="mb-1.5 block text-sm font-bold text-gray-900"
                        >
                          {field.label}
                        </label>

                        {editing ? (
                          field.control === "textarea" ? (
                            <textarea
                              id={inputId}
                              value={form[field.key]}
                              onChange={(event) =>
                                handleChange(field.key, event.target.value)
                              }
                              rows={field.rows}
                              className={`${INPUT} resize-y`}
                            />
                          ) : (
                            <input
                              id={inputId}
                              type={field.type}
                              value={form[field.key]}
                              onChange={(event) =>
                                handleChange(field.key, event.target.value)
                              }
                              className={INPUT}
                            />
                          )
                        ) : (
                          <p
                            className={`text-sm ${
                              field.prose
                                ? "whitespace-pre-wrap leading-relaxed"
                                : "leading-snug"
                            } ${field.breakAll ? "break-all" : ""} ${
                              isEmpty ? "text-gray-600" : "text-gray-900"
                            }`}
                          >
                            {isEmpty ? field.emptyText ?? "—" : String(raw)}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* FILE: read-only, set in monospace like other code values */}
                  <div>
                    <p className="mb-1.5 text-sm font-bold text-gray-900">
                      Stored file
                    </p>

                    <p className="break-all font-mono text-sm leading-normal text-gray-600">
                      {currentPaper.stored_path || "No file"}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
