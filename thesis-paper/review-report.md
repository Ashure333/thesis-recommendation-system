# Peer Review Report

**Paper:** A Design and Comparative Evaluation of Hybrid Content-Based Recommendation Pipelines Integrating TF-IDF, SBERT, and Metadata Fusion (Chapters I–III, Appendix A, references.bib) — Bulacan State University BSMCS undergraduate thesis (Re:Search)

**Reviewer role:** Peer Reviewer Agent, academic-paper Phase 6 (Round 1)

**Review basis:** Chapters I–III and Appendix A read in full; every system claim cross-checked against the live codebase (`app/services/recommendation/pipeline_config.py`, `metadata_pipeline.py`, `search_service.py`, `compare_service.py`, `duplicate_detection.py`, `app/api.py`, `app/models/models.py`, `frontend/src/data/pipelineConfigs.ts`, `frontend/src/pages/evaluation/Evaluation.tsx`, `README.md`) and the live SQLite database (`app/data/academic_repository.db`).

---

## Verdict Summary

| Metric | Value |
|--------|-------|
| Verdict | **Major Revision** |
| Overall Score | **6.05 / 10** |
| Review Round | 1 |

**Justification.** This is a carefully written, unusually well-verified undergraduate proposal: the six pipeline weights, the metadata formula, the normalization rule, the tie-break rules, the Arena winner metric, the duplicate-detection threshold, the API endpoints, and the corpus counts (168 records / 146 valid) all check out against the actual code and database — no fabricated system claims were found. The literature chapter is honest (21 sources, zero citation orphans, verified DOIs) and its gap-to-design mapping is the strongest section of the draft. However, the study has one fundamental design contradiction and several accuracy defects that block Accept: (1) the H₀/H₁ hypotheses assert "significant difference" while Chapter III explicitly rules out inferential statistics, making the hypotheses untestable under the stated analysis plan (Critical); (2) the headline anti-confounding claim "a hybrid weighs at most 0.5 against its own components" is arithmetically false against the implemented algorithm (the three-signal hybrid weighs 2/3 against a pure component); (3) the metadata component's behavior on free-text queries (title-only, since abstract/keywords/year are absent) is never disclosed, even though query- and seed-paper search are both in scope; (4) Chapter III's reference list contradicts the verified bibliography on the Reimers & Gurevych page range; and (5) development-walkthrough battle runs are mixed into the same win tally as the planned evaluation campaign without provenance. These are fixable in one to two revision rounds, but they must be fixed before data collection, which is why the manuscript requires major revision rather than minor.

---

## Dimension Scores

| Dimension | Weight | Score | Key Evidence |
|-----------|--------|-------|--------------|
| Originality | 20% | 6.0/10 | Genuine, honestly-scoped contribution: controlled same-corpus comparison of a six-pipeline family differing only in fusion weights (a real gap in the reviewed literature, Ch2 gap analysis items 1–2), an anti-confounding winner metric, and the first verified Philippine comparative evidence claim. But all component techniques are standard (TF-IDF, SBERT, cosine, weighted sum per Burke 2002); novelty sits in the evaluation instrument, not the algorithms; the local-evidence gap rests on a single verified Philippine study. |
| Methodological Rigor | 25% | 5.0/10 | Design (descriptive-developmental) maps cleanly onto the RQs; Arena protocol is precisely specified and matches the code; normalization/tie-break/winner rules are exact; seven limitations stated. But: untestable hypotheses (Ch1:76–82, Ch3:184); "at most 0.5" independence-weight bound is false (Ch3:159); metadata-component query-type asymmetry undocumented (Ch3:48–54); dev-walkthrough runs mixed into the campaign tally (Ch3:165); the query set for the campaign is unspecified in size or selection rule (Ch3:165); no human ground truth, so "winner" claims are agreement-internal only (acknowledged). |
| Evidence Sufficiency | 25% | 6.0/10 | Strong: 168/146 corpus numbers verified against the DB; all endpoints, weights, thresholds, and formulas verified against code; 21/21 bib entries cited, zero orphans; quantitative literature claims (Beel 55%, BEIR 18 datasets, SciDocs 7 tasks, Kreutz & Schenkel 65 papers) are as-reported. Defects: Ch3 reference list conflicts with the verified bib on Reimers & Gurevych pages (3982–3992 vs 3980–3990); the "at most 0.5" claim contradicts the implemented algorithm; Ch1 source note's "158 distinct titles" is already stale (DB now returns 159, comment-only). |
| Argument Coherence | 15% | 6.0/10 | Title matches content; RQ1→Ch3 design, RQ2→Ch3 Arena, RQ3→hypotheses mapping is explicit and mostly sound; gap-analysis→design-decision mapping is exemplary. Breaks: hypotheses cannot be answered by the stated analysis (coherence failure across Ch1/Ch2 and Ch3); Ch1 "three comparisons (Table 2)" vs RQ2's four numbered comparisons (2.1–2.4); hypothesis pair order and measure wording drift between Ch1 and Ch2; consensus-ranking third tie-break misstated in Ch3 (best rank vs paper id). |
| Writing Quality | 15% | 8.0/10 | Clean, dense, precise prose; consistent voice (present for the built system, future for planned evaluation); well-formed tables; AI disclosures and source notes present; stop-slop pass effective (no clichés, no em dashes). Minor: several very long sentences (e.g., Ch1:17, Ch3:159) and near-verbatim corpus-sentence duplication between Ch1:32 and Ch3:165. |
| **Overall** | — | **6.05** | (6.0×0.20) + (5.0×0.25) + (6.0×0.25) + (6.0×0.15) + (8.0×0.15) |

---

## Section-by-Section Issues

### Chapter I — The Problem and Its Background

**Strengths:**
- Problem framing (vocabulary mismatch, single-signal failure modes, hybrid rationale) is accurate and well-cited.
- Table 1 weights exactly match `pipeline_config.py` (100/0/0; 0/100/0; 50/50/0; 66.7/0/33.3; 0/66.7/33.3; 40/40/20).
- Corpus claim "168 records, 146 valid" verified against the live database.
- Scope/delimitation is disciplined and matches the implementation (SQLite single-node, no OCR, no collaborative filtering).

**Issues:**
- **[Severity: Critical]** Lines 76–82 — Both H₀/H₁ pairs assert "There is (no) significant difference…", but Chapter III:184 states "no inferential statistics are applied." The hypotheses are therefore untestable under the stated analysis plan. → Fix: reframe as descriptive claims ("hybrid and single-signal configurations differ in observed consensus capture and ranking agreement as measured by the Arena") and drop "significant," or add an inferential test on logged runs (e.g., Mann–Whitney U or bootstrap CIs over the campaign's battle runs) and state α. Decide before data collection.
- **[Severity: Minor]** Line 32 — "reports three comparisons (Table 2)" but RQ 2.1–2.4 enumerate four (consensus ranking; pairwise agreement; independence-weighted winner; win tally and battle history). → Fix: change to "four comparisons."
- **[Severity: Minor]** Line 17 — "component scores are min-max normalized before weighted combination" is blanket; only TF-IDF and S-BERT are min-max normalized, metadata passes through (Ch3 states this correctly). → Fix: qualify "TF-IDF and S-BERT component scores."
- **[Severity: Minor]** Line 32 and Definition of Terms "Top-K" (line 146) — "top-K of 5 to 25" / "K between 5 and 25": the backend `CompareRequest` accepts 1–25, but the Arena UI offers only Top 5 / Top 10 / Top 15 (`frontend/src/pages/evaluation/Evaluation.tsx:288-290`). → Fix: state "K ∈ {5, 10, 15} in the Arena UI (the backend accepts up to 25)."

**Line-Level Comments:**
- Line 17: "Three signal components … scoring title, abstract, keywords, and publication year at 25 percent each" — true for seed-paper queries; for free-text queries only title is active (see Major item 3 in Chapter III). Consider flagging here.
- Line 32: sentence is very long (5 clauses); consider splitting.
- Lines 148–151: disclosure and source notes are good practice; the "158 distinct titles" note is already stale (DB returns 159), refresh it.

### Chapter II — Review of Related Literature and Studies

**Strengths:**
- Four-theme structure (theories, literature, studies, synthesis) maps directly onto the prototype's design decisions.
- The Gap Analysis (lines 77–93) is the strongest section: each gap is restated as a concrete design rule, including the anti-confounding rule.
- Honest treatment of the Philippine literature: one verified study (De la Cruz & Diesta, 2019), explicitly described as a documentation system, with no invented filler.
- All 21 bib entries are cited in this chapter; zero orphans in either direction (verified by key-by-key cross-check).

**Issues:**
- **[Severity: Minor]** Lines 117–123 — Hypothesis pairs are present and consistent in content with Ch1, but (a) ordered differently (ranking-agreement pair first here, consensus-capture pair first in Ch1) and (b) the consensus-capture measure wording drifts ("consensus votes and independence-weighted consensus share" here vs "independence-weighted consensus winner" in Ch1:76–78). → Fix: use identical ordering and identical measure wording in both chapters.
- **[Severity: Minor]** Line 31 — "The prototype bounds every component score into the 0-1 range before weighting" is imprecise in the same way as Ch1:17 (metadata is naturally bounded, not rescaled). → Fix: "min-max normalizes TF-IDF and S-BERT scores into [0,1]; metadata scores are already bounded."
- **[Severity: Minor]** Line 90 — "metadata enters hybrids at fixed one-third or one-fifth shares" — accurate for the two-signal hybrids (0.333) and the full hybrid (0.2), but verify the full-hybrid share is stated consistently as one-fifth everywhere (Ch1 Table 1: 20%, Ch3 Table 2: 0.2 — consistent; no change needed, but the one-third/one-fifth shorthand is worth spelling out).

**Line-Level Comments:**
- Line 23: "55 percent" and the Beel et al. survey scope (>200 articles) reproduce the source as reported; fine.
- Line 31: Robertson & Zaragoza (2009) is used only as a normalization-care reminder; acceptable but the connection to BM25 is thin — consider one sentence stating the analogy is motivational, not a component of the prototype (or it is fine as is).
- Lines 125–206: the verification comments are exemplary transparency; they must not be mistaken for manuscript content at submission time (verify they are stripped or kept as intended).

### Chapter III — Research Methodology

**Strengths:**
- Research design, locale, framework, and feature matrix match the codebase (two-layer FastAPI/React, SQLite, single node).
- Table 2 weights match `pipeline_config.py`; metadata formula (0.25 × four signals, missing → 0, year = 1/(1+|Δyear|)) matches `metadata_pipeline.py` exactly; degenerate min-max case → 1.0 matches `search_service.py`.
- Winner-share formula ("captured weighted consensus ÷ maximum possible", ties → lower average consensus rank) matches `compare_service.py`; battle_runs schema claim (query, seed, top_k, winner pipeline, metric, value, avg consensus rank, timestamp) matches `models.py` `BattleRun`.
- Endpoint claims (POST /api/papers/upload, /api/papers/import-bibtex, /api/papers/import-url, POST /api/recommendations/compare, GET /api/evaluation/battles, POST /api/recommendations/rebuild) all verified in `app/api.py`.
- Duplicate detection claim ("exact DOI or title similarity at or above 0.85") verified against `duplicate_detection.py` (TITLE_DUPLICATE_THRESHOLD = 0.85 + exact-DOI signal).
- Tech stack table and rebuild order (classify → validate → prepared text → TF-IDF → S-BERT, `storage/recommendation_index_status.json`) verified against README and scripts.
- Ethical considerations are appropriate for a no-human-subjects, single-machine study.

**Issues:**
- **[Severity: Major]** Line 159 — "a hybrid weighs at most 0.5 against its own components" is arithmetically false. 1 − Jaccard for the three-signal hybrid against a pure component is 1 − 1/3 = 2/3 ≈ 0.667 (Jaccard of {tfidf,sbert,metadata} with {tfidf} is 1/3). Only two-signal hybrids weigh exactly 0.5 against their own components. → Fix: correct to "a hybrid weighs at most 2/3 against a pipeline sharing one component; a two-signal hybrid weighs exactly 0.5 against its own components." (The same error appears in the `compare_service.py` docstring, lines 63–66 — fix both so code comments and thesis agree.)
- **[Severity: Major]** Lines 48–54 — The metadata formula is presented as if all four signals are always active, but for free-text queries `metadata_pipeline._get_query_metadata` supplies only the title; abstract, keywords, and year are None and contribute 0. Metadata-inclusive pipelines therefore behave differently under query search (title-only) vs seed-paper search (four signals). The thesis never discloses this, and the campaign mixes both query types (Ch3:165). → Fix: state the query-type dependence explicitly in the metadata-component description and stratify Arena results by query type (query vs seed) in the analysis.
- **[Severity: Major]** Line 165 — "Runs already logged during development walkthroughs remain in the history and count toward the tally." Uncontrolled dev runs (ad hoc queries) are pooled with the planned campaign in the headline win tally, biasing the champion/streak statistics. → Fix: add a run-type/provenance field to battle_runs (e.g., run_type = walkthrough | campaign) or reset the history before the campaign, and report campaign-only tallies as the headline result.
- **[Severity: Major]** Line 208 (References) — "Reimers, N., & Gurevych, I. (2019) … (pp. 3982–3992)" conflicts with references.bib (pp. 3980–3990), which carries the verification note "Verified page range 3980–3990 per the ACL Anthology" (D19-1410). Two reference lists in the same submission disagree on the same source. → Fix: align both on 3980–3990.
- **[Severity: Minor]** Line 159 — Consensus ranking is described as ordered "by votes … then by average rank, then by best rank." The code sorts by (−votes, avg_rank, paper_id); `best_rank` is computed but never used in ordering (`compare_service.py:258-264`). → Fix: change "then by best rank" to "then by paper id."
- **[Severity: Minor]** Line 159 and Ch1:32 — "top_k (5 to 25)": backend accepts 1–25; the Arena UI offers 5/10/15. The data-collection plan (5, 10, 15) is consistent with the UI. → Fix: describe the range as the UI exposes it.
- **[Severity: Minor]** Line 165 — "a set of queries and seed papers drawn from the repository" never specifies how many, or the selection rule. → Fix: state the planned number of queries/seed papers and their selection rule (e.g., stratified by subject) before running the campaign.

**Line-Level Comments:**
- Line 9: descriptive-developmental design is well motivated; the claim that the study "reports how the six fixed pipeline configurations rank papers … without manipulating any variable beyond the weight configurations themselves" is fine.
- Lines 159–161: the Arena protocol description is otherwise the most code-faithful section of the manuscript.
- Line 184: "The study reports these results descriptively; no inferential statistics are applied" — this sentence is the direct source of the Critical hypothesis conflict; resolve there.

### Appendix A — System Screenshots

**Strengths:**
- All seven referenced image files exist in `thesis-paper/appendix/screenshots/` (01-login.png through 07-arena-records.png); capture setup (Vite dev build vs local FastAPI, 1440×900) is stated.

**Issues:**
- **[Severity: Minor]** Figures A-1 through A-7 are captioned but never individually referenced in the body text of Chapters I–III. → Fix: add one cross-reference sentence in Ch3 (System Framework and Features or System Evaluation) naming the relevant figures (e.g., "the Arena page and battle records are shown in Figures A-6 and A-7"), or add a sentence in the appendix intro mapping each figure to its chapter section.

---

## Cross-Section Checks

| Check | Status | Notes |
|-------|--------|-------|
| Title matches content | **Pass** | "Design and Comparative Evaluation … TF-IDF, SBERT, and Metadata Fusion" accurately covers Ch1/Ch3 design content and the Arena comparative evaluation. |
| Research questions in Ch1 answered/mapped by Ch2 and Ch3 | **Partial** | RQ1 → Ch3 Research Design + System Framework; RQ2 → Ch3 System Evaluation; RQ3 → Ch3 Data Processing and Analysis. Mapping is explicit and sound, but RQ3's hypotheses (Ch1:76–82) are untestable because Ch3:184 excludes inferential statistics (Critical). |
| Ch1 hypotheses vs Ch2 hypotheses consistency | **Partial** | Same two H₀/H₁ pairs, same constructs; pair order swapped between chapters and consensus-capture measure wording drifts ("independence-weighted consensus winner" vs "consensus votes and independence-weighted consensus share"). Minor. |
| All tables/figures referenced in text | **Pass (with note)** | Ch1 Tables 1–2 and Ch3 Tables 1–3 + Figure 1 all referenced in text. Appendix figures A-1…A-7 have captions but no individual in-text cross-references. Minor. |
| Citation format consistent (APA 7); in-text ↔ references.bib orphans | **Fail (one item)** | APA 7 consistent throughout; all 21 bib entries cited in Ch2, Ch1 cites 8, Ch3 cites 5; zero orphans either direction. BUT Ch3:208 lists Reimers & Gurevych as pp. 3982–3992 while references.bib (verified) says 3980–3990. Major. |
| Corpus numbers consistent across chapters | **Pass** | Ch1:32 "168 records, 146 valid" and Ch3:165 "168 papers … 146 valid" agree and both verified against the live database (SELECT COUNT(*) = 168; valid = 146). |
| Technical fact accuracy vs code | **Partial** | Weights (Table 1/Table 2), metadata formula, normalization rule (degenerate → 1.0), ranking tie-breaks (year then title), score>0 filter, seed exclusion, endpoints, rebuild order, duplicate threshold 0.85, battle_runs schema, branding "Re:Search · BulSU BSMCS": all verified. Defects: (a) "hybrid weighs at most 0.5" false (true bound 2/3); (b) consensus-ranking third tie-break is paper_id, not best rank; (c) "top-K 5 to 25" vs UI 5/10/15; (d) metadata query-type asymmetry undisclosed. |
| Word counts within target | **Pass** | Ch1 = 2,271 (target 1,800–2,400); Ch2 = 3,022 (target 2,500–3,500); Ch3 = 2,981 (target 2,200–3,000). Counts exclude HTML comment blocks. |

---

## Priority Revision List

### Critical

1. **Untestable hypotheses (Ch1:76–82, Ch2:117–123, Ch3:184).** Both H₀/H₁ pairs assert "no/significant difference" but Chapter III explicitly applies no inferential statistics. Either (a) reframe the hypotheses descriptively — "Hybrid and single-signal configurations differ in consensus capture and ranking agreement as measured by the Arena" — and delete "significant difference"; or (b) add an inferential test over logged battle runs (e.g., Mann–Whitney U on per-query win shares, or bootstrap CIs on win shares per pipeline) and state α. Decide before data collection; the current wording commits the study to a test it refuses to run.

### Major

2. **False independence-weight bound (Ch3:159).** "A hybrid weighs at most 0.5 against its own components" is wrong: 1 − Jaccard({tfidf,sbert,metadata}, {tfidf}) = 2/3. Correct to "a hybrid weighs at most 2/3 against a pipeline sharing one component; a two-signal hybrid weighs exactly 0.5 against its own components." Fix the identical error in the `compare_service.py` docstring (lines 63–66) so code and thesis agree.

3. **Undisclosed metadata query-type asymmetry (Ch3:48–54; Ch1:17).** For free-text queries, abstract/keywords/year are unavailable, so the metadata component degenerates to title-only similarity; only seed-paper runs use all four signals. Document this in the metadata-component description, and stratify Arena analysis (and the win tally) by query type — the campaign mixes both.

4. **Citation data conflict (Ch3:208 vs references.bib).** Reimers & Gurevych (2019) pages listed as 3982–3992 in Chapter III's References but 3980–3990 in the verified references.bib (ACL Anthology D19-1410). Align both on 3980–3990.

5. **Development runs pooled into the evaluation tally (Ch3:165).** Walkthrough battle runs and the planned campaign share one win tally. Add a provenance/run-type field to battle_runs (or clear history before the campaign) and report campaign-only tallies as the headline champion/streak result.

### Minor

6. **Consensus-ranking tie-break misstated (Ch3:159).** The third sort key is paper id, not best rank (compare_service.py:258–264). Change the text; best_rank is computed but unused in ordering.

7. **Top-K range (Ch1:32, Ch3:159).** "5 to 25" matches the backend (1–25) but not the Arena UI, which offers 5/10/15. State the UI range.

8. **"Three comparisons (Table 2)" (Ch1:32) vs four numbered RQ 2.1–2.4.** Change to "four comparisons" or restructure the sentence.

9. **Blanket normalization phrasing (Ch1:17, Ch2:31).** Only TF-IDF and S-BERT are min-max normalized; metadata passes through. Qualify both sentences.

10. **Hypothesis ordering/wording drift (Ch1:76–82 vs Ch2:117–123).** Use identical pair order and identical measure wording in both chapters.

11. **Unspecified campaign query set (Ch3:165).** State the number and selection rule for queries/seed papers before running the campaign.

12. **Appendix figures not cross-referenced (Appendix A).** Add in-text references to Figures A-1…A-7 from the relevant chapter sections.

---

*Reviewer's note on scope: this is a proposal-stage draft (evaluation actions in future tense). Items 1, 3, and 5 must be resolved before the Arena campaign runs; items 2, 4, 6–12 are text-level corrections that can be applied in one editing pass. Estimated revision effort: moderate — one substantive design decision (item 1) plus one focused editing pass.*

---

## Revisions Applied (Round 2)

All priority items were addressed in one editing pass on 2026-10-01:

| # | Item | Resolution |
|---|------|-----------|
| 1 | Untestable hypotheses | Reframed descriptively in Ch1 and Ch2 (identical wording, consensus-capture pair first, then ranking-agreement pair): "no difference / difference" without "significant." Ch3 now states the hypotheses are assessed from the campaign's observed statistics (win shares, average consensus ranks, overlap, mean rank gap); the no-inferential-statistics statement is retained and reconciled. |
| 2 | False independence-weight bound | Ch3 corrected: two-signal hybrids weigh exactly 0.5 against a pipeline built from one of their own components; the three-signal hybrid weighs at most 2/3 against a single-signal pipeline. `compare_service.py` docstring fixed to match (verified: 1 − Jaccard({t,s,m},{t}) = 2/3). |
| 3 | Metadata query-type asymmetry | Disclosed in Ch1 (intro and Definition of Terms) and Ch3 (metadata component description): free-text queries activate only the title signal; seed-paper searches activate all four. Ch3 data analysis now stratifies Arena results by query type. |
| 4 | Reimers & Gurevych page conflict | Ch3 References aligned on 3980–3990 (ACL Anthology D19-1410), matching references.bib. |
| 5 | Dev runs pooled into tally | Ch3 Data Collection now specifies: battle history reset before the campaign; walkthrough runs exercised the instrument and are excluded; win tally/champion/streaks report campaign-only runs. |
| 6 | Consensus tie-break | Ch3 corrected to "then by paper id" (matches `compare_service.py` sort key; best_rank is reported but unused in ordering). |
| 7 | Top-K range | Ch1 and Ch3 state the Arena UI offers 5, 10, and 15 (backend accepts up to 25). |
| 8 | "Three comparisons" | Ch1 now says "four comparisons" and enumerates them (consensus, pairwise, winner, tally/history). |
| 9 | Normalization phrasing | Ch1, Ch2, Ch3 all qualify that only TF-IDF and S-BERT are min-max normalized; metadata passes through already-bounded. |
| 10 | Hypothesis ordering/wording | Ch1 and Ch2 now use identical pairs, identical order, identical measure wording. |
| 11 | Campaign query set | Ch3 states the campaign selects queries and seed papers to cover the repository's subject classifications; size and selection rule to be fixed before data collection. |
| 12 | Appendix cross-references | Ch3 System Framework now maps the main interfaces to Figures A-1 through A-7. |

Stale source-note count ("158 distinct titles") removed from Ch1. Estimated re-review: items 1–5 closed; residual risk limited to the un-finalized campaign size (item 11, intentionally left as a to-be-fixed parameter before data collection).