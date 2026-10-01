import { BlockCursor } from "./PixelIcons";

/* ============================================================
   PIXEL PROGRESS — the game-style job meter.
   A track of "energy cells" that charge up one by one, with a
   stage label and a blinking block cursor.

   - `value` 0..1 drives the cells (null/undefined = indeterminate
     scanner mode for jobs whose length is unknown).
   - `stage` shows the current phase ("FITTING TF-IDF").
   - `done` snaps the cells bright and flashes them.
   ============================================================ */

interface PixelProgressProps {
  value?: number | null;
  stage?: string | null;
  done?: boolean;
  cellCount?: number;
  className?: string;
}

export default function PixelProgress({
  value,
  stage = null,
  done = false,
  cellCount = 16,
  className = "",
}: PixelProgressProps) {
  const indeterminate = value == null;

  const charged =
    indeterminate || done
      ? cellCount
      : Math.max(
          1,
          Math.min(cellCount, Math.ceil((value ?? 0) * cellCount)),
        );

  return (
    <div className={`w-full ${className}`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          indeterminate || done ? undefined : Math.round((value ?? 0) * 100)
        }
        aria-label={stage ?? "Progress"}
        className={`pixel-progress-track rounded ${
          done ? "pixel-progress-done" : ""
        }`}
      >
        {indeterminate ? (
          <div className="relative h-4 w-full overflow-hidden">
            <span className="pixel-scan absolute top-0 h-full w-1/4 rounded-sm bg-accent/80" />
          </div>
        ) : (
          Array.from({ length: cellCount }, (_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={`pixel-progress-cell h-4 rounded-sm ${
                index < charged ? "pixel-progress-cell-on" : ""
              }`}
            />
          ))
        )}
      </div>

      <p className="mt-1.5 flex items-center gap-1 font-mono text-xs font-bold tracking-[0.15em] text-muted">
        <span className={done ? "text-accent" : ""}>
          {done
            ? "COMPLETE"
            : stage ?? (indeterminate ? "WORKING…" : "PROGRESS")}
        </span>
        {!done && (
          <BlockCursor className="animate-blink inline-block h-[0.9em] w-[0.55em] text-accent" />
        )}
      </p>
    </div>
  );
}