"""
S-BERT pipeline (Chapter 3, S-BERT Pipeline).

Measures semantic similarity between a query/seed document and each
candidate paper, using the same prepared_text that feeds TF-IDF. Built
with sentence-transformers, per the Recommendation Layer spec ("uses
... sentence-transformers for S-BERT processing").

Unlike TF-IDF, S-BERT needs no fitting step -- the pretrained encoder
maps any text straight into its fixed-length embedding space, so a
query/seed document and a candidate paper are always comparable without
being encoded together. That gives this module a similar but simpler
two-phase shape than the TF-IDF pipeline:

    1. encode_and_store_sbert_vectors(db) -- offline / index-build step.
       Encodes every valid paper's prepared_text once and stores the
       embedding (JSON-encoded, per Paper.sbert_vector's column comment)
       on each Paper row. Re-run whenever a paper is added or its
       prepared_text changes -- e.g. from
       scripts/rebuild_recommendation_index.py.

    2. embed_query_or_seed() + score_candidates() -- online / request
       step. Encodes an incoming query/seed document with the same
       model, then compares it against the stored candidate vectors
       with cosine similarity.

Model choice: Chapter 3 holds S-BERT fixed as one representation method
for the whole experiment rather than comparing sentence-embedding models
against each other. "all-MiniLM-L6-v2" is used below as a reasonable
general-purpose default -- if your finalized methodology names a
specific pretrained model, set MODEL_NAME to that instead, and keep it
fixed for the entire experiment once chosen (changing it mid-study would
invalidate any vectors already stored).
"""

import json

from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.recommendation.similarity import cosine_similarity

MODEL_NAME = "all-MiniLM-L6-v2"

# Loaded lazily and cached at module level -- loading the model from disk
# takes a noticeable moment, so every function below reuses one instance
# per process instead of reloading it on every call.
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def _get_valid_papers(db: Session) -> list[Paper]:
    """Only valid-for-recommendation papers (with prepared_text) get embedded."""
    return (
        db.query(Paper)
        .filter(Paper.is_valid_for_recommendation.is_(True))
        .filter(Paper.prepared_text.isnot(None))
        .all()
    )


def encode_and_store_sbert_vectors(db: Session) -> None:
    """
    Encodes every valid paper's prepared_text into an S-BERT embedding
    and stores it (JSON-encoded) on the Paper row.

    Encodes the whole valid-paper set in one batched call to
    model.encode() rather than one paper at a time -- batching is where
    sentence-transformers gets its speed. Raises ValueError if there is
    no valid corpus to encode yet.
    """
    papers = _get_valid_papers(db)
    if not papers:
        raise ValueError("No valid-for-recommendation papers to encode.")

    model = _get_model()
    texts = [p.prepared_text for p in papers]
    embeddings = model.encode(texts, show_progress_bar=False)

    for paper, embedding in zip(papers, embeddings):
        paper.sbert_vector = json.dumps(embedding.tolist())

    db.commit()


def embed_query_or_seed(prepared_text: str) -> list[float]:
    """
    Encodes a keyword query's, title query's, or seed document's
    prepared text into the same S-BERT embedding space as the stored
    candidate vectors, ready for cosine-similarity comparison.
    """
    model = _get_model()
    embedding = model.encode([prepared_text], show_progress_bar=False)[0]
    return embedding.tolist()


def score_candidates(query_vector: list[float], candidates: list[Paper]) -> dict[int, float]:
    """
    Returns {paper_id: raw_cosine_similarity} for every candidate,
    comparing the query/seed embedding against each paper's stored
    sbert_vector.

    Raw (un-normalized) scores, same as tfidf_pipeline.score_candidates
    -- apply min_max_normalize() one level up before combining this with
    TF-IDF or Metadata in any of the four combined configurations.
    """
    scores = {}
    for paper in candidates:
        if not paper.sbert_vector:
            continue
        candidate_vector = json.loads(paper.sbert_vector)
        scores[paper.id] = cosine_similarity(query_vector, candidate_vector)
    return scores