"""
Tests for near-duplicate collapsing in the BM25 relevance search path.

Run from the project root:

    .venv/bin/python -m unittest test.test_relevance_dedupe -v

Collapsing applies only when the repository list is ranked by relevance
with a search term; the legacy ILIKE fallback and every other sort mode
must keep returning every row.
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
from app.services import duplicate_detection
from app.services import fts_search
from app.services.duplicate_detection import TITLE_DUPLICATE_THRESHOLD
from app.services.fts_search import RankedPaper
from app.services.pdf_finder import title_similarity


class RelevanceDedupeTestCase(unittest.TestCase):
    """Fresh temp-file database shared by each test."""

    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        db_path = os.path.join(self._temp_dir.name, "relevance_dedupe_test.db")

        self.engine = create_engine(f"sqlite:///{db_path}")
        Base.metadata.create_all(bind=self.engine)

        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self._temp_dir.cleanup()

    def _require_fts(self):
        if not fts_search.fts_available(self.engine):
            self.skipTest("SQLite build has no FTS5 support")

    def _seed(self, *papers):
        self.db.add_all(papers)
        self.db.commit()
        return papers

    def _ranked_ids(self, search):
        return [
            hit.paper_id for hit in fts_search.ranked_search(self.db, search)
        ]

    def test_same_normalized_doi_collapses_to_best_ranked_copy(self):
        first = Paper(
            title="Filtering recommender systems for digital libraries",
            doi="10.1234/EXAMPLE",
            created_at=datetime(2024, 1, 1),
        )
        suppressed = Paper(
            title="Collaborative ranking at scale",
            abstract="A filtering approach for very large collections.",
            doi="https://doi.org/10.1234/example",
            created_at=datetime(2024, 1, 2),
        )
        other = Paper(
            title="Signal processing handbook",
            abstract="Includes a chapter on filtering.",
            created_at=datetime(2024, 1, 3),
        )
        self._seed(first, suppressed, other)
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        results = filter_papers(self.db, search="filtering", sort_by="relevance")

        # The title match outranks the abstract-only hits, so `first`
        # survives and the DOI-equal `suppressed` row is dropped.
        self.assertEqual([paper.id for paper in results], [first.id, other.id])
        self.assertEqual(results[0].duplicate_count, 1)
        self.assertEqual(results[1].duplicate_count, 0)

    def test_transitive_title_similarity_collapses_whole_group(self):
        first = Paper(
            title="Deep learning for recommender systems",
            created_at=datetime(2024, 1, 1),
        )
        middle = Paper(
            title="Deep learning recommender systems",
            created_at=datetime(2024, 1, 2),
        )
        last = Paper(
            title="Deep learning recommendation system",
            created_at=datetime(2024, 1, 3),
        )
        self._seed(first, middle, last)
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        # Fixture sanity: a chain where the endpoints are not directly
        # duplicates, so only transitivity can merge all three.
        self.assertGreaterEqual(
            title_similarity(first.title, middle.title),
            TITLE_DUPLICATE_THRESHOLD,
        )
        self.assertGreaterEqual(
            title_similarity(middle.title, last.title),
            TITLE_DUPLICATE_THRESHOLD,
        )
        self.assertLess(
            title_similarity(first.title, last.title),
            TITLE_DUPLICATE_THRESHOLD,
        )

        results = filter_papers(
            self.db,
            search="deep learning",
            sort_by="relevance",
        )

        self.assertEqual(len(results), 1)
        best_ranked_id = self._ranked_ids("deep learning")[0]
        self.assertEqual(results[0].id, best_ranked_id)
        self.assertEqual(results[0].duplicate_count, 2)

    def test_distinct_papers_are_untouched(self):
        first = Paper(
            title="Recommender systems in practice",
            created_at=datetime(2024, 1, 1),
        )
        second = Paper(
            title="Database systems internals",
            created_at=datetime(2024, 1, 2),
        )
        self._seed(first, second)
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        results = filter_papers(self.db, search="systems", sort_by="relevance")

        self.assertEqual(
            [paper.id for paper in results],
            self._ranked_ids("systems"),
        )
        self.assertEqual(len(results), 2)
        self.assertTrue(
            all(paper.duplicate_count == 0 for paper in results)
        )

    def test_other_sort_modes_return_every_duplicate_row(self):
        first = Paper(
            title="Duplicate filtering systems",
            doi="10.9999/x",
            publication_year=2020,
            created_at=datetime(2024, 1, 1),
        )
        second = Paper(
            title="Duplicate filtering systems second copy",
            doi="10.9999/X",
            publication_year=2021,
            created_at=datetime(2024, 1, 2),
        )
        third = Paper(
            title="Unrelated filtering topic",
            publication_year=2019,
            created_at=datetime(2024, 1, 3),
        )
        self._seed(first, second, third)

        for sort_by in ("date_added", "alphabetical", "publication_year"):
            with self.subTest(sort_by=sort_by):
                results = filter_papers(
                    self.db,
                    search="filtering",
                    sort_by=sort_by,
                )
                self.assertEqual(len(results), 3)
                self.assertEqual(
                    {paper.id for paper in results},
                    {first.id, second.id, third.id},
                )
                self.assertTrue(
                    all(
                        not hasattr(paper, "duplicate_count")
                        for paper in results
                    )
                )

        # relevance without a search term behaves like the default view.
        no_search = filter_papers(self.db, sort_by="relevance")
        self.assertEqual(len(no_search), 3)

        listed = queries.list_papers(self.db)
        self.assertEqual(len(listed), 3)

    def test_fts_failure_fallback_is_not_collapsed(self):
        first = Paper(
            title="Filtering duplicate example",
            doi="10.5555/a",
            created_at=datetime(2024, 1, 1),
        )
        second = Paper(
            title="Filtering duplicate example",
            doi="10.5555/A",
            created_at=datetime(2024, 1, 2),
        )
        self._seed(first, second)

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
            results = filter_papers(
                self.db,
                search="filtering",
                sort_by="relevance",
            )

        self.assertEqual(len(results), 2)
        self.assertEqual(
            {paper.id for paper in results},
            {first.id, second.id},
        )

    def test_empty_and_none_titles_never_raise(self):
        blank = Paper(
            title="",
            abstract="emptytopic coverage for a blank title.",
            created_at=datetime(2024, 1, 1),
        )
        spaces = Paper(
            title="   ",
            abstract="emptytopic coverage for a blank-looking title.",
            created_at=datetime(2024, 1, 2),
        )
        self._seed(blank, spaces)
        self._require_fts()
        self.assertTrue(fts_search.ensure_fts_index(self.engine))

        results = filter_papers(
            self.db,
            search="emptytopic",
            sort_by="relevance",
        )

        self.assertEqual(len(results), 2)
        self.assertTrue(
            all(paper.duplicate_count == 0 for paper in results)
        )

        # The helper must never hand an empty/None title to the
        # similarity measure, even for transient (unpersisted) rows.
        helper_input = [Paper(title=None), Paper(title=""), Paper(title="   ")]
        with mock.patch.object(
            duplicate_detection, "title_similarity"
        ) as similarity:
            collapsed = queries._collapse_duplicate_papers(helper_input)

        similarity.assert_not_called()
        self.assertEqual(collapsed, helper_input)
        self.assertTrue(
            all(paper.duplicate_count == 0 for paper in collapsed)
        )

    def test_survivor_adopts_snippet_from_suppressed_copy(self):
        survivor = Paper(
            title="Neural models for graph retrieval",
            created_at=datetime(2024, 1, 1),
        )
        suppressed = Paper(
            title="Neural models for graph retrieval systems",
            created_at=datetime(2024, 1, 2),
        )
        self._seed(survivor, suppressed)

        hits = [
            RankedPaper(paper_id=survivor.id, snippet=None, score=-1.0),
            RankedPaper(
                paper_id=suppressed.id,
                snippet="better graph retrieval snippet",
                score=-2.0,
            ),
        ]

        with mock.patch.object(queries, "ranked_search", return_value=hits):
            results = filter_papers(
                self.db,
                search="graph retrieval",
                sort_by="relevance",
            )

        self.assertEqual([paper.id for paper in results], [survivor.id])
        self.assertEqual(
            results[0].search_snippet,
            "better graph retrieval snippet",
        )
        self.assertEqual(results[0].duplicate_count, 1)


if __name__ == "__main__":
    unittest.main()
