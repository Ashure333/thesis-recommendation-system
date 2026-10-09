"""
Web connections -- a paper's OpenAlex citation neighborhood.

The local graph draws on the repository's own embeddings and cached
citations; this module answers the "WEB" side of the scope switch in
the similar-papers pane: given a paper's DOI, resolve the OpenAlex
work, then its references (prior works) and its citers (derivative
works), with titles and years fetched in one batch request.

Prior works are ordered by their own OpenAlex citation count, so the
seminal papers of the field surface first; derivative works the same
way, so surveys and heavily-cited follow-ups lead.

Every network read goes through an injectable `fetch(url) -> dict`
(the same seam citations.py uses), so tests run offline.
"""

import re
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor

from app.services.citations import (
    OPENALEX_WORK_BASE,
    _default_fetch,
    normalize_doi,
)

_SELECT = (
    "id,title,doi,publication_year,cited_by_count,"
    "authorships,referenced_works"
)

_WORK_ID = re.compile(r"(W\d+)\s*$")

MAX_REFERENCES = 15
MAX_CITERS = 15


def _work_entry(work: dict) -> dict | None:
    """Normalize one OpenAlex work into the connection-card shape."""
    match = _WORK_ID.search(str(work.get("id") or ""))

    if not match:
        return None

    author = None
    authorships = work.get("authorships") or []

    if authorships:
        author = (
            authorships[0].get("author", {}).get("display_name")
            or None
        )

    return {
        "work_id": match.group(1),
        "title": work.get("title") or None,
        "doi": normalize_doi(work.get("doi")),
        "publication_year": work.get("publication_year"),
        "cited_by_count": work.get("cited_by_count"),
        "author": author,
    }


def _fetch_details(
    work_ids: list[str],
    fetch,
) -> list[dict]:
    """Resolve a batch of OpenAlex ids into full work records.

    One `ids.openalex` filter call when the API accepts it; a small
    thread pool of individual lookups as the fallback so a filter
    change upstream cannot blank the list.
    """
    if not work_ids:
        return []

    url = (
        f"{OPENALEX_WORK_BASE}"
        f"?filter=ids.openalex:{'|'.join(work_ids)}"
        f"&per-page=50&select={_SELECT}"
    )

    try:
        payload = fetch(url)
        results = payload.get("results")

        if isinstance(results, list) and results:
            return results
    except Exception:
        pass

    def one(work_id: str):
        try:
            return fetch(
                f"{OPENALEX_WORK_BASE}/{work_id}?select={_SELECT}"
            )
        except Exception:
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        fetched = pool.map(one, work_ids[:10])

    return [work for work in fetched if isinstance(work, dict)]


def _ref_set(work: dict) -> set[str]:
    """Normalized OpenAlex ids of one fetched work's references."""
    refs: set[str] = set()

    for raw in work.get("referenced_works") or []:
        match = _WORK_ID.search(str(raw))

        if match:
            refs.add(match.group(1))

    return refs


# Titles already resolved this process, so the local graph only pays
# the OpenAlex lookup once per external work. Bounded: reset when it
# grows past the cap rather than tracking LRU order.
_TITLE_CACHE: dict[str, str] = {}
_TITLE_CACHE_CAP = 600


def resolve_work_titles(
    work_ids: list[str],
    fetch=None,
    limit: int = 40,
) -> dict[str, str]:
    """Best-effort OpenAlex titles for bare work ids.

    The local citation store keeps only ids (and sometimes DOIs) for
    the works the graph cites / is cited by; the prior/derivative
    lists are much more readable with the real titles. One batch
    lookup for anything not cached; failures return what's cached
    (possibly nothing) and never raise.
    """
    if not work_ids:
        return {}

    if fetch is None:
        fetch = _default_fetch

    missing = [
        work_id
        for work_id in dict.fromkeys(work_ids)
        if work_id not in _TITLE_CACHE
    ][:limit]

    if missing:
        if len(_TITLE_CACHE) > _TITLE_CACHE_CAP:
            _TITLE_CACHE.clear()

        try:
            for work in _fetch_details(missing, fetch):
                entry = _work_entry(work)

                if entry and entry["title"]:
                    _TITLE_CACHE[entry["work_id"]] = entry["title"]
        except Exception:
            # Offline / rate-limited: labels stay as ids or DOIs.
            pass

    return {
        work_id: _TITLE_CACHE[work_id]
        for work_id in dict.fromkeys(work_ids)
        if work_id in _TITLE_CACHE
    }


def _build_edges(
    prior_works: list[dict],
    derivative_works: list[dict],
    prior_raw: list[dict],
    citer_raw: list[dict],
    *,
    min_shared: int = 2,
    limit: int = 160,
) -> list[list]:
    """Connection list for the web graph — a rich neighborhood
    instead of a plain star, using the reference lists OpenAlex
    already returned alongside each work:

        "ref"    center → prior work it cites
        "cit"    citer → center
        "cites"  citer → prior work it also cites
        "coref"  two prior works sharing >= min_shared references
                 (bibliographic coupling)
        "cocite" two citers sharing >= min_shared references
                 (co-citation, surveys built on the same base)

    Sources/targets are OpenAlex work ids; the center is the literal
    "center". Capped at `limit` edges, star edges kept first.
    """
    refs: dict[str, set[str]] = {}

    for work in [*prior_raw, *citer_raw]:
        entry = _work_entry(work)

        if entry:
            refs[entry["work_id"]] = _ref_set(work)

    prior_ids = [work["work_id"] for work in prior_works]
    citer_ids = [work["work_id"] for work in derivative_works]
    known_prior = set(prior_ids)

    edges: list[list] = []

    for work_id in prior_ids:
        edges.append([work_id, "center", 1.0, "ref"])

    for work_id in citer_ids:
        edges.append([work_id, "center", 1.0, "cit"])

        for target in sorted(refs.get(work_id, set()) & known_prior)[:5]:
            edges.append([work_id, target, 0.8, "cites"])

    def add_shared(ids: list[str], kind: str) -> None:
        for index, left in enumerate(ids):
            for right in ids[index + 1 :]:
                shared = len(
                    refs.get(left, set()) & refs.get(right, set())
                )

                if shared >= min_shared:
                    weight = round(min(1.0, shared / 8), 3)
                    edges.append([left, right, weight, kind])

    add_shared(prior_ids, "coref")
    add_shared(citer_ids, "cocite")

    return edges[:limit]


def _title_key(title: str | None) -> str:
    """Lowercased alphanumeric skeleton of a title, for matching."""
    return re.sub(r"[^a-z0-9]+", " ", str(title or "").lower()).strip()


def _lookup_by_title(title: str, fetch) -> dict | None:
    """Best OpenAlex work for a title, only when the title matches.

    Title search is fuzzy, so the top hit is accepted only when its
    own title equals the query after normalization (or one contains
    the other and they share most words) -- a wrong neighborhood is
    worse than none.
    """
    wanted = _title_key(title)

    if len(wanted) < 8:
        return None

    url = (
        f"{OPENALEX_WORK_BASE}?search={quote(str(title)[:300])}"
        f"&per-page=3&select={_SELECT}"
    )
    page = fetch(url)

    for work in (page.get("results") or [])[:3]:
        found = _title_key(work.get("title"))

        if not found:
            continue

        if found == wanted:
            return work

        shorter, longer = sorted((found, wanted), key=len)

        if len(shorter) >= 0.9 * len(longer) and shorter in longer:
            return work

    return None


def fetch_web_neighborhood(
    paper,
    *,
    fetch=None,
    max_references: int = MAX_REFERENCES,
    max_citers: int = MAX_CITERS,
) -> dict:
    """Prior/derivative works for one saved paper (by its DOI)."""
    return fetch_neighborhood(
        doi=paper.doi,
        fetch=fetch,
        max_references=max_references,
        max_citers=max_citers,
    )


def fetch_neighborhood(
    *,
    doi: str | None = None,
    title: str | None = None,
    work_id: str | None = None,
    fetch=None,
    max_references: int = MAX_REFERENCES,
    max_citers: int = MAX_CITERS,
) -> dict:
    """Prior/derivative works for a work given by DOI, OpenAlex id
    or (last resort) exact-ish title, straight from OpenAlex.

    Only api.openalex.org URLs are ever built: the DOI goes through
    normalize_doi and is percent-quoted, the id must be W<digits>, and
    the title is a quoted search parameter. Never raises: network and
    parse problems come back as {"ok": False, "reason": ...}.
    """
    if fetch is None:
        fetch = _default_fetch

    doi = normalize_doi(doi)
    work_id = (work_id or "").strip()

    if work_id and not re.fullmatch(r"W\d+", work_id):
        work_id = ""

    title = (title or "").strip()

    if not doi and not work_id and not title:
        return {"ok": False, "reason": "no_doi"}

    root = None

    def get_or_none(url: str):
        """One lookup; an HTTP 404 means "OpenAlex has no such work"."""
        try:
            return fetch(url)
        except Exception as error:
            if getattr(error, "code", None) == 404:
                return None
            raise

    def found(work) -> bool:
        return isinstance(work, dict) and bool(work.get("id"))

    try:
        if doi:
            root = get_or_none(
                f"{OPENALEX_WORK_BASE}/doi:{quote(doi, safe='/:()')}"
                f"?select={_SELECT}"
            )

        if not found(root) and work_id:
            root = get_or_none(
                f"{OPENALEX_WORK_BASE}/{work_id}?select={_SELECT}"
            )

        if not found(root) and title:
            root = _lookup_by_title(title, fetch)
    except Exception as error:
        return {
            "ok": False,
            "reason": "lookup_failed",
            "detail": str(error),
        }

    if not isinstance(root, dict) or not root.get("id"):
        return {"ok": False, "reason": "lookup_failed"}

    reference_ids = [
        _WORK_ID.search(str(work_id)).group(1)
        for work_id in (root.get("referenced_works") or [])[
            :max_references
        ]
        if _WORK_ID.search(str(work_id))
    ]

    prior_raw = _fetch_details(reference_ids, fetch)

    prior_works = [
        entry
        for work in prior_raw
        if (entry := _work_entry(work))
    ]
    prior_works.sort(
        key=lambda work: (
            -(work["cited_by_count"] or 0),
            work["work_id"],
        )
    )

    derivative_works: list[dict] = []

    # OpenAlex dropped the cited_by_api_url field, so citers come
    # from the filter endpoint: works?filter=cites:W…
    root_entry = _work_entry(root)

    citer_raw: list[dict] = []

    if root_entry:
        citers_url = (
            f"{OPENALEX_WORK_BASE}"
            f"?filter=cites:{root_entry['work_id']}"
            f"&per-page={max_citers}&select={_SELECT}"
        )

        try:
            page = fetch(citers_url)
            citer_raw = [
                work
                for work in (page.get("results") or [])[:max_citers]
                if _WORK_ID.search(str(work.get("id") or ""))
            ]
        except Exception:
            citer_raw = []

    derivative_works = [
        entry
        for work in citer_raw
        if (entry := _work_entry(work))
    ]

    derivative_works.sort(
        key=lambda work: (
            -(work["cited_by_count"] or 0),
            work["work_id"],
        )
    )

    # Inter-work connection structure (co-reference, co-citation,
    # citer → prior links) from the reference lists already fetched.
    edges = _build_edges(
        prior_works,
        derivative_works,
        prior_raw,
        citer_raw,
    )

    return {
        "ok": True,
        "doi": (root_entry or {}).get("doi") or doi,
        "work_id": root_entry["work_id"] if root_entry else None,
        "prior_works": prior_works,
        "derivative_works": derivative_works,
        "edges": edges,
    }
