/**
 * CONTRAST PANEL — side-by-side comparison of a center paper and one
 * of its ranked similar papers, shown as the "Contrast" tab of the
 * Search page's similar-papers pane.
 *
 * The similar set comes from the same seed-based recommendation call
 * the graph uses, so the ranking matches what the pipeline actually
 * scored; the sheet contrasts metadata, keywords (shared vs unique),
 * abstracts, and the score breakdown of the similar paper.
 */

import { useEffect, useMemo, useState } from "react";

import {
  getPaper,
  getRecommendations,
  type Paper,
  type SearchResult,
} from "../api";

interface ContrastPanelProps {
  centerId: number;
  pipeline: string;
  pipelineLabel: string;
  topK: number;
  weights?: { tfidf: number; sbert: number; metadata: number };
}

function tokenizeKeywords(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/[,;]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Generated keyword phrases rarely repeat verbatim across records
 * ("neural networks" vs "neural network models"), so overlap is
 * judged on significant words, not whole phrases.
 */
const KEYWORD_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "over",
  "under",
  "using",
  "based",
  "via",
  "its",
]);

function significantWords(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (word) => word.length >= 4 && !KEYWORD_STOPWORDS.has(word)
    );
}

function tokenizeAuthors(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/\s*;\s*|\s+and\s+/i)
    .map((author) => author.trim())
    .filter(Boolean);
}

export default function ContrastPanel({
  centerId,
  pipeline,
  pipelineLabel,
  topK,
  weights,
}: ContrastPanelProps) {
  const [centerPaper, setCenterPaper] = useState<Paper | null>(null);
  const [similar, setSimilar] = useState<SearchResult[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const weightsKey = weights
    ? `${weights.tfidf}/${weights.sbert}/${weights.metadata}`
    : "";

  // Center paper metadata (local lookup — milliseconds).
  useEffect(() => {
    setCenterPaper(null);

    getPaper(centerId)
      .then(setCenterPaper)
      .catch(() => setCenterPaper(null));
  }, [centerId]);

  // Ranked similar papers, same call shape as the graph.
  useEffect(() => {
    setSimilar(null);
    setError("");

    const timer = window.setTimeout(() => {
      getRecommendations({
        pipeline,
        seedPaperId: centerId,
        topK,
        ...(weights ? { weights } : {}),
      })
        .then((results) => {
          setSimilar(results);
          setSelectedId(results[0]?.paper.id ?? null);
        })
        .catch((requestError: Error) => {
          setError(requestError.message);
          setSimilar([]);
        });
    }, 150);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, pipeline, topK, weightsKey]);

  const selected =
    similar?.find((result) => result.paper.id === selectedId) ??
    similar?.[0] ??
    null;

  const shared = useMemo(() => {
    if (!centerPaper || !selected) {
      return {
        keywords: new Set<string>(),
        terms: new Set<string>(),
        authors: new Set<string>(),
      };
    }

    const centerKeywords = tokenizeKeywords(centerPaper.keywords);
    const selectedKeywords = tokenizeKeywords(selected.paper.keywords);

    const centerKeywordSet = new Set(
      centerKeywords.map(normalizeKeyword)
    );
    const centerVocab = new Set(
      centerKeywords.flatMap(significantWords)
    );

    const sharedTerms = new Set(
      selectedKeywords
        .flatMap(significantWords)
        .filter((word) => centerVocab.has(word))
    );

    const centerAuthors = new Set(
      tokenizeAuthors(centerPaper.author).map((a) => a.toLowerCase())
    );

    const sharedKeywords = new Set(
      selectedKeywords
        .map(normalizeKeyword)
        .filter((keyword) => centerKeywordSet.has(keyword))
    );

    return {
      keywords: sharedKeywords,
      terms: sharedTerms,
      authors: new Set(
        tokenizeAuthors(selected.paper.author)
          .map((a) => a.toLowerCase())
          .filter((author) => centerAuthors.has(author))
      ),
    };
  }, [centerPaper, selected]);

  if (error) {
    return (
      <div className="p-4">
        <p className="status-error text-sm" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (similar === null || centerPaper === null) {
    return (
      <p className="p-6 text-center font-mono text-xs tracking-[0.15em] text-muted">
        RANKING SIMILAR PAPERS…
      </p>
    );
  }

  if (similar.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted">
        No similar papers were ranked for this center.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-contrast-panel>
      <p className="text-xs leading-5 text-muted">
        Left: the center paper. Right: one of its ranked similar
        papers. Highlighted keywords appear in both.
      </p>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted">
          Compare with
        </span>

        <select
          value={selectedId ?? ""}
          onChange={(event) =>
            setSelectedId(Number(event.target.value))
          }
          aria-label="Similar paper to compare"
          className="w-full rounded border-[2px] border-gray-900 bg-surface px-2 py-1.5 font-mono text-xs font-bold text-ink"
        >
          {similar.map((result, index) => (
            <option key={result.paper.id} value={result.paper.id}>
              #{index + 1} · {result.paper.title.slice(0, 64)}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded border-[2px] border-gray-900 bg-gray-900">
            <p className="bg-canvas px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
              Center
            </p>
            <p className="bg-canvas px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
              {pipelineLabel} · #{similar.indexOf(selected) + 1}
            </p>

            <Field
              label="Title"
              value={centerPaper.title}
              emphasized
            />
            <Field
              label="Title"
              value={selected.paper.title}
              emphasized
            />

            <Field
              label="Authors"
              value={
                centerPaper.author ?? "—"
              }
            />
            <Field
              label="Authors"
              value={selected.paper.author ?? "—"}
              note={
                shared.authors.size > 0
                  ? `${shared.authors.size} shared author${
                      shared.authors.size === 1 ? "" : "s"
                    }`
                  : undefined
              }
            />

            <Field
              label="Year"
              value={String(centerPaper.publication_year ?? "—")}
            />
            <Field
              label="Year"
              value={String(selected.paper.publication_year ?? "—")}
            />

            <Field
              label="Subject"
              value={centerPaper.subject_category ?? "—"}
            />
            <Field
              label="Subject"
              value={selected.paper.subject_category ?? "—"}
            />

            <Field
              label="Type"
              value={centerPaper.document_type ?? "—"}
            />
            <Field
              label="Type"
              value={selected.paper.document_type ?? "—"}
            />

            <Field
              label="Citations"
              value={String(centerPaper.citation_count ?? "—")}
            />
            <Field
              label="Citations"
              value={String(selected.paper.citation_count ?? "—")}
            />

            <KeywordsCell
              raw={centerPaper.keywords}
              sharedKeywords={shared.keywords}
              sharedTerms={shared.terms}
              note={
                shared.terms.size > 0
                  ? `${shared.terms.size} shared term${
                      shared.terms.size === 1 ? "" : "s"
                    }`
                  : undefined
              }
            />
            <KeywordsCell
              raw={selected.paper.keywords}
              sharedKeywords={shared.keywords}
              sharedTerms={shared.terms}
            />

            <AbstractCell text={centerPaper.abstract} />
            <AbstractCell text={selected.paper.abstract} />
          </div>

          <ScoreBreakdown result={selected} />
        </>
      )}
    </div>
  );
}

export function Field({
  label,
  value,
  emphasized = false,
  note,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  note?: string;
}) {
  return (
    <div className="min-w-0 bg-white px-2 py-1.5">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted">
        {label}
      </p>

      <p
        className={`mt-0.5 break-words text-xs leading-4 ${
          emphasized ? "font-bold text-ink" : "text-ink"
        }`}
      >
        {value}
      </p>

      {note && (
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
          {note}
        </p>
      )}
    </div>
  );
}

function KeywordsCell({
  raw,
  sharedKeywords,
  sharedTerms,
  note,
}: {
  raw: string | null;
  sharedKeywords: Set<string>;
  sharedTerms: Set<string>;
  note?: string;
}) {
  const keywords = tokenizeKeywords(raw);

  return (
    <div className="min-w-0 bg-white px-2 py-1.5">
      <p className="flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted">
        Keywords
        {note && (
          <span className="normal-case tracking-normal text-accent">
            {note}
          </span>
        )}
      </p>

      <div className="mt-1 flex flex-wrap gap-1">
        {keywords.length === 0 ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          keywords.map((keyword) => {
            const isShared =
              sharedKeywords.has(normalizeKeyword(keyword)) ||
              significantWords(keyword).some((word) =>
                sharedTerms.has(word)
              );

            return (
              <span
                key={keyword}
                data-shared={isShared || undefined}
                title={
                  isShared
                    ? "Shares a significant term with the other paper"
                    : undefined
                }
                className={`rounded border-[2px] px-1 py-0.5 font-mono text-[9px] font-bold ${
                  isShared
                    ? "border-gray-900 bg-accent text-onAccent"
                    : "border-gray-900 bg-canvas text-ink"
                }`}
              >
                {keyword}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

function AbstractCell({ text }: { text: string | null }) {
  return (
    <div className="min-w-0 bg-white px-2 py-1.5">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted">
        Abstract
      </p>

      <p className="mt-1 max-h-44 overflow-y-auto whitespace-pre-line break-words text-xs leading-5 text-ink">
        {text ?? "—"}
      </p>
    </div>
  );
}

function ScoreBreakdown({ result }: { result: SearchResult }) {
  const components = result.components ?? null;
  const peak = components
    ? Math.max(
        components.tfidf,
        components.sbert,
        components.metadata,
        0.0001
      )
    : 1;

  const rows = components
    ? [
        { label: "TF-IDF", value: components.tfidf },
        { label: "S-BERT", value: components.sbert },
        { label: "Metadata", value: components.metadata },
      ]
    : [];

  return (
    <div className="rounded border-[2px] border-gray-900 bg-canvas p-3">
      <p className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
        Similarity breakdown
        <span className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 text-ink">
          {result.score.toFixed(4)}
        </span>
      </p>

      {components === null ? (
        <p className="mt-2 text-xs text-muted">
          This pipeline did not report a breakdown for the run.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[64px_1fr_52px] items-center gap-2"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
                {row.label}
              </span>

              <span className="h-2.5 overflow-hidden rounded border-[2px] border-gray-900 bg-white">
                <span
                  className="block h-full bg-accent"
                  style={{
                    width: `${Math.max(
                      4,
                      (row.value / peak) * 100
                    )}%`,
                  }}
                />
              </span>

              <span className="text-right font-mono text-[10px] text-muted">
                {row.value.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
