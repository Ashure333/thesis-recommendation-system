
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

---

# Progress Log — Dead-code audit, performance pass, and docs refresh

Date: 2026-10-07. Scope: the whole site (FastAPI backend in `app/`,
React frontend in `frontend/`), plus the in-app Walkthrough and Engine
pages. Nothing was committed: every change below is in the working tree
on `main`, on top of the owner's existing uncommitted tree-port work.

This entry covers four things: (1) a backup before any change, (2) a
dead-code audit run as eight parallel read-only audits, (3) the safe
removals and measured optimisations that came out of it, and (4) a
refresh of the Walkthrough and Engine pages so they match the code.
Items that need an owner decision were deliberately NOT applied and are
listed under "Left for the owner".

---

## Safety net (how to undo any of it)

- Git tag `backup/pre-deadcode-20261007`: a commit holding HEAD plus the
  uncommitted working tree as it was before this work (made with
  `git stash create`, so the working tree itself was not touched).
  Git tag `backup/pre-deadcode-20261007-head`: HEAD only.
- Full file backup: `~/Documents/thesis-recommendation-system-backup-20261007.tar.gz`
  (316 MB, checksum in the `.sha256` file beside it). It includes `.git`
  and the gitignored runtime data (`*.db`, `*.joblib`, `*.npz`,
  `storage/`); it excludes `.venv`, `frontend/node_modules`,
  `frontend/dist` and `__pycache__`.
- See everything that changed: `git diff backup/pre-deadcode-20261007`.
  Restore one file: `git checkout backup/pre-deadcode-20261007 -- <path>`.
- The full audit reports and the patches that were applied are kept in
  `~/Documents/thesis-recommendation-system-audit-20261007/` (the
  numbered findings quoted below, e.g. "H27" or "F8", refer to those).

---

## Method

1. Baseline first: frontend typecheck clean; backend `unittest` 214 tests
   OK (1 skipped); a browser smoke test of every route in both site
   modes (Library and Researcher), recorded in `smoke-baseline.md`.
2. Mechanical evidence: `tsc --noUnusedLocals --noUnusedParameters`
   (35 findings), a TypeScript-compiler-API scan for exports nobody
   imports and modules nobody reaches (21 dead exports, 1 orphan),
   `vulture` plus `ast` checks on the Python, and a diff of the 50
   FastAPI routes against what the frontend actually calls.
3. Eight read-only audit agents, one per disjoint slice: frontend
   pages; frontend components/CSS/`api.ts`; retro/state/data modules;
   backend dead code; repo hygiene, assets and dependencies; frontend
   performance; backend performance; and the baseline smoke test.
   Every "dead" claim had to show the greps that returned nothing and
   rule out dynamic use (string keys, registries, `import()`, CSS class
   assembly). Findings were classed DEAD-HIGH / DEAD-MED / WIP-owned /
   KEEP.
4. Only DEAD-HIGH items and measured, behaviour-preserving optimisations
   were applied. Anything in the 8 files with the owner's uncommitted
   work was left alone.

---

## Results at a glance

| measure | before | after |
|---|---|---|
| frontend entry JS | 1,117 kB raw / 339 kB gzip, 1 chunk | 341 kB raw / **111 kB gzip**, 28 JS chunks |
| frontend entry CSS | 108.6 kB / 22.1 kB gzip | 77.2 kB / 13.5 kB gzip |
| `tsc` unused symbols | 35 | 9 (all in the owner's WIP files) |
| exports nobody imports | 21 | 5 (4 in WIP files, 1 in an orphan file) |
| backend tests | 214 OK, 1 skipped | 214 OK, 1 skipped |
| lines changed | | 48 files, +364 / -1,116 (backend 17 files +157/-169, frontend `src` 27 files +207/-895, config/lock 4 files -52) |
| broad Repository search (`search=the&sort_by=relevance`) | ~1,270 ms | ~110 ms |
| hybrid recommendation (seed or query) | ~77 ms | ~31 ms |
| `GET /api/papers` | ~12 ms | ~3 ms |
| `GET /api/papers/stats` | ~4.6 ms | ~1.1 ms |

Bundle numbers come from `vite build` on the real tree (output sent to a
scratch folder, never to `frontend/dist`). Endpoint timings are curl
total time, warm, same machine and database; see "Verification".

---

## Backend changes

Dead code removed (all had zero references anywhere, including
`scripts/`, `test/` and docs):

- `app/services/arxiv_categories.py`: `ARXIV_SUBJECT_ONLY` (never read).
- `app/services/web_search.py`: `REQUEST_LIMIT_CAP`.
- `app/services/evaluation/qrels.py`: `_work_doi()`.
- `app/repositories/queries.py`: `search_papers()` (superseded by
  `filter_papers()` plus FTS).
- `app/services/recommendation/compare_service.py`: the `PipelineName`
  alias. `trace_service.py`: `_round_scores()` (a copy of the live one
  in `search_service.py`).
- Unused imports: `PIPELINE_CONFIGS` (`api.py`), `PersonalLibrary`
  (`merge_duplicates.py`), `field` (`pdf_finder.py`).
- `api.py` import-bibtex handler: a `source_url` variable and an `if`
  whose two arms assigned the same constant.
- `classification.py`: a duplicate `"toward"` in a set literal.
- `metadata_enrichment.py`: two `hasattr(paper, "enrichment_notes")`
  guards that are always true now that the column is mapped.
- Removed route `GET /api/papers/preview-pdf` (about 60 lines, plus the
  now-unused `Response` import). Nothing referenced it: not the
  frontend, README, Walkthrough, thesis chapters, tests or the browser
  extension, and the frontend dropped its helper in an earlier commit.
  It also fetched any http(s) URL server-side with no auth.

Performance (the backend-performance audit's patch, reviewed line by
line and applied; files: `api.py`, `database.py`, `queries.py`,
`citations.py`, `metadata_pipeline.py`, `sbert_pipeline.py`,
`search_service.py`, `tfidf_pipeline.py`):

- F8 `queries._collapse_duplicate_papers`: the fuzzy near-duplicate
  title check ran an O(n^2) pair loop that recomputed normalisation for
  every pair. Features are now computed once per title, the cheap exact
  and token-Jaccard checks run first, and `difflib`'s upper bounds
  (`real_quick_ratio`, `quick_ratio`) reject most pairs before the
  expensive `ratio()`. Same decisions (checked against the original
  `titles_are_duplicates` on all 14,535 real title pairs). This is the
  main win: the Repository's default search was ~1.3 s on a broad term.
- F0 `database.py`: `PRAGMA temp_store=MEMORY` and `cache_size=-16000`.
- F3 list/search queries `defer()` the three big columns they never read
  (`tfidf_vector`, `sbert_vector`, `prepared_text`).
- F4 `GET /api/papers/stats` groups in SQL instead of loading every row.
- F9 `GET /api/library` uses `selectinload` (removes an N+1).
- F1 metadata scoring densifies the TF-IDF matrix once (fresh row copies
  keep results bit-identical).
- F2 the fitted TF-IDF vectorizer is cached by (path, mtime, size)
  instead of being unpickled on every query; it reloads automatically
  when a rebuild writes a new file.
- F11 MMR parses TF-IDF vectors only when S-BERT vectors are unavailable.
- F12 the startup warm-up also encodes one dummy string, so the first
  real S-BERT request is no longer slow.
- F13 `citation_maps` reads four columns instead of building ORM objects.

**The running dev server must be restarted to pick the backend changes
up** (it was started without `--reload`).

---

## Frontend changes

- Lazy-loaded routes (`App.tsx`): the 13 post-login pages are
  `React.lazy` chunks; `AppLayout` wraps its `<Outlet />` in `Suspense`
  and `/admin` has its own boundary. The shell (nav, ticker, pet) stays
  mounted while a page chunk loads. Auth pages stay eager.
- `index.css`: the `.crt-scan-bar` overlay animated `top` every frame on
  every route; it now animates `transform` over the same range.
- `useTypewriter` stops its timer once the text is typed;
  `Repository.tsx` ignores responses from superseded search requests.
- Dead code removed (about 900 net lines): unused `api.ts` wrappers
  (`getRepositoryStats`, `importBibtex`, `researchChat` and their types);
  `ConnectedPapersGraph` dead branches (its only caller always passed
  `hideClusterSections` and `hideRankedList`, so the ranked list,
  `ClusterSection` and a local CSV copy were unreachable, -320 lines);
  the second, identical copy of the Results section in
  `Recommendations.tsx` (148 lines, verified identical, now one call to
  `renderResultsSection()`); unused UI primitives (`SectionHeading`,
  `FieldLabel`, the `danger` Button variant); `catalogSeed`; unused
  citation helpers; dead state/imports in `Recommendations`, `Lab`,
  `MathWalkthrough`, `Repository`, `Upload`, `SunShop`, `PixelPet`,
  `sun.tsx` (retired height-model constants, a stale cheat table, two
  unused parameters); unused exports in `data/*`; dead CSS (about 2.4 kB
  of rules and keyframes, 2.1 kB of it shipped); six dead Tailwind config
  keys (compiled CSS is byte-identical without them); a dead inline
  `tonal()` in `index.html`.
- Dependencies: dropped `react-icon` and `react-icons` (never imported;
  `package.json` and `package-lock.json` only, `node_modules` untouched,
  run `npm install` to prune it).
- Not touched on purpose: the owner's 8 files with uncommitted work
  (`CheatFoliage`, `GardenBackdrop`, `PixelGrowthTree`,
  `TreeOfKnowledge`, `backdrops.ts`, `knowledge.ts`, `petForms.ts`,
  `petlines.ts`). `Walkthrough.tsx` is also in that set; only the
  documentation edits below were made there.

---

## Documentation changes (Walkthrough, Engine, Changelog)

Every correction was checked against the code or the live API first.

Engine page (`MathWalkthrough.tsx`):
- New subsection "Optional diversification (MMR)" under Ranking &
  output: the objective, lambda = 0.7 when the Diversify checkbox is
  ticked, the top-50 pool, and the similarity source (stored S-BERT
  vectors, TF-IDF if fewer than two exist); plus a complexity-table row.
- The similar-papers graph formula gained the 0.25 citation term
  `C = 0.5 * coupling + 0.5 * co-citation` (exactly 0 for a pair with no
  cached citation rows). The old paragraph said the repository stores no
  reference lists, which stopped being true when `paper_citations` was
  added.
- Paper counts now match the live index: 150 valid papers (it said 146).
  Infobox typo fixed (`fixed seeds` was missing its closing bracket).
  Lab and Settings added to the page links.

Walkthrough page (`Walkthrough.tsx`):
- 27 tips (it said 26/26); trace route is `POST`, not `GET`; depth is
  Top 5 / 10 / 20 (it said 15); the Search page has no pipeline selector
  (it is in the Repository filter console) and custom dials are in the
  Lab; query modes are Keyword / Title / Seed; results are cards with a
  score breakdown; the math panel is the "Stats for Nerds" tab.
- The top-bar paragraph said "six tabs" and omitted the Library /
  Researcher switch; it now lists all eleven tabs and explains the
  switch and the default Library-mode lineup.
- Repository counts: 171 records, 150 valid (it said 168 / 146); the
  Subjects table refreshed to the live distribution; the broken
  changelog citation (`arxiv-source`, which does not exist, so it
  rendered nothing) now cites `arxiv-taxonomy`; the "stores no
  reference lists" bullet was corrected; the research-assistant row now
  says API-only (its UI was removed); Lab and Settings added to page
  lists; the infobox "Pages" row gained Settings.

Changelog (`data/changelog.ts`): two new entries, `pages-load-on-demand`
and `engine-mmr-and-citations`; the Engine page cites the second.

---

## Verification performed

- `tsc -p tsconfig.json --noEmit` clean; `check:inline-scripts` passes;
  `vite build` succeeds. (`npm run typecheck`/`build` were not used: they
  also run `tsc -b`, which writes `vite.config.js` into `frontend/`.)
- Backend: `python -m unittest discover -s test -t .` = 214 tests OK,
  1 skipped, after every backend step. `compileall` clean; no unused
  imports left; `vulture --min-confidence 80` clean.
- Backend A/B on live data: the old code (dev server, port 8000) versus
  the patched code (a temporary second instance on port 8011, same
  database, stopped afterwards) answered 25 read-only requests (list,
  search incl. relevance sorting, stats, library, catalog, every
  pipeline with query and seed, MMR, paging). **All 25 responses were
  byte-identical.** The audit's own harness had compared 1,117 requests
  for exact JSON equality on a copy.
- Browser re-check after all changes (Researcher mode, one tab): all 12
  app routes render with the same headings as the baseline and no
  console errors, no unhandled rejections; the only console messages are
  the three baseline warnings. Search "neural networks" under FINAL BOSS:
  10 found, 32 related, Prior works (5) - identical to the baseline;
  Diversify (MMR) search, rank-badge re-centring and the graph tabs work;
  Repository text search narrows 145 -> 11 papers and returns to 145 when
  cleared; Walkthrough: 64/64 images load, lightbox opens, arrows and
  Escape work, focus returns, 13 sections as before; Engine: 12 sections
  as before, new MMR subsection renders, no math block overflows; Lab:
  Garden, Sun shop, tree skins and stats tabs open, no state changed.
  The browser's localStorage was put back (Library mode, original
  pipeline).

---

## Left for the owner (not applied, needs a decision)

1. Delete two orphaned files: `frontend/src/components/PipelineDials.tsx`
   (335 lines, never rendered since the dial UI moved to the Lab) and
   `frontend/src/hooks/useCountUp.ts` (44 lines). The environment's
   permission check blocked the deletion, so they are still there;
   nothing imports them: `git rm` them.
2. Restart the backend (`uvicorn app.api:app --reload`) to get the
   backend speedups; port 8000 is still running the old code.
3. Dead code inside the WIP files: `CRIMSON_PALETTE`, `BIRCH_GOLD`, `FUN`
   (`PixelGrowthTree`), `LAWN_COLS/LAWN_ROWS`, `onOpenShop`, `spent`
   (`TreeOfKnowledge`), `oMid`, `C`, `themeIndex` (`backdrops.ts`),
   `nextStageThreshold`, `knowledgeStage`, `TREE_GROWTH_MARKERS`
   (`knowledge.ts`). All were already unused at HEAD, so they are old
   leftovers, not mid-port scaffolding. Also duplicated helpers (`rng`,
   `hash`, `clamp`, `vn`, `put`) between `PixelGrowthTree.tsx` and
   `backdrops.ts`, and the `PetForm.lore` field nothing renders.
4. `.tree-sway` and `.leaf-fall` rules in `index.css` (about 35 lines):
   dead today, but tied to the tree renderer being rewritten.
5. `SHOW_WALKTHROUGH_TAB` / `SHOW_ENGINE_TAB` in `AppLayout.tsx` are
   constant `true`. Kept because they read as a deliberate manual
   kill-switch (and trivia text mentions them); visibility is also
   controlled by the site editor.
6. Research assistant backend: `POST /api/research-chat` +
   `app/services/research_chat.py` (388 lines) + `python-dotenv`. Its UI
   was deleted earlier; the in-app docs still advertised it.
7. `MathPaper/` (53 MB, 55 PDFs) is byte-identical to files in
   `storage/papers/`, and both copies are tracked.
8. The "custom pipeline" path outside the Lab is dead (nothing can set
   it; only stale localStorage could). Removing it is a multi-file change
   (`Recommendations`, `Repository`, `AppLayout`, `pipelineMode`,
   `StatsForNerds`, `PipelineMath`) and needs a localStorage sanitiser.
9. `Evaluation.tsx` renders a second "Score distribution" section
   (about 104 lines) under the same tab; probably a leftover of a
   redesign.
10. SunShop dead branches (about 190 lines: preview, picker rail, popup
    state) and the state only they use in `sun.tsx` (`spent`, `tipsSeen`,
    `packs`, `nextMilestone`): `SunShop` is only ever mounted embedded.
11. Eight tips in `data/tips.ts` have no element carrying their id and
    cannot be hovered (four describe a page that no longer exists), so
    "Tips hovered N/27" can never be completed by hovering.
12. Image weight: walkthrough PNGs 14.4 MB -> 1.6 MB as WebP q82
    (measured); pet sprite sheets 19.7 MB -> 5.9 MB lossy with lossless
    alpha (measured, needs a visual check).
13. Further backend cleanups: a shared `_get_paper_or_404` helper (11
    identical blocks in `api.py`), seven copies of DOI normalisation
    (the `web_search.py` one strips fewer prefixes than the rest), and a
    compare-request memo (about 111 -> 60-70 ms).
14. Hygiene: 146 files are tracked despite the `*.pdf`/`*.bib`/`*.db`
    ignores (including the live DB); `frontend/.env` is tracked; the root
    `academic_repository.db` is 0 bytes and the root `package-lock.json`
    is a stray; `npm run typecheck` emits `frontend/vite.config.js`, which
    Vite loads before `vite.config.ts`; 90 of 174 files under `storage/`
    are untracked. `frontend/README.md` is stale (`READMEUI.md` is the
    current one) and the root README's script/test counts are out of date.

---

## Bugs found but not fixed (behaviour changes, so left for you)

- `Register.tsx:70` navigates to `/search`, which is not a route, so a
  new user lands back on the sign-in page (probably `/recommendations`).
- `MyLibrary.tsx` `openMenuAt` only looks in the checked rows, so
  right-click / long-press does nothing on an unchecked row.
- `PixelPet` `handleReset` edits `paperrec_sun` behind the provider's
  back and the next state change can undo the reset.
- `index.html`'s pre-paint palette has 8 skins while `theme.tsx` has 12
  and it has no dark-mode path, so the other 4 skins and dark users get
  a first-paint flash.
- Garden text says 3,000 packets, the Sun shop says 10,000; the cheat
  list repeats "1000 feet".
- FAQ describes a sign-out and an account menu that do not exist;
  `Evaluation.tsx` has a typo ("can.t"); login "remember me" is written
  but never read (auth is cosmetic by design).
- Repository's left "Sort" dropdown has no visible effect because the
  table re-sorts client-side; the header says "145 papers" while the
  repository holds 171 (a default year filter hides the rest).
- Accessibility: FAQ accordion buttons lack `aria-expanded`; the home
  search input has no visible focus ring; Walkthrough screenshots have
  no width/height (layout shift).
- Not applied performance items from the audits: hoist `anchors` out of
  `step` in `CheatFoliage` (it rescans every button every frame while a
  cheat is armed); cap the garden backdrop at 30 fps (11-23 ms per frame
  late in the climb); the pet menu mounts ten sprite sheets (19.7 MB)
  for 30 px icons; skip redundant sprite redraws; self-host the Google
  font CSS. The WIP ones are in your files, so they were not touched.

---

## Notes for the thesis text

- Numbers the in-app docs now state: 171 records, 150 valid for
  recommendation (the vector-index size as of its last build),
  27 tips. Any chapter that quotes 146 / 168 / 26 is now out of step
  with the Walkthrough and Engine pages.
- The Engine page now documents MMR (an implemented, opt-in feature) and
  the citation term of the graph weight; both are described in the
  thesis appendices but were missing from the in-app page.


---

# Progress Log — First-run screen: flicker removed, byline corrected

Date: 2026-10-07 (follow-up to the entry above). Reported: flicker on the
first run of the site, the first-run animation style, and the byline saying
"Department" where it should say "College of Science".

## What was wrong (measured on the first run, before changing anything)

- Black-to-cream flash. The boot splash used the themed grays
  (`bg-gray-950`), which invert in dark mode, so the splash painted cream
  (`rgb(240, 232, 219)`) while `index.html` pre-paints `#030712`: every
  dark-mode first run went black, then cream.
- A second flash for anyone with a saved theme. The pre-paint script in
  `index.html` threw `ReferenceError: x is not defined` in its tag-colour
  code whenever an accent was stored. Its empty `catch {}` swallowed the
  error, so the dark boot background, the accent attribute and the tag
  colours were never applied before React mounted: the page was transparent
  or light, then the dark splash popped in, and tag colours recoloured
  late. This bug was already in the original file (same error on the backup
  tag), not introduced by the cleanup.
- The whole splash strobed: a looping brightness dip (57 dipped frames in
  4.5 s). The title also jittered every frame (`animate-glitch`).
- The centred title re-centred and re-wrapped while typing: its x moved
  across 41 positions and its y across 13 (height 1 to 3 lines), with four
  large layout shifts (about 0.25 total). PRESS START appeared late and
  shifted things again, and text swapped fonts about 150 ms in.
- Elsewhere: `.animate-glitch` also jittered the header title for the whole
  session, and the always-on `.crt-overlay` dipped its opacity every 5 s.

## What changed

- `BootSplash.tsx` rewritten. Fixed arcade-black screen (same colour as the
  pre-paint, in every theme); content waits for the pixel font; the full
  title's line breaks are reserved from the first frame (the untyped rest
  is invisible and the cursor is zero-width), and PRESS START has its space
  before it appears; one CRT power-on, one glitch pulse when the title
  lands, a 260 ms fade-out on dismiss; on dismiss the inline black page
  background is removed so the theme owns the canvas again. Text colours
  are fixed light-on-dark; the accent still follows the theme.
- `index.css`: removed the strobe (`animate-boot-flicker`) and the overlay's
  opacity flicker; added `boot-screen`, `boot-scanlines`, `animate-boot-on`,
  `animate-boot-out`, `animate-glitch-once`; `animate-glitch` is now one
  brief burst every 6 s instead of a constant jitter.
- `index.html`: the tag-colour block now computes its own `x`; the
  pre-paint background step has its own `try`, so a colour-code error can
  never skip it again.
- `scripts/check-inline-scripts.mjs`: besides parsing, it now RUNS the
  pre-paint script against a stub DOM for no accent and every palette (18
  scenarios) and fails on any swallowed exception, a missing pre-paint
  background, or an unset accent/tag colour. It passes on the fix and fails
  on the original file with the exact error. `npm run check` (and so
  `npm run build`) runs it.
- Byline: `© 2026 BULSU BSMCS · COLLEGE OF SCIENCE · BUILT BY TEMPEST`
  (it was "DEPARTMENT OF COMPUTER SCIENCE"); this was the only occurrence.
- Walkthrough: the "Title screen" image `public/walkthrough/10-login-splash.png`
  actually showed the Search page; it was retaken (1500x950) and its caption
  now describes the boot screen. Changelog entry `boot-screen-calm` added.

## Verification (same recorder, before and after)

| first run, 4.6 s | before | after |
|---|---|---|
| splash background vs pre-paint | cream vs near-black | identical (`rgb(3, 7, 18)`) in every frame, dark, light, saved accent |
| page background with a saved accent | transparent, then light canvas | dark from the first frame (t = 2 ms) |
| title x / y positions after power-on | 41 / 13 | 1 / 1 (one fixed box, 755+ frames) |
| strobing frames | 57 | 0 (no filter or transform left after power-on) |
| looping flicker animations on any page | boot strobe, glitch, CRT dip | none (left: pet, blink cursor, ticker, scan-line drift) |

Also: dismissal fades 1 to 0 in 280 ms and unmounts cleanly; all 12 routes
render with no console errors in Researcher mode; `tsc` clean; `vite build`
entry still 112 kB gzip.

## Notes

- The ambient scanline overlay and the header glitch are shared styles, so
  they changed site-wide. To bring the old always-on CRT dip back, restore
  `retro-crt-flicker` on `.crt-overlay` in `index.css` (see the backup tag).
- `tensura.jpeg` (root, 3 MB, referenced nowhere) was deleted from the
  working tree during this session, not by the cleanup; it is in git HEAD,
  the backup tag and the tarball (`git checkout -- tensura.jpeg` restores it).


---

# Progress Log — Stats for Nerds checked, Dijkstra added to the Engine, thesis updated

Date: 2026-10-07 (follow-up). The menu-ribbon work was handed to another agent
and is not part of this entry (`AppLayout.tsx`'s header and nav were not touched
here). Scope: check the Stats for Nerds code against the engine, add more math
to the Engine page (Dijkstra), and bring `thesis-paper/` in line.

## Stats for Nerds: what was checked and what was wrong

Every formula in `pipelineMath.ts`, `PipelineMath.tsx` and the Engine page was
compared with `search_service.py`, `similarity.py`, `metadata_pipeline.py`,
`text_preparation.py`, `mmr.py` and `connected_graph.py`. Text preparation, the
IDF/cosine formulas, min-max normalization (all-equal and all-zero scores map
every paper to 1.0), the weighted combination, the year term and the ranking
tie-breaks all matched. Found and fixed:

- Metadata vectorizer described as "pairwise, fitted on the two texts". The code
  (changed in commit f911d02, 2026-10-05) fits one vectorizer per field per
  request on the query plus every candidate's value, and a free-text query feeds
  the same string to title, abstract and keywords with no year, so its metadata
  score is at most 0.75. Fixed in the panel, the Engine page, the Walkthrough
  and Appendix B.4 (Chapter I/III and Appendix B's free-text paragraph were
  already right).
- The trace could not show MMR. `POST /api/recommendations/trace` now accepts
  `mmr_lambda` and `mmr_pool`; the panel shows the `rerank.mmr` event, the final
  order (taken from the returned results, which can include papers outside the
  relevance top-k) and a step-6 formula block when Diversify is on.
- Over-tracing: the panel's effect depended on an `inputs` object the pages
  rebuild every render, so four cosmetic layout toggles fired four extra full
  searches. It now depends on primitives (one trace per distinct query, seed,
  depth, MMR, pipeline, weights). Measured: 5 traces before, 1 after.
- Notation `|R| = top_k` is `|R| <= top_k`; the seed paper's exclusion is now
  stated; counts print as integers (`top_k = 10`, not `10.0000`); normalization
  rows list only the components in the pipeline; an unused label and the
  never-passed `children` prop were removed.
- Two errors of my own, caught by cross-checking: I had written the MMR cost as
  O(k·pool) (it is pool(pool-1)/2, measured 1,225 at pool 50) and the no-vector
  fallback similarity as 0 (it is the constant 1, as Appendix B.11 says).

## Engine: Dijkstra

New subsection under the similar-papers graph: the graph G = (V, E, w), edge
cost c = max(0, 1 - w), the algorithm as implemented (binary heap ordered by
(distance, paper id), lazy deletion, 1e-9 tolerance), the correctness argument,
the bound d(v) <= 1 - w(o, v) <= 1, the exact condition for an indirect route
(w1 + w2 > 1 + wd), determinism, and cost O((V + E) log V). The worked example
no longer lists a "B to C" path (the code only measures from the origin) and
gains a four-paper trace whose numbers were produced by the real function.
Complexity table: corrected MMR row, separate rows for graph weights and
Dijkstra. Changelog entries `engine-dijkstra` and `stats-for-nerds-checked`.

## Tests added

- `test/test_shortest_paths.py` (18 tests): worked example, indirect-route
  condition over a grid of weights, tie-breaking and edge-order independence,
  the 1e-9 tolerance both ways, non-negative clamp, unreachable nodes, and
  agreement with an independent Bellman-Ford on 300 random graphs (every path
  costs exactly its distance; distances at most 1 with the origin star).
- `test/test_mmr.py` (+3): the traced search returns the same results and events
  as the untraced one with and without MMR; the trace request validates its new
  fields. Backend suite: 235 tests OK (1 skip), up from 214.

## Thesis (`thesis-paper/`)

- Appendix B: B.4 corrected (per-field vectorizer, free-text cap of 0.75); B.8
  gains the full Dijkstra treatment with worked example and test reference;
  B.11 states the pool(pool-1)/2 cost; new B.15 documents the execution trace
  (every event, the request fields, the fidelity guarantee); intro updated and
  the `pipelineMath.ts` file name's casing fixed.
- Dijkstra (1959) added to Appendix B's references and to `references.bib`; DOI
  10.1007/BF01386390 and the record confirmed against Crossref on 2026-10-07.
- `audit-trail.md`: a dated entry recording the checks, the discrepancies, the
  tests and the items left alone.
- Left unchanged on purpose: `review-report.md` / `re-review-report.md` (they
  predate the 2026-10-05 code change and still say title-only for free text);
  Chapter III (word-budgeted, and its metadata description was already
  accurate); the corpus counts in Chapters I and III (168 papers, 145 valid, as
  of 2026-10-05; the live repository holds 171 and 150, which the in-app pages
  now use), to be refreshed when the study freezes its count.
- The compiled `ReSearch-thesis-proposal.docx` / `.pdf` were not regenerated and
  are older than these Markdown edits.

## Note for the menu-ribbon work (measured before it was handed over)

At 390 px wide the nav is an `overflow-x-auto` box 66 px wide holding 11 links
(scrollWidth 1171): none fully visible. In Researcher mode it overflows even at
1440 px (nav 789 px wide for 1,219 px of links), so a "does it fit" test works
better than a fixed breakpoint; the right-hand mode switch and theme picker add
width of their own below `sm`.

---

# Progress Log — Full-thesis LaTeX edition measured against the BulSU reference

Date: 2026-10-07. The Markdown thesis now compiles as a full university-format
edition: `thesis-paper/latex/`, built with `tectonic main.tex`, 78 pages
(title page, acknowledgment, abstract, 3-page table of contents, Chapters
I–III, the unified references, appendices A and B). The format reference is
the peer BulSU thesis `[THESIS][BSM CS 4A] Group III - Revised.pdf` (179 pp);
every page class was compared band-by-band at 100 dpi against it.

## What was added for this edition

- `thesis-paper/front-matter.md`: title page, acknowledgment (placeholder
  names), abstract with the keywords line, table of contents.
- `thesis-paper/references.md`: the unified 25-entry APA list (Chapter III's
  inline list was retired in favour of it).
- `latex/tools/md2tex.py`: front-matter, references-only and appendix jobs,
  per-file label namespacing, heading assertions.
- `latex/thesis-template.sty`: full-thesis styling — measured margins,
  italic running head with the chapter mark and an inset page number,
  chapter openers, centered abstract column, TOC styles, hanging-indent
  references, title page, appendix dividers.

## Format bugs found by the comparison, and fixed

- Running head showed the section name instead of the chapter mark
  (fancyhdr's article `\sectionmark` overwrites the chapter mark on every
  `\section`); both section marks are now gobbled, matching the reference,
  whose head always carries only the chapter title.
- `\vspace*` at the top of a fresh page added about a full line of space;
  removed from the title page and the chapter opener (first lines now sit
  exactly at the text top like the reference).
- The title page overflowed to a second page because `\setstretch{1.75}`
  multiplies the explicit `\fontsize` baselineskip; the page now switches
  to `\singlespacing` internally.
- The abstract column was left-aligned instead of centered (a minipage in
  vertical mode is not centered by `\centering`); it is now centered and
  measures 1.71–6.78 in against the reference's 1.69–6.77 in.
- The running-head page number sat flush at the text edge; inset by
  6.5 pt to match the reference (right edge 7.39 in in both).
- Duplicate hyperref `@page` anchors from the front-matter `gobble` page
  numbering removed with `pageanchor=false`.
- Fine calibration from the 100 dpi bands: top margin 1.03 in, `\headsep`
  21 pt, TOC entry leading 7.5 pt, +5 pt after front-matter headings,
  17 pt between the abstract heading and its first line, +2 pt after a
  chapter title, appendix divider 0.10 in higher.

## Verified result

Every measured band agrees with the reference within about 0.02 in: title
lines, standing blocks, CHAPTER/title/body spacing, body pitch 0.35 in,
running head, TOC, abstract column, references heading and first entry,
and the appendix divider. Remaining gaps are content-driven: the cover
title is three lines (blocks sit about 0.31 in lower than the reference's
two-line cover), the researcher block has three placeholder lines, and the
TOC runs to three pages because the study has 66 entries.

## Still needed from the owner

Researcher names, thesis adviser name, and the month/year for the title
page (all currently bracketed placeholders); the researcher line count of
three is a guess. No Chapter IV/V content exists (there is no data yet),
so the abstract describes the evaluation in the future tense. The cover
title's punctuation ("RE:SEARCH:" with colon) should be confirmed.

---

# Progress Log — Stats for Nerds: pseudocode removed, trace kept, Engine linked

Date: 2026-10-07. Reported: the Stats for Nerds panels should not reprint
the mathematical pseudocode; readers who want the how should be sent to
the Engine tab instead.

## What changed

- The shared card behind Stats for Nerds (Search, Repository, Arena, Lab)
  no longer renders the pseudocode listing. It keeps the full live
  computation trace — inputs, prepared query, candidates, per-component
  scores, normalization bounds, combination, ranking, the MMR re-order —
  and ends with a link: "Looking for the how? Every formula behind these
  numbers is explained in the Engine, with a worked example."
- `frontend/src/data/pipelineMath.ts` (the notation-to-ranking listing)
  deleted; nothing else referenced it. The card's pipeline label now
  comes from the pipeline config.
- Copy updated where it promised formulas in the panel: the Walkthrough's
  tab table, the four per-page context notes, TEMPEST's developer answer,
  and the component doc comments. In-app changelog entry added
  (`stats-trace-links-engine`).
- Appendix B of the thesis said the frontend "reproduces the core
  formulas in that panel (`frontend/src/data/pipelineMath.ts`)" and that
  the panel shows numbers flowing "through the formulas of this
  appendix"; both sentences now say the panel traces the numbers along
  the appendix's steps while the Engine explains the formulas. The
  LaTeX edition was regenerated.

## Verification

`npm run build` (typecheck + inline-script checks + vite build) passes;
`python3 tools/md2tex.py` + `tectonic main.tex` rebuilds the thesis.

---

# Progress Log — Drop zone: BibTeX, EndNote, RefMan, RefWorks (Google Scholar)

Date: 2026-10-07. Reported: the upload drop zone only worked for PDF and
BibTeX; EndNote, RefMan, and RefWorks exports came in neither as dragged
Google Scholar links nor as downloaded files.

## Root causes

- The frontend accepted only .pdf/.bib/.tex files; there was no RIS or
  EndNote parser anywhere.
- A dragged Scholar link always ended in an error message: the Chrome
  extension intercepts only scholar.bib links, and only on localhost:5173.
- RefWorks exports are RIS under the hood, so one RIS parser covers both.

## What changed

- `app/services/ris_enw_extraction.py`: RIS (RefMan/RefWorks) and EndNote
  (.enw) parsers with the same contract as the BibTeX parser; first-record
  semantics; multi-record splitting helpers.
- Backend: `/api/papers/preview` and the upload path accept .ris/.enw;
  `/api/papers/import-url` accepts scholar.bib/.enw/.ris links; new
  `POST /api/papers/scholar-fetch` proxies a Scholar export for the drop
  zone (no DB write — the normal preview → review → save flow follows).
- Frontend: drop zone and Browse accept .ris/.enw, multi-entry exports
  route through the per-entry navigator; dragging a Scholar link now
  imports (extension when installed, server fetch otherwise); copy and
  error messages updated.
- Extension (`research-scholar-extension`): intercepts scholar.bib/.enw/
  .ris drops and sends the format through to the app.
- Docs: Walkthrough endpoints table, changelog entry
  (`scholar-drop-all-formats`), Chapter III feature matrix + API surface,
  audit trail.

## Verification

10 new unit tests for both parsers (fields, first-record isolation,
no-ER records, DOI fallback, splitting); full backend suite 245 OK
(1 skip), up from 235. `npm run build` passes; `md2tex.py` + `tectonic`
regenerates the 78-page thesis.

---

# Progress Log — Search and Repository merged into one three-pane screen

Date: 2026-10-08. Requested: merge Search and Repository into one page,
using the supplied reference-manager mockup (toolbar, sidebar, document
table, detail inspector) as an inspiration for the LAYOUT only, rearranging
the app's own unique features into it. Reported afterwards: the descriptors
"Library" (the merged page) and "My Library" (the shortlist) were redundant;
the merged page keeps the name Repository.

## What changed (all in `frontend/src`)

- The Repository page is now the single browse-and-search screen in a
  reference-manager arrangement: filter console left, sortable document
  table middle, details inspector right. Draggable splitters and column
  sorting already existed; the inspector is now collapsible (persisted
  per browser), My Library folders show live counts, a Filter-by-authors
  list (top 12 of the current fetch) narrows the table, and a status bar
  under the panes reports scope/filters/author/search.
- The Search page's recommendation engine became a third scope in the
  filter console: Recommend (query + Top-K + Diversify/MMR + the six
  pipelines). Results render in the same table with rank, score, the
  TF-IDF/S-BERT/metadata signal bar, star and PDF markers, and feed the
  same details inspector. The home page search box now lands here and
  runs the query immediately.
- `/recommendations` redirects to `/repository`; the Search nav item was
  removed and `Recommendations.tsx` is no longer imported by the router.
- Copy updated where it described separate pages: walkthrough
  (OTHER_PAGES + the recommendations section), tips, help, home search.

## Verification

`npm run check` and `npm run build` pass. The JSX restructure was
balanced with a div-depth scan (no stray/unclosed wrappers).

## Flagged

- The walkthrough's static screenshots still show the old Search page
  (they are images; the URLs still resolve via the redirect).
- Recommendations.tsx is retained in the tree as the historical
  implementation but is not routed.

---

# Progress Log — Settings growth, Σ STATS pop-up, Algorithm bar, Engine flowcharts

Date: 2026-10-08. Requested (in sequence): (1) a Settings option to hide
the menu labels; (2) move the Library/Researcher mode switch into
Settings; (3) remove the top-bar MODE chip, replacing it with a universal
Stats-for-Nerds switch that shows statistics, the computations with the
Engine's formulas, and in-depth process interpretations; (4) generate
flowcharts in the Engine; (5) keep the algorithm controls visible in the
Repository; (6) make the custom-mix dials a pop-up so the layout never
shifts.

## What changed

- `state/layoutPrefs.tsx`: new `navLabels` preference (persisted with the
  pane preferences; presets preserve it). AppLayout renders nav labels or
  an accessible sr-only fallback.
- `Settings.tsx`: new Site mode section (Library/Researcher radios moved
  from the top bar, with explanations) and an Interface section with the
  menu-labels toggle; the footer now points to the section.
- `AppLayout.tsx`: removed the site-mode radiogroup and the MODE chip; new
  Σ STATS button (lucide Sigma) toggles a universal drawer.
- `state/statsDrawer.tsx` + `components/StatsDrawer.tsx`: global pop-up
  (fixed overlay, never affects layout) with three stacked parts —
  repository statistics (GET /api/papers/stats with subject bars), the
  live trace of the most recent published computation (search or Arena
  battle), and STATS_INSIGHTS: nine formula → plain-language → why
  entries in `data/statsInsights.ts`, plus an Engine link.
- Pages publish their computations: Repository publishes every Recommend
  run (query and seed), Arena publishes every local battle.
- `components/AlgorithmConsole.tsx`: always-visible Algorithm bar above
  the Repository panes — six preset chips, CUSTOM with a floating dial
  pop-up (sliders renormalizing to 100%, live S(d) formula; closes on
  outside click/Escape), and Top-K + Diversify in the Recommend scope.
  The old sidebar Pipeline list was removed (single source of control).
- Engine (`MathWalkthrough.tsx`): new "The process at a glance (flow)"
  section with three `FlowDiagram` SVG figures (pipeline end-to-end,
  metadata signals, Arena battle) in the page's white/ink style,
  registered in the TOC.
- Copy updated: tips (algorithm bar, stats switch), walkthrough captions
  and sections, Settings text.

## Verification

`npm run check` and `npm run build` pass. No layout-affecting inline
panels remain: the stats surface and the dial mix are both overlays.

## Flagged

- The walkthrough screenshot caption for Settings was updated, but the
  screenshot image itself still shows the old page.
- Tracks the changelog entries `settings-stats-algorithm` and
  `library-merge-three-pane` (in-app) and this progress entry; the thesis
  text was not changed (feature addresses — the app's own pages — remain
  accurate).

---

# Progress Log — My Library PRO (garden-unlocked research collection)

Date: 2026-10-08. Requested: turn My Library into a "pro version" using
the supplied Literature Collection mockup (library / dashboard / graph /
chat tabs) as the shape — unlocked after any tree in the Lab's garden
reaches a young level — with the chat tab left as a placeholder and the
rest mixed with the app's own features.

## What changed

- `data/knowledge.ts`: `treeStageIndex(fert, species)` — the seven-stage
  ladder (Seed…Ancient, 0..6). `state/sun.tsx`: `proUnlocked` computed
  from every planted species' bed (stage index ≥ 3 = Young: oak 1500,
  maple 1450, birch 1580, elm 1600, redwood 1350 fertilizer).
- `MyLibrary.tsx`: a PRO mode toggle in the page header appears once
  unlocked (persisted per browser); before that a locked badge shows the
  Young thresholds. PRO mode replaces the classic list with the new view.
- `MyLibraryPro.tsx`: four tabs — Library (search, pills, grid/list,
  multi-select, per-page sizes, chips, removal), Dashboard (KPIs incl.
  /api/papers/stats, five-year bins, subject bars, document types,
  most-cited, newest), Graph (paper picker + neighbor slider + the
  existing ConnectedPapersGraph with an info rail), Chat (labeled
  placeholder, disabled ask box and question chips, per request).

## Verification

`npm run check` and `npm run build` pass. Changelog entry
`my-library-pro`; the nav-library tip describes the unlock.

## Flagged

- The chat tab is intentionally static (requested); a file-upload/drop
  zone and notes blocks from the mockup were not carried over because
  the app has no file-attachment or collection-notes model yet.
- The unlock reads the garden state (localStorage) at render; growing a
  tree elsewhere then visiting My Library shows the toggle immediately.

---

# Progress Log — Temporary PRO override toggle (dev strip)

Date: 2026-10-08. Requested: a temporary toggle to test My Library PRO
for this run; to be removed when the feature improves. Implemented as a
dev toggle in the Lab's Sun Shop "Test wallet (temporary)" strip:
`state/sun.tsx` gains `proOverride` (persisted under
`paperrec_pro_override_temp`, forces `proUnlocked` on), exposed as
`PRO mode (temporary) — ON/OFF` in SunShop next to the existing temp
wallet buttons. Marked TEMPORARY in both files; remove the toggle, the
`proOverride` state, and `PRO_OVERRIDE_KEY` together with the Test
wallet strip before launch. Verified with `npm run check` + `npm run
build`.

---

# Progress Log — My Library unified (locked PRO tabs), drag-to-delete, pixel burst

Date: 2026-10-08. Requested: (1) restructure basic and PRO My Library so
they are the same layout with the other features locked; (2) make Browse
Repository a button, and the other buttons like it; (3) keep the
drag-to-pet delete mechanic in the collection; (4) add a pixel explosion
when an entry is deleted on the table itself.

## What changed

- MyLibrary.tsx is now a thin shell (load/refresh/error/empty/header);
  the proMode toggle is gone. The page always renders the collection.
- MyLibraryPro.tsx is THE layout (renamed role): four tabs. In basic
  form Dashboard/Graph/Chat show a lock and a LockedTab panel
  (description + Young-stage thresholds + Open the Lab's garden). The
  Library tab works identically for everyone.
- Buttons standardized: Browse Repository = the primary ui Button
  (header, empty state, graph tab); pagination/Clear = secondary;
  tabs/filters = bordered mono chips; grid/list = segmented lucide
  icons; row removal = bordered Trash2 icon buttons.
- Drag-to-delete restored on rows and cards (pet's
  application/x-research-paper payload + crumpled-ball drag ghost); the
  pet removes the paper and library-changed refreshes the page.
- New components/retro/PixelBurst.tsx + pixel-burst keyframes in
  index.css: a 16-square retro explosion at the delete button's
  coordinates; auto-cleared after ~650 ms.

## Verification

`npm run check` + `npm run build` pass. Changelog entry
`my-library-unified`.

## Flagged

- The classic page's right-click literature menu and batch citation
  export moved out with the classic view; if they are wanted back they
  belong on the Library tab as per-row/bulk actions.

---

# Progress Log — Research chat integrated (scoped retrieval + linked sources)

Date: 2026-10-08. Requested: integrate the Chat tab into My Library
PRO, reusing the similar-papers machinery for texts, with sources
linking back to the repo or the web. Found that a grounded chat engine
already existed (`app/services/research_chat.py`): retrieval ran the
recommendation pipeline (`run_search`), synthesis used Groq when a key
is configured, with an extractive fallback. What was missing = scopes,
source links, and the tab wiring.

## What changed

Backend:
- `search_service.search_papers` gained `paper_ids: list[int] | None`
  (narrowed candidate set in `_get_valid_candidates`) — collection-
  scoped retrieval reuses the same vector/TF-IDF/S-BERT machinery.
- `research_chat.py`: `scope` (repo | library | web) + `paper_ids`;
  web scope retrieves via the existing `search_web` service; sources
  are typed (`kind`, `doi`, `url`); evidence blocks, prompt and
  extractive fallback generalized to both kinds; empty-collection and
  empty-web short-circuits with honest messages.
- `test/test_research_chat.py`: 5 unit tests (fallback with sources,
  library paper_ids pass-through, empty-collection short-circuit, web
  mapping, empty web results). Suite: 250 tests OK (1 skip).

Frontend:
- `api.ts`: `researchChat` client + types (scope, paper_ids, history,
  typed sources).
- My Library PRO Chat tab is live: scope chips (Collection /
  Repository / Web), conversation with history (last 6 turns), suggested
  questions, busy state, fallback notice, and a Sources panel — repo
  sources: Open in library (viewer) + DOI link; web sources: landing
  page link + DOI. The Library tab's ask box is now a working shortcut
  (Enter → Chat tab + send) when unlocked.

## Verification

`npm run check` + `npm run build` pass; backend suite 250 OK. Changelog
entry `research-chat-live`.

## Flagged

- Without `GROQ_API_KEY` the answers are extractive (best-matching
  sentence per source) — deliberate, honest fallback, shown as a
  notice. With a key, Groq synthesizes from evidence only.
- The chat's "where they agree / contrast" sections from the mockup are
  not yet structured separately; the grounded answer + sources cover
  the same information.

---

# Progress Log — Groq key configured for the research chat

Date: 2026-10-08. The user supplied a Groq API key for the research
chat's synthesis layer (research_chat.py already read GROQ_API_KEY via
load_dotenv). The key was written to `.env` (gitignored; `.env.example`
templates the variable), verified against the Groq API with the default
model `openai/gpt-oss-120b`, and the full answer path was tested live:
fake retrieval + real Groq synthesis returned `used_fallback: False`
with a cited answer. One cosmetic fix: the model sometimes emits
full-width citation brackets （【1】） — the chat renderer normalizes
them to [1]. The key is a secret: do not commit `.env`, and rotate the
key if it leaks.

---

# Progress Log — Similar-papers graph upgrade (controls layer + side panel)

Date: 2026-10-08. Requested: implement the mockup's Graph-tab upgrades
from the earlier feasibility assessment, into the existing
ConnectedPapersGraph as an optional controls layer. All six items were
found unimplemented at the start of the session and are now in:

1. Edge-mode toggle — Similarity / Shared topics / Both. "Shared
   topics" is our honest stand-in for the mockup's "Contrast": edges
   derived from the real common_topics membership (star-hub when the
   group is larger than 10), drawn dashed and not filtered by the
   strength slider.
2. Minimum-strength slider 15–95% over the real weighted edges with a
   live "N similar edges ≥ X% · M topic links" summary.
3. Node size = citations, color = year gradient: similar-graph nodes
   now carry citation_count (backend addition in api.py node payloads;
   frontend type updated); radii are sqrt-scaled, idle fills lerp from
   light blue to ink over 1995→2026.
4. Cluster zones: faint blobs (fill + dashed stroke + label) computed
   from the laid-out positions of each common_topic group.
5. Legend extended in controls mode (dashed = shared topic, size =
   citations, year gradient bar).
6. Selected-paper side panel: details, Most similar % (edge weights),
   Shared topics with (real groups), Ask about this paper / Open in
   library actions wired in My Library PRO (ask → Chat tab with the
   question; open → Library tab).

Plumbing: controls/sidePanel/action props on ConnectedPapersGraph;
controls passthrough on ConnectionsWorkbench and ConnectionsPane;
enabled on My Library PRO's Graph tab (controls + side panel) and the
Repository Similar tab. Backend: +1 test asserting citation_count in
node payloads (251 tests OK). Verified: check + build pass; changelog
entry `similar-papers-graph-upgrade`.

---

# Progress Log — Chat: bounded thread, collapsible history rail, deletions

Date: 2026-10-08. Requested (chat tab): (1) a bounded, scrollable chat
box; (2) a collapsible chat-history list on the left; (3) deleting chat
history (per conversation and all).

## What changed (MyLibraryPro)

- Chat is now a real conversations model: `conversations[]` (id, title,
  updatedAt, messages) persisted in localStorage
  (`paperrec_library_chat_hist`, capped at 20), with an active
  conversation; titles default to the first question; `New chat` and
  the Library ask-box both create/route into conversations. Last 6
  turns form the grounding history per request.
- The thread is a bounded box (`h-[540px] overflow-y-auto`, auto-scroll
  to newest). Suggested questions and the ask box sit outside it.
- A collapsible History rail on the left (`paperrec_library_chat_sidebar`
  persisted): per-conversation rows (title, time, question count) with a
  per-row delete button, a `Delete all` action with confirm, collapse to
  a slim `»` rail, and an expand toggle.

Verified: `npm run check` + build pass. The bounded thread uses the same
rounded-3px retro box as the rest of the page.

---

# Progress Log — Floating graph panel: collapsible, scrollable, compact, theme-adaptive

Date: 2026-10-08. Requests on the similar-papers graph (My Library PRO
Graph tab): (1) fix spacing / let the graph fill the space; (2) float
the Selected paper panel over the canvas to maximize graph space;
(3) theme-adaptive colors; (4) make panel details collapsible; (5) make
Shared topics with scrollable; (6) shrink preview characters.

## What changed (ConnectedPapersGraph + MyLibraryPro)

- The trailing flex-column panel became a floating overlay inside the
  relative canvas (top-right, max-height, scrollable), with a close
  (✕) and an "Selected paper ▶" pill to reopen; `panelOpen` state
  added. The outer flex-wrap wrapper was removed so the SVG owns the
  full width, and MyLibraryPro passes `widened` (wide 900×520 canvas,
  unframed wrapper) so the graph fills the tab.
- Panel details: Abstract is a collapsible `<details>` (closed by
  default, 2-line clamp instead of 4); Most similar and Shared topics
  with are collapsible (open by default) with rotating chevrons;
  most-similar titles truncate; the shared-topics list scrolls inside
  `max-h-28`.
- Theme adaptivity: added accent/ink triplet resolvers (read the live
  CSS vars); the year gradient now lerps from a light accent tint to
  ink (nodes and the legend bar), zone blobs tint from the accent
  family instead of fixed hues, and topic edges use an accent-to-ink
  mix. Everything follows the active theme; the default palette is
  untouched.

Verified: `npm run check` + `npm run build` pass.

---

# Progress Log — Pop-up theming audit + RetroDialog sizes

Date: 2026-10-08. Requested: check that all pop-ups follow the theme,
make them inherit the design, and support small/medium/large sizes.

## Audit results

- PaperViewerModal, LiteratureMenu, StatsDrawer, the graph's floating
  panel, RetroDialog's card, scrim and buttons: already theme-driven
  (border-gray-900, bg-white/canvas/surface, ink/muted/accent).
- RetroDialog: header used a hardcoded brown gradient and the footer a
  fixed cream/near-black — neither followed the active theme.
- Four native window.confirm boxes (Repository ×3 deletions, My Library
  PRO delete-all history) were browser-styled, not themed.

## What changed

- RetroDialog: header now `bg-accent text-onAccent` (tracks the theme
  accent), footer `bg-canvas`; grew a `size` prop — sm
  `w-[min(92%,320px)]`, md `w-[min(92%,460px)]`, lg
  `w-[min(96%,720px)] max-h-[88vh]` with a scrollable content region.
- Sun Shop dialogs use sizes: purchase md (default), confirm sm,
  notice sm.
- Repository: one shared themed confirm (RetroDialog md, Delete/Cancel)
  backs the single-paper, PDF and batch deletions via askConfirm().
- My Library PRO: delete-all history uses a themed sm dialog.

Verified: `npm run check` + `npm run build` pass; no `window.confirm`
remains in the frontend.

---

# Progress Log — Browse Repository pop-up (mini-repository picker)

Date: 2026-10-08. Requested: the Browse Repository buttons on My
Library should open a pop-up — a mini version of the repository — and
return the chosen value instead of navigating away.

## What changed

- New `components/RepositoryPickerDialog.tsx`: a large themed
  RetroDialog containing a live mini-repository — debounced search
  over /api/papers (same endpoint the Repository tab uses), a
  scrollable result list (pixel titles, author · year · type, dark
  subject chip) with per-row Add buttons, busy states, and paging.
  Each pick calls the host's `onPick(paper)` — the pop-up returns the
  selected Paper.
- MyLibrary.tsx: the header and empty-state Browse Repository buttons
  no longer navigate; they open the picker, and `onPick` saves the
  chosen paper straight into the library (saveToLibrary; the central
  library-changed event refreshes the collection). The unused
  useNavigate was removed.

## Verification

`npm run check` + `npm run build` pass.

## Flagged

- The Graph tab's "Browse Repository" button still navigates to
  /repository — it is a context link there, not an add-to-library
  action.

---

# Progress Log — Graph papers menu, picker pick fix, Lab stats pane

Date: 2026-10-08. Requests: (1) fix the My Library picker — "can't pick
properly"; (2) replace the Graph tab's paper dropdown with a left menu
of loaded papers; clicking recomputes the graph; (3) the Lab's Stats
for Nerds did not connect to a query — separate it from the tabs and
make it a collapsible right-side pane.

## What changed

- RepositoryPickerDialog: the whole row is now clickable (pointer +
  hover highlight) with the Add button as a secondary affordance;
  busy rows dim.
- My Library PRO Graph tab: the "Paper" select is gone; a left Papers
  menu lists the loaded collection (scrollable, active highlight,
  pixel titles + year). Clicking a paper recomputes the graph
  (graphPaperId drives the ConnectedPapersGraph fetch); the Neighbors
  slider and Browse Repository button stay in the right column's
  toolbar.
- Lab: the Stats for Nerds tab was removed from the tab row (Lab now
  has Recipe | Garden). A Stats for Nerds toggle sits at the right of
  the tab row, opening a collapsible right-side pane (persisted,
  scrollable) WITH its own query box: type a query, press Enter, and
  the live trace runs against the current dial mix (usePipelineMode
  carries the Recipe bench's weights).

## Verification

`npm run check` + `npm run build` pass.

---

# Progress Log — Lab stats trace connected to the recipe dials

Date: 2026-10-08. Reported: the Lab's computation trace still doesn't
work with the Lab's queries. Root cause found: the Recipe bench kept
its dials in local state only — it never activated the shared
"custom" pipeline nor mirrored the mix into the shared customWeights.
The stats pane therefore traced whatever preset pipeline was shared
(weights ignored), so the trace never reflected the Lab's dials and
appeared broken.

## What changed (Lab.tsx)

- `usePipelineMode` is now used: moving a dial mirrors
  `normalizeDialPositions(dials)` into the shared customWeights;
  loading a saved recipe or the "learned weights (10/90/0)" preset
  activates the custom pipeline too (loadMix helper).
- Opening the stats pane activates pipeline="custom" and syncs the
  bench's mix into the shared state, so every trace runs the
  Recipe bench's exact weights.
- Verified the custom trace end-to-end against the backend (w_*
  fields → normalized weights in the input event; previously only the
  request shape was in doubt — the client mapping was already
  correct).

## Verification

`npm run check` + `npm run build` pass.

---

# Progress Log — Lab stats trace recomputes live like the Arena

Date: 2026-10-08. Reported: in the Arena, Stats for Nerds recomputes at
every query, but the Lab pane needed a submit. Cause: the Arena binds
its trace inputs directly to the live query state (PipelineMath's
effect re-traces after a 350ms debounce), while the Lab pane gated the
run behind an Enter press (statsRun). Fix: the pane now passes the
query state straight into StatsForNerds (`inputs={query.trim() ?
{keyword, query, topK:10} : null}`), so the trace recomputes as you
type — matching the Arena exactly. Verified with check + build.

---

# Progress Log — Lab stats trace binds to the Lab's own query (dead box removed)

Date: 2026-10-08. Reported: the Lab's Stats for Nerds still doesn't
work properly; fix the dead code there. Cause: the Lab already owns a
battle query + Top-K state, but the stats pane had its own separate
query input (dead/redundant UI) — the Arena works because it binds its
stats inputs to its own live query. Fix: removed the pane's private
search box and statsQuery state; the pace now receives
`inputs={query.trim() ? {mode:"keyword", query, topK} : null}` straight
from the Lab's battle query and Top-K, so the trace recomputes live as
they change (debounced), through the Recipe bench dials (custom
pipeline). Verified with check + build.

---

# Progress Log — Lab Stats for Nerds as a pop-up

Date: 2026-10-08. Requested: convert the Lab's Stats for Nerds into a
pop-up like the repository picker. The right-side collapsible pane was
replaced by a large themed RetroDialog (size lg, scrollable content,
Close button) on the same statsOpen toggle; the trace keeps binding to
the Lab's query/Top-K through the recipe dials (custom pipeline).
Verified with check + build.

---

# Progress Log — Dialog scrolling enabled

Date: 2026-10-08. Reported: enable scrolling (in the new stats pop-up).
Cause: RetroDialog's scroll-freeze blocked wheel/touch globally while
open (preventDefault on every wheel event), which also froze the
dialog's own scrollable content (large pop-ups like the stats trace or
the repository picker could not scroll). Fix: the freeze now skips
events originating inside the dialog's [role='dialog'], so the page
behind stays locked while the pop-up's own areas scroll. Verified with
check + build.

---

# Progress Log — Upload: manual BibTeX pop-up + DROP HERE ghost

Date: 2026-10-08. Requests: (1) the "paste BibTeX manually" entry on
Upload should be a pop-up; (2) add a "DROP HERE" ghost interaction over
the upload hotspot when a file or link is dragged, with a crumpled-
paper graphic.

## What changed (Upload.tsx)

- Manual BibTeX: the inline expandable panel became a themed RetroDialog
  pop-up (lg) opened by the Paste BibTeX manually button; the workflow
  copy now says "click Paste BibTeX manually to open the pop-up".
  Parsing closes the pop-up and feeds the review navigator as before.
- Drop zone: drag enter/over/leave tracking (with relatedTarget-aware
  leave) classifies the hovering payload as "file" (dataTransfer
  types include Files) or "link" (uri-list/plain text) and shows a
  ghost overlay while hovering: the crumpled-paper graphic
  (crumpledBallDataURL), a blinking pixel "DROP HERE", and a release
  caption (import the file / import the citation link). The overlay is
  pointer-events-none so clicks still open the file dialog; dropping
  clears it and runs the normal flow.

## Verification

`npm run check` + `npm run build` pass.

---

# Progress Log — Arena: battlegrid/scores/records visible by default, Lab-inspired

Date: 2026-10-08. Requests: battlegrid, scores, and records should be
visible in the Arena by default and the layout should adapt after the
battle; pixelify fonts; draw layout inspiration from the Lab.

## What changed (Evaluation.tsx)

- The results area renders ALWAYS (no full empty-state swap): the
  result rail is visible from the start with **Battle grid** as the
  default tab, a dashed pre-battle placeholder card fills the panel
  area ("Run the first battle"), and opening Records already shows
  the tallied history (records load on mount). After a battle the
  same layout fills in — grid, scores, consensus, pairwise, winner,
  interpretation — "adapts".
- Panel guards were hardened (battle?.winner / battle && …) so no
  panel crashes pre-battle.
- Lab-inspired/Lab-consistent look: the query bar card was restyled
  from the navy/gold bootstrap-era tokens to the white/ink bordered
  cards and mono chips used across the Lab, the depth/sort selects
  match, and the result rail labels and panel headers are pixelified
  (font-pixelify), like the Lab's chrome.

## Verification

`npm run check` + `npm run build` pass.

---

# Progress Log — Garden menu: duplicate sun removed

Date: 2026-10-08. Reported: two suns in the garden's menu. The Growth
points chip and the Sun-shop button both showed a SunGlyph side by
side. Fix: the growth-points chip now shows a Sprout glyph (lucide),
keeping the sun icon on the Sun-shop button (and the TokenGlyph on the
skins button). Verified with check + build.

---

# Progress Log — Garden shop as a pop-up

Date: 2026-10-08. Requested: convert the shop into a pop-up. The Sun
shop / Tree skins / Token wallet were sidebar panes inside the Tree of
Knowledge; they now open in a themed RetroDialog pop-up (lg) driven by
the same menu state (tab-aware title: Sun shop / Tree skins / Token
wallet), with the sidebar falling back to Tree info while the pop-up is
open (and Theme shop stays in the sidebar). The sidebar's header chips
were removed (the menu bar already shows sun/token balances).
Verified with check + build.

---

# Progress Log — Garden: Tree info floats bottom-left, full-width tree, hover shop

Date: 2026-10-08. Requested: (1) Tree info lives near the seed span
flexbox, bottom left; (2) everything shop-ish is a pop-up; (3) the
vacated space goes to the tree window; (4) the shop pop-up autohides
and appears on hover.

## What changed (TreeOfKnowledge)

- Removed the right sidebar entirely: the garden grid is now a single
  full-width tree window.
- Tree info is a floating, collapsible card (default open) pinned to
  the bottom-left of the tree stage, with the species name/stage/fact,
  Get info expansion, learned count, research and trunk knowledge —
  the "Tree info" header collapses it.
- Sun shop / Tree skins / Token wallet (SunShop) remain in their
  pop-up; Theme shop also became a pop-up (opened from the skins
  dialog's tab).
- The shop pop-up now appears on hover over its menu-bar buttons
  (140ms) and auto-hides when the pointer leaves the buttons and the
  pop-up (380ms), with the click toggle still working.

## Verification

`npm run check` + `npm run build` pass. The immersive drawer modes
still reference the old sidebar; the shop pop-up overrides them there.

---

# Progress Log — Hover-pop-up fix, tree-token fertilizer economy, hold badge

Date: 2026-10-08.

## Hover pop-up bug (fixed at the source)

The shop pop-up opened on hover, then instantly died: the pop-up's
scrim (z-70, covering the whole app box) slid in UNDER the cursor —
the trigger button fired mouseleave, the 380 ms close timer ran, and
the pop-up vanished without any pointer movement. On top of that,
RetroDialog seated keyboard focus into the hover-opened pop-up and
restored focus to the trigger on close.

Fixes (RetroDialog, shared by every pop-up):
- The scrim is now `pointer-events-none`; the dialog card keeps
  `pointer-events-auto`. Hover passes through the scrim, so trigger
  buttons no longer "leave" when the pop-up opens.
- Outside-click close moved from the overlay's onMouseDown to a
  document-level pointerdown listener that tests the card ref.
- New `focusOnOpen` prop (default true). The garden's shop pop-up
  passes `false`: no focus seating on hover-open, no focus yank on
  close.

Verified by inspection of the event flow; `npm run check` + build
pass with the button+popup hover-keep timers unchanged.

## Fertilizer economy: hold badge + tree tokens

- Purchases never fertilize the tree anymore: every purchase
  (shop scales) credits `fertilizerHold` — the new badge counter on
  the garden menu bar (fertilizer bag icon + count).
- The badge is a pointer-capture drag: drag right ~30/90/150 px to
  apply 1×/2×/10× from the hold onto the tree (with a live tier
  label). No hold left → the tree says so.
- Replaced the gems currency with the existing tree-token wallet:
  scales alternate sun/cheap-tokens: 10×=200 sun, 20×=100 tokens,
  100×=2000 sun, 1000×=5000 tokens, 10000×=200,000 sun.
- Shop shows balance chips (sun / tree tokens / hold) and the old
  pack grid + drag-a-pack-to-feed flow were removed (drop target and
  feedTree gone; the badge drag replaces them).

## Menu bar re-arrangement (2026-10-08)

The fertilizer control was a two-row stack (badge on top, 1×/2×/10×
selector under it) that made the bar ~2× taller than its chips and
visually broke the row; the species bank additionally had a nested
overflow-x-auto scroll inside the bar's own scroll.

Now: the fertilizer badge and the amount selector form ONE compact
horizontal unit (bag icon + hold count, divider, 1×/2×/10× buttons)
inside a single bordered chip the same height as the sun/tokens
chips. The species picker's nested scroll is gone — the bar scrolls
once. Verified: npm run check + build.

## Tree viewer: pan/climb/zoom removed (2026-10-08)

The pixel tree once unlocked a viewer at the Mature stage: drag to
pan, wheel to climb along the tree, and 1x-2x wheel/ctrl zoom with a
"climb · drag to pan" chip. All of it is gone per request:

- The canvas no longer traps pointer events (no drag-pan, no
  pointer-capture) — plain clicks still call onTreeClick (opens the
  speech bubble).
- No wheel handling at all: no zoom while the pointer is over the
  tree, no pinch/ctrl zoom, no climb scroll.
- The viewer chip is removed; the cursor is a plain pointer.
- The blit keeps its dormant 1x/0/0 view state so drawing math is
  unchanged; the stage-chip "recentre" bump remains a no-op-safe.

Verified: npm run check + build.

## Tree skins + seed bank: garden-style pixel art (2026-10-08)

The Tree skins pane (and the menu-bar seed bank) showed the soft
SVG KnowledgeTree miniatures. They now use the garden's own pixel
art via a new shared `PixelSprite` component (PixelGrowthTree at a
small whole-art scale inside the same dark stage frame the garden
renders in) — every species card shows its real pixel tree at full
growth. Locked species still show the lock. Verified check + build.

## Sun shop pop-up restructured; Theme shop lives inside it again (2026-10-08)

The pop-up is now one place for everything the tree sells: a rail of
tabs (Sun shop / Tree skins / Theme shop / Wallet) rendered INSIDE
the pop-up — with the toolbar tab buttons above the scrolling pane.
The Theme shop was stranded when the right sidebar was deleted: the
only entry point (menu === "themes") was orphaned and nothing opened
it. It is now a pane of the Sun shop pop-up (garden's themes passed
through, purchases whisper into the tree); the standalone Theme shop
pop-up was deleted. Order: shop, skins, themes, wallet (ArrowLeft/
Right switches). Verified check + build.

## Tree card snapshots: transparent bg + young trees (2026-10-08)

PixelSprite (Tree skins cards + seed bank) no longer paints the dark
garden stage behind the art: the frame background is transparent, so
the card shows through. Each species snapshot now renders its YOUNG
tree instead of the ancient one — the Sapling stage from the
species' own stage-fert thresholds (e.g., oak 950/3000, redwood
850/3000) — so the cards read as little young trees. Verified check
+ build.

## Tree card snapshots: frozen (2026-10-08)

PixelGrowthTree gained a `static` prop: paint one frame at the given
growth and stop — no growth replay from the acorn, no rAF loop, no
idle sway/leaf motion. PixelSprite passes `static`, so the young-tree
cards are true snapshots (one drawn frame), while the garden's real
tree keeps animating. Verified check + build.

## Cheats: pop-up when not unlocked yet (2026-10-08)

Cheat redemption now distinguishes success from refusal in the UI:
typing or arming a cheat the tree has not grown wise enough for
(redeemCheat ok:false with "not grown wise enough" text) opens the
themed notice pop-up with the message instead of whispering it
silently into the tree bubble — so "I can type cheats anytime" can
no longer fail invisibly. Successes still whisper. Verified check +
build.

## Sky friends at Mature+: drifting clouds + resting birds (2026-10-08)

PixelGrowthTree's renderer gains two mature-stage ambients (both
gated on the species' own Mature threshold, SPECIES_STAGE_FERT[4]):

- Clouds: three seeded puffs that drift across the sky band,
  alpha-blended (semi-transparent) so every backdrop theme shows
  through, painted BEFORE the canopy so they pass behind the crown;
  they wrap around the frame.
- Birds: up to three perched on the canopy's top leaves (the
  highest leaves born by Mature), hopping to a fresh leaf every
  ~2.4 s, wing-flicking on their own phase, with a soft shadow.
  Painted last, so they sit ON the tree.

Both respect prefers-reduced-motion (static, no drift/flap) and are
skipped on young snapshots (g < matureG). Verified check + build.

## Persistent garden animation + gradual level fades (2026-10-08)

PAUSE FIX — GardenBackdrop's effect deps included `parallax`, which
ticks at ~60fps while the tree morphs (every fertilizer/stage change
runs a 900ms rAF tween). Each tick RESTARTED the backdrop effect:
the loop was torn down, rebuilt, and its first tick skipped (30fps
cap gate), so the sky's own animation (clouds, fireflies, sun
shimmer) stuttered/paused every time the tree grew. parallax now
flows through a ref (parallaxRef), the loop reads it live, and the
deps no longer include it — the backdrop animation is persistent
through growth.

GRADUAL ELEMENTS — new elements/particles per level fade in (and
out) instead of popping:
- Leaves: birth fade over ~0.055 growth after each leaf's own
  threshold (crown grows gradually, per level).
- Pollen dust (SP): fades in over 0.06 growth after birth.
- Clouds: fade in on the Mature arrival (0.06) and fade out while
  crossing the frame edges (26px margins) — they never pop on/off.
- Birds: fade in at Mature and fade out just before each hop to a
  fresh perch (0.3s in-settle / 0.3s out), with their shadow.
- All fades use a fast path (opaque put) once fade >= 1. Reduced
  motion: static, no hop/edge fades.

Verified: npm run check + build.
