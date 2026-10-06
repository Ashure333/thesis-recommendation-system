"""Literature actions behind the multi-select context menu:
metadata refresh, reveal-in-folder, file rename, mark-as, merge.

Run from the project root:

    .venv/bin/python -m unittest test.test_literature_actions -v
"""

import os
import tempfile
import unittest
import uuid
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import (
    Base,
    Paper,
    PaperCitation,
    PersonalLibrary,
)
from app.services.storage import get_paper_file_path


class LiteratureActionsTest(unittest.TestCase):
    def setUp(self):
        self._temporary_directory = tempfile.TemporaryDirectory()

        engine = create_engine(
            "sqlite:///"
            + os.path.join(
                self._temporary_directory.name,
                "actions.db",
            )
        )
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.addCleanup(engine.dispose)
        self.addCleanup(self._temporary_directory.cleanup)

        self.first = Paper(
            title="Blended Learning in Health Professions",
            author="Smith, J.",
            publication_year=2015,
            doi="10.1/first",
            is_valid_for_recommendation=True,
        )
        self.second = Paper(
            title="Blended learning in health professions review",
            author="Smith, J.",
            abstract="A" * 140,
            keywords="learning, health",
            is_valid_for_recommendation=True,
        )
        self.db.add_all([self.first, self.second])
        self.db.commit()

    # ----------------------------------------------------------
    # Helpers
    # ----------------------------------------------------------

    def _client(self):
        from fastapi.testclient import TestClient

        from app.api import app
        from app.database import get_session

        def override_get_session():
            yield self.db

        app.dependency_overrides[get_session] = override_get_session
        self.addCleanup(app.dependency_overrides.clear)

        return TestClient(app)

    def _temporary_paper_file(self, label: str) -> tuple[str, str]:
        """Create a real file under storage/papers and return
        (stored_path, absolute path); cleaned up by the caller."""
        name = f"test-{label}-{uuid.uuid4().hex[:10]}.pdf"
        absolute = get_paper_file_path(f"papers/{name}")

        with open(absolute, "wb") as handle:
            handle.write(b"%PDF-1.4 test")

        self.addCleanup(
            lambda: os.path.exists(absolute) and os.remove(absolute)
        )

        return f"papers/{name}", absolute

    # ----------------------------------------------------------
    # Refresh metadata
    # ----------------------------------------------------------

    def test_refresh_metadata_enqueues_each_paper(self):
        with mock.patch(
            "app.api.enqueue_paper_enrichment"
        ) as enqueue:
            response = self._client().post(
                "/api/papers/refresh-metadata",
                json={
                    "paper_ids": [
                        self.first.id,
                        self.second.id,
                        self.first.id,
                    ]
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["queued"],
            [self.first.id, self.second.id],
        )
        self.assertEqual(enqueue.call_count, 2)

    # ----------------------------------------------------------
    # Reveal in file manager
    # ----------------------------------------------------------

    def test_reveal_opens_first_paper_with_a_file(self):
        stored_path, absolute = self._temporary_paper_file("reveal")
        self.first.stored_path = stored_path
        self.db.commit()

        with mock.patch(
            "app.api._reveal_in_file_manager",
            return_value=True,
        ) as reveal:
            response = self._client().post(
                "/api/papers/reveal",
                json={"paper_ids": [self.second.id, self.first.id]},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["paper_id"], self.first.id)
        self.assertTrue(body["path"].endswith(absolute.split("/")[-1]))
        reveal.assert_called_once()

    def test_reveal_404_without_any_stored_file(self):
        response = self._client().post(
            "/api/papers/reveal",
            json={"paper_ids": [self.first.id]},
        )
        self.assertEqual(response.status_code, 404)

    # ----------------------------------------------------------
    # Rename files
    # ----------------------------------------------------------

    def test_rename_files_by_title(self):
        stored_path, absolute = self._temporary_paper_file("rename")
        self.first.stored_path = stored_path
        self.db.commit()

        response = self._client().post(
            "/api/papers/rename-files",
            json={
                "paper_ids": [self.first.id],
                "pattern": "title",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["renamed"]), 1)

        expected = "blended-learning-in-health-professions.pdf"
        self.assertTrue(
            body["renamed"][0]["stored_path"].endswith(expected)
        )
        self.assertFalse(os.path.exists(absolute))

        renamed_path = get_paper_file_path(
            body["renamed"][0]["stored_path"]
        )
        self.assertTrue(os.path.exists(renamed_path))
        self.addCleanup(os.remove, renamed_path)

        self.db.refresh(self.first)
        self.assertTrue(self.first.stored_path.endswith(expected))

    def test_rename_collision_gets_suffix(self):
        stored_a, _ = self._temporary_paper_file("collide-a")
        stored_b, _ = self._temporary_paper_file("collide-b")
        self.first.stored_path = stored_a
        self.second.stored_path = stored_b
        self.first.title = "Same Title"
        self.second.title = "Same title"
        self.db.commit()

        response = self._client().post(
            "/api/papers/rename-files",
            json={
                "paper_ids": [self.first.id, self.second.id],
                "pattern": "title",
            },
        )

        self.assertEqual(response.status_code, 200)
        paths = sorted(
            entry["stored_path"]
            for entry in response.json()["renamed"]
        )

        self.assertEqual(
            paths,
            [
                "papers/same-title-2.pdf",
                "papers/same-title.pdf",
            ],
        )

        for path in paths:
            absolute = get_paper_file_path(path)
            self.assertTrue(os.path.exists(absolute))
            self.addCleanup(os.remove, absolute)

    def test_rename_skips_papers_without_files(self):
        response = self._client().post(
            "/api/papers/rename-files",
            json={"paper_ids": [self.first.id], "pattern": "title"},
        )

        body = response.json()
        self.assertEqual(body["renamed"], [])
        self.assertEqual(
            body["skipped"],
            [{"id": self.first.id, "reason": "no_file"}],
        )

    # ----------------------------------------------------------
    # Mark as
    # ----------------------------------------------------------

    def test_mark_sets_recommendation_validity(self):
        with mock.patch(
            "app.api.set_recommendation_index_stale"
        ) as stale:
            response = self._client().post(
                "/api/papers/mark",
                json={
                    "paper_ids": [self.first.id, self.second.id],
                    "valid": False,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 2)
        stale.assert_called_once_with(True)

        self.db.refresh(self.first)
        self.assertFalse(self.first.is_valid_for_recommendation)

    # ----------------------------------------------------------
    # Merge
    # ----------------------------------------------------------

    def test_merge_selected_into_master(self):
        self.db.add(
            PersonalLibrary(
                user_id=1,
                paper_id=self.second.id,
            )
        )
        self.db.add(
            PaperCitation(
                paper_id=self.second.id,
                direction="cites",
                external_work_id="W1",
            )
        )
        self.db.commit()

        with mock.patch(
            "app.api.set_recommendation_index_stale"
        ):
            response = self._client().post(
                "/api/papers/merge",
                json={
                    "paper_ids": [self.first.id, self.second.id],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn(body["master_id"], [self.first.id, self.second.id])
        self.assertEqual(len(body["merged_ids"]), 1)

        surviving_ids = {
            paper.id for paper in self.db.query(Paper).all()
        }
        self.assertEqual(len(surviving_ids), 1)
        self.assertIn(body["master_id"], surviving_ids)

        library_rows = self.db.query(PersonalLibrary).all()
        self.assertEqual(len(library_rows), 1)
        self.assertEqual(
            library_rows[0].paper_id,
            body["master_id"],
        )

        citations = self.db.query(PaperCitation).all()
        self.assertEqual(len(citations), 1)
        self.assertEqual(citations[0].paper_id, body["master_id"])

    def test_merge_requires_two_papers(self):
        response = self._client().post(
            "/api/papers/merge",
            json={"paper_ids": [self.first.id]},
        )
        self.assertEqual(response.status_code, 400)

    # ----------------------------------------------------------
    # Validation edges
    # ----------------------------------------------------------

    def test_empty_selection_is_rejected(self):
        response = self._client().post(
            "/api/papers/mark",
            json={"paper_ids": [], "valid": True},
        )
        self.assertEqual(response.status_code, 422)

    def test_unknown_papers_are_rejected(self):
        response = self._client().post(
            "/api/papers/refresh-metadata",
            json={"paper_ids": [999999]},
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
