"""
Learned recommendation fusion weights.

The custom recommendation pipeline combines three component scores --
TF-IDF, S-BERT, and metadata -- using weights that sum to 1. The
default allocation (0.40 / 0.40 / 0.20) is a manual choice; this module
instead *learns* the allocation from a qrels file with the offline
evaluation harness (``app.services.evaluation``).

``optimize_weights`` performs a two-stage grid search over the weight
simplex:

    1. Coarse stage: every weight tuple on a ``coarse_step`` grid whose
       component weights sum to 1 (66 candidates for the full 3-signal,
       0.1-step simplex).
    2. Refine stage: a finer ``refine_step`` grid restricted to the box
       within ``coarse_step`` of the coarse winner (in every
       component), keeping the sum-to-1 / non-negativity constraints.

Each candidate is scored by running every qrels query through the
custom pipeline (seed and text queries alike) and macro-averaging the
chosen IR metric at ``top_k``. The search is read-only and
deterministic: ties keep the first candidate evaluated.

``save_learned_weights`` / ``load_learned_weights`` persist the result
as JSON; ``default_path`` points at
``app/data/learned_weights.json`` relative to the repository root.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from itertools import product
from pathlib import Path

from app.services.evaluation import runner
from app.services.evaluation.qrels import Qrels, QrelsQuery

# The three recommendation components, in the canonical display order
# used by pipeline_config and the frontend dials.
COMPONENT_NAMES = ("tfidf", "sbert", "metadata")

# The provisional full-hybrid allocation the optimizer improves upon.
DEFAULT_HYBRID_WEIGHTS = {
    "tfidf": 0.40,
    "sbert": 0.40,
    "metadata": 0.20,
}

DEFAULT_LEARNED_WEIGHTS_FILENAME = "learned_weights.json"

# learned_weights.py lives at app/services/recommendation/, so four
# parents up is the repository root (same convention as storage.py).
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

DEFAULT_LEARNED_WEIGHTS_PATH = (
    BASE_DIR / "app" / "data" / DEFAULT_LEARNED_WEIGHTS_FILENAME
)

_SUM_TOLERANCE = 1e-5
_STEP_TOLERANCE = 1e-9

# Smallest weight increment written to the JSON result. Keeping the
# grid values at the same precision as build_custom_weights() makes
# saved weights reload cleanly.
_WEIGHT_DIGITS = 6

_REQUIRED_KEYS = (
    "weights",
    "metric",
    "metric_value",
    "baseline",
    "improvement",
    "learned_at",
    "query_count",
    "top_k",
    "components",
)


def default_path() -> Path:
    """
    The conventional location of the persisted learned weights:
    ``<repo root>/app/data/learned_weights.json``.
    """

    return DEFAULT_LEARNED_WEIGHTS_PATH


# ---------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------


def _validate_top_k(top_k) -> int:
    if (
        isinstance(top_k, bool)
        or not isinstance(top_k, int)
        or top_k < runner.MIN_TOP_K
        or top_k > runner.MAX_TOP_K
    ):
        raise ValueError(
            f"top_k must be between {runner.MIN_TOP_K} and "
            f"{runner.MAX_TOP_K}."
        )

    return top_k


def _validate_metric(metric) -> str:
    if metric not in runner.METRIC_NAMES:
        raise ValueError(
            f"Unsupported metric: {metric!r}. Choose from: "
            f"{', '.join(runner.METRIC_NAMES)}."
        )

    return metric


def _validate_step(value, name: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(float(value))
        or float(value) <= 0.0
        or float(value) > 1.0
    ):
        raise ValueError(f"{name} must be a number in (0, 1].")

    return float(value)


def _validate_components(components) -> list[str]:
    """
    Normalize a component selection to canonical order.

    ``None`` selects all three components. A subset (e.g. only
    ``("tfidf", "sbert")``) makes the optimizer search the matching
    two-signal simplex instead.
    """

    if components is None:
        selected = list(COMPONENT_NAMES)
    else:
        if isinstance(components, (str, bytes)) or not isinstance(
            components,
            Sequence,
        ):
            raise ValueError(
                "components must be a sequence of component names "
                f"chosen from: {', '.join(COMPONENT_NAMES)}."
            )

        selected = list(components)

    if not selected:
        raise ValueError(
            "components must contain at least one component."
        )

    unknown = [
        name for name in selected if name not in COMPONENT_NAMES
    ]

    if unknown:
        raise ValueError(
            f"Unsupported component(s): {', '.join(map(str, unknown))}. "
            f"Choose from: {', '.join(COMPONENT_NAMES)}."
        )

    requested = set(selected)

    return [name for name in COMPONENT_NAMES if name in requested]


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
        raise ValueError(
            "qrels contains no queries to evaluate."
        )

    return queries


def _limited_qrels(
    queries: Sequence[QrelsQuery],
    max_queries: int | None,
) -> Qrels:
    if max_queries is None:
        selected = list(queries)
    else:
        if (
            isinstance(max_queries, bool)
            or not isinstance(max_queries, int)
            or max_queries < 1
        ):
            raise ValueError(
                "max_queries must be a positive integer or None."
            )

        selected = list(queries)[:max_queries]

    return Qrels(queries=selected)


# ---------------------------------------------------------------------
# Grid construction
# ---------------------------------------------------------------------


def _compositions(total: int, parts: int):
    """
    Every way to split ``total`` integer units over ``parts`` slots,
    including zero slots, in a stable lexicographic (descending first
    slot) order.
    """

    if parts == 1:
        yield (total,)
        return

    for first in range(total, -1, -1):
        for rest in _compositions(total - first, parts - 1):
            yield (first,) + rest


def _coarse_points(
    components: Sequence[str],
    coarse_step: float,
) -> list[dict[str, float]]:
    units = int(round(1.0 / coarse_step))

    if units < 1 or abs(units * coarse_step - 1.0) > _STEP_TOLERANCE:
        raise ValueError(
            "coarse_step must divide 1 exactly (e.g. 0.1, 0.05, 0.2)."
        )

    points: list[dict[str, float]] = []

    for counts in _compositions(units, len(components)):
        point = {name: 0.0 for name in COMPONENT_NAMES}

        for index, name in enumerate(components):
            point[name] = round(counts[index] * coarse_step, _WEIGHT_DIGITS)

        points.append(point)

    return points


def _refine_points(
    best: Mapping[str, float],
    components: Sequence[str],
    coarse_step: float,
    refine_step: float,
) -> list[dict[str, float]]:
    """
    Candidates on a ``refine_step`` grid inside the
    +/- ``coarse_step`` box around the coarse winner, constrained to
    the weight simplex. The coarse winner itself is always kept.
    """

    ranges: list[list[float]] = []

    for name in components:
        low = max(0.0, best[name] - coarse_step)
        high = best[name] + coarse_step
        first = int(math.ceil(low / refine_step - _STEP_TOLERANCE))
        last = int(math.floor(high / refine_step + _STEP_TOLERANCE))

        ranges.append(
            [
                round(index * refine_step, _WEIGHT_DIGITS)
                for index in range(first, last + 1)
            ]
        )

    points: list[dict[str, float]] = [
        {name: float(best[name]) for name in COMPONENT_NAMES}
    ]

    for combo in product(*ranges):
        if abs(sum(combo) - 1.0) > _SUM_TOLERANCE:
            continue

        point = {name: 0.0 for name in COMPONENT_NAMES}

        for index, name in enumerate(components):
            point[name] = combo[index]

        if point != points[0] and point not in points:
            points.append(point)

    return points


def _baseline_weights(components: Sequence[str]) -> dict[str, float]:
    """
    The 0.40/0.40/0.20 default projected onto the selected components
    and renormalized (0.50/0.50/0.00 for tfidf+sbert, and so on).
    """

    raw = {
        name: DEFAULT_HYBRID_WEIGHTS[name]
        for name in components
    }
    total = sum(raw.values())

    point = {name: 0.0 for name in COMPONENT_NAMES}

    for name in components:
        point[name] = round(raw[name] / total, _WEIGHT_DIGITS)

    return point


# ---------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------


def _score_weights(
    *,
    db,
    qrels: Qrels,
    weights: Mapping[str, float],
    top_k: int,
    metric: str,
    run_search,
) -> float:
    """
    Macro-average the chosen metric for one weight candidate.

    Delegates to the offline evaluation runner so seed/text query
    handling, ranked-id extraction, and metric dispatch stay identical
    to the CLI evaluation harness.
    """

    results = runner.evaluate(
        db=db,
        qrels=qrels,
        pipelines=[runner.CUSTOM_PIPELINE],
        top_k=top_k,
        pipeline_weights={
            runner.CUSTOM_PIPELINE: dict(weights),
        },
        run_search=run_search,
    )

    return float(
        results["pipelines"][runner.CUSTOM_PIPELINE]["metrics"][metric]
    )


# ---------------------------------------------------------------------
# Optimization
# ---------------------------------------------------------------------


def optimize_weights(
    db,
    qrels: Qrels | QrelsQuery | Sequence[QrelsQuery],
    top_k: int = 10,
    metric: str = "ndcg_at_k",
    coarse_step: float = 0.1,
    refine_step: float = 0.05,
    run_search=None,
    max_queries: int | None = None,
    components: Sequence[str] | None = None,
) -> dict:
    """
    Search the fusion-weight simplex for the allocation that maximizes
    ``metric`` at ``top_k`` on ``qrels``.

    ``components`` selects which of tfidf / sbert / metadata take part
    (default: all three), so two-signal grids also work. The returned
    weights always include all three keys, with 0.0 for excluded
    components.

    ``run_search`` defaults to the real ``search_papers``; tests inject
    a deterministic fake with the same signature.

    The return value is JSON-serializable:

        {
          "weights": {"tfidf": float, "sbert": float, "metadata": float},
          "metric": {"name": str, "value": float, "top_k": int,
                      "queries": int},
          "baseline": float,
          "improvement": float,
          "history": [{"weights": {...}, "value": float}, ...],
          "components": [str, ...],
          "coarse": {"weights": {...}, "value": float},
          "refined": {"weights": {...}, "value": float},
        }

    ``coarse`` / ``refined`` expose each stage's winner so the CLI can
    report the two-stage progression; ``weights`` is the final winner
    (never worse than the baseline).
    """

    top_k = _validate_top_k(top_k)
    metric = _validate_metric(metric)
    coarse_step = _validate_step(coarse_step, "coarse_step")
    refine_step = _validate_step(refine_step, "refine_step")
    selected = _validate_components(components)
    evaluated_qrels = _limited_qrels(
        _coerce_queries(qrels),
        max_queries,
    )

    cache: dict[tuple, float] = {}
    history: list[dict] = []

    def evaluate(point: Mapping[str, float]) -> float:
        key = tuple(point[name] for name in COMPONENT_NAMES)

        if key not in cache:
            value = _score_weights(
                db=db,
                qrels=evaluated_qrels,
                weights=point,
                top_k=top_k,
                metric=metric,
                run_search=run_search,
            )
            cache[key] = value
            history.append(
                {
                    "weights": {
                        name: float(point[name])
                        for name in COMPONENT_NAMES
                    },
                    "value": value,
                }
            )

        return cache[key]

    # Stage 1: coarse grid over the simplex.
    coarse_points = _coarse_points(selected, coarse_step)
    coarse_best = None

    for point in coarse_points:
        value = evaluate(point)

        if coarse_best is None or value > coarse_best["value"]:
            coarse_best = {"weights": dict(point), "value": value}

    # Stage 2: refine the coarse winner within +/- coarse_step.
    refined_best = {
        "weights": dict(coarse_best["weights"]),
        "value": coarse_best["value"],
    }

    for point in _refine_points(
        coarse_best["weights"],
        selected,
        coarse_step,
        refine_step,
    ):
        value = evaluate(point)

        if value > refined_best["value"]:
            refined_best = {"weights": dict(point), "value": value}

    # Baseline: the provisional 0.40/0.40/0.20 hybrid, projected onto
    # the selected components. Guarantees the learned allocation is
    # never worse than the hand-set one.
    baseline_weights = _baseline_weights(selected)
    baseline_value = evaluate(baseline_weights)

    final = refined_best

    if baseline_value > final["value"]:
        final = {
            "weights": dict(baseline_weights),
            "value": baseline_value,
        }

    improvement = max(0.0, final["value"] - baseline_value)

    return {
        "weights": {
            name: float(final["weights"][name])
            for name in COMPONENT_NAMES
        },
        "metric": {
            "name": metric,
            "value": float(final["value"]),
            "top_k": top_k,
            "queries": len(evaluated_qrels),
        },
        "baseline": float(baseline_value),
        "improvement": float(improvement),
        "history": history,
        "components": selected,
        "coarse": {
            "weights": {
                name: float(coarse_best["weights"][name])
                for name in COMPONENT_NAMES
            },
            "value": float(coarse_best["value"]),
        },
        "refined": {
            "weights": {
                name: float(refined_best["weights"][name])
                for name in COMPONENT_NAMES
            },
            "value": float(refined_best["value"]),
        },
    }


# ---------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------


def _coerce_finite(value, field: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be numeric.") from exc

    if not math.isfinite(number):
        raise ValueError(f"{field} must be finite.")

    return number


def _validate_document(document) -> None:
    """
    Validate a (parsed) learned-weights document.

    Raises ValueError with the offending field when a required key is
    missing, a weight is negative or non-finite, the weights do not sum
    to 1, or the scalar fields are out of range.
    """

    if not isinstance(document, dict):
        raise ValueError(
            "Learned weights document must be a JSON object."
        )

    missing = [
        key for key in _REQUIRED_KEYS if key not in document
    ]

    if missing:
        raise ValueError(
            "Learned weights document is missing: "
            f"{', '.join(missing)}."
        )

    weights = document["weights"]

    if not isinstance(weights, Mapping):
        raise ValueError(
            "'weights' must be an object with tfidf, sbert, and "
            "metadata entries."
        )

    missing_components = [
        name for name in COMPONENT_NAMES if name not in weights
    ]

    if missing_components:
        raise ValueError(
            "'weights' is missing: "
            f"{', '.join(missing_components)}."
        )

    total = 0.0

    for name in COMPONENT_NAMES:
        value = _coerce_finite(weights[name], f"weights[{name!r}]")

        if value < 0.0:
            raise ValueError(
                f"weights[{name!r}] must be non-negative."
            )

        total += value

    if abs(total - 1.0) > _SUM_TOLERANCE:
        raise ValueError(
            "weights must sum to 1, got "
            f"{round(total, 6)}."
        )

    if document["metric"] not in runner.METRIC_NAMES:
        raise ValueError(
            f"Unsupported metric: {document['metric']!r}. Choose "
            f"from: {', '.join(runner.METRIC_NAMES)}."
        )

    metric_value = _coerce_finite(
        document["metric_value"],
        "metric_value",
    )

    if metric_value < 0.0:
        raise ValueError("metric_value must be non-negative.")

    baseline = _coerce_finite(document["baseline"], "baseline")

    if baseline < 0.0:
        raise ValueError("baseline must be non-negative.")

    improvement = _coerce_finite(
        document["improvement"],
        "improvement",
    )

    if improvement < 0.0:
        raise ValueError("improvement must be non-negative.")

    learned_at = document["learned_at"]

    if not isinstance(learned_at, str) or not learned_at.strip():
        raise ValueError(
            "learned_at must be a non-empty ISO timestamp string."
        )

    query_count = document["query_count"]

    if (
        isinstance(query_count, bool)
        or not isinstance(query_count, int)
        or query_count < 1
    ):
        raise ValueError(
            "query_count must be a positive integer."
        )

    top_k = document["top_k"]

    if (
        isinstance(top_k, bool)
        or not isinstance(top_k, int)
        or top_k < runner.MIN_TOP_K
        or top_k > runner.MAX_TOP_K
    ):
        raise ValueError(
            f"top_k must be between {runner.MIN_TOP_K} and "
            f"{runner.MAX_TOP_K}."
        )

    components = document["components"]

    if (
        isinstance(components, (str, bytes))
        or not isinstance(components, list)
        or not components
    ):
        raise ValueError(
            "components must be a non-empty list of component names."
        )

    unknown = [
        name for name in components if name not in COMPONENT_NAMES
    ]

    if unknown:
        raise ValueError(
            f"Unsupported component(s): {', '.join(map(str, unknown))}."
        )

    if len(set(components)) != len(components):
        raise ValueError("components must not contain duplicates.")


def _document_from_result(result) -> dict:
    if not isinstance(result, Mapping):
        raise ValueError(
            "save_learned_weights expects the dict returned by "
            "optimize_weights."
        )

    if any(key not in result for key in ("weights", "metric")):
        raise ValueError(
            "The learned-weights result is missing 'weights' or "
            "'metric'."
        )

    metric = result["metric"]

    if isinstance(metric, Mapping):
        try:
            metric_name = metric["name"]
            metric_value = metric["value"]
            top_k = metric["top_k"]
            query_count = metric["queries"]
        except KeyError as exc:
            raise ValueError(
                f"The metric result is missing {exc.args[0]!r}."
            ) from exc
    else:
        metric_name = metric
        metric_value = result.get("metric_value")
        top_k = result.get("top_k")
        query_count = result.get("query_count")

    fields = {
        "weights": result["weights"],
        "metric": metric_name,
        "metric_value": metric_value,
        "baseline": result.get("baseline"),
        "improvement": result.get("improvement"),
        "learned_at": (
            datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        ),
        "query_count": query_count,
        "top_k": top_k,
        "components": result.get("components"),
    }

    _validate_document(fields)

    return fields


def save_learned_weights(result, path) -> Path:
    """
    Persist an ``optimize_weights`` result as JSON.

    ``path`` is created (with parents) when missing. Returns the path
    written.
    """

    document = _document_from_result(result)
    path = Path(path)

    try:
        if path.parent and not path.parent.exists():
            path.parent.mkdir(parents=True, exist_ok=True)

        path.write_text(
            json.dumps(document, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise OSError(
            f"Could not write learned weights file {path}: {exc}"
        ) from exc

    return path


def load_learned_weights(path) -> dict:
    """
    Load and validate a learned-weights JSON file.

    Raises FileNotFoundError when the file is absent, ValueError when
    it is malformed or fails validation.
    """

    path = Path(path)

    if not path.is_file():
        raise FileNotFoundError(
            f"Learned weights file not found: {path}"
        )

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise OSError(
            f"Could not read learned weights file {path}: {exc}"
        ) from exc

    try:
        document = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Malformed JSON in {path}: {exc}"
        ) from exc

    _validate_document(document)

    return document
