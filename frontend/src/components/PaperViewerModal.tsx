import { useEffect } from "react";
import { getPaperPdfUrl, Paper } from "../api";

interface PaperViewerModalProps {
  paper: Paper | null;
  open: boolean;
  onClose: () => void;
}

export default function PaperViewerModal({
  paper,
  open,
  onClose,
}: PaperViewerModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    // Prevent the page behind the modal from scrolling.
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !paper) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium text-ink">
              {paper.title}
            </h2>

            <div className="mt-1 flex gap-3 text-xs text-muted">
              {paper.author && (
                <span className="truncate">
                  {paper.author}
                </span>
              )}

              {paper.publication_year && (
                <span>{paper.publication_year}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close PDF viewer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xl text-muted hover:bg-panelAlt hover:text-ink"
          >
            ×
          </button>
        </div>

        {/* PDF viewer */}
        <div className="min-h-0 flex-1 bg-gray-800">
          <iframe
            src={getPaperPdfUrl(paper.id)}
            title={`PDF viewer for ${paper.title}`}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}