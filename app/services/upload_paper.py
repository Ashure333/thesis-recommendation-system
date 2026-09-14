"""
Paper upload workflow: PDF -> auto-extraction -> validation -> storage.

Flow:
    1. Receive an uploaded PDF.
    2. Automatically extract Title, Abstract, Keywords,
       and Publication Year.
    3. Create the Paper database record.
    4. Validate the extracted metadata.
    5. Build and store prepared_text from:
       Title + Abstract + Keywords.
    6. Copy the PDF into the permanent storage folder:
       storage/papers/{paper_id}.pdf
    7. Save the relative file path in Paper.stored_path.

Papers with incomplete metadata are still saved in the database.
They are marked as invalid for recommendation until the missing
fields are completed manually.

Author, DOI, Subject/Category, Document Type, and Citation Count
are not automatically populated by this workflow.
"""

from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.extraction import extract_metadata_from_pdf
from app.services.validation import validate_paper
from app.services.storage import save_paper_file
from app.services.text_preparation import refresh_prepared_text


def upload_paper_from_pdf(
    db: Session,
    pdf_path: str,
    source_filename: str,
) -> Paper:
    """
    Upload a PDF, extract its metadata, create a database record,
    prepare its recommendation text, and save the physical PDF file.

    Parameters:
        db:
            SQLAlchemy database session.

        pdf_path:
            Path to the incoming or temporary PDF file.

        source_filename:
            Original filename of the uploaded PDF.

    Returns:
        The saved Paper database object.

    Notes:
        The database record is created before the file is copied
        because the generated Paper ID is used as the PDF filename.

        Example:
            Database ID: 12
            stored_path: papers/12.pdf
            Physical file:
                storage/papers/12.pdf
    """

    source_path = Path(pdf_path).resolve()

    if not source_path.exists():
        raise FileNotFoundError(
            f"Uploaded PDF does not exist: {source_path}"
        )

    if not source_path.is_file():
        raise ValueError(
            f"Uploaded path is not a file: {source_path}"
        )

    if source_path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are allowed.")

    # ---------------------------------------------------------
    # 1. Automatically extract metadata from the PDF
    # ---------------------------------------------------------
    extracted = extract_metadata_from_pdf(str(source_path))

    # ---------------------------------------------------------
    # 2. Create the Paper database record
    # ---------------------------------------------------------
    paper = Paper(
        title=extracted.get("title"),
        abstract=extracted.get("abstract"),
        keywords=extracted.get("keywords"),
        publication_year=extracted.get("publication_year"),
        source_filename=source_filename,
        extraction_method="auto",
    )

    # ---------------------------------------------------------
    # 3. Validate the extracted metadata
    # ---------------------------------------------------------
    validate_paper(paper)

    # ---------------------------------------------------------
    # 4. Build prepared_text from Title + Abstract + Keywords
    # ---------------------------------------------------------
    refresh_prepared_text(paper)

    # ---------------------------------------------------------
    # 5. Save the database record first to generate paper.id
    # ---------------------------------------------------------
    db.add(paper)
    db.commit()
    db.refresh(paper)

    # ---------------------------------------------------------
    # 6. Copy the physical PDF into storage/papers/{id}.pdf
    # ---------------------------------------------------------
    try:
        paper.stored_path = save_paper_file(
            paper.id,
            str(source_path),
        )

        db.commit()
        db.refresh(paper)

    except Exception:
        # If file storage fails, remove the database row that was
        # just created so the database does not contain a paper
        # without its corresponding PDF file.
        db.rollback()
        db.delete(paper)
        db.commit()
        raise

    return paper


def complete_paper_manually(
    db: Session,
    paper_id: int,
    **field_updates,
) -> Paper:
    """
    Complete or update missing paper metadata manually.

    Example:
        complete_paper_manually(
            db,
            paper_id=3,
            title="Updated Paper Title",
            abstract="Updated abstract...",
            keywords="machine learning, recommendation",
            publication_year=2024,
        )

    After updating the fields, the paper is revalidated and
    prepared_text is rebuilt so it stays synchronized with:

        Title + Abstract + Keywords
    """

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .one()
    )

    # ---------------------------------------------------------
    # 1. Apply the supplied field updates
    # ---------------------------------------------------------
    for field_name, value in field_updates.items():
        if hasattr(paper, field_name):
            setattr(paper, field_name, value)

    # ---------------------------------------------------------
    # 2. Mark the record as manually completed
    # ---------------------------------------------------------
    if paper.extraction_method == "auto":
        paper.extraction_method = "manual"

    # ---------------------------------------------------------
    # 3. Revalidate the updated metadata
    # ---------------------------------------------------------
    validate_paper(paper)

    # ---------------------------------------------------------
    # 4. Rebuild prepared_text after metadata changes
    # ---------------------------------------------------------
    refresh_prepared_text(paper)

    # ---------------------------------------------------------
    # 5. Save changes
    # ---------------------------------------------------------
    db.commit()
    db.refresh(paper)

    return paper