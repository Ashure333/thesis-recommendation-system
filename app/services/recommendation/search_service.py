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

An optional MMR (Maximal Marginal Relevance) step can diversify the
final list -- see app/services/recommendation/mmr.py. It is opt-in via
``mmr_lambda``: it only reorders the positive-score results and never
changes their scores, and the default path (mmr_lambda=None) is
untouched.
"""

from __future__ import annotations

import json

from typing import Literal

from sqlalchemy.orm import Session

from app.models.models import Paper

from app.services.recommendation import (
    metadata_pipeline,
    mmr,
    sbert_pipeline,
    tfidf_pipeline,
)
from app.services.recommendation.similarity import min_max_normalize

from app.services.recommendation.pipeline_config import (
    PIPELINE_NAMES,
    PipelineWeights,
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

# The six presets plus "custom" — the dial-allocated pipeline, which
# always carries its own weights via `custom_weights`.
SearchPipelineName = Literal[
    "tfidf",
    "sbert",
    "tfidf_sbert",
    "tfidf_metadata",
    "sbert_metadata",
    "tfidf_sbert_metadata",
    "custom",
]


def _round_scores(
    scores: dict[int, float],
    digits: int = 6,
) -> dict[int, float]:
    """
    Round per-paper score dicts for trace payloads.

    The full-precision floats are what the ranking actually uses;
    the rounded copies are only for display.
    """

    return {
        paper_id: round(float(score), digits)
        for paper_id, score in scores.items()
    }


def _summarize_scores(
    scores: dict[int, float],
) -> dict:
    """
    Compact numeric summary (min / max / count) of a score mapping,
    used by trace events so the frontend can annotate the math with
    the actual distribution before normalization.
    """

    if not scores:
        return {
            "count": 0,
            "min": None,
            "max": None,
        }

    values = list(scores.values())

    return {
        "count": len(values),
        "min": round(float(min(values)), 6),
        "max": round(float(max(values)), 6),
    }


def _normalization_bounds(
    scores: dict[int, float],
) -> dict:
    """
    The (min, max) pair that min-max normalization rescales against,
    with the degeneracy flag (all scores equal).

    This is exactly what min_max_normalize() computes internally --
    recorded here so the trace can show the formula's actual bounds.
    """

    summary = _summarize_scores(scores)

    return {
        "min": summary["min"],
        "max": summary["max"],
        "normalized": summary["count"] > 0,
        "degenerate": (
            summary["count"] > 0
            and summary["min"] == summary["max"]
        ),
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
    weights: PipelineWeights | None = None,
) -> dict[int, float]:
    """
    Combine component scores using the selected pipeline weights —
    the preset's shares, or an explicit override (the dial
    allocation for the custom pipeline).
    """

    if weights is None:
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


def _component_contributions(
    *,
    paper_ids: list[int],
    tfidf_scores: dict[int, float],
    sbert_scores: dict[int, float],
    metadata_scores: dict[int, float],
    weights: PipelineWeights,
) -> dict[int, dict[str, float]]:
    """
    The weighted per-component contributions behind each returned
    result's score:

        components[i] = w_i * s'_i   (rounded to 6 decimals)

    where s'_i is the min-max normalized TF-IDF / S-BERT score and the
    metadata score enters already bounded in [0, 1]. A component whose
    weight is 0 -- or which the candidate has no score for -- is 0.0.

    Only the ids actually returned by search_papers() are processed,
    so the scoring path pays nothing for the breakdown. The normalized
    maps are recomputed here rather than shared with _combine_scores()
    on purpose: the ranking score stays byte-identical to what the
    combination computed, and normalization is a cheap pass over the
    already-computed raw scores.
    """

    if not paper_ids:
        return {}

    normalized_tfidf = min_max_normalize(tfidf_scores)
    normalized_sbert = min_max_normalize(sbert_scores)

    contributions: dict[int, dict[str, float]] = {}

    for paper_id in paper_ids:
        contributions[paper_id] = {
            "tfidf": round(
                weights["tfidf"]
                * normalized_tfidf.get(paper_id, 0.0),
                6,
            ),
            "sbert": round(
                weights["sbert"]
                * normalized_sbert.get(paper_id, 0.0),
                6,
            ),
            "metadata": round(
                weights["metadata"]
                * metadata_scores.get(paper_id, 0.0),
                6,
            ),
        }

    return contributions


def _uninformative_similarity(
    left_id: int,
    right_id: int,
) -> float:
    """
    MMR redundancy fallback when no candidate vector is available.

    Without vectors there is no measured similarity to diversify on,
    so every pair counts as (uninformatively) similar. The redundancy
    term then becomes a constant and MMR keeps the relevance order.
    """

    return 1.0


def search_papers(
    *,
    db: Session,
    query: str | None = None,
    seed_paper_id: int | None = None,
    pipeline: SearchPipelineName = "tfidf",
    top_k: int = 10,
    trace: object | None = None,
    custom_weights: PipelineWeights | None = None,
    mmr_lambda: float | None = None,
    mmr_pool: int = 50,
) -> list[dict]:
    """
    Run one of the six configured recommendation pipelines — or the
    "custom" pipeline, whose dial-provided weights replace the
    preset allocation (they must sum to 1; build them with
    pipeline_config.build_custom_weights).

    Only results with a final combined score greater than 0
    are returned.

    Each returned item also carries a ``components`` dict with the
    three weighted contributions that produced its score
    (w_tfidf * s'_tfidf, w_sbert * s'_sbert, w_meta * s_meta),
    rounded to 6 decimals. The breakdown is computed for the returned
    top-k items only and never changes the score or the ranking.

    When ``mmr_lambda`` is set (0..1), the positive-score results are
    reranked with Maximal Marginal Relevance over at most ``mmr_pool``
    candidates before truncation. MMR changes the ORDER only; every
    returned item keeps its original combined score. When
    ``mmr_lambda`` is None (the default) the search is unchanged and
    no candidate vector is parsed.

    When a trace recorder is provided (duck-typed: it only needs a
    record(event, message, data) method), every step of the
    computation is recorded with its actual intermediate values so
    the frontend can visualize the math with real numbers.
    """

    # --------------------------------------------------------
    # Validate pipeline / custom weights
    # --------------------------------------------------------

    if pipeline not in PIPELINE_NAMES and pipeline != "custom":
        raise ValueError(
            f"Unsupported recommendation pipeline: {pipeline}"
        )

    if pipeline == "custom":
        if custom_weights is None:
            raise ValueError(
                "The custom pipeline requires weights "
                "(tfidf, sbert, metadata)."
            )
    elif custom_weights is not None:
        raise ValueError(
            "custom_weights may only be used with pipeline='custom'."
        )

    # --------------------------------------------------------
    # Effective weights: the dial allocation for "custom",
    # otherwise the preset's configured shares.
    # --------------------------------------------------------

    weights = (
        custom_weights
        if custom_weights is not None
        else get_pipeline_weights(pipeline)
    )

    # --------------------------------------------------------
    # Validate top_k
    # --------------------------------------------------------

    if top_k <= 0:
        raise ValueError(
            "top_k must be greater than 0."
        )

    # --------------------------------------------------------
    # Validate opt-in MMR parameters
    # --------------------------------------------------------

    if mmr_lambda is not None and not (
        0.0 <= mmr_lambda <= 1.0
    ):
        raise ValueError(
            "mmr_lambda must be within [0, 1]."
        )

    if not 1 <= mmr_pool <= 100:
        raise ValueError(
            "mmr_pool must be between 1 and 100."
        )

    # --------------------------------------------------------
    # Resolve seed
    # --------------------------------------------------------

    seed_paper = _get_seed_paper(
        db,
        seed_paper_id,
    )

    if trace is not None:
        trace.record(
            "input",
            "Request inputs as received by the engine.",
            {
                "pipeline": pipeline,
                "top_k": top_k,
                "query": query,
                "seed_paper_id": seed_paper_id,
                "weights": weights,
            },
        )

    # --------------------------------------------------------
    # Build query representation
    # --------------------------------------------------------

    prepared_query = _get_query_text(
        query=query,
        seed_paper=seed_paper,
    )

    if trace is not None:
        trace.record(
            "prepared_query",
            "Query representation after text preparation "
            "(Title + Abstract + Keywords, normalized).",
            {
                "text": prepared_query,
                "length": len(prepared_query),
                "source": (
                    "seed_paper"
                    if seed_paper is not None
                    else "free_text_query"
                ),
            },
        )

    # --------------------------------------------------------
    # Get candidates
    # --------------------------------------------------------

    candidates = _get_valid_candidates(db)

    if not candidates:
        return []

    if trace is not None:
        trace.record(
            "candidates",
            "Candidate set: papers valid for recommendation "
            "with prepared text.",
            {
                "count": len(candidates),
                "papers": [
                    {
                        "id": paper.id,
                        "title": paper.title,
                        "year": paper.publication_year,
                    }
                    for paper in candidates
                ],
            },
        )

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

    # (The effective pipeline weights — preset shares or the dial
    # allocation for "custom" — were resolved before the seed and
    # are used to gate which components run below.)

    # --------------------------------------------------------
    # Release the DB connection
    #
    # Every row this search needs (seed + candidates) is loaded and
    # nothing below touches the session again. Ending the transaction
    # here hands the pooled connection back while TF-IDF/S-BERT scoring
    # runs, so concurrent queries queue on the encoder instead of
    # pinning one connection each for the whole request.
    # --------------------------------------------------------

    db.commit()

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

        if trace is not None:
            trace.record(
                "component.tfidf",
                "TF-IDF component: cosine similarity between the "
                "query vector and each stored candidate vector.",
                {
                    "vector_dim": len(query_vector),
                    "nonzero_terms": sum(
                        1 for value in query_vector
                        if value != 0.0
                    ),
                    "top_terms": (
                        tfidf_pipeline.top_query_terms(
                            prepared_query,
                            k=5,
                        )
                    ),
                    "scores": _round_scores(tfidf_scores),
                    "summary": _summarize_scores(tfidf_scores),
                },
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

        if trace is not None:
            trace.record(
                "component.sbert",
                "S-BERT component: cosine similarity between the "
                "query embedding and each candidate embedding.",
                {
                    "vector_dim": len(query_vector),
                    "scores": _round_scores(sbert_scores),
                    "summary": _summarize_scores(sbert_scores),
                },
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
                trace=trace,
            )
        )

        if trace is not None:
            trace.record(
                "component.metadata.summary",
                "Metadata component: combined 4-signal score.",
                {
                    "scores": _round_scores(metadata_scores),
                    "summary": _summarize_scores(metadata_scores),
                },
            )

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    combined_scores = _combine_scores(
        pipeline=pipeline,
        tfidf_scores=tfidf_scores,
        sbert_scores=sbert_scores,
        metadata_scores=metadata_scores,
        weights=weights,
    )

    if trace is not None:
        trace.record(
            "normalization",
            "Min-max normalization bounds applied to each "
            "component's raw scores (metadata is already in [0, 1] "
            "and is not normalized).",
            {
                "tfidf": _normalization_bounds(tfidf_scores),
                "sbert": _normalization_bounds(sbert_scores),
                "metadata": {
                    "normalized": False,
                    "min": _summarize_scores(
                        metadata_scores
                    )["min"],
                    "max": _summarize_scores(
                        metadata_scores
                    )["max"],
                },
            },
        )

        trace.record(
            "combine",
            "Weighted combination: S(d) = sum of "
            "weight * normalized_component_score(d).",
            {
                "weights": weights,
                "scores": _round_scores(combined_scores),
            },
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

    if trace is not None:
        trace.record(
            "rank",
            "Ranking: S(d) descending; tie-break by newer "
            "publication year, then title alphabetically.",
            {
                "ranked": [
                    {
                        "id": paper_id,
                        "score": round(
                            float(combined_scores[paper_id]),
                            6,
                        ),
                        "year": (
                            candidate_by_id[paper_id]
                            .publication_year
                        ),
                    }
                    for paper_id in ranked_ids
                    if combined_scores[paper_id] > 0
                ][:top_k],
            },
        )

    # --------------------------------------------------------
    # MMR diversification (opt-in)
    #
    # Only reached when a lambda was supplied, so the default path
    # above stays byte-identical: no vector parsing, no extra trace
    # event. MMR reorders the positive-score ids; the combined scores
    # themselves are never recomputed.
    # --------------------------------------------------------

    if mmr_lambda is not None:
        positive_ids = [
            paper_id
            for paper_id in ranked_ids
            if combined_scores[paper_id] > 0
        ]

        effective_pool = min(
            mmr_pool,
            len(positive_ids),
        )

        pool_ids = positive_ids[:effective_pool]

        # Parse only what the pool actually needs, and only now that
        # MMR has been requested.
        sbert_vectors: dict[int, list[float]] = {}
        tfidf_vectors: dict[int, list[float]] = {}

        for paper_id in pool_ids:
            paper = candidate_by_id[paper_id]

            if paper.sbert_vector:
                sbert_vectors[paper_id] = json.loads(
                    paper.sbert_vector
                )

            if paper.tfidf_vector:
                tfidf_vectors[paper_id] = json.loads(
                    paper.tfidf_vector
                )

        # Redundancy signal preference: S-BERT (semantic) first, then
        # TF-IDF (lexical). Fewer than two vectors cannot distinguish
        # any pair, so the fallback treats every pair as similar and
        # the order stays pure relevance.
        if len(sbert_vectors) >= 2:
            similarity = mmr.vector_similarity_getter(
                sbert_vectors
            )
            similarity_source = "sbert"
        elif len(tfidf_vectors) >= 2:
            similarity = mmr.vector_similarity_getter(
                tfidf_vectors
            )
            similarity_source = "tfidf"
        else:
            similarity = _uninformative_similarity
            similarity_source = "none"

        reranked_ids = (
            mmr.select_mmr(
                ranked_ids=positive_ids,
                scores=combined_scores,
                similarity=similarity,
                lambda_=mmr_lambda,
                pool_size=effective_pool,
            )
            if positive_ids
            else []
        )

        if trace is not None:
            trace.record(
                "rerank.mmr",
                "MMR diversification: trades relevance against "
                "redundancy within the candidate pool (order "
                "changes, scores do not).",
                {
                    "lambda": mmr_lambda,
                    "pool": mmr_pool,
                    "pool_used": effective_pool,
                    "similarity_source": similarity_source,
                    "before": positive_ids[:5],
                    "after": reranked_ids[:5],
                },
            )

        returned_ids = reranked_ids[:top_k]

        component_contributions = _component_contributions(
            paper_ids=returned_ids,
            tfidf_scores=tfidf_scores,
            sbert_scores=sbert_scores,
            metadata_scores=metadata_scores,
            weights=weights,
        )

        return [
            {
                "paper": candidate_by_id[paper_id],
                "score": combined_scores[paper_id],
                "components": (
                    component_contributions[paper_id]
                ),
            }
            for paper_id in returned_ids
        ]

    # --------------------------------------------------------
    # Return top K
    # --------------------------------------------------------

    returned_ids = [
        paper_id
        for paper_id in ranked_ids
        if combined_scores[paper_id] > 0
    ][:top_k]

    component_contributions = _component_contributions(
        paper_ids=returned_ids,
        tfidf_scores=tfidf_scores,
        sbert_scores=sbert_scores,
        metadata_scores=metadata_scores,
        weights=weights,
    )

    return [
        {
            "paper": candidate_by_id[paper_id],
            "score": combined_scores[paper_id],
            "components": component_contributions[paper_id],
        }
        for paper_id in returned_ids
    ]
