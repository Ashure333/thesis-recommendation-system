"""
Bulk-attaches PDFs to existing citation-only papers already in the
database, using the same automatic PDF-discovery logic introduced in
app/services/upload_paper.py for new uploads (_try_auto_attach_pdf).

This is the retroactive counterpart to that upload-time feature: it
lets papers imported *before* auto-attach existed benefit from it too,
without needing to be re-uploaded.

Only touches papers whose stored_path does not already end in .pdf --
a paper with a real PDF already attached is left completely alone.
Safe to re-run: papers that already got a PDF on a previous run are
skipped the next time, and papers with no confident candidate are
simply skipped again.

Run from the project root:

    python -m scripts.auto_attach_existing_papers

Optional: limit how many papers to attempt in one run:

    python -m scripts.auto_attach_existing_papers --limit 20
"""

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.database import SessionLocal
from app.models.models import Paper
from app.services.pdf_finder import find_pdf_candidates
from app.services.upload_paper import _try_auto_attach_pdf


def _needs_pdf(paper: Paper) -> bool:
    """True when this paper has no real PDF file stored yet."""
    if not paper.stored_path:
        return True

    return not paper.stored_path.lower().endswith(".pdf")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Retroactively attach PDFs to citation-only papers "
            "already in the repository."
        )
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of papers to attempt in this run.",
    )

    args = parser.parse_args()

    db = SessionLocal()

    try:
        papers = db.query(Paper).order_by(Paper.id).all()

        needing_pdf = [
            paper for paper in papers if _needs_pdf(paper)
        ]

        if args.limit is not None:
            needing_pdf = needing_pdf[: args.limit]

        print("=" * 60)
        print("BULK AUTO-ATTACH")
        print("=" * 60)
        print(f"Total papers in repository: {len(papers)}")
        print(f"Papers without a stored PDF: {len(needing_pdf)}")
        print()

        attached_count = 0
        skipped_count = 0
        failed_count = 0

        for index, paper in enumerate(needing_pdf, start=1):
            print(
                f"[{index}/{len(needing_pdf)}] "
                f"id={paper.id} {paper.title!r}"
            )

            if not paper.title:
                print("  [SKIP] No title to search with.")
                skipped_count += 1
                continue

            try:
                pdf_candidates = find_pdf_candidates(paper)
            except Exception as exc:
                print(f"  [ERROR] PDF discovery failed: {exc}")
                failed_count += 1
                continue

            if not pdf_candidates:
                print("  [SKIP] No PDF candidates found.")
                skipped_count += 1
                continue

            try:
                attached = _try_auto_attach_pdf(paper, pdf_candidates)
            except Exception as exc:
                print(f"  [ERROR] Attach attempt failed: {exc}")
                failed_count += 1
                continue

            if attached:
                try:
                    db.commit()
                    db.refresh(paper)
                except Exception as exc:
                    db.rollback()
                    print(f"  [ERROR] Commit failed: {exc}")
                    failed_count += 1
                    continue

                attached_count += 1
                print(f"  [ATTACHED] stored_path={paper.stored_path}")
            else:
                skipped_count += 1
                print(
                    "  [SKIP] Best candidate below confidence "
                    "threshold, or already had a PDF."
                )

        print()
        print("=" * 60)
        print("BULK AUTO-ATTACH COMPLETE")
        print("=" * 60)
        print(f"Attached: {attached_count}")
        print(f"Skipped:  {skipped_count}")
        print(f"Failed:   {failed_count}")
        print()

        if attached_count > 0:
            print(
                "Note: this only fills stored_path -- it does not "
                "itself change title/abstract/keywords/year. If you "
                "also want to re-run metadata enrichment against the "
                "papers that just got a PDF, run:"
            )
            print()
            print("    python -m scripts.enrich_existing_papers")
            print()

    finally:
        db.close()


if __name__ == "__main__":
    main()