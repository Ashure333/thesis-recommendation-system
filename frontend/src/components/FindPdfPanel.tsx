import { useState } from "react";
import { findPdfOnline, attachPdf, notifyRecommendationIndexStale } from "../api";
import type { Paper, PdfCandidate } from "../api";
import { Button } from "./ui";

interface FindPdfPanelProps {
  paper: Paper;
  onAttached: (paper: Paper) => void;
  /**
   * When provided, the per-candidate "Preview" control previews the
   * PDF inside the app (e.g. the PaperViewerModal pop-up frame)
   * instead of opening a new browser tab.
   */
  onPreview?: (url: string) => void;
}

/* ============================================================
   GITINGEST DESIGN LANGUAGE
   White result-panels with 3px gray-900 outlines · 4px radius
   Orange = the one primary action · no red/blue/green state colors
   Errors are plain ink text in an outlined panel.
   ============================================================ */

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900";

// Anchor version of Button's `secondary` (button-utility) variant, so
// "Preview" matches the buttons next to it.
const UTILITY_LINK =
  `inline-flex items-center justify-center rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 ` +
  `text-sm font-medium leading-snug text-gray-900 hover:bg-accent hover:text-onAccent ${FOCUS}`;

const sourceLabels: Record<string, string> = {
  unpaywall: "Unpaywall",
  semantic_scholar: "Semantic Scholar",
  arxiv: "arXiv",
  openalex: "OpenAlex",
};

// Errors from download_and_attach_pdf() that mean "the site blocked an
// automated download" rather than "nothing was found" -- these are the
// cases where suggesting the manual preview-then-upload path actually helps.
function isLikelyBlockedError(message: string): boolean {
  return (
    /HTTP \d{3}/.test(message) ||
    message.includes("did not return a PDF file") ||
    message.includes("Could not reach that link")
  );
}

export default function FindPdfPanel({ paper, onAttached, onPreview }: FindPdfPanelProps) {
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [candidates, setCandidates] = useState<PdfCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attachingUrl, setAttachingUrl] = useState<string | null>(null);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  async function handleSearch() {
    setSearching(true);
    setError(null);
    setBlockedUrl(null);

    try {
      const results = await findPdfOnline(paper.id);
      setCandidates(results);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleConfirm(candidate: PdfCandidate) {
    setAttachingUrl(candidate.url);
    setError(null);
    setBlockedUrl(null);

    try {
      const updated = await attachPdf(paper.id, candidate.url);
      notifyRecommendationIndexStale();
      onAttached(updated);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not attach that PDF.";
      setError(message);

      if (isLikelyBlockedError(message)) {
        setBlockedUrl(candidate.landing_page_url || candidate.url);
      }
    } finally {
      setAttachingUrl(null);
    }
  }

  return (
    <div className="mt-4 w-full max-w-md text-left text-gray-900">
      {/* button-primary: the one warm-filled action in this panel */}
      {!searched && (
        <Button
          type="button"
          onClick={handleSearch}
          disabled={searching}
        >
          {searching ? "Searching…" : "Find PDF Online"}
        </Button>
      )}

      {error && (
        // No red: accents are never used for state. Ink text in an outlined panel.
        <div
          role="alert"
          className="mt-6 rounded border-[3px] border-gray-900 bg-white px-3 py-2 text-sm font-medium text-gray-900"
        >
          <p>{error}</p>

          {blockedUrl && (
            <p className="mt-2 text-sm font-normal leading-normal text-gray-600">
              This source appears to be blocking automated downloads.
              Try{" "}
              <a
                href={blockedUrl}
                target="_blank"
                rel="noreferrer"
                className={`font-bold text-ink underline hover:decoration-2 ${FOCUS}`}
              >
                opening it in your browser
              </a>
              , saving the PDF, then uploading it from the{" "}
              <strong className="text-gray-900">Upload</strong> page instead.
            </p>
          )}
        </div>
      )}

      {searched && !searching && candidates.length === 0 && !error && (
        <p className="mt-6 text-sm text-gray-600">
          No open-access PDF was found for this paper. You can still upload one manually.
        </p>
      )}

      {candidates.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm font-bold text-gray-900">
            Found {candidates.length} possible match{candidates.length > 1 ? "es" : ""}. Confirm before attaching:
          </p>

          {candidates.map((candidate) => (
            // result-panel: white fill, 3px outline, 4px radius, md padding
            <div
              key={candidate.url}
              className="rounded border-[3px] border-gray-900 bg-white p-4"
            >
              <p className="text-sm font-bold leading-snug text-gray-900">
                {candidate.title || "Untitled result"}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Source: {sourceLabels[candidate.source] ?? candidate.source} ·{" "}
                {Math.round(candidate.confidence * 100)}% title match
                {candidate.license ? ` · ${candidate.license}` : ""}
              </p>

              <a
                href={candidate.landing_page_url || candidate.url}
                target="_blank"
                rel="noreferrer"
                className={`mt-1 inline-block break-all text-sm font-bold text-ink underline hover:decoration-2 ${FOCUS}`}
              >
                {candidate.landing_page_url || candidate.url}
              </a>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleConfirm(candidate)}
                  disabled={attachingUrl !== null}
                >
                  {attachingUrl === candidate.url ? "Attaching…" : "Use this PDF"}
                </Button>

                {onPreview ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onPreview(candidate.url)}
                  >
                    Preview
                  </Button>
                ) : (
                  <a
                    href={candidate.url}
                    target="_blank"
                    rel="noreferrer"
                    className={UTILITY_LINK}
                  >
                    Preview
                  </a>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="quiet"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? "Searching…" : "Search again"}
          </Button>
        </div>
      )}
    </div>
  );
}
