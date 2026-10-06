/**
 * CONNECTIONS PANE — compact wrapper around the ConnectionsWorkbench
 * used by the Search right pane and the Repository record tab.
 *
 * The big tabbed workbench lives on the Search page's Connections
 * tab; this pane is the glanceable version. `onExpand` renders the
 * "Full view" affordance that jumps to the big tab.
 */

import ConnectionsWorkbench from "./ConnectionsWorkbench";
import type { DialWeights } from "../api";

export default function ConnectionsPane({
  paperId,
  pipeline,
  pipelineLabel,
  weights,
  defaultTopK,
  onExpand,
}: {
  paperId: number;
  pipeline: string;
  pipelineLabel: string;
  weights?: DialWeights;
  defaultTopK?: number;
  onExpand?: () => void;
}) {
  return (
    <ConnectionsWorkbench
      paperId={paperId}
      pipeline={pipeline}
      pipelineLabel={pipelineLabel}
      weights={weights}
      defaultTopK={defaultTopK}
      compact
      onExpand={onExpand}
    />
  );
}
