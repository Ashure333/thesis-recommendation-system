import { isPresentationStored } from "../utils/presentation";

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

const OTHER_DIALS: Record<keyof DialAllocation, [keyof DialAllocation, keyof DialAllocation]> = {
  tfidf: ["sbert", "metadata"],
  sbert: ["tfidf", "metadata"],
  metadata: ["tfidf", "sbert"],
};

/**
 * Move one dial and rebalance the other two so the three positions
 * always sum to 100. The remainder is split in proportion to the
 * other dials' current positions (equal split when both are 0), and
 * integer rounding drift is absorbed by the larger of the two, so
 * the dial positions, the displayed percentages, and the weights the
 * backend receives are the same numbers.
 */
export function adjustDialAllocation(
  allocation: DialAllocation,
  key: keyof DialAllocation,
  next: number,
): DialAllocation {
  const value = Math.max(0, Math.min(100, Math.round(next)));
  const [firstKey, secondKey] = OTHER_DIALS[key];
  const remaining = 100 - value;

  const first = allocation[firstKey];
  const second = allocation[secondKey];
  const othersTotal = first + second;

  let nextFirst: number;
  let nextSecond: number;

  if (othersTotal <= 0) {
    nextFirst = Math.ceil(remaining / 2);
    nextSecond = remaining - nextFirst;
  } else {
    nextFirst = Math.round((first / othersTotal) * remaining);
    nextSecond = Math.round((second / othersTotal) * remaining);

    const drift = remaining - (nextFirst + nextSecond);

    if (drift !== 0) {
      if (nextFirst >= nextSecond) {
        nextFirst = Math.max(0, nextFirst + drift);
      } else {
        nextSecond = Math.max(0, nextSecond + drift);
      }
    }
  }

  return {
    ...allocation,
    [key]: value,
    [firstKey]: nextFirst,
    [secondKey]: nextSecond,
  };
}

/**
 * Snap an arbitrary allocation (e.g. one restored from localStorage
 * written before the dials were linked) to integer positions that
 * sum to 100. Falls back to an equal split when everything is 0.
 */
export function normalizeDialPositions(
  allocation: DialAllocation,
): DialAllocation {
  const total =
    allocation.tfidf + allocation.sbert + allocation.metadata;

  if (total <= 0) {
    return { tfidf: 33, sbert: 33, metadata: 34 };
  }

  const tfidf = Math.round((allocation.tfidf / total) * 100);
  const sbert = Math.round((allocation.sbert / total) * 100);
  const metadata = 100 - tfidf - sbert;

  return {
    tfidf,
    sbert,
    metadata: metadata < 0 ? 0 : metadata,
  };
}

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

/**
 * What to call a pipeline on screen: the arcade codename in the app, the
 * formal name (TF-IDF, S-BERT + Metadata, ...) in the shipped Presentation.
 */
export function pipelineName(config: Pick<PipelineConfig, "label" | "codename">): string {
  return isPresentationStored() ? config.label : config.codename;
}
