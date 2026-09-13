"""
Validation logic for papers.

A paper is REQUIRED to have Title, Abstract, Keywords, and Publication Year
to be usable by the Recommendation Layer -- these are exactly the four
fields the Metadata component scores AND the four fields the PDF
auto-extraction pipeline attempts to pull out. Missing any of these does
not delete or block storage of the paper -- it just marks it ineligible
for recommendation, and records which field(s) are missing.

Subject/Category is still required at dataset-curation time (a human
judgment call when a paper is manually added to the study's dataset), but
it is NOT part of this automated validity check, so PDF auto-extraction
can fully determine validity on its own.

DOI and Citation Count are optional, non-signal fields: their absence
never affects is_valid_for_recommendation.
"""

from app.models.models import Paper

# Fields required for a paper to be eligible for recommendation.
REQUIRED_FIELDS = ["title", "abstract", "keywords", "publication_year"]


def validate_paper(paper: Paper) -> Paper:
    """
    Checks a Paper instance against REQUIRED_FIELDS, then sets
    paper.is_valid_for_recommendation and paper.missing_fields accordingly.

    Call this every time a paper is inserted or its metadata is updated,
    before committing the session.
    """
    missing = []
    for field_name in REQUIRED_FIELDS:
        value = getattr(paper, field_name, None)
        is_blank_string = isinstance(value, str) and value.strip() == ""
        if value is None or is_blank_string:
            missing.append(field_name)

    paper.missing_fields = ", ".join(missing) if missing else None
    paper.is_valid_for_recommendation = len(missing) == 0
    return paper
