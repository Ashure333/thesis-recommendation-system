"""
Shared similarity + score-normalization helpers for the Recommendation
Layer.

Both the TF-IDF and S-BERT pipelines represent a paper as a vector and
compare it to a query/seed-document vector using cosine similarity
(Chapter 3, TF-IDF Pipeline / S-BERT Pipeline). Keeping that one formula
here guarantees both pipelines -- and every combined configuration built
on top of them (TF-IDF+S-BERT, TF-IDF+Metadata, etc.) -- use the exact
same computation instead of two subtly different reimplementations.
"""

import numpy as np


def cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    """
    cosine(A, B) = (A . B) / (|A| |B|)

    Returns 0.0 if either vector has zero magnitude (e.g. a candidate
    whose prepared_text shares no vocabulary with the query, so its
    TF-IDF vector is all zeros) instead of dividing by zero.
    """
    a = np.asarray(vector_a, dtype=float)
    b = np.asarray(vector_b, dtype=float)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return float(np.dot(a, b) / (norm_a * norm_b))


def min_max_normalize(scores: dict[int, float]) -> dict[int, float]:
    """
    Rescales a {paper_id: raw_score} mapping to the 0-to-1 range:

        s'(d) = (s(d) - min(s)) / (max(s) - min(s))

    Chapter 3 (Score Normalization) has TF-IDF and S-BERT raw scores
    pass through this before entering any combined configuration; the
    Metadata score is already 0-to-1 by construction and skips this step.

    If every score is identical (max == min), every candidate gets 1.0
    rather than a divide-by-zero -- they're equally similar, so none
    should be penalized relative to the others.
    """
    if not scores:
        return {}

    values = list(scores.values())
    lo, hi = min(values), max(values)

    if hi == lo:
        return {paper_id: 1.0 for paper_id in scores}

    return {paper_id: (s - lo) / (hi - lo) for paper_id, s in scores.items()}