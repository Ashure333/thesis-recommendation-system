import { useState } from "react";
import { pipelineConfigs } from "../../data/pipelineConfigs";
import WeightBar from "../../components/WeightBar";
export default function Evaluation() {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line text-center">
      <div>
        <p className="text-sm text-ink">Evaluation</p>
        <p className="mt-1 text-xs text-muted">
          Design not finalized yet — placeholder route.
        </p>
      </div>
    </div>
  );
}