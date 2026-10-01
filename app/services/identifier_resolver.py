"""
Resolves a pasted identifier -- DOI, arXiv id, or a link to either --
into preview metadata for the "Add by identifier" import flow.

Design: identify by a cheap, high-precision identifier first instead
of parsing a document. This mirrors Zotero's RecognizeDocument, which
tries a DOI-based lookup through its search translators before falling
back to heavier processing (recognizeDocument.js:434-461 does the DOI
first, the recognizer service after).

One request to Crossref or the arXiv API replaces the whole
PDF-extraction pipeline: no file to upload, no pdfplumber pass.
Callers (api.py) build the Paper, classify/validate it, and return the
same preview payload the file flow uses.

No database access and no writes happen here.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote

from app.services.pdf_finder import (
    _get_with_retry,
    _reconstruct_openalex_abstract,
    UNPAYWALL_CONTACT_EMAIL,
)
from app.services.arxiv_categories import (
    arxiv_category_names,
    arxiv_to_subject_category,
)

logger = logging.getLogger(__name__)


class IdentifierLookupError(Exception):
    """
    Resolution failed for a reason worth telling the user about.
    status_code maps onto the HTTP response (404 = no such record,
    502 = the upstream service could not be reached).
    """

    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


# ---------------------------------------------------------------------
# Identifier parsing
# ---------------------------------------------------------------------

_DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$")
_ARXIV_NEW_RE = re.compile(r"^\d{4}\.\d{4,5}(v\d+)?$")
_ARXIV_OLD_RE = re.compile(r"^[a-z-]+(\.[a-z]{2})?/\d{7}(v\d+)?$", re.I)
_DOI_URL_RE = re.compile(r"(?:dx\.)?doi\.org/(10\.\d{4,9}/\S+)", re.I)
_ARXIV_URL_RE = re.compile(r"arxiv\.org/(?:abs|pdf)/([^\s?#]+)", re.I)


def _clean_arxiv_id(value: str) -> str:
    """
    "1706.03762v5.pdf" -> "1706.03762" (drop the version suffix and
    any file extension a /pdf/ link carries).
    """
    cleaned = value.strip().strip("/")

    if cleaned.lower().endswith(".pdf"):
        cleaned = cleaned[: -len(".pdf")]

    cleaned = re.sub(r"v\d+$", "", cleaned)

    return cleaned


def parse_identifier(raw: str) -> tuple[str, str] | None:
    """
    Returns ("doi", value) or ("arxiv", value), or None when the text
    is neither a DOI nor an arXiv id in any accepted form.
    """
    text = (raw or "").strip()

    if not text:
        return None

    # Link forms first -- they carry the identifier inside a URL.
    doi_url = _DOI_URL_RE.search(text)
    if doi_url:
        return ("doi", doi_url.group(1).rstrip(").,;\"'"))

    arxiv_url = _ARXIV_URL_RE.search(text)
    if arxiv_url:
        cleaned = _clean_arxiv_id(arxiv_url.group(1))
        if cleaned:
            return ("arxiv", cleaned)

    # Explicit "arXiv:2106.03762" prefix (as printed on papers).
    if text.lower().startswith("arxiv:"):
        cleaned = _clean_arxiv_id(text[len("arxiv:"):])
        if cleaned:
            return ("arxiv", cleaned)
        return None

    # Bare identifiers.
    if _DOI_RE.match(text):
        return ("doi", text.rstrip(").,;\"'"))

    if _ARXIV_NEW_RE.match(text) or _ARXIV_OLD_RE.match(text):
        return ("arxiv", _clean_arxiv_id(text))

    return None


# ---------------------------------------------------------------------
# Field shaping shared by both lookups
# ---------------------------------------------------------------------

# Crossref `type` -> this repository's document_type vocabulary (the
# same values the upload form offers).
_DOCUMENT_TYPE_MAP = {
    "journal-article": "Journal Article",
    "proceedings-article": "Conference Paper",
    "book-chapter": "Book Chapter",
    "book": "Book",
    "monograph": "Book",
    "posted-content": "Preprint",
    "preprint": "Preprint",
    "thesis": "Thesis",
    "dissertation": "Thesis",
    "report": "Technical Report",
    "standard": "Technical Report",
    "dataset": "Dataset",
    "patent": "Patent",
}


def _strip_markup(value: str | None) -> str | None:
    """Crossref abstracts are JATS XML (<jats:p>...</jats:p>)."""
    if not value:
        return None

    text = re.sub(r"<[^>]+>", " ", value)
    text = " ".join(text.split())

    return text or None


# OpenAlex abstracts often open with the citation header their source
# record carries: an author-list sentence, then a venue sentence, then
# a bare year -- "Nils Reimers, Iryna Gurevych. Proceedings of ... .
# 2019. <actual abstract>". Stripped only when the first sentence
# matches this conservative comma-list-of-Capitalized-names pattern,
# so an abstract that legitimately opens with prose is left alone.
_NAME_LIST_SENTENCE = re.compile(
    r"^[A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+)?"
    r"(?:\s*,\s*[A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+)?)+$"
)

_VENUE_SENTENCE = re.compile(
    r"^(?:Proceedings|Proc\.|In\s|Abstract|Preprint|arXiv|"
    r"Published|Presented|CEUR|Journal\s|Conference|Vol\.)"
)

_BARE_YEAR_SENTENCE = re.compile(r"^(?:19|20)\d{2}$")


def _strip_citation_preamble(abstract: str | None) -> str | None:
    """
    Remove an OpenAlex abstract's citation header (authors, venue,
    year) so the stored abstract -- and the keywords generated from
    it -- start at the actual abstract text.
    """
    if not abstract:
        return abstract

    first, separator, rest = abstract.partition(". ")

    if not separator or not _NAME_LIST_SENTENCE.match(first.strip()):
        return abstract

    text = rest

    while text:
        sentence, sep, remainder = text.partition(". ")
        stripped = sentence.strip()

        if not sep:
            break

        if (
            _VENUE_SENTENCE.match(stripped)
            or _BARE_YEAR_SENTENCE.match(stripped)
        ):
            text = remainder
            continue

        break

    cleaned = text.strip()

    return cleaned or abstract


def _first(value) -> str | None:
    if isinstance(value, list) and value:
        return str(value[0]).strip() or None
    if isinstance(value, str):
        return value.strip() or None
    return None


def _format_crossref_authors(authors: list | None) -> str | None:
    formatted: list[str] = []

    for author in authors or []:
        if not isinstance(author, dict):
            continue

        family = (author.get("family") or "").strip()
        given = (author.get("given") or "").strip()

        if family and given:
            formatted.append(f"{family}, {given}")
        elif family or given:
            formatted.append(family or given)

    return "; ".join(formatted) or None


# ---------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------

def _lookup_openalex_abstract(doi: str) -> str | None:
    """
    Crossref records frequently ship without an abstract (ACL/ACM and
    most society deposits leave it out). OpenAlex has one for many of
    those DOIs -- fetched only when Crossref didn't provide it, so the
    common case stays a single request.

    Uses OpenAlex's abstract_inverted_index (word -> positions) via
    the same reconstructor pdf_finder.py uses for search results.
    """
    response = _get_with_retry(
        f"https://api.openalex.org/works/https://doi.org/{doi}",
        params={"mailto": UNPAYWALL_CONTACT_EMAIL},
        source="openalex-doi",
    )

    if response is None or not response.ok:
        return None

    try:
        data = response.json()
    except ValueError:
        return None

    abstract = _reconstruct_openalex_abstract(
        data.get("abstract_inverted_index")
    )

    # Citation-record abstracts open with their own authors/venue --
    # strip that header before it can leak into keywords.
    abstract = _strip_citation_preamble(abstract)

    # Header-only / truncated records come back as fragments like
    # "2019." -- report no abstract rather than junk. A missing
    # abstract is handled honestly everywhere (the preview form,
    # keyword generation, and background enrichment).
    if not abstract or len(abstract) < 60:
        return None

    return abstract


def _lookup_crossref(doi: str) -> dict:
    url = f"https://api.crossref.org/works/{quote(doi, safe='')}"

    response = _get_with_retry(
        url,
        headers={
            "User-Agent": (
                f"PaperRec/1.0 (mailto:{UNPAYWALL_CONTACT_EMAIL})"
            ),
        },
        source="crossref-doi",
    )

    if response is None:
        raise IdentifierLookupError(
            "Crossref could not be reached right now.",
            status_code=502,
        )

    if response.status_code == 404:
        raise IdentifierLookupError(
            f"No Crossref record exists for DOI {doi}.",
            status_code=404,
        )

    if not response.ok:
        raise IdentifierLookupError(
            f"Crossref responded with {response.status_code}.",
            status_code=502,
        )

    message = response.json().get("message") or {}

    title = _first(message.get("title"))

    if not title:
        raise IdentifierLookupError(
            f"The Crossref record for {doi} has no title.",
            status_code=404,
        )

    year = None
    date_parts = (message.get("issued") or {}).get("date-parts") or []

    if date_parts and date_parts[0]:
        year = date_parts[0][0]

    citations = message.get("is-referenced-by-count")

    abstract = _strip_markup(message.get("abstract"))

    if not abstract:
        abstract = _lookup_openalex_abstract(doi)

    return {
        "title": title,
        "author": _format_crossref_authors(message.get("author")),
        "abstract": abstract,
        "keywords": None,
        "publication_year": int(year) if year else None,
        "doi": doi,
        "subject_category": None,
        "document_type": _DOCUMENT_TYPE_MAP.get(
            message.get("type") or "",
            None,
        ),
        "citation_count": int(citations) if citations is not None else None,
        "source_filename": f"doi.org/{doi}",
    }


def _lookup_arxiv(arxiv_id: str) -> dict:
    response = _get_with_retry(
        "https://export.arxiv.org/api/query",
        params={"id_list": arxiv_id},
        source="arxiv",
    )

    if response is None:
        raise IdentifierLookupError(
            "The arXiv API could not be reached right now.",
            status_code=502,
        )

    if not response.ok:
        raise IdentifierLookupError(
            f"The arXiv API responded with {response.status_code}.",
            status_code=502,
        )

    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as error:
        raise IdentifierLookupError(
            "The arXiv API returned an unreadable response.",
            status_code=502,
        ) from error

    namespace = {"a": "http://www.w3.org/2005/Atom"}
    entry = root.find("a:entry", namespace)

    if entry is None:
        raise IdentifierLookupError(
            f"arXiv has no record for {arxiv_id}.",
            status_code=404,
        )

    title = " ".join(
        (entry.findtext("a:title", "", namespace) or "").split()
    )

    # Unknown ids come back as an entry literally titled "Error".
    if not title or title.lower() == "error":
        raise IdentifierLookupError(
            f"arXiv has no record for {arxiv_id}.",
            status_code=404,
        )

    authors = "; ".join(
        name
        for name in (
            " ".join((node.text or "").split())
            for node in entry.findall("a:author/a:name", namespace)
        )
        if name
    ) or None

    abstract = " ".join(
        (entry.findtext("a:summary", "", namespace) or "").split()
    ) or None

    published = entry.findtext("a:published", "", namespace) or ""
    year = int(published[:4]) if len(published) >= 4 and published[:4].isdigit() else None

    # ---------------------------------------------------------
    # arXiv categories -> repository taxonomy
    #
    # The feed carries one or more category codes (cs.LG, math.OC,
    # ...) plus a primary category. Recognize them into the
    # repository's subject/category taxonomy so an arXiv import is
    # classified properly, and use the mapped category names as
    # keywords so the recommendation engine can search on them.
    # ---------------------------------------------------------

    arxiv_namespace = {"arxiv": "http://arxiv.org/schemas/atom"}

    categories = [
        (node.get("term") or "").strip()
        for node in entry.findall("a:category", namespace)
        if (node.get("term") or "").strip()
    ]

    primary = None
    primary_node = entry.find("arxiv:primary_category", arxiv_namespace)
    if primary_node is not None:
        primary = (primary_node.get("term") or "").strip() or None

    subject_category = arxiv_to_subject_category(
        primary,
        categories,
    )

    keyword_names = arxiv_category_names(
        [primary] + categories if primary else categories,
    )

    return {
        "title": title,
        "author": authors,
        "abstract": abstract,
        "keywords": ", ".join(keyword_names) if keyword_names else None,
        "publication_year": year,
        "doi": None,
        "subject_category": subject_category,
        "document_type": "Preprint",
        "citation_count": None,
        "source_filename": f"arXiv:{arxiv_id}",
        "arxiv_categories": categories,
    }


def resolve_identifier(raw: str) -> dict | None:
    """
    Parses and resolves one identifier into preview-metadata fields.

    Returns None when the text is not a recognizable identifier.
    Raises IdentifierLookupError when it *is* recognizable but the
    upstream service says no / is unreachable.
    """
    parsed = parse_identifier(raw)

    if parsed is None:
        return None

    kind, value = parsed

    logger.info("[resolve_identifier] resolving %s %r", kind, value)

    if kind == "doi":
        return _lookup_crossref(value)

    return _lookup_arxiv(value)
