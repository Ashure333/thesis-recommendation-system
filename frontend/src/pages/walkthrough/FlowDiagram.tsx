/**
 * FLOW DIAGRAM — hand-drawn SVG boxes-and-arrows for the Engine
 * page, matching the retro white/ink aesthetic of the walkthrough.
 *
 * Nodes are positioned explicitly (x, y, w, h) so a diagram reads
 * like a static figure; edges are straight lines with arrowheads
 * and optional labels.
 */

export interface FlowNode {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Accent-filled node (the output of the stage). */
  accent?: boolean;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export default function FlowDiagram({
  nodes,
  edges,
  width = 940,
  height = 260,
  title,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width?: number;
  height?: number;
  title?: string;
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  function edgePath(edge: FlowEdge) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);

    if (!from || !to) {
      return null;
    }

    // Straight line from the right edge of `from` to the left edge of `to`.
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;

    return { x1, y1, x2, y2 };
  }

  return (
    <figure className="overflow-x-auto rounded border-[2px] border-gray-900 bg-white p-3">
      {title && (
        <figcaption className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
          {title}
        </figcaption>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title ?? "Flow diagram"}
        className="block w-full min-w-[640px]"
      >
        {edges
          .map((edge) => ({ edge, path: edgePath(edge) }))
          .filter(({ path }) => path !== null)
          .map(({ edge, path }) => {
            const { x1, y1, x2, y2 } = path!;
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={`${edge.from}->${edge.to}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2 - 6}
                  y2={y2}
                  stroke="#1b2430"
                  strokeWidth={2}
                  strokeDasharray={edge.dashed ? "5 4" : undefined}
                  markerEnd="url(#flow-arrow)"
                />

                {edge.label && (
                  <text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#5b6776"
                    style={{ fontWeight: 700 }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

        <defs>
          <marker
            id="flow-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b2430" />
          </marker>
        </defs>

        {nodes.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={6}
              fill={node.accent ? "#1f5f8b" : "#ffffff"}
              stroke="#1b2430"
              strokeWidth={2}
            />

            <text
              x={node.x + node.w / 2}
              y={node.y + (node.sub ? 20 : node.h / 2)}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill={node.accent ? "#ffffff" : "#1b2430"}
            >
              {node.label}
            </text>

            {node.sub && (
              <text
                x={node.x + node.w / 2}
                y={node.y + node.h / 2 + 12}
                textAnchor="middle"
                fontSize={11}
                fill={node.accent ? "#e6eef5" : "#5b6776"}
              >
                {node.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}