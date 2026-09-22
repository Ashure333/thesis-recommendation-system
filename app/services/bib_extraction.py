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

    DOI:
        doi = {10.1234/abcd.5678}
        doi = {https://doi.org/10.1234/abcd.5678}

BibTeX is treated as the authoritative source for metadata that is
already present in the file. Missing metadata can subsequently be
filled by the optional Google Scholar enrichment step.

Only the first @entry{...} in the file is read. If a .bib file
contains multiple entries, later entries are ignored rather than
merged.
"""

import re
import unicodedata
from datetime import datetime


YEAR_PATTERN = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")


# ---------------------------------------------------------------------
# LaTeX -> plain Unicode cleanup
# ---------------------------------------------------------------------
#
# Google Scholar's BibTeX export (and most reference managers) escapes
# accented characters and protects capitalization using LaTeX syntax,
# e.g.:
#
#     title = {A {S}tudy of {\'{E}}tude and Caf{\'e} Culture}
#     author = {M{\"u}ller, Hans and {\c{S}}ahin, Ay{\c{s}}e}
#
# The previous cleaner only stripped braces, which left the backslash
# commands in place (turning "\'{e}" into the literal text "'e" or
# similar garbage). A title like that will never match the same
# paper's title on Unpaywall/Semantic Scholar/arXiv/OpenAlex/Crossref,
# so PDF discovery for anything with an accented title or author name
# silently returns nothing. _delatex() runs BEFORE brace-stripping to
# fix this.

_LATEX_ACCENT_COMBINING = {
    "'": "\u0301",  # acute      -> e.g. \'e  => é
    "`": "\u0300",  # grave      -> \`e       => è
    "^": "\u0302",  # circumflex -> \^e       => ê
    '"': "\u0308",  # diaeresis  -> \"o       => ö
    "~": "\u0303",  # tilde      -> \~n       => ñ
    "=": "\u0304",  # macron     -> \=a       => ā
    ".": "\u0307",  # dot above  -> \.z       => ż
    "v": "\u030C",  # caron      -> \vc       => č
    "u": "\u0306",  # breve      -> \ug       => ğ
    "H": "\u030B",  # double acute -> \Ho     => ő
    "c": "\u0327",  # cedilla    -> \cc       => ç
    "k": "\u0328",  # ogonek     -> \ka       => ą
    "r": "\u030A",  # ring above -> \ra       => å
    "d": "\u0323",  # dot below  -> \ds       => ṣ
    "b": "\u0331",  # bar below  -> \bb       => ḇ
}

# Longest-first so e.g. "\ss" isn't mistaken for "\s" + "s".
_LATEX_NO_ARG_COMMANDS = [
    (r"\ss", "ß"), (r"\SS", "SS"),
    (r"\aa", "å"), (r"\AA", "Å"),
    (r"\ae", "æ"), (r"\AE", "Æ"),
    (r"\oe", "œ"), (r"\OE", "Œ"),
    (r"\dh", "ð"), (r"\DH", "Ð"),
    (r"\th", "þ"), (r"\TH", "Þ"),
    (r"\ng", "ŋ"), (r"\NG", "Ŋ"),
    (r"\o", "ø"), (r"\O", "Ø"),
    (r"\l", "ł"), (r"\L", "Ł"),
    (r"\i", "ı"), (r"\j", "ȷ"),
]

_LATEX_ESCAPED_LITERALS = {
    r"\&": "&", r"\%": "%", r"\_": "_",
    r"\$": "$", r"\#": "#",
}


def _delatex(text: str) -> str:
    """
    Converts common LaTeX accent macros and escaped characters into
    plain Unicode text. Idempotent and safe to call on text that has
    no LaTeX in it at all.
    """
    if not text:
        return text

    for command, replacement in _LATEX_NO_ARG_COMMANDS:
        text = re.sub(re.escape(command) + r"(?![a-zA-Z])", replacement, text)

    for command, replacement in _LATEX_ESCAPED_LITERALS.items():
        text = text.replace(command, replacement)

    # Accent commands, with or without braces around the letter:
    # \'e   \'{e}   {\'e}   {\'{e}}
    for command, combining_mark in _LATEX_ACCENT_COMBINING.items():
        pattern = re.compile(r"\\" + re.escape(command) + r"\s*\{?([a-zA-Z])\}?")
        text = pattern.sub(
            lambda m: unicodedata.normalize("NFC", m.group(1) + combining_mark),
            text,
        )

    # "~" is a non-breaking-space tie in LaTeX (e.g. "Fig.~1").
    text = text.replace("~", " ")

    # Any backslash still left over at this point is LaTeX markup we
    # don't specifically handle (\emph{}, \textbf{}, stray commands,
    # etc.) -- drop the backslash rather than leave garbage in the text.
    text = text.replace("\\", "")

    return text


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
    Removes LaTeX accent/escape markup and capitalization-protection
    braces, then normalizes whitespace.
    """

    if raw is None:
        return None

    text = _delatex(raw)

    text = text.replace("{", "").replace("}", "")

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


def _extract_doi(entry: str) -> str | None:
    """
    Extract the BibTeX doi field, if present.

    Handles both plain DOIs:
        doi = {10.1234/abcd.5678}

    and DOIs written as full URLs:
        doi = {https://doi.org/10.1234/abcd.5678}

    Populating this from the .bib file directly (rather than leaving
    it for pdf_finder.py's Crossref-resolution fallback) matters: a
    paper that already has a DOI on file goes straight to Unpaywall --
    the strongest PDF source -- instead of needing a Crossref lookup
    to guess one first.
    """

    doi = _clean_bib_text(
        _find_field(entry, "doi")
    )

    if not doi:
        return None

    # Sometimes stored as a full URL
    doi = re.sub(
        r"^https?://(dx\.)?doi\.org/",
        "",
        doi,
        flags=re.IGNORECASE,
    )

    return doi.strip() or None


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
            "doi": str | None,
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
            "doi": None,
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
        "doi": _extract_doi(entry),
    }