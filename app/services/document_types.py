"""
Document types from citation formats.

A BibTeX entry type, a RIS `TY` code and an EndNote `%0` value all say
what kind of work a citation is. They map onto the repository's own
vocabulary (the same names the web import and the filters use) so a book
is never filed as a "Journal Article". Anything unclear returns None and
is left for the reviewer to choose.
"""

from __future__ import annotations

import re

JOURNAL = "Journal Article"
CONFERENCE = "Conference Paper"
CHAPTER = "Book Chapter"
BOOK = "Book"
PREPRINT = "Preprint"
THESIS = "Thesis"
REPORT = "Technical Report"

_BIBTEX = {
    "article": JOURNAL,
    "inproceedings": CONFERENCE,
    "conference": CONFERENCE,
    "proceedings": CONFERENCE,
    "incollection": CHAPTER,
    "inbook": CHAPTER,
    "book": BOOK,
    "booklet": BOOK,
    "phdthesis": THESIS,
    "mastersthesis": THESIS,
    "thesis": THESIS,
    "techreport": REPORT,
    "report": REPORT,
}

_RIS = {
    "JOUR": JOURNAL,
    "EJOUR": JOURNAL,
    "MGZN": JOURNAL,
    "CONF": CONFERENCE,
    "CPAPER": CONFERENCE,
    "CHAP": CHAPTER,
    "ECHAP": CHAPTER,
    "BOOK": BOOK,
    "EBOOK": BOOK,
    "THES": THESIS,
    "RPRT": REPORT,
    "INPR": PREPRINT,
    "UNPB": PREPRINT,
}

_ENDNOTE = {
    "journal article": JOURNAL,
    "conference paper": CONFERENCE,
    "conference proceedings": CONFERENCE,
    "book section": CHAPTER,
    "book": BOOK,
    "edited book": BOOK,
    "thesis": THESIS,
    "report": REPORT,
    "electronic article": JOURNAL,
}

_ARXIV = re.compile(r"arxiv|eprinttype\s*=\s*\{?\s*arxiv", re.IGNORECASE)


def from_bibtex(entry_type: str | None, entry_text: str = "") -> str | None:
    """`@article` -> Journal Article, `@book` -> Book, ...; arXiv entries are Preprints."""

    kind = (entry_type or "").strip().lower()
    arxiv = bool(_ARXIV.search(entry_text or ""))

    if kind in ("misc", "unpublished", "online"):
        return PREPRINT if arxiv else None

    if kind == "article" and arxiv and not re.search(r"\bdoi\s*=", entry_text or "", re.I):
        return PREPRINT

    return _BIBTEX.get(kind)


def from_ris(code: str | None) -> str | None:
    return _RIS.get((code or "").strip().upper())


def from_endnote(value: str | None) -> str | None:
    return _ENDNOTE.get(re.sub(r"\s+", " ", (value or "")).strip().lower())
