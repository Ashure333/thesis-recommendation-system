"""
Background enrichment queue -- "save first, enrich later".

The import path used to run metadata enrichment and open-access PDF
attachment inline, which meant every upload waited on up to six HTTP
sources (plus retries/backoff) before the request could return. Those
steps are network-bound and best-effort by contract, so they now run
on a small bounded worker pool after the record is committed.

This mirrors Zotero's import design:

    - folderImport.mjs splits import into four phases ("sniff for mime
      type, calculate md5, import as attachment, recognize") where the
      network-heavy "recognize" phase is last and queued;
    - server_connector.js returns HTTP 201 immediately while
      RecognizeDocument.autoRecognizeItems() runs as a background
      promise;
    - recognizeDocument.js / attachments.js keep their own queues
      (ProgressQueues "recognize" and "findFile") so lookups are
      bounded background work, never part of saving the item.

Statuses per paper id: "queued" -> "running" -> "done" | "failed".
Exposed to the frontend via GET /api/papers/{id}/enrichment-status.
"""

from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

ENRICHMENT_QUEUED = "queued"
ENRICHMENT_RUNNING = "running"
ENRICHMENT_DONE = "done"
ENRICHMENT_FAILED = "failed"

# Bounded on purpose: a bulk import of N papers must not fan out into
# N concurrent workers hammering the same external APIs.
_MAX_WORKERS = 2

# Cap the status ledger so long-running servers don't accumulate one
# entry per paper ever uploaded. Oldest entries are dropped first.
_MAX_STATUS_ENTRIES = 512

_executor = ThreadPoolExecutor(
    max_workers=_MAX_WORKERS,
    thread_name_prefix="paper-enrich",
)

_status_lock = threading.Lock()
_statuses: dict[int, str] = {}


def enqueue_paper_enrichment(paper_id: int) -> None:
    """
    Schedule background enrichment for a paper that was just saved.
    Never raises: a queue failure must not break the upload that
    triggered it (the record is already committed at this point).
    """
    with _status_lock:
        _statuses[paper_id] = ENRICHMENT_QUEUED

        while len(_statuses) > _MAX_STATUS_ENTRIES:
            oldest = next(iter(_statuses))
            del _statuses[oldest]

    try:
        _executor.submit(_run_enrichment, paper_id)
    except RuntimeError:
        # Interpreter is shutting down; nothing we can do.
        with _status_lock:
            _statuses[paper_id] = ENRICHMENT_FAILED

        logger.warning(
            "Could not enqueue enrichment for paper id=%s "
            "(executor is shutting down)",
            paper_id,
        )


def get_enrichment_status(paper_id: int) -> str | None:
    """Current status for this paper, or None if nothing was enqueued."""
    with _status_lock:
        return _statuses.get(paper_id)


def _run_enrichment(paper_id: int) -> None:
    with _status_lock:
        _statuses[paper_id] = ENRICHMENT_RUNNING

    status = ENRICHMENT_DONE

    try:
        # Imported here, not at module top: upload_paper imports this
        # module, so a module-level import would be circular.
        from app.services.upload_paper import enrich_saved_paper

        changed = enrich_saved_paper(paper_id)

        if changed:
            # Same signal the synchronous paths use when enrichment
            # alters recommendation-relevant fields.
            try:
                from app.api import set_recommendation_index_stale

                set_recommendation_index_stale(True)
            except Exception:
                logger.exception(
                    "Could not mark recommendation index stale after "
                    "enriching paper id=%s",
                    paper_id,
                )

    except Exception:
        status = ENRICHMENT_FAILED

        logger.exception(
            "Background enrichment failed for paper id=%s",
            paper_id,
        )

    finally:
        with _status_lock:
            _statuses[paper_id] = status
