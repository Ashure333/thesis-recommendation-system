export interface PipelineWeight {
  name: string;
  pct: number;
  colorClass: string;
}

export interface PipelineConfig {
  id: string;
  label: string;
  codename: string;
  subtitle: string;
  weights: PipelineWeight[];
}

export const pipelineConfigs: PipelineConfig[] = [
  {
    id: "tfidf",
    label: "TF-IDF",
    codename: "PIXEL PUNCH",
    subtitle: "Lexical only",
    weights: [
      {
        name: "TF-IDF",
        pct: 100,
        colorClass: "bg-tfidf",
      },
    ],
  },

  {
    id: "sbert",
    label: "S-BERT",
    codename: "GHOST WIRE",
    subtitle: "Semantic only",
    weights: [
      {
        name: "S-BERT",
        pct: 100,
        colorClass: "bg-sbert",
      },
    ],
  },

  {
    id: "tfidf_sbert",
    label: "TF-IDF + S-BERT",
    codename: "DUO MODE",
    subtitle: "Lexical + Semantic",
    weights: [
      {
        name: "TF-IDF",
        pct: 50,
        colorClass: "bg-tfidf",
      },
      {
        name: "S-BERT",
        pct: 50,
        colorClass: "bg-sbert",
      },
    ],
  },

  {
    id: "tfidf_metadata",
    label: "TF-IDF + Metadata",
    codename: "TRIVIA QUEST",
    subtitle: "Lexical + Metadata",
    weights: [
      {
        name: "TF-IDF",
        pct: 66.7,
        colorClass: "bg-tfidf",
      },
      {
        name: "Metadata",
        pct: 33.3,
        colorClass: "bg-meta",
      },
    ],
  },

  {
    id: "sbert_metadata",
    label: "S-BERT + Metadata",
    codename: "ARCHIVE MAGE",
    subtitle: "Semantic + Metadata",
    weights: [
      {
        name: "S-BERT",
        pct: 66.7,
        colorClass: "bg-sbert",
      },
      {
        name: "Metadata",
        pct: 33.3,
        colorClass: "bg-meta",
      },
    ],
  },

  {
    id: "tfidf_sbert_metadata",
    label: "TF-IDF + S-BERT + Metadata",
    codename: "FINAL BOSS",
    subtitle: "Lexical + Semantic + Metadata",
    weights: [
      {
        name: "TF-IDF",
        pct: 40,
        colorClass: "bg-tfidf",
      },
      {
        name: "S-BERT",
        pct: 40,
        colorClass: "bg-sbert",
      },
      {
        name: "Metadata",
        pct: 20,
        colorClass: "bg-meta",
      },
    ],
  },
];
/* ============================================================
   CUSTOM (DIAL) ALLOCATION
   ============================================================ */

/** Raw dial positions, 0..100 per signal. Auto-normalized. */
export interface DialAllocation {
  tfidf: number;
  sbert: number;
  metadata: number;
}

export const DEFAULT_DIAL_ALLOCATION: DialAllocation = {
  tfidf: 40,
  sbert: 40,
  metadata: 20,
};

/**
 * Shares that sum to 100 (one decimal). Mirrors the backend's
 * pipeline_config.build_custom_weights — same formula, display
 * rounding only. All-zero dials fall back to an equal split.
 */
export function normalizeDialAllocation(allocation: DialAllocation): {
  tfidf: number;
  sbert: number;
  metadata: number;
} {
  const total =
    allocation.tfidf + allocation.sbert + allocation.metadata;

  if (total <= 0) {
    return { tfidf: 33.3, sbert: 33.3, metadata: 33.4 };
  }

  const share = (value: number) =>
    Math.round((value / total) * 1000) / 10;

  return {
    tfidf: share(allocation.tfidf),
    sbert: share(allocation.sbert),
    metadata: share(allocation.metadata),
  };
}

/**
 * A synthetic PipelineConfig for the "custom" pipeline so every
 * consumer that expects a config (chips, WeightBar, pipeline math)
 * keeps working when the dials are active.
 */
export function customPipelineConfig(
  allocation: DialAllocation,
): PipelineConfig {
  const shares = normalizeDialAllocation(allocation);

  return {
    id: "custom",
    label: "Custom mix",
    codename: "CUSTOM MIX",
    subtitle: "Dial allocation",
    weights: [
      { name: "TF-IDF", pct: shares.tfidf, colorClass: "bg-tfidf" },
      { name: "S-BERT", pct: shares.sbert, colorClass: "bg-sbert" },
      { name: "Metadata", pct: shares.metadata, colorClass: "bg-meta" },
    ].filter((weight) => weight.pct > 0),
  };
}
