"""
Command-line test for TF-IDF and S-BERT search.

Examples:

    python -m scripts.search_papers --pipeline tfidf --query "machine learning"

    python -m scripts.search_papers --pipeline sbert --query "neural networks"

    python -m scripts.search_papers --pipeline tfidf --seed-id 3

    python -m scripts.search_papers --pipeline sbert --seed-id 3 --top-k 5
"""

import argparse

from app.database import SessionLocal
from app.services.recommendation.search_service import search_papers


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search academic papers using TF-IDF or S-BERT."
    )

    parser.add_argument(
        "--pipeline",
        choices=["tfidf", "sbert"],
        required=True,
        help="Recommendation pipeline to use.",
    )

    parser.add_argument(
        "--query",
        type=str,
        help="Keyword, title, or topic query.",
    )

    parser.add_argument(
        "--seed-id",
        type=int,
        help="Existing paper ID to use as a recommendation seed.",
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Maximum number of results to display.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    if not args.query and args.seed_id is None:
        raise SystemExit(
            "Error: provide either --query or --seed-id."
        )

    if args.query and args.seed_id is not None:
        raise SystemExit(
            "Error: use either --query or --seed-id, not both."
        )

    if args.top_k <= 0:
        raise SystemExit(
            "Error: --top-k must be greater than 0."
        )

    db = SessionLocal()

    try:
        results = search_papers(
            db=db,
            query=args.query,
            seed_paper_id=args.seed_id,
            pipeline=args.pipeline,
            top_k=args.top_k,
        )

        # Remove results with no similarity to the query or seed paper.
        results = [
            result
            for result in results
            if result.score > 0
        ]

        print()
        print("=" * 80)
        print(f"Pipeline: {args.pipeline.upper()}")
        print(f"Results: {len(results)}")
        print("=" * 80)

        if not results:
            print()
            print("No relevant papers found for this query.")
            return

        for index, result in enumerate(results, start=1):
            paper = result.paper

            print()
            print(f"{index}. {paper.title}")
            print(f"   Paper ID: {paper.id}")
            print(f"   Score: {result.score:.6f}")
            print(
                f"   Publication Year: "
                f"{paper.publication_year or 'N/A'}"
            )
            print(
                f"   Author: "
                f"{paper.author or 'N/A'}"
            )
            print(
                f"   Subject Category: "
                f"{paper.subject_category or 'N/A'}"
            )

    finally:
        db.close()


if __name__ == "__main__":
    main()