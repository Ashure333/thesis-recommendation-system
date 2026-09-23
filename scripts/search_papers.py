import argparse

from app.database import get_session
from app.services.recommendation.search_service import (
    search_papers,
)
from app.services.recommendation.pipeline_config import (
    PIPELINE_NAMES,
)

from app.services.recommendation.search_service import (
    search_papers,
)


def main():
    parser = argparse.ArgumentParser(
        description="Search papers using a recommendation pipeline."
    )

    parser.add_argument(
        "--pipeline",
        required=True,
        choices=PIPELINE_NAMES,
        help="Recommendation pipeline to use.",
    )

    parser.add_argument(
        "--query",
        type=str,
        default=None,
        help="Free-text query.",
    )

    parser.add_argument(
        "--seed-paper-id",
        type=int,
        default=None,
        help="Use an existing paper as the seed document.",
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=10,
        help="Number of results to return.",
    )

    args = parser.parse_args()

    if not args.query and args.seed_paper_id is None:
        parser.error(
            "Provide either --query or --seed-paper-id."
        )

    if args.query and args.seed_paper_id is not None:
        parser.error(
            "Use either --query or --seed-paper-id, not both."
        )

    db = next(get_session())

    try:
        results = search_papers(
            db=db,
            query=args.query,
            seed_paper_id=args.seed_paper_id,
            pipeline=args.pipeline,
            top_k=args.top_k,
        )

        if not results:
            print("No recommendation results found.")
            return

        print()
        print(
            f"Pipeline: {args.pipeline}"
        )
        print(
            f"Results: {len(results)}"
        )
        print()

        for index, result in enumerate(results, start=1):
            paper = result["paper"]
            score = result["score"]

            print(
                f"{index}. "
                f"{paper.title}"
            )
            print(
                f"   ID: {paper.id}"
            )
            print(
                f"   Score: {score:.6f}"
            )
            print(
                f"   Year: "
                f"{paper.publication_year}"
            )
            print()

    finally:
        db.close()


if __name__ == "__main__":
    main()