# APPENDIX B

## MATHEMATICAL SPECIFICATION OF THE RECOMMENDATION PIPELINES

This appendix states the mathematics the Re:Search prototype actually computes, exactly as implemented in `app/services/recommendation/` (`search_service.py`, `tfidf_pipeline.py`, `sbert_pipeline.py`, `metadata_pipeline.py`, `similarity.py`, `pipeline_config.py`) and in `app/services/connected_graph.py` for the similar-papers graph. Sections B.1 through B.8 cover the components, the normalization rule, the six pipeline configurations, and the ranking rule; Section B.9 covers the similar-papers graph. The frontend reproduces the same formulas in its pipeline-math panel (`frontend/src/data/pipelinemath.ts`), so a user can watch the real numbers flow through every formula.

### Notation

```
Q          = query text, or the seed paper's prepared text
D          = { d_1, ..., d_n } = candidate papers valid for
             recommendation (is_valid_for_recommendation = true)
R          = final ranked list, |R| = top_k
w_pipe     = ( w_tfidf, w_sbert, w_meta ) = pipeline weights
```

### B.1 Text Preparation

All components consume the same prepared text: the paper's Title, Abstract, and Keywords, normalized by lowercasing, stripping punctuation, and collapsing whitespace runs to one space.

```
text(d) = normalize( Title(d) + Abstract(d) + Keywords(d) )

text(Q) = prepared query text for free-text queries
        = stored prepared text for seed-paper queries
```

### B.2 TF-IDF Component — Lexical Similarity

The vocabulary and inverse-document frequencies are fitted once per repository (index build) and never refit at request time, so the query vector and the stored vectors live in the same vector space.

```
Offline (index build):

  V          = vocabulary fitted on { text(d) : d in D }
  df(t)      = number of papers in D containing term t
  idf(t)     = ln( (1 + n) / (1 + df(t)) ) + 1      smoothed IDF
  w(t,d)     = tf(t,d) * idf(t)                     term weight
  v(d)       = w(d) / ||w(d)||_2                    L2-normalized vector

Online (per request):

  v(Q)       = the fitted vectorizer applied to text(Q)
  s_tfidf(d) = cos( v(Q), v(d) )
             = ( v(Q) . v(d) ) / ( ||v(Q)||_2 * ||v(d)||_2 )
             = 0 if either vector is the zero vector
```

### B.3 S-BERT Component — Semantic Similarity

Prepared text is embedded with the sentence-transformers model `all-MiniLM-L6-v2` (384 dimensions) and compared by cosine similarity, so papers that share no surface terms can still score close.

```
  e(d)      = SBERT( text(d) )  in R^384
  e(Q)      = SBERT( text(Q) )

  s_sbert(d) = cos( e(Q), e(d) )
             = ( e(Q) . e(d) ) / ( ||e(Q)||_2 * ||e(d)||_2 )
```

### B.4 Metadata Component — Field-Level Similarity

The metadata component scores four bibliographic signals at fixed equal weights of 25 percent. Text fields are compared by cosine similarity between pairwise TF-IDF vectors fitted on the two texts; the publication year is compared by temporal distance. A missing field contributes 0, and the fixed weights are preserved so a paper with only one available field cannot receive an inflated score because the others are absent.

```
For each text field f in { title, abstract, keywords } :

  s_f(d) = cos( TFIDF({ f(Q) }), TFIDF({ f(d) }) )
         = 0  if the field is missing in Q or d

Publication year — temporal proximity:

  s_year(d) = 1 / ( 1 + | year(Q) - year(d) | )
            = 0  if either year is missing

Fixed equal signal weights (25% each):

  s_meta(d) = 0.25 * s_title(d)
            + 0.25 * s_abstract(d)
            + 0.25 * s_keywords(d)
            + 0.25 * s_year(d)

  s_meta(d) is clamped to [0, 1].
```

For free-text queries, only the title signal is active (abstract, keywords, and year are absent from the query); seed-paper queries activate all four signals.

### B.5 Score Normalization

TF-IDF and S-BERT raw cosine scores are min-max normalized across all candidates before combination; metadata scores are already bounded in [0, 1] by construction and pass through unchanged. If every score is identical, the degenerate case maps every candidate to 1.0.

```
  s'(d) = ( s(d) - min_s ) / ( max_s - min_s )
        = 1.0 for every d   if max_s = min_s   (degenerate)

  s'_meta(d) = s_meta(d)          (no normalization)
```

### B.6 The Six Pipeline Configurations

Each configuration is a weighted combination of the normalized component scores. Components with zero weight are not computed at all. Table B-1 lists the six presets with their exact formulas.

Table B-1

The Six Pipeline Configurations and Their Score Formulas

| Pipeline | Weights (tfidf, sbert, meta) | Final score S(d) |
|---|---|---|
| TF-IDF | (1.000, 0.000, 0.000) | 1.000 · s'_tfidf(d) |
| S-BERT | (0.000, 1.000, 0.000) | 1.000 · s'_sbert(d) |
| TF-IDF + S-BERT | (0.500, 0.500, 0.000) | 0.500 · s'_tfidf(d) + 0.500 · s'_sbert(d) |
| TF-IDF + Metadata | (0.667, 0.000, 0.333) | 0.667 · s'_tfidf(d) + 0.333 · s'_meta(d) |
| S-BERT + Metadata | (0.000, 0.667, 0.333) | 0.667 · s'_sbert(d) + 0.333 · s'_meta(d) |
| TF-IDF + S-BERT + Metadata | (0.400, 0.400, 0.200) | 0.400 · s'_tfidf(d) + 0.400 · s'_sbert(d) + 0.200 · s'_meta(d) |

A seventh "custom" pipeline lets the user set the three dials; the backend normalizes the dial values so the weights sum to 1:

```
  w_i = dial_i / ( dial_tfidf + dial_sbert + dial_meta )
```

### B.7 Ranking and Output

Candidates are sorted by the final score descending, with ties broken by the newer publication year first and then by title alphabetically; only papers with a score greater than 0 are returned, limited to top_k.

```
  R = [ d in D : S(d) > 0 ],  |R| = top_k
```

### B.8 The Similar-Papers Graph

The similar-papers graph (`GET /api/papers/{paper_id}/similar-graph`) follows the Connected Papers model: an origin paper as the graph center, its top-k recommendations as the surrounding nodes, weighted edges between graph papers, and shortest weighted paths back to the origin. The graph always uses the selected pipeline's own components for its edge weights, so the graph can never disagree with the pipeline that chose its node set.

**Node set.** The origin is the selected paper; the remaining nodes are the top_k results of running the selected pipeline (default: the full hybrid `tfidf_sbert_metadata`) with the selected paper as the seed.

**Edge weight.** For every pair of graph papers (a, b), the edge weight blends the pipeline's raw component similarities with an author-overlap bonus:

```
  w(a,b) = w_tfidf * cos( v_tfidf(a), v_tfidf(b) )
         + w_sbert * cos( e_sbert(a), e_sbert(b) )
         + w_meta  * meta(a, b)
         + 0.15    * J( authors(a), authors(b) )

  meta(a, b) = 0.25 * s_title(a, b)
             + 0.25 * s_abstract(a, b)
             + 0.25 * s_keywords(a, b)
             + 0.25 * s_year(a, b)        (same formula as B.4)

  J = Jaccard similarity over the papers' author last names
      (lowercased); 0 if either paper has no authors

  w(a,b) is clamped to [0, 1]; a missing stored vector
  contributes 0.
```

Unlike the request-time ranking (Section B.5), the graph edges use the raw component similarities without min-max normalization, and the metadata term uses the full four-signal score of Section B.4.

**Edge filtering.** Every origin-to-node edge is always drawn (the origin star guarantees the graph is connected); any other pair is drawn only when its weight is at least the minimum edge weight of 0.15.

**Shortest paths.** Dijkstra's algorithm runs from the origin with the hop cost of an edge defined as (1 − w), so a high-similarity edge is a short hop; ties break by the smaller paper id, which makes the output deterministic. Each similar-paper node carries the shortest weighted path back to the origin and its total length.

**Shared groups.** The graph reports authors shared by at least two graph papers and topics (keyword tokens and subject/category parts) shared by at least two papers. Because the repository stores no reference lists, shared topics stand in as the local analogue of bibliographic coupling; this is a deliberate substitution for the reference model's common-reference measures, not a claim of equivalence.