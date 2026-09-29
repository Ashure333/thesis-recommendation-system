import { useEffect, useMemo, useState } from "react";
import {
  getSimilarPapersGraph,
  SimilarGraphNode,
  SimilarPapersGraph,
} from "../api";

interface ConnectedPapersGraphProps {
  paperId: number;
  pipeline?: string;
  topK?: number;
}

interface PositionedNode extends SimilarGraphNode {
  x: number;
  y: number;
  rank: number; // 0 for the current paper, 1..n for similar papers
  ring: number;
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
  The graph does not draw titles next to every node. Long labels collided and
  forced a wide minimum width, which caused horizontal scrolling in the side
  panel.

  Instead:
    - the SVG only holds the nodes (numbered by rank), so it scales cleanly
      down to any width with no min-width and no scrolling
    - closer to the center = more similar (concentric rings by rank)
    - titles live in a ranked list underneath, linked to the graph
      (hover / click either one and the other highlights)
*/
const WIDTH = 400;
const HEIGHT = 360;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

const RING_RADII = [92, 158];
const RING_CAPACITY = [4, 6, 8, 10];
const RING_SQUASH = 0.98;

const CURRENT_RADIUS = 30;

// Slab offset, in SVG user units (matches translate-x-1 / translate-y-1).
const SLAB = 4;
// Stroke of the chunky outline, in SVG user units.
const OUTLINE = 3;

// SVG needs raw hex values; these mirror the Tailwind tokens used elsewhere.
const COLORS = {
  ink: "#111827", // gray-900
  orange: "#FCA847", // brand orange: active state
  surface: "#ffffff",
  hairline: "#e5e7eb",
};

const FOCUS_INSET =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-[3px] focus-visible:outline-gray-900";

const PANEL = "rounded border-[3px] border-gray-900 bg-white";

function getRingRadius(ring: number) {
  if (ring < RING_RADII.length) {
    return RING_RADII[ring];
  }

  return RING_RADII[RING_RADII.length - 1] + (ring - RING_RADII.length + 1) * 40;
}

function assignRings(count: number) {
  const rings: number[] = [];
  let ring = 0;
  let used = 0;

  for (let i = 0; i < count; i++) {
    const capacity =
      RING_CAPACITY[Math.min(ring, RING_CAPACITY.length - 1)];

    if (i - used >= capacity) {
      used += capacity;
      ring += 1;
    }

    rings.push(ring);
  }

  return rings;
}

function layoutNodes(
  current: SimilarGraphNode | undefined,
  similar: SimilarGraphNode[]
): PositionedNode[] {
  const result: PositionedNode[] = [];

  if (current) {
    result.push({
      ...current,
      x: CENTER_X,
      y: CENTER_Y,
      rank: 0,
      ring: -1,
    });
  }

  // Most similar first, so they sit on the innermost ring.
  const sorted = [...similar].sort((a, b) => b.similarity - a.similarity);
  const rings = assignRings(sorted.length);

  // How many nodes ended up on each ring (for even angular spacing).
  const ringCounts = new Map<number, number>();
  rings.forEach((ring) =>
    ringCounts.set(ring, (ringCounts.get(ring) ?? 0) + 1)
  );

  const slotCursor = new Map<number, number>();

  sorted.forEach((node, index) => {
    const ring = rings[index];
    const slot = slotCursor.get(ring) ?? 0;
    slotCursor.set(ring, slot + 1);

    const count = ringCounts.get(ring) ?? 1;

    // Offset every other ring by half a slot so nodes don't line up radially.
    const offset = ring % 2 === 1 ? Math.PI / count : Math.PI / 6;
    const angle = -Math.PI / 2 + offset + (slot / count) * Math.PI * 2;

    const radius = getRingRadius(ring);

    result.push({
      ...node,
      x: CENTER_X + Math.cos(angle) * radius,
      y: CENTER_Y + Math.sin(angle) * radius * RING_SQUASH,
      rank: index + 1,
      ring,
    });
  });

  return result;
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
}: ConnectedPapersGraphProps) {
  const [graph, setGraph] = useState<SimilarPapersGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setGraph(null);
    setSelectedNodeId(null);
    setHoveredNodeId(null);

    getSimilarPapersGraph(paperId, pipeline, topK)
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
          err instanceof Error
            ? err.message
            : "Unable to load similar papers."
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
  }, [paperId, pipeline, topK]);

  const currentNode = useMemo(
    () => graph?.nodes.find((node) => node.relationship === "current"),
    [graph]
  );

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    if (!graph) {
      return [];
    }

    const similarNodes = graph.nodes.filter(
      (node) => node.relationship === "similar"
    );

    return layoutNodes(currentNode, similarNodes);
  }, [graph, currentNode]);

  const nodeMap = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes]
  );

  const rankedNodes = useMemo(
    () => positionedNodes.filter((node) => node.relationship === "similar"),
    [positionedNodes]
  );

  const similarityRange = useMemo(() => {
    if (rankedNodes.length === 0) {
      return { min: 0, max: 1 };
    }

    const values = rankedNodes.map((node) => node.similarity);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [rankedNodes]);

  const activeId = hoveredNodeId ?? selectedNodeId;

  const toggleSelected = (id: number) =>
    setSelectedNodeId((prev) => (prev === id ? null : id));

  /* ---------- LOADING / ERROR / EMPTY ---------- */

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${PANEL} px-4 py-5 text-gray-900`}
      >
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
      <div role="alert" className={`${PANEL} px-4 py-4 text-gray-900`}>
        <PanelTitle>Similar Papers</PanelTitle>
        <p className="mt-1 text-sm font-medium leading-normal text-gray-900">
          {error}
        </p>
      </div>
    );
  }

  if (!graph || graph.nodes.length <= 1) {
    return (
      <div className={`${PANEL} px-4 py-4 text-gray-900`}>
        <PanelTitle>Similar Papers</PanelTitle>
        <p className="mt-1 text-sm text-gray-600">
          No similar papers were found in the repository.
        </p>
      </div>
    );
  }

  const ringCount = Math.max(...rankedNodes.map((node) => node.ring), 0) + 1;

  return (
    <div className={`${PANEL} overflow-hidden text-gray-900`}>
      {/* HEADER */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <PanelTitle>Similar Papers</PanelTitle>

            <p className="mt-1 text-sm text-gray-600">
              Closer to the center means more similar.
            </p>
          </div>

          {/* example-chip treatment */}
          <span className="shrink-0 rounded border-[3px] border-gray-900 bg-white px-2 py-0.5 text-sm font-bold leading-snug">
            {graph.nodes.length - 1} related
          </span>
        </div>
      </div>

      {/* GRAPH: sits on the cream canvas so it reads as "inside" the panel */}
      <div className="border-t-[3px] border-gray-900 bg-[#FFFDF8] px-2 py-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mx-auto block h-auto w-full max-w-[520px]"
          role="img"
          aria-label="Similar papers graph"
          onMouseLeave={() => setHoveredNodeId(null)}
        >
          {/* RING GUIDES */}
          {Array.from({ length: ringCount }).map((_, ring) => (
            <ellipse
              key={`ring-${ring}`}
              cx={CENTER_X}
              cy={CENTER_Y}
              rx={getRingRadius(ring)}
              ry={getRingRadius(ring) * RING_SQUASH}
              fill="none"
              stroke={COLORS.hairline}
              strokeWidth={2}
              strokeDasharray="3 6"
            />
          ))}

          {/* CONNECTIONS */}
          {graph.edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);

            if (!source || !target) {
              return null;
            }

            const touchesCurrent =
              source.relationship === "current" ||
              target.relationship === "current";

            const highlighted =
              activeId !== null &&
              (activeId === edge.source || activeId === edge.target);

            const dimmed = activeId !== null && !highlighted;

            // Ink for the edges that matter, hairline for the rest.
            const stroke =
              highlighted || touchesCurrent ? COLORS.ink : COLORS.hairline;

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={stroke}
                strokeWidth={highlighted ? OUTLINE : touchesCurrent ? 2 : 1.5}
                strokeLinecap="butt"
                opacity={dimmed ? 0.25 : 1}
                style={{ transition: "opacity 100ms" }}
              />
            );
          })}

          {/* NODES */}
          {positionedNodes.map((node) => {
            const isCurrent = node.relationship === "current";
            const isActive = activeId === node.id;
            const isSelected = selectedNodeId === node.id;
            const dimmed =
              activeId !== null &&
              !isActive &&
              !isCurrent &&
              // keep neighbours of the active node readable
              !graph.edges.some(
                (edge) =>
                  (edge.source === activeId && edge.target === node.id) ||
                  (edge.target === activeId && edge.source === node.id)
              );

            const radius = getNodeRadius(
              node,
              similarityRange.min,
              similarityRange.max
            );

            // Flat fills only: ink = compared paper, orange = active, white = idle.
            const fill = isCurrent
              ? COLORS.ink
              : isActive || isSelected
                ? COLORS.orange
                : COLORS.surface;

            // Slab only on the high-priority nodes (level-2 elevation).
            const hasSlab = isCurrent || isSelected;

            return (
              <g
                key={node.id}
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
                className="cursor-pointer outline-none"
                opacity={dimmed ? 0.4 : 1}
                style={{ transition: "opacity 100ms" }}
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
                    fill={COLORS.ink}
                    pointerEvents="none"
                  >
                    {node.rank}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

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
              className="h-4 w-4 rounded-full border-[3px] border-gray-900 bg-[#FCA847]"
            />
            Highlighted
          </span>
        </div>
      </div>

      {/* CENTER PAPER */}
      {currentNode && (
        <div className="border-t-[3px] border-gray-900 bg-white px-4 py-3">
          <p className="text-sm text-gray-600">Comparing against</p>
          <p className="mt-0.5 text-sm font-bold leading-snug text-gray-900">
            {currentNode.title}
          </p>
        </div>
      )}

      {/* RANKED LIST */}
      <ol
        className="border-t-[3px] border-gray-900"
        onMouseLeave={() => setHoveredNodeId(null)}
      >
        {rankedNodes.map((node) => {
          const isActive = activeId === node.id;
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
                  isActive ? "bg-[#FCA847]" : "bg-white"
                }`}
              >
                {/* rank chip: circular indicator, ink when selected */}
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] border-gray-900 text-sm font-bold leading-none ${
                    isSelected ? "bg-gray-900 text-white" : "bg-white text-gray-900"
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
                    <span className="h-3 flex-1 overflow-hidden rounded border-[3px] border-gray-900 bg-white">
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

      {/* FOOTER */}
      <div className="border-t-[3px] border-gray-900 bg-white px-4 py-3">
        <p className="text-sm leading-normal text-gray-600">
          Similarity is calculated using the selected recommendation pipeline
          against papers already stored in the repository.
        </p>
      </div>
    </div>
  );
}
