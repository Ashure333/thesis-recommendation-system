"""
SQLite FTS5 ranked search over the papers table.

The repository search uses BM25 ranking instead of the legacy ILIKE
scan. FTS5 ships with most SQLite builds but not all of them, so every
entry point here degrades gracefully: callers catch OperationalError
and fall back to the legacy ILIKE query in app/repositories/queries.py.

The virtual table is an external-content table -- it stores only the
inverted index and reads its column values from `papers` itself, with
triggers keeping the index in sync on INSERT/UPDATE/DELETE.
"""

import re
import sqlite3
from contextlib import contextmanager
from typing import NamedTuple

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session


FTS_TABLE = "papers_fts"

# bm25() column weights, in table order: title, author, keywords,
# abstract. A title hit must always outrank an abstract-only hit.
BM25_WEIGHTS = (10.0, 5.0, 5.0, 1.0)

# How many tokens of context snippet() keeps around the match.
SNIPPET_TOKENS = 12

# "Alphanumeric-ish" tokenizer for user input: letters/digits in any
# script (so CJK survives), but no FTS5 syntax characters such as
# quotes, asterisks, colons, hyphens or parentheses.
_TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)


class RankedPaper(NamedTuple):
    """One BM25 hit: paper id, best-column snippet, and raw score."""

    paper_id: int
    snippet: str | None
    score: float


_CREATE_TABLE_SQL = f"""
CREATE VIRTUAL TABLE IF NOT EXISTS {FTS_TABLE} USING fts5(
    title,
    author,
    keywords,
    abstract,
    content='papers',
    content_rowid='id',
    tokenize='unicode61'
)
"""

_CREATE_INSERT_TRIGGER_SQL = f"""
CREATE TRIGGER IF NOT EXISTS {FTS_TABLE}_ai
AFTER INSERT ON papers BEGIN
    INSERT INTO {FTS_TABLE}(rowid, title, author, keywords, abstract)
    VALUES (new.id, new.title, new.author, new.keywords, new.abstract);
END
"""

_CREATE_DELETE_TRIGGER_SQL = f"""
CREATE TRIGGER IF NOT EXISTS {FTS_TABLE}_ad
AFTER DELETE ON papers BEGIN
    INSERT INTO {FTS_TABLE}({FTS_TABLE}, rowid, title, author, keywords, abstract)
    VALUES ('delete', old.id, old.title, old.author, old.keywords, old.abstract);
END
"""

_CREATE_UPDATE_TRIGGER_SQL = f"""
CREATE TRIGGER IF NOT EXISTS {FTS_TABLE}_au
AFTER UPDATE ON papers BEGIN
    INSERT INTO {FTS_TABLE}({FTS_TABLE}, rowid, title, author, keywords, abstract)
    VALUES ('delete', old.id, old.title, old.author, old.keywords, old.abstract);

    INSERT INTO {FTS_TABLE}(rowid, title, author, keywords, abstract)
    VALUES (new.id, new.title, new.author, new.keywords, new.abstract);
END
"""

# snippet(..., -1, ...) lets FTS5 pick the best matching column for us
# (the column with the most matching tokens); empty start/end markers
# keep the snippet plain text rather than HTML.
_RANKED_SEARCH_SQL = f"""
SELECT
    {FTS_TABLE}.rowid AS paper_id,
    snippet({FTS_TABLE}, -1, '', '', ' … ', {SNIPPET_TOKENS}) AS search_snippet,
    bm25({FTS_TABLE}, :w_title, :w_author, :w_keywords, :w_abstract) AS bm25_score
FROM {FTS_TABLE}
WHERE {FTS_TABLE} MATCH :match_query
ORDER BY bm25_score ASC
"""


@contextmanager
def _borrow_connection(db_or_engine):
    """
    Yield a SQLAlchemy Connection for the given Session/Engine/Connection.

    A caller-owned Session or Connection is never closed here; only a
    connection opened by this helper for an Engine is released again.
    """

    if isinstance(db_or_engine, Session):
        yield db_or_engine.connection()
        return

    if isinstance(db_or_engine, Engine):
        with db_or_engine.connect() as connection:
            yield connection
        return

    # Already an open Connection.
    yield db_or_engine


def fts_available(db_or_engine=None) -> bool:
    """
    True when this SQLite build can use FTS5.

    With a Session/Engine/Connection the probe runs against that
    database; with no argument it probes a throwaway in-memory database
    (pysqlite and SQLAlchemy share the same SQLite library).
    """

    if db_or_engine is None:
        connection = sqlite3.connect(":memory:")
        try:
            connection.execute(
                "CREATE VIRTUAL TABLE temp.__fts5_probe USING fts5(x)"
            )
            connection.execute("DROP TABLE temp.__fts5_probe")
            return True
        except sqlite3.Error:
            return False
        finally:
            connection.close()

    try:
        with _borrow_connection(db_or_engine) as connection:
            connection.exec_driver_sql(
                "CREATE VIRTUAL TABLE IF NOT EXISTS "
                "temp.__fts5_probe USING fts5(x)"
            )
            connection.exec_driver_sql(
                "DROP TABLE IF EXISTS temp.__fts5_probe"
            )
        return True
    except Exception:
        return False


def ensure_fts_index(db_or_engine) -> bool:
    """
    Create (if needed) and synchronize the FTS5 index over `papers`.

    Idempotent -- safe to call on every startup. Creates the external
    content table and its INSERT/UPDATE/DELETE triggers, then rebuilds
    the index whenever it is empty or its row count no longer matches
    the `papers` table (e.g. after an import that bypassed the
    triggers). Returns False when the SQLite build has no FTS5, so
    callers can keep using the legacy ILIKE search.
    """

    if not fts_available(db_or_engine):
        return False

    statements = (
        _CREATE_TABLE_SQL,
        _CREATE_INSERT_TRIGGER_SQL,
        _CREATE_DELETE_TRIGGER_SQL,
        _CREATE_UPDATE_TRIGGER_SQL,
    )

    if isinstance(db_or_engine, Engine):
        with db_or_engine.begin() as connection:
            return _ensure_on_connection(connection, statements)

    with _borrow_connection(db_or_engine) as connection:
        return _ensure_on_connection(connection, statements)


def _ensure_on_connection(connection, statements) -> bool:
    """Run the FTS DDL and rebuild the index when it is out of date."""

    for statement in statements:
        connection.exec_driver_sql(statement)

    papers_count = connection.exec_driver_sql(
        "SELECT count(*) FROM papers"
    ).scalar()

    # count(*) on the FTS table itself is not reliable for external
    # content: an empty index is answered from the content table, which
    # made a freshly created index look populated. The _docsize shadow
    # table carries exactly one row per indexed document and is the
    # true index row count. A zero here means the index is empty even
    # though the content table is not.
    indexed_count = connection.exec_driver_sql(
        f"SELECT count(*) FROM {FTS_TABLE}_docsize"
    ).scalar()

    if papers_count and indexed_count != papers_count:
        # The special 'rebuild' command re-reads the whole content table
        # into the index; it also covers the fresh-table case.
        connection.exec_driver_sql(
            f"INSERT INTO {FTS_TABLE}({FTS_TABLE}) VALUES('rebuild')"
        )

    return True


def sanitize_query(query: str | None) -> str:
    """
    Turn arbitrary user text into a safe FTS5 MATCH expression.

    Every token is wrapped in double quotes, so FTS5 operators the user
    may have typed (AND/OR/NOT, `*`, `-`, `:`, parentheses, stray
    quotes) are treated as literal phrase text instead of syntax. A
    user-typed trailing `*` is preserved as an FTS5 prefix query, and
    the final token is always treated as a prefix so the search box
    behaves as-you-type ("recommendation" also matches
    "recommendations"). A query with nothing searchable returns ""
    (callers then return no rows rather than raising).
    """

    if not query:
        return ""

    parts: list[str] = []

    for match in _TOKEN_PATTERN.finditer(query):
        token = match.group(0).replace('"', '""')
        quoted = f'"{token}"'

        # e.g. "learn*" -> "learn"* (prefix search)
        if query[match.end():match.end() + 1] == "*":
            quoted += "*"

        parts.append(quoted)

    if not parts:
        return ""

    # The last token is always a prefix, so a query typed before the
    # word is finished still matches the completed word.
    if not parts[-1].endswith("*"):
        parts[-1] += "*"

    return " AND ".join(parts)


def ranked_search(
    db: Session,
    query: str | None,
    limit: int | None = None,
) -> list[RankedPaper]:
    """
    BM25-ranked full-text search, best hit first.

    Returns an empty list when the sanitized query has no searchable
    tokens. Raises OperationalError when the FTS table does not exist
    (e.g. the index could not be created) -- callers are expected to
    catch that and fall back to the legacy ILIKE path.
    """

    match_query = sanitize_query(query)

    if not match_query:
        return []

    parameters = {
        "match_query": match_query,
        "w_title": BM25_WEIGHTS[0],
        "w_author": BM25_WEIGHTS[1],
        "w_keywords": BM25_WEIGHTS[2],
        "w_abstract": BM25_WEIGHTS[3],
    }

    sql = _RANKED_SEARCH_SQL

    if limit is not None:
        sql = f"{sql} LIMIT :limit"
        parameters["limit"] = int(limit)

    rows = db.execute(text(sql), parameters).all()

    results: list[RankedPaper] = []

    for row in rows:
        snippet = row.search_snippet or None

        results.append(
            RankedPaper(
                paper_id=row.paper_id,
                snippet=snippet,
                score=row.bm25_score,
            )
        )

    return results
