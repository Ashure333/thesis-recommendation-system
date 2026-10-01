"""Repository catalog.

The canonical subject / category / document-type taxonomy lives
here, in the backend, so it can GROW as users add more references:
the /api/catalog endpoint returns the seed defaults merged with
every subject / category / document type actually stored in the
papers table. A paper uploaded with a new category automatically
extends the catalog on the next fetch — no manual sync.
"""

DEFAULT_SUBJECTS = [
    "Computer Science",
    "Mathematics",
    "Information Technology",
    "Engineering",
    "Physics",
    "Chemistry",
    "Biology",
    "Statistics",
    "Economics",
    "Business Administration",
    "Education",
    "Psychology",
]

DEFAULT_CATEGORIES = [
    "Machine Learning",
    "Mathematical Analysis",
    "Mathematical Modeling",
    "Graph Theory",
    "Linear Algebra",
    "Information Retrieval",
    "Algorithms",
]

DEFAULT_DOCUMENT_TYPES = [
    "Journal Article",
    "Conference Paper",
    "Thesis",
    "Technical Report",
]


def merge_defaults(defaults: list[str], seen_values: list[str]) -> list[str]:
    """Seed order first (deduped), then any stored values appended."""
    merged: list[str] = []
    known: set[str] = set()

    for item in defaults:
        merged.append(item)
        known.add(item.lower())

    for item in seen_values:
        if item.lower() not in known:
            merged.append(item)
            known.add(item.lower())

    return merged