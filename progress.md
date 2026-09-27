
---

# Progress Log — Automatic PDF Attachment, Keyword Generation,
# and Duplicate Detection

This entry covers a second round of changes, on top of the metadata
enrichment described above. Three related gaps were closed:

    1. Citation-only (BibTeX / Google Scholar) uploads previously
       never received a real PDF file automatically -- only the
       original .bib text was stored, even when PDF discovery had
       already found a confident open-access match while enriching
       metadata. The candidates were used to fill title/abstract/
       year/author and then discarded.
    2. Keywords had no fallback path for papers that will never have
       a PDF attached: extract_metadata_from_pdf()'s hybrid keyword
       extraction (author-provided line, then YAKE) only ran when a
       PDF was actually opened, so a BibTeX-only paper stayed
       keyword-less indefinitely.
    3. Nothing prevented the same paper from being imported twice --
       a PDF and its own BibTeX citation uploaded separately, or a
       repeated Google Scholar paste, silently created a second
       Paper row.

No new dependencies were required -- all three changes reuse
libraries and modules already in requirements.txt (YAKE was already
in use for keyword generation; difflib, used for title similarity, is
part of the Python standard library).

---

## Backend changes

### `app/services/extraction.py`
- Added `generate_keywords_from_metadata(title, abstract, max_keywords)`.
  Runs the same YAKE keyword pipeline `extract_metadata_from_pdf()`
  already uses internally (`_build_keyword_source_text()` +
  `_extract_yake_keywords()`), but takes plain title/abstract text
  directly instead of requiring a PDF file to be opened. Returns the
  same shape (`keywords`, `keywords_source`, `keywords_generated`) so
  callers can treat it as a drop-in alternative source.

### `app/services/metadata_enrichment.py`
- Added `generate_keywords_if_missing(paper)`. Fills `paper.keywords`
  using `generate_keywords_from_metadata()` against the paper's own
  `title`/`abstract` -- no PDF-discovery candidates, no network call.
  Only runs when `paper.keywords` is currently blank. Appends a
  `"keywords <- yake (title+abstract)"` note to
  `paper.enrichment_notes` when it fires, consistent with the
  existing enrichment audit trail.
- `enrich_paper_metadata()`'s docstring updated to point to this new
  function as the actual keyword-filling path, since keywords are
  still deliberately excluded from the *external-candidate* enrichment
  it performs (unchanged reasoning: no source returns keywords in a
  comparable taxonomy).

### `app/services/pdf_finder.py`
- `_title_similarity()` renamed to `title_similarity()` (dropped the
  leading underscore) across its definition and all internal call
  sites (`_resolve_doi_via_crossref`, `_search_crossref_pdf_links`,
  `_search_unpaywall`, `_search_semantic_scholar`, `_search_arxiv`,
  `_search_openalex`, `_search_google_scholar_via_serpapi`,
  `download_and_attach_pdf`). Made public specifically so
  `duplicate_detection.py` (below) can reuse the exact same blended
  title-similarity measure, instead of maintaining a second
  implementation that could drift out of sync with this one.

### `app/services/duplicate_detection.py` (new file)
- `find_duplicate_paper(db, title, doi)`: checks a new paper's
  metadata against every existing paper in the repository, using two
  signals in order of reliability:
    1. Exact DOI match (normalized, `doi.org/` prefix stripped).
    2. Title similarity via `pdf_finder.title_similarity()`, at a
       stricter bar (`TITLE_DUPLICATE_THRESHOLD = 0.85`) than PDF-
       candidate matching uses, since blocking an upload outright is
       higher-stakes than merely suggesting a PDF candidate.
- `DuplicatePaperError`: raised by `upload_paper()` when a match is
  found; carries the existing paper's id/title so the error message
  is actionable. No database row is created when this fires.

### `app/services/upload_paper.py`
- New **Step 1b** (duplicate check): runs `find_duplicate_paper()`
  right after metadata extraction, before any `Paper` row is
  constructed. Raises `DuplicatePaperError` on a confident match.
- New **Step 5c** (keyword generation): runs
  `generate_keywords_if_missing()` right after the existing PDF-
  discovery enrichment step (5b), regardless of whether that step
  found anything -- this only needs title/abstract text the paper
  already has. Re-runs `validate_paper()` if it changed anything.
- `_try_enrich_from_pdf_discovery()` now **returns** the candidate
  list it found (previously discarded after use), so the new auto-
  attach step below can reuse it without a second round of network
  calls to the same five sources.
- New `_try_auto_attach_pdf(paper, candidates)`: for citation-only
  uploads, downloads the highest-confidence candidate (reusing the
  results from Step 5b) via the existing `download_and_attach_pdf()`
  and updates `paper.stored_path` to point at a real `.pdf` instead of
  the original `.bib`. Only fires when the best candidate meets the
  same `MIN_CONFIDENCE` bar the manual "Find PDF Online" flow already
  trusts. Never raises -- a failed attach leaves the paper safely
  stored under its original `.bib` file rather than failing the
  upload.
- New **Step 8b**: calls `_try_auto_attach_pdf()` after the paper's
  first commit (needs `paper.id` to name the stored file, per
  `download_and_attach_pdf()`'s existing convention), only for `.bib`
  uploads. Commits again only if a PDF was actually attached.

### `app/api.py`
- Imported `DuplicatePaperError`.
- `POST /api/papers/upload`, `POST /api/papers/import-url`, and
  `POST /api/papers/import-bibtex` each now catch
  `DuplicatePaperError` ahead of the generic exception handler and
  return **HTTP 409 Conflict** with the error's message, instead of a
  generic 500.

### `scripts/auto_attach_existing_papers.py` (new file)
- Retroactive counterpart to the upload-time auto-attach above: scans
  every existing paper whose `stored_path` doesn't already end in
  `.pdf`, runs `find_pdf_candidates()` + the same
  `_try_auto_attach_pdf()` used at upload time, and commits any
  successful attachment.
- `--limit N` flag to run a small trial batch before processing the
  full repository.
- Safe to re-run: a paper that already got a PDF is skipped on
  subsequent runs (its `stored_path` already ends in `.pdf`); a paper
  with no confident candidate is simply re-skipped, at the cost of
  one repeated search per run.
- Does not itself change title/abstract/keywords/year -- the console
  output points to `scripts/enrich_existing_papers.py` as the follow-
  up step if those fields should also be backfilled for papers that
  just received a PDF.

---

## Net effect

- A BibTeX / Google Scholar citation import now frequently ends up
  with a real, viewable PDF automatically, instead of staying a
  citation-only record until someone manually runs "Find PDF Online."
- Papers that will never get a PDF attached (paywalled, no OA copy
  found) still get keywords generated from their own title+abstract,
  closing a gap that previously left such papers permanently keyword-
  less and therefore weaker inputs to TF-IDF/S-BERT.
- Re-uploading the same paper (by DOI or near-identical title) is now
  rejected with a clear 409 instead of silently duplicating the
  record.
- `scripts/auto_attach_existing_papers.py` lets the auto-attach
  behavior benefit papers already in the repository, not only new
  uploads going forward.

## Verification performed

- Confirmed all new/changed modules import cleanly
  (`extraction.py`, `metadata_enrichment.py`, `pdf_finder.py`,
  `duplicate_detection.py`, `upload_paper.py`, `api.py`) before
  starting the backend.
- `uvicorn app.api:app --reload` starts cleanly; `GET /docs` returns
  `200 OK`.
- `python -m scripts.auto_attach_existing_papers --limit 5` run
  against the existing 77-paper repository to confirm the bulk script
  processes real data without errors before running the unrestricted
  pass.