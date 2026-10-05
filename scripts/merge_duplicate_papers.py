"""
Permanently merge near-duplicate papers in the repository.

Finds groups of papers that duplicate_detection.find_duplicate_groups()
considers the same work, picks a master per group
(merge_duplicates.choose_master), and with --apply folds each group
into its master: missing metadata is copied, personal-library rows and
citation references are repointed, and the duplicate rows are deleted.
Files on disk are never touched; a duplicate PDF path that differs
from the master's is reported as an orphan.

Dry-run is the default: nothing is written unless --apply is passed.

Examples (run from the repository root):

    # Preview every group and the master that would survive
    .venv/bin/python scripts/merge_duplicate_papers.py

    # Merge them for real
    .venv/bin/python scripts/merge_duplicate_papers.py --apply

    # A scratch/test copy
    .venv/bin/python scripts/merge_duplicate_papers.py \
        --db /tmp/scratch.db --apply

Exit codes:
    0  success (dry run completed, or every group merged)
    1  at least one group failed and was rolled back
    2  the --db path does not exist
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.services.duplicate_detection import find_duplicate_groups
from app.services.merge_duplicates import (
    choose_master,
    merge_all_duplicates,
)

DEFAULT_DB_PATH = (
    REPO_ROOT / "app" / "data" / "academic_repository.db"
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Permanently merge near-duplicate Paper rows. Dry-run "
            "unless --apply is given."
        ),
    )

    parser.add_argument(
        "--db",
        type=str,
        default=str(DEFAULT_DB_PATH),
        help=(
            "SQLite database path "
            f"(default: {DEFAULT_DB_PATH})."
        ),
    )

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Only print the duplicate groups and their chosen "
            "masters (this is the default)."
        ),
    )
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Perform the merges and print the summary.",
    )

    return parser


def _open_session(db_path: Path):
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    db = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )()

    return db, engine


def _print_dry_run(groups) -> None:
    print(f"Found {len(groups)} duplicate group(s).\n")

    for index, group in enumerate(groups, start=1):
        master = choose_master(group)

        print(
            f"Group {index}: {len(group)} papers, "
            f"master id={master.id}"
        )

        for paper in group:
            role = "master   " if paper.id == master.id else "duplicate"
            title = (paper.title or "").strip() or "(untitled)"
            line = f"  [{role}] id={paper.id}  {title}"

            if paper.doi:
                line += f"  (doi={paper.doi})"

            if paper.stored_path:
                line += f"  (path={paper.stored_path})"

            print(line)

        print()

    print(
        "Dry run: no changes were made. Re-run with --apply to merge."
    )


def _print_apply_result(index: int, result: dict) -> None:
    if "error" in result:
        print(
            f"Group {index}: ERROR {result['error']} "
            f"(paper ids {result['paper_ids']}) -- rolled back"
        )
        return

    print(
        f"Group {index}: master id={result['master_id']}, "
        f"merged ids={result['merged_ids']}, "
        f"fields_filled={result['fields_filled']}, "
        f"library moved/dropped="
        f"{result['library_moved']}/{result['library_dropped']}, "
        f"citations moved/dropped="
        f"{result['citations_moved']}/{result['citations_dropped']}"
    )

    if result["orphaned_paths"]:
        print(
            "  orphaned paths (files left on disk): "
            + ", ".join(result["orphaned_paths"])
        )


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    db_path = Path(args.db).expanduser().resolve()

    if not db_path.is_file():
        print(f"error: database not found: {db_path}", file=sys.stderr)
        return 2

    db = None
    engine = None

    try:
        db, engine = _open_session(db_path)

        if not args.apply:
            groups = find_duplicate_groups(db)
            _print_dry_run(groups)
            return 0

        results = merge_all_duplicates(db)

        if not results:
            print("No duplicate groups found. Nothing to merge.")
            return 0

        merged_groups = 0
        failed_groups = 0
        removed_papers = 0
        fields_filled = 0
        library_moved = 0
        library_dropped = 0
        citations_moved = 0
        citations_dropped = 0
        orphaned_paths: list[str] = []

        for index, result in enumerate(results, start=1):
            _print_apply_result(index, result)

            if "error" in result:
                failed_groups += 1
                continue

            merged_groups += 1
            removed_papers += len(result["merged_ids"])
            fields_filled += result["fields_filled"]
            library_moved += result["library_moved"]
            library_dropped += result["library_dropped"]
            citations_moved += result["citations_moved"]
            citations_dropped += result["citations_dropped"]
            orphaned_paths.extend(result["orphaned_paths"])

        print()
        print(
            f"Merged {merged_groups} group(s), removed "
            f"{removed_papers} duplicate paper(s); "
            f"failed groups: {failed_groups}."
        )
        print(
            f"fields_filled={fields_filled} "
            f"library moved/dropped={library_moved}/{library_dropped} "
            f"citations moved/dropped="
            f"{citations_moved}/{citations_dropped} "
            f"orphaned_paths={len(orphaned_paths)}"
        )

        if orphaned_paths:
            print("Orphaned paths (files left on disk):")

            for path in orphaned_paths:
                print(f"  {path}")

        return 1 if failed_groups else 0

    except Exception as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    finally:
        if db is not None:
            db.close()

        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
