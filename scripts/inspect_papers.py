
from app.database import SessionLocal
from app.models.models import Paper


# IDs we want to inspect more closely.
PAPER_IDS = [
    20,
    22,
    28,
    32,
    46,
    49,
    53,
]

def main():
    db = SessionLocal()

    try:
        papers = (
            db.query(Paper)
            .filter(Paper.id.in_(PAPER_IDS))
            .order_by(Paper.id)
            .all()
        )

        for paper in papers:
            print("\n" + "=" * 80)
            print(f"ID: {paper.id}")
            print(f"TITLE: {paper.title}")
            print(f"CURRENT CATEGORY: {paper.subject_category}")
            print(f"AUTHOR: {paper.author}")
            print(f"YEAR: {paper.publication_year}")
            print(f"KEYWORDS: {paper.keywords}")
            print("\nABSTRACT:")
            print(paper.abstract)

        print("\n" + "=" * 80)
        print("Inspection complete.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
