"""
The Upload page's import paths: file types, reviewed fields, duplicates,
document types, identifiers and the URL guards.
"""

import os
import tempfile
import unittest
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.models import Base, Paper
from app.services import document_types
from app.services.bib_extraction import extract_metadata_from_bib
from app.services.duplicate_detection import (
    _could_be_duplicate,
    _normalized_title,
    _title_words,
    find_duplicate_paper,
    titles_are_duplicates,
)
from app.services.identifier_resolver import parse_identifier
from app.services.ris_enw_extraction import (
    extract_metadata_from_enw,
    extract_metadata_from_ris,
)
from app.services.url_safety import UnsafeUrlError, assert_public_http_url, safe_get

RIS = """TY  - JOUR
TI  - A Probe of Retrieval Pipelines for Thesis Discovery
AU  - Dela Cruz, Juan
AU  - Santos, Maria
AB  - We compare lexical, semantic and metadata signals for recommending literature to thesis writers.
KW  - recommender systems
PY  - 2024
DO  - 10.9999/probe.2024.001
ER  -
"""

ENW = """%0 Book
%T An Endnote Probe Book On Hybrid Recommendation
%A Reyes, Ana
%D 2023
%X An abstract long enough to count as an abstract for the validity check in this pipeline.
%K hybrid recommendation
"""

BIB = """@book{pot1998,
  title={The History of Medieval Pottery Kilns in Europe},
  author={Smith, John and Doe, Jane},
  year={1998}
}
"""


def _write(directory: str, name: str, text: str) -> str:
    path = os.path.join(directory, name)

    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)

    return path


class DocumentTypeTests(unittest.TestCase):
    def test_bibtex_entry_types(self):
        cases = {
            "article": "Journal Article",
            "inproceedings": "Conference Paper",
            "incollection": "Book Chapter",
            "book": "Book",
            "phdthesis": "Thesis",
            "techreport": "Technical Report",
        }

        for entry_type, expected in cases.items():
            self.assertEqual(document_types.from_bibtex(entry_type), expected)

        self.assertIsNone(document_types.from_bibtex("misc"))
        self.assertEqual(
            document_types.from_bibtex("misc", "eprint={1706.03762}, archivePrefix={arXiv}"),
            "Preprint",
        )

    def test_ris_and_endnote_types(self):
        self.assertEqual(document_types.from_ris("JOUR"), "Journal Article")
        self.assertEqual(document_types.from_ris("cpaper"), "Conference Paper")
        self.assertEqual(document_types.from_ris("CHAP"), "Book Chapter")
        self.assertIsNone(document_types.from_ris("GEN"))
        self.assertEqual(document_types.from_endnote("Journal Article"), "Journal Article")
        self.assertEqual(document_types.from_endnote("Book Section"), "Book Chapter")
        self.assertIsNone(document_types.from_endnote("Generic"))

    def test_extractors_report_the_type(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(extract_metadata_from_bib(_write(folder, "a.bib", BIB))["document_type"], "Book")
            self.assertEqual(extract_metadata_from_ris(_write(folder, "a.ris", RIS))["document_type"], "Journal Article")
            self.assertEqual(extract_metadata_from_enw(_write(folder, "a.enw", ENW))["document_type"], "Book")

    def test_ris_authors_are_joined_unambiguously(self):
        with tempfile.TemporaryDirectory() as folder:
            metadata = extract_metadata_from_ris(_write(folder, "a.ris", RIS))

        self.assertEqual(metadata["author"], "Dela Cruz, Juan; Santos, Maria")


class IdentifierParsingTests(unittest.TestCase):
    def test_prefixed_and_linked_forms(self):
        for text in (
            "doi:10.1145/3292500.3330701",
            "DOI: 10.1145/3292500.3330701",
            "doi 10.1145/3292500.3330701",
            "https://doi.org/10.1145/3292500.3330701",
            "10.1145/3292500.3330701",
        ):
            self.assertEqual(parse_identifier(text), ("doi", "10.1145/3292500.3330701"), text)

        for text in (
            "1706.03762",
            "arXiv:1706.03762v5",
            "https://arxiv.org/html/1706.03762v7",
            "https://ar5iv.labs.arxiv.org/html/1706.03762",
            "https://www.alphaxiv.org/abs/1706.03762",
        ):
            self.assertEqual(parse_identifier(text), ("arxiv", "1706.03762"), text)

    def test_a_closing_parenthesis_is_kept_only_when_it_belongs(self):
        self.assertEqual(parse_identifier("10.1016/S0140-6736(20)30183-5)")[1], "10.1016/S0140-6736(20)30183-5")
        self.assertEqual(parse_identifier("10.1016/0021-9991(77)90098-5")[1], "10.1016/0021-9991(77)90098-5")
        self.assertEqual(parse_identifier("10.1002/(SICI)1097-4571(199806)49:8<693::AID-ASI4>3.0.CO;2-O)")[1].count(")"), 2)

    def test_not_an_identifier(self):
        for text in ("", "https://example.com", "hello world", "pmid:12345"):
            self.assertIsNone(parse_identifier(text), text)


class UrlSafetyTests(unittest.TestCase):
    def test_private_and_odd_urls_are_refused(self):
        for url in (
            "http://127.0.0.1:8000/api/papers",
            "http://localhost/x.pdf",
            "http://10.0.0.5/x.pdf",
            "http://192.168.1.2/x.pdf",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]/x.pdf",
            "ftp://8.8.8.8/x.pdf",
            "file:///etc/passwd",
            "http://user:pw@8.8.8.8/x.pdf",
            "",
        ):
            with self.assertRaises(UnsafeUrlError, msg=url):
                assert_public_http_url(url)

    def test_a_public_address_passes(self):
        assert_public_http_url("https://8.8.8.8/paper.pdf")

    def test_a_redirect_into_the_private_network_is_refused(self):
        hop = mock.Mock(status_code=302, headers={"Location": "http://127.0.0.1:8000/secret"})

        with mock.patch("app.services.url_safety.requests.get", return_value=hop) as get:
            with self.assertRaises(UnsafeUrlError):
                safe_get("https://8.8.8.8/start.pdf", timeout=1)

        self.assertEqual(get.call_count, 1)

    def test_redirects_are_followed_and_limited(self):
        done = mock.Mock(status_code=200, headers={})
        bounce = mock.Mock(status_code=301, headers={"Location": "https://8.8.4.4/final.pdf"})

        with mock.patch("app.services.url_safety.requests.get", side_effect=[bounce, done]):
            self.assertIs(safe_get("https://8.8.8.8/a.pdf"), done)

        loop = mock.Mock(status_code=302, headers={"Location": "https://8.8.8.8/again"})

        with mock.patch("app.services.url_safety.requests.get", return_value=loop):
            with self.assertRaises(UnsafeUrlError):
                safe_get("https://8.8.8.8/again")

    def test_a_host_allow_list_applies_to_every_hop(self):
        hop = mock.Mock(status_code=302, headers={"Location": "https://8.8.4.4/x"})

        with mock.patch("app.services.url_safety.requests.get", return_value=hop):
            with self.assertRaises(UnsafeUrlError):
                safe_get("https://8.8.8.8/x", host_ok=lambda url: "8.8.8.8" in url)


class DuplicateScreenTests(unittest.TestCase):
    TITLES = [
        "Attention is all you need",
        "Attention Is All You Need",
        "Attention is all you need.",
        "Sentence-BERT: Sentence embeddings using Siamese BERT-networks",
        "Sentence BERT: sentence embeddings using siamese BERT networks",
        "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks (extended)",
        "A Survey of Content-Based Recommendation Techniques",
        "A survey of content based recommendation technique",
        "Deep residual learning for image recognition",
        "Deep residual learning for image recogniton",
        "BERT: Pre-training of deep bidirectional transformers for language understanding",
        "BERT: pretraining of deep bidirectional transformers for language understanding",
        "Dropout: a simple way to prevent neural networks from overfitting",
        "Introduction to Graph Theory",
        "Game Theory Deconstructed",
        "Rescuing Game Theory from the Game Theorists",
        "The History of Medieval Pottery Kilns in Europe",
    ]

    def test_the_screen_never_hides_a_real_duplicate(self):
        for first in self.TITLES:
            wanted = _normalized_title(first)
            words = _title_words(wanted)

            for second in self.TITLES:
                if titles_are_duplicates(first, second):
                    self.assertTrue(
                        _could_be_duplicate(wanted, words, second),
                        (first, second),
                    )

    def test_the_screen_skips_unrelated_titles(self):
        wanted = _normalized_title("Attention is all you need")

        self.assertFalse(
            _could_be_duplicate(wanted, _title_words(wanted), "The History of Medieval Pottery Kilns in Europe")
        )


class StorageTests(unittest.TestCase):
    def test_every_importable_file_type_can_be_stored(self):
        from app.services import storage

        with tempfile.TemporaryDirectory() as folder:
            with mock.patch.object(storage, "PAPERS_DIR", __import__("pathlib").Path(folder) / "papers"):
                for suffix in (".pdf", ".bib", ".tex", ".ris", ".enw"):
                    source = _write(folder, "source" + suffix, "x")
                    saved = storage.save_paper_file(7, source)

                    self.assertEqual(saved, f"papers/7{suffix}")

                with self.assertRaises(ValueError):
                    storage.save_paper_file(7, _write(folder, "source.docx", "x"))


class ImportEndpointTests(unittest.TestCase):
    def setUp(self):
        self._temporary_directory = tempfile.TemporaryDirectory()

        engine = create_engine("sqlite:///" + os.path.join(self._temporary_directory.name, "upload.db"))
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.addCleanup(self.db.close)
        self.addCleanup(engine.dispose)
        self.addCleanup(self._temporary_directory.cleanup)

        from fastapi.testclient import TestClient

        from app.api import app
        from app.database import get_session

        def override():
            yield self.db

        app.dependency_overrides[get_session] = override
        self.addCleanup(app.dependency_overrides.clear)

        # No files in the real storage folder, no network, no index flag.
        for target, value in (
            ("app.services.upload_paper.save_paper_file", lambda paper_id, source_path: f"papers/{paper_id}.test"),
            ("app.services.upload_paper.enqueue_paper_enrichment", lambda paper_id: None),
            ("app.api.set_recommendation_index_stale", lambda stale: None),
        ):
            patcher = mock.patch(target, value)
            patcher.start()
            self.addCleanup(patcher.stop)

        self.client = TestClient(app)

    def _post(self, path, name, text, data=None, binary=None):
        content = binary if binary is not None else text.encode("utf-8")

        return self.client.post(path, files={"file": (name, content)}, data=data or {})

    def test_ris_and_endnote_can_be_saved(self):
        for name, text in (("one.ris", RIS), ("one.enw", ENW)):
            response = self._post("/api/papers/upload", name, text)

            self.assertEqual(response.status_code, 200, response.text)

        self.assertEqual(self.db.query(Paper).count(), 2)

    def test_the_document_type_comes_from_the_citation(self):
        self._post("/api/papers/upload", "one.enw", ENW)

        self.assertEqual(self.db.query(Paper).one().document_type, "Book")

    def test_reviewed_fields_are_saved_in_the_same_request(self):
        response = self._post(
            "/api/papers/upload",
            "x.bib",
            BIB,
            data={
                "title": "Pottery Kilns of Medieval Europe, Revised",
                "abstract": "A reviewed abstract that is long enough to count for validation purposes here.",
                "keywords": "pottery; kilns",
                "publication_year": "1999",
                "subject_category": "History: Material Culture",
                "document_type": "Book",
                "citation_count": "7",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)

        paper = self.db.query(Paper).one()

        self.assertEqual(paper.title, "Pottery Kilns of Medieval Europe, Revised")
        self.assertEqual(paper.publication_year, 1999)
        self.assertEqual(paper.subject_category, "History: Material Culture")
        self.assertEqual(paper.citation_count, 7)
        self.assertTrue(paper.is_valid_for_recommendation)

    def test_a_blank_reviewed_field_clears_it_and_an_omitted_one_keeps_it(self):
        self._post("/api/papers/upload", "x.ris", RIS, data={"cleared": "doi, publication_year"})

        paper = self.db.query(Paper).one()

        self.assertIsNone(paper.doi)
        self.assertIsNone(paper.publication_year)
        self.assertEqual(paper.title, "A Probe of Retrieval Pipelines for Thesis Discovery")

    def test_the_duplicate_check_runs_on_the_reviewed_title(self):
        self._post("/api/papers/upload", "x.ris", RIS)

        again = self._post("/api/papers/upload", "x.ris", RIS, data={"title": "A Completely Different Title About Kilns"})
        self.assertEqual(again.status_code, 409)

        distinct = self._post(
            "/api/papers/upload",
            "x.ris",
            RIS,
            data={"title": "A Completely Different Title About Kilns", "doi": "10.9999/other"},
        )
        self.assertEqual(distinct.status_code, 200, distinct.text)

    def test_bad_numbers_are_refused_with_a_reason(self):
        for data in ({"publication_year": "20x6"}, {"publication_year": "1066"}, {"publication_year": "2999"}, {"citation_count": "-3"}):
            response = self._post("/api/papers/upload", "x.ris", RIS, data=data)

            self.assertEqual(response.status_code, 422, data)
            self.assertTrue(response.json()["detail"])

        self.assertEqual(self.db.query(Paper).count(), 0)

    def test_files_are_checked_before_they_are_parsed(self):
        self.assertEqual(self._post("/api/papers/upload", "x.pdf", "", binary=b"not a pdf at all").status_code, 400)
        self.assertEqual(self._post("/api/papers/upload", "x.pdf", "", binary=b"").status_code, 400)
        self.assertEqual(self._post("/api/papers/upload", "x.bib", "", binary=b"@a{\x00\x01\x02}").status_code, 400)
        self.assertEqual(self._post("/api/papers/upload", "x.docx", "hello").status_code, 400)

        with mock.patch("app.api.MAX_UPLOAD_BYTES", 100):
            too_big = self._post("/api/papers/upload", "x.bib", "@article{a, title={" + "x" * 500 + "}}")

        self.assertEqual(too_big.status_code, 413)

    def test_preview_flags_a_duplicate_and_does_not_search_the_web(self):
        self._post("/api/papers/upload", "x.ris", RIS)

        with mock.patch("app.api.find_pdf_candidates", side_effect=AssertionError("web search")) as search:
            same = self._post("/api/papers/preview", "x.ris", RIS)
            fresh = self._post("/api/papers/preview", "y.bib", BIB)

        self.assertEqual(same.status_code, 200, same.text)
        self.assertEqual(same.json()["duplicate_of"]["title"], "A Probe of Retrieval Pipelines for Thesis Discovery")
        self.assertIsNone(fresh.json()["duplicate_of"])
        self.assertEqual(fresh.json()["document_type"], "Book")
        self.assertFalse(search.called)

    def test_preview_can_still_search_for_pdfs_on_request(self):
        with mock.patch("app.api.find_pdf_candidates", return_value=[]) as search:
            response = self.client.post(
                "/api/papers/preview?candidates=true",
                files={"file": ("y.bib", BIB.encode())},
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(search.called)

    def test_import_metadata_refuses_private_pdf_links_and_bad_numbers(self):
        base = {"title": "A Perfectly Fine Title For A Paper"}

        for extra in (
            {"pdf_url": "http://127.0.0.1:8000/api/papers"},
            {"pdf_url": "file:///etc/passwd"},
            {"publication_year": 1066},
            {"citation_count": -1},
        ):
            response = self.client.post("/api/papers/import-metadata", json={**base, **extra})

            self.assertIn(response.status_code, (400, 422), extra)

        self.assertEqual(self.db.query(Paper).count(), 0)

    def test_two_imports_of_the_same_paper_cannot_both_win(self):
        import threading

        results = []

        def run():
            results.append(self._post("/api/papers/upload", "x.ris", RIS).status_code)

        # TestClient shares one session here, so this checks the lock path
        # rather than true parallelism: the second import must be a duplicate.
        run()
        run()

        self.assertEqual(sorted(results), [200, 409])
        self.assertEqual(self.db.query(Paper).count(), 1)
        del threading


if __name__ == "__main__":
    unittest.main()
