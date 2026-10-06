/* ============================================================
   FREQ BARS — a pixel-styled frequency distribution bar chart.

   Used by the Arena's win tally (wins per pipeline), its battle
   history (winner-score histogram), and the Lab leaderboard
   (wins per recipe). Bars are drawn with the same 3px ink border
   and accent fills as the rest of the retro UI; counts sit above
   each bar and truncated labels below, so columns stay aligned
   even when codenames are long.
   ============================================================ */

export interface FreqDatum {
  label: string;
  value: number;
  /** Tailwind background class for the bar (defaults to accent). */
  colorClass?: string;
}

export default function FreqBars({
  data,
  height = 96,
  ariaLabel,
}: {
  data: FreqDatum[];
  /** Chart height in CSS pixels (bars scale to the peak). */
  height?: number;
  ariaLabel: string;
}) {
  if (data.length === 0) return null;

  const peak = Math.max(1, ...data.map((datum) => datum.value));
  const maxBar = Math.max(6, height - 26);

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((datum) => {
          const barHeight = Math.max(
            datum.value > 0 ? 4 : 2,
            Math.round((datum.value / peak) * maxBar),
          );

          return (
            <div
              key={datum.label}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${datum.label}: ${datum.value}`}
            >
              <span className="font-mono text-[10px] font-bold leading-none text-ink">
                {datum.value}
              </span>

              <div
                aria-hidden="true"
                className={`w-full rounded-t border-[2px] border-b-0 border-gray-900 ${
                  datum.colorClass ?? "bg-accent"
                }`}
                style={{ height: `${barHeight}px` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex gap-1.5 border-t-[2px] border-gray-900 pt-1">
        {data.map((datum) => (
          <span
            key={datum.label}
            className="min-w-0 flex-1 truncate text-center font-mono text-[9px] uppercase tracking-wide text-muted"
            title={datum.label}
          >
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
