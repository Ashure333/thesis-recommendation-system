"""
FastAPI application -- the Application Layer's Repository and
Recommendation Routes.

Wraps the existing services/repositories over HTTP so the React
frontend can reach them:

  - queries.py                    -> Repository browse/search/filter
  - upload_paper.py               -> Upload
  - recommendation/search_service.py -> Recommendations (TF-IDF, S-BERT)

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
    """
    normalized_path = stored_path.replace("\\", "/")
    relative_path = Path(*normalized_path.split("/"))
    resolved_path = (STORAGE_ROOT / relative_path).resolve()

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
        and updates.publication_year != paper.publication_year
    ):
        recommendation_fields_changed = True

    fields = {
        key: value
        for key, value in updates.model_dump(
            exclude_unset=True
        ).items()
        if value is not None
    }

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
    """
    Upload a PDF or BibTeX file.

    The frontend can also convert a Google Scholar BibTeX response
    into a .bib File and send it through this same endpoint.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="A filename is required.",
        )

    suffix = os.path.splitext(
        file.filename
    )[1].lower()

    if suffix not in (".pdf", ".bib"):
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF and BibTeX (.bib) files are accepted."
            ),
        )

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

    except Exception as error:
        print()
        print("PAPER UPLOAD FAILED")
        print(error)

        raise HTTPException(
            status_code=500,
            detail="Failed to import the paper.",
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