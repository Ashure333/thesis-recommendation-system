import { useState } from "react";
import { rebuildRecommendationIndex } from "../api";

interface RecommendationRebuildButtonProps {
  onRebuilt?: () => void;
}

export default function RecommendationRebuildButton({
  onRebuilt,
}: RecommendationRebuildButtonProps) {
  const [isRebuilding, setIsRebuilding] = useState(false);

  const handleRebuild = async () => {
    try {
      setIsRebuilding(true);

      await rebuildRecommendationIndex();

      onRebuilt?.();
    } catch (error) {
      console.error(
        "Recommendation rebuild failed:",
        error
      );
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRebuild}
      disabled={isRebuilding}
      className="shrink-0 rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold hover:border-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isRebuilding
        ? "Rebuilding..."
        : "Rebuild Index"}
    </button>
  );
}

