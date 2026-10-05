import json
import os
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.services.recommendation import (
    sbert_pipeline,
    tfidf_pipeline,
    vector_index,
)
from app.services.recommendation.similarity import cosine_similarity


TFIDF_VECTORS = [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.5, 0.5, 0.0],
    [0.0, 0.0, 0.0],
    [0.25, 0.5, 0.75],
    None,
]

SBERT_VECTORS = [
    [1.0, 0.0, 0.0, 0.0],
    [0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 1.0, 0.5],
    [0.0, 0.0, 0.0, 0.0],
    [0.5, 0.5, 0.5, 0.5],
    None,
]


def _legacy_scores(query_vector, papers, attribute):
    scores = {}
    for paper in papers:
        encoded = getattr(paper, attribute)
        if not encoded:
            continue
        scores[paper.id] = cosine_similarity(
            query_vector,
            json.loads(encoded),
        )
    return scores


class VectorIndexTest(unittest.TestCase):
    def setUp(self):
        self._temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self._temporary_directory.cleanup)

        database_path = os.path.join(
            self._temporary_directory.name,
            "papers.db",
        )
        engine = create_engine(f"sqlite:///{database_path}")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.addCleanup(engine.dispose)

        patches = [
            patch.object(
                vector_index,
                "TFIDF_MATRIX_PATH",
                os.path.join(
                    self._temporary_directory.name,
                    "recommendation_tfidf.npz",
                ),
            ),
            patch.object(
                vector_index,
                "SBERT_MATRIX_PATH",
                os.path.join(
                    self._temporary_directory.name,
                    "recommendation_sbert.npz",
                ),
            ),
            patch.object(
                vector_index,
                "META_PATH",
                os.path.join(
                    self._temporary_directory.name,
                    "recommendation_vectors.meta.json",
                ),
            ),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

        vector_index.clear_cache()
        self.addCleanup(vector_index.clear_cache)

        self.papers = []
        for position in range(len(TFIDF_VECTORS)):
            tfidf = TFIDF_VECTORS[position]
            sbert = SBERT_VECTORS[position]

            paper = Paper(
                title=f"Synthetic paper {position + 1}",
                prepared_text=f"prepared text {position + 1}",
                is_valid_for_recommendation=True,
                tfidf_vector=(
                    None if tfidf is None else json.dumps(tfidf)
                ),
                sbert_vector=(
                    None if sbert is None else json.dumps(sbert)
                ),
            )
            self.papers.append(paper)
            self.db.add(paper)
        self.db.commit()

        self.zero_vector_paper_id = self.papers[3].id
        self.missing_vector_paper_id = self.papers[5].id

    # -----------------------------------------------------------------
    # Fast path parity
    # -----------------------------------------------------------------

    def test_tfidf_fast_path_matches_legacy(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        query = [0.3, 0.6, 0.1]

        with patch.object(
            tfidf_pipeline,
            "cosine_similarity",
            side_effect=AssertionError("legacy path was used"),
        ):
            scores = tfidf_pipeline.score_candidates(query, self.papers)

        expected = _legacy_scores(query, self.papers, "tfidf_vector")

        self.assertEqual(set(scores), set(expected))
        for paper_id, value in expected.items():
            self.assertAlmostEqual(scores[paper_id], value, places=6)

        self.assertNotIn(self.missing_vector_paper_id, scores)
        self.assertEqual(scores[self.zero_vector_paper_id], 0.0)

    def test_sbert_fast_path_matches_legacy(self):
        self.assertTrue(
            vector_index.build_sbert_index(
                self.db,
                model="test-model",
            )
        )

        query = [0.2, 0.1, 0.4, 0.3]

        with patch.object(
            sbert_pipeline,
            "cosine_similarity",
            side_effect=AssertionError("legacy path was used"),
        ):
            scores = sbert_pipeline.score_candidates(query, self.papers)

        expected = _legacy_scores(query, self.papers, "sbert_vector")

        self.assertEqual(set(scores), set(expected))
        for paper_id, value in expected.items():
            self.assertAlmostEqual(scores[paper_id], value, places=6)

        self.assertNotIn(self.missing_vector_paper_id, scores)

        with open(vector_index.META_PATH, encoding="utf-8") as handle:
            meta = json.load(handle)
        self.assertEqual(meta["sbert"]["model"], "test-model")
        self.assertEqual(meta["sbert"]["count"], 5)
        self.assertEqual(meta["sbert"]["dim"], 4)

    # -----------------------------------------------------------------
    # Graceful fallback
    # -----------------------------------------------------------------

    def test_missing_index_falls_back_to_legacy(self):
        query = [1.0, 0.0, 0.0]
        calls = []
        original = tfidf_pipeline.cosine_similarity

        def spy(query_vector, candidate_vector):
            calls.append(candidate_vector)
            return original(query_vector, candidate_vector)

        with patch.object(
            tfidf_pipeline,
            "cosine_similarity",
            side_effect=spy,
        ):
            scores = tfidf_pipeline.score_candidates(query, self.papers)

        self.assertTrue(calls)
        self.assertEqual(
            set(scores),
            {paper.id for paper in self.papers if paper.tfidf_vector},
        )

    def test_stale_index_falls_back_and_scores_new_paper(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        newcomer = Paper(
            title="Newcomer",
            prepared_text="newcomer prepared text",
            is_valid_for_recommendation=True,
            tfidf_vector=json.dumps([1.0, 1.0, 1.0]),
            sbert_vector=json.dumps([1.0, 0.0, 0.0, 0.0]),
        )
        self.db.add(newcomer)
        self.db.commit()

        candidates = self.papers + [newcomer]
        query = [1.0, 0.0, 0.0]
        calls = []
        original = tfidf_pipeline.cosine_similarity

        def spy(query_vector, candidate_vector):
            calls.append(candidate_vector)
            return original(query_vector, candidate_vector)

        with patch.object(
            tfidf_pipeline,
            "cosine_similarity",
            side_effect=spy,
        ):
            scores = tfidf_pipeline.score_candidates(query, candidates)

        self.assertTrue(calls)
        self.assertIn(newcomer.id, scores)
        self.assertEqual(
            set(scores),
            {
                paper.id
                for paper in candidates
                if paper.tfidf_vector
            },
        )

    def test_dimension_drift_requests_fallback(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        self.assertIsNone(
            vector_index.score_candidates(
                kind=vector_index.TFIDF,
                query_vector=[1.0, 0.0],
                paper_ids=[self.papers[0].id],
            )
        )

    def test_unknown_paper_id_requests_fallback(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        index = vector_index.load_index(vector_index.TFIDF)
        self.assertIsNone(index.rows_for([999_999]))
        self.assertIsNone(
            vector_index.score_candidates(
                kind=vector_index.TFIDF,
                query_vector=[1.0, 0.0, 0.0],
                paper_ids=[999_999],
            )
        )

    # -----------------------------------------------------------------
    # Storage + cache behavior
    # -----------------------------------------------------------------

    def test_npz_round_trip_and_cache(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        first = vector_index.load_index(vector_index.TFIDF)
        second = vector_index.load_index(vector_index.TFIDF)

        self.assertIsNotNone(first)
        self.assertIs(first, second)

        expected_ids = np.asarray(
            [paper.id for paper in self.papers if paper.tfidf_vector],
            dtype=np.int64,
        )
        expected_matrix = np.asarray(
            [
                vector
                for vector in TFIDF_VECTORS
                if vector is not None
            ],
            dtype=np.float32,
        )

        np.testing.assert_array_equal(first.paper_ids, expected_ids)
        np.testing.assert_array_equal(first.matrix, expected_matrix)
        self.assertEqual(first.matrix.dtype, np.float32)
        self.assertEqual(first.dim, 3)

        with np.load(vector_index.TFIDF_MATRIX_PATH) as data:
            self.assertEqual(data["matrix"].dtype, np.float32)
            self.assertEqual(data["paper_ids"].dtype, np.int64)

        vector_index.clear_cache()
        third = vector_index.load_index(vector_index.TFIDF)

        self.assertIsNotNone(third)
        self.assertIsNot(first, third)
        np.testing.assert_array_equal(third.matrix, first.matrix)

    def test_corrupt_matrix_is_rejected(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        np.savez(
            vector_index.TFIDF_MATRIX_PATH,
            matrix=np.zeros((2, 3), dtype=np.float32),
            paper_ids=np.asarray([1, 2, 3], dtype=np.int64),
        )
        vector_index.clear_cache()

        self.assertIsNone(vector_index.load_index(vector_index.TFIDF))

    def test_negative_cache_recovers_when_meta_is_rewritten(self):
        self.assertTrue(vector_index.build_tfidf_index(self.db))

        with open(vector_index.META_PATH, "rb") as handle:
            meta_bytes = handle.read()

        os.remove(vector_index.META_PATH)
        self.assertIsNone(vector_index.load_index(vector_index.TFIDF))

        with open(vector_index.META_PATH, "wb") as handle:
            handle.write(meta_bytes + b"\n")

        index = vector_index.load_index(vector_index.TFIDF)
        self.assertIsNotNone(index)

    def test_build_writes_nothing_when_no_valid_papers(self):
        self.db.query(Paper).delete()
        self.db.commit()

        self.assertFalse(vector_index.build_tfidf_index(self.db))
        self.assertFalse(
            os.path.exists(vector_index.TFIDF_MATRIX_PATH)
        )

        self.assertFalse(
            vector_index.build_sbert_index(self.db, model="x")
        )
        self.assertFalse(
            os.path.exists(vector_index.SBERT_MATRIX_PATH)
        )


if __name__ == "__main__":
    unittest.main()
