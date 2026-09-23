export interface PipelineWeight {
  name: string;
  pct: number;
  colorClass: string;
}

export interface PipelineConfig {
  id: string;
  label: string;
  subtitle: string;
  weights: PipelineWeight[];
}

export const pipelineConfigs: PipelineConfig[] = [
  {
    id: "tfidf",
    label: "TF-IDF",
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
    subtitle: "Lexical + Metadata",
    weights: [
      {
        name: "TF-IDF",
        pct: 67,
        colorClass: "bg-tfidf",
      },
      {
        name: "Metadata",
        pct: 33,
        colorClass: "bg-meta",
      },
    ],
  },

  {
    id: "sbert_metadata",
    label: "S-BERT + Metadata",
    subtitle: "Semantic + Metadata",
    weights: [
      {
        name: "S-BERT",
        pct: 67,
        colorClass: "bg-sbert",
      },
      {
        name: "Metadata",
        pct: 33,
        colorClass: "bg-meta",
      },
    ],
  },

  {
    id: "tfidf_sbert_metadata",
    label: "TF-IDF + S-BERT + Metadata",
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