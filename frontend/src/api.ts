import type { CitationStyle } from "./utils/preferences";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Paper {
  id: number;
  title: string;
  author: string | null;
  abstract: string | null;
  keywords: string | null;
  publication_year: number | null;
  doi: string | null;
  subject_category: string | null;
  document_type: string | null;
  citation_count: number | null;
  is_valid_for_recommendation: boolean;
  missing_fields: string | null;
  source_filename: string | null;
  extraction_method: string | null;
  stored_path: string | null;
  created_at: string;
  /** Present only for BM25-ranked repository searches. */
  snippet?: string | null;
  /** Near-duplicate records hidden from a relevance result list. */
  duplicate_count?: number;
}

export interface LibraryEntry {
  paper: Paper;
  saved_at: string;
}

/** The weighted contributions behind a recommendation score. */
export interface SearchResultComponents {
  tfidf: number;
  sbert: number;
  metadata: number;
}

export interface SearchResult {
  paper: Paper;
  score: number;
  /**
   * Weighted per-component contributions behind `score`; the three
   * values sum to `score` (within rounding). Absent/null for
   * responses that do not compute a breakdown.
   */
  components?: SearchResultComponents | null;
}

export interface PdfCandidate {
  url: string;
  source: string; // "unpaywall" | "semantic_scholar" | "arxiv"
  title: string | null;
  confidence: number;
  landing_page_url: string | null;
  license: string | null;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;

    // FastAPI sends validation problems as a list of {msg, loc}.
    const message = Array.isArray(detail)
      ? detail
          .map((item: { msg?: string }) => item?.msg)
          .filter(Boolean)
          .join("; ")
      : detail;

    throw new Error(
      message || `Request failed (${res.status})`
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export interface PaperFilters {
  search?: string;
  subject?: string;
  category?: string;
  document_type?: string;
  min_year?: number;
  max_year?: number;
  sort_by?: string;
  limit?: number;
}

export function listPapers(
  filters: PaperFilters = {}
): Promise<Paper[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  return fetch(
    `${API_URL}/api/papers?${params.toString()}`
  ).then(handle<Paper[]>);
}

// ============================================================
// CATALOG (backend-owned taxonomy, auto-grows with new papers)

export interface RepositoryStats {
  total_papers: number;
  by_subject: Record<string, number>;
  category_count: number;
}

export function getRepositoryStats(): Promise<RepositoryStats> {
  return fetch(`${API_URL}/api/papers/stats`).then(handle<RepositoryStats>);
}

export interface Catalog {
  subjects: string[];
  categories: string[];
  document_types: string[];
  /**
   * Categories that co-occur with each subject in the imported
   * references, keyed by subject. Drives the Upload form's
   * auto-suggested category list for the selected subject.
   */
  subject_categories: Record<string, string[]>;
}

export function getCatalog(): Promise<Catalog> {
  return fetch(`${API_URL}/api/catalog`).then(
    handle<Catalog>
  );
}

export function getPaper(id: number): Promise<Paper> {
  return fetch(`${API_URL}/api/papers/${id}`).then(
    handle<Paper>
  );
}

// ============================================================
// BACKGROUND ENRICHMENT STATUS
//
// After a save, the backend fills in missing metadata and attaches
// found PDFs on a background queue. Poll this to know when to
// refresh the paper.
// ============================================================

// ============================================================
// RESEARCH CHAT (repository / collection / web grounded)
// ============================================================

export type ResearchChatScope = "repo" | "library" | "web";

export interface ResearchChatSource {
  kind: "repo" | "web";
  paper_id: number | null;
  title: string;
  author: string | null;
  year: number | null;
  score: number;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  document_type: string | null;
}

export interface ResearchChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ResearchChatResponse {
  answer: string;
  sources: ResearchChatSource[];
  used_fallback: boolean;
}

/** Ask the research assistant; retrieval is grounded in the
 *  repository, a saved collection, or the open web. */
export function researchChat(params: {
  message: string;
  pipeline?: "tfidf" | "sbert";
  topK?: number;
  scope?: ResearchChatScope;
  paperIds?: number[];
  history?: ResearchChatHistoryItem[];
  /** Settings > citation style: the answer's in-text citations and
   *  reference list follow it. Omitted = bracket numbers. */
  citationStyle?: CitationStyle;
  includeDoi?: boolean;
}): Promise<ResearchChatResponse> {
  return fetch(`${API_URL}/api/research-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      pipeline: params.pipeline ?? "sbert",
      top_k: params.topK ?? 6,
      scope: params.scope ?? "repo",
      paper_ids: params.paperIds ?? [],
      history: params.history ?? [],
      citation_style: params.citationStyle ?? null,
      include_doi: params.includeDoi ?? true,
    }),
  }).then(handle<ResearchChatResponse>);
}

export interface ResearchChatSuggestions {
  suggestions: string[];
  /** True when the model was unavailable and templates were used. */
  used_fallback: boolean;
}

/** Follow-up questions for the chat's suggestion pills, from the
 *  latest question, its answer and the sources it used. */
export function researchChatSuggestions(params: {
  question: string;
  answer: string;
  sourceTitles?: string[];
  count?: number;
}): Promise<ResearchChatSuggestions> {
  return fetch(`${API_URL}/api/research-chat/suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question: params.question,
      answer: params.answer,
      source_titles: params.sourceTitles ?? [],
      count: params.count ?? 3,
    }),
  }).then(handle<ResearchChatSuggestions>);
}

export type EnrichmentStatus =
  | "idle"
  | "queued"
  | "running"
  | "done"
  | "failed";

export function getEnrichmentStatus(
  paperId: number
): Promise<{ paper_id: number; status: EnrichmentStatus }> {
  return fetch(
    `${API_URL}/api/papers/${paperId}/enrichment-status`
  ).then(handle<{ paper_id: number; status: EnrichmentStatus }>);
}

export function getPaperPdfUrl(paperId: number): string {
  return `${API_URL}/api/papers/${paperId}/pdf`;
}

export function updatePaper(
  id: number,
  updates: Partial<Paper>
): Promise<Paper> {
  return fetch(`${API_URL}/api/papers/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  }).then(handle<Paper>);
}

/** What the Upload form reviews: the fields saved with a paper. */
export interface ReviewedFields {
  title: string;
  abstract: string;
  keywords: string;
  publication_year: number | null;
  author: string | null;
  doi: string | null;
  subject_category: string | null;
  document_type: string | null;
  citation_count: number | null;
}

/**
 * Import a file. The reviewed fields travel with it, so the paper is
 * saved once, already corrected (no second request that can fail and
 * leave a half-edited record). A form post cannot tell "left out" from
 * "left blank", so emptied fields are listed in `cleared`.
 */
export function uploadPaper(
  file: File,
  fields?: ReviewedFields
): Promise<Paper> {
  const formData = new FormData();
  formData.append("file", file);

  if (fields) {
    const cleared: string[] = [];

    for (const [name, value] of Object.entries(fields)) {
      if (value === null || value === "") {
        cleared.push(name);
      } else {
        formData.append(name, String(value));
      }
    }

    if (cleared.length > 0) {
      formData.append("cleared", cleared.join(","));
    }
  }

  return fetch(`${API_URL}/api/papers/upload`, {
    method: "POST",
    body: formData,
  }).then(handle<Paper>);
}

/** Read a file's metadata without saving anything. */
export function previewPaperFile(file: File): Promise<PaperPreviewData> {
  const formData = new FormData();
  formData.append("file", file);

  return fetch(`${API_URL}/api/papers/preview`, {
    method: "POST",
    body: formData,
  }).then(handle<PaperPreviewData>);
}

// ============================================================
// ADD BY IDENTIFIER (DOI / arXiv / link)
// ============================================================

/** The preview payload shared by file and identifier lookups. */
export interface PaperPreviewData {
  title: string;
  author: string | null;
  abstract: string | null;
  keywords: string | null;
  publication_year: number | null;
  doi: string | null;
  subject_category: string | null;
  document_type: string | null;
  citation_count: number | null;
  is_valid_for_recommendation: boolean;
  missing_fields: string | null;
  source_filename: string | null;
  extraction_method: string | null;
  /** The stored paper this one would be rejected as a copy of. */
  duplicate_of?: { id: number; title: string | null } | null;
  pdf_candidates?: Array<{
    url: string;
    source: string;
    title: string | null;
    confidence: number;
    landing_page_url: string | null;
    license: string | null;
  }>;
}

/**
 * Resolve a pasted DOI, arXiv id, or link to either -- nothing is
 * persisted; the result is a preview for review before saving.
 */
export function previewIdentifier(
  identifier: string
): Promise<PaperPreviewData> {
  return fetch(`${API_URL}/api/papers/preview-identifier`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier }),
  }).then(handle<PaperPreviewData>);
}

// ============================================================
// GOOGLE SCHOLAR EXPORT LINKS (BibTeX / EndNote / RefMan)
// ============================================================

export interface ScholarCitation {
  format: "bib" | "enw" | "ris";
  text: string;
  url: string;
}

/**
 * Fetch a Google Scholar export link server-side (the browser
 * cannot fetch scholar.google.com directly). Nothing is persisted:
 * `format` + `text` feed the normal preview → review → save flow.
 */
export function fetchScholarCitation(
  url: string
): Promise<ScholarCitation> {
  return fetch(`${API_URL}/api/papers/scholar-fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  }).then(handle<ScholarCitation>);
}

export interface MetadataImportInput {
  title: string;
  author?: string | null;
  abstract?: string | null;
  keywords?: string | null;
  publication_year?: number | null;
  doi?: string | null;
  subject_category?: string | null;
  document_type?: string | null;
  citation_count?: number | null;
  source_filename?: string | null;
  pdf_url?: string | null;
}

/**
 * Create a paper directly from reviewed metadata (no source file) --
 * the save step of the identifier flow.
 */
export function importPaperFromMetadata(
  input: MetadataImportInput
): Promise<Paper> {
  return fetch(`${API_URL}/api/papers/import-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  }).then(handle<Paper>);
}

// ============================================================
// WEB SEARCH (OpenAlex + Crossref)
// ============================================================

export interface WebSearchResult {
  title: string;
  author: string | null;
  abstract: string | null;
  publication_year: number | null;
  doi: string | null;
  venue: string | null;
  /** Which legitimate API answered: "openalex" | "crossref". */
  source: string;
  citations: number | null;
  /** null = unknown (Crossref has no reliable OA flag). */
  is_oa: boolean | null;
  landing_url: string | null;
  document_type: string | null;
  /** Direct full-text link (arXiv results carry one). */
  pdf_url?: string | null;
  /** Set when the hit was ranked by a recommendation pipeline. */
  rank?: number;
  /** The pipeline's final score for this hit (0..1). */
  score?: number;
  /** The component scores behind `score`. */
  components?: { tfidf: number; sbert: number; metadata: number };
}

export interface WebSearchParams {
  q: string;
  year_min?: number | null;
  year_max?: number | null;
  peer_reviewed?: boolean;
  open_access?: boolean;
  /** Comma-joined: "openalex,crossref". */
  sources?: string;
  sort?: "relevance" | "citations" | "year";
  limit?: number;
  /** Aborts the request when a newer search supersedes this one. */
  signal?: AbortSignal;
}

/**
 * Legitimate web search across OpenAlex + Crossref. Peer-reviewed
 * types only unless peer_reviewed is explicitly turned off.
 */
export function searchWeb(
  params: WebSearchParams
): Promise<WebSearchResult[]> {
  const query = new URLSearchParams({ q: params.q });

  if (params.year_min != null) query.set("year_min", String(params.year_min));
  if (params.year_max != null) query.set("year_max", String(params.year_max));
  query.set("peer_reviewed", String(params.peer_reviewed ?? true));
  query.set("open_access", String(params.open_access ?? false));
  if (params.sources) query.set("sources", params.sources);
  query.set("sort", params.sort ?? "relevance");
  if (params.limit) query.set("limit", String(params.limit));

  return fetch(`${API_URL}/api/search-web?${query.toString()}`, {
    signal: params.signal,
  }).then(handle<WebSearchResult[]>);
}

export interface WebRecommendationParams {
  q: string;
  pipeline: string;
  topK?: number;
  year_min?: number | null;
  year_max?: number | null;
  peer_reviewed?: boolean;
  open_access?: boolean;
  sources?: string;
  /** Dial allocation for pipeline="custom" (0..100 per signal). */
  weights?: DialWeights;
  signal?: AbortSignal;
}

/**
 * Recommend from the open web: live OpenAlex / Crossref / arXiv hits
 * ranked by ONE pipeline (or the custom dials), each row carrying its
 * rank, score and component scores.
 */
export function getWebRecommendations(
  params: WebRecommendationParams
): Promise<WebSearchResult[]> {
  const query = new URLSearchParams({
    q: params.q,
    pipeline: params.pipeline,
  });

  if (params.topK !== undefined) query.set("top_k", String(params.topK));
  if (params.year_min != null) query.set("year_min", String(params.year_min));
  if (params.year_max != null) query.set("year_max", String(params.year_max));
  query.set("peer_reviewed", String(params.peer_reviewed ?? true));
  query.set("open_access", String(params.open_access ?? false));
  if (params.sources) query.set("sources", params.sources);

  if (params.weights) {
    query.set("w_tfidf", String(params.weights.tfidf));
    query.set("w_sbert", String(params.weights.sbert));
    query.set("w_metadata", String(params.weights.metadata));
  }

  return fetch(
    `${API_URL}/api/recommendations/web?${query.toString()}`,
    { signal: params.signal }
  ).then(handle<WebSearchResult[]>);
}

export function getLibrary(): Promise<LibraryEntry[]> {
  return fetch(`${API_URL}/api/library`).then(
    handle<LibraryEntry[]>
  );
}

/** Lets the nav badge refresh whenever the library changes. */
function notifyLibraryChanged() {
  window.dispatchEvent(new Event("library-changed"));
}

export function saveToLibrary(
  paperId: number
): Promise<{ status: string }> {
  return fetch(`${API_URL}/api/library/${paperId}`, {
    method: "POST",
  })
    .then(handle<{ status: string }>)
    .then((result) => {
      notifyLibraryChanged();
      return result;
    });
}

export interface AssignKeywordsResult {
  checked: number;
  updated: number;
  paper_ids: number[];
}

/**
 * Automatic keyword assigner: fills in YAKE keywords for every
 * library paper that has none. Called by the My Library page on
 * load; local and best-effort.
 */
export function assignLibraryKeywords(): Promise<AssignKeywordsResult> {
  return fetch(`${API_URL}/api/library/assign-keywords`, {
    method: "POST",
  }).then(handle<AssignKeywordsResult>);
}

export function removeFromLibrary(
  paperId: number
): Promise<void> {
  return fetch(`${API_URL}/api/library/${paperId}`, {
    method: "DELETE",
  })
    .then(handle<void>)
    .then((result) => {
      notifyLibraryChanged();
      return result;
    });
}

export function deletePaper(
  paperId: number
): Promise<void> {
  return fetch(`${API_URL}/api/papers/${paperId}`, {
    method: "DELETE",
  }).then(handle<void>);
}

/** Removes only the stored PDF; the paper record stays intact. */
export function deletePaperPdf(paperId: number): Promise<Paper> {
  return fetch(`${API_URL}/api/papers/${paperId}/pdf`, {
    method: "DELETE",
  }).then(handle<Paper>);
}

export interface DialWeights {
  tfidf: number;
  sbert: number;
  metadata: number;
}

export interface RecommendationParams {
  pipeline: string;
  query?: string;
  seedPaperId?: number;
  topK?: number;
  /** Optional 1-based page over the bounded top-K result list. */
  page?: number;
  /** Optional page size; the API keeps the response as SearchResult[]. */
  pageSize?: number;
  /** Optional MMR diversification (0 = max diversity, 1 = off). */
  mmrLambda?: number;
  /** Candidate pool the MMR reranker considers (1..100). */
  mmrPool?: number;
  /** Dial allocation for pipeline="custom" (0..100 per signal). */
  weights?: DialWeights;
}

export function getRecommendations(
  params: RecommendationParams
): Promise<SearchResult[]> {
  const search = new URLSearchParams();

  search.set("pipeline", params.pipeline);

  if (params.query) {
    search.set("query", params.query);
  }

  if (params.seedPaperId !== undefined) {
    search.set(
      "seed_paper_id",
      String(params.seedPaperId)
    );
  }

  if (params.topK !== undefined) {
    search.set(
      "top_k",
      String(params.topK)
    );
  }

  if (params.page !== undefined) {
    search.set("page", String(params.page));
  }

  if (params.pageSize !== undefined) {
    search.set("page_size", String(params.pageSize));
  }

  if (params.mmrLambda !== undefined) {
    search.set("mmr_lambda", String(params.mmrLambda));
  }

  if (params.mmrPool !== undefined) {
    search.set("mmr_pool", String(params.mmrPool));
  }

  if (params.weights) {
    search.set("w_tfidf", String(params.weights.tfidf));
    search.set("w_sbert", String(params.weights.sbert));
    search.set("w_metadata", String(params.weights.metadata));
  }

  return fetch(
    `${API_URL}/api/recommendations?${search.toString()}`
  ).then(handle<SearchResult[]>);
}

// ============================================================
// RECOMMENDATION EXECUTION TRACE
// ============================================================

export interface TraceEvent {
  event: string;
  message: string;
  data: Record<string, unknown>;
}

export interface RecommendationTrace {
  events: TraceEvent[];
  results: SearchResult[];
}

export function getRecommendationTrace(
  params: RecommendationParams
): Promise<RecommendationTrace> {
  return fetch(`${API_URL}/api/recommendations/trace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pipeline: params.pipeline,
      query: params.query ?? null,
      seed_paper_id:
        params.seedPaperId ?? null,
      top_k: params.topK ?? 10,
      ...(params.weights
        ? {
            w_tfidf: params.weights.tfidf,
            w_sbert: params.weights.sbert,
            w_metadata: params.weights.metadata,
          }
        : {}),
      mmr_lambda: params.mmrLambda ?? null,
      mmr_pool: params.mmrPool ?? 50,
    }),
  }).then(handle<RecommendationTrace>);
}

// ============================================================
// PIPELINE COMPARISON ("PIPELINE BATTLE")
// ============================================================

export interface CompareRankedPaper {
  paper_id: number;
  title: string | null;
  year: number | null;
  score: number;
}

export interface ComparePipelineBattle {
  id: string;
  results: CompareRankedPaper[];
}

export interface CompareConsensusEntry {
  paper_id: number;
  title: string | null;
  year: number | null;
  votes: number;
  avg_rank: number | null;
  best_rank: number | null;
}

export interface ComparePairwiseAgreement {
  a: string;
  b: string;
  overlap: number;
  mean_rank_gap: number | null;
}

export interface CompareWinner {
  pipeline_id: string;
  metric: "independence_weighted_consensus";
  value: number;
  avg_consensus_rank: number | null;
}

export interface CompareResponse {
  query: string | null;
  seed_paper_id: number | null;
  top_k: number;
  pipelines: ComparePipelineBattle[];
  consensus: CompareConsensusEntry[];
  pairwise: ComparePairwiseAgreement[];
  winner: CompareWinner | null;
}

export function comparePipelines(params: {
  query?: string;
  seedPaperId?: number;
  topK?: number;
  customWeights?: { tfidf: number; sbert: number; metadata: number };
  /** Lab experiment: diversify every pipeline's list (0..1). */
  mmrLambda?: number;
  mmrPool?: number;
  recordBattle?: boolean;
}): Promise<CompareResponse> {
  return fetch(`${API_URL}/api/recommendations/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: params.query ?? null,
      seed_paper_id: params.seedPaperId ?? null,
      top_k: params.topK ?? 10,
      custom_weights: params.customWeights ?? null,
      mmr_lambda: params.mmrLambda ?? null,
      mmr_pool: params.mmrPool ?? 50,
      record_battle: params.recordBattle ?? true,
    }),
  }).then(handle<CompareResponse>);
}

// ============================================================
// WEB PIPELINE BATTLE — battle the pipelines over live
// OpenAlex/Crossref/arXiv hits instead of the repository.

export function webComparePipelines(params: {
  q: string;
  topK?: number;
  sources?: string;
  sort?: string;
  peerReviewed?: boolean;
  openAccess?: boolean;
  customWeights?: { tfidf: number; sbert: number; metadata: number };
  signal?: AbortSignal;
}): Promise<CompareResponse> {
  return fetch(`${API_URL}/api/recommendations/web-compare`, {
    method: "POST",
    signal: params.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: params.q,
      top_k: params.topK ?? 5,
      sources: params.sources ?? "openalex,crossref,arxiv",
      sort: params.sort ?? "relevance",
      peer_reviewed: params.peerReviewed ?? true,
      open_access: params.openAccess ?? false,
      custom_weights: params.customWeights ?? null,
    }),
  }).then(handle<CompareResponse>);
}

// ============================================================
// BATTLE HISTORY

export interface BattleRun {
  id: number;
  query: string | null;
  seed_paper_id: number | null;
  top_k: number;
  winner_pipeline_id: string;
  winner_metric: string;
  winner_value: number | null;
  avg_consensus_rank: number | null;
  created_at: string;
}

export interface BattleHistoryResponse {
  runs: BattleRun[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  tally: { pipeline_id: string; wins: number }[];
}

export function getBattleHistory(
  page = 1,
  pageSize = 20,
): Promise<BattleHistoryResponse> {
  const search = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return fetch(`${API_URL}/api/evaluation/battles?${search}`).then(
    handle<BattleHistoryResponse>,
  );
}

// ============================================================
// FIND PDF ONLINE
// ============================================================

export function findPdfOnline(
  paperId: number
): Promise<PdfCandidate[]> {
  return fetch(
    `${API_URL}/api/papers/${paperId}/find-pdf`
  ).then(handle<PdfCandidate[]>);
}

export function attachPdf(
  paperId: number,
  url: string
): Promise<Paper> {
  return fetch(
    `${API_URL}/api/papers/${paperId}/attach-pdf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    }
  ).then(handle<Paper>);
}

// ============================================================
// RECOMMENDATION INDEX STATUS
// ============================================================

export interface RecommendationIndexStatus {
  stale: boolean;
}

export function getRecommendationIndexStatus(): Promise<RecommendationIndexStatus> {
  return fetch(
    `${API_URL}/api/recommendations/status`
  ).then(
    handle<RecommendationIndexStatus>
  );
}

export function rebuildRecommendationIndex(): Promise<{
  success: boolean;
  message: string;
}> {
  return fetch(
    `${API_URL}/api/recommendations/rebuild`,
    {
      method: "POST",
    }
  ).then(
    handle<{
      success: boolean;
      message: string;
    }>
  );
}

// ============================================================
// RECOMMENDATION INDEX STALE NOTIFICATION
// ============================================================

// Dispatches a browser event so AppLayout's listener
// can flip the "recommendation index needs updating"
// banner immediately, without waiting for a page reload
// or the next status poll.
export function notifyRecommendationIndexStale(): void {
  window.dispatchEvent(
    new Event("recommendation-index-stale")
  );
}

// ============================================================
// SIMILAR PAPERS GRAPH
// ============================================================

export interface SimilarGraphNode {
  id: number;
  title: string;
  author: string | null;
  publication_year: number | null;
  abstract: string | null;
  doi: string | null;
  citation_count: number | null;
  similarity: number;
  relationship: "current" | "similar";
  /** Shortest weighted path from the origin (start_id) to this node. */
  path: number[];
  /** Weighted length of that path (hop cost = 1 - edge weight). */
  path_length: number;
}

/** A shared group: author or topic present on >= 2 graph papers. */
export interface SimilarGraphCommonGroup {
  name: string;
  /** Paper ids that share this name. */
  mentions: number[];
  edges_count: number;
}

export interface SimilarPapersGraph {
  paper_id: number;
  pipeline: string;
  /** The origin paper every path starts from. */
  start_id: number;
  nodes: SimilarGraphNode[];
  /** Weighted triples: [source, target, weight] (0..1). */
  edges: [number, number, number][];
  /** Weighted distance from the origin, keyed by paper id
   *  (string keys -- this is a JSON object). */
  path_lengths: Record<string, number>;
  common_authors: SimilarGraphCommonGroup[];
  common_topics: SimilarGraphCommonGroup[];
  /** Seminal works most cited by the graph papers (cached OpenAlex). */
  prior_works: ClusterWork[];
  /** Works citing the most graph papers (surveys / follow-ups). */
  derivative_works: ClusterWork[];
}

export function getSimilarPapersGraph(
  paperId: number,
  pipeline = "tfidf_sbert_metadata",
  topK = 10,
  weights?: DialWeights
): Promise<SimilarPapersGraph> {
  const search = new URLSearchParams();

  search.set("pipeline", pipeline);
  search.set("top_k", String(topK));

  if (weights) {
    search.set("w_tfidf", String(weights.tfidf));
    search.set("w_sbert", String(weights.sbert));
    search.set("w_metadata", String(weights.metadata));
  }

  return fetch(
    `${API_URL}/api/papers/${paperId}/similar-graph?${search.toString()}`
  ).then(handle<SimilarPapersGraph>);
}

// ============================================================
// LIBRARY MODE & SITE EDITOR
// ============================================================

export type SiteFeatureState = "shown" | "locked" | "hidden";

export type AnnouncementLevel = "info" | "important" | "event";

export interface LibraryFeatures {
  features: Record<string, SiteFeatureState>;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  level: AnnouncementLevel;
  active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  level?: AnnouncementLevel;
  active?: boolean;
  position?: number;
}

export interface AdminSession {
  token: string;
  username: string;
  expires_at: number;
}

function adminHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/** Feature states for Library Mode (public — the nav reads it). */
export function getLibraryFeatures(): Promise<LibraryFeatures> {
  return fetch(`${API_URL}/api/site/library-features`).then(
    handle<LibraryFeatures>
  );
}

/** Active announcements for the Library Home page (public). */
export function getAnnouncements(): Promise<Announcement[]> {
  return fetch(`${API_URL}/api/library/announcements`).then(
    handle<Announcement[]>
  );
}

export function adminLogin(
  username: string,
  password: string
): Promise<AdminSession> {
  return fetch(`${API_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then(handle<AdminSession>);
}

export function adminMe(token: string): Promise<{ username: string }> {
  return fetch(`${API_URL}/api/admin/me`, {
    headers: adminHeaders(token),
  }).then(handle<{ username: string }>);
}

export function adminChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean }> {
  return fetch(`${API_URL}/api/admin/password`, {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  }).then(handle<{ ok: boolean }>);
}

export function adminListAnnouncements(
  token: string
): Promise<Announcement[]> {
  return fetch(`${API_URL}/api/admin/announcements`, {
    headers: adminHeaders(token),
  }).then(handle<Announcement[]>);
}

export function adminCreateAnnouncement(
  token: string,
  input: AnnouncementInput
): Promise<Announcement> {
  return fetch(`${API_URL}/api/admin/announcements`, {
    method: "POST",
    headers: adminHeaders(token),
    body: JSON.stringify(input),
  }).then(handle<Announcement>);
}

export function adminUpdateAnnouncement(
  token: string,
  id: number,
  input: Partial<AnnouncementInput>
): Promise<Announcement> {
  return fetch(`${API_URL}/api/admin/announcements/${id}`, {
    method: "PUT",
    headers: adminHeaders(token),
    body: JSON.stringify(input),
  }).then(handle<Announcement>);
}

export function adminDeleteAnnouncement(
  token: string,
  id: number
): Promise<{ ok: boolean; deleted: number }> {
  return fetch(`${API_URL}/api/admin/announcements/${id}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  }).then(handle<{ ok: boolean; deleted: number }>);
}

export function adminGetLibraryFeatures(
  token: string
): Promise<LibraryFeatures> {
  return fetch(`${API_URL}/api/admin/library-features`, {
    headers: adminHeaders(token),
  }).then(handle<LibraryFeatures>);
}

export function adminSetLibraryFeatures(
  token: string,
  features: Record<string, SiteFeatureState>
): Promise<LibraryFeatures> {
  return fetch(`${API_URL}/api/admin/library-features`, {
    method: "PUT",
    headers: adminHeaders(token),
    body: JSON.stringify({ features }),
  }).then(handle<LibraryFeatures>);
}

// ============================================================
// CONNECTIONS — PRIOR / DERIVATIVE WORKS (local + web)
// ============================================================

/** One external work clustered across the local graph. */
export interface ClusterWork {
  work_id: string;
  label: string;
  doi: string | null;
  is_local: boolean;
  matched_paper_id: number | null;
  /** Local graph paper ids that reference (prior) or are cited by
   *  (derivative) this work. */
  graph_paper_ids: number[];
  count: number;
}

/** One OpenAlex work in the web neighborhood. */
export interface WebWork {
  work_id: string;
  title: string | null;
  doi: string | null;
  publication_year: number | null;
  cited_by_count: number | null;
  author: string | null;
}

export interface WebConnections {
  ok: boolean;
  paper_id: number;
  doi: string | null;
  work_id: string | null;
  prior_works: WebWork[];
  derivative_works: WebWork[];
  /**
   * Inter-work connection structure: [source, target, weight, kind].
   * Kinds: "ref" (center → prior), "cit" (citer → center),
   * "cites" (citer → prior), "coref" (shared references between
   * priors), "cocite" (shared references between citers).
   * The center is the literal "center".
   */
  edges?: [string, string, number, string][];
}

export function getWebConnections(
  paperId: number
): Promise<WebConnections> {
  return fetch(
    `${API_URL}/api/papers/${paperId}/web-connections`
  ).then(handle<WebConnections>);
}

// ============================================================
// LITERATURE ACTIONS (multi-select context menu)
// ============================================================

export interface RenameResult {
  ok: boolean;
  renamed: { id: number; stored_path: string }[];
  skipped: { id: number; reason: string }[];
}

export interface MergeResult {
  ok: boolean;
  master_id: number;
  merged_ids: number[];
  fields_filled: number;
  library_moved: number;
  library_dropped: number;
  citations_moved: number;
  citations_dropped: number;
}

export function refreshPapersMetadata(
  paperIds: number[]
): Promise<{ ok: boolean; queued: number[] }> {
  return fetch(`${API_URL}/api/papers/refresh-metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_ids: paperIds }),
  }).then(handle<{ ok: boolean; queued: number[] }>);
}

export function revealPapers(
  paperIds: number[]
): Promise<{ ok: boolean; paper_id: number; path: string }> {
  return fetch(`${API_URL}/api/papers/reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_ids: paperIds }),
  }).then(handle<{ ok: boolean; paper_id: number; path: string }>);
}

export function renamePaperFiles(
  paperIds: number[],
  pattern: "title" | "author-year" | "author-year-title" | "custom",
  customName?: string
): Promise<RenameResult> {
  return fetch(`${API_URL}/api/papers/rename-files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paper_ids: paperIds,
      pattern,
      custom_name: customName,
    }),
  }).then(handle<RenameResult>);
}

export function markPapers(
  paperIds: number[],
  valid: boolean
): Promise<{ ok: boolean; updated: number; valid: boolean }> {
  return fetch(`${API_URL}/api/papers/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_ids: paperIds, valid }),
  }).then(handle<{ ok: boolean; updated: number; valid: boolean }>);
}

export function mergePapers(
  paperIds: number[]
): Promise<MergeResult> {
  return fetch(`${API_URL}/api/papers/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_ids: paperIds }),
  }).then(handle<MergeResult>);
}
