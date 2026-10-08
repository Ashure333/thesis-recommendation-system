/* ============================================================
   TIP STORE
   The tamagotchi guide's knowledge base. Each tip is keyed by
   the `data-tips` attribute of the UI element it explains:

     <section data-tips="repo-filters"> …

   A tip fires when the user hovers its element for 2.5 seconds.
   Seen tips are persisted in localStorage by the Tamagotchi
   component (key: paperrec_tips_seen).
   ============================================================ */

export interface Tip {
  /** Matches the element's data-tips attribute. */
  id: string;
  /** Short bold headline shown in the bubble header. */
  title: string;
  /** The tip itself, 1–3 sentences. */
  body: string;
}

export const TIPS: Tip[] = [
  /* ---------- Auth ---------- */

  {
    id: "login-card",
    title: "Demo sign-in",
    body: "This is a demo login; any email and password will get you in. Nothing is sent to a server; your session is only remembered in this browser.",
  },

  /* ---------- Top navigation ---------- */

  {
    id: "nav-search",
    title: "Search",
    body: "Start a recommendation query here: search by keywords, by an exact title, or pick a paper from the repository to use as a seed document.",
  },
  {
    id: "nav-repository",
    title: "Repository",
    body: "The merged browse-and-search screen: filter console on the left, document table in the middle, details inspector on the right. Filters (subject, category, document type, year range, authors) apply as you change them, and you can drop a PDF or citation file onto the table to import it.",
  },
  {
    id: "nav-recommendations",
    title: "Recommend",
    body: "The Recommend scope in the Repository's filter console: the selected pipeline ranks repository papers against your query. Tune Top-K and Diversify (MMR) right next to the query box.",
  },
  {
    id: "nav-upload",
    title: "Upload",
    body: "Add new papers. Upload a PDF or a BibTeX (.bib) file; metadata is extracted automatically and stays editable until you confirm the save.",
  },
  {
    id: "nav-library",
    title: "My Library",
    body: "Your personal shortlist. Save papers from the Repository to keep them one click away — and once any garden tree grows past its Young stage, the same page offers a PRO mode: a research collection with a dashboard, a similar-papers graph, and a (placeholder) chat.",
  },
  {
    id: "nav-evaluation",
    title: "Arena",
    body: "The study's comparative view: run all six pipelines on one query or seed paper and watch them compete: consensus ranking, pairwise agreement, and the independence-weighted winner.",
  },
  {
    id: "nav-lab",
    title: "Lab",
    body: "The recipe workshop: mix TF-IDF, S-BERT, and metadata percentages into your own algorithm recipe, simulate a battle against the six presets, and climb the leaderboard.",
  },
  {
    id: "nav-walkthrough",
    title: "Walkthrough",
    body: "An encyclopedia-style manual for the whole system: every page, the six pipelines, the similar-papers graph, the Arena, and the pixel pet, laid out like a game walkthrough.",
  },
  {
    id: "nav-engine",
    title: "Engine",
    body: "The mathematics and computer science behind Re:Search: the vector space model, S-BERT embeddings, metadata fusion, the similar-papers graph, and the Arena's voting system, with a worked example.",
  },
  {
    id: "nav-changelog",
    title: "Changelog",
    body: "The recent changes to Re:Search, newest first — new features, fixes, and polish. Swap between the timeline and card layouts to read them.",
  },

  /* ---------- Header utilities ---------- */

  {
    id: "pipeline-chip",
    title: "Active algorithm",
    body: "The Algorithm bar at the top of the Repository shows the active pipeline's codename: PIXEL PUNCH (TF-IDF), GHOST WIRE (S-BERT), DUO MODE, TRIVIA QUEST, ARCHIVE MAGE, or FINAL BOSS (all three signals) — plus the custom dials. The Σ STATS switch next to it opens the live computations and interpretations.",
  },
  {
    id: "stats-toggle",
    title: "Statistics switch",
    body: "The Σ STATS switch in the top bar opens the universal statistics panel: repository totals, the live computation of the most recent search, and a plain-language explanation of every formula. The full treatment lives in the Engine tab.",
  },
  {
    id: "theme-picker",
    title: "Theme color",
    body: "Pick your accent color. The cream canvas and dark outlines stay the same; only the active fills change. Your choice is saved in this browser.",
  },

  /* ---------- Search page ---------- */

  {
    id: "search-modes",
    title: "Query modes",
    body: "Keyword matches your words across titles and abstracts; Title expects a close paper title; Seed Document recommends papers similar to an existing repository paper.",
  },
  {
    id: "weight-bar",
    title: "Pipeline weights",
    body: "This bar shows how much each signal contributes: teal = TF-IDF (lexical overlap), orange = S-BERT (semantic similarity), purple = metadata (subject, type, year). Switch to Dials to set your own mix; turning one dial rebalances the others so the three always total 100%.",
  },
  {
    id: "repo-stats",
    title: "Repository stats",
    body: "Live counts from the backend: total papers, the two largest subject categories and how many distinct categories exist.",
  },

  /* ---------- Repository page ---------- */

  {
    id: "repo-filters",
    title: "Filters",
    body: "Filters apply as you change them; no Apply button. Combine subject, category, document type and a year range, then sort the result list.",
  },
  {
    id: "repo-results",
    title: "Paper list",
    body: "Click a title to preview the full record. Save sends it to My Library; double-check the outline icon: papers with a PDF can be opened in the viewer.",
  },

  /* ---------- Upload page ---------- */

  {
    id: "upload-dropzone",
    title: "Drop zone",
    body: "Drag a PDF or BibTeX file anywhere on this zone. You'll review the extracted metadata before anything is saved; Cancel discards everything.",
  },

  /* ---------- Recommendations page ---------- */

  {
    id: "rec-pipelines",
    title: "Pipeline options",
    body: "Switch between the six study pipelines. The active one fills in the accent color; each card shows its TF-IDF / S-BERT / metadata weights.",
  },
  {
    id: "rec-topk",
    title: "Top-K results",
    body: "How many ranked papers to return for this query; larger K trades precision for coverage.",
  },

  /* ---------- Research assistant ---------- */

  {
    id: "research-assistant",
    title: "Research assistant",
    body: "Ask questions about the papers in your repository. Answers are grounded in your own documents; the sources used appear in the panel beside the chat.",
  },

  /* ---------- My Library ---------- */

  {
    id: "library-shortlist",
    title: "My Library",
    body: "Papers you saved from elsewhere in the app. Remove returns the list to its previous state; the full record always stays in the Repository.",
  },

  /* ---------- Full-screen library (LibraryUITest) ---------- */

  {
    id: "ui-sidebar",
    title: "Sidebar",
    body: "Jump between all papers, your saved shortlist and subject categories. Drag the right edge to resize, or use the tab to collapse it for more room.",
  },
  {
    id: "ui-search",
    title: "Instant search",
    body: "Searches titles, authors, abstracts and keywords as you type, within the selected category; matches rank by relevance with highlighted snippets and near-duplicate records collapsed. Drag a PDF straight onto the table below to import a paper.",
  },
  {
    id: "ui-detail-tabs",
    title: "Details / Abstract",
    body: "Details shows the catalog record, keywords and attachment; Abstract shows the summary text. Everything below scrolls; nothing is hidden at the bottom.",
  },
  {
    id: "ui-similar-papers",
    title: "Similar papers",
    body: "A live graph of repository papers similar to the selected one, centered on that paper. Change the pipeline to re-rank the neighborhood.",
  },
];

export const TIP_BY_ID: Record<string, Tip> = Object.fromEntries(
  TIPS.map((tip) => [tip.id, tip]),
);

/* ============================================================
   LOCKED DEEP TIPS
   The help library's advanced entries. They stay locked until
   every scavenger-hunt treasure is found, the pet then speaks
   them through its click cycle and answers questions with them
   (see help.ts). `keywords` power the chat matcher.
   ============================================================ */

export interface DeepTip extends Tip {
  /** Chat-search terms for answerQuestion(). */
  keywords: string[];
}

export const EXTRA_TIPS: DeepTip[] = [
  {
    id: "deep-cosine",
    title: "Cosine similarity",
    keywords: [
      "cosine",
      "similarity",
      "formula",
      "vector",
      "angle",
      "distance",
      "dot",
    ],
    body:
      "Both pipelines score a paper by the cosine of the angle between " +
      "its vector and the query vector: (A·B) / (|A||B|). Cosine ignores " +
      "vector length, so a long paper and a short query still match if " +
      "they use the same words or mean the same thing. Scores land in " +
      "[0, 1] because TF-IDF vectors are never negative.",
  },
  {
    id: "deep-tfidf",
    title: "TF-IDF, deep",
    keywords: [
      "tfidf",
      "tf idf",
      "term",
      "frequency",
      "inverse",
      "document",
      "lexical",
      "vocabulary",
    ],
    body:
      "TF-IDF weights each word by how often it appears in the paper " +
      "(term frequency) divided by how rare it is across the whole " +
      "repository (inverse document frequency). Words like 'the' sink; " +
      "distinctive terms like 'gradient' surface. Every paper's prepared " +
      "text becomes one sparse vector, and the same fitted vectorizer is " +
      "reused for queries so both live in one vector space.",
  },
  {
    id: "deep-sbert",
    title: "S-BERT, deep",
    keywords: [
      "sbert",
      "s bert",
      "sentence",
      "bert",
      "embedding",
      "semantic",
      "minilm",
      "transformer",
    ],
    body:
      "S-BERT (all-MiniLM-L6-v2) maps a paper's prepared text into a " +
      "384-dimension semantic embedding: words with similar meaning, " +
      "not just spelling, end up near each other. It needs no fitting " +
      "step; the pretrained model encodes any text into the same " +
      "space; so 'neural networks' and 'deep learning' can match even " +
      "with zero shared vocabulary.",
  },
  {
    id: "deep-metadata",
    title: "Metadata component",
    keywords: [
      "metadata",
      "title",
      "abstract",
      "keyword",
      "year",
      "publication",
      "signal",
    ],
    body:
      "The metadata component blends four signals at 25% each: Title, " +
      "Abstract, Keywords (each a small cosine comparison) and " +
      "Publication Year via 1 / (1 + |Δyear|), so a paper from the same " +
      "year scores 1.0 and each year apart halves the gap. Missing " +
      "fields contribute 0; a paper cannot be inflated just because " +
      "its neighbors are missing data.",
  },
  {
    id: "deep-hybrid",
    title: "Hybrid scoring",
    keywords: [
      "hybrid",
      "weight",
      "combination",
      "normalize",
      "min max",
      "normalization",
      "blend",
      "fusion",
      "learned",
      "tuned",
    ],
    body:
      "Hybrid configurations first min-max normalize each component's " +
      "raw scores into [0, 1], an order-preserving rescale, so it " +
      "never changes the ranking; then take a weighted average: " +
      "S(d) = Σ w·score(d). The six study pipelines are every " +
      "combination of the TF-IDF, S-BERT and metadata signals with " +
      "weights summing to 1. Offline, a deterministic learner can " +
      "search the weight simplex against a relevance file; the " +
      "learned mix stays a research instrument rather than replacing " +
      "the fixed study presets.",
  },
  {
    id: "deep-eval",
    title: "Arena metrics",
    keywords: [
      "evaluation",
      "metric",
      "consensus",
      "pairwise",
      "agreement",
      "rank",
      "winner",
      "battle",
      "score",
    ],
    body:
      "The Arena page measures pipelines against each other: " +
      "consensus (how many pipelines ranked a paper; the more, the " +
      "stronger the signal), pairwise overlap and mean rank gap " +
      "(lower gap = more agreement), and a winner crowned by " +
      "independence-weighted consensus so a pipeline cannot be " +
      "confirmed by its own hybrids.",
  },
  {
    id: "deep-import",
    title: "Import flows",
    keywords: [
      "import",
      "upload",
      "pdf",
      "bibtex",
      "bib",
      "latex",
      "identifier",
      "doi",
      "arxiv",
      "dropzone",
    ],
    body:
      "References arrive four ways: a PDF (metadata extracted " +
      "locally), a BibTeX .bib or LaTeX .tex export (parsed entry by " +
      "entry), an identifier lookup (DOI or arXiv link, filled from " +
      "Crossref/arXiv), or a fully manual entry. Nothing is saved " +
      "until you approve the preview; missing fields are flagged " +
      "before the paper can join the recommendation corpus.",
  },
  {
    id: "deep-themes",
    title: "Themes & dark mode",
    keywords: [
      "theme",
      "dark",
      "light",
      "accent",
      "color",
      "palette",
      "mode",
    ],
    body:
      "Every theme owns a full palette, not just a color: canvas, " +
      "surfaces, hairlines, ink and the neutral ramp all shift with " +
      "the accent you pick in the nav. Dark mode derives each theme's " +
      "dark palette from its accent hue and reverses the neutral " +
      "ramp, so the 3px outlines and slab shadows invert to " +
      "light-on-dark without a single per-component edit.",
  },
  {
    id: "deep-graph",
    title: "Connected papers graph",
    keywords: [
      "graph",
      "connected",
      "similar",
      "network",
      "node",
      "neighborhood",
      "visual",
      "citation",
      "citations",
      "reference",
      "references",
      "co citation",
      "coupling",
    ],
    body:
      "The similar-papers graph renders a paper at the center and " +
      "ranks its neighborhood under the active pipeline; click any " +
      "rank badge to re-center the graph on that paper. Small dots " +
      "are further connections the layout did not fully expand. " +
      "Edges also carry cached OpenAlex citation links, and shared " +
      "references or citers surface as common-reference and " +
      "common-citer groups.",
  },
  {
    id: "deep-battle",
    title: "Pipeline battle & records",
    keywords: [
      "battle",
      "records",
      "tally",
      "history",
      "winner",
      "streak",
      "champion",
      "run",
    ],
    body:
      "Every battle run is logged: the Win tally tab counts each " +
      "pipeline's wins and crowns a champion (with a streak counter " +
      "if one dominates), and the Battle history tab lists the last " +
      "20 runs with query, winner and score. Together they show " +
      "whether one configuration consistently beats the others.",
  },
  {
    id: "deep-pet",
    title: "The pet & the hunt",
    keywords: [
      "pet",
      "tips",
      "treasure",
      "hunt",
      "chat",
      "library",
      "scavenger",
      "unlock",
    ],
    body:
      "I started as a tip guide: hover anything for 2.5 seconds and " +
      "I explain it, or click me to replay what you have found. Find " +
      "all six hidden treasures and I become a full help library; " +
      "the deep tips unlock and you can ask me questions directly.",
  },
];

