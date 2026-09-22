import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import requests
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

from app.services.storage import (
    delete_paper_file,
    get_paper_file_path,
)

from app.services.local_user import get_or_create_default_user

from app.services.recommendation.search_service import (
    search_papers as run_search,
)

from app.services.pdf_finder import (
    find_pdf_candidates,
    download_and_attach_pdf,
)

from app.schemas import (
    PaperOut,
    PaperUpdate,
    RepositoryStats,
    LibraryEntryOut,
    SearchResultOut,
    PdfCandidateOut,
    AttachPdfRequest,
)


app = FastAPI(title="PaperRec API")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    init_db()


# ============================================================
# FILE HELPERS
# ============================================================

def resolve_stored_file(stored_path: str | None) -> Path:
    """
    Convert the database stored path such as:

        papers/60.pdf

    into the actual storage path:

        storage/papers/60.pdf
    """

    if not stored_path:
        raise HTTPException(
            status_code=404,
            detail="Paper file not found.",
        )

    path = Path(get_paper_file_path(stored_path))

    if not path.exists() or not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Paper file not found.",
        )

    return path


# ============================================================
# RECOMMENDATION REBUILD
# ============================================================

def rebuild_recommendation_data():
    """
    Rebuild classification, validation, TF-IDF and S-BERT
    recommendation data after repository changes.
    """

    script_path = (
        Path(__file__).resolve().parent.parent
        / "scripts"
        / "rebuild_recommendation.py"
    )

    if not script_path.exists():
        print("Recommendation rebuild script not found.")
        return

    try:
        subprocess.run(
            [
                sys.executable,
                str(script_path),
            ],
            check=True,
        )

    except subprocess.CalledProcessError as error:
        print("Recommendation rebuild failed:")
        print(error)


# ============================================================
# PAPERS
# ============================================================

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
    sort_by: str | None = None,
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

    if limit is not None:
        papers = papers[:limit]

    return papers


# ============================================================
# REPOSITORY STATS
# ============================================================

@app.get(
    "/api/papers/stats",
    response_model=RepositoryStats,
)
def get_repository_stats(
    db: Session = Depends(get_session),
):
    papers = db.query(Paper).all()

    by_subject: dict[str, int] = {}

    for paper in papers:
        subject = paper.subject_category or "Uncategorized"
        by_subject[subject] = by_subject.get(subject, 0) + 1

    return RepositoryStats(
        total_papers=len(papers),
        by_subject=by_subject,
        category_count=len(by_subject),
    )


# ============================================================
# PDF VIEWER
# ============================================================

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

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    stored_path = paper.stored_path

    if not stored_path:
        raise HTTPException(
            status_code=404,
            detail="Paper does not have a stored file.",
        )

    if not stored_path.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=404,
            detail="This paper does not have a PDF file.",
        )

    path = resolve_stored_file(stored_path)

    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
        },
    )


# ============================================================
# FIND PDF ONLINE
# ============================================================

@app.get(
    "/api/papers/{paper_id}/find-pdf",
    response_model=list[PdfCandidateOut],
)
def find_pdf(
    paper_id: int,
    db: Session = Depends(get_session),
):
    """
    Search-only step: looks for a legal open-access PDF matching this
    paper (Unpaywall, Semantic Scholar, arXiv) and returns candidates
    for the user to review. Nothing is downloaded here.
    """

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    if paper.stored_path and paper.stored_path.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="This paper already has a stored PDF.",
        )

    try:
        candidates = find_pdf_candidates(paper)

    except Exception as error:

        print()
        print("FIND PDF FAILED")
        print(error)

        raise HTTPException(
            status_code=502,
            detail="Could not search for a PDF right now.",
        )

    return [
        PdfCandidateOut(**candidate.to_dict())
        for candidate in candidates
    ]


@app.post(
    "/api/papers/{paper_id}/attach-pdf",
    response_model=PaperOut,
)
def attach_pdf(
    paper_id: int,
    payload: AttachPdfRequest,
    db: Session = Depends(get_session),
):
    """
    Confirm step: downloads the PDF at the given URL (a candidate the
    user picked from /find-pdf) and attaches it to the paper, the same
    way an uploaded PDF is stored.
    """

    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    try:
        stored_path = download_and_attach_pdf(
            paper_id,
            payload.url,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:

        print()
        print("ATTACH PDF FAILED")
        print(error)

        raise HTTPException(
            status_code=502,
            detail="Could not download the PDF from that link.",
        )

    paper.stored_path = stored_path

    db.commit()
    db.refresh(paper)

    return paper


# ============================================================
# GET SINGLE PAPER
# ============================================================

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

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    return paper


# ============================================================
# UPDATE PAPER
# ============================================================

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

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    changed_recommendation_fields = False

    update_data = updates.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():

        if field in {
            "title",
            "abstract",
            "keywords",
            "publication_year",
        }:
            changed_recommendation_fields = True

        if hasattr(paper, field):
            setattr(
                paper,
                field,
                value,
            )

    db.commit()
    db.refresh(paper)

    if changed_recommendation_fields:
        rebuild_recommendation_data()

    return paper


# ============================================================
# DELETE PAPER
# ============================================================

@app.delete("/api/papers/{paper_id}")
def delete_paper(
    paper_id: int,
    db: Session = Depends(get_session),
):
    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    stored_path = paper.stored_path

    try:
        if stored_path:
            delete_paper_file(stored_path)

    except Exception as error:
        print("Could not delete stored paper file:")
        print(error)

    db.delete(paper)
    db.commit()

    if stored_path:
        rebuild_recommendation_data()

    return {
        "status": "deleted"
    }


# ============================================================
# UPLOAD PAPER
# ============================================================

@app.post(
    "/api/papers/upload",
    response_model=PaperOut,
)
def upload_paper(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="A filename is required.",
        )

    suffix = os.path.splitext(
        file.filename
    )[1].lower()

    if suffix not in (
        ".pdf",
        ".bib",
    ):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and BibTeX (.bib) files are accepted.",
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

        rebuild_recommendation_data()

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


# ============================================================
# GOOGLE SCHOLAR BIBTEX IMPORT
# ============================================================

SCHOLAR_BIB_URL_PATTERN = re.compile(
    r"^https://scholar\.googleusercontent\.com/scholar\.bib",
    re.IGNORECASE,
)


@app.post(
    "/api/papers/import-url",
    response_model=PaperOut,
)
def import_paper_from_url(
    url: str,
    db: Session = Depends(get_session),
):
    url = url.strip()

    if not SCHOLAR_BIB_URL_PATTERN.match(url):
        raise HTTPException(
            status_code=400,
            detail="Only Google Scholar BibTeX links are accepted.",
        )

    try:

        response = requests.get(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/124.0.0.0 "
                    "Safari/537.36"
                ),
                "Accept": (
                    "text/plain, "
                    "application/x-bibtex, "
                    "*/*"
                ),
            },
            timeout=10,
        )

    except requests.RequestException as error:

        print("GOOGLE SCHOLAR REQUEST FAILED")
        print(error)

        raise HTTPException(
            status_code=502,
            detail="Could not reach Google Scholar.",
        )

    if not response.ok:

        status_code = response.status_code

        if status_code in (
            403,
            429,
            503,
        ):
            raise HTTPException(
                status_code=502,
                detail=(
                    "Google Scholar is temporarily "
                    "blocking automated requests. "
                    "Please try again later."
                ),
            )

        raise HTTPException(
            status_code=502,
            detail=(
                f"Google Scholar returned "
                f"HTTP {status_code}."
            ),
        )

    content = response.text.strip()

    if not re.search(
        r"@\w+\s*\{",
        content,
        re.IGNORECASE,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "The Google Scholar link did not "
                "return a valid BibTeX citation."
            ),
        )

    with tempfile.NamedTemporaryFile(
        suffix=".bib",
        delete=False,
        mode="w",
        encoding="utf-8",
    ) as tmp:

        tmp.write(content)
        tmp_path = tmp.name

    try:

        paper = upload_paper_from_pdf(
            db,
            tmp_path,
            "google-scholar.bib",
        )

        rebuild_recommendation_data()

    except Exception as error:

        print("SCHOLAR IMPORT FAILED")
        print(error)

        raise HTTPException(
            status_code=500,
            detail="Failed to import the citation.",
        )

    finally:

        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return paper


# ============================================================
# DIRECT BIBTEX IMPORT
# ============================================================

@app.post(
    "/api/papers/import-bibtex",
    response_model=PaperOut,
)
def import_bibtex(
    payload: dict,
    db: Session = Depends(get_session),
):
    bibtex = payload.get("bibtex")
    source_url = payload.get("source_url")

    if not bibtex or not isinstance(
        bibtex,
        str,
    ):
        raise HTTPException(
            status_code=400,
            detail="BibTeX content is required.",
        )

    if not re.search(
        r"@\w+\s*\{",
        bibtex,
        re.IGNORECASE,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid BibTeX content.",
        )

    with tempfile.NamedTemporaryFile(
        suffix=".bib",
        delete=False,
        mode="w",
        encoding="utf-8",
    ) as tmp:

        tmp.write(bibtex)
        tmp_path = tmp.name

    try:

        filename = "google-scholar.bib"

        if source_url:
            filename = "google-scholar.bib"

        paper = upload_paper_from_pdf(
            db,
            tmp_path,
            filename,
        )

        rebuild_recommendation_data()

    except Exception as error:

        print("BIBTEX IMPORT FAILED")
        print(error)

        raise HTTPException(
            status_code=500,
            detail="Failed to import the citation.",
        )

    finally:

        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return paper


# ============================================================
# PERSONAL LIBRARY
# ============================================================

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
        .all()
    )

    return entries


# ============================================================
# SAVE PAPER TO LIBRARY
# ============================================================

@app.post("/api/library/{paper_id}")
def save_to_library(
    paper_id: int,
    db: Session = Depends(get_session),
):
    paper = (
        db.query(Paper)
        .filter(Paper.id == paper_id)
        .first()
    )

    if not paper:
        raise HTTPException(
            status_code=404,
            detail="Paper not found.",
        )

    user = get_or_create_default_user(db)

    existing = (
        db.query(PersonalLibrary)
        .filter(
            PersonalLibrary.user_id == user.id,
            PersonalLibrary.paper_id == paper_id,
        )
        .first()
    )

    if existing:
        return {
            "status": "already_saved"
        }

    entry = PersonalLibrary(
        user_id=user.id,
        paper_id=paper_id,
    )

    db.add(entry)
    db.commit()

    return {
        "status": "saved"
    }


# ============================================================
# REMOVE PAPER FROM LIBRARY
# ============================================================

@app.delete("/api/library/{paper_id}")
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

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Paper is not in the library.",
        )

    db.delete(entry)
    db.commit()

    return {
        "status": "removed"
    }


from app.services.pdf_finder import find_pdf_candidates, download_and_attach_pdf
from app.schemas import PdfCandidateOut, AttachPdfRequest

@app.get("/api/papers/{paper_id}/find-pdf", response_model=list[PdfCandidateOut])
def find_pdf(paper_id: int, db: Session = Depends(get_session)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    return [c.to_dict() for c in find_pdf_candidates(paper)]


@app.post("/api/papers/{paper_id}/attach-pdf", response_model=PaperOut)
def attach_pdf(
    paper_id: int,
    payload: AttachPdfRequest,
    db: Session = Depends(get_session),
):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    try:
        stored_path = download_and_attach_pdf(paper_id, payload.url, paper.title, paper.doi)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    paper.stored_path = stored_path
    db.commit()
    db.refresh(paper)
    return paper
# ============================================================
# RECOMMENDATIONS
# ============================================================

IMPLEMENTED_PIPELINES = {
    "tfidf",
    "sbert",
}


@app.get(
    "/api/recommendations",
    response_model=list[SearchResultOut],
)
def get_recommendations(
    pipeline: str,
    query: str | None = None,
    seed_paper_id: int | None = None,
    top_k: int = 10,
    db: Session = Depends(get_session),
):
    # --------------------------------------------------------
    # Validate pipeline
    # --------------------------------------------------------

    if pipeline not in IMPLEMENTED_PIPELINES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported recommendation pipeline: "
                f"{pipeline}"
            ),
        )

    # --------------------------------------------------------
    # Require either query OR seed paper
    # --------------------------------------------------------

    if not query and seed_paper_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Provide either a query or seed_paper_id."
            ),
        )

    # --------------------------------------------------------
    # Do not allow both at the same time
    # --------------------------------------------------------

    if query and seed_paper_id is not None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Provide either a query or seed_paper_id, "
                "not both."
            ),
        )

    # --------------------------------------------------------
    # Validate top_k
    # --------------------------------------------------------

    if top_k <= 0:
        raise HTTPException(
            status_code=400,
            detail="top_k must be greater than 0.",
        )

    # --------------------------------------------------------
    # Validate seed paper if one was supplied
    # --------------------------------------------------------

    if seed_paper_id is not None:

        seed_paper = (
            db.query(Paper)
            .filter(
                Paper.id == seed_paper_id
            )
            .first()
        )

        if not seed_paper:
            raise HTTPException(
                status_code=404,
                detail="Seed paper not found.",
            )

    # --------------------------------------------------------
    # Run recommendation search
    # --------------------------------------------------------

    try:

        results = run_search(
            db=db,
            query=query,
            seed_paper_id=seed_paper_id,
            pipeline=pipeline,
            top_k=top_k,
        )

    except Exception as error:

        print()
        print("RECOMMENDATION SEARCH FAILED")
        print(error)

        raise HTTPException(
            status_code=500,
            detail="Recommendation search failed.",
        )

    return results
