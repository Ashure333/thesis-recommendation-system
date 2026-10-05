import json
import math
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.services.evaluation import metrics, runner
from app.services.evaluation.qrels import (
    Qrels,
    QrelsError,
    QrelsQuery,
    QrelsValidationError,
    build_qrels_from_openalex,
    load_qrels,
    save_qrels,
)


FIXTURE_PATH = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "qrels_sample.json"
)


class MetricsTest(unittest.TestCase):
    def test_worked_example_binary_relevance(self):
        ranked = ["a", "b", "c", "d"]
        relevant = {"b", "d"}

        self.assertEqual(
            metrics.precision_at_k(ranked, relevant, 4),
            0.5,
        )
        self.assertEqual(
            metrics.recall_at_k(ranked, relevant, 4),
            1.0,
        )
        self.assertEqual(
            metrics.hit_rate_at_k(ranked, relevant, 4),
            1.0,
        )
        self.assertEqual(
            metrics.mrr_at_k(ranked, relevant, 4),
            0.5,
        )
        self.assertEqual(
            metrics.map_at_k(ranked, relevant, 4),
            (1 / 2 + 2 / 4) / 2,
        )

    def test_precision_keeps_k_as_denominator_when_results_are_short(self):
        ranked = ["a"]
        relevant = {"a"}

        self.assertAlmostEqual(
            metrics.precision_at_k(ranked, relevant, 5),
            0.2,
        )
        self.assertEqual(
            metrics.recall_at_k(ranked, relevant, 5),
            1.0,
        )
        self.assertEqual(
            metrics.ndcg_at_k(ranked, {"a": 1}, 5),
            1.0,
        )

    def test_empty_ranked_list_scores_zero_everywhere(self):
        relevant = {"a", "b"}
        graded = {"a": 2, "b": 1}

        self.assertEqual(metrics.precision_at_k([], relevant, 3), 0.0)
        self.assertEqual(metrics.recall_at_k([], relevant, 3), 0.0)
        self.assertEqual(metrics.hit_rate_at_k([], relevant, 3), 0.0)
        self.assertEqual(metrics.mrr_at_k([], relevant, 3), 0.0)
        self.assertEqual(metrics.map_at_k([], relevant, 3), 0.0)
        self.assertEqual(
            metrics.ndcg_at_k([], graded, 3),
            0.0,
        )

    def test_no_relevant_documents_scores_zero_everywhere(self):
        ranked = ["a", "b"]

        self.assertEqual(
            metrics.precision_at_k(ranked, set(), 3),
            0.0,
        )
        self.assertEqual(
            metrics.recall_at_k(ranked, set(), 3),
            0.0,
        )
        self.assertEqual(
            metrics.hit_rate_at_k(ranked, set(), 3),
            0.0,
        )
        self.assertEqual(
            metrics.mrr_at_k(ranked, set(), 3),
            0.0,
        )
        self.assertEqual(
            metrics.map_at_k(ranked, set(), 3),
            0.0,
        )
        self.assertEqual(
            metrics.ndcg_at_k(ranked, {}, 3),
            0.0,
        )

    def test_duplicate_ids_counted_once_at_first_position(self):
        ranked = ["a", "a", "b", "b"]
        relevant = {"a", "b"}
        graded = {"a": 1, "b": 1}

        self.assertEqual(
            metrics.precision_at_k(ranked, relevant, 4),
            0.5,
        )
        self.assertEqual(
            metrics.recall_at_k(ranked, relevant, 4),
            1.0,
        )
        self.assertEqual(
            metrics.hit_rate_at_k(ranked, relevant, 4),
            1.0,
        )
        self.assertEqual(
            metrics.mrr_at_k(ranked, relevant, 4),
            1.0,
        )
        self.assertEqual(
            metrics.map_at_k(ranked, relevant, 4),
            1.0,
        )
        self.assertEqual(
            metrics.ndcg_at_k(ranked, graded, 4),
            1.0,
        )

    def test_ndcg_graded_hand_computed(self):
        ranked = ["b", "a", "c"]
        graded = {"a": 2, "b": 1}

        expected_dcg = (
            1.0 / math.log2(2)
            + 3.0 / math.log2(3)
        )
        expected_idcg = (
            3.0 / math.log2(2)
            + 1.0 / math.log2(3)
        )

        self.assertAlmostEqual(
            metrics.dcg_at_k(ranked, graded, 3),
            expected_dcg,
        )
        self.assertAlmostEqual(
            metrics.ndcg_at_k(ranked, graded, 3),
            expected_dcg / expected_idcg,
        )

    def test_ndcg_perfect_ranking_is_one_and_binary_is_grade_one(self):
        self.assertEqual(
            metrics.ndcg_at_k(["a", "b"], {"a": 2, "b": 1}, 2),
            1.0,
        )
        self.assertEqual(
            metrics.ndcg_at_k(["a", "b"], {"a": 1, "b": 1}, 2),
            1.0,
        )

    def test_ndcg_zero_or_missing_grades_scores_zero(self):
        self.assertEqual(metrics.ndcg_at_k(["a"], {}, 3), 0.0)
        self.assertEqual(
            metrics.ndcg_at_k(["a"], {"b": 0}, 3),
            0.0,
        )

    def test_ndcg_ideal_ranking_is_truncated_to_k(self):
        expected = (2**1 - 1) / 1.0 / ((2**3 - 1) / 1.0)

        self.assertAlmostEqual(
            metrics.ndcg_at_k(["a"], {"a": 1, "b": 3}, 1),
            expected,
        )

    def test_k_must_be_a_positive_integer(self):
        for invalid_k in (0, -1, 2.5, True):
            with self.assertRaises(ValueError):
                metrics.precision_at_k(["a"], {"a"}, invalid_k)


class QrelsTest(unittest.TestCase):
    def _load_text(self, text: str):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "qrels.json"
            path.write_text(text, encoding="utf-8")
            return load_qrels(path)

    def test_fixture_loads_both_query_kinds(self):
        qrels = load_qrels(FIXTURE_PATH)

        self.assertEqual(len(qrels), 2)

        seed_query, text_query = qrels.queries

        self.assertEqual(seed_query.kind, "seed")
        self.assertEqual(seed_query.seed_paper_id, 4)
        self.assertEqual(
            seed_query.relevance,
            {5: 2, 6: 1, 11: 1},
        )
        self.assertEqual(seed_query.label, "seed:4")

        self.assertEqual(text_query.kind, "text")
        self.assertEqual(
            text_query.query,
            "chromatic number of the plane",
        )
        self.assertEqual(
            text_query.relevance,
            {4: 2, 5: 1, 12: 1},
        )

    def test_save_and_reload_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "nested" / "out.json"

            save_qrels(
                Qrels(
                    [
                        QrelsQuery(
                            kind="seed",
                            seed_paper_id=3,
                            relevance={9: 2, 10: 1},
                        ),
                        QrelsQuery(
                            kind="text",
                            query=" spectral graphs ",
                            relevance={1: 1},
                        ),
                    ]
                ),
                path,
            )

            reloaded = load_qrels(path)

            self.assertEqual(len(reloaded), 2)
            self.assertEqual(
                reloaded.queries[0].relevance,
                {9: 2, 10: 1},
            )
            self.assertEqual(
                reloaded.queries[1].query,
                "spectral graphs",
            )
            self.assertEqual(
                reloaded.queries[1].relevance,
                {1: 1},
            )

    def test_missing_file_raises_qrels_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(QrelsError):
                load_qrels(Path(tmp) / "does-not-exist.json")

    def test_malformed_json_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text("{ not valid json")

    def test_unknown_kind_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text(
                json.dumps(
                    {
                        "queries": [
                            {
                                "kind": "topic",
                                "query": "x",
                                "relevance": {"1": 1},
                            }
                        ]
                    }
                )
            )

    def test_non_integer_relevance_id_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text(
                json.dumps(
                    {
                        "queries": [
                            {
                                "kind": "seed",
                                "seed_paper_id": 1,
                                "relevance": {"paper-a": 1},
                            }
                        ]
                    }
                )
            )

    def test_non_integer_grade_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text(
                json.dumps(
                    {
                        "queries": [
                            {
                                "kind": "text",
                                "query": "x",
                                "relevance": {"1": "high"},
                            }
                        ]
                    }
                )
            )

    def test_seed_query_without_seed_id_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text(
                json.dumps(
                    {
                        "queries": [
                            {
                                "kind": "seed",
                                "relevance": {"1": 1},
                            }
                        ]
                    }
                )
            )

    def test_text_query_without_query_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text(
                json.dumps(
                    {
                        "queries": [
                            {
                                "kind": "text",
                                "query": "   ",
                                "relevance": {"1": 1},
                            }
                        ]
                    }
                )
            )

    def test_missing_or_empty_queries_raises_validation_error(self):
        with self.assertRaises(QrelsValidationError):
            self._load_text(json.dumps({"nope": []}))

        with self.assertRaises(QrelsValidationError):
            self._load_text(json.dumps({"queries": []}))


def _fetch_work(work_id: str, title: str, referenced=None, cited_by=None):
    return {
        "id": f"https://openalex.org/{work_id}",
        "title": title,
        "referenced_works": [
            f"https://openalex.org/{reference}"
            for reference in (referenced or [])
        ],
        "cited_by_api_url": cited_by,
    }


WORK_A = _fetch_work(
    "W1",
    "Work A",
    referenced=["W2", "W3"],
    cited_by="https://api.openalex.org/works?filter=cites:W1",
)
WORK_B = _fetch_work(
    "W2",
    "Work B",
    referenced=["W1"],
    cited_by="https://api.openalex.org/works?filter=cites:W2",
)
WORK_C = _fetch_work("W3", "Work C")

DOI_TO_PAPER_ID = {
    "10.1000/a": 1,
    "10.1000/b": 2,
    "10.1000/c": 3,
}


def _fake_openalex(url: str, timeout: float):
    if url.endswith("/10.1000/a"):
        return WORK_A
    if url.endswith("/10.1000/b"):
        return WORK_B
    if url.endswith("/10.1000/c"):
        return WORK_C
    if "cites:W1" in url:
        return {"results": [WORK_B]}
    if "cites:" in url:
        return {"results": []}

    raise AssertionError(f"unexpected URL: {url}")


def _failing_fetch(url: str, timeout: float):
    raise RuntimeError("network down")


class BuildQrelsFromOpenalexTest(unittest.TestCase):
    def test_derives_grades_references_and_co_citations(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "qrels.json"

            summary = build_qrels_from_openalex(
                ["10.1000/a", "10.1000/b", "10.1000/c"],
                tmp,
                output_path,
                doi_to_paper_id=DOI_TO_PAPER_ID,
                fetch_json=_fake_openalex,
            )

            self.assertTrue(summary["ok"], summary["error"])
            self.assertEqual(summary["query_count"], 2)
            self.assertEqual(summary["judgment_count"], 3)
            self.assertEqual(summary["failures"], [])

            by_label = {
                query.label: query
                for query in load_qrels(output_path).queries
            }

            self.assertEqual(
                by_label["seed:1"].relevance,
                {2: 2, 3: 1},
            )
            self.assertEqual(
                by_label["seed:2"].relevance,
                {1: 1},
            )

    def test_without_mapping_emits_text_queries_with_openalex_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            summary = build_qrels_from_openalex(
                ["10.1000/a", "10.1000/b", "10.1000/c"],
                tmp,
                fetch_json=_fake_openalex,
            )

            self.assertTrue(summary["ok"], summary["error"])

            by_label = {
                query["query"]: query
                for query in summary["qrels"]["queries"]
            }

            self.assertEqual(
                by_label["Work A"]["relevance"],
                {"2": 2, "3": 1},
            )
            self.assertEqual(
                by_label["Work B"]["relevance"],
                {"1": 1},
            )

    def test_merges_with_an_existing_qrels_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            output_path = Path(tmp) / "qrels.json"

            save_qrels(
                Qrels(
                    [
                        QrelsQuery(
                            kind="seed",
                            seed_paper_id=1,
                            relevance={2: 1, 9: 1},
                        ),
                        QrelsQuery(
                            kind="text",
                            query="keep me",
                            relevance={7: 1},
                        ),
                    ]
                ),
                output_path,
            )

            summary = build_qrels_from_openalex(
                ["10.1000/a", "10.1000/b", "10.1000/c"],
                tmp,
                output_path,
                doi_to_paper_id=DOI_TO_PAPER_ID,
                fetch_json=_fake_openalex,
            )

            self.assertTrue(summary["ok"], summary["error"])

            by_label = {
                query.label: query
                for query in load_qrels(output_path).queries
            }

            self.assertEqual(
                by_label["seed:1"].relevance,
                {2: 2, 3: 1, 9: 1},
            )
            self.assertIn("text:keep me", by_label)

    def test_cached_responses_are_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            first = build_qrels_from_openalex(
                ["10.1000/a", "10.1000/b"],
                tmp,
                doi_to_paper_id=DOI_TO_PAPER_ID,
                fetch_json=_fake_openalex,
            )
            self.assertTrue(first["ok"], first["error"])
            self.assertGreater(first["fetched"], 0)

            second = build_qrels_from_openalex(
                ["10.1000/a", "10.1000/b"],
                tmp,
                doi_to_paper_id=DOI_TO_PAPER_ID,
                fetch_json=_failing_fetch,
            )

            self.assertTrue(second["ok"], second["error"])
            self.assertEqual(second["cached"], first["fetched"])
            self.assertEqual(second["failures"], [])

    def test_network_failure_returns_structured_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            summary = build_qrels_from_openalex(
                ["10.1000/a"],
                tmp,
                fetch_json=_failing_fetch,
            )

            self.assertFalse(summary["ok"])
            self.assertIn("No OpenAlex works", summary["error"])
            self.assertEqual(len(summary["failures"]), 1)
            self.assertIn("RuntimeError", summary["failures"][0]["error"])

    def test_no_dois_returns_structured_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            summary = build_qrels_from_openalex(
                [],
                tmp,
                fetch_json=_fake_openalex,
            )

            self.assertFalse(summary["ok"])
            self.assertIn("At least one DOI", summary["error"])


IDCG = 3.0 + 1.0 / math.log2(3) + 0.5
Q1_NDCG = 3.5 / IDCG
Q2_NDCG = (3.0 / math.log2(3) + 0.5) / IDCG

EXPECTED_MACRO_METRICS = {
    "precision_at_k": 0.5,
    "recall_at_k": 2 / 3,
    "hit_rate_at_k": 1.0,
    "mrr_at_k": 0.75,
    "map_at_k": (5 / 9 + 7 / 18) / 2,
    "ndcg_at_k": (Q1_NDCG + Q2_NDCG) / 2,
}


class RunnerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.qrels = load_qrels(FIXTURE_PATH)

    def _fake_run_search(self, calls):
        def fake_run_search(
            *,
            db,
            query=None,
            seed_paper_id=None,
            pipeline="tfidf",
            top_k=10,
            custom_weights=None,
        ):
            calls.append(
                {
                    "db": db,
                    "query": query,
                    "seed_paper_id": seed_paper_id,
                    "pipeline": pipeline,
                    "top_k": top_k,
                    "custom_weights": custom_weights,
                }
            )

            if seed_paper_id == 4:
                ids = [5, 9, 6, 7]
            elif query == "chromatic number of the plane":
                ids = [6, 4, 5, 8]
            else:
                ids = []

            return [
                {
                    "paper": SimpleNamespace(id=paper_id),
                    "score": 1.0,
                }
                for paper_id in ids[:top_k]
            ]

        return fake_run_search

    def test_macro_averages_metrics_per_pipeline(self):
        calls = []

        result = runner.evaluate(
            db=object(),
            qrels=self.qrels,
            pipelines=["tfidf", "sbert"],
            top_k=4,
            run_search=self._fake_run_search(calls),
        )

        self.assertEqual(result["top_k"], 4)
        self.assertEqual(result["query_count"], 2)
        self.assertEqual(
            sorted(result["pipelines"]),
            ["sbert", "tfidf"],
        )

        for name in ("tfidf", "sbert"):
            payload = result["pipelines"][name]

            for metric_name, expected in EXPECTED_MACRO_METRICS.items():
                self.assertAlmostEqual(
                    payload["metrics"][metric_name],
                    expected,
                    places=9,
                )

            self.assertEqual(len(payload["per_query"]), 2)

            seed_entry, text_entry = payload["per_query"]

            self.assertEqual(seed_entry["label"], "seed:4")
            self.assertEqual(seed_entry["ranked_ids"], [5, 9, 6, 7])
            self.assertEqual(seed_entry["num_relevant"], 3)
            self.assertEqual(seed_entry["num_results"], 4)

            self.assertEqual(
                text_entry["label"],
                "text:chromatic number of the plane",
            )
            self.assertEqual(text_entry["ranked_ids"], [6, 4, 5, 8])

        json.dumps(result)

        seed_calls = [
            call for call in calls if call["seed_paper_id"] == 4
        ]
        text_calls = [
            call
            for call in calls
            if call["query"] == "chromatic number of the plane"
        ]

        self.assertEqual(len(seed_calls), 2)
        self.assertEqual(len(text_calls), 2)
        self.assertTrue(
            all(call["query"] is None for call in seed_calls)
        )
        self.assertTrue(
            all(call["seed_paper_id"] is None for call in text_calls)
        )

    def test_custom_pipeline_receives_weights(self):
        calls = []
        weights = {
            "tfidf": 0.5,
            "sbert": 0.3,
            "metadata": 0.2,
        }

        result = runner.evaluate(
            db=object(),
            qrels=self.qrels,
            pipelines=["custom"],
            top_k=4,
            pipeline_weights={"custom": weights},
            run_search=self._fake_run_search(calls),
        )

        self.assertIn("custom", result["pipelines"])
        self.assertTrue(calls)
        self.assertTrue(
            all(call["pipeline"] == "custom" for call in calls)
        )
        self.assertEqual(calls[0]["custom_weights"], weights)

    def test_custom_pipeline_without_weights_raises(self):
        with self.assertRaises(ValueError):
            runner.evaluate(
                db=object(),
                qrels=self.qrels,
                pipelines=["custom"],
                top_k=4,
                run_search=self._fake_run_search([]),
            )

    def test_weights_for_preset_pipeline_raise(self):
        with self.assertRaises(ValueError):
            runner.evaluate(
                db=object(),
                qrels=self.qrels,
                pipelines=["tfidf"],
                top_k=4,
                pipeline_weights={
                    "tfidf": {
                        "tfidf": 1.0,
                        "sbert": 0.0,
                        "metadata": 0.0,
                    }
                },
                run_search=self._fake_run_search([]),
            )

    def test_top_k_bounds_are_guarded(self):
        for bad_top_k in (0, -1, 101, True):
            with self.assertRaises(ValueError):
                runner.evaluate(
                    db=object(),
                    qrels=self.qrels,
                    pipelines=["tfidf"],
                    top_k=bad_top_k,
                    run_search=self._fake_run_search([]),
                )

    def test_unknown_pipeline_raises(self):
        with self.assertRaises(ValueError):
            runner.evaluate(
                db=object(),
                qrels=self.qrels,
                pipelines=["not-a-pipeline"],
                top_k=4,
                run_search=self._fake_run_search([]),
            )

    def test_default_pipelines_cover_all_six_presets(self):
        calls = []

        result = runner.evaluate(
            db=object(),
            qrels=self.qrels,
            top_k=4,
            run_search=self._fake_run_search(calls),
        )

        self.assertEqual(len(result["pipelines"]), 6)


if __name__ == "__main__":
    unittest.main()
