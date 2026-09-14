"""
TF-IDF pipeline (Chapter 3, TF-IDF Pipeline).

Measures lexical similarity between a query/seed document and each
candidate paper, using the same prepared_text (Title + Abstract +
Keywords, normalized -- see app/services/text_preparation.py) that
feeds S-BERT. Built with scikit-learn's TfidfVectorizer, per the
Recommendation Layer spec ("uses scikit-learn for TF-IDF processing").

A TF-IDF vector's meaning depends entirely on the vocabulary and IDF
values it was fit on. So the SAME fitted vectorizer has to be reused --
never refit -- to vectorize a query or seed document; otherwise the
query vector and the stored candidate vectors would sit in different
vector spaces and cosine similarity between them would be meaningless.
That gives this module its two-phase shape:

    1. fit_and_store_tfidf_vectors(db) -- offline / index-build step.
       Fits ONE TfidfVectorizer on every valid-for-recommendation
       paper's prepared_text, persists that fitted vectorizer to disk,
       and stores each paper's resulting vector in Paper.tfidf_vector.
       Re-run this whenever the valid-paper corpus changes (a paper is
       added, edited, or newly becomes valid) -- e.g. from
       scripts/rebuild_recommendation_index.py -- NOT on every request.

    2. vectorize_query_or_seed() + score_candidates() -- online / request
       step. Loads the already-fitted vectorizer to transform an
       incoming keyword query, title query, or seed document into that
       same vector space, then compares it against the stored candidate
       vectors with cosine similarity.
"""

import json
import os

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.recommendation.similarity import cosine_similarity

# Resolved relative to this file's own folder, mirroring the pattern
# already used in app/services/storage.py -- so this finds app/data/
# regardless of where the calling script is run from.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))              # app/services/recommendation
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(_THIS_DIR)))  # project root
VECTORIZER_PATH = os.path.join(_PROJECT_ROOT, "app", "data", "tfidf_vectorizer.joblib")


def _get_valid_papers(db: Session) -> list[Paper]:
    """Only valid-for-recommendation papers (with prepared_text) belong in the TF-IDF corpus."""
    return (
        db.query(Paper)
        .filter(Paper.is_valid_for_recommendation.is_(True))
        .filter(Paper.prepared_text.isnot(None))
        .all()
    )


def fit_and_store_tfidf_vectors(db: Session) -> TfidfVectorizer:
    """
    Fits a fresh TfidfVectorizer on every valid paper's prepared_text,
    stores the resulting vector (JSON-encoded, per Paper.tfidf_vector's
    column comment) on each Paper row, and persists the fitted
    vectorizer to disk so query-time vectorization can reuse it.

    Returns the fitted vectorizer (mainly useful for tests / inspection).
    Raises ValueError if there is no valid corpus to fit on yet.
    """
    papers = _get_valid_papers(db)
    if not papers:
        raise ValueError("No valid-for-recommendation papers to fit the TF-IDF vectorizer on.")

    corpus = [p.prepared_text for p in papers]

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(corpus)  # sparse (n_papers, vocab_size)

    for paper, row in zip(papers, tfidf_matrix):
        dense_vector = row.toarray()[0].tolist()
        paper.tfidf_vector = json.dumps(dense_vector)

    db.commit()

    os.makedirs(os.path.dirname(VECTORIZER_PATH), exist_ok=True)
    joblib.dump(vectorizer, VECTORIZER_PATH)

    return vectorizer


def _load_vectorizer() -> TfidfVectorizer:
    if not os.path.exists(VECTORIZER_PATH):
        raise FileNotFoundError(
            "No fitted TF-IDF vectorizer found at "
            f"{VECTORIZER_PATH}. Run fit_and_store_tfidf_vectors(db) "
            "at least once (e.g. via scripts/rebuild_recommendation_index.py) "
            "before vectorizing a query or seed document."
        )
    return joblib.load(VECTORIZER_PATH)


def vectorize_query_or_seed(prepared_text: str) -> list[float]:
    """
    Transforms a keyword query's, title query's, or seed document's
    prepared text into a TF-IDF vector, using the vectorizer already
    fit on the candidate corpus. Never fits a new one here -- that would
    put the query in a different vector space than the stored candidates.
    """
    vectorizer = _load_vectorizer()
    vector = vectorizer.transform([prepared_text])
    return vector.toarray()[0].tolist()


def score_candidates(query_vector: list[float], candidates: list[Paper]) -> dict[int, float]:
    """
    Returns {paper_id: raw_cosine_similarity} for every candidate,
    comparing the query/seed vector against each paper's stored
    tfidf_vector.

    Raw (un-normalized) scores on purpose: TF-IDF-alone results can be
    ranked directly on these, but the TF-IDF+S-BERT, TF-IDF+Metadata,
    and full-hybrid configurations need min_max_normalize() applied one
    level up (see app/services/recommendation/similarity.py) before
    combining this with the other components' scores.
    """
    scores = {}
    for paper in candidates:
        if not paper.tfidf_vector:
            continue
        candidate_vector = json.loads(paper.tfidf_vector)
        scores[paper.id] = cosine_similarity(query_vector, candidate_vector)
    return scores