"""
Tests for the per-result weighted component breakdown.

search_papers() now returns, for each top-k result, a ``components``
dict with the three weighted contributions behind its score:

    tfidf    = w_tfidf  * s'_tfidf
    sbert    = w_sbert  * s'_sbert
    metadata = w_metadata * s_meta

rounded to 6 decimals, with missing / zero-weight components 0.0.
The existing "score" (and therefore the ranking) must stay exactly as
it was; the extra key is purely additive.

Everything runs offline against a temporary SQLite file. The TF-IDF
and S-BERT pipelines are patched with deterministic component scorers
(no vectorizer/model files needed); the metadata component runs for
real. A metadata-only custom pipeline covers the zero-weight case,
and the trace / compare paths are exercised to prove the additive
key does not break their consumers.
"""

import json
import os
import tempfile
import unittest
from contextlib import ExitStack
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.services.recommendation import search_service
from app.services.recommendation.compare_service import (
    PIPELINE_ORDER,
    compare_pipelines,
)
from app.services.recommendation.pipeline_config import (
    build_custom_weights,
)
from app.services.recommendation.trace_service import (
    run_traced_search,
)


def _patched_component_scorers(
    tfidf_scores: dict[int, float],
    sbert_scores: dict[int, float],
):
    """
    Replace the TF-IDF / S-BERT scorers with deterministic stubs so
    the integration tests never touch the vectorizer or the model.
    """

    stack = ExitStack()

    stack.enter_context(
        patch.object(
            search_service.tfidf_pipeline,
            "vectorize_query_or_seed",
            return_value=[1.0, 0.0],
        )
    )
    stack.enter_context(
        patch.object(
            search_service.tfidf_pipeline,
            "score_candidates",
            return_value=tfidf_scores,
        )
    )
    stack.enter_context(
        patch.object(
            search_service.sbert_pipeline,
            "embed_query_or_seed",
            return_value=[1.0, 0.0],
        )
    )
    stack.enter_context(
        patch.object(
            search_service.sbert_pipeline,
            "score_candidates",
            return_value=sbert_scores,
        )
    )

    return stack


class _ComponentFixture(unittest.TestCase):
    """Shared synthetic repository: four offline papers + helpers."""

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
                publication_year=2020 + position,
                is_valid_for_recommendation=True,
                tfidf_vector=json.dumps(spec["vector"]),
                sbert_vector=json.dumps(spec["vector"]),
            )
            self.papers.append(paper)
            self.db.add(paper)

        self.db.commit()

        self.paper_ids = [paper.id for paper in self.papers]

        self.metadata_weights = build_custom_weights(0, 0, 1)
        self.tfidf_sbert_weights = build_custom_weights(0.5, 0.5, 0)

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------

    def _search(self, **overrides):
        kwargs = {
            "db": self.db,
            "query": self.query,
            "pipeline": "custom",
            "custom_weights": self.metadata_weights,
        }
        kwargs.update(overrides)
        return search_service.search_papers(**kwargs)

    def _components_by_id(self, results):
        return {
            result["paper"].id: result["components"]
            for result in results
        }


class SearchResultComponentsTest(_ComponentFixture):
    # -----------------------------------------------------------------
    # Shape: keys, zero-weight components
    # -----------------------------------------------------------------

    def test_every_result_carries_all_three_component_keys(self):
        results = self._search()

        self.assertEqual(len(results), 4)

        for result in results:
            self.assertIn("components", result)
            self.assertEqual(
                set(result["components"]),
                {"tfidf", "sbert", "metadata"},
            )

    def test_zero_weight_components_are_exactly_zero(self):
        results = self._search()

        for result in results:
            self.assertEqual(result["components"]["tfidf"], 0.0)
            self.assertEqual(result["components"]["sbert"], 0.0)

    def test_metadata_only_contributions_sum_to_score(self):
        results = self._search()

        for result in results:
            total = sum(result["components"].values())
            self.assertLessEqual(
                abs(total - result["score"]),
                1e-6,
            )
            self.assertAlmostEqual(
                result["components"]["metadata"],
                round(result["score"], 6),
                places=6,
            )

    # -----------------------------------------------------------------
    # Weighted contributions from patched TF-IDF / S-BERT
    # -----------------------------------------------------------------

    def test_weighted_components_are_normalized_then_scaled(self):
        raw_tfidf = {
            self.paper_ids[0]: 0.0,
            self.paper_ids[1]: 0.5,
            self.paper_ids[2]: 1.0,
            self.paper_ids[3]: 1.0,
        }
        raw_sbert = {
            self.paper_ids[0]: 1.0,
            self.paper_ids[1]: 0.5,
            self.paper_ids[2]: 0.0,
            self.paper_ids[3]: 1.0,
        }

        with _patched_component_scorers(raw_tfidf, raw_sbert):
            results = self._search(
                custom_weights=self.tfidf_sbert_weights,
            )

        components = self._components_by_id(results)

        # Min-max normalized: tfidf {0, 0.5, 1, 1}, sbert {1, 0.5, 0, 1}.
        # Scaled by 0.5 each; metadata weight is 0 so it stays 0.0.
        self.assertEqual(
            components[self.paper_ids[0]],
            {"tfidf": 0.0, "sbert": 0.5, "metadata": 0.0},
        )
        self.assertEqual(
            components[self.paper_ids[1]],
            {"tfidf": 0.25, "sbert": 0.25, "metadata": 0.0},
        )
        self.assertEqual(
            components[self.paper_ids[2]],
            {"tfidf": 0.5, "sbert": 0.0, "metadata": 0.0},
        )
        self.assertEqual(
            components[self.paper_ids[3]],
            {"tfidf": 0.5, "sbert": 0.5, "metadata": 0.0},
        )

    def test_score_is_the_sum_of_its_components(self):
        raw_tfidf = {
            self.paper_ids[0]: 0.0,
            self.paper_ids[1]: 0.5,
            self.paper_ids[2]: 1.0,
            self.paper_ids[3]: 1.0,
        }
        raw_sbert = {
            self.paper_ids[0]: 1.0,
            self.paper_ids[1]: 0.5,
            self.paper_ids[2]: 0.0,
            self.paper_ids[3]: 1.0,
        }

        with _patched_component_scorers(raw_tfidf, raw_sbert):
            results = self._search(
                custom_weights=self.tfidf_sbert_weights,
            )

        for result in results:
            total = sum(result["components"].values())
            self.assertLessEqual(
                abs(total - result["score"]),
                1e-6,
            )

        # The score itself is untouched: 0.5 * normalized values.
        scores = {
            result["paper"].id: result["score"]
            for result in results
        }
        self.assertEqual(scores[self.paper_ids[0]], 0.5)
        self.assertEqual(scores[self.paper_ids[1]], 0.5)
        self.assertEqual(scores[self.paper_ids[2]], 0.5)
        self.assertEqual(scores[self.paper_ids[3]], 1.0)

    def test_all_three_signals_are_reported(self):
        raw_tfidf = {
            self.paper_ids[0]: 0.0,
            self.paper_ids[1]: 0.5,
            self.paper_ids[2]: 1.0,
            self.paper_ids[3]: 1.0,
        }
        raw_sbert = {
            self.paper_ids[0]: 1.0,
            self.paper_ids[1]: 0.5,
            self.paper_ids[2]: 0.0,
            self.paper_ids[3]: 1.0,
        }

        with _patched_component_scorers(raw_tfidf, raw_sbert):
            results = self._search(
                custom_weights=build_custom_weights(0.4, 0.4, 0.2),
            )

        self.assertTrue(
            any(
                result["components"]["metadata"] > 0.0
                for result in results
            )
        )

        for result in results:
            self.assertEqual(
                set(result["components"]),
                {"tfidf", "sbert", "metadata"},
            )
            total = sum(result["components"].values())
            self.assertLessEqual(
                abs(total - result["score"]),
                1e-6,
            )

    # -----------------------------------------------------------------
    # Only returned items, MMR path, and consumer compatibility
    # -----------------------------------------------------------------

    def test_components_are_present_for_every_returned_top_k_item(self):
        results = self._search(top_k=2)

        self.assertEqual(len(results), 2)

        for result in results:
            self.assertIn("components", result)

    def test_mmr_results_also_carry_components(self):
        results = self._search(mmr_lambda=0.5)

        self.assertTrue(results)

        for result in results:
            self.assertEqual(
                set(result["components"]),
                {"tfidf", "sbert", "metadata"},
            )
            total = sum(result["components"].values())
            self.assertLessEqual(
                abs(total - result["score"]),
                1e-6,
            )

    def test_traced_search_still_parses_component_results(self):
        response = run_traced_search(
            db=self.db,
            query=self.query,
            seed_paper_id=None,
            pipeline="custom",
            top_k=4,
            custom_weights=self.metadata_weights,
        )

        self.assertEqual(len(response.results), 4)

        direct = {
            result["paper"].id: result["score"]
            for result in self._search()
        }

        for entry in response.results:
            self.assertAlmostEqual(
                entry.score,
                direct[entry.paper.id],
                places=6,
            )

    def test_compare_service_still_works_with_component_results(self):
        raw_tfidf = {
            paper_id: 0.5 for paper_id in self.paper_ids
        }
        raw_sbert = {
            paper_id: 0.5 for paper_id in self.paper_ids
        }

        with _patched_component_scorers(raw_tfidf, raw_sbert):
            battle = compare_pipelines(
                db=self.db,
                query=self.query,
                seed_paper_id=None,
                top_k=4,
                custom_weights=build_custom_weights(1, 0, 0),
            )

        self.assertEqual(
            [battle_pipeline.id for battle_pipeline in battle.pipelines][:6],
            list(PIPELINE_ORDER),
        )
        self.assertTrue(battle.pipelines[0].results)


class RecommendationEndpointComponentsTest(_ComponentFixture):
    """
    /api/recommendations serializes the breakdown through its response
    model, including for paged responses.
    """

    def _client(self):
        from fastapi.testclient import TestClient

        from app.api import app
        from app.database import get_session

        def override_get_session():
            yield self.db

        app.dependency_overrides[get_session] = override_get_session
        self.addCleanup(app.dependency_overrides.clear)

        return TestClient(app)

    def _params(self, **overrides):
        params = {
            "pipeline": "custom",
            "query": self.query,
            "top_k": 4,
            "w_tfidf": 0,
            "w_sbert": 0,
            "w_metadata": 100,
        }
        params.update(overrides)
        return params

    def test_recommendations_endpoint_serializes_components(self):
        response = self._client().get(
            "/api/recommendations",
            params=self._params(),
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(len(payload), 4)

        for item in payload:
            self.assertIn("components", item)
            self.assertEqual(
                set(item["components"]),
                {"tfidf", "sbert", "metadata"},
            )
            self.assertEqual(item["components"]["tfidf"], 0.0)
            self.assertEqual(item["components"]["sbert"], 0.0)
            total = sum(item["components"].values())
            self.assertLessEqual(abs(total - item["score"]), 1e-6)

    def test_paged_recommendations_keep_components(self):
        response = self._client().get(
            "/api/recommendations",
            params=self._params(page=2, page_size=2),
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(len(payload), 2)

        for item in payload:
            self.assertIn("components", item)


if __name__ == "__main__":
    unittest.main()
