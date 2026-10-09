"""Related works for a web result (no saved paper): resolution by
DOI / OpenAlex id / title, all offline through the fetch seam.

Run from the project root:

    .venv/bin/python -m unittest test.test_web_result_connections -v
"""

import unittest
from unittest import mock
from urllib.error import HTTPError

from fastapi import HTTPException

from app import api
from app.services.web_connections import fetch_neighborhood

ROOT = {
    "id": "https://openalex.org/W100",
    "title": "Attention Is All You Need",
    "doi": "https://doi.org/10.0/center",
    "referenced_works": ["https://openalex.org/W1"],
}


def _work(work_id, title, cites):
    return {
        "id": f"https://openalex.org/{work_id}",
        "title": title,
        "doi": None,
        "publication_year": 2019,
        "cited_by_count": cites,
        "authorships": [],
        "referenced_works": [],
    }


def make_fetch(urls, *, root=ROOT, search_results=None, doi_404=False):
    def fetch(url):
        urls.append(url)

        if "filter=cites:" in url:
            return {"results": [_work("W3", "Citer", 4)]}

        if "filter=ids.openalex:" in url:
            return {"results": [_work("W1", "Reference", 9)]}

        if "/doi:" in url:
            if doi_404:
                raise HTTPError(url, 404, "Not Found", {}, None)
            return root

        if "?search=" in url:
            return {"results": search_results or []}

        if "/W100?" in url:
            return root

        raise AssertionError(f"unexpected URL: {url}")

    return fetch


class FetchNeighborhoodTest(unittest.TestCase):
    def test_resolves_by_doi_and_only_calls_openalex(self):
        urls = []
        result = fetch_neighborhood(
            doi="https://doi.org/10.0/Center",
            fetch=make_fetch(urls),
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["work_id"], "W100")
        self.assertEqual(result["doi"], "10.0/center")
        self.assertEqual(result["prior_works"][0]["work_id"], "W1")
        self.assertEqual(result["derivative_works"][0]["work_id"], "W3")
        self.assertTrue(
            all(u.startswith("https://api.openalex.org/works") for u in urls)
        )

    def test_doi_is_sanitised_before_use(self):
        urls = []
        fetch_neighborhood(
            doi="10.0/x?evil=1#frag",
            fetch=make_fetch(urls),
        )

        self.assertIn("%3F", urls[0])
        self.assertNotIn("?evil", urls[0])

    def test_falls_back_to_work_id_after_doi_404(self):
        urls = []
        result = fetch_neighborhood(
            doi="10.0/unknown",
            work_id="W100",
            fetch=make_fetch(urls, doi_404=True),
        )

        self.assertTrue(result["ok"])
        self.assertTrue(any("/W100?" in u for u in urls))

    def test_invalid_work_id_is_ignored(self):
        urls = []
        result = fetch_neighborhood(
            work_id="../../evil",
            fetch=make_fetch(urls),
        )

        self.assertEqual(result, {"ok": False, "reason": "no_doi"})
        self.assertEqual(urls, [])

    def test_title_lookup_accepts_exact_title(self):
        urls = []
        result = fetch_neighborhood(
            title="Attention is all you need",
            fetch=make_fetch(urls, search_results=[ROOT]),
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["work_id"], "W100")

    def test_title_lookup_rejects_a_different_paper(self):
        result = fetch_neighborhood(
            title="Attention is all you need",
            fetch=make_fetch(
                [], search_results=[_work("W7", "Cooking with gas", 1)]
            ),
        )

        self.assertFalse(result["ok"])
        self.assertNotIn("detail", result)

    def test_nothing_to_resolve(self):
        self.assertEqual(
            fetch_neighborhood(fetch=make_fetch([])),
            {"ok": False, "reason": "no_doi"},
        )

    def test_unknown_doi_without_fallback_is_not_an_error(self):
        result = fetch_neighborhood(
            doi="10.0/unknown",
            fetch=make_fetch([], doi_404=True),
        )

        self.assertFalse(result["ok"])
        self.assertNotIn("detail", result)

    def test_network_failure_is_reported(self):
        def failing(_url):
            raise OSError("down")

        result = fetch_neighborhood(doi="10.0/x", fetch=failing)

        self.assertFalse(result["ok"])
        self.assertIn("detail", result)


class WebResultEndpointTest(unittest.TestCase):
    def test_unresolved_is_an_empty_200(self):
        with mock.patch.object(
            api,
            "fetch_neighborhood",
            return_value={"ok": False, "reason": "no_doi"},
        ):
            body = api.web_result_connections(doi=None, title=None, work_id=None)

        self.assertTrue(body["ok"])
        self.assertFalse(body["resolved"])
        self.assertEqual(body["prior_works"], [])
        self.assertEqual(body["derivative_works"], [])

    def test_resolved_passes_through(self):
        with mock.patch.object(
            api,
            "fetch_neighborhood",
            return_value={"ok": True, "prior_works": [], "derivative_works": []},
        ):
            body = api.web_result_connections(doi="10.0/x", title=None, work_id=None)

        self.assertTrue(body["resolved"])

    def test_network_failure_is_502(self):
        with mock.patch.object(
            api,
            "fetch_neighborhood",
            return_value={"ok": False, "reason": "lookup_failed", "detail": "x"},
        ):
            with self.assertRaises(HTTPException) as caught:
                api.web_result_connections(doi="10.0/x", title=None, work_id=None)

        self.assertEqual(caught.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
