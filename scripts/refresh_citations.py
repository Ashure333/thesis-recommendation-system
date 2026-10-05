"""
Refresh cached OpenAlex citation data (P2-A).

Populates the paper_citations table for papers that have a DOI, so
the similar-papers graph can add bibliographic coupling and
co-citation to its edge weights.

Examples (run from the repository root):

    # The 25 oldest papers with DOIs
    .venv/bin/python scripts/refresh_citations.py --all

    # One paper by local id
    .venv/bin/python scripts/refresh_citations.py --paper-id 12

    # Several papers, against a scratch database
    .venv/bin/python scripts/refresh_citations.py \
        --paper-id 12 --paper-id 15 --db /tmp/scratch.db

Network failures are reported per paper, never raised; re-running is
safe because refresh_paper_citations replaces each direction.
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

from app.database import SessionLocal
from app.models.models import Paper
from app.services.citations import refresh_paper_citations

DEFAULT_DB_PATH = REPO_ROOT / "app" / "data" / "academic_repository.db"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Refresh OpenAlex citation rows for local papers with "
            "DOIs."
        ),
    )

    parser.add_argument(
        "--paper-id",
        dest="paper_ids",
        type=int,
        action="append",
        default=None,
        help=(
            "Local paper id to refresh; repeatable. Takes "
            "precedence over --all."
        ),
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help=(
            "Refresh every paper with a DOI (up to --limit)."
        ),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=25,
        help=(
            "Maximum number of papers selected by --all "
            "(default: 25)."
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

    return parser


def _open_session(db_path: Path):
    """Reuse the app's session for the real DB, else open the path."""
    if db_path == DEFAULT_DB_PATH.resolve():
        return SessionLocal(), None

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    return (
        sessionmaker(
            bind=engine,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )(),
        engine,
    )


def _select_papers(db, args, parser) -> list[Paper]:
    if args.paper_ids:
        papers = (
            db.query(Paper)
            .filter(Paper.id.in_(args.paper_ids))
            .order_by(Paper.id)
            .all()
        )

        found = {paper.id for paper in papers}

        for missing in sorted(set(args.paper_ids) - found):
            print(f"warning: no paper with id={missing}")

        return papers

    if not args.all:
        parser.error(
            "select papers with --paper-id or --all."
        )

    return (
        db.query(Paper)
        .filter(
            Paper.doi.isnot(None),
            Paper.doi != "",
        )
        .order_by(Paper.id)
        .limit(max(0, args.limit))
        .all()
    )


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    db_path = Path(args.db).expanduser().resolve()

    if not db_path.is_file():
        print(
            f"error: database not found: {db_path}",
            file=sys.stderr,
        )
        return 2

    db = None
    engine = None

    try:
        db, engine = _open_session(db_path)
        papers = _select_papers(db, args, parser)

        if not papers:
            print("No papers with DOIs matched the selection.")
            return 0

        ok_count = 0
        fail_count = 0
        cites_total = 0
        cited_by_total = 0

        for index, paper in enumerate(papers, start=1):
            result = refresh_paper_citations(db, paper)

            if result.get("ok"):
                ok_count += 1
                cites_total += result.get("cites", 0)
                cited_by_total += result.get("cited_by", 0)

                warning = result.get("warning")

                line = (
                    f"[{index}/{len(papers)}] paper {paper.id}: ok "
                    f"(cites={result.get('cites', 0)}, "
                    f"cited_by={result.get('cited_by', 0)}, "
                    f"matched={result.get('matched', 0)})"
                )

                if warning:
                    line += f" warning={warning}"

                print(line)
            else:
                fail_count += 1
                print(
                    f"[{index}/{len(papers)}] paper {paper.id}: "
                    f"failed ({result.get('reason', 'unknown')})"
                )

        print()
        print(
            f"Processed: {len(papers)}  "
            f"ok: {ok_count}  failed: {fail_count}"
        )
        print(
            f"Rows stored this run: "
            f"cites={cites_total} cited_by={cited_by_total}"
        )

        return 0

    except Exception as error:
        # Defensive: the per-paper refresh already swallows network
        # errors, but a script should still exit cleanly on an
        # unexpected DB failure.
        print(f"error: {error}", file=sys.stderr)
        return 1

    finally:
        if db is not None:
            db.close()

        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
