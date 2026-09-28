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

/*
  LAYOUT NOTES
  ------------
  The graph no longer tries to draw titles next to every node. That was the
  cause of the cramped look: long labels collided with each other and forced a
  620px minimum width, which caused horizontal scrolling in the side panel.

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

const COLORS = {
  sage: "#668b72",
  sageDark: "#4f7259",
  sageSoft: "#eef4ef",
  sageMid: "#cfdfd3",
  line: "#d8d2ca",
  lineSoft: "#eeeae4",
  ink: "#403b35",
  inkSoft: "#686159",
  muted: "#918a81",
  paper: "#faf9f7",
};

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

function getNodeRadius(node: PositionedNode, min: number, max: number) {
  if (node.relationship === "current") {
    return CURRENT_RADIUS;
  }

  const span = Math.max(max - min, 0.0001);
  const t = (node.similarity - min) / span;

  return 15 + t * 6;
}

function nodeFill(node: PositionedNode, min: number, max: number) {
  if (node.relationship === "current") {
    return COLORS.sage;
  }

  const span = Math.max(max - min, 0.0001);
  const t = (node.similarity - min) / span;

  // Stronger matches get a slightly deeper sage wash.
  const alpha = 0.06 + t * 0.34;
  return `rgba(102, 139, 114, ${alpha.toFixed(2)})`;
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
      <div className="rounded-md border border-[#ddd8d0] bg-white px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[#403b35]">
              Similar Papers
            </p>

            <p className="mt-1 text-[10px] text-[#918a81]">
              Building similarity graph from your repository…
            </p>
          </div>

          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#ddd8d0] border-t-[#668b72]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-[#e3d8d0] bg-[#faf4f0] px-4 py-4">
        <p className="text-[12px] font-medium text-[#765f51]">
          Similar Papers
        </p>

        <p className="mt-1 text-[10px] leading-5 text-[#826b5d]">{error}</p>
      </div>
    );
  }

  if (!graph || graph.nodes.length <= 1) {
    return (
      <div className="rounded-md border border-[#ddd8d0] bg-white px-4 py-4">
        <p className="text-[12px] font-medium text-[#403b35]">
          Similar Papers
        </p>

        <p className="mt-1 text-[10px] leading-5 text-[#918a81]">
          No similar papers were found in the repository.
        </p>
      </div>
    );
  }

  const ringCount = Math.max(...rankedNodes.map((node) => node.ring), 0) + 1;

  return (
    <div className="overflow-hidden rounded-md border border-[#ddd8d0] bg-white">
      {/* HEADER */}
      <div className="border-b border-[#eeeae4] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#403b35]">
              Similar Papers
            </p>

            <p className="mt-1 text-[10px] leading-4 text-[#918a81]">
              Closer to the center means more similar.
            </p>
          </div>

          <span className="shrink-0 rounded-full border border-[#ddd8d0] bg-[#faf9f7] px-2 py-1 text-[9px] text-[#777169]">
            {graph.nodes.length - 1} related
          </span>
        </div>
      </div>

      {/* GRAPH */}
      <div
        className="px-2 py-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, #f3f7f4 0%, #ffffff 68%)",
        }}
      >
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
              stroke={COLORS.line}
              strokeWidth={1}
              strokeDasharray="2 5"
              opacity={0.75}
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

            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={highlighted ? COLORS.sage : COLORS.line}
                strokeWidth={highlighted ? 2 : touchesCurrent ? 1.3 : 0.8}
                strokeLinecap="round"
                opacity={dimmed ? 0.2 : touchesCurrent ? 0.9 : 0.45}
                style={{ transition: "opacity 150ms, stroke 150ms" }}
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
                style={{ transition: "opacity 150ms" }}
              >
                {/* soft halo for the active node */}
                {(isActive || isSelected) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 6}
                    fill={COLORS.sage}
                    opacity={0.14}
                  />
                )}

                {/* pulse on the center node (one gentle, ambient motion) */}
                {isCurrent && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill="none"
                    stroke={COLORS.sage}
                    strokeWidth={1.5}
                  >
                    <animate
                      attributeName="r"
                      values={`${radius};${radius + 14}`}
                      dur="3s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.45;0"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* shadow */}
                <circle
                  cx={node.x}
                  cy={node.y + 1.5}
                  r={radius}
                  fill="#000"
                  opacity={0.06}
                />

                {/* body */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill="#ffffff"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={nodeFill(
                    node,
                    similarityRange.min,
                    similarityRange.max
                  )}
                  stroke={
                    isCurrent || isActive || isSelected
                      ? COLORS.sage
                      : COLORS.line
                  }
                  strokeWidth={isCurrent || isSelected ? 2.5 : 1.5}
                  style={{ transition: "stroke 150ms" }}
                />

                {isCurrent ? (
                  <>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={10}
                      fill="#ffffff"
                      opacity={0.95}
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={4}
                      fill={COLORS.sage}
                    />
                  </>
                ) : (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill={COLORS.sageDark}
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
        <div className="flex items-center justify-center gap-4 pb-1 text-[9px] text-[#918a81]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#668b72]" />
            Selected paper
          </span>

          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-[#d8d2ca] bg-[rgba(102,139,114,0.25)]" />
            Similar (numbered by rank)
          </span>
        </div>
      </div>

      {/* CENTER PAPER */}
      {currentNode && (
        <div className="border-t border-[#eeeae4] bg-[#faf9f7] px-4 py-2.5">
          <p className="text-[9px] text-[#918a81]">Comparing against</p>
          <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#403b35]">
            {currentNode.title}
          </p>
        </div>
      )}

      {/* RANKED LIST */}
      <ol
        className="border-t border-[#eeeae4]"
        onMouseLeave={() => setHoveredNodeId(null)}
      >
        {rankedNodes.map((node) => {
          const isActive = activeId === node.id;
          const isSelected = selectedNodeId === node.id;
          const percent = node.similarity * 100;

          return (
            <li
              key={node.id}
              className="border-b border-[#f3f0eb] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => toggleSelected(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId(null)}
                aria-pressed={isSelected}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#668b72] ${
                  isActive ? "bg-[#f3f7f4]" : "bg-white"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${
                    isSelected
                      ? "border-[#668b72] bg-[#668b72] text-white"
                      : "border-[#d8d2ca] bg-white text-[#4f7259]"
                  }`}
                >
                  {node.rank}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[11px] leading-4 text-[#403b35] ${
                      isSelected ? "font-medium" : ""
                    } ${isSelected ? "" : "line-clamp-2"}`}
                  >
                    {node.title}
                  </span>

                  {isSelected && (
                    <span className="mt-0.5 block text-[9px] text-[#918a81]">
                      {node.author || "Unknown author"}
                      {node.publication_year
                        ? `, ${node.publication_year}`
                        : ""}
                    </span>
                  )}

                  {/* similarity bar */}
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#eeeae4]">
                      <span
                        className="block h-full rounded-full bg-[#668b72]"
                        style={{
                          width: `${Math.max(2, Math.min(100, percent))}%`,
                          transition: "width 300ms ease-out",
                        }}
                      />
                    </span>

                    <span className="w-9 shrink-0 text-right text-[9px] font-medium tabular-nums text-[#668b72]">
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
      <div className="border-t border-[#eeeae4] px-4 py-2">
        <p className="text-[9px] leading-4 text-[#a09a92]">
          Similarity is calculated using the selected recommendation pipeline
          against papers already stored in the repository.
        </p>
      </div>
    </div>
  );
}
