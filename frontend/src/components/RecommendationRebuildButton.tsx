import { useState } from "react";
import { rebuildRecommendationIndex } from "../api";
import { Button } from "./ui";

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
    // button-utility: white fill, 3px outline, 4px radius, body-sm.
    // Hover swaps the fill to brand orange (the fill swap is the state cue,
    // no gold tint). Secondary rather than primary because it lives inside
    // an alert panel, where a full-size orange slab button would dominate.
    <Button
      type="button"
      variant="secondary"
      onClick={handleRebuild}
      disabled={isRebuilding}
      aria-busy={isRebuilding}
      className="shrink-0"
    >
      {isRebuilding
        ? "Rebuilding..."
        : "Rebuild Index"}
    </Button>
  );
}
