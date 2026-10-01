"""
Pipeline comparison service ("Pipeline Battle").

Runs every implemented recommendation pipeline against the same
query or seed paper and returns the ranked results side by side,
so the Evaluation page can show which pipelines agree, disagree,
and which papers win across all of them.

For the thesis this is the raw material of the evaluation chapter:
consensus ranking, pairwise agreement, and per-pipeline rank
displacement are exactly the quantities reported when comparing
lexical / semantic / metadata / hybrid configurations.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.recommendation.search_service import (
    search_papers as run_search,
)

PIPELINE_ORDER: tuple[str, ...] = (
    "tfidf",
    "sbert",
    "tfidf_sbert",
    "tfidf_metadata",
    "sbert_metadata",
    "tfidf_sbert_metadata",
)

PipelineName = Literal[
    "tfidf",
    "sbert",
    "tfidf_sbert",
    "tfidf_metadata",
    "sbert_metadata",
    "tfidf_sbert_metadata",
]

# Component set per pipeline. Two pipelines agree "independently"
# only to the extent they share no building blocks: a hybrid's
# top-k is partly a re-run of its own components, so its agreement
# with those components carries less evidence than a disjoint
# pipeline's agreement.
PIPELINE_COMPONENTS: dict[str, frozenset[str]] = {
    "tfidf": frozenset({"tfidf"}),
    "sbert": frozenset({"sbert"}),
    "tfidf_sbert": frozenset({"tfidf", "sbert"}),
    "tfidf_metadata": frozenset({"tfidf", "metadata"}),
    "sbert_metadata": frozenset({"sbert", "metadata"}),
    "tfidf_sbert_metadata": frozenset({"tfidf", "sbert", "metadata"}),
}


def _independence_weight(a: str, b: str) -> float:
    """1 - Jaccard(component sets): how much of pipeline a's evidence
    is not already contained in pipeline b.

    Disjoint pipelines weigh 1.0; a two-signal hybrid weighs 0.5
    against a pipeline built from one of its own components, and the
    three-signal hybrid weighs at most 2/3 against a single-signal
    pipeline, so a pipeline can never be confirmed by its own
    offspring.
    """

    components_a = PIPELINE_COMPONENTS[a]
    components_b = PIPELINE_COMPONENTS[b]

    union = components_a | components_b
    if not union:
        return 0.0

    return 1.0 - (len(components_a & components_b) / len(union))


class CompareRequest(BaseModel):
    query: str | None = None
    seed_paper_id: int | None = None
    top_k: int = Field(default=10, ge=1, le=25)


class RankedPaper(BaseModel):
    paper_id: int
    title: str | None = None
    year: int | None = None
    score: float


class PipelineBattle(BaseModel):
    id: str
    results: list[RankedPaper]


class ConsensusEntry(BaseModel):
    paper_id: int
    title: str | None = None
    year: int | None = None
    votes: int
    avg_rank: float | None = None
    best_rank: int | None = None


class PairwiseAgreement(BaseModel):
    a: str
    b: str
    overlap: int
    mean_rank_gap: float | None = None


class WinnerResult(BaseModel):
    """The pipeline that captured the most independence-weighted
    consensus.

    Metric ("independence_weighted_consensus"): each paper in a
    pipeline's top-k collects votes from the other pipelines, where a
    vote from pipeline Q weighs independence(P, Q) = 1 - Jaccard of
    the two pipelines' component sets. Agreement with a pipeline built
    from the same signals is weak evidence; agreement with a disjoint
    pipeline is strong evidence — so no pipeline can win by having its
    hybrids re-confirm its own output.

    The reported value is the pipeline's captured share (0..1) of its
    maximum possible weighted consensus, which puts pure and hybrid
    pipelines on the same scale. Ties are broken by the lower average
    consensus rank.
    """

    pipeline_id: str
    metric: Literal["independence_weighted_consensus"]
    value: float
    avg_consensus_rank: float | None = None


class CompareResponse(BaseModel):
    query: str | None = None
    seed_paper_id: int | None = None
    top_k: int
    pipelines: list[PipelineBattle]
    consensus: list[ConsensusEntry]
    pairwise: list[PairwiseAgreement]
    winner: WinnerResult | None = None


def _run_one(
    db: Session,
    pipeline: str,
    query: str | None,
    seed_paper_id: int | None,
    top_k: int,
) -> tuple[dict[int, int], dict[int, float], list[RankedPaper]]:
    """Run one pipeline; return (rank_map, score_map, ranked list)."""

    results = run_search(
        db=db,
        query=query,
        seed_paper_id=seed_paper_id,
        pipeline=pipeline,
        top_k=top_k,
    )

    ranked: list[RankedPaper] = []
    rank_map: dict[int, int] = {}
    score_map: dict[int, float] = {}

    for position, result in enumerate(results, start=1):
        paper = result["paper"]
        score = float(result["score"])

        ranked.append(
            RankedPaper(
                paper_id=paper.id,
                title=paper.title,
                year=paper.publication_year,
                score=round(score, 6),
            )
        )

        rank_map[paper.id] = position
        score_map[paper.id] = score

    return rank_map, score_map, ranked


def compare_pipelines(
    *,
    db: Session,
    query: str | None,
    seed_paper_id: int | None,
    top_k: int,
) -> CompareResponse:
    """Run all six pipelines and assemble the comparison payload."""

    rank_maps: dict[str, dict[int, int]] = {}
    score_maps: dict[str, dict[int, float]] = {}
    battles: list[PipelineBattle] = []

    for pipeline in PIPELINE_ORDER:
        rank_map, score_map, ranked = _run_one(
            db=db,
            pipeline=pipeline,
            query=query,
            seed_paper_id=seed_paper_id,
            top_k=top_k,
        )

        rank_maps[pipeline] = rank_map
        score_maps[pipeline] = score_map
        battles.append(
            PipelineBattle(id=pipeline, results=ranked)
        )

    # --------------------------------------------------------
    # Consensus: every paper any pipeline ranked, scored by
    # votes (how many pipelines included it) then avg rank.
    # --------------------------------------------------------

    union_ids: set[int] = set()
    paper_info: dict[int, dict] = {}

    for rank_map in rank_maps.values():
        union_ids.update(rank_map)

    for battle in battles:
        for result in battle.results:
            paper_info.setdefault(
                result.paper_id,
                {
                    "title": result.title,
                    "year": result.year,
                },
            )

    consensus: list[ConsensusEntry] = []

    for paper_id in union_ids:
        voters = [
            pipeline
            for pipeline, rank_map in rank_maps.items()
            if paper_id in rank_map
        ]

        ranks = [rank_maps[p][paper_id] for p in voters]
        avg_rank = round(sum(ranks) / len(ranks), 2)

        consensus.append(
            ConsensusEntry(
                paper_id=paper_id,
                title=paper_info[paper_id]["title"],
                year=paper_info[paper_id]["year"],
                votes=len(voters),
                avg_rank=avg_rank,
                best_rank=min(ranks),
            )
        )

    consensus.sort(
        key=lambda entry: (
            -entry.votes,
            entry.avg_rank or float("inf"),
            entry.paper_id,
        )
    )

    # --------------------------------------------------------
    # Pairwise agreement: overlap@k plus mean absolute rank
    # gap over the papers both pipelines ranked.
    # --------------------------------------------------------

    pairwise: list[PairwiseAgreement] = []

    for i, pipeline_a in enumerate(PIPELINE_ORDER):
        for pipeline_b in PIPELINE_ORDER[i + 1:]:
            set_a = set(rank_maps[pipeline_a])
            set_b = set(rank_maps[pipeline_b])

            shared = set_a & set_b

            mean_gap = None
            if shared:
                gaps = [
                    abs(
                        rank_maps[pipeline_a][paper_id]
                        - rank_maps[pipeline_b][paper_id]
                    )
                    for paper_id in shared
                ]
                mean_gap = round(
                    sum(gaps) / len(gaps),
                    2,
                )

            pairwise.append(
                PairwiseAgreement(
                    a=pipeline_a,
                    b=pipeline_b,
                    overlap=len(shared),
                    mean_rank_gap=mean_gap,
                )
            )

    # --------------------------------------------------------
    # Winner: most independence-weighted consensus captured,
    # averaged over the pipeline's own top-k results and
    # normalized by the total weight available to it; ties broken
    # by the lower average consensus rank.
    # --------------------------------------------------------

    winner = _pick_winner(
        rank_maps=rank_maps,
        consensus=consensus,
    )

    return CompareResponse(
        query=query,
        seed_paper_id=seed_paper_id,
        top_k=top_k,
        pipelines=battles,
        consensus=consensus,
        pairwise=pairwise,
        winner=winner,
    )


def _pick_winner(
    *,
    rank_maps: dict[str, dict[int, int]],
    consensus: list[ConsensusEntry],
) -> WinnerResult | None:
    """Pick the winner by independence-weighted consensus share.

    For each pipeline P, every paper in P's top-k collects votes
    from the other pipelines, but a vote from Q weighs
    independence(P, Q) = 1 - Jaccard(P's components, Q's components):
    agreement with a pipeline built from the same signals is weak
    evidence, agreement with a disjoint pipeline is strong evidence.
    The winner is the pipeline with the highest share of its maximum
    possible weighted consensus (captured / available), so hybrids
    are compared on the same scale as pure pipelines. Ties fall to
    the pipeline whose results sit higher in the consensus ranking.
    """

    consensus_positions = {
        entry.paper_id: position
        for position, entry in enumerate(consensus, start=1)
    }

    pipelines = list(PIPELINE_ORDER)

    independence = {
        (a, b): _independence_weight(a, b)
        for a in pipelines
        for b in pipelines
        if a != b
    }

    available = {
        pipeline: sum(
            independence[(pipeline, other)]
            for other in pipelines
            if other != pipeline
        )
        for pipeline in pipelines
    }

    winner: WinnerResult | None = None
    best_key: tuple[float, float] | None = None

    for pipeline in pipelines:
        ranked_ids = list(rank_maps[pipeline].keys())

        if not ranked_ids:
            continue

        captured = sum(
            sum(
                independence[(pipeline, other)]
                for other in pipelines
                if other != pipeline
                and paper_id in rank_maps[other]
            )
            for paper_id in ranked_ids
        ) / len(ranked_ids)

        total_available = available[pipeline]
        share = (
            captured / total_available if total_available > 0 else 0.0
        )

        avg_consensus_rank = sum(
            consensus_positions.get(paper_id, len(consensus) + 1)
            for paper_id in ranked_ids
        ) / len(ranked_ids)

        key = (share, -avg_consensus_rank)

        if best_key is None or key > best_key:
            best_key = key
            winner = WinnerResult(
                pipeline_id=pipeline,
                metric="independence_weighted_consensus",
                value=round(share, 4),
                avg_consensus_rank=round(avg_consensus_rank, 2),
            )

    return winner