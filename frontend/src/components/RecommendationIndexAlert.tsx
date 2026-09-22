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
    <div
      role="alert"
      className="flex items-center justify-between gap-4 px-4 py-3"
    >
      <div>
        <p className="font-medium">
          Recommendation index needs updating
        </p>

        <p className="text-sm">
          New or modified papers have been added since the last rebuild.
        </p>
      </div>

      <RecommendationRebuildButton onRebuilt={onRebuilt} />
    </div>
  );
}