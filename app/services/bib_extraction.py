"""
BibTeX (.bib) metadata auto-extraction.

Extracts metadata from the first BibTeX entry in a .bib file.

Supported fields:

    Title:
        title = {...}
        title = "..."

    Authors:
        author = {...}
        author = "..."

    Abstract:
        abstract = {...}
        abstract = "..."

    Keywords:
        keywords = {...}
        keywords = "..."

    Publication year:
        year = {...}
        year = "..."
        year = 2020

BibTeX is treated as the authoritative source for metadata that is
already present in the file. Missing metadata can subsequently be
filled by the optional Google Scholar enrichment step.

Only the first @entry{...} in the file is read. If a .bib file
contains multiple entries, later entries are ignored rather than
merged.
"""

import re
from datetime import datetime


YEAR_PATTERN = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")


def _find_first_entry(text: str) -> str | None:
    """
    Finds the first @entrytype{...} block and returns its inner
    content, including the citation key and all fields.
    """

    match = re.search(r"@\w+\s*\{", text)

    if not match:
        return None

    start = match.end()

    depth = 1
    i = start

    while i < len(text) and depth > 0:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1

        i += 1

    if depth != 0:
        # Unbalanced braces -- bail rather than guess.
        return None

    return text[start : i - 1]


def _find_field(entry_text: str, field_name: str) -> str | None:
    """
    Finds:

        field = {...}
        field = "..."
        field = bare_value

    The last form is primarily useful for numeric fields such as year.
    """

    match = re.search(
        r"\b" + re.escape(field_name) + r"\s*=\s*",
        entry_text,
        re.IGNORECASE,
    )

    if not match:
        return None

    pos = match.end()

    if pos >= len(entry_text):
        return None

    # ---------------------------------------------------------
    # Braced value
    # ---------------------------------------------------------
    if entry_text[pos] == "{":
        depth = 1
        i = pos + 1

        while i < len(entry_text) and depth > 0:
            if entry_text[i] == "{":
                depth += 1
            elif entry_text[i] == "}":
                depth -= 1

            i += 1

        if depth != 0:
            return None

        return entry_text[pos + 1 : i - 1]

    # ---------------------------------------------------------
    # Quoted value
    # ---------------------------------------------------------
    if entry_text[pos] == '"':
        i = pos + 1

        while i < len(entry_text):
            if entry_text[i] == '"' and entry_text[i - 1] != "\\":
                return entry_text[pos + 1 : i]

            i += 1

        return None

    # ---------------------------------------------------------
    # Bare value
    # Example:
    #   year = 2020
    # ---------------------------------------------------------
    bare_match = re.match(
        r"([^,\n}]+)",
        entry_text[pos:],
    )

    if not bare_match:
        return None

    return bare_match.group(1).strip()


def _clean_bib_text(raw: str | None) -> str | None:
    """
    Removes BibTeX capitalization-protection braces and normalizes
    whitespace.
    """

    if raw is None:
        return None

    text = raw.replace("{", "").replace("}", "")

    text = " ".join(text.split())

    text = text.strip()

    return text or None


def _extract_title(entry: str) -> str | None:
    """Extract the title field."""

    title = _clean_bib_text(
        _find_field(entry, "title")
    )

    if title and len(title) >= 3:
        return title

    return None


def _extract_authors(entry: str) -> str | None:
    """
    Extract the BibTeX author field.

    BibTeX normally stores multiple authors using:

        author = {
            Author One and Author Two and Author Three
        }

    The complete author string is preserved rather than converting
    names into a different format. This allows the repository to
    retain the original BibTeX author information.

    Example:

        author = {
            Vaswani, Ashish and
            Shazeer, Noam and
            Parmar, Niki
        }

    becomes:

        Vaswani, Ashish and Shazeer, Noam and Parmar, Niki
    """

    authors = _clean_bib_text(
        _find_field(entry, "author")
    )

    if not authors:
        return None

    # Normalize repeated whitespace around the BibTeX "and"
    # separator while preserving the actual author names.
    authors = re.sub(
        r"\s+\band\b\s+",
        " and ",
        authors,
        flags=re.IGNORECASE,
    )

    authors = authors.strip()

    return authors or None


def _extract_abstract(entry: str) -> str | None:
    """
    Extract the abstract field.

    Abstracts shorter than 40 characters are treated as missing,
    matching the existing behavior of this extractor.
    """

    abstract = _clean_bib_text(
        _find_field(entry, "abstract")
    )

    if abstract and len(abstract) >= 40:
        return abstract

    return None


def _extract_keywords(entry: str) -> str | None:
    """
    Extract and normalize the keywords field.

    BibTeX commonly uses either commas or semicolons as keyword
    separators. The repository uses comma-separated keywords.
    """

    keywords = _clean_bib_text(
        _find_field(entry, "keywords")
    )

    if not keywords:
        return None

    # Normalize semicolon-separated keyword lists.
    keywords = keywords.replace(";", ",")

    # Normalize comma-separated keyword lists.
    keywords = ", ".join(
        keyword.strip()
        for keyword in keywords.split(",")
        if keyword.strip()
    )

    return keywords or None


def _extract_publication_year(
    entry: str,
    full_text: str,
) -> int | None:
    """
    Extract the publication year.

    First uses the explicit BibTeX `year` field.

    If that is missing or invalid, falls back to the most frequently
    occurring valid year in the complete file.
    """

    current_year = datetime.now().year

    # ---------------------------------------------------------
    # Primary source: explicit BibTeX year field
    # ---------------------------------------------------------
    year_field = _find_field(entry, "year")

    if year_field:
        match = YEAR_PATTERN.search(year_field)

        if match:
            year = int(match.group(1))

            if year <= current_year:
                return year

    # ---------------------------------------------------------
    # Fallback: years appearing elsewhere in the file
    # ---------------------------------------------------------
    years = [
        int(year)
        for year in YEAR_PATTERN.findall(full_text)
        if int(year) <= current_year
    ]

    if not years:
        return None

    # Return the most frequently repeated year.
    return max(
        set(years),
        key=years.count,
    )


def extract_metadata_from_bib(bib_path: str) -> dict:
    """
    Extract metadata from the first BibTeX entry.

    Returns:

        {
            "title": str | None,
            "author": str | None,
            "abstract": str | None,
            "keywords": str | None,
            "publication_year": int | None,
        }

    Missing fields are returned as None.
    """

    with open(
        bib_path,
        "r",
        encoding="utf-8",
        errors="ignore",
    ) as f:
        raw_text = f.read()

    # ---------------------------------------------------------
    # Find first BibTeX entry
    # ---------------------------------------------------------
    entry = _find_first_entry(raw_text)

    if entry is None:
        return {
            "title": None,
            "author": None,
            "abstract": None,
            "keywords": None,
            "publication_year": None,
        }

    # ---------------------------------------------------------
    # Extract metadata
    # ---------------------------------------------------------
    return {
        "title": _extract_title(entry),
        "author": _extract_authors(entry),
        "abstract": _extract_abstract(entry),
        "keywords": _extract_keywords(entry),
        "publication_year": _extract_publication_year(
            entry,
            raw_text,
        ),
    }