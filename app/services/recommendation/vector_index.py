"""
Precomputed NumPy vector matrices for the recommendation pipelines.

P1-B: TF-IDF and S-BERT vectors keep their per-paper JSON storage in
Paper.tfidf_vector / Paper.sbert_vector (the API-visible fallback), but
the rebuild also materializes them into two dense matrices on disk:

    app/data/recommendation_tfidf.npz
    app/data/recommendation_sbert.npz

together with one shared metadata file:

    app/data/recommendation_vectors.meta.json

Score-time then compares the query vector against the appropriate matrix
with a single NumPy operation (rows normalized once at load) instead of
json.loads() + a Python cosine loop per candidate.

Correctness comes from the id check: the fast path is used only when the
loaded matrix covers every candidate id the legacy path would score. A
missing id (stale / never-built index), a shape inconsistency, or a
content-hash mismatch makes the lookup return None, and the pipelines
fall back to their unchanged legacy per-row code -- so both paths return
the same paper ids and the same cosines (to floating-point tolerance).

The npz arrays are:

    matrix    float32, shape (n, dim)
    paper_ids int64, shape (n,), sorted ascending

The meta file records built_at / counts / dims per kind (plus the S-BERT
model name) and content hashes, so a torn or half-rebuilt pair of files
is rejected instead of being scored from.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import threading
from datetime import datetime, timezone

import numpy as np
from sqlalchemy.orm import Session

from app.models.models import Paper

# Bump when the on-disk layout changes; a mismatch rejects the index.
INDEX_VERSION = 1

TFIDF = "tfidf"
SBERT = "sbert"

# Resolved relative to this file's own folder, mirroring the pattern in
# tfidf_pipeline.py -- so this finds app/data/ regardless of where the
# calling script is run from. These module attributes are read through
# _matrix_path() at call time so tests can patch them.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))                          # app/services/recommendation
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(_THIS_DIR)))   # project root
DATA_DIR = os.path.join(_PROJECT_ROOT, "app", "data")

TFIDF_MATRIX_PATH = os.path.join(DATA_DIR, "recommendation_tfidf.npz")
SBERT_MATRIX_PATH = os.path.join(DATA_DIR, "recommendation_sbert.npz")
META_PATH = os.path.join(DATA_DIR, "recommendation_vectors.meta.json")

# In-process caches keyed by (absolute path, mtime_ns, size), so repeated
# queries reuse the loaded arrays instead of re-reading the npz. The
# index cache key also carries the meta file's (mtime_ns, size): a
# rebuild runs in a separate process, and a query that lands between the
# npz write and the meta write must not get a negative result pinned to
# a key neither file will ever change again. The cached value can be
# None when validation failed (negative caching: a broken index must not
# re-read on every query).
_INDEX_CACHE: dict[tuple, "VectorIndex | None"] = {}
_META_CACHE: dict[tuple[str, int, int], dict | None] = {}
_CACHE_LOCK = threading.Lock()


class VectorIndex:
    """
    A validated, query-ready snapshot of one recommendation matrix.

    Rows are normalized once on construction; unit_matrix therefore holds
    b / |b| for every stored vector and lets scoring be a plain
    matrix-vector product. Zero-norm rows stay all-zero, which yields a
    cosine of 0.0 -- exactly what similarity.cosine_similarity() returns.
    """

    __slots__ = ("matrix", "paper_ids", "dim", "unit_matrix", "_row_by_id")

    def __init__(self, matrix: np.ndarray, paper_ids: np.ndarray):
        self.matrix = matrix
        self.paper_ids = paper_ids
        self.dim = int(matrix.shape[1])

        self._row_by_id = {
            int(paper_id): position
            for position, paper_id in enumerate(paper_ids)
        }

        dense = matrix.astype(np.float64)
        norms = np.linalg.norm(dense, axis=1)
        safe_norms = np.where(norms > 0.0, norms, 1.0)
        self.unit_matrix = dense / safe_norms[:, None]

    def rows_for(self, paper_ids: list[int]) -> np.ndarray | None:
        """
        Return unit rows in the requested order, or None when any id is
        absent (the matrix does not match the current candidate id set).
        """
        positions = []
        for paper_id in paper_ids:
            position = self._row_by_id.get(int(paper_id))
            if position is None:
                return None
            positions.append(position)
        return self.unit_matrix[positions]


def clear_cache() -> None:
    """Drop both in-process caches (tests, and after a rebuild)."""
    with _CACHE_LOCK:
        _INDEX_CACHE.clear()
        _META_CACHE.clear()


def _matrix_path(kind: str) -> str:
    if kind == TFIDF:
        return TFIDF_MATRIX_PATH
    if kind == SBERT:
        return SBERT_MATRIX_PATH
    raise ValueError(f"Unknown recommendation vector index kind: {kind}")


def _stat_key(path: str) -> tuple[str, int, int] | None:
    try:
        stat = os.stat(path)
    except OSError:
        return None
    return (os.path.abspath(path), stat.st_mtime_ns, stat.st_size)


def _prune(cache: dict, path: str, keep: tuple[str, int, int]) -> None:
    """Drop stale generations of one path so the cache stays bounded."""
    absolute = os.path.abspath(path)
    for key in [
        key for key in cache if key[0] == absolute and key != keep
    ]:
        cache.pop(key, None)


def _load_meta() -> dict | None:
    key = _stat_key(META_PATH)
    if key is None:
        return None

    with _CACHE_LOCK:
        if key in _META_CACHE:
            return _META_CACHE[key]

    try:
        with open(META_PATH, "r", encoding="utf-8") as handle:
            meta = json.load(handle)
    except (OSError, json.JSONDecodeError):
        meta = None
    if not isinstance(meta, dict):
        meta = None

    with _CACHE_LOCK:
        _prune(_META_CACHE, META_PATH, key)
        _META_CACHE[key] = meta
    return meta


def _ids_hash(paper_ids: np.ndarray) -> str:
    digest = hashlib.sha256()
    digest.update(
        np.ascontiguousarray(paper_ids, dtype=np.int64).tobytes()
    )
    return digest.hexdigest()[:16]


def _content_hash(matrix: np.ndarray, paper_ids: np.ndarray) -> str:
    digest = hashlib.sha256()
    digest.update(
        np.ascontiguousarray(matrix, dtype=np.float32).tobytes()
    )
    digest.update(
        np.ascontiguousarray(paper_ids, dtype=np.int64).tobytes()
    )
    return digest.hexdigest()[:16]


def _read_index(kind: str, path: str) -> VectorIndex | None:
    """
    Read + validate one npz. Any inconsistency returns None: missing or
    unreadable file, wrong dtype/shape, non-ascending ids, meta mismatch,
    or a content hash that does not match the arrays.
    """
    try:
        with np.load(path) as data:
            matrix = data["matrix"]
            paper_ids = data["paper_ids"]
    except (OSError, ValueError, KeyError):
        return None

    if matrix.dtype != np.float32 or paper_ids.dtype != np.int64:
        return None
    if matrix.ndim != 2 or paper_ids.ndim != 1:
        return None
    if matrix.shape[0] == 0 or matrix.shape[1] == 0:
        return None
    if matrix.shape[0] != paper_ids.shape[0]:
        return None
    if not np.all(np.diff(paper_ids) > 0):
        return None

    meta = _load_meta()
    if meta is None or meta.get("version") != INDEX_VERSION:
        return None

    entry = meta.get(kind)
    if not isinstance(entry, dict):
        return None
    if entry.get("count") != int(matrix.shape[0]):
        return None
    if entry.get("dim") != int(matrix.shape[1]):
        return None
    if entry.get("ids_hash") != _ids_hash(paper_ids):
        return None
    if entry.get("content_hash") != _content_hash(matrix, paper_ids):
        return None

    return VectorIndex(matrix=matrix, paper_ids=paper_ids)


def _index_cache_key(kind: str, path: str) -> tuple | None:
    npz_key = _stat_key(path)
    if npz_key is None:
        return None

    meta_key = _stat_key(META_PATH)
    return (
        npz_key[0],
        npz_key[1],
        npz_key[2],
        meta_key[1] if meta_key is not None else -1,
        meta_key[2] if meta_key is not None else -1,
    )


def load_index(kind: str) -> VectorIndex | None:
    """
    Load + validate the matrix for `kind`, using the (path, mtime, size)
    cache. Returns None whenever the index is absent or must be rejected.
    """
    path = _matrix_path(kind)
    key = _index_cache_key(kind, path)
    if key is None:
        return None

    with _CACHE_LOCK:
        if key in _INDEX_CACHE:
            return _INDEX_CACHE[key]

    index = _read_index(kind, path)

    with _CACHE_LOCK:
        _prune(_INDEX_CACHE, path, key)
        _INDEX_CACHE[key] = index
    return index


def score_candidates(
    *,
    kind: str,
    query_vector: list[float],
    paper_ids: list[int],
) -> dict[int, float] | None:
    """
    Fast-path cosine scores for `paper_ids`, or None to request the
    legacy per-row path.

    None is returned when there is no valid index, when any requested id
    is missing from it, or when the query dimension disagrees with the
    stored dimension (a refit vectorizer / encoder change). A zero-norm
    query scores every paper 0.0, mirroring cosine_similarity().
    """
    index = load_index(kind)
    if index is None:
        return None

    query = np.asarray(query_vector, dtype=np.float64)
    if query.size != index.dim:
        return None

    rows = index.rows_for(paper_ids)
    if rows is None:
        return None

    query_norm = float(np.linalg.norm(query))
    if query_norm == 0.0:
        return {int(paper_id): 0.0 for paper_id in paper_ids}

    cosines = rows @ query / query_norm
    return {
        int(paper_id): float(score)
        for paper_id, score in zip(paper_ids, cosines)
    }


def _get_valid_papers(db: Session) -> list[Paper]:
    """
    The same valid-paper set the rebuild encodes vectors from:
    is_valid_for_recommendation=True AND prepared_text IS NOT NULL.
    Ordered by id so the stored id array is sorted ascending.
    """
    return (
        db.query(Paper)
        .filter(Paper.is_valid_for_recommendation.is_(True))
        .filter(Paper.prepared_text.isnot(None))
        .order_by(Paper.id.asc())
        .all()
    )


def _matrix_from_papers(
    papers: list[Paper],
    attribute: str,
) -> tuple[np.ndarray, np.ndarray] | tuple[None, None]:
    """
    Convert the stored JSON vectors into (matrix, paper_ids).

    Papers without a vector are skipped (the legacy path skips them too);
    papers whose vectors disagree in length, or whose JSON is unreadable,
    raise -- that is corrupt rebuild state, not a request-time condition.
    Returns (None, None) when no paper has a usable vector.
    """
    ids: list[int] = []
    rows: list[list[float]] = []
    dim: int | None = None

    for paper in papers:
        encoded = getattr(paper, attribute)
        if not encoded:
            continue

        try:
            vector = json.loads(encoded)
        except (TypeError, ValueError) as error:
            raise ValueError(
                f"Paper {paper.id} has an unreadable "
                f"{attribute} JSON vector."
            ) from error

        if not isinstance(vector, list) or not vector:
            continue

        if dim is None:
            dim = len(vector)
        elif len(vector) != dim:
            raise ValueError(
                f"Paper {paper.id} has a {len(vector)}-dimensional "
                f"{attribute}; expected {dim}."
            )

        ids.append(int(paper.id))
        rows.append(vector)

    if not ids:
        return None, None

    matrix = np.asarray(rows, dtype=np.float32)
    paper_ids = np.asarray(ids, dtype=np.int64)
    return matrix, paper_ids


def _save_matrix(path: str, matrix: np.ndarray, paper_ids: np.ndarray) -> None:
    """Atomic write: temp file in the target directory + os.replace."""
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)

    descriptor, temporary = tempfile.mkstemp(
        dir=directory,
        prefix=".recommendation-",
        suffix=".npz.tmp",
    )
    try:
        with os.fdopen(descriptor, "wb") as handle:
            np.savez(handle, matrix=matrix, paper_ids=paper_ids)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.remove(temporary)
        except OSError:
            pass
        raise


def _update_meta(
    kind: str,
    matrix: np.ndarray,
    paper_ids: np.ndarray,
    model: str | None,
) -> None:
    """
    Merge this kind's entry into the shared meta file (so building TF-IDF
    does not erase the S-BERT entry), then write it atomically.
    """
    meta: dict = {}
    try:
        with open(META_PATH, "r", encoding="utf-8") as handle:
            existing = json.load(handle)
        if isinstance(existing, dict):
            meta = existing
    except (OSError, json.JSONDecodeError):
        meta = {}

    entry = {
        "built_at": _utc_now(),
        "count": int(matrix.shape[0]),
        "dim": int(matrix.shape[1]),
        "ids_hash": _ids_hash(paper_ids),
        "content_hash": _content_hash(matrix, paper_ids),
    }
    if model is not None:
        entry["model"] = model

    meta["version"] = INDEX_VERSION
    meta["updated_at"] = _utc_now()
    meta[kind] = entry

    directory = os.path.dirname(META_PATH)
    os.makedirs(directory, exist_ok=True)

    descriptor, temporary = tempfile.mkstemp(
        dir=directory,
        prefix=".recommendation-meta-",
        suffix=".json.tmp",
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(meta, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, META_PATH)
    except BaseException:
        try:
            os.remove(temporary)
        except OSError:
            pass
        raise


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
    )


def build_index(
    db: Session,
    *,
    kind: str,
    attribute: str,
    model: str | None = None,
) -> bool:
    """
    Build + atomically save the matrix for `kind` from the current
    valid-paper set. Returns False (writing nothing) when no valid paper
    has a usable vector, so rebuild scripts can skip cleanly.
    """
    papers = _get_valid_papers(db)
    matrix, paper_ids = _matrix_from_papers(papers, attribute)
    if matrix is None:
        return False

    _save_matrix(_matrix_path(kind), matrix, paper_ids)
    _update_meta(kind, matrix, paper_ids, model)
    clear_cache()
    return True


def build_tfidf_index(db: Session) -> bool:
    """Build + save recommendation_tfidf.npz from Paper.tfidf_vector."""
    return build_index(
        db,
        kind=TFIDF,
        attribute="tfidf_vector",
    )


def build_sbert_index(
    db: Session,
    model: str | None = None,
) -> bool:
    """Build + save recommendation_sbert.npz from Paper.sbert_vector."""
    return build_index(
        db,
        kind=SBERT,
        attribute="sbert_vector",
        model=model,
    )
