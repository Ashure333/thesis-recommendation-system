/**
 * CITATION STYLES — single-paper formatted citations for the
 * "Copy as" context-menu actions, matching the styles offered in the
 * Settings tab (APA 7, MLA 9, Chicago, IEEE).
 *
 * The repository record has no journal/venue field, so these are
 * title-level citations. What gets italicized depends on the
 * document type, exactly like the manuals:
 *
 *   Journal Article / Conference Paper -> the title is plain (APA)
 *     or quoted (MLA / Chicago / IEEE); a venue would be italic but
 *     none is stored.
 *   Thesis / Technical Report -> the title is the standalone work,
 *     so it is italicized in every style.
 *
 * `citationParts()` returns both the plain text and the HTML flavor
 * (with <i> markup); the context menu puts the HTML on the clipboard
 * so Word and other rich editors keep the italics on paste.
 */

import type { Paper } from "../api";
import { citationKey } from "./exportCitations";
import type { CitationStyle } from "./preferences";

function author(paper: Paper): string {
  const value = (paper.author ?? "").trim();

  return value || "Unknown author";
}

function year(paper: Paper): string {
  return paper.publication_year
    ? String(paper.publication_year)
    : "n.d.";
}

function title(paper: Paper): string {
  return (paper.title ?? "").trim() || "Untitled";
}

/** Standalone works carry an italicized title in every style. */
export function isStandaloneWork(paper: Paper): boolean {
  const type = (paper.document_type ?? "").toLowerCase();

  return (
    type.includes("thesis") ||
    type.includes("dissertation") ||
    type.includes("report") ||
    type.includes("book")
  );
}

function doiSuffix(
  paper: Paper,
  includeDoi: boolean,
  style: CitationStyle
): string {
  const doi = (paper.doi ?? "").trim();

  if (!includeDoi || !doi) {
    return "";
  }

  switch (style) {
    case "apa":
      return ` https://doi.org/${doi}`;
    case "mla":
      return ` DOI: ${doi}.`;
    case "chicago":
      return ` https://doi.org/${doi}.`;
    case "ieee":
      return ` doi: ${doi}.`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CitationParts {
  /** Plain-text citation (clipboard fallback, downloads). */
  text: string;
  /** HTML citation with <i> around the italicized segments. */
  html: string;
}

export function citationParts(
  paper: Paper,
  style: CitationStyle,
  includeDoi: boolean,
  index?: number
): CitationParts {
  const names = author(paper);
  const when = year(paper);
  const work = title(paper);
  const doi = doiSuffix(paper, includeDoi, style);
  const standalone = isStandaloneWork(paper);

  const quotedWork = `"${work}"`;
  const italic = `<i>${escapeHtml(work)}</i>`;

  const safeNames = escapeHtml(names);
  const safeDoi = escapeHtml(doi);

  switch (style) {
    case "apa":
      if (standalone) {
        return {
          text: `${names} (${when}). ${work}.${doi}`,
          html: `${safeNames} (${when}). ${italic}.${safeDoi}`,
        };
      }

      return {
        text: `${names} (${when}). ${work}.${doi}`,
        html: `${safeNames} (${when}). ${escapeHtml(work)}.${safeDoi}`,
      };

    case "mla":
      if (standalone) {
        return {
          text: `${names}. ${work}. ${when}.${doi}`,
          html: `${safeNames}. ${italic}. ${when}.${safeDoi}`,
        };
      }

      return {
        text: `${names}. ${quotedWork}. ${when}.${doi}`,
        html: `${safeNames}. ${escapeHtml(quotedWork)}. ${when}.${safeDoi}`,
      };

    case "chicago":
      if (standalone) {
        return {
          text: `${names}. ${work}. ${when}.${doi}`,
          html: `${safeNames}. ${italic}. ${when}.${safeDoi}`,
        };
      }

      return {
        text: `${names}. ${quotedWork}. ${when}.${doi}`,
        html: `${safeNames}. ${escapeHtml(quotedWork)}. ${when}.${safeDoi}`,
      };

    case "ieee": {
      const prefix = index !== undefined ? `[${index}] ` : "";

      if (standalone) {
        return {
          text: `${prefix}${names}, ${work}, ${when}.${doi}`,
          html: `${prefix}${safeNames}, ${italic}, ${when}.${safeDoi}`,
        };
      }

      return {
        text: `${prefix}${names}, "${work}," ${when}.${doi}`,
        html: `${prefix}${safeNames}, &quot;${escapeHtml(
          work
        )},&quot; ${when}.${safeDoi}`,
      };
    }
  }
}

/** Plain-text citation (kept for callers that only show text). */
export function formatPaperCitation(
  paper: Paper,
  style: CitationStyle,
  includeDoi: boolean,
  index?: number
): string {
  return citationParts(paper, style, includeDoi, index).text;
}

/** LaTeX citation command for a paper's generated BibTeX key. */
export function paperLatexCitation(paper: Paper): string {
  return `\\cite{${citationKey(paper)}}`;
}
