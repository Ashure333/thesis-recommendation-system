import math
import unittest

import numpy as np

from app.services.evaluation import stats


class SpecialFunctionTest(unittest.TestCase):
    def test_chi2_sf_known_values(self):
        # Standard table values.
        self.assertAlmostEqual(stats.chi2_sf(3.841458820694124, 1), 0.05, places=6)
        self.assertAlmostEqual(stats.chi2_sf(5.991464547107979, 2), 0.05, places=6)
        self.assertAlmostEqual(stats.chi2_sf(0.0, 3), 1.0)
        self.assertAlmostEqual(stats.chi2_sf(20.0, 5), 0.0012, places=4)

    def test_normal_ppf(self):
        self.assertAlmostEqual(stats._normal_ppf(0.975), 1.959964, places=5)
        self.assertAlmostEqual(stats._normal_ppf(0.5), 0.0, places=9)
        self.assertAlmostEqual(stats._normal_ppf(0.01), -2.326348, places=5)


class BootstrapTest(unittest.TestCase):
    def test_ci_contains_mean_and_is_seeded(self):
        data = [0.1, 0.4, 0.5, 0.7, 0.2, 0.9, 0.3, 0.6]
        first = stats.bootstrap_ci(data, resamples=2000, seed=1)
        second = stats.bootstrap_ci(data, resamples=2000, seed=1)

        self.assertEqual(first, second)
        self.assertAlmostEqual(first["mean"], sum(data) / len(data))
        self.assertLess(first["lo"], first["mean"])
        self.assertGreater(first["hi"], first["mean"])

    def test_constant_data_has_degenerate_interval(self):
        result = stats.bootstrap_ci([0.5] * 6)
        self.assertEqual((result["lo"], result["hi"]), (0.5, 0.5))

    def test_paired_bootstrap_detects_consistent_gap(self):
        a = [0.6, 0.7, 0.65, 0.8, 0.7, 0.75]
        b = [x - 0.1 for x in a]
        result = stats.paired_bootstrap(a, b, resamples=500, seed=3)

        self.assertAlmostEqual(result["mean_diff"], 0.1)
        self.assertTrue(result["excludes_zero"])

    def test_paired_bootstrap_length_mismatch(self):
        with self.assertRaises(ValueError):
            stats.paired_bootstrap([1, 2], [1])


class RankTestTest(unittest.TestCase):
    def test_wilcoxon_matches_hand_computation(self):
        # Differences 1..5 all positive: W- = 0, exact two-sided p
        # = 2 / 2^5 = 0.0625.
        result = stats.wilcoxon_signed_rank([1, 2, 3, 4, 5], [0] * 5)
        self.assertAlmostEqual(result["p_value"], 0.0625)
        self.assertEqual(result["statistic"], 0.0)

    def test_wilcoxon_symmetric_is_not_significant(self):
        result = stats.wilcoxon_signed_rank([1, -2, 3, -4], [0] * 4)
        self.assertGreater(result["p_value"], 0.5)

    def test_wilcoxon_all_equal(self):
        result = stats.wilcoxon_signed_rank([1, 2], [1, 2])
        self.assertEqual(result["p_value"], 1.0)
        self.assertEqual(result["n"], 0)

    def test_wilcoxon_handles_ties_exactly(self):
        result = stats.wilcoxon_signed_rank([1, 1, 1, 1, -1], [0] * 5)
        self.assertTrue(0.0 < result["p_value"] <= 1.0)

    def test_wilcoxon_normal_approximation_agrees_with_exact(self):
        rng = np.random.default_rng(0)
        a = rng.normal(0.1, 0.2, 50)
        zeros = np.zeros(50)
        exact = stats.wilcoxon_signed_rank(a, zeros)["p_value"]

        original = stats.WILCOXON_EXACT_MAX_N
        stats.WILCOXON_EXACT_MAX_N = 1
        try:
            approx = stats.wilcoxon_signed_rank(a, zeros)["p_value"]
        finally:
            stats.WILCOXON_EXACT_MAX_N = original

        self.assertAlmostEqual(exact, approx, delta=0.02)

    def test_friedman_known_example(self):
        # Three pipelines, perfectly consistent ordering on 6 queries:
        # rank sums 6 / 12 / 18, Q = 12 / (6*3*4) * (36+0+36) = 12.
        scores = {
            "a": [3, 3, 3, 3, 3, 3],
            "b": [2, 2, 2, 2, 2, 2],
            "c": [1, 1, 1, 1, 1, 1],
        }
        result = stats.friedman(scores)

        self.assertAlmostEqual(result["statistic"], 12.0)
        self.assertEqual(result["df"], 2)
        self.assertAlmostEqual(result["p_value"], math.exp(-6.0), places=6)
        self.assertEqual(result["mean_ranks"]["a"], 1.0)

    def test_friedman_all_tied_is_not_significant(self):
        scores = {"a": [0.5, 0.5, 0.5], "b": [0.5, 0.5, 0.5]}
        result = stats.friedman(scores)
        self.assertEqual(result["statistic"], 0.0)
        self.assertEqual(result["p_value"], 1.0)

    def test_holm_adjustment(self):
        adjusted = stats.holm_adjust([0.01, 0.04, 0.03])
        self.assertAlmostEqual(adjusted[0], 0.03)
        self.assertAlmostEqual(adjusted[1], 0.06)
        self.assertAlmostEqual(adjusted[2], 0.06)

    def test_holm_is_monotone_and_capped(self):
        adjusted = stats.holm_adjust([0.5, 0.9])
        self.assertEqual(adjusted, [1.0, 1.0])


class EffectSizeTest(unittest.TestCase):
    def test_cliffs_delta_extremes(self):
        self.assertEqual(stats.cliffs_delta([3, 4], [1, 2]), 1.0)
        self.assertEqual(stats.cliffs_delta([1, 2], [3, 4]), -1.0)
        self.assertEqual(stats.cliffs_delta([1, 2], [1, 2]), 0.0)

    def test_cliffs_delta_partial(self):
        # pairs: (2>1)=+, (2<3)=-, (4>1)=+, (4>3)=+ -> (3-1)/4
        self.assertAlmostEqual(stats.cliffs_delta([2, 4], [1, 3]), 0.5)

    def test_cohens_dz(self):
        self.assertAlmostEqual(
            stats.paired_cohens_dz([2, 4, 6], [1, 2, 3]),
            2.0 / 1.0,
        )
        self.assertEqual(stats.paired_cohens_dz([1, 1], [1, 1]), 0.0)


class SampleSizeTest(unittest.TestCase):
    def test_documented_figures(self):
        self.assertEqual(stats.required_sample_size(0.05, 0.2), 126)
        self.assertEqual(stats.required_sample_size(0.05, 0.1), 32)

    def test_zero_spread(self):
        self.assertEqual(stats.required_sample_size(0.05, 0.0), 2)

    def test_rejects_bad_effect(self):
        with self.assertRaises(ValueError):
            stats.required_sample_size(0.0, 0.2)


class BradleyTerryTest(unittest.TestCase):
    def test_stronger_item_rates_higher(self):
        votes = [("a", "b")] * 8 + [("b", "a")] * 2
        rating = stats.bradley_terry(votes)

        self.assertGreater(rating["a"], rating["b"])
        # Geometric mean normalised to 1.
        self.assertAlmostEqual(rating["a"] * rating["b"], 1.0, places=6)
        # MLE odds a:b is 8:2 = 4 (regularisation nudges slightly).
        self.assertAlmostEqual(rating["a"] / rating["b"], 4.0, delta=0.2)

    def test_symmetric_votes_give_equal_ratings(self):
        rating = stats.bradley_terry([("a", "b"), ("b", "a")] * 5)
        self.assertAlmostEqual(rating["a"], rating["b"], places=6)

    def test_empty_and_self_vote(self):
        self.assertEqual(stats.bradley_terry([]), {})
        with self.assertRaises(ValueError):
            stats.bradley_terry([("a", "a")])

    def test_ci_brackets_the_point_estimate(self):
        votes = [("a", "b")] * 12 + [("b", "a")] * 4 + [("b", "c")] * 9 + [("c", "b")] * 5
        ci = stats.bradley_terry_ci(votes, resamples=200, seed=1)

        for entry in ci.values():
            self.assertLessEqual(entry["lo"], entry["hi"])


class RankWithTiesTest(unittest.TestCase):
    def _scores(self, n=80, seed=0, shifts=None):
        rng = np.random.default_rng(seed)
        shifts = shifts or {"a": 0.0, "b": 0.0, "c": 0.0}
        base = rng.uniform(0.2, 0.8, n)
        return {
            name: np.clip(base + shift + rng.normal(0, 0.05, n), 0, 1)
            for name, shift in shifts.items()
        }

    def test_clear_winner(self):
        scores = self._scores(shifts={"a": 0.15, "b": 0.0, "c": -0.1})
        result = stats.rank_with_ties(scores, resamples=500, seed=1)

        self.assertEqual(result["outcome"], stats.OUTCOME_WINNER)
        self.assertEqual(result["winner"], "a")
        self.assertEqual(result["ranking"][0]["pipeline"], "a")

    def test_identical_pipelines_tie(self):
        base = self._scores(shifts={"a": 0.0})["a"]
        scores = {"a": base, "b": base.copy(), "c": base.copy()}
        result = stats.rank_with_ties(scores, resamples=200, seed=1)

        self.assertIsNone(result["winner"])
        self.assertIn(result["outcome"], {stats.OUTCOME_TIE, stats.OUTCOME_INCONCLUSIVE})
        self.assertEqual(len(result["tie_groups"]), 1)

    def test_two_leaders_form_a_tie_group(self):
        scores = self._scores(shifts={"a": 0.1, "b": 0.1, "c": -0.2}, seed=4)
        result = stats.rank_with_ties(scores, resamples=500, seed=1)

        self.assertIsNone(result["winner"])
        self.assertEqual(set(result["top_group"]), {"a", "b"})

    def test_too_few_queries_is_inconclusive(self):
        scores = {"a": [0.5, 0.6, 0.55], "b": [0.5, 0.6, 0.56]}
        result = stats.rank_with_ties(scores, resamples=200, seed=1)

        self.assertEqual(result["outcome"], stats.OUTCOME_INCONCLUSIVE)
        self.assertIsNone(result["winner"])

    def test_single_query_is_inconclusive(self):
        result = stats.rank_with_ties({"a": [0.5], "b": [0.4]})
        self.assertEqual(result["outcome"], stats.OUTCOME_INCONCLUSIVE)

    def test_deterministic_given_seed(self):
        scores = self._scores(shifts={"a": 0.1, "b": 0.0})
        first = stats.rank_with_ties(scores, resamples=300, seed=9)
        second = stats.rank_with_ties(scores, resamples=300, seed=9)
        self.assertEqual(first, second)

    def test_validation(self):
        with self.assertRaises(ValueError):
            stats.rank_with_ties({"a": [1, 2]})
        with self.assertRaises(ValueError):
            stats.rank_with_ties({"a": [1, 2], "b": [1]})

    def test_null_false_positive_rate_is_near_alpha(self):
        # Pipelines drawn from the same distribution must crown a
        # winner no more than about alpha of the time.
        rng = np.random.default_rng(123)
        trials = 120
        winners = 0

        for _ in range(trials):
            scores = {
                name: rng.uniform(0, 1, 40) for name in ("a", "b", "c")
            }
            result = stats.rank_with_ties(scores, resamples=100, seed=1)
            winners += result["outcome"] == stats.OUTCOME_WINNER

        self.assertLessEqual(winners / trials, 0.10)


if __name__ == "__main__":
    unittest.main()
