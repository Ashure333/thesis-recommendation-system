from app.database import SessionLocal
from app.models.models import Paper
from app.services.classification import classify_paper


def main():
    db = SessionLocal()

    try:
        papers = db.query(Paper).all()

        classified = 0
        unclassified = 0

        for paper in papers:
            category = classify_paper(paper)

            # Update the database.
            paper.subject_category = category

            if category:
                classified += 1

                print(
                    f"[CLASSIFIED] "
                    f"{paper.id}: {paper.title} "
                    f"-> {category}"
                )

            else:
                unclassified += 1

                print(
                    f"[UNCLASSIFIED] "
                    f"{paper.id}: {paper.title}"
                )

        db.commit()

        print("\n===================================")
        print("Classification complete.")
        print(f"Classified:   {classified}")
        print(f"Unclassified: {unclassified}")
        print("===================================")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()