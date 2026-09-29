from app.models.models import Paper


def classify_paper(paper: Paper) -> str | None:
    """
    Classify a paper using its title, abstract, and keywords.

    Returns:
        "Subject: Category"
        or None if the paper cannot be classified confidently.
    """

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
            "variational inequalities",
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
    # optimization model.
    if any(
        keyword in text
        for keyword in [
            "multi-commodity flow",
            "network optimization",
            "network model",
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
            "epidemic diseases",
            "sir model",
            "chemical reaction network",
            "mass action kinetics",
            "traffic flow model",
            "multi-commodity flow",
            "network optimization",
            "network model",
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
            "monotonicity",
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
    if any(
        keyword in text
        for keyword in [
            "probability theory",
            "probability",
            "probabilistic",
            "random variable",
            "stochastic",
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
    # UNKNOWN
    # =========================================================

    return None