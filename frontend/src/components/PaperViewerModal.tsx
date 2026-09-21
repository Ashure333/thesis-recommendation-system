import { useEffect, useState } from "react";
import { getPaperPdfUrl, Paper, updatePaper } from "../api";

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

export default function PaperViewerModal({
  paper,
  open,
  onClose,
  canEdit = false,
  onPaperUpdated,
}: PaperViewerModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  /*
   * Populate the form whenever a paper is opened.
   */
  useEffect(() => {
    if (!paper) {
      return;
    }

    setForm({
      title: paper.title ?? "",
      author: paper.author ?? "",
      abstract: paper.abstract ?? "",
      keywords: paper.keywords ?? "",
      publication_year:
        paper.publication_year !== null &&
        paper.publication_year !== undefined
          ? String(paper.publication_year)
          : "",
      doi: paper.doi ?? "",
      subject_category: paper.subject_category ?? "",
      document_type: paper.document_type ?? "",
      citation_count:
        paper.citation_count !== null &&
        paper.citation_count !== undefined
          ? String(paper.citation_count)
          : "",
    });

    setIsEditing(false);
    setSaveError(null);
  }, [paper]);

  /*
   * Escape key handling.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isEditing) {
        /*
         * We only need to tell the component to stop editing here.
         * The actual form reset happens through the button handler.
         */
        setIsEditing(false);
        setSaveError(null);
      } else {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isEditing, onClose]);

  /*
   * Nothing to display if the modal isn't open or
   * there isn't a selected paper.
   */
  if (!open || !paper) {
    return null;
  }

  /*
   * From this point onward, currentPaper is guaranteed
   * to be a Paper rather than Paper | null.
   *
   * This is important because TypeScript does not always
   * preserve the narrowing of `paper` inside nested functions.
   */
  const currentPaper = paper;

  function handleFieldChange(
    field: keyof PaperForm,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({
      title: currentPaper.title ?? "",
      author: currentPaper.author ?? "",
      abstract: currentPaper.abstract ?? "",
      keywords: currentPaper.keywords ?? "",
      publication_year:
        currentPaper.publication_year !== null &&
        currentPaper.publication_year !== undefined
          ? String(currentPaper.publication_year)
          : "",
      doi: currentPaper.doi ?? "",
      subject_category: currentPaper.subject_category ?? "",
      document_type: currentPaper.document_type ?? "",
      citation_count:
        currentPaper.citation_count !== null &&
        currentPaper.citation_count !== undefined
          ? String(currentPaper.citation_count)
          : "",
    });
  }

  function handleStartEditing() {
    resetForm();
    setSaveError(null);
    setIsEditing(true);
  }

  function handleCancelEditing() {
    resetForm();
    setSaveError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    const trimmedTitle = form.title.trim();

    if (!trimmedTitle) {
      setSaveError("Title is required.");
      return;
    }

    let publicationYear: number | null = null;

    if (form.publication_year.trim()) {
      const parsedYear = Number(form.publication_year.trim());

      if (!Number.isInteger(parsedYear)) {
        setSaveError("Publication year must be a whole number.");
        return;
      }

      publicationYear = parsedYear;
    }

    let citationCount: number | null = null;

    if (form.citation_count.trim()) {
      const parsedCitationCount = Number(
        form.citation_count.trim(),
      );

      if (!Number.isInteger(parsedCitationCount)) {
        setSaveError("Citation count must be a whole number.");
        return;
      }

      if (parsedCitationCount < 0) {
        setSaveError("Citation count cannot be negative.");
        return;
      }

      citationCount = parsedCitationCount;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const updatedPaper = await updatePaper(currentPaper.id, {
        title: trimmedTitle,
        author: form.author.trim() || null,
        abstract: form.abstract.trim() || null,
        keywords: form.keywords.trim() || null,
        publication_year: publicationYear,
        doi: form.doi.trim() || null,
        subject_category: form.subject_category.trim() || null,
        document_type: form.document_type.trim() || null,
        citation_count: citationCount,
      });

      onPaperUpdated?.(updatedPaper);

      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update paper:", error);

      if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError("Failed to save changes.");
      }
    } finally {
      setSaving(false);
    }
  }

  const pdfUrl = getPaperPdfUrl(currentPaper.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        if (isEditing) {
          handleCancelEditing();
        } else {
          onClose();
        }
      }}
    >
      <div
        className={[
          "flex h-[92vh] w-full overflow-hidden rounded-xl bg-white shadow-2xl",
          isEditing ? "max-w-[1500px]" : "max-w-6xl",
        ].join(" ")}
      >
        {/* =====================================================
            PDF VIEWER
            ===================================================== */}
        <div
          className={[
            "flex min-w-0 flex-1 flex-col",
            isEditing ? "w-[65%]" : "w-full",
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3">
            <div className="min-w-0 pr-4">
              <h2 className="truncate text-base font-semibold text-gray-900">
                {currentPaper.title}
              </h2>

              {currentPaper.author && (
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {currentPaper.author}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canEdit && !isEditing && (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Edit
                </button>
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEditing}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    handleCancelEditing();
                  } else {
                    onClose();
                  }
                }}
                className="rounded-lg px-3 py-1.5 text-lg leading-none text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close PDF viewer"
              >
                ×
              </button>
            </div>
          </div>

          {/* PDF */}
          <div className="min-h-0 flex-1 bg-gray-100">
            {currentPaper.stored_path ? (
              <iframe
                src={pdfUrl}
                title={currentPaper.title}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    PDF unavailable
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    This paper does not have a stored PDF file.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            EDIT SIDEBAR
            ===================================================== */}
        {isEditing && (
          <aside className="flex w-[35%] min-w-[340px] max-w-[520px] flex-col border-l border-gray-200 bg-white">
            {/* Sidebar Header */}
            <div className="shrink-0 border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                Edit Paper
              </h3>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Correct metadata that was missing or incorrectly
                extracted from the uploaded PDF.
              </p>
            </div>

            {/* Form */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label
                    htmlFor="paper-title"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Title
                  </label>

                  <input
                    id="paper-title"
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      handleFieldChange(
                        "title",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Author */}
                <div>
                  <label
                    htmlFor="paper-author"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Author
                  </label>

                  <input
                    id="paper-author"
                    type="text"
                    value={form.author}
                    onChange={(event) =>
                      handleFieldChange(
                        "author",
                        event.target.value,
                      )
                    }
                    placeholder="Author name(s)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Abstract */}
                <div>
                  <label
                    htmlFor="paper-abstract"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Abstract
                  </label>

                  <textarea
                    id="paper-abstract"
                    value={form.abstract}
                    onChange={(event) =>
                      handleFieldChange(
                        "abstract",
                        event.target.value,
                      )
                    }
                    rows={8}
                    placeholder="Paper abstract"
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-5 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Keywords */}
                <div>
                  <label
                    htmlFor="paper-keywords"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Keywords
                  </label>

                  <textarea
                    id="paper-keywords"
                    value={form.keywords}
                    onChange={(event) =>
                      handleFieldChange(
                        "keywords",
                        event.target.value,
                      )
                    }
                    rows={3}
                    placeholder="keyword 1, keyword 2, keyword 3"
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-5 text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />

                  <p className="mt-1.5 text-xs text-gray-500">
                    Separate keywords with commas.
                  </p>
                </div>

                {/* Publication Year */}
                <div>
                  <label
                    htmlFor="paper-publication-year"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Publication Year
                  </label>

                  <input
                    id="paper-publication-year"
                    type="number"
                    value={form.publication_year}
                    onChange={(event) =>
                      handleFieldChange(
                        "publication_year",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. 2024"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* DOI */}
                <div>
                  <label
                    htmlFor="paper-doi"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    DOI
                  </label>

                  <input
                    id="paper-doi"
                    type="text"
                    value={form.doi}
                    onChange={(event) =>
                      handleFieldChange(
                        "doi",
                        event.target.value,
                      )
                    }
                    placeholder="10.xxxx/xxxxx"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Subject / Category */}
                <div>
                  <label
                    htmlFor="paper-subject-category"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Subject / Category
                  </label>

                  <input
                    id="paper-subject-category"
                    type="text"
                    value={form.subject_category}
                    onChange={(event) =>
                      handleFieldChange(
                        "subject_category",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Document Type */}
                <div>
                  <label
                    htmlFor="paper-document-type"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Document Type
                  </label>

                  <input
                    id="paper-document-type"
                    type="text"
                    value={form.document_type}
                    onChange={(event) =>
                      handleFieldChange(
                        "document_type",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. Research Article"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Citation Count */}
                <div>
                  <label
                    htmlFor="paper-citation-count"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Citation Count
                  </label>

                  <input
                    id="paper-citation-count"
                    type="number"
                    min="0"
                    value={form.citation_count}
                    onChange={(event) =>
                      handleFieldChange(
                        "citation_count",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. 25"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-400"
                  />
                </div>

                {/* Recommendation Fields Notice */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-700">
                    Recommendation fields
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Changes to the title, abstract, keywords, or
                    publication year may affect recommendation
                    eligibility and recommendation results.
                  </p>
                </div>

                {/* Error */}
                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm leading-5 text-red-700">
                      {saveError}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={handleCancelEditing}
                disabled={saving}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}