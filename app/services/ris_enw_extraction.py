# ============================================================
# RIS (RefMan / RefWorks) and EndNote (.enw) citation parsers.
#
# Both formats are line-oriented tagged records exported by
# Google Scholar ("Cite" dialog) and by reference managers.
# The returned dictionary matches the contract of
# extract_metadata_from_bib() in bib_extraction.py so the rest
# of the upload pipeline treats all three the same way.
# ============================================================

import re
from typing import Optional

# ------------------------------------------------------------------
# RIS (tag <spaces> "-" <spaces> value)
# ------------------------------------------------------------------

_RIS_TAG = re.compile(
    r"(?m)^([A-Z]{2})\s*-\s*(.*)$"
)

_RIS_FIELD_TAGS = {
    "title": ("TI", "T1"),
    "author": ("AU", "A1"),
    "abstract": ("AB", "N2"),
    "keywords": ("KW",),
    "publication_year": ("PY", "Y1"),
    "doi": ("DO", "M1"),
    "journal": ("JF", "JO", "JA"),
}

# ------------------------------------------------------------------
# EndNote (tag "%0" + separator + value; tags are %A %T %D ...)
# ------------------------------------------------------------------

_ENW_TAG = re.compile(
    r"(?m)^%([0-9A-Za-z])\s+(.*)$"
)

_ENW_FIELD_TAGS = {
    "title": ("T",),
    "author": ("A",),
    "abstract": ("X",),
    "keywords": ("K",),
    "publication_year": ("D",),
    "doi": ("R", "7"),
}

_DOI_PATTERN = re.compile(
    r"(?i)\b10\.\d{4,9}/\S+"
)


def _clean(value: str) -> Optional[str]:
    """Strip LaTeX-ish noise and whitespace, like bib_extraction."""
    value = value.strip()
    if not value:
        return None
    return " ".join(value.split())


def _first(values: list[str]) -> Optional[str]:
    for value in values:
        cleaned = _clean(value)
        if cleaned:
            return cleaned
    return None


def _join(values: list[str], separator: str = ", ") -> Optional[str]:
    cleaned = [
        _clean(value)
        for value in values
    ]
    cleaned = [
        value
        for value in cleaned
        if value
    ]
    if not cleaned:
        return None
    return separator.join(cleaned)


def _extract_year(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    match = re.search(r"\b(19|20)\d{2}\b", value)
    if match is None:
        return None
    return int(match.group(0))


def _extract_doi_from_uri(value: Optional[str]) -> Optional[str]:
    """Raw DO lines carry the DOI; URL/EndNote fields may embed it."""
    if value is None:
        return None
    match = _DOI_PATTERN.search(value)
    if match is None:
        return None
    return match.group(0).rstrip(",.;")


def _missing() -> dict:
    return {
        "title": None,
        "author": None,
        "abstract": None,
        "keywords": None,
        "publication_year": None,
        "doi": None,
    }


def _parse_tagged(
    raw_text: str,
    tag_pattern: re.Pattern,
    field_tags: dict,
    journal_tags: tuple[str, ...] | None = None,
) -> dict:
    """Shared body: collect every value per tag, then map to fields."""
    collected: dict[str, list[str]] = {}

    for match in tag_pattern.finditer(raw_text):
        tag = match.group(1).upper()
        value = match.group(2).strip()

        if not value:
            continue

        collected.setdefault(tag, []).append(value)

    def field(*tags: str) -> list[str]:
        values: list[str] = []
        for tag in tags:
            values.extend(collected.get(tag, []))
        return values

    metadata = _missing()

    title = _first(field(*field_tags["title"]))
    if title:
        metadata["title"] = title

    author = _join(field(*field_tags["author"]))
    if author:
        metadata["author"] = author

    abstract = _first(field(*field_tags["abstract"]))
    if abstract:
        metadata["abstract"] = abstract

    keywords = _join(field(*field_tags["keywords"]), separator="; ")
    if keywords:
        metadata["keywords"] = keywords

    year = _extract_year(
        _first(field(*field_tags["publication_year"]))
    )
    if year is not None:
        metadata["publication_year"] = year

    doi = _extract_doi_from_uri(
        _first(field(*field_tags["doi"]))
    )
    if doi is None and journal_tags:
        # EndNote exports sometimes carry the DOI in %U; RIS files
        # usually put it in DO, but some exporters use UR.
        doi = _extract_doi_from_uri(
            _first(field(*journal_tags))
        )
    if doi:
        metadata["doi"] = doi

    return metadata


def _first_ris_record(raw_text: str) -> str:
    """Slice the text down to the first record (ends at 'ER  -')."""
    end = re.search(r"(?im)^ER\s*-", raw_text)
    return raw_text[: end.start()] if end else raw_text


def _first_enw_record(raw_text: str) -> str:
    """Slice the text down to the first record (starts at '%0')."""
    starts = list(re.finditer(r"(?m)^%0\s", raw_text))

    if not starts:
        return raw_text

    begin = starts[0].start()
    end = starts[1].start() if len(starts) > 1 else len(raw_text)
    return raw_text[begin:end]


def extract_metadata_from_ris(ris_path: str) -> dict:
    """
    Extract metadata from the first RIS record.

    Returns the same dictionary shape as
    bib_extraction.extract_metadata_from_bib().
    """

    with open(
        ris_path,
        "r",
        encoding="utf-8",
        errors="ignore",
    ) as f:
        raw_text = f.read()

    if not re.search(r"(?im)^TY\s*-", raw_text):
        return _missing()

    return _parse_tagged(
        _first_ris_record(raw_text),
        _RIS_TAG,
        _RIS_FIELD_TAGS,
        journal_tags=None,
    )


def extract_metadata_from_enw(enw_path: str) -> dict:
    """
    Extract metadata from the first EndNote (.enw) record.

    Returns the same dictionary shape as
    bib_extraction.extract_metadata_from_bib().
    """

    with open(
        enw_path,
        "r",
        encoding="utf-8",
        errors="ignore",
    ) as f:
        raw_text = f.read()

    if not re.search(r"(?m)^%0\s", raw_text):
        return _missing()

    return _parse_tagged(
        _first_enw_record(raw_text),
        _ENW_TAG,
        _ENW_FIELD_TAGS,
        journal_tags=("U",),
    )


# ------------------------------------------------------------------
# Entry splitting for multi-record exports (Google Scholar and
# reference managers export whole lists). The upload flow splits
# client-side, mirroring the BibTeX multi-entry navigator.
# ------------------------------------------------------------------


def split_ris_records(ris_text: str) -> list[str]:
    """Split a RIS export into individual records at 'ER  -' ends."""
    normalized = (
        ris_text.replace("\r\n", "\n").replace("\r", "\n")
    )

    records = re.split(
        r"(?im)^ER\s*-\s*\n?",
        normalized,
    )

    return [
        record.strip()
        for record in records
        if record.strip()
    ]


def split_enw_records(enw_text: str) -> list[str]:
    """Split an EndNote export into individual records at '%0' starts."""
    normalized = (
        enw_text.replace("\r\n", "\n").replace("\r", "\n")
    )

    records = re.split(
        r"(?m)^(?=%0\s)",
        normalized,
    )

    return [
        record.strip()
        for record in records
        if record.strip()
    ]