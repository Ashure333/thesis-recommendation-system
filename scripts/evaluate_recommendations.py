"""
Offline evaluation CLI for the recommendation pipelines.

Example (run from the repository root):

    .venv/bin/python scripts/evaluate_recommendations.py \
        --qrels test/fixtures/qrels_sample.json \
        --pipeline tfidf_sbert --top-k 5

Compare all six presets and dump the full per-query results:

    .venv/bin/python scripts/evaluate_recommendations.py \
        --qrels test/fixtures/qrels_sample.json \
        --compare --top-k 10 --json /tmp/eval.json

Evaluate a custom weight allocation on top of the presets:

    .venv/bin/python scripts/evaluate_recommendations.py \
        --qrels test/fixtures/qrels_sample.json --compare \
        --weight-tfidf 0.5 --weight-sbert 0.3 --weight-metadata 0.2
"""

from __future__ import annotations

import argparse
import json
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
from app.services.recommendation.pipeline_config import (
    PIPELINE_NAMES,
    build_custom_weights,
)

DEFAULT_DB_PATH = REPO_ROOT / "app" / "data" / "academic_repository.db"

DISPLAY_METRICS = (
    ("precision_at_k", "P"),
    ("recall_at_k", "R"),
    ("mrr_at_k", "MRR"),
    ("map_at_k", "MAP"),
    ("ndcg_at_k", "NDCG"),
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate recommendation pipelines against a qrels file."
        ),
    )

    parser.add_argument(
        "--qrels",
        required=True,
        help="Path to a qrels JSON file.",
    )

    parser.add_argument(
        "--pipeline",
        action="append",
        choices=list(PIPELINE_NAMES) + [runner.CUSTOM_PIPELINE],
        default=None,
        help=(
            "Pipeline to evaluate (repeatable). Use 'custom' together "
            "with the --weight-* options."
        ),
    )

    parser.add_argument(
        "--compare",
        action="store_true",
        help="Evaluate all six preset pipelines.",
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Ranking cut-off for every metric (default: 10).",
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
        "--json",
        dest="json_out",
        type=str,
        default=None,
        help="Write the full JSON results to this path.",
    )

    parser.add_argument(
        "--weight-tfidf",
        type=float,
        default=None,
        help="Custom pipeline TF-IDF weight.",
    )

    parser.add_argument(
        "--weight-sbert",
        type=float,
        default=None,
        help="Custom pipeline S-BERT weight.",
    )

    parser.add_argument(
        "--weight-metadata",
        type=float,
        default=None,
        help="Custom pipeline metadata weight.",
    )

    return parser


def _selected_pipelines(
    args: argparse.Namespace,
    parser: argparse.ArgumentParser,
    has_custom_weights: bool,
) -> list[str]:
    names: list[str] = []

    if args.compare:
        names.extend(PIPELINE_NAMES)

    for name in args.pipeline or []:
        if name not in names:
            names.append(name)

    if has_custom_weights and runner.CUSTOM_PIPELINE not in names:
        names.append(runner.CUSTOM_PIPELINE)

    if not names:
        parser.error(
            "no pipelines selected: pass --pipeline and/or --compare."
        )

    if runner.CUSTOM_PIPELINE in names and not has_custom_weights:
        parser.error(
            "the 'custom' pipeline requires at least one --weight-* "
            "option."
        )

    return names


def _build_custom_weights(
    args: argparse.Namespace,
    parser: argparse.ArgumentParser,
):
    values = (
        args.weight_tfidf,
        args.weight_sbert,
        args.weight_metadata,
    )

    if all(value is None for value in values):
        return None

    try:
        return build_custom_weights(
            values[0] or 0.0,
            values[1] or 0.0,
            values[2] or 0.0,
        )
    except ValueError as exc:
        parser.error(str(exc))


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


def _print_table(
    results: dict,
    pipelines: list[str],
    top_k: int,
) -> None:
    headers = ["Pipeline"]

    for _, label in DISPLAY_METRICS:
        headers.append(f"{label}@{top_k}")

    widths = [
        max(24 if index == 0 else 9, len(header) + 2)
        for index, header in enumerate(headers)
    ]

    print()
    print(
        "".join(
            header.ljust(width)
            for header, width in zip(headers, widths)
        )
    )
    print("-" * sum(widths))

    for name in pipelines:
        payload = results["pipelines"][name]
        values = [
            f"{payload['metrics'][metric_name]:.4f}"
            for metric_name, _ in DISPLAY_METRICS
        ]

        print(
            name.ljust(widths[0])
            + "".join(
                value.ljust(width)
                for value, width in zip(values, widths[1:])
            )
        )

    print()


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    custom_weights = _build_custom_weights(args, parser)
    pipelines = _selected_pipelines(
        args,
        parser,
        has_custom_weights=custom_weights is not None,
    )

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

    db = None
    engine = None

    try:
        db, engine = _open_session(db_path)

        pipeline_weights = None

        if custom_weights is not None:
            pipeline_weights = {
                runner.CUSTOM_PIPELINE: custom_weights,
            }

        results = runner.evaluate(
            db=db,
            qrels=qrels,
            pipelines=pipelines,
            top_k=args.top_k,
            pipeline_weights=pipeline_weights,
        )
    except (ValueError, QrelsError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    finally:
        if db is not None:
            db.close()

        if engine is not None:
            engine.dispose()

    print()
    print("Offline recommendation evaluation")
    print(f"Qrels:   {args.qrels}")
    print(f"Queries: {results['query_count']}")
    print(f"Top-k:   {results['top_k']}")

    _print_table(results, pipelines, results["top_k"])

    if args.json_out:
        output_path = Path(args.json_out).expanduser()

        try:
            if (
                output_path.parent
                and not output_path.parent.exists()
            ):
                output_path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

            output_path.write_text(
                json.dumps(
                    results,
                    indent=2,
                    ensure_ascii=False,
                )
                + "\n",
                encoding="utf-8",
            )
        except OSError as exc:
            print(
                f"error: could not write JSON results: {exc}",
                file=sys.stderr,
            )
            return 2

        print(f"Full results written to {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
