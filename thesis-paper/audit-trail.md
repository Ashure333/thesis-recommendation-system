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
