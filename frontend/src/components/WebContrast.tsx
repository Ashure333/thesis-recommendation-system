/**
 * WEB CONTRAST — side-by-side comparison of the center paper and one
 * of its OpenAlex neighbours (reference or citer).
 */

import { useState } from "react";

import type { Paper, WebWork } from "../api";
import { Field } from "./ContrastPanel";

export default function WebContrast({
  center,
  prior,
  derivative,
}: {
  center: Paper;
  prior: WebWork[];
  derivative: WebWork[];
}) {
  const allWorks = [...prior, ...derivative];
  const [compareKey, setCompareKey] = useState<string | null>(
    allWorks[0]?.work_id ?? null
  );

  const work =
    allWorks.find((entry) => entry.work_id === compareKey) ?? null;

  if (allWorks.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted">
        No OpenAlex neighbours to compare against.
      </p>
    );
  }

  const isPrior = work
    ? prior.some((entry) => entry.work_id === work.work_id)
    : false;

  return (
    <div className="flex flex-col gap-4 p-4" data-web-contrast>
      <p className="max-w-3xl text-sm leading-6 text-muted">
        Left: this paper. Right: a neighbour from its OpenAlex citation
        neighbourhood.
      </p>

      <label className="flex max-w-2xl flex-col gap-1">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted">
          Compare with
        </span>

        <select
          value={compareKey ?? ""}
          onChange={(event) => setCompareKey(event.target.value)}
          aria-label="Web work to compare"
          className="w-full rounded border-[2px] border-gray-900 bg-surface px-2 py-1.5 font-mono text-xs font-bold text-ink"
        >
          {prior.map((entry) => (
            <option key={entry.work_id} value={entry.work_id}>
              Prior · {(entry.title ?? entry.work_id).slice(0, 70)}
            </option>
          ))}

          {derivative.map((entry) => (
            <option key={entry.work_id} value={entry.work_id}>
              Derivative · {(entry.title ?? entry.work_id).slice(0, 70)}
            </option>
          ))}
        </select>
      </label>

      {work && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border-[2px] border-gray-900 bg-gray-900">
          <p className="bg-canvas px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
            Center
          </p>
          <p className="bg-canvas px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
            {isPrior ? "Prior work" : "Derivative work"}
          </p>

          <Field label="Title" value={center.title} emphasized />
          <Field label="Title" value={work.title ?? "—"} emphasized />

          <Field label="Authors" value={center.author ?? "—"} />
          <Field label="First author" value={work.author ?? "—"} />

          <Field
            label="Year"
            value={String(center.publication_year ?? "—")}
          />
          <Field
            label="Year"
            value={String(work.publication_year ?? "—")}
          />

          <Field label="DOI" value={center.doi ?? "—"} />
          <Field label="DOI" value={work.doi ?? "—"} />

          <Field
            label="Citations"
            value={String(center.citation_count ?? "—")}
          />
          <Field
            label="Citations (OpenAlex)"
            value={String(work.cited_by_count ?? "—")}
          />

          <div className="min-w-0 bg-white px-2 py-1.5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted">
              Relationship
            </p>
            <p className="mt-0.5 text-xs text-ink">
              {isPrior
                ? "This paper cites it (prior work)."
                : "It cites this paper (derivative work)."}
            </p>
          </div>

          <div className="min-w-0 bg-white px-2 py-1.5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted">
              OpenAlex work
            </p>
            <a
              href={`https://openalex.org/${work.work_id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block break-all text-xs text-accent hover:underline"
            >
              {work.work_id}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
