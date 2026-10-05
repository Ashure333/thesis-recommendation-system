"""
Query relevance judgments (qrels) for offline recommendation evaluation.

A qrels document is a JSON object with a single top-level ``queries``
list. Each query is one of two kinds:

    {"kind": "seed", "seed_paper_id": 123, "relevance": {"17": 2, "22": 1}}
    {"kind": "text", "query": "graph neural networks", "relevance": {"9": 1}}

Relevance keys are repository paper ids (JSON keys are strings, so they
are parsed back to ints). Grades are non-negative integers; 0 means
"judged not relevant", 1 is a relevant document, and 2 or more is a
strongly relevant document such as a co-cited work.

``build_qrels_from_openalex`` is a best-effort builder: it fetches
OpenAlex works for a list of DOIs, caches every response on disk, and
derives judgments from ``referenced_works`` (grade 1) and citing works
(grade 1, upgraded to 2 when a work both cites the seed and is cited by
it). Network failures never raise out of the helper; they are returned
as a structured failure summary.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

QUERY_KIND_SEED = "seed"
QUERY_KIND_TEXT = "text"
QUERY_KINDS = (QUERY_KIND_SEED, QUERY_KIND_TEXT)

OPENALEX_WORK_URL = "https://api.openalex.org/works/https://doi.org"
OPENALEX_CITES_URL = "https://api.openalex.org/works"

DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_MAX_CITING_WORKS = 200

Grade = int


class QrelsError(Exception):
    """
    Base class for qrels loading / writing failures.
    """


class QrelsValidationError(QrelsError, ValueError):
    """
    The qrels document is structurally invalid.

    Subclasses both QrelsError (so callers can catch the family) and
    ValueError (so argument-style handling also works).
    """


@dataclass
class QrelsQuery:
    """
    One evaluation query and its judged documents.

    ``kind`` selects which search input the runner uses:
    ``seed_paper_id`` for seed queries, ``query`` for text queries.
    ``relevance`` maps paper id -> grade.
    """

    kind: str
    relevance: dict[int, Grade]
    seed_paper_id: int | None = None
    query: str | None = None

    @property
    def label(self) -> str:
        if self.kind == QUERY_KIND_SEED:
            return f"seed:{self.seed_paper_id}"

        return f"text:{self.query}"

    def to_dict(self) -> dict:
        payload: dict = {
            "kind": self.kind,
            "relevance": {
                str(paper_id): grade
                for paper_id, grade in sorted(self.relevance.items())
            },
        }

        if self.kind == QUERY_KIND_SEED:
            payload["seed_paper_id"] = self.seed_paper_id
        else:
            payload["query"] = self.query

        return payload


@dataclass
class Qrels:
    """
    An ordered collection of qrels queries.
    """

    queries: list[QrelsQuery]

    def __len__(self) -> int:
        return len(self.queries)

    def __iter__(self):
        return iter(self.queries)

    def to_dict(self) -> dict:
        return {
            "queries": [query.to_dict() for query in self.queries]
        }


def _parse_paper_id(raw_id, index: int) -> int:
    """
    JSON object keys are always strings; accept ints too for callers
    that build qrels in memory.
    """

    if isinstance(raw_id, bool):
        paper_id = None
    elif isinstance(raw_id, int):
        paper_id = raw_id
    elif isinstance(raw_id, str) and raw_id.strip():
        try:
            paper_id = int(raw_id.strip())
        except ValueError:
            paper_id = None
    else:
        paper_id = None

    if paper_id is None or paper_id <= 0:
        raise QrelsValidationError(
            f"query {index}: relevance id {raw_id!r} is not a "
            "positive integer paper id."
        )

    return paper_id


def _parse_grade(raw_grade, index: int, raw_id) -> Grade:
    if (
        isinstance(raw_grade, bool)
        or not isinstance(raw_grade, int)
        or raw_grade < 0
    ):
        raise QrelsValidationError(
            f"query {index}: relevance grade for {raw_id!r} must be a "
            f"non-negative integer, got {raw_grade!r}."
        )

    return raw_grade


def _parse_query(index: int, raw_query) -> QrelsQuery:
    if not isinstance(raw_query, dict):
        raise QrelsValidationError(
            f"query {index}: each entry must be a JSON object."
        )

    kind = raw_query.get("kind")

    if kind not in QUERY_KINDS:
        raise QrelsValidationError(
            f"query {index}: 'kind' must be one of "
            f"{QUERY_KINDS}, got {kind!r}."
        )

    raw_relevance = raw_query.get("relevance")

    if not isinstance(raw_relevance, dict):
        raise QrelsValidationError(
            f"query {index}: 'relevance' must be an object mapping "
            "paper ids to grades."
        )

    relevance: dict[int, Grade] = {}

    for raw_id, raw_grade in raw_relevance.items():
        paper_id = _parse_paper_id(raw_id, index)
        grade = _parse_grade(raw_grade, index, raw_id)
        relevance[paper_id] = max(
            relevance.get(paper_id, 0),
            grade,
        )

    if not relevance:
        raise QrelsValidationError(
            f"query {index}: 'relevance' must contain at least one "
            "judged paper."
        )

    if kind == QUERY_KIND_SEED:
        seed_paper_id = raw_query.get("seed_paper_id")

        if (
            isinstance(seed_paper_id, bool)
            or not isinstance(seed_paper_id, int)
            or seed_paper_id <= 0
        ):
            raise QrelsValidationError(
                f"query {index}: seed queries require a positive "
                f"integer 'seed_paper_id', got {seed_paper_id!r}."
            )

        return QrelsQuery(
            kind=QUERY_KIND_SEED,
            relevance=relevance,
            seed_paper_id=seed_paper_id,
        )

    query_text = raw_query.get("query")

    if not isinstance(query_text, str) or not query_text.strip():
        raise QrelsValidationError(
            f"query {index}: text queries require a non-empty "
            f"'query' string, got {query_text!r}."
        )

    return QrelsQuery(
        kind=QUERY_KIND_TEXT,
        relevance=relevance,
        query=query_text.strip(),
    )


def qrels_from_dict(
    document,
    source: str = "<memory>",
) -> Qrels:
    """
    Validate an already-parsed qrels document.

    Raises QrelsValidationError with the offending query index in the
    message.
    """

    if not isinstance(document, dict):
        raise QrelsValidationError(
            f"{source}: the qrels document must be a JSON object."
        )

    raw_queries = document.get("queries")

    if not isinstance(raw_queries, list):
        raise QrelsValidationError(
            f"{source}: 'queries' must be a JSON list."
        )

    if not raw_queries:
        raise QrelsValidationError(
            f"{source}: 'queries' must contain at least one query."
        )

    queries = [
        _parse_query(index, raw_query)
        for index, raw_query in enumerate(raw_queries)
    ]

    return Qrels(queries=queries)


def load_qrels(path: str | os.PathLike) -> Qrels:
    """
    Load and validate a qrels JSON file.

    Raises QrelsError when the file cannot be read and
    QrelsValidationError when its contents are malformed.
    """

    path = Path(path)

    if not path.is_file():
        raise QrelsError(f"Qrels file not found: {path}")

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise QrelsError(
            f"Could not read qrels file {path}: {exc}"
        ) from exc

    try:
        document = json.loads(text)
    except json.JSONDecodeError as exc:
        raise QrelsValidationError(
            f"Malformed JSON in {path}: {exc}"
        ) from exc

    return qrels_from_dict(document, source=str(path))


def save_qrels(
    qrels: Qrels | Sequence[QrelsQuery],
    path: str | os.PathLike,
) -> Path:
    """
    Write a qrels file with stable, indented formatting.

    Accepts either a Qrels object or a plain sequence of QrelsQuery.
    """

    if isinstance(qrels, Qrels):
        document = qrels.to_dict()
    elif isinstance(qrels, (list, tuple)):
        document = {
            "queries": [query.to_dict() for query in qrels]
        }
    else:
        raise TypeError(
            "save_qrels expects a Qrels object or a sequence of "
            "QrelsQuery."
        )

    path = Path(path)

    try:
        if path.parent and not path.parent.exists():
            path.parent.mkdir(parents=True, exist_ok=True)

        path.write_text(
            json.dumps(document, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        raise QrelsError(
            f"Could not write qrels file {path}: {exc}"
        ) from exc

    return path


# ---------------------------------------------------------------------
# Best-effort OpenAlex building
# ---------------------------------------------------------------------


def normalize_doi(value: str) -> str:
    """
    Lower-case a DOI and strip any URL prefix so cache keys and
    comparisons are stable.
    """

    text = (value or "").strip()

    for prefix in (
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
        "doi:",
    ):
        if text.lower().startswith(prefix):
            text = text[len(prefix):]
            break

    return text.strip().lower()


def _cache_path(cache_dir: Path, category: str, key: str) -> Path:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", key).strip("_")[:60]

    return cache_dir / category / f"{slug}-{digest}.json"


def _read_cache(path: Path):
    if not path.is_file():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    if not isinstance(data, dict):
        return None

    return data


def _write_cache(path: Path, data) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".tmp")
        temporary.write_text(
            json.dumps(data, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(temporary, path)
    except (OSError, TypeError, ValueError):
        logger.debug("[qrels] could not cache response at %s", path)


def _default_fetch_json(url: str, timeout: float):
    import requests

    from app.services.pdf_finder import UNPAYWALL_CONTACT_EMAIL

    response = requests.get(
        url,
        params={"mailto": UNPAYWALL_CONTACT_EMAIL},
        headers={"User-Agent": "PaperRec/1.0 (offline evaluation)"},
        timeout=timeout,
    )
    response.raise_for_status()

    return response.json()


def _fetch_cached(
    *,
    fetch: Callable[[str, float], object],
    url: str,
    cache_path: Path,
    timeout: float,
    summary: dict,
    stage: str,
    doi: str,
):
    """
    Return (data, from_cache) or (None, False) on failure, recording
    the failure in ``summary`` instead of raising.
    """

    cached = _read_cache(cache_path)

    if cached is not None:
        return cached, True

    try:
        data = fetch(url, timeout)
    except Exception as exc:  # noqa: BLE001 - best-effort by contract
        summary["failures"].append(
            {
                "doi": doi,
                "stage": stage,
                "error": f"{type(exc).__name__}: {exc}",
            }
        )
        return None, False

    if not isinstance(data, dict):
        summary["failures"].append(
            {
                "doi": doi,
                "stage": stage,
                "error": "OpenAlex returned a non-object payload.",
            }
        )
        return None, False

    _write_cache(cache_path, data)

    return data, False


def _openalex_work_id(work: Mapping) -> str | None:
    raw_id = work.get("id")

    if not isinstance(raw_id, str) or not raw_id:
        return None

    return raw_id.rstrip("/")


def _openalex_numeric_id(raw_id: str) -> int | None:
    tail = raw_id.rstrip("/").rsplit("/", 1)[-1]

    if tail[:1].upper() == "W":
        tail = tail[1:]

    if not tail.isdigit():
        return None

    return int(tail)


def _work_doi(work: Mapping) -> str | None:
    raw_doi = work.get("doi")

    if isinstance(raw_doi, str) and raw_doi.strip():
        return normalize_doi(raw_doi)

    return None


def _target_paper_id(
    work_id: str,
    target_doi: str,
    doi_to_paper_id: Mapping[str, int] | None,
) -> int | None:
    """
    Translate a referenced / citing OpenAlex work into a qrels key.

    When a DOI -> Paper.id mapping is supplied, only mapped works are
    kept (the judgments must point at real local papers). Without a
    mapping, the OpenAlex work id number is used as a stand-in key so
    the output is still structurally valid qrels.
    """

    if doi_to_paper_id is not None:
        return doi_to_paper_id.get(target_doi)

    return _openalex_numeric_id(work_id)


def _citing_works_url(work: Mapping) -> str | None:
    raw_url = work.get("cited_by_api_url")

    if isinstance(raw_url, str) and raw_url.strip():
        return raw_url.strip()

    work_id = _openalex_work_id(work)

    if work_id is None:
        return None

    return (
        f"{OPENALEX_CITES_URL}"
        f"?filter=cites:{work_id.rsplit('/', 1)[-1]}"
    )


def _query_for_doi(
    doi: str,
    work: Mapping,
    doi_to_paper_id: Mapping[str, int] | None,
    relevance: dict[int, Grade],
) -> QrelsQuery:
    if doi_to_paper_id is not None and doi in doi_to_paper_id:
        return QrelsQuery(
            kind=QUERY_KIND_SEED,
            relevance=relevance,
            seed_paper_id=doi_to_paper_id[doi],
        )

    title = work.get("title") or work.get("display_name") or doi

    return QrelsQuery(
        kind=QUERY_KIND_TEXT,
        relevance=relevance,
        query=str(title).strip(),
    )


def _merge_query(
    existing: dict[str, QrelsQuery],
    new_query: QrelsQuery,
) -> None:
    previous = existing.get(new_query.label)

    if previous is None:
        existing[new_query.label] = new_query
        return

    merged = dict(previous.relevance)

    for paper_id, grade in new_query.relevance.items():
        merged[paper_id] = max(merged.get(paper_id, 0), grade)

    existing[new_query.label] = QrelsQuery(
        kind=new_query.kind,
        relevance=merged,
        seed_paper_id=new_query.seed_paper_id,
        query=new_query.query,
    )


def build_qrels_from_openalex(
    dois: Sequence[str],
    cache_dir: str | os.PathLike,
    output_path: str | os.PathLike | None = None,
    *,
    doi_to_paper_id: Mapping[str, int] | None = None,
    include_references: bool = True,
    include_citations: bool = True,
    max_citing_works: int = DEFAULT_MAX_CITING_WORKS,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    fetch_json: Callable[[str, float], object] | None = None,
) -> dict:
    """
    Build (and optionally merge/save) qrels from OpenAlex works.

    ``dois`` are the seed papers. Each work's ``referenced_works``
    become grade-1 judgments and works citing it become grade-1
    judgments, upgraded to grade 2 when the same work is both cited by
    the seed and cites the seed. Only works inside ``dois`` are kept as
    targets, so the result is closed over the corpus being evaluated.

    ``doi_to_paper_id`` maps input DOIs to local Paper ids. Pass it to
    get directly usable seed queries; without it the helper emits text
    queries (the OpenAlex title) and OpenAlex numeric ids as stand-in
    keys.

    Every response is cached under ``cache_dir``. Network and JSON
    failures are collected into ``failures`` in the returned summary;
    no exception escapes this function. Returns a JSON-serializable
    summary with ``ok``, ``qrels``, counts, and ``error``.
    """

    summary = {
        "ok": False,
        "output_path": str(output_path) if output_path else None,
        "qrels": None,
        "query_count": 0,
        "judgment_count": 0,
        "fetched": 0,
        "cached": 0,
        "failures": [],
        "error": None,
    }

    try:
        _build_qrels_from_openalex(
            dois=list(dois or []),
            cache_dir=Path(cache_dir),
            output_path=output_path,
            doi_to_paper_id=doi_to_paper_id,
            include_references=include_references,
            include_citations=include_citations,
            max_citing_works=max_citing_works,
            timeout=timeout,
            fetch_json=fetch_json or _default_fetch_json,
            summary=summary,
        )
    except Exception as exc:  # noqa: BLE001 - best-effort by contract
        logger.warning("[qrels] OpenAlex build failed: %s", exc)
        summary["ok"] = False
        summary["error"] = f"{type(exc).__name__}: {exc}"

    return summary


def _build_qrels_from_openalex(
    *,
    dois: Sequence[str],
    cache_dir: Path,
    output_path: str | os.PathLike | None,
    doi_to_paper_id: Mapping[str, int] | None,
    include_references: bool,
    include_citations: bool,
    max_citing_works: int,
    timeout: float,
    fetch_json: Callable[[str, float], object],
    summary: dict,
) -> None:
    normalized_dois: list[str] = []
    seen: set[str] = set()

    for raw_doi in dois:
        if not isinstance(raw_doi, str):
            continue

        doi = normalize_doi(raw_doi)

        if not doi or doi in seen:
            continue

        seen.add(doi)
        normalized_dois.append(doi)

    if not normalized_dois:
        raise ValueError("At least one DOI is required.")

    mapping: dict[str, int] | None = None

    if doi_to_paper_id is not None:
        mapping = {
            normalize_doi(doi): int(paper_id)
            for doi, paper_id in doi_to_paper_id.items()
        }

    works: dict[str, dict] = {}

    for doi in normalized_dois:
        work, from_cache = _fetch_cached(
            fetch=fetch_json,
            url=f"{OPENALEX_WORK_URL}/{doi}",
            cache_path=_cache_path(cache_dir, "works", doi),
            timeout=timeout,
            summary=summary,
            stage="work",
            doi=doi,
        )

        if work is None:
            continue

        works[doi] = work
        summary["cached" if from_cache else "fetched"] += 1

    if not works:
        raise RuntimeError(
            "No OpenAlex works could be fetched for the given DOIs."
        )

    doi_by_work_id: dict[str, str] = {}

    for doi, work in works.items():
        work_id = _openalex_work_id(work)

        if work_id is not None:
            doi_by_work_id[work_id] = doi

    queries: dict[str, QrelsQuery] = {}

    for doi in normalized_dois:
        work = works.get(doi)

        if work is None:
            continue

        work_id = _openalex_work_id(work)
        referenced_ids = {
            str(reference).rstrip("/")
            for reference in (work.get("referenced_works") or [])
        }
        relevance: dict[int, Grade] = {}

        if include_references:
            for reference_id in referenced_ids:
                target_doi = doi_by_work_id.get(reference_id)

                if target_doi is None or target_doi == doi:
                    continue

                paper_id = _target_paper_id(
                    reference_id,
                    target_doi,
                    mapping,
                )

                if paper_id is None:
                    continue

                relevance[paper_id] = max(
                    relevance.get(paper_id, 0),
                    1,
                )

        if include_citations and work_id is not None:
            cites_url = _citing_works_url(work)

            if cites_url:
                page = _fetch_cached(
                    fetch=fetch_json,
                    url=cites_url,
                    cache_path=_cache_path(
                        cache_dir,
                        "cited_by",
                        work_id,
                    ),
                    timeout=timeout,
                    summary=summary,
                    stage="cited_by",
                    doi=doi,
                )[0]

                if page is not None:
                    results = page.get("results") or []

                    for item in results[:max_citing_works]:
                        if not isinstance(item, dict):
                            continue

                        item_id = _openalex_work_id(item)

                        if item_id is None:
                            continue

                        target_doi = doi_by_work_id.get(item_id)

                        if target_doi is None or target_doi == doi:
                            continue

                        paper_id = _target_paper_id(
                            item_id,
                            target_doi,
                            mapping,
                        )

                        if paper_id is None:
                            continue

                        grade = (
                            2
                            if item_id in referenced_ids
                            else 1
                        )
                        relevance[paper_id] = max(
                            relevance.get(paper_id, 0),
                            grade,
                        )

        if not relevance:
            continue

        query = _query_for_doi(doi, work, mapping, relevance)
        _merge_query(queries, query)

    if not queries:
        raise RuntimeError(
            "No relevance judgments could be derived from the fetched "
            "works. Check that the DOIs reference or cite each other."
        )

    merged: dict[str, QrelsQuery] = {}

    if output_path is not None and Path(output_path).is_file():
        for existing_query in load_qrels(output_path).queries:
            merged[existing_query.label] = existing_query

    for query in queries.values():
        _merge_query(merged, query)

    qrels = Qrels(queries=list(merged.values()))

    if output_path is not None:
        save_qrels(qrels, output_path)
        summary["output_path"] = str(output_path)

    summary["qrels"] = qrels.to_dict()
    summary["query_count"] = len(qrels)
    summary["judgment_count"] = sum(
        len(query.relevance) for query in qrels
    )
    summary["ok"] = True
