# Audit Trail — Re:Search Thesis Draft (Chapters I–III)

This file preserves the provenance and verification material that was
removed from the chapter files before submission (per the Round-2
re-review recommendation). It is NOT part of the manuscript; keep it in
the project, not in the submitted proposal.

## Tense policy

Chapters use thesis proposal voice: future tense for planned study
actions (development steps, the Arena campaign, hypothesis assessment);
present tense for the already-built prototype's actual behavior (the
system runs six pipelines today); past tense for completed development
work. The final revision pass (2026-10-01) moved the remaining
present-tense study-action statements into the future tense.

## Chapter I — source notes

1. Corpus count verified from the local SQLite database
   (app/data/academic_repository.db): 168 records and 146 valid for
   recommendation at the time of writing; the earlier approximate figure
   of 77 reflects an earlier repository state and is superseded.
   Duplicate records (six title groups) remain a pending data-quality
   concern.
2. In-text citations are limited to the eight approved sources.
3. Brand, weights, Arena metrics, and tie-break rules were read from the
   codebase.

## Chapter II — source verification record

SOURCES INCLUDED (n = 21). All 21 sources in references.bib are cited in
the chapter; zero orphans in either direction. The ten required classics
are included and individually verified; eleven additional sources were
located and verified for the chapter.

Metadata verification performed:
- Bai et al. (2019), IEEE Access: Crossref confirms authors Xiaomei Bai,
  Mengyang Wang, Ivan Lee, Zhuo Yang, Xiangjie Kong, and Feng Xia, and
  the DOI 10.1109/ACCESS.2018.2890388. The original brief's DOI
  (10.1109/ACCESS.2019.2922158) resolves to nothing (404) and its listed
  author "Gievska, I." does not appear in the Crossref record; the
  verified DOI and author list are used.
- Reimers & Gurevych (2019): ACL Anthology confirms pages 3980–3990 for
  D19-1410 (the brief listed 3982–3992); verified pages used.
- Lops et al. (2011) and Ricci et al. (2011): Springer chapters
  published online 2010 within the 2011 Recommender Systems Handbook;
  cited as 2011, consistent with the book issue and the brief.
- Beel et al. (2016): online 2015, journal issue 17(4), 305–338 (2016);
  cited as 2016 per the journal issue and the brief.
- Herlocker et al. (2004): ACM TOIS 22(1), 5–53, DOI 10.1145/963770.963772
  (verified via ACM DL and the University of Minnesota research portal).
- Shani & Gunawardana (2011): Recommender Systems Handbook pp. 257–297,
  DOI 10.1007/978-0-387-85820-3_8 (verified via Crossref).
- Cohan et al. (2020): ACL 2020 pp. 2270–2282,
  DOI 10.18653/v1/2020.acl-main.207 (verified via ACL Anthology).
- Bhagavatula et al. (2018): NAACL-HLT 2018 pp. 238–251,
  DOI 10.18653/v1/N18-1022 (verified via ACL Anthology).
- Ostendorff et al. (2022): EMNLP 2022 pp. 11670–11688,
  DOI 10.18653/v1/2022.emnlp-main.802 (verified via ACL Anthology).
- Kang et al. (2024): EMNLP 2024 pp. 7169–7184,
  DOI 10.18653/v1/2024.emnlp-main.407 (verified via ACL Anthology and
  arXiv).
- Thakur et al. (2021): BEIR, NeurIPS Datasets and Benchmarks Track 2021
  (verified via arXiv 2104.08663 and the NeurIPS proceedings page).
- Polignano et al. (2021): RecSys '21 pp. 187–198,
  DOI 10.1145/3460231.3474272 (verified via ACM DL and the RecSys 2021
  accepted-contributions list).
- Kreutz & Schenkel (2022): International Journal on Digital Libraries
  23(4), 335–369, DOI 10.1007/s00799-022-00339-w (verified via PMC full
  text).
- Robertson & Zaragoza (2009): Foundations and Trends in Information
  Retrieval 3(4), 333–389, DOI 10.1561/1500000019 (verified via ACM DL).
- De la Cruz & Diesta (2019): Philippine E-Journals record, LCC Faculty
  Research Journal 13(1) (verified via the journal article page
  https://ejournals.ph/article.php?id=18808).

SOURCES DROPPED FOR METADATA FAILURE: none (0). The brief's Bai et al.
DOI and "Gievska" author were corrected, not dropped. Candidates
considered and excluded as unverified: no Philippine study of a
content-based or hybrid thesis/paper recommender could be verified
despite multiple searches of Philippine E-Journals and Philippine
journal archives; the single verified Philippine study (thesis citation
system, Lipa City Colleges) is included and described accurately as a
documentation system.

LOCAL STUDIES NOTE: the "Local Studies" subsection contains one verified
Philippine study (De la Cruz & Diesta, 2019). The chapter states plainly
that no Philippine recommender study could be verified; no placeholder
or inferred source was invented to fill the subsection.

## Chapter III — chapter note

Chapter III written for the Re:Search study (hybrid content-based
recommendation pipelines: TF-IDF, S-BERT, metadata). Sections: Research
Design (descriptive-developmental; offline evaluation precedent);
Research Locale (Bulacan State University, Malolos; local single-machine
operation); System Framework and Features (Table 1 feature matrix;
Table 2 pipeline weight configurations; metadata formula and
weighted-combination formula; Figure 1 ASCII system architecture);
Process of Developing the System (Planning, Approach in Development,
Requirement Analysis, Design, Development with uncaptioned tech-stack
table, Testing); System Evaluation (Evaluation Instrument: Arena
Protocol; Data Collection; Data Processing and Analysis with Table 3
metrics); Ethical Considerations; Limitations of the Method; References.

Cited sources n = 5, all from the approved list: Salton & Buckley
(1988); Lops et al. (2011); Burke (2002); Adomavicius & Tuzhilin (2005);
Reimers & Gurevych (2019). Corpus count verified against the live
database (168 papers; 146 valid for recommendation) on 2026-10-01.
Numbered tables: Table 1 feature matrix; Table 2 pipeline weight
configurations; Table 3 evaluation metrics. The technology-stack table
is intentionally left uncaptioned so numbered tables run 1–3. Figure 1
is an ASCII architecture diagram replacing the template's placeholder.

## Round-3 revision log (2026-10-01)

Per the Round-2 re-review (thesis-paper/re-review-report.md), the
following Minor items were applied:

1. Stratification operationalized in Data Processing and Analysis
   (overall + per query type + per subject class where counts allow).
2. "Descriptive interpretation only" sentence added (no accept/reject
   language; statistics describe observed differences).
3. Ch1 "trust" claim aligned with the agreement-internal scope; winner
   metric's agreement-breadth caveat added in Ch3.
4. "Test the following hypotheses" → "examine the following hypotheses
   descriptively" in Ch1 and Ch2.
5. Campaign pinned: 36 runs (six largest subject classifications × one
   query + one seed paper × top_k 5/10/15), with the corpus's
   subject-class composition recorded before collection. Subject-class
   counts at the time of writing: Machine Learning 100, Mathematical
   Analysis 20, Mathematical Modeling 15, Graph Theory 13, Linear
   Algebra 10, NULL 6, Information Retrieval 3, Algorithms 1.
6. HTML audit/verification blocks stripped from all three chapters;
   visible AI-Assisted Research Disclosure sections added; full
   provenance preserved in this file.
7. Human evaluation deferral made explicit in Limitations #3.

## Methodology math added to Chapter III (2026-10-01)

The mathematical specification was folded into Chapter III's System
Framework and Features (per user request, not a review item): TF-IDF
component math (smoothed IDF, L2 normalization, request-time cosine),
S-BERT embedding cosine formula, the six expanded S(d) formulas of
Table 2's configurations, and the similar-papers graph methodology
(blended edge weight with the 0.15 author-overlap bonus, minimum edge
weight 0.15, Dijkstra shortest paths with hop cost 1 − w, shared
author/topic groups). Appendix B remains the complete specification;
Chapter III carries the core formulas. Compiled artifacts regenerated
(31 pages).

## Appendix B addition (2026-10-01)

`appendix-b-recommendation-math.md` added: the mathematical specification of
the recommendation pipelines (notation, text preparation, TF-IDF, S-BERT,
metadata components, normalization, Table B-1 six configurations with exact
S(d) formulas, ranking rule) and the similar-papers graph (node set, blended
edge weight with 0.15 author-overlap bonus, edge threshold 0.15, Dijkstra
shortest paths with hop cost 1 − w, shared author/topic groups). Formulas
verified against `app/services/recommendation/*.py`,
`app/services/connected_graph.py`, and `frontend/src/data/pipelinemath.ts`.
Cross-referenced from Chapter III (System Framework and Features). Compiled
artifacts regenerated (27 pages).

## Algorithm extensions documented (2026-10-05)

Implemented post-proposal algorithm work was folded into the proposal in
this pass (not a review item). Appendix B gains Sections B.9 through B.14:
BM25/FTS5 ranked repository search, precomputed NumPy scoring matrices,
MMR diversification, the offline fusion-weight learner, OpenAlex
bibliographic coupling and co-citation, and the offline precision, recall,
MRR, MAP, and NDCG metrics. Each section's formulas were checked against
the implementing modules (`app/services/fts_search.py`,
`app/services/recommendation/{vector_index,mmr,learned_weights}.py`,
`app/services/citations.py`, `app/services/evaluation/metrics.py`) and
cross-referenced from Chapter III. Appendix B also gained an APA 7
reference list for its six cited sources.

Chapter corrections in the same pass: Chapter III's feature matrix gained
the new capabilities; the metadata query-type description and the
similar-papers graph formula now match the code (free-text queries feed
the title, abstract, and keywords signals; graph edges carry the 0.25
citation bonus and report shared reference/citer groups); the tech-stack
table lists SQLite FTS5 and unittest; and the testing paragraph describes
the 133-test unittest suite. Chapter II's "fixed and transparent rather
than learned" sentence now notes the offline learner, and Chapter I's two
free-text metadata disclosures were corrected the same way.

Data correction: paper 1's DOI (`10.7717/peerj-cs.2010/fig-3`) was a PeerJ
figure DOI belonging to a different article (Crossref confirms the figure
record's title); the unverifiable DOI was cleared, and the citation
refresh now reports `no_doi` for that record.

references.bib grew from 21 to 25 entries: four appendix-only additions
(Carbonell & Goldstein, 1998; Kessler, 1963; Small, 1973; Järvelin &
Kekäläinen, 2002), each DOI re-verified against Crossref on 2026-10-05.

Verification: `python -m unittest discover -s test` ran 133 tests, OK
(1 skip for a missing FTS5 build); Chapter I's word-count gauge is
unchanged, Chapter II is within target, and Chapter III grew about 26
words by the same gauge (roughly 3,007 by the review's counter, about 7
over the 3,000 target). Known residual drift, pre-existing and not
addressed in this pass: the corpus-size statements in Chapter I (lines 32
and 102) and Chapter III (lines 221 and 248) still say 168 papers / 146
valid while the live database holds 180 papers / 154 valid. Compiled
artifacts regenerated from the Markdown sources with pandoc and
LibreOffice (32 to 37 pages).

## Dial synchronization and accuracy follow-up (2026-10-05)

The custom-pipeline dials were made self-balancing in the frontend
(`pipelineConfigs.adjustDialAllocation`): moving one dial rebalances the
other two so the three positions always sum to 100, legacy allocations
restored from localStorage are snapped to integer positions on load, and
the Lab sliders use the same rule. The displayed percentages are now the
same numbers the backend receives, instead of raw positions that were
silently normalized and could disagree with the readout. The Repository
similarity sort now forwards the dial allocation for the custom pipeline
(previously the request was rejected with a 400 and the sort silently
fell back). Backend `build_custom_weights` is unchanged and still
normalizes and validates, so the API math is identical.

Verified with a headless-browser check against the running frontend: a
legacy stored 40/40/40 allocation loads as 33/33/34, two ArrowDown
presses on TF-IDF produce 29/35/36, the readout matches the dial
positions, and no console errors occur. Also re-verified that the custom
allocation reproduces the matching presets exactly (40/40/20 equals
tfidf_sbert_metadata; 50/50/0 equals tfidf_sbert).

The same-day pass dropped the unverifiable Vitest/React Testing Library
claim from the Chapter III tech-stack table and testing paragraph: the
repository contains no frontend test files and `package.json` has no test
script; frontend verification is the type checker plus the Vite
production build (`npm run check` / `npm run build`). Compiled artifacts
regenerated again after this correction.

## Search result quality pass (2026-10-05)

Repository search now defaults to BM25 relevance ranking in the UI
(without a search term it still falls back to date order), snippets are
highlighted, and near-duplicate records are collapsed out of relevance
result lists. The collapse rule is exact normalized-title equality at any
length, or title similarity at or above 0.85 when both titles are at
least twelve characters; the same guard now protects ingest duplicate
rejection and merge grouping because dry-run review caught garbled OCR
titles (`]OC.htam[` vs `]AN.htam[`, different arXiv categories) being
grouped as duplicates.

The repository's duplicate records were merged: eight groups, 180 to 168
papers, twelve duplicate rows removed, 391 colliding citation rows
deduplicated, twelve orphaned stored files left on disk, backup kept at
/tmp/backup_before_merge.db. Master selection prefers a stored PDF, a
valid record, a non-preprint DOI (a published record beats an arXiv or
Preprints.org twin), metadata completeness, citation count, then the
smallest id. The recommendation index was rebuilt afterwards and the FTS
index is trigger-synced (168 rows).

Ranking tuning used a real qrels built from 27 inter-local citation
links (18 seed queries via OpenAlex, cached under /tmp). Learned fusion
weights are tfidf 0.1 / sbert 0.9 / metadata 0.0: +0.0603 NDCG@10 over
the 0.4/0.4/0.2 baseline on the full set and +0.039 on a held-out half
(0.4313 vs 0.3920). They are persisted to app/data/learned_weights.json;
the deployed preset remains the documented 0.4/0.4/0.2 pending an
explicit decision, because changing it rewrites the study's controlled
configuration. MMR was measured on the same qrels: lambda 0.7 trades
0.021 NDCG@10 for +0.045 diversity, so it remains opt-in. Per-result
weighted component contributions now accompany each recommendation and
are shown as a signal bar on the result cards; the three values sum to
the reported score. Corpus counts in Chapter I (two places) and Chapter
III (two places) were updated to 168 papers / 145 valid for
recommendation.

## Tree of Knowledge (2026-10-05, supersedes two experiments)

Two experimental features were implemented and then removed the same
day. The random-walk rerank (personalized PageRank over the similarity
graph) reduced relevance on the 18-query OpenAlex qrels at every blend
(NDCG@10 0.4811 off vs 0.4537 at lambda 0.1 and 0.3950 at 0.5), and
the Markov lore generator produced word-salad sentences; both were
deleted (random_walk.py, test_random_walk.py, markov.ts,
walkthroughCorpus.ts, extract-docs-corpus.mjs, plus the walk query
parameters and checkbox). The help matcher's whole-word fix stays.

The pet's LORE mechanic is now the Tree of Knowledge: a stored trivia
bank (frontend/src/data/trivia.ts, 48 facts across four tiers, every
entry checked against the code and the Walkthrough/Engine pages)
handed out one per press. The tree grows with real progress — each
treasure, each achievement, and every fourth discovered tip — through
four stages (Seed, Sprout, Sapling, Elder Tree), shown in the Lab's
Tree of Knowledge tab — a Plants-vs-Zombies-style lawn with a species
seed bank, the planted tree's own speech bubble, and an Ask the tree
button; the pet chat is a pure help library again (the LORE quick
question was removed). knowledge.ts keeps the
growth and handout logic pure and deterministic: deepest unseen tier
first, then an order-preserving rotation, so presses never repeat
back-to-back and nothing is generated. Verification: a logic suite
over 40 simulated presses per stage (no tier violations, no
back-to-back repeats, full first-cycle coverage) and a headless
browser run (the default unlocked profile starts at Sprout; hunt
completion reaches Elder Tree; each LORE press stores the next
trivia). The species picker (Oak, Birch, Elm, Redwood) is cosmetic and persisted per browser. A third Lab tab, the Sun Shop, adds a play-earned currency: sun from the daily visit, petting and questions (daily-capped), treasures, achievements and tip milestones; fertilizer packs (1/5/10 at 20/90/160 sun) add 2 growth points and 30 feet per packet, and every feeding dispenses stored wisdom — a typed cheat word (daisies at 100 ft, dance at 500 ft, pinata at 1000 ft) or the next garden tip in rotation. Cheats arm real pet effects: daisy and candy bursts when a paper is disposed, and a dance hop. The backend suite is 181 tests (the 32 random-walk tests
were removed with the feature); the frontend build passes.

## Stats for Nerds and shortest-path verification (2026-10-07)

The Stats for Nerds code (`frontend/src/data/pipelineMath.ts`,
`PipelineMath.tsx`, `StatsForNerds.tsx`, the trace service and route) and the
in-app Engine page were checked formula by formula against the implementing
modules (`search_service.py`, `similarity.py`, `metadata_pipeline.py`,
`text_preparation.py`, `mmr.py`, `connected_graph.py`). Text preparation, the
smoothed-IDF and cosine formulas, min-max normalization (including the
all-equal and all-zero case mapping every paper to 1.0), the weighted
combination, the metadata year term, and the ranking tie-breaks matched.

Discrepancies found and corrected. (1) The metadata component was described
as a pairwise vectorizer fitted on the two texts. The 2026-10-05 engine
hardening (commit f911d02) replaced that with one vectorizer per field per
request, fitted on the query plus every candidate's value of the field, and
made a free-text query supply the same string to the title, abstract, and
keywords signals; Appendix B.4, the in-app math panel, the Engine page and
the Walkthrough still described the old behaviour (Chapter I, Chapter III and
Appendix B's free-text paragraph had already been corrected on 2026-10-05).
They now state the per-field vectorizer, that a free-text query has no year so
its metadata score cannot exceed 0.75, and that the idf follows the field's
corpus. (2) The panel's notation said |R| = top_k; the result set holds at
most top_k papers, all with S(d) > 0, and a seed paper is excluded from the
candidates. (3) The trace could not show MMR: the trace request had no MMR
fields, so with Diversify on the panel explained a ranking the Search page did
not display. The request now carries lambda and pool, the panel shows the MMR
event and the final order, and Appendix B.15 records every trace event.
(4) The panel re-ran a full instrumented search on every unrelated page
re-render (four cosmetic layout toggles produced four extra traces); it now
traces once per distinct query, seed, depth, MMR setting, pipeline, and
weights. (5) Integer counts were printed with four decimals (top_k = 10.0000).
(6) The Engine page's worked example listed a shortest path from B to C, which
the code does not compute (paths are measured from the origin only); it was
replaced by a verified four-paper trace in which an indirect route wins.

Dijkstra documentation added. Appendix B.8 now states the graph G = (V, E, w),
the edge cost c = max(0, 1 − w), the algorithm as implemented (binary heap
ordered by distance then paper id, lazy deletion, relaxation with a 10⁻⁹
tolerance), the correctness argument, the bound d(v) ≤ 1 − w(o, v) ≤ 1, the
condition under which an indirect route beats a direct edge (w₁ + w₂ > 1 + w_d),
the determinism rules, the O((|V| + |E|) log |V|) cost, and a worked example
whose every number was produced by the real `_shortest_paths` function. The
source is cited as Dijkstra (1959), added to Appendix B's reference list and to
references.bib; the DOI 10.1007/BF01386390 and the record (title, author,
Numerische Mathematik 1(1), 269–271) were confirmed against Crossref on
2026-10-07. Appendix B.11 states the MMR cost correctly: the whole pool is
reordered, so the reorder performs pool(pool − 1)/2 similarity evaluations
(measured: exactly 1,225 at the default pool of 50). An earlier draft of the
Engine page said O(k · pool); that was wrong and was corrected the same day.

Verification: `python -m unittest discover -s test -t .` ran 235 tests, OK
(1 skip for a missing FTS5 build). The new `test/test_shortest_paths.py` (18
tests) pins the worked example, the indirect-route condition over a grid of
weights, the tie-break and edge-order rules, the tolerance, the non-negative
clamp, and agreement with an independent Bellman-Ford implementation on 300
random graphs; `test/test_mmr.py` gained three tests that the traced search
returns the same results and events as the untraced one, with and without MMR.

Left unchanged on purpose. `review-report.md` and `re-review-report.md` record
the 2026-10-01 review and still say free-text queries activate only the title
signal; they predate the 2026-10-05 code change and stay as a historical
record. The corpus counts in Chapter I and Chapter III (168 papers, 145 valid)
are the figures reported on 2026-10-05; the live repository now holds 171
records with 150 valid for recommendation, and the in-app Walkthrough and
Engine pages were updated to those, so the chapters should be refreshed at the
owner's discretion when the count is frozen for the study. The compiled
`ReSearch-thesis-proposal.docx` and `.pdf` were not regenerated and are older
than the Appendix B edits above.

## Full-thesis LaTeX edition calibrated to the BulSU reference (2026-10-07)

The thesis now builds as a full US-Letter thesis from the Markdown sources
(`thesis-paper/latex/`, `tectonic main.tex`, 78 pages). The format target is
the peer BulSU thesis the owner supplied: `[THESIS][BSM CS 4A] Group III -
Revised.pdf` (179 pp, in `~/Downloads`). Verification method: both PDFs were
rendered at 100 dpi and compared ink-band by ink-band (row-histogram of dark
pixels; x-extents where relevant) for every page class — title page,
acknowledgment, abstract, table of contents, chapter opener, body page,
references, appendix divider.

New pieces written this round: `front-matter.md` (title page, acknowledgment,
abstract with keywords, TOC), `references.md` (the unified 25-entry APA list;
Chapter III's inline list was removed in favour of it), `md2tex.py` jobs
`frontmatter` and `refsonly`, the rewritten `thesis-template.sty`, and the
`main.tex` build sequence.

Bugs found while calibrating, each fixed and re-verified by re-rendering:

1. The running head carried the section name ("INTRODUCTION", uppercased)
   instead of the chapter mark on every body page. fancyhdr's
   `\f@nch@initialise` gives article (twoside by default) a
   `\sectionmark` that is `\markboth{\MakeUppercase{...}}{}`, and titlesec
   invokes it on every `\section`. The reference head always shows only the
   chapter title, so `\sectionmark`/`\subsectionmark` are gobbled after
   fancyhdr is loaded. Confirmed on the reference: pages 8, 12, 20, 60, 61
   all carry the chapter title.
2. `\vspace*` at the top of a fresh page turned into roughly 0.4 in of
   space: the title page (`\vspace*{2pt}`) and the chapter opener
   (`\vspace*{4pt}`) both started far too low. The star version is kept by
   the page builder in a way that adds a full line here; removing both put
   the first lines exactly at the text top, where the reference has them
   (band 1.03-1.15 in). Minimal reproductions were built to isolate this
   (`\clearpage` + line vs `\clearpage` + `\vspace*{4pt}` + line, with the
   then-current 1.11 in margin: first-band tops 1.12 in vs 1.68 in).
3. The title page overflowed onto a second page: `\setstretch{1.75}` sets
   `\baselinestretch`, which multiplies every later explicit
   `\fontsize{X}{Y}` baselineskip (12/20.9 pt became 36.6 pt). The title
   page group now starts with `\singlespacing`, restoring the measured
   pitches (title 23.8 pt, blocks 20.9 pt).
4. The abstract column was left-aligned at the text margin (x 1.00-6.07 in)
   instead of centered: a minipage in vertical mode is not centered by
   `\centering`. It is now placed between `\hspace*{\fill}` and measured at
   1.71-6.78 in against the reference's 1.69-6.77 in.
5. Duplicate hyperref `@page.` anchors (5 warnings) came from
   `\pagenumbering{gobble}` making `\thepage` empty in the front matter;
   `pageanchor=false` removes them. `main.log` now has no "already
   defined" warnings.
6. The running-head page number ended flush at the text edge (7.47 in); the
   reference insets it (ends 7.39 in). The right head now ends with
   `\hspace{6.5pt}` and measures (1.01, 7.39) in, identical to the
   reference.
7. Top margin raised to 1.03 in (first text band 1.03-1.15 in, matching the
   reference) and `\headsep` to 21 pt (head band 0.54-0.63 in vs the
   reference's 0.53-0.63 in). The 100-dpi measurements also set: TOC entry
   leading 7.5 pt per entry, 5 pt after each front-matter heading, 17 pt
   between the abstract heading and its first line, 2 pt after the chapter
   title before the body, and the appendix divider 0.10 in higher (two
   lines now 5.17-5.27 / 5.52-5.63 in vs the reference's 5.18-5.27 /
   5.52-5.62 in).

Verified result: every measured band now agrees with the reference within
about 0.02 in — title lines, standing blocks, CHAPTER/title/body spacing,
body pitch 0.35 in, running head, TOC (heading, entry 1 at 1.64 in,
leading, 0.25 in section indent, flush-left chapter entries), abstract
column, references heading at 1.0 in with entry 1 at 1.58 in, and the
divider. Remaining differences are content-driven and expected: this
cover title is three lines (blocks sit about 0.31 in lower than the
reference's two-line cover), the researcher placeholder block is three
lines (the reference shows more names), and this abstract/reference
list/TOC are longer (TOC 3 pages vs 2).

Flagged for the owner: title page still holds bracketed placeholders
(researcher lines — the count of three is a guess — adviser name, month
and year); no Chapter IV/V content exists (no data), so the abstract
describes the evaluation in the future tense; the cover title form
("RE:SEARCH:" with colon) should be confirmed.

Build: `python3 tools/md2tex.py && tectonic --keep-logs --keep-intermediates
-r 1 main.tex`; fonts Times New Roman (embedded, all four faces) with
metric-compatible TeX Gyre Termes fallback where absent.

## Stats for Nerds: pseudocode removed, trace kept (2026-10-07)

The Stats for Nerds panels no longer reprint the mathematical pseudocode;
they keep the live computation trace and now link to the Engine page,
which explains every formula with a worked example. The listing's data
source `frontend/src/data/pipelineMath.ts` was deleted (nothing else
referenced it) and the card's pipeline label now comes from the pipeline
config. The copy that promised formulas in the panel was updated: the
Walkthrough's tab table, the four per-page context notes (Search,
Repository, Arena, Lab), TEMPEST's developer answer, and the component
doc comments. A changelog entry (`stats-trace-links-engine`) records the
change.

Appendix B depended on the old behaviour, so it was corrected the same
day: its introduction said the frontend "reproduces the core formulas in
that panel (`frontend/src/data/pipelineMath.ts`)", and B.15's opening
sentence said the panel shows numbers "flow through the formulas of this
appendix". Both now state that the panel traces the real numbers of one
search along the steps of the appendix, while the Engine page explains
the same formulas — matching the interface as built. The trace itself is
unchanged (same events and tables documented in B.15). Verified with
`npm run build` (typecheck, inline-script checks, vite build) and by
regenerating the LaTeX edition (`md2tex.py` + `tectonic`).

## Drop zone: BibTeX, EndNote, RefMan, RefWorks (2026-10-07)

Reported: the Upload page's drop zone accepted only PDF and BibTeX; the
other Google Scholar export formats — EndNote, RefMan, RefWorks — came in
neither as dragged links nor as downloaded files. Verified before the
change: handleFile accepted only .pdf/.bib/.tex; a dragged Scholar link
always terminated in an error message (the Chrome extension intercepts
only scholar.bib, and only on localhost:5173); RefWorks exports are RIS.

Fixed and verified:

1. New parser app/services/ris_enw_extraction.py reads the first record of
   RIS (.ris, RefMan/RefWorks) and EndNote (.enw) exports with the same
   six-field contract as bib_extraction; multi-record exports split
   client-side (splitRisEntries/splitEnwRecords) and route through the
   existing per-entry review navigator, like BibTeX.
2. The preview and upload endpoints accept .ris/.enw (extraction_method
   "ris"/"endnote"); the preview error message and upload_paper.py's
   supported set were extended.
3. Dragging a scholar.bib / scholar.enw / scholar.ris link now imports
   instead of erroring: the extension intercepts all three when
   installed; without it the drop zone calls the new POST
   /api/papers/scholar-fetch (server-side fetch, no DB write) and feeds
   the same preview -> review -> save flow. POST /api/papers/import-url
   accepts the same three URL shapes for direct imports.
4. Copy updated: drop-zone text, error messages, the Walkthrough
   endpoints table, the extension manifest, and Chapter III's feature
   matrix (two rows) and API-surface sentence.

Verification: 10 new unit tests (test/test_ris_enw_extraction.py) for
both parsers, first-record isolation, no-ER records, DOI fallback and
record splitting; full suite 245 tests OK (1 skip), up from 235.
`npm run build` passes; the LaTeX edition regenerates (78 pages).

## Search and Repository merged into one screen (2026-10-08)

Requested: merge the Search and Repository pages, with a reference-manager
mockup as layout inspiration only. The Repository page became the single
three-pane screen (filter console / document table / details inspector)
and the recommendation engine became its third scope (Library | Recommend |
Web); /recommendations redirects to /repository and the Search nav item
was removed. The mockup-derived touches: live folder counts, an author
filter list, a collapsed-inspector rail (persisted), and a status bar.
Draggable splitters and sortable columns already existed. The home search
box now lands on the merged page and runs the query immediately. Verified
with `npm run check` and `npm run build`; changelog entry
`library-merge-three-pane`. After a follow-up request, the merged page
keeps the Repository descriptor (not "Library") to stay distinct from the
"My Library" shortlist page. The thesis text was not changed: chapter
descriptions of "imports from Google Scholar", the API surface, and the
Stats for Nerds panel remain accurate, and the app pages moved, not
features. The Walkthrough's static screenshots still show the old Search
page, and Recommendations.tsx stays as the historical implementation,
unrouted.

## Top bar, settings, algorithm bar, Engine flowcharts (2026-10-08)

A follow-up batch to the merged three-pane Repository page:

1. Settings now hosts the Library/Researcher site-mode switch (moved from
   the top bar) and a new Interface option that hides the menu labels
   (icon-only navigation; labels remain as tooltips and sr-only text).
2. The top-bar MODE chip was removed; in its place a Σ STATS switch opens
   a universal statistics pop-up (fixed overlay — it never participates
   in the page layout): repository totals from GET /api/papers/stats, the
   live computation trace of the most recently published search or Arena
   battle (Repository and Arena publish through `state/statsDrawer.tsx`),
   and nine plain-language interpretations of the formulas
   (`data/statsInsights.ts`), each linking the full treatment in the
   Engine.
3. The algorithm controls now live in an always-visible Algorithm bar on
   the Repository page (six presets + CUSTOM). The custom mix is a
   floating dial pop-up (three sliders via `adjustDialAllocation`, live
   S(d) formula) so the console never changes height.
4. The Engine page gained a "process at a glance" section with three
   hand-drawn SVG flowcharts (pipeline, metadata signals, Arena).

Verified with `npm run check` and `npm run build`. The thesis text was
reviewed and needs no changes: the interface's features (upload formats,
API surface, statistics panel, pipelines) are described correctly, and
this batch only relocated controls inside the app. In-app changelog
entries `settings-stats-algorithm` and `library-merge-three-pane` record
the user-visible story.

## My Library PRO (2026-10-08)

Requested: a "pro version" of My Library in the shape of the supplied
Literature Collection mockup — library, dashboard, graph, chat tabs —
unlocked after any garden tree reaches a young level, chat left as a
placeholder. The unlock is `treeStageIndex` (data/knowledge.ts) on each
species bed in sun.tsx (`proUnlocked`); stage 3 of the seven-stage ladder
is Young (per-species fertilizer thresholds 1350–1600). MyLibrary.tsx
gains a persisted PRO toggle (locked badge with the thresholds until the
unlock); MyLibraryPro.tsx renders the four tabs, reusing existing
features: /api/papers/stats, paper metadata chips, connection graph with
a neighbor slider, pagination and per-page sizes. Only the Chat tab is a
placeholder, by request. Verified with `npm run check` and `npm run
build`; changelog entry `my-library-pro`. The thesis text needs no
changes: the system's feature descriptions (repository, library saves,
similar-paper graph) remain accurate, and the new PRO view is an
interface rearrangement, not new backend behavior.

## Temporary PRO override (2026-10-08)

To test My Library PRO without growing a tree, a temporary dev toggle
sits in the Lab's Sun Shop "Test wallet (temporary)" strip: `proOverride`
in state/sun.tsx (key `paperrec_pro_override_temp`) forces `proUnlocked`
on, and SunShop exposes it as "PRO mode (temporary)". Marked TEMPORARY
in both files; removal is planned together with the existing Test wallet
strip before launch. Verified with `npm run check` + `npm run build`.

## My Library unified layout (2026-10-08)

Follow-up to the PRO work: basic and PRO My Library are now the same
four-tab collection (Library / Dashboard / Graph / Chat); the last three
tabs are locked until any garden tree reaches its Young stage, showing a
LockedTab panel with the unlock thresholds and a garden shortcut. The
page-level controls were aligned with the shared button language (ui
Button primary/secondary, bordered mono chips, lucide icon toggles);
Browse Repository is a button everywhere. Drag-to-pet disposal was
restored on the collection's rows/cards (pet MIME payload + crumpled
ghost; removal syncs via the central library-changed event), and a new
PixelBurst animation (16 squares, steps keyframes, ~650 ms) fires at the
delete button's coordinates when an entry is removed from the table.
Verified with `npm run check` + `npm run build`; changelog entry
`my-library-unified`. Flagged: the classic view's right-click literature
menu and batch export were not carried into the unified page.

## Research chat integrated (2026-10-08)

The My Library PRO Chat tab is now live. Retrieval reuses the
recommendation machinery exactly as proposed: `search_papers` gained an
optional candidate filter (`paper_ids`), so a question scoped to the
collection ranks only the saved papers' prepared text, the repository
scope ranks everything, and the web scope retrieves abstracts through
the pre-existing `search_web` service (OpenAlex/Crossref/arXiv). The
pre-existing synthesis layer (Groq when configured, else a deterministic
extractive fallback quoting the best-matching sentence per source)
answers with bracketed citations. Sources are typed responses
(kind/doi/url) and the frontend links them back: repo sources open the
paper in the library viewer or its DOI; web sources open their landing
pages. Scope/paper_ids/history are carried by POST /api/research-chat.
Verified with 5 new unit tests (suite 250 OK) and `npm run check` +
`npm run build`. The thesis text was not changed: the feature descriptions
remain accurate (the assistant is evidence-grounded retrieval over the
existing storage and web layers), and the new scopes are interface
behavior, not new data.

## Groq key configured (2026-10-08)

GROQ_API_KEY written to the gitignored .env (the research chat's
synthesis layer already loaded it at runtime). Verified live: the Groq
endpoint accepted the key with the default model
`openai/gpt-oss-120b`, and an end-to-end call (mocked retrieval, real
synthesis) returned used_fallback=False with a cited answer. The chat
renderer normalizes the model's occasional full-width citation
brackets （【n】） to [n]. .env.example templates the variable; the key
must never be committed.

## Similar-papers graph upgrade (2026-10-08)

All items from the feasibility note for the mockup Graph tab were
implemented in ConnectedPapersGraph as an optional, opt-in controls
layer, keeping the default rendering unchanged: (1) edge-mode toggle
with shared-topic edges derived from the real common_topics groups
(the honest stand-in for a contrast signal the system does not have),
(2) strength slider over the real weighted edges with a live count,
(3) citation_count added to similar-graph node payloads (backend) so
node size is real data, plus a year gradient for idle nodes, (4) faint
cluster blobs computed from the laid-out positions of topic groups,
(5) an extended legend, and (6) a selected-paper side panel (details,
most-similar %, shared topics, Ask/Open actions) wired in My Library
PRO and plumbing through ConnectionsPane/Workbench for the Repository
Similar tab. Verified: 1 new endpoint test (251 tests OK), `npm run
check` + build pass, changelog `similar-papers-graph-upgrade`. The
thesis text is unaffected: the component-level arrangements do not
change the similarity data model.

## Chat history rail + bounded thread (2026-10-08)

The Chat tab gained a conversations model (localStorage-backed,
20-cap, auto-titled from the first question), a bounded scrollable
thread (540px, autoscroll), and a collapsible left History rail with
per-conversation delete and a confirmed Delete all. History and the
rail's open state persist per browser. Verified with `npm run check`
and `npm run build`. No backend changes; the retrieval/synthesis
behavior is unchanged.

## Floating graph panel + theme-adaptive colors (2026-10-08)

The similar-papers graph's Selected paper panel floats over the canvas
(collapsible sections: Abstract closed by default with a 2-line clamp,
Most similar and Shared topics open; shared-topics list scrolls at
max-h-28), the canvas fills its tab (widened flag from My Library PRO,
no cramped side column), and the controls-layer colors resolve from the
live theme tokens: accent/ink triplets drive the year gradient, the
zone tints and the topic-edge strokes, with hardcoded hues removed.
Verified with `npm run check` and `npm run build`. No backend or data
changes.

## Pop-up theming + RetroDialog sizes (2026-10-08)

All pop-up surfaces were audited against the theme. PaperViewerModal,
LiteratureMenu, StatsDrawer, the similar-papers floating panel, and
RetroDialog's card/scrim/buttons already used the design tokens.
RetroDialog's header (fixed brown gradient) and footer (fixed cream)
were converted to bg-accent/bg-canvas so they follow the active theme,
and it gained sm/md/lg sizes (320/460/720px, lg scrollable). The four
remaining native window.confirm boxes (Repository deletes ×3, My
Library PRO history delete-all) were replaced with themed RetroDialog
confirms (shared askConfirm in Repository). Verified with `npm run
check` and `npm run build`; `window.confirm` no longer appears in the
frontend.

## Browse Repository pop-up (2026-10-08)

The Browse Repository buttons on My Library (header + empty state) now
open a mini-repository pop-up (RepositoryPickerDialog): a large themed
RetroDialog with live debounced search over /api/papers, a scrollable,
paginated result list, and per-row Add actions. Picking returns the
Paper to the host via onPick; My Library saves it with saveToLibrary
and the centralized library-changed event refreshes the collection, so
no page navigation is involved. Verified with `npm run check` and
`npm run build`. The Graph tab's Browse Repository link intentionally
keeps navigating (context link, not an add action).

## Graph menu, picker fix, Lab stats pane (2026-10-08)

My Library's repository picker rows are fully clickable (previously
only the inner text/Add elements picked). The Graph tab replaced its
paper dropdown with a left menu of the loaded collection; selecting a
row recomputes the similar-papers graph. The Lab's Stats for Nerds
became a collapsible right-side pane instead of a tab, and it now
carries its own query box so the trace runs against the recipe dials
for an actual query (it previously never had inputs). Verified with
`npm run check` and `npm run build`.

## Lab stats trace fixed (2026-10-08)

The Lab's Stats for Nerds pane traced a pipeline disconnected from the
Recipe bench: the bench's dials were local-only, the shared pipeline
was never switched to "custom", and the shared customWeights were never
updated by moving the dials. Dial moves, recipe loads and the learned-
weights preset now mirror the mix into the shared custom state and
activate the custom pipeline; opening the stats pane does the same. An
end-to-end trace request against the backend confirmed the custom
pipeline payload (w_tfidf/w_sbert/w_metadata) normalizes correctly.
Verified with `npm run check` + `npm run build`.

## Lab stats trace live binding (2026-10-08)

The Lab stats pane previously required Enter to run a traced query;
the Arena recomputes on every keystroke because it passes its live
query state into the trace inputs (PipelineMath debounces 350ms). The
Lab pane now binds the same way: inputs derive directly from the
pane's query state, so the computation refreshes as you type.
Verified with `npm run check` + `npm run build`.

## Lab stats trace dead code fix (2026-10-08)

The Lab's stats pane carried its own query input that duplicated the
Lab's battle query state (dead UI) and kept the trace disconnected from
the Lab's real query. The pane now binds directly to the Lab's `query`
and `topK` states, recomputing as they change, with the Recipe bench
dials as the custom pipeline. The redundant input and `statsQuery`
state were removed. Verified with `npm run check` + `npm run build`.

## Lab stats pop-up (2026-10-08)

The Lab's Stats for Nerds pane became a themed RetroDialog pop-up (lg,
scrollable), consistent with the repository picker dialog; the toggle
and live query binding are unchanged. Verified with `npm run check` +
`npm run build`.

## Dialog scroll freeze fix (2026-10-08)

RetroDialog's pop-up freeze prevented wheel/touch scrolling globally,
which also froze the dialog's own scrollable regions (lg pop-ups such
as the Lab stats trace and the repository picker). The wheel/touch
block now ignores events originating inside the dialog element, so
scrollable pop-up content scrolls while the page behind stays locked.
Verified with `npm run check` + `npm run build`.

## Upload manual BibTeX pop-up + DROP HERE ghost (2026-10-08)

The Manual BibTeX entry now opens in a themed RetroDialog pop-up (lg)
instead of an inline panel; parsing closes it and the review navigator
follows. The upload drop zone gained a hover-ghost interaction: while a
file or link is dragged over the hotspot it shows the crumpled-paper
graphic, a blinking pixel "DROP HERE" and a payload-specific release
caption; the overlay is non-interactive and clears on drop/leave.
Verified with `npm run check` + `npm run build`.

## Arena default-visible results (2026-10-08)

The Arena results area now renders from the start: the rail (Battle
grid as default tab), a pre-battle placeholder, and the Records panel
(history loads on mount). Post-battle the same layout fills with the
grid, scores, consensus, pairwise, winner and interpretation views.
Panel guards use battle?./battle && so pre-battle rendering is safe.
The query bar and selects were restyled from the old navy/gold tokens
to the white/ink bordered look, and the rail labels plus panel headers
were pixelified (Lab-inspired). Verified with `npm run check` +
`npm run build`.

## Garden menu sun dedupe (2026-10-08)

The Tree of Knowledge's menu bar showed the sun glyph twice: once in
the Growth points chip and once in the Sun shop button. The growth
chip now uses a Sprout icon, leaving one sun per menu. Verified with
`npm run check` + `npm run build`.

## Garden shop pop-up (2026-10-08)

The Tree of Knowledge sidebar's Shop/Skins/Wallet panes (SunShop,
embedded) now render inside a themed RetroDialog pop-up opened by the
menu bar buttons; the sidebar shows Tree info meanwhile, and Theme
shop stays in the sidebar. The pop-up title follows the active tab.
Verified with `npm run check` + `npm run build`.

## Garden restructure: floating Tree info, hover shop (2026-10-08)

The Tree of Knowledge no longer has a right sidebar. Tree info is a
collapsible card pinned bottom-left over the tree stage (the freed
width goes to the tree window); the shop/skins/wallet and theme shops
are all themed pop-ups; and the shop pop-up opens on menu-bar hover
(140 ms) and hides when the pointer leaves the buttons and pop-up
(380 ms), with click toggling still available. Verified with `npm run
check` + `npm run build`. Immersive drawer states that referenced the
sidebar are superseded by the pop-ups.

## Shops: hover fix, tokens currency, hold badge (2026-10-08)

The pop-up scrim no longer intercepts pointer events (dialogs keep
pointer-events-auto), outside-click closing moved to a document
pointerdown listener, and RetroDialog gained focusOnOpen (false for
the hover-opened shop). Fertilizer purchases now credit a fertilizer
HOLD (badge in the garden menu); applying it happens by dragging the
badge right (1×/2×/10×, pointer-captured). The alternate currency is
the existing tree-token wallet (sun expensive, tokens cheap). Old
pack-and-drag-to-feed UI and the tree drop target were removed.
Verified: npm run check + build.

## Garden menu bar re-arranged (2026-10-08)

The fertilizer badge + 1×/2×/10× selector now renders as one
horizontal bordered unit (same height as the wallet chips) instead
of a two-row stack; the species picker dropped its nested
overflow-x-auto (the bar handles scrolling). npm run check + build.

## Pixel tree viewer is now static (2026-10-08)

Removed the Mature-stage viewer interactions in PixelGrowthTree:
drag-to-pan, wheel climb, and 1x-2x zoom (wheel/ctrl-wheel) are gone;
the canvas is a static 1x render with plain onClick (speech bubble).
The "climb · drag to pan" chip is gone. npm run check + build pass.

## Tree skins art = garden pixel art (2026-10-08)

Added `PixelSprite` (PixelGrowthTree miniatures, 256x144 art at a
fractional scale with the garden's dark frame) and used it in the
Tree skins shop cards and the garden seed-bank buttons, replacing
the KnowledgeTree SVGs; locked species keep their lock badge.
npm run check + build pass.

## Sun shop pop-up + Theme shop pane (2026-10-08)

Restructured the Sun shop pop-up into a single pop-up with an inner
tab rail: Sun shop, Tree skins, Theme shop, Wallet (keyboard
navigable). The Theme shop — orphaned when the right sidebar was
removed — now renders as a pane inside this pop-up (themes wired
from the garden; purchases whisper there) and its standalone pop-up
is gone. Verified: npm run check + build.

## PixelSprite: transparent + young snapshots (2026-10-08)

The tree-skin/seed cards now use transparent backgrounds, and the
sprite renders each species' Sapling-stage (young) tree via its own
SPECIES_STAGE_FERT threshold over TREE_GROWTH_TARGET, instead of the
ancient full-growth tree. npm run check + build pass.

## PixelSprite frozen (2026-10-08)

Added PixelGrowthTree's `static` prop (single frame at growth, no
animation loop); PixelSprite uses it so the young-tree cards are
still images while the garden tree keeps its motion. npm run check +
build pass.

## Cheat refusal → themed pop-up (2026-10-08)

In SunShop, both cheat entry points (arm button and the cheat form)
now route redeemCheat failures ("not grown wise enough") into the
themed notice pop-up and keep the typed word; successes whisper into
the tree bubble as before. npm run check + build pass.

## Garden ambience: clouds + birds at Mature+ (2026-10-08)

PixelGrowthTree paints drifting semi-transparent clouds (behind the
crown, wrapping) and up to three perching birds (on top leaves,
occasional hops, wing flick) once the tree reaches its species'
Mature threshold. Reduced-motion users get static stills. The young
card snapshots are unaffected. npm run check + build pass.

## Persistent backdrop + gradual per-level fades (2026-10-08)

GardenBackdrop no longer restarts its animation loop when the tree
grows (parallax moved to a ref, out of the effect deps) — the sky
animation stays continuous during the 900ms growth morph. In
PixelGrowthTree, newly added elements now fade in/out: leaves and
pollen fade in over a short growth window after birth, clouds fade
in at Mature and at the frame edges, birds fade in at Mature and
around their perch hops. npm run check + build pass.
