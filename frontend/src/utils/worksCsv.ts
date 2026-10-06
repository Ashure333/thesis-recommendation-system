/**
 * CSV downloads for the prior/derivative work lists.
 */

import type { ClusterWork, WebWork } from "../api";

function escape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function download(title: string, lines: string[]) {
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

export function downloadClusterCsv(
  title: string,
  works: ClusterWork[]
) {
  download(title, [
    "work_id,label,doi,mentions,graph_paper_ids",
    ...works.map((work) =>
      [
        work.work_id,
        escape(work.label),
        work.doi ?? "",
        work.count,
        work.graph_paper_ids.join(" "),
      ].join(",")
    ),
  ]);
}

export function downloadWebWorksCsv(
  title: string,
  works: WebWork[]
) {
  download(title, [
    "work_id,title,doi,year,cited_by_count,author",
    ...works.map((work) =>
      [
        work.work_id,
        escape(work.title ?? ""),
        work.doi ?? "",
        work.publication_year ?? "",
        work.cited_by_count ?? "",
        escape(work.author ?? ""),
      ].join(",")
    ),
  ]);
}
