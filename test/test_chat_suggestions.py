"""Follow-up question suggestions for the research chat's pills.

After each answer the pills under the thread are replaced with follow-up
questions. A small hosted model writes them; when it is unavailable the
service falls back to deterministic templates built from the key terms of
the conversation, so the pills always update. No network: `requests.post`
and `time.sleep` are patched.

Run from the project root:

    .venv/bin/python -m unittest test.test_chat_suggestions -v
"""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.services import chat_suggestions as cs
from app.services import research_chat as chat_service
from app.services.chat_suggestions import (
    SuggestionRequest,
    SuggestionResponse,
    key_terms,
    suggest_followups,
    template_suggestions,
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


def rate_limited(retry_after=60):
    return FakeResponse(429, {}, {"retry-after": str(retry_after)}, text="slow down")


ENV = {
    "GROQ_API_KEY": "test-key",
    "GROQ_MODEL": "openai/gpt-oss-120b",
    "GROQ_FALLBACK_MODELS": "qwen/qwen3.8-27b",
    "GROQ_SUGGEST_MODEL": "openai/gpt-oss-20b",
    "GROQ_MAX_WAIT_SECONDS": "20",
}

ANSWER = (
    "Blended learning improves engagement for most students. Blended learning "
    "also raises readiness problems when the LMS is unreliable. Engagement "
    "depends on teacher interaction."
)


def make_request(**overrides):
    base = dict(
        question="How does blended learning affect engagement?",
        answer=ANSWER,
        source_titles=["Students' attitudes toward blended learning"],
    )
    base.update(overrides)
    return SuggestionRequest(**base)


class SuggestionsTestBase(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, ENV)
        env.start()
        self.addCleanup(env.stop)

        sleep = patch.object(chat_service.time, "sleep")
        sleep.start()
        self.addCleanup(sleep.stop)

    def post(self, responses):
        calls = []

        def fake(url, headers=None, json=None, timeout=None):
            calls.append(json)
            return responses[min(len(calls), len(responses)) - 1]

        patcher = patch.object(chat_service.requests, "post", side_effect=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return calls


class ModelSuggestionsTest(SuggestionsTestBase):
    def test_returns_the_models_questions_cleaned_up(self):
        self.post([completion(
            '["How do the studies measure engagement?", '
            '"What limits blended learning in practice", '
            '"Which factors predict readiness?"]'
        )])

        response = suggest_followups(make_request())

        self.assertFalse(response.used_fallback)
        self.assertEqual(
            response.suggestions,
            [
                "How do the studies measure engagement?",
                "What limits blended learning in practice?",
                "Which factors predict readiness?",
            ],
        )

    def test_accepts_json_wrapped_in_a_code_fence(self):
        self.post([completion(
            'Sure!\n```json\n["Why does readiness vary?", '
            '"Where do findings conflict?", "Which designs were used?"]\n```'
        )])

        response = suggest_followups(make_request())

        self.assertEqual(len(response.suggestions), 3)
        self.assertEqual(response.suggestions[0], "Why does readiness vary?")

    def test_drops_repeats_overlong_and_too_short_questions_then_pads(self):
        self.post([completion(
            '["how does blended learning affect engagement?", '
            f'"{"x" * 200}?", "Why?", '
            '"Which designs were used?", "Which designs were used?", '
            '"Where do findings conflict?"]'
        )])

        response = suggest_followups(make_request())

        self.assertEqual(len(response.suggestions), 3)
        self.assertEqual(
            response.suggestions[:2],
            ["Which designs were used?", "Where do findings conflict?"],
        )
        self.assertIn("blended learning", response.suggestions[2].lower())
        self.assertFalse(response.used_fallback)

    def test_uses_the_small_suggest_model_with_a_small_budget(self):
        calls = self.post([completion('["A good question here?"]')])

        suggest_followups(make_request())

        self.assertEqual(calls[0]["model"], "openai/gpt-oss-20b")
        self.assertLessEqual(calls[0]["max_tokens"], 600)
        self.assertEqual(calls[0]["reasoning_effort"], "low")
        self.assertIn("follow-up", calls[0]["messages"][0]["content"].lower())

    def test_prompt_carries_the_conversation(self):
        calls = self.post([completion('["A good question here?"]')])

        suggest_followups(make_request())

        user_prompt = calls[0]["messages"][1]["content"]
        self.assertIn("How does blended learning affect engagement?", user_prompt)
        self.assertIn("readiness problems", user_prompt)
        self.assertIn("Students' attitudes toward blended learning", user_prompt)

    def test_reference_list_is_not_sent_to_the_model(self):
        calls = self.post([completion('["A good question here?"]')])
        answer = (
            "Engagement rises (Yao et al., 2015).\n\nReferences\n"
            "Bohao Yao and Charl Ras (2015). A Distinctive Reference Title."
        )

        suggest_followups(make_request(answer=answer))

        prompt = calls[0]["messages"][1]["content"]
        self.assertIn("Engagement rises", prompt)
        self.assertNotIn("Distinctive Reference Title", prompt)

    def test_falls_over_to_the_fallback_model_but_never_the_big_one(self):
        calls = self.post([rate_limited(60), completion('["From the backup model?"]')])

        suggest_followups(make_request())

        self.assertEqual(
            [c["model"] for c in calls],
            ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
        )


class FallbackSuggestionsTest(SuggestionsTestBase):
    def test_templates_are_used_when_every_model_fails(self):
        self.post([rate_limited(60)])

        response = suggest_followups(make_request())

        self.assertTrue(response.used_fallback)
        self.assertEqual(len(response.suggestions), 3)
        self.assertTrue(all(s.endswith("?") for s in response.suggestions))
        self.assertIn("blended learning", response.suggestions[0].lower())

    def test_templates_are_used_without_a_key(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            with patch.object(chat_service.requests, "post") as post:
                response = suggest_followups(make_request())

        post.assert_not_called()
        self.assertTrue(response.used_fallback)
        self.assertEqual(len(response.suggestions), 3)

    def test_unparseable_model_output_falls_back(self):
        self.post([completion("I would ask about engagement, maybe?")])

        response = suggest_followups(make_request())

        self.assertTrue(response.used_fallback)
        self.assertEqual(len(response.suggestions), 3)

    def test_template_suggestions_are_distinct_and_honour_count(self):
        out = template_suggestions(["blended learning", "engagement"], 5)

        self.assertEqual(len(out), 5)
        self.assertEqual(len(set(out)), 5)
        self.assertEqual(len(template_suggestions(["x term"], 2)), 2)
        self.assertIn("this topic", template_suggestions([], 1)[0])


class KeyTermsTest(unittest.TestCase):
    def test_repeated_phrase_beats_single_words(self):
        text = (
            "Blended learning improves engagement. Blended learning is "
            "popular. Engagement matters."
        )

        self.assertEqual(key_terms(text, 2), ["blended learning", "engagement"])

    def test_stopwords_and_generic_academic_words_are_ignored(self):
        text = "The study shows that the results of the paper are good."

        self.assertEqual(key_terms(text, 3), [])

    def test_empty_text(self):
        self.assertEqual(key_terms("", 3), [])


class RequestValidationTest(unittest.TestCase):
    def test_question_is_required(self):
        with self.assertRaises(ValidationError):
            SuggestionRequest(question="", answer="x")

    def test_count_is_bounded(self):
        for bad in (0, 6):
            with self.assertRaises(ValidationError):
                SuggestionRequest(question="q", answer="a", count=bad)

        self.assertEqual(SuggestionRequest(question="q", answer="a").count, 3)


class EndpointTest(unittest.TestCase):
    def test_route_returns_suggestions(self):
        from app import api

        fake = SuggestionResponse(suggestions=["One?", "Two?", "Three?"], used_fallback=False)

        with patch.object(api, "suggest_followups", return_value=fake):
            response = TestClient(api.app).post(
                "/api/research-chat/suggestions",
                json={"question": "q", "answer": "a"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["suggestions"], ["One?", "Two?", "Three?"])


if __name__ == "__main__":
    unittest.main()
