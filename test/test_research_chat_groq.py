"""Hosted-model plumbing of the research chat.

Covers the Groq call itself (rate limits, model fallback, truncated
reasoning answers), citation-style normalisation, and the removal of the
papers' own bibliography markers from the evidence handed to the model.
No network: `requests.post` and `time.sleep` are patched.

Run from the project root:

    .venv/bin/python -m unittest test.test_research_chat_groq -v
"""

import os
import unittest
from unittest.mock import patch

from app.services import research_chat as chat_service
from app.services.research_chat import (
    ResearchChatRequest,
    ResearchChatSource,
)


class FakeResponse:
    def __init__(self, status=200, body=None, headers=None, text=""):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._body = body if body is not None else {}
        self.headers = headers or {}
        self.text = text or str(self._body)

    def json(self):
        return self._body


def completion(content, finish="stop"):
    return FakeResponse(
        200,
        {"choices": [{"message": {"content": content}, "finish_reason": finish}]},
    )


def rate_limited(retry_after=None):
    headers = {"retry-after": str(retry_after)} if retry_after is not None else {}
    return FakeResponse(429, {}, headers, text="rate limited")


ENV = {
    "GROQ_API_KEY": "test-key",
    "GROQ_MODEL": "openai/gpt-oss-120b",
    "GROQ_FALLBACK_MODELS": "qwen/qwen3.8-27b",
    "GROQ_MAX_WAIT_SECONDS": "20",
}


class GroqAnswerTest(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, ENV)
        env.start()
        self.addCleanup(env.stop)

        sleep = patch.object(chat_service.time, "sleep")
        self.sleep = sleep.start()
        self.addCleanup(sleep.stop)

    def _post(self, responses):
        calls = []

        def fake(url, headers=None, json=None, timeout=None):
            calls.append(json)
            return responses[len(calls) - 1]

        patcher = patch.object(chat_service.requests, "post", side_effect=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return calls

    def test_rate_limit_is_retried_after_the_advertised_delay(self):
        calls = self._post([rate_limited(3), completion("Done [1].")])

        self.assertEqual(chat_service._groq_answer("prompt"), "Done [1].")
        self.sleep.assert_called_once_with(3)
        self.assertEqual(
            [c["model"] for c in calls],
            ["openai/gpt-oss-120b", "openai/gpt-oss-120b"],
        )

    def test_long_retry_after_moves_to_fallback_model_without_waiting(self):
        calls = self._post([rate_limited(60), completion("From Qwen [1].")])

        self.assertEqual(chat_service._groq_answer("prompt"), "From Qwen [1].")
        self.sleep.assert_not_called()
        self.assertEqual(
            [c["model"] for c in calls],
            ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"],
        )

    def test_total_wait_is_bounded_across_retries(self):
        # 12s fits the 20s budget; a second 12s would exceed what is left.
        calls = self._post(
            [rate_limited(12), rate_limited(12), completion("ok [1].")]
        )

        self.assertEqual(chat_service._groq_answer("prompt"), "ok [1].")
        self.sleep.assert_called_once_with(12)
        self.assertEqual(calls[-1]["model"], "qwen/qwen3.8-27b")

    def test_truncated_reasoning_answer_falls_through_to_next_model(self):
        calls = self._post([completion("", finish="length"), completion("Real answer [1].")])

        self.assertEqual(chat_service._groq_answer("prompt"), "Real answer [1].")
        self.assertEqual(calls[1]["model"], "qwen/qwen3.8-27b")

    def test_reasoning_effort_is_only_sent_to_gpt_oss_models(self):
        calls = self._post([rate_limited(60), completion("ok [1].")])

        chat_service._groq_answer("prompt")

        self.assertEqual(calls[0]["reasoning_effort"], "low")
        self.assertNotIn("reasoning_effort", calls[1])
        self.assertGreater(calls[0]["max_tokens"], 1200)

    def test_every_model_failing_reports_each_one(self):
        self._post([rate_limited(60), rate_limited(60)])

        with self.assertRaises(RuntimeError) as ctx:
            chat_service._groq_answer("prompt")

        message = str(ctx.exception)
        self.assertIn("openai/gpt-oss-120b", message)
        self.assertIn("qwen/qwen3.8-27b", message)

    def test_missing_key_still_raises_before_any_request(self):
        post = patch.object(chat_service.requests, "post")
        mocked = post.start()
        self.addCleanup(post.stop)

        with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            with self.assertRaisesRegex(RuntimeError, "GROQ_API_KEY"):
                chat_service._groq_answer("prompt")

        mocked.assert_not_called()

    def test_gpt_oss_citation_style_is_rewritten_to_brackets(self):
        self._post([completion("Cubic graphs【4】 and cycles【1†L1-L4】.")])

        self.assertEqual(
            chat_service._groq_answer("prompt"),
            "Cubic graphs[4] and cycles[1].",
        )

    def test_chat_degrades_to_extractive_fallback_when_all_models_fail(self):
        self._post([rate_limited(60), rate_limited(60)])

        paper = type(
            "P", (), dict(
                id=7, title="T", author="A", publication_year=2020,
                abstract="Semantic retrieval beats lexical search.", doi=None,
            ),
        )()

        with patch.object(
            chat_service, "run_search", return_value=[{"paper": paper, "score": 0.5}]
        ):
            response = chat_service.answer_research_question(
                db=None,
                request=ResearchChatRequest(message="semantic retrieval?"),
            )

        self.assertTrue(response.used_fallback)
        self.assertEqual(len(response.sources), 1)


class EvidenceTextTest(unittest.TestCase):
    def _source(self, abstract):
        return ResearchChatSource(
            paper_id=3, title="T", score=0.9, abstract=abstract
        )

    def test_papers_own_reference_markers_are_removed_from_evidence(self):
        blocks = chat_service._evidence_blocks(
            [
                self._source(
                    "Improves [10] and the bound of [16, Theorem 6.1.23]; "
                    "see also [7][8] and [1-3]."
                )
            ]
        )

        for marker in ("[10]", "[16", "[7]", "[8]", "[1-3]"):
            self.assertNotIn(marker, blocks)
        self.assertIn("Improves", blocks)
        self.assertIn("[1] Repository paper ID: 3", blocks)

    def test_text_without_markers_is_untouched(self):
        text = "Plain abstract with a function f(x) and an array a[i]."

        self.assertIn(text, chat_service._evidence_blocks([self._source(text)]))


if __name__ == "__main__":
    unittest.main()
