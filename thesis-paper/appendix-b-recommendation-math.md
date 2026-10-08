# APPENDIX B

## MATHEMATICAL SPECIFICATION OF THE RECOMMENDATION PIPELINES

This appendix states the mathematics the Re:Search prototype actually computes, exactly as implemented in `app/services/recommendation/` (`search_service.py`, `tfidf_pipeline.py`, `sbert_pipeline.py`, `metadata_pipeline.py`, `similarity.py`, `pipeline_config.py`), in `app/services/connected_graph.py` for the similar-papers graph, and in the extension modules added after the initial specification (`fts_search.py`, `vector_index.py`, `mmr.py`, `learned_weights.py`, `citations.py`, and `app/services/evaluation/`). Sections B.1 through B.8 cover the components, the normalization rule, the six pipeline configurations, the ranking rule, and the similar-papers graph; Sections B.9 through B.14 specify the implemented extensions: BM25 ranked repository search, precomputed vector matrices, MMR diversification, learned fusion weights, citation-based relatedness, and the offline retrieval metrics; Section B.15 documents the execution trace behind the interface's Stats for Nerds panel. The panel traces the real numbers of one search along these steps, and the interface's Engine page explains the same formulas with a worked example, so a reader can compare the specification with both.

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

The metadata component scores four bibliographic signals at fixed equal weights of 25 percent. Each text field is compared by cosine similarity in a TF-IDF space fitted for that field on the query together with every candidate's value of the field; the publication year is compared by temporal distance. A missing field contributes 0, and the fixed weights are preserved so a paper with only one available field cannot receive an inflated score because the others are absent.

```
For each text field f in { title, abstract, keywords } :

  V_f    = TF-IDF vectorizer fitted once per request on
           { f(Q) } ∪ { f(d') : d' in D, f(d') not blank }
  s_f(d) = cos( v_f(Q), v_f(d) )
         = 0  if f(Q) or f(d) is missing

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

For free-text queries the query text is compared against each candidate's title, abstract, and keywords, while the year signal remains absent because a text query carries no defensible publication year; seed-paper queries activate all four signals. In symbols, f(Q) is the seed paper's own field for a seed-paper query and the query string, for all three text fields, for a free-text query. Because one vectorizer is fitted per field per request (not one per pair of texts), a term's inverse document frequency follows the corpus of that field. A free-text query has s_year = 0, so its metadata score cannot exceed 0.75, whereas a seed-paper query can reach 1; this is why the Arena stratifies its analysis by query type.

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

Each returned item also carries the three weighted component contributions that produced its score, one per signal, so the interface can display the breakdown without recomputing it.

### B.8 The Similar-Papers Graph

The similar-papers graph (`GET /api/papers/{paper_id}/similar-graph`) follows the Connected Papers model: an origin paper as the graph center, its top-k recommendations as the surrounding nodes, weighted edges between graph papers, and shortest weighted paths back to the origin. The graph always uses the selected pipeline's own components for its edge weights, so the graph can never disagree with the pipeline that chose its node set.

**Node set.** The origin is the selected paper; the remaining nodes are the top_k results of running the selected pipeline (default: the full hybrid `tfidf_sbert_metadata`) with the selected paper as the seed.

**Edge weight.** For every pair of graph papers (a, b), the edge weight blends the pipeline's raw component similarities with an author-overlap bonus and a citation-relatedness bonus (Section B.13):

```
  w(a,b) = w_tfidf * cos( v_tfidf(a), v_tfidf(b) )
         + w_sbert * cos( e_sbert(a), e_sbert(b) )
         + w_meta  * meta(a, b)
         + 0.15    * J( authors(a), authors(b) )
         + 0.25    * sim_cit(a, b)

  meta(a, b) = 0.25 * s_title(a, b)
             + 0.25 * s_abstract(a, b)
             + 0.25 * s_keywords(a, b)
             + 0.25 * s_year(a, b)        (same formula as B.4)

  J = Jaccard similarity over the papers' author last names
      (lowercased); 0 if either paper has no authors

  sim_cit(a, b) = citation-relatedness score of Section B.13;
      0 when either paper has no cached citation rows

  w(a,b) is clamped to [0, 1]; a missing stored vector
  contributes 0.
```

Unlike the request-time ranking (Section B.5), the graph edges use the raw component similarities without min-max normalization, and the metadata term uses the full four-signal score of Section B.4.

**Edge filtering.** Every origin-to-node edge is always drawn (the origin star guarantees the graph is connected); any other pair is drawn only when its weight is at least the minimum edge weight of 0.15.

**Shortest paths.** The route from the origin to every node is computed with Dijkstra's algorithm (Dijkstra, 1959) over the undirected graph G = (V, E, w) defined by the node set and edge filtering above, with the hop cost of an edge defined as (1 − w), so a high-similarity edge is a short hop. Each similar-paper node carries the shortest weighted path back to the origin and its total length; the interface highlights that route when a node is selected.

```
  V = { o } ∪ top_k results                    |V| = k + 1   (o = origin)
  E = { (o, v) : v ≠ o }                       the origin star
    ∪ { (a, b) : w(a, b) ≥ 0.15 }              the strong pairs

  c(a, b) = max( 0, 1 − w(a, b) )              edge cost, in [0, 1]
  len(P)  = Σ c(e) over the edges e of a path P
  d(v)    = min over paths P from o to v of len(P),    d(o) = 0
```

The implementation uses a binary min-heap ordered by (distance, paper id) and skips stale entries rather than updating them in place:

```
  d(o) = 0;  d(v) = ∞ for every other v;  Q = min-heap { (0, o) }
  while Q is not empty:
      (δ, u) = pop the smallest entry of Q
      if u is already settled: continue          (stale entry)
      settle u                                   d(u) = δ is now final
      for each neighbour v of u with cost c(u, v):
          if δ + c(u, v) < d(v) − 10⁻⁹:
              d(v) = δ + c(u, v);  pred(v) = u;  push (d(v), v) onto Q
  path(v) = pred chain from v back to o, reversed
  output  d(v) rounded to four decimals, and path(v), for every node reached
```

*Correctness.* Dijkstra's algorithm requires non-negative edge costs, which the clamp in c guarantees. Its invariant is that when u is popped no unsettled node can offer a shorter route to u: such a route would have to leave the settled set through a node whose tentative distance is already at least δ and then add a cost of zero or more. Hence d(u) is final when u is settled, and each node is settled exactly once.

*Bound.* The origin star joins the origin to every node, so every node is reachable and d(v) ≤ c(o, v) = 1 − w(o, v) ≤ 1.

*When an indirect route wins.* For an origin o, an intermediate paper m, and a target v, with w₁ = w(o, m), w₂ = w(m, v), and w_d = w(o, v):

```
  o → m → v beats the direct edge o → v
      ⇔  c(o, m) + c(m, v) < c(o, v)
      ⇔  (1 − w₁) + (1 − w₂) < 1 − w_d
      ⇔  w₁ + w₂ > 1 + w_d
```

Both hops must therefore be strong: 0.60 + 0.60 beats a direct weight of 0.19 but not one of 0.21. A weakly related paper is routed through a strongly related neighbour that bridges it to the origin.

*Determinism.* The heap orders entries by (distance, paper id), so among equal distances the smaller id is settled first; a later route replaces a stored predecessor only if it is cheaper by more than 10⁻⁹, so floating-point noise cannot change a path; and the output does not depend on the order of the edge list.

*Complexity.* Each undirected edge is relaxed from both ends, so there are at most 2|E| pushes, each pop or push costing O(log |V|): the total work is O((|V| + |E|) log |V|). With |V| ≤ 41 in the interface (top_k up to 40) and |E| ≤ |V|(|V| − 1)/2 ≤ 820, this is negligible next to computing the |E| edge weights.

*Worked example.* Take four papers A (the origin), B, C, and D with edge weights A–B 0.278, A–C 0.764, A–D 0.310, B–C 0.176, and C–D 0.820 (B–D falls below 0.15 and is not drawn), so the costs are 0.722, 0.236, 0.690, 0.824, and 0.180.

| Step | Pop and settle | Relaxations | Distances afterwards |
|---|---|---|---|
| 1 | A (0) | B ← 0.722, C ← 0.236, D ← 0.690 | B 0.722, C 0.236, D 0.690 |
| 2 | C (0.236) | B: 0.236 + 0.824 = 1.060, not better; D: 0.236 + 0.180 = 0.416 < 0.690, so D ← 0.416 via C | B 0.722, C 0.236, D 0.416 |
| 3 | D (0.416) | neighbours A and C already settled | unchanged |
| 4 | (0.690, D) | stale entry for D, skipped | unchanged |
| 5 | B (0.722) | neighbours A and C already settled | final |

The result is A→C = [A, C] at 0.236, A→D = [A, C, D] at 0.416 (the direct edge costs 0.690), and A→B = [A, B] at 0.722. The condition above predicts the detour: w(A, C) + w(C, D) = 1.584 > 1 + w(A, D) = 1.310.

*Verification.* `test/test_shortest_paths.py` pins these statements: this worked example, the condition w₁ + w₂ > 1 + w_d over a grid of weights, the tie-breaking and edge-order rules, the 10⁻⁹ tolerance, the non-negative clamp, and agreement of the distances with an independent Bellman–Ford implementation on 300 random graphs, where every returned path costs exactly its reported distance and, with the origin star present, no distance exceeds 1.

**Shared groups.** The graph reports authors shared by at least two graph papers, topics (keyword tokens and subject/category parts) shared by at least two papers, and the citation groups of Section B.13: references and citers shared by at least two graph papers, cached from OpenAlex. The citation groups realize the Connected Papers common-reference and common-citation measures directly; the topic groups remain available as a fallback for papers whose citation neighbourhood has not been refreshed, which is why both are reported.

### B.9 BM25 Ranked Repository Search

The repository browse view offers a relevance ordering backed by SQLite's FTS5 extension (Robertson & Zaragoza, 2009). An external-content full-text index is kept synchronized with the papers table by three triggers and covers four columns: title, author, keywords, and abstract. User text is sanitized into quoted tokens joined by AND, and the final token is treated as a prefix, so an unfinished word still matches; a query with no usable token returns no rows. FTS5 ranks matches with its built-in bm25() function, whose defaults k1 = 1.2 and b = 0.75 are used unchanged, and the prototype weights the four columns title 10, author 5, keywords 5, abstract 1:

```
  rank(d) = sum over query terms t of weight_col(t) * BM25(t, d)

  BM25(t, d) = IDF(t) * ( f(t,d) * (k1 + 1) )
             / ( f(t,d) + k1 * ( 1 - b + b * len(d) / avg_len ) )

  weight_col = ( title 10, author 5, keywords 5, abstract 1 )
  IDF(t) and the defaults k1 = 1.2 and b = 0.75 come from FTS5's
  built-in bm25(); FTS5 returns the negated score, so ascending
  order is best-first

  a result carries a snippet around the best-matching column;
  if FTS5 is unavailable the same request falls back to the
  case-insensitive substring query used by the unranked orderings
```

Because the corpus accumulated duplicate records before the import
checks existed, the ranked list collapses them: two hits are treated
as the same work when their normalized DOIs match, when their
normalized titles are exactly equal, or when both titles are at least
twelve characters long and their title similarity reaches 0.85 (the
threshold the import path rejects re-imports with). The best-ranked
copy survives and carries a count of the copies it hid; the
twelve-character floor keeps short or garbled extraction titles from
creating false merges.

### B.10 Precomputed Vector Matrices

The rebuild materializes the per-paper TF-IDF and S-BERT vectors a second time as dense float32 matrices, with one L2-normalized row per paper, a parallel sorted paper-id vector, and a metadata sidecar (build time, counts, dimensions, model name). At request time each component score is one matrix-vector product, so per-row JSON parsing disappears from the request path. Any gap (a candidate missing from the matrix, a dimension mismatch, a stale sidecar) makes the component fall back to the per-paper loop, and the two paths return identical cosines; the test suite asserts parity within 1e-6.

```
  M in R^(n x d);  row_i = v(d_i) / ||v(d_i)||_2
                   row_i = 0 if ||v(d_i)||_2 = 0
  q_hat = q / ||q||_2

  s(d_i) = ( M * q_hat )_i

  fall back to per-paper cosine when d_i is not covered by the
  index or when any index metadata check fails
```

### B.11 MMR Diversification

Result diversification is opt-in. When a query supplies an MMR parameter lambda in [0, 1], the top pool of positive-score results is reranked by maximal marginal relevance (Carbonell & Goldstein, 1998) before truncation; the scores themselves are never recomputed, so the reranker changes order only, and the default behavior (lambda absent) is untouched.

```
  C = the first `pool` positive-score results, in score order
  S = [] ; first pick = argmax score in C
  then repeatedly:
    pick argmax over d in C \ S of
      lambda * score(d) - (1 - lambda) * max over j in S of sim(d, j)

  sim from S-BERT vectors when at least two pool papers have
  them, else from TF-IDF vectors, else constant 1 (no diversity
  signal); ties break by higher score, then lower paper id

  lambda in [0, 1]; pool in [1, 100]; remaining results are
  appended in score order after the reranked pool
```

The whole pool is reordered and the first top_k of the new order are returned. Each pair of pool papers is compared exactly once, so the reorder performs pool(pool − 1)/2 similarity evaluations (1,225 at the default pool of 50) and never forms an n × n matrix; the property is pinned by a unit test that counts the calls. The execution trace of Section B.15 carries the same lambda and pool, so the Stats for Nerds panel explains the order the Search page displays.

### B.12 Learned Fusion Weights (Offline Instrument)

A deterministic offline learner searches the fusion simplex for the weight vector that maximizes a chosen ranking metric on a relevance-judgment file (Section B.14). The search is coarse-to-fine: a grid of step 0.1 over the three components, then a step-0.05 refinement around the coarse winner; the preset 0.4/0.4/0.2 baseline is evaluated alongside. The result is persisted as JSON and can be loaded into the custom dials; the deployed six presets remain fixed and transparent, so the learner is a research instrument, not a runtime component.

```
  w* = argmax over w in Delta of  (1 / |Q|) * sum over q in Q
       of NDCG@k(w, q)

  Delta = { (w_tfidf, w_sbert, w_meta) :
            w_i >= 0 and w_tfidf + w_sbert + w_meta = 1 }
  w_i restricted to multiples of the step, coarse 0.1 then
  refine 0.05 within +/- 0.1 of the coarse winner
```

### B.13 Citation-Based Relatedness

The prototype caches each refreshed paper's OpenAlex citation neighbourhood in the paper_citations table: references the paper cites and works that cite it (Kessler, 1963; Small, 1973). Each cached work contributes a key that is `local:<paper_id>` when its DOI matches a local paper and otherwise the OpenAlex work id, so two papers couple through shared references or shared citers whether or not the external work itself is in the repository. The graph uses the combined score as the citation bonus of Section B.8 and reports shared reference and citer groups. With no cached rows the score is exactly 0, so an unrefreshed repository scores as before.

```
  R(d), C(d) = cached reference and citer key sets of paper d

  coupling(a,b)    = |R(a) ∩ R(b)| / max(1, min(|R(a)|, |R(b)|))
  co-citation(a,b) = |C(a) ∩ C(b)| / max(1, min(|C(a)|, |C(b)|))

  sim_cit(a,b) = 0.5 * coupling(a,b) + 0.5 * co-citation(a,b)
                 clamped to [0, 1]; 0 if either side has no rows

  graph edge bonus: + 0.25 * sim_cit(a,b)   (Section B.8)
```

### B.14 Offline Retrieval Metrics

The evaluation harness scores a ranked list against a relevance-judgment (qrels) file, in which each query carries the papers judged relevant and an optional integer gain per paper. The metrics are computed per query and macro-averaged across queries (Manning et al., 2008; Järvelin & Kekäläinen, 2002). Documented conventions: an empty ranked list or a query with no judged-relevant paper scores 0 on every metric; a duplicate id in the ranked list is counted once at its first occurrence; precision divides by k even when fewer than k results exist.

```
  rel(q) = judged-relevant papers; g(d) = integer gain of d

  P@k    = | top_k(q) ∩ rel(q) | / k
  R@k    = | top_k(q) ∩ rel(q) | / | rel(q) |
  MRR@k  = 1 / rank of the first relevant result
           (0 if none within k)
  AP@k   = ( 1 / | rel(q) | ) * sum over i <= k of
           P@i * [ d_i is relevant ]
  MAP@k  = mean of AP@k across queries
  DCG@k  = sum over i <= k of ( 2^g(d_i) - 1 ) / log2(1 + i)
  NDCG@k = DCG@k / IDCG@k
  IDCG@k = DCG of the gains sorted in descending order
```

### B.15 The Execution Trace (Stats for Nerds)

The Stats for Nerds panel lets a reader watch the real numbers of one search flow through the steps specified in this appendix; the formulas themselves are explained in the interface's Engine page. It is backed by `POST /api/recommendations/trace`, which runs the same `search_papers` code path as `GET /api/recommendations` with a recorder attached. The recorder only collects events and never influences the computation, so the traced results equal the untraced results; unit tests compare them, with and without MMR.

The request carries the pipeline, either a query or a seed paper id (not both), top_k (1 to 50), the dial allocation for the custom pipeline, and the opt-in MMR parameters of Section B.11 (lambda in [0, 1], pool in [1, 100]). The response is the ordered event list plus the ranked results. Events for components with zero weight are not recorded.

| Event | Contents |
|---|---|
| input | pipeline, top_k, query or seed id, and the effective weights |
| prepared_query | the normalized query text, its length, and its source (free text or seed paper) |
| candidates | the count and the id, title, and year of every valid candidate, recorded before a seed paper is removed from the set |
| component.tfidf | query-vector dimension and non-zero terms, the five heaviest query terms, each candidate's raw cosine, and the minimum and maximum |
| component.sbert | embedding dimension, each candidate's raw cosine, and the minimum and maximum |
| component.metadata.signals | the query metadata used, and each candidate's four signals and total (Section B.4) |
| component.metadata.summary | each candidate's total with the minimum and maximum |
| normalization | the min-max bounds of the TF-IDF and S-BERT scores with a degenerate flag (maximum equals minimum), and the metadata range |
| combine | the weights and S(d) for every candidate |
| rank | the first top_k papers with S(d) > 0, by the ranking rule of Section B.7, before any MMR |
| rerank.mmr | only when MMR is requested: lambda, the pool requested and used, the similarity source, and the first five ids before and after |

The panel's component tables list the top_k papers by relevance. When MMR is on it shows the relevance ranking and then the final order taken from the returned results, which can include papers from outside the relevance top_k because the pool is larger. The panel issues one trace per distinct query, seed, depth, MMR setting, pipeline, and weights, not one per page render.

## References (Appendix B Additions)

Carbonell, J., & Goldstein, J. (1998). The use of MMR, diversity-based reranking for reordering documents and producing summaries. In *Proceedings of the 21st Annual International ACM SIGIR Conference on Research and Development in Information Retrieval* (pp. 335–336). Association for Computing Machinery. https://doi.org/10.1145/290941.291025

Dijkstra, E. W. (1959). A note on two problems in connexion with graphs. *Numerische Mathematik*, *1*(1), 269–271. https://doi.org/10.1007/BF01386390

Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR techniques. *ACM Transactions on Information Systems*, *20*(4), 422–446. https://doi.org/10.1145/582415.582418

Kessler, M. M. (1963). Bibliographic coupling between scientific papers. *American Documentation*, *14*(1), 10–25. https://doi.org/10.1002/asi.5090140103

Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to information retrieval*. Cambridge University Press.

Robertson, S., & Zaragoza, H. (2009). The probabilistic relevance framework: BM25 and beyond. *Foundations and Trends in Information Retrieval*, *3*(4), 333–389. https://doi.org/10.1561/1500000019

Small, H. (1973). Co-citation in the scientific literature: A new measure of the relationship between two documents. *Journal of the American Society for Information Science*, *24*(4), 265–269. https://doi.org/10.1002/asi.4630240406