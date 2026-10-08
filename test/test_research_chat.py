import unittest
from unittest.mock import patch

from app.services import research_chat as chat_service
from app.services.research_chat import ResearchChatRequest


class FakePaper:
    def __init__(self, id=7, title="A grounded retrieval study",
                 author="Researcher, Ada", publication_year=2023,
                 abstract="Semantic retrieval outperforms lexical search "
                          "when queries paraphrase their targets.",
                 doi="10.1234/grounded.2023"):
        self.id = id
        self.title = title
        self.author = author
        self.publication_year = publication_year
        self.abstract = abstract
        self.doi = doi


class FakeWebHit:
    def __init__(self, title="Open web source", author="Web Author",
                 publication_year=2024, abstract="An abstract from the "
                 "open web about retrieval systems.", doi="10.9999/web.1",
                 landing_url="https://example.org/paper"):
        self.title = title
        self.author = author
        self.publication_year = publication_year
        self.abstract = abstract
        self.doi = doi
        self.landing_url = landing_url


def _force_fallback():
    return patch(
        "app.services.research_chat._groq_answer",
        side_effect=RuntimeError("test: no hosted model"),
    )


class ResearchChatTest(unittest.TestCase):
    def test_repo_scope_returns_sources_and_fallback(self):
        request = ResearchChatRequest(
            message="How does semantic retrieval compare to lexical search?",
            scope="repo",
        )

        with (patch.object(
            chat_service,
            "run_search",
            return_value=[{"paper": FakePaper(), "score": 0.61}],
        ), _force_fallback()):
            response = chat_service.answer_research_question(
                db=None,
                request=request,
            )

        self.assertTrue(response.used_fallback)
        self.assertEqual(len(response.sources), 1)
        self.assertEqual(response.sources[0].kind, "repo")
        self.assertEqual(response.sources[0].paper_id, 7)
        self.assertEqual(response.sources[0].doi, "10.1234/grounded.2023")
        self.assertIn("The following evidence", response.answer)
        self.assertIn("[1]", response.answer)

    def test_library_scope_passes_paper_ids(self):
        request = ResearchChatRequest(
            message="Any comparisons in my collection?",
            scope="library",
            paper_ids=[3, 5, 8],
        )

        captured = {}

        def capture(**kwargs):
            captured.update(kwargs)
            return [{"paper": FakePaper(), "score": 0.4}]

        with (patch.object(chat_service, "run_search", side_effect=capture),
              _force_fallback()):
            chat_service.answer_research_question(
                db=None,
                request=request,
            )

        self.assertEqual(captured["paper_ids"], [3, 5, 8])

    def test_empty_collection_short_circuits(self):
        request = ResearchChatRequest(
            message="Anything here?",
            scope="library",
            paper_ids=[],
        )

        with patch.object(chat_service, "run_search") as run_search:
            response = chat_service.answer_research_question(
                db=None,
                request=request,
            )

        run_search.assert_not_called()
        self.assertIn("empty", response.answer)
        self.assertEqual(response.sources, [])

    def test_web_scope_uses_web_search(self):
        request = ResearchChatRequest(
            message="What does the open web say about retrieval?",
            scope="web",
        )

        with (patch.object(
            chat_service,
            "search_web",
            return_value=[FakeWebHit()],
        ), _force_fallback()):
            response = chat_service.answer_research_question(
                db=None,
                request=request,
            )

        self.assertTrue(response.used_fallback)
        self.assertEqual(len(response.sources), 1)
        self.assertEqual(response.sources[0].kind, "web")
        self.assertEqual(
            response.sources[0].url,
            "https://example.org/paper",
        )
        self.assertEqual(response.sources[0].doi, "10.9999/web.1")
        self.assertIn("[1]", response.answer)

    def test_web_scope_without_results(self):
        request = ResearchChatRequest(
            message="Something nobody indexed?",
            scope="web",
        )

        with patch.object(chat_service, "search_web", return_value=[]):
            response = chat_service.answer_research_question(
                db=None,
                request=request,
            )

        self.assertEqual(response.sources, [])
        self.assertIn("web search", response.answer)


if __name__ == "__main__":
    unittest.main()