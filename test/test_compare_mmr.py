"""The Lab's experimental diversification knob must reach every
pipeline in a comparison battle.

`compare_pipelines` forwards `mmr_lambda` / `mmr_pool` to each
`run_search` call (all six presets plus an optional custom recipe),
and the default stays a plain score order.

Run from the project root:

    .venv/bin/python -m unittest test.test_compare_mmr -v
"""

import unittest
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.services.recommendation import compare_service


class CompareMmrTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _fake_run_search(self, calls):
        def fake(**kwargs):
            calls.append(kwargs)
            return [
                {"paper": Paper(id=1, title="Alpha"), "score": 0.9},
                {"paper": Paper(id=2, title="Beta"), "score": 0.4},
            ]

        return fake

    def test_diversify_is_forwarded_to_every_pipeline(self):
        calls: list[dict] = []

        with mock.patch.object(
            compare_service,
            "run_search",
            self._fake_run_search(calls),
        ):
            compare_service.compare_pipelines(
                db=self.db,
                query="neural networks",
                seed_paper_id=None,
                top_k=5,
                mmr_lambda=0.7,
                mmr_pool=30,
            )

        self.assertEqual(
            len(calls),
            len(compare_service.PIPELINE_ORDER),
        )

        for call in calls:
            self.assertEqual(call["mmr_lambda"], 0.7)
            self.assertEqual(call["mmr_pool"], 30)

    def test_default_keeps_plain_score_order(self):
        calls: list[dict] = []

        with mock.patch.object(
            compare_service,
            "run_search",
            self._fake_run_search(calls),
        ):
            compare_service.compare_pipelines(
                db=self.db,
                query="neural networks",
                seed_paper_id=None,
                top_k=5,
            )

        self.assertGreater(len(calls), 0)

        for call in calls:
            self.assertIsNone(call["mmr_lambda"])
            self.assertEqual(call["mmr_pool"], 50)


if __name__ == "__main__":
    unittest.main()
