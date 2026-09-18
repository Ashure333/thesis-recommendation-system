import { PipelineWeight } from "../data/pipelineConfigs";

export default function WeightBar({ weights }: { weights: PipelineWeight[] }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line">
      {weights.map((w) => (
        <div
          key={w.name}
          className={w.colorClass}
          style={{ width: `${w.pct}%` }}
          title={`${w.name} ${w.pct}%`}
        />
      ))}
    </div>
  );
}
