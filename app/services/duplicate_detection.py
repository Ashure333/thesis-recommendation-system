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

from sqlalchemy import func
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

# Titles shorter than this carry too little signal for a fuzzy match
# to mean anything: garbled extraction titles such as "]OC.htam[" and
# "]AN.htam[" differ by two characters yet score well above the
# threshold, and merging those would destroy distinct records. Exact
# normalized equality still counts at any length.
MIN_DUPLICATE_TITLE_LENGTH = 12


def _normalized_title(title: str | None) -> str | None:
    """Whitespace-collapsed, casefolded title (None when blank)."""
    if not title:
        return None

    collapsed = " ".join(str(title).split())

    return collapsed.casefold() or None


def titles_are_duplicates(
    title_a: str | None,
    title_b: str | None,
) -> bool:
    """
    True when two titles are safe to treat as the same work.

    Exact normalized equality always counts. Fuzzy matching only
    applies when both titles are at least MIN_DUPLICATE_TITLE_LENGTH
    characters long, so short or garbled extraction titles cannot
    produce false duplicate matches.
    """
    first = _normalized_title(title_a)
    second = _normalized_title(title_b)

    if first is None or second is None:
        return False

    if first == second:
        return True

    if (
        len(first) < MIN_DUPLICATE_TITLE_LENGTH
        or len(second) < MIN_DUPLICATE_TITLE_LENGTH
    ):
        return False

    return title_similarity(first, second) >= TITLE_DUPLICATE_THRESHOLD


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


_WORD = re.compile(r"[^\W_]+", re.UNICODE)


def _title_words(normalized: str | None) -> set[str]:
    return set(_WORD.findall(normalized or ""))


def _could_be_duplicate(
    wanted: str | None,
    wanted_words: set[str],
    other_title: str | None,
) -> bool:
    """
    A fast screen in front of titles_are_duplicates(): titles that are
    equal always pass, and fuzzy matches (>= 0.85 similar) share most of
    their words, so titles sharing fewer than 40% of the shorter one's
    words are skipped without computing a similarity.
    """

    other = _normalized_title(other_title)

    if wanted is None or other is None:
        return False

    if wanted == other:
        return True

    other_words = _title_words(other)
    smaller = min(len(wanted_words), len(other_words))

    if smaller == 0:
        return False

    return len(wanted_words & other_words) >= max(1, 0.4 * smaller)


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
    #
    # The database narrows the candidates (a LIKE over the lower-cased
    # DOI); equality is then confirmed on the normalized value, so the
    # answer is the same as comparing every stored DOI, without reading
    # them all.
    # ---------------------------------------------------------
    normalized_doi = _normalize_doi(doi)

    if normalized_doi:
        near_doi = (
            db.query(Paper)
            .filter(Paper.doi.isnot(None))
            .filter(
                func.lower(Paper.doi).contains(
                    normalized_doi,
                    autoescape=True,
                )
            )
            .all()
        )

        for candidate in near_doi:
            if _normalize_doi(candidate.doi) == normalized_doi:
                return candidate

    # ---------------------------------------------------------
    # Signal 2: high title similarity
    #
    # Only ids and titles are read, and a cheap word-overlap test skips
    # the expensive similarity measure for titles that cannot possibly
    # reach the threshold.
    # ---------------------------------------------------------
    if title and title.strip():
        wanted = _normalized_title(title)
        wanted_words = _title_words(wanted)

        best_id: int | None = None
        best_score = 0.0

        rows = (
            db.query(Paper.id, Paper.title)
            .filter(Paper.title.isnot(None))
            .all()
        )

        for paper_id, existing_title in rows:
            if not _could_be_duplicate(
                wanted,
                wanted_words,
                existing_title,
            ):
                continue

            if not titles_are_duplicates(title, existing_title):
                continue

            score = title_similarity(title, existing_title)

            if wanted == _normalized_title(existing_title):
                score = 1.0

            if score > best_score:
                best_score = score
                best_id = paper_id

        if best_id is not None and best_score >= TITLE_DUPLICATE_THRESHOLD:
            return db.get(Paper, best_id)

    return None


def find_duplicate_groups(db: Session) -> list[list[Paper]]:
    """
    Group every Paper in the repository that looks like the same work.

    The pre-insert check above only ever compares a *new* paper against
    what is already stored. This helper is the offline counterpart for
    duplicates that already slipped in: it builds an undirected graph
    where two papers are connected when either

        1. their normalized DOIs are identical (an exact identifier
           match), or
        2. both titles are present and title_similarity() reaches
           TITLE_DUPLICATE_THRESHOLD.

    and returns the connected components (union-find). Transitivity
    matters: if A matches B by DOI and B matches C by title, all three
    land in one group even though A and C may share neither signal.

    Only components with 2+ papers are returned. Each group is sorted
    by paper id, and groups are ordered by their smallest paper id, so
    callers and tests see a deterministic result regardless of the
    database's row order.

    Cost is O(n^2) in title comparisons, which is fine for a manual
    cleanup tool; this is not called on the upload path.
    """

    papers = db.query(Paper).order_by(Paper.id).all()

    parent: dict[int, int] = {paper.id: paper.id for paper in papers}

    def find(paper_id: int) -> int:
        root = paper_id

        while parent[root] != root:
            root = parent[root]

        # Path compression keeps repeated lookups cheap.
        while parent[paper_id] != root:
            parent[paper_id], paper_id = root, parent[paper_id]

        return root

    def union(left_id: int, right_id: int) -> None:
        left_root = find(left_id)
        right_root = find(right_id)

        if left_root != right_root:
            # Attach the larger root to the smaller one so component
            # roots stay stable and deterministic.
            high, low = max(left_root, right_root), min(
                left_root, right_root
            )
            parent[high] = low

    # Signal 1: exact normalized-DOI equality.
    doi_owners: dict[str, int] = {}

    for paper in papers:
        normalized = _normalize_doi(paper.doi)

        if not normalized:
            continue

        owner_id = doi_owners.get(normalized)

        if owner_id is None:
            doi_owners[normalized] = paper.id
        else:
            union(owner_id, paper.id)

    # Signal 2: title similarity, only between non-null/non-blank
    # titles (title_similarity itself would return 0.0 for those
    # anyway, but skipping them avoids pointless comparisons).
    titled = [
        paper
        for paper in papers
        if paper.title and paper.title.strip()
    ]

    for index, left in enumerate(titled):
        for right in titled[index + 1:]:
            if titles_are_duplicates(left.title, right.title):
                union(left.id, right.id)

    components: dict[int, list[Paper]] = {}

    for paper in papers:
        components.setdefault(find(paper.id), []).append(paper)

    groups = [
        sorted(component, key=lambda paper: paper.id)
        for component in components.values()
        if len(component) >= 2
    ]

    groups.sort(key=lambda group: group[0].id)

    return groups