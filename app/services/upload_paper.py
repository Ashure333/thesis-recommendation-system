"""
Paper upload workflow: PDF -> auto-extraction -> validation -> save.

This is the backend logic your FastAPI/Flask upload route should call.
It demonstrates the flow described in your updated Chapter 3:

    1. User uploads a PDF.
    2. The system attempts to auto-extract Title, Abstract, Keywords,
       and Publication Year.
    3. The paper record is ALWAYS created (consistent with the existing
       "keep incomplete records on file" policy for missing metadata).
    4. If all four fields extracted successfully, is_valid_for_recommendation
       is True and no manual entry is needed.
    5. If any field failed extraction, is_valid_for_recommendation is False,
       missing_fields lists exactly which ones, and the caller (your API
       route / frontend form) should present those specific fields to the
       user for manual entry -- at which point update_paper_fields() can
       be used to fill them in and re-validate.

Author, DOI, Subject/Category, Document Type, and Citation Count are NOT
touched by this flow -- those still come from manual entry / dataset
curation, since they are not part of PDF auto-extraction scope.
"""

from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.extraction import extract_metadata_from_pdf
from app.services.validation import validate_paper
from app.services.storage import save_paper_file


def upload_paper_from_pdf(db: Session, pdf_path: str, source_filename: str) -> Paper:
    """
    Runs auto-extraction on the given PDF, creates a Paper record with
    whatever was extracted, saves the actual PDF file into permanent
    storage, validates the record, and commits it.

    `pdf_path` is expected to be a temporary upload path (e.g. from your
    FastAPI/Flask upload handler) -- it is only read from, never assumed
    to persist. The permanent copy lives under storage/papers/.

    Returns the saved Paper -- check paper.is_valid_for_recommendation
    and paper.missing_fields to know whether manual entry is still needed,
    and paper.stored_path to locate the saved file on disk.
    """
    extracted = extract_metadata_from_pdf(pdf_path)

    paper = Paper(
        title=extracted["title"],
        abstract=extracted["abstract"],
        keywords=extracted["keywords"],
        publication_year=extracted["publication_year"],
        source_filename=source_filename,
        extraction_method="auto",
    )
    validate_paper(paper)

    # First insert without stored_path so we get an auto-generated id --
    # the file is named after that id, so the row has to exist first.
    db.add(paper)
    db.commit()
    db.refresh(paper)

    paper.stored_path = save_paper_file(paper.id, pdf_path)
    db.commit()
    db.refresh(paper)

    return paper


def complete_paper_manually(db: Session, paper_id: int, **field_updates) -> Paper:
    """
    Fills in fields the user supplies by hand (e.g. after auto-extraction
    left some blank), re-validates, and commits.

    Usage:
        complete_paper_manually(db, paper.id, title="...", abstract="...")
    """
    paper = db.query(Paper).filter(Paper.id == paper_id).one()

    for field_name, value in field_updates.items():
        if hasattr(paper, field_name):
            setattr(paper, field_name, value)

    # Any paper that needed manual completion is no longer purely "auto".
    paper.extraction_method = "manual" if paper.extraction_method == "auto" else paper.extraction_method

    validate_paper(paper)
    db.commit()
    db.refresh(paper)
    return paper
