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