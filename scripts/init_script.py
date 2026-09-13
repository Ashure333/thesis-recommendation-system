"""
Run this once to create academic_repository.db (under app/data/) with
all tables:

    python scripts/init_script.py

It also inserts one sample paper and prints the validation result,
just to confirm everything is wired up correctly. Safe to re-run --
it won't duplicate tables, and the sample paper is only inserted
if the papers table is currently empty.
"""

from app.database import init_db, SessionLocal
from app.models.models import Paper
from app.services.validation import validate_paper


def seed_sample_paper(db):
    if db.query(Paper).count() > 0:
        print(f"papers table already has {db.query(Paper).count()} row(s) -- skipping seed.")
        return

    sample = Paper(
        title="A Survey of Content-Based Recommendation Techniques",
        author="J. Dela Cruz",
        abstract="This paper surveys content-based filtering methods, comparing TF-IDF and transformer-based embeddings for document similarity.",
        keywords="recommendation systems, TF-IDF, S-BERT, content-based filtering",
        publication_year=2022,
        doi=None,
        subject_category="Computer Science",
        document_type="Journal Article",
        citation_count=14,
    )
    validate_paper(sample)
    db.add(sample)
    db.commit()
    db.refresh(sample)
    print(f"Inserted sample paper id={sample.id}, valid={sample.is_valid_for_recommendation}, missing={sample.missing_fields}")


def main():
    init_db()
    print("Database initialized: academic_repository.db")

    db = SessionLocal()
    try:
        seed_sample_paper(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
