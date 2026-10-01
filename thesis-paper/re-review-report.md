# Re-Review Report (Round 2)

**Paper:** A Design and Comparative Evaluation of Hybrid Content-Based Recommendation Pipelines Integrating TF-IDF, SBERT, and Metadata Fusion (Chapters I–III, Appendix A, references.bib) — Bulacan State University BSMCS undergraduate thesis (Re:Search)

**Reviewer role:** Peer Reviewer Agent, academic-paper Phase 6 (Round 2 — re-review of the Round-1 Major Revision)

**Review basis:** All four chapter files, Appendix A, and references.bib read in full; every claimed fix re-verified against the live codebase (`compare_service.py`, `metadata_pipeline.py`, `app/api.py`, `app/models/models.py`, `frontend/src/pages/evaluation/Evaluation.tsx`, `frontend/src/api.ts`) and the live SQLite database (`app/data/academic_repository.db`). Cross-check greps run for every stale-wording string from Round 1. READ-ONLY: no thesis file was modified.

---

## Part A — Verification of Round-1 Revisions

### Priority Item Verification Table

| # | Round-1 Item | Status | Evidence (file:line) |
|---|---|---|---|
| 1 | Hypotheses reframed descriptively | **PASS** | Ch1:76–82 — consensus-capture pair first ("There is no difference… / There is a difference… as measured by the independence-weighted consensus winner"), then ranking-agreement pair ("as measured by pairwise overlap at K and mean rank gap"); no "significant" anywhere in either pair. Ch2:117–123 — byte-identical wording, identical order. Ch3:186 — "The Chapter I hypotheses are therefore assessed from the campaign's observed statistics: win shares and average consensus ranks for consensus capture, and overlap and mean rank gap for ranking agreement." Ch3:184 retains "no inferential statistics are applied" and the reconciliation is coherent (descriptive statistics map 1:1 onto both hypothesis pairs). |
| 2 | Independence-weight bound | **PASS** | Ch3:161 — "a two-signal hybrid weighs exactly 0.5 against a pipeline built from one of its own components, and the three-signal hybrid weighs at most 2/3 against a single-signal pipeline sharing one component." `compare_service.py:63–67` docstring — "a two-signal hybrid weighs 0.5 against a pipeline built from one of its own components, and the three-signal hybrid weighs at most 2/3 against a single-signal pipeline." Arithmetic re-verified: 1 − Jaccard({t,s,m},{t}) = 1 − 1/3 = 2/3; 1 − Jaccard({t,s},{t}) = 0.5. Code and thesis now agree. |
| 3 | Metadata query-type asymmetry | **PASS** | Ch1:17 (intro: "On seed-paper searches all four metadata signals are active; on free-text queries only the title signal is available, because abstract, keywords, and year are absent from the query"); Ch1:128 (Definition of Terms, "Metadata component": same disclosure verbatim); Ch3:54 (metadata description: "Free-text queries supply only the title slot… the metadata component degenerates to title similarity. Metadata-inclusive pipelines therefore behave differently under the two search modes, and the Arena analysis stratifies results by query type"). Code confirmed: `metadata_pipeline.py:121–148` `_get_query_metadata` returns title only for text queries, abstract/keywords/year = None. |
| 4 | Reimers & Gurevych page range | **PASS** | Ch3:210 — "(pp. 3980–3990)" matches `references.bib:97` — "pages = {3980--3990}" (ACL Anthology D19-1410). Grep confirms no "3982" remains in any chapter body; the only occurrence is the Ch2 HTML verification comment documenting the brief's original error (intentional provenance, Ch2:139). |
| 5 | Dev runs reset before campaign | **PASS** | Ch3:167 — "Runs logged during development walkthroughs exercised the instrument and are excluded from the reported results: the researchers will reset the battle history before the campaign, so the win tally, champion, and streaks reflect the formal runs only." Consistent with the live DB: the 18 existing `battle_runs` rows (winner_metric "consensus_votes", an older metric name) predate the current independence-weighted implementation (`models.py:361` default is now `independence_weighted_consensus`) — exactly the provenance problem the reset solves. The reset approach is schema-compatible (no run_type column exists). |
| 6 | Consensus tie-break | **PASS** | Ch3:161 — "then by average rank, then by paper id." `compare_service.py:260–266` sorts by (−votes, avg_rank, paper_id); `best_rank` is computed (line 256) but unused in ordering. Grep confirms no "best rank" remains in chapter text. |
| 7 | Top-K range | **PASS** | Ch1:32 ("at a top-K of 5, 10, or 15"); Ch1:146 ("the Arena interface offers K values of 5, 10, and 15, while the backend accepts up to 25"); Ch3:161 ("the interface offers 5, 10, and 15"). Code confirmed: `Evaluation.tsx:288–290` options Top 5 / Top 10 / Top 15; `compare_service.py:83` `top_k` ge=1 le=25. |
| 8 | "Four comparisons" | **PASS** | Ch1:32 — "reports four comparisons (Table 2): consensus ranking, pairwise agreement, the independence-weighted consensus winner, and the win tally with battle history." Consistent with RQ 2.1–2.4 (Ch1:62–70) and Table 2 (pairwise split into overlap@k and mean rank gap, matching RQ 2.2). No "three comparisons" remains. |
| 9 | Normalization phrasing qualified | **PASS** | Ch1:17 ("TF-IDF and S-BERT component scores are min-max normalized… while metadata scores are already bounded in the 0 to 1 range and pass through unchanged"); Ch2:31 (same qualification); Ch3:71 ("TF-IDF and S-BERT raw scores are min-max normalized to [0, 1] (the degenerate all-equal case maps to 1.0), while metadata scores are already bounded in [0, 1] and pass through unchanged"). Code confirmed: `metadata_pipeline.py:22` "Each individual signal is already bounded between 0 and 1." |
| 10 | Hypothesis ordering/wording identical Ch1 ↔ Ch2 | **PASS** | Ch1:76–82 vs Ch2:117–123 — identical pair order (consensus capture first, ranking agreement second) and identical measure wording ("independence-weighted consensus winner"; "pairwise overlap at K and mean rank gap"). No drift. |
| 11 | Campaign query set | **PASS (honest)** | Ch3:167 — "free-text queries and seed papers selected to cover the repository's subject classifications, at top_k values of 5, 10, and 15. The campaign size and the selection rule will be fixed before data collection." The open parameter is now stated as an open parameter with a binding condition (fixed before collection). For a proposal-stage draft whose campaign has not run, this is the honest treatment; it is carried forward as a pre-collection gate in the roadmap (no fail). |
| 12 | Appendix cross-references | **PASS** | Ch3:105 — "The main interfaces are reproduced in Appendix A: the login page (Figure A-1), the recommendations page… (Figure A-2), the repository page (Figure A-3), the upload page (Figure A-4), the My Library page (Figure A-5), and the Arena page with battle results and battle records (Figures A-6 and A-7)." Appendix A captions match; all seven PNGs exist on disk (`thesis-paper/appendix/screenshots/01-login.png` … `07-arena-records.png`). |

**Result: 12 / 12 PASS, 0 PARTIAL, 0 FAIL.**

### Cross-Section Re-Checks (drift detection after editing)

| Check | Status | Evidence |
|---|---|---|
| (a) Citation orphans | **Pass** | Scripted author-key cross-check: Ch1 cites 8, Ch2 cites 21, Ch3 cites 5 — exactly the Round-1 counts; all 21 are in references.bib; Ch1/Ch3 citations are strict subsets of the 21. Zero orphans in either direction. |
| (b) Corpus numbers | **Pass** | Live DB re-checked (2026-10-01): `SELECT COUNT(*) FROM papers` = 168; `is_valid_for_recommendation = 1` = 146. Chapters agree with each other and with the DB: Ch1:32, Ch1:102, Ch3:167, Ch3:194. |
| (c) Stale wording | **Pass** | Grep across all thesis files for "significant difference", "best rank", "3982", "weighs at most 0.5", "three comparisons", "between 5 and 25", "158 distinct": zero hits in any chapter body or appendix. The only hits are (i) the Round-1 report itself (expected) and (ii) the Ch2 verification comment block quoting the original brief's error (intentional provenance, Ch2:139). |
| Bonus: compiled artifacts current | **Pass** | `ReSearch-thesis-proposal.docx` / `.pdf` regenerated 2026-10-01 16:30, identical timestamp to the chapter edits — the compiled proposal reflects the revision. |
| Bonus: no new inconsistency from the edits | **Pass** | Ch3:161 "computes four structures" (per-pipeline results, consensus, pairwise, winner) vs Ch1:32 "four comparisons" (consensus, pairwise, winner, tally) — tally is a logged output, not a comparison structure; no contradiction. DB battle_runs carry the legacy "consensus_votes" metric while the current code logs `independence_weighted_consensus` — consistent with the documented reset-and-recollect plan. |

---

## Part B — Fresh Multi-Perspective Review (Round 2)

### 1. Editor-in-Chief

**Strengths.** Title exactly matches content; disclosure statements in all three chapters plus the Ethical Considerations section; every table (Ch1 Tables 1–2; Ch3 Tables 1–3) is referenced in text; the uncaptioned tech-stack table is a deliberate, documented choice (Ch3:216); Figures A-1…A-7 are now individually cross-referenced (Ch3:105) and all image files exist; compiled .docx/.pdf are current with the revision. The Round-1 Critical (untestable hypotheses) and both reference conflicts are resolved without collateral damage.

**Issues.**
- [Minor] The HTML verification/audit blocks (Ch1:148–153, Ch2:125–206, Ch3:214–221) are exemplary transparency for review but must be stripped or moved to an appendix before submission; Ch2:73's own comment already flags this. Do it in the final scrubbing pass, not during a panic.
- [Minor] The Ch2 comment block's provenance material (brief's wrong DOI, wrong pages, "Gievska" author) reads as reviewer-facing audit trail; compress to a two-line "metadata corrected per Crossref/ACL" note if kept.

**Concrete fixes.** (1) One pre-submission pass: delete all `<!-- -->` blocks from the three chapters; keep the AI-disclosure sentences (required) in the preamble or ethics section. (2) Confirm the docx/pdf export re-run after that pass.

### 2. Peer Reviewer 1 — Methodology

**Strengths.** Descriptive-developmental design maps cleanly onto RQs 1–3 (Ch3:9–11); the Arena protocol is the most code-faithful section of the manuscript (weights, formulas, tie-breaks, winner share, battle_runs schema all verified); the hypotheses are now answerable from the stated analysis (Ch3:186); the reset-before-campaign rule closes the dev-run contamination hole; the query-type asymmetry is disclosed and stratification is promised.

**Issues.**
- [Minor] The stratification promise lives in the System Framework section (Ch3:54) but the Data Processing and Analysis section (Ch3:171–186) never operationalizes it: which statistics are computed per query type, and how the overall tally relates to the per-stratum tallies, is unspecified. As written, a reader could follow the analysis plan and produce only pooled tallies.
- [Minor] "This study will test the following hypotheses" (Ch1:74, Ch2:115) retains the "test" verb for hypotheses that are assessed descriptively; committee readers may expect accept/reject language that Ch3:184 rules out.
- [Moderate] Campaign size and selection rule are still open (Ch3:167). Correctly disclosed as to-be-fixed, but it is the single remaining parameter that must be pinned before data collection; the report cannot yet judge whether the evidence plan is adequate (e.g., n per subject class, per top_k).

**Concrete fixes.** (1) In Ch3 Data Processing and Analysis, add one sentence: win shares, overlap@k, mean rank gap, and the champion tally are computed overall and separately for query-type runs and seed-paper runs, and per subject class where counts allow. (2) Change "test the following hypotheses" to "examine the following hypotheses descriptively" in both chapters. (3) Fix n and the selection rule before collection (roadmap gate).

### 3. Peer Reviewer 2 — Information Retrieval / Recommender Systems

**Strengths.** Every system claim survives re-verification against the code — six weights, metadata formula, normalization (degenerate → 1.0), independence weighting, tie-breaks, endpoints, duplicate threshold, rebuild order. The literature grounding is the right set for this study: domain surveys (Beel et al., 2016; Bai et al., 2019; Kreutz & Schenkel, 2022), embedding SOTA (SPECTER, SciNCL, TaxoIndex), the metadata-fusion caution (Bhagavatula et al., 2018), and offline-evaluation conventions (Herlocker et al., 2004; Shani & Gunawardana, 2011; Thakur et al., 2021). Related studies are honestly characterized (SPECTER's SciDocs results, BEIR's BM25 finding, the Lipa City Colleges system as a documentation system, not a recommender). The corrected independence bound is now arithmetically exact and the anti-confounding rationale is sound: agreement with a disjoint pipeline is the strongest evidence available without human judgments.

**Issues.**
- [Minor] The winner metric's centrist-bias risk is undiscussed: a pipeline can win by being the best *average* of its competitors, not the best recommender. Limitations #3 covers the human-relevance gap, but one sentence acknowledging that the winner rewards agreement-broadness (and that two pipelines agreeing can both be wrong together) would preempt the obvious referee objection.
- [Minor] On free-text queries the metadata component degenerates to title similarity, which the draft now discloses; the campaign therefore evaluates *two different metadata components* across the two search modes. Stratification is the right answer, but the thesis should state explicitly that any conclusions about metadata-inclusive pipelines are query-type-specific, not generic.
- [Note] Robertson & Zaragoza (2009) remains a motivational citation (normalization care), not a component — acceptable as carried, flagged in Round 1 without action.

**Concrete fixes.** (1) Add 1–2 sentences to the winner-metric description (Ch3:161) or Limitations: "The winner is a measure of agreement breadth under independence weighting; agreement is not evidence of correctness, and pipelines can agree in error together." (2) In Ch3:54 or 186: "Conclusions about metadata-inclusive pipelines apply per query type." (3) Optionally report the corpus's subject-class composition at campaign time so lexical-bias claims (Limitation #5) are checkable.

### 4. Peer Reviewer 3 — Thesis Committee / Cross-Disciplinary

**Strengths.** Excellent fit to the BSMCS program: the study exercises both the mathematics (vector space model, cosine similarity, Jaccard-based weighting, aggregation statistics) and computer science (FastAPI/React/SQLite engineering, testing discipline) strands. Scope discipline is a model for undergraduate work: exclusions are explicit (no collaborative filtering, no OCR, no multi-node, one embedding model, no production deployment), significance claims are modest and bounded, and seven limitations are stated — including the honest admission that the Arena cannot certify real-user relevance (Limitation #3). Ethics are appropriate for a no-human-subjects, public-corpus, single-machine study. The local-evidence gap (only one verified Philippine study, honestly characterized) is handled with unusual integrity rather than padding.

**Issues.**
- [Minor] Ch1:88 ("Arena results show which configurations to trust when searching") slightly overstates what agreement-internal evidence can support; "trust" implies relevance quality the study explicitly declines to certify. Align with Limitation #3.
- [Minor] A committee will ask why no human sanity check at all (e.g., a faculty spot-check of top-10 lists). The delimitation is defensible for an undergraduate offline study, but one sentence in "Significance → Future researchers" already gestures at human evaluation (Ch1:96); make the "why not now" explicit in Limitations.

**Concrete fixes.** (1) Soften Ch1:88 to "which configurations to expect to agree with the broadest set of independent signals." (2) Add to Limitations #3 a clause: "Human evaluation is deferred to future work because the study's purpose is the controlled comparison of configurations on one corpus, not the certification of user-facing quality."

### 5. Devil's Advocate — Attack the Core Argument

**Attack 1: Is the "winner" meaningful without human relevance judgments?** The winner is a construct: the pipeline capturing the largest independence-weighted share of other pipelines' agreement. It is a measure of consensus-broadness, not of relevance. The draft is now honest about this (Limitation #3, Ch3:186 "evidence about which configurations agree with the widest set of independent signals"), and the RQ is framed as an evaluation of configurations, not a claim about users. Verdict on attack: acknowledged and bounded; residual weakness is the Ch1:88 "trust" phrasing (see PR3) and the absence of any statement about the centrist-bias risk (see PR2).

**Attack 2: Is comparative agreement evidence of quality or just redundancy?** The independence weighting removes the *mechanical* redundancy (a hybrid cannot be confirmed by its own components). It cannot remove *shared bias*: TF-IDF and S-BERT may both rank the same wrong papers if the corpus is homogeneous, and two wrong pipelines agreeing is still agreement. The draft's corrected 2/3 bound shows the weighting is exact, but the study's evidence remains agreement-internal by design; the gap to human judgments is disclosed, not closed. Verdict on attack: the claim is now scoped correctly ("agreement evidence," not "quality evidence"); a sentence on shared-bias residual risk would complete the defense.

**Attack 3: Are the hypotheses now actually answerable descriptively?** Yes — win shares, average consensus ranks, overlap@k, and mean rank gap are all computable from battle_runs and each maps to a hypothesis (Ch3:186). The residual rhetorical risk is the H₀/H₁ "no difference / difference" framing with no inferential test: a reader may expect rejection language. The draft avoids it (Ch3:184) but never says so explicitly; one sentence ("no accept/reject language is used; the statistics describe observed differences") closes the loophole.

**Attack 4: Could the campaign be gamed by corpus composition?** Yes, and the draft's defenses are (a) the query set "covers the repository's subject classifications" (Ch3:167 — rule still to be fixed), (b) single-corpus limitation #1, and (c) lexical-bias limitation #5. Weakest point: the subject-class stratification of *results* is not in the analysis plan; if the corpus is dominated by a few classes, TF-IDF vocabulary effects and the year signal's weakness could drive wins without being visible. Fix: report win shares per subject class and per query type alongside the pooled tally.

**Overall DA verdict:** The core argument survives because it was progressively narrowed to what the instrument can actually show. The remaining vulnerabilities are text-level (phrasing, missing sentences), not design-level.

---

## Dimension Scores

| Dimension | Weight | Round 1 | Round 2 | Key Evidence (Round 2) |
|-----------|--------|---------|---------|------------------------|
| Originality | 20% | 6.0 | **6.0** | Contribution unchanged but now airtight: controlled same-family comparison (Ch2 gap items 1–2), exact independence weighting, first verified Philippine comparative claim. Component techniques remain standard; novelty sits in the instrument. No score change — the revision fixed accuracy, not novelty. |
| Methodological Rigor | 25% | 5.0 | **7.5** | Hypotheses now descriptive and answerable (Ch1:76–82, Ch3:186); independence bound exact (Ch3:161); query-type asymmetry disclosed + stratification promised (Ch3:54); dev-run contamination closed (Ch3:167); tie-break exact (Ch3:161). Residual: stratification not operationalized in the analysis section; campaign n/rule still open (honestly flagged); "test the hypotheses" verb. |
| Evidence Sufficiency | 25% | 6.0 | **7.5** | All fixes verified against code and live DB; 168/146 re-confirmed live; 21/21 citations, zero orphans; reference conflict resolved (3980–3990 both places); quantitative literature claims as-reported. Residual: the evidence plan's campaign size/rule is a declared to-be-fixed parameter. |
| Argument Coherence | 15% | 6.0 | **8.0** | RQ→design→hypotheses→analysis mapping is now coherent end-to-end; "four comparisons" consistent with RQ 2.1–2.4; Ch1/Ch2 hypotheses identical; no stale wording anywhere. Residual: "test" vs descriptive assessment; "computes four structures" vs "four comparisons" micro-drift (non-contradictory); "trust" phrasing (Ch1:88) slightly exceeds the agreement-internal scope. |
| Writing Quality | 15% | 8.0 | **8.0** | Unchanged: clean, dense, precise prose; consistent tense discipline; well-formed tables; no AI clichés; disclosure practice exemplary. Long sentence at Ch1:32 (the four-comparisons sentence) remains the only stylistic wart. |
| **Overall** | — | **6.05** | **7.35** | 6.0×0.20 + 7.5×0.25 + 7.5×0.25 + 8.0×0.15 + 8.0×0.15 = 1.20 + 1.875 + 1.875 + 1.20 + 1.20 = **7.35** |

---

## Editorial Decision

**Verdict: Minor Revision** (Round 1: Major Revision, 6.05 → Round 2: 7.35, +1.30).

**Rationale.** All 12 Round-1 priority items verified as landed in the files (12/12 PASS), with the exact substance claimed in the "Revisions Applied (Round 2)" table; all cross-section re-checks pass; no new inconsistencies were introduced by the edits; the compiled .docx/.pdf are current. The Round-1 Critical (untestable hypotheses) and both Major accuracy defects (false independence bound, undisclosed query-type asymmetry, dev-run pooling, citation conflict) are resolved. The residual items are Minor in severity — two of them must be completed before data collection, but they are already acknowledged as open parameters in the manuscript itself.

**Score change vs Round 1:** +1.30 (6.05 → 7.35). Methodological Rigor +2.5 and Evidence Sufficiency +1.5 from the verified closure of the Critical + four Major items; Argument Coherence +2.0 from the hypotheses/ordering/tie-break/wording fixes; Originality and Writing Quality unchanged. The residual 2.65 gap to Accept is now almost entirely text-level polish plus one pre-collection parameter, not design risk.

### Revision Roadmap (Round 3)

**Critical:** none.

**Major:** none.

**Minor (fix before submission / data collection):**

1. **Operationalize the query-type (and subject-class) stratification in the analysis plan.** Ch3 Data Processing and Analysis (Ch3:171–186): add a sentence stating that win shares, overlap@k, mean rank gap, and the champion tally are computed overall *and* separately for query-type vs seed-paper runs, and per subject class where counts allow. The promise currently lives only in Ch3:54. (PR1, PR2, DA-4)
2. **Add the "descriptive interpretation only" sentence.** Ch3:186 (or Ch3:184): "No accept/reject language is used for the hypotheses; the statistics describe observed differences within the bounds of the Limitations." Preempts committee confusion over descriptive H₀/H₁. (PR1, DA-3)
3. **Align the "trust" claim with the agreement-internal scope.** Ch1:88 — change "which configurations to trust when searching" to "which configurations to expect to agree with the broadest set of independent signals." Optionally add the centrist-bias/shared-bias one-liner in Ch3:161 or Limitations #3 ("agreement is not evidence of correctness; pipelines can agree in error together"). (PR2, PR3, DA-1/2)
4. **Change "test the following hypotheses" → "examine/assess the following hypotheses descriptively"** in Ch1:74 and Ch2:115. (PR1)
5. **Pin the campaign parameters before data collection (stated as a gate in Ch3:167).** Decide and record: n queries and n seed papers, selection rule (stratified by subject class), top_k per stratum (5/10/15), and whether the tally is reported per top_k or pooled. Also record the corpus's subject-class composition at campaign time. (PR1, PR3, DA-4)
6. **Housekeeping before submission.** Strip the HTML verification/audit comment blocks (Ch1:148–153, Ch2:125–206, Ch3:214–221) or move the audit trail to a separate appendix; keep the AI-disclosure sentences in the ethics section. Re-run the .docx/.pdf export afterward. (EIC)
7. **Optional:** one sentence in Limitations #3 deferring human evaluation to future work explicitly (Ch1:96 already gestures at it). (PR3)

---

## What Changed vs Round 1 — Statement

Score rose from 6.05 (Major Revision) to 7.35 (Minor Revision). The +1.30 comes entirely from the verified closure of the Round-1 Critical and Major items: (a) hypotheses reframed descriptively with a direct assessment path in Ch3:186 (+Rigor, +Coherence); (b) independence bound corrected to exactly 0.5 / at most 2/3 in both the thesis and the code docstring (+Rigor, +Evidence); (c) metadata query-type asymmetry disclosed in three places and stratification promised (+Rigor); (d) Reimers & Gurevych pages aligned on 3980–3990 everywhere (+Evidence); (e) dev-walkthrough runs excluded via pre-campaign reset, consistent with the live DB (+Rigor); and the six Minor items (tie-break, Top-K, four comparisons, normalization phrasing, hypothesis pair order, appendix cross-references) all verified. No score was added for Originality or Writing Quality because the revision was corrective, not additive. The remaining items are Minor and largely editorial; the manuscript is one polish pass plus one pre-collection decision away from Accept-range.

---

## Round-3 Revisions Applied (2026-10-01)

All Round-3 Minor roadmap items were applied in one pass, plus the requested future-tense pass:

1. **Stratification operationalized** — Ch3 Data Processing and Analysis now states every statistic is computed overall, per query type (free-text vs seed-paper runs), and per subject class where counts allow; metadata-inclusive conclusions reported per query type.
2. **Descriptive-interpretation sentence** — Ch3:186: "No accept/reject language will be attached to the hypotheses; the statistics will describe observed differences…"
3. **"Trust" claim aligned** — Ch1:88 now reads "Arena results will show which configurations to expect to agree with the broadest set of independent signals"; winner-metric caveat added in Ch3:161 ("agreement breadth under independence weighting, not of correctness; pipelines can agree in error together").
4. **Hypothesis verb fixed** — Ch1 and Ch2: "will examine the following hypotheses descriptively".
5. **Campaign pinned** — Ch3:167: 36 runs (six largest subject classifications × one query + one seed paper × top_k 5/10/15), subject-class composition recorded before collection (composition at writing: Machine Learning 100, Mathematical Analysis 20, Mathematical Modeling 15, Graph Theory 13, Linear Algebra 10, IR 3, Algorithms 1, NULL 6; recorded in audit-trail.md).
6. **Housekeeping** — HTML audit/verification comment blocks stripped from all three chapters; visible AI-Assisted Research Disclosure sections added; full provenance preserved in `thesis-paper/audit-trail.md`.
7. **Future tense** — Ch3 analysis section converted to future tense ("will report", "will be applied", "will be assessed"); Ch1 significance "will show".
8. **Human-evaluation deferral** — Limitations #3 now states why not now.

Compiled artifacts regenerated: `ReSearch-thesis-proposal.docx` / `.pdf` (2026-10-01 16:42).