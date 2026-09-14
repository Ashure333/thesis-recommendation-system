"""
File storage for uploaded academic paper PDFs.

Physical files are stored in:

    project_root/storage/papers/

Each PDF is named using its database paper ID:

    storage/papers/3.pdf

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

# Correct PDF directory
PAPERS_DIR = STORAGE_ROOT / "papers"


def ensure_storage_ready() -> None:
    """
    Create storage/papers/ if it does not exist.
    """
    PAPERS_DIR.mkdir(parents=True, exist_ok=True)


def save_paper_file(paper_id: int, source_path: str) -> str:
    """
    Copy an uploaded PDF into:

        project_root/storage/papers/{paper_id}.pdf

    Returns the relative path saved in the database:

        papers/{paper_id}.pdf
    """

    ensure_storage_ready()

    source = Path(source_path).resolve()

    if not source.exists():
        raise FileNotFoundError(
            f"Source PDF does not exist: {source}"
        )

    if not source.is_file():
        raise ValueError(
            f"Source path is not a file: {source}"
        )

    if source.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are allowed.")

    destination = PAPERS_DIR / f"{paper_id}.pdf"

    print(f"Source PDF:      {source}")
    print(f"Destination PDF: {destination}")

    shutil.copy2(source, destination)

    if not destination.exists():
        raise IOError(
            f"PDF was not copied successfully: {destination}"
        )

    print(f"PDF saved successfully: {destination}")

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