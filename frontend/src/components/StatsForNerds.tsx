/**
 * STATS FOR NERDS — the mathematical pseudocode tab, shared by
 * Search, Repository, Arena, and Lab.
 *
 * Shows the ranking math for the currently active pipeline (preset
 * or the Lab's custom dial recipe), opened by default, plus a short
 * page-specific context note and optional extra sections.
 */

import type { ReactNode } from "react";

import {
  customPipelineConfig,
  pipelineConfigs,
} from "../data/pipelineConfigs";
import { usePipelineMode } from "../state/pipelineMode";
import PipelineMath, {
  type PipelineMathInputs,
} from "./PipelineMath";

export default function StatsForNerds({
  inputs = null,
  contextNote,
  hideHeader = false,
  children,
}: {
  inputs?: PipelineMathInputs | null;
  contextNote?: string;
  /** Hide the intro header (embeds inside a pane that has its own). */
  hideHeader?: boolean;
  children?: ReactNode;
}) {
  const { pipelineId, customWeights } = usePipelineMode();

  const activeConfig =
    pipelineId === "custom"
      ? customPipelineConfig(customWeights)
      : pipelineConfigs.find((config) => config.id === pipelineId) ??
        pipelineConfigs[pipelineConfigs.length - 1];

  return (
    <div
      className="flex flex-col gap-4"
      data-stats-for-nerds
    >
      {!hideHeader && (
        <header className="rounded border-[3px] border-gray-900 bg-white p-5">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Stats for Nerds
          </p>

          <h2 className="font-pixelify mt-1 text-2xl font-bold leading-none text-ink">
            The maths behind the numbers
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {contextNote ??
              "The active pipeline, its weights, and the exact pseudocode that produced the numbers on this page."}
          </p>

          <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded border-[2px] border-gray-900 bg-canvas px-2 py-1 font-mono text-xs font-bold text-ink">
            MODE: {activeConfig.codename}
            <span className="font-normal text-muted">{pipelineId}</span>
          </p>
        </header>
      )}

      {hideHeader && contextNote && (
        <p className="text-xs leading-5 text-muted">{contextNote}</p>
      )}

      <PipelineMath
        pipelineId={pipelineId}
        configOverride={activeConfig}
        weights={pipelineId === "custom" ? customWeights : undefined}
        inputs={inputs}
        defaultOpen
      />

      {children}
    </div>
  );
}
