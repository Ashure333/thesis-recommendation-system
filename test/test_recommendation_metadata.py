import unittest

from app.models.models import Paper
from app.services.recommendation import metadata_pipeline
from app.services.recommendation import search_service
from app.services.recommendation.similarity import min_max_normalize


def _paper(paper_id: int, **metadata) -> Paper:
    paper = Paper(id=paper_id, title=metadata.pop("title", "paper"))
    for field, value in metadata.items():
        setattr(paper, field, value)
    return paper


class RecommendationMetadataTest(unittest.TestCase):
    def test_free_text_metadata_scores_all_text_fields_without_inventing_year(
        self,
    ):
        candidates = [
            _paper(
                1,
                title="Unrelated title",
                abstract="recommendation systems and ranking",
                keywords="information retrieval",
                publication_year=2024,
            ),
            _paper(
                2,
                title="Unrelated title",
                abstract=None,
                keywords=None,
                publication_year=2024,
            ),
        ]

        scores = metadata_pipeline.score_candidates(
            query="recommendation systems",
            seed_paper=None,
            candidates=candidates,
        )

        self.assertGreater(scores[1], 0)
        self.assertGreater(scores[1], scores[2])
        self.assertIsNone(
            metadata_pipeline._get_query_metadata(
                "recommendation systems", None
            )["publication_year"]
        )

    def test_metadata_text_batch_scoring_preserves_missing_field_as_zero(
        self,
    ):
        scores = metadata_pipeline._text_similarity_scores(
            "ranking systems",
            ["ranking systems", None, "different topic"],
        )

        self.assertEqual(scores[0], 1.0)
        self.assertEqual(scores[1], 0.0)
        self.assertGreaterEqual(scores[2], 0.0)
        self.assertLessEqual(scores[2], 1.0)

    def test_min_max_normalization_has_one_shared_behavior(self):
        scores = {1: 2.0, 2: 4.0, 3: 3.0}

        expected = {1: 0.0, 2: 1.0, 3: 0.5}
        self.assertEqual(min_max_normalize(scores), expected)
        self.assertEqual(search_service.min_max_normalize(scores), expected)
        self.assertEqual(
            min_max_normalize({1: 7.0, 2: 7.0}), {1: 1.0, 2: 1.0}
        )


if __name__ == "__main__":
    unittest.main()
