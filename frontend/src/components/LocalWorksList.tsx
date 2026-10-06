/**
 * LOCAL WORKS LIST — the Prior works / Derivative works tabs for the
 * LOCAL scope: the external works clustered from the repository's
 * cached citations, with the graph papers that connect to each one.
 */

import type { ClusterWork } from "../api";
import { downloadClusterCsv } from "../utils/worksCsv";

interface LocalWorksListProps {
  side: "prior" | "derivative";
  works: ClusterWork[];
  activeKey: string | null;
  onActiveKey: (key: string | null) => void;
  onShowInGraph: () => void;
  rankById: Map<number, number>;
  startId: number | null;
  focusedPaperId: number | null;
  onFocusPaper: (id: number | null) => void;
  widened?: boolean;
}

const DESCRIPTIONS: Record<"prior" | "derivative", string> = {
  prior:
    "Papers that were most commonly cited by the papers in the graph. " +
    "This usually means that they are important seminal works for this " +
    "field and it could be a good idea to get familiar with them. " +
    "Selecting a prior work will highlight all graph papers referencing " +
    "it, and selecting a graph paper will highlight all referenced " +
    "prior work.",
  derivative:
    "Papers that cited many of the papers in the graph. This usually " +
    "means that they are either surveys of the field or recent relevant " +
    "works which were inspired by many papers in the graph. Selecting a " +
    "derived work will highlight all graph papers cited by it, and " +
    "selecting a graph paper will highlight all derivative works " +
    "citing it.",
};

export default function LocalWorksList({
  side,
  works,
  activeKey,
  onActiveKey,
  onShowInGraph,
  rankById,
  startId,
  focusedPaperId,
  onFocusPaper,
  widened = false,
}: LocalWorksListProps) {
  const title = side === "prior" ? "Prior works" : "Derivative works";

  return (
    <div className="p-4" data-local-works={side}>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-3xl text-sm leading-6 text-muted">
          {DESCRIPTIONS[side]}
        </p>

        {works.length > 0 && (
          <button
            type="button"
            onClick={() => downloadClusterCsv(title, works)}
            className="shrink-0 rounded border-[3px] border-gray-900 bg-white px-3 py-1.5 font-mono text-xs font-bold text-ink transition-colors pixel-ease hover:bg-accent hover:text-onAccent"
          >
            Download
          </button>
        )}
      </div>

      {works.length === 0 ? (
        <p className="mt-4 rounded border-[3px] border-dashed border-gray-900 bg-canvas px-4 py-6 text-center text-sm text-muted">
          No shared {side === "prior" ? "references" : "citers"} are
          cached for this graph yet — refresh a paper's citations from
          its record page to fill this in.
        </p>
      ) : (
        <ul
          className={`mt-4 grid gap-3 ${
            widened ? "lg:grid-cols-2" : ""
          }`}
        >
          {works.map((work) => {
            const isActive = activeKey === work.work_id;
            const touchesFocus =
              focusedPaperId !== null &&
              work.graph_paper_ids.includes(focusedPaperId);

            return (
              <li
                key={work.work_id}
                data-work-row
                className={`rounded border-[3px] p-3 transition-colors ${
                  isActive
                    ? "border-gray-900 bg-accent text-onAccent"
                    : touchesFocus
                      ? "border-gray-900 bg-accentSoft"
                      : "border-gray-900 bg-white"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    onActiveKey(isActive ? null : work.work_id)
                  }
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                >
                  <span
                    className={`min-w-0 flex-1 break-words text-sm font-bold leading-5 ${
                      isActive ? "text-onAccent" : "text-ink"
                    }`}
                  >
                    {work.label}
                  </span>

                  <span
                    className={`shrink-0 font-mono text-xs font-bold ${
                      isActive ? "text-onAccent" : "text-muted"
                    }`}
                    title={`${work.count} graph papers`}
                  >
                    ×{work.count}
                  </span>
                </button>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                      isActive ? "text-onAccent" : "text-muted"
                    }`}
                  >
                    {side === "prior" ? "referenced by" : "cites"}
                  </span>

                  {work.graph_paper_ids.map((paperId) => {
                    const rank = rankById.get(paperId);
                    const isFocused = focusedPaperId === paperId;

                    return (
                      <button
                        key={paperId}
                        type="button"
                        onClick={() =>
                          onFocusPaper(isFocused ? null : paperId)
                        }
                        className={`rounded border-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                          isFocused
                            ? "border-gray-900 bg-accent text-onAccent"
                            : isActive
                              ? "border-onAccent bg-white/20 text-onAccent"
                              : "border-gray-900 bg-canvas text-ink hover:bg-accentSoft"
                        }`}
                      >
                        {rank !== undefined
                          ? `#${rank}`
                          : paperId === startId
                            ? "center"
                            : `#${paperId}`}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {work.doi && (
                    <a
                      href={`https://doi.org/${work.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-xs underline ${
                        isActive ? "text-onAccent" : "text-accent"
                      }`}
                    >
                      doi.org/{work.doi}
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={onShowInGraph}
                    className={`ml-auto font-mono text-[10px] font-bold uppercase tracking-[0.12em] underline ${
                      isActive ? "text-onAccent" : "text-muted hover:text-accent"
                    }`}
                  >
                    Show in graph
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
