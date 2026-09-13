"""
PDF metadata auto-extraction.

Extracts the four recommendation-signal fields (Title, Abstract, Keywords,
Publication Year) from an uploaded PDF using text-layout heuristics and
regex pattern matching -- not a full ML-based parser like GROBID. This
fits the prototype scope of the thesis: it will get typical, well-formed
academic paper layouts right most of the time, but atypical layouts
(scanned images, unusual section naming, non-standard title pages) may
fail to extract one or more fields. That is expected and handled -- a
failed field is simply left as None, and validate_paper() (in
validation.py) will flag the paper invalid-for-recommendation and record
which field(s) need manual entry.

Requires: pdfplumber (pip install pdfplumber)
"""

import re
from datetime import datetime

import pdfplumber

YEAR_PATTERN = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")

ABSTRACT_HEADER = re.compile(r"^\s*abstract\b", re.IGNORECASE | re.MULTILINE)
# Section/front-matter headers that mark where the abstract text should stop.
# Table of Contents, List of Figures, etc. commonly sit between the Abstract
# and the Introduction in thesis-style documents, so they need to be
# recognized as stop points too, not just "Keywords"/"Introduction".
NEXT_SECTION_HEADER = re.compile(
    r"\b(keywords|index terms|1\.?\s+introduction|i\.\s+introduction|introduction|"
    r"table of contents|list of figures|list of tables|acknowledge?ments?)\b",
    re.IGNORECASE,
)
KEYWORDS_LINE = re.compile(
    r"(?:keywords|index terms)\s*[:\-]\s*(.+)", re.IGNORECASE
)
# A line like "Methodology . . . . . . . . 8" or "Methodology........8" -- the
# dot-leader pattern used in Tables of Contents (PDF text extraction usually
# keeps the dots space-separated, so this allows an optional space between
# each dot). Seeing this on the same line as a header match means that
# "header" is actually a TOC entry, not the real section heading.
DOT_LEADER_PATTERN = re.compile(r"(?:\.[ \t]?){4,}\d+")


def _extract_full_text(pdf_path: str, max_pages: int = 5) -> list[str]:
    """Returns a list of per-page text strings for the first max_pages pages."""
    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:max_pages]:
            pages_text.append(page.extract_text() or "")
    return pages_text


def _extract_title(pdf_path: str, first_page_text: str) -> str | None:
    """
    Heuristic: the title is usually the largest-font text block near the
    top of page 1. Falls back to the first non-empty line of text if font
    size data is unavailable or inconclusive.
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[0]
            words = page.extract_words(extra_attrs=["size"])
            if words:
                # Only look at the top third of the page -- titles don't
                # appear halfway down.
                top_cutoff = page.height / 3
                candidates = [w for w in words if w["top"] <= top_cutoff]
                if candidates:
                    max_size = max(w["size"] for w in candidates)
                    # Collect words at (near) the largest font size, in
                    # reading order, and join them into the title.
                    title_words = [
                        w["text"] for w in candidates if w["size"] >= max_size - 0.5
                    ]
                    title = " ".join(title_words).strip()
                    if len(title) >= 8:  # sanity check, not just a stray heading
                        return title
    except Exception:
        pass

    # Fallback: first substantial non-empty line of the page text.
    for line in first_page_text.splitlines():
        line = line.strip()
        if len(line) >= 8:
            return line
    return None


def _is_toc_entry_line(text: str, position: int) -> bool:
    """
    Checks whether the line containing `position` looks like a Table of
    Contents entry (i.e. it has a dot-leader followed by a page number
    on the same line) rather than an actual section heading.
    """
    line_start = text.rfind("\n", 0, position) + 1
    line_end = text.find("\n", position)
    if line_end == -1:
        line_end = len(text)
    line = text[line_start:line_end]
    return bool(DOT_LEADER_PATTERN.search(line))


def _extract_abstract(full_text: str) -> str | None:
    """
    Heuristic: grabs the text between an "Abstract" header and the next
    recognizable section/front-matter header (Keywords / Introduction /
    Table of Contents / etc.).

    Thesis-style documents often have their own Table of Contents entry
    that reads "Abstract . . . . . ii" -- this looks like a header match
    but is really just a TOC line. Each candidate match is checked against
    its own line for a dot-leader + page-number pattern and skipped if so,
    so the search keeps going until it finds the real heading (or runs out
    of candidates).
    """
    for match in ABSTRACT_HEADER.finditer(full_text):
        if _is_toc_entry_line(full_text, match.start()):
            continue  # this "Abstract" is a TOC listing, not the real heading

        after_header = full_text[match.end():]
        next_match = NEXT_SECTION_HEADER.search(after_header)
        abstract_block = after_header[: next_match.start()] if next_match else after_header[:2000]

        # Extra safety net: if the candidate block still contains TOC-style
        # dot-leader lines, we've captured front matter rather than prose --
        # skip this match rather than store garbage.
        if len(DOT_LEADER_PATTERN.findall(abstract_block)) >= 2:
            continue

        abstract = " ".join(abstract_block.split())  # collapse whitespace/newlines
        abstract = abstract.strip(" :.-")
        if len(abstract) >= 40:  # too short = probably a mis-match
            return abstract

    return None


def _extract_keywords(full_text: str) -> str | None:
    """Heuristic: looks for a 'Keywords:' or 'Index Terms:' line."""
    match = KEYWORDS_LINE.search(full_text)
    if not match:
        return None
    raw = match.group(1)
    # Stop at the next blank line / obvious section break.
    raw = raw.split("\n\n")[0].split("\n")[0]
    keywords = raw.strip(" .")
    return keywords if keywords else None


def _extract_publication_year(full_text: str) -> int | None:
    """
    Heuristic: collects plausible 4-digit years from the text and picks
    the most frequent one, since copyright lines, references, and
    footers often repeat the actual publication year more than once.
    Ignores years in the future (typos / OCR artifacts).
    """
    current_year = datetime.now().year
    years = [int(y) for y in YEAR_PATTERN.findall(full_text) if int(y) <= current_year]
    if not years:
        return None
    return max(set(years), key=years.count)


def extract_metadata_from_pdf(pdf_path: str) -> dict:
    """
    Runs all four extractors and returns a dict:
        {
            "title": str | None,
            "abstract": str | None,
            "keywords": str | None,
            "publication_year": int | None,
        }
    A None value means that field could not be confidently extracted and
    will need manual entry.
    """
    pages_text = _extract_full_text(pdf_path)
    first_page_text = pages_text[0] if pages_text else ""
    full_text = "\n".join(pages_text)

    return {
        "title": _extract_title(pdf_path, first_page_text),
        "abstract": _extract_abstract(full_text),
        "keywords": _extract_keywords(full_text),
        "publication_year": _extract_publication_year(full_text),
    }
