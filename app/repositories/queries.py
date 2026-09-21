"""
Repository browsing queries.

These implement the "organize by..." views for the paper repository:
alphabetical (by title), time added (default), and publication year.

Nothing here touches the filesystem -- sorting/filtering is purely a
database query concern. The physical files stay put in storage/papers/
regardless of which view the user is browsing.
"""

from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.models.models import Paper

SORT_OPTIONS = {
    "alphabetical": (Paper.title, asc),
    "date_added": (Paper.created_at, desc),   # default: newest first
    "publication_year": (Paper.publication_year, desc),
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
    """
    q = db.query(Paper)

    if search:
        like = f"%{search}%"
        q = q.filter(
            (Paper.title.ilike(like))
            | (Paper.author.ilike(like))
            | (Paper.keywords.ilike(like))
        )
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

    column, default_direction = SORT_OPTIONS.get(sort_by, SORT_OPTIONS["date_added"])
    return q.order_by(default_direction(column)).all()
