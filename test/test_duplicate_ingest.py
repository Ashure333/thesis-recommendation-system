import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.services import upload_paper as upload_service
from app.services.duplicate_detection import DuplicatePaperError


class DuplicateIngestTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        self.db.add(
            Paper(
                title="A Study of Recommender Systems",
                doi="https://doi.org/10.1234/EXAMPLE",
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_upload_rejects_duplicate_before_persisting_or_storing(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "paper.bib"
            source.write_text("@article{example}", encoding="utf-8")

            with patch.object(
                upload_service,
                "extract_metadata_from_bib",
                return_value={
                    "title": "A Study of Recommender Systems",
                    "doi": "10.1234/example",
                },
            ), patch.object(upload_service, "save_paper_file") as save_file:
                with self.assertRaises(DuplicatePaperError):
                    upload_service.upload_paper(self.db, str(source))

            save_file.assert_not_called()
            self.assertEqual(self.db.query(Paper).count(), 1)


if __name__ == "__main__":
    unittest.main()
