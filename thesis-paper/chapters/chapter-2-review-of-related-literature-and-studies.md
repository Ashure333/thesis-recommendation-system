# CHAPTER II

## REVIEW OF RELATED LITERATURE AND STUDIES

The recommendation prototype developed in this study combines three retrieval signals, TF-IDF lexical matching, S-BERT semantic embeddings, and a metadata score over title, abstract, keywords, and publication year, into six fixed-weight pipeline configurations, then compares those configurations in an Arena that records consensus rankings, pairwise agreement, and an independence-weighted winner. Its design draws on four bodies of work: content-based filtering theory, the information retrieval models that give lexical and semantic matching their form, hybrid recommender design, and offline evaluation practice. This chapter reviews the theories, literature, and studies behind those bodies, offers a synthesis with a gap analysis restated as design requirements, and closes with the conceptual framework and hypotheses.

### Related Theories

Content-based filtering theory supplies the study's first principle. Lops et al. (2011) define a content-based recommender as a system that profiles items by their attributes and recommends items whose profiles match the profile of a query item or a learned user profile, with no reliance on the ratings of other users. For textual items the profile is a structured representation of the document's content, and matching is a similarity computation over those representations (Lops et al., 2011). The prototype applies this principle directly: a paper record's prepared text, built from title, abstract, and keywords, is the profile; the seed paper or text query is the comparison point; and cosine similarity produces the ranking.

The vector space model and term weighting give the lexical signal its theoretical form. Salton and Buckley (1988) established that single-term indexing with appropriately weighted terms retrieves at least as well as more elaborate text representations and identified the composite term frequency by inverse document frequency (tf-idf) weight as the operative baseline. Manning et al. (2008) formalize the model in the standard textbook treatment: documents and queries become vectors in a term space, term weights combine frequency with collection-level rarity, and cosine similarity ranks documents by the angle between vectors. The prototype's TF-IDF pipeline implements exactly this model, fitting its vectorizer on the local corpus.

Distributed semantic representations extend the same vector-space idea from vocabulary to meaning. Devlin et al. (2019) showed that BERT, a deep bidirectional transformer pre-trained on masked language modeling, produces contextual representations that set new results across natural language tasks. BERT's representations are token-level, however, and comparing whole documents with them is heavy. Reimers and Gurevych (2019) answer with Sentence-BERT (SBERT), a siamese arrangement of BERT networks that pools token representations into fixed-size sentence embeddings comparable with cosine similarity in seconds rather than hours. The prototype's S-BERT pipeline embeds prepared text with the all-MiniLM-L6-v2 sentence-transformer and scores candidates by cosine similarity, the use case SBERT was designed for (Reimers & Gurevych, 2019).

Hybrid recommender theory explains why the study runs six configurations instead of one. Burke (2002) surveyed the hybrid space and distinguished seven hybridization designs: weighted, switching, mixed, feature combination, cascade, feature augmentation, and meta-level. The weighted design computes a recommendation as a linear combination of the scores of the component techniques and is the most direct way to fuse signals (Burke, 2002). Each of the prototype's hybrid configurations is a weighted combination, TF-IDF plus S-BERT at equal weight, either lexical signal plus metadata at two-to-one weight, and the full three-signal mix at 40-40-20, so the study compares within Burke's weighted family rather than across incomparable architectures.

Metadata and attribute-based similarity form the third signal's theoretical base. Because content-based profiles are attribute vectors (Lops et al., 2011), publication metadata can participate in the same matching logic: the prototype scores title, abstract, and keyword similarity by cosine over normalized text and publication-year similarity by temporal closeness, then averages the four equal-weight terms. Two general theories frame the surrounding field. Adomavicius and Tuzhilin (2005) survey recommender systems and categorize approaches by recommendation method, input data, and context, situating content-based and hybrid methods inside the field's larger taxonomy. Ricci et al. (2011) frame recommendation as a decision-support function that prunes large information spaces on the user's behalf. Both frame the present study's contribution: a comparative evaluation of recommendation pipelines, not a new recommendation algorithm.

### Related Literature

#### Recommender Systems and the Research-Paper Domain

The recommender field matured from a collaborative-filtering origin into a family of techniques whose design and evaluation questions the present study inherits (Adomavicius & Tuzhilin, 2005; Ricci et al., 2011). Within that field, research-paper recommendation is a distinct domain with its own literature. Beel et al. (2016) reviewed more than 200 articles on research-paper recommenders and reported that content-based filtering dominated, applied by 55 percent of approaches, that TF-IDF was the most frequently used weighting scheme, and that collaborative and graph-based methods were minorities. Bai et al. (2019) surveyed the field with a similar conclusion: content-based, collaborative, graph-based, and hybrid methods coexist, and hybrid combinations recur as the natural response to any single method's weaknesses. Together the two surveys establish the domain conventions the prototype follows: content-based signals as the core, hybrid fusion as the improvement path, and TF-IDF as the standard lexical baseline.

#### The Vocabulary-Mismatch Problem

Lexical retrieval fails when the query and the document say the same thing in different words. Manning et al. (2008) treat synonymy and polysemy as inherent limits of term-based matching in the vector space model, and Salton and Buckley (1988) already noted that weighting schemes cannot repair a vocabulary mismatch the representation never bridges. Dense embeddings exist to close exactly this gap: Reimers and Gurevych (2019) demonstrated that SBERT embeddings capture semantic similarity between sentences that share no words. The prototype's two-representation design, TF-IDF for lexical overlap and S-BERT for semantic proximity, is the standard division of labor for this problem, and the Arena's pairwise agreement statistics will quantify how far the two representations diverge on the same corpus.

#### Fusion and Normalization of Heterogeneous Signals

Combining signals requires handling scales that do not share units: a TF-IDF cosine, a transformer cosine, and a metadata score each live on their own distribution. Burke (2002) observed that weighted hybrids are only as sound as the score normalization underneath them. Robertson and Zaragoza (2009), in the probabilistic relevance framework, show that BM25-family models combine term-frequency and document-length evidence under principled normalization, a reminder that combination formulas deserve the same care as the signals themselves. The prototype min-max normalizes TF-IDF and S-BERT scores into the 0-1 range before weighting, while metadata scores are already bounded and pass through unchanged; its metadata formula gives each of four signals a fixed quarter weight with missing fields contributing zero, so a paper cannot inflate its score by omitting fields. Empirical hybrid studies show the same attention to fusion. Polignano et al. (2021) combine graph embeddings with contextualized word representations in a hybrid architecture and report that the learned fusion improves over single-signal baselines. Bhagavatula et al. (2018), working in content-based citation recommendation, found that adding metadata improves standard ranking metrics but favors self-citations, a warning that metadata fusion can distort ranking goals even when it lifts scores. The Arena answers that warning with an explicit rule: agreement between two pipelines counts only in proportion to the independence of their component sets, so no pipeline can be confirmed by its own hybrids.

#### Offline Evaluation Conventions

Recommender evaluation has settled conventions that the study adopts. Herlocker et al. (2004) review the key decisions in evaluating recommender systems, the user tasks, datasets, and the choice among prediction-quality, classification, and ranking metrics, and report empirically that accuracy metrics collapse into a few strongly correlated classes. Shani and Gunawardana (2011) structure evaluation into offline experiments, online experiments, and user studies, noting that offline evaluation with ranking metrics is the standard first gate because it requires no users and no deployed system. For retrieval models specifically, Thakur et al. (2021) built BEIR, a heterogeneous zero-shot benchmark of 18 datasets, and found that BM25 remains a robust lexical baseline while dense models vary widely across domains. These conventions justify the study's offline design: one corpus, one query set, fixed top-k, and agreement statistics computed from logged runs rather than from user panels.

### Related Studies

#### Local Studies

The only Philippine study in the reviewed corpus that touches this domain is a documentation system rather than a recommender. De la Cruz and Diesta (2019) implemented the LCC Thesis Citation System, an in-house library database for Lipa City Colleges that houses the bibliographic records of student and faculty research collections. The system assessed which theses were most and least cited, helped academic departments identify feasible research topics and agendas, and was evaluated after implementation to decide which factors to add to or delete from the pilot design (De la Cruz & Diesta, 2019). The study is the closest verified Philippine precedent for institutional thesis repositories, and its framing shows the gap the present study addresses: Lipa City Colleges organized records and counted citations, but no automated similarity ranking or recommendation appears in the published account. No Philippine study of a content-based or hybrid thesis recommendation system could be verified during the literature search for this chapter.

#### International Studies

##### Surveys of Paper Recommendation Systems

Kreutz and Schenkel (2022) reviewed the recent literature between January 2019 and October 2021, analyzing 65 system papers along 20 dimensions covering data sources, methods, datasets, and evaluation measures. Their classification shows the field's texture: most systems use titles, abstracts, or keywords, most recommend single papers in response to an input paper or query, embeddings and cosine similarity appear across many approaches, and hybrid and graph-based methods dominate recent work (Kreutz & Schenkel, 2022). The survey also compiles the evaluation measures actually used, giving the study a checklist for its own reporting.

##### Embedding-Based Paper Recommendation and Retrieval

SPECTER, introduced by Cohan et al. (2020), pre-trains a transformer on citation-informed triplets so that document embeddings reflect inter-document relatedness, and outperforms competing baselines on the seven tasks of the SciDocs benchmark, including recommendation. Ostendorff et al. (2022) refine the idea with SciNCL, which samples contrastive training pairs from citation-graph neighborhoods rather than discrete citation links, and report state-of-the-art results on SciDocs together with sample-efficient training. Kang et al. (2024) take a different route to the same goal: TaxoIndex organizes extracted paper concepts into a taxonomy-guided semantic index and uses it to enhance dense retrievers for academic paper search, with significant gains and improved interpretability. These three studies demonstrate that transformer-based document representations are the current state of the art for paper similarity, and they are the reason the prototype pairs a classical lexical pipeline with a transformer pipeline rather than relying on either alone.

##### Content-Based Citation Recommendation with Metadata

Bhagavatula et al. (2018) propose a content-based method that embeds a query document, retrieves nearest neighbors, and reranks candidates with a discriminative model, outperforming prior results on PubMed and DBLP by wide margins without using metadata at all. Their secondary finding bears directly on this study: adding metadata improved standard metrics but favored self-citations, which are less useful in a citation recommendation setting (Bhagavatula et al., 2018). The present study's metadata design internalizes that caution: metadata enters only through a fixed equal-weight formula, its share of the final score is fixed at one third or one fifth, and the Arena's independence weighting ensures that a pipeline cannot be confirmed by its own metadata-enriched hybrids.

##### Hybrid Fusion of Heterogeneous Representations

Polignano et al. (2021) present the most direct empirical precedent for the study's fusion question. Their hybrid framework generates graph embeddings and contextualized word representations separately, then learns a fused representation that improves over either signal alone (Polignano et al., 2021). The present study differs from theirs in design and purpose: the fusion weights here are fixed and transparent rather than learned, and the comparison covers a full family of two-signal and three-signal configurations, not a single fused model against its components.

##### Offline Evaluation of Recommenders

Herlocker et al. (2004) provide the classic treatment of evaluation design, and Shani and Gunawardana (2011) the canonical chapter on offline evaluation, both of which the study's protocol follows: offline logs, ranking-level analysis, and agreement measures rather than single accuracy numbers. Thakur et al. (2021) add the zero-shot perspective, showing that lexical baselines remain competitive and that benchmark heterogeneity matters; the Arena applies that lesson by fixing the corpus, query, and depth across all six pipelines so that observed differences are attributable to the pipelines themselves.

### Synthesis of the Review of Literature and Studies

#### Convergences

Four convergences shape the study's design. First, content-based signals dominate paper recommendation: the two major surveys and the recent review all report content-based filtering as the field's core approach, with TF-IDF as its most common weighting scheme (Bai et al., 2019; Beel et al., 2016; Kreutz & Schenkel, 2022). Second, hybrid fusion is the accepted route to robustness: Burke's (2002) taxonomy treats combination as a design space, and empirical work reports fusion gains (Polignano et al., 2021). Third, transformer-based document embeddings are the current state of the art for semantic paper matching (Cohan et al., 2020; Kang et al., 2024; Ostendorff et al., 2022). Fourth, evaluation is overwhelmingly offline and ranking-based, with agreement and ranking metrics preferred over raw prediction error (Herlocker et al., 2004; Shani & Gunawardana, 2011; Thakur et al., 2021).

#### Contradictions and Limitations

The literature disagrees on which representation is best. Beel et al. (2016) report that no approach is consistently superior and that results vary by corpus; Thakur et al. (2021) find BM25 robust and dense models uneven in zero-shot settings; and Cohan et al. (2020) and Ostendorff et al. (2022) show citation-informed transformers leading on SciDocs. Each result is measured on a different benchmark, so the contradictions may be an artifact of incompatible evaluations. That is the first limitation: there is no shared benchmark across studies, and even within a study, hybrid gains are usually established against baselines borrowed from other works rather than against a controlled family of configurations on one corpus. A second limitation is that metadata fusion is rarely examined as a controlled variable: Bhagavatula et al. (2018) report its distortionary effect, and Kreutz and Schenkel (2022) list metadata use as a dimension but not a systematically varied one. A third limitation is local: the verified Philippine corpus contains no thesis or paper recommender at all, only bibliographic and citation-counting systems (De la Cruz & Diesta, 2019).

#### Gap Analysis

1. **Same-family comparison gap.** No verified study compares a family of hybrid configurations that differ only in fusion weights on one corpus, one query set, and one top-k. Studies compare distinct architectures across benchmarks (Beel et al., 2016; Polignano et al., 2021).

2. **Weighted metadata fusion gap.** Metadata is added or withheld (Bhagavatula et al., 2018) but not fused under fixed, transparent weights and compared against its unweighted counterparts.

3. **Agreement-quantification gap.** The lexical and semantic mismatch is described theoretically (Manning et al., 2008; Reimers & Gurevych, 2019) but rarely measured as pairwise agreement between pipelines on the same corpus.

4. **Anti-confounding gap.** No verified study prevents a hybrid from being validated by its own components, a design flaw the prototype's independence-weighted consensus rule addresses explicitly.

5. **Local-evidence gap.** No verified Philippine study evaluates a thesis or paper recommender (De la Cruz & Diesta, 2019).

Each gap maps to a design decision in the prototype:

1. *Same-family comparison gap* → the Arena runs all six configurations against the same query with the same top-k and logs every run.
2. *Weighted metadata fusion gap* → a fixed equal-weight metadata formula (0.25 × title, abstract, keywords, year; missing fields score zero) enters hybrids at fixed one-third or one-fifth shares.
3. *Agreement-quantification gap* → the Arena reports consensus votes, average rank, pairwise overlap, and mean rank gap for every pair of pipelines.
4. *Anti-confounding gap* → the winner metric weights each vote by one minus the Jaccard overlap of the two pipelines' component sets, so a pipeline cannot be confirmed by its own hybrids.
5. *Local-evidence gap* → the study will produce the first verified comparative evidence for content-based thesis recommendation in a Philippine university setting.

### Conceptual Framework

The framework is an input-process-output model for the study. Inputs: (a) a paper corpus imported from PDFs and BibTeX records and validated for recommendation completeness (title, abstract, keywords, publication year); (b) a query text or seed paper; (c) six weight configurations over TF-IDF, S-BERT, and metadata signals (Burke, 2002). Process: prepared text will be normalized from title, abstract, and keywords → TF-IDF vectors and S-BERT embeddings will be generated and stored → the metadata score will be computed with the fixed equal-weight formula → the weighted score combination will rank candidates per configuration → the Arena will compare configurations by consensus ranking, pairwise agreement, and independence-weighted winner → battle runs will be logged. Outputs: the framework will yield ranked recommendation lists per pipeline, consensus and pairwise statistics, an independence-weighted winner with a win tally across runs, and design recommendations for hybrid content-based paper recommenders.

```
INPUTS -----------------> PROCESS ----------------------> OUTPUTS
Paper corpus             Prepared text will be           will yield ranked
imported from            normalized; TF-IDF              recommendations per
PDFs and BibTeX,         vectors and S-BERT              pipeline; consensus
validated for            embeddings will be              and pairwise
recommendation;          generated; metadata             statistics; an
query or seed            score will be computed;         independence-weighted
paper; six weight        weighted scores will            winner and win tally;
configurations           rank candidates; Arena          design recommendations
                         will compare the six            and limitations
                         configurations
```

### Hypotheses of the Study

This study will examine the following hypotheses descriptively:

H₀: There is no difference in consensus capture between single-signal and hybrid pipeline configurations, as measured by the independence-weighted consensus winner.

H₁: There is a difference in consensus capture between single-signal and hybrid pipeline configurations, as measured by the independence-weighted consensus winner.

H₀: There is no difference in ranking agreement between single-signal and hybrid pipeline configurations, as measured by pairwise overlap at K and mean rank gap.

H₁: There is a difference in ranking agreement between single-signal and hybrid pipeline configurations, as measured by pairwise overlap at K and mean rank gap.

### AI-Assisted Research Disclosure

This chapter was prepared with AI assistance (large language model drafting under human direction). Source identification, bibliographic verification, thematic organization, synthesis, and gap analysis were AI-assisted. Every DOI, page range, and author list was confirmed against Crossref, the ACL Anthology, ACM DL, Springer, PMC, arXiv, or the journal's own page; all 21 in-text citations are restricted to the verified source list in references.bib, with zero orphans in either direction. No authors, years, volumes, DOIs, pages, or quantitative values were fabricated, and retrieval statistics (e.g., Beel et al.'s 55% content-based share, BEIR's 18 datasets, SciDocs' seven tasks) are reproduced only as reported in the cited sources. The chapter should be verified against the original PDFs before submission. The full provenance and verification trail is kept in the file audit-trail.md.