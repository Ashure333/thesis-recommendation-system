"""
Rebuilds prepared_text, TF-IDF vectors, S-BERT vectors, and the
precomputed NumPy matrices for every paper in the database.

Run this after seeding, bulk-uploading, or manually completing papers --
any time the valid-for-recommendation corpus changes -- so the stored
recommendation vectors stay in sync with the current dataset:

    python -m scripts.rebuild_recommendation_index

Safe to re-run any time; it always recomputes from the current state of
the papers table rather than incrementally patching old vectors. This
is also the script to run once, right after scripts/init_script.py or
scripts/bulk_upload.py, before trying any TF-IDF/S-BERT recommendation
request for the first time -- vectorize_query_or_seed() in
tfidf_pipeline.py will raise until a fitted vectorizer exists on disk.

When no paper is valid for recommendation, the script writes nothing
and exits successfully (there is nothing to encode yet).
"""

from app.database import SessionLocal
from app.models.models import Paper
from app.services.text_preparation import refresh_prepared_text
from app.services.recommendation import vector_index
from app.services.recommendation.tfidf_pipeline import fit_and_store_tfidf_vectors
from app.services.recommendation.sbert_pipeline import (
    MODEL_NAME,
    encode_and_store_sbert_vectors,
)


def main():
    db = SessionLocal()
    try:
        papers = db.query(Paper).all()
        for paper in papers:
            refresh_prepared_text(paper)
        db.commit()
        print(f"prepared_text refreshed for {len(papers)} paper(s).")

        valid_count = (
            db.query(Paper)
            .filter(Paper.is_valid_for_recommendation.is_(True))
            .filter(Paper.prepared_text.isnot(None))
            .count()
        )

        if valid_count == 0:
            print(
                "No valid-for-recommendation papers; "
                "skipping vector rebuild."
            )
            return

        fit_and_store_tfidf_vectors(db)
        print("TF-IDF vectors fitted and stored.")

        if vector_index.build_tfidf_index(db):
            print("TF-IDF matrix built and saved.")
        else:
            print("TF-IDF matrix skipped (no usable stored vectors).")

        encode_and_store_sbert_vectors(db)
        print("S-BERT vectors encoded and stored.")

        if vector_index.build_sbert_index(db, model=MODEL_NAME):
            print("S-BERT matrix built and saved.")
        else:
            print("S-BERT matrix skipped (no usable stored vectors).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
