
"""
Re-extract metadata for all existing repository papers.

This script re-runs the current PDF metadata extraction system on
existing repository files.

Extraction uses the existing logic in:
    app.services.extraction.extract_metadata_from_pdf

The extractor attempts to obtain:
    - Title
    - Abstract
    - Keywords
    - Keyword source
    - Keyword generated flag
    - Publication year

Keyword extraction follows the existing extraction service:
    1. Explicit author-provided keywords
    2. YAKE-generated keywords from title + abstract
    3. None if no usable source text exists

Important:
    - This script REPLACES existing extracted metadata with fresh
      metadata from the PDF.
    - It does not modify the PDF files.
    - It does not modify author, DOI, subject/category, document type,
      or citation count.
    - Existing PDFs are expected at:

        storage/papers/<id>.pdf

    - Papers without a stored PDF path are skipped.
    - Non-PDF files such as .bib files are skipped.
    - Extraction errors for one paper do not stop the entire process.

Run from the project root:

    python -m scripts.reextract_metadata
"""

from pathlib import Path

from app.database import SessionLocal
from app.models.models import Paper
from app.services.extraction import extract_metadata_from_pdf
from app.services.validation import validate_paper


def resolve_pdf_path(stored_path: str | None) -> Path | None:
    """
    Resolve the database stored_path to the actual PDF location.

    Database example:
        papers\\2.pdf

    Actual project location:
        storage/papers/2.pdf
    """

    if not stored_path:
        return None

    project_root = Path(__file__).resolve().parent.parent

    # Normalize Windows backslashes and remove surrounding whitespace.
    normalized = stored_path.strip().replace("\\", "/")

    # The database stores paths relative to storage/.
    pdf_path = project_root / "storage" / normalized

    if pdf_path.exists() and pdf_path.is_file():
        return pdf_path

    return None


def display_value(value) -> str:
    """Create a readable representation for console output."""

    if value is None:
        return "(none)"

    text = str(value).strip()

    if not text:
        return "(empty)"

    return text


def print_change(field: str, old_value, new_value) -> None:
    """Print one metadata change."""

    print(f"  {field}:")
    print(f"    OLD: {display_value(old_value)}")
    print(f"    NEW: {display_value(new_value)}")


def process_paper(paper: Paper) -> dict:
    """
    Re-extract metadata for one paper.

    Returns statistics describing the result.
    """

    result = {
        "processed": False,
        "updated": False,
        "skipped": False,
        "error": False,
        "reason": None,
        "changes": [],
    }

    # ---------------------------------------------------------
    # Resolve PDF
    # ---------------------------------------------------------

    pdf_path = resolve_pdf_path(paper.stored_path)

    if pdf_path is None:
        result["skipped"] = True

        if not paper.stored_path:
            result["reason"] = "No stored_path"
        else:
            result["reason"] = (
                f"File not found: storage/{paper.stored_path}"
            )

        return result

    # ---------------------------------------------------------
    # Make sure the file is actually a PDF
    # ---------------------------------------------------------

    if pdf_path.suffix.lower() != ".pdf":
        result["skipped"] = True
        result["reason"] = f"Not a PDF file: {pdf_path.name}"
        return result

    # ---------------------------------------------------------
    # Extract fresh metadata
    # ---------------------------------------------------------

    try:
        extracted = extract_metadata_from_pdf(str(pdf_path))
    except Exception as exc:
        result["error"] = True
        result["reason"] = f"{type(exc).__name__}: {exc}"
        return result

    result["processed"] = True

    # ---------------------------------------------------------
    # Save old values before replacement
    # ---------------------------------------------------------

    old_values = {
        "title": paper.title,
        "abstract": paper.abstract,
        "keywords": paper.keywords,
        "publication_year": paper.publication_year,
        "keywords_source": paper.keywords_source,
        "keywords_generated": paper.keywords_generated,
    }

    # ---------------------------------------------------------
    # Replace metadata with freshly extracted values
    # ---------------------------------------------------------

    extracted_title = extracted.get("title")
    extracted_abstract = extracted.get("abstract")
    extracted_keywords = extracted.get("keywords")
    extracted_year = extracted.get("publication_year")

    # Only replace fields when the extractor actually returned
    # something useful. This prevents a failed extraction from
    # erasing existing metadata.
    if extracted_title:
        paper.title = extracted_title

    if extracted_abstract:
        paper.abstract = extracted_abstract

    if extracted_keywords:
        paper.keywords = extracted_keywords
        paper.keywords_source = extracted.get("keywords_source")
        paper.keywords_generated = bool(
            extracted.get("keywords_generated", False)
        )

    if extracted_year is not None:
        paper.publication_year = extracted_year

    # ---------------------------------------------------------
    # Revalidate after extraction
    # ---------------------------------------------------------

    validate_paper(paper)

    # ---------------------------------------------------------
    # Determine what changed
    # ---------------------------------------------------------

    new_values = {
        "title": paper.title,
        "abstract": paper.abstract,
        "keywords": paper.keywords,
        "publication_year": paper.publication_year,
        "keywords_source": paper.keywords_source,
        "keywords_generated": paper.keywords_generated,
    }

    for field in old_values:
        if old_values[field] != new_values[field]:
            result["changes"].append(field)

    if result["changes"]:
        result["updated"] = True
        paper.extraction_method = "auto"

    return result


def main() -> None:
    print()
    print("=" * 70)
    print("FULL EXISTING PAPER METADATA RE-EXTRACTION")
    print("=" * 70)
    print()

    db = SessionLocal()

    try:
        papers = (
            db.query(Paper)
            .order_by(Paper.id)
            .all()
        )

        print(f"Found {len(papers)} paper record(s).")
        print()

        processed = 0
        updated = 0
        skipped = 0
        errors = 0

        for paper in papers:
            print("-" * 70)
            print(f"Paper ID: {paper.id}")
            print(f"Stored path: {display_value(paper.stored_path)}")
            print(f"Current title: {display_value(paper.title)}")

            result = process_paper(paper)

            # -------------------------------------------------
            # Skipped
            # -------------------------------------------------

            if result["skipped"]:
                skipped += 1
                print(f"[SKIPPED] {result['reason']}")
                continue

            # -------------------------------------------------
            # Extraction error
            # -------------------------------------------------

            if result["error"]:
                errors += 1
                print(f"[ERROR] {result['reason']}")
                continue

            processed += 1

            # -------------------------------------------------
            # Updated
            # -------------------------------------------------

            if result["updated"]:
                updated += 1

                print()
                print("[UPDATED] Fresh metadata extracted.")

                # Print the fields that changed.
                #
                # We intentionally print the complete value for
                # keywords and title, but truncate very long
                # abstracts so the console remains readable.

                for field in result["changes"]:

                    if field == "abstract":
                        old_abstract = paper.abstract
                        print("  abstract: updated")
                        continue

                    if field == "title":
                        print(
                            f"  title: {display_value(paper.title)}"
                        )
                        continue

                    if field == "keywords":
                        print(
                            f"  keywords: "
                            f"{display_value(paper.keywords)}"
                        )
                        print(
                            f"  keywords_source: "
                            f"{display_value(paper.keywords_source)}"
                        )
                        print(
                            f"  keywords_generated: "
                            f"{paper.keywords_generated}"
                        )
                        continue

                    if field == "publication_year":
                        print(
                            f"  publication_year: "
                            f"{display_value(paper.publication_year)}"
                        )
                        continue

                    if field == "keywords_source":
                        print(
                            f"  keywords_source: "
                            f"{display_value(paper.keywords_source)}"
                        )
                        continue

                    if field == "keywords_generated":
                        print(
                            f"  keywords_generated: "
                            f"{paper.keywords_generated}"
                        )
                        continue
            else:
                print("[NO CHANGE] Fresh extraction matched existing metadata.")

        # -----------------------------------------------------
        # Commit all successful changes
        # -----------------------------------------------------

        db.commit()

        # -----------------------------------------------------
        # Final statistics
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("RE-EXTRACTION COMPLETE")
        print("=" * 70)
        print()

        print(f"Total paper records:   {len(papers)}")
        print(f"PDFs processed:        {processed}")
        print(f"Papers updated:        {updated}")
        print(f"Skipped:               {skipped}")
        print(f"Extraction errors:     {errors}")

        # -----------------------------------------------------
        # Validation summary
        # -----------------------------------------------------

        refreshed_papers = (
            db.query(Paper)
            .order_by(Paper.id)
            .all()
        )

        valid = 0
        invalid = 0

        print()
        print("=" * 70)
        print("VALIDATION SUMMARY")
        print("=" * 70)
        print()

        for paper in refreshed_papers:
            if paper.is_valid_for_recommendation:
                valid += 1
            else:
                invalid += 1

        print(
            f"Valid for recommendation:   {valid}"
        )
        print(
            f"Still invalid:               {invalid}"
        )

        if invalid:
            print()
            print(
                "Papers still missing required recommendation metadata:"
            )
            print()

            for paper in refreshed_papers:
                if not paper.is_valid_for_recommendation:
                    print(f"  ID {paper.id}: {paper.title}")
                    print(
                        f"      Missing: "
                        f"{paper.missing_fields}"
                    )

        # -----------------------------------------------------
        # Final instructions
        # -----------------------------------------------------

        print()
        print("=" * 70)
        print("NEXT STEP")
        print("=" * 70)
        print()
        print(
            "If the extracted metadata looks correct, rebuild "
            "the recommendation data:"
        )
        print()
        print("    python -m scripts.rebuild_recommendation")
        print()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
