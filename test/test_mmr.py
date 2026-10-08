"""
Tests for the opt-in MMR diversification step (P2-C).

Covers the pure selection algorithm, the vector-similarity getter,
and the search_service integration:

    - hand-computed MMR ordering
    - lambda = 0 / 1 boundary behavior
    - pool clamping and tail preservation
    - similarity call count (pairs only, never an N x N matrix)
    - missing / zero / mismatched vectors
    - default path (mmr_lambda=None) is unchanged and never parses
      candidate vectors
    - validation of mmr_lambda / mmr_pool

Everything runs offline against a temporary SQLite file and uses no
TF-IDF vectorizer or S-BERT model: the search tests drive the
"custom" metadata-only pipeline and provide fake stored vectors.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.services.recommendation import search_service
from app.services.recommendation.trace_service import (
    RecommendationTraceRequest,
    run_traced_search,
)
from app.services.recommendation.mmr import (
    select_mmr,
    vector_similarity_getter,
)
from app.services.recommendation.pipeline_config import (
    build_custom_weights,
)


# The four-candidate fixture used by the algorithm tests:
#   1 and 2 are near-duplicates (0.95), 3 and 4 are distinct (0.1).
SCORES = {1: 0.9, 2: 0.85, 3: 0.8, 4: 0.7}


def _similarity(left_id: int, right_id: int) -> float:
    if {left_id, right_id} == {1, 2}:
        return 0.95
    return 0.1


class _Recorder:
    """Minimal duck-typed trace recorder (record(event, message, data))."""

    def __init__(self) -> None:
        self.events = []

    def record(
        self,
        event: str,
        message: str,
        data: dict | None = None,
    ) -> None:
        self.events.append(
            {
                "event": event,
                "message": message,
                "data": data or {},
            }
        )


class SelectMmrTest(unittest.TestCase):
    def test_hand_computed_order_at_lambda_half(self):
        result = select_mmr(
            [1, 2, 3, 4],
            SCORES,
            _similarity,
            0.5,
        )

        # First pick 1 (best score); 2 is penalized by its 0.95
        # near-duplication, so 3 and 4 come first.
        self.assertEqual(result, [1, 3, 4, 2])

    def test_lambda_zero_starts_with_top_score_then_diversifies(self):
        result = select_mmr(
            [1, 2, 3, 4],
            SCORES,
            _similarity,
            0.0,
        )

        self.assertEqual(result[0], 1)
        self.assertEqual(result, [1, 3, 4, 2])

    def test_lambda_one_is_pure_score_order(self):
        result = select_mmr(
            [1, 2, 3, 4],
            SCORES,
            _similarity,
            1.0,
        )

        self.assertEqual(result, [1, 2, 3, 4])

    def test_pool_tail_is_appended_in_original_order(self):
        result = select_mmr(
            [1, 2, 3, 4],
            SCORES,
            _similarity,
            0.5,
            pool_size=3,
        )

        self.assertEqual(result, [1, 3, 2, 4])

    def test_pool_larger_than_list_is_clamped(self):
        result = select_mmr(
            [1, 2, 3, 4],
            SCORES,
            _similarity,
            0.5,
            pool_size=99,
        )

        self.assertEqual(result, [1, 3, 4, 2])

    def test_similarity_is_computed_once_per_pool_pair(self):
        calls = []

        def similarity(left_id, right_id):
            calls.append(frozenset({left_id, right_id}))
            return _similarity(left_id, right_id)

        select_mmr(
            [1, 2, 3, 4],
            SCORES,
            similarity,
            0.5,
        )

        self.assertEqual(len(calls), 6)
        self.assertEqual(
            set(calls),
            {
                frozenset({1, 2}),
                frozenset({1, 3}),
                frozenset({1, 4}),
                frozenset({2, 3}),
                frozenset({2, 4}),
                frozenset({3, 4}),
            },
        )

    def test_tail_ids_never_reach_the_similarity_function(self):
        calls = []

        def similarity(left_id, right_id):
            calls.append((left_id, right_id))
            return 0.1

        select_mmr(
            [1, 2, 3, 4, 5],
            {1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5},
            similarity,
            0.5,
            pool_size=3,
        )

        self.assertEqual(calls.count((4, 5)), 0)
        for left_id, right_id in calls:
            self.assertLessEqual(max(left_id, right_id), 3)

    def test_tie_break_is_higher_score_then_lower_id(self):
        result = select_mmr(
            [1, 2, 3],
            {1: 0.5, 2: 0.5, 3: 0.5},
            lambda left_id, right_id: 0.0,
            0.5,
        )

        self.assertEqual(result, [1, 2, 3])

    def test_empty_ranked_ids_returns_empty(self):
        self.assertEqual(
            select_mmr([], SCORES, _similarity, 0.5),
            [],
        )

    def test_invalid_lambda_raises(self):
        for bad_lambda in (-0.01, 1.01, -2.0, 3.0):
            with self.assertRaises(ValueError):
                select_mmr(
                    [1],
                    {1: 1.0},
                    _similarity,
                    bad_lambda,
                )

    def test_invalid_pool_size_raises(self):
        for bad_pool in (0, -1, -50):
            with self.assertRaises(ValueError):
                select_mmr(
                    [1],
                    {1: 1.0},
                    _similarity,
                    0.5,
                    pool_size=bad_pool,
                )


class VectorSimilarityGetterTest(unittest.TestCase):
    def test_identical_direction_is_one(self):
        getter = vector_similarity_getter(
            {1: [1.0, 2.0], 2: [2.0, 4.0]}
        )

        self.assertAlmostEqual(getter(1, 2), 1.0)
        self.assertAlmostEqual(getter(2, 1), 1.0)
        self.assertAlmostEqual(getter(1, 1), 1.0)

    def test_orthogonal_vectors_are_zero(self):
        getter = vector_similarity_getter(
            {1: [1.0, 0.0], 2: [0.0, 1.0]}
        )

        self.assertEqual(getter(1, 2), 0.0)

    def test_negative_cosine_is_clamped_to_zero(self):
        getter = vector_similarity_getter(
            {1: [1.0, 0.0], 2: [-1.0, 0.0]}
        )

        self.assertEqual(getter(1, 2), 0.0)

    def test_missing_vectors_are_zero_and_do_not_crash(self):
        getter = vector_similarity_getter({1: [1.0, 0.0]})

        self.assertEqual(getter(1, 2), 0.0)
        self.assertEqual(getter(2, 1), 0.0)
        self.assertEqual(getter(2, 3), 0.0)

    def test_zero_and_empty_vectors_are_zero(self):
        getter = vector_similarity_getter(
            {1: [0.0, 0.0], 2: [], 3: [1.0, 0.0]}
        )

        self.assertEqual(getter(1, 3), 0.0)
        self.assertEqual(getter(3, 1), 0.0)
        self.assertEqual(getter(2, 3), 0.0)
        self.assertEqual(getter(3, 2), 0.0)

    def test_dimension_mismatch_is_zero(self):
        getter = vector_similarity_getter(
            {1: [1.0, 0.0], 2: [1.0, 0.0, 0.0]}
        )

        self.assertEqual(getter(1, 2), 0.0)


class SearchMmrTest(unittest.TestCase):
    """
    Integration tests against a synthetic four-paper database.

    Metadata scores (the only active component) order the papers
    p1 > p2 > p3 > p4. The stored S-BERT/TF-IDF vectors mark p2 as a
    near-duplicate of p1 and p4 as a near-duplicate of p3, so MMR at
    lambda = 0.5 should produce p1, p3, p2, p4.
    """

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

        self.query = "ranking"
        # Metadata-only pipeline: no TF-IDF vectorizer, no S-BERT
        # model -- deterministic and offline.
        self.weights = build_custom_weights(0, 0, 1)

        specs = [
            {
                "title": "ranking",
                "abstract": "ranking",
                "keywords": "ranking",
                "vector": [1.0, 0.0],
            },
            {
                "title": "ranking systems",
                "abstract": "ranking",
                "keywords": "ranking",
                "vector": [1.0, 0.0],
            },
            {
                "title": "ranking evaluation",
                "abstract": "evaluation",
                "keywords": "ranking",
                "vector": [0.0, 1.0],
            },
            {
                "title": "ranking metrics",
                "abstract": "metrics",
                "keywords": "ranking",
                "vector": [0.0, 1.0],
            },
        ]

        self.papers = []
        for position, spec in enumerate(specs):
            paper = Paper(
                title=spec["title"],
                abstract=spec["abstract"],
                keywords=spec["keywords"],
                prepared_text=f"ranking fixture {position + 1}",
                is_valid_for_recommendation=True,
                tfidf_vector=json.dumps(spec["vector"]),
                sbert_vector=json.dumps(spec["vector"]),
            )
            self.papers.append(paper)
            self.db.add(paper)
        self.db.commit()

        self.expected_ids = [
            paper.id for paper in self.papers
        ]
        self.mmr_expected_ids = [
            self.expected_ids[0],
            self.expected_ids[2],
            self.expected_ids[1],
            self.expected_ids[3],
        ]

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------

    def _search(self, **overrides):
        kwargs = {
            "db": self.db,
            "query": self.query,
            "pipeline": "custom",
            "custom_weights": self.weights,
        }
        kwargs.update(overrides)
        return search_service.search_papers(**kwargs)

    def _ids(self, results):
        return [result["paper"].id for result in results]

    def _scores(self, results):
        return {
            result["paper"].id: result["score"]
            for result in results
        }

    # -----------------------------------------------------------------
    # Default path is untouched
    # -----------------------------------------------------------------

    def test_default_path_matches_explicit_none(self):
        implicit = self._search()
        explicit = self._search(mmr_lambda=None)

        self.assertEqual(self._ids(implicit), self.expected_ids)
        self.assertEqual(
            [(result["paper"].id, result["score"]) for result in implicit],
            [(result["paper"].id, result["score"]) for result in explicit],
        )

    def test_default_path_never_parses_vectors(self):
        with patch.object(search_service, "json") as json_stub:
            json_stub.loads.side_effect = AssertionError(
                "the default path parsed a candidate vector"
            )
            results = self._search(mmr_lambda=None)

        self.assertEqual(self._ids(results), self.expected_ids)

    def test_default_path_has_no_rerank_trace_event(self):
        recorder = _Recorder()
        self._search(trace=recorder)
        expected_events = list(recorder.events)

        recorder_none = _Recorder()
        self._search(mmr_lambda=None, trace=recorder_none)

        self.assertEqual(expected_events, recorder_none.events)
        self.assertNotIn(
            "rerank.mmr",
            [event["event"] for event in recorder_none.events],
        )

    # -----------------------------------------------------------------
    # MMR behavior
    # -----------------------------------------------------------------

    def test_mmr_demotes_near_duplicate_and_keeps_scores(self):
        baseline = self._search()
        reranked = self._search(mmr_lambda=0.5)

        self.assertEqual(self._ids(baseline), self.expected_ids)
        self.assertEqual(self._ids(reranked), self.mmr_expected_ids)
        self.assertEqual(
            self._scores(reranked),
            self._scores(baseline),
        )

    def test_mmr_lambda_one_keeps_relevance_order(self):
        baseline = self._search()
        reranked = self._search(mmr_lambda=1.0)

        self.assertEqual(self._ids(reranked), self._ids(baseline))

    def test_mmr_lambda_zero_still_keeps_top_paper_first(self):
        reranked = self._search(mmr_lambda=0.0)

        self.assertEqual(
            self._ids(reranked)[0],
            self.expected_ids[0],
        )

    def test_mmr_pool_of_one_keeps_relevance_order(self):
        reranked = self._search(mmr_lambda=0.5, mmr_pool=1)

        self.assertEqual(self._ids(reranked), self.expected_ids)

    def test_mmr_falls_back_to_tfidf_vectors(self):
        for paper in self.papers:
            paper.sbert_vector = None
        self.db.commit()

        reranked = self._search(mmr_lambda=0.5)

        self.assertEqual(self._ids(reranked), self.mmr_expected_ids)

    def test_mmr_without_vectors_keeps_relevance_order(self):
        for paper in self.papers:
            paper.sbert_vector = None
            paper.tfidf_vector = None
        self.db.commit()

        reranked = self._search(mmr_lambda=0.5)

        self.assertEqual(self._ids(reranked), self.expected_ids)

    def test_mmr_with_no_positive_results_is_empty_and_recorded(self):
        recorder = _Recorder()
        results = self._search(
            query="zzz",
            mmr_lambda=0.5,
            trace=recorder,
        )

        self.assertEqual(results, [])

        events = [
            event
            for event in recorder.events
            if event["event"] == "rerank.mmr"
        ]
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["data"]["before"], [])
        self.assertEqual(events[0]["data"]["after"], [])

    def test_mmr_records_trace_event(self):
        recorder = _Recorder()
        self._search(mmr_lambda=0.5, trace=recorder)

        events = [
            event
            for event in recorder.events
            if event["event"] == "rerank.mmr"
        ]
        self.assertEqual(len(events), 1)

        data = events[0]["data"]
        self.assertEqual(data["lambda"], 0.5)
        self.assertEqual(data["pool"], 50)
        self.assertEqual(data["pool_used"], 4)
        self.assertEqual(data["similarity_source"], "sbert")
        self.assertEqual(data["before"], self.expected_ids)
        self.assertEqual(data["after"], self.mmr_expected_ids)

    # -----------------------------------------------------------------
    # Validation
    # -----------------------------------------------------------------

    def test_invalid_mmr_lambda_raises(self):
        for bad_lambda in (-0.5, 1.5):
            with self.assertRaises(ValueError):
                self._search(mmr_lambda=bad_lambda)

    def test_invalid_mmr_pool_raises(self):
        for bad_pool in (0, 101):
            with self.assertRaises(ValueError):
                self._search(
                    mmr_lambda=0.5,
                    mmr_pool=bad_pool,
                )

    def test_invalid_mmr_pool_raises_without_lambda_too(self):
        with self.assertRaises(ValueError):
            self._search(mmr_pool=0)

    # -----------------------------------------------------------------
    # The trace endpoint (Stats for Nerds) carries MMR through
    # -----------------------------------------------------------------

    def _traced(self, **overrides):
        kwargs = {
            "db": self.db,
            "query": self.query,
            "seed_paper_id": None,
            "pipeline": "custom",
            "top_k": 10,
            "custom_weights": self.weights,
        }
        kwargs.update(overrides)
        return run_traced_search(**kwargs)

    def test_traced_search_with_mmr_matches_the_untraced_search(self):
        traced = self._traced(mmr_lambda=0.5)
        plain = self._search(mmr_lambda=0.5)

        self.assertEqual(
            [result.paper.id for result in traced.results],
            self._ids(plain),
        )
        self.assertEqual(
            [result.paper.id for result in traced.results],
            self.mmr_expected_ids,
        )
        self.assertEqual(
            {result.paper.id: result.score for result in traced.results},
            self._scores(plain),
        )

        names = [event.event for event in traced.events]
        self.assertEqual(names.count("rerank.mmr"), 1)

        mmr_event = next(
            event for event in traced.events
            if event.event == "rerank.mmr"
        )
        self.assertEqual(mmr_event.data["before"], self.expected_ids)
        self.assertEqual(mmr_event.data["after"], self.mmr_expected_ids)

    def test_traced_search_without_mmr_is_unchanged(self):
        traced = self._traced()

        self.assertNotIn(
            "rerank.mmr",
            [event.event for event in traced.events],
        )
        self.assertEqual(
            [result.paper.id for result in traced.results],
            self.expected_ids,
        )

    def test_trace_request_validates_the_mmr_fields(self):
        defaults = RecommendationTraceRequest(query="ranking")
        self.assertIsNone(defaults.mmr_lambda)
        self.assertEqual(defaults.mmr_pool, 50)

        accepted = RecommendationTraceRequest(
            query="ranking",
            mmr_lambda=0.7,
            mmr_pool=20,
        )
        self.assertEqual(accepted.mmr_lambda, 0.7)
        self.assertEqual(accepted.mmr_pool, 20)

        for bad in (
            {"mmr_lambda": -0.1},
            {"mmr_lambda": 1.1},
            {"mmr_pool": 0},
            {"mmr_pool": 101},
        ):
            with self.assertRaises(ValidationError):
                RecommendationTraceRequest(query="ranking", **bad)


if __name__ == "__main__":
    unittest.main()
