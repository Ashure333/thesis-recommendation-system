import tempfile
import unittest
from pathlib import Path

from app.services.ris_enw_extraction import (
    extract_metadata_from_enw,
    extract_metadata_from_ris,
    split_enw_records,
    split_ris_records,
)

RIS_SAMPLE = """TY  - JOUR
TI  - Sentence-BERT: Sentence embeddings using Siamese BERT-networks
AU  - Reimers, Nils
AU  - Gurevych, Iryna
PY  - 2019
JF  - arXiv preprint arXiv:1908.10084
DO  - 10.48550/arXiv.1908.10084
AB  - BERT output is not semantically meaningful without finetuning.
KW  - embeddings
KW  - siamese
ER  -

TY  - CONF
TI  - A second record that must not bleed into the first
AU  - Other, Author
PY  - 2020
ER  -"""

ENW_SAMPLE = """%0 Journal Article
%A Reimers, Nils
%A Gurevych, Iryna
%T Sentence-BERT: Sentence embeddings using Siamese BERT-networks
%D 2019
%J arXiv preprint arXiv:1908.10084
%R 10.48550/arXiv.1908.10084
%X BERT output is not semantically meaningful without finetuning.
%K embeddings; siamese
%0 Conference Paper
%A Other, Author
%T A second record that must not bleed into the first
%D 2020"""


class RisExtractionTest(unittest.TestCase):
    def _extract(self, text: str):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.ris"
            path.write_text(text, encoding="utf-8")
            return extract_metadata_from_ris(str(path))

    def test_full_record(self):
        metadata = self._extract(RIS_SAMPLE)

        self.assertEqual(
            metadata["title"],
            "Sentence-BERT: Sentence embeddings using Siamese BERT-networks",
        )
        self.assertEqual(
            metadata["author"],
            "Reimers, Nils, Gurevych, Iryna",
        )
        self.assertEqual(metadata["abstract"], metadata["abstract"])
        self.assertTrue(
            metadata["abstract"].startswith("BERT output")
        )
        self.assertEqual(
            metadata["keywords"],
            "embeddings; siamese",
        )
        self.assertEqual(metadata["publication_year"], 2019)
        self.assertEqual(
            metadata["doi"],
            "10.48550/arXiv.1908.10084",
        )

    def test_only_first_record_is_read(self):
        metadata = self._extract(RIS_SAMPLE)

        self.assertEqual(
            metadata["title"],
            "Sentence-BERT: Sentence embeddings using Siamese BERT-networks",
        )
        self.assertNotIn("second record", metadata["title"].lower())
        self.assertNotIn("Other", metadata["author"])

    def test_bare_record_without_er_end(self):
        metadata = self._extract(
            "TY  - JOUR\nTI  - Only\nAU  - Solo, X\nPY  - 2021\n"
        )

        self.assertEqual(metadata["title"], "Only")
        self.assertEqual(metadata["author"], "Solo, X")
        self.assertEqual(metadata["publication_year"], 2021)
        self.assertIsNone(metadata["doi"])

    def test_non_ris_text_returns_none_fields(self):
        metadata = self._extract("just some random text")

        self.assertEqual(metadata["title"], None)
        self.assertEqual(metadata["author"], None)
        self.assertEqual(metadata["publication_year"], None)
        self.assertEqual(metadata["doi"], None)

    def test_split_ris_records(self):
        records = split_ris_records(RIS_SAMPLE)

        self.assertEqual(len(records), 2)
        self.assertIn("Sentence-BERT", records[0])
        self.assertIn("second record", records[1])


class EnwExtractionTest(unittest.TestCase):
    def _extract(self, text: str):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.enw"
            path.write_text(text, encoding="utf-8")
            return extract_metadata_from_enw(str(path))

    def test_full_record(self):
        metadata = self._extract(ENW_SAMPLE)

        self.assertEqual(
            metadata["title"],
            "Sentence-BERT: Sentence embeddings using Siamese BERT-networks",
        )
        self.assertEqual(
            metadata["author"],
            "Reimers, Nils, Gurevych, Iryna",
        )
        self.assertTrue(
            metadata["abstract"].startswith("BERT output")
        )
        self.assertEqual(
            metadata["keywords"],
            "embeddings; siamese",
        )
        self.assertEqual(metadata["publication_year"], 2019)
        self.assertEqual(
            metadata["doi"],
            "10.48550/arXiv.1908.10084",
        )

    def test_doi_falls_back_to_the_url_field(self):
        metadata = self._extract(
            "%0 Journal Article\n%T No DOI tag\n%U https://doi.org/10.1234/fallback.2020\n"
        )

        self.assertEqual(
            metadata["doi"],
            "10.1234/fallback.2020",
        )

    def test_only_first_record_is_read(self):
        metadata = self._extract(ENW_SAMPLE)

        self.assertNotIn("second record", metadata["title"].lower())
        self.assertNotIn("Other", metadata["author"])

    def test_non_enw_text_returns_none_fields(self):
        metadata = self._extract("still not a citation")

        self.assertEqual(metadata["title"], None)
        self.assertEqual(metadata["doi"], None)

    def test_split_enw_records(self):
        records = split_enw_records(ENW_SAMPLE)

        self.assertEqual(len(records), 2)
        self.assertIn("Sentence-BERT", records[0])
        self.assertIn("second record", records[1])


if __name__ == "__main__":
    unittest.main()