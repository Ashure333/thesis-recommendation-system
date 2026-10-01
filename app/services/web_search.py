"""
Web-based scholarly search across legitimate, keyless APIs.

Google Scholar offers no official API, and scraping it breaks its
ToS (the same conclusion documented in pdf_finder.py). The sources
used here are the legitimate equivalents that reference managers --
including Zotero -- actually build on:

    OpenAlex   open catalog of 250M+ works; citation counts, reliable
               open-access status, abstracts, retraction flags.
    Crossref   the DOI registry; publisher-deposited metadata for
               journals, proceedings and book chapters.

Both are free, keyless, and explicitly allow this kind of query.

PEER-REVIEWED FILTERING
    With peer_reviewed=True (the default) only publication types
    that went through peer review are returned:

        OpenAlex  type:article | book-chapter   (article covers
                  journal papers AND conference/proceedings papers;
                  preprints, datasets, reviews-of-articles excluded)
        Crossref  post-filtered to journal-article, proceedings-article
                  and book-chapter (belt and braces: the response types
                  are checked, never trusted blindly)

    Retracted works are excluded (OpenAlex is_retracted:false).
    With peer_reviewed=False, preprints/report-level material is
    included but datasets/patents/errata never are.

Open-access filtering uses OpenAlex's reliable OA flag; Crossref
metadata cannot say whether a full text is free, so when
open_access_only=True Crossref is skipped rather than guessing.
"""

from __future__ import annotations

import copy
import logging
import re
import threading
import time
from dataclasses import dataclass, asdict

from app.services.pdf_finder import (
    _get_with_retry,
    _reconstruct_openalex_abstract,
    UNPAYWALL_CONTACT_EMAIL,
)
from app.services.identifier_resolver import (
    _format_crossref_authors,
    _strip_markup,
    _DOCUMENT_TYPE_MAP,
)

logger = logging.getLogger(__name__)

# Sorts accepted by the API endpoint.
VALID_SORTS = ("relevance", "citations", "year")

# Publication types that passed peer review.
PEER_REVIEWED_TYPES = {"journal-article", "proceedings-article", "book-chapter"}

# Included only when the user explicitly opts out of the
# peer-reviewed filter.
NON_PEER_TYPES = {"posted-content", "report", "book", "monograph"}

SOURCES = ("openalex", "crossref")

OPENALEX_TYPE_FILTER = "type:article|book-chapter"

REQUEST_LIMIT_CAP = 30
_ABSTRACT_MAX_CHARS = 4000

CACHE_TTL_SECONDS = 10 * 60
CACHE_MAX_ENTRIES = 64
_CACHE_LOCK = threading.Lock()
_CACHE: dict[tuple, tuple[float, list["WebSearchResult"]]] = {}


class WebSearchError(Exception):
    """Every requested source failed -- nothing was searched."""


@dataclass
class WebSearchResult:
    """One hit, normalized across sources."""

    title: str
    author: str | None = None
    abstract: str | None = None
    publication_year: int | None = None
    doi: str | None = None
    venue: str | None = None
    source: str = "openalex"  # provenance: which API answered
    citations: int | None = None
    is_oa: bool | None = None  # None = unknown (Crossref can't tell)
    landing_url: str | None = None
    document_type: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------
# OpenAlex
# ---------------------------------------------------------------------

_OPENALEX_SELECT = ",".join(
    [
        "id",
        "doi",
        "display_name",
        "authorships",
        "publication_year",
        "type",
        "cited_by_count",
        "open_access",
        "primary_location",
        "abstract_inverted_index",
    ]
)


def _openalex_document_type(work: dict, venue: str | None) -> str | None:
    if work.get("type") == "book-chapter":
        return "Book Chapter"

    source = (work.get("primary_location") or {}).get("source") or {}

    if source.get("type") == "conference":
        return "Conference Paper"

    if venue and re.search(
        r"conference|proceedings|symposium|workshop|congress",
        venue,
        re.I,
    ):
        return "Conference Paper"

    return "Journal Article"


def _search_openalex(
    query: str,
    *,
    year_min: int | None,
    year_max: int | None,
    peer_reviewed: bool,
    open_access_only: bool,
    sort: str,
    limit: int,
) -> list[WebSearchResult] | None:
    filters = ["is_retracted:false"]

    if peer_reviewed:
        filters.append(OPENALEX_TYPE_FILTER)

    if open_access_only:
        filters.append("open_access.is_oa:true")

    if year_min is not None:
        filters.append(f"from_publication_date:{year_min}-01-01")

    if year_max is not None:
        filters.append(f"to_publication_date:{year_max}-12-31")

    params: dict = {
        "search": query,
        "filter": ",".join(filters),
        "per-page": min(max(limit * 2, limit), 40),
        "select": _OPENALEX_SELECT,
        "mailto": UNPAYWALL_CONTACT_EMAIL,
    }

    if sort == "citations":
        params["sort"] = "cited_by_count:desc"
    elif sort == "year":
        params["sort"] = "publication_date:desc"
    # relevance: OpenAlex's default ranking for `search`.

    response = _get_with_retry(
        "https://api.openalex.org/works",
        params=params,
        source="openalex-search",
    )

    if response is None or not response.ok:
        logger.debug(
            "[web_search] OpenAlex unavailable (status=%s)",
            getattr(response, "status_code", None),
        )
        return None

    try:
        works = response.json().get("results") or []
    except ValueError:
        return None

    results: list[WebSearchResult] = []

    for work in works:
        title = (work.get("display_name") or "").strip()

        if not title:
            continue

        # Server-side type filter is not the only line of defence.
        if peer_reviewed and work.get("type") not in ("article", "book-chapter"):
            continue

        source = (work.get("primary_location") or {}).get("source") or {}
        venue = (source.get("display_name") or "").strip() or None

        authors = "; ".join(
            (
                (authorship.get("author") or {}).get("display_name") or ""
            ).strip()
            for authorship in work.get("authorships") or []
        ).strip("; ")
        authors = authors or None

        doi = work.get("doi") or ""
        if doi.startswith("https://doi.org/"):
            doi = doi[len("https://doi.org/"):]
        doi = doi or None

        landing_url = (
            (work.get("primary_location") or {}).get("landing_page_url")
            or (f"https://doi.org/{doi}" if doi else None)
        )

        abstract = _reconstruct_openalex_abstract(
            work.get("abstract_inverted_index")
        )
        if abstract and len(abstract) > _ABSTRACT_MAX_CHARS:
            abstract = abstract[:_ABSTRACT_MAX_CHARS]

        open_access = (work.get("open_access") or {}).get("is_oa")

        results.append(
            WebSearchResult(
                title=title,
                author=authors,
                abstract=abstract,
                publication_year=work.get("publication_year"),
                doi=doi,
                venue=venue,
                source="openalex",
                citations=work.get("cited_by_count"),
                is_oa=bool(open_access) if open_access is not None else None,
                landing_url=landing_url,
                document_type=_openalex_document_type(work, venue),
            )
        )

    return results


# ---------------------------------------------------------------------
# Crossref
# ---------------------------------------------------------------------

_CROSSREF_SELECT = ",".join(
    [
        "DOI",
        "title",
        "author",
        "issued",
        "container-title",
        "type",
        "abstract",
        "is-referenced-by-count",
        "URL",
    ]
)


def _search_crossref(
    query: str,
    *,
    year_min: int | None,
    year_max: int | None,
    peer_reviewed: bool,
    sort: str,
    limit: int,
) -> list[WebSearchResult] | None:
    filters: list[str] = []

    if year_min is not None:
        filters.append(f"from-pub-date:{year_min}-01-01")

    if year_max is not None:
        filters.append(f"until-pub-date:{year_max}-12-31")

    params: dict = {
        "query": query,
        "rows": min(max(limit * 2, limit), 40),
        "select": _CROSSREF_SELECT,
    }

    if filters:
        params["filter"] = ",".join(filters)

    if sort == "citations":
        params["sort"] = "is-referenced-by-count"
        params["order"] = "desc"
    elif sort == "year":
        params["sort"] = "published"
        params["order"] = "desc"
    # relevance: Crossref's default (relevance score).

    response = _get_with_retry(
        "https://api.crossref.org/works",
        params=params,
        headers={
            "User-Agent": (
                f"PaperRec/1.0 (mailto:{UNPAYWALL_CONTACT_EMAIL})"
            ),
        },
        source="crossref-search",
    )

    if response is None or not response.ok:
        logger.debug(
            "[web_search] Crossref unavailable (status=%s)",
            getattr(response, "status_code", None),
        )
        return None

    try:
        items = response.json().get("message", {}).get("items") or []
    except ValueError:
        return None

    allowed_types = PEER_REVIEWED_TYPES if peer_reviewed else (
        PEER_REVIEWED_TYPES | NON_PEER_TYPES
    )

    results: list[WebSearchResult] = []

    for item in items:
        item_type = item.get("type") or ""

        # Never trust the upstream filter alone -- check every item.
        if item_type not in allowed_types:
            continue

        titles = item.get("title") or []
        title = (titles[0] if titles else "").strip()

        if not title:
            continue

        containers = item.get("container-title") or []
        venue = (containers[0] if containers else "").strip() or None

        doi = (item.get("DOI") or "").strip() or None

        date_parts = (item.get("issued") or {}).get("date-parts") or []
        year = None
        if date_parts and date_parts[0]:
            year = date_parts[0][0]

        abstract = _strip_markup(item.get("abstract"))
        if abstract and len(abstract) > _ABSTRACT_MAX_CHARS:
            abstract = abstract[:_ABSTRACT_MAX_CHARS]

        citations = item.get("is-referenced-by-count")

        results.append(
            WebSearchResult(
                title=title,
                author=_format_crossref_authors(item.get("author")),
                abstract=abstract,
                publication_year=int(year) if year else None,
                doi=doi,
                venue=venue,
                source="crossref",
                citations=int(citations) if citations is not None else None,
                # Crossref has no reliable OA flag -- unknown, not False.
                is_oa=None,
                landing_url=(item.get("URL") or None),
                document_type=_DOCUMENT_TYPE_MAP.get(item_type),
            )
        )

    return results


# ---------------------------------------------------------------------
# Merge + cache
# ---------------------------------------------------------------------

def _normalize_doi(doi: str | None) -> str | None:
    if not doi:
        return None

    return doi.strip().lower().removeprefix("https://doi.org/")


def _normalize_title(title: str) -> str:
    return re.sub(r"[^\w\s]", " ", title.lower()).split()


def _title_key(title: str, year: int | None) -> tuple:
    return (" ".join(_normalize_title(title)), year)


def _interleave(*lists: list[WebSearchResult]) -> list[WebSearchResult]:
    """Round-robin so a relevance search blends both sources fairly."""
    merged: list[WebSearchResult] = []
    longest = max((len(items) for items in lists), default=0)

    for index in range(longest):
        for items in lists:
            if index < len(items):
                merged.append(items[index])

    return merged


def _merge(
    openalex_results: list[WebSearchResult],
    crossref_results: list[WebSearchResult],
    sort: str,
    limit: int,
) -> list[WebSearchResult]:
    if sort == "citations":
        candidates = openalex_results + crossref_results
        candidates.sort(
            key=lambda result: result.citations or 0,
            reverse=True,
        )
    elif sort == "year":
        candidates = openalex_results + crossref_results
        candidates.sort(
            key=lambda result: result.publication_year or 0,
            reverse=True,
        )
    else:
        # Relevance: interleave the two ranked lists.
        candidates = _interleave(openalex_results, crossref_results)

    # Deduplicate: DOI first (OpenAlex entries win -- they carry
    # abstracts and OA status), then normalized title + year.
    seen_dois: set[str] = set()
    seen_titles: set[tuple] = set()
    unique: list[WebSearchResult] = []

    for result in candidates:
        doi = _normalize_doi(result.doi)

        if doi:
            if doi in seen_dois:
                continue
            seen_dois.add(doi)

        title_key = _title_key(result.title, result.publication_year)

        if title_key in seen_titles:
            continue
        seen_titles.add(title_key)

        unique.append(result)

    return unique[:limit]


def search_web(
    query: str,
    *,
    year_min: int | None = None,
    year_max: int | None = None,
    peer_reviewed: bool = True,
    open_access_only: bool = False,
    sources: tuple[str, ...] = SOURCES,
    sort: str = "relevance",
    limit: int = 15,
) -> list[WebSearchResult]:
    """
    Query the requested sources and return one merged, deduplicated,
    peer-reviewed-by-default result list. Raises WebSearchError only
    when EVERY requested source failed (so a single flaky API still
    yields partial results).
    """
    query = (query or "").strip()

    if not query:
        return []

    requested = tuple(
        source for source in sources if source in SOURCES
    ) or SOURCES

    # Open-access-only relies on OpenAlex's OA flag; Crossref cannot
    # answer that question, so it is dropped rather than guessed.
    if open_access_only and "crossref" in requested:
        requested = tuple(s for s in requested if s != "crossref")

    if not requested:
        requested = ("openalex",)

    cache_key = (
        query,
        year_min,
        year_max,
        peer_reviewed,
        open_access_only,
        requested,
        sort,
        limit,
    )

    now = time.monotonic()

    with _CACHE_LOCK:
        entry = _CACHE.get(cache_key)

        if entry and entry[0] > now:
            return copy.deepcopy(entry[1])

        if entry:
            _CACHE.pop(cache_key, None)

    openalex_results: list[WebSearchResult] | None = None
    crossref_results: list[WebSearchResult] | None = None

    if "openalex" in requested:
        openalex_results = _search_openalex(
            query,
            year_min=year_min,
            year_max=year_max,
            peer_reviewed=peer_reviewed,
            open_access_only=open_access_only,
            sort=sort,
            limit=limit,
        )

    if "crossref" in requested:
        crossref_results = _search_crossref(
            query,
            year_min=year_min,
            year_max=year_max,
            peer_reviewed=peer_reviewed,
            sort=sort,
            limit=limit,
        )

    if openalex_results is None and crossref_results is None:
        raise WebSearchError("Every web search source failed.")

    merged = _merge(
        openalex_results or [],
        crossref_results or [],
        sort,
        limit,
    )

    with _CACHE_LOCK:
        if len(_CACHE) >= CACHE_MAX_ENTRIES:
            expired = [
                key
                for key, (expiry, _) in _CACHE.items()
                if expiry <= now
            ]
            for key in expired:
                _CACHE.pop(key, None)

            while len(_CACHE) >= CACHE_MAX_ENTRIES:
                _CACHE.pop(next(iter(_CACHE)))

        _CACHE[cache_key] = (
            time.monotonic() + CACHE_TTL_SECONDS,
            copy.deepcopy(merged),
        )

    return merged
