import { PipelineWeight } from "../data/pipelineConfigs";

/* Level-1 surface: white fill, 3px gray-900 outline, 4px radius, no slab.
   Segments are separated by the same 3px ink line, so the split reads
   from the outline language rather than from colour alone. */
export default function WeightBar({ weights }: { weights: PipelineWeight[] }) {
  // A 0% segment would still draw its 3px divider, so skip it.
  const visible = weights.filter((w) => w.pct > 0);

  return (
    <div
      role="img"
      aria-label={weights.map((w) => `${w.name} ${w.pct}%`).join(", ")}
      className="flex h-4 w-full overflow-hidden rounded border-[3px] border-gray-900 bg-white"
    >
      {visible.map((w) => (
        <div
          key={w.name}
          className={`${w.colorClass} border-r-[3px] border-gray-900 last:border-r-0`}
          style={{ width: `${w.pct}%` }}
          title={`${w.name} ${w.pct}%`}
        />
      ))}
    </div>
  );
}
