"""
Connected-Papers-style graph construction for the similar-papers
graph (GET /api/papers/{id}/similar-graph).

The model follows connectedpapers-js -- the official Connected
Papers API client (github.com/ConnectedPapers/connectedpapers-js,
src/graph.ts):

    edges                [[id_a, id_b, weight], ...]  weighted + sparse
    start_id             the origin paper
    path_lengths[id]     weighted distance from the origin
    node_paths[id]       the shortest weighted path origin -> id
    common_authors       authors shared by >= 2 graph papers
                         {name, mentions, edges_count}
    common_topics        keywords/subjects shared by >= 2 papers
                         (same shape)

The reference model's common_references / common_citations are derived
from bibliographic coupling and co-citation over Semantic Scholar's
citation graph. P2-A supplies the same signal from cached OpenAlex
rows (see app/services/citations.py): papers sharing cached
references or cached citers get an additive 0.25 term, and shared
work groups surface as common_references / common_citers.

Edge weight between two graph papers blends the SELECTED pipeline's own
components, so the graph can never disagree with the pipeline that
chose the node set:

    w = w_tfidf    * cos(tfidf_vector_a, tfidf_vector_b)
      + w_sbert    * cos(sbert_vector_a, sbert_vector_b)
      + w_metadata * metadata_score(a, b)   # score_candidates' exact
                                            # 0.25*title + 0.25*abstract
                                            # + 0.25*keywords + 0.25*year
      + 0.15       * author_overlap          # Jaccard over last names
      + 0.25       * citation_similarity     # 0.5* coupling
                                            #  + 0.5*co-citation

All terms are 0..1 and the result is clamped to 0..1. A missing
stored vector contributes 0 -- the same rule the metadata component
uses for missing fields. With no cached citation rows the citation
term is exactly 0.0, so the output is identical to before P2-A.

Edges kept: every origin<->node edge (the origin-star Connected Papers
always shows; it also guarantees the graph is connected) plus every
other pair at or above MIN_EDGE_WEIGHT. Shortest paths use hop cost
(1 - w) and break ties by paper id, so the output is deterministic.
"""

from __future__ import annotations

import heapq
import json

from sqlalchemy.orm import object_session

from app.models.models import Paper
from app.services.citations import citation_maps, similarity_from_maps
from app.services.pdf_finder import _extract_author_last_names
from app.services.recommendation.metadata_pipeline import score_candidates
from app.services.recommendation.pipeline_config import get_pipeline_weights
from app.services.recommendation.similarity import cosine_similarity

# Pairs below this blended weight are not drawn (origin edges exempt).
# Measured on the repository: 0.15 keeps the meaningful core (~60
# inter-paper edges on a 16-node graph) and drops the 0.08-0.15 noise
# tail; the origin star guarantees connectivity regardless.
MIN_EDGE_WEIGHT = 0.15

# Extra relatedness for shared authors -- the analogue of the
# reference model's CommonAuthor contribution.
AUTHOR_OVERLAP_BONUS = 0.15

# Extra relatedness for bibliographic coupling / co-citation (P2-A).
# Additive like the author bonus, and exactly 0.0 when the cache is
# empty, so an un-refreshed database scores as it did before P2-A.
CITATION_OVERLAP_BONUS = 0.25

# Payload bounds for the shared-group collections.
MAX_COMMON_GROUPS = 20

# Citation groups are noisier than authors/topics (an OpenAlex work
# id means little to a reader), so keep only the strongest few.
MAX_CITATION_GROUPS = 10


def _load_vector(raw: str | None) -> list[float] | None:
    """Paper.tfidf_vector / sbert_vector are JSON-encoded list[float]."""
    if not raw:
        return None

    try:
        vector = json.loads(raw)
    except (TypeError, ValueError):
        return None

    return vector if isinstance(vector, list) else None


def _last_names(paper: Paper) -> set[str]:
    return {
        name.lower()
        for name in _extract_author_last_names(paper.author or "")
        if name
    }


def _topics(paper: Paper) -> set[str]:
    """Keyword tokens + subject/category parts (lowercased)."""
    topics: set[str] = set()

    normalized = (paper.keywords or "").replace("|", ",").replace(";", ",")

    for chunk in normalized.split(","):
        topic = chunk.strip().lower()
        if len(topic) >= 3:
            topics.add(topic)

    for part in (paper.subject_category or "").split(":"):
        topic = part.strip().lower()
        if len(topic) >= 3:
            topics.add(topic)

    return topics


def _jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0

    intersection = len(left & right)
    union = len(left | right)

    return intersection / union if union else 0.0


def _pair_weight(
    *,
    paper_a: Paper,
    paper_b: Paper,
    weights: dict[str, float],
    vectors: dict[int, dict[str, list[float] | None]],
    names: dict[int, set[str]],
    metadata_score: float,
    citation_score: float = 0.0,
) -> float:
    vector_a = vectors[paper_a.id]
    vector_b = vectors[paper_b.id]

    tfidf_part = 0.0
    if vector_a["tfidf"] is not None and vector_b["tfidf"] is not None:
        tfidf_part = cosine_similarity(vector_a["tfidf"], vector_b["tfidf"])

    sbert_part = 0.0
    if vector_a["sbert"] is not None and vector_b["sbert"] is not None:
        sbert_part = cosine_similarity(vector_a["sbert"], vector_b["sbert"])

    author_part = AUTHOR_OVERLAP_BONUS * _jaccard(
        names[paper_a.id],
        names[paper_b.id],
    )

    citation_part = CITATION_OVERLAP_BONUS * citation_score

    weight = (
        weights.get("tfidf", 0.0) * tfidf_part
        + weights.get("sbert", 0.0) * sbert_part
        + weights.get("metadata", 0.0) * metadata_score
        + author_part
        + citation_part
    )

    return round(max(0.0, min(1.0, weight)), 4)


def _shortest_paths(
    start_id: int,
    edges: list[list[float]],
) -> tuple[dict[int, float], dict[int, list[int]]]:
    """
    Dijkstra from the origin with hop cost (1 - weight).

    Returns ({paper_id: distance}, {paper_id: [origin .. paper_id]}).
    The origin star keeps every node reachable; ties break by the
    smaller paper id so output is deterministic.
    """
    adjacency: dict[int, list[tuple[int, float]]] = {}

    for source, target, weight in edges:
        source_id = int(source)
        target_id = int(target)
        cost = max(0.0, 1.0 - float(weight))

        adjacency.setdefault(source_id, []).append((target_id, cost))
        adjacency.setdefault(target_id, []).append((source_id, cost))

    distances: dict[int, float] = {start_id: 0.0}
    previous: dict[int, int] = {}
    visited: set[int] = set()
    queue: list[tuple[float, int]] = [(0.0, start_id)]

    while queue:
        distance, node_id = heapq.heappop(queue)

        if node_id in visited:
            continue

        visited.add(node_id)

        for neighbour, cost in adjacency.get(node_id, []):
            candidate = distance + cost

            if candidate < distances.get(neighbour, float("inf")) - 1e-9:
                distances[neighbour] = candidate
                previous[neighbour] = node_id
                heapq.heappush(queue, (candidate, neighbour))

    paths: dict[int, list[int]] = {start_id: [start_id]}

    for node_id in distances:
        if node_id == start_id:
            continue

        chain = [node_id]
        cursor = node_id

        while cursor != start_id:
            cursor = previous.get(cursor)

            if cursor is None:  # unreachable (defensive; star prevents it)
                chain = []
                break

            chain.append(cursor)

        chain.reverse()
        paths[node_id] = chain

    return (
        {node_id: round(distance, 4) for node_id, distance in distances.items()},
        paths,
    )


def _common_groups(
    members: dict[int, set[str]],
) -> list[dict]:
    """
    Values shared by at least two graph papers, shaped like the
    reference model's common_* entries:
        {name, mentions (paper ids), edges_count}
    """
    inverted: dict[str, list[int]] = {}

    for paper_id, values in members.items():
        for value in values:
            inverted.setdefault(value, []).append(paper_id)

    groups = [
        {
            "name": value,
            "mentions": sorted(paper_ids),
            "edges_count": len(paper_ids),
        }
        for value, paper_ids in inverted.items()
        if len(paper_ids) >= 2
    ]

    groups.sort(key=lambda group: (-group["edges_count"], group["name"]))

    return groups[:MAX_COMMON_GROUPS]


def build_connected_graph(
    *,
    seed: Paper,
    papers: list[Paper],
    pipeline: str,
    weights: dict[str, float] | None = None,
    db=None,
) -> dict:
    """
    Build the weighted graph parts for the given node set.

    `papers` must contain `seed` first, followed by the ranked
    similar papers (any order after that). Returns the edge list,
    weighted shortest-path data, and the shared author/topic/
    citation groups; the caller attaches them to its node payloads.

    `db` is the session used to load PaperCitation rows. When omitted
    it is derived from the attached `seed` (api.py's request session),
    so the graph sees the citation cache without a signature change
    at the call site. No session -> no citation data -> the exact
    pre-P2-A output.
    """
    # Preset shares, or the caller's dial allocation for the
    # custom pipeline.
    if weights is None:
        weights = get_pipeline_weights(pipeline)

    # --------------------------------------------------------
    # Citation neighbourhood, loaded exactly once for the whole
    # node set: one query backs both the pair weights and the
    # common_references / common_citers groups. Never per pair.
    # --------------------------------------------------------
    if db is None:
        db = object_session(seed)

    paper_ids = [paper.id for paper in papers]

    if db is not None:
        references_by_paper, citers_by_paper = citation_maps(
            db,
            paper_ids,
        )
    else:
        references_by_paper, citers_by_paper = {}, {}

    citation_scores = similarity_from_maps(
        references_by_paper,
        citers_by_paper,
        paper_ids,
    )

    vectors = {
        paper.id: {
            "tfidf": _load_vector(paper.tfidf_vector),
            "sbert": _load_vector(paper.sbert_vector),
        }
        for paper in papers
    }

    names = {paper.id: _last_names(paper) for paper in papers}
    topics = {paper.id: _topics(paper) for paper in papers}

    # --------------------------------------------------------
    # Metadata component per unordered pair -- exactly what
    # score_candidates computes for the recommendation layer
    # (0.25 * title + 0.25 * abstract + 0.25 * keywords +
    #  0.25 * year), computed once per pair by walking rows.
    # --------------------------------------------------------
    metadata_scores: dict[tuple[int, int], float] = {}

    for index, paper_a in enumerate(papers):
        if index + 1 >= len(papers):
            break

        row = score_candidates(
            query=None,
            seed_paper=paper_a,
            candidates=papers[index + 1:],
        )

        for paper_b in papers[index + 1:]:
            metadata_scores[(paper_a.id, paper_b.id)] = row.get(
                paper_b.id,
                0.0,
            )

    def metadata_for(paper_a: Paper, paper_b: Paper) -> float:
        key = (paper_a.id, paper_b.id)

        if key in metadata_scores:
            return metadata_scores[key]

        return metadata_scores.get((paper_b.id, paper_a.id), 0.0)

    # --------------------------------------------------------
    # Pairwise edges: origin star (connectivity) + every other
    # pair at or above MIN_EDGE_WEIGHT.
    # --------------------------------------------------------
    edge_weights: dict[tuple[int, int], float] = {}

    for index, paper_a in enumerate(papers):
        for paper_b in papers[index + 1:]:
            pair = (
                min(paper_a.id, paper_b.id),
                max(paper_a.id, paper_b.id),
            )

            weight = _pair_weight(
                paper_a=paper_a,
                paper_b=paper_b,
                weights=weights,
                vectors=vectors,
                names=names,
                metadata_score=metadata_for(paper_a, paper_b),
                citation_score=citation_scores.get(pair, 0.0),
            )

            touches_origin = (
                paper_a.id == seed.id or paper_b.id == seed.id
            )

            if not touches_origin and weight < MIN_EDGE_WEIGHT:
                continue

            key = (
                min(paper_a.id, paper_b.id),
                max(paper_a.id, paper_b.id),
            )
            edge_weights[key] = weight

    edges = [
        [left, right, weight]
        for (left, right), weight in sorted(edge_weights.items())
    ]

    # --------------------------------------------------------
    # Weighted shortest paths back to the origin.
    # --------------------------------------------------------
    path_lengths, node_paths = _shortest_paths(seed.id, edges)

    # --------------------------------------------------------
    # Shared authors / topics / cited works (the common_* groups).
    # Reference and citer group names are citation keys from
    # citations.py's scheme ("local:<paper_id>" or the OpenAlex id).
    # --------------------------------------------------------
    common_authors = _common_groups(names)
    common_topics = _common_groups(topics)
    common_references = _common_groups(references_by_paper)[
        :MAX_CITATION_GROUPS
    ]
    common_citers = _common_groups(citers_by_paper)[
        :MAX_CITATION_GROUPS
    ]

    return {
        "start_id": seed.id,
        "edges": edges,
        "path_lengths": path_lengths,
        "node_paths": node_paths,
        "common_authors": common_authors,
        "common_topics": common_topics,
        "common_references": common_references,
        "common_citers": common_citers,
    }
