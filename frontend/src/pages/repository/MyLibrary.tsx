import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getLibrary,
  removeFromLibrary,
  assignLibraryKeywords,
  LibraryEntry,
  Paper,
} from "../../api";
import PaperViewerModal from "../../components/PaperViewerModal";
import MathText from "../../components/MathText";
import PetFigure from "../../components/PetFigure";
import { Button, EmptyState, PageHeader, PageShell } from "../../components/ui";
import HuntItem from "../../components/retro/HuntItem";
import { HUNT_ITEMS } from "../../data/hunt";
import { usePetForm } from "../../state/petForm";
import { triggerSlimeAnimation } from "../../utils/slimeEvents";

/* ============================================================
   PET DRAG IMAGE — the drag ghost for a library row.
   Renders the currently selected pet form (accent blob with
   ink outline and eyes) as the thing that follows the cursor,
   instead of the default browser row snapshot.
   ============================================================ */

/* Corner radii (0..1 of the half size) per form variant. */
const DRAG_RADII: Record<string, [number, number, number, number]> = {
  original: [0.72, 0.72, 0.5, 0.5],
  tall: [0.85, 0.85, 0.55, 0.55],
  wide: [0.62, 0.62, 0.5, 0.5],
  teardrop: [0.9, 0.9, 0.5, 0.5],
  squash: [0.58, 0.58, 0.5, 0.5],
  chunky: [0.5, 0.5, 0.5, 0.5],
  sleepy: [0.72, 0.72, 0.5, 0.5],
  happy: [0.72, 0.72, 0.5, 0.5],
  grump: [0.72, 0.72, 0.5, 0.5],
  spike: [0.9, 0.9, 0.5, 0.5],
};

function petDragImage(variant: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "243 156 18";
  const ink = "#2c3e50";

  const size = 84;
  const x = (96 - size) / 2;
  const y = (96 - size) / 2 + 4;

  // Ground shadow.
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(48, 84, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Blob body, silhouette from the variant.
  const [tl, tr, br, bl] = DRAG_RADII[variant] ?? DRAG_RADII.original;
  const half = size / 2;
  ctx.beginPath();
  ctx.roundRect(
    x,
    y,
    size,
    size,
    [tl * half, tr * half, br * half, bl * half],
  );
  ctx.fillStyle = `rgb(${accent})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  ctx.stroke();

  // Eyes.
  const eyeY = y + size * 0.42;
  const eyeR = 8;
  for (const ex of [36, 60]) {
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ex + 1.5, eyeY - 1, 3, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
  }

  return canvas;
}

export default function MyLibrary() {
  const navigate = useNavigate();
  const { form } = usePetForm();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF Viewer State
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      let list = await getLibrary();

      /*
       * Automatic keyword assigner: any saved paper that has no
       * keywords gets them generated (locally, YAKE) before the
       * list is shown -- no button, no prompt.
       */
      const needsKeywords = list.some(
        (entry) => !(entry.paper.keywords ?? "").trim()
      );

      if (needsKeywords) {
        try {
          const result = await assignLibraryKeywords();

          if (result.updated > 0) {
            // Pick up the freshly generated keywords.
            list = await getLibrary();
          }
        } catch {
          // Best-effort: show the library even if the sweep failed.
        }
      }

      setEntries(list);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't load your library."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /* Keep the list in sync when the pet deletes a paper by
     eating/zapping/burning a dropped row. */
  useEffect(() => {
    async function refresh() {
      try {
        setEntries(await getLibrary());
      } catch {
        // Keep the current list; the next manual visit reloads.
      }
    }

    window.addEventListener("library-changed", refresh);
    return () => window.removeEventListener("library-changed", refresh);
  }, []);

  async function handleRemove(paperId: number) {
    try {
      await removeFromLibrary(paperId);
      // The pet disposes of the paper it just removed.
      triggerSlimeAnimation("burn");
      if (selectedPaper?.id === paperId) {
        handleClosePaper();
      }
      setEntries((prev) => prev.filter((entry) => entry.paper.id !== paperId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove paper from your library.");
    }
  }

  function handleOpenPaper(paper: Paper) {
    setSelectedPaper(paper);
    setIsViewerOpen(true);
  }

  function handleClosePaper() {
    setIsViewerOpen(false);
    setSelectedPaper(null);
  }

  function handleFindSimilar(paperId: number) {
    navigate("/recommendations", {
      state: {
        mode: "seed",
        seedPaperId: paperId,
        pipeline: "tfidf",
      },
    });
  }

  return (
    <PageShell>
      <HuntItem item={HUNT_ITEMS.find((item) => item.id === "hunt-star")!} />
      <PageHeader
        eyebrow="Saved papers"
        title="My Library"
        description={
          loading
            ? "Loading your saved papers…"
            : `${entries.length} saved paper${entries.length === 1 ? "" : "s"}.`
        }
        action={
          <Link to="/repository" className="text-sm font-bold text-ink underline hover:decoration-2">
            + Browse Repository
          </Link>
        }
      />

      {error && (
        <div className="status-error mb-5">
          Couldn't load your library: {error}. Is the backend running on port 8000?
        </div>
      )}

      {!loading && entries.length === 0 && !error ? (
        <EmptyState
          title="Your library is empty."
          description="Save papers from the repository or recommendation results to keep them here."
          figure={<PetFigure />}
          action={
            <Link to="/repository" className="text-sm font-bold text-ink underline hover:decoration-2">
              Browse repository
            </Link>
          }
        />
      ) : (
        <>
        <p className="mb-4 text-xs text-muted">
          Tip: drag a saved paper onto the pixel pet. It will dispose of
          it (zap, eat, crumple, or burn) and remove it from the library.
        </p>

        <section className="overflow-hidden rounded border-[3px] border-gray-900 bg-white" data-tips="library-shortlist">
          {entries.map(({ paper }) => {
            const subject = paper.subject_category?.split(":")[0]?.trim() ?? "";
            const isCS = subject.toLowerCase().includes("computer");

            const keywordList =
              paper.keywords
                ?.split(",")
                .map((k) => k.trim())
                .filter(Boolean) ?? [];

            return (
              <article
                key={paper.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/x-research-paper",
                    JSON.stringify({ id: paper.id, title: paper.title }),
                  );
                  event.dataTransfer.effectAllowed = "move";
                  // The drag ghost is the pet's current form.
                  event.dataTransfer.setDragImage(
                    petDragImage(form.variant),
                    48,
                    48,
                  );
                }}
                title="Drag me onto the pet to dispose of this paper"
                className="paper-row border-b border-gray-200 p-4 last:border-b-0"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    {/* Metadata Header with Tags */}
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      {subject ? (
                        <span
                          className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 text-xs font-bold text-ink"
                        >
                          {isCS
                            ? "CS"
                            : subject === "Mathematics"
                              ? "Math"
                              : subject}
                        </span>
                      ) : (
                        <span
                          title="No subject assigned yet; the classifier couldn't place this one."
                          className="rounded border-[2px] border-dashed border-gray-900 bg-white px-1.5 py-0.5 text-xs font-bold text-muted"
                        >
                          Unfiled
                        </span>
                      )}
                      <span className="text-muted">
                        {paper.publication_year ?? "—"}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="text-muted">
                        {paper.citation_count ?? 0} cited
                      </span>
                    </div>

                    {/* Clickable Title */}
                    <button
                      type="button"
                      onClick={() => handleOpenPaper(paper)}
                      title="Open paper"
                      className="paper-title block text-left"
                    >
                      <MathText text={paper.title} />
                    </button>

                    <p className="mt-1 text-xs text-muted">
                      {paper.author ?? "Unknown author"}
                    </p>

                    {paper.abstract && (
                      <p className="mt-2 line-clamp-2 max-w-3xl text-xs leading-5 text-muted">
                        <MathText text={paper.abstract} />
                      </p>
                    )}

                    {/* Keywords List */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {keywordList.slice(0, 2).map((k) => (
                        <span
                          key={k}
                          className="rounded border-[2px] border-gray-900 bg-white px-2 py-0.5 text-xs font-bold text-ink"
                        >
                          {k}
                        </span>
                      ))}
                      {keywordList.length > 2 && (
                        <span className="text-xs text-muted">
                          +{keywordList.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions - Vertically centered */}
                  <div className="paper-actions flex items-center gap-2 shrink-0 lg:mt-0 lg:justify-end">
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={!paper.is_valid_for_recommendation}
                      title={
                        paper.is_valid_for_recommendation
                          ? undefined
                          : "This paper is missing required fields for recommendation"
                      }
                      onClick={() => handleFindSimilar(paper.id)}
                    >
                      Find Similar
                    </Button>

                    <Button
                      variant="quiet"
                      type="button"
                      onClick={() => handleOpenPaper(paper)}
                    >
                      View
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleRemove(paper.id)}
                      className="inline-flex h-9 items-center justify-center rounded border-[3px] border-gray-900 bg-white px-3 text-sm font-semibold text-ink hover:bg-accent hover:text-onAccent transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        </>
      )}

      {/* PDF Viewer Modal */}
<PaperViewerModal
  paper={selectedPaper}
  open={isViewerOpen}
  onClose={handleClosePaper}
  onPaperUpdated={(updated) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.paper.id === updated.id ? { ...entry, paper: updated } : entry
      )
    );
    setSelectedPaper(updated);
  }}
/>
    </PageShell>
  );
}