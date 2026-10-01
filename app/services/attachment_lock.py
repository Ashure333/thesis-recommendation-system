"""
Per-paper attachment lock.

download_and_attach_pdf() writes to a single path named after the
paper id ({paper_id}.pdf). Two requests can now race for the same
paper:

    1. the user's explicit POST /api/papers/{id}/attach-pdf, and
    2. the background enrichment queue's automatic attach that runs
       after upload (see enrichment_queue.py).

The lock serializes the check + download for one paper so the two can
never write the same file at the same time (interleaved writes would
corrupt it). Each holder re-checks paper.stored_path after acquiring,
so the loser of the race simply no-ops instead of downloading again.
"""

from __future__ import annotations

import threading

_registry_guard = threading.Lock()
_paper_locks: dict[int, threading.Lock] = {}


def attachment_lock(paper_id: int) -> threading.Lock:
    """
    Returns the process-wide lock for one paper's attachment step.
    Lock objects are created lazily and reused; the repository holds
    at most a few thousand papers, so the registry stays small.
    """
    with _registry_guard:
        lock = _paper_locks.get(paper_id)

        if lock is None:
            lock = threading.Lock()
            _paper_locks[paper_id] = lock

        return lock
