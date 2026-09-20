export interface PipelineWeight {
  name: string;
  pct: number;
  colorClass: string; // Tailwind bg-* class for the weight bar segment
}

export interface PipelineConfig {
  id: string;
  label: string;
  subtitle: string;
  weights: PipelineWeight[];
}

// The six configurations from Chapter 3 (§3.6).
export const pipelineConfigs: PipelineConfig[] = [
  {
    id: "tfidf",
    label: "TF-IDF",
    subtitle: "Lexical only",
    weights: [{ name: "TF-IDF", pct: 100, colorClass: "bg-tfidf" }],
  },
  {
    id: "sbert",
    label: "S-BERT",
    subtitle: "Semantic only",
    weights: [{ name: "S-BERT", pct: 100, colorClass: "bg-sbert" }],
  },
  {
    id: "tfidf-sbert",
    label: "TF-IDF + S-BERT",
    subtitle: "Lexical + Semantic",
    weights: [
      { name: "TF-IDF", pct: 50, colorClass: "bg-tfidf" },
      { name: "S-BERT", pct: 50, colorClass: "bg-sbert" },
    ],
  },
  {
    id: "tfidf-meta",
    label: "TF-IDF + Metadata",
    subtitle: "Lexical + Metadata",
    weights: [
      { name: "TF-IDF", pct: 67, colorClass: "bg-tfidf" },
      { name: "Meta", pct: 33, colorClass: "bg-meta" },
    ],
  },
  {
    id: "sbert-meta",
    label: "S-BERT + Metadata",
    subtitle: "Semantic + Metadata",
    weights: [
      { name: "S-BERT", pct: 67, colorClass: "bg-sbert" },
      { name: "Meta", pct: 33, colorClass: "bg-meta" },
    ],
  },
  {
    id: "full-hybrid",
    label: "TF-IDF + S-BERT + Metadata",
    subtitle: "Full Hybrid",
    weights: [
      { name: "TF-IDF", pct: 40, colorClass: "bg-tfidf" },
      { name: "S-BERT", pct: 40, colorClass: "bg-sbert" },
      { name: "Meta", pct: 20, colorClass: "bg-meta" },
    ],
  },
];
