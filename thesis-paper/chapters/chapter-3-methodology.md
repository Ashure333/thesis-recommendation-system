# CHAPTER III

## RESEARCH METHODOLOGY

This chapter presents the methodology used to develop and evaluate Re:Search, the hybrid content-based recommendation prototype built in this study. It covers the research design and locale, the system framework and features, the development process, the evaluation protocol (the Arena), the data collection and analysis plan, the ethical considerations, and the limitations of the method. Together these sections show how the methodology answers Chapter I's specific problems: how the prototype will be designed and built, how its six pipeline configurations will be compared, and how that comparison will be conducted and interpreted.

### Research Design

This study will use a descriptive-developmental research design. It is *developmental* because the objective will be to design and build Re:Search, a local academic repository and recommendation prototype, through iterative prototyping in a planning, requirements, design, development, and testing cycle, each pass checked and refined. It is *descriptive* and comparative because the study will report how the six fixed pipeline configurations rank papers on the same queries and seed papers, without manipulating any variable beyond the weight configurations themselves.

The developmental strand answers Chapter I's first two problems: the design and construction of the system, and the design of the three recommendation components (TF-IDF, S-BERT, and metadata) together with their six hybrid configurations. The comparative strand answers the remaining problems: the agreement structure among the pipelines and the determination of a winner across repeated Arena runs. The study grounds this arrangement in the standard offline evaluation practice for content-based and hybrid recommenders, in which candidate generation, scoring, ranking, and agreement analysis run over a fixed corpus without a live user study (Adomavicius & Tuzhilin, 2005; Burke, 2002). Content-based recommenders profile items from their textual content and match them against the user's interests (Lops et al., 2011); the prototype operationalizes that idea by profiling papers from their titles, abstracts, and keywords.

### Research Locale

The study is conducted at Bulacan State University, Malolos, Bulacan, in Central Luzon, Philippines. The prototype is developed by Bachelor of Science in Mathematics and Computer Science (BSMCS) students, and the interface brands itself "Re:Search · BulSU BSMCS." The corpus is drawn from publicly available academic literature collected by the researchers, and the evaluation runs locally on a single machine: the FastAPI backend, the SQLite database, and the React frontend all run on the researchers' own computer, and no system was installed in any university office. The researchers document the locale from the prototype's identifiers and from the development records, not from field observation.

### System Framework and Features

Re:Search is a two-layer application: a FastAPI backend that owns the repository, the recommendation engine, and the Arena, and a React frontend that renders the repository, search, and evaluation pages. Table 1 summarizes the modules that make up the system and the purpose of each.

Table 1

Feature Matrix of the Re:Search Prototype

| Module | Purpose |
|---|---|
| PDF import | Upload a PDF and extract metadata from it |
| BibTeX import | Parse a BibTeX citation into a paper record |
| Google Scholar import | Import a Google Scholar BibTeX entry or Scholar URL |
| Metadata extraction | Pull title, abstract, keywords, year, authors, and DOI |
| Subject classification | Assign a Subject: Category label when missing |
| Recommendation validation | Mark a paper valid only if title, abstract, keywords, and year are present |
| Prepared text | Build the normalized Title + Abstract + Keywords block |
| PDF discovery and attach | Find and attach open-access PDFs (Unpaywall, Crossref, Semantic Scholar, arXiv, OpenAlex) |
| Duplicate detection | Reject re-imports by exact DOI or title similarity at or above 0.85 |
| TF-IDF pipeline | Lexical cosine similarity on TF-IDF vectors |
| S-BERT pipeline | Semantic cosine similarity on sentence embeddings |
| Metadata pipeline | Four-signal metadata score (title, abstract, keywords, year) |
| Six configurations and custom dials | Weighted combinations of the three components |
| Query search | Recommend from a free-text query |
| Seed-paper search | Recommend papers similar to a chosen paper |
| Arena comparison | Run all six pipelines side by side on one query or seed |
| Battle history | Log every Arena run; tally wins, champion, and streaks |
| Personal library | Save papers for later reference |
| PDF viewer | Read attached PDFs in the browser |
| Recommendation-index rebuild | Recompute vectors and embeddings after repository changes |

The recommendation engine combines three components. The TF-IDF component follows Salton and Buckley's (1988) term-weighting scheme. Its vocabulary and smoothed inverse-document frequencies are fitted once over the repository at index build, and every paper is stored as an L2-normalized term-weight vector:

```
V        = vocabulary fitted on { text(d) : d in D }
idf(t)   = ln( (1 + n) / (1 + df(t)) ) + 1        smoothed IDF
w(t,d)   = tf(t,d) * idf(t)                       term weight
v(d)     = w(d) / ||w(d)||_2                      L2-normalized vector
```

At request time the query is vectorized with the same fitted vectorizer (never refit, so both vectors live in one vector space) and scored by cosine similarity:

```
s_tfidf(d) = cos( v(Q), v(d) )
           = ( v(Q) · v(d) ) / ( ||v(Q)||_2 · ||v(d)||_2 )
```

The S-BERT component embeds the same prepared text with the sentence-transformers all-MiniLM-L6-v2 model (Reimers & Gurevych, 2019) and scores by cosine similarity between embeddings, so papers that share no surface terms can still score close:

```
e(d)       = SBERT( text(d) )  in R^384
s_sbert(d) = cos( e(Q), e(d) )
```

The metadata component scores four bibliographic signals at fixed equal weights of 25 percent:

```
Metadata(d) = 0.25·sim(title) + 0.25·sim(abstract) + 0.25·sim(keywords) + 0.25·sim(year)
```

The three text fields are compared by TF-IDF cosine similarity after normalization (lowercase, punctuation stripped), and the year similarity is sim(year) = 1 / (1 + |Δyear|). A missing field contributes 0 while the fixed 0.25 weights are preserved, so a paper with only one available field cannot receive an inflated score because the others are absent. Which signals are active depends on the search mode. Seed-paper searches supply all four signals from the seed's metadata. Free-text queries supply only the title slot, because abstract, keywords, and publication year are absent from the query, so those three terms contribute zero and the metadata component degenerates to title similarity. Metadata-inclusive pipelines therefore behave differently under the two search modes, and the Arena analysis stratifies results by query type.

The six configurations fix the component weights in Table 2. A seventh "custom" pipeline lets the user set the three dials, which the backend normalizes so the weights sum to 1.

Table 2

Pipeline Weight Configurations

| Pipeline | w(tfidf) | w(sbert) | w(metadata) |
|---|---|---|---|
| tfidf | 1.0 | 0.0 | 0.0 |
| sbert | 0.0 | 1.0 | 0.0 |
| tfidf_sbert | 0.5 | 0.5 | 0.0 |
| tfidf_metadata | 0.667 | 0.0 | 0.333 |
| sbert_metadata | 0.0 | 0.667 | 0.333 |
| tfidf_sbert_metadata | 0.4 | 0.4 | 0.2 |

Component scores are normalized independently before combination. TF-IDF and S-BERT raw scores are min-max normalized to [0, 1] (the degenerate all-equal case maps to 1.0), while metadata scores are already bounded in [0, 1] and pass through unchanged. The final score is

```
Final(d) = w_tfidf·norm_tfidf(d) + w_sbert·norm_sbert(d) + w_metadata·metadata(d)
```

Expanded for the six fixed configurations of Table 2, the final scores are:

```
S(d) = 1.000 · s'_tfidf(d)                                          TF-IDF
S(d) = 1.000 · s'_sbert(d)                                          S-BERT
S(d) = 0.500 · s'_tfidf(d) + 0.500 · s'_sbert(d)                    TF-IDF + S-BERT
S(d) = 0.667 · s'_tfidf(d) + 0.333 · s'_meta(d)                     TF-IDF + Metadata
S(d) = 0.667 · s'_sbert(d) + 0.333 · s'_meta(d)                     S-BERT + Metadata
S(d) = 0.400 · s'_tfidf(d) + 0.400 · s'_sbert(d) + 0.200 · s'_meta(d)
                                                                   TF-IDF + S-BERT + Metadata
```

Components with zero weight are not computed at all. Results are ranked by Final(d) descending, with ties broken by newer publication year and then by title alphabetically; only papers with a score greater than 0 are returned, limited to top_k.

The similar-papers graph operationalizes recommendation for a single paper: the selected paper becomes the origin node and the top_k results of the active pipeline become its neighbors. Every pair of graph papers is joined by a blended edge weight that reuses the active pipeline's own components, so the graph cannot disagree with the pipeline that selected its nodes:

```
w(a,b) = w_tfidf · cos( v_tfidf(a), v_tfidf(b) )
       + w_sbert · cos( e_sbert(a), e_sbert(b) )
       + w_meta  · meta(a, b)
       + 0.15    · J( authors(a), authors(b) )
```

where meta(a, b) is the four-signal metadata score defined above and J is the Jaccard similarity over the papers' author last names; the weight is clamped to [0, 1], and a missing stored vector contributes 0. Edges from the origin are always drawn; other pairs are drawn only at or above a minimum edge weight of 0.15. Dijkstra's algorithm then computes the shortest path from the origin to every node with hop cost (1 − w), so a node's distance and route summarize how directly the paper connects back to the selected paper. The graph also reports authors and topics shared by at least two graph papers as the local analogue of bibliographic coupling, since the repository stores no reference lists. Figure 1 shows the system architecture.

Figure 1

System Architecture of Re:Search

```
┌──────────────────────────────────────────────────┐
│           React + TypeScript + Vite UI            │
│    Repository │ Search │ Evaluation (Arena)       │
└───────────────────────┬──────────────────────────┘
                        │ HTTP / JSON
┌───────────────────────▼──────────────────────────┐
│                FastAPI + Uvicorn                  │
│  /api/papers/*        /api/recommendations/*      │
│  /api/evaluation/battles                          │
└──────────┬─────────────────────────────┬──────────┘
           │                             │
┌──────────▼────────────┐  ┌─────────────▼──────────┐
│ SQLAlchemy 2 + SQLite │  │  Recommendation Core    │
│ papers                 │  │  prepared text         │
│ battle_runs            │  │  TF-IDF vectors        │
│ index status file      │  │  S-BERT embeddings     │
│                        │  │  metadata score        │
│                        │  │  Arena comparison      │
└────────────────────────┘  └────────────────────────┘
```

The main interfaces are reproduced in Appendix A: the login page (Figure A-1), the recommendations page with pipeline selector and ranked results (Figure A-2), the repository page (Figure A-3), the upload page (Figure A-4), the My Library page (Figure A-5), and the Arena page with battle results and battle records (Figures A-6 and A-7). The complete mathematical specification of the components, the six configurations, and the similar-papers graph is given in Appendix B.

### Process of Developing the System

The researchers built the prototype through one repeated loop: planning fixed the scope, requirement analysis fixed what the system must do, design specified the data model and the API surface, development implemented it, and testing checked the build.

#### Planning

Planning fixed the study's direction and scope from Chapter I: a local academic repository plus a recommendation engine with three components and six weight configurations, evaluated by an in-system Arena rather than by human raters. The researchers screened the design space of content-based and hybrid recommenders (Burke, 2002; Lops et al., 2011) for feasibility at prototype scale and fixed the scope to the following: PDF, BibTeX, and Google Scholar import; metadata extraction, classification, validation, and duplicate detection; TF-IDF and S-BERT representations; the six pipelines plus custom dials; query and seed-paper search; and the Arena with battle history. Excluded from the scope are collaborative filtering, production deployment, multi-user accounts, and real authentication.

#### Approach in Development

Development followed an iterative prototyping cycle: requirements, design, build, test, refine, repeated until each slice met its requirements. Each cycle addressed a bounded part of the feature list, so the prototype could be demonstrated early and corrected while changes were still inexpensive. The approach suits a single-user local system: there is no deployment pipeline, no data migration, and only one machine to satisfy. Each iteration cost little and returned feedback quickly, so the design converged on working behavior without a production build.

#### Requirement Analysis

The researchers derived functional requirements from the Statement of the Problem. The system shall (a) import papers from PDFs, BibTeX files, and Google Scholar entries; (b) extract and normalize metadata; (c) classify papers by subject and validate them for recommendation; (d) detect and reject duplicates; (e) build prepared text and both vector representations; (f) run the six weight configurations and a normalized custom dial; (g) search by query or by seed paper; and (h) run the Arena and log every battle result.

The researchers grouped the non-functional requirements into four areas. *Reproducibility*: the same query, pipeline, and top_k must produce the same ranking on the same corpus. *Index consistency*: the recommendation index must be rebuilt after repository changes, with stale-state tracking to flag drift. *Responsiveness*: search and Arena runs must complete within interactive time on a local machine. *Single-node operation*: the entire stack runs locally without external services.

#### Design

The researchers designed the data model around one entity, Paper, which holds the bibliographic metadata (title, abstract, keywords, year, authors, DOI, subject category), the validity flag and missing-field notes, the prepared text, and the two stored representations: a TF-IDF vector and an S-BERT embedding. The Arena writes one battle_runs row per logged battle. The weight presets live in a single configuration module as six named pipelines plus a custom-weights builder that normalizes dial allocations to sum to 1. The API surface covers paper upload and import (POST /api/papers/upload, /api/papers/import-bibtex, /api/papers/import-url), recommendation search, index status and rebuild, the Arena (POST /api/recommendations/compare), and battle history (GET /api/evaluation/battles).

#### Development

The researchers implemented the prototype with the stack below, recorded here for reproducibility.

| Technology | Purpose |
|---|---|
| FastAPI + Uvicorn | REST API and local server |
| SQLAlchemy 2 + SQLite | Persistence of papers and battle runs |
| scikit-learn | TF-IDF vectorization |
| sentence-transformers (all-MiniLM-L6-v2) | S-BERT embeddings |
| joblib + NumPy | Persistence of vectors and vector math |
| pdfplumber | PDF text extraction |
| YAKE | Keyword generation |
| requests | PDF discovery across external sources |
| python-multipart | File upload handling |
| React + TypeScript + Vite | Frontend application |
| Tailwind CSS + lucide-react | Styling and icons |
| Vitest + React Testing Library | Frontend component tests |
| pytest | Backend tests |

The backend persists the fitted TF-IDF vectorizer and the per-paper vectors with joblib. The master rebuild script (`python -m scripts.rebuild_recommendation`) runs classify, validate, prepared text, TF-IDF, then S-BERT in order; a stale-state file (`storage/recommendation_index_status.json`) plus the POST /api/recommendations/rebuild endpoint keep the index honest after imports change the corpus.

#### Testing

The researchers combined automated tests with a manual functional walkthrough. Backend pytest suites (`test/test_extraction.py` and `test/test_upload_flow.py`) cover metadata extraction and the upload flow, including duplicate rejection; frontend component tests with Vitest and React Testing Library cover the pages and the pipeline math, including dial normalization. The manual walkthrough runs the full loop: import a PDF and a BibTeX entry, confirm classification and validation, rebuild the index, search by query and by seed paper, and run an Arena battle. Every deviation observed during the walkthrough was recorded and corrected before the next iteration.

### System Evaluation

The study will evaluate the six pipelines with the Arena, an in-system instrument, rather than with human raters. This follows a recognized offline evaluation approach for recommender systems, in which configurations are compared on ranking behavior over a fixed corpus without user involvement (Adomavicius & Tuzhilin, 2005).

#### Evaluation Instrument (Arena Protocol)

The Arena runs all six pipelines on the same query or seed paper at a chosen top_k (the interface offers 5, 10, and 15) and computes four structures. First, *per-pipeline ranked results* show each configuration's own top_k list. Second, a *consensus ranking* orders every paper any pipeline ranked by votes (the number of pipelines that included it), then by average rank, then by paper id. Third, *pairwise agreement* is computed for every pair of pipelines as overlap@k, the number of shared papers, plus the mean absolute rank gap over the papers both pipelines ranked. Fourth, a *winner* is determined by independence-weighted consensus: each paper in a pipeline's top_k collects votes from the other pipelines, where a vote from pipeline Q weighs 1 − Jaccard(P's component set, Q's component set). Disjoint pipelines weigh 1.0; a two-signal hybrid weighs exactly 0.5 against a pipeline built from one of its own components, and the three-signal hybrid weighs at most 2/3 against a single-signal pipeline sharing one component, so no pipeline can win through its own hybrids re-confirming its output. The winner is the pipeline with the largest share of its maximum possible weighted consensus; ties fall to the lower average consensus rank. The winner is a measure of agreement breadth under independence weighting, not of correctness: pipelines can agree in error together, and a configuration can win by being the best average of its rivals rather than the best recommender.

Every run with a winner is logged as a battle_runs row holding the query or seed, top_k, winner pipeline, metric, value, average consensus rank, and timestamp. The Arena page tallies wins over time, showing the champion and current streaks, and the backend serves the full history through GET /api/evaluation/battles.

#### Data Collection

The researchers will collect data by running a planned Arena campaign of 36 runs: one free-text query and one seed paper drawn from each of the repository's six largest subject classifications (Machine Learning, Mathematical Analysis, Mathematical Modeling, Graph Theory, Linear Algebra, and Information Retrieval), each executed at top_k values of 5, 10, and 15, for 6 × 2 × 3 = 36 runs. The queries and seed papers will be selected by the researchers to represent each class's dominant topics, and the final selection will be recorded together with the corpus's subject-class composition before data collection begins; each run writes a battle_runs row automatically, and the researchers will export the battle history at the end of the campaign. The evaluation corpus is the repository itself, which holds 168 papers at the time of writing, 146 of them valid for recommendation. Runs logged during development walkthroughs exercised the instrument and are excluded from the reported results: the researchers will reset the battle history before the campaign, so the win tally, champion, and streaks reflect the formal runs only.

#### Data Processing and Analysis

The researchers will process the battle history with descriptive statistics: vote counts and average ranks per paper in the consensus ranking, score distributions per pipeline, and win shares per pipeline (wins divided by total battles). Agreement analysis will summarize the pairwise measures, showing which configurations behave alike and which diverge, both in selection (overlap@k) and in position (mean rank gap). Winner determination applies the independence-weighted consensus rule per battle, and the tally across battles identifies the configuration with the most wins and the best average consensus rank. Table 3 summarizes the metrics and their interpretations.

Table 3

Evaluation Metrics and Interpretations

| Metric | Formula | Interpretation |
|---|---|---|
| Consensus votes | Number of pipelines that ranked paper d | Breadth of agreement on d |
| Average rank | Mean of d's ranks across its voters | How high d sits on average |
| Pairwise overlap@k | Number of shared papers in two top_k lists | Shared selection at k |
| Mean rank gap | Mean of \|rank_P(d) − rank_Q(d)\| over shared papers | Positional divergence between pipelines |
| Independence weight | 1 − Jaccard(component sets of P and Q) | Strength of cross-evidence between pipelines |
| Winner share | Captured weighted consensus ÷ maximum possible | Share of the strongest evidence a pipeline captured |

The study will report these results descriptively; no inferential statistics will be applied, because the Arena produces system-internal agreement measures rather than human ratings drawn from a sampled population. No accept/reject language will be attached to the hypotheses; the statistics will describe observed differences within the bounds stated in the Limitations section. The Chapter I hypotheses will be assessed from the campaign's observed statistics: win shares and average consensus ranks for consensus capture, and overlap and mean rank gap for ranking agreement. Every statistic will be computed overall and separately for the two query types (free-text runs and seed-paper runs), and per subject class where counts allow, so conclusions about metadata-inclusive pipelines are reported per query type and conclusions about lexical effects per class. The researchers will interpret the win tally and the agreement structure as evidence about which configurations agree with the widest set of independent signals, within the bounds stated in the Limitations section.

### Ethical Considerations

The study uses a corpus of publicly available academic metadata and open-access documents collected by the researchers for educational research. It involves no human subjects, collects no personal data, and conducts all processing on a single local machine. All citations in this chapter come from the approved source list and were verified manually against their DOI or publisher records; no bibliographic detail was taken from model recall. AI-assisted tools were used for drafting this chapter and for scaffolding code during development, and every technical claim was checked against the running prototype, its tests, and the live database.

### Limitations of the Method

1. **Single corpus.** The evaluation runs on one local repository (168 papers, 146 valid for recommendation), so the results may not transfer to larger or differently sourced collections.
2. **Single semantic model.** All S-BERT scores rest on one embedding model (all-MiniLM-L6-v2); other models could rank the corpus differently.
3. **System-internal agreement.** The Arena measures agreement among pipelines, not relevance against human judgments, so it cannot certify which pipeline best serves real users. Human evaluation is deferred to future work because the study's purpose is the controlled comparison of configurations on one corpus, not the certification of user-facing quality.
4. **Heuristic extraction.** Metadata comes from pdfplumber text extraction without OCR, so scanned or poorly encoded PDFs degrade the corpus.
5. **Lexical corpus bias.** TF-IDF similarity depends on shared vocabulary, so the topical spread of the corpus bounds what the lexical component can express.
6. **No collaborative signals.** The prototype is content-based only; collaborative, popularity, or usage signals are out of scope.
7. **Single-node operation.** SQLite and local storage bound scale and concurrency; the findings describe the prototype, not a production service.

## References

Adomavicius, G., & Tuzhilin, A. (2005). Toward the next generation of recommender systems: A survey of the state-of-the-art and possible extensions. *IEEE Transactions on Knowledge and Data Engineering*, *17*(6), 734–749. https://doi.org/10.1109/TKDE.2005.99

Burke, R. (2002). Hybrid recommender systems: Survey and experiments. *User Modeling and User-Adapted Interaction*, *12*(4), 331–370. https://doi.org/10.1023/A:1021240730564

Lops, P., de Gemmis, M., & Semeraro, G. (2011). Content-based recommender systems: State of the art and trends. In *Recommender systems handbook* (pp. 73–105). Springer. https://doi.org/10.1007/978-0-387-85820-3_3

Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence embeddings using Siamese BERT-networks. In *Proceedings of EMNLP-IJCNLP 2019* (pp. 3980–3990). https://doi.org/10.18653/v1/D19-1410

Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval. *Information Processing & Management*, *24*(5), 513–523. https://doi.org/10.1016/0306-4573(88)90021-0

### AI-Assisted Research Disclosure

AI-assisted tools were used for drafting this chapter and for scaffolding code during development. All citations were manually verified against the approved source list; no authors, DOIs, statistics, or implementation details were fabricated, and every technical claim was checked against the repository code, its tests, and the live database. The full provenance and verification trail is kept in the file audit-trail.md.