"""
Real-time execution trace for the recommendation search pipelines.

Runs the exact same search the API would run (search_service.search_papers)
with a recorder attached, so every step of the computation is captured
with its actual intermediate values:

    - request inputs and the configured weights
    - the prepared query/seed text
    - the candidate set
    - each active component's per-candidate scores
      (TF-IDF / S-BERT cosine similarities, metadata signal scores)
    - min-max normalization bounds and normalized scores
    - the weighted combination S(d) for every candidate
    - the final ranking with tie-break details

The frontend displays these events next to the mathematical
pseudocode, so a mathematician can watch the real numbers flow
through each formula.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.schemas import SearchResultOut
from app.services.recommendation.search_service import (
    search_papers as run_search,
)

PipelineName = Literal[
    "tfidf",
    "sbert",
    "tfidf_sbert",
    "tfidf_metadata",
    "sbert_metadata",
    "tfidf_sbert_metadata",
    "custom",
]


class RecommendationTraceRequest(BaseModel):
    pipeline: PipelineName = "tfidf"
    query: str | None = None
    seed_paper_id: int | None = None
    top_k: int = Field(default=10, ge=1, le=50)
    # Dial allocation for pipeline="custom" (0..100 percentages).
    w_tfidf: float | None = Field(default=None, ge=0, le=100)
    w_sbert: float | None = Field(default=None, ge=0, le=100)
    w_metadata: float | None = Field(default=None, ge=0, le=100)


class TraceEvent(BaseModel):
    event: str
    message: str
    data: dict = Field(default_factory=dict)


class RecommendationTraceResponse(BaseModel):
    events: list[TraceEvent]
    results: list[SearchResultOut]


def _round_scores(
    scores: dict[int, float],
    digits: int = 6,
) -> dict[int, float]:
    """Round per-paper score dicts so the trace payload stays tidy."""
    return {
        paper_id: round(float(score), digits)
        for paper_id, score in scores.items()
    }


class RecommendationTrace:
    """
    Simple recorder passed into search_papers().

    search_papers() calls trace.record(...) at each step; this class
    only collects and exposes the events, it does not influence the
    computation.
    """

    def __init__(self) -> None:
        self._events: list[TraceEvent] = []

    def record(
        self,
        event: str,
        message: str,
        data: dict | None = None,
    ) -> None:
        self._events.append(
            TraceEvent(
                event=event,
                message=message,
                data=data or {},
            )
        )

    def to_dict(self) -> dict:
        return {
            "events": [
                event.model_dump()
                for event in self._events
            ]
        }


def run_traced_search(
    *,
    db: Session,
    query: str | None,
    seed_paper_id: int | None,
    pipeline: str,
    top_k: int,
    custom_weights: dict[str, float] | None = None,
) -> RecommendationTraceResponse:
    """
    Run the real recommendation search with a trace recorder attached.

    Returns the ordered trace events plus the same ranked results the
    regular /api/recommendations endpoint would return.
    """

    trace = RecommendationTrace()

    results = run_search(
        db=db,
        query=query,
        seed_paper_id=seed_paper_id,
        pipeline=pipeline,
        top_k=top_k,
        trace=trace,
        custom_weights=custom_weights,
    )

    return RecommendationTraceResponse(
        events=trace._events,
        results=results,
    )