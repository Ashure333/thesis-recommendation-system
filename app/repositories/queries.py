"""
Repository browsing queries.

These implement the "organize by..." views for the paper repository:
alphabetical (by title), time added (default), publication year, and
relevance (BM25 over the SQLite FTS5 index when a search term is given).

Nothing here touches the filesystem -- sorting/filtering is purely a
database query concern. The physical files stay put in storage/papers/
regardless of which view the user is browsing.
"""

from sqlalchemy import asc, desc
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.duplicate_detection import (
    _normalize_doi,
    titles_are_duplicates,
)
from app.services.fts_search import ranked_search

SORT_OPTIONS = {
    "alphabetical": (Paper.title, asc),
    "date_added": (Paper.created_at, desc),   # default: newest first
    "publication_year": (Paper.publication_year, desc),
    # Real relevance ordering is BM25 and is applied in filter_papers()
    # below; without a search term it behaves like the default view.
    "relevance": (Paper.created_at, desc),
}


def list_papers(db: Session, sort_by: str = "date_added", ascending: bool | None = None):
    """
    Returns papers ordered by the requested view.

    sort_by: one of "alphabetical", "date_added", "publication_year"
    ascending: overrides the default direction for that view if provided
               (e.g. force publication_year oldest-first).
    """
    if sort_by not in SORT_OPTIONS:
        raise ValueError(f"Unknown sort_by '{sort_by}'. Choose from: {list(SORT_OPTIONS)}")

    column, default_direction = SORT_OPTIONS[sort_by]
    direction = (asc if ascending else desc) if ascending is not None else default_direction

    return db.query(Paper).order_by(direction(column)).all()


def search_papers(db: Session, query: str, sort_by: str = "alphabetical"):
    """
    Simple title/author/keyword text search, combined with one of the
    same sort views above.
    """
    like = f"%{query}%"
    q = db.query(Paper).filter(
        (Paper.title.ilike(like))
        | (Paper.author.ilike(like))
        | (Paper.keywords.ilike(like))
    )

    column, default_direction = SORT_OPTIONS.get(sort_by, SORT_OPTIONS["alphabetical"])
    return q.order_by(default_direction(column)).all()


def _apply_sidebar_filters(
    q,
    subject: str | None,
    category: str | None,
    document_type: str | None,
    min_year: int | None,
    max_year: int | None,
):
    """Apply the Repository sidebar filters shared by both search paths."""

    if subject and subject.lower() != "all subjects":
        q = q.filter(Paper.subject_category.ilike(f"%{subject}%"))
    if category and category.lower() != "all categories":
        q = q.filter(Paper.subject_category.ilike(f"%{category}%"))
    if document_type and document_type.lower() != "all":
        q = q.filter(Paper.document_type == document_type)
    if min_year is not None:
        q = q.filter(Paper.publication_year >= min_year)
    if max_year is not None:
        q = q.filter(Paper.publication_year <= max_year)

    return q


def _collapse_duplicate_papers(papers: list[Paper]) -> list[Paper]:
    """
    Collapse near-duplicate Paper rows in a best-first ranked list.

    Two papers are duplicates when their normalized DOIs are equal
    (both present) or when their titles score at or above
    TITLE_DUPLICATE_THRESHOLD. Similarity is transitive, so groups
    (A~B, B~C) are merged with union-find; the first -- i.e.
    best-ranked -- member of each group survives.

    Each survivor gets a transient `duplicate_count` attribute holding
    the number of suppressed copies (0 when it has none). Order is
    preserved.
    """

    if len(papers) < 2:
        for paper in papers:
            paper.duplicate_count = 0
        return papers

    parent = list(range(len(papers)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    # Normalize once up front rather than per comparison.
    dois = [_normalize_doi(paper.doi) for paper in papers]
    titles = [
        paper.title if paper.title and paper.title.strip() else None
        for paper in papers
    ]

    for i in range(len(papers)):
        for j in range(i + 1, len(papers)):
            if dois[i] is not None and dois[i] == dois[j]:
                union(i, j)
            elif titles_are_duplicates(titles[i], titles[j]):
                union(i, j)

    survivors: dict[int, Paper] = {}
    collapsed: list[Paper] = []

    for index, paper in enumerate(papers):
        root = find(index)
        survivor = survivors.get(root)

        if survivor is None:
            paper.duplicate_count = 0
            survivors[root] = paper
            collapsed.append(paper)
            continue

        survivor.duplicate_count += 1

        # A suppressed copy can only improve the survivor's snippet.
        if not getattr(survivor, "search_snippet", None):
            suppressed_snippet = getattr(paper, "search_snippet", None)
            if suppressed_snippet:
                survivor.search_snippet = suppressed_snippet

    return collapsed


def _relevance_search(
    db: Session,
    search: str,
    subject: str | None,
    category: str | None,
    document_type: str | None,
    min_year: int | None,
    max_year: int | None,
):
    """
    BM25-ranked search over the FTS5 index.

    Returns the matching Paper rows best-first with `paper.search_snippet`
    attached as a transient attribute (no DB column), or None when the
    FTS index is unavailable so the caller can fall back to ILIKE.

    Near-duplicate rows (same normalized DOI, or titles at/above
    TITLE_DUPLICATE_THRESHOLD) are collapsed to the best-ranked copy,
    which also carries `paper.duplicate_count`.
    """

    try:
        hits = ranked_search(db, search)
    except OperationalError:
        # No FTS5 support, or the index table is missing -- let the
        # caller transparently run the legacy ILIKE query instead.
        return None

    if not hits:
        return []

    paper_ids = [hit.paper_id for hit in hits]

    q = db.query(Paper).filter(Paper.id.in_(paper_ids))
    q = _apply_sidebar_filters(
        q,
        subject,
        category,
        document_type,
        min_year,
        max_year,
    )

    papers_by_id = {paper.id: paper for paper in q.all()}

    ranked_papers: list[Paper] = []

    for hit in hits:
        paper = papers_by_id.get(hit.paper_id)

        if paper is None:
            # Excluded by a sidebar filter.
            continue

        paper.search_snippet = hit.snippet
        ranked_papers.append(paper)

    return _collapse_duplicate_papers(ranked_papers)


def filter_papers(
    db: Session,
    search: str | None = None,
    subject: str | None = None,
    category: str | None = None,
    document_type: str | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    sort_by: str = "date_added",
):
    """
    Combined search + sidebar-filter query for the Repository page.

    `subject` and `category` both match against Paper.subject_category
    (substring match) since that's currently one field storing both --
    e.g. a row with subject_category "Computer Science: Machine Learning"
    matches subject="Computer Science" and also category="Machine Learning".

    sort_by="relevance" with a search term ranks by BM25 (best first);
    without a search term it behaves like the default date_added view.
    When the FTS index is unavailable the legacy ILIKE search is used
    instead, so callers never see a failure.
    """

    if sort_by == "relevance" and search:
        ranked = _relevance_search(
            db,
            search=search,
            subject=subject,
            category=category,
            document_type=document_type,
            min_year=min_year,
            max_year=max_year,
        )

        if ranked is not None:
            return ranked

    q = db.query(Paper)

    if search:
        like = f"%{search}%"
        q = q.filter(
            (Paper.title.ilike(like))
            | (Paper.author.ilike(like))
            | (Paper.keywords.ilike(like))
        )

    q = _apply_sidebar_filters(
        q,
        subject,
        category,
        document_type,
        min_year,
        max_year,
    )

    column, default_direction = SORT_OPTIONS.get(sort_by, SORT_OPTIONS["date_added"])
    return q.order_by(default_direction(column)).all()
