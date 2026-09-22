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
      className="border-b border-gold/30 bg-gold/10 px-6 py-3"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gold">
            Recommendation index needs updating
          </p>

          <p className="mt-0.5 text-xs text-muted">
            New or modified papers have been added since the last rebuild.
          </p>
        </div>

        <RecommendationRebuildButton onRebuilt={onRebuilt} />
      </div>
    </div>
  );
}