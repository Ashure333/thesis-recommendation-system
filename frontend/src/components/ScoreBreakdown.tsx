import { SearchResultComponents } from "../api";

interface ScoreBreakdownProps {
  components?: SearchResultComponents | null;
  className?: string;
}

const SEGMENTS = [
  { key: "tfidf", label: "TF-IDF", colorClass: "bg-tfidf" },
  { key: "sbert", label: "S-BERT", colorClass: "bg-sbert" },
  { key: "metadata", label: "Metadata", colorClass: "bg-meta" },
] as const;

/**
 * Compact per-result score breakdown: a three-segment signal bar
 * (segment widths are each component's share of the total) plus the
 * weighted contribution values. Renders nothing when there is no
 * breakdown to show, so callers can drop it in unconditionally.
 */
export default function ScoreBreakdown({
  components,
  className = "",
}: ScoreBreakdownProps) {
  if (!components) {
    return null;
  }

  const total =
    components.tfidf + components.sbert + components.metadata;

  if (total <= 0) {
    return null;
  }

  const shares = SEGMENTS.map((segment) => {
    const value = components[segment.key];

    return {
      ...segment,
      value,
      pct: (value / total) * 100,
    };
  });

  const visible = shares.filter((share) => share.pct > 0);

  return (
    <div
      className={`font-mono leading-none text-ink ${className}`}
      data-tips="score-breakdown"
    >
      <div
        role="img"
        aria-label={shares
          .map(
            (share) =>
              `${share.label} ${share.value.toFixed(2)} ` +
              `(${share.pct.toFixed(1)}%)`
          )
          .join(", ")}
        className="flex h-3 w-full overflow-hidden rounded border-[3px] border-gray-900 bg-field"
      >
        {visible.map((share) => (
          <div
            key={share.key}
            className={`${share.colorClass} border-r-[3px] border-gray-900 last:border-r-0`}
            style={{ width: `${share.pct}%` }}
            title={`${share.label} ${share.value.toFixed(2)} (${share.pct.toFixed(1)}%)`}
          />
        ))}
      </div>

      <p className="mt-1 text-[10px] text-muted">
        {shares
          .map((share) => `${share.label} ${share.value.toFixed(2)}`)
          .join(" \u00b7 ")}
      </p>
    </div>
  );
}
