"""
Permanently merge near-duplicate Paper rows.

duplicate_detection.py only *prevents* new duplicates at upload time --
its own docstring says so: "a pre-insert check, not a cleanup script".
This module is that cleanup script's engine. Given a group of papers
that find_duplicate_groups() says are the same work, it picks one
master, folds the duplicates' usable metadata into it, repoints every
foreign key that referenced a duplicate, and deletes the duplicate
rows.

Safety properties, in priority order:

    1. One group = one transaction. merge_group() writes and flushes
       but does not commit; merge_all_duplicates() commits after each
       group and, on failure, rolls just that group back and records
       an {"error": ...} entry instead of raising. A bad group can
       never half-merge or take down the groups after it. (Plain
       caller-owned transactions, not SAVEPOINTs: pysqlite's legacy
       transaction handling auto-commits the outermost SAVEPOINT on
       release, which would have made an "outer rollback" silently
       keep the group's writes on real SQLite databases.)
    2. Data flows one way, duplicate -> master, and only into master
       fields that are empty. Non-empty master values are never
       overwritten; the master's title is kept as-is unless missing.
    3. Files on disk are never deleted. A duplicate's stored_path that
       differs from the master's is reported as an orphaned path so a
       human can decide what to do with it.
    4. Merging is idempotent: a second run finds no duplicate groups
       and therefore makes no changes.

The CLI is scripts/merge_duplicate_papers.py; it is dry-run by
default.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.models import (
    Paper,
    PaperCitation,
    PersonalLibrary,
)
from app.services.duplicate_detection import find_duplicate_groups

# The 9-field Paper schema has 8 fields a reference manager can fill
# from a BibTeX/PDF import (citation_count is a metric, not metadata).
# These are the fields choose_master() counts for completeness and the
# only ones merge_group() copies from duplicates.
METADATA_FIELDS = (
    "title",
    "author",
    "abstract",
    "keywords",
    "publication_year",
    "doi",
    "subject_category",
    "document_type",
)


def _is_empty(value) -> bool:
    """None or a blank string counts as missing; 0 does not."""
    if value is None:
        return True

    if isinstance(value, str):
        return not value.strip()

    return False


def _has_pdf(paper: Paper) -> bool:
    return not _is_empty(paper.stored_path)


def _is_preprint_doi(doi: str | None) -> bool:
    """True for known preprint DOI prefixes (arXiv, Preprints.org)."""
    if not doi:
        return False

    value = str(doi).strip().lower()

    return (
        value.startswith("10.48550/")
        or value.startswith("10.20944/")
        or "preprint" in value
    )


def _doi_rank(doi: str | None) -> int:
    """
    Published-looking DOI (2) > no DOI (1) > preprint DOI (0).

    A published record should survive a merge when a preprint twin is
    in the group, but a record with no DOI must not outrank a
    published one just because it has nothing to demote.
    """
    if _is_empty(doi):
        return 1

    return 0 if _is_preprint_doi(doi) else 2


def _filled_metadata_count(paper: Paper) -> int:
    return sum(
        not _is_empty(getattr(paper, field))
        for field in METADATA_FIELDS
    )


def choose_master(papers) -> Paper:
    """
    Pick the row that should survive a merge.

    Candidates are compared lexicographically on, in order:

        1. has a stored_path (a real PDF beats a metadata-only record)
        2. is_valid_for_recommendation
        3. carries a non-preprint DOI (a published record beats a
           preprint record with the same title; arXiv and
           Preprints.org DOIs lose this tiebreak when a published
           twin exists in the group)
        4. number of filled metadata fields
        5. citation_count (None sorts below an explicit 0)
        6. smallest paper id (breaks any remaining tie)

    The ordering is total and deterministic, so the same group always
    yields the same master. Raises ValueError for an empty input.
    """
    papers = list(papers)

    if not papers:
        raise ValueError("choose_master() requires at least one paper")

    def sort_key(paper: Paper):
        return (
            _has_pdf(paper),
            bool(paper.is_valid_for_recommendation),
            _doi_rank(paper.doi),
            _filled_metadata_count(paper),
            (
                paper.citation_count
                if paper.citation_count is not None
                else -1
            ),
            -(paper.id if paper.id is not None else float("inf")),
        )

    return max(papers, key=sort_key)


def merge_group(db: Session, papers) -> dict:
    """
    Merge one duplicate group into its master.

    Returns a summary dict:

        master_id         : id of the surviving paper
        merged_ids        : ids of the duplicate rows that were deleted
        fields_filled     : number of empty master metadata fields
                            populated from duplicates
        library_moved     : PersonalLibrary rows repointed to master
        library_dropped   : PersonalLibrary rows deleted because the
                            user already had master saved
        citations_moved   : PaperCitation rows repointed to master
                            (paper_id and/or matched_paper_id)
        citations_dropped : PaperCitation rows deleted because they
                            would collide with an existing master row
                            on (paper_id, direction, external_work_id)
        orphaned_paths    : duplicate stored_path values that differ
                            from the master's (files are left on disk)

    The writes are flushed, but the enclosing transaction is *not*
    committed -- the caller owns the commit, which is what lets
    merge_all_duplicates() roll a single group back without touching
    the others. A caller that invokes merge_group() directly must
    commit on success and roll back on error. Raises ValueError for
    fewer than two papers; all ORM/DB errors propagate with the
    partial writes still pending for the caller to roll back.
    """
    papers = list(papers)

    if len(papers) < 2:
        raise ValueError("merge_group() requires at least two papers")

    ordered = sorted(papers, key=lambda paper: paper.id)

    return _merge_group(db, ordered)


def _merge_group(db: Session, papers: list[Paper]) -> dict:
    master = choose_master(papers)
    duplicates = [paper for paper in papers if paper.id != master.id]

    result = {
        "master_id": master.id,
        "merged_ids": [paper.id for paper in duplicates],
        "fields_filled": 0,
        "library_moved": 0,
        "library_dropped": 0,
        "citations_moved": 0,
        "citations_dropped": 0,
        "orphaned_paths": [],
    }

    result["fields_filled"] = _fill_missing_fields(master, duplicates)
    _move_library_rows(master, duplicates, result)
    _reassign_citations(db, master, duplicates, result)
    _collect_orphaned_paths(master, duplicates, result)

    # Flush the repointed foreign keys before the duplicate rows go
    # away, so the deletes can never race ahead of the updates.
    db.flush()

    for duplicate in duplicates:
        db.delete(duplicate)

    return result


def _fill_missing_fields(master: Paper, duplicates: list[Paper]) -> int:
    """Copy duplicate values into empty master fields; count fills."""
    filled = 0

    for field in METADATA_FIELDS:
        if not _is_empty(getattr(master, field)):
            continue

        for duplicate in duplicates:
            value = getattr(duplicate, field)

            if not _is_empty(value):
                setattr(master, field, value)
                filled += 1
                break

    return filled


def _move_library_rows(
    master: Paper,
    duplicates: list[Paper],
    result: dict,
) -> None:
    """
    Repoint users' saved-paper rows at the master.

    The (user_id, paper_id) unique constraint means a user who saved
    both the master and a duplicate must not end up with two rows:
    the duplicate's row is deleted instead. Rows are walked in
    duplicate-id order so the "first duplicate wins the move, later
    ones drop" outcome is deterministic.
    """
    master_user_ids = {
        entry.user_id for entry in master.library_entries
    }

    for duplicate in duplicates:
        for entry in list(duplicate.library_entries):
            if entry.user_id in master_user_ids:
                # Removing it from the duplicate's collection (rather
                # than a bare session.delete) lets the delete-orphan
                # cascade own the DELETE; a manual delete on top of
                # the Paper delete would emit it twice.
                duplicate.library_entries.remove(entry)
                result["library_dropped"] += 1
            else:
                entry.paper = master
                master_user_ids.add(entry.user_id)
                result["library_moved"] += 1


def _reassign_citations(
    db: Session,
    master: Paper,
    duplicates: list[Paper],
    result: dict,
) -> None:
    """
    Repoint citation rows at the master.

    Two columns reference papers: `paper_id` (whose citation this is)
    and `matched_paper_id` (the local paper an external work resolved
    to). paper_id rows can collide with an existing master row on the
    (paper_id, direction, external_work_id) unique constraint; the
    duplicate's row loses and is dropped. matched_paper_id has no
    unique constraint, so those are always repointed.

    A row whose paper_id *and* matched_paper_id both point at
    duplicates is still one moved row, not two.
    """
    master_keys = {
        (row.direction, row.external_work_id)
        for row in (
            db.query(PaperCitation)
            .filter(PaperCitation.paper_id == master.id)
            .all()
        )
    }

    moved_row_ids: set[int] = set()
    dropped_row_ids: set[int] = set()

    # Phase 1: paper_id references. Conflicts are dropped.
    for duplicate in duplicates:
        rows = (
            db.query(PaperCitation)
            .filter(PaperCitation.paper_id == duplicate.id)
            .order_by(PaperCitation.id)
            .all()
        )

        for row in rows:
            key = (row.direction, row.external_work_id)

            if key in master_keys:
                db.delete(row)
                dropped_row_ids.add(row.id)
                result["citations_dropped"] += 1
            else:
                row.paper_id = master.id
                master_keys.add(key)
                moved_row_ids.add(row.id)
                result["citations_moved"] += 1

    # Phase 2: matched_paper_id references. No constraint to satisfy
    # (a self-reference after merging is allowed), but rows already
    # dropped in phase 1 are skipped even if a no-autoflush query
    # still returns them.
    for duplicate in duplicates:
        rows = (
            db.query(PaperCitation)
            .filter(PaperCitation.matched_paper_id == duplicate.id)
            .order_by(PaperCitation.id)
            .all()
        )

        for row in rows:
            if row.id in dropped_row_ids:
                continue

            row.matched_paper_id = master.id

            if row.id not in moved_row_ids:
                moved_row_ids.add(row.id)
                result["citations_moved"] += 1


def _collect_orphaned_paths(
    master: Paper,
    duplicates: list[Paper],
    result: dict,
) -> None:
    for duplicate in duplicates:
        path = duplicate.stored_path

        if not _is_empty(path) and path != master.stored_path:
            result["orphaned_paths"].append(path)


def merge_all_duplicates(db: Session) -> list[dict]:
    """
    Find every duplicate group and merge it, one transaction per group.

    Returns one entry per group in the order find_duplicate_groups()
    produced it: either a merge_group() summary or, if that group
    failed, {"error": "<ExceptionType>: <message>", "paper_ids":
    [...]}. The failed group is rolled back and the earlier/later
    groups are unaffected, so the database is never left half-merged.

    Callers should treat the presence of an "error" key as failure of
    that group only; the CLI exits non-zero if any group failed.
    """
    results: list[dict] = []

    for group in find_duplicate_groups(db):
        paper_ids = sorted(paper.id for paper in group)

        try:
            result = merge_group(db, group)
            db.commit()
        except Exception as error:
            db.rollback()
            results.append(
                {
                    "error": f"{type(error).__name__}: {error}",
                    "paper_ids": paper_ids,
                }
            )
        else:
            results.append(result)

    return results
