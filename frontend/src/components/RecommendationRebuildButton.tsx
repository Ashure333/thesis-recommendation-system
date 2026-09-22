import { useState } from "react";

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

      const response = await fetch(
        "http://127.0.0.1:8000/api/recommendations/rebuild",
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to rebuild recommendation index.");
      }

      onRebuilt?.();
    } catch (error) {
      console.error("Recommendation rebuild failed:", error);
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleRebuild}
      disabled={isRebuilding}
    >
      {isRebuilding ? "Rebuilding..." : "Rebuild Index"}
    </button>
  );
}