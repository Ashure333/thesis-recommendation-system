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
}

export interface RepositoryStats {
  total_papers: number;
  by_subject: Record<string, number>;
  category_count: number;
}

export interface LibraryEntry {
  paper: Paper;
  saved_at: string;
}

export interface SearchResult {
  paper: Paper;
  score: number;
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

    throw new Error(
      body.detail ?? `Request failed (${res.status})`
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

export function getRepositoryStats(): Promise<RepositoryStats> {
  return fetch(`${API_URL}/api/papers/stats`).then(
    handle<RepositoryStats>
  );
}

export function getPaper(id: number): Promise<Paper> {
  return fetch(`${API_URL}/api/papers/${id}`).then(
    handle<Paper>
  );
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

export function uploadPaper(file: File): Promise<Paper> {
  const formData = new FormData();
  formData.append("file", file);

  return fetch(`${API_URL}/api/papers/upload`, {
    method: "POST",
    body: formData,
  }).then(handle<Paper>);
}

export async function importBibtex(
  bibtex: string,
  filename = "google-scholar.bib"
): Promise<Paper> {
  const blob = new Blob([bibtex], {
    type: "application/x-bibtex",
  });

  const file = new File(
    [blob],
    filename,
    {
      type: "application/x-bibtex",
    }
  );

  return uploadPaper(file);
}

export function getLibrary(): Promise<LibraryEntry[]> {
  return fetch(`${API_URL}/api/library`).then(
    handle<LibraryEntry[]>
  );
}

export function saveToLibrary(
  paperId: number
): Promise<{ status: string }> {
  return fetch(`${API_URL}/api/library/${paperId}`, {
    method: "POST",
  }).then(handle<{ status: string }>);
}

export function removeFromLibrary(
  paperId: number
): Promise<void> {
  return fetch(`${API_URL}/api/library/${paperId}`, {
    method: "DELETE",
  }).then(handle<void>);
}

export function deletePaper(
  paperId: number
): Promise<void> {
  return fetch(`${API_URL}/api/papers/${paperId}`, {
    method: "DELETE",
  }).then(handle<void>);
}

export interface RecommendationParams {
  pipeline: string;
  query?: string;
  seedPaperId?: number;
  topK?: number;
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

  return fetch(
    `${API_URL}/api/recommendations?${search.toString()}`
  ).then(handle<SearchResult[]>);
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
