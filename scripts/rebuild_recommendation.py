"""
Master recommendation rebuild script.

Rebuilds all data required by the recommendation system:

    1. Classifies papers into Subject/Category.
    2. Validates recommendation metadata.
    3. Rebuilds prepared_text.
    4. Fits and stores the TF-IDF vectorizer.
    5. Stores TF-IDF vectors for valid papers.
    6. Generates S-BERT vectors for valid papers.

Run from the project root:

    python -m scripts.rebuild_recommendation

This script is safe to run repeatedly. It rebuilds the recommendation
representations from the current contents of the papers table.

Run this after:
    - bulk uploading papers
    - adding new papers
    - manually completing paper metadata
    - changing recommendation text preparation
    - changing TF-IDF settings
    - changing the S-BERT model
    - changing the classification rules
"""

from app.database import SessionLocal
from app.models.models import Paper

from app.services.classification import classify_paper
from app.services.validation import validate_paper
from app.services.text_preparation import refresh_prepared_text

from app.services.recommendation.tfidf_pipeline import (
    fit_and_store_tfidf_vectors,
)

from app.services.recommendation.sbert_pipeline import (
    encode_and_store_sbert_vectors,
)


def classify_all_papers(db) -> tuple[int, int]:
    """
    Reclassify every paper using the current keyword classifier.

    Returns:
        (classified_count, unclassified_count)

    Note:
        This follows the existing classify_existing_papers.py behavior,
        where classification is rebuilt for every paper.

        TO RUN: python -m scripts.rebuild_recommendation
    """

    papers = db.query(Paper).all()

    classified = 0
    unclassified = 0

    print()
    print("=" * 60)
    print("STEP 1 — PAPER CLASSIFICATION")
    print("=" * 60)

    for paper in papers:
        category = classify_paper(paper)

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

    print()
    print(f"Total papers:   {len(papers)}")
    print(f"Classified:     {classified}")
    print(f"Unclassified:   {unclassified}")

    return classified, unclassified


def validate_and_prepare_all_papers(db) -> tuple[int, int]:
    """
    Validate metadata and rebuild prepared_text for every paper.

    A paper is eligible for recommendation only when it has:

        - title
        - abstract
        - keywords
        - publication_year

    Subject/Category does not determine recommendation validity.

    Returns:
        (valid_count, invalid_count)
    """

    papers = db.query(Paper).all()

    valid = 0
    invalid = 0

    print()
    print("=" * 60)
    print("STEP 2 — VALIDATION + TEXT PREPARATION")
    print("=" * 60)

    for paper in papers:
        # Validate recommendation metadata.
        validate_paper(paper)

        # Rebuild normalized Title + Abstract + Keywords.
        refresh_prepared_text(paper)

        if paper.is_valid_for_recommendation:
            valid += 1

            print(
                f"[VALID]   "
                f"{paper.id}: {paper.title}"
            )
        else:
            invalid += 1

            print(
                f"[INVALID] "
                f"{paper.id}: {paper.title} "
                f"(missing: {paper.missing_fields})"
            )

    db.commit()

    print()
    print(f"Total papers:   {len(papers)}")
    print(f"Valid:          {valid}")
    print(f"Invalid:        {invalid}")

    return valid, invalid


def rebuild_tfidf(db) -> None:
    """
    Refit the TF-IDF vectorizer on the current valid-paper corpus.

    This rebuilds:

        - TF-IDF vocabulary
        - IDF values
        - TF-IDF vectors
        - stored tfidf_vector values
        - tfidf_vectorizer.joblib
    """

    print()
    print("=" * 60)
    print("STEP 3 — TF-IDF REBUILD")
    print("=" * 60)

    vectorizer = fit_and_store_tfidf_vectors(db)

    vocabulary = vectorizer.get_feature_names_out()

    print()
    print("TF-IDF rebuild complete.")
    print(f"Vocabulary size: {len(vocabulary)}")
    print("TF-IDF vectors stored in the database.")
    print("Fitted vectorizer saved to app/data/tfidf_vectorizer.joblib")


def rebuild_sbert(db) -> None:
    """
    Generate S-BERT embeddings for every valid paper.
    """

    print()
    print("=" * 60)
    print("STEP 4 — S-BERT REBUILD")
    print("=" * 60)

    encode_and_store_sbert_vectors(db)

    print()
    print("S-BERT vectors generated and stored in the database.")


def print_final_summary(db) -> None:
    """
    Print a final summary of the recommendation-ready corpus.
    """

    papers = db.query(Paper).all()

    valid = [
        paper
        for paper in papers
        if paper.is_valid_for_recommendation
    ]

    invalid = [
        paper
        for paper in papers
        if not paper.is_valid_for_recommendation
    ]

    tfidf_ready = [
        paper
        for paper in valid
        if paper.tfidf_vector
    ]

    sbert_ready = [
        paper
        for paper in valid
        if paper.sbert_vector
    ]

    prepared_ready = [
        paper
        for paper in valid
        if paper.prepared_text
    ]

    print()
    print("=" * 60)
    print("RECOMMENDATION REBUILD COMPLETE")
    print("=" * 60)

    print()
    print(f"Total papers:          {len(papers)}")
    print(f"Valid papers:          {len(valid)}")
    print(f"Invalid papers:        {len(invalid)}")

    print()
    print("Recommendation data:")
    print(f"Prepared text:         {len(prepared_ready)}")
    print(f"TF-IDF vectors:        {len(tfidf_ready)}")
    print(f"S-BERT vectors:        {len(sbert_ready)}")

    print()

    if invalid:
        print("Papers still excluded from recommendation:")

        for paper in invalid:
            print(
                f"  - ID {paper.id}: "
                f"{paper.title} "
                f"[missing: {paper.missing_fields}]"
            )

        print()

    print("Recommendation system is ready.")
    print("=" * 60)


def main() -> None:
    """
    Run the complete recommendation rebuild.
    """

    print()
    print("=" * 60)
    print("PAPER REPOSITORY RECOMMENDATION REBUILD")
    print("=" * 60)

    db = SessionLocal()

    try:
        # ---------------------------------------------------------
        # STEP 1
        # Classify all papers.
        # ---------------------------------------------------------

        classify_all_papers(db)

        # ---------------------------------------------------------
        # STEP 2
        # Validate metadata and rebuild prepared_text.
        # ---------------------------------------------------------

        valid_count, invalid_count = validate_and_prepare_all_papers(db)

        # ---------------------------------------------------------
        # Stop if there is no recommendation-ready corpus.
        # ---------------------------------------------------------

        if valid_count == 0:
            print()
            print("=" * 60)
            print("REBUILD STOPPED")
            print("=" * 60)
            print()
            print(
                "There are no valid papers available for "
                "recommendation."
            )
            print(
                "TF-IDF and S-BERT vectors cannot be built "
                "until at least one paper has:"
            )
            print()
            print("  - Title")
            print("  - Abstract")
            print("  - Keywords")
            print("  - Publication Year")
            print()

            return

        # ---------------------------------------------------------
        # STEP 3
        # Refit TF-IDF and rebuild stored vectors.
        # ---------------------------------------------------------

        rebuild_tfidf(db)

        # ---------------------------------------------------------
        # STEP 4
        # Rebuild S-BERT vectors.
        # ---------------------------------------------------------

        rebuild_sbert(db)

        # ---------------------------------------------------------
        # FINAL SUMMARY
        # ---------------------------------------------------------

        print_final_summary(db)

    except Exception as exc:
        db.rollback()

        print()
        print("=" * 60)
        print("RECOMMENDATION REBUILD FAILED")
        print("=" * 60)
        print()
        print(f"Error: {exc}")
        print()

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()