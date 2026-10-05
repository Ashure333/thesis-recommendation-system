"""
Offline evaluation runner for the recommendation pipelines.

``evaluate`` runs every selected pipeline against every qrels query,
computes the standard IR metrics for each query, and macro-averages
them per pipeline. The search callable is injectable so tests can
substitute deterministic results for the real recommendation engine.

The runner itself never writes to the database. ``search_papers``
commits its read transaction (existing behavior), which is a no-op for
data; no rows are inserted, updated, or deleted here.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any

from app.services.evaluation import metrics
from app.services.evaluation.qrels import Qrels, QrelsQuery
from app.services.recommendation.pipeline_config import PIPELINE_NAMES
from app.services.recommendation.search_service import search_papers

MIN_TOP_K = 1
MAX_TOP_K = 100

CUSTOM_PIPELINE = "custom"

METRIC_NAMES = (
    "precision_at_k",
    "recall_at_k",
    "hit_rate_at_k",
    "mrr_at_k",
    "map_at_k",
    "ndcg_at_k",
)

SearchCallable = Callable[..., list[dict]]


def _validate_top_k(top_k: int) -> int:
    if (
        isinstance(top_k, bool)
        or not isinstance(top_k, int)
        or top_k < MIN_TOP_K
        or top_k > MAX_TOP_K
    ):
        raise ValueError(
            f"top_k must be between {MIN_TOP_K} and {MAX_TOP_K}."
        )

    return top_k


def _coerce_queries(
    qrels: Qrels | QrelsQuery | Sequence[QrelsQuery],
) -> list[QrelsQuery]:
    if isinstance(qrels, Qrels):
        queries = list(qrels.queries)
    elif isinstance(qrels, QrelsQuery):
        queries = [qrels]
    elif isinstance(qrels, (list, tuple)):
        queries = list(qrels)
    else:
        raise TypeError(
            "qrels must be a Qrels object, a QrelsQuery, or a "
            "sequence of QrelsQuery."
        )

    for query in queries:
        if not isinstance(query, QrelsQuery):
            raise TypeError(
                "qrels entries must be QrelsQuery objects."
            )

    if not queries:
        raise ValueError("qrels contains no queries to evaluate.")

    return queries


def _coerce_pipelines(
    pipelines: str | Sequence[str] | None,
) -> list[str]:
    if pipelines is None:
        names = list(PIPELINE_NAMES)
    elif isinstance(pipelines, str):
        names = [pipelines]
    else:
        names = list(pipelines)

    if not names:
        raise ValueError("At least one pipeline is required.")

    deduped: list[str] = []

    for name in names:
        if name not in PIPELINE_NAMES and name != CUSTOM_PIPELINE:
            raise ValueError(
                f"Unsupported recommendation pipeline: {name}"
            )

        if name not in deduped:
            deduped.append(name)

    return deduped


def _normalize_weights(name: str, weights: Mapping) -> dict[str, float]:
    if not isinstance(weights, Mapping):
        raise ValueError(
            f"pipeline_weights[{name!r}] must be a mapping with "
            "'tfidf', 'sbert', and 'metadata' weights."
        )

    missing = [
        key
        for key in ("tfidf", "sbert", "metadata")
        if key not in weights
    ]

    if missing:
        raise ValueError(
            f"pipeline_weights[{name!r}] is missing: "
            f"{', '.join(missing)}."
        )

    try:
        values = {
            key: float(weights[key])
            for key in ("tfidf", "sbert", "metadata")
        }
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"pipeline_weights[{name!r}] must be numeric."
        ) from exc

    if any(value < 0 for value in values.values()):
        raise ValueError(
            f"pipeline_weights[{name!r}] must be non-negative."
        )

    if sum(values.values()) <= 0:
        raise ValueError(
            f"pipeline_weights[{name!r}] must contain at least one "
            "positive weight."
        )

    return values


def _ranked_ids(results) -> list[Any]:
    ranked: list[Any] = []

    for item in results or ():
        paper = None

        if isinstance(item, Mapping):
            paper = item.get("paper")
        else:
            paper = getattr(item, "paper", None)

        paper_id = getattr(paper, "id", None)

        if paper_id is None:
            raise ValueError(
                "run_search returned a result without a paper id."
            )

        ranked.append(paper_id)

    return ranked


def _metrics_for_query(
    ranked_ids: Sequence,
    query: QrelsQuery,
    top_k: int,
) -> dict[str, float]:
    relevant_ids = set(query.relevance.keys())
    graded_relevance = dict(query.relevance)

    return {
        "precision_at_k": metrics.precision_at_k(
            ranked_ids,
            relevant_ids,
            top_k,
        ),
        "recall_at_k": metrics.recall_at_k(
            ranked_ids,
            relevant_ids,
            top_k,
        ),
        "hit_rate_at_k": metrics.hit_rate_at_k(
            ranked_ids,
            relevant_ids,
            top_k,
        ),
        "mrr_at_k": metrics.mrr_at_k(
            ranked_ids,
            relevant_ids,
            top_k,
        ),
        "map_at_k": metrics.map_at_k(
            ranked_ids,
            relevant_ids,
            top_k,
        ),
        "ndcg_at_k": metrics.ndcg_at_k(
            ranked_ids,
            graded_relevance,
            top_k,
        ),
    }


def _macro_average(
    per_query: Sequence[dict],
) -> dict[str, float]:
    if not per_query:
        return {name: 0.0 for name in METRIC_NAMES}

    return {
        name: (
            sum(
                query_result["metrics"][name]
                for query_result in per_query
            )
            / len(per_query)
        )
        for name in METRIC_NAMES
    }


def evaluate(
    db,
    qrels: Qrels | QrelsQuery | Sequence[QrelsQuery],
    pipelines: str | Sequence[str] | None = None,
    top_k: int = 10,
    pipeline_weights: Mapping[str, Mapping] | None = None,
    run_search: SearchCallable | None = None,
) -> dict:
    """
    Evaluate one or more recommendation pipelines against qrels.

    ``pipelines`` defaults to all six presets; ``"custom"`` may be
    included and then requires an entry in ``pipeline_weights``
    (tfidf / sbert / metadata, normally built with
    ``pipeline_config.build_custom_weights``).

    ``run_search`` must accept the same keyword arguments as
    ``search_papers`` (db, query, seed_paper_id, pipeline, top_k,
    custom_weights) and return its result shape: a list of dicts with
    ``paper`` and ``score``. It defaults to the real engine.

    Returns a JSON-serializable structure::

        {
          "top_k": int,
          "query_count": int,
          "pipelines": {
            name: {"metrics": {...}, "per_query": [...]},
          },
        }
    """

    top_k = _validate_top_k(top_k)
    query_list = _coerce_queries(qrels)
    pipeline_list = _coerce_pipelines(pipelines)
    weight_overrides = dict(pipeline_weights or {})
    search = run_search or search_papers
    normalized_overrides: dict[str, dict[str, float]] = {}

    for name, weights in weight_overrides.items():
        if name != CUSTOM_PIPELINE:
            raise ValueError(
                "pipeline_weights may only be provided for the "
                "'custom' pipeline."
            )

        if name not in pipeline_list:
            raise ValueError(
                f"pipeline_weights contains {name!r}, which is not "
                "being evaluated."
            )

        normalized_overrides[name] = _normalize_weights(name, weights)

    if (
        CUSTOM_PIPELINE in pipeline_list
        and CUSTOM_PIPELINE not in normalized_overrides
    ):
        raise ValueError(
            "The 'custom' pipeline requires weights "
            "(tfidf, sbert, metadata)."
        )

    results: dict[str, dict] = {}

    for name in pipeline_list:
        custom_weights = normalized_overrides.get(name)
        per_query: list[dict] = []

        for query in query_list:
            if query.kind == "seed":
                raw_results = search(
                    db=db,
                    query=None,
                    seed_paper_id=query.seed_paper_id,
                    pipeline=name,
                    top_k=top_k,
                    custom_weights=custom_weights,
                )
            else:
                raw_results = search(
                    db=db,
                    query=query.query,
                    seed_paper_id=None,
                    pipeline=name,
                    top_k=top_k,
                    custom_weights=custom_weights,
                )

            ranked = _ranked_ids(raw_results)

            per_query.append(
                {
                    "label": query.label,
                    "kind": query.kind,
                    "seed_paper_id": query.seed_paper_id,
                    "query": query.query,
                    "num_relevant": len(query.relevance),
                    "num_results": len(ranked),
                    "ranked_ids": ranked,
                    "metrics": _metrics_for_query(
                        ranked,
                        query,
                        top_k,
                    ),
                }
            )

        results[name] = {
            "metrics": _macro_average(per_query),
            "per_query": per_query,
        }

    return {
        "top_k": top_k,
        "query_count": len(query_list),
        "pipelines": results,
    }
