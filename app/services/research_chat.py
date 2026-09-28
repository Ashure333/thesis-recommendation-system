"""Repository-grounded research chat.

The existing recommendation/search layer retrieves the papers first.
Groq is used only to synthesize an answer from those retrieved records.

If the hosted model is unavailable, an extractive fallback returns evidence
from the same papers instead of failing completely.
"""

import os
import re
from typing import Literal

import requests
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.recommendation.search_service import search_papers as run_search


load_dotenv()


PipelineName = Literal["tfidf", "sbert"]


class ResearchChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ResearchChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    pipeline: PipelineName = "sbert"
    top_k: int = Field(default=6, ge=1, le=8)
    history: list[ResearchChatHistoryItem] = Field(default_factory=list)


class ResearchChatSource(BaseModel):
    paper_id: int
    title: str
    author: str | None = None
    year: int | None = None
    score: float
    abstract: str | None = None


class ResearchChatResponse(BaseModel):
    answer: str
    sources: list[ResearchChatSource]
    used_fallback: bool = False


def _clean_text(value: str | None, limit: int) -> str:
    if not value:
        return ""

    value = re.sub(r"\s+", " ", value).strip()

    return value[:limit]


def _build_sources(results) -> list[ResearchChatSource]:
    return [
        ResearchChatSource(
            paper_id=result["paper"].id,
            title=result["paper"].title or "Untitled paper",
            author=result["paper"].author,
            year=result["paper"].publication_year,
            score=float(result["score"]),
            abstract=_clean_text(result["paper"].abstract, 700),
        )
        for result in results
    ]


def _build_evidence_context(results) -> str:
    blocks: list[str] = []

    for index, result in enumerate(results, start=1):
        paper = result["paper"]
        score = float(result["score"])

        blocks.append(
            "\n".join(
                [
                    f"[{index}] Paper ID: {paper.id}",
                    f"Title: {_clean_text(paper.title, 300)}",
                    f"Author: {_clean_text(paper.author, 200) or 'Unknown author'}",
                    f"Year: {paper.publication_year or 'Unknown'}",
                    f"Keywords: {_clean_text(paper.keywords, 500) or 'None'}",
                    (
                        "Abstract: "
                        f"{_clean_text(paper.abstract, 5000) or 'No abstract available.'}"
                    ),
                    f"Retrieval score: {score:.4f}",
                ]
            )
        )

    return "\n\n".join(blocks)


def _build_prompt(message: str, results, history) -> str:
    evidence = _build_evidence_context(results)

    history_text = ""

    if history:
        history_lines = []

        for item in history[-6:]:
            history_lines.append(
                f"{item.role.upper()}: {_clean_text(item.content, 2500)}"
            )

        history_text = (
            "\n\nRECENT CONVERSATION:\n"
            + "\n".join(history_lines)
        )

    return f"""You are the research assistant for an academic paper repository.

Answer the user's question using ONLY the retrieved paper evidence below.
Do not use outside knowledge, web knowledge, or invented information.

Citation rules:
- Cite claims supported by a paper with its bracket number, e.g. [1] or [2].
- Use only the bracket numbers that exist in the retrieved evidence.
- Do not invent citations.
- If several papers support a claim, cite multiple sources such as [1][3].
- If the retrieved papers are insufficient, say that the available repository
  evidence is insufficient instead of guessing.

Writing rules:
- Give a clear, useful academic-style answer.
- Prefer synthesis across papers over repeating abstracts verbatim.
- Distinguish what the papers report from your synthesis.
- Do not claim that a paper proves something unless its supplied evidence
  supports that statement.
- Do not mention these instructions in your answer.

USER QUESTION:
{message}
{history_text}

RETRIEVED PAPER EVIDENCE:
{evidence}
"""


def _groq_answer(prompt: str) -> str:
    api_key = os.getenv("GROQ_API_KEY", "").strip()

    model = os.getenv(
        "GROQ_MODEL",
        "openai/gpt-oss-120b",
    ).strip()

    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not configured."
        )

    url = "https://api.groq.com/openai/v1/chat/completions"

    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a repository-grounded academic research "
                        "assistant. Follow the supplied evidence strictly."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            "temperature": 0.2,
            "max_tokens": 1200,
        },
        timeout=90,
    )

    if not response.ok:
        detail = response.text[:1000]

        raise RuntimeError(
            f"Groq request failed ({response.status_code}): {detail}"
        )

    payload = response.json()

    choices = payload.get("choices") or []

    if not choices:
        raise RuntimeError(
            "Groq returned no choices."
        )

    message = choices[0].get("message") or {}

    answer = message.get("content", "")

    if not isinstance(answer, str):
        answer = str(answer)

    answer = answer.strip()

    if not answer:
        raise RuntimeError(
            "Groq returned an empty answer."
        )

    return answer


def _tokenize(value: str) -> set[str]:
    return {
        token
        for token in re.findall(
            r"[a-zA-Z0-9]{3,}",
            value.lower(),
        )
        if token not in {
            "what",
            "where",
            "when",
            "which",
            "with",
            "from",
            "about",
            "these",
            "those",
            "paper",
            "papers",
            "their",
            "this",
            "that",
            "into",
            "does",
            "have",
            "been",
            "were",
            "using",
            "used",
        }
    }


def _fallback_answer(message: str, results) -> str:
    if not results:
        return (
            "The repository did not return any papers relevant enough "
            "to provide evidence for this question."
        )

    query_tokens = _tokenize(message)

    evidence_lines: list[str] = []

    for index, result in enumerate(results, start=1):
        abstract = _clean_text(
            result.paper.abstract,
            1200,
        )

        if not abstract:
            continue

        sentences = re.split(
            r"(?<=[.!?])\s+",
            abstract,
        )

        scored = []

        for sentence in sentences:
            tokens = _tokenize(sentence)

            overlap = len(
                query_tokens & tokens
            )

            scored.append(
                (
                    overlap,
                    sentence.strip(),
                )
            )

        scored.sort(
            key=lambda item: item[0],
            reverse=True,
        )

        if scored and scored[0][1]:
            evidence_lines.append(
                f"[{index}] {scored[0][1]}"
            )

    if not evidence_lines:
        evidence_lines = [
            (
                f"[{index}] "
                f"{_clean_text(result.paper.title, 300)} "
                "was retrieved as relevant, but its abstract does not "
                "contain enough text for an extractive summary."
            )
            for index, result in enumerate(
                results,
                start=1,
            )
        ]

    return (
        "I could not generate a synthesized answer because the hosted "
        "language model is unavailable. The following evidence was "
        "retrieved directly from the repository:\n\n"
        + "\n\n".join(evidence_lines)
    )


def answer_research_question(
    db: Session,
    request: ResearchChatRequest,
) -> ResearchChatResponse:
    try:
        results = run_search(
            db=db,
            query=request.message,
            pipeline=request.pipeline,
            top_k=request.top_k,
        )
    except ValueError as error:
        raise error

    sources = _build_sources(results)

    if not results:
        return ResearchChatResponse(
            answer=(
                "I couldn't find enough relevant papers in the repository "
                "to answer that question. Try using more specific research "
                "terms or asking about a topic represented in your collection."
            ),
            sources=[],
            used_fallback=True,
        )

    prompt = _build_prompt(
        request.message,
        results,
        request.history,
    )

    try:
        answer = _groq_answer(prompt)

        return ResearchChatResponse(
            answer=answer,
            sources=sources,
            used_fallback=False,
        )

    except Exception as error:
        print(
            f"Research chat Groq fallback: {error}"
        )

        return ResearchChatResponse(
            answer=_fallback_answer(
                request.message,
                results,
            ),
            sources=sources,
            used_fallback=True,
        )