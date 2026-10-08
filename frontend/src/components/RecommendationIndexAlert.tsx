import RecommendationRebuildButton from "./RecommendationRebuildButton";

interface RecommendationIndexAlertProps {
  visible: boolean;
  onRebuilt?: () => void;
}

export default function RecommendationIndexAlert({
  visible,
  onRebuilt,
}: RecommendationIndexAlertProps) {
  if (!visible) {
    return null;
  }

  return (
    // Sits on the cream canvas. Whitespace separates it from the page,
    // so there is no divider rule and no tinted fill.
    <div className="bg-canvas px-4 py-4 sm:px-6">
      {/* result-panel: white fill, 3px outline, 4px radius, md padding.
          No gold/red: accents are never used for state, so the alert is
          identified by role="alert" and its copy, not by color. */}
      <div
        role="alert"
        className="mx-auto flex max-w-[1400px] flex-col gap-4 rounded border-[3px] border-gray-900 bg-white p-4 text-gray-900 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-base font-bold leading-snug">
            Recommendation index needs updating
          </p>

          <p className="mt-1 text-sm text-gray-600">
            New or modified papers have been added since the last rebuild.
          </p>
        </div>

        <RecommendationRebuildButton onRebuilt={onRebuilt} />
      </div>
    </div>
  );
}
