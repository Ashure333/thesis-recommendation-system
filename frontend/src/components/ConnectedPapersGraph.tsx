import { useEffect, useMemo, useRef, useState } from "react";
import {
  getSimilarPapersGraph,
  SimilarGraphNode,
  SimilarPapersGraph,
  type ClusterWork,
  type DialWeights,
} from "../api";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import { useTheme } from "../theme";
import { CloseX } from "./retro/PixelIcons";

interface ConnectedPapersGraphProps {
  paperId: number;
  pipeline?: string;
  topK?: number;
  /** Dial allocation for pipeline="custom". */
  weights?: DialWeights;
  /** Hide the embedded prior/derivative sections (own tabs now). */
  hideClusterSections?: boolean;
  /** Hide the embedded ranked list (results live elsewhere). */
  hideRankedList?: boolean;
  /** Let the canvas grow beyond the narrow-pane width. */
  widened?: boolean;
  /** Paper ids to highlight from a focused prior/derivative work. */
  highlightPaperIds?: number[];
  /** Reports graph node selection so sibling tabs can mirror it. */
  onSelectNode?: (id: number | null) => void;
}

interface PositionedNode extends SimilarGraphNode {
  x: number;
  y: number;
  rank: number; // 0 for the current paper, 1..n for similar papers
  isDot: boolean;
}

/*
  Pipelines that can be passed in:
    "tfidf" | "sbert" | "tfidf_sbert" |
    "tfidf_metadata" | "sbert_metadata" | "tfidf_sbert_metadata"
*/

/* ============================================================
   GITINGEST DESIGN LANGUAGE
   White result-panel · 3px gray-900 outline · 4px radius · no blur
   Ink = the selected paper · Orange = hovered / selected (active state)
   Depth is a solid offset slab (4px / 4px), never a drop shadow.
   ============================================================ */

/*
  LAYOUT NOTES
  ------------
  Layout follows the algorithm Connected Papers themselves describe
  (connectedpapers.com/about): a FORCE-DIRECTED graph (d3-force)
  that visually clusters similar papers together and pushes less
  similar ones apart, so proximity encodes similarity. Selecting a
  node highlights the SHORTEST PATH back to the origin paper.

  Titles are not drawn next to nodes (long labels collide and force
  a wide minimum width). The SVG holds numbered nodes and scales to
  any width; titles live in the ranked list underneath, linked to
  the graph (hover / click either one and the other highlights).
*/
interface GraphDims {
  width: number;
  height: number;
  cx: number;
  cy: number;
}

// Compact canvas for the side panes; the big workbench tab uses a
// wider, web-matching aspect (560:440 vs 900:520) — the tall compact
// aspect pushed the details card below the fold when widened.
const COMPACT_DIMS: GraphDims = {
  width: 560,
  height: 440,
  cx: 280,
  cy: 220,
};
const WIDE_DIMS: GraphDims = { width: 900, height: 520, cx: 450, cy: 260 };

const CURRENT_RADIUS = 30;

// Extra papers fetched beyond the requested link count, rendered
// as small unlabeled dots to suggest further connections.
const SUGGESTIONS = 12;

const DOT_RADIUS = 6.5;

// Slab offset, in SVG user units (matches translate-x-1 / translate-y-1).
const SLAB = 4;
// Stroke of the chunky outline, in SVG user units.
const OUTLINE = 3;

// SVG needs concrete color values; these mirror the Tailwind tokens used elsewhere.
// All read the live CSS variables so the graph follows the active theme palette.
const COLORS = {
  ink: "rgb(var(--ink) / 1)",
  surface: "rgb(var(--surface) / 1)",
  hairline: "rgb(var(--hairline) / 1)",
  // Theme accent (amber by default) — the "orange = active" node fill.
  orange: "rgb(var(--accent) / 1)",
  // Auto-legibility text color for accent-filled nodes.
  onAccent: "rgb(var(--on-accent) / 1)",
  onInk: "rgb(var(--on-ink) / 1)",
};

function resolveAccent(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();

  return `rgb(${raw || "243 156 18"})`;
}

const FOCUS_INSET =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-gray-900";

/*
 * Force-directed layout (d3-force), as described by Connected
 * Papers: similar papers cluster together, less similar ones are
 * pushed away. The origin paper is pinned at the center. Runs a
 * fixed number of simulation ticks so the layout is deterministic
 * per graph (no animation loop, no jank).
 *
 * Edge weight drives the link forces (stronger edge -> shorter
 * rest length and higher stiffness), so proximity encodes the same
 * blended similarity the edge itself carries.
 */
type GraphEdge = [number, number, number];

function buildForceLayout(
  nodes: SimilarGraphNode[],
  edges: GraphEdge[],
  dotIds: Set<number>,
  dims: GraphDims,
): PositionedNode[] {
  const ringX = dims.width * 0.214;
  const ringY = dims.height * 0.227;

  const simNodes = nodes.map((node, index) => ({
    ...node,
    x: dims.cx + Math.cos((index / Math.max(nodes.length, 1)) * Math.PI * 2) * ringX,
    y: dims.cy + Math.sin((index / Math.max(nodes.length, 1)) * Math.PI * 2) * ringY,
    fx: node.relationship === "current" ? dims.cx : undefined,
    fy: node.relationship === "current" ? dims.cy : undefined,
    rank: 0,
    isDot: dotIds.has(node.id),
  }));

  const links = edges.map(([source, target, weight]) => ({
    source,
    target,
    weight,
  }));

  const simulation = forceSimulation(simNodes as never)
    .force(
      "link",
      forceLink(links as { source: number; target: number; weight: number }[])
        .id((node: SimulationNodeDatum) => (node as { id: number }).id)
        .distance(
          (link: { source: number; target: number; weight: number }) =>
            70 + (1 - link.weight) * 140,
        )
        .strength(
          (link: { source: number; target: number; weight: number }) =>
            0.15 + link.weight * 0.5,
        ),
    )
    .force("charge", forceManyBody().strength(-190))
    .force("center", forceCenter(dims.cx, dims.cy))
    .force(
      "collide",
      forceCollide((node: SimulationNodeDatum) => {
        const typed = node as unknown as {
          relationship: string;
          isDot: boolean;
        };

        return typed.relationship === "current"
          ? CURRENT_RADIUS + 6
          : typed.isDot
            ? DOT_RADIUS + 6
            : 18;
      }).iterations(2),
    )
    .stop();

  // Deterministic settle — enough ticks for the layout to relax.
  simulation.tick(200);

  // Ranks follow similarity order, not layout position.
  let rank = 0;
  for (const node of simNodes) {
    if (node.relationship === "similar") {
      rank += 1;
      node.rank = rank;
    }
  }

  return simNodes as PositionedNode[];
}

// Similarity is encoded by size only (no tinted washes), so the fills stay
// flat: white = idle, orange = active, ink = the paper being compared.
function getNodeRadius(node: PositionedNode, min: number, max: number) {
  if (node.relationship === "current") {
    return CURRENT_RADIUS;
  }

  const span = Math.max(max - min, 0.0001);
  const t = (node.similarity - min) / span;

  return 15 + t * 6;
}

/* ---------- Shared bits ---------- */

function PanelTitle({ children }: { children: string }) {
  return (
    <h3 className="text-xl font-bold leading-snug text-gray-900">{children}</h3>
  );
}

export default function ConnectedPapersGraph({
  paperId,
  pipeline = "tfidf_sbert_metadata",
  topK = 10,
  weights,
  hideClusterSections = false,
  hideRankedList = false,
  widened = false,
  highlightPaperIds,
  onSelectNode,
}: ConnectedPapersGraphProps) {
  const [graph, setGraph] = useState<SimilarPapersGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  // Selected prior/derivative work: highlights the graph papers that
  // reference it (or are cited by it), and vice versa.
  const [activeWorkKey, setActiveWorkKey] = useState<string | null>(null);
  const dims = widened ? WIDE_DIMS : COMPACT_DIMS;
  const { accent } = useTheme();
  const [accentColor, setAccentColor] = useState(resolveAccent);

  useEffect(() => {
    setAccentColor(resolveAccent());
  }, [accent]);

  // Dial drags emit a stream of weight objects — fetch only after
  // the user settles (~600ms), so the graph doesn't re-request per
  // pointer move.
  const [debouncedWeights, setDebouncedWeights] =
    useState(weights);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedWeights(weights);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [weights]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setGraph(null);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setActiveWorkKey(null);

    getSimilarPapersGraph(
      paperId,
      pipeline,
      topK + SUGGESTIONS,
      debouncedWeights,
    )
      .then((data) => {
        if (cancelled) {
          return;
        }

        setGraph(data);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to load similar papers.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paperId, pipeline, topK, debouncedWeights]);

  const currentNode = useMemo(
    () => graph?.nodes.find((node) => node.relationship === "current"),
    [graph],
  );

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    if (!graph) {
      return [];
    }

    const similarNodes = graph.nodes.filter(
      (node) => node.relationship === "similar",
    );

    const labeled = similarNodes.slice(0, topK);
    const dots = similarNodes.slice(topK);
    const dotIds = new Set(dots.map((node) => node.id));

    const allNodes = currentNode ? [currentNode, ...similarNodes] : similarNodes;

    return buildForceLayout(allNodes, graph.edges, dotIds, dims);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, currentNode, topK, widened]);

  const nodeMap = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );

  const rankedNodes = useMemo(
    () => positionedNodes.filter((node) => node.relationship === "similar"),
    [positionedNodes],
  );

  // The first `topK` similar papers are full labeled nodes; the
  // rest become small suggestion dots.
  const labeledNodes = useMemo(
    () => rankedNodes.slice(0, topK),
    [rankedNodes, topK],
  );

  const dotNodes = useMemo(
    () => rankedNodes.slice(topK),
    [rankedNodes, topK],
  );

  const dotIdSet = useMemo(
    () => new Set(dotNodes.map((node) => node.id)),
    [dotNodes],
  );

  const similarityRange = useMemo(() => {
    if (labeledNodes.length === 0) {
      return { min: 0, max: 1 };
    }

    const values = labeledNodes.map((node) => node.similarity);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [labeledNodes]);

  const activeId = hoveredNodeId ?? selectedNodeId;

  const toggleSelected = (id: number) => {
    setSelectedNodeId((prev) => (prev === id ? null : id));
    onSelectNode?.(selectedNodeId === id ? null : id);
  };

  // ----------------------------------------------------------
  // CLICK-TO-ZOOM — selecting a node animates the canvas toward it
  // (scale + recenter) and raises its details card.
  // ----------------------------------------------------------

  const ZOOM_SCALE = 1.9;

  const zoomNode = useMemo(
    () =>
      selectedNodeId === null
        ? null
        : positionedNodes.find((node) => node.id === selectedNodeId) ??
          null,
    [positionedNodes, selectedNodeId]
  );

  const zoomStyle = useMemo(() => {
    const transition =
      "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";

    if (!zoomNode) {
      return {
        transform: "translate(0px, 0px) scale(1)",
        transition,
        transformBox: "view-box" as const,
        transformOrigin: "0 0",
      };
    }

    return {
      transform: `translate(${dims.cx - ZOOM_SCALE * zoomNode.x}px, ${
        dims.cy - ZOOM_SCALE * zoomNode.y
      }px) scale(${ZOOM_SCALE})`,
      transition,
      transformBox: "view-box" as const,
      transformOrigin: "0 0",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomNode, widened]);

  // ----------------------------------------------------------
  // FOCUSED DETAILS POP-UP — auto-focused like the pet's
  // right-click menu; Escape or a click anywhere outside dismisses
  // it, and the canvas zooms back out with the same animation.
  // ----------------------------------------------------------

  const detailsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedNodeId !== null) {
      detailsRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
      detailsRef.current?.focus({ preventScroll: true });
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId === null) {
      return;
    }

    function dismiss() {
      setSelectedNodeId(null);
      onSelectNode?.(null);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Element | null;

      if (detailsRef.current?.contains(target as Node)) {
        return;
      }

      // Node clicks handle their own selection toggle.
      if (target?.closest?.("g[role=button]")) {
        return;
      }

      dismiss();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedNodeId, onSelectNode]);

  // ----------------------------------------------------------
  // SHORTEST PATH from the origin paper to the active node —
  // the Connected Papers signature: highlight the similarity
  // route on selection. The server computes the route as a
  // weighted Dijkstra over the edge list (hop cost = 1 - weight),
  // so what highlights is the real similarity route rather than
  // a plain fewest-hops walk.
  // ----------------------------------------------------------

  const activePathKeys = useMemo(() => {
    if (activeId == null || !graph) {
      return new Set<string>();
    }

    const activeNode = graph.nodes.find((node) => node.id === activeId);
    const path = activeNode?.path ?? [];
    const pathKeys = new Set<string>();

    for (let index = 0; index + 1 < path.length; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      pathKeys.add(`${Math.min(from, to)}-${Math.max(from, to)}`);
    }

    return pathKeys;
  }, [graph, activeId]);

  // Graph papers highlighted by the selected prior/derivative work.
  const workHighlightIds = useMemo(() => {
    const ids = new Set<number>(highlightPaperIds ?? []);

    if (!graph || activeWorkKey === null) {
      return ids;
    }

    const work = [
      ...graph.prior_works,
      ...graph.derivative_works,
    ].find((entry) => entry.work_id === activeWorkKey);

    for (const id of work?.graph_paper_ids ?? []) {
      ids.add(id);
    }

    return ids;
  }, [graph, activeWorkKey, highlightPaperIds]);

  const hasWorkFocus = activeWorkKey !== null || workHighlightIds.size > 0;

  /* ---------- LOADING / ERROR / EMPTY ---------- */

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="px-4 py-5 text-gray-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <PanelTitle>Similar Papers</PanelTitle>
            <p className="mt-1 text-sm text-gray-600">
              Building similarity graph from your repository…
            </p>
          </div>

          {/* small circular indicator: the one place `rounded-full` is allowed */}
          <div
            aria-hidden="true"
            className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-gray-900 border-t-transparent motion-reduce:animate-none"
          />
        </div>
      </div>
    );
  }

  if (error) {
    // No red: accents are never used for state. Ink text in an outlined panel.
    return (
      <div role="alert" className="px-4 py-4 text-gray-900">
        <PanelTitle>Similar Papers</PanelTitle>
        <p className="mt-1 text-sm font-medium leading-normal text-gray-900">
          {error}
        </p>
      </div>
    );
  }

  if (!graph || graph.nodes.length <= 1) {
    return (
      <div className="px-4 py-4 text-gray-900">
        <PanelTitle>Similar Papers</PanelTitle>
        <p className="mt-1 text-sm text-gray-600">
          No similar papers were found in the repository.
        </p>
      </div>
    );
  }

  const relatedCount =
    labeledNodes.length + dotNodes.length;

  return (
    <div className="overflow-hidden text-gray-900">
      {/* HEADER */}
      <div className="px-4 py-4">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <PanelTitle>Similar Papers</PanelTitle>

            <p className="mt-1 text-sm text-gray-600">
              Similar papers cluster together. Selecting a node
              highlights the similarity path back to the origin.
            </p>
          </div>

          {/* Responsive related-paper indicator: follows the right panel width
              without stealing enough space to force the title onto two lines. */}
          <span
            className="shrink-0 rounded border-[3px] border-gray-900 bg-white px-2 py-0.5 text-center text-sm font-bold leading-snug"
            style={{
              width: "clamp(72px, 22%, 140px)",
            }}
          >
            {graph.nodes.length - 1} related
          </span>
        </div>
      </div>

      {/* GRAPH: sits on the cream canvas so it reads as "inside" the panel */}
      <div className="relative border-t-[3px] border-gray-900 bg-canvas px-2 py-3">
        <svg
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          className={`mx-auto block h-auto w-full ${
            widened ? "max-w-[960px]" : "max-w-[520px]"
          }`}
          role="img"
          aria-label="Similar papers graph"
          onMouseLeave={() => setHoveredNodeId(null)}
        >
          {/* ZOOM LAYER — click a node to scale/recenter here */}
          <g style={zoomStyle}>
          {/* CONNECTIONS — weighted triples [source, target, weight] */}
          {graph.edges.map(([sourceId, targetId, weight], edgeIndex) => {
            const source = nodeMap.get(sourceId);
            const target = nodeMap.get(targetId);

            if (!source || !target) {
              return null;
            }

            const edgeKey = `${Math.min(sourceId, targetId)}-${Math.max(
              sourceId,
              targetId,
            )}`;

            const onPath = activePathKeys.has(edgeKey);

            const touchesActive =
              activeId !== null &&
              (activeId === sourceId || activeId === targetId);

            const touchesWork =
              hasWorkFocus &&
              (workHighlightIds.has(sourceId) ||
                workHighlightIds.has(targetId));

            const dimmed =
              (activeId !== null && !onPath && !touchesActive) ||
              (hasWorkFocus && !touchesWork);

            const touchesDot =
              dotIdSet.has(sourceId) || dotIdSet.has(targetId);

            // The similarity route (shortest weighted path from the
            // origin to the active node) draws in thick ink; every
            // other edge scales thickness and opacity with its weight
            // so stronger relations read as stronger lines;
            // suggestion-dot edges stay thin and faint.
            const stroke =
              onPath || touchesActive || touchesWork
                ? COLORS.ink
                : COLORS.hairline;

            const width = onPath
              ? OUTLINE
              : touchesActive || touchesWork
                ? 2 + weight * 2
                : touchesDot
                  ? 1
                  : 1 + weight * 1.5;

            return (
              <line
                key={`${sourceId}-${targetId}`}
                className="graph-edge-in"
                style={{
                  animationDelay: `${Math.min(edgeIndex, 60) * 30}ms`,
                  transition: "opacity 100ms",
                }}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="butt"
                opacity={
                  dimmed
                    ? 0.2
                    : onPath
                      ? 1
                      : touchesDot
                        ? 0.5
                        : 0.55 + weight * 0.45
                }
              />
            );
          })}

          {/* NODES */}
          {positionedNodes.map((node) => {
            const isCurrent = node.relationship === "current";
            const isActive = activeId === node.id;
            const isSelected = selectedNodeId === node.id;

            const onPath =
              activeId != null &&
              !isActive &&
              !isCurrent &&
              Array.from(activePathKeys).some((key) => {
                const [a, b] = key.split("-").map(Number);
                return a === node.id || b === node.id;
              });

            const dimmed =
              (activeId !== null &&
                !isActive &&
                !isCurrent &&
                !onPath) ||
              (hasWorkFocus &&
                !workHighlightIds.has(node.id) &&
                !isCurrent);

            const radius = getNodeRadius(
              node,
              similarityRange.min,
              similarityRange.max,
            );

            // Flat fills only: ink = compared paper, orange = active / on
            // the similarity path / highlighted by a selected work,
            // white = idle.
            const fill = isCurrent
              ? COLORS.ink
              : isActive ||
                  isSelected ||
                  onPath ||
                  workHighlightIds.has(node.id)
                ? accentColor
                : COLORS.surface;

            // Slab only on the high-priority nodes (level-2 elevation).
            const hasSlab = isCurrent || isSelected;

            return (
              <g
                key={node.id}
                style={{
                  animationDelay: `${Math.min(node.rank, 60) * 45}ms`,
                  transition: "opacity 100ms",
                }}
                role="button"
                tabIndex={0}
                aria-label={
                  isCurrent
                    ? `Current paper: ${node.title}`
                    : `Rank ${node.rank}: ${node.title}, ${(
                        node.similarity * 100
                      ).toFixed(1)} percent similar`
                }
                aria-pressed={isSelected}
                onClick={() => toggleSelected(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleSelected(node.id);
                  }
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId(null)}
                className="graph-node-in cursor-pointer outline-none"
                opacity={dimmed ? 0.4 : 1}
              >
                {/* offset slab: a second solid layer, same shape, no blur */}
                {hasSlab && (
                  <circle
                    cx={node.x + SLAB}
                    cy={node.y + SLAB}
                    r={radius}
                    fill={COLORS.ink}
                    stroke={COLORS.ink}
                    strokeWidth={OUTLINE}
                  />
                )}

                {/* body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={fill}
                  stroke={COLORS.ink}
                  strokeWidth={OUTLINE}
                  className={isCurrent ? "graph-current-pulse" : ""}
                />

                {isCurrent ? (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={8}
                    fill={COLORS.surface}
                    pointerEvents="none"
                  />
                ) : (
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={700}
                    fill={
                      isActive || isSelected
                        ? COLORS.onAccent
                        : COLORS.ink
                    }
                    pointerEvents="none"
                  >
                    {node.rank}
                  </text>
                )}
              </g>
            );
          })}

          {/* SUGGESTION DOTS — smaller nodes hinting at further connections */}
          {dotNodes.map((node, index) => (
            <circle
              key={`dot-${node.id}`}
              className="graph-dot-in"
              style={{
                animationDelay: `${(topK + index) * 30}ms`,
              }}
              cx={node.x}
              cy={node.y}
              r={DOT_RADIUS}
              fill={COLORS.surface}
              stroke={COLORS.ink}
              strokeWidth={2}
              opacity={0.85}
              pointerEvents="none"
              aria-hidden="true"
            />
          ))}
                  </g>
        </svg>

        {/* NODE DETAILS — raised while a node is zoomed in */}
        {zoomNode && (
          <div
            ref={detailsRef}
            data-node-details
            role="dialog"
            aria-label="Paper details"
            tabIndex={-1}
            className="animate-step-in pointer-events-none absolute bottom-3 left-3 right-3 z-10 rounded border-[3px] border-gray-900 bg-white p-3 shadow-[4px_4px_0_rgba(0,0,0,0.25)] focus:outline-none sm:right-auto sm:max-w-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[2px] border-gray-900 bg-gray-900 font-mono text-xs font-bold text-white">
                {zoomNode.relationship === "current" ? "★" : zoomNode.rank}
              </span>

              <button
                type="button"
                aria-label="Close details and zoom out"
                onClick={() => toggleSelected(zoomNode.id)}
                className="pointer-events-auto rounded border-2 border-gray-900 bg-white px-1.5 py-0.5 text-gray-900 transition-colors pixel-ease hover:bg-accent hover:text-onAccent"
              >
                <CloseX className="h-3 w-3" />
              </button>
            </div>

            <p className="mt-1.5 text-sm font-bold leading-snug text-gray-900">
              {zoomNode.title}
            </p>

            <p className="mt-0.5 text-xs text-gray-600">
              {zoomNode.author || "Unknown author"}
              {zoomNode.publication_year
                ? `, ${zoomNode.publication_year}`
                : ""}
              {zoomNode.relationship === "current"
                ? " · center paper"
                : ` · ${(zoomNode.similarity * 100).toFixed(1)}% similar`}
            </p>

            {zoomNode.doi && (
              <p className="mt-1">
                <a
                  href={`https://doi.org/${zoomNode.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto break-all text-xs text-accent underline"
                >
                  doi.org/{zoomNode.doi}
                </a>
              </p>
            )}

            {zoomNode.abstract && (
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-gray-600">
                {zoomNode.abstract}
              </p>
            )}
          </div>
        )}

        {/* LEGEND */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-sm text-gray-900">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border-[3px] border-gray-900 bg-gray-900"
            />
            Selected paper
          </span>

          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border-[3px] border-gray-900 bg-white"
            />
            Similar (numbered by rank)
          </span>

          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-4 w-4 rounded-full border-[3px] border-gray-900 bg-accent"
            />
            Highlighted
          </span>
        </div>
      </div>

      {/* SHARED GROUPS — the reference model's common_authors /
          common_topics collections (topics stand in for its
          bibliographic-coupling groups; this corpus has no
          reference lists). */}
      {(graph.common_topics.length > 0 || graph.common_authors.length > 0) && (
        <div className="border-t-[3px] border-gray-900 bg-white px-4 py-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-600">
            Shared across the graph
          </p>

          <div className="flex flex-wrap gap-1.5">
            {graph.common_topics.slice(0, 6).map((group) => (
              <span
                key={`topic-${group.name}`}
                title={`${group.edges_count} papers share this topic`}
                className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 text-xs font-bold text-gray-900"
              >
                {group.name}
                <span className="ml-1 text-gray-600">
                  ×{group.edges_count}
                </span>
              </span>
            ))}

            {graph.common_authors.slice(0, 4).map((group) => (
              <span
                key={`author-${group.name}`}
                title={`${group.edges_count} papers list this author`}
                className="rounded border-[2px] border-gray-900 bg-accent px-1.5 py-0.5 text-xs font-bold text-onAccent"
              >
                {group.name}
                <span className="ml-1">×{group.edges_count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PRIOR / DERIVATIVE WORKS — hidden in the workbench layout,
          where each list has its own tab. */}
      {!hideClusterSections && (
        <>
          <ClusterSection
            title="Prior works"
            description="Papers that were most commonly cited by the papers in this graph — usually the seminal works of the field. Selecting one highlights the graph papers referencing it; selecting a graph paper highlights its referenced prior work."
            works={graph.prior_works}
            side="prior"
            startId={graph.start_id}
            activeKey={activeWorkKey}
            onSelect={setActiveWorkKey}
            nodeMap={nodeMap}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setHoveredNodeId(null);
            }}
          />

          <ClusterSection
            title="Derivative works"
            description="Papers that cited many of the papers in this graph — usually surveys of the field or recent works inspired by many papers in the graph. Selecting one highlights the graph papers it cites; selecting a graph paper highlights the derivative works citing it."
            works={graph.derivative_works}
            side="derivative"
            startId={graph.start_id}
            activeKey={activeWorkKey}
            onSelect={setActiveWorkKey}
            nodeMap={nodeMap}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setHoveredNodeId(null);
            }}
          />
        </>
      )}

      {/* CENTER PAPER */}
      {currentNode && (
        <div className="border-t-[3px] border-gray-900 bg-white px-4 py-3">
          <p className="text-sm text-gray-600">Comparing against</p>
          <p className="mt-0.5 text-sm font-bold leading-snug text-gray-900">
            {currentNode.title}
          </p>
        </div>
      )}

      {/* RANKED LIST — hidden in the workbench layout (results
          live in the main list / prior-derivative tabs). */}
      {!hideRankedList && (
        <ol
          className="border-t-[3px] border-gray-900"
          onMouseLeave={() => setHoveredNodeId(null)}
        >
          {rankedNodes.map((node) => {
            const isActive =
              activeId === node.id || workHighlightIds.has(node.id);
            const isSelected = selectedNodeId === node.id;
            const percent = node.similarity * 100;

            return (
              <li
                key={node.id}
                // hairline: the one incidental separator in the design language
                className="border-b border-gray-200 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => toggleSelected(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onFocus={() => setHoveredNodeId(node.id)}
                  onBlur={() => setHoveredNodeId(null)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left text-gray-900 transition-colors duration-100 motion-reduce:transition-none ${FOCUS_INSET} ${
                    isActive ? "bg-accent" : "bg-white"
                  }`}
                >
                  {/* rank chip: circular indicator, ink when selected */}
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] border-gray-900 text-sm font-bold leading-none ${
                      isSelected
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-900"
                    }`}
                  >
                    {node.rank}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm leading-snug text-gray-900 ${
                        isSelected ? "font-bold" : "line-clamp-2 font-medium"
                      }`}
                    >
                      {node.title}
                    </span>

                    {isSelected && (
                      <span className="mt-0.5 block text-sm text-gray-900">
                        {node.author || "Unknown author"}
                        {node.publication_year
                          ? `, ${node.publication_year}`
                          : ""}
                      </span>
                    )}

                    {/* similarity bar: same construction as WeightBar */}
                    <span className="mt-2 flex items-center gap-3">
                      <span className="h-3 flex-1 overflow-hidden rounded border-[3px] border-gray-900 bg-field">
                        <span
                          className="block h-full bg-gray-900"
                          style={{
                            width: `${Math.max(2, Math.min(100, percent))}%`,
                            transition: "width 100ms linear",
                          }}
                        />
                      </span>

                      <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">
                        {percent.toFixed(1)}%
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

      )}

      {/* FOOTER */}
      <div className="border-t-[3px] border-gray-900 bg-white px-4 py-3">
        <p className="text-sm leading-normal text-gray-600">
          Similarity is calculated using the selected recommendation pipeline
          against papers already stored in the repository.
        </p>

        {dotNodes.length > 0 && (
          <p className="mt-1.5 text-xs leading-normal text-gray-600">
            {hideRankedList
              ? `The small dots suggest ${dotNodes.length} further related papers — raise the link count to include them.`
              : `The small dots suggest ${dotNodes.length} further related papers beyond the ranked list. Raise the link count to include them.`}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   CLUSTERED WORKS — prior / derivative sections
   ============================================================ */

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadClusterCsv(title: string, works: ClusterWork[]) {
  const lines = [
    "work_id,label,doi,mentions,graph_paper_ids",
    ...works.map((work) =>
      [
        work.work_id,
        csvEscape(work.label),
        work.doi ?? "",
        work.count,
        work.graph_paper_ids.join(" "),
      ].join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ClusterSection({
  title,
  description,
  works,
  side,
  startId,
  activeKey,
  onSelect,
  nodeMap,
  onSelectNode,
}: {
  title: string;
  description: string;
  works: ClusterWork[];
  side: "prior" | "derivative";
  startId: number;
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  nodeMap: Map<number, PositionedNode>;
  onSelectNode: (id: number) => void;
}) {
  return (
    <div
      className="border-t-[3px] border-gray-900 bg-white px-4 py-3"
      data-cluster={side}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{title}</p>

          <p className="mt-1 text-xs leading-normal text-gray-600">
            {description}
          </p>
        </div>

        {works.length > 0 && (
          <button
            type="button"
            onClick={() => downloadClusterCsv(title, works)}
            className="shrink-0 rounded border-[2px] border-gray-900 bg-white px-2 py-1 text-xs font-bold text-gray-900 transition-colors hover:bg-accent hover:text-onAccent"
          >
            Download
          </button>
        )}
      </div>

      {works.length === 0 ? (
        <p className="mt-2 text-xs leading-normal text-gray-600">
          No shared {side === "prior" ? "references" : "citers"} are
          cached for this graph yet — refresh a paper's citations from
          its record page to fill this in.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {works.map((work) => {
            const isActive = activeKey === work.work_id;

            return (
              <li
                key={work.work_id}
                className={`border-b border-gray-200 px-1 py-2 last:border-b-0 ${
                  isActive ? "bg-accent" : "bg-white"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    onSelect(isActive ? null : work.work_id)
                  }
                  className="flex w-full items-baseline justify-between gap-2 text-left"
                >
                  <span
                    className={`min-w-0 flex-1 text-sm leading-snug ${
                      isActive
                        ? "font-bold text-onAccent"
                        : "text-gray-900"
                    }`}
                  >
                    {work.label}
                  </span>

                  <span
                    className={`shrink-0 text-xs font-bold ${
                      isActive ? "text-onAccent" : "text-gray-600"
                    }`}
                    title={`${work.count} graph papers`}
                  >
                    ×{work.count}
                  </span>
                </button>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`text-xs ${
                      isActive ? "text-onAccent" : "text-gray-600"
                    }`}
                  >
                    {side === "prior" ? "referenced by" : "cites"}
                  </span>

                  {work.graph_paper_ids.map((paperId) => {
                    const node = nodeMap.get(paperId);

                    return (
                      <button
                        key={paperId}
                        type="button"
                        onClick={() => onSelectNode(paperId)}
                        className={`rounded border-[2px] px-1 py-0.5 text-xs font-bold ${
                          isActive
                            ? "border-onAccent bg-white/20 text-onAccent"
                            : "border-gray-900 bg-canvas text-gray-900 hover:bg-accentSoft"
                        }`}
                      >
                        {node
                          ? `#${node.rank}`
                          : paperId === startId
                            ? "center"
                            : `#${paperId}`}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
