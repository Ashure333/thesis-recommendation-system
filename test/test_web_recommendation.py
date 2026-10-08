"""Web recommendations: live hits ranked by ONE pipeline's weights."""

import unittest

from app.services.recommendation.compare_service import rank_web_results
from app.services.recommendation.pipeline_config import get_pipeline_weights
from app.services.web_search import WebSearchResult


def _hit(title, abstract, year):
    return WebSearchResult(
        title=title,
        abstract=abstract,
        publication_year=year,
        source="openalex",
    )


HITS = [
    _hit(
        "Graph neural networks for recommender systems",
        "We rank items with graph neural networks over user item graphs.",
        2023,
    ),
    _hit(
        "A history of medieval pottery",
        "Glazes and kilns of the twelfth century.",
        2001,
    ),
    _hit(
        "Matrix factorization for collaborative filtering",
        "Latent factors recover user preferences from ratings.",
        2019,
    ),
]


class RankWebResultsTests(unittest.TestCase):
    def rank(self, pipeline, top_k=3):
        return rank_web_results(
            query="graph neural networks recommender",
            hits=HITS,
            weights=get_pipeline_weights(pipeline),
            top_k=top_k,
        )

    def test_rows_are_ranked_best_first_with_sequential_ranks(self):
        rows = self.rank("tfidf_sbert_metadata")

        self.assertEqual([row["rank"] for row in rows], list(range(1, len(rows) + 1)))
        self.assertEqual(
            [row["score"] for row in rows],
            sorted((row["score"] for row in rows), reverse=True),
        )

    def test_the_on_topic_hit_wins_and_the_off_topic_one_is_last_or_absent(self):
        rows = self.rank("tfidf")

        self.assertEqual(rows[0]["title"], HITS[0].title)
        self.assertNotEqual(rows[0]["title"], HITS[1].title)

    def test_every_row_carries_the_hit_and_its_component_scores(self):
        row = self.rank("sbert")[0]

        self.assertEqual(row["source"], "openalex")
        self.assertEqual(set(row["components"]), {"tfidf", "sbert", "metadata"})

    def test_a_pipeline_without_a_signal_does_not_use_it(self):
        row = self.rank("tfidf")[0]

        self.assertEqual(row["components"]["sbert"], 0.0)

    def test_top_k_limits_the_rows(self):
        self.assertLessEqual(len(self.rank("tfidf", top_k=1)), 1)

    def test_no_hits_gives_no_rows(self):
        self.assertEqual(
            rank_web_results(
                query="anything",
                hits=[],
                weights=get_pipeline_weights("tfidf"),
                top_k=5,
            ),
            [],
        )


if __name__ == "__main__":
    unittest.main()
