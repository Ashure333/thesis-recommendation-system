"""
Metadata recommendation component.

The Metadata component uses four signals:

    - Title
    - Abstract
    - Keywords
    - Publication Year

Title, Abstract, and Keywords are compared using cosine similarity.
Publication Year is compared using temporal distance.

Each signal has a fixed weight of 25 percent:

    Metadata Score =
        0.25 * Title
      + 0.25 * Abstract
      + 0.25 * Keywords
      + 0.25 * Publication Year

Each individual signal is already bounded between 0 and 1.

If a metadata field is unavailable, its contribution is treated as 0.
The fixed 25 percent weights are preserved so that a paper with only
one available metadata field cannot receive an artificially inflated
score simply because the other fields are missing.
"""

from __future__ import annotations

import re

from sklearn.feature_extraction.text import TfidfVectorizer

from app.models.models import Paper
from app.services.recommendation.similarity import cosine_similarity


_WHITESPACE_RE = re.compile(r"\s+")
_PUNCTUATION_RE = re.compile(r"[^\w\s]", re.UNICODE)


def _normalize_text(value: str | None) -> str:
    """
    Apply basic normalization before metadata text comparison.
    """

    if not value or not value.strip():
        return ""

    value = value.lower()
    value = _PUNCTUATION_RE.sub(" ", value)
    value = _WHITESPACE_RE.sub(" ", value)

    return value.strip()


def _text_similarity(
    query_value: str | None,
    candidate_value: str | None,
) -> float:
    """
    Calculate cosine similarity between two metadata text fields.

    A missing or unusable field produces a similarity of 0.
    """

    query_text = _normalize_text(query_value)
    candidate_text = _normalize_text(candidate_value)

    if not query_text or not candidate_text:
        return 0.0

    vectorizer = TfidfVectorizer()

    try:
        matrix = vectorizer.fit_transform(
            [query_text, candidate_text]
        )
    except ValueError:
        return 0.0

    query_vector = matrix[0].toarray()[0].tolist()
    candidate_vector = matrix[1].toarray()[0].tolist()

    score = cosine_similarity(
        query_vector,
        candidate_vector,
    )

    # Protect the component from floating-point values outside
    # the expected 0-1 similarity range.
    return max(0.0, min(1.0, float(score)))


def _publication_year_similarity(
    query_year: int | None,
    candidate_year: int | None,
) -> float:
    """
    Calculate temporal similarity between publication years.

    When both years are available:

        1 / (1 + |query_year - candidate_year|)

    A missing year produces a score of 0.
    """

    if query_year is None or candidate_year is None:
        return 0.0

    difference = abs(
        int(query_year) - int(candidate_year)
    )

    return 1.0 / (1.0 + difference)


def _get_query_metadata(
    query: str | None,
    seed_paper: Paper | None,
) -> dict[str, str | int | None]:
    """
    Resolve the metadata available for the current recommendation
    request.

    Seed-paper recommendations use the seed paper's metadata.

    Text queries only provide the query itself as the title/text
    signal. Abstract, keywords, and publication year are unavailable.
    """

    if seed_paper is not None:
        return {
            "title": seed_paper.title,
            "abstract": seed_paper.abstract,
            "keywords": seed_paper.keywords,
            "publication_year": seed_paper.publication_year,
        }

    return {
        "title": query,
        "abstract": None,
        "keywords": None,
        "publication_year": None,
    }


def score_candidates(
    *,
    query: str | None,
    seed_paper: Paper | None,
    candidates: list[Paper],
    trace: object | None = None,
) -> dict[int, float]:
    """
    Calculate the Metadata recommendation score for every candidate.

    Each signal has a fixed 25 percent contribution:

        Title       = 0.25
        Abstract    = 0.25
        Keywords    = 0.25
        Year        = 0.25

    Missing signals contribute 0 rather than being removed from the
    calculation.

    When a trace recorder is provided, the per-signal scores for every
    candidate are recorded so the frontend can show the four terms of
    the formula with their real values.

    Returns:

        {
            paper_id: metadata_score
        }

    The resulting Metadata score remains in the 0-1 range.
    """

    if not candidates:
        return {}

    query_metadata = _get_query_metadata(
        query=query,
        seed_paper=seed_paper,
    )

    scores: dict[int, float] = {}
    signal_scores: dict[int, dict] = {}

    for paper in candidates:
        title_score = _text_similarity(
            query_metadata["title"],
            paper.title,
        )

        abstract_score = _text_similarity(
            query_metadata["abstract"],
            paper.abstract,
        )

        keyword_score = _text_similarity(
            query_metadata["keywords"],
            paper.keywords,
        )

        year_score = _publication_year_similarity(
            query_metadata["publication_year"],
            paper.publication_year,
        )

        metadata_score = (
            0.25 * title_score
            + 0.25 * abstract_score
            + 0.25 * keyword_score
            + 0.25 * year_score
        )

        metadata_score = max(
            0.0,
            min(1.0, metadata_score),
        )

        scores[paper.id] = metadata_score

        signal_scores[paper.id] = {
            "title": round(title_score, 6),
            "abstract": round(abstract_score, 6),
            "keywords": round(keyword_score, 6),
            "year": round(year_score, 6),
            "total": round(metadata_score, 6),
        }

    if trace is not None:
        trace.record(
            "component.metadata.signals",
            "Metadata component: the four per-signal similarities "
            "behind each candidate's score "
            "(0.25 * each; missing fields contribute 0).",
            {
                "query_metadata": {
                    "title": query_metadata["title"],
                    "abstract": query_metadata["abstract"],
                    "keywords": query_metadata["keywords"],
                    "publication_year": (
                        query_metadata["publication_year"]
                    ),
                },
                "signals": signal_scores,
            },
        )

    return scores