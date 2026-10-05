"""
Tests for the P1-A SQLite FTS5 ranked repository search.

Run from the project root:

    .venv/bin/python -m unittest test.test_fts_search -v

FTS-specific assertions are skipped when the local SQLite build has no
FTS5 module; the graceful-fallback coverage always runs.
"""

import os
import tempfile
import unittest
from datetime import datetime
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.repositories import queries
from app.repositories.queries import filter_papers
from app.services import fts_search


class FtsSearchTestCase(unittest.TestCase):
    """Fresh temp-file database shared by each FTS test."""

    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        db_path = os.path.join(self._temp_dir.name, "fts_search_test.db")

        self.engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(bind=self.engine)

        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self._seed_papers()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self._temp_dir.cleanup()

    def _seed_papers(self):
        # One paper has the term only in the title, one only in the
        # abstract, and one is unrelated. Explicit created_at values
        # keep the date_added ordering deterministic.
        self.title_match = Paper(
            title="Neural ranking for scholarly search",
            author="Alice Researcher",
            abstract="A study of learning to rank over document collections.",
            keywords="ranking, search",
            subject_category="Computer Science: Information Retrieval",
            document_type="Journal Article",
            publication_year=2024,
            created_at=datetime(2024, 1, 1),
        )
        self.abstract_match = Paper(
            title="A survey of storage engines",
            author="Bob Writer",
            abstract="The final section covers neural ranking baselines.",
            keywords="databases",
            subject_category="Computer Science: Databases",
            document_type="Conference Paper",
            publication_year=2023,
            created_at=datetime(2024, 1, 2),
        )
        self.unrelated = Paper(
            title="Reef ecology field notes",
            author="Carol Diver",
            abstract="Coral growth rates around the lagoon.",
            keywords="biology",
            subject_category="Life Sciences: Ecology",
            document_type="Journal Article",
            publication_year=2022,
            created_at=datetime(2024, 1, 3),
        )

        self.db.add_all(
            [
                self.title_match,
                self.abstract_match,
                self.unrelated,
            ]
        )
        self.db.commit()

    def _require_fts(self):
        if not fts_search.fts_available(self.engine):
            self.skipTest("SQLite build has no FTS5 support")

    def test_sanitize_query_neutralizes_operators_and_never_raises(self):
        weird = '"quoted" AND (weird:* -not'
        sanitized = fts_search.sanitize_query(weird)

        self.assertIsInstance(sanitized, str)
        self.assertIn('"quoted"', sanitized)
        self.assertIn('"weird"', sanitized)

        # The whole query path must survive the same hostile input.
        self.assertEqual(
            filter_papers(self.db, search=weird, sort_by="relevance"),
            [],
        )

        for hostile in (
            "",
            "   ",
            "***",
            "((((",
            ":",
            "-",
            "AND OR NOT",
            "机器学习 推荐",
        ):
            with self.subTest(query=hostile):
                self.assertIsInstance(
                    fts_search.sanitize_query(hostile),
                    str,
                )

        self.assertEqual(fts_search.sanitize_query(""), "")
        self.assertEqual(fts_search.sanitize_query("learn*"), '"learn"*')
        self.assertEqual(
            fts_search.sanitize_query("learn"),
            '"learn"*',
        )
        self.assertEqual(
            fts_search.sanitize_query("graph neural"),
            '"graph" AND "neural"*',
        )
        self.assertIn('"机器学习"', fts_search.sanitize_query("机器学习"))

    def test_relevance_puts_title_match_first_and_attaches_snippet(self):
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        results = filter_papers(
            self.db,
            search="neural",
            sort_by="relevance",
        )

        self.assertEqual(
            [paper.id for paper in results],
            [self.title_match.id, self.abstract_match.id],
        )

        title_snippet = results[0].search_snippet
        self.assertIsNotNone(title_snippet)
        self.assertIn("neural", title_snippet.lower())

        abstract_snippet = results[1].search_snippet
        self.assertIsNotNone(abstract_snippet)
        self.assertIn("neural", abstract_snippet.lower())

    def test_ensure_is_idempotent_and_triggers_keep_index_in_sync(self):
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        added = Paper(
            title="Neural networks for text",
            author="Dana Author",
            abstract="Deep models for retrieval.",
            keywords=None,
            created_at=datetime(2024, 2, 1),
        )
        self.db.add(added)
        self.db.commit()

        found = filter_papers(
            self.db,
            search="neural networks",
            sort_by="relevance",
        )
        self.assertEqual([paper.id for paper in found], [added.id])

        # The UPDATE trigger must drop the old title from the index.
        added.title = "Graph networks for text"
        self.db.commit()

        stale = filter_papers(
            self.db,
            search="neural networks",
            sort_by="relevance",
        )
        self.assertEqual(stale, [])

        # The DELETE trigger must remove the row from the index.
        self.db.delete(added)
        self.db.commit()

        deleted = filter_papers(
            self.db,
            search="graph networks",
            sort_by="relevance",
        )
        self.assertEqual(deleted, [])

    def test_relevance_respects_sidebar_filters(self):
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        results = filter_papers(
            self.db,
            search="neural",
            subject="Databases",
            sort_by="relevance",
        )

        self.assertEqual(
            [paper.id for paper in results],
            [self.abstract_match.id],
        )

    def test_empty_query_with_relevance_equals_legacy_default(self):
        legacy = filter_papers(
            self.db,
            search=None,
            sort_by="date_added",
        )

        for empty in (None, ""):
            with self.subTest(empty=empty):
                relevance = filter_papers(
                    self.db,
                    search=empty,
                    sort_by="relevance",
                )
                self.assertEqual(
                    [paper.id for paper in relevance],
                    [paper.id for paper in legacy],
                )

    def test_fts_failure_falls_back_to_legacy_ilike(self):
        legacy = filter_papers(
            self.db,
            search="neural",
            sort_by="date_added",
        )
        self.assertEqual(
            [paper.id for paper in legacy],
            [self.title_match.id],
        )

        failure = OperationalError(
            "SELECT ... FROM papers_fts ...",
            {},
            Exception("no such table: papers_fts"),
        )

        with mock.patch.object(
            queries,
            "ranked_search",
            side_effect=failure,
        ):
            fallback = filter_papers(
                self.db,
                search="neural",
                sort_by="relevance",
            )

        self.assertEqual(
            [paper.id for paper in fallback],
            [paper.id for paper in legacy],
        )
        self.assertFalse(hasattr(fallback[0], "search_snippet"))

    def test_ensure_returns_false_and_search_falls_back_without_fts5(self):
        if fts_search.fts_available(self.engine):
            self.skipTest("FTS5 is available in this SQLite build")

        self.assertFalse(fts_search.ensure_fts_index(self.engine))

        fallback = filter_papers(
            self.db,
            search="neural",
            sort_by="relevance",
        )
        legacy = filter_papers(
            self.db,
            search="neural",
            sort_by="date_added",
        )

        self.assertEqual(
            [paper.id for paper in fallback],
            [paper.id for paper in legacy],
        )

    def test_other_sort_options_keep_working(self):
        alphabetical = filter_papers(self.db, sort_by="alphabetical")
        self.assertEqual(
            [paper.title for paper in alphabetical],
            sorted(paper.title for paper in alphabetical),
        )

        newest_first = filter_papers(self.db, sort_by="date_added")
        self.assertEqual(
            [paper.id for paper in newest_first],
            [self.unrelated.id, self.abstract_match.id, self.title_match.id],
        )

        by_year = filter_papers(self.db, sort_by="publication_year")
        self.assertEqual(
            [paper.publication_year for paper in by_year],
            [2024, 2023, 2022],
        )

        decade = filter_papers(
            self.db,
            min_year=2023,
            max_year=2024,
        )
        self.assertEqual(len(decade), 2)


if __name__ == "__main__":
    unittest.main()
