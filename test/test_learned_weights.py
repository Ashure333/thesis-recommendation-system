"""
Unit tests for learned recommendation fusion weights.

No network access and no real ``app/data`` files: the optimizer is
scored with a deterministic fake ``run_search`` whose ranking is a
linear function of the candidate weights, and persistence uses
temporary directories.

The fixture is deliberately separable:

    paper 1 -> only tfidf     (grade 1)
    paper 2 -> only sbert     (grade 3, must rank first)
    paper 3 -> only metadata  (grade 2, must rank second)

so the metric is maximized exactly when ``sbert > metadata > tfidf``
on the searched grid. Several grid points satisfy that plateau (a tie
the tests allow); the canonical 0.1-step enumeration reaches
``(0.1, 0.7, 0.2)``, and the baseline 0.4/0.4/0.2 is strictly worse.
"""

import json
import math
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from app.services.evaluation.qrels import Qrels, QrelsQuery
from app.services.recommendation import learned_weights


DOC_COMPONENT_SCORES = {
    1: {"tfidf": 1.0, "sbert": 0.0, "metadata": 0.0},
    2: {"tfidf": 0.0, "sbert": 1.0, "metadata": 0.0},
    3: {"tfidf": 0.0, "sbert": 0.0, "metadata": 1.0},
}

RELEVANCE = {1: 1, 2: 3, 3: 2}


def _fixture_qrels() -> Qrels:
    return Qrels(
        [
            QrelsQuery(
                kind="seed",
                seed_paper_id=99,
                relevance=dict(RELEVANCE),
            ),
            QrelsQuery(
                kind="text",
                query="fusion weights",
                relevance=dict(RELEVANCE),
            ),
        ]
    )


def _make_fake_run_search(calls: list | None = None):
    """
    Deterministic stand-in for ``search_papers``: score each fixture
    paper by the weighted sum of its component scores and sort by
    score (ties by ascending paper id).
    """

    def fake_run_search(
        *,
        db,
        query=None,
        seed_paper_id=None,
        pipeline="tfidf",
        top_k=10,
        custom_weights=None,
    ):
        if calls is not None:
            calls.append(
                {
                    "pipeline": pipeline,
                    "top_k": top_k,
                    "query": query,
                    "seed_paper_id": seed_paper_id,
                    "custom_weights": dict(custom_weights or {}),
                }
            )

        weights = custom_weights or {}

        scored = []

        for paper_id, components in DOC_COMPONENT_SCORES.items():
            score = sum(
                weights.get(name, 0.0) * components[name]
                for name in learned_weights.COMPONENT_NAMES
            )
            scored.append((score, paper_id))

        scored.sort(key=lambda item: (-item[0], item[1]))

        return [
            {
                "paper": SimpleNamespace(id=paper_id),
                "score": score,
            }
            for score, paper_id in scored
        ]

    return fake_run_search


def _valid_document() -> dict:
    return {
        "weights": {
            "tfidf": 0.2,
            "sbert": 0.5,
            "metadata": 0.3,
        },
        "metric": "ndcg_at_k",
        "metric_value": 0.9,
        "baseline": 0.7,
        "improvement": 0.2,
        "learned_at": "2026-01-01T00:00:00Z",
        "query_count": 2,
        "top_k": 10,
        "components": ["tfidf", "sbert", "metadata"],
    }


class OptimizeWeightsTest(unittest.TestCase):
    def _optimize(self, **overrides):
        kwargs = {
            "db": object(),
            "qrels": _fixture_qrels(),
            "top_k": 3,
            "metric": "ndcg_at_k",
            "coarse_step": 0.1,
            "refine_step": 0.05,
            "run_search": _make_fake_run_search(),
        }
        kwargs.update(overrides)

        return learned_weights.optimize_weights(**kwargs)

    def test_recovers_sbert_dominant_optimal_allocation(self):
        result = self._optimize()

        self.assertEqual(result["components"], list(
            learned_weights.COMPONENT_NAMES
        ))
        self.assertEqual(result["metric"]["name"], "ndcg_at_k")
        self.assertEqual(result["metric"]["top_k"], 3)
        self.assertEqual(result["metric"]["queries"], 2)
        self.assertAlmostEqual(result["metric"]["value"], 1.0, places=9)

        weights = result["weights"]

        self.assertAlmostEqual(
            sum(weights.values()),
            1.0,
            places=6,
        )
        self.assertGreater(weights["sbert"], weights["metadata"])
        self.assertGreater(weights["metadata"], weights["tfidf"])
        self.assertGreaterEqual(weights["tfidf"], 0.0)

        self.assertGreater(result["improvement"], 0.0)
        self.assertAlmostEqual(
            result["improvement"],
            result["metric"]["value"] - result["baseline"],
            places=9,
        )
        self.assertLess(result["baseline"], result["metric"]["value"])

        self.assertGreaterEqual(
            result["refined"]["value"],
            result["coarse"]["value"],
        )

    def test_optimizer_is_deterministic(self):
        first = self._optimize()
        second = self._optimize()

        self.assertEqual(first["weights"], second["weights"])
        self.assertEqual(
            first["metric"]["value"],
            second["metric"]["value"],
        )
        self.assertEqual(
            len(first["history"]),
            len(second["history"]),
        )

    def test_history_matches_evaluated_candidates(self):
        calls: list = []
        result = self._optimize(
            run_search=_make_fake_run_search(calls),
        )

        # Two fixture queries per candidate, one history entry each.
        self.assertEqual(
            len(calls),
            2 * len(result["history"]),
        )

        seen = set()

        for entry in result["history"]:
            key = tuple(
                entry["weights"][name]
                for name in learned_weights.COMPONENT_NAMES
            )

            self.assertNotIn(key, seen)
            seen.add(key)

        self.assertGreaterEqual(len(result["history"]), 66)
        self.assertLessEqual(len(result["history"]), 66 + 75)

        json.dumps(result)

    def test_max_queries_limits_evaluation(self):
        calls: list = []
        result = self._optimize(
            max_queries=1,
            run_search=_make_fake_run_search(calls),
        )

        self.assertEqual(result["metric"]["queries"], 1)
        self.assertEqual(len(calls), len(result["history"]))
        self.assertTrue(
            all(call["seed_paper_id"] == 99 for call in calls)
        )

    def test_custom_pipeline_receives_each_candidate_weights(self):
        calls: list = []
        self._optimize(run_search=_make_fake_run_search(calls))

        self.assertTrue(calls)
        self.assertTrue(
            all(call["pipeline"] == "custom" for call in calls)
        )
        self.assertTrue(
            all(
                set(call["custom_weights"])
                == set(learned_weights.COMPONENT_NAMES)
                for call in calls
            )
        )

    def test_components_subset_searches_two_signal_simplex(self):
        result = self._optimize(components=("tfidf", "sbert"))

        self.assertEqual(result["components"], ["tfidf", "sbert"])
        self.assertEqual(result["weights"]["metadata"], 0.0)
        self.assertAlmostEqual(
            result["weights"]["tfidf"] + result["weights"]["sbert"],
            1.0,
            places=6,
        )
        self.assertGreater(
            result["weights"]["sbert"],
            result["weights"]["tfidf"],
        )
        self.assertGreater(result["improvement"], 0.0)
        self.assertEqual(result["metric"]["queries"], 2)

    def test_baseline_is_projected_for_component_subsets(self):
        calls: list = []
        result = self._optimize(
            components=("tfidf", "sbert"),
            run_search=_make_fake_run_search(calls),
        )

        baseline_calls = [
            call
            for call in calls
            if call["custom_weights"] == {
                "tfidf": 0.5,
                "sbert": 0.5,
                "metadata": 0.0,
            }
        ]

        self.assertTrue(baseline_calls)
        self.assertAlmostEqual(
            result["baseline"],
            self._expected_ndcg_at_3([1, 2, 3]),
            places=9,
        )

    @staticmethod
    def _expected_ndcg_at_3(ranked_ids):
        grades = RELEVANCE
        dcg = sum(
            (2 ** grades[paper_id] - 1) / math.log2(1 + position)
            for position, paper_id in enumerate(ranked_ids, start=1)
        )
        ideal = sorted(grades.values(), reverse=True)
        idcg = sum(
            (2 ** grade - 1) / math.log2(1 + position)
            for position, grade in enumerate(ideal, start=1)
        )

        return dcg / idcg

    def test_invalid_metric_raises_before_searching(self):
        calls: list = []

        with self.assertRaises(ValueError):
            self._optimize(
                metric="not_a_metric",
                run_search=_make_fake_run_search(calls),
            )

        self.assertEqual(calls, [])

    def test_invalid_top_k_raises(self):
        for bad_top_k in (0, -1, 101, True, "5"):
            with self.assertRaises(ValueError):
                self._optimize(top_k=bad_top_k)

    def test_invalid_components_raise(self):
        for bad in ("tfidf", [], ("tfidf", "bogus")):
            with self.assertRaises(ValueError):
                self._optimize(components=bad)

    def test_invalid_steps_raise(self):
        with self.assertRaises(ValueError):
            self._optimize(coarse_step=0.3)

        with self.assertRaises(ValueError):
            self._optimize(refine_step=0.0)

    def test_invalid_max_queries_raises(self):
        with self.assertRaises(ValueError):
            self._optimize(max_queries=0)


class SaveLoadTest(unittest.TestCase):
    def _learned_result(self):
        return learned_weights.optimize_weights(
            db=object(),
            qrels=_fixture_qrels(),
            top_k=3,
            metric="ndcg_at_k",
            coarse_step=0.1,
            refine_step=0.05,
            run_search=_make_fake_run_search(),
        )

    def test_save_and_load_round_trip(self):
        result = self._learned_result()

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "nested" / "learned_weights.json"

            written = learned_weights.save_learned_weights(
                result,
                path,
            )

            self.assertEqual(written, path)
            self.assertTrue(path.is_file())

            document = json.loads(path.read_text(encoding="utf-8"))

            for key in (
                "weights",
                "metric",
                "metric_value",
                "baseline",
                "improvement",
                "learned_at",
                "query_count",
                "top_k",
                "components",
            ):
                self.assertIn(key, document)

            loaded = learned_weights.load_learned_weights(path)

            self.assertEqual(loaded["weights"], result["weights"])
            self.assertEqual(loaded["metric"], "ndcg_at_k")
            self.assertAlmostEqual(
                loaded["metric_value"],
                result["metric"]["value"],
                places=9,
            )
            self.assertAlmostEqual(
                loaded["baseline"],
                result["baseline"],
                places=9,
            )
            self.assertAlmostEqual(
                loaded["improvement"],
                result["improvement"],
                places=9,
            )
            self.assertEqual(loaded["top_k"], 3)
            self.assertEqual(loaded["query_count"], 2)
            self.assertEqual(
                loaded["components"],
                list(learned_weights.COMPONENT_NAMES),
            )
            self.assertTrue(loaded["learned_at"])

            timestamp = loaded["learned_at"].replace("Z", "+00:00")

            self.assertIsInstance(
                datetime.fromisoformat(timestamp),
                datetime,
            )

    def _load_document(self, document):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "weights.json"
            path.write_text(
                json.dumps(document),
                encoding="utf-8",
            )

            return learned_weights.load_learned_weights(path)

    def test_load_rejects_missing_keys(self):
        for key in (
            "weights",
            "metric",
            "metric_value",
            "baseline",
            "improvement",
            "learned_at",
            "query_count",
            "top_k",
            "components",
        ):
            document = _valid_document()
            del document[key]

            with self.assertRaises(ValueError):
                self._load_document(document)

    def test_load_rejects_negative_weights(self):
        document = _valid_document()
        document["weights"] = {
            "tfidf": -0.1,
            "sbert": 0.6,
            "metadata": 0.5,
        }

        with self.assertRaises(ValueError):
            self._load_document(document)

    def test_load_rejects_weights_not_summing_to_one(self):
        document = _valid_document()
        document["weights"] = {
            "tfidf": 0.2,
            "sbert": 0.2,
            "metadata": 0.2,
        }

        with self.assertRaises(ValueError):
            self._load_document(document)

    def test_load_rejects_non_finite_numbers(self):
        document = _valid_document()
        document["metric_value"] = float("inf")

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "weights.json"
            path.write_text(
                json.dumps(document),
                encoding="utf-8",
            )

            with self.assertRaises(ValueError):
                learned_weights.load_learned_weights(path)

    def test_load_rejects_unknown_metric_and_bad_top_k(self):
        document = _valid_document()
        document["metric"] = "not_a_metric"

        with self.assertRaises(ValueError):
            self._load_document(document)

        document = _valid_document()
        document["top_k"] = 101

        with self.assertRaises(ValueError):
            self._load_document(document)

    def test_load_rejects_missing_file_and_malformed_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                learned_weights.load_learned_weights(
                    Path(tmp) / "does-not-exist.json"
                )

            path = Path(tmp) / "broken.json"
            path.write_text("{ not valid json", encoding="utf-8")

            with self.assertRaises(ValueError):
                learned_weights.load_learned_weights(path)

    def test_save_rejects_a_result_missing_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "weights.json"

            with self.assertRaises(ValueError):
                learned_weights.save_learned_weights(
                    {"weights": {"tfidf": 1.0}},
                    path,
                )


class DefaultPathTest(unittest.TestCase):
    def test_default_path_is_app_data_learned_weights(self):
        path = learned_weights.default_path()

        self.assertEqual(path.name, "learned_weights.json")
        self.assertEqual(path.parent.name, "data")
        self.assertEqual(path.parent.parent.name, "app")
        self.assertTrue(
            str(path).endswith(
                "app/data/learned_weights.json"
            )
        )


if __name__ == "__main__":
    unittest.main()
