"""arXiv category recognition.

arXiv papers carry one or more category codes (e.g. ``cs.LG``,
``math.OC``, ``stat.ML``) plus a primary category. This module maps
those codes onto the repository's subject/category taxonomy so an
arXiv import is classified properly instead of being left unlabeled
(and later force-fit by the keyword rules). Categories that have no
good existing slot introduce a NEW category under the matching
subject — the same "taxonomy grows" rule the classifier's broad
fallback follows; the catalog adopts it once the paper is saved.

Unknown codes map to nothing; the text-based classifier then gets
its normal turn.
"""

# arXiv category code -> (subject, category)
ARXIV_CATEGORY_MAP: dict[str, tuple[str, str]] = {
    # ---------------------------------------------------------
    # Computer Science
    # ---------------------------------------------------------
    "cs.LG": ("Computer Science", "Machine Learning"),
    "cs.AI": ("Computer Science", "Machine Learning"),
    "cs.CV": ("Computer Science", "Machine Learning"),
    "cs.NE": ("Computer Science", "Machine Learning"),
    "cs.CL": ("Computer Science", "Natural Language Processing"),
    "cs.IR": ("Computer Science", "Information Retrieval"),
    "cs.DS": ("Computer Science", "Algorithms"),
    "cs.CC": ("Computer Science", "Algorithms"),
    "cs.DM": ("Mathematics", "Graph Theory"),
    "cs.DC": ("Computer Science", "Distributed Systems"),
    "cs.SE": ("Computer Science", "Software Engineering"),
    "cs.DB": ("Computer Science", "Databases"),
    "cs.CR": ("Computer Science", "Security"),
    "cs.CY": ("Computer Science", "Security"),
    "cs.HC": ("Computer Science", "Human-Computer Interaction"),
    "cs.MA": ("Computer Science", "Multiagent Systems"),
    "cs.GT": ("Mathematics", "Game Theory"),
    "cs.SY": ("Engineering", "Systems and Control"),
    "cs.RO": ("Engineering", "Robotics"),
    "cs.AR": ("Engineering", "Computer Architecture"),
    "cs.CE": ("Engineering", "Computer Engineering"),
    # ---------------------------------------------------------
    # Mathematics
    # ---------------------------------------------------------
    "math.OC": ("Mathematics", "Mathematical Modeling"),
    "math.DS": ("Mathematics", "Mathematical Modeling"),
    "math.NA": ("Mathematics", "Numerical Analysis"),
    "math.PR": ("Mathematics", "Probability Theory"),
    "math.ST": ("Mathematics", "Probability Theory"),
    "math.CO": ("Mathematics", "Graph Theory"),
    "math.AP": ("Mathematics", "Mathematical Analysis"),
    "math.CA": ("Mathematics", "Mathematical Analysis"),
    "math.FA": ("Mathematics", "Mathematical Analysis"),
    "math.AG": ("Mathematics", "Algebraic Geometry"),
    "math.NT": ("Mathematics", "Number Theory"),
    "math.AT": ("Mathematics", "Topology"),
    "math.GT": ("Mathematics", "Topology"),
    "math.LO": ("Mathematics", "Logic"),
    # ---------------------------------------------------------
    # Statistics
    # ---------------------------------------------------------
    "stat.ML": ("Computer Science", "Machine Learning"),
    "stat.ME": ("Statistics", "Methodology"),
    "stat.AP": ("Statistics", "Applications"),
    "stat.CO": ("Statistics", "Computation"),
    "stat.TH": ("Mathematics", "Probability Theory"),
    # ---------------------------------------------------------
    # Engineering, biology, economics, physics
    # ---------------------------------------------------------
    "eess.SP": ("Engineering", "Signal Processing"),
    "eess.AS": ("Engineering", "Signal Processing"),
    "eess.IV": ("Engineering", "Signal Processing"),
    "q-bio.QM": ("Biology", "Quantitative Methods"),
    "q-bio.PE": ("Biology", "Populations and Evolution"),
    "q-bio.GN": ("Biology", "Genomics"),
    "q-fin.EC": ("Economics", "Econometrics"),
    "q-fin.ST": ("Economics", "Statistical Finance"),
    "q-fin.TR": ("Economics", "Trading and Market Microstructure"),
    "physics.data-an": ("Physics", "Data Analysis"),
    "physics.comp-ph": ("Physics", "Computational Physics"),
    "physics.class-ph": ("Physics", "Classical Physics"),
    "physics.flu-dyn": ("Physics", "Fluid Dynamics"),
    "physics.optics": ("Physics", "Optics"),
}

# Some arXiv codes map to "no category" but still identify a subject
# well enough to label the paper under that subject with its own
# category synthesized from the code's expansion.
ARXIV_SUBJECT_ONLY: dict[str, str] = {
    "cs.IT": "Computer Science",
    "cs.GR": "Computer Science",
    "cs.PL": "Computer Science",
    "cs.OH": "Computer Science",
}


def arxiv_to_subject_category(
    primary_category: str | None,
    categories: list[str] | None = None,
) -> str | None:
    """Map arXiv category codes to "Subject: Category".

    The primary category wins when it maps; otherwise the first
    category in the list with a mapping is used. Codes with no
    mapping return None so the text classifier keeps its turn.
    """

    ordered = []

    if primary_category:
        ordered.append(primary_category)

    if categories:
        ordered.extend(
            code
            for code in categories
            if code != primary_category
        )

    for code in ordered:
        if code in ARXIV_CATEGORY_MAP:
            subject, category = ARXIV_CATEGORY_MAP[code]
            return f"{subject}: {category}"

    return None


def arxiv_category_names(
    categories: list[str] | None,
) -> list[str]:
    """Human-readable category names for the mapped codes.

    Deduplicated and in the order the codes appeared; used to fill
    the paper's keywords so the recommendation engine can search on
    them. Unknown codes are skipped.
    """

    names: list[str] = []

    for code in categories or []:
        mapped = ARXIV_CATEGORY_MAP.get(code)
        if mapped is None:
            continue

        category = mapped[1]
        if category not in names:
            names.append(category)

    return names