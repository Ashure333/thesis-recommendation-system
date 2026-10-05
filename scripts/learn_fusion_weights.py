"""
Learn custom-pipeline fusion weights from a qrels file.

Two-stage grid search over the tfidf / sbert / metadata simplex, using
the offline evaluation harness to score each candidate, then persist
the winning allocation as JSON.

Examples (run from the repository root):

    .venv/bin/python scripts/learn_fusion_weights.py \
        --qrels test/fixtures/qrels_sample.json --top-k 5

    .venv/bin/python scripts/learn_fusion_weights.py \
        --qrels test/fixtures/qrels_sample.json --top-k 10 \
        --metric ndcg_at_k --coarse-step 0.1 --refine-step 0.05 \
        --out app/data/learned_weights.json

    # Dry run against a non-default DB, without writing anything:
    .venv/bin/python scripts/learn_fusion_weights.py \
        --qrels test/fixtures/qrels_sample.json --db /tmp/copy.db \
        --no-save

Exit codes:
    0  success
    2  missing / malformed qrels, missing DB, or invalid options
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import SessionLocal
from app.services.evaluation import runner
from app.services.evaluation.qrels import QrelsError, load_qrels
from app.services.recommendation.learned_weights import (
    COMPONENT_NAMES,
    default_path,
    optimize_weights,
    save_learned_weights,
)

DEFAULT_DB_PATH = REPO_ROOT / "app" / "data" / "academic_repository.db"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Learn custom-pipeline fusion weights from a qrels file "
            "and persist them."
        ),
    )

    parser.add_argument(
        "--qrels",
        required=True,
        help="Path to a qrels JSON file.",
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Ranking cut-off used by the optimized metric "
        "(default: 10).",
    )

    parser.add_argument(
        "--metric",
        choices=list(runner.METRIC_NAMES),
        default="ndcg_at_k",
        help="Metric to maximize (default: ndcg_at_k).",
    )

    parser.add_argument(
        "--coarse-step",
        type=float,
        default=0.1,
        help="Coarse simplex grid step (default: 0.1).",
    )

    parser.add_argument(
        "--refine-step",
        type=float,
        default=0.05,
        help="Refinement grid step around the coarse winner "
        "(default: 0.05).",
    )

    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help=(
            "Where to write the learned weights JSON "
            "(default: app/data/learned_weights.json)."
        ),
    )

    parser.add_argument(
        "--db",
        type=str,
        default=str(DEFAULT_DB_PATH),
        help=(
            "SQLite database path "
            f"(default: {DEFAULT_DB_PATH})."
        ),
    )

    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Print the learned weights without writing a file.",
    )

    parser.add_argument(
        "--max-queries",
        type=int,
        default=None,
        help="Only evaluate the first N qrels queries.",
    )

    parser.add_argument(
        "--components",
        type=str,
        default=None,
        help=(
            "Comma-separated subset of components to optimize "
            "(default: tfidf,sbert,metadata)."
        ),
    )

    return parser


def _open_session(db_path: Path):
    if db_path == DEFAULT_DB_PATH.resolve():
        return SessionLocal(), None

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    return sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )(), engine


def _format_weights(weights) -> str:
    return " ".join(
        f"{name}={weights[name]:.3f}" for name in COMPONENT_NAMES
    )


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    db_path = Path(args.db).expanduser().resolve()

    if not db_path.is_file():
        print(
            f"error: database not found: {db_path}",
            file=sys.stderr,
        )
        return 2

    try:
        qrels = load_qrels(args.qrels)
    except QrelsError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    components = None

    if args.components is not None:
        components = [
            part.strip()
            for part in args.components.split(",")
            if part.strip()
        ]

    db = None
    engine = None

    try:
        db, engine = _open_session(db_path)

        result = optimize_weights(
            db=db,
            qrels=qrels,
            top_k=args.top_k,
            metric=args.metric,
            coarse_step=args.coarse_step,
            refine_step=args.refine_step,
            max_queries=args.max_queries,
            components=components,
        )
    except (ValueError, QrelsError, TypeError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    finally:
        if db is not None:
            db.close()

        if engine is not None:
            engine.dispose()

    metric = result["metric"]

    print()
    print("Learned fusion weights")
    print(f"Qrels:       {args.qrels}")
    print(f"Queries:     {metric['queries']}")
    print(f"Metric:      {metric['name']} @ {metric['top_k']}")
    print(f"Components:  {', '.join(result['components'])}")
    print()
    print(
        f"Coarse best:  {_format_weights(result['coarse']['weights'])}"
        f"  value={result['coarse']['value']:.4f}"
    )
    print(
        f"Refined best: {_format_weights(result['refined']['weights'])}"
        f"  value={result['refined']['value']:.4f}"
    )
    print()
    print(
        f"Baseline (0.40/0.40/0.20): "
        f"{result['baseline']:.4f}"
    )
    print(f"Improvement: {result['improvement']:+.4f}")

    if not args.no_save:
        out_path = (
            Path(args.out).expanduser()
            if args.out
            else default_path()
        )

        try:
            written = save_learned_weights(result, out_path)
        except (ValueError, OSError) as exc:
            print(
                f"error: could not write learned weights: {exc}",
                file=sys.stderr,
            )
            return 2

        print(f"Saved learned weights to {written}")
    else:
        print("--no-save: nothing written")

    return 0


if __name__ == "__main__":
    sys.exit(main())
