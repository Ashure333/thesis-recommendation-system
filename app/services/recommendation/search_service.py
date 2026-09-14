"""
TF-IDF and S-BERT recommendation search service.

This module handles query-time recommendation search only.

Supported pipelines:
    - tfidf
    - sbert

Metadata and hybrid pipelines will be added later.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.text_preparation import build_prepared_text
from app.services.recommendation import tfidf_pipeline
from app.services.recommendation import sbert_pipeline


PipelineName = Literal["tfidf", "sbert"]


@dataclass
class SearchResult:
    paper: Paper
    score: float


def _get_valid_candidates(
    db: Session,
    exclude_paper_id: int | None = None,
) -> list[Paper]:
    """
    Retrieve only papers that are valid for recommendation.

    A paper must:
        - be marked as valid
        - have prepared text
    """

    query = (
        db.query(Paper)
        .filter(Paper.is_valid_for_recommendation.is_(True))
        .filter(Paper.prepared_text.isnot(None))
    )

    if exclude_paper_id is not None:
        query = query.filter(Paper.id != exclude_paper_id)

    return query.all()


def _get_query_text(
    db: Session,
    query: str | None,
    seed_paper_id: int | None,
) -> tuple[str, int | None]:
    """
    Resolve the search input.

    Exactly one of these should be provided:
        - query text
        - seed paper ID

    Returns:
        prepared query text
        seed paper ID, if applicable
    """

    if query and seed_paper_id is not None:
        raise ValueError(
            "Provide either query text or seed_paper_id, not both."
        )

    if not query and seed_paper_id is None:
        raise ValueError(
            "Provide either query text or seed_paper_id."
        )

    if seed_paper_id is not None:
        seed_paper = (
            db.query(Paper)
            .filter(Paper.id == seed_paper_id)
            .first()
        )

        if seed_paper is None:
            raise ValueError(
                f"Paper with ID {seed_paper_id} was not found."
            )

        if not seed_paper.is_valid_for_recommendation:
            raise ValueError(
                "The selected seed paper is not valid for recommendation."
            )

        if not seed_paper.prepared_text:
            raise ValueError(
                "The selected seed paper has no prepared text."
            )

        return seed_paper.prepared_text, seed_paper.id

    prepared_query = build_prepared_text(
        title=query,
        abstract=None,
        keywords=None,
    )

    if not prepared_query:
        raise ValueError(
            "The search query became empty after text preparation."
        )

    return prepared_query, None


def search_papers(
    db: Session,
    *,
    query: str | None = None,
    seed_paper_id: int | None = None,
    pipeline: PipelineName = "tfidf",
    top_k: int = 10,
    exclude_seed: bool = True,
) -> list[SearchResult]:
    """
    Search papers using TF-IDF or S-BERT similarity.

    Args:
        db:
            SQLAlchemy database session.

        query:
            User-entered keyword/title/topic query.

        seed_paper_id:
            Existing paper to use as the recommendation seed.

        pipeline:
            Either "tfidf" or "sbert".

        top_k:
            Number of results to return.

        exclude_seed:
            If True, the seed paper is excluded from the results.

    Returns:
        A ranked list of SearchResult objects.
    """

    if pipeline not in {"tfidf", "sbert"}:
        raise ValueError(
            "Invalid pipeline. Choose either 'tfidf' or 'sbert'."
        )

    if top_k <= 0:
        raise ValueError("top_k must be greater than zero.")

    prepared_query, resolved_seed_id = _get_query_text(
        db=db,
        query=query,
        seed_paper_id=seed_paper_id,
    )

    exclude_id = (
        resolved_seed_id
        if exclude_seed
        else None
    )

    candidates = _get_valid_candidates(
        db=db,
        exclude_paper_id=exclude_id,
    )

    if not candidates:
        return []

    if pipeline == "tfidf":
        query_vector = tfidf_pipeline.vectorize_query_or_seed(
            prepared_query
        )

        scores = tfidf_pipeline.score_candidates(
            query_vector=query_vector,
            candidates=candidates,
        )

    else:
        query_vector = sbert_pipeline.embed_query_or_seed(
            prepared_query
        )

        scores = sbert_pipeline.score_candidates(
            query_vector=query_vector,
            candidates=candidates,
        )

    ranked_results = [
        SearchResult(
            paper=paper,
            score=scores[paper.id],
        )
        for paper in candidates
        if paper.id in scores
    ]

    ranked_results.sort(
        key=lambda result: (
            -result.score,
            -(result.paper.publication_year or 0),
            result.paper.title.lower(),
        )
    )

    return ranked_results[:top_k]