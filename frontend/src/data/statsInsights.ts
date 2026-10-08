/* ============================================================
   STATS INSIGHTS — the in-depth process interpretations shown
   in the universal Statistics panel.
   Each entry pairs the formula (as stated in the Engine and
   Appendix B) with what it actually does and why it matters.
   ============================================================ */

export interface StatsInsight {
  step: string;
  formula: string;
  plain: string;
  why: string;
}

export const STATS_INSIGHTS: StatsInsight[] = [
  {
    step: "1 · Text preparation",
    formula: "text(d) = normalize( Title(d) + Abstract(d) + Keywords(d) )",
    plain:
      "Every paper is reduced to one lowercase block of text with " +
      "punctuation stripped and whitespace collapsed.",
    why:
      "All three signals compare the same cleaned shape. Left raw, " +
      "\"Deep Learning\" and \"deep learning\" would be different " +
      "things; after this step they are the same thing.",
  },
  {
    step: "2 · TF-IDF (lexical signal)",
    formula: "idf(t) = ln( (1 + n) / (1 + df(t)) ) + 1",
    plain:
      "A term's weight grows with how often a paper uses it (term " +
      "frequency) and with how rare the term is across the corpus " +
      "(inverse document frequency).",
    why:
      "Common filler like \"study\" or \"system\" carries almost no " +
      "meaning per paper, while a term few papers use is a strong " +
      "fingerprint. The smooth +1 keeps every term from collapsing to " +
      "zero weight.",
  },
  {
    step: "3 · Cosine similarity",
    formula: "s(d) = ( v(Q) · v(d) ) / ( ||v(Q)||₂ · ||v(d)||₂ )",
    plain:
      "The query and each paper become vectors; the score is the " +
      "cosine of the angle between them — how aligned the two " +
      "directions are, ignoring vector length.",
    why:
      "A long paper and a short query are compared fairly: magnitude " +
      "(sheer word count) does not inflate the score, only shared " +
      "direction does. Zero vectors score 0.",
  },
  {
    step: "4 · S-BERT (semantic signal)",
    formula: "e(d) = SBERT( text(d) ) ∈ R³⁸⁴",
    plain:
      "The same cleaned text is embedded into a 384-dimensional " +
      "semantic space where synonyms sit close together.",
    why:
      "Lexical matching misses paraphrase: a paper about \"deep " +
      "learning\" escapes the query \"neural networks\". The " +
      "embedding space places both near each other, so the semantic " +
      "cosine catches what TF-IDF cannot.",
  },
  {
    step: "5 · Metadata signals",
    formula: "s_meta(d) = 0.25·s_title + 0.25·s_abstract + 0.25·s_keywords + 0.25·s_year",
    plain:
      "Each text field is compared with its own vectorizer fitted on " +
      "the query plus all candidates, then the four field scores are " +
      "averaged, and the year term adds recency proximity.",
    why:
      "Fields measure different promises: the title is the paper's " +
      "self-summary, keywords its declared labels, the abstract its " +
      "full claim. Equal 25% weights and a clamped [0, 1] result keep " +
      "any single field from dominating; a missing field simply " +
      "contributes 0.",
  },
  {
    step: "6 · Normalization",
    formula: "s'(d) = ( s(d) − min ) / ( max − min )",
    plain:
      "TF-IDF and S-BERT raw cosines are stretched so the best " +
      "candidate scores 1 and the worst scores 0 for that query.",
    why:
      "The three components live on different scales; without " +
      "min-max stretching, the weight on each signal would not mean " +
      "what it says. Metadata is already bounded, so it passes " +
      "through unchanged.",
  },
  {
    step: "7 · Weighted fusion",
    formula: "S(d) = w₁·s'_tfidf(d) + w₂·s'_sbert(d) + w₃·s'_meta(d)",
    plain:
      "The normalized component scores are multiplied by the " +
      "pipeline's weights and added into one final score.",
    why:
      "This is the single tuning point of the system: a pipeline with " +
      "TF-IDF at 100% ranks purely lexically; the full blend mixes " +
      "lexical, semantic, and metadata evidence, and the Lab's dials " +
      "change the mix per experiment.",
  },
  {
    step: "8 · Ranking & output",
    formula: "R = first top_k of [ d ∈ D : S(d) > 0 ]",
    plain:
      "Candidates are sorted by S(d) descending; ties break by newer " +
      "publication year, then by title; only positive scores rank, and " +
      "at most top_k are returned.",
    why:
      "Every step before this is deterministic, so the same query, " +
      "pipeline, and repository always produce the same ranking — " +
      "the reproducibility the Arena and the study's evaluation rely " +
      "on.",
  },
  {
    step: "9 · Diversification (MMR)",
    formula: "MMR(d) = λ·S(d) − (1−λ)·max sim(d, picked)",
    plain:
      "When Diversify is on, each next pick balances relevance " +
      "against how different it is from the papers already chosen.",
    why:
      "Pure relevance can hand the list five near-identical papers; " +
      "MMR spreads the ranking so each entry adds information. It " +
      "only reorders — S(d) is never recomputed.",
  },
];