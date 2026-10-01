from app.models.models import Paper

# =========================================================
# BROAD-SUBJECT FALLBACK — the taxonomy grows.
#
# When the specific rules miss, the paper's broad subject is
# detected from a domain keyword map and a NEW category is
# synthesized from the paper's own strongest topic phrase, so
# an upload can recommend (and the catalog can later adopt) a
# subject/category that has never been stored before. Without
# this, unknown papers fall back to the form's static default
# ("Computer Science: Machine Learning") no matter what the
# paper actually is.
# =========================================================

SUBJECT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Education": (
        "education",
        "teaching",
        "curriculum",
        "pedagogy",
        "classroom",
        "school",
        "student learning",
        "blended learning",
        "e-learning",
        "learning motivation",
        "learning environment",
    ),
    "Psychology": (
        "psychology",
        "cognitive",
        "behavioral",
        "perception",
        "anxiety",
        "depression",
        "mental health",
        "personality",
    ),
    "Biology": (
        "biology",
        "gene",
        "genetic",
        "dna",
        "rna",
        "protein",
        "enzyme",
        "cell biology",
        "organism",
        "molecular biology",
        "microbiology",
    ),
    "Chemistry": (
        "chemistry",
        "chemical",
        "molecule",
        "polymer",
        "compound",
        "catalyst",
        "reaction kinetics",
    ),
    "Physics": (
        "physics",
        "quantum",
        "electromagnetic",
        "particle physics",
        "photon",
        "relativity",
        "thermodynamics",
    ),
    "Statistics": (
        "statistics",
        "statistical analysis",
        "regression",
        "hypothesis testing",
        "confidence interval",
        "sampling method",
        "anova",
    ),
    "Economics": (
        "economics",
        "economic",
        "market",
        "inflation",
        "supply chain",
        "pricing",
        "trade policy",
    ),
    "Business Administration": (
        "business",
        "business management",
        "management practices",
        "management strategy",
        "organizational management",
        "entrepreneurship",
        "marketing",
        "organizational",
        "strategic management",
    ),
    "Information Technology": (
        "information technology",
        "information system",
        "database system",
        "software system",
        "web application",
        "mobile application",
        "system implementation",
    ),
    "Engineering": (
        "engineering",
        "structural",
        "mechanical",
        "electrical",
        "civil",
        "control system",
        "signal processing",
        "robotics",
    ),
}

# Words too generic to name a category ("The Effects of Blended
# Learning" must not produce a category named "The Effects").
_GENERIC_CATEGORY_WORDS = {
    "the",
    "a",
    "an",
    "of",
    "for",
    "and",
    "on",
    "in",
    "to",
    "with",
    "using",
    "based",
    "towards",
    "toward",
    "study",
    "analysis",
    "effects",
    "effect",
    "impact",
    "new",
    "toward",
}


def _synthesize_category(paper: Paper) -> str | None:
    """Pick the paper's strongest topic phrase as a NEW category name.

    Prefers the first meaningful keyword token; falls back to the
    title's first meaningful phrase. The phrase is returned exactly
    as authored (no title-casing, which would mangle acronyms).
    """

    sources: list[str] = []

    for field in (paper.keywords, paper.title):
        if not field:
            continue
        sources.extend(
            part.strip()
            for part in field.replace("|", ",").replace(";", ",").split(",")
            if part.strip()
        )

    for candidate in sources:
        words = [
            word
            for word in candidate.lower().split()
            if len(word) >= 3 and word not in _GENERIC_CATEGORY_WORDS
        ]

        if not words:
            continue

        # The candidate must carry real topical weight, not just
        # one filler word, and must not just repeat the subject.
        if len(words) == 1 and words[0] in {
            "method",
            "methods",
            "model",
            "models",
            "approach",
            "review",
            "survey",
        }:
            continue

        return candidate[:60]

    return None


def _classify_broad_subject(paper: Paper) -> str | None:
    """Detect the broad subject and synthesize a new category.

    Returns "Subject: New Category" or None when no subject can
    be detected (the paper stays unclassified rather than being
    force-fit into a wrong category).
    """

    text = (
        f"{paper.title or ''} {paper.abstract or ''} {paper.keywords or ''}"
    ).lower()

    best: tuple[int, str] | None = None

    for subject, keywords in SUBJECT_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in text)

        if hits and (best is None or hits > best[0]):
            best = (hits, subject)

    if best is None:
        return None

    category = _synthesize_category(paper)
    if not category:
        return None

    return f"{best[1]}: {category}"


def classify_paper(paper: Paper) -> str | None:
    """
    Classify a paper using its title, abstract, and keywords.

    Returns:
        "Subject: Category"
        or None if the paper cannot be classified confidently.

    Also assigns the answer to paper.subject_category when it is
    currently empty -- every importer already calls this function
    (file preview, upload, identifier preview, metadata import), so
    they all become categorized without changing their code. A
    subject a curator already set is never overwritten: same
    fill-only rule enrich_paper_metadata() follows.
    """
    category = _classify_paper_category(paper)

    if category and not (paper.subject_category or "").strip():
        paper.subject_category = category

    return category


def _classify_paper_category(paper: Paper) -> str | None:
    """Keyword-rule classification core (pure -- never mutates)."""

    title = (paper.title or "").lower()
    abstract = (paper.abstract or "").lower()
    keywords = (paper.keywords or "").lower()

    text = f"{title} {abstract} {keywords}"

    # =========================================================
    # CORRUPTED TITLES
    # =========================================================

    # Some extracted titles are corrupted, but the abstract
    # and/or keywords may still contain enough information
    # to classify the paper.
    #
    # Therefore, we do NOT immediately return None.
    # Instead, we simply exclude the corrupted title from
    # the text used for classification.

    corrupted_titles = {
        "]oc.htam[",
        "]an.htam[",
        "]ts.htam[",
        "]hp-oib.scisyhp[",
        "]ac.htam[",
        "]co.htam[",
        "]af.htam[",
    }

    clean_title = title.strip()

    title_is_corrupted = (
        clean_title in corrupted_titles
        or (
            clean_title.startswith("]")
            and clean_title.endswith("[")
        )
        or (
            clean_title.count("]") >= 1
            and clean_title.count("[") >= 1
        )
    )

    # Use the title only when it appears to be valid.
    if title_is_corrupted:
        text = f"{abstract} {keywords}"
    else:
        text = f"{title} {abstract} {keywords}"

    # =========================================================
    # HIGH-PRIORITY MATHEMATICS CLASSIFICATIONS
    # =========================================================

    # Low-rank matrix completion is primarily a linear algebra /
    # matrix theory problem, even when the paper mentions
    # machine learning or algorithms.
    if any(
        keyword in text
        for keyword in [
            "low-rank matrix completion",
            "low rank matrix completion",
            "low-rank matrix",
            "low rank matrix",
            "matrix completion",
            "rank-k matrix",
            "rank k matrix",
        ]
    ):
        return "Mathematics: Linear Algebra"

    # Epidemic/SIR papers whose primary contribution is mathematical
    # modeling should be classified as Mathematical Modeling even
    # when the abstract also mentions machine learning.
    if any(
        keyword in text
        for keyword in [
            "mathematical modeling of epidemic",
            "mathematical modelling of epidemic",
            "epidemic diseases",
            "sir model",
            "sir family of compartmental models",
        ]
    ):
        return "Mathematics: Mathematical Modeling"

    # =========================================================
    # COMPUTER SCIENCE
    # =========================================================

    # Information Retrieval
    if any(
        keyword in text
        for keyword in [
            "information retrieval",
            "document retrieval",
            "text retrieval",
            "search engine",
            "tf-idf",
            "tfidf",
            "content-based recommendation",
            "recommendation system",
        ]
    ):
        return "Computer Science: Information Retrieval"

    # Natural Language Processing
    if any(
        keyword in text
        for keyword in [
            "natural language processing",
            "nlp",
            "language model",
            "sentence embedding",
            "semantic similarity",
            "text generation",
        ]
    ):
        return "Computer Science: Natural Language Processing"

    # Machine Learning
    if any(
        keyword in text
        for keyword in [
            "machine learning",
            "deep learning",
            "neural network",
            "transformer",
            "classification model",
        ]
    ):
        return "Computer Science: Machine Learning"

    # Distributed Systems
    if any(
        keyword in text
        for keyword in [
            "distributed system",
            "distributed computing",
            "parallel computing",
            "cloud computing",
        ]
    ):
        return "Computer Science: Distributed Systems"

    # =========================================================
    # MATHEMATICAL ANALYSIS PRIORITY RULE
    # =========================================================

    # Some mathematics papers use the word "algorithm" because
    # they propose a mathematical procedure or computational
    # method.
    #
    # This does NOT make them Computer Science: Algorithms.
    #
    # Papers involving variational inequalities, Bregman methods,
    # fixed-point theory, equilibrium problems, and mathematical
    # convergence are primarily Mathematical Analysis.

    if any(
        keyword in text
        for keyword in [
            "variational inequality",
            "bregman distance",
            "bregman nonexpansive",
            "fixed point",
            "fixed points",
            "equilibrium problem",
            "equilibrium problems",
            "strong convergence",
            "convergence of the sequence",
        ]
    ):
        return "Mathematics: Mathematical Analysis"

    # Algorithms
    # Only use strong algorithm-specific phrases.
    #
    # This rule comes AFTER the Mathematical Analysis rule so
    # that mathematical papers that merely USE an algorithm
    # are not incorrectly classified as Computer Science.
    if any(
        keyword in text
        for keyword in [
            "algorithm for finding",
            "algorithm for computing",
            "algorithm design",
            "branch-and-bound",
            "branch and bound",
            "algorithmic",
        ]
    ):
        return "Computer Science: Algorithms"

    # =========================================================
    # MATHEMATICS
    # =========================================================

    # Network optimization / multi-commodity flow
    #
    # These papers use graph theory as a foundation, but their
    # primary contribution is the mathematical/network
    # optimization model. The bare phrase "network model" is
    # deliberately NOT a match: "neural network model" is a
    # computer-science phrase, and this rule must not capture it.
    if any(
        keyword in text
        for keyword in [
            "multi-commodity flow",
            "network optimization",
            "network optimization model",
            "network flow model",
            "healthcare logistics",
        ]
    ):
        return "Mathematics: Mathematical Modeling"

    # Graph Theory
    if any(
        keyword in text
        for keyword in [
            "graph theory",
            "chromatic number",
            "chromatic",
            "induced subgraphs",
            "induced cycles",
            "complete subgraph",
            "large chromatic number",
            "hamiltonian cycle",
            "hamiltonian cycles",
            "hamiltonian number",
            "planar graph",
            "planar graphs",
            "hypohamiltonian",
            "spectral graph theory",
            "spectral graph",
            "directed graphs",
            "weighted directed graphs",
            "coloring number",
            "list-chromatic",
            "isogeny graph",
        ]
    ):
        return "Mathematics: Graph Theory"

    # Linear Algebra
    if any(
        keyword in text
        for keyword in [
            "linear algebra",
            "matrix completion",
            "low-rank matrix",
            "low rank matrix",
            "low-rank matrix completion",
            "low rank matrix completion",
            "rank of a matrix",
            "rank-k matrix",
            "rank k matrix",
            "eigenvalue decomposition",
            "eigen decomposition",
            "eigen-decomposition",
            "matrix approximation",
            "matrix recovery",
            "matrix of minimal complexity",
            "matrix decompositions",
            "low-rank approximation",
            "bilinear forms",
            "plücker coordinates",
        ]
    ):
        return "Mathematics: Linear Algebra"

    # Mathematical Modeling
    if any(
        keyword in text
        for keyword in [
            "mathematical model",
            "mathematical modeling",
            "mathematical modelling",
            "epidemic model",
            "epidemic models",
            "predator-prey",
            "populationdynamics",
            "lotka-volterra",
            "lotka volterra",
            "predator prey",
            "population dynamics",
            "population model",
            "epidemic diseases",
            "sir model",
            "chemical reaction network",
            "mass action kinetics",
            "traffic flow model",
            "multi-commodity flow",
            "network optimization",
            "network optimization model",
            "network flow model",
            "healthcare logistics",
            "traffic flow models",
        ]
    ):
        return "Mathematics: Mathematical Modeling"

    # Mathematical Analysis
    if any(
        keyword in text
        for keyword in [
            "real analysis",
            "complex analysis",
            "functional analysis",
            "harmonic analysis",
            "fourier transform",
            "fourier analysis",
            "sobolev",
            "bounded convergence theorem",
            "uniform convergence",
            "analytic polynomial",
            "analytic polynomials",
            "lebesgue measure",
            "lebesgue integration",
            "measure and integration",
            "fixed point theorem",
            "almost convergence",
            "analytic functions",
            "hardy space",
            "hardy spaces",
            "banach fixed point",
            "banach's fixed point",
            "monotone operator",
            "monotone convergence",
            "variational inequality",
            "bregman",
            "bregman distance",
            "banach space",
            "weak compactness",
            "weakly sequentially continuous",
            "hammerstein integral equation",
        ]
    ):
        return "Mathematics: Mathematical Analysis"

    # Probability Theory
    #
    # Bare "probability", "probabilistic", and "stochastic" are too
    # generic ("probability of success", "probabilistic methods",
    # "stochastic optimization") and appear across many disciplines;
    # only specific probability-theory phrasing is accepted here.
    if any(
        keyword in text
        for keyword in [
            "probability theory",
            "probability distribution",
            "random variable",
            "stochastic process",
            "stochastic differential",
            "point process",
            "point processes",
        ]
    ):
        return "Mathematics: Probability Theory"

    # Numerical Analysis
    if any(
        keyword in text
        for keyword in [
            "numerical analysis",
            "numerical method",
            "numerical methods",
            "numerical approximation",
            "numerical computation",
            "numerical solution",
        ]
    ):
        return "Mathematics: Numerical Analysis"

    # Topology
    if any(
        keyword in text
        for keyword in [
            "topology",
            "topological",
            "topological space",
            "homology",
            "homotopy",
        ]
    ):
        return "Mathematics: Topology"

    # =========================================================
    # NEW SUBJECT/CATEGORY SYNTHESIS
    # =========================================================

    # The specific rules missed: detect the broad subject and
    # synthesize a new category from the paper's own topic
    # phrasing. This is how the taxonomy grows — an upload can
    # recommend a subject/category that was never stored before,
    # and the catalog adopts it once the paper is saved.

    broad = _classify_broad_subject(paper)
    if broad:
        return broad

    # =========================================================
    # UNKNOWN
    # =========================================================

    return None