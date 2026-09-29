"""
Rebuilds prepared_text, TF-IDF vectors, and S-BERT vectors for every
paper in the database.

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
"""

from app.database import SessionLocal
from app.models.models import Paper
from app.services.text_preparation import refresh_prepared_text
from app.services.recommendation.tfidf_pipeline import fit_and_store_tfidf_vectors
from app.services.recommendation.sbert_pipeline import encode_and_store_sbert_vectors


def main():
    db = SessionLocal()
    try:
        papers = db.query(Paper).all()
        for paper in papers:
            refresh_prepared_text(paper)
        db.commit()
        print(f"prepared_text refreshed for {len(papers)} paper(s).")

        fit_and_store_tfidf_vectors(db)
        print("TF-IDF vectors fitted and stored.")

        encode_and_store_sbert_vectors(db)
        print("S-BERT vectors encoded and stored.")
    finally:
        db.close()


if __name__ == "__main__":
    main()