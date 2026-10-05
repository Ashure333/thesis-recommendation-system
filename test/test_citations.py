"""
Offline tests for P2-A: citation-based related items.

Everything is injected -- no network. The OpenAlex payloads are
hand-built fixtures, the similarity cases are hand-computed, and
the graph tests compare against the pre-P2-A formula.
"""

import unittest

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper, PaperCitation
from app.services import citations
from app.services import connected_graph
from app.services.recommendation.similarity import cosine_similarity

WEIGHTS = {
    "tfidf": 0.4,
    "sbert": 0.4,
    "metadata": 0.2,
}


def _paper(paper_id: int, title: str, doi=None, **fields) -> Paper:
    paper = Paper(id=paper_id, title=title, doi=doi)

    for name, value in fields.items():
        setattr(paper, name, value)

    return paper


def _entry(work_id: str, doi=None) -> dict:
    return {
        "id": f"https://openalex.org/{work_id}",
        "doi": doi,
    }


def _work(
    work_id: str = "W100",
    referenced_works=None,
    cited_by_api_url=None,
) -> dict:
    return {
        "id": f"https://openalex.org/{work_id}",
        "referenced_works": list(referenced_works or []),
        "cited_by_api_url": cited_by_api_url,
    }


class _CannedFetch:
    """fetch(url) over one work payload + one cited-by page."""

    def __init__(self, work: dict, citers: dict | None = None):
        self.work = work
        self.citers = citers or {}
        self.urls: list[str] = []

    def __call__(self, url: str) -> dict:
        self.urls.append(url)

        if "/works/doi:" in url:
            return self.work

        if url in self.citers:
            return self.citers[url]

        raise AssertionError(f"unexpected URL: {url}")


def _add_row(
    db,
    paper_id: int,
    direction: str,
    work_id: str,
    matched_paper_id=None,
    doi=None,
) -> None:
    db.add(
        PaperCitation(
            paper_id=paper_id,
            direction=direction,
            external_work_id=work_id,
            external_doi=doi,
            matched_paper_id=matched_paper_id,
        )
    )


class CitationHelpersTest(unittest.TestCase):
    def test_normalize_doi_strips_resolver_and_lowercases(self):
        self.assertEqual(
            citations.normalize_doi("https://dx.doi.org/10.1000/ABC"),
            "10.1000/abc",
        )
        self.assertEqual(
            citations.normalize_doi("http://doi.org/10.1000/Mixed"),
            "10.1000/mixed",
        )
        self.assertIsNone(citations.normalize_doi(None))
        self.assertIsNone(citations.normalize_doi("   "))

    def test_openalex_work_url(self):
        self.assertEqual(
            citations.openalex_work_url("https://doi.org/10.5/X"),
            "https://api.openalex.org/works/doi:10.5/x",
        )
        self.assertIsNone(citations.openalex_work_url(None))

    def test_work_ids_normalize_to_short_form(self):
        self.assertEqual(
            citations._normalize_work_id("https://openalex.org/W123"),
            "W123",
        )
        self.assertEqual(
            citations._normalize_work_id(
                "https://api.openalex.org/works/w123"
            ),
            "W123",
        )
        self.assertEqual(citations._normalize_work_id("w123"), "W123")
        self.assertIsNone(citations._normalize_work_id(None))


class PaperCitationModelTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.db.add(_paper(1, "One"))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_row_defaults(self):
        row = PaperCitation(
            paper_id=1,
            direction="cites",
            external_work_id="W1",
        )
        self.db.add(row)
        self.db.commit()

        self.assertIsNotNone(row.id)
        self.assertEqual(row.source, "openalex")
        self.assertIsNotNone(row.fetched_at)
        self.assertIsNone(row.external_doi)
        self.assertIsNone(row.matched_paper_id)

    def test_unique_constraint_blocks_duplicate_work(self):
        self._add(1, "cites", "W1")
        self._add(1, "cites", "W1")

        with self.assertRaises(IntegrityError):
            self.db.commit()

        self.db.rollback()

    def test_same_work_in_other_direction_is_allowed(self):
        self._add(1, "cites", "W1")
        self._add(1, "cited_by", "W1")
        self.assertEqual(self.db.query(PaperCitation).count(), 2)

    def _add(self, paper_id, direction, work_id):
        self.db.add(
            PaperCitation(
                paper_id=paper_id,
                direction=direction,
                external_work_id=work_id,
            )
        )


class RefreshPaperCitationsTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )()

        self.p1 = _paper(1, "One", doi="10.1000/one")
        self.p2 = _paper(2, "Two", doi="https://doi.org/10.1000/TWO")
        self.p3 = _paper(3, "Three", doi="10.1000/three")
        self.p4 = _paper(4, "Four", doi=None)

        self.db.add_all([self.p1, self.p2, self.p3, self.p4])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _fetch(self) -> _CannedFetch:
        work = _work(
            "W100",
            referenced_works=[
                "W200",
                "https://openalex.org/W300",
                None,
                "W200",
            ],
            cited_by_api_url=(
                "https://api.openalex.org/works"
                "?filter=cites:W100"
            ),
        )

        citers = {
            (
                "https://api.openalex.org/works?"
                "filter=cites:W100&per-page=200"
            ): {
                "results": [
                    _entry("W200", doi="https://doi.org/10.1000/TWO"),
                    _entry("W400", doi="10.1000/three"),
                    _entry("W500"),
                ]
            }
        }

        return _CannedFetch(work, citers)

    def test_refresh_stores_both_directions_and_matches_dois(self):
        fetch = self._fetch()

        result = citations.refresh_paper_citations(
            self.db,
            self.p1,
            fetch=fetch,
            max_cited_by=10,
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["cites"], 2)
        self.assertEqual(result["cited_by"], 3)
        self.assertEqual(result["matched"], 2)

        # First call resolves the DOI endpoint; second fetches the
        # citers page with per-page appended exactly once.
        self.assertEqual(
            fetch.urls[0],
            "https://api.openalex.org/works/doi:10.1000/one",
        )
        self.assertIn("per-page=200", fetch.urls[1])

        cite_rows = (
            self.db.query(PaperCitation)
            .filter_by(paper_id=1, direction="cites")
            .all()
        )
        self.assertEqual(
            sorted(row.external_work_id for row in cite_rows),
            ["W200", "W300"],
        )
        self.assertTrue(
            all(row.external_doi is None for row in cite_rows)
        )

        citer_rows = (
            self.db.query(PaperCitation)
            .filter_by(paper_id=1, direction="cited_by")
            .all()
        )
        matched = {
            row.external_work_id: row.matched_paper_id
            for row in citer_rows
        }
        self.assertEqual(matched["W200"], self.p2.id)
        self.assertEqual(matched["W400"], self.p3.id)
        self.assertIsNone(matched["W500"])

    def test_refresh_is_idempotent(self):
        citations.refresh_paper_citations(
            self.db, self.p1, fetch=self._fetch(), max_cited_by=10
        )
        first = self.db.query(PaperCitation).count()

        citations.refresh_paper_citations(
            self.db, self.p1, fetch=self._fetch(), max_cited_by=10
        )
        second = self.db.query(PaperCitation).count()

        self.assertEqual(first, 5)
        self.assertEqual(second, first)

    def test_refresh_replaces_previous_payload(self):
        first_work = _work("W100", referenced_works=["W200"])
        citations.refresh_paper_citations(
            self.db,
            self.p1,
            fetch=_CannedFetch(first_work),
        )

        second_work = _work(
            "W100",
            referenced_works=["W200", "W300", "W400"],
        )
        citations.refresh_paper_citations(
            self.db,
            self.p1,
            fetch=_CannedFetch(second_work),
        )

        rows = (
            self.db.query(PaperCitation)
            .filter_by(paper_id=1, direction="cites")
            .all()
        )
        self.assertEqual(
            sorted(row.external_work_id for row in rows),
            ["W200", "W300", "W400"],
        )

    def test_max_cited_by_limits_citer_rows(self):
        result = citations.refresh_paper_citations(
            self.db,
            self.p1,
            fetch=self._fetch(),
            max_cited_by=2,
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["cited_by"], 2)
        self.assertEqual(
            self.db.query(PaperCitation)
            .filter_by(paper_id=1, direction="cited_by")
            .count(),
            2,
        )

    def test_referenced_work_dict_with_doi_is_matched(self):
        work = _work(
            "W100",
            referenced_works=[
                {"id": "https://openalex.org/W200", "doi": "10.1000/TWO"},
            ],
        )

        result = citations.refresh_paper_citations(
            self.db,
            self.p1,
            fetch=_CannedFetch(work),
        )

        self.assertEqual(result["matched"], 1)
        row = (
            self.db.query(PaperCitation)
            .filter_by(paper_id=1, direction="cites")
            .one()
        )
        self.assertEqual(row.matched_paper_id, self.p2.id)
        self.assertEqual(row.external_doi, "10.1000/two")

    def test_missing_doi_is_reported_without_fetching(self):
        fetch = self._fetch()

        result = citations.refresh_paper_citations(
            self.db, self.p4, fetch=fetch
        )

        self.assertEqual(result, {"ok": False, "reason": "no_doi"})
        self.assertEqual(fetch.urls, [])

    def test_network_failure_returns_not_ok(self):
        def failing_fetch(url):
            raise OSError("offline")

        result = citations.refresh_paper_citations(
            self.db, self.p1, fetch=failing_fetch
        )

        self.assertFalse(result["ok"])
        self.assertTrue(result["reason"].startswith("fetch_failed"))

    def test_unresolvable_work_returns_not_ok(self):
        result = citations.refresh_paper_citations(
            self.db,
            self.p1,
            fetch=lambda url: {},
        )

        self.assertEqual(result, {"ok": False, "reason": "work_not_found"})

    def test_citer_failure_keeps_references_and_warns(self):
        work = _work(
            "W100",
            referenced_works=["W200"],
            cited_by_api_url="https://api.openalex.org/works?x=1",
        )

        def fetch(url):
            if "/works/doi:" in url:
                return work
            raise OSError("offline")

        result = citations.refresh_paper_citations(
            self.db, self.p1, fetch=fetch
        )

        self.assertTrue(result["ok"])
        self.assertIn("warning", result)
        self.assertEqual(result["cites"], 1)
        self.assertEqual(result["cited_by"], 0)

    def test_citation_stats(self):
        citations.refresh_paper_citations(
            self.db, self.p1, fetch=self._fetch(), max_cited_by=10
        )
        citations.refresh_paper_citations(
            self.db, self.p2, fetch=self._fetch(), max_cited_by=10
        )

        stats = citations.citation_stats(self.db)

        self.assertEqual(stats["by_direction"]["cites"], 4)
        self.assertEqual(stats["by_direction"]["cited_by"], 6)
        self.assertEqual(stats["matched"], 4)
        self.assertEqual(stats["papers_with_doi"], 3)


class CitationSimilarityTest(unittest.TestCase):
    """
    Fixture (hand-computed expected scores):

        references: p1={A,B,C}  p2={A,B,D}  p3={B}  p4={}
        citers:     p1={X}      p2={X,Y}    p3={Y}  p4={}

        (1,2): refs 2/3, citers 1/1 -> 0.5*2/3 + 0.5 = 0.8333...
        (1,3): refs 1/1, citers 0   -> 0.5
        (2,3): refs 1/1, citers 1/1 -> 1.0
    """

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )()

        self.db.add_all(
            [
                _paper(1, "One"),
                _paper(2, "Two"),
                _paper(3, "Three"),
                _paper(4, "Four"),
            ]
        )

        for work_id in ("A", "B", "C"):
            _add_row(self.db, 1, "cites", work_id)

        for work_id in ("A", "B", "D"):
            _add_row(self.db, 2, "cites", work_id)

        for work_id in ("B",):
            _add_row(self.db, 3, "cites", work_id)

        _add_row(self.db, 1, "cited_by", "X")
        _add_row(self.db, 2, "cited_by", "X")
        _add_row(self.db, 2, "cited_by", "Y")
        _add_row(self.db, 3, "cited_by", "Y")

        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_citation_maps_load_both_directions(self):
        references, citers = citations.citation_maps(self.db)

        self.assertEqual(references[1], {"A", "B", "C"})
        self.assertEqual(citers[2], {"X", "Y"})
        self.assertNotIn(4, references)
        self.assertNotIn(4, citers)

    def test_similarity_matches_hand_computed_scores(self):
        scores = citations.citation_similarity(self.db)

        self.assertAlmostEqual(scores[(1, 2)], 0.5 * (2 / 3) + 0.5, places=6)
        self.assertAlmostEqual(scores[(1, 3)], 0.5, places=6)
        self.assertAlmostEqual(scores[(2, 3)], 1.0, places=6)
        self.assertNotIn((1, 4), scores)
        self.assertNotIn((2, 4), scores)
        self.assertNotIn((3, 4), scores)

    def test_related_by_citation_orders_best_first(self):
        related = citations.related_by_citation(self.db, 1)

        self.assertEqual([paper_id for paper_id, _ in related], [2, 3])
        self.assertAlmostEqual(related[0][1], 5 / 6, places=6)
        self.assertAlmostEqual(related[1][1], 0.5, places=6)

        top_one = citations.related_by_citation(self.db, 1, top_k=1)
        self.assertEqual([paper_id for paper_id, _ in top_one], [2])

    def test_restricted_paper_ids_filter_pairs(self):
        scores = citations.citation_similarity(
            self.db,
            paper_ids=[1, 3],
        )

        self.assertEqual(list(scores), [(1, 3)])

    def test_local_matched_keys_couple_different_external_ids(self):
        # A fresh fixture: both papers cite *different* OpenAlex ids
        # that resolve to the same local paper (id 3), so only the
        # "local:<id>" union key can couple them.
        self.db.query(PaperCitation).delete()
        self.db.commit()

        _add_row(
            self.db, 1, "cites", "W100",
            matched_paper_id=3, doi="10.1000/three",
        )
        _add_row(
            self.db, 2, "cites", "W900",
            matched_paper_id=3, doi="10.1000/three",
        )
        self.db.commit()

        references, _ = citations.citation_maps(self.db)

        self.assertEqual(references[1], {"W100", "local:3"})
        self.assertEqual(references[2], {"W900", "local:3"})

        scores = citations.citation_similarity(self.db)

        # coupling: shared {local:3} / min(2, 2) = 0.5, no citers
        self.assertAlmostEqual(scores[(1, 2)], 0.25, places=6)


class ConnectedGraphCitationTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )()

        # Disjoint titles -> metadata ~ 0, no vectors/authors/topics,
        # so any edge (2,3) crossing MIN_EDGE_WEIGHT comes from the
        # citation term.
        self.seed = _paper(1, "Alpha beta", doi="10.1/a")
        self.p2 = _paper(2, "Gamma delta", doi="10.1/b")
        self.p3 = _paper(3, "Epsilon zeta", doi="10.1/c")

        self.db.add_all([self.seed, self.p2, self.p3])
        self.db.commit()

        self.papers = [self.seed, self.p2, self.p3]

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _build(self, **extra):
        return connected_graph.build_connected_graph(
            seed=self.seed,
            papers=self.papers,
            pipeline="custom",
            weights=WEIGHTS,
            **extra,
        )

    def test_pair_weight_zero_citation_matches_legacy_formula(self):
        vectors = {
            1: {"tfidf": [1.0, 0.0], "sbert": [1.0, 0.0]},
            2: {"tfidf": [1.0, 0.0], "sbert": [0.0, 1.0]},
        }
        names = {1: {"smith"}, 2: {"smith"}}

        legacy = round(
            max(
                0.0,
                min(
                    1.0,
                    0.4 * cosine_similarity([1.0, 0.0], [1.0, 0.0])
                    + 0.4 * cosine_similarity([1.0, 0.0], [0.0, 1.0])
                    + 0.2 * 0.5
                    + 0.15 * 1.0,
                ),
            ),
            4,
        )

        without_argument = connected_graph._pair_weight(
            paper_a=self.seed,
            paper_b=self.p2,
            weights=WEIGHTS,
            vectors=vectors,
            names=names,
            metadata_score=0.5,
        )
        with_zero = connected_graph._pair_weight(
            paper_a=self.seed,
            paper_b=self.p2,
            weights=WEIGHTS,
            vectors=vectors,
            names=names,
            metadata_score=0.5,
            citation_score=0.0,
        )

        self.assertEqual(without_argument, legacy)
        self.assertEqual(with_zero, legacy)

    def test_pair_weight_adds_quarter_of_citation_score(self):
        vectors = {
            1: {"tfidf": None, "sbert": None},
            2: {"tfidf": None, "sbert": None},
        }
        names = {1: set(), 2: set()}

        weight = connected_graph._pair_weight(
            paper_a=self.seed,
            paper_b=self.p2,
            weights=WEIGHTS,
            vectors=vectors,
            names=names,
            metadata_score=0.1,
            citation_score=0.4,
        )

        self.assertEqual(weight, round(0.2 * 0.1 + 0.25 * 0.4, 4))

    def test_pair_weight_clamps_to_one(self):
        vectors = {
            1: {"tfidf": None, "sbert": None},
            2: {"tfidf": None, "sbert": None},
        }
        names = {1: set(), 2: set()}

        weight = connected_graph._pair_weight(
            paper_a=self.seed,
            paper_b=self.p2,
            weights={"tfidf": 0.0, "sbert": 0.0, "metadata": 1.0},
            vectors=vectors,
            names=names,
            metadata_score=1.0,
            citation_score=1.0,
        )

        self.assertEqual(weight, 1.0)

    def test_graph_identical_when_no_citation_rows(self):
        without_db = self._build()
        with_empty_cache = self._build(db=self.db)

        self.assertEqual(without_db["edges"], with_empty_cache["edges"])
        self.assertEqual(
            without_db["path_lengths"],
            with_empty_cache["path_lengths"],
        )
        self.assertEqual(
            without_db["common_authors"],
            with_empty_cache["common_authors"],
        )
        self.assertEqual(
            without_db["common_topics"],
            with_empty_cache["common_topics"],
        )
        self.assertEqual(with_empty_cache["common_references"], [])
        self.assertEqual(with_empty_cache["common_citers"], [])

        # The uncertain pair (2,3) never gains an edge from nothing.
        self.assertNotIn(
            [2, 3, 0.0],
            [edge for edge in with_empty_cache["edges"]],
        )

    def test_coupling_adds_edge_and_common_groups(self):
        before = self._build(db=self.db)
        before_pairs = {
            (left, right) for left, right, _ in before["edges"]
        }
        self.assertNotIn((2, 3), before_pairs)

        # p2 and p3 share one reference and one citer -> combined
        # similarity 1.0 -> weight 0.25, above MIN_EDGE_WEIGHT.
        _add_row(self.db, 2, "cites", "W500")
        _add_row(self.db, 3, "cites", "W500")
        _add_row(self.db, 2, "cited_by", "W600")
        _add_row(self.db, 3, "cited_by", "W600")
        self.db.commit()

        # No db argument: the builder derives the session from the
        # attached seed, which is the api.py call path.
        after = self._build()
        edge_map = {
            (left, right): weight
            for left, right, weight in after["edges"]
        }

        self.assertEqual(edge_map[(2, 3)], 0.25)
        self.assertEqual(
            after["common_references"],
            [
                {
                    "name": "W500",
                    "mentions": [2, 3],
                    "edges_count": 2,
                }
            ],
        )
        self.assertEqual(
            after["common_citers"],
            [
                {
                    "name": "W600",
                    "mentions": [2, 3],
                    "edges_count": 2,
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
