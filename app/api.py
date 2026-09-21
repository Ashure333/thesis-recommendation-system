
"""
FastAPI application -- the Application Layer's Repository and
Recommendation Routes.

Wraps the existing services/repositories over HTTP so the React
frontend can reach them:

  - queries.py                         -> Repository browse/search/filter
  - upload_paper.py                   -> Upload
  - recommendation/search_service.py  -> Recommendations (TF-IDF, S-BERT)

Two things are NOT built yet:

  - The Metadata component and the four combined pipelines
    (TF-IDF+S-BERT, TF-IDF+Metadata, S-BERT+Metadata, Full Hybrid) --
    search_service.py currently only supports "tfidf" and "sbert".
    /api/recommendations returns a clear 400 for the others rather than
    silently falling back to one of the two that exist.

  - Real /api/auth/login or /api/auth/register -- every request acts as
    a single local user in the meantime (see app/services/local_user.py).

Before recommendations will return anything, the recommendation index
needs to be built at least once:

    python -m scripts.rebuild_recommendation

Run the API with:

    python -m uvicorn app.api:app --reload --port 8000
"""

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import init_db, get_session
from app.models.models import Paper, PersonalLibrary
from app.repositories.queries import filter_papers
from app.services.upload_paper import (
    upload_paper_from_pdf,
    complete_paper_manually,
)
from app.services.storage import delete_paper_file
from app.services.local_user import get_or_create_default_user
from app.services.recommendation.search_service import (
    search_papers as run_search,
)
from app.schemas import (
    PaperOut,
    PaperUpdate,
    RepositoryStats,
    LibraryEntryOut,
    SearchResultOut,
)


app = FastAPI(title="PaperRec API")


# ---------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------

# Vite's development server runs on port 5173 by default.
# Browsers block cross-origin requests unless the API explicitly allows
# the frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    init_db()


# ---------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STORAGE_ROOT = (PROJECT_ROOT / "storage").resolve()


def resolve_stored_file(stored_path: str) -> Path:
    """
    Resolve a database stored_path safely inside the storage directory.

    Database paths are stored like:

        papers\\2.pdf

    Actual files are located at:

        storage/papers/2.pdf
    """

    # Normalize Windows backslashes so the path works consistently.
    normalized_path = stored_path.replace("\\", "/")

    relative_path = Path(*normalized_path.split("/"))

    resolved_path = (STORAGE_ROOT / relative_path).resolve()

    # Prevent path traversal outside storage/.
    try:
        resolved_path.relative_to(STORAGE_ROOT)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid stored file path.",
        )

    return resolved_path


# ---------------------------------------------------------------------
# Recommendation rebuild helper
# ---------------------------------------------------------------------

def rebuild_recommendation_data() -> None:
    """
    Rebuild all recommendation data using the master rebuild script.

    The master script performs:

        1. Paper classification
        2. Recommendation metadata validation
        3. prepared_text rebuilding
        4. TF-IDF rebuilding
        5. S-BERT rebuilding

    This function is called after recommendation-related metadata
    changes such as:

        - title
        - abstract
        - keywords
        - publication_year

    The rebuild script is executed using the same Python interpreter
    currently running FastAPI.
    """

    rebuild_script = (
        PROJECT_ROOT
        / "scripts"
        / "rebuild_recommendation.py"
    )

    if not rebuild_script.exists():
        raise RuntimeError(
            f"Recommendation rebuild script not found: "
            f"{rebuild_script}"
        )

    print()
    print("=" * 60)
    print("STARTING RECOMMENDATION REBUILD")
    print("=" * 60)

    result = subprocess.run(
        [
            sys.executable,
            str(rebuild_script),
        ],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )

    # Print the script's output so it is visible in the FastAPI
    # terminal while developing.
    if result.stdout:
        print(result.stdout)

    if result.returncode != 0:
        if result.stderr:
            print(result.stderr)

        print("=" * 60)
        print("RECOMMENDATION REBUILD FAILED")
        print("=" * 60)

        raise RuntimeError(
            "Recommendation data rebuild failed."
        )

    print("=" * 60)
    print("RECOMMENDATION REBUILD COMPLETED")
    print("=" * 60)
    print()


# ---------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------

@app.get(
    "/api/papers",
    response_model=list[PaperOut],
)
def list_papers(
    search: str | None = None,
    subject: str | None = None,
    category: str | None = None,
    document_type: str | None = None,
    min_year: int | None = None,
    max_year: int | None = None,
    sort_by: str = "date_added",
    limit: int | None = None,
    db: Session = Depends(get_session),
):
    papers = filter_papers(
        db,
        search=search,
        subject=subject,
        category=category,
        document_type=document_type,
        min_year=min_year,
        max_year=max_year,
        sort_by=sort_by,
    )

    return papers[:limit] if limit else papers


@app.get(
    "/api/papers/stats",
    response_model=RepositoryStats,
)
def repository_stats(
    db: Session = Depends(get_session),
):
    all_papers = db.query(Paper).all()

    by_subject: dict[str, int] = {}
    categories = set()

    for paper in all_papers:
        if not paper.subject_category:
            continue

        # subject_category is stored as:
        #
        #     Subject: Category
        #
        # Split defensively in case a row was saved without that
        # convention.
        parts = [
            p.strip()
            for p in paper.subject_category.split(":", 1)
        ]

        subject = parts[0]

        by_subject[subject] = (
            by_subject.get(subject, 0) + 1
        )

        if len(parts) > 1:
            categories.add(parts[1])

    return RepositoryStats(
        total_papers=len(all_papers),
        by_subject=by_subject,
        category_count=len(categories),
    )


# ---------------------------------------------------------------------
# PDF Viewer
# ---------------------------------------------------------------------

@app.get("/api/papers/{paper_id}/pdf")
def get_paper_pdf(
    paper_id: int,
    db: Session = Depends(get_session),
):
    """
    Returns the stored PDF for a paper.

    The response uses Content-Disposition: inline so the browser can
    display the PDF instead of forcing a download.

    Example:

        GET /api/papers/2/pdf
    """

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if paper is None:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    if not paper.stored_path:
        raise HTTPException(
            status_code=404,
            detail="PDF file is not available for this paper.",
        )

    stored_path = paper.stored_path

    # This endpoint is specifically for PDFs.
    if Path(stored_path).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Stored file is not a PDF.",
        )

    pdf_path = resolve_stored_file(stored_path)

    if not pdf_path.exists() or not pdf_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="PDF file not found.",
        )

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=pdf_path.name,
        content_disposition_type="inline",
    )


# ---------------------------------------------------------------------
# Individual Paper
# ---------------------------------------------------------------------

@app.get(
    "/api/papers/{paper_id}",
    response_model=PaperOut,
)
def get_paper(
    paper_id: int,
    db: Session = Depends(get_session),
):
    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if paper is None:
        raise HTTPException(
            status_code=404,
            detail="Paper not found",
        )

    return paper


@app.patch(
    "/api/papers/{paper_id}",
    response_model=PaperOut,
)
def update_paper(
    paper_id: int,
    updates: PaperUpdate,
    db: Session = Depends(get_session),
):
    """
    Manually update paper metadata.

    Recommendation-related fields:

        - title
        - abstract
        - keywords
        - publication_year

    If one of those fields changes, the complete recommendation
    representation is rebuilt.

    Other metadata fields:

        - author
        - DOI
        - subject/category
        - document type
        - citation count

    do not trigger a recommendation rebuild.
    """

    # ---------------------------------------------------------
    # Find the existing paper.
    # ---------------------------------------------------------

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if paper is None:
        raise HTTPException(
            status_code=404,
            detail="Paper not found",
        )

    # ---------------------------------------------------------
    # Determine whether recommendation data changed.
    # ---------------------------------------------------------

    recommendation_fields_changed = False

    if (
        "title" in updates.model_fields_set
        and updates.title != paper.title
    ):
        recommendation_fields_changed = True

    if (
        "abstract" in updates.model_fields_set
        and updates.abstract != paper.abstract
    ):
        recommendation_fields_changed = True

    if (
        "keywords" in updates.model_fields_set
        and updates.keywords != paper.keywords
    ):
        recommendation_fields_changed = True

    if (
        "publication_year" in updates.model_fields_set
        and (
            updates.publication_year
            != paper.publication_year
        )
    ):
        recommendation_fields_changed = True

    # ---------------------------------------------------------
    # Collect only fields actually supplied by the frontend.
    #
    # None values are ignored here to preserve the existing
    # complete_paper_manually behavior.
    # ---------------------------------------------------------

    fields = {
        key: value
        for key, value in updates.model_dump(
            exclude_unset=True
        ).items()
        if value is not None
    }

    # ---------------------------------------------------------
    # Update the paper.
    # ---------------------------------------------------------

    try:
        updated_paper = complete_paper_manually(
            db,
            paper_id,
            **fields,
        )

    except Exception as error:
        print()
        print("PAPER UPDATE FAILED")
        print(error)

        raise HTTPException(
            status_code=500,
            detail="Failed to update paper metadata.",
        )

    # ---------------------------------------------------------
    # Rebuild recommendation representations if necessary.
    # ---------------------------------------------------------

    if recommendation_fields_changed:
        try:
            print()
            print(
                f"Recommendation-related metadata changed "
                f"for paper {paper_id}."
            )
            print(
                "Starting recommendation rebuild..."
            )

            rebuild_recommendation_data()

        except Exception as error:
            print()
            print(
                "Paper metadata was saved, but the "
                "recommendation rebuild failed."
            )
            print(error)

            raise HTTPException(
                status_code=500,
                detail=(
                    "Paper metadata was saved, but the "
                    "recommendation index could not be rebuilt."
                ),
            )

        # The rebuild script uses its own SQLAlchemy session.
        # Refresh the current object so its values are synchronized
        # with the database after the external rebuild.
        db.refresh(updated_paper)

    return updated_paper


@app.delete(
    "/api/papers/{paper_id}",
    status_code=204,
)
def delete_paper(
    paper_id: int,
    db: Session = Depends(get_session),
):
    """
    Permanently removes a paper:

      - its database record
      - any personal_library entries pointing at it
      - its stored file on disk

    This is a real delete -- distinct from the Library "Remove"
    action, which only unlinks a paper from one user's library.
    """

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if paper is None:
        raise HTTPException(
            status_code=404,
            detail="Paper not found",
        )

    # Remove library links first rather than relying on ORM
    # cascade configuration.
    db.query(PersonalLibrary).filter(
        PersonalLibrary.paper_id == paper_id
    ).delete()

    if paper.stored_path:
        delete_paper_file(
            paper.stored_path
        )

    db.delete(paper)
    db.commit()


# ---------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------

@app.post(
    "/api/papers/upload",
    response_model=PaperOut,
)
def upload_paper(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
):
    suffix = os.path.splitext(
        file.filename
    )[1].lower()

    if suffix not in (".pdf", ".bib"):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF and BibTeX (.bib) files are accepted"
            ),
        )

    # upload_paper_from_pdf reads from a real file path and needs
    # the correct extension to select the appropriate extractor.
    #
    # Uploaded bytes are written to a temporary file first.
    # The permanent copy lives in storage/papers/.
    with tempfile.NamedTemporaryFile(
        suffix=suffix,
        delete=False,
    ) as tmp:
        shutil.copyfileobj(
            file.file,
            tmp,
        )
        tmp_path = tmp.name

    try:
        paper = upload_paper_from_pdf(
            db,
            tmp_path,
            file.filename,
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return paper


# ---------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------

@app.get(
    "/api/library",
    response_model=list[LibraryEntryOut],
)
def get_library(
    db: Session = Depends(get_session),
):
    user = get_or_create_default_user(db)

    entries = (
        db.query(PersonalLibrary)
        .filter(
            PersonalLibrary.user_id == user.id
        )
        .order_by(
            PersonalLibrary.saved_at.desc()
        )
        .all()
    )

    return [
        LibraryEntryOut(
            paper=e.paper,
            saved_at=e.saved_at,
        )
        for e in entries
    ]


@app.post(
    "/api/library/{paper_id}",
    status_code=201,
)
def save_to_library(
    paper_id: int,
    db: Session = Depends(get_session),
):
    user = get_or_create_default_user(db)

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if paper is None:
        raise HTTPException(
            status_code=404,
            detail="Paper not found",
        )

    existing = (
        db.query(PersonalLibrary)
        .filter(
            PersonalLibrary.user_id == user.id,
            PersonalLibrary.paper_id == paper_id,
        )
        .first()
    )

    if existing:
        return {"status": "already saved"}

    db.add(
        PersonalLibrary(
            user_id=user.id,
            paper_id=paper_id,
        )
    )

    db.commit()

    return {"status": "saved"}


@app.delete(
    "/api/library/{paper_id}",
    status_code=204,
)
def remove_from_library(
    paper_id: int,
    db: Session = Depends(get_session),
):
    user = get_or_create_default_user(db)

    entry = (
        db.query(PersonalLibrary)
        .filter(
            PersonalLibrary.user_id == user.id,
            PersonalLibrary.paper_id == paper_id,
        )
        .first()
    )

    if entry:
        db.delete(entry)
        db.commit()


# ---------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------

# Only these two pipelines have a working implementation in
# search_service.py right now.
#
# The other four configurations from Chapter 3 (§3.6) exist in the
# UI's pipeline selector but are not runnable yet.
IMPLEMENTED_PIPELINES = {
    "tfidf",
    "sbert",
}


@app.get(
    "/api/recommendations",
    response_model=list[SearchResultOut],
)
def get_recommendations(
    pipeline: str = "tfidf",
    query: str | None = None,
    seed_paper_id: int | None = None,
    top_k: int = 10,
    db: Session = Depends(get_session),
):
    if pipeline not in IMPLEMENTED_PIPELINES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Pipeline '{pipeline}' isn't built yet -- only "
                f"{sorted(IMPLEMENTED_PIPELINES)} are implemented "
                f"so far."
            ),
        )

    try:
        results = run_search(
            db,
            query=query,
            seed_paper_id=seed_paper_id,
            pipeline=pipeline,
            top_k=top_k,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    return [
        SearchResultOut(
            paper=result.paper,
            score=result.score,
        )
        for result in results
    ]
