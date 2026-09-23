"""
Recommendation pipeline configuration.

Each pipeline is defined as a combination of the three independent
recommendation components:

    - TF-IDF
    - S-BERT
    - Metadata

The weights are configuration values rather than being hard-coded into
the search logic. This allows the researchers to adjust the hybrid
weights without rewriting the recommendation components.

The current values follow the provisional Chapter 3 configuration.
They can be changed later once the final weighting scheme is approved.
"""

from typing import Final


PipelineWeights = dict[str, float]


PIPELINE_CONFIGS: Final[dict[str, PipelineWeights]] = {
    # ---------------------------------------------------------
    # Individual components
    # ---------------------------------------------------------

    "tfidf": {
        "tfidf": 1.0,
        "sbert": 0.0,
        "metadata": 0.0,
    },

    "sbert": {
        "tfidf": 0.0,
        "sbert": 1.0,
        "metadata": 0.0,
    },

    # ---------------------------------------------------------
    # Two-component configurations
    # ---------------------------------------------------------

    "tfidf_sbert": {
        "tfidf": 0.50,
        "sbert": 0.50,
        "metadata": 0.0,
    },

    "tfidf_metadata": {
        "tfidf": 0.667,
        "sbert": 0.0,
        "metadata": 0.333,
    },

    "sbert_metadata": {
        "tfidf": 0.0,
        "sbert": 0.667,
        "metadata": 0.333,
    },

    # ---------------------------------------------------------
    # Full hybrid
    # ---------------------------------------------------------

    "tfidf_sbert_metadata": {
        "tfidf": 0.40,
        "sbert": 0.40,
        "metadata": 0.20,
    },
}


PIPELINE_NAMES: Final[tuple[str, ...]] = tuple(
    PIPELINE_CONFIGS.keys()
)


def get_pipeline_weights(pipeline: str) -> PipelineWeights:
    """
    Return the configured component weights for a pipeline.

    Raises:
        ValueError:
            If the requested pipeline does not exist.
    """

    try:
        return PIPELINE_CONFIGS[pipeline]
    except KeyError as exc:
        raise ValueError(
            f"Unsupported recommendation pipeline: {pipeline}"
        ) from exc