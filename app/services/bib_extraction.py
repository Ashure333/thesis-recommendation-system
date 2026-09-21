"""
BibTeX (.bib) metadata auto-extraction.

Extracts the same four recommendation-signal fields as the PDF and
LaTeX extractors (Title, Abstract, Keywords, Publication Year), but
reads them directly from a BibTeX entry's fields. This is generally
the MOST reliable of the three input types when available, since a
.bib entry's fields (title = {...}, year = {...}, etc.) are
unambiguous structured data rather than something to be guessed from
layout or prose.

Only the first @entry{...} in the file is read (a .bib file uploaded
for a single paper should only contain one entry; if it has more,
later entries are ignored rather than merged).

Field support:
    Title:      title = {...} or title = "..."
    Abstract:   abstract = {...} or abstract = "..."
                (many BibTeX exports, e.g. from Zotero/Mendeley, do
                include this; plain hand-written .bib files often
                don't -- that's a genuine gap in the source file, not
                a parsing failure, and comes back as None either way)
    Keywords:   keywords = {...} or keywords = "..."
                (semicolon-separated lists are normalized to commas,
                since that's this system's convention elsewhere)
    Year:       year = {...}, year = "...", or a bare year = 2020

A field that can't be found comes back as None, same contract as the
PDF and LaTeX extractors.
"""

import re
from datetime import datetime

YEAR_PATTERN = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")


def _find_first_entry(text: str) -> str | None:
    """
    Finds the first @entrytype{...} block (matching braces), and
    returns its inner content (citation key + all fields).
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
        return None  # unbalanced braces -- bail rather than guess
    return text[start : i - 1]


def _find_field(entry_text: str, field_name: str) -> str | None:
    """
    Finds field_name = {...}, field_name = "...", or a bare
    field_name = value (used for numeric fields like year).
    """
    match = re.search(r"\b" + re.escape(field_name) + r"\s*=\s*", entry_text, re.IGNORECASE)
    if not match:
        return None

    pos = match.end()
    if pos >= len(entry_text):
        return None

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

    if entry_text[pos] == '"':
        end = entry_text.find('"', pos + 1)
        return entry_text[pos + 1 : end] if end != -1 else None

    # Bare value (e.g. year = 2020) -- read until the next comma or newline.
    bare_match = re.match(r"([^,\n}]+)", entry_text[pos:])
    return bare_match.group(1).strip() if bare_match else None


def _clean_bib_text(raw: str | None) -> str | None:
    """Strips BibTeX's capitalization-protecting braces and tidies whitespace."""
    if raw is None:
        return None
    text = raw.replace("{", "").replace("}", "")
    text = " ".join(text.split())
    return text.strip() or None


def _extract_title(entry: str) -> str | None:
    title = _clean_bib_text(_find_field(entry, "title"))
    return title if title and len(title) >= 3 else None


def _extract_abstract(entry: str) -> str | None:
    abstract = _clean_bib_text(_find_field(entry, "abstract"))
    return abstract if abstract and len(abstract) >= 40 else None


def _extract_keywords(entry: str) -> str | None:
    keywords = _clean_bib_text(_find_field(entry, "keywords"))
    if not keywords:
        return None
    # Normalize semicolon-separated lists (common BibTeX convention) to
    # the comma-separated convention used elsewhere in this system.
    keywords = keywords.replace(";", ",")
    keywords = ", ".join(k.strip() for k in keywords.split(",") if k.strip())
    return keywords or None


def _extract_publication_year(entry: str, full_text: str) -> int | None:
    current_year = datetime.now().year

    year_field = _find_field(entry, "year")
    if year_field:
        match = YEAR_PATTERN.search(year_field)
        if match and int(match.group(1)) <= current_year:
            return int(match.group(1))

    # Fallback: most frequently repeated year anywhere in the file,
    # same reasoning as the PDF/LaTeX extractors.
    years = [int(y) for y in YEAR_PATTERN.findall(full_text) if int(y) <= current_year]
    if not years:
        return None
    return max(set(years), key=years.count)


def extract_metadata_from_bib(bib_path: str) -> dict:
    """
    Runs all four extractors on a .bib file's first entry and returns:
        {
            "title": str | None,
            "abstract": str | None,
            "keywords": str | None,
            "publication_year": int | None,
        }
    """
    with open(bib_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()

    entry = _find_first_entry(raw_text)
    if entry is None:
        # No recognizable @entry{...} at all -- nothing to extract.
        return {"title": None, "abstract": None, "keywords": None, "publication_year": None}

    return {
        "title": _extract_title(entry),
        "abstract": _extract_abstract(entry),
        "keywords": _extract_keywords(entry),
        "publication_year": _extract_publication_year(entry, raw_text),
    }
