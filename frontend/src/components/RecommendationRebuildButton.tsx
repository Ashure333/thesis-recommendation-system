import { useEffect, useRef, useState } from "react";
import { rebuildRecommendationIndex } from "../api";
import { Button } from "./ui";
import PixelProgress from "./retro/PixelProgress";

/* ============================================================
   RECOMMENDATION INDEX REBUILD — with a staged game-style
   progress meter. The rebuild request is one long call, so the
   meter walks through the real pipeline phases on a timer and
   snaps to COMPLETE when the request actually resolves.
   ============================================================ */

const REBUILD_STAGES = [
  "CLASSIFYING PAPERS",
  "VALIDATING METADATA",
  "PREPARING TEXT",
  "FITTING TF-IDF",
  "EMBEDDING WITH S-BERT",
  "WRITING INDEX",
];

const TICK_MS = 420;

interface RecommendationRebuildButtonProps {
  onRebuilt?: () => void;
}

export default function RecommendationRebuildButton({
  onRebuilt,
}: RecommendationRebuildButtonProps) {
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const tickerRef = useRef<number | null>(null);

  // Clean up the ticker on unmount.
  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
      }
    };
  }, []);

  async function handleRebuild() {
    try {
      setIsRebuilding(true);
      setDone(false);
      setProgress(0);

      // The meter walks the real pipeline stages while the long
      // request runs; it never shows 100% until the request ends.
      tickerRef.current = window.setInterval(() => {
        setProgress((current) => {
          const next = current + 0.015 + Math.random() * 0.03;
          if (next >= 0.96) {
            if (tickerRef.current !== null) {
              window.clearInterval(tickerRef.current);
              tickerRef.current = null;
            }
            return 0.96;
          }
          return next;
        });
      }, TICK_MS);

      await rebuildRecommendationIndex();

      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }

      setProgress(1);
      setDone(true);

      window.setTimeout(() => {
        setIsRebuilding(false);
        onRebuilt?.();
      }, 900);
    } catch (error) {
      console.error("Recommendation rebuild failed:", error);
      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      setIsRebuilding(false);
      setProgress(0);
      setDone(false);
    }
  }

  const stageIndex = Math.min(
    REBUILD_STAGES.length - 1,
    Math.floor(progress * REBUILD_STAGES.length),
  );

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      {isRebuilding && (
        <PixelProgress
          value={done ? 1 : progress}
          stage={done ? "INDEX READY" : REBUILD_STAGES[stageIndex]}
          done={done}
        />
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={handleRebuild}
        disabled={isRebuilding}
        aria-busy={isRebuilding}
        className="shrink-0"
      >
        {isRebuilding ? (done ? "Done!" : "Rebuilding…") : "Rebuild Index"}
      </Button>
    </div>
  );
}