"""
File storage for uploaded paper PDFs.

Design:
    - All PDFs live in one flat folder: storage/papers/
    - Each file is named by the paper's database id (e.g. "104.pdf"), so
      there is never a filename collision and the mapping from a Paper
      row to its file on disk is trivial (id -> id.pdf).
    - "Organizing" papers (alphabetically, by date added, by year, etc.)
      is NOT done by moving files into different folders. It's done by
      querying the database, which already holds title/created_at/
      publication_year for every paper. See queries.py.

This keeps physical storage simple and stable even if a paper's title
or subject_category changes later -- the file never needs to move.
"""

import os
import shutil

# Root folder for all stored paper files, resolved relative to the project
# root (two levels up from app/services/storage.py), not this file's own
# folder -- so it correctly points to <project_root>/storage regardless of
# where the script that imports this module is run from.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))          # app/services
_PROJECT_ROOT = os.path.dirname(os.path.dirname(_THIS_DIR))     # project root
STORAGE_ROOT = os.path.join(_PROJECT_ROOT, "storage")
PAPERS_DIR = os.path.join(STORAGE_ROOT, "papers")


def ensure_storage_ready() -> None:
    """Creates storage/papers/ if it doesn't exist yet. Safe to call anytime."""
    os.makedirs(PAPERS_DIR, exist_ok=True)


def save_paper_file(paper_id: int, source_path: str) -> str:
    """
    Copies the file at `source_path` into storage/papers/, named by
    `paper_id` (e.g. paper id 104 -> storage/papers/104.pdf).

    Returns the path *relative to STORAGE_ROOT* (e.g. "papers/104.pdf"),
    which is what should be saved into Paper.stored_path -- keeping the
    DB independent of where STORAGE_ROOT happens to sit on this machine.
    """
    ensure_storage_ready()

    _, ext = os.path.splitext(source_path)
    ext = ext.lower() if ext.lower() == ".pdf" else ".pdf"  # defensively normalize

    dest_filename = f"{paper_id}{ext}"
    dest_path = os.path.join(PAPERS_DIR, dest_filename)

    shutil.copyfile(source_path, dest_path)

    return os.path.join("papers", dest_filename)


def get_paper_file_path(stored_path: str) -> str:
    """
    Resolves a Paper.stored_path value (e.g. "papers/104.pdf") back into
    a full, absolute filesystem path you can open/serve.
    """
    return os.path.join(STORAGE_ROOT, stored_path)


def delete_paper_file(stored_path: str) -> None:
    """Removes a paper's file from disk, if present. No error if already gone."""
    full_path = get_paper_file_path(stored_path)
    if os.path.exists(full_path):
        os.remove(full_path)
