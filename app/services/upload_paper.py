from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import Paper

from app.services.bib_extraction import extract_metadata_from_bib
from app.services.classification import classify_paper
from app.services.extraction import extract_metadata_from_pdf
from app.services.text_preparation import refresh_prepared_text
from app.services.validation import validate_paper
from app.services.storage import save_paper_file


def _refresh_recommendation_fields(paper: Paper) -> None:
    """Prepare the text used by the recommendation pipeline."""
    try:
        refresh_prepared_text(paper)
    except Exception as exc:
        print(
            f"WARNING: Could not prepare recommendation text: {exc}"
        )


def upload_paper(
    db: Session,
    source_path: str,
    original_filename: str | None = None,
) -> Paper:
    """
    Import a PDF or BibTeX file into the repository.

    PDF:
        Uses the existing PDF extraction pipeline.

    BibTeX:
        Uses the BibTeX parser, followed by best-effort
        Google Scholar enrichment for missing metadata.
    """

    source = Path(source_path)

    if not source.exists():
        raise FileNotFoundError(
            f"Source file does not exist: {source}"
        )

    if not source.is_file():
        raise ValueError(
            f"Source path is not a file: {source}"
        )

    extension = source.suffix.lower()

    if extension not in {".pdf", ".bib"}:
        raise ValueError(
            "Only PDF and BibTeX (.bib) files are supported."
        )

    filename = original_filename or source.name

    # ---------------------------------------------------------
    # STEP 1 — Extract metadata
    # ---------------------------------------------------------

    if extension == ".pdf":
        metadata = extract_metadata_from_pdf(
            str(source)
        )
    else:
        metadata = extract_metadata_from_bib(
            str(source)
        )

    metadata = metadata or {}

    # ---------------------------------------------------------
    # STEP 2 — Create Paper
    # ---------------------------------------------------------

    paper = Paper(
        title=metadata.get("title"),
        author=metadata.get("author"),
        abstract=metadata.get("abstract"),
        keywords=metadata.get("keywords"),
        keywords_source=metadata.get("keywords_source"),
        keywords_generated=metadata.get(
            "keywords_generated",
            False,
        ),
        publication_year=metadata.get(
            "publication_year"
        ),
        doi=metadata.get("doi"),
        citation_count=metadata.get(
            "citation_count"
        ),
        source_filename=filename,
        extraction_method=(
            "bibtex"
            if extension == ".bib"
            else "pdf"
        ),
    )

    # ---------------------------------------------------------
    # STEP 4 — Classification
    # ---------------------------------------------------------

    try:
        classify_paper(paper)
    except Exception as exc:
        print(
            f"WARNING: Paper classification failed: {exc}"
        )

    # ---------------------------------------------------------
    # STEP 5 — Validation
    # ---------------------------------------------------------

    try:
        validate_paper(paper)
    except Exception as exc:
        print(
            f"WARNING: Paper validation failed: {exc}"
        )

    # ---------------------------------------------------------
    # STEP 6 — Prepare recommendation text
    # ---------------------------------------------------------

    _refresh_recommendation_fields(paper)

    # ---------------------------------------------------------
    # STEP 7 — Save database record
    # ---------------------------------------------------------

    try:
        db.add(paper)
        db.commit()
        db.refresh(paper)

    except Exception:
        db.rollback()
        raise

    # ---------------------------------------------------------
    # STEP 8 — Save physical file
    # ---------------------------------------------------------

    try:
        stored_path = save_paper_file(
            paper_id=paper.id,
            source_path=str(source),
        )

        paper.stored_path = stored_path

        db.commit()
        db.refresh(paper)

    except Exception:
        db.rollback()

        try:
            db.delete(paper)
            db.commit()
        except Exception:
            db.rollback()

        raise

    return paper


def upload_paper_from_pdf(
    db: Session,
    source_path: str,
    original_filename: str | None = None,
) -> Paper:
    """
    Backward-compatible wrapper for the existing API.

    The API historically called this function for PDF uploads.
    The underlying upload_paper() function now handles both
    PDF and BibTeX files.
    """

    return upload_paper(
        db=db,
        source_path=source_path,
        original_filename=original_filename,
    )


def complete_paper_manually(
    db: Session,
    paper: Paper,
    **updates,
) -> Paper:
    """
    Backward-compatible helper for manually completing
    paper metadata.

    Only supported Paper metadata fields are updated.
    Classification, validation, and recommendation text
    are refreshed after the update.
    """

    allowed_fields = {
        "title",
        "author",
        "abstract",
        "keywords",
        "publication_year",
        "doi",
        "subject_category",
        "document_type",
        "citation_count",
    }

    for field, value in updates.items():
        if field in allowed_fields:
            setattr(paper, field, value)

    # ---------------------------------------------------------
    # Re-run classification after metadata changes
    # ---------------------------------------------------------

    try:
        classify_paper(paper)
    except Exception as exc:
        print(
            f"WARNING: Paper classification failed: {exc}"
        )

    # ---------------------------------------------------------
    # Re-run validation after metadata changes
    # ---------------------------------------------------------

    try:
        validate_paper(paper)
    except Exception as exc:
        print(
            f"WARNING: Paper validation failed: {exc}"
        )

    # ---------------------------------------------------------
    # Rebuild recommendation text
    # ---------------------------------------------------------

    _refresh_recommendation_fields(paper)

    # ---------------------------------------------------------
    # Save changes
    # ---------------------------------------------------------

    try:
        db.add(paper)
        db.commit()
        db.refresh(paper)

    except Exception:
        db.rollback()
        raise

    return paper