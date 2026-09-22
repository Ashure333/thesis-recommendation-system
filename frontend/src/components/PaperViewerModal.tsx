import { useEffect, useState } from "react";
import {
  getPaperPdfUrl,
  updatePaper,
} from "../api";
import type { Paper } from "../api";


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

  const [editing, setEditing] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(
    null
  );


  const [currentPaper, setCurrentPaper] =
    useState<Paper | null>(paper);


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

    setForm({
      title: paper.title ?? "",
      author: paper.author ?? "",
      abstract: paper.abstract ?? "",
      keywords: paper.keywords ?? "",
      publication_year:
        paper.publication_year != null
          ? String(paper.publication_year)
          : "",
      doi: paper.doi ?? "",
      subject_category:
        paper.subject_category ?? "",
      document_type:
        paper.document_type ?? "",
      citation_count:
        paper.citation_count != null
          ? String(paper.citation_count)
          : "",
    });

    setEditing(false);
    setError(null);
  }, [paper]);


  if (!open || !currentPaper) {
    return null;
  }


  const pdfUrl = getPaperPdfUrl(
    currentPaper.id
  );


  const isPdf =
    currentPaper.stored_path
      ?.toLowerCase()
      .endsWith(".pdf") ?? false;


  const handleChange = (
    field: keyof PaperForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };


  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const updatedPaper =
  await updatePaper(
    currentPaper.id,
    {
      title:
        form.title.trim() || undefined,

      author:
        form.author.trim() || undefined,

      abstract:
        form.abstract.trim() || undefined,

      keywords:
        form.keywords.trim() || undefined,

      publication_year:
        form.publication_year.trim()
          ? Number(form.publication_year)
          : undefined,

      doi:
        form.doi.trim() || undefined,

      subject_category:
        form.subject_category.trim() || undefined,

      document_type:
        form.document_type.trim() || undefined,

      citation_count:
        form.citation_count.trim()
          ? Number(form.citation_count)
          : undefined,
    }
  );


      setCurrentPaper(
        updatedPaper
      );

      setEditing(false);

      if (onPaperUpdated) {
        onPaperUpdated(
          updatedPaper
        );
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

    setForm({
      title: currentPaper.title ?? "",
      author: currentPaper.author ?? "",
      abstract: currentPaper.abstract ?? "",
      keywords: currentPaper.keywords ?? "",
      publication_year:
        currentPaper.publication_year != null
          ? String(
              currentPaper.publication_year
            )
          : "",
      doi: currentPaper.doi ?? "",
      subject_category:
        currentPaper.subject_category ?? "",
      document_type:
        currentPaper.document_type ?? "",
      citation_count:
        currentPaper.citation_count != null
          ? String(
              currentPaper.citation_count
            )
          : "",
    });

    setEditing(false);
    setError(null);
  };


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >

      <div
        className="
          flex
          h-[92vh]
          w-[95vw]
          max-w-[1600px]
          flex-col
          overflow-hidden
          rounded-xl
          bg-white
          shadow-2xl
        "
      >

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-gray-200
            px-5
            py-4
          "
        >

          <div className="min-w-0">
            <h2
              className="
                truncate
                text-lg
                font-semibold
                text-gray-900
              "
            >
              {currentPaper.title ||
                "Untitled Paper"}
            </h2>

            <p
              className="
                mt-1
                text-xs
                text-gray-500
              "
            >
              {isPdf
                ? "PDF reader"
                : "Bibliographic record"}
            </p>
          </div>


          <div className="flex items-center gap-2">

            {canEdit && !editing && (
              <button
                type="button"
                onClick={() =>
                  setEditing(true)
                }
                className="
                  rounded-md
                  border
                  border-gray-300
                  px-3
                  py-2
                  text-sm
                  font-medium
                  text-gray-700
                  hover:bg-gray-50
                "
              >
                Edit
              </button>
            )}


            {editing && (
              <>
                <button
                  type="button"
                  onClick={
                    handleCancelEdit
                  }
                  disabled={saving}
                  className="
                    rounded-md
                    border
                    border-gray-300
                    px-3
                    py-2
                    text-sm
                    font-medium
                    text-gray-700
                    hover:bg-gray-50
                    disabled:opacity-50
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    handleSave
                  }
                  disabled={saving}
                  className="
                    rounded-md
                    bg-gray-900
                    px-3
                    py-2
                    text-sm
                    font-medium
                    text-white
                    hover:bg-gray-800
                    disabled:opacity-50
                  "
                >
                  {saving
                    ? "Saving..."
                    : "Save"}
                </button>
              </>
            )}


            <button
              type="button"
              onClick={onClose}
              className="
                rounded-md
                px-3
                py-2
                text-xl
                leading-none
                text-gray-500
                hover:bg-gray-100
                hover:text-gray-800
              "
              aria-label="Close"
            >
              ×
            </button>

          </div>
        </div>


        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div
            className="
              border-b
              border-red-200
              bg-red-50
              px-5
              py-3
              text-sm
              text-red-700
            "
          >
            {error}
          </div>
        )}


        {/* ================================================= */}
        {/* BODY */}
        {/* ================================================= */}

        <div className="flex min-h-0 flex-1">

          {/* ================================================= */}
          {/* PDF READER */}
          {/* ================================================= */}

          <div className="min-w-0 flex-1 bg-gray-100">

            {isPdf ? (

              <iframe
                src={pdfUrl}
                title={
                  currentPaper.title ||
                  "Paper PDF"
                }
                className="
                  h-full
                  w-full
                  border-0
                "
              />

            ) : (

              <div
                className="
                  flex
                  h-full
                  items-center
                  justify-center
                  p-8
                  text-center
                "
              >

                <div className="max-w-md">

                  <p
                    className="
                      text-sm
                      font-medium
                      text-gray-700
                    "
                  >
                    PDF unavailable
                  </p>

                  <p
                    className="
                      mt-2
                      text-xs
                      leading-5
                      text-gray-500
                    "
                  >
                    This paper was imported
                    as a BibTeX citation and
                    does not have a stored
                    PDF file.
                  </p>

                </div>

              </div>

            )}

          </div>


          {/* ================================================= */}
          {/* METADATA PANEL */}
          {/* ================================================= */}

          <aside
            className="
              flex
              w-[360px]
              shrink-0
              flex-col
              overflow-y-auto
              border-l
              border-gray-200
              bg-white
            "
          >

            <div className="p-5">

              <h3
                className="
                  text-sm
                  font-semibold
                  text-gray-900
                "
              >
                Paper information
              </h3>


              <div className="mt-5 space-y-4">

                {/* TITLE */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Title
                  </label>

                  {editing ? (
                    <input
                      value={form.title}
                      onChange={(event) =>
                        handleChange(
                          "title",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-900
                      "
                    >
                      {currentPaper.title ||
                        "—"}
                    </p>
                  )}
                </div>


                {/* AUTHOR */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Author
                  </label>

                  {editing ? (
                    <input
                      value={form.author}
                      onChange={(event) =>
                        handleChange(
                          "author",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-900
                      "
                    >
                      {currentPaper.author ||
                        "—"}
                    </p>
                  )}
                </div>


                {/* YEAR */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Publication year
                  </label>

                  {editing ? (
                    <input
                      type="number"
                      value={
                        form.publication_year
                      }
                      onChange={(event) =>
                        handleChange(
                          "publication_year",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-900
                      "
                    >
                      {currentPaper.publication_year ??
                        "—"}
                    </p>
                  )}
                </div>


                {/* ABSTRACT */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Abstract
                  </label>

                  {editing ? (
                    <textarea
                      value={
                        form.abstract
                      }
                      onChange={(event) =>
                        handleChange(
                          "abstract",
                          event.target.value
                        )
                      }
                      rows={7}
                      className="
                        mt-1
                        w-full
                        resize-y
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        whitespace-pre-wrap
                        text-sm
                        leading-6
                        text-gray-700
                      "
                    >
                      {currentPaper.abstract ||
                        "No abstract available."}
                    </p>
                  )}
                </div>


                {/* KEYWORDS */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Keywords
                  </label>

                  {editing ? (
                    <textarea
                      value={
                        form.keywords
                      }
                      onChange={(event) =>
                        handleChange(
                          "keywords",
                          event.target.value
                        )
                      }
                      rows={3}
                      className="
                        mt-1
                        w-full
                        resize-y
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-700
                      "
                    >
                      {currentPaper.keywords ||
                        "—"}
                    </p>
                  )}
                </div>


                {/* DOI */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    DOI
                  </label>

                  {editing ? (
                    <input
                      value={form.doi}
                      onChange={(event) =>
                        handleChange(
                          "doi",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        break-all
                        text-sm
                        text-gray-700
                      "
                    >
                      {currentPaper.doi ||
                        "—"}
                    </p>
                  )}
                </div>


                {/* SUBJECT CATEGORY */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Subject category
                  </label>

                  {editing ? (
                    <input
                      value={
                        form.subject_category
                      }
                      onChange={(event) =>
                        handleChange(
                          "subject_category",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-700
                      "
                    >
                      {currentPaper.subject_category ||
                        "—"}
                    </p>
                  )}
                </div>


                {/* DOCUMENT TYPE */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Document type
                  </label>

                  {editing ? (
                    <input
                      value={
                        form.document_type
                      }
                      onChange={(event) =>
                        handleChange(
                          "document_type",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-700
                      "
                    >
                      {currentPaper.document_type ||
                        "—"}
                    </p>
                  )}
                </div>


                {/* CITATION COUNT */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Citation count
                  </label>

                  {editing ? (
                    <input
                      type="number"
                      value={
                        form.citation_count
                      }
                      onChange={(event) =>
                        handleChange(
                          "citation_count",
                          event.target.value
                        )
                      }
                      className="
                        mt-1
                        w-full
                        rounded-md
                        border
                        border-gray-300
                        px-3
                        py-2
                        text-sm
                        outline-none
                        focus:border-gray-500
                      "
                    />
                  ) : (
                    <p
                      className="
                        mt-1
                        text-sm
                        text-gray-700
                      "
                    >
                      {currentPaper.citation_count ??
                        "—"}
                    </p>
                  )}
                </div>


                {/* FILE */}

                <div>
                  <label
                    className="
                      text-xs
                      font-medium
                      text-gray-500
                    "
                  >
                    Stored file
                  </label>

                  <p
                    className="
                      mt-1
                      break-all
                      text-xs
                      text-gray-500
                    "
                  >
                    {currentPaper.stored_path ||
                      "No file"}
                  </p>
                </div>

              </div>
            </div>

          </aside>

        </div>

      </div>

    </div>
  );
}