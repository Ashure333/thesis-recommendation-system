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
import os
import threading

from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from app.models.models import Paper
from app.services.recommendation import vector_index
from app.services.recommendation.similarity import cosine_similarity

MODEL_NAME = "all-MiniLM-L6-v2"

# Loaded lazily and cached at module level -- loading the model from disk
# takes a noticeable moment, so every function below reuses one instance
# per process instead of reloading it on every call.
_model: SentenceTransformer | None = None

# _MODEL_LOCK guards the lazy load. Without it, N concurrent requests that
# arrive before the first load finishes all see _model is None and each
# loads its own copy (six "Loading weights" lines in the log), which is
# slow, memory-hungry, and -- with torch on the Apple GPU -- capable of
# taking the whole process down.
_MODEL_LOCK = threading.Lock()

# _ENCODE_LOCK serializes inference. torch's MPS backend is not safe for
# concurrent use from several threads: a stress test with parallel
# S-BERT queries crashed the server with SIGSEGV inside
# at::native::mps::MetalShaderLibrary::exec_unary_kernel. CPU inference
# would be re-entrant too, so the lock is held regardless of device --
# encode() of this corpus is milliseconds, so the queue costs little.
_ENCODE_LOCK = threading.Lock()


def _model_cached_locally() -> bool:
    """
    True when the model snapshot is already in the local HF cache.

    Used to load with local_files_only=True: it skips the Hub round-trip
    entirely (HEAD requests + retry ladder) instead of burning ~25s on
    network retries before falling back to the cache anyway.
    """
    try:
        from huggingface_hub import constants as hf_constants

        repo_dir = os.path.join(
            hf_constants.HF_HUB_CACHE,
            f"models--sentence-transformers--{MODEL_NAME.replace('/', '--')}",
        )
        snapshots = os.path.join(repo_dir, "snapshots")
        if not os.path.isdir(snapshots):
            return False
        return any(
            os.path.isfile(os.path.join(root, "config.json"))
            for root, _dirs, files in os.walk(snapshots)
            if "config.json" in files
        )
    except Exception:
        return False


def warm_up_model() -> None:
    """Pre-load the model off the request path (startup hook / scripts)."""
    _get_model()


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _MODEL_LOCK:
            if _model is None:
                _model = SentenceTransformer(
                    MODEL_NAME,
                    local_files_only=_model_cached_locally(),
                )
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
    with _ENCODE_LOCK:
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
    with _ENCODE_LOCK:
        embedding = model.encode([prepared_text], show_progress_bar=False)[0]
    return embedding.tolist()


def embed_texts(prepared_texts: list[str]) -> list[list[float]]:
    """
    Encodes many texts in ONE batched model pass (the web battle
    vectorizes live hits this way — dozens of one-by-one encode
    calls would otherwise dominate the request time).
    """
    if not prepared_texts:
        return []

    model = _get_model()
    with _ENCODE_LOCK:
        embeddings = model.encode(
            prepared_texts,
            show_progress_bar=False,
            batch_size=32,
        )
    return [embedding.tolist() for embedding in embeddings]


def score_candidates(query_vector: list[float], candidates: list[Paper]) -> dict[int, float]:
    """
    Returns {paper_id: raw_cosine_similarity} for every candidate,
    comparing the query/seed embedding against each paper's stored
    sbert_vector.

    Raw (un-normalized) scores, same as tfidf_pipeline.score_candidates
    -- apply min_max_normalize() one level up before combining this with
    TF-IDF or Metadata in any of the four combined configurations.

    Fast path (P1-B): when the precomputed NumPy matrix built by the
    rebuild covers every candidate id that has a stored vector, the
    cosines are one normalized matrix-vector product. Any gap -- no
    index, stale index, dimension drift -- makes vector_index return
    None and falls through to the unchanged legacy loop below, which
    returns the identical scores.
    """
    vectorized_ids = [
        int(paper.id)
        for paper in candidates
        if paper.sbert_vector
    ]

    fast_scores = vector_index.score_candidates(
        kind=vector_index.SBERT,
        query_vector=query_vector,
        paper_ids=vectorized_ids,
    )

    if fast_scores is not None:
        return fast_scores

    scores = {}
    for paper in candidates:
        if not paper.sbert_vector:
            continue
        candidate_vector = json.loads(paper.sbert_vector)
        scores[paper.id] = cosine_similarity(query_vector, candidate_vector)
    return scores