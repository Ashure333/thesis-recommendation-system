"""
File storage for uploaded academic paper source files (PDF or BibTeX).

Physical files are stored in:

    project_root/storage/papers/

Each file is named using its database paper ID, keeping its original
extension:

    storage/papers/3.pdf
    storage/papers/4.bib

The database stores only the relative path:

    papers/3.pdf
"""

from pathlib import Path
import shutil


# storage.py location:
# project_root/app/services/storage.py
#
# .parent                  -> app/services
# .parent.parent           -> app
# .parent.parent.parent    -> project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Correct root storage directory
STORAGE_ROOT = BASE_DIR / "storage"

# Correct papers directory
PAPERS_DIR = STORAGE_ROOT / "papers"

ALLOWED_EXTENSIONS = {".pdf", ".bib"}


def ensure_storage_ready() -> None:
    """
    Create storage/papers/ if it does not exist.
    """
    PAPERS_DIR.mkdir(parents=True, exist_ok=True)


def save_paper_file(paper_id: int, source_path: str) -> str:
    """
    Copy an uploaded PDF or BibTeX file into:

        project_root/storage/papers/{paper_id}{original extension}

    Returns the relative path saved in the database:

        papers/{paper_id}{original extension}
    """

    ensure_storage_ready()

    source = Path(source_path).resolve()

    if not source.exists():
        raise FileNotFoundError(
            f"Source file does not exist: {source}"
        )

    if not source.is_file():
        raise ValueError(
            f"Source path is not a file: {source}"
        )

    extension = source.suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Only PDF and BibTeX (.bib) files are allowed.")

    destination = PAPERS_DIR / f"{paper_id}{extension}"

    print(f"Source file:      {source}")
    print(f"Destination file: {destination}")

    shutil.copy2(source, destination)

    if not destination.exists():
        raise IOError(
            f"File was not copied successfully: {destination}"
        )

    print(f"File saved successfully: {destination}")

    # This is the path stored in Paper.stored_path.
    # It is relative to the root storage directory.
    return str(Path("papers") / destination.name)


def get_paper_file_path(stored_path: str) -> str:
    """
    Convert a database path such as:

        papers/3.pdf

    into the full path:

        project_root/storage/papers/3.pdf
    """

    return str(STORAGE_ROOT / stored_path)


def delete_paper_file(stored_path: str) -> None:
    """
    Delete a stored PDF if it exists.
    """

    full_path = Path(get_paper_file_path(stored_path))

    if full_path.exists():
        full_path.unlink()