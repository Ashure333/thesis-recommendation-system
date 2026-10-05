"""
Maximal Marginal Relevance (MMR) diversification.

The regular search ranking is pure relevance: a result list can fill
up with near-duplicates of the same paper. MMR (Carbonell & Goldstein,
1998) reranks a bounded candidate pool so each pick balances relevance
against redundancy:

    MMR(i) = lambda * score(i)
             - (1 - lambda) * max(similarity(i, j) for j selected)

At lambda = 1 the order is pure relevance; at lambda = 0 the highest
scoring paper still comes first (a fixed convention), after which only
diversity matters.

This module is deliberately dependency-free -- pure Python, no NumPy.
The vectors it consumes are the small JSON-decoded embedding lists
already stored on each Paper row.
"""

from __future__ import annotations

import math

from typing import Callable


def vector_similarity_getter(
    vectors: dict[int, list[float]],
) -> Callable[[int, int], float]:
    """
    Build a cosine-similarity function over a {paper_id: vector} map.

    The returned callable follows the corpus convention (see
    app/services/recommendation/similarity.py): cosine, clipped into
    [0, 1]. Negative cosines become 0.0 because MMR only needs a
    non-negative redundancy penalty.

    A missing, empty, zero-magnitude, or dimension-mismatched vector
    yields 0.0 -- no measurable similarity, so the pair does not
    penalize diversity. Vector norms are computed once when the getter
    is built, so each call after that is one dot product plus a
    division.
    """

    norms: dict[int, float] = {}

    for paper_id, vector in vectors.items():
        if not vector:
            continue

        norms[paper_id] = math.sqrt(
            sum(value * value for value in vector)
        )

    def similarity(left_id: int, right_id: int) -> float:
        left = vectors.get(left_id)
        right = vectors.get(right_id)

        if not left or not right:
            return 0.0

        if len(left) != len(right):
            return 0.0

        left_norm = norms.get(left_id, 0.0)
        right_norm = norms.get(right_id, 0.0)

        if left_norm == 0.0 or right_norm == 0.0:
            return 0.0

        dot = 0.0
        for left_value, right_value in zip(left, right):
            dot += left_value * right_value

        value = dot / (left_norm * right_norm)

        if value < 0.0:
            return 0.0

        if value > 1.0:
            return 1.0

        return value

    return similarity


def select_mmr(
    ranked_ids: list[int],
    scores: dict[int, float],
    similarity: Callable[[int, int], float],
    lambda_: float,
    pool_size: int | None = None,
) -> list[int]:
    """
    Reorder a relevance-ranked id list with greedy MMR.

    ``ranked_ids`` is the relevance-ordered candidate list (best first)
    and ``scores`` maps each id to its relevance score. Only the first
    ``pool_size`` ids (or all of them when pool_size is None) take part
    in the diversification; the remaining ids keep their original order
    and are appended after the reranked pool.

    The first pick is always the highest-scoring candidate, even at
    lambda_ = 0 -- afterwards ties are broken deterministically by
    higher score, then lower id.

    ``similarity`` is only called for pairs involving the item that was
    just selected, so the redundancy update costs O(pool) calls per
    pick instead of materializing an N x N similarity matrix.

    Raises:
        ValueError:
            If lambda_ is outside [0, 1], or pool_size is below 1.
    """

    if not 0.0 <= lambda_ <= 1.0:
        raise ValueError(
            "lambda_ must be within [0, 1]."
        )

    if pool_size is not None and pool_size < 1:
        raise ValueError(
            "pool_size must be at least 1 "
            "(or None for the whole list)."
        )

    if not ranked_ids:
        return []

    effective_pool = (
        len(ranked_ids)
        if pool_size is None
        else min(pool_size, len(ranked_ids))
    )

    pool = list(ranked_ids[:effective_pool])
    tail = list(ranked_ids[effective_pool:])

    pool_scores = {
        paper_id: float(scores.get(paper_id, 0.0))
        for paper_id in pool
    }

    selected: list[int] = []
    remaining = set(pool)

    # --------------------------------------------------------
    # First pick: highest score, lower id on a score tie.
    # --------------------------------------------------------

    first = max(
        pool,
        key=lambda paper_id: (
            pool_scores[paper_id],
            -paper_id,
        ),
    )

    selected.append(first)
    remaining.discard(first)

    # Highest similarity each remaining candidate has to anything
    # already selected; updated incrementally as picks are made.
    max_similarity = {
        paper_id: 0.0 for paper_id in remaining
    }

    def absorb(new_id: int) -> None:
        """Update redundancy penalties against a newly selected id."""

        for paper_id in remaining:
            value = similarity(paper_id, new_id)
            if value > max_similarity[paper_id]:
                max_similarity[paper_id] = value

    absorb(first)

    # --------------------------------------------------------
    # Greedy picks
    # --------------------------------------------------------

    while remaining:
        best_id = max(
            remaining,
            key=lambda paper_id: (
                lambda_ * pool_scores[paper_id]
                - (1.0 - lambda_)
                * max_similarity[paper_id],
                pool_scores[paper_id],
                -paper_id,
            ),
        )

        selected.append(best_id)
        remaining.discard(best_id)
        del max_similarity[best_id]
        absorb(best_id)

    return selected + tail
