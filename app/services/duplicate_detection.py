"""
Duplicate-paper detection.

Runs before a new paper is inserted, to catch the common case of the
same paper being uploaded twice -- e.g. a PDF and its own BibTeX
citation imported separately, the same Google Scholar citation pasted
twice, or a re-run of a test upload.

Two signals are checked, in order of reliability:

    1. Exact DOI match -- DOIs are globally unique identifiers, so an
       exact match (case-insensitive, with any doi.org/https prefix
       stripped) is treated as a certain duplicate.
    2. Title similarity -- reuses the same blended similarity measure
       app/services/pdf_finder.py already trusts for candidate
       matching (title_similarity), so "duplicate enough" here uses
       the same bar this codebase already relies on elsewhere to
       decide two titles refer to the same paper.

This is a pre-insert check, not a cleanup script -- it prevents new
duplicates rather than finding ones already in the database.
"""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.pdf_finder import title_similarity

# Stricter than pdf_finder.py's MIN_CONFIDENCE (0.5), which only needs
# to be confident enough to *suggest* a PDF candidate for review.
# Treating two papers as duplicates is a much higher-stakes decision
# -- it blocks an upload outright -- so this bar is deliberately
# higher to avoid false positives on merely-similar titles (e.g. two
# different survey papers on the same topic).
TITLE_DUPLICATE_THRESHOLD = 0.85


class DuplicatePaperError(Exception):
    """
    Raised when a paper being uploaded appears to already exist in
    the repository. Callers (app/api.py) catch this to return a
    clear, actionable error instead of silently creating a duplicate
    record.
    """

    def __init__(self, existing_paper: Paper):
        self.existing_paper = existing_paper
        super().__init__(
            f"A paper with a matching title or DOI already exists "
            f"(id={existing_paper.id}: {existing_paper.title!r})."
        )


def _normalize_doi(doi: str | None) -> str | None:
    if not doi:
        return None

    doi = doi.strip().lower()
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi)

    return doi or None


def find_duplicate_paper(
    db: Session,
    title: str | None,
    doi: str | None,
) -> Paper | None:
    """
    Returns the existing Paper this looks like a duplicate of, or
    None if no confident match is found.
    """

    # ---------------------------------------------------------
    # Signal 1: exact DOI match
    # ---------------------------------------------------------
    normalized_doi = _normalize_doi(doi)

    if normalized_doi:
        existing_with_doi = (
            db.query(Paper)
            .filter(Paper.doi.isnot(None))
            .all()
        )

        for candidate in existing_with_doi:
            if _normalize_doi(candidate.doi) == normalized_doi:
                return candidate

    # ---------------------------------------------------------
    # Signal 2: high title similarity
    # ---------------------------------------------------------
    if title and title.strip():
        existing_with_title = (
            db.query(Paper)
            .filter(Paper.title.isnot(None))
            .all()
        )

        best_match: Paper | None = None
        best_score = 0.0

        for candidate in existing_with_title:
            score = title_similarity(title, candidate.title)

            if score > best_score:
                best_score = score
                best_match = candidate

        if best_match is not None and best_score >= TITLE_DUPLICATE_THRESHOLD:
            return best_match

    return None