# CHAPTER I

## THE PROBLEM AND ITS BACKGROUND

Chapter I sets out the background of the problem, the statement of the problem, the significance of the study, the scope and delimitation, and the definition of key terms for Re:Search, the hybrid content-based academic paper recommendation system developed in this study. It provides the context behind the system and states the study's objective and questions.

### Introduction

Thesis writing begins with locating related literature: researchers must find prior studies, position their work against them, and avoid duplicating completed research, and each move depends on retrieving the right papers. The volume of published research makes that a retrieval problem in its own right, and research-paper recommender systems have been built to address it (Beel et al., 2016; Bai et al., 2019). This study designs and builds a recommendation system for that setting, then evaluates its configurations against one another and appraises the developed system's acceptability and software quality.

Philippine undergraduates typically find related literature by typing keywords into Google Scholar and library catalogs. Keyword retrieval works by exact term matching, and the vocabulary mismatch problem breaks it whenever authors and searchers use different words for the same idea: synonymy lets a paper on "neural networks" escape a search for "deep learning," and polysemy lets one term pull in unrelated senses (Manning et al., 2008). Keyword search also ignores structured metadata such as publication year and venue, so a chronological search can surface dated work. Content-based research documents the same weakness: keyword profiles over-emphasize surface terms and under-use structured fields (Lops et al., 2011).

Content-based filtering offers a principled alternative: recommend items whose features resemble the query or the user's profile (Adomavicius & Tuzhilin, 2005; Lops et al., 2011). The classical representation is TF-IDF term weighting, which measures a term's importance within a document against its rarity across the corpus (Salton & Buckley, 1988; Manning et al., 2008). Semantic embeddings extend this by mapping sentences and paragraphs into dense vectors, so Sentence-BERT can score similarity between texts that share no surface terms (Reimers & Gurevych, 2019). Metadata adds a third signal: title, abstract, keywords, and publication year.

Each signal fails differently when used alone. Lexical matching remains blind to paraphrase, because papers on the same topic written in different vocabularies share few terms (Manning et al., 2008; Lops et al., 2011). Semantic matching captures paraphrase but can drift toward broadly related material (Reimers & Gurevych, 2019). Metadata alone cannot find conceptually related papers sharing no fields. Hybrid systems offset these weaknesses by combining signals (Burke, 2002). Yet surveys of research-paper recommenders find that most systems rely on a single representation and that few studies evaluate configurations comparatively (Beel et al., 2016; Bai et al., 2019).

This study develops Re:Search, a local academic paper repository and recommendation system for thesis writing that the interface brands "Re:Search · BulSU BSMCS." The system stores academic papers imported from PDF or BibTeX citations, including exports from Google Scholar, and validates each record for recommendation use: title, abstract, keywords, and publication year are required. Validated records become prepared text built from Title + Abstract + Keywords. Re:Search represents prepared text two ways, as TF-IDF vectors computed with scikit-learn and as S-BERT embeddings from the all-MiniLM-L6-v2 model, and scores candidates by cosine similarity. Three signal components, TF-IDF, S-BERT, and a Metadata component scoring title, abstract, keywords, and publication year at 25 percent each, yield six fixed pipeline configurations (Table 1) and a user-customizable dial allocation. On seed-paper searches all four metadata signals are active; on free-text queries the query text feeds the title, abstract, and keywords signals, while the year signal is absent. Search runs by free-text query or seed paper. TF-IDF and S-BERT component scores are min-max normalized before weighted combination, while metadata scores are already bounded in the 0 to 1 range and pass through unchanged; ties break by newer year, then title.

Table 1

The Six Pipeline Configurations of Re:Search

| Pipeline | Signals | Weights |
|---|---|---|
| TF-IDF | Lexical only | 100% TF-IDF |
| S-BERT | Semantic only | 100% S-BERT |
| TF-IDF + S-BERT | Lexical + semantic | 50% / 50% |
| TF-IDF + Metadata | Lexical + metadata | 66.7% / 33.3% |
| S-BERT + Metadata | Semantic + metadata | 66.7% / 33.3% |
| TF-IDF + S-BERT + Metadata | Full hybrid | 40% / 40% / 20% |

Comparative evaluation runs through the Arena, an instrument built into the system. Every Arena run executes all six pipelines on the same query or seed paper at a top-K of 5, 10, or 15, and reports four comparisons (Table 2): consensus ranking, pairwise agreement, the independence-weighted consensus winner, and the win tally with battle history. In the winner metric, one pipeline's vote for a paper weighs 1 minus the Jaccard similarity of the two pipelines' component sets, so no pipeline wins by confirmation from its own hybrids. Winning runs are logged to the battle history, and the Arena page tallies wins per pipeline, showing the champion and its streak. The local repository database held 168 paper records at the time of this revision, 145 of them valid for recommendation.

Table 2

Arena Comparison Measures

| Measure | What it reports |
|---|---|
| Consensus ranking | Ordered by votes across pipelines, then average rank |
| Pairwise overlap at K | Shared papers between two pipelines' top-K results |
| Mean rank gap | Mean absolute rank difference over shared papers |
| Independence-weighted consensus | Winner by weighted vote share, discounted for shared components |
| Win tally and battle history | Wins per pipeline, champion, and streak |

Local prototypes rarely integrate lexical, semantic, and metadata signals, and fewer still evaluate the configurations against one another. Re:Search builds that integration, and the Arena supplies the comparison. The study will report which configurations capture consensus best and how single-signal and hybrid pipelines agree in ranking, within the Re:Search corpus and protocol. The aim is a working prototype, an evidence-based account of its configurations, and an appraisal of the system's acceptability and software quality.

### Statement of the Problem

Undergraduate thesis writing at Bulacan State University depends on related literature, yet the retrieval tools students use, keyword search in Google Scholar and library catalogs, break under vocabulary mismatch and ignore structured metadata (Manning et al., 2008). Content-based recommenders can recover relevant literature, yet single-signal approaches fail in opposite directions: lexical matching misses paraphrase, and semantic matching drifts from the topical and temporal constraints a thesis imposes (Lops et al., 2011; Reimers & Gurevych, 2019). Hybrid systems combine signals to offset these weaknesses (Burke, 2002), but comparative evidence on how configurations behave is scarce (Beel et al., 2016; Bai et al., 2019), and local prototypes integrating all three signals are rare. This study will therefore design and develop Re:Search, a hybrid content-based recommendation system for academic papers, comparatively evaluate its six pipeline configurations, and assess the developed system's acceptability and software quality. The acceptability assessment follows the Technology Acceptance Model (Davis, 1989), and the quality assessment follows the ISO/IEC 25010 product quality model (ISO/IEC 25010:2023), addressing the following specific questions:

1. How can a hybrid content-based recommendation system for academic papers be designed and developed, specifically through:

   1.1 prepared-text normalization of title, abstract, and keywords,

   1.2 TF-IDF and S-BERT representations of prepared text with metadata signals,

   1.3 six fixed-weight pipeline configurations plus a user-customizable dial allocation, and

   1.4 query-based and seed-paper-based search?

2. How can the six pipeline configurations be comparatively evaluated through the Arena, specifically through:

   2.1 consensus ranking,

   2.2 pairwise agreement in overlap at K and mean rank gap,

   2.3 the independence-weighted consensus winner, and

   2.4 win tally and battle history?

3. How do hybrid configurations compare with single-signal configurations in consensus capture and ranking agreement?

4. How acceptable is Re:Search under the Technology Acceptance Model (TAM), considering:

   4.1 perceived usefulness,

   4.2 perceived ease of use,

   4.3 attitude toward using, and

   4.4 behavioral intention?

5. How well does Re:Search meet ISO/IEC 25010 quality requirements, considering:

   5.1 functional suitability,

   5.2 performance efficiency,

   5.3 compatibility,

   5.4 interaction capability,

   5.5 reliability,

   5.6 security,

   5.7 maintainability,

   5.8 flexibility, and

   5.9 safety?

To answer the third question, this study will examine the following hypotheses descriptively:

H₀: There is no difference in consensus capture between single-signal and hybrid pipeline configurations, as measured by the independence-weighted consensus winner.

H₁: There is a difference in consensus capture between single-signal and hybrid pipeline configurations, as measured by the independence-weighted consensus winner.

H₀: There is no difference in ranking agreement between single-signal and hybrid pipeline configurations, as measured by pairwise overlap at K and mean rank gap.

H₁: There is a difference in ranking agreement between single-signal and hybrid pipeline configurations, as measured by pairwise overlap at K and mean rank gap.

### Significance of the Study

This study will benefit the following parties:

**Thesis students.** Re:Search gives undergraduate thesis writers a local repository of academic papers and a recommendation tool that surfaces related literature beyond exact keyword matches (Manning et al., 2008; Lops et al., 2011). Arena results will show which configurations to expect to agree with the broadest set of independent signals when searching.

**Faculty advisers and researchers.** Faculty advisers and graduate researchers gain a documented comparison of lexical, semantic, and metadata signals on a local corpus and an instrument for explaining why different searches surface different papers.

**University library and repository staff.** Library and repository staff will obtain a reference design for recommendation features inside the university's own collections, with the pipeline, weighting scheme, and evaluation protocol documented for judgment before any deployment.

**System developers.** Developers receive an open account of how the six configurations were built: prepared-text normalization, TF-IDF and S-BERT representations, the metadata component, weighted combination, and the Arena's metrics (Burke, 2002; Reimers & Gurevych, 2019).

**Future researchers.** Future researchers will inherit the Arena as an evaluation instrument and the study's bounded findings as a baseline, with delimitations that give later work a clear starting point for extending the corpus, adding models, or evaluating ranking relevance with human judges (Beel et al., 2016; Bai et al., 2019).

### Scope and Delimitation

This development study sets the following parameters.

**Scope.** The study will cover the design, development, and comparative evaluation of Re:Search, a local academic paper repository and recommendation system. Functional scope: (a) repository import from PDF and BibTeX, including Google Scholar citations; (b) recommendation validation and prepared-text normalization; (c) TF-IDF, S-BERT, and metadata representations; (d) six fixed pipeline configurations plus a user-customizable dial allocation; (e) query-based and seed-paper-based search; (f) the Arena evaluation instrument with consensus ranking, pairwise agreement, the independence-weighted consensus winner, and battle history; and (g) a system evaluation combining a Technology Acceptance Model questionnaire for end-users with an ISO/IEC 25010 checklist for IT experts. The comparative evaluation of configurations is system-internal: the Arena's agreement metrics, not relevance judgments against human ratings. The acceptability and quality evaluation is human-rated by purposively selected respondents and is bounded to their ratings of the prototype. The corpus will be the locally collected academic papers stored in the repository, which held 168 records at the time of this revision, 145 of them valid for recommendation. The locale is Bulacan State University, Malolos, Bulacan.

**Delimitations.** The study will exclude production deployment; collaborative filtering and user ratings; user-profile personalization; sentence-embedding models other than all-MiniLM-L6-v2; OCR for scanned PDFs, since extraction is heuristic and pdfplumber-based; multi-node or server-class storage, since the database is SQLite on a single node; and relevance judgments against human raters, since the human evaluation covers acceptability and ISO/IEC 25010 quality ratings only. The findings will be bounded to the evaluated corpus and prototype. The study will not rank the surveyed algorithms in general.

### Definition of Terms

The study defines key terms operationally as follows.

**Arena.** Refers to the Re:Search instrument in which all six pipelines run on the same query or seed paper and are compared on consensus ranking, pairwise agreement, and the independence-weighted consensus winner.

**Battle run.** Refers to one execution of the Arena with a winner, logged to the battle history the Arena page uses to tally wins, crown a champion, and show streaks.

**Consensus ranking.** Refers to the Arena's paper ordering, sorted by how many pipelines ranked each paper, then by average rank.

**Content-based filtering.** Refers to a recommendation approach that scores items by similarity between the item's features and a query or profile, using no other users' ratings (Lops et al., 2011; Adomavicius & Tuzhilin, 2005); in Re:Search, the features are prepared text and metadata.

**Cosine similarity.** Refers to the cosine of the angle between two vectors, used by Re:Search to compare TF-IDF vectors, S-BERT embeddings, and metadata text fields (Manning et al., 2008).

**Duplicate detection.** Refers to the identification of multiple repository records for the same paper, a pending data-quality concern in the current corpus.

**Hybrid pipeline.** Refers to a pipeline configuration that combines two or three component scores by weighted sum (Burke, 2002); Re:Search defines four among its six configurations.

**Independence-weighted consensus.** Refers to the Arena's winner metric, in which one pipeline's vote for a paper weighs 1 minus the Jaccard similarity of the two pipelines' component sets; the winner captures the largest share of available weighted consensus, ties breaking by the lower average consensus rank.

**ISO/IEC 25010.** Refers to the international product quality model used for the study's expert evaluation, whose nine characteristics, functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, and safety, structure the quality checklist (ISO/IEC 25010:2023).

**Mean rank gap.** Refers to the mean absolute difference between the ranks two pipelines give to the papers both ranked.

**Metadata component.** Refers to the Re:Search component that scores candidates on four signals, title, abstract, keywords, and publication year, each fixed at 25 percent; missing fields contribute zero, and publication-year similarity is 1 / (1 + |Δyear|). On seed-paper searches all four signals are active; on free-text queries the query text feeds the title, abstract, and keywords signals, while the year signal is absent.

**Min-max normalization.** Refers to the rescaling of component scores into the 0 to 1 range before weighted combination; metadata scores are already bounded and are not normalized.

**Pairwise agreement.** Refers to the comparison of two pipelines on the papers both ranked, reported as overlap at K and mean rank gap.

**PDF discovery.** Refers to the search for open-access candidate PDFs for a record without a stored file, drawing on sources such as Unpaywall, Crossref, Semantic Scholar, arXiv, and OpenAlex.

**Prepared text.** Refers to the normalized text built from Title + Abstract + Keywords that Re:Search feeds to TF-IDF and S-BERT.

**Recommendation index.** Refers to the repository's stored TF-IDF vectors and S-BERT embeddings; the system tracks when repository changes make the index stale and rebuilds it.

**S-BERT.** Refers to Sentence-BERT, a Siamese BERT architecture that maps sentences and paragraphs to dense embeddings for similarity scoring (Reimers & Gurevych, 2019); Re:Search uses the all-MiniLM-L6-v2 model.

**Seed paper.** Refers to a repository paper selected as the query; the system builds the query representation from its prepared text and excludes it from the results.

**TF-IDF.** Refers to term frequency-inverse document frequency, a weighting scheme assigning weight by a term's frequency within a document and its rarity across the corpus (Salton & Buckley, 1988; Manning et al., 2008). Re:Search computes TF-IDF vectors with scikit-learn.

**Technology Acceptance Model (TAM).** Refers to the model of user acceptance used for the study's end-user evaluation, assessed through perceived usefulness, perceived ease of use, attitude toward using, and behavioral intention (Davis, 1989).

**Top-K.** Refers to the K highest-ranked papers a pipeline returns; the Arena interface offers K values of 5, 10, and 15, while the backend accepts up to 25.

### AI-Assisted Research Disclosure

AI-assisted tools supported literature retrieval and chapter drafting in the preparation of this document. All citations are restricted to the study's verified source corpus; no sources were fabricated. System facts (brand, weights, Arena metrics, tie-break rules, and corpus counts) were read from the prototype's codebase and its local database. The full provenance and verification trail is kept in the file audit-trail.md.