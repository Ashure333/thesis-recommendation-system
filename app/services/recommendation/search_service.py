"""
Recommendation search orchestration.

This module combines the independent recommendation components:

    - TF-IDF
    - S-BERT
    - Metadata

The active pipeline determines which components are executed and
how their scores are weighted.

TF-IDF and S-BERT return raw cosine similarity scores.

Those component scores are normalized independently before being
combined.

Metadata scores are already bounded between 0 and 1 and therefore
are not min-max normalized.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from app.models.models import Paper

from app.services.recommendation import (
    metadata_pipeline,
    sbert_pipeline,
    tfidf_pipeline,
)

from app.services.recommendation.pipeline_config import (
    PIPELINE_NAMES,
    get_pipeline_weights,
)

from app.services.text_preparation import (
    build_prepared_text,
)


PipelineName = Literal[
    "tfidf",
    "sbert",
    "tfidf_sbert",
    "tfidf_metadata",
    "sbert_metadata",
    "tfidf_sbert_metadata",
]


def min_max_normalize(
    scores: dict[int, float],
) -> dict[int, float]:
    """
    Normalize scores to the range 0..1.

    If every score is identical, return 1.0 for every item.
    """

    if not scores:
        return {}

    values = list(scores.values())

    minimum = min(values)
    maximum = max(values)

    if maximum == minimum:
        return {
            paper_id: 1.0
            for paper_id in scores
        }

    return {
        paper_id: (
            (score - minimum)
            / (maximum - minimum)
        )
        for paper_id, score in scores.items()
    }


def _get_valid_candidates(
    db: Session,
) -> list[Paper]:
    """
    Return papers that are valid for recommendation and have
    prepared text.

    The rebuild process is responsible for determining whether
    a paper is valid for recommendation.
    """

    return (
        db.query(Paper)
        .filter(
            Paper.is_valid_for_recommendation.is_(True)
        )
        .filter(
            Paper.prepared_text.isnot(None)
        )
        .all()
    )


def _get_seed_paper(
    db: Session,
    seed_paper_id: int | None,
) -> Paper | None:
    if seed_paper_id is None:
        return None

    return (
        db.query(Paper)
        .filter(Paper.id == seed_paper_id)
        .first()
    )


def _get_query_text(
    query: str | None,
    seed_paper: Paper | None,
) -> str:
    """
    Build the prepared text used by TF-IDF and S-BERT.

    A seed paper uses its stored prepared text.

    A free-text query is treated as a title/query-style input.
    """

    if seed_paper is not None:
        if not seed_paper.is_valid_for_recommendation:
            raise ValueError(
                "Seed paper is not valid for recommendation."
            )

        if not seed_paper.prepared_text:
            raise ValueError(
                "Seed paper does not have prepared text."
            )

        return seed_paper.prepared_text

    if query is None or not query.strip():
        raise ValueError(
            "A query or seed paper is required."
        )

    return build_prepared_text(
        title=query,
        abstract=None,
        keywords=None,
    )


def _combine_scores(
    *,
    pipeline: PipelineName,
    tfidf_scores: dict[int, float],
    sbert_scores: dict[int, float],
    metadata_scores: dict[int, float],
) -> dict[int, float]:
    """
    Combine component scores using the selected pipeline weights.
    """

    weights = get_pipeline_weights(pipeline)

    normalized_tfidf = min_max_normalize(
        tfidf_scores
    )

    normalized_sbert = min_max_normalize(
        sbert_scores
    )

    # Metadata scores are already 0..1.
    normalized_metadata = metadata_scores

    paper_ids = (
        set(normalized_tfidf)
        | set(normalized_sbert)
        | set(normalized_metadata)
    )

    combined_scores: dict[int, float] = {}

    for paper_id in paper_ids:
        score = (
            weights["tfidf"]
            * normalized_tfidf.get(
                paper_id,
                0.0,
            )
            +
            weights["sbert"]
            * normalized_sbert.get(
                paper_id,
                0.0,
            )
            +
            weights["metadata"]
            * normalized_metadata.get(
                paper_id,
                0.0,
            )
        )

        combined_scores[paper_id] = score

    return combined_scores


def search_papers(
    *,
    db: Session,
    query: str | None = None,
    seed_paper_id: int | None = None,
    pipeline: PipelineName = "tfidf",
    top_k: int = 10,
) -> list[dict]:
    """
    Run one of the six configured recommendation pipelines.

    Only results with a final combined score greater than 0
    are returned.
    """

    # --------------------------------------------------------
    # Validate pipeline
    # --------------------------------------------------------

    if pipeline not in PIPELINE_NAMES:
        raise ValueError(
            f"Unsupported recommendation pipeline: {pipeline}"
        )

    # --------------------------------------------------------
    # Validate top_k
    # --------------------------------------------------------

    if top_k <= 0:
        raise ValueError(
            "top_k must be greater than 0."
        )

    # --------------------------------------------------------
    # Resolve seed
    # --------------------------------------------------------

    seed_paper = _get_seed_paper(
        db,
        seed_paper_id,
    )

    # --------------------------------------------------------
    # Build query representation
    # --------------------------------------------------------

    prepared_query = _get_query_text(
        query=query,
        seed_paper=seed_paper,
    )

    # --------------------------------------------------------
    # Get candidates
    # --------------------------------------------------------

    candidates = _get_valid_candidates(db)

    if not candidates:
        return []

    # --------------------------------------------------------
    # Remove seed paper from its own recommendations
    # --------------------------------------------------------

    if seed_paper_id is not None:
        candidates = [
            paper
            for paper in candidates
            if paper.id != seed_paper_id
        ]

    if not candidates:
        return []

    # --------------------------------------------------------
    # Pipeline weights
    # --------------------------------------------------------

    weights = get_pipeline_weights(
        pipeline
    )

    # --------------------------------------------------------
    # Component scores
    # --------------------------------------------------------

    tfidf_scores: dict[int, float] = {}
    sbert_scores: dict[int, float] = {}
    metadata_scores: dict[int, float] = {}

    # --------------------------------------------------------
    # TF-IDF
    # --------------------------------------------------------

    if weights["tfidf"] > 0:
        query_vector = (
            tfidf_pipeline.vectorize_query_or_seed(
                prepared_query
            )
        )

        tfidf_scores = (
            tfidf_pipeline.score_candidates(
                query_vector=query_vector,
                candidates=candidates,
            )
        )

    # --------------------------------------------------------
    # S-BERT
    # --------------------------------------------------------

    if weights["sbert"] > 0:
        query_vector = (
            sbert_pipeline.embed_query_or_seed(
                prepared_query
            )
        )

        sbert_scores = (
            sbert_pipeline.score_candidates(
                query_vector=query_vector,
                candidates=candidates,
            )
        )

    # --------------------------------------------------------
    # Metadata
    # --------------------------------------------------------

    if weights["metadata"] > 0:
        metadata_scores = (
            metadata_pipeline.score_candidates(
                query=query,
                seed_paper=seed_paper,
                candidates=candidates,
            )
        )

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    combined_scores = _combine_scores(
        pipeline=pipeline,
        tfidf_scores=tfidf_scores,
        sbert_scores=sbert_scores,
        metadata_scores=metadata_scores,
    )

    # --------------------------------------------------------
    # Rank
    # --------------------------------------------------------

    candidate_by_id = {
        paper.id: paper
        for paper in candidates
    }

    ranked_ids = sorted(
        combined_scores,
        key=lambda paper_id: (
            -combined_scores[paper_id],
            -(
                candidate_by_id[paper_id]
                .publication_year
                or 0
            ),
            (
                candidate_by_id[paper_id]
                .title
                or ""
            ).lower(),
        ),
    )

    # --------------------------------------------------------
    # Return top K
    # --------------------------------------------------------

    return [
        {
            "paper": candidate_by_id[paper_id],
            "score": combined_scores[paper_id],
        }
        for paper_id in ranked_ids
        if combined_scores[paper_id] > 0
    ][:top_k]