// ============================================================
// MATHEMATICAL PSEUDOCODE FOR THE RECOMMENDATION PIPELINES
// ============================================================
//
// Human-readable math notation for the exact process implemented in
// app/services/recommendation/* (search_service.py, tfidf_pipeline.py,
// sbert_pipeline.py, metadata_pipeline.py, similarity.py,
// pipeline_config.py). Shown behind a toggle for users who want to
// verify -- or audit -- what the system computes.

import {
  pipelineConfigs,
  PipelineConfig,
  PipelineWeight,
} from "./pipelineConfigs";

export interface MathBlock {
  heading: string;
  lines: string[];
}

export interface PipelineMath {
  id: string;
  label: string;
  blocks: MathBlock[];
}

// ------------------------------------------------------------
// Shared blocks
// ------------------------------------------------------------

const NOTATION: MathBlock = {
  heading: "Notation",
  lines: [
    "Q          = query text, or the seed paper's prepared text",
    "D          = { d_1, ..., d_n } = candidate papers valid for",
    "             recommendation (is_valid_for_recommendation = true)",
    "R          = final ranked list, |R| = top_k",
    "w_pipe     = (w_tfidf, w_sbert, w_meta) = pipeline weights",
  ],
};

const PREPARATION: MathBlock = {
  heading: "1. Text preparation (shared by all components)",
  lines: [
    "text(d) = normalize( Title(d) + Abstract(d) + Keywords(d) )",
    "",
    "normalize:  lowercase, strip punctuation,",
    "            collapse whitespace runs to one space",
    "",
    "text(Q) = prepared query text (free-text query)",
    "        = stored prepared text (seed-paper query)",
  ],
};

const TFIDF_COMPONENT: MathBlock = {
  heading: "2a. TF-IDF component (lexical similarity)",
  lines: [
    "Offline (index build, one-time per repository):",
    "",
    "  V          = vocabulary fitted on { text(d) : d in D }",
    "  df(t)      = number of papers in D containing term t",
    "  idf(t)     = ln( (1 + n) / (1 + df(t)) ) + 1      smoothed IDF",
    "  w(t,d)     = tf(t,d) * idf(t)                     term weight",
    "  v(d)       = w(d) / ||w(d)||_2                    L2-normalized",
    "",
    "Online (per request):",
    "",
    "  v(Q)       = same fitted vectorizer applied to text(Q)",
    "               (never refit; both vectors must live in",
    "                the same vector space)",
    "  s_tfidf(d) = cos( v(Q), v(d) )",
    "             = ( v(Q) . v(d) ) / ( ||v(Q)||_2 * ||v(d)||_2 )",
    "             = 0 if either vector is the zero vector",
  ],
};

const SBERT_COMPONENT: MathBlock = {
  heading: "2b. S-BERT component (semantic similarity)",
  lines: [
    "  e(d)      = SBERT( text(d) )  in R^384   all-MiniLM-L6-v2",
    "  e(Q)      = SBERT( text(Q) )",
    "",
    "  s_sbert(d) = cos( e(Q), e(d) )",
    "             = ( e(Q) . e(d) ) / ( ||e(Q)||_2 * ||e(d)||_2 )",
  ],
};

const METADATA_COMPONENT: MathBlock = {
  heading: "2c. Metadata component (field-level similarity)",
  lines: [
    "For each text field f in { title, abstract, keywords } :",
    "",
    "  s_f(d) = cos( TFIDF({ f(Q) }), TFIDF({ f(d) }) )",
    "           (pairwise vectorizer fitted on the two texts)",
    "         = 0  if the field is missing in Q or d",
    "",
    "Publication year (temporal proximity):",
    "",
    "  s_year(d) = 1 / ( 1 + | year(Q) - year(d) | )",
    "            = 0  if either year is missing",
    "",
    "Fixed equal signal weights (25% each):",
    "",
    "  s_meta(d) = 0.25 * s_title(d)",
    "            + 0.25 * s_abstract(d)",
    "            + 0.25 * s_keywords(d)",
    "            + 0.25 * s_year(d)",
    "",
    "  s_meta(d) is clamped to [0, 1].",
    "  Missing fields contribute 0 -- the 25% weights are kept",
    "  fixed so a paper cannot inflate its score by omission.",
  ],
};

const NORMALIZATION: MathBlock = {
  heading: "3. Score normalization (before combination)",
  lines: [
    "TF-IDF and S-BERT raw scores are min-max normalized",
    "across all candidates:",
    "",
    "  s'(d) = ( s(d) - min_s ) / ( max_s - min_s )",
    "        = 1.0 for every d   if max_s = min_s   (degenerate)",
    "",
    "Metadata scores are already in [0, 1] by construction:",
    "",
    "  s'_meta(d) = s_meta(d)          (no normalization)",
  ],
};

const RANKING: MathBlock = {
  heading: "5. Ranking and output",
  lines: [
    "Sort candidates by S(d) descending.",
    "Tie-break:   newer publication year first,",
    "             then title alphabetically.",
    "Return the top_k papers with S(d) > 0.",
    "",
    "  R = [ d in D : S(d) > 0 ],  |R| = top_k",
  ],
};

// ------------------------------------------------------------
// Pipeline-specific combination block
// ------------------------------------------------------------

function buildCombinationBlock(
  weights: PipelineWeight[]
): MathBlock {
  const w = (name: string) =>
    weights.find((item) => item.name === name)?.pct ?? 0;

  const tfidfW = w("TF-IDF") / 100;
  const sbertW = w("S-BERT") / 100;
  const metaW = w("Metadata") / 100;

  const terms: string[] = [];

  if (tfidfW > 0) {
    terms.push(`${tfidfW.toFixed(3)} * s'_tfidf(d)`);
  }

  if (sbertW > 0) {
    terms.push(`${sbertW.toFixed(3)} * s'_sbert(d)`);
  }

  if (metaW > 0) {
    terms.push(`${metaW.toFixed(3)} * s'_meta(d)`);
  }

  const formula = terms
    .map((term, index) =>
      index === 0 ? term : `      + ${term}`
    )
    .join("\n");

  return {
    heading: "4. Weighted combination",
    lines: [
      "Components with zero weight are not computed at all",
      "(the engine skips them for speed).",
      "",
      "  S(d) = " + formula,
      "",
      `  w_pipe = ( ${tfidfW.toFixed(3)}, ${sbertW.toFixed(3)}, ${metaW.toFixed(3)} )`,
      `           ( tfidf, sbert, meta )`,
    ],
  };
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------

export function getPipelineMath(
  pipelineId: string,
  override?: PipelineConfig
): PipelineMath {
  // `override` carries the custom (dial) allocation, which has no
  // entry in the preset list.
  const config =
    override ??
    pipelineConfigs.find((item) => item.id === pipelineId) ??
    pipelineConfigs[0];

  const weights = config.weights;

  const blocks: MathBlock[] = [
    NOTATION,
    PREPARATION,
  ];

  const has = (name: string) =>
    weights.some((item) => item.name === name && item.pct > 0);

  if (has("TF-IDF")) {
    blocks.push(TFIDF_COMPONENT);
  }

  if (has("S-BERT")) {
    blocks.push(SBERT_COMPONENT);
  }

  if (has("Metadata")) {
    blocks.push(METADATA_COMPONENT);
  }

  blocks.push(
    NORMALIZATION,
    buildCombinationBlock(weights),
    RANKING,
  );

  return {
    id: config.id,
    label: config.label,
    blocks,
  };
}