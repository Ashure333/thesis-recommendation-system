"""
FastAPI application -- the Application Layer's Repository and
Recommendation Routes.

Wraps the existing services/repositories over HTTP so the React
frontend can reach them:
  - queries.py           -> Repository browse/search/filter
  - upload_paper.py       -> Upload
  - recommendation/search_service.py -> Recommendations (TF-IDF, S-BERT)

Two things are NOT built yet:
  - The Metadata component and the four combined pipelines
    (TF-IDF+S-BERT, TF-IDF+Metadata, S-BERT+Metadata, Full Hybrid) --
    search_service.py currently only supports "tfidf" and "sbert".
    /api/recommendations returns a clear 400 for the others rather than
    silently falling back to one of the two that exist.
  - Real /api/auth/login or /api/auth/register -- every request acts as
    a single local user in the meantime (see app/services/local_user.py).

Before recommendations will return anything, the TF-IDF/S-BERT index
needs to be built at least once:
    python -m scripts.rebuild_recommendation_index

Run the API with:
    python -m uvicorn app.api:app --reload --port 8000
"""

import os
import shutil
import tempfile

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import init_db, get_session
from app.models.models import Paper, PersonalLibrary
from app.repositories.queries import filter_papers
from app.services.upload_paper import upload_paper_from_pdf, complete_paper_manually
from app.services.local_user import get_or_create_default_user
from app.services.recommendation.search_service import search_papers as run_search
from app.schemas import PaperOut, PaperUpdate, RepositoryStats, LibraryEntryOut, SearchResultOut

app = FastAPI(title="PaperRec API")

# Vite's dev server runs on 5173 by default. Browsers block
# cross-origin requests unless the server explicitly allows them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ---------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------

@app.get("/api/papers", response_model=list[PaperOut])
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


@app.get("/api/papers/stats", response_model=RepositoryStats)
def repository_stats(db: Session = Depends(get_session)):
    all_papers = db.query(Paper).all()
    by_subject: dict[str, int] = {}
    categories = set()

    for paper in all_papers:
        if not paper.subject_category:
            continue
        # subject_category is stored as "Subject: Category" -- see the
        # note in queries.py. Split defensively in case a row was saved
        # without that convention.
        parts = [p.strip() for p in paper.subject_category.split(":", 1)]
        subject = parts[0]
        by_subject[subject] = by_subject.get(subject, 0) + 1
        if len(parts) > 1:
            categories.add(parts[1])

    return RepositoryStats(
        total_papers=len(all_papers),
        by_subject=by_subject,
        category_count=len(categories),
    )


@app.get("/api/papers/{paper_id}", response_model=PaperOut)
def get_paper(paper_id: int, db: Session = Depends(get_session)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@app.patch("/api/papers/{paper_id}", response_model=PaperOut)
def update_paper(paper_id: int, updates: PaperUpdate, db: Session = Depends(get_session)):
    """Fills in fields manually -- completing a paper left incomplete by
    auto-extraction, or adding fields extraction never touches."""
    fields = {k: v for k, v in updates.model_dump().items() if v is not None}
    try:
        return complete_paper_manually(db, paper_id, **fields)
    except Exception:
        raise HTTPException(status_code=404, detail="Paper not found")


# ---------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------

@app.post("/api/papers/upload", response_model=PaperOut)
def upload_paper(file: UploadFile = File(...), db: Session = Depends(get_session)):
    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in (".pdf", ".tex"):
        raise HTTPException(status_code=400, detail="Only PDF and LaTeX (.tex) files are accepted")

    # upload_paper_from_pdf reads from a real file path (and needs the
    # correct extension to pick the right extractor), so the uploaded
    # bytes are written to a temp file first, then cleaned up after --
    # the permanent copy it makes lives in storage/papers/.
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        paper = upload_paper_from_pdf(db, tmp_path, file.filename)
    finally:
        os.remove(tmp_path)

    return paper


# ---------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------

@app.get("/api/library", response_model=list[LibraryEntryOut])
def get_library(db: Session = Depends(get_session)):
    user = get_or_create_default_user(db)
    entries = (
        db.query(PersonalLibrary)
        .filter(PersonalLibrary.user_id == user.id)
        .order_by(PersonalLibrary.saved_at.desc())
        .all()
    )
    return [LibraryEntryOut(paper=e.paper, saved_at=e.saved_at) for e in entries]


@app.post("/api/library/{paper_id}", status_code=201)
def save_to_library(paper_id: int, db: Session = Depends(get_session)):
    user = get_or_create_default_user(db)

    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    existing = (
        db.query(PersonalLibrary)
        .filter(PersonalLibrary.user_id == user.id, PersonalLibrary.paper_id == paper_id)
        .first()
    )
    if existing:
        return {"status": "already saved"}

    db.add(PersonalLibrary(user_id=user.id, paper_id=paper_id))
    db.commit()
    return {"status": "saved"}


@app.delete("/api/library/{paper_id}", status_code=204)
def remove_from_library(paper_id: int, db: Session = Depends(get_session)):
    user = get_or_create_default_user(db)
    entry = (
        db.query(PersonalLibrary)
        .filter(PersonalLibrary.user_id == user.id, PersonalLibrary.paper_id == paper_id)
        .first()
    )
    if entry:
        db.delete(entry)
        db.commit()


# ---------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------

# Only these two pipelines have a working implementation in
# search_service.py right now. The other four configurations from
# Chapter 3 (§3.6) exist in the UI's pipeline selector but aren't
# runnable yet -- see the module docstring above.
IMPLEMENTED_PIPELINES = {"tfidf", "sbert"}


@app.get("/api/recommendations", response_model=list[SearchResultOut])
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
                f"{sorted(IMPLEMENTED_PIPELINES)} are implemented so far."
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return [SearchResultOut(paper=r.paper, score=r.score) for r in results]
