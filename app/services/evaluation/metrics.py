"""
Information-retrieval metrics for offline recommendation evaluation.

Every function in this module is a pure calculation: it receives an
already-ordered list of recommended ids and the query's relevance
judgments, and returns one float. There is no database access, no
network access, and no logging here.

Conventions chosen once and applied everywhere (including the
degenerate cases):

    - ``k`` must be a positive integer; anything else raises
      ``ValueError`` (``bool`` is rejected even though it is an int).
    - An empty ranked list scores 0.0 on every metric.
    - A query with no relevant documents scores 0.0 on every metric.
      Recall has no denominator in that case, so the zero convention
      is explicit rather than a ``ZeroDivisionError``.
    - Duplicate ids in the ranked list are counted once, at their first
      position; later repeats are ignored.
    - ``k`` larger than the ranked list keeps ``k`` as the precision
      denominator (missing results count as non-relevant), while recall
      divides by the number of judged relevant documents.
    - MAP's denominator is the total number of judged relevant
      documents, not ``min(k, R)``, matching the worked example
      ``(1/2 + 2/4) / 2``.
    - NDCG uses exponential gain ``2**grade - 1`` and a
      ``log2(1 + position)`` discount (positions are 1-based). The
      ideal ranking is the judged grades sorted descending and
      truncated to ``k``; when IDCG is 0 the result is 0.0.
    - Binary relevance is the special case of graded relevance with
      grade 1. Precision, recall, hit rate, MRR, and MAP take a plain
      collection of relevant ids; DCG/NDCG take a grade mapping.
"""

from __future__ import annotations

from collections.abc import Hashable, Iterable, Mapping, Sequence
from math import log2


def _validate_k(k: int) -> int:
    """
    ``k`` must be a positive integer.

    ``bool`` is rejected explicitly so ``True`` cannot silently act as
    ``k = 1``.
    """

    if isinstance(k, bool) or not isinstance(k, int) or k < 1:
        raise ValueError(
            "k must be a positive integer."
        )

    return k


def _dedupe_top_k(
    ranked_ids: Sequence[Hashable] | None,
    k: int,
) -> list[Hashable]:
    """
    Truncate the ranked list to ``k`` ids, keeping only the first
    occurrence of each id.

    Duplicate recommendations cannot help a user twice, so the first
    position wins and every later repeat is discarded.
    """

    seen: set[Hashable] = set()
    top: list[Hashable] = []

    for paper_id in ranked_ids or ():
        if paper_id in seen:
            continue

        seen.add(paper_id)
        top.append(paper_id)

        if len(top) >= k:
            break

    return top


def _relevant_set(
    relevant_ids: Iterable[Hashable] | None,
) -> set[Hashable]:
    if relevant_ids is None:
        return set()

    return set(relevant_ids)


def _hits_at_k(
    ranked_ids: Sequence[Hashable] | None,
    relevant: set[Hashable],
    k: int,
) -> tuple[list[Hashable], int]:
    top = _dedupe_top_k(ranked_ids, k)
    hits = sum(1 for paper_id in top if paper_id in relevant)

    return top, hits


def precision_at_k(
    ranked_ids: Sequence[Hashable] | None,
    relevant_ids: Iterable[Hashable] | None,
    k: int,
) -> float:
    """
    P@k = (# relevant in top k) / k.

    The denominator is ``k`` even when the system returned fewer than
    ``k`` results, so a short list is treated as missing non-relevant
    results rather than being rewarded.
    """

    k = _validate_k(k)
    relevant = _relevant_set(relevant_ids)

    if not relevant:
        return 0.0

    _, hits = _hits_at_k(ranked_ids, relevant, k)

    return hits / k


def recall_at_k(
    ranked_ids: Sequence[Hashable] | None,
    relevant_ids: Iterable[Hashable] | None,
    k: int,
) -> float:
    """
    R@k = (# relevant in top k) / (# judged relevant documents).

    Returns 0.0 when the query has no judged relevant documents.
    """

    k = _validate_k(k)
    relevant = _relevant_set(relevant_ids)

    if not relevant:
        return 0.0

    _, hits = _hits_at_k(ranked_ids, relevant, k)

    return hits / len(relevant)


def hit_rate_at_k(
    ranked_ids: Sequence[Hashable] | None,
    relevant_ids: Iterable[Hashable] | None,
    k: int,
) -> float:
    """
    Hit@k = 1.0 when at least one relevant document is in the top k,
    otherwise 0.0. Returns 0.0 when the query has no relevant
    documents.
    """

    k = _validate_k(k)
    relevant = _relevant_set(relevant_ids)

    if not relevant:
        return 0.0

    _, hits = _hits_at_k(ranked_ids, relevant, k)

    return 1.0 if hits > 0 else 0.0


def mrr_at_k(
    ranked_ids: Sequence[Hashable] | None,
    relevant_ids: Iterable[Hashable] | None,
    k: int,
) -> float:
    """
    Reciprocal rank of the first relevant document within the top k,
    or 0.0 when no relevant document appears.
    """

    k = _validate_k(k)
    relevant = _relevant_set(relevant_ids)

    if not relevant:
        return 0.0

    for position, paper_id in enumerate(
        _dedupe_top_k(ranked_ids, k),
        start=1,
    ):
        if paper_id in relevant:
            return 1.0 / position

    return 0.0


def map_at_k(
    ranked_ids: Sequence[Hashable] | None,
    relevant_ids: Iterable[Hashable] | None,
    k: int,
) -> float:
    """
    Mean average precision at k, averaged over the judged relevant
    documents:

        AP@k = (1 / R) * sum over relevant positions i <= k of P@i

    where ``R`` is the total number of judged relevant documents. With
    ``ranked = [a, b, c, d]`` and ``relevant = {b, d}``, MAP is
    ``((1/2) + (2/4)) / 2 = 0.5``.
    """

    k = _validate_k(k)
    relevant = _relevant_set(relevant_ids)

    if not relevant:
        return 0.0

    hits = 0
    precision_sum = 0.0

    for position, paper_id in enumerate(
        _dedupe_top_k(ranked_ids, k),
        start=1,
    ):
        if paper_id not in relevant:
            continue

        hits += 1
        precision_sum += hits / position

    if hits == 0:
        return 0.0

    return precision_sum / len(relevant)


def _normalized_grades(
    graded_relevance: Mapping[Hashable, float],
) -> dict[Hashable, float]:
    """
    Coerce judged grades to non-negative floats so the gain formula
    never receives a string or a negative value.
    """

    grades: dict[Hashable, float] = {}

    for paper_id, value in graded_relevance.items():
        try:
            grade = float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Relevance grade for {paper_id!r} is not numeric: "
                f"{value!r}."
            ) from exc

        if grade < 0:
            raise ValueError(
                f"Relevance grade for {paper_id!r} is negative: "
                f"{grade}."
            )

        grades[paper_id] = grade

    return grades


def _gain(grade: float) -> float:
    return 2.0 ** grade - 1.0


def dcg_at_k(
    ranked_ids: Sequence[Hashable] | None,
    graded_relevance: Mapping[Hashable, float] | None,
    k: int,
) -> float:
    """
    Discounted cumulative gain at k with exponential gain:

        DCG@k = sum_i (2**grade_i - 1) / log2(1 + i)

    where ``i`` is the 1-based position in the ranked list and a
    document with no judgment has grade 0.
    """

    k = _validate_k(k)

    if not graded_relevance:
        return 0.0

    grades = _normalized_grades(graded_relevance)
    total = 0.0

    for position, paper_id in enumerate(
        _dedupe_top_k(ranked_ids, k),
        start=1,
    ):
        grade = grades.get(paper_id, 0.0)

        if grade > 0:
            total += _gain(grade) / log2(1.0 + position)

    return total


def ndcg_at_k(
    ranked_ids: Sequence[Hashable] | None,
    graded_relevance: Mapping[Hashable, float] | None,
    k: int,
) -> float:
    """
    Normalized discounted cumulative gain at k:

        NDCG@k = DCG@k / IDCG@k

    IDCG@k is the DCG of the ideal ranking: the judged grades sorted
    descending and truncated to k. Returns 0.0 when IDCG is 0 (no
    judged non-zero grade).
    """

    k = _validate_k(k)

    if not graded_relevance:
        return 0.0

    grades = _normalized_grades(graded_relevance)

    ideal_grades = sorted(
        (grade for grade in grades.values() if grade > 0),
        reverse=True,
    )[:k]

    idcg = sum(
        _gain(grade) / log2(1.0 + position)
        for position, grade in enumerate(ideal_grades, start=1)
    )

    if idcg <= 0:
        return 0.0

    return dcg_at_k(ranked_ids, grades, k) / idcg
