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

from models import Paper

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
