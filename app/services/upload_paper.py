"""
Paper upload workflow: PDF or LaTeX -> auto-extraction -> classification
-> validation -> storage.

Flow:
    1. Receive an uploaded PDF or .tex file.
    2. Automatically extract Title, Abstract, Keywords, and Publication
       Year (extraction.py for PDF, latex_extraction.py for .tex).
    3. Automatically classify the paper into: Subject: Category
    4. Create the Paper database record.
    5. Validate the extracted metadata.
    6. Build and store prepared_text from:
       Title + Abstract + Keywords.
    7. Copy the source file into the permanent storage folder:
       storage/papers/{paper_id}{.pdf or .tex}
    8. Save the relative file path in Paper.stored_path.

Papers with incomplete metadata are still saved in the database.
They are marked as invalid for recommendation until the missing
fields are completed manually.

Author, DOI, Document Type, and Citation Count are not automatically
populated by this workflow. Subject/Category IS automatically
populated, by the classification service (see classify_paper below).
"""

from pathlib import Path

from sqlalchemy.orm import Session

from app.models.models import Paper

from app.services.extraction import extract_metadata_from_pdf
from app.services.latex_extraction import extract_metadata_from_tex
from app.services.validation import validate_paper
from app.services.storage import save_paper_file
from app.services.text_preparation import refresh_prepared_text
from app.services.classification import classify_paper

SUPPORTED_EXTENSIONS = {".pdf", ".tex"}


def upload_paper_from_file(
    db: Session,
    file_path: str,
    source_filename: str,
) -> Paper:
    """
    Upload a PDF or LaTeX (.tex) file, extract its metadata, classify
    it, create a database record, prepare its recommendation text, and
    save the physical file.

    Parameters:
        db:
            SQLAlchemy database session.

        file_path:
            Path to the incoming or temporary file.

        source_filename:
            Original filename of the upload (used to detect .pdf vs
            .tex, and stored for reference).

    Returns:
        The saved Paper database object.

    Notes:
        The database record is created before the file is copied
        because the generated Paper ID is used as the stored filename.

        Example:
            Database ID: 12
            subject_category: Mathematics: Graph Theory
            stored_path: papers/12.tex
            Physical file: storage/papers/12.tex
    """

    source_path = Path(file_path).resolve()

    if not source_path.exists():
        raise FileNotFoundError(
            f"Uploaded file does not exist: {source_path}"
        )

    if not source_path.is_file():
        raise ValueError(
            f"Uploaded path is not a file: {source_path}"
        )

    extension = source_path.suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Only PDF and LaTeX (.tex) files are allowed.")

    # ---------------------------------------------------------
    # 1. Automatically extract metadata, using the extractor
    #    that matches the file type
    # ---------------------------------------------------------
    if extension == ".pdf":
        extracted = extract_metadata_from_pdf(str(source_path))
    else:  # .tex
        extracted = extract_metadata_from_tex(str(source_path))

    # ---------------------------------------------------------
    # 2. Create the Paper object
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
    # 3. Automatically classify the paper
    # ---------------------------------------------------------
    paper.subject_category = classify_paper(paper)

    # ---------------------------------------------------------
    # 4. Validate the extracted metadata
    # ---------------------------------------------------------
    validate_paper(paper)

    # ---------------------------------------------------------
    # 5. Build prepared_text from Title + Abstract + Keywords
    # ---------------------------------------------------------
    refresh_prepared_text(paper)

    # ---------------------------------------------------------
    # 6. Save the database record first to generate paper.id
    # ---------------------------------------------------------
    db.add(paper)
    db.commit()
    db.refresh(paper)

    # ---------------------------------------------------------
    # 7. Copy the physical file into storage/papers/{id}{ext}
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
        # without its corresponding file.
        db.rollback()
        db.delete(paper)
        db.commit()
        raise

    return paper


# Kept for backward compatibility with existing callers (api.py,
# test_upload_flow.py, bulk_upload.py) that call this by its original
# PDF-specific name -- it now handles both file types.
upload_paper_from_pdf = upload_paper_from_file


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

    If the title, abstract, or keywords are updated AND the caller did
    not also explicitly supply subject_category, the paper is
    reclassified automatically.
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
    # 3. Reclassify the paper after manual metadata updates
    #
    #    Only auto-reclassify when the caller did NOT explicitly
    #    supply subject_category themselves. If a person picked a
    #    category by hand, that choice is authoritative and must
    #    not be silently overwritten by the keyword classifier
    #    (which could even overwrite it with None if it has no
    #    confident match).
    # ---------------------------------------------------------
    if "subject_category" not in field_updates:
        paper.subject_category = classify_paper(paper)

    # ---------------------------------------------------------
    # 4. Revalidate the updated metadata
    # ---------------------------------------------------------
    validate_paper(paper)

    # ---------------------------------------------------------
    # 5. Rebuild prepared_text after metadata changes
    # ---------------------------------------------------------
    refresh_prepared_text(paper)

    # ---------------------------------------------------------
    # 6. Save changes
    # ---------------------------------------------------------
    db.commit()
    db.refresh(paper)

    return paper
