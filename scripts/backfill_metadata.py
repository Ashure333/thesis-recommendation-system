"""
Backfill missing paper metadata from stored source files.

This script:
- Reads all existing Paper records.
- Uses the stored PDF/BibTeX source file to recover missing metadata.
- Does NOT overwrite existing metadata.
- Reclassifies papers only when subject_category is missing.
- Rebuilds prepared_text after metadata changes.
- Does NOT delete papers.
- Does NOT rebuild the recommendation index.

Run from the project root:

    python scripts/backfill_metadata.py
"""

import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Make the project root importable.
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ---------------------------------------------------------------------------
# Application imports
# ---------------------------------------------------------------------------

from app.database import SessionLocal
from app.models.models import Paper

from app.services.extraction import extract_metadata_from_pdf
from app.services.bib_extraction import extract_metadata_from_bib
from app.services.classification import classify_paper
from app.services.storage import get_paper_file_path


# Use the same recommendation text preparation used by the application.
try:
    from app.services.recommendation.text_preparation import (
        build_prepared_text,
    )
except ModuleNotFoundError:
    build_prepared_text = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_missing(value) -> bool:
    """Return True when a metadata value is empty or None."""
    if value is None:
        return True

    if isinstance(value, str):
        return not value.strip()

    return False


def get_source_extension(paper: Paper, source_path: Path) -> str:
    """
    Determine the source file type.

    Prefer the actual stored file extension, then fall back to
    extraction_method/source_filename.
    """
    extension = source_path.suffix.lower()

    if extension:
        return extension

    if paper.extraction_method:
        method = paper.extraction_method.lower()

        if method == "bibtex":
            return ".bib"

        if method == "pdf":
            return ".pdf"

    if paper.source_filename:
        return Path(paper.source_filename).suffix.lower()

    return ""


def refresh_prepared_text(paper: Paper) -> bool:
    """
    Rebuild prepared_text if the project's text-preparation helper exists.

    Returns True when the field was updated.
    """
    if build_prepared_text is None:
        return False

    new_text = build_prepared_text(
        title=paper.title,
        abstract=paper.abstract,
        keywords=paper.keywords,
    )

    if new_text != paper.prepared_text:
        paper.prepared_text = new_text
        return True

    return False


# ---------------------------------------------------------------------------
# Main backfill
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 70)
    print("ACADEMIC PAPER METADATA BACKFILL")
    print("=" * 70)
    print(f"Project root: {PROJECT_ROOT}")
    print()

    db = SessionLocal()

    changed_count = 0
    skipped_count = 0
    error_count = 0

    try:
        papers = (
            db.query(Paper)
            .order_by(Paper.id.asc())
            .all()
        )

        total = len(papers)

        print(f"Found {total} papers.")
        print()

        if total == 0:
            print("No papers found. Nothing to backfill.")
            return

        for index, paper in enumerate(papers, start=1):
            print("-" * 70)
            print(f"[{index}/{total}] Paper ID: {paper.id}")
            print(f"Title: {paper.title}")

            changed = False

            try:
                # -----------------------------------------------------------
                # Locate stored source file
                # -----------------------------------------------------------

                if not paper.stored_path:
                    print("  [SKIP] No stored_path.")
                    skipped_count += 1
                    continue

                source_path = Path(
                    get_paper_file_path(paper.stored_path)
                )

                if not source_path.exists():
                    print(f"  [SKIP] Source file not found: {source_path}")
                    skipped_count += 1
                    continue

                extension = get_source_extension(
                    paper,
                    source_path,
                )

                print(f"  Source: {source_path.name}")
                print(f"  Type:   {extension or 'unknown'}")

                # -----------------------------------------------------------
                # Extract metadata
                # -----------------------------------------------------------

                if extension == ".pdf":
                    metadata = extract_metadata_from_pdf(
                        str(source_path)
                    )

                elif extension in {".bib", ".bibtex"}:
                    metadata = extract_metadata_from_bib(
                        str(source_path)
                    )

                else:
                    print(
                        f"  [SKIP] Unsupported source type: "
                        f"{extension or 'unknown'}"
                    )
                    skipped_count += 1
                    continue

                # -----------------------------------------------------------
                # Fill missing metadata only
                # -----------------------------------------------------------

                fields_to_backfill = [
                    "title",
                    "author",
                    "abstract",
                    "keywords",
                    "publication_year",
                    "doi",
                ]

                for field in fields_to_backfill:
                    current_value = getattr(paper, field, None)
                    extracted_value = metadata.get(field)

                    if (
                        is_missing(current_value)
                        and not is_missing(extracted_value)
                    ):
                        setattr(
                            paper,
                            field,
                            extracted_value,
                        )

                        print(
                            f"  [UPDATED] {field}: "
                            f"{extracted_value}"
                        )

                        changed = True

                # -----------------------------------------------------------
                # Keyword extraction tracking
                # -----------------------------------------------------------

                extracted_keywords_source = metadata.get(
                    "keywords_source"
                )

                extracted_keywords_generated = metadata.get(
                    "keywords_generated"
                )

                if (
                    is_missing(paper.keywords_source)
                    and not is_missing(extracted_keywords_source)
                ):
                    paper.keywords_source = extracted_keywords_source
                    changed = True

                    print(
                        f"  [UPDATED] keywords_source: "
                        f"{extracted_keywords_source}"
                    )

                if (
                    not paper.keywords_generated
                    and extracted_keywords_generated is True
                ):
                    paper.keywords_generated = True
                    changed = True

                    print(
                        "  [UPDATED] keywords_generated: True"
                    )

                # -----------------------------------------------------------
                # Classification
                # -----------------------------------------------------------

                if is_missing(paper.subject_category):
                    try:
                        classify_paper(paper)

                        if not is_missing(paper.subject_category):
                            print(
                                f"  [UPDATED] subject_category: "
                                f"{paper.subject_category}"
                            )

                            changed = True

                    except Exception as exc:
                        print(
                            f"  [WARN] Classification failed: {exc}"
                        )

                # -----------------------------------------------------------
                # Rebuild prepared text
                # -----------------------------------------------------------

                try:
                    if refresh_prepared_text(paper):
                        print("  [UPDATED] prepared_text")
                        changed = True

                except Exception as exc:
                    print(
                        f"  [WARN] prepared_text refresh failed: {exc}"
                    )

                # -----------------------------------------------------------
                # Commit this paper
                # -----------------------------------------------------------

                if changed:
                    db.commit()
                    db.refresh(paper)

                    changed_count += 1

                    print("  [OK] Changes saved.")

                else:
                    skipped_count += 1

                    print("  [UNCHANGED] No missing recoverable metadata.")

            except Exception as exc:
                db.rollback()

                error_count += 1

                print(
                    f"  [ERROR] Paper {paper.id}: {exc}"
                )

        # -------------------------------------------------------------------
        # Final summary
        # -------------------------------------------------------------------

        print()
        print("=" * 70)
        print("METADATA BACKFILL COMPLETE")
        print("=" * 70)
        print(f"Papers found     : {total}")
        print(f"Papers updated   : {changed_count}")
        print(f"Papers unchanged : {skipped_count}")
        print(f"Papers with errors: {error_count}")
        print("=" * 70)

        print()
        print(
            "Recommendation index was NOT rebuilt."
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()