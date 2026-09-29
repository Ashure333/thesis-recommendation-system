"""
Text preparation for the recommendation pipeline.

Chapter 3 (Text Preparation): the researchers concatenate a paper's
Title, Abstract, and Keywords into one text block, then apply basic
normalization -- lowercasing, whitespace normalization, and removal of
unnecessary punctuation/textual noise -- before that text feeds both the
TF-IDF and S-BERT pipelines. Running both components on identical text
keeps the comparison focused on lexical vs. semantic representation, not
on differences in source text.

This module owns exactly that step. It does NOT touch tfidf_vector or
sbert_vector -- those are populated by the individual pipelines in
app/services/recommendation/.
"""

import re

from app.models.models import Paper

# Collapses any run of whitespace (spaces, tabs, newlines) into one space.
_WHITESPACE_RE = re.compile(r"\s+")

# Keeps letters, digits, and spaces; strips punctuation/symbols. Kept
# deliberately simple/language-agnostic rather than pulling in a full NLP
# tokenizer, consistent with the prototype's scope -- scikit-learn's
# TfidfVectorizer and sentence-transformers both do their own internal
# tokenization on top of this anyway.
_PUNCTUATION_RE = re.compile(r"[^\w\s]", re.UNICODE)


def build_prepared_text(title: str | None, abstract: str | None, keywords: str | None) -> str:
    """
    Concatenates Title + Abstract + Keywords and normalizes the result:
    lowercase, punctuation stripped, whitespace collapsed to single spaces.

    Any of the three fields may be None/blank (e.g. mid-manual-entry) --
    a missing field simply contributes nothing to the concatenation,
    rather than raising an error. (A paper missing any of these is
    already flagged invalid-for-recommendation by validate_paper(), so
    it won't reach the TF-IDF/S-BERT corpus anyway -- see the `_get_valid_papers`
    filters in the two pipeline modules.)
    """
    parts = [p for p in (title, abstract, keywords) if p and p.strip()]
    combined = " ".join(parts)

    combined = combined.lower()
    combined = _PUNCTUATION_RE.sub(" ", combined)
    combined = _WHITESPACE_RE.sub(" ", combined).strip()

    return combined


def refresh_prepared_text(paper: Paper) -> Paper:
    """
    Recomputes paper.prepared_text from the paper's current Title,
    Abstract, and Keywords. Call this any time one of those three fields
    changes -- on initial insert (auto-extracted or manual) in
    upload_paper_from_pdf(), and again after complete_paper_manually()
    fills in a previously-missing field -- so prepared_text never goes
    stale relative to its source fields.

    Does NOT touch tfidf_vector / sbert_vector. A TF-IDF vector in
    particular depends on the whole corpus's vocabulary, not just this
    one paper, so those get recomputed separately -- see
    scripts/rebuild_recommendation_index.py.
    """
    paper.prepared_text = build_prepared_text(paper.title, paper.abstract, paper.keywords)
    return paper